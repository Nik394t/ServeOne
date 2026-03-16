from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.schedule import AssignmentUpdate, CompleteWeekResponse, HoldUpsert, PartnerUpdate, ScheduleWeekRead
from app.services.schedule import (
    build_schedule_week_payload,
    complete_week,
    delete_hold,
    update_assignment_partner,
    update_assignment_user,
    upsert_hold,
)

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("/upcoming", response_model=ScheduleWeekRead)
def get_upcoming_schedule(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScheduleWeekRead:
    return build_schedule_week_payload(db)


@router.patch("/assignments/{assignment_id}", response_model=ScheduleWeekRead)
def set_assignment_user(
    assignment_id: int,
    payload: AssignmentUpdate,
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> ScheduleWeekRead:
    update_assignment_user(db, assignment_id, payload.user_id)
    return build_schedule_week_payload(db)


@router.patch("/assignments/{assignment_id}/partner", response_model=ScheduleWeekRead)
def set_assignment_partner(
    assignment_id: int,
    payload: PartnerUpdate,
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> ScheduleWeekRead:
    update_assignment_partner(db, assignment_id, payload.partner_user_id)
    return build_schedule_week_payload(db)


@router.post("/holds", response_model=ScheduleWeekRead)
def set_hold(
    payload: HoldUpsert,
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> ScheduleWeekRead:
    upsert_hold(db, payload.position_id, payload.user_id, payload.remaining)
    return build_schedule_week_payload(db)


@router.delete("/holds/{hold_id}", response_model=ScheduleWeekRead)
def remove_hold(
    hold_id: int,
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> ScheduleWeekRead:
    delete_hold(db, hold_id)
    return build_schedule_week_payload(db)


@router.post("/weeks/{week_id}/complete", response_model=CompleteWeekResponse)
def finish_week(
    week_id: str,
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> CompleteWeekResponse:
    complete_week(db, week_id)
    return CompleteWeekResponse(status="completed", week_id=week_id)
