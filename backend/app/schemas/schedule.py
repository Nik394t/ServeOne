from datetime import date
from typing import Optional

from pydantic import BaseModel

from app.schemas.user import UserRead


class PositionRead(BaseModel):
    id: int
    code: str
    name: str
    sort_order: int
    is_active: bool


class PositionHoldRead(BaseModel):
    id: int
    position_id: int
    user_id: int
    remaining: int


class AssignmentRead(BaseModel):
    id: int
    week_id: str
    service_date: date
    position_id: int
    position_code: str
    position_name: str
    user_id: Optional[int] = None
    partner_user_id: Optional[int] = None
    hold: Optional[PositionHoldRead] = None


class ScheduleWeekRead(BaseModel):
    week_id: str
    service_date: date
    is_completed: bool
    positions: list[PositionRead]
    users: list[UserRead]
    assignments: list[AssignmentRead]


class AssignmentUpdate(BaseModel):
    user_id: Optional[int] = None


class PartnerUpdate(BaseModel):
    partner_user_id: Optional[int] = None


class HoldUpsert(BaseModel):
    position_id: int
    user_id: int
    remaining: int


class CompleteWeekResponse(BaseModel):
    status: str
    week_id: str
