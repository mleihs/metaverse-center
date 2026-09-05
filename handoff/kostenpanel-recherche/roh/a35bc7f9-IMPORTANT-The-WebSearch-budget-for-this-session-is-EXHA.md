# AUFTRAG

IMPORTANT: The WebSearch budget for this session is EXHAUSTED. Use ONLY WebFetch (direct URLs). Guess plausible doc URLs and follow links found in fetched pages. Note: PostHog docs are also available with a `.md` suffix (e.g. https://posthog.com/docs/product-analytics/trends.md) which often returns cleaner content — try that.

I already have these PostHog facts confirmed; do NOT re-research them:
- Chart types confirmed from https://posthog.com/docs/product-analytics/trends/charts (Line linear, Line cumulative, Bar time series [breakdowns STACKED], Area [stacked], Number, Bar total value [+"Stack breakdown values"], Pie, Table, World map)
- Incomplete interval: "a dotted line indicated the data for that period is still being collected" — from https://posthog.com/docs/product-analytics/trends
- Web Analytics tiles: visitors/views/sessions/session duration/bounce rate, "Each of these is compared with the previous time range, showing how much they increased or decreased" — from https://posthog.com/docs/web-analytics/dashboard

FIND THESE REMAINING GAPS (each backed by URL, "nicht belegt" if not found — never guess):

PostHog:
1. "Compare to previous period" — exact UI label and HOW the previous period is drawn on the chart (dashed line? lighter? separate series named "previous"?). Try: /docs/product-analytics/trends.md, /docs/product-analytics/dashboards, /docs/web-analytics/dashboard, PostHog blog/changelog posts about comparisons.
2. Tooltip contents on a Trends chart: does it

---

# Rechercheergebnis: PostHog/Cloudflare UI-Details

Alle Aussagen sind mit Quelle und Belegqualität markiert. Wo nichts gefunden wurde, steht "nicht belegt".

## PostHog

**1. "Compare to previous period"**
Kein einheitliches Feature über alle Chart-Typen — es ist pro Chart-Typ verschieden dokumentiert:
- **Number-Chart:** Exaktes UI-Label ist **"Compare to previous period"**, Ergebnis wird als **"percentage change pill"** (Prozent-Änderungs-Pille) angezeigt. Berechnung hängt vom Headline-Value ab (Total/Average vs. Latest). Quelle (a, Doc-Prosa): https://posthog.com/docs/product-analytics/trends/charts.md
- **Table-Chart:** Vergleichswerte erscheinen **"in a dedicated column next to the current values"** — also eine eigene Spalte, keine visuelle Linie. Quelle (a): dieselbe Seite.
- **Web-Analytics-Kacheln:** "Each of these is compared with the previous time range, showing how much they increased or decreased" (bereits vorher bekannt).
- Für **Line/Bar-Zeitreihen-Charts** (die eigentliche "zweite Linie auf dem Graph"-Frage): **nicht belegt.** Weder auf `/docs/product-analytics/trends.md` noch `/docs/product-analytics/trends/charts.md` noch `/docs/product-analytics/trends/tips.md` wird beschrieben, ob/wie eine gestrichelte zweite Linie oder eine "previous"-Serie im Zeitreihen-Chart selbst gezeichnet wird. Mehrere Vermutungs-URLs (`/trends/date-range.md`, `/trends/sampling.md`, `/trends/faq.md`) existieren nicht (404).

**2. Tooltip-Inhalt**
Nur für den **Number-Chart** dokumentiert: **"Hover over the sparkline to see individual data point values and point-to-point changes."** Quelle (a): trends/charts.md.
Für Line-/Bar-Zeitreihencharts (ob der Tooltip alle Serien an der x-Position auflistet, mit Summe, sortiert): **nicht belegt** — dazu keine Doc-Aussage gefunden.

**3. Breakdown-Limit**
Bestätigt: **"PostHog only loads the first 25 values of a breakdown when you first load an insight"**, mit einem **"Load more breakdown values"**-Button zum Nachladen. Kein "Other"-Sammel-Bucket dokumentiert — nur "Load more" (kein Zusammenfassen des Rests). Ausnahme: numerische Breakdowns (Bins) aggregieren von vornherein alle Werte, nicht nur Top 25. Quelle (a): https://posthog.com/docs/product-analytics/trends/breakdowns.md

**4. Sampling-Anzeige in der UI**
**Nicht belegt.** `/docs/product-analytics/sampling.md`, `/docs/data/sampling.md`, `/docs/product-analytics/trends/sampling.md`, `/docs/product-analytics/query-performance.md` existieren nicht bzw. liefern keinen Treffer (404 oder Redirect auf generische Seite ohne Sampling-Bezug). Kein Badge/Label für sampled Insights dokumentiert gefunden.

**5. Web-Analytics-Tabellen (Paths, Referrers, Channels)**
Volltext von https://posthog.com/docs/web-analytics/dashboard.md geprüft (a, Doc-Prosa):
- Paths-Tabelle zeigt Spalten: views, visitors, bounce rate, scroll depth. Man kann **"click on any of the paths to filter the dashboard for that path"** (Klick filtert, ist aber kein Drill-down-Modal).
- Referrers/Channels: Spalten nicht im Detail benannt, nur "top referrers, channels, and UTMs" plus ein separater "session attribution explorer".
- **Inline-Balken proportional zum Wert in der Tabelle: nicht belegt** — keine Erwähnung in der Doc-Prosa, keine Bildunterschrift beschreibt das.
- **Sortierbarkeit der Spalten: nicht belegt.**

**6. Drill-down & Legend-Interaktion**
Beides jetzt mit Wortlaut belegt (a, Doc-Prosa) über https://posthog.com/docs/product-analytics/trends/tips.md:
- **Persons-Modal:** *"Clicking on a data point in a trends insight opens the persons modal, which shows you a list of users/groups that performed it during the selected time period."* Von dort aus: Session-Replays ansehen, User-Properties einsehen, als Cohort speichern, als CSV exportieren.
- **Legend-Klick:** *"When the legend is enabled, you can click the checkbox next to any series to toggle its visibility on the chart."* Zusätzlich Rechtsklick-Kontextmenü mit **"Hide other series"** (isoliert die angeklickte Serie), **"Show all series"**, **"Hide all series"**.

**7. Date-Range-Presets**
Nur Teilinformation gefunden: **"The default time range is the last 7 days"**, Gruppierung wählbar **"by second, minute, hour, day, week, or month."** Eine explizite Liste der Preset-Buttons (z.B. "Last 24 hours", "Last 30 days" …) wird in der Doc-Prosa **nicht aufgezählt** — nur der Verweis auf ein Dropdown, in dem man "your desired date range" auswählt. Quelle (a, aber unvollständig): https://posthog.com/docs/product-analytics/trends.md

**8. Empty State / "no data"**
**Nicht belegt.** In keiner der geprüften Seiten (trends.md, trends/charts.md, trends/tips.md, web-analytics/dashboard.md) wird eine explizite Leerzustands-Meldung oder deren Abgrenzung zu "Wert = 0" beschrieben.

## Cloudflare (kurz)

- **Header-Kacheln mit Deltas:** nicht belegt — https://developers.cloudflare.com/web-analytics/ ist nur eine Marketing-Übersichtsseite ohne UI-Detailbeschreibung.
- **Sampling-Hinweis in der UI:** nicht belegt. `/analytics/faq/about-analytics/`, `/analytics/types-of-analytics/`, `/analytics/faq/` liefern keine Aussage zu einem UI-Badge/Label für "sampled data". Die FAQ-Indexseite verweist nur auf weitere Unterseiten (u.a. "GraphQL API inconsistent results"), die nicht mehr geprüft wurden (Budget).
- **Zeitraum-Presets:** nicht belegt in den geprüften Seiten. `/analytics/account-and-zone-analytics/zone-analytics/` erwähnt nur allgemein: *"To change the time period, use the dropdown menu on the right-hand side above the graph"* und *"drag to zoom on the graph"* — keine konkreten Preset-Namen.
- **Tabellen/Spalten:** nicht belegt.

## Zusammenfassung offener Punkte (nicht belegt, nicht raten)
- Wie "Compare to previous period" auf Line-/Bar-Zeitreihen-Charts grafisch dargestellt wird (gestrichelt? eigene Serie?)
- Vollständiger Tooltip-Inhalt für Line-/Bar-Charts (alle Serien, Summe, Sortierung)
- Sampling-Anzeige in der PostHog-UI (Badge o.ä.)
- Inline-Balken/Sortierbarkeit in Web-Analytics-Tabellen
- Vollständige Liste der Date-Range-Presets (PostHog wie Cloudflare)
- Empty-State-Darstellung (PostHog)
- Cloudflare: Header-Kacheln mit Deltas, Sampling-Hinweis, Zeitraum-Presets, Tabellenspalten

Für diese Punkte würde ich beim Bau der eigenen UI keine PostHog/Cloudflare-Verhaltensannahme referenzieren, sondern es als eigene Design-Entscheidung kennzeichnen.