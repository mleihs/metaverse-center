"""Service for compiling Simulation Broadsheet editions.

Aggregates events, agent activities, resonance impacts, and gazette echoes
into a single "finishable" edition (max 7 articles) with frozen health/mood
snapshots and an editorial voice derived from simulation health.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from backend.utils.errors import not_found
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Zetland principle: max articles per edition
FINISHABLE_LIMIT = 7


class BroadsheetService:
    """Aggregates all news sources into a unified broadsheet edition."""

    # ── Source data ──────────────────────────────────────────────────────────

    @classmethod
    async def get_source_data(
        cls,
        supabase: Client,
        simulation_id: UUID,
        period_start: datetime,
        period_end: datetime,
    ) -> dict:
        """Fetch aggregated broadsheet source data via RPC (migration 186)."""
        response = await supabase.rpc(
            "get_broadsheet_source_data",
            {
                "p_simulation_id": str(simulation_id),
                "p_period_start": period_start.isoformat(),
                "p_period_end": period_end.isoformat(),
            },
        ).execute()
        return response.data if response.data else {
            "events": [],
            "activities": [],
            "resonance_impacts": [],
            "mood_summary": {},
            "gazette_entries": [],
            "health": None,
        }

    # ── Compile edition ─────────────────────────────────────────────────────

    @classmethod
    async def compile_edition(
        cls,
        supabase: Client,
        simulation_id: UUID,
        period_start: datetime,
        period_end: datetime,
    ) -> dict:
        """Compile a new broadsheet edition from aggregated world data."""
        # 1. Fetch source data via RPC
        source = await cls.get_source_data(supabase, simulation_id, period_start, period_end)

        # 2. Rank and deduplicate into articles
        articles = cls._rank_articles(source)[:FINISHABLE_LIMIT]

        # 3. Determine editorial voice from health (Frostpunk moral mirror)
        health = source.get("health") or {}
        voice = cls._derive_voice(health)

        # 4. Compute statistics snapshot
        statistics = cls._compute_statistics(source)

        # 5. Build title from top article or fallback
        title = articles[0]["headline"] if articles else "No News to Report"

        # 6. Persist via atomic RPC (advisory lock prevents edition number race)
        record = {
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "title": title,
            "articles": articles,
            "health_snapshot": health if health else None,
            "mood_snapshot": source.get("mood_summary"),
            "statistics": statistics,
            "gazette_wire": source.get("gazette_entries", []),
            "editorial_voice": voice,
            "model_used": "aggregation_v1",
            "published_at": datetime.now(UTC).isoformat(),
        }
        resp = await supabase.rpc(
            "insert_broadsheet_edition",
            {"p_simulation_id": str(simulation_id), "p_data": record},
        ).execute()
        return resp.data

    # ── Article ranking ─────────────────────────────────────────────────────

    @classmethod
    def _rank_articles(cls, source: dict) -> list[dict]:
        """Priority: critical events > resonances > high-significance activities > gazette."""
        ranked: list[dict] = []

        for event in source.get("events", []):
            impact = event.get("impact_level") or 0
            ranked.append({
                "source_type": "event",
                "source_id": str(event.get("id", "")),
                "priority": impact * 10,
                "headline": event.get("title", "Untitled Event"),
                "headline_de": event.get("title_de"),
                "content": event.get("description", ""),
                "content_de": event.get("description_de"),
                "layout_hint": "hero" if impact >= 8 else "column",
                "impact_level": impact,
                "tags": event.get("tags"),
            })

        for impact in source.get("resonance_impacts", []):
            magnitude = impact.get("effective_magnitude") or 0
            ranked.append({
                "source_type": "resonance",
                "source_id": str(impact.get("id", "")),
                "priority": int(magnitude * 80),
                "headline": impact.get("resonance_title", "Cross-Reality Disturbance"),
                "content": impact.get("narrative_context", ""),
                "layout_hint": "column",
            })

        for activity in source.get("activities", []):
            significance = activity.get("significance") or 0
            agent_name = activity.get("agent_name", "Unknown")
            ranked.append({
                "source_type": "activity",
                "source_id": str(activity.get("id", "")),
                "priority": significance * 8,
                "headline": f"{agent_name}: {activity.get('activity_type', 'activity')}",
                "content": activity.get("narrative_text", ""),
                "content_de": activity.get("narrative_text_de"),
                "layout_hint": "sidebar",
                "agent_name": agent_name,
            })

        ranked.sort(key=lambda a: a["priority"], reverse=True)

        # Ensure max 1 hero article
        hero_found = False
        for article in ranked:
            if article["layout_hint"] == "hero":
                if hero_found:
                    article["layout_hint"] = "column"
                hero_found = True

        return ranked

    # ── Editorial voice ─────────────────────────────────────────────────────

    @classmethod
    def _derive_voice(cls, health: dict) -> str:
        """Frostpunk moral mirror: health determines editorial tone."""
        overall = health.get("overall_health")
        if overall is None:
            return "neutral"
        pct = overall * 100
        if pct < 25:
            return "alarmed"
        if pct < 50:
            return "concerned"
        if pct > 85:
            return "optimistic"
        return "neutral"

    # ── Statistics ───────────────────────────────────────────────────────────

    @classmethod
    def _compute_statistics(cls, source: dict) -> dict:
        """Compute aggregate statistics from source data."""
        return {
            "event_count": len(source.get("events", [])),
            "activity_count": len(source.get("activities", [])),
            "resonance_count": len(source.get("resonance_impacts", [])),
        }

    # ── List / Get ──────────────────────────────────────────────────────────

    @classmethod
    async def list(
        cls,
        supabase: Client,
        simulation_id: UUID,
        limit: int = 10,
        offset: int = 0,
    ) -> tuple[list, int]:
        """List broadsheet editions, paginated."""
        response = await (
            supabase.table("simulation_broadsheets")
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .order("edition_number", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        data = extract_list(response)
        total = response.count if response.count is not None else len(data)
        return data, total

    @classmethod
    async def get_latest(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> dict | None:
        """Get the latest broadsheet edition for a simulation."""
        response = await (
            supabase.table("simulation_broadsheets")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .order("edition_number", desc=True)
            .limit(1)
            .execute()
        )
        data = extract_list(response)
        return data[0] if data else None

    @classmethod
    async def get(
        cls,
        supabase: Client,
        simulation_id: UUID,
        broadsheet_id: UUID,
    ) -> dict:
        """Get a single broadsheet edition."""
        response = await (
            supabase.table("simulation_broadsheets")
            .select("*")
            .eq("id", str(broadsheet_id))
            .eq("simulation_id", str(simulation_id))
            .limit(1)
            .execute()
        )
        if not response.data:
            raise not_found(detail="Broadsheet edition not found.")
        return response.data[0]
