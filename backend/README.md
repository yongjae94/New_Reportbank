# Report Bank — Backend

FastAPI service for ITSM-driven workflow, SQL validation / PII checks, and target DB routing.

## Run (development)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e .
uvicorn main:app --reload --app-dir .
```

Set `REPO_DATABASE_URL` to Oracle (`oracle+oracledb://...`) with schema `RPT` in enterprise deployments. For local scaffolding, the default SQLite URL works without Oracle.

## Environment

See `core/config.py` for `Settings` fields (`REPO_DATABASE_URL`, `ITSM_CALLBACK_URL`, etc.).
