from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.user import UserRead


class BirthdayPersonRead(BaseModel):
    user: UserRead
    birth_date: date | None
    genitive_name: str | None
    address_form: Literal['brother', 'sister'] | None
    note: str | None
    next_birthday: date | None
    days_until: int | None


class BirthdayTemplateRead(BaseModel):
    id: int
    title: str
    message: str
    scripture: str | None
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class BirthdayCollectionRead(BaseModel):
    today: date
    people: list[BirthdayPersonRead]
    templates: list[BirthdayTemplateRead]


class BirthdayPersonUpdate(BaseModel):
    birth_date: date | None = None
    genitive_name: str | None = None
    address_form: Literal['brother', 'sister'] | None = None
    note: str | None = None


class BirthdayTemplateCreate(BaseModel):
    title: str
    message: str
    scripture: str | None = None
    sort_order: int = 1
    is_active: bool = True


class BirthdayTemplateUpdate(BaseModel):
    title: str | None = None
    message: str | None = None
    scripture: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None
