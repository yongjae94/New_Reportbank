from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.workflow.domain.entities import WorkflowJob
from src.modules.workflow.domain.enums import WorkflowStatus
from src.modules.workflow.infrastructure.orm import WorkflowJobRow


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_entity(row: WorkflowJobRow) -> WorkflowJob:
    return WorkflowJob(
        id=row.id,
        psr_number=row.psr_number,
        status=WorkflowStatus(row.status),
        sql_text=row.sql_text,
        target_db_kind=row.target_db_kind,
        pii_summary=dict(row.pii_summary or {}),
        performance_notes=row.performance_notes,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class WorkflowRepository:
    async def create(
        self,
        session: AsyncSession,
        *,
        job_id: str,
        psr_number: str,
        sql_text: str,
        target_db_kind: str,
        status: WorkflowStatus = WorkflowStatus.REGISTERED,
    ) -> WorkflowJob:
        row = WorkflowJobRow(
            id=job_id,
            psr_number=psr_number,
            status=status.value,
            sql_text=sql_text,
            target_db_kind=target_db_kind,
            pii_summary={},
            performance_notes=None,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return _to_entity(row)

    async def get(self, session: AsyncSession, job_id: str) -> WorkflowJob | None:
        res = await session.execute(select(WorkflowJobRow).where(WorkflowJobRow.id == job_id))
        row = res.scalar_one_or_none()
        return _to_entity(row) if row else None

    async def list_by_status(
        self, session: AsyncSession, status: WorkflowStatus
    ) -> list[WorkflowJob]:
        res = await session.execute(select(WorkflowJobRow).where(WorkflowJobRow.status == status.value))
        return [_to_entity(r) for r in res.scalars().all()]

    async def update_status(
        self,
        session: AsyncSession,
        job_id: str,
        status: WorkflowStatus,
        *,
        pii_summary: dict | None = None,
        performance_notes: str | None = None,
    ) -> WorkflowJob | None:
        res = await session.execute(select(WorkflowJobRow).where(WorkflowJobRow.id == job_id))
        row = res.scalar_one_or_none()
        if row is None:
            return None
        row.status = status.value
        row.updated_at = _utcnow()
        if pii_summary is not None:
            row.pii_summary = pii_summary
        if performance_notes is not None:
            row.performance_notes = performance_notes
        await session.commit()
        await session.refresh(row)
        return _to_entity(row)
