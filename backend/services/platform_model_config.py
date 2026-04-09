"""Cached platform model configuration from platform_settings table.

In-process cache with 5-minute TTL, following the same pattern as
platform_api_keys.py. Avoids per-request DB queries for model config.

Supports environment-aware resolution: dev keys are preferred when
``settings.environment != "production"``.
"""

from __future__ import annotations

import logging
import time

from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_cache: dict[str, str] = {}
_cache_loaded_at: float = 0.0
_CACHE_TTL = 300  # 5 minutes

HARDCODED_DEFAULTS: dict[str, str] = {
    "model_default": "anthropic/claude-sonnet-4-6",
    "model_fallback": "google/gemini-2.0-flash-001",
    "model_research": "google/gemini-2.0-flash-001",
    "model_forge": "anthropic/claude-sonnet-4-6",
    # Dev defaults — cheap/free models for development
    "model_default_dev": "google/gemini-2.0-flash-001",
    "model_fallback_dev": "google/gemini-2.0-flash-001",
    "model_research_dev": "google/gemini-2.0-flash-001",
    "model_forge_dev": "google/gemini-2.0-flash-001",
}

_MODEL_KEYS = tuple(HARDCODED_DEFAULTS.keys())


async def _load_all(admin_supabase: Client) -> None:
    """Load model settings from platform_settings."""
    global _cache, _cache_loaded_at  # noqa: PLW0603

    try:
        response = await (
            admin_supabase.table("platform_settings")
            .select("setting_key, setting_value")
            .like("setting_key", "model_%")
            .execute()
        )
        new_cache: dict[str, str] = {}
        for row in response.data or []:
            key = row["setting_key"]
            if key not in _MODEL_KEYS:
                continue
            raw = str(row.get("setting_value", "")).strip('"')
            if raw:
                new_cache[key] = raw
        _cache = new_cache
        _cache_loaded_at = time.monotonic()
    except Exception:  # noqa: BLE001 — config loading is best-effort, fall back to in-memory cache
        logger.warning("Failed to load platform model config from DB")
        _cache_loaded_at = time.monotonic()


def get_platform_model(purpose: str) -> str:
    """Return cached model ID for the given purpose. Sync — reads from memory.

    Maps purpose strings to setting keys:
    - "forge" → model_forge
    - "research" → model_research
    - "fallback" → model_fallback
    - anything else → model_default

    In non-production environments, resolves the ``_dev`` variant first,
    falling back to the production key if the dev key is absent.
    """
    from backend.config import settings

    if purpose == "forge":
        base_key = "model_forge"
    elif purpose == "research":
        base_key = "model_research"
    elif purpose == "fallback":
        base_key = "model_fallback"
    else:
        base_key = "model_default"

    is_prod = settings.environment == "production"

    if not is_prod:
        dev_key = f"{base_key}_dev"
        dev_model = _cache.get(dev_key) or HARDCODED_DEFAULTS.get(dev_key)
        if dev_model:
            logger.debug(
                "Resolved model for %s [env=%s]: %s",
                purpose,
                settings.environment,
                dev_model,
            )
            return dev_model

    model = _cache.get(base_key) or HARDCODED_DEFAULTS[base_key]
    logger.debug(
        "Resolved model for %s [env=%s]: %s",
        purpose,
        settings.environment,
        model,
    )
    return model


async def ensure_loaded(admin_supabase: Client) -> None:
    """Load cache if stale. Called at startup + after admin saves model settings."""
    now = time.monotonic()
    if now - _cache_loaded_at > _CACHE_TTL or not _cache_loaded_at:
        await _load_all(admin_supabase)


def invalidate() -> None:
    """Clear cache — called when admin updates a model_* setting."""
    global _cache, _cache_loaded_at  # noqa: PLW0603
    _cache = {}
    _cache_loaded_at = 0.0
