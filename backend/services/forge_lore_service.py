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
    "You are not summarizing a world. You are performing RESEARCH — establishing the cosmological "
    "identity, visual language, and narrative logic that will define how this Shard looks, feels, "
    "and behaves. Every image, portrait, and building illustration will be generated FROM this "
    "lore. Your writing IS the world's visual brief.\n\n"
    #
    # ── Structure ──────────────────────────────────────────────
    #
    "STRUCTURE RULES:\n"
    "- Generate 5-7 sections across 2-3 chapters.\n"
    "- Each chapter should have a thematic roman numeral arcanum (e.g. 'I', 'II', 'III').\n"
    "- Sections within a chapter share the same chapter name but have distinct titles.\n"
    "- Each section may optionally have an epigraph — a brief literary quote or motto.\n"
    "- The body should be 2-4 paragraphs of rich, atmospheric prose.\n"
    "- 2-3 sections should include an image_slug (snake_case identifier like 'city_gates', "
    "'council_chamber', 'harbor_mist') and an image_caption describing the scene visually.\n"
    "- Sections without images should have image_slug and image_caption as null.\n\n"
    #
    # ── Research Tasks (concept-lore quality) ──────────────────
    #
    "RESEARCH TASKS — your lore must ESTABLISH these:\n\n"
    "1. VISUAL IDENTITY: In the first section, describe the world's dominant materials, "
    "light quality, weather patterns, and architectural character. This is the visual "
    "vocabulary that all images will draw from. Be SPECIFIC — not 'dark and mysterious' "
    "but 'basalt corridors lit by bioluminescent lichen, perpetual rain on copper rooftops, "
    "pneumatic tubes carrying compressed memories between archive towers.'\n\n"
    "2. BLEED SIGNATURE: Define how this world's essence would contaminate adjacent realities. "
    "What leaks out? (Sound? Temperature? Grammar? Gravity?) How does the contamination "
    "manifest physically? This is unique to each Shard.\n\n"
    "3. COMPETING ACCOUNTS: Present at least 2 different interpretations of the world's "
    "origin or nature. Characters, institutions, or factions should disagree. Truth is "
    "epistemologically unstable in the multiverse.\n\n"
    "4. INSTITUTIONAL LOGIC: Establish the systems that govern this world — bureaucracies, "
    "rituals, economies, or customs. Not just what exists, but WHY it exists and what "
    "happens when it breaks.\n\n"
    "5. DOCUMENT DEGRADATION: 1-3 times across all sections, use markers like [CONSUMED], "
    "[DEGRADED], [ILLEGIBLE], or [REDACTED] to suggest the phenomenon corrupts its own "
    "documentation. The degradation pattern should match the world's theme "
    "(a fire-world burns its margins; a memory-world loses proper nouns).\n\n"
    #
    # ── Tone & Technique ──────────────────────────────────────
    #
    "TONE & TECHNIQUE:\n"
    "- Write as if documenting a real place that exists in a liminal bureaucratic multiverse.\n"
    "- Balance literary depth with accessibility. Evocative, not purple.\n"
    "- Use SEMANTIC LAYERING: 'X is not Y; X is Z' — redefine concepts through contrast.\n"
    "- Use INSTITUTIONAL HUMOUR: absurdity within logical frameworks. Bureaucracy as horror.\n"
    "- Use FRAGMENT ARCHAEOLOGY: imply inaccessible truths through truncation, contradictory "
    "accounts, margin notes, or incomplete citations.\n"
    "- Alternate voice registers: archival-scholarly, bureaucratic-clinical, "
    "poetic-intimate, oracular-compressed. Rotate every 300-500 words.\n"
    "- Weave the philosophical anchor's themes throughout as structural DNA, not decoration.\n"
    "- Reference the actual agents, buildings, and geography by name. Ground the cosmic "
    "in the local — a universal theme should manifest as a specific smell, a specific "
    "door, a specific conversation overheard in a specific district.\n"
    "- The first section must serve as a 'gateway' — establish visual identity immediately.\n"
    "- The last section should hint at the world's unresolved tensions and open questions.\n"
    "- image_caption fields must be VISUAL DESCRIPTIONS of the scene (materials, light, "
    "composition, atmosphere) — these will be used as image generation prompts.\n\n"
    #
    # ── Research Grounding ──────────────────────────────────────
    #
    "RESEARCH GROUNDING (CRITICAL):\n"
    "Your lore must be grounded in REAL intellectual traditions, not generic fantasy.\n"
    "- Epigraphs: use quotes from real authors (cite author and work). Choose from "
    "the literary influence specified in the anchor, or from adjacent traditions.\n"
    "- Architectural descriptions: reference specific real-world movements and materials "
    "(e.g., 'Brutalist béton brut', 'Art Nouveau ironwork', 'Metabolist megastructures', "
    "'Deconstructivist angles'). Name specific architects or buildings if appropriate.\n"
    "- Philosophical underpinning: weave specific concepts from real thinkers "
    "(e.g., Foucault's panopticon, Bergson's durée, Borges' infinite library) "
    "into the world's logic — not as name-drops but as structural DNA.\n"
    "- If research context is provided below, use it as your primary reference material. "
    "Adapt and transform — do not copy verbatim."
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
        research_context: str = "",
    ) -> list[dict[str, Any]]:
        """Generate lore sections via AI based on full world context + research.

        The ``research_context`` parameter carries web-sourced literary,
        philosophical, and architectural research that grounds the lore in
        real-world references — producing concept-lore-quality output.

        Returns a list of section dicts matching ForgeLoreSection fields.
        """
        logger.debug("Generating lore", extra={"seed_preview": seed[:60]})

        agent_names = ", ".join(a.get("name", "?") for a in agents[:12])
        building_names = ", ".join(b.get("name", "?") for b in buildings[:12])
        zone_names = ", ".join(z.get("name", "?") for z in geography.get("zones", []))

        # Build agent details block — character + background for grounding
        agent_details = []
        for a in agents[:8]:
            name = a.get("name", "?")
            prof = a.get("primary_profession", "")
            char_snippet = (a.get("character", "") or "")[:150]
            agent_details.append(f"  - {name} ({prof}): {char_snippet}")
        agent_block = "\n".join(agent_details) if agent_details else agent_names

        # Build building details block
        building_details = []
        for b in buildings[:8]:
            name = b.get("name", "?")
            btype = b.get("building_type", "")
            desc_snippet = (b.get("description", "") or "")[:150]
            building_details.append(f"  - {name} ({btype}): {desc_snippet}")
        building_block = "\n".join(building_details) if building_details else building_names

        # Build the research section
        research_block = ""
        if research_context:
            research_block = (
                f"══════════════════════════════════════════════\n"
                f"WEB RESEARCH — use this to ground your lore in real literary,\n"
                f"philosophical, and architectural references. Cite specific works,\n"
                f"authors, and movements. Adapt and transform — do not copy.\n"
                f"══════════════════════════════════════════════\n\n"
                f"{research_context}\n\n"
                f"══════════════════════════════════════════════\n\n"
            )

        prompt = (
            f"{research_block}"
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
            f"INHABITANTS:\n{agent_block}\n\n"
            f"STRUCTURES:\n{building_block}\n\n"
            f"Write the Lore Scroll. Use the research above to ground your writing "
            f"in specific literary traditions, philosophical frameworks, and "
            f"architectural vocabularies. Reference specific places, people, and "
            f"buildings to make the world feel alive and interconnected. "
            f"Epigraphs should draw from real literary works when possible."
        )

        agent = Agent(
            get_openrouter_model(openrouter_key),
            system_prompt=BUREAU_ARCHIVIST_PROMPT,
        )

        result = await agent.run(prompt, output_type=ForgeLoreOutput)
        sections = [s.model_dump() for s in result.output.sections]

        logger.debug("Lore sections generated", extra={"section_count": len(sections)})
        return sections

    @staticmethod
    async def translate_lore(
        sections: list[dict[str, Any]],
        openrouter_key: str | None = None,
    ) -> list[dict[str, Any]]:
        """Translate lore sections from English to German via AI.

        Returns a list of dicts with title_de, epigraph_de, body_de, image_caption_de.
        """
        logger.debug("Translating lore sections", extra={"section_count": len(sections)})

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

        logger.debug("Lore sections translated", extra={"section_count": len(translations)})
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

        logger.debug(
            "Persisting lore sections",
            extra={"section_count": len(rows), "simulation_id": str(simulation_id)},
        )
        supabase.table("simulation_lore").insert(rows).execute()
        logger.debug("Lore persisted", extra={"simulation_id": str(simulation_id)})
