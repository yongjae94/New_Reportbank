from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth_context import CurrentUser, get_current_user
from api.schemas import (
    PsrMaskRuleUpsertPayload,
    PsrInfosecReturnPayload,
    PsrInfosecReturnResponse,
    PsrAccessModeUpdatePayload,
    PsrFlowDto,
    PsrRealtimeResponse,
    PsrViewableUntilUpdatePayload,
)
from core.database import get_repo_session
from services.workflow import WorkflowService

router = APIRouter(prefix="/v1/psr", tags=["psr-flow"])


def _to_dto(job) -> PsrFlowDto:
    summary = dict(job.pii_summary or {})
    dba_reviewer = _extract_note_value(job.performance_notes, "executed_by")
    infosec_reviewer = _extract_note_value(job.performance_notes, "infosec_approved_by")
    return PsrFlowDto(
        job_id=job.id,
        psr_number=job.psr_number,
        request_title=job.request_title,
        requester_emp_no=job.requester_emp_no,
        requester_name=job.requester_name,
        requester_dept=job.requester_dept,
        developer_emp_no=job.developer_emp_no,
        developer_name=job.developer_name,
        developer_dept=job.developer_dept,
        status=job.status.value,
        sql_text=job.sql_text,
        final_sql_text=job.final_sql_text,
        target_db_kind=job.target_db_kind,
        executed_db_conn_id=job.executed_db_conn_id,
        snapshot_rows=summary.get("snapshot_rows", []),
        snapshot_columns=summary.get("snapshot_columns", []),
        requested_at=job.created_at.isoformat() if job.created_at else None,
        viewable_until=job.viewable_until.isoformat() if job.viewable_until else None,
        access_mode=summary.get("access_mode", "잠금"),
        dba_reviewer=dba_reviewer,
        infosec_reviewer=infosec_reviewer,
        mask_rules=summary.get("mask_rules", []),
    )


@router.get("/infosec-pending", response_model=list[PsrFlowDto])
async def list_infosec_pending(
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> list[PsrFlowDto]:
    wf = WorkflowService()
    rows = await wf.list_awaiting_infosec(session)
    return [_to_dto(r) for r in rows]


@router.post("/{job_id}/infosec-approve", response_model=PsrFlowDto)
async def approve_infosec(
    job_id: str,
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> PsrFlowDto:
    wf = WorkflowService()
    row = await wf.approve_infosec(session, job_id, user.user_id)
    if row is None:
        raise HTTPException(status_code=400, detail="infosec_approve_not_allowed")
    return _to_dto(row)


@router.post("/{job_id}/infosec-return", response_model=PsrInfosecReturnResponse)
async def return_infosec(
    job_id: str,
    body: PsrInfosecReturnPayload,
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> PsrInfosecReturnResponse:
    wf = WorkflowService()
    result, row = await wf.return_infosec(
        session,
        job_id,
        user.user_id,
        return_target=body.return_target,
        reason=body.reason,
    )
    if result in {"not_allowed", "invalid_target", "not_found"}:
        raise HTTPException(status_code=400, detail=f"infosec_return_{result}")
    return PsrInfosecReturnResponse(
        result=result,
        job_id=job_id,
        next_status=row.status.value if row else None,
    )


@router.get("/outputs", response_model=list[PsrFlowDto])
async def list_outputs(
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> list[PsrFlowDto]:
    wf = WorkflowService()
    rows = await wf.list_outputs(session)
    return [_to_dto(r) for r in rows]


@router.get("/managed", response_model=list[PsrFlowDto])
async def list_managed(
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> list[PsrFlowDto]:
    wf = WorkflowService()
    rows = await wf.list_completed(session)
    return [_to_dto(r) for r in rows]


@router.post("/{job_id}/access-mode", response_model=PsrFlowDto)
async def update_access_mode(
    job_id: str,
    body: PsrAccessModeUpdatePayload,
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> PsrFlowDto:
    wf = WorkflowService()
    row = await wf.set_access_mode(session, job_id, body.access_mode)
    if row is None:
        raise HTTPException(status_code=400, detail="access_mode_update_not_allowed")
    return _to_dto(row)


@router.post("/{job_id}/viewable-until", response_model=PsrFlowDto)
async def update_viewable_until(
    job_id: str,
    body: PsrViewableUntilUpdatePayload,
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> PsrFlowDto:
    wf = WorkflowService()
    row = await wf.set_viewable_until(session, job_id, _parse_iso_dt(body.viewable_until))
    if row is None:
        raise HTTPException(status_code=400, detail="viewable_until_update_not_allowed")
    return _to_dto(row)


@router.post("/{job_id}/mask-rules", response_model=PsrFlowDto)
async def update_mask_rules(
    job_id: str,
    body: PsrMaskRuleUpsertPayload,
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> PsrFlowDto:
    wf = WorkflowService()
    row = await wf.set_psr_mask_rules(
        session,
        job_id=job_id,
        items=[{"column_name": item.column_name, "policy_id": item.policy_id} for item in body.items],
    )
    if row is None:
        raise HTTPException(status_code=400, detail="mask_rules_update_not_allowed")
    return _to_dto(row)


@router.post("/{job_id}/realtime", response_model=PsrRealtimeResponse)
async def run_realtime(
    job_id: str,
    limit: int = Query(default=1000, ge=1, le=5000),
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> PsrRealtimeResponse:
    wf = WorkflowService()
    try:
        total, rows = await wf.run_realtime_query(session, job_id, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PsrRealtimeResponse(row_count=total, rows=rows)


def _parse_iso_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _extract_note_value(notes: str | None, key: str) -> str | None:
    if not notes:
        return None
    token = f"{key}="
    for chunk in notes.split(";"):
        part = chunk.strip()
        if part.startswith(token):
            value = part[len(token) :].strip()
            return value or None
    return None
