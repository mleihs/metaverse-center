"""Academy epoch creation — one-click solo training with auto-configured bots."""

import logging
from uuid import UUID

from fastapi import HTTPException, status

from backend.models.epoch import AcademyConfig
from backend.services.epoch_service import EpochService
from supabase import Client

logger = logging.getLogger(__name__)

# Academy sprint preset configuration
ACADEMY_SPRINT_CONFIG: dict = {
    "duration_days": 3,
    "cycle_hours": 4,
    "foundation_cycles": 2,
    "reckoning_cycles": 3,
    "rp_per_cycle": 12,
    "rp_cap": 36,
    "max_team_size": 2,
    "max_agents_per_player": 6,
    "allow_betrayal": False,
}

# Personality rotation for academy bots
BOT_PERSONALITIES = ["sentinel", "warlord", "diplomat", "strategist"]


class AcademyService:
    """Service for creating academy (solo training) epochs with auto-configured bots."""

    @classmethod
    async def create_academy_epoch(
        cls,
        supabase: Client,
        admin_supabase: Client,
        user_id: UUID,
    ) -> dict:
        """Create a one-click academy epoch with auto-configured bot opponents.

        Creates a sprint-format academy epoch, auto-joins human + bots,
        and immediately starts the epoch (lobby → foundation).
        """
        # Guard: prevent duplicate active academy epochs
        active = (
            admin_supabase.table("game_epochs")
            .select("id, status")
            .eq("created_by_id", str(user_id))
            .eq("epoch_type", "academy")
            .in_("status", ["lobby", "foundation", "competition", "reckoning"])
            .limit(1)
            .execute()
        )
        if active.data:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "You already have an active academy epoch. Complete or cancel it before starting a new one.",
            )

        academy = AcademyConfig()

        try:
            epoch = await EpochService.create(
                supabase,
                user_id,
                name="Academy Training",
                description="Solo training match against AI opponents.",
                config=ACADEMY_SPRINT_CONFIG,
                epoch_type="academy",
            )
        except Exception as exc:
            # DB unique index catches race condition — return existing epoch
            if "idx_one_active_academy_per_user" in str(exc):
                existing = (
                    admin_supabase.table("game_epochs")
                    .select("*")
                    .eq("created_by_id", str(user_id))
                    .eq("epoch_type", "academy")
                    .in_("status", ["lobby", "foundation", "competition", "reckoning"])
                    .limit(1)
                    .single()
                    .execute()
                )
                if existing.data:
                    return existing.data
            raise

        epoch_id = UUID(epoch["id"])

        await cls._populate_academy_bots(
            admin_supabase, epoch_id, user_id, academy,
        )

        # Auto-start: lobby → foundation (academy skips manual start)
        from backend.services.epoch_lifecycle_service import EpochLifecycleService

        started = await EpochLifecycleService.start_epoch(
            admin_supabase, epoch_id, user_id, admin_supabase,
        )
        return started

    @classmethod
    async def _populate_academy_bots(
        cls,
        admin_supabase: Client,
        epoch_id: UUID,
        user_id: UUID,
        academy: AcademyConfig,
    ) -> None:
        """Find template simulations, auto-join the human player, and create bot opponents."""
        # Need bot_count + 1 templates: one for the human, rest for bots
        needed = academy.bot_count + 1
        templates = (
            admin_supabase.table("simulations")
            .select("id")
            .eq("simulation_type", "template")
            .is_("deleted_at", "null")
            .limit(needed)
            .execute()
        )

        if not templates.data or len(templates.data) < needed:
            logger.warning(
                "Not enough template simulations for academy",
                extra={"needed": needed, "found": len(templates.data or [])},
            )
            return

        # First template goes to the human player
        human_sim_id = UUID(templates.data[0]["id"])
        try:
            admin_supabase.table("epoch_participants").insert({
                "epoch_id": str(epoch_id),
                "simulation_id": str(human_sim_id),
                "user_id": str(user_id),
            }).execute()
        except Exception:
            logger.exception(
                "Failed to add human player to academy epoch",
                extra={"epoch_id": str(epoch_id), "user_id": str(user_id)},
            )

        # Remaining templates go to bots
        for i, sim_row in enumerate(templates.data[1: academy.bot_count + 1]):
            personality = BOT_PERSONALITIES[i % len(BOT_PERSONALITIES)]

            bot_resp = (
                admin_supabase.table("bot_players")
                .insert({
                    "name": f"Academy {personality.title()}",
                    "personality": personality,
                    "difficulty": academy.difficulty,
                    "created_by_id": str(user_id),
                })
                .execute()
            )
            if not bot_resp.data:
                continue

            bot_player_id = UUID(bot_resp.data[0]["id"])
            sim_id = UUID(sim_row["id"])

            try:
                await EpochService.add_bot(
                    admin_supabase, epoch_id, sim_id, bot_player_id,
                )
            except Exception:
                logger.exception(
                    "Failed to add academy bot",
                    extra={"epoch_id": str(epoch_id), "bot_player_id": str(bot_player_id)},
                )
