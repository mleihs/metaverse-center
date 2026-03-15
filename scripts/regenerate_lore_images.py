"""Regenerate lore images from DB-stored image_caption values.

Reads image_caption + image_slug from simulation_lore, combines with the
simulation's style prompt, and generates via Replicate Flux → AVIF → Storage.

Usage:
    source backend/.venv/bin/activate

    # Preview what would be generated
    python scripts/regenerate_lore_images.py --dry-run

    # Single simulation
    python scripts/regenerate_lore_images.py --sim the-memory-commons-enclosure

    # Multiple simulations
    python scripts/regenerate_lore_images.py --sim the-architecture-of-babel --sim the-m-bius-academy

    # All sims with ungenerated lore images (image_slug set, image_generated_at NULL)
    python scripts/regenerate_lore_images.py

Requires:
    - backend/.venv activated
    - REPLICATE_API_TOKEN in env or .env
    - Local Supabase running (supabase start)
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from supabase import create_client  # noqa: E402

from backend.services.image_service import ImageService  # noqa: E402

# ── Local Supabase ───────────────────────────────────────────────────────────

LOCAL_URL = "http://127.0.0.1:54321"
LOCAL_SERVICE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0"
    ".EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
)


def fetch_lore_sections(sb, sim_slugs: list[str] | None) -> list[dict]:
    """Query simulation_lore rows that have image_slug set."""
    q = (
        sb.table("simulation_lore")
        .select(
            "id, title, body, image_slug, image_caption, image_generated_at, "
            "simulation_id, simulations!inner(slug, name)",
        )
        .not_.is_("image_slug", "null")
    )
    if sim_slugs:
        q = q.in_("simulations.slug", sim_slugs)
    else:
        # Default: only sections not yet generated
        q = q.is_("image_generated_at", "null")

    resp = q.order("simulation_id").order("sort_order").execute()
    return resp.data or []


async def generate_one(sb, section: dict, replicate_key: str) -> str:
    """Generate a single lore image via ImageService."""
    sim = section["simulations"]
    svc = ImageService(
        supabase=sb,
        simulation_id=section["simulation_id"],
        replicate_api_key=replicate_key,
    )
    return await svc.generate_lore_image(
        section_title=section["title"],
        section_body=section["body"],
        image_slug=section["image_slug"],
        sim_slug=sim["slug"],
        section_id=section["id"],
        image_caption=section.get("image_caption"),
    )


async def main() -> None:
    parser = argparse.ArgumentParser(description="Regenerate lore images from DB captions")
    parser.add_argument("--sim", action="append", dest="sims", help="Simulation slug (repeatable)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without generating")
    args = parser.parse_args()

    replicate_key = os.environ.get("REPLICATE_API_TOKEN") or os.environ.get("REPLICATE_API_KEY")
    if not replicate_key and not args.dry_run:
        print("ERROR: REPLICATE_API_TOKEN not set")
        sys.exit(1)

    sb = create_client(LOCAL_URL, LOCAL_SERVICE_KEY)
    sections = fetch_lore_sections(sb, args.sims)

    if not sections:
        print("No lore sections found matching criteria.")
        return

    # Group by simulation for display
    by_sim: dict[str, list[dict]] = {}
    for s in sections:
        slug = s["simulations"]["slug"]
        by_sim.setdefault(slug, []).append(s)

    print(f"Found {len(sections)} lore images across {len(by_sim)} simulation(s)\n")

    for slug, rows in by_sim.items():
        sim_name = rows[0]["simulations"]["name"]
        print(f"=== {sim_name} ({slug}) — {len(rows)} images ===")
        for row in rows:
            caption_preview = (row.get("image_caption") or "NO CAPTION — will use LLM")[:80]
            status = " [DONE]" if row.get("image_generated_at") else ""
            print(f"  {row['image_slug']}: {caption_preview}...{status}")
        print()

    if args.dry_run:
        print("Dry run — no images generated.")
        return

    count = 0
    for slug, rows in by_sim.items():
        print(f"\n--- Generating {slug} ---")
        for row in rows:
            print(f"  [{count + 1}/{len(sections)}] {row['image_slug']}...")
            url = await generate_one(sb, row, replicate_key)
            print(f"    → {url}")
            count += 1

    print(f"\nDone — {count} images generated and uploaded.")


if __name__ == "__main__":
    asyncio.run(main())
