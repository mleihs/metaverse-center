# AUFTRAG

Recherchiere gründlich im Web (WebSearch + WebFetch) FÜNF SPEZIALFRAGEN der Datenvisualisierung/Dashboard-Gestaltung. Ich brauche belegte Praxisbeispiele aus echten Produkten UND aus der Visualisierungsliteratur, mit URLs.

FRAGE 1 — Prognose ehrlich zeigen.
Wie stellt man eine Hochrechnung/Forecast in einem Zeitreihen-Chart dar, ohne sie wie eine Messung aussehen zu lassen? Suche nach: Konventionen für gestrichelte Linie ab "heute", Konfidenzband/Prediction Interval (Fan Chart), Aufhellen zukünftiger Balken, vertikale "now"-Trennlinie. Belege aus: Vega-Lite/Observable Plot Beispielen, Highcharts/ECharts Doku (z.B. ECharts markArea/markLine, "confidence band" Beispiele), Bank-of-England-Fan-Chart, FiveThirtyEight-Konventionen, AWS/GCP/Azure Forecast-UIs. Auch: Kritik an Prognosedarstellung (warum ein Punktwert ohne Band irreführt).

FRAGE 2 — Datenlücken (missing data) im Chart und in der Tabelle.
Wie unterscheidet man "kein Wert vorhanden" von "Wert = 0"? Suche: Konventionen zum Linienunterbrechen (gap) vs. durchziehen, ECharts `connectNulls`, Highcharts `nullFormat`/`connectNulls`, Vega-Lite `impute`, Grafana "No data" vs. "null" und `connectNulls`-Option, Datadog. Und für TABELLEN: wie kennzeichnet man eine Zeile ohne Kosten/Token — Gedankenstrich "—", "n/a", graues Feld? Gibt es Doku/Design-Systeme (z.B. Carbon, Polaris, Atlassian, Material) mit einer Regel für "empty cell vs zero"? Wie verhindert man, dass fehlende Werte als 0 in einen Mittelwert eingehen — welche Tools 

---

Recherche abgeschlossen. Hier die Ergebnisse.

---

# Vorbemerkung zur Methode

Das WebSearch-Kontingent dieser Sitzung war zu Beginn bereits aufgebraucht (200/200). Ich habe deshalb ausschließlich mit **WebFetch direkt auf Primärdokumentation** gearbeitet – Herstellerdoku, Normtexte, Fachartikel. Das ist für Belegqualität sogar besser (keine Suchsnippets, sondern Originalseiten), kostet aber Breite: Quellen, deren URL ich nicht erraten konnte, fehlen. Diese Lücken benenne ich jeweils als „nichts gefunden".

Alle Zitate unten sind wörtlich aus der jeweils abgerufenen Seite, außer wo ich „(sinngemäß)" schreibe.

---

# FRAGE 1 — Prognose ehrlich zeigen

## 1.1 Der stärkste Beleg: Bank of England, warum der Punktwert abgeschafft wurde

Der wichtigste Fund ist der Aufsatz, mit dem die Bank of England 1998 ihren eigenen Wechsel vom Punktwert zum Fächerdiagramm begründet hat: Britton, Fisher, Whitley, *The Inflation Report projections: understanding the fan chart*, Bank of England Quarterly Bulletin, Februar 1998.

Die Bank beschreibt dort ihre **frühere** Darstellung (Mittellinie plus symmetrisches Fehlerband) und deren Scheitern wörtlich so:

> „That chart was not completely satisfactory. It gave no weight to the discussion of risks to the forecast (or alternative scenarios) and encouraged the reader to concentrate on an apparently precise central projection, ignoring the very wide degree of uncertainty surrounding it. Hence, small changes in the projection were given too much prominence relative to the risk assessment."

Und der zweite Fehler, der für jede Bandbreitendarstellung gilt:

> „In addition, the shaded area itself was often misread as indicating upper and lower bounds for the forecast, rather than the representation of probabilities that it actually showed."

Das Ziel der neuen Darstellung:

> „The aim of the fan chart has been to convey to the reader a more accurate representation of the Bank's subjective assessment of medium-term inflationary pressures, **without suggesting a degree of precision that would be spurious**."

Das ist genau Ihre Frage, von der Institution beantwortet, die am meisten zu verlieren hatte.

**Konstruktionsregel des Fächers, wörtlich:**

> „Two points of equal probability density are shown, one on either side of the mode. The two points are then moved away from the centre simultaneously, keeping the values of the probability density the same, until there is 10% of the distribution in a single central band, with these two points marking the outside edges. That band is coloured the deepest shade of red. […] Pairs of bands continue to be added until 90% of the distribution is covered."

> „There is an equal number of red bands on either side of the central band (eight). Each pair of bands covers 10% of the distribution but, if the risks are unbalanced, the same colour bands are not of equal width."

> „The distribution is truncated, so that there is an implicit ninth and final pair of bands, occupying the white space outside the 90% covered."

Bemerkenswert für die Gestaltung: **Es gibt keine Mittellinie.** Die zentrale Projektion ist nur „by construction, always in the deepest red band". Der Fächer weigert sich also aktiv, dem Auge eine Linie zum Ablesen anzubieten. Und: die Verbreiterung nach rechts ist keine Dekoration, sie kodiert, dass die Unsicherheit mit dem Horizont wächst (die Bank zeigt das im Aufsatz zusätzlich als 3D-Chart mit Wahrscheinlichkeit auf der Vertikalen).

Quelle: https://www.bankofengland.co.uk/-/media/boe/files/quarterly-bulletin/1998/the-inflation-report-projections-understanding-the-fan-chart.pdf

## 1.2 Cloud-Anbieter: wie Prognose in echten Kosten-UIs aussieht

### AWS Cost Explorer – der ausführlichste Text, den ich gefunden habe

> „Because forecasts are predictions, the forecasted billing amounts are estimated and might differ from your actual charges for each statement period."

> „Like weather forecasts, billing forecasts can vary in accuracy. Different ranges of accuracy have different prediction intervals. The higher the prediction interval, the more likely the forecast has a wider range. For example, suppose that you have a budget set to 100 dollars for a given month. An 80% prediction interval might forecast your spend between 90 and 100, with a mean of 95. The range in the prediction band is dependent on your historical spend volatility."

> „Cost Explorer forecasts have a prediction interval of 80%. **If AWS doesn't have enough data to forecast an 80% prediction interval, Cost Explorer doesn't provide a forecast.** This is common for accounts that have less than one full billing cycle."

Und – für Ihre Frage der eigentliche Kern – wie es *gezeichnet* wird:

> „The 80% prediction interval appears differently on each type of chart:
> - Line charts represent the prediction interval as a set of lines that are on either side of your costs line.
> - Bar charts represent the prediction interval as two lines that are on either side of the top of your bar."

Zwei Lehren daraus, die ich für die wertvollsten des ganzen Abschnitts halte:

1. **AWS zeigt lieber gar keine Prognose als eine ohne Intervall.** Das ist die radikalste Form von Ehrlichkeit: die Weigerung, zu extrapolieren, wenn die Datenbasis das Band nicht trägt.
2. Auch beim **Balkendiagramm** wird das Intervall gezeigt – als zwei Linien über/unter der Balkenoberkante. Ein Balken hat keine natürliche Stelle für ein Band, AWS erfindet sie trotzdem.

Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html

### Google Cloud Billing Reports – Aufhellen als Konvention

> „The chart also includes forecasted costs, **indicated in the chart in light gray**, helping you visualize how your forecasted costs are trending."

> „The report chart includes forecasted costs if the date range ends on a *future* date."

Das ist der Beleg für „zukünftige Balken aufhellen", nach dem Sie gefragt hatten. GCP entsättigt vollständig auf Grau – die Prognose verliert also nicht nur Sättigung, sie verliert die **Serienfarbe** und damit die Zugehörigkeit zur gemessenen Reihe. Kein Intervall allerdings.

Quelle: https://docs.cloud.google.com/billing/docs/how-to/reports

### Azure Cost Management

> „Your forecast is a projection of your **estimated** costs for the selected period."

> „Forecasting employs a *time series linear regression* model, which adjusts to factors such as reserved instance purchases that temporarily affect forecasted costs."

> „For accurate long-term forecasting, it's essential to have sufficient historical data. New subscriptions or contracts with limited historical data might result in less accurate forecasts. At least 90 days of historical data are recommended for a more precise annual forecast."

Azure benennt also die Datenbasis-Bedingung im Text, blendet die Prognose aber nicht aus (anders als AWS). Die Forecast-KPI ist zudem hinter einem Preview-Flag („Cost Management Labs"). Ein Konfidenzband ist in dieser Doku **nicht** erwähnt – nichts gefunden.

Quelle: https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/quick-acm-cost-analysis

## 1.3 Umsetzung in Bibliotheken

| Mittel | Bibliothek | Beleg |
|---|---|---|
| Konfidenzband als eigener Mark | Vega-Lite `errorband` | `ci` = „Extend the band to the 95% bootstrapped confidence interval of the mean"; `stderr` (Default), `stdev`, `iqr` |
| Band + Linie geschichtet | Vega-Lite Beispiel `layer_line_errorband_ci` („Line Chart with Confidence Interval Band") | errorband-Layer unter dem line-Layer im `layer`-Array |
| Prognoseabschnitt anders stricheln | Highcharts `zones` | „An array defining zones within a series"; jede Zone kennt `dashStyle`, `fillColor`, `color`, `className`, `value` |
| Vertikale „jetzt"-Trennung / Zukunftsfläche | Highcharts `xAxis.plotBands` | „An array of colored bands stretching across the plot area marking an interval on the axis" |

Quellen:
https://vega.github.io/vega-lite/docs/errorband.html ·
https://vega.github.io/vega-lite/examples/ ·
https://api.highcharts.com/highcharts/plotOptions.series.zones ·
https://api.highcharts.com/highcharts/xAxis.plotBands

**ECharts `markArea` / `markLine`:** Die ECharts-Optionsreferenz ist eine JS-App und über WebFetch nicht auslesbar; die Partial-Datei im Doku-Repo (`en/option/partial/marker.md`) enthält nur Koordinatenspezifikationen, keine Zweckbeschreibung. Für `markArea`/`markLine` und das offizielle „confidence-band"-Beispiel: **nichts belegbar gefunden.** Die Bausteine existieren, ich kann sie nur nicht zitieren.

## 1.4 Eine Konvention, die niemand sonst hat: das Prognose-Kürzel in der Tabelle

Die britische Government Analysis Function (verbindlicher Standard für amtliche Statistik in UK) schreibt für Tabellen ein Kürzel je Zelle vor – darunter:

- **`[f]` = forecast**
- **`[e]` = estimated**
- **`[p]` = provisional**

> „Whenever a table contains shorthand, you should mention it and explain what the shorthand means. The best place to do this is above the table."

Das ist die Tabellen-Entsprechung zur gestrichelten Linie: **jede einzelne Zelle trägt ihren epistemischen Status mit sich**, nicht nur die Spaltenüberschrift. Für ein Kosten-Dashboard mit Chart *und* Tabelle ist das die saubere Antwort auf „wie markiere ich die Hochrechnungszeile".

Quelle: https://analysisfunction.civilservice.gov.uk/policy-store/symbols-in-tables-definitions-and-help/

## 1.5 Nichts gefunden

- **FiveThirtyEight-Konventionen**: Die Seite ist zu ABC News umgezogen (301 auf `abcnews.com/politics`), die Methodikartikel sind unter den alten URLs weg. Nichts belegbar.
- **Hullman, „Why Authors Don't Visualize Uncertainty"**: PDF unter der bekannten Northwestern-URL ist 404, die Autorenseite ist „Under Construction", der OSF-Preprint lieferte keinen Text. Ich habe den Aufsatz **nicht** belegen können und zitiere ihn deshalb nicht. Die BoE-Quelle trägt das Argument ohnehin – und mit mehr Autorität, weil sie den Fehler an sich selbst beschreibt.

## 1.6 Ableitung für Ihr Dashboard

Aus den Belegen ergibt sich eine Rangfolge der Mittel, nicht eine Liste:

1. **Kein Band → keine Prognose.** Die AWS-Regel ist die härteste und die einzige, die den Fehler unmöglich macht statt ihn zu beschriften.
2. **Farbe entziehen, nicht nur Deckkraft** (GCP: light gray). Ein aufgehellter Balken in Serienfarbe liest sich noch als Messung; ein grauer nicht.
3. **Strichelung** (Highcharts `zones` mit `dashStyle`) ist die schwächste der drei Markierungen – sie überlebt Schwarzweißdruck und Farbenblindheit, aber sie sagt nichts über die Breite der Unsicherheit.
4. Die Mittellinie im Prognosebereich **wegzulassen** (BoE) ist stärker als sie zu stricheln. Was nicht da ist, kann nicht abgelesen werden.

---

# FRAGE 2 — Datenlücken im Chart und in der Tabelle

## 2.1 Der Normtext, der die ganze Frage beantwortet

Die UK Government Analysis Function unterscheidet in ihrer verbindlichen Tabellen-Kurzschrift **fünf verschiedene Arten von „kein Wert"** – und trennt sie sauber von der Null:

| Kürzel | Bedeutung (wörtlich) |
|---|---|
| `[x]` | not available |
| `[z]` | not applicable |
| `[c]` | confidential |
| `[w]` | none recorded in survey |
| `[low]` | „a low figure but not a real zero" |
| `[u]` | low reliability |
| `[b]` | break in time series |

Die Kernregel, wörtlich:

> **„A zero or '0' should only be used when a data point is a true zero."**

Und der Grenzfall, den fast jedes Dashboard falsch macht:

> `[low]` = „a low figure but not a real zero" – zu verwenden, wenn gerundete Daten als Null erscheinen, es aber nicht sind.

Das ist eine Unterscheidung, die in Software praktisch nie existiert: **gerundete Null ≠ echte Null ≠ kein Wert.** Bei Token-Kosten ist das unmittelbar relevant – ein Aufruf für 0,00003 USD zeigt bei zwei Nachkommastellen „0,00" und ist damit optisch von „nichts gekostet" und von „nicht abgerechnet" ununterscheidbar.

Quelle: https://analysisfunction.civilservice.gov.uk/policy-store/symbols-in-tables-definitions-and-help/

## 2.2 Eurostat: dieselbe Trennung, andere Zeichen

- `:` = not available
- `-` = not applicable
- `0` = real zero
- `0n` = „less than half of the final digit shown and greater than real zero"
- `e` = estimated · `p` = provisional · `f` = forecast · `c` = confidential · `u` = low reliability · `|`/`b` = break in time series

Eurostat warnt zusätzlich davor, zu viele Flags zu setzen (sinngemäß: der Leser wird von Metadaten erschlagen). Auch das ist eine Gestaltungsregel: Die Kennzeichnung muss die Ausnahme markieren, nicht den Normalfall verrauschen.

Quelle: https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Tutorial:Symbols_and_abbreviations

## 2.3 Charts: was die Bibliotheken tun

| Bibliothek | Option | Wortlaut | Default |
|---|---|---|---|
| ECharts | `series-line.connectNulls` | „Whether to connect the line across null points." | **`false`** |
| Highcharts | `plotOptions.line.connectNulls` | „Whether to connect a graph line across null points, or render a gap between the two points on either side of the null." | **`false`** |
| Chart.js | `spanGaps` | „If true, lines will be drawn between points with no or null data. If false, points with `null` data will create a break in the line." | `undefined` (= Lücke) |
| Grafana | Connect null values | „Choose how null values, which are gaps in the data, appear on the graph." – Never / Always / **Threshold** | – |

Grafana ist hier am differenziertesten: die dritte Option **Threshold** – „Specify a threshold above which gaps in the data are no longer connected" – ist die einzige, die dem eigentlichen Problem gerecht wird. Eine Lücke von 30 Sekunden bei Minutenauflösung ist Rauschen; eine Lücke von sechs Stunden ist ein Ausfall. Eine binäre Ja/Nein-Option muss bei einer der beiden Situationen lügen.

Grafana hat zusätzlich das Spiegelbild, **Disconnect values**: „Choose whether to set a threshold above which values in the data should be disconnected." – also das gezielte Aufbrechen einer Linie, die sonst fälschlich durchginge.

Quellen:
https://raw.githubusercontent.com/apache/echarts-doc/master/en/option/series/line.md ·
https://api.highcharts.com/highcharts/plotOptions.line.connectNulls ·
https://www.chartjs.org/docs/latest/charts/line.html ·
https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/

**Wichtiger Nebenbefund bei Highcharts:** „In stacked area charts, when `connectNulls` is set to true, **null points are treated as zero values**." Genau die Verwechslung, die Sie vermeiden wollen, ist also in einer Standardoption einer Standardbibliothek eingebaut.

## 2.4 Der gefährlichste Fund: Interpolation, die per Default an ist

Datadogs `fill()` bietet vier Modi:

> `linear`: „Gives you a linear interpolation between the beginning and the end of the gap."
> `last`: „Fills the gap with the last value of the gap."
> `zero`: „Fills the gap with a zero value."
> `null`: „Deactivates the interpolation."

Und:

> „Interpolation is enabled by default for `GAUGE` type metrics."

Default-Limit 300 Sekunden, maximal 600. Das heißt: In Datadog wird eine Lücke von bis zu fünf Minuten in einer Gauge-Metrik **stillschweigend überbrückt**, ohne dass irgendetwas im Chart darauf hinweist. Wer die Zahl nicht kennt, sieht eine durchgezogene Linie und hält sie für gemessen.

Prometheus geht den umgekehrten Weg und macht Fehlen explizit:

> „If a target scrape or rule evaluation no longer returns a sample for a time series that was previously present, this time series will be marked as stale."
> „Such time series will disappear from graphs at the times of their latest collected sample, and they will not be returned in queries after they are marked stale."

Lookback-Fenster: 5 Minuten (`--query.lookback-delta`).

Quellen: https://docs.datadoghq.com/dashboards/functions/interpolation/ · https://prometheus.io/docs/prometheus/latest/querying/basics/

## 2.5 Vega-Lite `impute` — und warum es der Gegner ist, nicht der Freund

> „groups data and determines missing values of the `key` field within each group"

Methoden: `value` (Konstante), `mean`, `median`, `max`, `min`. `keyvals` ist Pflicht, wenn keine Gruppierung existiert.

`impute` **erfindet Datenpunkte**. Für Ihren Zweck ist es das Werkzeug, das man kennen muss, um es nicht zu benutzen: Ein imputierter Punkt ist im fertigen Chart von einem gemessenen nicht mehr unterscheidbar. Wenn er unvermeidlich ist, gehört er in eine eigene, sichtbar anders gestaltete Reihe – sonst gilt exakt die BoE-Kritik aus Frage 1.

Quelle: https://vega.github.io/vega-lite/docs/impute.html

## 2.6 Tabellen: der Platzhalter

**Grafana** ist das einzige Produkt, für das ich eine explizite, dokumentierte Default-Regel gefunden habe:

> „Enter what Grafana should display if the field value is empty or null. **The default value is a hyphen (-).**"

Das ist der Beleg für den Gedankenstrich als Konvention – nicht als Geschmacksfrage, sondern als Werksvorgabe eines der meistgenutzten Dashboard-Werkzeuge.

Quelle: https://grafana.com/docs/grafana/latest/panels-visualizations/configure-standard-options/

**AWS Cost Anomaly Detection** liefert die schönste Begründung für „n/a" statt „0", weil sie den mathematischen Grund mitliefert:

> „**Impact %** – The percentage difference between the actual spend and expected spend. It is calculated as (total cost impact / expected spend) * 100. […] **This value cannot be calculated when expected spend is zero, so in those situations the value will show as 'N/A'.**"

Ein undefinierter Quotient wird als `N/A` gezeigt, nicht als 0 und nicht als leer. Genau die Trennung, nach der Sie fragen, in einem Produktions-UI.

Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html

## 2.7 Nichts gefunden

- **Design-Systeme mit einer Regel „empty cell vs zero":** Carbon (Data Table Usage) lieferte keinen solchen Abschnitt, Polaris leitet inzwischen auf `shopify.dev/docs/api/polaris` um, Material 2 Data Tables lieferte nur den Seitentitel, Atlassian habe ich nicht auflösen können. **Ich habe in keinem der großen Design-Systeme eine ausdrückliche Regel zu leeren Zellen, Null vs. fehlend oder Platzhalterzeichen gefunden.**

  Das halte ich für ein Ergebnis und nicht für eine Lücke: Die Design-Systeme der Produktwelt behandeln Tabellen als Layout-Problem. Die Regel existiert – aber in der **amtlichen Statistik**, nicht im UI-Design. Wer sie braucht, muss bei Analysis Function und Eurostat abschreiben, nicht bei Carbon.

- **Zählbasis „n = 42 von 50":** Ich habe **kein** Werkzeug gefunden, das die Zählbasis eines Mittelwerts neben dem Mittelwert ausweist. Weder in Grafana- noch in Datadog- noch in AWS-Doku. Das ist die auffälligste Leerstelle der gesamten Recherche – und damit eine echte Gelegenheit: Eine Kachel „Ø 0,004 USD (n = 42 von 50)" wäre nach allem, was ich gesehen habe, ungewöhnlich ehrlich.

---

# FRAGE 3 — „geschätzt" vs. „abgerechnet"

## 3.1 LLM-Werkzeuge: was in der Doku wirklich steht

### Helicone — sagt „estimate" ausdrücklich

> „We capture this data, and we **estimate** the cost based on the model returned in the response body, using OpenAI's pricing tables."

Und der Disclaimer:

> „Please note that these methods are based on our current understanding and may be subject to changes in the future as APIs and token counting methodologies evolve."

Für Anthropic zählt Helicone Tokens selbst nach, „because there is no supported method for calculating tokens in Typescript" – die Zahl ist also nicht einmal vom Anbieter, sondern nachgerechnet. Ein Vergleich mit der Anbieterrechnung wird in der Doku **nicht** thematisiert.

Quelle: https://docs.helicone.ai/references/how-we-calculate-cost.md

### Langfuse — die sauberste Modellierung, die ich gefunden habe

Langfuse trennt zwei Herkünfte:

- **Inferred cost**: Langfuse ordnet das `model`-Feld einer Modelldefinition zu, die „a price per usage type" speichert, und „then multiplies those prices by the observation's usage to calculate cost".
- **Ingested cost**: vom Aufrufer mitgeliefert.

Die Vorrangregel, wörtlich:

> „When both are available, **ingested values take priority** over inferred ones."

Und die Grenze:

> „Cost inference by tokenizing the LLM input and output is not supported for reasoning models."

Das ist genau die Unterscheidung, die Sie brauchen – **im Datenmodell**. Zwei Felder, zwei Herkünfte, eine dokumentierte Vorrangregel.

Aber: Die Doku beschreibt „inferred cost" **nicht** als Schätzung und sagt **nicht**, wie das UI die beiden auseinanderhält. Wer den Wert in der Oberfläche sieht, weiß nicht, aus welchem der beiden Töpfe er stammt. Der Unterschied existiert im Modell und stirbt an der Oberfläche.

Quelle: https://langfuse.com/docs/model-usage-and-cost

### LiteLLM — Dimensionen ja, Genauigkeitsaussage nein

Spend-Logs (`LiteLLM_SpendLogs`) enthalten laut Doku:

> „api_key, user, team_id, request_tags, end_user, model_group, api_base, spend, total_tokens, completion_tokens, prompt_tokens"

Aufschlüsselung nach API Key, Team, Internal User, End-User/Customer, Tags. Anbieterspezifische Preislogik:

> „provider-specific cost tracking (e.g., Vertex AI PayGo/priority pricing, Bedrock service tiers, Azure base model mapping)"

**Keine** Aussage zu Schätzcharakter oder Abweichung von der Anbieterrechnung – nichts gefunden.

Quelle: https://docs.litellm.ai/docs/proxy/cost_tracking

### LangSmith / Portkey

- **LangSmith**: Die alte Doku-URL leitet auf `docs.langchain.com` um; es existiert eine „Model Price Map"-API (`read`/`create`/`update`/`delete-model-price`), also nachweislich eine editierbare Preistabelle als Kostengrundlage. Eine Beschreibung der Berechnung oder eine Genauigkeitsaussage habe ich **nicht** gefunden.
- **Portkey**: Virtual Keys sind zugunsten des „Model Catalog" abgekündigt. Der Katalog bietet „Cost-based limits: Maximum spend in USD", „Token-based limits", Requests pro Minute/Stunde/Tag, „pricing information (where available)" und **„custom pricing overrides"** für „internal cost allocation". Das „where available" ist implizit ein Eingeständnis lückenhafter Preisdaten, aber kein ausgewiesener Disclaimer.

Quellen: https://docs.langchain.com/langsmith/smith-api/model-price-map/llms.txt · https://portkey.ai/docs/product/model-catalog

## 3.2 Cloud-Anbieter: hier wird es explizit

### AWS — der beste Wortlaut der ganzen Recherche

Von der Bills-Seite:

> „For monthly billing periods that haven't closed (the billing status appears as **Pending**), this page shows the most recent **estimated charges** based on your AWS services metered to date."

> „**The summary isn't an invoice until the month's activity closes and AWS calculates the final charges.**"

> „At any time, you can view **estimated charges for the current month** and **final charges for previous months**."

Das ist eine glasklare Zweiteilung entlang der Zeit: **pending → estimated · issued → final.** Die Statusbezeichnung („Pending" / „Issued") steht *neben* der Zahl im UI, nicht in einer Fußnote. Der Status ist ein Datenfeld, kein Beipacktext.

Dazu die CloudWatch-Metrik `EstimatedCharges` unter dem Namespace `Billing` / „Total Estimated Charge" – die Schätzung trägt das Wort sogar im Bezeichner:

> „the estimated charges are calculated and sent several times daily to CloudWatch as metric data"

Quellen: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/getting-viewing-bill.html · https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/monitor_estimated_charges_with_cloudwatch.html

### Stripe — pending vs. available

Stripe modelliert nicht „geschätzt vs. abgerechnet", sondern „zugesagt vs. verfügbar" – strukturell dasselbe Muster (die Zahl ist da, aber noch nicht endgültig):

> „The top-level `available` and `pending` comprise your 'payments balance.'"

Aus dem Leitfaden (deutsche Fassung der Doku): Gelder durchlaufen „ausstehend" und „verfügbar"; sie wechseln „zum entsprechenden `available_on`-Zeitpunkt für jede Guthabentransaktion von `pending` zu `available`". Ausstehende Gelder „stellen eingehende Transaktionen dar, die Ihrem Saldo nicht gutgeschrieben wurden […] Sie können dieses Geld erst abheben oder ausgeben, wenn es verfügbar ist."

Entscheidend für die Gestaltung: **Stripe zeigt beide Zahlen nebeneinander.** Nicht eine Zahl mit einem Sternchen, sondern zwei Summen mit zwei Namen. Der Nutzer sieht die Differenz, statt sie sich denken zu müssen.

Quellen: https://docs.stripe.com/api/balance · https://docs.stripe.com/payments/balances

### Ein unerwarteter Fund bei Vercel

> „AI Gateway displays pricing based on East US 2 region rates. If your Azure resource is in a different region, **your actual costs may vary.**"

Ein präzise benannter Grund für die Abweichung (Regionspreise), nicht ein pauschales „ungefähr". Das ist die bessere Form: Wer sagt, *warum* die Zahl abweichen kann, gibt dem Leser etwas zu tun.

Quelle: https://vercel.com/docs/ai-gateway/authentication-and-byok/byok

## 3.3 Die Kennzeichnung selbst: `[e]`

Für die Frage „Fußnote, Icon, Badge, kursiv, Tilde?" habe ich **eine** normative Antwort gefunden, und sie kommt wieder aus der amtlichen Statistik:

> `[e]` = estimated · `[p]` = provisional · `[r]` = revised · `[f]` = forecast

> „Whenever a table contains shorthand, you should mention it and explain what the shorthand means. **The best place to do this is above the table.**" – als: „Some shorthand is used in this table, [e] = estimated, [f] = forecast."

Zwei Eigenschaften machen das stark: Das Kürzel hängt **an der Zelle**, nicht an der Spalte (eine Tabelle kann geschätzte und abgerechnete Zeilen mischen). Und die Legende steht **über** der Tabelle, nicht darunter – gelesen, bevor die Zahlen gelesen werden, nicht danach.

Quelle: https://analysisfunction.civilservice.gov.uk/policy-store/symbols-in-tables-definitions-and-help/

## 3.4 Nichts gefunden

- **Design-System-Regeln für „approximate values"** (Carbon, Polaris, Material): nichts gefunden.
- **Tilde `~` oder `≈` als dokumentierte UI-Konvention**: nichts gefunden. Ich habe keine einzige Doku gefunden, die das vorschreibt oder auch nur erwähnt.
- **Explizite Aussage, dass Langfuse-/LiteLLM-Kosten von der Anbieterrechnung abweichen können**: nichts gefunden. Nur Helicone sagt „estimate".

## 3.5 Ableitung

Die drei Muster, die ich in freier Wildbahn belegen konnte, in aufsteigender Ehrlichkeit:

1. **Wort im Bezeichner** (AWS `EstimatedCharges`) – die Schätzung ist nicht wegzuklicken, weil sie Teil des Namens ist.
2. **Status als Datenfeld neben der Zahl** (AWS `Pending`/`Issued`) – der Leser sieht den Status im selben Blick wie den Wert.
3. **Beide Zahlen nebeneinander** (Stripe `pending` + `available`) – die Unsicherheit wird nicht beschrieben, sondern beziffert.

Nummer 3 ist die einzige, die dem Leser die Größe der Differenz zeigt. Für ein Token-Kosten-Dashboard hieße das: nicht „~4,12 USD (geschätzt)", sondern zwei Zeilen – *aus Tokenzählung gerechnet: 4,12 · vom Anbieter bestätigt: 3,87*.

---

# FRAGE 4 — „Wer zahlt": BYOK vs. Plattform-Schlüssel

Das ist die Frage mit der stärksten Ausbeute, weil zwei Anbieter es sauber gelöst haben und die Belege hart sind.

## 4.1 OpenRouter — der beste Beleg überhaupt: ein Feld namens `is_byok`

Die Generation-Stats-API liefert unter anderem:

| Feld | Beschreibung laut Doku |
|---|---|
| **`is_byok`** | **„Whether this used bring-your-own-key"** |
| **`upstream_inference_cost`** | **„Cost charged by the upstream provider"** |
| `total_cost` | „Total cost of the generation in USD" |
| `cache_discount` | „Discount applied due to caching" |
| `usage` | „Usage amount in USD" |
| `provider_name` | „Name of the provider that served the request" |

Und die entscheidende Regel aus dem Usage-Accounting-Dokument:

> „When obtaining usage information via generation ID, the **`upstream_inference_cost` field is only available for BYOK (Bring Your Own Key) requests. For all other requests it will be 0 or null.**"

Das ist die exakte Antwort auf Ihre Frage, und die Modellierung ist bemerkenswert: OpenRouter hat **zwei getrennte Kostenfelder für zwei getrennte Zahler**.

- `total_cost` = was **OpenRouter** Ihnen berechnet (bei BYOK: nur die Gebühr)
- `upstream_inference_cost` = was der **Anbieter** Ihnen direkt berechnet (nur bei BYOK gefüllt)

Und `is_byok` ist der Schalter, an dem man ablesen kann, welches der beiden Felder überhaupt Bedeutung hat. Die Summe der beiden ist der Betrag, den der Aufruf den Nutzer gekostet hat – aber sie landet auf zwei verschiedenen Rechnungen.

Die Gebühr, wörtlich:

> „5% of what the same model/provider would cost normally on OpenRouter"

Und im Budget-Kontext:

> Wenn „Include BYOK spend" auf Guardrails oder Workspace-Budgets aktiviert ist, „the amount OpenRouter would have charged had the request not used your own provider key is added to the budget."

Ein Umschalter also, mit dem der Nutzer entscheidet, ob BYOK-Ausgaben in derselben Summe erscheinen wie Credit-Ausgaben. Sehr sauber: **Die Zusammenführung zweier Zahler in eine Zahl ist eine bewusste, benannte Entscheidung, kein Default.**

Quellen: https://openrouter.ai/docs/api-reference/get-a-generation · https://openrouter.ai/docs/use-cases/byok · https://openrouter.ai/docs/use-cases/usage-accounting

**Zur Activity-Ansicht selbst:** Wie das UI diese Felder darstellt, ist **nicht dokumentiert** – nichts gefunden. Die Datenstruktur belegt aber, dass die Unterscheidung pro Aufruf vorliegt.

## 4.2 Vercel AI Gateway — die klarste Prosa zur Zahler-Trennung

> „Spend through your own credentials **isn't counted in budgets**. It's **metered separately** and doesn't count toward a team, project, or API key limit, **so a budget can't be used to cap BYOK spend.**"

Also die genau entgegengesetzte Entscheidung zu OpenRouter: strikte Trennung, und – das ist die intellektuell ehrliche Pointe – Vercel **benennt die Konsequenz**: Ein Budget kann BYOK-Ausgaben nicht deckeln. Ein Nutzer, der ein Limit setzt, könnte sonst glauben, er sei geschützt.

Dazu ein Fall, den kaum jemand modelliert – der **gemischte Aufruf**:

> „If a query using your credentials fails, AI Gateway will retry the query with its system credentials to improve service availability."

> „When a request with your credentials fails, AI Gateway keeps it running by falling back to system credentials, and **that fallback usage is billed against your credits balance.**"

Ein und derselbe logische Aufruf kann also *zuerst* Ihren Schlüssel belasten (fehlgeschlagen, aber beim Anbieter unter Umständen berechnet) und *dann* das Vercel-Guthaben. Wer „wer hat bezahlt" pro Aufruf als **ein** Feld modelliert, kann diesen Fall nicht abbilden.

Quelle: https://vercel.com/docs/ai-gateway/authentication-and-byok/byok

## 4.3 Die übrigen: Aufschlüsselung ja, Zahler nein

- **LiteLLM Proxy**: schlüsselt Spend nach API Key, Team, Internal User, End-User und Tags auf; Usage-Tab im UI, `/global/spend/report`, `/spend/logs`, `/user/daily/activity`. Aber: Alle diese Dimensionen beantworten **„wem ordne ich die Kosten zu"**, nicht **„wessen Schlüssel hat gezahlt"**. Eine BYOK-Kennzeichnung habe ich **nicht** gefunden.
- **Portkey Model Catalog**: „abstracts raw API keys and scattered environment variables into governed Provider Integrations"; Budgets in USD und Tokens pro Provider. Die eigenen Anbieterschlüssel sind also das Normalmodell – womit die Unterscheidung zum Plattformschlüssel entfällt, weil es keinen gibt. Keine BYOK-Markierung nötig und keine gefunden.
- **Cloudflare AI Gateway**: Die Analytics-Doku beschreibt die Kostenmetrik nur als „Gain visibility into the costs associated with using different AI providers". **Kein** Schätz-Disclaimer, **keine** BYOK-Unterscheidung. Auf der Pricing-Seite immerhin: „A 5% fee is applied to all credits purchased through Unified Billing […] Inference pricing from providers is passed through with no markup."
- **Helicone**: Doku-Index nennt „AI Gateway Overview" und „Provider Routing", aber ich habe **keine** Seite gefunden, die Kosten nach Schlüsselbesitzer trennt.
- **Cursor**: Die Preisseite (nach Redirect auf `cursor.com/docs/account/pricing`) enthält **nichts** zu eigenen API-Schlüsseln oder deren Abrechnung. Nichts gefunden.
- **Windsurf, Cline, Perplexity, Poe**: nicht abgerufen, keine Belege. Nichts gefunden.

## 4.4 Ableitung

Es gibt **zwei** dokumentierte Haltungen, und sie widersprechen sich:

| | OpenRouter | Vercel |
|---|---|---|
| BYOK-Ausgaben im Budget | optional einrechenbar („Include BYOK spend") | nie, und das wird ausdrücklich gesagt |
| Kostenfelder | zwei (`total_cost` + `upstream_inference_cost`), plus `is_byok` | separat gemetert |
| Fallback auf Plattformschlüssel | nicht dokumentiert | dokumentiert und Ihnen berechnet |

Wer das nachbaut, braucht mindestens drei Felder pro Aufruf, nicht eines: **wessen Schlüssel** (`is_byok`), **was die Plattform berechnet** und **was der Anbieter berechnet**. Und für die Summe unten in der Kachel eine bewusste Entscheidung mit einem Namen – nicht eine stille Addition.

---

# FRAGE 5 — Ausreißer

## 5.1 Honeycomb BubbleUp — Mechanik, wie erbeten genau

Die Doku ist umgezogen; die gültige Seite ist `/investigate/analyze/identify-outliers/`.

Ablauf, wörtlich belegt:

1. **Auswahl:** Der Nutzer zieht auf einer Heatmap ein Rechteck – „draw a box around the data to define the selection".
2. **Zweiteilung:** Die Daten zerfallen in „**Selection**, rendered in yellow" und „**Baseline**, rendered in blue" – letztere sind alle übrigen Punkte.
3. **Darstellung:** Für jedes Feld erzeugt BubbleUp ein Balkendiagramm, das „each value in bar form, which represents its frequency in the Selection or in the Baseline" zeigt; Balkenhöhen sind „proportional to the number of times the value occurs".
4. **Sortierung:** Mit Honeycomb Intelligence „a ranked table of fields" mit Schweregrad; ohne sie gruppiert nach Dimensions (kategorial) und Measures (numerisch), wobei die größten Unterschiede durch die Höhendifferenz zwischen Gelb und Blau ins Auge fallen.

Der eigentliche Trick ist konzeptuell und lässt sich in einem Satz sagen: **BubbleUp visualisiert nicht den Ausreißer, sondern den Unterschied zwischen dem Ausreißer und allem anderen.** Man wählt „das da ist komisch" und bekommt zurück „und zwar unterscheidet es sich in *diesen* Feldern". Zwei Balken pro Wert, gelb und blau, über alle Dimensionen hinweg. Kein Modell, keine Schwelle, keine Konfiguration – nur ein Vergleich zweier Verteilungen.

Die Heatmap dahinter:

> „plot the statistical distribution of a field's values over time and spot patterns, outliers, and latency spikes in your telemetry data"

Und der Grund, warum Aggregate hier scheitern, am Beispiel einer bimodalen Verteilung: „while all status codes are in the lower-valued duration, only `200` and `500` status codes are in the higher" – ein Mittelwert hätte die zwei Wolken zu einer erfundenen Mitte verschmolzen.

Quellen: https://docs.honeycomb.io/investigate/analyze/identify-outliers/ · https://docs.honeycomb.io/investigate/analyze/visualize-events/ · https://docs.honeycomb.io/investigate/query/

## 5.2 Warum der Durchschnitt bei Ausreißern versagt — Brendan Gregg

> „The average can be misleading. Since latency is so important for performance, I want to know exactly what is happening."

Sein Messbeispiel: `iostat` zeigte eine mittlere Latenz von 3–9 ms; die Einzelereignisse aus `biosnoop` zeigten, dass die meisten I/Os unter 2 ms lagen. Das Histogramm deckte auf, dass „the average has been dragged up by latency **outliers**: I/O with very high latency".

Und der Grund, warum ein einzelnes Histogramm nicht genügt: „the modes move over time" – erst die Zerlegung in Sekundenspalten (also die Heatmap) macht das sichtbar.

Übertragen auf Ihren Fall: Ein einzelner Aufruf, der das 20-fache des Medians kostet, verschiebt den Mittelwert einer Stunde spürbar – und ist im Mittelwert dann *unsichtbar*, weil er als leichter Anstieg aller Aufrufe erscheint statt als das, was er ist.

Quelle: https://www.brendangregg.com/HeatMaps/latency.html

## 5.3 AWS Cost Anomaly Detection — wie eine Kostenanomalie beziffert wird

Die Spaltendefinitionen sind für ein Kosten-Dashboard direkt übertragbar:

> **Cost impact**: „The spend increase detected compared to the expected spend amount. It is calculated as **actual spend - expected spend**."

> **Impact %**: „The percentage difference between the actual spend and expected spend. It is calculated as **(total cost impact / expected spend) * 100**."

> **Expected spend**: „The amount our machine learning models expected you to spend during the anomaly's duration, based on your historical spending pattern."

> **Actual spend**: „The total amount you actually spent during the anomaly's duration."

> **Severity**: „Represents how abnormal a certain anomaly is accounting for historical spending patterns. A low severity generally suggests a small spike compared to historical spend and a high severity suggests a big spike. **However, a small spike with historically consistent spend is categorized as high severity. And, similarly, a big spike with irregular historical spend is categorized as low severity.**"

Der Severity-Absatz ist die substanzielle Einsicht: **Die absolute Höhe des Ausschlags ist nicht der Maßstab.** Was zählt, ist der Ausschlag im Verhältnis zur bisherigen Streuung. Ein Aufruf, der das 20-fache des Medians kostet, ist in einer Welt mit gleichförmigen Aufrufen ein Alarm und in einer Welt mit wilder Streuung ein Dienstagnachmittag. Genau das ist auch der Grund, warum ein fester Faktor („20× Median") als Alarmregel schlecht altert.

Die Darstellung: Anomalien erscheinen in einer sortierbaren Tabelle („Detected anomalies") – sortierbar nach Start date, Last detected, Duration, Cost impact, Impact %, Monitor name, Top root cause – mit einer Detailseite und einem Link „View in Cost Explorer" auf „a time series graph of the cost impact". Also **beides**: Tabelle als primäre Ansicht, Zeitreihe als Absprung.

Die Alarmschwelle kennt zwei Typen: absolut (Impact in USD) und prozentual (Impact %), kombinierbar mit AND/OR. Und:

> „Even if an anomaly is below the alert threshold, the machine learning model continues to detect spend anomalies on your account. All the anomalies that the machine learning model detected […] are available in the **Detected anomalies** tab."

Erkennung und Benachrichtigung sind also getrennt: Es wird alles erkannt und gelistet, gemeldet nur das Große. Ein gutes Muster – die Schwelle filtert die Störung, nicht die Daten.

Quellen: https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html · https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html

## 5.4 Algorithmische Ausreißererkennung im Vergleich

**Datadog Outlier Monitor:** vier Algorithmen – `MAD`, `DBSCAN`, `scaledMAD`, `scaledDBSCAN`. Bei DBSCAN gilt „any point not in the largest cluster is considered an outlier"; bei MAD wird „the whole group […] marked as an outlier", wenn der Anteil abweichender Punkte den Schwellwert überschreitet.

**Grafana ML Outlier Detection:** dieselben zwei Familien, mit einer sehr guten Formulierung des Unterschieds:

> „**DBSCAN** clusters data points based on their density and relative distance, and flags a series when its data points fall outside the largest cluster."
> „**MAD** evaluates each data point against the rolling 24-hour median and flags a series when the deviation exceeds the configured sensitivity threshold."
> „**DBSCAN compares values against an adaptive group, while MAD compares values against a stable statistical baseline** derived from the last 24 hours."

Zur Darstellung: „the Summary section displays all returned series and highlights the series containing outliers."

Für Ihren Fall ist das die relevante Weggabelung: DBSCAN sucht **das abweichende Mitglied einer Gruppe** (welcher Agent/welches Modell verhält sich anders als die übrigen), MAD sucht **die abweichende Zeit** (heute ist anders als die letzten 24 Stunden). Für „ein Aufruf 20× teurer als der Median" ist MAD die passende Familie – der Median ist bereits der Anker, und MAD ist genau der robuste Streuungsschätzer dazu.

**Datadog Watchdog:** „proactively computes a baseline of expected behavior for your systems, applications, and deployments. This baseline is then used to detect anomalous behavior." Wie das visuell dargestellt wird: in der Doku **nicht** beschrieben – nichts gefunden.

Quellen: https://docs.datadoghq.com/monitors/types/outlier/ · https://grafana.com/docs/grafana-cloud/alerting-and-irm/machine-learning/outlier-detection/ · https://docs.datadoghq.com/watchdog/

## 5.5 Boxplot: die formale Ausreißerdefinition

Vega-Lite dokumentiert beide Varianten und macht den Unterschied explizit:

- **Tukey (Default, `extent: 1.5`):** „the whisker spans from the smallest data to the largest data within the range [Q1 - k * IQR, Q3 + k * IQR]"; und: „If there are outlier points beyond the whisker, they will be displayed using **point marks**."
- **Min-Max:** „the lower and upper whiskers are defined as the min and max respectively. **No points will be considered as outliers for this type of box plots.**"

Der zweite Satz ist die Warnung: Ein Min-Max-Boxplot kann per Definition keinen Ausreißer zeigen. Wer die falsche Variante wählt, hat das Merkmal wegdefiniert, nach dem er sucht – und sieht keinen Fehler, sondern nur eine Box.

Verfügbare Beispiele in der Vega-Lite-Galerie: `boxplot_2D_vertical` (Tukey 1.5 IQR), `boxplot_minmax_2D_vertical`, `boxplot_preaggregated`.

Quellen: https://vega.github.io/vega-lite/docs/boxplot.html · https://vega.github.io/vega-lite/examples/

**Beeswarm / Strip Plot in Observability-Tools:** nichts gefunden. Ich habe kein Observability-Produkt belegen können, das Beeswarm- oder Strip-Plots einsetzt. Die Heatmap (Honeycomb, Gregg) scheint die dort etablierte Form für dieselbe Aufgabe zu sein – sie skaliert besser, weil sie über die Zeit stapelt statt zu streuen.

## 5.6 Punkt im Chart oder eigene Tabelle?

Die Belege stützen **beides**, aber in verschiedenen Rollen:

- **Punkt/Symbol im Chart:** Vega-Lite Tukey-Boxplot rendert Ausreißer als `point marks` (belegt). Grafana „highlights the series containing outliers" (belegt).
- **Eigene sortierte Tabelle:** AWS „Detected anomalies" mit Sortierung nach Cost impact und Impact % (belegt). Sentry: Nutzer können „sort by clicking the column header to toggle between ascending and descending" und Spans nach Dauer sortieren, um die langsamsten hervorzuholen (belegt).

Das dokumentierte Muster ist also nicht *entweder/oder*, sondern **Chart zum Finden, Tabelle zum Abarbeiten, Verlinkung dazwischen** – bei AWS wörtlich als „View more" → Anomaly details → „View in Cost Explorer".

Quellen: https://docs.sentry.io/product/explore/trace-explorer/ · https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html

## 5.7 Median/P95 gegen Maximum in einer Kachel

**Datadog Query Value Widget** ist der beste Beleg: Aggregationen `avg`, `min`, `sum`, `max`, `last` sowie Perzentile wie `p75`, `p90` („where supported"). Dazu ein **Change Indicator**, der „highlight[s] how the current value compares to a previous time frame" (relativ, absolut oder beides), und wahlweise ein Zeitreihen-Hintergrund in drei Stilen: „Min to Max", „Line", „Bars".

Die Kachel enthält also drei Informationsebenen: die Zahl, ihre Veränderung, und ihre Zeitgestalt als Sparkline. Der „Min to Max"-Hintergrund ist dabei die interessanteste Wahl – er skaliert auf die tatsächliche Spannweite und macht damit die Streuung im Kachelhintergrund sichtbar.

**Warum Perzentile serverseitig gebildet werden müssen** (Datadog Distributions): globale Perzentile „(p50, p75, p90, p95, p99 or any percentile of your choosing with up to two decimal points)" entstehen, weil Distributions „send all raw data collected during the flush interval and the aggregation occurs server-side" (DDSketch). Der Gegenfall – Perzentile pro Host bilden und dann mitteln – ergibt eine Zahl, die kein Perzentil von irgendetwas ist.

Für Ihren Fall relevant: Wer P95 aus bereits aggregierten Stundenwerten rechnet, bekommt nicht das P95 der Aufrufe. Die Kachel braucht die Rohaufrufe.

Quellen: https://docs.datadoghq.com/dashboards/widgets/query_value/ · https://docs.datadoghq.com/metrics/distributions/

## 5.8 Nichts gefunden

- **Honeycomb-Slogan „the average is a lie"** oder eine vergleichbare wörtliche Aussage in der Doku: nichts gefunden (die Sache wird am bimodalen Beispiel gezeigt, nicht als Satz formuliert).
- **Gil Tene, „How NOT to Measure Latency" / Coordinated Omission**: nicht abgerufen, kein Beleg.
- **New Relic Anomalieerkennung**: nicht abgerufen, nichts gefunden.
- **Sentry „Suspect Spans" als benanntes Merkmal**: In der Trace-Explorer-Doku nicht gefunden; belegbar sind nur Perzentil-Aggregationen (`p90(span.duration)`, ausdrücklich „Useful for identifying outliers") und Sortierung nach Dauer.
- **Farbe/Symbol, mit dem Datadog eine Ausreißer-Serie im Graphen einfärbt**: in der Doku nicht spezifiziert.
- **Google Cloud / Azure Cost Anomaly**: nicht abgerufen. Azure erwähnt lediglich „intelligent insights about your costs like anomaly detection" in Smart Views.

---

# Die vier Belege, die ich am höchsten einschätze

1. **Bank of England 1998** – die einzige Quelle, in der eine Institution die Abschaffung ihrer eigenen Punktprognose begründet, samt der beiden Fehlermodi (falsche Präzision; Band als Grenze missverstanden). https://www.bankofengland.co.uk/-/media/boe/files/quarterly-bulletin/1998/the-inflation-report-projections-understanding-the-fan-chart.pdf

2. **UK Government Analysis Function, „Symbols in tables"** – beantwortet die Fragen 1, 2 und 3 zugleich, mit `[f]`, `[e]`, `[x]`, `[z]`, `[low]` und dem Satz „A zero or '0' should only be used when a data point is a true zero." https://analysisfunction.civilservice.gov.uk/policy-store/symbols-in-tables-definitions-and-help/

3. **OpenRouter `is_byok` + `upstream_inference_cost`** – der Nachweis, dass „wer hat bezahlt" als Datenfeld pro Aufruf existiert, mit zwei getrennten Kostenfeldern für zwei Zahler. https://openrouter.ai/docs/use-cases/usage-accounting

4. **AWS Cost Explorer Forecast** – „If AWS doesn't have enough data to forecast an 80% prediction interval, Cost Explorer doesn't provide a forecast." Die Weigerung als Gestaltungsmittel. https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html

# Die auffälligste Leerstelle

Zwei Dinge habe ich trotz gezielter Suche **nirgends** gefunden:

- **Kein Design-System** (Carbon, Polaris, Material, Atlassian) hat eine Regel zu leerer Zelle vs. Null. Die Regel existiert nur in der amtlichen Statistik.
- **Kein Werkzeug** weist die Zählbasis eines Mittelwerts aus („n = 42 von 50").

Beide Lücken betreffen dieselbe Sache: die Frage, wie viele Werte hinter einer Zahl stehen. Sie ist offenbar in der Produktwelt unbeantwortet – was sie zu der Stelle macht, an der ein Kosten-Dashboard mit wenig Aufwand ehrlicher sein kann als der Stand der Technik.

---

**Sources:**
- [Bank of England – Understanding the fan chart (1998)](https://www.bankofengland.co.uk/-/media/boe/files/quarterly-bulletin/1998/the-inflation-report-projections-understanding-the-fan-chart.pdf)
- [UK Analysis Function – Symbols in tables](https://analysisfunction.civilservice.gov.uk/policy-store/symbols-in-tables-definitions-and-help/)
- [UK Analysis Function – Data visualisation: tables](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-tables/)
- [Eurostat – Symbols and abbreviations](https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Tutorial:Symbols_and_abbreviations)
- [AWS – Forecasting with Cost Explorer](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html)
- [AWS – Understanding your bill](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/getting-viewing-bill.html)
- [AWS – Billing alarm / EstimatedCharges](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/monitor_estimated_charges_with_cloudwatch.html)
- [AWS – Cost Anomaly Detection overview](https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html)
- [AWS – Getting started with Cost Anomaly Detection](https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html)
- [Google Cloud – Billing reports](https://docs.cloud.google.com/billing/docs/how-to/reports)
- [Azure – Cost Analysis quickstart](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/quick-acm-cost-analysis)
- [Vega-Lite – Error band](https://vega.github.io/vega-lite/docs/errorband.html)
- [Vega-Lite – Box plot](https://vega.github.io/vega-lite/docs/boxplot.html)
- [Vega-Lite – Impute](https://vega.github.io/vega-lite/docs/impute.html)
- [Vega-Lite – Example gallery](https://vega.github.io/vega-lite/examples/)
- [Highcharts – series.zones](https://api.highcharts.com/highcharts/plotOptions.series.zones)
- [Highcharts – xAxis.plotBands](https://api.highcharts.com/highcharts/xAxis.plotBands)
- [Highcharts – line.connectNulls](https://api.highcharts.com/highcharts/plotOptions.line.connectNulls)
- [ECharts – series line docs source](https://raw.githubusercontent.com/apache/echarts-doc/master/en/option/series/line.md)
- [Chart.js – Line chart](https://www.chartjs.org/docs/latest/charts/line.html)
- [Grafana – Time series visualization](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/)
- [Grafana – Standard options (No value)](https://grafana.com/docs/grafana/latest/panels-visualizations/configure-standard-options/)
- [Grafana – Outlier detection](https://grafana.com/docs/grafana-cloud/alerting-and-irm/machine-learning/outlier-detection/)
- [Datadog – Interpolation / fill()](https://docs.datadoghq.com/dashboards/functions/interpolation/)
- [Datadog – Outlier monitor](https://docs.datadoghq.com/monitors/types/outlier/)
- [Datadog – Watchdog](https://docs.datadoghq.com/watchdog/)
- [Datadog – Distributions](https://docs.datadoghq.com/metrics/distributions/)
- [Datadog – Query Value widget](https://docs.datadoghq.com/dashboards/widgets/query_value/)
- [Prometheus – Querying basics / staleness](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Honeycomb – Identify outliers (BubbleUp)](https://docs.honeycomb.io/investigate/analyze/identify-outliers/)
- [Honeycomb – Visualize events (heatmap)](https://docs.honeycomb.io/investigate/analyze/visualize-events/)
- [Brendan Gregg – Latency heat maps](https://www.brendangregg.com/HeatMaps/latency.html)
- [Sentry – Trace Explorer](https://docs.sentry.io/product/explore/trace-explorer/)
- [Langfuse – Model usage and cost](https://langfuse.com/docs/model-usage-and-cost)
- [Helicone – How we calculate cost](https://docs.helicone.ai/references/how-we-calculate-cost.md)
- [LiteLLM – Proxy cost tracking](https://docs.litellm.ai/docs/proxy/cost_tracking)
- [Portkey – Model Catalog](https://portkey.ai/docs/product/model-catalog)
- [LangSmith – Model price map API](https://docs.langchain.com/langsmith/smith-api/model-price-map/llms.txt)
- [OpenRouter – BYOK](https://openrouter.ai/docs/use-cases/byok)
- [OpenRouter – Usage accounting](https://openrouter.ai/docs/use-cases/usage-accounting)
- [OpenRouter – Get a generation](https://openrouter.ai/docs/api-reference/get-a-generation)
- [Vercel – AI Gateway BYOK](https://vercel.com/docs/ai-gateway/authentication-and-byok/byok)
- [Cloudflare – AI Gateway analytics](https://developers.cloudflare.com/ai-gateway/observability/analytics/)
- [Cloudflare – AI Gateway pricing](https://developers.cloudflare.com/ai-gateway/reference/pricing/)
- [Stripe – Balance API](https://docs.stripe.com/api/balance)
- [Stripe – Balances and settlement time](https://docs.stripe.com/payments/balances)