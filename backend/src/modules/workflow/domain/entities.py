from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from src.modules.workflow.domain.enums import WorkflowStatus


@dataclass
class WorkflowJob:
    id: str
    psr_number: str
    status: WorkflowStatus
    sql_text: str
    target_db_kind: str
    final_sql_text: str | None = None
    executed_db_conn_id: str | None = None
    viewable_until: datetime | None = None
    pii_summary: dict[str, Any] = field(default_factory=dict)
    performance_notes: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
