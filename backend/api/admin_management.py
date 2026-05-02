from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps_admin import require_admin_page, require_admin_read_one_of
from core.database import get_repo_session
from core.passwords import hash_password, verify_password
from src.modules.admin.domain.page_catalog import is_allowed_page_key
from src.modules.admin.domain.page_catalog import PAGE_CATALOG
from src.modules.admin.infrastructure import repository as admin_repo

router = APIRouter(prefix="/v1/admin", tags=["admin"])


def _is_builtin_admin_login(login_id: str) -> bool:
    """시드 기본 계정(login_id=admin). 권한 그룹 변경·비활성화 불가."""
    return login_id.strip().casefold() == "admin"


class PageCatalogItem(BaseModel):
    key: str
    label: str


@router.get("/page-catalog", response_model=list[PageCatalogItem])
async def page_catalog(_: object = Depends(require_admin_page("admin_permissions"))) -> list[PageCatalogItem]:
    return [PageCatalogItem(key=p.key, label=p.label) for p in PAGE_CATALOG]


class PermGroupOut(BaseModel):
    id: str
    group_name: str
    description: str | None


@router.get("/perm-groups", response_model=list[PermGroupOut])
async def list_perm_groups(
    _: object = Depends(require_admin_read_one_of("admin_permissions", "admin_users")),
    session: AsyncSession = Depends(get_repo_session),
) -> list[PermGroupOut]:
    rows = await admin_repo.list_groups(session)
    return [PermGroupOut(id=r.id, group_name=r.group_name, description=r.description) for r in rows]


class MatrixRowIn(BaseModel):
    page_key: str
    can_read: str = Field(pattern="^[YN]$")
    can_write: str = Field(pattern="^[YN]$")


class MatrixRowOut(BaseModel):
    page_key: str
    label: str
    can_read: str
    can_write: str


@router.get("/perm-groups/{group_id}/matrix", response_model=list[MatrixRowOut])
async def get_group_matrix(
    group_id: str,
    _: object = Depends(require_admin_page("admin_permissions")),
    session: AsyncSession = Depends(get_repo_session),
) -> list[MatrixRowOut]:
    g = await admin_repo.get_group(session, group_id)
    if not g:
        raise HTTPException(status_code=404, detail="권한 그룹을 찾을 수 없습니다.")
    await admin_repo.ensure_full_matrix_defaults(session, group_id)
    await session.commit()
    matrix = await admin_repo.get_matrix(session, group_id)
    label_by_key = {p.key: p.label for p in PAGE_CATALOG}
    return [
        MatrixRowOut(
            page_key=m.page_key,
            label=label_by_key.get(m.page_key, m.page_key),
            can_read=m.can_read,
            can_write=m.can_write,
        )
        for m in matrix
    ]


class PutMatrixBody(BaseModel):
    rows: list[MatrixRowIn]


@router.put("/perm-groups/{group_id}/matrix")
async def put_group_matrix(
    group_id: str,
    body: PutMatrixBody,
    _: object = Depends(require_admin_page("admin_permissions", need_write=True)),
    session: AsyncSession = Depends(get_repo_session),
) -> dict[str, str]:
    g = await admin_repo.get_group(session, group_id)
    if not g:
        raise HTTPException(status_code=404, detail="권한 그룹을 찾을 수 없습니다.")
    normalized: list[tuple[str, str, str]] = []
    for row in body.rows:
        if not is_allowed_page_key(row.page_key):
            raise HTTPException(status_code=400, detail=f"알 수 없는 페이지 키: {row.page_key}")
        normalized.append((row.page_key, row.can_read, row.can_write))
    await admin_repo.replace_matrix(session, group_id, normalized)
    await session.commit()
    return {"status": "ok"}


class CreateGroupBody(BaseModel):
    group_name: str = Field(min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=500)


@router.post("/perm-groups", response_model=PermGroupOut, status_code=status.HTTP_201_CREATED)
async def create_perm_group(
    body: CreateGroupBody,
    _: object = Depends(require_admin_page("admin_permissions", need_write=True)),
    session: AsyncSession = Depends(get_repo_session),
) -> PermGroupOut:
    gid = str(uuid.uuid4())
    row = await admin_repo.insert_group(
        session, group_id=gid, group_name=body.group_name, description=body.description
    )
    await admin_repo.replace_matrix(
        session, gid, [(p.key, "N", "N") for p in PAGE_CATALOG]
    )
    await session.commit()
    return PermGroupOut(id=row.id, group_name=row.group_name, description=row.description)


class DeptOut(BaseModel):
    id: str
    dept_code: str
    dept_name: str


class CreateDeptBody(BaseModel):
    dept_code: str = Field(min_length=2, max_length=32, pattern=r"^[a-z0-9_]+$")
    dept_name: str = Field(min_length=1, max_length=128)


class PatchDeptBody(BaseModel):
    dept_name: str = Field(min_length=1, max_length=128)


@router.get("/departments", response_model=list[DeptOut])
async def list_departments(
    _: object = Depends(require_admin_read_one_of("admin_departments", "admin_users")),
    session: AsyncSession = Depends(get_repo_session),
) -> list[DeptOut]:
    rows = await admin_repo.list_departments(session)
    return [DeptOut(id=r.id, dept_code=r.dept_code, dept_name=r.dept_name) for r in rows]


@router.post("/departments", response_model=DeptOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    body: CreateDeptBody,
    _: object = Depends(require_admin_page("admin_departments", need_write=True)),
    session: AsyncSession = Depends(get_repo_session),
) -> DeptOut:
    code = body.dept_code.strip().lower()
    if await admin_repo.get_dept_by_code(session, code):
        raise HTTPException(status_code=409, detail="이미 존재하는 부서 코드입니다.")
    row = await admin_repo.insert_dept(
        session, dept_id=str(uuid.uuid4()), dept_code=code, dept_name=body.dept_name
    )
    await session.commit()
    return DeptOut(id=row.id, dept_code=row.dept_code, dept_name=row.dept_name)


@router.patch("/departments/{dept_id}", response_model=DeptOut)
async def patch_department(
    dept_id: str,
    body: PatchDeptBody,
    _: object = Depends(require_admin_page("admin_departments", need_write=True)),
    session: AsyncSession = Depends(get_repo_session),
) -> DeptOut:
    d = await admin_repo.get_dept(session, dept_id)
    if not d or d.use_yn != "Y":
        raise HTTPException(status_code=404, detail="부서를 찾을 수 없습니다.")
    await admin_repo.update_dept_name(session, dept_id, body.dept_name)
    await session.commit()
    d2 = await admin_repo.get_dept(session, dept_id)
    assert d2
    return DeptOut(id=d2.id, dept_code=d2.dept_code, dept_name=d2.dept_name)


@router.delete("/departments/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    dept_id: str,
    _: object = Depends(require_admin_page("admin_departments", need_write=True)),
    session: AsyncSession = Depends(get_repo_session),
) -> None:
    d = await admin_repo.get_dept(session, dept_id)
    if not d or d.use_yn != "Y":
        raise HTTPException(status_code=404, detail="부서를 찾을 수 없습니다.")
    n = await admin_repo.count_active_users_for_department(session, dept_id)
    if n > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이 부서에 연결된 활성 사용자가 있습니다. 사용자를 다른 부서로 옮긴 뒤 삭제하세요.",
        )
    await admin_repo.delete_department_hard(session, dept_id)
    await session.commit()


class AppUserOut(BaseModel):
    id: str
    login_id: str
    display_name: str | None
    team_id: str | None
    dept_id: str | None
    dept_code: str | None
    dept_name: str | None
    group_id: str
    group_name: str | None
    created_at: datetime | None
    last_login_at: datetime | None


@router.get("/users", response_model=list[AppUserOut])
async def list_users(
    _: object = Depends(require_admin_page("admin_users")),
    session: AsyncSession = Depends(get_repo_session),
) -> list[AppUserOut]:
    rows = await admin_repo.list_users(session)
    return [
        AppUserOut(
            id=u.id,
            login_id=u.login_id,
            display_name=u.display_name,
            team_id=u.team_id,
            dept_id=u.dept_id,
            dept_code=dc,
            dept_name=dn,
            group_id=u.group_id,
            group_name=gn,
            created_at=u.created_at,
            last_login_at=u.last_login_at,
        )
        for u, gn, dc, dn in rows
    ]


class CreateUserBody(BaseModel):
    login_id: str = Field(min_length=2, max_length=128)
    password: str = Field(min_length=6, max_length=128)
    display_name: str | None = Field(default=None, max_length=128)
    dept_id: str = Field(min_length=1, max_length=36)
    group_id: str = Field(min_length=1, max_length=36)


@router.post("/users", response_model=AppUserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserBody,
    _: object = Depends(require_admin_page("admin_users", need_write=True)),
    session: AsyncSession = Depends(get_repo_session),
) -> AppUserOut:
    if await admin_repo.get_user_by_login(session, body.login_id):
        raise HTTPException(status_code=409, detail="이미 사용 중인 로그인 ID입니다.")
    if not await admin_repo.get_group(session, body.group_id):
        raise HTTPException(status_code=400, detail="권한 그룹이 존재하지 않습니다.")
    if not await admin_repo.get_dept(session, body.dept_id):
        raise HTTPException(status_code=400, detail="부서가 존재하지 않습니다.")
    uid = str(uuid.uuid4())
    try:
        u = await admin_repo.insert_user(
            session,
            user_id=uid,
            login_id=body.login_id,
            password_hash=hash_password(body.password),
            display_name=body.display_name,
            dept_id=body.dept_id,
            group_id=body.group_id,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="유효하지 않은 부서입니다.") from None
    await session.commit()
    g = await admin_repo.get_group(session, u.group_id)
    d = await admin_repo.get_dept(session, u.dept_id) if u.dept_id else None
    return AppUserOut(
        id=u.id,
        login_id=u.login_id,
        display_name=u.display_name,
        team_id=u.team_id,
        dept_id=u.dept_id,
        dept_code=d.dept_code if d else None,
        dept_name=d.dept_name if d else None,
        group_id=u.group_id,
        group_name=g.group_name if g else None,
        created_at=u.created_at,
        last_login_at=u.last_login_at,
    )


class UpdateUserBody(BaseModel):
    display_name: str | None = Field(default=None, max_length=128)
    dept_id: str | None = Field(default=None, max_length=36)
    group_id: str | None = Field(default=None, max_length=36)
    password: str | None = Field(default=None, min_length=6, max_length=128)


@router.put("/users/{user_id}", response_model=AppUserOut)
async def update_user(
    user_id: str,
    body: UpdateUserBody,
    _: object = Depends(require_admin_page("admin_users", need_write=True)),
    session: AsyncSession = Depends(get_repo_session),
) -> AppUserOut:
    u = await admin_repo.get_user(session, user_id)
    if not u or u.use_yn != "Y":
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if body.group_id is not None and not await admin_repo.get_group(session, body.group_id):
        raise HTTPException(status_code=400, detail="권한 그룹이 존재하지 않습니다.")
    dump = body.model_dump(exclude_unset=True)
    if "group_id" in dump and dump.get("group_id") is not None:
        new_gid = str(dump["group_id"])
        if new_gid != u.group_id and _is_builtin_admin_login(u.login_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="기본 admin 계정의 권한 그룹은 변경할 수 없습니다. (시스템관리자 유지)",
            )
    if "dept_id" in dump:
        did = dump.get("dept_id")
        if not did:
            raise HTTPException(status_code=400, detail="부서는 필수입니다.")
        if not await admin_repo.get_dept(session, str(did)):
            raise HTTPException(status_code=400, detail="부서가 존재하지 않습니다.")
    patch: dict[str, object] = {}
    if "display_name" in dump:
        patch["display_name"] = dump["display_name"]
    if "dept_id" in dump:
        patch["dept_id"] = dump["dept_id"]
    if "group_id" in dump:
        patch["group_id"] = dump["group_id"]
    if "password" in dump and dump["password"]:
        patch["password_hash"] = hash_password(str(dump["password"]))
    try:
        await admin_repo.update_user(session, user_id, patch)
    except ValueError:
        raise HTTPException(status_code=400, detail="유효하지 않은 부서입니다.") from None
    await session.commit()
    u2 = await admin_repo.get_user(session, user_id)
    assert u2
    g = await admin_repo.get_group(session, u2.group_id)
    gn = g.group_name if g else None
    d = await admin_repo.get_dept(session, u2.dept_id) if u2.dept_id else None
    return AppUserOut(
        id=u2.id,
        login_id=u2.login_id,
        display_name=u2.display_name,
        team_id=u2.team_id,
        dept_id=u2.dept_id,
        dept_code=d.dept_code if d else None,
        dept_name=d.dept_name if d else None,
        group_id=u2.group_id,
        group_name=gn,
        created_at=u2.created_at,
        last_login_at=u2.last_login_at,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    _: object = Depends(require_admin_page("admin_users", need_write=True)),
    session: AsyncSession = Depends(get_repo_session),
) -> None:
    u = await admin_repo.get_user(session, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    if _is_builtin_admin_login(u.login_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="기본 admin 계정은 비활성화할 수 없습니다.",
        )
    await admin_repo.soft_delete_user(session, user_id)
    await session.commit()
