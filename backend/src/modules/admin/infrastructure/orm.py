from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from src.modules.workflow.infrastructure.orm import Base, _schema_args, _utcnow


def _fk_dept_id() -> str:
    from core.config import get_settings

    sch = get_settings().repo_schema
    if sch:
        return f"{sch}.TB_RPT_DEPT.DEPT_ID"
    return "TB_RPT_DEPT.DEPT_ID"


def _fk_perm_group_group_id() -> str:
    """Match FK target to schema-qualified metadata when REPO_SCHEMA is set (Oracle)."""
    from core.config import get_settings

    sch = get_settings().repo_schema
    if sch:
        return f"{sch}.TB_RPT_PERM_GROUP.GROUP_ID"
    return "TB_RPT_PERM_GROUP.GROUP_ID"


class DeptRow(Base):
    __tablename__ = "TB_RPT_DEPT"
    __table_args__ = _schema_args()

    id: Mapped[str] = mapped_column("DEPT_ID", String(36), primary_key=True)
    dept_code: Mapped[str] = mapped_column("DEPT_CODE", String(32), unique=True, index=True)
    dept_name: Mapped[str] = mapped_column("DEPT_NAME", String(128))
    use_yn: Mapped[str] = mapped_column("USE_YN", String(1), default="Y")
    created_at: Mapped[datetime] = mapped_column(
        "CREATED_AT", DateTime(timezone=True), default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        "UPDATED_AT", DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class PermGroupRow(Base):
    __tablename__ = "TB_RPT_PERM_GROUP"
    __table_args__ = _schema_args()

    id: Mapped[str] = mapped_column("GROUP_ID", String(36), primary_key=True)
    group_name: Mapped[str] = mapped_column("GROUP_NAME", String(128))
    description: Mapped[str | None] = mapped_column("DESCRIPTION", String(500), nullable=True)
    use_yn: Mapped[str] = mapped_column("USE_YN", String(1), default="Y")
    created_at: Mapped[datetime] = mapped_column(
        "CREATED_AT", DateTime(timezone=True), default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        "UPDATED_AT", DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class AppUserRow(Base):
    __tablename__ = "TB_RPT_APP_USER"
    __table_args__ = _schema_args()

    id: Mapped[str] = mapped_column("USER_ID", String(36), primary_key=True)
    login_id: Mapped[str] = mapped_column("LOGIN_ID", String(128), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column("PASSWORD_HASH", String(512))
    display_name: Mapped[str | None] = mapped_column("DISPLAY_NAME", String(128), nullable=True)
    team_id: Mapped[str | None] = mapped_column("TEAM_ID", String(64), nullable=True)
    dept_id: Mapped[str | None] = mapped_column(
        "DEPT_ID", String(36), ForeignKey(_fk_dept_id()), nullable=True
    )
    group_id: Mapped[str] = mapped_column(
        "GROUP_ID", String(36), ForeignKey(_fk_perm_group_group_id())
    )
    use_yn: Mapped[str] = mapped_column("USE_YN", String(1), default="Y")
    created_at: Mapped[datetime] = mapped_column(
        "CREATED_AT", DateTime(timezone=True), default=_utcnow
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        "LAST_LOGIN_AT", DateTime(timezone=True), nullable=True
    )


class PermMatrixRow(Base):
    __tablename__ = "TB_RPT_PERM_MATRIX"
    __table_args__ = _schema_args()

    group_id: Mapped[str] = mapped_column(
        "GROUP_ID",
        String(36),
        ForeignKey(_fk_perm_group_group_id()),
        primary_key=True,
    )
    page_key: Mapped[str] = mapped_column("PAGE_KEY", String(64), primary_key=True)
    can_read: Mapped[str] = mapped_column("CAN_READ", String(1), default="N")
    can_write: Mapped[str] = mapped_column("CAN_WRITE", String(1), default="N")
