# Resume — Sitzung `velgarien-rebuild-45`

Stand 31.08.2026, Abend. Die vier Punkte aus dem Vorlauf sind **gebaut**.
Offen ist genau eine Sache: ein Prod-Schreibvorgang, der auf das Wort des
Nutzers wartet.

---

## ⏳ DAS EINZIGE, WAS NOCH AUSSTEHT

```
# Trockenlauf — läuft sauber, 31 Zeilen würden geändert
.venv/bin/python scripts/backfill_world_locale.py

# Der Schreibvorgang (PROD). Braucht das ausdrückliche Wort des Nutzers.
WORLD_LOCALE_CONFIRMED=yes .venv/bin/python scripts/backfill_world_locale.py --write
```

31 Zeilen = 11 Vorlagen + 20 Klon-Zeilen. Nach dem Schreiben gegenprüfen:

```
.venv/bin/python scripts/backfill_world_locale.py   # muss „0 Zeilen" melden
```

---

## ✅ Was in diesem Lauf fertig wurde (4 Commits, nichts gepusht)

| Commit | Inhalt |
|---|---|
| `f639dffa` | Punkt 3 — drei verwaiste Dateien weg, die vierte lebte |
| `b75153b0` | Punkt 4 — fünf tote DRIFT-Tore angeschlossen |
| `047100f8` | Peer-Nachzug — `status`-Filter, zwei Erklärungen berichtigt |
| `78399c84` | Punkte 1+2 — Übersetzungen deluxe, Spaltenfehler ×4 |

### Punkt 1+2 — Übersetzungen und Spaltenfehler
Texte neu **geschrieben**, nicht übersetzt. Fünf Titel geändert:
„Der konventionelle Speicher", „Währung des Stoffwechsels und Kapitalismus der
Zelle", „Die Architektur **zu** Babel" (Turmbau), „Der Gaslicht-**Sund**"
(*Reach* = Gewässerabschnitt), „Das **Panopticon**" (Foucault, nicht
Wachsfigurenkabinett). Vier Welten bleiben ohne deutschen Titel.

Der Spaltenfehler betrifft **vier** Zeilen, nicht eine: `velgarien` **und**
`velgarien-e3/-e4/-e5`. Gefunden erst beim Zählauf über alle 41 Zeilen.

### Punkt 3 — verwaiste Dateien
Drei gelöscht (2 106 Zeilen). Die vierte, `dungeon-showcase-data.ts`, **lebt**
— sie trägt 49 belegte Zitate und die Archetyp-Detailseiten. Umgezogen nach
`components/archetypes/`. Dazu: tote Felder `scrim`/`cssClass`, zwei tote
Linter-Ausnahmen, vier Dokumente.

### Punkt 4 — DRIFT-Tore
`DriftService.get_public_state` liest alle sechs in EINEM Abruf, kumulative
Regel an EINER Stelle. `DriftPublicState` + `ai`/`p1..p4`/`highest_open_phase`.
Ausbaustufen-Leiter im HUD (nur im Zweig ohne Lauf). 24 neue Tests. Kein Tor
mehr unverdrahtet.

---

## 🔑 Die fünf Lehren

**1. Die Messung im Auftrag war falsch.** `dungeon-showcase-data.ts` galt als
verwaist, weil es unter `landing/` lag und „showcase" hieß. Die Bühne war tot,
die Daten nicht. Ursache war der ORT — deshalb umgezogen, nicht nur verschont.

**2. Eine halbe Reparatur ist eine Regression.** Dreht man bei Velgarien nur
`description` auf Englisch, läuft der deutsche Rückfall (`t()` in
`locale-fields.ts`) ins reparierte Feld: die deutsche Seite zeigt ab sofort
Englisch. Nur als **Paar** schreiben.

**3. Der Abstammung folgen, aber nicht mit dem Titel.** Klone hängen über
`source_template_id` an der Vorlage. Der deutsche Titel darf NICHT mitwandern —
er verschluckte den Epochenzusatz.

**4. Angeschlossen ≠ wirksam.** Hinter P1–P4 steht kein Merkmal, und
`drift_ai_enabled` riegelt nichts ab (DRIFT ruft keine KI). Es kommt in der
Spieleroberfläche deshalb gar nicht vor: „KI aus" läse sich als ersparte Kosten.

**5. `platform_settings` steht auf Prod in Python-Schreibweise** (`True`, nicht
`true`). `parse_setting_bool` kleinschreibt — aber nie selbst gegen `"true"`
vergleichen.

---

## Offene Punkte danach

- **T5** (vom Peer): `/platform-stats` ist tot — `getPlatformStats` hat null
  Verwender, `LandingService` ist das bessere Duplikat. Entfernen eines
  öffentlichen Endpunkts ist eine Nutzerentscheidung.
- `get_platform_stats` zählt **Epochen weiterhin allein am Status** (Prod: 7
  statt 0). Nur die `status`-Hälfte ist behoben.
- Der deutsche Text von `the-panopticon-of-good-taste` ist maschinennah
  („ambiantes Licht", „Panoptikum"). Gefüllte Felder werden nicht überschrieben.
- `POST /admin/dungeon-showcase/generate-image` hat null Aufrufer im Frontend,
  erzeugt aber die Bilder der Detailseiten.
- Plattformweit: `/storage/v1/object/public/…` liefert immer
  `cache-control: no-cache`.

## Regeln, die gelten

- Geteilter Arbeitsbaum: NIE `git stash`, NIE `git commit` ohne Pfadangabe.
- Prod-Schreibvorgänge nur mit dem Wort des Nutzers.
- Migrationen: der ZEITSTEMPEL ist der Schlüssel. Nächste freie Nummer: **311**
  ab `20260831200000` (308–310 sind beim Peer vergeben).
- Vor jedem Commit: ruff + tsc + `npm run lint:full` + pytest.
- `frontend/src/locales/**` gehört dem Peer.
