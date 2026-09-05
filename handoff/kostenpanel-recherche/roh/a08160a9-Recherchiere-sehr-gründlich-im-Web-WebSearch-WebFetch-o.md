# AUFTRAG

Recherchiere sehr gründlich im Web (WebSearch + WebFetch, offizielle AWS-Doku docs.aws.amazon.com bevorzugt) zu **AWS Cost Anomaly Detection** und **AWS Budgets**. Antworte auf DEUTSCH. Belege JEDE Aussage mit einer konkreten URL. Erfinde nichts. Visuelle Eigenschaften, die du nur aus Blogposts/Screenshots kennst, ausdrücklich als solche kennzeichnen.

Startpunkte (wirklich fetchen):
AWS Cost Anomaly Detection:
- https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html
- https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html
- https://docs.aws.amazon.com/cost-management/latest/userguide/settingup-ad.html
- https://docs.aws.amazon.com/cost-management/latest/userguide/understanding-ad.html (falls existent)
- AWS Blog-Posts zu Cost Anomaly Detection (Screenshots der Anomalie-Detailseite)
AWS Budgets:
- https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html
- https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create.html
- https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html
- Alles zu "actual vs forecasted" Alarm-Typ, Schwellwerten, "forecasted to exceed"

Beantworte KONKRET:

A) AWS COST ANOMALY DETECTION
1. Welches Verfahren/Algorithmus (ML? welches Modell? wie wird "expected spend" berechnet)? Wörtliches Zitat aus der Doku.
2. Wie wird eine Anomalie DARGESTELLT: Liste? Detailseite? Welche Felder genau — "Total cost impact", "Expected spend",

---

# AWS Cost Anomaly Detection & AWS Budgets — Recherche-Ergebnis

Hinweis vorab: Das Web-Suchkontingent dieser Sitzung wurde während der Recherche aufgebraucht (WebSearch-Aufrufe erschöpft), daher stützt sich alles ausschließlich auf **WebFetch-Abrufe der offiziellen AWS-Doku** sowie zwei AWS-Produktseiten. Ein AWS-Blogpost mit Screenshots (aws.amazon.com/blogs/aws-cloud-financial-management/getting-started-with-aws-cost-anomaly-detection/) lieferte einen HTTP 404 — es konnte daher **kein einziger Screenshot verifiziert werden**. Jede visuelle Aussage, die ich nicht wörtlich aus einer erfolgreich abgerufenen Doku-Seite belegen kann, ist unten ausdrücklich als "unbestätigt/nicht in Doku beschrieben" gekennzeichnet — ich habe nichts erfunden.

Zwei Fundstellen sind zusätzlich mit Vorsicht zu lesen: die Produkt-FAQ-Seite (aws.amazon.com/aws-cost-management/aws-cost-anomaly-detection/faqs/) und die Produktseite selbst wurden von meinem Fetch-Werkzeug bereits automatisch ins Deutsche übersetzt/paraphrasiert zurückgegeben — das sind **keine wortwörtlichen AWS-Originalzitate**, sondern Paraphrasen. Ich kennzeichne das jeweils. Alle anderen Zitate stammen aus dem direkt in Markdown konvertierten Original-Dokutext (docs.aws.amazon.com) und sind wörtlich.

---

## A) AWS COST ANOMALY DETECTION

### A1. Verfahren/Algorithmus

Wörtliches Zitat der offiziellen Doku:

> "AWS Cost Anomaly Detection is a feature that uses machine learning models to detect and alert on anomalous spend patterns in your deployed AWS services."
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html

> "You can evaluate your spend patterns using machine learning methods to minimize false positive alerts. For example, you can evaluate weekly or monthly seasonality and natural growth."
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html

Wie "Expected spend" berechnet wird — wörtlich aus der Feldbeschreibung:

> "Expected spend — The amount our machine learning models expected you to spend during the anomaly's duration, based on your historical spending pattern."
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html

Ein konkreter Modellname (z. B. Random Cut Forest, ARIMA o. ä.) wird in der öffentlichen Doku **nicht genannt** — AWS spricht durchgängig nur allgemein von "machine learning models" / "machine learning methods". Das ist keine Lücke meiner Recherche, sondern der Stand der offiziellen Dokumentation.

### A2. Darstellung der Anomalie

**Liste** — Tab "Detected anomalies", Standard-Zeitraum 90 Tage, mit Standardspalten (wörtlich, gekürzt):
- **Start date** – "The day that the anomaly started."
- **Last detected** – "The last time that the anomaly was detected."
- **Duration** – "The duration that the anomaly lasted. An anomaly can be ongoing."
- **Cost impact** – "The spend increase detected compared to the expected spend amount. It is calculated as actual spend - expected spend."
- **Impact %** – "The percentage difference between the actual spend and expected spend. It is calculated as (total cost impact / expected spend) * 100. [...] This value cannot be calculated when expected spend is zero, so in those situations the value will show as 'N/A'."
- **Monitor name**
- **Top root cause (Service)** – Klick zeigt drei weitere Root-Cause-Dimensionen: Account, Region, Usage type
- **View more** – Link zur Anomaly-Details-Seite

Optionale Zusatzspalten (wörtlich): **Account**, **Region**, **Usage type**, **Expected spend**, **Actual spend**, **Assessment** (Werte: "Not submitted", "Not an issue", "Accurate anomaly"), **Severity**.
Quelle für alle vorstehenden Feldnamen: https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html

**Detailseite "Anomaly details"**: enthält laut Doku "root cause analysis and cost impact of the anomaly" sowie eine Tabelle "Top ranked potential root causes". Ein optionaler Link **"View in Cost Explorer"** führt zu "a time series graph of the cost impact"; ein optionaler Link **"View root cause"** in der Root-Cause-Tabelle zeigt "a time series graph that's filtered by that root cause". Quelle (wörtlich): https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html

Ein SNS-Alert liefert zusätzlich strukturierte Felder als JSON, u. a. `anomalyScore.currentScore/maxScore`, `impact.maxImpact`, `impact.totalActualSpend`, `impact.totalExpectedSpend`, `impact.totalImpact`, `impact.totalImpactPercentage`, sowie pro Root-Cause `linkedAccount`, `region`, `service`, `usageType`, `impact.contribution` — Beispiel-Payload dokumentiert unter derselben Quelle.

**Diagramm auf der Detailseite selbst — unbestätigt:** Die Doku beschreibt nur den *Link* "View in Cost Explorer", der zu einem Zeitreihen-Diagramm *in Cost Explorer* führt. Ob auf der Anomaly-Details-Seite selbst bereits ein eingebettetes "Erwartet vs. Tatsächlich"-Diagramm angezeigt wird (wie es aus manchen Blogpost-Screenshots kolportiert wird), konnte ich **nicht verifizieren** — der einzige Blogpost-Versuch schlug mit 404 fehl, und WebSearch war zu diesem Zeitpunkt bereits aufgebraucht. Bitte diese Aussage nicht als bestätigt behandeln.

### A3. Schwellwerte

Wörtlich:

> "There are two types of thresholds: absolute and percentage. Absolute thresholds trigger alerts when an anomaly's total cost impact exceeds your chosen threshold. Percentage thresholds trigger alerts when an anomaly's total impact percentage exceeds your chosen threshold. Total impact percentage is the percentage difference between the total expected spend and total actual spend.
> (Optional) Choose Add threshold to configure a second threshold on the same subscription. Thresholds can be combined by choosing AND or OR from the dropdown list."
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html

Also: maximal **zwei** Thresholds pro Alert-Subscription, kombinierbar per **AND**/**OR**-Dropdown. Zusätzlich wörtlich:

> "AWS Cost Anomaly Detection sends you a notification when an anomaly reaches or exceeds the Threshold. If an anomaly continues over multiple days, then alert recipients will continue to get notifications while the threshold is met. Even if an anomaly is below the alert threshold, the machine learning model continues to detect spend anomalies on your account."
Quelle: ebd.

Ein von der Produkt-FAQ genannter Standard-Schwellwert ("40 % vom erwarteten Spend UND mindestens 100 USD") ist **nicht wörtlich verifizierbar** — diese Angabe kam nur als paraphrasierte/übersetzte FAQ-Antwort zurück (https://aws.amazon.com/aws-cost-management/aws-cost-anomaly-detection/faqs/), nicht aus dem direkt konvertierten docs.aws.amazon.com-Text.

### A4. Monitor-Typen

Vier Dimensionen, jeweils in zwei Varianten ("AWS managed" / "Customer managed"): **AWS services**, **Linked account**, **Cost allocation tag**, **Cost category**. Tabelle wörtlich zusammengefasst unter "Monitor types":
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html

Zulässige Anzahl (wörtliche Quotas-Tabelle):

| Quota | Wert |
|---|---|
| AWS managed monitor für AWS services pro Account (Management + Member) | 1 |
| Zusätzliche AWS managed monitors (Linked account, Tag oder Cost category) pro Management-Account | 1 |
| Gesamt AWS managed monitors pro Management-Account | 2 |
| Gesamt AWS managed monitors pro Member-Account | 1 |
| Werte pro AWS managed monitor | 5.000 |
| Customer managed monitors pro Management-Account | 500 |
| Werte pro Customer managed monitor (Linked accounts / Tag-Werte) | 10 |
| Werte pro Customer managed monitor (Cost category) | 1 |
| Alert subscriptions pro Account | 100 |
| E-Mail-Empfänger pro Subscription | 10 |
| SNS-Topics pro Subscription | 1 |
| Monitore pro Alert Subscription | 502 (max., alle Monitore anhängbar) |

Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/management-limits.html

Zusätzlich: "AWS managed monitors can track up to 5,000 values within a dimension. If your organization has more than 5,000 values [...] the monitor will track the top 5,000 values based on their total spend." — https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html

### A5. Erkennungslatenz

Wörtlich, zentrales Zitat:

> "After your billing data is processed, AWS Cost Anomaly Detection runs approximately three times a day in order to monitor for anomalies in your net unblended cost data (that is, net costs after all applicable discounts are calculated). You might experience a slight delay in receiving alerts. Cost Anomaly Detection uses data from Cost Explorer, which has a delay of up to 24 hours. As a result, it can take up to 24 hours to detect an anomaly after a usage occurs. If you create a new monitor, it can take 24 hours to begin detecting new anomalies. For a new service subscription, 10 days of historical service usage data is needed before anomalies can be detected for that service."
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html

Bestätigt in der Quotas-Tabelle: "Time to detect anomaly after usage: Up to 24 hours" / "Historical data required for detection: 10 days minimum" — https://docs.aws.amazon.com/cost-management/latest/userguide/management-limits.html

### A6. Benachrichtigung

Drei Frequenzoptionen, wörtlich:

> "**Individual alerts** — The alert notifies you as soon as an anomaly is detected. You might receive multiple alerts throughout a day. These notifications require an Amazon SNS topic."
> "**Daily summaries** — An email notification with a daily summary of top 10 alerts from the previous day, sorted by cost impact. The system generates this summary at 00:00 UTC daily, though actual delivery time may vary. [...] For immediate alerts, we recommend using the individual alerts option."
> "**Weekly summaries** — An email notification with a weekly summary of alerts. You receive one email per week containing information about multiple anomalies that occurred during that week."
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html

SNS-Topics können zusätzlich per Amazon Q Developer in chat applications an Slack/Chime weitergeleitet werden (dieselbe Quelle sowie https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html).

### A7. Kosten des Features / Mindesthistorie

Mindesthistorie ist mehrfach wörtlich belegt: "10 days minimum" (management-limits.html) bzw. "For a new service subscription, 10 days of historical service usage data is needed before anomalies can be detected for that service." (manage-ad.html). Beides oben zitiert.

Zu den **Kosten**: In den drei erfolgreich per WebFetch abgerufenen docs.aws.amazon.com-Seiten wird kein Preis genannt. Die Produktseite/FAQ (aws.amazon.com/aws-cost-management/aws-cost-anomaly-detection/, .../faqs/) kam nur als paraphrasierte deutsche Zusammenfassung zurück ("ohne Aufwand oder Kosten") — das ist **keine wörtlich verifizierte Aussage**, sondern eine Paraphrase meines Fetch-Werkzeugs. Ich kann also nur sagen: In keiner der abgerufenen offiziellen Doku-Seiten wird eine separate Gebühr für Cost Anomaly Detection erwähnt (es ist branchenweit bekannt, dass das Feature Teil von Cost Explorer ohne separate Zusatzgebühr ist, aber das ist hier nicht durch ein wörtliches AWS-Zitat abgedeckt).

### A8. Anomalie-Feedback

Wörtlich:

> "(Optional) Choose Submit assessment in the Did you find this detected anomaly to be helpful? information alert to provide feedback and help improve our detection accuracy."
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html

Die möglichen Assessment-Werte (aus der Spaltendefinition, wörtlich): "**Not submitted**, **Not an issue**, or **Accurate anomaly**." — ebd. Die Doku sagt ausdrücklich, wozu das Feedback dient: "to help improve our anomaly detection systems" bzw. "to help improve our detection accuracy" (beide Formulierungen kommen wörtlich auf derselben Seite vor).

### A9. Markierung im Cost-Explorer-Chart

Die Doku bestätigt nur, dass "View in Cost Explorer" zu "a time series graph of the cost impact" führt (getting-started-ad.html). Ob dabei der Anomalie-Zeitraum visuell hervorgehoben/markiert wird (z. B. als schattierter Bereich), ist **in der abgerufenen Doku nicht beschrieben** — dazu konnte ich keine Aussage verifizieren.

---

## B) AWS BUDGETS

### B1. Budget-Typen

Wörtlich, sechs Typen:

> "**Cost budgets**: Set spending limits [...] **Usage budgets**: Establish usage limits [...] **RI utilization budgets**: [...] **RI coverage budgets**: [...] **Savings Plans utilization budgets**: [...] **Savings Plans coverage budgets**: [...]"
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html

Beim Custom-Setup gruppiert in vier Hauptkategorien, wörtlich:

> "You can choose between four main budget types that track against the following: Cost [...] Usage [...] Savings Plans (Savings Plans utilization / Savings Plans coverage) [...] Reservation (Reservation utilization / Reservation coverage)"
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/custom-budgets.html

### B2. Alarm-Schwellen

Wörtlich, aus dem Erstellungs-Workflow eines Cost-Budgets:

> "Choose Add an alert threshold.
> Under Set alert threshold, for Threshold, enter the amount that must be reached for you to be notified. This can be either an absolute value or a percentage. [...]
> Next to the amount, choose Absolute value to be notified when your costs exceed the threshold amount. Or, choose % of budgeted amount to be notified when your costs exceed the threshold percentage.
> Next to the threshold, choose Actual to create an alert for actual spend. Or, choose Forecasted to create an alert for forecasted spend."
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/create-cost-budget.html

Also je Threshold zwei unabhängige Achsen: **Wertform** (Absolute value / % of budgeted amount) **×** **Trigger-Typ** (Actual / Forecasted). Eine explizite Maximalzahl an Alarm-Thresholds pro Budget (analog zum "max. 2 Thresholds, AND/OR" bei Cost Anomaly Detection) habe ich in den abgerufenen Budgets-Seiten **nicht gefunden** — das ist ein Unterschied zur klar dokumentierten CAD-Obergrenze und sollte nicht verwechselt werden. Bestätigt ist nur: "A notification can be sent to a maximum of 10 email addresses" pro Threshold/Alert (create-cost-budget.html) und "Budget alerts can be sent to up to 10 email addresses and one Amazon SNS topic per alert." (budgets-best-practices.html).

### B3. "Forecasted to exceed"-Semantik

Wörtlich:

> "You can set up optional notifications that warn you if you exceed, or are forecasted to exceed, your budgeted amount for cost or usage budgets."
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html

Mindesthistorie — genau das gesuchte Zitat, wörtlich bestätigt:

> "AWS requires approximately 5 weeks of usage data to generate budget forecasts. If you set a budget to alert based on a forecasted amount, this budget alert isn't triggered until you have enough historical usage information."
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html

Unterschied im Auslöseverhalten Actual vs. Forecasted, wörtlich:

> "Actual alerts are only sent out once per budget, per budget period, when a budget first reached the actual alert threshold. Forecast-based budget alerts are sent out on a per-budget, per-budget period basis. They might alert more than once in a budgeted period if the forecasted values exceed, dip below, and then exceed the alert threshold again during the budgeted period."
Quelle: ebd.

Zusätzliche Präzisierung, wie das "Forecast" datentechnisch entsteht, geht aus der Doku **nicht** über "usage data" hinaus — kein konkretes Prognosemodell (z. B. lineare Regression) wird benannt.

### B4. Darstellung im UI

Wörtlich zur Übersichtstabelle:

> "Your budgets are listed in a filterable table along with the following data: Your current costs and usage incurred [...]; Your budgeted costs or usage [...]; Your forecasted usage or costs [...]; A percentage that shows your costs or usage compared to your budgeted amount; A percentage that shows your forecasted costs or usage compared to your budgeted amount; [...] billing view [...] health status"
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-view.html

Wörtlich zur Detailseite:

> "This page includes the following information: **Current vs. budgeted** – Your current incurred costs compared to your budgeted costs. **Forecasted vs. budgeted** – Your forecasted costs compared to your budgeted costs. **Alerts** – Any alerts or notifications about the state of your budgets. **Details** – The amount, type, time period, and any other additional parameters for your budget. **Budget history** tab – A chart and table that show the history of your budget. QUARTERLY budgets show the last four quarters of history, and MONTHLY budgets show the last 12 months."
Quelle: ebd.

Zusätzlich beim Erstellen: "When you create a budget, AWS Budgets provides a Cost Explorer graph to help you see your incurred costs and usage." — https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create.html

**Unbestätigt/nicht in Doku beschrieben:** ob im "Budget history"-Chart oder im Cost-Explorer-Graph explizit eine eingezeichnete "Budget-Linie" (horizontale Schwelle) dargestellt wird — das ist eine reine Fortschrittsbalken-/Prozent-Beschreibung aus der Doku ("Current vs. budgeted", "Forecasted vs. budgeted" als Prozentwerte), keine bestätigte Chart-Bildbeschreibung.

### B5. Budget Reports & Budget Actions

**Budget Actions**, wörtlich:

> "You can use AWS Budgets to run an action on your behalf when a budget exceeds a certain cost or usage threshold. [...] Your available actions include applying an IAM policy or a service control policy (SCP). They also include targeting specific Amazon EC2 or Amazon RDS instances in your account. [...] You can also configure multiple actions to initiate at the same notification threshold."
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-controls.html

Ausführung automatisch oder nach manueller Freigabe ("configure a budget action to run either automatically or after your manual approval", ebd.). Managed Policies für User und für den Budgets-Service selbst: https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html

**Budget Reports**: Ich konnte **keine eigene How-to-Seite** dafür lokalisieren (mehrere geratene URLs — budgets-reports.html, budgets-create-report.html — lieferten leere/404-Ergebnisse, und die Themenliste unter budgets-managing-costs.html führt keine "Budget Reports"-Unterseite auf). Belegt sind nur die Limits, wörtlich:

> "Maximum number of budget reports: 50 | Maximum number of budgets per budget report: 50 | Maximum email recipients in a budget report: 50"
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/management-limits.html

sowie ein funktionaler Hinweis aus der Viewing-Seite: "This opens a split-view panel on the right-hand side, where you can sort or filter the alerts to customize a budget report." — https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-view.html

### B6. Auswertungshäufigkeit

Zwei Doku-Stellen mit leicht unterschiedlicher Formulierung — beide wörtlich zitiert, damit der Unterschied sichtbar bleibt:

> "AWS Budgets information is updated up to three times a day. Updates typically occur 8–12 hours after the previous update."
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html

> "AWS billing data, which Budgets uses to monitor resources, is updated at least once per day. Keep in mind that budget information and associated alerts are updated and sent according to this data refresh cadence."
Quelle: https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html

Hinweis: Die beiden Aussagen ("bis zu dreimal täglich" vs. "mindestens einmal täglich") widersprechen sich nicht zwangsläufig (drei Updates sind ≥ ein Update), sind aber unterschiedlich präzise formuliert — ich gebe beide wörtlich wieder, statt sie zu einer Zahl zu verdichten.

Ergänzend, allgemeiner Verzögerungshinweis: "There can be a delay between when you incur a charge and when you receive a notification from AWS Budgets for the charge." — https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html

---

## Zusammenfassungszeilen

| Produkt | Kopfkacheln | Hauptdiagramm | Gruppierungsachsen | Prognose-/Anomalie-Darstellung | Quelle |
|---|---|---|---|---|---|
| **Cost Anomaly Detection** | Keine klassischen KPI-Kacheln laut Doku — Tabellen-/Detailfelder: Cost impact, Impact %, Expected spend, Actual spend, Severity, Assessment | Kein eigenständiges Chart auf der Anomaly-Details-Seite dokumentiert; Link "View in Cost Explorer" führt zu Zeitreihen-Diagramm des Cost Impact (Markierung des Anomalie-Zeitraums unbestätigt) | AWS service, Linked account, Region, Usage type (Root-Cause-Dimensionen); Monitor-Dimensionen zusätzlich Cost category, Cost allocation tag | Expected spend (ML-Prognose aus Historie) vs. Actual spend; Cost impact = Actual − Expected; Impact % = Cost impact / Expected × 100; Severity + Assessment-Feedback | docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html |
| **AWS Budgets** | Detailseiten-Abschnitte "Current vs. budgeted" / "Forecasted vs. budgeted" / "Alerts" / "Details" (keine klassischen KPI-Kacheln laut Doku); Overview-Tabelle mit % vs. Budget und % Forecast vs. Budget | Cost-Explorer-Graph im Erstellungs-Wizard; "Budget history"-Chart+Tabelle auf der Detailseite (Quartals-/Monatshistorie); Budget-Linie im Chart nicht dokumentiert/unbestätigt | Budget-Scope-Filter je Typ: Service, Linked Account, Region, Usage Type, Cost Category, Tag u. a. | "Forecasted vs. budgeted" als Prozentwert; Alarmtyp Actual vs. Forecasted je Threshold; Forecast erfordert ca. 5 Wochen Nutzungsdaten | docs.aws.amazon.com/cost-management/latest/userguide/budgets-view.html |

**Es wurden keine Dateien geschrieben** — die gesamte Recherche ist oben als Text zurückgegeben.