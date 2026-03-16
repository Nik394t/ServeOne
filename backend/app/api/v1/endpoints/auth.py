from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status, Cookie
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole
from app.schemas.auth import AuthResponse, ChangePasswordRequest, LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str, remember_me: bool) -> None:
    max_age_access = settings.jwt_access_expire_minutes * 60
    max_age_refresh = (settings.jwt_refresh_expire_days if remember_me else 7) * 24 * 60 * 60
    response.set_cookie("access_token", access_token, httponly=True, samesite="lax", secure=False, max_age=max_age_access, path="/")
    response.set_cookie("refresh_token", refresh_token, httponly=True, samesite="lax", secure=False, max_age=max_age_refresh, path="/")


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.query(User).filter(User.login == payload.login).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль")
    if not user.is_active or user.role == UserRole.DELETED.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Пользователь деактивирован")

    access_token = create_access_token(str(user.id), user.role)
    refresh_token, expires_at, token_id = create_refresh_token(str(user.id), user.role, remember_me=payload.remember_me)
    db.add(RefreshToken(user_id=user.id, token_id=token_id, expires_at=expires_at, is_revoked=False))
    db.commit()
    _set_auth_cookies(response, access_token, refresh_token, payload.remember_me)
    return AuthResponse(user=user)


@router.post("/refresh", response_model=AuthResponse)
def refresh(response: Response, refresh_token: str | None = Cookie(default=None), db: Session = Depends(get_db)) -> AuthResponse:
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token отсутствует")
    try:
        payload = decode_token(refresh_token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Невалидный refresh token") from exc
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный тип токена")
    token_id = payload.get("jti")
    token_row = db.query(RefreshToken).filter(RefreshToken.token_id == token_id).first()
    if not token_row or token_row.is_revoked or token_row.expires_at <= datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token истёк")
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active or user.role == UserRole.DELETED.value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь недоступен")

    token_row.is_revoked = True
    new_access = create_access_token(str(user.id), user.role)
    new_refresh, expires_at, new_token_id = create_refresh_token(str(user.id), user.role, remember_me=True)
    db.add(token_row)
    db.add(RefreshToken(user_id=user.id, token_id=new_token_id, expires_at=expires_at, is_revoked=False))
    db.commit()
    _set_auth_cookies(response, new_access, new_refresh, True)
    return AuthResponse(user=user)


@router.post("/logout")
def logout(response: Response, refresh_token: str | None = Cookie(default=None), db: Session = Depends(get_db)) -> dict[str, str]:
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            token_id = payload.get("jti")
            if token_id:
                row = db.query(RefreshToken).filter(RefreshToken.token_id == token_id).first()
                if row:
                    row.is_revoked = True
                    db.add(row)
                    db.commit()
        except Exception:
            pass
    _clear_auth_cookies(response)
    return {"status": "ok"}


@router.get("/me", response_model=AuthResponse)
def me(current_user: User = Depends(get_current_user)) -> AuthResponse:
    return AuthResponse(user=current_user)


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Текущий пароль неверен")
    current_user.password_hash = hash_password(payload.new_password)
    db.add(current_user)
    db.commit()
    return {"status": "ok"}
