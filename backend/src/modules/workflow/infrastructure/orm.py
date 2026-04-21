from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, JSON, String, Text
from sqlalchemy.ext.mutable import MutableDict
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
    __tablename__ = "WORKFLOW_JOBS"
    __table_args__ = _schema_args()

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    psr_number: Mapped[str] = mapped_column(String(128), index=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    sql_text: Mapped[str] = mapped_column(Text())
    target_db_kind: Mapped[str] = mapped_column(String(32))
    pii_summary: Mapped[dict] = mapped_column(MutableDict.as_mutable(JSON), default=dict)
    performance_notes: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )
