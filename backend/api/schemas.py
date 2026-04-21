from pydantic import BaseModel, Field


class ItsmWebhookPayload(BaseModel):
    psr_number: str = Field(..., min_length=1)
    sql_text: str = Field(..., min_length=1)
    target_db_kind: str = Field(default="oracle", description="oracle | mssql | postgres")


class DbaApprovePayload(BaseModel):
    dba_user: str = Field(..., min_length=1)


class DbaRejectPayload(BaseModel):
    dba_user: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=1)


class JobCreatedResponse(BaseModel):
    job_id: str


class WorkflowJobDto(BaseModel):
    id: str
    psr_number: str
    status: str
    sql_text: str
    target_db_kind: str
    pii_summary: dict
    performance_notes: str | None


class DashboardStatsDto(BaseModel):
    total_requests: int
    pending_approvals: int
    pii_detected_count: int
    high_risk_count: int


class PiiItemDto(BaseModel):
    name: str
    risk: str


class DashboardQueryDto(BaseModel):
    id: str
    team_id: str
    status: str
    sql_preview: str
    sql_text: str
    created_at: str
    pii_items: list[PiiItemDto]
    risk_level: str


class MetadataDictionaryRowDto(BaseModel):
    owner: str
    table_name: str
    column_name: str
    pii_type: str
    risk_level: str


class ApprovalDecisionPayload(BaseModel):
    approved: bool
    comment: str | None = None
