# AUFTRAG

Recherchiere sehr gründlich im Web (WebSearch + WebFetch, offizielle AWS-Doku docs.aws.amazon.com bevorzugt) zu **AWS Cost Explorer** und **AWS Cost Explorer Forecast**. Antworte auf DEUTSCH. Belege JEDE Aussage mit einer konkreten URL. Erfinde nichts. Wenn du eine visuelle Eigenschaft nur aus Blogposts/Screenshots/Drittquellen kennst, kennzeichne das ausdrücklich als "nur aus Blog/Screenshot, nicht in offizieller Doku".

Wichtige Startpunkte (fetch diese wirklich, nicht nur Suchergebnisse lesen):
- https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html
- https://docs.aws.amazon.com/cost-management/latest/userguide/ce-exploring-data.html
- https://docs.aws.amazon.com/cost-management/latest/userguide/ce-default-reports.html
- https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html
- https://docs.aws.amazon.com/cost-management/latest/userguide/ce-advanced.html
- https://docs.aws.amazon.com/cost-management/latest/userguide/ce-filtering.html
- Alles zu "Cost Explorer forecast prediction interval", "forecast accuracy", "80% prediction interval"
- Alles zu unblended / amortized / blended / net costs und "estimated vs final/invoiced" Kosten
- Data freshness / "data is refreshed at least once every 24 hours" / Verzögerung

Beantworte KONKRET:
1. Kopfkacheln/Summenzeilen im UI (z.B. "Month-to-date cost", "Forecasted month-end cost", "Cost trend vs last month") — welche gibt es laut Doku genau, wörtliche Bezeichnungen.
2. Hauptdiagramm: gesta

---

Confirmed: "In Cost Explorer and AWS Budgets, a cost category appears as an additional billing dimension. You can use this to filter for the specific cost category value, or group by the cost category." I now have sufficient sourced material to compile the complete answer.

## AWS Cost Explorer & AWS Cost Explorer Forecast — Recherche

Alle Aussagen sind mit URL belegt. Wörtliche Zitate sind im englischen Original übernommen (offizielle Doku ist englisch).

### 1. Kopfkacheln / Summenzeilen im UI

Auf dem Cost-Explorer-Dashboard (nicht im Report-Editor) gibt es laut Doku genau diese Kacheln:

- **"Month-to-date costs"** — "shows how much you're estimated to have incurred in charges so far this month and compares it to this time last month."
- **"Forecasted month end costs"** — "shows how much Cost Explorer estimates that you will owe at the end of the month and compares your estimated costs to your actual costs of the previous month."
- Ausdrücklich: "The Month-to-date costs and the Forecasted month end costs don't include refunds." Und: "The costs for Cost Explorer are only shown in US dollars."
- Ein **Trends-Widget** — Überschrift dynamisch "**{{this month}} trends**" — zeigt "your top cost trends" mit Link "View all trends".
- Darunter ein **Hauptdiagramm** ("a graph of your daily costs") und eine Liste **"Your recent Cost Explorer reports"**.

Zusätzlich gibt es auf der Billing-Startseite ein separates **"Top trends"**-Widget, das "the top 10 cost variations between the previous two months" zeigt (Teil des "Cost Comparison"-Features).

Quelle: [ce-exploring-data.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-exploring-data.html), [ce-cost-comparison.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-cost-comparison.html)

### 2. Hauptdiagramm — Chart-Typen, Granularität, Top-N

**Chart-Typen** (wörtlich): "Cost Explorer provides three styles for charting your cost data: Bar charts (Bar), Stacked bar charts (Stack), Line graphs (Line)." Umschaltbar über die Ansichten oben rechts im Chart.
Quelle: [ce-modify.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-modify.html)

**Granularität:** "Daily, Monthly, or Hourly." Hourly ist standardmäßig NICHT aktiv: "To enable hourly granularity, opt in through the Cost Explorer console Preferences page as the management account. When hourly granularity is enabled, information is available for the previous 14 days." Das Dashboard selbst zeigt per Default "a graph of your daily costs" (also Daily als Default auf dem Dashboard).
Quelle: [ce-modify.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-modify.html), [ce-exploring-data.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-exploring-data.html)

**Top-N + "Others"-Bucket:** Für die Default-Reports explizit belegt: "The Monthly costs by linked account report shows your costs for the last six months, grouped by linked, or member account. The top five member accounts are shown by themselves, and the rest are grouped into one bar." Identisch für "Monthly costs by service": "The top five services are shown by themselves, and the rest are grouped into one bar."

Für allgemeine Filter/Gruppierung gibt es eine konkretere Regel bei Steuer (Tax) als Beleg für das Top-N-Verhalten: "If you select five or fewer filters, Cost Explorer displays your tax expenses as a single bar. If you select six or more filters, Cost Explorer displays five bars, stacks, or lines, and then aggregates all remaining items, including taxes, into a sixth bar, stack slice, or plot line that's labeled **Other**." → Bestätigt: **Top 5 + ein "Other"-Bucket** als generelles Muster.
Quelle: [ce-default-reports.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-default-reports.html), [ce-filtering.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-filtering.html)

### 3. Prognose-Visualisierung — Kernpunkt

**Wörtliches Zitat zur Darstellung** (aus [ce-forecast.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html)):

> "How you read the Cost Explorer forecasts depends on the type of chart that you're using. Forecasts are available for both line charts and bar charts.
> The 80% prediction interval appears differently on each type of chart:
> + Line charts represent the prediction interval as a set of lines that are on either side of your costs line.
> + Bar charts represent the prediction interval as two lines that are on either side of the top of your bar."

D.h. **kein schraffiertes Band, keine transparenten Balken laut Doku** — sondern explizit **Linien** (zusätzliche Linien ober-/unterhalb der Kostenlinie bzw. ober-/unterhalb der Balkenspitze). Ob diese Linien gestrichelt oder in welcher Farbe dargestellt werden, sagt die offizielle Doku NICHT — das ist eine reine Formulierung ("a set of lines"/"two lines"), keine Styling-Aussage. **Ich konnte dazu keine Blog-/Screenshot-Quelle mehr abrufen (Web-Search-Kontingent der Session war erschöpft), kennzeichne das also ausdrücklich als offen/nicht verifizierbar in dieser Recherche — nicht als "nur aus Blog bekannt", sondern als unbeantwortete Lücke.**

**Konfidenzniveau:** Im Konsolen-UI fix, laut Doku wörtlich:
> "Cost Explorer forecasts have a prediction interval of 80%. If AWS doesn't have enough data to forecast an 80% prediction interval, Cost Explorer doesn't provide a forecast. This is common for accounts that have less than one full billing cycle."

Konfigurierbar ist es **nur über die API**, nicht im Konsolen-UI: `GetCostForecast` hat den Parameter `PredictionIntervalLevel` — "Type: Integer, Valid Range: Minimum value of 51. Maximum value of 99." Beschreibung: "Cost Explorer always returns the mean forecast as a single point. You can request a prediction interval around the mean by specifying a confidence level. The higher the confidence level, the more confident Cost Explorer is about the actual value falling in the prediction interval. Higher confidence levels result in wider prediction intervals." (Das API-Beispiel nutzt sogar `"PredictionIntervalLevel":85`.)
Quelle: [API_GetCostForecast.html](https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_GetCostForecast.html)

**Genauigkeits-Aussage** (wörtlich):
> "Like weather forecasts, billing forecasts can vary in accuracy. Different ranges of accuracy have different prediction intervals. The higher the prediction interval, the more likely the forecast has a wider range. [...] The range in the prediction band is dependent on your historical spend volatility, or fluctuations. The more consistent and predictable the historical spend, the narrower the prediction range in forecast spend."
> "Because forecasts are predictions, the forecasted billing amounts are estimated and might differ from your actual charges for each statement period."

**Verfahren/ML-Modell:** Die offizielle User-Guide-Doku nennt **kein konkretes Modell/Algorithmus** — nur "This forecast is based on your past usage." Die AWS-FAQ-Seite (aws.amazon.com, nicht docs.aws.amazon.com, daher als Marketing-Quelle gekennzeichnet) sagt nur: "Cost Explorer forecasts your AWS cost and usage by analyzing your historical pattern." Ein spezifischer Modellname (z. B. Prophet, ARIMA, DeepAR) wird **nirgends in offizieller AWS-Doku genannt** — das ist also unbeantwortet/unbestätigt, nicht nur "nur aus Blog bekannt", weil ich dazu keine belastbare Blog-Quelle mehr abrufen konnte (Search-Kontingent erschöpft).
Quelle: [ce-forecast.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html), FAQ (aws.amazon.com/aws-cost-management/aws-cost-explorer/faqs/)

**Mindest-Historie:** Nicht als exakte Zahl genannt, nur: "This is common for accounts that have less than one full billing cycle" (d. h. faktisch braucht es mindestens ~1 Abrechnungszyklus/Monat Historie, sonst kein Forecast).

**Prognose-Zeiträume** (wörtlich aus [ce-modify.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-modify.html)):
- "+1M — Displays forecast data for the next month. This option is available if you choose the Daily time granularity."
- "+3M — Displays forecast data for the next 3 months. This option is available if you choose the Daily or Monthly time granularity."
- "+18M — Displays forecast data for the next 18 months. This option is available if you choose the Monthly time granularity."
- Zusätzlich Custom-Range möglich.

Aus der API-Doku (`GetCostForecast`): "You can get 3 months of DAILY forecasts or 18 months of MONTHLY forecasts." — deckungsgleich mit Konsole. Die generelle Übersichtsseite fasst zusammen: "you can [...] forecast how much you're likely to spend for the next 18 months" ([ce-what-is.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html)) — allerdings sagt [ce-enable.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-enable.html) beim Erst-Enable "calculates the forecast for the next 12 months" — **kleine Diskrepanz zwischen zwei offiziellen Doku-Seiten** (18 vs. 12 Monate beim initialen Setup), beide wörtlich zitiert, keine Erklärung dafür in der Doku gefunden.

**Wichtiger Hinweis zum aktuellen (unvollständigen) Tag bei Forecast-Ansicht** (wörtlich, [ce-modify.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-modify.html)):
> "If you choose any forecasted dates, your current date's cost and usage data shows as **Forecast**. The current date's cost and usage won't include historical data."

**Discounts im Forecast:** "When forecasting costs, discounts are included by default." Mit Hinweis: für Refunds/nicht-wiederkehrende Discounts "we encourage you to use Show net unblended costs."

### 4. Unblended / Amortized / Blended / Net / Net amortized

Auswahl im UI unter **"Advanced options" → "Aggregate costs by"** (Dropdown), fünf Optionen, wörtlich definiert in [ce-advanced.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-advanced.html):

- **Unblended costs**: "reflects the cost of the usage. When grouped by Charge type, unblended costs separate discounts into their own line items."
- **Amortized costs**: "reflects the effective cost of the upfront and monthly reservation fees spread across the billing period. [...] AWS estimates your amortized costs by combining your unblended costs with the amortized portion of your upfront and recurring reservation fees. [...] Amortized costs aren't available for billing periods before 2018."
- **Blended costs**: "reflects the average cost of usage across the consolidated billing family."
- **Net unblended costs**: "reflects the cost after discounts."
- **Net amortized costs**: "amortizes the upfront and monthly reservation fees while including discounts such as RI volume discounts."

**Default:** Nicht ausdrücklich als "Default" benannt, aber implizit: das Dashboard-Hauptdiagramm heißt "Your daily unblended costs" ("Cost Explorer shows a graph of your current unblended daily costs") — Unblended ist also die Voreinstellung auf dem Dashboard/den Default-Reports.
Quelle: [ce-advanced.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-advanced.html), [ce-exploring-data.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-exploring-data.html)

### 5. "Daten sind vorläufig/estimated"

Mehrere wörtliche Belege:
- "the Month-to-date costs shows how much you're **estimated** to have incurred in charges so far this month" — [ce-exploring-data.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-exploring-data.html)
- "the forecasted billing amounts are **estimated** and might differ from your actual charges for each statement period" — [ce-forecast.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html)
- "Cost Explorer refreshes your cost data at least once every 24 hours. However, this depends on your upstream data from your billing applications, and some data might be updated later than 24 hours." — [ce-what-is.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html)
- "All costs reflect your usage up to the previous day. For example, if today is December 2, the data includes your usage through December 1." + Note: "In the current billing period, the data depends on your upstream data from your billing applications, and some data might be updated later than 24 hours." — [ce-exploring-data.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-exploring-data.html)

**Ob das als sichtbares Banner/Hinweis IM UI erscheint** (nicht nur in der Doku als Note) — das kann ich aus der Textdoku **nicht bestätigen**; die Doku beschreibt es als Fließtext/Note-Box im Guide, nicht explizit als "in-app banner". Das ist offen.

### 6. Gruppierungsachsen (Group by)

Cost Explorer unterstützt Filter/Group-by nach diesen Dimensionen (wörtlich aus [ce-filtering.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-filtering.html)): API operation, Availability Zone (AZ), Billing entity, Charge type, Include all, Instance type, Legal entity, Linked account, Platform, Purchase option, Region, Resources, Service, Tag, Tenancy, Usage type, Usage type group.

Zusätzlich: **Cost Category** ist ebenfalls eine Group-by/Filter-Dimension, aber auf einer separaten Doku-Seite belegt: "In Cost Explorer and AWS Budgets, a cost category appears as an additional billing dimension. You can use this to filter for the specific cost category value, or group by the cost category." — [manage-cost-categories.html](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/manage-cost-categories.html)

**Wie viele Group-by gleichzeitig (primary/secondary):** Die Doku zu "Grouping data by filter type" ([ce-modify.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-modify.html)) beschreibt nur "Choose a Group by option to group by the category that you want" — sie **nennt keine explizite Obergrenze oder ein "primary + secondary" Konzept mit Zahl**. Ich konnte keine Doku-Seite finden, die "secondary group by" wörtlich als AWS-Terminus mit Maximalzahl definiert — das bleibt **offen/nicht in offizieller Doku spezifiziert** in dem, was ich abrufen konnte.

**Wie viele Filter gleichzeitig:** Explizit beziffert: "AWS Cost and Usage Reports in Cost Explorer can use a maximum of **1024 filters**." — [ce-filtering.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-filtering.html)

### 7. Datenlücken / verspätete Daten

- Aktualisierungsfrequenz: "Cost Explorer refreshes your cost data at least once every 24 hours." — [ce-what-is.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html)
- Initiale Bereitstellung nach Enable: "The current month's data is available for viewing in about 24 hours. The rest of your data takes a few days longer." — [ce-enable.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-enable.html) (praktisch identischer Satz auch in [ce-what-is.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html))
- Aktueller Tag bei Forecast-Ansicht wird explizit als **"Forecast"** gekennzeichnet/behandelt (siehe Zitat unter Punkt 3): "If you choose any forecasted dates, your current date's cost and usage data shows as Forecast."
- Ein expliziter UI-Hinweistext wie "data for today is incomplete" wurde in der abgerufenen Doku **nicht wörtlich gefunden** — nur die oben zitierten Aussagen zu Verzögerung/Estimated.

### 8. Export/CSV, Zeitraum-Presets, Vergleichsfeature

**CSV-Export** ([ce-download-csv.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-download-csv.html)):
- "This is the same data that appears in the data table under the chart." Aber: "The data table sometimes doesn't display the complete dataset that is used for the chart" (CSV hat also mehr Detail als die sichtbare Tabelle).
- "If you view the CSV file in a table format, the file's columns represent costs and the rows represent time. [...] the columns and rows are transposed [vs. UI-Tabelle]."
- "The file shows data with up to **15 decimal places** of precision."
- "The file shows dates in the **YYYY-MM-DD** format."

**Zeitraum-Presets** (wörtlich, [ce-modify.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-modify.html)), historisch:
Custom, **1D** (Last 1 Day), **7D** (Last 7 Days), **Current Month**, **3M** (Last 3 Months, ohne aktuellen Monat), **6M** (Last 6 Months, ohne aktuellen Monat), **1Y** (Last 12 Months, ohne aktuellen Monat), **MTD** (Month to Date), **YTD** (Year to Date).
Forecast-seitig: Custom, **+1M**, **+3M**, **+18M** (siehe Punkt 3). Historical und Forecasted lassen sich kombinieren, z. B. "Historical time range of 3 months (3M)" + "Forecasted time range of 3 months (+3M)".

**Vergleichsfeature ("Cost Comparison")** ([ce-cost-comparison.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-cost-comparison.html)):
> "Cost Comparison is a feature in Cost Explorer that helps you quickly identify and understand changes in your AWS spending. It automatically analyzes cost variations between two selected months, highlighting the largest cost drivers and explaining the reasons behind these changes."

Zugriff über den Button **"Compare"** im "Report parameters"-Panel von Cost Explorer, oder über das **"Top trends"**-Widget auf der Billing-Startseite ("shows the top 10 cost variations between the previous two months"). Benötigt IAM-Rechte `ce:GetCostAndUsageComparisons` und `ce:GetCostComparisonDrivers`. Vergleicht ausdrücklich **zwei Monate** ("between two selected months") — kein beliebiger Zeitraumvergleich laut dieser Doku-Seite.

---

## Zusammenfassungszeile

| Produkt | Kopfkacheln | Hauptdiagramm | Gruppierungsachsen | Prognose-/Anomalie-Darstellung | Quelle-URL |
|---|---|---|---|---|---|
| **AWS Cost Explorer** | "Month-to-date costs", "Forecasted month end costs", "{{Month}} trends" (Top-Trends-Widget) | Bar / Stacked Bar / Line, Default-Granularität Daily (Hourly nur opt-in, 14 Tage Historie), Top 5 Gruppen + "Other"-Bucket | API operation, AZ, Billing entity, Charge type, Instance type, Legal entity, Linked account, Platform, Purchase option, Region, Resources, Service, Tag, Tenancy, Usage type, Usage type group, Cost Category | 80%-Prediction-Interval (API 51–99 konfigurierbar) als **Linien beidseits der Kosten-Linie (Line-Chart)** bzw. **zwei Linien über der Balkenspitze (Bar-Chart)**; kein Modellname in offizieller Doku genannt; Cost-Comparison-Feature vergleicht zwei Monate, kein separates Anomalie-Chart-Widget in dieser Doku belegt | [ce-what-is.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html), [ce-exploring-data.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-exploring-data.html), [ce-forecast.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html) |

---

### Offene Punkte / nicht abschließend beantwortbar (ehrlich gekennzeichnet)

1. **Exakte visuelle Gestaltung der Prognose-Linien** (gestrichelt? Farbe? Transparenz?) — offizielle Doku sagt nur "a set of lines" / "two lines", keine Styling-Details. Ich konnte keine Blog-/Screenshot-Quelle mehr nachziehen, weil das Web-Search-Kontingent dieser Session bereits vor meiner Recherche verbraucht war (`WebSearch was not performed: this session has used its web search budget`). Das ist also eine echte Lücke, nicht nur "nur aus Blog bekannt".
2. **Konkretes ML-Modell/Verfahren** hinter dem Forecast — in keiner offiziellen `docs.aws.amazon.com`-Seite benannt; die FAQ (Marketing-Domain `aws.amazon.com`) sagt nur "analyzing your historical pattern".
3. **Sekundäre Group-by-Achse / maximale Anzahl gleichzeitiger Group-by-Dimensionen** — nicht in der abgerufenen Doku beziffert (nur die Filter-Obergrenze von 1024 ist beziffert).
4. **Widerspruch 18 vs. 12 Monate** Forecast-Zeitraum beim initialen Setup zwischen [ce-what-is.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html) ("forecast [...] for the next 18 months") und [ce-enable.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-enable.html) ("calculates the forecast for the next 12 months") — beide wörtlich, keine Erklärung in der Doku gefunden.
5. Ob der "Daten sind vorläufig"-Hinweis als sichtbares **UI-Banner** erscheint oder nur als Doku-Note dokumentiert ist, bleibt unbestätigt.