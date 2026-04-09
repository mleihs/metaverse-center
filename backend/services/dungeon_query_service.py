"""Read-only query service for Resonance Dungeons.

Separates read operations from the DungeonEngineService (command-side).
Used by both authenticated and public-facing dungeon endpoints.
"""

from __future__ import annotations

import logging
from uuid import UUID

from backend.models.common import PaginationMeta
from backend.utils.errors import not_found
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Completed run statuses visible to public endpoints
_FINISHED_STATUSES = ["completed", "abandoned", "wiped"]

# Field list for public run summaries (excludes internal columns like seed, map_data)
_PUBLIC_RUN_FIELDS = (
    "id, simulation_id, archetype, resonance_signature, difficulty, "
    "depth_target, current_depth, rooms_cleared, rooms_total, status, "
    "outcome, completed_at, created_at"
)


class DungeonQueryService:
    """Read-only queries for dungeon runs, events, and loot effects."""

    @staticmethod
    async def get_run(
        supabase: Client,
        run_id: UUID,
    ) -> dict:
        """Get run metadata by ID."""
        resp = await supabase.table("resonance_dungeon_runs").select("*").eq("id", str(run_id)).maybe_single().execute()
        if not resp.data:
            raise not_found("Dungeon run", run_id)
        return resp.data

    @staticmethod
    async def get_run_public(
        supabase: Client,
        run_id: UUID,
    ) -> dict:
        """Get a completed/abandoned/wiped run (public, no auth)."""
        resp = await (
            supabase.table("resonance_dungeon_runs")
            .select("*")
            .eq("id", str(run_id))
            .in_("status", _FINISHED_STATUSES)
            .maybe_single()
            .execute()
        )
        if not resp.data:
            raise not_found(
                "Dungeon run",
                run_id,
                detail="Dungeon run not found or still active.",
            )
        return resp.data

    @staticmethod
    async def list_events(
        supabase: Client,
        run_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], PaginationMeta]:
        """Paginated dungeon event log for a run."""
        resp = await (
            supabase.table("resonance_dungeon_events")
            .select("*", count="exact")
            .eq("run_id", str(run_id))
            .order("created_at", desc=False)
            .range(offset, offset + limit - 1)
            .execute()
        )
        data = extract_list(resp)
        meta = PaginationMeta(
            count=len(data),
            total=resp.count or 0,
            limit=limit,
            offset=offset,
        )
        return data, meta

    @staticmethod
    async def list_history(
        supabase: Client,
        simulation_id: UUID,
        *,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], PaginationMeta]:
        """Paginated run history for a simulation."""
        resp = await (
            supabase.table("resonance_dungeon_runs")
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        data = extract_list(resp)
        meta = PaginationMeta(
            count=len(data),
            total=resp.count or 0,
            limit=limit,
            offset=offset,
        )
        return data, meta

    @staticmethod
    async def list_history_public(
        supabase: Client,
        simulation_id: UUID,
        *,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], PaginationMeta]:
        """Paginated completed run history (public, no auth)."""
        resp = await (
            supabase.table("resonance_dungeon_runs")
            .select(_PUBLIC_RUN_FIELDS, count="exact")
            .eq("simulation_id", str(simulation_id))
            .in_("status", _FINISHED_STATUSES)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        data = extract_list(resp)
        meta = PaginationMeta(
            count=len(data),
            total=resp.count or 0,
            limit=limit,
            offset=offset,
        )
        return data, meta

    @staticmethod
    async def get_agent_loot_effects(
        supabase: Client,
        agent_id: UUID,
        simulation_id: UUID,
    ) -> list[dict]:
        """Get persistent dungeon loot effects for an agent with run provenance."""
        resp = await (
            supabase.table("agent_dungeon_loot_effects")
            .select(
                "id, agent_id, effect_type, effect_params, source_run_id, "
                "source_loot_id, consumed, created_at, "
                "resonance_dungeon_runs!source_run_id(archetype, difficulty, completed_at)",
            )
            .eq("agent_id", str(agent_id))
            .eq("simulation_id", str(simulation_id))
            .order("created_at", desc=True)
            .execute()
        )

        # Flatten the joined run data into the response shape
        effects = []
        for row in extract_list(resp):
            run_data = row.pop("resonance_dungeon_runs", None) or {}
            effects.append(
                {
                    **row,
                    "source_archetype": run_data.get("archetype"),
                    "source_difficulty": run_data.get("difficulty"),
                    "source_completed_at": run_data.get("completed_at"),
                }
            )
        return effects
