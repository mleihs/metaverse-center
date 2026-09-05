"""Service layer for user profile and notification preferences."""

from __future__ import annotations

import logging
from uuid import UUID

from backend.models.notification import NOTIFICATION_PREFERENCE_COLUMNS
from backend.utils.db import maybe_single_data
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

DEFAULT_NOTIFICATION_PREFERENCES = {
    "cycle_resolved": True,
    "phase_changed": True,
    "epoch_completed": True,
    "deadline_reminder": True,
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
        return await maybe_single_data(
            admin_supabase.table("user_profiles")
            .select("onboarding_completed, academy_epochs_played")
            .eq("id", str(user_id))
            .maybe_single()
        ) or {}

    @classmethod
    async def get_notification_preferences(
        cls,
        supabase: Client,
        user_id: UUID,
    ) -> dict:
        """Fetch notification preferences for a user.

        Returns sensible defaults if no preferences have been saved yet.
        """
        data = await maybe_single_data(
            supabase.table("notification_preferences")
            .select(", ".join(NOTIFICATION_PREFERENCE_COLUMNS))
            .eq("user_id", str(user_id))
            .maybe_single()
        )
        if data:
            return data
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
            # `.get` with the default, not `[...]`: a row written before
            # migration 297 has no such key in a cached response.
            "deadline_reminder": data.get("deadline_reminder", True),
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
        supabase: Client,
        user_id: UUID,
    ) -> None:
        """Mark the user's onboarding as completed.

        Runs on the caller's client: user_profiles has a "Users can update own
        profile" RLS policy (auth.uid() = id, migration …150337) — the earlier
        admin-client docstring claim ("may require elevated access") was
        verified false in the 2026-07 deep audit.
        """
        await (
            supabase.table("user_profiles")
            .update({"onboarding_completed": True})
            .eq("id", str(user_id))
            .execute()
        )
        logger.info(
            "Onboarding completed",
            extra={"user_id": str(user_id)},
        )

    @classmethod
    async def get_image_preferences(cls, supabase: Client, user_id: UUID) -> dict:
        """Die Bildeinstellungen des Nutzers, mit den Vorgaben der Spalten.

        Auf dem Klienten des Aufrufers, nicht auf dem Admin-Klienten:
        `user_profiles` traegt „Users can read own profile" (`auth.uid() = id`),
        und `complete_onboarding` nebenan schreibt aus demselben Grund ebenso.
        """
        zeile = await maybe_single_data(
            supabase.table("user_profiles")
            .select("image_content_preference, scene_image_vantage")
            .eq("id", str(user_id))
            .maybe_single()
        )
        zeile = zeile or {}
        return {
            # Die Spaltenvorgabe ist `general`; ein fehlendes Profil ist kein
            # Grund, in die offenere Richtung zu irren.
            "image_content_preference": zeile.get("image_content_preference") or "general",
            # NULL ist hier ein Wert und keine Luecke: „die Welt entscheidet".
            "scene_image_vantage": zeile.get("scene_image_vantage"),
        }

    @classmethod
    async def update_image_preferences(
        cls,
        supabase: Client,
        user_id: UUID,
        *,
        image_content_preference: str | None = None,
        scene_image_vantage: str | None = None,
        vantage_folgt_der_welt: bool = False,
    ) -> dict:
        """Die Bildeinstellungen schreiben — nur, was wirklich mitkam.

        Ein nicht mitgeschicktes Feld bleibt unangetastet. Das ist der
        Unterschied zwischen einem PATCH und einem PUT, und er ist hier
        inhaltlich wichtig: die Oberflaeche hat zwei getrennte Bedienelemente,
        und eines zu bedienen darf das andere nicht zuruecksetzen.

        `vantage_folgt_der_welt` schreibt ausdruecklich `NULL`. Ohne diesen
        Schalter gaebe es keinen Weg zurueck: ein `null` im Rumpf ist von
        einem weggelassenen Feld nicht zu unterscheiden, sobald Pydantic
        beiden denselben Vorgabewert gibt.
        """
        aenderung: dict[str, object] = {}
        if image_content_preference is not None:
            aenderung["image_content_preference"] = image_content_preference
        if vantage_folgt_der_welt:
            aenderung["scene_image_vantage"] = None
        elif scene_image_vantage is not None:
            aenderung["scene_image_vantage"] = scene_image_vantage

        if aenderung:
            await supabase.table("user_profiles").update(aenderung).eq("id", str(user_id)).execute()
            logger.info(
                "Image preferences updated",
                extra={"user_id": str(user_id), "fields": sorted(aenderung)},
            )

        # Zurueckgelesen und nicht zusammengereimt: die Spalten tragen
        # CHECK-Bedingungen, und was wirklich steht, sagt nur die Datenbank.
        return await cls.get_image_preferences(supabase, user_id)
