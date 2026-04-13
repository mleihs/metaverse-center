#!/usr/bin/env python3
"""Retry the 6 failed Spengbab images with hardened portrait prompt + flux-2-pro.

Failures from A/B test:
  - 4 agents: Moar Krabs, Morbid Patrick, Sandy the Exiled, Spengbab (safety filter)
  - 1 building: The Bargain Mart of Lost Souls (safety filter)
  - 1 lore: The MS Paint Void (model error)

Usage:
    source backend/.venv/bin/activate
    python scripts/_spengbab_retry_failed.py
"""

import asyncio
import logging
import os
import sys
from uuid import UUID

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("ENVIRONMENT", "development")

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SIM_ID = UUID("60000000-0000-0000-0000-000000000001")
SIM_SLUG = "spengbabs-grease-pit"

FAILED_AGENTS = [
    "Moar Krabs",
    "Morbid Patrick",
    "Sandy the Exiled",
    "Spengbab",
]

FAILED_BUILDINGS = [
    "The Bargain Mart of Lost Souls",
]

FAILED_LORE_SLUG = "ms-paint-void"


async def main() -> None:
    from backend.dependencies import get_admin_supabase
    from backend.services.forge_image_service import ForgeImageService
    from backend.utils.responses import extract_list

    supabase = await get_admin_supabase()

    # Build world context
    lore_resp = await (
        supabase.table("simulation_lore")
        .select("title, body")
        .eq("simulation_id", str(SIM_ID))
        .order("sort_order")
        .limit(3)
        .execute()
    )
    parts = []
    for s in lore_resp.data or []:
        title = s.get("title", "")
        body = (s.get("body") or "")[:300]
        parts.append(f"{title}: {body}")
    world_context = "\n".join(parts)

    image_service = ForgeImageService(
        supabase,
        SIM_ID,
        replicate_api_key=os.environ.get("REPLICATE_API_TOKEN"),
        openrouter_api_key=os.environ.get("OPENROUTER_API_KEY"),
        world_context=world_context,
    )

    results = {"ok": 0, "fail": 0}

    # ── Retry agents ─────────────────────────────────────────────────────
    for name in FAILED_AGENTS:
        agent_resp = await (
            supabase.table("agents")
            .select("*")
            .eq("simulation_id", str(SIM_ID))
            .eq("name", name)
            .is_("deleted_at", "null")
            .single()
            .execute()
        )
        agent = agent_resp.data
        if not agent:
            logger.warning("Agent not found: %s", name)
            continue

        logger.info("Retrying agent: %s [PRO, hardened prompt]...", name)
        try:
            url = await image_service.generate_agent_portrait(
                UUID(agent["id"]),
                name,
                agent_data={
                    "character": agent.get("character", ""),
                    "background": agent.get("background", ""),
                },
            )
            logger.info("✓ %s → %s", name, url)
            results["ok"] += 1
        except Exception as e:
            logger.error("✗ %s FAILED: %s", name, e)
            results["fail"] += 1
        await asyncio.sleep(2)

    # ── Retry buildings ──────────────────────────────────────────────────
    for name in FAILED_BUILDINGS:
        bldg_resp = await (
            supabase.table("buildings")
            .select("*")
            .eq("simulation_id", str(SIM_ID))
            .eq("name", name)
            .is_("deleted_at", "null")
            .single()
            .execute()
        )
        bldg = bldg_resp.data
        if not bldg:
            logger.warning("Building not found: %s", name)
            continue

        logger.info("Retrying building: %s [PRO]...", name)
        try:
            url = await image_service.generate_building_image(
                UUID(bldg["id"]),
                name,
                bldg.get("building_type", "commercial"),
                building_data={
                    "description": bldg.get("description", ""),
                    "building_condition": bldg.get("building_condition", ""),
                    "building_style": bldg.get("building_style", ""),
                },
            )
            logger.info("✓ %s → %s", name, url)
            results["ok"] += 1
        except Exception as e:
            logger.error("✗ %s FAILED: %s", name, e)
            results["fail"] += 1
        await asyncio.sleep(2)

    # ── Retry lore ───────────────────────────────────────────────────────
    lore_resp = await (
        supabase.table("simulation_lore")
        .select("*")
        .eq("simulation_id", str(SIM_ID))
        .eq("image_slug", FAILED_LORE_SLUG)
        .single()
        .execute()
    )
    section = lore_resp.data
    if section:
        logger.info("Retrying lore: %s [PRO]...", section["title"])
        try:
            url = await image_service.generate_lore_image(
                section_title=section["title"],
                section_body=(section.get("body") or "")[:500],
                image_slug=section["image_slug"],
                sim_slug=SIM_SLUG,
                section_id=UUID(section["id"]),
                image_caption=section.get("image_caption"),
            )
            logger.info("✓ %s → %s", section["title"], url)
            results["ok"] += 1
        except Exception as e:
            logger.error("✗ %s FAILED: %s", section["title"], e)
            results["fail"] += 1

    logger.info("═══ RETRY DONE: %d OK, %d failed ═══", results["ok"], results["fail"])


if __name__ == "__main__":
    asyncio.run(main())
