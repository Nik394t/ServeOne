from datetime import date, datetime

from pydantic import BaseModel


class ChecklistItem(BaseModel):
    id: str | None = None
    text: str


class InstructionRead(BaseModel):
    id: int
    position_id: int
    position_code: str
    position_name: str
    position_sort_order: int
    title: str
    summary: str | None
    content: str
    checklist: list[ChecklistItem]
    checked_item_ids: list[str]
    assigned_to_me: bool
    updated_at: datetime


class InstructionCollectionRead(BaseModel):
    service_date: date
    items: list[InstructionRead]


class InstructionUpdate(BaseModel):
    title: str
    summary: str | None = None
    content: str
    checklist: list[ChecklistItem]


class InstructionProgressUpdate(BaseModel):
    checked_item_ids: list[str]
