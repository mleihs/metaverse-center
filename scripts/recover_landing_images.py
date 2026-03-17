#!/usr/bin/env python3
"""Recover landing page images from production Supabase to local Docker volume.

Uses download_file / upload_file from sync_simulation.py to copy:
  - hero.avif
  - feature-worldbuilding.avif
  - feature-competition.avif
  - feature-substrate.avif
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure scripts/ is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sync_simulation import download_file, upload_file  # noqa: E402

BUCKET = "simulation.assets"
LANDING_FILES = [
    "platform/landing/hero.avif",
    "platform/landing/feature-worldbuilding.avif",
    "platform/landing/feature-competition.avif",
    "platform/landing/feature-substrate.avif",
]


def main() -> None:
    print("Recovering landing page images from production…\n")
    recovered = 0

    for path in LANDING_FILES:
        print(f"  {path} …", end=" ", flush=True)
        data = download_file("prod", BUCKET, path)
        if data is None:
            print("SKIP — not found in production")
            continue

        ok = upload_file("local", BUCKET, path, data)
        if ok:
            print(f"OK — {len(data):,} bytes")
            recovered += 1
        else:
            print("FAIL — upload rejected")

    print(f"\n{recovered}/{len(LANDING_FILES)} images recovered.")


if __name__ == "__main__":
    main()
