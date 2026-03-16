from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class InstructionGuide(Base):
    __tablename__ = 'instruction_guides'
    __table_args__ = (UniqueConstraint('position_id', name='uq_instruction_guide_position'),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    position_id: Mapped[int] = mapped_column(ForeignKey('positions.id', ondelete='CASCADE'), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content: Mapped[str] = mapped_column(String(4000), nullable=False)
    checklist: Mapped[list[dict[str, str]]] = mapped_column(JSON, nullable=False, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class InstructionProgress(Base):
    __tablename__ = 'instruction_progress'
    __table_args__ = (UniqueConstraint('instruction_id', 'user_id', 'service_date', name='uq_instruction_progress_scope'),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    instruction_id: Mapped[int] = mapped_column(ForeignKey('instruction_guides.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    service_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    checked_item_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
