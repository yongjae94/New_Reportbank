from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import JobCreatedResponse, TestInputSubmitPayload
from core.database import get_repo_session
from services.workflow import WorkflowService

router = APIRouter(prefix="/v1/test-input", tags=["test-input"])


@router.post("/submit", response_model=JobCreatedResponse)
async def submit_test_input(
    body: TestInputSubmitPayload,
    session: AsyncSession = Depends(get_repo_session),
) -> JobCreatedResponse:
    wf = WorkflowService()
    try:
        job = await wf.create_test_input(
            session,
            psr_number=body.psr_number,
            db_conn_id=body.db_conn_id,
            sql_text=body.sql_text,
            viewable_until=_parse_iso_dt(body.viewable_until),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return JobCreatedResponse(job_id=job.id)


def _parse_iso_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
