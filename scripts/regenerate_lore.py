"""Regenerate lore for a simulation using the new research-driven pipeline.

Usage:
    cd /Users/mleihs/Dev/velgarien-rebuild
    backend/.venv/bin/python scripts/regenerate_lore.py

Regenerates lore for "The Memory Commons Enclosure" using:
1. LLM deep research (Gemini Flash) → literary/philosophical/architectural grounding
2. Enhanced BUREAU_ARCHIVIST_PROMPT → concept-lore quality output
3. World context threading → coherent image generation downstream
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from pathlib import Path

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.config import settings  # noqa: E402
from backend.services.forge_lore_service import ForgeLoreService  # noqa: E402
from backend.services.research_service import ResearchService  # noqa: E402

logging.basicConfig(level=logging.DEBUG, format="%(name)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# ── Simulation data (from production) ─────────────────────────────────

SEED = (
    "A floating archipelago where memories solidify into islands and "
    "forgetting causes erosion. Cartographers wage silent wars over "
    "which memories are worth preserving."
)

ANCHOR = {
    "title": "The Memory Commons Enclosure",
    "core_question": (
        "Positions the cartographers' conflict as a battle over the "
        "commodification of memory, where the archipelago represents "
        "the last commons of human consciousness."
    ),
    "description": (
        "Some cartographers work to privatize and monetize memory-islands, "
        "while others fight to preserve open access to the collective past."
    ),
    "literary_influence": (
        "Jorge Luis Borges' Funes the Memorious meets Elinor Ostrom's "
        "commons governance theory"
    ),
}

GEOGRAPHY = {
    "city_name": "Mnemopolis",
    "zones": [
        {"name": "Recollector's Row"},
        {"name": "The Forgotten Quarter"},
        {"name": "The Commons Sanctuary"},
        {"name": "The Retention Archives"},
        {"name": "Nostalgia Bazaar"},
    ],
}

AGENTS = [
    {
        "name": "Cassius Vale",
        "primary_profession": "Memory Futures Trader",
        "character": (
            "A flamboyant figure in constantly shifting chromatic robes. "
            "His face bears shimmer-scars from handling volatile memories. "
            "Short and wiry, frenetic energy, tasting the air to assess memory vintage."
        ),
        "background": (
            "Began as a humble memory street peddler. Built fortune by cornering "
            "the market on memories of the last rainfall. Secretly preserving "
            "an indigenous culture's memories while funding Commons Sanctuary."
        ),
    },
    {
        "name": "Dr. Miriam Frost",
        "primary_profession": "Memory Reconstruction Surgeon",
        "character": (
            "Cool competence in white graphene surgical suits. Extensively modified "
            "right arm with memory surgery instruments. Prematurely white hair "
            "in complex braids coding her research status."
        ),
        "background": (
            "Pioneered memory reconstruction surgery after witnessing forced "
            "extraction in corporate mining. Her mother's memories were shattered "
            "in a privatization dispute. Reconstruction sometimes creates false memories."
        ),
    },
    {
        "name": "Echo Zhang",
        "primary_profession": "Liminal Space Archaeologist",
        "character": (
            "Exists partially in multiple states. Memory-reactive fabric clothing. "
            "Iridescent film over eyes from exposure to memory fragments. "
            "Unpredictable rhythm of movement, repeating others' last words."
        ),
        "background": (
            "Survived a catastrophic memory collapse. Proved forgotten memories "
            "transform rather than disappear. Each recovered memory leaves a "
            "growing void in their own recollections."
        ),
    },
    {
        "name": "Rin Mori",
        "primary_profession": "Erosion Cartographer",
        "character": (
            "Lean and rope-like, weathered by traversing crumbling memory-island edges. "
            "Patchwork clothing mended with bright thread mapping erosion patterns. "
            "Shaved scalp with single braid containing woven loss markers."
        ),
        "background": (
            "From a family of traditional memory-keepers who lost everything to "
            "industrial harvesting. Discovered mathematical patterns in memory decay. "
            "Erosion data suggests total dissolution within their lifetime."
        ),
    },
    {
        "name": "Solomon Wake",
        "primary_profession": "Collective Memory Advocate",
        "character": (
            "Powerful frame with monk-like dignity. Simple dark clothing adorned "
            "with memory-storing crystals. Unusually soft melodic voice. Voluntary "
            "scarification recording preservation victories. Always speaks in 'we'."
        ),
        "background": (
            "Former corporate memory prospector who defected after experiencing "
            "communal celebrations his employer planned to commodify. Established "
            "legal framework for community memory rights."
        ),
    },
    {
        "name": "Theia Mnemore",
        "primary_profession": "Memory Authentication Specialist",
        "character": (
            "Tall and angular in high-collared archive coats of deep indigo. "
            "Heterochromatic eyes — one silver, one amber. Obsessive daily "
            "memory journaling rituals. Hands stained with iridescent memory residue."
        ),
        "background": (
            "Father's mind eroded after selling memories to cover gambling debts. "
            "Became fanatical guardian of memory authenticity. Discovered her own "
            "childhood memories may be artificial implants."
        ),
    },
]

BUILDINGS = [
    {"name": "The Cartographer's Spire", "building_type": "Observatory", "description": "Twists upward like a copper corkscrew with memory-glass windows and brass instruments."},
    {"name": "The Commons Hearth", "building_type": "Meeting Hall", "description": "Memory-wood and stress-marked stone. Visible scars from failed privatization attempts."},
    {"name": "The Crystalline Codex", "building_type": "Archive", "description": "Rises like a massive geode. Faceted translucent memory-quartz walls."},
    {"name": "The Forgetting House", "building_type": "Sanctuary", "description": "Crumbles at the edges. Mirrors that reflect nothing. Libraries of blank books."},
    {"name": "The Mnemonic Foundry", "building_type": "Factory", "description": "Belches iridescent steam. Cathedral-like distillation chamber with towering columns of shifting light."},
    {"name": "The Reminiscence Exchange", "building_type": "Market", "description": "Copper and brass tiers. Living metal price walls displaying fluctuating memory values."},
    {"name": "The Reverie Roost", "building_type": "Tavern", "description": "Perched precariously on the edge. Bar crafted from fossilized memories."},
]

# ── Astrolabe research context (from original draft) ──────────────────

ASTROLABE_CONTEXT = (
    "A floating archipelago where memories solidify into islands and "
    "forgetting causes erosion. Cartographers wage silent wars over "
    "which memories are worth preserving. This concept explores tensions "
    "between memory preservation and commodification, drawing on commons "
    "governance theory and the politics of collective remembrance."
)


async def main():
    if not settings.openrouter_api_key:
        print("ERROR: OPENROUTER_API_KEY not set in .env")
        sys.exit(1)

    print("=" * 70)
    print("STEP 1: Deep Research (Gemini Flash)")
    print("=" * 70)

    research_context = await ResearchService.research_for_lore(
        seed=SEED,
        anchor=ANCHOR,
        astrolabe_context=ASTROLABE_CONTEXT,
    )
    print(research_context)
    print()

    print("=" * 70)
    print("STEP 2: Lore Generation (Claude 3.5 Sonnet + research context)")
    print("=" * 70)

    sections = await ForgeLoreService.generate_lore(
        seed=SEED,
        anchor=ANCHOR,
        geography=GEOGRAPHY,
        agents=AGENTS,
        buildings=BUILDINGS,
        research_context=research_context,
    )

    for i, section in enumerate(sections):
        print(f"\n{'─' * 60}")
        print(f"Chapter: {section['chapter']} | Arcanum: {section['arcanum']}")
        print(f"Title: {section['title']}")
        if section.get("epigraph"):
            print(f"Epigraph: {section['epigraph']}")
        print(f"{'─' * 60}")
        print(section["body"])
        if section.get("image_slug"):
            print(f"\n[IMAGE: {section['image_slug']}]")
            print(f"Caption: {section.get('image_caption', '')}")

    # Save to file for comparison
    output_path = Path(__file__).parent / "lore_output.json"
    with open(output_path, "w") as f:
        json.dump(sections, f, indent=2, ensure_ascii=False)
    print(f"\n\nSaved {len(sections)} sections to {output_path}")


if __name__ == "__main__":
    asyncio.run(main())
