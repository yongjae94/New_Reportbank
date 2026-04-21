from __future__ import annotations

from src.modules.dashboard.domain.models import PiiItem


def classify_risk(name: str) -> str:
    n = name.strip().lower()
    if "주민" in n or "rrn" in n or "ssn" in n:
        return "High"
    if "성명" in n or "name" in n:
        return "Medium"
    return "Low"


def summarize_risk(items: list[PiiItem]) -> str:
    if any(i.risk == "High" for i in items):
        return "High"
    if any(i.risk == "Medium" for i in items):
        return "Medium"
    if any(i.risk == "Low" for i in items):
        return "Low"
    return "None"
