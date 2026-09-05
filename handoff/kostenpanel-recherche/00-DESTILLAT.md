---
title: "Destillat: was aus 30 Rechercheberichten für das Kostenpanel gilt"
date: "2026-09-05"
type: recherche
lang: de
---

# Destillat

30 Berichte, 984 KB, alle im Nachbarordner `roh/`. Was davon für das Panel gilt,
mit Beleg. Wo etwas unbelegt blieb, steht es dabei — und wo unsere eigenen
Zahlen der Recherche widersprechen, gewinnen unsere Zahlen.

## 0. Unsere Daten, gemessen auf Produktion (05.09.2026)

    Zeitraum          05.04.2026 – 05.09.2026 (5 Monate)
    Zeilen            1 510
    Gesamt            11,87 USD
      davon Bild      10,58 USD  (Replicate)   89,1 %
      davon Text       1,29 USD  (OpenRouter)  10,9 %
    Welten            21
    Modelle           10
    Zwecke            21
    Ausgang           1 509 ok · 1 http_error
    kleinster Betrag  0,000012 USD
    groesster Betrag  0,0730 USD

**Vier Größenordnungen in einer Spalte** — und dazwischen eine echte Lücke:

    0,000012 – 0,005 USD   1 222 Zeilen   OpenRouter (Text)
    0,005    – 0,025 USD       0 Zeilen   ← LEER
    0,004    – 0,073 USD     316 Zeilen   Replicate (Bild)

⚠ **Der Achsenbruch ist bei uns kein Gestaltungsmittel, sondern die Form der
Daten.** Zwischen Text- und Bildkosten liegt ein leeres Band. Ein linearer
Balken zeigt 1 222 Zeilen als Strich am Nullpunkt.

**Was die Achsen heute tragen:**

    Zeit · Anbieter · Modell · Zweck · Ausgang      vollständig
    Welt                                            1 308 / 1 510 (Rest ist plattformweit)
    Gespräch                                        60 / 1 510 (nur Verdichtungen; Chat schreibt sie seit 2a0235d6)
    Figur                                           0 (Chat schreibt sie seit 2a0235d6)
    Schlüsselquelle                                 1 510 / 1 510 „platform" — BYOK nie benutzt
    Nutzer                                          0 / 1 510 — user_id ist überall NULL

## 1. Die Dichte-Debatte ist entschieden, aber anders als gedacht

| These | Status |
|---|---|
| Data-Ink als **Merkbarkeits**regel | **widerlegt** — Borkin 2013: dichte Bilder M=1,83 gegen dünne M=1,28, t(115)=6,08, p<0,001 |
| Data-Ink als **Ablesegenauigkeits**regel | **hält** — Skau 2015: keine von sieben Verzierungen schlug den nackten Balken |
| „Schmuck schadet" | **differenziert** — Haroz 2015: nur die „superfluous"-Bedingung war langsamer (F[4,49]=20) |
| Small Multiples | **bestätigt** — Robertson 2008: 45,7 s gegen 83,1 s bei Animation |
| Sparkline-Untergrenze | **gemessen** — Heer 2009: unter 24 px linearer Fehleranstieg, R²=0,986 |
| Minimalismus als Präferenz | **widerlegt** — Inbar 2007, 87 Personen |

**Die Synthese:** Tuftes Regel war nie falsch, sie war unterspezifiziert. Sie
gilt fürs *Ablesen*, nicht fürs *Erinnern*, und sie unterscheidet nicht
zwischen Schmuck, der Daten kodiert, und Schmuck, der danebensteht. **Ein
Balken in der Zelle kodiert. Ein Icon neben dem Modellnamen nicht.**

Und Fews methodische Gegenrede trifft genau unseren Fall: Batemans
Testdiagramme haben je *eine* Aussage, die Werte sind *„incidental to its
purpose"*. Ein Kostenpanel ist die Gegenlage.

## 2. Der kanonische Aufbau — fünf Ebenen

Bei praktisch allen Vorbildern dieselbe Reihenfolge:

1. **Kopfkacheln** — 2 bis 6, keine Achsen
2. **Ein Hauptdiagramm über die Zeit** — die Summe, gestapelt nach *einer* Achse
3. **Aufschlüsselungen nebeneinander** — mehrere kleine Listen, je eine Achse
4. **Tabelle(n)** — die Gruppen als Zeilen, sortierbar
5. **Einzelaufruf** — nur über Klick

**Die Übersicht endet bei Ebene 3.** Ab Ebene 4 wird gearbeitet, nicht überblickt.

Zwei lehrreiche Abweichungen: **Railway** lässt das Hauptdiagramm weg und zeigt
**vier separate, nicht gestapelte Charts** (Small Multiples statt Stapel).
**Linear** koppelt Chart und Tabelle fest — unter *jedem* Graphen steht die
Tabelle, sie ist kein eigener Abschnitt.

## 3. Kacheln — nie mehr als sechs

Belegte Anzahlen: Railway 2 · GCP 2 · AWS 3 · Datadog 4 · Helicone 4 · Azure 4+1 ·
Portkey 6.

**Drei Muster:**

- **Wertpaar Ist/Prognose** (Railway: „Current Usage" + „Estimated Bill",
  nebeneinander, auf drei Ebenen, **kein Delta, keine Sparkline, kein Pfeil**)
- **Wert plus Veränderung als eigene Kachel** (Datadog: Total Cost · Cost Change ·
  Total Tokens · Token Change)
- **Nur Quotienten, keine Summen** (Helicone: „Avg Cost / Req" usw., **keine
  einzige absolute Zahl** im Kopf)

**Was NICHT hineingehört:** Fehlerrate (ohne Zeitverlauf wertlos) · Perzentile
(bekommen überall ein eigenes Panel) · alles, was erst nach Setzen eines
Filters bedeutet, was es sagt.

**Ein Muster, das trägt:** Bei **Stripe** ist die Kachel ein **Selektor**, keine
Vorschau — Klick macht sie zur Datenquelle des Charts darunter. Kachel und
Diagramm sind ein Bedienelement, nicht zwei.

## 4. Typografie für Zahlen

**Belegte Maßzahlen:**

| | Zeilenhöhe | Polsterung | Schrift |
|---|---|---|---|
| Carbon xs | 24 px | 2 px vertikal / **16 horizontal, konstant** | 14 px |
| Salesforce | Kopf 32 px | **4 / 8 px** — dichtester belegter Wert | – |
| Polaris | inhaltsabhängig | 6 px allseitig, außen 12 | – |
| Grafana | 34 px | 6 px | 14 px |
| Linear | 24 und 28 px | – | 13 px |
| Zed | – | – | 15/16 px, Zeilenhöhe **1.3** |
| Retool X-Small | **20 px** | – | ⚠ unter WCAG 2.5.8 |

**Fünf von sieben Systemen halten die Schriftgröße über alle Dichtestufen
konstant.** Dichte kommt aus vertikalem Raum, nicht aus kleinerer Schrift
(Rello 2013: Schriftgröße signifikant, Zeilenabstand 0,8–1,8 ohne messbaren
Effekt).

**Kleinste branchenweit in Daten eingesetzte Größe: 11 px.** Unser `--text-xs`
= 10,24 px liegt darunter.

**Drei Zahlen fallen auf dieselbe 24:** Carbons dichteste Zeile, WCAG 2.5.8,
und Heers gemessener Genauigkeitsknick. Das ist eine Beobachtung, keine
belegte Kausalität — aber ein guter Anker.

**Regeln:**

- `font-variant-numeric: tabular-nums` auf jede Zahlenzelle, **auch Datum und
  Uhrzeit**. Ohne sie driften 7 Ziffern um 25,4 px (Geist Sans) bei 13 px.
- Geist wörtlich: *„Apply tabular-nums **or** Geist Mono to numeric columns"* —
  entweder oder, nicht beides zwingend.
- **U+2212 MINUS SIGN, nie den Bindestrich** (1,8 px Versatz bei 13 px).
- Dezimalausrichtung per CSS **existiert nicht** — `text-align: <string>` hat in
  MDN-BCD null Einträge. Ersatz: Spaltenbreite am längsten Wert festnageln
  (Grafana `getAlignmentFactor`, schaut bis 1000 Zeilen voraus), dann
  rechtsbündig.
- Beträge unter 1 $: **zwei signifikante Stellen**, min. 2, max. 10
  Nachkommastellen (PostHog `min(max(2, 1 − ⌊log₁₀|v|⌋), 10)`).
  `0,003 → $0.0030`, `0,0003 → $0.00030`.
- **Nie auf 0 runden.** Notfalls `<$0.0001` statt `$0.0000`.
- Zähler sind ganzzahlig: `1,510`, nie mit Nachkommastellen.
- Trennlinien als `box-shadow: inset 0 1px`, **nicht** `border` — belegt keinen
  Platz im Box-Modell, keine Doppellinien, keine Sticky-Header-Sprünge (Stripe).
- Row-Hover **unter 1,15:1** (Linear 1,024:1, Grafana 1,125:1); Knöpfe dürfen mehr.
- Verschachtelung: **genau eine Ebene.** Mehr ist in keinem System dokumentiert.
- **Keines der sechs untersuchten Produkte** (Linear, Stripe, Vercel, Grafana,
  Sentry, PostHog) verwendet Zebrastreifen.

## 5. Farbe — nach ROLLE aufspalten, nicht nach Farbton

**Der harte Beleg:** Grafana führt **vier Werte je Farbton** (`darkMain`,
`darkText`, `lightMain`, `lightText`). Bei Orange sind `darkMain` und
`lightMain` **derselbe Wert** `#ff9900`; die Textvariante spaltet sich
(`#fbad37` gegen `#B04E0C`).

**Zehn von zehn Kreuzproben fallen durch** — kein Textton trägt beide Gründe
(dunkle Texttöne auf Papier 1,59–2,61:1; helle auf Dunkel 2,62–3,72:1).

    Füllungen        EIN Wert reicht  (eine Fläche wird gesehen, nicht gelesen — 3:1)
    Texte, Icons     ZWEI Werte       (auf jedem Grund neu gemessen)
    Gegenblöcke      ZWEI Werte

**Unser Bernstein `#f59e0b`, gemessen:** 9,22:1 auf Dunkel · **1,82:1 auf
Papier** · **1,54:1 auf gesenkter Papierauflage.** Faktor 5,1. Die schon
gebaute Lösung hält: `--color-accent-amber-readable` =
`color-mix(… amber 45 %, text-primary)` ergibt dunkel `#ecc583` (Lc 75), hell
`#7b5915` (5,41:1). **Ein Token, zwei Ergebnisse, weil der Mischpartner mit dem
Skin kippt.**

**Auf Dunkel ist WCAG untauglich als alleiniges Maß.** Bei identischer
WCAG-Zahl liegt der wahrgenommene Kontrast auf Dunkel um **Faktor 2,4**
niedriger. Unsere Tokens, gemessen:

| Token | WCAG | APCA |
|---|---|---|
| `#e5e5e5` | 15,72:1 | Lc 90,9 ✓ |
| `#a0a0a0` | 7,57:1 (AAA!) | **Lc 50,7** ✗ |
| `#888888` | 5,58:1 | **Lc 38,5** ✗ |
| `#ef4444` | 5,26:1 | **Lc 37,7** ✗ |

Zielwerte auf `#0a0a0a`: Lc 60 → `#b2b2b2` · Lc 75 → `#cccccc` · Lc 90 → `#e4e4e4`.

**Unsere Flächenleiter ist zu flach:** `#060606 → #0a0a0a → #111111` spannt
**1,07:1**. Sentry 1,39 · Linear 1,36 · Grafana 1,67. Empfehlung 1,05–1,13 je
Stufe, Gesamtspanne ≥ 1,35.

**Rot gegen Grün trägt nichts:** Der Helligkeitsabstand liegt bei allen drei
geprüften Systemen zwischen **1,00 und 1,36:1** — in Graustufen identisch.
Bloombergs Lösung (Laborstudie, ~20 000 farbfehlsichtige Nutzer): **Blau statt
Grün**, weil Blau ebenfalls als „auf" gelesen wird. Und: **Bernstein bleibt für
NICHT-semantische Information**, das Farbpaar trägt Bedeutung.

**Reihenfolge der Träger:** Vorzeichen/Glyphe zuerst, Helligkeit zweitens,
**Farbe drittens**. `#ef4444` gegen `#22c55e` fällt unter Deuteranopie von
ΔE 127 auf **12**.

**Keine Standardpalette trägt beide Gründe:** tableau10 7/10 unter 3:1 auf
Papier, observable10 7/10, category10 5/10.

**Grafanas Lösung:** dieselbe Farbleiter **um genau eine Sprosse verschoben**,
und Serien werden über **Namen** adressiert, nicht über Hexwerte. Dann bleibt
die Serienidentität skin-unabhängig.

## 6. Der Zustandsraum einer Zelle — hier ist der Stand der Technik leer

**Kein Design-System** (Carbon, Polaris, Material, Atlassian) hat eine Regel zu
leerer Zelle gegen Null. Die Regel existiert nur in der **amtlichen Statistik**:

| Kürzel | Bedeutung (UK Government Analysis Function, wörtlich) |
|---|---|
| `[x]` | not available |
| `[z]` | not applicable |
| `[c]` | confidential |
| **`[low]`** | **„a low figure but not a real zero"** |
| `[e]` | estimated |
| `[f]` | forecast |
| `[p]` | provisional |
| `[u]` | low reliability |
| `[b]` | break in time series |

Kernregel: **„A zero or '0' should only be used when a data point is a true
zero."** Und die Legende gehört **über** die Tabelle, nicht darunter — gelesen,
bevor die Zahlen gelesen werden.

**Das Kürzel hängt an der ZELLE, nicht an der Spalte.** Eine Tabelle darf
geschätzte und abgerechnete Zeilen mischen.

**Was die Produktwelt hat:** Grafana rendert `null` als `-` (Werksvorgabe) —
unterscheidet aber **nicht** zwischen „kein Wert" und „Wert = 0". Vercel Geist:
Geviertstrich `—`, nicht „N/A", nicht leer. AWS: `N/A` mit Begründung („cannot
be calculated when expected spend is zero"). **Datadog als Einziges mit
Abzeichen: `PARTIAL COST` und `COST UNAVAILABLE`** — drei Zustände pro Zelle
statt einer Fußnote.

**Und die zweite Leerstelle: kein einziges Werkzeug weist die Zählbasis eines
Mittelwerts aus.** „Ø 0,004 USD (n = 42 von 50)" wäre ungewöhnlich ehrlich.

Beide Lücken betreffen dieselbe Sache: **wie viele Werte hinter einer Zahl
stehen.**

## 7. Diagramme

**Taugt:** gestapelte Balken über Zeit (aber nur die unterste Kategorie hat eine
echte Nulllinie) · Kalender-Heatmap · **Achsenbruch** · **Matrix** · ein
einziger waagerechter 100-Prozent-Balken · Balken in Zellen.

**Taugt nicht:** Sunburst (äußere Ringe noch schlechter als Treemap) ·
themeRiver (schön, für Beträge unlesbar) · Kreisdiagramm (Winkelwahrnehmung
versagt bei extremen Verhältnissen) · Log-Skala (redet den Unterschied klein,
den man sehen soll).

**Treemap bei 89/11:** Eine Kachel wäre achtmal so groß wie die andere, und
*innerhalb* der kleinen müssten die Textmodelle noch unterkommen. ECharts
blendet Knoten unter `visibleMin: 10` **stillschweigend** aus. data-to-viz:
*„Don't annotate more than 3 levels."* **Und der Negativbefund:** Vantage
(Spezialist für Cost Reports) dokumentiert Balken, Linien, Flächen, Kreis —
**weder Treemap noch Sankey.** Bundeshaushalt.de, der Lehrbuchfall für einen
Ausgaben-Sankey, benutzt isolierte Einzelbalken. Drei unabhängige Akteure, die
die Zeichnung bauen könnten, bauen sie nicht.

**Sankey lohnt an genau einer Stelle:** Schlüsselquelle → Anbieter → Kosten.
2 → 2 → Betrag. Vier Knoten, vier Fäden. Nicht Anbieter → Modell → Zweck (bis
zu 30 dünne Verbindungen).

**Balken in Zellen: `border-radius: 0`.** Schon das Abrunden der Spitze erhöht
den Ablesefehler von MLAE 1,43 auf 1,86 (p < 0,001).

**Datenbalken sind erst dann ehrlich, wenn die Skala bei Null beginnt.** Die
OOXML-Formel normalisiert auf `[min, max] des Bereichs`: der kleinste Wert
bekommt 10 % Länge, der größte 90 % — egal ob die Werte 1 und 500 oder 499 und
500 sind. **Balkenlänge ist dann kein Verhältnis mehr.**

**Sparklines:** 20–26 px Höhe, Endpunktmarker, **Nulllinie** (Talbot: eine
sichtbare Grundlinie senkt den Schätzfehler bei flachen Seitenverhältnissen
drastisch), **kein Rahmen**, immer mit der Zahl daneben. Unter 24 px steigt der
Fehler linear.

**Fews Ehrlichkeitstest für jede Zelle:** Deckt man die Zahl daneben ab — sagt
das Bild dann noch etwas? Wenn nein, gehört die Zahl allein in die Zelle.

**Und die Falle, die keine Skala verrät:** Eine Sparkline-Spalte kann nicht
gleichzeitig Muster und Größenordnung ehrlich zeigen. Man muss sich
entscheiden — und die Entscheidung ist unsichtbar, weil die Skala unsichtbar ist.

## 8. Prognose — die Rangfolge der Ehrlichkeit

1. **Keine Daten → keine Prognose.** AWS wörtlich: *„If AWS doesn't have enough
   data to forecast an 80% prediction interval, Cost Explorer doesn't provide a
   forecast."* Die einzige Regel, die den Fehler unmöglich macht.
2. **Farbe entziehen** (GCP: „light gray"). Ein aufgehellter Balken in
   Serienfarbe liest sich noch als Messung; ein grauer nicht.
3. **Schattierung** (Azure).
4. **Strichelung** — die schwächste Markierung; sagt nichts über die Breite der
   Unsicherheit.
5. **Die Mittellinie weglassen** (Bank of England). Was nicht da ist, kann nicht
   abgelesen werden.

Die BoE-Begründung ist der beste Satz zum Thema: die alte Punktprognose
*„encouraged the reader to concentrate on an apparently precise central
projection, ignoring the very wide degree of uncertainty"* — plus die Warnung,
dass **schattierte Flächen regelmäßig als Ober-/Untergrenze missverstanden**
werden.

**Alle drei Hyperscaler zeigen die Prognose als ZAHL neben der Summe.** Das
Band ist Beiwerk. Und: **die Prognose ist überall eine Gesamtsumme, nie pro
Serie** (Azure sagt es ausdrücklich).

**Zwei Fallen beim Vorperiodenvergleich:**

- **Strichelung wird für zwei Bedeutungen benutzt.** Plausible trennt sauber:
  **Strichelung = Zeitraum unvollständig, Helligkeit = andere Periode.** Stripe
  strichelt die Vorperiode. Wer beides strichelt, macht die zwei Aussagen
  ununterscheidbar.
- **Die Farbsemantik ist bei Kosten invertiert.** Steigende Kosten sind
  schlecht. Grafana hat dafür `Show percent change: Standard / Inverted / Same
  as Value`, Datadog `Increases as better / Decreases as better / Neutral`.
  **Ohne diesen Schalter ist jede Delta-Anzeige in einem Kostenpanel farblich
  falsch.**
- Und: Division durch null. Plausible löst es explizit — Vergleichswert 0 und
  Ist > 0 ergibt exakt `100`, 0/0 ergibt exakt `0`, nie `Infinity`.

## 9. Ausreißer — eine Rangliste, kein rotes Zeichen

**Der Maßstab ist nicht die Höhe.** AWS wörtlich: *„a small spike with
historically consistent spend is categorized as **high** severity. And,
similarly, a big spike with irregular historical spend is categorized as
**low** severity."* Deshalb altert eine feste Regel „20× Median" schlecht.

**OpenRouters eigene Empfehlung:** *„A model priced at a large multiple of the
**blended rate** is the strongest signal to chase"* (blended rate =
Gesamtausgaben ÷ Gesamttokens). In SQL eine Zeile.

**Erkennung ≠ Meldung.** AWS trennt das ausdrücklich: alles wird erkannt und
gelistet, gemeldet nur das über der Schwelle.

**Das dominierende Muster ist eine Rangliste:** Datadog „Most Expensive LLM
Calls" · Langfuse „Top 20 Users by Cost", Perzentiltabellen standardmäßig
absteigend nach p95 · Linear: Scatterplot mit **Perzentil-Markern bei
25/50/75/95 %** — die Antwort auf „Median gegen Maximum" ist nicht zwei Zahlen,
sondern die Punktwolke mit eingezeichneten Quantilen.

**Warum der Durchschnitt versagt** (Brendan Gregg, gemessen): `iostat` zeigte
3–9 ms Mittelwert; die Einzelereignisse lagen meist **unter 2 ms**. „the
average has been dragged up by latency outliers".

## 10. Filter und Zeitraum

**Grafana hat das beste Vokabular:** relative Freitextzeiten (`s m h d w M Q y`
— man tippt „13h") · absolute Zeiten · **semi-relativ** (fester Anfang, `now`
als Ende = „seit Monatsbeginn bis jetzt", in Web-Dashboards selten kopiert) ·
Tastenkürzel `t+`/`t-`.

**Sentry: Granularität ableiten, nicht anbieten.** Bei 7 Tagen ein Balken pro
Stunde, bei 90 Tagen einer pro Tag. **Kein Nutzer stellt Auflösung ein.**
Langfuse hat es fest verdrahtet: 1 Tag → Stunde · 30 Tage → Tag · 90 Tage →
Woche · 1 Jahr → Monat.

**Sentrys Kategorienlehre:** fünf gleichrangige Kategorien statt Erfolg/Fehler.
Bei uns: durchgeführt / gedrosselt / abgebrochen / fehlgeschlagen / aus dem
Cache. **Ein einzelner „Fehler"-Balken verschenkt die Diagnose.**

**Top-N und die Sammelzeile:** AWS ab sechs Filtern Top 5 + „Other" · Azure Top
9 + „Others", **„Untagged" immer zuletzt**, auch wenn es größer ist · PostHog
Top 25 mit **zwei getrennten Sammel-Label**: `Other` (abgeschnittener Rest)
gegen `NULL` (Eigenschaft fehlt).

**Vercels „Viewing Options"** sind das übertragbarste Muster: **eine Metrik,
fünf Linsen** statt fünf Kacheln — Count / Project / Region / **Ratio** /
Average. Ratio mit festen Gegensatzpaaren. Bei uns: Bild gegen Text,
Plattform-Schlüssel gegen eigenen.

**Railway:** Deployments als **gestrichelte Senkrechte** in der Zeitreihe. Bei
uns die Senkrechte, wenn ein Modell oder ein Preis gewechselt wurde.

## 11. Monospace — wo er kippt

**NN/g** trennt Brutalismus (roh, unverziert) von Anti-Design (aktiv
desorientierend). Kernsatz: *„Niemand beschwert sich, dass eine Website zu
leicht zu verstehen ist."* Positivbeispiel Adult Swim: brutalistischer Look,
**Navigation bleibt klar.**

**Butterick:** Mono ist für Fließtext unterlegen, legitim nur für Code und
tabellarische Zahlen. Und der unbequeme Nachsatz: **die meisten
Proportionalschriften liefern tabellarische Ziffern von Haus aus** — Monospace
ist zur Zahlenausrichtung gar nicht nötig, nur zur Ästhetik.

**Operative Regel:** Mono für Zahlen, IDs, Slugs. Sans für alles Erklärende.
**Nie beides im selben Absatz.**

**Courier New hat eine leere Null und nur 0,571 em Versalhöhe — für Zahlen die
schlechteste Wahl im Feld.**

## 12. Was in unserem Code repariert werden muss, bevor gestaltet wird

1. **`SERIES_LIGHT` in `EchartsChart.ts`** wurde gegen EINEN der drei
   Papiergründe getunt. Auf `#d5dcd6` (sunken) fallen **vier von fünf**
   Serienfarben unter 3:1 (2,54–2,59). Derselbe Fehler, den `theme-presets.ts`
   für die vier Tinten schon behoben hat.
2. **`color-scheme: dark`** steht fest auf `:root` (`_colors.css:6`),
   projektweit zwei Vorkommen, beide `dark`, `ThemeService` schreibt es
   nirgends. Im Atlas-Skin bleiben Scrollbalken, Formularelemente und
   `<select>` dunkel. **`color-scheme` ist die einzige Eigenschaft, die dieses
   Browser-Chrome erreicht** — kein Token kann das lösen.
3. **`dispose()` + `init()` beim Themewechsel** ist seit ECharts 6 unnötig.
   `setTheme(theme, opts)` ist öffentliche API (`echarts.js:513`), installiert
   ist 6.1.0. Spart Canvas-Neuaufbau, Zoomzustand und einen Frame Flackern.
4. **`grid.containLabel`** ist seit 6.0 abgekündigt → `outerBoundsMode: 'same'`
   + `outerBoundsContain: 'axisLabel'`.
5. **`tooltip.appendToBody`** ist seit 5.5 abgekündigt → `appendTo`. **Trifft
   uns härter als andere:** unser Wrapper rendert in Shadow DOM, `document.body`
   liegt außerhalb, der Tooltip verlöre jede Formatierung.
6. **Fehlende ECharts-Registrierungen:** `TreemapChart`, `SankeyChart`,
   `DataZoomComponent`, `MarkLineComponent`, `MarkAreaComponent`,
   `DatasetComponent`, `TransformComponent`, `MatrixComponent`.
7. **`--text-xs` = 10,24 px** liegt unter der branchenweit kleinsten in Daten
   eingesetzten Größe (11 px).
8. **Flächenleiter 1,07:1** — zu flach für Tiefe.
9. **`ai_usage_log.user_id` ist 1510/1510 NULL** — die Nutzer-Achse existiert
   nicht, und die Nutzer-Sprosse der Budgetdurchsetzung kann nie greifen.

## 13. Die drei Muster über alle Produkte hinweg

1. **Alle rechnen Token × Preisliste — nur drei zeigen die Herkunft des
   Wertes:** Langfuse (`ingested`/`inferred` mit Vorrangregel), Braintrust
   (`estimated_cost` mit Registry-Fallback), Datadog (die zwei Abzeichen). Alle
   übrigen zeigen **eine Zahl ohne Provenienz**.
2. **Die Cache-Ausweisung ist durchweg die brüchigste Stelle.** Braintrust zeigt
   stumm 0 %, wenn Rohfelder nicht gemappt sind. Langfuse mischt Cache-Reads
   unsichtbar in die Input-Summe. **Beide Fehler sind still** — kein Fehler, nur
   eine falsche Zahl.
3. **„Wessen Schlüssel zahlt" hat außer OpenRouter und Vercel niemand.**
   Helicone führt `is_passthrough_billing` in der Datenbank und eine
   Prioritätskette im Gateway — **und zeigt davon im UI nichts.** Die
   Unterscheidung existiert im Schema und stirbt an der Oberfläche.

**Punkt 3 ist unser direkter Auftrag.** Wir haben `key_source` seit Migration
150. Helicone zeigt, dass die Spalte allein nichts bewirkt.

**Und OpenRouter zeigt, wie es richtig geht — drei Felder pro Aufruf:**
`is_byok` (der Schalter) · `total_cost` (was die Plattform berechnet) ·
`upstream_inference_cost` (was der Anbieter berechnet). Plus: **ein Aufruf kann
zwei Zahler haben** (Vercel: Fallback von eigenem auf Plattformschlüssel wird
dem Guthaben berechnet). Wer „wer hat bezahlt" als *ein* Feld modelliert, kann
das nicht abbilden.
