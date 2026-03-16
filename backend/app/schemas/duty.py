from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.user import UserRead


class DutyMemberRead(BaseModel):
    id: int
    user_id: int
    sort_order: int
    user: UserRead


class DutyHistoryRead(BaseModel):
    id: int
    previous_user_id: int | None
    previous_user_name: str | None
    current_user_id: int | None
    current_user_name: str | None
    reason: str
    note: str | None
    advanced_at: datetime


class DutyOverviewRead(BaseModel):
    current_user_id: int | None
    current_user_name: str | None
    next_user_id: int | None
    next_user_name: str | None
    queue: list[DutyMemberRead]
    users: list[UserRead]
    history: list[DutyHistoryRead]
    last_auto_advance: date | None


class DutyMemberCreate(BaseModel):
    user_id: int


class DutyMemberMove(BaseModel):
    direction: Literal['up', 'down']


class DutyAdvanceResponse(BaseModel):
    status: str
    current_user_id: int | None
    current_user_name: str | None
