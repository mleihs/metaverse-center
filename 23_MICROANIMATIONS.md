# 23 — Dramatic Microanimations

**Version:** v1.0
**Status:** Implemented — 23 files modified, 365/365 frontend tests passing, zero lint/type errors.
**Related:** `12_DESIGN_SYSTEM.md` (base tokens), `18_THEMING_SYSTEM.md` (ThemeService, animation_speed multiplier)

---

## Overview

The metaverse.center UI had excellent animations in a handful of components (SimulationNav, PlatformHeader, embassy cards, LoreScroll, CartographerMap) but the remaining ~80% of the interface was completely static — entity cards rendered instantly, detail panels popped without transition, badges appeared flat, chat messages had no entrance, and empty states were lifeless.

This spec documents the addition of **dramatic, brutalist/military-command-console-style microanimations** across the entire UI. The aesthetic is sharp and intentional — not floaty or gentle. Think: staggered card grid entrances, panel content cascades, impact bar segment grows, badge pops, directional message reveals, tab content crossfades.

### Design Principles

1. **CSS-only** — All animations use CSS `@keyframes` within Lit `static styles`. No JavaScript animation libraries, no `requestAnimationFrame` (except the existing map glow drift). This keeps bundle size at zero and respects Shadow DOM encapsulation.
2. **Token-driven** — Durations use CSS custom properties (`--duration-entrance`, `--duration-stagger`) that ThemeService scales via `animation_speed`. A cyberpunk theme (0.7x) feels snappy; deep-space-horror (1.8x) feels ominously slow.
3. **`prefers-reduced-motion` safe** — The global kill-switch in `_global.css` sets `animation-duration: 0.01ms !important` on all elements. All new duration tokens are also explicitly zeroed. Zero new accessibility work required.
4. **`--i` stagger pattern** — Grid items receive their index as a CSS custom property (`style="--i: ${i}"`), and `animation-delay: calc(var(--i) * var(--duration-stagger))` creates the cascade. This is a pure-CSS pattern that requires only a one-line template change per view.

---

## Architecture: New Animation Tokens

### A1. Duration Tokens (`_animation.css`)

Three new tokens added to the existing animation token file:

```css
--duration-entrance: 350ms;   /* Card/panel entrance animation */
--duration-stagger: 40ms;     /* Per-item stagger increment in grids */
--duration-cascade: 60ms;     /* Panel section cascade increment */
```

These sit alongside the existing `--duration-fast` (100ms), `--duration-normal` (200ms), `--duration-slow` (300ms), `--duration-slower` (500ms).

### A2. Easing Tokens (`_animation.css`)

Three new easing curves for dramatic motion:

```css
--ease-dramatic: cubic-bezier(0.22, 1, 0.36, 1);   /* Sharp deceleration — military snap-to */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);   /* Slight overshoot — badge pop, chip scale */
--ease-snap: cubic-bezier(0.5, 0, 0, 1);             /* Hard stop — reserved for future use */
```

**Rationale:** The existing `--ease-out` (ease-out) is too gentle for a command-console aesthetic. `--ease-dramatic` gives the feeling of data snapping into position on a tactical display. `--ease-spring` adds physicality to small elements (badges, chips) without being playful.

### A3. ThemeService Duration Scaling

`BASE_DURATIONS` in ThemeService.ts extended from 4 to 7 entries:

```typescript
const BASE_DURATIONS: Record<string, number> = {
  '--duration-fast': 100,
  '--duration-normal': 200,
  '--duration-slow': 300,
  '--duration-slower': 500,
  '--duration-entrance': 350,    // NEW
  '--duration-stagger': 40,      // NEW
  '--duration-cascade': 60,      // NEW
};
```

When ThemeService applies a theme with `animation_speed: 0.7`, all 7 tokens are multiplied: `--duration-entrance` becomes `245ms`, `--duration-stagger` becomes `28ms`. This means entrance animations are tighter on fast themes and more cinematic on slow themes — automatically.

### A4. ThemeService `hover_effect` Bridge

Theme presets define `hover_effect` ("translate" / "scale" / "glow") but this setting was **never consumed** by any component. Now ThemeService writes two CSS custom properties:

```typescript
--hover-effect: translate | scale | glow     // Raw value for JS consumers
--hover-transform: translate(-2px, -2px)     // Computed CSS transform for hover states
              // or: scale(1.03)
              // or: translate(0)  (glow uses box-shadow, not transform)
```

Components use `transform: var(--hover-transform)` on `:hover`, so the hover behavior changes per theme without any component-level branching.

---

## Animation Inventory

### Tier 1: High-Impact (Cards + Detail Panels)

#### T1.1 — Card Grid Stagger (`card-styles.ts`)

**What:** All entity cards (Agent, Building, Event) stagger into view when a list renders.

**How:** Shared `card-styles.ts` adds:
```css
.card {
  opacity: 0;
  animation: card-enter var(--duration-entrance) var(--ease-dramatic) forwards;
  animation-delay: calc(var(--i, 0) * var(--duration-stagger));
}

@keyframes card-enter {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Parent views thread the index: `style="--i: ${i}"` on each `<velg-agent-card>`, `<velg-building-card>`, etc.

**Files:** `card-styles.ts`, `AgentsView.ts`, `BuildingsView.ts`, `EventsView.ts`

#### T1.2 — EventCard (standalone + impact bars)

**What:** EventCard has its own `.card` CSS (doesn't import `cardStyles`), so the same animation is added locally. Additionally, the 10-segment impact bar grows segment by segment.

**How:** Impact bar uses `scaleY(0)` → `scaleY(1)` with per-segment delay:
```css
.card__impact-segment {
  transform: scaleY(0);
  transform-origin: bottom;
  animation: segment-grow var(--duration-entrance) var(--ease-spring) forwards;
  animation-delay: calc(var(--seg-i, 0) * 30ms + 200ms);
}
```

The `200ms` base delay ensures segments start growing after the card has faded in. Template passes `--seg-i: ${i}`.

**Files:** `EventCard.ts`, `EventDetailsPanel.ts`

#### T1.3 — Badge Pop (`VelgBadge.ts`)

**What:** Every badge in the UI (status, type, profession, role) pops in with a spring overshoot.

**How:**
```css
:host {
  animation: badge-pop 200ms var(--ease-spring) both;
  transition: background var(--duration-fast), border-color var(--duration-fast), color var(--duration-fast);
}

@keyframes badge-pop {
  from { opacity: 0; transform: scale(0.7); }
}
```

The `transition` on background/border/color handles runtime variant changes (e.g., status updates) smoothly. Since VelgBadge is used in cards, panels, headers, and health views, this single change propagates everywhere.

**Files:** `VelgBadge.ts`

#### T1.4 — Detail Panel Cascade

**What:** When a side panel (Agent/Building/Event details) opens, interior sections cascade in with staggered delays.

**How:** Uses `nth-child` selectors on the panel's content wrapper children:
```css
.panel__info > :nth-child(1) { animation-delay: 80ms; }
.panel__info > :nth-child(2) { animation-delay: 140ms; }
/* ... up to nth-child(10) at 620ms */

@keyframes panel-cascade {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**Design decision:** `nth-child` with hardcoded delays was chosen over `--i` stagger because panel sections aren't generated from `.map()` — they're static template blocks. The nth-child approach requires zero template changes and is purely CSS.

**Files:** `AgentDetailsPanel.ts`, `BuildingDetailsPanel.ts`, `EventDetailsPanel.ts`

#### T1.5 — Fill Bar Delayed Transition

**What:** Influence bars (agent) and readiness bars (building) animate their width after the panel cascade completes.

**How:**
```css
.panel__influence-fill {
  transition: width 0.6s var(--ease-dramatic) 0.4s;
}
```

The `0.4s` delay ensures the bar doesn't start growing until its containing section has cascaded in. The inline `style="width: ${pct}%"` triggers the transition on first render since the element starts at `width: 0` (default).

**Files:** `AgentDetailsPanel.ts`, `BuildingDetailsPanel.ts`

#### T1.6 — AI Suggestion Cards

**What:** When AI-generated relationship suggestions appear, they slide in from the left with stagger.

**How:**
```css
.panel__suggestion {
  opacity: 0;
  animation: suggestion-enter 300ms var(--ease-dramatic) forwards;
  animation-delay: calc(var(--i, 0) * 60ms);
}

@keyframes suggestion-enter {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

**Files:** `AgentDetailsPanel.ts`

---

### Tier 2: Medium-Impact

#### T2.1 — Dashboard Shard Cards (`SimulationCard.ts`)

**What:** Simulation cards on the dashboard stagger in with a scale + translate entrance.

**How:**
```css
:host {
  opacity: 0;
  animation: shard-enter 500ms var(--ease-dramatic) forwards;
  animation-delay: calc(var(--i, 0) * 80ms);
}

@keyframes shard-enter {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

The `80ms` stagger (vs `40ms` for entity cards) is intentionally slower — there are only 4 shard cards, so a wider gap makes each feel more deliberate.

**Files:** `SimulationCard.ts`, `SimulationsDashboard.ts`

#### T2.2 — Settings Tab Bar + Content Crossfade (`SettingsView.ts`)

**What:** Settings tabs stagger in from above on initial render. When switching tabs, content crossfades.

**How:** Tab entrance via `nth-child` delays (0ms–240ms):
```css
.settings__tab {
  opacity: 0;
  animation: tab-enter 250ms var(--ease-dramatic) forwards;
}
@keyframes tab-enter {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Content crossfade on tab switch:
```css
.settings__content > * {
  animation: content-fade 250ms var(--ease-out) both;
}
@keyframes content-fade {
  from { opacity: 0; transform: translateY(4px); }
}
```

**Files:** `SettingsView.ts`

#### T2.3 — Chat Messages (`MessageList.ts`)

**What:** Messages slide in directionally — AI messages from the left, user messages from the right. Date separators expand from center.

**How:**
```css
.message-row { animation: message-enter-left 300ms var(--ease-dramatic) both; }
.message-row--user { animation-name: message-enter-right; }

@keyframes message-enter-left  { from { opacity: 0; transform: translateX(-12px); } }
@keyframes message-enter-right { from { opacity: 0; transform: translateX(12px); } }

.date-separator__line {
  transform-origin: center;
  animation: line-expand 400ms var(--ease-dramatic) forwards;
}
@keyframes line-expand { from { transform: scaleX(0); } to { transform: scaleX(1); } }
```

**Design decision:** Directional entrance reinforces the conversational flow — messages appear to "come from" their sender's side, like data arriving on a comm channel.

**Files:** `MessageList.ts`

#### T2.4 — Simulation Header (`SimulationHeader.ts`)

**What:** When entering a simulation, the header name materializes with collapsing letter-spacing, and the status badge pops.

**How:**
```css
.header__name {
  animation: header-name-enter 400ms var(--ease-dramatic) both;
}

@keyframes header-name-enter {
  from { opacity: 0; transform: translateX(-8px); letter-spacing: 0.2em; }
  to   { opacity: 1; transform: translateX(0); }
}
```

The `letter-spacing: 0.2em → normal` collapse gives a "data resolving on screen" feel — fitting for the brutalist uppercase typography. The badge gets a `badge-pop` animation with a 150ms delay (arrives after the name).

**Files:** `SimulationHeader.ts`

---

### Tier 3: Polish

#### T3.1 — EmptyState (`EmptyState.ts`)

**What:** When an empty state renders (no agents, no buildings, etc.), the icon, message, and CTA cascade in three steps. The icon then rotates slowly in idle.

**How:**
```css
.empty__icon     { animation: empty-icon-enter 500ms var(--ease-spring) both; }
.empty__message  { animation: empty-fade-up 400ms var(--ease-dramatic) both 150ms; }
.empty__cta      { animation: empty-fade-up 400ms var(--ease-dramatic) both 300ms; }
.empty__icon svg { animation: empty-icon-idle 8s linear infinite 1s; }

@keyframes empty-icon-enter {
  from { opacity: 0; transform: scale(0.5) rotate(-15deg); }
  to   { opacity: 1; transform: scale(1) rotate(0); }
}
@keyframes empty-icon-idle { to { transform: rotate(360deg); } }
```

The idle rotation starts after 1s and rotates very slowly (8s/revolution). This prevents empty states from looking "dead" while remaining non-distracting.

**Files:** `EmptyState.ts`

#### T3.2 — Toast Slide-Out Fix (`Toast.ts`)

**What:** The `slide-out` CSS keyframe existed in Toast.ts but was never triggered — `_removeToast()` immediately removed the toast from the array, so the exit animation never played.

**How:** Added a `removing` boolean to `ToastItem`. `_removeToast()` now sets `removing: true` first (applying `.toast--removing` class), then removes from array after 200ms:

```typescript
private _removeToast(id: number): void {
  if (this._toasts.some((t) => t.id === id && t.removing)) return;
  this._toasts = this._toasts.map((t) =>
    t.id === id ? { ...t, removing: true } : t,
  );
  setTimeout(() => {
    this._toasts = this._toasts.filter((t) => t.id !== id);
  }, 200);
}
```

**This was a bug fix**, not a new animation — the CSS was already there, the JS just never triggered it.

**Files:** `Toast.ts`

#### T3.3 — Create Button Entrance (`view-header-styles.ts`)

**What:** The "+ Create Agent/Building/Event" button materializes from the right on page load.

**How:**
```css
.view__create-btn {
  animation: btn-materialize 400ms var(--ease-dramatic) both 200ms;
}
@keyframes btn-materialize {
  from { opacity: 0; transform: translateX(8px); }
}
```

The `200ms` delay means the button appears after the page title, reinforcing the information hierarchy.

**Files:** `view-header-styles.ts`

#### T3.4 — Filter Chip Pop (`SharedFilterBar.ts`)

**What:** When filter chips appear in the shared filter bar, they scale in with spring easing.

**How:**
```css
.filter-bar__chip {
  animation: chip-pop 200ms var(--ease-spring) both;
}
@keyframes chip-pop { from { opacity: 0; transform: scale(0.8); } }
```

**Files:** `SharedFilterBar.ts`

#### T3.5 — Social/Campaign Card Stagger

**What:** SocialTrendsView article cards and CampaignDashboard cards get the same `--i` stagger treatment as entity cards.

**How:** SocialTrendsView adds `card-enter` keyframe to `.article-card` styles and threads index via `_renderArticleCard(article, index)`. CampaignDashboard threads `style="--i: ${i}"` on `<velg-campaign-card>` (already uses `cardStyles`).

**Files:** `SocialTrendsView.ts`, `CampaignDashboard.ts`

#### T3.6 — Location Level Crossfade (`LocationsView.ts`)

**What:** When drilling between Cities -> Zones -> Streets, the list components crossfade.

**How:**
```css
velg-city-list, velg-zone-list, velg-street-list {
  animation: content-fade 250ms var(--ease-out, ease-out) both;
}
@keyframes content-fade {
  from { opacity: 0; transform: translateY(4px); }
}
```

Each time the level changes, Lit re-renders the appropriate list component, re-triggering the animation.

**Files:** `LocationsView.ts`

---

## Reduced Motion

All new animations are automatically suppressed by the existing global kill-switch in `_global.css`:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-entrance: 0ms;    /* NEW */
    --duration-stagger: 0ms;     /* NEW */
    --duration-cascade: 0ms;     /* NEW */
  }

  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

The `!important` on `animation-duration` overrides all inline and Shadow DOM animations. The new duration tokens are also explicitly zeroed so that `calc()` expressions evaluate to `0ms` delays.

---

## Files Modified (Complete Inventory)

| # | File | Changes |
|---|------|---------|
| 1 | `styles/tokens/_animation.css` | 3 duration tokens + 3 easing tokens |
| 2 | `styles/base/_global.css` | 3 new tokens in reduced-motion block |
| 3 | `services/ThemeService.ts` | Extended `BASE_DURATIONS` (3 entries) + `--hover-effect`/`--hover-transform` bridge |
| 4 | `components/shared/card-styles.ts` | `card-enter` keyframe + `--hover-transform` on hover |
| 5 | `components/shared/VelgBadge.ts` | `badge-pop` entrance + variant transitions |
| 6 | `components/shared/EmptyState.ts` | 3-step cascade + icon idle rotation |
| 7 | `components/shared/Toast.ts` | Slide-out bug fix (`removing` state + delayed DOM removal) |
| 8 | `components/shared/view-header-styles.ts` | `btn-materialize` on create button |
| 9 | `components/shared/SharedFilterBar.ts` | `chip-pop` on filter chips |
| 10 | `components/agents/AgentsView.ts` | `--i` index on agent cards |
| 11 | `components/agents/AgentDetailsPanel.ts` | Panel cascade + influence bar delay + suggestion stagger |
| 12 | `components/buildings/BuildingsView.ts` | `--i` index on building cards |
| 13 | `components/buildings/BuildingDetailsPanel.ts` | Panel cascade + readiness bar delay |
| 14 | `components/events/EventsView.ts` | `--i` index on event cards |
| 15 | `components/events/EventCard.ts` | `card-enter` (standalone) + impact bar segment stagger |
| 16 | `components/events/EventDetailsPanel.ts` | Panel cascade + impact bar segment stagger |
| 17 | `components/platform/SimulationsDashboard.ts` | `--i` index on shard cards |
| 18 | `components/platform/SimulationCard.ts` | `shard-enter` entrance animation |
| 19 | `components/settings/SettingsView.ts` | Tab stagger + content crossfade |
| 20 | `components/chat/MessageList.ts` | Directional message entrance + date separator line expand |
| 21 | `components/layout/SimulationHeader.ts` | Name letter-spacing collapse + badge pop |
| 22 | `components/social/SocialTrendsView.ts` | `card-enter` + `--i` stagger on article cards |
| 23 | `components/social/CampaignDashboard.ts` | `--i` stagger on campaign cards |
| 24 | `components/locations/LocationsView.ts` | Level transition crossfade |
| 25 | `tests/theme-service.test.ts` | Updated token count assertion (4 → 7) |

---

## Verification Checklist

1. **Card grids:** Navigate Agents, Buildings, Events views — cards stagger in
2. **Detail panels:** Click any entity — panel sections cascade, fill bars animate with delay
3. **Badges:** Visible on cards and in panels — pop entrance on render
4. **Dashboard:** 4 shard cards stagger entrance with scale
5. **Settings:** Tabs stagger down, content crossfades on tab switch
6. **Chat:** Messages slide from left/right based on sender, date separators expand
7. **Header:** Simulation name materializes with letter-spacing collapse
8. **Empty states:** Icon rotates in, message and CTA cascade
9. **Toast:** Dismiss triggers slide-out animation before removal
10. **Social:** Article cards stagger, campaign cards stagger
11. **Locations:** Level transition crossfades
12. **Theme scaling:** Switch between themes — `animation_speed` 0.7x (cyberpunk) vs 1.8x (deep-space-horror) affects all entrance durations
13. **Reduced motion:** Enable `prefers-reduced-motion` in OS — all animations suppressed
14. **Tests:** `npx vitest run` — 365/365 pass
15. **Lint:** `npx biome check src/` — clean
16. **Types:** `npx tsc --noEmit` — clean

---

## Cross-References

- **`12_DESIGN_SYSTEM.md`** — Base token definitions (spacing, colors, typography, borders, shadows, animation, layout, z-index)
- **`18_THEMING_SYSTEM.md`** — ThemeService architecture, `animation_speed` multiplier, preset definitions, WCAG contrast validation
- **`21_EMBASSIES.md`** — Embassy card pulsing ring + gradient hover (pre-existing animation, not part of this spec)
