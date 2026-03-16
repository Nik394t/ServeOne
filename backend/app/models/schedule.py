from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ServiceWeek(Base):
    __tablename__ = "service_weeks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    week_id: Mapped[str] = mapped_column(String(16), unique=True, nullable=False, index=True)
    service_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class WeeklyAssignment(Base):
    __tablename__ = "weekly_assignments"
    __table_args__ = (UniqueConstraint("week_id", "position_id", name="uq_week_position"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    week_id: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    service_date: Mapped[date] = mapped_column(Date, nullable=False)
    position_id: Mapped[int] = mapped_column(ForeignKey("positions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    partner_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class PositionHold(Base):
    __tablename__ = "position_holds"
    __table_args__ = (UniqueConstraint("position_id", name="uq_position_hold_position"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    position_id: Mapped[int] = mapped_column(ForeignKey("positions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    remaining: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
