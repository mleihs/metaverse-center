"""Service layer for event operations."""

from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status

from backend.services.agent_service import AgentService
from backend.services.base_service import BaseService
from backend.services.constants import EVENT_STATUSES
from backend.services.game_mechanics_service import GameMechanicsService
from backend.utils.search import apply_search_filter
from supabase import Client

logger = logging.getLogger(__name__)


class EventService(BaseService):
    """Event-specific operations extending BaseService."""

    table_name = "events"
    view_name = "active_events"
    supports_created_by = False

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
        date_from: datetime | None = None,
        date_to: datetime | None = None,
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
        if date_from:
            query = query.gte("occurred_at", date_from.isoformat())
        if date_to:
            query = query.lte("occurred_at", date_to.isoformat())
        if search:
            query = apply_search_filter(query, search, "search_vector", "title")

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
    async def update_reaction(
        cls,
        supabase: Client,
        reaction_id: UUID,
        data: dict,
    ) -> dict:
        """Update an existing event reaction."""
        response = (
            supabase.table("event_reactions")
            .update(data)
            .eq("id", str(reaction_id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event reaction not found.",
            )

        return response.data[0]

    @classmethod
    async def delete_reaction(
        cls,
        supabase: Client,
        simulation_id: UUID,
        reaction_id: UUID,
    ) -> dict:
        """Delete a single event reaction."""
        response = (
            supabase.table("event_reactions")
            .delete()
            .eq("id", str(reaction_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event reaction not found.",
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

    @classmethod
    async def update_status(
        cls,
        supabase: Client,
        simulation_id: UUID,
        event_id: UUID,
        new_status: str,
    ) -> dict:
        """Transition an event to a new lifecycle status."""
        if new_status not in EVENT_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status '{new_status}'. Must be one of: {', '.join(EVENT_STATUSES)}",
            )
        return await cls.update(
            supabase, simulation_id, event_id, {"event_status": new_status},
        )

    @classmethod
    async def get_chains(
        cls,
        supabase: Client,
        simulation_id: UUID,
        event_id: UUID,
    ) -> list[dict]:
        """Get all chain links for an event (as parent or child)."""
        response = (
            supabase.table("event_chains")
            .select("*, parent:events!parent_event_id(id, title, event_status), child:events!child_event_id(id, title, event_status)")
            .eq("simulation_id", str(simulation_id))
            .or_(f"parent_event_id.eq.{event_id},child_event_id.eq.{event_id}")
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []

    @classmethod
    async def add_chain(
        cls,
        supabase: Client,
        simulation_id: UUID,
        data: dict,
    ) -> dict:
        """Link two events in a narrative chain."""
        insert_data = {
            **data,
            "simulation_id": str(simulation_id),
        }
        response = (
            supabase.table("event_chains")
            .insert(insert_data)
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create event chain.",
            )
        return response.data[0]

    @classmethod
    async def delete_chain(
        cls,
        supabase: Client,
        simulation_id: UUID,
        chain_id: UUID,
    ) -> dict:
        """Remove an event chain link."""
        response = (
            supabase.table("event_chains")
            .delete()
            .eq("id", str(chain_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event chain not found.",
            )
        return response.data[0]

    @classmethod
    async def generate_reactions(
        cls,
        supabase: Client,
        simulation_id: UUID,
        event: dict,
        gen_service: object,
        *,
        max_agents: int = 20,
    ) -> list[dict]:
        """Generate AI reactions from agents for an event.

        Args:
            supabase: Supabase client with user JWT.
            simulation_id: Owning simulation.
            event: Event dict (must have ``id``, ``title``, optionally ``description``).
            gen_service: A ``GenerationService`` instance (typed as ``object`` to avoid
                circular import).
            max_agents: Maximum number of agents to generate reactions for.

        Returns:
            List of created/updated reaction dicts.
        """
        agents = await AgentService.list_for_reaction(
            supabase, simulation_id, limit=max_agents,
        )

        if not agents:
            return []

        # Build game context once for all reactions (cheap MV read)
        game_context = await GameMechanicsService.build_generation_context(
            supabase, simulation_id,
        )

        event_id = UUID(event["id"])
        existing = await cls.get_reactions(supabase, simulation_id, event_id)
        existing_map: dict[str, dict] = {r["agent_id"]: r for r in existing}

        reactions: list[dict] = []
        for agent in agents:
            try:
                reaction_text = await gen_service.generate_agent_reaction(
                    agent_data={
                        "name": agent["name"],
                        "character": agent.get("character", ""),
                        "system": agent.get("system", ""),
                    },
                    event_data={
                        "title": event["title"],
                        "description": event.get("description", ""),
                    },
                    game_context=game_context,
                )

                prev = existing_map.get(agent["id"])
                if prev:
                    reaction = await cls.update_reaction(
                        supabase, prev["id"],
                        {"reaction_text": reaction_text, "data_source": "ai_generated"},
                    )
                else:
                    reaction = await cls.add_reaction(
                        supabase, simulation_id, event_id,
                        {
                            "agent_id": agent["id"],
                            "agent_name": agent["name"],
                            "reaction_text": reaction_text,
                            "data_source": "ai_generated",
                        },
                    )
                reactions.append(reaction)
            except Exception:
                logger.warning("Agent reaction generation failed", extra={"agent_id": agent["id"]}, exc_info=True)

        # NOTE: reaction_modifier is computed automatically by the
        # recompute_reaction_modifier() Postgres trigger on event_reactions.

        return reactions

    @classmethod
    async def get_zone_links(
        cls,
        supabase: Client,
        event_id: UUID,
    ) -> list[dict]:
        """Get zone links for an event, flattening zone name/type into each link."""
        response = (
            supabase.table("event_zone_links")
            .select("*, zones(name, zone_type)")
            .eq("event_id", str(event_id))
            .order("affinity_weight", desc=True)
            .execute()
        )
        links = []
        for row in response.data or []:
            zone_data = row.pop("zones", None) or {}
            row["zone_name"] = zone_data.get("name")
            row["zone_type"] = zone_data.get("zone_type")
            links.append(row)
        return links

    @classmethod
    async def _post_event_mutation(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> list[dict]:
        """Refresh game metrics and process cascade events after any event mutation.

        Uses Postgres ``process_cascade_events`` (migration 073).
        Returns list of cascade events created (empty if none).
        """
        await GameMechanicsService.refresh_metrics(supabase)

        result = supabase.rpc(
            "process_cascade_events",
            {"p_simulation_id": str(simulation_id)},
        ).execute()

        cascades = result.data or []
        if cascades:
            # Re-refresh so cascade events are reflected in MVs
            await GameMechanicsService.refresh_metrics(supabase)
            logger.info(
                "Cascade events created",
                extra={
                    "simulation_id": str(simulation_id),
                    "count": len(cascades),
                    "zones": [c.get("zone_name") for c in cascades],
                },
            )

        return cascades
