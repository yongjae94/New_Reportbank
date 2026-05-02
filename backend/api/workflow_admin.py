from __future__ import annotations

from datetime import datetime
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import DbaApprovePayload, DbaExecutePayload, DbaRejectPayload, DbaReturnPayload, WorkflowJobDto
from api.auth_context import CurrentUser, get_current_user
from core.database import AsyncSessionFactory, get_repo_session
from services.workflow import WorkflowService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflow", tags=["workflow"])


def _to_dto(job) -> WorkflowJobDto:
    dba_reviewer = _extract_note_value(job.performance_notes, "executed_by")
    infosec_reviewer = _extract_note_value(job.performance_notes, "infosec_approved_by")
    return WorkflowJobDto(
        id=job.id,
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
        target_db_kind=job.target_db_kind,
        final_sql_text=job.final_sql_text,
        executed_db_conn_id=job.executed_db_conn_id,
        viewable_until=job.viewable_until.isoformat() if job.viewable_until else None,
        pii_summary=job.pii_summary,
        performance_notes=job.performance_notes,
        dba_reviewer=dba_reviewer,
        infosec_reviewer=infosec_reviewer,
    )


@router.get("/jobs/pending-dba", response_model=list[WorkflowJobDto])
async def list_pending_dba(session: AsyncSession = Depends(get_repo_session)) -> list[WorkflowJobDto]:
    wf = WorkflowService()
    jobs = await wf.list_awaiting_dba(session)
    return [_to_dto(j) for j in jobs]


@router.get("/jobs/dba-history", response_model=list[WorkflowJobDto])
async def list_dba_history(session: AsyncSession = Depends(get_repo_session)) -> list[WorkflowJobDto]:
    wf = WorkflowService()
    jobs = await wf.list_dba_history(session)
    return [_to_dto(j) for j in jobs]


@router.get("/jobs/{job_id}", response_model=WorkflowJobDto)
async def get_job(job_id: str, session: AsyncSession = Depends(get_repo_session)) -> WorkflowJobDto:
    wf = WorkflowService()
    job = await wf.get_job(session, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job_not_found")
    return _to_dto(job)


@router.post("/jobs/{job_id}/approve", response_model=WorkflowJobDto)
async def approve_job(
    job_id: str,
    body: DbaApprovePayload,
    session: AsyncSession = Depends(get_repo_session),
) -> WorkflowJobDto:
    wf = WorkflowService()
    job = await wf.approve(session, job_id, body.dba_user)
    if job is None:
        raise HTTPException(status_code=400, detail="approve_not_allowed")
    return _to_dto(job)


@router.post("/jobs/{job_id}/reject", response_model=WorkflowJobDto)
async def reject_job(
    job_id: str,
    body: DbaRejectPayload,
    session: AsyncSession = Depends(get_repo_session),
) -> WorkflowJobDto:
    wf = WorkflowService()
    job = await wf.reject(session, job_id, body.dba_user, body.reason)
    if job is None:
        raise HTTPException(status_code=400, detail="reject_not_allowed")
    return _to_dto(job)


@router.post("/jobs/{job_id}/execute", response_model=WorkflowJobDto)
async def execute_job(
    job_id: str,
    body: DbaExecutePayload,
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> WorkflowJobDto:
    if user.role.upper() != "DBA":
        raise HTTPException(status_code=403, detail="dba_role_required")
    wf = WorkflowService()
    try:
        job = await wf.execute_for_dba(
            session,
            job_id=job_id,
            db_conn_id=body.db_conn_id,
            edited_sql=body.edited_sql,
            dba_user=body.dba_user,
            viewable_until=_parse_iso_dt(body.viewable_until),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"execution_failed:{exc}") from exc
    if job is None:
        raise HTTPException(status_code=400, detail="execute_not_allowed")
    return _to_dto(job)


@router.post("/jobs/{job_id}/return")
async def return_job_to_author(
    job_id: str,
    body: DbaReturnPayload,
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    if user.role.upper() != "DBA":
        raise HTTPException(status_code=403, detail="dba_role_required")
    wf = WorkflowService()
    ok = await wf.return_to_author_from_dba(session, job_id, body.dba_user, body.reason)
    if not ok:
        raise HTTPException(status_code=400, detail="return_not_allowed")
    return {"result": "deleted", "job_id": job_id}


async def _finalize_background(job_id: str) -> None:
    try:
        async with AsyncSessionFactory() as session:
            wf = WorkflowService()
            await wf.mark_completed_and_callback(session, job_id)
    except Exception:
        logger.exception("Finalize / ITSM callback failed job_id=%s", job_id)


@router.post("/jobs/{job_id}/finalize")
async def finalize_job(job_id: str, background_tasks: BackgroundTasks) -> dict[str, str]:
    """
    Demo hook: after execution in target DB, mark job completed and notify ITSM (async).
    """
    background_tasks.add_task(_finalize_background, job_id)
    return {"status": "accepted", "job_id": job_id}


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
