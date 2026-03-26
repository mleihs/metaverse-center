"""Service for terminal boot art generation via image-to-ASCII conversion.

Generates a hybrid boot art: simulation banner image converted to ASCII
(deterministic, always correct) + pyfiglet title banner. Stored in
simulation_settings as category='design', key='terminal_boot_art'.

Architecture: follows forge_lore_service.py pattern (static methods,
centralized error handling). Uses Pillow for image processing — no LLM
dependency for ASCII art (research shows LLMs are unreliable at spatial
ASCII art due to tokenization destroying 2D relationships).
"""

from __future__ import annotations

import io
import logging
from typing import Any

import httpx
import pyfiglet
import sentry_sdk
import structlog
from PIL import Image

from backend.utils.safe_fetch import safe_download

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────

MAX_ART_WIDTH = 60
MAX_ART_LINES = 20
MAX_SCENE_HEIGHT = 14
MAX_SCENE_WIDTH = 60

# Character ramp from dark to light (11 levels).
# Chosen for visual density on monospace CRT terminal.
ASCII_RAMP = " .:-=+*#%@"

# Preferred figlet fonts (tried in order, first that fits wins)
PREFERRED_FONTS = ["small", "standard", "mini", "digital"]


# ── Service ──────────────────────────────────────────────────────────────────


class ForgeAsciiArtService:
    """Generates terminal boot art from simulation banner images."""

    @staticmethod
    def generate_figlet_title(
        name: str,
        max_width: int = MAX_ART_WIDTH,
    ) -> str:
        """Generate a FIGlet title banner that fits within max_width.

        Tries preferred fonts in order, returns the first that fits.
        Falls back to plain centered uppercase text.
        """
        for font_name in PREFERRED_FONTS:
            try:
                fig = pyfiglet.Figlet(font=font_name, width=max_width)
                rendered = fig.renderText(name).rstrip("\n")
                lines = rendered.split("\n")
                if all(len(line) <= max_width for line in lines) and len(lines) <= 8:
                    return rendered
            except pyfiglet.FontNotFound:
                continue
        # Absolute fallback: plain centered text
        return name.upper().center(max_width)

    @staticmethod
    def image_to_ascii(
        image: Image.Image,
        width: int = MAX_SCENE_WIDTH,
        height: int = MAX_SCENE_HEIGHT,
        invert: bool = True,
    ) -> str:
        """Convert a PIL Image to ASCII art using brightness-to-character mapping.

        Uses ITU-R BT.601 luminance formula for perceptually correct grayscale.
        Aspect ratio correction: terminal chars are ~2x taller than wide,
        so we halve the vertical resolution.

        Parameters
        ----------
        image : PIL.Image
            Source image (any format/mode).
        width : int
            Output width in characters.
        height : int
            Output height in lines.
        invert : bool
            If True, dark image areas map to dense characters (for dark terminal bg).
        """
        # Convert to grayscale
        gray = image.convert("L")

        # Resize with aspect ratio correction (chars are ~2:1 height:width)
        gray = gray.resize((width, height), Image.Resampling.LANCZOS)

        # Map pixel brightness (0-255) to ASCII characters
        ramp = ASCII_RAMP if invert else ASCII_RAMP[::-1]
        ramp_len = len(ramp)

        lines: list[str] = []
        for y in range(height):
            row: list[str] = []
            for x in range(width):
                brightness = gray.getpixel((x, y))
                # Map 0-255 to ramp index
                idx = int(brightness / 256 * ramp_len)
                idx = min(idx, ramp_len - 1)
                row.append(ramp[idx])
            lines.append("".join(row))

        return "\n".join(lines)

    @staticmethod
    async def fetch_banner_image(
        banner_url: str,
        timeout: float = 15.0,
    ) -> Image.Image | None:
        """Download a simulation banner image and return as PIL Image.

        Uses ``safe_download`` for SSRF protection (blocks private/internal IPs).
        Returns None if the fetch fails (network error, 404, invalid image).
        """
        try:
            data, _content_type = await safe_download(
                banner_url,
                timeout=timeout,
                allowed_content_types={"image/png", "image/jpeg", "image/webp", "image/gif"},
            )
            return Image.open(io.BytesIO(data))
        except (ValueError, httpx.HTTPStatusError, OSError) as exc:
            logger.warning("Failed to fetch banner image: %s", banner_url, exc_info=True)
            sentry_sdk.capture_exception(exc)
            return None

    @staticmethod
    def validate_ascii_art(
        art: str,
        max_width: int = MAX_ART_WIDTH,
        max_lines: int = MAX_ART_LINES,
    ) -> tuple[bool, str]:
        """Validate ASCII art meets terminal constraints.

        Returns (is_valid, reason).
        """
        if not art or not art.strip():
            return False, "Art is empty"

        lines = art.split("\n")
        if len(lines) > max_lines:
            return False, f"Too many lines: {len(lines)} > {max_lines}"

        non_whitespace = sum(1 for line in lines if line.strip())
        if non_whitespace < 3:
            return False, "Art is essentially empty (fewer than 3 non-blank lines)"

        for i, line in enumerate(lines):
            if len(line) > max_width:
                return False, f"Line {i + 1} too wide: {len(line)} > {max_width}"
            for ch in line:
                if ord(ch) > 126 or (ord(ch) < 32 and ch != "\n"):
                    return False, f"Line {i + 1} contains non-ASCII character: U+{ord(ch):04X}"

        return True, "OK"

    @staticmethod
    async def generate_boot_art(
        simulation_name: str,
        banner_url: str | None = None,
        **_kwargs: Any,
    ) -> str:
        """Generate terminal boot art: banner-to-ASCII scene + figlet title.

        Pipeline:
        1. If banner_url provided: fetch image, convert to ASCII art scene
        2. Generate pyfiglet title (always works, minimum quality guarantee)
        3. Combine: scene above title

        Always returns a valid string.
        """
        structlog.contextvars.bind_contextvars(
            simulation_name=simulation_name,
            phase="terminal_boot_art",
        )

        # Step 1: Generate reliable figlet title
        title = ForgeAsciiArtService.generate_figlet_title(simulation_name)

        # Step 2: Convert banner image to ASCII scene (if available)
        scene: str | None = None
        if banner_url:
            image = await ForgeAsciiArtService.fetch_banner_image(banner_url)
            if image:
                scene = ForgeAsciiArtService.image_to_ascii(
                    image,
                    width=MAX_SCENE_WIDTH,
                    height=MAX_SCENE_HEIGHT,
                    invert=True,
                )
                logger.info(
                    "Banner image converted to ASCII art (%dx%d)",
                    MAX_SCENE_WIDTH,
                    MAX_SCENE_HEIGHT,
                )

        # Step 3: Combine
        if scene:
            combined = f"{scene}\n\n{title}"
        else:
            combined = title

        # Final validation
        valid, reason = ForgeAsciiArtService.validate_ascii_art(combined)
        if not valid:
            logger.warning(
                "Combined boot art validation failed: %s — using title only",
                reason,
            )
            return title

        return combined
