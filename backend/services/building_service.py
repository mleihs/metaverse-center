"""Service layer for building operations."""

from __future__ import annotations

import logging
from uuid import UUID

from backend.services.base_service import BaseService
from backend.utils.errors import not_found, server_error
from backend.utils.responses import extract_list
from backend.utils.search import apply_search_filter
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class BuildingService(BaseService):
    """Building-specific operations extending BaseService."""

    table_name = "buildings"
    view_name = "active_buildings"
    supports_created_by = False

    @classmethod
    async def list(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        building_type: str | None = None,
        building_condition: str | None = None,
        zone_id: UUID | None = None,
        city_id: UUID | None = None,
        search: str | None = None,
        limit: int = 25,
        offset: int = 0,
        include_deleted: bool = False,
    ) -> tuple[list[dict], int]:
        """List buildings with optional filters and full-text search."""
        table = cls._read_table(include_deleted)
        query = supabase.table(table).select("*", count="exact").eq("simulation_id", str(simulation_id)).order("name")

        if building_type:
            query = query.eq("building_type", building_type)
        if building_condition:
            query = query.eq("building_condition", building_condition)
        if zone_id:
            query = query.eq("zone_id", str(zone_id))
        if city_id:
            query = query.eq("city_id", str(city_id))
        if search:
            query = apply_search_filter(query, search)

        query = query.range(offset, offset + limit - 1)
        response = await query.execute()

        total = response.count if response.count is not None else len(extract_list(response))
        return extract_list(response), total

    @classmethod
    async def get_agents(
        cls,
        supabase: Client,
        simulation_id: UUID,
        building_id: UUID,
    ) -> list[dict]:
        """Get all agents assigned to a building."""
        response = await (
            supabase.table("building_agent_relations")
            .select("*, agents(id, name, primary_profession, portrait_image_url)")
            .eq("simulation_id", str(simulation_id))
            .eq("building_id", str(building_id))
            .execute()
        )
        return extract_list(response)

    @classmethod
    async def assign_agent(
        cls,
        supabase: Client,
        simulation_id: UUID,
        building_id: UUID,
        agent_id: UUID,
        relation_type: str = "works",
    ) -> dict:
        """Assign an agent to a building."""
        response = await (
            supabase.table("building_agent_relations")
            .insert(
                {
                    "simulation_id": str(simulation_id),
                    "building_id": str(building_id),
                    "agent_id": str(agent_id),
                    "relation_type": relation_type,
                }
            )
            .execute()
        )

        if not response.data:
            raise server_error("Failed to assign agent to building.")

        return response.data[0]

    @classmethod
    async def unassign_agent(
        cls,
        supabase: Client,
        simulation_id: UUID,
        building_id: UUID,
        agent_id: UUID,
    ) -> None:
        """Remove an agent from a building."""
        response = await (
            supabase.table("building_agent_relations")
            .delete()
            .eq("simulation_id", str(simulation_id))
            .eq("building_id", str(building_id))
            .eq("agent_id", str(agent_id))
            .execute()
        )

        if not response.data:
            raise not_found(detail="Agent-building relation not found.")

    @classmethod
    async def get_profession_requirements(
        cls,
        supabase: Client,
        simulation_id: UUID,
        building_id: UUID,
    ) -> list[dict]:
        """Get profession requirements for a building."""
        response = await (
            supabase.table("building_profession_requirements")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("building_id", str(building_id))
            .order("is_mandatory", desc=True)
            .execute()
        )
        return extract_list(response)

    @classmethod
    async def set_profession_requirement(
        cls,
        supabase: Client,
        simulation_id: UUID,
        building_id: UUID,
        data: dict,
    ) -> dict:
        """Set a profession requirement for a building."""
        insert_data = {
            **data,
            "simulation_id": str(simulation_id),
            "building_id": str(building_id),
        }

        response = await (
            supabase.table("building_profession_requirements")
            .upsert(insert_data, on_conflict="building_id,profession")
            .execute()
        )

        if not response.data:
            raise server_error("Failed to set profession requirement.")

        return response.data[0]

    @classmethod
    async def get_by_zone(
        cls,
        supabase: Client,
        simulation_id: UUID,
        zone_id: UUID,
    ) -> list[dict]:
        """Get all buildings in a zone."""
        response = await (
            supabase.table(cls._read_table())
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("zone_id", str(zone_id))
            .order("name")
            .execute()
        )
        return extract_list(response)
