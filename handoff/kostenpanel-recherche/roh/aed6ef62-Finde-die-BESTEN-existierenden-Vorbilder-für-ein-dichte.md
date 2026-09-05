# AUFTRAG

Finde die BESTEN existierenden Vorbilder für ein dichtes, dunkles Kosten- und Telemetrie-Panel. Antworte auf Deutsch. Ich will konkrete, nachschaubare Beispiele — keine allgemeinen Gestaltungsratschläge.

KONTEXT: dunkles, brutalistisches Admin-Panel, Schreibmaschinensatz, sehr dichte Zahlen, ECharts 6 als Diagrammbibliothek. Thema sind KI-Kosten: Aufrufe, Token, USD, aufgeschlüsselt nach Anbieter (Replicate/OpenRouter), Modell, Zweck, Welt, Gespräch, Nutzer und Schlüsselquelle (Plattform vs. eigener Schlüssel), mit frei wählbaren Zeiträumen und einer Hochrechnung.

SUCHE GEZIELT:

**1. Spitzenklasse dichter Betriebs-Oberflächen** — je mit URL zu Screenshots oder Doku:
Vercel Observability/Usage · Railway Metrics · Fly.io · Grafana (Scenes) · Datadog · Honeycomb · Axiom · Tinybird · ClickHouse Cloud · Sentry Insights · PostHog · Plausible · Linear Insights · Stripe Dashboard und Sigma · Retool · Observable Framework · TradingView und Bloomberg-Terminal (die dichtesten Zahlenoberflächen überhaupt).

Für JEDES: was macht es außergewöhnlich? KONKRETE Merkmale — Zeilenhöhen, Schriftgrößen, Rasterabstände, Farbdisziplin, Hover-Verhalten, Drill-down-Weg, wie Zeiträume gewählt werden.

**2. Galerien mit ECHTEN Produkt-Screenshots**: Mobbin, Refero, SaaS Interface, UI Sources, pageflows, Godly, Land-book, Dark Mode Design. Suche darin nach „analytics dashboard", „usage", „billing", „metrics", „dark dashboard".
⚠ Unterscheide echte PRODUKTE von Dribbble-Konzepten. Dribbble-Entwürfe si

---

## Methodischer Vorbehalt vorweg

Das Websuch-Kontingent der Sitzung war erschöpft (200/200), bevor die Recherche begann. Alles unten stammt aus direkten Seitenabrufen bekannter URLs plus GitHub-API. Zwei Folgen, die die Aussagekraft begrenzen:

- **Keine Bildauswertung.** Wo unten Zeilenhöhen oder px-Werte stehen, sind sie aus Doku oder Quellcode zitiert. Farbdisziplin und Rasterabstände von Vercel, Stripe, Linear liegen **nur in PNGs** vor, die nicht gelesen werden konnten. Ich habe sie nicht erfunden und nicht behauptet.
- **Sechs Ziele blockten** (403/429): Mobbin, Refero, Land-book, usgraphics.com (Berkeley Mono), Sourcegraph, dash.cloudflare.com. Observable Framework gab 429 (temporäres Limit, später erneut versuchen).

---

## 0. Ausgangslage im Repo (damit die Empfehlungen anschlussfähig sind)

`frontend/src/components/admin/AdminAIUsageTab.ts` (283 Zeilen) zeigt heute: 4 `velg-metric-card` (Calls, Tokens, Est. Cost, Avg/Call), **fünf schlichte Tabellen** (By Model, By Purpose, By Provider, Key Sources, Daily Trend), ein `<select>` mit 7/30/90 Tagen. **Kein einziges Diagramm.**

`frontend/src/components/shared/EchartsChart.ts` ist ein sehr durchdachter Wrapper — Serienfarben pro Welt mit gemessenen Kontrastwerten für hell und dunkel, Chrome aus lebenden Tokens per `getComputedStyle(el)`. Aber `echarts.use([...])` registriert nur: `BarChart, LineChart, HeatmapChart, RadarChart, CustomChart, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, RadarComponent, CanvasRenderer`.

**Für ein Kostenpanel fehlen dort: `TreemapChart`, `SankeyChart`, `DataZoomComponent`, `MarkLineComponent`, `MarkAreaComponent`, `ToolboxComponent`, `BrushComponent`, `GraphicComponent`, `DatasetComponent`, `TransformComponent`, `MatrixComponent`.** Das ist der erste konkrete Schritt, egal welches Vorbild gewinnt.

---

## 1. Dichte Betriebs-Oberflächen

### Vercel AI Gateway Observability — der direkteste Treffer überhaupt

https://vercel.com/docs/ai-gateway/observability-and-spend/observability (Doku ist als Text abrufbar, Screenshots nur als PNG)

Das ist buchstäblich dasselbe Problem: ein Gateway, das Aufrufe an fremde Modelle weiterreicht und Kosten je Projekt und je Schlüssel ausweist. Wörtlich aus der Doku:

- **Genau vier Diagramme** im Bereich Usage: *Requests by Model*, *Time to First Token*, *Input/Output Token Counts*, *Spend*.
- **Zwei Aggregationsachsen nebeneinander**, nicht verschachtelt: eine Zusammenfassung nach **Projekt** und eine nach **API-Key**. Beide mit identischen Spalten — wörtlich: „request count, average tokens, P75 duration, P75 TTFT, and cost for the specified time frame". Das ist die Antwort auf eure „Welt vs. Schlüsselquelle"-Frage: **dieselben Spalten, zwei Tabellen, kein Umschalter.**
- **Zwei Geltungsbereiche** über ein Dropdown in der Kopfzeile: Team-Ebene (alles) und Projekt-Ebene (gefiltert, aber *dieselben Metriken*). Bei euch: Plattform vs. eine Welt.
- **Drilldown-Kette** (vier Stufen, dokumentiert): Graph ansehen → Zeitraum mit Klick-und-Ziehen markieren → „Zoom In" → Routen-/Modellliste neu sortieren → auf eine Zeile klicken → Detailseite mit Link zu den Logs.
- Logs sind eine **eigene Seite**, nicht ein Aufklapper: durchsuchbar nach Request-ID, filterbar nach Modell, Anbieter, Status-Code, Live-Follow, CSV-/JSON-Export.

Und die Hochrechnung, aus https://vercel.com/docs/pricing/manage-and-optimize-usage, wörtlich: *„In the overview, you'll see an allotment indicator. It shows how much of your usage you've consumed in the current cycle and the projected cost for each item."* Also: **Verbrauchsbalken plus hochgerechnete Kosten je Posten, in derselben Zeile.**

Dazu fünf dokumentierte Ansichts-Umschalter pro Metrik, jeder eine andere Zerlegung derselben Zahl: **Count** (Summe), **Project** (je Projekt), **Region**, **Ratio** (z. B. cached vs. uncached, successful vs. errored vs. timed out), **Average** (24-Stunden-Mittel). Der Ratio-Modus ist der interessanteste — er zeigt nicht mehr Daten, sondern dieselben Daten als Verhältnis. Bei euch: Plattform-Schlüssel gegen eigenen Schlüssel; Bild gegen Text; erfolgreich gegen gedrosselt gegen fehlgeschlagen.

### Sentry Stats — die Kategorienlehre

https://docs.sentry.io/product/stats/

Zwei Dinge, beide übertragbar:

1. **Fünf gleichrangige Kategorien statt Erfolg/Fehler**: Accepted, Filtered, Rate Limited, Invalid, Client Discard. Für ein KI-Panel wäre das Äquivalent: durchgeführt / gedrosselt / abgebrochen / fehlgeschlagen / vom Cache bedient. Ein einzelner „Fehler"-Balken verschenkt die Diagnose.
2. **Die Balkenauflösung folgt der Zeitraumlänge**: bei 7 Tagen ein Balken pro Stunde, bei 90 Tagen ein Balken pro Tag. Maximum 90 Tage. Kein Nutzer stellt Granularität ein — sie ergibt sich.

### Grafana — das beste Zeitraum-Vokabular

https://grafana.com/docs/grafana/latest/dashboards/ · https://grafana.com/developers/scenes/

- Relative Freitextzeiten mit Einheiten `s m h d w M Q y` (man tippt „13h").
- Absolute Zeiten über From/To oder Kalender.
- **Semi-relativ**: fester Anfang, `now` als Ende. Das ist genau „seit Monatsbeginn bis jetzt" und in Web-Dashboards selten kopiert.
- Tastenkürzel `t+` / `t-` zum Ein- und Auszoomen; Zoom per Klick-und-Ziehen im Graph.
- Scenes führt **Vergleichszeitraum** als eigenes Konzept („comparing time ranges"), nicht als Filteroption.

Farbwerte des Dark-Themes: nicht dokumentiert.

### Datadog Cloud Cost Management

https://docs.datadoghq.com/cloud_cost_management/

Ein einziger, aber starker Befund: **Forecast ist ein eigener Alarmtyp**, kein Chartschmuck. Fünf Monitortypen: *Cost Changes*, *Cost Anomalies*, *Cost Threshold*, *Cost Forecast*, *Budget Monitors*. 15 Monate Historie. Layout und Forecast-Optik: nicht dokumentiert, nur Screenshots.

### Railway, Fly.io, Honeycomb, Axiom, Tinybird, ClickHouse Cloud — schwache Ausbeute, ehrlich gesagt

- **Railway** (https://docs.railway.com/reference/metrics): vier Infrastrukturmetriken, 30 Tage. Ein übernehmenswertes Detail: **Deployments als gestrichelte Senkrechte in der Zeitreihe.** Bei euch die Senkrechte, wenn ein Modell oder ein Preis gewechselt wurde. Ein Kosten-Dashboard hat Railway laut Doku nicht.
- **Fly.io** (https://fly.io/docs/reference/metrics/): baut **kein eigenes UI**, sondern liefert ein vorkonfiguriertes Grafana unter `fly-metrics.net`. Als Vorbild damit erledigt.
- **Honeycomb**: BubbleUp-Doku war nicht erreichbar (404). Belegt ist nur der Drilldown Heatmap-Punkt → Trace → Spans.
- **Axiom** (https://axiom.co/docs/monitor-data/dashboards): zehn Kacheltypen (Gauge, Heatmap, Log Stream, Monitor List, Note, Pie Chart, Scatter Plot, **Statistic**, **Table**, Time Series). Explorer-Fluss: Source → Filter → Summarize → Time range.
- **Tinybird**: aus der öffentlichen Doku ist **keine einzige UI-Aussage** zu gewinnen — es ist eine API-/Pipeline-Plattform, kein Kosten-Panel. Falscher Kandidat, das ist selbst das Ergebnis.
- **ClickHouse Cloud**: vier geratene Query-Insights-URLs gaben 404. Echte Lücke.

### Der Nachbar, den die Liste nicht hatte: LiteLLM

https://docs.litellm.ai/docs/proxy/cost_tracking

Das Datenmodell ist **exakt eures**. `LiteLLM_SpendLogs` enthält: `api_key, user, team_id, request_tags, end_user, model_group, api_base, spend` plus prompt/completion/total tokens. Aggregationsachsen: Key, Team, Interner Nutzer, Endkunde, Modell, Anbieter, freie Tags. Wer wissen will, welche Achsen ein Kostenpanel *braucht*, findet hier die geprüfte Liste. Die UI selbst ist nur hinter dem eigenen Proxy zu sehen.

Ergänzend **Langfuse** (https://langfuse.com/docs/metrics/features/custom-dashboards): Kachelbau aus Datenquelle + Metrik + Dimension + Filter + Chart-Typ, mit genau vier Chart-Typen (Linie, Balken, Zeitreihe, Kreis). Die Kostenzerlegungen, die Langfuse als *die* vier benennt: Token-Trend, Kosten je Nutzer, Modellvergleich, **Kosten je Feature**. Letzteres ist euer „Zweck".

---

## 2. Galerien mit echten Produkt-Screenshots

| Galerie | Echte Produkte? | Schranke | Was konkret drin ist |
|---|---|---|---|
| **Nicelydone** (nicelydone.**club**) | **Ja** — 201.800+ Screenshots von 500+ SaaS-Apps, u. a. Linear, Notion, Stripe | Free-Tier ohne Kreditkarte; Login für Suche/Boards | **Die relevanteste Galerie.** Hat direkt die Kategorien **„Dashboard & Stats"**, **„Billing"**, „Plans & pricing", „Upgrade" plus UI-Element-Kategorien Charts / Progress Indicator / Activity Feed |
| **SaaS Interface** (saasinterface.com) | **Ja** | Freemium, Vollgalerie kostenpflichtig | Pfade: `/pages/dashboard/`, `/pages/billing-plan/`, `/components/modal-dialog/`. 26 Seitenkategorien inkl. Dashboard, Lists & Tables, Billing/Plan, Activity Feed |
| **Dark Mode Design** | **Ja**, echte Website-Screenshots | **Keine Schranke** | Kuratiert, ohne Taxonomie. Nennt u. a. **oxide.computer** und **betterstack.com** — beide dunkel, technisch, dicht. Für euch die zwei Namen, die es wert sind |
| **Pageflows** | Ja, plus Screen-Recordings | **Harte Bezahlschranke** (39 $/Quartal, 99 $/Jahr) | Billing-/Analytics-Bildschirme auf der öffentlichen Seite nicht sichtbar |
| **UI Sources** | leitet auf **screensdesign.com** | keine | Nur **iOS-Apps**, keine Dashboard-/Billing-/Dark-Kategorien. Für euch irrelevant |
| **Godly** | leitet auf **recent.design**, dahinter 403 | — | **Existiert in der gefragten Form nicht mehr** |
| **Screenlane** | leitet auf **pageflows.com** | — | **Existiert nicht mehr eigenständig** |
| **Mobbin, Refero, Land-book, SaaS Landing Page** | unbekannt | **403/429 bei jedem Versuch** | Nicht prüfbar ohne echten Browser. Land-book und SaaS Landing Page sind ohnehin Marketing-Landingpages, keine App-Innenansichten |

Kurz: **Nicelydone (kostenlos) und SaaS Interface** sind die zwei, die es tun. Zwei der genannten Galerien gibt es nicht mehr.

---

## 3. Der Monospace-/brutalistische Strang

### Die eine Regel, die belegt ist

Vercel Geist, Tabellen-Doku (https://vercel.com/geist/table), wörtlich:

> *„Apply `tabular-nums` (or Geist Mono) to numeric columns so digits align across rows."*

Also **entweder oder** — nicht beides zwingend. Zweite Regel von derselben Seite, unterschätzt: **fehlende Werte als Geviertstrich `—`**, nicht als „N/A", nicht als null, nicht leer. Bei einer Kostentabelle mit 21 Welten × 6 Modellen ist die Mehrheit der Zellen leer; wie diese Leere aussieht, entscheidet über die Lesbarkeit der ganzen Tabelle.

Geist-Farbsystem: Graustufen in zehn Stufen (`--ds-gray-100` … `--ds-gray-1000`), grob 100–300 Hintergründe, 400–600 Rahmen, 700–1000 Text. Konkrete px-Werte für Typografie und Raster: **nicht öffentlich**, liegen im internen Figma.

### Zeds gemessene Werte — der einzige belastbare Zahlenanker

https://zed.dev/docs/visual-customization

- `ui_font_size`: **16 px**
- `buffer_font_family`: **Berkeley Mono** (Vorgabe)
- `buffer_font_size`: **15 px**
- `buffer_line_height`: `standard` = **1.3**, `comfortable` = **1.618**

Damit habt ihr die Spanne, in der ein produktives, dichtes Werkzeug tatsächlich läuft: 15–16 px, Zeilenhöhe 1.3 unten, 1.618 oben. Für ein Zahlenraster ist 1.3 der richtige Pol.

### Linears Muster: Mono nur für Kennungen

Auf linear.app wird Monospace **ausschließlich für Issue-IDs** („DRV-8852") und Codeschnipsel eingesetzt, sonst durchgehend Sans. Übertragen: Modell-Slugs, Aufruf-IDs, Schlüssel-Präfixe, USD-Beträge in Mono — Beschriftungen, Erklärungen, Kategorienamen in Sans.

### Warp: Blöcke statt Tabellenwand

https://docs.warp.dev/terminal/blocks — *„A Block groups commands and outputs into one atomic unit."* Kopierbar, durchsuchbar, mit Lesezeichen. Übertragen auf ein Kostenpanel: eine Abrechnungsperiode oder ein Generierungslauf als abgegrenzter Block, nicht als weitere Zeile in einer 400 Zeilen langen Tabelle.

### Charm/Lipgloss: Zebra statt Gitter

https://github.com/charmbracelet/lipgloss — das `table`-Paket arbeitet mit `StyleFunc(row, col)`, Zeilenunterscheidung über **Hintergrundfarbe je Zeile**, nicht über Gitterlinien. Rahmen-Presets `NormalBorder()`, `RoundedBorder()`, `ThickBorder()` und **selektive Kanten** (`BorderTop(true)`). Genau das, was ein dichtes Raster braucht: eine Linie, wo sie trennt, keine, wo sie nur Rauschen ist. Bubbletea nennt über 18.000 bekannte Anwendungen, darunter `gh-dash` und AWS EKS Node Viewer — echte dichte Zahlen-TUIs.

### Terminal.shop: der Härtefall

https://terminal.shop — Navigation als `[terminal] [cron] [api] [readme] [faq]`, Bestellung tatsächlich per `ssh terminal.shop`, `cat ~/.ssh/known_hosts` als Seiteninhalt. Es ist kein Kostüm, weil das Terminal die Sache selbst ist. Genau darin liegt die Grenze für euch: bei einem Kostenpanel *ist* das Terminal ein Kostüm, sobald es die Zahlen behindert.

### Bloomberg Terminal — die Farbdisziplin

https://en.wikipedia.org/wiki/Bloomberg_Terminal (belegt): schwarze Oberfläche als Markenzeichen seit Einführung; eigene Tastatur mit **Farbcode statt Beschriftung** (rot = Cancel, grün = GO, gelb = Marktsektoren); typischerweise **vier Panels gleichzeitig** pro Monitor; Befehle in geschweiften Klammern.

Die Lehre ist nicht das Aussehen, sondern das Prinzip: **eine winzige Palette (3–4 Farben), aber jede Farbe bedeutet quer über alle Panels dasselbe.** Farbe ist dort Datenklasse, nicht Dekor. Für euch: Replicate hat eine Farbe, OpenRouter eine, und diese Farbe gilt in Balken, Tabelle, Legende, Abzeichen — überall.

### Wo Brutalismus kippt

**NN/g** (https://www.nngroup.com/articles/brutalism-antidesign/) trennt sauber: Brutalismus = roh, unverziert (Craigslist). Anti-Design = aktiv desorientierend, fehlende Hierarchie, grelle Farben. Kernsatz: *„Niemand beschwert sich, dass eine Website zu leicht zu verstehen ist."* Empfohlen nur für Designer-/Künstlerpublikum oder Unterhaltung. Positivbeispiel Adult Swim: brutalistischer Look, aber **Navigation bleibt klar** — genau darin liegt die Grenze.

**Butterick, Practical Typography** (https://practicaltypography.com/monospaced-fonts.html): Monospace ist für Fließtext unterlegen, weil schmale Zeichen (f, i, l) Platz verschwenden. Zwei legitime Ausnahmen: Code und tabellarische Zahlen. Und der Nachsatz, der euch betrifft: **die meisten Proportionalschriften liefern tabellarische Ziffern von Haus aus** — Monospace ist zur Zahlenausrichtung nicht nötig, nur zur Ästhetik.

Daraus die operative Grenze: **Mono für Zahlen, IDs, Slugs. Sans für alles Erklärende. Nie beides vermischt im selben Absatz.** Und der Kontrast der Achsenbeschriftungen ist nicht verhandelbar — euer eigener `EchartsChart.ts` dokumentiert bereits einen Fall, wo `#94a3b8` auf Papiergrund bei **2,17 : 1** landete und damit jede Achsenbeschriftung der Plattform auf einen Schlag unlesbar war.

**Typografie-Feinheiten**, belegt über MDN (https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric):
- `font-variant-numeric: tabular-nums` (OpenType `tnum`) — Baseline-Support seit Januar 2020, aber **nur wirksam, wenn die geladene Schrift das Feature mitbringt**.
- `slashed-zero` (`zero`) — laut MDN für Code-Kontexte, für Geldbeträge entbehrlich.
- `oldstyle-nums` — für ein Zahlenpanel **schädlich**, zerstört die Ausrichtung.
- Kombinierbar: `font-variant-numeric: tabular-nums slashed-zero;`, Fallback `font-feature-settings: "tnum";`
- Aus der Inter-Doku (rsms.me/inter): tabellarische Ziffern haben *dieselbe Breite über alle Schnitte* — relevant, wenn die Summenzeile fett ist und trotzdem ausgerichtet bleiben soll.

**Nicht belegbar:** usgraphics.com (Berkeley Mono) gab durchgehend 403. Railway, Oxide-Konsole, Cloudflare-Dashboard, Modal, Baseten, Turso, Neon, HyperDX: nur Marketingtext, die eigentlichen Oberflächen liegen hinter Login.

---

## 4. ECharts konkret

### Was ECharts 6 mitbringt (https://echarts.apache.org/handbook/en/basics/release-note/v6-feature/)

- **Neues Vorgabe-Theme** auf Basis von Design-Tokens; Legende steht jetzt standardmäßig **unten**. Wer das alte Aussehen will: `echarts/theme/v5.js`.
- **Dynamischer Theme-Wechsel** ohne Neuinitialisierung: `chart.setTheme('dark')`. Das ist für euren Skin-Umschalter direkt relevant — euer Wrapper baut das Theme heute aus lebenden Tokens, `setTheme` ergänzt das um Wechsel ohne Animationsneustart.
- **Achsenbrüche** („torn-paper effect"), mit Klick zum Aufklappen.
- **Matrix-Koordinatensystem** — eine echte Tabelle, in deren Zellen Diagramme stehen.
- **Chord-Serie**, Beeswarm, Scatter-Jitter, verbesserte Achsenbeschriftungs-Layouts.

### Achsenbrüche: die Antwort auf 89 zu 11

Beispiel verifiziert: `bar-breaks-simple` (trägt im Quelltext `since: 6.0.0`), dazu `bar-breaks-brush`, `intraday-breaks-1`, `intraday-breaks-2`.

```js
yAxis: {
  type: 'value',
  breaks: [{ start: 5000, end: 100000, gap: '1.5%' }],
  breakArea: { itemStyle: { opacity: 1 } }
}
```

Vollständige Schlüssel aus der Optionsreferenz: `breaks[].start/end/gap/isExpanded`, `breakArea.show`, `breakArea.itemStyle.color` (**Vorgabe `#fff` — auf dunklem Grund zwingend zu überschreiben**), `.borderColor` (`#b7b9be`), `.borderWidth`, `.borderType`, `breakArea.zigzagAmplitude` (4), `zigzagMinSpan` (4), `zigzagMaxSpan` (20), `zigzagZ` (100), **`breakArea.expandOnClick`** (Vorgabe `true`), `breakLabelLayout.moveOverlap`.

Das löst genau die Schieflage: der 89-Prozent-Balken wird nicht abgeschnitten und nicht logarithmiert, sondern **sichtbar unterbrochen** — und ein Klick stellt die wahren Proportionen wieder her. Der Bruch ist selbst die Aussage: „hier ist eine Größenordnung übersprungen."

### Matrix — der beste ECharts-6-Fund für ein brutalistisches Panel

`matrix-sparkline`, `matrix-mini-bar-data-collection`, `matrix-simple`, `matrix-grid-layout`, `matrix-stock` (alle `since: 6.0.0`).

```js
matrix: {
  x: { data: ['Mo','Di','Mi','Do','Fr'], levelSize: 40, label: { fontSize: 16 } },
  y: { data: [...], levelSize: 70, label: { fontSize: 14 } },
  corner: { data: [{ coord: [-1,-1], value: 'Zeit' }] },
  body:   { data: [{ coord: [null, 2], coordClamp: true, mergeCells: true, value: 'Pause' }] }
}
```

Das ist eine **Tabelle, deren Zellen Diagramme sind** — kein Kacheldashboard, das eine Tabelle nachahmt. 21 Welten in Zeilen, 6 Modelle in Spalten, in jeder Zelle ein Sparkline der Tagesausgaben. Es ist gleichzeitig dicht, tabellarisch und grafisch, und es sieht kein bisschen nach Vorgabe-ECharts aus. Nach meiner Einschätzung der stärkste einzelne Hebel in dieser ganzen Recherche.

### Verifizierte Beispiel-IDs (über die GitHub-API von `apache/echarts-examples` geholt, nicht geraten)

URL-Form: `https://echarts.apache.org/examples/en/editor.html?c=<id>`

| Zweck | IDs |
|---|---|
| Gestapelte Balken | `bar-stack`, `bar-stack-borderRadius`, `bar-stack-normalization`, `bar-stack-normalization-and-variation`, `bar-y-category-stack` |
| **Drilldown** | `bar-drilldown`, `bar-multi-drilldown` |
| **Achsenbrüche** | `bar-breaks-simple`, `bar-breaks-brush`, `intraday-breaks-1`, `intraday-breaks-2` |
| Treemap | `treemap-simple`, `treemap-drill-down`, `treemap-show-parent`, `treemap-disk`, `treemap-visual`, `treemap-sunburst-transition` |
| Sankey | `sankey-simple`, `sankey-levels`, `sankey-energy`, `sankey-nodeAlign-left`, `sankey-vertical` |
| Sunburst | `sunburst-simple`, `sunburst-visualMap`, `sunburst-borderRadius`, `sunburst-monochrome` |
| Kalender | `calendar-heatmap`, `calendar-simple`, `calendar-charts`, `calendar-vertical` |
| **Prognose-Band** | **`confidence-band`** |
| Verkettete Diagramme | **`dataset-link`** (ein Datensatz, mehrere Diagramme, `emphasis: { focus: 'series' }`) |
| Datenumformung | `data-transform-aggregate`, `data-transform-filter`, `data-transform-sort-bar` |
| Sonstiges | `bar-waterfall`, `bar-waterfall2`, `flame-graph`, `bump-chart`, `mix-line-bar`, `grid-multiple`, `themeRiver-basic`, `line-markline`, `mix-zoom-on-value` |

`confidence-band` verdient Beachtung: es kombiniert eine gestapelte unsichtbare Grundlinie mit `tooltip.axisPointer: { type: 'cross', animation: false }` — genau die Bauart, die AWS Cost Explorer für sein Prognoseintervall benutzt.

### Diagrammtypen, bewertet für Kosten

- **Gestapelte Balken über Zeit** — die Arbeitspferde. Aber: `data-to-viz.com/caveat/stacking.html` warnt zu Recht, dass nur die unterste Kategorie eine echte Nulllinie hat; die oberen sind kaum vergleichbar. Bei 5 Zwecken sind das 4 schlecht vergleichbare Bänder.
- **Treemap** — technisch: `leafDepth` (schaltet Drilldown ein, geklickter Knoten wird Wurzel), `drillDownIcon` (Vorgabe `'▶'`), `nodeClick: 'zoomToNode' | 'link' | false`, `upperLabel` (Elternbeschriftung, `height: 20`), `visibleMin` (Vorgabe 10 px — kleinere Knoten verschwinden), `childrenVisibleMin`, `itemStyle.gapWidth`, `colorMappingBy: 'index' | 'value' | 'id'`, `squareRatio` (Vorgabe: goldener Schnitt). Aber siehe Abschnitt 5 — für euren Fall die falsche Wahl.
- **Sankey** — `nodeWidth` (20), `nodeGap` (8), `nodeAlign: 'justify' | 'left' | 'right'`, `layoutIterations` (32; **`0` erhält die Datenreihenfolge**, wichtig wenn ihr eine feste Anbieter-Reihenfolge wollt), `lineStyle.color: 'source' | 'target' | 'gradient'`, `lineStyle.curveness` (0.5), `emphasis.focus: 'adjacency'` (hebt beim Hovern den ganzen Pfad hervor — der eigentliche Grund, einen Sankey interaktiv zu bauen), `levels: [{depth: 0, ...}, {depth: 1, ...}, {depth: 2, ...}]` für drei Stufen.
- **Kalender-Heatmap** — für 21 Welten × 365 Tage die einzige Form, die auf einen Schirm passt. Zeigt Rhythmus (Wochenenden, Kampagnen, Ausreißer), nicht Betragshöhe.
- **Sunburst** — für Kosten schlechter als Treemap: die äußeren Ringe haben pro Datenpunkt noch weniger Fläche und die Winkel sind noch schwerer zu vergleichen. Weglassen.
- **themeRiver** — schön, unlesbar für Beträge. Weglassen.

### Wie ein ECharts-Diagramm aufhört, nach ECharts auszusehen

Ihr habt den Themeteil bereits gelöst (Tokens aus dem Element statt Konstante). Was darüber hinaus zählt:

```js
grid: { left: 0, right: 0, top: 8, bottom: 0, containLabel: true },
xAxis: {
  axisLine:  { show: false },
  axisTick:  { show: false },
  splitLine: { show: false },
  axisLabel: { fontFamily: 'var(--font-mono)', fontSize: 11, margin: 12 }
},
yAxis: {
  axisLine: { show: false }, axisTick: { show: false },
  splitLine: { lineStyle: { type: 'dashed', width: 1 } },
  axisLabel: { formatter: (v) => '$' + v.toFixed(0) }
},
legend: { show: false },          // Farbe gehört in die Tabelle daneben, nicht in eine Legende
animation: false,                 // und ohnehin bei prefers-reduced-motion
series: [{ itemStyle: { borderRadius: 0 }, barCategoryGap: '20%' }]
```

Die vier, die am meisten ausmachen: **Legende weg** (die Tabelle daneben ist die Legende), **Achsenlinien weg**, **Splitlines gestrichelt und sehr dunkel**, **`grid.left/right` auf 0 mit `containLabel: true`** — die Vorgabe-Ränder von ECharts sind der Hauptgrund, warum Vorgabe-ECharts nach Vorgabe-ECharts aussieht. Dazu `fontFamily` durchgängig auf Mono und `borderRadius: 0`.

### Interaktions-Komponenten: lohnt sich das?

- **`dataZoom`** — ja, aber `type: 'inside'` (Scrollrad/Wischen), **nicht** `slider`. Der Slider ist ein 40 px hoher grauer Streifen unter jedem Diagramm und frisst genau die Dichte, die ihr wollt.
- **`tooltip.axisPointer`** — **ja, das Wichtigste von allen.** `trigger: 'axis'`, `axisPointer: { type: 'cross' | 'shadow', animation: false }`. `animation: false` ist entscheidend: bei dichten Zahlen ist ein nachziehendes Fadenkreuz Rauschen. TradingViews Verhalten ist übrigens präziser als ein schwebender Tooltip — die Werte erscheinen **als Label direkt auf beiden Achsen**, nicht als Kasten mitten im Bild. Das ist `axisPointer.label`.
- **`markLine`** — **ja, für die Hochrechnung.** `markLine.data` akzeptiert `{ type: 'average' }`, `{ yAxis: <konstante> }` (waagerechte Referenzlinie, z. B. Monatsbudget), oder zwei Koordinatenpaare. Dazu `lineStyle.type: 'dashed'`, `label.position: 'start' | 'middle' | 'end'`, `label.formatter`, **`silent: true`** (sonst fängt die Linie Mausereignisse ab). `markArea.data` schattiert einen Bereich — für „Rest des Monats" oder „Prognoseband".
- **`visualMap`** — nur für Kalender-Heatmap und Treemap-Färbung. Für Balken über Zeit falsch: Farbe soll dort die Kategorie tragen, nicht den Betrag.
- **`brush`** vs. `dataZoom` — die Referenz sagt es klar: **brush wählt aus und hebt hervor, ohne die Achsen zu ändern; dataZoom ändert den Ausschnitt.** Für Zeitraumwahl ist also `dataZoom` richtig, nicht `brush`. `brush` lohnt nur, wenn ihr aus einer Auswahl eine *andere* Ansicht speisen wollt (Ereignis `brushSelected`, `brushType: 'lineX'`, `throttleType: 'debounce'`). Für ein Kostenpanel: eher nicht.
- **`graphic`** — sparsam, für eine einzelne feste Beschriftung („Hochrechnung"). Nicht für Chrome.

---

## 5. Wohin fließt das Geld — als Zeichnung

### Der wichtigste Befund ist ein negativer

**Vantage** (https://docs.vantage.sh/cost_reports) — der Spezialist für Cost Reports — dokumentiert **Balken (gestapelt und nebeneinander), Linien, Flächen und Kreis (nur kumulativ). Weder Treemap noch Sankey.** Datadog Cloud Cost Management beschreibt Kosten ausschließlich als Zeitreihenmetriken. **Bundeshaushalt.de**, der Lehrbuchfall für einen Ausgaben-Sankey, verwendet **isolierte Einzelbalken** statt eines Sankey.

Drei unabhängige Akteure, die die Zeichnung bauen könnten, bauen sie nicht. Das ist kein Zufall.

### Warum Treemap bei euch versagt

- `data-to-viz.com/caveat/area_hard.html`: das Auge kann Flächen nicht in Zahlen zurückübersetzen; Empfehlung ist Länge (Balken) statt Fläche.
- `data-to-viz.com/caveat/hard_label.html`: kleine Kacheln haben schlicht keinen Platz für Text — lösbar nur über Tooltip, nicht über die Fläche.
- `data-to-viz.com/graph/treemap.html`, wörtlich: *„Don't annotate more than 3 levels of the hierarchy, it would make the figure unreadable."*
- ECharts' eigene Vorgabe `visibleMin: 10` blendet Knoten unter 10 px **stillschweigend aus**.

Und dann die 89/11-Schieflage: eine Kachel wäre achtmal so groß wie die andere, und *innerhalb* der kleinen 11-Prozent-Kachel müssten die Textmodelle noch untergebracht werden. Das ist keine Zeichnung, das ist ein Rätsel.

### Warum Sankey bei euch versagt

`data-to-viz.com/graph/sankey.html` nennt als häufige Fehler: Knotenposition entscheidend, schwache Verbindungen sollten entfernt werden, Überfüllung. Bei 2 Anbietern → 6 Modellen → 5 Zwecken sind das **bis zu 30 Verbindungen zwischen Stufe 2 und 3**, die meisten dünn. Genau der Fall, vor dem gewarnt wird. SankeyMATIC (https://sankeymatic.com/build/) unterstützt 3+ Spalten technisch problemlos — aber „technisch möglich" ist nicht „lesbar".

Ein Sankey lohnt bei euch nur an **einer** Stelle: **Schlüsselquelle → Anbieter → Kosten**, also 2 → 2 → Betrag. Vier Knoten, vier Fäden. Das beantwortet die eine Frage, die eine Tabelle schlecht beantwortet: *wie viel des Geldes fließt durch Schlüssel, für die wir zahlen, gegenüber Schlüsseln, für die andere zahlen.* Alles darüber hinaus: Tabelle.

### Was stattdessen

1. **Ein einziger waagerechter 100-Prozent-Balken** für Bild gegen Text, über die volle Panelbreite, zwei Segmente, Beschriftung im Balken. Kein Kreis (`data-to-viz.com/caveat/pie.html`: Winkelwahrnehmung wird bei extremen Verhältnissen wie 89/11 besonders schlecht).
2. **Darunter eine sortierte Tabelle mit eingebetteten Balken** (Data Bars in der Zelle) — Zweck, Modell, Welt jeweils absteigend nach USD, rechtsbündig, `tabular-nums`, Anteil-Spalte, Sparkline der letzten 30 Tage. Das ist Tuftes Sparkline-Prinzip und Fews graphische Tabelle. *Anmerkung zur Quellenlage: Fews PDF ließ sich nicht als Text extrahieren, NN/gs Tabellenartikel behandelt Data Bars nicht — das ist etabliertes Fachwissen, in dieser Sitzung nicht neu belegt.*
3. **Aufklappbare Zeilen** statt einer zweiten Zeichnung. Azure Cost Analysis wörtlich: *„Expand rows to take a quick peek and see how costs are broken down to the next level."* Bild aufklappen → 5 Zwecke. Zweck aufklappen → 6 Modelle. Kein Wechsel der Darstellung, kein Kontextverlust.
4. **Keine Log-Skala.** Datawrapper (https://www.datawrapper.de/blog/weeklychart-logscale3/) zitiert Bostocks Regel für *Wachstumsraten*, nicht für Anteile am Ganzen — und warnt vor Log-Skalen dort, wo der Unterschied gefühlt werden soll. Bei euch soll man 89 Prozent **sehen**. Der Achsenbruch (Abschnitt 4) tut, was die Log-Skala nicht tut: er macht die Größenordnung sichtbar, statt sie zu glätten.

### Wann eine Treemap dann doch

Wenn ihr sie wollt, dann für **eine** Frage: die 21 Welten, alle Kosten zusammengefasst, eine Ebene, keine Verschachtelung. Da ist die Verteilung vermutlich flacher, die Kachelzahl handhabbar, und Fläche als grobe Rangordnung genügt. `treemap-show-parent` und `treemap-drill-down` sind die Vorlagen.

### Hochrechnung: was die Marktführer wirklich tun

- **AWS Cost Explorer** (https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html): **80-Prozent-Prognoseintervall**. Bei Linien als **zwei zusätzliche Linien** ober- und unterhalb (Band); bei Balken als zwei Linien am oberen Balkenrand. **Kein Forecast bei weniger als einem vollen Abrechnungszyklus Historie** — eine Regel, die ihr übernehmen solltet, statt aus drei Tagen einen Monat zu extrapolieren.
- **Azure Cost Analysis**: Forecast **nur bei Flächen- oder gestapeltem Säulendiagramm**, Methode *time series linear regression*, Einmalspitzen filterbar. Lookback-Regel: bis 28 Tage Prognose → 28 Tage Rückblick; über 90 Tage → auf 90 gedeckelt. Bei gesetztem Budget wird angezeigt, **wann** die Prognose es überschreitet. KPI-Kachel zeigt Vormonatsvergleich in Prozent neben dem Total.
- **GCP Billing**: Prognose **hellgrau eingefärbt im Chart**, nicht gestrichelt. Kopfzeile: „Total forecasted cost for the entire current month" plus Trendindikatoren getrennt von der Grafik.
- **FinOps Foundation** (https://www.finops.org/framework/capabilities/forecasting/): definiert *Forecast Accuracy Rate* und *Forecast Drift Rate* als KPIs, aber **keine** visuelle Konvention.

Das gemeinsame Muster ist deutlich und widerspricht der naheliegenden Lösung: **keiner der drei benutzt eine gestrichelte Linie als alleiniges Signal.** AWS nimmt ein Band, Azure einen Budget-Schnittpunkt plus Prozentzahl, GCP eine hellere Farbe. Und alle drei zeigen den **Vormonatsvergleich als Prozentzahl neben der Summe** — das ist offenbar wichtiger als jede Linienästhetik.

---

## Die fünf besten Vorbilder für genau diesen Fall

### 1. Vercel AI Gateway Observability
https://vercel.com/docs/ai-gateway/observability-and-spend/observability · https://vercel.com/docs/pricing/manage-and-optimize-usage

**Übernehmen:** Die Grundstruktur, fast unverändert — vier Diagramme oben (Aufrufe nach Modell, Latenz, Token, USD), darunter **mehrere Tabellen mit identischen Spalten** je Aggregationsachse (Anbieter / Modell / Zweck / Welt / Schlüsselquelle), plus den „allotment indicator": Verbrauchsbalken **und hochgerechnete Kosten in derselben Zeile**. Dazu die fünf Ansichts-Umschalter, vor allem **Ratio** — Plattform-Schlüssel gegen eigenen Schlüssel als Verhältnis, nicht als zwei Zahlen.

**Nicht übernehmen:** Vercels helle, luftige Ästhetik und den Verzicht auf jede Aggregationsachse jenseits von Projekt und Schlüssel. Ihr habt sechs Achsen; die brauchen ein dichteres Raster als Vercels großzügige Kacheln.

### 2. ECharts 6 Achsenbrüche + Matrix
`bar-breaks-simple`, `matrix-sparkline`, `confidence-band`, `dataset-link` unter `https://echarts.apache.org/examples/en/editor.html?c=<id>`

**Übernehmen:** Den **Achsenbruch für die 89/11-Schieflage** — mit `expandOnClick` wird die Verzerrung selbst zur Interaktion. Und das **Matrix-Koordinatensystem** für die Welten-mal-Modelle-Ansicht: eine echte Tabelle, deren Zellen Sparklines sind. Beides gibt es erst seit Version 6, ihr habt Version 6, und beides sieht in keiner Sekunde nach Vorgabe-ECharts aus.

**Nicht übernehmen:** Die Vorgabewerte des Bruchbereichs — `breakArea.itemStyle.color` ist `#fff`, das leuchtet auf schwarzem Grund als weißer Streifen. Und nicht den `dataZoom`-Slider: 40 px grauer Streifen unter jedem Diagramm, genau die Dichte, die ihr aufbauen wollt, wieder verloren.

### 3. Zed + Vercel Geist + Linear — der Satz
https://zed.dev/docs/visual-customization · https://vercel.com/geist/table

**Übernehmen:** Die **gemessenen Zahlen**: 15–16 px, Zeilenhöhe 1.3 für Zahlenraster. Die **Geist-Tabellenregel** wörtlich: `tabular-nums` oder Mono auf Zahlenspalten, rechtsbündig, fehlende Werte als `—`. Und **Linears Trennung**: Mono nur für Zahlen, Modell-Slugs und IDs, Sans für jede Beschriftung.

**Nicht übernehmen:** Monospace für alles. Butterick ist eindeutig — Mono im Fließtext kostet Lesbarkeit ohne Gegenwert, und die meisten Proportionalschriften liefern tabellarische Ziffern ohnehin. Ein Panel, das komplett in Mono gesetzt ist, ist ein Kostüm, kein Werkzeug.

### 4. AWS Cost Explorer + Azure Cost Analysis — die Hochrechnung
https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html · https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/quick-acm-cost-analysis

**Übernehmen:** **Ein Band, keine Linie** — 80-Prozent-Intervall als zwei Grenzen (ECharts: `confidence-band` oder `markArea`), plus die Zahl im Kopf („hochgerechnete Kosten für diesen Monat") plus **Vormonatsvergleich in Prozent daneben**. Und AWS' Sperre: **kein Forecast bei weniger als einem vollen Abrechnungszyklus Historie.** Azures Lookback-Deckelung (Prognosehorizont bestimmt Rückblicklänge) gleich mit.

**Nicht übernehmen:** Die Vorstellung, die Zeichnung erledige die Hochrechnung. Alle drei Hyperscaler stellen die Prognose **als Zahl neben die Summe**; das Band ist Beiwerk. Eine gestrichelte Linie allein wäre unterkomplex gegenüber dem, was der Markt tatsächlich zeigt.

### 5. Bloomberg Terminal + Lipgloss — die Disziplin
https://en.wikipedia.org/wiki/Bloomberg_Terminal · https://github.com/charmbracelet/lipgloss

**Übernehmen:** **Drei bis vier Farben, jede mit fester Bedeutung quer über das ganze Panel.** Replicate hat eine Farbe, OpenRouter eine, „über Budget" eine — und diese Zuordnung gilt in Balken, Tabelle, Abzeichen, Sparkline, überall gleich. Von Lipgloss: **Zeilenunterscheidung über Hintergrund statt Gitterlinien**, und selektive Rahmenkanten — eine Linie da, wo sie trennt, keine, wo sie nur Rauschen ist. Ihr habt fünf Weltfarben mit gemessenen Kontrastwerten; die sind der Bestand, aus dem die Zuordnung kommt.

**Nicht übernehmen:** Bloombergs Bernstein-auf-Schwarz als Look. Das war eine Phosphor-Notwendigkeit der Röhrenzeit, kein Designprinzip — und NN/g ist deutlich: Brutalismus trägt nur, solange Hierarchie und Ausrichtung intakt bleiben. Euer eigener `EchartsChart.ts` dokumentiert bereits, was ein Kontrast von 2,17 : 1 an Achsenbeschriftungen anrichtet.

---

## Zwei Nebenbefunde, die ich nicht unterschlagen will

**Kein einziges FinOps-Werkzeug am Markt benutzt Treemap oder Sankey für die Kostenaufschlüsselung.** Vantage nicht, Datadog nicht, der Bundeshaushalt nicht. Die Zeichnung, nach der ihr fragt, wird von denen, die sie am dringendsten bräuchten, bewusst nicht gebaut. Sie bauen sortierte Balken und aufklappbare Tabellen.

**Und Butterick sagt den unbequemen Teil:** Monospace ist zur Zahlenausrichtung gar nicht nötig — moderne Proportionalschriften liefern `tabular-nums` mit. Die Schreibmaschine ist bei euch also eine ästhetische Entscheidung, keine funktionale. Das ist völlig legitim, aber es heißt: sie muss sich an der Stelle, wo sie der Lesbarkeit im Weg steht (Beschriftungen, Erklärungen, Fließtext), zurücknehmen können, ohne dass das Panel seine Identität verliert.

---

**Nicht belegbar geblieben:** Berkeley Mono / usgraphics.com (403), Oxide-Konsole (hinter Login), Railway-Kosten-UI (keine Doku), ClickHouse Query Insights (404), Honeycomb BubbleUp (404), Kubecost-/CloudZero-/Vantage-Screenshots (nur Bilder), Mobbin/Refero/Land-book (403/429), die viralen Umsatz-Sankeys von App Economy Insights (Twitter/Reddit nicht abrufbar), Kaiser Fungs Treemap-Kritik (junkcharts.typepad.com ist tot, nur noch übers Webarchiv), sowie eine Fachquelle speziell zu stark schiefen Anteilsverteilungen in Dashboards — die gibt es vermutlich, ich habe sie nicht gefunden.

---

## Methodischer Vorbehalt (gilt durchgehend)

Websuch-Kontingent war vor Beginn erschöpft; alles stammt aus direkten Seitenabrufen und der GitHub-API. **Keine Bildauswertung möglich** — wo unten px-Werte stehen, sind sie aus Doku oder Quellcode zitiert. Farbdisziplin und Rasterabstände von Vercel, Stripe und Linear liegen **nur in PNGs** vor und wurden nicht gelesen. Geblockt (403/429): Mobbin, Refero, Land-book, usgraphics.com (Berkeley Mono), Sourcegraph, Cloudflare-Dashboard, Observable Framework.

---

## 1 + 2. Die fünf Vorbilder, mit Merkmalen

### Platz 1 — Vercel AI Gateway Observability
https://vercel.com/docs/ai-gateway/observability-and-spend/observability · https://vercel.com/docs/pricing/manage-and-optimize-usage
*(Doku als Text abrufbar, Screenshots nur als PNG — Layoutmaße also unbelegt.)*

**Übernehmen:** Die Grundstruktur fast unverändert — vier Diagramme oben, darunter mehrere Tabellen mit **identischen Spalten** je Aggregationsachse, plus Verbrauchsbalken und hochgerechnete Kosten in derselben Zeile.
**Nicht übernehmen:** Vercels helle, luftige Kachelästhetik und die Beschränkung auf zwei Aggregationsachsen — ihr habt sechs.

Konkret und wörtlich belegt:
- **Genau vier Diagramme**: Requests by Model, Time to First Token, Input/Output Token Counts, Spend.
- **Zwei Tabellen nebeneinander statt verschachtelt** — eine nach Projekt, eine nach API-Key, beide mit denselben Spalten: *„request count, average tokens, P75 duration, P75 TTFT, and cost for the specified time frame"*. Das ist die Antwort auf „Welt vs. Schlüsselquelle": zwei Tabellen, kein Umschalter.
- **Zwei Geltungsbereiche** per Dropdown in der Kopfzeile: Team (alles) und Projekt (gefiltert, gleiche Metriken). Bei euch: Plattform vs. eine Welt.
- **Drilldown, vier Stufen**: Graph → Zeitraum per Klick-und-Ziehen markieren → „Zoom In" → Modellliste neu sortiert → Zeile klicken → Detailseite → Link zu Logs. Logs sind eine **eigene Seite**, kein Aufklapper: suchbar nach Request-ID, filterbar nach Modell/Anbieter/Status-Code, Live-Follow, CSV-/JSON-Export.
- **Hochrechnung**, wörtlich: *„you'll see an allotment indicator. It shows how much of your usage you've consumed in the current cycle and the projected cost for each item."*
- **Fünf Ansichts-Umschalter pro Metrik**: Count (Summe), Project, Region, **Ratio**, Average (24-h-Mittel). Ratio ist der interessanteste — dieselbe Zahl als Verhältnis: cached vs. uncached, successful vs. errored vs. timed out. Bei euch: Plattform-Schlüssel gegen eigenen Schlüssel, Bild gegen Text.

### Platz 2 — ECharts 6: Achsenbrüche + Matrix
`https://echarts.apache.org/examples/en/editor.html?c=<id>` mit `bar-breaks-simple`, `matrix-sparkline`, `confidence-band`, `dataset-link` *(IDs über die GitHub-API von `apache/echarts-examples` verifiziert, nicht geraten)*

**Übernehmen:** Den Achsenbruch für die 89/11-Schieflage und das Matrix-Koordinatensystem für die Welten-mal-Modelle-Ansicht.
**Nicht übernehmen:** Die Vorgabewerte des Bruchbereichs (`breakArea.itemStyle.color` ist `#fff` — ein weißer Streifen auf schwarzem Grund) und den `dataZoom`-Slider (40 px grauer Streifen unter jedem Diagramm).

Details in Abschnitt 3 unten.

### Platz 3 — Zed + Vercel Geist + Linear: der Satz
https://zed.dev/docs/visual-customization · https://vercel.com/geist/table

**Übernehmen:** Die gemessenen Zahlen (15–16 px, Zeilenhöhe 1.3), die Geist-Tabellenregel wörtlich, Linears Trennung von Mono und Sans.
**Nicht übernehmen:** Monospace für alles — ein komplett in Mono gesetztes Panel ist ein Kostüm, kein Werkzeug.

Konkret:
- **Zed, dokumentierte Werte**: `ui_font_size` **16 px**, `buffer_font_size` **15 px**, `buffer_font_family` **Berkeley Mono** (Vorgabe), `buffer_line_height` `standard` = **1.3**, `comfortable` = **1.618**. Das ist der einzige belastbare Zahlenanker der ganzen Recherche. Für ein Zahlenraster ist 1.3 der richtige Pol.
- **Geist Table**, wörtlich: *„Apply `tabular-nums` (or Geist Mono) to numeric columns so digits align across rows."* Also **entweder oder**. Zweite Regel derselben Seite: fehlende Werte als **Geviertstrich `—`**, nicht „N/A", nicht leer. Bei 21 Welten × 6 Modellen ist die Mehrheit der Zellen leer — wie diese Leere aussieht, entscheidet über die Lesbarkeit der ganzen Tabelle.
- **Geist-Farbsystem**: Graustufen in zehn Stufen (`--ds-gray-100` … `--ds-gray-1000`), grob 100–300 Hintergrund, 400–600 Rahmen, 700–1000 Text. Typografie-px und Rastermaße: **nicht öffentlich**, liegen im internen Figma.
- **Linear**: Monospace ausschließlich für Issue-IDs und Codeschnipsel, sonst durchgehend Sans. Übertragen: Modell-Slugs, Aufruf-IDs, Schlüssel-Präfixe, USD-Beträge in Mono — alles Erklärende in Sans.

### Platz 4 — AWS Cost Explorer + Azure Cost Analysis: die Hochrechnung
https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html · https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/quick-acm-cost-analysis

**Übernehmen:** Ein Band statt einer Linie, plus die Prognosezahl neben der Summe, plus AWS' Sperre gegen Extrapolation aus zu wenig Historie.
**Nicht übernehmen:** Die Vorstellung, die Zeichnung erledige die Hochrechnung — alle drei Hyperscaler stellen die Prognose **als Zahl** neben die Summe; das Band ist Beiwerk.

Konkret:
- **AWS**: 80-Prozent-Prognoseintervall, bei Linien als **zwei zusätzliche Linien** ober- und unterhalb, bei Balken als zwei Linien am oberen Balkenrand. **Kein Forecast bei weniger als einem vollen Abrechnungszyklus Historie.**
- **Azure**: Forecast **nur bei Flächen- oder gestapeltem Säulendiagramm**, Methode *time series linear regression*, Einmalspitzen filterbar. Lookback-Regel: bis 28 Tage Prognose → 28 Tage Rückblick, über 90 Tage → auf 90 gedeckelt. Bei gesetztem Budget wird angezeigt, **wann** die Prognose es überschreitet.
- **GCP**: Prognose **hellgrau eingefärbt**, nicht gestrichelt.
- Gemeinsames Muster, das der naheliegenden Lösung widerspricht: **keiner der drei benutzt eine gestrichelte Linie als alleiniges Signal**, und alle drei zeigen den **Vormonatsvergleich als Prozentzahl neben der Summe**.

### Platz 5 — Bloomberg Terminal + Lipgloss: die Disziplin
https://en.wikipedia.org/wiki/Bloomberg_Terminal · https://github.com/charmbracelet/lipgloss

**Übernehmen:** Drei bis vier Farben, jede mit fester Bedeutung quer über das ganze Panel; Zeilenunterscheidung über Hintergrund statt Gitterlinien.
**Nicht übernehmen:** Bernstein-auf-Schwarz als Look — das war eine Phosphor-Notwendigkeit der Röhrenzeit, kein Designprinzip.

Konkret:
- **Bloomberg** (belegt): schwarze Oberfläche seit Einführung, eigene Tastatur mit **Farbcode statt Beschriftung** (rot = Cancel, grün = GO, gelb = Marktsektoren), typischerweise **vier Panels pro Monitor**. Die Lehre ist nicht die Optik, sondern: **Farbe ist Datenklasse, nicht Dekor.** Replicate hat eine Farbe, OpenRouter eine — und die gilt in Balken, Tabelle, Legende, Abzeichen, überall.
- **Lipgloss**: `StyleFunc(row, col)`, Zeilenunterscheidung über **Hintergrundfarbe**, Rahmen-Presets plus **selektive Kanten** (`BorderTop(true)`). Eine Linie da, wo sie trennt, keine, wo sie nur Rauschen ist.

---

## 3. ECharts im Kern

**Taugt für Kosten:** Gestapelte Balken über Zeit (Arbeitspferd, aber nur die unterste Kategorie hat eine echte Nulllinie — bei 5 Zwecken sind 4 Bänder schlecht vergleichbar). Kalender-Heatmap (die einzige Form, in der 21 Welten × 365 Tage auf einen Schirm passen; zeigt Rhythmus, nicht Betragshöhe). Achsenbrüche. Matrix.

**Taugt nicht:** **Sunburst** — äußere Ringe haben noch weniger Fläche als eine Treemap und noch schwerer vergleichbare Winkel. **themeRiver** — schön, für Beträge unlesbar. Beide weglassen.

**Der Achsenbruch** (`bar-breaks-simple`, im Quelltext `since: 6.0.0`):
```js
yAxis: { type: 'value',
  breaks: [{ start: 5000, end: 100000, gap: '1.5%' }],
  breakArea: { itemStyle: { opacity: 1 } } }
```
Weitere Schlüssel: `breaks[].isExpanded`, `breakArea.itemStyle.color` (**Vorgabe `#fff`, auf dunkel zwingend überschreiben**), `.borderColor` (`#b7b9be`), `zigzagAmplitude` (4), `zigzagMinSpan` (4), `zigzagMaxSpan` (20), **`expandOnClick`** (Vorgabe `true`). Der Bruch ist selbst die Aussage: „hier ist eine Größenordnung übersprungen" — und ein Klick stellt die wahren Proportionen her.

**Matrix** (`matrix-sparkline`, `since: 6.0.0`) — eine echte Tabelle, deren Zellen Diagramme sind: `matrix.x.data`, `matrix.y.data`, `levelSize`, `corner`, `body` mit `mergeCells`. 21 Welten in Zeilen, 6 Modelle in Spalten, je Zelle ein Sparkline. Dicht, tabellarisch und grafisch zugleich, und kein bisschen nach Vorgabe-ECharts. Nach meiner Einschätzung der stärkste Einzelhebel der Recherche.

**Die Interaktionskomponenten, bewertet:**
- **`dataZoom`** — ja, aber `type: 'inside'`, **nicht** `slider`.
- **`tooltip.axisPointer`** — das Wichtigste. `trigger: 'axis'`, `axisPointer: { type: 'cross', animation: false }`. `animation: false` ist entscheidend, ein nachziehendes Fadenkreuz ist bei dichten Zahlen Rauschen. TradingViews Verhalten ist präziser als ein schwebender Kasten: Werte erscheinen **als Label auf beiden Achsen** (`axisPointer.label`).
- **`markLine`** — ja, für die Hochrechnung. `{ type: 'average' }`, `{ yAxis: <Budget> }`, oder zwei Koordinatenpaare; `lineStyle.type: 'dashed'`, `label.formatter`, **`silent: true`** (sonst fängt die Linie Mausereignisse ab). `markArea` schattiert „Rest des Monats".
- **`visualMap`** — nur für Kalender-Heatmap und Treemap-Färbung. Für Balken über Zeit falsch: Farbe trägt dort die Kategorie, nicht den Betrag.
- **`brush`** — **nein.** Die Referenz ist klar: brush wählt aus und hebt hervor, ohne die Achsen zu ändern; `dataZoom` ändert den Ausschnitt. Für Zeitraumwahl ist `dataZoom` richtig.

**Der korrigierte Code-Ausschnitt:**
```js
grid: {
  left: 0, right: 0, top: 8, bottom: 0,
  outerBoundsMode: 'same',          // containLabel ist seit 6.0.0 abgekündigt
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
Die vier größten Hebel: **Legende weg, Achsenlinien weg, Splitlines gestrichelt und sehr dunkel, `grid.left/right` auf 0.** Die Vorgabe-Ränder sind der Hauptgrund, warum Vorgabe-ECharts nach Vorgabe-ECharts aussieht.

**Registrierung fehlt im Repo:** `EchartsChart.ts` kennt heute nur Bar, Line, Heatmap, Radar, Custom + Grid, Legend, Tooltip, VisualMap, Radar. Für ein Kostenpanel fehlen `TreemapChart`, `SankeyChart`, `DataZoomComponent`, `MarkLineComponent`, `MarkAreaComponent`, `ToolboxComponent`, `GraphicComponent`, `DatasetComponent`, `TransformComponent`, `MatrixComponent`. Erster Schritt, unabhängig vom Vorbild.

---

## 4. Wohin fließt das Geld

**Der wichtigste Befund ist ein negativer.** **Vantage** (der Spezialist für Cost Reports) dokumentiert Balken, Linien, Flächen und Kreis — **weder Treemap noch Sankey**. Datadog beschreibt Kosten nur als Zeitreihen. **Bundeshaushalt.de**, der Lehrbuchfall für einen Ausgaben-Sankey, benutzt **isolierte Einzelbalken**. Drei unabhängige Akteure, die die Zeichnung bauen könnten, bauen sie nicht.

**Warum Treemap bei 89/11 versagt:** data-to-viz belegt drei Einwände — das Auge kann Flächen nicht in Zahlen zurückübersetzen (`caveat/area_hard.html`), kleine Kacheln haben keinen Platz für Text (`caveat/hard_label.html`), und wörtlich: *„Don't annotate more than 3 levels of the hierarchy, it would make the figure unreadable."* Dazu ECharts' eigene Vorgabe `visibleMin: 10`, die Knoten unter 10 px **stillschweigend ausblendet**. Bei 89/11 wäre eine Kachel achtmal so groß wie die andere — und *innerhalb* der kleinen 11-Prozent-Kachel müssten die Textmodelle noch untergebracht werden. Das ist keine Zeichnung, das ist ein Rätsel.

**Warum Sankey versagt:** 2 Anbieter → 6 Modelle → 5 Zwecke ergibt bis zu **30 dünne Verbindungen** zwischen Stufe 2 und 3 — genau der Überfüllungsfall, vor dem data-to-viz warnt. Ein Sankey lohnt bei euch an genau **einer** Stelle: **Schlüsselquelle → Anbieter → Kosten**, also 2 → 2 → Betrag. Vier Knoten, vier Fäden. Das beantwortet die eine Frage, die eine Tabelle schlecht beantwortet: wie viel Geld durch Schlüssel fließt, für die *wir* zahlen.

**Stattdessen richtig:**
1. **Ein einziger waagerechter 100-Prozent-Balken** für Bild gegen Text, volle Panelbreite, Beschriftung im Balken. Kein Kreis — Winkelwahrnehmung ist bei extremen Verhältnissen besonders schlecht.
2. **Sortierte Tabelle mit eingebetteten Balken** darunter: Zweck, Modell, Welt je absteigend nach USD, rechtsbündig, `tabular-nums`, Anteilsspalte, Sparkline der letzten 30 Tage. *(Data Bars in Tabellen ist etabliertes Fachwissen — Fews PDF ließ sich nicht extrahieren, in dieser Sitzung also nicht neu belegt.)*
3. **Aufklappbare Zeilen statt einer zweiten Zeichnung.** Azure wörtlich: *„Expand rows to take a quick peek and see how costs are broken down to the next level."* Bild aufklappen → 5 Zwecke → 6 Modelle. Kein Darstellungswechsel, kein Kontextverlust.
4. **Keine Log-Skala.** Datawrapper warnt vor Log dort, wo der Unterschied gefühlt werden soll. Bei euch soll man 89 Prozent **sehen**. Der Achsenbruch macht die Größenordnung sichtbar, statt sie zu glätten.

**Wann eine Treemap dann doch:** für **eine** Frage — die 21 Welten, alle Kosten zusammengefasst, eine Ebene, keine Verschachtelung. Vorlagen: `treemap-show-parent`, `treemap-drill-down` und `treemap-obama` (der Obama-Budget-Treemap, der meistzitierte Fall genau dieser Fragestellung).

---

## 5. Der Monospace-Strang — und wo er kippt

**Wer es gut macht:** Zed (Werte oben). Linear (Mono nur für Kennungen). Warp — https://docs.warp.dev/terminal/blocks, wörtlich *„A Block groups commands and outputs into one atomic unit"*, kopierbar und durchsuchbar; übertragen: eine Abrechnungsperiode als abgegrenzter Block, nicht als weitere Zeile in 400. Charm/Lipgloss (Zebra statt Gitter; über 18.000 bekannte Anwendungen, darunter `gh-dash`). Terminal.shop als Härtefall — Navigation als `[terminal] [cron] [api]`, Bestellung tatsächlich per `ssh terminal.shop`; es ist kein Kostüm, weil das Terminal die Sache selbst ist.

**Wo es kippt — drei belegte Grenzen:**
1. **NN/g** (https://www.nngroup.com/articles/brutalism-antidesign/) trennt Brutalismus (roh, unverziert) von Anti-Design (aktiv desorientierend, fehlende Hierarchie). Kernsatz: *„Niemand beschwert sich, dass eine Website zu leicht zu verstehen ist."* Positivbeispiel Adult Swim: brutalistischer Look, **Navigation bleibt klar**. Genau darin liegt die Grenze.
2. **Butterick** (https://practicaltypography.com/monospaced-fonts.html): Mono ist für Fließtext unterlegen, legitim nur für Code und tabellarische Zahlen. Und der unbequeme Nachsatz: **die meisten Proportionalschriften liefern tabellarische Ziffern von Haus aus** — Monospace ist zur Zahlenausrichtung gar nicht nötig, nur zur Ästhetik. Das ist legitim, heißt aber: sie muss sich bei Beschriftungen und Fließtext zurücknehmen können, ohne dass das Panel seine Identität verliert.
3. **Der Kontrast.** Euer eigener `EchartsChart.ts` dokumentiert bereits einen Fall, in dem `#94a3b8` auf Papiergrund bei **2,17 : 1** landete — und damit jede Achsenbeschriftung der Plattform auf einen Schlag unlesbar machte.

**Operative Regel:** Mono für Zahlen, IDs, Slugs. Sans für alles Erklärende. Nie beides im selben Absatz.

**Typografie-Feinheiten** (MDN belegt): `font-variant-numeric: tabular-nums` (OpenType `tnum`), Baseline-Support seit Januar 2020 — **wirkt nur, wenn die Schrift das Feature mitbringt**. `slashed-zero` laut MDN für Code-Kontexte, für Geldbeträge entbehrlich. `oldstyle-nums` ist hier **schädlich**, zerstört die Ausrichtung. Fallback: `font-feature-settings: "tnum"`.

---

## 6. Filterleisten, Zeiträume, Vorperiodenvergleich

**Grafana hat das beste Vokabular** (https://grafana.com/docs/grafana/latest/dashboards/):
- Relative Freitextzeiten mit Einheiten `s m h d w M Q y` — man tippt „13h".
- Absolute Zeiten über From/To oder Kalender.
- **Semi-relativ**: fester Anfang, `now` als Ende. Das ist genau „seit Monatsbeginn bis jetzt" und in Web-Dashboards selten kopiert.
- Tastenkürzel `t+` / `t-` zum Zoomen; Zoom per Klick-und-Ziehen im Graph.
- **Grafana Scenes** führt **Vergleichszeitraum** als eigenes Konzept, nicht als Filteroption.

**Sentry: Granularität ableiten, nicht anbieten** (https://docs.sentry.io/product/stats/) — bei 7 Tagen ein Balken pro Stunde, bei 90 Tagen ein Balken pro Tag, Maximum 90 Tage. Kein Nutzer stellt Auflösung ein.

**Sentrys Kategorienlehre**, ebenfalls übertragbar: fünf gleichrangige Kategorien statt Erfolg/Fehler — Accepted, Filtered, Rate Limited, Invalid, Client Discard. Äquivalent bei euch: durchgeführt / gedrosselt / abgebrochen / fehlgeschlagen / aus dem Cache. Ein einzelner „Fehler"-Balken verschenkt die Diagnose.

**Vorperiodenvergleich:** alle drei Hyperscaler zeigen ihn **als Prozentzahl neben der Summe** in der KPI-Kachel, nicht als zweite Linie im Diagramm. Azure explizit als Vormonatsvergleich neben dem Total.

**Ein Detail von Railway** (https://docs.railway.com/reference/metrics): **Deployments als gestrichelte Senkrechte in der Zeitreihe.** Bei euch die Senkrechte, wenn ein Modell oder ein Preis gewechselt wurde. Ein Kosten-Dashboard hat Railway laut Doku nicht.

**Axiom** (https://axiom.co/docs/monitor-data/dashboards): Explorer-Fluss **Source → Filter → Summarize → Time range**, zehn Kacheltypen, darunter **Statistic** und **Table** als eigenständige Typen.

**Die Achsenliste, geprüft:** LiteLLMs `LiteLLM_SpendLogs` (https://docs.litellm.ai/docs/proxy/cost_tracking) enthält `api_key, user, team_id, request_tags, end_user, model_group, api_base, spend` plus Token-Zahlen. Das ist exakt euer Datenmodell — wer wissen will, welche Filterachsen ein Kostenpanel braucht, findet hier die im Betrieb bewährte Liste. Die UI selbst ist nur hinter dem eigenen Proxy sichtbar. **Langfuse** nennt vier Kostenzerlegungen als *die* vier: Token-Trend, Kosten je Nutzer, Modellvergleich, **Kosten je Feature** — Letzteres ist euer „Zweck".

---

## Galerien, kurz

**Nur zwei taugen:** **Nicelydone** (nicelydone.**club**, kostenloses Tier ohne Kreditkarte, 201.800+ Screenshots von 500+ echten SaaS-Apps) mit den Kategorien *Dashboard & Stats*, *Billing*, *Charts*; und **SaaS Interface** (saasinterface.com, freemium) mit `/pages/dashboard/` und `/pages/billing-plan/`. **Dark Mode Design** ist ohne Schranke, ohne Taxonomie, nennt aber zwei brauchbare Namen: **oxide.computer** und **betterstack.com**. **Godly** und **Screenlane** existieren in der gefragten Form **nicht mehr**. **Pageflows** hat eine harte Bezahlschranke. **UI Sources** leitet auf iOS-Apps um, für euch irrelevant. **Mobbin, Refero, Land-book** waren nicht prüfbar (403/429).

**Unbelegt geblieben:** Berkeley Mono (403), Oxide-Konsole (Login), Railway-Kosten-UI (keine Doku), ClickHouse Query Insights (404), Honeycomb BubbleUp (404), Kubecost/CloudZero/Vantage-Screenshots (nur Bilder), die viralen Umsatz-Sankeys von App Economy Insights, sowie eine Fachquelle speziell zu stark schiefen Anteilsverteilungen in Dashboards.