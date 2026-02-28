"""Epoch lifecycle management — create, join, transition, RP allocation."""

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status

from backend.models.epoch import EpochConfig
from supabase import Client

logger = logging.getLogger(__name__)

# Default epoch config (matches EpochConfig defaults)
DEFAULT_CONFIG = EpochConfig().model_dump()

# RP costs for each operative type
OPERATIVE_RP_COSTS: dict[str, int] = {
    "spy": 3,
    "saboteur": 5,
    "propagandist": 4,
    "assassin": 8,
    "guardian": 3,
    "infiltrator": 6,
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
    async def get_active_epoch(cls, supabase: Client) -> dict | None:
        """Get the currently active epoch (foundation/competition/reckoning)."""
        resp = (
            supabase.table("game_epochs")
            .select("*")
            .in_("status", ["foundation", "competition", "reckoning"])
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None

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
        # Validate no active epoch exists
        active = await cls.get_active_epoch(supabase)
        if active:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"An epoch is already active: '{active['name']}' ({active['status']}).",
            )

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
        return resp.data[0] if resp.data else epoch

    # ── Lifecycle Transitions ────────────────────────────────

    @classmethod
    async def start_epoch(cls, supabase: Client, epoch_id: UUID) -> dict:
        """Transition epoch from lobby -> foundation."""
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

        config = {**DEFAULT_CONFIG, **epoch.get("config", {})}
        duration = timedelta(days=config["duration_days"])
        now = datetime.now(UTC)

        resp = (
            supabase.table("game_epochs")
            .update({
                "status": "foundation",
                "starts_at": now.isoformat(),
                "ends_at": (now + duration).isoformat(),
                "current_cycle": 1,
            })
            .eq("id", str(epoch_id))
            .execute()
        )

        # Grant initial RP to all participants (foundation bonus)
        foundation_rp = int(config["rp_per_cycle"] * 1.5)
        for p in participants:
            await cls._grant_rp(supabase, p["id"], foundation_rp, config["rp_cap"])

        return resp.data[0] if resp.data else epoch

    @classmethod
    async def advance_phase(cls, supabase: Client, epoch_id: UUID) -> dict:
        """Advance to the next phase (foundation->competition->reckoning->completed)."""
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
        return resp.data[0] if resp.data else epoch

    @classmethod
    async def cancel_epoch(cls, supabase: Client, epoch_id: UUID) -> dict:
        """Cancel an epoch (any non-terminal state)."""
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
        return resp.data[0] if resp.data else epoch

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
            .select("*, simulations(name, slug)")
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
    ) -> dict:
        """Join an epoch with a simulation."""
        epoch = await cls.get(supabase, epoch_id)
        if epoch["status"] != "lobby":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Can only join epochs in lobby phase.",
            )

        # Check not already joined
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

        resp = (
            supabase.table("epoch_participants")
            .insert({
                "epoch_id": str(epoch_id),
                "simulation_id": str(simulation_id),
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

    # ── RP Management ────────────────────────────────────────

    @classmethod
    async def _grant_rp(
        cls,
        supabase: Client,
        participant_id: str,
        amount: int,
        rp_cap: int,
    ) -> None:
        """Grant RP to a participant, respecting the cap.

        Uses optimistic locking to prevent concurrent grant race conditions.
        """
        participant = (
            supabase.table("epoch_participants")
            .select("current_rp")
            .eq("id", participant_id)
            .single()
            .execute()
        )
        current = participant.data.get("current_rp", 0) if participant.data else 0
        new_rp = min(current + amount, rp_cap)

        supabase.table("epoch_participants").update({
            "current_rp": new_rp,
            "last_rp_grant_at": datetime.now(UTC).isoformat(),
        }).eq("id", participant_id).eq("current_rp", current).execute()

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

    # ── Cycle Resolution ─────────────────────────────────────

    @classmethod
    async def resolve_cycle(
        cls,
        supabase: Client,
        epoch_id: UUID,
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

        # Grant RP to all participants
        rp_amount = config["rp_per_cycle"]
        if epoch["status"] == "foundation":
            rp_amount = int(rp_amount * 1.5)  # Foundation bonus

        participants = await cls.list_participants(supabase, epoch_id)
        for p in participants:
            await cls._grant_rp(supabase, p["id"], rp_amount, config["rp_cap"])

        # Increment cycle
        resp = (
            supabase.table("game_epochs")
            .update({"current_cycle": new_cycle})
            .eq("id", str(epoch_id))
            .execute()
        )

        return resp.data[0] if resp.data else epoch
