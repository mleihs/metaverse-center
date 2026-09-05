# AUFTRAG

Recherchiere sehr gründlich im Web (WebSearch + WebFetch, viele Quellen, mindestens 8-12 verschiedene URLs) die KOSTEN- und NUTZUNGS-DASHBOARDS von **LangSmith** (LangChain).

Fokus: docs.smith.langchain.com bzw. docs.langchain.com/langsmith/... — insbesondere die Seiten zu Monitoring/Dashboards, "Charts", "Usage and billing" / "Cost tracking", "Trace a run", "Filter traces", "Data export", Changelog (changelog.langchain.com). Blog nur ergänzend.

Beantworte KONKRET und BELEGT MIT URL für jeden Punkt:
1. Welche KPI-Kacheln / Standard-Charts stehen im Projekt-Dashboard / auf der Monitoring-Seite: GENAUE Bezeichnungen (z.B. "Trace Count", "LLM Call Count", "Trace Success Rate", "Trace Latency", "Total Tokens", "Total Cost", "First Token Latency", "Feedback", "Run Types"). LangSmith hat ein vorkonfiguriertes Dashboard pro Tracing-Projekt — liste dessen Sektionen so genau wie belegbar.
2. Hauptdiagramm: Zeitreihe? Welcher Charttyp (Linie/Balken)? Welches Bucketing (LangSmith hat explizite "stride"/Bucketing-Optionen)? Belege die verfügbaren Zeitraum-/Bucket-Optionen.
3. Custom Charts / Dashboards: Welche Metriken und Aggregationen sind wählbar? (LangSmith hat "Custom Charts" mit Metrik + Group-by + Filter). Liste die belegten Metriken (z.B. count, latency percentiles, token counts, cost, feedback scores) und Chart-Typen (Line/Bar).
4. Aufschlüsselungsachsen / Group-by: Modell, Run-Name, Run-Type, Metadata-Key, Tags, Feedback-Key, Error/Status. Was ist belegt?
5. Tabellen und ihre

---

# LangSmith – Kosten- und Nutzungs-Dashboards: Rechercheergebnis

Recherchiert über `docs.langchain.com/langsmith/*` (aktuelle Doku-Domain, `docs.smith.langchain.com` und `changelog.langchain.com` leiten dorthin um) und `docs.langchain.com/llms.txt` / `sitemap.xml` zur URL-Ermittlung. WebSearch war session-weit aufgebraucht, daher ausschließlich WebFetch auf ermittelte/verifizierte URLs – jede Aussage unten stammt aus einem tatsächlich erreichbaren Dokument (HTTP 200), 404-Treffer sind nicht verwertet.

## 1. KPI-Kacheln / vorkonfiguriertes Projekt-Dashboard
Beleg: https://docs.langchain.com/langsmith/dashboards

Jedes Tracing-Projekt bekommt automatisch ein **Prebuilt Dashboard** mit sechs Abschnitten:
- **Traces** – "Trace count, latency and error rates"
- **LLM Calls** – Call Count und Latency für Runs mit `run_type=llm`
- **Cost & Tokens** – Token-Zählungen und Kosten, aufgeschlüsselt nach Typ
- **Tools** – Performance-Metriken für Tool-Runs, begrenzt auf Top 5
- **Run Types** – Metriken für unmittelbare Kinder des Root-Runs, Top 5
- **Feedback Scores** – Mittelwerte für numerisches, Zählwerte für kategoriales Feedback

Einschränkung: Die exakten Einzel-Kachel-Labels ("Trace Success Rate", "First Token Latency" etc., wie in der Aufgabenstellung vermutet) sind NICHT einzeln verbatim belegt – dokumentiert ist nur der Abschnitts-Inhalt ("Trace count, latency and error rates" als ein Abschnitt "Traces"). Einzel-Tile-Beschriftungen wären nur per Screenshot/UI verifizierbar → **nicht belegt**.

## 2. Hauptdiagramm: Typ, Zeitreihe, Bucketing
Beleg: https://docs.langchain.com/langsmith/dashboards, https://docs.langchain.com/langsmith/changelog

- Dashboard-weite Zeitraum-Einstellung: "Dashboard time range: set once at the top of the dashboard. Every chart uses this range unless it overrides its own bucket size." → pro Chart individuell überschreibbares Bucket ("stride").
- Der Changelog (August 2026, https://docs.langchain.com/langsmith/changelog) bestätigt das Stride-Konzept explizit: "Empty state messaging surfaces active stride and selected range" sowie "Time-series charts now display gaps for missing data instead of plotting zeros".
- Verfügbare Chart-Typen laut Custom-Dashboard-Doku: **Line, Stacked Bar, KPI, Ranked Bar, Donut, Table**.
- Konkrete Preset-Werte für Zeitraum (z.B. "1h/24h/7d/30d") und die exakte Liste der Stride-Optionen (Minute/Stunde/Tag) sind in der Textdoku **nicht ausformuliert** – nur als UI-Dropdown zu vermuten, nicht dokumentarisch belegt → **nicht belegt / vermutlich nur UI-Screenshot**.
- Für die "Granular Usage"-Tabelle (Billing-Bereich) ist ein Zeitraum-Preset dagegen konkret belegt: "7 days to 1 year or custom" (https://docs.langchain.com/langsmith/granular-usage).

## 3. Custom Charts / Dashboards – Metriken & Chart-Typen
Beleg: https://docs.langchain.com/langsmith/dashboards, https://docs.langchain.com/langsmith/changelog

Metriken (belegt):
- **Count** (Anzahl Runs)
- **Latency** – Average, P50, P99 (Changelog September/August 2026 erweitert dies zusätzlich um P90, P95: "Charts aggregate P50, P90, P95, and P99 latencies, TTFTs, tokens, and costs")
- **Time to first token** – Average, Percentile (auch "first_token_time" laut Changelog, per MCP-Tool `fetch_runs` abrufbar)
- **Tokens** – total/input/output, mit Sum/Average/Percentile-Aggregation
- **Cost** – total/input/output; Changelog ergänzt: "Custom dashboard charts can query P50 and P99 for input/output costs"
- **Feedback score** – Average, Min, Max
- **Ratio** – frei konfigurierbarer Zähler/Nenner (z.B. für Fehlerraten)

Chart-Typen (belegt): Line, Stacked Bar, KPI, Ranked Bar, Donut, Table.
Einschränkung: "Group by and multi-metric are mutually exclusive on a single chart."

## 4. Aufschlüsselungs-/Group-by-Achsen
Beleg: https://docs.langchain.com/langsmith/dashboards

Belegte Group-by-Achsen: **Run Name, Run Type, Tag, Project, Metadata, Feedback Label** (Top 20 nach Häufigkeit).
Filter-Ebenen (Scopes): Run-level, Trace-level (Root-Run), Tree-level (gesamter Trace, wenn irgendein Run matcht).
"Modell" als eigene Group-by-Achse ist NICHT explizit gelistet – Aufschlüsselung nach Modell würde über Metadata (`ls_model_name`) laufen, aber "Model" selbst steht nicht als eigenständige Achse in der Aufzählung → für "Modell" als direkte Achse **nicht belegt** (nur indirekt über Metadata).

## 5. Tabellen und Spalten

**Runs/Traces-Tabelle**: Ein expliziter, vollständiger Default-Spalten-Katalog (Name, Input, Output, Start time, Latency, Tokens, Cost, Status, Tags, Metadata) ist in der abgerufenen Doku **nicht als geschlossene Liste belegt** (mehrere Seiten zu Filter/Trace-Viewing wurden geprüft: https://docs.langchain.com/langsmith/filter-traces-in-application, https://docs.langchain.com/langsmith/observability-concepts – keine liefert eine Spaltenliste). Die Filterbarkeit einzelner dieser Felder ist aber über die Filter-DSL indirekt belegt (siehe Punkt 6): `name`, `run_type`, `status`, `start_time`/`end_time`, `latency`, `tags`, `metadata_key`/`metadata_value`, `feedback_key`/`feedback_score` (Beleg: https://docs.langchain.com/langsmith/trace-query-syntax). Token-/Kostenspalten sind laut Changelog filterbar: "Run filters support total, prompt, and completion token counts and costs consistently."

**Bulk-Export-Felder** (als Beleg für tatsächlich existierende Run-Datenfelder, https://docs.langchain.com/langsmith/data-export): `id, name, run_type, start_time, end_time, status, inputs, outputs, error, extra, events, tenant_id, session_id, trace_id, parent_run_id, parent_run_ids, reference_example_id, tags, feedback_stats, feedbacks (opt-in), total_tokens, prompt_tokens, completion_tokens, total_cost, prompt_cost, completion_cost`.

**Threads-Ansicht** (Beleg: https://docs.langchain.com/langsmith/threads): Spalten/Infos je Thread: **First input, Last output, Start time, Turn count, Latency (P50/P99), Token usage, Cost, Feedback score**. Drei Ansichts-Modi: Messages (Beta, Chat-Stil), Turns (aufklappbare Karten pro Turn), Details (voller Run-Baum). Rechtes Panel aggregiert projektweit: Thread-Anzahl, Trace-Summe, Median-Tokenverbrauch, Fehlerraten, Latenz-Perzentile.

## 6. Interaktionen

- **Filter-DSL** (Beleg: https://docs.langchain.com/langsmith/trace-query-syntax): Vergleichsfunktionen `eq()`, `neq()`, `gt()`, `gte()`, `lt()`, `lte()`, `has()` (Tag/Metadata-Vorhandensein, z.B. `has(tags, "production")`), `search()` (Volltext), `in()` (Listen-Check). Logische Verknüpfung über `and()`/`or()`, z.B. `and(eq(is_root, true), and(eq(feedback_key, "user_score"), eq(feedback_score, 1)))` (Beleg auch: https://docs.langchain.com/langsmith/filter-traces-in-application). Filterbare Felder u.a. `id, name, run_type` (llm/chain/tool/retriever/embedding/prompt/parser), `status` (success/error/pending), `start_time/end_time`, `latency`, `tags`, `metadata_key/value`, `feedback_key/score`.
- **Zeitraum-Presets** (Hauptdashboard): konkrete Werte nicht in Textform belegt (s. Punkt 2); für Granular-Usage-Tab dagegen "7 days to 1 year or custom" belegt.
- **Vergleich zur Vorperiode**: in keiner geprüften Seite erwähnt → **nicht belegt**.
- **Hover-Tooltip**: nur indirekt belegt über Changelog: "Dashboard chart tooltips and axes now show up to eight fractional digits" (bestätigt Existenz von Tooltips, aber keine Detailbeschreibung ihres Layouts).
- **Drill-down vom Chart in die Runs-Tabelle**: in der Textdoku nicht explizit beschrieben → **nicht belegt** (Automation-Rules-Seite kennt zwar einen "View run"-Button aus Rule-Logs, aber das ist keine Chart-zu-Tabelle-Drilldown-Aussage).
- **Export**: (a) SDK/API – `client.list_runs()` (Python), `listRuns()` (TS), REST `/runs/query`, mit Rate-Limits (≤7 Tage: 10 Req/10s; >7 Tage: 3 Req/10s; Volltextsuche enger) (Beleg: https://docs.langchain.com/langsmith/export-traces). (b) **Bulk Data Export** für große Volumina, Ziel: S3-kompatibler Bucket (AWS S3, GCS, MinIO, …), Format **Parquet**, Kompression zstandard (Cloud-Default)/gzip (Self-hosted-Default)/snappy/none, Hive-Partitionierung, Laufzeit-Limit 72h, Cloud: 250 Bulk-Exports/Stunde/Workspace, 250 Experimente/`all_experiments`-Export (Beleg: https://docs.langchain.com/langsmith/data-export). (c) Granular-Usage-Tab: "Export CSV to download the data for the active tab" (Beleg: https://docs.langchain.com/langsmith/granular-usage).

## 7. Cache-Tokens
Beleg: https://docs.langchain.com/langsmith/log-llm-trace, https://docs.langchain.com/langsmith/cost-tracking

`usage_metadata.input_token_details` enthält explizit **`cache_read`, `cache_creation`, `cache_read_over_200k`**, plus `ephemeral_5m_input_tokens`, `ephemeral_1h_input_tokens`, `audio`, `text`, `image`; `output_token_details` mit `reasoning`, `audio`, `text`, `image`. Diese Felder fließen direkt in die Kostenrechnung ein: "The cost for a run is computed greedily from most-to-least specific token type" – Cache-Read-Tokens werden separat zu ihrem eigenen Satz bepreist, der Rest zum regulären Input-Preis (mit Beispielrechnung in der Doku).

## 8. Ausreißer / Anomalien / Alerts

- P50/P99 (bzw. laut Changelog inzwischen auch P90/P95) für Latenz, TTFT, Tokens und Kosten sind als Custom-Chart-Aggregationen belegt (Punkt 3) sowie in der Threads-Tabelle (P50/P99-Latenz pro Thread).
- Sortierung/"teuerste Runs" explizit als Feature: **nicht direkt belegt** in den erreichten Seiten (kein Fund einer "Sort by cost"-Doku-Stelle).
- **Alerts** sind seit 2025 dokumentiert (Beleg: https://docs.langchain.com/langsmith/alerts, ergänzt durch Changelog):
  - Metriken: **Run Count, Cost, Errors (Anzahl/Rate, filterbar nach Status/Run-Type/Tags/Error-Type), Feedback Score, Latency**.
  - Konfiguration: Aggregationsmethode (Average/Percentage/Count), Vergleichsoperator (`>=`, `<=`), Schwellenwert, Aggregationsfenster (5 oder 15 Minuten), bei Feedback zusätzlich Feedback-Key. Historische Vorschau ("wie viele Datenpunkte hätten ausgelöst") vor Aktivierung.
  - Kanäle: native Integrationen **Slack** (Cloud), **PagerDuty** (Events API v2), **Dynatrace** (Events API v2); generische **Webhooks** mit Rezepten für Slack (Self-hosted), Microsoft Teams (Power Automate), E-Mail (SendGrid/Mailgun/Postmark), Google Chat; Webhooks unterstützen eigene Header/Auth/Body-Templates und LangSmith hängt automatisch 12 Metadatenfelder an (Alertname, Projekt, Metrikwert, Schwelle, Link zum Alert).
  - Scope: Alerts sind projekt-gebunden ("project-scoped, requiring separate configuration for each monitored project").

## 9. Geschätzte vs. abgerechnete Kosten – zwei getrennte Kostenbegriffe

**(a) Kosten der LLM-Aufrufe des Nutzers** (Beleg: https://docs.langchain.com/langsmith/cost-tracking):
- Berechnung: Tokens × **Model Price Map** ("model pricing table"), "greedy from most-to-least specific token type" (Cache-Tokens zuerst zu ihrem Satz, Rest regulär).
- Die Preistabelle ist **vorbefüllt UND editierbar**: "The table comes with pricing information for most OpenAI, Anthropic, and Gemini models. You can create a new model price entry or overwrite pricing for default models if you have custom pricing." – über UI-Button "+ Model".
- Matching über Metadaten `ls_provider` + `ls_model_name` (Regex-Pattern-Match).
- API-seitig ist die Price Map nur lesbar dokumentiert (`GET /api/v1/model-price-map`, kein POST/PUT/DELETE in der OpenAPI-Spec belegt) – Schreibzugriff läuft demnach über die UI, nicht über eine dokumentierte Schreib-API (Beleg: https://docs.langchain.com/langsmith/smith-api/model-price-map).
- Eine explizite Formulierung "dies ist nur eine Schätzung / kann von der tatsächlichen Rechnung abweichen" wurde in keiner gelesenen Seite gefunden → **nicht belegt** (die Doku präsentiert den Wert ohne Genauigkeits-Disclaimer, formuliert aber implizit Schätz-Charakter durch die "greedy"-Rechenmethode).

**(b) LangSmiths eigene Abrechnung** (Beleg: https://docs.langchain.com/langsmith/billing, https://docs.langchain.com/langsmith/usage-and-billing):
- Basiert auf **Trace-Volumen und Retention-Stufe**: "Base"-Traces (14 Tage Aufbewahrung, 0,05¢/Trace) vs. "Extended"-Traces (180 Tage, 0,50¢/Trace; ein Upgrade von Base auf Extended kostet zusätzlich 0,45¢). Freikontingente je Plan (z.B. 5.000 Traces/Monat Developer, 10.000 Plus) vor Overage.
- Für Deployments zusätzlich **LangChain Compute Units (LCU)** und **LangChain Storage Units (LSU)**.
- Explizit getrennt von (a): "LangSmith observes and logs these interactions but does not bill for them – users pay LLM providers directly." Die Kostenanzeige im Dashboard ist also reine **Beobachtung/Schätzung der Fremdkosten**, keine Rechnungsgrundlage von LangSmith selbst.
- **Granular Usage** (Settings > Billing and Usage > Granular Usage Tab, https://docs.langchain.com/langsmith/granular-usage) erlaubt Aufschlüsselung von (b) nach Workspace/Project/User/API-Key, mit CSV-Export – aber ausdrücklich NICHT nach Modell ("Per-model breakdowns are not mentioned").

## 10. BYOK (Bring Your Own Key)

Beleg: https://docs.langchain.com/langsmith/playground-model-providers – für den **Playground** ist BYOK explizit dokumentiert: Für jeden der 13+ unterstützten Provider verlangt die Doku ausdrücklich einen eigenen Nutzer-Key, z.B. "ensure you have an Anthropic API key", "ensure you have an OpenAI API key", "ensure you have a Google AI API key", "ensure you have a DeepSeek API key", "ensure you have Azure OpenAI credentials". Es gibt **keinen** Hinweis auf von LangSmith bereitgestellte Freikontingente/Shared Keys für Playground-Aufrufe – Nutzer hinterlegen ihren eigenen Provider-Key als Workspace-Secret, und dieser Key wird direkt beim Provider belastet, nicht bei LangSmith.
(Hinweis zur Begriffsverwechslung: "BYOC" bei LangSmith – https://docs.langchain.com/langsmith/byoc* – bedeutet "Bring Your Own Cloud" für Self-hosted-Deployments und ist ein anderes Konzept als BYOK; nicht mit BYOK verwechseln.)

Eine explizite UI-Kennzeichnung im Dashboard/Trace-Detail, "wessen Schlüssel bezahlt hat" bei automatisch getrackten (nicht im Playground ausgeführten) LLM-Calls, ist in der Doku **nicht belegt** – das ist plausibel, weil normale Traces von der Nutzeranwendung selbst mit deren eigenem Provider-Key erzeugt werden (Playground ist der einzige Ort, wo LangSmith selbst den Call ausführt, daher dort der explizite BYOK-Hinweis).

---

## Zusammenfassungszeile

Produkt | Kopfkacheln | Hauptdiagramm | Aufschlüsselungsachsen | Besonderheit | Quelle-URL
--- | --- | --- | --- | --- | ---
LangSmith | Prebuilt-Dashboard: Traces / LLM Calls / Cost & Tokens / Tools / Run Types / Feedback Scores | Line/Stacked-Bar/KPI/Ranked-Bar/Donut/Table, Zeitreihe mit konfigurierbarem "Stride" pro Chart | Run Name, Run Type, Tag, Project, Metadata, Feedback Label (Top 20) | Zwei getrennte Kostenbegriffe: editierbare Model-Price-Map (Tokens×Preis, cache_read/cache_creation separat bepreist) vs. LangSmiths eigene Trace-Abrechnung (Base/Extended Retention) – Playground ist explizit BYOK | https://docs.langchain.com/langsmith/dashboards , https://docs.langchain.com/langsmith/cost-tracking , https://docs.langchain.com/langsmith/billing , https://docs.langchain.com/langsmith/playground-model-providers

**Vollständige Quellenliste (alle per WebFetch mit HTTP 200 verifiziert):**
- https://docs.langchain.com/langsmith/dashboards
- https://docs.langchain.com/langsmith/observability-concepts
- https://docs.langchain.com/langsmith/usage-and-billing
- https://docs.langchain.com/langsmith/billing
- https://docs.langchain.com/langsmith/cost-tracking
- https://docs.langchain.com/langsmith/granular-usage
- https://docs.langchain.com/langsmith/trace-query-syntax
- https://docs.langchain.com/langsmith/filter-traces-in-application
- https://docs.langchain.com/langsmith/export-traces
- https://docs.langchain.com/langsmith/data-export
- https://docs.langchain.com/langsmith/log-llm-trace
- https://docs.langchain.com/langsmith/alerts
- https://docs.langchain.com/langsmith/rules
- https://docs.langchain.com/langsmith/threads
- https://docs.langchain.com/langsmith/administration-overview
- https://docs.langchain.com/langsmith/playground-model-providers
- https://docs.langchain.com/langsmith/managing-model-configurations
- https://docs.langchain.com/langsmith/smith-api/model-price-map
- https://docs.langchain.com/langsmith/changelog (redirect von changelog.langchain.com)
- https://docs.langchain.com/llms.txt