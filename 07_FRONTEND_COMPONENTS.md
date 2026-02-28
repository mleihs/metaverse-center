# 07 - Frontend Components: Komponenten + Simulation-Settings-UI

**Version:** 1.4
**Datum:** 2026-02-28
**Aenderung v1.4:** Accurate component audit — 107 files across 15 subdirectories, 90 @customElement components. Updated shared/ (16 components + 8 CSS modules + 1 base class), removed dead code listings (DataTable, FormBuilder, NotificationCenter, CampaignDetailView, CampaignMetrics, SentimentBadge, SupabaseRealtimeService, PresenceService). Added health/, epoch/, lore/, EventPicker, BleedSettingsPanel, PromptsSettingsPanel. Updated service layer (22 API services + 7 platform services).
**Aenderung v1.3:** Cartographer's Map (Multiverse-Visualisierung). Agent Relationships UI (RelationshipCard, RelationshipEditModal). Event Echoes UI (EchoCard, EchoTriggerModal). 7 neue Multiverse-Komponenten. Bleed-Filter in EventsView.
**Aenderung v1.2:** LoreScroll-Akkordeon auf Dashboard. LoginPanel (Slide-from-Right). SimulationCard mit Banner-Bild + Zaehler. VelgSimulationShell Theming-Lifecycle (connectedCallback/disconnectedCallback). Anonymer Read-Only-Modus in allen Entity-Komponenten via `appState.isAuthenticated.value`.
**Änderung v1.1:** Zod-Validierung, @lit-labs/router, Biome-Tooling ergänzt

---

## Komponenten-Hierarchie

### Plattform-Level

**107 component files** across 15 subdirectories. **90 @customElement** components. **16 shared components + 8 CSS modules + 1 base class.**

```
App (Root)
├── PlatformHeader
│   ├── DevAccountSwitcher
│   ├── UserMenu
│   └── LocaleSelector
├── SimulationsDashboard
│   ├── SimulationCard (je Simulation)
│   ├── LoreScroll (Akkordeon mit Plattform-Lore)
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
    ├── MapGraph (SVG force-directed graph)
    │   ├── MapNode (circle + banner + label)
    │   └── MapEdge (bezier + flow animation)
    ├── MapTooltip (hover info)
    ├── MapConnectionPanel (edge detail, extends VelgSidePanel)
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
│   ├── AgentCard
│   │   ├── AgentPortrait
│   │   ├── AgentActions
│   │   └── Relationship Count Indicator
│   ├── AgentEditModal (extends BaseModal)
│   └── AgentDetailsPanel
│       ├── Character, Background, Professions, Reactions (existing)
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
├── EpochCommandCenter (Competitive PvP)
│   ├── EpochCreationWizard
│   ├── EpochLeaderboard
│   ├── EpochBattleLog
│   └── DeployOperativeModal (extends BaseModal)
└── SettingsView
    ├── GeneralSettingsPanel
    ├── WorldSettingsPanel (Taxonomien)
    ├── AISettingsPanel (extends BaseSettingsPanel)
    ├── IntegrationSettingsPanel (extends BaseSettingsPanel)
    ├── DesignSettingsPanel (extends BaseSettingsPanel)
    ├── AccessSettingsPanel (extends BaseSettingsPanel)
    ├── PromptsSettingsPanel
    └── BleedSettingsPanel
```

### Shared Components

**16 components + 8 CSS modules + 1 base class** (25 files total)

```
Shared (wiederverwendbar ueber alle Views)
├── Components (16)
│   ├── BaseModal                    Focus trap, Escape-to-close, centered dialog
│   ├── VelgSidePanel                Slide-from-right panel shell, focus trap, role="dialog", aria-modal="true"
│   ├── SharedFilterBar              Ersetzt 4x duplizierten Filter
│   ├── VelgBadge                    6 color variants (default, primary, info, warning, danger, success)
│   ├── VelgAvatar                   Portrait + initials fallback, 3 sizes (sm/md/lg), optional alt override
│   ├── VelgIconButton               30px icon action button
│   ├── VelgSectionHeader            Section titles, 2 variants
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
│   └── typography-styles.ts         Shared typography patterns
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
/auth/login                         → LoginView
/auth/register                      → RegisterView
/invite/:token                      → InvitationAcceptView
/profile                            → UserProfileView
```

---

## Service-Layer (Hybrid-Architektur)

Das Frontend kommuniziert mit **zwei Targets**: Supabase direkt (Auth) und FastAPI (Business-Logik, 22 API services).

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
├── BaseApiService.ts               # Basis mit JWT-Header, Error-Handling, Simulation-Context, getPublic()
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
├── HealthApiService.ts             # Simulation health + game mechanics
└── index.ts                        # Re-exports all service singletons
```

**22 API services** (excluding BaseApiService and index.ts).

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
└── i18n/
    └── locale-service.ts           # LocaleService: initLocale, setLocale, getInitialLocale
```

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
| auth/ | 3 | 3 | Login, Register, LoginPanel |
| layout/ | 3 | 3 | Shell, Header, Nav |
| agents/ | 6 | 6 | View, Card, EditModal, DetailsPanel, RelationshipCard/EditModal |
| buildings/ | 6 | 6 | View, Card, EditModal, DetailsPanel, EmbassyCreate/Link |
| events/ | 6 | 6 | View, Card, EditModal, DetailsPanel, EchoCard/TriggerModal |
| chat/ | 7 | 7 | View, Window, ConversationList, MessageList/Input, AgentSelector, EventPicker |
| social/ | 9 | 9 | TrendsView, MediaView, CampaignDashboard, Cards, Modals, TrendFilterBar |
| locations/ | 5 | 5 | View, CityList, ZoneList, StreetList, LocationEditModal |
| lore/ | 6 | 1 | SimulationLoreView + lore-content dispatcher + 4 content files |
| multiverse/ | 7 | 4 | CartographerMap, MapGraph, MapTooltip, MapConnectionPanel + 3 utilities |
| settings/ | 9 | 9 | SettingsView + 8 panels (General, World, AI, Integration, Design, Access, Prompts, Bleed) |
| health/ | 1 | 1 | SimulationHealthView (game metrics dashboard) |
| epoch/ | 5 | 5 | CommandCenter, CreationWizard, Leaderboard, BattleLog, DeployOperativeModal |
| shared/ | 25 | 16 | 16 components + 8 CSS modules + 1 base class |
| **Gesamt** | **107** | **90** (in components/) | **15 Verzeichnisse** |

### Utilities

```
frontend/src/utils/
├── text.ts                         # getInitials() helper
└── icons.ts                        # Centralized SVG icons with aria-hidden="true"
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
└── MapConnectionPanel.ts     # Edge-Detail-Panel (erweitert VelgSidePanel)
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
  fantasy: '#f59e0b',      // Capybara Kingdom
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
