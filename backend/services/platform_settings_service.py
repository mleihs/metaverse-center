"""Service for platform-level settings (cache TTLs, dungeon global config, etc.).

Uses admin (service_role) client — platform_settings has RLS enabled with no
anon/authenticated policies, so only service_role can read/write.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import TypedDict
from uuid import UUID

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.models.settings import is_sensitive_key
from backend.utils.encryption import decrypt, mask
from backend.utils.errors import not_found, server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Default cache TTL values (used as fallback before DB is queried)
DEFAULT_SETTINGS: dict[str, int] = {
    "cache_map_data_ttl": 15,
    "cache_seo_metadata_ttl": 300,
    "cache_http_simulations_max_age": 60,
    "cache_http_map_data_max_age": 15,
    "cache_http_battle_feed_max_age": 10,
    "cache_http_connections_max_age": 60,
}


class PlatformSettingsService:
    """CRUD for platform_settings table (admin-only)."""

    table_name = "platform_settings"

    @classmethod
    async def list_all(
        cls,
        admin_supabase: Client,
        *,
        mask_sensitive: bool = False,
    ) -> list[dict]:
        """Fetch all platform settings.

        When mask_sensitive=True, sensitive keys show masked values (for admin UI).
        """
        response = await admin_supabase.table(cls.table_name).select("*").order("setting_key").execute()
        rows = extract_list(response)
        if not mask_sensitive:
            return rows

        for row in rows:
            key = row.get("setting_key", "")
            if not is_sensitive_key(key):
                continue
            raw = str(row.get("setting_value", "")).strip('"')
            if not raw:
                row["setting_value"] = ""
                continue
            # Decrypt if encrypted, then mask
            if raw.startswith("gAAAAA"):
                try:
                    decrypted = decrypt(raw)
                    row["setting_value"] = mask(decrypted)
                except (ValueError, Exception):
                    row["setting_value"] = "***"
            else:
                row["setting_value"] = mask(raw)
        return rows

    @classmethod
    async def get(cls, admin_supabase: Client, key: str) -> dict:
        """Fetch a single platform setting by key."""
        response = await admin_supabase.table(cls.table_name).select("*").eq("setting_key", key).limit(1).execute()
        if not response.data:
            raise not_found(detail=f"Platform setting '{key}' not found.")
        return response.data[0]

    @classmethod
    async def update(
        cls,
        admin_supabase: Client,
        key: str,
        value: str | int | float,
        user_id: UUID,
    ) -> dict:
        """Update or create a platform setting value."""
        now = datetime.now(UTC).isoformat()
        response = await (
            admin_supabase.table(cls.table_name)
            .upsert(
                {
                    "setting_key": key,
                    "setting_value": str(value),
                    "updated_by_id": str(user_id),
                    "updated_at": now,
                },
                on_conflict="setting_key",
            )
            .execute()
        )
        if not response.data:
            raise server_error(f"Failed to save platform setting '{key}'.")
        return response.data[0]

    @classmethod
    async def get_cache_ttls(cls, admin_supabase: Client) -> dict[str, int]:
        """Load all cache TTL values as a dict. Returns defaults on error."""
        try:
            rows = await cls.list_all(admin_supabase)
            result = dict(DEFAULT_SETTINGS)
            for row in rows:
                key = row["setting_key"]
                if key in result:
                    try:
                        result[key] = int(row["setting_value"])
                    except (ValueError, TypeError):
                        pass
            return result
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError):
            logger.warning("Failed to load platform settings, using defaults")
            return dict(DEFAULT_SETTINGS)

    # ── Dungeon Global Config ──────────────────────────────────────────

    # Platform-settings keys for global dungeon configuration.
    _DG_MODE = "dungeon_global_mode"
    _DG_ARCHETYPES = "dungeon_global_archetypes"
    _DG_CLEARANCE_MODE = "dungeon_clearance_mode"
    _DG_CLEARANCE_THRESHOLD = "dungeon_clearance_threshold"

    @classmethod
    def _parse_dungeon_global(cls, by_key: dict[str, str]) -> DungeonGlobalConfig:
        """Parse raw platform_settings key-value pairs into typed config."""
        archetypes_raw = by_key.get(cls._DG_ARCHETYPES, "[]")
        try:
            archetypes = json.loads(archetypes_raw) if isinstance(archetypes_raw, str) else archetypes_raw
        except (json.JSONDecodeError, TypeError):
            archetypes = []

        threshold_raw = by_key.get(cls._DG_CLEARANCE_THRESHOLD, "10")
        try:
            threshold = int(threshold_raw)
        except (ValueError, TypeError):
            threshold = 10

        mode = by_key.get(cls._DG_MODE, "off")
        if mode not in ("off", "supplement", "override"):
            mode = "off"

        clearance = by_key.get(cls._DG_CLEARANCE_MODE, "standard")
        if clearance not in ("off", "standard", "custom"):
            clearance = "standard"

        return DungeonGlobalConfig(
            override_mode=mode,
            override_archetypes=archetypes if isinstance(archetypes, list) else [],
            clearance_mode=clearance,
            clearance_threshold=threshold,
        )

    @classmethod
    async def get_dungeon_global_config(
        cls,
        admin_supabase: Client,
    ) -> DungeonGlobalConfig:
        """Full dungeon global config (admin panel). Reads 4 keys."""
        response = await (
            admin_supabase.table(cls.table_name)
            .select("setting_key, setting_value")
            .in_(
                "setting_key",
                [
                    cls._DG_MODE,
                    cls._DG_ARCHETYPES,
                    cls._DG_CLEARANCE_MODE,
                    cls._DG_CLEARANCE_THRESHOLD,
                ],
            )
            .execute()
        )
        by_key = {r["setting_key"]: r["setting_value"] for r in (extract_list(response))}
        return cls._parse_dungeon_global(by_key)

    @classmethod
    async def get_dungeon_clearance_config(
        cls,
        admin_supabase: Client,
    ) -> DungeonClearanceConfig:
        """Clearance-only subset (public endpoint). Reads 2 keys."""
        response = await (
            admin_supabase.table(cls.table_name)
            .select("setting_key, setting_value")
            .in_("setting_key", [cls._DG_CLEARANCE_MODE, cls._DG_CLEARANCE_THRESHOLD])
            .execute()
        )
        by_key = {r["setting_key"]: r["setting_value"] for r in (extract_list(response))}
        parsed = cls._parse_dungeon_global(by_key)
        return DungeonClearanceConfig(
            clearance_mode=parsed["clearance_mode"],
            clearance_threshold=parsed["clearance_threshold"],
        )

    @classmethod
    async def get_dungeon_override_config(
        cls,
        admin_supabase: Client,
    ) -> tuple[str, set[str]]:
        """Override-only subset (engine service). Returns (mode, archetypes)."""
        response = await (
            admin_supabase.table(cls.table_name)
            .select("setting_key, setting_value")
            .in_("setting_key", [cls._DG_MODE, cls._DG_ARCHETYPES])
            .execute()
        )
        by_key = {r["setting_key"]: r["setting_value"] for r in (extract_list(response))}
        parsed = cls._parse_dungeon_global(by_key)
        return (parsed["override_mode"], set(parsed["override_archetypes"]))

    @classmethod
    async def update_dungeon_global_config(
        cls,
        admin_supabase: Client,
        user_id: UUID,
        *,
        override_mode: str,
        override_archetypes: list[str],
        clearance_mode: str,
        clearance_threshold: int,
    ) -> DungeonGlobalConfig:
        """Batch-upsert all 4 dungeon global config keys atomically."""
        now = datetime.now(UTC).isoformat()
        rows = [
            {
                "setting_key": key,
                "setting_value": value,
                "updated_by_id": str(user_id),
                "updated_at": now,
            }
            for key, value in {
                cls._DG_MODE: override_mode,
                cls._DG_ARCHETYPES: json.dumps(override_archetypes),
                cls._DG_CLEARANCE_MODE: clearance_mode,
                cls._DG_CLEARANCE_THRESHOLD: str(clearance_threshold),
            }.items()
        ]
        response = await admin_supabase.table(cls.table_name).upsert(rows, on_conflict="setting_key").execute()
        if not response.data:
            raise server_error("Failed to save global dungeon configuration.")
        return DungeonGlobalConfig(
            override_mode=override_mode,
            override_archetypes=override_archetypes,
            clearance_mode=clearance_mode,
            clearance_threshold=clearance_threshold,
        )


class DungeonGlobalConfig(TypedDict):
    """Full global dungeon configuration."""

    override_mode: str  # "off" | "supplement" | "override"
    override_archetypes: list[str]
    clearance_mode: str  # "off" | "standard" | "custom"
    clearance_threshold: int


class DungeonClearanceConfig(TypedDict):
    """Clearance-only subset (public API)."""

    clearance_mode: str
    clearance_threshold: int
