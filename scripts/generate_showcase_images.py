#!/usr/bin/env python3
"""Generate dungeon showcase background images via OpenRouter.

Usage:
    python3 scripts/generate_showcase_images.py [archetype_id ...]

Without arguments, generates all 8 archetypes.
With arguments, generates only the specified archetypes.

Images are saved to screenshots/showcase/ as both raw PNG and AVIF.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv()


async def main(archetype_ids: list[str] | None = None) -> None:
    from backend.services.dungeon.showcase_image_service import (
        ARCHETYPE_VISUALS,
        generate_showcase_image,
    )
    from backend.services.external.openrouter import OpenRouterService

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print("ERROR: OPENROUTER_API_KEY not set in .env")
        sys.exit(1)

    openrouter = OpenRouterService(api_key=api_key)
    out_dir = Path("screenshots/showcase")
    out_dir.mkdir(parents=True, exist_ok=True)

    targets = archetype_ids or list(ARCHETYPE_VISUALS.keys())

    for arch_id in targets:
        if arch_id not in ARCHETYPE_VISUALS:
            print(f"SKIP: Unknown archetype '{arch_id}'")
            continue

        visual = ARCHETYPE_VISUALS[arch_id]
        print(f"\n{'='*60}")
        print(f"  {arch_id.upper()} — {visual.model}")
        print(f"  Prompt: {visual.prompt[:80]}...")
        print(f"{'='*60}")

        try:
            raw_bytes = await generate_showcase_image(openrouter, arch_id)
            usage = openrouter.last_usage or {}

            # Save raw PNG
            raw_path = out_dir / f"dungeon-{arch_id}-raw.png"
            raw_path.write_bytes(raw_bytes)
            print(f"  ✓ Raw: {raw_path} ({len(raw_bytes):,} bytes)")

            # Convert to AVIF
            try:
                from backend.services.image_service import AVIF_QUALITY, _convert_to_avif

                avif_bytes = _convert_to_avif(raw_bytes, max_dimension=1920, quality=AVIF_QUALITY)
                avif_path = out_dir / f"dungeon-{arch_id}.avif"
                avif_path.write_bytes(avif_bytes)
                print(f"  ✓ AVIF: {avif_path} ({len(avif_bytes):,} bytes)")
            except ImportError:
                print("  ⚠ Pillow not available, AVIF conversion skipped")

            print(f"  Duration: {usage.get('duration_ms', '?')}ms")
            print(f"  Model: {usage.get('model', '?')}")

        except Exception as e:
            print(f"  ✗ FAILED: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    args = sys.argv[1:] if len(sys.argv) > 1 else None
    asyncio.run(main(args))
