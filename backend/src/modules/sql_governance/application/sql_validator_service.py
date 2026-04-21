from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.sql_governance.domain.pii_pure import (
    PiiCheckResult,
    extract_column_refs,
    qualify_sql_ast,
    resolve_pii,
)
from src.modules.sql_governance.infrastructure.pii_meta_repository import PiiMetaRepository


class SqlValidatorService:
    def __init__(self, pii_meta: PiiMetaRepository | None = None) -> None:
        self._pii_meta = pii_meta or PiiMetaRepository()

    async def validate_sql(
        self,
        repo_session: AsyncSession,
        sql_text: str,
        dialect: str | None,
    ) -> PiiCheckResult:
        meta_rows = await self._pii_meta.fetch_all(repo_session)
        ast, errs = qualify_sql_ast(sql_text, dialect)
        if ast is None:
            return PiiCheckResult(parse_errors=errs)

        refs = extract_column_refs(ast)
        result = resolve_pii(refs, meta_rows)
        result.parse_errors = errs
        return result

    def to_summary_dict(self, result: PiiCheckResult) -> dict[str, Any]:
        return {
            "column_count": len(result.column_refs),
            "pii_columns": [
                {
                    "schema": h.ref.schema,
                    "table": h.ref.table,
                    "column": h.ref.column,
                    "meta": {k: v for k, v in h.meta_row.items()},
                }
                for h in result.pii_hits
            ],
            "warnings": list(result.warnings),
            "parse_errors": list(result.parse_errors),
        }
