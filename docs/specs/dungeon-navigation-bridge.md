---
title: "Dungeon Navigation Bridge — Detail Pages to Gameplay"
version: "1.0"
date: "2026-04-09"
type: spec
status: approved
lang: en
tags: [dungeon, frontend, navigation, UX, deep-link, architecture]
---

# Dungeon Navigation Bridge — Detail Pages to Gameplay

## Problem Statement

The 8 archetype detail pages (`/archetypes/:id`) are public showcase pages that build excitement through lore, enemies, encounters, literary DNA, and Objektanker. But the exit CTA (`href="/#dungeons"`) loops back to the landing page carousel — a dead end for anyone who wants to **play**.

The actual gameplay entry lives at `/simulations/:id/dungeon`, which requires:
1. Authentication
2. Membership in a simulation
3. Navigating to the simulation's Dungeon tab
4. Selecting the archetype again in the terminal lobby
5. Picking a party

**Current flow: 4-5 navigation hops with complete context loss.**

The detail page builds desire. The gameplay route fulfills it. This spec bridges the gap.

---

## Architecture Analysis (4 Perspectives)

### 1. Architect

**Data model gap:** Detail pages are public and simulation-agnostic. Dungeons are simulation-scoped (FK to `simulations`, unique partial index on `(simulation_id) WHERE status IN ('active', 'combat', 'exploring')`). The bridge must resolve this scope mismatch without coupling public pages to simulation internals.

**Existing patterns to conform with:**
- `pendingOpenAgentName` / `pendingOpenBuildingId` signals in `AppStateManager` — set-navigate-consume deep-link lifecycle
- `login-panel-open` CustomEvent dispatched by `PlatformHeader` — auth modal trigger
- `navigate` CustomEvent with path string — SPA navigation via app-shell handler
- `BaseModal` extension for pickers — used by `AgentSelector`, `EventPicker`
- `dungeonApi.getAvailable(simulationId)` — per-simulation archetype availability
- `appState.simulations` signal — user's member simulations (loaded on auth)

**Decision:** No new backend endpoint needed. `appState.simulations.value` provides the user's simulation list (already loaded). For per-simulation availability in the picker, we call `dungeonApi.getAvailable(simId)` per sim (N is typically 1-3). The terminal lobby gracefully handles "archetype not available" if availability changes between picker and navigation.

### 2. Game Designer

The detail page is a **lore showcase** — it builds emotional investment. The exit section is the climax: the mechanic gauge at max, the boss quote, the narrative call-to-action. This is the peak of desire.

**The CTA must capitalize on this momentum.** "Alle Archetypen" is a retreat. "Enter This Dungeon" is a conversion. The gameplay entry should feel like stepping through a portal, not walking back to the lobby.

**Terminal auto-command:** When the user arrives at the dungeon terminal through the bridge, we auto-execute `dungeon <archetype>` in the terminal. This shows the agent picker immediately — no re-selection needed. The user is already in the archetype's context, carried forward from the detail page.

### 3. UX Designer

**User journeys (all must work):**

| # | Scenario | Sims | Flow |
|---|----------|------|------|
| 1 | Not authenticated | N/A | CTA → Login Panel → page reload → CTA again → auth flow |
| 2 | Authenticated, 1 sim | 1 | CTA → direct navigate to `/simulations/:id/dungeon` |
| 3 | Authenticated, N sims | 2+ | CTA → Sim Picker Modal → select → navigate |
| 4 | Authenticated, 0 sims | 0 | CTA → "Join a simulation first" message + link to dashboard |
| 5 | Archetype unavailable in sim | N/A | Terminal lobby shows "not available" — graceful degradation |

**Scenario 1 (unauthenticated):** After login, `window.location.reload()` reloads the same detail page. The CTA is still there. The user clicks again — now authenticated. This is standard web behavior (2 clicks total). No localStorage hacks needed.

**Scenario 2 (1 sim):** Zero modals, zero extra clicks. CTA → navigate → terminal auto-selects archetype → user picks party → play. **From detail page to gameplay in 2 clicks** (CTA + party confirm).

**Scenario 3 (N sims):** One modal (sim picker) with immediate visual feedback on availability. Then same flow as Scenario 2.

### 4. Research

**Comparable patterns in established products:**

| Product | Pattern | Takeaway |
|---------|---------|----------|
| WoW Dungeon Journal | Detail → "Find Group" Queue | Context-preserving entry. User doesn't re-select the dungeon. |
| D&D Beyond | Spell/Monster → "Add to Campaign" → Campaign Picker | Exact analogue: public content → scoped context → picker if multiple |
| Notion Template Gallery | Template → "Use in Workspace" → Workspace Picker | Same pattern — resolve scope, then navigate |
| Path of Exile Atlas | Map detail → click to enter | No scope resolution needed (1 character = 1 context) |

**The "D&D Beyond / Notion" pattern is the closest match:** public showcase → scoped action → context resolution → navigate.

---

## Solution Design

### Components

| # | Component | Location | Responsibility |
|---|-----------|----------|----------------|
| 1 | `VelgDungeonEntryCta` | `frontend/src/components/dungeon/DungeonEntryCta.ts` | CTA button — auth check, sim resolution, navigation |
| 2 | `VelgDungeonSimPicker` | `frontend/src/components/dungeon/DungeonSimPicker.ts` | Modal — multi-sim selection with availability status |
| 3 | `pendingDungeonArchetype` | `AppStateManager.ts` (new signal) | Deep-link signal — set before navigation, consumed by terminal |
| 4 | Auto-select in terminal | `DungeonTerminalView.ts` (modification) | Consume signal, auto-execute `dungeon <archetype>` command |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  ArchetypeDetailView — Exit Section                                │
│                                                                     │
│  [▶ Enter This Dungeon]  ← VelgDungeonEntryCta                    │
│  archetype="overthrow"                                              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ click
                           ▼
                    ┌──────────────┐
                    │ Authenticated?│
                    └──────┬───────┘
                     NO    │    YES
                     │     │     │
        dispatch     │     │     ▼
     login-panel-open│     │  appState.simulations.value
        (page reload │     │     │
         on login)   │     │     ├─ 0 sims → Toast: "Join a simulation first"
                     │     │     │
                     │     │     ├─ 1 sim → Direct navigate
                     │     │     │            │
                     │     │     └─ N sims → Open VelgDungeonSimPicker
                     │     │                   │ user selects sim
                     │     │                   ▼
                     │     │     ┌────────────────────────┐
                     │     │     │ Set deep-link signal   │
                     │     │     │ appState               │
                     │     │     │ .pendingDungeonArchetype│
                     │     │     │ .value = "overthrow"   │
                     │     │     └───────────┬────────────┘
                     │     │                 │
                     │     │                 ▼
                     │     │     dispatch('navigate', {
                     │     │       detail: `/simulations/${slug}/dungeon`
                     │     │     })
                     │     │                 │
                     │     │                 ▼
                     │     │     ┌────────────────────────────────┐
                     │     │     │ DungeonTerminalView._initialize│
                     │     │     │                                │
                     │     │     │ 1. Normal init (terminal,     │
                     │     │     │    recovery, loadAvailable)    │
                     │     │     │                                │
                     │     │     │ 2. await this.updateComplete   │
                     │     │     │                                │
                     │     │     │ 3. Read pendingDungeonArchetype│
                     │     │     │    → clear signal              │
                     │     │     │    → auto-execute:             │
                     │     │     │    `dungeon <archetype>`       │
                     │     │     │    → shows agent picker in     │
                     │     │     │      terminal output           │
                     │     │     └────────────────────────────────┘
```

### Signal Lifecycle

```
1. SET:    DungeonEntryCta sets appState.pendingDungeonArchetype.value = "overthrow"
2. NAVIGATE: dispatch('navigate', { detail: '/simulations/:slug/dungeon' })
3. CONSUME: DungeonTerminalView reads signal after first render
4. CLEAR:  DungeonTerminalView sets signal to null
5. EXECUTE: Auto-runs `dungeon overthrow` command through parseAndExecute()
```

This matches the established pattern:
- `BuildingDetailsPanel` sets `pendingOpenAgentName` → navigates → `AgentsView` consumes + clears
- `DungeonEntryCta` sets `pendingDungeonArchetype` → navigates → `DungeonTerminalView` consumes + clears

---

## Component Specifications

### 1. VelgDungeonEntryCta

**Tag:** `<velg-dungeon-entry-cta>`

**Properties:**
```typescript
@property({ type: String }) archetype = '';   // Slug: "overthrow", "shadow", etc.
@property({ type: String }) label = '';       // Optional custom label (data-driven bilingual)
@property({ type: String }) variant = 'hero'; // "hero" (detail page) | "compact" (showcase card)
```

**Behavior:**
1. Reads `appState.isAuthenticated.value` for auth state
2. Reads `appState.simulations.value` for sim list
3. On click:
   - Not authenticated → dispatch `login-panel-open` event
   - 0 simulations → `VelgToast.info(msg('Join or create a simulation to play dungeons'))`
   - 1 simulation → set signal + navigate
   - N simulations → open `VelgDungeonSimPicker`

**Rendering:**
- `variant="hero"`: Full-width CTA matching `.exit__cta` styling (archetype accent, glow pulse, display font)
- `variant="compact"`: Inline button using `.btn .btn--primary .btn--sm` from shared button styles
- When not authenticated: label changes to localized "Sign in to enter" / "Anmelden & eintreten"

**Styling (hero variant):**
```css
:host([variant="hero"]) .cta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 14px 40px;
  font-family: var(--_font-display, var(--font-brutalist));
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-text-primary);
  background: color-mix(in oklch, var(--_accent, var(--color-primary)) 20%, transparent);
  border: 1px solid var(--_accent, var(--color-primary));
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: background var(--transition-slow), box-shadow var(--transition-slow);
}

:host([variant="hero"]) .cta:hover {
  background: color-mix(in oklch, var(--_accent, var(--color-primary)) 35%, transparent);
  box-shadow: 0 0 24px var(--_accent-glow, var(--color-primary-glow));
}
```

This mirrors the existing `.exit__cta` styling exactly — same padding, font, border, hover glow. The component inherits `--_accent` and `--_font-display` from the parent ArchetypeDetailView's `:host` scope via CSS custom property inheritance.

**i18n:**
- Hero variant: `label` prop is data-driven bilingual (from `dungeon-detail-data.ts` / `dungeon-detail-localized.ts`), not `msg()` wrapped — follows narrative prose pattern
- Compact variant: `msg('Enter Dungeon')` / `msg('Dungeon betreten')` — follows UI chrome pattern
- Unauthenticated fallback: `msg('Sign in to enter')` / `msg('Anmelden & eintreten')`

**Accessibility:**
- `role="button"` (renders as `<button>`, not `<a>`)
- `aria-label` includes archetype name: `msg('Enter The Overthrow dungeon')`
- Focus ring via `--ring-focus`
- `@media (prefers-reduced-motion: reduce)` disables glow pulse

### 2. VelgDungeonSimPicker

**Tag:** `<velg-dungeon-sim-picker>`

**Properties:**
```typescript
@property({ type: Boolean }) open = false;
@property({ type: String }) archetype = '';   // Slug for display + availability check
```

**Events:**
```typescript
'sim-selected' → { detail: { simulationId: string, simulationSlug: string } }
'modal-close'  → (standard BaseModal close)
```

**Behavior:**
1. On open: reads `appState.simulations.value` for sim list
2. For each sim: calls `dungeonApi.getAvailable(sim.id)` to check archetype availability
3. Displays sims with availability status (loading → available/unavailable/active-run)
4. On sim click (if available): emits `sim-selected`, closes modal

**Rendering:**
```
┌────────────────────────────────────────────────┐
│  ×                                             │
│  ┌──────────────────────────────────────────┐  │
│  │  SELECT SIMULATION                       │  │
│  │  ─────────────────                       │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  ● Nexus Prime                           │  │
│  │    authority_fracture — Magnitude: 0.8    │  │
│  │    Difficulty: 3 · Depth: 6              │  │
│  │                              [▶ ENTER]   │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  ◐ Testbed Alpha           LOADING...    │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  ○ Demo World              UNAVAILABLE   │  │
│  │    No matching resonance detected         │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  ◉ Research Lab            ACTIVE RUN    │  │
│  │    Currently running: The Shadow          │  │
│  └──────────────────────────────────────────┘  │
│                                                │
└────────────────────────────────────────────────┘
```

**Sim Status Indicators:**
| Status | Icon | Color | Clickable |
|--------|------|-------|-----------|
| Available | `●` | `--color-success` | Yes — navigates |
| Loading | `◐` | `--color-text-muted` | No — shows spinner |
| Unavailable | `○` | `--color-text-muted` | No — shows reason |
| Active Run | `◉` | `--color-warning` | No — shows current archetype |

**Styling:**
- Extends `BaseModal` (slot-based: header, body, footer)
- Brutalist aesthetic: uppercase Courier header, dashed borders between sims, hard-edge shadows
- Sim cards use `terminal-theme-styles` tokens for the terminal feel
- Available sim hover: subtle phosphor glow + border highlight
- Uses shared `buttonStyles` for the "Enter" action button (`.btn .btn--primary .btn--sm`)

**Accessibility:**
- `role="listbox"` on sim list, `role="option"` per sim
- `aria-disabled="true"` on unavailable/loading sims
- `aria-selected` on focused sim
- Keyboard: Arrow Up/Down to navigate, Enter to select
- Focus trap from `BaseModal`

### 3. AppStateManager Signal Addition

```typescript
// --- Navigation deep-link signals ---
/** Agent name to auto-open on next AgentsView load, then cleared. */
readonly pendingOpenAgentName = signal<string | null>(null);
/** Building ID to auto-open on next BuildingsView load, then cleared. */
readonly pendingOpenBuildingId = signal<string | null>(null);
/** Archetype slug to auto-select on next DungeonTerminalView load, then cleared. */
readonly pendingDungeonArchetype = signal<string | null>(null);
```

One line addition. Same pattern, same lifecycle, same JSDoc style.

### 4. DungeonTerminalView Modification

After `_initialize()` sets `this._initialized = true`:

```typescript
private async _initialize(): Promise<void> {
  // ... existing init code (terminal, recovery, loadAvailable) ...

  this._initialized = true;

  // Deep-link: auto-select archetype from detail page bridge
  const pendingArchetype = appState.pendingDungeonArchetype.value;
  if (pendingArchetype && !dungeonState.isInDungeon.value) {
    appState.pendingDungeonArchetype.value = null; // consume immediately
    // Wait for first render so terminal is available
    await this.updateComplete;
    // Auto-execute dungeon command through the standard pipeline
    // (same code path as typing "dungeon overthrow" in terminal)
    await this._handleTerminalCommand(
      new CustomEvent('terminal-command', { detail: `dungeon ${pendingArchetype}` }),
    );
  }
}
```

**Why this works:**
- `_handleTerminalCommand` calls `parseAndExecute(command)` which calls `handleDungeonEnter(ctx)`
- `handleDungeonEnter` does fuzzy matching: "overthrow" matches "The Overthrow"
- If archetype is available: shows agent picker in terminal output
- If not available: shows error message in terminal output (graceful degradation)
- Uses the exact same code path as manual terminal input — no divergent logic

---

## Integration Points

### ArchetypeDetailView — Exit Section

**Current (line 1855):**
```html
<a class="exit__cta" href="/#dungeons">${d.prose.exitCta}</a>
```

**Proposed:**
```html
<velg-dungeon-entry-cta
  archetype=${this.archetypeId}
  label=${d.prose.exitCta}
  variant="hero"
  style="--_accent:${d.accent};--_font-display:${d.fonts?.display ?? 'var(--font-brutalist)'}"
></velg-dungeon-entry-cta>
```

The component receives:
- `archetype`: slug from route param (already available as `this.archetypeId`)
- `label`: narrative prose label from localized data (e.g., "Seize Power" / "Ergreife die Macht")
- CSS custom properties: accent color and display font inherited from parent scope

The existing `exit__cta` CSS class is replaced by the component's internal styles, which mirror the same visual treatment. The `exit__back` link ("All Archetypes") remains as-is.

### DungeonShowcase — Phase 2 (Optional)

> ⚠ **Stand 31.08.2026:** `DungeonShowcase.ts` (die Frontseiten-Bühne) ist mit dem
> Frontseiten-Redesign entfallen — gemessen null Verwender. Die Archetyp-Daten leben
> weiter unter `frontend/src/components/archetypes/dungeon-showcase-data.ts` und tragen
> die Detailseiten. Wo dieses Dokument die Bühne als Einstieg beschreibt, ist der
> Einstieg heute die Detailseite selbst (`/archetypes/:id`).


The showcase carousel cards could gain a secondary CTA:
```html
<velg-dungeon-entry-cta
  archetype=${a.id}
  variant="compact"
></velg-dungeon-entry-cta>
```

This is additive and non-blocking. The showcase's primary CTA (link to detail page) remains.

---

## Edge Cases

| # | Case | Handling |
|---|------|---------|
| 1 | User logs in, page reloads, simulations not yet loaded | `DungeonEntryCta` watches `appState.simulations` signal; if empty and authenticated, fetches via `simulationsApi.list()` with loading state |
| 2 | User has N sims but all are unavailable for this archetype | Sim picker shows all as unavailable with reasons; user can still select one (terminal lobby shows "not available") |
| 3 | Archetype becomes unavailable between picker and terminal | Terminal lobby's `handleDungeonEnter` checks availability — shows "That dungeon is not available" |
| 4 | Signal set but user navigates away before terminal loads | Signal persists in memory until consumed or page unload — no side effects, just stale data that gets cleared on next terminal init |
| 5 | Active dungeon run exists when deep-link arrives | `dungeonState.isInDungeon.value` is true → deep-link code skips auto-select, terminal shows active HUD |
| 6 | User is on mobile (small viewport) | Hero CTA is full-width, sim picker modal is full-screen on mobile. Touch targets 44px+. |
| 7 | User navigates directly to `/simulations/:id/dungeon` (no deep-link) | Normal terminal lobby — no pendingDungeonArchetype signal set, no auto-select |

---

## Implementation Steps

### Phase 1: Core Bridge (Minimal Viable)

| Step | File(s) | Change |
|------|---------|--------|
| 1 | `AppStateManager.ts` | Add `pendingDungeonArchetype` signal (1 line) |
| 2 | `DungeonTerminalView.ts` | Consume signal after init, auto-execute command (~10 lines) |
| 3 | `DungeonEntryCta.ts` | New component — auth check, sim resolution, navigation (~180 lines) |
| 4 | `DungeonSimPicker.ts` | New component — BaseModal extension, sim list with availability (~250 lines) |
| 5 | `ArchetypeDetailView.ts` | Replace `<a>` CTA with `<velg-dungeon-entry-cta>` (lazy import + template change) |
| 6 | Lint gates | Run `lint-color-tokens.sh` + `lint-llm-content.sh` + `tsc` |

### Phase 2: Enhancements (Optional)

| Step | Change |
|------|--------|
| 7 | Add compact CTA to DungeonShowcase cards |
| 8 | Analytics tracking: `dungeon_bridge_click` event with archetype + source (detail/showcase) |
| 9 | Backend aggregated endpoint if per-sim fetching becomes slow (unlikely for N < 10) |

---

## Testing Strategy

### Frontend Unit Tests (Vitest + @open-wc/testing)

| Test | Assertion |
|------|-----------|
| `DungeonEntryCta` renders unauthenticated label | `appState.isAuthenticated = false` → renders "Sign in to enter" |
| `DungeonEntryCta` dispatches `login-panel-open` when unauthenticated | Click → event dispatched |
| `DungeonEntryCta` navigates directly for 1 sim | `appState.simulations = [sim1]` → click → `navigate` event with correct path |
| `DungeonEntryCta` opens picker for N sims | `appState.simulations = [sim1, sim2]` → click → picker opens |
| `DungeonEntryCta` shows toast for 0 sims | `appState.simulations = []` → click → toast shown |
| `DungeonSimPicker` fetches availability per sim | Open → `getAvailable` called for each sim ID |
| `DungeonSimPicker` emits `sim-selected` on click | Click available sim → event with correct sim ID |
| `DungeonSimPicker` disables unavailable sims | Sim without matching resonance → `aria-disabled`, not clickable |
| Deep-link signal consumed by terminal | Set `pendingDungeonArchetype` → init terminal → signal cleared, command executed |

### Manual Smoke Tests

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Browse `/archetypes/overthrow` as guest, click CTA | Login panel opens |
| 2 | Log in (1 sim), click CTA on detail page | Navigate to `/simulations/:slug/dungeon`, terminal shows agent picker for Overthrow |
| 3 | Log in (2 sims), click CTA | Sim picker modal appears with availability per sim |
| 4 | Select available sim in picker | Navigate to dungeon terminal, agent picker auto-shown |
| 5 | Select sim where archetype is unavailable | Terminal shows "not available" message |
| 6 | Have active dungeon run, click CTA | Navigate to terminal, shows active HUD (no auto-select) |

---

## Files Modified / Created

| Action | Path | Lines |
|--------|------|-------|
| **Create** | `frontend/src/components/dungeon/DungeonEntryCta.ts` | ~180 |
| **Create** | `frontend/src/components/dungeon/DungeonSimPicker.ts` | ~250 |
| **Modify** | `frontend/src/services/AppStateManager.ts` | +1 line (signal) |
| **Modify** | `frontend/src/components/dungeon/DungeonTerminalView.ts` | +10 lines (deep-link) |
| **Modify** | `frontend/src/components/archetypes/ArchetypeDetailView.ts` | ~5 lines (CTA swap + lazy import) |

**Total: ~450 lines new code, ~16 lines modified.**

---

## Architecture Conformance Checklist

| Pattern | Conforms | Evidence |
|---------|----------|----------|
| Deep-link signals | Yes | Matches `pendingOpenAgentName` / `pendingOpenBuildingId` exactly |
| Auth flow | Yes | Uses `login-panel-open` event (PlatformHeader pattern) |
| SPA navigation | Yes | Uses `navigate` CustomEvent (app-shell handler) |
| Modal pattern | Yes | Extends `BaseModal` (AgentSelector / EventPicker pattern) |
| API service singletons | Yes | Uses `dungeonApi.getAvailable()` + `simulationsApi.list()` |
| State management | Yes | Reads from `appState` signals (Preact Signals) |
| Design tokens | Yes | All colors via 3-tier tokens, no raw hex |
| Shared components | Yes | Uses `BaseModal`, `LoadingState`, `Toast`, `buttonStyles` |
| i18n | Yes | Narrative labels data-driven, UI chrome via `msg()` |
| Public-first | Yes | CTA works for unauthenticated users (shows login prompt) |
| WCAG AA | Yes | Focus rings, keyboard nav, aria roles, touch targets, reduced motion |
| No new backend | Yes | Uses existing `getAvailable()` + `appState.simulations` |
| Separation of concerns | Yes | CTA (orchestration) separate from Picker (selection UI) |
| No code duplication | Yes | Reuses terminal command pipeline (`parseAndExecute`) |
| Lint gates | Yes | Must pass `lint-color-tokens.sh`, `lint-llm-content.sh`, `tsc` |
