#!/usr/bin/env python3
"""One-shot script: generate DE translations for an existing production simulation.

Usage:
    source backend/.venv/bin/activate
    python3 scripts/translate_simulation.py [SIMULATION_ID]

Connects to production Supabase (service_role), fetches entities,
runs lore + entity translation via OpenRouter, persists _de fields.
"""

import asyncio
import json
import logging
import subprocess
import sys

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("translate_simulation")

PROD_URL = "https://bffjoupddfjaljqrwqck.supabase.co"

# Default: The Panopticon of Good Taste
DEFAULT_SIM_ID = "ef22df3e-8c19-48b1-b068-5e3f97221c30"


def get_prod_key() -> str:
    result = subprocess.run(
        ["railway", "variables", "--json"],
        capture_output=True, text=True,
    )
    data = json.loads(result.stdout)
    return data["SUPABASE_SERVICE_ROLE_KEY"]


async def main():
    sim_id = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SIM_ID

    logger.info("Fetching production service role key from Railway...")
    prod_key = get_prod_key()

    # Get OpenRouter key from local .env
    or_key = None
    try:
        with open(".env") as f:
            for line in f:
                if line.startswith("OPENROUTER_API_KEY="):
                    or_key = line.strip().split("=", 1)[1]
                    break
    except FileNotFoundError:
        pass

    if not or_key:
        logger.error("OPENROUTER_API_KEY not found in .env")
        sys.exit(1)

    logger.info("Connecting to production Supabase...")
    from supabase import create_client
    supabase = create_client(PROD_URL, prod_key)

    # Verify simulation exists
    sim_resp = supabase.table("simulations").select(
        "id, name, description, description_de"
    ).eq("id", sim_id).single().execute()
    sim = sim_resp.data
    logger.info("Simulation: %s", sim["name"])

    # ── 1. Lore translations ──
    lore_resp = supabase.table("simulation_lore").select(
        "id, title, epigraph, body, image_caption, title_de"
    ).eq("simulation_id", sim_id).order("sort_order").execute()
    lore_sections = lore_resp.data or []

    untranslated_lore = [s for s in lore_sections if not s.get("title_de")]
    logger.info("Lore sections: %d total, %d need translation", len(lore_sections), len(untranslated_lore))

    if untranslated_lore:
        from backend.services.forge_lore_service import ForgeLoreService
        translations = await ForgeLoreService.translate_lore(untranslated_lore, openrouter_key=or_key)

        for idx, section in enumerate(untranslated_lore):
            if idx < len(translations):
                tr = translations[idx]
                update = {}
                if tr.get("title"):
                    update["title_de"] = tr["title"]
                if tr.get("epigraph"):
                    update["epigraph_de"] = tr["epigraph"]
                if tr.get("body"):
                    update["body_de"] = tr["body"]
                if tr.get("image_caption"):
                    update["image_caption_de"] = tr["image_caption"]
                if update:
                    supabase.table("simulation_lore").update(update).eq(
                        "id", section["id"]
                    ).execute()
        logger.info("Lore translations persisted: %d sections", len(translations))
    else:
        logger.info("All lore already translated, skipping")

    # ── 2. Entity translations ──
    agents = (supabase.table("agents").select(
        "name, character, background, primary_profession, character_de"
    ).eq("simulation_id", sim_id).execute()).data or []

    buildings = (supabase.table("buildings").select(
        "name, description, building_type, building_condition, description_de"
    ).eq("simulation_id", sim_id).execute()).data or []

    zones = (supabase.table("zones").select(
        "name, description, zone_type, description_de"
    ).eq("simulation_id", sim_id).execute()).data or []

    streets = (supabase.table("city_streets").select(
        "name, street_type, street_type_de"
    ).eq("simulation_id", sim_id).execute()).data or []

    untranslated_agents = [a for a in agents if not a.get("character_de")]
    untranslated_buildings = [b for b in buildings if not b.get("description_de")]
    untranslated_zones = [z for z in zones if not z.get("description_de")]
    untranslated_streets = [s for s in streets if not s.get("street_type_de")]

    total_untranslated = len(untranslated_agents) + len(untranslated_buildings) + len(untranslated_zones) + len(untranslated_streets)
    sim_needs_description_de = not sim.get("description_de")

    logger.info(
        "Entities needing translation: %d agents, %d buildings, %d zones, %d streets | description_de missing: %s",
        len(untranslated_agents), len(untranslated_buildings),
        len(untranslated_zones), len(untranslated_streets),
        sim_needs_description_de,
    )

    if total_untranslated > 0 or sim_needs_description_de:
        from backend.services.forge_entity_translation_service import ForgeEntityTranslationService

        # Use all entities for translation if description_de is needed but entities are done
        translate_agents = untranslated_agents if untranslated_agents else []
        translate_buildings = untranslated_buildings if untranslated_buildings else []
        translate_zones = untranslated_zones if untranslated_zones else []
        translate_streets = untranslated_streets if untranslated_streets else []

        entity_translations = await ForgeEntityTranslationService.translate_entities(
            agents=translate_agents,
            buildings=translate_buildings,
            zones=translate_zones,
            streets=translate_streets,
            simulation_description=sim.get("description", ""),
            openrouter_key=or_key,
        )
        await ForgeEntityTranslationService.persist_translations(
            supabase, sim_id, entity_translations,
        )
        logger.info("Entity translations persisted")

        if entity_translations.simulation.description_de:
            logger.info("Simulation description_de: %s", entity_translations.simulation.description_de[:80])
    else:
        logger.info("All entities already translated, skipping")

    logger.info("Done! All translations for '%s' complete.", sim["name"])


if __name__ == "__main__":
    asyncio.run(main())
