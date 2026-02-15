"""Service layer for simulation settings."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from backend.models.settings import ENCRYPTED_SETTING_KEYS
from backend.utils.encryption import encrypt, mask
from supabase import Client


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

        response = query.execute()
        return [_mask_if_encrypted(s) for s in (response.data or [])]

    @staticmethod
    async def get_setting(
        supabase: Client,
        simulation_id: UUID,
        setting_id: UUID,
    ) -> dict:
        """Get a single setting by ID."""
        response = (
            supabase.table("simulation_settings")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(setting_id))
            .maybe_single()
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Setting '{setting_id}' not found.",
            )
        return _mask_if_encrypted(response.data)

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
        if setting_key in ENCRYPTED_SETTING_KEYS and isinstance(setting_value, str):
            setting_value = encrypt(setting_value)

        insert_data = {
            "simulation_id": str(simulation_id),
            "category": data["category"],
            "setting_key": setting_key,
            "setting_value": setting_value,
            "updated_by_id": str(user_id),
            "updated_at": datetime.now(UTC).isoformat(),
        }

        response = (
            supabase.table("simulation_settings")
            .upsert(insert_data, on_conflict="simulation_id,category,setting_key")
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save setting.",
            )

        return _mask_if_encrypted(response.data[0])

    @staticmethod
    async def delete_setting(
        supabase: Client,
        simulation_id: UUID,
        setting_id: UUID,
    ) -> dict:
        """Delete a setting."""
        response = (
            supabase.table("simulation_settings")
            .delete()
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(setting_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Setting '{setting_id}' not found.",
            )
        return response.data[0]


def _mask_if_encrypted(setting: dict) -> dict:
    """Mask the value if this is an encrypted setting key."""
    if setting.get("setting_key") in ENCRYPTED_SETTING_KEYS:
        val = setting.get("setting_value", "")
        setting["setting_value"] = mask(str(val)) if val else "***"
    return setting
