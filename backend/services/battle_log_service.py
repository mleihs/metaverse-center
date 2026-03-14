"""Battle log service — records and queries narrative events during epochs."""

import logging
from uuid import UUID

from supabase import Client

logger = logging.getLogger(__name__)


class BattleLogService:
    """Service for recording and querying competitive event narratives."""

    # ── Record ────────────────────────────────────────────

    @classmethod
    async def log_event(
        cls,
        supabase: Client,
        epoch_id: UUID,
        cycle_number: int,
        event_type: str,
        narrative: str,
        *,
        source_simulation_id: UUID | None = None,
        target_simulation_id: UUID | None = None,
        mission_id: UUID | None = None,
        is_public: bool = False,
        metadata: dict | None = None,
    ) -> dict:
        """Record a battle log entry."""
        data = {
            "epoch_id": str(epoch_id),
            "cycle_number": cycle_number,
            "event_type": event_type,
            "narrative": narrative,
            "is_public": is_public,
            "metadata": metadata or {},
        }

        if source_simulation_id:
            data["source_simulation_id"] = str(source_simulation_id)
        if target_simulation_id:
            data["target_simulation_id"] = str(target_simulation_id)
        if mission_id:
            data["mission_id"] = str(mission_id)

        try:
            resp = supabase.table("battle_log").insert(data).execute()
            return resp.data[0] if resp.data else data
        except Exception:
            logger.error(
                "Battle log insert failed for event_type=%s: %s",
                event_type, data.get("narrative", "")[:100], exc_info=True,
            )
            return data

    # ── Convenience Loggers ───────────────────────────────

    @classmethod
    async def log_operative_deployed(
        cls,
        supabase: Client,
        epoch_id: UUID,
        cycle_number: int,
        mission: dict,
        context: dict | None = None,
    ) -> dict:
        """Log an operative deployment with enriched metadata.

        Args:
            context: Pre-fetched names dict with keys agent_name,
                     target_sim_name, target_zone_name. If None, falls
                     back to querying the DB (for callers that don't
                     have context pre-fetched, e.g. bot deploy path).
        """
        op_type = mission["operative_type"]
        article = "An" if op_type[0] in "aeiou" else "A"

        metadata: dict = {"operative_type": op_type}

        if context:
            # Use pre-fetched context (no extra DB queries)
            if context.get("agent_name"):
                metadata["agent_name"] = context["agent_name"]
            if context.get("target_zone_name"):
                metadata["target_zone_name"] = context["target_zone_name"]
            if context.get("target_sim_name"):
                metadata["target_sim_name"] = context["target_sim_name"]
        else:
            # Fallback: fetch from DB (used by bot deploy path)
            try:
                if mission.get("agent_id"):
                    agent_resp = supabase.table("agents").select("name").eq(
                        "id", str(mission["agent_id"])
                    ).maybe_single().execute()
                    if agent_resp.data:
                        metadata["agent_name"] = agent_resp.data["name"]
                if mission.get("target_zone_id"):
                    zone_resp = supabase.table("zones").select("name").eq(
                        "id", str(mission["target_zone_id"])
                    ).maybe_single().execute()
                    if zone_resp.data:
                        metadata["target_zone_name"] = zone_resp.data["name"]
                if mission.get("target_simulation_id"):
                    sim_resp = supabase.table("simulations").select("name").eq(
                        "id", str(mission["target_simulation_id"])
                    ).maybe_single().execute()
                    if sim_resp.data:
                        metadata["target_sim_name"] = sim_resp.data["name"]
            except Exception:  # noqa: S110 — best-effort enrichment
                pass

        return await cls.log_event(
            supabase,
            epoch_id,
            cycle_number,
            "operative_deployed",
            f"{article} {op_type} has been deployed.",
            source_simulation_id=UUID(mission["source_simulation_id"]),
            target_simulation_id=(
                UUID(mission["target_simulation_id"])
                if mission.get("target_simulation_id")
                else None
            ),
            mission_id=UUID(mission["id"]),
            is_public=(mission["operative_type"] == "guardian"),
            metadata=metadata,
        )

    @classmethod
    async def log_mission_result(
        cls,
        supabase: Client,
        epoch_id: UUID,
        cycle_number: int,
        mission: dict,
    ) -> dict:
        """Log a mission resolution (success/failure/detection)."""
        result = mission.get("mission_result", {})
        outcome = result.get("outcome", "unknown")
        narrative = result.get("narrative", f"Mission {outcome}.")
        is_public = outcome in ("detected", "captured")

        event_type_map = {
            "success": "mission_success",
            "failed": "mission_failed",
            "detected": "detected",
            "captured": "captured",
        }

        return await cls.log_event(
            supabase,
            epoch_id,
            cycle_number,
            event_type_map.get(outcome, "mission_failed"),
            narrative,
            source_simulation_id=UUID(mission["source_simulation_id"]),
            target_simulation_id=(
                UUID(mission["target_simulation_id"])
                if mission.get("target_simulation_id")
                else None
            ),
            mission_id=UUID(mission["id"]),
            is_public=is_public,
            metadata={
                "operative_type": mission["operative_type"],
                "outcome": outcome,
                "agent_name": mission.get("agents", {}).get("name") if isinstance(mission.get("agents"), dict) else None,
            },
        )

    @classmethod
    async def log_phase_change(
        cls,
        supabase: Client,
        epoch_id: UUID,
        cycle_number: int,
        old_phase: str,
        new_phase: str,
    ) -> dict:
        """Log an epoch phase transition."""
        return await cls.log_event(
            supabase,
            epoch_id,
            cycle_number,
            "phase_change",
            f"Epoch transitions from {old_phase} to {new_phase}.",
            is_public=True,
            metadata={"old_phase": old_phase, "new_phase": new_phase},
        )

    @classmethod
    async def log_alliance_formed(
        cls,
        supabase: Client,
        epoch_id: UUID,
        cycle_number: int,
        team_name: str,
        simulation_ids: list[UUID],
    ) -> dict:
        """Log an alliance formation."""
        return await cls.log_event(
            supabase,
            epoch_id,
            cycle_number,
            "alliance_formed",
            f"Alliance '{team_name}' has been formed.",
            source_simulation_id=simulation_ids[0] if simulation_ids else None,
            is_public=True,
            metadata={
                "team_name": team_name,
                "member_count": len(simulation_ids),
            },
        )

    @classmethod
    async def log_betrayal(
        cls,
        supabase: Client,
        epoch_id: UUID,
        cycle_number: int,
        betrayer_id: UUID,
        victim_id: UUID,
        detected: bool,
    ) -> dict:
        """Log a betrayal event."""
        narrative = (
            "An allied simulation has been caught attacking from within!"
            if detected
            else "A covert attack from within an alliance went unnoticed."
        )
        return await cls.log_event(
            supabase,
            epoch_id,
            cycle_number,
            "betrayal",
            narrative,
            source_simulation_id=betrayer_id,
            target_simulation_id=victim_id,
            is_public=detected,
            metadata={"detected": detected},
        )

    @classmethod
    async def log_rp_allocated(
        cls,
        supabase: Client,
        epoch_id: UUID,
        cycle_number: int,
        amount: int,
        participant_count: int,
    ) -> dict:
        """Log an RP allocation event."""
        return await cls.log_event(
            supabase,
            epoch_id,
            cycle_number,
            "rp_allocated",
            f"{amount} RP allocated to {participant_count} participants.",
            is_public=True,
            metadata={"rp_amount": amount, "participant_count": participant_count},
        )

    # ── Alliance Event Loggers ────────────────────────────

    @classmethod
    async def log_alliance_proposal(
        cls,
        supabase: Client,
        epoch_id: UUID,
        cycle_number: int,
        proposer_simulation_id: UUID,
        team_name: str,
    ) -> dict:
        """Log an alliance join proposal."""
        return await cls.log_event(
            supabase, epoch_id, cycle_number,
            "alliance_proposal",
            f"A simulation has requested to join '{team_name}'.",
            source_simulation_id=proposer_simulation_id,
            is_public=True,
            metadata={"team_name": team_name},
        )

    @classmethod
    async def log_alliance_proposal_resolved(
        cls,
        supabase: Client,
        epoch_id: UUID,
        cycle_number: int,
        proposer_simulation_id: UUID,
        team_name: str,
        resolution: str,
    ) -> dict:
        """Log proposal accepted or rejected."""
        event_type = f"alliance_proposal_{resolution}"
        if resolution == "accepted":
            narrative = f"A new member has been admitted to '{team_name}'. Alliance strengthened."
        else:
            narrative = f"'{team_name}' has denied a membership request. Diplomatic relations strained."

        return await cls.log_event(
            supabase, epoch_id, cycle_number,
            event_type, narrative,
            source_simulation_id=proposer_simulation_id,
            is_public=True,
            metadata={"team_name": team_name, "resolution": resolution},
        )

    @classmethod
    async def log_tension_change(
        cls,
        supabase: Client,
        epoch_id: UUID,
        cycle_number: int,
        team_name: str,
        old_tension: int,
        new_tension: int,
    ) -> dict:
        """Log alliance tension increase."""
        return await cls.log_event(
            supabase, epoch_id, cycle_number,
            "alliance_tension_increase",
            f"Internal tensions rising within '{team_name}'. Overlapping operations detected.",
            is_public=(new_tension >= 50),
            metadata={
                "team_name": team_name,
                "old_tension": old_tension,
                "new_tension": new_tension,
            },
        )

    @classmethod
    async def log_tension_dissolution(
        cls,
        supabase: Client,
        epoch_id: UUID,
        cycle_number: int,
        team_name: str,
        affected_simulation_ids: list[str] | None = None,
    ) -> dict:
        """Log alliance dissolved due to tension.

        Includes affected_simulation_ids in metadata so downstream consumers
        (e.g. cycle notification emails) can identify which players were in
        the dissolved alliance.
        """
        metadata: dict = {"team_name": team_name, "reason": "tension"}
        if affected_simulation_ids:
            metadata["affected_simulation_ids"] = affected_simulation_ids
        return await cls.log_event(
            supabase, epoch_id, cycle_number,
            "alliance_dissolved_tension",
            f"'{team_name}' has collapsed under internal tensions. All members are now unaligned.",
            is_public=True,
            metadata=metadata,
        )

    @classmethod
    async def log_alliance_upkeep(
        cls,
        supabase: Client,
        epoch_id: UUID,
        cycle_number: int,
        team_name: str,
        cost_per_member: int,
        member_count: int,
    ) -> dict:
        """Log alliance upkeep deduction (team-only, not public)."""
        return await cls.log_event(
            supabase, epoch_id, cycle_number,
            "alliance_upkeep",
            f"Alliance maintenance: {cost_per_member} RP deducted from '{team_name}' operations budget.",
            is_public=False,
            metadata={
                "team_name": team_name,
                "cost_per_member": cost_per_member,
                "member_count": member_count,
            },
        )

    # ── Query ─────────────────────────────────────────────

    @classmethod
    async def get_global_public_feed(
        cls,
        supabase: Client,
        *,
        limit: int = 20,
    ) -> list[dict]:
        """Get recent public battle log entries across all active epochs."""
        resp = (
            supabase.table("battle_log")
            .select("*, game_epochs!inner(status)")
            .eq("is_public", True)
            .in_("game_epochs.status", ["foundation", "competition", "reckoning"])
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return resp.data or []

    @classmethod
    async def list_entries(
        cls,
        supabase: Client,
        epoch_id: UUID,
        *,
        simulation_id: UUID | None = None,
        event_type: str | None = None,
        public_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List battle log entries with filters."""
        query = (
            supabase.table("battle_log")
            .select("*", count="exact")
            .eq("epoch_id", str(epoch_id))
        )

        if public_only:
            query = query.eq("is_public", True)

        if simulation_id:
            # Show entries where the simulation is source or target
            query = query.or_(
                f"source_simulation_id.eq.{simulation_id},"
                f"target_simulation_id.eq.{simulation_id}"
            )

        if event_type:
            query = query.eq("event_type", event_type)

        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        resp = query.execute()
        return resp.data or [], resp.count or 0

    @classmethod
    async def get_public_feed(
        cls,
        supabase: Client,
        epoch_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """Get public battle log entries (for spectators)."""
        return await cls.list_entries(
            supabase, epoch_id, public_only=True, limit=limit, offset=offset
        )
