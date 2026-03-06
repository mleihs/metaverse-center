"""Service for translating entity fields from English to German."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from pydantic_ai import Agent

from backend.models.forge import ForgeEntityTranslationOutput
from backend.services.ai_utils import get_openrouter_model
from supabase import Client

logger = logging.getLogger(__name__)

ENTITY_TRANSLATOR_PROMPT = (
    "You are a professional translator for a narrative simulation platform. "
    "Translate entity descriptions from English to German.\n\n"
    "RULES:\n"
    "- Keep ALL proper nouns UNTRANSLATED: character names, place names, building names, "
    "zone names, street names. These are fictional and must stay in their original form.\n"
    "- Translate descriptive fields: character traits, backgrounds, professions, "
    "descriptions, building types, building conditions, zone types, street types.\n"
    "- Use formal German prose. No Sie-form needed (narrative context).\n"
    "- For short fields like building_type or zone_type, translate concisely "
    "(e.g., 'residential' → 'Wohngebiet', 'good' → 'gut', 'tavern' → 'Taverne').\n"
    "- The translation should read as if originally written in German.\n"
    "- Match the name field EXACTLY so translations can be merged back by name."
)


class ForgeEntityTranslationService:
    """Translates entity content fields from EN to DE after materialization."""

    @staticmethod
    async def translate_entities(
        agents: list[dict[str, Any]],
        buildings: list[dict[str, Any]],
        zones: list[dict[str, Any]],
        streets: list[dict[str, Any]],
        simulation_description: str,
        openrouter_key: str | None = None,
    ) -> ForgeEntityTranslationOutput:
        """Translate all entity fields in a single batch LLM call.

        Returns a ForgeEntityTranslationOutput with _de fields for each entity.
        """
        entity_count = len(agents) + len(buildings) + len(zones) + len(streets) + 1
        logger.info("Translating %d entities to German", entity_count)

        # Build translation prompt
        sections: list[str] = []

        sections.append("=== SIMULATION ===")
        sections.append(f"Description: {simulation_description}")

        sections.append("\n=== AGENTS ===")
        for a in agents:
            block = f"--- Agent: {a.get('name', '?')} ---\n"
            if a.get("character"):
                block += f"Character: {a['character']}\n"
            if a.get("background"):
                block += f"Background: {a['background']}\n"
            if a.get("primary_profession"):
                block += f"Primary Profession: {a['primary_profession']}\n"
            sections.append(block)

        sections.append("=== BUILDINGS ===")
        for b in buildings:
            block = f"--- Building: {b.get('name', '?')} ---\n"
            if b.get("description"):
                block += f"Description: {b['description']}\n"
            if b.get("building_type"):
                block += f"Building Type: {b['building_type']}\n"
            if b.get("building_condition"):
                block += f"Building Condition: {b['building_condition']}\n"
            sections.append(block)

        sections.append("=== ZONES ===")
        for z in zones:
            block = f"--- Zone: {z.get('name', '?')} ---\n"
            if z.get("description"):
                block += f"Description: {z['description']}\n"
            if z.get("zone_type"):
                block += f"Zone Type: {z['zone_type']}\n"
            sections.append(block)

        sections.append("=== STREETS ===")
        for s in streets:
            block = f"--- Street: {s.get('name', '?')} ---\n"
            if s.get("street_type"):
                block += f"Street Type: {s['street_type']}\n"
            sections.append(block)

        prompt = (
            f"Translate these {entity_count} entity descriptions to German. "
            "Return exactly the same number of entities in each category, "
            "with the name field matching the original exactly.\n\n"
            + "\n".join(sections)
        )

        agent = Agent(
            get_openrouter_model(openrouter_key),
            system_prompt=ENTITY_TRANSLATOR_PROMPT,
        )

        result = await agent.run(prompt, output_type=ForgeEntityTranslationOutput)
        output = result.output

        logger.info(
            "Translated %d agents, %d buildings, %d zones, %d streets",
            len(output.agents),
            len(output.buildings),
            len(output.zones),
            len(output.streets),
        )
        return output

    @staticmethod
    async def persist_translations(
        supabase: Client,
        simulation_id: UUID,
        translations: ForgeEntityTranslationOutput,
    ) -> None:
        """Write _de fields back to the entity tables."""
        sim_id = str(simulation_id)

        # Update simulation description_de
        if translations.simulation.description_de:
            supabase.table("simulations").update(
                {"description_de": translations.simulation.description_de}
            ).eq("id", sim_id).execute()
            logger.info("Updated simulation description_de for %s", sim_id)

        # Update agents by name match
        for at in translations.agents:
            update_data: dict[str, str] = {}
            if at.character_de:
                update_data["character_de"] = at.character_de
            if at.background_de:
                update_data["background_de"] = at.background_de
            if at.primary_profession_de:
                update_data["primary_profession_de"] = at.primary_profession_de
            if update_data:
                supabase.table("agents").update(update_data).eq(
                    "simulation_id", sim_id
                ).eq("name", at.name).execute()

        logger.info("Updated %d agent translations for %s", len(translations.agents), sim_id)

        # Update buildings by name match
        for bt in translations.buildings:
            update_data = {}
            if bt.description_de:
                update_data["description_de"] = bt.description_de
            if bt.building_type_de:
                update_data["building_type_de"] = bt.building_type_de
            if bt.building_condition_de:
                update_data["building_condition_de"] = bt.building_condition_de
            if update_data:
                supabase.table("buildings").update(update_data).eq(
                    "simulation_id", sim_id
                ).eq("name", bt.name).execute()

        logger.info("Updated %d building translations for %s", len(translations.buildings), sim_id)

        # Update zones by name match
        for zt in translations.zones:
            update_data = {}
            if zt.description_de:
                update_data["description_de"] = zt.description_de
            if zt.zone_type_de:
                update_data["zone_type_de"] = zt.zone_type_de
            if update_data:
                supabase.table("zones").update(update_data).eq(
                    "simulation_id", sim_id
                ).eq("name", zt.name).execute()

        logger.info("Updated %d zone translations for %s", len(translations.zones), sim_id)

        # Update streets by name match
        for st in translations.streets:
            update_data = {}
            if st.street_type_de:
                update_data["street_type_de"] = st.street_type_de
            if update_data:
                supabase.table("city_streets").update(update_data).eq(
                    "simulation_id", sim_id
                ).eq("name", st.name).execute()

        logger.info("Updated %d street translations for %s", len(translations.streets), sim_id)
