from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.birthday import (
    BirthdayCollectionRead,
    BirthdayPersonUpdate,
    BirthdayTemplateCreate,
    BirthdayTemplateUpdate,
)
from app.services.birthday import (
    build_birthday_payload,
    create_birthday_template,
    delete_birthday_template,
    update_birthday_template,
    upsert_birthday_person,
)

router = APIRouter(prefix='/birthdays', tags=['birthdays'])


@router.get('', response_model=BirthdayCollectionRead)
def get_birthdays(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BirthdayCollectionRead:
    return build_birthday_payload(db)


@router.put('/people/{user_id}', response_model=BirthdayCollectionRead)
def put_birthday_person(
    user_id: int,
    payload: BirthdayPersonUpdate,
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> BirthdayCollectionRead:
    upsert_birthday_person(db, user_id, payload)
    return build_birthday_payload(db)


@router.post('/templates', response_model=BirthdayCollectionRead)
def post_birthday_template(
    payload: BirthdayTemplateCreate,
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> BirthdayCollectionRead:
    create_birthday_template(db, payload)
    return build_birthday_payload(db)


@router.patch('/templates/{template_id}', response_model=BirthdayCollectionRead)
def patch_birthday_template(
    template_id: int,
    payload: BirthdayTemplateUpdate,
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> BirthdayCollectionRead:
    update_birthday_template(db, template_id, payload)
    return build_birthday_payload(db)


@router.delete('/templates/{template_id}', response_model=BirthdayCollectionRead)
def remove_birthday_template(
    template_id: int,
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> BirthdayCollectionRead:
    delete_birthday_template(db, template_id)
    return build_birthday_payload(db)
