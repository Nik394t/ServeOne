from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.message import DirectMessageCreate, MessageCollectionRead
from app.services.message import build_message_payload, mark_broadcast_read, mark_direct_read, send_direct_message

router = APIRouter(prefix='/messages', tags=['messages'])


@router.get('', response_model=MessageCollectionRead)
def get_messages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageCollectionRead:
    return build_message_payload(db, current_user)


@router.post('/send', response_model=MessageCollectionRead)
def post_message(
    payload: DirectMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageCollectionRead:
    send_direct_message(db, current_user, payload.recipient_user_id, payload.title, payload.body)
    return build_message_payload(db, current_user)


@router.patch('/broadcast/{message_id}/read', response_model=MessageCollectionRead)
def patch_broadcast_read(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageCollectionRead:
    mark_broadcast_read(db, current_user, message_id)
    return build_message_payload(db, current_user)


@router.patch('/direct/{message_id}/read', response_model=MessageCollectionRead)
def patch_direct_read(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageCollectionRead:
    mark_direct_read(db, current_user, message_id)
    return build_message_payload(db, current_user)
