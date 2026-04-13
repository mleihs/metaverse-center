#!/usr/bin/env python3
"""A/B test: Regenerate Spengbab images alternating flux-2-pro / flux-2-max.

Generates:
  - Banner: flux-2-pro (single)
  - Agents: alternating pro/max (even index=pro, odd=max)
  - Buildings: alternating pro/max
  - Lore: flux-2-pro (all)

Each generated image URL is logged with which model was used,
so the user can visually compare pro vs max quality.

Usage:
    source backend/.venv/bin/activate
    python scripts/_spengbab_ab_test.py
    python scripts/_spengbab_ab_test.py --dry-run    # list entities only
"""

import asyncio
import logging
import os
import sys
from uuid import UUID

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("ENVIRONMENT", "development")

# Load .env (REPLICATE_API_TOKEN, OPENROUTER_API_KEY, etc.)
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

SIM_ID = UUID("60000000-0000-0000-0000-000000000001")
SIM_SLUG = "spengbabs-grease-pit"

MODEL_PRO = "black-forest-labs/flux-2-pro"
MODEL_MAX = "black-forest-labs/flux-2-max"


async def set_model_override(supabase, purpose: str, model: str) -> None:
    """Temporarily set a per-simulation image model override."""
    await (
        supabase.table("simulation_settings")
        .upsert(
            {
                "simulation_id": str(SIM_ID),
                "category": "ai",
                "setting_key": f"image_model_{purpose}",
                "setting_value": f'"{model}"',
            },
            on_conflict="simulation_id,category,setting_key",
        )
        .execute()
    )


async def clear_model_override(supabase, purpose: str) -> None:
    """Remove the temporary model override."""
    await (
        supabase.table("simulation_settings")
        .delete()
        .eq("simulation_id", str(SIM_ID))
        .eq("setting_key", f"image_model_{purpose}")
        .execute()
    )


async def build_world_context(supabase) -> str:
    """Build world context string from lore."""
    lore_resp = await (
        supabase.table("simulation_lore")
        .select("title, body")
        .eq("simulation_id", str(SIM_ID))
        .order("sort_order")
        .limit(3)
        .execute()
    )
    sections = lore_resp.data or []
    return "\n".join(
        f"{s['title']}: {(s.get('body') or '')[:300]}" for s in sections
    )


async def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Spengbab A/B image generation")
    parser.add_argument("--dry-run", action="store_true", help="List entities only")
    args = parser.parse_args()

    from backend.dependencies import get_admin_supabase
    from backend.services.forge_image_service import ForgeImageService
    from backend.utils.responses import extract_list

    supabase = await get_admin_supabase()
    world_context = await build_world_context(supabase)

    replicate_key = os.environ.get("REPLICATE_API_TOKEN")
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")

    if not replicate_key:
        logger.error("REPLICATE_API_TOKEN not set")
        return

    image_service = ForgeImageService(
        supabase, SIM_ID,
        replicate_api_key=replicate_key,
        openrouter_api_key=openrouter_key,
        world_context=world_context,
    )

    results: list[dict] = []

    # ── Banner (flux-2-pro) ──────────────────────────────────────────────
    sim_resp = await supabase.table("simulations").select("*").eq("id", str(SIM_ID)).single().execute()
    sim = sim_resp.data or {}
    logger.info("═══ BANNER (flux-2-pro) ═══")
    if args.dry_run:
        logger.info("[DRY RUN] banner: %s", sim.get("name"))
    else:
        await set_model_override(supabase, "banner", MODEL_PRO)
        try:
            url = await image_service.generate_banner_image(
                sim.get("name", "Spengbab"),
                sim.get("description", ""),
                anchor_data=None,
            )
            results.append({"type": "banner", "name": sim.get("name"), "model": MODEL_PRO, "url": url})
            logger.info("✓ banner → %s [PRO]", url)
        except Exception as e:
            logger.error("✗ banner FAILED: %s", e)
            results.append({"type": "banner", "name": sim.get("name"), "model": MODEL_PRO, "url": f"FAILED: {e}"})
        finally:
            await clear_model_override(supabase, "banner")

    # ── Agents (alternating pro/max) ─────────────────────────────────────
    agents_resp = await (
        supabase.table("agents").select("*")
        .eq("simulation_id", str(SIM_ID))
        .is_("deleted_at", "null")
        .order("name")
        .execute()
    )
    agents = extract_list(agents_resp)
    logger.info("═══ AGENTS (%d, alternating pro/max) ═══", len(agents))

    for idx, agent in enumerate(agents):
        model = MODEL_PRO if idx % 2 == 0 else MODEL_MAX
        model_label = "PRO" if model == MODEL_PRO else "MAX"
        agent_id = agent["id"]
        agent_name = agent["name"]

        if args.dry_run:
            logger.info("[DRY RUN] #%d %s → %s", idx + 1, agent_name, model_label)
            continue

        logger.info("Generating #%d/%d: %s [%s]...", idx + 1, len(agents), agent_name, model_label)
        await set_model_override(supabase, "agent_portrait", model)
        try:
            url = await image_service.generate_agent_portrait(
                UUID(agent_id),
                agent_name,
                agent_data={
                    "character": agent.get("character", ""),
                    "background": agent.get("background", ""),
                },
            )
            results.append({"type": "agent", "name": agent_name, "model": model, "url": url})
            logger.info("✓ %s → %s [%s]", agent_name, url, model_label)
        except Exception as e:
            logger.error("✗ %s FAILED: %s", agent_name, e)
            results.append({"type": "agent", "name": agent_name, "model": model, "url": f"FAILED: {e}"})
        finally:
            await clear_model_override(supabase, "agent_portrait")

        await asyncio.sleep(2)

    # ── Buildings (alternating pro/max) ──────────────────────────────────
    buildings_resp = await (
        supabase.table("buildings").select("*")
        .eq("simulation_id", str(SIM_ID))
        .is_("deleted_at", "null")
        .order("name")
        .execute()
    )
    buildings = extract_list(buildings_resp)
    logger.info("═══ BUILDINGS (%d, alternating pro/max) ═══", len(buildings))

    for idx, bldg in enumerate(buildings):
        model = MODEL_PRO if idx % 2 == 0 else MODEL_MAX
        model_label = "PRO" if model == MODEL_PRO else "MAX"
        building_id = bldg["id"]
        building_name = bldg["name"]

        if args.dry_run:
            logger.info("[DRY RUN] #%d %s → %s", idx + 1, building_name, model_label)
            continue

        logger.info("Generating #%d/%d: %s [%s]...", idx + 1, len(buildings), building_name, model_label)
        await set_model_override(supabase, "building_image", model)
        try:
            url = await image_service.generate_building_image(
                UUID(building_id),
                building_name,
                bldg.get("building_type", "commercial"),
                building_data={
                    "description": bldg.get("description", ""),
                    "building_condition": bldg.get("building_condition", ""),
                    "building_style": bldg.get("building_style", ""),
                },
            )
            results.append({"type": "building", "name": building_name, "model": model, "url": url})
            logger.info("✓ %s → %s [%s]", building_name, url, model_label)
        except Exception as e:
            logger.error("✗ %s FAILED: %s", building_name, e)
            results.append({"type": "building", "name": building_name, "model": model, "url": f"FAILED: {e}"})
        finally:
            await clear_model_override(supabase, "building_image")

        await asyncio.sleep(2)

    # ── Lore (flux-2-pro only) ───────────────────────────────────────────
    lore_resp = await (
        supabase.table("simulation_lore").select("*")
        .eq("simulation_id", str(SIM_ID))
        .neq("image_slug", "")
        .order("sort_order")
        .execute()
    )
    lore_sections = [s for s in extract_list(lore_resp) if s.get("image_slug")]
    logger.info("═══ LORE (%d sections with images, flux-2-pro) ═══", len(lore_sections))

    for idx, section in enumerate(lore_sections):
        title = section.get("title", "?")
        slug = section.get("image_slug", "")

        if args.dry_run:
            logger.info("[DRY RUN] #%d %s (slug: %s) → PRO", idx + 1, title, slug)
            continue

        logger.info("Generating #%d/%d: %s [PRO]...", idx + 1, len(lore_sections), title)
        await set_model_override(supabase, "lore_image", MODEL_PRO)
        try:
            url = await image_service.generate_lore_image(
                section_title=title,
                section_body=(section.get("body") or "")[:500],
                image_slug=slug,
                sim_slug=SIM_SLUG,
                section_id=UUID(section["id"]),
                image_caption=section.get("image_caption"),
            )
            results.append({"type": "lore", "name": title, "model": MODEL_PRO, "url": url})
            logger.info("✓ %s → %s [PRO]", title, url)
        except Exception as e:
            logger.error("✗ %s FAILED: %s", title, e)
            results.append({"type": "lore", "name": title, "model": MODEL_PRO, "url": f"FAILED: {e}"})
        finally:
            await clear_model_override(supabase, "lore_image")

        await asyncio.sleep(2)

    # ── Summary ──────────────────────────────────────────────────────────
    print("\n" + "═" * 80)
    print("A/B TEST RESULTS")
    print("═" * 80)
    for r in results:
        model_tag = "PRO" if "pro" in r["model"] else "MAX"
        failed = "FAILED" in str(r.get("url", ""))
        status = "✗" if failed else "✓"
        print(f"  {status} [{model_tag}] {r['type']:10s} {r['name']:30s} {r.get('url', '')[:80]}")
    print("═" * 80)

    pro_count = sum(1 for r in results if "pro" in r["model"] and "FAILED" not in str(r.get("url")))
    max_count = sum(1 for r in results if "max" in r["model"] and "FAILED" not in str(r.get("url")))
    fail_count = sum(1 for r in results if "FAILED" in str(r.get("url")))
    print(f"  PRO: {pro_count}  |  MAX: {max_count}  |  Failed: {fail_count}  |  Total: {len(results)}")
    pro_cost = pro_count * 0.031
    max_cost = max_count * 0.073
    print(f"  Cost: PRO ${pro_cost:.3f} + MAX ${max_cost:.3f} = ${pro_cost + max_cost:.3f}")


if __name__ == "__main__":
    asyncio.run(main())
