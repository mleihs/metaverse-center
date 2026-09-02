"""Service layer for social trends operations."""

import logging
from datetime import UTC, datetime
from typing import ClassVar
from uuid import UUID

from backend.models.social_trend import TransformLens
from backend.services.generation_service import GenerationService
from backend.utils.errors import not_found, server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class SocialTrendsService:
    """Service for social trends CRUD and workflow operations."""

    @classmethod
    async def transform_article_content(
        cls,
        gen: GenerationService,
        *,
        title: str,
        platform: str,
        url: str | None = None,
        raw_data: dict | None = None,
        lens: TransformLens | None = None,
    ) -> dict:
        """Build the news-content block from raw article data and run the AI transformation.

        Shared by the trend-, article-, and batch-transform endpoints, which
        previously carried three identical copies of this assembly. Exceptions
        from the generation call propagate unchanged — each caller applies its
        own error policy (502 for single transforms, collected error entries
        for the batch).
        """
        raw = raw_data or {}
        news_content_parts = [
            raw.get("trail_text") or raw.get("description") or "",
            f"Source: {platform}",
        ]
        if url:
            news_content_parts.append(f"URL: {url}")
        if raw.get("byline") or raw.get("author"):
            news_content_parts.append(f"Author: {raw.get('byline') or raw.get('author')}")

        return await gen.generate_news_transformation(
            news_title=title,
            news_content="\n".join(news_content_parts),
            lens_directives=cls.render_lens_directives(lens),
            temperature=lens.creativity if lens else None,
        )

    #: Wie eine Tonlage im Prompt heisst. Der Zustand fuehrt die Kennung
    #: (`official`), das Modell braucht einen Satz.
    _TONE_DIRECTIVES: ClassVar[dict[str, str]] = {
        "official": "Write in the register of an official announcement: measured, impersonal, dated.",
        "propaganda": "Write as the authorities would want it read: confident, selective, reassuring.",
        "rumour": "Write as it travels by word of mouth: uncertain, partial, second-hand.",
        "record": "Write as a clerk would file it: terse, factual, without colour.",
    }

    @classmethod
    def render_lens_directives(cls, lens: TransformLens | None) -> str:
        """Die Linse als Anweisungsblock — oder ein Leerstring.

        WARUM EIN BLOCK UND NICHT VIER PLATZHALTER: `str.format` verlangt, dass
        jeder benannte Platzhalter geliefert wird. Vier einzelne (`{tone}`,
        `{zone_name}`, …) muessten also auch dann dastehen, wenn es keine Linse
        gibt — als Leerstellen mitten in Saetzen, die die Vorlage schreibt. Ein
        Block ist genau EIN Platzhalter, immer geliefert, und im Normalfall
        leer.

        Er wird ENGLISCH gebaut, wie die uebrigen Systemanweisungen: das ist die
        Sprache der Anweisung an das Modell, nicht die der Antwort. Fuer die
        Antwort sorgt `build_language_instruction`.
        """
        if lens is None:
            return ""

        lines: list[str] = []
        if lens.zone_name:
            lines.append(f"This happens in {lens.zone_name}. Name the place.")
        if lens.vector:
            lines.append(f"It travels along the {lens.vector} vector; let that shape what changes.")
        tone_line = cls._TONE_DIRECTIVES.get(lens.tone or "")
        if tone_line:
            lines.append(tone_line)
        if lens.instructions:
            lines.append(lens.instructions.strip())

        if not lines:
            return ""
        return "\n".join(("", "Additional direction:", *(f"- {line}" for line in lines), ""))

    @staticmethod
    async def list_trends(
        supabase: Client,
        simulation_id: UUID,
        *,
        platform: str | None = None,
        sentiment: str | None = None,
        is_processed: bool | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List social trends with optional filters."""
        query = (
            supabase.table("social_trends")
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .order("fetched_at", desc=True)
        )

        if platform:
            query = query.eq("platform", platform)
        if sentiment:
            query = query.eq("sentiment", sentiment)
        if is_processed is not None:
            query = query.eq("is_processed", is_processed)

        query = query.range(offset, offset + limit - 1)
        response = await query.execute()

        total = response.count if response.count is not None else len(extract_list(response))
        return extract_list(response), total

    @staticmethod
    async def get_trend(supabase: Client, simulation_id: UUID, trend_id: UUID) -> dict:
        """Get a single trend."""
        response = await (
            supabase.table("social_trends")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(trend_id))
            .limit(1)
            .execute()
        )
        if not response or not response.data:
            raise not_found(detail=f"Social trend '{trend_id}' not found.")
        return response.data[0]

    @staticmethod
    async def create_trend(supabase: Client, simulation_id: UUID, data: dict) -> dict:
        """Create a trend manually."""
        response = await supabase.table("social_trends").insert({**data, "simulation_id": str(simulation_id)}).execute()
        if not response.data:
            raise server_error("Failed to create social trend.")
        return response.data[0]

    @staticmethod
    async def store_fetched_trends(
        supabase: Client,
        simulation_id: UUID,
        trends: list[dict],
    ) -> list[dict]:
        """Store multiple fetched trends (upsert by name + platform)."""
        if not trends:
            return []

        rows = []
        for t in trends:
            rows.append(
                {
                    **t,
                    "simulation_id": str(simulation_id),
                    "fetched_at": datetime.now(UTC).isoformat(),
                }
            )

        response = await supabase.table("social_trends").insert(rows).execute()
        return extract_list(response)

    @staticmethod
    async def mark_processed(
        supabase: Client,
        simulation_id: UUID,
        trend_id: UUID,
    ) -> dict:
        """Mark a trend as processed."""
        response = await (
            supabase.table("social_trends")
            .update(
                {
                    "is_processed": True,
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            )
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(trend_id))
            .execute()
        )
        if not response.data:
            raise not_found(detail=f"Social trend '{trend_id}' not found.")
        return response.data[0]
