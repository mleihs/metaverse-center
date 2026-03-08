"""Academy epoch creation — one-click solo training with auto-configured bots."""

import logging
from uuid import UUID

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

        Creates a sprint-format academy epoch, selects platform template
        simulations for bots, creates temporary bot players, and adds them.

        Returns the created epoch dict.
        """
        academy = AcademyConfig()

        epoch = await EpochService.create(
            supabase,
            user_id,
            name="Academy Training",
            description="Solo training match against AI opponents.",
            config=ACADEMY_SPRINT_CONFIG,
            epoch_type="academy",
        )
        epoch_id = UUID(epoch["id"])

        await cls._populate_academy_bots(
            admin_supabase, epoch_id, user_id, academy,
        )

        return epoch

    @classmethod
    async def _populate_academy_bots(
        cls,
        admin_supabase: Client,
        epoch_id: UUID,
        user_id: UUID,
        academy: AcademyConfig,
    ) -> None:
        """Find template simulations and create bot opponents for the academy epoch."""
        templates = (
            admin_supabase.table("simulations")
            .select("id")
            .eq("simulation_type", "template")
            .is_("deleted_at", "null")
            .limit(academy.bot_count)
            .execute()
        )

        if not templates.data or len(templates.data) < academy.bot_count:
            logger.warning(
                "Not enough template simulations for academy bots",
                extra={"needed": academy.bot_count, "found": len(templates.data or [])},
            )
            return

        for i, sim_row in enumerate(templates.data[: academy.bot_count]):
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
