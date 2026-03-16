from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.user import UserRole


class UserBase(BaseModel):
    login: str
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.USER


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
