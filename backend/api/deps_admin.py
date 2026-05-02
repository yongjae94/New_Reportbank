from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth_context import CurrentUser, get_current_user
from core.database import get_repo_session
from src.modules.admin.infrastructure import repository as admin_repo


def require_platform_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """JWT(권한 매트릭스) 또는 구 헤더(ADMIN/DBA)로 관리 API 허용."""
    if user.role not in ("ADMIN", "DBA", "PLATFORM_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자만 접근할 수 있습니다.",
        )
    return user


def require_admin_page(page_key: str, *, need_write: bool = False):
    """매트릭스 기준: 해당 page_key에 조회(또는 수정) 권한이 있어야 함. need_write=True면 수정만."""

    async def _dep(
        user: CurrentUser = Depends(get_current_user),
        session: AsyncSession = Depends(get_repo_session),
    ) -> CurrentUser:
        if user.role in ("ADMIN", "DBA"):
            return user
        if user.role != "PLATFORM_ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="관리자만 접근할 수 있습니다.",
            )
        urow = await admin_repo.get_user(session, user.user_id)
        if not urow or urow.use_yn != "Y":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="사용자를 찾을 수 없습니다.",
            )
        ok = (
            await admin_repo.group_can_write_page(session, urow.group_id, page_key)
            if need_write
            else await admin_repo.group_can_read_page(session, urow.group_id, page_key)
        )
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="이 메뉴에 대한 권한이 없습니다.",
            )
        return user

    return _dep


def require_admin_read_one_of(*page_keys: str):
    """page_keys 중 하나라도 조회(또는 수정) 가능하면 허용."""

    async def _dep(
        user: CurrentUser = Depends(get_current_user),
        session: AsyncSession = Depends(get_repo_session),
    ) -> CurrentUser:
        if user.role in ("ADMIN", "DBA"):
            return user
        if user.role != "PLATFORM_ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="관리자만 접근할 수 있습니다.",
            )
        urow = await admin_repo.get_user(session, user.user_id)
        if not urow or urow.use_yn != "Y":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="사용자를 찾을 수 없습니다.",
            )
        for pk in page_keys:
            if await admin_repo.group_can_read_page(session, urow.group_id, pk):
                return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 메뉴에 대한 권한이 없습니다.",
        )

    return _dep
