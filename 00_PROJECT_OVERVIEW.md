# 00 - Project Overview: Velgarien Multi-Simulations-Plattform

**Version:** 1.1
**Datum:** 2026-02-15
**Status:** Phase 1 + Phase 2 implementiert (Platform Foundation + Entity CRUD)

---

## Vision

Die **Velgarien Multi-Simulations-Plattform** ist ein Neuaufbau des bestehenden Velgarien-Projekts. Statt einer einzelnen hartcodierten dystopischen Welt wird eine **generische Plattform** geschaffen, auf der beliebig viele Weltensimulationen erstellt, konfiguriert und verwaltet werden können.

**Velgarien** wird dabei zur **ersten Simulation** und Referenz-Implementation auf dieser Plattform.

### Kern-Konzept

```
Plattform (Multi-Tenancy)
├── Simulation "Velgarien" (dystopisch, deutsch)
│   ├── Agenten, Gebäude, Events, Zonen, Städte
│   ├── Eigene Enums, Prompts, Design, Integrationen
│   └── Eigene AI-Modelle und Konfiguration
├── Simulation "Utopia Prime" (utopisch, englisch)
│   ├── ...
│   └── Komplett eigene Konfiguration
└── Simulation N
    └── ...
```

### Was sich ändert

| Aspekt | Altsystem | Neues System |
|--------|-----------|--------------|
| Scope | 1 Welt "Velgarien" | N Simulationen |
| Konfiguration | Hartcodiert in Code/DB | Per Simulation konfigurierbar |
| Enums | Feste PostgreSQL ENUMs + CHECK | Dynamische Tabellen pro Simulation |
| Prompts | Hartcodiert in Python-Services | Templates pro Simulation + Sprache |
| Design | 1 festes Theme | Theme pro Simulation |
| Sprache | Deutsch/Englisch gemischt | Plattform-UI + Inhalts-Sprache konfigurierbar |
| Rollen | Globale Rollen | Rollen pro Simulation |
| Integrationen | 1 Facebook-Page, feste News-APIs | Pro Simulation konfigurierbar |

---

## Aktuelle Architektur (Altsystem)

### Tech-Stack

| Schicht | Technologie | Status |
|---------|------------|--------|
| **Backend** | Python/Flask | V3 Blueprint-Architektur (→ FastAPI im Neubau) |
| **Frontend** | Lit 3.3 + Preact Signals + TypeScript | Moderne Web Components |
| **Build** | Vite | Optimiert |
| **Datenbank** | Supabase (PostgreSQL) | 37 Tabellen, 6 Views |
| **Auth** | Supabase Auth | JWT-basiert |
| **AI (Text)** | OpenRouter API | LangChain-Integration |
| **AI (Bilder)** | Replicate API | Stable Diffusion |
| **Externe APIs** | Facebook Graph API, Guardian, NewsAPI | Teilweise implementiert |

### Architektur-Diagramm (Altsystem)

```
┌─────────────────────────────────┐
│         Frontend (Lit/TS)       │
│   64 Komponenten, 14 Services  │
│   Preact Signals State Mgmt    │
├─────────────────────────────────┤
│        Vite Dev Server          │
│     Proxy → Flask Backend       │
├─────────────────────────────────┤
│      Flask Backend (Python)     │
│  17 V3 Blueprints, 20+ Services│
│     LangChain Pipelines        │
├─────────────────────────────────┤
│     Supabase (PostgreSQL)       │
│  37 Tabellen, Supabase Auth    │
│     Storage (Images)            │
├─────────────────────────────────┤
│      Externe Services           │
│  OpenRouter │ Replicate │ FB    │
│  Guardian   │ NewsAPI           │
└─────────────────────────────────┘
```

### Architektur-Diagramm (Neubau — Hybrid)

```
┌──────────────────────────────────────────────────┐
│              Frontend (Lit/TS)                    │
│   Komponenten, Preact Signals, @supabase/supabase-js
├───────────────────┬──────────────────────────────┤
│                   │                              │
│  ┌────────────────┴─────────┐  ┌────────────────┴──┐
│  │   FastAPI (Business-Logik)│  │  Supabase direkt  │
│  │   CRUD, AI, Transforms   │  │  Auth, Storage,   │
│  │   User-JWT → RLS aktiv   │  │  Realtime          │
│  └────────────┬─────────────┘  └─────────┬────────┘
│               │                          │
│  ┌────────────┴──────────────────────────┴────────┐
│  │           Supabase (PostgreSQL + RLS)           │
│  │   Alle Tabellen mit simulation_id Isolation     │
│  │   Defense in Depth: FastAPI + RLS               │
│  ├────────────────────────────────────────────────┤
│  │            Externe Services                     │
│  │   OpenRouter │ Replicate │ Facebook │ News      │
│  └────────────────────────────────────────────────┘
```

### Feature-Übersicht (bestehend)

1. **Agenten-Management** - CRUD, Professionen, Portraits, Beschreibungen (AI-generiert)
2. **Gebäude-Management** - CRUD, Bilder (AI-generiert), Agent-Zuweisungen
3. **Events-System** - CRUD, AI-Generierung, Agenten-Reaktionen
4. **Chat-System** - User-Agent ↔ Welt-Agent Konversationen mit LangChain Memory
5. **Social Trends** - News-Integration, Kampagnen, Propaganda-System
6. **Facebook-Integration** - Post-Import, Transformation, Sentiment-Analyse
7. **Städte & Zonen** - Geographische Hierarchie mit GeoJSON
8. **User-Agents** - Eigene Agenten erstellen, Portraits generieren
9. **AI-Generation** - Texte, Beschreibungen, Bilder, Events per AI
10. **Prompt-Management** - Templates, Variablen, Customization (teilweise)
11. **Akademie** - Spezialgebäude für Agent-Profession-Training

---

## Kern-Domänen (generisch für alle Simulationen)

### Primäre Domänen

| Domäne | Beschreibung | Velgarien-Beispiel |
|--------|-------------|-------------------|
| **Simulation** | Top-Level Entity, Container für alles | "Velgarien" |
| **Agenten** | Bewohner/Akteure der Simulation | Dystopische Bürger mit Systemen |
| **Gebäude** | Orte und Strukturen | Militärakademien, Forschungslabore |
| **Events** | Geschehnisse und Nachrichten | Propagandaereignisse, Kontrolle |
| **Zonen** | Geografische Unterteilungen | Militärzone, Slums, Regierungsviertel |
| **Städte** | Übergeordnete Geografie | Dystopische Stadtstruktur |
| **Kampagnen** | Organisierte Aktionen/Initiativen | Propaganda-Kampagnen |

### Sekundäre Domänen

| Domäne | Beschreibung |
|--------|-------------|
| **Professionen** | Berufe/Rollen für Agenten (pro Simulation definierbar) |
| **Social Trends** | Externe Nachrichten-Integration und -Transformation |
| **Social Media** | Platform-Integration (Facebook, etc.) |
| **Chat** | Konversationen zwischen Benutzer und Simulations-Agenten |
| **Prompt Templates** | AI-Prompt-Konfiguration pro Simulation + Sprache |
| **Design/Theme** | Visuelles Erscheinungsbild pro Simulation |

---

## Bekannte Probleme & Grund für Neuaufbau

### Kritische Schema-Probleme

1. **Keine Foreign Keys** - Im gesamten public Schema existieren NULL explizite FK-Constraints
2. **Inkonsistente Primary Keys** - `agents.id` und `events.id` sind TEXT statt UUID
3. **Typ-Mismatches** - `agent_chats.agent_id` (UUID) referenziert `agents.id` (TEXT)
4. **Gemischte UUID-Generierung** - `extensions.uuid_generate_v4()` vs `gen_random_uuid()`
5. **Hartcodierte Enums** - Deutsche + englische Werte in PostgreSQL ENUMs und CHECK Constraints
6. **Unvollständige RLS** - 21 Tabellen ohne Row Level Security

### Code-Qualitätsprobleme

1. **22 hartcodierte Prompts** - Verteilt über 6 Python-Dateien, teilweise dupliziert
2. **Sprachmischung** - Deutsche Enums, englische Spalten, gemischte Prompts
3. **Typ-Chaos im Frontend** - 6 Typ-Dateien mit massiver Duplikation (Agent 2×, Building 2×, Event 2×)
4. **CSS-Duplikation** - Buttons 4×, Cards 3×, Forms 3× definiert
5. **Legacy-Komponenten** - VelgDataTable und VelgForm sind noch HTMLElement statt Lit
6. **Keine i18n** - 15+ Komponenten mit hartcodierten deutschen Strings

### Sicherheitsprobleme

1. **API Keys in config.py** - Supabase, OpenRouter, Replicate Keys im Code
2. **Fehlende Security Headers** - Kein CSP, kein Rate Limiting
3. **Unvollständige Auth** - Rollen nur global, nicht simulation-bezogen

### Architektur-Limitierungen

1. **Single-Tenant** - Alles ist auf "Velgarien" zugeschnitten
2. **Nicht erweiterbar** - Enums und Taxonomien fest im Schema
3. **Keine Multi-Sprach-Unterstützung** - Weder für UI noch für Inhalte
4. **Keine Theme-Unterstützung** - Ein festes visuelles Design

---

## Referenzen auf andere Dokumente

| Dokument | Inhalt |
|----------|--------|
| [01_PLATFORM_ARCHITECTURE.md](./01_PLATFORM_ARCHITECTURE.md) | Multi-Tenancy, Simulation-Isolation, Settings-Hierarchie |
| [02_DATABASE_SCHEMA_LEGACY.md](./02_DATABASE_SCHEMA_LEGACY.md) | Komplettes Alt-Schema aus Backup-Dump |
| [03_DATABASE_SCHEMA_NEW.md](./03_DATABASE_SCHEMA_NEW.md) | Neues Schema mit Simulation-Kontext |
| [04_DOMAIN_MODELS.md](./04_DOMAIN_MODELS.md) | Alle Entitäten mit Simulation-Scope |
| [05_API_SPECIFICATION.md](./05_API_SPECIFICATION.md) | Alle Endpoints (simulation-scoped) |
| [06_FEATURE_CATALOG.md](./06_FEATURE_CATALOG.md) | Plattform- + Simulation-Features |
| [07_FRONTEND_COMPONENTS.md](./07_FRONTEND_COMPONENTS.md) | Komponenten + Settings-UI |
| [08_SIMULATION_SETTINGS.md](./08_SIMULATION_SETTINGS.md) | Komplett-Spezifikation Settings-System |
| [09_AI_INTEGRATION.md](./09_AI_INTEGRATION.md) | AI-Pipelines pro Simulation |
| [10_AUTH_AND_SECURITY.md](./10_AUTH_AND_SECURITY.md) | Auth + Rollen + Simulation-Zugang |
| [11_EXTERNAL_SERVICES.md](./11_EXTERNAL_SERVICES.md) | Externe Services pro Simulation |
| [12_DESIGN_SYSTEM.md](./12_DESIGN_SYSTEM.md) | Design System mit Simulation-Themes |
| [13_TECHSTACK_RECOMMENDATION.md](./13_TECHSTACK_RECOMMENDATION.md) | Stack-Empfehlung |
| [14_I18N_ARCHITECTURE.md](./14_I18N_ARCHITECTURE.md) | Mehrsprachigkeit |
| [15_MIGRATION_STRATEGY.md](./15_MIGRATION_STRATEGY.md) | Migration Velgarien → Multi-Plattform |

---

## Bekannte Dokumentations-Lücken (Stand: 2026-02-15)

Die folgende Liste dokumentiert identifizierte Lücken aus der Verifikation (96% Completeness):

### 1. Mock-Data-Templates: Keine konkreten Inhalte

Die Mock-/Fallback-Templates M1-M7 (Agent-Charakter, Agent-Hintergrund, Portrait-Rollen, Building-Beschreibungen, Event-Templates, Social Trends, Twitter Trends) sind in `09_AI_INTEGRATION.md` und `14_I18N_ARCHITECTURE.md` als Typen referenziert, aber die **konkreten Textinhalte** der Templates fehlen. Diese müssen beim Implementieren aus dem Altsystem (`agents_service.py`, `social_trends_service.py`) extrahiert und als Seed-Daten bereitgestellt werden.

**Betroffene Dateien:** 09_AI_INTEGRATION.md, 14_I18N_ARCHITECTURE.md

### 2. API-Endpoint-Katalog: ~14 Endpoints nicht explizit spezifiziert

`05_API_SPECIFICATION.md` listet ~94 Endpoints explizit, spricht aber von "~108". Die fehlenden ~14 betreffen hauptsächlich:
- Health-Check-Endpoints pro Router (standardisiert, alle identisch)
- Hilfs-Endpoints (z.B. `GET /api/v1/config/models`, `GET /api/v1/config/transformation-prompts`)
- Statistik-Endpoints (z.B. `GET /api/v1/simulations/:simId/building-agent-relations/statistics`)

**Betroffene Datei:** 05_API_SPECIFICATION.md

### 3. Velgarien-spezifische Design-Token-Werte fehlen

`12_DESIGN_SYSTEM.md` definiert das vollständige Token-System, aber die **konkreten Theme-Werte für Velgarien als erste Simulation** (Accent-Farben, spezifische Header-Hintergründe, etc.) sind nicht explizit gelistet. Das Standard-Theme (schwarz/weiss Brutalist) ist vollständig definiert, aber ein `[data-simulation-theme="velgarien"]`-Block mit konkreten Hex-Werten fehlt.

**Betroffene Datei:** 12_DESIGN_SYSTEM.md

### 4. Keine dedizierte Test-Strategie

Es existiert kein `16_TESTING_STRATEGY.md`. Testing wird nur in `13_TECHSTACK_RECOMMENDATION.md` als Tool-Auswahl (vitest, playwright, @open-wc/testing) erwähnt. Eine vollständige Spezifikation mit Test-Pyramide, Abdeckungszielen, CI-Integration und Test-Daten-Strategie fehlt.

**Empfehlung:** Bei Bedarf als 16. Dokument ergänzen.
