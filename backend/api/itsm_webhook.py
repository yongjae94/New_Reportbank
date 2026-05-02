from __future__ import annotations

import logging

from datetime import datetime

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
        request_title=body.request_title,
        requester_emp_no=body.requester_emp_no,
        requester_name=body.requester_name,
        requester_dept=body.requester_dept,
        developer_emp_no=body.developer_emp_no,
        developer_name=body.developer_name,
        developer_dept=body.developer_dept,
        viewable_until=_parse_iso_dt(body.viewable_until),
        sql_text=body.sql_text,
        target_db_kind=body.target_db_kind,
    )
    background_tasks.add_task(_run_pii_background, job.id)
    return JobCreatedResponse(job_id=job.id)


def _parse_iso_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
