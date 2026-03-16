from fastapi import APIRouter

from app.api.v1.endpoints import auth, birthdays, broadcasts, duty, health, instructions, messages, push, reports, schedule, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(schedule.router)
api_router.include_router(duty.router)
api_router.include_router(instructions.router)
api_router.include_router(birthdays.router)
api_router.include_router(broadcasts.router)
api_router.include_router(messages.router)
api_router.include_router(push.router)
api_router.include_router(reports.router)
