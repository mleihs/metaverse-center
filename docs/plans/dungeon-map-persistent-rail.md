# Dungeon Graphical View — Persistent Map Rail

**Status:** Planned + approved (2026-06-15). Implementation not begun.
**Resume:** one-pass implementation. Memory ledger: `graphical-dungeon-rollout` (SESSION 5).
**Branch:** `feat/graphical-dungeon` (at `29f3822`).

---

## Problem (measured, not guessed)

In the graphical view the map is hidden behind a bottom-right **FAB** that opens
a **modal dialog**. Measured rendered DOM for an active Tower run (~13 rooms):

| Thing | Value |
|---|---|
| SVG viewBox | `262 × 710` (tall, narrow — 2.7:1) |
| SVG rendered | **589 × 1596 px** |
| Dialog box | **622 × 780 px** |
| Current room node | y ≈ **1088** (off-screen below the fold on open) |

The map renders **~2× taller than the dialog**, so only half is ever visible;
the current room and the Move-Here action are below the fold; nodes are
inflated to ~134px circles; huge empty side margins.

## Root cause

The map (`velg-dungeon-map`) is **sidebar-tuned**: the terminal view already
embeds it as `<velg-dungeon-map persistent>` in a ~280px sidebar, where it
renders correctly. Forcing it into a ~620px modal triggers
`.map-svg { width:100%; height:auto }` (DungeonMap.ts:146) to scale the
`262`-wide viewBox up ~2.25× → height balloons to ~1596px → overflow + scroll +
giant nodes. Plus auto-scroll-to-current only fires on a *depth change*
(DungeonMap.ts:325), never on open, so opening the map dumps you at the
entrance, not your position.

**Key insight:** the narrow rail IS the map's native habitat. A persistent rail
at ~300–340px both fixes the over-scaling AND gives the player an always-visible
primary navigation surface (the user's explicit requirement).

---

## Design — persistent map rail

Replace the FAB + modal with an **always-visible, collapsible map rail** in the
graphical view, hosting `<velg-dungeon-map persistent>` (the existing
sidebar-tuned mode).

- **Placement:** left rail. Final layout: `[ map rail ~320px | scene (flex) | party panel ~265px ]`. (Read the current `.scene` / sidebar grid in `DungeonGraphicalView.ts` before wiring — confirm the party panel column and header so the rail slots in without breaking the `position:fixed` toggle/FAB rules.)
- **Default open**, with a collapse toggle to reclaim scene width (persist the collapsed state in a local signal/localStorage, NOT in `applyState`/`clear`, mirroring `viewMode`).
- **Native scale:** at ~320px the map renders at ~1.2× (correct), `.map-content` scrolls internally with its `max-height` like the terminal sidebar — but the rail itself is fully on screen.
- **Select → move loop** works inline: clicking a room shows `velg-dungeon-room-panel` under the SVG with the Move-Here button, reachable without a modal scroll.

## Fixes bundled into this pass

1. **Fits on screen** — rail width restores correct scale (no width:100% blow-up).
2. **Centre-on-current on open** — add a scroll-to-`.node--current` on first
   render / when the rail mounts (extend the existing `updated()` hook;
   currently depth-change-only). Smooth scroll, `block:center`.
3. **Node legibility + "you are here" beacon** — lift the visited-room
   node fill/stroke contrast and make the current-room beacon read clearly
   (the chest node + its edges currently vanish into the background).
4. **Persistence** — rail, not modal; the main nav tool is always visible.

---

## Files

- **`DungeonGraphicalView.ts`** (edit): remove `.map-fab` + `.map-dialog` markup, CSS, and the dialog open/close/`@terminal-command`-on-dialog logic; add the rail container + `<velg-dungeon-map persistent>` + collapse toggle; restructure the scene layout grid to `[rail | scene | party]`. Keep the existing `@terminal-command` handler at the shell level (the map dispatches it). Respect the layout-container rule: no `filter`/`transform` on the rail/scene/panel shells.
- **`DungeonMap.ts`** (edit): scroll-to-current on open/mount (not just depth change). Optionally a small `rail`/contrast affordance.
- **`DungeonMapNode.ts`** (edit): visited-node contrast + current-room beacon. **Decision:** this module is SHARED with the terminal sidebar map — a contrast lift improves BOTH views (a legibility win, not a regression). Improve globally rather than scoping to the rail, unless the terminal sidebar regresses visually. The terminal *view* file (`DungeonTerminalView.ts`) stays byte-intact; touching a shared leaf component is allowed.
- **`dungeon-map-layout.ts`** (maybe): the height clamp (`canvasW × 3`) is sidebar-tuned and should be fine at rail width; only revisit if the rail still overflows awkwardly.

---

## Constraints (carried from the rollout contract)

- Terminal view (`DungeonTerminalView.ts`) **byte-intact**. Server-authoritative; **zero game logic** in the client — the rail is a presentation surface.
- No `filter`/`transform`/`will-change`/`contain:paint`/`perspective` on layout containers (rail, scene, panel shells) — they break `position:fixed`. Apply FX to leaf elements only.
- All strings `msg()` + `@localized()`; en-dashes not em-dashes; no LLM-isms.
- Colours via tokens (Tier 1/2/3 `--_*`); icons from `icons.ts`; `@media (prefers-reduced-motion)` on animations; failures via `captureError`.
- Lint gates green: `lint-color-tokens`, `lint-no-empty-catch`, `lint-no-cast-unknown`, `lint-llm-content`, plus `tsc` + `biome`.

## Verification

- **Browser (graphical view, the-gaslit-reach):** map rail visible by default; whole DAG fits at a sane scale; opening centres on + clearly beacons the current room; visited nodes legible; select a room → detail panel + Move-Here reachable inline (no modal scroll); Move works; collapse toggle reclaims scene width.
- **Terminal view unchanged** (sidebar map still correct).
- `tsc` + 4 lint gates + biome green; relevant vitest green.
- Commit (clean message), then optionally push (`feat/graphical-dungeon`).

## Local env (degrades without it — see memory ledger)

- Backend on a free port + Vite proxy repointed; storage container must be **running** and the 8 showcase backdrops synced (this session restarted `supabase_storage_velgarien-rebuild` + synced — but the container/sync may not survive a reboot). Exact commands in the `graphical-dungeon-rollout` memory ledger.
