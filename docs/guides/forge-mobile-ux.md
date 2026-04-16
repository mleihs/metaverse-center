# Forge Mobile UX Overhaul

## Context

The entire forge flow (7 components) was audited for mobile. Every fixed overlay lacks safe-area-inset handling, all inputs use 12.8px font (triggers iOS auto-zoom), several interactive elements are below 44px touch targets, the ceremony clips content on short viewports, and ClearanceQueue has zero mobile breakpoints. Additionally, research identified production-ready browser APIs (Wake Lock, CSS @property, View Transitions, navigator.vibrate) that can enhance the mobile ceremony experience at zero bundle cost.

## File Modified

| File | Changes |
|------|---------|
| `frontend/index.html` | Add `viewport-fit=cover` to viewport meta (prerequisite for all safe-area work) |
| `frontend/src/components/forge/forge-console-styles.ts` | Mobile 16px font on shared `.field__input, .field__textarea` |
| `frontend/src/components/forge/VelgForgeCeremony.ts` | Safe-area insets, overflow/landscape fix, will-change/contain hints, Wake Lock, CSS @property, vibrate |
| `frontend/src/components/forge/ClearanceQueue.ts` | Full mobile breakpoint pass, touch targets, 16px font |
| `frontend/src/components/forge/VelgForgeMint.ts` | Safe-area insets, 16px font, overscroll-behavior |
| `frontend/src/components/forge/VelgByokPanel.ts` | 16px font on mobile inputs, responsive key cards (flex-wrap), 44px touch targets on remove button, stacked actions on small screens |
| `frontend/src/components/forge/VelgBureauDispatch.ts` | Safe-area insets, touch targets, overscroll-behavior |
| `frontend/src/components/forge/VelgDarkroomStudio.ts` | Safe-area insets, touch targets, 16px font, overscroll-behavior |
| `frontend/src/components/forge/VelgForgeAstrolabe.ts` | Touch targets on seed suggestions |

---

## Phase 1: Mobile Foundation (fix what's broken)

### 1A. Enable safe-area-insets — `index.html` (line 5)

Current: `content="width=device-width, initial-scale=1.0"`
Add: `viewport-fit=cover` — without this, all `env(safe-area-inset-*)` values resolve to 0 on iOS.

### 1B. iOS auto-zoom prevention — `forge-console-styles.ts` (line 129)

`--text-sm` = 0.8rem = 12.8px. iOS Safari zooms viewport when input font < 16px.

Add `@media (max-width: 768px)` block to `forgeFieldStyles`:
```css
.field__input, .field__textarea { font-size: 16px; }
```
This propagates to Astrolabe, Darkroom, Table, and Ignition (all import `forgeFieldStyles`).

Also add per-component 16px overrides for inputs NOT using shared styles:
- **Mint**: `.mint__key-input` (line ~452)
- **ClearanceQueue**: `.request-card__notes-input` (line ~165)
- **Astrolabe**: `.seed-box textarea` (line ~76) — uses its own styles, not forgeFieldStyles
- **Darkroom**: `.regen-panel__prompt` (line ~510) — also standalone

### 1C. Safe-area insets on fixed overlays

All 4 fixed overlays need padding for notch/home indicator:

| Component | Container | Change |
|-----------|-----------|--------|
| **Ceremony** `.ceremony` (line 59) | `padding: 3vh 2vw` | → `padding: max(3vh, env(safe-area-inset-top)) max(2vw, env(safe-area-inset-right)) max(3vh, env(safe-area-inset-bottom)) max(2vw, env(safe-area-inset-left))` |
| **Mint** `.mint` (line ~29) | `inset: 0` | Add `padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom)` |
| **Dispatch** `.dispatch` (line ~89) | `overflow-y: auto` | Add `padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom)` |
| **Darkroom** `.overlay` (line ~22) | `inset: 0` | Add safe padding to `.header` (top) and `.content` (bottom) |

### 1D. Touch targets — 44px minimum

| Component | Element | Current | Fix |
|-----------|---------|---------|-----|
| **Astrolabe** | `.seed-suggestion` (line ~148) | ~30px | `min-height: 44px` |
| **Dispatch** | `.service__nav-btn` (line ~341) | `min-height: 32px` | → `44px` |
| **Darkroom** | `.theme-card__btn` (line ~301) | `min-height: 36px` | → `44px` |
| **Darkroom** | `.regen-panel__close` (line ~464) | 36×36 | → `44px × 44px` |
| **ClearanceQueue** | `.btn-approve`, `.btn-reject` | no min-height | `min-height: 44px` |

### 1E. overscroll-behavior on scroll containers

Prevents iOS rubber-band scroll-chaining from reaching the page behind modals. Add `overscroll-behavior: contain` to:
- **Mint** `.mint` (line ~35)
- **Dispatch** `.dispatch` (line ~89)
- **Darkroom** `.content` (line ~152) + `.regen-panel__body` (line ~484)

### 1F. ClearanceQueue mobile breakpoints

This component has zero responsive styles. Add `@media (max-width: 640px)`:
- `.request-card__header` → column layout (stack email + date)
- `.request-card__actions` → column, full-width buttons
- Tighter padding on `.forge-section`

---

## Phase 2: Ceremony Mobile Polish

### 2A. Short viewport overflow — `VelgForgeCeremony.ts`

Content stack (~681px) exceeds 667px on iPhone SE. Add `@media (max-height: 700px)`:
```css
.ceremony { overflow-y: auto; justify-content: flex-start; }
.ceremony__name { font-size: clamp(0.9rem, 5vw, 1.3rem); }
.ceremony__card-area { gap: var(--space-2); }
```

### 2B. Landscape orientation — `VelgForgeCeremony.ts`

Phone landscape = ~375px height. Add `@media (orientation: landscape) and (max-height: 500px)`:
```css
.ceremony { overflow-y: auto; justify-content: flex-start; gap: var(--space-1); }
.ceremony__card-area { flex-direction: row; } /* keep fans horizontal */
```

### 2C. GPU performance hints — `VelgForgeCeremony.ts`

40+ concurrent animations, zero `will-change` hints.
- `.ceremony__particle { will-change: transform, opacity; }`
- `.ceremony__card { will-change: transform, opacity; contain: layout style; }`
- `.ceremony__aurora, .ceremony__grid-pulse { contain: strict; }`
- `.ceremony__progress-fill { will-change: width; }`
- Remove all `will-change` inside `prefers-reduced-motion: reduce` block

### 2D. Screen Wake Lock — `VelgForgeCeremony.ts`

Ceremony runs 10+ seconds. Screen dimming ruins it. Add:
- `_wakeLock: WakeLockSentinel | null` property
- `_requestWakeLock()` in `_startCeremony()` — `navigator.wakeLock?.request('screen')`
- `_releaseWakeLock()` in `_handleEnter()` and `disconnectedCallback()`
- Re-acquire on `visibilitychange` (spec auto-releases on tab blur)

---

## Phase 3: Progressive Enhancement (zero-cost browser APIs)

### 3A. Haptic feedback — `VelgForgeCeremony.ts`

In `_pollProgress` when `fresh.size > 0`:
```ts
if ('vibrate' in navigator) navigator.vibrate(50);
```
On ready-flash (all done):
```ts
if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
```
Android only. iOS silently ignores. Zero bundle cost.

### 3B. CSS @property for animated gradients — `VelgForgeCeremony.ts`

Register `--glow-intensity` as `<number>`, animate from 0.08→0.25 for the `.ceremony__name-glow` radial gradient. Degrades gracefully — browsers that don't support `@property` ignore it and keep existing opacity animation.

### 3C. content-visibility during ceremony — `VelgForgeWizard.ts`

When ceremony overlay is active, add `content-visibility: hidden` to the forge container underneath. Skips layout+paint for all invisible wizard content. Remove when ceremony ends.

---

## Verification

1. `npx tsc --noEmit` + `npx biome check` clean after each phase
2. Test on iPhone SE simulator (375×667) — verify no content clipping, enter button visible above home indicator
3. Test landscape on phone (667×375) — verify scroll works, card area fits
4. Test iOS Safari input focus — verify no auto-zoom on textarea/input
5. Test all touch targets with Chrome DevTools touch simulation — 44px minimum
6. Verify `prefers-reduced-motion` still removes all animations + will-change hints
7. Test Wake Lock: verify screen stays awake during ceremony, releases on enter/disconnect
8. Test Android haptic: verify 50ms pulse on card materialize

---

## Tech Research Summary (informed decisions above)

| Tech | Status | Use? | Why |
|------|--------|------|-----|
| Screen Wake Lock | Production (Safari 16.6+, Chrome 84+) | **Yes** | Zero cost, prevents screen dim during ceremony |
| CSS @property | Production (Safari 16.4+, Chrome 85+) | **Yes** | Zero cost, animated gradients, graceful fallback |
| navigator.vibrate | Android only (no iOS) | **Yes** | Zero cost progressive enhancement |
| content-visibility | Production (Safari 18.1+, Chrome 85+) | **Yes** | Zero cost perf optimization |
| View Transitions | Production but Shadow DOM risk | **Defer** | Cross-shadow-root transitions unreliable with Lit |
| GSAP 3.x | Free, 23KB | **Skip** | CSS animations sufficient, avoid new dependency |
| OGL/WebGL | 29KB | **Skip** | Overkill for current effects, CSS handles it |
| WebGPU | Fragmented mobile support | **Skip** | Too early, iOS 26+ only |
| Houdini Paint | No Safari support | **Skip** | Dead on mobile |
| Rive | 100KB WASM | **Skip** | Heavyweight for procedural effects |
