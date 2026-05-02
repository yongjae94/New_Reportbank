from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from core.passwords import hash_password
from src.modules.admin.domain.page_catalog import PAGE_CATALOG
from src.modules.admin.infrastructure import repository as admin_repo

_DEPT_SEEDS: tuple[tuple[str, str], ...] = (
    ("platform", "플랫폼"),
    ("fin", "재무"),
    ("hr", "인사"),
    ("sec", "정보보호"),
)


async def seed_departments_if_empty(session: AsyncSession) -> None:
    if await admin_repo.count_departments(session) > 0:
        return
    for code, name in _DEPT_SEEDS:
        await admin_repo.insert_dept(
            session, dept_id=str(uuid.uuid4()), dept_code=code, dept_name=name
        )
    await session.flush()


async def seed_admin_defaults_if_empty(session: AsyncSession) -> None:
    await seed_departments_if_empty(session)
    if await admin_repo.count_groups(session) > 0:
        return
    platform = await admin_repo.get_dept_by_code(session, "platform")
    if not platform:
        return
    gid = str(uuid.uuid4())
    await admin_repo.insert_group(
        session,
        group_id=gid,
        group_name="시스템관리자",
        description="최초 기본 그룹(전 메뉴 수정 권한)",
    )
    rows = [(p.key, "Y", "Y") for p in PAGE_CATALOG]
    await admin_repo.replace_matrix(session, gid, rows)
    uid = str(uuid.uuid4())
    await admin_repo.insert_user(
        session,
        user_id=uid,
        login_id="admin",
        password_hash=hash_password("admin123"),
        display_name="시스템 관리자",
        dept_id=platform.id,
        group_id=gid,
    )
