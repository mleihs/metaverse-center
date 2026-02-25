# 14 - I18N Architecture: Mehrsprachigkeit auf 3 Ebenen

**Version:** 1.3
**Datum:** 2026-02-25
**Aenderung v1.3:** 893 UI-Strings lokalisiert (EN/DE) inkl. LoreScroll-Akkordeon, Station-Null-Lore, Deep-Space-Horror-Theme-Label. 100% deutsche Abdeckung.
**Aenderung v1.2:** Ebene 1 (Plattform-UI) vollstaendig implementiert — 875 Strings mit msg() gewrappt, DE-Uebersetzungen in XLIFF, Locale-Toggle in PlatformHeader, FormatService fuer Datum/Zahlen
**Änderung v1.1:** @lit/localize Modus von Build-Time auf Runtime korrigiert

---

## Ubersicht

Die Internationalisierung betrifft drei unabhangige Ebenen, die jeweils eigene Mechanismen verwenden:

```
┌─────────────────────────────────────────────────────┐
│ Ebene 1: Plattform-UI                              │
│ - Alle UI-Strings (Buttons, Labels, Fehlermeldungen)│
│ - @lit/localize (Runtime-Mode)                      │
│ - Dateien: locales/{lang}.json                      │
│ - Sprache: Benutzer-Praferenz                       │
├─────────────────────────────────────────────────────┤
│ Ebene 2: Simulations-Inhalte                        │
│ - Agenten, Events, Gebaude, Taxonomien              │
│ - DB: Inhalte in Simulations-Sprache                │
│ - Setting: simulation.content_locales               │
│ - Sprache: Pro Simulation konfiguriert              │
├─────────────────────────────────────────────────────┤
│ Ebene 3: AI-Prompts                                 │
│ - Alle 22 Generierungs-Prompts                      │
│ - DB: prompt_templates mit locale-Feld              │
│ - System-Prompt: "Antworte auf {locale_name}"       │
│ - Sprache: Pro Simulation + Template-Typ            │
└─────────────────────────────────────────────────────┘
```

---

## Status: Ebene 1 IMPLEMENTIERT

### Frontend: Alle Strings mit msg() gewrappt

**875 UI-Strings** in 68 Komponenten + 3 Services mit `msg()` / `msg(str\`...\`)` gewrappt.
Komplette deutsche Uebersetzung in XLIFF (875 trans-units) und generiertem `de.ts`.

| Bereich | Dateien | Strings |
|---------|---------|---------|
| Shared Components | 11 | ~30 |
| Auth | 2 | ~20 |
| Layout | 3 | ~10 |
| Platform | 7 | ~70 |
| Agents | 4 | ~50 |
| Buildings | 4 | ~45 |
| Events | 4 | ~35 |
| Chat | 6 | ~25 |
| Social | 13 | ~50 |
| Locations | 5 | ~20 |
| Settings | 8 | ~130 |
| Services | 3 | ~25 |
| **Gesamt** | **68+3** | **~875** |

### Fruehere Probleme (GELOEST)

Die folgenden Probleme aus dem Altsystem sind im Rebuild vollstaendig behoben:
- Keine hardcodierten deutschen Strings mehr in Komponenten
- Alle UI-Strings sind Englisch (Source Locale) mit `msg()` gewrappt
- Deutsche Uebersetzungen dynamisch via `@lit/localize` Runtime Mode
- GenerationProgressService nutzt `msg()` statt manueller Locale-Abfrage

### Backend: Gemischte Prompt-Sprachen

| Prompt | Datei | Sprache |
|--------|-------|---------|
| Agent-Beschreibung (komplett) | generate_service.py:262-266 | Englisch |
| Agent-Beschreibung (partiell) | generate_service.py:288-296 | Englisch |
| Building-Beschreibung | generate_service.py:553-559 | Englisch |
| Portrait-Beschreibung | generate_service.py:794-796 | Englisch |
| Event-Generierung | generate_service.py:915-917 | Englisch |
| Chat System-Prompt | generate_service.py:1246-1259 | **Deutsch** |
| Chat mit Memory | generate_service.py:1410-1440 | **Deutsch** |
| News-Transformation | news_service.py:437-453 | **Deutsch** |
| Agent-Reaktion auf News | news_service.py:563-577 | **Deutsch** |
| Social Trends Kampagne | social_trends_service.py:579-602 | **Deutsch** |
| FB Post-Transformationen (7x) | facebook_integration_prompts.py | **Deutsch** |

### Datenbank: Gemischte Enum-Sprachen

| Objekt | Sprache | Werte |
|--------|---------|-------|
| `gender_type` Enum | Deutsch | mannlich, weiblich, divers, alien |
| `profession_type` Enum | Deutsch | wissenschaftler, fuhrungsperson, militar, ... |
| `building_special_type` Enum | Deutsch | akademie_der_wissenschaften, ... |
| `urgency_level` CHECK | Deutsch | NIEDRIG, MITTEL, HOCH, KRITISCH |
| `target_demographic` CHECK | Deutsch | Bildungssektor, Arbeitende Bevolkerung, ... |
| `propaganda_type` CHECK | Englisch | surveillance, control, distraction, ... |
| `zone_type` CHECK | Englisch | residential, commercial, industrial, ... |
| `security_level` CHECK | Englisch | low, medium, high, restricted |
| `sentiment` CHECK | Englisch | positive, negative, neutral, mixed |

### Datenbank: Gemischte Spaltennamen

| Tabelle | Deutsch | Englisch |
|---------|---------|----------|
| `agents` | `charakter`, `hintergrund` | `name`, `description`, `created_at` |
| `events` | (keine) | `title`, `description`, `type` |
| `buildings` | (keine) | `name`, `description`, `type` |

---

## Ebene 1: Plattform-UI Internationalisierung

### Technologie: @lit/localize

```
Runtime Translations (Empfohlen)
  │
  ├── Dynamischer Locale-Wechsel ohne Page-Reload
  ├── Typ-sichere Translation-Keys via msg()
  ├── Automatische Extraktion aus Templates (@lit/localize-tools)
  ├── Lazy-Loading von Locale-Dateien (kleine initiale Bundle-Size)
  └── Ideal für Multi-Simulations-Plattform (Locale kann pro Simulation wechseln)
```

> **Warum Runtime statt Build-Time?** Build-Time erzeugt separate Bundles pro Sprache und erfordert einen Page-Reload beim Sprachwechsel. Da die Plattform dynamischen Locale-Wechsel unterstützen muss (Benutzer-Präferenz + Simulations-Sprache), ist Runtime-Mode die richtige Wahl. Der Runtime-Overhead ist minimal (~1kb).

### Konfiguration (Implementiert)

```json
// frontend/lit-localize.json
{
  "sourceLocale": "en",
  "targetLocales": ["de"],
  "output": {
    "mode": "runtime",
    "outputDir": "src/locales/generated",
    "language": "ts"
  },
  "inputFiles": ["src/**/*.ts"],
  "interchange": {
    "format": "xliff",
    "xliffDir": "src/locales/xliff"
  }
}
```

### Verwendung in Komponenten

```typescript
import { msg, str } from '@lit/localize';

@customElement('velg-agents-view')
export class VelgAgentsView extends LitElement {
  render() {
    return html`
      <h1>${msg('Agents')}</h1>

      ${this.loading
        ? html`<p>${msg('Loading...')}</p>`
        : html`<p>${msg(str`${this.agents.length} agents found`)}</p>`
      }

      <button class="btn btn--primary">
        ${msg('Create Agent')}
      </button>

      ${this.error
        ? html`<p class="form-error">${msg('Failed to load agents')}</p>`
        : ''
      }
    `;
  }
}
```

### Translation-Workflow (Implementiert)

Uebersetzungen werden ueber den `@lit/localize` XLIFF-Workflow verwaltet (NICHT als JSON-Dateien):

```
1. Strings in Komponenten mit msg('English text') wrappen
2. npx lit-localize extract        → generiert/aktualisiert src/locales/xliff/de.xlf
3. Deutsche <target> in XLIFF eintragen
4. npx lit-localize build          → generiert src/locales/generated/de.ts
```

**Generierte Dateien:**
- `frontend/src/locales/generated/locale-codes.ts` — Source/Target Locale Konstanten
- `frontend/src/locales/generated/de.ts` — Hash-basierte Template-Map (875 Eintraege, auto-generiert)
- `frontend/src/locales/xliff/de.xlf` — XLIFF 1.2 Interchange-Datei (875 trans-units)

**Wichtig:** Die `de.ts` Datei wird automatisch generiert und darf NICHT manuell bearbeitet werden.
Aenderungen erfolgen ausschliesslich ueber die XLIFF-Datei + `lit-localize build`.
Die generierten Dateien sind von Biome-Checks ausgenommen (`biome.json` negation pattern).

### Locale-Service

```typescript
// services/i18n/locale-service.ts
import { configureLocalization, LOCALE_STATUS_EVENT } from '@lit/localize';
import { sourceLocale, targetLocales, allLocales } from './generated/locales.js';

const { getLocale, setLocale } = configureLocalization({
  sourceLocale,
  targetLocales,
  loadLocale: (locale: string) => import(`./generated/${locale}.js`)
});

export class LocaleService {
  /** Aktuelle Locale */
  get currentLocale(): string {
    return getLocale();
  }

  /** Locale andern */
  async setLocale(locale: string): Promise<void> {
    await setLocale(locale);
    localStorage.setItem('preferred-locale', locale);
  }

  /** Initiale Locale bestimmen */
  getInitialLocale(): string {
    // 1. User-Praferenz
    const stored = localStorage.getItem('preferred-locale');
    if (stored && allLocales.includes(stored)) return stored;

    // 2. Browser-Sprache
    const browserLang = navigator.language.split('-')[0];
    if (allLocales.includes(browserLang)) return browserLang;

    // 3. Default
    return sourceLocale;
  }

  /** Verfugbare Locales */
  get availableLocales(): string[] {
    return [...allLocales];
  }
}

export const localeService = new LocaleService();
```

### Fallback-Kette

```
1. User-Praferenz (localStorage)
2. Browser navigator.language
3. Simulations-Default-Locale
4. Plattform-Default ('en')
```

---

## Ebene 2: Simulations-Inhalte

### Simulations-Sprach-Settings

```sql
-- In simulation_settings:
-- simulation.content_locale = 'de'          -- Hauptsprache der Simulation
-- simulation.content_locales = ['de', 'en'] -- Alle unterstutzten Sprachen
-- simulation.display_locale = 'de'          -- UI-Sprache fur Simulation
```

### Taxonomie-Labels (Mehrsprachig)

```sql
-- simulation_taxonomies speichert Labels in der Simulations-Sprache
-- Fur mehrsprachige Simulationen: JSON-Objekt mit Locale-Keys

-- Beispiel: Velgarien (Deutsch)
INSERT INTO simulation_taxonomies VALUES
  (uuid, sim_id, 'system', 'politics', 'Politik', 1),
  (uuid, sim_id, 'system', 'military', 'Militar', 2),
  (uuid, sim_id, 'system', 'clergy', 'Klerus', 3),
  (uuid, sim_id, 'system', 'science', 'Wissenschaft', 4),
  (uuid, sim_id, 'system', 'civilian', 'Zivilbevolkerung', 5);

-- Beispiel: Utopia (Englisch)
INSERT INTO simulation_taxonomies VALUES
  (uuid, sim_id, 'system', 'council', 'Council', 1),
  (uuid, sim_id, 'system', 'research', 'Research', 2),
  (uuid, sim_id, 'system', 'arts', 'Arts & Culture', 3);
```

### Inhalts-Generierung in Simulations-Sprache

```python
class GenerationService:
    def generate_agent(self, agent_data: dict) -> dict:
        # Simulations-Sprache bestimmen
        locale = self.sim.get_content_locale()  # z.B. 'de'
        locale_name = self.sim.get_locale_name()  # z.B. 'Deutsch'

        # Prompt in der passenden Sprache laden
        template = self.prompt_resolver.resolve(
            self.sim.id,
            'agent_generation',
            locale  # Prompt-Sprache = Simulations-Sprache
        )

        # Sprach-Instruktion immer im Prompt
        variables = {
            'locale_name': locale_name,
            'locale_code': locale,
            # ... weitere Variablen
        }

        prompt = template.format(**variables)
        # → Prompt enthalt z.B. "Antworte auf Deutsch."
```

### Schema-Sprache: Einheitlich Englisch

Alle Tabellen- und Spaltennamen sind auf Englisch. **Migration-Mapping:**

| Alt (Deutsch) | Neu (Englisch) |
|--------------|----------------|
| `agents.charakter` | `agents.character` |
| `agents.hintergrund` | `agents.background` |
| `gender_type: 'mannlich'` | `taxonomy: value='male', label='mannlich'` |
| `gender_type: 'weiblich'` | `taxonomy: value='female', label='weiblich'` |
| `gender_type: 'divers'` | `taxonomy: value='diverse', label='divers'` |
| `gender_type: 'alien'` | `taxonomy: value='alien', label='alien'` |
| `profession_type: 'wissenschaftler'` | `taxonomy: value='scientist', label='Wissenschaftler'` |
| `profession_type: 'fuhrungsperson'` | `taxonomy: value='leader', label='Fuhrungsperson'` |
| `profession_type: 'militar'` | `taxonomy: value='military', label='Militar'` |
| `profession_type: 'ingenieur'` | `taxonomy: value='engineer', label='Ingenieur'` |
| `profession_type: 'kunstler'` | `taxonomy: value='artist', label='Kunstler'` |
| `profession_type: 'mediziner'` | `taxonomy: value='medic', label='Mediziner'` |
| `profession_type: 'sicherheitspersonal'` | `taxonomy: value='security', label='Sicherheitspersonal'` |
| `profession_type: 'verwaltung'` | `taxonomy: value='administration', label='Verwaltung'` |
| `profession_type: 'handwerker'` | `taxonomy: value='craftsman', label='Handwerker'` |
| `profession_type: 'spezialist'` | `taxonomy: value='specialist', label='Spezialist'` |
| `building_special_type: 'akademie_der_wissenschaften'` | `taxonomy: value='academy_of_sciences', label='Akademie der Wissenschaften'` |
| `urgency: 'NIEDRIG'` | `taxonomy: value='low', label='Niedrig'` |
| `urgency: 'MITTEL'` | `taxonomy: value='medium', label='Mittel'` |
| `urgency: 'HOCH'` | `taxonomy: value='high', label='Hoch'` |
| `urgency: 'KRITISCH'` | `taxonomy: value='critical', label='Kritisch'` |

**Prinzip:** `value` ist immer englisch (maschinell), `label` ist in der Simulations-Sprache (fur Menschen).

---

## Ebene 3: AI-Prompts

### Prompt-Template-Tabelle

```sql
CREATE TABLE prompt_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_id uuid REFERENCES simulations(id) ON DELETE CASCADE,
    template_type text NOT NULL,
    locale text NOT NULL DEFAULT 'en',
    prompt_content text NOT NULL,
    system_prompt text,
    variables text[],
    is_default boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(simulation_id, template_type, locale)
);
```

### Prompt-Auflosungs-Kette

```python
class PromptResolver:
    def resolve(self, simulation_id: UUID, template_type: str, locale: str = None) -> PromptTemplate:
        """
        Auflosungsreihenfolge:
        1. Simulation + gewunschtes Locale
        2. Simulation + Default-Locale der Simulation
        3. Plattform-Default + gewunschtes Locale
        4. Plattform-Default + 'en'
        5. Hardcoded Fallback (letzte Absicherung)
        """
        locale = locale or self.get_simulation_locale(simulation_id)

        # 1. Simulation + Locale
        template = self.db.get_template(simulation_id, template_type, locale)
        if template:
            return template

        # 2. Simulation + Default-Locale
        default_locale = self.get_simulation_locale(simulation_id)
        if locale != default_locale:
            template = self.db.get_template(simulation_id, template_type, default_locale)
            if template:
                return template

        # 3. Plattform-Default + Locale
        template = self.db.get_template(None, template_type, locale)
        if template:
            return template

        # 4. Plattform-Default + EN
        template = self.db.get_template(None, template_type, 'en')
        if template:
            return template

        # 5. Hardcoded Fallback
        return self.get_hardcoded_fallback(template_type)
```

### Sprach-Instruktion in System-Prompts

```python
def build_system_prompt(template: PromptTemplate, locale: str) -> str:
    """Fugt Sprach-Instruktion zum System-Prompt hinzu."""
    locale_names = {
        'de': 'Deutsch',
        'en': 'English',
        'fr': 'Francais',
        'es': 'Espanol',
        'it': 'Italiano',
        'pt': 'Portugues',
        'nl': 'Nederlands',
        'pl': 'Polski',
        'ja': 'Japanese',
        'zh': 'Chinese'
    }

    locale_name = locale_names.get(locale, locale)

    # System-Prompt + Sprach-Instruktion
    system = template.system_prompt or ''
    language_instruction = f"\n\nIMPORTANT: Always respond in {locale_name}."

    return system + language_instruction
```

### Alle 22 Prompts als lokalisierte Templates

| # | Template-Type | DE | EN | Beschreibung |
|---|--------------|----|----|-------------|
| 1 | `agent_generation_full` | Seed | Seed | Agent komplett generieren |
| 2 | `agent_generation_partial` | Seed | Seed | Agent teilweise generieren |
| 3 | `building_generation_named` | Seed | Seed | Gebaude mit Name |
| 4 | `building_generation` | Seed | Seed | Gebaude ohne Name |
| 5 | `portrait_description` | Seed | Seed | Portrait-Beschreibung |
| 6 | `event_generation` | Seed | Seed | Event generieren |
| 7 | `chat_system_prompt` | Seed | Seed | Chat System-Prompt |
| 8 | `chat_with_memory` | Seed | Seed | Chat mit Memory |
| 9 | `news_transformation` | Seed | Seed | News transformieren |
| 10 | `news_agent_reaction` | Seed | Seed | Agent-Reaktion auf News |
| 11 | `social_trends_campaign` | Seed | Seed | Kampagne generieren |
| 12 | `social_media_transform_dystopian` | Seed | Seed | FB Post dystopisch |
| 13 | `social_media_transform_propaganda` | Seed | Seed | FB Post Propaganda |
| 14 | `social_media_transform_surveillance` | Seed | Seed | FB Post Surveillance |
| 15 | `social_media_sentiment_detailed` | Seed | Seed | Sentiment detailliert |
| 16 | `social_media_sentiment_quick` | Seed | Seed | Sentiment schnell |
| 17 | `social_media_agent_reaction_character` | Seed | Seed | Agent-Reaktion (Charakter) |
| 18 | `social_media_agent_reaction_sentiment` | Seed | Seed | Agent-Reaktion (Sentiment) |
| 19 | `social_media_thread_analysis` | Seed | Seed | Thread-Analyse |
| 20 | `social_media_image_caption_dystopian` | Seed | Seed | Bild-Caption dystopisch |
| 21 | `social_media_image_caption_surveillance` | Seed | Seed | Bild-Caption Surveillance |
| 22 | `user_agent_description` | Seed | Seed | User-Agent Beschreibung |

**"Seed"** bedeutet: Wird als Seed-Daten bei Plattform-Setup eingefugt (simulation_id = NULL = Plattform-Default).

### Ausnahme: Negative Prompts (Bildgenerierung)

Negative Prompts fur Stable Diffusion bleiben **immer auf Englisch**, unabhangig von der Simulations-Sprache:

```python
# Diese bleiben englisch, da SD-Modelle englische Prompts erwarten
NEGATIVE_PROMPT_AGENT = "cartoon, anime, illustration, distorted, deformed, ugly, blurry"
NEGATIVE_PROMPT_BUILDING = "people, humans, characters, faces, text, watermark"
```

### Mock-/Fallback-Templates (lokalisiert)

| # | Template-Typ | DE | EN |
|---|-------------|----|----|
| M1 | `mock.agent_character` | 5 System-Varianten (DE) | 5 System-Varianten (EN) |
| M2 | `mock.agent_background` | 5 System-Varianten (DE) | 5 System-Varianten (EN) |
| M3 | `mock.portrait_roles` | 6 Rollen (DE) | 6 Rollen (EN) |
| M4 | `mock.building_descriptions` | 3x3 Varianten (DE) | 3x3 Varianten (EN) |
| M5 | `mock.event_templates` | 4 Kategorien (DE) | 4 Kategorien (EN) |
| M6 | `mock.social_trends` | 7 Trends (DE) | 7 Trends (EN) |
| M7 | `mock.twitter_trends` | 3 Trends (DE) | 3 Trends (EN) |

---

## Konkrete Ersetzungs-Tabelle

### Frontend: Hardcodierte Strings → i18n Keys

| Aktuell | Neu | Key |
|---------|-----|-----|
| `'Laden...'` (10+ Stellen) | `msg('Loading...')` | `common.loading` |
| `'Fehler bei der Portrait-Generierung'` | `msg('Error generating portrait')` | `generation.portrait.error` |
| `'Name und System sind erforderlich'` | `msg('Name and system are required')` | `agents.validation.nameSystemRequired` |
| `'Gebaude werden geladen...'` | `msg('Loading buildings...')` | `buildings.loading` |
| `'Events werden geladen...'` | `msg('Loading events...')` | `events.loading` |
| `'Trends werden geladen...'` | `msg('Loading trends...')` | `social.loading` |
| `'Nachricht senden'` | `msg('Send Message')` | `chat.sendMessage` |
| `'Keine Beschreibung verfugbar'` | `msg('No description available')` | `agents.noDescription` |
| `'Anmelden'` | `msg('Sign In')` | `auth.login` |
| `'Registrieren'` | `msg('Sign Up')` | `auth.register` |
| `'VELGARIEN'` | Dynamic: `simulation.name` | - |
| `'Speichern'` | `msg('Save')` | `common.save` |
| `'Abbrechen'` | `msg('Cancel')` | `common.cancel` |
| `'Loschen'` | `msg('Delete')` | `common.delete` |
| `'Bearbeiten'` | `msg('Edit')` | `common.edit` |

### Backend: Hardcodierte Prompts → prompt_templates

| Aktuell | Neu |
|---------|-----|
| `generate_service.py:262-266` (EN inline) | `prompt_templates WHERE type='agent_generation_full' AND locale='en'` |
| `generate_service.py:1246-1259` (DE inline) | `prompt_templates WHERE type='chat_system_prompt' AND locale='de'` |
| `config.py:151-167` (DE inline) | `prompt_templates WHERE type='news_transformation' AND locale='de'` |
| `facebook_integration_prompts.py` (DE inline) | `prompt_templates WHERE type='social_media_*' AND locale='de'` |

### Datenbank: Deutsche Enums → Taxonomien

| Aktuell | Neu |
|---------|-----|
| `gender_type ENUM('mannlich','weiblich','divers','alien')` | `simulation_taxonomies WHERE taxonomy_type='gender'` |
| `profession_type ENUM(...)` | `simulation_taxonomies WHERE taxonomy_type='profession'` |
| `building_special_type ENUM(...)` | `simulation_taxonomies WHERE taxonomy_type='building_special_type'` |
| `urgency CHECK IN ('NIEDRIG','MITTEL','HOCH','KRITISCH')` | `simulation_taxonomies WHERE taxonomy_type='urgency_level'` |
| `target_demographic CHECK(...)` | `simulation_taxonomies WHERE taxonomy_type='target_demographic'` |

---

## Datums- und Zahlenformatierung

### Frontend

```typescript
// Verwendung von Intl API
class FormatService {
  private locale: string;

  formatDate(date: Date, style: 'short' | 'medium' | 'long' = 'medium'): string {
    return new Intl.DateTimeFormat(this.locale, {
      dateStyle: style
    }).format(date);
  }

  formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat(this.locale, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat(this.locale).format(value);
  }

  formatPercent(value: number): string {
    return new Intl.NumberFormat(this.locale, {
      style: 'percent',
      maximumFractionDigits: 1
    }).format(value);
  }

  formatRelativeTime(date: Date): string {
    const rtf = new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' });
    const diff = date.getTime() - Date.now();
    const days = Math.round(diff / (1000 * 60 * 60 * 24));

    if (Math.abs(days) < 1) {
      const hours = Math.round(diff / (1000 * 60 * 60));
      return rtf.format(hours, 'hour');
    }
    return rtf.format(days, 'day');
  }
}
```

### Pluralisierung

```typescript
// Verwendung von ICU MessageFormat via @lit/localize
import { msg, str } from '@lit/localize';

// Einfache Pluralisierung
const agentCount = (count: number) =>
  count === 1
    ? msg('1 agent')
    : msg(str`${count} agents`);

// Komplexe Pluralisierung mit select
// Wird in XLIFF-Dateien definiert
```

---

## Implementierungs-Reihenfolge

### Phase 1: Foundation

1. `@lit/localize` Setup + Konfiguration
2. Translation-Dateien Grundstruktur (DE + EN)
3. LocaleService implementieren
4. `msg()` in 5 Kern-Komponenten einbauen (Header, Auth, AgentsView)

### Phase 2: Vollstandige UI-Ubersetzung

5. Alle 64+ Komponenten: hardcodierte Strings → `msg()`
6. Validierungs-Nachrichten uber i18n
7. Error-Messages uber i18n
8. Datums-/Zahlenformatierung

### Phase 3: Simulations-Inhalte

9. `simulation_taxonomies` mit `label` Feld
10. Taxonomie-Labels in Simulations-Sprache
11. Content-Locale in Simulation-Settings

### Phase 4: AI-Prompts

12. Alle 22 Prompts als `prompt_templates` Seed-Daten (DE + EN)
13. Mock-Templates lokalisieren (M1-M7)
14. PromptResolver mit Fallback-Kette
15. Sprach-Instruktion in System-Prompts

---

## Querverweise

- **07_FRONTEND_COMPONENTS.md** - Komponenten die i18n nutzen
- **08_SIMULATION_SETTINGS.md** - Sprach-Settings pro Simulation
- **09_AI_INTEGRATION.md** - Prompt-Templates mit Locale
- **13_TECHSTACK_RECOMMENDATION.md** - @lit/localize als i18n-Tool
