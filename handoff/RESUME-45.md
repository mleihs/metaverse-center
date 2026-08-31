# Resume — Sitzung `velgarien-rebuild-45`

Stand 31.08.2026, Abend. **Nach einem Context-Clear: den Block unten komplett
in den Prompt kopieren.**

Die vier Punkte des Vorlaufs sind durch, die Frontseite ist 4K-fähig, das
Rastersystem liegt in der Merkmalsschicht, und das Dashboard-DTO trägt
gemessene Felder. Offen ist die **Dashboard-Oberfläche**.

---

```
Lies zuerst das Gedächtnis `vier-offene-punkte-2026-08-31-abend`, dann diese
Datei (`handoff/RESUME-45.md`). Ich bin `velgarien-rebuild-45`, der Peer ist
`velgarien-rebuild-88` (ListAgents zuerst, der NAME ist die Adresse).

▶ AUFGABE: die Dashboard-Oberfläche bauen.

   Paket:  handoff/dashboard-redesign/README.md          die Spezifikation
           handoff/dashboard-redesign/Dashboard Redesign.dc.html   Prototyp
           handoff/TODO-offen.md → T6, T6a                die Messungen
   Im Umfang: Abschnitt id="4a" (Command Stage) und id="3a" (Weltenregister).
   id="5a" ist die 2560-Probe von 4a. 1a/2a/2b sind ausserhalb.
   Ersetzt wird `frontend/src/components/platform/SimulationsDashboard.ts`
   (2 312 Zeilen), Route `/dashboard` in `app-shell.ts:170`.

   ⚠ FANG NICHT MIT DEM CSS AN — das Fundament steht schon (siehe unten), und
   die Datenfrage ist beantwortet. Was fehlt, ist die Oberfläche.

▶ WAS SCHON GEBAUT IST UND BENUTZT WERDEN MUSS

   Das Raster (NICHT nachbauen, es gibt es):
     tokens/_layout.css       --stage-measure 1920px
                              --stage-gutter  48px → 64px ab 1920
                              --stage-type-scale 1 → 1,15 ab 2560
     tokens/_typography.css   --text-display-sm  Countdown  (60 → 69px)
                              --text-display-md  Aufforderung (96 → 128px)
                              --text-display-lg  Titelzeile (158 → 212px)
     shared/stage-styles.ts   .stage-container   normale Inhaltsreihe
                              .stage-bleed-row   randlose Linie, bündiger Inhalt
                                                 (Befehlsleiste, Fusslaufband)

     static styles = [stageStyles, css`…`];
     <div class="layout stage-container">…</div>
     <div class="cmdbar stage-bleed-row">…</div>

   Das DTO (`GET /api/v1/users/me/dashboard`) trägt seit `84929925`:
     worlds[]                  simulation_id, name, name_de, slug, member_role,
                               theme, banner_url, agent_count, building_count,
                               lore_body(_de), lore_epigraph(_de)
     active_epoch_participations[]  … + cycle_deadline_at, has_acted_this_cycle
     substrate_status          'anomalous' | 'stable'
     active_resonance_count    (andere Frage! siehe unten)
     academy_epochs_played

▶ DIE DATENLAGE — GEMESSEN AUF PROD, NICHT GERATEN

   Der Entwurf verlangt neun Dinge. Die Übergabe nannte sechs „gibt es nicht".
   Nachgemessen existieren VIER davon:

     ✅ Weltkunst          banner_url bei 16 von 16 Vorlagen
     ✅ Lore + Sinnspruch  simulation_lore, 109 Zeilen über ALLE 16 Welten,
                           zweisprachig (body_de, epigraph_de)
     ✅ Kennzahlen         agent_count/building_count, Sicht simulation_dashboard
     ✅ Substratzustand    ableitbar aus substrate_resonances.status
     ✅ Agentenporträts    229 von 258 (Spalte heisst `portrait_image_url`)
     ✅ Auszeichnungen     34 Definitionen (NICHT 48 wie im Entwurf), 16 vergeben
     ⚠ Zyklusfrist        vollständig gebaut, KEIN Gegenstand — siehe unten
     ⚠ Orders 1/3         gibt es nicht; messbar ist has_acted_this_cycle (Ja/Nein)

   Und zwei Zahlen des Entwurfs, die der Frontseiten-Fall wiederholen:
     „44 Welten"  → gemessen 16 Vorlagen
     „12/48"      → gemessen 34 Definitionen

   ⚠ DIE ZYKLUSFRIST IST KEIN FEHLENDES FELD. Die Spalten cycle_deadline_at und
   cycle_started_at gibt es seit Migration 204 (13.04.). Es gibt DREI Schreiber
   (epoch_lifecycle_service:137, cycle_resolution_service:126,
   epoch_chat_service:276), einen Leser (EpochCycleScheduler) und der Zeitgeber
   läuft (app.py:220). Trotzdem hat NULL von SIEBEN Epochen eine Frist: jede
   steht still, seit BEVOR es die Spalte gab (jüngste Bewegung 20.03.). Der
   Übergang, der die Frist setzt, greift zusätzlich nur bei
   `auto_resolve_mode != "manual"`.
   → Der Countdown gehört GEBAUT und muss ehrlich verfallen, wenn keine Frist
     steht. Nicht weglassen, nicht hinrechnen.

   ⚠ ZWEI FRAGEN ANS SUBSTRAT, NICHT EINE:
     active_resonance_count  wie viele Beben im Spiel sind (mit abklingenden)
     substrate_status        ob GERADE gestört wird (detected|impacting)
   Auf Prod liegt genau der Trennfall vor: EIN Beben, Status `subsiding` — es
   zählt, aber die rote Warnzeile bleibt aus. Nicht zusammenlegen.

▶ WAS DAS DASHBOARD NICHT SELBST HOLT
   Weltenregister → simulationsApi.listPublic
   Auszeichnungen → achievementsApi
   Resonanzzeilen → resonanceApi.list
   Agentenkarten  → agentsApi.listPublic
   TCG-Karten     → <velg-game-card>, docs/explanations/tcg-card-system.md
   Ein Dashboard-Endpunkt, der alles einsammelt, wäre in drei Monaten der Ort,
   an dem jede neue Kachel angebaut wird.

▶ DREI FALLEN, DIE HEUTE ZUGESCHLAGEN HABEN

   1. `box-sizing: content-box` GILT IM SCHATTEN-DOM. `max-width: 1920px` misst
      dann nur den Inhalt, der Kasten wird 1920 + 2 × Polsterung breit, und der
      Rand ist bei 2560 px um 64 px je Seite falsch. tsc und alle 23 Tore waren
      grün. Wer `stage-styles.ts` benutzt, kann den Fehler nicht machen.

   2. EIN BACKTICK IN EINEM KOMMENTAR INNERHALB VON css`…` BEENDET DAS TEMPLATE.
      Mir heute ZWEIMAL passiert, dem Peer einmal — trotz Eintrag im Gedächtnis.
      In CSS-Kommentaren doppelte Anführungszeichen benutzen, keine Backticks.

   3. `overflow: hidden` AUF EINEM FLEX-KIND HEBT `min-width: auto` AUF, und der
      Text schneidet ab (Peer-Befund T1: elf von vierzehn Reitern). Betrifft
      jede Kachel mit Verlauf oder Rahmen in einer Flex-Reihe — im Dashboard
      also Warteschlangenzellen, Weltzeilen, Registerkarten. `flex-shrink: 0`
      oder `min-width: 0` bewusst setzen.

▶ REGELN
   - Geteilter Arbeitsbaum: NIE `git stash`. NIE `git commit` ohne Pfadangabe —
     immer `git commit -F <datei> -- <pfade>`.
   - `velg-frontend-design`-Skill vor der ersten Zeile Komponentencode.
   - `lit-localize extract` NICHT selbst aufrufen; neue `msg()` dem Peer melden.
   - Vor jedem Commit: ruff + tsc + `npm run lint:full` + pytest.
   - Prod-Schreibvorgänge und Migrationen NUR mit dem Wort des Nutzers.
   - Jede Messung gegen den ECHTEN Fall prüfen, bevor du ihr glaubst — das hat
     heute viermal etwas gerettet.
   - Nach Frontend-Änderungen IM BROWSER messen. Lint grün ≠ Seite richtig.
```

---

## Was in diesem Lauf fertig wurde (7 Commits, 1 noch nicht gepusht)

| Commit | Inhalt |
|---|---|
| `f639dffa` | drei verwaiste Dateien weg — die vierte lebte (49 Zitate) |
| `b75153b0` | fünf tote DRIFT-Tore angeschlossen, 24 Tests |
| `047100f8` | Peer-Nachzug `status`-Filter, zwei Erklärungen berichtigt |
| `78399c84` | Welt-Übersetzungen deluxe, Spaltenfehler ×4 gefunden |
| `276fc8c8` | Handoff |
| `b070eb30` | Frontseite Breitbild + 4K |
| `dbe39071` | **Migration 312 auf Prod** — Übersetzungen, Skript entfallen |
| `7502ff6e` | **Design-System**: die Bühne in der Merkmalsschicht |
| `84929925` | **Dashboard-DTO** trägt Gemessenes, 14 Tests |

**Auf Prod:** Migration 312 (Titel 5→12, Texte 7→36, deutscher Text in
englischer Spalte 4→**0**). Nächste freie Migrationsnummer: **313** (der Peer
hat 313 für sich reserviert — vor dem Anlegen bei ihm nachfragen).

## Die Lehren

**1. Eine Freigabe ist der Anlass, den WEG zu prüfen, nicht nur den Knopf zu
drücken.** Der Nutzer gab den Prod-Schreibvorgang frei; das Handskript mit
Dienstschlüssel war trotzdem falsch (nicht im Diff lesbar, nicht wiederholbar,
nicht am Deploy). Es wurde eine Migration.

**2. Die Messung im Auftrag war zweimal falsch.** „Vier verwaiste Dateien" —
es waren drei, die vierte trug 49 belegte Zitate. „Sechs Daten gibt es nicht" —
vier davon existieren.

**3. Eine halbe Reparatur ist eine Regression.** Nur `description` zu drehen
hätte die deutsche Seite englisch gemacht.

**4. Angeschlossen ≠ wirksam.** Die DRIFT-Tore melden ihren Zustand; hinter
P1–P4 steht kein Merkmal. Das steht so in den Torbeschreibungen.

**5. Ein System entsteht nicht durch zwei parallele Lösungen.** `--landing-*`
plus `--dashboard-*` wären zwei Rasterlogiken gewesen. Jetzt: `--stage-*`.

## Offene Punkte

- **Dashboard-Oberfläche** (die Aufgabe oben).
- **986 feste `font-size`-Angaben in Pixeln**, kein Lint-Tor für Größen — in
  `docs/guides/design-tokens.md` als offen notiert.
- **Operativ-Farben** (`utils/operative-constants.ts`) leben am Tokensystem
  vorbei. Älter als das Paket, TCG hängt daran — eigener Umbau.
- **T7**: `test_travel_havarie.py` hängt von der Testreihenfolge ab.
- `the-panopticon-of-good-taste` hat einen maschinennahen deutschen Text
  („ambiantes Licht", „Panoptikum"). Gefüllte Felder werden nicht überschrieben.
- **Die Simulationsansicht bekommt ebenfalls ein Claude-Design-Paket** (vom
  Nutzer angekündigt).
