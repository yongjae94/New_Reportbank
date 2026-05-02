from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_settings
from src.modules.security.domain.models import AuditLogEntry


class SecurityRepository:
    """
    SQL-based DAO skeleton for Oracle RPT security objects.
    - PII metadata source is extensible via `pii_metadata_view` setting.
    - Falls back to TB_RPT_PII_METADATA when enterprise meta view is not available.
    """

    async def fetch_pii_metadata(
        self,
        session: AsyncSession,
        *,
        owner: str | None,
        table_name: str | None,
    ) -> list[Mapping[str, Any]]:
        settings = get_settings()
        view_name = settings.pii_metadata_view

        if session.bind and session.bind.dialect.name == "sqlite":
            return []

        if owner and table_name:
            sql = text(
                f"""
                SELECT OWNER, TABLE_NAME, COLUMN_NAME, COALESCE(PII_TYPE, 'CUSTOM') AS MASKING_TYPE
                FROM {view_name}
                WHERE UPPER(OWNER) = UPPER(:owner)
                  AND UPPER(TABLE_NAME) = UPPER(:table_name)
                """
            )
            try:
                result = await session.execute(sql, {"owner": owner, "table_name": table_name})
                return [dict(r) for r in result.mappings().all()]
            except Exception:
                # fallback to managed table for local/transition environments
                pass

        fallback_sql = text(
            """
            SELECT TARGET_OWNER AS OWNER,
                   TARGET_TABLE AS TABLE_NAME,
                   TARGET_COLUMN AS COLUMN_NAME,
                   MASKING_TYPE
            FROM RPT.TB_RPT_PII_METADATA
            WHERE USE_YN = 'Y'
              AND (:owner IS NULL OR UPPER(TARGET_OWNER) = UPPER(:owner))
              AND (:table_name IS NULL OR UPPER(TARGET_TABLE) = UPPER(:table_name))
            """
        )
        result = await session.execute(fallback_sql, {"owner": owner, "table_name": table_name})
        return [dict(r) for r in result.mappings().all()]

    async def insert_audit_log(self, session: AsyncSession, entry: AuditLogEntry) -> None:
        sql = text(
            """
            INSERT INTO RPT.TB_RPT_AUDIT_LOG (
                AUDIT_ID, USER_ID, TEAM_ID, ACTION_TYPE, TARGET_TYPE, TARGET_ID,
                REQUESTED_SQL, ROW_COUNT, USED_UNMASK, ACCESSED_AT, CLIENT_IP
            ) VALUES (
                :audit_id, :user_id, :team_id, :action_type, :target_type, :target_id,
                :requested_sql, :row_count, :used_unmask, :accessed_at, :client_ip
            )
            """
        )
        await session.execute(
            sql,
            {
                "audit_id": entry.audit_id,
                "user_id": entry.user_id,
                "team_id": entry.team_id,
                "action_type": entry.action_type,
                "target_type": entry.target_type,
                "target_id": entry.target_id,
                "requested_sql": entry.requested_sql,
                "row_count": entry.row_count,
                "used_unmask": "Y" if entry.used_unmask else "N",
                "accessed_at": entry.accessed_at,
                "client_ip": entry.client_ip,
            },
        )
        await session.commit()

    async def list_mask_policies(self, session: AsyncSession) -> list[dict[str, Any]]:
        sql = text(
            """
            SELECT POLICY_ID, POLICY_NAME, TRANSFORM_KEY, USE_YN
            FROM RPT.TB_RPT_MASK_POLICY
            ORDER BY POLICY_NAME
            """
        )
        res = await session.execute(sql)
        return [dict(r) for r in res.mappings().all()]

    async def create_mask_policy(
        self,
        session: AsyncSession,
        *,
        policy_name: str,
        transform_key: str,
        use_yn: str,
    ) -> dict[str, Any]:
        sql = text(
            """
            INSERT INTO RPT.TB_RPT_MASK_POLICY (POLICY_ID, POLICY_NAME, TRANSFORM_KEY, USE_YN)
            VALUES (SYS_GUID(), :policy_name, :transform_key, :use_yn)
            """
        )
        await session.execute(
            sql,
            {"policy_name": policy_name, "transform_key": transform_key, "use_yn": use_yn},
        )
        await session.commit()
        rows = await self.list_mask_policies(session)
        for row in rows:
            if str(row.get("POLICY_NAME")) == policy_name and str(row.get("TRANSFORM_KEY")) == transform_key:
                return row
        return {"POLICY_ID": "", "POLICY_NAME": policy_name, "TRANSFORM_KEY": transform_key, "USE_YN": use_yn}

    async def update_mask_policy(
        self,
        session: AsyncSession,
        *,
        policy_id: str,
        policy_name: str,
        transform_key: str,
        use_yn: str,
    ) -> dict[str, Any] | None:
        sql = text(
            """
            UPDATE RPT.TB_RPT_MASK_POLICY
               SET POLICY_NAME = :policy_name,
                   TRANSFORM_KEY = :transform_key,
                   USE_YN = :use_yn
             WHERE POLICY_ID = :policy_id
            """
        )
        await session.execute(
            sql,
            {
                "policy_id": policy_id,
                "policy_name": policy_name,
                "transform_key": transform_key,
                "use_yn": use_yn,
            },
        )
        await session.commit()
        rows = await self.list_mask_policies(session)
        for row in rows:
            if str(row.get("POLICY_ID")) == policy_id:
                return row
        return None
