from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DutyMember(Base):
    __tablename__ = 'duty_members'
    __table_args__ = (UniqueConstraint('user_id', name='uq_duty_member_user'),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class DutyState(Base):
    __tablename__ = 'duty_state'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    current_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_auto_advance: Mapped[date | None] = mapped_column(Date, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class DutyHistory(Base):
    __tablename__ = 'duty_history'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    previous_user_id: Mapped[int | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    current_user_id: Mapped[int | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    reason: Mapped[str] = mapped_column(String(32), nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    advanced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
