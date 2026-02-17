"""Service layer for agent operations."""

from __future__ import annotations

from uuid import UUID

from backend.services.base_service import BaseService
from supabase import Client


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
            try:
                # Append :* for prefix matching so partial words work
                fts_query = ":* & ".join(search.split()) + ":*"
                query = query.fts("search_vector", fts_query)
            except Exception:
                safe = search.replace("%", "").replace("_", "")
                query = query.ilike("name", f"%{safe}%")

        query = query.range(offset, offset + limit - 1)
        response = query.execute()

        total = response.count if response.count is not None else len(response.data or [])
        return response.data or [], total

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
        return agent
