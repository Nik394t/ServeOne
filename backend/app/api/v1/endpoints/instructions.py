from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.instruction import InstructionCollectionRead, InstructionProgressUpdate, InstructionUpdate
from app.services.instruction import build_instruction_payload, update_instruction, update_instruction_progress

router = APIRouter(prefix='/instructions', tags=['instructions'])


@router.get('', response_model=InstructionCollectionRead)
def get_instructions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstructionCollectionRead:
    return build_instruction_payload(db, current_user)


@router.patch('/{instruction_id}', response_model=InstructionCollectionRead)
def patch_instruction(
    instruction_id: int,
    payload: InstructionUpdate,
    current_user: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> InstructionCollectionRead:
    update_instruction(db, instruction_id, payload)
    return build_instruction_payload(db, current_user)


@router.put('/{instruction_id}/progress', response_model=InstructionCollectionRead)
def put_instruction_progress(
    instruction_id: int,
    payload: InstructionProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstructionCollectionRead:
    update_instruction_progress(db, instruction_id, current_user, payload.checked_item_ids)
    return build_instruction_payload(db, current_user)
