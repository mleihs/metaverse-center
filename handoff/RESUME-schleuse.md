# RESUME — Schleuse (Event-Intake)

**Stand 02.09.2026, Abend. FERTIG: 8 von 8 Schritten, 6 von 6 Backend-Lücken.**

    Migrationen     334·337·338·340·341·343·345·347 auf Prod
                    nächste freie: 348
    Frontend        30 Lint-Tore grün · 1188 Tests · tsc + tsc:tests grün
    Backend         ruff grün · 5204 Tests
    ⚠ ungepusht     alles seit `f51b8249`

    ✅ 2  Story-Bündelung       Migr. 345 — „Netz-Tempo" sortiert
    ✅ 3  Passung               kein Migrations­bedarf; die Zahl ist die
                               Suszeptibilität, mit der der Resonanzlauf rechnet
    ✅ 4  Linse im Prompt       Migr. 341
    ✅ 5  Tagesquote            Einzel- UND Stapelweg
    ✅ 6  Abonnements           Migr. 347
    ✅ 7  Schlüssel Log↔Kandidat Migr. 343

▶ **ALS NÄCHSTES gibt es keinen Punkt in dieser Notiz mehr.** Was bleibt, ist
Betrieb, und zwei Dinge davon kann nur ein Mensch:

1. **Einen frischen Guardian-Schlüssel** eintragen (Admin → API-Schlüssel). Der
   gespeicherte ist tot (401), NewsAPI hat gar keinen. Ohne ihn bleibt der
   stärkste Zufluss trocken.
2. **Entscheiden, was mit den 34 beschädigten Depeschen geschieht** (7 leer, 27
   abgeschnitten). Sie stehen unverändert da; `UPDATE … SET bureau_dispatch =
   NULL` wäre der ehrliche Weg, dann entstehen sie beim nächsten Berühren neu.

⚠ **`news_scanner_enabled` steht auf `false`** — ein Peer hat die gesamte
autonome KI-Schicht abgeschaltet, weil das OpenRouter-Konto leer war. Es ist
wieder aufgeladen; ob und wann die Planer zurückkommen, ist eine Entscheidung
des Nutzers und keine Nebenwirkung. Für einen gezielten Lauf den Schalter kurz
anmachen und dem Peer Bescheid sagen.

**Was NICHT gebaut ist, und warum:** der Abo-Cron. Ein Zeitgeber, der von selbst
Modellaufrufe auslöst, kostet Geld ohne Klick — genau das, was heute
abgeschaltet wurde. Abos entscheiden die Auswahl, nicht die Ausgabe.

## Was heute dazugekommen ist

### `a3993cef` — der Schlüssel war tot, das Eintragen hätte den Lauf getötet

Die Aufgabe war „`guardian_api_key` in `platform_settings` eintragen". Beim
Nachsehen, WAS man da einträgt, fielen drei Dinge heraus:

1. **Der Schlüssel ist tot.** Die vier `simulation_settings`-Zeilen tragen
   dieselbe Fernet-Zeichenkette; entschlüsselt eine formal einwandfreie UUID.
   Direkt gegen den Guardian: **401 Unauthorized**. Mit `api-key=test`: 429
   (erkannt, nur gedrosselt) — das ist der Beleg, dass die Anfrage stimmt und
   nur der Schlüssel nicht. Letzte echte Guardian-Daten: 16./17.02.2026.
   **Er ist deshalb NICHT eingetragen worden.**
2. **Genau dieses Eintragen hätte den Scan-Zyklus getötet.** `GuardianError`
   und `NewsAPIError` erbten von `Exception` und standen in keinem Namen der
   Isolationsgrenze in `run_scan_cycle`. Ein 401 wäre an ihr vorbei durch die
   ganze Schleife gegangen und hätte jeden nachfolgenden Adapter, die
   Klassifikation und das Ablegen mitgenommen. Dass es nie passierte, lag
   allein daran, dass kein Schlüssel dastand.
3. **Die Antwort nannte das Symptom.** Alle drei Abrufwege antworteten auf jeden
   Fehler mit `502 "External API error. Please try again."` — auf einen toten
   Schlüssel die genau falsche Auskunft. **Damit ist auch der „Guardian-502"
   erklärt**: es war nie Cloudflare. Die Route ist gesund (unauthentifiziert
   sauberes JSON 422 in 91 ms), es war unsere eigene Fehlermeldung.

Dazu: 27 von 50 Bureau-Depeschen waren mitten im Wort abgeschnitten, 7 leer.
`model_dispatch` (ein Modell ohne Denken) + Budget 640 + eine Selbstprüfung, die
eine Antwort am Limit VERWIRFT statt sie zu speichern. Migration 338 ändert BEIDE
Stellen — die Vorlagen-Zeile in `prompt_templates` gewinnt über den Code, die
Code-Änderung allein hätte nichts bewirkt.

### `3c418ae2` — Schritt 5, die Sichtung

`IntakeTriageModal` (1500 px), Kartenraster mit optionalem Bildfach, Quellen-
Schiene, Suche, Sortierung, Magnitude-Filter, Mehrfachauswahl, vier verdrahtete
Tasten. Einzelheiten und die fünf Abweichungen vom Bauplan stehen im
Bauplan-Nachtrag „Schritt 5".

## ⚠ Was du über den Bauplan wissen musst, bevor du weiterbaust

**Drei Dinge, die er verspricht, gibt es nicht** — sie sind bewusst nicht
gebaut, und wer sie „nachholt", baut eine Lüge auf den Schirm:

- **„Verfällt nach 48 h"** — es gibt keinen Verfall. Kein Aufräumer, kein Cron,
  keine Frist auf `news_scan_candidates`. Wer den Verfall will, baut ihn; dann
  wird der Satz wieder richtig.
- **Die Rausch-Zeile** — das Backend filtert VOR dem Ablegen. Was es verwirft,
  erreicht das Frontend nie. Erst das Scan-Log (Schritt 6) kann es zeigen.
- **`fit` und `social_volume`** — Lücke 3 und 2. „Passung" und „Netz-Tempo" sind
  in der Sichtung DA und abgeschaltet; `BUREAU_RANKS_THE_SIGNALS` ist der eine
  Schalter zurück. **Keine Heuristik**: die einzigen verfügbaren Zahlen sind
  Magnitude und Alter, und beide stehen schon als eigene Sortierung daneben.

**Und eine Stelle, an der die ALTE Resume-Notiz irrte:** sie führte das
Zeilen-Spannweiten-Raster (`grid-auto-rows: 8px` aus einem ResizeObserver) der
Sichtung zu. Die Quelle (`schleuse-sensorleiste-kaputt-2026-09-02.md`) führt es
unter „Wo Masonry DOCH richtig wäre" beim **Lesesaal (Schritt 6)** — dort ist es
richtig und wartet auf dich.

## Offene Backend-Lücken

Lücke 1 (Melden) ist zu — Migration 334. Offen:

    2  Story-Bündelung: sources[] + social_volume je Kandidat
    3  Passungs-Score (fit) je Kandidat × Welt
    4  transform-article nimmt eine `lens` entgegen
    5  daily_event_quota serverseitig, 429 bei Überschreitung
    6  intake_subscriptions
    7  Scan-Log um die Schleusen-Stufe erweitern

## Was ein Mensch tun muss (nicht ich)

- **Einen frischen Guardian-Schlüssel** von open-platform.theguardian.com
  besorgen und unter **Admin → API-Schlüssel** eintragen (`guardian_api_key`).
  Das ist eine Zeile, und danach liefert die stärkste Nachrichtenquelle.
  NewsAPI hat gar keinen Schlüssel, nirgends.
- **Entscheiden, was mit den 34 beschädigten Depeschen geschieht.** 7 leer, 27
  abgeschnitten. Sie stehen unverändert in `news_scan_candidates`; Inhalt zu
  löschen ist eine Entscheidung, keine Nebenwirkung. Ein `UPDATE … SET
  bureau_dispatch = NULL` auf die betroffenen Zeilen wäre der ehrliche Weg, dann
  entstehen sie beim nächsten Berühren neu und ganz.

## Drei Befunde, die niemandem gehören

- **Plattform-Schlüssel liegen im Klartext.** `PlatformSettingsService.update`
  verschlüsselt NICHT; nur `simulation_settings` werden mit Fernet geschrieben.
  Der Lese-Weg (`decrypt_setting`) reicht Klartext durch, also fällt es nicht
  auf. Heute steht keine `*_api_key`-Zeile in `platform_settings` — der erste
  Schlüssel, den jemand einträgt, liegt dort unverschlüsselt.
- **Der Zeitstempel-Zusammenstoss 336/337 ist BEHOBEN** (02.09., nachmittags,
  Befund eines Peers). Meine erste Fassung dieses Absatzes war zu milde: 337
  hatte nicht eine geteilte Ledger-Zeile, sondern **gar keine** — der Eintrag
  scheiterte an `on conflict (version) do nothing`, weil 336 mit demselben
  Zeitstempel zuerst da war, und der überlebende Eintrag trug 336s Namen.
  `migration list` und `db push` vergleichen VERSIONEN, nicht Namen; damit
  wären künftig BEIDE Dateien übersprungen worden. Behoben: 337 heisst jetzt
  `20260902165000_337_…` (Inhalt unverändert, Reihenfolge unverändert), die
  Ledger-Zeile ist nachgetragen, der Ledger trägt 334–339 lückenlos.
- **⚠ Das Tor HAT gemeldet — gelesen hat es niemand.** Ich schrieb zuerst,
  `lint-migration-order.sh` habe geschwiegen, weil CI rot war. Falsch; ein Peer
  hat es berichtigt, und ich habe es mit `gh run view 33632203585 --log`
  nachgeprüft. Im Protokoll steht, im selben Lauf, wortwörtlich:

      FAIL: zwei Migrationen teilen sich einen Zeitstempel — das ist der Primärschlüssel.
        20260902160000:
          20260902160000_336_four_numbers_before_a_decision.sql
          20260902160000_337_classifying_is_not_thinking.sql

  Mit beiden Dateinamen und der fertigen Reparaturanweisung.

  🔑 **Ausgefallen ist nicht das Messgerät, sondern das LESEN.** Der Lauf war
  aus einem anderen Grund rot (Migration 299), also sagte „rot" nichts mehr, und
  niemand öffnete das Protokoll. Das ist unangenehmer als ein schweigendes Tor:
  **ein schweigendes Tor repariert man, ein übersehenes nicht.** Nicht
  Verdeckung, sondern Abstumpfung.

  **Rezept bei rotem CI:** nicht „ist eh rot", sondern
  `gh run view <id> --log | grep -E 'FAIL'` — zehn Sekunden für alle ANDEREN
  Befunde im selben Protokoll.

  Migration 299 selbst hat `velgarien-rebuild-6e` übernommen (`b778e6ee`, liegt
  im geteilten Baum). ⚠ Offen bleibt, ob DAHINTER weitere Migrationen auf
  frischer Datenbank scheitern — der Lauf bricht mit `ON_ERROR_STOP` ab, alles
  danach ist ungemessen.

## 🔑 Was heute gelehrt hat (gilt weiter)

**Ein plausibles Ergebnis ist kein Beleg.** Der Guardian-502 galt einen Tag lang
als Cloudflare-Störung, weil `text/html` zurückkam. Er war unsere eigene
`except Exception → 502`-Zeile über einem 401. Bei einem Fehler, der von aussen
zu kommen scheint, zuerst den eigenen Fehlerpfad lesen.

**Eine Isolationsgrenze, die nur die Fehler isoliert, die man ihr genannt hat,
ist keine.** Die Aufzählung `(PostgrestAPIError, httpx.HTTPError, KeyError,
TypeError, ValueError)` sah vollständig aus und liess genau die zwei Typen
durch, die dieser Code selbst wirft.

**Ein Zwang, der ZWEIMAL dasteht, ist zweimal unvollständig.** Die Stufenliste in
`get_platform_model` stand neben einem Verzeichnis, das dasselbe Wissen trug.
Sie ist jetzt daraus abgeleitet; ein Test läuft über alle Schlüssel.

**Eine Zahl aus einem Plan ist eine Behauptung.** Feste 0.40 gegen die
gerechnete Empfehlung des Servers; feste 512 gegen ein Denken, das bei GLEICHEM
Prompt zwischen 219 und 620 Token schwankt.

**Ein Name, der ZUSAMMENGESETZT wird, kann auf nichts zeigen, ohne dass es
auffällt.** `var(--color-source-${kind})` gibt es nicht — der Rückfall hätte
alles grau gemacht, lautlos.

**Eine wiederverwendete `msg()`-Zeichenkette erbt eine fremde Übersetzung.**
Fünfter und sechster Treffer in dieser View: `Fit` → „Eignung", `Open` → „Offen".
Vor `i18n:build` jede neue Quelle gegen `de.xlf` halten.

**Vier Backticks in css-Kommentaren an einem Tag, dann ein fünfter.** `node
frontend/scripts/lint-backtick-in-css.mjs` ZUERST, vor allem anderen.

**Gegen die QUELLE messen, nicht gegen die Zusammenfassung.** Diese Notiz hat
das Masonry-Raster der falschen View zugeordnet, und ich hätte es beinahe so
gebaut.

## Umsetzungsreihenfolge

1 ✅ · 2 ✅ · 3 ✅ · 4 ✅ · 5 ✅ · **6 Lesesaal/Scan-Log/Echo/Kammer ④** ·
7 Quote + Abos · 8 alte Views löschen, Nav-Eintrag, `social` entfernen.

Für Schritt 6 liegt bereit: das Zeilen-Spannweiten-Raster aus
`schleuse-sensorleiste-kaputt-2026-09-02.md` (rund vierzig Zeilen, keine
Abhängigkeit — dort ist es RICHTIG, weil der Lesesaal eine Stöberfläche ohne
Rang ist), `intakeState.toTriage` für den Rückweg, `imageOf` für die Bilder,
`intakeKindColorStyles` für die Quellenfarben.

## Wo alles liegt

- `handoff/schleuse-event-intake.md` — der Bauplan, mit **vier** Nachträgen
  (Palette · trockener Zufluss · Schritt 3 · Schritt 4 · Schritt 5).
- `handoff/schleuse-sensorleiste-kaputt-2026-09-02.md` — die Masonry-Recherche
  samt Browserstand und Bibliotheksvergleich.
- `docs/analysis/schleuse-zufluss-2026-09-02.md` — warum der Zufluss trocken ist.
- `handoff/denkmodell-als-standard-2026-09-02.md` — die projektweite Prüfung;
  der `OpenRouterService`-Pfad gehört dem Peer, die Schleuse mir.
- `handoff/schleuse-responsive.md` — umgesetzt, nichts offen.
- `handoff/schleuse-prototype-1b.html` — Nachschlagewerk. **Nicht lauffähig,
  nicht kopieren.**

## Vor jedem Commit

    cd frontend
    node scripts/lint-backtick-in-css.mjs   # ZUERST — bricht sonst den Baum für alle
    npx tsc --noEmit
    npm run lint:full
    npm run i18n:extract && <Ziele setzen> && npm run i18n:build

Und mit ausdrücklichen Pfaden committen (`git commit -- <pfade>`), nie
`git add .` — im geteilten Baum liegen immer fremde Dateien. **Nach dem Commit
den ENDSTAND prüfen, nicht den eigenen Diff:** `git show HEAD:…de.xlf` gegen die
eigenen IDs halten.

## i18n-Rezept

    cd frontend
    npm run i18n:extract          # NICHT `npx lit-localize extract`
    # jede neue <trans-unit> in src/locales/xliff/de.xlf braucht ein <target>
    # jede WIEDERVERWENDETE Quelle gegen ihr bestehendes <target> prüfen

Anrede: das Projekt **duzt**. Belegtes Vokabular: Eignung, Zustand, Stimmung,
Stärke, Splitter, Schmiede, Überlieferung, Dunkelkammer, Wesenszug, **Schleuse**,
**Schmelztiegel**, **Quarantäne**, **Sichtung**, **Lesesaal**, **Nachhall**,
**Wirklichkeit**, **Linse**, **Wucht**, **Tonlage**, **Fassung**, **Passung**,
**Netz-Tempo**.

## Wem was gehört (Stand 02.09., nachmittags)

- `velgarien-rebuild-6e`: Forge/BYOK + Dashboard, `components/forge/**`,
  `AdminForgeTab.ts`, `AdminUsersTab.ts`, Migrationen 330–333, 335, 336, **339**.
  Er nimmt ausserdem den `OpenRouterService`-Pfad der Denkmodell-Prüfung.
- Ein Peer arbeitet an der **Bauzustandsleiter + Beutekatalog**. Nicht anfassen.
- Ich (`velgarien-rebuild-af`): `components/intake/**`, `types/intake.ts`,
  `services/IntakeStateManager.ts`, `services/scanning/**`,
  `services/external/{guardian,newsapi,news_errors}.py`,
  `routers/social_trends.py`, `handoff/schleuse-*`, Migrationen 334, 337, 338.
  Später nötig: `layout/SimulationNav.ts`, `admin/AdminPanel.ts`, Löschung von
  `social/SocialTrendsView.ts` + `social/TransformationModal.ts`.

## Ausserdem offen (nicht Schleuse)

- Die **16 Dungeon-Befunde** in `handoff/dungeon-durchspielen-2026-08-31.md`.
- Die **projektweite Denkmodell-Prüfung** (`handoff/denkmodell-als-standard-2026-09-02.md`).
