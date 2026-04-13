#!/usr/bin/env python3
"""Fix Spengbab image sync: local and production have different agent/building IDs.

Downloads images from local storage, re-uploads to production using
production entity IDs, and patches production DB URLs.
"""

import asyncio
import json
import logging
import os
import subprocess
import sys

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SIM_ID = "60000000-0000-0000-0000-000000000001"
SIM_SLUG = "spengbabs-grease-pit"
LOCAL_URL = "http://127.0.0.1:54321"
LOCAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
PROD_URL = "https://bffjoupddfjaljqrwqck.supabase.co"


def get_prod_key() -> str:
    result = subprocess.check_output(["railway", "variables", "--json"], timeout=15)
    return json.loads(result)["SUPABASE_SERVICE_ROLE_KEY"]


def h(url: str, key: str) -> dict:
    return {"apikey": key, "Authorization": f"Bearer {key}"}


async def sync_entity_images(
    client: httpx.AsyncClient,
    prod_key: str,
    table: str,
    url_col: str,
    bucket: str,
    name_col: str = "name",
) -> int:
    """Match local entities to production by name, download local image, upload to production path."""
    # Get local entities
    local_resp = await client.get(
        f"{LOCAL_URL}/rest/v1/{table}",
        params={"simulation_id": f"eq.{SIM_ID}", "select": f"id,{name_col},{url_col}", "deleted_at": "is.null"},
        headers=h(LOCAL_URL, LOCAL_KEY),
    )
    local_entities = {e[name_col]: e for e in local_resp.json()}

    # Get production entities
    prod_resp = await client.get(
        f"{PROD_URL}/rest/v1/{table}",
        params={"simulation_id": f"eq.{SIM_ID}", "select": f"id,{name_col},{url_col}", "deleted_at": "is.null"},
        headers=h(PROD_URL, prod_key),
    )
    prod_entities = {e[name_col]: e for e in prod_resp.json()}

    count = 0
    for name, local_e in local_entities.items():
        prod_e = prod_entities.get(name)
        if not prod_e:
            logger.warning("  skip %s (not in production)", name)
            continue

        local_url = local_e.get(url_col, "")
        if not local_url or "127.0.0.1" not in local_url:
            logger.info("  skip %s (no local URL)", name)
            continue

        prod_id = prod_e["id"]
        local_id = local_e["id"]

        # Extract image filename from local URL
        # URL: http://127.0.0.1:54321/storage/v1/object/public/bucket/sim_id/entity_id/file.avif
        parts = local_url.split(f"/object/public/{bucket}/")
        if len(parts) < 2:
            continue
        local_path = parts[1]  # sim_id/local_entity_id/file.avif
        filename = local_path.split("/")[-1]  # file.avif
        full_filename = filename.replace(".avif", ".full.avif")

        # Production paths use production entity ID
        prod_path = f"{SIM_ID}/{prod_id}/{filename}"
        prod_full_path = f"{SIM_ID}/{prod_id}/{full_filename}"

        for src_file, dst_path in [(filename, prod_path), (full_filename, prod_full_path)]:
            src_local_path = local_path.replace(filename, src_file)
            dl_url = f"{LOCAL_URL}/storage/v1/object/public/{bucket}/{src_local_path}"
            dl_resp = await client.get(dl_url)
            if dl_resp.status_code != 200:
                logger.warning("  skip %s/%s (local download %d)", name, src_file, dl_resp.status_code)
                continue

            up_resp = await client.post(
                f"{PROD_URL}/storage/v1/object/{bucket}/{dst_path}",
                content=dl_resp.content,
                headers={**h(PROD_URL, prod_key), "Content-Type": "image/avif", "x-upsert": "true"},
            )
            if up_resp.status_code in (200, 201):
                logger.info("  ✓ %s → %s", name, dst_path)
            else:
                logger.error("  ✗ %s upload failed: %s", dst_path, up_resp.text[:80])

        # Update production DB URL
        new_url = f"{PROD_URL}/storage/v1/object/public/{bucket}/{prod_path}"
        patch_resp = await client.patch(
            f"{PROD_URL}/rest/v1/{table}",
            params={"id": f"eq.{prod_id}"},
            json={url_col: new_url},
            headers={**h(PROD_URL, prod_key), "Content-Type": "application/json"},
        )
        if patch_resp.status_code in (200, 204):
            logger.info("  ✓ DB updated: %s → %s", name, new_url[-60:])
        else:
            logger.error("  ✗ DB patch failed for %s: %s", name, patch_resp.text[:80])
        count += 1

    return count


async def main() -> None:
    prod_key = get_prod_key()
    logger.info("Production key obtained")

    async with httpx.AsyncClient(timeout=60.0) as client:
        logger.info("\n═══ AGENTS ═══")
        await sync_entity_images(client, prod_key, "agents", "portrait_image_url", "agent.portraits")

        logger.info("\n═══ BUILDINGS ═══")
        await sync_entity_images(client, prod_key, "buildings", "image_url", "building.images")

    logger.info("\n═══ FIX COMPLETE ═══")


if __name__ == "__main__":
    asyncio.run(main())
