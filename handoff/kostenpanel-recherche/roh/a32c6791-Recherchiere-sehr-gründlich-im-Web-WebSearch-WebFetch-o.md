# AUFTRAG

Recherchiere sehr gründlich im Web (WebSearch + WebFetch, offizielle Doku bevorzugt) wie die GROSSEN Cloud-Billing-Dashboards Kosten darstellen. Schwerpunkt: PROGNOSE, ANOMALIEERKENNUNG, BUDGETS, GRUPPIERUNG.

Produkte:
1. AWS Cost Explorer (docs.aws.amazon.com/cost-management) — Ansichten, Gruppierung (Group by), Filter, Granularität, Forecast
2. AWS Cost Anomaly Detection — wie wird eine Anomalie dargestellt, welcher Schwellwert, "expected spend vs actual spend"
3. AWS Budgets — Alarm-Schwellen, "forecasted to exceed"
4. GCP Cloud Billing Reports — Gruppierung, Zeitachse, "Cost trend / forecast"
5. GCP Budgets & Alerts, GCP Cost Anomaly Detection (falls es das gibt)
6. Azure Cost Management (Cost analysis, Forecast, Anomaly detection) als Gegenprobe

Für JEDES will ich KONKRET, belegt mit URLs:
- Welche Kopfkacheln/Summenzeilen (z.B. "Month-to-date cost", "Forecasted month-end", "Cost trend vs last month")
- Hauptdiagramm: gestapelte Balken pro Tag? Linie? Welche Standardgranularität?
- WIE WIRD DIE PROGNOSE VISUELL DARGESTELLT? Das ist der Kernpunkt: gestrichelte Linie? Schraffiertes Band? Helle/transparente Balken für zukünftige Tage? Konfidenzintervall (AWS Cost Explorer hat ein "prediction interval" — wie sieht das aus, welche Konfidenz, 80%/95%?). Zitiere die Doku wörtlich zu Prognose-Genauigkeit und Konfidenzband.
- Wie unterscheiden sie "unblended/amortized/estimated" vs. "final/invoiced" Kosten? AWS sagt Daten sind bis zur Rechnungsstellung vorläufig — wo/wie steht 

---

Alle drei Agenten sind zurück. Hier die zusammengeführte Recherche.

---

# Kostendarstellung in den großen Cloud-Billing-Dashboards

**Vorbemerkung zur Quellenlage:** Das WebSearch-Kontingent der Session (200 Aufrufe) war teilweise schon erschöpft, WebFetch der offiziellen Doku funktionierte durchgehend. Alles unten stammt aus `docs.aws.amazon.com`, `cloud.google.com/billing/docs` bzw. `learn.microsoft.com`. **Wo eine visuelle Eigenschaft nicht in der Doku steht, sage ich das ausdrücklich — ich habe nichts ergänzt.** Zitate im englischen Original, weil die Doku englisch ist.

---

## 1. AWS Cost Explorer

**Kopfkacheln** (Cost-Explorer-Dashboard, nicht der Report-Editor):
- **„Month-to-date costs"** – „shows how much you're **estimated** to have incurred in charges so far this month and compares it to this time last month."
- **„Forecasted month end costs"** – „shows how much Cost Explorer estimates that you will owe at the end of the month and compares your estimated costs to your actual costs of the previous month."
- **„{{this month}} trends"** – Top-Kostentrends mit „View all trends"
- Explizit: „The Month-to-date costs and the Forecasted month end costs don't include refunds." · „only shown in US dollars."
- [ce-exploring-data.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-exploring-data.html)

**Hauptdiagramm:** „Cost Explorer provides three styles for charting your cost data: **Bar charts** (Bar), **Stacked bar charts** (Stack), **Line graphs** (Line)." Granularität Daily/Monthly/Hourly; Hourly nur nach Opt-in und dann nur 14 Tage rückwirkend. Dashboard-Default: „a graph of your **daily unblended** costs". **Top-N-Regel:** Top 5 Gruppen einzeln + alles Übrige aggregiert in einen Balken **„Other"** — belegt an der Steuer-Regel: „If you select six or more filters, Cost Explorer displays five bars, stacks, or lines, and then aggregates all remaining items […] into a sixth bar, stack slice, or plot line that's labeled Other." ([ce-modify.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-modify.html), [ce-filtering.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-filtering.html))

### ★ Prognose-Darstellung — der Kernpunkt

Das ist die präziseste Aussage, die es in der gesamten Recherche zur Prognosevisualisierung gibt:

> „How you read the Cost Explorer forecasts depends on the type of chart that you're using. Forecasts are available for both line charts and bar charts.
> **The 80% prediction interval appears differently on each type of chart:**
> + **Line charts represent the prediction interval as a set of lines that are on either side of your costs line.**
> + **Bar charts represent the prediction interval as two lines that are on either side of the top of your bar.**"
> — [ce-forecast.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html)

Also: **kein schraffiertes Band, keine transparenten Zukunftsbalken** — sondern zwei zusätzliche Begrenzungslinien. Ob gestrichelt oder in welcher Farbe, **sagt die Doku nicht**; das bleibt eine offene Lücke (kein Screenshot verifizierbar).

**Konfidenz:** In der Konsole fix auf 80 %:
> „Cost Explorer forecasts have a **prediction interval of 80%**. If AWS doesn't have enough data to forecast an 80% prediction interval, Cost Explorer doesn't provide a forecast. This is common for accounts that have less than one full billing cycle."

Konfigurierbar **nur über die API**: `GetCostForecast` → `PredictionIntervalLevel`, „Minimum value of 51. Maximum value of 99." — „The higher the confidence level, the more confident Cost Explorer is about the actual value falling in the prediction interval. Higher confidence levels result in wider prediction intervals." ([API_GetCostForecast](https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_GetCostForecast.html))

**Genauigkeit, wörtlich:**
> „Like weather forecasts, billing forecasts can vary in accuracy. […] The range in the prediction band is dependent on your **historical spend volatility, or fluctuations**. The more consistent and predictable the historical spend, the narrower the prediction range in forecast spend."
> „Because forecasts are predictions, the forecasted billing amounts are **estimated and might differ from your actual charges** for each statement period."

**Verfahren:** In keiner offiziellen `docs.aws.amazon.com`-Seite wird ein Modellname genannt — nur „This forecast is based on your past usage." Die FAQ (Marketing-Domain) sagt „analyzing your historical pattern". **Kein ARIMA/Prophet/DeepAR belegbar.**

**Prognose-Zeiträume:** `+1M` (nur bei Daily), `+3M` (Daily oder Monthly), `+18M` (nur Monthly). Kombinierbar mit historischem Zeitraum. Kleine Doku-Diskrepanz: [ce-what-is](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html) sagt 18 Monate, [ce-enable](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-enable.html) sagt beim Erst-Setup „the next 12 months".

**Wichtig für den aktuellen Tag:** „If you choose any forecasted dates, your **current date's cost and usage data shows as Forecast**. The current date's cost and usage won't include historical data."

**Kostenarten** (Dropdown „Advanced options → Aggregate costs by", 5 Optionen, [ce-advanced.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-advanced.html)): Unblended (Default) · Amortized („effective cost of the upfront and monthly reservation fees spread across the billing period", erst ab 2018) · Blended („average cost […] across the consolidated billing family") · Net unblended („cost after discounts") · Net amortized.

**Vorläufigkeit / Datenlatenz:** „Cost Explorer refreshes your cost data **at least once every 24 hours**. However, this depends on your upstream data from your billing applications, and some data might be updated later than 24 hours." · „All costs reflect your usage **up to the previous day**." — Ob das als sichtbares UI-Banner erscheint, ist **nicht belegt**; ein Text „data for today is incomplete" findet sich nirgends wörtlich.

**Gruppierung:** API operation, Availability Zone, Billing entity, Charge type, Instance type, Legal entity, Linked account, Platform, Purchase option, Region, Resources, Service, Tag, Tenancy, Usage type, Usage type group + **Cost Category** („appears as an additional billing dimension"). **Maximale Zahl gleichzeitiger Group-by ist nicht dokumentiert**; beziffert ist nur die Filtergrenze: **1024 Filter**.

**Export/Presets/Vergleich:** CSV mit 15 Nachkommastellen, Datum `YYYY-MM-DD`, transponiert gegenüber der UI-Tabelle. Presets: Custom, 1D, 7D, Current Month, 3M, 6M, 1Y, MTD, YTD. **„Cost Comparison"**: „automatically analyzes cost variations **between two selected months**, highlighting the largest cost drivers and explaining the reasons behind these changes" — plus „Top trends"-Widget mit den „top 10 cost variations between the previous two months". ([ce-cost-comparison.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-cost-comparison.html))

---

## 2. AWS Cost Anomaly Detection

**Verfahren:** „uses **machine learning models** to detect and alert on anomalous spend patterns" · „evaluate weekly or monthly **seasonality and natural growth**" — kein Modellname. Erwartungswert: „**Expected spend** — The amount our machine learning models expected you to spend during the anomaly's duration, based on your historical spending pattern." ([manage-ad.html](https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html), [getting-started-ad.html](https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html))

**Darstellung = Liste, kein Diagramm.** Tab „Detected anomalies", Default 90 Tage. Spalten wörtlich:
- **Start date**, **Last detected**, **Duration** („An anomaly can be ongoing.")
- **Cost impact** — „calculated as **actual spend − expected spend**"
- **Impact %** — „calculated as **(total cost impact / expected spend) × 100**. This value cannot be calculated when expected spend is zero, so in those situations the value will show as **'N/A'**."
- **Monitor name**, **Top root cause (Service)** (aufklappbar: Account, Region, Usage type), **View more**
- Optionale Spalten: Account, Region, Usage type, **Expected spend**, **Actual spend**, **Assessment** („Not submitted" / „Not an issue" / „Accurate anomaly"), **Severity**

Detailseite: Root-Cause-Analyse + Tabelle „Top ranked potential root causes"; Link **„View in Cost Explorer"** → „a time series graph of the cost impact". **Ob die Detailseite selbst ein eingebettetes Erwartet-vs-Tatsächlich-Diagramm zeigt und ob der Anomaliezeitraum im Cost-Explorer-Chart markiert wird, ist nicht belegbar** (der einschlägige AWS-Blogpost lieferte 404).

**Schwellen:** „There are **two types of thresholds: absolute and percentage**. […] (Optional) Choose Add threshold to configure a second threshold on the same subscription. Thresholds can be combined by choosing **AND or OR** from the dropdown list." Also max. 2 Schwellen, AND/OR-verknüpft. Der oft zitierte Default „40 % und ≥100 USD" stammt nur aus der FAQ und war nicht wörtlich verifizierbar.

**Monitor-Typen:** AWS services · Linked account · Cost allocation tag · Cost category, je „AWS managed"/„Customer managed". Quotas: 2 AWS-managed Monitore pro Management-Account, **500 Customer-managed**, 5.000 Werte pro AWS-managed Monitor, 100 Alert-Subscriptions/Account. ([management-limits.html](https://docs.aws.amazon.com/cost-management/latest/userguide/management-limits.html))

**Latenz, wörtlich:**
> „Cost Anomaly Detection runs **approximately three times a day** […] Cost Anomaly Detection uses data from Cost Explorer, which has a **delay of up to 24 hours**. As a result, it can take up to 24 hours to detect an anomaly after a usage occurs. […] For a new service subscription, **10 days of historical service usage data** is needed before anomalies can be detected."

**Benachrichtigung:** Individual alerts (SNS nötig) · Daily summaries (Top 10 nach Cost Impact, 00:00 UTC) · Weekly summaries. SNS-Payload enthält `anomalyScore.currentScore/maxScore`, `impact.totalActualSpend`, `impact.totalExpectedSpend`, `impact.totalImpactPercentage`.

**Feedback:** „Did you find this detected anomaly to be helpful?" → „Submit assessment […] to help improve our detection accuracy."

---

## 3. AWS Budgets

**Typen:** Cost · Usage · RI utilization · RI coverage · Savings Plans utilization · Savings Plans coverage. ([budgets-managing-costs.html](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html))

**Alarm-Schwellen, wörtliche UI-Formulierung** ([create-cost-budget.html](https://docs.aws.amazon.com/cost-management/latest/userguide/create-cost-budget.html)):
> „Next to the amount, choose **Absolute value** […] Or, choose **% of budgeted amount** […]
> Next to the threshold, choose **Actual** to create an alert for actual spend. Or, choose **Forecasted** to create an alert for forecasted spend."

Zwei unabhängige Achsen also: Wertform × Trigger-Typ. Eine Maximalzahl von Schwellen pro Budget ist **nicht dokumentiert**; belegt sind 10 E-Mail-Empfänger + 1 SNS-Topic pro Alert.

**„Forecasted to exceed" — Mindesthistorie, wörtlich:**
> „**AWS requires approximately 5 weeks of usage data to generate budget forecasts.** If you set a budget to alert based on a forecasted amount, this budget alert isn't triggered until you have enough historical usage information." ([budgets-best-practices.html](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html))

Und der wichtige Verhaltensunterschied:
> „**Actual** alerts are only sent out **once** per budget, per budget period […] **Forecast**-based budget alerts […] might alert **more than once** in a budgeted period if the forecasted values exceed, dip below, and then exceed the alert threshold again."

**Darstellung** ([budgets-view.html](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-view.html)): Tabelle mit aktuellen Kosten, budgetierten Kosten, **Forecast**, „A percentage that shows your costs or usage compared to your budgeted amount" und „A percentage that shows your **forecasted** costs or usage compared to your budgeted amount". Detailseite: **„Current vs. budgeted"**, **„Forecasted vs. budgeted"**, „Alerts", „Details", **„Budget history"**-Tab (Chart + Tabelle, 12 Monate bzw. 4 Quartale). Eine eingezeichnete horizontale Budget-Linie im Chart ist **nicht dokumentiert**.

**Auswertung:** „AWS Budgets information is updated **up to three times a day**. Updates typically occur 8–12 hours after the previous update." (an anderer Stelle konservativer: „at least once per day").

**Budget Actions:** IAM-Policy oder SCP anwenden, EC2/RDS-Instanzen anhalten — „either automatically or after your manual approval".

---

## 4. GCP Cloud Billing Reports

**Kopfkacheln, wörtlich** ([reports](https://cloud.google.com/billing/docs/how-to/reports)):
- „**Actual cost-to-date** for the current month, including total savings"
- „**Total forecasted cost** for the entire current month, including forecasted savings"
- Beide je mit „a **percent change indicator** to show you if your overall costs are trending up or down compared to the previous time period"

„Total cost"/„Subtotal"/„Promotions and others" sind **keine Kopfkacheln** — das sind Zeilen/Spalten im Cost-Table- bzw. Cost-Breakdown-Report.

**Hauptdiagramm:** gestapelte Balken, „each bar plots costs over time"; alternativ Liniendiagramm „to visualize cost spikes". Default: „the current calendar month's **daily** cost for all services and SKUs, **grouped by Service**". Tag beginnt „at midnight US and Canadian Pacific Time (UTC-8)". Zeitachse wahlweise **Charge period** (Nutzungsdatum, ab Jan 2017) oder **Billing period** (Rechnungsmonat, ab Mai 2019).

### ★ Prognose-Darstellung

> „The report chart includes forecasted costs if the date range ends on a future date."
> „The chart also includes forecasted costs, **indicated in the chart in light gray**."

Also: **hellgraue Balken/Fläche direkt in derselben Zeitreihe**, keine gestrichelte Linie, **kein Konfidenzband** — die Doku erwähnt keinerlei Intervall. Das ist der klarste Kontrast zu AWS.

Seit 2026 zusätzlich „AI-Driven Cost Forecasts" (GA): „uses advanced machine learning models to analyze historical spending trends, **detect seasonality and recurring cycles, regularize data anomalies**, and predict your future spend **up to 12 months** in advance." ([ai-powered-features](https://cloud.google.com/billing/docs/how-to/ai-powered-features))

**Gruppierung:** Subaccount, Project, Project Hierarchy, Product, Service, SKU, Application, Location. Filter zusätzlich nach Folders & Organizations, Labels, Savings, Invoice-level charges. Maximale Zahl gleichzeitiger Group-by im Hauptreport **nicht dokumentiert**; im Cost-Table-Report ist Custom-Gruppierung explizit auf **3 Dimensionen** begrenzt.

**Kostenarten:** „Unrounded cost" (6 Nachkommastellen) vs. „Cost" (2) vs. „List cost"; Credit-Typen PROMOTION, FREE_TIER, COMMITTED_USAGE_DISCOUNT, SUSTAINED_USAGE_DISCOUNT, FEE_UTILIZATION_OFFSET. ([cost-table](https://cloud.google.com/billing/docs/how-to/cost-table))

**Datenlatenz:** **Offener Punkt.** Trotz gezielter Suche in Reports-, Concepts-, BigQuery-Export- und Pricing-Table-Doku wurde **keine** Aussage der Form „costs may take up to X hours to appear" für den UI-Report gefunden. Belegt sind nur Randfälle (BigQuery-Backfill bis 5 Tage; neue Labels bis 1 Tag).

**Cost Breakdown Report:** **Wasserfall-Diagramm** — Brutto-Kosten → Savings/Credits (Negotiated Savings, CUDs, Free Tier, Promotional Credits, SUD) → Invoice-Level-Posten (Adjustments, Tax) → Gesamtbetrag; Gebühren orange, Gutschriften grün, Summen blau. ([cost-breakdown](https://cloud.google.com/billing/docs/how-to/cost-breakdown))

**Export:** CSV; Cost Table limitiert auf 4 Mio. Zeilen / 150 MB. Presets: „Services — this month" (Default), „Projects — this month", „SKUs — this month", „Services — daily costs L7D", „Most recent invoice month".

---

## 5. GCP Budgets & Alerts + Cost Anomaly Detection

**Budgets** ([budgets](https://cloud.google.com/billing/docs/how-to/budgets)): Alerts-only oder **Spend cap budgets (Preview)**, die Dienste automatisch pausieren. Betrag: „Specified amount" oder „**Last period's spend**" — „a dynamic amount that updates each budget calendar period based on the last calendar period's spend".

**Schwellen, wörtlich:**
> „When you first create a budget, the **default alert thresholds are set at 50%, 90%, and 100%** of the budget amount, calculated against **Actual** spend."
> „Under **Trigger on**, select either **Actual** or **Forecasted** spend."
> „Forecasted cost threshold rules send notifications when the forecasted cost (**calculated out to the end of the current calendar budget period**) exceeds the threshold amount."

Das ist die einzige Definition, die GCP für „forecasted spend" im Budget-Kontext gibt — eine Hochrechnung bis Periodenende, ohne genanntes Modell.

**Visuell:** „cost trend chart" = „bar-chart view of your costs for the past 12 months"; Fortschrittsbalken „A visual gauge of how the actual spend is tracking against the budget's targeted amount"; **Zielbetrag als „red, dashed, horizontal line"** im Diagramm.

**Pub/Sub-Felder:** Attribute `billingAccountId`, `budgetId`, `schemaVersion`; JSON `budgetDisplayName`, `costAmount`, `costIntervalStart`, `budgetAmount`, `budgetAmountType` (`SPECIFIED_AMOUNT` / `LAST_MONTH_COST` / `LAST_PERIODS_COST`), **`alertThresholdExceeded`**, **`forecastThresholdExceeded`**, `currencyCode`. ([budgets-programmatic-notifications](https://cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications))

**Cost Anomaly Detection — ja, es gibt das**, als eigenes **„Cost anomalies dashboard"** unter Billing → Cost management → Anomalies, **GA**; der Tab „By service (Early signals)" ist **Preview**. ([manage-anomalies](https://cloud.google.com/billing/docs/how-to/manage-anomalies))
- Definition: „Anomalies are **spikes or deviations in usage costs that differ from your expected spend**, when compared to historical spending patterns."
- Basis: „Usage costs are calculated using the **on-demand rates**" — CUD-Credits und SUD sind ausgeschlossen.
- Verfahren: nur „AI-powered anomaly detection algorithm", lernt aus Nutzerfeedback („unexpected cost increase" / „expected cost increase" / „insignificant impact").
- Darstellung: **tabellarische Ereignisliste**, kein Trend-Chart; Zeile anklickbar → Root-Cause-Analyse.
- Schwellen: automatisch gesetzt, anpassbar über **„Cost Impact"** (Währungsbetrag) und **„Deviation Percentage"**; Early-Anomalies-Schwellen sind fix.
- Benachrichtigung: E-Mail (einzeln oder Tageszusammenfassung) + Pub/Sub. Early Alerts mit 20–40 Min. Latenz.

---

## 6. Azure Cost Management (Gegenprobe)

**Kopfkacheln (KPIs) in Smart views** ([quick-acm-cost-analysis](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/quick-acm-cost-analysis)):
- **Total** — „Note the small percentage next to the total – it's the **change compared to the previous period**."
- **Average** — „If showing three months or less, the Average cost […] compares the cost from the start of the period (up to but not including today) to the same number of days in the previous period."
- **Budget** — mit „create"-Link, wenn keins existiert
- **Forecast** — **nur Preview:** „If you want to monitor your forecasted cost, you can enable the **Forecast KPI preview feature** in Cost Management Labs."
- Darunter **Insights**, u. a. Anomalien; sonst „**No anomalies detected**"

**Zwei Ansichtsklassen:** *Smart views* (Resources, Resource groups, Subscriptions, Services, Reservations, Customers — mit KPIs, Insights, Tabelle, bis zu 5 Tabs) vs. *Customizable views* (Accumulated costs, Daily costs, Cost by service, Cost by resource, Invoice details — mit Chart, Group by, Filter, speicher- und teilbar).

**Chart-Typen** ([customize-cost-analysis-views](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/customize-cost-analysis-views)):
- **Area** – „ideal for showing a running total with forecast trending towards a budget"
- **Line** – „aren't stacked, which helps spot changes easily"
- **Column (stacked)** – „ideal for reviewing your daily or monthly run rate"
- **Column (grouped)** – „when you view grouped costs with no granularity"
- **Table**

Granularität: **None / Daily / Monthly / Accumulated** („running total for each day including the total of all previous days"). Daily max. 92 aufeinanderfolgende Tage, sonst Umschaltung auf Monthly; max. 12 Monate. Default-Zeitraum: aktueller Kalendermonat.

### ★ Prognose-Darstellung

Das hier ist die entscheidende Stelle — und sie widerspricht AWS diametral:

> „Forecast costs are shown in Cost Analysis when using **area and stacked column charts**. […] In the default view, the top chart has the Actual/Amortized cost and forecast cost sections. **The solid color of the chart shows your Actual/Amortized cost. The shaded color shows the forecast cost.**"
> — [cost-analysis-common-uses](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/cost-analysis-common-uses)

Also **derselbe Chart, Zukunft in abgeschwächter/schattierter Farbe** — wie GCP („light gray"), nicht wie AWS (Begrenzungslinien). **Kein Konfidenzintervall**, weder erwähnt noch angedeutet.

**Verfahren, wörtlich** (das einzige Produkt, das sein Modell benennt):
> „Forecasting employs a **time series linear regression model**, which adjusts to factors such as reserved instance purchases that temporarily affect forecasted costs. Following such purchases, the forecasted costs typically stabilize in alignment with usage trends within a few days."
> „For accurate long-term forecasting, it's essential to have sufficient historical data. New subscriptions or contracts with limited historical data might result in less accurate forecasts. **At least 90 days of historical data are recommended for a more precise annual forecast.**"
> „When you select a budget in a custom view, you can also see **if or when your forecast would exceed your budget**."

Und eine explizite Lookback-Tabelle: Prognosedauer bis 28 Tage → 28 Tage Lookback; über 28 Tage → gleich der Prognosedauer; über 90 Tage → 90 Tage. Prognose bis zu **1 Jahr** in die Zukunft.

Wichtige Einschränkung: „**The forecasted cost isn't calculated for each service. It's projected for the Total** of all your services." — beim Gruppieren gibt es also nur *eine* Gesamtprognose, keine je Serie.

### Anomalieerkennung — mit Abstand am ausführlichsten dokumentiert

> „Cost anomalies are evaluated for subscriptions **daily** and compare the day's total usage to a forecasted total based on the **last 60 days** to account for common patterns in your recent usage. For example, spikes every Monday. **Anomaly detection runs 36 hours after the end of the day (UTC)** to ensure a complete data set is available.
> The anomaly detection model is a **univariate time-series, unsupervised prediction, and reconstruction-based model** that uses 60 days of historical usage for training, then forecasts expected usage for the day. Anomaly detection forecasting uses a **deep learning algorithm called WaveNet**. **It's different than the Cost Management forecast.** The total normalized usage is determined to be anomalous if it falls **outside the expected range based on a predetermined confidence interval**."
> — [analyze-unexpected-charges](https://learn.microsoft.com/en-us/azure/cost-management-billing/understand/analyze-unexpected-charges)

- Nur auf **Subscription-Scope**, nicht Azure Government.
- Anzeige als **Insight-Karte** über der Tabelle, Beispieltext-Muster: „**Daily run rate down 748% on Sep 28**" — d. h. eine Prozentangabe der Abweichung plus Datum, als Satz. Ohne Befund: „**No anomalies detected**", „confirming the dates that were evaluated".
- Klick auf den Insight öffnet die klassische Cost analysis, gefiltert auf den bewerteten Zeitraum, gruppiert nach Resource group.
- **Schwellen sind nicht konfigurierbar** — Anomaly alerts sind an/aus, max. **5 Alert-Regeln pro Subscription**, Mail nur einmal bei Erkennung.

**Kostenarten:** **Actual cost** (Default, „as they get accrued and appear on your invoice") vs. **Amortized cost** — Umschalter im Total-KPI-Menü. „actual cost and amortized cost views show **different total numbers**."

**Vorläufigkeit, wörtlich** ([understand-cost-mgt-data](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/understand-cost-mgt-data)) — das klarste Statement aller drei Anbieter:
> „**All included costs are estimated until an invoice is generated.** Estimated costs shown in Cost Management during the open month, before invoice generation, **don't consider tiered pricing plans**. The cost estimates calculated during this time are based on the **highest tier** for a product. After an invoice is issued, charges in Cost Management are updated and they should match the invoice."
> „For EA and MCA subscriptions, cost and usage data is typically available in Cost Management **within 8-24 hours**. For pay-as-you-go subscriptions, it could take **up to 72 hours**."
> „**Estimated charges for the current billing period are updated six times per day.**"
> „Azure finalizes or *closes* the current billing period typically **up to 72 hours** after the billing period ends."
> „During the open month (uninvoiced) period, Cost Management data **should be considered as estimated only**."

**Gruppierung:** Billing period, Charge type, Department, Enrollment account, Frequency, Invoice ID, Location, Meter, Pricing model, Product, Provider, Publisher type, Reservation, Resource, Resource group, Resource type, ServiceFamily, Service name, Service tier, Subscription, Tag, UnitOfMeasure. ([group-filter](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/group-filter))

**Explizit nur eine Achse:** „Cost Analysis **doesn't support grouping by multiple attributes**. To work around it, you can apply a filter for a desired attribute and group by the more detailed attribute." Dafür gibt es **Pivot charts** unter dem Hauptdiagramm, die andere Gruppierungen parallel zeigen (Filter wirken, Group-by/Granularity nicht).

**Top-N-Regel (die präziseste aller Anbieter):** „the **top 10** cost contributors are shown from highest to lowest. If there are more than 10, the **top nine** cost contributors are shown with an **Others** group […] When you're grouping by tags, an **Untagged** group appears […] **Untagged is always last**, even if untagged costs are higher than tagged costs."

**Budget im Chart:** „If your costs go over your budget, you see a **red critical icon** next to your budget. If your **forecast** goes over your budget, you see a **yellow warning icon**." Und: „When you view daily or monthly costs, your budget might get **estimated** for the period. For instance, a monthly budget of $31 are shown as **`$1/day (est)`**."

**Budgets:** monatlich/quartalsweise/jährlich, „at least one cost threshold (% of budget) […] optionally include **up to five thresholds and five email addresses**". Umschaltung über das Feld **`Type`** zwischen Actual und Forecasted. „Alert limits support a range of **0.01% to 1000%**." Auswertung „**every 24 hours**", Mail „within an hour of the evaluation". Wichtig: „**Budget cost evaluations are based on actual cost. They don't include amortization.**"

---

## Zusammenfassung — eine Zeile pro Produkt

| Produkt | Kopfkacheln | Hauptdiagramm | Gruppierungsachsen | Prognose-/Anomalie-Darstellung | Quelle |
|---|---|---|---|---|---|
| **AWS Cost Explorer** | „Month-to-date costs", „Forecasted month end costs" (je mit Vergleich zum Vormonat), „{{Month}} trends" | Bar / Stacked Bar / Line; Default Daily unblended; Hourly nur opt-in (14 T.); Top 5 + „Other" | 16 Dimensionen (Service, Linked account, Region, Instance type, Usage type, Tag, Charge type, …) + Cost Category; max. Group-by undokumentiert, 1024 Filter | **80 % prediction interval als zwei zusätzliche Linien** beidseits der Kostenlinie bzw. der Balkenspitze; API 51–99 konfigurierbar; kein Modellname; aktueller Tag zählt als „Forecast" | [ce-forecast.html](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html) |
| **AWS Cost Anomaly Detection** | Keine KPI-Kacheln — Listenfelder: Cost impact, Impact %, Expected/Actual spend, Severity, Assessment | Kein eigenes Chart; nur Link „View in Cost Explorer" → Zeitreihe des Cost Impact | Root-Cause: Service, Account, Region, Usage type; Monitore zusätzlich Cost category, Cost allocation tag | Cost impact = actual − expected; Impact % = impact/expected×100 („N/A" bei expected=0); 2 Schwellen absolut/prozentual mit AND/OR; ~3×/Tag, bis 24 h Latenz, 10 Tage Mindesthistorie | [getting-started-ad.html](https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html) |
| **AWS Budgets** | „Current vs. budgeted", „Forecasted vs. budgeted", „Alerts", „Details" + %-Spalten in der Übersicht | Cost-Explorer-Graph im Wizard; „Budget history"-Chart (12 M. / 4 Q.); Budget-Linie undokumentiert | Scope-Filter je Typ: Service, Linked Account, Region, Usage Type, Cost Category, Tag | Je Schwelle: Absolute value / % of budgeted × **Actual / Forecasted**; **~5 Wochen Nutzungsdaten** nötig; Actual alarmiert 1×, Forecasted mehrfach; Update bis 3×/Tag | [budgets-view.html](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-view.html) |
| **GCP Cloud Billing Reports** | „Actual cost-to-date …", „Total forecasted cost …" — beide mit %-Trendindikator ggü. Vorperiode | Gestapelte Balken (alt. Linie); Default tägliche Kosten, gruppiert nach Service; Charge- vs. Billing-period | Subaccount, Project, Project Hierarchy, Product, Service, SKU, Application, Location; Cost Table: max. 3 Custom-Dimensionen | **Forecast als hellgraue Fortsetzung im selben Chart** („indicated in the chart in light gray"), **kein Konfidenzband dokumentiert**; separat ML-Forecast bis 12 Monate (Saisonalität, Anomalie-Regularisierung) | [reports](https://cloud.google.com/billing/docs/how-to/reports) |
| **GCP Budgets & Anomalies** | Fortschrittsbalken „Spend and budget amount" + 12-Monats-Balkenchart; Anomalien: reine Ereignisliste | Balkendiagramm mit **roter gestrichelter horizontaler Ziel-Linie**; Anomalien ohne Chart | Billing-Konto, Org/Ordner/Projekt, Service, Label, Subaccount, Savings-Typ | Trigger „**Actual**" vs. „**Forecasted**" (bis Periodenende hochgerechnet), Defaults 50/90/100 %; Anomalien GA, Schwellen über „Cost Impact" + „Deviation Percentage", Early signals Preview (20–40 Min.) | [budgets](https://cloud.google.com/billing/docs/how-to/budgets) · [manage-anomalies](https://cloud.google.com/billing/docs/how-to/manage-anomalies) |
| **Azure Cost Management** | **Total** (mit % ggü. Vorperiode), **Average**, **Budget**, **Forecast** (nur Labs-Preview) + Insight-Karte „No anomalies detected" | Area / Line / Column stacked / Column grouped / Table; Granularität None/Daily/Monthly/**Accumulated**; Default aktueller Monat; Top 9 + „Others" + „Untagged" zuletzt | 22 Dimensionen; **explizit nur EINE Group-by-Achse** — Mehrfachgruppierung nur über Filter + Pivot charts | **Prognose als schattierte Farbe im selben Chart** („solid color = actual, shaded color = forecast"), nur bei Area/Column stacked, nur als Gesamtsumme, **kein Konfidenzintervall**; Modell **time series linear regression**, ≥90 Tage Historie empfohlen. Anomalie: **WaveNet**, 60 Tage Training, täglich, 36 h nach Tagesende, Text „Daily run rate down X% on <Datum>", Schwellen nicht konfigurierbar | [quick-acm-cost-analysis](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/quick-acm-cost-analysis) · [analyze-unexpected-charges](https://learn.microsoft.com/en-us/azure/cost-management-billing/understand/analyze-unexpected-charges) |

---

## Die drei Befunde, die für einen eigenen Nachbau am meisten zählen

1. **Nur AWS zeigt Unsicherheit — und zwar als Linien, nicht als Band.** GCP und Azure zeichnen die Zukunft schlicht in derselben Zeitreihe blasser weiter („light gray" / „shaded color") und geben *gar keine* Bandbreite an. AWS ist der einzige mit einem benannten Intervall (80 %, API 51–99) und stellt es ausdrücklich als *Linien* dar, nicht als Fläche. Wer ein Konfidenzband schraffiert, baut damit etwas, das kein großer Anbieter so macht.

2. **Die Prognose ist überall eine Gesamtsumme, nie pro Serie.** Azure sagt es am deutlichsten: „The forecasted cost isn't calculated for each service. It's projected for the **Total**." Eine gestapelte Prognose je Gruppe gibt es bei keinem.

3. **Anomalie und Prognose sind bewusst getrennte Systeme.** Azure schreibt es explizit hin: die Anomalieerkennung (WaveNet, 60 Tage, unsupervised) „is **different than** the Cost Management forecast" (lineare Regression). Und die Anomalie erscheint überall als **Liste/Textkarte mit Prozentabweichung**, nirgends als Markierung im Hauptdiagramm — bei AWS bestätigt nur als Link „View in Cost Explorer", eine Hervorhebung des Anomaliezeitraums im Chart ist bei keinem Anbieter dokumentiert.

**Ehrlich offen geblieben:** Strichart/Farbe der AWS-Prognoselinien (Doku sagt nur „a set of lines"); das AWS-Forecast-Modell (nirgends benannt); ob AWS/GCP einen sichtbaren „Daten unvollständig"-Hinweis im UI zeigen (nur Azure dokumentiert die Vorläufigkeit klar, inkl. „based on the highest tier for a product"); GCPs UI-Datenlatenz (keine wörtliche Angabe auffindbar); maximale Zahl gleichzeitiger Group-by bei AWS und GCP.