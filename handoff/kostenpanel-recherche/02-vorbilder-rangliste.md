---
title: "Die fünf Vorbilder, ECharts, Geldfluss, Monospace, Filter"
date: "2026-09-05"
type: recherche
lang: de
---

# Vorbilder für ein dichtes, dunkles Kostenpanel

**Methodischer Vorbehalt:** Websuch-Kontingent war vor Beginn erschöpft; alles aus
direkten Seitenabrufen und der GitHub-API. **Keine Bildauswertung möglich** — px-Werte
sind aus Doku oder Quellcode zitiert. Farbdisziplin und Rasterabstände von Vercel,
Stripe und Linear liegen nur in PNGs vor und wurden nicht gelesen. Geblockt (403/429):
Mobbin, Refero, Land-book, usgraphics.com (Berkeley Mono), Sourcegraph,
Cloudflare-Dashboard, Observable Framework.

## Platz 1 — Vercel AI Gateway Observability

<https://vercel.com/docs/ai-gateway/observability-and-spend/observability>

**Übernehmen:** Die Grundstruktur fast unverändert — vier Diagramme oben, darunter
mehrere Tabellen mit **identischen Spalten** je Aggregationsachse, plus
Verbrauchsbalken und hochgerechnete Kosten in derselben Zeile.
**Nicht übernehmen:** Vercels helle, luftige Kachelästhetik und die Beschränkung auf
zwei Aggregationsachsen — wir haben sechs.

- **Genau vier Diagramme:** Requests by Model, Time to First Token, Input/Output Token
  Counts, Spend.
- **Zwei Tabellen nebeneinander statt verschachtelt** — eine nach Projekt, eine nach
  API-Key, beide mit denselben Spalten: „request count, average tokens, P75 duration,
  P75 TTFT, and cost for the specified time frame". Das ist die Antwort auf
  „Welt vs. Schlüsselquelle": **zwei Tabellen, kein Umschalter.**
- **Zwei Geltungsbereiche** per Dropdown in der Kopfzeile: Team (alles) und Projekt
  (gefiltert, gleiche Metriken). Bei uns: Plattform vs. eine Welt.
- **Drilldown, vier Stufen:** Graph → Zeitraum per Klick-und-Ziehen markieren →
  „Zoom In" → Modellliste neu sortiert → Zeile klicken → Detailseite → Link zu Logs.
  Logs sind eine **eigene Seite**, kein Aufklapper.
- **Hochrechnung, wörtlich:** „you'll see an allotment indicator. It shows how much of
  your usage you've consumed in the current cycle and the projected cost for each item."
- **Fünf Ansichts-Umschalter pro Metrik:** Count, Project, Region, **Ratio**, Average.
  Ratio ist der interessanteste — dieselbe Zahl als Verhältnis: cached vs. uncached,
  successful vs. errored vs. timed out. Bei uns: Plattform-Schlüssel gegen eigenen
  Schlüssel, Bild gegen Text.

## Platz 2 — ECharts 6: Achsenbrüche + Matrix

**Übernehmen:** Den Achsenbruch für die 89/11-Schieflage und das
Matrix-Koordinatensystem für die Welten-mal-Modelle-Ansicht.
**Nicht übernehmen:** Die Vorgabewerte des Bruchbereichs
(`breakArea.itemStyle.color` ist `#fff` — ein weißer Streifen auf schwarzem Grund)
und den `dataZoom`-Slider (40 px grauer Streifen unter jedem Diagramm).

## Platz 3 — Zed + Vercel Geist + Linear: der Satz

**Übernehmen:** Die gemessenen Zahlen (15–16 px, Zeilenhöhe 1.3), die Geist-Tabellenregel
wörtlich, Linears Trennung von Mono und Sans.
**Nicht übernehmen:** Monospace für alles — ein komplett in Mono gesetztes Panel ist
ein Kostüm, kein Werkzeug.

- **Zed, dokumentiert:** `ui_font_size` **16 px**, `buffer_font_size` **15 px**,
  `buffer_line_height` `standard` = **1.3**, `comfortable` = **1.618**. Der einzige
  belastbare Zahlenanker der Recherche. Für ein Zahlenraster ist 1.3 der richtige Pol.
- **Geist Table, wörtlich:** „Apply `tabular-nums` (or Geist Mono) to numeric columns
  so digits align across rows." Also **entweder oder**. Zweite Regel derselben Seite:
  fehlende Werte als **Geviertstrich `—`**, nicht „N/A", nicht leer.
- **Geist-Farbsystem:** zehn Graustufen (`--ds-gray-100` … `-1000`), grob 100–300
  Hintergrund, 400–600 Rahmen, 700–1000 Text. Typografie-px: **nicht öffentlich.**
- **Linear:** Monospace ausschließlich für Issue-IDs und Codeschnipsel, sonst Sans.
  Übertragen: Modell-Slugs, Aufruf-IDs, Schlüssel-Präfixe, USD-Beträge in Mono —
  alles Erklärende in Sans.

## Platz 4 — AWS Cost Explorer + Azure Cost Analysis: die Hochrechnung

**Übernehmen:** Ein Band statt einer Linie, plus die Prognosezahl neben der Summe,
plus AWS' Sperre gegen Extrapolation aus zu wenig Historie.
**Nicht übernehmen:** Die Vorstellung, die Zeichnung erledige die Hochrechnung — alle
drei Hyperscaler stellen die Prognose **als Zahl** neben die Summe; das Band ist Beiwerk.

- **AWS:** 80-Prozent-Prognoseintervall, bei Linien als zwei zusätzliche Linien, bei
  Balken als zwei Linien am oberen Balkenrand. **Kein Forecast bei weniger als einem
  vollen Abrechnungszyklus Historie.**
- **Azure:** Forecast nur bei Flächen- oder gestapeltem Säulendiagramm, *time series
  linear regression*, Einmalspitzen filterbar. Bei gesetztem Budget wird angezeigt,
  **wann** die Prognose es überschreitet.
- **GCP:** Prognose **hellgrau eingefärbt**, nicht gestrichelt.
- Gemeinsames Muster: **keiner der drei benutzt eine gestrichelte Linie als alleiniges
  Signal**, und alle drei zeigen den Vormonatsvergleich als **Prozentzahl neben der
  Summe**.

## Platz 5 — Bloomberg Terminal + Lipgloss: die Disziplin

**Übernehmen:** Drei bis vier Farben, jede mit fester Bedeutung quer über das ganze
Panel; Zeilenunterscheidung über Hintergrund statt Gitterlinien.
**Nicht übernehmen:** Bernstein-auf-Schwarz als Look — das war eine Phosphor-
Notwendigkeit der Röhrenzeit, kein Designprinzip.

- **Bloomberg:** eigene Tastatur mit Farbcode statt Beschriftung, typischerweise vier
  Panels pro Monitor. Die Lehre ist nicht die Optik: **Farbe ist Datenklasse, nicht
  Dekor.** Replicate hat eine Farbe, OpenRouter eine — und die gilt in Balken, Tabelle,
  Legende, Abzeichen, überall.
- **Lipgloss:** `StyleFunc(row, col)`, Zeilenunterscheidung über **Hintergrundfarbe**,
  Rahmen-Presets plus **selektive Kanten** (`BorderTop(true)`). Eine Linie da, wo sie
  trennt, keine, wo sie nur Rauschen ist.

## ECharts im Kern

**Taugt für Kosten:** Gestapelte Balken über Zeit (Arbeitspferd, aber nur die unterste
Kategorie hat eine echte Nulllinie — bei 5 Zwecken sind 4 Bänder schlecht vergleichbar).
Kalender-Heatmap (die einzige Form, in der 21 Welten × 365 Tage auf einen Schirm passen;
zeigt Rhythmus, nicht Betragshöhe). Achsenbrüche. Matrix.

**Taugt nicht:** **Sunburst** — äußere Ringe haben noch weniger Fläche als eine Treemap
und noch schwerer vergleichbare Winkel. **themeRiver** — schön, für Beträge unlesbar.
Beide weglassen.

### Der Achsenbruch (`bar-breaks-simple`, `since: 6.0.0`)

```js
yAxis: { type: 'value',
  breaks: [{ start: 5000, end: 100000, gap: '1.5%' }],
  breakArea: { itemStyle: { opacity: 1 } } }
```

Weitere Schlüssel: `breaks[].isExpanded`, `breakArea.itemStyle.color`
(**Vorgabe `#fff`, auf dunkel zwingend überschreiben**), `.borderColor` (`#b7b9be`),
`zigzagAmplitude` (4), `zigzagMinSpan` (4), `zigzagMaxSpan` (20), **`expandOnClick`**
(Vorgabe `true`). Der Bruch ist selbst die Aussage: „hier ist eine Größenordnung
übersprungen" — und ein Klick stellt die wahren Proportionen her.

### Matrix (`matrix-sparkline`, `since: 6.0.0`)

Eine echte Tabelle, deren Zellen Diagramme sind: `matrix.x.data`, `matrix.y.data`,
`levelSize`, `corner`, `body` mit `mergeCells`. 21 Welten in Zeilen, 6 Modelle in
Spalten, je Zelle ein Sparkline. Dicht, tabellarisch und grafisch zugleich, und kein
bisschen nach Vorgabe-ECharts. **Der stärkste Einzelhebel der Recherche.**

### Interaktionskomponenten, bewertet

- **`dataZoom`** — ja, aber `type: 'inside'`, **nicht** `slider`.
- **`tooltip.axisPointer`** — das Wichtigste. `trigger: 'axis'`,
  `axisPointer: { type: 'cross', animation: false }`. `animation: false` ist
  entscheidend, ein nachziehendes Fadenkreuz ist bei dichten Zahlen Rauschen.
  TradingViews Verhalten ist präziser als ein schwebender Kasten: Werte erscheinen
  **als Label auf beiden Achsen** (`axisPointer.label`).
- **`markLine`** — ja, für die Hochrechnung. `{ type: 'average' }`,
  `{ yAxis: <Budget> }`; `lineStyle.type: 'dashed'`, `label.formatter`,
  **`silent: true`** (sonst fängt die Linie Mausereignisse ab). `markArea` schattiert
  „Rest des Monats".
- **`visualMap`** — nur für Kalender-Heatmap und Treemap-Färbung. Für Balken über Zeit
  falsch: Farbe trägt dort die Kategorie, nicht den Betrag.
- **`brush`** — **nein.** brush wählt aus und hebt hervor, ohne die Achsen zu ändern;
  `dataZoom` ändert den Ausschnitt. Für Zeitraumwahl ist `dataZoom` richtig.

### Der korrigierte Code-Ausschnitt

```js
grid: {
  left: 0, right: 0, top: 8, bottom: 0,
  outerBoundsMode: 'same',          // containLabel ist seit 6.0.0 abgekuendigt
  outerBoundsContain: 'axisLabel'
},
xAxis: {
  axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false },
  axisLabel: { fontFamily: 'var(--font-mono)', fontSize: 11, margin: 12 }
},
yAxis: {
  axisLine: { show: false }, axisTick: { show: false },
  splitLine: { lineStyle: { type: 'dashed', width: 1 } },
  axisLabel: { formatter: (v) => '$' + v.toFixed(0) }
},
legend: { show: false },            // die Tabelle daneben IST die Legende
tooltip: { trigger: 'axis', appendTo: <Knoten im Shadow-Root>,   // nicht appendToBody
           axisPointer: { type: 'cross', animation: false } },
animation: false,
series: [{ itemStyle: { borderRadius: 0 }, barCategoryGap: '20%' }]
```

Die vier größten Hebel: **Legende weg, Achsenlinien weg, Splitlines gestrichelt und
sehr dunkel, `grid.left/right` auf 0.** Die Vorgabe-Ränder sind der Hauptgrund, warum
Vorgabe-ECharts nach Vorgabe-ECharts aussieht.

### Registrierung fehlt im Repo

`EchartsChart.ts` kennt heute nur Bar, Line, Heatmap, Radar, Custom + Grid, Legend,
Tooltip, VisualMap, Radar. Für ein Kostenpanel fehlen `TreemapChart`, `SankeyChart`,
`DataZoomComponent`, `MarkLineComponent`, `MarkAreaComponent`, `ToolboxComponent`,
`GraphicComponent`, `DatasetComponent`, `TransformComponent`, `MatrixComponent`.

## Wohin fließt das Geld

**Der wichtigste Befund ist ein negativer.** **Vantage** (Spezialist für Cost Reports)
dokumentiert Balken, Linien, Flächen und Kreis — **weder Treemap noch Sankey**. Datadog
beschreibt Kosten nur als Zeitreihen. **Bundeshaushalt.de**, der Lehrbuchfall für einen
Ausgaben-Sankey, benutzt **isolierte Einzelbalken**. Drei unabhängige Akteure, die die
Zeichnung bauen könnten, bauen sie nicht.

**Warum Treemap bei 89/11 versagt:** data-to-viz belegt drei Einwände — das Auge kann
Flächen nicht in Zahlen zurückübersetzen, kleine Kacheln haben keinen Platz für Text,
und wörtlich: „Don't annotate more than 3 levels of the hierarchy, it would make the
figure unreadable." Dazu ECharts' Vorgabe `visibleMin: 10`, die Knoten unter 10 px
**stillschweigend ausblendet**. Bei 89/11 wäre eine Kachel achtmal so groß wie die
andere — und *innerhalb* der kleinen Kachel müssten die Textmodelle noch untergebracht
werden. Das ist keine Zeichnung, das ist ein Rätsel.

**Warum Sankey versagt:** 2 Anbieter → 6 Modelle → 5 Zwecke ergibt bis zu **30 dünne
Verbindungen**. Ein Sankey lohnt an genau **einer** Stelle: **Schlüsselquelle →
Anbieter → Kosten**, also 2 → 2 → Betrag. Vier Knoten, vier Fäden. Das beantwortet die
eine Frage, die eine Tabelle schlecht beantwortet.

**Stattdessen richtig:**

1. **Ein einziger waagerechter 100-Prozent-Balken** für Bild gegen Text, volle
   Panelbreite, Beschriftung im Balken. Kein Kreis — Winkelwahrnehmung ist bei
   extremen Verhältnissen besonders schlecht.
2. **Sortierte Tabelle mit eingebetteten Balken** darunter: Zweck, Modell, Welt je
   absteigend nach USD, rechtsbündig, `tabular-nums`, Anteilsspalte, Sparkline der
   letzten 30 Tage.
3. **Aufklappbare Zeilen statt einer zweiten Zeichnung.** Azure wörtlich: „Expand rows
   to take a quick peek and see how costs are broken down to the next level." Bild
   aufklappen → 5 Zwecke → 6 Modelle. Kein Darstellungswechsel, kein Kontextverlust.
4. **Keine Log-Skala.** Datawrapper warnt vor Log dort, wo der Unterschied gefühlt
   werden soll. Der Achsenbruch macht die Größenordnung sichtbar, statt sie zu glätten.

**Wann eine Treemap dann doch:** für **eine** Frage — die Welten, alle Kosten
zusammengefasst, eine Ebene, keine Verschachtelung.

## Der Monospace-Strang — und wo er kippt

**Wer es gut macht:** Zed. Linear (Mono nur für Kennungen). **Warp** — „A Block groups
commands and outputs into one atomic unit"; übertragen: eine Abrechnungsperiode als
abgegrenzter Block, nicht als weitere Zeile in 400. **Charm/Lipgloss** (Zebra statt
Gitter). **Terminal.shop** als Härtefall — es ist kein Kostüm, weil das Terminal die
Sache selbst ist.

**Wo es kippt — drei belegte Grenzen:**

1. **NN/g** trennt Brutalismus (roh, unverziert) von Anti-Design (aktiv desorientierend).
   Kernsatz: „Niemand beschwert sich, dass eine Website zu leicht zu verstehen ist."
   Positivbeispiel Adult Swim: brutalistischer Look, **Navigation bleibt klar.**
2. **Butterick:** Mono ist für Fließtext unterlegen, legitim nur für Code und
   tabellarische Zahlen. Und der unbequeme Nachsatz: **die meisten Proportionalschriften
   liefern tabellarische Ziffern von Haus aus** — Monospace ist zur Zahlenausrichtung
   gar nicht nötig, nur zur Ästhetik.
3. **Der Kontrast.** Unser eigener `EchartsChart.ts` dokumentiert bereits einen Fall,
   in dem `#94a3b8` auf Papiergrund bei **2,17:1** landete.

**Operative Regel:** Mono für Zahlen, IDs, Slugs. Sans für alles Erklärende. Nie beides
im selben Absatz.

**Typografie-Feinheiten (MDN):** `tabular-nums` (OpenType `tnum`), Baseline-Support seit
Januar 2020 — **wirkt nur, wenn die Schrift das Feature mitbringt**. `slashed-zero` für
Code-Kontexte, für Geldbeträge entbehrlich. `oldstyle-nums` ist hier **schädlich**.
Fallback: `font-feature-settings: "tnum"`.

## Filterleisten, Zeiträume, Vorperiodenvergleich

**Grafana hat das beste Vokabular:**

- Relative Freitextzeiten mit Einheiten `s m h d w M Q y` — man tippt „13h".
- Absolute Zeiten über From/To oder Kalender.
- **Semi-relativ:** fester Anfang, `now` als Ende. Das ist genau „seit Monatsbeginn bis
  jetzt" und in Web-Dashboards selten kopiert.
- Tastenkürzel `t+` / `t-` zum Zoomen; Zoom per Klick-und-Ziehen im Graph.
- **Grafana Scenes** führt **Vergleichszeitraum** als eigenes Konzept, nicht als
  Filteroption.

**Sentry: Granularität ableiten, nicht anbieten** — bei 7 Tagen ein Balken pro Stunde,
bei 90 Tagen ein Balken pro Tag, Maximum 90 Tage. **Kein Nutzer stellt Auflösung ein.**

**Sentrys Kategorienlehre:** fünf gleichrangige Kategorien statt Erfolg/Fehler —
Accepted, Filtered, Rate Limited, Invalid, Client Discard. Äquivalent bei uns:
durchgeführt / gedrosselt / abgebrochen / fehlgeschlagen / aus dem Cache. **Ein
einzelner „Fehler"-Balken verschenkt die Diagnose.**

**Ein Detail von Railway:** **Deployments als gestrichelte Senkrechte in der Zeitreihe.**
Bei uns die Senkrechte, wenn ein Modell oder ein Preis gewechselt wurde.

**Axiom:** Explorer-Fluss **Source → Filter → Summarize → Time range**, zehn Kacheltypen,
darunter **Statistic** und **Table** als eigenständige Typen.

**Die Achsenliste, geprüft:** LiteLLMs `LiteLLM_SpendLogs` enthält `api_key, user,
team_id, request_tags, end_user, model_group, api_base, spend` plus Token-Zahlen — die
im Betrieb bewährte Liste. **Langfuse** nennt vier Kostenzerlegungen als *die* vier:
Token-Trend, Kosten je Nutzer, Modellvergleich, **Kosten je Feature** — Letzteres ist
unser „Zweck".

## Galerien

**Nur zwei taugen:** **Nicelydone** (nicelydone.club, kostenloses Tier, 201.800+
Screenshots von 500+ echten SaaS-Apps) mit *Dashboard & Stats*, *Billing*, *Charts*;
und **SaaS Interface** (saasinterface.com, freemium) mit `/pages/dashboard/` und
`/pages/billing-plan/`. **Dark Mode Design** ist ohne Schranke, nennt aber zwei
brauchbare Namen: **oxide.computer** und **betterstack.com**. **Godly** und
**Screenlane** existieren in der gefragten Form **nicht mehr**. **Pageflows** hat eine
harte Bezahlschranke. **UI Sources** leitet auf iOS-Apps um. **Mobbin, Refero,
Land-book** waren nicht prüfbar (403/429).
