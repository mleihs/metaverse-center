# Design Tokens — Three-Tier Color Architecture

> Version 1.0 — 2026-03-18

## Overview

All colors in component CSS must reference semantic tokens, never raw `#hex` or `rgba()`. The token system has three tiers that auto-adapt when simulation themes change.

### Browser Support

The token system uses `color-mix(in srgb, ...)` extensively. Minimum browser requirements:
- Chrome 111+ / Edge 111+
- Safari 16.2+
- Firefox 113+

---

## Tier 1: Semantic Base Tokens

Defined in `frontend/src/styles/tokens/_colors.css` at `:root`. Overridden by `ThemeService` on the `<velg-simulation-shell>` element when a simulation theme is active.

### Status Colors
| Token | Default | Purpose |
|-------|---------|---------|
| `--color-primary` | `#f59e0b` | Primary action, brand |
| `--color-danger` | `#ef4444` | Errors, destructive |
| `--color-success` | `#22c55e` | Positive, healthy |
| `--color-warning` | `#f59e0b` | Caution |
| `--color-info` | `#3b82f6` | Informational |

### Text Colors
| Token | Default | Purpose |
|-------|---------|---------|
| `--color-text-primary` | `#e5e5e5` | Main body text |
| `--color-text-secondary` | `#a0a0a0` | Less prominent text |
| `--color-text-tertiary` | auto-derived | Timestamps, counters, meta |
| `--color-text-muted` | `#888888` | Placeholders, disabled |
| `--color-text-inverse` | `#0a0a0a` | Text on light backgrounds |
| `--color-icon` | auto-derived | Default icon fill |

### Surface Colors
| Token | Default | Purpose |
|-------|---------|---------|
| `--color-surface` | `#0a0a0a` | Main background |
| `--color-surface-raised` | `#111111` | Cards, panels |
| `--color-surface-sunken` | `#060606` | Inset areas |

### Border Colors
| Token | Default | Purpose |
|-------|---------|---------|
| `--color-border` | `#333333` | Standard borders |
| `--color-border-light` | `#222222` | Subtle borders |
| `--color-separator` | auto-derived | Lightest dividers |

---

## Tier 2: Auto-Derived Tokens

Generated automatically via `color-mix()` from Tier 1 base tokens. Defined in both `_colors.css` (`:root` defaults) and set by `ThemeService` on the shell element so they adapt to any theme.

For each status color (`primary`, `danger`, `success`, `warning`, `info`):

| Pattern | Formula | Use Case |
|---------|---------|----------|
| `--color-{status}-hover` | 80% base + 20% text-primary | Hover state |
| `--color-{status}-bg` | 8% base + 92% surface | Subtle background |
| `--color-{status}-border` | 30% base + 70% transparent | Container borders |
| `--color-{status}-glow` | 15% base + 85% transparent | Glow effects |

Additional:
| Token | Formula |
|-------|---------|
| `--color-primary-active` | 70% primary + 30% text-primary |
| `--color-text-tertiary` | 60% text-secondary + 40% text-muted |
| `--color-icon` | text-muted |
| `--color-separator` | 50% border + 50% transparent |

### CSS Cascade Rule (Critical)

`color-mix()` expressions at `:root` resolve using `:root`'s own values. When ThemeService overrides base tokens on the shell element, `:root`-level derivations do NOT update automatically.

**Solution**: ThemeService sets derived tokens directly on the shell element alongside base overrides. The `color-mix()` expressions on the shell resolve using the shell's overridden base values.

This is handled automatically in `ThemeService.applyConfig()`.

---

## Tier 3: Component-Local Variables

For colors unique to a single component, define `--_*` prefixed variables in the `:host` block using `color-mix()` from Tier 1/2 tokens.

```css
:host {
  --_phosphor: var(--color-success);
  --_phosphor-dim: color-mix(in srgb, var(--color-success) 40%, transparent);
  --_scar: color-mix(in srgb, var(--color-danger) 55%, var(--color-info));
}

.health-bar { background: var(--_phosphor); }
.health-bar.low { background: var(--_phosphor-dim); }
```

Rules:
- Only define `--_*` variables in `:host` blocks
- Always derive from Tier 1/2 tokens via `color-mix()`
- Never use raw hex in `--_*` definitions

---

## Focus Rings

Defined in `_shadows.css`, auto-derived via `color-mix()`:

| Token | Formula |
|-------|---------|
| `--ring-focus` | 40% border-focus + 60% transparent |
| `--ring-danger` | 40% danger + 60% transparent |
| `--ring-success` | 40% success + 60% transparent |
| `--ring-warning` | 40% warning + 60% transparent |

---

## Theme Presets

9 presets in `theme-presets.ts`. Each preset defines only Tier 1 base tokens — all derived tokens are computed automatically by ThemeService.

### WCAG AA Compliance

All presets must maintain >= 4.5:1 contrast ratio for `color_text_muted` against their background color. Presets are verified against this requirement.

---

## Z-Index Tokens

Defined in `_z-index.css`. All high z-index values (>=25) in components must use these tokens:

| Token | Value | Use Case |
|-------|-------|----------|
| `--z-behind` | -1 | Behind normal flow |
| `--z-base` | 0 | Default |
| `--z-raised` | 10 | Floating elements, timers |
| `--z-sticky` | 100 | Sticky headers, wizard overlays |
| `--z-header` | 200 | Platform header |
| `--z-dropdown` | 300 | Dropdown menus |
| `--z-overlay` | 400 | Overlays |
| `--z-modal` | 500 | Modal dialogs |
| `--z-popover` | 600 | Popovers, studio panels |
| `--z-tooltip` | 700 | Tooltips |
| `--z-notification` | 800 | Toast notifications |
| `--z-top` | 900 | Topmost elements (scan overlays, dispatch) |

Low z-index values (1-20) are local stacking contexts within components and do not need tokens.

---

## Intentional Exceptions

These files are exempt from the token-only rule:

| File | Reason |
|------|--------|
| `DailyBriefingModal.ts` | Re-asserts platform-dark `:host` for modal overlay |
| `heartbeat-shared-styles.ts` | Already fully theme-compliant |
| `BureauResponsePanel.ts` | Already clean |
| `VelgDarkroomStudio.ts` | Shows raw preset swatch colors |
| `forge-placeholders.ts` | Seed/example data colors |
| `EchartsChart.ts` | JS chart library config |
| `DesignSettingsPanel.ts` | Color picker config values |
| `map-data.ts` / `map-three-render.ts` | Three.js/WebGL API calls |
| `HowToPlayView.ts` | ECharts config (requires raw hex) |
| `CartographerMap.ts` | Always-dark `:host` theme override |
| `VelgForgeTable.ts` | Card preview theme blocks |
| `CartographicMap.ts` | SVG texture pattern definitions |
| `rgba(0,0,0,0.X)` backdrops | Black overlays are direction-neutral |
| `--color-accent-amber-*` | Non-themeable platform chrome |
| `--color-entropy-*` | Special-purpose critical effects |
| Game data colors | `BleedGazetteSidebar`, `MapBattleFeed`, `SimulationSwitcher`, `MapLayerToggle` |
| Brand colors | Google `#4285f4`, Discord `#5865f2` in `terminal-theme-styles` |
| Podium colors | Silver/bronze in `EpochResultsView`, `MapLeaderboardPanel` |

---

## Adding a New Semantic Token

1. Add the `:root` default in `_colors.css`
2. If it should adapt to themes: add auto-derivation in `ThemeService.applyConfig()`
3. If presets need to override it directly: add to `THEME_TOKEN_MAP` and preset objects
4. Update this document

---

## Enforcement

Run the lint gate to check for violations:

```bash
bash frontend/scripts/lint-color-tokens.sh
```

Add `// lint-color-ok` to a line to suppress false positives (use sparingly, document why).
