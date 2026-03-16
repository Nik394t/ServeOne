from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PushSubscriptionKeysCreate(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeysCreate
    user_agent: str | None = None


class PushSubscriptionRemove(BaseModel):
    endpoint: str


class PushSubscriptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    endpoint: str
    user_agent: str | None
    created_at: datetime
    updated_at: datetime


class PushStateRead(BaseModel):
    enabled: bool
    public_key: str | None
    vapid_subject: str | None
    subscription_count: int
    subscriptions: list[PushSubscriptionRead]


class PushTestPayload(BaseModel):
    title: str = "ServeOne"
    body: str = "Проверка push-уведомления"
    url: str = "/dashboard/messages"


class PushTestResultRead(BaseModel):
    sent: int
    removed: int
    failed: int
    subscriptions: list[PushSubscriptionRead]
