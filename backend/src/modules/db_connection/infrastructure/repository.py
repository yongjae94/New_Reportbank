from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class DbConnectionRepository:
    async def list_connections(self, session: AsyncSession) -> list[dict[str, Any]]:
        rows = await session.execute(
            text(
                """
                SELECT DB_CONN_ID, CONN_NAME, DB_KIND, HOST, PORT, DB_NAME, SERVICE_NAME, USERNAME,
                       PASSWORD_ENC, USE_YN, CREATED_AT, UPDATED_AT
                FROM RPT.TB_RPT_DB_CONN
                ORDER BY UPDATED_AT DESC
                """
            )
        )
        out: list[dict[str, Any]] = []
        for r in rows.mappings().all():
            item = dict(r)
            pwd = str(item.get("PASSWORD_ENC") or "")
            item["PASSWORD_MASKED"] = "********" if pwd else ""
            out.append(item)
        return out

    async def get_connection_secret(self, session: AsyncSession, db_conn_id: str) -> dict[str, Any] | None:
        rows = await session.execute(
            text(
                """
                SELECT DB_CONN_ID, CONN_NAME, DB_KIND, HOST, PORT, DB_NAME, SERVICE_NAME, USERNAME, PASSWORD_ENC, USE_YN
                FROM RPT.TB_RPT_DB_CONN
                WHERE DB_CONN_ID = :db_conn_id
                """
            ),
            {"db_conn_id": db_conn_id},
        )
        row = rows.mappings().first()
        return dict(row) if row else None

    async def create_connection(self, session: AsyncSession, payload: dict[str, Any]) -> str:
        db_conn_id = str(uuid.uuid4())
        await session.execute(
            text(
                """
                INSERT INTO RPT.TB_RPT_DB_CONN (
                    DB_CONN_ID, CONN_NAME, DB_KIND, HOST, PORT, DB_NAME, SERVICE_NAME,
                    USERNAME, PASSWORD_ENC, USE_YN, CREATED_AT, UPDATED_AT
                ) VALUES (
                    :db_conn_id, :conn_name, :db_kind, :host, :port, :db_name, :service_name,
                    :username, :password_enc, :use_yn, SYSTIMESTAMP, SYSTIMESTAMP
                )
                """
            ),
            {**payload, "db_conn_id": db_conn_id},
        )
        await session.commit()
        return db_conn_id

    async def update_connection(self, session: AsyncSession, db_conn_id: str, payload: dict[str, Any]) -> None:
        await session.execute(
            text(
                """
                UPDATE RPT.TB_RPT_DB_CONN
                SET CONN_NAME=:conn_name,
                    DB_KIND=:db_kind,
                    HOST=:host,
                    PORT=:port,
                    DB_NAME=:db_name,
                    SERVICE_NAME=:service_name,
                    USERNAME=:username,
                    PASSWORD_ENC=:password_enc,
                    USE_YN=:use_yn,
                    UPDATED_AT=SYSTIMESTAMP
                WHERE DB_CONN_ID=:db_conn_id
                """
            ),
            {**payload, "db_conn_id": db_conn_id},
        )
        await session.commit()

    async def delete_connection(self, session: AsyncSession, db_conn_id: str) -> None:
        await session.execute(
            text("DELETE FROM RPT.TB_RPT_DB_CONN WHERE DB_CONN_ID=:db_conn_id"),
            {"db_conn_id": db_conn_id},
        )
        await session.commit()
