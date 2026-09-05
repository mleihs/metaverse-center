# AUFTRAG

WICHTIG VORAB: Das WebSearch-Budget dieser Session ist aufgebraucht — WebSearch wird fehlschlagen. Arbeite AUSSCHLIESSLICH mit WebFetch auf direkt geratene/abgeleitete Doku-URLs. Nützlicher Trick: viele Doku-Sites haben `llms.txt` (z.B. https://arize.com/docs/phoenix/llms.txt, https://weave-docs.wandb.ai/llms.txt) mit der vollständigen URL-Liste — hole die zuerst, um echte URLs zu finden. Bei Datadog/New Relic direkt die docs-Pfade raten.

Recherchiere die KOSTEN- und NUTZUNGS-DASHBOARDS von FÜNF LLM-Observability-Produkten. Pro Produkt ein kompakter, aber BELEGTER Block:

A) **Langtrace** (docs.langtrace.ai, github.com/Scale3-Labs/langtrace) — Dashboard-Metriken, Kostenansicht, Traces-Tabelle
B) **Arize Phoenix** (arize.com/docs/phoenix, github.com/Arize-ai/phoenix) — Projekt-Dashboard, Token-Cost-Tracking (Phoenix hat eine editierbare Modellpreis-Tabelle unter Settings → Models!), Traces-Tabelle-Spalten, Latenz-Perzentile
C) **W&B Weave** (weave-docs.wandb.ai) — Traces-Tabelle-Spalten, Cost-Feature (`add_cost`, eigene Preistabelle, `costs` in `calls_query`), Charts/Monitors
D) **Datadog LLM Observability** (docs.datadoghq.com/llm_observability/) — Overview-Dashboard/"AI Agents Console", welche KPIs/Facets, "Estimated cost", Traces-Explorer-Spalten, Monitors/Alerts
E) **New Relic AI Monitoring** (docs.newrelic.com/docs/ai-monitoring/) — AI-Responses-Ansicht, welche KPIs, Kosten?, Modell-Aufschlüsselung

Für JEDES Produkt kurz aber BELEGT MIT URL:
1. KPI-Kacheln oben (genaue 

---

# Recherche: Kosten- und Nutzungs-Dashboards von 5 LLM-Observability-Produkten

Alle Aussagen stammen aus offiziellen Docs (per `curl`/Markdown-Export der jeweiligen Doku-Seiten, nicht aus Marketing-Screenshots, sofern nicht ausdrücklich vermerkt). WebSearch war nicht verfügbar; alle URLs wurden direkt aufgerufen bzw. über `llms.txt`/Sitemaps gefunden.

---

## A) Langtrace (docs.langtrace.ai, github.com/Scale3-Labs/langtrace)

Die Doku ist SDK/Instrumentierungs-lastig; es gibt **keine eigene "Cost"- oder "Dashboard"-Seite** im Doku-Index (`docs.langtrace.ai/llms.txt` enthält keinen Treffer für "cost", "pricing", "dashboard").

1. **KPI-Kacheln**: nicht dokumentiert (kein Screenshot/Text mit konkreten Kachel-Labels gefunden).
2. **Hauptdiagramm**: nicht belegt (Docs sagen nur allgemein "Visualizing collected traces" / "Analyzing performance metrics").
3. **Aufschlüsselungsachsen**: Projects (App-Trennung), Session-ID, User-ID, Prompt-ID/Version sind als SDK-Attribute belegt (`docs.langtrace.ai/tracing/filter_by_session_id`, `attach_user_id`, `attach_prompt_id`) — ob sie im UI als Dashboard-Achsen auftauchen, ist nicht belegt.
4. **Tabellen + Spalten**: nicht belegt (keine Spaltenliste in der Doku).
5. **Interaktionen**: nicht belegt.
6. **Cache/cached tokens**: nicht belegt.
7. **Ausreißer (P95/P99)**: nicht belegt.
8. **Geschätzt vs. abgerechnet**: nicht belegt — die drei "Säulen" sind laut `docs.langtrace.ai/introduction` "Usage – Tokens and Cost", "Accuracy", "Performance – Latency and Success Rate", und `docs.langtrace.ai/concepts` nennt "cost" als Beispiel für eine "Metric" ("Common metrics include token usage, cost, latency and accuracy") — aber die Berechnungsmethode (Token × Preisliste) wird nirgends beschrieben.
9. **BYOK**: nicht als Begriff belegt. Belegt ist nur: Langtrace selbst berechnet sein SaaS-Abo nach **Span-Volumen**, nicht nach LLM-Kosten ("$0.005 / additional span ingested / month (above 50K spans)", `docs.langtrace.ai/introduction`). Die SDK instrumentiert Aufrufe, die der Nutzer mit seinem eigenen Provider-Key (OpenAI, Anthropic, …) tätigt — das eigentliche LLM-Geld zahlt also über den eigenen Key, nicht an Langtrace (Architektur-Rückschluss aus der SDK-Beschreibung, nicht wörtlich als "BYOK" benannt).
- Zusatzbeleg (GitHub README, `github.com/Scale3-Labs/langtrace`): "🎯 Performance Insights: Analyze latency, costs, and usage patterns", "📈 Analytics: Get detailed metrics and visualizations", Tech-Stack "NextJS ... PostgresDB ... Clickhouse DB for storing spans, metrics, logs and traces".

---

## B) Arize Phoenix (arize.com/docs/phoenix, github.com/Arize-ai/phoenix)

Sehr gut dokumentiert; wörtliche Bullet-Liste vorhanden.

1. **KPI-Kacheln / Dashboard-Inhalt** (wörtlich aus `arize.com/docs/phoenix/tracing/llm-traces/metrics`): "Traces over time", "Trace Latency percentiles", "**Cost estimated in USD**", "Top models by cost", "Top models by tokens", "Token usage by prompt and completion", "Prompt token details by input, cache, and audio parts", "Completion token details including output, reasoning, and audio parts", "LLM span counts over time", "LLM spans with errors over time", "Tool span counts over time", "Tool spans with errors over time", "Average Span/trace/session annotation scores".
2. **Hauptdiagramm**: Zeitreihen ("Traces over time", "LLM span counts over time" usw.) plus Perzentil-Chart für Latenz ("Trace Latency percentiles") — exakte Bucket-Größe/Typ nicht spezifiziert.
3. **Aufschlüsselungsachsen**: Projekt (`tracing/llm-traces/projects`: "Organize traces by environment, application, or team"), Modell ("Top models by cost/tokens"), Session (`tracing/llm-traces/sessions`: "Track and analyze multi-turn conversations"). Kein Beleg für Provider- oder User-Achse als Dashboard-Filter.
4. **Tabellen + Spalten**: keine explizite Spaltenliste der Traces-Tabelle dokumentiert; aber Kosten sind auf drei Ebenen belegt (`tracing/how-to-tracing/cost-tracking`): Trace-Level ("Total cost for the entire trace", "Breakdown by prompt vs completion costs"), Span-Level ("Individual span costs with detailed breakdowns"), Session-Level, Experiment-Level ("Total experiment cost", "Cost per experiment run").
5. **Interaktionen**: Command Palette ⌘K/Ctrl+K für Projekt-/Dataset-/Experiment-Suche (`tracing/llm-traces/projects`). Cost-Trends "over time" und "Most expensive models" sind laut Doku **"(coming-soon)"** — also noch nicht gebaut.
6. **Cache/cached tokens**: ja, explizit als Attribute: `llm.token_count.prompt_details.cache_read`, `..._cache_write`, `..._audio` sowie `completion_details.reasoning`, `completion_details.audio` (`tracing/how-to-tracing/cost-tracking`).
7. **Ausreißer (P95/P99)**: Dashboard zeigt "Trace Latency percentiles", aber die konkreten Perzentile (p50/p95/p99) sind nicht einzeln benannt.
8. **Geschätzt vs. abgerechnet**: explizit "**Cost estimated in USD**" (Dashboard-Bullet) und "Phoenix ... calculates ... using its built-in model pricing table" (Cost-Tracking-Seite) — Kosten werden klar als geschätzt (Token × hinterlegte Preistabelle) bezeichnet.
9. **BYOK**: Settings → Models ist eine **editierbare Preistabelle** ("Navigate to Settings → Models ... Add custom models or override pricing for existing models ... Set different prices for prompt (input) and completion (output) tokens", `tracing/how-to-tracing/cost-tracking`) — das ist im Kern eine BYO-Pricing-Tabelle, aber der Begriff "BYOK" selbst fällt nicht. Phoenix beobachtet über OpenInference/OTel Aufrufe, die mit dem eigenen Provider-Key laufen; das Geld für die LLM-Nutzung fließt an den Provider, nicht an Phoenix.

Quellen: `arize.com/docs/phoenix/tracing/how-to-tracing/cost-tracking`, `arize.com/docs/phoenix/tracing/llm-traces/metrics`, `arize.com/docs/phoenix/tracing/llm-traces`, `arize.com/docs/phoenix/tracing/llm-traces/projects`.

---

## C) W&B Weave (weave-docs.wandb.ai → aktuell weitergeleitet auf docs.wandb.ai/weave/…)

Hinweis: `weave-docs.wandb.ai` liefert per HTTP 301 auf `docs.wandb.ai/weave/…` — die inhaltlichen Zitate unten stammen von dort.

1. **KPI-Kacheln**: keine dedizierte "Cost-Dashboard"-Seite dokumentiert. Kosten erscheinen laut `guides/tracking/costs`: "**Costs appear in the trace tree and in the calls table in the Weave UI**." Auf Projekt-Ebene gibt es stattdessen ein **"Monitor Scores"**-Panel im Projekt-Dashboard (`guides/evaluation/monitors`: "In the Weave dashboard panels, locate Monitor Scores" — zeigt aber Qualitäts-/Fehler-Signale, keine Kosten).
2. **Hauptdiagramm**: Für Kosten/Latenz kein UI-Chart dokumentiert, sondern ein **API-Endpunkt** `POST /calls/stats` mit Zeit-Buckets (`granularity` in Sekunden) — Beispielantwort enthält `usage_buckets` (pro Modell: `sum_total_tokens`, `sum_input_tokens`, `sum_output_tokens`, `sum_total_cost`) und `call_buckets` (`sum_call_count`, `sum_error_count`, `avg/min/max_latency_ms`, **`p50_latency_ms`, `p95_latency_ms`, `p99_latency_ms`**) (`guides/tracking/querying-calls`).
3. **Aufschlüsselungsachsen**: Modell (`usage_buckets` gruppiert "by the model used"), Op-Name, Trace-ID, Thread-ID, User-ID als Filter im Stats-Call (`call_metrics`-Filter: "Op name, Trace ID, Thread ID, User ID").
4. **Tabellen + Spalten**: **Call-Schema** dokumentiert als Tabelle (`guides/tracking/call-schema-reference`): `id`, `project_id`, `op_name`, `display_name`, `trace_id`, `parent_id`, `started_at`, `attributes`, `inputs`, `ended_at`, `exception`, `output`, `summary`, `wb_user_id`, `wb_run_id`, `deleted_at`; plus berechnete Felder in `summary["weave"]`: `status`, `latency_ms`, `costs`, `trace_name`. Traces-Seite hat zusätzlich eine **"Signals"-Spalte** (`guides/evaluation/monitors`) für Monitor-Ergebnisse.
5. **Interaktionen**: Export aus der UI ("Traces table toolbar → export/download button → Export modal → Selected rows/All rows", inkl. generiertem Python/cURL-Code) (`guides/tracking/querying-calls`). Zeitraum via `start`/`granularity` im Stats-API, max. 31 Tage pro Abfrage.
6. **Cache/cached tokens ausgewiesen?**: **nicht belegt** — Weave dokumentiert nur `total_tokens`, `input_tokens`, `output_tokens`, keine cache_read/cache_write-Felder in den gefundenen Quellen.
7. **Ausreißer (P95/P99)**: **ja, explizit belegt** — `call_metrics` mit `"percentiles": [50, 95, 99]` liefert `p50_latency_ms`/`p95_latency_ms`/`p99_latency_ms` (`guides/tracking/querying-calls`).
8. **Geschätzt vs. abgerechnet**: Nicht wörtlich "estimated", aber mechanisch gleich: "Automatic cost tracking ... applies built-in pricing for the model" bzw. bei Custom-Modellen trägt man `prompt_token_cost`/`completion_token_cost` selbst ein (`add_cost`) (`guides/tracking/costs`). Kein Disclaimer-Satz zu "geschätzt vs. abgerechnet" gefunden.
9. **BYOK**: nicht als Begriff belegt; Architektur (automatische Kostenerfassung für "OpenAI, Anthropic, Cohere, or Mistral"-Integrationen) impliziert, dass der Nutzer seinen eigenen Provider-Key nutzt und dessen Rechnung trägt — Weave/W&B selbst rechnet die Beobachtungs-Plattform separat ab (nicht in den gefundenen Seiten beziffert).

Zusatz (`guides/evaluation/monitors`): 13 vorgefertigte "Signals" (Qualität: Hallucination, Low quality, User frustration, Jailbreaking, NSFW, Lazy, Forgetful; Fehler: Network Error, Ratelimited, Request Too Large, Bad Request, Bad Response, Bug) mit Alerting über "automations".

---

## D) Datadog LLM Observability (docs.datadoghq.com/llm_observability/) — am detailliertesten dokumentiert

Datadog erlaubt `.md`-Export jeder Doku-Seite (z. B. `…/investigate/cost.md`), dadurch besonders belastbare Zitate.

1. **KPI-Kacheln** (wörtlich, `llm_observability/investigate/cost`): "A high-level overview of your LLM usage over time including **Total Cost, Cost Change, Total Tokens, and Token Change**".
2. **Hauptdiagramm**: Zeitreihen zu Cost/Tokens im "Cost view"; zusätzlich das OOTB-**"Operational Insights"-Dashboard** (`app.datadoghq.com/dash/integration/llm_operational_insights`, beschrieben in `llm_observability/_index`: "Monitor the cost, latency, performance, and usage trends ... with out-of-the-box dashboards").
3. **Aufschlüsselungsachsen**: "**Breakdown by Provider/Model** or **Prompt ID/Version**" (Cost view), plus generische Metrik-Tags: `env`, `service`, `version`, `model_name`, `model_provider`, `ml_app`, `span_kind`, `error` (Tabelle in `investigate/metrics`). Custom-Tags lassen sich per `cost_tags`/`costTags`-Parameter auf Kosten-/Token-Metriken durchreichen (z. B. `team`, `customer_tier`, `feature`) — explizit als Use-Case "Filter and group spend by an application attribute" (`investigate/cost`).
4. **Tabellen + Spalten**: **"Breakdown by Token Type"** und **"Most Expensive LLM Calls"**-Liste (`investigate/cost`). Trace-Explorer-Suchfelder u. a. `@trace.total_tokens`, `@duration`, `@trace.llm_calls`, `@trace.tool_calls`, `@evaluation.<name>.value`, `@feedback.<label>.value`, `@meta.model_provider`, `@meta.model_name` (`investigate/querying`).
5. **Interaktionen**: Boolesche Query-Syntax (`AND`, `OR`, `-`), "Automate Query"-Button zur Umwandlung eines Trace-Filters in eine Automatisierungsregel (Annotation Queue/Dataset) (`configure/automation_rules`). "To query cost-related data in Traces page, use the left side Cost facets" (`investigate/cost`).
6. **Cache/cached tokens**: **ja, sehr detailliert** — eigene Metriken `ml_obs.span.llm.input.cache_read.tokens`/`.cache_write.tokens`/`.non_cached.tokens` sowie zugehörige Kosten-Pendants `…cache_read.cost`, `…cache_write.cost`, `…non_cached.cost` (`investigate/metrics`); eigener Use-Case "Track prompt caching effectiveness" mit Formel `cache_read.tokens / cache_write.tokens` (`investigate/cost`).
7. **Ausreißer**: "**Most Expensive LLM Calls**: A list of your most expensive requests" (`investigate/cost`); "Agent Observability Insights" erkennt Anomalien in Dauer/Fehlerrate über die letzte Woche automatisch (`llm_observability/_index`: "Outlier detection is performed across key dimensions: Span name, Workflow type, Patterns input/output topics"). Explizite P95/P99-Kachel nicht benannt, aber `ml_obs.span.duration` ist vom Typ "Distribution" (Datadog-Distributions unterstützen generell Perzentil-Aggregation) — das ist ein allgemeines Datadog-Feature, keine hier dokumentierte P95/P99-Kachel.
8. **Geschätzt vs. abgerechnet — wörtlich**: "Agent Observability automatically calculates an **estimated cost** for each LLM request, using providers' public pricing models and token counts" (`investigate/cost`). Bei Teil-Daten: "If you provide partial cost information, Datadog **tries to estimate** missing information ... Datadog always displays your provided total cost as-is, even if these values differ." Fehlerzustände sind sogar als UI-Badges benannt: **"PARTIAL COST"** und **"COST UNAVAILABLE"**. Unterstützt werden "**800+ models**" über die öffentliche Preisliste `github.com/pydantic/genai-prices`.
9. **BYOK**: Begriff "BYOK" fällt nicht; aber die Kostenschätzung basiert klar auf Public-Pricing für Aufrufe, die über den eigenen Provider-Key laufen (Automatic-Modus) — alternativ "**Manual**: For custom pricing rates, self-hosted models, or unsupported providers, manually supply your own cost values" (`investigate/cost`).

Quellen: `docs.datadoghq.com/llm_observability/`, `.../investigate/cost`, `.../investigate/metrics`, `.../investigate/querying`, `.../configure/automation_rules`.

---

## E) New Relic AI Monitoring (docs.newrelic.com/docs/ai-monitoring/)

Kein `.md`-Export verfügbar; Text direkt aus gerendertem HTML extrahiert (curl+eigener Parser), daher wörtliche Zitate möglich.

1. **KPI-Kacheln**: "**The three tiles** show general performance metrics about your AI's responses" — konkret: **Total responses, average response time, average token usage per response** (`explore-ai-data/view-ai-responses`: "Track total responses, average response time, and token usage").
2. **Hauptdiagramm**: "**time series graphs**" mit Drag-to-zoom ("Adjust the time series graph by dragging over a spike or drop"); Dropdown zum Wechsel der Metrik ("choose between total responses, average response time, or average tokens per response"); optional Aufsplittung nach Feedback ("scope the graphs to analyze responses by positive and negative feedback").
3. **Aufschlüsselungsachsen**: App/Service-Filter (aggregiert über alle "AI entities" oder gescoped auf eine App via APM AI-responses-Seite); Modell (Model-Inventory/-Comparison, s. u.); Environment (explizit in der Intro genannt: "compare the cost and performance of your apps before deploying" **"across different models across app environments"**).
4. **Tabellen + Spalten**: **AI-Response-Tabelle**: "when an interaction occurred, prompts paired with their responses, **completion and token count**, and which model received a prompt" — Spalten sind über ein **Zahnrad-Icon konfigurierbar** ("adjust the table columns by clicking the cog icon"). **AI-Entities-Tabelle**: "error rate, throughput, and app response time". **Model-Inventory → Cost-Tab**: "**Tokens used and token limit**", "**Total tokens by models**", "**Total usage by prompt and completion tokens**". **Model-Comparison → Cost**: "**Tokens per completion**", "**Prompt tokens**", "**Completion tokens**" (`explore-ai-data/view-model-data`).
5. **Interaktionen**: Trace-Ansicht mit Umschalter "Choose between traces or logs"; "Toggle between response details or metadata" (Metadata zeigt "entity GUID, model, tokens, and vendor"); Fehler-Zeilen im Waterfall-View rot markiert. Model-Comparison erlaubt Zeitraum-Vergleich ("compare performance or cost changed before and after a deployment") und Vergleich zweier Modell/Service/Zeitraum-Kombinationen nebeneinander.
6. **Cache/cached tokens**: **nicht belegt** — nur "completion, prompt, and response tokens" werden erwähnt, keine Cache-Token-Felder.
7. **Ausreißer (P95/P99)**: **nicht belegt** — es wird nur "average response time" genannt, keine Perzentil-Kennzahl dokumentiert. Model-Inventory → Performance-Tab nutzt "pie charts" und Zeitreihen, um Ausreißer-Modelle zu finden ("locate outliers across your models"), aber ohne P95/P99-Begriff.
8. **Geschätzt vs. abgerechnet**: **auffällig schwach belegt** — der "Cost"-Tab arbeitet nachweislich **tokenbasiert, nicht dollarbasiert**: "Determine the number of tokens came from either prompts or completions, or if certain models **cost more on average** than others" (`explore-ai-data/view-model-data`). Es gibt keinen Beleg für eine Dollar-Preisliste, einen "estimated"-Disclaimer oder eine Provider-Preistabelle — anders als bei Phoenix/Datadog scheint New Relic Kosten primär als Token-Proxy und nicht als $-Betrag auszuweisen (soweit dokumentiert).
9. **BYOK**: nicht belegt; unterstützte Vendor-Liste laut Intro: "OpenAI, Bedrock and DeepSeek" (Aufrufe erfolgen über die eigenen APM-Agents, die bestehende Anwendungscode-Aufrufe an diese Provider instrumentieren — impliziert eigener Provider-Key, nicht wörtlich als BYOK benannt).

Quellen: `docs.newrelic.com/docs/ai-monitoring/intro-to-ai-monitoring/`, `.../explore-ai-data/view-ai-responses/`, `.../explore-ai-data/view-model-data/`.

---

## Zusammenfassungstabelle

| Produkt | Kopfkacheln | Hauptdiagramm | Aufschlüsselungsachsen | Besonderheit | Quelle-URL |
|---|---|---|---|---|---|
| Langtrace | nicht belegt | nicht belegt | Project, Session-ID, User-ID, Prompt-ID (SDK-seitig belegt) | Keine eigene Cost-Doku-Seite; SaaS-Preis nach Span-Volumen, nicht nach LLM-Kosten | https://docs.langtrace.ai/introduction |
| Arize Phoenix | Traces, Trace Latency percentiles, **Cost estimated in USD**, Top models by cost/tokens | Zeitreihen je Dashboard-Kachel + Latenz-Perzentil-Chart | Projekt, Modell, Session | Settings→Models: editierbare Preistabelle (prompt/completion $/1M Tokens); Cost-Trends "coming-soon" | https://arize.com/docs/phoenix/tracing/llm-traces/metrics |
| W&B Weave | keine dedizierte Cost-Dashboard-Kachel; Kosten in Calls-Tabelle/Trace-Tree | `/calls/stats`-API mit Zeit-Buckets | Modell, Op-Name, Trace-ID, Thread-ID, User-ID | Einzige der 5 mit explizit dokumentierten `p50/p95/p99_latency_ms` in der API-Antwort | https://docs.wandb.ai/weave/guides/tracking/querying-calls |
| Datadog LLM Observability | Total Cost, Cost Change, Total Tokens, Token Change | OOTB "Operational Insights"-Dashboard (Zeitreihen) | Provider/Model, Prompt-ID/Version, Custom Tags (team, customer_tier, …) | Cache-Read/Write-Tokens & -Kosten als eigene Metriken; "PARTIAL COST"/"COST UNAVAILABLE"-Badges | https://docs.datadoghq.com/llm_observability/investigate/cost |
| New Relic AI Monitoring | Total responses, Avg response time, Avg token usage | Zeitreihen mit Drag-to-zoom, Metrik-Dropdown | App/Service, Modell, Environment | Cost-Tab ist tokenbasiert, keine dokumentierte $-Preisliste/„estimated"-Formulierung | https://docs.newrelic.com/docs/ai-monitoring/explore-ai-data/view-model-data/ |

**Generelle Einschränkung**: Bei keinem der fünf Produkte fand sich der wörtliche Begriff "BYOK" in der Doku — alle fünf sind Beobachtungs-/Instrumentierungs-Layer, die Aufrufe protokollieren, die der Nutzer mit seinem eigenen Provider-Key tätigt; das dargestellte "Cost" ist überall eine aus Tokenzahlen abgeleitete Schätzung (explizit als "estimated" benannt bei Phoenix und Datadog, implizit bei Weave, tokenbasiert ohne $-Bezug bei New Relic, gar nicht dokumentiert bei Langtrace).