# 01 - Platform Architecture: Multi-Simulations-Plattform

**Version:** 1.1
**Datum:** 2026-02-25
**Aenderung v1.1:** 3 Simulationen live (Velgarien, Capybara Kingdom, Station Null). Public-First-Architektur (anonymer Lesezugriff via `/api/v1/public/*`, 20 GET-Endpoints, anon-RLS-Policies).

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
│   └── System-Administratoren
│
├── Simulation A ("Velgarien")
│   ├── Settings (General, World, AI, Integration, Design, Access)
│   ├── Agenten, Gebäude, Events, Zonen, Städte
│   ├── Kampagnen, Social Trends
│   ├── Chat-Konversationen
│   ├── Prompt-Templates (DE)
│   ├── Taxonomien (deutsche Enums)
│   ├── Design-Theme (Brutalist/Dystopisch)
│   ├── Members (Owner, Admins, Editors, Viewers)
│   └── Integrationen (Facebook Page, Guardian API)
│
└── Simulation B ("Utopia Prime")
    ├── Settings (eigene Konfiguration)
    ├── Eigene Agenten, Gebäude, Events...
    ├── Prompt-Templates (EN)
    ├── Taxonomien (englische Enums)
    ├── Design-Theme (Clean/Utopisch)
    ├── Members (anderes Team)
    └── Integrationen (andere Facebook Page)
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
  content_locale: string;          // "de" - Hauptsprache für Inhalte
  additional_locales: string[];    // ["en"] - Weitere Inhalts-Sprachen
  owner_id: UUID;                  // Ersteller
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
- **Welt-Name:** z.B. "Velgarien", "Elysium", "Neo Tokyo"
- **Thema:** dystopisch, utopisch, fantasy, sci-fi, historisch, custom
- **Beschreibung:** Freitext zur Welt-Beschreibung
- **Zeitrahmen:** Gegenwart, Zukunft, Vergangenheit, fiktiv

#### 2. Eigene Taxonomien
Statt hartcodierter PostgreSQL ENUMs: Dynamische Tabellen pro Simulation.

```
Simulation "Velgarien":
  Systeme: [Politik, Militär, Klerus, Wissenschaft, Zivil]
  Professionen: [Wissenschaftler, Militär, Ingenieur, Künstler, ...]
  Gebäudetypen: [Akademie, Forschungslabor, Propagandazentrum, ...]
  Gender: [Männlich, Weiblich, Divers, Alien]

Simulation "Fantasy World":
  Systeme: [Magie, Krieger, Natur, Schatten]
  Professionen: [Magier, Ritter, Heiler, Druide, ...]
  Gebäudetypen: [Burg, Turm, Tempel, Taverne, ...]
  Gender: [Männlich, Weiblich, Nichtbinär]
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

### ADR-001: Simulation als Row-Level Tenant

**Entscheidung:** Alle Entitäten in derselben Datenbank, isoliert durch `simulation_id` FK + RLS Policies.

**Alternativen:**
- Separate Datenbank pro Simulation → Zu hoher Overhead
- Separate Schemas pro Simulation → Komplex bei Migrationen
- Row-Level mit `simulation_id` → ✅ Gewählt

**Begründung:** Supabase unterstützt RLS nativ. Row-Level-Isolation bietet gute Balance zwischen Isolation und Einfachheit. Migrations wirken auf alle Simulationen gleichzeitig.

### ADR-002: Settings als Key-Value Store

**Entscheidung:** Settings als `simulation_settings(simulation_id, category, setting_key, setting_value)` Tabelle.

**Begründung:** Maximale Flexibilität. Neue Settings können ohne Schema-Migration hinzugefügt werden. Kategorisierung ermöglicht effiziente Abfragen.

### ADR-003: Taxonomien als dynamische Tabellen

**Entscheidung:** Statt PostgreSQL ENUMs → `simulation_taxonomies` Tabelle mit `(simulation_id, taxonomy_type, value, label, sort_order)`.

**Begründung:** ENUMs erfordern Schema-Migrationen zum Ändern. Dynamische Tabellen erlauben Änderungen per UI ohne Deployment.

### ADR-004: Prompt-Templates pro Simulation + Locale

**Entscheidung:** `prompt_templates(simulation_id, template_type, locale, content, ...)`.

**Begründung:** Ermöglicht simulation-spezifische und sprachspezifische Prompts ohne Code-Änderungen. Fallback-Kette: Simulation+Locale → Simulation+Default-Locale → Plattform-Default.

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
