"""Epoch lifecycle management — create, join, transition, RP allocation."""

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status

from backend.dependencies import get_admin_supabase
from backend.models.epoch import EpochConfig
from backend.services.game_instance_service import GameInstanceService
from supabase import Client

logger = logging.getLogger(__name__)

# Default epoch config (matches EpochConfig defaults)
DEFAULT_CONFIG = EpochConfig().model_dump()

# RP costs for each operative type
OPERATIVE_RP_COSTS: dict[str, int] = {
    "spy": 3,
    "saboteur": 5,
    "propagandist": 4,
    "assassin": 7,
    "guardian": 4,
    "infiltrator": 5,
}


class EpochService:
    """Service for epoch CRUD and lifecycle management."""

    # ── Read ──────────────────────────────────────────────────

    @classmethod
    async def list_epochs(
        cls,
        supabase: Client,
        *,
        status_filter: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List epochs with optional status filter."""
        query = supabase.table("game_epochs").select("*", count="exact")
        if status_filter:
            query = query.eq("status", status_filter)
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        resp = query.execute()
        return resp.data or [], resp.count or 0

    @classmethod
    async def get(cls, supabase: Client, epoch_id: UUID) -> dict:
        """Get a single epoch by ID."""
        resp = (
            supabase.table("game_epochs")
            .select("*")
            .eq("id", str(epoch_id))
            .single()
            .execute()
        )
        if not resp.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Epoch not found.")
        return resp.data

    @classmethod
    async def get_active_epochs(cls, supabase: Client) -> list[dict]:
        """Get all active epochs (lobby/foundation/competition/reckoning)."""
        resp = (
            supabase.table("game_epochs")
            .select("*")
            .in_("status", ["lobby", "foundation", "competition", "reckoning"])
            .order("created_at", desc=True)
            .execute()
        )
        return resp.data or []

    # ── Create / Update ──────────────────────────────────────

    @classmethod
    async def create(
        cls,
        supabase: Client,
        user_id: UUID,
        name: str,
        description: str | None = None,
        config: dict | None = None,
    ) -> dict:
        """Create a new epoch in lobby status."""
        merged_config = {**DEFAULT_CONFIG, **(config or {})}

        data = {
            "name": name,
            "description": description,
            "created_by_id": str(user_id),
            "config": merged_config,
        }
        resp = supabase.table("game_epochs").insert(data).execute()
        if not resp.data:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to create epoch.")
        return resp.data[0]

    @classmethod
    async def update(
        cls,
        supabase: Client,
        epoch_id: UUID,
        updates: dict,
    ) -> dict:
        """Update epoch details (only in lobby phase)."""
        epoch = await cls.get(supabase, epoch_id)
        if epoch["status"] != "lobby":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Can only edit epoch configuration during lobby phase.",
            )
        resp = (
            supabase.table("game_epochs")
            .update(updates)
            .eq("id", str(epoch_id))
            .execute()
        )
        if not resp.data:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to update epoch.")
        return resp.data[0]

    # ── Lifecycle Transitions ────────────────────────────────

    @classmethod
    async def start_epoch(cls, supabase: Client, epoch_id: UUID, user_id: UUID) -> dict:
        """Transition epoch from lobby -> foundation.

        This triggers the game instance cloning process:
        1. Clone all participating simulations into game instances
        2. epoch_participants are repointed to instance simulation_ids
        3. Transition epoch to foundation phase
        4. Grant initial RP
        """
        epoch = await cls.get(supabase, epoch_id)
        if epoch["status"] != "lobby":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot start epoch with status '{epoch['status']}'.",
            )

        # Need at least 2 participants
        participants = await cls.list_participants(supabase, epoch_id)
        if len(participants) < 2:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Need at least 2 participants to start an epoch.",
            )

        # Verify creator has joined the epoch with a simulation
        creator_id = str(epoch["created_by_id"])
        member_resp = (
            supabase.table("simulation_members")
            .select("simulation_id")
            .eq("user_id", creator_id)
            .execute()
        )
        creator_sim_ids = {m["simulation_id"] for m in (member_resp.data or [])}
        human_participant_sims = {
            str(p["simulation_id"]) for p in participants if not p.get("is_bot")
        }
        if not creator_sim_ids & human_participant_sims:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Epoch creator must join with a simulation before starting.",
            )

        # Auto-complete drafts for participants who haven't drafted
        # Use admin client to bypass RLS — creator may not be a member of
        # all participating simulations (e.g. bot-assigned sims).
        admin = await get_admin_supabase()
        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}
        max_agents = config.get("max_agents_per_player", 6)
        for p in participants:
            if not p.get("drafted_agent_ids"):
                agent_resp = (
                    admin.table("agents")
                    .select("id")
                    .eq("simulation_id", str(p["simulation_id"]))
                    .is_("deleted_at", "null")
                    .order("created_at")
                    .limit(max_agents)
                    .execute()
                )
                auto_ids = [a["id"] for a in (agent_resp.data or [])]
                if auto_ids:
                    admin.table("epoch_participants").update({
                        "drafted_agent_ids": auto_ids,
                        "draft_completed_at": datetime.now(UTC).isoformat(),
                    }).eq("id", str(p["id"])).execute()

        # Clone simulations into game instances (atomic batch operation)
        epoch_number = await GameInstanceService.get_epoch_number(supabase)
        instance_mapping = await GameInstanceService.clone_for_epoch(
            admin, epoch_id, user_id, epoch_number
        )

        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}

        # Validate phase cycles don't overlap
        total_cycles = (config["duration_days"] * 24) // config["cycle_hours"]
        f_cycles = config.get("foundation_cycles", 4)
        r_cycles = config.get("reckoning_cycles", 8)
        if f_cycles + r_cycles >= total_cycles:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Phase overlap: foundation ({f_cycles}) + reckoning ({r_cycles}) "
                f"must be less than total cycles ({total_cycles}).",
            )

        duration = timedelta(days=config["duration_days"])
        now = datetime.now(UTC)

        resp = (
            supabase.table("game_epochs")
            .update({
                "status": "foundation",
                "starts_at": now.isoformat(),
                "ends_at": (now + duration).isoformat(),
                "current_cycle": 1,
                "config": {
                    **config,
                    "instance_mapping": instance_mapping,
                },
            })
            .eq("id", str(epoch_id))
            .execute()
        )

        # Grant initial RP to all participants (foundation bonus)
        foundation_rp = int(config["rp_per_cycle"] * 1.5)
        await cls._grant_rp_batch(supabase, epoch_id, foundation_rp, config["rp_cap"])

        if not resp.data:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to start epoch.")
        return resp.data[0]

    @classmethod
    async def advance_phase(cls, supabase: Client, epoch_id: UUID) -> dict:
        """Advance to the next phase (foundation->competition->reckoning->completed).

        When advancing to 'completed', game instances are archived.
        """
        epoch = await cls.get(supabase, epoch_id)
        next_status_map = {
            "foundation": "competition",
            "competition": "reckoning",
            "reckoning": "completed",
        }
        next_status = next_status_map.get(epoch["status"])
        if not next_status:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot advance from '{epoch['status']}'.",
            )

        resp = (
            supabase.table("game_epochs")
            .update({"status": next_status})
            .eq("id", str(epoch_id))
            .execute()
        )

        # Archive game instances when epoch completes
        if next_status == "completed":
            admin = await get_admin_supabase()
            await GameInstanceService.archive_instances(admin, epoch_id)

        if not resp.data:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to advance phase.")
        return resp.data[0]

    @classmethod
    async def cancel_epoch(cls, supabase: Client, epoch_id: UUID) -> dict:
        """Cancel an epoch (any non-terminal state).

        Deletes all game instances created for this epoch.
        """
        epoch = await cls.get(supabase, epoch_id)
        if epoch["status"] in ("completed", "cancelled"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot cancel epoch with status '{epoch['status']}'.",
            )

        resp = (
            supabase.table("game_epochs")
            .update({"status": "cancelled"})
            .eq("id", str(epoch_id))
            .execute()
        )

        # Delete game instances (only exist if epoch was started)
        if epoch["status"] != "lobby":
            admin = await get_admin_supabase()
            await GameInstanceService.delete_instances(admin, epoch_id)

        if not resp.data:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to cancel epoch.")
        return resp.data[0]

    @classmethod
    async def delete_epoch(cls, supabase: Client, epoch_id: UUID) -> dict:
        """Permanently delete an epoch. Only lobby or cancelled epochs can be deleted.

        Deletes child records in reverse FK order, then the epoch row itself.
        """
        epoch = await cls.get(supabase, epoch_id)
        if epoch["status"] not in ("lobby", "cancelled"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot delete epoch with status '{epoch['status']}'. Cancel it first.",
            )

        eid = str(epoch_id)

        # Delete child tables in reverse FK order
        for table in [
            "bot_decision_log",
            "operative_missions",
            "epoch_scores",
            "battle_log",
            "epoch_chat_messages",
            "epoch_participants",
            "epoch_teams",
            "epoch_invitations",
        ]:
            supabase.table(table).delete().eq("epoch_id", eid).execute()

        # Delete the epoch row itself
        resp = supabase.table("game_epochs").delete().eq("id", eid).execute()
        if not resp.data:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to delete epoch.")
        return resp.data[0]

    # ── Participants ─────────────────────────────────────────

    @classmethod
    async def list_participants(
        cls,
        supabase: Client,
        epoch_id: UUID,
    ) -> list[dict]:
        """List all participants in an epoch."""
        resp = (
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
        epoch = await cls.get(supabase, epoch_id)
        if epoch["status"] != "lobby":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Can only join epochs in lobby phase.",
            )

        # Check simulation is a template (not game instance/archived)
        sim_resp = (
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
        existing = (
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
            existing_user = (
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

        resp = (
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
        epoch = await cls.get(supabase, epoch_id)
        if epoch["status"] != "lobby":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Can only leave epochs in lobby phase.",
            )

        supabase.table("epoch_participants").delete().eq(
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
        epoch = await cls.get(supabase, epoch_id)
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
            agent_resp = (
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
        resp = (
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
        resp = (
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
        epoch = await cls.get(supabase, epoch_id)
        if epoch["status"] not in ("lobby", "foundation"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Alliances can only be formed during lobby or foundation phase.",
            )

        resp = (
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
            supabase.table("epoch_participants").update(
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
        epoch = await cls.get(supabase, epoch_id)
        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}

        if epoch["status"] not in ("lobby", "foundation"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Alliances can only be joined during lobby or foundation phase.",
            )

        # Check team size limit
        members = (
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

        resp = (
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
        resp = (
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
        epoch = await cls.get(supabase, epoch_id)
        if epoch["status"] != "lobby":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Can only add bots during lobby phase.",
            )

        # Verify bot exists
        bot_resp = (
            supabase.table("bot_players")
            .select("id, name, personality")
            .eq("id", str(bot_player_id))
            .single()
            .execute()
        )
        if not bot_resp.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Bot player not found.")

        # Check simulation not already in epoch
        existing = (
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
        # Use admin client to bypass RLS — the epoch creator may not be a member
        # of the simulation being assigned to the bot.
        from backend.services.bot_personality import auto_draft

        admin = await get_admin_supabase()
        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}
        max_agents = config.get("max_agents_per_player", 6)

        # Load agents with aptitudes for draft selection
        agents_resp = (
            admin.table("agents")
            .select("id, name")
            .eq("simulation_id", str(simulation_id))
            .is_("deleted_at", "null")
            .order("created_at")
            .execute()
        )
        agents = agents_resp.data or []

        # Load aptitudes for all agents in this sim
        aptitudes_resp = (
            admin.table("agent_aptitudes")
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

        resp = (
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
        epoch = await cls.get(supabase, epoch_id)
        if epoch["status"] != "lobby":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Can only remove bots during lobby phase.",
            )

        p_resp = (
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

        supabase.table("epoch_participants").delete().eq("id", str(participant_id)).execute()

    # ── RP Management ────────────────────────────────────────

    @classmethod
    async def _grant_rp_batch(
        cls,
        supabase: Client,
        epoch_id: UUID,
        amount: int,
        rp_cap: int,
    ) -> None:
        """Grant RP to all participants in an epoch, respecting the cap.

        Uses a single batch query via RPC to avoid N+1 SELECT+UPDATE loops.
        Falls back to per-participant updates if the batch approach isn't available.
        """
        now = datetime.now(UTC).isoformat()
        # Fetch all participants with current RP in a single query
        resp = (
            supabase.table("epoch_participants")
            .select("id, current_rp")
            .eq("epoch_id", str(epoch_id))
            .execute()
        )
        participants = resp.data or []

        # Build batch updates — group by target RP to minimize queries
        rp_groups: dict[int, list[str]] = {}
        for p in participants:
            current = p.get("current_rp", 0)
            new_rp = min(current + amount, rp_cap)
            rp_groups.setdefault(new_rp, []).append(p["id"])

        for new_rp, ids in rp_groups.items():
            supabase.table("epoch_participants").update({
                "current_rp": new_rp,
                "last_rp_grant_at": now,
            }).in_("id", ids).execute()

    @classmethod
    async def spend_rp(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
        amount: int,
    ) -> int:
        """Spend RP with optimistic locking. Returns remaining RP.

        Prevents race conditions: the UPDATE includes an eq() check on the
        current balance. If two concurrent requests read the same balance,
        the first to write succeeds, the second fails because current_rp
        no longer matches.
        """
        resp = (
            supabase.table("epoch_participants")
            .select("id, current_rp")
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(simulation_id))
            .single()
            .execute()
        )
        if not resp.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not a participant.")

        current = resp.data["current_rp"]
        if current < amount:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Insufficient RP: have {current}, need {amount}.",
            )

        new_rp = current - amount
        update_resp = (
            supabase.table("epoch_participants")
            .update({"current_rp": new_rp})
            .eq("id", resp.data["id"])
            .eq("current_rp", current)  # optimistic lock
            .execute()
        )

        if not update_resp.data:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "RP balance changed concurrently. Please retry.",
            )

        return new_rp

    @classmethod
    async def grant_rp(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
        amount: int,
    ) -> int:
        """Grant RP to a single participant, respecting the cap. Returns new balance."""
        resp = (
            supabase.table("epoch_participants")
            .select("id, current_rp")
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(simulation_id))
            .single()
            .execute()
        )
        if not resp.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not a participant.")

        # Read epoch config for rp_cap
        epoch_resp = (
            supabase.table("game_epochs")
            .select("config")
            .eq("id", str(epoch_id))
            .single()
            .execute()
        )
        config = {**DEFAULT_CONFIG, **(epoch_resp.data or {}).get("config", {})}
        rp_cap = config["rp_cap"]

        current = resp.data["current_rp"]
        new_rp = min(current + amount, rp_cap)

        supabase.table("epoch_participants").update(
            {"current_rp": new_rp}
        ).eq("id", resp.data["id"]).execute()

        return new_rp

    # ── Cycle Resolution ─────────────────────────────────────

    @classmethod
    async def resolve_cycle_full(
        cls,
        supabase: Client,
        epoch_id: UUID,
        admin_supabase: Client,
    ) -> dict:
        """Full cycle resolution pipeline: resolve → missions → bots → scoring → notifications.

        Extracts the multi-step resolve pipeline so it can be called from both
        the manual resolve endpoint and the auto-resolve trigger (all humans ready).
        Returns updated epoch data.
        """
        from backend.services.battle_log_service import BattleLogService
        from backend.services.bot_service import BotService
        from backend.services.cycle_notification_service import CycleNotificationService
        from backend.services.operative_service import OperativeService
        from backend.services.scoring_service import ScoringService

        data = await cls.resolve_cycle(supabase, epoch_id, admin_supabase=admin_supabase)
        config = data.get("config", {})
        cycle_number = data.get("current_cycle", 1)

        # Resolve missions that have passed their resolves_at time
        # (after timer advancement in resolve_cycle, before bots act)
        db = admin_supabase or supabase
        try:
            resolved = await OperativeService.resolve_pending_missions(db, epoch_id)
            # Log mission results to battle log
            for mission in resolved:
                try:
                    await BattleLogService.log_mission_result(
                        db, epoch_id, cycle_number, mission
                    )
                except Exception:
                    logger.debug("Battle log write failed for mission result", exc_info=True)
        except Exception:
            logger.warning("Mission resolution failed for epoch %s", epoch_id, exc_info=True)

        # Expire zone fortifications that have passed their expiry cycle
        try:
            from backend.services.operative_service import SECURITY_TIER_ORDER

            expired_forts = (
                db.table("zone_fortifications")
                .select("id, zone_id, security_bonus")
                .eq("epoch_id", str(epoch_id))
                .lte("expires_at_cycle", cycle_number)
                .execute()
            )
            for fort in expired_forts.data or []:
                # Downgrade zone security back by the bonus amount
                zone_resp = (
                    db.table("zones")
                    .select("id, security_level")
                    .eq("id", fort["zone_id"])
                    .single()
                    .execute()
                )
                if zone_resp.data:
                    current_level = zone_resp.data["security_level"]
                    try:
                        idx = SECURITY_TIER_ORDER.index(current_level)
                        new_idx = max(0, idx - fort["security_bonus"])
                        new_level = SECURITY_TIER_ORDER[new_idx]
                    except ValueError:
                        new_level = current_level
                    if new_level != current_level:
                        db.table("zones").update(
                            {"security_level": new_level}
                        ).eq("id", fort["zone_id"]).execute()
                # Delete expired fortification
                db.table("zone_fortifications").delete().eq("id", fort["id"]).execute()
        except Exception:
            logger.warning("Fortification expiry failed for epoch %s", epoch_id, exc_info=True)

        # Execute bot decisions (after RP grant + mission resolution, before next cycle)
        try:
            await BotService.execute_bot_cycle(
                supabase=supabase,
                admin_supabase=admin_supabase,
                epoch_id=str(epoch_id),
                cycle_number=cycle_number,
                config=config,
            )
        except Exception:
            logger.warning("Bot cycle execution failed for epoch %s", epoch_id, exc_info=True)

        # Compute scores after missions resolve (best-effort)
        try:
            await ScoringService.compute_cycle_scores(supabase, epoch_id, cycle_number)
        except Exception:
            logger.warning(
                "Scoring failed for epoch %s cycle %s", epoch_id, cycle_number, exc_info=True
            )

        # Send cycle notification emails (best-effort, non-blocking)
        try:
            await CycleNotificationService.send_cycle_notifications(
                admin_supabase,
                str(epoch_id),
                cycle_number,
            )
        except Exception:
            logger.warning("Cycle notification failed for epoch %s", epoch_id, exc_info=True)

        return data

    @classmethod
    async def resolve_cycle(
        cls,
        supabase: Client,
        epoch_id: UUID,
        admin_supabase: Client | None = None,
    ) -> dict:
        """Resolve a cycle: allocate RP, increment cycle counter.

        Mission resolution and scoring are handled by OperativeService
        and ScoringService respectively.
        """
        epoch = await cls.get(supabase, epoch_id)
        if epoch["status"] not in ("foundation", "competition", "reckoning"):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot resolve cycle for epoch with status '{epoch['status']}'.",
            )

        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}
        new_cycle = epoch["current_cycle"] + 1

        # Use admin client for all writes to bypass RLS restrictions
        # (e.g. non-creator triggering auto-resolve via toggle_ready)
        db = admin_supabase or supabase

        # Grant RP to all participants
        rp_amount = config["rp_per_cycle"]
        if epoch["status"] == "foundation":
            rp_amount = int(rp_amount * 1.5)  # Foundation bonus

        await cls._grant_rp_batch(db, epoch_id, rp_amount, config["rp_cap"])

        # Reset all cycle_ready flags before advancing
        db.table("epoch_participants").update(
            {"cycle_ready": False}
        ).eq("epoch_id", str(epoch_id)).execute()

        # Advance mission timers by one cycle interval so operatives resolve
        # in sync with admin-triggered cycle resolution (not wall-clock time).
        # Subtract cycle_hours from resolves_at for all non-guardian missions.
        cycle_hours = config.get("cycle_hours", 8)
        active_missions = (
            db.table("operative_missions")
            .select("id, resolves_at, operative_type")
            .eq("epoch_id", str(epoch_id))
            .in_("status", ["deploying", "active"])
            .neq("operative_type", "guardian")
            .execute()
        )
        # Batch: group by resolves_at, compute new value, update per-group
        from collections import defaultdict
        by_new_resolve: defaultdict[str, list[str]] = defaultdict(list)
        for m in active_missions.data or []:
            old_resolves = datetime.fromisoformat(m["resolves_at"])
            new_resolves = old_resolves - timedelta(hours=cycle_hours)
            by_new_resolve[new_resolves.isoformat()].append(m["id"])
        for new_ts, ids in by_new_resolve.items():
            db.table("operative_missions").update(
                {"resolves_at": new_ts}
            ).in_("id", ids).execute()

        # Increment cycle
        resp = (
            db.table("game_epochs")
            .update({"current_cycle": new_cycle})
            .eq("id", str(epoch_id))
            .execute()
        )

        if not resp.data:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to resolve cycle.")

        # Auto-advance phase if cycle crosses a boundary
        current_status = epoch["status"]
        total_cycles = (config["duration_days"] * 24) // config["cycle_hours"]

        # Support both new absolute cycles and legacy percentage-based configs
        if "foundation_cycles" in config:
            foundation_end = config["foundation_cycles"]
        else:
            foundation_end = round(total_cycles * config.get("foundation_pct", 10) / 100)

        if "reckoning_cycles" in config:
            reckoning_start = total_cycles - config["reckoning_cycles"]
        else:
            reckoning_cycles = round(total_cycles * config.get("reckoning_pct", 15) / 100)
            reckoning_start = total_cycles - reckoning_cycles

        # Validate phases don't overlap
        if reckoning_start <= foundation_end:
            logger.warning(
                "Phase overlap detected for epoch %s: foundation_end=%d, reckoning_start=%d",
                epoch_id, foundation_end, reckoning_start,
            )

        new_status = current_status
        if current_status == "foundation" and new_cycle > foundation_end:
            new_status = "competition"
        elif current_status == "competition" and new_cycle > reckoning_start:
            new_status = "reckoning"
        elif current_status == "reckoning" and new_cycle >= total_cycles:
            new_status = "completed"

        if new_status != current_status:
            logger.info(
                "Epoch %s auto-advancing phase: %s → %s (cycle %d/%d)",
                epoch_id, current_status, new_status, new_cycle, total_cycles,
            )
            phase_resp = (
                db.table("game_epochs")
                .update({"status": new_status})
                .eq("id", str(epoch_id))
                .execute()
            )
            if phase_resp.data:
                resp = phase_resp
                # Archive game instances when epoch completes
                if new_status == "completed":
                    admin = admin_supabase or await get_admin_supabase()
                    await GameInstanceService.archive_instances(admin, epoch_id)

        return resp.data[0]
