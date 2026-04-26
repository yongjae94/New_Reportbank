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
    final_sql_text: str | None = None
    executed_db_conn_id: str | None = None
    viewable_until: str | None = None
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


class RuntimeQueryExecutePayload(BaseModel):
    sql_text: str = Field(..., min_length=1)
    target_owner: str | None = None
    target_table: str | None = None
    rows: list[dict] = Field(default_factory=list, description="Raw rows from target DB execution")
    unmask: bool = Field(default=False, description="Only allowed for info-sec approver role")


class RuntimeQueryExecuteResponse(BaseModel):
    rows: list[dict]
    row_count: int
    unmask_applied: bool


class DbConnectionUpsertPayload(BaseModel):
    conn_name: str
    db_kind: str
    host: str
    port: int
    db_name: str
    service_name: str | None = None
    username: str
    password: str
    use_yn: str = "Y"


class DbConnectionDto(BaseModel):
    db_conn_id: str
    conn_name: str
    db_kind: str
    host: str
    port: int
    db_name: str
    service_name: str | None = None
    username: str
    password_masked: str
    use_yn: str


class DbConnectionTestPayload(BaseModel):
    db_kind: str
    host: str
    port: int
    db_name: str
    service_name: str | None = None
    username: str
    password: str


class DbaExecutePayload(BaseModel):
    dba_user: str
    db_conn_id: str
    edited_sql: str
    viewable_until: str | None = None


class TestInputSubmitPayload(BaseModel):
    psr_number: str = Field(..., min_length=1)
    db_conn_id: str = Field(..., min_length=1)
    sql_text: str = Field(..., min_length=1)
    viewable_until: str | None = None


class PsrFlowDto(BaseModel):
    job_id: str
    psr_number: str
    status: str
    sql_text: str
    final_sql_text: str | None = None
    target_db_kind: str
    executed_db_conn_id: str | None = None
    snapshot_rows: list[dict] = Field(default_factory=list)
    snapshot_columns: list[str] = Field(default_factory=list)
    requested_at: str | None = None
    viewable_until: str | None = None
    access_mode: str = "잠금"


class PsrRealtimeResponse(BaseModel):
    row_count: int
    rows: list[dict]


class PsrAccessModeUpdatePayload(BaseModel):
    access_mode: str = Field(..., pattern="^(승인|잠금)$")


class PsrViewableUntilUpdatePayload(BaseModel):
    viewable_until: str | None = None


class PsrInfosecReturnPayload(BaseModel):
    return_target: str = Field(..., pattern="^(dba|author)$")
    reason: str | None = None


class PsrInfosecReturnResponse(BaseModel):
    result: str
    job_id: str
    next_status: str | None = None
