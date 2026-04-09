"""Service layer for event operations."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

import httpx
import sentry_sdk
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.agent_memory_service import AgentMemoryService
from backend.services.agent_service import AgentService
from backend.services.base_service import BaseService
from backend.services.constants import EVENT_STATUSES
from backend.services.game_mechanics_service import GameMechanicsService
from backend.services.platform_config_service import PlatformConfigService
from backend.utils.errors import bad_request, not_found, server_error
from backend.utils.responses import extract_list
from backend.utils.search import apply_search_filter
from supabase import AsyncClient as Client

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
        response = await query.execute()

        total = response.count if response.count is not None else len(extract_list(response))
        return extract_list(response), total

    @classmethod
    async def get_reactions(
        cls,
        supabase: Client,
        simulation_id: UUID,
        event_id: UUID,
    ) -> list[dict]:
        """Get all reactions for an event."""
        response = await (
            supabase.table("event_reactions")
            .select("*, agents(id, name, portrait_image_url)")
            .eq("simulation_id", str(simulation_id))
            .eq("event_id", str(event_id))
            .order("created_at", desc=True)
            .execute()
        )
        return extract_list(response)

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

        response = await supabase.table("event_reactions").insert(insert_data).execute()

        if not response.data:
            raise server_error("Failed to add event reaction.")

        return response.data[0]

    @classmethod
    async def update_reaction(
        cls,
        supabase: Client,
        reaction_id: UUID,
        data: dict,
    ) -> dict:
        """Update an existing event reaction."""
        response = await supabase.table("event_reactions").update(data).eq("id", str(reaction_id)).execute()

        if not response.data:
            raise not_found(detail="Event reaction not found.")

        return response.data[0]

    @classmethod
    async def delete_reaction(
        cls,
        supabase: Client,
        simulation_id: UUID,
        reaction_id: UUID,
    ) -> dict:
        """Delete a single event reaction."""
        response = await (
            supabase.table("event_reactions")
            .delete()
            .eq("id", str(reaction_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )

        if not response.data:
            raise not_found(detail="Event reaction not found.")

        return response.data[0]

    @classmethod
    async def get_by_tags(
        cls,
        supabase: Client,
        simulation_id: UUID,
        tags: list[str],
    ) -> list[dict]:
        """Get events that contain any of the specified tags."""
        response = await (
            supabase.table(cls._read_table())
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .overlaps("tags", tags)
            .order("occurred_at", desc=True)
            .execute()
        )
        return extract_list(response)

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
            raise bad_request(f"Invalid status '{new_status}'. Must be one of: {', '.join(EVENT_STATUSES)}")
        return await cls.update(
            supabase,
            simulation_id,
            event_id,
            {"event_status": new_status},
        )

    @classmethod
    async def get_chains(
        cls,
        supabase: Client,
        simulation_id: UUID,
        event_id: UUID,
    ) -> list[dict]:
        """Get all chain links for an event (as parent or child)."""
        response = await (
            supabase.table("event_chains")
            .select(
                "*, parent:events!parent_event_id(id, title, event_status),"
                " child:events!child_event_id(id, title, event_status)"
            )
            .eq("simulation_id", str(simulation_id))
            .or_(f"parent_event_id.eq.{event_id},child_event_id.eq.{event_id}")
            .order("created_at", desc=True)
            .execute()
        )
        return extract_list(response)

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
        response = await supabase.table("event_chains").insert(insert_data).execute()
        if not response.data:
            raise server_error("Failed to create event chain.")
        return response.data[0]

    @classmethod
    async def delete_chain(
        cls,
        supabase: Client,
        simulation_id: UUID,
        chain_id: UUID,
    ) -> dict:
        """Remove an event chain link."""
        response = await (
            supabase.table("event_chains")
            .delete()
            .eq("id", str(chain_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        if not response.data:
            raise not_found(detail="Event chain not found.")
        return response.data[0]

    @classmethod
    async def generate_reactions(
        cls,
        supabase: Client,
        simulation_id: UUID,
        event: dict,
        gen_service: object,
        *,
        agent_ids: list[str] | None = None,
        max_agents: int = 20,
    ) -> list[dict]:
        """Generate AI reactions from agents for an event.

        Args:
            supabase: Supabase client with user JWT.
            simulation_id: Owning simulation.
            event: Event dict (must have ``id``, ``title``, optionally ``description``).
            gen_service: A ``GenerationService`` instance (typed as ``object`` to avoid
                circular import).
            agent_ids: If provided, generate reactions only for these specific agents.
            max_agents: Maximum number of agents to generate reactions for.

        Returns:
            List of created/updated reaction dicts.
        """
        agents = await AgentService.list_for_reaction(
            supabase,
            simulation_id,
            agent_ids=agent_ids,
            limit=max_agents,
        )

        if not agents:
            return []

        # Build game context once for all reactions (cheap MV read)
        game_context = await GameMechanicsService.build_generation_context(
            supabase,
            simulation_id,
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
                        supabase,
                        prev["id"],
                        {"reaction_text": reaction_text, "data_source": "ai_generated"},
                    )
                else:
                    reaction = await cls.add_reaction(
                        supabase,
                        simulation_id,
                        event_id,
                        {
                            "agent_id": agent["id"],
                            "agent_name": agent["name"],
                            "reaction_text": reaction_text,
                            "data_source": "ai_generated",
                        },
                    )
                reactions.append(reaction)
            except Exception:  # noqa: BLE001 — per-agent failure must not abort the loop
                logger.warning("Agent reaction generation failed", extra={"agent_id": agent["id"]}, exc_info=True)
                sentry_sdk.capture_exception()

        # NOTE: reaction_modifier is computed automatically by the
        # recompute_reaction_modifier() Postgres trigger on event_reactions.

        # Create agent memories from reactions so agents remember crises
        if reactions:
            await cls._create_memories_from_reactions(
                supabase,
                simulation_id,
                event,
                reactions,
            )

        return reactions

    @classmethod
    async def _create_memories_from_reactions(
        cls,
        supabase: Client,
        simulation_id: UUID,
        event: dict,
        reactions: list[dict],
    ) -> None:
        """Wire event reactions → agent memories.

        Each reacting agent gets a memory of the event, so they can
        reference it in future conversations.
        """
        event_title = event.get("title", "Unknown event")
        impact_level = int(event.get("impact_level", 5))

        for reaction in reactions:
            agent_id = reaction.get("agent_id")
            reaction_text = reaction.get("reaction_text", "")
            if not agent_id or not reaction_text:
                continue

            try:
                content = f"During the event '{event_title}', I reacted: {reaction_text[:200]}"
                await AgentMemoryService.record_observation(
                    supabase,
                    agent_id=UUID(agent_id),
                    simulation_id=simulation_id,
                    content=content,
                    importance=min(10, impact_level),
                    source_type="event_reaction",
                    source_id=UUID(reaction["id"]),
                )
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                logger.debug(
                    "Failed to create event memory for agent %s",
                    agent_id,
                    exc_info=True,
                )

    @classmethod
    async def get_zone_links(
        cls,
        supabase: Client,
        event_id: UUID,
    ) -> list[dict]:
        """Get zone links for an event, flattening zone name/type into each link."""
        response = await (
            supabase.table("event_zone_links")
            .select("*, zones(name, zone_type)")
            .eq("event_id", str(event_id))
            .order("affinity_weight", desc=True)
            .execute()
        )
        links = []
        for row in extract_list(response):
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

        # ── Heartbeat integration: attach new events to matching arcs ──
        try:
            _resp = await (
                supabase.table("narrative_arcs")
                .select("id, primary_signature, source_event_ids")
                .eq("simulation_id", str(simulation_id))
                .in_("status", ["building", "active", "climax"])
                .execute()
            )
            arcs = extract_list(_resp)
            if arcs:
                # Get recently created events (last 60s) with resonance tags
                cutoff = (datetime.now(UTC) - timedelta(seconds=60)).isoformat()
                _resp = await (
                    supabase.table("events")
                    .select("id, tags")
                    .eq("simulation_id", str(simulation_id))
                    .is_("deleted_at", "null")
                    .gte("created_at", cutoff)
                    .execute()
                )
                recent = extract_list(_resp)
                for event in recent:
                    tags = event.get("tags") or []
                    for arc in arcs:
                        sig = arc.get("primary_signature", "")
                        if sig in tags:
                            existing_ids = arc.get("source_event_ids") or []
                            if event["id"] not in existing_ids:
                                existing_ids.append(event["id"])
                                await (
                                    supabase.table("narrative_arcs")
                                    .update(
                                        {
                                            "source_event_ids": existing_ids,
                                        }
                                    )
                                    .eq("id", arc["id"])
                                    .execute()
                                )
        except (PostgrestAPIError, httpx.HTTPError, KeyError):
            logger.debug("Heartbeat arc attachment unavailable")

        # ── Building condition degradation from crisis/sabotage events ──
        try:
            cutoff_crisis = (datetime.now(UTC) - timedelta(seconds=60)).isoformat()
            _resp = await (
                supabase.table("events")
                .select("id, tags")
                .eq("simulation_id", str(simulation_id))
                .is_("deleted_at", "null")
                .gte("created_at", cutoff_crisis)
                .overlaps("tags", ["sabotage", "crisis"])
                .execute()
            )
            crisis_events = extract_list(_resp)
            if crisis_events:
                # Check for active elemental warding (Deluge T3 / Tower T3 loot)
                # simulation_modifier effects with building_protection protect
                # buildings from degradation for duration_ticks heartbeat ticks
                protected_building_ids: set[str] = set()
                try:
                    _ward_resp = await (
                        supabase.table("agent_dungeon_loot_effects")
                        .select("id, effect_params, created_at")
                        .eq("simulation_id", str(simulation_id))
                        .eq("effect_type", "simulation_modifier")
                        .eq("consumed", False)
                        .execute()
                    )
                    warding_effects = extract_list(_ward_resp)
                    heartbeat_interval = await PlatformConfigService.get(
                        supabase,
                        "heartbeat_interval",
                        300,
                    )
                    now = datetime.now(UTC)
                    for ward in warding_effects:
                        params = ward.get("effect_params", {})
                        if not params.get("building_protection"):
                            continue
                        duration_ticks = params.get("duration_ticks", 10)
                        created = datetime.fromisoformat(ward["created_at"])
                        expires_at = created + timedelta(seconds=duration_ticks * heartbeat_interval)
                        if now < expires_at:
                            # Active warding — protect ALL buildings in simulation
                            # (T3 loot is rare enough that blanket protection is balanced)
                            protected_building_ids.add("__all__")
                        else:
                            # Expired — mark as consumed
                            await (
                                supabase.table("agent_dungeon_loot_effects")
                                .update({"consumed": True})
                                .eq("id", ward["id"])
                                .execute()
                            )
                except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                    logger.debug("Warding check unavailable", exc_info=True)

                degradation = await PlatformConfigService.get(
                    supabase,
                    "heartbeat_building_crisis_degradation",
                    0.10,
                )
                for ev in crisis_events:
                    _resp = await (
                        supabase.table("event_zone_links").select("zone_id").eq("event_id", ev["id"]).execute()
                    )
                    zone_links = extract_list(_resp)
                    zone_ids = [zl["zone_id"] for zl in zone_links]
                    if zone_ids:
                        _resp = await (
                            supabase.table("buildings")
                            .select("id, building_condition")
                            .eq("simulation_id", str(simulation_id))
                            .in_("zone_id", zone_ids)
                            .is_("deleted_at", "null")
                            .execute()
                        )
                        buildings = extract_list(_resp)
                        for bldg in buildings:
                            if "__all__" in protected_building_ids or bldg["id"] in protected_building_ids:
                                continue  # Building protected by elemental warding
                            old_cond = float(bldg.get("building_condition") or 1.0)
                            new_cond = round(max(0.0, old_cond - degradation), 4)
                            if new_cond < old_cond:
                                await (
                                    supabase.table("buildings")
                                    .update(
                                        {
                                            "building_condition": new_cond,
                                        }
                                    )
                                    .eq("id", bldg["id"])
                                    .execute()
                                )
                        logger.info(
                            "Crisis event degraded %d building(s) by %.2f",
                            len(buildings),
                            degradation,
                            extra={
                                "simulation_id": str(simulation_id),
                                "event_id": ev["id"],
                                "buildings_affected": len(buildings),
                            },
                        )
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.debug("Building crisis degradation unavailable", exc_info=True)

        result = await supabase.rpc(
            "process_cascade_events",
            {"p_simulation_id": str(simulation_id)},
        ).execute()

        cascades = extract_list(result)
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
