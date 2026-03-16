from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BroadcastCampaign(Base):
    __tablename__ = 'broadcast_campaigns'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(String(5000), nullable=False)
    target_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    meta: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class BroadcastRecipient(Base):
    __tablename__ = 'broadcast_recipients'
    __table_args__ = (UniqueConstraint('campaign_id', 'user_id', name='uq_broadcast_recipient'),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey('broadcast_campaigns.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class InboxMessage(Base):
    __tablename__ = 'inbox_messages'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    sender_user_id: Mapped[int | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(String(5000), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
