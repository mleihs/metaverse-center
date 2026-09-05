# AUFTRAG

Recherchiere sehr gründlich im Web (WebSearch + WebFetch, offizielle Google-Doku cloud.google.com/billing/docs bevorzugt) zu **GCP Cloud Billing Reports**, **GCP Budgets & Alerts** und **GCP Cost Anomaly Detection** (prüfe ob es das überhaupt gibt — GCP hat "Cost anomaly detection" in FinOps Hub / Cloud Billing; recherchiere den aktuellen Stand 2026). Antworte auf DEUTSCH. Belege JEDE Aussage mit einer konkreten URL. Erfinde nichts. Visuelle Eigenschaften nur aus Blogs/Screenshots ausdrücklich kennzeichnen.

Startpunkte (wirklich fetchen):
- https://cloud.google.com/billing/docs/how-to/reports
- https://cloud.google.com/billing/docs/how-to/cost-table
- https://cloud.google.com/billing/docs/how-to/cost-breakdown
- https://cloud.google.com/billing/docs/how-to/budgets
- https://cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications
- https://cloud.google.com/billing/docs/how-to/visualize-spending-trends (falls existent)
- Suche nach "Cloud Billing cost anomaly detection", "FinOps Hub 2.0", "cost forecast Cloud Billing report", "Trend line" / "Forecast" im Billing Report
- https://cloud.google.com/billing/docs/how-to/pricing-table und Doku zu Datenaktualität ("data may be delayed")

Beantworte KONKRET:

A) CLOUD BILLING REPORTS
1. Kopfkacheln/Summenzeilen: welche gibt es genau ("Total cost", "Subtotal", "Promotions and others", "Cost trend"?). Wörtliche Bezeichnungen.
2. Hauptdiagramm: gestapelte Balken? Linie? Flächendiagramm? Standardgranularität (daily/monthly

---

# GCP Cloud Billing: Reports, Budgets & Cost Anomaly Detection — Recherchebericht (2026-09)

**Hinweis zur Doku-Migration:** Google hat die Billing-Doku Anfang 2026 von `cloud.google.com/billing/docs/...` nach `docs.cloud.google.com/billing/docs/...` verschoben (301-Redirect). Alle Links unten funktionieren über beide Domains.

---

## A) CLOUD BILLING REPORTS

### 1. Kopfkacheln/Summenzeilen

Wörtlich aus der Doku:
> "Actual cost-to-date for the current month, including total savings"
> "Total forecasted cost for the entire current month, including forecasted savings"

Zusätzlich zu jeder der beiden Kacheln:
> "a percent change indicator to show you if your overall costs are trending up or down compared to the previous time period"

Quelle: https://cloud.google.com/billing/docs/how-to/reports

Bezeichnungen wie "Total cost", "Subtotal" oder "Promotions and others" als eigene Kopfkachel-Label konnte ich auf der Reports-Seite **nicht** wörtlich verifizieren — diese Begriffe tauchen stattdessen im *Cost Table*- bzw. *Cost Breakdown*-Report als Zeilen-/Spaltenbezeichnungen auf (siehe A.8).

### 2. Hauptdiagramm

- Standard: **gestapeltes Balkendiagramm** — "each bar plots costs over time"
- Alternative: **Liniendiagramm** ("to visualize cost spikes")
- Standardgranularität: "the current calendar month's daily cost for all services and SKUs, grouped by Service"
- Zeitachse-Optionen: **Charge period** (Nutzungsdatum, verfügbar zurück bis Januar 2017) vs. **Billing period** (Rechnungsmonat, zurück bis Mai 2019). Ein Tag beginnt "at midnight US and Canadian Pacific Time (UTC-8)".

Quelle: https://cloud.google.com/billing/docs/how-to/reports

### 3. Prognose (Forecast)

Ja, vorhanden, direkt im Hauptdiagramm des Reports:
> "The report chart includes forecasted costs if the date range ends on a future date."
> "The chart also includes forecasted costs, indicated in the chart in light gray."

→ Visuell also **keine gestrichelte Linie**, sondern ein **hellgrau eingefärbter Bereich/Balkenabschnitt** am Ende der Zeitreihe. Ein Konfidenzintervall wird in dieser Beschreibung nicht erwähnt.

Zusätzlich gibt es seit 2026 eine separate, ML-gestützte Prognosefunktion ("AI-Driven Cost Forecasts", GA):
> "The cost forecasting feature uses advanced machine learning models to analyze historical spending trends, detect seasonality and recurring cycles, regularize data anomalies, and predict your future spend up to 12 months in advance."

Quelle: https://cloud.google.com/billing/docs/how-to/ai-powered-features

Auf der Budget-Seite gibt es zusätzlich den Alarm-Typ "Forecasted" (siehe B.3) — das ist konzeptionell verwandt, aber ein eigener Mechanismus (Alarmschwelle statt Diagrammdarstellung).

### 4. Gruppierungsachsen ("Group by")

Verfügbare Dimensionen laut Doku: Subaccount, Project, Project Hierarchy, Product, Service, SKU, Application, Location (Region/Multi-Region), sowie Datums-/Monats-basierte Kombinationen.

Filter zusätzlich nach: Subaccounts, Folders & Organizations, Products, Services, Projects, SKUs, Applications, Locations, Labels, Savings, Invoice-level charges.

Quelle: https://cloud.google.com/billing/docs/how-to/reports

(Zur genauen Obergrenze gleichzeitiger Group-by-Dimensionen im Hauptreport konnte ich keine explizite Zahl in der Doku finden — im *Cost Table*-Report ist die Custom-Gruppierung explizit auf **bis zu 3 Dimensionen** begrenzt, siehe A.8.)

### 5. Kostenarten: List Price vs. Effective Cost

Aus dem Cost-Table-Report (dort am präzisesten dokumentiert):
- **"Usage"** — "Usage represents the cost of the row's Google Cloud usage"
- **"Unrounded cost"** (bis 6 Dezimalstellen) vs. **"Cost"** (auf 2 Dezimalstellen gerundet)
- **"List cost"** (bei Custom Pricing/Vertragspreisen)
- Credit-/Rabatt-Zeilen: "PROMOTION" (spend-based milestone credits, Google Cloud Free Trial, Marketing Credits), "FREE_TIER", "COMMITTED_USAGE_DISCOUNT", "FEE_UTILIZATION_OFFSET", "SUSTAINED_USAGE_DISCOUNT"

Quelle: https://cloud.google.com/billing/docs/how-to/cost-table

### 6. Datenaktualität/Latenz

Ich konnte trotz gezielter Suche in Reports-, Concepts-, BigQuery-Export- und Pricing-Table-Doku **keine wörtliche Aussage** in der Form "costs may take up to X hours to appear" finden. Was ich stattdessen belegt fand:

- Zum BigQuery-Export (nicht zum UI-Report selbst): "For the initial backfill of exported data, it might take up to five days for your retroactive Cloud Billing data to finish exporting." — https://cloud.google.com/billing/docs/how-to/export-data-bigquery
- Zu Labels: "Newly created labels can take up to a day to appear in Cloud Billing." — https://cloud.google.com/billing/docs/concepts
- Zum Pricing-Table-Report: "List prices displayed in the table are current as of the date you're viewing the report" — https://cloud.google.com/billing/docs/how-to/pricing-table

**Fazit A.6:** Eine explizite, im UI angezeigte Latenz-Kennzahl für den Reports-Chart selbst ist in der öffentlichen Doku nicht dokumentiert (jedenfalls nicht in den geprüften Seiten). Ich präsentiere das hier bewusst als offenen Punkt statt eine Zahl zu erfinden.

### 7. Export/CSV, Zeitraum-Presets, Periodenvergleich

- CSV-Export vorhanden, Spalten richten sich nach der gewählten Gruppierung.
- Vordefinierte Reports (wörtlich genannt): "Services — this month" (Standard), "Projects — this month", "SKUs — this month", "Services — daily costs L7D", plus rechnungsbasierte Varianten. Zusätzlich genannt: "Current month", "Last seven days" (L7D), "Most recent invoice month".
- Periodenvergleich: siehe A.3 — Prozent-Änderungsindikator gegenüber der Vorperiode.

Quelle: https://cloud.google.com/billing/docs/how-to/reports

### 8. Cost Breakdown Report vs. Cost Table Report

**Cost Table Report** (https://cloud.google.com/billing/docs/how-to/cost-table): "detailed tabular view of your costs for a given invoice or statement (by Invoice month)" — "project-level cost details from your invoices and statements, including your tax costs broken out by project". Spalten u.a.: Billing account, Project (Name/ID/Nummer/Hierarchy seit Jan. 2022), Service, SKU, Consumption model (seit Juli 2025), Credit type/name/ID (seit Juli 2020), Usage amount/unit, Start/End Date, Unrounded cost, Cost, List cost, Seller name/Transaction type (Split Invoices, seit Nov. 2024). Export: CSV, begrenzt auf "4 million rows" / "150 MB".

**Cost Breakdown Report** (https://cloud.google.com/billing/docs/how-to/cost-breakdown): zeigt "your base usage cost (calculated from on-demand prices) and how discounts, credits, adjustments, and taxes affect this cost to arrive at your total." Darstellung als **Wasserfall-Diagramm** (Gebühren orange, Gutschriften grün, Zwischen-/Gesamtsummen blau) — Struktur: Gross-Kosten → Savings/Credits (Negotiated Savings, Spend-based/Resource-based CUD, Free Tier, Promotional Credits, Sustained Use Discounts) → Invoice-Level-Posten (Adjustments, Tax bei Billing-Period-Ansicht) → Gesamtbetrag.

---

## B) BUDGETS & ALERTS

### 1. Budget-Typen und Umfang

Zwei Konfigurationen:
- **Alerts-only budgets** — reine Überwachung
- **Spend cap budgets (Preview)** — pausiert Dienste automatisch bei Überschreitung

Betragsarten: **"Specified amount"** (fester Betrag) und **"Last period's spend"** — "lets you set a dynamic amount that updates each budget calendar period based on the last calendar period's spend".

Scope: gesamtes Billing-Konto, Organisationen/Ordner/Projekte, einzelne Services, Ressourcen nach Label, Subaccounts, Savings-Typen (Discounts/Credits).

Quelle: https://cloud.google.com/billing/docs/how-to/budgets

### 2. Alarm-Schwellen, Actual vs. Forecasted (wörtlich)

> "Default alert threshold rules are provided. When you first create a budget, the default alert thresholds are set at 50%, 90%, and 100% of the budget amount, calculated against Actual spend."

Trigger-Option im UI wörtlich:
> "Under Trigger on, select either Actual or Forecasted spend."

### 3. Berechnung von "Forecasted spend" (wörtlich)

> "Forecasted cost threshold rules send notifications when the forecasted cost (calculated out to the end of the current calendar budget period) exceeds the threshold amount."
> "Thresholds can be set for actual costs accrued during the budget period, or for forecasted costs (estimated costs calculated out to the end of the current calendar budget period)."

Quelle: https://cloud.google.com/billing/docs/how-to/budgets

### 4. Visuelle Darstellung im UI

- **Cost trend chart**: "bar-chart view of your costs for the past 12 months"
- **Progress bar / "Spend and budget amount"**: "A visual gauge of how the actual spend is tracking against the budget's targeted amount"
- Bei monatlichen Budgets wird der Zielbetrag als "red, dashed, horizontal line" im Diagramm markiert

Quelle: https://cloud.google.com/billing/docs/how-to/budgets

### 5. Pub/Sub-Benachrichtigungen — Feldnamen

Attribute (Pub/Sub-Metadaten): `billingAccountId`, `budgetId`, `schemaVersion`.

JSON-Datenfelder (Base64-kodiert in `data`): `budgetDisplayName`, `costAmount`, `costIntervalStart`, `budgetAmount`, `budgetAmountType` (Werte: `SPECIFIED_AMOUNT`, `LAST_MONTH_COST`, `LAST_PERIODS_COST`), `alertThresholdExceeded`, `forecastThresholdExceeded`, `currencyCode`.

Zustellung: "Budget-Benachrichtigungen werden mehrmals täglich mit aktuellem Status gesendet" — Pub/Sub garantiert mindestens einmalige Zustellung (Duplikate möglich).

Quelle: https://cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications

---

## C) COST ANOMALY DETECTION

**Ja, es gibt das** — als eigenständiges **"Cost anomalies dashboard"** innerhalb von Cloud Billing (nicht im FinOps Hub verortet), Menüpfad: Billing → Cost management → Anomalies.

### 1. Status

- Standard-Anomalie-Erkennung: **GA** ("Cloud Billing uses an AI-powered algorithm to detect cost anomalies in your projects.")
- **"Early Anomalies"** (Frühwarnungen mit kürzerer Latenz, separater Tab "By service (Early signals)"): **Preview**

Quellen: https://cloud.google.com/billing/docs/how-to/manage-anomalies, https://cloud.google.com/billing/docs/how-to/ai-powered-features

### 2. Definition und Verfahren

Wörtlich:
> "Anomalies are spikes or deviations in usage costs that differ from your expected spend, when compared to historical spending patterns."

Zur Berechnungsgrundlage:
> "Usage costs are calculated using the on-demand rates that are applicable to your billing account" — Legacy-CUD-Credits, Resource-based-CUD-Credits und Sustained-Use-Discounts sind dabei ausgeschlossen.

Zum Verfahren selbst nennt die Doku kein explizites ML-vs-statistisch-Detail, nur: "AI-powered anomaly detection algorithm" das "learns and improves" — u.a. über Nutzer-Feedback (Kategorisierung als "unexpected cost increase" / "expected cost increase" / "insignificant impact", nur für Standard-Anomalien).

### 3. Darstellung, Schwellwerte, Benachrichtigung

- **UI:** Standard-Anomalien als tabellarische Liste (Datum, anklickbar für Root-Cause-Analyse); Early Anomalies in separatem Tab mit Service-Detailauflösung.
- **Schwellwerte:** automatisch anhand von Nutzungsmustern konfiguriert, anpassbar über "Cost Impact" (Währungsbetrag) und "Deviation Percentage" (z. B. 20 %); Early-Anomalies-Schwellen sind systemseitig fix, nicht konfigurierbar.
- **Benachrichtigungen:** E-Mail (Billing Admins, Essential Contacts, Project Owners — einzeln oder als Tageszusammenfassung) sowie **Pub/Sub** (derselbe programmatische Kanal wie bei Budgets, siehe B.5). Für Early Alerts wird eine Latenz von 20–40 Minuten genannt.
- **IAM:** Auf Billing-Account-Ebene z. B. Billing Account Costs Manager / Administrator / Viewer; projekt-scoped mindestens `resourcemanager.projects.get`, `billing.anomalies.get`, `billing.anomalies.list`; für Pub/Sub zusätzlich Pub/Sub Admin bzw. Custom Role mit `pubsub.topics.setIamPolicy`.

Quelle: https://cloud.google.com/billing/docs/how-to/manage-anomalies

### Fazit C

Cost Anomaly Detection existiert als eigenes, benanntes GA-Feature ("Cost anomalies dashboard") direkt in Cloud Billing — kein reines FinOps-Hub-Feature, aber Teil derselben "AI-powered cost monitoring"-Familie wie AI Cost Summary Agent und AI-Driven Cost Forecasts. Für Fälle, in denen das eingebaute Dashboard nicht ausreicht, bleiben als Alternativen: Recommender (im FinOps Hub, >20 Recommender für Idle Resources/Right-Sizing/CUD), BigQuery-Export-basierte Eigenbau-Analysen, und klassische Budget-Alerts (Actual/Forecasted-Schwellen, siehe B).

---

## Zusammenfassung (Tabellenzeilen)

| Produkt | Kopfkacheln | Hauptdiagramm | Gruppierungsachsen | Prognose-/Anomalie-Darstellung | Quelle-URL |
|---|---|---|---|---|---|
| Cloud Billing Reports | "Actual cost-to-date …", "Total forecasted cost …", je mit %-Trendindikator ggü. Vorperiode | Gestapeltes Balkendiagramm (Alt.: Liniendiagramm), Standard = tägliche Kosten, Group by Service | Subaccount, Project, Project Hierarchy, Product, Service, SKU, Application, Location, Datum/Monat | Forecast als hellgrauer Bereich im selben Chart, wenn Zeitraum in die Zukunft reicht ("light gray") | https://cloud.google.com/billing/docs/how-to/reports |
| Cloud Billing Budgets | Kein Kachel-Layout wie Reports; stattdessen Spend/Budget-Fortschrittsbalken + 12-Monats-Balkendiagramm | Balkendiagramm ("cost trend chart") + Zielwert als rote gestrichelte Linie | Billing-Konto, Org/Ordner/Projekt, Service, Label, Subaccount, Savings-Typ | Alarm-Trigger "Actual" vs. "Forecasted" (bis Periodenende hochgerechnet), Default-Schwellen 50/90/100 % | https://cloud.google.com/billing/docs/how-to/budgets |
| Cost anomalies dashboard | Keine Kacheln; tabellarische Anomalie-Liste (+ separater "Early signals"-Tab je Service) | Kein Trend-Chart, sondern Ereignisliste mit anklickbarer Root-Cause-Analyse | Projekt-/Service-gebunden innerhalb des verknüpften Billing-Konto | KI-gestützte Abweichungserkennung vs. historisches Muster, Schwellen nach Cost-Impact/Deviation-%, E-Mail + Pub/Sub-Alarm | https://cloud.google.com/billing/docs/how-to/manage-anomalies |

**Alle im Text zitierten Quell-URLs (Zusammenfassung):**
- https://cloud.google.com/billing/docs/how-to/reports
- https://cloud.google.com/billing/docs/how-to/cost-table
- https://cloud.google.com/billing/docs/how-to/cost-breakdown
- https://cloud.google.com/billing/docs/how-to/pricing-table
- https://cloud.google.com/billing/docs/how-to/budgets
- https://cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications
- https://cloud.google.com/billing/docs/how-to/manage-anomalies
- https://cloud.google.com/billing/docs/how-to/ai-powered-features
- https://cloud.google.com/billing/docs/how-to/finops-hub
- https://cloud.google.com/billing/docs/concepts
- https://cloud.google.com/billing/docs/how-to/export-data-bigquery

**Offen gebliebene Punkte (nicht erfunden, sondern klar als Lücke markiert):**
- Keine dedizierte Seite `visualize-spending-trends` gefunden (404) — die relevanten Inhalte (Trend/Vergleich zur Vorperiode) liegen stattdessen auf der Reports-Seite selbst.
- Keine wörtliche UI-Latenz-Angabe ("Kosten erscheinen mit X Stunden Verzögerung") für den Reports-Chart gefunden, trotz gezielter Suche in mehreren Kandidatenseiten.
- Konfidenzintervall/-band für die Forecast-Darstellung im Reports-Chart wird in der Doku nicht erwähnt — nur die Farbe (hellgrau).