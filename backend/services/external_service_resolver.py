"""External service configuration resolver per simulation."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from uuid import UUID

from backend.config import settings as platform_settings
from backend.utils.encryption import decrypt
from supabase import Client

logger = logging.getLogger(__name__)


@dataclass
class FacebookConfig:
    """Facebook Graph API configuration."""

    page_id: str
    access_token: str
    api_version: str = "v23.0"
    sync_interval_minutes: int = 60
    auto_transform: bool = False


@dataclass
class NewsConfig:
    """News API configuration (Guardian or NewsAPI)."""

    api_key: str
    source: str  # "guardian" or "newsapi"
    enabled: bool = True


@dataclass
class AIProviderConfig:
    """AI provider API key configuration."""

    openrouter_api_key: str
    replicate_api_key: str


class ExternalServiceResolver:
    """Resolves external service configurations per simulation.

    Pattern: Simulation-level override -> Platform defaults.
    Encrypted values are decrypted transparently.
    """

    def __init__(self, supabase: Client, simulation_id: UUID):
        self._supabase = supabase
        self._simulation_id = simulation_id
        self._cache: dict[str, str | None] | None = None

    async def _load_integration_settings(self) -> dict[str, str | None]:
        """Load all integration.* settings for this simulation."""
        if self._cache is not None:
            return self._cache

        response = (
            self._supabase.table("simulation_settings")
            .select("setting_key, setting_value")
            .eq("simulation_id", str(self._simulation_id))
            .like("setting_key", "integration.%")
            .execute()
        )

        self._cache = {}
        for row in response.data or []:
            self._cache[row["setting_key"]] = row["setting_value"]

        return self._cache

    def _get_decrypted(self, settings: dict[str, str | None], key: str) -> str | None:
        """Get a setting value, decrypting if it looks like a Fernet token."""
        value = settings.get(key)
        if not value or not isinstance(value, str):
            return None

        # Fernet tokens start with "gAAAAA"
        if value.startswith("gAAAAA"):
            try:
                return decrypt(value)
            except (ValueError, Exception):
                logger.warning("Failed to decrypt setting '%s'", key)
                return None

        return value

    async def get_facebook_config(self) -> FacebookConfig | None:
        """Get Facebook integration config if enabled."""
        settings = await self._load_integration_settings()

        enabled = settings.get("integration.facebook.enabled")
        if not enabled or str(enabled).lower() not in ("true", "1"):
            return None

        page_id = settings.get("integration.facebook.page_id")
        if not page_id:
            return None

        access_token = self._get_decrypted(settings, "integration.facebook.access_token")
        if not access_token:
            return None

        return FacebookConfig(
            page_id=str(page_id),
            access_token=access_token,
            api_version=str(settings.get("integration.facebook.api_version", "v23.0")),
        )

    async def get_guardian_config(self) -> NewsConfig | None:
        """Get Guardian API config if enabled."""
        settings = await self._load_integration_settings()

        enabled = settings.get("integration.guardian.enabled")
        if not enabled or str(enabled).lower() not in ("true", "1"):
            return None

        api_key = self._get_decrypted(settings, "integration.guardian.api_key")
        if not api_key:
            return None

        return NewsConfig(api_key=api_key, source="guardian")

    async def get_newsapi_config(self) -> NewsConfig | None:
        """Get NewsAPI config if enabled."""
        settings = await self._load_integration_settings()

        enabled = settings.get("integration.newsapi.enabled")
        if not enabled or str(enabled).lower() not in ("true", "1"):
            return None

        api_key = self._get_decrypted(settings, "integration.newsapi.api_key")
        if not api_key:
            return None

        return NewsConfig(api_key=api_key, source="newsapi")

    async def get_ai_provider_config(self) -> AIProviderConfig:
        """Get AI provider API keys — simulation override or platform defaults."""
        settings = await self._load_integration_settings()

        openrouter_key = self._get_decrypted(settings, "integration.openrouter.api_key")
        replicate_key = self._get_decrypted(settings, "integration.replicate.api_key")

        return AIProviderConfig(
            openrouter_api_key=openrouter_key or platform_settings.openrouter_api_key,
            replicate_api_key=replicate_key or platform_settings.replicate_api_token,
        )
