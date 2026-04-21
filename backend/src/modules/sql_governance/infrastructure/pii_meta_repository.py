from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class PiiMetaRepository:
    """
    Loads rows from RPT.VW_PII_META (Oracle). For non-Oracle repo dialects used in local dev,
    returns an empty list so governance UI can still run.
    """

    _VIEW_SQL_ORACLE = """
        SELECT OWNER, TABLE_NAME, COLUMN_NAME, PII_YN
        FROM RPT.VW_PII_META
    """

    async def fetch_all(self, session: AsyncSession) -> list[Mapping[str, Any]]:
        dialect = session.bind.dialect.name if session.bind else ""
        if dialect == "sqlite":
            return []
        result = await session.execute(text(self._VIEW_SQL_ORACLE))
        rows = result.mappings().all()
        return [dict(r) for r in rows]
