from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.database import SessionLocal
from app.services.bootstrap import init_db, seed_creator, seed_system_data

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        seed_system_data(db)
        seed_creator(
            db,
            login=settings.first_creator_login,
            password=settings.first_creator_password,
            full_name=settings.first_creator_full_name,
        )
    finally:
        db.close()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)
