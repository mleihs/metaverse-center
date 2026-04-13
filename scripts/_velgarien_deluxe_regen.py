#!/usr/bin/env python3
"""Velgarien Deluxe Image Regeneration — flux-2-max, A.6 templates, full pipeline.

Phase 1: Run A.6 (simulation-specific prompt templates from lore)
Phase 2: Generate all images via ForgeImageService against PRODUCTION
         - 1 banner
         - 9 agent portraits
         - 9 building images
         - 3 lore images
         Total: 22 images × $0.073/max = ~$1.61

Usage:
    source backend/.venv/bin/activate
    python scripts/_velgarien_deluxe_regen.py
    python scripts/_velgarien_deluxe_regen.py --images-only    # skip A.6
    python scripts/_velgarien_deluxe_regen.py --dry-run
"""

import argparse
import asyncio
import json
import logging
import os
import subprocess
import sys
from uuid import UUID

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("ENVIRONMENT", "development")

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SIM_ID = UUID("10000000-0000-0000-0000-000000000001")
SIM_SLUG = "velgarien"


def get_prod_service_key() -> str:
    result = subprocess.check_output(["railway", "variables", "--json"], timeout=15)
    return json.loads(result)["SUPABASE_SERVICE_ROLE_KEY"]


async def create_prod_supabase():
    """Create an async Supabase client pointing to PRODUCTION."""
    from supabase import acreate_client

    prod_url = "https://bffjoupddfjaljqrwqck.supabase.co"
    prod_key = get_prod_service_key()
    return await acreate_client(prod_url, prod_key)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Velgarien deluxe image regeneration")
    parser.add_argument("--images-only", action="store_true", help="Skip A.6, generate images only")
    parser.add_argument("--dry-run", action="store_true", help="List entities without generating")
    args = parser.parse_args()

    supabase = await create_prod_supabase()
    logger.info("Connected to PRODUCTION Supabase")

    replicate_key = os.environ.get("REPLICATE_API_TOKEN")
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")

    if not replicate_key:
        logger.error("REPLICATE_API_TOKEN not set")
        return

    # ── Phase 1: A.6 Templates ───────────────────────────────────────────
    if not args.images_only:
        from backend.services.forge_theme_service import ForgeThemeService

        logger.info("\n═══ Phase A.6: Generating world-specific prompt templates ═══\n")
        if not args.dry_run:
            await ForgeThemeService.generate_simulation_templates(
                supabase, SIM_ID, openrouter_key=openrouter_key,
            )
            logger.info("✓ Templates generated")
        else:
            logger.info("[DRY RUN] Would generate A.6 templates")

    # ── Phase 2: Build world context ─────────────────────────────────────
    lore_resp = await (
        supabase.table("simulation_lore")
        .select("title, body")
        .eq("simulation_id", str(SIM_ID))
        .order("sort_order")
        .limit(4)
        .execute()
    )
    world_context = "\n".join(
        f"{s['title']}: {(s.get('body') or '')[:400]}" for s in lore_resp.data or []
    )

    from backend.services.forge_image_service import ForgeImageService
    from backend.utils.responses import extract_list
    from scripts._velgarien_image_prompts import AGENT_PROMPTS, BUILDING_PROMPTS, LORE_PROMPTS

    image_service = ForgeImageService(
        supabase, SIM_ID,
        replicate_api_key=replicate_key,
        openrouter_api_key=openrouter_key,
        world_context=world_context,
    )

    results = {"ok": 0, "fail": 0}

    # ── Banner ───────────────────────────────────────────────────────────
    sim_resp = await supabase.table("simulations").select("*").eq("id", str(SIM_ID)).single().execute()
    sim = sim_resp.data or {}
    logger.info("\n═══ BANNER ═══")
    if args.dry_run:
        logger.info("[DRY RUN] banner: %s", sim.get("name"))
    else:
        try:
            url = await image_service.generate_banner_image(
                sim.get("name", "Velgarien"),
                sim.get("description", ""),
                anchor_data=None,
            )
            logger.info("✓ banner → %s", url)
            results["ok"] += 1
        except Exception as e:
            logger.error("✗ banner FAILED: %s", e)
            results["fail"] += 1

    # ── Agents ───────────────────────────────────────────────────────────
    agents_resp = await (
        supabase.table("agents").select("*")
        .eq("simulation_id", str(SIM_ID))
        .is_("deleted_at", "null")
        .order("name")
        .execute()
    )
    agents = extract_list(agents_resp)
    logger.info("\n═══ AGENTS (%d, flux-2-max) ═══", len(agents))

    for idx, agent in enumerate(agents):
        name = agent["name"]
        if args.dry_run:
            logger.info("[DRY RUN] #%d %s", idx + 1, name)
            continue

        override = AGENT_PROMPTS.get(name)
        logger.info("Generating #%d/%d: %s [%s]...", idx + 1, len(agents), name,
                     "handcrafted" if override else "auto")
        try:
            url = await image_service.generate_agent_portrait(
                UUID(agent["id"]),
                name,
                agent_data={
                    "character": agent.get("character", ""),
                    "background": agent.get("background", ""),
                },
                description_override=override,
            )
            logger.info("✓ %s → %s", name, url)
            results["ok"] += 1
        except Exception as e:
            logger.error("✗ %s FAILED: %s", name, e)
            results["fail"] += 1
        await asyncio.sleep(2)

    # ── Buildings ────────────────────────────────────────────────────────
    buildings_resp = await (
        supabase.table("buildings").select("*")
        .eq("simulation_id", str(SIM_ID))
        .is_("deleted_at", "null")
        .order("name")
        .execute()
    )
    buildings = extract_list(buildings_resp)
    logger.info("\n═══ BUILDINGS (%d, flux-2-max) ═══", len(buildings))

    for idx, bldg in enumerate(buildings):
        name = bldg["name"]
        if args.dry_run:
            logger.info("[DRY RUN] #%d %s", idx + 1, name)
            continue

        override = BUILDING_PROMPTS.get(name)
        logger.info("Generating #%d/%d: %s [%s]...", idx + 1, len(buildings), name,
                     "handcrafted" if override else "auto")
        try:
            url = await image_service.generate_building_image(
                UUID(bldg["id"]),
                name,
                bldg.get("building_type", "government"),
                building_data={
                    "description": bldg.get("description", ""),
                    "building_condition": bldg.get("building_condition", ""),
                },
                description_override=override,
            )
            logger.info("✓ %s → %s", name, url)
            results["ok"] += 1
        except Exception as e:
            logger.error("✗ %s FAILED: %s", name, e)
            results["fail"] += 1
        await asyncio.sleep(2)

    # ── Lore ─────────────────────────────────────────────────────────────
    lore_resp = await (
        supabase.table("simulation_lore").select("*")
        .eq("simulation_id", str(SIM_ID))
        .neq("image_slug", "")
        .order("sort_order")
        .execute()
    )
    lore_sections = [s for s in extract_list(lore_resp) if s.get("image_slug")]
    logger.info("\n═══ LORE (%d with images, flux-2-max) ═══", len(lore_sections))

    for idx, section in enumerate(lore_sections):
        title = section.get("title", "?")
        slug = section.get("image_slug", "")
        if args.dry_run:
            logger.info("[DRY RUN] #%d %s (slug: %s)", idx + 1, title, slug)
            continue

        override = LORE_PROMPTS.get(slug)
        logger.info("Generating #%d/%d: %s [%s]...", idx + 1, len(lore_sections), title,
                     "handcrafted" if override else "auto")
        try:
            url = await image_service.generate_lore_image(
                section_title=title,
                section_body=(section.get("body") or "")[:500],
                image_slug=slug,
                sim_slug=SIM_SLUG,
                section_id=UUID(section["id"]),
                image_caption=override or section.get("image_caption"),
            )
            logger.info("✓ %s → %s", title, url)
            results["ok"] += 1
        except Exception as e:
            logger.error("✗ %s FAILED: %s", title, e)
            results["fail"] += 1
        await asyncio.sleep(2)

    # ── Summary ──────────────────────────────────────────────────────────
    total = results["ok"] + results["fail"]
    cost = results["ok"] * 0.073
    logger.info("\n" + "═" * 60)
    logger.info("VELGARIEN DELUXE GENERATION COMPLETE")
    logger.info("═" * 60)
    logger.info("  OK: %d  |  Failed: %d  |  Total: %d", results["ok"], results["fail"], total)
    logger.info("  Estimated cost: $%.2f (flux-2-max @ $0.073/img)", cost)
    logger.info("═" * 60)


if __name__ == "__main__":
    asyncio.run(main())
