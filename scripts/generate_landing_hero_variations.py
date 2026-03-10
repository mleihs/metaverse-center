"""Generate hero background image variations for landing page showcase.

3 moods: Fractured Observatory (A), War Room (B), Cosmic Fracture (C).
All 1920x900, AVIF quality 85/80 (full + thumb).

Usage:
  python3.13 scripts/generate_landing_hero_variations.py         # Generate all
  python3.13 scripts/generate_landing_hero_variations.py hero-b   # Generate one

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
        "name": "hero-a",
        "storage_path": "platform/landing/hero-a.avif",
        "prompt": (
            "Panoramic dark fantasy concept art of an interdimensional observation station, "
            "vast hexagonal command console with cracked viewport showing fractured world shards "
            "floating in void, amber-gold holographic displays casting light on dark surfaces, "
            "surveillance terminal aesthetic, deep blacks with amber highlights, "
            "atmospheric depth, volumetric amber light through dimensional cracks, "
            "cinematic wide composition, concept art quality, dramatic chiaroscuro, "
            "not photorealistic, not bright"
        ),
        "width": 1920,
        "height": 900,
    },
    {
        "name": "hero-b",
        "storage_path": "platform/landing/hero-b.avif",
        "prompt": (
            "Dark military command bunker interior, massive wall of amber-glowing tactical "
            "screens and monitors, holographic globe in center showing fracture lines between "
            "realities, silhouettes of bureau officers standing at attention, volumetric amber "
            "light cutting through atmospheric smoke, war room aesthetic, deep shadows with "
            "amber instrument glow, dramatic chiaroscuro lighting, concept art quality, "
            "cinematic wide composition, not photorealistic, not bright, brutalist architecture"
        ),
        "width": 1920,
        "height": 900,
    },
    {
        "name": "hero-c",
        "storage_path": "platform/landing/hero-c.avif",
        "prompt": (
            "Epic scale concept art of a massive dimensional rift tearing through dark space, "
            "amber-gold energy crackling along the jagged fracture edges, through the tear "
            "fragments of different civilizations are visible — brutalist concrete towers, "
            "crystalline underground caves, derelict space stations — void and starfield "
            "background, the rift is the brightest element with amber lightning arcs, "
            "cosmic scale, concept art quality, cinematic composition, atmospheric, "
            "not photorealistic, not bright, deep blacks with amber energy highlights"
        ),
        "width": 1920,
        "height": 900,
    },
    {
        "name": "hero-c2",
        "storage_path": "platform/landing/hero-c2.avif",
        "prompt": (
            "Epic dark concept art of a shattered dimensional barrier viewed from below, "
            "looking up through concentric rings of fractured reality, each ring showing a "
            "different world — a burning city, an arctic wasteland, a fungal jungle — amber-gold "
            "energy veins threading between the layers like a cracked stained glass window, "
            "debris and dust particles caught in amber light beams, cosmic void beyond, "
            "vertigo-inducing perspective, concept art quality, cinematic, "
            "not photorealistic, not bright, deep blacks with amber energy veins"
        ),
        "width": 1920,
        "height": 900,
    },
    {
        "name": "hero-c3",
        "storage_path": "platform/landing/hero-c3.avif",
        "prompt": (
            "Dark cosmic concept art of twin colliding dimensions, two massive continental "
            "landmasses crashing into each other in slow motion through the void of space, "
            "amber-gold shockwave energy radiating from the collision point, fragments and "
            "debris spiraling outward, one dimension is brutalist industrial the other is "
            "crystalline organic, the impact zone glows with intense amber plasma, "
            "epic scale dwarfing the viewer, concept art quality, cinematic wide composition, "
            "not photorealistic, not bright, deep blacks with amber collision energy"
        ),
        "width": 1920,
        "height": 900,
    },
    {
        "name": "hero-c4",
        "storage_path": "platform/landing/hero-c4.avif",
        "prompt": (
            "Vast dark concept art of a dimensional wound in the fabric of space, viewed from "
            "the edge of an observation platform, the wound is a spiraling vortex of amber-gold "
            "energy pulling in fragments of broken worlds like a cosmic whirlpool, silhouettes "
            "of watchtowers on the platform edge, amber searchlights piercing the darkness, "
            "swirling debris and dust clouds, surveillance aesthetic meets cosmic horror, "
            "extreme depth and scale, concept art quality, cinematic composition, "
            "not photorealistic, not bright, deep blacks with amber vortex glow"
        ),
        "width": 1920,
        "height": 900,
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
        # Crop-to-cover: scale to fill target, then center-crop
        src_w, src_h = img.size
        target_ratio = max_width / max_height
        src_ratio = src_w / src_h
        if src_ratio > target_ratio:
            # Source is wider — scale by height, crop width
            new_h = max_height
            new_w = int(src_w * (max_height / src_h))
        else:
            # Source is taller — scale by width, crop height
            new_w = max_width
            new_h = int(src_h * (max_width / src_w))
        img = img.resize((new_w, new_h), Image.LANCZOS)
        left = (new_w - max_width) // 2
        top = (new_h - max_height) // 2
        img = img.crop((left, top, left + max_width, top + max_height))
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
            "aspect_ratio": "21:9",
            "megapixels": "1",
            "guidance": 3.5,
            "num_inference_steps": 28,
            "output_format": "png",
            "output_quality": 100,
        },
    )

    if isinstance(output, list):
        return output[0].read()
    return output.read()


# ── Main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    print("=== Hero Background Variations ===\n")

    token = os.environ.get("REPLICATE_API_TOKEN") or os.environ.get("REPLICATE_API_KEY")
    if not token:
        print("ERROR: REPLICATE_API_TOKEN not set in environment or .env")
        sys.exit(1)

    print(f"Replicate token: {token[:8]}...")
    print(f"Service key: {SUPABASE_SERVICE_KEY[:15]}...\n")

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

        print("  Generating via Flux Dev...")
        raw_bytes = generate_image(img["prompt"])
        print(f"  Raw output: {len(raw_bytes)} bytes")

        # Full-res
        full_avif = convert_to_avif(raw_bytes, quality=AVIF_QUALITY)
        full_path = img["storage_path"].replace(".avif", ".full.avif")
        print(f"  Full-res AVIF: {len(full_avif)} bytes")
        upload_to_storage(full_path, full_avif)
        print(f"  Uploaded full-res: {BUCKET}/{full_path}")

        # Thumbnail
        thumb_avif = convert_to_avif(raw_bytes, img["width"], img["height"], quality=AVIF_QUALITY_THUMB)
        print(f"  Thumbnail AVIF: {len(thumb_avif)} bytes")
        print(f"  Uploading thumbnail to {BUCKET}/{img['storage_path']}...")
        public_url = upload_to_storage(img["storage_path"], thumb_avif)
        print(f"  Public URL: {public_url}")

        print()
        time.sleep(2)

    print("=== Done ===")
    print("\nImage paths:")
    for img in images:
        print(f"  {img['name']}: {BUCKET}/{img['storage_path']}")


if __name__ == "__main__":
    main()
