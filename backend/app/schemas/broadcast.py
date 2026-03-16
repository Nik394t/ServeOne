from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.user import UserRead


class BirthdayOptionRead(BaseModel):
    user_id: int
    display_name: str
    birth_date: str | None
    genitive_name: str | None
    address_form: Literal['brother', 'sister'] | None


class BroadcastHistoryRead(BaseModel):
    id: int
    kind: str
    title: str
    body: str
    target_mode: str
    created_at: datetime
    created_by_user_name: str | None
    recipient_count: int
    recipients: list[str]


class BroadcastCollectionRead(BaseModel):
    users: list[UserRead]
    birthday_people: list[BirthdayOptionRead]
    history: list[BroadcastHistoryRead]


class BroadcastSendPayload(BaseModel):
    kind: Literal['general', 'birthday_gift']
    title: str | None = None
    body: str | None = None
    target_mode: Literal['all', 'users', 'admins', 'selected']
    selected_user_ids: list[int] = Field(default_factory=list)
    excluded_user_ids: list[int] = Field(default_factory=list)
    birthday_user_id: int | None = None
    address_form: Literal['brother', 'sister'] | None = None
    card_number: str | None = None
    sbp_phone: str | None = None
    bank_name: str | None = None
    recipient_name: str | None = None
    extra_note: str | None = None


class BroadcastSendResponse(BaseModel):
    status: str
    campaign_id: int
    recipient_count: int
