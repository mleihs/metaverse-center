"""Service for platform-level settings (cache TTLs, etc.).

Uses admin (service_role) client — platform_settings has RLS enabled with no
anon/authenticated policies, so only service_role can read/write.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from backend.models.settings import is_sensitive_key
from backend.utils.encryption import decrypt, mask
from supabase import Client

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
        cls, admin_supabase: Client, *, mask_sensitive: bool = False,
    ) -> list[dict]:
        """Fetch all platform settings.

        When mask_sensitive=True, sensitive keys show masked values (for admin UI).
        """
        response = (
            admin_supabase.table(cls.table_name)
            .select("*")
            .order("setting_key")
            .execute()
        )
        rows = response.data or []
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
        response = (
            admin_supabase.table(cls.table_name)
            .select("*")
            .eq("setting_key", key)
            .limit(1)
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Platform setting '{key}' not found.",
            )
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
        response = (
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
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save platform setting '{key}'.",
            )
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
        except Exception:
            logger.warning("Failed to load platform settings, using defaults")
            return dict(DEFAULT_SETTINGS)
