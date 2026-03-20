---
title: "Pillow Story Template Design Guide"
version: "1.0"
type: guide
status: active
lang: en
---

# Pillow Instagram Story Template Design Guide

Technical reference for the cinematic story template pipeline in `instagram_image_composer.py`. Read this before modifying any story template.

## Canvas & Safe Zones

- **Canvas**: 1080x1920 (9:16 vertical)
- **Top safe zone**: Y=0-160 (status bar, notch)
- **Content zone**: Y=160-1200 (main content)
- **Instagram UI zone**: Y=1200-1920 (send message bar, swipe up, home indicator)
- **Footer**: Y=1840 (BUREAU watermark, AI disclosure)

Instagram overlays its UI on the bottom ~250px. Content ending at Y=1200 is intentional, not "dead space."

## Design Grid

- **Base unit**: 24px. All vertical spacings are multiples of 24.
- **Title Y**: 252 across ALL templates (consistent tap-through experience)
- **Title panel Y**: 240, height 160px (2-line Detection/Impact) or 96px (single-line others)
- **Left margins**: panels x=48, text x=60, indented x=72
- **Accent bars**: 10px primary + 2px secondary at alpha 80 (top and bottom)

## Font Size Reference (monospace on 1080px canvas)

| Element | Size | Font | Notes |
|---------|------|------|-------|
| Title (Detection 2-line) | 60px | bold | Accent color, glow + stroke |
| Title (single-line) | 60px | bold | Accent color, glow + stroke |
| Title (Impact sim name) | 56px | bold | Sim color, glow + stroke, 2-line |
| Body/info text | 48px | regular | With stroke on important elements |
| Small labels | 36px | regular | Status text, event counts |
| Dispatch/body text | 36px | regular | Classification dispatch |
| Agent names | 30px | regular | Under portraits, with stroke |
| Reaction quotes | 52px | italic | 1 prominent quote in dark card |
| Reaction attribution | 36px | regular | Accent color |
| Closing lines | 52px | italic | Centered, glow + stroke |
| Stat numbers | 140px | bold | Accent color, glow |
| Stat labels | 36px | regular | Centered under numbers |
| Classification badge | 28px | regular | In rounded rect badge |
| Footer watermark | 20px | regular | Gray, bottom of canvas |
| Magnitude value | 96px | bold | Centered in gauge |
| Directive text | 44px | italic | Below gauge |
| Threat assessment | 32px | regular | Accent color, centered |
| CTA text | 56px | bold | Glow effect |
| Effectiveness labels | 32px | regular | Column sub-labels |

## Pillow Techniques Used

### Text Rendering
- **`stroke_width` + `stroke_fill`** (Pillow 6.2+): Crisp dark outlines around text. Use `stroke_width=2, stroke_fill=(0,0,0,180)` for glowing titles, `stroke_width=1, stroke_fill=(0,0,0,100-120)` for body text. Massively improves readability over any background.
- **`_text_with_glow`**: Renders text on a cropped RGBA layer, applies GaussianBlur, composites as glow shadow, then draws crisp text with stroke on top. Uses bbox-sized layers (not full canvas) for memory efficiency.

### Anti-Aliasing
- **Portrait circles**: 4x supersampled mask (`size*4` ellipse, downscale with LANCZOS). Produces smooth edges without jagged pixels.
- **`rounded_rectangle`**: Pillow's built-in has pixelated corners. NOT supersampled (would require separate layer + mask). Acceptable at 1080px since panels are subtle.
- **Font rendering**: Pillow uses FreeType with built-in anti-aliasing. TrueType fonts render smoothly at all sizes.

### Visual Effects
- **Gradients**: NumPy `linspace` per channel → RGBA `Image.fromarray`. Top color → bottom color.
- **Vignette**: NumPy radial distance from center → alpha mask. Intensity 0.35-0.5.
- **Film grain**: NumPy Gaussian noise (`default_rng().normal`), scaled by opacity, added to RGB channels.
- **Scan lines**: RGBA overlay with horizontal lines at accent color, alpha 12-33. Composited via `alpha_composite`.
- **Bokeh dots**: Random semi-transparent circles (seeded RNG), GaussianBlur(30). Adds atmospheric depth to gradient backgrounds.
- **Text glow**: Separate RGBA layer → GaussianBlur → `alpha_composite`. Cropped to text bbox + padding for efficiency.

### Compositing
- **All templates use RGBA mode** internally. Convert to RGB only at final JPEG output.
- **`alpha_composite`** for proper blending (NOT `draw.rectangle` with alpha fill — that REPLACES pixels instead of blending).
- **Panel fills**: Use `fill=(0, 0, 0, 40)` (dark tint), NOT `fill=(255, 255, 255, 8)` (white tint creates bright artifacts due to pixel replacement).
- **Layer order**: gradient → bokeh → noise → scan lines → panels → text → vignette → accent bars → footer.

### Image Processing (Impact hero slide)
- **Banner**: `ImageOps.fit` to 1080x1920 → `ImageEnhance.Brightness(0.25)` → `GaussianBlur(30)` → convert RGBA.
- **Gradient overlay**: Transparent top → black bottom (alpha 220) for text readability.
- **Portraits**: Downloaded as bytes → `_crop_to_circle` (4x AA mask + glow ring via blurred ellipse outline) → `alpha_composite` onto canvas.

## Font Loading
- **Cached** with `@lru_cache(maxsize=16-32)` — avoids filesystem probing on every call.
- **Fallback chain**: DejaVu Sans Mono (Linux) → Menlo (macOS) → Pillow default.
- Three variants: regular (`_load_monospace_font`), bold (`_load_bold_font`), italic (`_load_italic_font`).

## Archetype Visual Identity

Each archetype has a unique geometric glyph drawn with Pillow primitives:
- **The Tower**: Diamond (rotated square) with inner diamond
- **The Shadow**: Half-filled circle
- **The Devouring Mother**: Circle with inner filled circle
- **The Deluge**: Three horizontal wavy lines (sin curve)
- **The Overthrow**: X in circle
- **The Prometheus**: Sun (circle + 8 radiating lines)
- **The Awakening**: Three concentric circles
- **The Entropy**: Circle with diagonal slash

Colors from `ARCHETYPE_COLORS` dict in `models/social_story.py`.

## Common Pitfalls

1. **ImageDraw on RGBA replaces pixels** — don't draw semi-transparent fills directly. Use separate layers + `alpha_composite`.
2. **`textbbox` returns offset** — font metrics include ascent/descent. Center text using `(bbox[0]+bbox[2])//2` not just `tw//2`.
3. **Monospace font width** — at size N, each character is roughly `0.6*N` pixels wide. Plan line widths accordingly.
4. **GaussianBlur on full canvas** — expensive (~8MB per 1080x1920 RGBA layer). `_text_with_glow` uses cropped layers instead.
5. **JPEG doesn't support alpha** — always `.convert("RGB")` before `_image_to_jpeg`.
6. **Portrait downloads may fail** — always handle `None` returns from `_download_image_safe`. Fall back to text-only layout.
