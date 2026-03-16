from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.duty import DutyHistory, DutyMember, DutyState
from app.models.user import User, UserRole
from app.schemas.duty import DutyHistoryRead, DutyMemberRead, DutyOverviewRead
from app.schemas.user import UserRead


def get_visible_users(db: Session) -> list[User]:
    return (
        db.query(User)
        .filter(User.role != UserRole.DELETED.value)
        .order_by(User.full_name.asc(), User.login.asc())
        .all()
    )


def get_assignable_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user or not user.is_active or user.role == UserRole.DELETED.value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Пользователь недоступен для дежурства')
    return user


def get_or_create_state(db: Session) -> DutyState:
    state = db.get(DutyState, 1)
    if state:
        return state
    state = DutyState(id=1, current_index=0, last_auto_advance=None)
    db.add(state)
    db.commit()
    db.refresh(state)
    return state


def list_members(db: Session) -> list[DutyMember]:
    return db.query(DutyMember).order_by(DutyMember.sort_order.asc(), DutyMember.id.asc()).all()


def _clamp_index(index: int, size: int) -> int:
    if size <= 0:
        return 0
    return max(0, min(index, size - 1))


def sync_duty_state(db: Session, today: date | None = None, allow_auto_advance: bool = True) -> tuple[DutyState, list[DutyMember]]:
    today = today or date.today()
    state = get_or_create_state(db)
    members = list_members(db)
    current_user_id = None
    if members and 0 <= state.current_index < len(members):
        current_user_id = members[state.current_index].user_id

    changed = False
    valid_members: list[DutyMember] = []
    for member in members:
        user = db.get(User, member.user_id)
        if not user or not user.is_active or user.role == UserRole.DELETED.value:
            db.delete(member)
            changed = True
            continue
        valid_members.append(member)

    for index, member in enumerate(valid_members, start=1):
        if member.sort_order != index:
            member.sort_order = index
            db.add(member)
            changed = True

    if not valid_members:
        if state.current_index != 0:
            state.current_index = 0
            changed = True
    else:
        if current_user_id is not None:
            next_index = next((idx for idx, member in enumerate(valid_members) if member.user_id == current_user_id), None)
            if next_index is None:
                next_index = _clamp_index(state.current_index, len(valid_members))
        else:
            next_index = _clamp_index(state.current_index, len(valid_members))
        if state.current_index != next_index:
            state.current_index = next_index
            changed = True

    if changed:
        db.add(state)
        db.commit()
        db.refresh(state)
        members = list_members(db)
    else:
        members = valid_members

    if allow_auto_advance and today.weekday() == 0 and state.last_auto_advance != today:
        auto_advance_if_due(db, today=today)
        state = get_or_create_state(db)
        members = list_members(db)

    return state, members


def auto_advance_if_due(db: Session, today: date | None = None) -> bool:
    today = today or date.today()
    state, members = sync_duty_state(db, today=today, allow_auto_advance=False)
    if state.last_auto_advance == today:
        return False

    if not members:
        state.last_auto_advance = today
        db.add(state)
        db.commit()
        return False

    advanced = advance_duty_queue(
        db,
        reason='auto',
        note='Автосдвиг очереди по понедельникам',
        today=today,
        allow_sync=False,
    )
    if not advanced:
        state = get_or_create_state(db)
        state.last_auto_advance = today
        db.add(state)
        db.commit()
    return advanced


def advance_duty_queue(
    db: Session,
    reason: str = 'manual',
    note: str | None = None,
    today: date | None = None,
    allow_sync: bool = True,
) -> bool:
    today = today or date.today()
    state, members = sync_duty_state(db, today=today, allow_auto_advance=False) if allow_sync else (get_or_create_state(db), list_members(db))

    if not members:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Очередь дежурств пуста')

    if len(members) == 1:
        if reason == 'auto':
            state.last_auto_advance = today
            db.add(state)
            db.commit()
        return False

    previous_member = members[_clamp_index(state.current_index, len(members))]
    next_index = (state.current_index + 1) % len(members)
    current_member = members[next_index]
    state.current_index = next_index
    if reason == 'auto':
        state.last_auto_advance = today

    history = DutyHistory(
        previous_user_id=previous_member.user_id,
        current_user_id=current_member.user_id,
        reason=reason,
        note=note,
    )
    db.add(state)
    db.add(history)
    db.commit()
    return True


def build_duty_payload(db: Session, today: date | None = None) -> DutyOverviewRead:
    state, members = sync_duty_state(db, today=today)
    users = get_visible_users(db)
    user_map = {user.id: user for user in users}

    current_member = members[state.current_index] if members else None
    next_member = None
    if members:
        if len(members) == 1:
            next_member = members[0]
        else:
            next_member = members[(state.current_index + 1) % len(members)]

    queue = [
        DutyMemberRead(
            id=member.id,
            user_id=member.user_id,
            sort_order=member.sort_order,
            user=UserRead.model_validate(user_map[member.user_id], from_attributes=True),
        )
        for member in members
        if member.user_id in user_map
    ]

    history_rows = db.query(DutyHistory).order_by(DutyHistory.advanced_at.desc(), DutyHistory.id.desc()).limit(20).all()
    history = []
    for row in history_rows:
        previous_user = user_map.get(row.previous_user_id) if row.previous_user_id else None
        current_user = user_map.get(row.current_user_id) if row.current_user_id else None
        if row.previous_user_id and previous_user is None:
            previous_user = db.get(User, row.previous_user_id)
        if row.current_user_id and current_user is None:
            current_user = db.get(User, row.current_user_id)
        history.append(
            DutyHistoryRead(
                id=row.id,
                previous_user_id=row.previous_user_id,
                previous_user_name=_user_label(previous_user),
                current_user_id=row.current_user_id,
                current_user_name=_user_label(current_user),
                reason=row.reason,
                note=row.note,
                advanced_at=row.advanced_at,
            )
        )

    return DutyOverviewRead(
        current_user_id=current_member.user_id if current_member else None,
        current_user_name=_user_label(user_map.get(current_member.user_id)) if current_member else None,
        next_user_id=next_member.user_id if next_member else None,
        next_user_name=_user_label(user_map.get(next_member.user_id)) if next_member else None,
        queue=queue,
        users=[UserRead.model_validate(user, from_attributes=True) for user in users],
        history=history,
        last_auto_advance=state.last_auto_advance,
    )


def add_duty_member(db: Session, user_id: int) -> None:
    get_assignable_user(db, user_id)
    sync_duty_state(db, allow_auto_advance=False)
    existing = db.query(DutyMember).filter(DutyMember.user_id == user_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Пользователь уже есть в очереди')
    last_member = db.query(DutyMember).order_by(DutyMember.sort_order.desc(), DutyMember.id.desc()).first()
    sort_order = (last_member.sort_order + 1) if last_member else 1
    db.add(DutyMember(user_id=user_id, sort_order=sort_order))
    db.commit()


def remove_duty_member(db: Session, member_id: int) -> None:
    state, members = sync_duty_state(db, allow_auto_advance=False)
    member = db.get(DutyMember, member_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Участник очереди не найден')
    current_user_id = members[state.current_index].user_id if members and 0 <= state.current_index < len(members) else None
    db.delete(member)
    db.commit()

    state, members = sync_duty_state(db, allow_auto_advance=False)
    if not members:
        if state.current_index != 0:
            state.current_index = 0
            db.add(state)
            db.commit()
        return

    next_index = next((index for index, item in enumerate(members) if item.user_id == current_user_id), None)
    if next_index is None:
        next_index = _clamp_index(state.current_index, len(members))
    if state.current_index != next_index:
        state.current_index = next_index
        db.add(state)
        db.commit()


def move_duty_member(db: Session, member_id: int, direction: str) -> None:
    sync_duty_state(db, allow_auto_advance=False)
    members = list_members(db)
    index = next((idx for idx, member in enumerate(members) if member.id == member_id), None)
    if index is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Участник очереди не найден')

    if direction == 'up':
        if index == 0:
            return
        swap_index = index - 1
    else:
        if index == len(members) - 1:
            return
        swap_index = index + 1

    current = members[index]
    other = members[swap_index]
    current.sort_order, other.sort_order = other.sort_order, current.sort_order
    db.add(current)
    db.add(other)
    db.commit()

    state = get_or_create_state(db)
    if state.current_index == index:
        state.current_index = swap_index
        db.add(state)
        db.commit()
    elif state.current_index == swap_index:
        state.current_index = index
        db.add(state)
        db.commit()

    sync_duty_state(db, allow_auto_advance=False)


def _user_label(user: User | None) -> str | None:
    if not user:
        return None
    return user.full_name or user.login
