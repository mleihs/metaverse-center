"""In-process cache configuration loaded from platform_settings.

Stores cache TTL values in module-level dict. Loaded lazily on first access,
invalidated by the admin router when settings change.
"""

from __future__ import annotations

import logging

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
        from backend.config import settings
        from supabase import create_async_client

        admin_client = await create_async_client(settings.supabase_url, settings.supabase_service_role_key)
        from backend.services.platform_settings_service import PlatformSettingsService

        _cache_ttls = await PlatformSettingsService.get_cache_ttls(admin_client)
        logger.debug("Loaded cache TTLs from platform_settings")
    except (OSError, KeyError, TypeError, ValueError):
        logger.warning("Failed to load cache TTLs from DB, using defaults")
        _cache_ttls = dict(DEFAULT_SETTINGS)


def invalidate() -> None:
    """Force reload on next access."""
    global _cache_ttls  # noqa: PLW0603
    _cache_ttls = None


def set_ttls(ttls: dict[str, int]) -> None:
    """Directly set TTL values (used after admin update)."""
    global _cache_ttls  # noqa: PLW0603
    _cache_ttls = ttls
