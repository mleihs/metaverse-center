"""Platform settings utilities — shared parsing for scheduler config.

Centralizes the pattern of loading settings from the platform_settings table,
parsing booleans, decrypting encrypted values, and writing updates safely.
Used across backend schedulers and services that read/write platform_settings
(social schedulers, orphan-sweeper, forge BYOK toggles, news scanner, …);
prefer these helpers over ad-hoc postgrest chains so encoding + safety
invariants live in one place.
"""

from __future__ import annotations

import logging
from uuid import UUID

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


_TRUE_STRINGS = frozenset({"true", "1", "yes", "on"})


def parse_setting_bool(value: object) -> bool:
    """Parse a platform_settings value as a boolean (fail-closed).

    Accepts:
      * Python ``bool`` — returned verbatim. postgrest unwraps jsonb
        bool to Python bool, so a migration-seeded ``'false'::jsonb``
        arrives here as Python ``False``.
      * Python ``int`` / ``float`` — stringified, matched case-
        insensitively against the TRUE set (so ``1`` → True, ``0`` /
        ``2`` / ``1.0`` → False).
      * ``str`` — lower-cased, outer whitespace + double-quotes
        trimmed, matched against ``{"true", "1", "yes", "on"}``.
        Catches both the JSON-quoted shape (``'"true"'``) the admin
        UI writes and the plain form (``"true"``).

    Everything else — ``None`` (jsonb null, missing rows),
    unrecognised strings (``"foo"``, ``"enabled"``, ``"null"``) — is
    ``False``. Flag-style settings like ``orphan_sweeper_enabled`` and
    ``instagram_posting_enabled`` MUST fail closed: an accidental null
    in a manual SQL edit or a typo that lands something non-canonical
    must not activate a dormant scheduler.

    Rationale for the fail-closed positive-match (replacing the prior
    "anything not in {false,0,no,''}" negation): the old behavior
    returned True for ``parse_setting_bool(None)``, which silently
    armed schedulers whenever postgrest handed back a jsonb null.
    Positive-match closes that gap and all its siblings ("None",
    "null", unknown strings) in one stroke.
    """
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    return str(value).strip().strip('"').lower() in _TRUE_STRINGS


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
