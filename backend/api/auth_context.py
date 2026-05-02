from __future__ import annotations

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from core.jwt_tokens import decode_access_token

security = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    user_id: str
    team_id: str
    role: str
    login_id: str | None = None


def _role_from_payload(payload: dict) -> str:
    dba = int(payload.get("dba", 0)) == 1
    adm = int(payload.get("adm", 0)) == 1
    if dba:
        return "DBA"
    if adm:
        return "PLATFORM_ADMIN"
    return "USER"


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
    x_user_id: str | None = Header(default=None),
    x_team_id: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> CurrentUser:
    if creds and creds.scheme.lower() == "bearer":
        try:
            payload = decode_access_token(creds.credentials)
        except jwt.PyJWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="유효하지 않거나 만료된 인증입니다.",
            )
        return CurrentUser(
            user_id=str(payload["sub"]),
            team_id=str(payload.get("tid") or "platform"),
            role=_role_from_payload(payload),
            login_id=str(payload.get("lid") or "") or None,
        )
    uid = x_user_id or "admin"
    return CurrentUser(
        user_id=uid,
        team_id=x_team_id or "platform",
        role=x_user_role or "DBA",
        login_id=uid,
    )
