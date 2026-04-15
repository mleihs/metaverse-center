"""Platform settings utilities — shared parsing for scheduler config.

Centralizes the pattern of loading settings from the platform_settings table,
parsing booleans, and decrypting encrypted values. Used by InstagramScheduler,
BlueskyScheduler, and SocialStoryService.
"""

from __future__ import annotations

import logging

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
