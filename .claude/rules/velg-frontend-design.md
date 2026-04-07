---
description: Velgarien frontend design system, shared components, tokens, and linting rules. Always active for all frontend work.
paths: frontend/**
---

This rule guides creation of production-grade Lit 3 web components for the metaverse.center platform. Every component must follow the project's brutalist dark-theme design system, reuse shared components, and pass all lint gates. The aesthetic is "Cold War intelligence dossier meets simulation engine" — typewriter headings, amber accents on near-black surfaces, hard offset shadows, no rounded corners by default.

---

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction within the project's design language:

- **Purpose**: What problem does this interface solve? Who uses it — architects, operatives, observers?
- **Tone**: The platform supports 10 theme presets (brutalist, sunless-sea, solarpunk, cyberpunk, nordic-noir, deep-space-horror, arc-raiders, illuminated-literary, deep-fried-horror, vbdos). Your component must work across ALL of them via token inheritance. Design for the brutalist default, but never hardcode colors or fonts that would break under a different theme.
- **Constraints**: Lit 3 + Shadow DOM. All text i18n-wrapped. WCAG AA mandatory. All colors from tokens.
- **Differentiation**: What makes this component UNFORGETTABLE within the brutalist vocabulary? Staggered entrance cascades? A phosphor-green glow on a terminal readout? An ink-bleed SVG filter over a classified document? The creativity lives in how you compose tokens, animate entrances, and layer atmospheric effects — not in picking new fonts or colors.

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. The brutalist system gives you hard shadows, uppercase Courier headings, amber accents, dashed borders, corner brackets, scanline overlays, and a full animation token library. Use them with intent.

Then implement working Lit 3 code that is:

- Production-grade and functional
- Visually striking within the project's design vocabulary
- Theme-adaptive (works with all 10 presets via token inheritance)
- Meticulously refined in every detail — spacing, alignment, motion, contrast

---

## Aesthetics Guidelines (Project-Adapted)

Focus on:

- **Typography**: Use the token font stack — `--font-brutalist` (Courier New, uppercase, tracked) for headings and labels, `--font-body`/`--font-sans` (system-ui) for UI text, `--font-mono` (SF Mono) for code/terminal/metadata, `--font-bureau`/`--font-prose` (Spectral) for literary prose. Never import external fonts in components — ThemeService handles Google Fonts loading. Font sizes via `--text-{xs,sm,base,md,lg,xl,2xl,3xl,4xl}` tokens or `clamp()` for fluid scaling.
- **Color & Theme**: Commit to the 3-tier token system (see below). Dominant status color with sharp accents. Use `color-mix(in srgb, ...)` for component-local derived colors in `:host` only. The amber-on-black default palette is dramatic by itself — lean into it.
- **Motion**: Use animation tokens (`--duration-entrance`, `--ease-dramatic`, `--duration-stagger`). Focus on high-impact moments: one well-orchestrated page load with staggered reveals via `calc(var(--i, 0) * var(--duration-stagger))` creates more delight than scattered micro-interactions. Scroll-reveal with IntersectionObserver + `.in-view` class toggle. Hover states that transform with `--transition-fast`. ALL animations must include `@media (prefers-reduced-motion: reduce)` override.
- **Spatial Composition**: Asymmetric layouts. Grid-breaking hero sections. Generous negative space with `--space-{12,16,20,24}` tokens. Dense data panels with `--space-{2,3,4}` tight spacing. Use `repeat(auto-fill, minmax(var(--grid-min-width, 340px), 1fr))` for adaptive card grids.
- **Atmospheric Details**: Corner brackets (terminal frame pattern from `terminalFrameStyles`). Scanline overlays. Dashed borders (`1px dashed var(--color-border)`). Accent bars (`3px solid var(--color-primary)` left border). SVG filters from `<velg-svg-filters>` (ink-bleed, parchment-noise, ghost-text-blur). Inset glows via `color-mix()` with transparency. The brutalist offset shadows (`--shadow-{xs-2xl}`) are hard-edge by default — use them for depth without blur.

NEVER use:
- Generic AI aesthetics: overused font families (Inter, Roboto, Space Grotesk), purple gradients, rounded-corner card soup
- Raw `#hex`, `rgb()`, `rgba()` values — always tokens
- Inline SVG — always `icons.ts`
- New fonts not in the token system — ThemeService controls font loading
- `filter`, `transform`, `will-change`, `contain: paint`, or `perspective` on layout containers (shells, views, panels) — these break `position: fixed` modals

**IMPORTANT**: Match implementation complexity to the aesthetic vision. A terminal HUD readout needs elaborate animations, corner brackets, and scanline overlays. A settings form needs restraint, clean spacing, and proper form token usage. Elegance comes from executing the vision well — not from adding effects everywhere.

---

## Component Contract (Lit 3)

Every component MUST follow this structure:

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { buttonStyles } from '../shared/button-styles.js';
import { icons } from '../../utils/icons.js';
import { agentsApi } from '../../services/api/index.js';
import { appState } from '../../services/AppStateManager.js';

@localized()
@customElement('velg-my-component')
export class VelgMyComponent extends LitElement {
  static styles = [
    buttonStyles,
    css`
      :host {
        --_accent: var(--color-primary);
        --_accent-dim: color-mix(in srgb, var(--color-primary) 40%, transparent);
      }
    `
  ];

  @property({ type: String }) simulationId = '';
  @state() private _loading = true;
  @state() private _data: MyType[] = [];
  @state() private _error: string | null = null;

  protected render() {
    if (this._loading) return html`<velg-loading-state></velg-loading-state>`;
    if (this._error) return html`<velg-error-state message=${this._error} show-retry @retry=${this._load}></velg-error-state>`;
    if (!this._data.length) return html`<velg-empty-state message=${msg('No data found')}></velg-empty-state>`;
    return this._renderContent();
  }
}
```

**Key patterns**:
- `@localized()` decorator on EVERY component with user-facing text
- `msg('...')` wrapping ALL user-facing strings (no em dashes U+2014, use en dashes U+2013)
- `static styles` composed from shared modules + component CSS
- `SignalWatcher(LitElement)` mixin when component reacts to signals
- API calls via singletons: `agentsApi`, `buildingsApi`, `settingsApi`, `forgeApi`, `dungeonApi`, `chatApi`, `epochsApi`, etc.
- State via `appState` singleton: `appState.currentSimulation.value`, `appState.canEdit.value`, `appState.isAuthenticated.value`
- Events: `new CustomEvent('name', { bubbles: true, composed: true, detail: { ... } })`
- Stagger index: parent sets `style="--i: ${index}"`, child uses `animation-delay: calc(var(--i, 0) * var(--duration-stagger))`

---

## 3-Tier Color Token System

### Tier 1 — Semantic Base Tokens (from `:root`, themed by ThemeService)

**Status**: `--color-primary` (#f59e0b), `--color-danger` (#ef4444), `--color-success` (#22c55e), `--color-warning` (#f59e0b), `--color-info` (#3b82f6), `--color-epoch-influence` (#a78bfa)

**Surfaces**: `--color-surface` (#0a0a0a), `--color-surface-raised` (#111), `--color-surface-sunken` (#060606), `--color-surface-overlay` (#111), `--color-surface-header` (#0a0a0a), `--color-surface-inverse` (#fff)

**Text**: `--color-text-primary` (#e5e5e5), `--color-text-secondary` (#a0a0a0), `--color-text-muted` (#888), `--color-text-inverse` (#0a0a0a), `--color-text-link` (= info), `--color-text-danger` (= danger)

**Borders**: `--color-border` (#333), `--color-border-light` (#222), `--color-border-focus` (= primary), `--color-border-danger` (= danger), `--color-separator` (50% border + transparent)

**Platform accents** (non-themeable): `--color-accent-amber`, `--color-accent-amber-hover`, `--color-accent-amber-dim`, `--color-accent-amber-glow`, `--color-accent-green`, `--color-mint-brass`

### Tier 2 — Auto-Derived (via `color-mix()`, auto-adapt to themes)

For each status (`primary`, `danger`, `success`, `warning`, `info`):
- `--color-{status}-hover`: 80% base + 20% text-primary
- `--color-{status}-bg`: 8% base + 92% surface
- `--color-{status}-border`: 30% base + 70% transparent
- `--color-{status}-glow`: 15% base + 85% transparent
- `--color-primary-active`: 70% primary + 30% text-primary

Additional: `--color-text-tertiary`, `--color-icon` (= text-muted), `--color-separator`

### Tier 3 — Component-Local (`--_*` in `:host` only)

```css
:host {
  --_phosphor: var(--color-success);
  --_phosphor-dim: color-mix(in srgb, var(--color-success) 40%, transparent);
  --_accent: var(--color-primary);
}
.element { color: var(--_phosphor); }
```

---

## Full Token Reference

### Typography
- **Font families**: `--font-brutalist` (Courier New mono), `--font-sans`/`--font-body` (system-ui), `--font-mono` (SF Mono), `--font-bureau`/`--font-prose` (Spectral serif)
- **Sizes** (1.25x scale): `--text-xs` (10px), `--text-sm` (13px), `--text-base` (16px), `--text-md` (18px), `--text-lg` (20px), `--text-xl` (25px), `--text-2xl` (31px), `--text-3xl` (39px), `--text-4xl` (49px)
- **Weights**: `--font-normal` (400), `--font-medium` (500), `--font-semibold` (600), `--font-bold` (700), `--font-black` (900)
- **Line heights**: `--leading-none` (1), `--leading-tight` (1.25), `--leading-snug` (1.375), `--leading-normal` (1.5), `--leading-relaxed` (1.625), `--leading-loose` (2)
- **Tracking**: `--tracking-tight` (-0.025em), `--tracking-normal` (0), `--tracking-wide` (0.025em), `--tracking-wider` (0.05em), `--tracking-widest` (0.1em), `--tracking-brutalist` (0.08em)
- **Heading config**: `--heading-font` (= brutalist), `--heading-weight` (700), `--heading-transform` (uppercase), `--heading-tracking` (= tracking-brutalist)

### Spacing (8px base)
`--space-0` (0), `--space-0-5` (2px), `--space-1` (4px), `--space-1-5` (6px), `--space-2` (8px), `--space-2-5` (10px), `--space-3` (12px), `--space-3-5` (14px), `--space-4` (16px), `--space-5` (20px), `--space-6` (24px), `--space-7` (28px), `--space-8` (32px), `--space-9` (36px), `--space-10` (40px), `--space-12` (48px), `--space-14` (56px), `--space-16` (64px), `--space-20` (80px), `--space-24` (96px)

### Shadows (brutalist hard-offset)
`--shadow-xs` (2px 2px 0 #000), `--shadow-sm` (3px), `--shadow-md` (4px), `--shadow-lg` (6px), `--shadow-xl` (8px), `--shadow-2xl` (12px), `--shadow-pressed` (2px 2px inset), `--shadow-inset` (inset 2px 2px rgba)

**Focus rings**: `--ring-focus` (3px primary 40%), `--ring-danger`, `--ring-success`, `--ring-warning`

### Borders
- **Widths**: `--border-width-thin` (1px), `--border-width-default` (2px), `--border-width-thick` (3px), `--border-width-heavy` (4px)
- **Radii**: `--border-radius-none` (0, brutalist default), `--border-radius-sm` (2px), `--border-radius-md` (4px), `--border-radius-lg` (8px), `--border-radius-full` (9999px)
- **Composed**: `--border-default` (3px solid border), `--border-light` (1px solid border-light), `--border-medium` (2px solid border)

### Animation
- **Durations**: `--duration-instant` (0), `--duration-fast` (100ms), `--duration-normal` (200ms), `--duration-slow` (300ms), `--duration-slower` (500ms), `--duration-entrance` (350ms), `--duration-stagger` (40ms), `--duration-cascade` (60ms)
- **Easing**: `--ease-default` (ease), `--ease-in`, `--ease-out`, `--ease-in-out`, `--ease-bounce` (bouncy), `--ease-dramatic` (pronounced), `--ease-spring` (spring), `--ease-snap` (snap-to-end), `--ease-slam` (sharp impact), `--ease-settle` (settling)
- **Composed**: `--transition-fast` (100ms ease), `--transition-normal` (200ms ease), `--transition-slow` (300ms ease)

### Z-Index
`--z-behind` (-1), `--z-base` (0), `--z-raised` (10), `--z-sticky` (100), `--z-header` (200), `--z-dropdown` (300), `--z-overlay` (400), `--z-modal` (500), `--z-popover` (600), `--z-tooltip` (700), `--z-notification` (800), `--z-top` (900)

### Layout
- **Containers**: `--container-sm` (640px), `--container-md` (768px), `--container-lg` (1024px), `--container-xl` (1280px), `--container-2xl` (1400px), `--container-max` (1600px)
- **Structure**: `--header-height` (60px, 52px mobile), `--sidebar-width` (280px), `--sidebar-collapsed-width` (64px), `--content-padding` (24px, 16px mobile, 12px small mobile)

---

## Shared Components — Pre-Flight Checklist

**BEFORE creating any new element**, check if one of these existing components serves the need. Reuse always wins over reinvention.

### State Display
| Component | Tag | Use When |
|-----------|-----|----------|
| LoadingState | `<velg-loading-state message="...">` | Async data loading |
| ErrorState | `<velg-error-state message="..." show-retry @retry=${fn}>` | API errors with retry |
| EmptyState | `<velg-empty-state message="..." cta-label="..." @cta-click=${fn}>` | No results |
| Skeleton | `<velg-skeleton variant="card|text|avatar|table-row" count=3>` | Placeholder shimmer |

### Layout & Navigation
| Component | Tag | Key Props |
|-----------|-----|-----------|
| Tabs | `<velg-tabs .tabs=${[{key,label,icon?,badge?}]} active="key" @tab-change>` | Full a11y, keyboard nav |
| SidePanel | `<velg-side-panel ?open panelTitle="..." @panel-close>` | Right-slide overlay, focus trap |
| DetailPanel | `<velg-detail-panel state="loading|error|content">` | Auto loading/error states |
| SectionHeader | `<velg-section-header variant="default|large">` | Brutalist section divider |

### Interactive
| Component | Tag | Key Props |
|-----------|-----|-----------|
| FilterBar | `<velg-filter-bar .filters=${configs} @filter-change>` | Search + filter chips, debounced |
| Pagination | `<velg-pagination total limit offset @page-change>` | Server-side pagination |
| Toggle | `<velg-toggle .checked label variant="standard|scif" size="sm|md" @toggle-change>` | Standard or military aesthetic |
| IconButton | `<velg-icon-button label variant="default|danger" @icon-click>` | 30x30 icon action |
| Tooltip | `<velg-tooltip content="..." position="above|below">` | Text or rich (slot="tip") |
| HoldButton | `<velg-hold-button>` | Long-press confirmation |

### Display
| Component | Tag | Key Props |
|-----------|-----|-----------|
| Badge | `<velg-badge variant="default|primary|info|success|warning|danger">` | Pop animation |
| Avatar | `<velg-avatar src name size="xs|sm|full" moodColor clickable>` | Mood ring, click event |
| MetricCard | `<velg-metric-card label value sublabel variant>` | Corner brackets, accent bar |
| GameCard | `<velg-game-card type title imageSrc rarity size operative>` | TCG card, 3D tilt, foil |

### Overlay & Notification
| Component | API | Use When |
|-----------|-----|----------|
| BaseModal | `<velg-base-modal ?open @modal-close>` + slots: header, default, footer | Custom modal content |
| ConfirmDialog | `VelgConfirmDialog.show({ title, message, variant })` → Promise\<boolean\> | Destructive confirmations |
| GenerationProgress | `<velg-generation-progress ?open .steps currentStep status>` | Long-running AI generation |
| Toast | `VelgToast.success(msg)`, `.error()`, `.warning()`, `.info()` | User feedback (singleton) |

### Base Classes
| Class | Extends | Purpose |
|-------|---------|---------|
| BaseSettingsPanel | LitElement | Auto load/save settings, `_values`, `_handleInput()`, `_saveSettings()` |

---

## Shared Style Modules — Import Before Duplicating

Import into `static styles = [module, css\`...\`]`:

| Module | Import | Classes Provided |
|--------|--------|-----------------|
| `buttonStyles` | `button-styles.js` | `.btn`, `.btn--primary`, `--secondary`, `--danger`, `--info`, `--success`, `--warning`, `--ghost`, `--sm`, `--lg`, `--icon`, `.btn-group` |
| `cardStyles` | `card-styles.js` | `.card`, `.card--embassy` (hover transform, entrance animation) |
| `formStyles` | `form-styles.js` | `.form`, `.form__group`, `__label`, `__input`, `__textarea`, `__select`, `__error`, `__api-error`, `.gen-btn`, `.footer`, `.footer__btn` |
| `panelButtonStyles` | `panel-button-styles.js` | `.panel__btn`, `--edit`, `--danger`, `--generate` |
| `panelCascadeStyles` | `panel-cascade-styles.js` | `.panel__section`, `__content`, `__info` (staggered 80ms-620ms entrance) |
| `gridLayoutStyles` | `grid-layout-styles.js` | `.entity-grid` (uses `--grid-min-width`, default 240px) |
| `viewHeaderStyles` | `view-header-styles.js` | `.view`, `.view__header`, `__title`, `__create-btn`, `__count` |
| `settingsStyles` | `settings-styles.js` | `.settings-panel`, `-form`, `__group`, `__label`, `-btn`, `-sensitive-hint` |
| `infoBubbleStyles` | `info-bubble-styles.js` | `.info-bubble`, `__icon`, `__tooltip` + `renderInfoBubble(text)` helper |
| `terminalThemeStyles` | `terminal-theme-styles.js` | `terminalTokens`, `terminalComponentTokens`, `terminalAnimations`, `terminalFormStyles`, `terminalOAuthStyles`, `terminalFrameStyles`, `terminalWrapperStyles`, `terminalActionStyles` |
| `heartbeatSharedStyles` | `heartbeat-shared-styles.js` | `.hb-badge`, `.hb-panel`, `.hb-chip` + keyframes |
| `a11yStyles` | `a11y-styles.js` | `.visually-hidden`, `.skip-link`, `.focusable` |
| `typographyStyles` | `typography-styles.js` | `.label-brutalist` |

---

## Utilities

| Utility | Import | API |
|---------|--------|-----|
| **Icons** | `icons` from `utils/icons.js` | `icons.edit(16)`, `icons.trash()`, `icons.plus()`, `icons.close()`, etc. — returns `SVGTemplateResult` with `stroke="currentColor"`. NEVER inline SVG. |
| **Focus Trap** | `focus-trap.js` | `trapFocus(e, container, host)`, `focusFirstElement(shadowRoot)` |
| **SVG Filters** | `<velg-svg-filters>` | Renders `#ink-bleed`, `#parchment-noise`, `#crack-roughen`, `#ghost-text-blur`, `#entropy-dissolve` |
| **Theme Colors** | `getThemeColor()` from `utils/theme-colors.js` | Simulation theme → CSS color lookup |

---

## Responsive Design Patterns

**Breakpoints** (mobile-first):
- `max-width: 400px` — small mobile (tighter padding)
- `max-width: 640px` — mobile (single column, reduced spacing)
- `max-width: 768px` — tablet (stacked layouts)
- `min-width: 1280px` — desktop enhanced
- `min-width: 1440px` — large screens
- `min-width: 1600px` — extra large
- `min-width: 2560px` — 4K/ultra-wide

**Grid pattern**:
```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--grid-min-width, 340px), 1fr));
  gap: var(--space-4);
}
@media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
```

**Fluid text**: `font-size: clamp(1.5rem, 4vw, 2.5rem);`
**Touch targets**: minimum 44x44px on mobile for all interactive elements.

---

## Animation Patterns

**Scroll reveal** (IntersectionObserver + CSS):
```css
.scroll-reveal {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 500ms var(--ease-dramatic), transform 500ms var(--ease-dramatic);
  transition-delay: calc(var(--i, 0) * var(--duration-cascade));
}
.scroll-reveal.in-view { opacity: 1; transform: translateY(0); }
```

**Cascade stagger** (parent sets `--i` per child):
```html
${items.map((item, i) => html`<div class="card" style="--i: ${i}">${item.name}</div>`)}
```

**Reduced motion** (MANDATORY on every animation):
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Refactoring Radar

When touching existing components, flag and fix these opportunities:

- **Raw hex/rgb** → replace with Tier 1/2 token or Tier 3 `--_*` variable
- **Duplicated button/card/form CSS** → import the shared `-styles.ts` module
- **Unwrapped user-facing strings** → wrap with `msg()`
- **Em dashes (U+2014) in `msg()`** → replace with en dashes (U+2013)
- **LLM-ism words** in `msg()` (tapestry, delve, unleash, seamlessly, holistic, multifaceted, bustling, game-changer, cutting-edge) → rewrite
- **Missing `@media (prefers-reduced-motion)`** → add override
- **Inline SVG** → extract to `icons.ts` and use `icons.myIcon()`
- **Component-local loading/error/empty patterns** → use `<velg-loading-state>`, `<velg-error-state>`, `<velg-empty-state>`
- **Missing ARIA roles** or keyboard navigation → add `role`, `aria-*`, keyboard handlers
- **`filter`/`transform`/`will-change` on layout containers** → move to leaf elements only
- **Hardcoded z-index values** → use `--z-*` tokens
- **Hardcoded spacing/sizing** → use `--space-*` tokens
- **Missing `@localized()` decorator** → add to class

---

## Hard Rules

1. **No raw colors**: No `#hex`, `rgb()`, `rgba()` in component CSS. Use tokens. Enforced by `frontend/scripts/lint-color-tokens.sh`.
2. **No em dashes**: No U+2014 in `msg()` strings. Use en dashes U+2013. Enforced by `frontend/scripts/lint-llm-content.sh`.
3. **No LLM-isms**: No "tapestry", "delve", "unleash", "seamlessly", "holistic", "multifaceted", "bustling", "game-changer", "cutting-edge" in `msg()` strings. Same lint gate.
4. **Icons from `icons.ts` only**: Never inline SVG markup.
5. **No layout container effects**: Never apply `filter`, `transform`, `will-change`, `contain: paint`, or `perspective` on shells, views, or panels. Apply to leaf elements only.
6. **Brutalist headings**: All headings use `font-family: var(--font-brutalist)`, `text-transform: uppercase`, `letter-spacing: var(--tracking-brutalist)`.
7. **WCAG AA**: 4.5:1 contrast ratio for normal text, 3:1 for large text. 44px minimum touch targets on mobile. Visible focus rings via `--ring-focus`. `@media (prefers-reduced-motion)` on all animations.
8. **Three-state rendering**: Every data-driven component must handle loading, empty, and content states. Use shared state components.
9. **i18n mandatory**: Every user-facing string wrapped in `msg()`. Component must have `@localized()` decorator.
10. **Lint after every change**: Run `bash frontend/scripts/lint-color-tokens.sh && bash frontend/scripts/lint-llm-content.sh` to verify compliance.

---

Remember: The brutalist design system is not a limitation — it's a vocabulary. Use it to create interfaces that feel like declassified intelligence briefings, war room dashboards, and ancient terminal readouts. Commit fully to the distinctive vision within this disciplined system.
