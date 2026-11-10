from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Re:World"
    debug: bool = True

    database_url: str = "sqlite:///./reworld.db"

    google_api_key: str = ""
    # Credentials belong in .env (or the process environment), never in source.
    gemini_api_key: str = ""
    # Standard Gemini model for story generation and agentic reasoning.
    llm_model: str = "gemini-3.8-flash"



    cors_origins: str = "*"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
