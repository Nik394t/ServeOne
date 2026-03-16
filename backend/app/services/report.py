from datetime import date, datetime

from sqlalchemy.orm import Session

from app.models.birthday import BirthdayProfile
from app.models.broadcast import BroadcastCampaign, BroadcastRecipient, InboxMessage
from app.models.duty import DutyHistory, DutyMember, DutyState
from app.models.instruction import InstructionGuide, InstructionProgress
from app.models.message import DirectMessage
from app.models.push import PushSubscription
from app.models.schedule import Position, PositionHold, ServiceWeek, WeeklyAssignment
from app.models.user import User, UserRole
from app.schemas.report import (
    CommunicationMetricsRead,
    DutyHistoryItemRead,
    DutyMetricsRead,
    InstructionMetricsRead,
    ReportOverviewRead,
    ServiceLoadRead,
    ServiceMetricsRead,
    TeamMetricsRead,
    UpcomingAssignmentRead,
    UpcomingBirthdayRead,
)
from app.services.birthday import _next_birthday
from app.services.schedule import ensure_service_week, get_effective_service_date


def build_reports_overview(db: Session) -> ReportOverviewRead:
    active_positions = db.query(Position).filter(Position.is_active == True).order_by(Position.sort_order.asc()).all()
    users = db.query(User).filter(User.role != UserRole.DELETED.value).all()
    users_by_id = {user.id: user for user in users}

    upcoming_service_date = get_effective_service_date(db)
    upcoming_week = ensure_service_week(db, upcoming_service_date)
    upcoming_assignments = (
        db.query(WeeklyAssignment)
        .filter(WeeklyAssignment.week_id == upcoming_week.week_id)
        .order_by(WeeklyAssignment.position_id.asc())
        .all()
    )
    holds = db.query(PositionHold).all()
    hold_by_position = {hold.position_id: hold for hold in holds}
    position_by_id = {position.id: position for position in active_positions}

    team = _build_team_metrics(db, users)
    service = _build_service_metrics(db, active_positions, upcoming_week, upcoming_assignments, holds)
    communication = _build_communication_metrics(db)
    duty, recent_duty_history = _build_duty_metrics(db, users_by_id)
    instructions = _build_instruction_metrics(db, upcoming_service_date)

    return ReportOverviewRead(
        generated_at=datetime.utcnow(),
        team=team,
        service=service,
        communication=communication,
        duty=duty,
        instructions=instructions,
        upcoming_birthdays=_build_upcoming_birthdays(db, users_by_id),
        top_service_users=_build_service_load(db, users, holds),
        upcoming_assignments=[
            UpcomingAssignmentRead(
                position_name=position_by_id.get(row.position_id).name if position_by_id.get(row.position_id) else f'Позиция #{row.position_id}',
                user_name=_display_name(users_by_id.get(row.user_id)),
                partner_user_name=_display_name(users_by_id.get(row.partner_user_id)),
                hold_remaining=hold_by_position.get(row.position_id).remaining if hold_by_position.get(row.position_id) else None,
            )
            for row in upcoming_assignments
        ],
        recent_duty_history=recent_duty_history,
    )


def _build_team_metrics(db: Session, users: list[User]) -> TeamMetricsRead:
    active_users = [user for user in users if user.is_active]
    inactive_users = [user for user in users if not user.is_active]
    return TeamMetricsRead(
        total_users=len(users),
        active_users=len(active_users),
        inactive_users=len(inactive_users),
        admins=sum(1 for user in users if user.role == UserRole.ADMIN.value),
        creators=sum(1 for user in users if user.role == UserRole.CREATOR.value),
        birthday_profiles=db.query(BirthdayProfile).count(),
        push_subscriptions=db.query(PushSubscription).count(),
    )


def _build_service_metrics(
    db: Session,
    positions: list[Position],
    upcoming_week: ServiceWeek,
    upcoming_assignments: list[WeeklyAssignment],
    holds: list[PositionHold],
) -> ServiceMetricsRead:
    all_weeks = db.query(ServiceWeek).all()
    return ServiceMetricsRead(
        total_positions=len(positions),
        total_weeks=len(all_weeks),
        completed_weeks=sum(1 for week in all_weeks if week.is_completed),
        upcoming_week_id=upcoming_week.week_id,
        upcoming_service_date=upcoming_week.service_date,
        upcoming_assigned=sum(1 for row in upcoming_assignments if row.user_id is not None),
        upcoming_unassigned=sum(1 for row in upcoming_assignments if row.user_id is None),
        upcoming_partners=sum(1 for row in upcoming_assignments if row.partner_user_id is not None),
        active_holds=len(holds),
    )


def _build_communication_metrics(db: Session) -> CommunicationMetricsRead:
    return CommunicationMetricsRead(
        broadcast_campaigns=db.query(BroadcastCampaign).count(),
        broadcast_recipients=db.query(BroadcastRecipient).count(),
        inbox_messages=db.query(InboxMessage).count(),
        unread_inbox_messages=db.query(InboxMessage).filter(InboxMessage.is_read == False).count(),
        direct_messages=db.query(DirectMessage).count(),
        unread_direct_messages=db.query(DirectMessage).filter(DirectMessage.is_read_by_recipient == False).count(),
    )


def _build_duty_metrics(db: Session, users_by_id: dict[int, User]) -> tuple[DutyMetricsRead, list[DutyHistoryItemRead]]:
    queue = db.query(DutyMember).order_by(DutyMember.sort_order.asc(), DutyMember.id.asc()).all()
    state = db.query(DutyState).order_by(DutyState.id.asc()).first()
    history_rows = db.query(DutyHistory).order_by(DutyHistory.advanced_at.desc(), DutyHistory.id.desc()).limit(6).all()

    current_user_name = None
    next_user_name = None
    if queue:
        index = state.current_index if state else 0
        current_user_name = _display_name(users_by_id.get(queue[index % len(queue)].user_id))
        if len(queue) > 1:
            next_user_name = _display_name(users_by_id.get(queue[(index + 1) % len(queue)].user_id))
        else:
            next_user_name = current_user_name

    recent_history = [
        DutyHistoryItemRead(
            previous_user_name=_display_name(users_by_id.get(row.previous_user_id)),
            current_user_name=_display_name(users_by_id.get(row.current_user_id)),
            reason=row.reason,
            note=row.note,
            advanced_at=row.advanced_at,
        )
        for row in history_rows
    ]

    return (
        DutyMetricsRead(
            queue_size=len(queue),
            current_user_name=current_user_name,
            next_user_name=next_user_name,
            advances_total=db.query(DutyHistory).count(),
            auto_advances=db.query(DutyHistory).filter(DutyHistory.reason == 'auto').count(),
            manual_advances=db.query(DutyHistory).filter(DutyHistory.reason == 'manual').count(),
            last_advance_at=history_rows[0].advanced_at if history_rows else None,
        ),
        recent_history,
    )


def _build_instruction_metrics(db: Session, service_date) -> InstructionMetricsRead:
    guides = db.query(InstructionGuide).all()
    guide_by_id = {guide.id: guide for guide in guides}
    all_progress = db.query(InstructionProgress).all()
    current_progress = [row for row in all_progress if row.service_date == service_date]

    total_items = 0
    checked_items = 0
    for row in current_progress:
        guide = guide_by_id.get(row.instruction_id)
        checklist = guide.checklist if guide else []
        total_items += len(checklist)
        checked_items += len(row.checked_item_ids or [])

    rate = round((checked_items / total_items) * 100, 1) if total_items else 0.0

    return InstructionMetricsRead(
        guides_total=len(guides),
        progress_records_total=len(all_progress),
        current_week_progress_records=len(current_progress),
        current_week_completion_rate=rate,
    )


def _build_upcoming_birthdays(db: Session, users_by_id: dict[int, User]) -> list[UpcomingBirthdayRead]:
    today = date.today()
    profiles = db.query(BirthdayProfile).all()
    items: list[UpcomingBirthdayRead] = []
    for profile in profiles:
        user = users_by_id.get(profile.user_id)
        if not user or user.role == UserRole.DELETED.value:
            continue
        next_birthday = _next_birthday(profile.birth_date, today)
        items.append(
            UpcomingBirthdayRead(
                user_id=user.id,
                display_name=_display_name(user),
                next_birthday=next_birthday,
                days_until=(next_birthday - today).days,
                address_form=profile.address_form,
            )
        )
    items.sort(key=lambda item: (item.days_until, item.display_name.lower()))
    return items[:6]


def _build_service_load(db: Session, users: list[User], holds: list[PositionHold]) -> list[ServiceLoadRead]:
    load_map: dict[int, dict[str, int | str]] = {}
    for user in users:
        if not user.is_active:
            continue
        load_map[user.id] = {
            'display_name': _display_name(user),
            'role': user.role,
            'assignments_main': 0,
            'assignments_partner': 0,
            'hold_positions': 0,
        }

    assignments = db.query(WeeklyAssignment).all()
    for row in assignments:
        if row.user_id in load_map:
            load_map[row.user_id]['assignments_main'] += 1
        if row.partner_user_id in load_map:
            load_map[row.partner_user_id]['assignments_partner'] += 1

    for hold in holds:
        if hold.user_id in load_map:
            load_map[hold.user_id]['hold_positions'] += 1

    result = [
        ServiceLoadRead(
            user_id=user_id,
            display_name=str(data['display_name']),
            role=str(data['role']),
            assignments_main=int(data['assignments_main']),
            assignments_partner=int(data['assignments_partner']),
            hold_positions=int(data['hold_positions']),
            total_load=int(data['assignments_main']) + int(data['assignments_partner']) + int(data['hold_positions']),
        )
        for user_id, data in load_map.items()
    ]
    result.sort(key=lambda item: (-item.total_load, -item.assignments_main, item.display_name.lower()))
    return result[:8]


def _display_name(user: User | None) -> str | None:
    if not user:
        return None
    return user.full_name or user.login
