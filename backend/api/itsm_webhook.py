from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import ItsmWebhookPayload, JobCreatedResponse
from core.database import AsyncSessionFactory, get_repo_session
from services.workflow import WorkflowService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/itsm", tags=["itsm"])


async def _run_pii_background(job_id: str) -> None:
    try:
        async with AsyncSessionFactory() as session:
            wf = WorkflowService()
            await wf.run_pii_gate(session, job_id)
    except Exception:
        logger.exception("PII background gate failed job_id=%s", job_id)


@router.post("/webhook", response_model=JobCreatedResponse)
async def receive_itsm_webhook(
    body: ItsmWebhookPayload,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_repo_session),
) -> JobCreatedResponse:
    """
    ITSM → Report Bank: start workflow from PSR / instruction payload.
    PII analysis runs asynchronously; job moves to `awaiting_dba` when successful.
    """
    wf = WorkflowService()
    job = await wf.create_from_itsm(
        session,
        psr_number=body.psr_number,
        sql_text=body.sql_text,
        target_db_kind=body.target_db_kind,
    )
    background_tasks.add_task(_run_pii_background, job.id)
    return JobCreatedResponse(job_id=job.id)
