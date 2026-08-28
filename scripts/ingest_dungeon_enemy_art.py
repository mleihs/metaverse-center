#!/usr/bin/env python3
"""Publish the keyed enemy art to Supabase Storage at scene resolution.

This is the SECOND half of the enemy-art chain. The first half is
`scripts/key_dungeon_enemy_art.py`, which lifts each creature off its magenta
field and writes the 1024 px master to `assets/dungeon-enemies/<id>.avif` (in
the repo, 3.5 MB total). This script derives the rendition the game actually
loads and puts it in the bucket.

WHY A SEPARATE, SMALLER RENDITION
The masters are 1024 px on their long edge. The scene band draws a creature at
`clamp(78px, 9.2vw, 112px)` tall (FOE_GEOMETRY.boss in DungeonGraphicalView) —
112 CSS px at the very most, whatever the viewport. Even at DPR 3 that is 336
device pixels, so a 384 px rendition still carries ~14 % headroom and every
lower-DPR display far more. Shipping the master instead would mean ~84 KB per
creature and up to four creatures on screen: a third of a megabyte to paint
figures the size of a thumbnail. The master stays in the repo as the archive
and as the source for any future surface that needs the resolution.

    112 CSS px (FOE_GEOMETRY.boss max) x DPR 3 = 336 device px  <=  384

If the band ever grows, redo that arithmetic, change SCENE_EDGE, re-run this
script and regenerate the seed migration — the size is part of the stored path
(`...-384.avif`), so a stale rendition cannot silently linger behind a
still-correct-looking path.

THE PACK DRIVES THE WORKLIST, NOT THE DIRECTORY
Every destination path comes from `EnemyTemplate.image_path` in the content
pack, never from a directory listing. So the object this script writes is by
construction the object the database will point at — the two cannot drift. A
creature whose master is missing is a hard error, not a skipped file.

Per A1.5 this script writes NOTHING to the database. The paths reach the DB
through the pack alone: content/dungeon/archetypes/*/enemies.yaml ->
validate_content_packs -> generate_migration -> migration.

Usage:
    .venv/bin/python scripts/ingest_dungeon_enemy_art.py --dry-run
    .venv/bin/python scripts/ingest_dungeon_enemy_art.py            # local Supabase
    .venv/bin/python scripts/ingest_dungeon_enemy_art.py --production
"""

from __future__ import annotations

import argparse
import io
import os
import sys
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

import httpx
from dotenv import load_dotenv
from PIL import Image
from supabase import create_client

from backend.services.content_packs.loader import DEFAULT_PACK_ROOT, load_packs

# ── Config ───────────────────────────────────────────────────────────────────

BUCKET = "simulation.assets"
#: Longest edge of the published rendition. See the arithmetic in the module
#: docstring before changing this — it is mirrored in the stored path suffix.
SCENE_EDGE = 384
#: Matches key_dungeon_enemy_art.py and generate_dungeon_detail_images.py.
AVIF_QUALITY = 80
#: Where key_dungeon_enemy_art.py leaves the 1024 px masters.
MASTER_DIR = PROJECT_ROOT / "assets" / "dungeon-enemies"
#: Path suffix this script is allowed to publish. A pack path that does not end
#: in it means the pack and this script disagree about the rendition, which is
#: exactly the drift the pack-driven worklist exists to prevent.
EXPECTED_SUFFIX = f"-{SCENE_EDGE}.avif"


@dataclass(frozen=True)
class Job:
    """One creature: where its master lives, where its rendition goes."""

    enemy_id: str
    archetype: str
    master: Path
    dest: str  # bucket-relative, verbatim from EnemyTemplate.image_path


# ── Worklist ─────────────────────────────────────────────────────────────────


def collect_jobs() -> list[Job]:
    """Every pack creature that declares scene art, with its master resolved.

    Raises on the two ways pack and filesystem can disagree: a declared path
    whose master is absent, and a declared path that is not the rendition this
    script produces.
    """
    result = load_packs(DEFAULT_PACK_ROOT)
    jobs: list[Job] = []
    problems: list[str] = []

    for archetype in sorted(result.enemies):
        for enemy_id, tmpl in sorted(result.enemies[archetype].items()):
            if tmpl.image_path is None:
                continue
            if not tmpl.image_path.endswith(EXPECTED_SUFFIX):
                problems.append(
                    f"{enemy_id}: image_path '{tmpl.image_path}' is not a "
                    f"'{EXPECTED_SUFFIX}' rendition — this script cannot produce it"
                )
                continue
            master = MASTER_DIR / f"{enemy_id}.avif"
            if not master.is_file():
                problems.append(f"{enemy_id}: declares art but {master} is missing")
                continue
            jobs.append(Job(enemy_id, archetype, master, tmpl.image_path))

    if problems:
        raise SystemExit("Pack and assets disagree:\n  " + "\n  ".join(problems))
    return jobs


# ── Rendition ────────────────────────────────────────────────────────────────


def render_scene_variant(master: Path) -> tuple[bytes, tuple[int, int]]:
    """Downscale a master to SCENE_EDGE, keeping the alpha channel intact.

    RGBA throughout on purpose: the cutout IS the asset. Converting to RGB (as
    the Replicate detail-image script does for its opaque backdrops) would
    composite the creature onto black and hand back a rectangle.
    """
    with Image.open(master) as img:
        rgba = img.convert("RGBA")
    rgba.thumbnail((SCENE_EDGE, SCENE_EDGE), Image.LANCZOS)
    buf = io.BytesIO()
    rgba.save(buf, format="AVIF", quality=AVIF_QUALITY)
    return buf.getvalue(), rgba.size


# ── Target ───────────────────────────────────────────────────────────────────


def resolve_target(production: bool) -> tuple[str, str]:
    """(url, service_role_key) for the requested environment.

    `.env` is read here rather than at import, so importing this module never
    mutates the caller's environment.

    Both targets come from the environment. Production deliberately uses its own
    variable names rather than falling back to SUPABASE_URL: a shell that still
    holds local values must not be able to quietly publish to production, and a
    shell holding production values must not be reachable by omitting a flag.
    """
    load_dotenv()
    pair = (
        ("SUPABASE_PROD_URL", "SUPABASE_PROD_SERVICE_ROLE_KEY")
        if production
        else ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    )
    missing = [name for name in pair if not os.environ.get(name)]
    if missing:
        where = (
            "~/.config/metaspots/SUPABASE-ACCESS.md holds the production project ref and keys"
            if production
            else ".env holds the local Supabase values"
        )
        raise SystemExit(f"Missing {', '.join(missing)} in the environment. {where}.")
    return os.environ[pair[0]], os.environ[pair[1]]


def publish(url: str, key: str, jobs: list[Job], *, verify: bool) -> int:
    """Upload every rendition, then read each one back. Returns an exit code."""
    client = create_client(url, key)
    storage = client.storage.from_(BUCKET)
    published: list[tuple[Job, str, int]] = []

    for job in jobs:
        data, size = render_scene_variant(job.master)
        storage.upload(
            job.dest,
            data,
            {"content-type": "image/avif", "upsert": "true"},
        )
        public_url = storage.get_public_url(job.dest)
        published.append((job, public_url, len(data)))
        print(f"  {job.enemy_id:<32} {size[0]:>4}x{size[1]:<4} {len(data) // 1024:>4} KB")

    total_kb = sum(n for _, _, n in published) // 1024
    print(f"\n{len(published)} renditions, {total_kb} KB total.")

    if not verify:
        return 0

    print("\nReading back what was published:")
    failures = []
    with httpx.Client(timeout=20.0, follow_redirects=True) as http:
        for job, public_url, _ in published:
            try:
                resp = http.get(public_url, headers={"Range": "bytes=0-0"})
            except httpx.HTTPError as exc:
                failures.append(f"{job.enemy_id}: {type(exc).__name__} {exc}")
                continue
            content_type = resp.headers.get("content-type", "")
            if resp.status_code not in (200, 206) or "avif" not in content_type:
                failures.append(f"{job.enemy_id}: HTTP {resp.status_code} {content_type} {public_url}")

    if failures:
        print(f"  {len(failures)} of {len(published)} unreadable:", file=sys.stderr)
        for line in failures:
            print(f"    {line}", file=sys.stderr)
        return 1
    print(f"  all {len(published)} readable as image/avif.")
    return 0


# ── Main ─────────────────────────────────────────────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument(
        "--production",
        action="store_true",
        help="publish to production instead of the local Supabase from .env",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="render every variant and report sizes without uploading anything",
    )
    ap.add_argument(
        "--no-verify",
        action="store_true",
        help="skip the read-back of every published object",
    )
    ap.add_argument(
        "--yes",
        action="store_true",
        help="skip the confirmation prompt for --production",
    )
    args = ap.parse_args()

    jobs = collect_jobs()
    by_archetype = sorted({j.archetype for j in jobs})
    print(f"{len(jobs)} creatures with scene art across {len(by_archetype)} archetypes.")

    if args.dry_run:
        print(f"\nDRY RUN — rendering to {SCENE_EDGE} px, uploading nothing:")
        total = 0
        for job in jobs:
            data, size = render_scene_variant(job.master)
            total += len(data)
            print(f"  {job.dest:<56} {size[0]:>4}x{size[1]:<4} {len(data) // 1024:>4} KB")
        master_kb = sum(j.master.stat().st_size for j in jobs) // 1024
        print(f"\n{total // 1024} KB of renditions from {master_kb} KB of masters.")
        return 0

    url, key = resolve_target(args.production)
    target = "PRODUCTION" if args.production else "local"
    print(f"Target: {target} — {url}/storage/v1/object/public/{BUCKET}/")

    if args.production and not args.yes:
        answer = input(f"Publish {len(jobs)} objects to PRODUCTION storage? [y/N] ")
        if answer.strip().lower() not in ("y", "yes"):
            print("Aborted.")
            return 1

    print()
    return publish(url, key, jobs, verify=not args.no_verify)


if __name__ == "__main__":
    raise SystemExit(main())
