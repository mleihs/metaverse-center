# AUFTRAG

Du recherchierst im Web (WebSearch/WebFetch) für ein Design-Vorbild-Dossier. Antworte auf DEUTSCH. Schreibe KEINE Dateien — gib alles als finale Textantwort zurück.

ZIEL: Konkrete, nachschaubare Vorbilder für ein dichtes, dunkles KI-KOSTEN-/Telemetrie-Admin-Panel (Aufrufe, Token, USD, aufgeschlüsselt nach Anbieter/Modell/Zweck/Welt/Nutzer, freie Zeiträume, Hochrechnung).

Untersuche GEZIELT diese Produkte — je mit URL zu Doku oder Screenshots:
1. Vercel Observability + Usage/Billing Dashboard
2. Railway Metrics + Usage
3. Fly.io Metrics/Dashboard
4. Grafana Scenes / Grafana Dashboards (dark)
5. Datadog (Cost Management / APM)
6. Honeycomb
7. Axiom
8. Tinybird
9. ClickHouse Cloud (Query Insights, Usage)
10. Sentry Insights / Stats & Usage

Für JEDES Produkt liefere:
- URL(s) zu Doku/Screenshots (echte, verifizierte URLs — sag ausdrücklich, wenn du nur Marketingbilder gefunden hast oder etwas hinter Login liegt)
- Was macht es außergewöhnlich? KONKRET: Zeilenhöhen, Schriftgrößen (px), Rasterabstände, Farbdisziplin (wie viele Akzentfarben?), Hover-Verhalten, Drill-down-Weg (Klick von Aggregat zu Detail), wie Zeiträume gewählt werden (Presets? Brush? Absolut/relativ? Vergleichszeitraum?)
- Speziell interessant: wie zeigen sie KOSTEN-Aufschlüsselung und Hochrechnung/Forecast bis Monatsende?

Sei ehrlich, wo du keine echten Screenshots findest. Nenne Dinge, die man wirklich nachschauen kann. Nutze mindestens 15 Websuchen und fetche die vielversprechendsten Seiten.

---

# Recherche-Dossier: Vorbilder für ein KI-Kosten-/Telemetrie-Admin-Panel

**Vorab-Einschränkung, unbedingt lesen:** Das WebSearch-Kontingent dieser Sitzung war bereits zu Beginn meiner Arbeit erschöpft (200/200, verbraucht von anderen Vorgängen dieser Session) — ich konnte **keine einzige Websuche** durchführen und war komplett auf WebFetch mit geratenen/bekannten URLs angewiesen. Das hat zwei Konsequenzen, die ich nicht verschweigen will:

1. Viele URL-Vermutungen liefen ins Leere (404) — v.a. bei Fly.io, ClickHouse Cloud, Sentry, Honeycomb, Axiom, Tinybird, Datadog fehlen mir dadurch Belege, die es vermutlich gibt, die ich aber nicht gefunden habe.
2. WebFetch wandelt Seiten in Text um und lässt einen KI-Assistenten zusammenfassen — es liefert **keine echten Screenshots und keine CSS-/Pixel-Werte**. Keine der zehn Quellen dokumentiert öffentlich Zeilenhöhen, Schriftgrößen in px oder Rasterabstände in px. Wo ich unten "px" oder "Raster" schreibe, ist das entweder wörtlich aus der Doku zitiert (selten) oder als allgemein bekannt gekennzeichnet, nie von mir frei erfunden.

Ergebnis: Für 3 von 10 Produkten (Vercel, Grafana, Sentry) habe ich brauchbare, konkrete Doku-Belege. Für die übrigen 7 ist die Ausbeute dünn bis leer — das sage ich explizit dazu, statt es zu kaschieren.

---

## 1. Vercel Observability + Usage/Billing — bestes Ergebnis dieser Recherche

Quellen (echte Doku-URLs, mit eingebetteten Screenshot-Links):
- https://vercel.com/docs/observability
- https://vercel.com/docs/ai-gateway/observability-and-spend/observability
- https://vercel.com/docs/pricing/manage-and-optimize-usage

Konkrete Screenshot-URLs aus der Doku (Marketing-/Doku-Bilder, keine Live-App-Screenshots mit Kundendaten):
- `https://vercel.com/docs-assets/static/docs/concepts/observability/O11y-Tab-Light.png`
- `https://vercel.com/docs-assets/static/docs/concepts/observability/error-rate-light.png`
- `https://vercel.com/docs-assets/static/docs/ai-gateway/overview-observability/graphs-light.png`
- `https://vercel.com/docs-assets/static/docs/ai-gateway/overview-observability/projects-summary-light.png`
- `https://vercel.com/docs-assets/static/docs/ai-gateway/overview-observability/apikeys-summary-light.png`

**Was konkret dokumentiert ist (das ist genau das AI-Gateway-Muster, das für euer Panel relevant ist):**
- Die "Usage"-Sektion des AI-Gateway-Dashboards zeigt exakt 4 Diagramme: *Requests by Model*, *Time to First Token*, *Input/Output Token Counts*, *Spend* — also Aufrufe, Latenz, Token, Kosten als vier gleichrangige Kacheln.
- Drill-down-Weg ist explizit beschrieben: Graph anschauen → Zeitraum per Klick-und-Ziehen markieren → Button "Zoom In" drücken → darunterliegende Routen-/Modell-Liste nach Fehlerrate oder Dauer neu sortieren → auf eine Route/ein Modell klicken → Detailansicht mit Latenz, Pfad-Aufschlüsselung, externen APIs, direktem Link zu den Logs dieser Route. Das ist ein sauberer 4-stufiger Aggregat→Detail-Pfad.
- Zwei Aggregationsachsen parallel: "Requests" wird sowohl nach **Projekt** als auch nach **API-Key** aufgeschlüsselt (zwei getrennte Tabellen), jede Zeile mit: Request-Anzahl, durchschnittliche Tokens, P75-Dauer, P75-TTFT, Kosten. Klick in eine Zeile → Detailseite. Das deckt sich fast 1:1 mit eurer Anforderung "Anbieter/Modell/Zweck/Welt/Nutzer".
- Team-Scope vs. Projekt-Scope als expliziter Umschalter oben (Projekt-Dropdown in der Kopfzeile), keine separate Seite.
- **Hochrechnung/Forecast:** Das allgemeine Usage-Dashboard (nicht AI-Gateway-spezifisch) zeigt einen "allotment indicator" — ein Balken/Indikator pro Metrik, der zeigt, wie viel vom Kontingent im laufenden Abrechnungszyklus verbraucht ist, **plus die hochgerechneten Kosten für diesen Posten** direkt daneben. Das ist die Hochrechnungs-Metapher, die am nächsten an eurer Anforderung liegt.
- Zeitraum-Steuerung: Standard-Empfehlung "letzte 30 Tage", Dropdown zur Wahl des Abrechnungszyklus, zusätzlich fünf Umschalt-Ansichten pro Metrik: **Count / Project / Region / Ratio / Average** — je eine andere Zerlegung derselben Zahl (absolute Summe, pro Projekt, pro Region, Verhältnis z. B. cached/uncached, 24h-Durchschnitt).
- Logs-Seite (separat von der Übersicht) ist filterbar nach Request-ID, Modell, Anbieter, Status-Code, mit Live-Follow-Modus und CSV/JSON-Export.

Farbschema, Zeilenhöhen, exakte Schriftgrößen: **nicht dokumentiert**, nur in den (Light-Mode-)Screenshot-PNGs sichtbar, die ich nicht bildlich auswerten konnte.

---

## 2. Railway Metrics + Usage — dünn, Kosten-UI nicht auffindbar

Quelle: https://docs.railway.com/reference/metrics (die Usage/Billing-Seite `docs.railway.com/reference/usage` gab 404, war nicht auffindbar)

- Vier Metriken: CPU, Memory, Disk Usage, Network (In/Out).
- 30 Tage Historie.
- Deployments werden als gestrichelte vertikale Linien in den Zeitreihen markiert — netter Kontext-Layer, den man für "wann wurde welches KI-Modell/Preis gewechselt" übernehmen könnte.
- Zwei Ansichts-Modi bei mehreren Replicas: **Sum-View** (aggregiert) und **Replica-View** (pro Instanz) — expliziter Umschalter zwischen Aggregat und Einzelinstanz.
- Explizit **nicht** erfasst laut Doku: Application-Level-Metriken wie Latenz, Fehlerrate oder Business-KPIs — Railway bleibt Infrastruktur-Ebene, keine Kosten-je-Feature-Aufschlüsselung.
- Kosten-/Billing-Dashboard: keine Doku-Seite gefunden, damit für euer Kosten-Dossier nur bedingt brauchbar.

---

## 3. Fly.io Metrics/Dashboard — kein eigenes UI, sondern verwaltetes Grafana

Quelle: https://fly.io/docs/reference/metrics/

- Fly.io baut **kein eigenes Kosten-/Metrik-Dashboard**, sondern stellt ein vorkonfiguriertes, gehostetes Grafana unter `fly-metrics.net` bereit, mit fertig verdrahteter Prometheus-Datenquelle.
- Explore-Panel für Ad-hoc-PromQL-Abfragen.
- Organisationswechsel über einen Link "Switch organization" unten links unter dem Nutzersymbol.
- Sonst keine Layout-/Farb-Details auffindbar — im Kern ist "Fly.io Metrics" = "Grafana", siehe Punkt 4. Als eigenständiges Vorbild für ein *bespoke* Kosten-Panel eher schwach; als Beleg dafür, dass "man Grafana einfach fertig einbetten kann", relevant.

---

## 4. Grafana Scenes / Grafana Dashboards (dark)

Quellen:
- https://grafana.com/developers/scenes/ (Scenes-Framework)
- https://grafana.com/docs/grafana/latest/dashboards/ (allgemeine Dashboard-Doku)

**Layout-Konzept (Scenes-Framework):** `SceneFlexLayout` + `SceneFlexItem` für responsive Anordnung; Panels sind austauschbare "Scene Objects". Unterstützt: globale Zeiträume + **Vergleichszeitraum** ("comparing time ranges" wird explizit als eigenes Konzept genannt), Variablen, Transformationen, Ad-hoc-Filter, Drill-down zwischen Seiten, Tab-Strukturen.

**Zeitraum-Steuerung (aus der Standard-Dashboard-Doku, konkret zitierbar):**
- Presets wie "Last 30 minutes", "Last 12 hours", "This week so far".
- Freitext-Relativzeiten mit Einheiten `s, m, h, d, w, M, Q, y` (z. B. "13h").
- Absolute Zeiten über From/To-Felder oder Kalender, mit Mischform "genauer Zeitstempel" oder relativ (`now-24h`).
- **Semi-relativer Modus**: fester Startzeitpunkt + `now` als Ende — für einen progressiven "Zoom-out"-Effekt bei Langzeit-Monitoring. Das ist ein interessantes, wenig kopiertes Muster für ein Monats-Kosten-Panel ("seit Monatsbeginn bis jetzt").
- Refresh: manuell oder Auto-Refresh, wobei "Auto" sich an Zeitraumlänge und Bildschirmbreite anpasst.
- Zoom direkt im Graph per Klick-und-Ziehen, zusätzlich Tastenkürzel `t+`/`t-` zum Ein-/Auszoomen.

**Grid/Panel-Layout, Drill-down:** Die Doku bestätigt nur qualitativ "Panels lassen sich per Drag-and-Drop verschieben und in der Größe ändern" sowie Panel-Links zu anderen Dashboards/Panels/externen Seiten, plus ein Feature "Metrics Drilldown". **Ich konnte die konkrete Spaltenzahl des Grafana-Grids (in meiner eigenen Erinnerung: 24 Spalten) in dieser Sitzung nicht per Doku-Zitat verifizieren** — das ist mir aus Vorwissen bekannt, aber nicht durch diese Recherche belegt, daher nenne ich es hier nur mit diesem Vorbehalt und nicht als geprüften Fakt.

**Dark-Theme-Farbwerte:** nicht auffindbar in den erreichten Doku-Seiten.

---

## 5. Datadog (Cost Management / APM)

Quelle: https://docs.datadoghq.com/cloud_cost_management/

- Zentrale "Cloud Costs Summary"-Seite korreliert Cloud-Ausgaben mit Nutzungsmetriken.
- Cloud Cost ist eine eigene Datenquelle für selbstgebaute Dashboard-Widgets (man baut die Kosten-Ansicht also aus denselben Bausteinen wie jedes andere Dashboard — kein Sonderformat).
- 15 Monate Datenhistorie.
- **Fünf Monitor-/Alert-Typen speziell für Kosten**, das ist der konkreteste Fund hier: *Cost Changes*, *Cost Anomalies*, *Cost Threshold*, *Cost Forecast*, *Budget Monitors* — also Forecast ist bei Datadog ein eigener, erster-Klasse-Alarmtyp, nicht nur eine Kennzahl im Chart.
- Export via Metrics API, KI-gestützte Abfrage über "Cloud Cost Skill in Bits Chat".
- **Layout, Farbschema, konkrete Forecast-Visualisierung im Chart selbst:** nicht auffindbar — die Get-Started- und Blog-Unterseiten, wo Screenshots zu erwarten wären, gaben 404. Kann ich also nicht belegen, nur die Konzept-Ebene.

---

## 6. Honeycomb

- Die BubbleUp-spezifische Doku-Seite (zweimal unter verschiedenen URLs versucht) war beide Male nicht erreichbar (404) — kann ich nicht belegen, obwohl BubbleUp Honeycombs bekanntestes UI-Feature ist.
- Aus einer erreichbaren Doku-Seite: Query-Interface mit `SELECT`-Klausel, z. B. `HEATMAP(duration_ms)`; eine Heatmap zeigt jeden Punkt als einen einzelnen Trace; Klick auf einen Punkt öffnet direkt den Trace mit seinen Spans, Dauer und Fehlerstatus. Das ist ein knapper, aber klarer Aggregat→Einzelfall-Drill-down (Heatmap-Punkt → Trace → Spans).
- Von der Produktseite (honeycomb.io/platform, nur Video-lastig, kaum Text): Features "Canvas" (Untersuchungsoberfläche), **"Agent Timeline"** (zeitliche Visualisierung von LLM-Aufrufen/Agenten-Workflows — das ist inhaltlich am nächsten an eurem "Aufrufe nach Zweck/Welt"-Bedarf, aber ich habe keine Bilddaten dazu, nur die Textbeschreibung), Tracing (Wasserfallansicht), Log Events.
- Dark-Theme, Farbdisziplin, Hover-Verhalten: nicht auffindbar in dieser Sitzung.

---

## 7. Axiom

- Erreichbare Doku (`axiom.co/docs/query-data/explore`, `axiom.co/docs/monitor-data/dashboards`): Explorer-Workflow in vier Schritten — Source (Dataset wählen) → Filter (Where, mit "+"-Buttons für AND/OR-Bedingungen) → Transform/Summarize (Aggregation) → Time range (oben links). Tabs für Builder- vs. Editor-Modus (visuell vs. Abfragesprache).
- Dashboards: drei Erstellungswege (KI-generiert aus Textbeschreibung, leer, oder von bestehendem Dashboard geforkt) und zehn Kachel-Typen: Gauge, Heatmap, Log Stream, Monitor List, Note, Pie Chart, Scatter Plot, Statistic, Table, Time Series.
- Farbschema, Grid, Drill-down-Mechanik von Kachel zu Rohdaten: **nicht dokumentiert** in den erreichten Seiten.

---

## 8. Tinybird

- Konnte über Doku-Startseite, einen geratenen Blog-Post (404) und die Landingpage **keine einzige UI-/Design-Aussage** gewinnen. Der Text dreht sich durchgehend um SDKs (TypeScript/Python/CLI), "managed ClickHouse"-Positionierung, Agent-Integration — nicht um ein Dashboard-Erlebnis.
- Ehrlicher Befund: Tinybird ist primär eine API-/Pipeline-Plattform, kein Kosten-Admin-Panel im Sinne eurer Anfrage. Als Vorbild für dieses konkrete Dossier vermutlich der falsche Kandidat — das ist selbst ein Ergebnis, auch wenn negativ.

---

## 9. ClickHouse Cloud (Query Insights, Usage)

- Vier geratene URLs zu Query Insights/Monitoring/Billing gaben 404; einzig eine allgemeine Pricing-Seite lieferte Substanz: Abrechnung nach Compute, Storage, Data Transfer (Egress), ClickPipes; die Cloud-Console habe laut Text "eine Usage-Anzeige, die die Nutzung pro Service aufschlüsselt" ("Usage display that details usage per service").
- Zu Layout, Query-Insights-Drill-down (von Aggregat-Query-Statistik zu Einzel-Query), Farbschema: **keine belastbare Information gefunden.** Das ist eine echte Lücke in dieser Recherche, keine verkappte Aussage über das Produkt selbst.

---

## 10. Sentry Insights / Stats & Usage — zweitbestes Ergebnis

Quelle: https://docs.sentry.io/product/stats/ (erreichbar; `/product/stats-v2/`, `/product/insights/organization/stats` gaben 404)

- Drei Reiter: **Usage, Issues, Health**.
- Zeitraum von 1 Stunde bis maximal 90 Tagen; die Balkenauflösung des Charts wechselt mit der Zeitraumlänge — bei 7 Tagen ein Balken pro Stunde, bei 90 Tagen ein Balken pro Tag. Das ist ein konkretes, nachvollziehbares Muster für "wie granular ist die Zeitachse abhängig vom gewählten Zeitraum".
- Ereignisse/Anhänge werden in **genau fünf Status-Kategorien** aufgeschlüsselt, nicht nach Anbieter/Modell, sondern nach Verarbeitungsschicksal: **Accepted, Filtered, Rate Limited, Invalid, Client Discard**. Für ein KI-Kosten-Panel wäre das analoge Muster: erfolgreiche Aufrufe vs. gedrosselte vs. fehlgeschlagene vs. clientseitig verworfene Aufrufe als eigene, gleichrangige Kategorien statt nur "Erfolg/Fehler".
- Darunter eine Projekt-Tabelle: pro Projekt dieselbe Fünf-Kategorien-Aufschlüsselung für Errors/Transactions/Attachments, mit Link zu Projekteinstellungen bzw. Projekt-Detailseite — klassisches "Aggregat-Zeile klicken → Projektdetail".
- Insights-Übersicht (separate, aktuellere Seite `docs.sentry.io/product/insights/`) ergänzt: Dashboards sind nach App-übergreifend / Frontend / Backend / Mobile / Framework-spezifisch gruppiert, filterbar nach Environment, Projekt, Datumsbereich, Release, mit Drill-down direkt zu Traces, Fehlern und Releases.
- Farbschema, Quota-Balken-Optik, Hochrechnung bis Monatsende: **nicht auffindbar** — die Doku beschreibt nur die Kategorielogik, keine visuelle Forecast-Darstellung.

---

## Fazit für euer Dossier

Am besten belegt und am direktesten übertragbar ist **Vercel AI Gateway Observability**: die Vier-Kacheln-Aufteilung (Requests/Latenz/Token/Spend), die Doppel-Aufschlüsselung nach Projekt UND API-Key mit identischen Kennzahlen (Count, avg Tokens, P75-Latenz, P75-TTFT, Kosten) und der "Allotment-Indikator" mit hochgerechneten Kosten sind konkrete, nachschaubare Muster — nicht nur Marketing-Behauptung.

Zweitbester Fund ist **Sentry**, mit dem klaren Fünf-Kategorien-Schema für Aufruf-Schicksal (statt nur erfolgreich/fehlgeschlagen) und der zeitraumabhängigen Balkengranularität.

**Grafana** liefert das differenzierteste Zeitraum-Auswahl-Vokabular (relativ/absolut/semi-relativ mit `now`-Ende, Vergleichszeitraum als Scenes-Konzept), aber keine Layout-Pixelwerte.

Für **Railway, Fly.io, Datadog, Honeycomb, Axiom, Tinybird, ClickHouse Cloud** ist die öffentlich zugängliche Doku entweder zu knapp, zu sehr hinter Login/Blog-Bildern verborgen, oder ich habe mit meinen geratenen URLs schlicht die falschen Pfade getroffen. Wer echte Screenshots dieser sieben braucht, kommt um einen eingeloggten Blick in die jeweilige Live-App bzw. eine erneute, funktionierende Websuche nicht herum — das kann ich in dieser Sitzung nicht mehr liefern, da das WebSearch-Kontingent für die gesamte Session (nicht nur für mich) aufgebraucht war.