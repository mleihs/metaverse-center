---
title: "External Services"
id: external-services
version: "1.2"
date: 2026-09-05
lang: de
type: spec
status: active
tags: [external, apis, facebook, guardian, newsapi, tavily, openalex, crossref, openlibrary, forge-research]
---

# 11 - External Services: Pro Simulation konfigurierbar

---

## Übersicht

Alle externen Services sind pro Simulation konfigurierbar. Jede Simulation kann eigene API-Keys, Accounts und Konfigurationen für externe Dienste haben.

```
Plattform-Defaults (Fallback)
    │
    ▼
┌─────────────────────┐
│ Simulation Settings  │
│ (Integration Tab)    │
├─────────────────────┤
│ Facebook Integration │ ← Eigene Page pro Simulation
│ News-APIs            │ ← Eigene Keys möglich
│ AI-Provider          │ ← Override möglich
│ Storage              │ ← Shared (Supabase)
└─────────────────────┘
```

---

## 1. Facebook Graph API

### Konfiguration pro Simulation

| Setting | Beschreibung | Verschlüsselt |
|---------|-------------|---------------|
| `integration.facebook.enabled` | Integration aktiv | Nein |
| `integration.facebook.page_id` | Facebook Page ID | Nein |
| `integration.facebook.access_token` | Page Access Token | **Ja** |
| `integration.facebook.api_version` | API Version | Nein |
| `integration.facebook.sync_interval_minutes` | Sync-Intervall | Nein |
| `integration.facebook.auto_transform` | Auto-Transformation | Nein |

### Features

| Feature | Endpoint | Beschreibung |
|---------|----------|-------------|
| Posts importieren | `GET /{page-id}/feed` | Posts von der konfigurierten Page |
| Kommentare laden | `GET /{post-id}/comments` | Kommentare eines Posts |
| Post-Details | `GET /{post-id}` | Einzelner Post mit Reactions |
| Bild-URLs | `GET /{post-id}/attachments` | Medien-Anhänge |

### Altsystem-Referenz

```python
# config.py (Alt)
FACEBOOK_PAGE_ACCESS_TOKEN = "EAA..."
FACEBOOK_PAGE_ID = "203648343900979"
FACEBOOK_API_VERSION = "v23.0"
USE_FACEBOOK_MOCK_DATA = True

# Neu: Aus simulation_settings laden
facebook_config = settings_service.get_integration(simulation_id, 'facebook')
```

### Transformation-Pipeline

```
1. Posts von Facebook importieren
2. Sentiment-Analyse durchführen (AI)
3. Posts in Simulations-Kontext transformieren (AI)
   - Transformation-Typ aus Simulation-Settings
   - Prompt aus prompt_templates (lokalisiert)
4. Agenten-Reaktionen generieren (AI)
5. Optional: Als Event integrieren
```

---

## 2. News-APIs

### The Guardian API

| Setting | Beschreibung | Verschlüsselt |
|---------|-------------|---------------|
| `integration.guardian.enabled` | Integration aktiv | Nein |
| `integration.guardian.api_key` | API Key | **Ja** |
| `integration.guardian.default_section` | Standard-Sektion | Nein |
| `integration.guardian.max_results` | Max Ergebnisse pro Abfrage | Nein |

**API:** `https://open-platform.theguardian.com/search`
**Rate Limit:** Abhängig vom API-Tier (Free: 12 Requests/Sekunde)

### NewsAPI

| Setting | Beschreibung | Verschlüsselt |
|---------|-------------|---------------|
| `integration.newsapi.enabled` | Integration aktiv | Nein |
| `integration.newsapi.api_key` | API Key | **Ja** |
| `integration.newsapi.sources` | Bevorzugte Quellen | Nein |
| `integration.newsapi.language` | Sprach-Filter | Nein |

**API:** `https://newsapi.org/v2/everything`
**Rate Limit:** Free: 100 Requests/Tag

### News-Transformation-Flow

```
1. Trends von Guardian/NewsAPI abrufen
2. In social_trends Tabelle speichern
3. Relevanz-Score berechnen
4. Optional: In Simulations-Kontext transformieren (AI)
   - news_transformation Prompt (lokalisiert)
5. Optional: Als Kampagne integrieren
6. Optional: Als Event mit Agent-Reaktionen erstellen
```

---

## 3. Replicate API (Bildgenerierung)

### Konfiguration

| Setting | Beschreibung | Verschlüsselt |
|---------|-------------|---------------|
| `integration.replicate.api_key` | API Token (Override) | **Ja** |
| `ai.image_models.agent_portrait` | Modell für Portraits | Nein |
| `ai.image_models.building_image` | Modell für Gebäude | Nein |
| `ai.image_params.*` | Generierungs-Parameter | Nein |

**API:** `https://api.replicate.com/v1/predictions`
**Auth:** `Authorization: Token {api_key}`

### Altsystem-Referenz

```python
# config.py (Alt)
REPLICATE_API_TOKEN = "r8_..."
IMAGE_MODELS = {
    "agent_portrait": {
        "model": "stability-ai/stable-diffusion",
        "version": "ac732df83cea7fff2b7cf1003e0b4b7a9...",
        "scheduler": "K_EULER"
    }
}

# image_service.py (Alt)
DEFAULT_WIDTH = 512
DEFAULT_HEIGHT = 512
DEFAULT_GUIDANCE_SCALE = 7.5
DEFAULT_NUM_INFERENCE_STEPS = 50
```

### Bild-Verarbeitung

```
1. Replicate Prediction erstellen
2. Poll bis Status "succeeded" (max 600s)
3. Bild-URL herunterladen
4. In WebP konvertieren (Qualität 85)
5. Max 1024px Resize
6. In Supabase Storage hochladen
7. Öffentliche URL generieren
```

### Storage Buckets

| Bucket | Zweck |
|--------|-------|
| `agent.portraits` | Agent-Portraits |
| `user.agent.portraits` | User-Agent-Portraits |
| `building.images` | Gebäude-Bilder |
| `simulation.assets` | Allgemeine Simulations-Assets (NEU) |

---

## 4. OpenRouter API (LLM-Proxy)

### Konfiguration

| Setting | Beschreibung | Verschlüsselt |
|---------|-------------|---------------|
| `integration.openrouter.api_key` | API Key (Override) | **Ja** |
| `ai.models.*` | Modelle pro Zweck | Nein |
| `ai.params.*` | Parameter pro Modell | Nein |

**API:** `https://api.openrouter.com/api/v1/chat/completions`
**Auth:** `Authorization: Bearer {api_key}`

### Modell-Katalog (Velgarien-Defaults)

| Modell | Zweck | Temp | Max Tokens |
|--------|-------|------|------------|
| deepseek/deepseek-chat-v3-0324 | Agent-Beschreibungen | 0.8 | 300 |
| meta-llama/llama-3.3-70b-instruct:free | Reaktionen, Buildings | 0.7 | 100-250 |
| meta-llama/llama-3.2-3b-instruct:free | News-Transformation | 0.8 | 300 |
| shisa-ai/shisa-v2-llama3.3-70b:free | Fallback | 0.7 | 500 |

### Fehler-Handling

| HTTP Status | Aktion |
|------------|--------|
| 200 | Erfolg |
| 429 | Rate Limit → Fallback-Modell verwenden |
| 500 | Provider-Fehler → Retry (1x), dann Fallback |
| 503 | Service Unavailable → Plattform-Default-Modell |

---

## 5. Supabase (Datenbank + Auth + Storage + Realtime)

### Hybrid-Architektur

Supabase ist die zentrale Plattform-Infrastruktur. **Entscheidend:** Frontend und Backend greifen unterschiedlich auf Supabase zu:

| Dienst | Zugriff durch | Wie |
|--------|---------------|-----|
| **Auth** | Frontend direkt | `@supabase/supabase-js` mit Anon Key |
| **Storage** (User-Uploads) | Frontend direkt | Supabase Storage Client mit Auth-JWT |
| **Storage** (AI-Bilder) | Backend | Service Key (AI-Pipeline) |
| **Realtime** | Frontend direkt | Supabase Realtime Client mit Auth-JWT |
| **PostgreSQL** (Lesen/Schreiben) | Backend (FastAPI) | Anon Key + User-JWT → **RLS aktiv** |
| **PostgreSQL** (Admin/System) | Backend (FastAPI) | Service Key → RLS bypassed (sparsam!) |

### Konfiguration

| Variable | Wer nutzt es | Beschreibung |
|----------|-------------|-------------|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Frontend + Backend | Projekt-URL |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | Frontend (direkt) + Backend (mit User-JWT) | Öffentlicher Key |
| `SUPABASE_SERVICE_KEY` | Backend (nur Admin/System-Ops) | Service Key (bypasses RLS) |
| `SUPABASE_JWT_SECRET` | Backend | JWT-Validierung (aus Supabase Dashboard) |

Siehe **Auth and Security** (`auth-and-security.md`) für die vollständige Hybrid-Architektur und Defense-in-Depth-Strategie.

---

## Service-Auflösung pro Simulation

```python
from fastapi import Depends
from pydantic import BaseModel
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Plattform-Defaults aus Umgebungsvariablen (pydantic-settings)."""
    openrouter_api_key: str
    replicate_api_token: str
    class Config:
        env_file = ".env"

settings = Settings()


class ExternalServiceResolver:
    """Löst externe Service-Konfiguration pro Simulation auf."""

    def __init__(self, simulation_id: UUID, settings_service: SettingsService):
        self.sim_id = simulation_id
        self.settings = settings_service

    def get_facebook_config(self) -> Optional[FacebookConfig]:
        if not self.settings.get('integration.facebook.enabled', False):
            return None
        return FacebookConfig(
            page_id=self.settings.get('integration.facebook.page_id'),
            access_token=self.settings.get_encrypted('integration.facebook.access_token'),
            api_version=self.settings.get('integration.facebook.api_version', 'v23.0')
        )

    def get_news_config(self, source: str) -> Optional[NewsConfig]:
        key = f'integration.{source}'
        if not self.settings.get(f'{key}.enabled', False):
            return None
        return NewsConfig(
            api_key=self.settings.get_encrypted(f'{key}.api_key'),
            source=source
        )

    def get_openrouter_key(self) -> str:
        """Simulation-Key oder Plattform-Default."""
        sim_key = self.settings.get_encrypted('integration.openrouter.api_key')
        return sim_key or settings.openrouter_api_key

    def get_replicate_key(self) -> str:
        """Simulation-Key oder Plattform-Default."""
        sim_key = self.settings.get_encrypted('integration.replicate.api_key')
        return sim_key or settings.replicate_api_token


# FastAPI Dependency
async def get_service_resolver(
    simulation_id: UUID,
    settings_service: SettingsService = Depends(get_settings_service)
) -> ExternalServiceResolver:
    return ExternalServiceResolver(simulation_id, settings_service)


# Verwendung in Routers:
@router.get("/facebook/posts")
async def get_facebook_posts(
    resolver: ExternalServiceResolver = Depends(get_service_resolver)
):
    config = resolver.get_facebook_config()
    if not config:
        raise HTTPException(404, detail="Facebook integration not enabled")
    ...
```

---

## 6. Recherche der Schmiede (`TavilySearchService` + `ScholarlySearchService`)

> **Stand 2026-09-05.** Der Abschnitt beschrieb bis dahin eine Domainsteuerung,
> die fuer eine Schranke gehalten wurde. Sie war keine. Siehe
> `docs/plans/forge-scholarly-sources.md`.

### Die Gattungsgrenze

Die Recherche belegt Weltenbau mit drei Gattungen: belletristische und
literaturkritische Werke, philosophische Schriften, begutachtete Fachliteratur.
Entschieden wird das an **einer** Stelle —
`backend/services/research_source_policy.py`. Jede Quellzeile jedes Anbieters
laeuft durch `is_admissible()`; was nicht durchkommt, verschwindet aus der
Quellenliste **und** aus der Prosa, die das Modell liest.

Zwei Listen, in `platform_settings`, im Admin unter Forschung → Gattungsgrenze:

| Schluessel | Wirkung |
|---|---|
| `research_source_allowlist` | Nur diese Domains zaehlen (70 Vorgabewerte: Fachverlage, Uni-Verlage, SEP/IEP/PhilPapers, Bibliothekskataloge, Nachschlagewerk, Architekturgeschichte) |
| `research_source_denylist` | Nie eine Quelle, auch nicht ueber einen DOI (79 Vorgabewerte). Schlaegt die Freiliste. |

Dazu zwei Regeln, die kein Domainname faengt:

* **Trefferlisten sind keine Quellen.** `philarchive.org/s/...`,
  `.../search?q=...` — zugelassener Host, kein Werk.
* **Ein Werk, eine Zeile.** Entdoppelt nach URL, dann nach Titel + Jahr.
  Dieselbe Arbeit kam von PhilPapers und PhilArchive unter zwei Verweisen.

### `include_domains_mode` — der Befund

Tavily kennt zu `include_domains` zwei Betriebsarten: `filter` schliesst aus,
`boost` gewichtet nur. Ohne `include_domains_mode` galt in der Praxis die
zweite. Gemessen 2026-09-04, identische Anfrage, identische drei Domains:

| Aufruf | Treffer aus der Liste |
|---|---|
| ohne `include_domains_mode` | **2 von 5** — darunter `facebook.com` |
| mit `include_domains_mode="filter"` | **5 von 5** |

`TavilySearchService` setzt den Parameter jetzt, und zwar nur wenn es eine
Liste gibt, die er betrifft: der Client 0.7.27 fuehrt ihn nicht in seiner
Signatur und reicht ihn ueber `**kwargs` durch.

### `ScholarlySearchService`

**Datei:** `backend/services/external/scholarly_search.py`. Dienste, deren
*Bestand* die Schranke ist — sie brauchen keine Domainliste.

| Anbieter | Schluessel | Rolle |
|---|---|---|
| `openalex` | `OPENALEX_API_KEY`, kostenlos, 1 USD/Tag frei (~1000 Suchen) | Grundlage. Fachfilter `primary_topic.field.id:fields/12\|33\|32` (Geistes-, Sozialwissenschaften, Psychologie). Relevanzboden **relativ** zum Spitzenwert derselben Anfrage — `relevance_score` ist ueber Anfragen hinweg nicht vergleichbar (gemessen 2910 gegen 324 bei gleich guten Treffern). |
| `openlibrary` | keiner | Buecher. Fragt ueber `subject:"..."`, nicht ueber Freitext: Open Library ist ein Katalog und gewichtet Titel und Autor, nicht Thema. Freitext nur als Rueckfall. |
| `crossref` | keiner | Rueckfallebene, wenn OpenAlex nichts liefert (fehlender Schluessel, 409 Tagesbudget, 429). |

Verworfen: **DOAJ** (Volltextsuche ohne brauchbare Rangfolge — auf
„memory studies" kam eine Arbeit ueber Drohnenfunk), **Semantic Scholar**
(ohne Schluessel HTTP 429 bei der ersten Anfrage).

### Die Anfrage wird uebersetzt

Der Seed ist eine Erzaehlpraemisse. Eine Suchmaschine, der man eine Praemisse
gibt, antwortet mit fiktionsfoermigem Material — gemessen an einem
Produktionsseed: ein Bilderdienst, ein Weltenbau-Forum, ein Bastelratgeber.

Ein billiger Modellaufruf (`ai_purposes: research_query`, 400 Token, 30 s,
`reasoning=off`) macht daraus `ResearchQueryPlan` — je drei Begriffe fuer
Literatur, Philosophie, Fachkontext. Der Prompt verbietet blosse
Disziplinnamen und selbsterfundene Wendungen und verlangt auf der literarischen
Achse mindestens **einen benannten Autor oder ein benanntes Werk**. Faellt der
Aufruf aus, wird mit der Praemisse selbst gesucht: schlechter, aber innerhalb
der Gattungsgrenze — die haengt an der Schranke, nicht an der Anfrage.

Gemessener Unterschied, OpenAlex, gleicher Seed:

| Begriffsart | Ergebnis |
|---|---|
| Fachname (`memory studies`, `epistemology`) | Olick & Robbins **und** *Prevalence of Dementia in the United States*; `allegory` holte C. S. Lewis' *The Allegory of Love* — richtiges Wort, falsche Bedeutung |
| Begriff (`collective memory and forgetting`, `critical cartography and power`) | Connerton, Olick, Fowler, Crampton, Baldacchino |

### Achsen und Ablauf

Beide Phasen laufen gleich: uebersetzen → Fachdienste **und** gefiltertes
Tavily parallel → Schranke → Prosa aus dem, was uebrig ist.

| Phase | Achsen | Zeitlimit (Fach / Tavily) |
|---|---|---|
| 1 Astrolabium | `LITERARY SCHOLARSHIP`, `PHILOSOPHICAL TRADITION`, `SCHOLARLY CONTEXT` | 12 s / 10 s, kein Retry |
| 4 Lore | dieselben plus `ARCHITECTURAL HISTORY` | 15 s / 20 s, 1 Retry |

Die Architekturachse zeigt seit Migration 370 auf Architekturgeschichte
(`sah.org`, `getty.edu`, JSTOR, Cambridge) statt auf `dezeen.com` und
`designboom.com`. Der Ersatz beschreibt Bauten datiert und benannt, zeigt sie
aber nicht — ein bewusst in Kauf genommener Verlust.

In Phase 4 steht die gefundene Bibliographie **im Prompt**, vor der Deutung.
Bis 2026-09-04 schrieb das Modell seinen Entwurf zuerst und die Suche wurde
hinterher angehaengt; es konnte also gar nicht zitieren, was gefunden wurde.

### Was der Entwurf berichtet

`forge_drafts.research_context.source` sagt, welcher Weg getragen hat
(`scholarly` | `emulator` | `mock`). Bis 2026-09-04 stand dort
`"tavily" if settings.tavily_api_key` — eine Aussage ueber die Konfiguration,
die auch dann „tavily" sagte, wenn jede Suche fehlgeschlagen war.

`…sources` traegt jetzt `authors`, `year`, `venue`, `provider`. Die Ankerkarte
zeigt Autor und Jahr vor dem Titel, wie eine Bibliographie: so laesst sich eine
Angabe nachschlagen, ohne den Verweis zu oeffnen.

### Emulator (kein Netz, keine Quellen)

Deterministischer Rueckfall, 6 thematische Linsen (entropy, memory,
surveillance, liminality, posthuman, temporal economics), Auswahl ueber den
Seed-Hash. Er greift jetzt erst, wenn **beide** Wege nichts geliefert haben —
ein fehlender Tavily-Schluessel allein reicht nicht mehr, weil zwei der drei
Fachdienste keinen brauchen.

### Gemessenes Ergebnis

Live-Lauf des echten Code-Pfads gegen den Seed, der den Anlass gab:
**17 Quellen zugelassen, 0 abgewiesen** — SEP, Springer *Synthese*,
Cambridge UP, JSTOR, PhilPapers, *History and Theory*, Medina, Bailey,
D'Ignazio & Klein *Data Feminism*, Alan Liu *The Power of Formalism*. Kein
YouTube, kein Facebook, kein Fandom. Ein vorheriger Lauf wies genau eine Zeile
ab: eine PhilArchive-Trefferliste.

### Sentry Coverage

Alle Tavily-Fehlschlaege werden ueber `sentry_sdk.capture_message()` mit `push_scope()` gemeldet (Tag: `forge_phase`, Context: `seed_preview`/`simulation_id`). Einzelne Tavily-Fehler (Timeouts, 429) sind nur Warnings — diese sind transient und werden per Retry behandelt. Nur vollstaendiger Fehlschlag (alle Achsen gescheitert → Emulator-Fallback) triggert Sentry.

Seit 2026-09-05 kommt ein zweites Ereignis dazu: **eine Recherche ohne eine
einzige zugelassene Quelle**. Von aussen sieht die aus wie eine ohne Treffer —
eine kurze Liste in beiden Faellen —, und die Unterscheidung ist die zwischen
„nichts gefunden" und „alles verworfen". Abgewiesene Hosts stehen als
`logger.info` mit Hostnamen im Protokoll, weil eine Sperrliste nur findet, was
man ihr gesagt hat: was dort auftaucht, ist der Vorschlag fuer den naechsten
Eintrag.

**Release Tracking:** Alle Sentry-Events (Backend + Frontend) werden mit dem Git-Commit-SHA getaggt (`SENTRY_RELEASE`). Source Maps werden waehrend des Docker-Builds via `@sentry/vite-plugin` hochgeladen. CI assoziiert Commits und registriert Deploys via `getsentry/action-release@v3`. Ein Post-Deploy Health Check prueft automatisch auf neue Sentry-Issues nach jedem Deploy. Vollstaendige Architektur: siehe `docs/guides/sentry-cicd-integration.md`.

---

## 7. Platform API Key Management

Platform-level API keys provide defaults for all simulations. Individual users can override OpenRouter/Replicate keys via BYOK (Bring Your Own Key) in their personal forge wallet. Keys are AES-256 encrypted at rest. Users can test keys against provider APIs before saving, and revoke individual keys without affecting the other.

### Key Hierarchy

```
Simulation-level key (if configured)
    → Platform-level key (default)
        → Environment variable (fallback)
```

The `ExternalServiceResolver` checks simulation settings first, then falls back to platform defaults via `get_platform_api_key()`.

### Managed Keys

| Setting Key | Service | Description |
|-------------|---------|-------------|
| `openrouter_api_key` | OpenRouter | AI text generation (LLM proxy) |
| `replicate_api_key` | Replicate | AI image generation |
| `guardian_api_key` | The Guardian | News integration |
| `newsapi_api_key` | NewsAPI | News integration |
| `tavily_api_key` | Tavily | Forge research + web search |
| `deepl_api_key` | DeepL | Automated translation |

### Encryption

All API keys stored in `platform_settings` are encrypted with AES-256 (Fernet). Encrypted values are prefixed with `gAAAAA`. Decryption happens at read time in `platform_api_keys.py`.

### Caching

- **Cache TTL:** 300 seconds (5 minutes)
- **Invalidation:** `invalidate()` clears in-process cache when admin updates a key
- Keys are loaded lazily on first access, then served from cache until TTL expires

### Admin UI

The `<velg-admin-api-keys-tab>` component in the Admin Panel provides:
- Masked display of current key values
- Per-key edit with show/hide toggle
- Save and clear actions per key
- Status badges (Active / Not configured)
- Grouped by category (AI, News, Other)
