# DESIGN-AUTORITAET — Kostenpanel „Kontor"

Wer entscheidet, wenn `velg-frontend-design` (Tokens, Lint-Tore, i18n, WCAG) und dieser Entwurf sich widersprechen. **Grundregel: das Projektregelwerk gewinnt, ausser die Regel wuerde eine Aussage der Daten zerstoeren.** Unten die Stellen, an denen sie sich wirklich beruehren — mit Entscheidung, nicht mit Abwaegung.

| # | Stelle | Regelwerk sagt | Entwurf sagt | Autoritaet |
|---|---|---|---|---|
| 1 | Namensraum | 3-Tier `--color-*`, keine zweite Wahrheit | `--k-*` | **Projekt.** `--k-*` ist Entwurfssprache, im Baum nur Abbildung (TODO §2). Acht echte Neue kommen als `--color-*` dazu. |
| 2 | Hexwerte | Komponenten nie roh | Tokendatei enthaelt Hex | **Projekt.** Hex nur in der Definitionsschicht, nie an der Verwendungsstelle. Gilt auch fuer Diagrammserien. |
| 3 | Styles | Lit `static styles` | alles inline | **Projekt.** Inline ist eine Bedingung des Entwurfswerkzeugs (Streaming), keine Designaussage. |
| 4 | `!important` | verboten/verpoent | Container-Query braucht es | **Projekt.** Faellt in Lit weg, weil die Grundwerte dort nicht inline stehen. Nicht mituebernehmen. |
| 5 | **Em-Dash-Verbot** | keine Em-Dashes in `msg()`, En-Dash verwenden | `—` ist ein **Zellzustand** („nicht anwendbar") | **Entwurf, mit Ausnahme.** Der Geviertstrich ist hier Notation, nicht Interpunktion. Er darf nicht durch den En-Dash-Sweep laufen und gehoert **nicht** in `msg()`, sondern als Symbolkonstante (`CELL_NA = '\u2014'`) neben `·` (U+00B7), `░` (U+2591) und `−` (U+2212, das Minuszeichen). Wenn diese vier durch die i18n-Pipeline gehen, sind die Zellzustaende beim ersten Locale-Wechsel kaputt. |
| 6 | i18n | jeder User-String ueber `msg()` | Zahlen sind kein User-String | **Entwurf.** Betraege, Zaehler, Datum/Uhrzeit werden mit **einem festen Formatierer** gesetzt (Punkt als Dezimaltrenner, Komma als Tausendertrenner, `$` vorangestellt), unabhaengig von der UI-Sprache. Locale-abhaengige Trenner tauschen Zeichenbreiten und zerstoeren `tabular-nums`-Spalten. Uebersetzt werden Labels, nicht Ziffern. |
| 7 | WCAG AA | 4,5 : 1 fuer Text | `--k-ink-4` hat 3,36 / 3,23 | **Beide, getrennt.** Die vier Glyphen sind bedeutungstragende Nicht-Text-Elemente → SC 1.4.11, Schwelle 3 : 1, gemessen darueber. Braucht im Lint-Tor eine **benannte Ausnahmeliste** (nur `--k-ink-4` und nur fuer `· — ░ ▸`), nicht eine global gesenkte Schwelle. |
| 8 | Icons nur aus `utils/icons.ts` | ja | `▲ ▼ ▸ ▾ ░ ⚑` | **Projekt fuer ▲▼▸▾** (als Icons nachziehen oder als Konstanten deklarieren), **Entwurf fuer ░ und ⚑** — dafuer gibt es kein Icon, und ░ muss dieselbe Zeichenbreite wie die Betraege haben. Also Mono-Glyphe, kein SVG. |
| 9 | Amber ist `--color-warning` (semantisch) | ja | Amber ist **Traegerfarbe**, Bedeutung traegt ein Paar | **Entwurf fuer dieses Panel.** Steigende Kosten sind nicht „Warnung", sie sind das Normalgeschaeft. Risiko: geteilte Bauteile (Badge, Chip), die Warning-Amber importieren — im Panel keine Warning-Variante verwenden. |
| 10 | Simulations-Themes ueberschreiben Tokens pro Welt | ja | Das Panel folgt **nur** dem Plattform-Skin | **Kanon.** Das Kostenpanel steht im Admin, oberhalb der Welten. Es darf nie auf einem welt-gethemten Wirt haengen; sonst faerbt eine Simulation die Betriebszahlen. |
| 11 | Hover-Vokabular (`--hover-transform`, lift) | ja | Zeilen-Hover < 1,15 : 1, **kein** Versatz | **Entwurf.** Eine Tabellenzeile, die sich hebt, verschiebt die Zahlenspalten. Knoepfe duerfen weiter liften. |
| 12 | `color-scheme` | kein Token vorhanden | muss mit der Polaritaet kippen | **Projekt muss erweitern** (`ThemeService`, `THEME_TOKEN_MAP`). Kein Designentscheid, eine Luecke. |
| 13 | Auswahlzustand | 1px-Umriss + Toenung, kein Kantenstreifen | dasselbe | **Einig** — und der Tint ist der vierte Grund (TODO §6.0). |

**Wenn eine Stelle nicht in dieser Tabelle steht, gilt das Regelwerk.** Wenn du beim Bauen eine vierzehnte findest, entscheide zugunsten des Regelwerks und schreib sie in `BILANZ.md` — ich habe hier nur die Stellen erfasst, die mir beim Entwerfen begegnet sind.
