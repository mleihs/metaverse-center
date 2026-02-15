"""Service layer for event operations."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

from backend.services.base_service import BaseService
from supabase import Client


class EventService(BaseService):
    """Event-specific operations extending BaseService."""

    table_name = "events"
    view_name = "active_events"

    @classmethod
    async def list(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        event_type: str | None = None,
        impact_level: int | None = None,
        tag: str | None = None,
        search: str | None = None,
        limit: int = 25,
        offset: int = 0,
        include_deleted: bool = False,
    ) -> tuple[list[dict], int]:
        """List events with optional filters."""
        table = cls._read_table(include_deleted)
        query = (
            supabase.table(table)
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .order("occurred_at", desc=True)
        )

        if event_type:
            query = query.eq("event_type", event_type)
        if impact_level is not None:
            query = query.eq("impact_level", impact_level)
        if tag:
            query = query.contains("tags", [tag])
        if search:
            query = query.or_(f"title.ilike.%{search}%,description.ilike.%{search}%")

        query = query.range(offset, offset + limit - 1)
        response = query.execute()

        total = response.count if response.count is not None else len(response.data or [])
        return response.data or [], total

    @classmethod
    async def get_reactions(
        cls,
        supabase: Client,
        simulation_id: UUID,
        event_id: UUID,
    ) -> list[dict]:
        """Get all reactions for an event."""
        response = (
            supabase.table("event_reactions")
            .select("*, agents(id, name, portrait_image_url)")
            .eq("simulation_id", str(simulation_id))
            .eq("event_id", str(event_id))
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []

    @classmethod
    async def add_reaction(
        cls,
        supabase: Client,
        simulation_id: UUID,
        event_id: UUID,
        data: dict,
    ) -> dict:
        """Add an agent reaction to an event."""
        insert_data = {
            **data,
            "simulation_id": str(simulation_id),
            "event_id": str(event_id),
        }

        response = (
            supabase.table("event_reactions")
            .insert(insert_data)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add event reaction.",
            )

        return response.data[0]

    @classmethod
    async def get_by_tags(
        cls,
        supabase: Client,
        simulation_id: UUID,
        tags: list[str],
    ) -> list[dict]:
        """Get events that contain any of the specified tags."""
        response = (
            supabase.table(cls._read_table())
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .overlaps("tags", tags)
            .order("occurred_at", desc=True)
            .execute()
        )
        return response.data or []
