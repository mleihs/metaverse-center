# AUFTRAG

SUPER GRÜNDLICHE Web-Recherche zum HANDWERK dichter Daten-Interfaces. Antworte auf Deutsch.

Ziel: ein Kostenpanel auf höchstem Interface-Niveau bauen — dunkel, brutalistisch, Schreibmaschinensatz, sehr fein granuliert. Ich will die Regeln kennen, nach denen die besten dichten Interfaces gebaut sind.

Untersuche gründlich:

**1. Typografie für Zahlen**
- `font-variant-numeric: tabular-nums` — warum es in Tabellen Pflicht ist, welche Schriften es können
- Ausrichtung von Zahlen (rechtsbündig, Dezimaltrennzeichen-Ausrichtung), `text-align: right` vs. `char`
- Wie viele signifikante Stellen bei Geldbeträgen unter 1 Dollar? Wie zeigt man 0,003 USD sinnvoll?
- Monospace vs. proportionale Schrift mit Tabellenziffern — was benutzen Stripe, Linear, Vercel wirklich?

**2. Informationsdichte**
- Edward Tufte: data-ink ratio, small multiples, sparklines, "chartjunk" — was davon hält 2026 noch, was ist widerlegt?
- Zeilenhöhen, Spaltenabstände in dichten Tabellen; ab wann kippt Dichte in Unlesbarkeit
- Wie machen Bloomberg-Terminal, Linear, Height, Superhuman, Retool Dichte lesbar?

**3. Kleine Diagramme in Tabellen**
- Sparklines: wann sinnvoll, wie groß, mit/ohne Achse
- Balken IN Tabellenzellen (bar-in-cell), Heatmap-Zellen
- Wann ein Diagramm schlechter ist als eine Zahl

**4. Dunkle Oberflächen**
- Kontrastanforderungen (WCAG AA) auf sehr dunklem Grund; warum reines Weiß auf reinem Schwarz schlecht ist
- Wie man auf dunklem Grund Flächen abstuft, ohne Farbe zu verlieren
- Akzentfarb

---

Alle Recherchestränge sind ausgewertet. Hier der Bericht.

---

# Das Handwerk dichter Daten-Interfaces

Vier parallele Recherchen plus eigene Messungen. Wo ich Zahlen nenne, steht dabei, woher sie kommen: **[Q]** = aus Quellcode/ausgeliefertem CSS belegt, **[D]** = offizielle Doku, **[S]** = Studie im Volltext geprüft, **[M]** = von mir selbst gemessen (fontTools, offizielle APCA-Implementierung, WCAG-Luminanzformel), **[?]** = nicht belastbar.

Suchmaschinen waren nach 200 Abfragen gesperrt; die Recherche lief danach über direkte Quellen. Für Design-Tokens ist das ohnehin die bessere Quelle: ausgeliefertes CSS lügt nicht.

---

## 1. Typografie für Zahlen

### Warum `tabular-nums` in Tabellen Pflicht ist – gemessen, nicht behauptet

Butterick formuliert es am schärfsten: *"tabular figures are essential for one purpose: vertically aligned columns, like you find in grids of numbers."* ([practicaltypography.com/alternate-figures.html](https://practicaltypography.com/alternate-figures.html)) **[D]**

Was das kostet, habe ich an den Fontdateien selbst gemessen **[M]**:

| Schrift | Ziffernbreiten (Standard) | Spanne | Drift über 7 Ziffern @ 13px |
|---|---|---|---|
| Geist Sans | 384–663 / 1000 em (`1` vs `0`) | 0,279 em | **25,4 px** |
| Inter (offiziell) | 833–1323 / 2048 em | 0,239 em | 21,7 px |
| SF Pro (= `system-ui` auf macOS) | 908–1264 / 2048 em | 0,174 em | **15,8 px** |
| Geist Sans **mit** `tnum` | alle 600 / 1000 em | 0 | 0 |

Zwei Zeilen mit `1.111.111` und `8.888.888` laufen in Geist Sans um 25 px auseinander. Das ist keine Kosmetik, das ist eine unlesbare Spalte.

**Der Fund, der die Schriftwahl entscheidet [M]:** Geist Mono hat `advance = 600/1000 em` für alle Ziffern – **exakt dieselbe Breite wie Geist Sans mit `tnum`**. Text in der Sans und Zahl in der Mono richten sich in derselben Spalte aus. Vercel hat das im Typo-System explizit gebaut: jede `text-label-*`- und `text-copy-*`-Stufe hat eine **Mono-Zwillingsstufe mit identischer Zeilenhöhe** (`text-label-12` = 12/16, `text-label-12-mono` = 12/16) **[Q]**.

Monospace-Schriften brauchen `tabular-nums` gar nicht – ihre Ziffern sind per Definition gleich breit **[M]**: JetBrains Mono, IBM Plex Mono, Geist Mono alle 600/1000 em, Space Mono 612. `font-variant-numeric` ist dort ein No-op.

### Die Falle bei Webfont-Subsets [M]

| Bezugsquelle | `tnum` | `zero` (geschlitzte Null) |
|---|---|---|
| Inter, offiziell (rsms.me) | ✓ | **✓** |
| Inter über Google Fonts | ✓ | **✗** |
| Inter über Fontsource | ✓ | **✗** |

Linear setzt `font-variant-numeric: lining-nums tabular-nums slashed-zero !important` und `font-feature-settings: "zero"` **[Q]** – das funktioniert nur, weil sie das vollständige Inter selbst ausliefern. Über Google Fonts wäre die Deklaration wirkungslos, ohne Fehlermeldung.

### Ausrichtung: rechtsbündig, und `text-align: char` gibt es nicht

CSS Text Level 4 spezifiziert Zeichenausrichtung mit `TD { text-align: "." center }`, Abschnitt 7.2 – und schreibt selbst dazu: *"This section lacks tests"*, samt offener Redaktionsfragen ([drafts.csswg.org/css-text-4](https://drafts.csswg.org/css-text-4/#text-align-property)) **[D]**. Die MDN-Kompatibilitätsdaten führen **keinen einzigen `<string>`-Eintrag** für `text-align` **[M]**, geprüft an `mdn/browser-compat-data`. Es gibt also keine Dezimalausrichtung per CSS.

Der Ersatz ist Konstruktion statt Deklaration. Sentrys Produktionscode ist die kanonische Form ([`static/app/utils/discover/styles.tsx`](https://github.com/getsentry/sentry/blob/master/static/app/utils/discover/styles.tsx)) **[Q]**:

```css
/* NumberContainer */
text-align: right;
font-variant-numeric: tabular-nums;
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
```

Dieselbe Regel steht auch auf ihrem `FieldDateTime` – **Datumsangaben sind Zahlenkolonnen**. Grafana leitet die Ausrichtung automatisch ab: `field.type === FieldType.number → 'right'`, alles andere `'left'` ([`TableNG/utils.ts`, `getAlignment`](https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/Table/TableNG/utils.ts)) **[Q]**. Pencil & Paper formuliert die Ausnahme: qualitative Zahlen (Datum, PLZ, Telefonnummer) bleiben linksbündig, Zentrierung ist immer falsch ([pencilandpaper.io](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables)) **[D]**.

Ein Detail, das eine Vorzeichenspalte zerstört **[M]**: In Geist Sans ist `+` 558/1000 em breit, `−` (U+2212) 520, `-` (Bindestrich U+002D) nur 419. Bindestrich gegen Plus sind 1,8 px Versatz bei 13 px. Für Zahlenkolonnen U+2212 nehmen, nicht den Bindestrich – oder das Vorzeichen in eine eigene, festbreite Zelle setzen.

### Signifikante Stellen unter einem Dollar – hier ist die beste Quelle Produktionscode

Die maßgebliche Regel steht in PostHogs [`frontend/src/lib/utils/numbers.ts`](https://github.com/PostHog/posthog/blob/master/frontend/src/lib/utils/numbers.ts) **[Q]**, Funktion `significantDecimalPlaces`:

```
Math.min(Math.max(floor, 1 - Math.floor(Math.log10(Math.abs(value)))), 10)
```

mit `floor = 2`. Das ist „immer zwei signifikante Stellen, mindestens zwei Nachkommastellen, höchstens zehn". Der Kommentar im Code nennt die Begründung: *"A flat two decimals renders a series of small values as a run of identical '0.01' / '0' labels."*

Ausgerechnet **[M]**:

| Wert | Stellen | Anzeige |
|---|---|---|
| 1234,5 | 2 | `1234.50` |
| 0,12 | 2 | `0.12` |
| **0,003** | **4** | **`0.0030`** |
| 0,00042 | 5 | `0.00042` |
| 0,0000071 | 7 | `0.0000071` |

**0,003 USD wird also als `$0.0030` gezeigt** – zwei signifikante Stellen, nicht mehr. Der Preis dafür: die Spaltenbreite schwankt. Deshalb gehört zur Regel zwingend `tabular-nums` plus eine feste Spaltenbreite, bemessen am längsten vorkommenden Wert.

Genau dafür hat Grafana ein benanntes Verfahren, `getAlignmentFactor` **[Q]**: Es schaut **bis zu 1000 Zeilen voraus**, sucht den längsten formatierten Wert und reserviert dessen Breite. Das ist der sauberste Weg, adaptive Präzision und ruhige Spaltenkanten zu vereinen.

Die Alternative aus der Praxis der Modellanbieter ist, **die Einheit zu skalieren statt Nachkommastellen anzuhängen**: OpenAI zeigt `$10.00` und `$0.05` – *pro 1 Mio. Token*, und geht nur dort auf vier Stellen (`$0.0045 / minute`), wo die Einheit nicht skalierbar ist ([developers.openai.com/api/docs/pricing](https://developers.openai.com/api/docs/pricing)) **[D]**. Railway gibt Kosten doppelt an: `$10 / GB / Monat` **und** `$0.000231 / GB / Minute` ([docs.railway.com/reference/pricing](https://docs.railway.com/reference/pricing)) **[D]**.

Zum Vergleich, wo die Obergrenze der Branche liegt: Stripes `unit_amount_decimal` ist *"a decimal string with at most 12 decimal places"* ([docs.stripe.com/api/prices/object](https://docs.stripe.com/api/prices/object)) **[D]** – aber das ist Speicherung, nicht Anzeige. `Intl.NumberFormat` mit `style: 'currency'` liefert per Voreinstellung genau die ISO-4217-Minor-Units, also 2 ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat)) **[D]**.

### Monospace oder proportional? Was die Vorbilder wirklich tun

| Produkt | Sans | Mono | Zahlen |
|---|---|---|---|
| **Linear** | Inter Variable | **Berkeley Mono** (Kauflizenz) | Inter + `tabular-nums` + `slashed-zero`, global **[Q]** |
| **Stripe Dashboard** | **System-Stack**, kein Webfont | Menlo/Consolas | System-Schrift + `tnum` als **Opt-in-Klasse** `.Text-numericSpacing--tabular`; genau 2 Fundstellen in 7,3 MB CSS **[Q]** |
| **Vercel** | Geist Sans | Geist Mono | `tabular-nums` nur als Utility, kein Standard **[Q]** |
| **Grafana** | Inter | Roboto Mono | `tabular-nums` punktuell (5 Dateien) **[Q]** |
| **Sentry** | Rubik | Roboto Mono (Gewicht **425**) | `tabular-nums` in 47 Dateien: `fileSize`, `duration`, `discover/styles`, `performance/styles` **[Q]** |
| **PostHog** | Inter/RoundHog | ui-monospace | `tabular-nums` in 281 Dateien, u. a. `LLMCostsView.tsx` **[Q]** |

**Kein einziges dieser Produkte setzt Geldbeträge in Monospace.** Alle nehmen die Textschrift mit Tabellenziffern. Monospace ist bei ihnen für Code, IDs und Logs reserviert.

Das ist kein Argument gegen einen Schreibmaschinensatz – aber es heißt: wer Monospace für Beträge wählt, tut das als **gestalterische Setzung**, nicht weil es die Lesbarkeit verlangt.

### Wenn es Schreibmaschine sein soll: Courier New ist die falsche Wahl

Ihr Projekt deklariert `--font-brutalist: 'Courier New', 'Monaco', 'Lucida Console', monospace` (`frontend/src/styles/tokens/_typography.css:5`). Courier New steht an erster Stelle und ist auf jedem Mac und jedem Windows vorhanden – sie bekommen also praktisch immer Courier New. Gemessen **[M]**:

| Schrift | Versalhöhe | x-Höhe | Versalhöhe @ 12px | markierte Null? |
|---|---|---|---|---|
| **Courier New** | 0,571 em | 0,423 em | **6,86 px** | **nein – leere Null** |
| Menlo | 0,729 em | 0,547 em | 8,75 px | ja |
| SF Mono | 0,705 em | 0,526 em | 8,46 px | ja |
| Monaco | 0,758 em | 0,545 em | 9,09 px | ja |
| JetBrains Mono | 0,730 em | 0,550 em | 8,76 px | ja |

Courier New bräuchte **15,3 px**, um Menlos optische Größe bei 12 px zu erreichen. Und die `0` hat nur zwei Konturen – keinen Schlitz, keinen Punkt. In einer Kostenspalte mit `0.0000071` ist das die schlechtestmögliche Wahl.

---

## 2. Informationsdichte

### Tufte, empirisch nachgeprüft

Ich habe Bateman et al., *"Useful Junk? The Effects of Visual Embellishment on Comprehension and Memorability of Charts"* (CHI 2010) im Volltext gelesen ([PDF](http://www.stat.columbia.edu/~gelman/communication/Bateman2010.pdf)) **[S]**.

Aufbau: 20 Teilnehmende (9 m / 11 w, 18–40), 14 Diagramme je in Holmes-Version (stark bebildert) und schlichter Version, 24-Zoll-Monitor, Tobii-Eyetracker, je zehn Personen in der Sofort- bzw. der Langzeitgruppe (2–3 Wochen).

Die fünf Befunde wörtlich:
- *"There was no significant difference between plain and image charts for interactive interpretation accuracy."*
- *"There was also no significant difference in recall accuracy after a five-minute gap."*
- *"After a long-term gap (2-3 weeks), recall of both the chart topic and the details (categories and trend) was significantly better for Holmes charts."*
- Wertaussagen wurden in den Holmes-Diagrammen signifikant häufiger erkannt.
- Die Teilnehmenden fanden sie attraktiver und leichter zu merken.

**Was das für ein Kostenpanel bedeutet, ist aber das Gegenteil dessen, was meist daraus gemacht wird.** Bateman selbst schreiben: *"we do not advocate this strategy as a general principle."* Der Befund gilt für Präsentationsgrafik und Erinnerbarkeit nach Wochen – nicht für ein Panel, das täglich gescannt wird und wo die relevante Größe die Zeit bis zur Antwort ist.

Für genau diesen Fall zitiert dieselbe Arbeit **Gillan & Richman [S]**: *"high data-ink ratios were correlated positively with faster response times and greater accuracy, although further investigation demonstrated that varying the particular location and function of the additional ink changed results. For example, background images made interpretation harder, but lines for X and Y axes improved response time."*

Das ist die belastbare Fassung der Regel: **Hintergrundbilder schaden, Achsenlinien helfen. Eine Achse ist kein Chartjunk.** Tuftes Prinzip hält „within reason" – und die Grenze verläuft zwischen Dekoration und Bezugssystem, nicht bei „so wenig Tinte wie möglich".

Weitere Gegenstimmen, die Bateman referiert **[S]**: Kulla-Mader fand keine Unterschiede zwischen drei Data-Ink-Verhältnissen; Inbar et al. fanden, dass Nutzer nicht-minimalistische Grafiken **bevorzugen**. Borkin et al. 2013 konnte ich **nicht im Volltext beschaffen** – fünf Hosts probiert, alle 404/403. Ich zitiere daraus keine Zahlen. **[?]**

### Zeilenhöhen: die Zahlen aller relevanten Systeme

Alles aus Quellcode oder offizieller Doku **[Q]/[D]**:

| System | Dichtestufen (Zeilenhöhe px) | Basisschrift |
|---|---|---|
| **Carbon (IBM)** | **xs 24** · sm 32 · md 40 · lg 48 · xl 64 | 14 px; bei xs nur **2 px** Innenabstand oben/unten |
| **Linear** | **24 · 28** dominieren (53× bzw. 31× im CSS), Kopfzeile 44 | 13 px (`--font-size-small`) |
| **Stripe Dashboard** | **36** (`min-height: 20px; margin: 8px`) · small **24** (`16px + 4px`) | 13–14 px, Kopfzelle **11 px** |
| **Grafana** | Standard **34** (`CELL_PADDING 6 × 2 + 14 × 1,571`) · Sm 36 · Md 42 · Lg 48; `HEADER_HEIGHT 34` | 14 px, `bodySmall` 12 px / 1,5 |
| **Ant Design** | `cellPaddingBlock` small 8 · middle 12 · large 16 | 14 px |
| **Pencil & Paper** | condensed 40 · regular 48 · relaxed 56 | – |

Carbon-Belege: [`_data-table.scss`](https://github.com/carbon-design-system/carbon/blob/main/packages/styles/scss/components/data-table/_data-table.scss), Zeilen 627–751. Grafana: [`TableNG/constants.ts`](https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/Table/TableNG/constants.ts) – `CELL_PADDING: 6`, `LINE_HEIGHT: 22`, `MAX_CELL_HEIGHT: 48`, `HEADER_HEIGHT: 34`, `COLUMN.DEFAULT_WIDTH: 150`, `MIN_WIDTH: 50`, `MAX_AUTO_WIDTH: 400`.

**24 px ist der Boden, und zwar vierfach unabhängig belegt**: Carbon xs, Linear-Listenzeile, Stripe `--size--small` – und WCAG 2.2 SC 2.5.8 verlangt *"at least 24 by 24 CSS pixels"* für Zeigerziele ([w3.org](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)) **[D]**. Eine anklickbare Zeile unter 24 px ist ein Zugänglichkeitsfehler.

### Wo Dichte in Unlesbarkeit kippt

Die harte Grenze ist nicht ästhetisch, sie steht in WCAG 2.2 SC 1.4.12 **[D]** ([w3.org](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html)): Der Nutzer darf `line-height: 1.5`, `letter-spacing: 0.12em`, `word-spacing: 0.16em` erzwingen, und dabei darf *"no loss of content or functionality"* eintreten.

Ausgerechnet **[M]**:

| Satz | Entwurfshöhe (lh 1,33) | unter 1.4.12 (lh 1,5) |
|---|---|---|
| 11 px / 4 px Polster | 22,6 px | 24,5 px |
| 12 px / 4 px | **24,0 px** | **26,0 px** |
| 12 px / 6 px | 28,0 px | 30,0 px |
| 14 px / 6 px (Grafana) | 30,6 px | 33,0 px |

Eine feste `height: 24px` mit 12-px-Text **beschneidet** unter 1.4.12. Deshalb ist Stripes Konstruktion die richtige: `min-height: 20px; margin: 8px` statt `height` **[Q]**. Die Zeile darf wachsen.

SC 1.4.8 (AAA) nennt zusätzlich **maximal 80 Zeichen pro Zeile** und Blocksatzverbot ([w3.org](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html)) **[D]** – relevant für die Beschriftungsspalte, nicht für Zahlen.

Die kleinste Schriftgröße, die die untersuchten Systeme für Daten einsetzen, ist **11 px** (Sentry `font.size.xs`, Stripe Dashboard-Kopfzelle) **[Q]**. Linear hat eine 10-px-Stufe (`--text-tiny`), aber mit `line-height: 1.5` und nur für Randfälle. Ihr `--text-xs: 0.64rem` = **10,24 px** liegt darunter.

### Was diese Interfaces lesbar hält

Aus dem ausgelieferten CSS, nicht aus Blogposts **[Q]**:

**Linear** staffelt Hover nach Elementgewicht – und das ist der klügste Einzelbefund der ganzen Recherche:

| Element | Hover-Fläche | Kontrastsprung **[M]** |
|---|---|---|
| Inbox-Zeile | `#ffffff04` (1,6 %) | **1,024:1** |
| Navigationseintrag | `#ffffff05` (2 %) | 1,031:1 |
| Icon-Button, Pill | `#ffffff0d` (5 %) | 1,099:1 |

Bei 50 sichtbaren Zeilen wäre 5 % ein Blitzen. Grafana liegt mit `background.secondary` bei **1,125:1**, Stripe (hell) bei 1,048:1. **Alle unter 1,15:1.** Dazu: Linear kapselt jeden Hover in `@media (any-hover: hover)` und animiert eine `::after`-Opazität statt der Hintergrundfarbe, 160 ms.

**Linears Schriftgewichte sind 510 / 590 / 680**, nicht 500/600/700 – jemand ist die Variable-Font-Achse abgefahren, bis es optisch stimmte. Und die Laufweite ist größenabhängig und wird bei 12 px auf **0** zurückgenommen (`--text-micro`), negativ nur oberhalb. Zeilenhöhen sind als `calc(21 / 14)` notiert, damit die Pixelabsicht lesbar bleibt.

**Stripes stärkster Kniff:** Zeilentrenner sind `box-shadow: inset 0 1px`, keine `border` **[Q]**. Ein Innenschatten belegt keinen Platz im Box-Modell – die Zeilenhöhe bleibt exakt 36 px, egal ob eine Linie da ist. Kein `border-collapse`, keine doppelten Linien an Gruppengrenzen, keine 1-px-Sprünge bei Sticky-Headern.

**Vercel** koppelt Rahmen und Schatten in **einem** Token: jeder `--ds-shadow-*` beginnt mit `0 0 0 1px` und endet mit einem zweiten Rahmen in der Hintergrundfarbe **[Q]**. Damit ist es unmöglich, ein Panel mit Erhebung aber ohne Kante zu bauen. Die Doku benennt das Anti-Muster explizit: *"Über-Elevation ist eine häufige Quelle visuellen Lärms"* ([vercel.com/geist/materials](https://vercel.com/geist/materials)) **[D]**.

**Bloomberg, Height, Superhuman, Retool:** Hier ist die Beleglage schlecht. Bloomberg liefert kein öffentliches Design-System, die Produktseite gibt HTTP 403, und die kursierenden Aussagen über Bernstein-auf-Schwarz und Tastaturführung ließen sich in keiner Primärquelle verifizieren. Ich nenne dazu **keine Zahlen**. **[?]**

---

## 3. Kleine Diagramme in Tabellen

### Sparklines: Tufte nennt keine Pixel

Aus [Tuftes eigenem Thread](https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/) **[D]**: *"A sparkline is a small intense, simple, word-sized graphic with typographic resolution."* Seine Maße sind typografisch – **14 Letterspaces** Breite für eine Finanz-Sparkline, Seitenverhältnis **5:1** (Finanz), 20:1 (Baseball), 300:1 (DNA). **Jede Pixelzahl, die ihm zugeschrieben wird, ist eine Interpretation Dritter.**

Zu Achsen: *"Avoid all data frames; the physical location of the numbers, words, and graphics enforces the implicit grid."* Aber Endpunktmarker ja (roter Punkt **plus** die Zahl daneben, farblich verbunden), Min/Max-Marker in einer zweiten Farbe, Normalbereich als grauer Balken.

### Die einzige harte Zahl kommt aus der Forschung

Heer, Kong, Agrawala, *"Sizing the Horizon"* (CHI 2009), [PDF](http://vis.stanford.edu/files/2009-TimeSeries-CHI.pdf) **[S]**. 30 Teilnehmende, Charts 500 px breit, Höhen 48 / 24 / 12 / 6 px, Nachfolgeversuch bis 2 px.

> *"for both normal line charts and 1-band mirror charts, we found a chart height of **24 pixels (6.8 mm)** to be optimal."*
> *"For 2-band line charts, we found optima at **12 and 6 pixels**."*
> *"We **discourage the use of 4 or more bands**."*

Die Zahlen dahinter: Fehler stabil bis 24 px, darunter **linear fallend mit −4,1 Einheiten je Halbierung** (R² = 0,986). 24 px war **1,1 s schneller** als 48 px bei unter 2 Einheiten Fehlerzuwachs – also ein reiner Gewinn. Und: Diskriminierung („welcher Wert ist größer?") blieb **selbst bei 2 px über 96 % korrekt**. Das Auge liest Richtung und Extrema aus winzigen Formen zuverlässig, absolute Höhen nicht.

Drei unabhängige Quellen landen im selben Fenster: Heers 24 px, Excels Standardzeilenhöhe von 15 pt ≈ 20 px **[D]**, und jQuery Sparklines' Voreinstellung `height: 'auto'`, die im Quelltext buchstäblich die **Zeilenhöhe eines Buchstabens „a"** misst (Zeilen 963–966) **[Q]**. Weitere jQuery-Defaults: `defaultPixelsPerValue: 3`, `lineWidth: 1`, `spotRadius: 1.5`, `barWidth: 4 / barSpacing: 1`.

Grafanas Sparkline-Zelle in Produktion **[Q]** ([`TableNG/Cells/SparklineCell.tsx`](https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/Table/TableNG/Cells/SparklineCell.tsx)): `height: 25`, `lineWidth: 1`, `fillOpacity: 17`, `showPoints: Never` – **und daneben die Zahl**, deren Spaltenbreite über `getAlignmentFactor` gelockt wird. Die Sparkline bekommt `width - valueWidth`. Das ist Tuftes „Grafik plus Zahl" als Code.

Zum Seitenverhältnis: Clevelands „banking to 45°" ist **widerlegt**. Talbot, Gerth, Hanrahan (InfoVis 2012, [PDF](http://vis.stanford.edu/files/2012-SlopeComparison-InfoVis.pdf)) **[S]**: *"slope ratio estimation accuracy is not, in general, minimized at 45°"*; Clevelands Modell erzeuge *"a false minimum at 45°"*. Der brauchbare Ersatzbefund: **eine sichtbare Grundlinie** *"nearly eliminates the judgment error for mid-angles less than 45°"* und erlaubt dadurch ausdrücklich flachere Seitenverhältnisse. Für eine Zelle heißt das: keine Rahmen, aber eine Nulllinie.

### Balken in Zellen: das Nullpunktproblem steht in der Spezifikation

ISO/IEC 29500, zitiert bei [learn.microsoft.com](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.databar) **[D]**:

> *"Data bar length = minLength + (cell value − minimum value in the range) / (maximum value in the range − minimum value in the range) × (maxLength − minLength), where min and max length are a fixed percentage of the column width (by default, 10 % and 90 %)."*

Die Formel normalisiert auf `[min, max]`, **nicht auf Null**. Der kleinste Wert bekommt 10 % Länge, der größte 90 % – ob die Werte 1 und 500 sind oder 499 und 500. **Balkenlänge ist dann kein Verhältnis mehr.** Ehrlich wird ein Balken erst mit Minimum = 0 **und** `PercentMin = 0`. (Microsofts eigene Doku widerspricht sich hier: OOXML nennt 10/90, die VBA-Referenz 0/100. Nicht auflösbar ohne Messung.)

### Heatmap-Zellen: kleine Flächen brauchen sattere Farben

Stone, Szafir, Setlur (CIC 2014, [PDF](https://graphics.cs.wisc.edu/Papers/2014/SAS14/2014CIC_48_Stone_v3.pdf)) **[S]**: *"small shapes need to be much more colorful to be usefully distinct."* Gemessene ND(50 %) in ΔE:

| Achse | 0,333° | 2° |
|---|---|---|
| L* (Helligkeit) | 7,32 | 5,01 |
| a* | 9,90 | 5,92 |
| b* (Gelb-Blau) | **14,84** | 5,83 |

**Auf kleinen Flächen ist Helligkeit der robusteste Kanal, Gelb-Blau der fragilste** – b* degradiert fast dreimal so stark wie L*.

Szafir (IEEE VIS 2017, [PDF](http://danielleszafir.com/colordiff_vis2017.pdf), 461 Teilnehmende) **[S]** liefert den vernichtenden Praxisbefund: *"**13 of the 18 ColorBrewer 9-step sequential ramps were not robust** to these mark sizes"* – getestet bei 10 px Punktdurchmesser und 4 px Strichstärke. Nur YlGn, YlGnBl, OrRd, YlOrBr, YlOrRd und Reds hielten mindestens 1 JND zwischen den Stufen. Und: *"lines are significantly more discriminable than equally thick points"* – eine Balkenreihe verträgt feinere Abstufungen als Punkte gleicher Dicke. (Szafir hat Heatmaps ausdrücklich **nicht** getestet.)

Matplotlib fasst das Prinzip: *"colormaps which have monotonically increasing lightness through the colormap will be better interpreted"* ([matplotlib.org](https://matplotlib.org/stable/users/explain/colors/colormaps.html)) **[D]**.

### Wann eine Zahl besser ist als ein Bild

Stephen Few, *Effectively Communicating Numbers* ([PDF](https://www.perceptualedge.com/articles/Whitepapers/Communicating_Numbers.pdf)) **[D]**:

> *"Tables work best when the display will be used to look up individual values or the quantitative values must be precise. Graphs work best when the message you wish to communicate resides in the shape of the data."*

Und der schärfere Test aus *Common Pitfalls in Dashboard Design* **[D]**: *"If you must read the numbers to determine how the slices of a pie chart relate to one another, you might as well use a table instead."* – **Deckt man die Zahl ab: sagt das Bild dann noch etwas? Wenn nein, gehört die Zahl allein in die Zelle.**

Zu Tachometern: *"A great deal of space is used by these gauges to tell us far too little."*

Fews schwerwiegendster Befund für Sparkline-**Spalten** ([Best Practices for Scaling Sparklines](https://www.perceptualedge.com/articles/visual_business_intelligence/best_practices_for_scaling_sparklines.pdf)) **[D]**: *"The quantitative scale of a sparkline, by definition, is never visible, but it exists nonetheless behind the scenes."* Gemeinsame Skala macht Größenordnungen vergleichbar, aber *"the large spread in values causes the lines to appear relatively flat, which obscures patterns of change."* **Eine Sparkline-Spalte kann nicht gleichzeitig Muster und Größenordnung ehrlich zeigen** – und die Entscheidung ist für den Leser unsichtbar.

---

## 4. Dunkle Oberflächen

### Die WCAG-2-Formel ist auf sehr dunklem Grund nachweislich zu lasch

WCAG 2.2 SC 1.4.3 verlangt 4,5:1 (Text) bzw. 3:1 (großer Text ab 24 px / 18,66 px fett); SC 1.4.11 verlangt 3:1 für Bedienelemente und bedeutungstragende Grafik, ausdrücklich ohne Rundung (*"2.999:1 would not meet the 3:1 threshold"*) **[D]**.

Der Vorwurf von Somers/APCA ([git.apcacontrast.com/documentation/WhyAPCA.html](https://git.apcacontrast.com/documentation/WhyAPCA.html)) **[D]**: *"WCAG 2.x far overstates contrast for dark colors to the point that 4.5:1 can be functionally unreadable when a color is near black."*

Das wurde gegen die offizielle Referenzimplementierung `apca-w3@0.1.9` nachgemessen **[M]**:

| WCAG-Ziel | dunkel auf hell | APCA | hell auf dunkel | APCA |
|---|---|---|---|---|
| 4,5:1 | `#777` auf `#fff` | **Lc 71,1** | `#747474` auf `#000` | **Lc 29,2** |
| 7:1 | `#595959` auf `#fff` | Lc 84,3 | `#959595` auf `#000` | Lc 45,1 |

**Bei identischer WCAG-Zahl liegt der wahrgenommene Kontrast auf Dunkel um Faktor 2,4 niedriger.** APCAs Fließtext-Minimum Lc 75 entspricht auf dunklem Grund etwa **WCAG 11–13:1**, nicht 4,5:1.

APCA-Schwellen **[D]**: Lc 90 bevorzugt für Fließtext · **Lc 75 Minimum für Fließtext** · Lc 60 Minimum für Nicht-Fließtext · Lc 45 nur Überschriften · Lc 30 nur Platzhalter.

Eine Einordnung, die man dazusagen muss: **Der WCAG-3-Entwurf vom 03.03.2026 nennt APCA nicht namentlich** ([w3.org/TR/wcag-3.0](https://www.w3.org/TR/wcag-3.0/)) **[D]**. Die verbreitete Aussage „APCA ist WCAG 3" ist nicht belegt. APCA ist ein Kandidatenverfahren mit eigener Leiter (Bronze/Silver/Gold).

**Und das trifft Ihr aktuelles Panel direkt [M]** – gemessen gegen `--color-surface: #0a0a0a`:

| Token | WCAG | APCA | Verwendbar für |
|---|---|---|---|
| `--color-text-primary` `#e5e5e5` | 15,72:1 | **Lc 90,9** | Fließtext ✓ |
| `--color-text-secondary` `#a0a0a0` | 7,57:1 (AAA!) | **Lc 50,7** | nur Überschriften |
| `--color-text-muted` `#888888` | 5,58:1 | **Lc 38,5** | nur Platzhalter |
| `--color-primary` `#f59e0b` | 9,22:1 | Lc 60,3 | Nicht-Fließtext |
| `--color-danger` `#ef4444` | 5,26:1 | **Lc 37,7** | nur Platzhalter |
| `--color-success` `#22c55e` | 8,69:1 | Lc 57,7 | knapp unter Lc 60 |

`text-secondary` besteht sogar WCAG **AAA** und ist perzeptuell trotzdem zu schwach für 11–12-px-Zahlen. Nötige Werte auf `#0a0a0a` **[M]**: Lc 60 → `#b2b2b2` · Lc 75 → `#cccccc` · Lc 90 → `#e4e4e4`. Für die Semantikfarben auf Lc 75: `#f9bcbc` (danger, 64 % Weiß), `#83dfa5` (success, 44 %), `#f9c265` (amber, 37 %).

### Reinweiß auf Reinschwarz – die Regel ist kein Konsens

`#fff` auf `#000` = **21,00:1 / Lc 107,9** **[M]** – das Maximum der Skala. Das Problem ist Kontrast**überschuss**, nicht Mangel.

Material nennt `#121212` als Grundfläche und Textdeckkräfte **87 % / 60 % / 38 %** ([Google-Codelab](https://codelabs.developers.google.com/codelabs/design-material-darktheme)) **[D]**. Gemessen ergibt „Medium emphasis" (`#a0a0a0`) 7,16:1 – AAA – aber **Lc 50,3** **[M]**. Der Fehlertyp steckt in Googles eigener Spezifikation.

**Aber Vercel Geist setzt im Dunkelmodus `--ds-background-100: #000` [Q]** und mildert stattdessen auf der Textseite: `--ds-gray-1000: #ededed` = 17,94:1 / **Lc 96,1** **[M]**. Die Regel „niemals Reinschwarz" ist eine Material-Position, kein Branchenkonsens. **Was zählt: eine der beiden Seiten muss zurückgenommen werden.** Grund anheben (Material `#121212`, Carbon `#161616`, GitHub `#010409`, Sentry `#1B1821`) oder Text absenken (Geist `#ededed`, Grafana `#CCCCDC`, Linear `#f7f8f8`).

**Kein einziges der geprüften Systeme setzt reinweißen Text auf dunklen Grund** – außer PostHog (`--text-3000-dark: #fff` auf `#1d1f27`, 16,44:1), das aber Sekundärstufen bei 70 % / 50 % / 25 % Deckkraft führt **[Q]**.

Die Halation-/Astigmatismus-Begründung ließ sich **nicht primär belegen** – das Wort kommt in keiner der APCA- oder NN/g-Quellen vor. **[?]** Belegt ist stattdessen der Pupillenmechanismus über NN/g ([nngroup.com/articles/dark-mode](https://www.nngroup.com/articles/dark-mode/)): Piepenbrock et al. (2013, *Ergonomics*) fanden helle Polarität in beiden Altersgruppen überlegen, *"The smaller the font, the better it is for users to see the text in light mode"*; Dobres et al. (2017) fanden nachts Light Mode besser, kleine Schrift im Dark Mode nachts deutlich schwerer lesbar. **[S]**

### Flächen abstufen, ohne Farbe zu verlieren

Materials Elevation-Overlay-Formel ist im Quellcode zweier Google-Implementierungen belegt (Flutter `elevation_overlay.dart`, MDC-Android `ElevationOverlayProvider.java`) **[Q]**:

```
alpha = (4.5 · ln(elevation + 1) + 2) / 100
```

Ausgewertet reproduziert das die bekannte Tabelle exakt: 0dp = 0 % · 1dp = 5 % · 2dp = 7 % · 3dp = 8 % · 4dp = 9 % · 6dp = 11 % · 8dp = 12 % · 12dp = 14 % · 16dp = 15 % · 24dp = 16 % **[M]**.

**Die entscheidende Konsequenz:** Die gesamte Leiter von 0dp bis 24dp spannt nur **1,62:1**. Flächenabstufung auf Dunkel kann die 3:1 aus SC 1.4.11 **konstruktionsbedingt nie erfüllen**. Wo eine Kante Bedeutung trägt, braucht es zusätzlich einen Rahmen.

Nachbarabstände realer Systeme **[M]**:

| System | Stufen | Nachbarabstand | Spanne |
|---|---|---|---|
| Sentry | `#0D0A10` → `#141119` → `#1B1821` → `#24202B` → `#2E2936` | 1,05–1,13 | **1,39:1** |
| Grafana | `#111217` → `#181b1f` → `#22252b` → `#383b42` | 1,08–1,37 | 1,67:1 |
| Linear | `#08090a` → `#0f1011` → `#141516` → `#191a1b` → `#1c1c1f` → `#232326` → `#28282c` | 1,03–1,09 | 1,36:1 |
| Radix grayDark (Schritte 1–9) | `#111111` … `#6e6e6e` | ~1,10 | – |
| **Ihr Projekt** | `#060606` → `#0a0a0a` → `#111111` | 1,02–1,05 | **1,07:1** |

Der einzelne Schritt stimmt bei Ihnen. Die **Spanne** ist das Problem: 1,07 gegen 1,36–1,67. Ein Panel, das bei `#0a0a0a` verankert ist, hat nach unten keinen Spielraum – die Leiter muss nach **oben** gehen.

Zwei Strukturmuster, die das lösen:

**Radix' 12-Schritte-Skala** ([radix-ui.com](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)) **[D]** weist jedem Schritt eine Funktion zu: 1–2 App-Hintergrund · 3 Komponentenfläche · 4 Hover · 5 Pressed · 6 Rahmen nicht-interaktiv · 7 Rahmen interaktiv · 8 starker Rahmen/Fokus · 9 Vollton · 10 Hover dazu · 11 Text niedriger Kontrast · 12 Text hoher Kontrast. Und die Garantie ist **in APCA formuliert**: Schritt 11 und 12 sind *"guaranteed to Lc 60 and Lc 90 APCA contrast ratio on top of a step 2 background"*. (Nachgemessen: die Lc-60-Zusage hält durchgehend; die Lc-90-Zusage verfehlt Rot um 5,3 Lc **[M]**.)

**Vercel Geist** macht dasselbe mit 10 Schritten **[D]**: 100–300 Fläche (Ruhe/Hover/Aktiv) · 400–600 Rahmen · 700–800 kontraststarke Flächen · 900–1000 Text und Icons. **Die Stufennummer sagt, wofür die Farbe da ist.** `gray-400` ist nie ein Hintergrund.

**Trennlinien dürfen weit unter 3:1 liegen** – SC 1.4.11 nimmt rein Dekoratives aus **[D]**. Gemessene Werte in Produktion **[M]**: Sentry `#0D0A10` auf `#2E2936` = **1,39:1**; PostHog `#35373e` auf `#1d1f27` = **1,38:1**; GitHub Primer `#3D444D` auf `#010409` = 2,09:1; Linear `--border-primary` `#23252a` auf `#08090a` = 1,30:1. Ihr `--color-border: #333333` auf `#0a0a0a` = 1,57:1 liegt genau im Feld. Bemerkenswert: **Sentrys Rahmen ist dunkler als die Fläche** – eine eingesenkte Linie statt einer aufgesetzten.

### Ein Akzent, und die Rot-Grün-Falle

Die „Ein-Akzent"-Regel und 60-30-10 ließen sich in **keiner** Primärquelle belegen – weder Radix noch Geist noch Primer noch Carbon noch W3C formulieren sie. **[?]** Was belegbar ist: die Struktur der Systeme legt Sparsamkeit nahe (Radix: *eine* Akzentskala neben Grau plus Semantik).

Was dagegen sehr wohl belegbar ist, ist der **Trennungsfehler bei Rot/Grün**. Gemessen **[M]** an Ihren Tokens mit einer Machado-Simulation:

| | ΔE zwischen `#ef4444` und `#22c55e` |
|---|---|
| normalsichtig | **127,3** |
| Deuteranopie | **12,1** (`#827341` gegen `#a09263`) |
| Protanopie | 44,7 |

Der Farbunterschied bricht um Faktor 10 zusammen. Prävalenz: **1 von 12 Männern (8 %)**, 1 von 200 Frauen ([colourblindawareness.org](https://www.colourblindawareness.org/colour-blindness/)) **[D]**. Datawrappers Regel: *"Get it right in black & white"* – und die Signalfarbenpaare **aller** untersuchten Systeme (Radix, Primer, Geist) liegen mit 1,12–1,36:1 im Luminanzabstand weit unter den 3:1, die SC 1.4.1 als Technik nennt.

Der beste Gegenbeleg: **GitHub Primer liefert 18 Theme-Modi aus**, darunter `dark-protanopia-deuteranopia`, in dem `fgColor.danger` von Rot `#f85149` auf **Orange** `#f0883e` umgestellt wird **[Q]**.

Für ein Kostenpanel heißt das: **Vorzeichen oder Glyphe trägt die Information, Helligkeit ist der zweite Träger, Farbton der dritte.** Ihr Amber `#f59e0b` ist übrigens die einzige Ihrer Semantikfarben, die unter Deuteranopie ihre Identität behält (`#dfaf0e`) und mit Lc 60,3 die Nicht-Fließtext-Schwelle erreicht.

---

## 5. Was die Vorbilder „premium" macht – die konkreten Merkmale

Nicht Adjektive, sondern Zahlen aus dem ausgelieferten Code **[Q]**:

| | Linear | Stripe Dashboard | Vercel Geist | Grafana | Sentry |
|---|---|---|---|---|---|
| UI-Basis | 13 px | 13–14 px | 13–14 px | **14 px** | 14 px |
| Kleinste Stufe | 10 px | **11 px** | 12 px | 12 px | **11 px** |
| Sans | Inter Variable | **System-Stack** | Geist Sans | Inter | Rubik |
| Mono | Berkeley Mono | Menlo | Geist Mono | Roboto Mono | Roboto Mono (**425**) |
| Gewichte | **510/590/680** | 300/400/500/700 | 400/500/600 | 300/400/500 | 400/500 |
| Raster | 4 px (+2 px fein) | 4 px, **beschnitten** | 4 px | **8 px** | 4 px |
| Radius | 4–6 px | **1/2/3/4/6 px** | 4/6/12 px | – | sm/md/lg |
| Zeile | 24 / 28 px | 36 / **24** px | – | **34 px** | 28/32/40 px (Controls) |
| Zeilentrenner | `.5px` hairline | **`inset box-shadow`** | im Schatten-Token | – | – |
| Row-Hover | **1,02–1,03:1** | 1,05:1 | – | 1,13:1 | – |
| Zeilenhöhen | `calc(21/14)` | Größe/Zeilenhöhe **entkoppelt** | Größe **fest gekoppelt** | 1,571 | 1 / 1,2 / 1,4 |

Ein paar Einzelheiten, die den Unterschied ausmachen:

- **Stripes Abstandsskala ist absichtlich unvollständig**: 0·2·4·8·12·16·20·24·32·48·64·80. Kein 6, kein 40, kein 56. Man kann nicht zwischen zu vielen Nachbarwerten wählen.
- **Stripe fährt im Dashboard die System-Schrift** – null Webfont-Latenz, plus handgepflegte CJK-Stacks pro `:lang()`.
- **Sentrys Mono-Regulargewicht ist 425**, nicht 400 – optischer Ausgleich für die dünner wirkende Monospace.
- **Grafana ist das einzige System mit 8-px-Raster** und trotzdem das dichteste Grid (34 px Standardzeile). Dichte kommt nicht vom Rastermaß.
- **Vercels Fokusring ist zweischichtig**: `0 0 0 2px <Hintergrund>, 0 0 0 4px <Fokusfarbe>` – erst ein Luftspalt, dann die Farbe.
- **Railway markiert Deployment-Starts als gestrichelte Vertikallinien im Metrikgraphen** ([docs.railway.com/reference/metrics](https://docs.railway.com/reference/metrics)) – Ursache und Wirkung ohne Ansichtswechsel.

---

## Die 15 Regeln

**1. `font-variant-numeric: tabular-nums` auf jede Zelle mit Zahlen – auch auf Datum und Uhrzeit.**
Ohne sie driften 7 Ziffern in Geist Sans um 25,4 px, in `system-ui` um 15,8 px (13 px Schriftgrad). *Quelle: eigene Messung an den Fontdateien; Butterick, [alternate-figures](https://practicaltypography.com/alternate-figures.html); Sentry [`discover/styles.tsx`](https://github.com/getsentry/sentry/blob/master/static/app/utils/discover/styles.tsx), das die Regel auch auf `FieldDateTime` setzt.*

**2. Zahlenzelle immer als Block: `text-align: right; tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis`.**
Dezimalausrichtung per CSS gibt es nicht – `text-align: <string>` ist in CSS Text 4 §7.2 spezifiziert, hat dort *"This section lacks tests"* stehen und keinen einzigen Eintrag in den MDN-Kompatibilitätsdaten. *Quelle: [drafts.csswg.org/css-text-4](https://drafts.csswg.org/css-text-4/#text-align-property); `mdn/browser-compat-data`; Grafana `getAlignment` richtet numerische Felder automatisch rechts aus.*

**3. Beträge unter 1 Dollar mit adaptiver Präzision: zwei signifikante Stellen, Untergrenze 2, Obergrenze 10 Nachkommastellen.** `0,003 → $0.0030`.
Feste 4 Stellen erzeugen bei großen Werten Rauschen und bei kleinen eine Reihe identischer Nullen. *Quelle: PostHog [`numbers.ts`, `significantDecimalPlaces`](https://github.com/PostHog/posthog/blob/master/frontend/src/lib/utils/numbers.ts) inkl. der Begründung im Kommentar. (Ihr `AdminAIUsageTab.ts` nutzt heute durchgängig `.toFixed(4)`.)*

**4. Wo die Einheit skalierbar ist, die Einheit skalieren statt Nachkommastellen anzuhängen.** „$0.20 / 1 Mio. Token" schlägt „$0.0000002 / Token".
*Quelle: [OpenAI-Preisseite](https://developers.openai.com/api/docs/pricing) (2 Stellen bei skalierter Einheit, 4 nur bei `$0.0045 / minute`); [Railway](https://docs.railway.com/reference/pricing) gibt beide Granularitäten nebeneinander an.*

**5. Spaltenbreite am längsten vorkommenden Wert festnageln, nicht am aktuellen.**
Grafana schaut dafür bis zu 1000 Zeilen voraus. *Quelle: Grafana [`TableNG/utils.ts`, `getAlignmentFactor`](https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/Table/TableNG/utils.ts).*

**6. Für Kolonnen U+2212 MINUS SIGN, nie den Bindestrich.**
In Geist Sans: Bindestrich 419, Minus 520, Plus 558 Einheiten pro 1000 em – der Bindestrich sitzt 1,8 px daneben. *Quelle: eigene Messung.*

**7. Zeilenhöhe 24–36 px, und niemals `height`, immer `min-height`.**
24 px ist der vierfach belegte Boden (Carbon xs, Linear, Stripe small, WCAG 2.5.8). Eine feste `height: 24px` mit 12-px-Text beschneidet, sobald ein Nutzer `line-height: 1.5` erzwingt (dann 26 px). *Quelle: [Carbon `_data-table.scss`](https://github.com/carbon-design-system/carbon/blob/main/packages/styles/scss/components/data-table/_data-table.scss); [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) und [1.4.12](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html); Stripe baut die Zeile als `min-height: 20px; margin: 8px`.*

**8. Zeilentrenner als `box-shadow: inset 0 1px`, nicht als `border`.**
Ein Innenschatten belegt keinen Platz im Box-Modell: die Zeilenhöhe bleibt exakt, keine doppelten Linien an Gruppengrenzen, keine Sprünge beim Sticky-Header. *Quelle: Stripe-Dashboard-CSS, `.ListViewItem-cell`.*

**9. Row-Hover unter 1,15:1 – und Buttons dürfen mehr.**
Linear: Zeile `#ffffff04` (1,024:1), Button `#ffffff0d` (1,099:1). Grafana 1,125:1. Bei 50 sichtbaren Zeilen ist 5 % ein Blitzen. Dazu `@media (any-hover: hover)` und `::after`-Opazität statt Hintergrundwechsel, ~160 ms. *Quelle: Linear-Produktions-CSS; Grafana [`TableNG/styles.ts`](https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/Table/TableNG/styles.ts) (`--rdg-row-hover-background-color: background.secondary`); eigene Kontrastmessung.*

**10. Auf Dunkel WCAG 4,5:1 nicht als Lesbarkeitsmaß nehmen – APCA Lc 75 für Fließtext, Lc 60 für kleine Zahlen führen.**
Bei gleicher WCAG-Zahl liegt der wahrgenommene Kontrast auf Dunkel um Faktor 2,4 niedriger. Ihr `--color-text-secondary: #a0a0a0` besteht WCAG AAA (7,57:1) und erreicht nur Lc 50,7. Auf `#0a0a0a` braucht Lc 75 den Wert `#cccccc`. *Quelle: [APCA – Why APCA](https://git.apcacontrast.com/documentation/WhyAPCA.html); [Lc-Schwellen](https://git.apcacontrast.com/documentation/APCAeasyIntro.html); eigene Messung mit `apca-w3@0.1.9`. Einschränkung: der [WCAG-3-Entwurf](https://www.w3.org/TR/wcag-3.0/) nennt APCA nicht.*

**11. Eine der beiden Seiten zurücknehmen – Grund anheben oder Text absenken, nie beides auf Anschlag.**
`#fff` auf `#000` ist Lc 107,9. Material hebt den Grund (`#121212`), Vercel senkt den Text (`#ededed` auf `#000` = Lc 96,1). Kein untersuchtes System fährt beide Extreme. *Quelle: [Material-Codelab](https://codelabs.developers.google.com/codelabs/design-material-darktheme); Vercel-CSS `--ds-background-100: #000` / `--ds-gray-1000: #ededed`; eigene Messung.*

**12. Flächenleiter mit ~1,05–1,13:1 je Stufe und mindestens 1,35:1 Gesamtspanne bauen – und die Stufennummer bekommt eine Funktion.**
Sentry spannt 1,39:1, Linear 1,36:1, Grafana 1,67:1; Ihr `#060606 → #0a0a0a → #111111` spannt nur 1,07:1. Geist: 100–300 Fläche, 400–600 Rahmen, 900–1000 Text. *Quelle: eigene Messung an Sentry [`theme/scraps/tokens/color.tsx`](https://github.com/getsentry/sentry/blob/master/static/app/utils/theme/scraps/tokens/color.tsx), Grafana `palette.ts`, Linear-CSS; [Geist Colors](https://vercel.com/geist/colors); [Radix – Understanding the scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale).*

**13. Trennlinien bei 1,3–1,6:1 gegen die Fläche halten – aber wo eine Kante Bedeutung trägt, reicht Flächenabstufung nie.**
Materials komplette Elevationsleiter 0→24dp spannt nur 1,62:1, kann die 3:1 aus SC 1.4.11 also konstruktionsbedingt nicht erfüllen. Gemessene Praxis: Sentry 1,39:1, PostHog 1,38:1, Ihr `#333` 1,57:1. *Quelle: Flutter [`elevation_overlay.dart`](https://github.com/flutter/flutter/blob/master/packages/flutter/lib/src/material/elevation_overlay.dart) (Formel `(4.5·ln(dp+1)+2)/100`); [SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) mit der Dekorationsausnahme; eigene Messung.*

**14. Ein Vorzeichen oder eine Glyphe trägt die Information, Helligkeit ist der zweite Träger, Farbe der dritte.**
Zwischen `#ef4444` und `#22c55e` fällt der Farbabstand unter Deuteranopie von ΔE 127 auf 12. Betroffen: 8 % der Männer. GitHub Primer liefert dafür ein eigenes Theme aus, das Rot durch Orange ersetzt. *Quelle: eigene Machado-Simulation; [colourblindawareness.org](https://www.colourblindawareness.org/colour-blindness/); [Datawrapper](https://www.datawrapper.de/blog/colorblindness-part2/); [primer/primitives](https://github.com/primer/primitives) `dark-protanopia-deuteranopia`.*

**15. Sparkline nur bei 20–26 px Höhe, mit Endpunktmarker, mit Nulllinie, ohne Rahmen – und immer mit der Zahl daneben.**
Heers Optimum ist 24 px; darunter fällt die Genauigkeit linear (−4,1 Einheiten je Halbierung), unter 12 px auf Horizon-Bänder wechseln, über vier Bänder nie. Eine Grundlinie kauft den Genauigkeitsverlust flacher Seitenverhältnisse zurück. Und Fews Test: deckt man die Zahl ab und das Bild sagt nichts mehr, gehört nur die Zahl in die Zelle. *Quelle: [Heer/Kong/Agrawala, CHI 2009](http://vis.stanford.edu/files/2009-TimeSeries-CHI.pdf); [Talbot et al., InfoVis 2012](http://vis.stanford.edu/files/2012-SlopeComparison-InfoVis.pdf); [Few, Common Pitfalls](https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf); Grafana `SparklineCell.tsx` (`height: 25`, Zahl mit gelockter Spaltenbreite daneben).*

---

## Wo die Beleglage schlecht ist – ausdrücklich

- **Bloomberg Terminal, Height, Superhuman, Retool**: kein öffentliches Design-System, Bloomberg-Produktseite HTTP 403. Zu Schriftwahl, Farbcodierung und Zeilenhöhen dieser vier gibt es hier **keine belastbaren Zahlen**.
- **Borkin et al. 2013** („What Makes a Visualization Memorable?"): fünf Hosts probiert, kein Volltext. Keine Zahlen entnommen.
- **Halation/Astigmatismus** als Begründung gegen Reinweiß: in keiner Primärquelle belegt. Belegt ist nur der Pupillenmechanismus über NN/g.
- **„Ein Akzent"-Regel und 60-30-10**: in keiner Primärquelle formuliert. Die Struktur der Systeme legt Sparsamkeit nahe, mehr nicht.
- **Materials „15,8:1"-Mindestwert**: nur zweitrangig belegt, `m2.material.io` ist eine SPA und liefert keinen Inhalt.
- **Excel-Datenbalken-Defaults**: OOXML nennt 10 %/90 %, die VBA-Referenz 0/100. Beide sind offizielle Microsoft-Doku, der Widerspruch ist ohne Messung nicht auflösbar.
- **Keine Studie gefunden, die Sparklines *in Tabellenzellen* untersucht.** Alle Zahlen in Regel 15 stammen aus isolierten Chart-Aufgaben; die Übertragung auf eine gescannte Spalte ist plausibel, aber ungetestet.