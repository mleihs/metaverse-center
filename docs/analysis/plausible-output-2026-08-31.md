# Der Fehler, der ein Ergebnis ist

**31.08.2026 · vier Sitzungen · zwanzig Fälle · eine Form**

An einem Tag haben vier Sitzungen zusammen zwanzig Fehler gefunden. Keiner davon
war ein Absturz, eine Ausnahme oder ein roter Test. **Alle zwanzig erzeugten ein
plausibles Ergebnis.**

`tsc` war grün. Die dreiundzwanzig Lint-Tore waren grün. Der Code las sich
richtig. Das ist der Grund, warum sie überhaupt lange genug überlebt haben, um
an einem Tag gemeinsam aufzufallen.

---

## Die vier Familien

### A — Das Messgerät hat einen blinden Fleck
> meldet eine **Zahl**, nicht „unbekannt"

| Fehler | Wirkung |
|---|---|
| `[a-z-]+` kannte den Unterstrich nicht | 78 Befunde statt 172 — die Tier-3-Schicht war unsichtbar |
| `color(srgb 0.4 …)` als 0–255 gelesen | 17,62 : 1 statt 4,55 |
| Luminanz teilte den 0–255-Wert durch 12,92 | Amber auf Schwarz bei 1,69 statt 9,22 |
| Grundkette nur eine Ebene tief | meldete **zu gute** Werte |
| Theme-Zuordnung geraten statt gelesen | 3 101 Befunde statt 2 511 |
| Preset-Regex ohne Anführungszeichen | 4 Themes von 10, **lautlos** |
| Import-Graph nicht verfolgt | 206 Fehlalarme, nannte reparierte Dateien krank |
| Walk am Element statt am Schattenbaum | 0 Elemente → „alles sauber" |
| `grep` auf eine Datei, die es nicht gibt | „nichts gefunden" |

### B — Eine Deklaration, die niemand liest
> sieht **verdrahtet** aus

- `ChatConversation.agent: Agent`, während die API `AgentBrief` liefert — dreißig erfundene Felder
- `voice` übergeben, deklariert, **nie gelesen**; der Unruhe-Balken existierte nie
- `?hidden` gegen eine Komponentenregel — der Knopf wäre sichtbar geblieben
- Der Kantenstreifen in zwei Hälften: Breite in der Basis, Farbe im Modifier

### C — Ein Wächter, der nicht feuern kann
> sieht **schützend** aus

- Knöpfe entsperrt, Handler behielten ihre Wächter → **aktiv und tot**
- Eine `:host`-Regel gegen eine Inline-Custom-Property → trifft nie
- `conditionDots` gibt `null`, der Aufrufer macht `?? 0` → 22 % leere Edelsteine
- `occupancyLevel` schützte den Nenner, nicht den Zähler → 219 Bauten „fast leer"

### D — Zwei Hälften, die übereinstimmen müssten
- `--immersive` gesetzt, aber die Kaskade an eine spätere Regel verloren
- `UNION` verdeckte eine doppelte Sprosse, **weil die Werte zufällig gleich waren**
- `--color-accent-amber` konstant, `--color-text-inverse` themebar → 6 von 10 Themes unlesbar

---

## Was sie tatsächlich gefunden hat

Fast nie ein Compiler, ein Tor oder ein Review.

**Fast immer ein zweiter, unabhängig bekannter Wert, mit dem das Ergebnis
übereinstimmen musste.**

- Der Luminanzfehler fiel auf, weil Amber auf Schwarz plötzlich nicht mehr 9,22 ergab — eine Zahl, die jemand unabhängig kannte.
- Der Unterstrich fiel auf, weil eine Kontrolldatei einen von Hand gerechneten Wert trug.
- Die fehlenden sechs Themes fielen auf, weil jemand wusste, dass es zehn sind.
- Die 206 Fehlalarme fielen auf, weil eine andere Sitzung sagte: „meine Dateien sind repariert."

> Ohne den zweiten bekannten Wert hätte keiner dieser Fehler sich gemeldet.
> Er hätte weiter Zahlen geliefert.

---

## Die Konsequenz

Dieses Wissen lag in **Personen**. Solange es dort liegt, ist es nicht
übertragbar, nicht prüfbar und beim nächsten Context-Clear weg.

**Also gehört es in Dateien und muss bei jedem Lauf geprüft werden.**

    frontend/scripts/fixtures/contrast-controls.ts
    python3 scripts/measure-contrast-pairs.py --self-check   (läuft in lint:full, bricht den Build)

Sechs Kontrollen: drei mit von Hand gerechnetem Verhältnis, **zwei, die stumm
bleiben müssen** (ein Werkzeug, das alles meldet, ist so unbrauchbar wie eines,
das nichts meldet), und eine, die den **Weg** prüft und nicht nur die Zahl —
ein Werkzeug, das über den falschen Weg zur richtigen Zahl kommt, hat recht aus
Versehen.

### Die Probe hat sich sofort selbst gerechtfertigt

Binnen Minuten nach ihrer Entstehung fand sie zwei Fehler im eigenen Werkzeug
(Kommentare erst nach dem Zerlegen entfernt; `lint-color-ok:` als Deklaration
gelesen) und deckte einen dritten auf: **66 `:host`-Blöcke standen hinter einem
Kommentar und wurden für Tier-3-Token nie gelesen.**

Ein Kommentar — das, was man schreibt, um Code klarer zu machen — hatte eine
Messung blind gemacht. Und sie meldete „nicht messbar", was wie Ehrlichkeit
aussieht.

---

## Die Kostenasymmetrie

Ein Werkzeug, das **zu wenig** meldet, kostet eine Runde.

Ein Werkzeug, das **zu viel** meldet, kostet das Vertrauen in jede andere Zeile
seiner Liste — und in die Tore daneben. Es verdeckte hier eine echte Lücke, die
erst nach dem Aussortieren der 206 Fehlalarme sichtbar wurde.

Daraus folgen zwei Regeln, die an diesem Tag mehrfach getragen haben:

1. **Ein ungemessenes Paar darf weder wie ein bestandenes noch wie ein
   durchgefallenes aussehen.** „Nicht messbar" ist eine eigene Zeile.
2. **Ein Tor, das rot ist für Arbeit, in die niemand eingewilligt hat, bringt
   alle dazu, es zu übergehen.** Erst die Zahl, dann die Entscheidung, zuletzt
   der Exit-Code.

---

## Der Satz

> **Ein Messgerät, das eine Klasse von Fällen nicht sieht, meldet nicht
> „unbekannt", sondern eine Zahl — und eine Zahl sieht aus wie ein Ergebnis.**

Verwandte Sätze desselben Tages, von den anderen Sitzungen:

- *Ein selbst geschriebener Typ prüft nichts, er behauptet.*
- *Eine Klasse, die gesetzt wird, ist keine Klasse, die wirkt.*
- *Ein Mechanismus, der nur im gleichen Fall benutzt wird, in dem er nichts tut, ist nicht erprobt, sondern unberührt.*
- *Ausgegraut war ehrlich.*
- *Ein Tor, dessen Ergebnis niemand auswertet, ist kein Tor.*
