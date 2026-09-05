# TODO-OPUS — Kostenpanel „Kontor" verdrahten

Reihenfolge dieses Dokuments ist die Reihenfolge der Fragen, nicht die des Bauens; die Bauabfolge steht in §3.

---

## 1 · Die Tokenmenge als CSS, fertig zum Einsetzen

Jede Zahl mit dem Grund, gegen den sie gemessen ist: `page / raised / sunken`. Eckige Klammer = der schwächste Grund, also der, gegen den entschieden wurde. Alle Werte im gerenderten Panel gemessen (Protokoll in `notes/messprotokoll.md`), nicht gerechnet und nicht abgeschrieben.

```css
/* ============ KONTOR · dunkler Skin (Plattform-Standard) ============ */
:root {
  color-scheme: dark;                 /* Polaritaet fuer Scrollbalken, select, Datumskalender, Autofill */

  /* Gruende — Fuellungen, ein Wert je Skin */
  --k-page:   #0a0a0a;                /* Bezug aller Werte unten */
  --k-raised: #171717;                /* auf page 1,10 */
  --k-sunken: #060606;                /* auf page 1,02 · auf raised 1,13 */

  /* Linien — Struktur, keine Textschwelle */
  --k-rule:      #333333;             /* page 1,57 · [raised 1,42] · sunken 1,60 */
  --k-rule-soft: #222222;             /* page 1,24 · [raised 1,13] · sunken 1,27 */
  --k-grid:      #1f1f1f;             /* page 1,20 · [raised 1,09] · sunken 1,23 */

  /* Text — ZWEI Werte je Farbton, hier der Wert fuer dunkle Gruende. Schwelle 4,5:1 */
  --k-ink:   #e5e5e5;                 /* page 15,72 · [raised 14,23] · sunken 16,08 */
  --k-ink-2: #a0a0a0;                 /* page  7,57 · [raised  6,86] · sunken  7,75 */
  --k-ink-3: #8a8a8a;                 /* page  5,73 · [raised  5,19] · sunken  5,87 */
  --k-ink-4: #6b6b6b;                 /* page  3,72 · [raised  3,36] · sunken  3,80
                                         NUR Zeichen (· — ░ ▸), Schwelle 3:1 nach SC 1.4.11. Kein Satz. */

  /* Traeger — nicht semantisch (Auswahl, Chrome). Bedeutung traegt ein Farbpaar, nie der Traeger. */
  --k-carrier:      #f59e0b;                                        /* Fuellung: page 9,22 · [raised 8,35] · sunken 9,43 */
  --k-carrier-ink:  #f59e0b;                                        /* Textvariante: im Dark identisch */
  --k-carrier-tint: color-mix(in srgb, #f59e0b 12%, transparent);   /* page 1,18 · raised 1,23 · sunken 1,16 */

  /* Gegenpaar — Kosten sind invertiert: steigend = schlecht. Kein Rot gegen Gruen. */
  --k-adverse-ink: #f87171;           /* teurer:   page  7,16 · [raised  6,48] · sunken  7,32 */
  --k-benign-ink:  #7dd3fc;           /* billiger: page 11,87 · [raised 10,75] · sunken 12,15 */

  /* Diagrammserien — Fuellung UND Text (Beschriftung steht IM Balken), darum 4,5:1 */
  --k-series-img: #d97706;            /* page 6,21 · [raised 5,63] · sunken 6,36 */
  --k-series-txt: #94a3b8;            /* page 7,72 · [raised 6,99] · sunken 7,90 */
  --k-forecast:   #3f3f46;            /* Farbe entzogen, absichtlich schwach: page 1,90 · [raised 1,72] · sunken 1,94 */

  /* Zwei Schraffur-Rollen. Nicht zusammenlegen — die eine wird gesehen, die andere ueberschrieben. */
  --k-hatch:    #666666;              /* Sammelbalken „ohne Angabe": page 3,45 · [raised 3,12] · sunken 3,53 */
  --k-hatch-bg: #2e2e2e;              /* Schraffur HINTER Text: page 1,46 · [raised 1,32] · sunken 1,49 */

  --k-hover:    color-mix(in srgb, #e5e5e5 4%, transparent);  /* page 1,06 · raised 1,09 — muss < 1,15 bleiben */
  --k-selected: #f59e0b;              /* kompletter 1px-Rahmen, KEIN Randstrich */
}

/* ============ ATLAS · heller Skin ============ */
[data-skin="atlas"] {
  color-scheme: light;

  --k-page:   #e9ede9;
  --k-raised: #dfe5e0;                /* auf page 1,08 */
  --k-sunken: #d5dcd6;                /* auf page 1,18 · auf raised 1,09 */

  --k-rule:      color-mix(in srgb, var(--k-ink) 42%, transparent);  /* page 2,52 · raised 2,48 · [sunken 2,44] */
  --k-rule-soft: color-mix(in srgb, var(--k-ink) 18%, transparent);  /* page 1,43 · raised 1,43 · [sunken 1,42] */
  --k-grid:      color-mix(in srgb, var(--k-ink) 14%, transparent);  /* page 1,32 · raised 1,31 · [sunken 1,31] */

  --k-ink:   #17201d;                 /* page 14,08 · raised 13,03 · [sunken 11,93] */
  --k-ink-2: #3a463f;                 /* page  8,34 · raised  7,72 · [sunken  7,07] */
  --k-ink-3: #55605b;                 /* page  5,53 · raised  5,12 · [sunken  4,68]
                                         #5f6b66 besteht auf page (4,72) und faellt auf sunken durch (3,99). */
  --k-ink-4: #6b7a72;                 /* page  3,82 · raised  3,53 · [sunken  3,23]
                                         #7c8781 faellt auf raised mit 2,91 durch — gemessen, nicht geschaetzt. */

  --k-carrier:      #d9482b;                                        /* Fuellung: page 3,61 · raised 3,34 · [sunken 3,06] */
  --k-carrier-ink:  #a3311a;                                        /* Textvariante: page 5,90 · raised 5,45 · [sunken 4,99] */
  --k-carrier-tint: color-mix(in srgb, #d9482b 10%, transparent);   /* 1,13 / 1,13 / 1,12 */

  --k-adverse-ink: #b3261e;           /* page 5,53 · raised 5,11 · [sunken 4,68] */
  --k-benign-ink:  #2f3f7a;           /* page 8,40 · raised 7,77 · [sunken 7,12] */

  --k-series-img: #a3311a;            /* page 5,90 · raised 5,45 · [sunken 4,99] — Zinnober #d9482b traegt Text nur mit 3,6 */
  --k-series-txt: #4b5f57;            /* page 5,78 · raised 5,34 · [sunken 4,89] */
  --k-forecast:   #b9c2bb;            /* page 1,54 · raised 1,43 · [sunken 1,31] */

  --k-hatch:    #6b7a72;              /* page 3,82 · raised 3,53 · [sunken 3,23] */
  --k-hatch-bg: #c2ccc4;              /* page 1,39 · raised 1,29 · [sunken 1,18] */

  --k-hover:    color-mix(in srgb, var(--k-ink) 3%, transparent);   /* 1,06 auf allen drei */
  --k-selected: #a3311a;              /* page 5,90 · raised 5,45 · [sunken 4,99] */
}
```

**Die Regel dahinter, in einem Satz:** Fuellungen brauchen einen Wert je Skin (3 : 1, eine Flaeche wird gesehen), Texte und Zeichen zwei — und sobald Schrift auf einer Flaeche steht, ist die Flaeche kein Fuellwert mehr, sondern ein Textwert (deshalb haben `--k-series-*` im Atlas eigene, dunklere Werte).

---

## 2 · Was es im Projekt schon gibt, was neu ist

Gegen `frontend/src/styles/tokens/_colors.css`. **Empfehlung: kein `--k-*`-Namensraum im Baum.** Was ein Gegenstueck hat, wird darauf abgebildet; nur die acht echten Neuen kommen als `--color-*` dazu, damit `ThemeService.THEME_TOKEN_MAP` sie mitnehmen kann.

| Entwurfs-Token | Projekt-Token | Status |
|---|---|---|
| `--k-page` | `--color-surface` (#0a0a0a) | **identisch**, nur abbilden |
| `--k-raised` | `--color-surface-raised` (#111111) | **Wertkonflikt:** der Entwurf nutzt #171717. Auf #111111 messen (dann sind ink-3/ink-4 etwas besser, nicht schlechter) oder `--color-surface-raised` global auf #171717 heben. Entscheidung bei dir, aber EINE davon — nicht zwei Wahrheiten. |
| `--k-sunken` | `--color-surface-sunken` (#060606) | identisch |
| `--k-rule` / `--k-rule-soft` | `--color-border` / `--color-border-light` | identisch |
| `--k-grid` | — | **neu** (gestrichelte Splitline; `--color-border-light` waere zu hell) |
| `--k-ink` / `--k-ink-2` | `--color-text-primary` / `--color-text-secondary` | identisch |
| `--k-ink-3` | `--color-text-muted` (#888888) | **fast**: Entwurf #8a8a8a. #888888 messen (page 5,53 · raised 5,01 · sunken 5,66) und den Entwurfswert fallen lassen. |
| `--k-ink-4` | — | **neu**, und wichtig: der Zeichenton fuer · — ░. Ohne ihn landen die Zellzustaende auf `--color-text-muted` und sind von Anmerkungen nicht zu unterscheiden. |
| `--k-carrier` | `--color-accent-amber` | identisch |
| `--k-carrier-ink` | — | **neu**: die Textvariante. Im Dark gleich, im Atlas #a3311a. Das ist der Grafana-Spalt (darkText/lightText) und der Grund, warum `--color-primary` als Textfarbe auf Papier nicht reicht (4,6 auf page, 3,9 auf sunken). |
| `--k-carrier-tint` | `--color-accent-amber-glow` (rgba .15) | **fast**: 12 % statt 15 %; `--color-primary-bg` (8 % auf surface) ist die naehere Verwandte. Eine von beiden nehmen. |
| `--k-adverse-ink` | `--color-danger` (#ef4444) | **neu als Textvariante:** #ef4444 ist als Text auf raised 4,1 — knapp drunter. #f87171 nehmen, oder `--color-danger-hover` messen. |
| `--k-benign-ink` | `--color-info` (#3b82f6) | **neu:** #3b82f6 ist auf raised 3,5. #7dd3fc nehmen. Wichtig: Blau ist hier das „gut"-Zeichen (Bloomberg-Muster), nicht `--color-success` — Rot gegen Gruen faellt in Graustufen zusammen. |
| `--k-series-img` / `--k-series-txt` / `--k-forecast` | — | **neu.** Als benannte Serienrolle, nicht als Hexwert an der Verwendungsstelle. |
| `--k-hatch` / `--k-hatch-bg` | — | **neu**, zwei Rollen, nicht zusammenlegen. |
| `--k-hover` | — | **neu** (Zeilen-Hover < 1,15 : 1; die vorhandenen `*-bg`-Tokens sind zu stark). |
| `--k-selected` | `--color-border-focus` | identisch |
| `color-scheme` | `--theme-polarity` existiert, `color-scheme` nicht | **neu und nicht ersetzbar** — siehe §6. |

Typografie kommt aus dem Bestand: `--font-brutalist` (Headings), `--font-mono` (Zahlen, IDs, Modell-Slugs), Prosa Sans/Spectral. Der Entwurf nutzt IBM Plex Mono/Sans nur als Platzhalter fuer SF Mono / Geist Mono.

---

## 3 · Bauabfolge

1. **Tokens zuerst** (§1 + §2), inklusive `color-scheme` in `ThemeService.applyConfig` und `THEME_TOKEN_MAP`. Alles danach haengt daran; wer zuerst Komponenten baut, verdrahtet Hexwerte, die wir hinterher suchen muessen.
2. **Zahlenformat als eine Funktion** — Rundung nach Groessenordnung, `tabular-nums`, U+2212, Tausendertrennung, und **die sechs Zellzustaende als Rueckgabetyp** (`{kind: 'measured'|'zero'|'estimated'|'below'|'na'|'unrecorded', text}`). Wenn das nicht zuerst steht, entstehen sie in jeder Tabelle neu und in jeder anders.
3. **Tabellen-Primitive** (Zeile 28 min-height, Polsterung 6/10, Trenner als `box-shadow: inset 0 1px`, kein Zebra, Hover < 1,15, feste Text-/Betragsspalten + eine wachsende Balkenspalte). Die Tabelle traegt vier von fuenf Ebenen.
4. **Kopfkacheln** als Selektor-Bauteil (Ist/Hochrechnung, kein Delta) mit der Kachel als Datenquelle des Diagramms — Kachel und Diagramm sind EIN Bedienelement, das gehoert in einen Zustand, nicht in zwei.
5. **Hauptdiagramm** (gestapelt nach Anbieter, gestrichelt = unvollstaendig, grau = Hochrechnung ohne Mittellinie) mit der Tabelle fest darunter.
6. **Aufschlüsselungen** (je eine Achse, Top 9 + „Sonstige" + „ohne Angabe" getrennt, Schnitt erst ab MEHR als zehn Werten) und die leeren Achsen.
7. **Achsenbruch, Matrix, Kalender-Heatmap** zuletzt — die drei brauchen die Primitive aus 2 und 3, aber niemand braucht sie.
8. **4K-Regeln** (§ Container-Query) am Ende, wenn die Zonen inhaltlich stehen.

---

## 4 · Was NICHT gebaut ist

- **§7 Sankey** (Schlüsselquelle → Anbieter → Betrag): hat heute nur einen belegten Knoten, waere eine Linie. Bewusst weggelassen.
- **§7 Perzentil-Panel**: im Auftrag ausdrücklich „eigenes Panel", nicht Teil der neun Artboards.
- **§9 Granularitätsableitung** nur als Zustand „Auflösung Monat, abgeleitet" — die vier Stufen (7 Tage → Stunde, 30 → Tag, 90 → Woche, 1 Jahr → Monat) sind nicht als Umschaltverhalten gezeigt.
- **§5 Rundungsleiter** nur teilweise belegt: `$0.000012` und `< $0.0001` erscheinen in keiner Zelle, `·` steht dort.
- **§3 Ebene 5** nur als aufgeklappte Zeile, kein eigener Einzelaufruf-Schirm.
- **Zwecke-Achse** (21 Werte) nur als Top 5 + Sammelzeile, ohne eigene Ansicht.
- **Kein Mobile, kein Tablet.** 1440 und 3840 sind gebaut; darunter ist offen.

---

## 5 · Entscheidungen, die eigentlich deine waren

1. **~~Sammelzeile bei zehn Modellen~~** — behoben: die zehnte Zeile heisst jetzt `mistral-small`, Top-N schneidet erst ab mehr als zehn Werten. Die Weltenachse (21 Werte) behaelt Top 9 + Sonstige + ohne Angabe.
2. **Vier Groessenordnungen in einer Spalte:** Spaltenbreite am laengsten Wert reserviert, rechtsbuendig, Praezision nach Groessenordnung — **die Dezimalpunkte stehen dadurch nicht untereinander**. Grafanas Weg. Die Alternative (Punkte ausgerichtet) laesst die Spalte rechts ausfransen. Umkehrbar, aber nur ganz.
3. **Ø je Aufruf hat einen Median dazubekommen** ($0.00071), weil ein Mittelwert bei zwei Populationen mit Faktor 2 500 wenig sagt. Das war im Auftrag nicht verlangt.
4. **Die sechste Kachel** ist „░ ohne Betrag · 206 von 1 646 · 12,5 %" geworden, nicht „Abdeckung Welt-Achse". Die Weltabdeckung steht jetzt nur in der Aufschlüsselung.
5. **Achsenmaximum des Hauptdiagramms auf $5.00** gesetzt, damit die Hochrechnung ($4.46 im September) hineinpasst — das dehnt die Ist-Balken optisch. Alternative: Prognose ausserhalb des Rahmens als Zahl, Band weglassen.
6. **Fünf Ausgangs-Kategorien mit Zahlen befüllt** (1 588 / 34 / 13 / 10 / 1). Die Verteilung ist plausibel, aber nicht deine Messung — bitte gegen die Tabelle prüfen.
7. **Umbruchpunkt 2200 px** für die Zwei-Zonen-Ansicht, per Container-Query (nicht Viewport). Der Wert ist gesetzt, nicht gemessen: er ist die Breite, ab der Zone A noch 1,9 : 1 traegt.
8. **Eine Reihe zu sechst** bei 3840, nicht zwei Reihen zu dritt — sechs zusammengehoerende Zahlen sollen einen Blick kosten.
9. **Die Notationsnotiz am Diagramm** (gestrichelt = unvollstaendig, grau = Hochrechnung) ist geblieben, obwohl §10 Legenden verbietet. Sie erklaert nicht, welche Serie welche Farbe hat, sondern was die Markierung bedeutet.
10. **Heatmap-Klassen** (0 · < $0.06 · < $0.16 · < $0.30 · darüber) sind gesetzt, nicht aus den Daten quantilisiert.

---

## 6 · Was beim Einbau schiefgehen kann

1. **Der Skin hat drei Gruende.** Ein Wert, der gegen `page` stimmt, kann auf `sunken` durchfallen — bei uns zweimal passiert, im Entwurf zweimal gefunden (`#5f6b66`, `#7c8781`). Bau die Pruefung als Tor, nicht als Review: jedes Textelement gegen den **tatsaechlich** darunterliegenden Grund, mit aufgeloestem Alpha-Stapel. Und pruefe das Tor mit einem absichtlich falschen Element, sonst meldet es gruen, weil es seinen Gegenstand nicht mehr findet.
2. **`color-scheme` erreicht das, was kein Token erreicht.** Scrollbalken, `<select>`, Datumskalender und Autofill zeichnet der Browser. Im Panel gibt es alle vier (Filterleiste, Zeitraum, scrollende Tabellenflaeche). `color-scheme` muss mit der Polaritaet kippen — und niemals ueber `@media (prefers-color-scheme)`: der Skin ist eine Nutzerentscheidung, das Betriebssystem hat damit nichts zu tun.
3. **ECharts rendert auf Canvas — `var()` kommt dort nicht an.** Serienfarben muessen zur Laufzeit aus `getComputedStyle(host)` gelesen und als Hex in die Option gegeben werden, **und bei jedem Skinwechsel neu** (Signal-Effect auf `platformSkin` → `setOption`, nicht nur beim Mount). Im Shadow DOM zusaetzlich: benutzerdefinierte Eigenschaften erben in den Schattenbaum, `color-mix()` loest aber gegen den **deklarierenden** Knoten auf — die abgeleiteten Tokens muessen auf dem Host neu deklariert werden (dieselbe Falle wie in `granularityPairs`).
4. **Zwei Schraffur-Rollen.** `--k-hatch` ist eine Balkenfuellung (3 : 1), `--k-hatch-bg` liegt HINTER Text (1,3 : 1). Legt man sie zusammen, wird entweder der Sammelbalken unsichtbar oder der Satz auf der Schraffur unlesbar — beides ist im Entwurf einmal passiert.
5. **`min-height`, nie `height`.** Die Zeile ist 28 hoch und wird 42, wenn die Zaehlbasis darunter steht. Die Zellzustaende muessen dabei gleich breit bleiben: alle sechs auf 140 px gemessen, Spaltenkante bei 258 px — wenn ein Zustand die Breite aendert, springt die Spalte bei jedem Datenwechsel.
6. **Umbruch ist der stille Hoehenfresser.** Zwei Zeilen Zaehlbasis statt einer haben das Panel dreimal ueber die Artboard-Hoehe geschoben. In der Produktion heisst das: `white-space: nowrap` auf Zaehlbasis und Ausgangsspalte, feste Breiten fuer Text- und Betragsspalten, und die Balkenspalte als einzige elastische.
7. **Container-Query gegen Inline-Styles.** Der Prototyp braucht `!important`, weil die Grundwerte inline stehen (Streaming-Regel des Design-Tools). In Lit mit `static styles` entfaellt das — nicht mituebernehmen.
8. **Die Kachel ist ein Selektor.** Kachel und Diagramm teilen einen Zustand. Wird die Auswahl im Diagramm gehalten und in der Kachel gespiegelt, laufen sie auseinander, sobald ein Filter greift.
9. **Farbsemantik invertiert.** Steigende Kosten sind schlecht. Es braucht den expliziten Schalter (Grafana/Datadog haben ihn), sonst ist jede Delta-Anzeige farblich falsch — und Zaehler wie „Aufrufe" duerfen **kein** Paar bekommen.
10. **Die 206 Zeilen ohne Betrag sind kein Randfall,** sondern 12,5 % der Tabelle. Wenn die Aggregation sie als 0 verbucht, sind alle Mittelwerte falsch und die Summe stimmt trotzdem — der Fehler faellt nie auf. Deshalb traegt jeder Mittelwert im Entwurf seine Zaehlbasis (`n = 512 von 640`).
