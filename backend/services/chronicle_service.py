"""Service for generating AI chronicle editions (per-simulation newspaper)."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from uuid import UUID

from backend.config import settings
from backend.services.generation_service import GenerationService
from backend.services.translation_service import schedule_auto_translation
from supabase import Client

logger = logging.getLogger(__name__)

MOCK_CHRONICLE = {
    "title": "The Pulse of the City — Edition #{edition_number}",
    "headline": "Shadows lengthen as tensions rise across the districts.",
    "content": (
        "Another cycle turns in this restless city. Events of note ripple through "
        "every quarter — alliances shift, buildings crumble, and whispered echoes "
        "from foreign realities bleed through the walls of our embassies.\n\n"
        "Citizens report unease. The state assures all is well. As always, the "
        "truth lies somewhere in between, buried beneath layers of propaganda "
        "and good intentions.\n\n"
        "This edition serves as the official record. Read it. Believe what you must."
    ),
}


class ChronicleService:
    """Generates per-simulation AI newspaper editions from aggregated world data."""

    @classmethod
    async def get_source_data(
        cls,
        supabase: Client,
        simulation_id: UUID,
        period_start: datetime,
        period_end: datetime,
    ) -> dict:
        """Fetch aggregated chronicle source data via Postgres ``get_chronicle_source_data`` (migration 066)."""
        response = supabase.rpc(
            "get_chronicle_source_data",
            {
                "p_simulation_id": str(simulation_id),
                "p_period_start": period_start.isoformat(),
                "p_period_end": period_end.isoformat(),
            },
        ).execute()
        return response.data if response.data else {
            "events": [],
            "echoes": [],
            "battle_entries": [],
            "reactions": [],
            "event_count": 0,
        }

    @classmethod
    async def generate(
        cls,
        supabase: Client,
        simulation_id: UUID,
        period_start: datetime,
        period_end: datetime,
        epoch_id: UUID | None = None,
        locale: str = "en",
    ) -> dict:
        """Generate a new chronicle edition."""
        # Get next edition number
        max_resp = (
            supabase.table("simulation_chronicles")
            .select("edition_number")
            .eq("simulation_id", str(simulation_id))
            .order("edition_number", desc=True)
            .limit(1)
            .execute()
        )
        next_edition = (max_resp.data[0]["edition_number"] + 1) if max_resp.data else 1

        # Mock mode
        if settings.forge_mock_mode:
            logger.info("MOCK_MODE: returning template chronicle edition %d", next_edition)
            record = {
                "simulation_id": str(simulation_id),
                "epoch_id": str(epoch_id) if epoch_id else None,
                "edition_number": next_edition,
                "period_start": period_start.isoformat(),
                "period_end": period_end.isoformat(),
                "title": MOCK_CHRONICLE["title"].format(edition_number=next_edition),
                "headline": MOCK_CHRONICLE["headline"],
                "content": MOCK_CHRONICLE["content"],
                "model_used": "mock",
            }
            resp = supabase.table("simulation_chronicles").insert(record).execute()
            return resp.data[0]

        # Fetch source data
        source = await cls.get_source_data(supabase, simulation_id, period_start, period_end)

        # Get simulation name for prompt
        sim_resp = (
            supabase.table("simulations")
            .select("name, theme")
            .eq("id", str(simulation_id))
            .limit(1)
            .execute()
        )
        sim_name = sim_resp.data[0]["name"] if sim_resp.data else "Unknown"
        sim_theme = sim_resp.data[0].get("theme", "dystopian") if sim_resp.data else "dystopian"

        # Generate via GenerationService
        gen = GenerationService(supabase, simulation_id, settings.openrouter_api_key)
        result = await gen._generate(
            template_type="chronicle_generation",
            model_purpose="event_generation",
            variables={
                "edition_number": str(next_edition),
                "simulation_name": sim_name,
                "period_start": period_start.strftime("%Y-%m-%d"),
                "period_end": period_end.strftime("%Y-%m-%d"),
                "event_summary": json.dumps(source.get("events", []), default=str),
                "echo_summary": json.dumps(source.get("echoes", []), default=str),
                "battle_summary": json.dumps(source.get("battle_entries", []), default=str),
                "reaction_summary": json.dumps(source.get("reactions", []), default=str),
            },
            locale=locale,
        )

        # Parse JSON response
        parsed = GenerationService._parse_json_content(result.get("content", ""))
        title = parsed.get("title", f"Chronicle Edition #{next_edition}") if parsed else f"Chronicle Edition #{next_edition}"
        headline = parsed.get("headline") if parsed else None
        content = parsed.get("content", result.get("content", "")) if parsed else result.get("content", "")

        # Persist
        record = {
            "simulation_id": str(simulation_id),
            "epoch_id": str(epoch_id) if epoch_id else None,
            "edition_number": next_edition,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "title": title,
            "headline": headline,
            "content": content,
            "model_used": result.get("model_used"),
        }
        resp = supabase.table("simulation_chronicles").insert(record).execute()
        saved = resp.data[0]

        # Fire-and-forget translation
        schedule_auto_translation(
            supabase,
            "simulation_chronicles",
            saved["id"],
            {"title": title, "headline": headline or "", "content": content},
            sim_name,
            sim_theme,
            entity_type="chronicle",
        )

        return saved

    @classmethod
    async def list(
        cls,
        supabase: Client,
        simulation_id: UUID,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list, int]:
        """List chronicle editions, paginated."""
        response = (
            supabase.table("simulation_chronicles")
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .order("edition_number", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        data = response.data or []
        total = response.count if response.count is not None else len(data)
        return data, total

    @classmethod
    async def get(
        cls,
        supabase: Client,
        simulation_id: UUID,
        chronicle_id: UUID,
    ) -> dict:
        """Get a single chronicle edition."""
        response = (
            supabase.table("simulation_chronicles")
            .select("*")
            .eq("id", str(chronicle_id))
            .eq("simulation_id", str(simulation_id))
            .limit(1)
            .execute()
        )
        if not response.data:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chronicle edition not found.",
            )
        return response.data[0]
