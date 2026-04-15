---
title: "Pillow Story Template Design Guide"
version: "2.0"
type: guide
status: active
lang: en
date: 2026-04-15
---

# Pillow Instagram Story Template Design Guide

Technical reference for the cinematic story template pipeline. Read this before modifying any story template.

## Architecture (3-Module Decomposition)

| Module | Responsibility | LOC |
|--------|---------------|-----|
| `instagram_image_helpers.py` | Design tokens, Pillow primitives, visual effects | ~845 |
| `instagram_story_composer.py` | 5 story templates (`StoryComposer` class) | ~1360 |
| `instagram_image_service.py` | Feed post overlay, orchestration, Supabase I/O | ~600 |

- **Helpers** are pure functions with zero Supabase dependency
- **StoryComposer** is stateless — takes data, returns JPEG bytes
- **ImageService** is the only module with Supabase client dependency

## Canvas & Safe Zones

- **Canvas**: 1080x1920 (9:16 vertical, `IG_WIDTH` x `IG_HEIGHT_STORY`)
- **Top safe zone**: Y=0-230 (`STORY_SAFE_TOP`) — Instagram username bar + progress dots
- **Content zone**: Y=230-1720 — all templates render within this range
- **Title start**: Y=300 (`STORY_TITLE_Y`) — below badge, consistent across templates
- **Footer**: Y=1720 (`STORY_FOOTER_Y`) — Bureau watermark + AI disclosure
- **Instagram UI zone**: Y=1720-1920 — "Send message" bar, swipe up, home indicator

## Derived Design Token System

All 59 tokens derive from three base values. Change a base and the hierarchy recalculates.

### Base Constants

```python
BASE_UNIT = 12          # Grid unit (px)
TYPE_SCALE = 1.375      # Major Third ratio
BASE_FONT_SIZE = 32     # Body text anchor (px)
```

### Typography (derived from BASE_FONT_SIZE + TYPE_SCALE)

| Token | Derivation | Value | Usage |
|-------|-----------|-------|-------|
| `FONT_H1` | `round(BASE_FONT_SIZE * TYPE_SCALE ** 2)` | 60 | Titles |
| `FONT_H2` | `round(BASE_FONT_SIZE * TYPE_SCALE)` | 44 | Fields, labels, directives |
| `FONT_BODY` | `BASE_FONT_SIZE` | 32 | Body content, descriptions |
| `FONT_CAPTION` | `BASE_UNIT * 2` | 24 | Badges, meta, footer |
| `FONT_STAT` | explicit | 140 | Subsiding large stat numbers |
| `FONT_MAGNITUDE` | explicit | 72 | Gauge value display |
| `FONT_CTA` | explicit | 52 | "Deploy accordingly." CTA |

### Line Heights (font + leading)

```python
_LINE_LEADING = 8
LINE_HEIGHT_H1 = FONT_H1 + _LINE_LEADING // 2    # 64 (tighter for large text)
LINE_HEIGHT_H2 = FONT_H2 + _LINE_LEADING          # 52
LINE_HEIGHT_BODY = FONT_BODY + _LINE_LEADING       # 40
LINE_HEIGHT_CAPTION = FONT_CAPTION + _LINE_LEADING  # 32
```

### Spacing (multiples of BASE_UNIT)

| Token | Value | Usage |
|-------|-------|-------|
| `SPACING_XS` | 12 | Tight inline spacing |
| `SPACING_SM` | 24 | Standard element gap |
| `SPACING_MD` | 48 | Section divider gap |
| `SPACING_LG` | 72 | Major section gap |
| `SPACING_XL` | 96 | Between major zones |

### Layout Tokens

| Token | Derivation | Value |
|-------|-----------|-------|
| `MARGIN_PAGE` | `BASE_UNIT * 5` | 60 |
| `MARGIN_PANEL` | `SPACING_MD` | 48 |
| `MARGIN_INDENT` | `SPACING_LG` | 72 |
| `PANEL_RADIUS` | `BASE_UNIT` | 12 |
| `TITLE_PANEL_HEIGHT` | `2 * LINE_HEIGHT_H1 + FONT_BODY` | 160 |
| `STATS_LABEL_OFFSET` | `FONT_STAT + 5` | 145 |
| `GAUGE_MIN_Y` | `IG_HEIGHT_STORY // 2 - 20` | 940 |
| `FILLER_MIN_GAP` | explicit | 300 |

### Feed Fonts (scaled from story hierarchy)

```python
_FEED_STEP = BASE_UNIT // 3                    # 4
FONT_FEED_TITLE = FONT_BODY + _FEED_STEP       # 36
FONT_FEED_BADGE = FONT_CAPTION + _FEED_STEP    # 28
FONT_FEED_SEAL = FONT_CAPTION - _FEED_STEP     # 20
FONT_FEED_FOOTER = FONT_CAPTION - _FEED_STEP * 2  # 16
```

## Template Layer Order

Each story is composed back-to-front:

1. **Background** (solid, gradient, or blurred banner)
2. **Scan lines** (accent-colored horizontal lines, alpha 12-33)
3. **Film grain** (Gaussian noise, sigma 10-25, opacity 0.03-0.10)
4. **Bokeh dots** (Detection, Subsiding only: semi-transparent circles + blur)
5. **Watermark symbol** (Detection only: faint archetype glyph at Y=480)
6. **Corner brackets** (Classification only: L-shaped frame)
7. **Content** (panels, text, gauge, portraits, etc.)
8. **Atmospheric filler** (faint archetype symbol + dashes in empty zones)
9. **Vignette** (radial darkening, intensity 0.35-0.50)
10. **Accent bars** (10px colored bars + 2px ghost line, top and bottom)
11. **Footer** ("BUREAU OF IMPOSSIBLE GEOGRAPHY" + "AI-generated content")
12. **JPEG conversion** (RGBA to RGB on black, quality 90, fallback 75 if >8MB)

## 5 Story Templates

### Detection (SUBSTRATE ANOMALY DETECTED)
Gradient background, heavy grain, archetype watermark, magnitude gauge, threat assessment. Most dramatic template.

### Classification (BUREAU CLASSIFICATION)
Dark background, paper-grain texture, corner brackets, fields panel, dispatch text with accent bar (x=48, symmetric 12px brackets), closing line, filing reference.

### Impact (SHARD IMPACT)
Blurred simulation banner background (if available), portrait strip with glow rings, reaction quote card, narrative closing. Falls back to gradient.

### Advisory (OPERATIVE ADVISORY)
Two-column tactical briefing. Headers at FONT_H2 Bold, operative items at FONT_BODY. Chess piece symbols. Zone pressure text, "Deploy accordingly." CTA.

### Subsiding (SUBSTRATE STABILIZING)
Minimal, elegiac. Faint gradient, bokeh. Stats panel with asymmetric padding (12px top / 24px bottom to compensate font metrics). Closing lines. Monitoring text.

## Atmospheric Filler System

Activates when a gap exceeds `FILLER_MIN_GAP` (300px). Draws:
1. Faint archetype symbol (centered in gap)
2. Horizontal dashed lines (accent color)
3. "SIGNAL ACTIVE" label

**Luminance-adaptive opacity**: Dark accents (purple, blue) get higher alpha than bright accents (orange, yellow) to maintain visibility:

```python
_lum = 0.299 * R + 0.587 * G + 0.114 * B
_dark_boost = max(0, 140 - _lum) * 0.5
_filler_alpha = round(25 + _dark_boost)  # 25 bright, ~45 dark
```

## Film Processing Effects (Feed Posts Only)

- **Bleach bypass**: Partial desaturation (0.6), contrast boost (1.3), highlight rolloff (0.88), cold shadow tint. Applied in `_compose_with_overlay()`.
- **Chromatic aberration**: 2px RGB channel offset (red +2,+1 / blue -2,-1). Surveillance camera aesthetic.

NOT applied to story templates (stories have their own atmosphere via scan lines, grain, bokeh).

## Archetype Visual Identity

Each archetype has a unique geometric glyph in `draw_archetype_symbol()`:

| Archetype | Symbol | Description |
|-----------|--------|-------------|
| The Tower | Diamond | Rotated square with inner diamond |
| The Shadow | Half-circle | Left half solid-filled |
| The Devouring Mother | Target | Circle with inner filled circle |
| The Deluge | Waves | Three horizontal sinusoidal lines |
| The Overthrow | X-circle | X inside circle |
| The Prometheus | Sun | Circle with 8 radiating lines |
| The Awakening | Ripples | Three concentric circles |
| The Entropy | Prohibition | Circle with diagonal slash |

## Archetype Descriptions

Literary-quality descriptions in `backend/models/resonance.py` (`ARCHETYPE_DESCRIPTIONS`). Each mirrors its archetype's grammatical DNA:

- **Tower** (Kafka): "The foundation was a consensus. The consensus has left the building."
- **Shadow** (Büchner): "Something that was practicing stillness decides to stop practicing."
- **Entropy** (Beckett): "The room still contains distinctions. Walls, floor, ceiling. The categories are losing interest."

Used on Detection story cards (italic, accent color, 2-3 lines) and as AI prompt context.

## Font Loading

- **Cached** with `@lru_cache(maxsize=16-32)` in `instagram_image_helpers.py`
- **Fallback chain**: DejaVu Sans Mono (Linux) to Menlo (macOS) to Pillow default
- Three variants: `load_monospace_font`, `load_bold_font`, `load_italic_font`

## Test Infrastructure

- **101 unit tests** in `backend/tests/unit/test_instagram_image.py`
- **52-case stress test** via `scripts/generate_stress_test_graphics.py`
- **A/B gallery** via `scripts/generate_ab_80_gallery.py` (with/without bleach bypass)
- **Production image sync** via `scripts/sync_prod_images_to_local.py`

## Common Pitfalls

1. **ImageDraw on RGBA replaces pixels** — use separate layers + `alpha_composite` for semi-transparent fills.
2. **`textbbox` returns offset** — font metrics include ascent/descent. Center using `(bbox[0]+bbox[2])//2`.
3. **Font metrics asymmetry** — large fonts (FONT_STAT 140px) have significant ascent space above glyphs. Use asymmetric panel padding (smaller top, larger bottom) to achieve visual symmetry.
4. **GaussianBlur on full canvas** — expensive (~8MB for 1080x1920 RGBA). `text_with_glow` uses cropped layers.
5. **JPEG doesn't support alpha** — RGBA composited onto black background before JPEG output.
6. **Portrait downloads may fail** — always handle `None` from `crop_to_circle`. Fall back to text-only layout.
7. **Archetype name matching** — always use canonical "The X" names (not just "X"). Detection template has case-insensitive fallback but symbol rendering requires exact match.
