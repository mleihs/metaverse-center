"""External service configuration resolver per simulation."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from uuid import UUID

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.config import settings as platform_settings
from backend.services.platform_api_keys import get_platform_api_key
from backend.utils.encryption import decrypt
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

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
class InstagramConfig:
    """Instagram Graph API configuration (platform-level)."""

    access_token: str
    ig_user_id: str
    api_version: str = "v22.0"
    posting_enabled: bool = False


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

    def __init__(
        self,
        supabase: Client,
        simulation_id: UUID,
        admin_supabase: Client | None = None,
    ):
        self._supabase = supabase
        self._simulation_id = simulation_id
        self._admin_supabase = admin_supabase
        self._cache: dict[str, str | None] | None = None

    async def _get_admin_client(self) -> Client | None:
        """Get admin client for platform key lookups, creating lazily if needed."""
        if self._admin_supabase:
            return self._admin_supabase
        try:
            from supabase import create_async_client

            self._admin_supabase = await create_async_client(
                platform_settings.supabase_url,
                platform_settings.supabase_service_role_key,
            )
            return self._admin_supabase
        except (PostgrestAPIError, httpx.HTTPError, OSError):
            logger.debug("Could not create admin client for platform key lookup")
            return None

    async def _load_integration_settings(self) -> dict[str, str | None]:
        """Load all integration category settings for this simulation."""
        if self._cache is not None:
            return self._cache

        response = await (
            self._supabase.table("simulation_settings")
            .select("setting_key, setting_value")
            .eq("simulation_id", str(self._simulation_id))
            .eq("category", "integration")
            .execute()
        )

        self._cache = {}
        for row in extract_list(response):
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

        enabled = settings.get("facebook_enabled")
        if not enabled or str(enabled).lower() not in ("true", "1"):
            return None

        page_id = settings.get("facebook_page_id")
        if not page_id:
            return None

        access_token = self._get_decrypted(settings, "facebook_access_token")
        if not access_token:
            return None

        return FacebookConfig(
            page_id=str(page_id),
            access_token=access_token,
            api_version=str(settings.get("facebook_api_version", "v23.0")),
        )

    async def get_guardian_config(self) -> NewsConfig | None:
        """Get Guardian API config if enabled.

        Fallback: sim-level enabled+key -> platform_settings key -> None.
        If no sim-level setting exists, still check platform-level key.
        """
        settings = await self._load_integration_settings()

        enabled = settings.get("guardian_enabled")
        if enabled is not None and str(enabled).lower() not in ("true", "1"):
            # Explicitly disabled at simulation level
            return None

        api_key = self._get_decrypted(settings, "guardian_api_key")
        admin = await self._get_admin_client()
        if not api_key and admin:
            api_key = await get_platform_api_key(admin, "guardian_api_key")
        if not api_key:
            return None

        return NewsConfig(api_key=api_key, source="guardian")

    async def get_newsapi_config(self) -> NewsConfig | None:
        """Get NewsAPI config if enabled.

        Fallback: sim-level enabled+key -> platform_settings key -> None.
        If no sim-level setting exists, still check platform-level key.
        """
        settings = await self._load_integration_settings()

        enabled = settings.get("newsapi_enabled")
        if enabled is not None and str(enabled).lower() not in ("true", "1"):
            # Explicitly disabled at simulation level
            return None

        api_key = self._get_decrypted(settings, "newsapi_api_key")
        admin = await self._get_admin_client()
        if not api_key and admin:
            api_key = await get_platform_api_key(admin, "newsapi_api_key")
        if not api_key:
            return None

        return NewsConfig(api_key=api_key, source="newsapi")

    async def get_ai_provider_config(self) -> AIProviderConfig:
        """Get AI provider API keys.

        Fallback chain: sim-level override -> platform_settings -> .env.
        """
        settings = await self._load_integration_settings()

        openrouter_key = self._get_decrypted(settings, "openrouter_api_key")
        replicate_key = self._get_decrypted(settings, "replicate_api_key")

        # Platform settings fallback (before .env)
        admin = await self._get_admin_client()
        if not openrouter_key and admin:
            openrouter_key = await get_platform_api_key(admin, "openrouter_api_key")
        if not replicate_key and admin:
            replicate_key = await get_platform_api_key(admin, "replicate_api_key")

        return AIProviderConfig(
            openrouter_api_key=openrouter_key or platform_settings.openrouter_api_key,
            replicate_api_key=replicate_key or platform_settings.replicate_api_token,
        )
