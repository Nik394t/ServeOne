from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.report import ReportOverviewRead
from app.services.report import build_reports_overview

router = APIRouter(prefix='/reports', tags=['reports'])


@router.get('/overview', response_model=ReportOverviewRead)
def get_reports_overview(
    _: User = Depends(require_roles(UserRole.CREATOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> ReportOverviewRead:
    return build_reports_overview(db)
