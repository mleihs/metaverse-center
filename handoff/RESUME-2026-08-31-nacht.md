---
title: "Fortsetzungs-Prompt nach dem Context-Clear"
date: "2026-08-31"
type: handoff
lang: de
---

# Fortsetzung — Sitzung `velgarien-rebuild-88`, 31.08.2026 nachts

> **Alles gepusht** (`origin/main` = `e2edbb51`). Arbeitsbaum sauber bis auf
> `handoff/simulation-views/` (das neue Design-Paket, noch nicht committet).
> Backend **5 018 grün, 0 rot**; `npm run lint:full` tsc exit 0, alle 23 Tore PASS.

---

## ▶ DIE NÄCHSTE AUFGABE: PHASE 4 · DUNGEON

Ein neues Claude-Design-Paket liegt in **`handoff/simulation-views/`**. Der
Vertrag ist **`README.md` §4.1–4.10**, die Arbeitsliste **`TODO-OPUS.md`
Phase 4**. Prototypen als `.dc.html` direkt im Browser öffnen (`Dungeon
Graphical View.dc.html` = 1:1-Nachbau plus UX-Erweiterungen, `Dungeon
Stage.dc.html` = tiefer Kampf-Prototyp). Jede Datei hat Sektion `id="1a"`
(1440-Referenz) und `id="1b"` (2560-Probe).

**Kern der Übergabe ist 4.6 (Targeting-Kette)** — ein NEUES Feature: eine
Datenquelle, drei Anker (Befehlskarte über dem Agenten, „im Visier"-Tag am
Gegner, ✓ am Tab plus Anweisungsleiste ①–④). Abnahme: zwei Agenten auf denselben
Gegner → zwei Porträts im Visier-Tag; Rücknahme an JEDEM der drei Anker
konsistent.

### ⚠ Vier Dinge sind schon im Live-Code (von `velgarien-rebuild-af` gemessen)

Die TODO-Liste erweckt den gegenteiligen Eindruck — nicht doppelt bauen:

* `.dungeon-hud__actions` hat bereits `grid-column: 2 / 3`. **Offen an 4.1 bleibt
  nur** `grid-row: 2 / 4` für Rail und Seiten-Spalte (steht auf `2`, Zeilen
  119/139 in `dungeon-graphical-styles.ts`) und der Desktop-Collapse.
* Das Bühnen-Grid steht schon auf `auto minmax(132px,1fr) auto minmax(0,auto)`
  (Zeile 346).
* `DungeonMap.ts:519` hat `preserveAspectRatio="xMidYMin meet"` bereits.
* `resolveDungeonEnvironment` + `FxProfile` (8 Profile) + `MeterDirection` und
  `abilityPictogramUrl` / `abilityIntent` existieren als Utils — die
  Pressure-Ebene und die Pictogram-Masken haben ihre Datenquelle schon.

### Regeln, die für Phase 4 besonders gelten

* **`velg-frontend-design`-Skill vor dem ersten Bauteil-Code.** CLAUDE.md.
* **Dungeon-Inhalt gehört NICHT nach Python.** Seit A1.5 ist
  `content/dungeon/**/*.yaml` die Quelle, Laufzeit liest über
  `dungeon_content_service`. `scripts/lint-no-content-in-python.sh` weist es ab.
  Neue Gegner/Banter/Fähigkeiten → YAML → `generate_migration` → Seed-Migration.
* **Kantenstreifen-Sweep** (`box-shadow: inset 2px 0 0` → getönte Fläche +
  1px-Umriss) in `components/dungeon/**` selbst anwenden — die Nachbarsitzung
  lässt das Verzeichnis aus. Tor: `lint-no-accent-edge-bar.sh`.
* 4.8 (Chronik-Raumgruppierung) braucht einen Backend-/State-Anfasser: Raumfeld
  beim Beat-Absorbieren mitschreiben. Falls Migration: **nächste freie Nummer
  319**, und der ZEITSTEMPEL ist der Schlüssel, nicht die Nummer.

---

## ⚠ VIER SITZUNGEN IM SELBEN ARBEITSBAUM

    Phase 0 + 1   Nav-Umbau, Reiter „Übersicht", Simulation View v4   velgarien-rebuild-45 (Paketführung)
    Phase 2 + 3   Chat + Broadsheet                                    velgarien-rebuild-af
    Phase 4       Dungeon                                              DIESE SITZUNG
    Dashboard     (fertig, deployt)                                    velgarien-rebuild-45

    components/dungeon/** · components/combat/**          uns
    components/chat/** · components/broadsheet/**         af
    components/layout|lore|agents|buildings|shared/**     45
    components/platform/**                                45

Der Schnitt und die Regeln stehen in `handoff/simulation-views/CLAIMS.md`.

* **`frontend/src/locales/**` gehört DIESER Sitzung.** Beide Peers melden ihre
  neuen `msg()`-Zeichenketten und rufen NICHT selbst `lit-localize extract`.
* **Nie `git stash`.** Immer `git commit -F <datei> -- <pfade>` — `git add`
  allein schützt nicht (hat schon 14 fremde Dateien mitgenommen).
* ⚠ **`backend/tests/integration/` fährt gegen DIESELBE lokale Datenbank.**
  Gemessen: zwei gleichzeitige Läufe derselben Datei → **6 von 6 rot**,
  15–17 Fehlschläge je Lauf, mit Signaturen, die wie echte Fehler aussehen
  (`run not found`, `run is havarie, not active`). Sequenziell 1 rot in 30.
  Vorher abstimmen. Für `backend/tests/unit` egal.

---

## Was heute auf Prod ging

| Migr. | Inhalt | Nachgemessen |
|---|---|---|
| **313** | `active_agents/buildings/events` prüfen die Elternwelt mit | Waisen 30→0 / 34→0, Bestand 228/290, anon-Grant erhalten |
| **316** | `conversation_summaries` nicht mehr anon/auth-lesbar | anon+auth false, service_role true, `security_invoker=on` |
| **317** | vier anonyme Richtlinien der Chat-Familie entfernt | als anon 0/0/0/0; Agenten 228, Welten 36 unverändert |

314 und 315 gehören der Nachbarsitzung, ebenfalls auf Prod. **Nächste freie
Nummer: 319** (318 ist für `-45` reserviert). Ledger-Zeilen nachgetragen.
Von aussen geprüft: `/health`, `/public/landing`, `/public/simulations` je 200,
Frontseiten-Zahlen 16/16/0/1.

---

## ⏳ DIE N5-MESSUNG LÄUFT — nicht zu früh nachsehen

**T10/Weg 1 ist gebaut:** `SOCIAL_INTERACTIONS["insult"]["opinion_range"]` steht
auf `(-100, 20)` statt `(-100, -20)`. Bis heute konnte eine Meinung nie unter
Null gehen, weil `insult` (die einzige Quelle dafür) eine bereits negative
Meinung verlangte — die Bedingung der Ursache war ihre eigene Wirkung.

**In einer Woche messen:**

```sql
select min(opinion_score), max(opinion_score),
       count(*) filter (where opinion_score < 0)  as negative,
       count(*) filter (where opinion_score <= -60) as am_tor
  from agent_opinions;
select count(*) from agent_opinion_modifiers where opinion_change < 0;
select count(*) from events where created_at > now() - interval '7 days';
```

Ausgangswerte: Spanne **0 … 45**, 1 177 Zeilen, **null negative**;
0 negative Modifikatoren; 0 Ereignisse in 24 h.

⚠ **Erwartung: eine Beleidigung alle ein bis drei Wochen**, nicht täglich (25
Paare trafen sich in 24 h, 6 von 258 Agenten liegen unter −20, `insult` hat
9 % Anteil an den dann gültigen Wahlen). **Wer nach einem Tick nachmisst, sieht
nichts und hält die Änderung fälschlich für wirkungslos.**

**✅ BEANTWORTET (31.08., nach dem Clear): der Deploy trägt `7f706ef5` — Weg 1 LÄUFT.**

Ohne Coolify geklärt. Der Server sagt es selbst:

```
curl -s https://metaverse.center/ | head -c 200
→ <meta name="velg-release" content="7f706ef5f7e3cc95482e6788c0d654b3e80b49a9" />
  <meta name="velg-commit"  content="7f706ef" />
```

🔑 **Diese Marke ist kein Build-Artefakt, sondern eine Laufzeit-Aussage** — und nur
deshalb beweist sie etwas über das Backend. `backend/utils/spa_document.py` stempelt
sie beim Ausliefern des SPA-Dokuments aus `build_identity.RELEASE`, und das liest
`SENTRY_RELEASE` bzw. `SOURCE_COMMIT` aus der Umgebung des **laufenden
Backend-Prozesses** (Coolify injiziert `SOURCE_COMMIT` zur Laufzeit in den Container,
nicht als Build-Arg — der Modul-Docstring begründet das). Sie bezeugt damit genau die
Schicht, in der `SOCIAL_INTERACTIONS["insult"]` lebt. Eine reine Frontend-Marke hätte
das nicht getragen: für eine Backend-Änderung wäre sie die halbe Bedingung gewesen.

Zwei unabhängige Gegenproben stimmen überein:

* **Locale-Weg (der aus der Nacht vorgeschlagene):** das ausgelieferte
  `assets/de-DyG1YvxT.js` (679 kB, echtes deutsches Bündel) enthält
  **kein** „Einsatzterminal" → `5da147f8` ist nicht drin. Passt zu einem Deploy auf
  `7f706ef5`. ⚠ Der Weg ist tückisch: „Verlangt dich" fehlt ebenfalls, aber die
  Zeichenkette existiert lokal überhaupt nicht mehr — eine Abwesenheit belegt hier
  also nichts. Erst der Abgleich mit dem lokalen Bündel machte die Probe gültig.
* **Zeitprobe:** `last-modified` des Chunks = 31.08. 11:18:53 GMT = **13:18:53 CEST**,
  vier Minuten nach `7f706ef5` (13:14:44 +0200). `5da147f8` kam 13:17:55 — der Build
  hatte seinen HEAD zu dem Zeitpunkt schon gezogen.

**Damit zählt die N5-Woche ab 31.08.2026, ~13:19 CEST.** Frühestens **07.09.**
nachsehen — und auch dann zurückhaltend lesen: die Erwartung ist eine Beleidigung
alle ein bis drei Wochen, ein leeres Ergebnis am 07.09. ist **kein** Beleg für
Wirkungslosigkeit. Belastbar wird die Messung um den **21.09.**

**Nebenbefund:** das Dashboard-Redesign ist live, aber `5da147f8` + `e2edbb51`
(die 42 + 12 deutschen Zeichenketten dazu) sind **nicht** ausgeliefert — auf Prod
steht das neue Dashboard gerade unübersetzt. Der nächste Deploy holt es nach.

---

## Offene Punkte

`handoff/TODO-offen.md` führt T1–T10 plus einen Anhang. Offen und
entscheidungsbedürftig:

* **T2** — The Chitinous Mandate gehört dem zweiten Konto und fehlt im
  Auswahlmenü. Umhängen, Mitglied eintragen, oder so lassen.
* **T10, zweiter Teil** — **jede Beziehung in Velgarien ist unerwidert**
  (39 von 39 Paare mit Modifikatoren, null beidseitig). `combinations(zone_agents, 2)`
  liefert jedes Paar in FESTER Reihenfolge, nur A's Meinung über B wird
  geschrieben. Bewusst getrennt geblieben, damit die Weg-1-Messung lesbar ist.
* **`epoch_chat_messages`** — `epoch_chat_select_anon` gibt Kanäle mit
  `channel_type = 'epoch'` für jeden anonymen Leser frei. Produktfrage (dürfen
  Zuschauende die Verhandlungen einer laufenden Epoche mitlesen?), nicht
  angefasst.
* Aus den Vorsitzungen: B16 Testversand · C2 Journal · Tagesobergrenze Mails ·
  ladungsfähige Anschrift · D1 Bureau-Druckformel · D9 Bleed-Auto-Freigabe ·
  G3 sieben März-Epochen archivieren · Persönlichkeits-Rückfüllung (0,03 USD) ·
  Datenexport existiert nicht.

---

## Fünf Lehren des Tages, die Geld gekostet haben

1. 🔑 **Eine Begründung, die für die HALBE Bedingung stimmt, sieht aus wie eine,
   die stimmt.** Migration 294 liess acht Sichten mit „die Basistabelle gewährt
   `anon` dasselbe per Richtlinie" stehen — an EINEM Tag zweimal gebrochen
   (313: galt für die Zeile, nicht für die Welt; 316: für `anon`, nicht für
   `authenticated`).
2. 🔑 **Ein Test, der nur besteht, weil ein FRÜHERER Test einen globalen Zustand
   gefüllt hat, besteht nicht.** 26 Fälle in drei Dateien. Und der Spiegel dazu:
   **ein Test, der eine Voraussetzung vorfindet statt herstellt, ist grün,
   soweit er Glück hat** (T7, 7 % Ausfall).
3. 🔑 **Ein grüner und ein roter Lauf zwei Minuten auseinander sind hier kein
   Beleg für Flackern** — es kann die andere Sitzung gewesen sein.
4. 🔑 **Der Zeitstempel ist der Schlüssel, nicht die Nummer** (313 und 314 trugen
   denselben, zum zweiten Mal an einem Tag).
5. 🔑 **Ein geprüftes Vokabular macht noch keinen deutschen Satz.** Zwölf von 42
   Übersetzungen waren Lehnübersetzungen. Drei Fragen vor jeder Zeichenkette:
   welches Element · was steht darüber und darunter · worauf antwortet der Satz.
   Danach laut lesen.
