from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth_context import CurrentUser, get_current_user
from api.schemas import MaskPolicyDto, MaskPolicyUpsertPayload
from core.database import get_repo_session
from src.modules.security.infrastructure.security_repository import SecurityRepository

router = APIRouter(prefix="/v1/security", tags=["security-policy"])


def _to_dto(row: dict) -> MaskPolicyDto:
    return MaskPolicyDto(
        policy_id=str(row.get("POLICY_ID") or row.get("policy_id") or ""),
        policy_name=str(row.get("POLICY_NAME") or row.get("policy_name") or ""),
        transform_key=str(row.get("TRANSFORM_KEY") or row.get("transform_key") or ""),
        use_yn=str(row.get("USE_YN") or row.get("use_yn") or "Y"),
    )


@router.get("/mask-policies", response_model=list[MaskPolicyDto])
async def list_mask_policies(
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> list[MaskPolicyDto]:
    repo = SecurityRepository()
    rows = await repo.list_mask_policies(session)
    return [_to_dto(row) for row in rows]


@router.post("/mask-policies", response_model=MaskPolicyDto)
async def create_mask_policy(
    body: MaskPolicyUpsertPayload,
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> MaskPolicyDto:
    repo = SecurityRepository()
    row = await repo.create_mask_policy(
        session,
        policy_name=body.policy_name,
        transform_key=body.transform_key,
        use_yn=body.use_yn,
    )
    return _to_dto(row)


@router.put("/mask-policies/{policy_id}", response_model=MaskPolicyDto)
async def update_mask_policy(
    policy_id: str,
    body: MaskPolicyUpsertPayload,
    session: AsyncSession = Depends(get_repo_session),
    user: CurrentUser = Depends(get_current_user),
) -> MaskPolicyDto:
    repo = SecurityRepository()
    row = await repo.update_mask_policy(
        session,
        policy_id=policy_id,
        policy_name=body.policy_name,
        transform_key=body.transform_key,
        use_yn=body.use_yn,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="mask_policy_not_found")
    return _to_dto(row)
