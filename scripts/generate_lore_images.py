"""Generate lore section images for all simulations + the platform dashboard.

12 per-simulation images (3 per sim) + 4 platform lore images = 16 total.
Uploaded to simulation.assets/{slug}/lore/ and simulation.assets/platform/lore/.

Uses: Replicate Flux Dev → AVIF conversion → Supabase Storage.

Usage:
  python3.13 scripts/generate_lore_images.py                   # Generate all 16
  python3.13 scripts/generate_lore_images.py velgarien          # Generate 3 for Velgarien
  python3.13 scripts/generate_lore_images.py station-null       # Generate 3 for Station Null
  python3.13 scripts/generate_lore_images.py capybara-kingdom   # Generate 3 for Capybara
  python3.13 scripts/generate_lore_images.py speranza           # Generate 3 for Speranza
  python3.13 scripts/generate_lore_images.py platform           # Generate 4 platform lore

Requires:
  - Backend .venv activated (for replicate + Pillow)
  - REPLICATE_API_TOKEN env var or in .env
  - Local Supabase running (supabase start)
"""

from __future__ import annotations

import io
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import replicate
import requests
from PIL import Image

# ── Config ──────────────────────────────────────────────────────────────────

SUPABASE_URL = "http://127.0.0.1:54321"


# Storage API requires the legacy JWT service_role key (sb_secret_ format doesn't work)
SUPABASE_SERVICE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0"
    ".EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
)

BUCKET = "simulation.assets"
FLUX_MODEL = "black-forest-labs/flux-dev"
AVIF_QUALITY = 85
IMAGE_WIDTH = 1024
IMAGE_HEIGHT = 576

# ── Style prefixes per simulation ────────────────────────────────────────────

VELGARIEN_STYLE = (
    "Brutalist dystopian scene, desaturated monochrome palette with harsh contrast, "
    "oppressive concrete architecture, surveillance cameras, fluorescent lighting, "
    "Soviet constructivist propaganda aesthetic, cinematic composition, "
    "concept art quality, NOT photorealistic, NOT bright, NOT colorful. "
)

CAPYBARA_STYLE = (
    "Dark fantasy underground scene, bioluminescent fungi and phosphorescent water, "
    "Victorian gothic architecture carved from stone, deep teal and warm amber palette, "
    "Sunless Sea aesthetic, oil painting style, concept art quality, "
    "NOT photorealistic, NOT bright daylight. "
)

STATION_NULL_STYLE = (
    "Sci-fi horror scene, derelict space station interior, Alien 1979 aesthetic meets "
    "Event Horizon, harsh fluorescent and CRT green lighting, corroded metal surfaces, "
    "industrial retrofuturism, cold blue-grey palette with occasional amber warning lights, "
    "concept art quality, NOT photorealistic, NOT clean, NOT bright. "
)

SPERANZA_STYLE = (
    "Post-apocalyptic underground scene, collapsed limestone sinkhole city, "
    "warm amber string lights and salvaged materials, retro-futuristic 1970s NASA-punk aesthetic, "
    "Italian neorealist warmth despite ruin, oil painting style, concept art quality, "
    "NOT photorealistic, NOT bright daylight. "
)

PLATFORM_STYLE = (
    "Abstract dark fantasy painting, oil painting style, concept art quality, "
    "dreamlike atmosphere, NOT photorealistic, NOT bright. "
)

# ── Per-simulation lore images (3 each, matching imageSlug in content files) ─

SIMULATION_IMAGES: dict[str, list[dict]] = {
    "velgarien": [
        {
            "name": "Directive 001 — Ministry of Information",
            "filename": "directive-001.avif",
            "prompt": (
                VELGARIEN_STYLE
                + "Massive brutalist government ministry building exterior, monolithic concrete "
                "facade stretching upward into grey sky, hundreds of identical windows, "
                "giant surveillance cameras mounted on every corner, a single enormous loudspeaker "
                "on the roof broadcasting to empty streets below, propaganda banners reading "
                "illegible text hanging from the facade, citizens as tiny figures queueing "
                "at the entrance, oppressive scale dwarfing all human presence"
            ),
        },
        {
            "name": "Bureau 7 — Filing Division",
            "filename": "bureaux-guide.avif",
            "prompt": (
                VELGARIEN_STYLE
                + "Vast bureaucratic office interior stretching into infinite distance, "
                "rows upon rows of identical grey metal filing cabinets under flickering "
                "fluorescent tube lighting, mountains of paper forms on every surface, "
                "a single civil servant at a desk dwarfed by the scale, pneumatic tube "
                "system overhead carrying documents, clocks on the wall showing different times, "
                "Kafkaesque absurdist architecture, impossibly high ceiling"
            ),
        },
        {
            "name": "Residential Block 7 — Life Under the Eye",
            "filename": "life-under-eye.avif",
            "prompt": (
                VELGARIEN_STYLE
                + "Residential district street scene, identical concrete apartment blocks "
                "lining both sides of a perfectly straight corridor-street, surveillance "
                "cameras on every lamp post pointing downward, citizens in identical grey "
                "clothing walking in orderly lines, a compliance kiosk booth at the corner, "
                "painted horizon visible at the end of the street — clearly artificial, "
                "oppressive uniformity, no plants, no color, no individuality"
            ),
        },
    ],
    "capybara-kingdom": [
        {
            "name": "The Unterzee — Vast Underground Sea",
            "filename": "nature-of-unterzee.avif",
            "prompt": (
                CAPYBARA_STYLE
                + "Vast underground sea stretching into darkness, bioluminescent organisms "
                "glowing beneath dark water surface, massive stalactites descending from "
                "an invisible ceiling hundreds of metres above, a small Victorian-era "
                "wooden vessel with brass lanterns sailing across the still water, "
                "capybara silhouettes visible on the deck, distant shore with glowing "
                "fungal forests, the sense of immense lightless space, mysterious and beautiful"
            ),
        },
        {
            "name": "Cartography of Darkness — Subterranean Waterways",
            "filename": "cartography-of-darkness.avif",
            "prompt": (
                CAPYBARA_STYLE
                + "Subterranean waterway passage through carved stone arches, bioluminescent "
                "fungi growing on wet stone walls casting teal and amber reflections on "
                "the dark water, a narrow canal boat navigating between towering natural "
                "rock pillars, glowing map symbols carved into the stone walls like ancient "
                "wayfinding markers, rope bridges overhead connecting cavern levels, "
                "the sense of navigating an ancient underground labyrinth"
            ),
        },
        {
            "name": "The Capybara Compact — Chamber of Accord",
            "filename": "capybara-compact.avif",
            "prompt": (
                CAPYBARA_STYLE
                + "Grand underground parliament chamber carved from natural cavern, "
                "concentric rings of stone seating descending toward a central platform, "
                "capybaras in Victorian-era formal attire seated throughout the chamber, "
                "bioluminescent crystal chandeliers hanging from stalactites, ancient "
                "scrolls and treaty documents on the central podium, teal phosphorescent "
                "light reflecting off a shallow pool around the platform, ceremonial and solemn"
            ),
        },
    ],
    "station-null": [
        {
            "name": "Station Null — Operational Status",
            "filename": "operational-status.avif",
            "prompt": (
                STATION_NULL_STYLE
                + "Derelict research space station exterior viewed from nearby, rotating "
                "habitation rings and antenna arrays, hull plates corroded and discolored, "
                "organic growths visible through cracked viewports glowing faintly green, "
                "a massive black hole in the background with a thin accretion disk casting "
                "amber light across the station surface, gravitational lensing distorting "
                "the starfield behind the anomaly, the station is small and fragile against "
                "the cosmic void, deep space isolation"
            ),
        },
        {
            "name": "Auge Gottes — The Anomaly",
            "filename": "auge-gottes.avif",
            "prompt": (
                STATION_NULL_STYLE
                + "View through a large observatory viewport looking directly at a gravitational "
                "anomaly, the black hole Auge Gottes filling most of the view, not a standard "
                "black hole but something that looks like an enormous dark eye with an accretion "
                "disk forming an iris of impossible light — wavelengths that shift between "
                "amber and violet and colors that shouldn't exist, gravitational lensing "
                "warping the starfield into concentric rings, the observatory interior "
                "reflected faintly in the viewport glass, instruments and readouts glowing "
                "CRT green, a single empty chair facing the window"
            ),
        },
        {
            "name": "Crew Manifest — Habitation Ring",
            "filename": "crew-manifest.avif",
            "prompt": (
                STATION_NULL_STYLE
                + "Long curved corridor of a space station habitation ring, dozens of "
                "identical crew quarter doors lining both sides, all sealed with red "
                "indicator lights except one with a green light at the far end, "
                "harsh fluorescent lighting casting sharp shadows, personal effects "
                "visible through a small window in one door — a made bed, folded clothes, "
                "an open book — but no people, dust-free and maintained by automated systems, "
                "the emptiness of a place built for hundreds but inhabited by few, "
                "Alien 1979 Nostromo corridor aesthetic"
            ),
        },
    ],
    "speranza": [
        {
            "name": "The Subsidence — Toledo Falls",
            "filename": "the-subsidence.avif",
            "prompt": (
                SPERANZA_STYLE
                + "Massive limestone sinkhole formation swallowing a European city, buildings "
                "tilting and sliding into the earth, the ground cracking open in concentric "
                "rings, dust and debris rising as structures collapse downward into caverns "
                "below, dramatic amber sunset lighting cutting through the dust clouds, "
                "the moment of catastrophe captured — half the city still standing, half "
                "already fallen, people as tiny figures fleeing along crumbling streets, "
                "the scale of geological disaster dwarfing human architecture"
            ),
        },
        {
            "name": "Year One — First Shelters",
            "filename": "year-one.avif",
            "prompt": (
                SPERANZA_STYLE
                + "Early underground settlement built into the walls of a collapsed limestone "
                "sinkhole, shelters constructed from salvaged materials — car doors as walls, "
                "highway signs as roofing, shipping containers stacked and reinforced with "
                "concrete, string lights powered by jury-rigged generators casting warm amber "
                "glow, cooking fires and small gardens in reclaimed spaces, people working "
                "together to build, children playing among the ruins, hope despite destruction, "
                "the bones of the old city visible above as a ceiling of rubble and rebar"
            ),
        },
        {
            "name": "The Slingshot Hub — Electromagnetic Rail",
            "filename": "slingshot-and-tube.avif",
            "prompt": (
                SPERANZA_STYLE
                + "Underground electromagnetic rail launcher hub carved from limestone, "
                "a massive tube tunnel stretching into darkness with electromagnetic coil "
                "rings visible along its length glowing blue-white, a cargo pod being "
                "loaded by workers in salvaged gear, control room with retrofitted "
                "pre-collapse screens and analog gauges, sparks and energy discharge "
                "around the launch rails, the sense of repurposed industrial technology, "
                "1970s NASA mission control meets underground resistance base"
            ),
        },
    ],
}

# ── Platform dashboard lore images (existing, kept for reference) ────────────

PLATFORM_IMAGES = [
    {
        "name": "The Unnamed — The World Before",
        "filename": "the-unnamed.avif",
        "prompt": (
            PLATFORM_STYLE
            + "A unified primordial world before destruction, warm amber mist dissolving "
            "into golden light, the sense of perfect wholeness about to shatter, a single "
            "vast landscape containing hints of all possible worlds — underground caverns, "
            "brutalist towers, starfields, gardens — all blended into one harmonious entity, "
            "warm amber and gold palette"
        ),
    },
    {
        "name": "The Fracture — The Breaking",
        "filename": "the-fracture.avif",
        "prompt": (
            PLATFORM_STYLE
            + "Reality shattering like a cosmic mirror, golden cracks splitting across a "
            "black void, through each fragment a different world is visible — concrete "
            "dystopia, bioluminescent caverns, organic coral cities, deep space stations — "
            "the fragments are drifting apart, edges glowing with amber energy, dramatic "
            "chiaroscuro lighting, wide panoramic composition"
        ),
    },
    {
        "name": "The Bleed — Where Worlds Touch",
        "filename": "the-bleed.avif",
        "prompt": (
            PLATFORM_STYLE
            + "Two realities pressing together, a brutalist concrete corridor where the walls "
            "are dissolving into bioluminescent fungi and dripping water, propaganda posters "
            "morphing into organic growths, a single glowing mushroom growing from a crack "
            "in the floor, the boundary between industrial dystopia and underground fantasy "
            "kingdom blurring, eerie atmospheric lighting, teal and amber colour palette"
        ),
    },
    {
        "name": "The Bureau — Impossible Geography",
        "filename": "the-bureau.avif",
        "prompt": (
            PLATFORM_STYLE
            + "An impossible office that spans multiple realities, filing cabinets stretching "
            "into non-Euclidean space, maps and cartographic instruments glowing with inner "
            "light, the walls are simultaneously stone, glass, coral, and concrete, a desk "
            "covered in charts that show impossible geographies, dim atmospheric lighting "
            "with warm lamplight pools, scholarly chaos, Escher meets Victorian study"
        ),
    },
]


# ── Helpers ──────────────────────────────────────────────────────────────────


def convert_to_avif(image_bytes: bytes, width: int, height: int) -> bytes:
    """Convert raw image bytes to AVIF, resizing to target dimensions."""
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    img = img.resize((width, height), Image.LANCZOS)
    output = io.BytesIO()
    img.save(output, format="AVIF", quality=AVIF_QUALITY)
    return output.getvalue()


def upload_to_storage(path: str, data: bytes) -> str:
    """Upload bytes to Supabase Storage and return the public URL."""
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "image/avif",
        "x-upsert": "true",
    }
    resp = requests.put(url, headers=headers, data=data, timeout=30)
    if resp.status_code not in (200, 201):
        # Fallback: delete + post
        requests.delete(url, headers=headers, timeout=10)
        resp = requests.post(url, headers=headers, data=data, timeout=30)
    resp.raise_for_status()
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"


def generate_image(prompt: str, guidance: float = 3.5) -> bytes:
    """Generate an image via Replicate Flux Dev and return raw bytes."""
    output = replicate.run(
        FLUX_MODEL,
        input={
            "prompt": prompt,
            "guidance": guidance,
            "num_inference_steps": 28,
            "output_format": "png",
            "output_quality": 100,
        },
    )
    if isinstance(output, list):
        return output[0].read()
    return output.read()


def process_image(name: str, storage_path: str, prompt: str, guidance: float = 3.5) -> None:
    """Generate, convert, and upload a single image."""
    print(f"--- {name} ---")
    print(f"  Prompt: {prompt[:100]}...")
    print(f"  Target: {IMAGE_WIDTH}x{IMAGE_HEIGHT}")

    print("  Generating via Flux Dev...")
    raw_bytes = generate_image(prompt, guidance)
    print(f"  Raw output: {len(raw_bytes):,} bytes")

    avif_bytes = convert_to_avif(raw_bytes, IMAGE_WIDTH, IMAGE_HEIGHT)
    print(f"  AVIF: {len(avif_bytes):,} bytes")

    print(f"  Uploading to {BUCKET}/{storage_path}...")
    public_url = upload_to_storage(storage_path, avif_bytes)
    print(f"  URL: {public_url}")
    print()

    time.sleep(2)


# ── Main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    # Parse optional filter argument
    target = sys.argv[1] if len(sys.argv) > 1 else None
    valid_targets = list(SIMULATION_IMAGES.keys()) + ["platform"]

    if target and target not in valid_targets:
        print(f"ERROR: Unknown target '{target}'")
        print(f"Valid targets: {', '.join(valid_targets)} (or omit for all)")
        sys.exit(1)

    token = os.environ.get("REPLICATE_API_TOKEN") or os.environ.get("REPLICATE_API_KEY")
    if not token:
        print("ERROR: REPLICATE_API_TOKEN not set in environment or .env")
        sys.exit(1)

    print("=== Lore Image Generation ===\n")
    print(f"Replicate token: {token[:8]}...")
    print(f"Supabase key: {SUPABASE_SERVICE_KEY[:12]}...")
    if target:
        print(f"Target: {target}")
    else:
        print("Target: ALL (16 images)")
    print()

    count = 0

    # Per-simulation lore images
    for slug, images in SIMULATION_IMAGES.items():
        if target and target != slug:
            continue

        print(f"=== {slug.upper()} ({len(images)} images) ===\n")
        # Station Null uses higher guidance for horror aesthetic
        guidance = 5.0 if slug == "station-null" else 3.5

        for img in images:
            storage_path = f"{slug}/lore/{img['filename']}"
            process_image(img["name"], storage_path, img["prompt"], guidance)
            count += 1

    # Platform dashboard lore images
    if not target or target == "platform":
        print(f"=== PLATFORM LORE ({len(PLATFORM_IMAGES)} images) ===\n")
        for img in PLATFORM_IMAGES:
            storage_path = f"platform/lore/{img['filename']}"
            process_image(img["name"], storage_path, img["prompt"])
            count += 1

    print(f"=== Done — {count} images generated and uploaded ===")


if __name__ == "__main__":
    main()
