# Resume — Sitzung `velgarien-rebuild-45`

Stand 31.08.2026, Nachmittag. **Nach einem Context-Clear: den Block unten
komplett in den Prompt kopieren.**

Das Frontseiten-Redesign (L1–L7) ist FERTIG und committet, nichts gepusht.
Offen sind vier Punkte, die der Nutzer bewusst hinter den Context-Clear gelegt
hat.

---

```
Lies zuerst das Gedächtnis `frontseite-l1-l7-2026-08-31`, dann diese Datei
(`handoff/RESUME-45.md`). Ich bin `velgarien-rebuild-45`, der Peer ist
`velgarien-rebuild-88` (ListAgents zuerst, der NAME ist die Adresse für
SendMessage).

Das Frontseiten-Redesign ist durch. Es sind VIER Punkte offen. Arbeite sie in
dieser Reihenfolge ab und frag zwischendurch nicht „soll ich weitermachen?".

▶ 1. DIE ÜBERSETZUNGEN AUF DELUXE HEBEN, DANN SCHREIBEN
   `scripts/backfill_world_locale.py` trägt 11 Welten: 7 neue deutsche Titel,
   9 deutsche Texte, 1 englische Korrektur. Vier Welten bekommen ausdrücklich
   KEINEN deutschen Titel (Eigennamen: Speranza, Cité des Dames, Velgarien,
   Station Null) — das ist entschieden, nicht vergessen.

   ⚠ ABER: die vorhandenen Texte sind ERSTE ENTWÜRFE und genügen dem Anspruch
   NICHT. Der Nutzer verlangt ausdrücklich: „die Übersetzung muss deluxe sein."
   Sie lesen sich derzeit als Übersetzung, nicht als deutsche Prosa. Was
   konkret zu tun ist:
     · Jeder Text muss klingen, als wäre er auf Deutsch GESCHRIEBEN worden,
       nicht aus dem Englischen gewendet. Satzbau umbauen, wo das Deutsche es
       anders will. Keine englische Wortstellung, keine Partizipialketten.
     · Die Titel prüfen, nicht nur die Texte. „Konventioneller Speicher" ist
       technisch richtig und als Welttitel flach. „Stoffwechselwährung und
       zellulärer Kapitalismus" ist wörtlich und klobig. „Die Architektur von
       Babel" sollte vermutlich „Die Architektur zu Babel" heißen (Anklang an
       „Turmbau zu Babel"). „Die Gaslicht-Weite" für „The Gaslit Reach" ist
       unsicher — „Reach" ist ein Gewässerabschnitt.
     · Den Ton der Welt treffen: Spengbab ist derb, Cité des Dames ist
       feierlich, Station Null ist knapp und kalt, Velgarien ist bürokratisch.
     · Fachbegriffe stehen lassen, wo sie im Deutschen etabliert sind
       (Contrada/Contrade, Unterzee, ARC, Hydroponik, biolumineszent).

   Erst wenn die Texte sitzen, ausführen — es ist ein PROD-SCHREIBVORGANG und
   braucht mein ausdrückliches Wort:
     .venv/bin/python scripts/backfill_world_locale.py            # Trockenlauf
     WORLD_LOCALE_CONFIRMED=yes .venv/bin/python scripts/backfill_world_locale.py --write

▶ 2. VELGARIEN: DEUTSCHER TEXT IN DER ENGLISCHEN SPALTE
   `velgarien.description` ist auf DEUTSCH und steht in der ENGLISCHEN Spalte;
   `description_de` war leer. Ein englischsprachiger Besucher liest dort seit
   jeher deutschen Text. Der Nachtrag oben verschiebt den deutschen Text nach
   `description_de` und setzt eine englische Fassung daneben (`description_en_fix`,
   die EINZIGE Stelle, an der das Skript ein gefülltes Feld überschreibt).
   Auch dieser englische Text muss deluxe sein, nicht bloß korrekt.

   🔑 Und prüfe, ob es weitere Welten mit derselben Verwechslung gibt — ich
   habe nur die 16 lebenden angesehen, nicht die Epochen-Klone und Archivierten.

▶ 3. ZWEI VERWAISTE KOMPONENTEN LÖSCHEN
   `frontend/src/components/landing/DungeonShowcase.ts` (19 KB) mit
   `dungeon-showcase-styles.ts` (36 KB) und `dungeon-showcase-data.ts` (16 KB),
   sowie `LandingAgentShowcase.ts` (24 KB). Die neue Frontseite bindet sie nicht
   mehr ein; gemessen: 0 Verwender im ganzen Werk. Zur Laufzeit kosten sie
   nichts (nicht importiert = nicht im Bündel), aber sie sind totes Gewicht.
   Vor dem Löschen NOCH EINMAL messen (`grep -rl "<velg-dungeon-showcase"`),
   und prüfen, ob in `dungeon-showcase-data.ts` literarische Inhalte stehen,
   die anderswo hingehören statt in den Papierkorb.

▶ 4. DIE FÜNF TOTEN DRIFT-SCHALTER ANSCHLIESSEN (nicht entfernen)
   `drift_ai_enabled`, `drift_p1_enabled`, `drift_p2_enabled`,
   `drift_p3_enabled`, `drift_p4_enabled` stehen auf Prod und werden von NICHTS
   gelesen — gemessen über `pg_get_functiondef` auf der laufenden DB: 0
   Funktionen (zum Vergleich `drift_fun_core_enabled`: 10), und im Python
   nennt sie nur die Vertragsdatei selbst.

   Der Nutzer hat entschieden: ANSCHLIESSEN, nicht löschen — „wähle immer die
   nachhaltigere Aktion". Die Anschlussstelle ist schon vorbereitet und steht
   ausdrücklich im Bestand: `backend/models/drift.py`, `DriftPublicState` hat
   heute genau EIN Feld (`enabled`) und der Docstring sagt wörtlich „further
   phase flags are an additive extension on this model, never a new endpoint".

   Vorgeschlagener Weg (gegen HEAD prüfen, nicht blind übernehmen):
     a) `DriftService.get_phase_state()` — liest alle sechs drift-Tore in EINER
        Abfrage und wendet die KUMULATIVE Regel an: P2 gilt nur als offen, wenn
        P1 und P0 offen sind. Die Regel gehört an EINE Stelle, sonst leitet sie
        die nächste Lesestelle neu her.
     b) `DriftPublicState` um `ai`, `p1`…`p4` und `highest_open_phase` erweitern
        (additiv, kein neuer Endpunkt).
     c) `GET /api/v1/public/drift/state` liefert es mit; die HUD zeigt, welche
        Phase offen ist.
     d) In `platform_gate_contracts.py` bei den fünf `wired=False` → `wired=True`.
        Dann wird `test_unwired_gates_are_really_dead` ROT und zwingt zur
        Umstellung — genau dafür ist der Test da.
     e) Tests: kumulative Regel (P2 ohne P1 = zu), fehlende Zeile = zu.

   ⚠ Zu `drift_ai_enabled` gemessen: DRIFT macht heute ÜBERHAUPT KEINE
   KI-Aufrufe (kein `run_ai`, kein `GenerationService` in `drift_service.py`
   oder `routers/drift.py`). Das Tor ist also ein Riegel für etwas, das es noch
   nicht gibt. Es trotzdem lesbar zu machen ist richtig — dann fragt die erste
   DRIFT-Textgenerierung das vorhandene Tor, statt ein neues zu erfinden. Aber
   behaupte in der Oberfläche nicht, es spare gerade Geld.

REGELN, die in diesem Projekt gelten:
- Geteilter Arbeitsbaum: NIE `git stash`. Und NIE `git commit` ohne Pfadangabe —
  immer `git commit -F <datei> -- <pfade>`. Ohne das nimmt der Commit alles mit,
  was der Peer zwischen `add` und `commit` in den Index gelegt hat (passiert am
  31.08. mit 14 Dateien).
- Prod-Schreibvorgänge NUR mit meinem Wort. Ein Peer kann das nicht weiterreichen.
- Migrationen: der ZEITSTEMPEL ist der Schlüssel, nicht die Nummer im Dateinamen.
- Vor jedem Commit: ruff + tsc + `npm run lint:full` + pytest.
- Jede Messung gegen den ECHTEN Fall prüfen, bevor du ihr glaubst.
- Wähle immer die nachhaltigere Aktion — den Weg, der die URSACHE beseitigt.
- `velg-frontend-design`-Skill vor der ersten Zeile Komponentencode.
- `frontend/src/locales/**` gehört dem Peer (H2). `lit-localize extract` NICHT
  selbst aufrufen — dem Peer Bescheid sagen.
- Dem Peer melden, was du anfasst, BEVOR du es anfasst.
```

---

## Was in diesem Lauf fertig wurde (6 Commits, nichts gepusht)

**Merkmalstor-Verwaltung im Admin** (war Voraussetzung fürs Redesign).
`backend/services/platform_gate_contracts.py` erklärt **23 Plattform-Tore**, je
mit einem Satz, was der Schalter anschaltet, was sein Ausbleiben kostet,
`default_when_missing` (gemessen, nicht aus dem Namen geschlossen) und `wired`.
AST-Test bindet in beide Richtungen. `GET /api/v1/admin/feature-gates` +
`AdminFeatureGatesTab.ts` als **erster** Unterreiter unter Admin → Plattform.

**L1** `GET /api/v1/public/landing` — ein Aufruf: 9 Zahlen, 4 Welten, 3 Bürger.
**L4** Bildstrecke 20,61 MB → 1,58 MB, erste Bildlast **63 KB**, auf Prod abgelegt.
**L5/L6/L7** `LandingPage.ts` von 2 302 auf 120 Zeilen, sechs Abschnittsdateien.

## Die vier Lehren, die im Kopf bleiben sollen

**`git add <pfade>` schützt nicht, wenn `git commit` ohne Pfadangabe folgt.**
Der Index ist im geteilten Baum gemeinsam.

**Ein fail-closed PARSER ist keine fail-closed ABWESENHEIT.** Was mit einem
ankommenden Wert geschieht, sagt nichts darüber, was ohne Zeile geschieht — das
entscheidet die Vorgabe des Aufrufers, und die muss man LESEN.

**Ein Status ist kein Betrieb.** Sieben Epochen stehen in einem spielenden
Status, keine hat sich seit 164 Tagen bewegt.

**Lint grün ≠ Seite richtig.** tsc und alle 23 Tore waren sauber, bevor die
Seite zum ersten Mal im Bild stand. Erst dann sichtbar: zwei Navigationsleisten
übereinander, zwei `main#main-content`, ein Weltkartenrahmen von 2 × 21 px
(`aspect-ratio` wirkt NICHT auf `display: inline`), ein leerer Abschnitt mit
192 px Höhe.

## Weitere offene Punkte (nicht in den vier oben)

- **133 neue `msg()`-Zeichenketten** warten beim Peer (H2). Die 20 langen
  Weltbeschreibungen in `LandingForge.ts` sind der Brocken.
- **Plattformweit:** `/storage/v1/object/public/…` liefert IMMER
  `cache-control: no-cache`, egal was beim Ablegen gesendet wird — in drei
  Formen und gegen einen frischen Pfad geprüft. Halb so schlimm: ETag →
  **304 mit null Bytes**. Betrifft alle Bilder der Plattform.
- **`get_platform_stats` filtert `status` nicht** (heute zufällig richtig, weil
  alle 16 Vorlagen `active` sind). Beim Peer als Punkt gemeldet.
