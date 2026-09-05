# AUFTRAG

Research the INTERFACE DESIGN of Vercel's Usage and Observability dashboards. I care about visual/interaction design and information density, NOT the pricing subject matter.

Use WebSearch and WebFetch. Start with these URLs and follow links:
- https://vercel.com/docs/observability
- https://vercel.com/docs/observability/usage
- https://vercel.com/docs/pricing (or /docs/plans) — how included vs on-demand usage is presented
- https://vercel.com/docs/observability/monitoring
- https://vercel.com/docs/analytics and /docs/speed-insights
- Vercel changelog posts about usage dashboard redesigns (vercel.com/changelog)

Answer these SPECIFIC questions, each backed by a URL. If the docs don't say, write "nicht belegt" — do NOT guess or infer from general knowledge:
1. Header/summary tiles ("Kopfkacheln"): which metrics are shown as summary cards? Do they have sparklines? Do they show a delta vs previous period (arrow / percent / color)?
2. Main chart: type (bar/line/area), granularity (hourly/daily), stacked vs grouped?
3. Tables: which columns, sortable? Are there inline bars inside table cells (bar-in-table)?
4. Interactions: hover tooltip content (single value or all series?), time-range presets, comparison to previous period (ghost line? second series? dashed?), drill-down, legend click to isolate a series?
5. How are INCOMPLETE / in-progress periods shown (today's not-yet-finished day)? Lighter bar, dashed, hidden?
6. Projection/forecast ("estimated cost at end of month") — does 

---

# Recherche: Vercel Usage & Observability Dashboards — Interface-Design

Vorbemerkung zur Methode: Die Vercel-Doku liefert überwiegend **Fließtext-Beschreibungen** von Dashboard-Verhalten, kaum **beschreibende Alt-Texte** zu Screenshots (die meisten Bilder sind im Markdown nur als `![Image](url)` eingebunden, ohne Caption). Nur ein Bild hatte eine echte Caption. Ich habe daher NICHT aus Dateinamen wie `error-rate-light.png` auf den Bildinhalt geschlossen — das wäre Raten. Was folgt, ist ausschließlich aus lesbarem Text belegt.

---

## 1. Header/Summary-Kacheln

- **Kein Beleg für Sparklines** in den Summary-Bereichen.
- **Kein Beleg für Delta-Anzeigen** (Pfeil/Prozent/Farbe ggü. Vorperiode) an Kopfkacheln.
- Was belegt ist: eine **„allotment indicator"**-Komponente auf der Usage-Übersicht: *"In the overview, you'll see an allotment indicator. It shows how much of your usage you've consumed in the current cycle and the projected cost for each item."* — Evidenzqualität: **(a) Doku-Prosa**. Ob das visuell ein Balken, ein Ring oder reiner Text ist, sagt der Text nicht.
- Quelle: https://vercel.com/docs/pricing/manage-and-optimize-usage

**Fazit Q1: nicht belegt** (Sparklines, Delta-Indikatoren an Kacheln) — nur die Existenz einer Verbrauchs-+Prognose-Kachel ist belegt.

---

## 2. Haupt-Chart (Typ, Granularität, stacked/grouped)

- **Monitoring/Query-Charts**: *"Charts allow you to explore your query results in detail. Use filters to adjust the date, data granularity, and chart type (line or bar)."* → explizit wählbar zwischen **Linie und Balken**, Granularität ist ein Filter. (a) Doku-Prosa.
  Quelle: https://vercel.com/docs/query/monitoring
- **Speed Insights**: Haupt-Chart ist ein *"Time-based line graph"*, standardmäßig P75-Perzentil, umschaltbar auf P90/P95/P99 als zusätzliche Linien in derselben Ansicht. (a)
  Quelle: https://vercel.com/docs/speed-insights
- **Usage-Dashboard**: Für Zähl-Metriken gibt es Umschalt-„Viewing Options": **Count, Project, Region, Ratio, Average**. Bei „Ratio" werden explizit Kategorien wie *"Successful vs errored vs timed out invocations"* genannt — das deutet auf gestapelte Darstellung hin, aber der Text sagt nicht ausdrücklich „stacked bar chart". (a), mit Einschränkung.
  Quelle: https://vercel.com/docs/pricing/manage-and-optimize-usage
- **Zoom-Interaktion**: *"Click and drag to select a period of time and press the Zoom In button."* (Observability-Charts). (a)
  Quelle: https://vercel.com/docs/observability

**Fazit Q2:** Linie **und** Balken sind als wählbare Chart-Typen belegt (Monitoring); Granularität ist Filter-gesteuert; „stacked vs. grouped" ist nur indirekt über die Ratio-Kategorien angedeutet, nicht explizit als Visualisierungsstil benannt — **teilweise nicht belegt**.

---

## 3. Tabellen

- **Routen-/Funktionsliste**: *"from the list of routes below, choose to reorder either based on the error rate or the duration"* → **sortierbare Spalten** (Error Rate, Duration) belegt. (a)
  Quelle: https://vercel.com/docs/observability
- **Web-Analytics-Panels**: *"By default, panels provide you with a list of top entries, categorized by the number of visitors. Depending on the panel, the information is displayed either as a number or percentage of the total visitors."* Plus CSV-Export bis 250 Zeilen. (a)
  Quelle: https://vercel.com/docs/analytics
- **Inline-Bars in Zellen (bar-in-table)**: **nicht belegt.** Der Text sagt „als Zahl oder Prozent" — keine Aussage zu einem visuellen Balken in der Zelle.
- **Speed-Insights „Kanban board"**: eigene Ansicht (kein Tabellen-Grid im klassischen Sinn) für Routen/Pfade/HTML-Elemente, die Verbesserung brauchen; Zeilen mit <0,5% Anteil standardmäßig ausgeblendet. (a)
  Quelle: https://vercel.com/docs/observability (Speed Insights Dashboard-Abschnitt: https://vercel.com/docs/speed-insights)

**Fazit Q3:** Spalten und Sortierbarkeit belegt; Inline-Balken in Zellen **nicht belegt**.

---

## 4. Interaktionen

- **Hover-Tooltip**: *"Hover and move your mouse across the chart to view your data at a specific point in time. For example, if the data granularity is set to 1 hour, each point in time will provide a one-hour summary."* — Ob der Tooltip einen einzelnen Wert oder alle Serien gleichzeitig zeigt: **nicht belegt** (Text ist unspezifisch).
  Quelle: https://vercel.com/docs/query/monitoring
- **Time-Range-Presets**: Speed Insights hat ein Dropdown mit *"predefined timeframe"* plus Kalender-Icon für custom Zeitraum. (a)
  Quelle: https://vercel.com/docs/speed-insights
- **Vergleich zur Vorperiode** (Ghost-Line/gestrichelt/zweite Serie): **nicht belegt** — in keiner der gelesenen Seiten erwähnt.
- **Drill-down**: mehrfach belegt — Funktionen: Klick auf Route → Function-Detailview mit Latenz/Pfaden/External APIs (https://vercel.com/docs/observability); AI Gateway: *"drill into per-project and per-model usage"*; Queues: *"drill down into individual queues to see detailed charts and consumer-level breakdowns"*; Blob: *"drill into activity by user agent, edge region, and client IP"` (alle: https://vercel.com/docs/observability/insights).
- **Legend-Click zum Isolieren einer Serie**: **nicht belegt.**

**Fazit Q4:** Presets und Drill-down klar belegt; Tooltip-Inhalt, Vorperiodenvergleich und Legend-Isolation **nicht belegt**.

---

## 5. Unvollständige/laufende Zeiträume (heutiger, noch nicht abgeschlossener Tag)

**Nicht belegt.** Keine der gelesenen Seiten (Observability, Monitoring, Usage, Speed Insights, Web Analytics) erwähnt eine visuelle Sonderbehandlung (hellerer Balken, gestrichelt, ausgeblendet) für den laufenden/unvollständigen Zeitraum.

---

## 6. Projektion/Forecast ("geschätzte Kosten am Monatsende")

**Ja, explizit belegt** über die „allotment indicator"-Komponente:
> *"It shows how much of your usage you've consumed in the current cycle **and the projected cost for each item**."*

Evidenzqualität: **(a) Doku-Prosa.** Wie die Prognose visuell dargestellt wird (Zahl, Balkenende, Bereich), ist nicht beschrieben.
Quelle: https://vercel.com/docs/pricing/manage-and-optimize-usage

---

## 7. „Keine Daten" vs. „Wert ist Null"

**Größtenteils nicht belegt.** Einziger nahestehender Beleg: bei einer **ungültigen Query** im Monitoring heißt es *"In such cases, no data appears."* — das behandelt aber einen fehlerhaften Query-Fall, nicht die reguläre Unterscheidung zwischen einem echten Null-Wert und einem Zeitfenster ohne Ereignisse in einem normalen Chart.
Quelle: https://vercel.com/docs/query/monitoring

---

## 8. Kontingent-/Included-Allotment-Anzeige

- **Belegt**: Es existiert eine **„allotment indicator"**-Komponente in der Usage-Übersicht, die (a) verbrauchte Menge im aktuellen Zyklus und (b) die projizierten Kosten pro Posten zeigt.
  Quelle: https://vercel.com/docs/pricing/manage-and-optimize-usage
- **Pro-Plan-Kreditmodell** (kontextrelevant, nicht direkt UI): $20 monatliches Nutzungsguthaben; nach Verbrauch der Included-Kontingente (z. B. 1 TB Fast Data Transfer, 10 Mio. Edge Requests) wird zunächst gegen das Guthaben abgerechnet, danach on-demand. Benachrichtigung bei 75% des Guthabens; danach *"Vercel switches your team to on-demand usage and you will receive daily and weekly summary emails."*
  Quelle: https://vercel.com/docs/plans/pro-plan
- **Spend Management**: separate Schwellenwert-Logik bei 50/75/100% eines frei gesetzten USD-Spend-Betrags (nicht dasselbe wie das Included-Kontingent), mit Web/E-Mail/SMS-Benachrichtigung und optionalem Auto-Pause der Production-Deployments.
  Quelle: https://vercel.com/docs/spend-management
- **Explizite Aussage „Fortschrittsbalken"**: **nicht belegt** — der Begriff „allotment indicator" impliziert typografisch/visuell etwas wie eine Fortschrittsanzeige, aber die Doku beschreibt es nicht als Balken oder Ring, sondern nur funktional.
- **Overage/On-Demand-Darstellung**: Es ist textlich belegt, DASS es nach Überschreiten des Kontingents zu On-Demand-Abrechnung kommt und dass man dazu Mails/Web-Notifications bekommt — aber **nicht belegt**, WIE das visuell im Chart/der Kachel von „included" abgesetzt wird (z. B. andere Farbe, gestrichelte Linie ab Schwellenwert).

---

## Screenshot-Lage (Ehrlichkeit zur Evidenzqualität)

Folgende Screenshots werden in der Doku referenziert, aber ohne beschreibenden Alt-Text (nur `![Image](...)`), sodass ich ihren Bildinhalt **nicht** beschreiben kann, ohne zu raten:
- `O11y-Tab-Light.png`, `error-rate-light.png` (https://vercel.com/docs/observability)
- `visitor-chart-light.png`, `panels-light-mode.png` (https://vercel.com/docs/analytics)
- `res-chart-light.png`, `country-map-light.png` (https://vercel.com/docs/speed-insights)
- `spend-manage-light.png` (https://vercel.com/docs/spend-management)

Einzige Ausnahme mit echter Caption:
> *"An example of a Real Experience Score over time."* — zu `res-light.png`, Evidenzqualität **(b) Doku-Screenshot mit Caption**, aber die Caption selbst beschreibt keine Interaktionsdetails.
Quelle: https://vercel.com/docs/speed-insights/metrics

**Wichtiger Hinweis zur Suchbudget-Grenze:** Die WebSearch-Funktion war in dieser Session bereits ausgeschöpft ("200 of 200 WebSearch calls"), sodass ich keine gezielte Suche nach Changelog-Posts zu "Usage Dashboard Redesign" mehr durchführen konnte. Ich habe stattdessen versucht, relevante Changelog-Einträge direkt per URL zu erraten/über Related-Links zu erreichen (z. B. `one-click-linking-from-usage-to-vercel-observability-dashboards`, `anomaly-alert-configuration-now-available`, `improved-speed-insights-experience`) — diese enthielten aber laut Fetch-Ergebnis keine detaillierten UI-Beschreibungen. Es lohnt sich, mit frischem Suchbudget gezielt nach "Vercel usage dashboard redesign changelog screenshot" zu suchen, falls visuelle Details (Fortschrittsbalken-Form, Farbverlauf bei Overage, Ghost-Line für Vorperiode) noch gebraucht werden.

---

## Zusammenfassende Belegtabelle

| Frage | Ergebnis | Qualität |
|---|---|---|
| 1. Kopfkacheln/Sparklines/Delta | Nur "allotment indicator" (Verbrauch + Prognose) belegt; Sparklines/Delta nicht belegt | (a) |
| 2. Haupt-Chart-Typ | Linie/Balken wählbar (Monitoring); Granularität als Filter; stacked/grouped nur angedeutet | (a) |
| 3. Tabellen | Sortierbare Spalten (Error Rate, Duration) belegt; Inline-Bars nicht belegt | (a) |
| 4. Interaktionen | Presets + Drill-down belegt; Tooltip-Inhalt, Vorperiodenvergleich, Legend-Isolation nicht belegt | (a) |
| 5. Unvollständige Zeiträume | nicht belegt | (d) |
| 6. Projektion/Forecast | Ja — "projected cost for each item" | (a) |
| 7. No-data vs. Zero | nicht belegt (nur Sonderfall ungültige Query) | (a)/(d) |
| 8. Kontingent-Anzeige | "Allotment indicator" + Kreditmodell + Spend-Management-Schwellen belegt; visuelle Form (Balken?) nicht belegt | (a) |

**Alle Quellen-URLs im Volltext:**
- https://vercel.com/docs/observability
- https://vercel.com/docs/observability/insights
- https://vercel.com/docs/observability/observability-plus
- https://vercel.com/docs/query/monitoring
- https://vercel.com/docs/pricing
- https://vercel.com/docs/pricing/manage-and-optimize-usage
- https://vercel.com/docs/manage-and-optimize-observability
- https://vercel.com/docs/plans/pro-plan
- https://vercel.com/docs/limits
- https://vercel.com/docs/spend-management
- https://vercel.com/docs/notifications
- https://vercel.com/docs/analytics
- https://vercel.com/docs/speed-insights
- https://vercel.com/docs/speed-insights/metrics
- https://vercel.com/changelog/one-click-linking-from-usage-to-vercel-observability-dashboards
- https://vercel.com/changelog/anomaly-alert-configuration-now-available
- https://vercel.com/changelog/improved-speed-insights-experience

(`/docs/observability/usage` und `/docs/observability/monitoring` als exakte URLs existieren nicht — die kanonischen Pfade sind `/docs/pricing/manage-and-optimize-usage` bzw. `/docs/query/monitoring`.)