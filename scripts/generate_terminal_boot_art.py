"""Batch-generate terminal boot art (ASCII) for all simulations.

Converts existing simulation banner images to deterministic ASCII art via
Pillow image-to-ASCII conversion. Stores result in simulation_settings
(category='design', key='terminal_boot_art').

Usage:
  python3 scripts/generate_terminal_boot_art.py                    # Local, all sims without art
  python3 scripts/generate_terminal_boot_art.py --force             # Local, regenerate all
  python3 scripts/generate_terminal_boot_art.py --production        # Production
  python3 scripts/generate_terminal_boot_art.py --simulation-id ID  # Single sim

Requires:
  - Backend .venv activated (for Pillow, pyfiglet, httpx)
  - Local: supabase start
  - Production: railway CLI authenticated (for service key)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import subprocess
import sys
import time
from pathlib import Path

# Load .env BEFORE importing libraries that read env vars
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Add backend to path for service imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from services.forge_ascii_art_service import ForgeAsciiArtService  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── Config ──────────────────────────────────────────────────────────────────

LOCAL_SUPABASE_URL = "http://127.0.0.1:54321"
PROD_SUPABASE_URL = "https://bffjoupddfjaljqrwqck.supabase.co"


def _get_local_service_key() -> str:
    """Get local Supabase service key via `supabase status`."""
    result = subprocess.run(
        ["supabase", "status"],
        capture_output=True,
        text=True,
    )
    for line in result.stdout.splitlines():
        if "Secret" in line and "sb_secret_" in line:
            for part in line.split():
                if part.startswith("sb_secret_"):
                    return part
    # Fallback: hardcoded local dev JWT
    return (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0."
        "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    )


def _get_prod_service_key() -> str:
    """Get production Supabase service key from Railway (cached in /tmp)."""
    key_file = Path("/tmp/prod_key.txt")
    if key_file.exists():
        key = key_file.read_text().strip()
        if key:
            logger.info("Using cached production service key from /tmp/prod_key.txt")
            return key

    logger.info("Fetching production service key from Railway...")
    result = subprocess.run(
        ["railway", "variables", "--json"],
        capture_output=True,
        text=True,
        check=True,
        timeout=15,
    )
    variables = json.loads(result.stdout)
    key = variables.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY not found in Railway variables")
    key_file.write_text(key)
    return key


# ── Main ────────────────────────────────────────────────────────────────────


async def main() -> None:
    parser = argparse.ArgumentParser(description="Generate terminal boot art for simulations")
    parser.add_argument("--production", action="store_true", help="Run against production Supabase")
    parser.add_argument("--force", action="store_true", help="Regenerate even if boot art exists")
    parser.add_argument("--simulation-id", type=str, help="Process a single simulation by UUID")
    args = parser.parse_args()

    # ── Connect ────────────────────────────────────────────────────────────
    from supabase import create_async_client

    if args.production:
        supabase_url = PROD_SUPABASE_URL
        service_key = _get_prod_service_key()
        env_label = "PRODUCTION"
    else:
        supabase_url = LOCAL_SUPABASE_URL
        service_key = _get_local_service_key()
        env_label = "LOCAL"

    logger.info("Connecting to %s Supabase: %s", env_label, supabase_url)
    supabase = await create_async_client(supabase_url, service_key)

    # ── Fetch simulations ──────────────────────────────────────────────────
    if args.simulation_id:
        sim_resp = await supabase.table("simulations").select("id, name, slug").eq("id", args.simulation_id).execute()
    else:
        sim_resp = await supabase.table("simulations").select("id, name, slug").is_("deleted_at", "null").execute()

    simulations = sim_resp.data or []
    if not simulations:
        logger.warning("No simulations found.")
        return

    logger.info("Found %d simulation(s)", len(simulations))

    # ── Check existing boot art ────────────────────────────────────────────
    existing_resp = (
        await supabase.table("simulation_settings")
        .select("simulation_id")
        .eq("category", "design")
        .eq("setting_key", "terminal_boot_art")
        .execute()
    )
    existing_ids = {row["simulation_id"] for row in (existing_resp.data or [])}

    if not args.force:
        to_process = [s for s in simulations if s["id"] not in existing_ids]
        skipped = len(simulations) - len(to_process)
        if skipped > 0:
            logger.info("Skipping %d sim(s) that already have boot art (use --force to regenerate)", skipped)
    else:
        to_process = simulations
        logger.info("Force mode: regenerating all %d simulation(s)", len(to_process))

    if not to_process:
        logger.info("Nothing to process. All simulations have boot art.")
        return

    # ── Process ────────────────────────────────────────────────────────────
    success_count = 0
    fail_count = 0
    no_banner_count = 0
    start = time.monotonic()

    for i, sim in enumerate(to_process, 1):
        sim_id = sim["id"]
        sim_name = sim["name"]
        sim_slug = sim.get("slug", "?")

        logger.info("[%d/%d] %s (%s)", i, len(to_process), sim_name, sim_slug)

        try:
            # Find banner image in storage
            banner_files = await supabase.storage.from_("simulation.banners").list(str(sim_id))
            if not banner_files:
                logger.warning("  No banner images found for %s — generating title-only art", sim_name)
                no_banner_count += 1
                banner_url = None
            else:
                # Pick most recent file
                sorted_files = sorted(
                    banner_files,
                    key=lambda f: f.get("created_at", ""),
                    reverse=True,
                )
                filename = sorted_files[0]["name"]
                banner_url = f"{supabase_url}/storage/v1/object/public/simulation.banners/{sim_id}/{filename}"
                logger.info("  Banner: %s", filename)

            # Generate ASCII art
            boot_art = await ForgeAsciiArtService.generate_boot_art(
                simulation_name=sim_name,
                banner_url=banner_url,
            )

            # Preview first 3 lines
            preview = "\n".join(boot_art.split("\n")[:3])
            logger.info("  Generated %d lines:\n%s", boot_art.count("\n") + 1, preview)

            # Upsert to simulation_settings
            await supabase.table("simulation_settings").upsert(
                [
                    {
                        "simulation_id": str(sim_id),
                        "setting_key": "terminal_boot_art",
                        "setting_value": boot_art,
                        "category": "design",
                    }
                ],
                on_conflict="simulation_id,category,setting_key",
            ).execute()

            logger.info("  Saved to simulation_settings")
            success_count += 1

        except Exception:
            logger.error("  FAILED for %s", sim_name, exc_info=True)
            fail_count += 1

    elapsed = time.monotonic() - start
    logger.info(
        "\nDone in %.1fs: %d generated, %d failed, %d without banner (title-only)",
        elapsed,
        success_count,
        fail_count,
        no_banner_count,
    )


if __name__ == "__main__":
    asyncio.run(main())
