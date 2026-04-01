---
title: "Icon System Audit — Three-Tier Taxonomy & Targeted Improvements"
version: "1.0"
date: "2026-04-01"
type: concept
status: active
lang: en
tags: [design-system, icons, frontend, brutalist, accessibility, dungeon]
---

# Icon System Audit — Three-Tier Taxonomy & Targeted Improvements

> Perspectives: Senior Web Application Architect, Senior Game Designer, UX Accessibility Specialist, Military Interface Researcher
>
> Research basis: 18+ web searches, Phosphor Icons GitHub Issue #85 (legibility), WCAG SC 1.4.11 (non-text contrast), UX Movement solid vs outline study, MIL-STD-2525 warfighting symbology, Streamline Sharp brutalist design, pixelarticons retro terminal icons, game-icons.net RPG silhouettes

---

## Executive Summary

A deep investigation into whether professional icon libraries (Phosphor, Lucide, Heroicons) could improve metaverse.center's visual quality concluded that **migration is not recommended**. The current zero-dependency, single-file icon system is architecturally optimal. Instead, three targeted improvements maximize stylistic impact with minimal risk:

1. **Square linecaps** on all stroke icons (brutalist hardening)
2. **game-icons.net expansion** for dungeon action icons (visual consistency)
3. **Three-tier taxonomy documentation** (preventing style drift)

---

## Current State (Measured 2026-04-01)

| Metric | Value |
|--------|-------|
| Total icons defined | 125 |
| Actively used | 113 (90.4%) |
| Unused (dead weight) | 12 (9.6%) |
| Call sites across codebase | 772 |
| Importing components | 85+ |
| npm icon dependencies | 0 |
| File | `frontend/src/utils/icons.ts` (1,072 lines) |
| Pattern | `(size: number) => SVGTemplateResult` via Lit `svg` tag |

### Stroke Weight Distribution (Pre-Audit)

| Weight | Icon Count | Usage |
|--------|-----------|-------|
| 2.5px | 32 | Action icons (edit, trash, nav) |
| 2.0px | 53 | Standard icons |
| 1.8px | 5 | Bot personality icons only |
| 1.5px | 11 | Decorative/archetype icons |
| Fill (no stroke) | 14 | game-icons.net map nodes + brand |

---

## Research Findings

### 1. Phosphor Icons Thin Weight — REJECTED

**Hypothesis:** Phosphor Thin (1px stroke, 16x16 native grid) would create a military terminal readout aesthetic.

**Evidence against:**

- **Halation on dark backgrounds.** Light-colored pixels on dark backgrounds cause optical bloom. Amber (#f59e0b) is high-luminance and warm — a 1px stroke will shimmer and lose definition. This is physics, not opinion.

- **Phosphor maintainers acknowledge the problem.** GitHub Issue #85: icons "often fold to .5px at the 16px size" with inconsistent rendering across screens. Tobias Fried recommended the font implementation over SVG specifically because "fonts simply do better than SVG in this regard."

- **WCAG SC 1.4.11 warning.** "Due to anti-aliasing, particularly thin lines and shapes of non-text elements may be rendered by user agents with a much fainter color than the actual color defined in CSS." Guidance: avoid thin lines or use colors that exceed the 3:1 ratio to compensate.

- **Aesthetic mismatch.** Thin strokes evoke luxury/elegance (Linear, Notion). Military terminals use **filled geometric shapes** — MIL-STD-2525 specifies that "warfighter feedback indicates that filled symbols are preferred to allow readability for overlapping symbols."

- **Phosphor Light (1.5px) is functionally identical to current.** Switching from Tabler-style at 2.0px to Phosphor Light at 1.5px buys different path geometry, not a different visual system. Cost: rewriting 112 icons and 772 call sites. ROI: negative.

### 2. What Real Military Terminals Use

| System | Icon Style | Key Characteristic |
|--------|-----------|-------------------|
| AWACS radar (AN/APY-2) | Filled geometric shapes | Triangles, circles, squares |
| Submarine sonar (AN/BQQ-5) | Filled contact markers | Chevrons, circles, bars |
| Air traffic control (ARTS/STARS) | Alphanumeric blocks | Text + geometric leader lines |
| NATO symbology (MIL-STD-2525) | Filled rectangles + modifiers | Blue/red/green filled frames |
| 1980s amber terminals (VT100) | **No icons at all** | Text-only, box-drawing characters |

**Conclusion:** The most authentic approach is text symbols for terminal contexts and filled shapes for tactical displays — exactly what the current system already does.

### 3. Solid vs Outline Icon Recognition (UX Research)

UX Movement study: solid icons are faster to recognize, with the difference most pronounced "when icons were displayed in white against a black background." Filled shapes require fewer fixation points for the visual system to parse.

**Implication:** For the dungeon HUD (dark background, amber icons, time-pressured game context), filled game-icons.net silhouettes are measurably better than 2px stroke Tabler icons.

### 4. The Linecap Insight

All 125 icons use `stroke-linecap="round"` and `stroke-linejoin="round"`. Round caps create soft, friendly terminations. In the brutalist design vocabulary, this is equivalent to using `border-radius: 8px` on every element — it undermines the entire aesthetic.

Changing to `stroke-linecap="square"` and `stroke-linejoin="miter"` produces angular, industrial terminations that match:
- Courier New letterforms (the heading font)
- Zero-radius borders (the CSS convention)
- Military stencil lettering
- CRT pixel grid rendering

This is the single highest-impact aesthetic change in the icon system.

---

## 4-Perspective Verdict

### Architect

The `icons.ts` single-file pattern is architecturally optimal for 125 icons:
- Zero runtime dependency, zero supply chain risk
- Full attribute control (stroke, fill, viewBox)
- Type-safe via `IconKey` export
- Design token compatible (inherits `currentColor`)
- Tree-shakeable by Vite

Adding `@phosphor-icons/core` as npm dependency buys 36,864 SVG files for 112 actual needs — 330x overprovisioning.

### Game Designer

The three-tier visual hierarchy is intentional and serves immersion:
- **Platform chrome** (stroke) is invisible UI furniture — SHOULD be generic
- **Archetype icons** (custom) are lore objects carrying mythic weight — MUST be unique
- **Dungeon map nodes** (filled) are game pieces on a tactical board — MUST feel heavy and tactile

Replacing custom archetype icons with library equivalents strips them of narrative meaning. Replacing terminal Unicode symbols (◈ ▲ ◌ ◉) with polished SVGs trades authenticity for polish — the wrong tradeoff for a CRT terminal aesthetic.

### UX

- 2.0px stroke at 14-16px on dark backgrounds: good visibility, good recognition
- 1.0px stroke (Phosphor Thin): halation risk, subpixel blur on 1x displays, insufficient visual weight
- Filled icons for dungeon actions: faster recognition in game context (research-backed)
- Mixed visual languages (stroke chrome + filled game) is a feature: users naturally expect different treatment in a tactical game board vs navigation chrome

### Research

Adding icons to a "terminal aesthetic" is already a compromise — 1980s terminals were text-only. The current system strikes the right balance: text symbols in terminal output, filled shapes in tactical displays, stroke icons in admin/settings. Any migration toward a single uniform library would flatten this intentional diversity.

---

## Three-Tier Icon Taxonomy (Codified)

### Tier 1 — Platform Chrome (Stroke)

**Style:** Tabler-derived, 2.0px standard weight, 1.5px decorative weight, square linecaps, miter joins.
**ViewBox:** 0 0 24 24. **Rendering:** 14-20px.
**Color:** `stroke="currentColor"`, `fill="none"`.
**Usage:** Navigation, forms, admin controls, metadata labels, social features.
**Principle:** Generic and invisible. A trash icon should look like every other trash icon — instant recognition without personality.

### Tier 2 — Lore Objects (Custom)

**Style:** Hand-drawn, 1.5px weight, unique per archetype/concept.
**ViewBox:** 0 0 24 24. **Rendering:** 14-20px.
**Color:** `stroke="currentColor"`, `fill="none"` (or selective fill for emphasis).
**Usage:** Archetype symbols, resonance indicators, unique game concepts.
**Principle:** Narrative weight. These icons carry mythic meaning — never replace with library equivalents.

### Tier 3 — Game Pieces (Filled)

**Style:** game-icons.net silhouettes, CC BY 3.0.
**ViewBox:** 0 0 512 512. **Rendering:** 16-24px.
**Color:** `fill="currentColor"`, `stroke="none"`.
**Usage:** Dungeon map nodes, dungeon action buttons, tactical displays, loot tier markers.
**Principle:** RPG manual illustrations. Heavy, solid, tactile. Read as radar signatures or tactical object classifications on dark backgrounds.

### Terminal Output — Unicode (Preserved)

**Characters:** ◈ ▲ ◌ ◉ ♢ ⚔ ≈ ☉ █ ░ ═ │ ├ └ ◆ ★ ✦
**Usage:** Terminal text output, archetype labels in formatters, progress bars, box-drawing.
**Principle:** 1980s amber terminal authenticity. These are not "placeholder icons" — they are the aesthetic itself. Do not replace with SVG.

---

## Implementation Plan

### Phase 1: Square Linecaps (15 min)

Global find-and-replace in `frontend/src/utils/icons.ts`:
- `stroke-linecap="round"` → `stroke-linecap="square"`
- `stroke-linejoin="round"` → `stroke-linejoin="miter"`

Excludes: filled icons (game-icons.net, discordOAuth) which have no stroke attributes.

### Phase 2: game-icons.net Dungeon Actions (~1 hour)

Source 7 filled SVG paths from game-icons.net. Add as new icon functions alongside existing stroke versions (prefix with `gi` or replace the stroke versions if unused elsewhere):

| Icon Key | Source | game-icons.net Path |
|----------|--------|-------------------|
| `campfire` | lorc/campfire | Replace stroke version |
| `binoculars` | lorc/spyglass | Replace stroke version |
| `footprints` | lorc/boot-prints | Replace stroke version |
| `doorExit` | delapouite/exit-door | Replace stroke version |
| `handClick` | lorc/hand | Replace stroke version |
| `dungeonDepth` | delapouite/stairs-goal | Replace stroke version |
| `dungeonMap` | lorc/treasure-map | Replace stroke version |

### Phase 3: Normalize Stroke Widths (10 min)

Standardize from 4 values to 2:
- 2.5px → 2.0px (standard)
- 1.8px → 1.5px (decorative)
- 2.0px stays (standard)
- 1.5px stays (decorative)

### Phase 4: Remove 12 Unused Icons (5 min)

Delete: `binoculars` (stroke), `bomb`, `columns`, `crown`, `dagger`, `doorEnter`, `doorExit` (stroke), `flatline`, `handClick` (stroke), `heartline`, `imageReference`, `mask`.

### Phase 5: Documentation

Add "Icon System" section to `docs/guides/design-tokens.md` with the three-tier taxonomy above.

---

## What NOT to Do

| Don't | Why |
|-------|-----|
| Migrate to Phosphor Icons | Halation at 1px, WCAG risk, wrong aesthetic, negative ROI |
| Replace Unicode terminal symbols | They ARE the aesthetic, not placeholders |
| Add npm icon dependencies | Zero-dep pattern is architecturally superior |
| Replace custom archetype icons | Lore objects, not UI furniture |
| Use Lucide | Too rounded/friendly, "default everywhere" uniformity |
| Use Remix Icon | License changed from MIT to custom (Jan 2026) |

---

## Sources

### Icon Libraries
- [Phosphor Icons](https://phosphoricons.com/) — MIT, 1248 × 6 weights
- [Phosphor Issue #85: Thin at 16px](https://github.com/phosphor-icons/phosphor-home/issues/85)
- [Tabler Icons](https://tabler.io/icons) — MIT, 6092 icons
- [Lucide Icons](https://lucide.dev/) — ISC, 1648 icons
- [game-icons.net](https://game-icons.net/) — CC BY 3.0, 4170 filled icons
- [Pixelarticons](https://pixelarticons.com/) — MIT, 800 pixel-grid icons
- [Streamline Sharp](https://blog.streamlinehq.com/sharp/) — Proprietary, brutalist geometric
- [Heroicons](https://heroicons.com/) — MIT, 450 icons

### Research
- [WCAG SC 1.4.11: Non-text Contrast](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html)
- [UX Movement: Solid vs Outline Icons](https://uxmovement.com/mobile/solid-vs-outline-icons-which-are-faster-to-recognize/)
- [Viget: Hollow vs Solid Icon Research](https://www.viget.com/articles/are-hollow-icons-really-harder-to-recognize-a-research-study)
- [MIL-STD-2525: Warfighting Symbology](https://everyspec.com/MIL-STD/MIL-STD-2000-2999/MIL-STD-2525_20727/)
- [Dark Mode Halation Effects](https://inkbotdesign.com/dark-mode/)
- [NN/g: Neobrutalism Best Practices](https://www.nngroup.com/articles/neobrutalism/)
- [Terminal Aesthetic Article](https://medium.com/@phazeline/the-terminal-aesthetic-and-the-return-of-texture-to-the-web-ed37ee8183bd)
