# 07 - Frontend Components: Komponenten + Simulation-Settings-UI

**Version:** 1.2
**Datum:** 2026-02-25
**Aenderung v1.2:** LoreScroll-Akkordeon auf Dashboard. LoginPanel (Slide-from-Right). SimulationCard mit Banner-Bild + Zaehler. VelgSimulationShell Theming-Lifecycle (connectedCallback/disconnectedCallback). Anonymer Read-Only-Modus in allen Entity-Komponenten via `appState.isAuthenticated.value`.
**Änderung v1.1:** Zod-Validierung, @lit-labs/router, Biome-Tooling ergänzt

---

## Komponenten-Hierarchie

### Plattform-Level

```
App (Root)
├── PlatformHeader
│   ├── SimulationSelector (Dropdown)
│   ├── UserMenu
│   └── LocaleSelector
├── SimulationsDashboard
│   ├── SimulationCard (je Simulation)
│   └── CreateSimulationButton
├── CreateSimulationWizard
│   ├── Step 1: Basic Info (Name, Theme, Locale)
│   ├── Step 2: Taxonomies (Import defaults or custom)
│   └── Step 3: Confirm & Create
└── AuthViews
    ├── LoginView
    ├── RegisterView
    └── ResetPasswordView
```

### Simulation-Level

```
SimulationShell (Layout mit Navigation)
├── SimulationHeader
│   ├── Navigation (Tabs/Sidebar)
│   └── SimulationInfo (Name, Theme)
├── AgentsView
│   ├── SharedFilterBar ← NEU: Shared Component
│   ├── AgentCard
│   │   ├── AgentPortrait
│   │   └── AgentActions
│   ├── AgentEditModal (extends BaseModal)
│   └── AgentDetailsPanel
├── BuildingsView
│   ├── SharedFilterBar
│   ├── BuildingCard
│   │   └── BuildingImage
│   ├── BuildingEditModal (extends BaseModal)
│   └── BuildingDetailsPanel
├── EventsView
│   ├── SharedFilterBar
│   ├── EventCard
│   │   └── EventReactions
│   ├── EventEditModal (extends BaseModal)
│   └── EventDetailsPanel
├── ChatView
│   ├── ConversationList
│   ├── ChatWindow
│   │   ├── MessageList
│   │   └── MessageInput
│   └── AgentSelector
├── SocialTrendsView
│   ├── SharedFilterBar
│   ├── TrendCard
│   ├── TransformationModal (extends BaseModal)
│   └── CampaignDashboard
├── LocationsView (Cities/Zones/Streets)
│   ├── CityList
│   ├── ZoneList
│   └── MapView (optional)
└── SettingsView ← NEU
    ├── SettingsTabs
    ├── GeneralSettingsPanel
    ├── WorldSettingsPanel (Taxonomien)
    ├── AISettingsPanel (Modelle, Prompts)
    ├── IntegrationSettingsPanel
    ├── DesignSettingsPanel
    └── AccessSettingsPanel
```

### Shared Components

```
Shared (wiederverwendbar über alle Views)
├── BaseModal                        ← Beibehalten (exzellentes Pattern)
├── SharedFilterBar                  ← NEU: Ersetzt 4× duplizierten Filter
├── DataTable                        ← NEU: Als Lit-Komponente (statt HTMLElement)
├── FormBuilder                      ← NEU: Als Lit-Komponente
├── ErrorState                       ← NEU: Einheitliches Error-Pattern
├── LoadingState                     ← NEU: Einheitliches Loading-Pattern
├── EmptyState                       ← NEU: "Keine Daten" Anzeige
├── ProgressSpinner                  ← Beibehalten
├── AdvancedLightbox                 ← Beibehalten
├── ConfirmDialog                    ← NEU
├── Toast/Notification               ← NEU
└── Pagination                       ← NEU: Einheitliche Pagination
```

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

### U3: VelgDataTable → Lit-Komponente

**Problem:** VelgDataTable (404 Zeilen) ist legacy HTMLElement.

**Lösung:** Kompletter Rewrite als Lit-Komponente mit Signals:
```typescript
@customElement('data-table')
export class DataTable<T> extends LitElement {
  @property({ type: Array }) columns: TableColumn<T>[] = [];
  @property({ type: Array }) data: T[] = [];
  @property({ type: Boolean }) loading = false;
  @property({ type: Object }) pagination: PaginationConfig;
  @property({ type: String }) sortBy: string;
  @property({ type: String }) sortOrder: 'asc' | 'desc';

  // Emits: 'sort-change', 'page-change', 'row-click', 'row-action'
}
```

### U4: VelgForm → Lit-Komponente

**Problem:** VelgForm (465Z) + VelgFormBuilder (305Z) sind legacy HTMLElement.

**Lösung:** Lit-basierter FormBuilder mit Validierung:
```typescript
@customElement('form-builder')
export class FormBuilder extends LitElement {
  @property({ type: Array }) fields: FormFieldConfig[] = [];
  @property({ type: Object }) values: Record<string, any> = {};
  @property({ type: Object }) errors: Record<string, string> = {};
  @property({ type: Boolean }) loading = false;

  // Emits: 'form-submit', 'field-change', 'form-cancel'
}
```

**Validierung mit Zod:**
```typescript
import { z } from 'zod';

// Schema definieren (parallel zu Pydantic im Backend)
const AgentCreateSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200),
  system: z.string().min(1, 'System ist erforderlich'),
  gender: z.string().min(1, 'Geschlecht ist erforderlich'),
  description: z.string().optional(),
  loyalty: z.number().min(0).max(100).optional(),
  influence: z.number().min(0).max(100).optional(),
});

type AgentCreate = z.infer<typeof AgentCreateSchema>;

// Verwendung in Formularen:
const result = AgentCreateSchema.safeParse(formData);
if (!result.success) {
  const errors = result.error.flatten().fieldErrors;
  // → { name: ['Name ist erforderlich'], ... }
}
```

### U5: Error/Loading-States → Einheitlich

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

### U6-U10: Weitere Fixes

| # | Problem | Lösung |
|---|---------|--------|
| U6 | Event-Naming gemischt | Einheitlich kebab-case: `filter-change`, `item-select` |
| U7 | State-Management gemischt | Alle Komponenten nutzen SignalWatcher |
| U8 | Inline Farb-Werte | Nur Design-Tokens, keine hardcodierten Werte |
| U9 | Keine Validierung | **Zod** Schema-Validierung (TypeScript-first, Pydantic-Äquivalent) |
| U10 | Hardcodierte Strings | **@lit/localize** i18n-System (Runtime-Mode): `msg('Loading...')` |

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
/simulations                        → SimulationsDashboard
/simulations/new                    → CreateSimulationWizard
/simulations/:simId                 → Redirect zu /simulations/:simId/agents
/simulations/:simId/agents          → AgentsView
/simulations/:simId/agents/:id      → AgentDetailsPanel
/simulations/:simId/buildings       → BuildingsView
/simulations/:simId/buildings/:id   → BuildingDetailsPanel
/simulations/:simId/events          → EventsView
/simulations/:simId/events/:id      → EventDetailsPanel
/simulations/:simId/chat            → ChatView
/simulations/:simId/chat/:convId    → ChatWindow
/simulations/:simId/trends          → SocialTrendsView
/simulations/:simId/campaigns       → CampaignDashboard
/simulations/:simId/locations       → LocationsView
/simulations/:simId/settings        → SettingsView
/simulations/:simId/settings/:tab   → SettingsView (spezifischer Tab)
/simulations/:simId/members         → MembersView
/auth/login                         → LoginView
/auth/register                      → RegisterView
/auth/reset-password                → ResetPasswordView
/invite/:token                      → InvitationAcceptView
```

---

## Service-Layer (Hybrid-Architektur)

Das Frontend kommuniziert mit **zwei Targets**: Supabase direkt (Auth, Storage, Realtime) und FastAPI (Business-Logik).

### Supabase Direct Services

```
frontend/src/services/supabase/
├── client.ts                       # Shared Supabase Client-Instanz
├── SupabaseAuthService.ts          # Auth: Login, Signup, Logout, Password-Reset
├── SupabaseStorageService.ts       # Storage: User-Uploads (Portraits, Assets)
├── SupabaseRealtimeService.ts      # Realtime: Live-Updates (Agents, Chat)
└── index.ts
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
├── BaseApiService.ts               # Basis mit JWT-Header, Error-Handling, Simulation-Context
├── SimulationsApiService.ts        ← NEU
├── MembersApiService.ts            ← NEU
├── SettingsApiService.ts           ← NEU
├── TaxonomiesApiService.ts         ← NEU
├── AgentsApiService.ts             # Erweitert um simulation-scoped URLs
├── BuildingsApiService.ts
├── EventsApiService.ts
├── ChatApiService.ts
├── GenerationApiService.ts
├── SocialTrendsApiService.ts
├── SocialMediaApiService.ts        ← NEU (statt FacebookApiService)
├── PromptTemplatesApiService.ts
├── LocationsApiService.ts
├── UsersApiService.ts              ← NEU (Profil + Mitgliedschaften)
├── InvitationsApiService.ts        ← NEU
└── index.ts
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

### Zuständigkeits-Aufteilung

| Aktion | Service | Target |
|--------|---------|--------|
| Login, Signup, Logout | SupabaseAuthService | Supabase direkt |
| Password Reset | SupabaseAuthService | Supabase direkt |
| Custom Portrait Upload | SupabaseStorageService | Supabase Storage |
| Live-Updates (Chat, Agents) | SupabaseRealtimeService | Supabase Realtime |
| Agents/Buildings/Events CRUD | AgentsApiService etc. | FastAPI |
| AI-Generierung | GenerationApiService | FastAPI |
| Settings, Taxonomien | SettingsApiService | FastAPI |
| News/Social Media | SocialTrendsApiService | FastAPI |

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

## Komponenten-Zählung (Neu vs Alt)

| Kategorie | Alt (65 Dateien) | Neu (geschätzt) | Änderung |
|-----------|-----------------|-----------------|----------|
| Plattform-Level | 0 | ~10 | +10 NEU |
| Simulation-Views | ~20 | ~15 | Konsolidiert |
| Modals | ~11 | ~10 | BaseModal beibehalten |
| Shared Components | ~5 | ~15 | Deutlich mehr Shared |
| Settings UI | 2 (Model/Prompt) | ~8 | NEU |
| Forms/Tables | 2 (legacy) | 2 (Lit) | Rewrite |
| Services | 14 | ~18 | Erweitert |
| Types | 6 (mit Duplikation) | ~15 (ohne Duplikation) | Konsolidiert |
| **Gesamt** | ~65 | ~93 | Mehr Dateien, weniger Code |
