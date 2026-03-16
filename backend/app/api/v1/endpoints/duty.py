from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.duty import DutyAdvanceResponse, DutyMemberCreate, DutyMemberMove, DutyOverviewRead
from app.services.duty import add_duty_member, advance_duty_queue, build_duty_payload, move_duty_member, remove_duty_member

router = APIRouter(prefix='/duty', tags=['duty'])


@router.get('', response_model=DutyOverviewRead)
def get_duty_overview(
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> DutyOverviewRead:
    return build_duty_payload(db)


@router.post('/members', response_model=DutyOverviewRead)
def create_duty_member(
    payload: DutyMemberCreate,
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> DutyOverviewRead:
    add_duty_member(db, payload.user_id)
    return build_duty_payload(db)


@router.delete('/members/{member_id}', response_model=DutyOverviewRead)
def delete_duty_member(
    member_id: int,
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> DutyOverviewRead:
    remove_duty_member(db, member_id)
    return build_duty_payload(db)


@router.post('/members/{member_id}/move', response_model=DutyOverviewRead)
def reorder_duty_member(
    member_id: int,
    payload: DutyMemberMove,
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> DutyOverviewRead:
    move_duty_member(db, member_id, payload.direction)
    return build_duty_payload(db)


@router.post('/advance', response_model=DutyAdvanceResponse)
def advance_duty(
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> DutyAdvanceResponse:
    advance_duty_queue(db, reason='manual', note='Ручной сдвиг очереди дежурств')
    overview = build_duty_payload(db)
    return DutyAdvanceResponse(
        status='advanced',
        current_user_id=overview.current_user_id,
        current_user_name=overview.current_user_name,
    )
