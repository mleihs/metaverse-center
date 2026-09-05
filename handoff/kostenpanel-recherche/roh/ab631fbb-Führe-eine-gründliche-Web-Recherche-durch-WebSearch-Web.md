# AUFTRAG

Führe eine gründliche Web-Recherche durch (WebSearch + WebFetch, mindestens 12 Seiten wirklich abrufen) zum Thema KLEINE DIAGRAMME IN TABELLENZELLEN. Antworte auf Deutsch.

Untersuche:
1. Sparklines: Tufte's Originaldefinition (edwardtufte.com "Sparklines: intense, simple, word-sized graphics", das Beautiful Evidence-Kapitel — es gibt einen bekannten Forum-Thread auf edwardtufte.com). Konkrete Maße: wie hoch/breit soll eine Sparkline sein? Tufte spricht von "word-sized". Welche px-Werte nennen echte Implementierungen (z.B. Google Sheets SPARKLINE, Excel Sparklines Zeilenhöhe, jQuery sparklines defaults, Observable Plot, ECharts)? Wann mit/ohne Achse, mit/ohne Endpunkt-Marker, mit/ohne Min-Max-Band?
2. Empirische Forschung zur Wahrnehmung sehr kleiner Zeitreihen: suche nach "Heer, Kong, Agrawala: Sizing the Horizon" (CHI 2009 — konkrete Ergebnisse zu Chart-Höhen in px: 24px, 12px etc. und Horizon Graphs vs Line Charts), "Perception of Average Value in Multiclass Scatterplots", Javed/McDonnel/Elmqvist "Graphical Perception of Multiple Time Series" (InfoVis 2010), sowie Forschung zu Aspect Ratio / "banking to 45 degrees" (Cleveland). Nenne die konkreten Zahlen der Studien.
3. Bar-in-cell / Datenbalken in Tabellenzellen: Excel Data Bars, Guidelines dazu; wann Balken in Zellen besser sind als Zahlen; das Problem der nicht-bei-null beginnenden Balken. Heatmap-Zellen / Farbkodierung in Tabellen: welche Farbskalen (ColorBrewer, viridis), Wahrnehmungsprobleme bei kleinen Flächen (such

---

Recherche abgeschlossen — 20+ Seiten und PDFs tatsächlich abgerufen. Hier der Bericht.

---

# Kleine Diagramme in Tabellenzellen — Rechercheergebnis

---

## TEIL A — BELEGT

### 1. Tufte: Was eine Sparkline ist, und welche Maße er wirklich nennt

Quelle: https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/ (Tuftes eigener Notebook-Thread, Textgrundlage des Beautiful-Evidence-Kapitels)

Definition, wörtlich: **„A sparkline is a small intense, simple, word-sized graphic with typographic resolution."**

Konkrete Zahlen, die Tufte selbst nennt:

| Größe | Wert |
|---|---|
| Breite einer Finanz-Sparkline | **14 Letterspaces** (Zeichenbreiten) |
| Seitenverhältnis Finanzdaten | **5 : 1** |
| Seitenverhältnis Baseball-Saison | **20 : 1** |
| Seitenverhältnis DNA-Chromosom | **300 : 1** |
| Papier-Auflösung, die er voraussetzt | **> 1.200 dpi** |
| Bildschirm | „about 10% of paper's resolution" |
| Monitoring-Dichte | **500 Sparklines auf A3** (25 × 45 cm) |
| Max. Dichte reiner Zahlentabellen | **300 Zeichen / Quadratzoll** (50 / cm²) |

**Wichtig und oft missverstanden: Tufte nennt keine einzige Pixelzahl.** Sein Maß ist typografisch — Höhe = Wortgröße, Breite = Anzahl Letterspaces. Wer px-Werte von ihm zitiert, zitiert etwas, das nicht in der Quelle steht.

Zu Achsen, Markern, Bändern (wörtlich bzw. eng am Original):
- **Rahmen/Achsen: nein.** „Avoid all data frames; the physical location of the numbers, words, and graphics enforces the implicit grid; that grid never needs to be expressed directly."
- **Endpunkt-Marker: ja, farbig akzentuiert.** Der jüngste Wert wird als roter Punkt gezeigt UND als Zahl daneben; beide „are tied together with a color accent".
- **Min/Max-Marker: ja, farblich getrennt vom Endpunkt.** Ein Beispiel: „red = the oldest and newest rates in the series; blue = yearly low and high".
- **Normalbereichs-Band: ja, grau hinterlegt.** „the normal range of glucose, here as a gray band … readings above the band horizon are elevated, those below reduced."
- **Aspect Ratio nach „banking to 45°":** maximale vertikale Höhe unter der Wort-Beschränkung nehmen, dann horizontal strecken, bis das Profil „lumpy" ist (weder spitz noch flach).

---

### 2. Was echte Implementierungen tatsächlich als Default setzen

#### jQuery Sparklines (die meistkopierten Defaults)
Doku: https://omnipotent.net/jquery.sparkline/ · Quelltext geprüft: https://cdnjs.cloudflare.com/ajax/libs/jquery-sparklines/2.1.2/jquery.sparkline.js (`getDefaults()`, Zeile 226 ff.)

| Option | Default |
|---|---|
| `height` | `'auto'` |
| `width` | `'auto'` |
| `defaultPixelsPerValue` | **3 px pro Datenpunkt** |
| `lineWidth` | **1 px** |
| `spotRadius` (End-/Min-/Max-Punkt) | **1.5 px** |
| `spotColor` / `minSpotColor` / `maxSpotColor` | `#f80` (alle drei standardmäßig AN) |
| `barWidth` / `barSpacing` (Balken) | **4 px / 1 px** |
| `lineHeight` (discrete) | 30 % der Grafikhöhe |
| `normalRangeColor` (Normalband) | `#ccc`, hinter der Füllfläche |
| `width` bei Bullet-Chart | `'4.0em'` |

Das Entscheidende steht im Quelltext, nicht in der Doku: Bei `height: 'auto'` erzeugt die Bibliothek ein `<span>` mit dem Buchstaben „a" und misst dessen `innerHeight` (Zeilen 963–966). **Die Default-Höhe ist buchstäblich die Zeilenhöhe eines Buchstabens.** Tuftes „word-sized" ist hier wörtlich implementiert. Die Default-Breite ist `Anzahl Werte × 3 px`.

#### Google Sheets `SPARKLINE`
https://support.google.com/docs/answer/3093289

- Vier Typen: `line` (Default), `bar`, `column`, `winloss`.
- **Es gibt überhaupt keinen Größenparameter.** Die Sparkline füllt die Zelle. Größe = Zeilenhöhe × Spaltenbreite.
- Bemerkenswert typografisch: „To modify the color of a line chart, change the font color of the cell." Die Sparkline erbt die Schriftfarbe der Zelle — sie wird von Google wie Text behandelt.
- Optionen: `linewidth`, `color`, `ymin/ymax`, `xmin/xmax`, `rtl`, `nan`, `empty`; für column/bar zusätzlich `lowcolor`, `highcolor`, `firstcolor`, `lastcolor`, `negcolor`, `axis` (true/false), `axiscolor`.
- **Defaultwerte sind für keine dieser Optionen dokumentiert** — außer dass `line` der Default-Typ ist. Das ist eine Lücke in der Google-Doku, keine meiner Recherche.

#### Excel Sparklines
OOXML-Spezifikation: https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.office2010.excel.sparkline

Wörtlich aus der Spec (CT_Sparkline): der `sqref` „MUST contain exactly one `ref` element that MUST specify exactly one cell." **Eine Excel-Sparkline ist per Format an genau eine Zelle gebunden.** Ihre Höhe ist die Zeilenhöhe.

Excel-Default-Zeilenhöhe: **15,00 Punkt** (Default-Spaltenbreite 8,43 Zeichen; Maximum 409 Punkt) — https://support.microsoft.com/en-us/office/change-the-column-width-and-row-height-72f5e3cc-994d-43e8-ae58-9774a0905f46. *(Eigene Umrechnung, nicht in der Quelle: 15 pt × 96/72 = **20 px** bei 96 dpi — abzüglich Zellinnenabstand landet die Sparkline bei ca. 16–18 px.)*

#### Allgemeine Chart-Bibliotheken (zum Kontrast)
- **Observable Plot:** Default-Breite **640**, Default-Höhe wird automatisch gewählt, „for example, if *y* is linear and there is no *fy* scale, it might be **396**" — https://raw.githubusercontent.com/observablehq/plot/main/docs/features/plots.md
- **Vega-Lite:** `config.view.continuousWidth` = **200**, `continuousHeight` = **200**, diskreter Step **20** — https://vega.github.io/vega-lite/docs/size.html

Das heißt: Wer eine Sparkline mit einer Standard-Chart-Bibliothek baut, muss die Default-Höhe um den Faktor 10–20 unterschreiten. Für ECharts habe ich **keine dokumentierten Sparkline-Defaults gefunden** — die Bibliothek kennt das Konzept nicht als eigenen Typ.

---

### 3. Die empirische Kernstudie: Heer, Kong, Agrawala, „Sizing the Horizon" (CHI 2009)

PDF abgerufen: http://vis.stanford.edu/files/2009-TimeSeries-CHI.pdf

**Aufbau Experiment 1:** alle Charts **500 × 40 px**, y-Bereich −100…+100, 2/3/4 Bänder, 18 Probanden.

Ergebnisse Experiment 1:
- Schätzfehler: 2 Bänder **M = 4,12** Einheiten, 3 Bänder **M = 4,04**, 4 Bänder **M = 5,64** (4 Bänder signifikant schlechter, p = 0,042 bzw. 0,041).
- Zeit steigt mit jedem Band: **+2,89 s** von 2→3 Bänder, **+1,91 s** von 3→4 (F(2,34) = 431,18, p < 0,001).

**Aufbau Experiment 2:** 30 Probanden, 14,1"-LCD bei 1024 × 768. Charts 500 px breit; **Höhen 48, 24, 12, 6 px** (Skalen 1, ½, ¼, ⅛). Drei Typen: normale Linie, 1-Band-Mirror, 2-Band-Mirror. Bei Skala 1 physisch 13,9 × 1,35 cm. Nachfolge-Experiment mit 8 Probanden und Skalen ⅛, 1/12, 1/24 — **kleinste Chart-Höhe 2 px**.

Die konkreten Zahlen, die zählen:

| Befund | Zahl |
|---|---|
| Diskriminierung (welcher Wert ist größer?) | **≥ 98 %** korrekt in ALLEN Bedingungen (Nachfolge: ≥ 96 %) — auch bei 2 px |
| Fehler stabil bis | **48 px und 24 px**; darunter monoton steigend |
| Kreuzungspunkt 2-Band schlägt 1-Band | **12 px** (Skala ¼) |
| Fehleranstieg unter 24 px | **linear**, Steigung **−4,1 Einheiten / log₂ Pixel**, R² = 0,986 (Nachfolge: −3,5, R² = 0,980) |
| Zeitgewinn bei 24 px vs. 48 px | **1,1 s schneller**, Fehleranstieg **< 2 Einheiten** |
| 2-Band-Charts langsamer als Linie | **+2,05 s** (und +1,91 s ggü. 1-Band) |

**Die Design-Empfehlungen wörtlich:**
- „for both normal line charts and 1-band mirror charts, we found a chart height of **24 pixels (6.8 mm** on our 14.1" 1024 × 768 pixel displays) **to be optimal**."
- „For 2-band line charts, we found optima at **12 and 6 pixels (3.4 and 1.7 mm)**."
- „2-band mirror charts provided better accuracy at chart heights **less than 24 pixels (6.8 mm)**. For larger chart sizes, we advise scaling 1-band mirrored charts. For smaller sizes, we advise adding layered bands."
- „We **discourage the use of 4 or more bands**." / „we recommend using 2-band charts for charts heights of **6 pixels (1.7 mm) or more**."
- Spiegeln (Mirroring) kostet nichts: „neither slowed estimation time nor hurt estimation accuracy … we advocate its use when space constraints warrant."

Ein Nebenbefund, der für Tabellen sehr relevant ist: **Kleinere Charts wurden schneller gelesen** — die Leute investieren weniger Zeit, weil sie von einer kleinen Grafik weniger Genauigkeit erwarten. Bei 24 px war das ein reiner Gewinn (schneller, gleich genau). Erst darunter zahlt man dafür.

*(Eigene Umrechnung, nicht in der Quelle: 6,8 mm entsprechen bei 96 CSS-dpi ca. **26 CSS-px**. Die „24 px" von 2009 sind eine physische Größe; auf einem HiDPI-Display muss man die physische Größe halten, nicht die Gerätepixel.)*

---

### 4. Aspect Ratio / „Banking to 45°" — die Regel hält der Nachprüfung nicht stand

PDF abgerufen: http://vis.stanford.edu/files/2012-SlopeComparison-InfoVis.pdf (Talbot, Gerth, Hanrahan, „An Empirical Model of Slope Ratio Comparisons", InfoVis 2012)

Clevelands Originalstudie, wie sie dort dokumentiert wird: 16 Probanden, 44 Linienpaare, Steigungsverhältnisse 50–100 %, Steigungen ca. 0,1 bis knapp über 1, Präsentation **2,5 s** pro Paar. Sein Modell:

> |p̂ᵢⱼ − pᵢⱼ| = 4,39 − 0,47(pᵢⱼ − 100) − 1,14 rᵢⱼ + εᵢⱼ

Die Widerlegung, wörtlich: **„we have seen that slope ratio estimation accuracy is not, in general, minimized at 45°."** Und: Bei der Winkel-Strategie (die die meisten Leute tatsächlich verwenden, nicht die Höhen-Strategie, die Cleveland seinen Probanden vorgeschrieben hatte) verschiebt sich das Minimum „from near 45° to **below 30°**". Clevelands Modell „is fitting a local, rather than global, trend" und erzeugt „a false minimum at 45°".

Der praktisch verwertbarste Befund für Tabellen (Experiment 2, 20 Probanden, 2.940 Antworten): **eine sichtbare Grundlinie** reduziert den Fehler dramatisch. „the addition of a baseline nearly eliminates the judgment error for mid-angles less than 45°" — und erlaubt damit ausdrücklich „selecting flatter aspect ratios than otherwise might be possible, because the visible reference line will reduce slope ratio estimation errors."

Für eine Sparkline in einer Tabellenzelle heißt das konkret: Wenn man die extreme Flachheit (5:1, 20:1) braucht, kauft man einen Teil des Genauigkeitsverlusts durch eine Nulllinie/Referenzlinie zurück.

Einschränkung, die die Autoren selbst nennen: Beide Studien testeten nur **Paare isolierter Liniensegmente**, nicht echte Plots. „It is still unclear if the results derived in our studies for pairwise discrete comparisons will transfer to real plots."

---

### 5. Farbe auf kleinen Flächen — die These stimmt, mit Zahlen

#### Stone, Szafir, Setlur, „An Engineering Model for Color Difference as a Function of Size" (CIC 2014)
PDF: https://graphics.cs.wisc.edu/Papers/2014/SAS14/2014CIC_48_Stone_v3.pdf

11 Größen von **6° bis ⅓°** Sehwinkel getestet. Kernaussage wörtlich: **„small shapes need to be much more colorful to be usefully distinct."**

Gemessene ND(50 %) in ΔE — also der CIELAB-Abstand, bei dem 50 % der Betrachter einen Unterschied sehen:

| Achse | 0,333° | 1° | 2° | 6° |
|---|---|---|---|---|
| L* | **7,321** | 6,017 | 5,010 | 5,574 |
| a* | **9,901** | 6,897 | 5,917 | 5,149 |
| b* | **14,837** | 8,197 | 6,831 | 5,834 |

Modell: `ND(50,s) = C + K/s` mit L*: C = 5,079 / K = 0,751 · a*: 5,339 / 1,541 · b*: 5,349 / 2,871. Verallgemeinert `ND(p,s) = p(A + B/s)` mit L*: A = 10,16, B = 1,50 · a*: 10,68 / 3,08 · b*: 10,70 / 5,74.

Zwei Sätze zum Merken: „a minimum step in CIELAB of between **5 and 6** is what is needed to make two colors visibly different for large shapes (2-degree or larger)" — nicht 1, wie CIELAB theoretisch behauptet. Und die Asymmetrie: b* (gelb-blau) degradiert bei kleinen Flächen fast dreimal so stark wie L* (Helligkeit). **Auf kleinen Flächen ist Helligkeit der robusteste Kanal, Gelb-Blau der fragilste.**

#### Szafir, „Modeling Color Difference for Visualization Design" (IEEE VIS 2017 / TVCG 2018)
PDF: http://danielleszafir.com/colordiff_vis2017.pdf · Projektseite: https://cmci.colorado.edu/visualab/VisColors/

461 Probanden, drei Markentypen. Umrechnung im Paper: 30 Zoll Betrachtungsabstand, 96 dpi → 2° ≈ 50 px, 10° ≈ 250 px.

**Punkte (Scatterplot), ND(50 %) in ΔE:**

| Durchmesser | L* | a* | b* |
|---|---|---|---|
| 0,25° = **6 px** | 8,37 | **16,11** | **19,46** |
| 0,5° = 12 px | 6,74 | 9,98 | 13,34 |
| 1° = 25 px | 5,75 | 7,81 | 10,03 |
| 2° = 50 px | 5,47 | 6,84 | 7,99 |

Modelle: `ND_L(50%,s) = 5,095 + 0,80/s` (R² = 0,93) · `ND_a = 5,089 + 2,69/s` (R² = 0,99) · `ND_b = 6,786 + 3,20/s` (R² > 0,99), s in Grad.

**Linien, ND(50 %) in ΔE:**

| Strichstärke | L* | a* | b* |
|---|---|---|---|
| 0,05° = **2 px** | 15,35 | 13,92 | 19,47 |
| 0,15° = 4 px | 8,69 | 10,28 | 15,17 |
| 0,35° = 9 px | 6,92 | 7,79 | 11,05 |

Modelle: `ND_L = 5,73 + 0,50/s` · `ND_a = 7,53 + 0,34/s` · `ND_b = 11,29 + 0,43/s`.

Zwei Befunde mit direkter Konsequenz für Tabellen:
1. **Längliche Marken sind farblich besser unterscheidbar als quadratische gleicher Dicke.** „lines are significantly more discriminable than equally thick points" — eine 4 px hohe Balkenreihe verträgt feinere Farbabstufungen als 4 px große Punkte.
2. **ColorBrewer bricht bei kleinen Marken zusammen.** Wörtlich: „We found that **13 of the 18 ColorBrewer 9-step sequential ramps were not robust** to these mark sizes: only **YlGn, YlGnBl, OrRd, YlOrBr, YlOrRd, and Reds** retained at least 1 JND between subsequent steps." Getestet gegen Tableau-Defaults: **10 px Punktdurchmesser, 4 px Strichstärke.** ColorBrewer wurde für Kartografie entworfen, „which generally use larger marks."
3. Zum Kalibrieren: eine 2°-JND für einen Scatterplot-Punkt ist „roughly **3 times larger** than that predicted in controlled environments."

Wichtige Einschränkung, die Szafir selbst nennt: **Heatmaps wurden ausdrücklich NICHT getestet** — „we opted not to test heatmaps, which are generally heavily affected by contrast." Die Zahlen sind also für farbige Punkte/Balken/Linien belegt, für Heatmap-Zellen nur eine plausible Untergrenze.

#### Perzeptiv uniforme Skalen
https://matplotlib.org/stable/users/explain/colors/colormaps.html — „Researchers have found that the human brain perceives changes in the **lightness** parameter as changes in the data much better than, for example, changes in **hue**. Therefore, colormaps which have **monotonically increasing lightness** through the colormap will be better interpreted." Perzeptiv uniforme sequenzielle Maps dort: viridis, plasma, inferno, magma, cividis.

Das deckt sich mit Stones Messung: L* ist der stabilste Kanal bei kleinen Flächen. Eine Heatmap-Zelle sollte ihren Wert primär über Helligkeit tragen, nicht über Farbton.

---

### 6. Datenbalken in Zellen — das Nullpunkt-Problem ist in der Spezifikation dokumentiert

Die maßgebliche Stelle steht in ISO/IEC 29500, zitiert bei https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.databar :

> „Data bar length = minLength + (cell value − minimum value in the range) / (maximum value in the range − minimum value in the range) × (maxLength − minLength), where min and max length are a fixed percentage of the column width (**by default, 10 % and 90 %** respectively.) The minimum difference in length (or increment amount) is **1 pixel**."

**Das ist der Beleg für das Problem.** Die Formel normalisiert auf `[min, max] des Bereichs`, nicht auf Null. Der kleinste Wert bekommt 10 % Balkenlänge, der größte 90 % — egal ob die Werte 1 und 500 oder 499 und 500 sind. **Balkenlänge ist damit kein Verhältnis mehr.** Ein Balken, der doppelt so lang aussieht, kann jeden beliebigen Faktor repräsentieren.

Microsofts eigenes VBA-Beispiel demonstriert das Symptom: „because there is an extremely low and high value in the range, the middle values have data bars that are of similar length" (https://learn.microsoft.com/en-us/office/vba/api/excel.databar).

Steuerbar über:
- `PercentMin` — „the length of the shortest data bar as a percentage of cell width … whole number between 0 and 100. **The default value is 0.**" (https://learn.microsoft.com/en-us/office/vba/api/excel.databar.percentmin)
- `PercentMax` — „**The default value is 100.**" (https://learn.microsoft.com/en-us/office/vba/api/excel.databar.percentmax)
- `AxisPosition`: `xlDataBarAxisAutomatic` / `xlDataBarAxisMidpoint` / `xlDataBarAxisNone`

**Ehrlicher Hinweis auf einen Widerspruch in den Quellen:** Die OOXML-Spec nennt 10 %/90 % als Defaults, die VBA-Doku 0/100. Beide sind offizielle Microsoft-Dokumentation. Ich konnte nicht auflösen, welcher Wert im aktuellen Excel-UI gilt — vermutlich beschreibt die Spec das Excel-2007-Verhalten, das VBA-Objekt das ab 2010. Wer sich darauf verlässt, muss es messen.

Praktische Konsequenz, die aus der Formel selbst folgt (keine Meinung): Wenn `cfvo type="num" val="0"` als Minimum gesetzt wird, wird die Formel zu `minLength + Wert/Max × (maxLength − minLength)` — proportional, sobald zusätzlich `PercentMin = 0` gilt. **Ein Datenbalken ist erst dann ein ehrlicher Balken, wenn beide Bedingungen erfüllt sind.**

---

### 7. Wann ein Diagramm schlechter ist als eine Zahl

Stephen Few, „Effectively Communicating Numbers" (Perceptual Edge Whitepaper), https://www.perceptualedge.com/articles/Whitepapers/Communicating_Numbers.pdf — wörtliches Kriterium:

> **„Tables work best when the display will be used to look up individual values or the quantitative values must be precise. Graphs work best when the message you wish to communicate resides in the shape of the data (that is, in patterns, trends, and exceptions)."**

Few, „Common Pitfalls in Dashboard Design" (2006), https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf — Pitfall #5, wörtlich:

> **„If you must read the numbers to determine how the slices of a pie chart relate to one another, you might as well use a table instead. We use graphs when the picture itself reveals something important that couldn't be communicated as well be a table of numbers."**

Das ist der schärfste verfügbare Test: **Wenn das Bild ohne die danebenstehende Zahl nicht funktioniert, ist das Bild überflüssig.**

Zu Gauges/Tachometern (Pitfall #2, wörtlich):
> „Other than estimating that net income is around $3.5 million, this gauge tells us nothing. … Is this amount of income good? **A great deal of space is used by these gauges to tell us far too little.**"

Und Pitfall #6 gegen Abwechslung um ihrer selbst willen: „consistency in the means of display whenever appropriate allows viewers to use the **same perceptual strategy** for interpreting the data, which saves them time and energy." Für Tabellen heißt das: eine Diagrammart pro Spalte, nicht drei verschiedene.

**Der interessanteste Gegenbefund kommt aus der Forschung, nicht von Few:** Correll, Albers, Franconeri, Gleicher, „Comparing Averages in Time Series Data" (CHI 2012), https://graphics.cs.wisc.edu/Papers/2012/CAFG12/ — für die Aufgabe „finde den Bereich mit dem höchsten Durchschnitt" gilt laut Abstract: „a theory of perceptual averaging suggests a visual design **other than the typically-used line graph** … **this color encoding significantly outperforms the standard practice**." Für Aggregat-Urteile kann eine farbkodierte Zeile also besser sein als eine Sparkline. *(Nur Abstract verifiziert — das PDF ist nicht frei zugänglich, siehe Teil C.)*

---

### 8. Sparklines in Tabellenserien: das Skalierungsproblem

Stephen Few, „Best Practices for Scaling Sparklines in Dashboards" (2012), https://www.perceptualedge.com/articles/visual_business_intelligence/best_practices_for_scaling_sparklines.pdf

Fews Punkt: „The quantitative scale of a sparkline, **by definition, is never visible, but it exists nonetheless behind the scenes.**" Sieben Skalierungsmethoden, und — das ist das Belastbare daran — jede kann jeweils nur eine Teilmenge von vier Eigenschaften zeigen: Größenordnung der Werte, Größenordnung der Änderung, Änderungsrate, Variabilität.

Die Entscheidungsregeln wörtlich:
- Einzelne Sparkline oder unabhängig gelesene → Methode 1 (Min–Max der eigenen Reihe) oder 2 (fester sinnvoller Bereich, z. B. 90–100 % Uptime).
- Serie, nur Muster/Trends vergleichen → Methode 1.
- Serie, **Größenordnungen der Werte** vergleichen → Methode 3 (gemeinsame Skala Min–Max der Serie), 4 (**gemeinsame Skala ab Null**) oder 5 (gemeinsames Referenzband + individuelle Skalierung).
- Serie, nur **Änderungsgrößen und Variabilität** → Methode 6 (konstante Spannweite).
- Log-Skala **nur** für Änderungsraten und Variabilität — „No other characteristics of change through time … can be accurately discerned using a log scale."

Zu Methode 4 wörtlich: „By beginning the scale at zero, the differences in the distance from the baseline (zero) to each data point along a sparkline **accurately represents** the differences in the values … Perceptually, this works best when those magnitudes are … also [represented] by the **height of the region between the baseline and the data points**" — also gefüllte Fläche, nicht nur Linie.

Der harte Trade-off, den Few benennt: Gemeinsame Skala macht Größenordnungen vergleichbar, aber „the large spread in values causes the lines to appear relatively flat, **which obscures patterns of change**." **Eine Sparkline-Spalte kann nicht gleichzeitig Muster und Größenordnung ehrlich zeigen.** Man muss sich entscheiden — und die Entscheidung ist unsichtbar, weil die Skala unsichtbar ist.

---

## TEIL B — MEINE EMPFEHLUNG (Meinung, aus den Belegen abgeleitet)

Diese Punkte folgen aus den Zahlen oben, stehen aber so in keiner Quelle:

1. **Zielhöhe für eine Sparkline in einer Tabellenzelle: 20–26 CSS-px, nicht weniger.** Heers Optimum von 24 px / 6,8 mm für Linien- und 1-Band-Charts ist die einzige harte Zahl, die es gibt, und sie kollidiert erfreulich mit der Standard-Zeilenhöhe von Excel (15 pt ≈ 20 px) und mit jQuerys „Zeilenhöhe eines Buchstabens". Drei unabhängige Quellen landen im selben Fenster.

2. **Unter 24 px nicht einfach weiterschrumpfen, sondern die Kodierung wechseln.** Heers Kurve ist ab dort linear fallend mit −4,1 Einheiten pro Halbierung. Wer 12 px hat, sollte ein 2-Band-Horizon nehmen (das schlägt dort messbar die Linie); wer 6 px hat, sollte prüfen, ob Farbe statt Position die Aufgabe besser löst (Correll et al.). Unter 6 px ist es keine Grafik mehr, sondern ein Farbstreifen — dann ehrlicherweise auch einen bauen.

3. **Endpunkt-Marker ja, Min/Max-Marker nur, wenn die Aufgabe sie braucht.** Heers Befund, dass Diskriminierung („welcher ist größer") auch bei 2 px zu ≥ 96 % klappt, während Magnitudenschätzung zerfällt, sagt: Das Auge liest Richtung und Extrema aus winzigen Formen zuverlässig, absolute Höhen nicht. Marker helfen dort, wo das Auge sowieso schwach ist — beim Verankern eines konkreten Wertes.

4. **Keine Achse, aber eine Nulllinie.** Tufte verbietet Rahmen; Talbot belegt, dass eine sichtbare Grundlinie den Schätzfehler bei flachen Aspect Ratios drastisch senkt. Das ist kein Widerspruch: eine Referenzlinie ist Daten-Kontext, kein Rahmen.

5. **Für Heatmap-Zellen unter ~12 px: ColorBrewer-9-Stufen-Rampen sind vermutlich zu fein.** Szafirs Messung gilt für Punkte und Linien, nicht Heatmaps — aber wenn schon 10-px-Punkte 13 von 18 Rampen brechen, ist bei 8-px-Zellen Vorsicht angebracht. Praktisch: auf 5 Stufen reduzieren, oder eine der sechs robusten Rampen nehmen, oder viridis (monoton in L*).

6. **Der Ehrlichkeitstest für jede Zelle ist Fews Pie-Chart-Test:** Deckt man die Zahl daneben ab — sagt das Bild dann noch etwas? Wenn nein, gehört die Zahl allein in die Zelle.

---

## TEIL C — WAS ICH NICHT BELEGEN KONNTE

Ich sage das ausdrücklich, statt es zu überspielen:

1. **Javed, McDonnel, Elmqvist, „Graphical Perception of Multiple Time Series" (InfoVis 2010).** DOI 10.1109/TVCG.2010.162. Ich habe sechs URL-Varianten, OpenAlex und die Semantic-Scholar-API probiert: **Closed Access, kein Open-Access-Volltext auffindbar, Abstract vom Verlag zurückgehalten.** Die im Umlauf befindliche Zusammenfassung („small multiples und Horizon-Graphen sind effizienter bei großer visueller Spanne") habe ich **nicht am Original verifiziert** — ich nenne keine Zahlen daraus.

2. **Gleicher et al., „Perception of Average Value in Multiclass Scatterplots" (2013).** DOI 10.1109/TVCG.2013.183. PMC-Eintrag existiert (PMC4007001), lieferte aber nur Navigation, keinen Volltext. **Keine Zahlen entnommen.**

3. **Correll et al. 2012** — nur Abstract von der Projektseite verifiziert, kein PDF. Die Aussage „color encoding significantly outperforms the standard practice" ist belegt, die Effektgrößen nicht.

4. **Google-Sheets-SPARKLINE-Defaults.** Google dokumentiert die Optionen, aber **keine Defaultwerte** außer dem Charttyp. Das ist eine Lücke in Googles Doku.

5. **ECharts-Sparkline-Defaults.** Existieren nicht — ECharts kennt Sparklines nicht als eigenen Typ; man baut sie aus einem Line-Chart mit abgeschalteten Achsen. Keine dokumentierten Kleinstgrößen.

6. **Excel-Data-Bar-Defaults widersprechen sich zwischen zwei offiziellen Microsoft-Quellen** (10 %/90 % in der OOXML-Spec vs. 0/100 in der VBA-Referenz). Nicht auflösbar ohne Messung in einer aktuellen Excel-Version.

7. **Keine Studie gefunden, die Sparklines *in Tabellenzellen* direkt untersucht.** Alle empirischen Zahlen oben stammen aus isolierten Chart-Aufgaben. Die Übertragung auf eine gescannte Tabellenspalte ist plausibel, aber ungetestet — Talbot et al. benennen genau diese Lücke für ihren eigenen Fall.

8. **Kein px-Wert von Tufte.** Er argumentiert typografisch. Jede px-Zahl, die ihm zugeschrieben wird, ist eine Interpretation Dritter.

---

**Sources:**
- [Tufte, Sparkline theory and practice](https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/)
- [Heer, Kong, Agrawala — Sizing the Horizon (CHI 2009, PDF)](http://vis.stanford.edu/files/2009-TimeSeries-CHI.pdf)
- [Talbot, Gerth, Hanrahan — An Empirical Model of Slope Ratio Comparisons (InfoVis 2012, PDF)](http://vis.stanford.edu/files/2012-SlopeComparison-InfoVis.pdf)
- [Szafir — Modeling Color Difference for Visualization Design (PDF)](http://danielleszafir.com/colordiff_vis2017.pdf) · [Projektseite](https://cmci.colorado.edu/visualab/VisColors/)
- [Stone, Szafir, Setlur — An Engineering Model for Color Difference as a Function of Size (CIC 2014, PDF)](https://graphics.cs.wisc.edu/Papers/2014/SAS14/2014CIC_48_Stone_v3.pdf)
- [Correll, Albers, Franconeri, Gleicher — Comparing Averages in Time Series Data](https://graphics.cs.wisc.edu/Papers/2012/CAFG12/)
- [Few — Best Practices for Scaling Sparklines in Dashboards (PDF)](https://www.perceptualedge.com/articles/visual_business_intelligence/best_practices_for_scaling_sparklines.pdf)
- [Few — Effectively Communicating Numbers (PDF)](https://www.perceptualedge.com/articles/Whitepapers/Communicating_Numbers.pdf)
- [Few — Common Pitfalls in Dashboard Design (PDF)](https://www.perceptualedge.com/articles/Whitepapers/Common_Pitfalls.pdf)
- [jQuery Sparklines Doku](https://omnipotent.net/jquery.sparkline/) · [Quelltext 2.1.2](https://cdnjs.cloudflare.com/ajax/libs/jquery-sparklines/2.1.2/jquery.sparkline.js)
- [Google Sheets SPARKLINE](https://support.google.com/docs/answer/3093289)
- [OOXML DataBar (ISO/IEC 29500 Formel)](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.databar) · [Databar-Objekt](https://learn.microsoft.com/en-us/office/vba/api/excel.databar) · [PercentMin](https://learn.microsoft.com/en-us/office/vba/api/excel.databar.percentmin) · [PercentMax](https://learn.microsoft.com/en-us/office/vba/api/excel.databar.percentmax)
- [OOXML CT_Sparkline](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.office2010.excel.sparkline) · [Excel Zeilenhöhe/Spaltenbreite](https://support.microsoft.com/en-us/office/change-the-column-width-and-row-height-72f5e3cc-994d-43e8-ae58-9774a0905f46)
- [Observable Plot — Defaults](https://raw.githubusercontent.com/observablehq/plot/main/docs/features/plots.md) · [Vega-Lite Size](https://vega.github.io/vega-lite/docs/size.html)
- [Matplotlib Colormaps](https://matplotlib.org/stable/users/explain/colors/colormaps.html) · [ColorBrewer](https://colorbrewer2.org/learnmore/schemes_full.html)