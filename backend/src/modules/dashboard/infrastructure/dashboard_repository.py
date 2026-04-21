from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.dashboard.domain.models import DashboardQuery
from src.modules.workflow.infrastructure.orm import WorkflowJobRow


class DashboardRepository:
    async def list_team_queries(self, session: AsyncSession, team_id: str) -> list[DashboardQuery]:
        res = await session.execute(select(WorkflowJobRow).order_by(WorkflowJobRow.created_at.desc()))
        rows = res.scalars().all()
        out: list[DashboardQuery] = []
        for row in rows:
            row_team = str((row.pii_summary or {}).get("team_id", "platform"))
            if row_team != team_id:
                continue
            out.append(
                DashboardQuery(
                    id=row.id,
                    team_id=row_team,
                    status=row.status,
                    sql_text=row.sql_text,
                    created_at=row.created_at.isoformat(),
                    target_db_kind=row.target_db_kind,
                    pii_summary=dict(row.pii_summary or {}),
                    pii_items=[],
                )
            )
        if out:
            return out
        return [
            DashboardQuery(
                id="mock-q-001",
                team_id=team_id,
                status="awaiting_dba",
                sql_text="SELECT 주민번호, 성명 FROM RPT.CUSTOMER WHERE ROWNUM <= 10",
                created_at="2026-04-21T00:00:00+00:00",
                target_db_kind="oracle",
                pii_summary={},
                pii_items=[],
            ),
            DashboardQuery(
                id="mock-q-002",
                team_id=team_id,
                status="approved",
                sql_text="SELECT 고객ID, 이메일 FROM RPT.ORDER_CONTACT",
                created_at="2026-04-20T10:30:00+00:00",
                target_db_kind="oracle",
                pii_summary={},
                pii_items=[],
            ),
        ]
