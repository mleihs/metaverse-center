"""Generate 80-image A/B comparison gallery: with/without bleach bypass + chromatic aberration.

Composes feed posts (agent dossiers + building surveillance) from 5 simulations
and story templates (detection, classification, advisory, subsiding) with and
without the bleach_bypass / chromatic_aberration film processing effects.

Usage:
    PYTHONPATH=. .venv/bin/python scripts/generate_ab_80_gallery.py
    open _test_output/ab_80_comparison.html
"""

from __future__ import annotations

import asyncio
import logging
import sys
import time
from pathlib import Path
from typing import NamedTuple
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx

import backend.services.instagram_image_helpers as helpers
import backend.services.instagram_image_service as svc_mod
from backend.services.instagram_image_service import InstagramImageService
from backend.services.instagram_story_composer import StoryComposer

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

# ── Output dirs ──────────────────────────────────────────────────────────────

OUTPUT_WITHOUT = Path("_test_output/ab_80_without")
OUTPUT_WITH = Path("_test_output/ab_80_with")
HTML_PATH = Path("_test_output/ab_80_comparison.html")

BASE = "http://127.0.0.1:54321/storage/v1/object/public"

# ── Simulation data ──────────────────────────────────────────────────────────


class SimConfig(NamedTuple):
    name: str
    sim_id: str
    color_primary: str
    color_background: str


SIMS = {
    "velgarien": SimConfig(
        "Velgarien",
        "10000000-0000-0000-0000-000000000001",
        "#e2e8f0",
        "#0f172a",
    ),
    "cite": SimConfig(
        "Cite des Dames",
        "50000000-0000-0000-0000-000000000001",
        "#d4a574",
        "#1a0f0a",
    ),
    "spengbab": SimConfig(
        "Spengbab's Grease Pit",
        "60000000-0000-0000-0000-000000000001",
        "#f5e642",
        "#0a1628",
    ),
    "momo": SimConfig(
        "Time Bank of Momo",
        "fca074f5-3f0b-4c67-953a-886f9c490663",
        "#7eb8da",
        "#0d1117",
    ),
    "metamorphosis": SimConfig(
        "Metamorphosis of Memory",
        "8048b235-5f4d-4fad-88ce-a5fb67c31900",
        "#c4a0e8",
        "#110d18",
    ),
}

# Sim name -> metaverse.center slug for linking
SIM_SLUGS: dict[str, str] = {
    "Velgarien": "velgarien",
    "Cite des Dames": "cite-des-dames",
    "Spengbab's Grease Pit": "spengbabs-grease-pit",
    "Time Bank of Momo": "the-time-bank-of-momo",
    "Metamorphosis of Memory": "the-metamorphosis-of-memory",
}

# agent_id/file_id pairs per sim
AGENTS: dict[str, list[tuple[str, str, str]]] = {
    "velgarien": [
        ("Doktor Fenn", "9507783f", "e79c8e52"),
        ("Elena Voss", "9e2d5c8e", "67412150"),
        ("General Aldric Wolf", "eac25949", "7fd03c2a"),
        ("Inspektor Mueller", "4c5eb721", "ad264df4"),
        ("Lena Kray", "3f929519", "b02e8761"),
        ("Mira Steinfeld", "9caeeb9d", "412cb627"),
        ("Pater Cornelius", "8e93a0da", "ba8f0191"),
        ("Schwester Irma", "d115c826", "1eddbf54"),
        ("Viktor Harken", "dc4cff8d", "b6c306da"),
    ],
    "cite": [
        ("Ada Lovelace", "af16f3b0", "2da926f2"),
        ("Christine de Pizan", "b0519084", "164a253b"),
        ("Hildegard", "380aea48", "1bdc0b68"),
        ("Mary Wollstonecraft", "5da68bc8", "3134461c"),
        ("Sojourner Truth", "b2622fd9", "06223817"),
        ("Sor Juana", "cc93c810", "edbe0197"),
    ],
    "spengbab": [
        ("Moar Krabs", "509ff3d3", "44d12731"),
        ("Morbid Patrick", "9b9e2311", "899f9ba9"),
        ("Plangton", "d8319ad0", "edc30f85"),
        ("Sandy", "4d109fff", "422d65ba"),
        ("Skodwarde", "3bd3f4d1", "5bc0c247"),
        ("Spengbab", "c56074c1", "403d96d8"),
    ],
    "momo": [
        ("Anya Vey", "46dcbb89", "26497e59"),
        ("Elias Tannen", "b775cf80", "eedaf6dd"),
        ("Kael Orris", "ce11800f", "af67b846"),
        ("Liora Vey", "5660b5a5", "6b1c542f"),
        ("Mira Solm", "464bb76b", "3378266b"),
        ("Niko Voss", "e8b4ed89", "8d1d55d7"),
        ("Renn Falke", "1cfdbb50", "31d5c40c"),
    ],
    "metamorphosis": [
        ("Cipher the Unspoken", "66837304", "87846533"),
        ("Elias the Unbound", "48071439", "e6da1642"),
        ("Isolde the Unseen", "2468bb24", "43f1908c"),
        ("Lucian the Unwritten", "197331c9", "2f892514"),
        ("Orpheus the Unheard", "c66cf88b", "00524846"),
        ("Vespera the Errant", "433abd96", "1eb36a2c"),
    ],
}

BUILDINGS: dict[str, list[tuple[str, str, str]]] = {
    "velgarien": [
        ("Kanzlerpalast", "6c8947a3", "32e78c5f"),
        ("Kathedrale des Lichts", "c966ea5d", "f0b56840"),
        ("Militaerakademie Wolf", "80906ca3", "b046183b"),
        ("Room 441", "9c81053f", "cf1adddc"),
        ("Steinfeld-Redaktion", "e0ccf60b", "fe1d261d"),
        ("The Static Room", "8a584f18", "377df408"),
        ("Voss-Industriewerk", "90fe6137", "8eb29fd1"),
    ],
    "cite": [
        ("College of Letters", "471bf183", "9f41847a"),
        ("Footnote Room", "0529fa92", "17ac5457"),
        ("Garden of Remembered Names", "23a06c32", "4e00a6d9"),
        ("Gate of Justice", "e7c4170c", "8f6ea9de"),
        ("Hall of Declarations", "b18b0805", "3605f661"),
    ],
    "spengbab": [
        ("Tiki Head", "1e96eb23", "cf21e4de"),
        ("Bargain Mart", "fdeeb78c", "0b78d812"),
        ("Chum Void", "9f759247", "b53bd0e2"),
        ("Krusty Slaughterhouse", "7ab128ec", "382f7c78"),
    ],
    "momo": [
        ("Horizon's Threnody", "237a9624", "a9c34e98"),
        ("Horologium Fractum", "54cf7d9c", "b3f810ac"),
        ("Ephemera Cloister", "c016d368", "6077806a"),
        ("Loom of Hours", "30b6f09d", "cb609b03"),
        ("Solstice Atrium", "01c3058c", "e4aa67f5"),
    ],
    "metamorphosis": [
        ("Echo Scriptorium", "c0b8f6e0", "593639fe"),
        ("Epitaph Alcove", "5dca9e2e", "9c0c7290"),
        ("Folio Vault", "caabe2a1", "505ecc6a"),
        ("Inkwell Catacombs", "c3370004", "587f553a"),
        ("Lexicon Loom", "a6479a5c", "945379b4"),
    ],
}

CLASSIFICATIONS = ["PUBLIC", "AMBER", "RESTRICTED"]
CIPHER_HINTS = [
    None,
    None,
    None,
    None,
    "BUREAU-7741-OMEGA",
]

# Story archetype/accent combos — must use canonical "The X" names for
# symbol rendering and ARCHETYPE_DESCRIPTIONS lookup
STORY_ARCHETYPES = [
    ("The Shadow", "#e74c3c"),
    ("The Tower", "#f39c12"),
    ("The Entropy", "#8e44ad"),
    ("The Prometheus", "#e67e22"),
    ("The Awakening", "#2ecc71"),
]


def _agent_url(sim_key: str, agent_id_prefix: str, file_id_prefix: str) -> str:
    """Resolve a partial agent portrait URL from prefixes.

    The user provided abbreviated UUIDs -- we need to look them up via
    the local Supabase storage listing. But since these are known to exist
    and the base structure is agent.portraits/{sim}/{agent_id}/{file_id}.avif,
    we can reconstruct plausible full-length UUIDs by padding with zeros.

    However, the real approach: these are exact prefixes of real UUIDs. The
    Supabase public URL requires the full path. We'll download via a prefix
    match -- but actually, we should just use httpx to list the directory.

    Simpler: the user gave us enough of the UUID to form a URL. But Supabase
    storage uses exact paths. We need the full UUIDs.

    Looking at the reference script, it uses full UUIDs. The user's format
    is "agent_id_first_8_chars.../file_id_first_8_chars...". The "..." means
    the rest of the UUID follows. We need to discover the full UUIDs.

    Strategy: list the agent.portraits/{sim}/ directory to find matching paths.
    """
    sim_id = SIMS[sim_key].sim_id
    return f"{BASE}/agent.portraits/{sim_id}/{agent_id_prefix}/{file_id_prefix}.avif"


def _building_url(sim_key: str, bld_id_prefix: str, file_id_prefix: str) -> str:
    sim_id = SIMS[sim_key].sim_id
    return f"{BASE}/building.images/{sim_id}/{bld_id_prefix}/{file_id_prefix}.avif"


# ── UUID resolution ──────────────────────────────────────────────────────────

# We need to resolve abbreviated UUIDs to full UUIDs by listing storage
AGENT_FULL_UUIDS: dict[str, dict[str, tuple[str, str]]] = {}
BUILDING_FULL_UUIDS: dict[str, dict[str, tuple[str, str]]] = {}


async def _resolve_uuids(client: httpx.AsyncClient) -> None:
    """List storage directories to resolve abbreviated UUIDs to full paths."""
    sb_url = "http://127.0.0.1:54321/storage/v1"
    auth = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"}

    async def _resolve_one(
        bucket: str,
        sim_id: str,
        name_prefix: str,
        file_prefix: str,
    ) -> tuple[str, str] | None:
        """Resolve a single abbreviated UUID pair to full UUIDs."""
        resp = await client.post(
            f"{sb_url}/object/list/{bucket}",
            json={"prefix": f"{sim_id}/", "limit": 200},
            headers=auth,
        )
        if resp.status_code != 200:
            return None
        for folder in resp.json():
            folder_name = folder.get("name", "")
            if not folder_name.startswith(name_prefix):
                continue
            resp2 = await client.post(
                f"{sb_url}/object/list/{bucket}",
                json={"prefix": f"{sim_id}/{folder_name}/", "limit": 10},
                headers=auth,
            )
            if resp2.status_code != 200:
                return None
            for f in resp2.json():
                fname = f.get("name", "")
                if fname.startswith(file_prefix) and fname.endswith(".avif"):
                    return (folder_name, fname.removesuffix(".avif"))
            return None
        return None

    for sim_key, sim_cfg in SIMS.items():
        AGENT_FULL_UUIDS[sim_key] = {}
        BUILDING_FULL_UUIDS[sim_key] = {}

        # Resolve agent UUIDs
        for agent_name, agent_prefix, file_prefix in AGENTS.get(sim_key, []):
            try:
                result = await _resolve_one(
                    "agent.portraits", sim_cfg.sim_id, agent_prefix, file_prefix,
                )
                if result:
                    AGENT_FULL_UUIDS[sim_key][agent_name] = result
            except httpx.HTTPError:
                pass

        # Resolve building UUIDs
        for bld_name, bld_prefix, file_prefix in BUILDINGS.get(sim_key, []):
            try:
                result = await _resolve_one(
                    "building.images", sim_cfg.sim_id, bld_prefix, file_prefix,
                )
                if result:
                    BUILDING_FULL_UUIDS[sim_key][bld_name] = result
            except httpx.HTTPError:
                pass


def _agent_url_resolved(sim_key: str, agent_name: str) -> str | None:
    """Get full public URL for an agent portrait, or None if not resolved."""
    uuids = AGENT_FULL_UUIDS.get(sim_key, {}).get(agent_name)
    if not uuids:
        return None
    agent_id, file_id = uuids
    sim_id = SIMS[sim_key].sim_id
    return f"{BASE}/agent.portraits/{sim_id}/{agent_id}/{file_id}.avif"


def _building_url_resolved(sim_key: str, bld_name: str) -> str | None:
    uuids = BUILDING_FULL_UUIDS.get(sim_key, {}).get(bld_name)
    if not uuids:
        return None
    bld_id, file_id = uuids
    sim_id = SIMS[sim_key].sim_id
    return f"{BASE}/building.images/{sim_id}/{bld_id}/{file_id}.avif"


# ── Image data cache ─────────────────────────────────────────────────────────


async def _download_all_images(
    client: httpx.AsyncClient,
) -> dict[str, bytes]:
    """Download all images in parallel, returning url -> bytes mapping."""
    urls: list[tuple[str, str]] = []  # (label, url)

    for sim_key in SIMS:
        for agent_name, _, _ in AGENTS.get(sim_key, []):
            url = _agent_url_resolved(sim_key, agent_name)
            if url:
                urls.append((f"{sim_key}:agent:{agent_name}", url))

        for bld_name, _, _ in BUILDINGS.get(sim_key, []):
            url = _building_url_resolved(sim_key, bld_name)
            if url:
                urls.append((f"{sim_key}:building:{bld_name}", url))

    print(f"Downloading {len(urls)} images...")
    results: dict[str, bytes] = {}
    sem = asyncio.Semaphore(8)

    async def _fetch(label: str, url: str) -> None:
        async with sem:
            try:
                resp = await client.get(url, timeout=20)
                resp.raise_for_status()
                results[label] = resp.content
            except (httpx.HTTPError, OSError) as exc:
                print(f"  SKIP {label}: {exc}")

    await asyncio.gather(*[_fetch(label, url) for label, url in urls])
    print(f"  Downloaded {len(results)}/{len(urls)} images")
    return results


# ── Compose all images ───────────────────────────────────────────────────────


class ImageResult(NamedTuple):
    filename: str
    jpeg: bytes
    title: str
    category: str  # "Feed" or "Story"
    sim_name: str


def _compose_feed_images(
    svc: InstagramImageService,
    image_cache: dict[str, bytes],
) -> list[ImageResult]:
    """Compose all feed post images (agents + buildings)."""
    results: list[ImageResult] = []
    idx = 0

    # All agents as PERSONNEL FILE posts
    for sim_key, sim_cfg in SIMS.items():
        for agent_name, _, _ in AGENTS.get(sim_key, []):
            cache_key = f"{sim_key}:agent:{agent_name}"
            img_bytes = image_cache.get(cache_key)
            if not img_bytes:
                continue

            classif = CLASSIFICATIONS[idx % 3]
            cipher = CIPHER_HINTS[idx % len(CIPHER_HINTS)]
            idx += 1

            try:
                jpeg = svc._compose_with_overlay(
                    image_bytes=img_bytes,
                    title=f"PERSONNEL FILE \u2014 {agent_name}",
                    subtitle=f"SHARD: {sim_cfg.name}",
                    color_primary=sim_cfg.color_primary,
                    color_background=sim_cfg.color_background,
                    classification=classif,
                    cipher_hint=cipher,
                    crop_gravity="smart",
                )
                slug = agent_name.lower().replace(" ", "_").replace("'", "")
                results.append(ImageResult(
                    filename=f"feed_{sim_key}_agent_{slug}.jpg",
                    jpeg=jpeg,
                    title=f"Personnel File: {agent_name}",
                    category="Feed",
                    sim_name=sim_cfg.name,
                ))
            except Exception as exc:
                print(f"  FAIL agent {agent_name}: {exc}")

    # Select buildings from across all sims
    for sim_key, sim_cfg in SIMS.items():
        for bld_name, _, _ in BUILDINGS.get(sim_key, []):
            cache_key = f"{sim_key}:building:{bld_name}"
            img_bytes = image_cache.get(cache_key)
            if not img_bytes:
                continue

            classif = CLASSIFICATIONS[idx % 3]
            cipher = CIPHER_HINTS[idx % len(CIPHER_HINTS)]
            idx += 1

            try:
                jpeg = svc._compose_with_overlay(
                    image_bytes=img_bytes,
                    title=f"SHARD SURVEILLANCE \u2014 {bld_name}",
                    subtitle=f"LOCATION: {sim_cfg.name}",
                    color_primary=sim_cfg.color_primary,
                    color_background=sim_cfg.color_background,
                    classification=classif,
                    cipher_hint=cipher,
                    crop_gravity="smart_building",
                )
                slug = bld_name.lower().replace(" ", "_").replace("'", "").replace("-", "_")
                results.append(ImageResult(
                    filename=f"feed_{sim_key}_building_{slug}.jpg",
                    jpeg=jpeg,
                    title=f"Surveillance: {bld_name}",
                    category="Feed",
                    sim_name=sim_cfg.name,
                ))
            except Exception as exc:
                print(f"  FAIL building {bld_name}: {exc}")

    return results


def _compose_story_images() -> list[ImageResult]:
    """Compose all story template images (20 total: 4 types x 5 archetypes)."""
    composer = StoryComposer()
    results: list[ImageResult] = []

    for archetype, accent_hex in STORY_ARCHETYPES:
        # Detection
        try:
            jpeg = composer.compose_story_detection(
                archetype=archetype,
                signature=f"{archetype.upper()}-CLASS RESONANCE",
                magnitude=0.82,
                accent_hex=accent_hex,
            )
            results.append(ImageResult(
                filename=f"story_detection_{archetype.lower()}.jpg",
                jpeg=jpeg,
                title=f"Detection: {archetype}",
                category="Story",
                sim_name=archetype,
            ))
        except Exception as exc:
            print(f"  FAIL story detection {archetype}: {exc}")

        # Classification
        try:
            jpeg = composer.compose_story_classification(
                archetype=archetype,
                source_category="SUBSTRATE ANOMALY",
                affected_shard_count=3,
                highest_susceptibility_sim="Primary Shard",
                highest_susceptibility_val=0.91,
                bureau_dispatch=f"DISPATCH {archetype.upper()}-0042: Monitor substrate integrity.",
                accent_hex=accent_hex,
            )
            results.append(ImageResult(
                filename=f"story_classification_{archetype.lower()}.jpg",
                jpeg=jpeg,
                title=f"Classification: {archetype}",
                category="Story",
                sim_name=archetype,
            ))
        except Exception as exc:
            print(f"  FAIL story classification {archetype}: {exc}")

        # Advisory
        try:
            jpeg = composer.compose_story_advisory(
                archetype=archetype,
                aligned_types=["Analyst", "Strategist", "Mediator"],
                opposed_types=["Provocateur", "Anarchist"],
                zone_name="Sector 7-G",
                accent_hex=accent_hex,
            )
            results.append(ImageResult(
                filename=f"story_advisory_{archetype.lower()}.jpg",
                jpeg=jpeg,
                title=f"Advisory: {archetype}",
                category="Story",
                sim_name=archetype,
            ))
        except Exception as exc:
            print(f"  FAIL story advisory {archetype}: {exc}")

        # Subsiding
        try:
            jpeg = composer.compose_story_subsiding(
                archetype=archetype,
                events_spawned_total=7,
                shards_affected=3,
                accent_hex=accent_hex,
            )
            results.append(ImageResult(
                filename=f"story_subsiding_{archetype.lower()}.jpg",
                jpeg=jpeg,
                title=f"Subsiding: {archetype}",
                category="Story",
                sim_name=archetype,
            ))
        except Exception as exc:
            print(f"  FAIL story subsiding {archetype}: {exc}")

    return results


# ── Monkeypatch toggle ───────────────────────────────────────────────────────

_real_bb = helpers.bleach_bypass
_real_ca = helpers.chromatic_aberration


def _disable_effects() -> None:
    """Monkeypatch bleach_bypass and chromatic_aberration to identity functions."""
    helpers.bleach_bypass = lambda img, **kw: img
    helpers.chromatic_aberration = lambda img, **kw: img
    # Also patch on the service module in case it imported directly
    if hasattr(svc_mod, "bleach_bypass"):
        svc_mod.bleach_bypass = helpers.bleach_bypass
    if hasattr(svc_mod, "chromatic_aberration"):
        svc_mod.chromatic_aberration = helpers.chromatic_aberration


def _enable_effects() -> None:
    """Restore original bleach_bypass and chromatic_aberration."""
    helpers.bleach_bypass = _real_bb
    helpers.chromatic_aberration = _real_ca
    if hasattr(svc_mod, "bleach_bypass"):
        svc_mod.bleach_bypass = _real_bb
    if hasattr(svc_mod, "chromatic_aberration"):
        svc_mod.chromatic_aberration = _real_ca


# ── HTML gallery ─────────────────────────────────────────────────────────────


def _generate_html(
    without_results: list[ImageResult],
    with_results: list[ImageResult],
) -> str:
    """Generate side-by-side A/B comparison HTML with file references."""
    # Build paired cards -- match by filename
    without_map = {r.filename: r for r in without_results}
    with_map = {r.filename: r for r in with_results}
    all_filenames = list(dict.fromkeys(r.filename for r in without_results + with_results))

    # Collect unique sim names for filter buttons
    sim_names = list(dict.fromkeys(r.sim_name for r in without_results))

    feed_pairs: list[str] = []
    story_pairs: list[str] = []

    for fname in all_filenames:
        wo = without_map.get(fname)
        wi = with_map.get(fname)
        if not wo or not wi:
            continue

        is_story = wo.category == "Story"
        aspect = "9/16" if is_story else "4/5"
        wo_path = f"ab_80_without/{fname}"
        wi_path = f"ab_80_with/{fname}"
        wo_kb = len(wo.jpeg) / 1024
        wi_kb = len(wi.jpeg) / 1024

        sim_slug = SIM_SLUGS.get(wo.sim_name, "")
        sim_href = f"https://metaverse.center/simulations/{sim_slug}" if sim_slug else "#"
        card = f"""
        <div class="pair" data-sim="{wo.sim_name}" data-type="{wo.category}">
            <div class="pair-header">
                <span class="pair-title">{wo.title}</span>
                <a class="pair-sim" href="{sim_href}" target="_blank" rel="noopener">{wo.sim_name}</a>
            </div>
            <div class="pair-images">
                <div class="img-side" onclick="openLightbox(this.querySelector('img').src)">
                    <div class="img-wrap" style="aspect-ratio: {aspect}">
                        <img src="{wo_path}" alt="Without effects" loading="lazy">
                    </div>
                    <div class="label">WITHOUT <span class="kb">{wo_kb:.0f} KB</span></div>
                </div>
                <div class="img-side" onclick="openLightbox(this.querySelector('img').src)">
                    <div class="img-wrap" style="aspect-ratio: {aspect}">
                        <img src="{wi_path}" alt="With effects" loading="lazy">
                    </div>
                    <div class="label">WITH <span class="kb">{wi_kb:.0f} KB</span></div>
                </div>
            </div>
        </div>"""

        if is_story:
            story_pairs.append(card)
        else:
            feed_pairs.append(card)

    n_feed = len(feed_pairs)
    n_story = len(story_pairs)
    n_total = n_feed + n_story

    sim_buttons = "\n    ".join(
        f'<button onclick="filterSim(\'{s}\')">{s}</button>'
        for s in sim_names
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Bureau A/B Gallery -- Bleach Bypass + Chromatic Aberration (80 images)</title>
<style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ background: #08080d; color: #e2e8f0; font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace; padding: 24px; }}
h1 {{ font-size: 18px; color: #f39c12; margin-bottom: 4px; letter-spacing: 3px; text-transform: uppercase; }}
h2 {{ font-size: 15px; color: #f39c12; margin: 40px 0 16px; letter-spacing: 2px; text-transform: uppercase;
      border-bottom: 1px solid #1e293b; padding-bottom: 8px; }}
.subtitle {{ color: #64748b; font-size: 12px; margin-bottom: 24px; }}

/* Filters */
.filters {{ margin-bottom: 24px; display: flex; gap: 8px; flex-wrap: wrap; }}
.filters button {{ background: #111827; border: 1px solid #1e293b; color: #94a3b8; padding: 6px 14px;
    font-family: inherit; font-size: 11px; cursor: pointer; transition: all 0.15s; letter-spacing: 0.5px; }}
.filters button:hover, .filters button.active {{ background: #f39c12; color: #08080d; border-color: #f39c12; }}
.filter-group {{ display: flex; gap: 8px; align-items: center; }}
.filter-label {{ color: #475569; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-right: 4px; }}

/* Pairs grid */
.pairs {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(580px, 1fr)); gap: 24px; }}
.pair {{ background: #0d1117; border: 1px solid #1e293b; padding: 12px; transition: border-color 0.2s; }}
.pair:hover {{ border-color: #334155; }}
.pair.hidden {{ display: none; }}
.pair-header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }}
.pair-title {{ font-size: 12px; color: #cbd5e1; }}
.pair-sim {{ font-size: 10px; color: #f39c12; letter-spacing: 1px; text-decoration: none; padding: 2px 8px;
    border: 1px solid #f39c1240; border-radius: 3px; transition: all 0.2s; }}
.pair-sim:hover {{ background: #f39c12; color: #0a0a0f; border-color: #f39c12; }}
.pair-images {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }}
.img-side {{ cursor: pointer; }}
.img-wrap {{ width: 100%; overflow: hidden; border: 1px solid #1e293b; }}
.img-wrap img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
.label {{ font-size: 10px; color: #64748b; text-align: center; margin-top: 4px; letter-spacing: 1px; }}
.label .kb {{ color: #475569; }}

/* Story section -- narrower cards */
.story-section .pairs {{ grid-template-columns: repeat(auto-fill, minmax(440px, 1fr)); }}

/* Lightbox */
.lightbox {{ display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.92); z-index: 1000;
    justify-content: center; align-items: center; cursor: pointer; }}
.lightbox.open {{ display: flex; }}
.lightbox img {{ max-width: 90vw; max-height: 90vh; object-fit: contain; }}

/* Stats */
.stats {{ color: #475569; font-size: 11px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #1e293b; }}
</style>
</head>
<body>
<h1>Bureau of Impossible Geography</h1>
<p class="subtitle">A/B Comparison: Bleach Bypass + Chromatic Aberration | {n_total} pairs ({n_feed} feed + {n_story} story)</p>

<div class="filters">
    <div class="filter-group">
        <span class="filter-label">Type:</span>
        <button class="active" onclick="filterType('all')">All ({n_total})</button>
        <button onclick="filterType('Feed')">Feed ({n_feed})</button>
        <button onclick="filterType('Story')">Story ({n_story})</button>
    </div>
    <div class="filter-group">
        <span class="filter-label">Simulation:</span>
        <button onclick="filterSim('all')">All Sims</button>
        {sim_buttons}
    </div>
</div>

<h2>Feed Posts (4:5)</h2>
<div class="pairs">
{"".join(feed_pairs)}
</div>

<div class="story-section">
<h2>Story Templates (9:16)</h2>
<div class="pairs">
{"".join(story_pairs)}
</div>
</div>

<div class="stats">
    {n_total} A/B pairs | {n_feed} feed posts | {n_story} story templates |
    Without: {sum(len(r.jpeg) for r in without_results)/1024:.0f} KB |
    With: {sum(len(r.jpeg) for r in with_results)/1024:.0f} KB
</div>

<!-- Lightbox -->
<div class="lightbox" id="lightbox" onclick="closeLightbox()">
    <img id="lightbox-img" src="" alt="Enlarged">
</div>

<script>
let activeType = 'all';
let activeSim = 'all';

function applyFilters() {{
    document.querySelectorAll('.pair').forEach(p => {{
        const matchType = activeType === 'all' || p.dataset.type === activeType;
        const matchSim = activeSim === 'all' || p.dataset.sim === activeSim;
        p.classList.toggle('hidden', !(matchType && matchSim));
    }});
}}

function filterType(type) {{
    activeType = type;
    document.querySelectorAll('.filters .filter-group:first-child button').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    applyFilters();
}}

function filterSim(sim) {{
    activeSim = sim;
    document.querySelectorAll('.filters .filter-group:last-child button').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    applyFilters();
}}

function openLightbox(src) {{
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox').classList.add('open');
}}

function closeLightbox() {{
    document.getElementById('lightbox').classList.remove('open');
}}

document.addEventListener('keydown', e => {{
    if (e.key === 'Escape') closeLightbox();
}});
</script>
</body>
</html>"""


# ── Main ─────────────────────────────────────────────────────────────────────


async def main() -> None:
    t0 = time.time()

    OUTPUT_WITHOUT.mkdir(parents=True, exist_ok=True)
    OUTPUT_WITH.mkdir(parents=True, exist_ok=True)

    svc = InstagramImageService(supabase=MagicMock())

    async with httpx.AsyncClient(timeout=30) as client:
        # Step 1: Resolve abbreviated UUIDs to full paths
        print("Resolving UUIDs from local Supabase storage...")
        await _resolve_uuids(client)

        resolved_agents = sum(len(v) for v in AGENT_FULL_UUIDS.values())
        resolved_buildings = sum(len(v) for v in BUILDING_FULL_UUIDS.values())
        total_agents = sum(len(v) for v in AGENTS.values())
        total_buildings = sum(len(v) for v in BUILDINGS.values())
        print(f"  Resolved {resolved_agents}/{total_agents} agents, {resolved_buildings}/{total_buildings} buildings")

        # Step 2: Download all images in parallel
        image_cache = await _download_all_images(client)

    # Step 3: Compose WITHOUT effects
    print("\n--- Composing WITHOUT bleach bypass / chromatic aberration ---")
    _disable_effects()
    without_feed = _compose_feed_images(svc, image_cache)
    without_stories = _compose_story_images()
    without_results = without_feed + without_stories
    print(f"  Composed {len(without_results)} images (without effects)")

    # Save WITHOUT
    for r in without_results:
        (OUTPUT_WITHOUT / r.filename).write_bytes(r.jpeg)

    # Step 4: Compose WITH effects
    print("\n--- Composing WITH bleach bypass / chromatic aberration ---")
    _enable_effects()
    with_feed = _compose_feed_images(svc, image_cache)
    with_stories = _compose_story_images()
    with_results = with_feed + with_stories
    print(f"  Composed {len(with_results)} images (with effects)")

    # Save WITH
    for r in with_results:
        (OUTPUT_WITH / r.filename).write_bytes(r.jpeg)

    # Step 5: Generate HTML comparison
    print("\nGenerating comparison HTML...")
    html = _generate_html(without_results, with_results)
    HTML_PATH.write_text(html)

    elapsed = time.time() - t0
    n_total = len(without_results) + len(with_results)
    total_kb = sum(len(r.jpeg) for r in without_results + with_results) / 1024

    print(f"\n{'=' * 64}")
    print("  A/B Gallery Complete")
    print(f"  {n_total} total images ({len(without_results)} without + {len(with_results)} with)")
    print(f"  Feed: {len(without_feed)} pairs | Story: {len(without_stories)} pairs")
    print(f"  Total size: {total_kb:.0f} KB ({total_kb/1024:.1f} MB)")
    print(f"  Time: {elapsed:.1f}s")
    print(f"  Without: {OUTPUT_WITHOUT}/")
    print(f"  With:    {OUTPUT_WITH}/")
    print(f"  HTML:    {HTML_PATH}")
    print(f"{'=' * 64}")


if __name__ == "__main__":
    asyncio.run(main())
