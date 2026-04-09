"""Academy epoch creation — one-click solo training with auto-configured bots."""

import logging
from datetime import UTC, datetime
from uuid import UUID

import httpx
import sentry_sdk
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.models.epoch import AcademyConfig
from backend.services.bot_personality import auto_draft
from backend.services.epoch_service import EpochService
from backend.utils.errors import conflict
from supabase import AsyncClient as Client

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
        active = await (
            admin_supabase.table("game_epochs")
            .select("id, status")
            .eq("created_by_id", str(user_id))
            .eq("epoch_type", "academy")
            .in_("status", ["lobby", "foundation", "competition", "reckoning"])
            .limit(1)
            .execute()
        )
        if active.data:
            raise conflict("You already have an active academy epoch. Complete or cancel it before starting a new one.")

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
        except (PostgrestAPIError, httpx.HTTPError) as exc:
            # DB unique index catches race condition — return existing epoch
            if "idx_one_active_academy_per_user" in str(exc):
                existing = await (
                    admin_supabase.table("game_epochs")
                    .select("*")
                    .eq("created_by_id", str(user_id))
                    .eq("epoch_type", "academy")
                    .in_("status", ["lobby", "foundation", "competition", "reckoning"])
                    .limit(1)
                    .maybe_single()
                    .execute()
                )
                if existing.data:
                    return existing.data
            raise

        epoch_id = UUID(epoch["id"])

        await cls._populate_academy_bots(
            admin_supabase,
            epoch_id,
            user_id,
            academy,
        )

        # Auto-start: lobby → foundation (academy skips manual start)
        from backend.services.epoch_lifecycle_service import EpochLifecycleService

        started = await EpochLifecycleService.start_epoch(
            admin_supabase,
            epoch_id,
            user_id,
            admin_supabase,
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
        """Find template simulations and deploy via batch RPC (migration 155).

        Uses fn_deploy_academy_bots for atomic batch insert of bot_players +
        epoch_participants, then runs personality-based auto_draft per bot.
        """
        needed = academy.bot_count + 1
        templates = await (
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

        human_sim_id = templates.data[0]["id"]
        bot_sim_ids = [row["id"] for row in templates.data[1 : academy.bot_count + 1]]

        # Step 1: Atomic batch insert of bot_players + epoch_participants
        try:
            resp = await admin_supabase.rpc(
                "fn_deploy_academy_bots",
                {
                    "p_epoch_id": str(epoch_id),
                    "p_user_id": str(user_id),
                    "p_human_sim_id": human_sim_id,
                    "p_bot_sim_ids": bot_sim_ids,
                    "p_difficulty": academy.difficulty,
                    "p_personalities": BOT_PERSONALITIES,
                },
            ).execute()

            result = resp.data
            if isinstance(result, dict) and result.get("error_code"):
                logger.error(
                    "fn_deploy_academy_bots error: %s",
                    result.get("user_message"),
                    extra={"epoch_id": str(epoch_id), "error_code": result["error_code"]},
                )
                return

            bots = result.get("bots", []) if isinstance(result, dict) else []
            logger.info(
                "Academy bots deployed via batch RPC",
                extra={"epoch_id": str(epoch_id), "deployed_count": len(bots)},
            )
        except (PostgrestAPIError, httpx.HTTPError) as exc:
            logger.exception(
                "fn_deploy_academy_bots RPC failed",
                extra={"epoch_id": str(epoch_id)},
            )
            sentry_sdk.capture_exception(exc)
            return

        # Step 2: Auto-draft agents for each bot (personality-based aptitude scoring)
        config = {**ACADEMY_SPRINT_CONFIG}
        max_agents = config.get("max_agents_per_player", 6)

        for bot in bots:
            try:
                sim_id = bot["simulation_id"]
                personality = bot["personality"]
                participant_id = bot["participant_id"]

                # Load agents with aptitudes for this simulation
                agents_resp = await (
                    admin_supabase.table("agents")
                    .select("id, name")
                    .eq("simulation_id", sim_id)
                    .is_("deleted_at", "null")
                    .execute()
                )
                agents = agents_resp.data or []

                aptitudes_resp = await (
                    admin_supabase.table("agent_aptitudes")
                    .select("agent_id, operative_type, aptitude_level")
                    .eq("simulation_id", sim_id)
                    .execute()
                )
                apt_map: dict[str, dict[str, int]] = {}
                for row in aptitudes_resp.data or []:
                    aid = row["agent_id"]
                    if aid not in apt_map:
                        apt_map[aid] = {}
                    apt_map[aid][row["operative_type"]] = row["aptitude_level"]
                for agent in agents:
                    agent["aptitudes"] = apt_map.get(agent["id"], {})

                drafted_ids = auto_draft(personality, agents, max_agents)

                # Update participant with drafted agents
                await (
                    admin_supabase.table("epoch_participants")
                    .update(
                        {
                            "drafted_agent_ids": drafted_ids,
                            "draft_completed_at": datetime.now(UTC).isoformat(),
                        }
                    )
                    .eq("id", participant_id)
                    .execute()
                )
            except (PostgrestAPIError, httpx.HTTPError):
                logger.exception(
                    "Failed to auto-draft for academy bot",
                    extra={"epoch_id": str(epoch_id), "bot": bot},
                )
