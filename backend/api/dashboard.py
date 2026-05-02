from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth_context import CurrentUser, get_current_user
from api.schemas import (
    ApprovalDecisionPayload,
    DashboardQueryDto,
    DashboardStatsDto,
    MetadataDictionaryRowDto,
    PiiItemDto,
)
from core.casbin_setup import enforce_team_approve, enforce_team_read
from core.database import get_repo_session
from src.modules.dashboard.application.dashboard_service import DashboardService
from src.modules.dashboard.domain.risk_policy import summarize_risk

router = APIRouter(prefix="/v1/dashboard", tags=["dashboard"])


def _casbin_subject(user: CurrentUser) -> str:
    return user.login_id or user.user_id


@router.get("/stats", response_model=DashboardStatsDto)
async def get_dashboard_stats(
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> DashboardStatsDto:
    if not enforce_team_read(_casbin_subject(user), user.team_id):
        raise HTTPException(status_code=403, detail="team_access_forbidden")
    service = DashboardService()
    stats = await service.get_team_stats(session, user.team_id)
    return DashboardStatsDto(**stats.__dict__)


@router.get("/queries", response_model=list[DashboardQueryDto])
async def list_dashboard_queries(
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> list[DashboardQueryDto]:
    if not enforce_team_read(_casbin_subject(user), user.team_id):
        raise HTTPException(status_code=403, detail="team_access_forbidden")
    service = DashboardService()
    queries = await service.list_team_queries(session, user.team_id)
    return [
        DashboardQueryDto(
            id=q.id,
            team_id=q.team_id,
            status=q.status,
            sql_preview=q.sql_text[:220],
            sql_text=q.sql_text,
            created_at=q.created_at,
            pii_items=[PiiItemDto(name=i.name, risk=i.risk) for i in q.pii_items],
            risk_level=summarize_risk(q.pii_items),
        )
        for q in queries
    ]


@router.get("/meta-dictionary", response_model=list[MetadataDictionaryRowDto])
async def get_meta_dictionary(
    keyword: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
) -> list[MetadataDictionaryRowDto]:
    if not enforce_team_read(_casbin_subject(user), user.team_id):
        raise HTTPException(status_code=403, detail="team_access_forbidden")
    service = DashboardService()
    rows = service.list_team_dictionary(team_id=user.team_id, keyword=keyword)
    return [MetadataDictionaryRowDto(**r) for r in rows]


@router.post("/approvals/{query_id}/decision")
async def decide_approval(
    query_id: str,
    body: ApprovalDecisionPayload,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, object]:
    if not enforce_team_approve(_casbin_subject(user), user.team_id):
        raise HTTPException(status_code=403, detail="approval_permission_required")
    return {
        "query_id": query_id,
        "approved": body.approved,
        "comment": body.comment,
        "reviewed_by": user.login_id or user.user_id,
        "mock_data_guard": True,
        "sample_preview": [
            {"column": "NAME", "value": "홍*동"},
            {"column": "RRN", "value": "900101-1******"},
        ],
    }
