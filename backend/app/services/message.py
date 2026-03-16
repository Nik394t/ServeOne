from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.broadcast import InboxMessage
from app.models.message import DirectMessage
from app.models.user import User, UserRole
from app.schemas.message import MessageCollectionRead, MessageContactRead, MessageItemRead
from app.schemas.user import UserRead
from app.services.push import send_push_to_users


def build_message_payload(db: Session, current_user: User) -> MessageCollectionRead:
    users = _get_active_users(db)
    user_map = {user.id: user for user in users}

    inbox_rows = (
        db.query(InboxMessage)
        .filter(InboxMessage.user_id == current_user.id)
        .order_by(InboxMessage.created_at.desc(), InboxMessage.id.desc())
        .limit(50)
        .all()
    )
    direct_rows = (
        db.query(DirectMessage)
        .filter((DirectMessage.sender_user_id == current_user.id) | (DirectMessage.recipient_user_id == current_user.id))
        .order_by(DirectMessage.created_at.desc(), DirectMessage.id.desc())
        .limit(50)
        .all()
    )

    items: list[MessageItemRead] = []
    unread_count = 0

    for row in inbox_rows:
        sender = user_map.get(row.sender_user_id) if row.sender_user_id else None
        if row.sender_user_id and sender is None:
            sender = db.get(User, row.sender_user_id)
        is_read = row.is_read
        if not is_read:
            unread_count += 1
        items.append(
            MessageItemRead(
                kind='broadcast',
                record_id=row.id,
                title=row.title,
                body=row.body,
                created_at=row.created_at,
                is_read=is_read,
                direction='system' if row.sender_user_id is None else 'incoming',
                sender_user=UserRead.model_validate(sender, from_attributes=True) if sender else None,
                recipient_user=UserRead.model_validate(current_user, from_attributes=True),
            )
        )

    for row in direct_rows:
        sender = user_map.get(row.sender_user_id) or db.get(User, row.sender_user_id)
        recipient = user_map.get(row.recipient_user_id) or db.get(User, row.recipient_user_id)
        incoming = row.recipient_user_id == current_user.id
        is_read = True if not incoming else row.is_read_by_recipient
        if incoming and not row.is_read_by_recipient:
            unread_count += 1
        items.append(
            MessageItemRead(
                kind='direct',
                record_id=row.id,
                title=row.title,
                body=row.body,
                created_at=row.created_at,
                is_read=is_read,
                direction='incoming' if incoming else 'outgoing',
                sender_user=UserRead.model_validate(sender, from_attributes=True) if sender else None,
                recipient_user=UserRead.model_validate(recipient, from_attributes=True) if recipient else None,
            )
        )

    items.sort(key=lambda item: item.created_at, reverse=True)
    contacts = [_to_contact(user) for user in _allowed_contacts(users, current_user)]

    return MessageCollectionRead(items=items, contacts=contacts, unread_count=unread_count)


def send_direct_message(db: Session, current_user: User, recipient_user_id: int, title: str, body: str) -> None:
    recipient = db.get(User, recipient_user_id)
    if not recipient or not recipient.is_active or recipient.role == UserRole.DELETED.value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Получатель не найден')
    if recipient.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Нельзя отправить сообщение самому себе')

    if current_user.role == UserRole.USER.value and recipient.role not in {UserRole.ADMIN.value, UserRole.CREATOR.value}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Пользователь может писать только администратору')

    title = title.strip()
    body = body.strip()
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Заголовок сообщения обязателен')
    if not body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Текст сообщения обязателен')

    db.add(
        DirectMessage(
            sender_user_id=current_user.id,
            recipient_user_id=recipient.id,
            title=title,
            body=body,
            is_read_by_recipient=False,
        )
    )
    db.commit()
    send_push_to_users(
        db,
        user_ids=[recipient.id],
        title=f'Новое сообщение: {title}',
        body=body,
        url='/dashboard/messages',
        settings=get_settings(),
    )


def mark_broadcast_read(db: Session, current_user: User, message_id: int) -> None:
    message = db.get(InboxMessage, message_id)
    if not message or message.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Сообщение не найдено')
    if not message.is_read:
        message.is_read = True
        db.add(message)
        db.commit()


def mark_direct_read(db: Session, current_user: User, message_id: int) -> None:
    message = db.get(DirectMessage, message_id)
    if not message or message.recipient_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Сообщение не найдено')
    if not message.is_read_by_recipient:
        message.is_read_by_recipient = True
        db.add(message)
        db.commit()


def _get_active_users(db: Session) -> list[User]:
    return (
        db.query(User)
        .filter(User.is_active == True, User.role != UserRole.DELETED.value)
        .order_by(User.full_name.asc(), User.login.asc())
        .all()
    )


def _allowed_contacts(users: list[User], current_user: User) -> list[User]:
    if current_user.role == UserRole.USER.value:
        return [user for user in users if user.id != current_user.id and user.role in {UserRole.ADMIN.value, UserRole.CREATOR.value}]
    return [user for user in users if user.id != current_user.id]


def _to_contact(user: User) -> MessageContactRead:
    return MessageContactRead(id=user.id, display_name=user.full_name or user.login, role=user.role)
