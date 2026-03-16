from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_expire_minutes)
    payload = {
        "sub": subject,
        "role": role,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str, role: str, remember_me: bool = False, jti: Optional[str] = None) -> tuple[str, datetime, str]:
    expires_days = settings.jwt_refresh_expire_days if remember_me else 7
    expire = datetime.now(timezone.utc) + timedelta(days=expires_days)
    token_id = jti or str(uuid4())
    payload = {
        "sub": subject,
        "role": role,
        "type": "refresh",
        "jti": token_id,
        "exp": expire,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expire, token_id


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def safe_decode_token(token: str) -> Optional[dict[str, Any]]:
    try:
        return decode_token(token)
    except JWTError:
        return None
