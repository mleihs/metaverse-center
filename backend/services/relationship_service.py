"""Service layer for agent relationship operations."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from backend.services.base_service import BaseService
from supabase import Client


class RelationshipService(BaseService):
    """Agent relationship CRUD — no soft-delete, scoped by simulation_id."""

    table_name = "agent_relationships"
    view_name = None
    supports_created_by = False

    _agent_select = (
        "*, source_agent:agents!source_agent_id(id, name, portrait_image_url, system),"
        " target_agent:agents!target_agent_id(id, name, portrait_image_url, system)"
    )

    @classmethod
    async def list_for_agent(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
    ) -> list[dict]:
        """List all relationships for an agent (both directions)."""
        agent_str = str(agent_id)
        sim_str = str(simulation_id)

        # Fetch where agent is source
        r1 = (
            supabase.table(cls.table_name)
            .select(cls._agent_select)
            .eq("simulation_id", sim_str)
            .eq("source_agent_id", agent_str)
            .order("intensity", desc=True)
            .execute()
        )

        # Fetch where agent is target
        r2 = (
            supabase.table(cls.table_name)
            .select(cls._agent_select)
            .eq("simulation_id", sim_str)
            .eq("target_agent_id", agent_str)
            .order("intensity", desc=True)
            .execute()
        )

        return (r1.data or []) + (r2.data or [])

    @classmethod
    async def list_for_simulation(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List all relationships in a simulation."""
        response = (
            supabase.table(cls.table_name)
            .select(cls._agent_select, count="exact")
            .eq("simulation_id", str(simulation_id))
            .order("intensity", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        total = response.count if response.count is not None else len(response.data or [])
        return response.data or [], total

    @classmethod
    async def create_relationship(
        cls,
        supabase: Client,
        simulation_id: UUID,
        source_agent_id: UUID,
        data: dict,
    ) -> dict:
        """Create a new relationship."""
        insert_data = {
            **data,
            "simulation_id": str(simulation_id),
            "source_agent_id": str(source_agent_id),
            "target_agent_id": str(data["target_agent_id"]),
        }

        response = (
            supabase.table(cls.table_name)
            .insert(insert_data)
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create relationship.",
            )
        return response.data[0]

    @classmethod
    async def update_relationship(
        cls,
        supabase: Client,
        simulation_id: UUID,
        relationship_id: UUID,
        data: dict,
    ) -> dict:
        """Update an existing relationship."""
        if not data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update.",
            )

        update_data = {**data, "updated_at": datetime.now(UTC).isoformat()}

        response = (
            supabase.table(cls.table_name)
            .update(update_data)
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(relationship_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Relationship '{relationship_id}' not found.",
            )
        return response.data[0]

    @classmethod
    async def delete_relationship(
        cls,
        supabase: Client,
        simulation_id: UUID,
        relationship_id: UUID,
    ) -> dict:
        """Delete a relationship."""
        return await cls.hard_delete(supabase, simulation_id, relationship_id)
