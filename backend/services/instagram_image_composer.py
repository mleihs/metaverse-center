"""Instagram image compositing pipeline.

Converts platform images (AVIF) to Instagram-ready JPEG with themed overlays:
- Simulation color border
- Bureau classification header
- Bureau watermark (partially redacted seal text)
- AI disclosure metadata

Feed target: JPEG, 1080×1350 (4:5 portrait), quality 90, max 8MB.
Story target: JPEG, 1080×1920 (9:16 vertical), quality 90, max 8MB.
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
IG_HEIGHT_STORY = 1920     # 9:16 ratio — Stories
IG_HEIGHT_SQUARE = 1080    # 1:1 fallback
IG_JPEG_QUALITY = 90
IG_MAX_BYTES = 8 * 1024 * 1024  # 8MB

# Bureau visual identity
BUREAU_HEADER_HEIGHT = 80
BUREAU_FOOTER_HEIGHT = 40
BUREAU_WATERMARK_TEXT = "BUREAU OF IMPOSSIBLE GEOGRAPHY — [REDACTED]"
CLASSIFICATION_LEVELS = ("PUBLIC", "AMBER", "RESTRICTED")

# Story template layout constants
STORY_HEADER_Y = 280       # Main content starts well below top (safe area)
STORY_FOOTER_Y = 1720      # Footer above bottom safe area
STORY_LINE_HEIGHT = 36     # Line spacing for body text
STORY_SCANLINE_ALPHA = 18  # Scan line overlay opacity (~7%)


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

    # ── Story Templates (1080×1920 vertical) ────────────────────────────

    def compose_story_detection(
        self,
        *,
        archetype: str,
        signature: str,
        magnitude: float,
        accent_hex: str,
    ) -> bytes:
        """Story 1: SUBSTRATE ANOMALY DETECTED — military alert style.

        Full-bleed dark background with archetype color accent, scan lines,
        magnitude bar, and urgent classification text.
        """
        from PIL import Image, ImageDraw

        accent = self._hex_to_rgb(accent_hex)
        bg = (10, 12, 18)
        img = Image.new("RGB", (IG_WIDTH, IG_HEIGHT_STORY), bg)
        draw = ImageDraw.Draw(img)

        font_lg = _load_monospace_font(32)
        font_md = _load_monospace_font(22)
        font_sm = _load_monospace_font(16)

        self._draw_scan_lines(draw, IG_WIDTH, IG_HEIGHT_STORY, accent)

        # Top accent bar
        draw.rectangle([(0, 0), (IG_WIDTH, 6)], fill=accent)

        y = STORY_HEADER_Y
        draw.text((60, y), "SUBSTRATE ANOMALY DETECTED", fill=accent, font=font_lg)
        y += 50
        # Separator
        draw.text((60, y), "\u2501" * 28, fill=(*accent, 180), font=font_sm)
        y += 40

        draw.text((60, y), f"Signature: [{signature.upper().replace('_', ' ')}]", fill=(200, 200, 200), font=font_md)
        y += 44
        draw.text((60, y), f"Archetype: {archetype.upper()}", fill=(255, 255, 255), font=font_md)
        y += 60

        # Magnitude bar
        draw.text((60, y), "Magnitude:", fill=(160, 160, 160), font=font_sm)
        y += 28
        bar_x, bar_w, bar_h = 60, 600, 30
        draw.rectangle([(bar_x, y), (bar_x + bar_w, y + bar_h)], outline=(80, 80, 80), width=1)
        fill_w = int(bar_w * min(magnitude, 1.0))
        if fill_w > 0:
            draw.rectangle([(bar_x, y), (bar_x + fill_w, y + bar_h)], fill=accent)
        mag_text = f" {magnitude:.2f}"
        draw.text((bar_x + bar_w + 16, y + 2), mag_text, fill=(255, 255, 255), font=font_md)
        y += 80

        draw.text((60, y), "All operatives report to stations.", fill=(160, 160, 160), font=font_sm)

        # Bottom accent bar
        draw.rectangle([(0, IG_HEIGHT_STORY - 6), (IG_WIDTH, IG_HEIGHT_STORY)], fill=accent)

        # Bureau footer
        self._draw_story_footer(draw, accent)

        return self._image_to_jpeg(img)

    def compose_story_classification(
        self,
        *,
        archetype: str,
        source_category: str,
        affected_shard_count: int,
        highest_susceptibility_sim: str,
        highest_susceptibility_val: float,
        bureau_dispatch: str | None,
        accent_hex: str,
    ) -> bytes:
        """Story 2: BUREAU CLASSIFICATION — bureaucratic clinical document."""
        from PIL import Image, ImageDraw

        accent = self._hex_to_rgb(accent_hex)
        bg = (10, 12, 18)
        img = Image.new("RGB", (IG_WIDTH, IG_HEIGHT_STORY), bg)
        draw = ImageDraw.Draw(img)

        font_lg = _load_monospace_font(28)
        font_md = _load_monospace_font(20)
        font_sm = _load_monospace_font(16)
        font_body = _load_monospace_font(14)

        self._draw_scan_lines(draw, IG_WIDTH, IG_HEIGHT_STORY, accent)

        # Bureau seal stamp (faded)
        draw.text((60, 180), "BUREAU OF IMPOSSIBLE GEOGRAPHY", fill=(*accent, 60), font=font_sm)

        y = STORY_HEADER_Y
        draw.text((60, y), "BUREAU CLASSIFICATION", fill=accent, font=font_lg)
        y += 44
        draw.text((60, y), "\u2501" * 28, fill=(*accent, 180), font=font_sm)
        y += 44

        category_display = source_category.upper().replace("_", " ")
        draw.text((60, y), f"Source Category: [{category_display}]", fill=(200, 200, 200), font=font_md)
        y += 40
        draw.text((60, y), f"Affected Shards: [{affected_shard_count}]", fill=(200, 200, 200), font=font_md)
        y += 40
        susc_text = f"Highest Susceptibility: {highest_susceptibility_sim} ({highest_susceptibility_val:.1f}\u00d7)"
        draw.text((60, y), susc_text[:60], fill=(255, 255, 255), font=font_md)
        y += 60

        # Bureau dispatch text (if available)
        if bureau_dispatch:
            lines = bureau_dispatch[:400].split("\n")[:8]
            for line in lines:
                draw.text((60, y), line[:65], fill=(140, 140, 140), font=font_body)
                y += 24

        y += 40
        draw.text((60, y), "The Substrate trembles. Reality bleeds.", fill=accent, font=font_sm)

        draw.rectangle([(0, 0), (IG_WIDTH, 4)], fill=accent)
        draw.rectangle([(0, IG_HEIGHT_STORY - 4), (IG_WIDTH, IG_HEIGHT_STORY)], fill=accent)
        self._draw_story_footer(draw, accent)

        return self._image_to_jpeg(img)

    def compose_story_impact(
        self,
        *,
        simulation_name: str,
        effective_magnitude: float,
        events_spawned: list[str],
        narrative_closing: str | None,
        accent_hex: str,
        sim_color_hex: str | None = None,
    ) -> bytes:
        """Story 3+: SHARD IMPACT REPORT — per-simulation, poetic."""
        from PIL import Image, ImageDraw

        accent = self._hex_to_rgb(accent_hex)
        sim_color = self._hex_to_rgb(sim_color_hex) if sim_color_hex else accent
        bg = (10, 12, 18)
        img = Image.new("RGB", (IG_WIDTH, IG_HEIGHT_STORY), bg)
        draw = ImageDraw.Draw(img)

        font_lg = _load_monospace_font(28)
        font_md = _load_monospace_font(20)
        font_sm = _load_monospace_font(16)
        font_event = _load_monospace_font(15)

        self._draw_scan_lines(draw, IG_WIDTH, IG_HEIGHT_STORY, sim_color)

        # Simulation color accent bar
        draw.rectangle([(0, 0), (IG_WIDTH, 8)], fill=sim_color)

        y = STORY_HEADER_Y
        draw.text((60, y), f"SHARD IMPACT: [{simulation_name.upper()[:30]}]", fill=sim_color, font=font_lg)
        y += 44
        draw.text((60, y), "\u2501" * 28, fill=(*sim_color, 180), font=font_sm)
        y += 44

        # Magnitude bar
        draw.text((60, y), "Effective Magnitude:", fill=(160, 160, 160), font=font_sm)
        y += 28
        bar_x, bar_w, bar_h = 60, 500, 26
        draw.rectangle([(bar_x, y), (bar_x + bar_w, y + bar_h)], outline=(80, 80, 80), width=1)
        fill_w = int(bar_w * min(effective_magnitude, 1.0))
        if fill_w > 0:
            draw.rectangle([(bar_x, y), (bar_x + fill_w, y + bar_h)], fill=sim_color)
        draw.text((bar_x + bar_w + 16, y), f"{effective_magnitude:.2f}", fill=(255, 255, 255), font=font_md)
        y += 50

        draw.text((60, y), f"Events Spawned: {len(events_spawned)}", fill=(200, 200, 200), font=font_md)
        y += 20

        impact_lvl = min(10, max(1, round(effective_magnitude * 10)))
        draw.text((60, y + 24), f"Impact Level: {impact_lvl}/10", fill=(200, 200, 200), font=font_md)
        y += 70

        # Event titles
        for title in events_spawned[:5]:
            draw.text((80, y), f"\u25b8 {title[:55]}", fill=(220, 220, 220), font=font_event)
            y += 30

        # Poetic closing line
        if narrative_closing:
            y = max(y + 60, 1200)
            # Wrap if too long
            closing = narrative_closing[:120]
            draw.text((60, y), closing, fill=(*sim_color, 200), font=font_sm)

        draw.rectangle([(0, IG_HEIGHT_STORY - 8), (IG_WIDTH, IG_HEIGHT_STORY)], fill=sim_color)
        self._draw_story_footer(draw, sim_color)

        return self._image_to_jpeg(img)

    def compose_story_advisory(
        self,
        *,
        archetype: str,
        aligned_types: list[str],
        opposed_types: list[str],
        zone_name: str | None,
        accent_hex: str,
    ) -> bytes:
        """Story 4: OPERATIVE ADVISORY — tactical briefing, active epochs only."""
        from PIL import Image, ImageDraw

        accent = self._hex_to_rgb(accent_hex)
        bg = (10, 12, 18)
        img = Image.new("RGB", (IG_WIDTH, IG_HEIGHT_STORY), bg)
        draw = ImageDraw.Draw(img)

        font_lg = _load_monospace_font(28)
        font_md = _load_monospace_font(20)
        font_sm = _load_monospace_font(16)

        self._draw_scan_lines(draw, IG_WIDTH, IG_HEIGHT_STORY, accent)

        draw.rectangle([(0, 0), (IG_WIDTH, 6)], fill=accent)

        y = STORY_HEADER_Y
        draw.text((60, y), "OPERATIVE ADVISORY", fill=accent, font=font_lg)
        y += 44
        draw.text((60, y), "\u2501" * 28, fill=(*accent, 180), font=font_sm)
        y += 50

        draw.text((60, y), f"Active Resonance: [{archetype.upper()}]", fill=(255, 255, 255), font=font_md)
        y += 60

        if aligned_types:
            aligned_str = ", ".join(aligned_types)
            draw.text((60, y), f"ALIGNED: {aligned_str} (+3%)", fill=(100, 220, 100), font=font_md)
            y += 40
        if opposed_types:
            opposed_str = ", ".join(opposed_types)
            draw.text((60, y), f"OPPOSED: {opposed_str} (-2%)", fill=(220, 100, 100), font=font_md)
            y += 40

        y += 40
        if zone_name:
            draw.text((60, y), f"Zone pressure elevated in {zone_name}.", fill=(200, 200, 200), font=font_sm)
            y += 30
        draw.text((60, y), "Defenders gain tactical advantage.", fill=(200, 200, 200), font=font_sm)
        y += 50
        draw.text((60, y), "Deploy accordingly.", fill=accent, font=font_md)

        draw.rectangle([(0, IG_HEIGHT_STORY - 6), (IG_WIDTH, IG_HEIGHT_STORY)], fill=accent)
        self._draw_story_footer(draw, accent)

        return self._image_to_jpeg(img)

    def compose_story_subsiding(
        self,
        *,
        archetype: str,
        events_spawned_total: int,
        shards_affected: int,
        accent_hex: str,
    ) -> bytes:
        """Story 5: SUBSTRATE STABILIZING — elegiac resolution."""
        from PIL import Image, ImageDraw

        accent = self._hex_to_rgb(accent_hex)
        bg = (10, 12, 18)
        img = Image.new("RGB", (IG_WIDTH, IG_HEIGHT_STORY), bg)
        draw = ImageDraw.Draw(img)

        font_lg = _load_monospace_font(28)
        font_md = _load_monospace_font(20)
        font_sm = _load_monospace_font(16)

        # Lighter scan lines — calming
        self._draw_scan_lines(draw, IG_WIDTH, IG_HEIGHT_STORY, accent, alpha=10)

        draw.rectangle([(0, 0), (IG_WIDTH, 4)], fill=(*accent, 120))

        y = STORY_HEADER_Y + 60
        draw.text((60, y), "SUBSTRATE STABILIZING", fill=accent, font=font_lg)
        y += 44
        draw.text((60, y), "\u2501" * 28, fill=(*accent, 120), font=font_sm)
        y += 60

        draw.text((60, y), f"[{archetype.upper()}] resonance subsiding.", fill=(200, 200, 200), font=font_md)
        y += 40
        draw.text((60, y), "Residual effects at 50% magnitude.", fill=(160, 160, 160), font=font_sm)
        y += 60

        draw.text(
            (60, y),
            f"{events_spawned_total} events spawned across {shards_affected} shards.",
            fill=(200, 200, 200),
            font=font_md,
        )
        y += 100

        draw.text((60, y), "The trembling fades.", fill=accent, font=font_md)
        y += 36
        draw.text((60, y), "The scars remain.", fill=(*accent, 160), font=font_md)

        draw.rectangle([(0, IG_HEIGHT_STORY - 4), (IG_WIDTH, IG_HEIGHT_STORY)], fill=(*accent, 120))
        self._draw_story_footer(draw, accent)

        return self._image_to_jpeg(img)

    # ── Story Helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _draw_scan_lines(
        draw,
        width: int,
        height: int,
        accent: tuple[int, int, int],
        *,
        spacing: int = 4,
        alpha: int = STORY_SCANLINE_ALPHA,
    ) -> None:
        """Draw subtle horizontal scan lines across the image."""
        color = (*accent, alpha)
        for y in range(0, height, spacing):
            draw.line([(0, y), (width, y)], fill=color, width=1)

    @staticmethod
    def _draw_story_footer(
        draw,
        accent: tuple[int, int, int],
    ) -> None:
        """Draw Bureau watermark footer for Stories."""
        font_wm = _load_monospace_font(10)
        draw.text(
            (60, STORY_FOOTER_Y),
            BUREAU_WATERMARK_TEXT,
            fill=(80, 80, 80),
            font=font_wm,
        )
        draw.text(
            (60, STORY_FOOTER_Y + 18),
            "AI-generated content",
            fill=(60, 60, 60),
            font=font_wm,
        )

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
