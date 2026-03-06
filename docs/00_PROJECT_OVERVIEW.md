# 00 - Project Overview: metaverse.center Multi-Simulations-Plattform

**Version:** 2.0
**Datum:** 2026-03-03
**Status:** Alle 6 Phasen + i18n + per-Simulation-Theming komplett. 5 Simulationen live: Velgarien, The Gaslit Reach, Station Null, Speranza, Cité des Dames. Competitive Epochs (PvP mit Operativen, Scoring, Battle Log) + Bot Players (5 KI-Persönlichkeitsarchetypen) + Agent Aptitudes & Draft Phase + Game Instances (Template-Klonen) + Epoch-Einladungen + Realtime Chat + Zyklus-E-Mail-Benachrichtigungen + Platform Admin Panel (Benutzerverwaltung, Cache-Steuerung, Datenbereinigung) + How-to-Play Tutorial + ECharts Intelligence Report + Embassies & Ambassadors + Agent Relationships + Event Echoes + Cartographer's Map (2D SVG Force-Directed Graph mit Starfield, Spielinstanz-Visualisierung) + Game Systems (Materialized Views, Bleed-Pipeline) + The Chronicle (KI-generierte Broadsheet-Zeitung pro Simulation) + Agent Memory & Reflection (Stanford Generative Agents, pgvector Embeddings). Slug-basierte URLs. 62+ Migrationen. 8 Theme-Presets. 27 Features (10 Kern + 17 Neubau). 2279 lokalisierte UI-Strings (EN/DE). 160 Tasks. Alle Bilder via Replicate AI generiert (AVIF). Production deployed auf Railway + hosted Supabase. (Siehe [19_DEPLOYMENT_INFRASTRUCTURE.md](./19_DEPLOYMENT_INFRASTRUCTURE.md))

---

## Vision

Die **metaverse.center Multi-Simulations-Plattform** ist ein Neuaufbau des bestehenden Velgarien-Projekts. Statt einer einzelnen hartcodierten dystopischen Welt wird eine **generische Plattform** geschaffen, auf der beliebig viele Weltensimulationen erstellt, konfiguriert und verwaltet werden können.

**Velgarien** wird dabei zur **ersten Simulation** und Referenz-Implementation auf dieser Plattform.

### Kern-Konzept

```
Plattform (Multi-Tenancy)
├── Simulation "Velgarien" (dystopisch, brutalist theme)
│   ├── 8 Agenten, 6 Gebäude, 6 Events, 3 Zonen, 1 Stadt
│   ├── Eigene Enums, Prompts, Design, Integrationen
│   └── Eigene AI-Modelle und Konfiguration
├── Simulation "The Gaslit Reach" (Sunless Sea/Fallen London dark fantasy)
│   ├── 6 Agenten, 8 Gebäude, 4 Zonen, 1 Stadt
│   └── Gaslit-Fantasy Theme, viktorianisch-subterrane Ästhetik
├── Simulation "Station Null" (sci-fi horror, deep space)
│   ├── 6 Agenten, 7 Gebäude, 4 Zonen, 1 Stadt
│   └── Deep-Space-Horror Theme, Alien meets Tarkovsky
├── Simulation "Speranza" (post-apokalyptisch, Arc Raiders)
│   ├── 6 Agenten, 10 Gebäude, 4 Zonen, 1 Stadt
│   └── Arc-Raiders Theme, warmes Pergament + goldener Bernstein
├── Simulation "Cité des Dames" (feministische literarische Utopie)
│   ├── 6 Agenten, 10 Gebäude, 4 Zonen, 1 Stadt
│   ├── Christine de Pizan, Mary Wollstonecraft, Hildegard von Bingen
│   ├── Sor Juana, Ada Lovelace, Sojourner Truth
│   └── Illuminated-Literary Theme (erstes Light-Theme), Vellum + Ultramarin
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
| **Datenbank** | Supabase (PostgreSQL) | 46 Tabellen, 6 Views, 6 Materialized Views |
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

### Feature-Übersicht (bestehend + Neubau)

#### Kern-Features (aus Altsystem migriert)

1. **Agenten-Management** - CRUD, Professionen, Portraits, Beschreibungen (AI-generiert)
2. **Gebäude-Management** - CRUD, Bilder (AI-generiert), Agent-Zuweisungen
3. **Events-System** - CRUD, AI-Generierung, Agenten-Reaktionen
4. **Chat-System** - User-Agent ↔ Welt-Agent Konversationen mit AI Memory
5. **Social Trends** - News-Integration, Kampagnen, Propaganda-System
6. **Facebook-Integration** - Post-Import, Transformation, Sentiment-Analyse
7. **Städte & Zonen** - Geographische Hierarchie mit GeoJSON
8. **User-Agents** - Eigene Agenten erstellen, Portraits generieren
9. **AI-Generation** - Texte, Beschreibungen, Bilder, Events per AI
10. **Prompt-Management** - Templates, Variablen, Customization pro Simulation + Sprache

#### Neue Features (Neubau)

11. **Competitive Epochs** - PvP-Gameplay mit Operativen (Spion, Wächter, Saboteur, Propagandist, Infiltrator, Assassine), 5-Dimensionen-Scoring, Battle Log, Allianz/Verrat-Mechanik
12. **Agent Aptitudes & Draft Phase** - Eignungswerte (3-9) pro Agent für 6 Operative-Typen, Spieler draftet Agenten vor Matchbeginn (4-8 pro Spieler)
13. **Game Instances** - Template-Klonen: Simulationen werden bei Epoch-Start atomar in balancierte Spielinstanzen geklont (normalisierte Werte), Templates bleiben unberührt
14. **Bot Players** - 5 KI-Persönlichkeitsarchetypen (Sentinel/Warlord/Diplomat/Strategist/Chaos), 3 Schwierigkeitsstufen, deterministische Entscheidungs-Engine, Dual-Mode-Chat (Template + LLM)
15. **Epoch-Einladungen** - E-Mail-basierte Spielereinladungen mit AI-generiertem Lore-Dossier, dunkle taktische HTML-E-Mails
16. **Epoch Realtime Chat** - REST + Supabase Broadcast, Dual-Channel (Epoch/Team), Präsenz-Tracking, Cycle-Ready-Signale
17. **Zyklus-E-Mail-Benachrichtigungen** - Zweisprachige taktische Briefing-E-Mails via SMTP SSL bei Zyklusauflösung/Phasenwechsel/Epoch-Abschluss, pro-Spieler Fog-of-War-konforme Daten
18. **Platform Admin Panel** - Benutzerverwaltung via SECURITY DEFINER RPC, Runtime-Cache-TTL-Steuerung, Datenbereinigung (6 Kategorien mit Vorschau-vor-Löschung), dunkle taktische HUD-Ästhetik
19. **Embassies & Ambassadors** - Cross-Sim diplomatische Gebäude, Botschafter-Agenten, `.card--embassy` Pulsring + Gradient-Hover mit per-Theme-Farben, 4-Schritt-Erstellungsassistent
20. **Agent Relationships & Event Echoes** - Intra-Sim Agenten-Graph, Cross-Sim Bleed-Mechanik (Event Echoes), probabilistischer Bleed-Schwellwert, Echo-Transformations-Pipeline
21. **Cartographer's Map** - Force-Directed SVG-Graph mit Starfield, Spielinstanz-Visualisierung (Phasenringe, Gesundheitsbögen, Sparklines, Operative-Trails), Minimap, Battle Feed, Leaderboard
22. **Game Systems** - Materialized Views (building_readiness, zone_stability, embassy_effectiveness, simulation_health), Bleed-Pipeline, berechnete Attribute
23. **How-to-Play Tutorial** - Dunkle Militärkonsolen-Ästhetik mit Regelwerk, 4 ausgearbeiteten Match-Replays, Changelog-Sektion, ECharts Intelligence Report (4 interaktive Charts: Radar, Heatmap, Strategie-Tiers, Win-Rate-Kurven)
24. **Per-Simulation Lore** - Dedizierte Lore-Seiten pro Simulation (~3500-5000 Wörter), LoreScroll-Akkordeon, AVIF-Bilder, 25 Plattform-Sektionen über 6 Kapitel
25. **SEO & Analytics** - JSON-LD Schema.org Markup, robots.txt, dynamische sitemap.xml, GA4 mit 37 Events, IndexNow, Crawler-Erkennung, Meta-Tag-Injection
26. **The Chronicle** - KI-generierte Broadsheet-Zeitung pro Simulation. Aggregiert Events, Echoes, Battle-Log-Einträge und Agenten-Reaktionen zu narrativer Prosa mit weltspezifischer Stimme. Broadsheet-Titelseiten-Layout mit Multi-Column-CSS, Drop Cap, ornamentalen Linien, theme-responsivem Zeitungskopf. Editions-Archiv-Index. Öffentlich lesbar, Editor+ generiert via OpenRouter
27. **Agent Memory & Reflection** - Stanford Generative Agents-inspirierte Memory-Loop mit pgvector-Embeddings (1536-dim, text-embedding-3-small). Agenten beobachten → speichern (mit semantischen Embeddings) → abrufen (Cosine Similarity + Importance + Recency Decay) → reflektieren. Memories werden in Chat-System-Prompts injiziert. Timeline-UI mit typendifferenzierten Einträgen (Beobachtungen: Monospace/faktisch, Reflexionen: kursiv/erhöht). Importance-Pips (1-10). Fire-and-Forget-Extraktion aus Chat-Austauschen

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
| ~~02_DATABASE_SCHEMA_LEGACY.md~~ | *(Archiviert als `_02_...`, Alt-Schema nicht mehr relevant)* |
| [03_DATABASE_SCHEMA_NEW.md](./03_DATABASE_SCHEMA_NEW.md) | Neues Schema mit Simulation-Kontext (v2.9, 46 Tabellen) |
| [04_DOMAIN_MODELS.md](./04_DOMAIN_MODELS.md) | Alle Entitäten mit Simulation-Scope (v2.9) |
| [05_API_SPECIFICATION.md](./05_API_SPECIFICATION.md) | 255 Endpoints (simulation-scoped + public + admin, v2.0) |
| [06_FEATURE_CATALOG.md](./06_FEATURE_CATALOG.md) | Plattform- + Simulation-Features |
| [07_FRONTEND_COMPONENTS.md](./07_FRONTEND_COMPONENTS.md) | Komponenten + Settings-UI (v2.3) |
| [08_SIMULATION_SETTINGS.md](./08_SIMULATION_SETTINGS.md) | Komplett-Spezifikation Settings-System |
| [09_AI_INTEGRATION.md](./09_AI_INTEGRATION.md) | AI-Pipelines pro Simulation |
| [10_AUTH_AND_SECURITY.md](./10_AUTH_AND_SECURITY.md) | Auth + Rollen + Simulation-Zugang (v1.5) |
| [11_EXTERNAL_SERVICES.md](./11_EXTERNAL_SERVICES.md) | Externe Services pro Simulation |
| [12_DESIGN_SYSTEM.md](./12_DESIGN_SYSTEM.md) | Design System mit Simulation-Themes (v1.2) |
| [13_TECHSTACK_RECOMMENDATION.md](./13_TECHSTACK_RECOMMENDATION.md) | Stack-Empfehlung (v1.5) |
| [14_I18N_ARCHITECTURE.md](./14_I18N_ARCHITECTURE.md) | Mehrsprachigkeit |
| [15_MIGRATION_STRATEGY.md](./15_MIGRATION_STRATEGY.md) | Migration Velgarien → Multi-Plattform |
| [16_TESTING_STRATEGY.md](./16_TESTING_STRATEGY.md) | Test-Pyramide, Coverage, CI-Integration |
| [17_IMPLEMENTATION_PLAN.md](./17_IMPLEMENTATION_PLAN.md) | 160 Tasks, 6 Phasen, Dependency Graph |
| [18_THEMING_SYSTEM.md](./18_THEMING_SYSTEM.md) | Per-Simulation Theming: Token-Taxonomie, 8 Presets, ThemeService |
| [19_DEPLOYMENT_INFRASTRUCTURE.md](./19_DEPLOYMENT_INFRASTRUCTURE.md) | Production-Deployment, Dev→Prod Sync, Data Migration Playbook |
| [20_RELATIONSHIPS_ECHOES_MAP.md](./20_RELATIONSHIPS_ECHOES_MAP.md) | Agent Relationships, Event Echoes, Cartographer's Map |
| [21_EMBASSIES.md](./21_EMBASSIES.md) | Embassies & Ambassadors: Cross-Sim diplomatisches Feature |
| [22A_GAME_SYSTEMS.md](./22A_GAME_SYSTEMS.md) | Game Mechanics: Materialized Views, berechnete Attribute, Bleed-System |
| [22B_EPOCHS_COMPETITIVE_LAYER.md](./22B_EPOCHS_COMPETITIVE_LAYER.md) | Competitive PvP: Epochs, Operative, Scoring, Battle Log, Chat (v1.8) |
| [23_MICROANIMATIONS.md](./23_MICROANIMATIONS.md) | Dramatische Eingangsanimationen, Stagger-Muster, Theme-aware Motion |
| [GAME_DESIGN_DOCUMENT.md](./GAME_DESIGN_DOCUMENT.md) | High-Level Game-Design-Konzept und Vision (v1.1) |
| [SIMULATION_BLUEPRINT.md](./SIMULATION_BLUEPRINT.md) | Wiederverwendbare Referenz für neue Simulationen |

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

### 3. ~~Velgarien-spezifische Design-Token-Werte fehlen~~ — GELÖST

**Gelöst durch:** Per-Simulation Theming-System (18_THEMING_SYSTEM.md). 8 Presets (cyberpunk, gaslit-fantasy, deep-space-horror, arc-raiders, illuminated-literary, brutalist, minimal, midnight) definieren konkrete Token-Werte. Simulation-Themes werden via ThemeService als CSS-Overrides auf `<velg-simulation-shell>` gesetzt. WCAG 2.1 AA Kontrast-Validierung via `theme-contrast.test.ts`.

### 4. ~~Keine dedizierte Test-Strategie~~ — GELÖST

**Gelöst durch:** `16_TESTING_STRATEGY.md` wurde erstellt mit Test-Pyramide, Coverage-Zielen, CI-Integration und Test-Daten-Strategie.
