from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import SessionLocal

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/deep")
def deep_healthcheck() -> dict[str, str]:
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
    finally:
        db.close()
    return {"status": "ok", "database": "ok"}
