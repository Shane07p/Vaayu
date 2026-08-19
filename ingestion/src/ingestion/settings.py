"""Configuration read from the environment.

A key that is absent or blank puts that source in fixture mode. See
``ingestion.source.Source`` for what that means.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://vaayu:vaayu@localhost:5432/vaayu"

    data_gov_in_api_key: str | None = None
    openaq_api_key: str | None = None
    firms_map_key: str | None = None
    gemini_api_key: str | None = None
    gee_service_account_key: str | None = None


settings = Settings()
