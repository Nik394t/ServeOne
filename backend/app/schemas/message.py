from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.user import UserRead


class MessageContactRead(BaseModel):
    id: int
    display_name: str
    role: str


class MessageItemRead(BaseModel):
    kind: Literal['broadcast', 'direct']
    record_id: int
    title: str
    body: str
    created_at: datetime
    is_read: bool
    direction: Literal['incoming', 'outgoing', 'system']
    sender_user: UserRead | None
    recipient_user: UserRead | None


class MessageCollectionRead(BaseModel):
    items: list[MessageItemRead]
    contacts: list[MessageContactRead]
    unread_count: int


class DirectMessageCreate(BaseModel):
    recipient_user_id: int
    title: str
    body: str
