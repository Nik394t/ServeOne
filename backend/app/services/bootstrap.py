from sqlalchemy.orm import Session

from app.core.database import Base, engine
from app.core.security import hash_password
from app.models import (
    BirthdayProfile,
    BirthdayTemplate,
    BroadcastCampaign,
    BroadcastRecipient,
    DirectMessage,
    DutyHistory,
    DutyMember,
    DutyState,
    InboxMessage,
    InstructionGuide,
    InstructionProgress,
    Position,
    PositionHold,
    PushSubscription,
    RefreshToken,
    ServiceWeek,
    WeeklyAssignment,
)
from app.models.user import User, UserRole
from app.services.birthday import ensure_default_birthday_templates
from app.services.instruction import ensure_default_guides
from app.services.schedule import ensure_default_positions


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def seed_creator(db: Session, login: str, password: str, full_name: str) -> User:
    creator = db.query(User).filter(User.role == UserRole.CREATOR.value).first()
    if creator:
        return creator

    by_login = db.query(User).filter(User.login == login).first()
    if by_login:
        by_login.role = UserRole.CREATOR.value
        by_login.is_active = True
        if not by_login.password_hash:
            by_login.password_hash = hash_password(password)
        if not by_login.full_name:
            by_login.full_name = full_name
        db.add(by_login)
        db.commit()
        db.refresh(by_login)
        return by_login

    creator = User(
        login=login,
        full_name=full_name,
        password_hash=hash_password(password),
        role=UserRole.CREATOR.value,
        is_active=True,
    )
    db.add(creator)
    db.commit()
    db.refresh(creator)
    return creator


def seed_system_data(db: Session) -> None:
    ensure_default_positions(db)
    ensure_default_guides(db)
    ensure_default_birthday_templates(db)
