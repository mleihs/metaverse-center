"""Generate landing page images: 1 hero + 3 feature visuals.

Uses Replicate Flux Dev directly, converts to AVIF (dual-resolution: full-res + thumbnail),
uploads to Supabase Storage (simulation.assets/platform/landing/ path).

Usage:
  python3.13 scripts/generate_landing_images.py              # Generate all
  python3.13 scripts/generate_landing_images.py hero          # Generate one by name

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

BUCKET = "simulation.assets"
FLUX_MODEL = "black-forest-labs/flux-dev"

AVIF_QUALITY = 85
AVIF_QUALITY_THUMB = 80

# ── Image definitions ───────────────────────────────────────────────────────

IMAGES = [
    {
        "name": "Landing Hero",
        "storage_path": "platform/landing/hero.avif",
        "prompt": (
            "Panoramic dark fantasy concept art of an interdimensional observation station, "
            "a vast hexagonal command console in the foreground with holographic amber-gold "
            "displays showing different fractured worlds, through a massive cracked viewport "
            "fragments of different realities float in a dark void — a brutalist concrete "
            "city shard, a bioluminescent underground cavern shard, a derelict space station "
            "shard, amber energy crackling between the fragments, deep blacks with amber and "
            "gold highlights, surveillance terminal aesthetic, concept art quality, "
            "cinematic wide composition, atmospheric depth, volumetric lighting through the "
            "cracks between worlds, not photorealistic, not bright, dramatic chiaroscuro"
        ),
        "width": 1920,
        "height": 900,
    },
    {
        "name": "Feature Worldbuilding",
        "storage_path": "platform/landing/feature-worldbuilding.avif",
        "prompt": (
            "Dark atmospheric concept art of a living simulation city seen through a "
            "surveillance monitor frame, AI agents walking through brutalist streets with "
            "amber streetlights, tall concrete towers with glowing windows, a holographic "
            "city map overlay floating above the scene, data streams and building blueprints "
            "visible as ghostly overlays, cinematic establishing shot, dark palette with "
            "warm amber accents, concept art quality, oil painting texture, not photorealistic, "
            "not bright, surveillance camera perspective, vignette"
        ),
        "width": 800,
        "height": 600,
    },
    {
        "name": "Feature Competition",
        "storage_path": "platform/landing/feature-competition.avif",
        "prompt": (
            "Dark atmospheric concept art of an espionage war room, a tactical operations "
            "table showing a holographic map of competing civilizations, chess-piece-like "
            "operative figurines on the board — spies, saboteurs, assassins — amber and "
            "red markers showing alliances and betrayals, shadowy figures in military coats "
            "observing from the edges, candlelight and amber monitor glow, dark palette, "
            "top-secret classified dossier aesthetic, concept art quality, oil painting "
            "texture, not photorealistic, not bright, dramatic shadows"
        ),
        "width": 800,
        "height": 600,
    },
    {
        "name": "Feature Substrate",
        "storage_path": "platform/landing/feature-substrate.avif",
        "prompt": (
            "Dark atmospheric concept art of reality fracturing, a seismograph-like device "
            "in the foreground detecting tremors between worlds, through the cracks in a "
            "dark wall real-world imagery bleeds into a fantasy landscape — newspaper "
            "headlines dissolving into scrolls, a modern earthquake cracking medieval stone "
            "walls, satellite dishes morphing into crystal towers, the boundary between "
            "realities shown as amber-gold lightning, dark void background, surveillance "
            "aesthetic, concept art quality, not photorealistic, not bright, eerie atmosphere"
        ),
        "width": 800,
        "height": 600,
    },
]

# ── Helpers ──────────────────────────────────────────────────────────────────


def convert_to_avif(
    image_bytes: bytes,
    max_width: int | None = None,
    max_height: int | None = None,
    quality: int = AVIF_QUALITY,
) -> bytes:
    """Convert raw image bytes to AVIF."""
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
    print("=== Landing Page Image Generation ===\n")

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
        print(f"  Target: {img['width']}x{img['height']}")

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

        print()
        time.sleep(2)  # Brief pause between API calls

    print("=== Done ===")
    print("\nImage paths:")
    for img in images:
        print(f"  {img['name']}: {BUCKET}/{img['storage_path']}")
    print("\nUpdate LandingPage.ts to reference these paths.")


if __name__ == "__main__":
    main()
