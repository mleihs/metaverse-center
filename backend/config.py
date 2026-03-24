from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase
    supabase_url: str = "http://localhost:54321"
    supabase_anon_key: str = ""
    supabase_service_role_key: str = Field(default="", alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_jwt_secret: str = ""

    # AI
    openrouter_api_key: str = ""
    replicate_api_token: str = ""
    tavily_api_key: str = ""
    forge_mock_mode: bool = False

    # Translation
    translation_backend: str = "claude"  # "claude" or "deepl"
    deepl_api_key: str = ""

    # Security
    settings_encryption_key: str = ""

    # Email (SMTP)
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "metaverse.center <info@metaverse.center>"

    # Email (legacy — Resend API, deprecated)
    resend_api_key: str = ""

    # Platform admin
    platform_admin_emails: str = Field(default="", alias="PLATFORM_ADMIN_EMAILS")
    indexnow_key: str = ""

    # Environment — reads RAILWAY_ENVIRONMENT on Railway, defaults to "development" locally
    environment: str = Field(default="development", alias="RAILWAY_ENVIRONMENT")

    # Sentry
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.1

    @property
    def sentry_environment(self) -> str:
        return self.environment

    # Logging
    log_level: str = "INFO"
    log_format: str = "auto"  # "auto" | "json" | "console"

    # App
    app_title: str = "Velgarien Platform"
    site_url: str = Field(default="https://metaverse.center", alias="SITE_URL")
    debug: bool = False
    cors_origins: str = Field(default="http://localhost:5173", alias="BACKEND_CORS_ORIGINS")

    @model_validator(mode="after")
    def _validate_required_config(self) -> "Settings":
        if not self.supabase_url:
            raise ValueError("supabase_url must not be empty")
        if not self.supabase_anon_key:
            raise ValueError("supabase_anon_key must not be empty")
        return self


settings = Settings()
