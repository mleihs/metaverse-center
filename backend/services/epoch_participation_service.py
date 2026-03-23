"""Epoch participation — join, leave, draft, teams, bots."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from backend.models.epoch import EpochConfig
from backend.services.bot_personality import auto_draft
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Default epoch config (matches EpochConfig defaults)
DEFAULT_CONFIG = EpochConfig().model_dump()


class EpochParticipationService:
    """Epoch participation: join, leave, draft, teams, bots."""

    # ── Participants ─────────────────────────────────────────

    @classmethod
    async def list_participants(
        cls,
        supabase: Client,
        epoch_id: UUID,
    ) -> list[dict]:
        """List all participants in an epoch."""
        resp = await (
            supabase.table("epoch_participants")
            .select(
                "*, simulations(name, slug, simulation_type, source_template_id),"
                " bot_players(name, personality, difficulty)"
            )
            .eq("epoch_id", str(epoch_id))
            .order("joined_at")
            .execute()
        )
        return resp.data or []

    @classmethod
    async def join_epoch(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
        user_id: UUID | None = None,
    ) -> dict:
        """Join an epoch with a simulation.

        Any authenticated user can join with any template simulation.
        user_id is stored directly on the participant row.
        """
        from backend.services.epoch_service import EpochService

        epoch = await EpochService.get(supabase, epoch_id)
        if epoch["status"] != "lobby":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Can only join epochs in lobby phase.",
            )

        # Check simulation is a template (not game instance/archived)
        sim_resp = await (
            supabase.table("simulations")
            .select("simulation_type")
            .eq("id", str(simulation_id))
            .limit(1)
            .execute()
        )
        if not sim_resp.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Simulation not found.")
        sim_type = sim_resp.data[0].get("simulation_type")
        if sim_type and sim_type != "template":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Can only join with template simulations.",
            )

        # Check simulation not already in epoch
        existing = await (
            supabase.table("epoch_participants")
            .select("id")
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        if existing.data:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "This simulation is already in the epoch.",
            )

        # Check user not already in epoch (with different sim)
        if user_id:
            existing_user = await (
                supabase.table("epoch_participants")
                .select("id")
                .eq("epoch_id", str(epoch_id))
                .eq("user_id", str(user_id))
                .execute()
            )
            if existing_user.data:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    "You are already in this epoch.",
                )

        resp = await (
            supabase.table("epoch_participants")
            .insert({
                "epoch_id": str(epoch_id),
                "simulation_id": str(simulation_id),
                **({"user_id": str(user_id)} if user_id else {}),
            })
            .execute()
        )
        return resp.data[0] if resp.data else {}

    @classmethod
    async def leave_epoch(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
    ) -> None:
        """Leave an epoch (lobby phase only)."""
        from backend.services.epoch_service import EpochService

        epoch = await EpochService.get(supabase, epoch_id)
        if epoch["status"] != "lobby":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Can only leave epochs in lobby phase.",
            )

        await supabase.table("epoch_participants").delete().eq(
            "epoch_id", str(epoch_id)
        ).eq("simulation_id", str(simulation_id)).execute()

    # ── Draft ────────────────────────────────────────────────

    @classmethod
    async def draft_agents(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
        agent_ids: list[UUID],
    ) -> dict:
        """Lock in a draft roster for a participant."""
        from backend.services.epoch_service import EpochService

        epoch = await EpochService.get(supabase, epoch_id)
        if epoch["status"] != "lobby":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Can only draft agents during lobby phase.",
            )

        # Check max_agents_per_player
        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}
        max_agents = config.get("max_agents_per_player", 6)
        if len(agent_ids) > max_agents:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot draft more than {max_agents} agents.",
            )

        # Verify all agents belong to the participant's simulation
        for aid in agent_ids:
            agent_resp = await (
                supabase.table("agents")
                .select("id")
                .eq("id", str(aid))
                .eq("simulation_id", str(simulation_id))
                .is_("deleted_at", "null")
                .execute()
            )
            if not agent_resp.data:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Agent {aid} not found in simulation {simulation_id}.",
                )

        # Update participant row
        resp = await (
            supabase.table("epoch_participants")
            .update({
                "drafted_agent_ids": [str(a) for a in agent_ids],
                "draft_completed_at": datetime.now(UTC).isoformat(),
            })
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        if not resp.data:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                "Participant not found for this epoch/simulation.",
            )
        return resp.data[0]

    # ── Teams / Alliances ────────────────────────────────────

    @classmethod
    async def list_teams(cls, supabase: Client, epoch_id: UUID) -> list[dict]:
        """List all teams in an epoch."""
        resp = await (
            supabase.table("epoch_teams")
            .select("*")
            .eq("epoch_id", str(epoch_id))
            .order("created_at")
            .execute()
        )
        return resp.data or []

    @classmethod
    async def create_team(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
        name: str,
    ) -> dict:
        """Create a new team/alliance."""
        from backend.services.epoch_service import EpochService

        epoch = await EpochService.get(supabase, epoch_id)
        if epoch["status"] not in ("lobby", "foundation", "competition"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Alliances can only be formed during lobby, foundation, or competition phase.",
            )

        resp = await (
            supabase.table("epoch_teams")
            .insert({
                "epoch_id": str(epoch_id),
                "name": name,
                "created_by_simulation_id": str(simulation_id),
            })
            .execute()
        )
        team = resp.data[0] if resp.data else {}

        # Auto-join creator to team
        if team:
            await supabase.table("epoch_participants").update(
                {"team_id": team["id"]}
            ).eq("epoch_id", str(epoch_id)).eq(
                "simulation_id", str(simulation_id)
            ).execute()

        return team

    @classmethod
    async def join_team(
        cls,
        supabase: Client,
        epoch_id: UUID,
        team_id: UUID,
        simulation_id: UUID,
    ) -> dict:
        """Join an existing team."""
        from backend.services.epoch_service import EpochService

        epoch = await EpochService.get(supabase, epoch_id)
        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}

        if epoch["status"] not in ("lobby", "foundation", "competition"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Cannot join alliances during reckoning or after completion.",
            )

        # During competition, require alliance proposals instead of instant join
        if epoch["status"] == "competition":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "During active competition, use alliance proposals to request joining a team.",
            )

        # Check team size limit
        members = await (
            supabase.table("epoch_participants")
            .select("id")
            .eq("epoch_id", str(epoch_id))
            .eq("team_id", str(team_id))
            .execute()
        )
        if len(members.data or []) >= config["max_team_size"]:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Team is full (max {config['max_team_size']} members).",
            )

        resp = await (
            supabase.table("epoch_participants")
            .update({"team_id": str(team_id)})
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        return resp.data[0] if resp.data else {}

    @classmethod
    async def leave_team(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
    ) -> dict:
        """Leave current team."""
        resp = await (
            supabase.table("epoch_participants")
            .update({"team_id": None})
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        return resp.data[0] if resp.data else {}

    # ── Bot Participants ────────────────────────────────────

    @classmethod
    async def add_bot(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
        bot_player_id: UUID,
    ) -> dict:
        """Add a bot participant to an epoch lobby."""
        from backend.services.epoch_service import EpochService

        epoch = await EpochService.get(supabase, epoch_id)
        if epoch["status"] != "lobby":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Can only add bots during lobby phase.",
            )

        # Verify bot exists
        bot_resp = await (
            supabase.table("bot_players")
            .select("id, name, personality")
            .eq("id", str(bot_player_id))
            .single()
            .execute()
        )
        if not bot_resp.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Bot player not found.")

        # Check simulation not already in epoch
        existing = await (
            supabase.table("epoch_participants")
            .select("id")
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        if existing.data:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "This simulation is already in the epoch.",
            )

        # Auto-draft agents based on bot personality
        # Use the provided supabase client (admin from router) to bypass RLS —
        # the epoch creator may not be a member of the bot's simulation.
        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}
        max_agents = config.get("max_agents_per_player", 6)

        # Load agents with aptitudes for draft selection
        agents_resp = await (
            supabase.table("agents")
            .select("id, name")
            .eq("simulation_id", str(simulation_id))
            .is_("deleted_at", "null")
            .order("created_at")
            .execute()
        )
        agents = agents_resp.data or []

        # Load aptitudes for all agents in this sim
        aptitudes_resp = await (
            supabase.table("agent_aptitudes")
            .select("agent_id, operative_type, aptitude_level")
            .eq("simulation_id", str(simulation_id))
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

        drafted_ids = auto_draft(
            bot_resp.data["personality"], agents, max_agents
        )

        resp = await (
            supabase.table("epoch_participants")
            .insert({
                "epoch_id": str(epoch_id),
                "simulation_id": str(simulation_id),
                "is_bot": True,
                "bot_player_id": str(bot_player_id),
                "drafted_agent_ids": drafted_ids,
                "draft_completed_at": datetime.now(UTC).isoformat(),
            })
            .execute()
        )
        if not resp.data:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to add bot.")
        return resp.data[0]

    @classmethod
    async def remove_bot(
        cls,
        supabase: Client,
        epoch_id: UUID,
        participant_id: UUID,
    ) -> None:
        """Remove a bot participant from epoch lobby."""
        from backend.services.epoch_service import EpochService

        epoch = await EpochService.get(supabase, epoch_id)
        if epoch["status"] != "lobby":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Can only remove bots during lobby phase.",
            )

        p_resp = await (
            supabase.table("epoch_participants")
            .select("id, is_bot")
            .eq("id", str(participant_id))
            .eq("epoch_id", str(epoch_id))
            .single()
            .execute()
        )
        if not p_resp.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Participant not found.")
        if not p_resp.data.get("is_bot"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This participant is not a bot.")

        await supabase.table("epoch_participants").delete().eq("id", str(participant_id)).execute()
