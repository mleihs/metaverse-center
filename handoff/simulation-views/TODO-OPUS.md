# TODO für Claude Code (Opus) — Umsetzung Simulation Views + Dungeon

Arbeitsgrundlage: `README.md` in diesem Paket (Spezifikation) + die `.dc.html`-Prototypen (visuelle Referenz, öffnen direkt im Browser; Sektion 1a = 1440-Referenz, 1b = 2560-Probe). Zielcodebasis: `velgarien-rebuild/frontend` (Lit 3 + Preact Signals + TS). Reihenfolge ist Empfehlung — Phase 0 ist Pflicht vor allem anderen.

## Phase 0 — Querschnitt (Pflicht, betrifft alle Views)
- [ ] **Nav-Register umbauen** (`components/layout/SimulationNav.ts`): Icons aus der Desktop-Tab-Leiste entfernen; Labels `white-space:nowrap` + `flex:0 0 auto`; Kern-Tabs (◈ Übersicht, Lore, Agenten, Gebäude, Blatt, Chronik, Ereignisse, Terminal, Dungeon) sichtbar, Rest in „Mehr (n) ▾"-Dropdown (3 Spalten, `--color-surface`, Offset-Schatten). **Aktiv-Pin-Regel**: aktiver Mehr-Tab wird vor „Mehr" gepinnt. Fallback bei Platzmangel: horizontales Scrollen (Scrollbar versteckt), NIEMALS Clipping. Akzeptanz: 1280px-Viewport, DE-Locale, kein abgeschnittenes Label; aktiver Chat-Tab sichtbar ohne Dropdown-Öffnen.
- [ ] **Neuer Menüpunkt „Übersicht"** vor Lore (Route `/simulations/{slug}/overview` o. ä.); Lore wird reine Lese-Seite. Breadcrumb folgt aktivem Tab.
- [ ] **Aktiv-/Auswahl-Pattern projektweit**: getönte Fläche `color-mix(in srgb, var(--color-accent-amber) 6%, transparent)` + 1px-Umriss (outline, offset −1) — bestehende `box-shadow:inset 2px 0 0`-Kantenstreifen ERSETZEN (Suchauftrag über die Codebase). Tabus prüfen: keine rotierten Elemente/Stempel.
- [ ] Tokens statt Hex (alle Werte im README sind Token-Referenzen); Strings über `msg()` (En-Dash!); Icons nur `utils/icons.ts`.

## Phase 1 — Simulation View v4 (`Simulation View v4.dc.html`)
- [ ] **Masthead-Komponente** (ersetzt/erweitert SimulationHeader auf Sim-Ebene): Full-bleed `banner_url` mit Ken-Burns (34s, prefers-reduced-motion beachten), 94°-Scrim, optional Scanlines; Status-/Klassifizierungs-/Threat-Chips (Threat aus lore-content `extractThreatLevel`); Weltname (brutalist, ~74px @1440, clamp), Tagline, CTA Terminal.
- [ ] **Übersicht-Tab**: Anker-Karte (Philosophical Anchor aus Forge-Daten), Dossier-Teaser (erste Lore-Section, 3-Zeilen-Clamp, Link → Lore), Bureau-Rail (Threat-Segmente, Pulse-Signale [Events/Resonanzen-Feed], On-Duty Top-3 nach Aptitude-Summe), Roster-Strip (8 Mini-TCG-Karten nach TCG-Spec: Gems, Rarität = Botschafter/Apt≥9 legendary), Footprint-Strip (Zustand ●◐○ aus Kapazitätsratio: ≥.66/. ≥.33/sonst; Ruine grau+entsättigt).
- [ ] **Lore-Tab**: TOC + Lesepanel; Epigraph + Figure (imageSlug-Pipeline, Shimmer beim Generieren, Klick → bestehende `shared/Lightbox`); Fallakte-Toggle (getClassifiedSections/isClassifiedSection) mit Redaction-Balken; Prev/Next mit Kapiteltiteln; Zeilenmaß 740px.
- [ ] **Agenten-Tab**: Suche (Name+Rolle) + Filter (Alle/Keystone/Botschafter/KI-geboren); Karten-Grid 4×; Detail als **EntityLightbox** (bestehende Komponente) mit Pips in OPERATIVE-Farben, Bindungen, n/m-Zähler; **←/→ zyklisch durch die GEFILTERTE Liste, eine Datenquelle für Grid/Buttons/Tastatur; Esc schließt; Inputs ausgenommen.** Akzeptanz: Filter „Botschafter" + Pfeiltasten blättern nur Botschafter.
- [ ] **Gebäude-Tab**: Bild-Karten 3× mit vollem Beschreibungstext + Kapazität; Lightbox analog (BuildingDetailsPanel container="lightbox" weiterverwenden).
- [ ] Wide-Screen: Container-Regel (Inhalt max 1920 zentriert, Chrome/Masthead full-bleed, Rail 400→440) — Referenz Sektion 1b.

## Phase 2 — Chat (`Simulation Chat.dc.html`)
- [ ] Sidebar-Konversationskarten nach Prototyp (Porträt-Stapel −9px, Overflow +n, Pin/Ungelesen/Badge, 2-Zeilen-Preview Serif, Aktiv-Umriss) in `ConversationList.ts` restylen.
- [ ] Fenster-Kopf: Status in Weltstimme (agent-abhängige Labels), Aktionen ⚡ Ereignis (EventPicker) / Archiv.
- [ ] Feed: Zyklus-Divider, Bubble-Styles (Agent `--color-surface-raised`+Serif / eigene amber-getönt), Event-Referenz-Karte (gestrichelt amber), bubble-in nur für neue Nachrichten, TypingIndicator „{Agent} schreibt…".
- [ ] Composer: auto-grow (field-sizing/grow-wrap wie ChatComposer), Enter/Shift+Enter, Hinweiszeile.
- [ ] Wide-Screen: **Cockpit-Regel** — Sidebar `clamp(280px,22vw,380px)` an der Kante, Fenster volle Breite, Feed/Composer `padding-inline:max(26px, calc((100% − 1080px)/2))`, Bubbles ≤560px. KEIN zentrierter Container. Akzeptanz @2560: kein Leerstreifen links der Sidebar.

## Phase 3 — Broadsheet (`Simulation Broadsheet.dc.html`)
- [ ] Masthead auf Doppellinien-Zeitungskopf umstellen (velg-dispatch-masthead theming), Metazeile Edition/Zyklus/Preis.
- [ ] Headline-Ticker (36s Marquee, reduced-motion: aus), Hero (Quellen-Dot-Label, 38px-Serif-Headline, Lede, Meta), 3×2-Spalten NUR mit Innenlinien; Quellen-Dot-Farben event/resonance/activity/gazette (Token-Mapping s. README).
- [ ] „Zustand der Kolonie"-Leiste (BroadsheetHealthHero kompakt: 3 Balken + Verdikt-Zitat), „Unter dem Falz"-Divider, Gazette-Draht (Zeit + Einzeiler), Archiv (Aktiv-Umriss, gesperrte Editionen 45 % + not-allowed), Schlussmarke ✦.
- [ ] Editorial-Leiste (canEdit): Perioden-Inputs `color-scheme:dark`, Kompilieren-Button, Presseraum-Phasentexte.
- [ ] `voice=alarmed`: Breaking-Banner + nicht-rotiertes Breaking-Badge am Hero + Unruhe-Balken rot.
- [ ] Wide-Screen: **Papier-Regel** — Blatt behält 1220px-Satzmaß zentriert; Editorial-Leiste zentriert ihr Maß mit.

## Phase 4 — Dungeon (EXTRA GENAU, README §4.1–4.10 ist der Vertrag)
- [ ] **4.1 Grid**: Rails `grid-row:2/4` (bündige Unterkanten), Actions nur Spalte 2. Collapse-Button auf Desktop entfernen (Mobile-Verhalten unangetastet).
- [ ] **4.3 Map**: Node-Zustände + ECHTE Icons (dungeon-map-icons; Skalierung 512er ×0.0390625 / 24er ×0.8333, translate(−10,−10)); `preserveAspectRatio="xMidYMin meet"`; Raum-Panel nicht-scrollend.
- [ ] **4.4 Pressure-System**: B²hnen-Grid `auto minmax(132px,1fr) auto minmax(0,auto)`; Wasser-Ebene teilt sich Zeile 4 mit dem Textpanel (BEIDE explizit pinnen!), Oberkante −26px, **Intensität statt Pegelhöhe**, weiche Kante; die 7 übrigen FX-Profile als Voll-Szenen-Overlays (Parameter im Prototyp-JS, `FX`-Map); Readout + Header-Chip themen mit (Label + Akzent je Profil; Shadow/Tower higher-better beachten — `resolveDungeonEnvironment` liefert pressure01 bereits normalisiert).
- [ ] **4.5 Chamber**: narrative Reihenfolge Banter→Marke→Ambient→Anchors→Encounter→Barometer; Lesemaß 660 zentriert; dunkler dünner Scrollbalken; Panel `.78`+blur, Wasser scheint durch.
- [ ] **4.6 Targeting-Kette** (NEUES Feature, Kern der Übergabe): pending-State → Hinweisleiste + Spotlight (Strike: Gegner amber/crosshair, Allies dimmen; Aid/Guard invers grün) → Lock erzeugt DREI Anker aus EINER Datenquelle: Befehlskarte über Agent (Pictogram+Ziel+✕), „im Visier"-Tag am Gegner (Angreifer-Porträts+Tooltip), ✓ am Tab + Anweisungsleiste ①–④ (Slot-Klick: leer→Tab, gesetzt→Rücknahme); Esc bricht ab; „Ausführen" als echter VelgHoldButton. Akzeptanz: 2 Agenten auf denselben Gegner → 2 Porträts im Visier-Tag; Rücknahme an JEDEM der drei Anker konsistent.
- [ ] **4.7 Combat-Bar**: Tabs + 4er-Kits; Pictograms als CSS-Masken (`abilityPictogramUrl`, Fallback Text-Button!), Cluster-Farbe via `abilityIntent`; Encounter-Choices: Volunteer + Requirements, gesperrte Option sichtbar mit Klartext-Lock.
- [ ] **4.8 Chronik-Raumgruppierung** (NEU, `notes/dungeon-chronicle-room-grouping.md`): Raumfeld beim Beat-Absorbieren aus dungeonState mitschreiben; Divider bei Raumwechsel; zählt nicht als Beat.
- [ ] **4.9 Wide-Screen Cockpit-Regel**: Rails fix 360/380, Bühne nimmt ALLES; keine Container-Zentrierung.
- [ ] **4.10 Fallen** als Review-Checkliste übernehmen (Dispatch-Guard, kein Interval-Rewrite des Combat-Objekts, computed-background statt img-src-Holes, Grid-Zeilen explizit pinnen, Icon-/Streifen-/Stempel-Tabus).

## HOTFIX — Lore-Page, Live-Befund 31.08.2026 (Screenshot „Staatspathographie", Light-Theme)
- [ ] **Lesespalte + TOC als Paar setzen**: `grid-template-columns: 300px minmax(0, 740px); gap: 64px; justify-content: center;` auf dem Lore-Container — NICHT TOC links pinnen und Text separat zentrieren (aktuell ~400px totes Gutter dazwischen). TOC `position:sticky; top:…` beibehalten.
- [ ] **Masthead-Scrim pro Theme kalibrieren**: Im Light-Theme wäscht der Dark-Scrim das Banner komplett aus (graue Void hinter dem Titel). Scrim aus Theme-Tokens ableiten (`color-mix(in srgb, var(--color-surface) 92%, transparent)` → transparent), Banner-Deckkraft im Light-Theme ≥ .35, Bildkante rechts definiert statt ausgefadet. Titelkontrast AA gegen die hellste Scrim-Stelle prüfen.
- [ ] **CTA verankern**: „Bureau Terminal →" + Statszeile (Agenten · Gebäude · Zyklus) nicht frei rechts floaten lassen — als Meta-Zeile unten im Masthead bündig zur Titel-Baseline (eine Flex-Zeile, space-between mit Tagline).
- [ ] **Abb.-Captions**: kein Mono-Uppercase-Tracking für mehrzeilige Bildbeschreibungen. Nur das Präfix „ABB. 01" als Mono-Label, der Beschreibungstext in Serif (Spectral) 13px/1.6, normale Groß-/Kleinschreibung, max-width = Bildbreite.
- [ ] **Seitenende**: kein leerer Füllstreifen unter dem Inhalt — min-height am Content-Wrapper statt am Body-Filler; Abschluss mit Prev/Next-Kapitelnavigation (siehe Phase 1 Lore-Tab).
- [ ] Regression: dieselbe Seite im Dark-Theme (Velgarien) gegenprüfen — Scrim-Tokenisierung darf den dunklen Look nicht verändern.

## Definition of Done (jede Phase)
1440 pixel-nah am Prototyp (Screenshot-Vergleich), 2560 nach jeweiliger Regel (Container/Cockpit/Papier), DE+EN ohne Clipping, Tastaturpfade (Lightbox ←/→/Esc, Targeting Esc, Composer Enter/Shift+Enter), prefers-reduced-motion respektiert, keine rohen Hex-Werte im Komponenten-CSS (Lint), WCAG AA Kontrast auf Phosphor-Dim-Texten geprüft.
