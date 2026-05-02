from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timezone

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.admin.domain.page_catalog import PAGE_CATALOG, page_key_catalog_sort_key
from src.modules.admin.infrastructure.orm import AppUserRow, DeptRow, PermGroupRow, PermMatrixRow


# JWT 플래그·레거시 호환용(쓰기만): 시스템관리자 그룹 시드 등
ADMIN_PORTAL_WRITE_KEYS: tuple[str, ...] = ("admin_users", "admin_permissions")
DBA_MENU_WRITE_KEYS: tuple[str, ...] = ("dba_approvals", "dba_db_connections", "dba_test_input")

# 사이드바 관리자 블록·조회 권한 분리용(읽기 또는 쓰기)
ADMIN_PORTAL_PAGE_KEYS: tuple[str, ...] = (
    "admin_security_settings",
    "admin_users",
    "admin_departments",
    "admin_permissions",
)
DBA_MENU_PAGE_KEYS: tuple[str, ...] = DBA_MENU_WRITE_KEYS


async def group_can_write_any_of(
    session: AsyncSession, group_id: str, page_keys: Sequence[str]
) -> bool:
    if not page_keys:
        return False
    r = await session.execute(
        select(PermMatrixRow.group_id)
        .where(
            PermMatrixRow.group_id == group_id,
            PermMatrixRow.page_key.in_(list(page_keys)),
            PermMatrixRow.can_write == "Y",
        )
        .limit(1)
    )
    return r.scalar_one_or_none() is not None


async def group_matrix_flags(
    session: AsyncSession, group_id: str, page_key: str
) -> tuple[bool, bool]:
    """(조회 가능, 수정 가능). 수정 Y이면 조회도 가능한 것으로 간주."""
    r = await session.execute(
        select(PermMatrixRow.can_read, PermMatrixRow.can_write).where(
            PermMatrixRow.group_id == group_id,
            PermMatrixRow.page_key == page_key,
        )
    )
    row = r.one_or_none()
    if row is None:
        return (False, False)
    rd, wr = str(row[0]), str(row[1])
    write_ok = wr == "Y"
    read_ok = rd == "Y" or write_ok
    return (read_ok, write_ok)


async def group_can_read_page(session: AsyncSession, group_id: str, page_key: str) -> bool:
    ok, _ = await group_matrix_flags(session, group_id, page_key)
    return ok


async def group_can_write_page(session: AsyncSession, group_id: str, page_key: str) -> bool:
    _, ok = await group_matrix_flags(session, group_id, page_key)
    return ok


async def list_menu_pages_with_access(
    session: AsyncSession, group_id: str, page_keys: Sequence[str]
) -> list[str]:
    """page_keys 중 조회 또는 수정이 허용된 page_key만 카탈로그 순으로 반환."""
    if not page_keys:
        return []
    r = await session.execute(
        select(PermMatrixRow.page_key).where(
            PermMatrixRow.group_id == group_id,
            PermMatrixRow.page_key.in_(list(page_keys)),
            or_(PermMatrixRow.can_read == "Y", PermMatrixRow.can_write == "Y"),
        )
    )
    found = [str(x) for x in r.scalars().all()]
    found.sort(key=page_key_catalog_sort_key)
    return found


async def list_admin_portal_menu_pages(session: AsyncSession, group_id: str) -> list[str]:
    return await list_menu_pages_with_access(session, group_id, ADMIN_PORTAL_PAGE_KEYS)


async def list_dba_menu_pages(session: AsyncSession, group_id: str) -> list[str]:
    return await list_menu_pages_with_access(session, group_id, DBA_MENU_PAGE_KEYS)


async def count_departments(session: AsyncSession) -> int:
    r = await session.execute(select(func.count()).select_from(DeptRow).where(DeptRow.use_yn == "Y"))
    return int(r.scalar_one())


async def list_departments(session: AsyncSession) -> list[DeptRow]:
    r = await session.execute(
        select(DeptRow).where(DeptRow.use_yn == "Y").order_by(DeptRow.dept_code)
    )
    return list(r.scalars().all())


async def get_dept(session: AsyncSession, dept_id: str) -> DeptRow | None:
    r = await session.execute(select(DeptRow).where(DeptRow.id == dept_id))
    return r.scalar_one_or_none()


async def get_dept_by_code(session: AsyncSession, dept_code: str) -> DeptRow | None:
    code = dept_code.strip().lower()
    r = await session.execute(
        select(DeptRow).where(DeptRow.dept_code == code, DeptRow.use_yn == "Y")
    )
    return r.scalar_one_or_none()


async def count_active_users_for_department(session: AsyncSession, dept_id: str) -> int:
    r = await session.execute(
        select(func.count())
        .select_from(AppUserRow)
        .where(AppUserRow.dept_id == dept_id, AppUserRow.use_yn == "Y")
    )
    return int(r.scalar_one())


async def delete_department_hard(session: AsyncSession, dept_id: str) -> None:
    await session.execute(delete(DeptRow).where(DeptRow.id == dept_id))
    await session.flush()


async def insert_dept(
    session: AsyncSession, *, dept_id: str, dept_code: str, dept_name: str
) -> DeptRow:
    row = DeptRow(
        id=dept_id,
        dept_code=dept_code.strip().lower(),
        dept_name=dept_name.strip(),
        use_yn="Y",
    )
    session.add(row)
    await session.flush()
    return row


async def update_dept_name(session: AsyncSession, dept_id: str, dept_name: str) -> None:
    await session.execute(
        update(DeptRow).where(DeptRow.id == dept_id).values(dept_name=dept_name.strip())
    )
    await session.flush()


async def team_scope_for_user(session: AsyncSession, u: AppUserRow) -> str:
    if u.dept_id:
        d = await get_dept(session, u.dept_id)
        if d and d.use_yn == "Y":
            return d.dept_code.lower()
    return (u.team_id or "platform").lower()


async def count_groups(session: AsyncSession) -> int:
    r = await session.execute(select(func.count()).select_from(PermGroupRow))
    return int(r.scalar_one())


async def list_groups(session: AsyncSession) -> list[PermGroupRow]:
    r = await session.execute(
        select(PermGroupRow).where(PermGroupRow.use_yn == "Y").order_by(PermGroupRow.group_name)
    )
    return list(r.scalars().all())


async def get_group(session: AsyncSession, group_id: str) -> PermGroupRow | None:
    r = await session.execute(select(PermGroupRow).where(PermGroupRow.id == group_id))
    return r.scalar_one_or_none()


async def insert_group(
    session: AsyncSession,
    *,
    group_id: str,
    group_name: str,
    description: str | None,
) -> PermGroupRow:
    row = PermGroupRow(
        id=group_id,
        group_name=group_name,
        description=description,
        use_yn="Y",
    )
    session.add(row)
    await session.flush()
    return row


async def replace_matrix(
    session: AsyncSession, group_id: str, rows: list[tuple[str, str, str]]
) -> None:
    """rows: list of (page_key, can_read Y/N, can_write Y/N). Write Y forces read Y."""
    await session.execute(delete(PermMatrixRow).where(PermMatrixRow.group_id == group_id))
    for page_key, can_read, can_write in rows:
        wr = "Y" if can_write == "Y" else "N"
        rd = "Y" if (can_read == "Y" or wr == "Y") else "N"
        session.add(PermMatrixRow(group_id=group_id, page_key=page_key, can_read=rd, can_write=wr))
    await session.flush()


async def get_matrix(session: AsyncSession, group_id: str) -> list[PermMatrixRow]:
    r = await session.execute(select(PermMatrixRow).where(PermMatrixRow.group_id == group_id))
    rows = list(r.scalars().all())
    rows.sort(key=lambda m: page_key_catalog_sort_key(m.page_key))
    return rows


async def ensure_full_matrix_defaults(session: AsyncSession, group_id: str) -> None:
    existing = {m.page_key for m in await get_matrix(session, group_id)}
    to_add: list[PermMatrixRow] = []
    for p in PAGE_CATALOG:
        if p.key not in existing:
            to_add.append(
                PermMatrixRow(group_id=group_id, page_key=p.key, can_read="N", can_write="N")
            )
    for row in to_add:
        session.add(row)
    if to_add:
        await session.flush()


async def list_users(
    session: AsyncSession,
) -> list[tuple[AppUserRow, str | None, str | None, str | None]]:
    q = (
        select(AppUserRow, PermGroupRow.group_name, DeptRow.dept_code, DeptRow.dept_name)
        .outerjoin(PermGroupRow, AppUserRow.group_id == PermGroupRow.id)
        .outerjoin(DeptRow, AppUserRow.dept_id == DeptRow.id)
        .where(AppUserRow.use_yn == "Y")
        .order_by(AppUserRow.login_id)
    )
    r = await session.execute(q)
    return [(row, gn, dc, dn) for row, gn, dc, dn in r.all()]


async def get_user(session: AsyncSession, user_id: str) -> AppUserRow | None:
    r = await session.execute(select(AppUserRow).where(AppUserRow.id == user_id))
    return r.scalar_one_or_none()


async def get_user_by_login(session: AsyncSession, login_id: str) -> AppUserRow | None:
    r = await session.execute(select(AppUserRow).where(AppUserRow.login_id == login_id))
    return r.scalar_one_or_none()


async def insert_user(
    session: AsyncSession,
    *,
    user_id: str,
    login_id: str,
    password_hash: str,
    display_name: str | None,
    dept_id: str,
    group_id: str,
) -> AppUserRow:
    dept = await get_dept(session, dept_id)
    if not dept or dept.use_yn != "Y":
        raise ValueError("invalid_dept_id")
    row = AppUserRow(
        id=user_id,
        login_id=login_id,
        password_hash=password_hash,
        display_name=display_name,
        team_id=dept.dept_code.lower(),
        dept_id=dept_id,
        group_id=group_id,
        use_yn="Y",
    )
    session.add(row)
    await session.flush()
    return row


async def update_user(session: AsyncSession, user_id: str, patch: dict[str, object]) -> None:
    allowed = {"display_name", "team_id", "group_id", "password_hash", "dept_id"}
    vals = {k: v for k, v in patch.items() if k in allowed}
    if "dept_id" in vals:
        did = vals.get("dept_id")
        if did:
            dept = await get_dept(session, str(did))
            if not dept or dept.use_yn != "Y":
                raise ValueError("invalid_dept_id")
            vals["team_id"] = dept.dept_code.lower()
        else:
            vals["team_id"] = None
    if not vals:
        return
    await session.execute(update(AppUserRow).where(AppUserRow.id == user_id).values(**vals))
    await session.flush()


async def touch_last_login(session: AsyncSession, user_id: str) -> None:
    now = datetime.now(timezone.utc)
    await session.execute(update(AppUserRow).where(AppUserRow.id == user_id).values(last_login_at=now))
    await session.flush()


async def soft_delete_user(session: AsyncSession, user_id: str) -> None:
    await session.execute(update(AppUserRow).where(AppUserRow.id == user_id).values(use_yn="N"))
    await session.flush()
