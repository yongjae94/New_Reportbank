from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt

from core.config import get_settings


def _secret() -> str:
    return get_settings().jwt_secret_key


def create_access_token(
    *,
    user_id: str,
    login_id: str,
    team_id: str | None,
    platform_admin: bool,
    dba_menu: bool,
) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "sub": user_id,
        "lid": login_id,
        "tid": team_id or "",
        "adm": 1 if platform_admin else 0,
        "dba": 1 if dba_menu else 0,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, _secret(), algorithm="HS256")


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, _secret(), algorithms=["HS256"])
