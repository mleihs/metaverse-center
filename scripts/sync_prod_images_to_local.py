"""Sync ALL agent portrait and building images from production Supabase to local.

Downloads every unique image from production storage and re-uploads
to local Supabase storage at the same path, preserving bucket structure.

Usage:
    PYTHONPATH=. .venv/bin/python scripts/sync_prod_images_to_local.py
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import httpx

PROD_BASE = "https://bffjoupddfjaljqrwqck.supabase.co"
LOCAL_BASE = "http://127.0.0.1:54321"
LOCAL_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0."
    "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
)

PROD_STORAGE = f"{PROD_BASE}/storage/v1/object/public"
LOCAL_STORAGE_UPLOAD = f"{LOCAL_BASE}/storage/v1/object"

# Production query results
TOOL_RESULTS = (
    Path(__file__).parent.parent.parent
    / ".claude"
    / "projects"
    / "-Users-mleihs-Dev-velgarien-rebuild"
    / "ded332b7-14d0-4e3c-b865-de290dbad878"
    / "tool-results"
)
AGENTS_FILE = TOOL_RESULTS / "mcp-supabase-prod-execute_sql-1776233058967.txt"
BUILDINGS_FILE = TOOL_RESULTS / "mcp-supabase-prod-execute_sql-1776233131743.txt"

SIMULATIONS = [
    "50000000-0000-0000-0000-000000000001",  # Cite des Dames
    "70000000-0000-0000-0000-000000000001",  # Conventional Memory
]

# Content type mapping by extension
CONTENT_TYPES = {
    ".avif": "image/avif",
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


def parse_result_file(path: Path) -> list[dict]:
    """Parse Supabase MCP tool result file to extract JSON array."""
    with open(path) as f:
        data = json.load(f)
    result = data["result"]
    start = result.find("[")
    end = result.rfind("]") + 1
    return json.loads(result[start:end])


def extract_storage_path(url: str, bucket: str) -> str | None:
    """Extract storage path after bucket name from a full Supabase URL."""
    marker = f"/storage/v1/object/public/{bucket}/"
    idx = url.find(marker)
    if idx < 0:
        return None
    return url[idx + len(marker) :]


def get_content_type(path: str) -> str:
    """Determine content type from file extension."""
    for ext, ct in CONTENT_TYPES.items():
        if path.lower().endswith(ext):
            return ct
    return "application/octet-stream"


async def upload_to_local(
    client: httpx.AsyncClient,
    bucket: str,
    storage_path: str,
    image_bytes: bytes,
    content_type: str,
) -> bool:
    """Upload image bytes to local Supabase storage with upsert."""
    url = f"{LOCAL_STORAGE_UPLOAD}/{bucket}/{storage_path}"
    resp = await client.post(
        url,
        content=image_bytes,
        headers={
            "Authorization": f"Bearer {LOCAL_KEY}",
            "apikey": LOCAL_KEY,
            "Content-Type": content_type,
            "x-upsert": "true",
        },
    )
    return resp.status_code in (200, 201)


async def sync_images(
    client: httpx.AsyncClient,
    items: list[tuple[str, str, str]],  # (label, prod_url, bucket)
    semaphore: asyncio.Semaphore,
    stats: dict,
) -> None:
    """Download from production and upload to local for a list of items."""

    async def process(label: str, prod_url: str, bucket: str) -> None:
        async with semaphore:
            storage_path = extract_storage_path(prod_url, bucket)
            if not storage_path:
                print(f"  SKIP (bad URL): {label}")
                stats["skipped"] += 1
                return

            content_type = get_content_type(storage_path)

            # Download from production
            try:
                resp = await client.get(prod_url)
                if resp.status_code != 200:
                    print(f"  SKIP (HTTP {resp.status_code}): {label}")
                    stats["skipped"] += 1
                    return
                image_bytes = resp.content
            except Exception as e:
                print(f"  ERROR downloading {label}: {e}")
                stats["errors"] += 1
                return

            # Upload to local
            try:
                ok = await upload_to_local(client, bucket, storage_path, image_bytes, content_type)
                if ok:
                    size_kb = len(image_bytes) / 1024
                    stats["synced"] += 1
                    stats["bytes"] += len(image_bytes)
                    print(f"  OK [{stats['synced']:3d}] {label} ({size_kb:.0f} KB)")
                else:
                    print(f"  FAIL uploading: {label}")
                    stats["errors"] += 1
            except Exception as e:
                print(f"  ERROR uploading {label}: {e}")
                stats["errors"] += 1

    tasks = [process(label, url, bucket) for label, url, bucket in items]
    await asyncio.gather(*tasks)


async def main() -> None:
    stats = {"synced": 0, "skipped": 0, "errors": 0, "bytes": 0}

    # ── Parse production data ───────────────────────────────────────
    print("Parsing production query results...")

    agents_file = Path(
        "/Users/mleihs/.claude/projects/-Users-mleihs-Dev-velgarien-rebuild/"
        "ded332b7-14d0-4e3c-b865-de290dbad878/tool-results/"
        "mcp-supabase-prod-execute_sql-1776233058967.txt"
    )
    buildings_file = Path(
        "/Users/mleihs/.claude/projects/-Users-mleihs-Dev-velgarien-rebuild/"
        "ded332b7-14d0-4e3c-b865-de290dbad878/tool-results/"
        "mcp-supabase-prod-execute_sql-1776233131743.txt"
    )

    agents = parse_result_file(agents_file)
    buildings = parse_result_file(buildings_file)

    # Deduplicate by URL
    seen_urls: set[str] = set()

    agent_items: list[tuple[str, str, str]] = []
    for a in agents:
        url = a.get("portrait_image_url")
        if url and url not in seen_urls:
            seen_urls.add(url)
            agent_items.append(
                (
                    f"[{a['sim_name']}] {a['name']}",
                    url,
                    "agent.portraits",
                )
            )

    building_items: list[tuple[str, str, str]] = []
    for b in buildings:
        url = b.get("image_url")
        if url and url not in seen_urls:
            seen_urls.add(url)
            building_items.append(
                (
                    f"[{b['sim_name']}] {b['name']}",
                    url,
                    "building.images",
                )
            )

    # Simulation banners
    banner_items: list[tuple[str, str, str]] = []
    for sim_id in SIMULATIONS:
        banner_url = f"{PROD_STORAGE}/simulation.assets/{sim_id}/banner.webp"
        if banner_url not in seen_urls:
            seen_urls.add(banner_url)
            banner_items.append(
                (
                    f"Banner: {sim_id[:8]}...",
                    banner_url,
                    "simulation.assets",
                )
            )

    total = len(agent_items) + len(building_items) + len(banner_items)
    print(
        f"Found {len(agent_items)} unique agent portraits, "
        f"{len(building_items)} unique building images, "
        f"{len(banner_items)} simulation banners"
    )
    print(f"Total images to sync: {total}\n")

    # ── Sync all ────────────────────────────────────────────────────
    semaphore = asyncio.Semaphore(10)  # max 10 concurrent downloads

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        print("=" * 60)
        print(f"  AGENT PORTRAITS ({len(agent_items)})")
        print("=" * 60)
        await sync_images(client, agent_items, semaphore, stats)

        print(f"\n{'=' * 60}")
        print(f"  BUILDING IMAGES ({len(building_items)})")
        print("=" * 60)
        await sync_images(client, building_items, semaphore, stats)

        print(f"\n{'=' * 60}")
        print(f"  SIMULATION BANNERS ({len(banner_items)})")
        print("=" * 60)
        await sync_images(client, banner_items, semaphore, stats)

    # ── Summary ─────────────────────────────────────────────────────
    total_mb = stats["bytes"] / (1024 * 1024)
    print(f"\n{'=' * 60}")
    print("  SYNC COMPLETE")
    print(f"  Synced:  {stats['synced']}")
    print(f"  Skipped: {stats['skipped']}")
    print(f"  Errors:  {stats['errors']}")
    print(f"  Total:   {total_mb:.1f} MB")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    asyncio.run(main())
