from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.schedule import Position, PositionHold, ServiceWeek, WeeklyAssignment
from app.models.user import User, UserRole
from app.schemas.schedule import AssignmentRead, PositionHoldRead, PositionRead, ScheduleWeekRead
from app.schemas.user import UserRead

DEFAULT_POSITIONS = [
    ("presenter", "Презентер", 1),
    ("livestream", "Трансляция", 2),
    ("atem", "ATEM Mini", 3),
    ("light", "Свет", 4),
    ("camera1", "Камера 1", 5),
    ("camera2", "Камера 2", 6),
    ("sound", "Звук", 7),
]


def upcoming_sunday(today: date | None = None) -> date:
    today = today or date.today()
    offset = (6 - today.weekday()) % 7
    return today + timedelta(days=offset)


def week_id_from_date(value: date) -> str:
    iso_year, iso_week, _ = value.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"


def ensure_default_positions(db: Session) -> list[Position]:
    created = False
    for code, name, sort_order in DEFAULT_POSITIONS:
        row = db.query(Position).filter(Position.code == code).first()
        if not row:
            row = Position(code=code, name=name, sort_order=sort_order, is_active=True)
            db.add(row)
            created = True
        else:
            row.name = name
            row.sort_order = sort_order
            row.is_active = True
            db.add(row)
    if created:
        db.commit()
    else:
        db.flush()
    return db.query(Position).filter(Position.is_active == True).order_by(Position.sort_order.asc()).all()


def get_visible_users(db: Session) -> list[User]:
    return (
        db.query(User)
        .filter(User.role != UserRole.DELETED.value)
        .order_by(User.full_name.asc(), User.login.asc())
        .all()
    )


def get_assignable_user(db: Session, user_id: int | None) -> User | None:
    if user_id is None:
        return None
    user = db.get(User, user_id)
    if not user or not user.is_active or user.role == UserRole.DELETED.value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь недоступен для назначения")
    return user


def get_effective_service_date(db: Session, today: date | None = None) -> date:
    today = today or date.today()
    candidate = upcoming_sunday(today)
    wk_id = week_id_from_date(candidate)
    row = db.query(ServiceWeek).filter(ServiceWeek.week_id == wk_id).first()
    if row and row.is_completed and row.service_date <= today:
        return candidate + timedelta(days=7)
    return candidate


def ensure_service_week(db: Session, service_date: date) -> ServiceWeek:
    positions = ensure_default_positions(db)
    wk_id = week_id_from_date(service_date)
    week = db.query(ServiceWeek).filter(ServiceWeek.week_id == wk_id).first()
    if not week:
        week = ServiceWeek(week_id=wk_id, service_date=service_date, is_completed=False)
        db.add(week)
        db.commit()
        db.refresh(week)

    existing = {row.position_id: row for row in db.query(WeeklyAssignment).filter(WeeklyAssignment.week_id == wk_id).all()}
    created = False
    for position in positions:
        if position.id not in existing:
            db.add(
                WeeklyAssignment(
                    week_id=wk_id,
                    service_date=service_date,
                    position_id=position.id,
                    user_id=None,
                    partner_user_id=None,
                )
            )
            created = True
    if created:
        db.commit()

    _apply_holds_to_week(db, wk_id)
    return db.query(ServiceWeek).filter(ServiceWeek.week_id == wk_id).first()


def _apply_holds_to_week(db: Session, wk_id: str) -> None:
    assignments = db.query(WeeklyAssignment).filter(WeeklyAssignment.week_id == wk_id).all()
    hold_map = {hold.position_id: hold for hold in db.query(PositionHold).all()}
    changed = False
    for assignment in assignments:
        hold = hold_map.get(assignment.position_id)
        if not hold:
            continue
        holder = db.get(User, hold.user_id)
        if not holder or not holder.is_active or holder.role == UserRole.DELETED.value:
            continue
        if assignment.user_id != hold.user_id:
            assignment.user_id = hold.user_id
            if assignment.partner_user_id == hold.user_id:
                assignment.partner_user_id = None
            db.add(assignment)
            changed = True
    if changed:
        db.commit()


def build_schedule_week_payload(db: Session, service_date: date | None = None) -> ScheduleWeekRead:
    service_date = service_date or get_effective_service_date(db)
    week = ensure_service_week(db, service_date)
    wk_id = week.week_id
    positions = db.query(Position).filter(Position.is_active == True).order_by(Position.sort_order.asc()).all()
    assignments = db.query(WeeklyAssignment).filter(WeeklyAssignment.week_id == wk_id).all()
    assignment_map = {row.position_id: row for row in assignments}
    hold_map = {hold.position_id: hold for hold in db.query(PositionHold).all()}
    users = get_visible_users(db)

    assignment_items: list[AssignmentRead] = []
    for position in positions:
        assignment = assignment_map.get(position.id)
        hold = hold_map.get(position.id)
        assignment_items.append(
            AssignmentRead(
                id=assignment.id,
                week_id=wk_id,
                service_date=service_date,
                position_id=position.id,
                position_code=position.code,
                position_name=position.name,
                user_id=assignment.user_id if assignment else None,
                partner_user_id=assignment.partner_user_id if assignment else None,
                hold=(
                    PositionHoldRead(
                        id=hold.id,
                        position_id=hold.position_id,
                        user_id=hold.user_id,
                        remaining=hold.remaining,
                    )
                    if hold
                    else None
                ),
            )
        )

    return ScheduleWeekRead(
        week_id=wk_id,
        service_date=service_date,
        is_completed=week.is_completed,
        positions=[PositionRead.model_validate(position, from_attributes=True) for position in positions],
        users=[UserRead.model_validate(user, from_attributes=True) for user in users],
        assignments=assignment_items,
    )


def update_assignment_user(db: Session, assignment_id: int, user_id: int | None) -> None:
    assignment = db.get(WeeklyAssignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Назначение не найдено")
    week = db.query(ServiceWeek).filter(ServiceWeek.week_id == assignment.week_id).first()
    if week and week.is_completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неделя уже завершена")

    hold = db.query(PositionHold).filter(PositionHold.position_id == assignment.position_id).first()
    if hold and user_id != hold.user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="На позиции есть фиксация. Сначала снимите её или назначьте закреплённого пользователя")

    if user_id is not None:
        get_assignable_user(db, user_id)
        if assignment.partner_user_id == user_id:
            assignment.partner_user_id = None
    else:
        assignment.partner_user_id = None
    assignment.user_id = user_id
    db.add(assignment)
    db.commit()


def update_assignment_partner(db: Session, assignment_id: int, partner_user_id: int | None) -> None:
    assignment = db.get(WeeklyAssignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Назначение не найдено")
    week = db.query(ServiceWeek).filter(ServiceWeek.week_id == assignment.week_id).first()
    if week and week.is_completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неделя уже завершена")
    if partner_user_id is not None:
        if assignment.user_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Сначала назначьте основного служителя")
        if partner_user_id == assignment.user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Напарник не может совпадать с основным служителем")
        get_assignable_user(db, partner_user_id)
    assignment.partner_user_id = partner_user_id
    db.add(assignment)
    db.commit()


def upsert_hold(db: Session, position_id: int, user_id: int, remaining: int) -> PositionHold:
    if remaining < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Количество служений должно быть не меньше 1")
    position = db.get(Position, position_id)
    if not position or not position.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Позиция не найдена")
    get_assignable_user(db, user_id)
    hold = db.query(PositionHold).filter(PositionHold.position_id == position_id).first()
    if not hold:
        hold = PositionHold(position_id=position_id, user_id=user_id, remaining=remaining)
    else:
        hold.user_id = user_id
        hold.remaining = remaining
    db.add(hold)
    db.commit()
    db.refresh(hold)

    assignment = db.query(WeeklyAssignment).filter(
        WeeklyAssignment.week_id == week_id_from_date(get_effective_service_date(db)),
        WeeklyAssignment.position_id == position_id,
    ).first()
    if assignment:
        assignment.user_id = user_id
        if assignment.partner_user_id == user_id:
            assignment.partner_user_id = None
        db.add(assignment)
        db.commit()

    return hold


def delete_hold(db: Session, hold_id: int) -> None:
    hold = db.get(PositionHold, hold_id)
    if not hold:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Фиксация не найдена")
    db.delete(hold)
    db.commit()


def complete_week(db: Session, week_id: str) -> None:
    week = db.query(ServiceWeek).filter(ServiceWeek.week_id == week_id).first()
    if not week:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Неделя не найдена")
    if week.is_completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неделя уже завершена")

    assignments = db.query(WeeklyAssignment).filter(WeeklyAssignment.week_id == week_id).all()
    hold_map = {hold.position_id: hold for hold in db.query(PositionHold).all()}
    changed = False
    for assignment in assignments:
        hold = hold_map.get(assignment.position_id)
        if not hold or hold.user_id != assignment.user_id:
            continue
        hold.remaining -= 1
        if hold.remaining <= 0:
            db.delete(hold)
        else:
            db.add(hold)
        changed = True

    week.is_completed = True
    db.add(week)
    db.commit()
