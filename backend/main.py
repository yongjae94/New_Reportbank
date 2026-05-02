from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import (
    admin_management,
    auth_login,
    dashboard,
    db_connections,
    itsm_webhook,
    psr_flow,
    runtime_query,
    security_policy,
    test_input,
    workflow_admin,
)
from core.config import get_settings
from core.database import AsyncSessionFactory, engine
from core.target_db_manager import target_db_manager
from src.modules.admin.application import bootstrap_admin
from src.modules.admin.infrastructure.orm import (  # noqa: F401
    AppUserRow,
    DeptRow,
    PermGroupRow,
    PermMatrixRow,
)
from src.modules.workflow.infrastructure.orm import Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _repo_uses_sqlite() -> bool:
    """Oracle 등 운영 DB는 DDL 스크립트로 스키마를 두고, 로컬 SQLite만 create_all 한다."""
    return "sqlite" in get_settings().repo_database_url.lower()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if _repo_uses_sqlite():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    else:
        logger.info(
            "레파지토리가 SQLite가 아니므로 create_all 을 건너뜁니다. "
            "Oracle이면 backend/sql/*.sql DDL을 스키마 소유자로 적용하고 앱 계정에 DML 권한을 부여하세요."
        )
    try:
        async with AsyncSessionFactory() as session:
            await bootstrap_admin.seed_admin_defaults_if_empty(session)
            await session.commit()
    except Exception:
        logger.exception("기본 관리자 시드에 실패했습니다. DDL(015) 적용 여부를 확인하세요.")
    yield
    await target_db_manager.dispose_all()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(itsm_webhook.router, prefix="/api")
    app.include_router(workflow_admin.router, prefix="/api")
    app.include_router(dashboard.router, prefix="/api")
    app.include_router(runtime_query.router, prefix="/api")
    app.include_router(db_connections.router, prefix="/api")
    app.include_router(test_input.router, prefix="/api")
    app.include_router(psr_flow.router, prefix="/api")
    app.include_router(security_policy.router, prefix="/api")
    app.include_router(auth_login.router, prefix="/api")
    app.include_router(admin_management.router, prefix="/api")

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
