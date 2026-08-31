# Handoff: Metaverse.Center Simulation Views (v4-Familie)

Umfasst VIER Bereiche der Simulation-Shell: **Simulation View v4** (Übersicht / Lore / Agents / Buildings), **Chat**, **Broadsheet** und **Dungeon** (Graphical View + Kampf-Prototyp „Dungeon Stage"). Ergänzende Feature-Notiz: `notes/dungeon-chronicle-room-grouping.md`.

## Über die Dateien
Die Dateien sind **Design-Referenzen in HTML** — Prototypen für Look & Verhalten, kein Produktionscode. Ziel ist die Umsetzung in `velgarien-rebuild/frontend` (Lit 3 + Preact Signals + TypeScript) nach dessen Regeln:
- Farben NUR über Tokens (`var(--color-*)`, 3-Tier); Hex-Werte in diesem README identifizieren das Token, werden nie hart kodiert.
- Headings `var(--font-brutalist)` (Courier), uppercase, `var(--tracking-brutalist)`; Prosa/Erzählstimme Spectral (Serif, italic für Narratives); Mikro-Labels `var(--font-mono)`.
- Jeder User-String über `msg('…')` (DE/EN, En-Dash statt Em-Dash); Icons ausschließlich aus `utils/icons.ts`; WCAG AA.
- Simulation-Themes: Inhalte theme-fähig, Plattform-Chrome bleibt immer dunkel/amber.

Jede Datei enthält Sektion `id="1a"` (1440px-Referenz) und `id="1b"` (2560px-Wide-Screen-Probe). Alle Styles inline — was dieses README nicht beantwortet, steht im Markup.

## Fidelity
**High-fidelity** bei 1440. Wide-Screen unten spezifiziert (mit gebauten 2560-Proben). Mobile: offen (Ausnahme: SimulationNav hat im Live-Code bereits ein Mobile-Menü — beibehalten).

## Gemeinsamer Rahmen (alle drei Screens)
1. **Platform-Strip** (42px): Breadcrumb `Simulations / {Weltname} | {Tab}` links (10px mono, tracking 2px), rechts kontextualer Status (z. B. „3 Agenten erreichbar" mit pulsierendem Grün-Punkt). Immer platform-dunkel.
2. **Kanon-Nav als Register** — die zentralen Regeln (behebt das Clipping-Problem des Live-Views):
   - KEINE Icons in der Tab-Leiste; Labels `white-space:nowrap`, `flex:0 0 auto` — nie mitten im Wort abschneiden.
   - Kern-Tabs sichtbar in Kanon-Reihenfolge: ◈ Übersicht (neu, vor Lore) · Lore · Agenten · Gebäude · Blatt · Chronik · Ereignisse · Terminal · Dungeon. Rest in „Mehr (n) ▾"-Dropdown (3-spaltig, `#0a0a0a`, Offset-Schatten).
   - **Aktiv-Pin-Regel:** Ist ein „Mehr"-Tab aktiv (z. B. Chat), wird er als zusätzlicher Tab vor „Mehr" nach vorn gepinnt.
   - Aktiver Tab: amber Text, bg `#0a0a0a`, 2px-Unterstreichung (inset unten). Reicht der Platz trotzdem nicht (lange Locales): horizontales Scrollen der Leiste, Scrollbar versteckt — nie Clipping.
   - Rechts außen: Kontextzeile „Cycle 7 · Epoch active" (9px, `#555`).
3. **Verbotene Muster (Nutzer-Tabus, verbindlich):** keine rotierten/schiefen Elemente, keine Stempel-Optik, KEINE linken Akzent-Kantenstreifen. Aktiv-/Auswahlzustände = getönte Fläche `rgba(245,158,11,.06)` + 1px-Amber-Umriss (`outline … offset:-1px`), nie ein Kantenbalken.
4. Offset-Schatten only (`2–8px … 0 #000`), Radius 0 (Ausnahme TCG-Karten ~6px), Scanlines/Eckklammern nur wo kanonisch (BureauTerminal).

## Screen 1: Simulation View v4 (`Simulation View v4.dc.html`)
### Masthead (alle Tabs)
Full-bleed Welt-Artwork (Ken-Burns 34s, scale→1.06) + 94°-Scrim links dunkel + Scanlines (Tweak `scanlines`). Inhalt (padding 58/40/46, Rise-Stagger .6/.7/.7s): Status-Chips (Aktiv-Puls grün, Klassifizierung, Threat-Level-Chip in Threat-Farbe — Tweak `threat: calm|elevated|critical` → grün/amber/rot + 1/3/5 gefüllte Segmente im Rail-Panel), Weltname Courier 700 74px mit amber Punkt, Tagline (Spectral italic 18px, max 620px), CTA „Bureau Terminal →" + Statistikzeile.
### Tab „◈ Übersicht" (Default)
Grid `1fr 400px`, padding 40:
- **Philosophischer Anker**: Karte mit Label, Titel (Courier 16px) links (190px) + Frage als Serif-Zitat rechts.
- **Dossier-Teaser**: publicRecord-Kicker, Kopf, 3-Zeilen-Exzerpt (line-clamp), „Open dossier →" (wechselt zum Lore-Tab), Meta „4 Abschnitte · 1 Eingestuft".
- **Bureau-Rail** (rechts): Bureau Status (Threat-Label + Wert + 5-Segment-Balken, Classification/Cycle/Resonances), Signals//Pulse (3 Zeilen: Farb-Punkt + Text + Alter), On Duty (Top-3-Agenten nach Aptitude-Summe: 38px-Porträt mit Tint-Rahmen, Name, Rolle, Summe in Tint-Farbe; K-9 ohne Porträt = Initialen auf `#111`), Link „Full roster below ↓".
- Darunter volle Breite: **Roster-Strip** (8 Mini-TCG-Karten: 128px-Art bzw. Initialen-Monogramm, Rarität-Chip, ✦ Name ✦-Plate, Rolle, Quadrat-Gem = Aptitude-Summe / Kreis-Gem = beste Fähigkeit in Typ-Farbe [SPY #64748b · GRD #10b981 · SAB #ef4444 · PRP #f59e0b · INF #a78bfa · ASN #dc2626]; Legendary [Botschafter ODER Apt ≥ 9] amber Rahmen + Glow; Deal-Stagger 60ms) und **Footprint-Strip** (Gebäudekarten mit Bild-Header 124px + Scanlines, Glyph-Overlay, Zustand ●◐○ [≥66 % grün / ≥33 % amber / sonst rot / Ruine grau, Ruine entsättigt+40 % Opazität], Kapazitätsbalken mit bar-grow-Animation). „Open Agents/Buildings →" wechselt Tabs.
### Tab „Lore"
Kopf (publicRecord + dossierHead) + **Fallakte-Toggle** (Outline-Chip; aktiv amber gefüllt). Grid `280px 1fr`:
- TOC links: Abschnitte mit Index, klassifizierte mit rotem „Eingestuft"-Tag; aktiver Eintrag getönt+Umriss (KEIN Kantenstreifen); Fuß mit Abschnitts-Meta + Anker.
- Lesepanel: Titel (Courier 24px), **Epigraph** (Serif italic + mono Quelle — Muster aus LoreScroll), **Figure** (16:7-Bild, `Fig. 0X — Caption` in mono; Klick → Bild-Lightbox 980px mit Backdrop/✕/Esc), Absätze Spectral 16.5px lh 1.85 max 740px, Prev/Next-Kapitelnavigation mit Titeln. Klassifizierter Abschnitt ohne Fallakte: Redaction-Balken (6 Streifen, variierende Breiten) + Hinweiszeile; Figure bleibt verborgen.
- Inhalte/Übersetzungen kommen aus `sim-data.js` (`loreContent(lang)`, `strings(lang)`); DE/EN-Umschalter im Platform-Strip wirkt auf alles.
### Tab „Agenten"
Suche (⌕-Input, filtert Name+Rolle, focus amber) + Filter-Chips (Alle / Keystone / Botschafter / KI-geboren — Labels aus strings). Grid 4×: Karten mit 168px-Art, Rarität, ✦ Name ✦, Rolle · Bezirk, 2-Zeilen-Blurb (Serif italic), Gems + Bindungen-Zähler. **Klick → EntityLightbox** (Muster AgentsView/AgentDetailsPanel): Backdrop (Klick schließt) + zentriertes 880px-Dossier (280px-Porträt, Beschreibung, Aptitude-Pips in Operative-Farben [≤5 gedimmt 38 %, ≥8 Glow], Bekannte Bindungen mit Notiz, Zähler n/m) + ←/→-Buttons. **Tastatur: ←/→ blättert zyklisch durch die GEFILTERTE Liste (eine Datenquelle für Grid, Buttons und Tastatur!), Esc schließt; Eingaben im Suchfeld werden ignoriert.** Leerstand: „Keine Operativen passen zum Filter".
### Tab „Gebäude"
3×-Grid mit 172px-Bild-Headern, Zustand, Typ · Bezirk, vollem Serif-Beschreibungstext, Kapazitätsbalken + Legende (● ≥66 % · ◐ ≥33 % · ○ kritisch/Ruine). Klick → Gebäude-Lightbox (300px-Bild, Glyph, Zustand, Beschreibung, Kapazität, Prev/Next zyklisch, gleiche Tastatursteuerung).

## Screen 2: Chat (`Simulation Chat.dc.html`, nach ChatView.ts)
Vollhöhen-View (FULL_HEIGHT_VIEWS im Shell — kein Marketing-Footer). Grid `Sidebar | Fenster` (Referenz 300px, Live-Code-Regel `clamp(280px, 22vw, 380px)` übernehmen).
- **Sidebar**: Kopf „Gespräche n" + „+ Neu" (amber, öffnet AgentSelector des Live-Codes); Konversationskarten: Porträt-Stapel (Gruppen: bis 3 überlappend −9px, Overflow „+n"), Name (Gruppen: Nachnamen mit ·), Pin ⚲ amber, Ungelesen-Punkt, Nachrichten-Badge, 2-Zeilen-Preview (Serif), relative Zeit. Aktive Karte: Tönung + Umriss.
- **Fenster-Kopf**: 36px-Porträt, Name + Live-Status (Grün-Punkt; Werte in Weltstimme: „Erreichbar/Im Amt/Unterwegs/Zählt"), Rolle · Bezirk; Aktionen „⚡ Ereignis" (EventPicker) und „Archiv".
- **Feed**: Tages-/Zyklus-Divider (gestrichelte Linie + Label), Agenten-Bubbles links (`#101010`, Border `#222`, Serif 14px `#c9c9c9`, Meta-Zeile Wer · Zeit), eigene Bubbles rechts (amber getönt `rgba(245,158,11,.07)` + Border `.4`, Text `#e8d6a8`), **Event-Referenz-Karte** (gestrichelter Amber-Rahmen, ⚡, Kicker + Serif-Titel), max-width 560px, bubble-in-Animation nur für NEUE Nachrichten. **Typing-Indicator**: 3 springende Punkte + „{Agent} schreibt…".
- **Composer**: auto-wachsende Textarea (Serif 14px, focus amber, min 40/max 120px), ➤-Button, Hinweis „Shift+Enter für Zeilenumbruch" + „Antwortet in der Stimme der Simulation". Enter sendet; Antwort kommt asynchron (Prototyp: 1,9s + Typing).
- Dunkle schmale Scrollbars in Sidebar und Feed (`scrollbar-width:thin`, `#2a2a2a` auf `#0a0a0a`).

## Screen 3: Broadsheet (`Simulation Broadsheet.dc.html`, nach SimulationBroadsheet.ts + Hero-/Article-/Wire-Komponenten)
- **Editorial-Leiste** (nur Architekt, canEdit): Periode-Start/Ende (date-Inputs, `color-scheme:dark`), „✦ Edition kompilieren" (amber; startet Presseraum-Status mit Phasentexten: Aggregating → Ranking → Compiling), rechts Rollenhinweis.
- **Breaking-Banner** bei `voice=alarmed` (rot getönt, Puls-Punkt) + „Breaking"-Badge am Hero (Badge-Variante, NICHT rotiert — Stempel-Tabu).
- **Zeitung** (Satzmaß max 1220px zentriert): Masthead mit `border-top/bottom: 3px double` („Bureau Gazette · Klassifizierung" Kicker, Titel Courier 44px, Metazeile Edition/Zyklus/Preis), Headline-**Ticker** (36s Marquee), **Hero-Artikel** (Quellen-Label mit Dot, Spectral 600 38px Headline, Lede 17px, Meta Agent / Tags), **3×2-Artikelspalten** mit Innenlinien (`#1a1a1a`, keine äußeren Kartenrahmen) — Quellen-Dots: Ereignis blau `#3b82f6`, Resonanz violett `#a78bfa`, Aktivität grün `#4ade80`, Gazette amber; Headline Serif 18.5px, Exzerpt 4-Zeilen-Clamp, Agent mono. **Zustand der Kolonie** (3 Balken + Serif-Verdikt-Zitat), **„Unter dem Falz"**-Divider, **Gazette-Draht** (Zeit + Einzeiler, gestrichelte Trennungen), **Ausgaben-Archiv** (Nr./Titel/Datum; aktive Ausgabe getönt+Umriss; Klick lädt Edition — im Prototyp #12/#11 voll ausformuliert, #10 gesperrt 45 % Opazität), Schlussmarke ✦ + Kolophon.
- Hover auf Artikeln: Headline unterstreicht amber (`text-decoration-color`), Fläche hellt.

## Screen 4: Dungeon (EXTRA-DETAILLIERT)

Zwei Dateien, zwei Zuständigkeiten:
- **`Dungeon Graphical View.dc.html`** — 1:1-Nachbau des Live-Moduls `components/dungeon/graphical/DungeonGraphicalView.ts` (+ dungeon-graphical-styles, DungeonHeader, DungeonMap, DungeonChronicle, DungeonQuickActions) mit den in diesem Projekt entschiedenen UX-Erweiterungen (Targeting, Befehls-Sichtbarkeit, Chronik-Raumgruppierung, generalisierte Pressure-Ebene).
- **`Dungeon Stage.dc.html`** — der ältere, tiefe Kampf-Prototyp (Agenten-STATIONEN-System). Für Kampf-Interaktionsdetails (Karten-Kits, Slam-Deploy, Halten-zum-Ausführen) ist ER die Referenz; die Graphical View zeigt die kompaktere In-Szene-Fassung.

### 4.1 HUD-Grid (exakt wie Live-Code)
`grid-template-rows: auto 620px auto` (1b: 760px) · `grid-template-columns: 320px 1fr 340px` (1b: 360/380).
- Header-Zeile spannt `1 / -1`; **Map-Rail (Sp. 1) und Seiten-Spalte (Sp. 3) spannen `grid-row: 2 / 4`**, damit alle drei Spalten auf derselben Unterkante enden wie die Actions-Zeile.
- **Actions-Zeile NUR unter der Bühne** (`grid-column: 2`) — die dokumentierte Korrektur aus dem Live-Code (Ursache/Wirkung teilen eine Spalte).
- Kein Rail-Collapse im Prototyp (bewusst gestrichen — bei fehlender Platznot kein UX-Wert); der Live-Code behält seinen Collapse für <1200px.

### 4.2 Instrument-Header (DungeonHeader-Muster)
Phosphor-Leiste (`rgba(10,10,8,.85)`, Border `rgba(61,50,0,.6)`, mono 11px): Archetyp-Badge in Archetyp-Farbe (Deluge = Info-Blau, Border 40 %), **Tiefen-Gauge** (Track mit 8 Ticks, Füllung phosphor-dim, letzte 20 % rot getönt + gestrichelte Grenze = Boss-Tiefe), Räume-Zähler mit `icons.dungeonMap`, Meter-Chip (Label + %, Farben s. 4.4). Rechts in der Header-Zeile: **View-Toggle ◉ Graphical | >_ Terminal** (Graphical DEFAULT; Terminal ist Read-only-Spiegel derselben Expedition mit funktionierendem Prompt: look/map/status/seal).

### 4.3 Map-Rail (DungeonMap/DungeonMapNode-Muster)
SVG-DAG (viewBox 300×400, `preserveAspectRatio="xMidYMin meet"` — dockt oben an). Knoten-Anatomie: Füllkreis r13 + Ring r16; Zustände: **geklärt** = dim + ✓-Badge (Kreis r6 + Häkchen, grün), **aktuell** = amber, Fill 20 %, Ring 2px + pulsierender Beacon (animierter r21→30-Kreis), **erreichbar** = phosphor-dim + gestrichelter Reticle-Ring r20, klickbar (Hover: Ring amber; Klick = Bewegung), **Fog** = `#332a08`-Töne, Kanten gestrichelt. **Icons sind die ECHTEN Pfade** aus `utils/icons.ts` / `dungeon-map-icons.ts` (mapEntrance, mapCombat, mapThreshold, campfire, mapUnknown; 512er-Pfade skaliert 0.0390625, 24er 0.8333, translate(−10,−10)); Farben nach ROOM_COLOR (combat phosphor-dim, rest grün, threshold amber, boss rot, fog dunkel). Darunter nicht-scrollendes **Raum-Panel**: Raumnummer · Name, Typ, Ausgänge, Druckhinweis.

### 4.4 Bühne & Pressure-System (WICHTIGSTE ARCHITEKTUR)
Bühnen-Grid: `auto minmax(132px,1fr) auto minmax(0,auto)` = Readout / Feindband (132px-Boden: Kreaturen weichen NIE unter Minimum) / Agenten-Band / Text. **Bei Platzmangel komprimiert das Grid die Textzeile (min 0) → deren `overflow:auto` greift; bei Slack nimmt der Text seine Inhaltshöhe scrollfrei** — kein fixer Cap.
- **Backdrop**: Archetyp-Artwork (dungeonBackdropUrl), gedimmt + Scrim + Skeleton-Shimmer beim Laden (Live-Code-Muster).
- **Pressure-Ebene pro FX-Profil** (`dungeon-environment.ts`: 8 Archetypen → water/darkness/decay/tilt/pulse/forge/shards/flicker; pressure01 normalisiert, Shadow & Tower invertieren!):
  - `water` (einziges bodenverankertes Profil): Grid-Ebene, die sich **Zeile 4 mit dem Textpanel teilt** (beide explizit `grid-row:4`!), `align-self:stretch` + `margin-top:−26px` → Oberkante fix 26px ÜBER dem Panel. **Der Pegelwert treibt die INTENSITÄT (Gradient-Alpha + Glow), nicht die Höhe** — Figuren/Namen werden konstruktionsbedingt nie von der Wasserkante geschnitten (Agenten-Band hat 32px Bodenabstand). Weiche Kante (18px-Verlauf), kein harter Border.
  - `darkness`: zuziehende Vignette (Radius 46→22 % mit Druck) · `decay`: Grau-Wash + Korn · `tilt`: diagonale Schlagschatten, Winkel 90→99° · `pulse`: atmender roter Radial (Frequenz 3.8→1.8s) · `forge`: Glut von unten + inset-Glow · `shards`: doppelte Scherben-Diagonalen · `flicker`: Takt-Flackern (steps(2)).
  - Readout (oben links, min 210px) + Header-Chip themen mit: Label Flutwasser/Sicht/Zerfall/Stabilität/Bindung/Einsicht/Fraktur/Déjà-vu + Akzent (blau/#94a3b8/#a8a29e/amber/#dc2626/#ea580c/#94a3b8/#c084fc).
- **Kein Echtzeit-Timer** — Druck kommt aus dem Meter (+6 %/Zug, Leck versiegeln −8 %; Kanon).

### 4.5 Chamber-Prosa (Erzählreihenfolge, kanonisch)
Panel (`rgba(5,9,13,.78)` + blur, Lesemaß 660px ZENTRIERT, dunkler schmaler Scrollbalken): **Banter (Serif italic, Operativen-Stimme) → Raumtyp-Marke (mono, dim) → Ambient → Anchor-Objekte → Encounter-Block (amber Rahmen + Tönung; Threshold-Variante) → Barometer (Akzentfarbe)** — exakt die im Live-Code dokumentierte narrative Ordnung, nie Datenreihenfolge.

### 4.6 Bänder & Zuordnungs-Sichtbarkeit (Targeting-UX)
Beide Bänder als Grid `repeat(n,1fr)`, Zellen zentriert (Chips verschieben nichts).
- **Agenten**: 52px-Disc mit Condition-Ring (operational grün / stressed amber / wounded rot / captured grau — CONDITION_RING) + Glow-Pool + Name.
- **Feinde (nur im Kampf — Enemies sind combat-scoped!)**: Art-Figur (Größe nach Tier: minion 84px / elite 132px; FOE_GEOMETRY-Prinzip), **Condition-Wear** (grayscale+dim nach FOE_CONDITION: damaged .34, critical .74), Condition-Pool, **Rangmarken NUR elite ◆ / boss ✦** („a mark on everything marks nothing"), **Intent-Marker** (echtes alertTriangle-Icon + Klartext, Farbe nach Threat low blau/medium amber/high rot).
- **Targeting-Kette** (Stationen-Prinzip aus Dungeon Stage): Ability-Klick → Pending-Modus: pulsierende Hinweisleiste oben („Ziel wählen für ‚X' … Esc ✕"); Strike → Gegner amber umrandet (crosshair, scale 1.05), Verbündete dimmen .45; Aid/Guard → umgekehrt (grün). Ziel-Klick → Befehl rastet ein: (1) **Mini-Befehlskarte über der Agenten-Disc** (Pictogram + „Ability → Ziel" + ✕ = zurücknehmen), (2) **„im Visier"-Tag am Gegner** mit 16px-Porträts aller Angreifer (Tooltip: Wer + Ability), (3) **✓ am Agenten-Tab** + Klartext in der **Anweisungsleiste ①②③④** (leer = „Auto-Verteidigung", Klick springt zum Tab; gesetzt = Klick nimmt zurück). **„Ausführen (halten) · n/4"** löst die Runde (im Stage-Prototyp echter Hold-Button — übernehmen!). Esc bricht Pending ab; eine Datenquelle für alle drei Anzeigen.

### 4.7 Combat-Bar & Ability-Pictograms
Agenten-Tabs (20px-Porträt + Name + Condition-Punkt + ✓ bei gesetztem Befehl; aktiv amber) → 4er-Kit des aktiven Agenten. **Pictograms = die echten Wycinanki-Masken** aus `public/ui-pictograms/{ability_id}.png` (Vertrag: Dateiname = ability-id aus dem Content-Pack; fehlende Datei → Text-Fallback, nie leere Kachel), gerendert als CSS-Maske (`mask:url(...) center/contain`) mit `background-color` = **Intent-Cluster-Farbe** (abilityIntent: strike rot / aid grün / guard blau — Cluster-Tag am Button). Nicht-Kampf: Quick-Actions (Umsehen / Status / Leck versiegeln / Rückzug-halten) + Encounter-**Choice-Karten** nach Disco-Elysium-Konvention: Index, Beschreibung, Volunteer (16px-Porträt + Aptitude, tabular-nums), Requirements grün/„SAB 10 nötig — 9 im Trupp" rot-fett; **gesperrte Option bleibt SICHTBAR** (Border rot 55 %, Opazität .72).

### 4.8 Seiten-Spalte & Chronik
Trupp-Panel (30px-Porträts, Top-3-Aptitude-Chips, Condition-Label farbig) — **im Kampf ausgeblendet** (Kanon: Combat-Bar listet alle, Chronik braucht den Platz). **Chronik**: typisierte Einträge (sys mono dim / narrativ Serif phosphor / Schaden rot), chronologisch (Neues unten, chron-in-Fade), **Raum-Divider bei Raumwechsel** (Linie · RAUM 0X · NAME · Linie — Feature noch NICHT im Live-Code, Implementierungsnotiz in `notes/dungeon-chronicle-room-grouping.md`: Raum beim Beat-Absorbieren aus dungeonState mitschreiben, nie nachträglich raten).

### 4.9 Wide-Screen (Cockpit-Regel, Sektion 1b)
Instrumenten-Rails fix (360/380), **die Bühne nimmt den GESAMTEN Mehrplatz** — mehr Welt statt Ränder, KEIN zentrierter Container (Vollhöhen-Spielansicht, wie FULL_HEIGHT_VIEWS). Prosa bleibt aufs Lesemaß gekappt; <1200px greift die bestehende Stacking-Media-Query des Live-Moduls.

### 4.10 Technische Fallen (aus diesem Projekt gelernt, verbindlich)
- **Nie per Interval das ganze Combat-Objekt zurückschreiben** (Race löschte im Stage-Prototyp Eingaben) — Dispatch-Guard am EINEN Seam wie im Live-Code (`_dispatch`-Kommentar in DungeonQuickActions).
- Bilder nie als `<img src={{hole}}>` — immer computed `background` (Prefetch-Bug).
- Grid-Overlays: Elemente, die sich eine Zeile teilen, BEIDE explizit pinnen (Auto-Flow schiebt sonst in implizite Zeilen — der 0px-Zeilen-Bug dieses Prototyps).
- Tabus: keine rotierten Elemente/Stempel, keine linken Akzentstreifen; Unicode-Glyphen sind KEINE Icons — immer icons.ts/Pictogram-Masken.

## Wide-Screen & 4K (je Sektion 1b gebaut)
Drei Regeln nach View-Typ — NICHT eine für alle:
- **Simulation View v4** (Dokument/Registratur): zentrierter Container `max-width:1920px`, Chrome (Strip, Nav-Hintergrund, Masthead-Art) full-bleed; Grids wachsen moderat (Rail 400→440).
- **Chat** (Vollhöhen-Kommunikation, „Cockpit-Regel"): Sidebar fix links an der Kante (340px @2560), Fenster nimmt die VOLLE Restbreite — kein Letterboxing; Feed + Composer zentrieren ihr Lesemaß via `padding-inline:max(26px, calc((100% − 1080px)/2))`, Bubbles bleiben ≤560px.
- **Broadsheet** (Papier-Regel): das Blatt behält sein Satzmaß (1220px zentriert) — eine Zeitung wird nicht breiter, nur der Tisch; Editorial-Leiste zentriert ihr Inhaltsmaß mit.
- Mobile durchgängig offen; Nav nutzt das bestehende Mobile-Menü der SimulationNav.

## State & Daten
- v4: `lang` (DE/EN, wirkt global), `tab`, `lore`-Index, `caseFile`, `agentSel`/`bSel` (Lightboxen), `imgLb`; Daten via `sim-data.js` (AGENTS/BUILDINGS/strings/loreContent — API-Formen analog Forge/Lore-Services).
- Chat: aktive Konversation, per-Konversation Nachrichtenliste (+ optimistische eigene Nachricht), typing; Live-Code: ChatApiService/Conversations.
- Broadsheet: `edition`-Index (Archiv), `press`-Status; Tweak `voice: neutral|alarmed`; Live-Code: Editionen + Artikel mit `source_type`, `agent_name`, `tags`.
- Tweaks (Prototyp): v4 `scanlines`, `threat`; Broadsheet `voice`.

## Assets
`assets/p-*.png` (Agenten-Porträts) und `assets/b-*/e-*.png` (Welt-/Gebäude-Crops) sind **Platzhalter** — im Produkt durch Backend-Bilder ersetzen (`portrait_image_url`, Gebäude `image_url`, Lore `imageSlug`-Pipeline mit Shimmer-Skeleton beim Generieren).

## Dateien
- `Simulation View v4.dc.html` · `Simulation Chat.dc.html` · `Simulation Broadsheet.dc.html` · `Dungeon Graphical View.dc.html` (je 1a Referenz + 1b 2560-Probe; Logik-Klasse am Dateiende enthält alle Copy-/Daten-Arrays)
- `Dungeon Stage.dc.html` — Kampf-Referenz (Stationen-System, Loot-Zeremonie, Storylets mit Check-Odds)
- `sim-data.js` (Beispielwelt „The Chitinous Mandate", DE/EN) · `notes/dungeon-chronicle-room-grouping.md`
- `assets/ui-pictograms/` — echte Ability-Masken (128px-PNG-Alpha; via Maske einfärben, nie als <img>)
- `support.js`, `_ds/…` — Runtime + Tokens, alles öffnet direkt im Browser.

## Offene Punkte
- Mobile-Layouts; echte Routen (Tabs = URLs `/simulations/{slug}/{tab}`); Edit-Modi (LoreEditor, AgentEditModal, BuildingEditModal, EmbassyCreateModal) sind im Live-Code vorhanden und hier nicht neu gestaltet — bestehende Modals weiterverwenden, nur Token-Styling angleichen.
- Broadsheet: BroadsheetHealthHero im Prototyp als kompakte 3-Balken-Leiste interpretiert — bei Abweichung vom gewünschten Umfang Rücksprache.
