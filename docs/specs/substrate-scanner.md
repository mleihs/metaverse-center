---
title: "Substrate Scanner — Automated Real-World Event Detection"
id: substrate-scanner
version: "1.0"
date: 2026-03-08
lang: en
type: spec
status: active
tags: [scanner, resonances, automation, news, adapters]
---

# Substrate Scanner — Automated Real-World Event Detection

## Context

Substrate resonances are platform-level phenomena that translate real-world events into archetypal forces affecting all simulations. Currently, resonances are created manually by a platform admin — someone must notice a real-world event, classify it, write a bureau dispatch, and set magnitude. This means the game world only reacts to events someone remembers to enter.

The Substrate Scanner automates this: a background service that periodically polls real-world data sources (earthquake feeds, weather alerts, news APIs, disease trackers), classifies events into the 8 resonance categories, generates bureau dispatch narratives, and either auto-creates resonances or stages them for admin approval.

**Key architectural insight:** Many sources provide **structured data** where category and magnitude can be determined deterministically (USGS gives Richter scale → magnitude mapping). Only unstructured text sources (news articles) need LLM classification. This splits the pipeline into zero-cost structured processing and batched LLM classification for text.

**Game design rationale:** The scanner transforms the platform from a curated editorial experience into a **living reactive system**. Real earthquakes create in-world tremors. Real pandemics spawn biological tides. The game world breathes with reality — but through the lens of Jungian archetypes, not literal news. Players never see "earthquake in Turkey"; they see "The Deluge manifests in Velgarien" with susceptibility-weighted impacts.

---

## I. Data Sources — Verified API Research

### A. Structured Sources (Deterministic Classification, Zero LLM Cost)

#### 1. USGS Earthquake Hazards Program

```
GET https://earthquake.usgs.gov/fdsnws/event/1/query
    ?format=geojson
    &minmagnitude=4.0
    &starttime={ISO8601}
    &orderby=time
```

| Field | Source |
|-------|--------|
| Auth | None required |
| Rate limits | None documented; use real-time GeoJSON feeds for high-frequency polling |
| Format | GeoJSON |
| Key fields | `properties.mag` (Richter), `properties.place`, `properties.time` (epoch ms), `properties.alert` (green/yellow/orange/red), `properties.tsunami` (0/1), `id`, `geometry.coordinates` |
| Category | Always `natural_disaster` |
| Magnitude mapping | Richter 4.0→0.15, 5.0→0.25, 6.0→0.45, 7.0→0.70, 8.0+→0.95. Boost +0.15 if `alert=red`, +0.10 if `tsunami=1`. Clamp to [0.1, 1.0] |
| Poll interval | Every 15 minutes |

**Example response** (GeoJSON feature):
```json
{
  "type": "Feature",
  "properties": {
    "mag": 7.2,
    "place": "45km SSE of Pazarcik, Turkey",
    "time": 1675637318000,
    "alert": "red",
    "tsunami": 1,
    "title": "M 7.2 - 45km SSE of Pazarcik, Turkey"
  },
  "id": "us6000jllz"
}
```

#### 2. NOAA / National Weather Service Alerts

```
GET https://api.weather.gov/alerts/active
    ?severity=Extreme,Severe
```

| Field | Source |
|-------|--------|
| Auth | Requires `User-Agent` header: `(metaverse.center, matthias@leihs.at)` |
| Rate limits | Generous; rate limit errors clear within 5 seconds |
| Format | GeoJSON (`application/geo+json`) |
| Key fields | `properties.event` (e.g., "Tornado Warning"), `properties.severity` (Extreme/Severe/Moderate/Minor), `properties.urgency`, `properties.headline`, `properties.description`, `properties.areaDesc`, `properties.id` |
| Category | Always `natural_disaster` |
| Magnitude mapping | Minor→0.10, Moderate→0.20, Severe→0.45, Extreme→0.75. Event boosts: "Tornado" +0.15, "Hurricane" +0.20, "Tsunami" +0.20 |
| Filter | Only `severity` in (Extreme, Severe) to reduce noise |
| Poll interval | Every 15 minutes |

#### 3. NASA EONET (Earth Observatory Natural Event Tracker) v3

```
GET https://eonet.gsfc.nasa.gov/api/v3/events
    ?status=open
    &limit=25
    &days=7
```

| Field | Source |
|-------|--------|
| Auth | None required |
| Rate limits | None documented |
| Format | JSON |
| Key fields | `id`, `title`, `categories[].id` (e.g., "wildfires", "volcanoes", "severeStorms", "seaLakeIce"), `geometry[].magnitudeValue`, `geometry[].magnitudeUnit`, `sources[].url` |
| Category | `natural_disaster` for most; `environmental_disaster` for "waterColor" (algal blooms), "dustHaze" |
| Magnitude mapping | Uses EONET `magnitudeValue` where available; default 0.30 |
| Poll interval | Every 30 minutes |

**EONET Category → Resonance Category:**
| EONET Category | Resonance Category |
|---|---|
| earthquakes, volcanoes, severeStorms, floods, landslides | `natural_disaster` |
| wildfires | `natural_disaster` (large) or `environmental_disaster` (sustained) |
| waterColor, dustHaze, snow | `environmental_disaster` |
| seaLakeIce, tempExtremes, drought | `environmental_disaster` |

#### 4. GDACS (Global Disaster Alert and Coordination System)

```
GET https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH
    ?eventlist=EQ,TC,FL,VO,WF,DR
    &alertlevel=orange,red
    &fromdate={7_days_ago}
    &todate={today}
```

| Field | Source |
|-------|--------|
| Auth | None required |
| Rate limits | Max 100 records per query; use `pagenumber` for pagination |
| Format | GeoJSON |
| Swagger | `https://www.gdacs.org/gdacsapi/swagger/index.html` |
| Event types | EQ (Earthquake), TC (Tropical Cyclone), FL (Flood), VO (Volcano), WF (Wildfire), DR (Drought) |
| Alert levels | Green, Orange, Red |
| Category | Always `natural_disaster` |
| Magnitude mapping | Green→0.15, Orange→0.45, Red→0.80 |
| Poll interval | Every 30 minutes |

#### 5. disease.sh (Open Disease Data)

```
GET https://disease.sh/v3/covid-19/all
GET https://disease.sh/v3/covid-19/countries?sort=todayCases
```

| Field | Source |
|-------|--------|
| Auth | None required |
| Rate limits | None documented |
| Format | JSON |
| Key fields | `cases`, `todayCases`, `todayDeaths`, `active`, `critical`, `recovered`, `affectedCountries` |
| Tracks | COVID-19, Influenza |
| Category | Always `pandemic` |
| Magnitude mapping | Rate-of-change based: >20% daily spike globally → 0.60, 10-20% → 0.35, stable/declining → skip |
| Poll interval | Every 60 minutes (data updates slowly) |
| Note | Requires polling across cycles to detect rate-of-change |

### B. Semi-Structured Sources (Category Known, LLM for Magnitude)

#### 6. WHO Disease Outbreak News

```
GET https://www.who.int/api/news/diseaseoutbreaknews
    ?$orderby=PublicationDateAndTime desc
    &$top=20
```

| Field | Source |
|-------|--------|
| Auth | None required |
| Format | JSON (OData-style) |
| Key fields | `Title`, `Summary`, `PublicationDate`, `ItemDefaultUrl`, `DonId` |
| Category | Always `pandemic` |
| Magnitude | LLM assesses severity from Title + Summary |
| Poll interval | Every 60 minutes |
| Note | OData filtering likely supported (`$filter=PublicationDate gt ...`) |

#### 7. Hacker News (Top Stories)

```
GET https://hacker-news.firebaseio.com/v0/topstories.json
    → returns [item_id, item_id, ...]
GET https://hacker-news.firebaseio.com/v0/item/{id}.json
    → returns {title, url, score, descendants, time, ...}
```

| Field | Source |
|-------|--------|
| Auth | None required |
| Rate limits | None documented |
| Format | JSON |
| Key fields | `id`, `title`, `url`, `score`, `descendants` (comment count), `time` |
| Category | Primarily `tech_breakthrough` |
| Magnitude | Hybrid: `score > 500` → higher base; LLM confirms category + refines magnitude |
| Filter | Only `score > 200` to avoid noise |
| Poll interval | Every 30 minutes |

### C. Unstructured Sources (Full LLM Classification Required)

#### 8. Guardian API (existing service)

Wraps existing `backend/services/external/guardian.py` → `GuardianService.browse(section, limit)`.

| Field | Source |
|-------|--------|
| Auth | Optional API key (free tier available without key) |
| Key | `guardian_api_key` in platform_settings |
| Category | All 8 categories (LLM classifies) |
| Poll interval | Every 6 hours |

#### 9. NewsAPI (existing service)

Wraps existing `backend/services/external/newsapi.py` → `NewsAPIService.browse(country, category, limit)`.

| Field | Source |
|-------|--------|
| Auth | API key required |
| Key | `newsapi_api_key` in platform_settings |
| Category | All 8 categories (LLM classifies) |
| Poll interval | Every 6 hours |

#### 10. GDELT DOC 2.0 API

```
GET https://api.gdeltproject.org/api/v2/doc/doc
    ?query={keywords}
    &mode=artlist
    &format=json
    &maxrecords=50
    &timespan=6h
    &sort=datedesc
```

| Field | Source |
|-------|--------|
| Auth | None required |
| Rate limits | None documented; CORS enabled |
| Format | JSON (also CSV, RSS, JSONFeed) |
| Key fields | `articles[].title`, `articles[].url`, `articles[].seendate`, `articles[].domain`, `articles[].language`, `articles[].socialimage` |
| Category | All 8 categories (LLM classifies) |
| Query strategy | Category-specific keyword queries run in sequence |
| Special features | `theme:TERROR`, `tone<-5` (negative sentiment), 65-language machine translation, 3-month rolling window |
| Max records | 250 per query |
| Poll interval | Every 6 hours |

**GDELT keyword queries per category:**
```python
GDELT_CATEGORY_QUERIES = {
    "economic_crisis": '"financial crisis" OR "market crash" OR "bank collapse" OR "currency crisis" OR recession',
    "military_conflict": '"armed conflict" OR "military operation" OR invasion OR "territorial dispute" OR airstrike',
    "pandemic": 'pandemic OR epidemic OR outbreak OR "public health emergency"',
    "natural_disaster": 'earthquake OR tsunami OR hurricane OR "volcanic eruption" OR flood',
    "political_upheaval": 'revolution OR coup OR "mass protest" OR "regime change" OR uprising',
    "tech_breakthrough": '"artificial intelligence" OR "quantum computing" OR "space launch" OR "scientific breakthrough"',
    "cultural_shift": '"social movement" OR "civil rights" OR "cultural revolution" OR "generational change"',
    "environmental_disaster": '"oil spill" OR deforestation OR "extinction event" OR "climate tipping point" OR "pollution crisis"',
}
```

---

## II. Pipeline Architecture

### A. Four-Stage Pipeline

```
STAGE 1: FETCH          STAGE 2: PRE-FILTER       STAGE 3: CLASSIFY        STAGE 4: CREATE
─────────────────────   ──────────────────────     ─────────────────────    ─────────────────────
10 source adapters      Keyword reject/boost       Structured: pass-thru   Auto-create resonance
  → ScanResult[]        (no LLM, Python only)      Unstructured: batch     OR stage as candidate
~60 items/cycle         ~40 survive                LLM (1 call, temp 0.2)  + bureau dispatch gen
                                                   ~15 classified          0-5 resonances/cycle
```

### B. Source Adapter Interface

```python
class SourceAdapter(ABC):
    """Base class for all event source adapters."""

    name: str                      # "usgs_earthquakes"
    display_name: str              # "USGS Earthquake Hazards"
    categories: list[str]          # ["natural_disaster"]
    is_structured: bool            # True = deterministic, no LLM
    requires_api_key: bool         # False for most
    api_key_setting: str | None    # "guardian_api_key" or None
    default_interval: int          # seconds between polls (per adapter)

    @abstractmethod
    async def fetch(self, since: datetime | None = None) -> list[ScanResult]:
        """Fetch and normalize events. Returns ScanResult with pre-classification for structured sources."""

    async def is_available(self) -> bool:
        """Check if adapter is configured and reachable."""
```

### C. Adapter Registry Pattern

```python
_ADAPTERS: dict[str, type[SourceAdapter]] = {}

@register_adapter
class USGSEarthquakeAdapter(SourceAdapter):
    name = "usgs_earthquakes"
    display_name = "USGS Earthquake Hazards"
    categories = ["natural_disaster"]
    is_structured = True
    requires_api_key = False
    default_interval = 900  # 15 minutes
```

Self-registering via decorator. Adding a new source = create one file in `adapters/`, decorate class, import in `__init__.py`. Zero other files change.

### D. Pre-Filter Keywords (Stage 2)

```python
# Headlines containing these → REJECT before LLM (no cost)
REJECT_PATTERNS = {
    "recipe", "cookbook", "celebrity", "gossip", "kardashian",
    "premier league", "champions league", "world cup qualifier",
    "box office", "movie review", "album review", "fashion week",
    "reality tv", "horoscope", "crossword", "lottery", "dating",
    "sports score", "transfer window", "fantasy football",
}

# Headlines containing these → KEEP (always pass to classifier)
BOOST_PATTERNS = {
    "war", "conflict", "invasion", "ceasefire", "airstrike",
    "earthquake", "tsunami", "hurricane", "typhoon", "cyclone",
    "pandemic", "outbreak", "epidemic", "quarantine",
    "crash", "collapse", "crisis", "recession", "default",
    "revolution", "coup", "uprising", "martial law", "sanctions",
    "breakthrough", "discovery", "launch", "quantum", "fusion",
    "climate", "extinction", "deforestation", "oil spill",
    "flood", "wildfire", "famine", "drought", "volcano",
}
```

### E. LLM Batch Classification (Stage 3)

**Single call for up to 15 headlines.** Temperature 0.2 for classification consistency.

```
System: You are a geopolitical event classifier. Return ONLY valid JSON.

Classify each headline into exactly one category or "none":
- economic_crisis: Financial collapse, market crashes, banking failures, debt crises
- military_conflict: Wars, armed conflicts, military operations, territorial disputes
- pandemic: Disease outbreaks, epidemics, public health emergencies
- natural_disaster: Earthquakes, floods, storms, volcanic eruptions, wildfires
- political_upheaval: Revolutions, coups, mass protests, regime changes
- tech_breakthrough: Disruptive technology, AI milestones, space achievements
- cultural_shift: Social movements, civil rights, generational cultural change
- environmental_disaster: Oil spills, deforestation, extinction events, climate crises

Significance scale (maps to game magnitude 0.1-1.0):
  1-2: Local incident (magnitude ≤ 0.20)
  3-4: Regional event (magnitude 0.30-0.40)
  5-6: National event (magnitude 0.50-0.60)
  7-8: International crisis (magnitude 0.70-0.80)
  9-10: Civilization-level event (magnitude 0.90-1.00)

Headlines:
{headlines_json}

Return JSON array:
[{"index": 0, "category": "natural_disaster", "significance": 8, "reason": "Major earthquake with mass casualties"}]
```

### F. Bureau Dispatch Generation (Stage 4)

For each resonance created, generate a literary bureau dispatch. Temperature 0.9 for creative writing.

```
The Bureau of Substrate Monitoring has detected a new resonance.

Source event: {article_title}
{article_description}

Category: {source_category}
Archetype: {archetype_name} — {archetype_description}
Magnitude: {magnitude_scaled}/10

Write a bureau dispatch — an official report from the Bureau of Substrate Monitoring,
as if this real-world event were a tremor detected in the fabric between realities.

Tone: Clinical yet ominous. Like a seismological report written by someone who
suspects the instruments are detecting something alive.

Rules:
- Reference the real event obliquely (never name real places or people directly)
- Use the archetype as thematic framing
- 100-200 words
- End with a monitoring classification code

Respond in {locale}.
```

### G. Deduplication Strategy

1. **source_id match**: `news_scan_log.source_id` (UNIQUE) — exact match on external source's unique ID (USGS event ID, article URL, etc.)
2. **Title similarity**: Before creating a resonance, query `substrate_resonances` from last 72h with same `source_category`. Normalize titles to lowercase keyword sets. If intersection > 70% → skip as duplicate.
3. **Magnitude escalation**: If a duplicate is found but new result has higher magnitude → update existing resonance's magnitude (earthquake aftershock upgrades to main shock).
4. **Cleanup**: Scanner deletes `news_scan_log` entries older than 30 days each cycle.

---

## III. Database Schema

### Table: `news_scan_log`

```sql
CREATE TABLE news_scan_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id   TEXT NOT NULL,
    source_name TEXT NOT NULL,      -- adapter name
    title       TEXT NOT NULL,
    url         TEXT,
    scanned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    classified  BOOLEAN NOT NULL DEFAULT false,
    source_category TEXT,           -- classification result
    magnitude   NUMERIC(3,2),
    CONSTRAINT unique_source_id UNIQUE (source_name, source_id)
);

CREATE INDEX idx_scan_log_scanned ON news_scan_log (scanned_at DESC);
CREATE INDEX idx_scan_log_source ON news_scan_log (source_name, scanned_at DESC);
```

### Table: `news_scan_candidates`

```sql
CREATE TABLE news_scan_candidates (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_category      TEXT NOT NULL CHECK (source_category IN (
        'economic_crisis', 'military_conflict', 'pandemic',
        'natural_disaster', 'political_upheaval', 'tech_breakthrough',
        'cultural_shift', 'environmental_disaster'
    )),
    title                TEXT NOT NULL,
    description          TEXT,
    bureau_dispatch      TEXT,
    article_url          TEXT,
    article_platform     TEXT,
    article_raw_data     JSONB,
    magnitude            NUMERIC(3,2) NOT NULL DEFAULT 0.50
                           CHECK (magnitude >= 0.10 AND magnitude <= 1.00),
    classification_reason TEXT,
    source_adapter       TEXT NOT NULL,      -- which adapter found this
    is_structured        BOOLEAN NOT NULL DEFAULT false,
    status               TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'approved', 'rejected', 'created')),
    resonance_id         UUID REFERENCES substrate_resonances(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at          TIMESTAMPTZ,
    reviewed_by_id       UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_candidates_status ON news_scan_candidates (status, created_at DESC);
```

### RLS Policies

```sql
ALTER TABLE news_scan_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_scan_candidates ENABLE ROW LEVEL SECURITY;

-- Service role: full access (scanner runs as system actor)
CREATE POLICY scan_log_service ON news_scan_log USING (true) WITH CHECK (true);
CREATE POLICY candidates_service ON news_scan_candidates USING (true) WITH CHECK (true);

-- Authenticated: read candidates (for admin UI)
CREATE POLICY candidates_read ON news_scan_candidates
    FOR SELECT USING (auth.role() = 'authenticated');
```

### Platform Settings (seeded)

```sql
INSERT INTO platform_settings (setting_key, setting_value) VALUES
    ('news_scanner_enabled', 'false'),
    ('news_scanner_interval_seconds', '21600'),
    ('news_scanner_auto_create', 'false'),
    ('news_scanner_adapters', '["usgs_earthquakes","noaa_alerts","nasa_eonet","guardian"]'),
    ('news_scanner_min_magnitude', '0.20'),
    ('news_scanner_impacts_delay_hours', '4')
ON CONFLICT (setting_key) DO NOTHING;
```

---

## IV. Configuration

| Setting Key | Type | Default | Description |
|-------------|------|---------|-------------|
| `news_scanner_enabled` | bool | `false` | Master switch — safe to deploy |
| `news_scanner_interval_seconds` | int | `21600` (6h) | Global scan interval (floor: 3600) |
| `news_scanner_auto_create` | bool | `false` | Auto-create resonances or stage as candidates |
| `news_scanner_adapters` | JSON | `["usgs_earthquakes","noaa_alerts","nasa_eonet","guardian"]` | Enabled adapter names |
| `news_scanner_min_magnitude` | float | `0.20` | Skip results below this threshold |
| `news_scanner_impacts_delay_hours` | int | `4` | Hours from creation until impacts_at |

---

## V. Frontend Design — Substrate Scanner Admin Tab

### A. Design Direction

**Aesthetic:** Surveillance command center. The scanner tab should feel like a SIGINT monitoring station — live feeds, status indicators, incoming data streams. The brutalist typography and monospace readouts reinforce the "Bureau of Substrate Monitoring" fiction from the game world.

**Memorable element:** The **live adapter grid** — 10 source cards with pulsing availability dots, real-time fetch counters, and category coverage badges. At a glance, the admin sees the entire sensor network.

### B. Component: `AdminScannerTab`

Top-level admin tab with 3 sub-views: **Dashboard**, **Candidates**, **Scan Log**.

```
┌──────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════╗    │
│  ║  SUBSTRATE SCANNER  ·  BUREAU OF SUBSTRATE MONITORING   ║    │
│  ╚══════════════════════════════════════════════════════════╝    │
│                                                                  │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────┐               │
│  │ ● DASHBOARD │ │  CANDIDATES  │ │  SCAN LOG  │               │
│  └─────────────┘ └──────────────┘ └────────────┘               │
│                                                                  │
│  ┌─ SENSOR NETWORK ─────────────────────────────────────────┐   │
│  │                                                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │ ● USGS       │  │ ● NOAA       │  │ ● NASA EONET │   │   │
│  │  │ Earthquakes  │  │ Weather      │  │ Events       │   │   │
│  │  │ STRUCTURED   │  │ STRUCTURED   │  │ STRUCTURED   │   │   │
│  │  │ ▓▓▓▓ 14 hits │  │ ▓▓░░  3 hits │  │ ▓░░░  1 hit  │   │   │
│  │  │ 4m ago       │  │ 12m ago      │  │ 28m ago      │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │ ● GDACS      │  │ ● disease.sh │  │ ○ WHO        │   │   │
│  │  │ Disasters    │  │ Pandemic     │  │ Outbreaks    │   │   │
│  │  │ STRUCTURED   │  │ STRUCTURED   │  │ LLM REQUIRED │   │   │
│  │  │ ▓▓░░  5 hits │  │ ▓░░░  0 hits │  │ ░░░░  — —    │   │   │
│  │  │ 30m ago      │  │ 58m ago      │  │ unavailable  │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │ ● Guardian   │  │ ○ NewsAPI    │  │ ● GDELT      │   │   │
│  │  │ News         │  │ News         │  │ Events       │   │   │
│  │  │ LLM REQUIRED │  │ LLM REQUIRED │  │ LLM REQUIRED │   │   │
│  │  │ ▓▓▓░ 12 hits │  │ ░░░░ no key  │  │ ▓▓░░  8 hits │   │   │
│  │  │ 5h ago       │  │ disabled     │  │ 5h ago       │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  │  ┌──────────────┐                                        │   │
│  │  │ ● Hacker News│                                        │   │
│  │  │ Tech         │                                        │   │
│  │  │ LLM REQUIRED │                                        │   │
│  │  │ ▓░░░  2 hits │                                        │   │
│  │  │ 5h ago       │                                        │   │
│  │  └──────────────┘                                        │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ SCAN METRICS ───────────────────────────────────────────┐   │
│  │  ARTICLES SCANNED    CLASSIFIED    RESONANCES TODAY      │   │
│  │       147               23              4                │   │
│  │                                                           │   │
│  │  LAST SCAN: 2026-03-08T14:32:00Z    NEXT: in 5h 28m     │   │
│  │                                                           │   │
│  │  [ ◆ TRIGGER SCAN ]   [ ⚙ SETTINGS ]                    │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### C. Component: Adapter Status Card

Each source is rendered as a compact card in the sensor grid.

```
┌─────────────────────────────┐
│  ● USGS Earthquake Hazards  │  ← green dot = available, red = error
│                              │
│  ┌──────────────────┐       │
│  │ natural_disaster │       │  ← category badge (cyan border)
│  └──────────────────┘       │
│                              │
│  STRUCTURED                  │  ← green text (no LLM cost)
│  ▓▓▓▓░░░░  14 articles      │  ← mini bar chart + count
│  Last: 4 minutes ago         │  ← relative timestamp
│                              │
│  ┌────┐                     │
│  │ ON │                     │  ← toggle switch
│  └────┘                     │
└─────────────────────────────┘
```

**CSS pattern** (follows existing admin card design):
```css
.adapter-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    transition: border-color 0.2s ease;
}

.adapter-card:hover {
    border-color: var(--color-text-muted);
}

.adapter-card--unavailable {
    opacity: 0.5;
    border-style: dashed;
}

.adapter-card__name {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-primary);
    display: flex;
    align-items: center;
    gap: var(--space-2);
}

.adapter-card__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.adapter-card__dot--online {
    background: var(--color-success);
    animation: status-pulse 1.5s ease-in-out infinite alternate;
}

.adapter-card__dot--offline {
    background: var(--color-danger);
}

.adapter-card__type {
    font-family: var(--font-brutalist);
    font-size: 10px;
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
}

.adapter-card__type--structured {
    color: var(--color-success);
}

.adapter-card__type--llm {
    color: var(--color-warning);
}
```

**Sensor grid layout:**
```css
.sensor-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-3);
}
```

### D. Component: Candidate Review Queue

```
┌──────────────────────────────────────────────────────────────────┐
│  CANDIDATE REVIEW QUEUE  (7 pending)                             │
│                                                                  │
│  ┌──────┐ ┌──────┐ ┌──────────┐ ┌──────┐                       │
│  │ ALL  │ │ PEND │ │ APPROVED │ │ REJ  │    🔍 Search...       │
│  └──────┘ └──────┘ └──────────┘ └──────┘                       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ●  M 7.2 Earthquake Strikes Central Turkey                │  │
│  │     ┌──────────────────┐  ████████░░  0.85                 │  │
│  │     │ natural_disaster │                                    │  │
│  │     └──────────────────┘                                    │  │
│  │     USGS · STRUCTURED · 12 min ago                          │  │
│  │     "Major earthquake with mass casualties and tsunami"     │  │
│  │                                                              │  │
│  │     [ ✓ APPROVE ]  [ ✕ REJECT ]  [ ◆ EDIT ]  [ ▾ DETAIL ] │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ●  AI Startup Achieves Quantum Error Correction Milestone │  │
│  │     ┌──────────────────┐  █████░░░░░  0.50                 │  │
│  │     │ tech_breakthrough │                                   │  │
│  │     └──────────────────┘                                    │  │
│  │     HackerNews · LLM · 28 min ago                           │  │
│  │     "Significant AI investment, potential paradigm shift"   │  │
│  │                                                              │  │
│  │     [ ✓ APPROVE ]  [ ✕ REJECT ]  [ ◆ EDIT ]  [ ▾ DETAIL ] │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌ EXPANDED DETAIL ──────────────────────────────────────────┐  │
│  │  Source: https://earthquake.usgs.gov/...                    │  │
│  │  Raw Data:                                                   │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │ { "mag": 7.2, "place": "45km SSE of Pazarcik...",   │   │  │
│  │  │   "alert": "red", "tsunami": 1, ... }               │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │  Bureau Dispatch Preview:                                    │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │ SUBSTRATE MONITORING — DISPATCH #SB-2026-0847         │   │  │
│  │  │                                                        │   │  │
│  │  │ At 14:32 UTC, instruments registered a catastrophic    │   │  │
│  │  │ displacement in the substrate's tectonic layer.        │   │  │
│  │  │ The Deluge archetype has manifested with magnitude     │   │  │
│  │  │ 0.85 — the highest reading since...                    │   │  │
│  │  │                                                        │   │  │
│  │  │ Classification: ALPHA-7 / IMMEDIATE MONITORING         │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**Candidate row CSS** (follows AdminResonancesTab pattern):
```css
.candidate-row {
    display: grid;
    grid-template-columns: 28px 1fr auto;
    align-items: start;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    transition: border-color 0.15s ease, transform 0.15s ease;
}

.candidate-row:hover {
    border-color: var(--color-text-muted);
    transform: translateX(2px);
}

.candidate-row--structured {
    border-left: 3px solid var(--color-success);
}

.candidate-row--llm {
    border-left: 3px solid var(--color-warning);
}

.candidate__reason {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-style: italic;
}

.candidate__dispatch-preview {
    font-family: var(--font-bureau);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    padding: var(--space-3);
    background: color-mix(in srgb, var(--color-info) 4%, var(--color-surface));
    border-left: 2px solid var(--color-info);
    line-height: 1.6;
}
```

### E. Component: Scan History Log

```
┌──────────────────────────────────────────────────────────────────┐
│  SCAN HISTORY                                                    │
│                                                                  │
│  2026-03-08 14:32 UTC ─────────────────────────────────────────  │
│  │                                                               │
│  │  usgs_earthquakes    14 fetched  →  3 classified  →  1 new   │
│  │  noaa_alerts          3 fetched  →  1 classified  →  0 new   │
│  │  nasa_eonet           1 fetched  →  0 classified  →  0 dup   │
│  │  gdacs                5 fetched  →  2 classified  →  1 new   │
│  │  guardian             20 fetched  →  4 classified  →  2 new   │
│  │  gdelt               50 fetched  →  6 classified  →  1 new   │
│  │                                                               │
│  │  Total: 93 fetched → 16 classified → 5 new → 3 resonances   │
│  │  Duration: 8.4s  ·  LLM calls: 1  ·  Cost: ~$0.003          │
│  │                                                               │
│  2026-03-08 08:32 UTC ─────────────────────────────────────────  │
│  │                                                               │
│  │  usgs_earthquakes     8 fetched  →  1 classified  →  0 dup   │
│  │  ...                                                          │
└──────────────────────────────────────────────────────────────────┘
```

**Timeline CSS:**
```css
.scan-timeline {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
}

.scan-entry {
    position: relative;
    padding-left: var(--space-6);
    border-left: 2px solid var(--color-border);
}

.scan-entry::before {
    content: '';
    position: absolute;
    left: -5px;
    top: 0;
    width: 8px;
    height: 8px;
    background: var(--color-info);
    border-radius: 50%;
}

.scan-entry__timestamp {
    font-family: var(--font-brutalist);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-info);
    margin-bottom: var(--space-2);
}

.scan-entry__adapter {
    display: grid;
    grid-template-columns: 160px repeat(3, 1fr);
    gap: var(--space-2);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    padding: var(--space-1) 0;
}

.scan-entry__summary {
    font-family: var(--font-brutalist);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-primary);
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
}
```

### F. Scan Metrics Panel

```css
.metrics-panel {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
}

.metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
}

.metric__value {
    font-family: var(--font-brutalist);
    font-size: var(--text-3xl);
    font-weight: var(--font-black);
    color: var(--color-text-primary);
    line-height: 1;
}

.metric__label {
    font-family: var(--font-brutalist);
    font-size: 10px;
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
    color: var(--color-text-muted);
}

.trigger-scan-btn {
    padding: var(--space-2) var(--space-4);
    font-family: var(--font-brutalist);
    font-weight: var(--font-black);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    background: color-mix(in srgb, var(--color-info) 15%, var(--color-surface));
    color: var(--color-info);
    border: 1px solid var(--color-info);
    cursor: pointer;
    transition: all 0.15s ease;
}

.trigger-scan-btn:hover {
    background: color-mix(in srgb, var(--color-info) 25%, var(--color-surface));
    transform: translateY(-1px);
    box-shadow: 0 0 12px color-mix(in srgb, var(--color-info) 30%, transparent);
}

.trigger-scan-btn:active {
    transform: translateY(0);
}

.trigger-scan-btn--scanning {
    animation: scan-pulse 1s ease-in-out infinite;
    pointer-events: none;
}

@keyframes scan-pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 8px color-mix(in srgb, var(--color-info) 20%, transparent); }
    50% { opacity: 0.7; box-shadow: 0 0 20px color-mix(in srgb, var(--color-info) 40%, transparent); }
}
```

---

## VI. Admin API Endpoints

All under `/api/v1/admin/news-scanner`, platform admin only.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Scanner status: adapter availability, last scan, metrics |
| GET | `/adapters` | List all registered adapters with status, config, last fetch |
| PATCH | `/adapters/{name}` | Enable/disable an adapter |
| POST | `/trigger-scan` | Manually trigger one scan cycle (optional: `adapter_names` filter) |
| GET | `/candidates` | List candidates (filter: status, category, source; paginated) |
| POST | `/candidates/{id}/approve` | Approve → create resonance + mark `created` |
| POST | `/candidates/{id}/reject` | Reject candidate |
| PATCH | `/candidates/{id}` | Edit magnitude/title before approving |
| GET | `/scan-log` | Recent scan history with per-adapter breakdown |

---

## VII. File Structure

```
backend/
  services/
    scanning/
      __init__.py
      base_adapter.py              # SourceAdapter ABC + ScanResult dataclass
      registry.py                  # @register_adapter + get_all/get_by_category
      scanner_service.py           # Orchestrator: fetch → filter → classify → create
      classifier.py                # Batched LLM classification
      deduplicator.py              # source_id + title similarity
      pre_filter.py                # Keyword reject/boost lists
      adapters/
        __init__.py                # Imports all (triggers registration)
        usgs_earthquakes.py        # STRUCTURED
        noaa_alerts.py             # STRUCTURED
        nasa_eonet.py              # STRUCTURED
        gdacs.py                   # STRUCTURED
        disease_sh.py              # STRUCTURED
        who_outbreaks.py           # SEMI-STRUCTURED
        guardian_scanner.py        # UNSTRUCTURED (wraps GuardianService)
        newsapi_scanner.py         # UNSTRUCTURED (wraps NewsAPIService)
        gdelt.py                   # UNSTRUCTURED
        hackernews.py              # SEMI-STRUCTURED
  models/
    news_scanner.py                # Pydantic: ScanCandidate, ApproveRequest, etc.
  routers/
    news_scanner.py                # Admin API endpoints
  tests/
    unit/
      test_news_scanner.py         # Pipeline stage unit tests
      test_scan_adapters.py        # Per-adapter parsing tests
frontend/
  src/
    components/
      admin/
        AdminScannerTab.ts         # Scanner dashboard + candidates + log
supabase/
  migrations/
    084_news_scanner_tables.sql    # Tables + RLS
    085_seed_scanner_settings.sql  # Platform settings defaults
    086_seed_scanner_templates.sql # Classification + dispatch prompt templates
```

### Files to modify

| File | Change |
|------|--------|
| `backend/app.py` | Add `NewsScanner.start()` to lifespan |
| `frontend/src/components/admin/AdminPanel.ts` | Add Scanner tab |

### Existing code reused (no changes)

| File | What |
|------|------|
| `backend/services/external/guardian.py` | GuardianService.browse() |
| `backend/services/external/newsapi.py` | NewsAPIService.browse() |
| `backend/services/external/openrouter.py` | LLM calls |
| `backend/services/resonance_service.py` | ResonanceService.create() |
| `backend/services/resonance_scheduler.py` | Background task pattern |
| `backend/services/platform_api_keys.py` | API key resolution |
| `backend/models/resonance.py` | CATEGORY_ARCHETYPE_MAP, ARCHETYPE_DESCRIPTIONS |

---

## VIII. Cost Analysis

| Per scan cycle (every 6h) | Count | Cost |
|---|---|---|
| Structured API calls (USGS, NOAA, EONET, GDACS, disease.sh) | 5 | $0.00 |
| News API calls (Guardian, GDELT, HN) | 3 | $0.00 |
| LLM classification (1 batched call, ~800 tokens) | 1 | ~$0.001 |
| Bureau dispatch generation (~400 tokens each) | 0-5 | ~$0.005 |
| **Daily total (4 cycles)** | | **~$0.03** |

---

## IX. Implementation Sequence

| Phase | Files | Description |
|-------|-------|-------------|
| 1 | Migrations 084-086 | Database tables, settings, prompt templates |
| 2 | `base_adapter.py`, `registry.py`, `scanner_service.py`, `pre_filter.py`, `deduplicator.py` | Core pipeline infrastructure |
| 3 | `usgs_earthquakes.py`, `noaa_alerts.py`, `nasa_eonet.py`, `gdacs.py`, `disease_sh.py` | Structured adapters (zero LLM cost) |
| 4 | `classifier.py` + migration for prompt template | LLM classification pipeline |
| 5 | `guardian_scanner.py`, `newsapi_scanner.py`, `gdelt.py`, `hackernews.py`, `who_outbreaks.py` | Text-based adapters |
| 6 | `news_scanner.py` (router), `news_scanner.py` (models) | Admin API |
| 7 | `app.py` modification | Lifespan integration |
| 8 | `AdminScannerTab.ts`, `AdminPanel.ts` modification | Frontend admin UI |
| 9 | `test_news_scanner.py`, `test_scan_adapters.py` | Tests |

---

## X. Verification

1. Apply migrations: `supabase migration up`
2. Set `news_scanner_enabled=true` in platform_settings
3. `POST /api/v1/admin/news-scanner/trigger-scan` → verify scan runs
4. `GET /api/v1/admin/news-scanner/dashboard` → verify adapter statuses
5. `GET /api/v1/admin/news-scanner/candidates` → verify candidates staged
6. Approve a candidate → verify resonance created in `substrate_resonances`
7. Set `news_scanner_auto_create=true` → trigger scan → verify auto-created
8. Trigger second scan → verify deduplication (no duplicate resonances)
9. `python -m pytest backend/tests/unit/test_news_scanner.py -v`
10. `python -m pytest backend/tests/ -x -q --ignore=backend/tests/test_operative_service.py`
11. `cd frontend && npx tsc --noEmit`

---

## XI. Game Design Notes

### Why This Matters for Players

The scanner creates a **feedback loop between reality and fiction**. When a real earthquake hits, players in earthquake-susceptible simulations (Speranza: `elemental_surge=1.8`) feel it through destabilized zones, modified operative success rates, and AI-generated in-world events. Players who pay attention to real news gain strategic advantage — they can anticipate incoming resonances and adjust their operative deployments accordingly.

### Magnitude Calibration Philosophy

Not every real event should become a resonance. The scanner uses conservative thresholds:
- **USGS:** Only magnitude 4.0+ earthquakes (thousands per year become ~50 that matter)
- **NOAA:** Only Severe/Extreme alerts (filters out the ~2000 daily minor weather statements)
- **News:** Only significance 4+ on a 1-10 scale (rejects local stories)
- **Global minimum:** `news_scanner_min_magnitude=0.20` (anything below barely registers in-game)

This means players experience ~1-3 resonances per week, not dozens. Each one should feel significant.

### The Bureau Fiction

The "Bureau of Substrate Monitoring" is the in-world explanation for why the game world reacts to reality. Bureau dispatches are the narrative wrapper — clinical, ominous, never directly naming real places. A Turkish earthquake becomes "catastrophic displacement in the substrate's tectonic layer." This maintains the fourth wall while making the real-world connection feel intentional and designed.

---

> **After plan approval:** Save this document to `docs/specs/substrate-scanner.md` as a permanent specification.
