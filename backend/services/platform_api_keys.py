"""In-process cache for platform-level API key defaults.

Caches decrypted API keys from platform_settings with a 5-minute TTL.
Invalidated by the admin router when keys are updated.
"""

from __future__ import annotations

import logging
import time

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_cache: dict[str, str | None] = {}
_cache_loaded_at: float = 0.0
_CACHE_TTL = 300  # 5 minutes

_API_KEY_SETTINGS = (
    "openrouter_api_key",
    "replicate_api_key",
    "guardian_api_key",
    "newsapi_api_key",
    "tavily_api_key",
    "deepl_api_key",
)


async def _load_all(admin_supabase: Client) -> None:
    """Load and decrypt all API keys from platform_settings."""
    global _cache, _cache_loaded_at  # noqa: PLW0603

    from backend.services.platform_settings_service import PlatformSettingsService

    try:
        rows = await PlatformSettingsService.list_all(admin_supabase)
        new_cache: dict[str, str | None] = {}
        for row in rows:
            key = row["setting_key"]
            if key not in _API_KEY_SETTINGS:
                continue
            raw = str(row.get("setting_value", "")).strip('"')
            if not raw:
                new_cache[key] = None
                continue
            # Decrypt if encrypted
            if raw.startswith("gAAAAA"):
                try:
                    from backend.utils.encryption import decrypt

                    new_cache[key] = decrypt(raw)
                except (ValueError, Exception):
                    logger.warning("Failed to decrypt platform key '%s'", key)
                    new_cache[key] = None
            else:
                new_cache[key] = raw
        _cache = new_cache
        _cache_loaded_at = time.monotonic()
    except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError):
        logger.warning("Failed to load platform API keys from DB")
        _cache_loaded_at = time.monotonic()


async def get_platform_api_key(admin_supabase: Client, key: str) -> str | None:
    """Get a cached platform API key, refreshing every 5 min."""
    global _cache_loaded_at  # noqa: PLW0603

    now = time.monotonic()
    if now - _cache_loaded_at > _CACHE_TTL or not _cache_loaded_at:
        await _load_all(admin_supabase)

    return _cache.get(key)


def invalidate() -> None:
    """Clear cache — called when admin updates an API key."""
    global _cache, _cache_loaded_at  # noqa: PLW0603
    _cache = {}
    _cache_loaded_at = 0.0
