from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.target_db_manager import TargetDbConfig, TargetDbKind, target_db_manager
from src.modules.db_connection.infrastructure.repository import DbConnectionRepository
from src.modules.sql_governance.application.sql_validator_service import SqlValidatorService
from src.modules.workflow.domain.entities import WorkflowJob
from src.modules.workflow.domain.enums import WorkflowStatus
from src.modules.workflow.infrastructure.itsm_client import ItsmCallbackClient
from src.modules.workflow.infrastructure.repository import WorkflowRepository

logger = logging.getLogger(__name__)


class WorkflowService:
    def __init__(
        self,
        repository: WorkflowRepository | None = None,
        sql_validator: SqlValidatorService | None = None,
        itsm: ItsmCallbackClient | None = None,
    ) -> None:
        self._repo = repository or WorkflowRepository()
        self._sql = sql_validator or SqlValidatorService()
        self._itsm = itsm or ItsmCallbackClient()
        self._db_conn_repo = DbConnectionRepository()

    async def create_from_itsm(
        self,
        session: AsyncSession,
        *,
        psr_number: str,
        sql_text: str,
        target_db_kind: str,
    ) -> WorkflowJob:
        job_id = str(uuid.uuid4())
        return await self._repo.create(
            session,
            job_id=job_id,
            psr_number=psr_number,
            sql_text=sql_text,
            target_db_kind=target_db_kind,
            status=WorkflowStatus.REGISTERED,
        )

    async def run_pii_gate(self, session: AsyncSession, job_id: str) -> WorkflowJob | None:
        job = await self._repo.get(session, job_id)
        if job is None:
            return None
        dialect = _dialect_for_target(job.target_db_kind)
        result = await self._sql.validate_sql(session, job.sql_text, dialect)
        summary = self._sql.to_summary_dict(result)
        if result.parse_errors:
            return await self._repo.update_status(
                session,
                job_id,
                WorkflowStatus.FAILED,
                pii_summary=summary,
                performance_notes=";".join(result.parse_errors),
            )
        next_status = WorkflowStatus.AWAITING_DBA
        return await self._repo.update_status(
            session,
            job_id,
            next_status,
            pii_summary=summary,
        )

    async def approve(self, session: AsyncSession, job_id: str, dba_user: str) -> WorkflowJob | None:
        job = await self._repo.get(session, job_id)
        if job is None or job.status != WorkflowStatus.AWAITING_DBA:
            return None
        notes = (job.performance_notes or "") + f";approved_by={dba_user}"
        return await self._repo.update_status(
            session,
            job_id,
            WorkflowStatus.APPROVED,
            performance_notes=notes,
        )

    async def reject(
        self, session: AsyncSession, job_id: str, dba_user: str, reason: str
    ) -> WorkflowJob | None:
        job = await self._repo.get(session, job_id)
        if job is None or job.status != WorkflowStatus.AWAITING_DBA:
            return None
        notes = f"rejected_by={dba_user};reason={reason}"
        return await self._repo.update_status(
            session,
            job_id,
            WorkflowStatus.REJECTED,
            performance_notes=notes,
        )

    async def list_awaiting_dba(self, session: AsyncSession) -> list[WorkflowJob]:
        return await self._repo.list_by_status(session, WorkflowStatus.AWAITING_DBA)

    async def get_job(self, session: AsyncSession, job_id: str) -> WorkflowJob | None:
        return await self._repo.get(session, job_id)

    async def execute_for_dba(
        self,
        session: AsyncSession,
        *,
        job_id: str,
        db_conn_id: str,
        edited_sql: str,
        dba_user: str,
    ) -> WorkflowJob | None:
        job = await self._repo.get(session, job_id)
        if job is None or job.status != WorkflowStatus.AWAITING_DBA:
            return None

        conn_info = await self._db_conn_repo.get_connection_secret(session, db_conn_id)
        if not conn_info:
            raise ValueError("db_connection_not_found")

        kind = _to_target_kind(str(conn_info["DB_KIND"]))
        cfg = TargetDbConfig(
            kind=kind,
            host=str(conn_info["HOST"]),
            port=int(conn_info["PORT"]),
            database=str(conn_info["DB_NAME"]),
            service_name=str(conn_info.get("SERVICE_NAME") or conn_info["DB_NAME"]),
            username=str(conn_info["USERNAME"]),
            password=str(conn_info["PASSWORD_ENC"]),
        )

        # Actual target execution (DBA editable SQL)
        async for target_session in target_db_manager.session(cfg):
            stmt = text(edited_sql)
            result = await target_session.execute(stmt)
            if edited_sql.strip().lower().startswith("select"):
                result.fetchmany(10)
            await target_session.commit()

        notes = (job.performance_notes or "") + f";executed_by={dba_user}"
        return await self._repo.update_execution(
            session,
            job_id=job_id,
            final_sql_text=edited_sql,
            executed_db_conn_id=db_conn_id,
            target_db_kind=kind.value,
            status=WorkflowStatus.AWAITING_INFOSEC,
        ) or await self._repo.update_status(
            session,
            job_id,
            WorkflowStatus.AWAITING_INFOSEC,
            performance_notes=notes,
        )

    async def mark_completed_and_callback(self, session: AsyncSession, job_id: str) -> None:
        job = await self._repo.get(session, job_id)
        if job is None:
            return
        await self._repo.update_status(session, job_id, WorkflowStatus.COMPLETED)
        payload: dict[str, Any] = {
            "psr_number": job.psr_number,
            "job_id": job_id,
            "status": WorkflowStatus.COMPLETED.value,
        }
        try:
            await self._itsm.notify_completion(payload)
        except Exception:
            logger.exception("ITSM callback failed for job_id=%s", job_id)


def _dialect_for_target(kind: str) -> str | None:
    k = kind.lower()
    if k == "oracle":
        return "oracle"
    if k in {"mssql", "sqlserver"}:
        return "tsql"
    if k in {"postgres", "postgresql"}:
        return "postgres"
    return None


def _to_target_kind(kind: str) -> TargetDbKind:
    k = kind.lower()
    if k in {"oracle"}:
        return TargetDbKind.ORACLE
    if k in {"mssql", "sqlserver"}:
        return TargetDbKind.MSSQL
    if k in {"postgres", "postgresql"}:
        return TargetDbKind.POSTGRES
    raise ValueError(f"unsupported_db_kind:{kind}")
