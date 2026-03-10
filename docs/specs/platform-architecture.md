---
title: "Platform Architecture: Multi-Simulations-Plattform"
id: platform-architecture
version: "2.2"
date: 2026-03-10
lang: de
type: spec
status: active
tags: [architecture, multi-tenancy, simulation-isolation]
---

# 01 - Platform Architecture: Multi-Simulations-Plattform

---

## Multi-Tenancy-Modell

### Konzept: Simulation als isolierter Kontext

Jede **Simulation** ist ein vollständig isolierter Kontext innerhalb der Plattform. Alle Daten, Konfigurationen und Integrationen gehören zu genau einer Simulation.

```
Plattform
│
├── Plattform-Konfiguration (global)
│   ├── Default AI-Modelle
│   ├── Default Design-Tokens
│   ├── Default Prompts (EN)
│   ├── System-Administratoren
│   ├── platform_settings (Key-Value Runtime-Config)
│   └── Competitive Layer (Epochs, Scoring, Bot-Spieler)
│
├── Simulation 1 — "Velgarien" (dystopisch-brutalistisch, dark theme)
│   ├── Settings (General, World, AI, Integration, Design, Access)
│   ├── Agenten, Gebäude, Events, Zonen, Städte
│   ├── Agenten-Aptitudes (6 Operativ-Typen × Score 3–9)
│   ├── Kampagnen, Social Trends
│   ├── Chat-Konversationen
│   ├── Prompt-Templates (DE)
│   ├── Taxonomien (deutsche Enums)
│   ├── Design-Theme (Brutalist/Dystopisch)
│   ├── Members (Owner, Admins, Editors, Viewers)
│   └── Integrationen (Facebook Page, Guardian API)
│
├── Simulation 2 — "The Gaslit Reach" (Sunless Sea/Fallen London, dark theme)
│   ├── Eigene Agenten, Gebäude, Events...
│   ├── Design-Theme (Gaslamp Fantasy)
│   └── Botschaften (Cross-Sim-Diplomatie)
│
├── Simulation 3 — "Station Null" (Deep-Space-Horror, dark theme)
│   ├── Eigene Agenten, Gebäude, Events...
│   └── Design-Theme (Sci-Fi Horror)
│
├── Simulation 4 — "Speranza" (Post-Apokalyptisch, dark theme)
│   ├── Eigene Agenten, Gebäude, Events...
│   └── Design-Theme (Arc Raiders / Parchment-Amber)
│
└── Simulation 5 — "Cité des Dames" (Feministische Literatur-Utopie, light theme)
    ├── Eigene Agenten, Gebäude, Events...
    └── Design-Theme (Illuminated-Literary / Vellum-Ultramarin)
```

### Data Isolation

**Grundprinzip:** Alle Entitäten tragen eine `simulation_id` FK. Kein Datensatz existiert ohne Simulation-Zuordnung.

```sql
-- Jede Query wird automatisch nach simulation_id gefiltert
SELECT * FROM agents WHERE simulation_id = :sim_id;
SELECT * FROM buildings WHERE simulation_id = :sim_id;
SELECT * FROM events WHERE simulation_id = :sim_id;

-- RLS Policy erzwingt Isolation auf DB-Ebene
CREATE POLICY simulation_isolation ON agents
  USING (simulation_id IN (
    SELECT simulation_id FROM simulation_members
    WHERE user_id = auth.uid()
  ));
```

---

## Simulation als Top-Level-Entity

### Simulation Lifecycle

```
[Erstellen] → [Konfigurieren] → [Aktivieren] → [Betrieb] → [Archivieren]
     │              │                  │              │              │
     ▼              ▼                  ▼              ▼              ▼
  Grunddaten    Settings         Validierung    Normaler      Read-Only
  + Owner       ausfüllen        + Freigabe     Betrieb       Snapshot
```

**Status-Übergänge:**

| Status | Beschreibung | Erlaubte Aktionen |
|--------|-------------|-------------------|
| `draft` | Erstellt, noch nicht konfiguriert | Settings bearbeiten, Daten importieren |
| `configuring` | Aktiv in Konfiguration | Alles außer öffentlicher Zugang |
| `active` | Vollständig aktiv und nutzbar | Alle Operationen |
| `paused` | Temporär pausiert | Nur Lesen, Settings bearbeiten |
| `archived` | Archiviert, Read-Only | Nur Lesen, Export |
| `deleted` | Soft-Delete | Nichts (Wiederherstellung möglich) |

### Simulation-Entity

```typescript
interface Simulation {
  id: UUID;
  name: string;                    // "Velgarien"
  slug: string;                    // "velgarien" (URL-safe)
  description: string;             // Kurzbeschreibung
  theme: string;                   // "dystopian", "utopian", "fantasy", "scifi", "custom"
  status: SimulationStatus;        // draft | configuring | active | paused | archived
  simulation_type: SimulationType; // template | game_instance | archived
  content_locale: string;          // "de" - Hauptsprache für Inhalte
  additional_locales: string[];    // ["en"] - Weitere Inhalts-Sprachen
  owner_id: UUID;                  // Ersteller
  source_template_id?: UUID;       // Nur für game_instance: Verweis auf Template
  epoch_id?: UUID;                 // Nur für game_instance: Zugehörige Epoch
  created_at: timestamptz;
  updated_at: timestamptz;
  archived_at?: timestamptz;

  // Computed
  member_count: number;
  agent_count: number;
  building_count: number;
  event_count: number;
}
```

**Simulation-Typen (Game Instance Lifecycle):**

| Typ | Beschreibung |
|-----|-------------|
| `template` | Reguläre Simulation, von Benutzern erstellt und verwaltet |
| `game_instance` | Geklonte Kopie eines Templates für eine laufende Epoch (balancierte Werte) |
| `archived` | Abgeschlossene Game-Instance, Read-Only-Snapshot |

```
Template-Simulation → clone_simulations_for_epoch() → Game Instance (balanciert)
                                                            │
                                                   Epoch abgeschlossen
                                                            │
                                                            ▼
                                                    Archived Instance
```

---

## Settings-Hierarchie

### Dreistufige Konfiguration

```
┌─────────────────────────────────────────┐
│  Plattform-Defaults (Level 0)           │
│  Definiert in: System-Konfiguration     │
│  Beispiel: Default AI-Modell, EN Prompts│
├─────────────────────────────────────────┤
│  Simulation-Settings (Level 1)          │  ← Überschreibt Plattform-Defaults
│  Definiert in: simulation_settings      │
│  Beispiel: DE Prompts, dystopisches     │
│  Theme, eigene Taxonomien               │
├─────────────────────────────────────────┤
│  User-Overrides (Level 2)               │  ← Überschreibt Simulation-Settings
│  Definiert in: user_preferences         │     (nur für persönliche Einstellungen)
│  Beispiel: Bevorzugte Sprache, Theme    │
└─────────────────────────────────────────┘
```

### Auflösungs-Reihenfolge

```python
def resolve_setting(key, simulation_id, user_id=None):
    # Level 2: User-Override (nur für UI-Preferences)
    if user_id and key in USER_OVERRIDABLE_KEYS:
        value = get_user_preference(user_id, simulation_id, key)
        if value is not None:
            return value

    # Level 1: Simulation-Setting
    value = get_simulation_setting(simulation_id, key)
    if value is not None:
        return value

    # Level 0: Plattform-Default
    return get_platform_default(key)
```

### Settings-Kategorien

| Kategorie | Scope | Beschreibung |
|-----------|-------|-------------|
| `general` | Simulation | Name, Beschreibung, Thema, Sprache |
| `world` | Simulation | Taxonomien, Enums, Welt-Regeln |
| `ai` | Simulation | Modelle, Prompts, Parameter |
| `integration` | Simulation | Externe APIs, Social Media |
| `design` | Simulation | Theme, Farben, Typography |
| `access` | Simulation | Sichtbarkeit, Rollen, Einladungen |

---

## Rollen pro Simulation

### Rollen-Hierarchie

```
Platform Admin (global)
├── Kann alle Simulationen verwalten
├── Kann Plattform-Defaults setzen
└── Kann Benutzer sperren

Simulation Owner
├── Volle Kontrolle über eigene Simulation
├── Kann Mitglieder einladen/entfernen
├── Kann Simulation löschen/archivieren
└── Kann alle Settings ändern

Simulation Admin
├── Kann Inhalte verwalten (CRUD auf alles)
├── Kann Settings ändern (außer Access)
├── Kann Mitglieder einladen (bis Editor)
└── Kann nicht: Simulation löschen, Owner ändern

Simulation Editor
├── Kann Inhalte erstellen und bearbeiten
├── Kann AI-Generierung nutzen
├── Kann Chat nutzen
└── Kann nicht: Settings ändern, Mitglieder verwalten

Simulation Viewer
├── Kann alle Inhalte lesen
├── Kann Chat nutzen (eingeschränkt)
└── Kann nicht: Inhalte ändern
```

### Permission Matrix

| Aktion | Owner | Admin | Editor | Viewer |
|--------|-------|-------|--------|--------|
| Simulation löschen | ✅ | ❌ | ❌ | ❌ |
| Settings ändern | ✅ | ✅* | ❌ | ❌ |
| Mitglieder verwalten | ✅ | ✅** | ❌ | ❌ |
| Agenten CRUD | ✅ | ✅ | ✅ | ❌ |
| Events CRUD | ✅ | ✅ | ✅ | ❌ |
| Gebäude CRUD | ✅ | ✅ | ✅ | ❌ |
| AI-Generierung | ✅ | ✅ | ✅ | ❌ |
| Chat nutzen | ✅ | ✅ | ✅ | ✅*** |
| Inhalte lesen | ✅ | ✅ | ✅ | ✅ |

*Admin kann keine Access-Settings ändern
**Admin kann nur bis Editor einladen
***Viewer hat eingeschränkten Chat-Zugang

---

## Simulation-spezifische Konfiguration

### Übersicht aller konfigurierbaren Bereiche

#### 1. Welt-Definition
- **Welt-Name:** z.B. "Velgarien", "The Gaslit Reach", "Station Null", "Speranza", "Cité des Dames"
- **Thema:** dystopisch, utopisch, fantasy, sci-fi, historisch, custom
- **Beschreibung:** Freitext zur Welt-Beschreibung
- **Zeitrahmen:** Gegenwart, Zukunft, Vergangenheit, fiktiv

#### 2. Eigene Taxonomien
Statt hartcodierter PostgreSQL ENUMs: Dynamische Tabellen pro Simulation.

```
Simulation "Velgarien" (Dystopisch):
  Systeme: [Politik, Militär, Klerus, Wissenschaft, Zivil]
  Professionen: [Wissenschaftler, Militär, Ingenieur, Künstler, ...]
  Gebäudetypen: [Akademie, Forschungslabor, Propagandazentrum, ...]
  Gender: [Männlich, Weiblich, Divers, Alien]

Simulation "The Gaslit Reach" (Gaslamp Fantasy):
  Systeme: [Handel, Mycologie, Admiralität, Archiv]
  Professionen: [Händler, Sporologe, Admiral, Archivar, ...]
  Gebäudetypen: [Archiv, Sporokarp, Handelsposten, Glockenturm, ...]
  Gender: [Männlich, Weiblich, Nichtbinär]

Simulation "Station Null" (Sci-Fi Horror):
  Systeme: [Forschung, Sicherheit, Technik, Medizin]
  Professionen: [Forscher, Sicherheitsoffizier, Techniker, Mediziner, ...]
  Gebäudetypen: [Labor, Kontrollraum, Reaktor, Medbay, ...]

Simulation "Speranza" (Post-Apokalyptisch):
  Systeme: [Verteidigung, Handel, Erkundung, Handwerk]
  Professionen: [Kundschafter, Mechaniker, Heiler, Wächter, ...]
  Gebäudetypen: [Werkstatt, Markt, Wachturm, Lazarett, ...]

Simulation "Cité des Dames" (Literarische Utopie):
  Systeme: [Schrift, Wissenschaft, Gerechtigkeit, Mystik]
  Professionen: [Autorin, Gelehrte, Philosophin, Naturkundlerin, ...]
  Gebäudetypen: [Bibliothek, Skriptorium, Observatorium, Tribunal, ...]
```

#### 3. AI-Konfiguration
- **Text-Modelle:** Pro Generierungs-Zweck wählbar
- **Bild-Modelle:** Pro Bildtyp wählbar
- **Prompt-Templates:** Pro Simulation und Sprache anpassbar
- **Parameter:** Temperatur, Max-Tokens etc.

#### 4. Design/Theme
- **Farbschema:** Primary, Secondary, Accent, Background, Text
- **Typography:** Font-Familie, Sizes, Weights
- **Eigenes Logo/Header**
- **Custom CSS-Variablen**

#### 5. Externe Integrationen
- **Social Media:** Eigene Facebook-Page, Twitter-Account etc.
- **News-Quellen:** Eigene API-Keys, eigene Quellen
- **API-Keys:** Verschlüsselt pro Simulation gespeichert

#### 6. Zugangs-Kontrolle
- **Öffentlich/Privat:** Simulation öffentlich sichtbar oder nur für Mitglieder
- **Einladungs-Links:** Zeitlich begrenzte Einladungen
- **Registrierung:** Offen oder nur auf Einladung

---

## Architektur-Entscheidungen

Siehe [docs/adr/](../adr/README.md) fuer alle Architecture Decision Records (ADR-001 bis ADR-007).

---

## Competitive Layer (Epochs)

### Übersicht

Die Competitive Layer ist das zentrale PvP-System der Plattform. Spieler treten mit ihren Simulationen in zeitlich begrenzten Wettkämpfen (Epochs) gegeneinander an.

```
┌──────────────────────────────────────────────────────────┐
│  Epoch Lifecycle                                         │
│                                                          │
│  [Lobby] → [Draft] → [Active: Zyklen] → [Abgeschlossen] │
│     │         │            │                    │        │
│     ▼         ▼            ▼                    ▼        │
│  Spieler   Agenten      Operativ-          Archivierung  │
│  einladen  wählen       Einsätze +         + Endwertung  │
│  + Bots               Zyklus-Auflösung                   │
│  hinzufügen                                              │
└──────────────────────────────────────────────────────────┘
```

### Datenmodell

| Tabelle | Beschreibung |
|---------|-------------|
| `game_epochs` | Epoch-Definition (Phase, Zyklen, Config inkl. `max_agents_per_player`) |
| `epoch_teams` | Team-Zuordnung innerhalb einer Epoch |
| `epoch_participants` | Spieler-Teilnahme (RP-Budget, `drafted_agent_ids`, `is_bot`, `bot_player_id`) |
| `operative_missions` | Eingesetzte Operativ-Missionen pro Zyklus |
| `epoch_scores` | 5-Dimensionen-Scoring pro Zyklus |
| `battle_log` | Kampfprotokoll aller Aktionen |
| `epoch_chat_messages` | Epoch-Chat (ALL CHANNELS + TEAM FREQ) |
| `epoch_invitations` | E-Mail-Einladungen mit Lore-generiertem Dossier |
| `bot_players` | Wiederverwendbare Bot-Vorlagen (Persönlichkeit × Schwierigkeit) |
| `bot_decision_log` | Zyklus-für-Zyklus Audit-Trail der Bot-Entscheidungen |

### 6 Operativ-Typen

| Typ | Effekt | RP-Kosten |
|-----|--------|-----------|
| **Spy** | Enthüllt Zone-Sicherheit + Guardian-Zahl des Ziels | 3 |
| **Guardian** | Verteidigt eigene Simulation (−0.06/Einheit, Cap 0.15) | 4 |
| **Saboteur** | Stuft Zone-Sicherheit des Ziels herab + Stabilitäts-Schaden | 5 |
| **Propagandist** | Erzeugt negatives Event in Ziel-Simulation + Einfluss-Gewinn | 4 |
| **Infiltrator** | Reduziert Botschafts-Effektivität um 65% für 3 Zyklen | 5 |
| **Assassin** | Blockiert Botschafter für 3 Zyklen + Souveränitäts-Schaden | 7 |

### 5-Dimensionen-Scoring

| Dimension | Misst |
|-----------|-------|
| **Stability** | Gebäude-Zustand, Zone-Sicherheit, Sabotage-Auswirkungen |
| **Influence** | Propaganda-Erfolge, Social-Media-Reichweite |
| **Sovereignty** | Agenten-Autonomie, feindliche Infiltration |
| **Diplomatic** | Botschafts-Effektivität, Allianz-Boni (15%), Verrats-Strafen (−25%) |
| **Military** | Operative Erfolge/Misserfolge, Verteidigungs-Leistung |

### Agenten-Aptitudes

Jeder Agent hat Aptitude-Werte (3–9) für alle 6 Operativ-Typen. Budget pro Agent: 36 Punkte.

```
Agent "Kommissar Petrov":
  Spy: 7  | Guardian: 5 | Saboteur: 4
  Propagandist: 8 | Infiltrator: 6 | Assassin: 6
```

**Erfolgswahrscheinlichkeit:** `aptitude × 0.03` (18 Prozentpunkte Unterschied zwischen 3 und 9).

### Draft-Phase

Vor Match-Beginn wählt jeder Spieler seine Agenten aus dem Template-Pool:
- `max_agents_per_player` konfigurierbar (4–8, Standard 6)
- `drafted_agent_ids UUID[]` auf `epoch_participants`
- Bot-Spieler draften automatisch basierend auf Persönlichkeits-Gewichtung

### Bot-Spieler

5 KI-Persönlichkeits-Archetypen × 3 Schwierigkeitsgrade:

| Archetyp | Strategie |
|----------|----------|
| **Sentinel** | Defensiv, Guardian-lastig |
| **Warlord** | Aggressiv, Assassin/Saboteur-fokussiert |
| **Diplomat** | Allianz-orientiert, Botschafts-Ausbau |
| **Strategist** | Adaptiv, reagiert auf Gegner-Aktionen |
| **Chaos** | Unberechenbar, randomisierte Entscheidungen |

Bot-Entscheidungen werden synchron während `resolve_cycle()` via Admin-Supabase ausgeführt (kein RLS — Bots sind System-Akteure). Bots nutzen dieselben `OperativeService.deploy()` + `spend_rp()`-Methoden wie menschliche Spieler.

---

## Platform Admin

### Zugriffskontrolle

```
Platform Admin (Email-Allowlist: admin@velgarien.dev)
├── require_platform_admin() Dependency
├── get_admin_supabase() — service_role Client (injected via Depends())
│
├── Benutzer-Verwaltung
│   ├── admin_list_users() — SECURITY DEFINER RPC
│   ├── admin_get_user()  — SECURITY DEFINER RPC
│   ├── admin_delete_user() — SECURITY DEFINER RPC
│   └── Mitgliedschaft-CRUD via PostgREST
│
├── Cache-TTL-Steuerung
│   ├── platform_settings Tabelle (Key-Value)
│   ├── CacheConfigService (Singleton TTL-Reader)
│   └── Beeinflusst: Map-Daten, SEO, HTTP Cache-Control
│
├── Daten-Bereinigung (6 Kategorien)
│   ├── Abgeschlossene Epochs
│   ├── Abgebrochene Epochs
│   ├── Verwaiste Lobbies
│   ├── Archivierte Game Instances
│   ├── Audit-Log
│   └── Bot-Entscheidungsprotokoll
│
└── Resonance Auto-Processing
    ├── ResonanceScheduler (asyncio Background-Task)
    ├── Konfigurierbar via platform_settings
    │   ├── resonance_auto_process_enabled (bool, default: true)
    │   └── resonance_auto_process_interval_seconds (int, default: 60)
    └── System-Actor-Pattern (service_role Client)
```

### Zusätzliche Tabellen

| Tabelle | Beschreibung |
|---------|-------------|
| `platform_settings` | Key-Value Runtime-Konfiguration (RLS: nur service_role) |
| `notification_preferences` | Pro-Benutzer E-Mail-Opt-in/Opt-out (cycle_resolved, phase_changed, epoch_completed) |
| `agent_aptitudes` | Aptitude-Werte pro Agent für 6 Operativ-Typen (3–9, Budget 36) |

---

## Account Tier System

### Plattform-Level Zugangssteuerung

Account Tiers steuern den Zugang zur Forge (Simulations-Erstellung) und sind **plattform-weit** — unabhaengig von Simulation Roles (owner/admin/editor/viewer), die simulationsbezogen sind.

```
Observer (Default)          → Read-Only, Browsing, Community-Teilnahme
     │
     ▼  [Forge Access Request]
Architect                   → Forge-Zugang, Simulation-Erstellung, AI-Generierung
     │
     ▼  [Future]
Director                    → Erweiterte Admin-Faehigkeiten (zukuenftig)
```

### Request/Approve/Reject Workflow

1. Benutzer stellt Antrag via `forge_access_requests` Tabelle (Status: `pending`)
2. Admin-Benachrichtigungs-Email wird ausgeloest (best-effort, non-blocking) mit Applicant-Email und Begruendung
3. Platform Admin prueft Antraege ueber Admin Panel (`v_pending_forge_requests` View)
4. Genehmigung erfolgt atomar via `fn_approve_forge_access` (SECURITY DEFINER RPC):
   - Setzt `forge_access_requests.status = 'approved'`
   - Aktualisiert `user_wallets.account_tier`
   - `is_architect` Boolean wird per DB-Trigger gepflegt (Backward Compat)
5. Bilingual E-Mail-Benachrichtigung (EN/DE) bei Genehmigung oder Ablehnung

### Datenmodell

| Tabelle / View | Beschreibung |
|----------------|-------------|
| `user_wallets.account_tier` | Aktueller Tier des Benutzers (`observer` / `architect` / `director`) |
| `forge_access_requests` | Antraege mit Status-Tracking und Admin-Notizen |
| `v_pending_forge_requests` | View: Offene Antraege mit `user_email` (Admin-Ansicht) |
| `fn_approve_forge_access` | SECURITY DEFINER RPC fuer atomare Genehmigung |

### Abgrenzung: Account Tier vs. Simulation Roles

| Aspekt | Account Tier | Simulation Role |
|--------|-------------|-----------------|
| Scope | Plattform-weit | Pro Simulation |
| Steuert | Forge-Zugang, Simulations-Erstellung | CRUD-Berechtigungen innerhalb einer Simulation |
| Gespeichert in | `user_wallets.account_tier` | `simulation_members.member_role` |
| Verwaltet durch | Platform Admin (Request/Approve) | Simulation Owner/Admin (Einladung) |
| Werte | observer, architect, director | owner, admin, editor, viewer |

---

## Erweiterte Auth-Patterns

### Autorisierungs-Hierarchie

```python
# Standard: Simulation-Mitglied mit Mindest-Rolle
require_role("admin")               # → Depends(), prüft simulation_members

# Epoch-Ersteller: Besitz-Prüfung auf game_epochs
require_epoch_creator()             # → Depends(), prüft epoch.created_by == user.id

# Simulation-Mitglied über Query-Parameter (für plattform-weite Endpoints)
require_simulation_member("editor") # → Depends(), prüft Rolle via query param

# Platform Admin: Email-Allowlist (admin@velgarien.dev)
require_platform_admin()            # → Depends(), prüft email + get_admin_supabase()
```

### Public-First-Architektur

58 Endpoints unter `/api/v1/public/*`:
- Keine Authentifizierung erforderlich
- Rate-Limited (100/min)
- Nutzt `get_anon_supabase()` (anon-RLS-Policies)
- Slug-basierte URL-Auflösung: `/api/v1/public/simulations/by-slug/{slug}`
- Epoch-Einladungs-Validierung: `/api/v1/public/epoch-invitations/{token}`
- Globaler Battle-Feed: `/api/v1/public/battle-feed`

---

## Kommunikations-Architektur

### Request-Flow

```
Client Request
    │
    ▼
┌──────────────────┐
│  API Gateway      │
│  - Auth Check     │
│  - Rate Limiting  │
│  - CORS           │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Simulation       │
│  Context Resolver │
│  - simulation_id  │
│  - user_role      │
│  - locale         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Service Layer    │
│  - Business Logic │
│  - Settings Res.  │
│  - Prompt Res.    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Data Layer       │
│  - Supabase       │
│  - RLS enforced   │
│  - simulation_id  │
│  - scoped queries │
└──────────────────┘
```

### Simulation Context

Jeder Request innerhalb einer Simulation trägt einen Kontext:

```typescript
interface SimulationContext {
  simulationId: UUID;
  userId: UUID;
  userRole: SimulationRole;     // owner | admin | editor | viewer
  locale: string;               // "de"
  contentLocale: string;        // "de" (Simulation's content language)
  settings: ResolvedSettings;   // Pre-resolved settings for this simulation
}
```

Dieser Kontext wird:
1. Aus dem URL-Parameter (`/api/v1/simulations/:simId/...`) extrahiert
2. Gegen die `simulation_members` Tabelle validiert
3. An alle Service-Methoden weitergegeben
4. Von RLS-Policies auf DB-Ebene erzwungen
