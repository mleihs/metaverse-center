# AUFTRAG

Research the INTERFACE DESIGN of the Stripe Dashboard Home, Reports, and Sigma. I care about visual/interaction design and information density, NOT payments as a subject.

Use WebSearch and WebFetch. Start with:
- https://docs.stripe.com/dashboard (and /dashboard/basics)
- https://docs.stripe.com/reports and https://docs.stripe.com/reports/reporting-basics
- https://docs.stripe.com/stripe-dashboard/analytics or docs about the "Overview"/Home page
- https://docs.stripe.com/sigma
- https://docs.stripe.com/revenue-recognition, /docs/billing/revenue-analytics if relevant
- Stripe changelog / blog about dashboard redesign; also Stripe's design writing if it covers charts

Answer these SPECIFIC questions, each backed by a URL. Write "nicht belegt" if not documented — do NOT guess:
1. The KPI row on Dashboard Home: which metrics (gross volume, net volume, new customers, spend per customer, ...)? Do the tiles carry sparklines? Is there a delta vs previous period, and how is it rendered (arrow, percent, color)?
2. The "compared to previous period" representation: is the previous period drawn as a second line, a dashed/ghost line, a lighter shade? Does the doc describe it?
3. Main chart: type, granularity, time-range presets available.
4. Tooltip on hover: does it show current period AND comparison period value together?
5. Tables (payments list, reports): columns, sorting, inline bars?
6. Incomplete/in-progress period: does Stripe mark today's partial day specially? Any note about "da

---

# Stripe Dashboard Interface-Recherche: Home, Reports, Sigma

Kurzfassung vorab: Die Docs beschreiben Home/Reports/Sigma vor allem **funktional** (was man einstellen kann), kaum **visuell** (wie es aussieht/reagiert). Die belastbarsten visuellen Belege stammen aus eingebetteten Screenshots auf Unterseiten von *Payments Analytics* (nicht Home selbst) und aus der Sigma-Doku. Ich kennzeichne das bei jeder Antwort.

---

**1. KPI-Reihe auf Dashboard Home**
**Nicht belegt** für die konkrete Home-Startseite. `docs.stripe.com/dashboard` (= `/dashboard/basics`) beschreibt Home nur als: "Auf der Startseite finden Sie Analysen und Diagramme zu Ihrer Unternehmensleistung" plus ein Anpassungs-Flow ("Ihre Übersicht" → **Hinzufügen** → Widgets an/aus → **Übernehmen**, oder **Bearbeiten** zum Entfernen). Es ist also explizit ein **Widget-Baukasten**, keine fixe KPI-Zeile – welche Metriken (Gross/Net Volume, neue Kunden, Spend/Kunde …) als Widgets existieren, wird nicht aufgezählt. *(a) Doc-Prosa, kein Screenshot.* Quelle: https://docs.stripe.com/dashboard

Als **Analogie** (nicht Home, aber gleiches Design-System) zeigt ein eingebetteter Screenshot der Zahlungsanalyse-Seite "Key metrics" mit 3 Kacheln: Metrikname, große Zahl, farbiger Delta-Prozentwert (grün bei +, rot bei –), **keine** Sparkline in der Kachel selbst – stattdessen macht ein Klick auf eine Kachel (blau umrandet = ausgewählt) diese zur Quelle für das große Chart darunter. *(b) Doc-Screenshot.* Quelle: https://docs.stripe.com/payments/analytics (Bild: `overview.61ec7a7c…png`)

Separat dokumentiert: Sigma-"Kennzahlengruppen" (auf Dashboards pinnbare Widgets aus Sigma-Reports) zeigen große Zahl **+ echte Sparkline/Mini-Chart darunter** (Linie, Balken oder gestapelter Balken je nach Reportart), Trend sichtbar aber ohne sichtbaren Delta-Wert im Screenshot. *(b) Doc-Screenshot.* Quelle: https://docs.stripe.com/data/how-sigma-works (Bild: `custom-reports.537d49b1…png`)

---

**2. "Vorheriger Zeitraum"-Darstellung**
Belegt, mit Screenshot: **eine zweite, hellgraue GEPUNKTETE/GESTRICHELTE Linie** hinter der durchgezogenen farbigen Ist-Linie, mit expliziter Legende "Current period" (violettes Quadrat) / "Previous period" (helles graues Quadrat). *(b) Doc-Screenshot.* Quelle: https://docs.stripe.com/payments/analytics

Textlich bestätigt: "Die Zeitreihe vergleicht den Kurs mit einem `previous_period`, den Sie anpassen können. Standardmäßig beginnt der Vergleichszeitraum direkt vor dem von Ihnen gewählten Zeitraum und stellt die gleiche Zeitspanne dar." *(a) Doc-Prosa.* Quelle: https://docs.stripe.com/payments/analytics/acceptance

(Beleg stammt aus *Payments Analytics/Acceptance*, nicht direkt aus Home oder den Standard-Reports – dort nicht gefunden.)

---

**3. Haupt-Chart: Typ, Granularität, Zeitraum-Presets**
- Typ: **Liniendiagramm** (im Screenshot bestätigt), Sigma-Ergebnisse zusätzlich als **Linie oder Balken** wählbar. *(b) Screenshot / (a) Prosa.*
- Granularität: Dropdown mit sichtbaren Optionen **"Weekly"** und **"Daily"** in zwei verschiedenen Screenshots (Acceptance- bzw. Payment-Methods-Filterleiste) – "Monthly" wird nirgends explizit gezeigt, aber die Y-Achsen-Beschriftung im Hauptchart läuft "Jan…Apr" (monatliche Achsenteilung bei "Last 3 months"). *(b) Doc-Screenshot.*
- Zeitraum-Presets, im Screenshot sichtbar: **"Last 3 months"**, **"Last 7 days"**, plus explizites Custom-Datumsfeld ("Aug 14 – Aug 20"). Für die Finanzberichte (Reports) beschreibt der Text: Default = Vormonat, wählbar sind vergangene Monate, laufender Monat, oder freier Datumsbereich (inklusive Start/Ende). *(a)+(b).*
Quellen: https://docs.stripe.com/payments/analytics/acceptance (Bild `acceptance-filters…png`), https://docs.stripe.com/payments/analytics/payment-methods (Bild `filter…png`), https://docs.stripe.com/reports/options

---

**4. Tooltip beim Hover (aktueller + Vergleichswert zusammen)**
**Nicht belegt.** Kein Text und kein Screenshot zeigt einen Hover-Tooltip; alle gefundenen Chart-Abbildungen sind statisch ohne Cursor-Interaktion. Es gibt nur die Aussage, dass man oben in jedem Bericht auf ein "↗"-Symbol klicken kann, um zur zugrunde liegenden **Transaktionsdetailseite** zu wechseln – das ist Klick, kein Hover-Tooltip. *(a) Doc-Prosa, aber keine Tooltip-Aussage.* Quelle: https://docs.stripe.com/payments/analytics/acceptance

---

**5. Tabellen (Payments-Liste, Reports, Sigma-Ergebnis)**
- **Sigma-Ergebnistabelle:** Spalten sortierbar durch Klick auf Header, Spaltenbreite änderbar, max. 1.000 Zeilen sichtbar (CSV-Export unlimitiert), optionale Tabellen-**Visualisierung** (Linie/Balken, frei wählbare X-/Y-Achse, Gruppierung nach beliebiger Spalte) bei <10.000 Ergebnissen – keine inline-Balken IN der Tabelle selbst. *(a) Doc-Prosa.* Quelle: https://docs.stripe.com/data/write-queries
- **Revenue-Recognition-"Trial balance"-Tabelle** (Screenshot): Spalten "General ledger account / Starting / Net change / Ending", `Net change`-Werte sind unterstrichen = klickbare Links, die zur transaktionsgenauen Aufschlüsselung führen (Drilldown, kein Inline-Balken). *(b) Doc-Screenshot.* Quelle: https://docs.stripe.com/revenue-recognition/reports (Bild `statements…png`)
- **Payments-Liste (Transaktionen)**: nur Prosa "filtern oder exportieren", **keine** Spalten-/Sortier-/Balken-Details dokumentiert. *(a), unvollständig.* Quelle: https://docs.stripe.com/dashboard
- **Balance-/Payout-Reconciliation-Reports**: sehr ausführliche **CSV-Spaltenlisten** dokumentiert (z. B. `gross`, `fee`, `net`, `reporting_category`, dutzende optionale Metadatenspalten), das sind aber Export-Spaltendefinitionen, keine UI-Tabellenbeschreibung mit Sortierung/Balken. *(a).* Quelle: https://docs.stripe.com/reports/balance
- Inline-Balken in Tabellen: an keiner Stelle gefunden → **nicht belegt**.

---

**6. Unvollständiger/laufender Zeitraum & Daten-Lag**
- **Laufende vs. abgeschlossene Periode farblich unterschieden** – aber nur für Revenue-Recognition-Monatscharts dokumentiert: "Monatsdiagramme verwenden Farben, um zwischen offenen und abgeschlossenen Abrechnungszeiträumen zu unterscheiden. Zahlen in offenen Perioden ändern sich fortlaufend, bis die Periode geschlossen wird." *(a) Doc-Prosa.* Quelle: https://docs.stripe.com/revenue-recognition/reports
- **Daten-Lag/Reporting-Verzögerung**, mehrfach belegt:
  - Revenue Recognition-Dashboard: "Rechnen Sie mit einer Verzögerung von 4 Stunden, bevor die Daten im Dashboard angezeigt werden." Quelle: https://docs.stripe.com/revenue-recognition/reports
  - Balance-/Auszahlungsabgleich-Reports: Verarbeitung täglich ab 00:00 UTC, Bericht "in der Regel ab 12:00 Uhr des Folgetages verfügbar" (≈12 h SLA), zusätzlich zweimal täglich Webhooks (00:00/12:00 UTC). Quelle: https://docs.stripe.com/reports/balance und https://docs.stripe.com/reports/options
  - Acceptance-Analyse: "Stripe verarbeitet Ihre Daten täglich von 12:00 Uhr UTC bis 23:59 Uhr UTC." Quelle: https://docs.stripe.com/payments/analytics/acceptance
  - Sigma: eigener Parameter `data_load_time` markiert den Stand der verfügbaren Daten; geplante Abfragen (täglich/wöchentlich/monatlich) liefern Ergebnisse "in der Regel bis 14:00 Uhr UTC" nach Periodenende. Quelle: https://docs.stripe.com/data/how-sigma-works, https://docs.stripe.com/data/schedule-queries
  - Für Home/Dashboard-KPI-Zeile selbst: **nicht belegt.**

---

**7. Forecast/Projektion**
Es gibt ein **"Wasserfalldiagramm zum Umsatz" (Umsatzplan)** in Revenue Recognition, das zukünftig zu realisierenden Umsatz aus bereits erfolgten Abrechnungen zeigt – aber die Doku stellt ausdrücklich klar, dass das **keine echte Prognose** ist: "Dieser Bericht zeigt die zu erwartenden Umsatzbeträge basierend auf vergangenen Abrechnungen. Dabei werden keine zukünftigen Abrechnungen modelliert und auch keine zukünftigen Umsätze aus diesen potenziellen Abrechnungen prognostiziert." *(a) Doc-Prosa.* Quelle: https://docs.stripe.com/revenue-recognition/reports
Ein KI-/Trend-Forecast (z. B. hochgerechnetes Gross Volume) ist in Home/Reports/Sigma **nicht belegt.**

---

**8. "Keine Daten" vs. "Null" / Empty States**
**Nicht belegt.** In keiner der gesichteten Doc-Seiten oder Screenshots wird ein Leerzustand (fehlende Daten, 0-Wert-Anzeige, Platzhalter-Illustration o. Ä.) beschrieben oder gezeigt.

---

**9. Sigma: SQL+Tabelle oder Charts? UI-Funktionsumfang**
Sigma ist primär **SQL + Ergebnistabelle**, bietet aber eine **optionale Diagrammansicht** obendrauf – klar dokumentiert:
- Editor: freies ANSI-SQL, Navigationsleiste links mit **eigenen gespeicherten Abfragen**, **vom Team gespeicherten Abfragen**, **Tabellenschema-Browser**, **Vorlagen** (vorgefertigte Beispielabfragen für gängige Metriken/Reports).
- **KI-Assistent** (LLM) direkt im Editor: "Generieren" (schreibt neue Query aus natürlichsprachigem Prompt, überschreibt Editor) und "Bearbeiten" (ändert bestehende Query), inkl. Zusammenfassungstext, Chatverlauf pro Query, Feedback-Buttons "War diese Antwort hilfreich?". Screenshot bestätigt UI: Editor-Panel, Zusammenfassungs-Popup, Ergebnistabelle darunter, Buttons "Show chart"/"Download CSV". *(b) Doc-Screenshot.* Quelle: https://docs.stripe.com/data/write-queries (Bild `sigma-assistant…png`)
- Ergebnistabelle: sortierbar (Klick auf Header), Spaltenbreite anpassbar, max. 1.000 sichtbare Zeilen, CSV-Export ohne Limit.
- **Charts:** Linien- oder Balkendiagramm mit frei wählbaren X-/Y-Achsen, Gruppierung nach Spalte, nur bei <10.000 Ergebniszeilen, vom Query-Autor editierbar, wird mit der gespeicherten Query mitgespeichert.
- **Scheduling:** täglich/wöchentlich/monatlich, Ergebnisse per E-Mail (an frei wählbare Abonnent:innen, mit E-Mail-Vorschau) oder als Webhook-Event (`sigma.scheduled_query_run.created`) inkl. Datei-URL zum Abruf per Secret Key.
- **Speichern/Teilen:** gespeicherte Queries sind teamweit sichtbar, read-only für andere (nur der Autor kann bearbeiten), jede hat eine eigene teilbare URL; Kopieren via Kontextmenü (⋯) → "Kopie erstellen".
- **Kennzahlengruppen (Dashboard-Widgets aus Sigma):** bis zu 20 Sigma-Reports pro Gruppe, jeder mit optionalem editierbarem Mini-Chart (siehe Screenshot unter Punkt 1), sonst zeigt die Kachel nur die Zeilenzahl.
Quellen: https://docs.stripe.com/data/how-sigma-works, https://docs.stripe.com/data/write-queries, https://docs.stripe.com/data/schedule-queries

---

### Nicht erreichbare/leere Quellen
- `https://docs.stripe.com/reports/reporting-basics` → HTTP 404 (existiert unter dieser URL nicht mehr).
- `https://docs.stripe.com/dashboard/business-metrics` und `https://support.stripe.com/questions/customize-your-home-page` → HTTP 404.
- WebSearch war für diese Session bereits budget-erschöpft (0 verbleibende Suchen), daher basiert die Recherche ausschließlich auf gezielten WebFetch-Aufrufen der Stripe-Doku plus visueller Prüfung dreier eingebetteter Doc-Screenshots (heruntergeladen und mit dem Read-Tool betrachtet).

### Lokale Dateien (heruntergeladene Screenshots, zur Nachprüfung)
`/private/tmp/claude-501/-Users-mleihs-Dev-velgarien-rebuild/5fecf3bf-8603-403b-9f35-c16f4bda565c/scratchpad/stripe/` – `overview.png` (KPI-Kacheln + Chart mit Vorperioden-Linie), `filters.png`, `pmfilter.png` (Zeitraum-/Granularitäts-Presets), `statements.png` (Trial-Balance-Tabelle), `custom-reports.png` (Sigma-Kennzahlengruppen mit Sparklines), `sigma-assistant.png` (Sigma-Editor-UI).