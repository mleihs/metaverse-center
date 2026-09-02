# RESUME — Schleuse (Event-Intake) einbauen

**Stand 02.09.2026, nach Schritt 3.** Vier Commits auf main, nichts gepusht.
Prod läuft `dba881d0` — älter als alle vier.

    273e8d6a  Design-Paket, Prototyp-Extrakt, Nachträge
    5ca4ef00  Schritt 1 — types/intake.ts, IntakeStateManager.ts, 15 Tests
    cf0619c2  Schritt 2 — IntakeView, IntakeSensorTile, Responsive, 37 Übersetzungen
    e8a86344  Resume-Notiz + Vorarbeit Schritt 3
    (neu)     Schritt 3 — IntakeCrucibleModal, intake-labels, 77 Übersetzungen

▶ **ALS NÄCHSTES: Schritt 4** — Quarantäne-Karte rollenabhängig,
Resonanz-Modal (Hold) und Flag-Modal.

## Wo alles liegt

- `handoff/schleuse-event-intake.md` — der Bauplan, inzwischen mit **drei**
  Nachträgen am Ende (Palette · trockener Zufluss · Schritt 3).
- `handoff/schleuse-responsive.md` — umgesetzt, nichts offen.
- `handoff/schleuse-prototype-1b.html` — 853 Z. Nachschlagewerk.
  **Nicht lauffähig, nicht kopieren** — Inline-Styles auf Token übersetzen.

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
HEAD-Übersetzungen weg, die dazu nicht mehr passen. Die drei betroffenen
Einträge wurden nach dem Build von Hand zurückgestellt.

Ebenfalls fremd und **nicht anfassen**: `frontend/scripts/lint-condition-ladder-matches-taxonomy.sh`
(unversioniert) plus der Eintrag dazu in `frontend/package.json`. Das Tor
scheitert gerade an `lint-lint-scripts-anchored` (fehlender Anker-Vorspann) —
das ist die Baustelle des Peers, nicht unsere. Alle übrigen 29 Tore sind grün.

## ⚠ Der Zufluss ist trocken (am 02.09. gemessen, unverändert)

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
geprüft (tsc, 1068 Tests, 29 Lint-Tore), nicht am Schirm — Kammer ① ist auf
jeder echten Welt leer, weil seit Februar nichts hereinkommt. Wer ihn sehen
will, braucht zuerst einen fliessenden Zufluss (Guardian-502) oder ein
Signal von Hand.

## Umsetzungsreihenfolge (aus dem Plan)

1 ✅ · 2 ✅ · 3 ✅ · **4 Quarantäne + Resonanz-/Flag-Modal** · 5 Sichtung ·
6 Lesesaal/Scan-Log/Echo/Kammer ④ · 7 Quote + Abos · 8 alte Views löschen,
Nav-Eintrag, `social` entfernen.

Für Schritt 4 liegt schon bereit: `intakeState.toEvent/toResonance/toFlagged`,
`quotaReached`, `zoneName`, die Linse am Signal (`signal.lens`), der Vorschlag
(`signal.proposal`) und `--modal-body-padding`. Der Flag-Weg braucht Lücke 1
(`POST …/candidates/{id}/flag`) — bis dahin bleibt er lokal.

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
