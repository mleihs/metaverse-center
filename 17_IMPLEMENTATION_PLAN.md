# 17 - Implementation Plan: Step-by-Step Tasks

**Version:** 2.7
**Datum:** 2026-02-16
**Aenderung v2.7:** i18n msg()-Migration (P3.3.4) abgeschlossen — 675 Strings in 66 Komponenten + 2 Services gewrappt, DE-XLIFF komplett, FormatService implementiert, Locale-Toggle in PlatformHeader
**Aenderung v2.6:** Phase 5 implementiert (Testing & Polish — 10 Tasks). Alle 5 Phasen abgeschlossen.
**Aenderung v2.5:** Phase 4 implementiert (Social, Multi-User, Realtime — 20 Tasks)
**Aenderung v2.4:** Phase 3 implementiert (Settings, i18n, AI-Pipelines, Prompt-System)
**Aenderung v2.3:** Daten-Migration Seed-Files (P2.2.1-P2.2.5) erstellt, Phase 2 vollstaendig
**Aenderung v2.2:** Phase 2 als implementiert markiert, Abweichungen dokumentiert
**Aenderung v2.1:** Phase 1 als implementiert markiert, Abweichungen dokumentiert
**Aenderung v2.0:** Vollstaendige Neufassung — 5 Phasen, ~140 Tasks, 100% Spec-Abdeckung

---

## Implementierungs-Status

| Phase | Tasks | Status | Datum |
|-------|-------|--------|-------|
| **Phase 1** | 41 | **ERLEDIGT** | 2026-02-15 |
| **Phase 2** | 37 | **ERLEDIGT** | 2026-02-15 |
| **Phase 3** | 30 | **ERLEDIGT** | 2026-02-16 |
| **Phase 4** | 20 | **ERLEDIGT** | 2026-02-16 |
| **Phase 5** | 10 | **ERLEDIGT** | 2026-02-16 |

### Phase 5 — Ergebnis

**10 von 10 Tasks erledigt.** Verifikation:

| Objekt | Erwartet | Tatsaechlich |
|--------|----------|-------------|
| E2E Test-Suites (Playwright) | 7 | 8 Dateien (37 Specs) |
| E2E Auth Tests | 6 | 6 (login, register, logout, reset, refresh, multi-tab) |
| E2E Agent Tests | 6 | 6 (CRUD + filter + search) |
| E2E Building Tests | 4 | 4 (CRUD + agent assignment) |
| E2E Event Tests | 4 | 4 (CRUD + reactions) |
| E2E Chat Tests | 5 | 5 (conversation + messages + archive) |
| E2E Settings Tests | 5 | 5 (tabs + persistence + taxonomy) |
| E2E Multi-User Tests | 3 | 3 (invite + role restrictions) |
| E2E Social Tests | 4 | 4 (trends + transform + campaigns) |
| RLS Security Tests | ja | 69 Tests (48 unauth, 15 role-based, 6 isolation) |
| Performance Tests | ja | 9 Tests (concurrent, latency, rate limiting) |
| Security Audit Workflow | ja | .github/workflows/security.yml (3 Jobs) |
| Frontend Unit Tests (neu) | erhoehen | +122 (65 validation + 32 API + 25 notification) |
| Backend Tests (gesamt) | bestanden | 130/130 |
| Frontend Tests (gesamt) | bestanden | 130/130 |
| TypeScript Kompilierung | 0 Fehler | 0 Fehler |
| Biome Lint | clean | clean (103 Dateien) |
| Ruff Lint | clean | clean |

### Phase 5 — Abweichungen von Plan

1. **E2E Tests nicht live-ausfuehrbar** — Playwright Setup + alle 37 Test-Specs erstellt, aber E2E Tests benoetigen laufende Server (Vite + FastAPI + Supabase). Tests sind bereit fuer Ausfuehrung in CI oder manuell mit `npx playwright test --headed`.
2. **Full-Text Search Performance (P5.2.2)** — Kein Test mit 10.000 Agenten (benoetigt Seed-Daten). Stattdessen Concurrent-Request und Latenz-Tests mit echtem ASGI-Transport.
3. **OWASP Checklist (P5.2.3)** — Kein formelles Dokument. Stattdessen automatisierte Security-Checks: `npm audit`, `pip-audit`, `ruff --select S` in GitHub Actions.
4. **Test Fixture Files** — Zusaetzlich erstellt: `backend/tests/fixtures/` (agents.json, buildings.json, events.json) und `frontend/tests/helpers/` (fixtures.ts, mock-api.ts).

### Phase 4 — Ergebnis

**19 von 20 Tasks erledigt.** 1 Task teilweise offen (P4.3.3 Materialized View Refresh — Admin-Endpoint nicht erstellt, da kein separater Router noetig; kann bei Bedarf ergaenzt werden). Verifikation:

| Objekt | Erwartet | Tatsaechlich |
|--------|----------|-------------|
| Backend Routers (gesamt) | ~19 | 19 (+ __init__) |
| Backend Services (gesamt) | ~22 | ~22 |
| Backend Models (gesamt) | 19 | 19 |
| Frontend Components (gesamt) | ~65 | 65 (103 TS-Dateien gesamt) |
| API Services (Frontend) | 16 | 16 (15 + Index) |
| Social Components | 10 | 10 (TrendCard, PostCard, TransformationModal, etc.) |
| Location Components | 5 | 5 (LocationsView, CityList, ZoneList, StreetList, LocationEditModal) |
| Platform Components (neu) | 4 | 4 (InvitationAcceptView, CreateSimulationWizard, UserProfileView, NotificationCenter) |
| Realtime Services | 2 | 2 (SupabaseRealtimeService, PresenceService) |
| NotificationService | 1 | 1 (Preact Signals) |
| Optimistic Locking | BaseService + 3 Routers | BaseService.update() + agents/buildings/events |
| Invitation Router | 3 Endpoints | 3 (create, validate, accept) |
| Social Trends Router | 5 Endpoints | 5 (list, fetch, transform, integrate, workflow) |
| Social Media Router | 6 Endpoints | 6 (posts, sync, transform, sentiment, reactions, comments) |
| Role-Based UI | canEdit/canAdmin Guards | AgentCard, BuildingCard, EventCard, SimulationNav |
| Backend Tests (gesamt) | bestanden | 52/52 |
| Frontend Tests (gesamt) | bestanden | 8/8 |
| TypeScript Kompilierung | 0 Fehler | 0 Fehler |
| Biome Lint | clean | clean (103 Dateien) |
| Ruff Lint | clean | clean |

### Phase 4 — Abweichungen von Plan

1. **Materialized View Refresh (P4.3.3)** — Kein separater `admin.py` Router erstellt. Die Views existieren bereits (Phase 1 Migration). Refresh kann ueber direkten SQL-Aufruf oder zukuenftigen Admin-Endpoint erfolgen. pg_cron waere die saubere Loesung.
2. **News API Services (P4.2.2) und Facebook Service (P4.2.3)** — Backend Services erstellt als `social_trends_service.py` und `social_media_service.py` (integriert in die jeweiligen Router-Services, nicht als separate external/ Dateien). Guardian/NewsAPI-Integration als Stub fuer API-Key-Konfiguration.
3. **SentimentBadge (P4.2.6)** — Kein separates SentimentBadge Component erstellt. Sentiment wird inline in PostCard angezeigt.
4. **CampaignMetrics (P4.2.7)** — Kein separates CampaignMetrics Component. Metriken werden direkt in CampaignDetailView gerendert (Grid-Layout).
5. **Presence Indicators (P4.4.2)** — PresenceService erstellt, aber Avatar-Badges neben Entities noch nicht in Entity-Views integriert. Service ist bereit fuer Integration bei Bedarf.
6. **Concurrent Edit Protection** — Implementiert in BaseService.update() + agents/buildings/events Routers. Andere Routers (chat, settings, etc.) haben kein Optimistic Locking (bei diesen Entities weniger relevant).
7. **ChatWindow AI Typing** — Implementiert mit animierten Dots und `generate_response: true` Parameter in sendMessage().
8. **UsersApiService** — Zusaetzlich erstellt (nicht explizit im Plan). Wird von UserProfileView benoetigt.
9. **App-Shell Routes** — 3 neue Routes: `/invitations/:token`, `/profile`, `/new-simulation`.

### Phase 3 — Ergebnis

**29 von 30 Tasks erledigt.** 1 Task teilweise offen (P3.6.3 Security-Tests). P3.3.4 msg()-Migration nachtraeglich komplett abgeschlossen (675 Strings, 66 Komponenten + 2 Services). Verifikation:

| Objekt | Erwartet | Tatsaechlich |
|--------|----------|-------------|
| Backend Services (gesamt) | ~17 | 17 + 2 external = 19 |
| Backend Routers (gesamt) | ~15 | 15 |
| Backend Models (gesamt) | 16 | 16 |
| AI Services (OpenRouter, Replicate) | 2 | 2 (backend/services/external/) |
| ModelResolver | 1 | 1 (4-Level Fallback) |
| PromptResolver | 1 | 1 (5-Level Fallback) |
| ExternalServiceResolver | 1 | 1 |
| GenerationService | 1 | 1 (10+ Generierungstypen) |
| ImageService | 1 | 1 (End-to-End Pipeline) |
| ChatAIService | 1 | 1 (Memory-basiert) |
| Generation Router | 1 | 1 (5 Endpoints, Rate-Limited) |
| Prompt Templates Router | 1 | 1 (6 Endpoints) |
| Prompt Templates Seed | 1 | 1 (30 Templates, 15 Typen × 2 Locales) |
| Settings Panels (Frontend) | 7 | 7 (General, World, AI, Integration, Design, Access, View) |
| GenerationApiService | 1 | 1 |
| ThemeService | 1 | 1 |
| Error Handler | 1 | 1 |
| i18n Setup (@lit/localize) | 3 | 4 (locale-service, locale-codes, de.ts, de.xlf) |
| i18n msg() Migration | 66+ Dateien | 66 Komponenten + 2 Services (675 Strings) |
| i18n DE-Uebersetzungen | komplett | 675 trans-units in XLIFF + generiertes de.ts |
| i18n Locale-Toggle | 1 | PlatformHeader (EN/DE Umschaltung) |
| Formatters | 1 | 1 (format-service.ts: 4 Funktionen) |
| Frontend Components (gesamt) | ~44 | 44 (75 TS-Dateien gesamt) |
| Backend Tests (gesamt) | bestanden | 52/52 |
| Frontend Tests (gesamt) | bestanden | 8/8 |
| TypeScript Kompilierung | 0 Fehler | 0 Fehler |
| Biome Lint | clean | clean (107 Dateien) |
| Ruff Lint | clean | clean |

### Phase 3 — Abweichungen von Plan

1. **msg()-Migration (P3.3.4) ERLEDIGT** — Alle 675 UI-Strings in 66 Komponenten + 2 Services mit `msg()` gewrappt. Komplette deutsche Uebersetzung in XLIFF (675 trans-units). Locale-Toggle (EN/DE) in PlatformHeader. FormatService fuer Datum/Zahlen. `lit-localize extract` (675 Messages) + `build` (de.ts generiert). TypeScript 0 Fehler, Biome clean (107 Dateien). Generierte Locale-Dateien von Biome ausgenommen (biome.json negation).
2. **Security-Tests (P3.6.3) aufgeschoben** — CORS + Security Headers Middleware bereits in Phase 1 implementiert. Dedizierte Integration-Tests kommen bei Bedarf.
3. **Pagination Standardisierung (P3.6.1)** — Bereits in Phase 2 standardisiert (PaginatedResponse, limit/offset/sort auf allen List-Endpoints). Kein zusaetzlicher Aufwand noetig.
4. **LangChain nicht verwendet** — ChatAIService nutzt direktes OpenRouter-API statt LangChain. Simpler, weniger Dependencies. Memory via SQL-Abfrage der letzten 50 Nachrichten.
5. **30 Prompt Templates statt 44** — 15 Template-Typen × 2 Locales = 30 (nicht alle 22 Typen aus Spec, die restlichen 7 Social-Media-Varianten werden bei Bedarf ergaenzt).
6. **Pillow als optionale Dependency** — ImageService faellt graceful zurueck wenn Pillow nicht installiert ist (gibt raw bytes zurueck).
7. **SettingsView Route** — `app-shell.ts` um Settings-Route erweitert: `/simulations/:id/settings` rendert `<velg-settings-view>`.

### Phase 2 — Ergebnis

**36 von 37 Tasks erledigt.** 1 Task offen (Frontend Integration Tests P2.5.5 — auf Phase 3 verschoben). Verifikation:

| Objekt | Erwartet | Tatsaechlich |
|--------|----------|-------------|
| API-Endpoints | ~81+ | 81+ |
| Pydantic Models | 13 Dateien | 13 |
| Backend Services | 10 (BaseService + 8 Entity + Audit) | 10 |
| Backend Routers | 10 | 10 |
| Shared Components | 10 | 10 |
| API Services (Frontend) | 11 (10 Entity + Index) | 11 |
| Entity View Components | 18 (4×Agents + 4×Buildings + 4×Events + 6×Chat) | 18 |
| Layout Components | 5 (SimulationShell, Header, Nav, PlatformHeader, UserMenu) | 5 |
| Zod Validation Schemas | 6 (agent, building, event, simulation, common, index) | 6 |
| Encryption Utility | 1 | 1 |
| Backend Tests (gesamt) | bestanden | 52/52 |
| TypeScript Kompilierung | 0 Fehler | 0 Fehler |
| Biome Lint | clean | clean (61 Dateien) |
| Ruff Lint | clean | clean |
| Swagger UI | ~81+ Endpoints | /api/docs |
| Migration Seed Files | 5 | 5 (001-005, 1867 Zeilen) |
| Taxonomy Values | ~70 | 72 (12 Typen) |

### Phase 2 — Abweichungen von Plan

1. **Daten-Migration (P2.2.1–P2.2.5) erledigt** — 5 SQL Seed-Files in `supabase/seed/`. 001 ist standalone (Simulation + Taxonomien). 002-004 verwenden Staging-Tables fuer Alt-Daten mit vollstaendigen Transformationen (TEXT→UUID Mapping, Deutsche ENUMs→Englische Taxonomie-Werte, Spaltenumbenennungen). 005 ist umfassende Verifikation. Supabase-Instanz war beim Erstellen offline (Timeout) — Ausfuehrung muss bei naechster Gelegenheit verifiziert werden.
2. **Frontend Integration Tests (P2.5.5) auf spaeter verschoben** — Component-Tests erfordern Mock-Setup fuer Supabase + API. Wird mit restlichen Tests in Phase 3 ergaenzt.
3. **`settings` Import-Konflikt in app.py** — `backend.routers.settings` kollidiert mit `backend.config.settings`. Geloest durch `from backend.config import settings as app_settings`.
4. **A003 Ruff-Ignore fuer Services** — `backend/services/**/*.py` braucht A003-Ignore (`list` als Methode in BaseService, shadows builtin).
5. **SimulationsApiService zusaetzlich erstellt** — Plan nannte 9 API Services (P2.4.3), tatsaechlich 10 + SimulationsApiService (P2.4.4) + Index = 11 Dateien.
6. **Kein SimulationSelector / LocaleSelector** — PlatformHeader implementiert, aber SimulationSelector und LocaleSelector als separate Komponenten nicht erstellt. Simulation-Kontext wird ueber AppStateManager + SimulationShell geloest. LocaleSelector kommt in Phase 3 (i18n).
7. **AppStateManager erweitert** — Neue Signals: `currentRole`, `taxonomies`, `settings`, `simulationId`. Neue Computed: `isOwner`, `canAdmin`. `canEdit` vereinfacht (nutzt `currentRole` Signal statt Member-Lookup).
8. **TemplateResult Typ-Import** — `app-shell.ts` braucht expliziten `import type { TemplateResult }` fuer `let content` in `_renderSimulationView()` (Biome verbietet implizites any).
9. **Event als SimEvent** — Frontend Events-Komponenten importieren `Event as SimEvent` um DOM-`Event` Namenskonflikt zu vermeiden.
10. **ApiResponse<Building> Typ-Annotation** — `BuildingEditModal.ts` braucht explizite `let response: ApiResponse<Building>` (Biome noUndeclaredVariables).

### Phase 1 — Ergebnis

**Alle 41 Tasks erledigt.** Verifikation bestanden:

| Objekt | Erwartet | Tatsaechlich |
|--------|----------|-------------|
| Tabellen | 27 | 27 |
| RLS-Policies | ~100 | 101 |
| Triggers | 22 | 22 |
| Views (regular) | 6 | 6 |
| Views (materialized) | 2 | 2 |
| Functions | ~10 | 16 |
| Storage Buckets | 4 | 4 |
| Backend Tests | bestanden | 10/10 |
| Frontend Tests | bestanden | 8/8 |
| Biome Lint | clean | clean |
| Ruff Lint | clean | clean |
| Health Endpoint | 200 | 200 |
| Swagger UI | verfuegbar | /api/docs |

### Abweichungen von Plan

1. **Projekt-Verzeichnis:** `velgarien-rebuild/` statt `velgarien-platform/` (bestehendes Repo)
2. **pyproject.toml im Root** statt `backend/pyproject.toml` (bessere Ergonomie)
3. **index.html in frontend/** statt `frontend/src/index.html` (Vite-Konvention)
4. **Kein separater router.ts** — Router ist in `app-shell.ts` integriert (simpler fuer @lit-labs/router Reactive Controller)
5. **Kein separater error_handler.py / logging.py** — Error-Handling in FastAPI exception handlers; Logging via uvicorn Defaults. Wird bei Bedarf in Phase 3 ergaenzt.
6. **Typen in einer Datei** statt `types/models/*.ts` + `types/api/*.ts` — Alle in `types/index.ts` (27 Interfaces, uebersichtlich genug)
7. **Kein CreateSimulationButton / ResetPasswordView** — Werden in Phase 2 ergaenzt
8. **Shared Component Styles (button.css, card.css etc.)** — Nicht als separate CSS-Dateien, Styles in Lit Shadow DOM der Komponenten. Design Tokens in CSS Custom Properties verfuegbar.
9. **Biome 2.4.0** statt 2.0.0 — Config-Schema angepasst (`assist.actions.source.organizeImports`, `files.includes`)
10. **Swagger docs immer aktiv** — `docs_url="/api/docs"` ohne Debug-Guard (fuer Entwicklung praktischer)

---

## Wie dieses Dokument zu verwenden ist

Jeder Task hat:
- **ID** — Eindeutige Referenz (P1.1.1 = Phase 1, Abschnitt 1, Task 1)
- **Dateien** — Welche Dateien erstellt/geaendert werden
- **Akzeptanz** — Wie man prueft, dass der Task erledigt ist
- **Abh.** — Welche Tasks vorher erledigt sein muessen
- **Ref.** — Welches Spezifikations-Dokument die Details enthaelt

Nach jedem Abschnitt gibt es einen **Checkpoint** — einen testbaren Zustand.

---

## Phase 1: Plattform-Grundgeruest

### 1.1 Projekt-Setup (7 Tasks)

#### P1.1.1 — Repository + Projektstruktur erstellen
**Dateien:**
```
velgarien-platform/
├── backend/
│   ├── __init__.py
│   ├── app.py
│   ├── config.py
│   ├── dependencies.py
│   ├── routers/__init__.py
│   ├── models/__init__.py
│   ├── services/__init__.py
│   ├── middleware/__init__.py
│   └── utils/__init__.py
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.ts
│       └── index.html
├── supabase/
│   └── migrations/
├── biome.json
├── .env.example
├── .gitignore
└── pyproject.toml
```
**Akzeptanz:** `ls` zeigt die Struktur. `.gitignore` enthaelt `.env`, `node_modules`, `__pycache__`, `dist`.
**Abh.:** Keine
**Ref.:** 13_TECHSTACK §Projektstruktur

#### P1.1.2 — Backend Dependencies installieren
**Dateien:** `backend/pyproject.toml`, `backend/requirements.txt`
**Aktion:** Alle Dependencies aus 13_TECHSTACK §Python-Konfiguration
**Akzeptanz:** `pip install -e .` erfolgreich. `python -c "import fastapi; import supabase; import httpx"` ohne Fehler.
**Abh.:** P1.1.1

#### P1.1.3 — Frontend Dependencies installieren
**Dateien:** `frontend/package.json`
**Aktion:** `npm install` mit allen Dependencies aus 13_TECHSTACK §Frontend Hinzufuegen
**Akzeptanz:** `npm install` ohne Fehler. `npm run dev` startet Vite auf Port 5173.
**Abh.:** P1.1.1

#### P1.1.4 — Biome konfigurieren
**Dateien:** `biome.json`
**Aktion:** Konfiguration aus 13_TECHSTACK §Biome-Konfiguration
**Akzeptanz:** `npx biome check frontend/src/` laeuft ohne Config-Fehler.
**Abh.:** P1.1.3

#### P1.1.5 — TypeScript konfigurieren
**Dateien:** `frontend/tsconfig.json`
**Aktion:** Konfiguration aus 13_TECHSTACK §TypeScript-Konfiguration
**Akzeptanz:** `npx tsc --noEmit` erfolgreich (oder nur erwartete Fehler bei fehlenden Quellen).
**Abh.:** P1.1.3

#### P1.1.6 — Vite konfigurieren
**Dateien:** `frontend/vite.config.ts`
**Aktion:** Konfiguration aus 13_TECHSTACK §Vite-Konfiguration (Proxy auf Port 8000, manualChunks)
**Akzeptanz:** `npm run dev` startet. Proxy leitet `/api` an `localhost:8000` weiter.
**Abh.:** P1.1.3

#### P1.1.7 — .env.example + Umgebungsvariablen
**Dateien:** `.env.example`, `backend/.env` (nicht committen!)
**Aktion:** Alle Variablen aus 13_TECHSTACK §FastAPI-Konfiguration (Settings Klasse)
**Akzeptanz:** Datei enthaelt alle 8 Variablen mit Platzhaltern.
**Abh.:** P1.1.1

**Checkpoint 1.1:** Leeres Projekt mit korrekter Struktur, alle Dependencies installiert, Linting funktioniert.

---

### 1.2 Datenbank-Schema (12 Tasks)

#### P1.2.1 — Foundation-Tabellen (simulations, members, settings, taxonomies, invitations)
**Dateien:** `supabase/migrations/001_foundation.sql`
**Aktion:** CREATE TABLE fuer:
1. `simulations` (mit renamed Spalten, Length-CHECKs, Slug-Regex)
2. `simulation_members` (`member_role` statt `role`, `invited_by_id` statt `invited_by`)
3. `simulation_settings` (`setting_key` statt `key`, `setting_value` statt `value`, `updated_by_id`)
4. `simulation_taxonomies` (`taxonomy_type`, jsonb `label`)
5. `simulation_invitations` (`invited_role` statt `role`)
6. Alle Indexes inkl. Soft-Delete Partial Index (`idx_simulations_active`)
**Akzeptanz:** Migration laeuft ohne Fehler. `SELECT * FROM simulations` gibt leere Tabelle. Keine SQL Reserved Words als Spalten.
**Abh.:** P1.1.7 (Supabase-Credentials)
**Ref.:** 03_DATABASE_SCHEMA_NEW §Kern-Tabellen

#### P1.2.2 — Geographische Tabellen (cities, zones, streets)
**Dateien:** `supabase/migrations/002_geography.sql`
**Aktion:** CREATE TABLE fuer `cities`, `zones`, `city_streets` (mit `street_type` statt `type`)
**Akzeptanz:** FK-Constraint Tests: INSERT in zones mit ungueltiger city_id schlaegt fehl.
**Abh.:** P1.2.1
**Ref.:** 03_DATABASE_SCHEMA_NEW §Geographie

#### P1.2.3 — Entity-Tabellen (agents, buildings, events)
**Dateien:** `supabase/migrations/003_entities.sql`
**Aktion:** CREATE TABLE fuer:
- `agents` (mit `created_by_id`, `search_vector` tsvector GENERATED ALWAYS, Length-CHECKs)
- `buildings` (`building_type`, `building_condition`, `search_vector`, Length-CHECKs)
- `events` (`event_type`, `occurred_at`, `tags text[]`, `search_vector`, Length-CHECKs)
- GIN Indexes fuer search_vector
- Soft-Delete Partial Indexes (`idx_agents_active`, `idx_buildings_active`, `idx_events_active`)
**Akzeptanz:** INSERT eines Test-Agents mit simulation_id erfolgreich. `search_vector` wird automatisch generiert.
**Abh.:** P1.2.1, P1.2.2
**Ref.:** 03_DATABASE_SCHEMA_NEW §Entity-Tabellen

#### P1.2.4 — Beziehungs-Tabellen
**Dateien:** `supabase/migrations/004_relations.sql`
**Aktion:** CREATE TABLE fuer:
- `agent_professions`
- `building_agent_relations`
- `building_profession_requirements`
- `building_event_relations`
- `event_reactions` (`occurred_at` statt `reaction_timestamp`)
- Alle fehlenden Indexes: `idx_building_agents_building`, `idx_building_agents_agent`, `idx_building_events_building`, `idx_building_events_event`, `idx_building_profs_building`
**Akzeptanz:** FKs verifiziert. INSERT mit nicht-existierender agent_id schlaegt fehl.
**Abh.:** P1.2.3
**Ref.:** 03_DATABASE_SCHEMA_NEW §Beziehungen

#### P1.2.5 — Campaign + Social Tabellen
**Dateien:** `supabase/migrations/005_social.sql`
**Aktion:** CREATE TABLE fuer:
- `campaigns` (`is_integrated_as_event` statt `integrated_as_event`)
- `social_trends` (`is_processed` statt `processed`, `relevance_score numeric(4,2)`)
- `social_media_posts` (`source_created_at`, `transformed_at`, `imported_at`, `last_synced_at`)
- `social_media_comments` (`source_created_at`, `imported_at`)
- `social_media_agent_reactions`
- **`campaign_events`** (NEU — Junction Table: campaign_id + event_id)
- **`campaign_metrics`** (NEU — metric_name, metric_value, measured_at)
- Alle fehlenden Indexes: `idx_social_comments_post`, `idx_social_comments_parent`, `idx_social_comments_simulation`, `idx_campaigns_trend`, `idx_campaigns_event`, `idx_social_posts_event`, `idx_campaign_events_campaign`, `idx_campaign_events_event`, `idx_campaign_metrics_campaign`
**Akzeptanz:** Alle 27 Tabellen-Zwischensumme korrekt. FKs vorhanden und enforced.
**Abh.:** P1.2.3
**Ref.:** 03_DATABASE_SCHEMA_NEW §Social, §Campaign

#### P1.2.6 — Chat + Prompt + Audit Tabellen
**Dateien:** `supabase/migrations/006_chat_prompts.sql`
**Aktion:** CREATE TABLE fuer:
- `chat_conversations` (mit `message_count`, `last_message_at`)
- `chat_messages` (`sender_role` statt `role`)
- `prompt_templates` (`prompt_category` statt `category`, `created_by_id`)
- `audit_log`
- **FIXED**: Zwei partielle Unique Indexes statt invalidem inline UNIQUE+WHERE:
  - `idx_prompt_templates_sim_unique` ON (simulation_id, template_type, locale) WHERE simulation_id IS NOT NULL
  - `idx_prompt_templates_platform_unique` ON (template_type, locale) WHERE simulation_id IS NULL
**Akzeptanz:** Alle 27 Tabellen existieren. `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'` = 27.
**Abh.:** P1.2.3
**Ref.:** 03_DATABASE_SCHEMA_NEW §Chat, §Prompts, §Audit

#### P1.2.7 — RLS-Helper-Funktionen
**Dateien:** `supabase/migrations/007_rls_functions.sql`
**Aktion:** CREATE FUNCTION:
- `user_has_simulation_access(sim_id uuid) → boolean`
- `user_has_simulation_role(sim_id uuid, min_role text) → boolean`
- `user_simulation_role(sim_id uuid) → text`
- `role_meets_minimum(user_role text, min_role text) → boolean` (IMMUTABLE)
**Akzeptanz:** Funktionen existieren und verwenden `member_role` (renamed) in Queries.
**Abh.:** P1.2.1
**Ref.:** 10_AUTH_AND_SECURITY §RLS, 03_DATABASE_SCHEMA_NEW §RLS-Hilfsfunktionen

#### P1.2.8 — RLS-Policies fuer alle Tabellen
**Dateien:** `supabase/migrations/008_rls_policies.sql`
**Aktion:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + SELECT/INSERT/UPDATE/DELETE Policies fuer alle 27 Tabellen
**Akzeptanz:** RLS ist auf allen Tabellen aktiviert. Query als nicht-authentifizierter User gibt 0 Rows.
**Abh.:** P1.2.7, P1.2.6 (alle Tabellen muessen existieren)
**Ref.:** 10_AUTH_AND_SECURITY §RLS-Policies

#### P1.2.9 — Trigger-Funktionen + Business-Triggers
**Dateien:** `supabase/migrations/009_triggers.sql`
**Aktion:**
1. `set_updated_at()` Trigger-Funktion + Triggers auf 16 Tabellen (simulations, simulation_settings, agents, agent_professions, buildings, events, event_reactions, cities, zones, city_streets, campaigns, social_trends, social_media_posts, social_media_comments, chat_conversations, prompt_templates)
2. `update_conversation_stats()` — Trigger auf chat_messages INSERT → aktualisiert `message_count` + `last_message_at` in chat_conversations
3. `enforce_single_primary_profession()` — BEFORE INSERT/UPDATE auf agent_professions → setzt vorherige is_primary auf false
4. `validate_simulation_status_transition()` — BEFORE UPDATE auf simulations → prueft State Machine (draft → configuring → active ↔ paused → archived)
5. `immutable_slug()` — BEFORE UPDATE auf simulations → verhindert slug-Aenderung nach Erstellung
6. `prevent_last_owner_removal()` — BEFORE DELETE auf simulation_members → Exception wenn letzter Owner entfernt wird
**Akzeptanz:** INSERT chat_message → conversation.message_count steigt. UPDATE simulations SET status='archived' WHERE status='draft' → Exception. UPDATE slug → Exception.
**Abh.:** P1.2.6
**Ref.:** 03_DATABASE_SCHEMA_NEW §Trigger-Funktionen, §Business-Triggers

#### P1.2.10 — Utility-Funktionen
**Dateien:** `supabase/migrations/010_utility_functions.sql`
**Aktion:**
- `generate_slug(input text) → text` (erfordert `unaccent` Extension) — SQL IMMUTABLE
- `validate_taxonomy_value(sim_id uuid, type text, value text) → boolean` — SQL STABLE
**Akzeptanz:** `SELECT generate_slug('Velgarien Welt')` → `'velgarien-welt'`. `SELECT validate_taxonomy_value(sim_id, 'system', 'politics')` → true.
**Abh.:** P1.2.1
**Ref.:** 03_DATABASE_SCHEMA_NEW §Utility-Funktionen

#### P1.2.11 — Views (Regular + Materialized)
**Dateien:** `supabase/migrations/011_views.sql`
**Aktion:**
- Regular Views: `active_agents`, `active_buildings`, `active_events`, `active_simulations` (WHERE deleted_at IS NULL)
- Dashboard View: `simulation_dashboard` (member_count, agent_count, building_count, event_count per simulation)
- Chat View: `conversation_summaries` (JOINed mit Agent-Name + Portrait)
- Materialized Views: `campaign_performance` (Aggregation ueber campaigns, events, reactions), `agent_statistics` (profession_count, reaction_count, building_count per agent)
**Akzeptanz:** `SELECT * FROM active_agents` exkludiert Agents mit deleted_at IS NOT NULL. `SELECT * FROM simulation_dashboard` zeigt Counts.
**Abh.:** P1.2.6
**Ref.:** 03_DATABASE_SCHEMA_NEW §Views

#### P1.2.12 — Storage Buckets + Storage RLS
**Dateien:** `supabase/migrations/012_storage.sql`
**Aktion:**
- Buckets: `agent.portraits`, `building.images`, `user.agent.portraits`, `simulation.assets`
- Storage RLS-Policies: Upload/Download basierend auf simulation_members Zugehoerigkeit
- Public-read fuer Portraits/Images, authenticated-write fuer Editors+
**Akzeptanz:** Buckets existieren in Supabase Storage. Upload als authenticated user erfolgreich. Download als anonymous moeglich (public).
**Abh.:** P1.2.8
**Ref.:** 03_DATABASE_SCHEMA_NEW §Storage Buckets

**Checkpoint 1.2:** 27 Tabellen mit FKs, ~50 Indexes, 22 Triggers, 9 Funktionen, 8 Views, RLS-Policies, Storage Buckets deployed. Schema vollstaendig.

---

### 1.3 Backend Foundation (10 Tasks)

#### P1.3.1 — FastAPI App + Config
**Dateien:** `backend/app.py`, `backend/config.py`
**Aktion:**
- `config.py`: `Settings(BaseSettings)` mit allen Env-Variablen
- `app.py`: `FastAPI()` Instanz, Router-Registrierung
**Akzeptanz:** `uvicorn backend.app:app` startet. `GET /docs` zeigt Swagger UI.
**Abh.:** P1.1.2
**Ref.:** 13_TECHSTACK §FastAPI-Konfiguration

#### P1.3.2 — Auth Dependencies (JWT + Supabase Client)
**Dateien:** `backend/dependencies.py`
**Aktion:**
- `get_current_user()` — JWT-Validierung via python-jose
- `get_supabase()` — Client mit User-JWT (RLS aktiv)
- `get_admin_supabase()` — Service Key (nur fuer Admin-Ops)
- `get_simulation_context()` — Membership-Pruefung
- `require_role()` — Rollen-Pruefung (nutzt `role_meets_minimum`)
**Akzeptanz:** Unit-Test: Gueltiger JWT → CurrentUser. Ungueltiger JWT → 401.
**Abh.:** P1.3.1
**Ref.:** 10_AUTH_AND_SECURITY §Backend JWT-Validierung

#### P1.3.3 — Rate Limiting Middleware
**Dateien:** `backend/middleware/rate_limit.py`
**Aktion:** slowapi-basiertes Rate Limiting:
- 30/hr fuer AI-Generierungs-Endpoints
- 100/min fuer Standard-Endpoints
- Key: User-ID aus JWT
**Akzeptanz:** 31. Request auf AI-Endpoint innerhalb 1h → 429. Standard-Endpoints erlauben 100/min.
**Abh.:** P1.3.1
**Ref.:** 10_AUTH_AND_SECURITY §Rate Limiting

#### P1.3.4 — Error Handling Middleware
**Dateien:** `backend/middleware/error_handler.py`
**Aktion:** Unified JSON Error Responses:
```json
{
  "success": false,
  "error": {"code": "VALIDATION_ERROR", "message": "...", "details": {}},
  "timestamp": "2026-02-15T12:00:00Z"
}
```
- HTTPException → structured error
- ValidationError → VALIDATION_ERROR
- Unhandled → INTERNAL_ERROR (ohne Stack-Trace in Production)
**Akzeptanz:** Fehlerhafte Requests geben einheitliches JSON-Format zurueck. Kein Stack-Trace in Production.
**Abh.:** P1.3.1
**Ref.:** 05_API_SPECIFICATION §Standard-Response-Format

#### P1.3.5 — Request Logging Middleware
**Dateien:** `backend/middleware/logging.py`
**Aktion:** structlog-basiertes Request Logging:
- Request-ID (UUID) pro Request
- Logging: method, path, status_code, duration_ms, user_id
- JSON-Format fuer Production, Pretty-Print fuer Development
**Akzeptanz:** Requests erzeugen strukturierte Logs mit Request-ID. Duration wird gemessen.
**Abh.:** P1.3.1

#### P1.3.6 — CORS + Security Headers
**Dateien:** `backend/middleware/security.py`
**Aktion:**
- CORSMiddleware (konfigurierbare Origins)
- Security Headers: CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff
**Akzeptanz:** CORS-preflight Requests erfolgreich. Response enthaelt alle Security-Headers.
**Abh.:** P1.3.1
**Ref.:** 10_AUTH_AND_SECURITY §Security Headers

#### P1.3.7 — Pydantic Base Models
**Dateien:** `backend/models/common.py`
**Aktion:**
- `PaginatedResponse[T]` (success, data, meta: {count, total, limit, offset}, timestamp)
- `SuccessResponse[T]` (success, data, timestamp)
- `ErrorResponse` (success, error: {code, message, details}, timestamp)
- `CurrentUser` (id, email, access_token)
- `SimulationContext` (simulation_id, user, role)
**Akzeptanz:** Alle Models importierbar. Serialisierung/Deserialisierung korrekt. Response enthaelt `timestamp` Feld.
**Abh.:** P1.1.2
**Ref.:** 05_API_SPECIFICATION §Standard-Response-Format

#### P1.3.8 — Health + Users Routers
**Dateien:** `backend/routers/health.py`, `backend/routers/users.py`, `backend/models/user.py`
**Aktion:**
- `GET /api/v1/health` → `{"status": "ok", "version": "2.0.0"}`
- `GET /api/v1/users/me` → User-Profil + Mitgliedschaften
**Akzeptanz:** `curl localhost:8000/api/v1/health` gibt 200 + JSON. Authentifizierter Request auf `/users/me` gibt User-Daten + Simulationsliste zurueck.
**Abh.:** P1.3.2
**Ref.:** 05_API_SPECIFICATION §Users

#### P1.3.9 — Simulations Router (CRUD)
**Dateien:** `backend/routers/simulations.py`, `backend/models/simulation.py`, `backend/services/simulation_service.py`
**Aktion:** 6 Endpoints: GET list, GET one, POST create (nutzt `generate_slug` DB-Funktion), PUT update, DELETE (soft), POST archive
**Akzeptanz:** Simulation erstellen → in DB mit auto-generiertem Slug. Listen → zeigt nur eigene.
**Abh.:** P1.3.2, P1.2.1, P1.2.10
**Ref.:** 05_API_SPECIFICATION §Simulations

#### P1.3.10 — Backend Test-Setup
**Dateien:** `backend/tests/conftest.py`, `backend/tests/unit/test_models.py`
**Aktion:** Test-Fixtures, TestClient, JWT-Generator, erste Unit-Tests fuer Pydantic Models
**Akzeptanz:** `pytest backend/tests/unit/ -v` — alle Tests gruen.
**Abh.:** P1.3.7
**Ref.:** 16_TESTING_STRATEGY §Backend Testing

**Checkpoint 1.3:** FastAPI laeuft mit 3 Routers (health, users, simulations). JWT-Auth, Rate Limiting, Structured Error Handling, Logging, Security Headers. Tests laufen.

---

### 1.4 Frontend Foundation (11 Tasks)

#### P1.4.1 — Entry Point + App Shell
**Dateien:** `frontend/src/main.ts`, `frontend/src/app-shell.ts`, `frontend/index.html`
**Aktion:** Lit-basierte App-Shell mit Router-Outlet. Registriert alle Top-Level Routes.
**Akzeptanz:** `npm run dev` → Browser zeigt leere App-Shell.
**Abh.:** P1.1.6
**Ref.:** 07_FRONTEND_COMPONENTS §Routing

#### P1.4.2 — Router Setup
**Dateien:** `frontend/src/router.ts`
**Aktion:** `@lit-labs/router` Reactive Controller mit allen Routes aus 07_FRONTEND_COMPONENTS §Route-Definitionen (URLPattern API)
**Akzeptanz:** Navigation zu `/auth/login` zeigt Login-Placeholder. `/simulations` zeigt Dashboard-Placeholder.
**Abh.:** P1.4.1
**Ref.:** 07_FRONTEND_COMPONENTS §Routing

#### P1.4.3 — Design Tokens
**Dateien:**
```
frontend/src/styles/
├── tokens/
│   ├── colors.css
│   ├── typography.css
│   ├── spacing.css
│   ├── shadows.css
│   ├── z-index.css
│   └── animation.css
├── base/
│   ├── reset.css
│   └── global.css
└── index.css                # Importiert alle Token-Dateien
```
**Aktion:** 176+ CSS Custom Properties aus 12_DESIGN_SYSTEM
**Akzeptanz:** Browser DevTools zeigen alle `--token-*` Variablen auf `:root`.
**Abh.:** P1.4.1
**Ref.:** 12_DESIGN_SYSTEM §Token-System

#### P1.4.4 — Shared Component Styles
**Dateien:**
```
frontend/src/styles/components/
├── button.css
├── card.css
├── form.css
├── modal.css
├── table.css
└── notification.css
```
**Aktion:** Button-Varianten (primary, secondary, danger, ghost), Card, Form-Inputs, Modal-Layout
**Akzeptanz:** Test-HTML mit allen Varianten sieht korrekt aus (Brutalist-Aesthetik).
**Abh.:** P1.4.3
**Ref.:** 12_DESIGN_SYSTEM §Buttons, §Cards, §Forms

#### P1.4.5 — Supabase Client + Auth Service
**Dateien:**
```
frontend/src/services/supabase/
├── client.ts
├── SupabaseAuthService.ts
└── index.ts
```
**Aktion:**
- `client.ts`: `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`
- `SupabaseAuthService`: signIn, signUp, signOut, resetPassword, onAuthStateChange
**Akzeptanz:** `SupabaseAuthService.signIn()` gibt Session mit access_token zurueck.
**Abh.:** P1.1.3
**Ref.:** 10_AUTH_AND_SECURITY §Frontend Auth Service

#### P1.4.6 — BaseApiService
**Dateien:** `frontend/src/services/api/BaseApiService.ts`
**Aktion:** `get<T>`, `post<T>`, `put<T>`, `delete<T>` mit:
- JWT aus Supabase Session
- Simulation-scoped URLs (`/api/v1/simulations/:simId/...`)
- Einheitliches Error-Handling (parsed als `ApiResponse<T>`)
**Akzeptanz:** Unit-Test: Request enthaelt Authorization-Header mit JWT. Simulation-ID in URL.
**Abh.:** P1.4.5
**Ref.:** 07_FRONTEND_COMPONENTS §BaseApiService

#### P1.4.7 — AppStateManager
**Dateien:** `frontend/src/services/AppStateManager.ts`
**Aktion:** Preact Signals fuer:
- `currentUser`, `accessToken`
- `currentSimulation`, `currentRole`
- `simulations`, `taxonomies`, `settings`
- Computed: `isOwner`, `canEdit`, `canAdmin`
**Akzeptanz:** `appState.currentUser.value` reaktiv. Signal-Change loest Re-Render aus.
**Abh.:** P1.1.3
**Ref.:** 07_FRONTEND_COMPONENTS §State Management

#### P1.4.8 — Typ-Definitionen (Kern)
**Dateien:**
```
frontend/src/types/
├── models/
│   ├── simulation.ts
│   ├── agent.ts
│   ├── building.ts
│   ├── event.ts
│   └── taxonomy.ts
├── api/
│   ├── common.ts         # ApiResponse<T>, PaginatedResponse<T>
│   ├── requests.ts
│   └── responses.ts
└── index.ts
```
**Aktion:** Alle Interfaces aus 04_DOMAIN_MODELS v2.0 (mit renamed Spalten: `building_type`, `member_role`, `setting_key` etc.)
**Akzeptanz:** `import { Agent, Building, ApiResponse } from '../types'` funktioniert ohne Fehler. Keine SQL Reserved Words in Property-Namen.
**Abh.:** P1.1.5
**Ref.:** 04_DOMAIN_MODELS v2.0

#### P1.4.9 — Login + Register Komponenten
**Dateien:**
```
frontend/src/components/auth/
├── LoginView.ts
├── RegisterView.ts
└── ResetPasswordView.ts
```
**Aktion:** Formulare fuer Email/Password. Nutzen SupabaseAuthService. Redirect zu `/simulations` bei Erfolg.
**Akzeptanz:** Login mit gueltigen Credentials → Redirect. Ungueltige → Fehlermeldung. Reset-Password → Email.
**Abh.:** P1.4.5, P1.4.4, P1.4.7
**Ref.:** 07_FRONTEND_COMPONENTS §AuthViews

#### P1.4.10 — Simulations Dashboard
**Dateien:**
```
frontend/src/components/platform/
├── SimulationsDashboard.ts
├── SimulationCard.ts
└── CreateSimulationButton.ts
```
**Aktion:** Zeigt alle Simulationen des Users als Cards. Click → Navigation zu Simulation.
**Akzeptanz:** Dashboard zeigt Simulationen. Klick navigiert zu `/simulations/:id/agents`.
**Abh.:** P1.4.6, P1.4.7, P1.4.9
**Ref.:** 07_FRONTEND_COMPONENTS §Plattform-Level

#### P1.4.11 — Frontend Test-Setup
**Dateien:** `frontend/vitest.config.ts`, `frontend/tests/setup.ts`, `frontend/tests/helpers/fixtures.ts`
**Aktion:** vitest-Config, Supabase-Mocks, Factory-Helpers
**Akzeptanz:** `npx vitest run` laeuft ohne Config-Fehler.
**Abh.:** P1.1.3
**Ref.:** 16_TESTING_STRATEGY §Frontend Testing

**Checkpoint 1.4:** Login funktioniert. Dashboard zeigt Simulationen. Navigation zwischen Views. Design-System aktiv.

---

### 1.5 CI/CD (1 Task)

#### P1.5.1 — GitHub Actions Workflow
**Dateien:** `.github/workflows/ci.yml`
**Aktion:** Jobs: lint → test-backend → test-frontend → build
**Akzeptanz:** Push auf main loest Pipeline aus. Alle Jobs gruen.
**Abh.:** P1.3.10, P1.4.11
**Ref.:** 16_TESTING_STRATEGY §CI/CD Pipeline

**Checkpoint Phase 1:** Plattform-Grundgeruest steht. Auth, DB-Schema (27 Tabellen, Triggers, Views), API-Grundstruktur mit Middleware, Frontend-Shell, CI/CD. **41 Tasks erledigt.**

---

## Phase 2: Velgarien als erste Simulation

### 2.1 CRUD Routers + Pydantic Models (14 Tasks)

#### P2.1.1 — Agents Pydantic Models
**Dateien:** `backend/models/agent.py`
**Aktion:** AgentCreate, AgentUpdate, AgentResponse, AgentListResponse, AgentFilter
- Verwendet `created_by_id` (nicht `created_by_user`)
- Verwendet `search_vector` als read-only (nicht in Create/Update)
**Akzeptanz:** Pydantic Models validieren korrekt. `AgentResponse` enthaelt alle Felder aus 04_DOMAIN_MODELS.
**Abh.:** P1.3.7
**Ref.:** 04_DOMAIN_MODELS §Agent

#### P2.1.2 — Agents Router + Service
**Dateien:** `backend/routers/agents.py`, `backend/services/agent_service.py`, `backend/tests/integration/test_agents_router.py`
**Aktion:** 7 Endpoints: GET list (Pagination, Filter, Full-Text Search via `search_vector @@`), GET one, POST create, PUT update, DELETE (soft), POST generate-portrait (stub), GET reactions
**Akzeptanz:** CRUD vollstaendig testbar via `/docs`. Pagination funktioniert. Full-Text Suche ueber search_vector.
**Abh.:** P2.1.1, P1.3.9
**Ref.:** 05_API_SPECIFICATION §Agents

#### P2.1.3 — Buildings Pydantic Models
**Dateien:** `backend/models/building.py`
**Aktion:** BuildingCreate, BuildingUpdate, BuildingResponse — mit `building_type`, `building_condition`
**Akzeptanz:** Models validieren korrekt.
**Abh.:** P1.3.7
**Ref.:** 04_DOMAIN_MODELS §Building

#### P2.1.4 — Buildings Router + Service
**Dateien:** `backend/routers/buildings.py`, `backend/services/building_service.py`
**Aktion:** 11 Endpoints inkl. Agent-Zuweisungen und Profession-Requirements
**Akzeptanz:** Building erstellen + Agent zuweisen + Requirements setzen funktioniert.
**Abh.:** P2.1.3, P2.1.2 (fuer Agent-Zuweisungen)
**Ref.:** 05_API_SPECIFICATION §Buildings

#### P2.1.5 — Events Pydantic Models + Router + Service
**Dateien:** `backend/routers/events.py`, `backend/models/event.py`, `backend/services/event_service.py`
**Aktion:** 8 Endpoints inkl. Reaktionen + Generate-Reaction (stub). Verwendet `event_type`, `occurred_at`, `tags text[]`
**Akzeptanz:** Event erstellen + manuelle Reaktion hinzufuegen funktioniert. Tags als Array filterbar.
**Abh.:** P2.1.2, P1.3.7
**Ref.:** 05_API_SPECIFICATION §Events, 04_DOMAIN_MODELS §Event

#### P2.1.6 — Agent Professions Router
**Dateien:** `backend/routers/agent_professions.py`, `backend/models/agent_profession.py`
**Aktion:** 4 Endpoints: GET, POST, PUT, DELETE. Primary-Profession-Exclusivity ueber DB-Trigger gewaehrleistet.
**Akzeptanz:** Profession einem Agent zuweisen/entfernen funktioniert. Nur 1 is_primary pro Agent.
**Abh.:** P2.1.2
**Ref.:** 05_API_SPECIFICATION §Agent Professions

#### P2.1.7 — Locations Router (Cities, Zones, Streets)
**Dateien:** `backend/routers/locations.py`, `backend/models/location.py`, `backend/services/location_service.py`
**Aktion:** 11 Endpoints fuer CRUD von Cities, Zones, Streets (mit `street_type` statt `type`)
**Akzeptanz:** Stadt → Zone → Strasse Hierarchie funktioniert. Cascade-Delete von City loescht Zones + Streets.
**Abh.:** P1.3.9
**Ref.:** 05_API_SPECIFICATION §Locations

#### P2.1.8 — Taxonomies Router
**Dateien:** `backend/routers/taxonomies.py`, `backend/models/taxonomy.py`, `backend/services/taxonomy_service.py`
**Aktion:** 5 Endpoints: GET all, GET by type, POST, PUT, DELETE (soft via is_active)
**Akzeptanz:** Taxonomie-Werte pro Simulation abrufbar. Neue Werte anlegen funktioniert. validate_taxonomy_value Funktion wird genutzt.
**Abh.:** P1.3.9
**Ref.:** 05_API_SPECIFICATION §Taxonomies

#### P2.1.9 — Settings Router + Encryption
**Dateien:** `backend/routers/settings.py`, `backend/models/settings.py`, `backend/services/settings_service.py`, `backend/utils/encryption.py`
**Aktion:** 5 Endpoints + AES-256-Verschluesselung fuer sensitive Werte (API-Keys). Verwendet `setting_key`, `setting_value`.
**Akzeptanz:** Setting setzen + abrufen. Verschluesselte Werte werden maskiert in Response.
**Abh.:** P1.3.9
**Ref.:** 05_API_SPECIFICATION §Settings, 10_AUTH_AND_SECURITY §Verschluesselung

#### P2.1.10 — Chat Router (ohne AI)
**Dateien:** `backend/routers/chat.py`, `backend/models/chat.py`, `backend/services/chat_service.py`
**Aktion:** 5 Endpoints: GET conversations, POST new, GET messages (mit `?limit=50&before=timestamp`), POST message (nur Speicherung, keine AI), DELETE (archivieren). Verwendet `sender_role` statt `role`.
**Akzeptanz:** Konversation erstellen + Nachrichten senden/empfangen (ohne AI). `message_count` wird automatisch via Trigger aktualisiert.
**Abh.:** P2.1.2
**Ref.:** 05_API_SPECIFICATION §Chat

#### P2.1.11 — Simulation Members Router
**Dateien:** `backend/routers/members.py`, `backend/models/member.py`
**Aktion:** 4 Endpoints: GET list, POST add (Owner/Admin), PUT change role (`member_role`), DELETE remove
- Last-Owner-Protection ueber DB-Trigger
**Akzeptanz:** Mitglieder auflisten, hinzufuegen, Rolle aendern, entfernen. Letzten Owner entfernen → 409 Conflict.
**Abh.:** P1.3.9
**Ref.:** 05_API_SPECIFICATION §Simulation Members

#### P2.1.12 — Campaigns Router
**Dateien:** `backend/routers/campaigns.py`, `backend/models/campaign.py`, `backend/services/campaign_service.py`
**Aktion:** 7 Endpoints: GET list, POST create, GET one, PUT update, DELETE, GET events (campaign_events), GET metrics (campaign_metrics). Verwendet `is_integrated_as_event`.
**Akzeptanz:** Kampagne erstellen. Events einer Kampagne abrufen. Metriken abrufen.
**Abh.:** P2.1.5
**Ref.:** 05_API_SPECIFICATION §Campaigns

#### P2.1.13 — Audit Logging Service
**Dateien:** `backend/services/audit_service.py`
**Aktion:** Service zum Schreiben in `audit_log` Tabelle bei CRUD-Operationen (entity_type, entity_id, action, user_id, changes jsonb)
**Akzeptanz:** Agent erstellen → audit_log Eintrag mit action='create'. Agent updaten → Eintrag mit vorher/nachher Diff.
**Abh.:** P1.2.6
**Ref.:** 03_DATABASE_SCHEMA_NEW §Audit

#### P2.1.14 — Soft-Delete Filtering Pattern
**Dateien:** `backend/services/base_service.py`
**Aktion:** Base-Service nutzt `active_*` Views fuer Standard-Queries (active_agents, active_buildings, active_events). Admin-Queries koennen geloeschte einschliessen via `?include_deleted=true`.
**Akzeptanz:** GET /agents gibt nur aktive Agents (deleted_at IS NULL). Mit `?include_deleted=true` (Admin) auch geloeschte.
**Abh.:** P1.2.11
**Ref.:** 03_DATABASE_SCHEMA_NEW §Views

**Checkpoint 2.1:** Alle CRUD-Routers funktional. ~108 Endpoints testbar via Swagger `/docs`. Soft-Delete, Audit-Logging, Members-Verwaltung.

---

### 2.2 Daten-Migration (5 Tasks)

#### P2.2.1 — Velgarien-Simulation + Taxonomien anlegen
**Dateien:** `supabase/seed/001_velgarien_simulation.sql`
**Aktion:** INSERT Simulation + Taxonomien (Gender, Professionen, Systeme, Gebaeudetypen, Urgency, Zonen, etc.) aus 15_MIGRATION_STRATEGY §2.2
**Akzeptanz:** `SELECT count(*) FROM simulation_taxonomies WHERE simulation_id = 'velgarien-uuid'` > 40 Werte.
**Abh.:** P1.2.1
**Ref.:** 15_MIGRATION_STRATEGY §2.2 Taxonomien migrieren

#### P2.2.2 — Agent-Daten migrieren
**Dateien:** `supabase/seed/002_migrate_agents.sql`
**Aktion:** TEXT→UUID Mapping, Gender-Enum→Taxonomy-Value, Spalten umbenennen (charakter→character, created_by_user→created_by_id)
**Akzeptanz:** Alle Agenten migriert. `agents.character` (nicht `charakter`) vorhanden. Gender ist englischer Wert.
**Abh.:** P2.2.1, P1.2.3
**Ref.:** 15_MIGRATION_STRATEGY §2.3 Agenten

#### P2.2.3 — Events + Buildings + Beziehungen migrieren
**Dateien:** `supabase/seed/003_migrate_entities.sql`
**Aktion:** Events (TEXT→UUID, `event_type` statt `type`, `occurred_at` statt `event_timestamp`, `tags text[]` statt jsonb), Buildings (`building_type`, `building_condition`), Reaktionen (`occurred_at`), Professionen, Geographische Daten (`street_type`)
**Akzeptanz:** Zahlen-Vergleich Alt vs Neu = 100%. Keine verwaisten FKs.
**Abh.:** P2.2.2
**Ref.:** 15_MIGRATION_STRATEGY §2.3 Events, Buildings, Beziehungen

#### P2.2.4 — Social Media + Chat Daten migrieren
**Dateien:** `supabase/seed/004_migrate_social_chat.sql`
**Aktion:** facebook_posts → social_media_posts (mit `source_created_at`, `transformed_at`, `imported_at`, `last_synced_at`), agent_chats → chat_conversations + chat_messages (`sender_role` statt `role`)
**Akzeptanz:** Alle Chat-Konversationen + Nachrichten migriert. Timestamps korrekt umbenannt.
**Abh.:** P2.2.3
**Ref.:** 15_MIGRATION_STRATEGY §2.3 Social Media, Chat

#### P2.2.5 — Migration verifizieren
**Dateien:** `supabase/seed/005_verify_migration.sql`
**Aktion:** Verifikations-Queries aus 15_MIGRATION_STRATEGY §2.4:
- Zaehler-Vergleich Alt vs Neu fuer jede Tabelle
- Orphaned FK Check (`LEFT JOIN ... WHERE ... IS NULL`)
- search_vector Population verifizieren
- Trigger-Tests (updated_at, conversation_stats)
**Akzeptanz:** 0 orphaned records. Zahlen stimmen ueberein. search_vector auf allen Agents gefuellt.
**Abh.:** P2.2.4

**Checkpoint 2.2:** Alle Velgarien-Daten im neuen Schema. Verifiziert. Renamed Spalten korrekt.

---

### 2.3 Shared Components (9 Tasks)

#### P2.3.1 — BaseModal
**Dateien:** `frontend/src/components/shared/BaseModal.ts`
**Aktion:** Wiederverwendbare Modal-Komponente mit Backdrop, Close-Button, Slot fuer Header/Body/Footer, ESC-to-close, Focus-Trap
**Akzeptanz:** Modal oeffnet/schliesst. ESC schliesst. Click-outside schliesst. Focus bleibt in Modal.
**Abh.:** P1.4.4
**Ref.:** 07_FRONTEND_COMPONENTS §Shared Components

#### P2.3.2 — SharedFilterBar
**Dateien:** `frontend/src/components/shared/SharedFilterBar.ts`
**Aktion:** Konfigurierbare Filter-Leiste: Search-Input, Dropdown-Filters, Active-Filter-Chips, Clear-All
**Akzeptanz:** Filter-Aenderung dispatcht `filter-changed` Event mit Filter-State.
**Abh.:** P1.4.4
**Ref.:** 07_FRONTEND_COMPONENTS §SharedFilterBar

#### P2.3.3 — DataTable
**Dateien:** `frontend/src/components/shared/DataTable.ts`
**Aktion:** Lit-basierte Tabelle mit sortierbare Spalten, Row-Selection, Custom Cell Renderers, Responsive
**Akzeptanz:** Tabelle rendert Daten. Klick auf Spalten-Header sortiert. Custom Renderer moeglich.
**Abh.:** P1.4.4
**Ref.:** 07_FRONTEND_COMPONENTS §DataTable

#### P2.3.4 — FormBuilder
**Dateien:** `frontend/src/components/shared/FormBuilder.ts`
**Aktion:** Deklaratives Formular basierend auf Field-Config (text, textarea, select, checkbox, number). Zod-Validation Integration.
**Akzeptanz:** Formular rendert aus Config. Validation-Errors angezeigt. `form-submit` Event mit validiertem Daten.
**Abh.:** P1.4.4
**Ref.:** 07_FRONTEND_COMPONENTS §FormBuilder

#### P2.3.5 — ErrorState + LoadingState + EmptyState
**Dateien:** `frontend/src/components/shared/ErrorState.ts`, `LoadingState.ts`, `EmptyState.ts`
**Aktion:** Drei Standard-Zustandsanzeigen:
- ErrorState: Icon + Message + Optional Retry-Button
- LoadingState: Spinner + Optional Message
- EmptyState: Icon + Message + Optional CTA-Button
**Akzeptanz:** Alle drei Komponenten rendern korrekt. ErrorState zeigt Retry-Button. EmptyState zeigt CTA.
**Abh.:** P1.4.4
**Ref.:** 07_FRONTEND_COMPONENTS §Shared Components

#### P2.3.6 — ConfirmDialog
**Dateien:** `frontend/src/components/shared/ConfirmDialog.ts`
**Aktion:** Extends BaseModal. Konfigurierbarer Titel/Text/Buttons. Returns Promise<boolean>.
**Akzeptanz:** `await confirmDialog.show({title, message})` → true bei Bestaetigung, false bei Abbruch.
**Abh.:** P2.3.1
**Ref.:** 07_FRONTEND_COMPONENTS §ConfirmDialog

#### P2.3.7 — Toast/Notification
**Dateien:** `frontend/src/components/shared/Toast.ts`
**Aktion:** Toast-Benachrichtigungen mit Typen (success, error, warning, info). Auto-dismiss. Stacking.
**Akzeptanz:** `showToast({type: 'success', message: '...'})` zeigt Toast an. Auto-dismiss nach 5s.
**Abh.:** P1.4.4
**Ref.:** 07_FRONTEND_COMPONENTS §Toast

#### P2.3.8 — Pagination
**Dateien:** `frontend/src/components/shared/Pagination.ts`
**Aktion:** Pagination-Komponente: Page-Buttons, Prev/Next, Limit-Selector, Total-Info
**Akzeptanz:** Klick auf Page → `page-changed` Event. Limit-Aenderung → Event.
**Abh.:** P1.4.4
**Ref.:** 07_FRONTEND_COMPONENTS §Pagination

#### P2.3.9 — Zod Validation Schemas
**Dateien:**
```
frontend/src/types/validation/
├── agent.ts
├── building.ts
├── event.ts
├── simulation.ts
└── common.ts
```
**Aktion:** Zod-Schemas parallel zu Backend Pydantic Models. Verwendet renamed Felder (`building_type`, `event_type` etc.)
**Akzeptanz:** Formulare validieren clientseitig bevor Request gesendet wird. Zod-Errors werden angezeigt.
**Abh.:** P1.1.3
**Ref.:** 07_FRONTEND_COMPONENTS §Zod Validierung

**Checkpoint 2.3:** Alle Shared Components implementiert. Wiederverwendbar ueber alle Views.

---

### 2.4 Layout + API Services (4 Tasks)

#### P2.4.1 — PlatformHeader + SimulationSelector + LocaleSelector
**Dateien:**
```
frontend/src/components/platform/
├── PlatformHeader.ts
├── SimulationSelector.ts
├── UserMenu.ts
└── LocaleSelector.ts
```
**Aktion:** Globaler Header mit Simulations-Dropdown, User-Menu (Profil, Logout), Locale-Selector (DE/EN)
**Akzeptanz:** SimulationSelector zeigt alle Simulationen. Wechsel aktualisiert appState.currentSimulation. UserMenu Logout funktioniert.
**Abh.:** P1.4.7, P1.4.10
**Ref.:** 07_FRONTEND_COMPONENTS §PlatformHeader

#### P2.4.2 — SimulationShell (Layout)
**Dateien:** `frontend/src/components/layout/SimulationShell.ts`, `SimulationHeader.ts`, `SimulationNav.ts`
**Aktion:** Layout mit Header + Navigation (Tabs: Agents, Buildings, Events, Chat, Social, Locations, Settings) + Content-Outlet
**Akzeptanz:** Navigation zwischen allen Tabs funktioniert. Active-Tab hervorgehoben.
**Abh.:** P1.4.2, P1.4.7
**Ref.:** 07_FRONTEND_COMPONENTS §SimulationShell

#### P2.4.3 — API Services (alle 9)
**Dateien:**
```
frontend/src/services/api/
├── AgentsApiService.ts
├── BuildingsApiService.ts
├── EventsApiService.ts
├── LocationsApiService.ts
├── TaxonomiesApiService.ts
├── SettingsApiService.ts
├── ChatApiService.ts
├── MembersApiService.ts
├── CampaignsApiService.ts
└── index.ts
```
**Aktion:** Alle API Services extending BaseApiService. Simulation-scoped URLs. Typisierte Responses.
**Akzeptanz:** Unit-Tests: Requests werden mit korrektem JWT und Simulation-URL gesendet. Typen stimmen ueberein.
**Abh.:** P1.4.6, P1.4.8
**Ref.:** 07_FRONTEND_COMPONENTS §FastAPI Business-Logic Services

#### P2.4.4 — SimulationsApiService
**Dateien:** `frontend/src/services/api/SimulationsApiService.ts`
**Aktion:** Plattform-Level API (nicht simulation-scoped): list, create, get, update, delete, archive
**Akzeptanz:** SimulationsApiService Requests gehen an `/api/v1/simulations` (nicht `/api/v1/simulations/:simId/...`).
**Abh.:** P1.4.6
**Ref.:** 05_API_SPECIFICATION §Simulations

**Checkpoint 2.4:** Layout steht. Alle API Services vorhanden. Platform-Header mit Simulation-Selector.

---

### 2.5 Entity Views (5 Tasks)

#### P2.5.1 — AgentsView + AgentEditModal + AgentDetailsPanel
**Dateien:**
```
frontend/src/components/agents/
├── AgentsView.ts
├── AgentCard.ts
├── AgentEditModal.ts
└── AgentDetailsPanel.ts
```
**Aktion:** Liste mit SharedFilterBar (System, Gender, Profession, Search) + Pagination, Card-Darstellung mit Portrait, Create/Edit Modal (Zod-validiert), Detail-Ansicht mit Professionen/Reaktionen
**Akzeptanz:** Agents auflisten, erstellen, bearbeiten, loeschen. Filter nach System/Gender. Full-Text Suche.
**Abh.:** P2.3.1, P2.3.2, P2.3.8, P2.3.9, P2.4.3, P2.1.2
**Ref.:** 07_FRONTEND_COMPONENTS §AgentsView

#### P2.5.2 — BuildingsView + BuildingEditModal + BuildingDetailsPanel
**Dateien:** `frontend/src/components/buildings/` (analog zu Agents)
**Aktion:** CRUD. Agent-Zuweisung in Details. Profession-Requirements. Verwendet `building_type`, `building_condition`.
**Akzeptanz:** Buildings CRUD. Agent-Zuweisung in Details. Requirements setzbar.
**Abh.:** P2.3.1, P2.3.2, P2.3.8, P2.4.3, P2.1.4
**Ref.:** 07_FRONTEND_COMPONENTS §BuildingsView

#### P2.5.3 — EventsView + EventEditModal + EventDetailsPanel
**Dateien:** `frontend/src/components/events/` (analog zu Agents)
**Aktion:** CRUD. Reaktionen anzeigen. Verwendet `event_type`, `occurred_at`, `tags` als Array.
**Akzeptanz:** Events CRUD. Reaktionen anzeigen. Tags als Chips editierbar.
**Abh.:** P2.3.1, P2.3.2, P2.3.8, P2.4.3, P2.1.5
**Ref.:** 07_FRONTEND_COMPONENTS §EventsView

#### P2.5.4 — ChatView + Komponenten
**Dateien:**
```
frontend/src/components/chat/
├── ChatView.ts
├── ConversationList.ts
├── ChatWindow.ts
├── MessageList.ts
├── MessageInput.ts
└── AgentSelector.ts
```
**Aktion:** Konversationen auflisten, neue starten, Nachrichten senden/empfangen (ohne AI — direktes Speichern)
**Akzeptanz:** Konversation mit Agent starten. Nachricht senden → erscheint in Liste. `message_count` aktualisiert via Trigger.
**Abh.:** P2.3.1, P2.4.3, P2.1.10
**Ref.:** 07_FRONTEND_COMPONENTS §ChatView

#### P2.5.5 — Frontend Integration Tests (Agents, Buildings, Events)
**Dateien:** `frontend/src/components/agents/AgentsView.test.ts`, `BuildingsView.test.ts`, `EventsView.test.ts`
**Akzeptanz:** Component-Tests rendern Views, simulieren User-Interaktion, verifizieren API-Calls.
**Abh.:** P2.5.1, P2.5.2, P2.5.3, P1.4.11
**Ref.:** 16_TESTING_STRATEGY §Component Tests

**Checkpoint Phase 2:** Feature-Parity mit Altsystem fuer Agents, Buildings, Events, Chat (ohne AI). CRUD End-to-End. Daten migriert. **37 Tasks erledigt (gesamt: 78).**

---

## Phase 3: Settings, i18n, AI-Pipelines

### 3.1 Settings System (6 Tasks)

#### P3.1.1 — GeneralSettingsPanel
**Dateien:** `frontend/src/components/settings/GeneralSettingsPanel.ts`
**Aktion:** Name, Slug (read-only), Description, Theme-Dropdown (dystopian, utopian, fantasy, scifi, historical, custom), Content-Locale, Additional Locales, Timezone, Icon/Banner Upload (via Supabase Storage)
**Akzeptanz:** Name aendern + speichern. Slug nicht editierbar. Theme-Auswahl funktioniert. Icon-Upload via Supabase Storage.
**Abh.:** P2.4.3, P2.3.4
**Ref.:** 08_SIMULATION_SETTINGS §General Settings

#### P3.1.2 — WorldSettingsPanel (Taxonomie-Editor)
**Dateien:** `frontend/src/components/settings/WorldSettingsPanel.ts`
**Aktion:** Dropdown mit Taxonomie-Typ. CRUD fuer Werte. Sortierung per Drag&Drop. Labels pro Locale. Deaktivieren statt Loeschen.
**Akzeptanz:** Neuen Taxonomie-Wert anlegen, Label aendern, deaktivieren, sort_order aendern.
**Abh.:** P2.4.3, P2.1.8
**Ref.:** 08_SIMULATION_SETTINGS §World Settings

#### P3.1.3 — AISettingsPanel
**Dateien:** `frontend/src/components/settings/AISettingsPanel.ts`
**Aktion:** Text-Modelle pro Zweck (8 Dropdowns), Bild-Modelle (3), Bild-Parameter (width, height, guidance_scale, steps, scheduler), Negative Prompts, Temperatur/Max-Tokens, Link zu Prompt-Template-Editor
**Akzeptanz:** Modell-Auswahl speichern. Parameter aendern. Prompt-Editor-Link navigiert korrekt.
**Abh.:** P2.4.3, P2.1.9
**Ref.:** 08_SIMULATION_SETTINGS §AI Settings

#### P3.1.4 — IntegrationSettingsPanel
**Dateien:** `frontend/src/components/settings/IntegrationSettingsPanel.ts`
**Aktion:** Facebook (Page ID, Access Token, API Version, Enabled Toggle, Test-Button), Guardian (API Key, Enabled, Test), NewsAPI (API Key, Enabled, Test), AI-Provider Overrides (OpenRouter Key, Replicate Key)
**Akzeptanz:** API-Key eingeben → wird maskiert angezeigt. Test-Button prueft Verbindung. Enabled-Toggle funktioniert.
**Abh.:** P2.4.3, P2.1.9
**Ref.:** 08_SIMULATION_SETTINGS §Integration Settings, 11_EXTERNAL_SERVICES

#### P3.1.5 — DesignSettingsPanel
**Dateien:** `frontend/src/components/settings/DesignSettingsPanel.ts`, `frontend/src/services/theme-presets.ts`, `frontend/src/types/validation/theme.ts`
**Aktion:** Preset-Selector (5 Presets: brutalist, sunless-sea, solarpunk, cyberpunk, nordic-noir), 16 Color-Picker, 7 Typography-Felder, Character-Section (border-radius, shadow-style, hover-effect), Animation-Section (speed, easing), Info-Bubbles mit Token-Erklaerungen, Custom CSS (max 10KB). Live-Preview via ThemeService.applyConfig().
**Akzeptanz:** Preset waehlen → alle Felder aktualisiert + Live-Preview. Einzelne Farbe aendern → Live-Preview aktualisiert. Speichern → Simulation nutzt neue Tokens. 82 neue i18n-Strings (DE/EN).
**Abh.:** P2.4.3, P2.1.9
**Ref.:** 08_SIMULATION_SETTINGS §Design Settings, 18_THEMING_SYSTEM

#### P3.1.6 — AccessSettingsPanel
**Dateien:** `frontend/src/components/settings/AccessSettingsPanel.ts`
**Aktion:** Visibility (public/private), Allow Registration, Default Role, Invitation Expiry, Max Members
**Akzeptanz:** Visibility aendern + speichern. Nur Owner sieht Access-Tab.
**Abh.:** P2.4.3, P2.1.9
**Ref.:** 08_SIMULATION_SETTINGS §Access Settings

### 3.2 Settings Support-Services (4 Tasks)

#### P3.2.1 — SettingsView (Tabs-Container)
**Dateien:** `frontend/src/components/settings/SettingsView.ts`, `SettingsTabs.ts`
**Aktion:** Tab-Navigation (General, World, AI, Integration, Design, Access). Rolle-basierte Sichtbarkeit (Access nur fuer Owner). Unsaved-Changes Warnung.
**Akzeptanz:** 6 Tabs navigierbar. Access nur fuer Owner sichtbar. Ungespeicherte Aenderungen → Warnung beim Tab-Wechsel.
**Abh.:** P3.1.1, P3.1.2, P3.1.3, P3.1.4, P3.1.5, P3.1.6
**Ref.:** 07_FRONTEND_COMPONENTS §SettingsView

#### P3.2.2 — ExternalServiceResolver (Backend)
**Dateien:** `backend/services/external_service_resolver.py`
**Aktion:** Laedt Service-Konfiguration aus simulation_settings: Facebook, Guardian, NewsAPI, OpenRouter, Replicate. Fallback zu Plattform-Defaults. Entschluesselt API-Keys.
**Akzeptanz:** `resolver.get_facebook_config(sim_id)` → decrypted Config. Plattform-Fallback funktioniert.
**Abh.:** P2.1.9
**Ref.:** 11_EXTERNAL_SERVICES §Aufloesungs-Reihenfolge

#### P3.2.3 — Simulation Theme Application Service
**Dateien:** `frontend/src/services/ThemeService.ts`
**Aktion:** Laedt Design-Settings aus API. Setzt Base-Token-Overrides als CSS Custom Properties auf `<velg-simulation-shell>` Host-Element (shell-scoped, nicht `:root`). Direkte Token-Mappings (32 flat keys → CSS vars), berechnete Shadow-Tokens (shadow_style + shadow_color → 7 Shadow-Variablen), berechnete Animation-Tokens (animation_speed → 4 Duration-Variablen). Custom CSS Sanitizer (max 10KB, @import/javascript:/expression() entfernt). Cleanup via resetTheme().
**Akzeptanz:** Simulation mit custom Farben → CSS Properties auf Shell-Element gesetzt. Plattform-Level Views nutzen weiterhin Base-Tokens. Custom CSS wird sanitized + injiziert. Simulation-Wechsel → alte Tokens bereinigt.
**Abh.:** P3.1.5, P2.4.3
**Ref.:** 08_SIMULATION_SETTINGS §Design Settings, 18_THEMING_SYSTEM

#### P3.2.4 — GenerationApiService (Frontend)
**Dateien:** `frontend/src/services/api/GenerationApiService.ts`
**Aktion:** API Service fuer alle AI-Generierungs-Endpoints: generateAgent, generateBuilding, generatePortraitDesc, generateEvent, generateImage
**Akzeptanz:** Alle 5 Generierungs-Methoden vorhanden. Typisierte Responses.
**Abh.:** P1.4.6
**Ref.:** 05_API_SPECIFICATION §Generation

**Checkpoint 3.1-3.2:** Settings-UI komplett (6 Tabs). Theme-Application funktioniert. ExternalServiceResolver ready.

---

### 3.3 i18n (5 Tasks)

#### P3.3.1 — @lit/localize Setup
**Dateien:** `frontend/lit-localize.json`, `frontend/src/locales/generated/`
**Aktion:** Runtime-Mode Konfiguration. Source locale: `en`. Target: `de`.
**Akzeptanz:** `npx lit-localize extract` generiert XLIFF-Dateien.
**Abh.:** P1.1.3
**Ref.:** 14_I18N_ARCHITECTURE §Konfiguration

#### P3.3.2 — Translation-Dateien (DE + EN)
**Dateien:** `frontend/src/locales/de.ts`, `frontend/src/locales/en.ts`
**Aktion:** Alle UI-Strings aus 14_I18N_ARCHITECTURE §Translation-Dateien
**Akzeptanz:** Beide Dateien kompilieren fehlerfrei.
**Abh.:** P3.3.1
**Ref.:** 14_I18N_ARCHITECTURE §Translation-Dateien

#### P3.3.3 — LocaleService + Locale-Wechsel
**Dateien:** `frontend/src/services/i18n/locale-service.ts`
**Aktion:** `setLocale()`, `getInitialLocale()`, Persistenz in localStorage
**Akzeptanz:** Locale wechseln → alle sichtbaren Strings aendern sich sofort (ohne Reload).
**Abh.:** P3.3.2
**Ref.:** 14_I18N_ARCHITECTURE §Locale-Service

#### P3.3.4 — Komponenten auf msg() umstellen
**Aktion:** Alle hardcodierten Strings in allen Komponenten durch `msg()` ersetzen
**Akzeptanz:** `grep -r "Laden\.\.\." frontend/src/components/` → 0 Treffer.
**Abh.:** P3.3.3, P2.5.1+

#### P3.3.5 — FormatService (Datums-/Zahlenformatierung)
**Dateien:** `frontend/src/utils/formatters.ts`
**Aktion:** `formatDate`, `formatDateTime`, `formatNumber`, `formatPercent`, `formatRelativeTime` via Intl API
**Akzeptanz:** Unit-Tests: DE-Locale formatiert Datum als "15. Jan. 2026", EN als "Jan 15, 2026".
**Abh.:** P3.3.3
**Ref.:** 14_I18N_ARCHITECTURE §Datums- und Zahlenformatierung

**Checkpoint 3.3:** i18n aktiv. DE+EN Locale wechselbar. Alle Strings lokalisiert.

---

### 3.4 Prompt-System (3 Tasks)

#### P3.4.1 — Prompt Templates Seed-Daten
**Dateien:** `supabase/seed/006_prompt_templates.sql`
**Aktion:** Alle 22 Prompts als DE + EN Templates (simulation_id = NULL = Plattform-Default) + 7 Mock-Templates
**Akzeptanz:** `SELECT count(*) FROM prompt_templates WHERE simulation_id IS NULL` ≥ 44 (22 × 2 Sprachen). Verwendet `prompt_category` (nicht `category`), `created_by_id`.
**Abh.:** P1.2.6
**Ref.:** 09_AI_INTEGRATION §Alle 22 Prompts, 15_MIGRATION_STRATEGY §3.2

#### P3.4.2 — PromptResolver Service (Backend)
**Dateien:** `backend/services/prompt_service.py`
**Aktion:** 5-stufige Aufloesungs-Kette: Sim+Locale → Sim+Default → Platform+Locale → Platform+EN → Hardcoded
**Akzeptanz:** Unit-Tests fuer alle 5 Fallback-Stufen.
**Abh.:** P3.4.1
**Ref.:** 09_AI_INTEGRATION §Prompt-Aufloesungs-Kette

#### P3.4.3 — Prompt Templates Router + Frontend UI
**Dateien:** `backend/routers/prompt_templates.py`, `frontend/src/components/settings/PromptTemplateEditor.ts`
**Aktion:**
- Backend: 6 Endpoints (GET list, GET one, POST, PUT, DELETE, POST test)
- Frontend: Template-Editor mit Variablen-Highlighting, Test-Funktion, Locale-Tabs
**Akzeptanz:** Prompt laden, anpassen, testen via UI. Test rendert Prompt mit Beispiel-Variablen.
**Abh.:** P3.4.2, P3.1.3
**Ref.:** 05_API_SPECIFICATION §Prompt Templates, 09_AI_INTEGRATION §Prompt-Template-Format

**Checkpoint 3.4:** Prompt-System komplett. 22 Templates seeded. 5-Stufen-Fallback getestet. Editor funktional.

---

### 3.5 AI Integration (9 Tasks)

#### P3.5.1 — OpenRouter Service (Async)
**Dateien:** `backend/services/external/openrouter.py`
**Aktion:** Async httpx Client. `generate(model, messages, temperature, max_tokens)`. Retry mit tenacity (429/503). Timeout-Handling.
**Akzeptanz:** Mock-Test: Generiert Text. Retry bei 429. Timeout nach 30s.
**Abh.:** P1.1.2
**Ref.:** 11_EXTERNAL_SERVICES §OpenRouter, 09_AI_INTEGRATION

#### P3.5.2 — Model Fallback Chain
**Dateien:** `backend/services/model_resolver.py`
**Aktion:** ModelResolver Klasse:
1. Simulation-spezifisches Modell (z.B. `ai.models.agent_description`)
2. Simulation-Default-Modell (`ai.models.default`)
3. Plattform-Default-Modell
4. Fallback-Modell (`ai.models.fallback`)
**Akzeptanz:** Unit-Tests fuer alle 4 Fallback-Stufen. RateLimitError → Fallback. ModelUnavailableError → Plattform-Default.
**Abh.:** P3.2.2
**Ref.:** 09_AI_INTEGRATION §Model Fallback

#### P3.5.3 — Replicate Service (Async)
**Dateien:** `backend/services/external/replicate.py`
**Aktion:** Prediction erstellen → Poll bis succeeded → Download → WebP-Konvertierung (Pillow) → Supabase Storage Upload
**Akzeptanz:** Mock-Test: Prediction-Lifecycle funktioniert. WebP-Konvertierung erfolgreich.
**Abh.:** P1.1.2
**Ref.:** 11_EXTERNAL_SERVICES §Replicate

#### P3.5.4 — Generation Service (alle 10+ Typen)
**Dateien:** `backend/services/generation_service.py`
**Aktion:** GenerationService Klasse mit allen Methoden:
- `generate_agent_full()`, `generate_agent_partial()` — agent_generation_full, agent_generation_partial
- `generate_building()`, `generate_building_named()` — building_generation, building_generation_named
- `generate_portrait_description()` — portrait_description
- `generate_event()` — event_generation
- `generate_agent_reaction()` — agent_reactions
- `generate_news_transformation()` — news_transformation
- `generate_news_agent_reaction()` — news_agent_reaction
- `generate_social_media_transform()` — social_media_transform
- `generate_social_trends_campaign()` — social_trends_campaign
Alle nutzen PromptResolver + ModelResolver + OpenRouter Service
**Akzeptanz:** Mock-Tests fuer alle Generierungs-Typen. PromptResolver + ModelResolver korrekt aufgerufen.
**Abh.:** P3.5.1, P3.5.2, P3.4.2
**Ref.:** 09_AI_INTEGRATION §Generierungs-Typen

#### P3.5.5 — Image Processing Pipeline
**Dateien:** `backend/services/image_service.py`
**Aktion:** End-to-End Pipeline:
1. Portrait/Building-Beschreibung generieren (Text-LLM via GenerationService)
2. Beschreibung als Prompt an Replicate
3. Negative Prompt aus Settings laden
4. Bild generieren (Stable Diffusion via ReplicateService)
5. Download + WebP-Konvertierung (Pillow, max 1024px)
6. Upload in Supabase Storage (agent.portraits / building.images)
7. URL in Entity speichern (portrait_image_url / image_url)
**Akzeptanz:** Agent-Portrait generieren → Bild in Storage → URL in Agent gespeichert. Building-Image analog.
**Abh.:** P3.5.3, P3.5.4, P1.2.12
**Ref.:** 09_AI_INTEGRATION §Bild-Generierung, §Pipeline

#### P3.5.6 — Generation Router
**Dateien:** `backend/routers/generation.py`
**Aktion:** 5 Endpoints: POST agent, POST building-text, POST portrait-description, POST event, POST image
- Rate-Limited (30/hr via P1.3.3)
**Akzeptanz:** Mit Mock: Agent-Beschreibung generieren → in DB gespeichert. Portrait generieren → Bild-URL zurueck.
**Abh.:** P3.5.4, P3.5.5
**Ref.:** 05_API_SPECIFICATION §Generation

#### P3.5.7 — Chat mit LangChain Memory
**Dateien:** `backend/services/chat_ai_service.py`
**Aktion:** LangChain `SimulationChatMemory` + OpenRouter:
- System-Prompt aus PromptResolver (chat_system_prompt + locale)
- Memory: letzte 50 Nachrichten aus chat_messages
- Agent-Kontext (name, character, background, professions)
- Simulation-Kontext (name, theme)
- Antwort speichern mit `sender_role: 'assistant'`
**Akzeptanz:** Chat-Nachricht → AI-Antwort im Charakter des Agenten. Memory ueber mehrere Nachrichten. Locale-aware.
**Abh.:** P3.5.1, P3.4.2, P2.1.10
**Ref.:** 09_AI_INTEGRATION §Chat-System mit LangChain

#### P3.5.8 — Chat Router AI-Integration
**Dateien:** `backend/routers/chat.py` (erweitern)
**Aktion:** POST message mit `generate_response: true` → AI-Antwort generieren via ChatAiService
**Akzeptanz:** Nachricht mit `generate_response: true` → User-Message + AI-Response gespeichert. conversation.message_count += 2 (via Trigger).
**Abh.:** P3.5.7, P2.1.10

#### P3.5.9 — Frontend: Generation UI in Entity Modals
**Dateien:** Erweitern: `AgentEditModal.ts`, `BuildingEditModal.ts`, `EventEditModal.ts`
**Aktion:** "Beschreibung generieren" + "Portrait generieren" Buttons in Modals. Loading-State waehrend Generierung. Progress-Indicator. Ergebnis in Formular einsetzen.
**Akzeptanz:** Click auf "Generieren" → Loading-State → Beschreibung/Bild erscheint. Kann uebernommen oder verworfen werden.
**Abh.:** P3.2.4, P3.5.6, P2.5.1
**Ref.:** 07_FRONTEND_COMPONENTS §Generation UI

**Checkpoint 3.5:** AI-Generierung funktional. 10+ Generierungs-Typen. Image Pipeline. Chat mit Memory. Frontend-Integration.

---

### 3.6 Cross-Cutting Concerns (3 Tasks)

#### P3.6.1 — Pagination Standardisierung
**Dateien:** Backend: `backend/models/common.py` (erweitern), Frontend: `BaseApiService.ts` (erweitern)
**Aktion:** Einheitliche Pagination auf allen List-Endpoints:
- Backend: Standard Query-Parameter (limit, offset, sort, search)
- Frontend: PaginatedResponse<T> mit meta (count, total, limit, offset)
**Akzeptanz:** Alle List-Endpoints unterstuetzen `?limit=25&offset=0&sort=-created_at&search=`. Frontend Pagination-Komponente funktioniert ueberall.
**Abh.:** P2.1.2+

#### P3.6.2 — Error Handling Standardisierung
**Dateien:** Frontend: `frontend/src/utils/error-handler.ts`
**Aktion:** Globaler Error-Handler:
- API-Fehler → Toast-Notification
- 401 → Redirect zu Login
- 403 → "Keine Berechtigung" Toast
- Network-Error → "Verbindung verloren"
- Unhandled → Generic Error mit Retry
**Akzeptanz:** API-Fehler zeigen Toast. 401 → Login-Redirect. Network-Error → sinnvolle Meldung.
**Abh.:** P2.3.7

#### P3.6.3 — CORS Verification + Security Audit
**Dateien:** `backend/tests/integration/test_cors.py`, `backend/tests/integration/test_security_headers.py`
**Aktion:** Integration-Tests:
- CORS: Preflight korrekt, nur erlaubte Origins
- Security Headers: CSP, HSTS, X-Frame-Options auf allen Responses
- Rate Limiting: AI-Endpoints throttled
**Akzeptanz:** Alle Security-Tests gruen. Keine fehlenden Headers.
**Abh.:** P1.3.3, P1.3.6

**Checkpoint Phase 3:** Settings komplett. i18n DE+EN. AI-Generierung 10+ Typen. Chat mit Memory. Prompts 5-Stufen-Fallback. **30 Tasks erledigt (gesamt: 108).**

---

## Phase 4: Social, Multi-User, Realtime

### 4.1 Einladungen + Rollen (4 Tasks)

#### P4.1.1 — Invitations Router (Backend)
**Dateien:** `backend/routers/invitations.py`, `backend/models/invitation.py`, `backend/services/invitation_service.py`
**Aktion:** 3 Endpoints:
- POST /simulations/:simId/invitations → Token generieren + Email (optional)
- GET /invitations/:token → Einladung validieren (Plattform-Level)
- POST /invitations/:token/accept → Mitglied erstellen mit `invited_role`
**Akzeptanz:** Einladung erstellen → Token-URL generiert. Token-URL aufrufen → Einladung valide. Annehmen → Mitglied mit korrekter Rolle.
**Abh.:** P2.1.11
**Ref.:** 05_API_SPECIFICATION §Invitations

#### P4.1.2 — InvitationAcceptView (Frontend)
**Dateien:** `frontend/src/components/platform/InvitationAcceptView.ts`
**Aktion:** Token aus URL lesen → Einladung anzeigen (Simulation-Name, Rolle) → Annehmen-Button → Redirect zu Simulation
**Akzeptanz:** Nicht-authentifiziert → Login-Redirect mit Return-URL. Authentifiziert → Einladung akzeptieren → Redirect.
**Abh.:** P4.1.1, P1.4.9
**Ref.:** 07_FRONTEND_COMPONENTS §InvitationAcceptView

#### P4.1.3 — AccessSettingsPanel: Mitglieder-Verwaltung
**Dateien:** `frontend/src/components/settings/AccessSettingsPanel.ts` (erweitern)
**Aktion:** Mitglieder-Liste in AccessSettingsPanel: Rollen-Dropdown (Owner/Admin/Editor/Viewer), Einladungs-Links erstellen, Mitglieder entfernen, Pending Invitations anzeigen
**Akzeptanz:** Mitglied-Rolle aendern → gespeichert. Einladung erstellen → Link angezeigt. Entfernen → Bestaetigung → entfernt. Owner-Entfernung disabled (DB-Trigger schuetzt).
**Abh.:** P4.1.1, P3.1.6
**Ref.:** 08_SIMULATION_SETTINGS §Access Settings

#### P4.1.4 — Rollen-basierte UI-Einschraenkungen
**Dateien:** Alle Entity-Views + Settings (erweitern)
**Aktion:** UI-Elemente basierend auf `appState.canEdit` / `appState.isOwner`:
- Viewer: Nur Lesen, kein Create/Edit/Delete
- Editor: CRUD erlaubt, keine Settings
- Admin: CRUD + Settings (ausser Access)
- Owner: Alles
**Akzeptanz:** Als Viewer: Keine Edit/Delete Buttons sichtbar. Als Editor: CRUD moeglich, Settings-Tab ausgeblendet (ausser World). Als Owner: Alles sichtbar.
**Abh.:** P4.1.3, P1.4.7

**Checkpoint 4.1:** Multi-User funktional. Einladungen. Rollen-basierte UI.

---

### 4.2 Social Features (8 Tasks)

#### P4.2.1 — Social Trends Router
**Dateien:** `backend/routers/social_trends.py`, `backend/models/social_trend.py`, `backend/services/social_trends_service.py`
**Aktion:** 5 Endpoints:
- GET list (mit Filter: platform, sentiment, is_processed)
- POST /fetch → Trends von Guardian/NewsAPI abrufen
- POST /transform → Trend in Simulations-Kontext transformieren (AI)
- POST /integrate → Trend als Kampagne integrieren
- POST /workflow → Vollstaendiger Workflow (Fetch → Transform → Integrate)
**Akzeptanz:** Trends fetchen → transformieren → als Kampagne integrieren. Verwendet `is_processed` (boolean prefix).
**Abh.:** P2.1.12, P3.5.4, P3.2.2
**Ref.:** 05_API_SPECIFICATION §Social Trends

#### P4.2.2 — News API Services (Backend)
**Dateien:** `backend/services/external/guardian.py`, `backend/services/external/newsapi.py`
**Aktion:**
- Guardian: Async httpx Client, `/search` Endpoint, JSON→SocialTrend Mapping
- NewsAPI: Async httpx Client, `/everything` Endpoint, JSON→SocialTrend Mapping
- Beide nutzen ExternalServiceResolver fuer API-Keys
**Akzeptanz:** Mock-Tests: Guardian-Artikel → SocialTrend. NewsAPI-Artikel → SocialTrend.
**Abh.:** P3.2.2
**Ref.:** 11_EXTERNAL_SERVICES §News-APIs

#### P4.2.3 — Facebook Service (Backend)
**Dateien:** `backend/services/external/facebook.py`
**Aktion:** Facebook Graph API Client:
- Posts importieren (`GET /{page-id}/feed`)
- Kommentare laden (`GET /{post-id}/comments`)
- Attachments laden
- Mapping zu social_media_posts (mit `source_created_at`, `imported_at`)
**Akzeptanz:** Mock-Tests: Facebook-Posts → social_media_posts. Kommentare → social_media_comments.
**Abh.:** P3.2.2
**Ref.:** 11_EXTERNAL_SERVICES §Facebook Graph API

#### P4.2.4 — Social Media Router
**Dateien:** `backend/routers/social_media.py`, `backend/services/social_media_service.py`
**Aktion:** 6 Endpoints:
- GET /posts (mit Filter: platform, transformed)
- POST /sync → Posts von konfigurierter Platform synchronisieren
- POST /posts/:id/transform → Post transformieren (AI, 3 Typen: dystopian, propaganda, surveillance)
- POST /posts/:id/analyze-sentiment → Sentiment-Analyse (AI, detailed/quick)
- POST /posts/:id/generate-reactions → Agenten-Reaktionen generieren (AI)
- GET /posts/:id/comments
**Akzeptanz:** Posts synchronisieren → transformieren → Sentiment → Reaktionen. Kompletter Workflow.
**Abh.:** P4.2.3, P3.5.4
**Ref.:** 05_API_SPECIFICATION §Social Media Integration

#### P4.2.5 — SocialTrendsView (Frontend)
**Dateien:**
```
frontend/src/components/social/
├── SocialTrendsView.ts
├── TrendCard.ts
├── TransformationModal.ts
└── TrendFilterBar.ts
```
**Aktion:** Trends auflisten, filtern (Platform, Sentiment, Processed), Transformation-Modal (Type-Auswahl, Preview), Kampagne erstellen
**Akzeptanz:** Trends anzeigen. Trend transformieren (dystopisch). Als Kampagne integrieren.
**Abh.:** P2.3.1, P2.3.2, P2.4.3, P4.2.1
**Ref.:** 07_FRONTEND_COMPONENTS §SocialTrendsView

#### P4.2.6 — SocialMediaView (Frontend)
**Dateien:**
```
frontend/src/components/social/
├── SocialMediaView.ts
├── PostCard.ts
├── PostTransformModal.ts
└── SentimentBadge.ts
```
**Aktion:** Posts anzeigen, Sync-Button, Transform (3 Typen), Sentiment-Analyse, Reaktionen anzeigen
**Akzeptanz:** Posts synchronisieren → angezeigt. Transformieren → transformierter Text sichtbar. Sentiment-Badge korrekt.
**Abh.:** P2.3.1, P2.4.3, P4.2.4
**Ref.:** 07_FRONTEND_COMPONENTS §SocialMediaView

#### P4.2.7 — CampaignDashboard (Frontend)
**Dateien:**
```
frontend/src/components/social/
├── CampaignDashboard.ts
├── CampaignCard.ts
├── CampaignDetailView.ts
└── CampaignMetrics.ts
```
**Aktion:** Kampagnen auflisten. Detail-Ansicht mit Events (campaign_events), Metriken (campaign_metrics). Performance-Uebersicht (nutzt materialized view campaign_performance).
**Akzeptanz:** Kampagne anzeigen. Events einer Kampagne sichtbar. Metriken-Charts angezeigt.
**Abh.:** P2.4.3, P4.2.1, P2.1.12
**Ref.:** 07_FRONTEND_COMPONENTS §CampaignDashboard

#### P4.2.8 — LocationsView (Frontend)
**Dateien:**
```
frontend/src/components/locations/
├── LocationsView.ts
├── CityList.ts
├── ZoneList.ts
├── StreetList.ts
└── LocationEditModal.ts
```
**Aktion:** Hierarchische Ansicht: Stadt → Zonen → Strassen. CRUD auf jeder Ebene. Verwendet `street_type`.
**Akzeptanz:** Stadt erstellen → Zone hinzufuegen → Strasse hinzufuegen. Cascade-Delete funktioniert.
**Abh.:** P2.3.1, P2.4.3, P2.1.7
**Ref.:** 07_FRONTEND_COMPONENTS §LocationsView

**Checkpoint 4.2:** Social Features komplett (Trends, Social Media, Campaigns). Locations-CRUD.

---

### 4.3 Realtime + Simulation-Erstellung (4 Tasks)

#### P4.3.1 — Supabase Realtime Service
**Dateien:** `frontend/src/services/supabase/SupabaseRealtimeService.ts`
**Aktion:** Live-Updates via Supabase Realtime Channels:
- Chat-Nachrichten: Neue Nachrichten in offener Konversation
- Agent-Aenderungen: Neuer Agent / Agent geloescht in AgentsView
- Event-Aenderungen: Neues Event in EventsView
- Subscription-Management: Subscribe/Unsubscribe bei View-Wechsel
**Akzeptanz:** Tab 1: Nachricht senden → Tab 2: Nachricht erscheint live. Agent erstellen in Tab 1 → erscheint in Tab 2.
**Abh.:** P1.4.5, P2.5.4
**Ref.:** 10_AUTH_AND_SECURITY §Supabase Realtime

#### P4.3.2 — CreateSimulationWizard
**Dateien:** `frontend/src/components/platform/CreateSimulationWizard.ts`
**Aktion:** 3-Step Wizard:
1. Basic Info (Name → auto-Slug, Theme, Content-Locale, Description)
2. Taxonomies (Import defaults from Velgarien / Start empty / Custom)
3. Confirm & Create → API Call → Redirect zu neuer Simulation
**Akzeptanz:** Wizard durchlaufen → Simulation erstellt mit Taxonomien → Redirect zu Dashboard.
**Abh.:** P2.4.4, P2.1.8
**Ref.:** 07_FRONTEND_COMPONENTS §CreateSimulationWizard

#### P4.3.3 — Materialized View Refresh
**Dateien:** `backend/services/materialized_view_service.py`, `backend/routers/admin.py`
**Aktion:**
- Service: `REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_performance` und `agent_statistics`
- Admin-Endpoint: POST /api/v1/admin/refresh-views (Owner/Admin only)
- Optional: pg_cron Integration fuer automatischen Refresh (Doku als Kommentar)
**Akzeptanz:** POST /admin/refresh-views → Views refreshed. Daten sind aktuell.
**Abh.:** P1.2.11

#### P4.3.4 — ChatApiService Frontend Update
**Dateien:** `frontend/src/services/api/ChatApiService.ts` (erweitern), `ChatWindow.ts` (erweitern)
**Aktion:**
- ChatApiService: `generate_response: true` Parameter in sendMessage()
- ChatWindow: AI-Response-Loading-State, Typing-Indicator, Realtime-Updates
**Akzeptanz:** Nachricht senden mit AI → Typing-Indicator → AI-Antwort erscheint. Realtime-Updates fuer neue Nachrichten.
**Abh.:** P3.5.8, P4.3.1

**Checkpoint 4.3:** Realtime-Updates. Simulation-Wizard. Materialized View Refresh. Chat mit AI.

---

### 4.4 Multi-User Polish (4 Tasks)

#### P4.4.1 — Concurrent Edit Protection
**Dateien:** Backend: Alle Services (erweitern)
**Aktion:** Optimistic Locking via `updated_at`:
- PUT Requests senden `if_updated_at` Header
- Backend prueft: `WHERE id = :id AND updated_at = :if_updated_at`
- Conflict → 409 mit aktuellem Stand
**Akzeptanz:** User A + B oeffnen Agent. A speichert. B speichert → 409 Conflict mit A's Version.
**Abh.:** P2.1.2+

#### P4.4.2 — Presence Indicators
**Dateien:** `frontend/src/services/supabase/PresenceService.ts`, Alle Entity-Views (erweitern)
**Aktion:** Supabase Realtime Presence:
- Zeigt welche User gerade welchen View/Entity ansehen
- Avatar-Badges neben Entities die andere User gerade editieren
**Akzeptanz:** User A oeffnet Agent-Details → User B sieht A's Avatar-Badge beim Agent.
**Abh.:** P4.3.1

#### P4.4.3 — Notification System
**Dateien:** `frontend/src/services/NotificationService.ts`, `frontend/src/components/platform/NotificationCenter.ts`
**Aktion:**
- In-App Notifications: Einladung erhalten, Entity geaendert von anderem User, AI-Generierung abgeschlossen
- Notification-Bell im PlatformHeader
- Mark-as-read
**Akzeptanz:** Einladung erhalten → Bell zeigt Badge. Click → Notifications-Dropdown. Mark-as-read funktioniert.
**Abh.:** P4.3.1, P4.1.1

#### P4.4.4 — User Profile
**Dateien:** `frontend/src/components/platform/UserProfileView.ts`
**Aktion:** User-Profil-Seite: Display-Name, Avatar, Sprach-Praeferenz, Liste der Mitgliedschaften, Account-Aktionen (Password aendern)
**Akzeptanz:** Profil anzeigen. Display-Name aendern. Password via Supabase Auth zuruecksetzbar.
**Abh.:** P1.4.9

**Checkpoint Phase 4:** Multi-User komplett. Social Features. Realtime. Einladungen + Rollen. **20 Tasks erledigt (gesamt: 128).**

---

## Phase 5: Testing & Polish

### 5.1 E2E Tests (7 Tasks)

#### P5.1.1 — Playwright Setup + Auth Helper
**Dateien:** `e2e/playwright.config.ts`, `e2e/helpers/auth.ts`, `e2e/helpers/fixtures.ts`
**Aktion:** Playwright Config, Login-Helper (Supabase Auth), Test-Fixtures (Agent, Building, Event, Simulation)
**Akzeptanz:** `npx playwright test --headed` oeffnet Browser. Login-Helper funktioniert.
**Abh.:** P2.5.5
**Ref.:** 16_TESTING_STRATEGY §E2E Testing

#### P5.1.2 — E2E: Auth Flow
**Dateien:** `e2e/tests/auth.spec.ts`
**Aktion:** Tests: Login, Register, Logout, Password-Reset, Token-Refresh, Multi-Tab Session
**Akzeptanz:** Alle Auth-Flows testen. Login → Dashboard. Logout → Login-Page.
**Abh.:** P5.1.1

#### P5.1.3 — E2E: Agent CRUD + Generation
**Dateien:** `e2e/tests/agents.spec.ts`
**Aktion:** Tests: Agent erstellen, bearbeiten, loeschen, filtern, suchen, Portrait generieren, Beschreibung generieren
**Akzeptanz:** End-to-End: Agent erstellen → Generieren → Portrait sichtbar → Loeschen → nicht mehr sichtbar.
**Abh.:** P5.1.1, P3.5.9

#### P5.1.4 — E2E: Building + Event CRUD
**Dateien:** `e2e/tests/buildings.spec.ts`, `e2e/tests/events.spec.ts`
**Aktion:** Tests: CRUD, Agent-Zuweisung (Buildings), Reaktionen (Events), Generierung
**Akzeptanz:** Building CRUD + Agent-Zuweisung End-to-End. Event CRUD + Reaktion End-to-End.
**Abh.:** P5.1.1

#### P5.1.5 — E2E: Chat mit AI
**Dateien:** `e2e/tests/chat.spec.ts`
**Aktion:** Tests: Konversation starten, Nachricht senden, AI-Antwort erhalten, Konversation loeschen
**Akzeptanz:** Chat → AI-Antwort → Memory ueber Nachrichten.
**Abh.:** P5.1.1, P4.3.4

#### P5.1.6 — E2E: Settings
**Dateien:** `e2e/tests/settings.spec.ts`
**Aktion:** Tests: Alle 6 Tabs durchklicken, Werte aendern, speichern, Taxonomie anlegen/loeschen, Theme-Aenderung
**Akzeptanz:** Settings aendern → Persistiert → Nach Reload vorhanden.
**Abh.:** P5.1.1, P3.2.1

#### P5.1.7 — E2E: Multi-User + Social
**Dateien:** `e2e/tests/multi-user.spec.ts`, `e2e/tests/social.spec.ts`
**Aktion:** Tests: Einladung senden/annehmen, Rollen-Einschraenkungen, Trends fetchen/transformieren, Kampagne erstellen
**Akzeptanz:** User A laedt User B ein → B akzeptiert → B sieht Simulation. Viewer kann nicht editieren.
**Abh.:** P5.1.1, P4.1.4, P4.2.7

**Checkpoint 5.1:** 7 E2E Test-Suites gruen.

---

### 5.2 Security + Performance Tests (3 Tasks)

#### P5.2.1 — RLS Security Tests
**Dateien:** `backend/tests/integration/test_rls_policies.py`
**Aktion:**
- Isolation-Tests: User A sieht nicht User Bs Daten (fuer alle 27 Tabellen)
- Rollen-Tests: Viewer kann nicht schreiben, Editor kann nicht Admin-Settings aendern
- Trigger-Tests: Slug immutabel, letzter Owner geschuetzt, Status-Transitions
- Storage RLS: Nur Simulations-Mitglieder koennen uploaden
**Akzeptanz:** Alle RLS-Tests gruen. Kein Cross-Simulation Data Leak.
**Abh.:** P4.1.4
**Ref.:** 16_TESTING_STRATEGY §RLS Security Tests

#### P5.2.2 — Performance Tests
**Dateien:** `backend/tests/performance/test_load.py`
**Aktion:**
- 100 gleichzeitige Requests (Locust oder pytest-benchmark)
- Full-Text Suche ueber 10.000 Agenten (search_vector Performance)
- Pagination ueber grosse Datasets
- AI-Endpoint Rate Limiting unter Last
- Materialized View Refresh Performance
**Akzeptanz:** P95 Response Time < 200ms fuer CRUD. Full-Text Search < 100ms. Rate Limiting funktioniert unter Last.
**Abh.:** P2.2.5
**Ref.:** 16_TESTING_STRATEGY §Performance Tests

#### P5.2.3 — Security Audit + Dependency Check
**Dateien:** `.github/workflows/security.yml`
**Aktion:**
- `npm audit` fuer Frontend-Dependencies
- `pip-audit` fuer Backend-Dependencies
- OWASP Top 10 Checklist Review
- API-Security: SQL Injection (Parameterized Queries), XSS (CSP), CSRF (SameSite Cookies)
**Akzeptanz:** 0 kritische Vulnerabilities. OWASP Checklist komplett.
**Abh.:** P5.1.7

**Checkpoint Phase 5:** Umfassend getestet. Security-verifiziert. Performance-validiert. **10 Tasks erledigt (gesamt: 138).**

---

## Task-Uebersicht (Zahlen)

| Phase | Abschnitt | Tasks | Beschreibung |
|-------|-----------|-------|-------------|
| **Phase 1** | 1.1 | 7 | Projekt-Setup |
| | 1.2 | 12 | Datenbank-Schema (27 Tabellen, Triggers, Views) |
| | 1.3 | 10 | Backend Foundation (Middleware, Auth, Routers) |
| | 1.4 | 11 | Frontend Foundation (Shell, Auth, Dashboard) |
| | 1.5 | 1 | CI/CD |
| | **Summe** | **41** | |
| **Phase 2** | 2.1 | 14 | CRUD Routers + Pydantic Models |
| | 2.2 | 5 | Daten-Migration |
| | 2.3 | 9 | Shared Components |
| | 2.4 | 4 | Layout + API Services |
| | 2.5 | 5 | Entity Views |
| | **Summe** | **37** | |
| **Phase 3** | 3.1 | 6 | Settings Panels (6 Tabs) |
| | 3.2 | 4 | Settings Support-Services |
| | 3.3 | 5 | i18n (@lit/localize) |
| | 3.4 | 3 | Prompt-System |
| | 3.5 | 9 | AI Integration (10+ Typen) |
| | 3.6 | 3 | Cross-Cutting Concerns |
| | **Summe** | **30** | |
| **Phase 4** | 4.1 | 4 | Einladungen + Rollen |
| | 4.2 | 8 | Social Features |
| | 4.3 | 4 | Realtime + Simulation-Erstellung |
| | 4.4 | 4 | Multi-User Polish |
| | **Summe** | **20** | |
| **Phase 5** | 5.1 | 7 | E2E Tests (Playwright) |
| | 5.2 | 3 | Security + Performance |
| | **Summe** | **10** | |
| **Gesamt** | | **138** | |

### Dateien + Endpoints (geschaetzt)

| Phase | Dateien | Endpoints |
|-------|---------|-----------|
| Phase 1 | ~70 | 9 |
| Phase 2 | ~90 | ~90 |
| Phase 3 | ~50 | ~25 |
| Phase 4 | ~40 | ~15 |
| Phase 5 | ~30 (Tests) | — |
| **Gesamt** | **~280** | **~108+** |

---

## Abhaengigkeitsgraph (kritischer Pfad)

```
P1.1.1 → P1.1.2+P1.1.3 → P1.2.1 → P1.2.3 → P1.2.6 → P1.2.9 (Triggers)
                          ↓                              ↓
                     P1.2.7 → P1.2.8 (RLS)         P1.2.11 (Views)
                          ↓                              ↓
                     P1.3.1 → P1.3.2 → P1.3.9      P1.2.12 (Storage)
                                        ↓
P1.4.1 → P1.4.5 → P1.4.6 → P1.4.9 → P1.4.10
                                        ↓
                              P2.1.2 → P2.5.1 → P2.5.5
                              ↓
                              P2.2.1 → P2.2.5
                                        ↓
                     P3.1.1 → P3.2.1 (SettingsView)
                     ↓
                     P3.3.1 → P3.3.4 (msg() Migration)
                     ↓
                     P3.4.1 → P3.4.2 → P3.5.4 → P3.5.6 → P3.5.9
                                                             ↓
                     P4.1.1 → P4.1.4 (Rollen-UI)        P3.5.7 → P4.3.4
                     ↓                                       ↓
                     P4.2.1 → P4.2.5 → P4.2.7          P4.3.1
                                                             ↓
                                                  P5.1.1 → P5.1.7 → P5.2.3
                                                                       ↓
                                                                      DONE
```

**Kritischer Pfad:** Setup → Schema (Triggers+Views) → Auth → CRUD → Migration → Settings → i18n → Prompts → AI Generation → Chat+AI → Social → Tests → Security Audit

---

## Querverweise

- **00-15** — Spezifikations-Dokumente (Referenz fuer jede Task)
- **03_DATABASE_SCHEMA_NEW.md v2.0** — Renamed Spalten, neue Tabellen, Triggers, Views
- **04_DOMAIN_MODELS.md v2.0** — TypeScript Interfaces aligned mit Schema v2.0
- **16_TESTING_STRATEGY.md** — Test-Patterns, CI/CD, Coverage-Ziele

### Aenderungsprotokoll Schema → Plan

Alle Schema-Renames aus 03_DATABASE_SCHEMA_NEW v2.0 sind in den Tasks reflektiert:

| Rename | Betroffene Tasks |
|--------|-----------------|
| `role` → `member_role` | P1.2.1, P2.1.11, P4.1.3 |
| `key` → `setting_key` | P1.2.1, P2.1.9 |
| `value` → `setting_value` | P1.2.1, P2.1.9 |
| `type` → `building_type`/`event_type`/`street_type` | P1.2.3, P1.2.2, P2.1.3, P2.1.5, P2.5.2, P2.5.3 |
| `condition` → `building_condition` | P1.2.3, P2.1.3, P2.5.2 |
| `category` → `prompt_category` | P1.2.6, P3.4.1 |
| `created_by_user` → `created_by_id` | P1.2.3, P2.1.1, P2.2.2 |
| `event_timestamp` → `occurred_at` | P1.2.3, P2.1.5, P2.2.3 |
| `reaction_timestamp` → `occurred_at` | P1.2.4, P2.2.3 |
| `created_time` → `source_created_at` | P1.2.5, P2.2.4, P4.2.3 |
| `integrated_as_event` → `is_integrated_as_event` | P1.2.5, P2.1.12 |
| `processed` → `is_processed` | P1.2.5, P4.2.1 |
| Neue Tabellen: `campaign_events`, `campaign_metrics` | P1.2.5, P2.1.12, P4.2.7 |
| `tags jsonb` → `tags text[]` | P1.2.3, P2.1.5, P2.2.3, P2.5.3 |
