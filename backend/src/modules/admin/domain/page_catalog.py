from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PageDef:
    key: str
    label: str


# Keys are stable API identifiers; labels are UI copy (Korean).
PAGE_CATALOG: tuple[PageDef, ...] = (
    PageDef("dashboard", "대시보드 홈"),
    PageDef("psr_outputs", "PSR 산출"),
    PageDef("team_reports", "팀별 레포트"),
    PageDef("infosec_approvals", "승인 관리함"),
    PageDef("infosec_masking_policy", "마스킹 정책"),
    PageDef("admin_security_settings", "보안 설정"),
    PageDef("admin_users", "사용자 관리"),
    PageDef("admin_departments", "부서 관리"),
    PageDef("admin_permissions", "권한 관리"),
    PageDef("dba_approvals", "DBA 승인함"),
    PageDef("dba_db_connections", "DB Connection 관리"),
    PageDef("dba_test_input", "테스트 입력"),
)

# 사이드바(공통 → 정보보호 → 관리자 → DBA)와 동일한 순서로 권한 매트릭스 정렬에 사용
_CATALOG_ORDER: dict[str, int] = {p.key: i for i, p in enumerate(PAGE_CATALOG)}


def page_key_catalog_sort_key(page_key: str) -> tuple[int, str]:
    """PAGE_CATALOG 순서, 미등록 키는 맨 뒤(동률 시 page_key)."""
    return (_CATALOG_ORDER.get(page_key, len(PAGE_CATALOG)), page_key)


def all_page_keys() -> list[str]:
    return [p.key for p in PAGE_CATALOG]


def is_allowed_page_key(key: str) -> bool:
    return key in set(all_page_keys())
