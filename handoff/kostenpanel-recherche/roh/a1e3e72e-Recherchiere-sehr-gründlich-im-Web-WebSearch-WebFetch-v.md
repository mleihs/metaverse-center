# AUFTRAG

Recherchiere sehr gründlich im Web (WebSearch + WebFetch, viele Quellen, mindestens 8-12 verschiedene URLs) die KOSTEN- und NUTZUNGS-DASHBOARDS von **Langfuse** (langfuse.com).

Fokus: Doku-Seiten (langfuse.com/docs/... — insbesondere /docs/analytics, /docs/analytics/custom-dashboards, /docs/model-usage-and-cost, /docs/tracing-features/*, /docs/scores, /faq), GitHub-Repo (langfuse/langfuse — Quelltext der Dashboard-Widgets, um exakte Bezeichnungen zu belegen), Changelog. Langfuse ist Open Source, also sind exakte Widget-/Metrik-Namen belegbar.

Beantworte KONKRET und BELEGT MIT URL für jeden Punkt:
1. Welche KPI-Kacheln / Widgets stehen im Standard-Dashboard ("Home"/Dashboard): GENAUE Bezeichnungen (z.B. "Traces", "Model cost", "Scores", "Model Usage", "Traces by time"). Welche Standard-Dashboards liefert Langfuse mit (es gibt seit v3 vorgefertigte Dashboards wie "Langfuse Usage Management", "Cost Dashboard")?
2. Hauptdiagramm: Zeitreihe? Welcher Charttyp? Welches Bucketing (Minute/Stunde/Tag/Woche)? Wie wird es gewählt?
3. Custom Dashboards: Welche Metriken (measures) und welche Dimensionen stehen zur Wahl? Liste die dokumentierten Views (traces, observations, scores-numeric, scores-categorical) und die verfügbaren Aggregationen/Dimensionen so genau wie belegbar. Welche Chart-Typen sind wählbar (Line, Vertical Bar, Horizontal Bar, Pie, Big Number/Number, Histogram, ...)?
4. Aufschlüsselungsachsen: Modell, Provider, User (userId), Session (sessionId), Tags, Environment (Langf

---

Confirmed exactly: latency percentile tables use p50/p90/p95/p99, sorted descending by p95 by default (the ▼ marker), grouped by name — belegt for point 8. Now I have everything needed. Compiling the final structured answer.

---

# Langfuse Kosten- & Nutzungs-Dashboards — Recherchebericht

Quellen: Doku (langfuse.com/docs, /faq, /blog, /changelog) **und** Quellcode von `langfuse/langfuse` auf GitHub (Branch `main`, abgerufen 2026-09-05) — letzteres liefert die wirklich exakten Bezeichnungen, da Marketing-Seiten oft nur Screenshots ohne Text-Detail zeigen.

## 1. Standard-Dashboard ("Home") und mitgelieferte Dashboards

Das Home-Dashboard ist seit v4 selbst ein reguläres Dashboard-Objekt (`LANGFUSE_HOME_DASHBOARD`, id `langfuse-home-dashboard`), das aus 12 "Preset"-Kacheln besteht. Exakte Kachel-Titel (aus dem jeweiligen React-Component, `title=`-Prop):

| Preset-ID | Komponente | Angezeigter Titel |
|---|---|---|
| home-traces | `TracesBarListChart` | **"Traces"** |
| home-model-costs | `ModelCostTable` | **"Model costs"** |
| home-scores-table | `ScoresTable` | **"Scores"** |
| home-traces-obs-time-series | `TracesAndObservationsTimeSeriesChart` | (Zeitreihe Traces+Observations) |
| home-model-usage | `ModelUsageChart` | **"Model Usage"** |
| home-users | `UserChart` | **"User consumption"** |
| home-chart-scores | `ChartScores` | **"Scores"** (Zeitreihe) |
| home-latency-table-traces | `LatencyTable` | **"Trace latency percentiles"** |
| home-latency-table-generations | `LatencyTable` | **"Generation latency percentiles"** |
| home-latency-table-observations | `LatencyTable` | **"Observation latency percentiles"** |
| home-generation-latency | `GenerationLatencyChart` | **"Model latencies"** |
| home-score-analytics | `ScoreAnalytics` | **"Scores Analytics"** |

Quelle (Definition/Layout): `packages/shared/src/domain/home-dashboard.ts` — https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/src/domain/home-dashboard.ts
Quelle (Titel je Komponente): `web/src/features/dashboard/components/{TracesBarListChart,ModelCostTable,ScoresTable,ModelUsageChart,UserChart,ChartScores,LatencyTables,LatencyChart,score-analytics/ScoreAnalytics}.tsx`

Zur v3→v4-Änderung bestätigt die Doku: die alte "Traces by time"-Ansicht wurde durch **"Observations by time"** ersetzt. Quelle: https://langfuse.com/faq/all/dashboard-changes-in-v4

**Mitgelieferte ("Langfuse-curated") Dashboards** — vier Stück, exakte Namen aus der Seed-JSON-Datei `worker/src/constants/langfuse-dashboards.json`:
- **"Langfuse Latency Dashboard"** — "Monitor latency metrics across traces and generations for performance optimization."
- **"Langfuse Usage Management"** — "Track usage metrics across traces, observations, and scores to manage resource allocation."
- **"Langfuse Cost Dashboard"** — "Review your LLM costs."
- **"Langfuse Agent Dashboard"** — "Monitor agent tool usage: total tool calls, most-called tools, tool errors and latency, and observation type breakdowns."

Quelle: https://raw.githubusercontent.com/langfuse/langfuse/main/worker/src/constants/langfuse-dashboards.json (36 Widgets, per `curl` geparst)
Ergänzend (Konzept "Langfuse-managed Dashboards", klonbar): https://langfuse.com/blog/2025-05-21-customizable-dashboards

## 2. Hauptdiagramm: Charttyp und Bucketing

Zeitreihen-Charttypen (exaktes Enum, aus Prisma-Schema): `LINE_TIME_SERIES`, `AREA_TIME_SERIES`, `BAR_TIME_SERIES` (plus Nicht-Zeitreihen: `HORIZONTAL_BAR`, `VERTICAL_BAR`, `PIE`, `NUMBER`, `HISTOGRAM`, `PIVOT_TABLE`).
Quelle: https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/prisma/schema.prisma (Zeile ~1530, `enum DashboardWidgetChartType`)

Bucketing (`granularities`-Enum): `auto, minute, hour, day, week, month` plus zehn feinere Monitor-Fenster (`5m,10m,15m,30m,1h,2h,4h,1d,2d,1w`). Kommentar im Quellcode: *"auto tries to bin the data into approximately 50 buckets given the time range"*.
Quelle: https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/src/features/query/types.ts (Zeile ~194)

Für die Standard-Zeitraum-Presets ist das Bucketing (`dateTrunc`) fest hinterlegt, z. B. "Past 5 min"→minute, "Past 1 day"→hour, "Past 30 days"→day, "Past 90 days"→week, "Past 1 year"→month.
Quelle: https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/src/utils/dateRanges.ts

## 3. Custom Dashboards: Views, Measures, Dimensionen, Charttypen

**Views** (öffentliches Enum `views`): `traces`, `observations`, `scores-numeric`, `scores-categorical`, `scores-boolean`. Für die v2-Metrics-API (`viewsV2`) entfällt `traces` (ersetzt durch die Events-Tabelle intern). Es existiert zusätzlich eine interne, nicht-öffentliche `scores-listable-count`-View.
Quelle: https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/src/features/query/types.ts (Zeilen 123–148)

**Measures pro View** (exakt aus `dataModel.ts`):
- **traces**: `count`, `observationsCount`, `scoresCount`, `uniqueUserIds`, `uniqueSessionIds`, `latency`, `totalTokens`, `totalCost`
- **observations**: `count`, `latency`, `streamingLatency`, `inputTokens`, `outputTokens`, `totalTokens`, `outputTokensPerSecond`, `tokensPerSecond`, `inputCost`, `outputCost`, `totalCost`, `timeToFirstToken`, `countScores`, `toolDefinitions`, `toolCalls`, `toolCallInvocations`
- **scores-numeric**: `count`, `value` (Default-Aggregation `avg`)
- **scores-categorical**: `count` (kein numerischer `value`, da String)
- **scores-boolean**: `count`, `value`

**Dimensionen pro View** (exakt):
- **traces**: `id, name, tags, userId, sessionId, release, version, environment, timestampMonth`
- **observations**: `id, traceId, traceName, environment, parentObservationId, type, name, level, version, tags, providedModelName, promptName, promptVersion, userId, sessionId, traceRelease, traceVersion, startTimeMonth, toolNames, calledToolNames`
- **scores-numeric/-categorical/-boolean** (gemeinsame Basis): `id, environment, name, source (API/ANNOTATION/EVAL), dataType, traceId, configId, timestampMonth, timestampDay, observationId, tags, userId, sessionId, traceRelease, traceVersion, observationName, observationModelName, observationPromptName, observationPromptVersion` (plus je View `value` / `stringValue` / `booleanValue`)

Quelle: https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/src/features/query/dataModel.ts (1787 Zeilen, komplett gelesen)

**Aggregationen** (`metricAggregations`-Enum): `sum, avg, count, max, min, p50, p75, p90, p95, p99, histogram, uniq`. Nicht-numerische Measures erlauben nur `count`/`uniq`.
Quelle: https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/src/features/query/types.ts (Zeile 4)

**Chart-Typen im Widget-Editor**: `LINE_TIME_SERIES, BAR_TIME_SERIES, AREA_TIME_SERIES, HORIZONTAL_BAR, VERTICAL_BAR, PIE, NUMBER, HISTOGRAM, PIVOT_TABLE`. `NUMBER` und `HISTOGRAM` nehmen keine Breakdown-Dimension; die übrigen sieben sind "breakdown-fähig" (max. 1 Dimension, außer `PIVOT_TABLE`: max. mehrere, s.u.). `HISTOGRAM` erzwingt die Aggregation `histogram`, `PIVOT_TABLE` erlaubt bis zu `MAX_PIVOT_TABLE_METRICS`/`MAX_PIVOT_TABLE_DIMENSIONS` Metriken/Dimensionen (bis zu 2 Dimensionen laut Changelog).
Quelle: https://raw.githubusercontent.com/langfuse/langfuse/main/web/src/features/widgets/components/widgetFormSchema.ts
Pivot-Table-Feature-Ankündigung: https://langfuse.com/changelog/2025-07-01-pivot-tables-custom-dashboards ("Select up to two dimensions that you want to group by")
Allgemeine Doku-Bestätigung ("Views", "Dimensions", "Measures" als OLAP-Cube-Begriffe, CSV-Export erwähnt): https://langfuse.com/docs/metrics/features/custom-dashboards und https://langfuse.com/blog/2025-05-21-customizable-dashboards

Konkrete Beispiel-Widgets aus dem mitgelieferten "Cost Dashboard"/"Latency Dashboard"/"Agent Dashboard" (Name | View | ChartType | Dimension | Metrik), 1:1 aus der Seed-Datei:
- "Top 20 Users by Cost" | TRACES | HORIZONTAL_BAR | userId | sum(totalCost)
- "Cost by Environment" | OBSERVATIONS | PIE | environment | sum(totalCost)
- "P 95 Latency by Model" | OBSERVATIONS | LINE_TIME_SERIES | providedModelName | p95(latency)
- "Total Trace Count (by env)" | TRACES | BAR_TIME_SERIES | environment | count
- "Top 20 Called Tools" | OBSERVATIONS | HORIZONTAL_BAR | calledToolNames | sum(toolCallInvocations)

Quelle: https://raw.githubusercontent.com/langfuse/langfuse/main/worker/src/constants/langfuse-dashboards.json

## 4. Aufschlüsselungsachsen — alle belegt

Modell (`providedModelName`), User (`userId`), Session (`sessionId`), Tags (`tags`), Environment (`environment`), Release (`release`/`traceRelease`), Version (`version`/`traceVersion`), Prompt-Name (`promptName`/`observationPromptName`), Prompt-Version (`promptVersion`/`observationPromptVersion`), Trace-Name (`name`/`traceName`) — sämtlich als Dimensionen in `dataModel.ts` deklariert (siehe Punkt 3). Provider selbst (z. B. "openai" vs. "anthropic") ist **nicht** als eigene Dimension belegt — nur der konkrete Modellname.

## 5. Tabellen und Spalten (exakt aus den Column-Definitionen)

**Traces-Tabelle** (`web/src/components/table/use-cases/traces.tsx`): Timestamp, Name, Input, Output, Observation Levels, Latency, Tokens, Total Cost, Environment, Tags, Metadata, Scores, Session, User, Observations, Status, Version, Release, Trace ID, Cost (mit Sub-Spalten Input Cost/Output Cost), Usage (mit Sub-Spalten Input Tokens/Output Tokens/Total Tokens), Action.

**Observations/Generations-Tabelle** (`.../use-cases/observations.tsx`): Start Time, Type, Name, Input, Output, Status, Status Message, Latency, Total Cost, Available Tools, Tool Calls, Time to First Token, Tokens, Model, Prompt, Environment, Trace Tags, Metadata, Scores, End Time, ObservationID, Trace Name, Trace ID, Model ID, Version, Usage (Tokens per second/Input Tokens/Output Tokens/Total Tokens), Cost (Input Cost/Output Cost).

**Sessions-Tabelle** (`.../use-cases/sessions.tsx`): ID, Created At, Duration, Environment, Scores, User IDs, Traces, Input Cost, Output Cost, Total Cost, Input Tokens, Output Tokens, Total Tokens, Usage, Trace Tags.

**Users-Tabelle** (`web/src/pages/project/[projectId]/users/index.tsx`): User ID, Environment, First Event, Last Event, Total Events, Total Tokens, **Total Cost** — Kosten pro Nutzer sind also direkt als Spalte belegt.

Alle vier Quellen: raw.githubusercontent.com/langfuse/langfuse/main/web/src/... (obige Pfade), abgerufen per curl.

## 6. Interaktionen

**Zeitraum-Presets** (Dashboard-Kontext, exaktes Enum `DASHBOARD_AGGREGATION_OPTIONS`): "Past 5 min", "Past 30 min", "Past 1 hour", "Past 3 hours", "Past 1 day", "Past 7 days", "Past 30 days", "Past 90 days", "Past 1 year" (+ "Custom"). Für Tabellen (`TABLE_AGGREGATION_OPTIONS`) zusätzlich "Past 6 hours", "Past 3 days", "Past 14 days", sowie "All time".
Quelle: https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/src/utils/dateRanges.ts

**Vergleich zur Vorperiode**: im gesamten durchsuchten Quellcode **nicht belegt** — keine Datei/Komponente mit "compare"/"previous period"-Semantik gefunden.

**Filter-Syntax** (Filter-Builder, exaktes `filterOperators`-Objekt): `datetime: [">","<",">=","<="]`, `string: ["=","contains","does not contain","starts with","ends with","is not empty"]`, `stringOptions/categoryOptions: ["any of","none of"]`, `arrayOptions: ["any of","none of","all of"]`, `number: ["=",">","<",">=","<="]`, `boolean/booleanObject: ["=","<>"]`, `null: ["is null","is not null"]`.
Quelle: https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/src/interfaces/filters.ts

**Export**: CSV-Export für Chart-Daten ist im Code als eigenes Utility vorhanden — `web/src/features/widgets/chart-library/downloadChartDataCsv.ts` (Dateiname belegt CSV-Export; Doku bestätigt zusätzlich "chart data exports to CSV", https://langfuse.com/docs/metrics/features/custom-dashboards).

**Metrics-API**: Es gibt zwei parallele APIs:
- `/api/public/metrics` (v1, **deprecated**, markiert mit `METRICS_DEPRECATION`) — Query-Objekt: `view` (`traces|observations|scores-*`), `dimensions[]`, `metrics[]` (measure+aggregation), `filters[]`, `timeDimension.granularity`, `fromTimestamp`, `toTimestamp`, `orderBy[]`, optional `chartConfig`.
- `/api/public/v2/metrics` — nur verfügbar, wenn das Projekt im "Langfuse v4 write mode" läuft (`LANGFUSE_MIGRATION_V4_ALLOW_PREVIEW_OPT_IN=true`), sonst 404 mit Verweis auf https://langfuse.com/docs/v4. Views hier ohne `traces` (dafür Events-Tabelle-basiert).
Quelle: https://raw.githubusercontent.com/langfuse/langfuse/main/web/src/pages/api/public/metrics/index.ts und .../v2/metrics.ts, sowie Query-Schema in `packages/shared/src/features/query/types.ts` (Zeile 215ff.)

**Daily Metrics API** (`/api/public/metrics/daily`) — ebenfalls **legacy**, laut Doku bis 2026-11-16 auf Langfuse Cloud verfügbar, danach Migration auf v2-Metrics mit `timeDimension.granularity="day"` empfohlen. Response-Schema:
```json
{ "data": [{ "date": "YYYY-MM-DD", "countTraces": n, "countObservations": n, "totalCost": n,
             "usage": [{ "model": "...", "inputUsage": n, "outputUsage": n, "totalUsage": n,
                         "countTraces": n, "countObservations": n, "totalCost": n }] }],
  "meta": { "page": n, "limit": n, "totalItems": n, "totalPages": n } }
```
Query-Parameter: `traceName, userId, tags[], fromTimestamp, toTimestamp, page, limit`.
Quelle: https://langfuse.com/docs/analytics/daily-metrics-api

## 7. Cache-Tokens

Belegte Feldnamen: `cache_read_input_tokens` (SDK-Ingest), `input_cached_tokens` (Langfuse-normalisiertes Format / OpenAI-kompatibel), sowie `prompt_tokens_details.cached_tokens` als OpenAI-eigenes Schema-Feld. Zitat aus der Doku: *"input excludes any input_* values (such as input_cached_tokens)"* — d. h. `usage_details`-Keys sind sich gegenseitig ausschließende "Buckets", jedes Token wird genau einmal gezählt.
Quelle: https://langfuse.com/docs/observability/features/token-and-cost-tracking

**Wichtige Präzisierung aus dem Quellcode**: Die aggregierte Dashboard-Kennzahl **"Input Tokens"** (`observationsView.measures.inputTokens`) summiert per SQL **alle** `usage_details`-Keys, deren Name (case-insensitive) den Substring `"input"` enthält (`positionCaseInsensitive(x.1, 'input') > 0`). Cache-Read-Tokens mit dem Namen `cache_read_input_tokens` fließen also automatisch in die "Input Tokens"-Summe mit ein — es gibt keine separate Standard-Kachel "davon gecacht" im Dashboard; eine Aufschlüsselung nach Cache-Anteil wäre nur über eine eigene, gegen die rohe `usage_details`-Map filternde Custom-Query möglich.
Quelle: https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/src/features/query/dataModel.ts (Measure `inputTokens`, `observationsView`)

## 8. Ausreißer/Anomalien

**Latenz-Perzentile**: Die drei Home-Dashboard-Tabellen "Trace/Generation/Observation latency percentiles" zeigen exakt die Spalten **p50, p90, p95, p99** (kein p75 im UI, obwohl p75 als Aggregation existiert), Standard-Sortierung **absteigend nach p95** (UI-Marker "▼" neben p95-Spaltenkopf).
Quelle: https://raw.githubusercontent.com/langfuse/langfuse/main/web/src/features/dashboard/components/LatencyTables.tsx

**Teuerste Traces/Kosten-Sortierung**: Die Traces-Tabelle hat eine sortierbare Spalte "Total Cost" (Punkt 5); im mitgelieferten Cost-Dashboard existieren dedizierte Ranking-Widgets "Top 20 Users by Cost" und "Top 20 Use Cases (Trace/Observation) by Cost" (HORIZONTAL_BAR/VERTICAL_BAR, sum(totalCost), s. Punkt 3).

**Alerts/Anomalien**: Es existiert ein eigenständiges Feature **"Monitors"** (`packages/shared/src/features/monitors/`) — schwellwertbasierte Alarme auf einer Metrik-Query (Views `observations|scores-*`, Aggregation, Filter), mit Auswertungsfenster (`MonitorWindowSchema`: 5m,10m,15m,30m,1h,2h,4h,1d,2d,1w), Schweregrad (`MonitorSeverity`) und Slack-Benachrichtigung (`buildMonitorAlertSlackMessage.ts`).
Getrennt davon: **"Cloud Spend Alert"** — ein Billing-Schwellwert-Alarm speziell für Langfuse Cloud, der eine E-Mail auslöst ("Langfuse Spend Alert · {org} reached ${threshold}").
Quellen: https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/src/features/monitors/types.ts und .../packages/shared/src/server/services/email/cloudSpendAlert/sendCloudSpendAlertEmail.ts

## 9. Geschätzte vs. abgerechnete Kosten

Präzedenz ist explizit dokumentiert: *"When both are available, ingested values take priority over inferred ones."* **Ingested cost** = Kosten/Usage direkt von der LLM-API-Response über SDK/API übernommen. **Inferred cost** = Langfuse berechnet aus Token-Zahl × Preistabelle der Modell-Definition (`Model definitions include prices per usage type. Usage types must match exactly with the keys in the usage_details object.`). Nutzerdefinierte Modell-Preise haben Vorrang vor Langfuse-gepflegten Defaults; Preisstaffeln nach Token-Schwellen (>200K) oder `service_tier` sind möglich.
Ungenauigkeit wird explizit benannt: *"Cost inference by tokenizing the LLM input and output is not supported for reasoning models such as the OpenAI o1 model family"* — ohne ingested Token-Zahlen kann für solche Modelle keine Kosten-Schätzung erfolgen.
Feldnamen "ingested"/"inferred" sind Doku-Sprache, keine literalen API-Feldnamen — belegt als Konzeptpaar, nicht als DB-Spalten.
Quelle: https://langfuse.com/docs/observability/features/token-and-cost-tracking

## 10. BYOK / "wessen Schlüssel zahlt"

Langfuse hat ein reales Feature "LLM API Keys" / "LLM Connections" (`web/src/features/llm-api-key/`, `fern/apis/server/definition/llm-connections.yml`), das für Playground und LLM-as-a-Judge-Evaluatoren genutzt wird. **Nicht belegt**: eine Anzeige im Dashboard oder in Traces/Generations-Tabellen, welcher konkrete API-Key/Connection eine bestimmte Generation bezahlt hat. Die Kosten-Dokumentation selbst macht dazu keinerlei Aussage — sie behandelt ausschließlich Provider-Kosten (Token × Preis), nicht die interne Zuordnung "wessen Schlüssel". Diese Aussage ist eine begründete Negativ-Feststellung (durchsuchter Quellcode + Doku ohne Treffer), keine erschöpfende Ausschlussgarantie für jede UI-Ecke.
Quellen (Feature-Existenz): https://raw.githubusercontent.com/langfuse/langfuse/main/fern/apis/server/definition/llm-connections.yml, https://raw.githubusercontent.com/langfuse/langfuse/main/web/src/features/llm-api-key/server/router.ts

---

## Zusammenfassungszeile

Produkt | Kopfkacheln | Hauptdiagramm | Aufschlüsselungsachsen | Besonderheit | Quelle-URL
---|---|---|---|---|---
Langfuse | "Traces", "Model costs", "Scores", "Model Usage", "User consumption", 3× Latency-Percentile-Tabellen (p50/p90/p95/p99) | LINE_TIME_SERIES / BAR_TIME_SERIES / AREA_TIME_SERIES, Bucketing via `granularities` (auto/minute/hour/day/week/month) | Modell (`providedModelName`), User, Session, Tags, Environment, Release, Version, Prompt-Name/-Version, Trace-Name — alle als `dataModel.ts`-Dimensionen belegt | Ingested-Cost schlägt Inferred-Cost; Cache-Tokens (`cache_read_input_tokens`) fließen ungetrennt in "Input Tokens" ein; eigenes Alert-Feature "Monitors" + "Cloud Spend Alert" | https://raw.githubusercontent.com/langfuse/langfuse/main/packages/shared/src/features/query/dataModel.ts