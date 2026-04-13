#!/usr/bin/env python3
"""Sync Spengbab images + settings from local to production Supabase.

Syncs:
  1. AI settings (cleaned overrides + A.5/A.6 refined prompts)
  2. Prompt templates (A.6 generated)
  3. Agent portrait images (download local → upload production)
  4. Building images
  5. Lore images
  6. Banner image

Usage:
    source backend/.venv/bin/activate
    python scripts/_sync_spengbab_to_production.py
    python scripts/_sync_spengbab_to_production.py --dry-run
"""

import argparse
import asyncio
import logging
import os
import sys

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SIM_ID = "60000000-0000-0000-0000-000000000001"
SIM_SLUG = "spengbabs-grease-pit"

LOCAL_URL = "http://127.0.0.1:54321"
LOCAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

PROD_URL = "https://bffjoupddfjaljqrwqck.supabase.co"

# Buckets and entity tables
ENTITY_CONFIGS = [
    {
        "label": "agents",
        "table": "agents",
        "url_column": "portrait_image_url",
        "bucket": "agent.portraits",
    },
    {
        "label": "buildings",
        "table": "buildings",
        "url_column": "image_url",
        "bucket": "building.images",
    },
]


def get_prod_service_key() -> str:
    """Get production service role key from Railway."""
    import json
    import subprocess

    try:
        result = subprocess.check_output(
            ["railway", "variables", "--json"], timeout=15
        )
        variables = json.loads(result)
        return variables["SUPABASE_SERVICE_ROLE_KEY"]
    except Exception as e:
        logger.error("Failed to get prod service key from Railway: %s", e)
        sys.exit(1)


def headers(url: str, key: str) -> dict:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }


async def sync_settings(client: httpx.AsyncClient, prod_key: str, dry_run: bool) -> int:
    """Sync AI simulation_settings from local to production."""
    # Read local settings
    resp = await client.get(
        f"{LOCAL_URL}/rest/v1/simulation_settings",
        params={
            "simulation_id": f"eq.{SIM_ID}",
            "category": "eq.ai",
            "select": "setting_key,setting_value,category",
        },
        headers=headers(LOCAL_URL, LOCAL_KEY),
    )
    settings = resp.json()
    logger.info("Found %d AI settings to sync", len(settings))

    if dry_run:
        for s in settings:
            logger.info("  [DRY] %s = %s", s["setting_key"], str(s["setting_value"])[:80])
        return 0

    # Upsert each setting to production
    for s in settings:
        row = {
            "simulation_id": SIM_ID,
            "category": "ai",
            "setting_key": s["setting_key"],
            "setting_value": s["setting_value"],
        }
        resp = await client.post(
            f"{PROD_URL}/rest/v1/simulation_settings",
            json=row,
            headers={
                **headers(PROD_URL, prod_key),
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
            },
            params={"on_conflict": "simulation_id,category,setting_key"},
        )
        if resp.status_code in (200, 201):
            logger.info("  ✓ %s", s["setting_key"])
        else:
            logger.error("  ✗ %s: %s", s["setting_key"], resp.text[:100])

    # Also delete the old model overrides on production (if they still exist)
    for old_key in [
        "image_model_agent_portrait",
        "image_model_building_image",
        "image_model_lore_image",
        "image_model_banner",
    ]:
        resp = await client.delete(
            f"{PROD_URL}/rest/v1/simulation_settings",
            params={
                "simulation_id": f"eq.{SIM_ID}",
                "setting_key": f"eq.{old_key}",
            },
            headers=headers(PROD_URL, prod_key),
        )
        # 200 even if no rows deleted

    return len(settings)


async def sync_templates(client: httpx.AsyncClient, prod_key: str, dry_run: bool) -> int:
    """Sync prompt_templates from local to production."""
    resp = await client.get(
        f"{LOCAL_URL}/rest/v1/prompt_templates",
        params={
            "simulation_id": f"eq.{SIM_ID}",
            "select": "*",
        },
        headers=headers(LOCAL_URL, LOCAL_KEY),
    )
    templates = resp.json()
    logger.info("Found %d prompt templates to sync", len(templates))

    if dry_run:
        for t in templates:
            logger.info("  [DRY] %s: %s", t["template_type"], t.get("prompt_content", "")[:60])
        return 0

    for t in templates:
        # Delete existing on production first
        await client.delete(
            f"{PROD_URL}/rest/v1/prompt_templates",
            params={
                "simulation_id": f"eq.{SIM_ID}",
                "template_type": f"eq.{t['template_type']}",
                "locale": f"eq.{t.get('locale', 'en')}",
            },
            headers=headers(PROD_URL, prod_key),
        )
        # Remove id + timestamps for insert
        row = {k: v for k, v in t.items() if k not in ("id", "created_at", "updated_at")}
        resp = await client.post(
            f"{PROD_URL}/rest/v1/prompt_templates",
            json=row,
            headers={
                **headers(PROD_URL, prod_key),
                "Content-Type": "application/json",
            },
        )
        if resp.status_code in (200, 201):
            logger.info("  ✓ %s", t["template_type"])
        else:
            logger.error("  ✗ %s: %s", t["template_type"], resp.text[:100])

    return len(templates)


async def sync_images(
    client: httpx.AsyncClient,
    prod_key: str,
    dry_run: bool,
) -> int:
    """Download images from local storage, upload to production."""
    count = 0

    for cfg in ENTITY_CONFIGS:
        label = cfg["label"]
        table = cfg["table"]
        url_col = cfg["url_column"]
        bucket = cfg["bucket"]

        resp = await client.get(
            f"{LOCAL_URL}/rest/v1/{table}",
            params={
                "simulation_id": f"eq.{SIM_ID}",
                "select": f"id,name,{url_col}",
                "deleted_at": "is.null",
            },
            headers=headers(LOCAL_URL, LOCAL_KEY),
        )
        entities = resp.json()
        logger.info("═══ %s: %d entities ═══", label.upper(), len(entities))

        for entity in entities:
            url = entity.get(url_col)
            if not url or "127.0.0.1" not in url:
                logger.info("  skip %s (no local URL)", entity.get("name"))
                continue

            # Extract storage path from URL
            # URL: http://127.0.0.1:54321/storage/v1/object/public/bucket/path
            path = url.split(f"/object/public/{bucket}/", 1)[-1]
            full_path = path.replace(".avif", ".full.avif")

            if dry_run:
                logger.info("  [DRY] %s → %s/%s", entity.get("name"), bucket, path)
                continue

            # Download both resolutions from local
            for file_path in [path, full_path]:
                local_dl_url = f"{LOCAL_URL}/storage/v1/object/public/{bucket}/{file_path}"
                dl_resp = await client.get(local_dl_url)
                if dl_resp.status_code != 200:
                    logger.warning("  skip %s (download %d)", file_path, dl_resp.status_code)
                    continue

                # Upload to production
                up_resp = await client.post(
                    f"{PROD_URL}/storage/v1/object/{bucket}/{file_path}",
                    content=dl_resp.content,
                    headers={
                        **headers(PROD_URL, prod_key),
                        "Content-Type": "image/avif",
                        "x-upsert": "true",
                    },
                )
                if up_resp.status_code in (200, 201):
                    logger.info("  ✓ %s", file_path)
                else:
                    logger.error("  ✗ %s: %s", file_path, up_resp.text[:80])

            # Update production DB URL
            prod_url = url.replace(LOCAL_URL, PROD_URL)
            await client.patch(
                f"{PROD_URL}/rest/v1/{table}",
                params={"id": f"eq.{entity['id']}"},
                json={url_col: prod_url},
                headers={
                    **headers(PROD_URL, prod_key),
                    "Content-Type": "application/json",
                },
            )
            count += 1

    return count


async def sync_lore_images(
    client: httpx.AsyncClient,
    prod_key: str,
    dry_run: bool,
) -> int:
    """Sync lore images from local to production."""
    bucket = "simulation.assets"
    resp = await client.get(
        f"{LOCAL_URL}/rest/v1/simulation_lore",
        params={
            "simulation_id": f"eq.{SIM_ID}",
            "select": "id,title,image_slug",
            "image_slug": "neq.",
        },
        headers=headers(LOCAL_URL, LOCAL_KEY),
    )
    sections = [s for s in resp.json() if s.get("image_slug")]
    logger.info("═══ LORE: %d sections with images ═══", len(sections))

    count = 0
    for section in sections:
        slug = section["image_slug"]
        base_path = f"{SIM_SLUG}/lore/{slug}"

        if dry_run:
            logger.info("  [DRY] %s → %s", section["title"], base_path)
            continue

        for ext in [".avif", ".full.avif"]:
            file_path = f"{base_path}{ext}"
            dl_resp = await client.get(
                f"{LOCAL_URL}/storage/v1/object/public/{bucket}/{file_path}"
            )
            if dl_resp.status_code != 200:
                continue

            up_resp = await client.post(
                f"{PROD_URL}/storage/v1/object/{bucket}/{file_path}",
                content=dl_resp.content,
                headers={
                    **headers(PROD_URL, prod_key),
                    "Content-Type": "image/avif",
                    "x-upsert": "true",
                },
            )
            if up_resp.status_code in (200, 201):
                logger.info("  ✓ %s", file_path)
            else:
                logger.error("  ✗ %s: %s", file_path, up_resp.text[:80])
        count += 1

    return count


async def sync_banner(
    client: httpx.AsyncClient,
    prod_key: str,
    dry_run: bool,
) -> int:
    """Sync banner image from local to production."""
    bucket = "simulation.assets"
    resp = await client.get(
        f"{LOCAL_URL}/rest/v1/simulations",
        params={"id": f"eq.{SIM_ID}", "select": "banner_url"},
        headers=headers(LOCAL_URL, LOCAL_KEY),
    )
    sim = resp.json()[0] if resp.json() else {}
    banner_url = sim.get("banner_url")
    if not banner_url or "127.0.0.1" not in banner_url:
        logger.info("No local banner to sync")
        return 0

    path = banner_url.split(f"/object/public/{bucket}/", 1)[-1]
    full_path = path.replace(".avif", ".full.avif")
    logger.info("═══ BANNER ═══")

    if dry_run:
        logger.info("  [DRY] banner → %s", path)
        return 0

    for file_path in [path, full_path]:
        dl_resp = await client.get(
            f"{LOCAL_URL}/storage/v1/object/public/{bucket}/{file_path}"
        )
        if dl_resp.status_code != 200:
            continue
        up_resp = await client.post(
            f"{PROD_URL}/storage/v1/object/{bucket}/{file_path}",
            content=dl_resp.content,
            headers={
                **headers(PROD_URL, prod_key),
                "Content-Type": "image/avif",
                "x-upsert": "true",
            },
        )
        if up_resp.status_code in (200, 201):
            logger.info("  ✓ %s", file_path)
        else:
            logger.error("  ✗ %s: %s", file_path, up_resp.text[:80])

    # Update production banner_url
    prod_banner = banner_url.replace(LOCAL_URL, PROD_URL)
    await client.patch(
        f"{PROD_URL}/rest/v1/simulations",
        params={"id": f"eq.{SIM_ID}"},
        json={"banner_url": prod_banner},
        headers={
            **headers(PROD_URL, prod_key),
            "Content-Type": "application/json",
        },
    )
    return 1


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    prod_key = get_prod_service_key()
    logger.info("Production service key obtained from Railway")

    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1. Settings
        logger.info("\n══ SYNCING AI SETTINGS ══")
        await sync_settings(client, prod_key, args.dry_run)

        # 2. Templates
        logger.info("\n══ SYNCING PROMPT TEMPLATES ══")
        await sync_templates(client, prod_key, args.dry_run)

        # 3. Banner
        logger.info("\n══ SYNCING BANNER ══")
        await sync_banner(client, prod_key, args.dry_run)

        # 4. Entity images
        logger.info("\n══ SYNCING ENTITY IMAGES ══")
        await sync_images(client, prod_key, args.dry_run)

        # 5. Lore images
        logger.info("\n══ SYNCING LORE IMAGES ══")
        await sync_lore_images(client, prod_key, args.dry_run)

    logger.info("\n═══ SYNC COMPLETE ═══")


if __name__ == "__main__":
    asyncio.run(main())
