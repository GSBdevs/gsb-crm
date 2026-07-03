from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "GrupoSB CRM"
    env: str = "dev"
    # >= 32 bytes exigidos pelo HS256; troque em produção.
    secret_key: str = "dev-secret-troque-em-producao-0000000000"

    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Default de dev: SQLite local, zero infraestrutura. Produção/Docker: Postgres.
    database_url: str = "sqlite+aiosqlite:///./crm_dev.db"
    auto_create_tables: bool = True

    redis_url: str = "redis://localhost:6379/0"
    # true = workflows executam no processo da API (dev sem Redis/Celery).
    workflows_inline: bool = True

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "crm@gruposb.local"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
