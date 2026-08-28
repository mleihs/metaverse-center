# Grafischer Dungeon — Sanierungsplan (Befundaufnahme 2026-08-28)

Ergebnis eines vollständigen Prod-Durchlaufs im grafischen Modus (Browser, echte
Klicks, `The Chitinous Mandate` / `Der Schatten`, bis in den Kampf). Jeder Befund
unten wurde **gesehen**, nicht abgeleitet; wo die Ursache noch offen ist, steht
das ausdrücklich dabei.

Dieses Dokument ist der Anker für die Sanierung nach einem Context-Clear.

---

## Stand der Abarbeitung (2026-08-28, abends)

**15 von 17 Befunden erledigt**, alle gepusht und auf Produktiv deployt
(`d1bd676` … `5f0445c`). Der Rest ist bewusst offen:

| Befund | Stand | Commit |
|---|---|---|
| A-1 Pixi/unsafe-eval | erledigt | `2460587` |
| A-2 Sentry-DSN | erledigt, DSN im Prod-Bundle verifiziert | `d1bd676`, `82c3298` |
| A-3 Raumbeschreibungen | erledigt | `ee54815` |
| B-1 Picker-Porträts | **kein Portraitfehler** — siehe unten | (mit B-2) |
| B-2 Aptituden-Widerspruch | erledigt | `aa696c1` |
| B-3 Punkt 1 (Betrieb) | **offen — Entscheidung des Auftraggebers** | — |
| B-3 Punkt 2 (Gestaltung) | erledigt | `e6dc21e` |
| C-1 Rail-Scroll | erledigt | `48301d1` |
| C-2 abgeschnittener Knoten | **offen — braucht Messung** | — |
| C-3 Szenen-Überlagerungen | erledigt | `ee54815` |
| C-4 Mausrad | erledigt | `48301d1` |
| C-5 Gegner-Maßstab | erledigt, inkl. SCENE_EDGE 384→768 | `2c52b0c` |
| C-6 Gegner-Interaktion | erledigt | `ba03009` |
| D-1 „8 AGENTSEN" | erledigt | `9968a1e` |
| D-2 englische Strings | erledigt — sie *waren* in `msg()` | `5f0445c` |
| D-3 „STIMMUN" | erledigt | `9968a1e` |

**B-1 hat sich anders aufgelöst als vermutet.** Die Feldnamen-Divergenz
`portrait_image_url` / `portrait_url` ist keine: `fn_get_party_combat_state`
aliast dieselbe Spalte (`'portrait_url', a.portrait_image_url`). Nachgemessen
haben alle acht Porträt-URLs der Simulation HTTP 200 geliefert und die Storage-
Objekte existieren. Die leeren Kästchen der „Aufstellungsübersicht" kamen aus
B-2: `hasAptitudes = this._aptitudeMap.size > 0` war false, weil die Simulation
keine Aptituden-Zeilen hat — also rendert die Karte weder Balken noch Rolle.

**Drei Funde außerhalb der Liste, alle behoben:**

1. **Sechs Lint-Gates liefen in CI ins Leere und meldeten trotzdem PASS**
   (`a866b5f`). Mit Sonde nachgewiesen. Alle elf verankert, Meta-Gate ergänzt.
2. **Produktions-Totalausfall während der Arbeit** (`63368bd`): Supabase'
   JWKS-Endpunkt hing, und ein blockierender Fetch im Event-Loop machte daraus
   ein plattformweites 503.
3. **Coolify reicht `SOURCE_COMMIT` nicht als Build-Arg** (`82c3298`), weshalb
   die Release-Zuordnung aus A-2 über den Laufzeitkanal läuft: der Server
   stempelt sie in die SPA-Hülle.

**Was noch aussteht:** die optische Bestätigung. A-1, A-3, C-1, C-3, C-5, C-6
und D-3 sind gebaut und getestet, aber nicht im Browser gesehen — das braucht
eine **angemeldete** Sitzung im grafischen Modus.

---

## Ausgangslage (Stand beim Schreiben)

- `main` = `702d336`, gepusht. Prod läuft auf `702d336` (`running:healthy`).
- Prod-DB auf Migration 273. 42 Gegner, alle mit `image_path`. Storage: 42
  Renditionen (384 px), öffentlich als `image/avif` lesbar.
- Rollout-Phase 3a (Gegner-Kunst) ist fertig und live — siehe
  `graphical-dungeon-rollout.md` §3a.
- Arbeitsbaum sauber.

---

## Leitplanken für die Sanierung

Der Auftraggeber verlangt ausdrücklich: **sauberste Architektur, kein
Workaround, keine Code-Duplikation, Refactoring-Gelegenheiten mitnehmen, immer
systemisch fixen.** Das heißt konkret für diese Liste:

- Wo zwei Stellen dasselbe wissen müssen, wird die Quelle **eine** — nicht beide
  korrigiert.
- Ein Symptom, das aus einer Feldnamen-Divergenz entsteht, wird an der
  Divergenz behoben, nicht am Aufrufer.
- Ein fehlender Wert wird nicht durch einen Fallback kaschiert, der den Fehler
  unsichtbar macht (siehe B-2 — genau daran krankt der Picker heute).
- Jede Korrektur, die eine Regel etabliert, bekommt einen Test oder ein
  Lint-Skript, sonst driftet sie wieder.
- Gates vor jedem Push: `ruff check backend/ scripts/`, `npm run lint:full`
  (Frontend, enthält tsc + Biome + 7 Lint-Skripte), `vitest`, `pytest`,
  `validate_content_packs.py --strict` (beide Domains).

---

## A — Funktionale Ausfälle (nicht kosmetisch, zuerst)

### A-1 · Pixi startet auf Prod überhaupt nicht → die gesamte Combat-FX-Ebene ist tot

**Beleg (Browser-Konsole auf Prod):**
```
[Sentry not configured] Error: Current environment does not allow unsafe-eval,
please use pixi.js/unsafe-eval module to enable support.
  at Dt._unsafeEvalCheck (RenderTargetSystem-DROrURXH.js)
  at Y._initPixi   (DungeonGraphicalView-DTtlFATe.js)
  at Y._ensurePixi
  at Y._onRound
```

**Ort:** `frontend/src/components/dungeon/graphical/DungeonCombatFx.ts:218`
(`const PIXI = await import('pixi.js')`), Init-Kette ab Zeile 205/213.
Pixi-Version: `^8.19.0` (`frontend/package.json:46`).

**Wirkung:** Die CSP auf Prod verbietet `unsafe-eval`. Pixi v8 baut seine Shader
per `new Function()`. Folge: `_initPixi` wirft, die FX-Ebene initialisiert nie —
**keine Schadenszahlen, keine Impact-Ringe, keine Partikel, kein Hit-Stop, kein
Trauma-Shake**. Die komplette Phase 2 + 2.1 ist auf Produktiv wirkungslos. Lokal
fällt das nicht auf, weil der Vite-Dev-Server keine solche CSP setzt.

**Systemischer Fix:** Pixi v8 liefert dafür `pixi.js/unsafe-eval`. Das ist der
vorgesehene Weg und ändert nichts an der Bildqualität. Die CSP zu lockern wäre
der Workaround — sie schützt die ganze App und bleibt.

**Nicht übersehen:** Der Fehler wurde bereits korrekt über `captureError`
gemeldet (`DungeonCombatFx.ts:252`) — er kam nur nirgends an, siehe A-2. Prüfen,
ob der Nutzer im Fehlerfall überhaupt etwas merkt: derzeit läuft der Kampf
stumm weiter. Ein sichtbarer Degradationspfad (FX aus, Rest funktioniert) ist
richtig, aber er darf nicht *stillschweigend* sein.

**Verifikation:** Nach dem Fix auf Prod einen echten Kampf auslösen und die
Konsole auf die Meldung prüfen; sie muss verschwinden und FX müssen zünden.

---

### A-2 · Frontend-Sentry ist auf Prod nicht konfiguriert

**Beleg:** Die Konsolenmeldung oben beginnt wörtlich mit
`[Sentry not configured]` — das ist der Zweig in
`frontend/src/services/SentryService.ts:37-40`, der greift, wenn `_initialized`
false ist. Die Coolify-Env der Prod-App kennt genau **drei** VITE-Variablen:
`VITE_GA4_MEASUREMENT_ID`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`.
**Kein `VITE_SENTRY_DSN`.**

**Wirkung:** Sämtliche `captureError`-Aufrufe der gesamten Frontend-Codebasis
landen ausschließlich in der Browser-Konsole. Die Error-Observability-Regel aus
`CLAUDE.md` ist im Code diszipliniert umgesetzt und auf Prod wirkungslos. Genau
deshalb ist A-1 monatelang niemandem aufgefallen.

**Systemischer Fix:** DSN in die Coolify-Env, Build neu. Zusätzlich prüfen, ob
`VITE_SENTRY_RELEASE` gesetzt wird (die Release-Zuordnung aus
`docs/guides/sentry-cicd-integration.md` hängt daran) und ob die
Source-Map-Uploads überhaupt greifen — `SENTRY_AUTH_TOKEN` ist laut Contract ein
Stage-1-Docker-ARG.

**Refactoring-Gelegenheit:** Es gibt keine Absicherung dagegen, dass eine
build-kritische VITE-Variable fehlt. Ein Startup-Check, der in Produktion laut
wird, wenn `VITE_SENTRY_DSN` fehlt, verhindert die Wiederholung. Ohne so etwas
ist der nächste stille Ausfall nur eine Frage der Zeit.

---

### A-3 · Raumbeschreibungen erscheinen im grafischen Modus überhaupt nicht

**Beleg:** `encounter_description_en/de` existiert
- im Backend-DTO (`dungeon_checkpoint_service.py`, Encounter-Felder),
- im Frontend-Typ (`frontend/src/types/dungeon.ts:308/310`, `:539/540`, `:634/635`),
- und wird **ausschließlich** in `frontend/src/utils/dungeon-commands.ts`
  konsumiert (Zeilen 416, 419, 808) — laut Kopfkommentar der Datei der
  **Terminal**-Command-Handler.

`DungeonGraphicalView` rendert in seiner Textbox nur `narrative.banter` und
`narrative.barometer` (`DungeonGraphicalView.ts:1819-1829`).

**Wirkung:** 129 Encounter-Templates mit zweisprachiger Prosa sind im
grafischen Modus unsichtbar. Der Spieler sieht nur Banter — also Atmosphäre ohne
Situationsbeschreibung. Das ist die inhaltlich schwerste Lücke der Liste:
geschriebener Kern des Spiels, der nur in einer von zwei Oberflächen ankommt.

**Systemischer Fix:** Die Auswahl „welcher Text gehört in diesen Raum" ist
Spiellogik und darf nicht zweimal existieren. Sie gehört in eine geteilte,
oberflächenneutrale Funktion (Muster: `dungeon-formatters.ts` /
`dungeon-entry-flow.ts`, wo `checkPartyComposition` und `autoPickPartyIds`
bereits genau so für beide Views geteilt werden). Terminal formatiert das
Ergebnis zu `TerminalLine[]`, Grafik rendert es als Szenentext. **Nicht** die
Terminal-Formatierer aufrufen und deren Zeilen in die Szene kippen.

**Gestaltungsfrage, die dazugehört:** Wo im Bild steht die Beschreibung? Sie
konkurriert heute schon mit der Party-Reihe (siehe C-3). Das ist ein
Szenen-Layout-Entwurf, keine reine Einbau-Aufgabe.

---

## B — Datenfehler, die als Layoutfehler aussehen

### B-1 · Agent-Porträts im Dungeon-Picker sind kaputt

**Beleg:** Im Picker zeigen alle acht Agenten den Broken-Image-Platzhalter mit
überquellendem Alt-Text („Aran", „Chry", „Vesp"). In derselben Sitzung rendern
dieselben Agenten im **Party-Panel** und in der **Szene** einwandfrei.

**Nicht die Ursache:** `VelgAvatar` (`components/shared/VelgAvatar.ts:141`)
rendert bei leerem `src` die Initialen — ein leerer Wert erzeugt also *kein*
kaputtes Bild. Die URL ist gesetzt und **404t**.

**Der systemische Kern:** Derselbe Begriff trägt zwei Feldnamen in zwei DTOs.
- Picker: `agent.portrait_image_url` (`DungeonGraphicalView.ts:2181`, Typ
  `Agent`, `types/index.ts:174`)
- Party-Panel: `agent.portrait_url` (`DungeonPartyPanel.ts:482`, Typ
  `AgentCombatStateClient`)

Jeder Konsument greift sich einen der beiden, und einer davon liefert eine
Adresse, die es nicht gibt. **Nicht am Aufrufer flicken.** Erst ermitteln,
welche der beiden Adressen falsch ist und warum sie divergieren (unterschiedliche
Storage-Präfixe? veraltete Spalte? eine der beiden nicht befüllt?), dann die
Quelle vereinheitlichen — ein Feldname, ein Bildungsgesetz, beide DTOs.

**Verwandter Befund, wahrscheinlich dieselbe Wurzel:** Auf der Agenten-Seite
sind die Kästchen der „Aufstellungsübersicht" ebenfalls leer, während die
Agentenkarten darunter Bilder tragen.

---

### B-2 · Der Picker widerspricht sich selbst: „Kein Agent besitzt SPY 4+" bei „SPY 6" auf jeder Karte

**Beleg:** Nach `AUTO-SELECT` erscheint die Kompositionswarnung
„Kein Agent besitzt SPY 4+. GROUND wird nicht verfügbar sein." — während **jede**
Agentenkarte `SPY 6 · GRD 6 · SAB 6` zeigt. Alle acht Agenten identisch.

**Vermutete Wurzel (zu verifizieren):** Die Chips kommen aus
`_renderAptChips(aptMap.get(agent.id))` (`DungeonGraphicalView.ts:2186`). Ist
`aptMap` leer, greift der Generalisten-Default aus `dungeon-formatters.ts`
(`GENERALIST_APTITUDES` / `topAptitudes()`) und zeigt für **jeden** Agenten
dieselben Werte. Die Warnung dagegen rechnet mit der echten — leeren — Map und
sagt korrekt „niemand hat SPY 4+".

**Systemischer Fix:** Der Fallback ist hier das eigentliche Übel. Er ersetzt
fehlende Daten durch plausible Zahlen und macht damit einen Ladefehler
unsichtbar — und erzeugt obendrein den sichtbaren Widerspruch. Zwei Dinge:
1. Klären, warum `aptMap` leer ist (dieselbe Datenlücke wie B-1? gemeinsame
   Ursache prüfen, bevor beide einzeln behandelt werden).
2. Entscheiden, was „keine Aptitudendaten" **anzeigen** soll. Ein
   Generalisten-Default, der wie ein Messwert aussieht, ist die falsche Antwort;
   entweder echte Werte oder ein sichtbar unbekannter Zustand. Die Warnung und
   die Chips müssen danach zwingend aus **derselben** Quelle lesen — sonst
   entsteht der Widerspruch später erneut.

---

### B-3 · Dungeon-Lobby zeigt fünf identische, inhaltsleere Karten

**Beleg:** Alle Archetypen zeigen `Magnitude 0.5 · Schwierigkeit 3 · Tiefe 6`.

**Ursache, kein Bug:** `dungeon_global_mode = "override"` auf Prod.
`DungeonEngineService.get_available_dungeons` (`dungeon_engine_service.py:583`)
setzt bei `override` `results = []` und füllt danach ausschließlich mit
Default-Werten (`suggested_difficulty=3`, `suggested_depth=5`). Die
Resonanzdaten, die die Karten differenzieren würden, werden vorher verworfen.

**Zwei getrennte Themen:**
1. **Betrieb:** `dungeon_global_archetypes` listet nur fünf Archetypen — Deluge,
   Awakening und Overthrow sind plattformweit ausgesperrt, obwohl vollständig
   und bebildert. Zusätzlich hat `Cité des Dames` einen eigenen, noch engeren
   Per-Sim-Override (vier Archetypen, ohne Prometheus). **Entscheidung des
   Auftraggebers**, nicht eigenmächtig ändern.
2. **Gestaltung:** Die Karten tragen weder Bild noch Icon noch
   Unterscheidungsmerkmal und stehen über ~500 px Leerraum. Für die acht
   Archetypen existieren bereits Showcase-Bilder
   (`simulation.assets/showcase/dungeon-{slug}.avif`, genutzt von Landing und
   `ArchetypeDetailView`) — die Lobby ignoriert sie. Das ist die naheliegende
   Wiederverwendung statt einer Neuentwicklung.

---

## C — Layout und Szene

### C-1 · Map-Rail: „Hierher bewegen" landet ganz unten, Knopf wird angeschnitten

**Beleg:** Nach Klick auf einen Nachbarknoten scrollt die Karte so, dass der
**aktuelle** Raum aus dem Bild fällt. Sichtbar bleiben nur gestrichelte
„?"-Platzhalter mit großen Zeilenabständen; das Detail-Panel klebt am unteren
Rand der Rail und der Knopf `HIERHER BEWEGEN` wird vom Rail-Rand beschnitten.

**Vorgeschichte:** Session 6 hat dafür `_scrollRoomPanelIntoView` in
`DungeonMap.ts` gebaut (container-relatives `scrollBy`, `behavior:'auto'`,
viewport-geclampt). Die Maßnahme greift offensichtlich nicht mehr oder nicht
unter diesen Bedingungen. **Vor dem Ändern messen** (Rail-Höhe, Content-Höhe,
Scroll-Position, Panel-Rect) statt am Symptom zu drehen.

**Der eigentliche Konstruktionsfehler dahinter:** Die Rail hostet Karte *und*
Detail-Panel in **einem** Scroll-Container. Deshalb muss ein
Auswahl-Klick immer irgendwo hin scrollen, und es gibt keine Position, die beides
zeigt. Ein Panel, das an der Rail klebt statt mit der Karte zu scrollen (Sticky
oder eigene Zeile im Rail-Grid), löst die Klasse — nicht die einzelne
Scroll-Rechnung.

---

### C-2 · Abgeschnittener, unverbundener Knoten links oben

**Beleg:** Am linken Rand der Rail hängt ein „?"-Knoten halb außerhalb, wird
beschnitten und zeigt keine Verbindungslinie zum Baum — er wirkt wie ein
Fragment. Gezoomt bestätigt.

**Ursache:** Der Karteninhalt ist breiter als die Rail-Spalte und wird ohne
horizontale Zentrierung/Polsterung beschnitten. Zusammen mit C-1 derselbe
Themenkreis: die Kartengeometrie ist nie gegen die tatsächliche Rail-Breite
gerechnet worden.

**Systemischer Fix:** Die Karte muss ihre Ausdehnung an der verfügbaren Breite
ausrichten (viewBox/Zentrierung), nicht an einer angenommenen. Solange das nicht
stimmt, produziert jede neue Raumanordnung neue Randfälle.

---

### C-3 · Drei Überlagerungen in der Szene

1. **Der TERMINAL/GRAPHICAL-Umschalter überlagert die erste Party-Karte** und
   verdeckt den Agentennamen, sobald die Seite gescrollt ist (gezoomt belegt).
2. **Die Narrative-Box liegt über den Party-Figuren** und schneidet deren
   Namensbeschriftungen an.
3. **Doppelter Scrollbalken** an der rechten Kante der Map-Rail.

Alle drei sind Stapel-/Flächenkonflikte in derselben Szene. Sie einzeln mit
`z-index` zu übermalen wäre der Workaround. Sinnvoller ist, die Szenenzonen
einmal verbindlich festzulegen (Gegner-Band oben, Party unten, Text wo?,
Overlays wo?) — die FX-Ebene setzt eine solche Zonenteilung ohnehin schon voraus.

---

### C-4 · Das Mausrad über der Karte scrollt die Seite statt der Rail

**Beleg:** Rad über der Rail → Header verschwindet, Footer erscheint, die
Kartenposition bleibt unverändert.

`overscroll-behavior: contain` liegt laut Session-6-Notiz auf der Rail-Karte,
verhindert das hier aber nicht. Prüfen, ob das Rad-Ereignis überhaupt einen
scrollbaren Vorfahren innerhalb der Rail findet — wenn der Container gar nicht
scrollt, bubbelt es korrekt nach oben und `contain` ist wirkungslos. Hängt
vermutlich mit C-1 zusammen.

---

### C-5 · Die Gegner-Bilder sind ~30 × 50 px und verpuffen

**Beleg:** Zwei Minions im Band, je etwa 30 px breit. Erst bei 2,3-facher
Vergrößerung erkennt man humanoide Figuren. Der Condition-Halo
(`drop-shadow ... var(--_cond)`) ist so groß wie die Kreatur. Das Band bleibt zu
rund 85 % leer.

**Ursache, offen benannt:** `FOE_GEOMETRY`
(`DungeonGraphicalView.ts`, Ende der Datei) wurde für **Silhouetten** entworfen —
abstrakte Formen lesen sich bei 30 px gut. Bei der Umstellung auf Bilder (Phase
3a, heute) wurden die Größen unverändert übernommen. Das ist der Fehler.

**Was dranhängt:**
- Die publizierte Rendition ist 384 px und war exakt auf diese Größen gerechnet
  (`ingest_dungeon_enemy_art.py`, Kopfkommentar: 112 CSS-px × DPR 3 = 336).
  **Wenn das Band wächst, muss `SCENE_EDGE` mitwachsen**, das Skript neu laufen
  und die Seed-Migration neu erzeugt werden — die Größe steht im Pfad
  (`-384.avif`), genau damit dieser Zusammenhang nicht übersehen wird.
- Der Condition-Halo braucht eine Stärke, die zur Bildgröße passt.
- Das leere Band: Verteilung und Maßstab gehören zusammen entworfen, nicht
  nacheinander geflickt.

---

### C-6 · Gegner sind reine Deko — kein Klick, keine Vergrößerung, kein Detail

`.scene__enemies` trägt `pointer-events: none` und `aria-hidden="true"`. Es gibt
weder Anklicken noch Lightbox noch Hover-Detail. Das war im Umfang von Phase 3a
nie enthalten, ist aber die vom Auftraggeber ausdrücklich benannte Lücke.

**Beim Entwurf beachten:** Sobald das Band interaktiv wird, fällt `aria-hidden`
weg — dann braucht es echte Zugänglichkeit (Fokusreihenfolge, Beschriftung,
Tastaturbedienung) und eine Abstimmung mit `DungeonEnemyPanel`, das dieselben
Gegner bereits als DOM-Liste führt. **Nicht zwei konkurrierende Gegnerlisten
bauen.** Zu prüfen: ob das Panel im grafischen Modus überhaupt noch nötig ist
oder im Band aufgeht.

---

## D — Text und Sprache

### D-1 · „8 AGENTSEN"

Kaputte Pluralbildung auf der Agenten-Seite. In `de.xlf` existiert
`<target>AGENTEN</target>` (Zeile 11657) — vermutlich wird eine Zählung mit
einem bereits pluralisierten Begriff verkettet. Systemisch: Pluralbildung gehört
in die i18n-Schicht, nicht in eine String-Verkettung am Aufrufer.

### D-2 · Englische Strings im deutschen UI

Gesehen: `ASSEMBLE PARTY`, `AUTO-SELECT`, `BEGIN DESCENT`, `Party: 0/4`,
`Select an archetype to begin the descent.`, `The chamber waits. Choose your
next move.`

Alle liegen im grafischen Dungeon-Pfad. Zu klären, ob sie nicht in `msg()`
gewickelt sind oder nur die Übersetzung fehlt — die Behandlung unterscheidet
sich. Hierzu passt die seit Längerem offene i18n-Sync-PR (~340 veraltete
Strings, siehe Rollout-Memory); diese sollte **eine eigene Änderung** bleiben und
nicht in die Sanierung eingemischt werden.

### D-3 · „STIMMUN" abgeschnitten

Label-Überlauf im Party-Panel; korrekt wäre „STIMMUNG".

---

## E — Vorschlag zur Reihenfolge

1. **A-2** (Sentry-DSN) — zuerst, weil ohne Observability jeder weitere Fix
   blind verifiziert wird.
2. **A-1** (Pixi/unsafe-eval) — holt eine ganze Feature-Ebene zurück.
3. **B-1 + B-2 gemeinsam** — vermutlich eine gemeinsame Datenwurzel; getrennt
   behandelt riskiert man zwei Fallbacks statt einer Ursache.
4. **A-3** (Raumbeschreibungen) — größte inhaltliche Lücke, braucht den geteilten
   Auswahlpfad **und** eine Layout-Entscheidung, also zusammen mit C-3.
5. **C-1/C-2/C-4** (Map-Rail) — ein Themenkreis, gemeinsam messen und lösen.
6. **C-5 + C-6** (Gegner-Maßstab und Interaktion) — zusammen entwerfen; C-5 zieht
   eine Neuerzeugung der Renditionen nach sich.
7. **D** — Sprachfehler, sammelbar; D-2 ggf. in die separate i18n-PR.
8. **B-3** — nur nach Rücksprache; Punkt 1 ist eine Betriebsentscheidung.

---

## F — Fallen aus dieser Sitzung

- **Der grafische View lädt spürbar nach.** Der erste Screenshot einer Ansicht
  zeigt oft eine leere Bühne, die zwei Sekunden später gefüllt ist. Vor dem
  Melden eines „leeren" Zustands nachladen lassen. (Das Dashboard zeigt beim
  Laden volle Kopfleisten über ~640 px Leere und **kein** Skeleton — auch das
  ist verbesserungswürdig, aber kein Defekt.)
- **Content-Viewport im Automations-Harness ist fix**; `resize_window` bewegt nur
  den Fensterrahmen. Responsive Media-Queries sind live nicht auslösbar → per
  Quellinspektion prüfen.
- **DPR 2:** Screenshot-Koordinaten ≠ CSS-Koordinaten (Faktor ~0,875). Klicks des
  `computer`-Tools nutzen Screenshot-Pixel.
- **Konsolen-Mitschnitt beginnt erst beim ersten `read_console_messages`.** Für
  Fehler aus dem Seitenaufbau vorher aufrufen und neu laden — sonst übersieht man
  genau solche Funde wie A-1.
- Der Prod-Admin ist `matthias@leihs.at` (nicht die Gmail-Adresse). Die im
  Browser angemeldete Sitzung war `matthias.leihs@gmail.com` — für
  Admin-Oberflächen umzumelden.
