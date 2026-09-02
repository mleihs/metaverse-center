# RESUME — Schleuse (Event-Intake) einbauen

**Stand 02.09.2026, nach Schritt 4.** Sieben Commits auf main, nichts gepusht.
Prod läuft `dba881d0` — älter als alle sieben.

    273e8d6a  Design-Paket, Prototyp-Extrakt, Nachträge
    5ca4ef00  Schritt 1 — types/intake.ts, IntakeStateManager.ts, 15 Tests
    cf0619c2  Schritt 2 — IntakeView, IntakeSensorTile, Responsive, 37 Übersetzungen
    e8a86344  Resume-Notiz + Vorarbeit Schritt 3
    e36a4bc7  Schritt 3 — IntakeCrucibleModal, intake-labels, 77 Übersetzungen
    4de50a56  Berichtigung: der Endstand war ein anderer als der eigene Diff
    (neu)     Schritt 4 — Quarantäne, Resonanz, Melden + Migr. 334 + 2 Endpunkte

▶ **ALS NÄCHSTES: Schritt 5** — Sichtung (`IntakeTriageModal`) mit
Story-Bündelung, Filtern, Mehrfachauswahl, Tastatur und Rauschen.

⚠ **MIGRATION 334 IST NIRGENDS ANGEWENDET.** Weder lokal (es lief kein
Supabase) noch auf Prod. Bis sie läuft, antwortet `POST …/intake/flag` mit
einem Fehler: die CHECK-Bedingung auf `news_scan_candidates.status` kennt
`flagged` nicht, und die beiden Spalten gibt es nicht. Der Melden-Knopf ist
also gebaut, aber erst nach Migration + Deploy wirksam. **Nächste freie
Migration bleibt damit 335.**

## Wo alles liegt

- `handoff/schleuse-event-intake.md` — der Bauplan, inzwischen mit **drei**
  Nachträgen am Ende (Palette · trockener Zufluss · Schritt 3).
- `handoff/schleuse-responsive.md` — umgesetzt, nichts offen.
- `handoff/schleuse-prototype-1b.html` — 853 Z. Nachschlagewerk.
  **Nicht lauffähig, nicht kopieren** — Inline-Styles auf Token übersetzen.

## Was Schritt 4 gebracht hat

**Frontend:** `IntakeQuarantineCard` (Kammer ②, rollenabhängig),
`IntakeResonanceModal` (Depesche + Suszeptibilitätstafel + Halte-Knopf),
`IntakeFlagModal` (Melden), `intake-styles.ts` (geteilte Chips und Knöpfe —
der Schmelztiegel liest sie jetzt auch, das 32. Lint-Tor prüft es).

**Backend:** Migration 334, `models/intake.py`, `services/intake_service.py`,
`routers/intake.py`, `GET …/candidates/{id}/susceptibility`,
`ResonanceService.susceptibility_of()` (aus dem Lauf herausgezogen),
`ScannerService.approve_candidate` nimmt jetzt auch `flagged`.
10 neue Backend-Tests, 1 neuer Frontend-Test.

🔑 **Zwei Zahlen im Bauplan waren falsch, beide auf dem Schirm eines
unumkehrbaren Knopfes** — Einzelheiten im Bauplan-Nachtrag „Schritt 4":

- Übersprungen wird bei **0.05**, nicht bei 0.2. `EFFECT_SKIP_THRESHOLD` stand
  seit Schritt 1 falsch; ein Test nagelt die Zahl jetzt fest.
- `sus` kommt NICHT aus `SubstrateAttunement`, sondern aus
  `fn_get_adaptive_susceptibility`. Attunement ist ein Abzug DANACH.

## Was Schritt 3 gebracht hat

Neu: `components/intake/IntakeCrucibleModal.ts`, `components/intake/intake-labels.ts`.
Geändert: `IntakeView.ts` (ein Knopf „Transformieren" am Platzhalter der
Kammer ①, damit das Modal erreichbar ist), `IntakeStateManager.ts` (Zonen),
`types/intake.ts` (`IntakeTone`, `INTAKE_FREEDOMS`, `transformRequestOf`),
`shared/BaseModal.ts` (`--modal-body-padding`, Vorgabe unverändert),
`tests/intake-signal.test.ts` (5 Tests dazu → 1068 grün).

**Die vier Abweichungen vom Plan und ihre Gründe stehen im Bauplan-Nachtrag**
(drei statt fünf Schritte · kein `GenerationProgress` · `<textarea>` statt
`contenteditable` · keine Zeugen-Zeile). Kurz: der Plan beschreibt an diesen
Stellen eine Bühne, kein Verhalten.

**Der Schmelztiegel integriert NICHT.** `in → q` ist sein ganzer Auftrag;
`q → ev` gehört in Kammer ② und kommt in Schritt 4.

## 🔑 Drei Lehren, die weiterreichen als diese View

**1. Ein Token-Name kann existieren und trotzdem der falsche sein** (Schritt 2).
`--color-primary` gibt es, aber `ThemeService.ts:80` bildet das Weltfeld
`color_primary` darauf ab — er wechselt pro Welt. Prüffrage: gehört diese Farbe
der WELT oder der PLATTFORM? Für Bureau-Flächen ist `--color-accent-amber`
richtig.

**2. Eine wiederverwendete Zeichenkette erbt eine fremde Übersetzung**
(Schritt 3, viermal). Die Kennung ist der Hash der QUELLE: `msg('Record')` bekam
„Aktenvermerk", `msg('Register')` bekam „Registrieren" (der Titel der
Anmeldeseite), `msg('Tremor')` bekam „Tremor" (eine Journal-Fragmentart),
`msg('Balanced')` bekam „Ausgeglichen". Alle vier sehen im Code richtig aus.
**Rezept vor jedem `i18n:build`:** jede neue `msg()`-Zeichenkette gegen `de.xlf`
halten und bei jedem Treffer fragen, ob dort dieselbe Sache gemeint ist.

**3. Ein Regler, der nichts bewegt, muss das sagen.** Der Aufruf nimmt keine
Linse entgegen (Lücke 4), also erreichen Tonlage, Freiheit und Anweisung heute
nichts. Sie stehen trotzdem da — mit einer Marke `°` und einer Fussnote, die
sagt was wirkt und was nicht. `LENS_REACHES_MODEL` in der Datei ist der eine
Schalter, der beides wieder entfernt. Zeugen dagegen sind gar nicht erst gebaut:
für sie gibt es nicht einmal einen Speicherort, an dem sie später wirken würden.

## ⚠ Geteilter Arbeitsbaum — was hier gerade schiefgehen kann

Beim Festschreiben von Schritt 3 stand in `de.xlf` und `locales/generated/de.ts`
bereits die unfertige Arbeit eines Peers (Bauzustandsleiter, Beutekatalog:
3 Einheiten ersetzt, 3 neu). `npm run i18n:extract` schreibt die GANZE Datei —
wer sie danach committet, nimmt die halbe Arbeit eines anderen mit und löscht
dabei Übersetzungen, die der Code auf HEAD noch braucht.

**Rezept:** nach `i18n:extract` die IDs gegen `git show HEAD:…de.xlf` diffen und
alles, was nicht aus der eigenen Datei stammt, vor dem Commit
zurückbauen — der Commit soll `HEAD + eigene Einheiten` sein, die Arbeitskopie
darf `HEAD + Peer + eigene` bleiben. Für `generated/de.ts` gilt dasselbe: der
Build liest den QUELLBAUM, findet dort die Peer-Änderungen und wirft die
HEAD-Übersetzungen weg, die dazu nicht mehr passen.

**Wie es dann tatsächlich ausging (der lehrreiche Teil):** genau das wurde
gemacht — und war umsonst. Der Peer schrieb im selben Moment `33b6e4d5` fest
und nahm die Sprachdateien so mit, wie sie auf der Platte lagen: seine drei
Einheiten UND meine 77, zusammen mit seinen Quelländerungen. Damit war der
Stand auf einen Schlag richtig, und mein `git commit -- <pfade>` fand an den
beiden Dateien nichts mehr zu tun — sie stehen deshalb NICHT in `e36a4bc7`.
Der Absatz „Geteilter Arbeitsbaum" in jener Commit-Nachricht beschreibt also
die durchgeführte Vorsichtsmassnahme, nicht den Weg, auf dem die Zeilen
tatsächlich in die Geschichte kamen. Geprüft ist der Endstand: jede Einheit in
`de.xlf` hat ein `<target>`, meine 77 tragen ihr deutsches Wort, die drei
überholten Einheiten sind samt ihrer Quelle fort.

🔑 **Die Lehre:** in einem geteilten Baum gehört eine generierte Gemeinschafts-
datei dem, der zuerst committet — die Sorgfalt davor ist trotzdem richtig,
denn ohne sie wäre der umgekehrte Fall (ich zuerst) eine gelöschte
Peer-Übersetzung auf main gewesen. **Nach dem Commit den ENDSTAND prüfen, nicht
den eigenen Diff:** `git show HEAD:…de.xlf` gegen die eigenen IDs halten.

Ebenfalls fremd und **nicht anfassen**: `scripts/lint-condition-ladder-matches-taxonomy.sh`
plus der Eintrag dazu in `frontend/package.json` — inzwischen mit `33b6e4d5`
festgeschrieben und angeschlossen (`.github/workflows/ci.yml`). Während meines
Laufs scheiterte es noch an `lint-lint-scripts-anchored` (fehlender
Anker-Vorspann); vor dem nächsten Commit also `npm run lint:full` neu messen,
nicht diese Zeile glauben.

## ⚠ Der Zufluss ist trocken — vollständig vermessen am 02.09.

**Der ganze Befund steht in `docs/analysis/schleuse-zufluss-2026-09-02.md`.**
Das Wichtigste in vier Zeilen:

- **Reddit gibt es nicht.** Null Treffer im Backend. Der einzige Treffer im
  Repo ist meine eigene `SOCIAL_ADAPTERS`-Menge in `types/intake.ts` — der
  Zweig ist unerreichbar, die Klasse `social` kann nicht eintreten.
- **Bluesky gibt es, aber nur in der Gegenrichtung.** `BlueskyService` kann
  veröffentlichen, hochladen, löschen und die Kennzahlen EIGENER Beiträge
  lesen. Kein `searchPosts`, kein Feed. Auf Prod läuft die
  Instagram→Bluesky-Kreuzveröffentlichung aktiv.
- **Der Scanner hat auf Prod NIE gelaufen.** `news_scan_candidates` und
  `news_scan_log` sind leer — null Zeilen. `news_scanner_enabled = false` seit
  09.03.2026.
- **Zwei Orte für einen Schlüssel.** Der Scanner liest `guardian_api_key` aus
  `platform_settings` (dort steht KEINE einzige `*_api_key`-Zeile), der
  Browse-Weg aus `simulation_settings` pro Welt (dort stehen vier, alle
  Velgarien + Epochen). Deshalb liegen alle 12 Trends in einer Welt, und
  deshalb genügt `news_scanner_enabled = true` allein nicht.

⚠ **Folge für Schritt 5:** die Abnahmebedingung „Sozialquellen erscheinen nur
als Chips oder im Rauschen, nie als eigene Zeile" ist weder erfüllbar noch
verletzbar. Als **nicht anwendbar** führen, nicht als erledigt abhaken.

### Die alten Messwerte (unverändert)

- `POST …/social-trends/browse` mit `source: guardian` → **Cloudflare-502 in
  580 ms**, `text/html` statt JSON. Mit `source: newsapi` → sauberes JSON 400
  „NewsAPI key not configured". Die Route ist gesund, nur der Guardian-Zweig
  bringt den Ursprung zum Schweigen. **Ursache steht im Backend-Log, dort noch
  nicht nachgesehen.**
- Deshalb sieht der Nutzer (Wortlaut nicht wiedergegeben) statt der echten Meldung:
  `BaseApiService.handleResponse` ruft `response.json()` auf HTML, das wirft,
  und `errorMessage` bleibt auf dem Standardwert. **Gilt für JEDEN Endpunkt.**
- Prod-Bestand: 12 Trends, alle in „Velgarien", alle `guardian`, alle vom
  16./17.02.2026. 15 von 16 Welten haben null. Seither 197 Tage nichts.

**Folge für die Abnahme:** der Schmelztiegel ist bisher nur gegen den Code
geprüft (tsc, 1068 Tests, alle Lint-Tore), nicht am Schirm — Kammer ① ist auf
jeder echten Welt leer, weil seit Februar nichts hereinkommt. Wer ihn sehen
will, braucht zuerst einen fliessenden Zufluss (Guardian-502) oder ein
Signal von Hand.

## Umsetzungsreihenfolge (aus dem Plan)

1 ✅ · 2 ✅ · 3 ✅ · 4 ✅ · **5 Sichtung** · 6 Lesesaal/Scan-Log/Echo/Kammer ④ ·
7 Quote + Abos · 8 alte Views löschen, Nav-Eintrag, `social` entfernen.

Für Schritt 5 liegt bereit: `intakeState.inTriage/toEntrance/discard/restore`,
`--modal-body-padding` (die Sichtung ist 1500 px breit und besteht aus
randlosen Zeilen), `intake-styles.ts` und die Archetyp-Zeichen über
`CATEGORY_RESONANCE[…].signature` → `icons.resonanceArchetype`.

Offene Backend-Lücken, die Schritt 5 betreffen: **Lücke 2** (Story-Bündelung —
`/candidates` liefert kein `sources[]` und kein `social_volume`) und **Lücke 3**
(`fit`-Score). Beide bedeuten: die Sichtung zeigt vorerst eine Zeile je
Rohsignal, nicht je Geschichte, und die Sortierung „Passung" ist ohne Backend
eine Heuristik — dann als solche kennzeichnen, nicht als Messwert.

## Vor jedem Commit

    cd frontend
    node scripts/lint-backtick-in-css.mjs   # ZUERST — bricht sonst den Baum für alle
    npx tsc --noEmit
    npm run lint:full
    npm run i18n:extract && <Ziele setzen> && npm run i18n:build

Und mit ausdrücklichen Pfaden committen (`git commit -- <pfade>`), nie
`git add .` — im geteilten Baum liegen immer fremde Dateien.

## i18n-Rezept

    cd frontend
    npm run i18n:extract          # NICHT `npx lit-localize extract`
    # jede neue <trans-unit> in src/locales/xliff/de.xlf braucht ein <target>
    # jede WIEDERVERWENDETE Quelle gegen ihr bestehendes <target> prüfen (s. o.)
    npm run i18n:build            # baut UND dekodiert die HTML-Entities

`de.xlf` UND `de.ts` mitcommitten. Zwei Tore prüfen das:
`locale-targets-wellformed` (Test) und `lint-no-html-entities-in-locales.sh`.
Anrede: das Projekt **duzt**. Belegtes Vokabular: Eignung, Zustand, Stimmung,
Stärke, Splitter, Schmiede, Überlieferung, Dunkelkammer, Wesenszug, **Schleuse**
(Airlock), **Schmelztiegel**, **Quarantäne**, **Sichtung**, **Lesesaal**,
**Nachhall**, **Wirklichkeit**, **Linse**, **Wucht**, **Tonlage**, **Fassung**.

## Wem was gehört (Stand 02.09., 10:35)

- `velgarien-rebuild-6e`: Forge/BYOK, `backend/routers/forge.py`, `ai_utils.py`,
  `components/forge/**`, `AdminForgeTab.ts`, `AdminUsersTab.ts`, Migrationen
  330–333. **Nächste freie Migration: 334.**
- Ein Peer arbeitet gerade an der **Bauzustandsleiter + Beutekatalog**:
  `components/buildings/BuildingEditModal.ts`, `how-to-play/htp-topic-data.ts`,
  `docs/specs/game-systems.md`, `frontend/scripts/lint-condition-ladder-matches-taxonomy.sh`,
  `frontend/package.json`. **Nicht anfassen**, und seine Übersetzungen nicht
  mitcommitten (s. o.).
- Ich (`velgarien-rebuild-af`): alles unter `components/intake/**`,
  `types/intake.ts`, `services/IntakeStateManager.ts`, `handoff/schleuse-*`,
  `handoff/RESUME-schleuse.md`. Später nötig: `layout/SimulationNav.ts`,
  `admin/AdminPanel.ts`, Löschung von `social/SocialTrendsView.ts` +
  `social/TransformationModal.ts`.

## Ausserdem offen (nicht Schleuse)

- Der **Guardian-502** (Backend-Log noch nicht angesehen) — blockiert die
  Abnahme der ganzen Schleuse, siehe oben.
- Die **16 Dungeon-Befunde** in `handoff/dungeon-durchspielen-2026-08-31.md`.
