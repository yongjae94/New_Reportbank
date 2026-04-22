from fastapi import Header
from pydantic import BaseModel


class CurrentUser(BaseModel):
    user_id: str
    team_id: str
    role: str


async def get_current_user(
    x_user_id: str | None = Header(default=None),
    x_team_id: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> CurrentUser:
    # Mock auth context for local/dev; replace with SSO/JWT integration later.
    return CurrentUser(
        user_id=x_user_id or "admin",
        team_id=x_team_id or "platform",
        role=x_user_role or "DBA",
    )
