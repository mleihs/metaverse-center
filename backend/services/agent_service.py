"""Service layer for agent operations."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from backend.services.base_service import BaseService
from backend.utils.search import apply_search_filter
from supabase import Client

logger = logging.getLogger(__name__)


class AgentService(BaseService):
    """Agent-specific operations extending BaseService."""

    table_name = "agents"
    view_name = "active_agents"

    @classmethod
    async def list(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        system: str | None = None,
        gender: str | None = None,
        primary_profession: str | None = None,
        search: str | None = None,
        limit: int = 25,
        offset: int = 0,
        include_deleted: bool = False,
    ) -> tuple[list[dict], int]:
        """List agents with optional filters and full-text search."""
        table = cls._read_table(include_deleted)
        query = (
            supabase.table(table)
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .order("name")
        )

        if system:
            query = query.eq("system", system)
        if gender:
            query = query.eq("gender", gender)
        if primary_profession:
            query = query.eq("primary_profession", primary_profession)
        if search:
            query = apply_search_filter(query, search)

        query = query.range(offset, offset + limit - 1)
        response = query.execute()

        total = response.count if response.count is not None else len(response.data or [])
        agents = response.data or []
        cls._enrich_ambassador_flag(supabase, simulation_id, agents)
        return agents, total

    @classmethod
    async def list_for_reaction(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        agent_ids: list[str] | None = None,
        limit: int = 20,
        select: str = "id, name, character, system",
    ) -> list[dict]:
        """Fetch agents for reaction generation (lightweight select)."""
        query = (
            supabase.table(cls._read_table())
            .select(select)
            .eq("simulation_id", str(simulation_id))
        )
        if agent_ids:
            query = query.in_("id", agent_ids)
        else:
            query = query.limit(limit)
        return (query.execute()).data or []

    @classmethod
    async def get_reactions(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
    ) -> list[dict]:
        """Get all event reactions for an agent."""
        response = (
            supabase.table("event_reactions")
            .select("*, events(id, title)")
            .eq("simulation_id", str(simulation_id))
            .eq("agent_id", str(agent_id))
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []

    @classmethod
    async def get_professions(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
    ) -> list[dict]:
        """Get all professions for an agent."""
        response = (
            supabase.table("agent_professions")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("agent_id", str(agent_id))
            .order("is_primary", desc=True)
            .execute()
        )
        return response.data or []

    @classmethod
    async def get_building_relations(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
    ) -> list[dict]:
        """Get all building relations for an agent."""
        response = (
            supabase.table("building_agent_relations")
            .select("*, buildings(id, name, building_type)")
            .eq("simulation_id", str(simulation_id))
            .eq("agent_id", str(agent_id))
            .execute()
        )
        return response.data or []

    @classmethod
    async def get_with_details(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
    ) -> dict:
        """Get an agent with professions, reactions, and building relations."""
        agent = await cls.get(supabase, simulation_id, agent_id)
        agent["professions"] = await cls.get_professions(supabase, simulation_id, agent_id)
        agent["reactions"] = await cls.get_reactions(supabase, simulation_id, agent_id)
        agent["building_relations"] = await cls.get_building_relations(supabase, simulation_id, agent_id)
        cls._enrich_ambassador_flag(supabase, simulation_id, [agent])
        return agent

    @classmethod
    def _enrich_ambassador_flag(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agents: list[dict],
    ) -> None:
        """Set is_ambassador=True on agents who serve as embassy ambassadors.

        Queries active embassies involving this simulation and extracts
        ambassador names from embassy_metadata JSON.
        """
        if not agents:
            return

        sim_str = str(simulation_id)
        try:
            response = (
                supabase.table("embassies")
                .select("simulation_a_id, simulation_b_id, embassy_metadata")
                .eq("status", "active")
                .or_(f"simulation_a_id.eq.{sim_str},simulation_b_id.eq.{sim_str}")
                .execute()
            )
        except Exception:
            logger.warning("Failed to query embassies for ambassador enrichment", exc_info=True)
            return

        ambassador_names: set[str] = set()
        for embassy in response.data or []:
            meta = embassy.get("embassy_metadata") or {}
            # ambassador_a belongs to simulation_a, ambassador_b to simulation_b
            if embassy.get("simulation_a_id") == sim_str:
                name = (meta.get("ambassador_a") or {}).get("name")
            else:
                name = (meta.get("ambassador_b") or {}).get("name")
            if name:
                ambassador_names.add(name)

        now = datetime.now(UTC)
        for agent in agents:
            is_ambassador = agent.get("name") in ambassador_names
            # A2: Check if ambassador status is temporarily blocked
            blocked_until = agent.get("ambassador_blocked_until")
            if blocked_until and is_ambassador:
                try:
                    blocked_dt = datetime.fromisoformat(
                        str(blocked_until).replace("Z", "+00:00")
                    )
                    if blocked_dt > now:
                        is_ambassador = False
                except (ValueError, TypeError):
                    pass
            agent["is_ambassador"] = is_ambassador
