from __future__ import annotations

import json
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.workflow.domain.entities import WorkflowJob
from src.modules.workflow.domain.enums import WorkflowStatus
from src.modules.workflow.infrastructure.orm import WorkflowJobRow


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_entity(row: WorkflowJobRow) -> WorkflowJob:
    pii_summary = _to_dict(row.pii_summary)
    return WorkflowJob(
        id=row.id,
        psr_number=row.psr_number,
        request_title=row.request_title,
        requester_emp_no=row.requester_emp_no,
        requester_name=row.requester_name,
        requester_dept=row.requester_dept,
        developer_emp_no=row.developer_emp_no,
        developer_name=row.developer_name,
        developer_dept=row.developer_dept,
        status=WorkflowStatus(row.status),
        sql_text=row.sql_text,
        target_db_kind=row.target_db_kind,
        final_sql_text=row.final_sql_text,
        executed_db_conn_id=row.executed_db_conn_id,
        viewable_until=row.viewable_until,
        pii_summary=pii_summary,
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
        request_title: str | None = None,
        requester_emp_no: str | None = None,
        requester_name: str | None = None,
        requester_dept: str | None = None,
        developer_emp_no: str | None = None,
        developer_name: str | None = None,
        developer_dept: str | None = None,
        sql_text: str,
        target_db_kind: str,
        status: WorkflowStatus = WorkflowStatus.REGISTERED,
        executed_db_conn_id: str | None = None,
        performance_notes: str | None = None,
        viewable_until: datetime | None = None,
    ) -> WorkflowJob:
        row = WorkflowJobRow(
            id=job_id,
            psr_number=psr_number,
            request_title=request_title,
            requester_emp_no=requester_emp_no,
            requester_name=requester_name,
            requester_dept=requester_dept,
            developer_emp_no=developer_emp_no,
            developer_name=developer_name,
            developer_dept=developer_dept,
            status=status.value,
            sql_text=sql_text,
            target_db_kind=target_db_kind,
            final_sql_text=None,
            executed_db_conn_id=executed_db_conn_id,
            viewable_until=viewable_until,
            pii_summary="{}",
            performance_notes=performance_notes,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return _to_entity(row)

    async def update_execution(
        self,
        session: AsyncSession,
        *,
        job_id: str,
        final_sql_text: str,
        executed_db_conn_id: str | None,
        target_db_kind: str,
        status: WorkflowStatus,
        pii_summary: dict | None = None,
        performance_notes: str | None = None,
        viewable_until: datetime | None = None,
    ) -> WorkflowJob | None:
        res = await session.execute(select(WorkflowJobRow).where(WorkflowJobRow.id == job_id))
        row = res.scalar_one_or_none()
        if row is None:
            return None
        row.final_sql_text = final_sql_text
        row.executed_db_conn_id = executed_db_conn_id
        row.target_db_kind = target_db_kind
        row.status = status.value
        if viewable_until is not None:
            row.viewable_until = viewable_until
        if pii_summary is not None:
            row.pii_summary = json.dumps(pii_summary, ensure_ascii=False, default=_json_default)
        if performance_notes is not None:
            row.performance_notes = performance_notes
        row.updated_at = _utcnow()
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

    async def list_by_statuses(
        self, session: AsyncSession, statuses: list[WorkflowStatus]
    ) -> list[WorkflowJob]:
        values = [s.value for s in statuses]
        res = await session.execute(
            select(WorkflowJobRow)
            .where(WorkflowJobRow.status.in_(values))
            .order_by(WorkflowJobRow.created_at.desc())
        )
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
            row.pii_summary = json.dumps(pii_summary, ensure_ascii=False, default=_json_default)
        if performance_notes is not None:
            row.performance_notes = performance_notes
        await session.commit()
        await session.refresh(row)
        return _to_entity(row)

    async def delete(self, session: AsyncSession, job_id: str) -> bool:
        res = await session.execute(select(WorkflowJobRow).where(WorkflowJobRow.id == job_id))
        row = res.scalar_one_or_none()
        if row is None:
            return False
        await session.delete(row)
        await session.commit()
        return True


def _to_dict(value: str | dict | None) -> dict:
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _json_default(value: object) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)
