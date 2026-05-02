from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from core.config import get_settings


class Base(DeclarativeBase):
    pass


def _schema_args() -> dict[str, Any] | tuple[dict[str, Any], ...]:
    schema = get_settings().repo_schema
    if schema:
        return {"schema": schema}
    return {}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class WorkflowJobRow(Base):
    __tablename__ = "TB_RPT_WORKFLOW_JOBS"
    __table_args__ = _schema_args()

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    psr_number: Mapped[str] = mapped_column(String(128), index=True)
    request_title: Mapped[str | None] = mapped_column(String(256), nullable=True)
    requester_emp_no: Mapped[str | None] = mapped_column(String(64), nullable=True)
    requester_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    requester_dept: Mapped[str | None] = mapped_column(String(128), nullable=True)
    developer_emp_no: Mapped[str | None] = mapped_column(String(64), nullable=True)
    developer_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    developer_dept: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    sql_text: Mapped[str] = mapped_column(Text())
    target_db_kind: Mapped[str] = mapped_column(String(32))
    final_sql_text: Mapped[str | None] = mapped_column(Text(), nullable=True)
    executed_db_conn_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    viewable_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Keep JSON payload as text for Oracle async dialect stability.
    pii_summary: Mapped[str] = mapped_column(Text(), default="{}")
    performance_notes: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )
