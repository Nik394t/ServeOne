from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.push import (
    PushStateRead,
    PushSubscriptionCreate,
    PushSubscriptionRemove,
    PushTestPayload,
    PushTestResultRead,
)
from app.services.push import build_push_state, remove_push_subscription, send_test_push, upsert_push_subscription

router = APIRouter(prefix='/push', tags=['push'])


@router.get('/state', response_model=PushStateRead)
def get_push_state(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> PushStateRead:
    return build_push_state(db, current_user, settings)


@router.post('/subscriptions', response_model=PushStateRead)
def post_push_subscription(
    payload: PushSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> PushStateRead:
    return upsert_push_subscription(db, current_user, payload, settings)


@router.post('/subscriptions/remove', response_model=PushStateRead)
def post_remove_subscription(
    payload: PushSubscriptionRemove,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> PushStateRead:
    return remove_push_subscription(db, current_user, payload.endpoint, settings)


@router.post('/test', response_model=PushTestResultRead)
def post_test_push(
    payload: PushTestPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> PushTestResultRead:
    return send_test_push(db, current_user, payload, settings)
