"""Service layer for simulation settings."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from backend.models.settings import is_sensitive_key
from backend.utils.encryption import decrypt, encrypt, mask
from backend.utils.errors import not_found, server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class SettingsService:
    """Service for simulation settings with encryption support."""

    @staticmethod
    async def list_settings(
        supabase: Client,
        simulation_id: UUID,
        category: str | None = None,
    ) -> list[dict]:
        """List all settings, optionally filtered by category. Masks encrypted values."""
        query = (
            supabase.table("simulation_settings")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .order("category")
            .order("setting_key")
        )

        if category:
            query = query.eq("category", category)

        response = await query.execute()
        return [_mask_if_encrypted(s) for s in (extract_list(response))]

    @staticmethod
    async def get_setting(
        supabase: Client,
        simulation_id: UUID,
        setting_id: UUID,
    ) -> dict:
        """Get a single setting by ID."""
        response = await (
            supabase.table("simulation_settings")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(setting_id))
            .limit(1)
            .execute()
        )
        if not response or not response.data:
            raise not_found(detail=f"Setting '{setting_id}' not found.")
        return _mask_if_encrypted(response.data[0])

    @staticmethod
    async def upsert_setting(
        supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
        data: dict,
    ) -> dict:
        """Create or update a setting. Encrypts values for sensitive keys."""
        setting_key = data["setting_key"]
        setting_value = data["setting_value"]

        # Encrypt sensitive values
        if is_sensitive_key(setting_key) and isinstance(setting_value, str):
            setting_value = encrypt(setting_value)

        insert_data = {
            "simulation_id": str(simulation_id),
            "category": data["category"],
            "setting_key": setting_key,
            "setting_value": setting_value,
            "updated_by_id": str(user_id),
            "updated_at": datetime.now(UTC).isoformat(),
        }

        response = await (
            supabase.table("simulation_settings")
            .upsert(insert_data, on_conflict="simulation_id,category,setting_key")
            .execute()
        )

        if not response.data:
            raise server_error("Failed to save setting.")

        return _mask_if_encrypted(response.data[0])

    @staticmethod
    async def batch_get_by_key(
        supabase: Client,
        simulation_ids: list[str],
        category: str,
        setting_key: str,
    ) -> list[dict]:
        """Fetch a specific setting across multiple simulations."""
        if not simulation_ids:
            return []
        response = await (
            supabase.table("simulation_settings")
            .select("simulation_id, setting_value")
            .eq("category", category)
            .eq("setting_key", setting_key)
            .in_("simulation_id", simulation_ids)
            .execute()
        )
        return extract_list(response)

    @staticmethod
    async def delete_setting(
        supabase: Client,
        simulation_id: UUID,
        setting_id: UUID,
    ) -> dict:
        """Delete a setting."""
        response = await (
            supabase.table("simulation_settings")
            .delete()
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(setting_id))
            .execute()
        )
        if not response.data:
            raise not_found(detail=f"Setting '{setting_id}' not found.")
        return response.data[0]

    # ── Dungeon Override Queries ────────────────────────────────────────

    @staticmethod
    async def list_dungeon_overrides(admin_supabase: Client) -> list[dict]:
        """List all template simulations with their dungeon override configs.

        Returns a flat list of {id, name, slug, mode, archetypes} dicts.
        Excludes game_instance and archived simulations.
        """
        sim_resp = await (
            admin_supabase.table("simulations")
            .select("id, name, slug")
            .eq("simulation_type", "template")
            .is_("deleted_at", "null")
            .order("name")
            .execute()
        )
        simulations = extract_list(sim_resp)

        override_resp = await (
            admin_supabase.table("simulation_settings")
            .select("simulation_id, setting_value")
            .eq("category", "game")
            .eq("setting_key", "dungeon_override")
            .execute()
        )
        overrides_by_sim: dict[str, dict] = {
            row["simulation_id"]: row["setting_value"]
            for row in (extract_list(override_resp))
            if isinstance(row.get("setting_value"), dict)
        }

        return [
            {
                "id": sim["id"],
                "name": sim["name"],
                "slug": sim["slug"],
                "mode": overrides_by_sim.get(sim["id"], {}).get("mode", "off"),
                "archetypes": overrides_by_sim.get(sim["id"], {}).get("archetypes", []),
            }
            for sim in simulations
        ]

    @staticmethod
    async def get_dungeon_override(
        admin_supabase: Client,
        simulation_id: UUID,
    ) -> dict:
        """Get dungeon override config for a single simulation."""
        resp = await (
            admin_supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(simulation_id))
            .eq("category", "game")
            .eq("setting_key", "dungeon_override")
            .maybe_single()
            .execute()
        )
        config = resp.data.get("setting_value", {}) if resp.data else {}
        return {
            "mode": config.get("mode", "off"),
            "archetypes": config.get("archetypes", []),
        }


def _mask_if_encrypted(setting: dict) -> dict:
    """Mask the value if this is an encrypted setting key.

    If the stored value is a Fernet ciphertext, decrypt first so the mask
    shows the last 4 chars of the *plaintext* (e.g. ``***...3a66``), not
    the ciphertext.
    """
    if is_sensitive_key(setting.get("setting_key", "")):
        val = setting.get("setting_value", "")
        if not val:
            setting["setting_value"] = "***"
        else:
            display_val = str(val)
            # If encrypted, decrypt to get readable last-4 chars
            if isinstance(val, str) and val.startswith("gAAAAA"):
                try:
                    display_val = decrypt(val)
                except (ValueError, Exception):
                    logger.debug("Could not decrypt setting for masking, using ciphertext")
            setting["setting_value"] = mask(display_val)
    return setting
