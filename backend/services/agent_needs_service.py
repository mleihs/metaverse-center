"""Agent needs management service.

Manages the 5 core needs (social, purpose, safety, comfort, stimulation)
that drive agent activity selection via Utility AI. Needs decay each
heartbeat tick and are fulfilled by activities.

All mutations delegate to PostgreSQL functions (migration 145, 146)
for atomicity. No fetch-compute-update patterns in Python.

Inspired by The Sims needs system with per-agent decay rates derived
from Big Five personality profiles.

PostgreSQL functions used:
- ``fn_decay_agent_needs`` (migration 145) — bulk decay with per-agent rates
- ``fn_fulfill_agent_need`` (migration 146) — atomic single-need fulfillment
"""

from __future__ import annotations

import logging
from uuid import UUID

import structlog

from supabase import Client

logger = logging.getLogger(__name__)

# Need types and their fulfillment sources
NEED_TYPES = ("social", "purpose", "safety", "comfort", "stimulation")

# Which activities fulfill which needs (activity_type → need_type → amount)
ACTIVITY_NEED_FULFILLMENT: dict[str, dict[str, float]] = {
    "socialize": {"social": 15.0},
    "seek_comfort": {"social": 20.0, "comfort": 5.0},
    "collaborate": {"social": 8.0, "purpose": 10.0},
    "work": {"purpose": 15.0},
    "maintain": {"purpose": 8.0, "comfort": 5.0},
    "create": {"purpose": 12.0, "stimulation": 10.0},
    "rest": {"comfort": 15.0, "safety": 5.0},
    "explore": {"stimulation": 18.0},
    "investigate": {"stimulation": 12.0, "purpose": 5.0},
    "reflect": {"comfort": 5.0, "stimulation": 3.0},
    "celebrate": {"social": 12.0, "stimulation": 10.0, "comfort": 5.0},
    "mourn": {"social": 5.0},
    "avoid": {},
    "confront": {},
}


class AgentNeedsService:
    """Manages agent need levels — decay and fulfillment.

    All write operations use PostgreSQL functions for atomicity.
    """

    @classmethod
    async def decay_all(
        cls,
        supabase: Client,
        simulation_id: UUID,
        rate_multiplier: float = 1.0,
    ) -> int:
        """Decay all agent needs in a simulation via ``fn_decay_agent_needs`` (migration 145).

        Returns count of agents updated.
        """
        structlog.contextvars.bind_contextvars(
            simulation_id=str(simulation_id),
            phase="needs_decay",
        )

        result = supabase.rpc("fn_decay_agent_needs", {
            "p_simulation_id": str(simulation_id),
            "p_rate_multiplier": rate_multiplier,
        }).execute()

        updated = result.data if isinstance(result.data, int) else 0
        logger.info("Needs decayed", extra={"agents_updated": updated, "rate": rate_multiplier})
        return updated

    @classmethod
    async def fulfill_need(
        cls,
        supabase: Client,
        agent_id: UUID,
        need_type: str,
        amount: float,
    ) -> float:
        """Atomically fulfill a specific need via ``fn_fulfill_agent_need`` (migration 146).

        Returns the new need value after fulfillment.
        """
        if need_type not in NEED_TYPES:
            logger.warning("Invalid need type", extra={"need_type": need_type})
            return 0.0

        result = supabase.rpc("fn_fulfill_agent_need", {
            "p_agent_id": str(agent_id),
            "p_need_type": need_type,
            "p_amount": amount,
        }).execute()

        return float(result.data) if result.data is not None else 0.0

    @classmethod
    async def fulfill_from_activity(
        cls,
        supabase: Client,
        agent_id: UUID,
        activity_type: str,
    ) -> dict[str, float]:
        """Fulfill needs based on completed activity via atomic PG calls.

        Uses ``fn_fulfill_agent_need`` (migration 146) for each need type.
        Returns dict of fulfilled amounts.
        """
        fulfillments = ACTIVITY_NEED_FULFILLMENT.get(activity_type, {})
        if not fulfillments:
            return {}

        fulfilled: dict[str, float] = {}
        for need_type, amount in fulfillments.items():
            new_val = await cls.fulfill_need(supabase, agent_id, need_type, amount)
            if new_val > 0:
                fulfilled[need_type] = round(amount, 1)

        return fulfilled

    @classmethod
    async def get_lowest_need(
        cls,
        supabase: Client,
        agent_id: UUID,
    ) -> tuple[str, float]:
        """Get the most urgent (lowest) need for an agent. Read-only."""
        result = (
            supabase.table("agent_needs")
            .select("social, purpose, safety, comfort, stimulation")
            .eq("agent_id", str(agent_id))
            .maybe_single()
            .execute()
        )
        if not result.data:
            return "social", 60.0

        needs = result.data
        lowest_type = min(NEED_TYPES, key=lambda n: needs.get(n, 100))
        return lowest_type, needs.get(lowest_type, 60.0)

    @classmethod
    async def get_all_needs(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> list[dict]:
        """Get needs for all agents in a simulation. Read-only."""
        result = (
            supabase.table("agent_needs")
            .select("*, agents!agent_needs_agent_id_fkey(id, name)")
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        return result.data or []

    @classmethod
    async def apply_zone_modifiers(
        cls,
        supabase: Client,
        simulation_id: UUID,
        zone_stability_map: dict[UUID, float],
    ) -> None:
        """Modify safety needs based on zone stability via atomic PG calls.

        Uses ``fn_fulfill_agent_need`` (migration 146) for each affected agent.
        """
        result = (
            supabase.table("agents")
            .select("id, current_zone_id")
            .eq("simulation_id", str(simulation_id))
            .is_("deleted_at", "null")
            .not_.is_("current_zone_id", "null")
            .execute()
        )

        for agent in result.data or []:
            zone_id = agent.get("current_zone_id")
            if not zone_id or zone_id not in zone_stability_map:
                continue

            stability = zone_stability_map[zone_id]
            if stability < 0.3:
                await cls.fulfill_need(supabase, agent["id"], "safety", -5.0)
            elif stability > 0.8:
                await cls.fulfill_need(supabase, agent["id"], "safety", 3.0)
