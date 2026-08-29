# Grafischer Dungeon: Funktionsgleichstand mit dem Terminal

## Kontext

Ein Durchspielen auf Produktion (Velgarien / The Entropy, Tiefe 1–4) hat gezeigt: die
grafische Ansicht ist kein alternatives Frontend, sondern eine gekürzte Fassung. Würfe,
Prüfergebnisse, Beute, Serverfehler und drei von acht Archetyp-Befehlen fehlen. Wer nur
grafisch spielt, entscheidet ohne Grundlage und erfährt den Ausgang nie.

**Der tragende Befund — frisch nachgeprüft und bestätigt:**
`DungeonGraphicalView._runCommand` (`graphical/DungeonGraphicalView.ts:1943`) führt jeden
Terminalbefehl über `parseAndExecute` aus, bekommt das vollständige `TerminalLine[]` und
legt es in `terminalState.appendOutput` — einen Puffer, den diese Ansicht nie rendert.
Alles Fehlende **existiert bereits**. Gleichstand ist ein Rendering-Problem, kein Nachbau
der 48 Formatter. Vorbild: `utils/dungeon-room-text.ts` („eine Ableitung, zwei Oberflächen").

**Abgestimmt:** Chronik in die rechte Spalte unter die Party (280 → 340 px).
Ort bleibt auf der Bühne, Geschehen in die Chronik.

### Drei Korrekturen am Vorplan (beim Nachprüfen gefunden)

1. **Publikationsort.** Der Vorplan wollte am Ende von `dispatchDungeonCommand` publizieren.
   Das verfehlt genau die Zeilen, um die es geht: das Befehls-Echo (`commandLine`,
   `terminal-commands.ts:1637`, außerhalb der Weiche) und den Lauf-Start aus `_beginRun`
   (`:2014`, geht gar nicht durch die Weiche). Publiziert wird stattdessen an der **Senke**:
   in `terminalState.appendOutput` — der einzige Weg, auf dem Zeilen in den Puffer kommen,
   von beiden Aufrufstellen und jeder künftigen. Beweisbar lückenlos statt beteuert.
2. **G ist halb erledigt.** Die feste Höhe existiert bereits und ist besser als der
   Vorschlag: `height: calc(100dvh - var(--_host-offset, 108px))` mit gemessenem Offset
   (`:126–146`). Bleibt: der Umschalter und das Knoten-Popover. Ob das Dokument noch
   scrollt, wird **gemessen**, nicht blind gefixt.
3. **I zielt daneben.** `DungeonMapNode.ts:144/147` ist die Deluge-Wasserlage — dort ist
   Blau richtig. Der echte Mangel ist `.node--selected .node__ring` (`:137`): setzt nur
   `stroke-width`, **gar keine Farbe**. Ein ausgewählter Knoten ist farblich nicht erkennbar.

---

## Arbeitspakete

Reihenfolge A → J. Nach jedem Paket: Gates. Commit je Paket (A/B, C, D/E, F–J).

### A — Die Chronik (schließt Würfe, Ergebnisse, Beute, Fehler auf einmal)

- `types/terminal.ts`: `TerminalLine` bekommt ein optionales `readonly meta?: TerminalLineMeta`.
  Additiv, das Terminal ignoriert es. `TerminalLineMeta` wird **ohne** Import aus
  `types/dungeon.ts` strukturell definiert (kein Zyklus).
- `services/TerminalStateManager.ts`: neues `dungeonNarration` (Ringpuffer 120), befüllt am
  Ende von `appendOutput()` wenn `isDungeonMode.value`, **ohne** `type === 'feed'` (die
  Heartbeat-Zeilen gehören nicht in die Chronik). Geleert in `initializeDungeon()` und
  `clearDungeon()`.
- Neu: `components/dungeon/graphical/DungeonChronicle.ts`. Rendert nach `TerminalLineType`:
  `command` als gedämpftes Echo, `error` in Gefahrenfarbe, die fünf `combat-*`-Rollen,
  `hint` kursiv, `response` als Fließtext. Feed-Form: kurze Einträge, neueste unten,
  Auto-Scroll nur wenn der Spieler unten steht. `role="log"`, `aria-live="polite"`.
- Rechte Spalte: `.dungeon-hud__party` wird `.dungeon-hud__side`, Flex-Spalte aus
  Party (auto) + Chronik (`flex:1; min-height:0`). Grid 280 → 340 px. Unter 1199 px
  bekommt die Chronik eine eigene Zeile, `clamp(140px, 24vh, 220px)`.
- **Fehler zusätzlich als Toast**, in `_runCommand` nach `parseAndExecute` (eine Stelle, an
  die Handlung gebunden, feuert nicht bei jedem Render). *Abweichung mit Grund:* **kein**
  `captureError` für Server-Fehlerzeilen — „Cannot move in phase: rest" ist eine
  Spielerantwort, kein Defekt; die Observability-Regel gilt geschluckten Ausnahmen, und die
  im `catch` bleibt unverändert.

### B — Proben bekommen eine Darstellung

- `formatSkillCheckResult` (`dungeon-formatters.ts`) hängt das strukturierte `check`-Objekt
  als `meta` an die Kopfzeile und markiert die vier Folgezeilen des Blocks als
  `skill-check-part`. Die Zahlen kommen aus derselben Quelle wie der Text — **kein Parsen**.
  Die privaten Zeilenfabriken in `terminal-formatters.ts` bekommen einen optionalen
  zweiten Parameter. Terminalausgabe unverändert.
- Die Chronik rendert daraus die BG3-Sequenz: Rohwurf → Modifikator fliegt ein → Summe →
  Ergebnisband (SUCCESS / PARTIAL / FAILURE), und verwirft die vier markierten Textzeilen.
  Bei `prefers-reduced-motion` sofort der Endzustand.

### C — Encounter-Optionen werden entscheidungsfähig

- Neu, rein: `utils/dungeon-encounter-choices.ts` — `describeChoices(choices, party)` liefert
  je Option Label, Beschreibung, Anforderungen mit erfüllt/nicht erfüllt, und den
  Freiwilligen (Name, Porträt, Aptitude-Wert). `_findBestAgent` zieht aus
  `dungeon-formatters.ts` dorthin um; `formatEncounterChoices` baut darauf auf und gibt
  **byte-gleiche** Zeilen aus (Test sichert das).
- `DungeonQuickActions._renderEncounterButtons` zeigt dasselbe grafisch. Nicht erfüllte
  Optionen bleiben sichtbar und nennen den Grund (Disco-Elysium-Konvention).
- *Grenze, ehrlich benannt:* `EncounterChoiceClient` trägt **keine** Wirkungsvorschau
  (`−8 Decay`) — die Felder existieren im DTO nicht. Gezeigt wird, was da ist; die
  Wirkungsvorschau wäre eine Backend-Erweiterung und ist notiert, nicht erfunden.

### D — Die Raumbeschreibung

`graphical/DungeonGraphicalView.ts`, `.chamber` (CSS ab `:1162`), `_renderChamberText` (`:2570`).

- **Farbbalken weg:** `border-left: 3px solid var(--_fx-accent)` (`:1172`) und
  `border-left: 1px solid …` an `.chamber__anchor` (`:1192`).
- Ersatz: Letterbox-Band über die volle Bühnenbreite mit senkrechtem Verlauf.
  `max-width: 68ch` begrenzt künftig das **Textmaß**, nicht die Platte — die sichtbare
  senkrechte Kante bei 62 % verschwindet.
- **Reihenfolge erzählerisch:** Agentenkommentar → Raumtyp-Marke → Raum → Objekte →
  Situation → Barometer.
- **Fünf Schriftbehandlungen auf drei Rollen:** *Stimme* (Agent, kursiv), *Ort* (Raum +
  Objekte, Serife), *Instrument* (Barometer). Das Barometer verliert Monospace — das heißt
  in diesem Designsystem „Systemausgabe" und widerspricht dem Inhalt.
- **Das Stottern beheben:** `ambient` wird in `describeRoom` unterdrückt, sobald ein
  `encounter` vorliegt. *Bewusste Folge:* das ändert **auch** die Terminalausgabe um eine
  Zeile. Richtig so — die Dopplung ist ein Inhaltsfehler in beiden Oberflächen, und die
  Regel lautet eine Ableitung, nicht ein Sonderweg fürs Bild. `dungeon-room-text.test.ts`
  wird angepasst.
- Verlaufsmaske am unteren Rand des internen Scrolls, damit sichtbar ist, dass mehr da ist.

### E — Die Beschreibung überlebt das Auflösen

Ursache bestätigt: `handleDungeonLook` (`dungeon-commands.ts:413`) publiziert
`describeRoom(room, state)` **ohne** Move-Antwort — `banter: null`, `anchors: []`,
`barometer: null` — und überschreibt damit das gute Objekt.

- Neu, rein, in `dungeon-room-text.ts`: `mergeRoomDescription(prev, next)`. Behält die nur
  bei Ankunft existierenden Felder (`banter`, `anchors`, `barometer`), solange
  `roomIndex` gleich ist; beim Raumwechsel verworfen. `encounter` gehört **nicht** dazu —
  es ist aus dem State ableitbar, also gewinnt der neue Wert, und nach dem Auflösen
  verschwinden die Optionen korrekt, während die Prosa steht.
- `DungeonStateManager.publishRoomDescription` ruft den Helfer — eine Stelle, beide Wege.

### F — Archetyp-Befehle erreichen die grafische Ansicht

`seal`, `salvage`/`dive`, `ground`, `rally` haben in `DungeonQuickActions.ts` **null**
Vorkommen (nachgezählt). Ergänzen, nach Archetyp und Phase geschaltet, über den
bestehenden `terminal-command`-Versand. Keine neue Logik. Die Abkühlzeit prüft der Server;
seine Absage ist ab Paket A sichtbar — das ist die ehrliche Autorität, keine doppelte.

### G — Rahmen (reduziert, siehe Korrektur 2)

- Der Umschalter (`DungeonView.ts`, `.view-toggle`) ist `position: fixed` und liegt beim
  Scrollen auf dem ersten Agenten. Er wandert in `.dungeon-hud__header`.
- Knoten-Popover (`DungeonRoomPanel.ts:253`): `adjacent && !current ? Knopf : nothing`
  ohne Sonst-Zweig. Ergänzen: „Von hier nicht erreichbar" plus Grund.
- Dokument-Scroll und Marketing-Footer: **erst messen** (WebMCP, `scrollHeight` vs.
  `clientHeight`), dann entscheiden. Kein `transform`/`filter` auf Layout-Containern.

### H — Ladezustände

- Hintergrund: Skelett in der Tier-Farbe statt sechs Sekunden Leere; Bild per `decode()`
  einblenden; Nachbarraum beim Überfahren seines Knotens vorladen.
- Porträts: `VelgAvatar` hat einen Initialen-Fallback (`:162`) — im Picker greift er
  offenbar nicht. Erst nachsehen, ob der Picker `velg-avatar` überhaupt benutzt, dann fixen.

### I — Benennung und Auswahl

- `OPERATIVE_SHORT` (`utils/operative-constants.ts:34`) vergibt Einzelbuchstaben, in denen
  **Saboteur = `B`** ist (`S` ging an Spy) — `A9 G9 P6 B5 S4 I3` ist nicht entzifferbar.
  `DungeonPartyPanel.ts:527` stellt auf `OPERATIVE_LABEL` (`SPY GRD SAB …`) um; reicht der
  Platz nicht, die drei höchsten.
- Zeilenlabel `STR` → `STRESS`.
- `.node--selected .node__ring` bekommt eine **Farbe** (Bernstein-Auswahlton), nicht nur
  Strichstärke.

### J — Lobby

`PROTOCOL_BRIEFINGS` (`dungeon-formatters.ts:~500`) ist bereits eine Datenstruktur mit
`title/intro/bullets/outro`. Ein reiner Zugriff `getArchetypeBriefing(archetype)` wird
exportiert; die Lobby-Karte zeigt den ersten Intro-Satz. Damit unterscheiden sich die
Karten, die heute alle „Schwierigkeit 3, Tiefe 6" tragen. (Das Kunstfeld ist bereits
gefüllt — `lobby-card__art` existiert.)

---

## Nicht in diesem Plan

Die **Raumwiederholung** (Rast → Schatz → Rast → Schatz bis Tiefe 4, nahezu wortgleich)
liegt in der Raumfolge-Erzeugung im Backend. Notiert, eigener Vorgang.

---

## Schritt 0

Diesen Plan nach `docs/plans/graphical-dungeon-parity-plan.md` kopieren (im Planmodus
gesperrt gewesen). Die bereits fertigen, ungetesteten Änderungen (Piktogramm-Kacheln,
Hover-Titel, Vite-Proxy) bleiben unangetastet und wandern in den ersten Commit mit.

## Verifikation

1. **Gates nach jedem Paket:** `npm run lint:full` (13 Gates), `npx tsc --noEmit`,
   `npx vitest run`, `.venv/bin/ruff check backend/ scripts/`.
2. **Einheitstests:**
   - `dungeon-room-text.test.ts`: Verschmelzung aus E (Beschreibung überlebt `look` und
     Auflösen), Ambient-Unterdrückung aus D.
   - Neu für C: Freiwilligen-Zuordnung identisch für beide Oberflächen; Terminalausgabe
     von `formatEncounterChoices` unverändert.
   - **Paritätstest:** feste Zeilenfolge durch `terminalState.appendOutput` → jede Zeile
     (außer `feed`) landet in `dungeonNarration`. Das ist die Garantie gegen erneutes
     Auseinanderlaufen.
3. **Durchspielen** über das lokale Frontend gegen Produktion (`.env.local` liegt, Vite
   5173; **Port 8000 ist der SSH-Tunnel, nicht anfassen**), grafisch, Screenshot je Schritt:
   Lobby → Auswahl → Raum → Encounter mit Probe → Ergebnis → Kampf → Beute. Geprüft wird:
   Wurf sichtbar, Ergebnis sichtbar, Fehler sichtbar (ein `move` in der Rast-Phase
   erzwingen), Raumtext überlebt das Auflösen, kein Farbbalken, kein Dokument-Scroll,
   Umschalter überdeckt nichts.
4. **Gegenprobe Terminal:** dieselbe Folge im Terminal. Erwartet unverändert — mit der
   **einen benannten Ausnahme** aus D (die doppelte Ambient-Zeile fällt weg).
5. `velg-frontend-design` Skill vor dem ersten Komponentencode aufrufen.
