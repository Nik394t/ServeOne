from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_ENV, env_file_encoding="utf-8", extra="ignore")

    app_name: str = "ServeOne API"
    api_v1_prefix: str = "/api/v1"
    database_url: str = Field(alias="DATABASE_URL")
    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = Field(default=30, alias="JWT_ACCESS_EXPIRE_MINUTES")
    jwt_refresh_expire_days: int = Field(default=30, alias="JWT_REFRESH_EXPIRE_DAYS")
    first_creator_login: str = Field(alias="FIRST_CREATOR_LOGIN")
    first_creator_password: str = Field(alias="FIRST_CREATOR_PASSWORD")
    first_creator_full_name: str = Field(default="Creator", alias="FIRST_CREATOR_FULL_NAME")
    backend_cors_origins: str = Field(default="http://localhost:3000", alias="BACKEND_CORS_ORIGINS")
    vapid_public_key: str | None = Field(default=None, alias="VAPID_PUBLIC_KEY")
    vapid_private_key: str | None = Field(default=None, alias="VAPID_PRIVATE_KEY")
    vapid_subject: str = Field(default="mailto:admin@serveone.local", alias="VAPID_SUBJECT")

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]

    @property
    def push_enabled(self) -> bool:
        return bool(self.vapid_public_key and self.vapid_private_key and self.vapid_subject)


@lru_cache
def get_settings() -> Settings:
    return Settings()
