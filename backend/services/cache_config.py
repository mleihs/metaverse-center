"""In-process cache configuration loaded from platform_settings.

Stores cache TTL values in a module-level dict. Populated from the DB at app
startup (lifespan) and re-loaded by the admin router when a ``cache_*`` setting
changes; until the first successful load, ``get_ttl`` serves DEFAULT_SETTINGS.
"""

from __future__ import annotations

import logging

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.platform_settings_service import DEFAULT_SETTINGS

logger = logging.getLogger(__name__)

# Module-level cache of TTL values (loaded from DB on first access)
_cache_ttls: dict[str, int] | None = None


def get_ttl(key: str) -> int:
    """Get a cache TTL value. Returns default if not yet loaded from DB."""
    if _cache_ttls is not None:
        return _cache_ttls.get(key, DEFAULT_SETTINGS.get(key, 60))
    return DEFAULT_SETTINGS.get(key, 60)


async def load_ttls_from_db() -> None:
    """Load cache TTLs from platform_settings via admin client."""
    global _cache_ttls  # noqa: PLW0603
    try:
        from backend.services.platform_settings_service import PlatformSettingsService
        from backend.utils.supabase_admin_cache import get_admin_supabase_client

        admin_client = await get_admin_supabase_client()
        _cache_ttls = await PlatformSettingsService.get_cache_ttls(admin_client)
        logger.debug("Loaded cache TTLs from platform_settings")
    except (PostgrestAPIError, httpx.HTTPError, OSError, KeyError, TypeError, ValueError):
        # Non-fatal by design: the lifespan calls this at startup and a DB
        # hiccup must not prevent boot — fall back to defaults until the next
        # admin-triggered reload.
        logger.warning("Failed to load cache TTLs from DB, using defaults")
        _cache_ttls = dict(DEFAULT_SETTINGS)
