from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import DbaApprovePayload, DbaRejectPayload, WorkflowJobDto
from core.database import AsyncSessionFactory, get_repo_session
from services.workflow import WorkflowService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflow", tags=["workflow"])


def _to_dto(job) -> WorkflowJobDto:
    return WorkflowJobDto(
        id=job.id,
        psr_number=job.psr_number,
        status=job.status.value,
        sql_text=job.sql_text,
        target_db_kind=job.target_db_kind,
        pii_summary=job.pii_summary,
        performance_notes=job.performance_notes,
    )


@router.get("/jobs/pending-dba", response_model=list[WorkflowJobDto])
async def list_pending_dba(session: AsyncSession = Depends(get_repo_session)) -> list[WorkflowJobDto]:
    wf = WorkflowService()
    jobs = await wf.list_awaiting_dba(session)
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
