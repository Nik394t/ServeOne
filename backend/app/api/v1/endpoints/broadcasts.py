from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.broadcast import BroadcastCollectionRead, BroadcastSendPayload, BroadcastSendResponse
from app.services.broadcast import build_broadcast_payload, send_broadcast

router = APIRouter(prefix='/broadcasts', tags=['broadcasts'])


@router.get('', response_model=BroadcastCollectionRead)
def get_broadcasts(
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> BroadcastCollectionRead:
    return build_broadcast_payload(db)


@router.post('/send', response_model=BroadcastSendResponse)
def post_broadcast(
    payload: BroadcastSendPayload,
    current_user: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> BroadcastSendResponse:
    campaign_id, recipient_count = send_broadcast(db, current_user, payload)
    return BroadcastSendResponse(status='sent', campaign_id=campaign_id, recipient_count=recipient_count)
