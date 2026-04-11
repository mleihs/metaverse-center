# Zeitungsmodul Redesign -- Analyse & 8 Proposals

> Erstellt: 2026-04-09 | Aktualisiert: 2026-04-09
> Perspektiven: UI/UX-Experte, Game Designer, Zeitungswebseiten-Layout-Experte
> Recherche: 90+ Websuchen, 25+ Referenzseiten, 8 Game-Design-Analysen
> Status: Proposal 1 DONE (4b99e9c). Proposal 2 DETAIL-SPEZIFIKATION.

## Context

Das Zeitungssystem von metaverse.center besteht aus **vier unabhängigen Subsystemen**, die historisch gewachsen und nie als Einheit konzipiert wurden:

| System | Scope | Audience | UI-Form | Datenquelle |
|--------|-------|----------|---------|-------------|
| **Bleed Gazette** | Cross-Sim | Public | 320px Sidebar | DB-Aggregation (Echoes, Embassies, Phasen) |
| **Morning Briefing** | Per-Sim | Authenticated | Ephemeres Modal (120s) | AI-Narrativ + Metriken (24h) |
| **Chronicles** | Per-Sim | Public/Auth | Standalone Page | AI-generierte Broadsheets |
| **Substrate Scanner** | Meta/Admin | Admin-only | Admin Panel | 10 Real-World News-APIs |

### Was sie vereint

1. **Ästhetische DNA**: Alle verwenden Bureau-of-Impossible-Geography-Sprache, Classified-Document-Framing, Monospace-Timestamps, Amber-Akzente, Corner Brackets
2. **Dispatch-Metapher**: Alle liefern "Dispatches" -- Informationspakete über Simulationszustand
3. **Read-Only**: Nutzer konsumieren nur, keine Interaktion/Kommentare/Beiträge
4. **AI-generiert**: Briefing + Chronicles nutzen OpenRouter-Narrative
5. **Bilingual**: EN/DE via `msg()` + `t()` Utilities
6. **Zeitfenster**: Jedes System hat ein Temporal-Konzept (Echtzeit / 24h / Perioden)

### Was sie trennt -- und was problematisch ist

1. **Kein gemeinsames Datenmodell**: Drei völlig verschiedene Datenstrukturen. Kein geteiltes "Article"-Konzept. Keine Cross-Referenzen möglich.
2. **Dreifach dupliziertes Rendering**: Jede Komponente baut eigene Dispatch-Cards mit ~80% visuellem Overlap. `ChronicleFeed.ts` (730 Zeilen), `BleedGazetteSidebar.ts` (517 Zeilen), `DailyBriefingModal.ts` (1016 Zeilen) -- alle mit eigenen Card-Styles, Timestamp-Formatierung, Accent-Bars, Entrance-Animationen.
3. **Informationsinseln**: Gazette verlinkt nicht auf Chronicles. Briefing referenziert keine Gazette-Einträge. Chronicles enthalten keine Scanner-Resonanzen. Die Systeme ignorieren einander.
4. **Kein einheitliches Leseerlebnis**: Ein Nutzer sieht drei verschiedene News-Interfaces an drei verschiedenen Orten mit drei verschiedenen Designs -- ohne dass klar wird, dass sie zusammengehören.
5. **Ephemerer Briefing-Verlust**: Das Morning Briefing wird nach 120s dismissed und ist für immer verloren. Kein Archiv, kein Rückblick.
6. **Flache Chronicle-Struktur**: Chronicles sind rohe Textblöcke ohne Bilder, Sektionen, Kategorien, Pull-Quotes, Bylines oder jegliche editoriale Struktur.
7. **Kein Delivery-Kanal**: Keine Email-Auslieferung, kein RSS, keine Push-Notifications -- obwohl SMTP-Infrastruktur, Email-Templates und Notification-Preferences bereits existieren.
8. **Keine Theme-Adaption**: Die Newspaper-Erfahrung sieht in jeder Simulation gleich aus, obwohl 10 Theme-Presets existieren (brutalist, sunless-sea, cyberpunk, illuminated-literary, etc.).

### Sollte man überarbeiten?

**Ja, aber differenziert.** Die Subsysteme bedienen legitim verschiedene Zwecke auf verschiedenen Scope-Ebenen. Eine Monolith-Zeitung wäre falsch. Die richtige Strategie:

- **Shared Component Layer**: Geteilte Rendering-Bausteine (DispatchCard, Masthead, Byline, etc.) -- visuelle Vereinheitlichung ohne Datenmodell-Vereinheitlichung
- **Aggregation Layer**: Ein neues "Simulation Newspaper" als orchestrierende View, die aus allen Quellen schöpft
- **Distribution Layer**: Newsletter + RSS + Social als Output-Kanäle
- **Die Einzelsysteme bleiben als Datenquellen** -- sie werden nicht ersetzt, sondern in eine höhere Abstraktionsebene eingebettet

---

## Recherche-Fundament

### Award-Winning Reference Sites

| Site | Auszeichnung | Design-Innovation |
|------|-------------|-------------------|
| **The Pudding** (pudding.cool) | SND46 World's Best Digital (2025), Peabody, Emmy-Nominierung | SvelteKit + D3.js, jede Story ein Unikat, 30min Engagement |
| **Washington Post** | SND46 World's Best Digital (joint), OJA Visual Storytelling Gold | Typografie-Meisterschaft, Illustration + Video + Audio-Integration |
| **de Volkskrant** (NL) | SND46 World's Best Newspaper | Virtuose Grid-Anwendung, Whitespace-Meisterschaft |
| **Politico Europe** | SND46 World's Best Newspaper (joint) | Best-in-class Art Direction, rigoroses Grid, Weißraum-Flooding |
| **Rest of World** | SND Gold | "Every story visually unique" -- flexible Komponenten-System |
| **The Verge** | Bold 2022 Redesign | 3 Custom Typefaces, "Storystream" Newsfeed, Duet CMS |
| **Republik** (CH) | Open-Source (Next.js/Express) | Dual Reading Modes, Genossenschafts-Modell |
| **Zetland** (DK) | SND Scandinavia Gold + Best of Show | Audio-First (80%), "finishable" Site (2-4 Stories/Tag) |
| **De Correspondent** (NL) | Red Dot, iF, European Design Awards | Custom "Respondens" CMS, EUR 1M Crowdfunding in 8 Tagen |
| **NZZ** | -- | 500 Komponenten, 24 Sets, 6 Produkte, Livingdocs CMS |
| **Semafor** | Record Profitability 2026 | Trennung Fakten/Meinung/Analyse pro Artikel, AI "Signals" |
| **Axios** | -- | "Smart Brevity" (Eye-Tracking-basiert), 40% kürzere Lesezeiten |
| **Bloomberg Businessweek** | -- | Custom "Brisket" Rendering Engine, modulare Content-Blöcke |
| **Delayed Gratification** | -- | Quarterly Retrospective, Almanac-Struktur, Künstler-Cover |
| **Monocle** | -- | Multi-Platform (Magazin + Radio + Video + Retail), 500+ Filme |
| **Tortoise Media** | -- | "Slow Down, Wise Up", max 5 Stücke/Tag, ThinkIn Live-Diskussionen |
| **Beautiful News** | -- | Single daily visualization, dark backgrounds, neon accents |
| **Financial Times** | WAN-IFRA 2025 | Visual Vocabulary Framework, 254 public GitHub repos, FastCharts |
| **The Marshall Project** | 10 SND Awards 2025 | Serious editorial design, Gold for "Welcome to The Zo" |
| **ProPublica** | -- | "Far/near" design (macro/micro views), "Show Your Work" methodology |

### Game-Design-Referenzen

| Spiel | Newspaper-Mechanik | Design-Lektion |
|-------|-------------------|----------------|
| **Papers Please** | "The Truth of Arstotzka" zwischen Arbeitstagen | Headlines tragend, Body bewusst unleserlich. Scannability > Tiefe |
| **The Republia Times** | Zeitungsredaktion als gesamte Spielmechanik | Lucas Pope: Story-Auswahl = Loyalitäts-Mechanik |
| **Frostpunk** | Zeitung als Moralspiegel | Verzögerter Impact: Zeitung reflektiert Entscheidungen mit editoriellem Urteil |
| **Tropico** | Zeitung als Gebäude + Propagandawerkzeug | Dual-Purpose: narrativ UND mechanisch (8 Work Modes, politische Manipulation) |
| **Democracy 4** | Medienberichte ohne mechanischen Impact | "Make you stop and think" -- Template-basiert, trigger-gesteuert. $0.10/Wort Übersetzungskosten |
| **GTA** | Liberty City Times, Weazel News | Multi-Channel Ecosystem, Bias als Worldbuilding |
| **Eve Online** | The Scope + INN (player-run) | Professionelle In-Lore-Broadcasts + Player Journalism Ökosystem |
| **Crusader Kings** | Chronicle-System | Living Archive -- prozedurale Geschichte mit editorischer Stimme |
| **Disco Elysium** | Zeitungen als Lore-Artefakte | Zeitungen erzählen Welt-Geschichte durch das, was sie NICHT sagen |
| **Animal Crossing** | Bulletin Board + gelber Vogel | Bestes Notification-Design im Gaming -- charmant, nicht-intrusiv |
| **Dwarf Fortress** | Legends Mode | Umfassendste prozedurale Geschichtsschreibung aller Zeiten |

### UI/UX-Patterns & Technologie

- **CSS Multi-Column**: `column-width: 40ch` + Chrome 145 `column-height`/`column-wrap` -- echtes Zeitungslayout
- **CSS Subgrid**: 97%+ Support, ermöglicht verschachtelte Zeitungs-Grids
- **CSS Container Queries**: Editorial Cards die sich ihrem Container anpassen
- **`initial-letter`**: 91%+ Support -- Drop Caps wie in Print
- **`text-wrap: balance`**: 90%+ Support -- ausgewogene Headlines
- **Scroll-driven Animations**: `animation-timeline: scroll()` -- 0.16ms/frame vs 1ms traditional (NRK-Studie)
- **Variable Fonts**: 34% Mobile-Nutzung, Optical Size Axis für Headline-to-Body-Transitions
- **Newsletter-Patterns**: Morning Brew (Headline-Image-Body), TLDR (Emoji-Sektionen), Dense Discovery (kuratierte Querschnitte)
- **Dark Mode Editorial**: Nie reines Schwarz (`#121212`-`#1F1F1F`), erhöhtes Font-Weight, `light-dark()` CSS-Funktion
- **Gamification**: Daily Quizzes, Prediction Challenges, Streaks/Badges -- ~60% Engagement-Steigerung ($29B Markt 2025)
- **Print-to-Digital**: `shape-outside` für organische Text-Umbrüche, `initial-letter` Drop Caps, Above-the-fold: 84% mehr Aufmerksamkeit
- **Newspaper-Komponenten-Taxonomie**: Nameplate, Masthead, Ears, Folio, Kicker, Deck, Byline, Dateline, Lede, Nut Graf, Cutline, Jump Line, Refer

---

## Proposal 1: The Unified Dispatch Component Library

### Konzept

Ein geteiltes Komponentensystem, das die dreifache CSS-Duplizierung eliminiert und ein konsistentes visuelles Vokabular für alle News-Oberflächen schafft. Keine Datenmodell-Änderung -- rein Frontend.

### Komponenten-Taxonomie

```
velg-dispatch-card         -- Basis-Card mit Accent-Bar, Timestamp, Entrance-Animation
velg-dispatch-masthead     -- Zeitungs-Kopf mit Titel, Datum, Editions-Nr., Theme-Farbe
velg-dispatch-byline       -- Autor/Quelle mit Avatar, Timestamp, Kategorie-Badge
velg-dispatch-headline     -- Headline mit fluid Typography (clamp), text-wrap: balance
velg-dispatch-excerpt      -- Content-Preview mit line-clamp, initial-letter Option
velg-dispatch-ticker       -- Scrollender Ticker (extrahiert aus ChronicleFeed)
velg-dispatch-stamp        -- "DECODED" / "CLASSIFIED" / "FILED" Stempel
velg-dispatch-strength     -- 1-5 Dot-Indikator (extrahiert aus Gazette)
velg-dispatch-section      -- Sektions-Divider mit Brutalist-Label
```

### Migrations-Strategie

Die bestehenden 3 Komponenten werden schrittweise auf die Shared Library migriert:
1. Shared Components erstellen, getestet gegen alle 10 Theme-Presets
2. `BleedGazetteSidebar` migrieren (simpelste Struktur)
3. `ChronicleFeed` migrieren (mittlere Komplexität)
4. `DailyBriefingModal` migrieren (komplexeste, wegen Corner Brackets + Scanlines)

### Code-Reduktion

Geschätzt: ~800 Zeilen CSS-Duplizierung eliminiert. Statt 2263 Zeilen in 3 Komponenten -> ~600 Zeilen Shared + 3 x ~200 Zeilen Spezifik = ~1200 Zeilen total.

### Technologie-Nuggets

- **CSS `@layer` für Component Composition**: `@layer dispatch-base, dispatch-variant` -- saubere Specificity-Kaskade
- **CSS Anchor Positioning** (Chrome 125+): Dispatch-Stamps relativ zu Card-Corners positionieren ohne absolute Positioning
- **`text-wrap: balance`**: Auf alle Headlines anwenden -- SND-Winner-Technik von de Volkskrant
- **NewsKit** (News UK): Open-Source Editorial Design System als Referenz-Architektur

### Quellen

- NZZ Design System: 500 Komponenten, 24 Sets, 6 Produkte (WAN-IFRA 2025)
- NewsKit (News UK): Open-Source Editorial Design System
- SND46 Competition Results (2025)

---

## Proposal 2: The Simulation Broadsheet -- Theme-Adaptive Newspaper View (DETAIL)

> Status: Detaillierte Implementierungsspezifikation
> Abhängigkeiten: Proposal 1 (Unified Dispatch Component Library) -- DONE
> Geschätzter Scope: ~2500 Zeilen Frontend, ~400 Zeilen Backend, 1 Migration

### Konzept

Eine dedizierte Zeitungs-View pro Simulation (`/simulations/{slug}/broadsheet`), die als immersives, theme-adaptives Leseerlebnis **alle vier Nachrichtenquellen** in einer einzigen "Ausgabe" aggregiert. Jede Simulation erhält ihre eigene Zeitung, die sich automatisch dem aktiven Theme-Preset anpasst -- von der Typografie über Schatten bis zur Papiermetapher.

**Design-Philosophie:**
- **Zetland-Prinzip** ("finishable"): Maximal 7 Artikel pro Ausgabe. Kein Endlos-Scroll.
- **de Volkskrant-Grid**: Rigoroses 8-Spalten-Grid mit hierarchischer Headline-Gewichtung.
- **Frostpunk-Moralspiegel**: Simulation-Health beeinflusst den visuellen Ton (alarmiert bei < 25%).
- **Semafor-Struktur**: Fakten / Analyse / Kontext getrennt pro Artikel.

### 1. Architektur-Übersicht

```
Frontend                              Backend
--------                              -------
VelgSimulationBroadsheet              GET /api/v1/simulations/{id}/broadsheet
  +-- VelgDispatchMasthead (shared)     +-- BroadsheetService
  +-- VelgBroadsheetHealthHero            +-- get_source_data() via RPC
  +-- VelgBroadsheetHeroArticle           +-- compile_edition()
  +-- VelgBroadsheetColumns               +-- list_editions()
  |     +-- VelgBroadsheetArticle (x5)  GET /api/v1/public/simulations/{id}/broadsheet
  +-- VelgBroadsheetGazetteWire
  +-- VelgBroadsheetFooter              DB: simulation_broadsheets table
  +-- VelgDispatchTicker (shared)       DB: RPC get_broadsheet_source_data()
```

### 2. Backend-Spezifikation

#### 2.1 Neues Datenmodell: `simulation_broadsheets`

```sql
CREATE TABLE simulation_broadsheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  edition_number INT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Masthead
  title TEXT NOT NULL,
  title_de TEXT,
  subtitle TEXT,
  subtitle_de TEXT,

  -- Aggregated content (JSONB for flexible article structure)
  articles JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Each article: {type, headline, headline_de, content, content_de,
  --   source_type, source_id, image_url, layout_hint, priority}

  -- Snapshot data (frozen at generation time)
  health_snapshot JSONB,       -- {overall_health, health_label, avg_stability}
  mood_snapshot JSONB,         -- {happy, unhappy, crisis, dominant_emotion}
  statistics JSONB,            -- {event_count, activity_count, agents_affected}
  gazette_wire JSONB,          -- [{entry_type, narrative, source_sim, created_at}]

  -- Metadata
  editorial_voice TEXT DEFAULT 'neutral',  -- neutral|alarmed|optimistic|satirical
  model_used TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(simulation_id, edition_number)
);

-- RLS: Public read for active simulations, editor+ write
ALTER TABLE simulation_broadsheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY broadsheet_public_read ON simulation_broadsheets
  FOR SELECT USING (
    (SELECT s.status FROM simulations s WHERE s.id = simulation_id) = 'active'
  );

CREATE POLICY broadsheet_editor_write ON simulation_broadsheets
  FOR ALL USING (
    (SELECT user_has_simulation_role(simulation_id, 'editor'))
  );
```

#### 2.2 Aggregations-RPC: `get_broadsheet_source_data`

```sql
CREATE OR REPLACE FUNCTION get_broadsheet_source_data(
  p_simulation_id UUID,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'events', (
      SELECT COALESCE(jsonb_agg(row_to_json(e.*) ORDER BY e.impact_level DESC), '[]')
      FROM (
        SELECT id, title, event_type, description, occurred_at,
               impact_level, tags, event_status, data_source
        FROM events
        WHERE simulation_id = p_simulation_id
          AND occurred_at BETWEEN p_period_start AND p_period_end
          AND deleted_at IS NULL
        ORDER BY impact_level DESC
        LIMIT 20
      ) e
    ),
    'activities', (
      SELECT COALESCE(jsonb_agg(row_to_json(a.*) ORDER BY a.significance DESC), '[]')
      FROM (
        SELECT aa.id, aa.activity_type, aa.narrative_text, aa.narrative_text_de,
               aa.significance, aa.effects, ag.name AS agent_name
        FROM agent_activities aa
        JOIN agents ag ON ag.id = aa.agent_id
        WHERE aa.simulation_id = p_simulation_id
          AND aa.created_at BETWEEN p_period_start AND p_period_end
          AND aa.significance >= 5
        ORDER BY aa.significance DESC
        LIMIT 15
      ) a
    ),
    'resonance_impacts', (
      SELECT COALESCE(jsonb_agg(row_to_json(ri.*)), '[]')
      FROM (
        SELECT ri.id, ri.effective_magnitude, ri.status, ri.narrative_context,
               r.title AS resonance_title, r.source_category
        FROM resonance_impacts ri
        JOIN substrate_resonances r ON r.id = ri.resonance_id
        WHERE ri.simulation_id = p_simulation_id
          AND ri.created_at BETWEEN p_period_start AND p_period_end
        ORDER BY ri.effective_magnitude DESC
        LIMIT 5
      ) ri
    ),
    'mood_summary', (
      SELECT jsonb_build_object(
        'avg_mood', AVG(mood_score),
        'avg_stress', AVG(stress_level),
        'crisis_count', COUNT(*) FILTER (WHERE stress_level > 800),
        'happy_count', COUNT(*) FILTER (WHERE mood_score > 60),
        'unhappy_count', COUNT(*) FILTER (WHERE mood_score < 30)
      )
      FROM agent_mood am
      JOIN agents ag ON ag.id = am.agent_id
      WHERE ag.simulation_id = p_simulation_id
    ),
    'gazette_entries', (
      SELECT COALESCE(jsonb_agg(row_to_json(g.*) ORDER BY g.created_at DESC), '[]')
      FROM (
        SELECT entry_type, narrative, source_simulation, target_simulation,
               echo_vector, strength, created_at
        FROM bleed_gazette_entries_v  -- Use the view
        WHERE source_simulation->>'id' = p_simulation_id::text
           OR target_simulation->>'id' = p_simulation_id::text
        ORDER BY created_at DESC
        LIMIT 5
      ) g
    ),
    'health', (
      SELECT row_to_json(h.*)
      FROM simulation_health h
      WHERE h.simulation_id = p_simulation_id
      LIMIT 1
    )
  ) INTO result;

  RETURN result;
END;
$$;
```

#### 2.3 Backend-Service: `BroadsheetService`

```python
# backend/services/broadsheet_service.py

class BroadsheetService(BaseService):
    """Aggregates all news sources into a unified broadsheet edition."""

    FINISHABLE_LIMIT = 7  # Zetland principle: max articles per edition

    async def compile_edition(
        self, simulation_id: UUID, period_start: datetime, period_end: datetime
    ) -> BroadsheetResponse:
        # 1. Fetch aggregated source data via RPC
        source = await self._call_rpc(
            'get_broadsheet_source_data',
            {'p_simulation_id': str(simulation_id),
             'p_period_start': period_start.isoformat(),
             'p_period_end': period_end.isoformat()}
        )

        # 2. Rank and deduplicate into articles
        articles = self._rank_articles(source)[:self.FINISHABLE_LIMIT]

        # 3. Determine editorial voice from health
        health = source.get('health', {})
        voice = self._derive_voice(health)

        # 4. Generate AI headlines + summaries (bilingual)
        articles = await self._enrich_with_ai(articles, voice, simulation_id)

        # 5. Get next edition number
        edition_number = await self._next_edition_number(simulation_id)

        # 6. Persist
        broadsheet = await self._insert('simulation_broadsheets', {
            'simulation_id': str(simulation_id),
            'edition_number': edition_number,
            'period_start': period_start.isoformat(),
            'period_end': period_end.isoformat(),
            'title': articles[0]['headline'] if articles else 'No News',
            'articles': articles,
            'health_snapshot': health,
            'mood_snapshot': source.get('mood_summary'),
            'statistics': self._compute_statistics(source),
            'gazette_wire': source.get('gazette_entries', []),
            'editorial_voice': voice,
        })

        return BroadsheetResponse(**broadsheet)

    def _rank_articles(self, source: dict) -> list[dict]:
        """Priority: critical events > resonances > high-significance activities > gazette."""
        ranked = []
        for event in source.get('events', []):
            ranked.append({
                'source_type': 'event',
                'source_id': event['id'],
                'priority': event['impact_level'] * 10,
                'headline': event['title'],
                'content': event.get('description', ''),
                'layout_hint': 'hero' if event['impact_level'] >= 8 else 'column',
            })
        for impact in source.get('resonance_impacts', []):
            ranked.append({
                'source_type': 'resonance',
                'source_id': impact['id'],
                'priority': int(impact['effective_magnitude'] * 80),
                'headline': impact.get('resonance_title', 'Cross-Reality Disturbance'),
                'content': impact.get('narrative_context', ''),
                'layout_hint': 'column',
            })
        for activity in source.get('activities', []):
            ranked.append({
                'source_type': 'activity',
                'source_id': activity['id'],
                'priority': activity['significance'] * 8,
                'headline': f"{activity['agent_name']}: {activity['activity_type']}",
                'content': activity.get('narrative_text', ''),
                'layout_hint': 'sidebar',
            })
        ranked.sort(key=lambda a: a['priority'], reverse=True)
        # Ensure max 1 hero article
        hero_found = False
        for article in ranked:
            if article['layout_hint'] == 'hero':
                if hero_found:
                    article['layout_hint'] = 'column'
                hero_found = True
        return ranked

    def _derive_voice(self, health: dict) -> str:
        """Frostpunk moral mirror: health determines editorial tone."""
        pct = (health.get('overall_health') or 0.5) * 100
        if pct < 25:
            return 'alarmed'
        if pct < 50:
            return 'concerned'
        if pct > 85:
            return 'optimistic'
        return 'neutral'
```

#### 2.4 API-Endpoints

```python
# backend/routers/broadsheets.py

@router.get("/simulations/{simulation_id}/broadsheets")
async def list_broadsheets(
    simulation_id: UUID,
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
) -> PaginatedResponse[BroadsheetResponse]: ...

@router.get("/simulations/{simulation_id}/broadsheets/latest")
async def get_latest_broadsheet(
    simulation_id: UUID,
) -> SuccessResponse[BroadsheetResponse | None]: ...

@router.post("/simulations/{simulation_id}/broadsheets")
async def generate_broadsheet(
    simulation_id: UUID,
    body: BroadsheetGenerateRequest,  # period_start, period_end
    role=Depends(require_role("editor")),
) -> SuccessResponse[BroadsheetResponse]: ...

# Public
@public_router.get("/simulations/{simulation_id}/broadsheets/latest")
async def public_latest_broadsheet(
    simulation_id: UUID,
) -> SuccessResponse[BroadsheetResponse | None]: ...
```

### 3. Frontend-Komponentenarchitektur

#### 3.1 Haupt-View: `VelgSimulationBroadsheet`

Route: `/simulations/{slug}/broadsheet`

```
VelgSimulationBroadsheet
|
+-- VelgDispatchMasthead              (shared, Proposal 1)
|     classification="Bureau Gazette"
|     title="The {Sim-Name} Broadsheet"
|     subtitle="Edition #7 -- Cycle 12, Day 4"
|     themeColor={getThemeColor(sim.theme)}
|
+-- VelgDispatchTicker                (shared, Proposal 1)
|     items={top 5 headlines}
|
+-- .broadsheet (CSS Grid container)
|   |
|   +-- .broadsheet__hero             (grid-column: 1 / -1)
|   |     VelgBroadsheetHeroArticle
|   |       headline, lede with drop cap, optional image
|   |       VelgDispatchStamp tone="danger" (if voice=alarmed)
|   |
|   +-- .broadsheet__health           (grid-column: sidebar)
|   |     VelgBroadsheetHealthHero
|   |       health bar, mood summary, arc pressure
|   |
|   +-- .broadsheet__columns          (grid-column: main, CSS multi-column)
|   |     VelgBroadsheetArticle x 4-6
|   |       headline, excerpt, source badge, read-more
|   |
|   +-- .broadsheet__wire             (grid-column: sidebar)
|   |     VelgBroadsheetGazetteWire
|   |       5 most recent cross-sim echoes
|   |
|   +-- .broadsheet__fold             (grid-column: 1 / -1)
|         Visual fold line (broadsheet crease)
|         "Above the fold" / "Below the fold" marker
|
+-- .broadsheet__footer
|     Previous editions archive links
|     Newsletter CTA (if P5 implemented)
|     "You've read everything" completion marker
|
+-- velg-platform-footer
```

#### 3.2 CSS Grid Layout

```css
.broadsheet {
  display: grid;
  grid-template-columns: 1fr 280px;
  grid-template-rows: auto auto 1fr auto;
  gap: var(--space-6);
  max-width: var(--container-xl);
  margin: 0 auto;
  padding: 0 var(--space-6);
}

.broadsheet__hero {
  grid-column: 1 / -1;
  border-bottom: 3px double var(--color-border);
  padding-bottom: var(--space-8);
}

.broadsheet__columns {
  grid-column: 1;
  column-width: 28ch;
  column-gap: var(--space-6);
  column-rule: 1px solid var(--color-border-light);
  column-fill: balance;
}

.broadsheet__health {
  grid-column: 2;
  grid-row: 2;
  position: sticky;
  top: calc(var(--header-height) + var(--space-4));
  height: fit-content;
}

.broadsheet__wire {
  grid-column: 2;
  grid-row: 3;
}

.broadsheet__fold {
  grid-column: 1 / -1;
  position: relative;
  height: 1px;
  background: linear-gradient(
    to right,
    transparent 0%,
    var(--color-border-light) 10%,
    var(--color-border-light) 90%,
    transparent 100%
  );
  margin: var(--space-4) 0;
}

.broadsheet__fold::after {
  content: attr(data-label);
  position: absolute;
  left: 50%;
  top: -8px;
  transform: translateX(-50%);
  font-family: var(--font-brutalist);
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  background: var(--color-surface);
  padding: 0 var(--space-3);
}

/* ── Drop Cap (Hero Article Lede) ─────────── */

.broadsheet__hero-lede::first-letter {
  initial-letter: 3;
  font-family: var(--heading-font);
  font-weight: var(--heading-weight);
  color: var(--color-primary);
  margin-right: var(--space-2);
}

@supports not (initial-letter: 3) {
  .broadsheet__hero-lede::first-letter {
    float: left;
    font-size: 3.5em;
    line-height: 0.8;
    padding-right: var(--space-2);
    padding-top: 4px;
  }
}

/* ── Container Queries for Article Cards ──── */

.broadsheet__article-wrap {
  container-type: inline-size;
  container-name: article;
}

@container article (min-width: 400px) {
  .broadsheet__article {
    display: grid;
    grid-template-columns: 1fr 120px;
    gap: var(--space-4);
  }
}

@container article (max-width: 399px) {
  .broadsheet__article {
    display: flex;
    flex-direction: column;
  }
}

/* ── Responsive Breakpoints ───────────────── */

@media (max-width: 1024px) {
  .broadsheet {
    grid-template-columns: 1fr;
  }
  .broadsheet__health {
    grid-column: 1;
    grid-row: auto;
    position: static;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--space-3);
  }
  .broadsheet__wire {
    grid-column: 1;
    grid-row: auto;
  }
  .broadsheet__columns {
    column-width: 24ch;
  }
}

@media (max-width: 640px) {
  .broadsheet__columns {
    columns: 1;
  }
  .broadsheet {
    padding: 0 var(--space-4);
  }
}
```

### 4. Theme-Adaption: 10 Zeitungsmetaphern (Detailliert)

Die Broadsheet-View erbt alle Token-Overrides automatisch vom ThemeService. Zusätzlich werden theme-spezifische Atmosphäreneffekte via CSS-Klassen angewendet, die aus dem aktiven Preset abgeleitet werden.

#### 4.1 Theme-Mapping-Tabelle (Exakte Token-Werte)

| Preset | Masthead-Font | Body-Font | Drop-Cap Farbe | Shadow | Zeitungsmetapher | Atmosphäreneffekt |
|--------|---------------|-----------|----------------|--------|-------------------|-------------------|
| **brutalist** | Oswald 900 uppercase 1px | system-ui | #000000 | offset 4px | Drahtnachricht | Keine Filter, hard shadows |
| **sunless-sea** | Cormorant Garamond 700 | Lora | #0d7377 | glow #00e5cc | Unterwasser-Gazette | `filter: url(#parchment-noise)` auf Hero, teal `column-rule` |
| **cyberpunk** | Arial Narrow 900 uppercase 0.08em | Rajdhani | #ff6b2b | glow #ff6b2b | Holo-Newsfeed | Scanline overlay auf `.broadsheet`, neon `column-rule`, CRT-Vignette |
| **illuminated-literary** | Libre Baskerville 700 | Cormorant | #B8860B (Gold) | blur #8B7D6B88 | Illustrierte Monatsschrift | Gilded Drop Cap mit `text-shadow: 0 0 8px #B8860B40`, floral `column-rule` ornament |
| **deep-space-horror** | Space Mono 700 uppercase 0.12em | IBM Plex Sans | #00cc88 | glow #00cc88 | Schiffstagebuch | `filter: url(#ghost-text-blur)` auf Excerpts, phosphor-grüne `column-rule`, Scanlines |
| **nordic-noir** | Inter 500 -0.01em | Inter | #64748b | blur #64748b | Polizeibericht | Keine Filter, blur shadows, minimale Ornamente, 4px border-radius |
| **arc-raiders** | Barlow 800 uppercase 0.06em | Source Sans 3 | #C08A10 | offset #8B7D6B | Werkstatt-Bulletin | Parchment-Hintergrund, `column-rule: 2px solid var(--color-border)`, Nieten-Corners via `::before`/`::after` |
| **solarpunk** | Georgia 600 capitalize 0.02em | Nunito Sans | #16a34a | blur #16a34a | Community-Bulletin | 12px border-radius, spring-easing auf Entrance, grüne `column-rule`, keine sharp edges |
| **vbdos** | VT323 700 uppercase 0.15em | IBM Plex Mono | #AA00AA | offset #000 | DOS-Terminal-Ausgabe | Scanline overlay, `column-rule: 1px solid var(--color-border)` cyan, steps(3) easing, `C:\BROADSHEET>` Prompt im Masthead |
| **deep-fried-horror** | Comic Sans 900 uppercase 0.2em | Courier New | #FF00FF | offset #FF0000 | Satiremagazin | Chaotische `column-rule` (abwechselnd rot/magenta/cyan), steps(4) easing, SCHREIENDES Layout |

#### 4.2 Theme-Atmosphäre als CSS-Klasse

```typescript
// Derived from simulation theme preset in VelgSimulationBroadsheet
private _getAtmosphereClass(): string {
  const preset = this._themePreset; // from ThemeService
  switch (preset) {
    case 'cyberpunk':
    case 'deep-space-horror':
    case 'vbdos':
      return 'broadsheet--scanlines';
    case 'sunless-sea':
    case 'illuminated-literary':
    case 'arc-raiders':
      return 'broadsheet--textured';
    default:
      return '';
  }
}
```

```css
/* Scanline overlay for terminal themes */
.broadsheet--scanlines::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(255, 255, 255, 0.015) 2px,
    rgba(255, 255, 255, 0.015) 4px
  );
  pointer-events: none;
  z-index: 1;
}

/* Paper texture for literary/physical themes */
.broadsheet--textured {
  background-image: url("data:image/svg+xml,..."); /* inline noise pattern */
  background-blend-mode: multiply;
}
```

### 5. Artikel-Struktur und Inhaltstypen

#### 5.1 ArticleBlock Interface

```typescript
interface BroadsheetArticle {
  source_type: 'event' | 'resonance' | 'activity' | 'chronicle' | 'gazette';
  source_id: string;
  priority: number;
  layout_hint: 'hero' | 'column' | 'sidebar' | 'ticker';

  headline: string;
  headline_de?: string;
  content: string;
  content_de?: string;

  // Optional enrichment
  image_url?: string;
  agent_name?: string;
  impact_level?: number;
  tags?: string[];
}
```

#### 5.2 Layout-Hint-Rendering

| Layout Hint | Grid-Position | Typografie | Verhalten |
|-------------|---------------|------------|-----------|
| `hero` | `grid-column: 1 / -1` (full width) | `--text-2xl`, Drop Cap, serif | Max 1 pro Ausgabe. Obligatorisch wenn ein Event impact_level >= 8. |
| `column` | In CSS multi-column flow | `--text-lg` headline, `--text-base` body | 2-4 pro Ausgabe. Kann CSS `break-inside: avoid` für Spaltenumbruch. |
| `sidebar` | `grid-column: 2` (rechts) | `--text-sm` headline, `--text-xs` body | Kompakte Agent-Aktivitäten, Gazette-Wire. Max 3. |
| `ticker` | Im Ticker-Band | Monospace, einzeilig | Nur Headlines, keine Excerpts. Max 8. |

### 6. Health-Hero-Komponente

```typescript
// VelgBroadsheetHealthHero: Frozen health snapshot from edition generation time

@customElement('velg-broadsheet-health-hero')
export class VelgBroadsheetHealthHero extends LitElement {
  @property({ type: Object }) health: HealthSnapshot | null = null;
  @property({ type: Object }) mood: MoodSnapshot | null = null;
  @property({ type: Object }) statistics: StatisticsSnapshot | null = null;

  // Reuses dispatch-stat classes from dispatch-styles.ts
  // Reuses health bar pattern from DailyBriefingModal
  // Adds: mood pie chart (tiny ECharts), agent count badges
}
```

### 7. "Finishable" Design-System

#### 7.1 Edition-Vollständigkeitsanzeige

Am Ende jeder Ausgabe: ein visuelles "Du hast alles gelesen"-Signal.

```css
.broadsheet__complete {
  text-align: center;
  padding: var(--space-12) var(--space-6);
  border-top: 1px dashed var(--color-border-light);
}

.broadsheet__complete-mark {
  font-family: var(--font-brutalist);
  font-size: var(--text-4xl);
  color: var(--color-primary);
  opacity: 0.15;
  line-height: 1;
  margin-bottom: var(--space-4);
}

.broadsheet__complete-text {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
```

Das Symbol variiert per Theme:
- **brutalist**: `///` (triple slash)
- **sunless-sea**: `~` (Welle)
- **cyberpunk**: `[EOF]`
- **illuminated-literary**: `Finis.` (kursiv, serif)
- **deep-space-horror**: `> END TRANSMISSION_`
- **vbdos**: `C:\> EXIT`

#### 7.2 Lesefortschritt (CSS-only Reading Progress)

```css
.broadsheet__progress {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--color-primary);
  transform-origin: left;
  animation: broadsheet-progress linear;
  animation-timeline: scroll(nearest block);
  z-index: var(--z-header);
}

@keyframes broadsheet-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

@media (prefers-reduced-motion: reduce) {
  .broadsheet__progress { display: none; }
}
```

### 8. Frostpunk-Moralspiegel: Health-Responsive Design

Die Simulation-Health (0-100%) beeinflusst den visuellen Ton der Ausgabe:

| Health | Voice | Visueller Effekt |
|--------|-------|------------------|
| **85-100%** | `optimistic` | Grüne Akzente, `--color-success` Masthead-Glow |
| **50-84%** | `neutral` | Standard Theme-Farben |
| **25-49%** | `concerned` | Warning-farbige `column-rule`, leicht erhöhter Kontrast |
| **0-24%** | `alarmed` | Danger-Akzente, pulsierender Health-Bar, Breaking-News-Banner über dem Masthead, Hero-Artikel-Headline in `--color-danger` |

```css
/* Breaking News Banner (only when voice = alarmed) */
.broadsheet__breaking {
  background: var(--color-danger);
  color: var(--color-text-inverse);
  font-family: var(--font-brutalist);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  text-align: center;
  padding: var(--space-2) var(--space-4);
  animation: breaking-pulse 2s ease-in-out infinite;
}

@keyframes breaking-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

### 9. Routing und Navigation

```typescript
// In app-shell.ts, add new route:
{
  path: '/simulations/:id/broadsheet',
  render: ({ id }) => this._renderSimulationView(id, 'broadsheet'),
  enter: async ({ id }) => this._enterSimulationRoute(id, 'broadsheet'),
}
```

Navigation-Tab in der SimulationShell: Icon `icons.newspaper()` (neu), Label `msg('Broadsheet')`.

### 10. Implementierungs-Roadmap

| Schritt | Dateien | Geschätzter Aufwand |
|---------|---------|---------------------|
| **10.1** Migration + RPC | `supabase/migrations/XXX_broadsheet_tables.sql` | ~120 Zeilen SQL |
| **10.2** Backend-Model | `backend/models/broadsheet.py` | ~60 Zeilen |
| **10.3** Backend-Service | `backend/services/broadsheet_service.py` | ~250 Zeilen |
| **10.4** Backend-Router | `backend/routers/broadsheets.py` | ~80 Zeilen |
| **10.5** Frontend: HealthHero | `frontend/src/components/broadsheet/BroadsheetHealthHero.ts` | ~200 Zeilen |
| **10.6** Frontend: HeroArticle | `frontend/src/components/broadsheet/BroadsheetHeroArticle.ts` | ~150 Zeilen |
| **10.7** Frontend: ArticleCard | `frontend/src/components/broadsheet/BroadsheetArticle.ts` | ~180 Zeilen |
| **10.8** Frontend: GazetteWire | `frontend/src/components/broadsheet/BroadsheetGazetteWire.ts` | ~120 Zeilen |
| **10.9** Frontend: Main View | `frontend/src/components/broadsheet/SimulationBroadsheet.ts` | ~500 Zeilen |
| **10.10** Frontend: Broadsheet styles | `frontend/src/components/broadsheet/broadsheet-styles.ts` | ~300 Zeilen |
| **10.11** Routing + Navigation | `app-shell.ts`, `SimulationShell.ts` | ~30 Zeilen delta |
| **10.12** Lint + Theme-Verification | Alle 10 Presets visuell prüfen | -- |

**Total: ~1990 Zeilen neue Dateien + ~30 Zeilen Routing-Delta**

### Quellen

- [CSS-Tricks: Newspaper Layout with CSS Grid and Border Lines](https://css-tricks.com/techniques-for-a-newspaper-layout-with-css-grid-and-border-lines-between-elements/) -- Marco Troost, Grid-Lines-Technik für Spaltentrennlinien
- [CSS-Tricks: New Multi-Column Layout Features](https://css-tricks.com/css-multi-column-layout-wrapping-features/) -- Chrome 145 column-wrap/column-height
- [Chrome DevBlog: initial-letter](https://developer.chrome.com/blog/control-your-drop-caps-with-css-initial-letter) -- Drop Cap mit 95%+ Support
- [MDN: CSS Container Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries) -- Component-responsive Article Cards
- [web.dev: Container Query Card Pattern](https://web.dev/patterns/layout/container-query-card/) -- Google's Referenzimplementation
- [Smashing Magazine: Drop Caps Historical Use](https://www.smashingmagazine.com/2012/04/drop-caps-historical-use-and-current-best-practices/) -- Historischer Kontext + Best Practices
- de Volkskrant (SND46 World's Best Newspaper) -- 8-Spalten-Grid, Whitespace-Hierarchie
- Zetland (SND Scandinavia Gold + Best of Show) -- "Finishable" Prinzip, max 2-4 Stories/Tag
- Frostpunk (11 bit studios) -- Newspaper as delayed moral mirror, health-responsive tone
- Semafor -- Fakten/Analyse/Kontext-Trennung pro Artikel
- Axios "Smart Brevity" (ISBN 978-1982190439) -- Eye-Tracking-basierte Artikelstruktur
- NRK Scroll-driven Animation Study -- `animation-timeline: scroll()` 0.16ms/frame Performance

---

## Proposal 3: The Diegetic Newspaper -- In-World Game Object

### Konzept

Inspiriert von Papers Please, Tropico und Disco Elysium: Die Zeitung als **diegetisches Artefakt innerhalb der Simulationswelt**. Nicht "eine Webpage die wie eine Zeitung aussieht", sondern ein Gegenstand, den Agenten produzieren, der Meinungen formt und der Spielmechanik beeinflusst.

### Game-Design-Mechaniken

**1. Zeitung als produziertes Artefakt**
- Simulations-Architekten konnen eine "Printing Press" als Building deployen
- Das Building hat einen zugewiesenen Agenten ("Editor-in-Chief")
- Der Editor-Agent kuratiert automatisch aus: Events, Agent-Aktivitaten, Resonanzen, Weather
- Sein Personlichkeitsprofil + Stimmung beeinflusst den redaktionellen Ton (Papers Please: Staatspropaganda; Tropico: Opposition vs. Regierungsblatt)

**2. Bias als Worldbuilding (GTA/Eve Online-Prinzip)**
- Jede Simulation kann mehrere Zeitungen haben mit verschiedenen "Editorial Stances"
- Stance-Achsen: Optimist/Pessimist, Establishment/Opposition, Sensationalist/Analytical
- Derselbe Event wird von verschiedenen Zeitungen unterschiedlich berichtet
- AI-Prompt-Templates pro Stance: "Report this event from the perspective of a deeply cynical opposition editor"

**3. Moralspiegel (Frostpunk-Mechanik)**
- Die Zeitung reflektiert Architekten-Entscheidungen mit Verzogerung
- "PEOPLE DEMAND ANSWERS: Third consecutive cycle without zone maintenance"
- Headline-Severity steigt mit sinkender Simulation-Health
- Bei kritischer Health: Breaking-News-Banner, rote Akzente, alarmierte Headlines

**4. Reader Engagement als Metrik**
- Tracking: Welche Artikel werden gelesen? Wie lange?
- Diese Metriken fliessen zuruck als "Public Opinion" Signal
- Ahnlich Democracy 4, aber die Spieler SIND die Offentlichkeit

### Visuelle Umsetzung: "Newsprint" Aesthetic

```css
/* Papier-Textur via SVG-Filter */
.newspaper-page {
  filter: url(#parchment-noise);
  background: var(--color-surface-raised);
}

.newspaper-page__headline {
  filter: url(#ink-bleed);
  font-family: var(--heading-font);
  font-size: var(--text-3xl);
}

/* Fold-Linie in der Mitte (Broadsheet-Falz) */
.newspaper-page::after {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 1px;
  height: 100%;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    var(--color-border-light) 10%,
    var(--color-border-light) 90%,
    transparent 100%
  );
  opacity: 0.3;
}
```

### Animal-Crossing-Notification-Pattern

Statt aufdringlichem Modal: Ein subtiler visueller Indikator auf der Simulations-Seite, wenn eine neue Ausgabe erschienen ist. Animal Crossings gelber Vogel auf dem Bulletin Board ist das beste Notification-Design im Gaming -- charmant, nicht-intrusiv, asthetisch passend.

### Quellen

- Lucas Pope, Papers Please (2013): "Truncated headlines to avoid excessive written exposition"
- Lucas Pope, The Republia Times (2012): Zeitungsredaktion als gesamte Spielmechanik
- Frostpunk (11 bit studios): Newspaper as delayed moral mirror
- Tropico (Haemimont/Limbic): Newspaper building with 8 work modes
- Democracy 4 (Positech Games): Template-based media at $0.10/word translation cost
- Eve Online: The Scope in-lore journalism + INN player-run outlets
- Animal Crossing: Yellow bird notification indicator

---

## Proposal 4: The Interactive Edition -- Scrollytelling & Data Visualization

### Konzept

Fur besonders wichtige Ereignisse (Epochen-Enden, Phase Transitions, kritische Events) eine immersive Langform-Erfahrung im Stil von NYT Snow Fall, The Pudding und Guardian "NSA Files". Nicht jeder Artikel, aber 1-2 pro Epoch als Premium-Content.

### Scrollytelling-Architektur

```
+------------------------------------------+
|  HERO: Full-viewport Key Art             |
|  Parallax-Scroll, fade-in Title          |
|  "The Fall of Station Null"              |
+------------------------------------------+
|                                          |
|  SECTION 1: Context (sticky sidebar)     |
|  Text scrolls, timeline visualization    |
|  sticks and updates as you scroll        |
|                                          |
+------------------------------------------+
|                                          |
|  SECTION 2: Data Visualization           |
|  ECharts/D3 chart of agent mood over     |
|  the epoch, animated on scroll-enter     |
|                                          |
+------------------------------------------+
|                                          |
|  SECTION 3: Agent Testimonials           |
|  Pull-quotes from AI-generated agent     |
|  reactions, with avatar + mood ring      |
|                                          |
+------------------------------------------+
|                                          |
|  SECTION 4: Aftermath                    |
|  What changed? Before/After metrics      |
|  Side-by-side comparison cards           |
|                                          |
+------------------------------------------+
|  FOOTER: "Next Edition" teaser           |
|  Share buttons + Newsletter CTA          |
+------------------------------------------+
```

### Scroll-Driven Animations (Native CSS)

```css
/* Reading progress bar -- zero JavaScript */
.reading-progress {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: var(--color-primary);
  transform-origin: left;
  animation: progress-fill linear;
  animation-timeline: scroll();
  z-index: var(--z-header);
}

@keyframes progress-fill {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

/* Sticky sidebar that updates on scroll */
.scrolly-section {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: var(--space-8);
}

.scrolly-section__sticky {
  position: sticky;
  top: var(--header-height);
  height: fit-content;
}
```

### Performance-Benchmark: NRK-Studie

Die norwegische NRK hat nachgewiesen, dass scroll-driven CSS-Animationen 6x performanter sind als JS-basierte Scroll-Handler (0.16ms vs 1ms pro Frame). Fur ein datenintensives Simulations-Dashboard ist das kritisch.

### Engagement-Daten

- NYT Snow Fall: 3.5 Millionen Views in der ersten Woche, durchschnittlich 12 Minuten Verweildauer
- Guardian "NSA Files: Decoded": 30 Minuten durchschnittliche Dwell Time
- The Pudding: 30 Minuten durchschnittliches Engagement pro Visual Essay
- Scrollytelling generell: 85% hoheres Engagement vs. statische Artikel (Columbia Journalism Review)

### Quellen

- NYT "Snow Fall" (2012): Coined "scrollytelling", Pulitzer Prize, 3.5M views/week
- Guardian "NSA Files: Decoded" (2013): One-page scroll, auto-playing video
- The Pudding: SvelteKit + D3.js, SND46 World's Best Digital
- NRK Scroll-driven Animation Performance Study (2024)
- CSS `animation-timeline: scroll()` (MDN, Chrome 115+)
- GSAP ScrollTrigger (gsap.com): Free, 1000+ newsroom deployments
- Scrollama (github.com/russellsamora/scrollama): IntersectionObserver-based scrollytelling

---

## Proposal 5: The Newsletter Pipeline -- Email Delivery

### Konzept

Die bestehende SMTP-Infrastruktur, Email-Template-Engine und Notification-Preferences nutzen, um einen per-Simulation Newsletter zu generieren. Inspiriert von Morning Brew's Headline-Image-Body-Pattern und Zetlands Audio-First-Ansatz.

### Warum die Infrastruktur bereits zu 80% steht

| Baustein | Status | File |
|----------|--------|------|
| SMTP Service | Produktionsbereit | `backend/services/email_service.py` |
| HTML Template Engine | 30+ Templates, per-Sim-Theming | `backend/services/email_templates.py` |
| Notification Preferences | Per-User Locale + Opt-in/out | `backend/models/notification.py` |
| Recipient Resolution | RPC-basiert, RLS-sicher | `backend/services/cycle_notification_service.py` |
| AI Content Generation | OpenRouter, bilingual | `backend/services/morning_briefing_service.py` |
| Staggered Delivery | 200ms Delay, Rate-Limit-aware | `cycle_notification_service.py` |

**Fehlend**: Newsletter-spezifische Preference-Flags, Aggregations-Job, Newsletter-Template, Web-Archiv.

### Newsletter-Struktur (Morning Brew-Inspired)

```
+--------------------------------------+
|  MASTHEAD                            |
|  [Sim Logo] The Daily [Sim-Name]     |
|  Edition #7 -- April 9, 2026        |
+--------------------------------------+
|                                      |
|  HERO STORY                          |
|  [Key Art Image]                     |
|  Headline in Serif                   |
|  2-sentence Lede + "Read More ->"    |
|                                      |
+--------------------------------------+
|  HEALTH SNAPSHOT  xxxxxxxxxx.. 78%   |
|  +3% vs. yesterday                   |
+--------------------------------------+
|                                      |
|  THREE THINGS TO KNOW                |
|  1. [Critical Event Summary]         |
|  2. [Agent Mood Shift]               |
|  3. [Upcoming Phase Change]          |
|                                      |
+--------------------------------------+
|  GAZETTE WIRE                        |
|  Cross-sim echoes relevant to you    |
|  - Echo from [Sim X] (commerce)      |
|  - Embassy established with [Sim Y]  |
|                                      |
+--------------------------------------+
|  [CTA: View Full Edition Online ->]  |
|  [Unsubscribe] [Preferences]         |
+--------------------------------------+
```

### Frequency-Optionen

- **Daily Dispatch** (Default): Kompakte Zusammenfassung, 3 Top-Items
- **Weekly Broadsheet**: Ausfuhrlicher, alle Events der Woche, Visualisierungen als statische Bilder
- **Breaking Alerts**: Nur bei kritischen Events (Health < 25%, Phase Transitions)

### Axios "Smart Brevity" Adaptation

Jeder Newsletter-Artikel folgt dem Axios-Schema (basierend auf Eye-Tracking-Forschung):
- **What's new**: 1 Satz
- **Why it matters**: 1 Satz
- **The big picture**: Optional, 1-2 Satze
- **What's next**: 1 Satz

Ergebnis: 40% kurzere Lesezeiten bei hoherem Verstandnis.

### Technologie-Nuggets

- **MJML** (mailjet.com): React-ahnliche Markup-Sprache fur responsive Emails, kompiliert zu Table-Layout-HTML
- **Email-safe Dark Mode**: `@media (prefers-color-scheme: dark)` wird von Apple Mail, Gmail (2024+), Outlook 365 unterstutzt
- **Preheader Text**: Unsichtbarer Text nach `<body>` der in Email-Clients als Preview erscheint -- nutzen fur "3 things to know today"
- **AMP for Email**: Gmail-only, aber ermoglicht interaktive Email-Inhalte (Live-Daten, Polls)

### Quellen

- Morning Brew: 4M Subscribers, Headline-Image-Body Pattern
- Axios "Smart Brevity" (2022, ISBN 978-1982190439): Eye-Tracking-basiertes Format
- MJML (mjml.io): Email Template Framework
- Zetland Newsletter: 50K Subscribers, journalist-narrated audio links in email
- Buttondown: Permanent URLs per email, search, paywall integration
- Financial Times "Europe Express": Multilingual newsletter strategy (WAN-IFRA 2025 Winner)

---

## Proposal 6: The Editorial Dashboard -- Architekten-Werkzeuge

### Konzept

Simulations-Architekten erhalten ein Redaktionswerkzeug zum Kuratieren, Arrangieren und Gestalten ihrer Zeitungsausgaben. Inspiriert von Bloomberg Businessweeks "Brisket"-Engine (modulare Content-Blocke, endlos remixbar) und der De Correspondent-Philosophie (jede Sektion hat eine redaktionelle Stimme).

### Dashboard-Funktionen

**1. Edition Composer**
```
+------------------------------------------+
|  NEW EDITION                      [SAVE] |
|  Title: _______________                  |
|  Edition #: [auto]  Cover: [upload]      |
+------------------------------------------+
|                                          |
|  CONTENT POOL          |  EDITION LAYOUT |
|  +----------------+    |  +------------+ |
|  | * Chronicle #4 | -> |  | HERO SLOT  | |
|  | ! Phase Change | -> |  | [drag here]| |
|  | # Briefing     |    |  +------------+ |
|  | @ Gazette #12  |    |  | COL A | B  | |
|  | ? Scanner Hit  |    |  |[drag]|[drg]| |
|  | + Custom Note  |    |  +------------+ |
|  +----------------+    |  | SIDEBAR    | |
|                        |  +------------+ |
|  [+ Write Custom]      |                 |
|  [! Auto-Generate]     |  [PREVIEW]      |
+------------------------------------------+
```

**2. Content Pool**: Automatisch befullt aus allen 4 Subsystemen + manuelle Eintrage

**3. Drag & Drop Layout**: Artikel in Slots ziehen (Hero, Column A/B, Sidebar, Footer)

**4. Auto-Generate**: AI generiert eine komplette Ausgabe basierend auf Events der letzten Periode

**5. Editorial Voice**: Pro Ausgabe wahlbar (neutral, alarmiert, optimistisch, satirisch, classified)

**6. Scheduling**: Ausgabe fur bestimmten Zeitpunkt planen

**7. Preview**: Theme-adaptiertes Preview in allen 10 Presets

### Bloomberg "Brisket"-Inspiration: Modulare Content-Blocke

Jeder Artikel ist ein Block mit definiertem Typ und Layout-Hint:

```typescript
interface ArticleBlock {
  id: string;
  type: 'chronicle' | 'event' | 'briefing' | 'gazette' | 'custom';
  headline: string;
  content: string;
  image_url?: string;
  layout_hint: 'hero' | 'column' | 'sidebar' | 'ticker' | 'pull-quote';
  priority: number;
  source_id?: string;  // Reference to original data source
  editorial_voice?: 'neutral' | 'alarmed' | 'optimistic' | 'satirical' | 'classified';
}
```

### Quellen

- Bloomberg Businessweek "Brisket" Rendering Engine: Modular CMS, editors remix content blocks
- De Correspondent "Respondens" CMS: Each section led by a correspondent voice
- Ghost CMS: Full Handlebars theming, newsletter-first
- Livingdocs (NZZ): 500 components, 24 sets, 6 products, bi-weekly design updates
- Semafor: Structured article format (facts/opinion/analysis separation)

---

## Proposal 7: The Living Archive -- Historische Zeitungssuche

### Konzept

Jede veroffentlichte Ausgabe wird archiviert und durchsuchbar gemacht. Inspiriert von Crusader Kings' Chronicle-System (lebende Geschichte), Delayed Gratifications Almanac-Struktur und der Dwarf Fortress Legends Mode (prozedurale Geschichtsschreibung).

### Archive-UI

```
+----------------------------------------------+
|  ARCHIVE: The Velgarien Chronicle            |
|  +----------+  +----------------------------+|
|  | TIMELINE |  |  SEARCH ________________   ||
|  |          |  |  [All] [Events] [Agents]   ||
|  |  2026    |  |  [Gazette] [Editorials]    ||
|  |  +- Apr  |  +----------------------------+|
|  |  | +-#7* |  |                            ||
|  |  | +-#6  |  |  Edition #7 (current)      ||
|  |  | +-#5  |  |  +---------------------+   ||
|  |  +- Mar  |  |  | [Cover Image]       |   ||
|  |  | +-#4  |  |  | "The Reckoning"     |   ||
|  |  | +-#3  |  |  | 5 Articles          |   ||
|  |  | +-#2  |  |  | Apr 9, 2026         |   ||
|  |  +- Feb  |  |  +---------------------+   ||
|  |    +-#1  |  |                            ||
|  +----------+  |  Edition #6               ||
|                |  ...                       ||
|  [PDF Export]  |                            ||
|  [RSS Feed]    |  [Load More]               ||
+----------------+----------------------------+
```

### Zeitachsen-Visualisierung

Eine vertikale Timeline mit Events als Nodes, die farblich nach Severity kodiert sind. Inspiriert von Crusader Kings' Chronicle, aber interaktiv -- klickbare Nodes die zur Edition springen.

### Suchfunktionalitat

- **Volltext-Suche**: Uber alle Editionen hinweg (PostgreSQL `tsvector` Index)
- **Filter**: Nach Kategorie (Events, Agents, Gazette, Editorials), Zeitraum, Severity
- **"On This Day"**: Vor einem Monat / einer Woche -- gamifizierter Ruckblick
- **Cross-Sim-Suche**: Alle Zeitungen aller Simulationen durchsuchen (offentlich)

### PDF-Export & Print Stylesheet

Die bestehende WeasyPrint-Integration (`codex_export_service.py`) erweitern:

```css
@media print {
  .newspaper {
    columns: 3;
    column-gap: 2em;
    column-rule: 0.5pt solid #ccc;
    font-size: 9pt;
    line-height: 1.4;
  }

  .newspaper__hero {
    column-span: all;
    border-bottom: 2pt solid black;
    margin-bottom: 1em;
  }
}
```

### RSS-Feed

Jede Simulation erhalt einen RSS/Atom-Feed unter `/api/public/simulations/{slug}/newspaper/feed.xml`. Ermoglicht externe Aggregation und Podcast-App-Integration.

### Quellen

- Crusader Kings 2/3 Chronicle System: Living archive with editorial voice
- Dwarf Fortress Legends Mode: Comprehensive procedural history
- Delayed Gratification: Quarterly retrospective almanac structure
- WeasyPrint (weasyprint.org): HTML-to-PDF conversion (already in codebase)
- PostgreSQL Full-Text Search: `tsvector`, `tsquery`, GiST indexes

---

## Proposal 8: The Multi-Channel Distribution Hub

### Konzept

Die Zeitung als Content-Hub, der in alle bestehenden Distribution-Kanale speist. Statt 4 isolierte Systeme -> 1 Aggregations-Punkt -> N Output-Kanale. Inspiriert von Monocles Multi-Platform-Modell (Magazin + Radio + Video + Retail) und Semafor's AI "Signals" Feature.

### Architektur

```
                    +---------------------+
                    |  NEWSPAPER ENGINE   |
                    |  (Aggregation +     |
                    |   Editorial AI)     |
                    +----------+----------+
                               |
         +-----------+---------+---------+------------+
         |           |         |         |            |
    +----v----+ +----v--+ +---v---+ +---v----+ +-----v----+
    | Web View| |Email  | | RSS   | |Social  | | PDF/     |
    | (Sim   | |News-  | |Feed   | |Media   | | Print    |
    |  Page) | |letter | |       | |Cross-  | | Archive  |
    |        | |       | |       | |post    | |          |
    +--------+ +-------+ +-------+ +--------+ +----------+
```

### Input-Aggregation

Der Newspaper Engine sammelt aus allen 4 Quellen und priorisiert:

```python
class NewspaperAggregator:
    """Collects and ranks content from all news subsystems."""

    async def compile_edition(self, sim_id: UUID, period: timedelta) -> Edition:
        # Parallel fetch from all sources
        chronicles, briefing, gazette, scanner = await asyncio.gather(
            self._get_chronicles(sim_id, period),
            self._get_briefing(sim_id, period),
            self._get_gazette_entries(sim_id, period),
            self._get_scanner_resonances(sim_id, period),
        )

        # Priority ranking: critical events > phase changes >
        # agent mood shifts > gazette echoes > routine
        articles = self._rank_and_deduplicate([
            *self._chronicle_to_articles(chronicles),
            *self._briefing_to_articles(briefing),
            *self._gazette_to_articles(gazette),
            *self._scanner_to_articles(scanner),
        ])

        return Edition(
            articles=articles[:7],  # Zetland "finishable" limit
            health_snapshot=briefing.health if briefing else None,
            gazette_wire=gazette[:5],
        )
```

### Social-Media-Cross-Posting

Die bestehende Instagram/Bluesky-Pipeline (`instagram_content_service.py`, `bluesky_content_service.py`) wird erweitert:
- **Automatische Headline-Extraktion** aus Zeitungsausgaben
- **Key-Art-Generierung** via OpenRouter Flux/GPT-5 aus Artikel-Kontext
- **Caption-Generierung** im Simulations-Voice
- **Hashtag-Rotation** aus dem bestehenden Pool
- **Scheduling**: Newspaper-Artikel als Social-Content-Queue einspeisen

### Gamification-Layer (60% Engagement-Steigerung)

Inspiriert von VG Norways Prediction Platform (190K Users, WAN-IFRA 2025 Winner):

- **Prediction Challenge**: "What will happen next cycle?" -- Nutzer tippen auf Events
- **Reading Streaks**: 7-Tage-Lese-Streak -> Badge auf Profil
- **Quiz pro Ausgabe**: 3 Fragen zum Inhalt -> XP/Reputation
- **"Most Read" Ranking**: Welcher Artikel war am popularsten?

### Quellen

- Monocle: Multi-platform brand (magazine + radio + video + retail, 500+ films)
- Semafor AI "Signals": Cross-source perspective aggregation
- VG Norway Prediction Platform: 190K users, gamified news (WAN-IFRA 2025)
- Instagram Graph API + AT Protocol (Bluesky): Already integrated in codebase
- $29B gamification market in 2025, projected $92.5B by 2030

---

## Implementierungs-Empfehlung: Reihenfolge

Die 8 Proposals erganzen sich. Empfohlene Sequenz:

| Phase | Proposal | Begrundung |
|-------|----------|------------|
| **1** | P1: Unified Component Library | Fundament fur alles Weitere. Eliminiert Duplication. |
| **2** | P2: Simulation Broadsheet | Das Kernprodukt -- die sichtbare Veranderung fur Nutzer. |
| **3** | P7: Living Archive | Broadsheet braucht ein Archiv. Nutzt P2-Komponenten. |
| **4** | P5: Newsletter Pipeline | Niedrig-hangende Frucht (80% Infrastruktur existiert). |
| **5** | P6: Editorial Dashboard | Architect-Empowerment. Macht P2 kuratierbar. |
| **6** | P3: Diegetic Newspaper | Game-Design-Layer uber P2+P6. Braucht Gameplay-Integration. |
| **7** | P4: Interactive Edition | Premium-Feature fur wichtige Events. Hochster Aufwand. |
| **8** | P8: Multi-Channel Hub | Orchestrierung aller Kanale. Braucht P2+P5+P7 als Basis. |

---

## Bestehende Codebasis-Dateien (Referenz)

### Frontend-Komponenten
- `frontend/src/components/multiverse/BleedGazetteSidebar.ts` -- Gazette Sidebar (517 Zeilen)
- `frontend/src/components/heartbeat/DailyBriefingModal.ts` -- Morning Briefing Modal (1016 Zeilen)
- `frontend/src/components/heartbeat/AutonomyBriefingSection.ts` -- Agent Autonomy Report
- `frontend/src/components/landing/ChronicleFeed.ts` -- Chronicle Feed (730 Zeilen)
- `frontend/src/components/chronicle/ChronicleView.ts` -- Per-Sim Chronicle View

### Backend-Services
- `backend/services/bleed_gazette_service.py` -- Gazette aggregation
- `backend/services/morning_briefing_service.py` -- AI narrative generation
- `backend/services/scanning/scanner_service.py` -- Real-world news scanning
- `backend/services/email_service.py` -- SMTP delivery
- `backend/services/email_templates.py` -- 30+ HTML email templates
- `backend/services/cycle_notification_service.py` -- Notification delivery
- `backend/services/codex_export_service.py` -- PDF export (WeasyPrint)
- `backend/services/instagram_content_service.py` -- Instagram pipeline
- `backend/services/bluesky_content_service.py` -- Bluesky cross-posting

### Theme-System
- `frontend/src/services/theme-presets.ts` -- 10 theme presets
- `frontend/src/services/ThemeService.ts` -- Runtime theme application
- `frontend/src/styles/tokens/` -- 3-tier design token system
- `frontend/src/utils/theme-colors.ts` -- Theme color utilities
