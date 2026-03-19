"""Instagram image compositing pipeline.

Converts platform images (AVIF) to Instagram-ready JPEG with themed overlays:
- Simulation color border
- Bureau classification header
- Bureau watermark (partially redacted seal text)
- AI disclosure metadata

Target format: JPEG, 1080×1350 (4:5 portrait), quality 90, max 8MB.
"""

from __future__ import annotations

import io
import logging
from typing import TYPE_CHECKING
from uuid import uuid4

import httpx
import sentry_sdk

from supabase import Client

if TYPE_CHECKING:
    from PIL.Image import Image as PILImage

logger = logging.getLogger(__name__)

# Instagram image specs
IG_WIDTH = 1080
IG_HEIGHT_PORTRAIT = 1350  # 4:5 ratio — highest engagement
IG_HEIGHT_SQUARE = 1080    # 1:1 fallback
IG_JPEG_QUALITY = 90
IG_MAX_BYTES = 8 * 1024 * 1024  # 8MB

# Bureau visual identity
BUREAU_HEADER_HEIGHT = 80
BUREAU_FOOTER_HEIGHT = 40
BUREAU_WATERMARK_TEXT = "BUREAU OF IMPOSSIBLE GEOGRAPHY — [REDACTED]"
CLASSIFICATION_LEVELS = ("PUBLIC", "AMBER", "RESTRICTED")


def _load_monospace_font(size: int):
    """Load a monospace font with cross-platform fallback.

    Tries common Linux paths first (deployment target), then macOS,
    then falls back to Pillow's built-in default font.
    """
    from PIL import ImageFont

    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",      # Debian/Ubuntu
        "/usr/share/fonts/dejavu-sans-mono-fonts/DejaVuSansMono.ttf",  # Fedora/RHEL
        "/System/Library/Fonts/Menlo.ttc",                            # macOS
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


class InstagramImageComposer:
    """Composes Instagram-ready JPEG images from platform content."""

    def __init__(self, supabase: Client):
        self._supabase = supabase

    async def compose_agent_dossier(
        self,
        portrait_url: str,
        agent_name: str,
        simulation_name: str,
        *,
        color_primary: str = "#e2e8f0",
        color_background: str = "#0f172a",
        classification: str = "PUBLIC",
        cipher_hint: str | None = None,
    ) -> bytes:
        """Compose an agent dossier image for Instagram.

        Downloads the portrait, applies Bureau styling:
        - Classification header bar
        - Simulation-colored border
        - Bureau watermark
        - Optional steganographic cipher hint (rotated marginal text)
        - JPEG conversion at 1080×1350
        """
        logger.info("Composing agent dossier image", extra={
            "source_url": portrait_url,
            "simulation_name": simulation_name,
            "stage": "agent_dossier",
        })
        raw_bytes = await self._download_image(portrait_url)
        return self._compose_with_overlay(
            raw_bytes,
            title=f"PERSONNEL FILE — {agent_name}",
            subtitle=f"SHARD: {simulation_name}",
            color_primary=color_primary,
            color_background=color_background,
            classification=classification,
            cipher_hint=cipher_hint,
        )

    async def compose_building_surveillance(
        self,
        image_url: str,
        building_name: str,
        simulation_name: str,
        *,
        color_primary: str = "#e2e8f0",
        color_background: str = "#0f172a",
        classification: str = "PUBLIC",
        cipher_hint: str | None = None,
    ) -> bytes:
        """Compose a building surveillance image for Instagram."""
        logger.info("Composing building surveillance image", extra={
            "source_url": image_url,
            "simulation_name": simulation_name,
            "stage": "building_surveillance",
        })
        raw_bytes = await self._download_image(image_url)
        return self._compose_with_overlay(
            raw_bytes,
            title=f"SHARD SURVEILLANCE — {building_name}",
            subtitle=f"LOCATION: {simulation_name}",
            color_primary=color_primary,
            color_background=color_background,
            classification=classification,
            cipher_hint=cipher_hint,
        )

    async def compose_bureau_dispatch(
        self,
        source_image_url: str | None,
        dispatch_number: int,
        simulation_name: str,
        *,
        color_primary: str = "#e2e8f0",
        color_background: str = "#0f172a",
        classification: str = "AMBER",
        cipher_hint: str | None = None,
    ) -> bytes:
        """Compose a Bureau dispatch image.

        If no source image, generates a solid background with Bureau styling.
        """
        logger.info("Composing bureau dispatch image", extra={
            "source_url": source_image_url,
            "simulation_name": simulation_name,
            "dispatch_number": dispatch_number,
            "stage": "bureau_dispatch",
        })
        if source_image_url:
            raw_bytes = await self._download_image(source_image_url)
        else:
            raw_bytes = self._generate_solid_background(color_background)

        return self._compose_with_overlay(
            raw_bytes,
            title=f"DISPATCH [{dispatch_number:04d}]",
            subtitle=f"RE: {simulation_name}",
            color_primary=color_primary,
            color_background=color_background,
            classification=classification,
            cipher_hint=cipher_hint,
        )

    async def upload_to_staging(
        self,
        jpeg_bytes: bytes,
        simulation_id: str,
        post_id: str | None = None,
    ) -> str:
        """Upload composed JPEG to Supabase staging bucket. Returns public URL."""
        filename = f"instagram/{simulation_id}/{post_id or uuid4()}.jpg"
        self._supabase.storage.from_("simulation.assets").upload(
            filename,
            jpeg_bytes,
            {"content-type": "image/jpeg", "upsert": "true"},
        )
        url = self._supabase.storage.from_("simulation.assets").get_public_url(filename)
        logger.info("Uploaded composed image to staging", extra={
            "simulation_id": simulation_id,
            "output_size": len(jpeg_bytes),
            "stage": "upload",
        })
        return url

    # ── Internal Compositing ────────────────────────────────────────────

    def _compose_with_overlay(
        self,
        image_bytes: bytes,
        title: str,
        subtitle: str,
        color_primary: str,
        color_background: str,
        classification: str,
        cipher_hint: str | None = None,
    ) -> bytes:
        """Apply Bureau overlay to an image and convert to Instagram JPEG.

        If cipher_hint is provided, renders it as low-opacity rotated text
        along the right margin (steganographic "marginal notation" aesthetic).
        """
        try:
            from PIL import Image, ImageDraw
        except ImportError:
            logger.warning("Pillow not installed — returning raw JPEG conversion")
            return self._convert_to_jpeg(image_bytes)

        try:
            img = Image.open(io.BytesIO(image_bytes))

            # Convert to RGB if necessary
            if img.mode not in ("RGB",):
                img = img.convert("RGB")

            # Resize to Instagram portrait (1080×1350) maintaining aspect ratio
            img = self._resize_for_instagram(img)

            draw = ImageDraw.Draw(img)
            width, height = img.size

            # Parse colors
            primary_rgb = self._hex_to_rgb(color_primary)
            bg_rgb = self._hex_to_rgb(color_background)

            # Classification header bar
            header_y = 0
            draw.rectangle(
                [(0, header_y), (width, header_y + BUREAU_HEADER_HEIGHT)],
                fill=(*bg_rgb, 220),
            )

            # Load fonts (cross-platform)
            font_title = _load_monospace_font(18)
            font_subtitle = _load_monospace_font(14)
            font_watermark = _load_monospace_font(10)

            # Classification stamp
            classification_text = f"CLASSIFICATION: {classification}"
            draw.text(
                (20, header_y + 10),
                classification_text,
                fill=primary_rgb,
                font=font_title,
            )

            # Title
            draw.text(
                (20, header_y + 35),
                title[:60],
                fill=(255, 255, 255),
                font=font_title,
            )

            # Subtitle
            draw.text(
                (20, header_y + 58),
                subtitle[:80],
                fill=(*primary_rgb,),
                font=font_subtitle,
            )

            # Border (simulation primary color)
            border_width = 3
            draw.rectangle(
                [(0, 0), (width - 1, height - 1)],
                outline=primary_rgb,
                width=border_width,
            )

            # Bureau watermark footer
            footer_y = height - BUREAU_FOOTER_HEIGHT
            draw.rectangle(
                [(0, footer_y), (width, height)],
                fill=(*bg_rgb, 200),
            )
            draw.text(
                (20, footer_y + 12),
                BUREAU_WATERMARK_TEXT,
                fill=(120, 120, 120),
                font=font_watermark,
            )

            # AI disclosure (right-aligned in footer)
            disclosure = "AI-generated content"
            draw.text(
                (width - 200, footer_y + 12),
                disclosure,
                fill=(100, 100, 100),
                font=font_watermark,
            )

            # Steganographic cipher hint — rotated 90° marginal notation
            if cipher_hint:
                try:
                    self._render_cipher_margin(
                        img, cipher_hint, primary_rgb, width, height,
                    )
                except Exception as cipher_exc:
                    # Non-fatal — post continues without visual cipher
                    logger.warning(
                        "Steganographic cipher rendering failed",
                        exc_info=True,
                        extra={
                            "cipher_length": len(cipher_hint),
                            "stage": "cipher_margin_render",
                        },
                    )
                    with sentry_sdk.push_scope() as scope:
                        scope.set_tag("instagram_phase", "cipher_rendering")
                        sentry_sdk.capture_exception(cipher_exc)

            result = self._image_to_jpeg(img)
            logger.debug("Image composition complete", extra={
                "output_size": len(result),
                "output_dimensions": f"{width}x{height}",
                "has_cipher_hint": cipher_hint is not None,
                "stage": "compose_complete",
            })
            return result

        except Exception as exc:
            logger.exception("Image composition failed", extra={
                "stage": "compose_overlay",
                "title": title[:60],
            })
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("instagram_phase", "image_composition")
                scope.set_context("instagram", {
                    "title": title[:60],
                    "classification": classification,
                })
                sentry_sdk.capture_exception(exc)
            raise

    def _render_cipher_margin(
        self,
        img: PILImage,
        cipher_hint: str,
        primary_rgb: tuple[int, int, int],
        width: int,
        height: int,
    ) -> None:
        """Render cipher hint as rotated marginal notation along the right edge.

        Aesthetic: classified document with marginal annotations — rotated 90°,
        ~15% opacity, monospace font between header and footer bars.
        """
        from PIL import Image, ImageDraw

        font_cipher = _load_monospace_font(11)

        # Render text onto a temporary RGBA image for rotation
        # Available vertical space: between header bottom and footer top
        margin_height = height - BUREAU_HEADER_HEIGHT - BUREAU_FOOTER_HEIGHT - 8
        # Create a tall-enough canvas for the text (will be rotated)
        temp = Image.new("RGBA", (margin_height, 24), (0, 0, 0, 0))
        temp_draw = ImageDraw.Draw(temp)

        # ~15% opacity (alpha ≈ 38/255)
        cipher_color = (*primary_rgb, 38)
        temp_draw.text((4, 2), cipher_hint, fill=cipher_color, font=font_cipher)

        # Rotate 90° counter-clockwise (text reads bottom-to-top)
        rotated = temp.rotate(90, expand=True)

        # Paste along right edge, vertically between header and footer
        paste_x = width - 28
        paste_y = BUREAU_HEADER_HEIGHT + 4
        img.paste(rotated, (paste_x, paste_y), rotated)

        logger.debug("Rendered steganographic cipher margin", extra={
            "cipher_length": len(cipher_hint),
            "position": f"({paste_x}, {paste_y})",
            "opacity": "15%",
            "font_size": 11,
            "stage": "cipher_margin_render",
        })

    def _resize_for_instagram(self, img: PILImage) -> PILImage:
        """Resize image to fit Instagram 4:5 portrait format (1080×1350).

        Crops to fill the target aspect ratio, then resizes.
        """
        from PIL import Image

        target_w, target_h = IG_WIDTH, IG_HEIGHT_PORTRAIT
        target_ratio = target_w / target_h
        img_ratio = img.width / img.height

        if img_ratio > target_ratio:
            # Image is wider — crop sides
            new_w = int(img.height * target_ratio)
            left = (img.width - new_w) // 2
            img = img.crop((left, 0, left + new_w, img.height))
        elif img_ratio < target_ratio:
            # Image is taller — crop top/bottom
            new_h = int(img.width / target_ratio)
            top = (img.height - new_h) // 2
            img = img.crop((0, top, img.width, top + new_h))

        return img.resize((target_w, target_h), Image.LANCZOS)

    @staticmethod
    def _convert_to_jpeg(image_bytes: bytes) -> bytes:
        """Convert any image format to JPEG."""
        try:
            from PIL import Image
        except ImportError:
            return image_bytes

        img = Image.open(io.BytesIO(image_bytes))
        if img.mode not in ("RGB",):
            img = img.convert("RGB")

        output = io.BytesIO()
        img.save(output, format="JPEG", quality=IG_JPEG_QUALITY, optimize=True)
        result = output.getvalue()

        # If over 8MB, reduce quality
        if len(result) > IG_MAX_BYTES:
            output = io.BytesIO()
            img.save(output, format="JPEG", quality=75, optimize=True)
            result = output.getvalue()

        return result

    @staticmethod
    def _image_to_jpeg(img: PILImage) -> bytes:
        """Convert PIL Image to JPEG bytes."""
        output = io.BytesIO()
        img.save(output, format="JPEG", quality=IG_JPEG_QUALITY, optimize=True)
        result = output.getvalue()

        # If over 8MB, reduce quality
        if len(result) > IG_MAX_BYTES:
            output = io.BytesIO()
            img.save(output, format="JPEG", quality=75, optimize=True)
            result = output.getvalue()

        return result

    @staticmethod
    def _generate_solid_background(hex_color: str) -> bytes:
        """Generate a solid-color background image for text-only dispatches."""
        try:
            from PIL import Image
        except ImportError as exc:
            raise ImportError("Pillow is required for image composition") from exc

        rgb = InstagramImageComposer._hex_to_rgb(hex_color)
        img = Image.new("RGB", (IG_WIDTH, IG_HEIGHT_PORTRAIT), rgb)
        output = io.BytesIO()
        img.save(output, format="PNG")
        return output.getvalue()

    @staticmethod
    def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
        """Convert hex color string to RGB tuple."""
        hex_color = hex_color.lstrip("#")
        if len(hex_color) != 6:
            return (226, 232, 240)  # default slate-200
        return (
            int(hex_color[0:2], 16),
            int(hex_color[2:4], 16),
            int(hex_color[4:6], 16),
        )

    @staticmethod
    async def _download_image(url: str) -> bytes:
        """Download an image from a URL."""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.content
        except Exception as exc:
            logger.error("Image download failed", extra={
                "source_url": url,
                "stage": "download",
            })
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("instagram_phase", "image_download")
                scope.set_context("instagram", {"source_url": url})
                sentry_sdk.capture_exception(exc)
            raise
