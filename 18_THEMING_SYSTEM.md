# 18 — Per-Simulation Theming System

**Version:** v1.2
**Status:** Implemented — 6 Presets: default, brutalist, fantasy-kingdom, cyberpunk, steampunk, deep-space-horror. WCAG 2.1 AA validiert (88 Kontrast-Tests, 14 Paare pro Preset).

## Overview

Every simulation has its own visual identity derived from a shared base design system. The theming system overrides base CSS custom properties on the `<velg-simulation-shell>` host element, so all child components inherit themed values through Shadow DOM without any per-component changes.

```
Platform views (dashboard, profile)  →  :root tokens (always brutalist)
Simulation views (inside shell)      →  Overridden tokens on shell host
```

## Architecture: Base-Token Override at Shell Boundary

**Core principle:** CSS custom properties set on a parent element are inherited by all descendants, including through Shadow DOM boundaries. Setting `--color-primary: #0d7377` on `<velg-simulation-shell>` makes every component inside it use teal instead of black — without touching a single component file.

### Data Flow

1. User enters a simulation route (`/simulations/:id/*`)
2. `VelgSimulationShell.connectedCallback()` triggers `themeService.applySimulationTheme(simulationId, this)`
3. ThemeService loads `simulation_settings` (category=`design`) via API
4. Settings are mapped to CSS custom property overrides via `THEME_TOKEN_MAP`
5. Computed tokens (shadows, animation durations) are generated from `shadow_style` and `animation_speed`
6. All tokens are set as inline styles on the shell host element
7. CSS inheritance cascades to all children
8. On `disconnectedCallback()`, `themeService.resetTheme()` clears all overrides

### Key Files

| File | Role |
|------|------|
| `frontend/src/services/ThemeService.ts` | Core service: loads settings, maps to tokens, applies to DOM |
| `frontend/src/services/theme-presets.ts` | Preset definitions (brutalist, sunless-sea, etc.) |
| `frontend/src/types/validation/theme.ts` | Zod schema for theme config validation |
| `frontend/src/components/layout/SimulationShell.ts` | Theme lifecycle host (connectedCallback/disconnectedCallback) |
| `frontend/src/components/settings/DesignSettingsPanel.ts` | Admin UI for editing theme settings |

## Token Taxonomy

### Tier 1: Colors (21 tokens)

| Setting Key | Overrides Base Token | Purpose |
|---|---|---|
| `color_primary` | `--color-primary` | Primary action/brand color |
| `color_primary_hover` | `--color-primary-hover` | Primary hover state |
| `color_primary_active` | `--color-primary-active` | Primary active state |
| `color_secondary` | `--color-info` | Secondary/accent → info |
| `color_accent` | `--color-warning` | Accent → warning |
| `color_background` | `--color-surface` | Page background |
| `color_surface` | `--color-surface-raised` | Card/panel surface |
| `color_surface_sunken` | `--color-surface-sunken` | Inset/recessed areas |
| `color_surface_header` | `--color-surface-header` | Header backgrounds |
| `color_text` | `--color-text-primary` | Primary text |
| `color_text_secondary` | `--color-text-secondary` | Secondary text |
| `color_text_muted` | `--color-text-muted` | Muted/disabled text |
| `color_border` | `--color-border` | Primary borders |
| `color_border_light` | `--color-border-light` | Subtle dividers |
| `color_danger` | `--color-danger` | Error/danger |
| `color_success` | `--color-success` | Success |
| `color_primary_bg` | `--color-primary-bg` | Tinted bg for primary badges/selected states |
| `color_info_bg` | `--color-info-bg` | Tinted bg for info badges/gen buttons |
| `color_danger_bg` | `--color-danger-bg` | Tinted bg for error messages/danger alerts |
| `color_success_bg` | `--color-success-bg` | Tinted bg for success states |
| `color_warning_bg` | `--color-warning-bg` | Tinted bg for warning messages |

### Tier 2: Typography (7 tokens)

| Setting Key | Overrides Base Token | Purpose |
|---|---|---|
| `font_heading` | `--font-brutalist` | Heading font stack |
| `font_body` | `--font-sans` | Body text font stack |
| `font_mono` | `--font-mono` | Code/data font stack |
| `heading_weight` | `--heading-weight` | Heading font weight (400-900) |
| `heading_transform` | `--heading-transform` | uppercase / capitalize / none |
| `heading_tracking` | `--heading-tracking` | Heading letter spacing |
| `font_base_size` | `--text-base` | Base font size |

### Tier 3: Character (9 tokens — defines the "feel")

| Setting Key | Overrides Base Token | Purpose |
|---|---|---|
| `border_radius` | `--border-radius` | Global corner radius |
| `border_width` | `--border-width-thick` | Primary border thickness |
| `border_width_default` | `--border-width-default` | Secondary border thickness |
| `shadow_style` | Computed → `--shadow-*` (7 tokens) | offset / blur / glow / none |
| `shadow_color` | Used in shadow computation | Shadow tint color |
| `hover_effect` | UI-level preference | translate / scale / glow |
| `animation_speed` | Computed → `--duration-*` (4 tokens) | Speed multiplier (0.5–2.0) |
| `animation_easing` | `--ease-default` | CSS easing function |
| `text_inverse` | `--color-text-inverse` | Text on primary backgrounds |

### Computed Token Generation

**Shadow style** — `shadow_style` + `shadow_color` computes all shadow tokens:

| shadow_style | Generated `--shadow-md` example | Character |
|---|---|---|
| `offset` | `4px 4px 0 {color}` | Brutalist — hard edge |
| `blur` | `0 4px 12px {color}40` | Organic — soft, diffuse |
| `glow` | `0 0 12px {color}60, 0 0 4px {color}30` | Fantasy — luminous |
| `none` | `none` | Minimalist — flat |

**Animation speed** — multiplier applied to base duration tokens:

| Token | Base | ×0.7 | ×1.0 | ×1.5 |
|---|---|---|---|---|
| `--duration-fast` | 100ms | 70ms | 100ms | 150ms |
| `--duration-normal` | 200ms | 140ms | 200ms | 300ms |
| `--duration-slow` | 300ms | 210ms | 300ms | 450ms |
| `--duration-slower` | 500ms | 350ms | 500ms | 750ms |

## Theme Presets

Defined in `frontend/src/services/theme-presets.ts`. Each preset is a flat `Record<string, string>` of setting keys to values.

### Available Presets

| Preset | Character | Best For |
|---|---|---|
| **brutalist** | Black/white, monospace, hard shadows, uppercase | Default, industrial, dystopian |
| **sunless-sea** | Deep teal/cyan, serif headings, glow shadows, flowing | Gothic, underwater, fantasy |
| **solarpunk** | Warm greens, golden, rounded, blur shadows, bouncy | Utopian, nature, optimistic |
| **cyberpunk** | Neon orange/blue, condensed sans, glow, fast | Dystopian, tech, noir |
| **nordic-noir** | Muted grays, clean sans, blur shadows, subtle | Minimalist, detective, clinical |

### Creating a New Preset

1. Add the preset name to `ThemePresetName` union type
2. Add the full config to `THEME_PRESETS` record
3. Add the name to `PRESET_NAMES` array
4. Add a label translation in `getPresetLabels()` in DesignSettingsPanel
5. Optionally map a `SimulationTheme` to it in `getPresetForTheme()`

## DesignSettingsPanel

The admin UI (`velg-design-settings-panel`) provides:

1. **Preset Selector** — dropdown + "Apply Preset" button to load a complete preset
2. **Colors** — 21 color pickers with hex input and info bubbles (16 semantic + 5 tinted backgrounds)
3. **Typography** — 7 font/text fields with info bubbles
4. **Character** — border radius, border widths, shadow style/color, hover effect, text inverse
5. **Animation** — speed slider (0.5–2.0×), easing function dropdown
6. **Custom CSS** — textarea for raw CSS overrides (10KB max, sanitized)
7. **Live Preview** — rendered card, buttons, inputs, swatches using current values

Every field has an info bubble (ⓘ) tooltip explaining what it controls. All 37 settings are fully editable.

On save, changed settings are upserted to `simulation_settings` (category=`design`), and the theme is immediately re-applied to the shell.

## Contrast Requirements

All theme presets are validated by `frontend/tests/theme-contrast.test.ts` against WCAG 2.1 AA contrast ratios. The test encodes every foreground/background pair the UI actually renders.

### Minimum Ratios

| Category | Pairs Tested | Minimum Ratio | Rationale |
|---|---|---|---|
| **Normal text** | `color_text` / `color_text_secondary` on `color_surface` and `color_background` | **4.5:1** | WCAG AA for normal text |
| **Muted text** | `color_text_muted` on `color_surface` and `color_background` | **3.0:1** | Intentionally subtle; used for hints/placeholders |
| **Button text** | `text_inverse` on `color_primary` and `color_danger` | **3.0:1** | Bold uppercase, functionally large |
| **Badge text** | Semantic color on its `-bg` variant (5 pairs) | **3.0:1** | Bold, short labels |
| **Gen-button hover** | `color_background` on `color_secondary` | **3.0:1** | Inverted hover state |

### Key Mapping for Badge Pairs

Because `color_secondary` maps to `--color-info` and `color_accent` maps to `--color-warning`, the badge contrast pairs test:

| UI Pattern | Foreground (preset key) | Background (preset key) |
|---|---|---|
| Primary badge | `color_primary` | `color_primary_bg` |
| Info badge | `color_secondary` | `color_info_bg` |
| Warning badge | `color_accent` | `color_warning_bg` |
| Danger badge | `color_danger` | `color_danger_bg` |
| Success badge | `color_success` | `color_success_bg` |

### Rules for New Presets

When creating a new preset, ensure:

1. **Semantic colors must be functional.** `color_secondary` and `color_accent` are used as text on badges — they must contrast with their `-bg` at 3:1. Don't use pale/pastel values for these keys even if the aesthetic calls for subtlety.
2. **Dark themes need dark `-bg` tints.** If `color_background` is dark, all 5 `-bg` tokens must also be dark tints — not the light pastels from `:root`.
3. **`text_inverse` must work on both `color_primary` and `color_danger`.** It's used on solid-color buttons. For light themes, use a dark inverse; for dark themes, use a light inverse.
4. **`color_text_muted` must pass 3:1 on `color_surface`.** Muted text is subtle by design, but below 3:1 it becomes invisible.
5. **Run the contrast test** after any preset change: `npx vitest run tests/theme-contrast.test.ts`

## Storage

Theme settings are stored in the `simulation_settings` table:

```sql
simulation_settings (
  simulation_id  UUID,
  category       'design',
  setting_key    VARCHAR,    -- e.g. 'color_primary', 'shadow_style'
  setting_value  JSONB,      -- e.g. '"#0d7377"', '"glow"'
  updated_by_id  UUID
)
```

UNIQUE constraint on `(simulation_id, setting_key)`.

## Relationship to Base Token Files

The 8 token files in `frontend/src/styles/tokens/` define the base design system on `:root`. The theming system **never modifies these files**. It only overrides specific properties on the shell element, so:

- Platform views always use base tokens (brutalist)
- Simulations without design settings also use base tokens
- Only simulations with explicit design settings get themed
- The base token files remain the single source of truth for the default aesthetic
