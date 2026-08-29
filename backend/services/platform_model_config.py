"""Cached platform model configuration from platform_settings table.

In-process cache with 5-minute TTL, following the same pattern as
platform_api_keys.py. Avoids per-request DB queries for model config.

Supports environment-aware resolution: dev keys are preferred when
``settings.environment != "production"``.
"""

from __future__ import annotations

import logging
import time

from backend.config import settings
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_cache: dict[str, str] = {}
_cache_loaded_at: float = 0.0
_CACHE_TTL = 300  # 5 minutes

# Used whenever the cache is cold — startup before `ensure_loaded`, a DB read
# that failed, or a key absent from platform_settings. These MIRROR the values
# production actually carries, so a cold cache behaves like a warm one. Any
# other rule makes the first AI call after a restart quietly different from the
# second.
#
# ⚠ Every id here must exist in OpenRouter's catalogue. Checked 2026-08-29:
# `anthropic/claude-sonnet-4-6` (default + forge) and `google/gemini-2.0-flash-001`
# (fallback + research + all four dev keys) were all gone — the Claude id had a
# HYPHEN where the catalogue has a dot (`claude-sonnet-4.6`), so it had never
# resolved at all. A dead fallback is worse than none: it only ever runs when
# the primary already failed.
#
# Verify with:
#   curl -s https://openrouter.ai/api/v1/models -H "Authorization: Bearer $KEY" \
#     | python3 -c "import json,sys; print('<id>' in {m['id'] for m in json.load(sys.stdin)['data']})"
HARDCODED_DEFAULTS: dict[str, str] = {
    "model_default": "deepseek/deepseek-v4-flash-0731",
    "model_fallback": "google/gemini-2.5-flash-lite",
    "model_research": "deepseek/deepseek-v4-flash-0731",
    "model_forge": "deepseek/deepseek-v4-pro",
    # Dev defaults — the cheap tier, matching the *_dev rows in platform_settings
    "model_default_dev": "deepseek/deepseek-v4-flash-0731",
    "model_fallback_dev": "google/gemini-2.5-flash-lite",
    "model_research_dev": "deepseek/deepseek-v4-flash-0731",
    "model_forge_dev": "deepseek/deepseek-v4-flash-0731",
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
        for row in extract_list(response):
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
