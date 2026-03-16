import json
import logging
from dataclasses import dataclass
from urllib.parse import urljoin

from fastapi import HTTPException, status
from pywebpush import WebPushException, webpush
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.push import PushSubscription
from app.models.user import User
from app.schemas.push import (
    PushStateRead,
    PushSubscriptionCreate,
    PushSubscriptionRead,
    PushTestPayload,
    PushTestResultRead,
)

logger = logging.getLogger(__name__)


@dataclass
class PushDeliveryStats:
    sent: int = 0
    removed: int = 0
    failed: int = 0


def _resolve_frontend_url(url: str, settings: Settings) -> str:
    value = (url or '').strip() or '/dashboard'
    if value.startswith('http://') or value.startswith('https://'):
        return value
    if not settings.frontend_app_url:
        return value
    base = settings.frontend_app_url.rstrip('/') + '/'
    return urljoin(base, value.lstrip('/'))


def build_push_state(db: Session, current_user: User, settings: Settings) -> PushStateRead:
    subscriptions = _get_user_subscriptions(db, current_user.id)
    return PushStateRead(
        enabled=settings.push_enabled,
        public_key=settings.vapid_public_key if settings.push_enabled else None,
        vapid_subject=settings.vapid_subject if settings.push_enabled else None,
        subscription_count=len(subscriptions),
        subscriptions=[PushSubscriptionRead.model_validate(subscription, from_attributes=True) for subscription in subscriptions],
    )


def upsert_push_subscription(db: Session, current_user: User, payload: PushSubscriptionCreate, settings: Settings) -> PushStateRead:
    _require_push_enabled(settings)
    endpoint = payload.endpoint.strip()
    if not endpoint or not payload.keys.p256dh or not payload.keys.auth:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Подписка браузера заполнена не полностью')

    subscription = db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).first()
    if not subscription:
        subscription = PushSubscription(
            user_id=current_user.id,
            endpoint=endpoint,
            p256dh_key=payload.keys.p256dh.strip(),
            auth_key=payload.keys.auth.strip(),
            user_agent=(payload.user_agent or '').strip() or None,
        )
    else:
        subscription.user_id = current_user.id
        subscription.p256dh_key = payload.keys.p256dh.strip()
        subscription.auth_key = payload.keys.auth.strip()
        subscription.user_agent = (payload.user_agent or '').strip() or None

    db.add(subscription)
    db.commit()
    return build_push_state(db, current_user, settings)


def remove_push_subscription(db: Session, current_user: User, endpoint: str, settings: Settings) -> PushStateRead:
    _require_push_enabled(settings)
    subscription = (
        db.query(PushSubscription)
        .filter(PushSubscription.user_id == current_user.id, PushSubscription.endpoint == endpoint.strip())
        .first()
    )
    if subscription:
        db.delete(subscription)
        db.commit()
    return build_push_state(db, current_user, settings)


def send_test_push(db: Session, current_user: User, payload: PushTestPayload, settings: Settings) -> PushTestResultRead:
    _require_push_enabled(settings)
    stats = send_push_to_users(
        db,
        user_ids=[current_user.id],
        title=payload.title.strip() or 'ServeOne',
        body=payload.body.strip() or 'Проверка push-уведомления',
        url=payload.url.strip() or '/dashboard/messages',
        settings=settings,
    )
    subscriptions = _get_user_subscriptions(db, current_user.id)
    return PushTestResultRead(
        sent=stats.sent,
        removed=stats.removed,
        failed=stats.failed,
        subscriptions=[PushSubscriptionRead.model_validate(subscription, from_attributes=True) for subscription in subscriptions],
    )


def send_push_to_users(
    db: Session,
    *,
    user_ids: list[int],
    title: str,
    body: str,
    url: str,
    settings: Settings,
) -> PushDeliveryStats:
    stats = PushDeliveryStats()
    if not settings.push_enabled or not user_ids:
        return stats

    subscriptions = (
        db.query(PushSubscription)
        .filter(PushSubscription.user_id.in_(sorted(set(user_ids))))
        .order_by(PushSubscription.id.asc())
        .all()
    )
    if not subscriptions:
        return stats

    payload = json.dumps(
        {
            'title': title.strip() or 'ServeOne',
            'body': body.strip() or 'Новое уведомление',
            'url': _resolve_frontend_url(url, settings),
        }
    )

    stale_ids: list[int] = []
    for subscription in subscriptions:
        try:
            webpush(
                subscription_info={
                    'endpoint': subscription.endpoint,
                    'keys': {
                        'p256dh': subscription.p256dh_key,
                        'auth': subscription.auth_key,
                    },
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={'sub': settings.vapid_subject},
            )
            stats.sent += 1
        except WebPushException as exc:
            status_code = getattr(getattr(exc, 'response', None), 'status_code', None)
            if status_code in {404, 410}:
                stale_ids.append(subscription.id)
                stats.removed += 1
                continue
            stats.failed += 1
            logger.warning('Push delivery failed for subscription %s: %s', subscription.id, exc)
        except Exception as exc:  # pragma: no cover - defensive fallback
            stats.failed += 1
            logger.warning('Unexpected push delivery failure for subscription %s: %s', subscription.id, exc)

    if stale_ids:
        db.query(PushSubscription).filter(PushSubscription.id.in_(stale_ids)).delete(synchronize_session=False)
        db.commit()

    return stats


def _get_user_subscriptions(db: Session, user_id: int) -> list[PushSubscription]:
    return (
        db.query(PushSubscription)
        .filter(PushSubscription.user_id == user_id)
        .order_by(PushSubscription.updated_at.desc(), PushSubscription.id.desc())
        .all()
    )


def _require_push_enabled(settings: Settings) -> None:
    if not settings.push_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Push-уведомления не настроены на сервере',
        )
