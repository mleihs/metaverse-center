# Design Tokens — Three-Tier Color Architecture

> Version 1.2 — 2026-04-05

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

### Chat Component Tokens (Phase 1-6)

| Component | Token | Source | Purpose |
|-----------|-------|--------|---------|
| ChatBubble | `--_bubble-user-bg` | `color-mix(--color-primary 12%, transparent)` | User message background |
| ChatBubble | `--_bubble-agent-bg` | `--color-surface-raised` | Agent message background |
| ChatComposer | `--_composer-bg` | `color-mix(--color-surface-raised 80%, transparent)` | Composer backdrop |
| ChatComposer | `--_composer-focus-border` | `--color-primary` | Focus ring border |
| ChatComposer | `--_composer-focus-glow` | `color-mix(--color-primary 20%, transparent)` | Focus glow shadow |
| MessageActions | `--_action-bg` | `--color-surface-raised` | Action toolbar background |
| MessageActions | `--_action-hover-bg` | `color-mix(--color-primary 10%, --color-surface-raised)` | Hover state |
| ConversationList | `--_search-bg` | `--color-surface-sunken` | Search input background |
| ConversationList | `--_search-focus-border` | `--color-primary` | Search focus ring |
| ConversationList | `--_pin-active-color` | `--color-primary` | Active pin accent |
| ConversationList | `--_rename-bg` | `--color-surface-sunken` | Rename input background |
| ConversationList | `--_rename-border` | `--color-primary` | Rename input focus border |
| ConversationList | `--_group-label-color` | `--color-text-muted` | Date group header |

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

## Border Width Tokens & Theme Overrides

Border width tokens (`--border-width-thin/default/thick/heavy`) are defined in `_borders.css` and can be overridden by simulation themes via ThemeService. When themes reduce border widths (e.g. `--border-width-default: 1px` for a minimalist aesthetic), small UI elements like avatars can become invisible on dark backgrounds.

**Pattern: CSS `max()` for visibility floors**

Components with minimum visibility requirements should use `max()` to enforce a floor while still respecting higher theme values:

```css
/* VelgAvatar size="sm" — 2px minimum, follows theme above that */
border: max(2px, var(--border-width-default)) solid var(--color-border);
```

This is a per-component concern, not a theme-system concern. Large elements (cards, panels) are fine at 1px because their borders span hundreds of pixels. Small elements (32px avatars) need proportionally thicker borders for equivalent visibility.

**Separation ring** for dark theme contrast:

```css
box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-text-primary) 8%, transparent);
```

Uses `color-mix()` with Tier 1 token — no raw hex values.

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

## Terminal HUD Tokens (`terminal-theme-styles.ts`)

Shared CSS exports for terminal and dungeon HUD components. Defined in `frontend/src/components/shared/terminal-theme-styles.ts`.

### `terminalTokens` — Tier 2 HUD Aliases

Maps platform Tier 1 tokens to terminal-semantic names on `:host`:

| Token | Source | Purpose |
|-------|--------|---------|
| `--amber` | `--color-accent-amber` | Primary phosphor color |
| `--amber-dim` | `--color-accent-amber-dim` | Dimmed phosphor (inactive) |
| `--amber-glow` | `--color-accent-amber-glow` | Glow/shadow effects |
| `--hud-bg` | `--color-surface` | Screen background |
| `--hud-surface` | `--color-surface-raised` | Raised panel background |
| `--hud-border` | `--color-border` | Panel borders |
| `--hud-text` | `--color-text-primary` | Primary text |
| `--hud-text-dim` | `--color-text-muted` | Muted text |

### `terminalComponentTokens` — Tier 3 Component-Local Aliases

Bridges Tier 2 HUD tokens to `--_*` component-local variables. Used by TerminalQuickActions, DungeonQuickActions, DungeonHeader, DungeonTerminalView.

| Token | Source | Purpose |
|-------|--------|---------|
| `--_phosphor` | `--amber` | Active phosphor accent |
| `--_phosphor-dim` | `--amber-dim` | Inactive phosphor state |
| `--_phosphor-glow` | `--amber-glow` | Hover/focus glow shadow |
| `--_screen-bg` | `--hud-bg` | Component background |
| `--_border` | `--hud-border` | Component border color |
| `--_mono` | `--font-mono` | Monospace font stack |

Components that need additional Tier 3 vars (e.g. DungeonHeader: `--_danger`, `--_text-dim`) add their own `:host` block alongside the shared set.

### Other Shared Exports

| Export | Consumers | Purpose |
|--------|-----------|---------|
| `terminalAnimations` | All terminal views | `cursor-blink`, `terminal-boot`, `field-reveal`, `line-expand`, `btn-materialize` |
| `terminalFormStyles` | Auth views | Form fields, buttons, error/success messages |
| `terminalFrameStyles` | BureauTerminal | Corner brackets, scanlines, dashed borders |
| `terminalWrapperStyles` | TerminalView, EpochTerminalView, DungeonTerminalView | `.terminal-wrapper`, `.terminal-error`, `.terminal-loading` |
| `terminalActionStyles` | TerminalQuickActions, DungeonQuickActions | `.actions`, `.action-btn`, `.action-btn--tier2`, `.action-btn--primary`, `.phase-label` |

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
| `HowToPlayWarRoom.ts` | ECharts config — simulation hex colors, radar/heatmap/bar charts |
| `DungeonShowcase.ts` / `dungeon-showcase-data.ts` / `dungeon-showcase-styles.ts` | Per-archetype signature colors + atmospheric CSS gradients (data-driven) |
| `CartographerMap.ts` | Always-dark `:host` theme override |
| `DungeonTerminalView.ts` | Forces platform-dark tokens on `:host` — dungeon HUD must always be dark regardless of simulation theme (brutalist/light themes override `--color-surface` to `#fff`, breaking amber-on-dark contrast in Header, Map, Party Panel, Quick Actions) |
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

## Typography Tokens

Source file: `frontend/src/styles/tokens/_typography.css`

### Font Families

| Token | Value | Usage |
|-------|-------|-------|
| `--font-brutalist` | Courier New, Monaco, Lucida Console, monospace | Headings — "intelligence dossier" typewriter aesthetic |
| `--font-sans` | system-ui stack | UI text (buttons, labels, navigation) |
| `--font-mono` | SF Mono, Monaco, Inconsolata, Roboto Mono | Code blocks, terminal output |
| `--font-bureau` | Spectral, Georgia, Times New Roman, serif | Literary prose — loaded dynamically via `ThemeService.ts` Google Fonts API |

### Semantic Font Tokens

| Token | Value | Notes |
|-------|-------|-------|
| `--font-body` | `var(--font-sans)` | Themed per simulation |
| `--font-prose` | `var(--font-bureau)` | Literary prose — Spectral on platform, themed per simulation |
| `--heading-font` | `var(--font-brutalist)` | All h1-h6 |
| `--heading-weight` | `var(--font-bold)` = 700 | Courier New only ships 400/700. Weight 900 triggers browser faux bold synthesis (ugly, inconsistent). |
| `--heading-tracking` | `var(--tracking-brutalist)` = 0.08em | Relative — auto-scales: 3.12px at h1, 1.28px at h6. Was 1px fixed (too tight at large sizes). |
| `--heading-transform` | uppercase | |

### Font Loading

Spectral is loaded dynamically via `ThemeService.ts` (`loadGoogleFont()`):
- Weights: 400 (normal), 500 (medium/dark-mode body), 700 (bold), 800 (extra-bold)
- Italic: 400
- `font-display: swap`

**Dark mode:** Spectral 500 (Medium) for body text. CHI 2023 research shows thin serif strokes (400 weight) cause halation (light bleeding into dark background) with ~25% more eye strain. Affects 30-60% of population (astigmatism).

### Modular Scale

1.25 ratio, mobile override at 767px:

| Token | Desktop | Mobile |
|-------|---------|--------|
| `--text-xs` | 0.64rem (10.24px) | — |
| `--text-sm` | 0.8rem (12.8px) | — |
| `--text-base` | 1rem (16px) | — |
| `--text-md` | 1.125rem (18px) | — |
| `--text-lg` | 1.25rem (20px) | — |
| `--text-xl` | 1.563rem (25px) | — |
| `--text-2xl` | 1.953rem (31.25px) | — |
| `--text-3xl` | 2.441rem (39px) | 1.953rem (31px) |
| `--text-4xl` | 3.052rem (48.8px) | 2.441rem (39px) |

### Design Rationale

The three-font-family system (mono headings + serif body + sans UI) is the "intelligence dossier" layered-era aesthetic. CIA Cold War documents mix Courier (typewriter), Times New Roman (printed reports), and Helvetica (modern systems). The visual layering communicates the simulation's surveillance/intelligence narrative.

---

## Enforcement

Run the lint gate to check for violations:

```bash
bash frontend/scripts/lint-color-tokens.sh
```

Add `// lint-color-ok` to a line to suppress false positives (use sparingly, document why).

---

## Icon System (Three-Tier Taxonomy)

All icons live in `frontend/src/utils/icons.ts` as pure functions `(size: number) => SVGTemplateResult`. Zero npm dependencies. See `docs/concepts/icon-system-audit.md` for full research and rationale.

### Tier 1 — Platform Chrome (Stroke)

Generic UI icons for navigation, forms, admin controls, metadata labels.

- **Style:** Tabler-derived, square linecaps, miter joins
- **Weight:** `stroke-width="2.0"` (standard) or `stroke-width="1.5"` (decorative)
- **Color:** `stroke="currentColor"`, `fill="none"`
- **ViewBox:** `0 0 24 24`
- **Principle:** Invisible and generic. A trash icon should look like every other trash icon.

### Tier 2 — Lore Objects (Custom)

Hand-drawn archetype and game-specific icons unique to the metaverse.center world.

- **Style:** Custom-drawn, unique per archetype/concept
- **Weight:** `stroke-width="1.5"`
- **Color:** `stroke="currentColor"`, selective fill for emphasis
- **ViewBox:** `0 0 24 24`
- **Principle:** Narrative weight. Never replace with library equivalents.

### Tier 3 — Game Pieces (Filled Silhouettes)

Dungeon map nodes, dungeon action buttons, tactical displays. Sourced from [game-icons.net](https://game-icons.net) (CC BY 3.0, lorc/delapouite/skoll).

- **Style:** Filled silhouettes, no stroke
- **Color:** `fill="currentColor"`
- **ViewBox:** `0 0 512 512`
- **Principle:** Heavy, tactile, RPG manual illustrations. Must read as radar signatures at 16-20px.

### Terminal Output — Unicode (Preserved)

Characters like `◈ ▲ ◌ ◉ ♢ ⚔ █ ░ ═ │ ◆ ★ ✦` in terminal formatters are **intentional** — they match 1980s amber terminal authenticity. Do not replace with SVG icons.

### Rules

- All icons must come from `utils/icons.ts` — never inline SVG in components.
- Never add npm icon dependencies (Phosphor, Lucide, etc.).
- New Tier 1 icons: source from [Tabler Icons](https://tabler.io/icons), convert to square linecaps.
- New Tier 3 icons: source from [game-icons.net](https://game-icons.net), extract path data, credit author in JSDoc.
- Never use `stroke-linecap="round"` — brutalist aesthetic requires `"square"` / `"miter"`.
