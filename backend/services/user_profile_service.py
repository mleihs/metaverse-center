"""Service layer for user profile and notification preferences."""

from __future__ import annotations

import logging
from uuid import UUID

from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

DEFAULT_NOTIFICATION_PREFERENCES = {
    "cycle_resolved": True,
    "phase_changed": True,
    "epoch_completed": True,
    "email_locale": "en",
}


class UserProfileService:
    """User profile extras and notification preferences."""

    @classmethod
    async def get_profile_extras(
        cls,
        admin_supabase: Client,
        user_id: UUID,
    ) -> dict:
        """Fetch onboarding_completed and academy_epochs_played from user_profiles.

        Uses admin client because user_profiles may not be readable via user RLS.
        Returns an empty dict if no profile row exists.
        """
        response = await (
            admin_supabase.table("user_profiles")
            .select("onboarding_completed, academy_epochs_played")
            .eq("id", str(user_id))
            .maybe_single()
            .execute()
        )
        return response.data or {}

    @classmethod
    async def get_notification_preferences(
        cls,
        supabase: Client,
        user_id: UUID,
    ) -> dict:
        """Fetch notification preferences for a user.

        Returns sensible defaults if no preferences have been saved yet.
        """
        response = await (
            supabase.table("notification_preferences")
            .select("cycle_resolved, phase_changed, epoch_completed, email_locale")
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
        if response.data:
            return response.data
        return dict(DEFAULT_NOTIFICATION_PREFERENCES)

    @classmethod
    async def upsert_notification_preferences(
        cls,
        supabase: Client,
        user_id: UUID,
        data: dict,
    ) -> dict:
        """Upsert notification preferences for a user.

        Returns the persisted row (or the input data as fallback).
        """
        row = {
            "user_id": str(user_id),
            "cycle_resolved": data["cycle_resolved"],
            "phase_changed": data["phase_changed"],
            "epoch_completed": data["epoch_completed"],
            "email_locale": data["email_locale"],
        }

        response = await supabase.table("notification_preferences").upsert(row, on_conflict="user_id").execute()

        result = response.data[0] if response.data else row
        logger.info(
            "Notification preferences upserted",
            extra={"user_id": str(user_id)},
        )
        return {
            "cycle_resolved": result["cycle_resolved"],
            "phase_changed": result["phase_changed"],
            "epoch_completed": result["epoch_completed"],
            "email_locale": result["email_locale"],
        }

    @classmethod
    async def complete_onboarding(
        cls,
        admin_supabase: Client,
        user_id: UUID,
    ) -> None:
        """Mark the user's onboarding as completed.

        Uses admin client because user_profiles may require elevated access.
        """
        await (
            admin_supabase.table("user_profiles")
            .update({"onboarding_completed": True})
            .eq("id", str(user_id))
            .execute()
        )
        logger.info(
            "Onboarding completed",
            extra={"user_id": str(user_id)},
        )
