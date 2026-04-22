from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth_context import CurrentUser, get_current_user
from api.schemas import (
    DbConnectionDto,
    DbConnectionTestPayload,
    DbConnectionUpsertPayload,
)
from core.database import get_repo_session
from core.target_db_manager import TargetDbConfig, TargetDbKind, target_db_manager
from src.modules.db_connection.infrastructure.repository import DbConnectionRepository

router = APIRouter(prefix="/v1/db-connections", tags=["db-connections"])


def _require_dba(user: CurrentUser) -> None:
    if user.role.upper() != "DBA":
        raise HTTPException(status_code=403, detail="dba_role_required")


@router.get("", response_model=list[DbConnectionDto])
async def list_connections(
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> list[DbConnectionDto]:
    _require_dba(user)
    repo = DbConnectionRepository()
    rows = await repo.list_connections(session)
    return [
        DbConnectionDto(
            db_conn_id=str(_pick(r, "DB_CONN_ID")),
            conn_name=str(_pick(r, "CONN_NAME")),
            db_kind=str(_pick(r, "DB_KIND")),
            host=str(_pick(r, "HOST")),
            port=int(_pick(r, "PORT")),
            db_name=str(_pick(r, "DB_NAME")),
            service_name=str(_pick(r, "SERVICE_NAME", default="")) or None,
            username=str(_pick(r, "USERNAME")),
            password_masked=str(_pick(r, "PASSWORD_MASKED", default="")),
            use_yn=str(_pick(r, "USE_YN", default="Y")),
        )
        for r in rows
    ]


@router.post("")
async def create_connection(
    body: DbConnectionUpsertPayload,
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    _require_dba(user)
    repo = DbConnectionRepository()
    db_conn_id = await repo.create_connection(
        session,
        {
            "conn_name": body.conn_name,
            "db_kind": body.db_kind,
            "host": body.host,
            "port": body.port,
            "db_name": body.db_name,
            "service_name": body.service_name,
            "username": body.username,
            "password_enc": body.password,
            "use_yn": body.use_yn,
        },
    )
    return {"db_conn_id": db_conn_id}


@router.put("/{db_conn_id}")
async def update_connection(
    db_conn_id: str,
    body: DbConnectionUpsertPayload,
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    _require_dba(user)
    repo = DbConnectionRepository()
    await repo.update_connection(
        session,
        db_conn_id,
        {
            "conn_name": body.conn_name,
            "db_kind": body.db_kind,
            "host": body.host,
            "port": body.port,
            "db_name": body.db_name,
            "service_name": body.service_name,
            "username": body.username,
            "password_enc": body.password,
            "use_yn": body.use_yn,
        },
    )
    return {"status": "updated"}


@router.delete("/{db_conn_id}")
async def delete_connection(
    db_conn_id: str,
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    _require_dba(user)
    repo = DbConnectionRepository()
    await repo.delete_connection(session, db_conn_id)
    return {"status": "deleted"}


@router.post("/test")
async def test_connection(
    body: DbConnectionTestPayload,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    _require_dba(user)
    kind = TargetDbKind(body.db_kind.lower())
    cfg = TargetDbConfig(
        kind=kind,
        host=body.host,
        port=body.port,
        database=body.db_name,
        service_name=body.service_name,
        username=body.username,
        password=body.password,
    )
    try:
        async for sess in target_db_manager.session(cfg):
            await sess.execute(text("SELECT 1 FROM DUAL" if kind == TargetDbKind.ORACLE else "SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"connection_test_failed:{exc}") from exc


@router.post("/{db_conn_id}/test")
async def test_saved_connection(
    db_conn_id: str,
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    _require_dba(user)
    repo = DbConnectionRepository()
    row = await repo.get_connection_secret(session, db_conn_id)
    if not row:
        raise HTTPException(status_code=404, detail="db_connection_not_found")
    try:
        kind = TargetDbKind(str(_pick(row, "DB_KIND")).lower())
        cfg = TargetDbConfig(
            kind=kind,
            host=str(_pick(row, "HOST")),
            port=int(_pick(row, "PORT")),
            database=str(_pick(row, "DB_NAME")),
            service_name=str(_pick(row, "SERVICE_NAME", default="")) or None,
            username=str(_pick(row, "USERNAME")),
            password=str(_pick(row, "PASSWORD_ENC")),
        )
        async for sess in target_db_manager.session(cfg):
            await sess.execute(text("SELECT 1 FROM DUAL" if kind == TargetDbKind.ORACLE else "SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"connection_test_failed:{exc}") from exc


def _pick(row: dict, key: str, default: object | None = None) -> object | None:
    if key in row:
        return row[key]
    lower = key.lower()
    if lower in row:
        return row[lower]
    upper = key.upper()
    if upper in row:
        return row[upper]
    return default
