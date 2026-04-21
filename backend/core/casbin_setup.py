import os

import casbin

from core.config import get_settings


def build_enforcer() -> casbin.Enforcer:
    settings = get_settings()
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    model = os.path.join(root, settings.casbin_model_path)
    policy = os.path.join(root, settings.casbin_policy_path)
    return casbin.Enforcer(model, policy)


_enforcer: casbin.Enforcer | None = None


def get_enforcer() -> casbin.Enforcer:
    global _enforcer
    if _enforcer is None:
        _enforcer = build_enforcer()
    return _enforcer


def enforce_report_read(subject: str, report_id: str) -> bool:
    e = get_enforcer()
    return bool(e.enforce(subject, report_id, "report", "read"))


def enforce_team_read(subject: str, team_id: str) -> bool:
    e = get_enforcer()
    return bool(e.enforce(subject, f"team:{team_id}", "dashboard", "read"))


def enforce_team_approve(subject: str, team_id: str) -> bool:
    e = get_enforcer()
    return bool(e.enforce(subject, f"team:{team_id}", "dashboard", "approve"))
