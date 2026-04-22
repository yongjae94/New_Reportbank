# Report Bank (Initial Scaffold)

XML 기반 산출 시스템을 대체하기 위한 통합 SQL 거버넌스/레포트 플랫폼의 초기 구성입니다.

## 구성

- `backend`: FastAPI + SQLAlchemy 2.0 async + SQLGlot + Casbin
- `frontend`: Next.js App Router + Tailwind v4 + shadcn 기반 UI + TanStack Table + Monaco
- `.cursor/rules`: 아키텍처/기술표준 `.mdc` 규칙

## 빠른 실행

1. 백엔드 환경파일 생성
   - `backend/.env.example` -> `backend/.env`
2. 프론트 환경파일 생성
   - `frontend/.env.local.example` -> `frontend/.env.local`
3. PowerShell 실행:

```powershell
.\scripts\run-dev.ps1
```

기본 접속:
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`
- Governance Dashboard: `http://localhost:3000/dashboard`

## 대시보드 API (팀 스코프, Casbin)

로컬 개발에서는 헤더로 사용자/팀을 전달합니다.

- `X-User-Id`: 예) `admin`
- `X-Team-Id`: 예) `platform` (`backend/casbin/rbac_policy.csv`에 매핑됨)

엔드포인트:

- `GET /api/v1/dashboard/stats`
- `GET /api/v1/dashboard/queries`
- `GET /api/v1/dashboard/meta-dictionary?keyword=...`
- `POST /api/v1/dashboard/approvals/{query_id}/decision`

## Oracle RPT 초기 DDL

- 파일: `backend/sql/000_bootstrap_rpt.sql`
- 포함:
  - `RPT.TB_RPT_WORKFLOW_JOBS`
  - `RPT.TB_RPT_REPORT_GRANTS` (TTL 검증용)
  - `RPT.TB_RPT_PII_METADATA`
  - `RPT.TB_RPT_AUDIT_LOG`
  - `RPT.TB_RPT_REPORT_MST`
  - `RPT.FN_RPT_GET_MASKED_VALUE`
  - `RPT.VW_PII_META` (초기에는 `TB_RPT_PII_METADATA` 기반)

## 백엔드 DB 연동 (APP_RPT)

`backend/.env.example`를 `backend/.env`로 복사 후 아래 항목을 환경에 맞게 수정합니다.

- `REPO_DATABASE_URL=oracle+oracledb://APP_RPT:pok1234%40@<DB_HOST>:1521/?service_name=<SERVICE_NAME>`
- `REPO_SCHEMA=RPT`
- `PII_METADATA_VIEW=RPT.VW_PII_META`
