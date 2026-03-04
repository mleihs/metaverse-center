# 07 - Frontend Components: Komponenten + Simulation-Settings-UI

**Version:** 2.4
**Datum:** 2026-03-04
**Aenderung v2.4:** Foundation Phase Redesign + Open Epoch Participation — 2 neue Komponenten in `epoch/` (EpochIntelDossierTab, MissionCard). 1 neues Utility (operative-icons.ts). EpochOverviewTab erweitert (Fortify Zone Button + Zone-Selektor + Defensive Fortifications Section). EpochLobbyActions erweitert (Sim-Picker mit Faction Cards + deployed/dismiss States). EpochBattleLog erweitert (zone_fortified Event-Rendering). EpochCommandCenter erweitert (Intel-Dossier Tab + fortify-zone Event-Wiring). EpochsApiService erweitert (fortifyZone Methode). _myParticipant-Matching jetzt via user_id statt Simulations-Mitgliedschaft. Updated counts: **143 files across 19 subdirectories, 117 @customElement components**, 18 shared components + 10 CSS modules + 1 base class, 27 API services.
**Aenderung v2.3:** Admin Data Cleanup Tab — Neue Komponente `AdminCleanupTab` in `admin/` (Data-Overview-Telemetriegrid + 6 Cleanup-Operationskarten mit Preview/Execute-Workflow, Kaskaden-Baum-Darstellung, VelgConfirmDialog-Integration). AdminPanel erweitert auf 3 Tabs (Users/Caching/Cleanup). AdminApiService erweitert (3 neue Methoden: getCleanupStats, previewCleanup, executeCleanup). 6 neue TypeScript-Interfaces (CleanupType, CleanupCategoryStats, CleanupStats, CleanupPreviewResult, CleanupExecuteResult). ~36 neue i18n-Strings (DE uebersetzt). Undokumentierte Ergaenzungen: `EchartsChart` Shared-Komponente (Apache ECharts 6.0 Wrapper mit taktischem Dark Theme, IntersectionObserver Scroll-Reveal, Auto-Resize) + `MapGraph3D` (WebGL 3D-Modus via 3d-force-graph + Three.js, lazy-loaded) + `map-three-render.ts` (Three.js Rendering-Factories). Aptitude-Methoden leben auf `AgentsApiService` (kein separater AptitudesApiService). Updated counts: **140 files across 19 subdirectories, 114 @customElement components**, 18 shared components + 10 CSS modules + 1 base class, 27 API services.
**Aenderung v2.2:** Agent Aptitude System + Draft Phase — 2 neue Komponenten: `VelgAptitudeBars` in shared/ (3 sizes, editable mode, highlight, budget tracking), `DraftRosterPanel` in epoch/ (full-screen overlay, two-column layout, counter bar, team stats, lock-in). AptitudesApiService (3 Methoden). AgentDetailsPanel erweitert (aptitude editor section). AgentsView erweitert (lineup overview strip). DeployOperativeModal erweitert (aptitude bars, fit indicator, sorted dropdown). EpochCreationWizard erweitert (max_agents_per_player slider). EpochLobbyActions erweitert (draft button, draft status display). Updated counts: **131 files across 17 subdirectories, 108 @customElement components**, 27 API services.
**Aenderung v2.1:** Epoch Cycle Email Notifications — NotificationsSettingsPanel in settings/ (new "Notifications" tab with 3 toggle switches + locale selector). NotificationPreferencesApiService (2 Methoden). Updated counts: **129 files across 17 subdirectories, 106 @customElement components**, 26 API services.
**Aenderung v2.0:** Front Page Literary Rewrite — LoreScroll expanded from 20 to 25 sections across 6 chapters, all 5 simulations now covered equally (Bureau Dossier + Field Report per sim). SimulationsDashboard updated: new slogan "Five Worlds. One Fracture.", Spectral/`--font-bureau` serif font on hero/footer/lore strip. lore/ directory: 7 files (5 content files + dispatcher + SimulationLoreView). Cité des Dames lore content file added. 2063 i18n strings total.
**Aenderung v1.9:** Bot Players — 1 neue Komponente in `epoch/` (BotConfigPanel). BotApiService (6 Methoden). Bot-Indikatoren auf EpochLeaderboard, EpochBattleLog, EpochChatPanel, EpochReadyPanel, EpochOpsBoard. "Add Bots" Button auf EpochLobbyActions. AI Settings: bot_chat_mode + model_bot_chat. Updated counts: **128 files across 17 subdirectories, 105 @customElement components**, 25 API services.
**Aenderung v1.8:** Platform Admin Panel — 3 neue Komponenten in `admin/` (AdminPanel, AdminUsersTab, AdminCachingTab). AdminApiService (8 Methoden). `isPlatformAdmin` computed Signal in AppStateManager. `/admin` Route mit Auth+Admin-Guard. "Admin" Nav-Link in PlatformHeader (rot, nur fuer Platform-Admin sichtbar). Updated counts: 126 files across 17 subdirectories, 104 @customElement components, 24 API services.
**Aenderung v1.7:** Public API routing fix — `BaseApiService.getSimulationData()` helper checks both `isAuthenticated` AND `currentRole` for simulation-scoped reads. 14 API services migrated. `_enterSimulationRoute()` determines membership via `_checkMembership()` before render. `SettingsApiService` design category always uses public endpoint.
**Aenderung v1.6:** Full-Stack Audit v2 — EpochCommandCenter decomposed into 5 child components (EpochOpsBoard, EpochOverviewTab, EpochOperationsTab, EpochAlliancesTab, EpochLobbyActions). HowToPlayView CSS extracted to htp-styles.ts. New shared CSS: grid-layout-styles.ts (entity card grids for 5 views). ~60 hardcoded hex colors replaced with CSS custom property tokens in 10 epoch components. Updated counts: 123 files across 16 subdirectories, 101 @customElement components, 10 shared CSS modules.
**Aenderung v1.5:** Epoch Realtime — EpochChatPanel (dual-channel tactical comms), EpochPresenceIndicator (online user dots), EpochReadyPanel (cycle readiness toggle). EpochCommandCenter now has collapsible COMMS sidebar on Operations Board. RealtimeService singleton (4 Supabase Realtime channels with Preact Signals). EpochChatApiService. Updated counts: 116 files across 16 subdirectories, 96 @customElement components, 23 API services + 8 platform services. how-to-play/ and epoch invite components also now reflected.
**Aenderung v1.4:** Accurate component audit — 107 files across 15 subdirectories, 90 @customElement components. Updated shared/ (16 components + 8 CSS modules + 1 base class), removed dead code listings (DataTable, FormBuilder, NotificationCenter, CampaignDetailView, CampaignMetrics, SentimentBadge, SupabaseRealtimeService, PresenceService). Added health/, epoch/, lore/, EventPicker, BleedSettingsPanel, PromptsSettingsPanel. Updated service layer (22 API services + 7 platform services).
**Aenderung v1.3:** Cartographer's Map (Multiverse-Visualisierung). Agent Relationships UI (RelationshipCard, RelationshipEditModal). Event Echoes UI (EchoCard, EchoTriggerModal). 7 neue Multiverse-Komponenten. Bleed-Filter in EventsView.
**Aenderung v1.2:** LoreScroll-Akkordeon auf Dashboard. LoginPanel (Slide-from-Right). SimulationCard mit Banner-Bild + Zaehler. VelgSimulationShell Theming-Lifecycle (connectedCallback/disconnectedCallback). Anonymer Read-Only-Modus in allen Entity-Komponenten via `appState.isAuthenticated.value`.
**Änderung v1.1:** Zod-Validierung, @lit-labs/router, Biome-Tooling ergänzt

---

## Komponenten-Hierarchie

### Plattform-Level

**143 component files** across 19 subdirectories. **117 @customElement** components. **18 shared components + 10 CSS modules + 1 base class.**

```
App (Root)
├── PlatformHeader
│   ├── DevAccountSwitcher
│   ├── UserMenu
│   └── LocaleSelector
├── SimulationsDashboard
│   ├── SimulationCard (je Simulation)
│   ├── LoreScroll (Akkordeon mit Plattform-Lore, 25 Sections / 6 Chapters / 5 Simulations)
│   └── CreateSimulationButton
├── CreateSimulationWizard
│   ├── Step 1: Basic Info (Name, Theme, Locale)
│   ├── Step 2: Taxonomies (Import defaults or custom)
│   └── Step 3: Confirm & Create
├── UserProfileView
├── InvitationAcceptView
├── AuthViews
│   ├── LoginView
│   ├── LoginPanel (Slide-from-Right)
│   └── RegisterView
└── CartographerMap (/multiverse)
    ├── MapGraph (2D SVG force-directed graph, default)
    │   ├── MapNode (circle + banner + label)
    │   └── MapEdge (bezier + flow animation)
    ├── MapGraph3D (3D WebGL via 3d-force-graph + Three.js, lazy-loaded)
    │   └── map-three-render (Three.js node/edge factories)
    ├── MapTooltip (hover info)
    ├── MapConnectionPanel (edge detail, extends VelgSidePanel)
    ├── MapBattleFeed (scrolling public battle log ticker)
    ├── MapLeaderboardPanel (VelgSidePanel for epoch scores)
    ├── MapMinimap (150×100px viewport overview)
    └── Mobile Card List (≤768px fallback)
```

**platform/ directory:** PlatformHeader, UserMenu, DevAccountSwitcher, SimulationsDashboard, LoreScroll, CreateSimulationWizard, UserProfileView, InvitationAcceptView, SimulationCard (9 files)

### Simulation-Level

```
SimulationShell (Layout mit Navigation)
├── SimulationHeader
│   ├── Navigation (Tabs/Sidebar)
│   └── SimulationInfo (Name, Theme)
├── AgentsView
│   ├── SharedFilterBar
│   ├── Lineup Overview Strip (aptitude bars per agent, horizontal scroll)
│   ├── AgentCard
│   │   ├── AgentPortrait
│   │   ├── AgentActions
│   │   └── Relationship Count Indicator
│   ├── AgentEditModal (extends BaseModal)
│   └── AgentDetailsPanel
│       ├── Character, Background, Professions, Reactions (existing)
│       ├── Aptitudes Section (accordion: VelgAptitudeBars in editable mode, budget display)
│       └── Relationships Section (accordion)
│           ├── RelationshipCard
│           └── RelationshipEditModal (extends BaseModal)
├── BuildingsView
│   ├── SharedFilterBar
│   ├── BuildingCard
│   │   └── BuildingImage
│   ├── BuildingEditModal (extends BaseModal)
│   └── BuildingDetailsPanel
├── EventsView
│   ├── SharedFilterBar (+ Bleed Filter Toggle)
│   ├── EventCard
│   │   ├── EventReactions
│   │   └── Bleed Badge (data_source === 'bleed')
│   ├── EventEditModal (extends BaseModal)
│   └── EventDetailsPanel
│       ├── Description, Impact, Reactions, Metadata (existing)
│       ├── Bleed Provenance (origin simulation + vector)
│       └── Echoes Section (accordion)
│           ├── EchoCard
│           └── EchoTriggerModal (extends BaseModal, admin+)
├── ChatView
│   ├── ConversationList
│   ├── ChatWindow
│   │   ├── MessageList
│   │   └── MessageInput
│   ├── AgentSelector
│   └── EventPicker
├── SocialTrendsView
│   ├── TrendFilterBar
│   ├── TrendCard
│   ├── TransformationModal (extends BaseModal)
│   └── CampaignDashboard
│       └── CampaignCard
├── SocialMediaView
│   ├── PostCard
│   └── PostTransformModal (extends BaseModal)
├── LocationsView (Cities/Zones/Streets)
│   ├── CityList
│   ├── ZoneList
│   ├── StreetList
│   └── LocationEditModal (extends BaseModal)
├── SimulationLoreView
│   └── Lore Content (4 per-simulation content files)
├── SimulationHealthView (Game Metrics Dashboard)
├── EpochCommandCenter (Competitive PvP — orchestrator, delegates to subcomponents)
│   ├── EpochOpsBoard (dossier cards + COMMS sidebar, dispatches select/join/create events)
│   ├── EpochOverviewTab (overview + mission render + fortify zone, dispatches deploy/counter/recall/fortify events)
│   ├── EpochIntelDossierTab (per-opponent intel cards from spy battle log: zone security, guardians, fortifications)
│   ├── EpochOperationsTab (operations tab, dispatches recall events)
│   ├── EpochAlliancesTab (alliances tab, dispatches create/join/leave-team events)
│   ├── EpochLobbyActions (lobby + admin controls, draft button + sim picker with faction cards, dispatches epoch lifecycle events)
│   ├── EpochCreationWizard (includes max_agents_per_player slider in config step)
│   ├── DraftRosterPanel (full-screen overlay: two-column agent selection, counter bar, team stats, lock-in)
│   ├── EpochLeaderboard
│   ├── EpochBattleLog (includes zone_fortified event rendering)
│   ├── MissionCard (reusable operative mission card with status badges)
│   ├── DeployOperativeModal (extends BaseModal, aptitude bars + fit indicator + sorted dropdown)
│   ├── EpochInvitePanel (VelgSidePanel slide-out, email invitations)
│   ├── EpochChatPanel (dual-channel tactical comms: ALL CHANNELS / TEAM FREQ)
│   ├── EpochPresenceIndicator (online user dot per simulation_id)
│   ├── EpochReadyPanel (cycle ready toggle with live broadcast)
│   └── BotConfigPanel (VelgSidePanel slide-out: bot preset CRUD + personality cards)
└── SettingsView
    ├── GeneralSettingsPanel
    ├── WorldSettingsPanel (Taxonomien)
    ├── AISettingsPanel (extends BaseSettingsPanel)
    ├── IntegrationSettingsPanel (extends BaseSettingsPanel)
    ├── DesignSettingsPanel (extends BaseSettingsPanel)
    ├── AccessSettingsPanel (extends BaseSettingsPanel)
    ├── PromptsSettingsPanel
    ├── BleedSettingsPanel
    └── NotificationsSettingsPanel (3 toggle switches + locale selector)
```

### Shared Components

**18 components + 10 CSS modules + 1 base class** (29 files total)

```
Shared (wiederverwendbar ueber alle Views)
├── Components (18)
│   ├── BaseModal                    Focus trap, Escape-to-close, centered dialog
│   ├── VelgSidePanel                Slide-from-right panel shell, focus trap, role="dialog", aria-modal="true"
│   ├── SharedFilterBar              Ersetzt 4x duplizierten Filter
│   ├── VelgBadge                    6 color variants (default, primary, info, warning, danger, success)
│   ├── VelgAvatar                   Portrait + initials fallback, 3 sizes (sm/md/lg), optional alt override
│   ├── VelgIconButton               30px icon action button
│   ├── VelgSectionHeader            Section titles, 2 variants
│   ├── VelgAptitudeBars             Operative aptitude bars (3 sizes: sm/md/lg, editable mode, highlight, budget tracking)
│   ├── EchartsChart                 Apache ECharts 6.0 wrapper, custom tactical dark theme, IntersectionObserver scroll-reveal, auto-resize
│   ├── ErrorState                   Einheitliches Error-Pattern
│   ├── LoadingState                 Einheitliches Loading-Pattern
│   ├── EmptyState                   "Keine Daten" Anzeige mit optionalem Action-Button
│   ├── GenerationProgress           AI generation progress indicator
│   ├── Lightbox                     Fullscreen image overlay, Escape/click-to-close, caption + alt
│   ├── ConfirmDialog                Destructive action confirmation
│   ├── Toast                        Notification toast with auto-dismiss
│   ├── Pagination                   Einheitliche Pagination
│   └── CookieConsent                GDPR banner, accept/decline analytics, privacy policy link
├── CSS Modules (8)
│   ├── card-styles.ts               .card, .card--embassy (pulsing ring + gradient hover)
│   ├── form-styles.ts               .form, .form__group, .form__input/.form__textarea/.form__select
│   ├── view-header-styles.ts        .view, .view__header, .view__title, .view__create-btn
│   ├── panel-button-styles.ts       .panel__btn base + --edit, --danger, --generate variants
│   ├── settings-styles.ts           .settings-panel, .settings-form, .settings-btn, .settings-toggle
│   ├── info-bubble-styles.ts        Game mechanics info bubble tooltips
│   ├── panel-cascade-styles.ts      Detail panel staggered cascade entrance animations
│   ├── typography-styles.ts         Shared typography patterns
│   └── grid-layout-styles.ts       Entity card grids (.entity-grid, --grid-min-width, responsive breakpoints)
└── Base Class (1)
    └── BaseSettingsPanel            Abstract base for simulation_settings-backed panels (load/save/dirty-tracking)
```

**card-styles.ts — Embassy-Variante:**
Das Shared CSS Modul `cardStyles` enthaelt neben den Standard-Card-Styles (`hover`, `active`) eine `.card--embassy` Variante fuer Embassy-Gebaeude und Ambassador-Agenten:
- **Non-Hover:** Pulsierender Ring via `box-shadow: 0 0 0 1px→5px` mit Theme-Farben (`--color-primary` → `--color-text-secondary`). Funktioniert mit `border-radius`.
- **Hover:** Gradient-Border (padding-box/border-box Trick) + Gradient-Fill-Overlay (`::after` Pseudo-Element) + Lift + Glow.
- Verwendet per-Simulation Theme-Farben fuer einzigartige visuelle Identitaet je Welt.
- Angewandt in: `VelgAgentCard` (`agent.is_ambassador`), `VelgBuildingCard` (`building.special_type === 'embassy'`).

---

## Inkonsistenzen aus dem Altsystem → Lösungen

### U1: Form-CSS dupliziert → Shared Form Styles

**Problem:** Identischer Form-CSS in 5+ Modal-Komponenten.

**Lösung:**
```typescript
// shared/styles/form-styles.ts
export const formStyles = css`
  .form-group { ... }
  .form-label { ... }
  .form-input { ... }
  .form-select { ... }
  .form-textarea { ... }
  .form-error { ... }
`;

// In Modals:
static styles = [formStyles, css`/* modal-spezifisch */`];
```

### U2: Filter-UI dupliziert → SharedFilterBar

**Problem:** Identische Filter-Logik in AgentsView, BuildingsView, EventsView, SocialTrendsView.

**Lösung:**
```typescript
@customElement('shared-filter-bar')
export class SharedFilterBar extends LitElement {
  @property({ type: Array }) filters: FilterConfig[] = [];
  @property({ type: String }) searchPlaceholder = '';
  @property({ type: Object }) activeFilters: Record<string, string> = {};

  // Emits: 'filter-change', 'search-change'
}

interface FilterConfig {
  key: string;
  label: string;           // i18n key
  type: 'select' | 'multi-select' | 'text' | 'range';
  options?: TaxonomyValue[];
  defaultValue?: string;
}
```

### U3: Zod-Validierung

**Validierung mit Zod** (parallel zu Pydantic im Backend):
```typescript
import { z } from 'zod';

const AgentCreateSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200),
  system: z.string().min(1, 'System ist erforderlich'),
  gender: z.string().min(1, 'Geschlecht ist erforderlich'),
  description: z.string().optional(),
  loyalty: z.number().min(0).max(100).optional(),
  influence: z.number().min(0).max(100).optional(),
});

type AgentCreate = z.infer<typeof AgentCreateSchema>;

const result = AgentCreateSchema.safeParse(formData);
if (!result.success) {
  const errors = result.error.flatten().fieldErrors;
}
```

### U4: Error/Loading-States → Einheitlich

**Problem:** Jede View zeigt Fehler und Loading anders.

**Lösung:**
```typescript
@customElement('error-state')
export class ErrorState extends LitElement {
  @property() message: string;
  @property() retryable = true;
  // Emits: 'retry'
}

@customElement('loading-state')
export class LoadingState extends LitElement {
  @property() message: string;     // i18n key
  @property() variant: 'spinner' | 'skeleton' | 'dots';
}

@customElement('empty-state')
export class EmptyState extends LitElement {
  @property() message: string;     // i18n key
  @property() icon: string;
  @property() actionLabel?: string; // i18n key
  // Emits: 'action'
}
```

### U5-U9: Weitere Fixes

| # | Problem | Lösung |
|---|---------|--------|
| U5 | Event-Naming gemischt | Einheitlich kebab-case: `filter-change`, `item-select` |
| U6 | State-Management gemischt | Alle Komponenten nutzen SignalWatcher |
| U7 | Inline Farb-Werte | Nur Design-Tokens, keine hardcodierten Werte |
| U8 | Keine Validierung | **Zod** Schema-Validierung (TypeScript-first, Pydantic-Aequivalent) |
| U9 | Hardcodierte Strings | **@lit/localize** i18n-System (Runtime-Mode): `msg('Loading...')` |

---

## Typ-Definitionen: 1 Source of Truth

### Problem (Altsystem)

6 Typ-Dateien mit massiver Duplikation:
- Agent: 2 verschiedene Definitionen (index.ts + api.ts)
- Building: 2 verschiedene Definitionen
- Event: 2 verschiedene Namen + Struktur (GameEvent vs Event)
- ChatMessage: 2 komplett unterschiedliche Definitionen (common.ts + myagent.ts)

### Lösung: Konsolidierte Typ-Struktur

```
frontend/src/types/
├── models/
│   ├── simulation.ts       # Simulation, SimulationMember, SimulationSetting
│   ├── agent.ts            # Agent, AgentProfession
│   ├── building.ts         # Building, BuildingRelation, BuildingRequirement
│   ├── event.ts            # Event, EventReaction
│   ├── campaign.ts         # Campaign, CampaignMetric
│   ├── social.ts           # SocialTrend, SocialMediaPost, SocialMediaComment
│   ├── chat.ts             # ChatConversation, ChatMessage
│   ├── location.ts         # City, Zone, CityStreet
│   ├── taxonomy.ts         # SimulationTaxonomy, TaxonomyType
│   └── prompt.ts           # PromptTemplate
├── api/
│   ├── requests.ts         # Alle Request-DTOs
│   ├── responses.ts        # Alle Response-Typen
│   └── common.ts           # ApiResponse<T>, PaginatedResponse<T>, ErrorResponse
├── ui/
│   ├── forms.ts            # FormFieldConfig, ValidationRule
│   ├── filters.ts          # FilterConfig, SortConfig
│   └── modals.ts           # ModalConfig, ModalState
└── index.ts                # Re-Exports
```

**Regel:** Jeder Typ existiert genau EINMAL. Alle Imports über `types/index.ts`.

---

## State Management mit Simulation-Kontext

### AppStateManager (erweitert)

```typescript
class AppStateManager {
  // Plattform-State
  currentUser = signal<User | null>(null);
  userLocale = signal<string>('en');
  simulations = signal<Simulation[]>([]);

  // Aktive Simulation
  currentSimulation = signal<Simulation | null>(null);
  currentRole = signal<SimulationRole | null>(null);

  // Simulation-spezifischer State
  agents = signal<Agent[]>([]);
  buildings = signal<Building[]>([]);
  events = signal<Event[]>([]);
  taxonomies = signal<Record<TaxonomyType, TaxonomyValue[]>>({});
  settings = signal<Record<string, any>>({});

  // UI State
  modals = {
    agent: signal<ModalState>({ open: false }),
    building: signal<ModalState>({ open: false }),
    event: signal<ModalState>({ open: false }),
    settings: signal<ModalState>({ open: false }),
  };

  // Computed
  isOwner = computed(() =>
    this.currentRole.value === 'owner'
  );
  canEdit = computed(() =>
    ['owner', 'admin', 'editor'].includes(this.currentRole.value ?? '')
  );
  canAdmin = computed(() =>
    ['owner', 'admin'].includes(this.currentRole.value ?? '')
  );

  // Taxonomy-Helpers
  getGenders = computed(() =>
    this.taxonomies.value.gender ?? []
  );
  getProfessions = computed(() =>
    this.taxonomies.value.profession ?? []
  );
}
```

### Simulation-Wechsel

```typescript
async switchSimulation(simulationId: string) {
  // 1. Simulation laden
  const sim = await simulationsApi.getSimulation(simulationId);
  this.currentSimulation.value = sim.data;

  // 2. Rolle bestimmen
  const member = sim.data.members?.find(m => m.user_id === this.currentUser.value?.id);
  this.currentRole.value = member?.role ?? null;

  // 3. Taxonomien laden
  const taxonomies = await taxonomiesApi.getAll(simulationId);
  this.taxonomies.value = groupByType(taxonomies.data);

  // 4. Settings laden
  const settings = await settingsApi.getAll(simulationId);
  this.settings.value = flattenSettings(settings.data);

  // 5. Initiale Daten laden (Components laden eigene Daten)
  // → Components reagieren auf currentSimulation-Signal-Change
}
```

---

## Routing

**Technologie:** `@lit-labs/router` — Lit-nativer Router als Reactive Controller. Basiert auf der [URLPattern API](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) (Baseline 2025). Routes werden deklarativ als Teil der Komponenten-Definition konfiguriert.

```typescript
// app-shell.ts
import { Routes } from '@lit-labs/router';
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('app-shell')
export class AppShell extends LitElement {
  private routes = new Routes(this, [
    { path: '/',                                    redirect: '/simulations' },
    { path: '/simulations',                         render: () => html`<simulations-dashboard></simulations-dashboard>` },
    { path: '/simulations/:simId/agents',           render: ({ simId }) => html`<agents-view .simulationId=${simId}></agents-view>` },
    { path: '/simulations/:simId/buildings',        render: ({ simId }) => html`<buildings-view .simulationId=${simId}></buildings-view>` },
    { path: '/simulations/:simId/settings',         render: ({ simId }) => html`<settings-view .simulationId=${simId}></settings-view>` },
    { path: '/simulations/:simId/settings/:tab',    render: ({ simId, tab }) => html`<settings-view .simulationId=${simId} .activeTab=${tab}></settings-view>` },
    // ... alle Routes
  ]);

  render() {
    return html`${this.routes.outlet()}`;
  }
}
```

### Route-Definitionen

```
/                                    → Redirect zu /simulations
/multiverse                         → CartographerMap
/simulations                        → SimulationsDashboard
/simulations/new                    → CreateSimulationWizard
/simulations/:slug                  → Redirect zu /simulations/:slug/lore
/simulations/:slug/lore             → SimulationLoreView (default landing)
/simulations/:slug/agents           → AgentsView
/simulations/:slug/agents/:id       → AgentDetailsPanel
/simulations/:slug/buildings        → BuildingsView
/simulations/:slug/buildings/:id    → BuildingDetailsPanel
/simulations/:slug/events           → EventsView
/simulations/:slug/events/:id       → EventDetailsPanel
/simulations/:slug/chat             → ChatView
/simulations/:slug/chat/:convId     → ChatWindow
/simulations/:slug/trends           → SocialTrendsView
/simulations/:slug/campaigns        → CampaignDashboard
/simulations/:slug/social           → SocialMediaView
/simulations/:slug/locations        → LocationsView
/simulations/:slug/health           → SimulationHealthView
/simulations/:slug/epochs           → EpochCommandCenter
/simulations/:slug/settings         → SettingsView
/simulations/:slug/settings/:tab    → SettingsView (spezifischer Tab)
/simulations/:slug/members          → MembersView
/how-to-play                        → HowToPlayView
/epoch/join                         → EpochInviteAcceptView (token-based invite acceptance)
/auth/login                         → LoginView
/auth/register                      → RegisterView
/invite/:token                      → InvitationAcceptView
/profile                            → UserProfileView
```

---

## Service-Layer (Hybrid-Architektur)

Das Frontend kommuniziert mit **zwei Targets**: Supabase direkt (Auth, Realtime) und FastAPI (Business-Logik, 23 API services).

### Supabase Direct Services

```
frontend/src/services/supabase/
├── client.ts                       # Shared Supabase Client-Instanz
└── SupabaseAuthService.ts          # Auth: Login, Signup, Logout, Password-Reset
```

```typescript
// client.ts — Shared Supabase Client
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

Siehe **10_AUTH_AND_SECURITY.md** für vollständige Code-Beispiele der Supabase Services.

### FastAPI Business-Logic Services

```
frontend/src/services/api/
├── BaseApiService.ts               # Basis mit JWT-Header, Error-Handling, getPublic(), getSimulationData() (auth+role check)
├── SimulationsApiService.ts        # Simulations CRUD + slug resolution
├── MembersApiService.ts            # Simulation membership management
├── SettingsApiService.ts           # Simulation settings (design, AI, integration, access)
├── TaxonomiesApiService.ts         # Taxonomy values per simulation
├── AgentsApiService.ts             # Agent CRUD + profession assignment
├── BuildingsApiService.ts          # Building CRUD
├── EventsApiService.ts             # Event CRUD + reactions
├── ChatApiService.ts               # Conversations + messages
├── GenerationApiService.ts         # AI generation (portraits, descriptions, relationships)
├── SocialTrendsApiService.ts       # Social trends
├── SocialMediaApiService.ts        # Social media posts + comments
├── CampaignsApiService.ts          # Campaign management
├── PromptTemplatesApiService.ts    # Prompt template CRUD
├── LocationsApiService.ts          # Cities, zones, streets
├── UsersApiService.ts              # User profile + memberships
├── InvitationsApiService.ts        # Simulation invitations
├── RelationshipsApiService.ts      # Agent relationships (Phase 6)
├── EchoesApiService.ts             # Event echoes / Bleed mechanic (Phase 6)
├── ConnectionsApiService.ts        # Simulation connections + map data (Phase 6)
├── EmbassiesApiService.ts          # Embassy buildings + ambassador management
├── EpochsApiService.ts             # Competitive epochs, operatives, scoring
├── EpochChatApiService.ts          # Epoch chat messages (REST catch-up) + ready signals
├── HealthApiService.ts             # Simulation health + game mechanics
├── BotApiService.ts                # Bot player preset CRUD + add/remove bot from epoch
├── NotificationPreferencesApiService.ts  # Notification preferences (GET + POST /users/me/notification-preferences)
└── index.ts                        # Re-exports all service singletons
```

**26 API services** (excluding BaseApiService and index.ts).

### Platform-Level Services

```
frontend/src/services/
├── AppStateManager.ts              # Preact Signals global state
├── NotificationService.ts          # In-app notifications
├── ThemeService.ts                 # Per-simulation theming, CSS custom property injection
├── theme-presets.ts                # 5 theme presets (brutalist, fantasy, deep-space-horror, arc-raiders, solarpunk)
├── SeoService.ts                   # Meta tags, document title, structured data
├── AnalyticsService.ts             # GA4 event tracking (37 events)
├── GenerationProgressService.ts    # AI generation progress tracking
├── i18n/
│   └── locale-service.ts           # LocaleService: initLocale, setLocale, getInitialLocale
└── realtime/
    └── RealtimeService.ts          # Singleton: 4 Supabase Realtime channels with Preact Signals
```

**RealtimeService** (`realtimeService` singleton) manages all Supabase Realtime channels for epoch gameplay. Exposes reactive Preact Signals consumed by epoch components:

| Signal | Type | Description |
|--------|------|-------------|
| `onlineUsers` | `Signal<PresenceUser[]>` | Currently online epoch participants |
| `epochMessages` | `Signal<EpochChatMessage[]>` | Epoch-wide chat message feed |
| `teamMessages` | `Signal<EpochChatMessage[]>` | Team-only chat message feed |
| `readyStates` | `Signal<Record<string, boolean>>` | Cycle readiness per simulation_id |
| `unreadEpochCount` | `Signal<number>` | Unread epoch chat badge counter |
| `unreadTeamCount` | `Signal<number>` | Unread team chat badge counter |

**Channel naming convention:**
| Channel | Protocol | Purpose |
|---------|----------|---------|
| `epoch:{id}:chat` | Broadcast | Epoch-wide chat messages |
| `epoch:{id}:presence` | Presence | Online user tracking |
| `epoch:{id}:status` | Broadcast | Ready signals, cycle events |
| `epoch:{id}:team:{tid}:chat` | Broadcast | Team-only chat messages |

**Lifecycle:** `joinEpoch(epochId, userId, simulationId, simulationName)` subscribes to all channels. `leaveEpoch(epochId)` unsubscribes and resets signals. `joinTeam(epochId, teamId)` / `leaveTeam()` manage team channel. Focus methods (`setEpochChatFocused`, `setTeamChatFocused`) reset unread counters.

### BaseApiService (erweitert)

```typescript
import { supabase } from '../supabase/client.js';

class BaseApiService {
  protected getSimulationUrl(path: string): string {
    const simId = appState.currentSimulation.value?.id;
    if (!simId) throw new Error('No simulation selected');
    return `/api/v1/simulations/${simId}${path}`;
  }

  // JWT aus Supabase Session für FastAPI-Requests
  private async getAuthHeader(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error('Not authenticated');
    return { 'Authorization': `Bearer ${data.session.access_token}` };
  }

  // Alle Requests automatisch mit Simulation-Context + JWT
  protected async get<T>(path: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const url = this.getSimulationUrl(path);
    const headers = await this.getAuthHeader();
    return this.request<T>('GET', url, { params, headers });
  }

  // ... POST, PUT, DELETE analog
}
```

### Zustaendigkeits-Aufteilung

| Aktion | Service | Target |
|--------|---------|--------|
| Login, Signup, Logout | SupabaseAuthService | Supabase direkt |
| Password Reset | SupabaseAuthService | Supabase direkt |
| Agents/Buildings/Events CRUD | AgentsApiService etc. | FastAPI |
| AI-Generierung | GenerationApiService | FastAPI |
| Settings, Taxonomien | SettingsApiService | FastAPI |
| News/Social Media | SocialTrendsApiService | FastAPI |
| Relationships, Echoes, Connections | RelationshipsApi, EchoesApi, ConnectionsApi | FastAPI |
| Embassies, Epochs, Health | EmbassiesApi, EpochsApi, HealthApi | FastAPI |
| Epoch Chat (REST catch-up) | EpochChatApiService | FastAPI |
| Bot Players (presets, add/remove from epoch) | BotApiService | FastAPI |
| Notification Preferences (get + upsert) | NotificationPreferencesApiService | FastAPI |
| Epoch Realtime (live messages, presence, ready) | RealtimeService | Supabase Realtime |

---

## Settings-UI Spezifikation

### Tab-Layout

```
┌─────────────────────────────────────────────────────────┐
│  Settings                                                │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ General  │  Simulation: Velgarien                       │
│ World    │  ─────────────────────────────               │
│ AI       │  Name: [Velgarien          ]                 │
│ Integr.  │  Slug: [velgarien          ] (read-only)     │
│ Design   │  Theme: [Dystopian        ▾]                 │
│ Access   │  Content Locale: [Deutsch ▾]                 │
│          │  Additional: [☑ English   ]                  │
│          │  Description:                                │
│          │  [Textarea...                    ]           │
│          │                                              │
│          │  [Save Changes]                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

### World Settings → Taxonomy Editor

```
┌─────────────────────────────────────────────────────────┐
│ World Settings                                           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Taxonomy: [Professions ▾]                                │
│                                                          │
│ ┌─────┬──────────────┬───────────────┬──────┬────────┐ │
│ │ Ord │ Value         │ Label (DE)    │ Active │ Actions│ │
│ ├─────┼──────────────┼───────────────┼──────┼────────┤ │
│ │  1  │ scientist     │ Wissenschaft. │  ✅  │ ✏️ 🗑️  │ │
│ │  2  │ leader        │ Führungspers. │  ✅  │ ✏️ 🗑️  │ │
│ │  3  │ military      │ Militär       │  ✅  │ ✏️ 🗑️  │ │
│ │  4  │ engineer      │ Ingenieur     │  ✅  │ ✏️ 🗑️  │ │
│ │ ... │ ...           │ ...           │ ...  │ ...    │ │
│ └─────┴──────────────┴───────────────┴──────┴────────┘ │
│                                                          │
│ [+ Add New Value]                                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Design Settings → Theme Editor

```
┌─────────────────────────────────────────────────────────┐
│ Design Settings                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ ── Preset ──                                             │
│ [Brutalist] [Sunless Sea] [Solarpunk] [Cyberpunk] [Nord.]│
│                                                          │
│ ── Colors (16) ──                                        │
│ Primary:   [■ #000000]  Hover:    [■ #1a1a1a]           │
│ Secondary: [■ #3b82f6]  Accent:   [■ #f59e0b]           │
│ Background:[■ #ffffff]  Surface:  [■ #f5f5f5]           │
│ Text:      [■ #0a0a0a]  Muted:    [■ #a3a3a3]           │
│ Border:    [■ #000000]  Danger:   [■ #dc2626]           │
│ ...                                                      │
│                                                          │
│ ── Typography (7) ──                                     │
│ Heading Font: [Courier New, monospace        ]           │
│ Body Font:    [system-ui, sans-serif         ]           │
│ Weight: [900 ▾]  Transform: [uppercase ▾]               │
│ Base Size: [16px ]                                       │
│                                                          │
│ ── Character ──                                          │
│ Border Radius: [0     ]  Shadow Style: [offset ▾]       │
│ Shadow Color:  [■ #000]  Hover Effect: [translate ▾]    │
│                                                          │
│ ── Animation ──                                          │
│ Speed: [1.0x   ]  Easing: [ease ▾]                      │
│                                                          │
│ ── Custom CSS ──                                         │
│ [Textarea max 10KB...                        ]           │
│                                                          │
│ [Save Changes]                                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Alle Änderungen zeigen eine Live-Preview innerhalb der Shell. Preset-Auswahl füllt alle Felder mit Preset-Werten. Siehe `18_THEMING_SYSTEM.md` für vollständige Token-Taxonomie.

---

## Komponenten-Zaehlung (Aktuell)

| Verzeichnis | Dateien | @customElement | Beschreibung |
|-------------|---------|----------------|--------------|
| platform/ | 9 | 9 | Header, Dashboard, Wizard, Profile, Lore, DevAccounts |
| auth/ | 3 | 3 | Login, Register, LoginPanel (Bureau terminal HUD aesthetic) |
| layout/ | 3 | 3 | Shell, Header, Nav |
| agents/ | 6 | 6 | View, Card, EditModal, DetailsPanel, RelationshipCard/EditModal |
| buildings/ | 6 | 6 | View, Card, EditModal, DetailsPanel, EmbassyCreate/Link |
| events/ | 6 | 6 | View, Card, EditModal, DetailsPanel, EchoCard/TriggerModal |
| chat/ | 7 | 7 | View, Window, ConversationList, MessageList/Input, AgentSelector, EventPicker |
| social/ | 9 | 9 | TrendsView, MediaView, CampaignDashboard, Cards, Modals, TrendFilterBar |
| locations/ | 5 | 5 | View, CityList, ZoneList, StreetList, LocationEditModal |
| lore/ | 7 | 1 | SimulationLoreView + lore-content dispatcher + 5 content files (per-simulation) |
| multiverse/ | 12 | 8 | CartographerMap, MapGraph, MapGraph3D, MapTooltip, MapConnectionPanel, MapBattleFeed, MapLeaderboardPanel, MapMinimap + 4 utilities (map-force, map-data, map-types, map-three-render) |
| settings/ | 10 | 10 | SettingsView + 9 panels (General, World, AI, Integration, Design, Access, Prompts, Bleed, Notifications) |
| health/ | 1 | 1 | SimulationHealthView (game metrics dashboard) |
| epoch/ | 19 | 19 | CommandCenter (orchestrator), OpsBoard, OverviewTab, IntelDossierTab, OperationsTab, AlliancesTab, LobbyActions, CreationWizard, DraftRosterPanel, Leaderboard, BattleLog, MissionCard, DeployOperativeModal, InvitePanel, InviteAcceptView, ChatPanel, PresenceIndicator, ReadyPanel, BotConfigPanel |
| how-to-play/ | 5 | 1 | HowToPlayView + htp-styles (extracted CSS) + 3 content/type files (htp-types, htp-content-rules, htp-content-matches) |
| shared/ | 28 | 17 | 17 components + 10 CSS modules + 1 base class |
| **Gesamt** | **143** | **117** (in components/) | **19 Verzeichnisse** |

### Utilities

```
frontend/src/utils/
├── text.ts                         # getInitials() helper
├── icons.ts                        # Centralized SVG icons with aria-hidden="true"
├── operative-icons.ts              # Centralized operative-type SVG icons (spy, guardian, saboteur, propagandist, infiltrator, assassin, zone_fortified)
└── theme-colors.ts                 # Theme color utilities
```

---

## Multiverse Map (Phase 6)

### Route und Navigation

- **Route:** `/multiverse` (Plattform-Level, registriert in `app-shell.ts`)
- **PlatformHeader Nav-Link:** "Map" / "Karte" (i18n)
- **SEO:** `seoService.setTitle(['Multiverse Map'])` + `analyticsService.trackPageView('/multiverse', 'Multiverse Map')`

### Datei-Struktur

```
frontend/src/components/multiverse/
├── CartographerMap.ts        # Hauptkomponente: Daten-Loading, Layout, Mobile-Fallback
├── MapGraph.ts               # SVG-Rendering: Knoten, Kanten, Pan/Zoom, Force-Simulation
├── map-force.ts              # Force-directed Algorithmus (kein Framework — eigene Physik)
├── map-types.ts              # TypeScript Interfaces: MapNodeData, MapEdgeData, ForceConfig
├── map-data.ts               # Statische Konfiguration: Theme-Farben, Vector-Labels
├── MapTooltip.ts             # Hover-Tooltip mit Simulations-Beschreibung + Statistiken
├── MapConnectionPanel.ts     # Edge-Detail-Panel (erweitert VelgSidePanel)
├── MapBattleFeed.ts          # Scrollender Battle-Log-Ticker am unteren Kartenrand
├── MapLeaderboardPanel.ts    # VelgSidePanel fuer Epoch-Scores bei Instanz-Klick
└── MapMinimap.ts             # 150×100px Viewport-Uebersicht unten rechts
```

### VelgCartographerMap (`velg-cartographer-map`)

Hauptkomponente, laedt Multiverse-Daten vom Backend und transformiert sie in Graph-Knoten/Kanten.

**Tag:** `<velg-cartographer-map>`

**State:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `_loading` | `boolean` | Ladeindikator |
| `_error` | `string \| null` | Fehlermeldung |
| `_nodes` | `MapNodeData[]` | Transformierte Simulations-Knoten |
| `_edges` | `MapEdgeData[]` | Transformierte Connection-Kanten |
| `_selectedEdge` | `MapEdgeData \| null` | Fuer Connection-Detail-Panel |
| `_panelOpen` | `boolean` | Panel-Sichtbarkeit |

**Daten-Loading:** `connectionsApi.getMapData()` liefert `MapData` (Simulationen mit Zaehler, Connections, Echo-Counts). Transformiert zu `MapNodeData` (Position, Farbe, Statistiken) und `MapEdgeData` (Source/Target, Typ, Vektoren, Staerke).

**Events:**
| Event | Detail | Beschreibung |
|-------|--------|-------------|
| `navigate` | `string` (Pfad) | Node-Klick navigiert zu `/simulations/{id}/lore` |

**Responsive:** SVG-Graph ab 769px (via MapGraph), vertikale Karten-Liste bis 768px (Mobile Fallback mit farbigen Seitenstreifen).

**Methoden:**
- `_loadData()` — Laedt Map-Daten, transformiert zu Knoten/Kanten
- `_handleNodeClick(e)` — Navigiert zur Simulation (pushState + CustomEvent)
- `_handleEdgeClick(e)` — Oeffnet MapConnectionPanel
- `_renderMobileList()` — Karten-Fallback fuer Mobile

### VelgMapGraph (`velg-map-graph`)

SVG-basierter Force-directed Graph mit Pan/Zoom und Node/Edge-Interaktionen.

**Tag:** `<velg-map-graph>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `nodes` | `MapNodeData[]` | Graph-Knoten (Simulationen) |
| `edges` | `MapEdgeData[]` | Graph-Kanten (Connections) |

**State:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `_viewBox` | `string` | SVG viewBox fuer Pan/Zoom |
| `_tooltipNode` | `MapNodeData \| null` | Aktuell ge-hoverte Node |
| `_tooltipX` / `_tooltipY` | `number` | Tooltip-Position |

**Events:**
| Event | Detail | Beschreibung |
|-------|--------|-------------|
| `node-click` | `MapNodeData` | Knoten angeklickt |
| `edge-click` | `MapEdgeData` | Kante angeklickt |

**Rendering:**
- **Knoten:** Kreis mit Banner-Bild (clipPath), Glow-Filter (`feGaussianBlur`), farbiger Border-Ring, Label + Statistik-Text. Radius: 52px.
- **Kanten:** Quadratische Bezier-Kurven (`Q`) mit Perpendikular-Offset. Gestrichelt (`stroke-dasharray: 8 6`) mit CSS `dash-flow` Animation. Strichstaerke proportional zur Connection-Staerke.
- **Tooltip:** `<velg-map-tooltip>` positioniert am Mauszeiger.

**Interaktion:**
- **Pan:** Mausklick + Ziehen verschiebt viewBox
- **Zoom:** Mausrad aendert Zoom (0.5x bis 3x), aktualisiert viewBox
- **Hover:** Zeigt Tooltip mit Simulations-Name, Beschreibung, Statistiken
- **Resize:** `window.addEventListener('resize')` in connectedCallback/disconnectedCallback

**Force-Simulation:** Startet in `firstUpdated()` und bei Property-Updates via `requestAnimationFrame`-Loop. Konvergiert bei Energie < 0.5 oder nach 300 Iterationen.

### map-force.ts

Eigenstaendiger Force-directed Algorithmus ohne externe Abhaengigkeiten.

**Exports:**
- `initializePositions(nodes, width, height)` — Verteilt Knoten kreisfoermig um den Mittelpunkt
- `simulateTick(nodes, edges, width, height, config?)` — Ein Simulations-Tick, gibt kinetische Energie zurueck
- `runSimulation(nodes, edges, width, height, maxIterations?, threshold?)` — Laeuft bis Konvergenz

**Kraefte:**
| Kraft | Formel | Beschreibung |
|-------|--------|-------------|
| Coulomb-Abstossung | `F = repulsion / d^2` | Alle Knoten-Paare stossen sich ab |
| Hooke-Anziehung | `F = attraction * d * strength` | Verbundene Knoten ziehen sich an (proportional zur Edge-Staerke) |
| Zentrierung | `F = centerForce * (center - pos)` | Zieht alle Knoten zur Mitte |
| Daempfung | `v = (v + F) * damping` | 0.85 Daempfungsfaktor verhindert Oszillation |
| Kollisionsvermeidung | Clamp to bounds | Knoten bleiben innerhalb der SVG-Grenzen |

**Default-Konfiguration:**
```typescript
{
  repulsion: 50000,
  attraction: 0.001,
  centerForce: 0.005,
  damping: 0.85,
  minDistance: 140,
  nodeRadius: 60,
}
```

**Symmetrie-Brecher:** Wenn Knoten ueberlappen (Distanz < 1px), wird zufaelliger Jitter addiert.

### map-types.ts

**Interfaces:**
```typescript
interface MapNodeData {
  id: string;
  name: string;
  slug: string;
  theme: string;
  description?: string;
  bannerUrl?: string;
  agentCount: number;
  buildingCount: number;
  eventCount: number;
  echoCount: number;
  x: number;          // Position (aktualisiert durch Force-Simulation)
  y: number;
  vx: number;         // Geschwindigkeit
  vy: number;
  color: string;       // Theme-Farbe
}

interface MapEdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  connectionType: string;
  bleedVectors: string[];
  strength: number;      // 0..1, beeinflusst Strichstaerke + Anziehungskraft
  description?: string;
}

interface ForceConfig {
  repulsion: number;
  attraction: number;
  centerForce: number;
  damping: number;
  minDistance: number;
  nodeRadius: number;
}
```

### map-data.ts — Theme-Integration

Statische Farb-Zuordnung fuer Knoten-Borders und Glow-Effekte. Korrespondiert mit `SimulationCard.ts` `THEME_COLORS`.

```typescript
const THEME_COLORS: Record<string, string> = {
  dystopian: '#ef4444',    // Velgarien
  dark: '#ef4444',
  fantasy: '#f59e0b',      // The Gaslit Reach
  utopian: '#22c55e',
  scifi: '#06b6d4',        // Station Null
  historical: '#a78bfa',
  custom: '#a855f7',
};
```

**Hilfsfunktionen:**
- `getThemeColor(theme)` — Farbe mit `#888888` Fallback
- `getGlowColor(theme)` — Farbe + `66` Alpha-Suffix (40% Transparenz)
- `VECTOR_LABELS` — Anzeige-Namen fuer Bleed-Vektoren (commerce, language, memory, resonance, architecture, dream, desire)

### VelgMapConnectionPanel (`velg-map-connection-panel`)

Detail-Panel fuer angeklickte Kanten, erweitert `VelgSidePanel`.

**Tag:** `<velg-map-connection-panel>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `edge` | `MapEdgeData \| null` | Aktuelle Kante |
| `nodes` | `MapNodeData[]` | Alle Knoten (fuer Name-Lookup) |
| `open` | `boolean` | Panel-Sichtbarkeit |

**Events:**
| Event | Detail | Beschreibung |
|-------|--------|-------------|
| `panel-close` | - | Panel schliessen |

**Anzeige:** Source-Name <-> Target-Name, Connection Type, Bleed Vectors (als `VelgBadge`), Strength-Bar (prozentual), optionale Beschreibung.

### VelgMapTooltip (`velg-map-tooltip`)

Hover-Tooltip, positioniert absolut am Mauszeiger. `pointer-events: none`.

**Tag:** `<velg-map-tooltip>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `node` | `MapNodeData \| null` | Ge-hoverter Knoten (null = versteckt) |
| `x` | `number` | X-Position (offsetX + 12px) |
| `y` | `number` | Y-Position (offsetY - 10px) |

**Anzeige:** Simulations-Name (bold, uppercase), optionale Beschreibung, Statistiken (Agents / Buildings / Events).

---

## Agent Relationships UI (Phase 6)

### VelgRelationshipCard (`velg-relationship-card`)

Kompakte Karte fuer eine Agent-Beziehung mit Avatar, Typ-Badge, Intensitaets-Balken und Aktionen.

**Tag:** `<velg-relationship-card>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `relationship` | `AgentRelationship` | Beziehungs-Daten |
| `currentAgentId` | `string` | ID des aktuellen Agents (bestimmt "other" Seite) |

**Events:**
| Event | Detail | Beschreibung |
|-------|--------|-------------|
| `relationship-click` | `{ agentId: string }` | Klick auf Karte — navigiert zum anderen Agent |
| `relationship-edit` | `AgentRelationship` | Edit-Button geklickt |
| `relationship-delete` | `AgentRelationship` | Delete-Button geklickt |

**Rendering:**
- **Avatar:** `VelgAvatar` (size="sm") des anderen Agents
- **Name:** Brutalist uppercase, ellipsis bei Ueberlauf
- **Typ-Badge:** `VelgBadge` variant="primary" mit `relationship_type`
- **Mutual-Badge:** `VelgBadge` variant="info" wenn `is_bidirectional === true`
- **Intensitaets-Balken:** 10 Segmente, Hoehe gestaffelt (3px + i*1.3), Farb-Klassen: active (< 5), medium (5-7), high (>= 8)
- **Aktionen:** Edit + Delete `VelgIconButton` (nur sichtbar wenn `appState.canEdit.value`)

**Styles:** Erweitert `cardStyles` (Shared CSS Modul). Horizontales Flex-Layout (Avatar | Body | Actions).

### VelgRelationshipEditModal (`velg-relationship-edit-modal`)

Modal zum Erstellen/Bearbeiten von Agent-Beziehungen, erweitert `BaseModal`.

**Tag:** `<velg-relationship-edit-modal>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `relationship` | `AgentRelationship \| null` | Bestehende Beziehung (null = Erstellen) |
| `simulationId` | `string` | Aktuelle Simulation |
| `sourceAgentId` | `string` | ID des Quell-Agents |
| `agents` | `Agent[]` | Alle Agents der Simulation (fuer Target-Dropdown) |
| `open` | `boolean` | Modal-Sichtbarkeit |

**Events:**
| Event | Detail | Beschreibung |
|-------|--------|-------------|
| `relationship-saved` | `AgentRelationship` | Beziehung erfolgreich gespeichert |
| `modal-close` | - | Modal schliessen |

**Formular-Felder:**
- **Target Agent** (nur im Erstellen-Modus): Dropdown, gefiltert (ohne `sourceAgentId`)
- **Relationship Type:** Dropdown aus `appState.getTaxonomiesByType('relationship_type')` mit locale-aware Labels
- **Intensity:** Range-Slider 1-10, numerische Anzeige
- **Bidirectional:** Checkbox-Toggle
- **Description:** Textarea (optional)

**Validierung:** `target_agent_id` erforderlich (nur Erstellen), `relationship_type` erforderlich. Inline-Fehler pro Feld + API-Fehler-Anzeige.

**API:** `relationshipsApi.create()` / `relationshipsApi.update()` mit vollstaendigem Fehler-Handling.

### Integration in AgentDetailsPanel

- **Aptitudes Section:** Akkordeon-Abschnitt vor Relationships. `VelgAptitudeBars` in editable mode (`editable=true`, `size="lg"`). Laedt Aptitude-Daten via `aptitudesApi.getForAgent()` bei Panel-Open. Speichert via `aptitudesApi.updateForAgent()` mit Dirty-Tracking. Zeigt Budget-Info (verbleibende Punkte). Jeder operative_type als horizontaler Balken mit Label + Zahlenwert (3-9).
- **Relationships Section:** Letzter Akkordeon-Abschnitt, mit `VelgSectionHeader` + Count-Badge
- **Laden:** `_loadRelationships()` via `relationshipsApi.listForAgent()` bei Panel-Open
- **Agent-Liste:** `_loadAllAgents()` (limit=100) fuer das Edit-Modal Target-Dropdown
- **Navigation:** `relationship-click` Event laedt den anderen Agent im selben Panel
- **CRUD:** Erstellen (Button "Add Relationship"), Bearbeiten (Edit-Icon auf Karte), Loeschen (mit ConfirmDialog)
- **AI Relationship Generation:** "Generate Relationships" button calls `generationApi.generateRelationships()` → inline suggestion cards appear with checkboxes (all pre-selected). Each card shows: type badge, target agent name, description, intensity bar (1-10). User reviews → "Save Selected" persists checked suggestions via `relationshipsApi.create()`, "Dismiss" clears. Button shows "Generating..." spinner state during AI call. State: `_generating`, `_suggestions: RelationshipSuggestion[]`, `_selectedSuggestions: Set<number>`, `_savingSuggestions`.

### Integration in AgentCard

- **Property:** `relationshipCount: number` (default 0)
- **Anzeige:** `"{n} connections"` als muted uppercase Text unter den Meta-Feldern (nur wenn > 0)
- **i18n:** `msg(str\`${this.relationshipCount} connections\`)`

---

## Event Echoes UI (Phase 6)

### VelgEchoCard (`velg-echo-card`)

Karte fuer ein Event-Echo mit Source/Target-Simulation, Vektor-Badge, Staerke-Balken und Status.

**Tag:** `<velg-echo-card>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `echo` | `EventEcho` | Echo-Daten |
| `simulations` | `Simulation[]` | Alle Simulationen (fuer Name-Lookup) |

**Events:**
| Event | Detail | Beschreibung |
|-------|--------|-------------|
| `echo-click` | `EventEcho` | Klick auf Karte |

**Rendering:**
- **Route:** `SourceName -> TargetName` (uppercase, brutalist, mit Pfeil-Separator)
- **Badges:** Vektor-Name (variant="primary"), Status (variant je nach Status: pending=warning, generating=info, completed=success, failed=danger, rejected=default)
- **Staerke-Balken:** Track + Fill (prozentual), Label `"Strength: {n}%"`
- **Tiefe:** `"Depth {n}/3"` als muted Text
- **Hover:** translate(-2px, -2px) + shadow-lg

### VelgEchoTriggerModal (`velg-echo-trigger-modal`)

Modal zum Ausloesen eines Event-Echos in eine verbundene Simulation. Nur fuer admin+ Rollen.

**Tag:** `<velg-echo-trigger-modal>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `event` | `SimEvent \| null` | Quell-Event |
| `simulationId` | `string` | Aktuelle Simulation |
| `simulations` | `Simulation[]` | Alle Simulationen |
| `connections` | `SimulationConnection[]` | Aktive Simulation-Connections |
| `open` | `boolean` | Modal-Sichtbarkeit |

**Events:**
| Event | Detail | Beschreibung |
|-------|--------|-------------|
| `echo-triggered` | `EventEcho` | Echo erfolgreich ausgeloest |
| `modal-close` | - | Modal schliessen |

**Formular-Felder:**
- **Source Event:** Readonly-Input (Event-Titel, disabled)
- **Target Simulation:** Dropdown, gefiltert auf verbundene Simulationen (via `connections`, `is_active` geprueft)
- **Echo Vector:** Dropdown, dynamisch basierend auf `_activeConnection.bleed_vectors` (erscheint nach Target-Auswahl)
- **Strength Override:** Range-Slider 0-100% (Step 10%), Voreinstellung aus Connection-Staerke
- **Connection Preview:** Zeigt Typ, Default-Staerke, verfuegbare Vektoren der ausgewaehlten Connection

**Validierung:** Target + Vector erforderlich. Submit-Button disabled bis beides ausgewaehlt.

**API:** `echoesApi.triggerEcho()` mit Fehler-Toast. Formular-Reset bei Modal-Open via `willUpdate`.

### Bleed-Filter in EventsView

- **Toggle:** Checkbox `"Show Bleed events only"` unter der SharedFilterBar
- **State:** `_bleedOnly: boolean` — wenn aktiv, sendet `params.data_source = 'bleed'` an API
- **Reset:** Offset zurueckgesetzt auf 0 bei Toggle
- **Styling:** Label mit brutalist-Font, accent-color: `--color-warning`

### Bleed Badge auf EventCard

- **Bedingung:** `event.data_source === 'bleed'`
- **Anzeige:** `VelgBadge` variant="warning" mit Text "Bleed"
- **Echo-Vektor:** Wenn `external_refs.echo_vector` vorhanden, zeigt zusaetzliche Meta-Zeile mit Sparkle-Icon + `"Echo: {vector}"`

### Integration in EventDetailsPanel

**Bleed Provenance:**
- Nur sichtbar wenn `data_source === 'bleed'` und `external_refs.source_simulation_id` vorhanden
- Zeigt: `"Originated in {SimulationName} via {vector}"` unter `VelgSectionHeader` "Bleed Origin"

**Echoes Section:**
- Laedt via `echoesApi.listForEvent()` bei Panel-Open
- Simulations-Liste via `simulationsApi.list()` fuer Name-Lookup
- Zeigt `VelgEchoCard` pro Echo oder "No echoes yet" als Leer-Zustand
- **Trigger-Button:** `"Trigger Echo"` mit Sparkle-Icon (nur `canAdmin`)
- **Echo-Klick:** Wenn Target-Event vorhanden, dispatcht `event-click` Event zum Navigieren

---

## Epoch Realtime UI

### EpochCommandCenter — COMMS Sidebar

The Operations Board (lobby view when no epoch is selected) includes a **collapsible COMMS sidebar** that provides persistent chat access. Toggle button in the ops board header with satellite dish icon, unread badge counter, and pulsing animation when active.

**Behavior:**
- `_showComms` boolean toggle — opens/closes the sidebar with `comms-open` slide-in animation
- Auto-discovers an active epoch for comms via `_findCommsEpoch()` — scans active/foundation/competition/reckoning epochs, matches current user's participant record
- Joins Realtime channels on discovery (`realtimeService.joinEpoch()`)
- Falls back to "No Active Channel" empty state if no epoch is available
- COMMS sidebar is separate from the detail view — when the user enters an epoch detail, the comms epoch channel is swapped if needed
- Mobile: sidebar goes full-width below ops board (`flex-direction: column` at `<=1200px`)

**CSS Classes:** `.comms-toggle`, `.comms-toggle--active`, `.comms-toggle__unread`, `.comms-sidebar`, `.comms-sidebar__header`, `.comms-sidebar__signal` (animated signal bars), `.comms-sidebar__freq`, `.comms-sidebar__close`, `.comms-sidebar__body`, `.comms-empty`

### VelgEpochChatPanel (`velg-epoch-chat-panel`)

Dual-channel tactical comms interface for epoch player-to-player chat. Dark military HUD aesthetic.

**Tag:** `<velg-epoch-chat-panel>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `epochId` | `string` | Active epoch ID |
| `mySimulationId` | `string` | Current user's simulation ID |
| `myTeamId` | `string` | Current user's team ID (for team channel) |
| `epochStatus` | `string` | Current epoch status (controls send permission) |

**State:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `_activeChannel` | `ChatChannel` | `'epoch'` or `'team'` — tab selection |
| `_input` | `string` | Current message input text |
| `_sending` | `boolean` | Sending state (disables input) |

**Channels:**
- **ALL CHANNELS** (`epoch`): Epoch-wide public diplomacy — all participants see all messages
- **TEAM FREQ** (`team`): Alliance-only encrypted comms — only team members see messages

**Message Flow:**
1. **REST catch-up on mount:** `epochChatApi.listMessages()` / `epochChatApi.listTeamMessages()` loads recent history
2. **Realtime for live messages:** `realtimeService.epochMessages` / `realtimeService.teamMessages` signals append new messages reactively
3. **Send:** `epochChatApi.sendMessage()` (REST POST), message appears via Broadcast return trip

**Message Display:**
- Own transmissions: right-aligned with amber tint (`--amber-glow` background)
- Incoming intel: left-aligned in gray surface
- Each message shows: simulation name (uppercase label), content, relative timestamp
- Messages list auto-scrolls to bottom on new messages
- 2000 character limit on input with character counter

**Unread Badges:**
- Channel tabs show unread counters from `realtimeService.unreadEpochCount` / `realtimeService.unreadTeamCount`
- Counters reset when switching to the channel via `realtimeService.setEpochChatFocused()` / `realtimeService.setTeamChatFocused()`

**Events:**
| Event | Detail | Beschreibung |
|-------|--------|-------------|
| (none) | - | All state managed internally via signals + REST |

### VelgEpochPresenceIndicator (`velg-epoch-presence`)

Compact online/offline signal lamp — a 7px dot that pulses green when the simulation's player is online.

**Tag:** `<velg-epoch-presence>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `simulationId` | `string` | Simulation ID to check presence for |

**State:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `_isOnline` | `boolean` | Computed from `realtimeService.onlineUsers` signal |

**Rendering:**
- **Online:** Green pulsing dot (`#22c55e`) with `box-shadow` glow, `pulse-online` keyframe animation (2s ease-in-out infinite)
- **Offline:** Gray dormant dot (`#555`), no animation
- Tooltip shows "Online" / "Offline"

**Lifecycle:**
- `connectedCallback`: Creates `effect()` subscription to `realtimeService.onlineUsers` signal, checks if any user matches `simulationId`
- `disconnectedCallback`: Disposes effect subscription

### VelgEpochReadyPanel (`velg-epoch-ready-panel`)

Cycle readiness dashboard with segmented progress bar. Shows "4/6 Ready for Resolution" with visual segments for each participant.

**Tag:** `<velg-epoch-ready-panel>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `epochId` | `string` | Active epoch ID |
| `participants` | `EpochParticipant[]` | All epoch participants |
| `mySimulationId` | `string` | Current user's simulation ID |

**State:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `_readyStates` | `Record<string, boolean>` | Computed from `realtimeService.readyStates` signal |
| `_toggling` | `boolean` | Toggle button loading state |

**Rendering:**
- **Header:** "CYCLE READINESS" label + "{n}/{total} Ready" count in amber
- **Segmented bar:** Flex row of segments, one per participant. `bar__seg--ready` (amber, glowing) or `bar__seg--waiting` (dim gray). Stagger-in animation.
- **Participant list:** Each row shows simulation name + check icon (ready) or dash icon (not ready)
- **Toggle button:** "SIGNAL READY" / "REVOKE READY" — calls `epochChatApi.setReady()` then broadcasts via Realtime status channel

**Visibility:** Only displayed during active epoch phases (foundation, competition, reckoning).

### EpochChatApiService

REST API service for epoch chat persistence and ready signals. Live messages arrive via Realtime, but this service handles initial catch-up loading and message sending.

**Singleton:** `epochChatApi` (exported from `EpochChatApiService.ts`)

**Methods:**
| Method | HTTP | Path | Description |
|--------|------|------|-------------|
| `sendMessage(epochId, data)` | POST | `/epochs/{epochId}/chat` | Send a chat message (content, channel_type, simulation_id, team_id?) |
| `listMessages(epochId, params?)` | GET | `/epochs/{epochId}/chat` | List epoch-wide messages (limit, before cursor) |
| `listTeamMessages(epochId, teamId, params?)` | GET | `/epochs/{epochId}/chat/team/{teamId}` | List team messages (limit, before cursor) |
| `setReady(epochId, simulationId, ready)` | POST | `/epochs/{epochId}/ready` | Toggle cycle readiness for a simulation |

### BotApiService

REST API service for bot player preset management and epoch bot assignment.

**Singleton:** `botApi` (exported from `BotApiService.ts`)

**Methods:**
| Method | HTTP | Path | Description |
|--------|------|------|-------------|
| `listPresets()` | GET | `/bot-players` | List current user's bot presets |
| `createPreset(data)` | POST | `/bot-players` | Create a new bot preset (name, personality, difficulty, config) |
| `updatePreset(id, data)` | PATCH | `/bot-players/{id}` | Update a bot preset |
| `deletePreset(id)` | DELETE | `/bot-players/{id}` | Delete a bot preset |
| `addBotToEpoch(epochId, data)` | POST | `/epochs/{epochId}/add-bot` | Add a bot participant to an epoch (bot_player_id, simulation_id) |
| `removeBotFromEpoch(epochId, participantId)` | DELETE | `/epochs/{epochId}/remove-bot/{participantId}` | Remove a bot participant from an epoch |

### NotificationPreferencesApiService

REST API service for per-user email notification preferences (epoch cycle briefings, phase changes, epoch completion).

**Singleton:** `notificationPreferencesApi` (exported from `NotificationPreferencesApiService.ts`)

**Methods:**
| Method | HTTP | Path | Description |
|--------|------|------|-------------|
| `getPreferences()` | GET | `/users/me/notification-preferences` | Get current user's preferences (returns defaults if no row exists) |
| `updatePreferences(data)` | POST | `/users/me/notification-preferences` | Upsert preferences (cycle_resolved, phase_changed, epoch_completed, email_locale) |

### Agent Aptitude Methods (on AgentsApiService)

Agent aptitude methods are available on `agentsApi` (AgentsApiService), not as a separate service.

**Methods:**
| Method | HTTP | Path | Description |
|--------|------|------|-------------|
| `getForAgent(simId, agentId)` | GET | `/simulations/{simId}/agents/{agentId}/aptitudes` | Get aptitudes for a specific agent |
| `updateForAgent(simId, agentId, data)` | PUT | `/simulations/{simId}/agents/{agentId}/aptitudes` | Upsert aptitudes for an agent (array of {operative_type, aptitude_level}) |
| `listForSimulation(simId)` | GET | `/simulations/{simId}/aptitudes` | List all agent aptitudes across a simulation (for lineup overview) |

---

## Agent Aptitude System

### VelgAptitudeBars (`velg-aptitude-bars`)

Reusable shared component displaying 6 horizontal bars representing an agent's aptitude levels across all operative types. Used in AgentDetailsPanel (editable), AgentsView (lineup strip, read-only), DeployOperativeModal (read-only with highlight), and DraftRosterPanel (read-only).

**Tag:** `<velg-aptitude-bars>`

**Properties:**
| Name | Typ | Default | Beschreibung |
|------|-----|---------|-------------|
| `aptitudes` | `AptitudeSet` | `{}` | Map of operative_type → aptitude_level (3-9) |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Bar size variant: sm (compact inline), md (standard), lg (detail panel) |
| `editable` | `boolean` | `false` | Enables interactive editing (click/drag to adjust levels) |
| `highlight` | `OperativeType \| null` | `null` | Highlights a specific operative type bar (used in DeployOperativeModal) |
| `budget` | `number \| null` | `null` | Total aptitude budget for editing constraints |

**Events:**
| Event | Detail | Beschreibung |
|-------|--------|-------------|
| `aptitude-change` | `{ operative_type: string, level: number }` | Fired when user adjusts an aptitude level in editable mode |

**Rendering:**
- 6 horizontal bars (spy, saboteur, propagandist, assassin, guardian, infiltrator)
- Each bar: label + numeric value + filled bar track (percentage of max 9)
- Bar colors: per-operative-type accent colors matching epoch theme palette
- `size="sm"`: Compact 4px bars for card/grid inline display
- `size="md"`: Standard 8px bars for side panels
- `size="lg"`: Full-width 12px bars with labels for detail editing
- `editable=true`: Bars become interactive — click to set level, displays budget remaining
- `highlight`: Target bar gets a pulsing glow + higher contrast

### Integration in AgentsView

- **Lineup Overview Strip:** Horizontal scrollable strip below the filter bar showing all agents with compact `VelgAptitudeBars` (`size="sm"`, read-only). Provides at-a-glance team composition overview. Only visible when simulation has aptitude data.

### Integration in DeployOperativeModal

- **Aptitude Bars:** `VelgAptitudeBars` (`size="md"`, `highlight` set to selected `operative_type`) displayed below agent selector. Shows how well the selected agent fits the chosen operative role.
- **Fit Indicator:** Numeric fit label (e.g., "Aptitude: 7/9") with color coding (green >= 7, amber 5-6, red <= 4).
- **Sorted Dropdown:** Agent dropdown sorted by aptitude for selected operative type (highest first), with aptitude level shown inline.

---

## Draft Phase UI

### DraftRosterPanel (`velg-draft-roster-panel`)

Full-screen overlay for the epoch agent draft. Players select which agents from their simulation will participate in the epoch. Opened from EpochLobbyActions during lobby phase.

**Tag:** `<velg-draft-roster-panel>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `epochId` | `string` | Active epoch ID |
| `simulationId` | `string` | Player's simulation ID |
| `maxAgents` | `number` | Maximum agents allowed (from `config.max_agents_per_player`, default 3) |
| `agents` | `Agent[]` | All available agents in the simulation (with aptitudes loaded) |

**State:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `_selectedIds` | `Set<string>` | Currently selected agent UUIDs |
| `_submitting` | `boolean` | Lock-in submission in progress |
| `_draftComplete` | `boolean` | Draft already submitted |

**Layout:**
- **Two-column layout:** Left column = available agents (full cards with `VelgAptitudeBars`), right column = selected roster (compact cards, drag-reorder)
- **Counter bar (top):** "2/3 AGENTS SELECTED" with progress segments, pulsing when at max
- **Team stats (right column footer):** Aggregated aptitude averages across selected agents, shown as composite `VelgAptitudeBars`
- **Lock-in button:** "LOCK IN ROSTER" — calls `POST /epochs/{epochId}/participants/{simId}/draft` with `{agent_ids}`. Disabled until min 1 agent selected. Shows confirmation dialog before submit.

**Events:**
| Event | Detail | Beschreibung |
|-------|--------|-------------|
| `draft-complete` | `{ agent_ids: string[] }` | Fired after successful draft lock-in |
| `draft-close` | - | Fired when overlay is dismissed without completing draft |

### Integration in EpochCreationWizard

- **Config Step:** `max_agents_per_player` slider (range 1-6, default 3) added to the epoch configuration form. Label: "Max Agents per Player". Tooltip explains the draft mechanic.

### Integration in EpochLobbyActions

- **Draft Button:** "DRAFT ROSTER" button visible for each joined participant. Disabled if draft already completed (shows "ROSTER LOCKED" with check icon + timestamp). Opens `DraftRosterPanel` overlay on click.
- **Draft Status Display:** Below each participant row, shows draft status — "Draft Pending" (amber) or "Roster Locked (3 agents)" (green) with `draft_completed_at` relative timestamp.

---

## Foundation Phase Redesign UI (Migration 048)

### EpochIntelDossierTab (`velg-epoch-intel-dossier-tab`)

Per-opponent intelligence dashboard assembled from spy battle log data. Shows what the player has learned about each rival through successful spy missions.

**Tag:** `<velg-epoch-intel-dossier-tab>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `epoch` | `Epoch` | Current epoch object |
| `participants` | `EpochParticipant[]` | All epoch participants |
| `myParticipant` | `EpochParticipant` | Player's own participant record |
| `battleLog` | `BattleLogEntry[]` | Epoch battle log entries |

**Layout:**
- Grid of per-opponent intel cards. Each card shows: simulation name/avatar, zone security badges (low/medium/high counts), guardian deployment count, fortification indicators (revealed by spy intel), staleness indicator (how many cycles since last intel).
- Cards are only populated when the player has spy intel reports (`event_type = 'intel_report'`) for that opponent in the battle log metadata.
- Empty state when no intel has been gathered.

**Accessibility:** `<article>` semantic elements, `role`/`aria` attributes, WCAG AA contrast (no container opacity — explicit dimmed colors instead), `prefers-reduced-motion`.

### MissionCard (`velg-mission-card`)

Reusable operative mission card component used by EpochOverviewTab and EpochOperationsTab to display individual mission status.

**Tag:** `<velg-mission-card>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `mission` | `OperativeMission` | Mission data |
| `participants` | `EpochParticipant[]` | For resolving simulation names |

### operative-icons.ts

Centralized SVG icon module for all operative types. Exports `operativeIcons` object with methods for each operative type (`spy()`, `guardian()`, `saboteur()`, `propagandist()`, `infiltrator()`, `assassin()`, `zone_fortified()`). Used by EpochOverviewTab, EpochBattleLog, EpochOperationsTab, DeployOperativeModal, and MissionCard. All icons include `aria-hidden="true"`.

### EpochOverviewTab Enhancements (Migration 048)

- **Fortify Zone Button:** "FORTIFY ZONE" action button visible during Foundation phase. Opens zone selector dropdown (own zones only). Costs 2 RP. Dispatches `fortify-zone` CustomEvent to EpochCommandCenter.
- **Defensive Fortifications Section:** "Defensive Fortifications" manifest with corner bracket decorative frame. Lists active and expired fortifications with pulsing status dots, zone name, security bonus, and expiry cycle. Active = green dot, Expired = dimmed.
- **RP Cost Fixes:** Guardian 3→4, Counter-Intel 3→4 (matching v2.2 balance).

### EpochLobbyActions Enhancements (Migration 049)

- **Sim Picker:** When joining an epoch, players see a simulation picker with faction cards showing simulation name, banner, agent count, and theme accent. Cards show 3 states: available (clickable), deployed (dimmed with "DEPLOYED" badge if already used in another epoch), and selected (highlighted border). Dismiss button to cancel selection.
- **_myParticipant Matching:** Now matches via `user_id` instead of simulation membership, supporting open epoch participation where any user can join with any template simulation.

### EpochBattleLog Enhancement (Migration 048)

- **zone_fortified Event:** Renders fortification events with shield icon from `operative-icons.ts`, zone name, and "fortified" narrative. Uses defensive green accent color.
