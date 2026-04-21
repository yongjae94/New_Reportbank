"""
Pure functions: qualify SQL (via SQLGlot), extract column references, match PII meta rows.
No database sessions or FastAPI imports.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable

import sqlglot
from sqlglot import exp
from sqlglot.optimizer.qualify import qualify


@dataclass(frozen=True)
class ColumnRef:
    catalog: str | None
    db: str | None
    schema: str | None
    table: str | None
    column: str


@dataclass
class PiiHit:
    ref: ColumnRef
    meta_row: dict[str, Any]


@dataclass
class PiiCheckResult:
    column_refs: list[ColumnRef] = field(default_factory=list)
    pii_hits: list[PiiHit] = field(default_factory=list)
    parse_errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def normalize_ident(name: str | None) -> str:
    if not name:
        return ""
    n = name.strip()
    if len(n) >= 2 and n[0] == n[-1] and n[0] in ('"', "`", "["):
        n = n[1:-1]
    return n.upper()


def qualify_sql_ast(sql: str, dialect: str | None) -> tuple[exp.Expression | None, list[str]]:
    errors: list[str] = []
    try:
        tree = sqlglot.parse_one(sql, read=dialect)
    except Exception as exc:  # noqa: BLE001 — surface to workflow
        errors.append(f"parse_error: {exc}")
        return None, errors
    try:
        qualified = qualify(tree, dialect=dialect)
        return qualified, errors
    except Exception as exc:  # noqa: BLE001
        errors.append(f"qualify_error: {exc}")
        return None, errors


def extract_column_refs(qualified: exp.Expression) -> list[ColumnRef]:
    refs: list[ColumnRef] = []
    for col in qualified.find_all(exp.Column):
        schema_part: str | None = None
        table_part: str | None = None
        tbl = col.table
        if isinstance(tbl, exp.Table):
            schema_part = normalize_ident(tbl.db) or normalize_ident(tbl.args.get("schema")) or None
            table_part = normalize_ident(tbl.name) or None
        elif isinstance(tbl, exp.Identifier):
            table_part = normalize_ident(tbl.this) or normalize_ident(tbl.name) or None
        elif isinstance(tbl, str):
            table_part = normalize_ident(tbl) or None
        elif tbl is not None:
            table_part = normalize_ident(getattr(tbl, "name", str(tbl))) or None

        colname = normalize_ident(col.name)
        if not colname and isinstance(col.this, exp.Identifier):
            colname = normalize_ident(col.this.name)

        refs.append(
            ColumnRef(
                catalog=None,
                db=None,
                schema=schema_part,
                table=table_part,
                column=colname,
            )
        )
    # Deduplicate stable order
    seen: set[tuple[Any, ...]] = set()
    out: list[ColumnRef] = []
    for r in refs:
        key = (r.catalog, r.db, r.schema, r.table, r.column)
        if key in seen or not r.column:
            continue
        seen.add(key)
        out.append(r)
    return out


def _meta_key(row: dict[str, Any]) -> tuple[str, str, str]:
    owner = normalize_ident(
        row.get("OWNER")
        or row.get("owner")
        or row.get("TABLE_SCHEMA")
        or row.get("table_schema")
    )
    table = normalize_ident(row.get("TABLE_NAME") or row.get("table_name"))
    column = normalize_ident(row.get("COLUMN_NAME") or row.get("column_name"))
    return owner, table, column


def _is_pii_row(row: dict[str, Any]) -> bool:
    v = row.get("PII_YN") or row.get("pii_yn") or row.get("IS_PII") or row.get("is_pii")
    if isinstance(v, bool):
        return v
    if v is None:
        return False
    return str(v).strip().upper() in {"Y", "YES", "TRUE", "1"}


def resolve_pii(
    refs: Iterable[ColumnRef],
    meta_rows: Iterable[dict[str, Any]],
) -> PiiCheckResult:
    meta_index: dict[tuple[str, str, str], dict[str, Any]] = {}
    for row in meta_rows:
        k = _meta_key(row)
        if k[2]:
            meta_index[k] = row

    refs_list = list(refs)
    hits: list[PiiHit] = []
    warnings: list[str] = []
    for ref in refs_list:
        candidates = [
            (normalize_ident(ref.schema or ""), normalize_ident(ref.table or ""), ref.column),
            ("", normalize_ident(ref.table or ""), ref.column),
        ]
        matched = False
        for key in candidates:
            row = meta_index.get(key)
            if row and _is_pii_row(row):
                hits.append(PiiHit(ref=ref, meta_row=row))
                matched = True
                break
        if not matched and ref.table:
            if not any(k[1] == normalize_ident(ref.table or "") for k in meta_index):
                warnings.append(f"no_meta_for_table:{ref.table}")

    return PiiCheckResult(column_refs=refs_list, pii_hits=hits, warnings=warnings)
