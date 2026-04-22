from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.security.domain.models import AuditLogEntry
from src.modules.security.infrastructure.security_repository import SecurityRepository


class AuditTrailService:
    def __init__(self, repository: SecurityRepository | None = None) -> None:
        self._repo = repository or SecurityRepository()

    async def log_psr_realtime_query(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        team_id: str,
        psr_id: str,
        sql_text: str,
        row_count: int,
        used_unmask: bool,
        client_ip: str | None,
    ) -> None:
        entry = AuditLogEntry(
            audit_id=str(uuid.uuid4()),
            user_id=user_id,
            team_id=team_id,
            action_type="PSR_REALTIME_QUERY",
            target_type="PSR",
            target_id=psr_id,
            requested_sql=sql_text,
            row_count=row_count,
            used_unmask=used_unmask,
            accessed_at=datetime.now(timezone.utc),
            client_ip=client_ip,
        )
        await self._repo.insert_audit_log(session, entry)

    async def log_report_execution(
        self,
        session: AsyncSession,
        *,
        user_id: str,
        team_id: str,
        report_id: str,
        sql_text: str,
        row_count: int,
        used_unmask: bool,
        client_ip: str | None,
    ) -> None:
        entry = AuditLogEntry(
            audit_id=str(uuid.uuid4()),
            user_id=user_id,
            team_id=team_id,
            action_type="REPORT_EXECUTE",
            target_type="REPORT",
            target_id=report_id,
            requested_sql=sql_text,
            row_count=row_count,
            used_unmask=used_unmask,
            accessed_at=datetime.now(timezone.utc),
            client_ip=client_ip,
        )
        await self._repo.insert_audit_log(session, entry)
