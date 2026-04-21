"""Platform settings utilities — shared parsing for scheduler config.

Centralizes the pattern of loading settings from the platform_settings table,
parsing booleans, decrypting encrypted values, and writing updates safely.
Used by InstagramScheduler, BlueskyScheduler, SocialStoryService, and the
orphan-sweeper scheduler.
"""

from __future__ import annotations

import logging
from uuid import UUID

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


def parse_setting_bool(value: str) -> bool:
    """Parse a platform_settings string as a boolean.

    Handles quoted values from JSON storage (e.g. '"true"').
    """
    return str(value).lower().strip('"') not in ("false", "0", "no", "")


def decrypt_setting(raw: str) -> str:
    """Decrypt an encrypted platform_settings value.

    Returns the decrypted string, or empty string on failure.
    Values with the ``gAAAAA`` prefix are Fernet-encrypted.
    """
    if not raw or not raw.startswith("gAAAAA"):
        return str(raw).strip().strip('"') if raw else ""

    try:
        from backend.utils.encryption import decrypt

        return decrypt(raw)
    except Exception:
        logger.warning("Failed to decrypt platform setting", exc_info=True)
        return ""


async def load_platform_settings(
    admin: Client,
    keys: list[str],
) -> dict[str, str]:
    """Load platform_settings rows into a flat ``{key: value}`` dict.

    Returns raw string values — callers parse with ``parse_setting_bool``,
    ``decrypt_setting``, ``json.loads``, etc. as needed.
    """
    settings_map: dict[str, str] = {}
    try:
        resp = await (
            admin.table("platform_settings")
            .select("setting_key, setting_value")
            .in_("setting_key", keys)
            .execute()
        )
        for row in extract_list(resp):
            settings_map[row["setting_key"]] = row["setting_value"]
    except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
        logger.warning("Failed to load platform settings for keys %s", keys, exc_info=True)

    return settings_map


async def upsert_platform_setting(
    admin: Client,
    key: str,
    value: object,
    *,
    updated_by_id: UUID | str | None = None,
) -> None:
    """Upsert a single ``platform_settings`` row by key.

    Replaces the ``.update({"setting_value": ...}).eq("setting_key", key)``
    pattern that silently no-ops when the row is absent (fresh DB,
    migration-lag window, or a key that was never seeded). The
    ``platform_settings`` table declares ``UNIQUE(setting_key)`` so
    ``ON CONFLICT (setting_key) DO UPDATE`` resolves cleanly.

    ``value`` is passed verbatim to postgrest — callers that want a
    JSON-string shape (``json.dumps(False)``) continue to encode
    themselves; this helper does not second-guess the stored jsonb shape.
    """
    row: dict[str, object] = {
        "setting_key": key,
        "setting_value": value,
    }
    if updated_by_id is not None:
        row["updated_by_id"] = str(updated_by_id)
    await (
        admin.table("platform_settings")
        .upsert(row, on_conflict="setting_key")
        .execute()
    )
