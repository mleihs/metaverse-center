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

    # Security
    settings_encryption_key: str = ""

    # Email
    resend_api_key: str = ""

    # App
    app_title: str = "Velgarien Platform"
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
