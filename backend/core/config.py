from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "reportbank-api"

    # Repository DB (Oracle RPT in production; SQLite allowed for local scaffold)
    repo_database_url: str = "sqlite+aiosqlite:///./reportbank_repo.db"
    repo_schema: str | None = None  # e.g. "RPT" for Oracle

    # ITSM outbound callback (stub if unset)
    itsm_callback_url: str | None = None
    itsm_callback_token: str | None = None

    # Casbin
    casbin_model_path: str = "casbin/rbac_model.conf"
    casbin_policy_path: str = "casbin/rbac_policy.csv"


@lru_cache
def get_settings() -> Settings:
    return Settings()
