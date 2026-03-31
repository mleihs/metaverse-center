# Resonance Dungeons Frontend — Research Brief (2026-03-27)

Destilliert aus 3 Deep-Dive-Agents. Lies dies als Grundlage fuer den Implementierungsplan.

## 1. Existierende Frontend-Architektur

### Stack
- **Lit 3** + **Preact Signals** + **TypeScript**
- Routing: `@lit-labs/router` (client-side, lazy-loading via `lazyRoute()`)
- Theming: `ThemeService.ts` (19.2KB) mit 10 Presets (brutalist, cyberpunk, sunless-sea, etc.)
- State: Singleton Managers mit Signals (AppStateManager, ForgeStateManager, TerminalStateManager)
- API: `BaseApiService` (6.1KB) — alle 41 Services erben davon, `getSimulationData<T>()` routet zu `/public` wenn nicht authentifiziert

### Shared Components (47 Dateien, Kernauswahl)
- `VelgGameCard.ts` (39KB) — TCG-Karte, 3D-Tilt, holographic foil, 5:8 ratio. Koennte fuer Dungeon-Rooms/Encounters adaptiert werden
- `VelgTabs.ts` — role="tablist", Keyboard-Nav, Stagger-Animation
- `BaseModal.ts` — Focus Trap, Escape, aria-modal
- `VelgDetailPanel.ts` — loading/error/content States
- `VelgAptitudeBars.ts` — Horizontale Aptitude-Bars (spy/guardian/etc.)
- `Toast.ts` — Bureau-Aesthetic, role="log", Auto-Dismiss
- `EmptyState.ts`, `ErrorState.ts`, `LoadingState.ts` — Standard-Platzhalter
- `terminal-theme-styles.ts` (9.9KB) — CRT-Tokens: Phosphor-Amber, Scanlines, Animationen
- `focus-trap.ts` — trapFocus(), focusFirstElement() (Shadow DOM aware)

### API Service Pattern
```ts
class FooApiService extends BaseApiService {
  async list(simId: string) { return this.getSimulationData<Foo[]>(`/foo`, simId); }
  async create(simId: string, body: CreateFoo) { return this.post<Foo>(`/foo?simulation_id=${simId}`, body); }
}
export const fooApi = new FooApiService();
```

### State Manager Pattern (Preact Signals)
```ts
class FooStateManager {
  items = signal<Foo[]>([]);
  loading = signal(false);
  selected = signal<Foo | null>(null);
  // Computed
  activeCount = computed(() => this.items.value.filter(f => f.active).length);
  // Methods
  async loadItems(simId: string) { ... }
}
export const fooState = new FooStateManager();
```

### Routing Pattern
In `app-shell.ts`:
```ts
{ path: '/simulation/:slug/feature', render: () => html`<velg-feature-view></velg-feature-view>`,
  enter: async () => { seoService.setTitle(['Feature', simName]); return true; } }
```
Lazy-Import via `this._lazy(() => import('./components/feature/FeatureView.ts'))`.

### Bestehende Game-Features als Referenz
- **Epoch** (PvP): EpochCommandCenter (82KB), WarRoomPanel (Kampflog), DeployOperativeModal (52KB), BotConfigPanel
- **Forge**: Multi-Step-Wizard, Generation-Ceremony (62KB), Entity-Review
- **Terminal**: BureauTerminal (27KB), CRT-Aesthetic, Command-Parser, TerminalStateManager (17KB)
- **Resonance**: ResonanceCard (31KB), ResonanceMonitor — Anomalie-Feed

### Icons
100+ SVG-Icons in `utils/icons.ts`. **Fehlend fuer Dungeons**: Schwert, Schild, Zauber, HP, Stress-Meter, Raum-Typen (combat/rest/treasure/boss/encounter/exit). Pattern: `icons.iconName = (size) => svg\`...\``

## 2. Dungeon UI Spec (aus resonance-dungeons-spec.md + MUD-Docs)

### Phase-Based Combat (nicht Realtime!)
- **ASSESSMENT** (3-5s) — Threat-Analyse, Enemy-Telegraphs
- **PLANNING** (15-30s) — Quick-Action Buttons (NICHT Text-Input), Timer
- **RESOLUTION** (5-8s) — Simultane Aufloesung, narrativer Output
- **OUTCOME** (2-3s) — Ergebnis, Statusaenderungen

### Client State Modell
Backend liefert `DungeonClientState`:
- `rooms[]` — Fog-of-War: unrevealed = "?" Typ, keine Connections
- `party[]` — Name, Portrait, Condition, Stress, Mood, Buffs, Abilities mit Check-% vorberechnet
- `archetype_state` — z.B. Shadow: `{visibility: 2, max_visibility: 3}`
- `combat` — Nur waehrend Kampf: round, enemies (condition_display statt HP), telegraphed_actions
- `phase` — exploring/encounter/combat_planning/combat_resolving/rest/treasure/boss/exit
- `phase_timer` — started_at + duration_ms

### Quick-Action Buttons (Primaere Interaktion)
```ts
interface AbilityOption {
  id: string; name: string; school: string;
  description: string; check_info: string | null; // "Spy 8: 73% success"
  cooldown_remaining: int; is_ultimate: boolean;
}
```

### Terminal Commands (Dungeon-Modus)
- `dungeon` — Run starten (Tier 2)
- `move {room_index}` — Bewegen (Tier 1)
- `map` — Dungeon-Graph anzeigen (Tier 1)
- `scout` — Spy: Raeume aufdecken (Tier 2)
- `rest` — Rasten (Tier 2)
- `retreat` — Flucht mit Partial-Loot (Tier 2)
- `interact {choice_id}` — Encounter-Wahl (Tier 2)

### Dungeon Map (ASCII FTL-Style)
```
DEPTH 0:  [ENTRANCE]
              |
DEPTH 1:  [COMBAT]--[COMBAT]
            |    \      |
DEPTH 2:  [EVENT] [ELITE]
            |       |
DEPTH 3:  [REST]--[TREASURE]
              |
DEPTH 4:  [BOSS]
```

### Realtime Sync (Supabase Broadcast)
- `dungeon:{runId}:state` — Room/Phase-Broadcasts
- `dungeon:{runId}:combat` — Combat-Resolution
- `dungeon:{runId}:presence` — Wer ist drin

### Recovery
- localStorage: `dungeonRunId` speichern
- Page Reload: `GET /runs/{runId}/state` zum Resync
- RealtimeService reconnect subscribed automatisch

## 3. Accessibility & Theming

### A11y Bestand
- 152 Files mit aria-*, 119 mit role=, 164+ aria-labels
- Focus Trap Utility (Shadow DOM aware)
- `prefers-reduced-motion` global respektiert (alle Durations auf 0ms)
- 44-48px Touch Targets
- WCAG AA Contrast Test Suite (`frontend/tests/theme-contrast.test.ts`)
- Linter: `lint-color-tokens.sh` (kein raw #hex), `lint-color-contrast.sh` (11 Paare)

### Fehlend / Zu Beachten
- Keine Combat-spezifischen ARIA-Patterns (role="timer" fuer Planning-Phase, aria-live fuer Kampflog)
- Screen Reader: Dungeon-Events muessen `aria-live="polite"` sein
- Keyboard: Ability-Buttons brauchen Fokus-Management waehrend Planning-Phase
- Motion: Kampfanimationen MUESSEN `prefers-reduced-motion` respektieren

### Color Tokens (3-Tier System)
- **Tier 1**: `--color-text-primary`, `--color-surface`, `--color-danger`, etc.
- **Tier 2**: Auto-derived via `color-mix()` — `--color-danger-glow`, `--color-success-bg`
- **Tier 3**: Component-local `--_*` Variablen in `:host`
- **NIEMALS raw #hex in Components** (CI-enforced)

### Animation Tokens
- `--duration-entrance: 350ms`, `--duration-stagger: 40ms`, `--duration-cascade: 60ms`
- `--ease-dramatic: cubic-bezier(0.22, 1, 0.36, 1)` — Entrance
- `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)` — Badge Pop
- Theme-skalierbar via `animation_speed` Multiplier (0.5-2.0x)

### Mobile
- Safe-area-insets fuer Fixed Overlays
- 16px Minimum Font fuer Inputs (iOS Auto-Zoom)
- `overscroll-behavior: contain` in Modals
- Screen Wake Lock API fuer lange Dungeon-Sessions
- `@media (max-height: 700px)` fuer iPhone SE

## 4. Component-Reuse-Strategie

### Direkt Wiederverwendbar
| Shared Component | Dungeon-Einsatz |
|-----------------|-----------------|
| VelgTabs | Abilities/Inventory/Map Tabs |
| BaseModal | Encounter-Choice, Loot-Reveal |
| VelgDetailPanel | Room-Details, Enemy-Info |
| VelgAptitudeBars | Party-Member Aptitudes |
| Toast | Combat-Events, Loot-Drops |
| EmptyState | "Kein aktiver Dungeon" |
| LoadingState | Dungeon-Lade-Screen |
| terminal-theme-styles | CRT-Aesthetic fuer Terminal-Modus |

### Neu zu Bauen
| Component | Zweck |
|-----------|-------|
| DungeonMapGraph | FTL-Style DAG mit Fog-of-War |
| DungeonCombatHUD | Planning/Resolution/Outcome Phasen |
| DungeonPartyPanel | Party-Status mit Stress/Condition |
| DungeonRoomPanel | Raum-Beschreibung, Encounter-Choices |
| DungeonAbilityBar | Quick-Action Buttons mit Check-% |
| DungeonEventLog | Scrollbarer Kampf/Event-Log |
| DungeonStateManager | Signals fuer kompletten Dungeon-State |
| DungeonApiService | REST-Client fuer 14 Endpoints |

### Terminal-Integration
TerminalStateManager erweitern um `isDungeonMode` Signal. BureauTerminal bekommt Dungeon-Commands die an DungeonStateManager delegieren. Dual-UI: Terminal-Modus UND grafischer Modus moeglich.

## 5. API Endpoints (14 gesamt)

### Authenticated (12)
| Method | Path | Body |
|--------|------|------|
| GET | /dungeons/available?simulation_id= | - |
| POST | /dungeons/runs?simulation_id= | DungeonRunCreate |
| GET | /dungeons/runs/{id} | - |
| GET | /dungeons/runs/{id}/state | - |
| POST | /dungeons/runs/{id}/move | {room_index} |
| POST | /dungeons/runs/{id}/action | DungeonAction |
| POST | /dungeons/runs/{id}/combat/submit | CombatSubmission |
| POST | /dungeons/runs/{id}/scout | {agent_id} |
| POST | /dungeons/runs/{id}/rest | {agent_ids[]} |
| POST | /dungeons/runs/{id}/retreat | - |
| GET | /dungeons/runs/{id}/events?limit&offset | - |
| GET | /dungeons/history?simulation_id&limit&offset | - |

### Public (2)
| Method | Path |
|--------|------|
| GET | /public/simulations/{id}/dungeons/history |
| GET | /public/dungeons/runs/{id} |
