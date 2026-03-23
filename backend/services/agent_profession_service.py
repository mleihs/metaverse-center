"""Service layer for agent profession operations."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from backend.services.base_service import BaseService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class AgentProfessionService(BaseService):
    """Agent profession CRUD — no soft-delete, scoped by agent_id."""

    table_name = "agent_professions"
    view_name = None
    supports_created_by = False

    @classmethod
    async def list_for_agent(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
    ) -> list[dict]:
        """List all professions for an agent, primary first."""
        response = await (
            supabase.table(cls.table_name)
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("agent_id", str(agent_id))
            .order("is_primary", desc=True)
            .order("qualification_level", desc=True)
            .execute()
        )
        return response.data or []

    @classmethod
    async def add(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
        data: dict,
    ) -> dict:
        """Add a profession to an agent."""
        return await cls.create(
            supabase,
            simulation_id,
            user_id=UUID(int=0),  # not used — supports_created_by=False
            data={**data, "agent_id": str(agent_id)},
        )

    @classmethod
    async def update(
        cls,
        supabase: Client,
        simulation_id: UUID,
        profession_id: UUID,
        data: dict,
        *,
        extra_filters: dict | None = None,
    ) -> dict:
        """Update an agent profession (no deleted_at filter)."""
        if not data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update.",
            )

        update_data = {**data, "updated_at": datetime.now(UTC).isoformat()}

        query = (
            supabase.table(cls.table_name)
            .update(update_data)
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(profession_id))
        )
        if extra_filters:
            for key, value in extra_filters.items():
                query = query.eq(key, str(value))

        response = await query.execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Profession '{profession_id}' not found.",
            )
        return response.data[0]

    @classmethod
    async def remove(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
        profession_id: UUID,
    ) -> dict:
        """Remove a profession from an agent."""
        return await cls.hard_delete(
            supabase,
            simulation_id,
            profession_id,
            extra_filters={"agent_id": agent_id},
        )
