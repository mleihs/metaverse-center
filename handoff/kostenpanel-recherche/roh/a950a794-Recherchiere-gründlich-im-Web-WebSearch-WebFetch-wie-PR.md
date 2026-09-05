# AUFTRAG

Recherchiere gründlich im Web (WebSearch + WebFetch), wie PREMIUM-PRODUKTE dichte Zahlen und Nutzungs-/Kostendaten im Interface darstellen. Es geht mir um INTERFACE-QUALITÄT und Informationsdichte, nicht um das Fachthema.

Produkte:
1. Vercel Usage / Observability (vercel.com/docs/observability, /usage) — welche Kacheln, welche Charts, wie werden Kontingent-Verbrauch und Overage gezeigt, "included vs. on-demand"
2. Railway Usage/Metrics (docs.railway.com) — Usage-Seite, Kosten pro Service, Prognose ("estimated cost this month")
3. Stripe Dashboard Home / Reports / Sigma — KPI-Zeile, Sparklines, Vergleich zur Vorperiode, "compared to previous period" Darstellung
4. Linear Insights — welche Diagrammtypen, Gruppierung/Slice-by, Dichte
5. PostHog Insights/Web Analytics — Trends, Funnels, Tabellen, "sampling"-Hinweise, Vergleichszeitraum
Optional falls Zeit: Datadog Dashboards (Top List, Query Value, Change-Widget), Grafana (Stat panel, sparkline, thresholds), Cloudflare Analytics, Plausible.

Für JEDES will ich KONKRET, belegt mit URLs:
- Kopfkacheln: welche Kennzahlen, mit oder ohne Sparkline, mit Delta gegen Vorperiode (Pfeil/Prozent/Farbe)?
- Hauptdiagramm: Typ, Granularität, gestapelt vs. gruppiert
- Tabellen: welche Spalten, Sortierung, Inline-Balken in Zellen (Bar-in-Table)?
- Interaktionen: Hover-Tooltip-Inhalt (nur ein Wert oder alle Serien?), Zeitraumwahl-Presets, Vergleich zur Vorperiode (Geisterlinie? zweite Serie? gestrichelt?), Drill-down, Legend-Klick zum Isolieren


---

Alle Recherchen sind zurück. Hier das Ergebnis.

---

# Dichte Zahlen- und Kosten-Darstellung in Premium-Interfaces

## Vorbemerkung zur Beweislage (bitte zuerst lesen)

Die Doku-Qualität ist bei diesem Thema systematisch schlecht: Fast alle Hersteller beschreiben **funktional** (was man einstellen kann), nicht **visuell** (wie es aussieht). Ich habe deshalb drei Evidenzstufen getrennt und markiere sie durchgehend:

- **(a) Doku-Prosa** – zitierfähiger Text
- **(b) Doku-Screenshot** – Bild in der offiziellen Doku, teils heruntergeladen und angesehen
- **(c) Marketing-/Changelog-Material** – Produktvideo oder Blog, kein Doku-Stand
- **(d) Quellcode** – bei PostHog und Plausible (beide Open Source) direkt verifiziert. Das ist die härteste Evidenz im ganzen Bericht.
- **nicht belegt** – steht überall dort, wo ich nichts gefunden habe. Ich habe nichts ergänzt, was plausibel klingt.

Zwei Einschränkungen ausdrücklich: Das **Railway-Usage-Panel** kenne ich nur aus einem Changelog-**Video** (2024), nicht aus der Doku – der Doku-Screenshot dort ist von 2021 und veraltet. Die **Stripe-KPI-Kacheln** stammen aus einem Doku-Screenshot der *Payments-Analytics*-Seite, **nicht** von der Home-Startseite; Home selbst ist in der Doku nur als Widget-Baukasten beschrieben, ohne feste KPI-Zeile. Das Websuche-Budget der Sitzung war ausgeschöpft, ich habe mit gezielten Direktabrufen und den GitHub-Repos gearbeitet.

---

## 1. Vercel Usage / Observability

**Kopfkacheln.** Es gibt einen **„allotment indicator"** in der Übersicht: *„It shows how much of your usage you've consumed in the current cycle and the projected cost for each item."* (a) Ob das ein Balken, ein Ring oder reiner Text ist, sagt die Doku **nicht**. Sparklines: nicht belegt. Delta gegen Vorperiode: nicht belegt.
→ https://vercel.com/docs/pricing/manage-and-optimize-usage

**Hauptdiagramm.** Im Monitoring explizit umschaltbar: *„Use filters to adjust the date, data granularity, and chart type (line or bar)."* (a) Speed Insights ist ein Zeit-Liniendiagramm, Standard P75, zuschaltbar P90/P95/P99 als weitere Linien. (a)
→ https://vercel.com/docs/query/monitoring · https://vercel.com/docs/speed-insights

**Der interessanteste Teil – die „Viewing Options".** Pro Metrik gibt es fünf Sichten auf dieselbe Zahl: **Count / Project / Region / Ratio / Average**. „Ratio" ist dabei die eigentliche Kompositionsdarstellung, mit fest definierten Gegensatzpaaren je Metrik (a):

| Metrik | Ratio-Zerlegung |
|---|---|
| Requests | cached vs uncached |
| Fast Data / Origin Transfer | incoming vs outgoing |
| Function invocations + execution | successful vs errored vs timed out |
| Builds | completed vs errored |
| Remote Cache Artifacts | uploaded vs downloaded |

„Average" ist ausdrücklich der Mittelwert über ein 24-Stunden-Fenster. Das ist ein sehr übertragbares Muster: **eine Metrik, fünf Linsen** statt fünf Kacheln.

**Tabellen.** Routenliste nach **Error Rate** oder **Duration** umsortierbar (a). Web-Analytics-Panels zeigen Top-Einträge *„either as a number or percentage of the total visitors"* (a). Inline-Balken in Zellen: nicht belegt.

**Interaktionen.** Hover liefert eine Zusammenfassung für das Granularitäts-Fenster (*„if the data granularity is set to 1 hour, each point in time will provide a one-hour summary"*) – ob ein oder alle Serien: nicht belegt. Aufziehen mit der Maus + „Zoom In"-Button. Drill-down mehrfach belegt (Route → Function-Detail; AI Gateway per Projekt/Modell; Queues bis auf Consumer-Ebene). Zeitraum: **Billing-Cycle-Dropdown** plus „Last 30 days", zusätzlich Projekt-Dropdown. Vorperiodenvergleich, Legend-Isolation: nicht belegt.

**Laufende Periode:** nicht belegt. **Prognose:** ja, *„the projected cost for each item"*. **Kein-Wert vs. Null:** nicht belegt. **Overage:** textlich belegt (75%-Schwelle des Guthabens, dann On-Demand; Spend Management mit 50/75/100%-Schwellen), visuell nicht belegt.
→ https://vercel.com/docs/spend-management · https://vercel.com/docs/plans/pro-plan

---

## 2. Railway Usage / Metrics

Die vorgegebenen Doku-Pfade sind tot; aktuell sind `/projects/project-usage`, `/observability/metrics`, `/pricing/*`.

**Kopfkacheln** (c, Changelog-Video in Einzelbilder zerlegt). Panel mit Titel „May 30 to Jun 30 Usage" und Link „Show Breakdown". Links eine reine **Textliste**: Current Usage · Member Seats · Included Usage · Credits Available. Rechts **zwei große Zahlen-Kacheln nebeneinander: „Current Usage" und „Estimated Bill"**. Darunter Button „Set usage limits". **Keine Sparklines, kein Delta, kein Pfeil, kein Prozentwert** – ausschließlich absolute Dollarbeträge.
→ https://railway.com/changelog/2024-06-21-improved-cost-charts

**Hauptdiagramm.** Beim Aufklappen einer Projektzeile erscheinen **vier separate, vollbreite Charts untereinander**: CPU, RAM, Network Egress, Volume. Je eine Serie, **nicht gestapelt** – klassische Small Multiples. Im Service-Metrics-Tab: Presets **1h / 6h / 1d / 7d / 30d**, Layout-Umschalter (Liste vs. 2×2-Raster) und pro Chart ein **„Sum / Replicas"-Umschalter**; in der Replica-Ansicht wird jede Replica eine eigene farbige Linie mit benannter Legende. (b)
→ https://docs.railway.com/observability/metrics

**Tabelle.** „Project Cost": **Ressource | Menge (mit Einheit, z. B. „minutely GB") | Preis/Einheit | Betrag**, rechtsbündig, Fußnote *„Metrics are shown as minutely accumulated values."*, oben rechts Link „View Cost by Service". Keine Inline-Balken, Sortierpfeile nicht sichtbar.

**Interaktionen.** Einziger belegter Tooltip: die **gestrichelte vertikale Deployment-Markierung** im Metrics-Chart, Tooltip = Zeitstempel + Commit-Nachricht (b). Drill-down über drei Stufen: Workspace → Projekt aufklappen → „View Cost by Service". Vorperiodenvergleich existiert nur als CLI-Parameter (`--period previous|current|YYYY-MM`), nicht als Overlay.

**Laufende Periode:** nicht belegt. **Kein-Wert vs. Null:** nicht belegt – eine 0-%-CPU-Linie sieht aus wie eine normale Linie am unteren Rand.

**Prognose – hier ist Railway die Referenz.** Der Begriff heißt **„Estimated"** bzw. **„Estimated Bill"** und steht **auf drei Ebenen jeweils direkt neben dem Ist-Wert**: Workspace, Projekt, Service. Doku wörtlich: *„The Current and Estimated cost metrics show the current resource usage and the estimated usage by the end of the billing period."* (a) Die **Berechnungsmethode ist nirgends dokumentiert** – nicht belegt.
→ https://docs.railway.com/projects/project-usage · https://railway.com/changelog/2022-12-23-estimated-project-usage

**Guthaben/Overage:** In **keinem** der acht geprüften Screens ein Fortschrittsbalken. Durchgehend benachbarte oder abgezogene Dollarbeträge („Included Usage $0.00", „Credits Available $343.83", auf der Rechnung „Pro plan included usage ($20.00 off)").

---

## 3. Stripe Dashboard / Reports / Sigma

**Home ist ein Widget-Baukasten**, keine feste KPI-Zeile: „Ihre Übersicht" → **Hinzufügen** → Widgets an/aus → **Übernehmen**. Welche Widgets es gibt, wird nicht aufgezählt. (a)
→ https://docs.stripe.com/dashboard

**KPI-Kacheln** (b, Screenshot der *Payments-Analytics*-Seite, gleiches Design-System): drei Kacheln „Key metrics" mit Metrikname, großer Zahl und **farbigem Delta-Prozentwert (grün bei +, rot bei −)**. **Keine Sparkline in der Kachel.** Stattdessen macht ein Klick auf eine Kachel (blaue Umrandung = ausgewählt) diese zur Quelle für das große Chart darunter. Die Kachel ist also **Selektor, nicht Vorschau** – ein sehr sparsames Dichte-Muster.
→ https://docs.stripe.com/payments/analytics

**Vorperiode – der klarste Beleg im ganzen Bericht** (b, Screenshot): eine **zweite, hellgraue gepunktete/gestrichelte Linie** hinter der durchgezogenen farbigen Ist-Linie, mit **expliziter Legende: „Current period" (violettes Quadrat) / „Previous period" (helles graues Quadrat)**. Textlich: *„Die Zeitreihe vergleicht den Kurs mit einem `previous_period`… Standardmäßig beginnt der Vergleichszeitraum direkt vor dem gewählten Zeitraum und stellt die gleiche Zeitspanne dar."* (a)
→ https://docs.stripe.com/payments/analytics/acceptance

**Granularität/Presets** (b): Dropdown „Weekly"/„Daily"; Presets „Last 3 months", „Last 7 days", plus freies Datumsfeld.

**Laufende Periode – ebenfalls belegt, aber nur in Revenue Recognition:** *„Monatsdiagramme verwenden Farben, um zwischen offenen und abgeschlossenen Abrechnungszeiträumen zu unterscheiden. Zahlen in offenen Perioden ändern sich fortlaufend, bis die Periode geschlossen wird."* (a) Das ist **Farbe statt Strichelung** – die einzige Variante dieser Art im Sample.
→ https://docs.stripe.com/revenue-recognition/reports

**Daten-Lag wird konsequent beziffert** (a): 4 Stunden (Revenue Recognition), Balance-Reports ~12 h nach 00:00 UTC, Acceptance-Analyse täglich 12:00–23:59 UTC, Sigma-Zeitpläne „in der Regel bis 14:00 UTC" – und Sigma hat dafür einen eigenen Abfrageparameter **`data_load_time`**, der den Datenstand markiert.

**Prognose: nein, und ausdrücklich nicht.** Das „Wasserfalldiagramm zum Umsatz" zeigt künftig zu realisierenden Umsatz aus **bereits erfolgten** Abrechnungen; die Doku stellt klar: *„Dabei werden keine zukünftigen Abrechnungen modelliert und auch keine zukünftigen Umsätze… prognostiziert."*

**Sigma** ist SQL + Ergebnistabelle mit **optionaler** Diagrammschicht: Header-Klick sortiert, Spaltenbreite verstellbar, 1.000 Zeilen sichtbar / CSV unbegrenzt; Chart (Linie oder Balken, freie X/Y, Gruppierung nach Spalte) nur bei <10.000 Zeilen; KI-Assistent im Editor; geplante Abfragen mit E-Mail/Webhook. **Sigma-„Kennzahlengruppen"** sind die einzige Stripe-Stelle mit **echter Sparkline** unter der großen Zahl (Linie, Balken oder gestapelter Balken). (b)
→ https://docs.stripe.com/data/how-sigma-works · https://docs.stripe.com/data/write-queries

**Kein-Wert vs. Null / Empty States:** nicht belegt.

---

## 4. Linear Insights

**Das Vokabular ist der eigentliche Fund.** Drei Achsen mit festen Namen (a):
- **Measure** = y-Achse
- **Slice** = x-Achse
- **Segment** = optionale Farbdimension, wörtlich: *„Segments are optional and use color to slice the data further."*

Also **zwei Dimensionen kombinierbar** (Slice + Segment), und es gibt kein „Group by" – das heißt hier „Slice". Welche Werte wählbar sind, ist bewusst nicht fix: *„Values for Measure, Slice, and Segment vary depending on what issues are displayed in your view."*

**Chart-Typen** (a), exakt drei: **Bar**, **Scatterplot**, **Burn-up charts, or cumulative flow diagrams**. Dazu **immer eine Tabelle unter dem Graphen**. Dashboards ergänzen **„metric blocks"** (Einzelzahl-Kacheln): *„Combine charts, metric blocks, and tables in a single layout."* Kein Pie, kein Donut.

**Measures** mit zugehörigem Standardtyp: Issue count (Bar), Effort/Total estimate (Bar), Cycle Time, Lead Time, Triage Time, Issue Age (alle Scatterplot).

**Granularität:** nur bei Burn-up dokumentiert – Standard monatlich, umstellbar auf „week over week".

**Tooltip:** *„Hover over each bar to see data and percentile breakdowns"*; beim Scatterplot Marker für 25/50/75/95%; Punkt-Hover zeigt Issue-Name, ID, Slice- und Segment-Wert. Ob ein segmentierter Balken alle Segmente gleichzeitig zeigt: nicht belegt.

**Drill-down – vorbildlich und bidirektional** (a): *„Select full bars or segments to temporarily filter your view to only those issues"*, *„Select points to open the related issue"*, auf Dashboards *„click any slice or metric to open a filtered view of the underlying issues."* Zusätzlich hebt Hover auf einem Balken die zugehörige Zeile in der Tabelle darunter hervor – und umgekehrt. Ein separates Legenden-Element zum Isolieren: nicht belegt.

**Vorperiodenvergleich, laufende Periode, Empty State: alle nicht belegt.** Ein Delta-/Sparkline-Muster taucht nur als *Empfehlung* im Blog auf (*„with a simple chart showing this week, last week, and trailing highs and lows"*), nicht als dokumentierte Funktion (c).
→ https://linear.app/docs/insights · https://linear.app/docs/dashboards · https://linear.app/now/dashboards-best-practices

---

## 5. PostHog Insights / Web Analytics

Hier ist die Doku dünn, aber das Frontend ist Open Source – ich habe die entscheidenden Punkte **im Quellcode verifiziert (d)**.

**Chart-Typen** (a), mit exaktem Stapelverhalten:

| Typ | Verhalten bei Breakdown |
|---|---|
| Line (linear) | separate Linien |
| Line (cumulative) | laufende Summe |
| **Bar (time series)** | *„will appear stacked"* – **gestapelt** |
| **Area** | *„behave like a stacked bar chart"* |
| Number | Total / Average / Latest wählbar |
| Bar (total value) | separate Balken, optional **„Stack breakdown values"** |
| Pie, Table, World map | – |

→ https://posthog.com/docs/product-analytics/trends/charts

**Laufende Periode – gestrichelter Schwanz, nicht ganze Linie.** Doku: *„a dotted line indicated the data for that period is still being collected."* (a) Der Quellcode ist präziser (d): `computeDashedFromIndex()` berechnet aus `incompletenessOffsetFromEnd < 0` den Index, ab dem gestrichelt wird, und setzt `stroke: { partial: { fromIndex: dashedFromIndex } }`. Also **nur das Endstück ab dem ersten unvollständigen Bucket**, nicht die ganze Serie. Ausgenommen sind Stickiness **und die Vergleichsserie**:
`const isActiveSeries = !r.compare || r.compare_label !== 'previous'`
→ `products/product_analytics/frontend/insights/trends/TrendsLineChart/trendsChartTransforms.ts`

**Vorperiode – gedimmt, nicht gestrichelt.** Serien mit `compare_label === 'previous'` werden in eine Map `comparisonOf` eingetragen, die an **`applyComparisonDimming`** geht (d). Bei anderen Chart-Typen anders gelöst (a): Number-Chart hat das Label **„Compare to previous period"** und zeigt eine **„percentage change pill"**; die Table-Ansicht zeigt Vergleichswerte *„in a dedicated column next to the current values"*.

**Tooltip – alle Serien, sortiert, klickbar** (d, `InsightSeriesTooltip.tsx`): eine Zeile pro Serien-Entität mit Datums-Kopfzeile; Flag **`sortedByValue`** – *„Sort rows by value descending. Pass false to preserve visual top-to-bottom order."*; bei Namensgleichheit wird ein Serien-Buchstabe vorangestellt (`'none' | 'name' | 'letter-and-name'`); `onRowClick` pro Zeile; Fußzeile „click to view X". Für Breakdown + Compare gilt laut Kommentar: *„breakdown truncates; period label is always fully visible"* – die Periodenbeschriftung wird also **nie** weggekürzt.

**Breakdown-Grenze und „Other".** Doku (a): *„PostHog only loads the first 25 values of a breakdown"* plus Button **„Load more breakdown values"**. Quellcode (d) ergänzt, was die Doku verschweigt: `BREAKDOWN_VALUES_LIMIT = 25`, `BREAKDOWN_VALUES_LIMIT_FOR_COUNTRIES = 300`, und es existieren **zwei getrennte Sammel-Label**: `BREAKDOWN_OTHER_STRING_LABEL` (abgeschnittener Rest) und `BREAKDOWN_NULL_STRING_LABEL` (Eigenschaft fehlt) – plus ein Schalter `BREAKDOWN_HIDE_OTHER_AGGREGATION`. Das ist genau die Unterscheidung „zusammengefasst" vs. „kein Wert vorhanden".
→ `posthog/hogql/constants.py`, `posthog/constants.py`

**Legende und Drill-down** (a): *„you can click the checkbox next to any series to toggle its visibility"*, plus Rechtsklick-Menü **„Hide other series" / „Show all series" / „Hide all series"**. Klick auf einen Datenpunkt öffnet das **Persons-Modal** mit der Nutzerliste dahinter → Session-Replays, Properties, als Cohort speichern, CSV. Im Code: `scenes/trends/viz/datasetToActorsQuery.ts`.
→ https://posthog.com/docs/product-analytics/trends/tips

**Web Analytics** (a): Kacheln Visitors / Views / Sessions / Ø Session Duration / Bounce Rate – *„Each of these is compared with the previous time range, showing how much they increased or decreased."* Paths-Tabelle mit views, visitors, bounce rate, scroll depth; Klick auf einen Pfad filtert das **ganze** Dashboard. **Inline-Balken in Zellen: nicht belegt. Spaltensortierung: nicht belegt.**
→ https://posthog.com/docs/web-analytics/dashboard

**Sonstiges:** Standard-Zeitraum „last 7 days", Gruppierung Sekunde → Monat, Glättung als 7- oder 28-Tage-Gleitmittel. **Sampling-Kennzeichnung in der UI: nicht belegt** (alle vermuteten Doku-Pfade 404). **Empty State: nicht belegt.**

---

## 6. Optional: Grafana, Datadog, Plausible, Cloudflare

### Plausible – quellcodeverifiziert, und das sauberste Vorbild im ganzen Sample

**Balken in der Tabellenzelle** (d): `assets/js/dashboard/stats/bar.js` legt ein absolut positioniertes `div` **hinter** die Zeile, `width = count / max(all) * 100 %`. Das ist die kanonische Bar-in-Table-Implementierung, in 30 Zeilen.

**Zwei Linienstile mit zwei verschiedenen Bedeutungen** (d) – der wichtigste Befund:
```
mainPathClass       = 'stroke-indigo-500 …'
comparisonPathClass = 'stroke-[rgb(222,221,255)] …'   // Geisterlinie, hell, DURCHGEZOGEN
dashedPathClass     = '[stroke-dasharray:3,3]'        // nur für 'current'
```
Die Vergleichsperiode ist eine **helle Geisterlinie in derselben Form**, nicht gestrichelt. Gestrichelt ist **ausschließlich** das Segment, das in den laufenden Zeitraum führt. Kommentar im Code: *„When a point of data is 'current' (only the last point of the series can be), then the line that connects it is dashed."*

**Kein Wert vs. Null** (d): Jeder Punkt trägt ein `isDefined`-Flag. *„A full line is drawn only between two or more continuous full periods. No line is drawn from or to gaps in the data."* Eine Null wird auf 0 gezeichnet, eine Lücke **unterbricht die Linie**. Im Tooltip wird ein Teil-Bucket zusätzlich **in Worten** benannt: `Partial of {month}` bzw. `Partial week of {date}`.

**Tooltip** (d): Kopfzeile mit Metrikname + `<ChangeArrow>` (Delta), darunter eine Zeile mit farbigem Punkt + Bucket-Label + Ist-Wert, darunter eine Zeile mit **grauem** Punkt + Vergleichs-Bucket-Label + Vergleichswert. Also **Ist, Vorperiode und Delta in einem Tooltip**.

**Division durch null ist gelöst** (d): `getRelativeChange` gibt bei Vergleichswert 0 und Ist > 0 exakt `100` zurück, bei 0/0 exakt `0` – nie `Infinity` oder `NaN`.

Doku (a) ergänzt: Vergleichsmodi **Previous period / Year over year / Custom period**, dazu **„Match day of week"** vs. „Match exact date"; *„The main chart shows both date ranges as separate lines"*; KPI-Kacheln zeigen *„percentage changes (with up/down arrows)"*; Breakdown-Tabellen zeigen den Vergleich **im Hover-Tooltip der Zeile**. „Current visitors" = letzte 5 Minuten, klickbar, **ignoriert alle Filter**.
→ https://plausible.io/docs/compare-stats · https://plausible.io/docs/metrics-definitions · https://plausible.io/docs/top-pages

### Grafana – die beste dokumentierte Optionsmatrix

**Stat panel** (a): **Graph mode** `None` / `Area` (*„Shows the graph sparkline in the background of the value. This requires that your query returns a time column."*). **Color mode** `None` / `Value` / `Background Gradient` / `Background Solid`. **Text mode** Auto / Value / Value and name / Name / None. **Show percent change** mit **Percent change color mode**: `Standard` (grün bei positiv) / **`Inverted`** (rot bei positiv) / `Same as Value` – das ist der „Anstieg ist schlecht"-Schalter, den fast alle vergessen.
→ https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/stat/

**Tooltip explizit konfigurierbar** (a): **Tooltip mode** `Single` (nur die gehoverte Serie) / `All` (alle Serien, die gehoverte **fett**) / `Hidden`; bei „All" zusätzlich **Values sort order** None / Ascending / Descending; **Hover proximity** in Pixeln.

**Kein Wert vs. Null, doppelt gelöst** (a): **Connect null values** `Never` / `Always` / `Threshold` – *„Null values represent data gaps (missing points), distinct from zeros (actual measurements)"*, plus **Disconnect values** für die Gegenrichtung. Und in den Standard-Optionen: **„No value" – *„Enter what Grafana should display if the field value is empty or null. The default value is a hyphen (-)."*** Das ist die knappste Antwort auf die Frage überhaupt: kein Wert = `-`, Null = `0`.
→ https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/ · https://grafana.com/docs/grafana/latest/panels-visualizations/configure-standard-options/

**Stack series** Off / Normal / **100%**.

**Tabelle mit Balken in der Zelle** (a): Cell types Auto, Colored text, Colored background (optional auf die ganze Zeile), Data links, **Gauge** (*„Values are displayed as a horizontal bar gauge"*, Modi **Basic / Gradient / Retro LCD**, Wertanzeige Value color / Text color / Hidden), **Sparkline**, JSON View, Pill, Markdown+HTML, Image. Header-Klick zykliert default → descending → ascending; Spaltenfilter über ein Trichter-Icon; „Inspect value"-Drawer pro Zelle. Bar gauge separat mit **„Show unfilled area"** (Restkapazität grau, nicht bei Retro LCD) und **Name placement** Auto/Top/Left/Hidden.
→ https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/table/ · .../bar-gauge/

### Datadog – die reichhaltigsten Vergleichs-Widgets

**Query Value** (a): Timeseries-Hintergrund hinter der Zahl in drei Varianten – **„Min to Max" / „Line" / „Bars"**. **Visual formatting rules** (Hintergrundfarbe, Schriftfarbe, eigene Bilder). Autoformat + Nachkommastellen. Und ein **Change Indicator** mit drei orthogonalen Achsen: **Display** `Relative Change` / `Absolute Change` / **`Both`** / `Off` · **Color** `Increases as better` / `Decreases as better` / `Neutral` · **Compared to** `Previous Period` / `Previous Day/Week/Month` / `Custom`.
→ https://docs.datadoghq.com/dashboards/widgets/query_value/

**Change widget** (a): „Compare to" = an hour / a day / a week / a month before; Change type **Relative** vs. **Absolute**; Sortierung nach `change` / `name` / `present value` / `past value`, auf- oder absteigend; im API-Schema `increase_good`. Die konkrete visuelle Umsetzung (Pfeil, Farbton) ist **nicht dokumentiert**.
→ https://docs.datadoghq.com/dashboards/widgets/change/

**Table widget** (a): `cell_display_mode` mit **`number` / `bar` / `trend`** – also Inline-Balken **und** Trend-Sparkline in der Zelle. **Column Formatting Rules**: Threshold-, Range-, Text-Alias- und Trending-Formatierung.
→ https://docs.datadoghq.com/dashboards/widgets/table/

**Top List** (a): **Stacked** (Standard) vs. **Flat**, **Relative** (Prozent, nur bei Count-Daten) vs. **Absolute**. Inline-Balken pro Zeile: **nicht ausdrücklich dokumentiert.**

**Timeseries** (a): lines / areas / bars; Linien-**Style solid / dashed / dotted**, **Stroke normal / thin / thick**; automatische Beschriftung von Peaks und Tälern, max. drei Labels pro Serie; **„Compare Time"-Tab** mit Offset Period / Day / Week / Month / Custom und zwei Ansichtsmodi: **„Grid"** (nebeneinander) oder **„Overlay"** (beide Perioden in einem Graphen).
→ https://docs.datadoghq.com/dashboards/widgets/timeseries/

### Cloudflare

Weitgehend **nicht belegt**. `/web-analytics/` ist eine Marketing-Übersicht ohne UI-Beschreibung; die Analytics-FAQ behandelt Datenerhebung und Abweichungen zu anderen Tools, **nicht** die Kennzeichnung gesampelter Daten. Einzige UI-Aussage, die ich gefunden habe: *„To change the time period, use the dropdown menu on the right-hand side above the graph"* plus Ziehen zum Zoomen – **ohne Preset-Namen**. Kopfkacheln mit Deltas, Sampling-Hinweis, Tabellenspalten: alle nicht belegt.
→ https://developers.cloudflare.com/analytics/ · https://developers.cloudflare.com/analytics/faq/about-analytics/

---

## Querschnitt: die sieben Fragen über alle Produkte

**Laufende, unvollständige Periode.** Nur **zwei** der fünf Hauptprodukte tun überhaupt etwas – und beide sind Open Source, weshalb es überhaupt belegbar ist. **PostHog** strichelt **nur den Schwanz** ab dem ersten unvollständigen Bucket (`stroke.partial.fromIndex`), **Plausible** strichelt **nur das letzte Segment** (`stroke-dasharray:3,3`) und benennt den Bucket im Tooltip zusätzlich als „Partial of …". **Stripe** löst es als Einziges über **Farbe** (offene vs. abgeschlossene Abrechnungsperiode) statt Strichelung. Vercel, Railway, Linear, Datadog, Grafana: nicht belegt. **Niemand blendet den letzten Balken aus** – alle, die etwas tun, kennzeichnen ihn.

**Der Konflikt, den Sie beim Bauen lösen müssen:** Stripe nutzt **gepunktet + grau** für die **Vorperiode**, Plausible nutzt **gestrichelt** für **unvollständig** und **hellere Farbe** für die Vorperiode. Wer beides strichelt, macht die zwei Bedeutungen ununterscheidbar. Plausibles Trennung (Strichelung = Zeit unvollständig, Helligkeit = andere Periode) ist die konsistentere.

**Hochrechnung.** Nur **Railway** und **Vercel** – und beide zeigen sie als **Zahl direkt neben der Ist-Zahl**, nie als verlängerte Linie in die Zukunft. Railway: „Current Usage" | „Estimated Bill" als Kachelpaar, wiederholt auf drei Ebenen. Vercel: „projected cost for each item" im allotment indicator. Stripe hat ausdrücklich **keine** Prognose. Beide dokumentieren die Rechenmethode **nicht**.

**Kein Wert vs. Null.** Nur drei Belege im ganzen Sample: **Grafana** (`No value` → Standard `-`; `Connect null values` mit der expliziten Ansage, dass null ≠ 0), **Plausible** (`isDefined`, Linie bricht an Lücken ab), **PostHog** (getrenntes `NULL`- und `OTHER`-Label bei Breakdowns). Vercel, Railway, Stripe, Linear: nicht belegt. Das ist offenbar die am häufigsten übergangene Frage.

**Delta auf der Kachel.** Stripe: farbiger Prozentwert, grün/rot, ohne Sparkline. Plausible: Prozent + Auf/Ab-Pfeil. PostHog: Zu-/Abnahme pro Kachel, im Number-Chart als „percentage change pill". Grafana und Datadog machen es konfigurierbar – **und nur diese beiden bieten den Schalter „Anstieg ist gut oder schlecht"** (`Inverted` bzw. `Increases as better`). **Railway zeigt gar kein Delta**, nur absolute Beträge – bemerkenswert für ein Kostenprodukt.

**Sparkline in der Kachel.** Ja bei Grafana Stat („Graph mode: Area"), Datadog Query Value (Min-to-Max / Line / Bars) und Stripe **Sigma**-Kennzahlengruppen. **Nein** bei Stripes eigenen Key-Metrics-Kacheln – dort ist die Kachel stattdessen **Selektor für das große Chart**. Railway, Vercel, Linear: nicht belegt.

**Balken in der Tabellenzelle.** Belegt bei **Plausible** (quellcodeverifiziert), **Grafana** (Cell type „Gauge", drei Modi) und **Datadog** (`cell_display_mode: bar | trend`). Bei Vercel, Railway, Stripe, Linear und PostHog: nicht belegt.

**Tooltip: ein Wert oder alle Serien.** **Grafana** macht es zur Option (Single / All / Hidden + Sortierreihenfolge). **PostHog** zeigt alle Serien, eine Zeile je Entität, standardmäßig nach Wert absteigend, jede Zeile klickbar. **Plausible** zeigt Ist + Vorperiode + Delta zusammen. Linear zeigt bei Balken „data and percentile breakdowns", ob alle Segmente: nicht belegt. Vercel, Railway, Stripe: nicht belegt.

---

## Eine Zeile pro Produkt

| Produkt | Kopfkacheln | Hauptdiagramm | Achsen/Gruppierung | Besonderheit der Darstellung | Quelle |
|---|---|---|---|---|---|
| **Vercel Usage** | „Allotment indicator": Verbrauch im Zyklus + projizierte Kosten je Posten; **keine** Sparkline/Delta belegt | Linie **oder** Balken umschaltbar, Granularität als Filter; Aufziehen + „Zoom In" | Fünf Linsen auf dieselbe Metrik: **Count / Project / Region / Ratio / Average**; Ratio mit festen Gegensatzpaaren (cached vs uncached, successful vs errored vs timed out) | Prognose als **Zahl je Posten**, nicht als Linie; Overage nur über 50/75/100%-Schwellen und Mails, visuell nicht belegt | [manage-and-optimize-usage](https://vercel.com/docs/pricing/manage-and-optimize-usage) |
| **Railway Usage** | Zwei große Kacheln nebeneinander: **„Current Usage" / „Estimated Bill"**; **kein Delta, keine Sparkline**, nur absolute Beträge | Vier **separate** vollbreite Charts (CPU/RAM/Egress/Volume), **nicht gestapelt** – Small Multiples | Metrics-Tab: Presets 1h/6h/1d/7d/30d, Umschalter **„Sum / Replicas"** (je Replica eine benannte farbige Linie) | **„Estimated" steht auf drei Ebenen direkt neben dem Ist-Wert** (Workspace/Projekt/Service); Guthaben nie als Balken, immer als Textzeile | [project-usage](https://docs.railway.com/projects/project-usage), [changelog 2024-06-21](https://railway.com/changelog/2024-06-21-improved-cost-charts) |
| **Stripe Dashboard** | Drei „Key metrics"-Kacheln: Name, große Zahl, **farbiger Delta-Prozentwert** (grün/rot), **ohne** Sparkline – die Kachel ist **Selektor** fürs Chart darunter | Liniendiagramm; Granularität „Weekly/Daily", Presets „Last 3 months"/„Last 7 days" + Custom | Vorperiode als **zweite hellgraue gepunktete Linie** mit Legende **„Current period" / „Previous period"** | Offene vs. abgeschlossene Abrechnungsperiode werden **farblich** unterschieden; Daten-Lag überall beziffert (4 h, 12 h); Prognose ausdrücklich **nicht** vorhanden | [payments/analytics](https://docs.stripe.com/payments/analytics), [analytics/acceptance](https://docs.stripe.com/payments/analytics/acceptance), [revenue-recognition/reports](https://docs.stripe.com/revenue-recognition/reports) |
| **Linear Insights** | „Metric blocks" (Einzelzahl) auf Dashboards; Delta/Sparkline **nicht** dokumentiert | Drei Typen: **Bar**, **Scatterplot**, **Burn-up / cumulative flow** – dazu **immer** eine Tabelle unter dem Graphen | Festes Vokabular **Measure (y) / Slice (x) / Segment (Farbe)**; Burn-up monatlich oder „week over week" | Drill-down **bidirektional**: Balken/Segment anklicken filtert die Issue-Liste, Hover auf dem Balken hebt die Tabellenzeile hervor und umgekehrt | [docs/insights](https://linear.app/docs/insights), [docs/dashboards](https://linear.app/docs/dashboards) |
| **PostHog** | Web-Analytics-Kacheln Visitors/Views/Sessions/Duration/Bounce, jede **gegen den Vorzeitraum verglichen**; Number-Chart mit „percentage change pill" | Line (linear/kumulativ), **Bar time series (Breakdown gestapelt)**, Area (gestapelt), Number, Bar total value, Pie, Table, World map | Breakdown **Top 25** (Länder 300) + getrennte Sammel-Label für **„Other"** und **NULL**; Gruppierung Sekunde→Monat, 7-/28-Tage-Glättung | **Gestrichelt nur der Schwanz** ab dem ersten unvollständigen Bucket; Vorperiode wird **gedimmt**, nicht gestrichelt; Tooltip listet alle Serien nach Wert sortiert, jede Zeile klickbar → Persons-Modal | [trends/charts](https://posthog.com/docs/product-analytics/trends/charts), [trends/tips](https://posthog.com/docs/product-analytics/trends/tips), Quellcode `trendsChartTransforms.ts` |
| **Plausible** *(opt.)* | KPI-Kacheln mit **Prozent + Auf/Ab-Pfeil**; Klick schaltet die Hauptkurve um; „Current visitors" = letzte 5 min, filterunabhängig | Eine Kurve, Vergleichsperiode als **helle Geisterlinie** (`rgb(222,221,255)`), **durchgezogen** | Vergleichsmodi Previous period / Year over year / Custom + **„Match day of week"** | **Strichelung ausschließlich für das laufende Segment** (`stroke-dasharray:3,3`); **Lücke ≠ Null** (`isDefined`, Linie bricht ab); Tabellenzeilen mit Balken hinter dem Text (`width = value/max`) | [compare-stats](https://plausible.io/docs/compare-stats), Quellcode `main-graph.tsx`, `bar.js` |
| **Grafana** *(opt.)* | Stat panel: **Graph mode „Area"** = Sparkline hinter der Zahl; **„Show percent change"** mit `Standard` / **`Inverted`** / `Same as Value` | Time series: Lines/Bars/Points, **Stack series Off/Normal/100%** | **Tooltip mode Single / All / Hidden** + Values sort order – als einziges Produkt explizit konfigurierbar | **„No value" = `-` als Standard**, `Connect null values` trennt Lücke sauber von Null; Table cell type **„Gauge"** (Basic/Gradient/Retro LCD) und **„Sparkline"** in der Zelle | [stat](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/stat/), [time-series](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/), [table](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/table/) |
| **Datadog** *(opt.)* | Query Value mit Timeseries-Hintergrund **„Min to Max" / „Line" / „Bars"** + **Change Indicator** (Relative/Absolute/**Both**/Off) | Timeseries lines/areas/bars, Linien-Style **solid/dashed/dotted**, Stroke thin/normal/thick | **„Compare Time"-Tab**: Offset Period/Day/Week/Month/Custom, Ansicht **„Grid" (nebeneinander) oder „Overlay" (ein Graph)** | **`cell_display_mode: number \| bar \| trend`** – Balken **und** Trendlinie in der Tabellenzelle; Farbsemantik über `Increases as better` / `Decreases as better` / `Neutral` | [query_value](https://docs.datadoghq.com/dashboards/widgets/query_value/), [change](https://docs.datadoghq.com/dashboards/widgets/change/), [table](https://docs.datadoghq.com/dashboards/widgets/table/) |
| **Cloudflare** *(opt.)* | nicht belegt | nicht belegt | nicht belegt | Nur allgemein: Zeitraum-Dropdown rechts über dem Graphen + Ziehen zum Zoomen; **Sampling-Kennzeichnung nicht belegt** | [developers.cloudflare.com/analytics](https://developers.cloudflare.com/analytics/) |

---

**Was ich ausdrücklich nicht belegen konnte** und wo Sie deshalb eine eigene Design-Entscheidung treffen müssen, statt sich auf ein Vorbild zu berufen: Vercels tatsächliche Form des allotment indicator (Balken? Ring? Text?), jede Form von Vorperiodenvergleich bei Vercel, Railway und Linear, Railways und Vercels Behandlung des laufenden Tages, Kein-Wert-vs-Null bei Vercel/Railway/Stripe/Linear, PostHogs Sampling-Kennzeichnung und Inline-Balken in dessen Web-Analytics-Tabellen, sowie praktisch das gesamte Cloudflare-Interface.

**Sources:**
- [Vercel: Manage and optimize usage](https://vercel.com/docs/pricing/manage-and-optimize-usage) · [Observability](https://vercel.com/docs/observability) · [Monitoring](https://vercel.com/docs/query/monitoring) · [Speed Insights](https://vercel.com/docs/speed-insights) · [Spend Management](https://vercel.com/docs/spend-management)
- [Railway: Project usage](https://docs.railway.com/projects/project-usage) · [Metrics](https://docs.railway.com/observability/metrics) · [Understanding your bill](https://docs.railway.com/pricing/understanding-your-bill) · [Improved cost charts](https://railway.com/changelog/2024-06-21-improved-cost-charts) · [Estimated project usage](https://railway.com/changelog/2022-12-23-estimated-project-usage)
- [Stripe: Dashboard](https://docs.stripe.com/dashboard) · [Payments analytics](https://docs.stripe.com/payments/analytics) · [Acceptance](https://docs.stripe.com/payments/analytics/acceptance) · [Revenue recognition reports](https://docs.stripe.com/revenue-recognition/reports) · [How Sigma works](https://docs.stripe.com/data/how-sigma-works) · [Write queries](https://docs.stripe.com/data/write-queries)
- [Linear: Insights](https://linear.app/docs/insights) · [Dashboards](https://linear.app/docs/dashboards) · [Dashboard best practices](https://linear.app/now/dashboards-best-practices)
- [PostHog: Chart types](https://posthog.com/docs/product-analytics/trends/charts) · [Trends](https://posthog.com/docs/product-analytics/trends) · [Trends tips](https://posthog.com/docs/product-analytics/trends/tips) · [Breakdowns](https://posthog.com/docs/product-analytics/trends/breakdowns) · [Web analytics dashboard](https://posthog.com/docs/web-analytics/dashboard) · Quellcode: [PostHog/posthog](https://github.com/PostHog/posthog)
- [Plausible: Compare stats](https://plausible.io/docs/compare-stats) · [Metrics definitions](https://plausible.io/docs/metrics-definitions) · [Top pages](https://plausible.io/docs/top-pages) · Quellcode: [plausible/analytics](https://github.com/plausible/analytics)
- [Grafana: Stat panel](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/stat/) · [Time series](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/) · [Table](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/table/) · [Bar gauge](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/bar-gauge/) · [Standard options](https://grafana.com/docs/grafana/latest/panels-visualizations/configure-standard-options/)
- [Datadog: Query value](https://docs.datadoghq.com/dashboards/widgets/query_value/) · [Change](https://docs.datadoghq.com/dashboards/widgets/change/) · [Table](https://docs.datadoghq.com/dashboards/widgets/table/) · [Top list](https://docs.datadoghq.com/dashboards/widgets/top_list/) · [Timeseries](https://docs.datadoghq.com/dashboards/widgets/timeseries/)
- [Cloudflare Analytics](https://developers.cloudflare.com/analytics/) · [About Analytics FAQ](https://developers.cloudflare.com/analytics/faq/about-analytics/)