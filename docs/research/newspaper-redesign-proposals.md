# Zeitungsmodul Redesign -- Analyse & 8 Proposals

> Erstellt: 2026-04-09
> Perspektiven: UI/UX-Experte, Game Designer, Zeitungswebseiten-Layout-Experte
> Recherche: 90+ Websuchen, 25+ Referenzseiten, 8 Game-Design-Analysen

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

## Proposal 2: The Simulation Broadsheet -- Theme-Adaptive Newspaper View

### Konzept

Eine dedizierte Zeitungs-View pro Simulation (`/simulations/{slug}/newspaper`), die als immersives, theme-adaptives Leseerlebnis alle Nachrichtenquellen aggregiert. Inspiriert von de Volkskrants Grid-Virtuosität, Zetlands "finishable" Philosophie und Frostpunks Moralspiegel-Mechanik.

### Layout-Architektur: Die Broadsheet-Grid

```
+-----------------------------------------------------+
|  MASTHEAD: Sim-Name + "The [Theme] Chronicle"       |
|  Subtitle: "Edition #7 -- Cycle 12, Day 4"          |
|  Theme-adaptive Font + Farbe                         |
+-----------------------+-----------------------------+
|                       |                             |
|   HERO ARTICLE        |   SIDEBAR                   |
|   (Latest Chronicle)  |   24h Briefing Summary      |
|   Full-width image    |   Health Bar                |
|   Drop Cap lede       |   Arc Pressure Gauges       |
|   AI-generated        |   Weather Zones             |
|                       |                             |
+-----------+-----------+-----------------------------+
|           |           |                             |
|  COLUMN A |  COLUMN B |   GAZETTE WIRE              |
|  Event 1  |  Event 2  |   Latest Cross-Sim          |
|  (Scanner |  (Agent   |   Echoes relevant to        |
|   Reso-   |   Mood    |   THIS simulation           |
|   nance)  |   Shift)  |                             |
|           |           |                             |
+-----------+-----------+-----------------------------+
|                       |                             |
|  SECTION: DISPATCHES  |   OBJEKTANKER               |
|  2-column grid of     |   "Found Object" sidebar    |
|  recent events        |   with lore connection      |
|                       |                             |
+-----------------------+-----------------------------+
|  FOOTER: Previous Editions Archive + Newsletter CTA |
+-----------------------------------------------------+
```

### Theme-Adaption (10 Presets)

| Theme Preset | Newspaper-Metapher | Typografie | Visuelle Signatur |
|---|---|---|---|
| **brutalist** | Drahtnachricht / Telegramm | Oswald + system-ui | Hard shadows, uppercase, tracked |
| **sunless-sea** | Unterwasser-Gazette | Cormorant Garamond + Lora | Teal-Schimmer, Seetang-Ornamente |
| **cyberpunk** | Holo-Newsfeed | Barlow Condensed + Rajdhani | Neon-Glow Scanning-Effekt, CRT-Lines |
| **illuminated-literary** | Illustrierte Monatsschrift | Libre Baskerville + Cormorant | Gilded Drop Caps, Floral Borders |
| **deep-space-horror** | Schiffstagebuch / Notfunkspruch | Space Mono + IBM Plex | Phosphor-Green, Scanlines, Static |
| **nordic-noir** | Polizeibericht / Akte | Inter | Cool grays, blur shadows, minimal |
| **arc-raiders** | Werkstatt-Bulletin | Default + parchment bg | Nieten-Rahmen, brass accents |
| **solarpunk** | Community-Bulletin Board | Default + rounded corners | Grune Akzente, eco-aesthetic |
| **vbdos** | DOS-Terminal-Ausgabe | VT323 + IBM Plex Mono | Cyan borders, scanlines, C:\> prompt |
| **deep-fried-horror** | Satiremagazin / Fanzine | Comic Sans chaos | Neon saturation, collage-aesthetic |

### CSS Multi-Column fur echtes Zeitungsgefuhl

```css
.broadsheet__columns {
  column-width: 28ch;
  column-gap: var(--space-6);
  column-rule: 1px solid var(--color-border-light);
  column-fill: balance;
}

.broadsheet__hero {
  column-span: all;  /* Hero-Artikel uber alle Spalten */
}

.broadsheet__hero-lede::first-letter {
  initial-letter: 3;  /* Drop Cap, 3 Zeilen hoch */
  font-family: var(--heading-font);
  color: var(--color-primary);
  margin-right: var(--space-2);
}
```

### "Finishable" Design (Zetland-Prinzip)

Maximal 5-7 Artikel pro Ausgabe. Keine Endlos-Scroll-Feeds. Ein klares "Du hast alles gelesen"-Signal am Ende. Jede Ausgabe ist ein abgeschlossenes Artefakt.

### Quellen

- Zetland (finishable daily, SND Scandinavia Gold)
- de Volkskrant (SND46 World's Best, Grid-Virtuositat)
- Frostpunk (newspaper as moral mirror)
- CSS Multi-Column: column-width, column-span, column-rule (MDN)
- `initial-letter` CSS Property (91%+ Support, caniuse.com)

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
