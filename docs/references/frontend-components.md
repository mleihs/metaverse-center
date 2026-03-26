---
title: "Frontend Components"
id: frontend-components
version: "3.5"
date: 2026-03-26
lang: de
type: reference
status: active
tags: [frontend, components, lit, web-components]
---

# 07 - Frontend Components: Komponenten + Simulation-Settings-UI

**Änderung v1.1:** Zod-Validierung, @lit-labs/router, Biome-Tooling ergänzt
**Änderung v3.3:** Route-basiertes Lazy Loading, ECharts Tree-Shaking, Bundle-Splitting Architektur

---

## Komponenten-Hierarchie

### Plattform-Level

**155 component files** across 21 subdirectories. **129 @customElement** components. **22 shared components + 10 CSS modules + 1 base class.**

```
App (Root)                           ⚡ = lazy-loaded via route enter()
├── PlatformHeader
│   ├── HeaderCluster (reusable hover-to-open dropdown: OPS, INTEL, SYS)
│   ├── SimulationSwitcher (◆ shard picker: My Worlds / Community via memberSimulationIds, theme badges, stats)
│   ├── CommandPalette (Ctrl+K: fuzzy search, keyboard nav, NAVIGATE/SHARDS/TOOLS)
│   ├── DevAccountSwitcher (inside SYS cluster panel)
│   └── UserMenu
├── SimulationsDashboard
│   ├── SimulationCard (je Simulation)
│   ├── ClearanceApplicationCard (Forge access CTA, idle/pending/hidden states)
│   ├── LoreScroll (Akkordeon mit Plattform-Lore, 25 Sections / 6 Chapters / 5 Simulations)
│   ├── CreateSimulationButton
│   └── PlatformFooter (legal footer: copyright, Impressum, Privacy links)
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
├── LandingPage (/ unauthenticated, always-loaded for SEO)
│   ├── Hero (signal decode animation, CTA)
│   ├── Features (3-column capability showcase with Supabase Storage images)
│   ├── WorldsPreview (monitor-card grid, responsive: 3→5→7 worlds at default/1440p/4K)
│   ├── LandingAgentShowcase ("Intercepted Dossiers" — real AI agents as marketing)
│   │   ├── VelgAgentCard (reused, with rarity/badges/aptitude pips)
│   │   ├── Decode animation (scramble→resolve section label, IntersectionObserver)
│   │   ├── Typewriter tagline ("These are real AI characters...")
│   │   ├── Scanner beam (CSS ambient sweep, 8s cycle)
│   │   ├── Responsive grid: 3 cols (default) → 4 cols (1440p) → 6 cols (4K)
│   │   ├── Data: 6→8→12 agents, scored by portrait/ambassador/character, 1-per-sim diversity
│   │   └── SEO: ItemList JSON-LD structured data
│   ├── LiveData (platform stats counters)
│   ├── HowItWorks (3-step process flow)
│   └── CtaFooter (terminal-framed conversion CTA)
├── WorldsGallery (/worlds) ⚡
│   ├── Search + Pagination
│   └── World cards with theme-color portal bleed
├── ChronicleFeed (/chronicles) ⚡
│   ├── Cross-simulation chronicle aggregation
│   └── Pagination + search
└── CartographerMap (/multiverse) ⚡
    ├── MapGraph (2D SVG force-directed graph, default)
    │   ├── MapNode (circle + banner + label)
    │   └── MapEdge (bezier + flow animation)
    ├── MapGraph3D (3D WebGL via 3d-force-graph + Three.js, lazy-loaded on 3D toggle)
    │   └── map-three-render (Three.js node/edge factories)
    ├── MapTooltip (hover info)
    ├── MapConnectionPanel (edge detail, extends VelgSidePanel)
    ├── MapBattleFeed (scrolling public battle log ticker)
    ├── MapLeaderboardPanel (VelgSidePanel for epoch scores)
    ├── MapMinimap (150×100px viewport overview)
    └── Mobile Card List (≤768px fallback)
```

**platform/ directory:** PlatformHeader, HeaderCluster, SimulationSwitcher, CommandPalette, UserMenu, DevAccountSwitcher, SimulationsDashboard, LoreScroll, CreateSimulationWizard, UserProfileView, InvitationAcceptView, SimulationCard (12 files)

### Simulation-Level

```
SimulationShell (Layout mit Navigation + Breadcrumb Simulation-Switcher, always-loaded)
├── SimulationHeader
│   ├── Navigation (Tabs/Sidebar)
│   └── SimulationInfo (Name, Theme)
├── AgentsView ⚡
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
├── DailyBriefingModal (Daily Substrate Dispatch — once-per-day 24h summary modal: health hero bar, stat grid, arc pressure bars, auto-dismiss 30s, forced dark tokens)
├── SimulationPulse (Heartbeat visualization — ambient simulation heartbeat indicator in SimulationNav)
├── AnchorDashboard (Philosophical Anchor overview — narrative arc status, attunement metrics)
├── AttunementSettings (Heartbeat tuning controls — tick rate, narrative sensitivity, bureau response thresholds)
├── BureauResponsePanel (Bureau automated response review — pending/approved/rejected bureau reactions)
├── SimulationHealthView (Game Metrics Dashboard)
│   ├── AscendancyAura (golden glow overlay for ascendant threshold)
│   ├── DesperateActionsPanel (3 emergency actions fan: scorched_earth, emergency_draft, reality_anchor)
│   ├── EntropyOverlay (vignette + red pulse + grain for critical threshold)
│   └── EntropyTimer (digital countdown display, fixed bottom-left)
├── BleedPalimpsestOverlay (full-page palimpsest when active bleeds)
│   ├── BleedMarginalia (foreign-theme-colored margin entries with lore quotes)
│   └── BleedRedaction (censored text strips)
├── CartographersDesk (Intelligence Light Table — bureau drafting table)
│   ├── CartographicMap (SVG zone map with pan/zoom, stability coloring)
│   ├── MapLayerToggle (4 switchable layers: infrastructure, bleed, military, history)
│   └── MapAnnotationTool (toggle-based annotation system)
├── SvgFilters (shared SVG filter definitions for visual effects)
├── EpochCommandCenter ⚡ (Competitive PvP — orchestrator, delegates to subcomponents)
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
└── SettingsView (verwendet VelgTabs fuer Tab-Navigation)
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

**22 components + 10 CSS modules + 1 base class** (33 files total)

```
Shared (wiederverwendbar ueber alle Views)
├── Components (22)
│   ├── BaseModal                    Focus trap, Escape-to-close, centered dialog
│   ├── VelgSidePanel                Slide-from-right panel shell, focus trap, role="dialog", aria-modal="true"
│   ├── VelgTabs                     Shared tab bar: keyboard nav (Arrow/Home/End), role="tablist", aria-selected, roving tabindex. Ersetzt SettingsView-eigene Tab-Implementierung
│   ├── VelgDetailPanel              Loading/Error/Content states, slot-basiert (header, body, footer)
│   ├── VelgSkeleton                 Shimmer loading placeholder, Varianten: text/card/avatar/table-row, prefers-reduced-motion
│   ├── SharedFilterBar              Ersetzt 4x duplizierten Filter
│   ├── VelgBadge                    6 color variants (default, primary, info, warning, danger, success)
│   ├── VelgAvatar                   Portrait + initials fallback, 3 sizes (sm/md/lg), optional alt override
│   ├── VelgIconButton               30px icon action button
│   ├── VelgSectionHeader            Section titles, 2 variants
│   ├── VelgAptitudeBars             Operative aptitude bars (3 sizes: sm/md/lg, editable mode, highlight, budget tracking)
│   ├── EchartsChart                 Apache ECharts 6.0 wrapper (tree-shaken: 5 charts + 5 components + CanvasRenderer), custom tactical dark theme, IntersectionObserver scroll-reveal, auto-resize. Lazy-loaded via HowToPlayView connectedCallback.
│   ├── ErrorState                   Einheitliches Error-Pattern
│   ├── LoadingState                 Einheitliches Loading-Pattern
│   ├── EmptyState                   "Keine Daten" Anzeige mit optionalem Action-Button
│   ├── GenerationProgress           AI generation progress indicator
│   ├── Lightbox                     Fullscreen image overlay, Escape/click-to-close, caption + alt
│   ├── ConfirmDialog                Destructive action confirmation
│   ├── Toast                        Notification toast with auto-dismiss
│   ├── Pagination                   Einheitliche Pagination
│   ├── CookieConsent                GDPR banner, accept/decline analytics, privacy policy link
│   └── VelgPlatformFooter           Legal footer: copyright, Impressum + Privacy links, Bureau tagline. Used on LandingPage + SimulationsDashboard
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

### Mobile Responsive (Audit Phase 2)

`@media (max-width: 640px)` in 19 Dateien ergaenzt: 9 Settings-Panels, settings-styles.ts, 6 Chat-Komponenten, terminal-theme-styles.ts, 2 Auth-Komponenten. EpochLeaderboard: Table→Card Layout bei 768px. Alle Touch-Targets auf 44px Minimum, Single-Column Layouts, Full-Width Inputs.

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
  memberSimulationIds = signal<Set<string>>(new Set()); // IDs of sims user is a member of

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
/                                    → LandingPage (unauthenticated) or Redirect zu /simulations (authenticated)
/worlds                              → WorldsGallery (public simulation browser)
/chronicles                          → ChronicleFeed (public chronicle editions)
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

Siehe **Auth and Security** (`../specs/auth-and-security.md`) für vollständige Code-Beispiele der Supabase Services.

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
├── ForgeApiService.ts              # Simulation Forge CRUD, BYOK keys, access requests + admin review
├── HealthApiService.ts             # Simulation health + game mechanics + bleed status + threshold actions
├── BotApiService.ts                # Bot player preset CRUD + add/remove bot from epoch
├── NotificationPreferencesApiService.ts  # Notification preferences (GET + POST /users/me/notification-preferences)
└── index.ts                        # Re-exports all service singletons
```

**27 API services** (excluding BaseApiService and index.ts).

### Platform-Level Services

```
frontend/src/services/
├── AppStateManager.ts              # Preact Signals global state
├── ForgeStateManager.ts            # Forge wizard state + post-ceremony image tracking (Preact Signals)
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

**ForgeStateManager** (`forgeStateManager` singleton) manages Forge wizard state (draft lifecycle, sessionStorage persistence), generation timing/ETA, and post-ceremony image generation tracking.

**Generation timing signals:**

| Signal | Type | Description |
|--------|------|-------------|
| `generationStartedAt` | `Signal<number \| null>` | Timestamp when current generation started; null when idle |
| `lastGenerationRecovered` | `Signal<boolean>` | True if last generation completed via timeout recovery; reset on next generation |

**Timing methods:**
- `getEstimatedDuration(type)` — rolling average (last 5) from localStorage key `forge_generation_timings`; falls back to hardcoded defaults (research: 30s, geography: 120s, agents: 180s, buildings: 150s). Consumers: `VelgForgeAstrolabe`, `VelgForgeTable` pass result as `estimatedDurationMs` to `VelgForgeScanOverlay`.
- `_recordTiming(type, durationMs)` — appends to localStorage array after each generation (capped at 20 entries, oldest evicted). Wrapped in try-catch for private browsing.

**Image tracking signals:**

| Signal | Type | Description |
|--------|------|-------------|
| `imageTrackingSlug` | `Signal<string \| null>` | Slug of simulation currently having images generated |
| `imageProgress` | `Signal<ForgeProgress \| null>` | Latest progress snapshot from `get_forge_progress` RPC |
| `imageUpdateVersion` | `Signal<number>` | Counter incremented each time new images are detected — triggers view re-fetches |

**Image tracking lifecycle:** `startImageTracking(slug)` begins 5s polling via `forgeApi.getForgeProgress(slug)`. On each poll: compares `completed` count — if increased, bumps `imageUpdateVersion` (triggering `effect()` watchers in AgentsView, BuildingsView, SimulationLoreView to re-fetch entities). When `done === true` → final version bump → 2s delay → `stopImageTracking()`. 5-minute safety timeout. Called from `VelgForgeIgnition._handleFinish()` before navigation to the new simulation.

**Consumer pattern:** Views extend `SignalWatcher(LitElement)` to subscribe to signal values in `render()`. Each view creates an `effect()` in `connectedCallback()` watching `imageUpdateVersion` to re-fetch data. The `generating` state is slug-matched (`imageTrackingSlug === currentSlug`) to prevent cross-simulation shimmer. Lore images use `pendingImageSlugs` Set (computed from `imageProgress.lore`) to suppress URL construction for ungenerated images.

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
| Forge (drafts, BYOK, access requests, admin review) | ForgeApiService | FastAPI |
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

Alle Änderungen zeigen eine Live-Preview innerhalb der Shell. Preset-Auswahl füllt alle Felder mit Preset-Werten. Siehe `../specs/theming-system.md` für vollständige Token-Taxonomie.

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
| terminal/ | 4 | 4 | BureauTerminal (CRT MUD interface, Stage 1-3 + Epoch Tier 4: 23 commands), TerminalQuickActions, TerminalView (template wrapper), EpochTerminalView (epoch wrapper) |
| chat/ | 7 | 7 | View, Window, ConversationList, MessageList/Input, AgentSelector, EventPicker |
| social/ | 9 | 9 | TrendsView, MediaView, CampaignDashboard, Cards, Modals, TrendFilterBar |
| locations/ | 5 | 5 | View, CityList, ZoneList, StreetList, LocationEditModal |
| lore/ | 7 | 1 | SimulationLoreView + lore-content dispatcher + 5 content files (per-simulation) |
| multiverse/ | 12 | 8 | CartographerMap, MapGraph, MapGraph3D, MapTooltip, MapConnectionPanel, MapBattleFeed, MapLeaderboardPanel, MapMinimap + 4 utilities (map-force, map-data, map-types, map-three-render) |
| settings/ | 10 | 10 | SettingsView + 9 panels (General, World, AI, Integration, Design, Access, Prompts, Bleed, Notifications) |
| health/ | 5 | 5 | SimulationHealthView, AscendancyAura, DesperateActionsPanel, EntropyOverlay, EntropyTimer |
| bleed/ | 3 | 3 | BleedPalimpsestOverlay, BleedMarginalia, BleedRedaction |
| map/ | 5 | 5 | CartographersDesk, CartographicMap, MapAnnotationTool, MapLayerToggle, MultiverseConspiracyBoard |
| epoch/ | 19 | 19 | CommandCenter (orchestrator), OpsBoard, OverviewTab, IntelDossierTab, OperationsTab, AlliancesTab, LobbyActions, CreationWizard, DraftRosterPanel, Leaderboard, BattleLog, MissionCard, DeployOperativeModal, InvitePanel, InviteAcceptView, ChatPanel, PresenceIndicator, ReadyPanel, BotConfigPanel |
| how-to-play/ | 5 | 1 | HowToPlayView + htp-styles (extracted CSS) + 3 content/type files (htp-types, htp-content-rules, htp-content-matches) |
| shared/ | 32 | 21 | 21 components + 10 CSS modules + 1 base class |
| **Gesamt** | **162** | **135** (in components/) | **22 Verzeichnisse** |

### Utilities

```
frontend/src/utils/
├── text.ts                         # humanizeEnum(), getInitials(), pluralCount(), agentAltText(), buildingAltText()
├── icons.ts                        # Centralized SVG icons with aria-hidden="true" (includes chevronDown, fracture, anchor, scorchedEarth, emergencyDraft, compassRose, stampClassified, magnifyingGlass, pencilAnnotate, layerInfrastructure, layerBleed, layerMilitary, layerHistory, heartline, flatline)
├── operative-icons.ts              # Centralized operative-type SVG icons (spy, guardian, saboteur, propagandist, infiltrator, assassin, zone_fortified)
├── terminal-commands.ts            # MUD command handlers (19 commands across 3 stages), ensureAgentConversation(), sendAgentPrompt(), synonym map, Levenshtein fuzzy match
├── terminal-formatters.ts          # 20+ format functions: formatLook, formatExamine, formatScan, formatInvestigate, formatReport, formatDebrief, formatAskResponse, _wordWrap, _truncate, _timeAgo
└── theme-colors.ts                 # getThemeColor(), getThemeVariant(), getGlowColor(), THEME_COLORS map
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

Per-opponent intelligence dashboard. Bezieht Daten ueber den dedizierten API-Endpoint `GET /api/v1/epochs/{epoch_id}/scores/intel-dossiers` (vorab-aggregiert, mit `is_stale` Flag) statt client-seitiger Berechnung aus Battle-Log-Rohdaten.

**Tag:** `<velg-epoch-intel-dossier-tab>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `epoch` | `Epoch` | Current epoch object |
| `participants` | `EpochParticipant[]` | All epoch participants |
| `myParticipant` | `EpochParticipant` | Player's own participant record |

**Layout:**
- Grid of per-opponent intel cards. Each card shows: simulation name/avatar, zone security badges (low/medium/high counts), guardian deployment count, fortification indicators (revealed by spy intel), staleness indicator (`is_stale` Flag vom API).
- Cards are only populated when the player has spy intel reports for that opponent.
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

---

## Event Pressure & Seismograph

### VelgEventSeismograph (`velg-event-seismograph`)

SVG seismograph visualization for event pressure over time. Renders event spikes, pressure overlay, and supports brush interaction for date range selection.

**Tag:** `<velg-event-seismograph>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `simulationId` | `string` | Current simulation ID |
| `events` | `SimEvent[]` | Events to visualize |

**Features:**
- **Time ranges:** 30, 90, 180, 365 days (default: 90), switchable via range buttons
- **Spike rendering:** Vertical lines per event, color-coded by impact level (≥8: danger red, ≥5: warning amber, <5: primary)
- **Special markers:**
  - Resonance events: expanding circles + pink diamond marker, 2s pulse animation
  - Cascade events: dashed strokes, open circles
  - Bleed events: dashed strokes (4,3 pattern)
  - Escalating events: 1.2s opacity pulse
- **Pressure overlay:** 7-day rolling pressure polygon (danger-colored, low opacity), ceiling normalized to 15
- **Brush interaction:** Click-drag to select date range, double-click to clear
- **Grid lines:** Vertical date markers (7d/14d/30d/60d intervals), horizontal impact thresholds at 5 and 8
- **Accessibility:** Respects `prefers-reduced-motion`, semantic SVG structure

**Custom Events:**
| Event | Detail | Description |
|-------|--------|-------------|
| `seismograph-brush` | `{ dateFrom: string, dateTo: string }` | Date range selected via brush |
| `seismograph-clear` | — | Brush cleared (double-click) |

---

## Substrate Resonance Components

### ResonanceMonitor (`resonance-monitor`)

Platform-level dashboard for viewing active substrate resonances. Displayed on the SimulationsDashboard.

**Tag:** `<resonance-monitor>`

**State:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `_resonances` | `Resonance[]` | Loaded resonances |
| `_impactCounts` | `Record<string, number>` | Impact count per resonance |
| `_statusFilter` | `'all' \| 'detected' \| 'impacting' \| 'subsiding'` | Active status filter |
| `_signatureFilter` | `ResonanceSignature \| ''` | Signature filter |

**Features:**
- Status filter chips (all, detected, impacting, subsiding)
- Signature dropdown filter
- Auto-refresh every 60 seconds
- Grid of `<resonance-card>` components with stagger animation
- Process impact button (platform admin only)
- Loading/error/empty states

### ResonanceCard (`resonance-card`)

Individual resonance display card with magnitude indicator, status badge, and countdown timer.

**Tag:** `<resonance-card>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `resonance` | `Resonance` | Resonance data object |
| `impactCount` | `number` | Number of processed impacts |
| `showProcessButton` | `boolean` | Show process button (admin only) |

**Visual:**
- Magnitude indicator: low (cyan, ≤0.4), medium (amber, 0.4-0.7), high (red, >0.7)
- Status badge with color coding per status
- Countdown to `impacts_at` timestamp (live updating)
- Expandable bureau dispatch section
- Impact count badge

**Custom Events:**
| Event | Detail | Description |
|-------|--------|-------------|
| `resonance-click` | `Resonance` | Card clicked |
| `resonance-process` | `string` (resonance ID) | Process button clicked |

---

## Admin Panel Components

### AdminPanel (`velg-admin-panel`)

Platform admin dashboard with 10 tabs (consolidated from 13). Hero section with scanlines, tablist navigation, content panel.

**Tag:** `<velg-admin-panel>`

**Tabs (10):**

| Tab | Component | Beschreibung |
|-----|-----------|-------------|
| Users | `velg-admin-users-tab` | User management, roles, memberships |
| Simulations | `velg-admin-simulations-tab` | Active/trash simulation management |
| Health | `velg-admin-health-tab` | Critical health effects master switch + per-sim overrides |
| Heartbeat | `velg-admin-heartbeat-tab` | Tick engine config, cascade rules, sim status |
| Resonances | `velg-admin-resonances-tab` | Substrate resonance CRUD + impact processing |
| Scanner | `velg-admin-scanner-tab` | Content scanner dashboard, candidates, log |
| Forge | `velg-admin-forge-tab` | Forge stats, BYOK keys, clearance queue |
| Platform Config | `velg-admin-platform-config-tab` | Sub-tabs: API Keys, Models, Research, Caching |
| Social Media | `velg-admin-social-tab` | Sub-tabs: Instagram, Bluesky |
| Data Cleanup | `velg-admin-cleanup-tab` | 6-category data purge with preview |

**Shared Styles:** `admin-shared-styles.ts` exports 9 CSS modules (animations, section headers, global cards, toggles, buttons, forge sections, loading states, config cards, config grids). Tabs compose via `static styles = [adminButtonStyles, ...]` with Tier-3 `--_admin-accent` / `--_toggle-active` overrides.

**Info Bubbles:** All config inputs have `renderInfoBubble(msg('...'), 'tip-id')` with `aria-describedby` linkage. Shared `infoBubbleStyles` with amber hover glow, arrow decoration, `role="tooltip"`.

### AdminPlatformConfigTab (`velg-admin-platform-config-tab`)

Wrapper tab consolidating API Keys, Models, Research, and Caching into a single tab with sub-navigation. Same pattern as AdminSocialTab.

**Tag:** `<velg-admin-platform-config-tab>`

**Sub-tabs:** API Keys | Models | Research | Caching

### AdminApiKeysTab (`velg-admin-api-keys-tab`)

Platform API key management panel. Displays 6 API keys grouped by category with masked values, edit fields, and save/clear actions.

**Tag:** `<velg-admin-api-keys-tab>`

**Managed Keys:**

| Key | Label | Category |
|-----|-------|----------|
| `openrouter_api_key` | OpenRouter API Key | AI |
| `replicate_api_key` | Replicate API Key | AI |
| `guardian_api_key` | Guardian API Key | News |
| `newsapi_api_key` | NewsAPI Key | News |
| `tavily_api_key` | Tavily API Key | Other |
| `deepl_api_key` | DeepL API Key | Other |

**Features:**
- Grouped by category (AI, News, Other)
- Status badge (Active/Not configured)
- Masked value display with show/hide toggle
- Per-key save and clear buttons
- Dirty state indicator (yellow border glow)

### AdminResonancesTab (`velg-admin-resonances-tab`)

Full admin management panel for substrate resonances with three views and comprehensive filtering.

**Tag:** `<velg-admin-resonances-tab>`

**Views:** Active | Archived | Trash

**Filters:** Status chips (all, detected, impacting, subsiding), signature dropdown, search input

**Actions per resonance:**
- Status transition (detected → impacting → subsiding → archived)
- Process impact (triggers AI event generation across simulations)
- Expand impact panel (shows per-simulation results)
- Edit (opens form modal)
- Soft-delete / Restore

**Child Components:** `<velg-admin-resonance-form-modal>`, `<velg-confirm-dialog>`

### AdminResonanceFormModal (`velg-admin-resonance-form-modal`)

Modal form for creating/editing substrate resonances. Source category selection auto-previews derived signature and archetype.

**Tag:** `<velg-admin-resonance-form-modal>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `resonance` | `Resonance \| null` | Existing resonance for edit mode, null for create |

**Form Fields:**
1. Source category select (with auto-derivation preview showing signature + archetype)
2. Title input
3. Description textarea
4. Bureau dispatch textarea (monospace)
5. Magnitude slider (0.1-1.0, step 0.05) with color-coded live display
6. Impacts At datetime-local input

**Custom Events:** `resonance-save`, `modal-close`

### AdminForgeTab (`velg-admin-forge-tab`)

Global Simulation Forge settings panel with BYOK key management, forge statistics, and clearance request administration.

**Tag:** `<velg-admin-forge-tab>`

**State:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `_draftCount` | `number` | Active draft simulations count |
| `_totalTokens` | `number` | Total AI tokens consumed |
| `_totalMaterialized` | `number` | Total materialized simulations |
| `_pendingRequests` | `ForgeAccessRequestWithEmail[]` | Pending clearance upgrade requests |
| `_requestNotes` | `Record<string, string>` | Admin notes per request ID |
| `_reviewingId` | `string \| null` | Currently processing request ID |

**Sections:**

1. **Forge Statistics:** Grid of stat cards (active drafts, total tokens, total materialized)
2. **BYOK Keys:** Personal OpenRouter + Replicate API key inputs with save action
3. **Clearance Requests:** Pending request cards with:
   - Requester email + submission date
   - Optional justification message (dashed border, italic)
   - Admin notes textarea for review comments
   - Approve button (green, success variant) + Reject button (danger outline)
   - Both actions show `ConfirmDialog` before executing
   - Pending count badge (propagated to AdminPanel tab via `appState.setPendingForgeRequestCount()`)

**API:** `forgeApi.getAdminStats()`, `forgeApi.listPendingRequests()`, `forgeApi.reviewRequest(id, action, adminNotes)`, `forgeApi.updateBYOK()`

### AdminResearchTab (`velg-admin-research-tab`)

Platform-level Tavily research domain configuration panel. Allows admin to configure domain lists for each research axis used in the Forge pipeline (Astrolabe + Lore Research phases).

**Tag:** `<velg-admin-research-tab>`

**Managed Domain Axes:**

| Setting Key | Label | Forge Phase |
|-------------|-------|-------------|
| `research_domains_encyclopedic` | Encyclopedic Domains | Astrolabe (Phase 1) |
| `research_domains_literary` | Literary Domains | Lore Research (literary axis) |
| `research_domains_philosophy` | Philosophy Domains | Lore Research (philosophical axis) |
| `research_domains_architecture` | Architecture Domains | Lore Research (architectural axis) |

**Features:**
- Loads domain lists from `platform_settings` via `adminApi.getPlatformSettings()`
- Per-axis editable comma-separated domain list inputs
- Dirty-state tracking with save/reset per axis
- Descriptive labels explaining each axis's role in the Forge pipeline
- Uses `DOMAIN_KEYS` constant for type-safe setting key references

**Data Source:** `platform_settings` table (Migration 124 seeds default values)

**API:** `adminApi.getPlatformSettings()`, `adminApi.updatePlatformSetting(key, value)`

---

## Forge Access Components

### VelgForgeAccessModal (`velg-forge-access-modal`)

Modal for submitting a clearance upgrade request from Field Observer to Reality Architect. Extends `BaseModal` via composition.

**Tag:** `<velg-forge-access-modal>`

**Properties:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `open` | `boolean` | Modal visibility (reflected) |

**State:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `_message` | `string` | Optional justification text |
| `_submitting` | `boolean` | Submission in progress |

**Layout:** Classified intelligence dossier aesthetic matching ClearanceApplicationCard.
- **Classification banner:** Bilingual bureau header in amber monospace uppercase with scan-line overlay (`::after` pseudo-element)
- **Tier upgrade display:** `Field Observer → Reality Architect` with arrow separator, amber left-border accent, dark surface background
- **Description:** Explanation of Architect clearance capabilities
- **Justification textarea:** Optional, 500 character limit with live char counter, monospace styling, amber focus ring
- **Footer:** Cancel (ghost) + Submit (amber brutalist with offset shadow hover) buttons
- **Entry animations:** Staggered fade-in (80ms increments) per section via CSS `animation-delay`

**Events:**
| Event | Detail | Beschreibung |
|-------|--------|-------------|
| `modal-close` | - | Modal dismissed |
| `navigate` | `string` (path) | Fired indirectly on success (via state update triggering dashboard refresh) |

**API:** `forgeApi.requestAccess(message?)`. On success, calls `appState.setForgeRequestStatus('pending')`.

**Styles:** Self-contained CSS (no shared `formStyles`). Custom field styling with amber accent (`#f59e0b`), brutalist button treatment, focus-visible outlines.

### VelgClearanceCard (`velg-clearance-card`)

Dashboard card promoting forge access for Field Observer users. Military briefing aesthetic with classified dossier styling.

**Tag:** `<velg-clearance-card>`

**State:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `_status` | `'idle' \| 'pending'` | Derived from `appState.forgeRequestStatus` |

**States:**
- **Idle:** Amber-accented "Apply for Clearance" button with brutalist uppercase styling and offset shadow hover
- **Pending:** Amber pulsing dot (`dot-pulse` keyframe, 2s infinite) + "Awaiting Review" text in monospace
- **Hidden:** Renders `nothing` when user is already a Reality Architect, unauthenticated, or was rejected

**Visual:**
- **Card border:** Left-side 3px amber accent (`#f59e0b`)
- **Scanline overlay:** `::after` pseudo-element with repeating-linear-gradient (3px transparent / 1px translucent white) for CRT scanline effect
- **Classification header:** `// CLEARANCE APPLICATION //` in amber monospace
- **Tier box:** Current clearance tier indicator with filled/unfilled pips
- **Entrance animation:** `shard-enter` (500ms) with stagger delay via CSS `--i` custom property

**Events:**
| Event | Detail | Beschreibung |
|-------|--------|-------------|
| (none) | - | Opens `VelgForgeAccessModal` on apply button click |

---

## Simulation Shell Enhancements

### Breadcrumb Simulation-Switcher

The simulation name in the `SimulationShell` breadcrumb is now a dropdown trigger when multiple simulations exist, allowing quick switching between simulations while staying on the current tab view.

**Component:** `VelgSimulationShell` (`velg-simulation-shell`)

**New Properties:**
| Name | Typ | Default | Beschreibung |
|------|-----|---------|-------------|
| `view` | `string` | `'lore'` | Current tab view path segment, passed from app-shell router. Replaces fragile URL/event interception for breadcrumb label updates. |

**New State:**
| Name | Typ | Beschreibung |
|------|-----|-------------|
| `_simSwitcherOpen` | `boolean` | Dropdown visibility |
| `_dropdownPos` | `{ top: number, left: number }` | Fixed position computed from trigger's `getBoundingClientRect()` |
| `_focusedIndex` | `number` | Keyboard-navigated option index (-1 = none) |

**Dropdown Behavior:**
- **Trigger:** Simulation name + `chevronDown` icon (from `utils/icons.ts`). Only rendered when `appState.simulations` has multiple entries (or one entry not matching current).
- **Positioning:** `position: fixed` with coordinates from trigger bounding rect. Escapes `overflow: hidden` clipping on parent elements.
- **Open/close:** Click-toggle on trigger. Outside click closes. Escape key closes and returns focus to trigger.
- **Selection:** Navigates to `/simulations/{slug}/{view}`, preserving the current tab.

**Keyboard Navigation (ARIA listbox pattern):**
| Key | Action |
|-----|--------|
| `ArrowDown` | Move focus to next option (wraps) |
| `ArrowUp` | Move focus to previous option (wraps) |
| `Home` | Move focus to first option |
| `End` | Move focus to last option |
| `Enter` | Select focused option |
| `Escape` | Close dropdown, return focus to trigger |

**ARIA:** Trigger has `aria-expanded`, `aria-haspopup="listbox"`. Dropdown has `role="listbox"`. Options have `role="option"`, `aria-selected`, `aria-current`, managed `tabindex`.

**CSS Classes:** `.breadcrumb__switcher`, `.breadcrumb__trigger`, `.breadcrumb__dropdown` (frosted glass with `backdrop-filter: blur(12px)`), `.breadcrumb__option` (staggered `option-enter` animation, left-border highlight on hover/focus). Dropdown uses `dropdown-enter` animation (0.2s scale+fade).

---

## Shared Component Additions

### VelgFontPicker (`velg-font-picker`)

Font selection dropdown with 13 curated typefaces. Used in VelgForgeDarkroom for theme font customization.

**Tag:** `<velg-font-picker>`

**Available Fonts:** Oswald, Barlow, Cormorant Garamond, Libre Baskerville, Space Mono, Spectral, Inter, Montserrat, Playfair Display, Merriweather, Fira Code, Lora, system-ui

---

## API Service Additions

### ResonanceApiService

Singleton API service for resonance management (`resonanceApi`).

**Methods:**
| Method | HTTP | Path | Auth |
|--------|------|------|------|
| `list()` | GET | `/resonances` | Public/Auth |
| `getById()` | GET | `/resonances/{id}` | Public/Auth |
| `create()` | POST | `/resonances` | Platform Admin |
| `update()` | PUT | `/resonances/{id}` | Platform Admin |
| `processImpact()` | POST | `/resonances/{id}/process-impact` | Platform Admin |
| `listImpacts()` | GET | `/resonances/{id}/impacts` | Auth |
| `updateStatus()` | PUT | `/resonances/{id}/status` | Platform Admin |
| `restore()` | POST | `/resonances/{id}/restore` | Platform Admin |
| `remove()` | DELETE | `/resonances/{id}` | Platform Admin |

### ZoneActionApiService

Singleton API service for zone action management (`zoneActionsApi`).

**Methods:**
| Method | HTTP | Path | Auth |
|--------|------|------|------|
| `list()` | GET | `/simulations/{simId}/zones/{zoneId}/actions` | Viewer |
| `create()` | POST | `/simulations/{simId}/zones/{zoneId}/actions` | Editor |
| `cancel()` | DELETE | `/simulations/{simId}/zones/{zoneId}/actions/{id}` | Editor |

### ForgeApiService

Singleton API service for Simulation Forge draft lifecycle, BYOK key management, and clearance access requests (`forgeApi`).

**Methods:**
| Method | HTTP | Path | Auth |
|--------|------|------|------|
| `listDrafts(params?)` | GET | `/forge/drafts` | Auth |
| `createDraft(seed_prompt)` | POST | `/forge/drafts` | Auth (Architect) |
| `getDraft(id)` | GET | `/forge/drafts/{id}` | Auth (Owner) |
| `updateDraft(id, data)` | PATCH | `/forge/drafts/{id}` | Auth (Owner) |
| `deleteDraft(id)` | DELETE | `/forge/drafts/{id}` | Auth (Owner) |
| `runResearch(id)` | POST | `/forge/drafts/{id}/research` | Auth (Owner) |
| `generateChunk(id, chunkType)` | POST | `/forge/drafts/{id}/generate/{chunkType}` | Auth (Owner) |
| `generateTheme(id)` | POST | `/forge/drafts/{id}/generate-theme` | Auth (Owner) |
| `ignite(id)` | POST | `/forge/drafts/{id}/ignite` | Auth (Owner) |
| `getForgeProgress(slug)` | GET | `/public/simulations/by-slug/{slug}/forge-progress` | Anon |
| `getSimulationLore(simId)` | GET | `/simulations/{simId}/lore` | Public |
| `getWallet()` | GET | `/forge/wallet` | Auth |
| `updateBYOK(data)` | PUT | `/forge/wallet/keys` | Auth |
| `requestAccess(message?)` | POST | `/forge/access-requests` | Auth |
| `getMyAccessRequest()` | GET | `/forge/access-requests/me` | Auth |
| `listPendingRequests()` | GET | `/forge/access-requests/pending` | Platform Admin |
| `getPendingRequestCount()` | GET | `/forge/access-requests/pending/count` | Platform Admin |
| `reviewRequest(id, action, adminNotes?)` | POST | `/forge/access-requests/{id}/review` | Platform Admin |
| `getAdminStats()` | GET | `/forge/admin/stats` | Platform Admin |
| `purgeStale(days?)` | DELETE | `/forge/admin/purge` | Platform Admin |
