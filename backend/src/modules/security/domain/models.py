from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal


MaskingType = Literal["RRN", "PHONE", "NAME", "CUSTOM"]
AuditActionType = Literal["PSR_REALTIME_QUERY", "REPORT_EXECUTE"]
AuditTargetType = Literal["PSR", "REPORT"]


@dataclass(slots=True)
class PiiMetadata:
    target_owner: str
    target_table: str
    target_column: str
    masking_type: str
    use_yn: str = "Y"


@dataclass(slots=True)
class AuditLogEntry:
    audit_id: str
    user_id: str
    team_id: str
    action_type: AuditActionType
    target_type: AuditTargetType
    target_id: str
    requested_sql: str
    row_count: int
    used_unmask: bool
    accessed_at: datetime
    client_ip: str | None = None
