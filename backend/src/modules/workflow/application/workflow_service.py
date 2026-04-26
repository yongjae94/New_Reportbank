from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
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

    async def create_test_input(
        self,
        session: AsyncSession,
        *,
        psr_number: str,
        db_conn_id: str,
        sql_text: str,
        viewable_until: datetime | None = None,
    ) -> WorkflowJob:
        conn_info = await self._db_conn_repo.get_connection_secret(session, db_conn_id)
        if not conn_info:
            raise ValueError("db_connection_not_found")
        kind = _to_target_kind(str(_pick(conn_info, "DB_KIND")))
        now = datetime.now(timezone.utc)
        if viewable_until is None:
            viewable_until = now + timedelta(days=7)
        _validate_viewable_window(viewable_until, start_at=now, max_days=7)
        job_id = str(uuid.uuid4())
        return await self._repo.create(
            session,
            job_id=job_id,
            psr_number=psr_number,
            sql_text=sql_text,
            target_db_kind=kind.value,
            status=WorkflowStatus.AWAITING_DBA,
            executed_db_conn_id=db_conn_id,
            performance_notes="source=test_input_manual",
            viewable_until=viewable_until,
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
        notes = (job.performance_notes or "") + f";approved_by={dba_user};handoff=infosec"
        return await self._repo.update_status(
            session,
            job_id,
            WorkflowStatus.AWAITING_INFOSEC,
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

    async def list_awaiting_infosec(self, session: AsyncSession) -> list[WorkflowJob]:
        return await self._repo.list_by_status(session, WorkflowStatus.AWAITING_INFOSEC)

    async def list_outputs(self, session: AsyncSession) -> list[WorkflowJob]:
        return await self._repo.list_by_statuses(
            session,
            [WorkflowStatus.AWAITING_INFOSEC, WorkflowStatus.COMPLETED],
        )

    async def list_completed(self, session: AsyncSession) -> list[WorkflowJob]:
        return await self._repo.list_by_status(session, WorkflowStatus.COMPLETED)

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
        viewable_until: datetime | None = None,
    ) -> WorkflowJob | None:
        job = await self._repo.get(session, job_id)
        base_start = job.created_at or datetime.now(timezone.utc)
        if viewable_until is None:
            viewable_until = job.viewable_until
        if viewable_until is None:
            viewable_until = datetime.now(timezone.utc) + timedelta(days=7)
        _validate_viewable_window(viewable_until, start_at=base_start, max_days=7)
        if job is None or job.status != WorkflowStatus.AWAITING_DBA:
            return None

        conn_info = await self._db_conn_repo.get_connection_secret(session, db_conn_id)
        if not conn_info:
            raise ValueError("db_connection_not_found")

        kind = _to_target_kind(str(_pick(conn_info, "DB_KIND")))
        cfg = TargetDbConfig(
            kind=kind,
            host=str(_pick(conn_info, "HOST")),
            port=int(_pick(conn_info, "PORT")),
            database=str(_pick(conn_info, "DB_NAME")),
            service_name=str(_pick(conn_info, "SERVICE_NAME", default="")) or str(_pick(conn_info, "DB_NAME")),
            username=str(_pick(conn_info, "USERNAME")),
            password=str(_pick(conn_info, "PASSWORD_ENC")),
        )

        # Actual target execution (DBA editable SQL)
        async for target_session in target_db_manager.session(cfg):
            session_user = ""
            db_name = ""
            con_name = ""
            try:
                who = await target_session.execute(
                    text(
                        """
                        SELECT
                          SYS_CONTEXT('USERENV','SESSION_USER') AS SESSION_USER,
                          SYS_CONTEXT('USERENV','DB_NAME') AS DB_NAME,
                          SYS_CONTEXT('USERENV','CON_NAME') AS CON_NAME
                        FROM DUAL
                        """
                    )
                )
                who_row = who.mappings().first() or {}
                session_user = str(who_row.get("SESSION_USER") or who_row.get("session_user") or "")
                db_name = str(who_row.get("DB_NAME") or who_row.get("db_name") or "")
                con_name = str(who_row.get("CON_NAME") or who_row.get("con_name") or "")

                stmt = text(edited_sql)
                result = await target_session.execute(stmt)
                snapshot_rows: list[dict[str, Any]] = []
                snapshot_columns: list[str] = []
                if edited_sql.strip().lower().startswith("select"):
                    snapshot_columns = list(result.keys())
                    data = result.fetchmany(10)
                    snapshot_rows = [
                        {snapshot_columns[idx]: value for idx, value in enumerate(row)}
                        for row in data
                    ]
                await target_session.commit()
            except Exception as exc:
                raise ValueError(
                    "target_execution_failed:"
                    f"{exc};"
                    f"db_conn_id={db_conn_id};"
                    f"target={cfg.host}:{cfg.port};"
                    f"service={cfg.service_name or cfg.database};"
                    f"session_user={session_user};"
                    f"db_name={db_name};"
                    f"con_name={con_name}"
                ) from exc

        summary = dict(job.pii_summary or {})
        summary["snapshot_rows"] = snapshot_rows
        summary["snapshot_columns"] = snapshot_columns
        summary["access_mode"] = "잠금"

        notes = (job.performance_notes or "") + f";executed_by={dba_user}"
        return await self._repo.update_execution(
            session,
            job_id=job_id,
            final_sql_text=edited_sql,
            executed_db_conn_id=db_conn_id,
            target_db_kind=kind.value,
            status=WorkflowStatus.AWAITING_INFOSEC,
            pii_summary=summary,
            performance_notes=notes,
            viewable_until=viewable_until if viewable_until is not None else job.viewable_until,
        )

    async def approve_infosec(self, session: AsyncSession, job_id: str, reviewer: str) -> WorkflowJob | None:
        job = await self._repo.get(session, job_id)
        if job is None or job.status != WorkflowStatus.AWAITING_INFOSEC:
            return None
        summary = dict(job.pii_summary or {})
        summary["access_mode"] = "승인"
        notes = (job.performance_notes or "") + f";infosec_approved_by={reviewer}"
        return await self._repo.update_status(
            session,
            job_id,
            WorkflowStatus.COMPLETED,
            pii_summary=summary,
            performance_notes=notes,
        )

    async def return_infosec(
        self,
        session: AsyncSession,
        job_id: str,
        reviewer: str,
        return_target: str,
        reason: str | None = None,
    ) -> tuple[str, WorkflowJob | None]:
        job = await self._repo.get(session, job_id)
        if job is None or job.status != WorkflowStatus.AWAITING_INFOSEC:
            return "not_allowed", None

        reason_text = (reason or "").strip()
        notes = (job.performance_notes or "") + f";infosec_returned_by={reviewer};target={return_target}"
        if reason_text:
            notes += f";reason={reason_text}"

        if return_target == "dba":
            row = await self._repo.update_status(
                session,
                job_id,
                WorkflowStatus.AWAITING_DBA,
                pii_summary=job.pii_summary,
                performance_notes=notes,
            )
            return "returned_to_dba", row

        if return_target == "author":
            deleted = await self._repo.delete(session, job_id)
            if not deleted:
                return "not_found", None
            return "deleted_for_author_return", None

        return "invalid_target", None

    async def set_access_mode(self, session: AsyncSession, job_id: str, access_mode: str) -> WorkflowJob | None:
        job = await self._repo.get(session, job_id)
        if job is None or job.status != WorkflowStatus.COMPLETED:
            return None
        summary = dict(job.pii_summary or {})
        summary["access_mode"] = access_mode
        return await self._repo.update_status(
            session,
            job_id,
            WorkflowStatus.COMPLETED,
            pii_summary=summary,
            performance_notes=job.performance_notes,
        )

    async def set_viewable_until(
        self, session: AsyncSession, job_id: str, viewable_until: datetime | None
    ) -> WorkflowJob | None:
        job = await self._repo.get(session, job_id)
        if job is None:
            return None
        if job.status not in {WorkflowStatus.AWAITING_INFOSEC, WorkflowStatus.COMPLETED}:
            return None
        base_start = job.created_at or datetime.now(timezone.utc)
        _validate_viewable_window(viewable_until, start_at=base_start, max_days=None)
        return await self._repo.update_execution(
            session,
            job_id=job_id,
            final_sql_text=job.final_sql_text or job.sql_text,
            executed_db_conn_id=job.executed_db_conn_id,
            target_db_kind=job.target_db_kind,
            status=job.status,
            pii_summary=job.pii_summary,
            performance_notes=job.performance_notes,
            viewable_until=viewable_until,
        )

    async def run_realtime_query(self, session: AsyncSession, job_id: str, limit: int = 1000) -> tuple[int, list[dict]]:
        job = await self._repo.get(session, job_id)
        if job is None:
            raise ValueError("job_not_found")
        if job.status != WorkflowStatus.COMPLETED:
            raise ValueError("job_not_ready")
        if job.viewable_until:
            now = datetime.now(timezone.utc)
            end_at = job.viewable_until if job.viewable_until.tzinfo else job.viewable_until.replace(tzinfo=timezone.utc)
            if now > end_at:
                raise ValueError("viewable_period_expired")
        if not job.executed_db_conn_id:
            raise ValueError("db_connection_missing")

        conn_info = await self._db_conn_repo.get_connection_secret(session, job.executed_db_conn_id)
        if not conn_info:
            raise ValueError("db_connection_not_found")
        kind = _to_target_kind(str(_pick(conn_info, "DB_KIND")))
        cfg = TargetDbConfig(
            kind=kind,
            host=str(_pick(conn_info, "HOST")),
            port=int(_pick(conn_info, "PORT")),
            database=str(_pick(conn_info, "DB_NAME")),
            service_name=str(_pick(conn_info, "SERVICE_NAME", default="")) or str(_pick(conn_info, "DB_NAME")),
            username=str(_pick(conn_info, "USERNAME")),
            password=str(_pick(conn_info, "PASSWORD_ENC")),
        )
        sql = job.final_sql_text or job.sql_text
        async for target_session in target_db_manager.session(cfg):
            result = await target_session.execute(text(sql))
            columns = list(result.keys())
            all_rows = result.fetchall()
            total = len(all_rows)
            limited = all_rows[:limit]
            rows = [{columns[idx]: value for idx, value in enumerate(row)} for row in limited]
            return total, rows
        return 0, []

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


def _pick(row: dict, key: str, default: object | None = None) -> object | None:
    if key in row:
        return row[key]
    lower = key.lower()
    if lower in row:
        return row[lower]
    upper = key.upper()
    if upper in row:
        return row[upper]
    return default


def _validate_max_7_days(viewable_until: datetime | None) -> None:
    if viewable_until is None:
        return
    now = datetime.now(timezone.utc)
    limit = now + timedelta(days=7)
    candidate = viewable_until if viewable_until.tzinfo else viewable_until.replace(tzinfo=timezone.utc)
    if candidate > limit:
        raise ValueError("viewable_until_exceeds_7_days")


def _validate_viewable_window(
    viewable_until: datetime | None,
    *,
    start_at: datetime,
    max_days: int | None,
) -> None:
    if viewable_until is None:
        return
    base = start_at if start_at.tzinfo else start_at.replace(tzinfo=timezone.utc)
    end = viewable_until if viewable_until.tzinfo else viewable_until.replace(tzinfo=timezone.utc)
    if end <= base:
        raise ValueError("viewable_until_must_be_after_start")
    if max_days is not None:
        limit = datetime.now(timezone.utc) + timedelta(days=max_days)
        if end > limit:
            raise ValueError("viewable_until_exceeds_7_days")
