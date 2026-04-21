from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.dashboard.domain.models import DashboardQuery, DashboardStats, PiiItem
from src.modules.dashboard.domain.risk_policy import classify_risk, summarize_risk
from src.modules.dashboard.infrastructure.dashboard_repository import DashboardRepository
from src.modules.dashboard.infrastructure.metadata_service import MetadataService
from src.modules.sql_governance.application.sql_validator_service import SqlValidatorService


class DashboardService:
    def __init__(
        self,
        repository: DashboardRepository | None = None,
        metadata: MetadataService | None = None,
        sql_validator: SqlValidatorService | None = None,
    ) -> None:
        self._repo = repository or DashboardRepository()
        self._metadata = metadata or MetadataService()
        self._sql = sql_validator or SqlValidatorService()

    async def list_team_queries(self, session: AsyncSession, team_id: str) -> list[DashboardQuery]:
        rows = await self._repo.list_team_queries(session, team_id)
        for r in rows:
            r.pii_items = self._build_pii_items(session, r)
        return rows

    async def _build_pii_items(self, session: AsyncSession, row: DashboardQuery) -> list[PiiItem]:
        summary = row.pii_summary or {}
        items: list[PiiItem] = []
        for col in summary.get("pii_columns", []):
            meta = col.get("meta") or {}
            label = str(meta.get("PII_TYPE") or meta.get("COLUMN_NAME") or col.get("column") or "PII")
            items.append(PiiItem(name=label, risk=classify_risk(label)))

        if not items:
            dialect = _sqlglot_dialect(row.target_db_kind)
            result = await self._sql.validate_sql(session, row.sql_text, dialect)
            for hit in result.pii_hits:
                label = str(hit.ref.column or hit.meta_row.get("COLUMN_NAME") or "PII")
                items.append(PiiItem(name=label, risk=classify_risk(label)))

        if not items:
            items = self._metadata.detect_pii_from_sql(row.sql_text)

        return items

    async def get_team_stats(self, session: AsyncSession, team_id: str) -> DashboardStats:
        rows = await self.list_team_queries(session, team_id)
        pending = sum(1 for r in rows if r.status == "awaiting_dba")
        pii_count = sum(1 for r in rows if len(r.pii_items) > 0)
        high_count = sum(1 for r in rows if summarize_risk(r.pii_items) == "High")
        return DashboardStats(
            total_requests=len(rows),
            pending_approvals=pending,
            pii_detected_count=pii_count,
            high_risk_count=high_count,
        )

    def list_team_dictionary(self, team_id: str, keyword: str | None) -> list[dict[str, str]]:
        return self._metadata.list_team_dictionary(team_id=team_id, keyword=keyword)


def _sqlglot_dialect(kind: str) -> str | None:
    k = kind.lower()
    if k == "oracle":
        return "oracle"
    if k in {"mssql", "sqlserver"}:
        return "tsql"
    if k in {"postgres", "postgresql"}:
        return "postgres"
    return None
