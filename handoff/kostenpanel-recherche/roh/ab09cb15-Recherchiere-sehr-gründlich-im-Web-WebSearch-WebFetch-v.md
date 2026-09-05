# AUFTRAG

Recherchiere sehr gründlich im Web (WebSearch + WebFetch, viele Quellen) die KOSTEN- und NUTZUNGS-DASHBOARDS dieser LLM-Observability-Produkte:

1. Helicone (helicone.ai) — Dashboard, Cost-Ansicht, "Requests"-Tabelle, Session/User-Achse
2. Langfuse (langfuse.com) — Dashboard, Metrics/Cost, Custom Dashboards, Traces-Tabelle
3. LangSmith (docs.smith.langchain.com) — Monitoring/Usage & Billing, Cost per trace, Charts-Seite
4. Braintrust (braintrust.dev) — Logs, Monitor-Tab, Cost-Spalten
5. Portkey (portkey.ai) — Analytics-Dashboard, Cost/Tokens, Metadata-Filter, Virtual Keys
6. Traceloop / OpenLLMetry (traceloop.com) — Dashboards
Optional falls Zeit: Langtrace, Phoenix/Arize, W&B Weave, Datadog LLM Observability, New Relic AI Monitoring.

Für JEDES Produkt will ich KONKRET wissen, belegt mit URLs (Doku-Seiten bevorzugt, Screenshots in Docs beschreiben):
- Welche KPI-Kacheln stehen oben (genaue Bezeichnungen, z.B. "Total Cost", "Total Requests", "Avg Latency", "Error Rate", "Tokens", "Cost per user")
- Welches HAUPTDIAGRAMM (Zeitreihe? gestapelte Balken? Linie? Flächen? Welche Granularität/Bucketing — Stunde/Tag?)
- Welche Aufschlüsselungsachsen gibt es (Modell, Anbieter/Provider, User/Endnutzer, API-Key, Environment/prod-vs-dev, Trace/Zweck, Tags/Metadata, Prompt-Version, Session)
- Welche Tabellen und welche SPALTEN darin
- Interaktionen: Zeitraumwahl (welche Presets), Vergleich zur Vorperiode, Hover-Tooltip-Inhalt, Drill-down von Chart in Tabelle, Filter-Syntax, Export (CSV/AP

---

Recherche abgeschlossen. Kurzfassung ist an den anfragenden Strang raus, hier der Vollbericht.

---

# LLM-Observability: Kosten- und Nutzungs-Dashboards

**Methodik:** Das WebSearch-Budget der Session war nach den ersten Läufen erschöpft, daher lief die Recherche überwiegend über direkte Doku-Abrufe (`llms.txt`-Indizes, `.md`-Exporte der Doku-Sites) und — wo die Produkte quelloffen sind — über den **Frontend-Quelltext auf GitHub**. Das ist die belastbarste Quelle: Kachelbeschriftungen stehen dort als `label=`/`title=`-Props, nicht als Marketing-Behauptung.

---

## 1. Helicone

**Kopfkacheln.** Zwei Ebenen. Obere Reihe: vier `MetricsPanel`-Kacheln mit den Labels **"Avg Cost / Req"**, **"Avg Prompt Tokens / Req"**, **"Avg Completion Tokens / Req"**, **"Avg Total Tokens / Req"**. Darunter Chart-Panels mit eigenem Titel plus großer Zahl: **"Requests"**, **"Costs"**, **"Users"**, **"Latency"**, **"Time to First Token"**, **"Threats"**, **"Quantiles"**, **"Prompt / min"**, **"Completion / min"**, **"Total / min"**.
Es gibt **keine** Kachel "Total Cost" und **keine** Kachel "Error Rate" im Hauptdashboard — Fehler laufen als Serie im gestapelten Requests-Chart. "Total Cost" existiert wortwörtlich nur als Spaltenkopf der Users-Tabelle.
Beleg: [`web/components/templates/dashboard/dashboardPage.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/dashboardPage.tsx)

**Hauptdiagramm.** Gemischt (recharts): AreaChart mit Gradient für Requests (Success/Error gestapelt), Latency, TTFT, Threats, Tokens/min, Quantiles — BarChart für Costs und Users.
Bucketing **automatisch, nicht wählbar**, exakt im Code: `< 6 h → "min"`, `< 3 Tage → "hour"`, sonst `"day"`. Beleg: [`web/lib/timeCalculations/time.ts`](https://github.com/Helicone/helicone/blob/main/web/lib/timeCalculations/time.ts)

**Aufschlüsselungsachsen.** Als Balkenlisten-Panels: Modelle zweifach getrennt (`ModelsPanel` "Top Models by Requests" und `ModelsByCostPanel` "Top Models by Cost"), Provider (`TopProvidersPanel`), Land (`CountryPanel`), Scores. Als Filter: API-Key (Dropdown "API Key: All / <key_name>"). Eigene Seiten: User, Sessions, Custom Properties.
Filterbare Felder der ClickHouse-Tabelle `request_response_rmt`: `model, provider, user_id, cache_enabled, cached, cache_reference_id, prompt_id, prompt_version, properties, scores, country_code, is_passthrough_billing, threat, latency, cost`.
**Environment ist keine First-Class-Achse** — nur als Custom Property `Helicone-Property-Environment`. **Prompt-Version** existiert als Filterfeld, hat aber keine eigene UI-Kachel → für eine dedizierte Ansicht *nicht belegt*.
Beleg: [Filter-AST-Doku](https://docs.helicone.ai/rest/request/post-v1requestquery), [`panels/modelsByCostPanel.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/panels/modelsByCostPanel.tsx)

**Tabellen und Spalten.**
- *Requests* (alle standardmäßig aktiv, per Toggle abwählbar, in `localStorage` persistiert): Created At, Status, Provider, Request, Response, Model, Total Tokens, Prompt Tokens, Completion Tokens, Reasoning Tokens, Latency, TFFT, User, Cost, Feedback, Prompt ID, Country, **Prompt Cache Read Tokens**, **Prompt Cache Write Tokens**, **Cache Enabled**. Custom Properties werden dynamisch als Spalten mit Kategorie `"Custom Property"` angehängt. Beleg: [`requests/initialColumns.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/requests/initialColumns.tsx)
- *Users*: User ID, **Total Cost**, Active For, First Active, Last Active, Requests, Avg Reqs / Day, Avg Tokens / Req, Completion Tokens, Prompt Tokens, Rate Limited Count → Kosten pro Nutzer sind explizit vorhanden und nach `cost` sortierbar.
- *Sessions*: session_name, session_id, created_at, latest_request_created_at, total_cost, prompt_tokens, completion_tokens, total_tokens, total_requests, avg_latency, user_ids. Dazu drei Histogramme "Requests count distribution", "Cost distribution", "Duration distribution" mit wählbarem Perzentil (p50/p75/p95/p99/p99.9).
- *Custom-Property-Detailseite*: genau vier Panels — "Cost Over Time", "Top Costs", "Requests Over Time", "Top Requests".

**Interaktionen.** Zeitraum-Presets: **1h, 3h, 12h, 1d, 3d, 7d, 30d, 90d, 1y** plus Kalender-Range und relative Freieingabe. Bemerkenswert: **Zeiträume > 31 Tage sind hinter einem Pro-Feature-Gate**, der Klick öffnet einen Upgrade-Dialog statt der Daten. Beleg: [`themedTimeFilterShadCN.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/shared/themed/themedTimeFilterShadCN.tsx)
Tooltip: Zeitstempel-Label, darunter je Serie Farbpunkt + Name + `toLocaleString()`-Wert.
Filter-AST: `{left, operator: "and"|"or", right}`, Operatoren typabhängig (`equals/not-equals/like/ilike/contains/not-contains` für Text, `gte/lte/lt/gt` für Zahlen).
Export: **Excel `.xlsx`, nicht CSV** — Dateiname `helicone-dashboard-<start>-to-<end>.xlsx`, Dialogtext nennt "separate tabs for metrics, costs, requests, and more".
**Vergleich zur Vorperiode: nicht vorhanden** — kein `previous`/`delta`/`%change` im Dashboard-Code.
**Drill-down Chart → Tabelle: nicht belegt.** Balkenlisten haben nur einen Expand-Button, der ein In-Page-Modal öffnet. Der Filterzustand liegt allerdings in einem app-weiten Store, bleibt beim Seitenwechsel also erhalten.

**Cache.** Eigene Cache-Seite mit drei KPI-Kacheln: **"Total Cache Hits"**, **"Cost Savings"**, **"Time Saved"**, plus separater **Cache-Hit-Rate** in Prozent (grün ab > 10 %) und einer Latenzreduktions-Kennzahl. Dazu "Top Requests" der meistgecachten Aufrufe. Per Request: Header `Helicone-Cache: HIT|MISS`. Beleg: [`cache/cachePage.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/cache/cachePage.tsx), Doku-Screenshot [`caching.mdx`](https://github.com/Helicone/helicone/blob/main/docs/features/advanced-usage/caching.mdx)

**Ausreißer.** Panel "Quantiles" als gestapelter AreaChart über **P75/P90/P95/P99**, Metrik umschaltbar (Latency / Prompt / Completion / Total Tokens), Kopfzeile zeigt `Max:`. Sortierung nach `cost` in Requests- und Users-Tabelle.
Alerts (`Settings → Alerts`) auf: Error Rate, Cost, Latency, Total/Prompt/Completion Tokens, Prompt Cache Read/Write Tokens, Count. Perzentil-Aggregation 50./75./90./95./99./99,9., Fenster 5/10/15/30 min, 1 h, 1 d, 1 w, 1 Monat, Kanäle E-Mail und Slack. Beleg: [`alerts/alertForm.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/alerts/alertForm.tsx)

**Geschätzt vs. abgerechnet.** Explizit als Schätzung deklariert: die Doku sagt, Helicone *schätze* die Kosten anhand des im Response-Body zurückgegebenen Modells über Preistabellen, und stellt ausdrücklich einen Vorbehalt voran, dass Methodik und Token-Zählung sich ändern können. Zwei Genauigkeitsstufen im `packages/cost`: **AI Gateway** = "complete visibility into model usage", **direkte Provider-Integration** = "best-effort cost estimates based on model detection and token counts" für 300+ Modelle. Beleg: [`docs/references/how-we-calculate-cost.mdx`](https://github.com/Helicone/helicone/blob/main/docs/references/how-we-calculate-cost.mdx)

**BYOK.** Im Gateway existiert eine explizite Prioritätenordnung: `// Priority 1: BYOK` > Helicone-hosted (2) > Direktanbieter (3), plus die Unterscheidung BYOK vs. PTB (Pass-Through Billing), wobei BYOK immer Vorrang hat. Die Datenbank führt `is_passthrough_billing`, per API filterbar. **Im UI aber nicht belegt** — die Provider-Pille zeigt nur den Providernamen, kein BYOK/PTB-Badge. Beleg: [`docs/references/provider-integration.mdx`](https://github.com/Helicone/helicone/blob/main/docs/references/provider-integration.mdx)

---

## 2. Langfuse

Das am besten belegbare Produkt, weil das Home-Dashboard selbst ein Datenobjekt im Quelltext ist.

**Kopfkacheln.** Seit v4 ist das Home-Dashboard das Objekt `LANGFUSE_HOME_DASHBOARD` (id `langfuse-home-dashboard`) aus 12 Presets. Angezeigte Titel:
**"Traces"** · **"Model costs"** · **"Scores"** (Tabelle) · Zeitreihe Traces+Observations · **"Model Usage"** · **"User consumption"** · **"Scores"** (Zeitreihe) · **"Trace latency percentiles"** · **"Generation latency percentiles"** · **"Observation latency percentiles"** · **"Model latencies"** · **"Scores Analytics"**.
Beleg: [`packages/shared/src/domain/home-dashboard.ts`](https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/src/domain/home-dashboard.ts). Die v3→v4-Änderung (aus "Traces by time" wurde "Observations by time") bestätigt [langfuse.com/faq/all/dashboard-changes-in-v4](https://langfuse.com/faq/all/dashboard-changes-in-v4).

Dazu **vier mitgelieferte kuratierte Dashboards** (36 Widgets, Seed-JSON): **"Langfuse Latency Dashboard"**, **"Langfuse Usage Management"**, **"Langfuse Cost Dashboard"** ("Review your LLM costs."), **"Langfuse Agent Dashboard"**. Beleg: [`worker/src/constants/langfuse-dashboards.json`](https://raw.githubusercontent.com/langfuse/langfuse/main/worker/src/constants/langfuse-dashboards.json)

**Hauptdiagramm.** Enum `DashboardWidgetChartType`: `LINE_TIME_SERIES`, `AREA_TIME_SERIES`, `BAR_TIME_SERIES`, `HORIZONTAL_BAR`, `VERTICAL_BAR`, `PIE`, `NUMBER`, `HISTOGRAM`, `PIVOT_TABLE`.
Granularität: `auto, minute, hour, day, week, month` plus zehn feinere Monitor-Fenster (`5m…1w`). Kommentar im Code: *auto* zielt auf **rund 50 Buckets** für den gewählten Zeitraum. Die Presets tragen ein festes `dateTrunc`: "Past 1 day" → hour, "Past 30 days" → day, "Past 90 days" → week, "Past 1 year" → month.
Belege: [`prisma/schema.prisma`](https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/prisma/schema.prisma), [`features/query/types.ts`](https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/src/features/query/types.ts), [`utils/dateRanges.ts`](https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/src/utils/dateRanges.ts)

**Custom Dashboards (Views/Measures/Dimensionen).** Views: `traces`, `observations`, `scores-numeric`, `scores-categorical`, `scores-boolean`.
Measures *observations*: `count, latency, streamingLatency, inputTokens, outputTokens, totalTokens, outputTokensPerSecond, tokensPerSecond, inputCost, outputCost, totalCost, timeToFirstToken, countScores, toolDefinitions, toolCalls, toolCallInvocations`.
Measures *traces*: `count, observationsCount, scoresCount, uniqueUserIds, uniqueSessionIds, latency, totalTokens, totalCost`.
Aggregationen: `sum, avg, count, max, min, p50, p75, p90, p95, p99, histogram, uniq`.
Beleg: [`features/query/dataModel.ts`](https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/src/features/query/dataModel.ts)

**Aufschlüsselungsachsen.** Alle als Dimensionen deklariert: `providedModelName` (Modell), `userId`, `sessionId`, `tags`, `environment`, `release`/`traceRelease`, `version`/`traceVersion`, `promptName`, `promptVersion`, `traceName`, `type`, `level`, `toolNames`, `calledToolNames`.
**Provider als eigene Achse: nicht belegt** — nur der konkrete Modellname.

**Tabellen und Spalten.**
- *Traces*: Timestamp, Name, Input, Output, Observation Levels, Latency, Tokens, Total Cost, Environment, Tags, Metadata, Scores, Session, User, Observations, Status, Version, Release, Trace ID, Cost (Untergruppe Input/Output Cost), Usage (Input/Output/Total Tokens), Action.
- *Observations*: Start Time, Type, Name, Input, Output, Status, Status Message, Latency, Total Cost, Available Tools, Tool Calls, Time to First Token, Tokens, Model, Prompt, Environment, Trace Tags, Metadata, Scores, End Time, ObservationID, Trace Name, Trace ID, Model ID, Version, Usage, Cost.
- *Sessions*: ID, Created At, Duration, Environment, Scores, User IDs, Traces, Input/Output/Total Cost, Input/Output/Total Tokens, Usage, Trace Tags.
- *Users*: User ID, Environment, First Event, Last Event, Total Events, Total Tokens, **Total Cost**.

**Interaktionen.** Presets Dashboard: "Past 5 min / 30 min / 1 hour / 3 hours / 1 day / 7 days / 30 days / 90 days / 1 year" + Custom; Tabellen zusätzlich "Past 6 hours / 3 days / 14 days" und "All time".
Filter-Operatoren nach Typ: `datetime [>,<,>=,<=]`, `string [=, contains, does not contain, starts with, ends with, is not empty]`, `stringOptions [any of, none of]`, `arrayOptions [any of, none of, all of]`, `number [=,>,<,>=,<=]`, `boolean [=,<>]`, `null [is null, is not null]`.
Export: CSV der Chartdaten (`downloadChartDataCsv.ts`); Metrics-API `/api/public/metrics` (v1, deprecated) und `/api/public/v2/metrics` mit `view`, `dimensions[]`, `metrics[]`, `filters[]`, `timeDimension.granularity`.
Daily-Metrics-API `/api/public/metrics/daily` (legacy, Cloud bis 2026-11-16): pro Tag `date, countTraces, countObservations, totalCost` und darin `usage[]` je Modell mit `inputUsage, outputUsage, totalUsage, countTraces, countObservations, totalCost`. Beleg: [langfuse.com/docs/analytics/daily-metrics-api](https://langfuse.com/docs/analytics/daily-metrics-api)
**Vergleich zur Vorperiode: nicht belegt** (kein Treffer im Quelltext).

**Cache — wichtigste Negativfindung des ganzen Berichts.** Die Feldnamen existieren (`cache_read_input_tokens`, `input_cached_tokens`, `prompt_tokens_details.cached_tokens`), und die Doku betont, dass `usage_details`-Keys sich gegenseitig ausschließen. **Aber:** die Dashboard-Kennzahl "Input Tokens" summiert per SQL *alle* `usage_details`-Keys, deren Name den Substring `"input"` enthält (`positionCaseInsensitive(x.1, 'input') > 0`). Cache-Read-Tokens landen damit **ununterscheidbar** in der Input-Token-Summe. Es gibt keine Standardkachel "davon gecacht"; eine Cache-Quote braucht eine eigene Query gegen die rohe `usage_details`-Map.
Belege: [token-and-cost-tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking), `dataModel.ts` (Measure `inputTokens`).

**Ausreißer.** Die drei Perzentiltabellen zeigen **p50, p90, p95, p99** (kein p75 im UI, obwohl als Aggregation vorhanden), Standardsortierung **absteigend nach p95**. Ranking-Widgets im Cost-Dashboard: "Top 20 Users by Cost", "Top 20 Use Cases by Cost".
Alerts: eigenes Feature **"Monitors"** (`packages/shared/src/features/monitors/`) — Schwellwert auf eine Metrik-Query, Fenster 5m/10m/15m/30m/1h/2h/4h/1d/2d/1w, Severity, Slack. Davon getrennt der **"Cloud Spend Alert"** (Billing-Schwelle, E-Mail).

**Geschätzt vs. gemeldet.** Die sauberste Trennung im Feld: **ingested** (vom SDK/Anbieter geliefert) vs. **inferred** (Token × Preistabelle des Modells), mit dokumentierter Präzedenz — *ingested schlägt inferred*. Nutzerdefinierte Modellpreise schlagen Langfuse-Defaults; Preisstaffeln nach Token-Schwelle (> 200 K) oder `service_tier` sind möglich. Grenze wird explizit benannt: für Reasoning-Modelle ohne gelieferte Tokenzahlen ist keine Inferenz möglich.

**BYOK.** Das Feature "LLM API Keys"/"LLM Connections" existiert (Playground, LLM-as-a-Judge). Eine Anzeige, welcher Key eine konkrete Generation bezahlt hat, ist **nicht belegt** — begründete Negativfeststellung nach Durchsicht von Quelltext und Kostendoku.

---

## 3. LangSmith

*Hinweis: `docs.smith.langchain.com` und `changelog.langchain.com` leiten inzwischen auf `docs.langchain.com/langsmith/*` um.*

**Kopfkacheln.** Jedes Tracing-Projekt bekommt automatisch ein **Prebuilt Dashboard** mit sechs Sektionen: **Traces** ("Trace count, latency and error rates") · **LLM Calls** (Count/Latency für `run_type=llm`) · **Cost & Tokens** · **Tools** (Top 5) · **Run Types** (unmittelbare Kinder des Root-Runs, Top 5) · **Feedback Scores**.
Einzel-Kachelbeschriftungen innerhalb dieser Sektionen (etwa "Trace Success Rate" oder "First Token Latency") sind **nicht belegt** — die Doku beschreibt nur den Sektionsinhalt. Beleg: [docs.langchain.com/langsmith/dashboards](https://docs.langchain.com/langsmith/dashboards)

**Hauptdiagramm.** Chart-Typen: **Line, Stacked Bar, KPI, Ranked Bar, Donut, Table**. Zeitraum wird **einmal oben am Dashboard** gesetzt und gilt für alle Charts, *außer* ein Chart überschreibt seine eigene Bucket-Größe ("stride"). Der Changelog bestätigt das Stride-Konzept und dass Zeitreihen bei fehlenden Daten **Lücken statt Nullen** zeichnen.
Konkrete Preset-Werte für Zeitraum und Stride sind in Textform **nicht belegt** (vermutlich nur im UI-Dropdown). Für die Granular-Usage-Tabelle dagegen belegt: "7 days to 1 year or custom".

**Custom Charts.** Metriken: Count · Latency (Average, P50, P90, P95, P99) · Time to first token (Average, Percentile) · Tokens (total/input/output, Sum/Average/Percentile) · Cost (total/input/output, laut Changelog inkl. P50/P99 für Input/Output-Kosten) · Feedback score (Average/Min/Max) · **Ratio** (frei konfigurierbarer Zähler/Nenner, z. B. für Fehlerraten).
Einschränkung wörtlich: "Group by and multi-metric are mutually exclusive on a single chart."

**Aufschlüsselungsachsen.** **Run Name, Run Type, Tag, Project, Metadata, Feedback Label** (Top 20 nach Häufigkeit). Filter-Scopes: Run-level, Trace-level (Root-Run), Tree-level.
**"Modell" ist keine eigene Achse** — nur indirekt über Metadata (`ls_model_name`).

**Tabellen und Spalten.** Ein vollständiger Default-Spaltenkatalog der Runs-Tabelle ist **nicht belegt** (mehrere Doku-Seiten geprüft). Belegbar ist der Datenumfang über die Bulk-Export-Felder: `id, name, run_type, start_time, end_time, status, inputs, outputs, error, extra, events, tenant_id, session_id, trace_id, parent_run_id, tags, feedback_stats, total_tokens, prompt_tokens, completion_tokens, total_cost, prompt_cost, completion_cost`.
*Threads*-Ansicht dagegen belegt: First input, Last output, Start time, Turn count, **Latency (P50/P99)**, Token usage, Cost, Feedback score — mit drei Modi (Messages/Turns/Details). Beleg: [threads](https://docs.langchain.com/langsmith/threads)

**Interaktionen.** Filter-DSL mit `eq(), neq(), gt(), gte(), lt(), lte(), has(), search(), in()` und `and()/or()`, z. B. `and(eq(is_root, true), and(eq(feedback_key, "user_score"), eq(feedback_score, 1)))`. Beleg: [trace-query-syntax](https://docs.langchain.com/langsmith/trace-query-syntax)
Export dreistufig: (a) SDK/API `list_runs()` bzw. `POST /runs/query` mit Rate-Limits (≤ 7 Tage: 10 Req/10 s; > 7 Tage: 3 Req/10 s); (b) **Bulk Data Export** nach S3-kompatiblem Bucket im **Parquet**-Format, zstd/gzip/snappy, Hive-Partitionierung, 72-h-Limit, 250 Exports/Stunde/Workspace; (c) CSV-Export im Granular-Usage-Tab. Belege: [export-traces](https://docs.langchain.com/langsmith/export-traces), [data-export](https://docs.langchain.com/langsmith/data-export)
**Vergleich zur Vorperiode: nicht belegt. Drill-down Chart → Tabelle: nicht belegt.** Tooltips existieren (Changelog: "tooltips and axes now show up to eight fractional digits"), ihr Inhalt ist nicht beschrieben.

**Cache.** `usage_metadata.input_token_details` mit **`cache_read`, `cache_creation`, `cache_read_over_200k`**, `ephemeral_5m_input_tokens`, `ephemeral_1h_input_tokens`, dazu `output_token_details` mit `reasoning`. Diese fließen direkt in die Kostenrechnung: *"The cost for a run is computed greedily from most-to-least specific token type"* — Cache-Reads werden zu ihrem eigenen Satz bepreist, der Rest regulär. Beleg: [cost-tracking](https://docs.langchain.com/langsmith/cost-tracking)

**Ausreißer.** P50/P90/P95/P99 für Latenz, TTFT, Tokens **und Kosten** als Chart-Aggregationen; P50/P99 auch je Thread. "Sortierung nach Kosten" als Feature: **nicht belegt**.
Alerts (projekt-gebunden): Metriken **Run Count, Cost, Errors** (Anzahl/Rate, filterbar nach Status/Run-Type/Tags/Error-Type), **Feedback Score, Latency**; Aggregation Average/Percentage/Count, Operator `>=`/`<=`, Fenster **5 oder 15 Minuten**; **historische Vorschau** vor Aktivierung ("wie viele Datenpunkte hätten ausgelöst"). Kanäle: Slack (Cloud), PagerDuty, Dynatrace, generische Webhooks mit 12 automatisch angehängten Metadatenfeldern. Beleg: [alerts](https://docs.langchain.com/langsmith/alerts)

**Zwei Kostenbegriffe — sauber trennen.**
(a) *Fremdkosten der LLM-Aufrufe*: Tokens × **Model Price Map**, vorbefüllt für die meisten OpenAI-, Anthropic- und Gemini-Modelle und **editierbar** ("create a new model price entry or overwrite pricing for default models if you have custom pricing"), Matching über `ls_provider` + `ls_model_name`. Schreib-API ist nicht dokumentiert (nur `GET /api/v1/model-price-map`) → Pflege läuft über die UI. Ein expliziter Disclaimer "nur eine Schätzung" wurde **nicht gefunden**.
(b) *LangSmiths eigene Abrechnung*: nach Trace-Volumen und Retention — "Base" (14 Tage, 0,05 ¢/Trace) vs. "Extended" (180 Tage, 0,50 ¢/Trace, Upgrade + 0,45 ¢), plus LCU/LSU für Deployments. Wörtlich: *"LangSmith observes and logs these interactions but does not bill for them – users pay LLM providers directly."* Der Granular-Usage-Tab schlüsselt (b) nach Workspace/Project/User/API-Key auf, **nicht nach Modell**. Belege: [billing](https://docs.langchain.com/langsmith/billing), [granular-usage](https://docs.langchain.com/langsmith/granular-usage)

**BYOK.** Nur für den Playground explizit dokumentiert — für jeden der 13+ Provider verlangt die Doku einen eigenen Nutzer-Key, hinterlegt als Workspace-Secret, ohne Freikontingent. Eine UI-Kennzeichnung "wessen Schlüssel zahlt" bei normal getracten Calls ist **nicht belegt** (plausibel, da die Anwendung des Nutzers den Call selbst macht). Achtung Begriffsfalle: "BYOC" bei LangSmith heißt *Bring Your Own Cloud* und ist etwas anderes.

---

## 4. Braintrust

**Kopfkacheln — die schwächste Beleglage der sechs.** Es gibt **keinen fixen Kachelsatz**. Der Changelog (August 2026) sagt: *"Monitoring views are now dashboards, with a dedicated page per dashboard and a project-scoped list to browse, search, and star them."* Genau **ein eingebautes Dashboard** ist namentlich belegt: **"Cost and quality"** (klonbar). Alles andere baut man selbst.
Verfolgbare Metriken laut Doku: "request counts, latency, token usage, costs, scores, topics, and custom metrics over time". **Chart-Typen, Aggregationsliste und Zeitraum-Presets des Dashboards sind nicht enumeriert** — die Doku sagt nur, man könne "from preset timeframes" wählen, ohne sie zu nennen. Belege: [guides/monitor](https://www.braintrust.dev/docs/guides/monitor), [reference/changelog](https://www.braintrust.dev/docs/reference/changelog)
API-seitig belegt: eine Monitoring-View ist `view_type: "monitor"` mit `view_data.custom_charts = {charts, layout}`, anlegbar über `POST /v1/view`. Beleg: [kb/create-a-blank-monitoring-view-via-api](https://braintrust.dev/docs/kb/create-a-blank-monitoring-view-via-api.md)

**Custom Measures.** Über einen `</>`-Button wechselt der Chart-Editor in BTQL-Eingabe, z. B. `percentile(metrics.my_custom_metric, 0.95)` — **damit sind Perzentile belegt**. Das Standard-Dropdown zeigt nur Scores und Metriken, die im gewählten Zeitfenster tatsächlich existieren. Group-by über Metadatenfelder. Beleg: [kb/add-custom-measures-to-monitoring-charts](https://braintrust.dev/docs/kb/add-custom-measures-to-monitoring-charts.md)

**Logs-Tabelle.** Jede Zeile = ein Trace mit seinem Root-Span. Die **Default-Spaltenliste ist nicht dokumentiert**; belegt sind: die Spalte **"Estimated cost"**, Custom Columns aus "inferred fields" oder SQL-Ausdrücken (`metadata.user_id`, `concat(metadata.plan, ' / ', metadata.region)`), Gruppierung nach Metadatenfeld/Tag/Klassifikation, gespeicherte Views, Download als **CSV oder JSON**, sowie `bt view logs` / `bt sync pull` im Terminal.
**Zeitraum-Presets belegt: "Live tail", "1 hour", "7 days".** Beleg: [guides/logs/view](https://www.braintrust.dev/docs/guides/logs/view)

**Span-/Metrikfelder.** `metrics.prompt_tokens`, `metrics.completion_tokens`, `metrics.prompt_cached_tokens`, `metrics.prompt_cache_creation_tokens`, `metrics.estimated_cost`, plus die SQL-Funktion `estimated_cost()` und `summary.estimated_cost` auf Projektebene.

**Filter/Query.** BTQL, pipe-artig: `select: input, output, score` · `filter: score > 0.8 AND tags INCLUDES 'production'` · `dimensions: model, environment` · `measures: count(), sum(tokens), avg(cost)` · `sort: score desc` · `limit:` · `sample: n%`. API: `POST https://api.braintrust.dev/btql`. Neuerdings wird für neue Abfragen SQL empfohlen, mit `project_logs('<id>', shape => 'spans'|'traces'|'summary')` und Mehrprojekt-Abfrage `project_logs('a','b','c')`. Beleg: [reference/btql](https://www.braintrust.dev/docs/reference/btql)
Dokumentierte Falle: Nutzer-/Prompt-Metadaten liegen auf Root-Spans, Token-Metriken auf LLM-Spans — *"A single span row cannot see both."* Lösung über zweistufiges GROUP BY mit `any_value()`; Cross-Span-JOINs sind nicht unterstützt. Und: `SUM(estimated_cost())` immer auf Span-Ebene, nie vorberechnete Kostenmetriken außen aggregieren. Beleg: [kb/query-token-distribution-by-user-or-prompt-with-sql](https://braintrust.dev/docs/kb/query-token-distribution-by-user-or-prompt-with-sql.md)

**Cache — mit dokumentierter Stolperstelle.** Normalisierte Metriken: `prompt_cached_tokens` (Reads), `prompt_cache_creation_tokens` (Writes). Die UI rechnet **Cache-Hit-Rate = `prompt_cached_tokens / prompt_tokens`**; fehlt die Metrik, gilt sie als null. **Roh geloggte Anbieterfelder `cache_read_input_tokens` / `cache_creation_input_tokens` füllen die normalisierten Metriken NICHT automatisch** — dann steht die Rate stumm auf 0. Beleg: [kb/ui-cache-hit-rate-shows-zero-with-raw-metrics](https://braintrust.dev/docs/kb/ui-cache-hit-rate-shows-zero-with-raw-metrics.md)
Proxy-Ebene: Header `x-bt-cached: HIT|MISS`, dazu `Age` und `Cache-Control: max-age`.

**Ausreißer / Alerts.** Zwei Typen: **"Log alerts"** (bewerten einzelne Zeilen) und **"Time window"** (skalare SQL-Berechnung über ein Fenster gegen einen Schwellwert), z. B. `AVG(scores."Feed Density")`. Erwähnte Ziele: Slack, PagerDuty, E-Mail — laut Doku als externe Ziele, nicht als native Kanäle. Alerts lassen sich pausieren statt löschen. Eine erschöpfende Liste erlaubter Aggregationen ist **nicht dokumentiert**. Beleg: [kb/alerting-on-scorer-errors-and-aggregated-scores](https://braintrust.dev/docs/kb/alerting-on-scorer-errors-and-aggregated-scores.md)

**Geschätzt vs. gemeldet.** Das Feld heißt schon so: **`metrics.estimated_cost`**, die Spalte **"Estimated cost"**. Zwei Pfade: explizit geloggte Werte werden *as-is* im Trace-Viewer verwendet; fehlt der Wert, greift ein **Fallback auf die Model Registry** (Tokens × registrierte Preise). Eigene Preise: *Configuration → AI providers → Custom providers* mit "Input cost per million tokens", "Output cost per million tokens" und **"Cache read/write costs (if using prompt caching)"**; `metadata.model` muss zum registrierten Namen passen.
Dokumentierte Falle: Sind Provider nur auf **Projekt**ebene konfiguriert (statt Organisationsebene), bleibt die Root-Span-Kostenmetrik leer und die Spalte zeigt Striche, obwohl Child-Spans Kosten haben. Und: die eingebauten Kostenansichten schließen **Scorer-Spans bewusst aus** — die Kosten der Bewertungs-LLM-Aufrufe tauchen also nicht auf, dafür braucht es eine eigene Abfrage auf `span_attributes.purpose = 'scorer'`.
Belege: [kb/configure-custom-model-costs-for-estimation](https://braintrust.dev/docs/kb/configure-custom-model-costs-for-estimation.md), [kb/estimated-cost-missing-in-logs-table-with-project-level-providers](https://braintrust.dev/docs/kb/estimated-cost-missing-in-logs-table-with-project-level-providers.md), [kb/query-scorer-span-token-costs-with-sql](https://braintrust.dev/docs/kb/query-scorer-span-token-costs-with-sql.md)

**BYOK.** Der AI Proxy funktioniert *"without a Braintrust account by providing your API key from any supported provider"* oder alternativ mit einem einzigen Braintrust-Key für alle Provider. Welcher Provider einen Request bedient hat, verrät der Header **`x-bt-used-endpoint`**; Logging aktiviert man über `x-bt-parent`. Eine Kostenzuordnung "wessen Schlüssel zahlt" im Dashboard ist **nicht belegt**. Beleg: [guides/proxy](https://www.braintrust.dev/docs/guides/proxy)

---

## 5. Portkey

**Kopfkacheln.** Overview als *"70,000ft view"* mit **Cost, Tokens used, Mean latency, Requests, Users, Top models**.
Charts-Tabs: **Users** (End-Nutzer über `user`-Parameter bzw. `_user`-Metadata) · **Errors** (Fehlerraten + "requests rescued by Portkey") · **Cache** (Latenz- und Kostenersparnis) · **Feedback** · **Summary** ("Group your request data by any dimension — AI Service, model, metadata key, and more"). Beleg: [product/observability/analytics](https://portkey.ai/docs/product/observability/analytics)
Summary-Aggregatspalten je Gruppe: **Total requests, Total cost, Average latency, Success rate, Average tokens, Last seen.**

**Hauptdiagramm.** Der belastbarste Beleg ist die Analytics-API, die die Dashboard-Charts eins zu eins spiegelt: `/analytics/graphs/` mit **cost, tokens, requests, requests-per-user, latency, errors, error-rate, rescued-requests, status-code, unique-status-code, users, cache-hit-rate, cache-hit-latency, feedback, feedback-per-ai-models, feedback-score-distribution, weighted-feedback**.
Response von `/analytics/graphs/cost`: `summary {total, avg}` plus `data_points[{timestamp, total, avg}]`, Kosten **in Cent**. **Ein Granularitäts-/Bucket-Parameter ist nicht dokumentiert** — Bucketing wird offenbar serverseitig aus dem Zeitraum abgeleitet. Beleg: [get-cost-data](https://portkey.ai/docs/api-reference/admin-api/control-plane/analytics/graphs-time-series-data/get-cost-data.md)
Gruppen-APIs: `/analytics/groups/{users, models, providers, metadata}` — z. B. liefert `/analytics/groups/users` je Nutzer `user, requests, cost`.

**Aufschlüsselungsachsen (Filterliste, vollständig belegt).** Model Used, Cost, Tokens, Status, **Meta** (Metadata), Avg Weighted Feedback, **Provider**, **Config**, **Trace ID**, Time Range, **API Key**, **Prompt ID**, **Cache Status**, **Workspace**, Saved Filters. Beleg: [product/observability/filters](https://portkey.ai/docs/product/observability/filters)
Besonderheit **`_user`**: ein OpenAI-`user`-Feld im Request wird automatisch auf `_user` gemappt (explizites `_user` hat Vorrang); *"Powers user-level analytics in the Portkey dashboard."* Metadata-Werte müssen Strings sein, max. **128 Zeichen**; Erzwingung auf Request-, API-Key- oder Workspace-Ebene möglich (Enterprise). Beleg: [product/observability/metadata](https://portkey.ai/docs/product/observability/metadata)
**Zeitraum-Presets: nicht belegt** — die Doku nennt nur "Time Range" allgemein.

**Logs-Tabelle.** Belegte Spalten: **Timestamp, Request type, LLM used, Tokens generated, Thinking tokens, Cost, Status**; bei multimodalen Modellen zusätzlich gesendete und generierte Bilder. Die Status-Spalte kodiert vier Mechanismen gleichzeitig:

| Mechanismus | inaktiv | aktive Zustände |
|---|---|---|
| Cache | Cache Disabled | Cache Miss, Cache Refreshed, **Cache Hit**, **Cache Semantic Hit** |
| Retry | Retry Not Triggered | Retry Success on {x} Tries, Retry Failed |
| Fallback | Fallback Disabled | Fallback Active |
| Loadbalance | Loadbalancer Disabled | Loadbalancer Active |

Detailansicht: vollständige Roh-Request-/Response-Objekte, Config- bzw. Prompt-IDs, manuelles Feedback, **Replay-Button**. Beleg: [product/observability/logs](https://portkey.ai/docs/product/observability/logs)

**Export.** **JSONL**, nicht CSV. 15 exportierbare Felder: ID, Trace ID, Created At, Request, Response, AI Provider, AI Model, Request Tokens, Response Tokens, Total Tokens, Cost, Cost Currency, Response Time, Status Code, Config, Prompt Slug, Metadata. Admins können Felder über `deniedFields` sperren. Job-basiert: `POST /v1/logs/exports` → `/start` → `GET /{id}` → `/download`; **max. 50 000 Logs pro Job**, API-Key braucht Scope `logs.export`. Beleg: [product/observability/logs-export](https://portkey.ai/docs/product/observability/logs-export)

**Cache.** Analytics-Tab "Cache" mit **"Cache hit rate"**, **"Latency savings"**, **"Cost savings"**; dazu die zwei eigenen API-Endpunkte `cache-hit-rate` und `cache-hit-latency`. Semantischer Cache wird als eigener Status ("Cache Semantic Hit") geführt. Kosten eines Cache-Treffers sind **nicht beziffert**. Beleg: [cache-simple-and-semantic](https://portkey.ai/docs/product/ai-gateway/cache-simple-and-semantic)

**Ausreißer.** **Keine Perzentilkachel belegt** — nur "Mean latency". Stattdessen präventiv: **Budget Limits** auf Integrations-Ebene, die auf alle darüber angelegten Provider durchschlagen. Wahlweise **cost-based (USD, min. 1 $)** oder **token-based (min. 100 Tokens)**; Reset "No Periodic Reset" / "Reset Weekly" (So 00:00 UTC) / "Reset Monthly" (1. des Monats 00:00 UTC); **Alarmschwellen** unterhalb des Limits lösen E-Mail-Benachrichtigungen aus, ohne den Zugang zu sperren. Limits gelten nur prospektiv und sind nach Anlage **nicht editierbar**. Beleg: [product/observability/budget-limits](https://portkey.ai/docs/product/observability/budget-limits)

**Geschätzt vs. abgerechnet.** Kein "estimated"-Wortlaut; die Doku beschreibt schlicht Input-/Output-Token-Kosten nach Provider-Preisen mit "Real-time cost tracking per request". **Der ehrlichste Teil ist der Fehlerfall**: *"If a specific request log shows 0 cents in the COST column, it means that Portkey does not currently track pricing for that model."* — und für solche Modelle **greifen Budget-Limits nicht**. Eigene Preise über UI-Updates, Custom-Model-Einträge oder Discount-/Markup-Multiplikatoren pro Integration. Beleg: [product/observability/cost-management](https://portkey.ai/docs/product/observability/cost-management)

**BYOK / wessen Schlüssel zahlt.** Das einzige der sechs Produkte mit einer echten Antwort darauf: Kosten und Budgets hängen an **Virtual Keys bzw. Provider-Integrationen**, Logs und Analytics sind nach Virtual Key, Provider, API Key und Workspace filterbar, und das Budget kaskadiert von der Integration in alle Workspaces.

---

## 6. Traceloop / OpenLLMetry

**Der zentrale Befund ist ein Negativbefund.** Die vollständige `llms.txt` von traceloop.com (rund 140 URLs, komplett ausgelesen) enthält **keine einzige Seite zu Dashboards, Kosten-Ansichten, KPIs oder Charts**. Der einzige Treffer für "Monitoring" ist etwas anderes: *"a monitor is an evaluator that runs on a group of defined spans with specific characteristics in real time"* — also Qualitäts-Evaluatoren, kein Kosten-Dashboard. Die Einstiegsseite nennt "Monitor, debug and test the quality of your LLM outputs" und **keine** Kosten- oder Token-Statistiken. Beleg: [traceloop.com/docs/llms.txt](https://www.traceloop.com/docs/llms.txt), [docs/introduction](https://www.traceloop.com/docs/introduction.md), [docs/monitoring/introduction](https://www.traceloop.com/docs/monitoring/introduction.md)

**KPI-Kacheln, Hauptdiagramm, Zeitraum-Presets, Drill-down, Tooltip: nicht belegt.** Es liegt nicht einmal ein aussagekräftiger Marketing-Screenshot in der Doku vor, den ich beschreiben könnte — die Monitoring-Seite verweist lediglich auf eine Listenansicht.

**Was belegt ist, ist die API-Ebene.**
*Kosten:* `GET /costs/property_costs` — *"Query your LLM costs broken down by a specific association property"*. Parameter: `property_name` (required, z. B. `user_id`, `session_id`), `start_time`/`end_time` (ISO 8601, required), `env` (optional, Komma-Liste), sowie neu **`selected_token_types`** mit `prompt_tokens, completion_tokens, cache_read_input_tokens, cache_creation_input_tokens` (`total_tokens` ist als Filter nicht zulässig). Response: `property_name`, `values[]`, `total_cost`, mit Sonderwerten `No_Association`, `No_Value`, `Unknown_Value`.
**Ob diese Kosten geschätzt oder gemeldet sind, sagt die Doku nicht** → nicht belegt. Beleg: [api-reference/costs/property_costs](https://www.traceloop.com/docs/api-reference/costs/property_costs.md)

*Spans:* `get_spans` liefert `environment, timestamp, trace_id, span_id, parent_span_id, span_name, span_kind, service_name, duration (ms), status_code, status_message, prompts, completions, input, output, resource_attributes, span_attributes` — darin `llm.vendor`, `llm.request.model`, `llm.response.model`, `llm.usage.input_tokens/output_tokens/total_tokens`. Filteroperatoren: `equals, not_equals, greater_than(_or_equal), less_than(_or_equal), contains, starts_with, in, not_in, exists, not_exists`. Sortierung u. a. nach `total_tokens`, `duration_ms`, `llm_usage_total_tokens`. **Keine Kostenfelder auf Span-Ebene.** Beleg: [warehouse/get_spans](https://www.traceloop.com/docs/api-reference/warehouse/get_spans.md)

*Metrics-API:* Filter auf Direktspalten, `labels.*` und `attributes.*`; Gruppierung erfolgt zwingend nach Metrikname, Labels enthalten `agent_name, environment, model, service_name, trace_id, span_id, vendor`. Beleg: [metrics/get-metrics-with-filtering-and-grouping](https://www.traceloop.com/docs/api-reference/metrics/get-metrics-with-filtering-and-grouping.md)

**Nutzerachse.** `Traceloop.set_association_properties({"user_id": ..., "chat_id": ...})`; beliebige String-Key-Value-Paare, genannt werden `user_id, chat_id, org_id, team_id`. Wie sie im UI als Filter oder Gruppierung wirken, ist **nicht dokumentiert**. Beleg: [tracing/association](https://www.traceloop.com/docs/openllmetry/tracing/association.md)

**Cache.** Nur als `selected_token_types`-Filter der Cost-API. Keine Dashboard-Anzeige belegt.

**Alerts.** Es gibt eine `auto-monitor-setups`-API (create/list/update/delete/bulk-upsert), inhaltlich an die Evaluator-Monitore gebunden, nicht an Kosten.

**BYOK: nicht belegt.**

**OTel-Kontext (relevant, weil Traceloop reiner OTel-Emitter ist).** Die GenAI-Semconv definiert `gen_ai.client.token.usage` (Histogram, `{token}`) und `gen_ai.client.operation.duration` (Histogram, `s`), attributiert mit `gen_ai.operation.name, gen_ai.provider.name, gen_ai.token.type, gen_ai.request.model, gen_ai.response.model`; dazu `time_to_first_chunk`, `time_per_output_chunk`, Server- und Agent-Metriken. **Eine Kosten-Metrik gibt es in der Semconv nicht** — Kosten sind bei jedem OTel-basierten Werkzeug eine Eigenerfindung oberhalb des Standards. Beleg: [semantic-conventions-genai/gen-ai-metrics.md](https://raw.githubusercontent.com/open-telemetry/semantic-conventions-genai/main/docs/gen-ai/gen-ai-metrics.md)
Das OpenLLMetry-README nennt **24+ Ziele** (Traceloop, Axiom, Braintrust, Datadog, Dynatrace, Grafana, Honeycomb, New Relic, SigNoz, Sentry, Splunk …) und **erwähnt weder Kostenverfolgung noch Dashboards**. Offizielle Grafana-Dashboards von Traceloop habe ich **nicht gefunden** → nicht belegt.

---

## 7. Optionale Produkte (kompakt)

**Langtrace** — praktisch nichts belegt. Keine Cost- oder Dashboard-Doku-Seite im Index. Belegt sind nur die drei "Säulen" ("Usage – Tokens and Cost", "Accuracy", "Performance – Latency and Success Rate") und SDK-Attribute für Session-ID, User-ID, Prompt-ID. Berechnungsmethode, Kacheln, Spalten, Perzentile, Cache: alles **nicht belegt**. Eigene Abrechnung nach Span-Volumen (0,005 $ je zusätzlichem Span über 50 K). [docs.langtrace.ai/introduction](https://docs.langtrace.ai/introduction)

**Arize Phoenix** — wörtliche Bullet-Liste des Projekt-Dashboards vorhanden: "Traces over time", "Trace Latency percentiles", **"Cost estimated in USD"**, "Top models by cost", "Top models by tokens", "Token usage by prompt and completion", "Prompt token details by input, cache, and audio parts", "Completion token details including output, reasoning, and audio parts", "LLM span counts over time", "LLM spans with errors over time", "Tool span counts over time", "Tool spans with errors over time", "Average Span/trace/session annotation scores". Cache explizit als Attribute `llm.token_count.prompt_details.cache_read` / `cache_write` / `audio`. Kosten auf Trace-, Span-, Session- und Experiment-Ebene. **Editierbare Preistabelle unter Settings → Models** (getrennte Prompt-/Completion-Preise). Cost-Trends over time und "Most expensive models" sind laut Doku noch **"(coming-soon)"**. Konkrete Perzentilwerte (p50/p95/p99) sind nicht einzeln benannt. [arize.com/docs/phoenix/tracing/llm-traces/metrics](https://arize.com/docs/phoenix/tracing/llm-traces/metrics), [cost-tracking](https://arize.com/docs/phoenix/tracing/how-to-tracing/cost-tracking)

**W&B Weave** — keine Kosten-Dashboard-Kacheln; *"Costs appear in the trace tree and in the calls table in the Weave UI."* Der belegbare Kern ist die API `POST /calls/stats` mit `granularity` in Sekunden: `usage_buckets` je Modell (`sum_total_tokens, sum_input_tokens, sum_output_tokens, sum_total_cost`) und `call_buckets` (`sum_call_count, sum_error_count, avg/min/max_latency_ms, **p50_latency_ms, p95_latency_ms, p99_latency_ms**`), max. 31 Tage je Abfrage. Filter: Op name, Trace ID, Thread ID, User ID. Call-Schema dokumentiert; UI-Export mit Zeilenauswahl und generiertem Python/cURL-Code. **Cache-Tokens: nicht belegt.** Eigene Preise via `add_cost` (`prompt_token_cost`/`completion_token_cost`); kein "estimated"-Disclaimer. [docs.wandb.ai/weave/guides/tracking/querying-calls](https://docs.wandb.ai/weave/guides/tracking/querying-calls)

**Datadog LLM Observability** — die detaillierteste Doku der Optionalen. Cost-View-Kacheln wörtlich: **"Total Cost, Cost Change, Total Tokens, and Token Change"**, dazu "Breakdown by Token Type" und eine Liste **"Most Expensive LLM Calls"**. Aufschlüsselung nach **Provider/Model** oder **Prompt ID/Version**, plus Metrik-Tags `env, service, version, model_name, model_provider, ml_app, span_kind, error` und durchreichbare Custom-Tags über `cost_tags` (z. B. `team`, `customer_tier`). Cache am gründlichsten von allen: eigene Metriken `ml_obs.span.llm.input.cache_read.tokens` / `.cache_write.tokens` / `.non_cached.tokens` **plus die drei Kosten-Pendants**, mit dokumentiertem Use-Case "Track prompt caching effectiveness". Wörtlich zur Schätzung: *"automatically calculates an estimated cost for each LLM request, using providers' public pricing models and token counts"*, bei Teildaten *"Datadog tries to estimate missing information"* und *"always displays your provided total cost as-is"* — inklusive UI-Badges **"PARTIAL COST"** und **"COST UNAVAILABLE"**; 800+ Modelle über die öffentliche Liste `pydantic/genai-prices`. Manueller Modus für Custom-Pricing/Self-hosted. [docs.datadoghq.com/llm_observability/investigate/cost](https://docs.datadoghq.com/llm_observability/investigate/cost)

**New Relic AI Monitoring** — drei Kacheln: **Total responses, average response time, average token usage per response**. Zeitreihen mit Drag-to-Zoom und Metrik-Dropdown, optional nach positivem/negativem Feedback gesplittet. AI-Response-Tabelle mit konfigurierbaren Spalten (Zahnrad-Icon): Zeitpunkt, Prompt+Response, Completion- und Token-Count, Modell. Model-Inventory → Cost-Tab: "Tokens used and token limit", "Total tokens by models", "Total usage by prompt and completion tokens". **Der Cost-Tab ist tokenbasiert, nicht dollarbasiert** — keine Preisliste, kein "estimated"-Disclaimer belegt. **Cache-Tokens: nicht belegt. P95/P99: nicht belegt** (nur "average response time"). [docs.newrelic.com/docs/ai-monitoring/explore-ai-data/view-model-data/](https://docs.newrelic.com/docs/ai-monitoring/explore-ai-data/view-model-data/)

---

## 8. Übersichtstabelle

| Produkt | Kopfkacheln | Hauptdiagramm | Aufschlüsselungsachsen | Besonderheit | Quelle-URL |
|---|---|---|---|---|---|
| **Helicone** | "Avg Cost / Req", "Avg Prompt/Completion/Total Tokens / Req" + Panels "Requests", "Costs", "Users", "Latency", "Time to First Token", "Threats", "Quantiles" | AreaChart (Requests/Latenz/TTFT/Quantiles) + BarChart (Costs/Users); Bucketing automatisch <6h=Min, <3d=Std, sonst Tag | Modell (2× getrennt: Requests/Cost), Provider, Land, Scores, API-Key, User, Custom Properties, Session; Environment nur als Property | >31 Tage hinter Pro-Gate; Export nur .xlsx; kein Perioden-Vergleich; eigene Cache-Seite mit "Cost Savings"/"Time Saved" | [dashboardPage.tsx](https://github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/dashboardPage.tsx) |
| **Langfuse** | "Traces", "Model costs", "Scores", "Model Usage", "User consumption", 3× "…latency percentiles", "Model latencies" | LINE_/BAR_/AREA_TIME_SERIES; `auto` zielt auf ~50 Buckets, sonst minute…month | providedModelName, userId, sessionId, tags, environment, release, version, promptName, promptVersion, traceName, toolNames | Sauberste Trennung *ingested* vs. *inferred* cost; aber Cache-Tokens fließen ununterscheidbar in "Input Tokens" | [dataModel.ts](https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/src/features/query/dataModel.ts) |
| **LangSmith** | Prebuilt-Sektionen: Traces / LLM Calls / Cost & Tokens / Tools / Run Types / Feedback Scores | Line, Stacked Bar, KPI, Ranked Bar, Donut, Table; Zeitraum global, "stride" je Chart überschreibbar | Run Name, Run Type, Tag, Project, Metadata, Feedback Label (Top 20) — Modell nur indirekt | Zwei Kostenbegriffe: editierbare Model Price Map (Fremdkosten, greedy nach Token-Typ) vs. eigene Trace-Abrechnung Base/Extended | [dashboards](https://docs.langchain.com/langsmith/dashboards) |
| **Braintrust** | Kein fester Satz; ein eingebautes Dashboard **"Cost and quality"**, Rest selbst gebaut (`view_type: "monitor"`) | Nicht enumeriert; Perzentile via BTQL-Custom-Measure `percentile(metrics.x, 0.95)`; Presets belegt: Live tail / 1 hour / 7 days | Group-by über Metadata/Tags; BTQL `dimensions: model, environment` | Spalte heißt "Estimated cost"; Cache-Hit-Rate = cached/prompt tokens, aber Rohfelder füllen sie nicht → stumme 0; Scorer-Kosten sind aus den Presets ausgeschlossen | [guides/monitor](https://www.braintrust.dev/docs/guides/monitor) |
| **Portkey** | Cost, Tokens used, Mean latency, Requests, Users, Top models; Tabs Overview/Users/Errors/Cache/Feedback/Summary | Zeitreihen `summary{total,avg}` + `data_points[{timestamp,total,avg}]`; **kein Bucket-Parameter dokumentiert** | Model, Provider, Virtual Key, API Key, Workspace, Config, Trace ID, Prompt ID, Cache Status, Metadata inkl. Sonderkey `_user` | Einziges Produkt mit echter "wessen Schlüssel zahlt"-Zuordnung (Budget Limits je Integration); unbekannte Modelle = 0,00 $ **und** kein Budget-Schutz | [analytics](https://portkey.ai/docs/product/observability/analytics) |
| **Traceloop** | **Nicht belegt** — keine Dashboard-Seite in der gesamten Doku | **Nicht belegt** | Association Properties (user_id, chat_id, org_id, team_id); Labels agent_name, environment, model, service_name, vendor | Kosten nur per API `/costs/property_costs`, gruppiert nach *einer* Property; "Monitoring" meint Evaluator-Monitore, nicht Kosten | [llms.txt](https://www.traceloop.com/docs/llms.txt) |
| *Langtrace* | Nicht belegt | Nicht belegt | Project, Session-ID, User-ID, Prompt-ID (nur SDK-seitig) | Keine Cost-Doku; eigene Abrechnung nach Span-Volumen | [introduction](https://docs.langtrace.ai/introduction) |
| *Arize Phoenix* | "Traces over time", "Trace Latency percentiles", **"Cost estimated in USD"**, "Top models by cost/tokens" | Zeitreihen je Kachel + Latenz-Perzentil-Chart | Projekt, Modell, Session | Editierbare Preistabelle Settings→Models; Cache-Token-Details als eigene Attribute; Cost-Trends "coming-soon" | [metrics](https://arize.com/docs/phoenix/tracing/llm-traces/metrics) |
| *W&B Weave* | Keine; Kosten in Calls-Tabelle und Trace-Tree | `/calls/stats` mit `granularity`-Buckets | Modell, Op-Name, Trace-ID, Thread-ID, User-ID | Einzige mit dokumentierten `p50/p95/p99_latency_ms` direkt in der API-Antwort; keine Cache-Tokens | [querying-calls](https://docs.wandb.ai/weave/guides/tracking/querying-calls) |
| *Datadog* | **Total Cost, Cost Change, Total Tokens, Token Change** | OOTB-Dashboard "Operational Insights", Zeitreihen | Provider/Model, Prompt-ID/Version, Custom-Tags via `cost_tags` (team, customer_tier …) | Gründlichstes Cache-Modell: Read/Write/non-cached als Tokens **und** Kosten; Badges "PARTIAL COST"/"COST UNAVAILABLE" | [investigate/cost](https://docs.datadoghq.com/llm_observability/investigate/cost) |
| *New Relic* | Total responses, Avg response time, Avg token usage | Zeitreihen mit Drag-to-Zoom + Metrik-Dropdown | App/Service, Modell, Environment | Cost-Tab ist tokenbasiert — keine $-Preisliste, kein "estimated"-Wortlaut belegt | [view-model-data](https://docs.newrelic.com/docs/ai-monitoring/explore-ai-data/view-model-data/) |

---

## 9. Was ich ausdrücklich NICHT belegen konnte

- **Traceloop:** sämtliche Dashboard-Fragen. Nicht "keine Doku gefunden", sondern: die vollständige URL-Liste der Doku enthält keine solche Seite.
- **Braintrust:** die Namen der Charts im eingebauten "Cost and quality"-Dashboard, die Liste der Chart-Typen, die Aggregationsliste, die vollständigen Zeitraum-Presets, die Default-Spalten der Logs-Tabelle, die nativen Alert-Kanäle.
- **LangSmith:** die Einzel-Kachelbeschriftungen innerhalb der sechs Prebuilt-Sektionen, die Zeitraum-Presets und Stride-Optionen des Dashboards, die Default-Spalten der Runs-Tabelle, "Sortierung nach Kosten" als Feature, Drill-down Chart→Tabelle.
- **Portkey:** Zeitraum-Presets, Bucket-Granularität, Latenz-Perzentile (es gibt nur Mean latency), ein expliziter "estimated"-Wortlaut.
- **Helicone:** Drill-down vom Chart in die Requests-Tabelle (existiert nach Codelage nicht — nur ein Modal), eine UI-Anzeige von BYOK/PTB, eine eigene UI-Achse für Prompt-Version.
- **Langfuse:** Provider als eigenständige Dimension, Vergleich zur Vorperiode, eine Anzeige "wessen Schlüssel zahlt".
- **Alle sechs:** ein Vergleich zur Vorperiode ist bei keinem belegt.

**Drei wiederkehrende Muster, die für einen eigenen Bau relevant sind:** Erstens rechnen alle Kosten aus Token × Preisliste, aber nur Langfuse (ingested/inferred), Braintrust (`estimated_cost` mit Fallback) und Datadog (Badges für Teil-/Fehldaten) machen die Herkunft des Wertes sichtbar — die anderen zeigen eine Zahl ohne Provenienz. Zweitens ist die Cache-Ausweisung durchweg die brüchigste Stelle: Braintrust zeigt stumm 0 %, wenn Rohfelder nicht gemappt sind, und Langfuse mischt Cache-Reads unsichtbar in die Input-Token-Summe. Drittens hat kein einziges Produkt eine belastbare "wessen Schlüssel zahlt"-Achse außer Portkey über Virtual Keys — Helicone kennt das Feld nur in der Datenbank, nicht im UI.