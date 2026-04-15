"""Instagram image compositing pipeline.

Converts platform images (AVIF) to Instagram-ready JPEG with themed overlays:
- Simulation color border
- Bureau classification header
- Bureau watermark (partially redacted seal text)
- AI disclosure metadata

Feed target: JPEG, 1080×1350 (4:5 portrait), quality 90, max 8MB.
Story target: JPEG, 1080×1920 (9:16 vertical), quality 90, max 8MB.

Decomposed into three modules:
- instagram_image_helpers: pure Pillow primitives and constants
- instagram_story_composer: Story template rendering (StoryComposer)
- instagram_image_service: orchestration + feed overlay (this file)
"""

from __future__ import annotations

import io
import logging
from uuid import uuid4

import httpx
import sentry_sdk

from backend.services.instagram_image_helpers import (
    BADGE_PAD_X,
    BADGE_PAD_Y,
    BUREAU_FOOTER_HEIGHT,
    BUREAU_HEADER_HEIGHT,
    BUREAU_WATERMARK_TEXT,
    FONT_CAPTION,
    FONT_FEED_BADGE,
    FONT_FEED_FOOTER,
    FONT_FEED_SEAL,
    FONT_FEED_TITLE,
    IG_HEIGHT_PORTRAIT,
    IG_HEIGHT_STORY,  # noqa: F401 — re-exported for backward compatibility
    IG_JPEG_QUALITY,
    IG_MAX_BYTES,
    IG_WIDTH,
    LINE_HEIGHT_CAPTION,
    MARGIN_PAGE,
    SPACING_XS,
    add_bokeh_dots,
    add_noise_grain,
    bleach_bypass,
    chromatic_aberration,
    create_gradient,
    create_vignette,
    draw_archetype_symbol,
    draw_corner_brackets,
    draw_magnitude_arc,
    draw_scan_lines_rgba,
    generate_solid_background,
    get_text_measure_draw,
    hex_to_rgb,
    image_to_jpeg,
    load_bold_font,
    load_italic_font,
    load_monospace_font,
    text_with_glow,
    wrap_text,
)
from backend.services.instagram_story_composer import StoryComposer
from supabase import AsyncClient as Client

# Backward-compatible re-exports — tests and scripts import these from
# instagram_image_service; the canonical definitions live in
# instagram_image_helpers now.
_load_monospace_font = load_monospace_font
_load_bold_font = load_bold_font
_load_italic_font = load_italic_font

logger = logging.getLogger(__name__)


class InstagramImageService:
    """Composes Instagram-ready JPEG images from platform content.

    Feed overlays are handled directly. Story templates are delegated
    to StoryComposer (composition pattern preserving the public API).
    """

    # Backward-compatible static method aliases — existing tests call these
    # as InstagramImageService._hex_to_rgb(...) etc.  Canonical definitions
    # now live in instagram_image_helpers as module-level functions.
    _hex_to_rgb = staticmethod(hex_to_rgb)
    _image_to_jpeg = staticmethod(image_to_jpeg)
    _generate_solid_background = staticmethod(generate_solid_background)
    _create_gradient = staticmethod(create_gradient)
    _create_vignette = staticmethod(create_vignette)
    _add_noise_grain = staticmethod(add_noise_grain)
    _add_bokeh_dots = staticmethod(add_bokeh_dots)
    _draw_archetype_symbol = staticmethod(draw_archetype_symbol)
    _draw_magnitude_arc = staticmethod(draw_magnitude_arc)
    _draw_corner_brackets = staticmethod(draw_corner_brackets)
    _wrap_text = staticmethod(wrap_text)
    _get_text_measure_draw = staticmethod(get_text_measure_draw)

    def __init__(self, supabase: Client):
        self._supabase = supabase
        self._story = StoryComposer()

    # ── Feed Overlay Methods ──────────────────────────────────────────────

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
        logger.info(
            "Composing agent dossier image",
            extra={
                "source_url": portrait_url,
                "simulation_name": simulation_name,
                "stage": "agent_dossier",
            },
        )
        raw_bytes = await self._download_image(portrait_url)
        return self._compose_with_overlay(
            raw_bytes,
            title=f"PERSONNEL FILE — {agent_name}",
            subtitle=f"SHARD: {simulation_name}",
            color_primary=color_primary,
            color_background=color_background,
            classification=classification,
            cipher_hint=cipher_hint,
            crop_gravity="smart",
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
        logger.info(
            "Composing building surveillance image",
            extra={
                "source_url": image_url,
                "simulation_name": simulation_name,
                "stage": "building_surveillance",
            },
        )
        raw_bytes = await self._download_image(image_url)
        return self._compose_with_overlay(
            raw_bytes,
            title=f"SHARD SURVEILLANCE — {building_name}",
            subtitle=f"LOCATION: {simulation_name}",
            color_primary=color_primary,
            color_background=color_background,
            classification=classification,
            cipher_hint=cipher_hint,
            crop_gravity="smart",
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
        logger.info(
            "Composing bureau dispatch image",
            extra={
                "source_url": source_image_url,
                "simulation_name": simulation_name,
                "dispatch_number": dispatch_number,
                "stage": "bureau_dispatch",
            },
        )
        if source_image_url:
            raw_bytes = await self._download_image(source_image_url)
        else:
            raw_bytes = generate_solid_background(color_background)

        return self._compose_with_overlay(
            raw_bytes,
            title=f"DISPATCH [{dispatch_number:04d}]",
            subtitle=f"RE: {simulation_name}",
            color_primary=color_primary,
            color_background=color_background,
            crop_gravity="smart",
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
        await self._supabase.storage.from_("simulation.assets").upload(
            filename,
            jpeg_bytes,
            {"content-type": "image/jpeg", "upsert": "true"},
        )
        url = await self._supabase.storage.from_("simulation.assets").get_public_url(filename)
        logger.info(
            "Uploaded composed image to staging",
            extra={
                "simulation_id": simulation_id,
                "output_size": len(jpeg_bytes),
                "stage": "upload",
            },
        )
        return url

    # ── Story Template Delegation ─────────────────────────────────────────

    def compose_story_detection(self, **kwargs) -> bytes:
        """Story 1: SUBSTRATE ANOMALY DETECTED. Delegates to StoryComposer."""
        return self._story.compose_story_detection(**kwargs)

    def compose_story_classification(self, **kwargs) -> bytes:
        """Story 2: BUREAU CLASSIFICATION. Delegates to StoryComposer."""
        return self._story.compose_story_classification(**kwargs)

    def compose_story_impact(self, **kwargs) -> bytes:
        """Story 3+: SHARD IMPACT. Delegates to StoryComposer."""
        return self._story.compose_story_impact(**kwargs)

    def compose_story_advisory(self, **kwargs) -> bytes:
        """Story 4: OPERATIVE ADVISORY. Delegates to StoryComposer."""
        return self._story.compose_story_advisory(**kwargs)

    def compose_story_subsiding(self, **kwargs) -> bytes:
        """Story 5: SUBSTRATE STABILIZING. Delegates to StoryComposer."""
        return self._story.compose_story_subsiding(**kwargs)

    # ── Internal Compositing ────────────────────────────────────────────

    @staticmethod
    def _add_decorative_grid_if_solid(
        img,
        draw,
        primary_rgb: tuple[int, int, int],
        width: int,
        height: int,
    ) -> None:
        """Add decorative grid pattern + Bureau seal watermark on solid backgrounds.

        Detects near-solid images by sampling pixel variance and adds subtle
        grid lines and centered seal text to fill the otherwise empty space.
        """
        import numpy as np

        arr = np.array(img)
        if arr.std() > 20:
            return  # real image — skip decoration

        grid_color = (*primary_rgb, 25) if img.mode == "RGBA" else tuple(min(c + 15, 255) for c in primary_rgb)

        # Vertical + horizontal grid lines
        spacing = 60
        for x in range(spacing, width, spacing):
            draw.line([(x, BUREAU_HEADER_HEIGHT), (x, height - BUREAU_FOOTER_HEIGHT)], fill=grid_color, width=1)
        for y_pos in range(BUREAU_HEADER_HEIGHT + spacing, height - BUREAU_FOOTER_HEIGHT, spacing):
            draw.line([(0, y_pos), (width, y_pos)], fill=grid_color, width=1)

        # Centered Bureau seal watermark
        seal_font = load_bold_font(FONT_FEED_SEAL)
        seal_lines = ["BUREAU OF", "IMPOSSIBLE", "GEOGRAPHY"]
        seal_y = height // 2 - 40
        for sl in seal_lines:
            sbbox = draw.textbbox((0, 0), sl, font=seal_font)
            sw = sbbox[2] - sbbox[0]
            seal_color = (*primary_rgb, 35) if img.mode == "RGBA" else tuple(min(c + 20, 255) for c in primary_rgb)
            draw.text((width // 2 - sw // 2, seal_y), sl, fill=seal_color, font=seal_font)
            seal_y += FONT_FEED_SEAL + SPACING_XS

    def _compose_with_overlay(
        self,
        image_bytes: bytes,
        title: str,
        subtitle: str,
        color_primary: str,
        color_background: str,
        classification: str,
        cipher_hint: str | None = None,
        crop_gravity: str = "center",
    ) -> bytes:
        """Apply Bureau overlay to an image and convert to Instagram JPEG.

        Visual pipeline (matching story template quality):
        1. RGBA conversion for alpha compositing
        2. Decorative grid on solid backgrounds
        3. Atmospheric effects (vignette, grain, scan lines)
        4. Classification badge + title with text glow
        5. Bottom panel with watermark + AI disclosure
        6. Accent border bars (top/bottom/sides)
        7. Optional steganographic cipher hint (rotated marginal text)
        """
        try:
            from PIL import Image, ImageDraw
        except ImportError:
            logger.warning("Pillow not installed — returning raw JPEG conversion")
            return self._convert_to_jpeg(image_bytes)

        try:
            img = Image.open(io.BytesIO(image_bytes))

            # Resize to Instagram portrait (1080x1350) before RGBA conversion
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")
            img = self._resize_for_instagram(img, gravity=crop_gravity)

            # Convert to RGBA for alpha compositing (like story templates)
            img = img.convert("RGBA")

            draw = ImageDraw.Draw(img)
            width, height = img.size

            # Parse colors
            primary_rgb = hex_to_rgb(color_primary)
            bg_rgb = hex_to_rgb(color_background)

            # ── 1. Decorative grid on solid backgrounds ──────────────
            # Must run BEFORE atmospheric effects — grid detection uses
            # pixel variance which would be pushed above threshold by
            # grain/vignette.
            self._add_decorative_grid_if_solid(img, draw, primary_rgb, width, height)

            # ── 2. Atmospheric effects ───────────────────────────────
            # Subtle vignette (lighter than stories — feed shows content)
            vignette = create_vignette(width, height, intensity=0.3)
            img.alpha_composite(vignette)

            # Light film grain
            img = add_noise_grain(img, sigma=10, opacity=0.04)

            # Very subtle scan lines
            draw_scan_lines_rgba(img, primary_rgb, spacing=6, alpha=10)

            # ── 2b. Film processing ──────────────────────────────────
            # Bleach bypass: desaturated + high-contrast + cold shadows
            # (matches the FLUX prompt "bleach bypass color grading")
            img = bleach_bypass(img, desaturation=0.65, contrast_boost=1.25, highlight_rolloff=0.90)

            # Chromatic aberration: subtle RGB channel shift (surveillance camera)
            img = chromatic_aberration(img, offset_r=(2, 1), offset_b=(-2, -1))

            # Refresh draw reference after film processing
            draw = ImageDraw.Draw(img)

            # ── 3. Header panel — classification badge + title ───────
            font_badge = load_monospace_font(FONT_FEED_BADGE)
            font_title = load_bold_font(FONT_FEED_TITLE)
            font_subtitle = load_monospace_font(FONT_CAPTION)
            font_footer = load_monospace_font(FONT_FEED_FOOTER)

            # Measure title lines for dynamic header height
            title_lines = wrap_text(title, font_title, width - 80)[:3]
            title_line_height = 44
            # Header layout: 16 top + badge 36 + 12 gap + title lines + 12 gap + subtitle 30 + 16 bottom
            header_content_height = 16 + 36 + 12 + len(title_lines) * title_line_height + 12 + 30 + 16
            header_height = max(BUREAU_HEADER_HEIGHT, min(header_content_height, 280))

            # Semi-transparent header background
            draw.rectangle(
                [(0, 0), (width, header_height)],
                fill=(*bg_rgb, 220),
            )

            # Classification badge — rounded rectangle with vertically centered text
            badge_label = classification
            badge_bbox = draw.textbbox((0, 0), badge_label, font=font_badge)
            text_w = badge_bbox[2] - badge_bbox[0]
            text_h = badge_bbox[3] - badge_bbox[1]
            ascent_offset = badge_bbox[1]  # font metrics offset above origin
            pad_x, pad_y = BADGE_PAD_X, BADGE_PAD_Y
            badge_w = text_w + pad_x * 2
            badge_h = text_h + pad_y * 2
            badge_x, badge_y = 24, 22  # 16px gap from accent bar (y=6) to badge top
            draw.rounded_rectangle(
                [(badge_x, badge_y), (badge_x + badge_w, badge_y + badge_h)],
                radius=6,
                fill=(*primary_rgb, 200),
            )
            # Text centered inside badge (compensate for font ascent metrics)
            draw.text(
                (badge_x + pad_x, badge_y + pad_y - ascent_offset),
                badge_label,
                fill=(*bg_rgb, 255),
                font=font_badge,
            )

            # Title with glow effect (accent color glow)
            title_y = badge_y + badge_h + 12
            glow_color = (*primary_rgb, 80)
            for tline in title_lines:
                text_with_glow(
                    img,
                    (24, title_y),
                    tline,
                    font=font_title,
                    fill=(255, 255, 255, 255),
                    glow_color=glow_color,
                    glow_radius=6,
                )
                title_y += title_line_height

            # Subtitle in accent color
            subtitle_lines = wrap_text(subtitle, font_subtitle, width - 80)[:2]
            subtitle_y = title_y + 8
            # Refresh draw after text_with_glow compositing
            draw = ImageDraw.Draw(img)
            for sline in subtitle_lines:
                draw.text(
                    (24, subtitle_y),
                    sline,
                    fill=(*primary_rgb, 255),
                    font=font_subtitle,
                )
                subtitle_y += LINE_HEIGHT_CAPTION

            # ── 4. Bottom panel — watermark + AI disclosure ──────────
            footer_height = 60
            footer_y = height - footer_height
            draw.rectangle(
                [(0, footer_y), (width, height)],
                fill=(*bg_rgb, 220),
            )

            # Accent-colored border line at panel top edge
            draw.rectangle(
                [(0, footer_y), (width, footer_y + 2)],
                fill=(*primary_rgb, 180),
            )

            # Watermark left-aligned
            draw.text(
                (20, footer_y + 20),
                BUREAU_WATERMARK_TEXT,
                fill=(120, 120, 120, 255),
                font=font_footer,
            )

            # AI disclosure right-aligned
            disclosure = "AI-generated content"
            disc_bbox = draw.textbbox((0, 0), disclosure, font=font_footer)
            disc_w = disc_bbox[2] - disc_bbox[0]
            draw.text(
                (width - disc_w - MARGIN_PAGE, footer_y + 20),
                disclosure,
                fill=(100, 100, 100, 255),
                font=font_footer,
            )

            # ── 5. Accent border bars ────────────────────────────────
            # Top accent bar (6px solid)
            draw.rectangle([(0, 0), (width, 6)], fill=(*primary_rgb, 255))
            # Bottom accent bar (6px, above footer)
            draw.rectangle([(0, height - 6), (width, height)], fill=(*primary_rgb, 255))
            # Side borders (2px accent on left and right edges)
            draw.rectangle([(0, 0), (2, height)], fill=(*primary_rgb, 200))
            draw.rectangle([(width - 2, 0), (width, height)], fill=(*primary_rgb, 200))

            # ── 6. Steganographic cipher hint ────────────────────────
            if cipher_hint:
                try:
                    self._render_cipher_margin(
                        img,
                        cipher_hint,
                        primary_rgb,
                        width,
                        height,
                    )
                except (OSError, ValueError, TypeError) as cipher_exc:
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

            result = image_to_jpeg(img)
            logger.debug(
                "Image composition complete",
                extra={
                    "output_size": len(result),
                    "output_dimensions": f"{width}x{height}",
                    "has_cipher_hint": cipher_hint is not None,
                    "stage": "compose_complete",
                },
            )
            return result

        except (OSError, ValueError, TypeError, KeyError) as exc:
            logger.exception(
                "Image composition failed",
                extra={
                    "stage": "compose_overlay",
                    "title": title[:60],
                },
            )
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("instagram_phase", "image_composition")
                scope.set_context(
                    "instagram",
                    {
                        "title": title[:60],
                        "classification": classification,
                    },
                )
                sentry_sdk.capture_exception(exc)
            raise

    def _render_cipher_margin(
        self,
        img,
        cipher_hint: str,
        primary_rgb: tuple[int, int, int],
        width: int,
        height: int,
    ) -> None:
        """Render cipher hint as rotated marginal notation along the right edge.

        Aesthetic: classified document with marginal annotations — rotated 90°,
        ~20% opacity, 20px monospace font, centered vertically between header
        and footer. Positioned 40px from right edge for visibility.
        """
        from PIL import Image, ImageDraw

        font_cipher = load_monospace_font(FONT_FEED_SEAL)

        # Available vertical space: between header bottom and footer top
        # Use generous margins to keep clear of header/footer panels
        footer_height = 60  # matches the upgraded bottom panel
        margin_height = height - BUREAU_HEADER_HEIGHT - footer_height - 40

        # Create a wide-enough canvas for the larger font (will be rotated)
        temp = Image.new("RGBA", (margin_height, 40), (0, 0, 0, 0))
        temp_draw = ImageDraw.Draw(temp)

        # ~20% opacity (alpha = 50/255)
        cipher_color = (*primary_rgb, 50)
        temp_draw.text((8, 6), cipher_hint, fill=cipher_color, font=font_cipher)

        # Rotate 90 degrees counter-clockwise (text reads bottom-to-top)
        rotated = temp.rotate(90, expand=True)

        # Center vertically, offset 40px from right edge
        paste_x = width - 40
        paste_y = BUREAU_HEADER_HEIGHT + 20
        img.paste(rotated, (paste_x, paste_y), rotated)

        logger.debug(
            "Rendered steganographic cipher margin",
            extra={
                "cipher_length": len(cipher_hint),
                "position": f"({paste_x}, {paste_y})",
                "opacity": "20%",
                "font_size": 20,
                "stage": "cipher_margin_render",
            },
        )

    def _resize_for_instagram(
        self,
        img,
        gravity: str = "center",
    ) -> object:
        """Resize image to fit Instagram 4:5 portrait format (1080x1350).

        Crops to fill the target aspect ratio using gravity-based positioning
        (same pattern as ImageMagick/Cloudinary/NGINX image_filter):

        - ``"top"``: Preserve upper portion (faces, heads). Crops from bottom.
        - ``"center"``: Standard center crop. Best for architecture/landscapes.
        - ``"bottom"``: Preserve lower portion. Crops from top.
        - ``"smart"``: Entropy-based — finds the region with highest detail
          (edge density + color variance) and centers the crop there.
          No external dependency — uses Pillow's ImageStat + ImageFilter.
        """
        from PIL import Image

        target_w, target_h = IG_WIDTH, IG_HEIGHT_PORTRAIT
        target_ratio = target_w / target_h
        img_ratio = img.width / img.height

        if img_ratio > target_ratio:
            # Image is wider — crop sides (always centered horizontally)
            new_w = int(img.height * target_ratio)
            left = (img.width - new_w) // 2
            img = img.crop((left, 0, left + new_w, img.height))
        elif img_ratio < target_ratio:
            # Image is taller — crop vertically
            new_h = int(img.width / target_ratio)

            if gravity == "smart":
                top = self._smart_crop_offset(img, new_h)
            elif gravity == "top":
                top = 0
            elif gravity == "bottom":
                top = img.height - new_h
            else:
                top = (img.height - new_h) // 2

            img = img.crop((0, top, img.width, top + new_h))

        return img.resize((target_w, target_h), Image.LANCZOS)

    @staticmethod
    def _smart_crop_offset(img, crop_height: int) -> int:
        """Find the vertical offset that preserves the most detail.

        Slides a window of ``crop_height`` down the image in 10 steps,
        scores each position by edge density (Laplacian variance),
        and returns the offset with the highest score. Runs in <50ms
        on a 1024px image — no external dependencies.
        """
        from PIL import ImageFilter, ImageStat

        # Convert to grayscale for edge detection
        gray = img.convert("L")
        edges = gray.filter(ImageFilter.FIND_EDGES)

        max_top = img.height - crop_height
        steps = min(10, max_top)
        if steps <= 0:
            return 0

        best_offset = 0
        best_score = -1.0
        step_size = max(1, max_top // steps)

        for offset in range(0, max_top + 1, step_size):
            region = edges.crop((0, offset, edges.width, offset + crop_height))
            stat = ImageStat.Stat(region)
            # Score = mean edge intensity + variance (rewards detail-rich regions)
            score = stat.mean[0] + stat.var[0] ** 0.5
            if score > best_score:
                best_score = score
                best_offset = offset

        return best_offset

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
    async def _download_image(url: str) -> bytes:
        """Download an image from a URL."""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.content
        except (httpx.HTTPError, OSError) as exc:
            logger.error(
                "Image download failed",
                extra={
                    "source_url": url,
                    "stage": "download",
                },
            )
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("instagram_phase", "image_download")
                scope.set_context("instagram", {"source_url": url})
                sentry_sdk.capture_exception(exc)
            raise

    @staticmethod
    async def _download_image_safe(url: str) -> bytes | None:
        """Download image, returning None on failure (graceful fallback for stories)."""
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.content
        except (httpx.HTTPError, OSError):
            logger.warning(
                "Story asset download failed (non-fatal)",
                extra={
                    "source_url": url[:200],
                    "stage": "story_asset_download",
                },
            )
            return None
