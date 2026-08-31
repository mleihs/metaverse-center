# Resume — Sitzung `velgarien-rebuild-45`

Stand 31.08.2026, Nachmittag. **Nach einem Context-Clear: den Block unten
komplett in den Prompt kopieren.**

---

```
Lies zuerst das Gedächtnis `frontseite-l1-l7-2026-08-31`. Ich bin
`velgarien-rebuild-45`, der Peer ist `velgarien-rebuild-88` (ListAgents zuerst,
der NAME ist die Adresse für SendMessage).

Das Frontseiten-Redesign (L1–L7) IST FERTIG und committet, nichts gepusht.
Was noch offen ist, steht unten unter „Offen" — arbeite es der Reihe nach ab
und frag zwischendurch nicht „soll ich weitermachen?".

REGELN, die in diesem Projekt gelten:
- Geteilter Arbeitsbaum: NIE `git stash`. Und NIE `git commit` ohne Pfadangabe —
  immer `git commit -F <datei> -- <pfade>`. Ohne das nimmt der Commit alles mit,
  was der Peer zwischen `add` und `commit` in den Index gelegt hat (passiert am
  31.08. mit 14 Dateien).
- Prod-Schreibvorgänge NUR mit meinem Wort. Ein Peer kann das nicht weiterreichen.
- Migrationen: der ZEITSTEMPEL ist der Schlüssel, nicht die Nummer im Dateinamen.
- Vor jedem Commit: ruff + tsc + `npm run lint:full` + pytest.
- Jede Messung gegen den ECHTEN Fall prüfen, bevor du ihr glaubst — und gegen
  HEAD messen, nicht gegen den Plan.
- `velg-frontend-design`-Skill vor der ersten Zeile Komponentencode.
- `frontend/src/locales/**` gehört dem Peer (H2). `lit-localize extract` NICHT
  selbst aufrufen — dem Peer Bescheid sagen.
- Dem Peer melden, was du anfasst, BEVOR du es anfasst.
```

---

## Was in diesem Lauf fertig wurde

**Merkmalstor-Verwaltung im Admin** (war Voraussetzung fürs Redesign)
`backend/services/platform_gate_contracts.py` erklärt **23 Plattform-Tore**, je
mit einem Satz, was der Schalter anschaltet, was sein Ausbleiben kostet,
`default_when_missing` (gemessen!) und `wired`.
`backend/tests/unit/test_platform_gate_contracts.py` bindet per AST in beide
Richtungen. `GET /api/v1/admin/feature-gates` + `AdminFeatureGatesTab.ts` als
**erster** Unterreiter unter Admin → Plattform.

**L1** `GET /api/v1/public/landing` — ein Aufruf statt Wasserfall.
**L4** Bildstrecke 20,61 MB → 1,58 MB, erste Bildlast 63 KB, **auf Prod abgelegt**.
**L5/L6/L7** `LandingPage.ts` von 2 302 auf 120 Zeilen, sechs Abschnittsdateien.

## Offen — in dieser Reihenfolge

1. **Welt-Übersetzungen schreiben.** `scripts/backfill_world_locale.py` ist
   vorgelegt und im Trockenlauf geprüft (11 Welten, 7 neue Titel, 9 neue Texte,
   4 bewusst OHNE deutschen Titel weil Eigennamen). Ausführen:
   `WORLD_LOCALE_CONFIRMED=yes .venv/bin/python scripts/backfill_world_locale.py --write`
   — **braucht das Wort des Nutzers.**

2. **`velgarien.description` steht auf DEUTSCH in der ENGLISCHEN Spalte.**
   Eine englische Fassung fehlt ganz. Zweite Entscheidung, nicht im Nachtrag
   enthalten.

3. **133 neue `msg()`-Zeichenketten** warten beim Peer (H2). Die 20 langen
   Weltbeschreibungen in `LandingForge.ts` sind der Brocken.

4. **Verwaist nach dem Umbau:** `velg-dungeon-showcase` (71 KB) und
   `velg-landing-agent-showcase` (24 KB). Keine Laufzeitkosten (nicht
   importiert = nicht im Bündel). Löschen ist Nutzerentscheidung — beide tragen
   echte Arbeit.

5. **Fünf DRIFT-Schalter auf Prod, die nichts liest:** `drift_ai_enabled`,
   `drift_p1..p4_enabled`. Über `pg_get_functiondef` gemessen: 0 Funktionen
   (`drift_fun_core_enabled`: 10). Die Oberfläche sagt „vorbereitet, nichts
   liest diesen Schalter". Zeilen entfernen oder anschließen?

6. **Plattformweit, kein Frontseiten-Problem:**
   `/storage/v1/object/public/…` liefert IMMER `cache-control: no-cache`, egal
   was beim Ablegen gesendet wird — in drei Formen und gegen einen frischen
   Pfad geprüft. Halb so schlimm: ETag → **304 mit null Bytes**. Betrifft alle
   Bilder der Plattform.

## Die vier Lehren, die im Kopf bleiben sollen

**`git add <pfade>` schützt nicht, wenn `git commit` ohne Pfadangabe folgt.**
Der Index ist im geteilten Baum gemeinsam.

**Ein fail-closed PARSER ist keine fail-closed ABWESENHEIT.** Was mit einem
ankommenden Wert geschieht, sagt nichts darüber, was ohne Zeile geschieht — das
entscheidet die Vorgabe des Aufrufers, und die muss man LESEN.

**Ein Status ist kein Betrieb.** Sieben Epochen stehen in einem spielenden
Status und keine hat sich seit 164 Tagen bewegt.

**Lint grün ≠ Seite richtig.** tsc und alle 23 Tore waren sauber, bevor die
Seite zum ersten Mal im Bild stand. Erst dann sichtbar: zwei Navigationsleisten
übereinander, zwei `main#main-content`, ein Weltkartenrahmen von 2 × 21 px
(`aspect-ratio` wirkt NICHT auf `display: inline`), ein leerer Abschnitt mit
192 px Höhe.
