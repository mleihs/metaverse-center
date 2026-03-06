"""Service for AI-generated simulation lore content."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from pydantic_ai import Agent

from backend.models.forge import ForgeLoreOutput, ForgeLoreTranslatedOutput
from backend.services.ai_utils import get_openrouter_model
from supabase import Client

logger = logging.getLogger(__name__)

BUREAU_ARCHIVIST_PROMPT = (
    "You are the Bureau Archivist at the Bureau of Impossible Geography. "
    "Your task is to write the foundational lore for a newly materialized simulation shard. "
    "This lore appears as the 'Lore Scroll' — the first thing a visitor reads.\n\n"
    "STRUCTURE RULES:\n"
    "- Generate 5-7 sections across 2-3 chapters.\n"
    "- Each chapter should have a thematic roman numeral arcanum (e.g. 'I', 'II', 'III').\n"
    "- Sections within a chapter share the same chapter name but have distinct titles.\n"
    "- Each section may optionally have an epigraph — a brief literary quote or motto.\n"
    "- The body should be 2-4 paragraphs of rich, atmospheric prose.\n"
    "- 2-3 sections should include an image_slug (snake_case identifier like 'city_gates', "
    "'council_chamber', 'harbor_mist') and an image_caption describing the scene.\n"
    "- Sections without images should have image_slug and image_caption as null.\n\n"
    "TONE:\n"
    "- Write as if documenting a real place that exists in a liminal bureaucratic multiverse.\n"
    "- Balance literary depth with accessibility. Evocative, not purple.\n"
    "- Weave the philosophical anchor's themes throughout.\n"
    "- Reference the actual agents, buildings, and geography by name to create coherence.\n"
    "- The first section should serve as a 'gateway' introduction to the world.\n"
    "- The last section should hint at the world's tensions and unresolved questions."
)

LORE_TRANSLATOR_PROMPT = (
    "You are a literary translator specializing in worldbuilding texts. "
    "Translate the following lore sections from English to German.\n\n"
    "RULES:\n"
    "- Preserve the literary tone, atmosphere, and stylistic register.\n"
    "- Keep proper nouns UNTRANSLATED (character names, place names, building names, "
    "district names). These are fictional names and must stay in their original form.\n"
    "- Translate chapter titles, section titles, epigraphs, body text, and image captions.\n"
    "- Maintain the same paragraph structure.\n"
    "- Use formal German (Sie-form is not needed — this is narrative prose, not addressing the reader).\n"
    "- Literary quotes in epigraphs: use the established German translation if it's a real quote, "
    "otherwise translate idiomatically.\n"
    "- The translation should read as if it was originally written in German."
)


class ForgeLoreService:
    """Generates and persists lore content for forged simulations."""

    @staticmethod
    async def generate_lore(
        seed: str,
        anchor: dict[str, Any],
        geography: dict[str, Any],
        agents: list[dict[str, Any]],
        buildings: list[dict[str, Any]],
        openrouter_key: str | None = None,
    ) -> list[dict[str, Any]]:
        """Generate lore sections via AI based on full world context.

        Returns a list of section dicts matching ForgeLoreSection fields.
        """
        logger.info("Generating lore for seed: %s", seed[:60])

        agent_names = ", ".join(a.get("name", "?") for a in agents[:12])
        building_names = ", ".join(b.get("name", "?") for b in buildings[:12])
        zone_names = ", ".join(z.get("name", "?") for z in geography.get("zones", []))

        prompt = (
            f"Write the founding lore for this simulation world:\n\n"
            f"SEED: {seed}\n\n"
            f"PHILOSOPHICAL ANCHOR:\n"
            f"  Title: {anchor.get('title', 'Unknown')}\n"
            f"  Core Question: {anchor.get('core_question', '')}\n"
            f"  Description: {anchor.get('description', '')}\n"
            f"  Literary Influence: {anchor.get('literary_influence', '')}\n\n"
            f"GEOGRAPHY:\n"
            f"  City: {geography.get('city_name', 'Unnamed')}\n"
            f"  Districts: {zone_names}\n\n"
            f"INHABITANTS: {agent_names}\n"
            f"STRUCTURES: {building_names}\n\n"
            f"Write the Lore Scroll. Reference specific places, people, and buildings "
            f"to make the world feel alive and interconnected."
        )

        agent = Agent(
            get_openrouter_model(openrouter_key),
            system_prompt=BUREAU_ARCHIVIST_PROMPT,
        )

        result = await agent.run(prompt, output_type=ForgeLoreOutput)
        sections = [s.model_dump() for s in result.output.sections]

        logger.info("Generated %d lore sections across chapters", len(sections))
        return sections

    @staticmethod
    async def translate_lore(
        sections: list[dict[str, Any]],
        openrouter_key: str | None = None,
    ) -> list[dict[str, Any]]:
        """Translate lore sections from English to German via AI.

        Returns a list of dicts with title_de, epigraph_de, body_de, image_caption_de.
        """
        logger.info("Translating %d lore sections to German", len(sections))

        # Build translation prompt with all sections
        section_texts = []
        for i, s in enumerate(sections):
            block = f"--- SECTION {i + 1} ---\n"
            block += f"Title: {s['title']}\n"
            if s.get("epigraph"):
                block += f"Epigraph: {s['epigraph']}\n"
            block += f"Body:\n{s['body']}\n"
            if s.get("image_caption"):
                block += f"Image Caption: {s['image_caption']}\n"
            section_texts.append(block)

        prompt = (
            f"Translate these {len(sections)} lore sections to German. "
            f"Return exactly {len(sections)} translated sections in the same order.\n\n"
            + "\n".join(section_texts)
        )

        agent = Agent(
            get_openrouter_model(openrouter_key),
            system_prompt=LORE_TRANSLATOR_PROMPT,
        )

        result = await agent.run(prompt, output_type=ForgeLoreTranslatedOutput)
        translations = [t.model_dump() for t in result.output.sections]

        logger.info("Translated %d sections to German", len(translations))
        return translations

    @staticmethod
    async def persist_lore(
        supabase: Client,
        simulation_id: UUID,
        sections: list[dict[str, Any]],
        translations: list[dict[str, Any]] | None = None,
    ) -> None:
        """Batch insert lore sections into simulation_lore table."""
        if not sections:
            logger.warning("No lore sections to persist for simulation %s", simulation_id)
            return

        rows = []
        for idx, section in enumerate(sections):
            row = {
                "simulation_id": str(simulation_id),
                "sort_order": idx,
                "chapter": section["chapter"],
                "arcanum": section["arcanum"],
                "title": section["title"],
                "epigraph": section.get("epigraph", ""),
                "body": section["body"],
                "image_slug": section.get("image_slug"),
                "image_caption": section.get("image_caption"),
            }
            # Merge German translations if available
            if translations and idx < len(translations):
                tr = translations[idx]
                row["title_de"] = tr.get("title")
                row["epigraph_de"] = tr.get("epigraph", "")
                row["body_de"] = tr.get("body")
                row["image_caption_de"] = tr.get("image_caption")
            rows.append(row)

        logger.info("Persisting %d lore sections for simulation %s", len(rows), simulation_id)
        supabase.table("simulation_lore").insert(rows).execute()
        logger.info("Lore persisted for simulation %s", simulation_id)
