"""Generate dashboard images: 1 hero background + 5 simulation banners.

Uses Replicate Flux Dev directly, converts to AVIF (dual-resolution: full-res + thumbnail),
uploads to Supabase Storage (simulation.assets bucket), and updates banner_url on each simulation.

Usage:
  python3.13 scripts/generate_dashboard_images.py              # Generate all
  python3.13 scripts/generate_dashboard_images.py station-null  # Generate one by name

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

# Load .env from project root
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import replicate
import requests
from PIL import Image

# ── Config ──────────────────────────────────────────────────────────────────

SUPABASE_URL = "http://127.0.0.1:54321"


def get_service_key() -> str:
    """Get the Supabase service key. Prefers sb_secret_ from `supabase status`."""
    import subprocess

    result = subprocess.run(
        ["supabase", "status"],
        capture_output=True, text=True,
    )
    for line in result.stdout.splitlines():
        if "Secret" in line and "sb_secret_" in line:
            for part in line.split():
                if part.startswith("sb_secret_"):
                    return part
    # Fallback: legacy JWT service_role key
    return (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
        ".eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0"
        ".EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    )


SUPABASE_SERVICE_KEY = get_service_key()

VELGARIEN_SIM_ID = "10000000-0000-0000-0000-000000000001"
GASLIT_REACH_SIM_ID = "20000000-0000-0000-0000-000000000001"
STATION_NULL_SIM_ID = "30000000-0000-0000-0000-000000000001"
SPERANZA_SIM_ID = "40000000-0000-0000-0000-000000000001"
CITE_DES_DAMES_SIM_ID = "50000000-0000-0000-0000-000000000001"
CONVENTIONAL_MEMORY_SIM_ID = "70000000-0000-0000-0000-000000000001"

BUCKET = "simulation.assets"
FLUX_MODEL = "black-forest-labs/flux-dev"

AVIF_QUALITY = 85  # Full-resolution originals
AVIF_QUALITY_THUMB = 80  # Display-optimized thumbnails

# ── Image definitions ───────────────────────────────────────────────────────

IMAGES = [
    {
        "name": "Dashboard Hero",
        "storage_path": "platform/dashboard-hero.avif",
        "simulation_id": None,  # Platform-level asset
        "prompt": (
            "Abstract dark fantasy painting of fractured reality, shattered mirror "
            "reflecting multiple worlds, deep black void with amber and gold cracks "
            "between fragments, through the cracks glimpses of different realities "
            "— brutalist concrete, bioluminescent caverns, starfields — oil painting "
            "style, concept art quality, dramatic lighting, wide panoramic composition, "
            "not photorealistic, not bright"
        ),
        "width": 1344,
        "height": 768,
    },
    {
        "name": "Velgarien Banner",
        "storage_path": f"{VELGARIEN_SIM_ID}/banner.avif",
        "simulation_id": VELGARIEN_SIM_ID,
        "prompt": (
            "Brutalist dystopian cityscape panorama, massive concrete towers under "
            "oppressive grey sky, surveillance cameras and searchlights, desaturated "
            "palette with harsh contrast, cinematic wide shot, architectural photography "
            "style, industrial atmosphere, not bright, not colorful"
        ),
        "width": 1024,
        "height": 683,
    },
    {
        "name": "The Gaslit Reach Banner",
        "storage_path": f"{GASLIT_REACH_SIM_ID}/banner.avif",
        "simulation_id": GASLIT_REACH_SIM_ID,
        "prompt": (
            "Vast underground cavern panorama with bioluminescent fungi and phosphorescent "
            "water, Victorian gothic subterranean city with rope bridges and fungal spires, "
            "deep greens and warm amber light, oil painting style, concept art quality, "
            "wide establishing shot, Sunless Sea aesthetic, not photorealistic"
        ),
        "width": 1024,
        "height": 683,
    },
    {
        "name": "Station Null Banner",
        "storage_path": f"{STATION_NULL_SIM_ID}/banner.avif",
        "simulation_id": STATION_NULL_SIM_ID,
        "prompt": (
            "Derelict space station exterior orbiting a supermassive black hole, "
            "the accretion disk casting amber and violet light across corroded hull plates, "
            "a research station with rotating habitation rings and antenna arrays, "
            "hull breaches leaking atmosphere into void, organic growths visible through "
            "cracked viewports, deep space horror, Alien meets Event Horizon aesthetic, "
            "concept art quality, wide establishing shot, cold void background with "
            "gravitational lensing distortion, not photorealistic, not bright, not clean"
        ),
        "width": 1024,
        "height": 683,
    },
    {
        "name": "Speranza Banner",
        "storage_path": f"{SPERANZA_SIM_ID}/banner.avif",
        "simulation_id": SPERANZA_SIM_ID,
        "prompt": (
            "Underground sinkhole city panorama, collapsed limestone cavern with "
            "pre-collapse buildings leaning at angles against rock walls, warm amber "
            "string lights criss-crossing overhead, rope bridges and scaffolding, "
            "market stalls and a massive electromagnetic rail launcher in the background, "
            "retro-futuristic post-apocalyptic, 1970s NASA-punk aesthetic, "
            "concept art quality, wide establishing shot, warm hopeful atmosphere "
            "despite post-apocalyptic setting, not photorealistic, not bright daylight"
        ),
        "width": 1024,
        "height": 683,
    },
    {
        "name": "Cité des Dames Banner",
        "storage_path": f"{CITE_DES_DAMES_SIM_ID}/banner.avif",
        "simulation_id": CITE_DES_DAMES_SIM_ID,
        "prompt": (
            "Illuminated manuscript style panorama of a sunlit walled city, "
            "honey-coloured limestone walls with names inscribed in the stone, "
            "medieval buttresses with Regency balustrades and Pre-Raphaelite stained glass, "
            "climbing roses and wisteria on art nouveau ironwork gates, "
            "a fertile plain with wildflowers in the foreground, "
            "ultramarine sky with gold leaf accents, warm afternoon light, "
            "women in historical dress from different eras visible on the walls, "
            "painterly literary aesthetic, wide establishing shot, "
            "jewel-tone richness, vellum texture"
        ),
        "width": 1024,
        "height": 683,
    },
    {
        "name": "Conventional Memory Banner",
        "storage_path": f"{CONVENTIONAL_MEMORY_SIM_ID}/banner.avif",
        "simulation_id": CONVENTIONAL_MEMORY_SIM_ID,
        "prompt": (
            "Close-up photograph of a vintage beige IBM PC XT computer on a cluttered "
            "1990s office desk, CRT monitor displaying blue DOS screen with white text "
            "and box-drawing characters, green phosphor glow, mechanical keyboard, "
            "stacked floppy disks, coiled cables, warm tungsten desk lamp lighting, "
            "tech nostalgia, photorealistic, slightly yellowed plastic, visible CRT "
            "scanlines, the screen shows a VBDOS program with cyan and yellow text "
            "on blue background, wide panoramic composition"
        ),
        "width": 1024,
        "height": 683,
    },
]

# ── Helpers ──────────────────────────────────────────────────────────────────


def convert_to_avif(
    image_bytes: bytes,
    max_width: int | None = None,
    max_height: int | None = None,
    quality: int = AVIF_QUALITY,
) -> bytes:
    """Convert raw image bytes to AVIF.

    If max_width and max_height are provided, resize (thumbnail mode).
    If omitted, preserve native resolution (full-res mode).
    """
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    if max_width is not None and max_height is not None:
        img = img.resize((max_width, max_height), Image.LANCZOS)
    output = io.BytesIO()
    img.save(output, format="AVIF", quality=quality)
    return output.getvalue()


def upload_to_storage(path: str, data: bytes) -> str:
    """Upload bytes to Supabase Storage and return the public URL."""
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "apikey": SUPABASE_SERVICE_KEY,
        "Content-Type": "image/avif",
        "x-upsert": "true",
    }

    resp = requests.post(url, headers=headers, data=data, timeout=30)
    resp.raise_for_status()

    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"
    return public_url


def update_simulation_banner(simulation_id: str, banner_url: str) -> None:
    """Update the banner_url field on a simulation."""
    url = f"{SUPABASE_URL}/rest/v1/simulations?id=eq.{simulation_id}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "apikey": SUPABASE_SERVICE_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    resp = requests.patch(
        url,
        json={"banner_url": banner_url},
        headers=headers,
        timeout=10,
    )
    resp.raise_for_status()
    print(f"    Updated banner_url on simulation {simulation_id}")


def generate_image(prompt: str) -> bytes:
    """Generate an image via Replicate Flux Dev and return raw bytes."""
    output = replicate.run(
        FLUX_MODEL,
        input={
            "prompt": prompt,
            "megapixels": "1",
            "guidance": 3.5,
            "num_inference_steps": 28,
            "output_format": "png",
            "output_quality": 100,
        },
    )

    # Output is FileOutput or list of FileOutput
    if isinstance(output, list):
        return output[0].read()
    return output.read()


# ── Main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    print("=== Dashboard Image Generation ===\n")

    # Check for Replicate token
    token = os.environ.get("REPLICATE_API_TOKEN") or os.environ.get("REPLICATE_API_KEY")
    if not token:
        print("ERROR: REPLICATE_API_TOKEN not set in environment or .env")
        sys.exit(1)

    print(f"Replicate token: {token[:8]}...")
    print(f"Service key: {SUPABASE_SERVICE_KEY[:15]}...\n")

    # Filter by name if argument provided
    images = IMAGES
    if len(sys.argv) > 1:
        filter_name = sys.argv[1].lower().replace("_", " ").replace("-", " ")
        images = [img for img in IMAGES if filter_name in img["name"].lower().replace("-", " ")]
        if not images:
            print(f"ERROR: No image matching '{sys.argv[1]}'. Available:")
            for img in IMAGES:
                print(f"  - {img['name']}")
            sys.exit(1)
        print(f"Generating {len(images)} image(s) matching '{sys.argv[1]}':\n")

    for img in images:
        print(f"--- {img['name']} ---")
        print(f"  Prompt: {img['prompt'][:80]}...")
        print(f"  Thumbnail: {img['width']}x{img['height']}")

        # Generate
        print("  Generating via Flux Dev...")
        raw_bytes = generate_image(img["prompt"])
        print(f"  Raw output: {len(raw_bytes)} bytes")

        # Full-res: native resolution, quality 85
        full_avif = convert_to_avif(raw_bytes, quality=AVIF_QUALITY)
        full_path = img["storage_path"].replace(".avif", ".full.avif")
        print(f"  Full-res AVIF: {len(full_avif)} bytes")
        upload_to_storage(full_path, full_avif)
        print(f"  Uploaded full-res: {BUCKET}/{full_path}")

        # Thumbnail: resized, quality 80
        thumb_avif = convert_to_avif(raw_bytes, img["width"], img["height"], quality=AVIF_QUALITY_THUMB)
        print(f"  Thumbnail AVIF: {len(thumb_avif)} bytes")
        print(f"  Uploading thumbnail to {BUCKET}/{img['storage_path']}...")
        public_url = upload_to_storage(img["storage_path"], thumb_avif)
        print(f"  Public URL: {public_url}")

        # Update simulation banner if applicable
        if img["simulation_id"]:
            update_simulation_banner(img["simulation_id"], public_url)

        print()
        time.sleep(2)  # Brief pause between API calls

    print("=== Done ===")
    print("\nHero image path: platform/dashboard-hero.avif")
    print("Banner URLs have been set on the simulation records.")


if __name__ == "__main__":
    main()
