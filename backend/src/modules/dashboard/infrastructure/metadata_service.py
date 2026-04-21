from __future__ import annotations

from src.modules.dashboard.domain.models import PiiItem
from src.modules.dashboard.domain.risk_policy import classify_risk


class MetadataService:
    """
    Adapter for enterprise metadata source. Current implementation is mock-friendly.
    """

    _keywords = [
        "주민번호",
        "성명",
        "이메일",
    ]

    def detect_pii_from_sql(self, sql_text: str) -> list[PiiItem]:
        normalized = sql_text.lower()
        out: list[PiiItem] = []
        for kw in self._keywords:
            if kw.lower() in normalized:
                out.append(PiiItem(name=kw, risk=classify_risk(kw)))
        return out

    def list_team_dictionary(self, team_id: str, keyword: str | None = None) -> list[dict[str, str]]:
        data = [
            {
                "owner": "RPT",
                "table_name": "CUSTOMER",
                "column_name": "RRN",
                "pii_type": "주민번호",
                "risk_level": "High",
                "team_id": "platform",
            },
            {
                "owner": "RPT",
                "table_name": "CUSTOMER",
                "column_name": "NAME",
                "pii_type": "성명",
                "risk_level": "Medium",
                "team_id": "platform",
            },
            {
                "owner": "RPT",
                "table_name": "ORDER_CONTACT",
                "column_name": "EMAIL",
                "pii_type": "이메일",
                "risk_level": "Low",
                "team_id": "platform",
            },
        ]
        rows = [r for r in data if r["team_id"] == team_id]
        if keyword:
            kw = keyword.lower()
            rows = [
                r
                for r in rows
                if kw in r["table_name"].lower() or kw in r["column_name"].lower() or kw in r["pii_type"].lower()
            ]
        return [{k: v for k, v in r.items() if k != "team_id"} for r in rows]
