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
import math
from functools import lru_cache
from typing import TYPE_CHECKING
from uuid import uuid4

import httpx
import sentry_sdk

from supabase import AsyncClient as Client

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
STORY_HEADER_Y = 260       # Main content starts below top safe area
STORY_FOOTER_Y = 1840      # Footer above bottom safe area
STORY_LINE_HEIGHT = 48     # Line spacing for body text
STORY_SCANLINE_ALPHA = 18  # Scan line overlay opacity (~7%) — not used directly; templates pass explicit alpha
STORY_SAFE_TOP = 160       # Top safe area (notch/status bar)
STORY_CLOSING_MIN_Y = 1200  # Earliest Y for poetic closing line
STORY_CLOSING_MAX_Y = 1680  # Latest Y (before footer)

# Operative type symbols for advisory template
OPERATIVE_SYMBOLS: dict[str, str] = {
    "Saboteur": "\u265c",     # ♜
    "Infiltrator": "\u265e",  # ♞
    "Spy": "\u265d",          # ♝
    "Propagandist": "\u265b", # ♛
    "Assassin": "\u265a",     # ♚
}


@lru_cache(maxsize=32)
def _load_monospace_font(size: int):
    """Load a monospace font with cross-platform fallback.

    Tries common Linux paths first (deployment target), then macOS,
    then falls back to Pillow's built-in default font.
    Cached — font objects are reused across compose calls.
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


@lru_cache(maxsize=16)
def _load_bold_font(size: int):
    """Load a bold monospace font with cross-platform fallback (cached)."""
    from PIL import ImageFont

    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        "/usr/share/fonts/dejavu-sans-mono-fonts/DejaVuSansMono-Bold.ttf",
        "/System/Library/Fonts/Menlo.ttc",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return _load_monospace_font(size)


@lru_cache(maxsize=16)
def _load_italic_font(size: int):
    """Load an oblique/italic monospace font with cross-platform fallback (cached)."""
    from PIL import ImageFont

    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Oblique.ttf",
        "/usr/share/fonts/dejavu-sans-mono-fonts/DejaVuSansMono-Oblique.ttf",
        "/System/Library/Fonts/Menlo.ttc",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return _load_monospace_font(size)


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

    # ── Story Visual Helpers ───────────────────────────────────────────────

    @staticmethod
    def _create_gradient(
        w: int,
        h: int,
        top_color: tuple[int, ...],
        bottom_color: tuple[int, ...],
    ) -> PILImage:
        """Create vertical linear gradient RGBA image via NumPy."""
        import numpy as np
        from PIL import Image

        arr = np.zeros((h, w, 4), dtype=np.uint8)
        for i in range(4):
            t = top_color[i] if i < len(top_color) else 255
            b = bottom_color[i] if i < len(bottom_color) else 255
            arr[:, :, i] = np.linspace(t, b, h, dtype=np.uint8)[:, np.newaxis]
        return Image.fromarray(arr, "RGBA")

    @staticmethod
    def _create_vignette(w: int, h: int, intensity: float = 0.7) -> PILImage:
        """Create radial vignette overlay (dark edges, transparent center)."""
        import numpy as np
        from PIL import Image

        y_grid, x_grid = np.ogrid[:h, :w]
        cx, cy = w / 2, h / 2
        dist = np.sqrt(((x_grid - cx) / cx) ** 2 + ((y_grid - cy) / cy) ** 2)
        alpha = np.clip(dist * intensity * 255, 0, 255).astype(np.uint8)
        vignette = np.zeros((h, w, 4), dtype=np.uint8)
        vignette[:, :, 3] = alpha
        return Image.fromarray(vignette, "RGBA")

    @staticmethod
    def _add_noise_grain(
        img: PILImage, sigma: int = 15, opacity: float = 0.08,
    ) -> PILImage:
        """Add film grain noise overlay."""
        import numpy as np
        from PIL import Image

        arr = np.array(img).astype(np.int16)
        noise = np.random.default_rng().normal(0, sigma, arr.shape[:2])
        scaled = (noise * opacity).astype(np.int16)
        for c in range(min(3, arr.shape[2])):
            arr[:, :, c] = np.clip(arr[:, :, c] + scaled, 0, 255)
        return Image.fromarray(arr.astype(np.uint8), img.mode)

    @staticmethod
    def _add_bokeh_dots(
        img: PILImage,
        color: tuple[int, int, int],
        count: int = 12,
        min_radius: int = 20,
        max_radius: int = 80,
        alpha_range: tuple[int, int] = (8, 25),
        seed: int = 42,
    ) -> None:
        """Add subtle semi-transparent bokeh dots for atmospheric depth."""
        import random

        from PIL import Image, ImageDraw, ImageFilter

        rng = random.Random(seed)  # noqa: S311 — decorative bokeh, not cryptographic
        w, h = img.size
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)

        for _ in range(count):
            x = rng.randint(-max_radius, w + max_radius)
            y = rng.randint(-max_radius, h + max_radius)
            r = rng.randint(min_radius, max_radius)
            a = rng.randint(alpha_range[0], alpha_range[1])
            draw.ellipse(
                (x - r, y - r, x + r, y + r),
                fill=(*color, a),
            )

        layer = layer.filter(ImageFilter.GaussianBlur(radius=30))
        img.alpha_composite(layer)

    @staticmethod
    def _text_with_glow(
        img: PILImage,
        position: tuple[int, int],
        text: str,
        font,
        fill: tuple[int, ...],
        glow_color: tuple[int, ...],
        glow_radius: int = 8,
    ) -> None:
        """Render text with soft glow shadow onto an RGBA image (in-place).

        Uses a cropped-size glow layer rather than full-image allocation
        to keep memory usage proportional to text size, not canvas size.
        """
        from PIL import Image, ImageDraw, ImageFilter

        # Measure text bounds to size the glow layer
        bbox = ImageDraw.Draw(img).textbbox(position, text, font=font)
        pad = glow_radius * 3
        layer_x = max(0, bbox[0] - pad)
        layer_y = max(0, bbox[1] - pad)
        layer_w = min(img.width, bbox[2] + pad) - layer_x
        layer_h = min(img.height, bbox[3] + pad) - layer_y

        if layer_w <= 0 or layer_h <= 0:
            ImageDraw.Draw(img).text(position, text, fill=fill, font=font)
            return

        # Render glow on a minimal-size layer
        glow = Image.new("RGBA", (layer_w, layer_h), (0, 0, 0, 0))
        glow_pos = (position[0] - layer_x, position[1] - layer_y)
        ImageDraw.Draw(glow).text(glow_pos, text, fill=glow_color, font=font)
        glow = glow.filter(ImageFilter.GaussianBlur(radius=glow_radius))
        img.alpha_composite(glow, (layer_x, layer_y))

        # Crisp text on top with dark stroke for readability
        ImageDraw.Draw(img).text(
            position, text, fill=fill, font=font,
            stroke_width=2, stroke_fill=(0, 0, 0, 180),
        )

    @staticmethod
    def _draw_scan_lines_rgba(
        img: PILImage,
        accent: tuple[int, int, int],
        *,
        spacing: int = 4,
        alpha: int = STORY_SCANLINE_ALPHA,
    ) -> None:
        """Draw scan lines via alpha compositing (correct for RGBA images)."""
        from PIL import Image, ImageDraw

        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        color = (*accent, alpha)
        for y in range(0, img.height, spacing):
            draw.line([(0, y), (img.width, y)], fill=color, width=1)
        img.alpha_composite(overlay)

    @staticmethod
    def _draw_archetype_symbol(
        draw,
        cx: int,
        cy: int,
        size: int,
        archetype: str,
        color: tuple[int, ...],
    ) -> None:
        """Draw a geometric archetype symbol using Pillow primitives."""
        r = size // 2
        lw = max(3, size // 40)

        if archetype == "The Tower":
            # Diamond (rotated square) with inner diamond
            draw.polygon(
                [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)],
                outline=color, width=lw,
            )
            r2 = r // 2
            draw.polygon(
                [(cx, cy - r2), (cx + r2, cy), (cx, cy + r2), (cx - r2, cy)],
                outline=color, width=lw,
            )

        elif archetype == "The Shadow":
            # Half-filled circle (left half solid)
            bbox = (cx - r, cy - r, cx + r, cy + r)
            draw.ellipse(bbox, outline=color, width=lw)
            draw.pieslice(bbox, 90, 270, fill=color)

        elif archetype == "The Devouring Mother":
            # Circle with inner filled circle
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=color, width=lw)
            r2 = r // 3
            draw.ellipse((cx - r2, cy - r2, cx + r2, cy + r2), fill=color)

        elif archetype == "The Deluge":
            # Three horizontal wavy lines
            for offset_y in (-r // 3, 0, r // 3):
                points = []
                for x in range(cx - r, cx + r + 1, 2):
                    y = cy + offset_y + int(math.sin((x - cx) * 0.04) * (r // 5))
                    points.append((x, y))
                if len(points) >= 2:
                    draw.line(points, fill=color, width=lw + 2)

        elif archetype == "The Overthrow":
            # X in circle
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=color, width=lw)
            offset = int(r * 0.55)
            draw.line(
                [(cx - offset, cy - offset), (cx + offset, cy + offset)],
                fill=color, width=lw + 1,
            )
            draw.line(
                [(cx + offset, cy - offset), (cx - offset, cy + offset)],
                fill=color, width=lw + 1,
            )

        elif archetype == "The Prometheus":
            # Sun: circle with 8 radiating lines
            r_inner = r // 2
            draw.ellipse(
                (cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner),
                outline=color, width=lw,
            )
            for angle_deg in range(0, 360, 45):
                angle = math.radians(angle_deg)
                x1 = cx + int(math.cos(angle) * (r_inner + lw * 2))
                y1 = cy + int(math.sin(angle) * (r_inner + lw * 2))
                x2 = cx + int(math.cos(angle) * r)
                y2 = cy + int(math.sin(angle) * r)
                draw.line([(x1, y1), (x2, y2)], fill=color, width=lw)

        elif archetype == "The Awakening":
            # Concentric circles (3 rings)
            for frac in (1.0, 0.65, 0.3):
                ri = int(r * frac)
                draw.ellipse((cx - ri, cy - ri, cx + ri, cy + ri), outline=color, width=lw)

        elif archetype == "The Entropy":
            # Circle with diagonal slash
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=color, width=lw)
            offset = int(r * 0.7)
            draw.line(
                [(cx - offset, cy - offset), (cx + offset, cy + offset)],
                fill=color, width=lw + 2,
            )

        else:
            # Fallback: simple circle
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=color, width=lw)

    @staticmethod
    def _draw_magnitude_arc(
        draw,
        cx: int,
        cy: int,
        radius: int,
        width: int,
        magnitude: float,
        color: tuple[int, int, int],
    ) -> None:
        """Draw a circular magnitude gauge arc."""
        bbox = (cx - radius, cy - radius, cx + radius, cy + radius)
        # Background ring
        draw.arc(bbox, 0, 360, fill=(40, 40, 40, 120), width=width)
        # Magnitude fill (clockwise from top)
        sweep = int(360 * min(magnitude, 1.0))
        if sweep > 0:
            draw.arc(bbox, -90, -90 + sweep, fill=(*color, 255), width=width)

    @staticmethod
    def _draw_corner_brackets(
        draw,
        x: int,
        y: int,
        w: int,
        h: int,
        color: tuple[int, ...],
        bracket_size: int = 40,
        line_width: int = 2,
    ) -> None:
        """Draw decorative L-shaped corner brackets around a rectangular area."""
        bs = bracket_size
        # Top-left
        draw.line([(x, y), (x + bs, y)], fill=color, width=line_width)
        draw.line([(x, y), (x, y + bs)], fill=color, width=line_width)
        # Top-right
        draw.line([(x + w, y), (x + w - bs, y)], fill=color, width=line_width)
        draw.line([(x + w, y), (x + w, y + bs)], fill=color, width=line_width)
        # Bottom-left
        draw.line([(x, y + h), (x + bs, y + h)], fill=color, width=line_width)
        draw.line([(x, y + h), (x, y + h - bs)], fill=color, width=line_width)
        # Bottom-right
        draw.line([(x + w, y + h), (x + w - bs, y + h)], fill=color, width=line_width)
        draw.line([(x + w, y + h), (x + w, y + h - bs)], fill=color, width=line_width)

    @staticmethod
    def _crop_to_circle(
        img_bytes: bytes,
        size: int,
        border_color: tuple[int, int, int],
        border_width: int = 4,
    ) -> PILImage | None:
        """Crop image bytes to anti-aliased circle with colored glow border ring."""
        from PIL import Image, ImageDraw, ImageFilter, ImageOps

        try:
            img = Image.open(io.BytesIO(img_bytes))
            if img.mode != "RGBA":
                img = img.convert("RGBA")

            # Crop to fill square
            img = ImageOps.fit(img, (size, size), method=Image.LANCZOS)

            # Anti-aliased circle mask (4x supersampled)
            scale = 4
            mask_dim = size * scale
            mask = Image.new("L", (mask_dim, mask_dim), 0)
            ImageDraw.Draw(mask).ellipse((0, 0, mask_dim - 1, mask_dim - 1), fill=255)
            mask = mask.resize((size, size), Image.LANCZOS)
            img.putalpha(mask)

            # Compose onto canvas with border ring + glow
            total = size + border_width * 2
            result = Image.new("RGBA", (total, total), (0, 0, 0, 0))

            # Soft glow ring (brighter, wider blur)
            glow = Image.new("RGBA", (total, total), (0, 0, 0, 0))
            ImageDraw.Draw(glow).ellipse(
                (0, 0, total - 1, total - 1),
                outline=(*border_color, 200), width=border_width + 6,
            )
            glow = glow.filter(ImageFilter.GaussianBlur(radius=10))
            result.alpha_composite(glow)

            # Crisp border ring
            ImageDraw.Draw(result).ellipse(
                (0, 0, total - 1, total - 1),
                outline=(*border_color, 255), width=border_width,
            )

            # Paste portrait in center
            result.paste(img, (border_width, border_width), img)
            return result

        except Exception:
            logger.warning("Portrait circle crop failed", exc_info=True)
            return None

    @staticmethod
    def _wrap_text(text: str, font, max_width: int) -> list[str]:
        """Word-wrap text to fit within max_width pixels."""
        from PIL import Image, ImageDraw

        temp = Image.new("RGB", (1, 1))
        draw = ImageDraw.Draw(temp)

        words = text.split()
        lines: list[str] = []
        current = ""
        for word in words:
            test = f"{current} {word}".strip()
            bbox = draw.textbbox((0, 0), test, font=font)
            if bbox[2] - bbox[0] <= max_width:
                current = test
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
        return lines

    @staticmethod
    def _draw_story_footer(
        draw,
        accent: tuple[int, int, int],
    ) -> None:
        """Draw Bureau watermark footer for Stories."""
        font_wm = _load_monospace_font(20)
        draw.text(
            (60, STORY_FOOTER_Y),
            BUREAU_WATERMARK_TEXT,
            fill=(80, 80, 80),
            font=font_wm,
        )
        draw.text(
            (60, STORY_FOOTER_Y + 28),
            "AI-generated content",
            fill=(60, 60, 60),
            font=font_wm,
        )

    # ── Story Templates (1080×1920 vertical) ────────────────────────────

    def compose_story_detection(
        self,
        *,
        archetype: str,
        signature: str,
        magnitude: float,
        accent_hex: str,
    ) -> bytes:
        """Story 1: SUBSTRATE ANOMALY DETECTED — cinematic emergency broadcast.

        Full-bleed gradient background with archetype glyph, circular magnitude
        gauge, text glow effects, film grain, heavy scan lines, and vignette.
        Content distributed across full 1080×1920 canvas.
        """
        from PIL import ImageDraw

        from backend.models.resonance import ARCHETYPE_DESCRIPTIONS

        accent = self._hex_to_rgb(accent_hex)
        w, h = IG_WIDTH, IG_HEIGHT_STORY

        # Gradient background: faint archetype color → black
        img = self._create_gradient(w, h, (*accent, 50), (0, 0, 0, 255))

        # Large archetype symbol — decorative watermark behind title zone
        draw = ImageDraw.Draw(img)
        self._draw_archetype_symbol(draw, w // 2, 420, 380, archetype, (*accent, 30))

        # Film grain
        img = self._add_noise_grain(img, sigma=20, opacity=0.10)

        # Subtle bokeh for atmospheric depth
        self._add_bokeh_dots(img, accent, count=15, seed=hash(archetype) & 0xFFFF)

        # Heavy scan lines (C5: +50% alpha)
        self._draw_scan_lines_rgba(img, accent, alpha=33)

        draw = ImageDraw.Draw(img)

        # Classification badge — rounded rectangle with text inside
        font_stamp = _load_monospace_font(28)
        badge_text = "CLASSIFICATION: AMBER"
        badge_bbox = draw.textbbox((0, 0), badge_text, font=font_stamp)
        badge_tw = badge_bbox[2] - badge_bbox[0]
        badge_th = badge_bbox[3] - badge_bbox[1]
        badge_pad_x, badge_pad_y = 16, 8
        draw.rounded_rectangle(
            [(56, STORY_SAFE_TOP - badge_pad_y),
             (56 + badge_tw + badge_pad_x * 2, STORY_SAFE_TOP + badge_th + badge_pad_y)],
            radius=8, fill=(*accent, 50),
        )
        draw.text(
            (56 + badge_pad_x, STORY_SAFE_TOP),
            badge_text, fill=(*accent, 255), font=font_stamp,
        )

        # Title backdrop panel (tight around text, close to badge)
        title_panel_y = 240
        draw.rounded_rectangle(
            [(48, title_panel_y), (w - 48, title_panel_y + 160)],
            radius=12, fill=(0, 0, 0, 100),
        )

        # Title with glow — large and dramatic (C1: accent color title)
        font_title = _load_bold_font(60)
        y = 252
        self._text_with_glow(
            img, (60, y), "SUBSTRATE ANOMALY",
            font_title, (*accent, 255), (*accent, 100), glow_radius=14,
        )
        y += 64
        self._text_with_glow(
            img, (60, y), "DETECTED",
            font_title, (*accent, 255), (*accent, 100), glow_radius=14,
        )
        y += 72  # Tighter post-title gap

        # Accent divider line (double-line effect)
        draw = ImageDraw.Draw(img)
        draw.line([(60, y), (w - 60, y)], fill=(*accent, 120), width=2)
        draw.line([(60, y + 4), (w - 60, y + 4)], fill=(*accent, 40), width=1)
        y += 48  # A: grid-aligned (2*24)

        # Signature + archetype info
        font_md = _load_monospace_font(48)
        sig_display = signature.upper().replace("_", " ")[:25]
        draw.text(
            (60, y), f"Signature: [{sig_display}]",
            fill=(200, 200, 200, 255), font=font_md,
            stroke_width=1, stroke_fill=(0, 0, 0, 120),
        )
        y += 60
        draw.text(
            (60, y), f"Archetype: {archetype.upper()}",
            fill=(255, 255, 255, 255), font=font_md,
            stroke_width=1, stroke_fill=(0, 0, 0, 120),
        )
        y += 56

        # Archetype description (italic, accent-tinted) (C2: alpha 180)
        desc = ARCHETYPE_DESCRIPTIONS.get(archetype, "")
        if desc:
            font_desc = _load_italic_font(36)
            desc_lines = self._wrap_text(desc, font_desc, w - 140)
            for dline in desc_lines[:3]:
                draw.text((60, y), dline, fill=(*accent, 220), font=font_desc)
                y += 48
        y += 48  # Tighter before gauge

        # Accent divider before gauge
        draw.line([(60, y), (w - 60, y)], fill=(*accent, 80), width=1)
        y += 48

        # Gauge — centered in visible zone (Y=160-1200)
        gauge_cy = max(y + 160, 940)
        draw.ellipse(
            [(w // 2 - 180, gauge_cy - 180), (w // 2 + 180, gauge_cy + 180)],
            fill=(0, 0, 0, 80),
        )

        # Circular magnitude gauge — large, centered
        self._draw_magnitude_arc(draw, w // 2, gauge_cy, 160, 22, magnitude, accent)

        # Magnitude value in gauge center (account for font ascent/descent offset)
        font_mag = _load_bold_font(96)
        mag_text = f"{magnitude:.2f}"
        bbox = draw.textbbox((0, 0), mag_text, font=font_mag)
        cx = w // 2 - (bbox[0] + bbox[2]) // 2
        cy = gauge_cy - (bbox[1] + bbox[3]) // 2
        self._text_with_glow(
            img, (cx, cy), mag_text,
            font_mag, (255, 255, 255, 255), (*accent, 80), glow_radius=10,
        )

        # "MAGNITUDE" label below gauge
        draw = ImageDraw.Draw(img)
        font_label = _load_monospace_font(28)
        mag_label = "MAGNITUDE"
        lbbox = draw.textbbox((0, 0), mag_label, font=font_label)
        lw = lbbox[2] - lbbox[0]
        draw.text(
            (w // 2 - lw // 2, gauge_cy + 175), mag_label,
            fill=(120, 120, 120, 255), font=font_label,
        )

        # Directive — below gauge
        font_directive = _load_italic_font(44)
        directive = "All operatives report to stations."
        dbbox = draw.textbbox((0, 0), directive, font=font_directive)
        dw = dbbox[2] - dbbox[0]
        directive_y = gauge_cy + 264  # Below gauge, tighter
        self._text_with_glow(
            img, (w // 2 - dw // 2, directive_y), directive,
            font_directive, (*accent, 200), (*accent, 60), glow_radius=6,
        )

        # Threat assessment label — additional bottom-third content
        threat_y = directive_y + 96
        font_threat = _load_monospace_font(32)
        level = "CATASTROPHIC" if magnitude >= 0.8 else "ELEVATED" if magnitude >= 0.5 else "MODERATE"
        threat_text = f"THREAT ASSESSMENT: {level}"
        tbbox = draw.textbbox((0, 0), threat_text, font=font_threat)
        tw = tbbox[2] - tbbox[0]
        draw.text(
            (w // 2 - tw // 2, threat_y), threat_text,
            fill=(*accent, 160), font=font_threat,
        )

        # Horizontal rule near bottom
        rule_y = threat_y + 72  # A: grid-aligned (3*24)
        draw.line([(200, rule_y), (w - 200, rule_y)], fill=(*accent, 40), width=1)

        # Vignette
        vignette = self._create_vignette(w, h, intensity=0.5)
        img.alpha_composite(vignette)

        # Accent bars (top + bottom) — width 10, double-line effect
        draw = ImageDraw.Draw(img)
        draw.rectangle([(0, 0), (w, 10)], fill=(*accent, 255))
        draw.rectangle([(0, 12), (w, 14)], fill=(*accent, 80))
        draw.rectangle([(0, h - 10), (w, h)], fill=(*accent, 255))
        draw.rectangle([(0, h - 14), (w, h - 12)], fill=(*accent, 80))

        # Bureau footer
        self._draw_story_footer(draw, accent)

        return self._image_to_jpeg(img.convert("RGB"))

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
        """Story 2: BUREAU CLASSIFICATION — dossier document with corner brackets.

        Paper-textured dark background with Bureau seal watermark, classification
        markers, corner bracket framing, and amber-accented dispatch text.
        """
        from PIL import Image, ImageDraw

        accent = self._hex_to_rgb(accent_hex)
        w, h = IG_WIDTH, IG_HEIGHT_STORY

        # Dark base with very subtle warm tone
        img = Image.new("RGBA", (w, h), (12, 13, 18, 255))

        # Paper texture (heavier noise, low opacity)
        img = self._add_noise_grain(img, sigma=25, opacity=0.04)

        # Faded Bureau seal watermark (centered, very transparent)
        draw = ImageDraw.Draw(img)
        seal_font = _load_bold_font(28)
        seal_text = "BUREAU OF IMPOSSIBLE GEOGRAPHY"
        seal_bbox = draw.textbbox((0, 0), seal_text, font=seal_font)
        seal_w = seal_bbox[2] - seal_bbox[0]
        draw.text(
            ((w - seal_w) // 2, 160), seal_text,
            fill=(*accent, 40), font=seal_font,
        )

        # Subtle scan lines (clinical document feel) (C5: +50% alpha)
        self._draw_scan_lines_rgba(img, accent, alpha=15)

        # Corner bracket frame around content area — brighter brackets
        draw = ImageDraw.Draw(img)
        self._draw_corner_brackets(draw, 48, 240, w - 96, h - 340, (*accent, 160), 60, 3)

        # Title backdrop panel (B: panel margin x=48)
        title_panel_y = 240
        draw.rounded_rectangle(
            [(48, title_panel_y), (w - 48, title_panel_y + 96)],
            radius=12, fill=(0, 0, 0, 100),
        )

        # Title with glow (C1: accent color title)
        font_title = _load_bold_font(60)
        y = 252
        self._text_with_glow(
            img, (60, y), "BUREAU CLASSIFICATION",
            font_title, (*accent, 255), (*accent, 80), glow_radius=8,
        )
        y += 84  # Tighter post-title

        draw = ImageDraw.Draw(img)
        font_sm = _load_monospace_font(36)
        draw.line([(60, y), (w - 60, y)], fill=(*accent, 140), width=2)
        draw.line([(60, y + 4), (w - 60, y + 4)], fill=(*accent, 40), width=1)
        y += 48  # A: grid-aligned (2*24)

        # Classification fields content panel (B: panel margin x=48)
        fields_panel_y = y - 16
        fields_panel_h = 380
        draw.rounded_rectangle(
            [(48, fields_panel_y), (w - 48, fields_panel_y + fields_panel_h)],
            radius=12, fill=(0, 0, 0, 40),
        )

        # Classification fields — bigger fonts, tighter spacing
        font_md = _load_monospace_font(48)
        category_display = source_category.upper().replace("_", " ")
        draw.text(
            (60, y), f"Source Category: [{category_display}]",
            fill=(200, 200, 200, 255), font=font_md,
            stroke_width=1, stroke_fill=(0, 0, 0, 100),
        )
        y += 72
        draw.text(
            (60, y), f"Affected Shards: [{affected_shard_count}]",
            fill=(200, 200, 200, 255), font=font_md,
            stroke_width=1, stroke_fill=(0, 0, 0, 100),
        )
        y += 72
        draw.text(
            (60, y), "Peak Susceptibility:",
            fill=(255, 255, 255, 255), font=font_md,
            stroke_width=1, stroke_fill=(0, 0, 0, 100),
        )
        y += 60
        draw.text(
            (72, y), f"{highest_susceptibility_sim[:28]}",
            fill=(*accent, 240), font=font_md,
            stroke_width=1, stroke_fill=(0, 0, 0, 100),
        )
        y += 48
        draw.text(
            (72, y), f"({highest_susceptibility_val:.1f}\u00d7 baseline)",
            fill=(*accent, 200), font=font_sm,
        )
        y += 96

        # Accent divider between fields and dispatch
        draw.line([(60, y), (w - 60, y)], fill=(*accent, 80), width=1)
        y += 48

        # Bureau dispatch text with left accent bar (wider bar + caps)
        if bureau_dispatch:
            bar_x = 56
            bar_top = y
            font_body = _load_monospace_font(36)
            lines = bureau_dispatch[:500].split("\n")[:10]
            for line in lines:
                wrapped = self._wrap_text(line, font_body, w - 160)
                for wline in wrapped:
                    draw.text((72, y), wline, fill=(150, 150, 150, 255), font=font_body)
                    y += 56
            bar_bottom = y
            # Wider accent bar (6px) with horizontal caps
            draw.rectangle(
                [(bar_x, bar_top - 4), (bar_x + 6, bar_bottom + 4)],
                fill=(*accent, 180),
            )
            # Top cap
            draw.line(
                [(bar_x, bar_top - 4), (bar_x + 20, bar_top - 4)],
                fill=(*accent, 140), width=2,
            )
            # Bottom cap
            draw.line(
                [(bar_x, bar_bottom + 4), (bar_x + 20, bar_bottom + 4)],
                fill=(*accent, 140), width=2,
            )
            y += 72

        # Accent divider before closing
        draw.line([(200, y), (w - 200, y)], fill=(*accent, 50), width=1)
        y += 72

        # Closing line — in extended visible zone (Y=1100-1300)
        closing_y = max(y, 1100)
        closing_y = min(closing_y, 1300)
        font_closing = _load_italic_font(44)
        closing_lines = self._wrap_text(
            "The Substrate trembles. Reality bleeds.", font_closing, w - 140,
        )
        draw = ImageDraw.Draw(img)
        for ci, cline in enumerate(closing_lines[:2]):
            cbbox = draw.textbbox((0, 0), cline, font=font_closing)
            ctw = cbbox[2] - cbbox[0]
            self._text_with_glow(
                img, (w // 2 - ctw // 2, closing_y + ci * 64), cline,
                font_closing, (*accent, 220), (*accent, 60), glow_radius=8,
            )

        # Filing reference — additional bottom content
        filing_y = closing_y + len(closing_lines) * 64 + 24
        if filing_y < STORY_FOOTER_Y - 80:
            font_filing = _load_monospace_font(28)
            draw = ImageDraw.Draw(img)
            draw.text(
                (60, filing_y), f"FILING: R-{archetype.upper().replace('THE ', '')}-CLASS",
                fill=(60, 60, 60, 255), font=font_filing,
            )
            draw.text(
                (60, filing_y + 28), "STATUS: ACTIVE / MONITORING",
                fill=(60, 60, 60, 255), font=font_filing,
            )

        # Accent bars — width 10, double-line effect
        draw = ImageDraw.Draw(img)
        draw.rectangle([(0, 0), (w, 10)], fill=(*accent, 255))
        draw.rectangle([(0, 12), (w, 14)], fill=(*accent, 80))
        draw.rectangle([(0, h - 10), (w, h)], fill=(*accent, 255))
        draw.rectangle([(0, h - 14), (w, h - 12)], fill=(*accent, 80))

        # Vignette (light)
        vignette = self._create_vignette(w, h, intensity=0.4)
        img.alpha_composite(vignette)

        self._draw_story_footer(ImageDraw.Draw(img), accent)

        return self._image_to_jpeg(img.convert("RGB"))

    def compose_story_impact(
        self,
        *,
        simulation_name: str,
        effective_magnitude: float,
        events_spawned: list[str],
        narrative_closing: str | None,
        accent_hex: str,
        sim_color_hex: str | None = None,
        banner_bytes: bytes | None = None,
        portraits: list[dict] | None = None,
        reactions: list[dict] | None = None,
    ) -> bytes:
        """Story 3+: SHARD IMPACT — cinematic hero slide with real imagery.

        When banner/portrait data is available: blurred darkened simulation banner
        background, circular agent portraits with glow rings, reaction quote cards,
        and AI-generated poetic closing with text glow.

        Falls back to gradient-on-dark if no imagery is available.

        portraits: list of {"image_bytes": bytes, "agent_name": str}
        reactions: list of {"agent_name": str, "text": str, "emotion": str | None}
        """
        from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

        accent = self._hex_to_rgb(accent_hex)
        sim_color = self._hex_to_rgb(sim_color_hex) if sim_color_hex else accent
        w, h = IG_WIDTH, IG_HEIGHT_STORY

        # ── Background ────────────────────────────────────────────────
        if banner_bytes:
            try:
                bg = Image.open(io.BytesIO(banner_bytes)).convert("RGB")
                bg = ImageOps.fit(bg, (w, h), method=Image.LANCZOS)
                bg = ImageEnhance.Brightness(bg).enhance(0.25)
                bg = bg.filter(ImageFilter.GaussianBlur(radius=30))
                img = bg.convert("RGBA")
            except Exception:
                logger.warning("Banner processing failed — using gradient fallback")
                img = self._create_gradient(w, h, (*sim_color, 30), (0, 0, 0, 255))
        else:
            img = self._create_gradient(w, h, (*sim_color, 30), (0, 0, 0, 255))

        # Gradient overlay: transparent top → black bottom (text readability)
        gradient_overlay = self._create_gradient(w, h, (0, 0, 0, 0), (0, 0, 0, 220))
        img.alpha_composite(gradient_overlay)

        # Light grain
        img = self._add_noise_grain(img, sigma=12, opacity=0.06)

        # ── Top Zone: Simulation Name + Magnitude ─────────────────────
        draw = ImageDraw.Draw(img)
        font_title = _load_bold_font(60)
        font_mag = _load_monospace_font(48)
        font_sm = _load_monospace_font(36)
        font_event = _load_monospace_font(36)

        # Title backdrop panel — title + magnitude + bar in one block
        title_panel_y = 240
        draw.rounded_rectangle(
            [(48, title_panel_y), (w - 48, title_panel_y + 210)],
            radius=12, fill=(0, 0, 0, 100),
        )

        # "SHARD IMPACT:" top line
        y = 252
        self._text_with_glow(
            img, (60, y), "SHARD IMPACT:",
            font_title, (*sim_color, 255), (*sim_color, 80), glow_radius=10,
        )
        y += 64

        # Sim name left-aligned, magnitude right-aligned on same row
        self._text_with_glow(
            img, (60, y), f"[{simulation_name.upper()[:24]}]",
            font_title, (*sim_color, 255), (*sim_color, 80), glow_radius=10,
        )
        draw = ImageDraw.Draw(img)
        mag_text = f"{effective_magnitude:.2f}"
        mag_bbox = draw.textbbox((0, 0), mag_text, font=font_mag)
        mag_tw = mag_bbox[2] - mag_bbox[0]
        self._text_with_glow(
            img, (w - 60 - mag_tw, y + 4), mag_text,
            font_mag, (255, 255, 255, 255), (*sim_color, 80), glow_radius=8,
        )
        y += 84  # Breathing room before bar

        # Full-width magnitude bar as panel footer
        draw = ImageDraw.Draw(img)
        bar_x, bar_w, bar_h = 60, w - 120, 12
        draw.rounded_rectangle(
            [(bar_x, y), (bar_x + bar_w, y + bar_h)],
            radius=4, fill=(40, 40, 40, 180),
        )
        fill_w = int(bar_w * min(effective_magnitude, 1.0))
        if fill_w > 0:
            draw.rounded_rectangle(
                [(bar_x, y), (bar_x + fill_w, y + bar_h)],
                radius=4, fill=(*sim_color, 255),
            )
        # Jump below panel bottom + breathing room
        y = title_panel_y + 210 + 24

        # Event count + impact level
        impact_lvl = min(10, max(1, round(effective_magnitude * 10)))
        draw.text(
            (60, y),
            f"Events: {len(events_spawned)}  \u2502  Impact: {impact_lvl}/10",
            fill=(180, 180, 180, 255), font=font_sm,
            stroke_width=1, stroke_fill=(0, 0, 0, 120),
        )
        y += 24  # Symmetric spacing below events line

        # ── Portrait Strip ────────────────────────────────────────────
        portrait_images: list[tuple[PILImage, str]] = []
        if portraits:
            portrait_size = 220
            for p_data in portraits[:4]:
                circle = self._crop_to_circle(
                    p_data["image_bytes"], portrait_size, sim_color, border_width=5,
                )
                if circle:
                    portrait_images.append((circle, p_data["agent_name"]))

        if portrait_images:
            total_size = portrait_images[0][0].width
            gap = 28
            strip_w = len(portrait_images) * total_size + (len(portrait_images) - 1) * gap
            start_x = (w - strip_w) // 2
            portrait_y = y + 24  # A: grid-aligned (1*24)

            for i, (p_img, p_name) in enumerate(portrait_images):
                px = start_x + i * (total_size + gap)
                img.alpha_composite(p_img, (px, portrait_y))
                # Agent name below portrait
                name_font = _load_monospace_font(30)
                draw = ImageDraw.Draw(img)
                name_bbox = draw.textbbox((0, 0), p_name[:14], font=name_font)
                name_w = name_bbox[2] - name_bbox[0]
                draw.text(
                    (px + total_size // 2 - name_w // 2, portrait_y + total_size + 8),
                    p_name[:14], fill=(180, 180, 180, 200), font=name_font,
                    stroke_width=1, stroke_fill=(0, 0, 0, 120),
                )

            y = portrait_y + total_size + 48  # A: grid-aligned (2*24)
        else:
            # No portraits — show event titles instead
            y += 24  # A: grid-aligned (1*24)
            for title in events_spawned[:5]:
                draw.text(
                    (72, y), f"\u25b8 {title[:45]}",
                    fill=(220, 220, 220, 255), font=font_event,
                )
                y += 48
            y += 24  # A: grid-aligned (1*24)

        # Section divider after portrait strip / event list
        draw = ImageDraw.Draw(img)
        draw.line([(60, y), (w - 60, y)], fill=(*sim_color, 80), width=1)
        y += 48  # A: grid-aligned (2*24)

        # ── Reaction Quote (1 prominent quote, subordinate to closing) ─
        if reactions:
            font_quote = _load_italic_font(44)
            font_attrib = _load_monospace_font(36)

            for rxn in reactions[:1]:
                quote_text = rxn["text"][:100]
                wrapped = self._wrap_text(quote_text, font_quote, w - 160)
                card_h = len(wrapped) * 56 + 96  # symmetric padding
                card_y = y

                # Semi-transparent dark card background with accent border
                # (B: card margin x=48, C4: border width=2)
                draw = ImageDraw.Draw(img)
                draw.rounded_rectangle(
                    [(48, card_y), (w - 48, card_y + card_h)],
                    radius=8, fill=(0, 0, 0, 140),
                    outline=(*sim_color, 80), width=2,
                )

                # Quote text (20px top padding)
                text_y = card_y + 20
                for wline in wrapped:
                    draw.text(
                        (72, text_y), wline,
                        fill=(220, 220, 220, 240), font=font_quote,
                    )
                    text_y += 56

                # Attribution (8px gap after last line)
                emotion_tag = f" [{rxn.get('emotion', '')}]" if rxn.get("emotion") else ""
                attrib = f"\u2014 {rxn['agent_name']}{emotion_tag}"
                draw.text(
                    (72, text_y + 8), attrib,
                    fill=(*sim_color, 200), font=font_attrib,
                )

                y = card_y + card_h + 24

            # Section divider after reactions
            draw.line([(60, y), (w - 60, y)], fill=(*sim_color, 80), width=1)
            y += 48  # A: grid-aligned (2*24)

        # ── Closing Line (centered, in extended visible zone) ────────
        if narrative_closing:
            closing_y = max(y + 72, 1100)
            closing_y = min(closing_y, 1300)
            font_closing = _load_italic_font(52)
            wrapped = self._wrap_text(narrative_closing[:120], font_closing, w - 140)
            draw = ImageDraw.Draw(img)
            for i, cline in enumerate(wrapped[:3]):
                cbbox = draw.textbbox((0, 0), cline, font=font_closing)
                ctw = cbbox[2] - cbbox[0]
                self._text_with_glow(
                    img, (w // 2 - ctw // 2, closing_y + i * 64), cline,
                    font_closing, (*sim_color, 230), (*sim_color, 60), glow_radius=10,
                )

        # ── Finishing touches ─────────────────────────────────────────
        vignette = self._create_vignette(w, h, intensity=0.5)
        img.alpha_composite(vignette)

        # Accent bars — width 10, double-line effect
        draw = ImageDraw.Draw(img)
        draw.rectangle([(0, 0), (w, 10)], fill=(*sim_color, 255))
        draw.rectangle([(0, 12), (w, 14)], fill=(*sim_color, 80))
        draw.rectangle([(0, h - 10), (w, h)], fill=(*sim_color, 255))
        draw.rectangle([(0, h - 14), (w, h - 12)], fill=(*sim_color, 80))

        self._draw_story_footer(draw, sim_color)

        return self._image_to_jpeg(img.convert("RGB"))

    def compose_story_advisory(
        self,
        *,
        archetype: str,
        aligned_types: list[str],
        opposed_types: list[str],
        zone_name: str | None,
        accent_hex: str,
    ) -> bytes:
        """Story 4: OPERATIVE ADVISORY — two-column tactical briefing HUD.

        Military briefing aesthetic with aligned (green) and opposed (red)
        operative columns, chess piece symbols, and accent-colored directive.
        Content distributed across full safe zone (Y=240–1740).
        """
        from PIL import Image, ImageDraw

        accent = self._hex_to_rgb(accent_hex)
        w, h = IG_WIDTH, IG_HEIGHT_STORY

        # Dark base (C3: removed gradient stripe artifact — scan lines + grain suffice)
        img = Image.new("RGBA", (w, h), (10, 12, 18, 255))

        # Scan lines (C5: +50% alpha)
        self._draw_scan_lines_rgba(img, accent, alpha=22)

        # Grain
        img = self._add_noise_grain(img, sigma=12, opacity=0.05)

        draw = ImageDraw.Draw(img)
        font_md = _load_monospace_font(48)
        font_sm = _load_monospace_font(36)
        font_type = _load_bold_font(48)
        font_symbol = _load_monospace_font(48)

        # Title backdrop panel (B: panel margin x=48)
        title_panel_y = 240
        draw.rounded_rectangle(
            [(48, title_panel_y), (w - 48, title_panel_y + 96)],
            radius=12, fill=(0, 0, 0, 100),
        )

        # Title with glow (C1: accent color title)
        font_title = _load_bold_font(60)
        y = 252
        self._text_with_glow(
            img, (60, y), "OPERATIVE ADVISORY",
            font_title, (*accent, 255), (*accent, 80), glow_radius=8,
        )
        y += 84

        draw = ImageDraw.Draw(img)
        draw.line([(60, y), (w - 60, y)], fill=(*accent, 140), width=2)
        draw.line([(60, y + 4), (w - 60, y + 4)], fill=(*accent, 40), width=1)
        y += 48  # Consistent post-divider gap (matches other templates)

        draw.text(
            (60, y), f"Active Resonance: [{archetype.upper()}]",
            fill=(255, 255, 255, 255), font=font_md,
            stroke_width=1, stroke_fill=(0, 0, 0, 100),
        )
        y += 72  # Before columns

        # Two-column layout
        col_left_x = 80
        col_right_x = w // 2 + 60
        aligned_color = (80, 220, 120)
        opposed_color = (220, 80, 80)

        # Columns content panel (B: card margin x=48)
        max_types = max(len(aligned_types), len(opposed_types), 1)
        columns_panel_h = 96 + max_types * 120 + 48  # A: taller item spacing
        draw.rounded_rectangle(
            [(48, y - 16), (w - 48, y + columns_panel_h)],
            radius=12, fill=(0, 0, 0, 40),
        )

        # ALIGNED column
        if aligned_types:
            draw.text(
                (col_left_x, y), "ALIGNED",
                fill=(*aligned_color, 255), font=font_type,
            )
            draw.text(
                (col_left_x, y + 56), "+3% effectiveness",
                fill=(*aligned_color, 160), font=_load_monospace_font(32),
            )
            col_y = y + 96
            for op_type in aligned_types:
                symbol = OPERATIVE_SYMBOLS.get(op_type, "\u25cf")
                draw.text(
                    (col_left_x, col_y), symbol,
                    fill=(*aligned_color, 200), font=font_symbol,
                )
                draw.text(
                    (col_left_x + 56, col_y + 4), op_type,
                    fill=(220, 220, 220, 255), font=font_md,
                    stroke_width=1, stroke_fill=(0, 0, 0, 100),
                )
                col_y += 120

        # OPPOSED column
        if opposed_types:
            draw.text(
                (col_right_x, y), "OPPOSED",
                fill=(*opposed_color, 255), font=font_type,
            )
            draw.text(
                (col_right_x, y + 56), "-2% effectiveness",
                fill=(*opposed_color, 160), font=_load_monospace_font(32),
            )
            col_y = y + 96
            for op_type in opposed_types:
                symbol = OPERATIVE_SYMBOLS.get(op_type, "\u25cf")
                draw.text(
                    (col_right_x, col_y), symbol,
                    fill=(*opposed_color, 200), font=font_symbol,
                )
                draw.text(
                    (col_right_x + 56, col_y + 4), op_type,
                    fill=(220, 220, 220, 255), font=font_md,
                    stroke_width=1, stroke_fill=(0, 0, 0, 100),
                )
                col_y += 120

        # Zone pressure — pushed further down
        y_bottom = y + columns_panel_h + 72  # A: grid-aligned (3*24)

        # Horizontal accent divider
        draw.line([(60, y_bottom), (w - 60, y_bottom)], fill=(*accent, 80), width=1)
        y_bottom += 72  # A: grid-aligned (3*24)

        if zone_name:
            draw.text(
                (60, y_bottom), f"Zone pressure elevated in {zone_name}.",
                fill=(200, 200, 200, 255), font=font_sm,
            )
            y_bottom += 48  # A: grid-aligned (2*24)
        draw.text(
            (60, y_bottom), "Defenders gain tactical advantage.",
            fill=(200, 200, 200, 255), font=font_sm,
        )
        y_bottom += 48  # A: grid-aligned (2*24)
        draw.text(
            (60, y_bottom), "Adjust deployment accordingly.",
            fill=(140, 140, 140, 255), font=font_sm,
        )
        y_bottom += 168  # A: grid-aligned (7*24)

        # "Deploy accordingly." — in visible zone (Y~1100-1300)
        cta_y = max(y_bottom, 1100)
        cta_y = min(cta_y, 1300)
        cta_font = _load_bold_font(56)
        cta_text = "Deploy accordingly."
        cta_bbox = draw.textbbox((0, 0), cta_text, font=cta_font)
        cta_tw = cta_bbox[2] - cta_bbox[0]
        self._text_with_glow(
            img, (w // 2 - cta_tw // 2, cta_y), cta_text,
            cta_font, (*accent, 255), (*accent, 80), glow_radius=12,
        )

        # Status line below CTA
        status_y = cta_y + 96
        if status_y < STORY_FOOTER_Y - 60:
            font_status = _load_monospace_font(28)
            status_text = f"ADVISORY CLASS: {archetype.upper().replace('THE ', '')}"
            sbbox = draw.textbbox((0, 0), status_text, font=font_status)
            sw = sbbox[2] - sbbox[0]
            draw.text(
                (w // 2 - sw // 2, status_y), status_text,
                fill=(*accent, 100), font=font_status,
            )

        # Vignette
        vignette = self._create_vignette(w, h, intensity=0.4)
        img.alpha_composite(vignette)

        # Accent bars — width 10, double-line effect
        draw = ImageDraw.Draw(img)
        draw.rectangle([(0, 0), (w, 10)], fill=(*accent, 255))
        draw.rectangle([(0, 12), (w, 14)], fill=(*accent, 80))
        draw.rectangle([(0, h - 10), (w, h)], fill=(*accent, 255))
        draw.rectangle([(0, h - 14), (w, h - 12)], fill=(*accent, 80))

        self._draw_story_footer(draw, accent)

        return self._image_to_jpeg(img.convert("RGB"))

    def compose_story_subsiding(
        self,
        *,
        archetype: str,
        events_spawned_total: int,
        shards_affected: int,
        accent_hex: str,
    ) -> bytes:
        """Story 5: SUBSTRATE STABILIZING — elegiac minimal resolution.

        Nearly black with faintest archetype color, large centered stat numbers,
        and fading poetic closing text. Calm after the storm.
        Content vertically centered in safe zone (Y=240–1740).
        """
        from PIL import ImageDraw

        accent = self._hex_to_rgb(accent_hex)
        w, h = IG_WIDTH, IG_HEIGHT_STORY

        # Very dark with the faintest archetype hint
        img = self._create_gradient(w, h, (*accent, 12), (0, 0, 0, 255))

        # Very light scan lines (barely visible) (C5: +50% alpha)
        self._draw_scan_lines_rgba(img, accent, alpha=12)

        # Extremely subtle grain
        img = self._add_noise_grain(img, sigma=10, opacity=0.03)

        # Subtle bokeh for atmospheric depth
        self._add_bokeh_dots(
            img, accent, count=10, alpha_range=(5, 15),
            seed=hash(archetype) & 0xFFFF,
        )

        draw = ImageDraw.Draw(img)

        # Title backdrop panel (B: panel margin x=48)
        title_panel_y = 240
        draw.rounded_rectangle(
            [(48, title_panel_y), (w - 48, title_panel_y + 96)],
            radius=12, fill=(0, 0, 0, 100),
        )

        # Title with faint glow (C1: accent color title)
        font_title = _load_bold_font(60)
        y = 252
        self._text_with_glow(
            img, (60, y), "SUBSTRATE STABILIZING",
            font_title, (*accent, 200), (*accent, 40), glow_radius=6,
        )
        y += 84

        draw = ImageDraw.Draw(img)
        font_sm = _load_monospace_font(36)
        y += 96  # Breathing room — no divider (minimal aesthetic)

        font_md = _load_monospace_font(48)
        draw.text(
            (60, y), f"[{archetype.upper()}] resonance subsiding.",
            fill=(180, 180, 180, 255), font=font_md,
            stroke_width=1, stroke_fill=(0, 0, 0, 100),
        )
        y += 60
        draw.text(
            (60, y), "Residual effects at 50% magnitude.",
            fill=(120, 120, 120, 255), font=font_sm,
        )
        y += 72  # Gap above stats panel

        # Large stat numbers (centered, dramatic) (C7: accent color stats)
        font_stat = _load_bold_font(140)
        font_label = _load_monospace_font(36)

        # Stats content panel (B: panel centered, wider, 24px top padding)
        stats_panel_y = y - 24
        stats_panel_h = 580
        draw.rounded_rectangle(
            [(w // 2 - 280, stats_panel_y), (w // 2 + 280, stats_panel_y + stats_panel_h)],
            radius=12, fill=(0, 0, 0, 40),
        )

        # Events spawned (C7: stat numbers in accent color)
        events_text = str(events_spawned_total)
        bbox = draw.textbbox((0, 0), events_text, font=font_stat)
        tw = bbox[2] - bbox[0]
        stat_x = w // 2 - tw // 2
        self._text_with_glow(
            img, (stat_x, y), events_text,
            font_stat, (*accent, 230), (*accent, 50), glow_radius=10,
        )
        draw = ImageDraw.Draw(img)
        label_text = "EVENTS SPAWNED"
        lbbox = draw.textbbox((0, 0), label_text, font=font_label)
        lw = lbbox[2] - lbbox[0]
        draw.text(
            (w // 2 - lw // 2, y + 145), label_text,
            fill=(100, 100, 100, 255), font=font_label,
        )
        y += 288

        # Shards affected (C7: stat numbers in accent color)
        shards_text = str(shards_affected)
        bbox = draw.textbbox((0, 0), shards_text, font=font_stat)
        tw = bbox[2] - bbox[0]
        stat_x = w // 2 - tw // 2
        self._text_with_glow(
            img, (stat_x, y), shards_text,
            font_stat, (*accent, 230), (*accent, 50), glow_radius=10,
        )
        draw = ImageDraw.Draw(img)
        label_text = "SHARDS AFFECTED"
        lbbox = draw.textbbox((0, 0), label_text, font=font_label)
        lw = lbbox[2] - lbbox[0]
        draw.text(
            (w // 2 - lw // 2, y + 145), label_text,
            fill=(100, 100, 100, 255), font=font_label,
        )
        y += 264

        # Elegiac closing lines — symmetric gap below stats panel
        closing_y = stats_panel_y + stats_panel_h + 48
        closing_y = min(closing_y, 1300)
        font_closing = _load_italic_font(52)
        closing_1 = "The trembling fades."
        closing_2 = "The scars remain."

        bbox_1 = draw.textbbox((0, 0), closing_1, font=font_closing)
        w1 = bbox_1[2] - bbox_1[0]
        self._text_with_glow(
            img, (w // 2 - w1 // 2, closing_y), closing_1,
            font_closing, (*accent, 220), (*accent, 60), glow_radius=8,
        )

        bbox_2 = draw.textbbox((0, 0), closing_2, font=font_closing)
        w2 = bbox_2[2] - bbox_2[0]
        draw = ImageDraw.Draw(img)
        draw.text(
            (w // 2 - w2 // 2, closing_y + 64), closing_2,  # Consistent closing line gap
            fill=(*accent, 120), font=font_closing,
        )

        # Very gentle vignette
        vignette = self._create_vignette(w, h, intensity=0.35)
        img.alpha_composite(vignette)

        # Accent bars — width 10, double-line effect
        draw = ImageDraw.Draw(img)
        draw.rectangle([(0, 0), (w, 10)], fill=(*accent, 255))
        draw.rectangle([(0, 12), (w, 14)], fill=(*accent, 80))
        draw.rectangle([(0, h - 10), (w, h)], fill=(*accent, 255))
        draw.rectangle([(0, h - 14), (w, h - 12)], fill=(*accent, 80))

        self._draw_story_footer(draw, accent)

        return self._image_to_jpeg(img.convert("RGB"))

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

    @staticmethod
    async def _download_image_safe(url: str) -> bytes | None:
        """Download image, returning None on failure (graceful fallback for stories)."""
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.content
        except Exception:
            logger.warning("Story asset download failed (non-fatal)", extra={
                "source_url": url[:200],
                "stage": "story_asset_download",
            })
            return None
