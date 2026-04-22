from enum import StrEnum


class WorkflowStatus(StrEnum):
    REGISTERED = "registered"
    PII_CHECKED = "pii_checked"
    AWAITING_DBA = "awaiting_dba"
    AWAITING_INFOSEC = "awaiting_infosec"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"
    FAILED = "failed"
