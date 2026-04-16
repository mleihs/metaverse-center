"""Instagram image compositing — visual primitives and constants.

Pure Pillow utilities with no business logic or Supabase dependency.
Extracted from instagram_image_service.py during god-class decomposition.
"""

from __future__ import annotations

import io
import math
from functools import lru_cache
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from PIL.Image import Image as PILImage

# ── Instagram image specs ─────────────────────────────────────────────────

IG_WIDTH = 1080
IG_HEIGHT_PORTRAIT = 1350  # 4:5 ratio — highest engagement
IG_HEIGHT_STORY = 1920  # 9:16 ratio — Stories
IG_HEIGHT_SQUARE = 1080  # 1:1 fallback
IG_JPEG_QUALITY = 90
IG_MAX_BYTES = 8 * 1024 * 1024  # 8MB

# ── Bureau visual identity ────────────────────────────────────────────────

BUREAU_HEADER_HEIGHT = 80
BUREAU_FOOTER_HEIGHT = 40

# Feed post zone layout (zone-based composition, not overlay).
# The header and footer are OPAQUE ZONES — the portrait image is resized
# to fill the CONTENT ZONE only, never behind the header/footer.
# This eliminates the head-clipping problem entirely.
#
# Layout (1080×1350):
#   [0..6]     Accent bar (simulation primary color)
#   [6..170]   Header zone (classification badge + title + subtitle)
#   [170..1290] Content zone (portrait image, smart-cropped)
#   [1290..1350] Footer zone (watermark + AI disclosure)
FEED_HEADER_HEIGHT = 170  # Badge (36) + gap (12) + title (44) + gap (8) + subtitle (30) + padding
FEED_FOOTER_HEIGHT = 60   # Watermark + AI disclosure + accent bar
FEED_CONTENT_HEIGHT = IG_HEIGHT_PORTRAIT - FEED_HEADER_HEIGHT - FEED_FOOTER_HEIGHT  # 1120px
BUREAU_WATERMARK_TEXT = "BUREAU OF IMPOSSIBLE GEOGRAPHY — [REDACTED]"
CLASSIFICATION_LEVELS = ("PUBLIC", "AMBER", "RESTRICTED")

# ── Story template layout constants ───────────────────────────────────────

STORY_HEADER_Y = 260  # Main content starts below top safe area
STORY_FOOTER_Y = 1720  # Instagram-safe: above "Send message" bar (~180px from bottom)
STORY_LINE_HEIGHT = 48  # Line spacing for body text
STORY_SCANLINE_ALPHA = 18  # Scan line overlay opacity (~7%) — not used directly; templates pass explicit alpha
STORY_SAFE_TOP = 230  # Instagram-safe: below username bar + progress dots (~220px)
STORY_CLOSING_MIN_Y = 1100  # Earliest Y for poetic closing line (adjusted for new footer)
STORY_CLOSING_MAX_Y = 1580  # Latest Y (before footer)
STORY_TITLE_Y = 300  # Title panel top (STORY_SAFE_TOP + 70px for classification badge)

# ── Story Design Tokens ──────────────────────────────────────────────────
# Derived design system: all tokens trace back to BASE_UNIT (grid), TYPE_SCALE
# (Major Third), and BASE_FONT_SIZE (body anchor). Change a base value and the
# entire hierarchy recalculates. Grouped: Base → Typography → Spacing → Layout
# → Component.

# ─── Layer 1: Base ───────────────────────────────────────────────────────
BASE_UNIT = 12                                            # Grid unit (px)
TYPE_SCALE = 1.375                                        # Major Third ratio
BASE_FONT_SIZE = 32                                       # Body text anchor (px)
_LINE_LEADING = 8                                         # Standard line leading
_FEED_STEP = BASE_UNIT // 3                               # 4 — feed/story font offset

# ─── Layer 2: Typography ─────────────────────────────────────────────────
# Hierarchy: 4 scale levels + 3 special-purpose sizes
FONT_H1 = round(BASE_FONT_SIZE * TYPE_SCALE ** 2)        # 60 — titles
FONT_H2 = round(BASE_FONT_SIZE * TYPE_SCALE)             # 44 — fields, labels, directives
FONT_BODY = BASE_FONT_SIZE                                # 32 — body content, descriptions
FONT_CAPTION = BASE_UNIT * 2                              # 24 — badges, meta, footer (grid-aligned)
FONT_STAT = 140                                           # Subsiding large stat numbers
FONT_MAGNITUDE = 72                                       # Gauge value display
FONT_CTA = 52                                             # "Deploy accordingly" call-to-action

# Line heights = font size + leading (tighter leading for H1)
LINE_HEIGHT_H1 = FONT_H1 + _LINE_LEADING // 2            # 64
LINE_HEIGHT_H2 = FONT_H2 + _LINE_LEADING                 # 52
LINE_HEIGHT_BODY = FONT_BODY + _LINE_LEADING              # 40
LINE_HEIGHT_CAPTION = FONT_CAPTION + _LINE_LEADING        # 32

# Feed fonts — scaled from story hierarchy for 4:5 canvas
FONT_FEED_TITLE = FONT_BODY + _FEED_STEP                 # 36 — feed post title
FONT_FEED_BADGE = FONT_CAPTION + _FEED_STEP              # 28 — feed classification badge
FONT_FEED_SEAL = FONT_CAPTION - _FEED_STEP               # 20 — feed seal / cipher
FONT_FEED_FOOTER = FONT_CAPTION - _FEED_STEP * 2         # 16 — feed footer (smallest readable)

# ─── Layer 3: Spacing ────────────────────────────────────────────────────
# Multiples of BASE_UNIT for consistent vertical rhythm
SPACING_XS = BASE_UNIT                                    # 12 — tight inline
SPACING_SM = BASE_UNIT * 2                                # 24 — standard gap
SPACING_MD = BASE_UNIT * 4                                # 48 — section divider
SPACING_LG = BASE_UNIT * 6                                # 72 — major section
SPACING_XL = BASE_UNIT * 8                                # 96 — between major zones

# ─── Layer 4: Layout ─────────────────────────────────────────────────────
# Margins
MARGIN_PAGE = BASE_UNIT * 5                               # 60 — text left margin from edge
MARGIN_PANEL = SPACING_MD                                 # 48 — panel left/right from edge
MARGIN_INDENT = SPACING_LG                                # 72 — indented text (dispatch bar)

# Panel radii
PANEL_RADIUS = BASE_UNIT                                  # 12 — standard rounded corners
PANEL_RADIUS_SM = PANEL_RADIUS * 2 // 3                   # 8 — compact panels (quote cards)
BADGE_RADIUS = PANEL_RADIUS // 2                          # 6 — classification badges

# Dividers
DIVIDER_WEIGHT = 2                                        # Primary divider line width
DIVIDER_WEIGHT_SM = 1                                     # Secondary/subtle divider

# Gauge
GAUGE_RADIUS = 160                                        # Magnitude gauge circle radius
GAUGE_STROKE = 22                                         # Gauge arc line width

# ─── Layer 5: Component ──────────────────────────────────────────────────
# Panel heights (derived from typography + spacing)
TITLE_PANEL_HEIGHT = 2 * LINE_HEIGHT_H1 + FONT_BODY      # 160 — title panel
IMPACT_PANEL_HEIGHT = TITLE_PANEL_HEIGHT + SPACING_MD + DIVIDER_WEIGHT  # 210

# Gauge layout
GAUGE_BG_RADIUS = GAUGE_RADIUS + 20                       # 180 — dark circle behind arc
GAUGE_MIN_Y = IG_HEIGHT_STORY // 2 - 20                   # 940 — above canvas center

# Stats
STATS_PANEL_WIDTH = 280                                   # Half-width of subsiding stats panel
STATS_LABEL_OFFSET = FONT_STAT + 5                        # 145 — Y offset from stat to label

# Operatives and portraits
OPERATIVE_ICON_SIZE = FONT_H2 + SPACING_XS                # 56 — chess symbol spacing
PORTRAIT_SIZE = 220                                       # Agent portrait circle diameter
DIVIDER_INSET = 200                                       # Inset for centered divider lines

# Atmospheric filler
FILLER_MIN_GAP = 300                                      # Minimum gap (px) to activate filler

# Watermark
WATERMARK_SYMBOL_Y = STORY_TITLE_Y + 15 * BASE_UNIT      # 480 — below title zone
WATERMARK_SYMBOL_SIZE = 380                               # Archetype watermark diameter

# Badge padding
BADGE_PAD_X = 16                                          # Badge horizontal padding
BADGE_PAD_Y = 10                                          # Badge vertical padding

# ── Operative type symbols for advisory template ──────────────────────────

OPERATIVE_SYMBOLS: dict[str, str] = {
    "Saboteur": "\u265c",  # ♜
    "Infiltrator": "\u265e",  # ♞
    "Spy": "\u265d",  # ♝
    "Propagandist": "\u265b",  # ♛
    "Assassin": "\u265a",  # ♚
}

# ── Font search paths — Linux deployment targets first, then macOS fallback ─

_MONO_FONT_PATHS = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",  # Debian/Ubuntu
    "/usr/share/fonts/dejavu-sans-mono-fonts/DejaVuSansMono.ttf",  # Fedora/RHEL
    "/System/Library/Fonts/Menlo.ttc",  # macOS
)
_BOLD_FONT_PATHS = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    "/usr/share/fonts/dejavu-sans-mono-fonts/DejaVuSansMono-Bold.ttf",
    "/System/Library/Fonts/Menlo.ttc",
)
_ITALIC_FONT_PATHS = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Oblique.ttf",
    "/usr/share/fonts/dejavu-sans-mono-fonts/DejaVuSansMono-Oblique.ttf",
    "/System/Library/Fonts/Menlo.ttc",
)


# ── Font loaders (cached) ────────────────────────────────────────────────


@lru_cache(maxsize=32)
def load_monospace_font(size: int):
    """Load a monospace font with cross-platform fallback.

    Tries common Linux paths first (deployment target), then macOS,
    then falls back to Pillow's built-in default font.
    Cached — font objects are reused across compose calls.
    """
    from PIL import ImageFont

    for path in _MONO_FONT_PATHS:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


@lru_cache(maxsize=16)
def load_bold_font(size: int):
    """Load a bold monospace font with cross-platform fallback (cached)."""
    from PIL import ImageFont

    for path in _BOLD_FONT_PATHS:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return load_monospace_font(size)


@lru_cache(maxsize=16)
def load_italic_font(size: int):
    """Load an oblique/italic monospace font with cross-platform fallback (cached)."""
    from PIL import ImageFont

    for path in _ITALIC_FONT_PATHS:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return load_monospace_font(size)


# ── Color utilities ───────────────────────────────────────────────────────


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert hex color string to RGB tuple."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        return (226, 232, 240)  # default slate-200
    return (
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16),
    )


# ── Image conversion ─────────────────────────────────────────────────────


def image_to_jpeg(img: PILImage) -> bytes:
    """Convert PIL Image to JPEG bytes with RGBA safety."""
    from PIL import Image

    # R14: safe RGBA->RGB conversion (composite onto black background)
    if img.mode == "RGBA":
        bg = Image.new("RGB", img.size, (0, 0, 0))
        bg.paste(img, mask=img.split()[3])
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    output = io.BytesIO()
    img.save(output, format="JPEG", quality=IG_JPEG_QUALITY, optimize=True, progressive=True)
    result = output.getvalue()

    # If over 8MB, reduce quality
    if len(result) > IG_MAX_BYTES:
        output = io.BytesIO()
        img.save(output, format="JPEG", quality=75, optimize=True, progressive=True)
        result = output.getvalue()

    return result


def generate_solid_background(hex_color: str) -> bytes:
    """Generate a solid-color background image for text-only dispatches."""
    try:
        from PIL import Image
    except ImportError as exc:
        raise ImportError("Pillow is required for image composition") from exc

    rgb = hex_to_rgb(hex_color)
    img = Image.new("RGB", (IG_WIDTH, IG_HEIGHT_PORTRAIT), rgb)
    output = io.BytesIO()
    img.save(output, format="PNG")
    return output.getvalue()


# ── Gradient / texture helpers ────────────────────────────────────────────


def create_gradient(
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


def create_vignette(w: int, h: int, intensity: float = 0.7) -> PILImage:
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


def add_noise_grain(
    img: PILImage,
    sigma: int = 15,
    opacity: float = 0.08,
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


def add_bokeh_dots(
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


# ── Text rendering ────────────────────────────────────────────────────────


def text_with_glow(
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
        position,
        text,
        fill=fill,
        font=font,
        stroke_width=2,
        stroke_fill=(0, 0, 0, 180),
    )


def draw_scan_lines_rgba(
    img: PILImage,
    accent: tuple[int, int, int],
    *,
    spacing: int = 4,
    alpha: int = STORY_SCANLINE_ALPHA,
) -> None:
    """Draw scan lines via alpha compositing (correct for RGBA images).

    Uses NumPy array slicing instead of per-line draw calls for performance.
    """
    import numpy as np
    from PIL import Image

    arr = np.zeros((img.height, img.width, 4), dtype=np.uint8)
    arr[::spacing, :] = (*accent, alpha)
    overlay = Image.fromarray(arr, "RGBA")
    img.alpha_composite(overlay)


# ── Film Processing Effects ──────────────────────────────────────────────


def chromatic_aberration(
    img: PILImage,
    offset_r: tuple[int, int] = (2, 1),
    offset_b: tuple[int, int] = (-2, -1),
) -> PILImage:
    """Subtle RGB channel separation -- surveillance camera / analog glitch.

    Shifts red channel in one direction and blue in the opposite,
    leaving green anchored. Creates the look of misaligned CRT phosphors
    or cheap security camera optics.

    Default offset (2,1) / (-2,-1) is barely perceptible at 1080px --
    visible only at edges of high-contrast text and borders.
    """
    from PIL import Image, ImageChops

    if img.mode == "RGBA":
        r, g, b, a = img.split()
        r = ImageChops.offset(r, *offset_r)
        b = ImageChops.offset(b, *offset_b)
        return Image.merge("RGBA", (r, g, b, a))

    r, g, b = img.split()
    r = ImageChops.offset(r, *offset_r)
    b = ImageChops.offset(b, *offset_b)
    return Image.merge("RGB", (r, g, b))


def bleach_bypass(
    img: PILImage,
    desaturation: float = 0.6,
    contrast_boost: float = 1.3,
    highlight_rolloff: float = 0.88,
) -> PILImage:
    """Bleach bypass film emulation -- desaturated, high-contrast, metallic.

    Simulates skipping the bleach step in photochemical processing:
    partial desaturation + contrast boost + highlight compression + cold shadows.
    Referenced in the FLUX prompts as the core Bureau color grading.

    Parameters tuned conservatively for social media (not full cinematic):
    - desaturation 0.6 keeps enough color to distinguish archetype accents
    - contrast 1.3 adds punch without crushing shadows
    - highlight_rolloff 0.88 prevents blown-out whites
    """
    import numpy as np
    from PIL import Image, ImageEnhance

    # Work in RGB for ImageEnhance
    work = img.convert("RGB") if img.mode != "RGB" else img.copy()

    # Step 1: Partial desaturation (0.0 = grayscale, 1.0 = full color)
    work = ImageEnhance.Color(work).enhance(desaturation)

    # Step 2: Contrast boost
    work = ImageEnhance.Contrast(work).enhance(contrast_boost)

    # Step 3: Highlight rolloff + cold shadow tint (NumPy)
    arr = np.array(work).astype(np.float32) / 255.0

    # Compress highlights above rolloff threshold
    arr = np.where(
        arr > highlight_rolloff,
        highlight_rolloff + (arr - highlight_rolloff) * 0.3,
        arr,
    )

    # Subtle blue-channel lift in shadows (cold institutional tone)
    shadow_mask = arr.mean(axis=2, keepdims=True) < 0.25
    arr[:, :, 2] = np.where(shadow_mask[:, :, 0], arr[:, :, 2] + 0.025, arr[:, :, 2])

    arr = np.clip(arr * 255, 0, 255).astype(np.uint8)
    result = Image.fromarray(arr, "RGB")

    # Preserve alpha if input was RGBA
    if img.mode == "RGBA":
        result = result.convert("RGBA")
        result.putalpha(img.split()[3])

    return result


# ── Geometric drawing ─────────────────────────────────────────────────────


def draw_archetype_symbol(
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
            outline=color,
            width=lw,
        )
        r2 = r // 2
        draw.polygon(
            [(cx, cy - r2), (cx + r2, cy), (cx, cy + r2), (cx - r2, cy)],
            outline=color,
            width=lw,
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
            fill=color,
            width=lw + 1,
        )
        draw.line(
            [(cx + offset, cy - offset), (cx - offset, cy + offset)],
            fill=color,
            width=lw + 1,
        )

    elif archetype == "The Prometheus":
        # Sun: circle with 8 radiating lines
        r_inner = r // 2
        draw.ellipse(
            (cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner),
            outline=color,
            width=lw,
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
            fill=color,
            width=lw + 2,
        )

    else:
        # Fallback: simple circle
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=color, width=lw)


def draw_magnitude_arc(
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


def draw_corner_brackets(
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


def draw_accent_bars(
    draw,
    w: int,
    h: int,
    color: tuple[int, int, int],
) -> None:
    """Draw accent bars at top and bottom edges with double-line effect."""
    draw.rectangle([(0, 0), (w, 10)], fill=(*color, 255))
    draw.rectangle([(0, 12), (w, 14)], fill=(*color, 80))
    draw.rectangle([(0, h - 10), (w, h)], fill=(*color, 255))
    draw.rectangle([(0, h - 14), (w, h - 12)], fill=(*color, 80))


def draw_story_footer(
    draw,
    accent: tuple[int, int, int],
) -> None:
    """Draw Bureau watermark footer for Stories."""
    font_wm = load_monospace_font(FONT_CAPTION)
    draw.text(
        (MARGIN_PAGE, STORY_FOOTER_Y),
        BUREAU_WATERMARK_TEXT,
        fill=(80, 80, 80),
        font=font_wm,
    )
    draw.text(
        (MARGIN_PAGE, STORY_FOOTER_Y + FONT_CAPTION),
        "AI-generated content",
        fill=(60, 60, 60),
        font=font_wm,
    )


def draw_atmospheric_filler(
    img: PILImage,
    y_start: int,
    y_end: int,
    accent: tuple[int, int, int],
    archetype: str = "",
) -> None:
    """Render decorative Bureau-themed content in empty story gaps.

    Only activates when the gap exceeds 400px. Draws:
    - A large, very faint archetype symbol centered in the gap
    - Horizontal dashed lines at regular intervals
    - A small "BUREAU MONITORING" label centered in the gap
    """
    from PIL import ImageDraw

    gap = y_end - y_start
    if gap <= FILLER_MIN_GAP:
        return

    draw = ImageDraw.Draw(img)
    w = img.width
    mid_y = y_start + gap // 2

    # Adaptive opacity: dark accents (purple, blue) get a boost; bright ones stay subtle
    _lum = 0.299 * accent[0] + 0.587 * accent[1] + 0.114 * accent[2]
    _dark_boost = max(0, 140 - _lum) * 0.5  # 0 for bright (lum≥140), up to ~25 for dark
    _filler_alpha = round(25 + _dark_boost)  # 25 bright, ~45 dark

    # 1. Large faint archetype symbol centered in the gap
    symbol_alpha = _filler_alpha
    symbol_size = min(280, gap - 120)
    if symbol_size > 80 and archetype:
        draw_archetype_symbol(
            draw, w // 2, mid_y - 20, symbol_size, archetype,
            (*accent, symbol_alpha),
        )

    # 2. Horizontal dashed lines at regular intervals
    dash_alpha = max(15, _filler_alpha // 2)
    dash_color = (*accent, dash_alpha)
    dash_len = 20
    dash_gap = 16
    for line_y in range(y_start + 60, y_end - 60, 120):
        x = MARGIN_PAGE * 2
        while x < w - MARGIN_PAGE * 2:
            draw.line(
                [(x, line_y), (min(x + dash_len, w - MARGIN_PAGE * 2), line_y)],
                fill=dash_color, width=1,
            )
            x += dash_len + dash_gap

    # 3. Small centered "BUREAU MONITORING" label
    label_font = load_monospace_font(FONT_CAPTION)
    label_text = "SIGNAL ACTIVE"
    label_bbox = draw.textbbox((0, 0), label_text, font=label_font)
    label_w = label_bbox[2] - label_bbox[0]
    draw.text(
        (w // 2 - label_w // 2, mid_y + symbol_size // 2 + 30 if symbol_size > 80 else mid_y),
        label_text,
        fill=(*accent, min(80, round(_filler_alpha * 1.4))),
        font=label_font,
    )


# ── Image cropping ────────────────────────────────────────────────────────


def crop_to_circle(
    img_bytes: bytes,
    size: int,
    border_color: tuple[int, int, int],
    border_width: int = 4,
) -> PILImage | None:
    """Crop image bytes to anti-aliased circle with colored glow border ring."""
    import httpx
    from PIL import Image, ImageDraw, ImageFilter, ImageOps
    from postgrest.exceptions import APIError as PostgrestAPIError

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
            outline=(*border_color, 200),
            width=border_width + 6,
        )
        glow = glow.filter(ImageFilter.GaussianBlur(radius=10))
        result.alpha_composite(glow)

        # Crisp border ring
        ImageDraw.Draw(result).ellipse(
            (0, 0, total - 1, total - 1),
            outline=(*border_color, 255),
            width=border_width,
        )

        # Paste portrait in center
        result.paste(img, (border_width, border_width), img)
        return result

    except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError, OSError):
        import logging

        logging.getLogger(__name__).warning("Portrait circle crop failed", exc_info=True)
        return None


# ── Text measurement / wrapping ───────────────────────────────────────────


@lru_cache(maxsize=1)
def get_text_measure_draw():
    """Return a cached ImageDraw for text measurement (avoids per-call allocation)."""
    from PIL import Image, ImageDraw

    temp = Image.new("RGB", (1, 1))
    return ImageDraw.Draw(temp)


def wrap_text(text: str, font, max_width: int) -> list[str]:
    """Word-wrap text to fit within max_width pixels."""
    draw = get_text_measure_draw()

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
