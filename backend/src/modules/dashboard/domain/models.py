from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class PiiItem:
    name: str
    risk: str


@dataclass
class DashboardQuery:
    id: str
    team_id: str
    status: str
    sql_text: str
    created_at: str
    target_db_kind: str = "oracle"
    pii_summary: dict = field(default_factory=dict)
    pii_items: list[PiiItem] = field(default_factory=list)


@dataclass
class DashboardStats:
    total_requests: int
    pending_approvals: int
    pii_detected_count: int
    high_risk_count: int
