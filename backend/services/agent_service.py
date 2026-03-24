"""Service layer for agent operations."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.base_service import BaseService
from backend.utils.search import apply_search_filter
from supabase import AsyncClient as Client

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
        response = await query.execute()

        total = response.count if response.count is not None else len(response.data or [])
        agents = response.data or []
        await cls._enrich_ambassador_flag(supabase, simulation_id, agents)
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
        return (await query.execute()).data or []

    @classmethod
    async def list_for_relationships(
        cls,
        supabase: Client,
        simulation_id: UUID,
        exclude_agent_id: UUID,
        *,
        limit: int = 20,
    ) -> list[dict]:
        """Fetch other agents in a simulation for relationship generation."""
        response = await (
            supabase.table(cls._read_table())
            .select("id, name, system, character, background")
            .eq("simulation_id", str(simulation_id))
            .neq("id", str(exclude_agent_id))
            .is_("deleted_at", "null")
            .limit(limit)
            .execute()
        )
        return response.data or []

    @classmethod
    async def get_reactions(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
    ) -> list[dict]:
        """Get all event reactions for an agent."""
        response = await (
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
        response = await (
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
        response = await (
            supabase.table("building_agent_relations")
            .select("*, buildings(id, name, building_type)")
            .eq("simulation_id", str(simulation_id))
            .eq("agent_id", str(agent_id))
            .execute()
        )
        return response.data or []

    @classmethod
    async def get_by_slug(
        cls,
        supabase: Client,
        simulation_id: UUID,
        slug: str,
    ) -> dict:
        """Get an agent by simulation-scoped slug."""
        response = await (
            supabase.table(cls._read_table())
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("slug", slug)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent with slug '{slug}' not found in simulation '{simulation_id}'.",
            )
        agent = response.data[0]
        await cls._enrich_ambassador_flag(supabase, simulation_id, [agent])
        return agent

    @classmethod
    async def get_with_details(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
    ) -> dict:
        """Get an agent with professions, reactions, and building relations.

        Uses a single Supabase query with foreign-key joins to fetch the agent
        and all related data in one round-trip, replacing 4 sequential queries.
        """
        response = await (
            supabase.table(cls.table_name)
            .select(
                "*, "
                "agent_professions(*), "
                "event_reactions(*, events(id, title)), "
                "building_agent_relations(*, buildings(id, name, building_type))"
            )
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(agent_id))
            .is_("deleted_at", "null")
            .single()
            .execute()
        )

        agent = response.data
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"agents '{agent_id}' not found in simulation '{simulation_id}'.",
            )

        # Normalize embedded keys to match the original API contract
        agent["professions"] = agent.pop("agent_professions", []) or []
        agent["reactions"] = agent.pop("event_reactions", []) or []
        agent["building_relations"] = agent.pop("building_agent_relations", []) or []

        await cls._enrich_ambassador_flag(supabase, simulation_id, [agent])
        return agent

    @classmethod
    async def _enrich_ambassador_flag(
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
            response = await (
                supabase.table("embassies")
                .select("simulation_a_id, simulation_b_id, embassy_metadata")
                .eq("status", "active")
                .or_(f"simulation_a_id.eq.{sim_str},simulation_b_id.eq.{sim_str}")
                .execute()
            )
        except (PostgrestAPIError, httpx.HTTPError):
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
