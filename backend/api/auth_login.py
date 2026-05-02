from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth_context import CurrentUser, get_current_user
from core.config import get_settings
from core.database import get_repo_session
from core.jwt_tokens import create_access_token
from core.passwords import verify_password
from src.modules.admin.infrastructure import repository as admin_repo

router = APIRouter(prefix="/v1/auth", tags=["auth"])


class LoginBody(BaseModel):
    login_id: str
    password: str


class UserBrief(BaseModel):
    user_id: str
    login_id: str
    display_name: str | None
    team_id: str | None
    group_id: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    platform_admin: bool
    dba_menu: bool
    admin_menu_pages: list[str]
    dba_menu_pages: list[str]
    user: UserBrief


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginBody, session: AsyncSession = Depends(get_repo_session)) -> LoginResponse:
    u = await admin_repo.get_user_by_login(session, body.login_id)
    if not u or u.use_yn != "Y":
        raise HTTPException(status_code=401, detail="로그인 정보가 올바르지 않습니다.")
    if not verify_password(body.password, u.password_hash):
        raise HTTPException(status_code=401, detail="로그인 정보가 올바르지 않습니다.")

    admin_menu_pages = await admin_repo.list_admin_portal_menu_pages(session, u.group_id)
    dba_menu_pages = await admin_repo.list_dba_menu_pages(session, u.group_id)
    platform_admin = len(admin_menu_pages) > 0
    dba_menu = len(dba_menu_pages) > 0

    await admin_repo.touch_last_login(session, u.id)
    await session.commit()

    team_scope = await admin_repo.team_scope_for_user(session, u)
    settings = get_settings()
    token = create_access_token(
        user_id=u.id,
        login_id=u.login_id,
        team_id=team_scope,
        platform_admin=platform_admin,
        dba_menu=dba_menu,
    )
    return LoginResponse(
        access_token=token,
        expires_in=settings.jwt_expire_minutes * 60,
        platform_admin=platform_admin,
        dba_menu=dba_menu,
        admin_menu_pages=admin_menu_pages,
        dba_menu_pages=dba_menu_pages,
        user=UserBrief(
            user_id=u.id,
            login_id=u.login_id,
            display_name=u.display_name,
            team_id=team_scope,
            group_id=u.group_id,
        ),
    )


class MeOut(BaseModel):
    user_id: str
    login_id: str
    display_name: str | None
    team_id: str | None
    group_id: str
    role: str
    platform_admin: bool
    dba_menu: bool
    admin_menu_pages: list[str]
    dba_menu_pages: list[str]


@router.get("/me", response_model=MeOut)
async def me(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_repo_session),
) -> MeOut:
    u = await admin_repo.get_user(session, user.user_id)
    if not u or u.use_yn != "Y":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="사용자를 찾을 수 없습니다.")
    admin_menu_pages = await admin_repo.list_admin_portal_menu_pages(session, u.group_id)
    dba_menu_pages = await admin_repo.list_dba_menu_pages(session, u.group_id)
    platform_admin = len(admin_menu_pages) > 0
    dba_menu = len(dba_menu_pages) > 0
    team_scope = await admin_repo.team_scope_for_user(session, u)
    return MeOut(
        user_id=u.id,
        login_id=u.login_id,
        display_name=u.display_name,
        team_id=team_scope,
        group_id=u.group_id,
        role=user.role,
        platform_admin=platform_admin,
        dba_menu=dba_menu,
        admin_menu_pages=admin_menu_pages,
        dba_menu_pages=dba_menu_pages,
    )
