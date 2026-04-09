"""Image conversion utilities.

Pure utilities with no service dependencies — safe to import from anywhere.
"""

from __future__ import annotations

import io
import logging

logger = logging.getLogger(__name__)

# ── AVIF Quality Presets ─────────────────────────────────────────────────

AVIF_QUALITY = 85  # Full-resolution originals
AVIF_QUALITY_THUMB = 80  # Display-optimized thumbnails
MAX_IMAGE_DIMENSION = 1024  # Default thumbnail max edge


def convert_to_avif(
    image_bytes: bytes,
    max_dimension: int | None = MAX_IMAGE_DIMENSION,
    quality: int = AVIF_QUALITY,
) -> bytes:
    """Convert image bytes to AVIF format.

    Args:
        image_bytes: Raw image data (PNG, JPEG, WebP, etc.).
        max_dimension: If set, resize so the longest edge fits this limit.
            Pass None to preserve native resolution (full-res mode).
        quality: AVIF quality (0-100).

    Returns:
        AVIF-encoded image bytes. Falls back to raw bytes if Pillow is missing.
    """
    try:
        from PIL import Image
    except ImportError:
        logger.warning("Pillow not installed — returning raw image bytes")
        return image_bytes

    img = Image.open(io.BytesIO(image_bytes))

    # Resize if max_dimension is set and image exceeds it
    if max_dimension is not None and max(img.size) > max_dimension:
        img.thumbnail((max_dimension, max_dimension))

    # Convert to RGB if necessary (e.g. RGBA, palette)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    output = io.BytesIO()
    img.save(output, format="AVIF", quality=quality)
    return output.getvalue()
