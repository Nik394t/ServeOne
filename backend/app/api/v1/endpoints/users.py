from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.security import hash_password
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserRead, UserRoleUpdate, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def _ensure_manage_allowed(current_user: User, target_user: User) -> None:
    if target_user.role == UserRole.DELETED.value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    if current_user.role == UserRole.ADMIN.value and target_user.role != UserRole.USER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Админ может управлять только обычными пользователями",
        )


@router.get("", response_model=list[UserRead])
def list_users(
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> list[User]:
    return db.query(User).filter(User.role != UserRole.DELETED.value).order_by(User.created_at.desc()).all()


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> User:
    if db.query(User).filter(User.login == payload.login).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Логин уже занят")
    requested_role = payload.role
    if current_user.role == UserRole.ADMIN.value and requested_role != UserRole.USER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Админ может создавать только обычных пользователей")
    if requested_role == UserRole.CREATOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нельзя создать второго creator через этот endpoint")
    user = User(
        login=payload.login,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=requested_role.value,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    _ensure_manage_allowed(current_user, user)
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password:
        user.password_hash = hash_password(payload.password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/role", response_model=UserRead)
def change_role(
    user_id: int,
    payload: UserRoleUpdate,
    current_user: User = Depends(require_roles(UserRole.CREATOR)),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if not user or user.role == UserRole.DELETED.value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    if user.id == current_user.id and payload.role != UserRole.CREATOR:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Creator не может снять роль с самого себя")
    if payload.role == UserRole.CREATOR:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Назначение creator отдельно не поддерживается")
    user.role = payload.role.value
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    _ensure_manage_allowed(current_user, user)
    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя удалить самого себя")
    if user.role == UserRole.CREATOR.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нельзя удалить creator")
    user.is_active = False
    user.role = UserRole.DELETED.value
    db.add(user)
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update({RefreshToken.is_revoked: True})
    db.commit()
    return {"status": "deleted"}


@router.get("/me/profile", response_model=UserRead)
def my_profile(current_user: User = Depends(get_current_user)) -> User:
    return current_user
