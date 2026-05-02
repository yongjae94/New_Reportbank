from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth_context import CurrentUser, get_current_user
from api.schemas import RuntimeQueryExecutePayload, RuntimeQueryExecuteResponse
from core.casbin_setup import enforce_team_approve
from core.database import get_repo_session
from src.modules.security.application.audit_trail_service import AuditTrailService
from src.modules.security.application.masking_service import MaskingService
from src.modules.security.infrastructure.security_repository import SecurityRepository

router = APIRouter(prefix="/v1/runtime", tags=["runtime-security"])


def _casbin_subject(user: CurrentUser) -> str:
    return user.login_id or user.user_id


@router.post("/psr/{psr_id}/execute", response_model=RuntimeQueryExecuteResponse)
async def execute_psr_realtime_query(
    psr_id: str,
    body: RuntimeQueryExecutePayload,
    request: Request,
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> RuntimeQueryExecuteResponse:
    allow_unmask = bool(body.unmask and enforce_team_approve(_casbin_subject(user), user.team_id))
    if body.unmask and not allow_unmask:
        raise HTTPException(status_code=403, detail="unmask_permission_required")

    repo = SecurityRepository()
    metadata_rows = await repo.fetch_pii_metadata(
        session,
        owner=body.target_owner,
        table_name=body.target_table,
    )
    masking = MaskingService()
    masked_rows = masking.apply_masking(body.rows, metadata_rows, unmask=allow_unmask)

    audit = AuditTrailService(repository=repo)
    await audit.log_psr_realtime_query(
        session,
        user_id=user.user_id,
        team_id=user.team_id,
        psr_id=psr_id,
        sql_text=body.sql_text,
        row_count=len(masked_rows),
        used_unmask=allow_unmask,
        client_ip=request.client.host if request.client else None,
    )
    return RuntimeQueryExecuteResponse(rows=masked_rows, row_count=len(masked_rows), unmask_applied=allow_unmask)


@router.post("/reports/{report_id}/execute", response_model=RuntimeQueryExecuteResponse)
async def execute_team_report(
    report_id: str,
    body: RuntimeQueryExecutePayload,
    request: Request,
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> RuntimeQueryExecuteResponse:
    allow_unmask = bool(body.unmask and enforce_team_approve(_casbin_subject(user), user.team_id))
    if body.unmask and not allow_unmask:
        raise HTTPException(status_code=403, detail="unmask_permission_required")

    repo = SecurityRepository()
    metadata_rows = await repo.fetch_pii_metadata(
        session,
        owner=body.target_owner,
        table_name=body.target_table,
    )
    masking = MaskingService()
    masked_rows = masking.apply_masking(body.rows, metadata_rows, unmask=allow_unmask)

    audit = AuditTrailService(repository=repo)
    await audit.log_report_execution(
        session,
        user_id=user.user_id,
        team_id=user.team_id,
        report_id=report_id,
        sql_text=body.sql_text,
        row_count=len(masked_rows),
        used_unmask=allow_unmask,
        client_ip=request.client.host if request.client else None,
    )
    return RuntimeQueryExecuteResponse(rows=masked_rows, row_count=len(masked_rows), unmask_applied=allow_unmask)
