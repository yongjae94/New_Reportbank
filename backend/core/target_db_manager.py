"""
Dynamic AsyncEngine factory for target execution databases (Oracle, SQL Server, PostgreSQL).
Pools are cached per connection key; sessions are always short-lived.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from enum import Enum
from typing import Any

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine


class TargetDbKind(str, Enum):
    ORACLE = "oracle"
    MSSQL = "mssql"
    POSTGRES = "postgres"


@dataclass(frozen=True)
class TargetDbConfig:
    kind: TargetDbKind
    host: str
    port: int
    database: str
    username: str
    password: str
    # Oracle-specific
    service_name: str | None = None

    def cache_key(self) -> str:
        payload: dict[str, Any] = {
            "kind": self.kind.value,
            "host": self.host,
            "port": self.port,
            "database": self.database,
            "username": self.username,
            "service_name": self.service_name,
        }
        return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def build_async_url(cfg: TargetDbConfig) -> str:
    if cfg.kind == TargetDbKind.ORACLE:
        service = cfg.service_name or cfg.database
        return (
            f"oracle+oracledb://{cfg.username}:{cfg.password}"
            f"@{cfg.host}:{cfg.port}/?service_name={service}"
        )
    if cfg.kind == TargetDbKind.POSTGRES:
        return (
            f"postgresql+asyncpg://{cfg.username}:{cfg.password}"
            f"@{cfg.host}:{cfg.port}/{cfg.database}"
        )
    if cfg.kind == TargetDbKind.MSSQL:
        # Requires ODBC Driver 18+ (or 17) installed on the host
        driver = "ODBC+Driver+18+for+SQL+Server"
        return (
            f"mssql+aioodbc://{cfg.username}:{cfg.password}@{cfg.host},{cfg.port}/{cfg.database}"
            f"?driver={driver}&TrustServerCertificate=yes"
        )
    raise ValueError(f"Unsupported target DB kind: {cfg.kind}")


class TargetDbManager:
    def __init__(self) -> None:
        self._engines: dict[str, AsyncEngine] = {}
        self._sessionmakers: dict[str, async_sessionmaker[AsyncSession]] = {}

    def get_engine(self, cfg: TargetDbConfig) -> AsyncEngine:
        key = cfg.cache_key()
        if key not in self._engines:
            self._engines[key] = create_async_engine(
                build_async_url(cfg),
                pool_pre_ping=True,
                future=True,
            )
            self._sessionmakers[key] = async_sessionmaker(
                self._engines[key],
                expire_on_commit=False,
                class_=AsyncSession,
            )
        return self._engines[key]

    async def session(self, cfg: TargetDbConfig) -> AsyncIterator[AsyncSession]:
        self.get_engine(cfg)
        key = cfg.cache_key()
        factory = self._sessionmakers[key]
        async with factory() as sess:
            yield sess

    async def dispose_all(self) -> None:
        for eng in self._engines.values():
            await eng.dispose()
        self._engines.clear()
        self._sessionmakers.clear()


target_db_manager = TargetDbManager()
