"""Epoch participation — join, leave, draft, teams, bots."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from backend.models.epoch import DEFAULT_EPOCH_CONFIG
from backend.services.bot_personality import auto_draft
from backend.utils.db import maybe_single_data, resolve_epoch_sim_names
from backend.utils.errors import bad_request, conflict, not_found, server_error
from backend.utils.responses import extract_list
from backend.utils.supabase_admin_cache import get_admin_supabase_client
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Default epoch config (matches EpochConfig defaults)
DEFAULT_CONFIG = DEFAULT_EPOCH_CONFIG


class EpochParticipationService:
    """Epoch participation: join, leave, draft, teams, bots."""

    # ── Participants ─────────────────────────────────────────

    @classmethod
    async def list_participants(
        cls,
        supabase: Client,
        epoch_id: UUID,
        *,
        admin_supabase: Client | None = None,
    ) -> list[dict]:
        """List all participants in an epoch.

        When ``admin_supabase`` is provided, simulation names are resolved
        via admin client (bypasses RLS) and game-instance names are mapped
        back to their template names.  Without it, the user-scoped join is
        used — which may return null for cross-player game instances.
        """
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
        participants = extract_list(resp)

        # Patch sim names when admin client available — fixes RLS-blocked
        # joins and replaces "X (Epoch N)" clone names with template names.
        if admin_supabase:
            sim_ids = [p["simulation_id"] for p in participants]
            sim_map = await resolve_epoch_sim_names(admin_supabase, sim_ids)
            for p in participants:
                resolved = sim_map.get(p["simulation_id"])
                if resolved:
                    if not p.get("simulations"):
                        p["simulations"] = {}
                    p["simulations"]["name"] = resolved["name"]
                    if resolved.get("slug"):
                        p["simulations"]["slug"] = resolved["slug"]

        return participants

    @classmethod
    async def join_epoch(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
        user_id: UUID | None = None,
    ) -> dict:
        """Join an epoch with a simulation.

        Uses fn_join_epoch_atomic (migration 214) for race-condition-free
        insertion. The RPC checks user uniqueness and uses ON CONFLICT for
        simulation uniqueness in a single transaction.
        """
        from backend.services.epoch_service import EpochService

        epoch = await EpochService.get(supabase, epoch_id)
        if epoch["status"] != "lobby":
            raise bad_request("Can only join epochs in lobby phase.")

        # Check simulation is a template (not game instance/archived)
        sim_resp = await (
            supabase.table("simulations").select("simulation_type").eq("id", str(simulation_id)).limit(1).execute()
        )
        if not sim_resp.data:
            raise not_found(detail="Simulation not found.")
        sim_type = sim_resp.data[0].get("simulation_type")
        if sim_type and sim_type != "template":
            raise bad_request("Can only join with template simulations.")

        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}

        # Atomic join — handles both sim and user uniqueness in one transaction
        # SECDEF privileged write: service_role only (ADR-006 / migration 258).
        admin = await get_admin_supabase_client()
        resp = await admin.rpc(
            "fn_join_epoch_atomic",
            {
                "p_epoch_id": str(epoch_id),
                "p_simulation_id": str(simulation_id),
                "p_user_id": str(user_id) if user_id else None,
                "p_initial_rp": config["rp_per_cycle"],
            },
        ).execute()

        # plpgsql RETURN NULL yields JSON null; ON CONFLICT yields no RETURNING row
        if not resp.data:
            raise conflict("This simulation or user is already in the epoch.")

        # Fetch full participant record for response
        participant = await (
            supabase.table("epoch_participants")
            .select("*")
            .eq("id", str(resp.data))
            .single()
            .execute()
        )
        return participant.data if participant.data else {}

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
            raise bad_request("Can only leave epochs in lobby phase.")

        await (
            supabase.table("epoch_participants")
            .delete()
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )

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
            raise bad_request("Can only draft agents during lobby phase.")

        # Check max_agents_per_player
        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}
        max_agents = config.get("max_agents_per_player", 6)
        if len(agent_ids) > max_agents:
            raise bad_request(f"Cannot draft more than {max_agents} agents.")

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
                raise bad_request(f"Agent {aid} not found in simulation {simulation_id}.")

        # Update participant row.
        # SECDEF privileged write: service_role only (ADR-006 / migration 275).
        # `drafted_agent_ids` decides which agents exist as operatives for the
        # whole epoch — the roster is validated above and then written by the
        # server, never by the player's own client.
        admin = await get_admin_supabase_client()
        resp = await (
            admin.table("epoch_participants")
            .update(
                {
                    "drafted_agent_ids": [str(a) for a in agent_ids],
                    "draft_completed_at": datetime.now(UTC).isoformat(),
                }
            )
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        if not resp.data:
            raise not_found(detail="Participant not found for this epoch/simulation.")
        return resp.data[0]

    # ── Teams / Alliances ────────────────────────────────────

    @classmethod
    async def list_teams(cls, supabase: Client, epoch_id: UUID) -> list[dict]:
        """List all teams in an epoch."""
        resp = await (
            supabase.table("epoch_teams").select("*").eq("epoch_id", str(epoch_id)).order("created_at").execute()
        )
        return extract_list(resp)

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
            raise bad_request("Alliances can only be formed during lobby, foundation, or competition phase.")

        # Atomic team creation + creator auto-join (fn_create_team_atomic,
        # migration 275). Previously an INSERT followed by a separate UPDATE:
        # a failure in between stranded an alliance with no members. Also a
        # SECDEF privileged write — epoch_teams is service_role-only.
        admin = await get_admin_supabase_client()
        resp = await admin.rpc(
            "fn_create_team_atomic",
            {
                "p_epoch_id": str(epoch_id),
                "p_simulation_id": str(simulation_id),
                "p_name": name,
            },
        ).execute()

        team = resp.data or {}
        if team.get("error_code") == "participant_not_found":
            raise bad_request("You must join the epoch before forming an alliance.")
        if not team.get("id"):
            raise server_error("Failed to create alliance.")
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
            raise bad_request("Cannot join alliances during reckoning or after completion.")

        # During competition, require alliance proposals instead of instant join
        if epoch["status"] == "competition":
            raise bad_request("During active competition, use alliance proposals to request joining a team.")

        # Atomic team join with size enforcement (migration 214).
        # Returns: true (joined), false (full), NULL (team not found/dissolved).
        # SECDEF privileged write: service_role only (ADR-006 / migration 258).
        admin = await get_admin_supabase_client()
        resp = await admin.rpc(
            "fn_join_team_checked",
            {
                "p_epoch_id": str(epoch_id),
                "p_team_id": str(team_id),
                "p_simulation_id": str(simulation_id),
                "p_max_size": config["max_team_size"],
            },
        ).execute()

        if resp.data is None:
            raise not_found(detail="Team not found or has been dissolved.")
        if resp.data is False:
            raise bad_request(f"Team is full (max {config['max_team_size']} members).")

        # Fetch updated participant for response. The router answers with
        # TeamActionResponse, which requires the discriminating `action` field —
        # without it FastAPI rejected the response and returned 500 *after* the
        # join had already committed.
        updated = await maybe_single_data(
            supabase.table("epoch_participants")
            .select("simulation_id, team_id")
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(simulation_id))
            .maybe_single()
        )
        if not updated:
            raise not_found(detail="Participant not found in this epoch.")
        return {**updated, "action": "join"}

    @classmethod
    async def leave_team(
        cls,
        supabase: Client,
        epoch_id: UUID,
        simulation_id: UUID,
    ) -> dict:
        """Leave current team.

        Returns TeamActionResponse shape (see join_team for why `action` matters).
        """
        # SECDEF privileged write: team_id is no longer writable by
        # `authenticated` (migration 275) — a direct PATCH would have let a
        # player slip into a full team past fn_join_team_checked's size gate.
        admin = await get_admin_supabase_client()
        resp = await admin.rpc(
            "fn_leave_team",
            {"p_epoch_id": str(epoch_id), "p_simulation_id": str(simulation_id)},
        ).execute()
        if not resp.data:
            raise not_found(detail="Participant not found in this epoch.")
        return {"simulation_id": simulation_id, "team_id": None, "action": "leave"}

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
            raise bad_request("Can only add bots during lobby phase.")

        # Verify bot exists
        # maybe_single: `.single()` raises on 0 rows, so this 404 never ran.
        bot_row = await maybe_single_data(
            supabase.table("bot_players")
            .select("id, name, personality")
            .eq("id", str(bot_player_id))
            .maybe_single()
        )
        if not bot_row:
            raise not_found(detail="Bot player not found.")

        # Check simulation not already in epoch
        existing = await (
            supabase.table("epoch_participants")
            .select("id")
            .eq("epoch_id", str(epoch_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        if existing.data:
            raise conflict("This simulation is already in the epoch.")

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
        agents = extract_list(agents_resp)

        # Load aptitudes for all agents in this sim
        aptitudes_resp = await (
            supabase.table("agent_aptitudes")
            .select("agent_id, operative_type, aptitude_level")
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        apt_map: dict[str, dict[str, int]] = {}
        for row in extract_list(aptitudes_resp):
            aid = row["agent_id"]
            if aid not in apt_map:
                apt_map[aid] = {}
            apt_map[aid][row["operative_type"]] = row["aptitude_level"]
        for agent in agents:
            agent["aptitudes"] = apt_map.get(agent["id"], {})

        drafted_ids = auto_draft(bot_row["personality"], agents, max_agents)

        resp = await (
            supabase.table("epoch_participants")
            .insert(
                {
                    "epoch_id": str(epoch_id),
                    "simulation_id": str(simulation_id),
                    "is_bot": True,
                    "bot_player_id": str(bot_player_id),
                    "drafted_agent_ids": drafted_ids,
                    "draft_completed_at": datetime.now(UTC).isoformat(),
                }
            )
            .execute()
        )
        if not resp.data:
            raise server_error("Failed to add bot.")
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
            raise bad_request("Can only remove bots during lobby phase.")

        # maybe_single: `.single()` raises on 0 rows, so this 404 never ran.
        p_row = await maybe_single_data(
            supabase.table("epoch_participants")
            .select("id, is_bot")
            .eq("id", str(participant_id))
            .eq("epoch_id", str(epoch_id))
            .maybe_single()
        )
        if not p_row:
            raise not_found(detail="Participant not found.")
        if not p_row.get("is_bot"):
            raise bad_request("This participant is not a bot.")

        resp = await (
            supabase.table("epoch_participants").delete().eq("id", str(participant_id)).execute()
        )
        if not resp.data:
            raise server_error("Failed to remove bot participant.")
