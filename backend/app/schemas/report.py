from datetime import date, datetime

from pydantic import BaseModel


class TeamMetricsRead(BaseModel):
    total_users: int
    active_users: int
    inactive_users: int
    admins: int
    creators: int
    birthday_profiles: int
    push_subscriptions: int


class ServiceMetricsRead(BaseModel):
    total_positions: int
    total_weeks: int
    completed_weeks: int
    upcoming_week_id: str
    upcoming_service_date: date
    upcoming_assigned: int
    upcoming_unassigned: int
    upcoming_partners: int
    active_holds: int


class CommunicationMetricsRead(BaseModel):
    broadcast_campaigns: int
    broadcast_recipients: int
    inbox_messages: int
    unread_inbox_messages: int
    direct_messages: int
    unread_direct_messages: int


class DutyMetricsRead(BaseModel):
    queue_size: int
    current_user_name: str | None
    next_user_name: str | None
    advances_total: int
    auto_advances: int
    manual_advances: int
    last_advance_at: datetime | None


class InstructionMetricsRead(BaseModel):
    guides_total: int
    progress_records_total: int
    current_week_progress_records: int
    current_week_completion_rate: float


class UpcomingBirthdayRead(BaseModel):
    user_id: int
    display_name: str
    next_birthday: date
    days_until: int
    address_form: str | None


class ServiceLoadRead(BaseModel):
    user_id: int
    display_name: str
    role: str
    assignments_main: int
    assignments_partner: int
    hold_positions: int
    total_load: int


class UpcomingAssignmentRead(BaseModel):
    position_name: str
    user_name: str | None
    partner_user_name: str | None
    hold_remaining: int | None


class DutyHistoryItemRead(BaseModel):
    previous_user_name: str | None
    current_user_name: str | None
    reason: str
    note: str | None
    advanced_at: datetime


class ReportOverviewRead(BaseModel):
    generated_at: datetime
    team: TeamMetricsRead
    service: ServiceMetricsRead
    communication: CommunicationMetricsRead
    duty: DutyMetricsRead
    instructions: InstructionMetricsRead
    upcoming_birthdays: list[UpcomingBirthdayRead]
    top_service_users: list[ServiceLoadRead]
    upcoming_assignments: list[UpcomingAssignmentRead]
    recent_duty_history: list[DutyHistoryItemRead]
