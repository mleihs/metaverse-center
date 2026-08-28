"""Service for agent aptitude management."""

from __future__ import annotations

import logging
from uuid import UUID

from backend.models.aptitude import DEFAULT_APTITUDE_LEVEL, OPERATIVE_TYPES, AptitudeSet
from backend.utils.errors import not_found, server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# One round trip: agents LEFT JOIN their aptitude rows. PostgREST embeds are
# left joins, so an agent with no rows still comes back — which is precisely the
# case that has to be filled with the baseline.
_AGENTS_WITH_APTITUDES = "id, agent_aptitudes(id, operative_type, aptitude_level, created_at, updated_at)"


class AptitudeService:
    """Manage agent aptitudes (operative-type skill scores)."""

    @staticmethod
    def _effective_rows(agent_rows: list[dict], simulation_id: UUID) -> list[dict]:
        """Expand agents + their assigned rows into six effective rows per agent.

        Pure — no I/O, directly unit-testable. An agent with a partial set keeps
        its assigned values and receives the baseline for the operative types it
        is missing, so the result is always the full six per agent.
        """
        out: list[dict] = []
        for agent in agent_rows:
            agent_id = str(agent["id"])
            assigned = {row["operative_type"]: row for row in agent.get("agent_aptitudes") or []}
            for op_type in OPERATIVE_TYPES:
                row = assigned.get(op_type)
                if row is not None:
                    out.append(
                        {
                            "id": row["id"],
                            "agent_id": agent_id,
                            "simulation_id": str(simulation_id),
                            "operative_type": op_type,
                            "aptitude_level": row["aptitude_level"],
                            "is_default": False,
                            "created_at": row["created_at"],
                            "updated_at": row["updated_at"],
                        }
                    )
                else:
                    out.append(
                        {
                            "id": None,
                            "agent_id": agent_id,
                            "simulation_id": str(simulation_id),
                            "operative_type": op_type,
                            "aptitude_level": DEFAULT_APTITUDE_LEVEL,
                            "is_default": True,
                            "created_at": None,
                            "updated_at": None,
                        }
                    )
        return out

    @classmethod
    async def get_for_agent(cls, supabase: Client, simulation_id: UUID, agent_id: UUID) -> list[dict]:
        """Get the six effective aptitudes for an agent (assigned or baseline)."""
        resp = await (
            supabase.table("agents")
            .select(_AGENTS_WITH_APTITUDES)
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(agent_id))
            .is_("deleted_at", "null")
            .execute()
        )
        # No agent → no rows. Never synthesize a baseline for something that
        # does not exist; that would turn a 404-shaped answer into fake data.
        return cls._effective_rows(extract_list(resp), simulation_id)

    @classmethod
    async def get_all_for_simulation(cls, supabase: Client, simulation_id: UUID) -> list[dict]:
        """Get the six effective aptitudes for every agent in a simulation."""
        resp = await (
            supabase.table("agents")
            .select(_AGENTS_WITH_APTITUDES)
            .eq("simulation_id", str(simulation_id))
            .is_("deleted_at", "null")
            .order("id")
            .execute()
        )
        return cls._effective_rows(extract_list(resp), simulation_id)

    @classmethod
    async def set_aptitudes(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
        aptitudes: AptitudeSet,
    ) -> list[dict]:
        """Batch upsert all 6 aptitude rows for an agent.

        Budget validation (sum=36, each 3-9) is handled by the Pydantic model.
        """
        # Verify agent belongs to simulation
        agent_resp = await (
            supabase.table("agents")
            .select("id")
            .eq("id", str(agent_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        if not agent_resp.data:
            raise not_found(detail="Agent not found in this simulation.")

        # Upsert all 6 operative types
        rows = []
        for op_type in OPERATIVE_TYPES:
            level = getattr(aptitudes, op_type)
            rows.append(
                {
                    "agent_id": str(agent_id),
                    "simulation_id": str(simulation_id),
                    "operative_type": op_type,
                    "aptitude_level": level,
                }
            )

        resp = await supabase.table("agent_aptitudes").upsert(rows, on_conflict="agent_id,operative_type").execute()
        if not resp.data:
            raise server_error("Failed to save aptitudes.")
        return resp.data

    @classmethod
    async def get_aptitude_for_operative(
        cls,
        supabase: Client,
        agent_id: UUID,
        operative_type: str,
    ) -> int:
        """Get a single aptitude level for an agent + operative type.

        Falls back to the shared baseline when the agent has no assigned row.
        """
        resp = await (
            supabase.table("agent_aptitudes")
            .select("aptitude_level")
            .eq("agent_id", str(agent_id))
            .eq("operative_type", operative_type)
            .execute()
        )
        if resp.data:
            return resp.data[0]["aptitude_level"]
        return DEFAULT_APTITUDE_LEVEL
