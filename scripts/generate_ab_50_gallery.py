#!/usr/bin/env python3
"""A/B gallery: 50 Instagram feed posts with/without bleach bypass + chromatic aberration.

Generates 50 composed Instagram images from 3 simulations (Cite des Dames,
Spengbab's Grease Pit, The Time Bank of Momo) using real AVIF images from
local Supabase storage. Each image is rendered twice:

  - WITHOUT effects: bleach_bypass and chromatic_aberration are no-ops
  - WITH effects: full film processing pipeline

Output:
  _test_output/ab_50_without/  — 50 JPEGs without film effects
  _test_output/ab_50_with/     — 50 JPEGs with film effects
  _test_output/ab_50_comparison.html — side-by-side gallery with filters

Usage:
    source backend/.venv/bin/activate
    python scripts/generate_ab_50_gallery.py
"""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import sys
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import MagicMock

if TYPE_CHECKING:
    # Runtime import happens in main() — it needs the sys.path setup below first.
    from backend.services.instagram_image_service import InstagramImageService

# ── Path setup ──────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("ENVIRONMENT", "development")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(message)s",
)
logger = logging.getLogger(__name__)

# ── Supabase local storage base URL ─────────────────────────────────────────

STORAGE_BASE = "http://127.0.0.1:54321/storage/v1/object/public"

# ── Output directories ──────────────────────────────────────────────────────

OUTPUT_ROOT = ROOT / "_test_output"
DIR_WITHOUT = OUTPUT_ROOT / "ab_50_without"
DIR_WITH = OUTPUT_ROOT / "ab_50_with"
HTML_PATH = OUTPUT_ROOT / "ab_50_comparison.html"

# ── Simulation metadata ─────────────────────────────────────────────────────

SIMS = {
    "cite": {
        "name": "Cite des Dames",
        "id": "50000000-0000-0000-0000-000000000001",
        "color_primary": "#c4a882",
        "color_background": "#1a1410",
    },
    "spengbab": {
        "name": "Spengbab's Grease Pit",
        "id": "60000000-0000-0000-0000-000000000001",
        "color_primary": "#7ce87c",
        "color_background": "#0a1a0a",
    },
    "momo": {
        "name": "The Time Bank of Momo",
        "id": "fca074f5-3f0b-4c67-953a-886f9c490663",
        "color_primary": "#a0c4ff",
        "color_background": "#0a0f1a",
    },
}

# ── Image catalog: (name, bucket, sim_key, entity_type, agent_id, file_id) ─

CLASSIFICATIONS = ["PUBLIC", "AMBER", "RESTRICTED"]

CIPHER_HINTS = [
    "MNEMO-7 // SUBSTRATE BREACH AT 04:17:33.002 UTC",
    "VECTOR-12 // SHARD RESONANCE EXCEEDS THRESHOLD",
    "CIPHER-3 // THE BUREAU REMEMBERS WHAT YOU FORGET",
    "NULL-AXIS // OPERATIVE HANDLER: [REDACTED]",
    "FREQ-88 // SIGNAL DECAY IN SECTOR 7-GAMMA",
    "DRIFT-01 // MEMETIC HAZARD CLASSIFICATION: AMBER",
    "ECHO-44 // SUBSTRATE FOLD DETECTED IN SHARD PERIPHERY",
    "VOID-19 // TEMPORAL ANCHOR DESTABILIZED",
    "NODE-56 // RESONANCE CASCADE IMMINENT",
    "FLUX-33 // IMPOSSIBLE GEOGRAPHY CONFIRMED",
]


def _url(bucket: str, sim_id: str, entity_id: str, file_id: str) -> str:
    """Construct a local Supabase storage URL."""
    return f"{STORAGE_BASE}/{bucket}/{sim_id}/{entity_id}/{file_id}.avif"


# fmt: off
IMAGES: list[dict] = [
    # ── Cite des Dames — Agents (6) ──────────────────────────────────────
    {"name": "Ada Lovelace", "sim": "cite", "type": "agent",
     "url": _url("agent.portraits", SIMS["cite"]["id"], "af16f3b0-a00d-490c-91ff-f19f125a7bc0", "2da926f2-539d-47e6-a875-bda32e31275b")},
    {"name": "Christine de Pizan", "sim": "cite", "type": "agent",
     "url": _url("agent.portraits", SIMS["cite"]["id"], "b0519084-f58b-4a2d-8139-226a768a2146", "164a253b-35b2-452a-a3c6-6a6b981d2781")},
    {"name": "Hildegard von Bingen", "sim": "cite", "type": "agent",
     "url": _url("agent.portraits", SIMS["cite"]["id"], "380aea48-84f9-40c9-889c-16d746259d26", "1bdc0b68-6d2b-41f0-a6df-2afdfe52dc38")},
    {"name": "Mary Wollstonecraft", "sim": "cite", "type": "agent",
     "url": _url("agent.portraits", SIMS["cite"]["id"], "5da68bc8-c5cb-41ad-8f1d-9e5d1e6ab1e8", "3134461c-a6f7-47dd-81b6-c79a952a1c02")},
    {"name": "Sojourner Truth", "sim": "cite", "type": "agent",
     "url": _url("agent.portraits", SIMS["cite"]["id"], "b2622fd9-1021-463e-afad-6cbbb444e94b", "06223817-7b21-4e7f-a9d1-c8a81f4692bb")},
    {"name": "Sor Juana Ines de la Cruz", "sim": "cite", "type": "agent",
     "url": _url("agent.portraits", SIMS["cite"]["id"], "cc93c810-99a4-419a-9d68-b312e6c512ec", "edbe0197-2b46-4e90-a9bc-1a08e7588963")},

    # ── Cite des Dames — Buildings (10) ──────────────────────────────────
    {"name": "The College of Letters", "sim": "cite", "type": "building",
     "url": _url("building.images", SIMS["cite"]["id"], "471bf183-7a23-4641-9d1b-e07f811a050b", "9f41847a-8f2f-43ff-aa78-23afe04b0640")},
    {"name": "The Footnote Room", "sim": "cite", "type": "building",
     "url": _url("building.images", SIMS["cite"]["id"], "0529fa92-43de-4589-83f3-e693af6ee6ce", "17ac5457-d10b-4c55-8ad6-0d9fcdb5c377")},
    {"name": "The Garden of Remembered Names", "sim": "cite", "type": "building",
     "url": _url("building.images", SIMS["cite"]["id"], "23a06c32-e586-4946-afa3-31af31cd70a0", "4e00a6d9-c2c6-454f-8d2a-de32b7f280a4")},
    {"name": "The Gate of Justice", "sim": "cite", "type": "building",
     "url": _url("building.images", SIMS["cite"]["id"], "e7c4170c-ce2e-4939-95b8-4edb868368e4", "8f6ea9de-c13d-4b60-a14a-53570fa35097")},
    {"name": "The Hall of Declarations", "sim": "cite", "type": "building",
     "url": _url("building.images", SIMS["cite"]["id"], "b18b0805-2f9d-423c-9275-d6fead648961", "3605f661-4c53-4307-ba58-c43d33a36459")},
    {"name": "The Listening Wall", "sim": "cite", "type": "building",
     "url": _url("building.images", SIMS["cite"]["id"], "c6ad04e1-83e2-48e1-8a38-afc9b188b618", "7f9f7f45-1f25-4c17-b899-b4316e4195bf")},
    {"name": "The Observatory of the Blazing World", "sim": "cite", "type": "building",
     "url": _url("building.images", SIMS["cite"]["id"], "ce98b61d-783b-489c-9a34-4180cf64e97d", "2625bda6-377b-461a-9277-5b350344fcc2")},
    {"name": "The Salon of Reason", "sim": "cite", "type": "building",
     "url": _url("building.images", SIMS["cite"]["id"], "f1f689e7-5fd6-4742-ae81-d305faeb9e60", "559bcdfd-9bc7-42e0-94dd-a546a9d4e429")},
    {"name": "The Scriptorium", "sim": "cite", "type": "building",
     "url": _url("building.images", SIMS["cite"]["id"], "c471ae39-c984-462f-987b-c3acfa82f6f4", "e3d171d9-b03a-4254-9cd9-625e99861b48")},
    {"name": "The Unnamed Archive", "sim": "cite", "type": "building",
     "url": _url("building.images", SIMS["cite"]["id"], "bc825013-a000-4042-8b19-3c2b85f58d37", "3c61af28-bfc5-4ff7-8d4a-f326d5cfcdc7")},

    # ── Spengbab's Grease Pit — Agents (6) ──────────────────────────────
    {"name": "Moar Krabs", "sim": "spengbab", "type": "agent",
     "url": _url("agent.portraits", SIMS["spengbab"]["id"], "509ff3d3-8bec-46f9-9c6b-e85b336c2024", "44d12731-258a-4d20-bd86-f84f8432cfc3")},
    {"name": "Morbid Patrick", "sim": "spengbab", "type": "agent",
     "url": _url("agent.portraits", SIMS["spengbab"]["id"], "9b9e2311-a8b7-40f8-9283-086abb1d2da9", "899f9ba9-8d49-4bd5-b05a-9d6c960a527a")},
    {"name": "Plangton", "sim": "spengbab", "type": "agent",
     "url": _url("agent.portraits", SIMS["spengbab"]["id"], "d8319ad0-e254-4e2c-ba2f-d064e65f3137", "edc30f85-518d-45f7-8f38-c6991076ff4a")},
    {"name": "Sandy the Exiled", "sim": "spengbab", "type": "agent",
     "url": _url("agent.portraits", SIMS["spengbab"]["id"], "4d109fff-823a-478a-9de7-bbc4347c391d", "422d65ba-c6c9-401c-9439-5e055de97799")},
    {"name": "Skodwarde", "sim": "spengbab", "type": "agent",
     "url": _url("agent.portraits", SIMS["spengbab"]["id"], "3bd3f4d1-ddfe-41d7-8ee7-360e91e3c11d", "5bc0c247-c779-43c1-adfe-9a20fd486a71")},
    {"name": "Spengbab", "sim": "spengbab", "type": "agent",
     "url": _url("agent.portraits", SIMS["spengbab"]["id"], "c56074c1-fda4-41c2-8244-57c5b34b41c0", "403d96d8-8d44-4ee6-97db-041c256f98ea")},

    # ── Spengbab's Grease Pit — Buildings (7) ───────────────────────────
    {"name": "Skodwarde's Tiki Head", "sim": "spengbab", "type": "building",
     "url": _url("building.images", SIMS["spengbab"]["id"], "1e96eb23-ccf6-4071-9986-c2eb33fc7e2f", "cf21e4de-4afa-405b-bf42-7d5495ce76ce")},
    {"name": "The Bargain Mart of Lost Souls", "sim": "spengbab", "type": "building",
     "url": _url("building.images", SIMS["spengbab"]["id"], "fdeeb78c-c9d0-411e-b591-271578abcf00", "0b78d812-e191-4312-abf9-7ce15ff2fbf2")},
    {"name": "The Chum Void", "sim": "spengbab", "type": "building",
     "url": _url("building.images", SIMS["spengbab"]["id"], "9f759247-8f93-4e37-ab05-7ce80c3267a0", "b53bd0e2-8147-4667-94f8-b066255043bc")},
    {"name": "The Goo Lagoon of Stagnation", "sim": "spengbab", "type": "building",
     "url": _url("building.images", SIMS["spengbab"]["id"], "51ec67bb-c25e-4f0c-ae89-a6b9f36e78ac", "5929c900-389d-45a2-942a-7d8dd3b408e7")},
    {"name": "The Krusty Slaughterhouse", "sim": "spengbab", "type": "building",
     "url": _url("building.images", SIMS["spengbab"]["id"], "7ab128ec-f465-4b2b-9e80-44fdf4b39739", "382f7c78-db32-467d-8f7a-47abc53a27fb")},
    {"name": "The MS Paint Void", "sim": "spengbab", "type": "building",
     "url": _url("building.images", SIMS["spengbab"]["id"], "309b390e-e064-4e86-8421-89d43f244798", "c626f51c-1673-4988-bdf4-4642c409b4c8")},
    {"name": "The Rotting Pineapple", "sim": "spengbab", "type": "building",
     "url": _url("building.images", SIMS["spengbab"]["id"], "af275244-0170-44c2-8053-a44c5877b9ca", "40afe182-4482-4c14-b2ff-a028e3b0b654")},

    # ── The Time Bank of Momo — Agents (7) ──────────────────────────────
    {"name": "Anya Vey", "sim": "momo", "type": "agent",
     "url": _url("agent.portraits", SIMS["momo"]["id"], "46dcbb89-8811-4b1d-96e8-3cb17a16bf4b", "26497e59-c5ee-45c2-ab68-483f82dc7752")},
    {"name": "Elias Tannen", "sim": "momo", "type": "agent",
     "url": _url("agent.portraits", SIMS["momo"]["id"], "b775cf80-bd1d-461d-a359-25d6753a80ce", "eedaf6dd-d344-414f-9365-400edfeffabe")},
    {"name": "Kael Orris", "sim": "momo", "type": "agent",
     "url": _url("agent.portraits", SIMS["momo"]["id"], "ce11800f-bfca-4322-8860-c055ccbab2ae", "af67b846-3901-4342-930b-6f0c080ebb7e")},
    {"name": "Liora Vey", "sim": "momo", "type": "agent",
     "url": _url("agent.portraits", SIMS["momo"]["id"], "5660b5a5-bdd0-4703-8f71-54678aa7ea18", "6b1c542f-5021-499c-a72b-82e27d9c10b5")},
    {"name": "Mira Solm", "sim": "momo", "type": "agent",
     "url": _url("agent.portraits", SIMS["momo"]["id"], "464bb76b-1fbc-41a5-ac8c-fba71e623c9c", "3378266b-64fa-48a2-a26c-4cf5276fa4cf")},
    {"name": "Niko Voss", "sim": "momo", "type": "agent",
     "url": _url("agent.portraits", SIMS["momo"]["id"], "e8b4ed89-1233-487e-804d-48963159db17", "8d1d55d7-88e2-4388-9c96-63d92bf876a0")},
    {"name": "Renn Falke", "sim": "momo", "type": "agent",
     "url": _url("agent.portraits", SIMS["momo"]["id"], "1cfdbb50-0e15-4c37-aff9-5001b2f33e27", "31d5c40c-2a04-494e-b791-16ae8ecf3397")},

    # ── The Time Bank of Momo — Buildings (6) ───────────────────────────
    {"name": "Horizon's Threnody", "sim": "momo", "type": "building",
     "url": _url("building.images", SIMS["momo"]["id"], "237a9624-13f5-4bf2-a523-94148d961b32", "a9c34e98-8dd4-4f34-b169-824c7b1d2b64")},
    {"name": "Horologium Fractum", "sim": "momo", "type": "building",
     "url": _url("building.images", SIMS["momo"]["id"], "54cf7d9c-053c-4a83-af42-c7a231b9649c", "b3f810ac-55cf-4ebf-9606-6558a49f246d")},
    {"name": "The Ephemera Cloister", "sim": "momo", "type": "building",
     "url": _url("building.images", SIMS["momo"]["id"], "c016d368-7ebf-4e42-a440-e92dffd08e28", "6077806a-07b4-4331-a7b1-7d1399531e8c")},
    {"name": "The Loom of Hours", "sim": "momo", "type": "building",
     "url": _url("building.images", SIMS["momo"]["id"], "30b6f09d-e9e9-49c1-9cb3-e17c181d2535", "cb609b03-94a8-4421-8a39-f84792d5019b")},
    {"name": "The Solstice Atrium", "sim": "momo", "type": "building",
     "url": _url("building.images", SIMS["momo"]["id"], "01c3058c-329f-4d17-9286-dea31166fbca", "e4aa67f5-2c78-4ffa-a91d-38d2ab57d268")},
    {"name": "The Sundial Hospice", "sim": "momo", "type": "building",
     "url": _url("building.images", SIMS["momo"]["id"], "dffca28d-ca20-4b63-8230-beab10d55a3f", "05f6bdbc-2502-4d55-bc4b-41ab64a2b46f")},

    # ── Spengbab's Grease Pit — v1 Agent Portraits (6) ────────────────
    # Older generation variants with distinct images — adds visual variety
    {"name": "Moar Krabs (v1)", "sim": "spengbab", "type": "agent",
     "url": _url("agent.portraits", SIMS["spengbab"]["id"], "56ca99c4-589c-49ad-8539-6397ae219d62", "44d12731-258a-4d20-bd86-f84f8432cfc3")},
    {"name": "Sandy the Exiled (v1)", "sim": "spengbab", "type": "agent",
     "url": _url("agent.portraits", SIMS["spengbab"]["id"], "690c45fd-f935-480c-9644-b373e78009cf", "422d65ba-c6c9-401c-9439-5e055de97799")},
    {"name": "Plangton (v1)", "sim": "spengbab", "type": "agent",
     "url": _url("agent.portraits", SIMS["spengbab"]["id"], "6b09badd-1fee-4982-a459-ceb5af08c1f0", "edc30f85-518d-45f7-8f38-c6991076ff4a")},
    {"name": "Skodwarde (v1)", "sim": "spengbab", "type": "agent",
     "url": _url("agent.portraits", SIMS["spengbab"]["id"], "d9ee4847-b05c-47ba-a2c1-14b4418ff34b", "5bc0c247-c779-43c1-adfe-9a20fd486a71")},
    {"name": "Spengbab (v1)", "sim": "spengbab", "type": "agent",
     "url": _url("agent.portraits", SIMS["spengbab"]["id"], "e4e9dcc7-d8da-49d4-a9bb-9aed48228c11", "403d96d8-8d44-4ee6-97db-041c256f98ea")},
    {"name": "Morbid Patrick (v1)", "sim": "spengbab", "type": "agent",
     "url": _url("agent.portraits", SIMS["spengbab"]["id"], "e9d4da98-6d9f-4811-a4de-67c997816239", "899f9ba9-8d49-4bd5-b05a-9d6c960a527a")},

    # ── Dispatch posts (2) — use agent portraits as background ──────────
    {"name": "DISPATCH [0001]", "sim": "cite", "type": "dispatch",
     "url": _url("agent.portraits", SIMS["cite"]["id"], "af16f3b0-a00d-490c-91ff-f19f125a7bc0", "2da926f2-539d-47e6-a875-bda32e31275b")},
    {"name": "DISPATCH [0002]", "sim": "spengbab", "type": "dispatch",
     "url": _url("agent.portraits", SIMS["spengbab"]["id"], "509ff3d3-8bec-46f9-9c6b-e85b336c2024", "44d12731-258a-4d20-bd86-f84f8432cfc3")},
]
# fmt: on

assert len(IMAGES) == 50, f"Expected 50 images, got {len(IMAGES)}"


# ── Download helper ──────────────────────────────────────────────────────────


async def download_image(url: str) -> bytes | None:
    """Download an image from local Supabase. Returns None on failure."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.content
    except (httpx.HTTPError, OSError) as exc:
        logger.warning("Download failed: %s — %s", url.split("/")[-1], exc)
        return None


# ── Compose helper ───────────────────────────────────────────────────────────


def compose_image(
    service: InstagramImageService,
    image_bytes: bytes,
    entry: dict,
    index: int,
) -> bytes:
    """Compose a single image through the overlay pipeline."""
    sim_meta = SIMS[entry["sim"]]
    classification = CLASSIFICATIONS[index % len(CLASSIFICATIONS)]
    cipher_hint = CIPHER_HINTS[index % len(CIPHER_HINTS)] if (index + 1) % 5 == 0 else None

    if entry["type"] == "agent":
        title = f"PERSONNEL FILE \u2014 {entry['name']}"
        subtitle = f"SHARD: {sim_meta['name']}"
    elif entry["type"] == "building":
        title = f"SHARD SURVEILLANCE \u2014 {entry['name']}"
        subtitle = f"LOCATION: {sim_meta['name']}"
    else:  # dispatch
        dispatch_num = index + 1
        title = f"DISPATCH [{dispatch_num:04d}]"
        subtitle = f"RE: {sim_meta['name']}"

    return service._compose_with_overlay(
        image_bytes,
        title=title,
        subtitle=subtitle,
        color_primary=sim_meta["color_primary"],
        color_background=sim_meta["color_background"],
        classification=classification,
        cipher_hint=cipher_hint,
    )


# ── HTML gallery generator ──────────────────────────────────────────────────


def generate_html(results: list[dict]) -> str:
    """Generate A/B comparison HTML gallery."""
    cards_html = ""
    for r in results:
        sim_label = SIMS[r["sim"]]["name"]
        # Relative paths from _test_output/
        path_without = f"ab_50_without/{r['filename']}"
        path_with = f"ab_50_with/{r['filename']}"
        cards_html += f"""
      <div class="card" data-sim="{r["sim"]}">
        <div class="card-header">
          <span class="badge badge-{r["sim"]}">{sim_label}</span>
          <span class="entity-name">{r["name"]}</span>
          <span class="entity-type">{r["type"].upper()}</span>
        </div>
        <div class="pair">
          <div class="img-slot">
            <div class="label">WITHOUT effects</div>
            <img src="{path_without}" alt="{r["name"]} — no effects"
                 loading="lazy" onclick="openLightbox(this.src)" />
          </div>
          <div class="img-slot">
            <div class="label">WITH effects</div>
            <img src="{path_with}" alt="{r["name"]} — with effects"
                 loading="lazy" onclick="openLightbox(this.src)" />
          </div>
        </div>
      </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Bureau A/B Gallery -- Bleach Bypass + Chromatic Aberration</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    background: #0a0c10;
    color: #c8ccd4;
    font-family: 'Menlo', 'DejaVu Sans Mono', monospace;
    padding: 24px;
  }}
  h1 {{
    text-align: center;
    font-size: 1.4rem;
    color: #e2e8f0;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }}
  .subtitle {{
    text-align: center;
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 24px;
  }}
  .filters {{
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-bottom: 32px;
    flex-wrap: wrap;
  }}
  .filters button {{
    background: #1e2028;
    color: #94a3b8;
    border: 1px solid #2a2d38;
    padding: 8px 20px;
    font-family: inherit;
    font-size: 0.8rem;
    cursor: pointer;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition: all 0.2s;
  }}
  .filters button:hover {{
    border-color: #475569;
    color: #e2e8f0;
  }}
  .filters button.active {{
    background: #1a2332;
    border-color: #a0c4ff;
    color: #a0c4ff;
  }}
  .gallery {{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(640px, 1fr));
    gap: 24px;
    max-width: 1600px;
    margin: 0 auto;
  }}
  .card {{
    background: #12141a;
    border: 1px solid #1e2028;
    padding: 16px;
    transition: opacity 0.3s;
  }}
  .card.hidden {{
    display: none;
  }}
  .card-header {{
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid #1e2028;
  }}
  .badge {{
    padding: 3px 10px;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }}
  .badge-cite {{ background: #2a2014; color: #c4a882; border: 1px solid #3d2f1e; }}
  .badge-spengbab {{ background: #0a1a0a; color: #7ce87c; border: 1px solid #1a3a1a; }}
  .badge-momo {{ background: #0a0f1a; color: #a0c4ff; border: 1px solid #1a2a4a; }}
  .entity-name {{
    font-size: 0.85rem;
    color: #e2e8f0;
    flex: 1;
  }}
  .entity-type {{
    font-size: 0.65rem;
    color: #475569;
    letter-spacing: 0.1em;
  }}
  .pair {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }}
  .img-slot {{
    position: relative;
  }}
  .img-slot .label {{
    font-size: 0.65rem;
    color: #64748b;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 6px;
    text-align: center;
  }}
  .img-slot img {{
    width: 100%;
    height: auto;
    display: block;
    cursor: zoom-in;
    border: 1px solid #1e2028;
    transition: border-color 0.2s;
  }}
  .img-slot img:hover {{
    border-color: #475569;
  }}

  /* Lightbox */
  .lightbox {{
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.92);
    z-index: 1000;
    justify-content: center;
    align-items: center;
    cursor: zoom-out;
  }}
  .lightbox.open {{
    display: flex;
  }}
  .lightbox img {{
    max-width: 95vw;
    max-height: 95vh;
    object-fit: contain;
  }}

  /* Stats bar */
  .stats {{
    text-align: center;
    font-size: 0.75rem;
    color: #475569;
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid #1e2028;
  }}
</style>
</head>
<body>
  <h1>Bureau A/B Gallery</h1>
  <p class="subtitle">Bleach Bypass + Chromatic Aberration -- {len(results)} image pairs from 3 simulations</p>

  <div class="filters">
    <button class="active" onclick="filterSim('all')">All ({len(results)})</button>
    <button onclick="filterSim('cite')">Cite des Dames ({sum(1 for r in results if r["sim"] == "cite")})</button>
    <button onclick="filterSim('spengbab')">Spengbab ({sum(1 for r in results if r["sim"] == "spengbab")})</button>
    <button onclick="filterSim('momo')">Time Bank ({sum(1 for r in results if r["sim"] == "momo")})</button>
  </div>

  <div class="gallery">
    {cards_html}
  </div>

  <div class="stats">
    Generated by generate_ab_50_gallery.py -- Bureau of Impossible Geography
  </div>

  <div class="lightbox" id="lightbox" onclick="closeLightbox()">
    <img id="lightbox-img" src="" alt="Enlarged view" />
  </div>

<script>
function filterSim(sim) {{
  document.querySelectorAll('.filters button').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('.card').forEach(card => {{
    if (sim === 'all' || card.dataset.sim === sim) {{
      card.classList.remove('hidden');
    }} else {{
      card.classList.add('hidden');
    }}
  }});
}}

function openLightbox(src) {{
  const lb = document.getElementById('lightbox');
  document.getElementById('lightbox-img').src = src;
  lb.classList.add('open');
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


# ── Main pipeline ────────────────────────────────────────────────────────────


async def main() -> None:
    """Run the full A/B gallery generation."""
    import backend.services.instagram_image_helpers as helpers
    from backend.services.instagram_image_service import InstagramImageService

    # Create output directories
    DIR_WITHOUT.mkdir(parents=True, exist_ok=True)
    DIR_WITH.mkdir(parents=True, exist_ok=True)

    # Mock supabase client (not needed for compose, only for upload)
    mock_supabase = MagicMock()
    service = InstagramImageService(mock_supabase)

    # ── Phase 1: Download all images concurrently ────────────────────────
    logger.info("Downloading %d images from local Supabase...", len(IMAGES))
    download_tasks = [download_image(entry["url"]) for entry in IMAGES]
    raw_images = await asyncio.gather(*download_tasks)

    downloaded = [
        (i, entry, raw) for i, (entry, raw) in enumerate(zip(IMAGES, raw_images, strict=True)) if raw is not None
    ]
    skipped = len(IMAGES) - len(downloaded)
    if skipped:
        logger.warning("Skipped %d images (download failed)", skipped)
    logger.info("Downloaded %d / %d images successfully", len(downloaded), len(IMAGES))

    # ── Phase 2: Generate WITHOUT effects ────────────────────────────────
    logger.info("Phase 2: Generating %d images WITHOUT bleach bypass / chromatic aberration...", len(downloaded))

    # Monkeypatch: disable effects
    original_bleach = helpers.bleach_bypass
    original_chromatic = helpers.chromatic_aberration
    helpers.bleach_bypass = lambda img, **kw: img
    helpers.chromatic_aberration = lambda img, **kw: img

    # Also patch the module-level references imported into instagram_image_service
    import backend.services.instagram_image_service as img_service_mod

    img_service_mod.bleach_bypass = helpers.bleach_bypass
    img_service_mod.chromatic_aberration = helpers.chromatic_aberration

    results = []
    count_without = 0
    for idx, entry, raw_bytes in downloaded:
        safe_name = entry["name"].lower().replace(" ", "_").replace("'", "").replace("[", "").replace("]", "")
        filename = f"{idx:02d}_{entry['sim']}_{safe_name}.jpg"
        try:
            jpeg_bytes = compose_image(service, raw_bytes, entry, idx)
            (DIR_WITHOUT / filename).write_bytes(jpeg_bytes)
            count_without += 1
            results.append(
                {
                    "index": idx,
                    "name": entry["name"],
                    "sim": entry["sim"],
                    "type": entry["type"],
                    "filename": filename,
                    "size_without": len(jpeg_bytes),
                }
            )
            if (count_without) % 10 == 0:
                logger.info("  ... %d / %d without effects", count_without, len(downloaded))
        except Exception:
            logger.exception("Failed to compose (without): %s", entry["name"])

    logger.info("Generated %d images WITHOUT effects", count_without)

    # ── Phase 3: Generate WITH effects ───────────────────────────────────
    logger.info("Phase 3: Generating %d images WITH bleach bypass + chromatic aberration...", len(downloaded))

    # Restore real functions
    helpers.bleach_bypass = original_bleach
    helpers.chromatic_aberration = original_chromatic
    img_service_mod.bleach_bypass = original_bleach
    img_service_mod.chromatic_aberration = original_chromatic

    count_with = 0
    for idx, entry, raw_bytes in downloaded:
        safe_name = entry["name"].lower().replace(" ", "_").replace("'", "").replace("[", "").replace("]", "")
        filename = f"{idx:02d}_{entry['sim']}_{safe_name}.jpg"
        try:
            jpeg_bytes = compose_image(service, raw_bytes, entry, idx)
            (DIR_WITH / filename).write_bytes(jpeg_bytes)
            count_with += 1
            # Update results with size_with
            for r in results:
                if r["filename"] == filename:
                    r["size_with"] = len(jpeg_bytes)
                    break
            if (count_with) % 10 == 0:
                logger.info("  ... %d / %d with effects", count_with, len(downloaded))
        except Exception:
            logger.exception("Failed to compose (with): %s", entry["name"])

    logger.info("Generated %d images WITH effects", count_with)

    # ── Phase 4: Generate HTML comparison ────────────────────────────────
    logger.info("Generating HTML comparison gallery...")
    html = generate_html(results)
    HTML_PATH.write_text(html, encoding="utf-8")
    logger.info("HTML gallery written to %s", HTML_PATH)

    # ── Summary ──────────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info("A/B Gallery Generation Complete")
    logger.info("  Total catalog: %d images", len(IMAGES))
    logger.info("  Downloaded:    %d", len(downloaded))
    logger.info("  Skipped:       %d", skipped)
    logger.info("  WITHOUT effects: %d in %s", count_without, DIR_WITHOUT)
    logger.info("  WITH effects:    %d in %s", count_with, DIR_WITH)
    logger.info("  HTML gallery:  %s", HTML_PATH)
    logger.info("=" * 60)

    # Open in browser
    subprocess.run(["open", str(HTML_PATH)], check=False)


if __name__ == "__main__":
    asyncio.run(main())
