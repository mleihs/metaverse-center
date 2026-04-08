#!/usr/bin/env python3
"""
Generate dungeon detail page background images via Replicate (flux-1.1-pro).

Each archetype detail page needs 4 variant images beyond the base showcase image:
  - depth:      Bestiary room — the dungeon's hostile interior
  - whispers:   Banter interlude (low tier) — intimate, atmospheric, pre-crisis
  - revolution:  Banter interlude (high tier) — climactic, chaotic, crisis peak
  - boss:       Exit/boss room — the final confrontation space

Usage:
    cd /path/to/velgarien-rebuild
    source .venv/bin/activate

    # Generate all 4 variants for one archetype:
    python scripts/generate_dungeon_detail_images.py overthrow

    # Generate all archetypes:
    python scripts/generate_dungeon_detail_images.py --all

    # Generate only specific variants:
    python scripts/generate_dungeon_detail_images.py shadow --variants depth,boss

    # Upload to production (default: local Supabase):
    python scripts/generate_dungeon_detail_images.py overthrow --production

    # Dry-run (print prompts, don't generate):
    python scripts/generate_dungeon_detail_images.py overthrow --dry-run

    # Skip upload (local save only):
    python scripts/generate_dungeon_detail_images.py overthrow --no-upload
"""

from __future__ import annotations

import argparse
import asyncio
import io
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

load_dotenv()

import replicate
from PIL import Image
from supabase import create_client

# ── Config ───────────────────────────────────────────────────────────────────

REPLICATE_MODEL = "black-forest-labs/flux-1.1-pro"
BUCKET = "simulation.assets"
STORAGE_PREFIX = "showcase"
AVIF_QUALITY = 80
MAX_DIMENSION = 1024
LOCAL_BACKUP_DIR = Path("/tmp/dungeon-detail-images")

# Production Supabase (from MCP config / memory)
PROD_URL = "https://bffjoupddfjaljqrwqck.supabase.co"

VARIANT_NAMES = ("depth", "whispers", "revolution", "boss")

# ── Shared style suffixes ────────────────────────────────────────────────────
# Appended to every prompt for visual consistency across archetypes.

STYLE_SUFFIX = (
    "no people visible, no text, no writing, no letters, "
    "cinematic composition, dramatic lighting, "
    "concept art style, highly detailed, 4k, "
    "dark moody atmosphere, widescreen 16:9 aspect ratio"
)


# ═══════════════════════════════════════════════════════════════════════════════
# ARCHETYPE PROMPT REGISTRY
#
# Each archetype defines 4 prompts rooted in its specific literary DNA,
# visual vocabulary, and unique mechanic. Prompts are crafted to produce
# background images that work at 0.15–0.25 opacity behind UI content.
#
# Key constraint: backgrounds must have sufficient tonal range and negative
# space for text overlays. Avoid high-frequency detail in the center.
# ═══════════════════════════════════════════════════════════════════════════════

ARCHETYPE_PROMPTS: dict[str, dict[str, str]] = {
    # ── I. THE SHADOW ────────────────────────────────────────────────────────
    # Literary DNA: Lovecraft, VanderMeer (Annihilation), Shirley Jackson
    # Mechanic: Erosion — visibility decreases, the dungeon learns you
    # Boss: The Remnant — formed from unresolved conflict, orbiting wisps
    # Palette: deep purple (#7c5ce7), absolute black, cold points of light
    "shadow": {
        "depth": (
            "Vast underground cavern where darkness has physical weight and texture, "
            "ink-black pooled shadows on the floor forming strange constellations, "
            "two distant cold points of purple light hovering like predatory eyes, "
            "walls that absorb rather than reflect light, "
            "faint phosphorescent veins in the rock suggesting biological awareness, "
            "Lovecraftian cosmic scale, VanderMeer's Area X atmosphere, "
            "deep purple and absolute black color palette"
        ),
        "whispers": (
            "Narrow corridor where shadows pool like liquid at the base of walls, "
            "a single dim purple-white light source creating long distorted silhouettes, "
            "wisps of cold luminescence drifting at the edge of perception, "
            "walls with a faintly organic texture as if the darkness is growing, "
            "Shirley Jackson psychological dread, intimate claustrophobic space, "
            "deep purple highlights against matte black surfaces"
        ),
        "revolution": (
            "Cavern where shadows have detached from their sources and move independently, "
            "multiple shadow-shapes converging and separating in violent patterns, "
            "cracks in the floor emitting cold purple light, "
            "the ceiling lost in absolute void, wisps circling frantically, "
            "VanderMeer's Annihilation incorporation-horror, cosmic threat made visible, "
            "intense purple light fracturing through black, high contrast"
        ),
        "boss": (
            "Vast spherical chamber of absolute darkness with a single massive form "
            "at the center — a shape composed of orbiting wisps of cold light, "
            "the form slowly rotating, casting no shadow because it IS shadow, "
            "the floor reflects the entity like still water, "
            "Lovecraftian cosmic entity, sublime and terrifying, "
            "deep purple luminescence against infinite black void"
        ),
    },

    # ── II. THE TOWER ────────────────────────────────────────────────────────
    # Literary DNA: Kafka (The Trial), Danielewski (House of Leaves), Ballard
    # Mechanic: Load-bearing collapse — structural integrity degrades as you ascend
    # Boss: The Crowned — the building's ego wearing a cracked crown of certainty
    # Palette: steel blue (#4a8ab5), concrete grey, bureaucratic fluorescent
    "tower": {
        "depth": (
            "Impossible interior of a brutalist concrete tower, "
            "stairwells spiraling in directions that defy geometry, "
            "Danielewski's House of Leaves — more space inside than physics allows, "
            "steel-blue fluorescent lighting on raw concrete surfaces, "
            "numbered doors stretching into impossible perspective, "
            "Kafkaesque bureaucratic architecture, sterile and threatening"
        ),
        "whispers": (
            "Abandoned reception lobby of a concrete tower, pristine and unmanned, "
            "a single desk lamp illuminating an open ledger, "
            "elevator indicators showing floors that cannot exist, "
            "a clock on the wall running backward, "
            "Kafka's The Trial waiting room atmosphere, "
            "steel-blue and concrete grey with warm lamp highlight, clinical dread"
        ),
        "revolution": (
            "Interior of a collapsing concrete tower, structural steel exposed, "
            "load-bearing walls cracking and buckling, floors tilting at impossible angles, "
            "decimal numbers cascading down walls like rain, "
            "Ballard's High-Rise social collapse made architectural, "
            "steel-blue emergency lighting, concrete dust in the air, "
            "structural failure as visual spectacle, dramatic diagonal composition"
        ),
        "boss": (
            "Summit chamber of a brutalist tower where architecture has become sentient, "
            "a massive cracked crown of reinforced concrete resting on a steel beam throne, "
            "the walls breathing — imperceptible structural movement, "
            "hairline fractures glowing with steel-blue light throughout the room, "
            "the ceiling is open sky but the sky is wrong, "
            "Kafkaesque grandeur, the building as judge"
        ),
    },

    # ── III. THE DEVOURING MOTHER ────────────────────────────────────────────
    # Literary DNA: Octavia Butler (Bloodchild), VanderMeer, Shirley Jackson
    # Mechanic: Embrace — healing that creates dependency, abundance that suffocates
    # Boss: The Living Altar — a figure merged with the architecture, arms open
    # Palette: organic teal (#2dd4a0), bioluminescent, warm-suffocating
    "mother": {
        "depth": (
            "Underground biological chamber where walls pulse with organic rhythm, "
            "bioluminescent teal veins running through fleshy architecture, "
            "tendrils reaching from walls with patient non-threatening intention, "
            "the temperature visible as warm shimmer in the air, "
            "Octavia Butler's Xenogenesis symbiosis made architectural, "
            "teal bioluminescence against dark organic surfaces, maternal and stifling"
        ),
        "whispers": (
            "Intimate organic alcove with walls that breathe in slow rhythm, "
            "soft teal light emanating from within the tissue-like surfaces, "
            "nutrient webs glistening like morning dew, impossibly beautiful, "
            "a prepared space — temperature perfect, light perfect, anticipating need, "
            "VanderMeer's Area X beauty-horror, seductive biological design, "
            "warm teal glow, organic textures, intimate suffocating comfort"
        ),
        "revolution": (
            "Vast biological cathedral where the architecture is consuming itself, "
            "massive tether vines erupting from floor to ceiling, "
            "spore clouds catching light like dust in cathedral sunbeams, "
            "the walls contracting rhythmically, the space shrinking, "
            "Butler's parasitic symbiosis at crisis point, "
            "intense teal bioluminescence, organic chaos, birth and consumption"
        ),
        "boss": (
            "Central chamber of a living dungeon — an altar of merged flesh and stone, "
            "a robed figure half-embedded in the architecture, arms open in welcome, "
            "the face serene and ancient, tissue connecting figure to walls and floor, "
            "the entire room breathing as one organism, "
            "teal light pulsing from within the altar like a heartbeat, "
            "Jungian devouring mother archetype made spatial, sublime and terrible"
        ),
    },

    # ── IV. THE ENTROPY ──────────────────────────────────────────────────────
    # Literary DNA: Beckett (Godot, Endgame), Pynchon, Calvino (Mr. Palomar)
    # Mechanic: Degradation — abilities lose distinction, meaning dissolves
    # Boss: Entropy Warden — armor remembers but purpose does not
    # Palette: oxidized bronze (#d4920a), rust, fading toward uniform grey
    "entropy": {
        "depth": (
            "Underground corridor where surfaces are losing their definition, "
            "walls blurring into floor, edges dissolving into uniform smoothness, "
            "rust-colored particles suspended motionless in the air, "
            "a suit of corroded armor standing in the distance, joints frozen, "
            "Beckett's Endgame aesthetic — nothing changes, everything decays, "
            "oxidized bronze and rust palette fading toward monochrome grey"
        ),
        "whispers": (
            "Chamber where time has worn every surface to ambiguous smoothness, "
            "a single oxidized bronze lamp casting fading light, "
            "dust motes hanging perfectly still in still air, "
            "furniture shapes barely distinguishable from walls, "
            "Calvino's Mr. Palomar observing meaning dissolve, "
            "warm bronze tones eroding into cool grey, entropy as beauty"
        ),
        "revolution": (
            "Vast hall in accelerated decay, walls crumbling into constituent particles, "
            "dissolution swarms — clouds of matter that were once architecture, "
            "the distinction between solid and void collapsing, "
            "Pynchon's Gravity's Rainbow entropy made visible, "
            "bronze light fragmenting into scattered dust, "
            "the color palette itself collapsing toward uniform grey"
        ),
        "boss": (
            "Arena where a colossal figure in degraded armor stands guard over nothing, "
            "the armor oxidized beyond recognition, joints fused with rust, "
            "still performing protective motions over empty space, "
            "the floor a gradient from textured stone to featureless smooth, "
            "Beckett's absurd guardian — purpose forgotten, motion persisting, "
            "deep oxidized bronze at center fading to grey at edges"
        ),
    },

    # ── V. THE PROMETHEUS ────────────────────────────────────────────────────
    # Literary DNA: Mary Shelley (Frankenstein), Bruno Schulz, E.T.A. Hoffmann
    # Mechanic: Forging — combine items to create; failures become autonomous
    # Boss: The Prototype — self-improving, incomplete but doesn't know it
    # Palette: forge-orange (#e85d26), molten metal, volcanic amber
    "prometheus": {
        "depth": (
            "Subterranean workshop carved from volcanic rock, "
            "forge-orange light emanating from the walls themselves, "
            "workbenches covered in half-assembled mechanical components, "
            "sparks drifting with intention like fireflies with purpose, "
            "Shelley's Frankenstein laboratory reimagined underground, "
            "deep orange forge-light against black volcanic rock"
        ),
        "whispers": (
            "Intimate corner of a vast forge, a single workbench illuminated, "
            "components arranged with mysterious logic — they want to be combined, "
            "tools with personalities hanging from hooks, slightly different each time, "
            "a blueprint glowing faintly on vellum, the design shifting, "
            "Bruno Schulz's demiurge workshop, matter as co-creator, "
            "warm amber light on dark surfaces, creative intimacy"
        ),
        "revolution": (
            "Workshop in catastrophic creation — autonomous failed prototypes moving, "
            "forge fires burning out of control, molten metal flowing like lava, "
            "mechanical components assembling and disassembling themselves, "
            "creation gone wrong but still creating, "
            "Hoffmann's uncanny automata multiplied, Shelley's horror of abandonment, "
            "intense forge-orange and white-hot highlights, creative chaos"
        ),
        "boss": (
            "Central forge chamber with a towering metallic form at its center, "
            "the Prototype — sleek, shifting, constantly adjusting its own geometry, "
            "surface flowing like liquid mercury reflecting forge-light, "
            "incomplete but radiating absolute confidence in its incompleteness, "
            "components orbiting it like electrons around a nucleus, "
            "Shelley's creature perfected and terrible, deep orange glow"
        ),
    },

    # ── VI. THE DELUGE ───────────────────────────────────────────────────────
    # Literary DNA: J.G. Ballard (Drowned World), Bachelard, Coleridge
    # Mechanic: Rising Tide — water level increases each floor, rooms transform
    # Boss: The Current — not an enemy but a direction, water remembering
    # Palette: deep cyan (#1ab5c8), mineral-white watermarks, drowned architecture
    "deluge": {
        "depth": (
            "Submerged architectural ruins visible through murky cyan water, "
            "mineral-white watermarks at multiple heights showing previous floods, "
            "20th-century building facades half-visible beneath the surface, "
            "Triassic ferns growing from impossible places, "
            "Ballard's Drowned World — drowned city as palimpsest, "
            "deep cyan water with white mineral traces, geological time visible"
        ),
        "whispers": (
            "Chamber at the waterline — half dry, half submerged, "
            "the surface of dark water perfectly still, mirror-like, "
            "light filtering down from above through cyan-tinted water, "
            "submerged furniture visible below the surface like frozen time, "
            "Bachelard's Water and Dreams — narcissistic dissolution, "
            "cyan and dark blue with reflected light, liminal and seductive"
        ),
        "revolution": (
            "Vast flooded hall with water rising visibly, white-capped waves, "
            "architecture collapsing under water pressure, debris floating, "
            "deep underwater light illuminating prehistoric forms drifting past, "
            "the flood as argument — water claiming what water keeps, "
            "Coleridge's ancient mariner curse made architectural, "
            "intense cyan and white with dark depths, catastrophic beauty"
        ),
        "boss": (
            "Deepest chamber entirely submerged in luminous cyan water, "
            "a massive current visible as a spiraling vortex of light and debris, "
            "the current not attacking but arriving — water remembering, "
            "submerged architecture from multiple eras visible in the spiral, "
            "Ballard's regression made physical — the deepest water is the oldest, "
            "deep cyan luminescence, vortex composition, sublime terror"
        ),
    },

    # ── VII. THE AWAKENING ───────────────────────────────────────────────────
    # Literary DNA: Carl Jung (Red Book), Marcel Proust, Philip K. Dick (Ubik)
    # Mechanic: Awareness — perception expands but destabilizes, memory distorts
    # Boss: The Repressed — a buried memory too heavy to carry, too vital to destroy
    # Palette: lavender/amethyst (#b48aef), temporal distortion, neural topology
    "awakening": {
        "depth": (
            "Interior of a mind made spatial — neural pathways as corridors, "
            "synaptic junctions glowing with soft lavender light, "
            "multiple reflections at different temporal offsets creating visual dissonance, "
            "the architecture of consciousness rendered as physical space, "
            "Jung's collective unconscious as actual geography, "
            "lavender and amethyst light, neural topology, thought as landscape"
        ),
        "whispers": (
            "Intimate chamber of involuntary memory — familiar but impossible, "
            "objects from different times coexisting in the same space, "
            "soft lavender mist obscuring while revealing, "
            "Proust's madeleine moment made architectural, "
            "a mirror showing a reflection that arrives half a second late, "
            "warm lavender tones, intimate temporal overlap, dreamlike clarity"
        ),
        "revolution": (
            "Vast space where consciousness has become unstable, "
            "multiple realities overlapping and competing for dominance, "
            "time ripples visible in the air — moments coexisting violently, "
            "Philip K. Dick's Ubik — reality as consensus shattering, "
            "faces emerging from memory-fog, familiar and wrong, "
            "intense amethyst light fracturing into prismatic distortion"
        ),
        "boss": (
            "Central chamber of the collective unconscious — a sphere of light "
            "suspended in a void of memory fragments, "
            "the Repressed: not a monster but truth too heavy to carry, "
            "light refracting through layers of accumulated consciousness, "
            "Jung's encounter with the Self, numinous and overwhelming, "
            "pure lavender-white luminescence at center fading to deep purple void"
        ),
    },

    # ── VIII. THE OVERTHROW ──────────────────────────────────────────────────
    # Literary DNA: Orwell, Milton (Paradise Lost), Machiavelli, Dostoevsky
    # Mechanic: Authority Fracture — political order disintegrates with depth
    # Boss: The Pretender — Milton's Satan in three degrading phases
    # Palette: deep crimson (#d4364b), mirror surfaces, Cold War surveillance
    "overthrow": {
        "depth": (
            "Dark surveillance corridor in an underground political palace, "
            "mirrored walls reflecting faction insignia and propaganda posters, "
            "cold fluorescent lighting casting harsh shadows, concrete brutalist "
            "architecture, security cameras visible, papers scattered on the floor, "
            "oppressive atmosphere, "
            "dark moody color palette with deep reds and steel greys"
        ),
        "whispers": (
            "Intimate dimly lit political antechamber in a grand palace, "
            "mahogany desk with sealed documents and faction seals, "
            "a single desk lamp casting warm amber light against cold stone walls, "
            "shadows of venetian blinds on the wall, Machiavelli's study atmosphere, "
            "old maps and decoded ciphers pinned to the wall, "
            "paranoid atmosphere of low-level political intrigue, "
            "dark warm tones with amber highlights"
        ),
        "revolution": (
            "Chaotic grand hall of a fractured political palace, "
            "shattered mirrors reflecting distorted propaganda, "
            "overturned furniture and torn faction banners, "
            "dramatic red and orange lighting from unseen fires, "
            "broken scales of justice on the floor, "
            "revolutionary graffiti on marble columns, "
            "dark palette with intense red accents"
        ),
        "boss": (
            "Throne room at the center of a palace of mirrors, "
            "an ornate empty throne surrounded by infinite mirror reflections, "
            "each mirror showing a slightly different version of the throne, "
            "Milton's Paradise Lost grandeur corrupted and serpentine, "
            "golden crown lying on the floor before the throne, "
            "dramatic chiaroscuro lighting from above, "
            "the architecture simultaneously magnificent and decaying, "
            "dark palette with gold and crimson accents"
        ),
    },
}


# ── Helpers ──────────────────────────────────────────────────────────────────


def convert_to_avif(image_bytes: bytes) -> bytes:
    """Convert raw image bytes to AVIF, resize to max dimension."""
    img = Image.open(io.BytesIO(image_bytes))
    if max(img.size) > MAX_DIMENSION:
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    output = io.BytesIO()
    img.save(output, format="AVIF", quality=AVIF_QUALITY)
    return output.getvalue()


async def generate_image(prompt: str) -> bytes:
    """Generate image via Replicate and return raw bytes."""
    full_prompt = f"{prompt}, {STYLE_SUFFIX}"
    output = await asyncio.to_thread(
        replicate.run,
        REPLICATE_MODEL,
        input={
            "prompt": full_prompt,
            "megapixels": "1",
            "guidance": 3.5,
            "num_inference_steps": 28,
            "output_format": "png",
            "output_quality": 100,
            "aspect_ratio": "16:9",
        },
    )
    if isinstance(output, list):
        return output[0].read()
    return output.read()


def upload_to_storage(supabase_url: str, service_key: str, path: str, data: bytes) -> str:
    """Upload AVIF to Supabase Storage, return public URL."""
    client = create_client(supabase_url, service_key)
    client.storage.from_(BUCKET).upload(
        path,
        data,
        {"content-type": "image/avif", "upsert": "true"},
    )
    return client.storage.from_(BUCKET).get_public_url(path)


def get_supabase_config(production: bool) -> tuple[str, str]:
    """Return (url, service_key) for local or production Supabase."""
    if production:
        # Read service key from .mcp.json
        import json

        mcp_path = Path(__file__).parent.parent / ".mcp.json"
        if mcp_path.exists():
            mcp = json.loads(mcp_path.read_text())
            env = mcp.get("mcpServers", {}).get("supabase", {}).get("env", {})
            key = env.get("SUPABASE_ACCESS_TOKEN", "")
            if key:
                return PROD_URL, key

        raise RuntimeError(
            "Production upload requires SUPABASE_ACCESS_TOKEN in .mcp.json. "
            "Run: railway variables --json | python3 -c "
            "\"import sys,json; print(json.load(sys.stdin)['SUPABASE_SERVICE_ROLE_KEY'])\""
        )

    return os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]


# ── Main ─────────────────────────────────────────────────────────────────────


async def run(
    archetypes: list[str],
    variants: list[str],
    production: bool,
    dry_run: bool,
    no_upload: bool,
) -> None:
    LOCAL_BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    if not dry_run and not no_upload:
        supabase_url, service_key = get_supabase_config(production)
        target = "PRODUCTION" if production else "LOCAL"
    else:
        supabase_url = service_key = ""
        target = "DRY-RUN" if dry_run else "LOCAL (no upload)"

    total = len(archetypes) * len(variants)
    print(f"=== Dungeon Detail Image Generation ({target}) ===")
    print(f"    Archetypes: {', '.join(archetypes)}")
    print(f"    Variants:   {', '.join(variants)}")
    print(f"    Total:      {total} images")
    print(f"    Model:      {REPLICATE_MODEL}")
    print()

    generated = 0
    for archetype in archetypes:
        prompts = ARCHETYPE_PROMPTS[archetype]
        for variant in variants:
            name = f"dungeon-{archetype}-{variant}"
            prompt = prompts[variant]
            print(f"[{generated + 1}/{total}] {name}")

            if dry_run:
                print(f"  Prompt: {prompt[:120]}...")
                print(f"  + Style: {STYLE_SUFFIX[:80]}...")
                print()
                generated += 1
                continue

            # Generate
            print(f"  Generating via {REPLICATE_MODEL}...")
            raw_bytes = await generate_image(prompt)
            print(f"  Generated: {len(raw_bytes):,} bytes (raw PNG)")

            # Convert
            avif_bytes = convert_to_avif(raw_bytes)
            print(f"  Converted: {len(avif_bytes):,} bytes (AVIF q{AVIF_QUALITY})")

            # Save locally
            local_path = LOCAL_BACKUP_DIR / f"{name}.avif"
            local_path.write_bytes(avif_bytes)
            print(f"  Saved: {local_path}")

            # Upload
            if not no_upload:
                storage_path = f"{STORAGE_PREFIX}/{name}.avif"
                url = upload_to_storage(supabase_url, service_key, storage_path, avif_bytes)
                print(f"  Uploaded: {url}")

            print()
            generated += 1

    print(f"=== Done! {generated} images processed. ===")
    if not dry_run:
        print(f"    Local backups: {LOCAL_BACKUP_DIR}/")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate dungeon detail page background images.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Available archetypes:\n"
            "  shadow, tower, mother, entropy, prometheus, deluge, awakening, overthrow\n\n"
            "Available variants:\n"
            "  depth, whispers, revolution, boss"
        ),
    )
    parser.add_argument(
        "archetype",
        nargs="?",
        choices=list(ARCHETYPE_PROMPTS.keys()),
        help="Archetype to generate images for",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Generate images for all 8 archetypes",
    )
    parser.add_argument(
        "--variants",
        type=str,
        default=",".join(VARIANT_NAMES),
        help=f"Comma-separated variants (default: {','.join(VARIANT_NAMES)})",
    )
    parser.add_argument(
        "--production",
        action="store_true",
        help="Upload to production Supabase (default: local)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print prompts without generating or uploading",
    )
    parser.add_argument(
        "--no-upload",
        action="store_true",
        help="Generate and save locally, skip upload",
    )

    args = parser.parse_args()

    if not args.archetype and not args.all:
        parser.error("Specify an archetype or use --all")

    archetypes = list(ARCHETYPE_PROMPTS.keys()) if args.all else [args.archetype]
    variants = [v.strip() for v in args.variants.split(",")]

    for v in variants:
        if v not in VARIANT_NAMES:
            parser.error(f"Unknown variant '{v}'. Choose from: {', '.join(VARIANT_NAMES)}")

    asyncio.run(run(archetypes, variants, args.production, args.dry_run, args.no_upload))


if __name__ == "__main__":
    main()
