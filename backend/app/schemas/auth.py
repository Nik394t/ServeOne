from pydantic import BaseModel

from app.schemas.user import UserRead


class LoginRequest(BaseModel):
    login: str
    password: str
    remember_me: bool = False


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class AuthResponse(BaseModel):
    user: UserRead
