"""Cached platform research domain configuration from platform_settings table.

In-process cache with 5-minute TTL, following the same pattern as
platform_model_config.py. Avoids per-request DB queries for domain config.
"""

from __future__ import annotations

import json
import logging
import time

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_cache: dict[str, list[str]] = {}
_cache_loaded_at: float = 0.0
_CACHE_TTL = 300  # 5 minutes

HARDCODED_DEFAULTS: dict[str, list[str]] = {
    "research_domains_encyclopedic": [
        "en.wikipedia.org",
        "plato.stanford.edu",
        "britannica.com",
    ],
    "research_domains_literary": [
        "en.wikipedia.org",
        "britannica.com",
        "theparisreview.org",
    ],
    "research_domains_philosophy": [
        "plato.stanford.edu",
        "iep.utm.edu",
        "en.wikipedia.org",
    ],
    "research_domains_architecture": [
        "en.wikipedia.org",
        "dezeen.com",
        "designboom.com",
    ],
}

_AXIS_TO_KEY: dict[str, str] = {
    "encyclopedic": "research_domains_encyclopedic",
    "literary": "research_domains_literary",
    "philosophy": "research_domains_philosophy",
    "architecture": "research_domains_architecture",
}


async def _load_all(admin_supabase: Client) -> None:
    """Load research domain settings from platform_settings."""
    global _cache, _cache_loaded_at  # noqa: PLW0603

    try:
        response = await (
            admin_supabase.table("platform_settings")
            .select("setting_key, setting_value")
            .like("setting_key", "research_domains_%")
            .execute()
        )
        new_cache: dict[str, list[str]] = {}
        for row in response.data or []:
            key = row["setting_key"]
            if key not in HARDCODED_DEFAULTS:
                continue
            raw = row.get("setting_value", "")
            # Handle both pre-parsed list and JSON string return types
            if isinstance(raw, list):
                new_cache[key] = raw
            elif isinstance(raw, str):
                raw = raw.strip('"')
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        new_cache[key] = parsed
                except (json.JSONDecodeError, TypeError):
                    pass
        _cache = new_cache
        _cache_loaded_at = time.monotonic()
        logger.info(
            "Research domain cache loaded",
            extra={"cached_keys": len(new_cache)},
        )
    except (PostgrestAPIError, httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError):
        logger.warning("Failed to load research domain config from DB")
        _cache_loaded_at = time.monotonic()


def get_research_domains(axis: str) -> list[str]:
    """Return cached domain list for the given axis. Sync — reads from memory.

    Maps axis names to setting keys:
    - "encyclopedic" → research_domains_encyclopedic
    - "literary" → research_domains_literary
    - "philosophy" → research_domains_philosophy
    - "architecture" → research_domains_architecture
    """
    key = _AXIS_TO_KEY.get(axis, f"research_domains_{axis}")
    return _cache.get(key) or HARDCODED_DEFAULTS.get(key, [])


async def ensure_loaded(admin_supabase: Client) -> None:
    """Load cache if stale. Called at startup + after admin saves domain settings."""
    now = time.monotonic()
    if now - _cache_loaded_at > _CACHE_TTL or not _cache_loaded_at:
        await _load_all(admin_supabase)


def invalidate() -> None:
    """Clear cache — called when admin updates a research_domains_* setting."""
    global _cache, _cache_loaded_at  # noqa: PLW0603
    _cache = {}
    _cache_loaded_at = 0.0
