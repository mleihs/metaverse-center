#!/usr/bin/env python3
"""
Image generation script for Spengbab's Grease Pit.
Generates banner, building, and lore images using Flux Dev.

Supports both local and production environments:
  Local:      ./scripts/generate_spengbab_images.py
  Production: ./scripts/generate_spengbab_images.py --production

Uses the backend /generate/image endpoint which handles:
  1. LLM description generation (OpenRouter)
  2. Style prompt injection from simulation_settings
  3. img2img style reference resolution (entity-level > global > text-only)
  4. Image generation via Replicate (Flux Dev)
  5. Dual-resolution AVIF conversion + Supabase Storage upload
"""

import argparse
import asyncio
import json
import logging
import os
import subprocess

import httpx

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

SIM_ID = "60000000-0000-0000-0000-000000000001"
SIM_SLUG = "spengbabs-whore-house"

# Environment configs
LOCAL = {
    "api_base": "http://localhost:8000",
    "supabase_url": "http://127.0.0.1:54321",
    "anon_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
}
PRODUCTION = {
    "api_base": "https://metaverse.center",
    "supabase_url": "https://bffjoupddfjaljqrwqck.supabase.co",
    "anon_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZmpvdXBkZGZqYWxqcXJ3cWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5OTAxNzEsImV4cCI6MjA4NzU2NjE3MX0.fxKLEjPjN-vL3nP9cUSOBvigoSyFr5g_AlWcOQ19Umc",
}

ADMIN_EMAIL = "admin@velgarien.dev"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "velgarien-dev-2026")


async def get_auth_token(env: dict) -> str | None:
    """Login to Supabase to get a valid user JWT."""
    url = f"{env['supabase_url']}/auth/v1/token?grant_type=password"
    headers = {"apikey": env["anon_key"], "Content-Type": "application/json"}
    payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    logger.info("Authenticating %s at %s...", ADMIN_EMAIL, env["supabase_url"])
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                return resp.json().get("access_token")
            logger.error("Auth failed: %s - %s", resp.status_code, resp.text)
            return None
    except Exception as e:
        logger.error("Auth error: %s", e)
        return None


def get_entities_local(table: str) -> list[dict]:
    """Fetch entity data from local DB via docker psql."""
    cmd = [
        "docker", "exec", "supabase_db_velgarien-rebuild",
        "psql", "-U", "postgres", "-d", "postgres", "-t", "-c",
        f"SELECT json_agg(t) FROM (SELECT * FROM {table} WHERE simulation_id = '{SIM_ID}') t",
    ]
    try:
        result = subprocess.check_output(cmd).decode("utf-8").strip()
        result = result.replace(" +", "").replace("\n", "")
        return json.loads(result) if result else []
    except Exception as e:
        logger.error("Failed to fetch %s from local DB: %s", table, e)
        return []


async def get_entities_api(env: dict, token: str, table: str) -> list[dict]:
    """Fetch entity data via Supabase REST API (works for production)."""
    url = f"{env['supabase_url']}/rest/v1/{table}?simulation_id=eq.{SIM_ID}&select=*"
    headers = {
        "apikey": env["anon_key"],
        "Authorization": f"Bearer {token}",
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                return resp.json()
            logger.error("Failed to fetch %s: %s", table, resp.text)
            return []
    except Exception as e:
        logger.error("API fetch error for %s: %s", table, e)
        return []


async def get_simulation(env: dict, token: str) -> dict | None:
    """Fetch the simulation record."""
    url = f"{env['supabase_url']}/rest/v1/simulations?id=eq.{SIM_ID}&select=*"
    headers = {
        "apikey": env["anon_key"],
        "Authorization": f"Bearer {token}",
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200 and resp.json():
                return resp.json()[0]
            return None
    except Exception:
        return None


async def generate_image(env: dict, token: str, entity_id: str, entity_name: str,
                         entity_type: str, extra_data: dict) -> bool:
    """Call the backend image generation endpoint."""
    url = f"{env['api_base']}/api/v1/simulations/{SIM_ID}/generate/image"
    payload = {
        "entity_id": entity_id,
        "entity_type": entity_type,
        "entity_name": entity_name,
        "extra": extra_data,
    }
    headers = {"Authorization": f"Bearer {token}"}

    logger.info("Generating %s: '%s' (%s)...", entity_type, entity_name, entity_id[:8])
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json().get("data", {})
                logger.info("OK %s '%s' -> %s", entity_type, entity_name,
                            data.get("image_url", "uploaded"))
                return True
            logger.error("FAIL %s '%s': %s - %s", entity_type, entity_name,
                         resp.status_code, resp.text[:200])
            return False
    except Exception as e:
        logger.error("ERROR %s '%s': %s", entity_type, entity_name, e)
        return False


async def generate_lore_image(env: dict, token: str, section: dict) -> bool:
    """Generate a lore image via the backend lore endpoint.

    The /generate/image endpoint doesn't support lore directly,
    so we call the backend service via a custom lore endpoint if available,
    or fall back to direct Replicate call with proper prompts.
    """
    # Use the /generate/image endpoint with banner type + lore context in extra
    # Actually, lore uses a separate code path in ImageService.generate_lore_image()
    # which isn't exposed via the standard /generate/image endpoint.
    # We need to call it differently — check for a lore-specific endpoint.
    url = f"{env['api_base']}/api/v1/simulations/{SIM_ID}/generate/lore-image"
    payload = {
        "section_title": section["title"],
        "section_body": section.get("body", "")[:500],
        "image_slug": section.get("image_slug", ""),
        "sim_slug": SIM_SLUG,
    }
    headers = {"Authorization": f"Bearer {token}"}

    logger.info("Generating lore: '%s' (slug: %s)...", section["title"],
                section.get("image_slug", "?"))
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json().get("data", {})
                logger.info("OK lore '%s' -> %s", section["title"],
                            data.get("image_url", "uploaded"))
                return True
            elif resp.status_code == 404:
                logger.warning("Lore image endpoint not found — skipping. "
                               "Add POST /generate/lore-image to the router.")
                return False
            logger.error("FAIL lore '%s': %s - %s", section["title"],
                         resp.status_code, resp.text[:200])
            return False
    except Exception as e:
        logger.error("ERROR lore '%s': %s", section["title"], e)
        return False


async def main():
    parser = argparse.ArgumentParser(
        description="Generate images for Spengbab's Grease Pit"
    )
    parser.add_argument("--production", action="store_true",
                        help="Run against production (default: local)")
    parser.add_argument("--banner-only", action="store_true")
    parser.add_argument("--buildings-only", action="store_true")
    parser.add_argument("--lore-only", action="store_true")
    parser.add_argument("--portraits-only", action="store_true")
    parser.add_argument("--dry-run", action="store_true",
                        help="List entities without generating")
    args = parser.parse_args()

    env = PRODUCTION if args.production else LOCAL
    logger.info("Environment: %s", "PRODUCTION" if args.production else "LOCAL")

    # Determine which types to generate
    explicit = args.banner_only or args.buildings_only or args.lore_only or args.portraits_only
    do_banner = args.banner_only or not explicit
    do_buildings = args.buildings_only or not explicit
    do_lore = args.lore_only or not explicit
    do_portraits = args.portraits_only or not explicit

    token = await get_auth_token(env)
    if not token:
        logger.error("No token obtained. Exiting.")
        return

    stats = {"success": 0, "failed": 0, "skipped": 0}

    # --- Banner ---
    if do_banner:
        sim = await get_simulation(env, token)
        if sim:
            logger.info("=== BANNER ===")
            if args.dry_run:
                logger.info("[DRY RUN] Would generate banner for '%s'", sim["name"])
                stats["skipped"] += 1
            else:
                ok = await generate_image(env, token, SIM_ID, sim["name"], "banner", {
                    "description": sim.get("description", ""),
                })
                stats["success" if ok else "failed"] += 1
                await asyncio.sleep(3)

    # --- Buildings ---
    if do_buildings:
        logger.info("=== BUILDINGS ===")
        if args.production:
            buildings = await get_entities_api(env, token, "buildings")
        else:
            buildings = get_entities_local("buildings")
        logger.info("Found %d buildings", len(buildings))

        for b in buildings:
            if args.dry_run:
                logger.info("[DRY RUN] Would generate building '%s' (%s)", b["name"], b["id"][:8])
                stats["skipped"] += 1
                continue
            ok = await generate_image(env, token, b["id"], b["name"], "building", {
                "description": b.get("description", ""),
                "building_type": b.get("building_type", "residential"),
                "building_condition": b.get("building_condition", ""),
            })
            stats["success" if ok else "failed"] += 1
            await asyncio.sleep(3)

    # --- Lore ---
    if do_lore:
        logger.info("=== LORE ===")
        if args.production:
            lore_sections = await get_entities_api(env, token, "simulation_lore")
        else:
            lore_sections = get_entities_local("simulation_lore")
        logger.info("Found %d lore sections", len(lore_sections))

        for section in lore_sections:
            if not section.get("image_slug"):
                logger.info("Skipping lore '%s' (no image_slug)", section.get("title"))
                stats["skipped"] += 1
                continue
            if args.dry_run:
                logger.info("[DRY RUN] Would generate lore '%s' (slug: %s)",
                            section["title"], section["image_slug"])
                stats["skipped"] += 1
                continue
            ok = await generate_lore_image(env, token, section)
            stats["success" if ok else "failed"] += 1
            await asyncio.sleep(3)

    # --- Portraits ---
    if do_portraits:
        logger.info("=== PORTRAITS ===")
        if args.production:
            agents = await get_entities_api(env, token, "agents")
        else:
            agents = get_entities_local("agents")
        logger.info("Found %d agents", len(agents))

        for agent in agents:
            if args.dry_run:
                logger.info("[DRY RUN] Would generate portrait '%s' (%s)",
                            agent["name"], agent["id"][:8])
                stats["skipped"] += 1
                continue
            ok = await generate_image(env, token, agent["id"], agent["name"], "agent", {
                "character": agent.get("character", ""),
                "background": agent.get("background", ""),
            })
            stats["success" if ok else "failed"] += 1
            await asyncio.sleep(3)

    logger.info("=== DONE === success=%d failed=%d skipped=%d",
                stats["success"], stats["failed"], stats["skipped"])


if __name__ == "__main__":
    asyncio.run(main())
