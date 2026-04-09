"""Service for agent aptitude management."""

from __future__ import annotations

import logging
from uuid import UUID

from backend.models.aptitude import OPERATIVE_TYPES, AptitudeSet
from backend.utils.errors import not_found, server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class AptitudeService:
    """Manage agent aptitudes (operative-type skill scores)."""

    @classmethod
    async def get_for_agent(cls, supabase: Client, simulation_id: UUID, agent_id: UUID) -> list[dict]:
        """Get all aptitude rows for an agent."""
        resp = await (
            supabase.table("agent_aptitudes")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("agent_id", str(agent_id))
            .order("operative_type")
            .execute()
        )
        return extract_list(resp)

    @classmethod
    async def get_all_for_simulation(cls, supabase: Client, simulation_id: UUID) -> list[dict]:
        """Get all aptitude rows for all agents in a simulation."""
        resp = await (
            supabase.table("agent_aptitudes")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .order("agent_id")
            .execute()
        )
        return extract_list(resp)

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

        Returns the default (6) if no aptitude row exists.
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
        return 6  # default uniform aptitude
