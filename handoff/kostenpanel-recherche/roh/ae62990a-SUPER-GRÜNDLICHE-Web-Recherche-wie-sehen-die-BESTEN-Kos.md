# AUFTRAG

SUPER GRÜNDLICHE Web-Recherche: wie sehen die BESTEN Kosten- und Nutzungs-Dashboards für LLM-/KI-Aufrufe aus? Antworte auf Deutsch.

Ziel: ein Premium-Kostenpanel für ein Admin-Panel bauen. Ich will wissen, was die Referenzen KONKRET zeigen — welche Kennzahlen, in welcher Anordnung, mit welchen Diagrammtypen, welcher Informationsdichte.

Untersuche im Detail, mit Screenshots-Beschreibungen und Doku:
- **OpenAI Platform Usage/Costs Dashboard** — welche Ansichten, welche Gruppierungen (Modell/Projekt/API-Key), Zeitachsen, Export
- **Anthropic Console Usage & Cost** — dasselbe, plus wie sie Cache-Treffer ausweisen
- **OpenRouter Activity** — ihre Aufschlüsselung, `cache_discount`, Modell-/Anbieterachse
- **Helicone, Langfuse, LangSmith, Braintrust, Portkey, Traceloop** — die LLM-Observability-Produkte. Was zeigen ihre Cost-Views? Welche Achsen (Zeit, Modell, Nutzer, Zweck/Trace, Umgebung)? Wie zeigen sie Ausreißer?
- **AWS Cost Explorer / GCP Billing** — was übernehmen die Großen: Prognose/Forecast, Anomalieerkennung, Budget-Alarme, Gruppierung
- **Vercel Usage, Railway, Stripe Dashboard, Linear Insights, PostHog** — für die INTERFACE-Qualität, nicht das Thema: wie stellen Premium-Produkte dichte Zahlen dar?

Für JEDES: welche Kacheln oben, welches Hauptdiagramm, welche Tabellen, welche Interaktionen (Hover-Details, Drill-down, Zeitraumwahl, Vergleich zur Vorperiode).

BESONDERS INTERESSIERT MICH:
- Wie zeigt man eine **Prognose/Hochrechnung** ehrlich (gestrichelte Linie? Band? 

---

# Kosten- und Nutzungs-Dashboards für LLM-Aufrufe — Recherchebericht

## Zur Quellenlage (bitte zuerst)

Das WebSearch-Kontingent der Sitzung war nach wenigen Abfragen erschöpft (200/200). Die gesamte weitere Recherche lief über **direkte Abrufe der Primärdokumentation** — das ist für die Belegqualität besser (Originalseiten statt Suchsnippets), kostet aber Breite.

Drei Quellen waren **hart blockiert**: `help.openai.com` (HTTP 403, Cloudflare), `platform.openai.com/docs` (403) und die ECharts-Optionsreferenz (JS-App). Für OpenAI habe ich deshalb auf die **offizielle OpenAPI-Spezifikation** (`openai/openai-openapi`, lokal heruntergeladen und ausgewertet) plus Drittquellen zurückgegriffen — die Feldnamen unten sind damit hart belegt, die **UI-Beschreibung des OpenAI-Dashboards bleibt teilweise unverifiziert**, und ich sage jeweils dazu, wo.

Vier parallele Rechercheteams haben zugearbeitet; der Strang „LLM-Observability" ist nicht zurückgekommen, den habe ich selbst nachgeholt — er ist deshalb der dünnste Abschnitt.

Kennzeichnung durchgehend: **belegt** (Doku-Zitat) · **Doku-Screenshot** · **Marketing/Changelog** · **Quellcode** · **nicht belegt**.

---

# TEIL 1 — Die drei Anbieter-Dashboards

## 1.1 OpenAI Platform — Usage & Costs

**Zwei getrennte Seiten:** Usage (Tokens) und Costs (Dollar). Das Dashboard zeigt laut Help-Center-Beschreibung „a live cost chart, date filters, and per-model breakdowns"; Zeitraumwahl „today, last 7 days, the current billing cycle, or a custom range". *(nur aus Suchsnippet + Drittquelle — help.openai.com war nicht abrufbar)*

**Die Achsen sind dagegen hart belegt** (OpenAPI-Spec):

| Endpunkt | `group_by` | `bucket_width` |
|---|---|---|
| `/v1/organization/usage/completions` | `project_id`, `user_id`, `api_key_id`, `model` (+ Filter `batch`, `service_tier`) | `1m` / `1h` / `1d` |
| `/v1/organization/costs` | `project_id`, `line_item`, `api_key_id` | **nur `1d`** |

Limits: `1d` default 7 / max 31 · `1h` default 24 / max 168 · `1m` default 60 / max 1440. Costs: limit 1–180.

**Das interessanteste Detail ist die Struktur des Kostenobjekts** (`CostsResult`):

```
amount: { value, currency }        // "usd"
line_item: "gpt-6-astra, input_tokens"
quantity: <zahl>
quantity_unit: tokens | 1000_tokens | duration_seconds | duration_minutes
             | duration_hours | gibibyte_hours | images | characters
```

Also: **eine Kostenzeile trägt Betrag UND Menge UND Einheit.** Und `line_item` ist ein zusammengesetzter String aus Modell + Token-Typ. Der Nutzungsbegriff ist damit nicht „Tokens", sondern polymorph — Bilder, Zeichen, Sekunden, GiB-Stunden stehen gleichberechtigt daneben. Wer ein Panel baut, das nur Tokens kennt, kann Bild- und Audio-Kosten nicht darstellen.

**Token-Felder** (`UsageCompletionsResult`) — bemerkenswert fein nach Modalität und Cache getrennt:

```
input_tokens (inkl. cached)   input_cached_tokens   input_cache_write_tokens
input_uncached_tokens          output_tokens
input_text_tokens   input_cached_text_tokens   output_text_tokens
input_audio_tokens  input_cached_audio_tokens  output_audio_tokens
input_image_tokens  input_cached_image_tokens  output_image_tokens
num_model_requests
```

**Datenlücken auf API-Ebene:** Buckets werden auch ohne Nutzung zurückgegeben, die Gruppierungsfelder sind dann `null`. Es gibt also die Unterscheidung „Zeitraum existiert, aber leer" vs. „Zeitraum fehlt" — im Datenmodell.

**Export:** CSV aus dem Usage-Dashboard, Export-Dialog gruppierbar nach project, user, API key, model, batch, service tier. *(Suchsnippet, help.openai.com 403)*

**Quellen:** [openai-openapi (raw)](https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml) · [Cookbook: Usage & Cost API](https://developers.openai.com/cookbook/examples/completions_usage_api) · [Help: Reviewing API usage and costs](https://help.openai.com/en/articles/10478918-api-usage-dashboard) *(403)*

---

## 1.2 Anthropic / Claude Console — Usage & Cost

Zwei Seiten, sichtbar für die Rollen **Developer, Billing, Admin**.

**Usage-Seite** (belegt): Balkendiagramme mit Input-/Output-Token-Zählern, **klickbar bis auf Stunden- und Minutenebene**. Auswahl nach Workspace, Modell, Monat, API-Key. Drei benannte Diagramme:
- „Rate-Limited Requests"
- **„Rate Limit Use + Caching – Input Tokens"** — zeigt stündliche maximale *uncached* ITPM **neben Cache-Rate und aktuellem Limit**
- „Rate Limit Use – Output Tokens" (OTPM)

Dieses mittlere Diagramm ist der stärkste Einzelfund der ganzen Recherche für Ihren Zweck: **drei Größen in einem Chart — Verbrauch, Cache-Quote und Obergrenze.** Nicht „wie viel", sondern „wie viel von wie viel, und wie viel davon war umsonst".

**Cost-Seite** (belegt): „Daily Cost Chart", Gesamt-Kostenstatistik für den Zeitraum, **separate Ausweisung von „web search" und „code execution"**. Filter Workspace / Modell / Monat. CSV-Export auf beiden Seiten.

Und eine Einschränkung, die wörtlich in der Doku steht:
> „Currently, it's not possible to break down usage or cost by individual users."

**Cache-Ausweisung — hier ist Anthropic am differenziertesten.** Die Usage-API kennt vier getrennte Token-Töpfe, davon zwei nur für Cache-Erzeugung:

```
uncached_input_tokens
cache_creation: { ephemeral_5m_input_tokens, ephemeral_1h_input_tokens }
cache_read_input_tokens
output_tokens
server_tool_use: { web_search_requests }
```

Der Cache wird also **nach Lebensdauer der Cache-Einträge getrennt** (5 Minuten vs. 1 Stunde) — weil beide unterschiedlich bepreist sind. Ein Panel, das nur „cached / uncached" kennt, kann die Kosten nicht korrekt rekonstruieren.

**Gruppierungsachsen der Usage-API** (9 Stück): `account_id`, `api_key_id`, `context_window`, `inference_geo`, `model`, `service_account_id`, `service_tier`, `speed`, `workspace_id`.
`context_window`: `0-200k` / `200k-1M` · `service_tier`: `batch`/`flex`/`flex_discount`/`priority`/`priority_on_demand`/`standard` · `inference_geo`: `global`/`us`/`not_available`.

**Cost-API:** nur `1d`, Gruppierung nur nach `workspace_id` und `description`. Wichtig: „Priority Tier costs use a different billing model and are **not included** in the cost endpoint."

**Datenfrische, wörtlich:**
> „Usage and cost data typically appears within 5 minutes of API request completion, though delays may occasionally be longer."

**Und der beste Beleg der ganzen Recherche für „geschätzt vs. abgerechnet" — aus derselben Firma, zwei verschiedene APIs:** Die Cost-API liefert `amount`. Die **Claude Code Analytics API** liefert dagegen ein Feld, das anders heißt:

```
estimated_cost: { amount: 141, currency: "USD" }   // "Estimated cost in cents USD"
```

Und die OpenTelemetry-Metriken von Claude Code sagen es im Beschreibungstext:
> `cost_usd`: **Estimated** cost in USD · `cost_usd_micros`: **Estimated** cost in millionths of a US dollar

**Die Schätzung trägt das Wort im Feldnamen.** Das ist eine Kennzeichnung, die kein Nutzer wegklicken und kein Entwickler versehentlich verlieren kann.

**Ein zweiter Fund aus derselben Ecke — die Zweck-Achse.** Claude Codes `claude_code.cost.usage`-Metrik trägt Attribute, die genau die Achse abbilden, nach der Sie fragen:
```
query_source: "main" | "subagent" | "auxiliary"
agent.name · skill.name · plugin.name · marketplace.name
mcp_server.name · mcp_tool.name · model · effort · speed
```
Und `claude_code.token.usage` zusätzlich `type: "input" | "output" | "cacheRead" | "cacheCreation"`.

**Datenvollständigkeits-Grenze:** Die Claude-Code-Analytics-API liefert bewusst nur abgeschlossene Daten — „only data older than 1 hour is included in responses" — damit die Paginierung stabil bleibt. Ein bewusster Verzicht auf die letzte Stunde, statt sie unvollständig auszuliefern.

**Und ein Feld für „wer zahlt":** `customer_type: "api" | "subscription"` — Pay-as-you-go-API-Schlüssel vs. Pro/Team-Sitzplatz. Anthropic modelliert damit dieselbe Frage wie BYOK, nur auf der Vertragsachse.

**Quellen:** [Cost and usage reporting in Console](https://support.claude.com/en/articles/9534590-cost-and-usage-reporting-in-console) · [Usage and Cost API](https://platform.claude.com/docs/en/manage-claude/usage-cost-api) · [Messages Usage Report Reference](https://platform.claude.com/docs/en/api/admin-api/usage-cost/get-messages-usage-report) · [Claude Code Analytics API](https://platform.claude.com/docs/en/manage-claude/claude-code-analytics-api) · [Monitoring usage (OTel)](https://code.claude.com/docs/en/monitoring-usage)

### Referenz-Dashboards Dritter auf dieselben Daten

Weil die Console-Screenshots nicht abrufbar sind, sind die Fremd-Integrationen der beste Ersatz — sie zeigen, welche **Panel-Struktur** Profis aus genau diesen Feldern bauen.

**Elastic** baut vier Dashboards (belegt):
- **Executive Overview** — „total spend, total tokens, active workspaces, top models"
- **Token Usage** — nach Modell/Workspace/Service-Tier, aufgebrochen in „uncached input, cached input, cache-creation, and output"
- **Cost & Billing** — „daily spend in USD, broken down by workspace, model, cost type, token type, context window, and inference geography" + **Reconciliation-Tabelle für den Rechnungsabgleich**
- **Rate Limits** — konfigurierte Obergrenzen (RPM/ITPM/OTPM) gegen aktuellen Verbrauch, plus **„Headroom view tells you how close each model is to its limit"**

Alarme dort: **Cache Hit Rate Drop** („drops below 30%"), Token Consumption Spike, **Single Model Dominance** („one model accounts for more than 90% of total token consumption").

**Grafana Cloud** liefert drei benannte Alarmregeln (belegt): `AnthropicDailyCostSpike`, `AnthropicTokenRateAnomaly`, `AnthropicHighCostThreshold`. Panel-Liste: nicht dokumentiert.

**Honeycomb** liefert ein Board-Template mit „Token usage trends and patterns, Cost monitoring and attribution, **Cache utilization analysis**, Usage distribution across models and workspaces". Chart-Typen: nicht dokumentiert.

**Vantage** mappt Anthropic auf generische FinOps-Dimensionen: Billing Account (Org) · Account (Workspace) · **Service = Modellname** · **Category = Kostentyp** · **Subcategory = Token-Typ** · **Resource ID = API-Key-ID oder Nutzer-E-Mail** · Region = Inferenz-Geografie · **Charge Type = Usage oder Discount**. Die letzte Achse ist bemerkenswert: Rabatt ist ein eigener Ladungstyp, keine negative Nutzung.

**Quellen:** [Elastic: Anthropic API monitoring](https://www.elastic.co/observability-labs/blog/anthropic-claude-api-monitoring) · [Grafana Cloud Anthropic](https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/integration-reference/integration-anthropic/) · [Honeycomb](https://docs.honeycomb.io/integrations/anthropic-usage-monitoring/) · [Vantage](https://docs.vantage.sh/connecting_anthropic) · [Datadog](https://docs.datadoghq.com/integrations/anthropic-usage-and-costs/)

---

## 1.3 OpenRouter — Activity & Analytics

**Die Activity-Seite** (belegt): drei Metriken — **Spend, Tokens, Requests**. Gruppierung nach **Model, API Key oder Creator (Org-Mitglied)**. Zeitfilter **1 Hour / 1 Day / 1 Month / 1 Year**. Export als **CSV und PDF**.

Drill-down: Klick auf eine Generation → **„View Raw Metadata"** zeigt `provider_responses` als JSON mit den **HTTP-Statuscodes aller Provider-Versuche**. Also nicht „der Aufruf kostete X", sondern „so kam er zustande, über wie viele Fehlversuche".

**Die Analytics-API ist die eigentliche Fundgrube für Achsen** (belegt aus dem Cost-Control-Cookbook):

Metriken: `total_usage` (USD) · **`usage_upstream`** (Rohinferenz) · **`usage_cache`** (Einsparung) · `usage_data` (Rabatte) · `usage_web` · `usage_file` · `tokens_prompt` · `tokens_completion` · `tokens_total` · `reasoning_tokens` · **`cache_hit_rate`** (0–1) · `request_count`

Dimensionen: `model` · `provider` · `api_key_id` · `user` (+ `user_email`, „null when the user has no email on file") · `app` · `workspace` · `origin` · `country`

Granularität: `minute`, `hour`, `day`, `week`, `month`. Filteroperatoren: `eq`, `neq`, `in`, `not_in`, `gt`, `gte`, `lt`, `lte`. Zeilenlimit 1000, und — wichtig — **`metadata.truncated` sagt, ob das Ergebnis am Zeilenlimit abgeschnitten wurde.**

**Die Anomalie-Empfehlung von OpenRouter selbst, wörtlich:**
> „A model priced at a large multiple of the **blended rate** is the strongest signal to chase"

Blended rate = Gesamtausgaben ÷ Gesamttokens. Also: nicht ein absoluter Schwellwert, sondern **das Vielfache des eigenen Durchschnittspreises pro Token**. Dazu eine „weekly time axis" zum Erkennen von Sprüngen. Das ist eine Anomaliedefinition, die man in SQL in einer Zeile hat.

**`cache_discount` — die Antwort auf Ihre Frage.** Das Feld existiert, aber nur an einer Stelle: im **Generation-Endpunkt** (`/api/v1/generation`), nicht im Streaming-`usage`-Objekt.

```
total_cost              "Total cost of the generation in USD"
cache_discount          "Discount applied due to caching"
upstream_inference_cost "Cost charged by the upstream provider"
is_byok                 "Whether this used bring-your-own-key"
tokens_prompt / tokens_completion
native_tokens_prompt / _completion / _cached / _reasoning / _completion_images
provider_name · model · streamed · latency · generation_time
moderation_latency · finish_reason · num_media_prompt / _completion
origin · data_region · workspace_id
```

Im Streaming-`usage`-Objekt dagegen nur `cached_tokens` („tokens that were *read* from the cache") und `cache_write_tokens` („only returned for models with explicit caching"). **Der Rabatt in Dollar ist also nur nachträglich pro Generation abrufbar, nicht im Antwortstrom.**

**BYOK — der beste Beleg der gesamten Recherche für „wer zahlt".** OpenRouter modelliert es mit **drei Feldern**:

- `is_byok` — der Schalter
- `total_cost` — was **OpenRouter** berechnet (bei BYOK: nur die Gebühr)
- `upstream_inference_cost` — was der **Anbieter** direkt berechnet

Und die Regel wörtlich:
> „the `upstream_inference_cost` field is only available for BYOK requests. For all other requests **it will be 0 or null**."

Die Gebühr: **„5% of what the same model/provider would cost normally on OpenRouter"**, abgezogen vom OpenRouter-Guthaben, nicht vom Provider-Konto. Freikontingent 25.000 USD/Monat (Pay-as-you-go) bzw. 200.000 (Enterprise), gemessen am Listenpreis.

Und der **Fallback-Fall**, den kaum jemand modelliert: Bei Schlüsselfehlern oder Rate Limits wird auf OpenRouter-Endpunkte zurückgefallen — abschaltbar über „Never use shared capacity for any model on this provider".

**Budgets:** Workspace-Budgets in vier Intervallen (Daily/Weekly/Monthly/Lifetime, Hierarchie `lifetime > monthly > weekly > daily`, max. eines pro Intervall). UI wörtlich:
> „Each budget row shows a **progress bar** with current-period spend against the limit. If spend already exceeds a limit, the **bar turns red** and a warning appears."

Plus ein Umschalter **„Include BYOK spend"**: dann „the amount OpenRouter *would have* charged had the request not used your own provider key is added to the budget". **Die Zusammenführung zweier Zahler in eine Summe ist eine benannte, bewusste Entscheidung — kein stiller Default.**

**Quellen:** [Usage Accounting](https://openrouter.ai/docs/use-cases/usage-accounting) · [Get a Generation](https://openrouter.ai/docs/api-reference/get-a-generation) · [BYOK](https://openrouter.ai/docs/guides/overview/auth/byok.md) · [Analytics & Cost Control Cookbook](https://openrouter.ai/docs/cookbook/administration/analytics-cost-control.md) · [Activity Export](https://openrouter.ai/docs/cookbook/administration/activity-export.md) · [Workspace Budgets](https://openrouter.ai/docs/guides/features/workspaces/workspace-budgets.md)

---

# TEIL 2 — LLM-Observability-Produkte

*Dieser Abschnitt ist der dünnste — der zuständige Recherchestrang kam nicht zurück, ich habe die Kernpunkte selbst nachgeholt. Wo ich nichts belegen konnte, steht das.*

## Helicone

**Kacheln** — belegt nur für die Session-Ansicht: **Total Cost, Total Requests, Avg Latency**. Cache-Ansicht: „cache hits, cost and time saved". Kacheln des Hauptdashboards: **nicht belegt**.

**Achsen:** Custom Properties sind das Kernkonzept — „Custom Properties appear as **headers in the `Request` table**", man kann „calculate costs and metrics grouped by properties". Empfohlene Achsen laut Kochbuch: **Session · User-Tier · Feature · Environment (dev vs prod) · Modell · Provider**. Die Environment-Achse ist bei den Konkurrenten selten explizit.

**Die verfügbaren Felder** (aus der Query Language HQL, Tabelle `request_response_rmt`): `request_created_at`, `request_model`, `status` (HTTP-Code), `user_id`, **`cost` und `provider_total_cost`**, `prompt_tokens`, `completion_tokens`, `total_tokens`, `properties[...]`.

**Zwei Kostenfelder nebeneinander** — das ist genau die Trennung „selbst gerechnet vs. vom Anbieter gemeldet". Allerdings: Die Seite „How we calculate cost" **erwähnt diese Unterscheidung nicht** und erklärt auch nicht, welches Feld wann gefüllt ist. Der Unterschied existiert im Schema und stirbt in der Doku.

**Geschätzt — ausdrücklich gesagt:**
> „We capture this data, and we **estimate** the cost based on the model returned in the response body, using OpenAI's pricing tables."
> „Please note that these methods are based on our current understanding and may be subject to changes in the future as APIs and token counting methodologies evolve."

Für Anthropic zählt Helicone Tokens sogar selbst nach, „because there is no supported method for calculating tokens in Typescript" — die Zahl stammt also nicht einmal vom Anbieter.

**Ausreißer/Alarme** — die Metrikliste ist wörtlich belegt und für Ihren Zweck direkt brauchbar:
> „Error Rate, Cost, Latency, Total Tokens, Prompt Tokens, Completion Tokens, **Prompt Cache Read, Prompt Cache Write**, Count"

Zeitfenster beispielhaft „letzte 30 Minuten, letzte 24 Stunden, letzte 30 Tage", Kanäle E-Mail/Slack.

**Quellen:** [Sessions](https://docs.helicone.ai/features/sessions) · [Custom Properties](https://docs.helicone.ai/features/advanced-usage/custom-properties) · [Caching](https://docs.helicone.ai/features/advanced-usage/caching) · [HQL](https://docs.helicone.ai/features/hql.md) · [How we calculate cost](https://docs.helicone.ai/references/how-we-calculate-cost.md) · [Alerts](https://docs.helicone.ai/features/alerts.md) · [Cost Tracking Cookbook](https://docs.helicone.ai/guides/cookbooks/cost-tracking.md)

## Langfuse

**Cost Tracking Dashboard** zeigt laut Doku: **„cost by model, cost over time, and top users and use cases by cost"**.

**Chart-Typen** (Custom Dashboards, belegt): Line Charts („tracking trends over time — latency, cost, usage"), Bar Charts („compare values across categories — models, users, features"), Time Series, Pie Charts. Weitere (Big Number, Histogram, Pivot) **nicht belegt**.

**Achsen:** „Group by user, model, time, trace name", Filter über Tags, Metadata, Release/Version, Environment. Metrics-API-Views: `observations`, `scores-numeric`, `scores-categorical`, `scores-boolean`; Measures `totalCost`, `totalTokens`, `latency`, `count`; High-Cardinality-Felder (`id`, `traceId`, `userId`, `sessionId`) sind **nur zum Filtern, nicht zum Gruppieren** freigegeben — eine gute Schutzregel gegen Kardinalitätsexplosion.

**Die sauberste Modellierung von „geschätzt vs. gemeldet" im ganzen Feld:**
> **Inferred cost**: Langfuse ordnet `model` einer Modelldefinition zu, die „a price per usage type" speichert, und „multiplies those prices by the observation's usage".
> **Ingested cost**: vom Aufrufer mitgeliefert.
> **„When both are available, ingested values take priority over inferred ones."**

Zwei Herkünfte, zwei Felder, eine dokumentierte Vorrangregel. Einschränkung: „Cost inference by tokenizing the LLM input and output is **not supported for reasoning models**." Und: **Wie das UI die beiden auseinanderhält, ist nicht dokumentiert** — der Unterschied existiert im Modell und ist an der Oberfläche unsichtbar.

**Cache-Behandlung — ein Detail, das man leicht falsch macht:** Langfuse verlangt sich **überschneidungsfreie** Token-Töpfe:
> „input excludes any `input_*` values (such as `input_cached_tokens`)"

Bei OpenAI-kompatiblen Schemas normalisiert Langfuse automatisch: „Langfuse subtracts them from input and output respectively, so that the stored buckets are **mutually exclusive**." Beispiel aus der Doku: statt 17.903 Input-Tokens (davon 17.817 gecacht) gehört eingetragen `input: 86` + `input_cached_tokens: 17817` — sonst werden die Kosten doppelt gerechnet.

**Quellen:** [Model usage and cost](https://langfuse.com/docs/model-usage-and-cost) · [Custom Dashboards](https://langfuse.com/docs/metrics/features/custom-dashboards) · [Metrics API](https://langfuse.com/docs/metrics/features/metrics-api) · [Token & cost tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking)

## LangSmith

**Vorgefertigtes Dashboard, sechs Abschnitte** (belegt):

| Abschnitt | Metrik (wörtlich) |
|---|---|
| Traces | „Trace count, latency and error rates" |
| LLM Calls | „LLM call count and latency" |
| **Cost & Tokens** | **„Total and per-trace token counts and costs"** |
| Tools | „Run counts, error rates, and latency stats" (Top 5) |
| Run Types | dito (Top 5) |
| Feedback Scores | „Aggregate stats" (Top-5-Feedback-Typen) |

**„per-trace cost"** ist die Kennzahl, die sonst niemand führt: nicht was der Tag kostete, sondern was *ein Vorgang* im Mittel kostet. Für ein Spiel mit wiederkehrenden Abläufen (ein Gespräch, ein Porträt, ein Kapitel) ist das die eigentlich interessante Zahl.

**Globale Gruppierung** über „run tag or metadata" (oben rechts, gilt fürs ganze Dashboard), Custom Dashboards zusätzlich nach „Run Name, Run Type, Tag, Project, **Metadata (with a path such as `metadata.ls_model_name`)**, and Feedback Label". Zeitraum „set once at the top of the dashboard".

**Kosten:** „Costs are measured using LangSmith's cost tracking", angezeigt „broken down by token type". Es existiert eine **Model Price Map API** (`read`/`create`/`update`/`delete-model-price`) — die Preistabelle ist also editierbar. **Eine Genauigkeitsaussage habe ich nicht gefunden.**

**Quellen:** [Dashboards](https://docs.langchain.com/langsmith/dashboards) · [Model price map API](https://docs.langchain.com/langsmith/smith-api/model-price-map/llms.txt)

## Portkey

**Sechs Tabs** (belegt): Overview („70,000ft view … mit Kosten, Token, durchschnittlicher Latenz und Anfragen") · Users · Errors · **Cache** · Feedback · **Summary**.

**Summary-Tab** ist die Gruppierungsansicht: Dimension im Dropdown („AI Service, model, metadata key, and more"), Metriken je Gruppe wörtlich: **„total requests, total cost, average latency, success rate, average tokens, last seen"**. Die Spalte **„last seen"** ist ungewöhnlich und nützlich — sie zeigt tote Achsen (Modelle, die niemand mehr ruft).

**Cache-Tab:** „you can view data on the **latency improvements and cost savings** due to cache". Eine explizite Cache-Hit-Rate wird nicht genannt.

**Die Logs-Tabelle ist das beste Muster für eine Aufrufliste**, das ich gefunden habe. Spalten: „timestamp, request type, LLM used, tokens generated, thinking tokens and cost" — plus eine **Status-Spalte mit benannten Zuständen pro Gateway-Merkmal**:

| Merkmal | inaktiv | aktiv |
|---|---|---|
| Cache | Cache Disabled | **Cache Miss · Cache Hit · Cache Semantic Hit · Cache Refreshed** |
| Retry | Retry Not Triggered | Retry Success on {x} Tries · Retry Failed |
| Fallback | Fallback Disabled | Fallback Active |
| Loadbalancer | Loadbalancer Disabled | Loadbalancer Active |

Also: **der Cache-Status ist eine Zelle mit vier möglichen Wörtern, nicht ein Häkchen.** „Cache Disabled" und „Cache Miss" sind verschiedene Dinge — genau die Unterscheidung, die anderswo als 0 zusammenfällt.

**Budgets** liegen im „Model Catalog" (Virtual Keys sind abgekündigt): „Cost-based limits: Maximum spend in USD", Token-Limits, Requests pro Minute/Stunde/Tag, „pricing information **(where available)**" und **„custom pricing overrides"** für „internal cost allocation". Das „where available" ist ein implizites Eingeständnis lückenhafter Preisdaten — aber kein ausgewiesener Disclaimer.

Datenspeicherung: 30 Tage (Developer), 365 (Production), unbegrenzt (Enterprise).

**Quellen:** [Analytics](https://portkey.ai/docs/product/observability/analytics) · [Logs](https://portkey.ai/docs/product/observability/logs) · [Model Catalog](https://portkey.ai/docs/product/model-catalog)

## Braintrust

Dünn belegt. Custom Dashboards, wörtlich:
> „Custom dashboards aggregate metrics across your logs and experiments. Track **request counts, latency, token usage, costs, scores, and custom metrics over time**."

Gruppierung „Group related traces by metadata or tags", Filter über ein Menü oder **SQL/BTQL**, „Save useful combinations as **custom table views**". Ein separater „Monitor"-Tab war nicht auffindbar. Konkrete Spaltenlisten, Chart-Typen und BTQL-Feldnamen: **nicht belegt** (die BTQL-Referenzseite erklärt nur die Syntax-Unterschiede zu SQL).

**Quelle:** [Logs](https://www.braintrust.dev/docs/guides/logs)

## Traceloop / OpenLLMetry

**Kein eigenes Kosten-Dashboard belegbar.** Die Einführungsseite beschreibt OpenLLMetry als Instrumentierung („easily start monitoring and debugging the execution of your LLM app") und verweist auf Integration mit fremden Observability-Plattformen. Die „What's Supported"-Seite listet Modelle, Vektor-DBs und Frameworks — keine Metriken, keine Kostenattribute. `/docs/dashboards` ist 404.

**Einordnung:** Traceloop ist die Datenquelle, nicht die Darstellung. Als Referenz für Panel-Gestaltung taugt es nicht.

**Quelle:** [OpenLLMetry Introduction](https://www.traceloop.com/docs/openllmetry/introduction)

---

# TEIL 3 — Was die Großen machen: AWS, GCP, Azure

## AWS Cost Explorer

**Kopfkacheln:**
- **„Month-to-date costs"** — „shows how much you're **estimated** to have incurred in charges so far this month and **compares it to this time last month**"
- **„Forecasted month end costs"** — „how much Cost Explorer estimates that you will owe at the end of the month and compares your estimated costs to your actual costs of the previous month"
- **„{{this month}} trends"** — Top-Kostentrends
- Explizit: „The Month-to-date costs and the Forecasted month end costs **don't include refunds**."

**Hauptdiagramm:** „three styles: **Bar charts, Stacked bar charts, Line graphs**". Granularität Daily/Monthly/Hourly (Hourly nur nach Opt-in, 14 Tage rückwirkend). Default: „a graph of your daily **unblended** costs".

**Top-N-Regel, wörtlich:** „If you select six or more filters, Cost Explorer displays five bars, stacks, or lines, and then aggregates all remaining items … into a **sixth bar, stack slice, or plot line that's labeled Other**."

### Die Prognose — die präziseste Aussage der gesamten Recherche

> „The 80% prediction interval appears differently on each type of chart:
> · **Line charts represent the prediction interval as a set of lines that are on either side of your costs line.**
> · **Bar charts represent the prediction interval as two lines that are on either side of the top of your bar.**"

**Kein schraffiertes Band. Keine transparenten Zukunftsbalken. Zwei zusätzliche Begrenzungslinien.** Und auch beim Balkendiagramm — ein Balken hat keine natürliche Stelle für ein Band, AWS erfindet sie trotzdem.

Konfidenz fest bei 80 % in der Konsole, über die API (`GetCostForecast` → `PredictionIntervalLevel`) 51–99 einstellbar. Und die härteste Regel, die es zu diesem Thema gibt:

> „**If AWS doesn't have enough data to forecast an 80% prediction interval, Cost Explorer doesn't provide a forecast.** This is common for accounts that have less than one full billing cycle."

Zur Genauigkeit:
> „Like weather forecasts, billing forecasts can vary in accuracy. … The range in the prediction band is dependent on your **historical spend volatility**. The more consistent and predictable the historical spend, the narrower the prediction range."
> „Because forecasts are predictions, the forecasted billing amounts are **estimated and might differ from your actual charges**."

Das Prognosemodell wird **nirgends benannt** — nur „based on your past usage".

Wichtig für die laufende Periode: „If you choose any forecasted dates, **your current date's cost and usage data shows as Forecast**."

**Kostenarten** (Dropdown „Aggregate costs by"): Unblended (Default) · Amortized · Blended · Net unblended · Net amortized.

**Vorläufigkeit:** „Cost Explorer refreshes your cost data **at least once every 24 hours**." · „All costs reflect your usage **up to the previous day**." Ein sichtbares UI-Banner „data for today is incomplete" ist **nicht belegt**.

**Gruppierung:** 16 Dimensionen (Service, Linked account, Region, Instance type, Usage type, Tag, Charge type, Purchase option, …) + Cost Category. Maximale Zahl gleichzeitiger Group-by: **nicht dokumentiert**; belegt ist nur die Filtergrenze von 1024.

**Vergleich zur Vorperiode:** eigenes Merkmal **„Cost Comparison"** — „automatically analyzes cost variations **between two selected months**, highlighting the largest cost drivers and explaining the reasons"; plus „Top trends"-Widget mit den „top 10 cost variations between the previous two months".

## AWS Cost Anomaly Detection

**Darstellung = Liste, kein Diagramm.** Tab „Detected anomalies", Default 90 Tage. Spalten wörtlich:

- **Cost impact** — „calculated as **actual spend − expected spend**"
- **Impact %** — „calculated as **(total cost impact / expected spend) × 100**. **This value cannot be calculated when expected spend is zero, so in those situations the value will show as 'N/A'**."
- **Expected spend** — „The amount our machine learning models expected you to spend during the anomaly's duration, based on your historical spending pattern."
- **Actual spend**, **Start date**, **Last detected**, **Duration** („An anomaly can be ongoing"), **Monitor name**, **Top root cause (Service)** (aufklappbar: Account, Region, Usage type)
- **Assessment**: „Not submitted" / „Not an issue" / „Accurate anomaly" — plus die Frage „Did you find this detected anomaly to be helpful?"

**Severity — die substanzielle Einsicht:**
> „Represents how abnormal a certain anomaly is accounting for historical spending patterns. … **However, a small spike with historically consistent spend is categorized as high severity. And, similarly, a big spike with irregular historical spend is categorized as low severity.**"

**Die absolute Höhe ist nicht der Maßstab — der Ausschlag im Verhältnis zur bisherigen Streuung ist es.** Genau deshalb altert eine feste Regel „20× Median" schlecht.

**Schwellen:** „two types … **absolute and percentage**", max. zwei, verknüpfbar mit **AND oder OR**. Und die Trennung von Erkennung und Meldung:
> „Even if an anomaly is below the alert threshold, the machine learning model **continues to detect** spend anomalies … All the anomalies that the machine learning model detected … are available in the **Detected anomalies** tab."

**Latenz:** „runs **approximately three times a day**" · „uses data from Cost Explorer, which has a **delay of up to 24 hours**" · „**10 days of historical service usage data** is needed before anomalies can be detected."

## AWS Budgets

**Alarm-Schwellen, wörtliche UI-Formulierung** — zwei unabhängige Achsen:
> „Next to the amount, choose **Absolute value** … Or, choose **% of budgeted amount** …
> Next to the threshold, choose **Actual** to create an alert for actual spend. Or, choose **Forecasted** to create an alert for forecasted spend."

Mindesthistorie:
> „**AWS requires approximately 5 weeks of usage data to generate budget forecasts.** If you set a budget to alert based on a forecasted amount, this budget alert isn't triggered until you have enough historical usage information."

Verhaltensunterschied:
> „**Actual** alerts are only sent out **once** per budget, per budget period … **Forecast**-based budget alerts … might alert **more than once** in a budgeted period if the forecasted values exceed, dip below, and then exceed the alert threshold again."

Detailseite: „Current vs. budgeted", „Forecasted vs. budgeted", „Alerts", „Details", „Budget history" (Chart + Tabelle, 12 Monate). Eine horizontale Budget-Linie im Chart: **nicht dokumentiert**.

## GCP Cloud Billing Reports

**Kopfkacheln:**
- „**Actual cost-to-date** for the current month, including total savings"
- „**Total forecasted cost** for the entire current month, including forecasted savings"
- beide mit „a **percent change indicator** to show you if your overall costs are trending up or down compared to the previous time period"

**Hauptdiagramm:** gestapelte Balken (alternativ Linie „to visualize cost spikes"). Default: „the current calendar month's **daily** cost for all services and SKUs, **grouped by Service**".

**Automatische Granularitätsumschaltung:**
> „If the report's time range is set for **62 days or less**, the report chart automatically shows costs **by day**. If your time range covers more than 62 days, the report chart automatically shows costs **by month**."

**Prognose:**
> „The chart also includes forecasted costs, **indicated in the chart in light gray**, helping you visualize how your forecasted costs are trending."
> „The report chart includes forecasted costs **if the date range ends on a future date**."

GCP entsättigt also vollständig auf Grau — die Prognose verliert nicht nur Deckkraft, sie verliert die **Serienfarbe** und damit die Zugehörigkeit zur gemessenen Reihe. **Kein Konfidenzband.** Seit 2026 zusätzlich „AI-Driven Cost Forecasts": „detect seasonality and recurring cycles, **regularize data anomalies**, and predict your future spend up to 12 months in advance".

**Cost Breakdown Report** = **Wasserfall-Diagramm**: Bruttokosten → Savings/Credits (Negotiated, CUDs, Free Tier, Promotional, SUD) → Invoice-Level-Posten → Gesamt. Gebühren orange, Gutschriften grün, Summen blau.

**Budgets:** Defaults **50 %, 90 %, 100 %**, Trigger wahlweise **Actual** oder **Forecasted** („calculated out to the end of the current calendar budget period"). Fortschrittsbalken „A visual gauge of how the actual spend is tracking against the budget's targeted amount"; **Zielbetrag als „red, dashed, horizontal line"** im 12-Monats-Balkenchart.

**Cost Anomalies Dashboard** (GA): „spikes or deviations in usage costs that differ from your expected spend"; berechnet auf **On-demand-Raten** (CUD/SUD ausgeschlossen); Darstellung als **tabellarische Ereignisliste, kein Trend-Chart**; Schwellen über „Cost Impact" (Betrag) und „Deviation Percentage"; Lernen aus Nutzerfeedback.

**Datenlatenz für den UI-Report: nicht belegbar** — trotz gezielter Suche keine Aussage der Form „costs may take up to X hours to appear".

## Azure Cost Management (Gegenprobe)

**KPIs in Smart views:** **Total** („the small percentage next to the total – it's the **change compared to the previous period**"), **Average**, **Budget**, **Forecast** (nur Labs-Preview), plus eine **Insight-Karte** — sonst „**No anomalies detected**".

**Chart-Typen:** Area („ideal for showing a running total with forecast trending towards a budget") · Line („aren't stacked, which helps spot changes easily") · Column stacked („ideal for reviewing your daily or monthly run rate") · Column grouped · Table. Granularität None / Daily / Monthly / **Accumulated**.

**Prognose — diametral zu AWS:**
> „**The solid color of the chart shows your Actual/Amortized cost. The shaded color shows the forecast cost.**"

Derselbe Chart, Zukunft schattiert. **Kein Konfidenzintervall.** Als einziges Produkt benennt Azure sein Modell:
> „Forecasting employs a **time series linear regression model** … **At least 90 days of historical data are recommended** for a more precise annual forecast."

Und die Einschränkung, die alle teilen, aber nur Azure ausspricht:
> „**The forecasted cost isn't calculated for each service. It's projected for the Total** of all your services."

**Anomalieerkennung** — am ausführlichsten dokumentiert:
> „Cost anomalies are evaluated for subscriptions **daily** and compare the day's total usage to a forecasted total based on the **last 60 days** … **Anomaly detection runs 36 hours after the end of the day (UTC)** to ensure a complete data set is available.
> The anomaly detection model is a **univariate time-series, unsupervised prediction, and reconstruction-based model** … using a **deep learning algorithm called WaveNet**. **It's different than the Cost Management forecast.**"

Anzeige als Insight-Karte im Satzformat: **„Daily run rate down 748% on Sep 28"**. Schwellen nicht konfigurierbar.

**Vorläufigkeit — der klarste Text aller drei Anbieter:**
> „**All included costs are estimated until an invoice is generated.** Estimated costs shown … before invoice generation, **don't consider tiered pricing plans**. The cost estimates calculated during this time are based on the **highest tier** for a product. After an invoice is issued, charges … should match the invoice."
> „**Estimated charges for the current billing period are updated six times per day.**"
> „During the open month (uninvoiced) period, Cost Management data **should be considered as estimated only**."

**Nur EINE Gruppierungsachse:** „Cost Analysis **doesn't support grouping by multiple attributes**." Ersatz: **Pivot charts** unter dem Hauptdiagramm.

**Top-N (präziseste Regel):** „the **top 10** cost contributors are shown … If there are more than 10, the **top nine** … with an **Others** group … When you're grouping by tags, an **Untagged** group appears … **Untagged is always last**, even if untagged costs are higher than tagged costs."

**Budget im Chart:** „If your costs go over your budget, you see a **red critical icon**. If your **forecast** goes over your budget, you see a **yellow warning icon**." Und: ein Monatsbudget von 31 $ erscheint in der Tagesansicht als **`$1/day (est)`**.

---

# TEIL 4 — Interface-Qualität: Vercel, Railway, Stripe, Linear, PostHog (+ Plausible, Grafana, Datadog)

## Vercel

**„Allotment indicator"**: „It shows how much of your usage you've consumed in the current cycle and the **projected cost for each item**." Ob Balken, Ring oder Text: **nicht belegt**.

**Der übertragbarste Fund — „Viewing Options": eine Metrik, fünf Linsen** statt fünf Kacheln: **Count / Project / Region / Ratio / Average**. „Ratio" mit festen Gegensatzpaaren je Metrik:

| Metrik | Ratio-Zerlegung |
|---|---|
| Requests | cached vs uncached |
| Fast Data / Origin Transfer | incoming vs outgoing |
| Function invocations + execution | successful vs errored vs **timed out** |
| Builds | completed vs errored |

Chart „line or bar" umschaltbar; Speed Insights Default **P75**, zuschaltbar P90/P95/P99 als weitere Linien. Hover liefert „a one-hour summary" bei stündlicher Granularität. Spend Management mit 50/75/100 %-Schwellen.

**BYOK-Abrechnung — die klarste Prosa zur Zahler-Trennung:**
> „Spend through your own credentials **isn't counted in budgets**. It's **metered separately** … **so a budget can't be used to cap BYOK spend.**"

Und der gemischte Aufruf:
> „If a query using your credentials fails, AI Gateway will retry the query with its system credentials … **that fallback usage is billed against your credits balance.**"

**Ein Aufruf kann also zwei Zahler haben.** Wer „wer hat bezahlt" als *ein* Feld modelliert, kann diesen Fall nicht abbilden.

Plus ein vorbildlicher Genauigkeitshinweis: „AI Gateway displays pricing based on East US 2 region rates. If your Azure resource is in a different region, **your actual costs may vary.**" — ein *benannter Grund*, nicht ein pauschales „ungefähr".

## Railway

**Kopfkacheln** *(Changelog-Video)*: links eine reine Textliste (Current Usage · Member Seats · Included Usage · Credits Available), rechts **zwei große Zahlen-Kacheln nebeneinander: „Current Usage" und „Estimated Bill"**. **Kein Delta, keine Sparkline, kein Pfeil, kein Prozentwert** — ausschließlich absolute Dollarbeträge. Bemerkenswert für ein Kostenprodukt.

**Hauptdiagramm:** **vier separate vollbreite Charts untereinander** (CPU, RAM, Egress, Volume), je eine Serie, **nicht gestapelt** — Small Multiples. Presets 1h/6h/1d/7d/30d, Umschalter **„Sum / Replicas"**.

**Prognose — Railway ist hier die Referenz:**
> „The **Current** and **Estimated** cost metrics show the current resource usage and the **estimated usage by the end of the billing period**."

Das Paar steht **auf drei Ebenen** (Workspace, Projekt, Service) jeweils direkt nebeneinander. Die Rechenmethode ist **nicht dokumentiert**.

**Kostenkontrolle:** Usage Limits als weiches Limit (E-Mail) und hartes Limit („all your workloads will be taken offline"), gestaffelte Warnungen bei **75 %, 90 %, 100 %**. In keinem der geprüften Screens ein Fortschrittsbalken — durchgehend benachbarte Dollarbeträge.

**Tabelle „Project Cost":** Ressource | Menge mit Einheit („minutely GB") | Preis/Einheit | Betrag, mit Fußnote „Metrics are shown as minutely accumulated values."

## Stripe

**KPI-Kacheln** *(Doku-Screenshot, Payments-Analytics)*: drei Kacheln mit Metrikname, großer Zahl und **farbigem Delta-Prozentwert (grün/rot)**, **ohne Sparkline**. Klick macht die Kachel zur Quelle des großen Charts darunter (blaue Umrandung = ausgewählt) — **die Kachel ist Selektor, nicht Vorschau.** Ein sehr sparsames Dichte-Muster.

**Vorperiode — der klarste Beleg überhaupt** *(Screenshot)*: eine **zweite, hellgraue gepunktete Linie** hinter der durchgezogenen farbigen Ist-Linie, mit **expliziter Legende „Current period" / „Previous period"**. „Standardmäßig beginnt der Vergleichszeitraum direkt vor dem gewählten Zeitraum und stellt die gleiche Zeitspanne dar."

**Laufende Periode — als Einziges über Farbe statt Strichelung:**
> „Monatsdiagramme verwenden **Farben**, um zwischen **offenen und abgeschlossenen** Abrechnungszeiträumen zu unterscheiden. Zahlen in offenen Perioden ändern sich fortlaufend, bis die Periode geschlossen wird."

**„Geschätzt vs. endgültig" als zwei Zahlen nebeneinander:** `pending` und `available` — „The top-level `available` and `pending` comprise your 'payments balance.'" Stripe zeigt **beide Summen mit zwei Namen**, statt einer Zahl mit Sternchen. Der Nutzer sieht die Differenz, statt sie sich denken zu müssen.

**Daten-Lag wird konsequent beziffert:** 4 Stunden (Revenue Recognition), ~12 h nach 00:00 UTC (Balance), und Sigma hat dafür einen eigenen Abfrageparameter **`data_load_time`**.

**Prognose: ausdrücklich nicht.** Das Umsatz-Wasserfalldiagramm „modelliert keine zukünftigen Abrechnungen und prognostiziert keine zukünftigen Umsätze".

## Linear Insights

**Das Vokabular ist der eigentliche Fund** — drei Achsen mit festen Namen:
- **Measure** = y-Achse
- **Slice** = x-Achse
- **Segment** = optionale Farbdimension („Segments are optional and **use color to slice the data further**")

Also **zwei Dimensionen kombinierbar**, und es heißt nicht „Group by".

Chart-Typen exakt drei: **Bar**, **Scatterplot**, **Burn-up / cumulative flow diagrams** — dazu **immer eine Tabelle unter dem Graphen**, plus „metric blocks" (Einzelzahl-Kacheln) auf Dashboards. Kein Pie, kein Donut.

Scatterplot mit **Perzentil-Markern bei 25/50/75/95 %** — die Antwort auf „Median gegen Maximum": nicht zwei Zahlen, sondern die Punktwolke mit eingezeichneten Quantilen.

**Drill-down bidirektional:** „Select full bars or segments to **temporarily filter your view** to only those issues" · „Select points to open the related issue" · Hover auf einem Balken hebt die zugehörige Tabellenzeile hervor und umgekehrt.

## PostHog *(quellcodeverifiziert)*

**Chart-Typen mit exaktem Stapelverhalten:** Line (linear/kumulativ, separate Linien) · **Bar time series** („will appear **stacked**") · Area („behave like a stacked bar chart") · **Box Plot** · Number · Bar total value (optional „Stack breakdown values") · Table · Pie · World Map · **Calendar Heatmap** (Stunde × Wochentag).

**Laufende Periode — gestrichelter Schwanz, nicht ganze Linie:**
> „a **dotted line** indicated the data for that period is **still being collected**."

Im Quellcode präziser: `computeDashedFromIndex()` berechnet aus `incompletenessOffsetFromEnd < 0` den Index, ab dem gestrichelt wird → `stroke: { partial: { fromIndex: dashedFromIndex } }`. Also **nur das Endstück ab dem ersten unvollständigen Bucket**. Ausgenommen: die Vergleichsserie.

**Vorperiode — gedimmt, nicht gestrichelt** (`applyComparisonDimming`). Im Number-Chart als **„percentage change pill"**, in der Table „in a dedicated column".

**Breakdown-Grenze:** `BREAKDOWN_VALUES_LIMIT = 25` (Länder 300), Button „Load more breakdown values" — und **zwei getrennte Sammel-Label**: `BREAKDOWN_OTHER_STRING_LABEL` (abgeschnittener Rest) vs. `BREAKDOWN_NULL_STRING_LABEL` (Eigenschaft fehlt). Genau die Unterscheidung „zusammengefasst" vs. „kein Wert".

**Tooltip:** eine Zeile pro Serie, Flag `sortedByValue` („Sort rows by value descending"), jede Zeile klickbar (`onRowClick` → Persons-Modal). Kommentar im Code: „breakdown truncates; **period label is always fully visible**".

**Legende:** Checkbox pro Serie, plus Rechtsklick „Hide other series / Show all / Hide all".

## Plausible *(quellcodeverifiziert — das sauberste Vorbild im Sample)*

**Zwei Linienstile mit zwei verschiedenen Bedeutungen** — der wichtigste Befund des ganzen Berichts:

```
mainPathClass       = 'stroke-indigo-500'
comparisonPathClass = 'stroke-[rgb(222,221,255)]'   // Geisterlinie, hell, DURCHGEZOGEN
dashedPathClass     = '[stroke-dasharray:3,3]'      // NUR für 'current'
```

**Strichelung = Zeit unvollständig. Helligkeit = andere Periode.** Wer beides strichelt, macht die zwei Bedeutungen ununterscheidbar — und Stripe strichelt tatsächlich die Vorperiode, Plausible die laufende. Plausibles Trennung ist die konsistentere.

**Kein Wert vs. Null:** Jeder Punkt trägt ein `isDefined`-Flag. „A full line is drawn only between two or more continuous full periods. **No line is drawn from or to gaps in the data.**" Eine Null wird auf 0 gezeichnet, eine Lücke **unterbricht die Linie**. Im Tooltip zusätzlich in Worten: **`Partial of {month}`** / `Partial week of {date}`.

**Division durch null gelöst:** `getRelativeChange` gibt bei Vergleichswert 0 und Ist > 0 exakt `100`, bei 0/0 exakt `0` — nie `Infinity` oder `NaN`.

**Balken in der Tabellenzelle:** `bar.js` legt ein absolut positioniertes `div` **hinter** die Zeile, `width = count / max(all) * 100 %`. Die kanonische Implementierung, in 30 Zeilen.

## Grafana (beste Optionsmatrix) und Datadog (beste Vergleichs-Widgets)

**Grafana Stat panel:** Graph mode `None` / **`Area`** („Shows the graph sparkline in the **background** of the value") · Color mode None/Value/Background Gradient/Background Solid · **Show percent change** mit **`Standard` / `Inverted` / `Same as Value`** — der „Anstieg ist schlecht"-Schalter, den fast alle vergessen. Bei Kosten ist er zwingend.

**Grafana Tooltip:** **Single / All / Hidden**, bei „All" zusätzlich Values sort order und Hover proximity. Das einzige Produkt, das das ausdrücklich konfigurierbar macht.

**Grafana Kein-Wert:** **„No value" — „Enter what Grafana should display if the field value is empty or null. The default value is a hyphen (-)."** Plus **Connect null values** `Never` / `Always` / **`Threshold`** („Specify a threshold above which gaps in the data are no longer connected") — und das Spiegelbild **Disconnect values**.

Die `Threshold`-Option ist die einzige, die dem Problem gerecht wird: eine Lücke von 30 Sekunden bei Minutenauflösung ist Rauschen, eine von sechs Stunden ist ein Ausfall. Eine binäre Ja/Nein-Option muss bei einer der beiden Lagen lügen.

**Grafana Table cell types:** Auto, Colored text, Colored background, **Gauge** („Values are displayed as a horizontal bar gauge", Modi Basic / Gradient / **Retro LCD**, mit **„Show unfilled area"** für die Restkapazität), **Sparkline**, Pill, JSON View, Markdown+HTML.

**Datadog Query Value:** Timeseries-Hintergrund **„Min to Max" / „Line" / „Bars"** — „Min to Max" skaliert auf die tatsächliche Spannweite und macht die **Streuung im Kachelhintergrund** sichtbar. Change Indicator mit drei orthogonalen Achsen: Display `Relative` / `Absolute` / **`Both`** / `Off` · Color `Increases as better` / `Decreases as better` / `Neutral` · Compared to `Previous Period` / `Day` / `Week` / `Month` / `Custom`.

**Datadog Table:** `cell_display_mode: number | bar | trend` — Balken **und** Trend-Sparkline in der Zelle.

**Datadog Timeseries:** Linien-Style **solid / dashed / dotted**, Stroke thin/normal/thick, automatische Beschriftung von Peaks und Tälern (max. 3 Labels pro Serie), **„Compare Time"-Tab** mit zwei Ansichtsmodi: **„Grid" (nebeneinander) oder „Overlay" (beide Perioden in einem Graphen)**.

---

# TEIL 5 — Die fünf Sonderfragen

## 5.1 Prognose ehrlich zeigen

**Der stärkste Beleg ist kein Softwareprodukt, sondern die Bank of England 1998** — die Institution, die ihre eigene Punktprognose abgeschafft und begründet hat, warum:

> „That chart was not completely satisfactory. It gave no weight to the discussion of risks … and **encouraged the reader to concentrate on an apparently precise central projection, ignoring the very wide degree of uncertainty** surrounding it. Hence, small changes in the projection were given too much prominence relative to the risk assessment."

Und der zweite Fehlermodus, der für **jede** Bandbreitendarstellung gilt:

> „In addition, **the shaded area itself was often misread as indicating upper and lower bounds** for the forecast, rather than the representation of probabilities that it actually showed."

Das Ziel: „… **without suggesting a degree of precision that would be spurious**."

**Konstruktion des Fächers:** Bänderpaare gleicher Wahrscheinlichkeitsdichte, vom Modus nach außen, bis 90 % abgedeckt sind; die äußerste Zone ist bewusst weiß (implizites neuntes Paar). Und — bemerkenswert — **es gibt keine Mittellinie.** Die zentrale Projektion ist nur „by construction, always in the deepest red band". **Der Fächer weigert sich aktiv, dem Auge eine Linie zum Ablesen anzubieten.**

**Was die Praxis daraus macht — drei unvereinbare Haltungen:**

| | Darstellung | Intervall |
|---|---|---|
| **AWS** | zwei **Linien** beidseits der Kostenlinie / Balkenspitze | **80 %**, API 51–99 |
| **GCP** | dieselbe Zeitreihe, **light gray** fortgesetzt | keins |
| **Azure** | derselbe Chart, **shaded color** statt solid | keins |

**Nur AWS zeigt überhaupt Unsicherheit — und zwar als Linien, nicht als Band.** Wer ein schraffiertes Konfidenzband baut, baut etwas, das kein großer Anbieter so macht.

**Die Prognose ist überall eine Gesamtsumme, nie pro Serie** (Azure sagt es explizit). Eine gestapelte Prognose je Gruppe gibt es bei niemandem.

**Werkzeuge:** Vega-Lite `errorband` (`ci` = „95% bootstrapped confidence interval of the mean", `stderr` Default, `stdev`, `iqr`) + Beispiel `layer_line_errorband_ci` · Highcharts **`series.zones`** mit `dashStyle`/`fillColor` pro Zone und **`xAxis.plotBands`** für die Zukunftsfläche. ECharts `markArea`/`markLine`: existieren, waren aber **nicht zitierfähig belegbar** (Optionsreferenz ist eine JS-App).

**Und eine Konvention, die niemand sonst hat — das Prognose-Kürzel in der Tabelle.** Die UK Government Analysis Function schreibt pro Zelle vor: **`[f]` = forecast · `[e]` = estimated · `[p]` = provisional · `[r]` = revised.**
> „Whenever a table contains shorthand, you should mention it and explain what the shorthand means. **The best place to do this is above the table.**"

Zwei starke Eigenschaften: Das Kürzel hängt **an der Zelle**, nicht an der Spalte (eine Tabelle darf geschätzte und abgerechnete Zeilen mischen). Und die Legende steht **über** der Tabelle — gelesen, bevor die Zahlen gelesen werden.

**Rangfolge der Mittel, aus den Belegen abgeleitet:**
1. **Kein Band → keine Prognose** (AWS). Die einzige Regel, die den Fehler unmöglich macht, statt ihn zu beschriften.
2. **Farbe entziehen, nicht nur Deckkraft** (GCP „light gray"). Ein aufgehellter Balken in Serienfarbe liest sich noch als Messung; ein grauer nicht.
3. **Strichelung** ist die schwächste Markierung — überlebt Schwarzweiß und Farbenblindheit, sagt aber nichts über die Breite der Unsicherheit.
4. Die Mittellinie im Prognosebereich **wegzulassen** (BoE) ist stärker, als sie zu stricheln. Was nicht da ist, kann nicht abgelesen werden.

## 5.2 Datenlücken — Zeilen ohne Kosten/Token

**Der Normtext, der die Frage beantwortet** (UK Analysis Function) unterscheidet **fünf Arten von „kein Wert"** und trennt sie sauber von der Null:

| Kürzel | Bedeutung (wörtlich) |
|---|---|
| `[x]` | not available |
| `[z]` | not applicable |
| `[c]` | confidential |
| `[w]` | none recorded in survey |
| **`[low]`** | **„a low figure but not a real zero"** |
| `[u]` | low reliability |
| `[b]` | break in time series |

Die Kernregel:
> **„A zero or '0' should only be used when a data point is a true zero."**

**`[low]` ist der Fall, den Software praktisch nie kennt: gerundete Null ≠ echte Null ≠ kein Wert.** Bei Token-Kosten ist das unmittelbar relevant — ein Aufruf für 0,00003 USD zeigt bei zwei Nachkommastellen „0,00" und ist damit optisch nicht von „nichts gekostet" und nicht von „nicht erfasst" zu unterscheiden.

Eurostat führt dieselbe Trennung mit anderen Zeichen: `:` = not available · `-` = not applicable · `0` = real zero · **`0n`** = „less than half of the final digit shown and greater than real zero" · `e`/`p`/`f`/`c`/`u` · `|`/`b` = break in time series. Mit der Warnung, nicht zu viele Flags zu setzen — die Kennzeichnung soll die Ausnahme markieren, nicht den Normalfall verrauschen.

**Charts — was die Bibliotheken tun:**

| Bibliothek | Option | Default |
|---|---|---|
| ECharts | `series-line.connectNulls` — „Whether to connect the line across null points." | **`false`** |
| Highcharts | `plotOptions.line.connectNulls` | **`false`** |
| Chart.js | `spanGaps` | Lücke |
| Grafana | Connect null values: Never / Always / **Threshold** | – |

**Die gefährlichste Falle:** Highcharts — „In stacked area charts, when `connectNulls` is set to true, **null points are treated as zero values**." Genau die Verwechslung, die man vermeiden will, ist in einer Standardoption eingebaut.

**Und die zweite:** Datadogs `fill()` mit `linear` / `last` / `zero` / `null` — und: **„Interpolation is enabled by default for `GAUGE` type metrics"**, Default-Limit 300 s. Eine Lücke von bis zu fünf Minuten wird also **stillschweigend überbrückt**, ohne Hinweis im Chart.

Prometheus geht den umgekehrten Weg: „If a target scrape … no longer returns a sample for a time series that was previously present, this time series will be marked as **stale**. … Such time series will **disappear from graphs** at the times of their latest collected sample."

**Vega-Lite `impute` ist der Gegner, nicht der Freund.** Es erfindet Datenpunkte (`value`, `mean`, `median`, `max`, `min`), und ein imputierter Punkt ist im fertigen Chart von einem gemessenen nicht mehr unterscheidbar. Wenn er unvermeidlich ist, gehört er in eine sichtbar anders gestaltete Reihe — sonst gilt exakt die BoE-Kritik.

**Tabellen:** **Grafana** ist das einzige Produkt mit dokumentierter Default-Regel — **„The default value is a hyphen (-)."** **AWS** liefert die schönste Begründung für „N/A" statt „0", weil sie den mathematischen Grund mitnennt: Impact % „**cannot be calculated when expected spend is zero**, so in those situations the value will show as 'N/A'."

**Zwei Leerstellen, gezielt gesucht und nicht gefunden:**
- **Kein Design-System** (Carbon, Polaris, Material, Atlassian) hat eine Regel zu leerer Zelle vs. Null. Die Regel existiert in der **amtlichen Statistik**, nicht im UI-Design.
- **Kein Werkzeug** weist die Zählbasis eines Mittelwerts aus („n = 42 von 50"). Weder Grafana noch Datadog noch AWS.

Beide Lücken betreffen dieselbe Sache: wie viele Werte hinter einer Zahl stehen. Sie ist in der Produktwelt unbeantwortet — was sie zur Stelle macht, an der ein Kosten-Panel mit wenig Aufwand ehrlicher sein kann als der Stand der Technik.

## 5.3 „Geschätzt" vs. „abgerechnet"

**Drei belegte Muster, in aufsteigender Ehrlichkeit:**

**1. Das Wort im Bezeichner.** AWS: CloudWatch-Metrik **`EstimatedCharges`** im Namespace `Billing`. Anthropic: **`estimated_cost.amount`** und **`cost_usd`: „Estimated cost in USD"**. Die Schätzung ist nicht wegzuklicken, weil sie Teil des Namens ist.

**2. Der Status als Datenfeld neben der Zahl.** AWS:
> „For monthly billing periods that haven't closed (the billing status appears as **Pending**), this page shows the most recent **estimated charges** … **The summary isn't an invoice until the month's activity closes and AWS calculates the final charges.**"
> „At any time, you can view **estimated charges for the current month** and **final charges for previous months**."

Eine glasklare Zweiteilung entlang der Zeit: **pending → estimated · issued → final**, und die Statusbezeichnung steht *neben* der Zahl, nicht in einer Fußnote.

**3. Beide Zahlen nebeneinander.** Stripe `pending` + `available`. Die einzige Variante, die dem Leser die **Größe** der Differenz zeigt.

Für ein Token-Kosten-Panel hieße das: nicht „~4,12 USD (geschätzt)", sondern zwei Zeilen — *aus Tokenzählung gerechnet: 4,12 · vom Anbieter bestätigt: 3,87*.

**Bei den LLM-Werkzeugen:**
- **Helicone** sagt „**estimate**" ausdrücklich, mit Disclaimer.
- **Langfuse** trennt sauber im Datenmodell (`ingested` vor `inferred`), **aber nicht im UI**.
- **LiteLLM** hat alle Dimensionen (api_key, user, team_id, request_tags, end_user, model_group, api_base, spend, tokens) und **keine** Genauigkeitsaussage.
- **Portkey** sagt „pricing information **(where available)**" — implizites Eingeständnis, kein Disclaimer.
- **LangSmith** hat eine editierbare Model Price Map, aber keine Aussage zur Berechnung.

**Nicht gefunden:** Tilde `~` oder `≈` als dokumentierte UI-Konvention — in keiner einzigen Doku. Und keine Design-System-Regel für „approximate values".

## 5.4 „Wer zahlt" — BYOK vs. Plattformschlüssel

**Ja, es gibt Produkte, die das ausweisen — genau zwei, und sie widersprechen sich.**

| | **OpenRouter** | **Vercel AI Gateway** |
|---|---|---|
| Feld | **`is_byok`** — „Whether this used bring-your-own-key" | separat gemetert |
| Kostenfelder | **zwei**: `total_cost` (Plattform) + `upstream_inference_cost` (Anbieter, „only available for BYOK requests") | getrennt |
| Im Budget | **optional** („Include BYOK spend" — dann wird der hypothetische Listenpreis addiert) | **nie** — „so a budget can't be used to cap BYOK spend" |
| Fallback | dokumentiert, abschaltbar („Never use shared capacity") | dokumentiert **und Ihnen berechnet** |
| Gebühr | 5 % des Listenpreises | – |

Vercel ist die intellektuell ehrlichere Variante, weil es die **Konsequenz benennt**: Ein Nutzer, der ein Limit setzt, könnte sonst glauben, er sei geschützt.

**Die anderen: Aufschlüsselung ja, Zahler nein.**
- **LiteLLM** schlüsselt nach API Key, Team, Internal User, End-User, Tags auf — aber alle diese Achsen beantworten „**wem ordne ich die Kosten zu**", nicht „**wessen Schlüssel hat gezahlt**". Keine BYOK-Kennzeichnung gefunden.
- **Portkey**: eigene Anbieterschlüssel sind das Normalmodell, es gibt keinen Plattformschlüssel — die Unterscheidung entfällt.
- **Cloudflare AI Gateway**: keine BYOK-Unterscheidung, kein Schätz-Disclaimer. Nur „A 5% fee is applied to all credits purchased through Unified Billing … Inference pricing from providers is passed through with no markup."
- **Helicone, Cursor, Windsurf, Perplexity, Poe**: nichts gefunden.
- **Anthropic** modelliert dieselbe Frage auf der Vertragsachse: `customer_type: "api" | "subscription"`.

**Die Ableitung: drei Felder pro Aufruf, nicht eines.** Wessen Schlüssel (`is_byok`), was die Plattform berechnet, was der Anbieter berechnet. Und für die Summe in der Kachel eine **bewusste Entscheidung mit einem Namen** — keine stille Addition.

## 5.5 Anomalie/Ausreißer — ein Aufruf, 20× teurer als der Median

**Warum der Durchschnitt versagt** — Brendan Gregg, gemessen statt behauptet: `iostat` zeigte eine mittlere Latenz von 3–9 ms; die Einzelereignisse zeigten, dass die meisten I/Os **unter 2 ms** lagen. „the average has been dragged up by latency **outliers**". Und: „**the modes move over time**" — erst die Zerlegung in Zeitspalten (die Heatmap) macht das sichtbar.

Übertragen: Ein Aufruf zum 20-fachen des Medians verschiebt den Stundenmittelwert spürbar — und ist im Mittelwert dann *unsichtbar*, weil er als leichter Anstieg **aller** Aufrufe erscheint statt als das, was er ist.

**Honeycomb BubbleUp — die stärkste Mechanik:**
1. Nutzer zieht auf einer **Heatmap** ein Rechteck („draw a box around the data to define the selection")
2. Die Daten zerfallen in „**Selection**, rendered in **yellow**" und „**Baseline**, rendered in **blue**" (alle übrigen Punkte)
3. Für **jedes Feld** ein Balkendiagramm, das „each value in bar form, which represents its frequency in the Selection or in the Baseline" zeigt, Balkenhöhen „proportional to the number of times the value occurs"
4. Sortierung als „a ranked table of fields" nach Schweregrad

**BubbleUp visualisiert nicht den Ausreißer, sondern den Unterschied zwischen dem Ausreißer und allem anderen.** Man wählt „das da ist komisch" und bekommt zurück „und zwar unterscheidet es sich in *diesen* Feldern". Kein Modell, keine Schwelle — nur ein Vergleich zweier Verteilungen.

Der Grund, warum Aggregate hier scheitern, am bimodalen Beispiel: „while all status codes are in the lower-valued duration, **only `200` and `500` status codes are in the higher**" — ein Mittelwert hätte die zwei Wolken zu einer erfundenen Mitte verschmolzen.

**Algorithmisch — die relevante Weggabelung** (Grafana formuliert sie am klarsten):
> „**DBSCAN** clusters data points based on their density and relative distance, and flags a series when its data points fall outside the largest cluster."
> „**MAD** evaluates each data point against the **rolling 24-hour median** and flags a series when the deviation exceeds the configured sensitivity threshold."
> „**DBSCAN compares values against an adaptive group, while MAD compares values against a stable statistical baseline.**"

DBSCAN sucht **das abweichende Mitglied einer Gruppe** (welches Modell/welcher Zweck verhält sich anders als die übrigen), MAD sucht **die abweichende Zeit**. Für „20× der Median" ist **MAD** die passende Familie — der Median ist bereits der Anker, MAD der dazu passende robuste Streuungsschätzer.

**Boxplot — die formale Definition, mit einer Falle:** Vega-Lite Tukey (Default, `extent: 1.5`): „If there are outlier points beyond the whisker, they will be displayed using **point marks**." Min-Max dagegen: „**No points will be considered as outliers for this type of box plots.**" **Wer die falsche Variante wählt, hat das Merkmal wegdefiniert, nach dem er sucht — und sieht keinen Fehler, sondern nur eine Box.**

**Punkt im Chart oder eigene Tabelle? Belegt ist: beides, in verschiedenen Rollen.** Chart zum Finden (Vega-Lite `point marks`, Grafana „highlights the series containing outliers"), **Tabelle zum Abarbeiten** (AWS „Detected anomalies", sortierbar nach Cost impact und Impact %; Sentry sortiert Spans nach Dauer), **Verlinkung dazwischen** (AWS: „View more" → Details → „View in Cost Explorer").

**Median/P95 gegen Maximum in einer Kachel:** Datadog Query Value mit `avg`/`min`/`sum`/`max`/`last` plus Perzentile `p75`/`p90`, Change Indicator, und Sparkline-Hintergrund **„Min to Max"** — der die Spannweite selbst zur Kachelgrafik macht.

**Und die Warnung, die man leicht übersieht:** Datadog Distributions bildet globale Perzentile serverseitig (DDSketch), weil „the aggregation occurs server-side". **Wer P95 aus bereits aggregierten Stundenwerten rechnet, bekommt nicht das P95 der Aufrufe.** Die Kachel braucht die Rohzeilen.

**Beeswarm / Strip Plot in Observability-Tools: nichts gefunden.** Die **Heatmap** scheint dort die etablierte Form für dieselbe Aufgabe zu sein — sie skaliert besser, weil sie über die Zeit stapelt statt zu streuen. (PostHog hat immerhin Box Plot und Calendar Heatmap als Chart-Typen.)

---

# TEIL 6 — Die Übersichtstabelle

| Produkt | Kopfkacheln | Hauptdiagramm | Achsen der Aufschlüsselung | Besonderheit | Quelle |
|---|---|---|---|---|---|
| **OpenAI Platform** | „live cost chart" + Summe der Periode *(UI nicht verifizierbar, 403)* | Balken je Tag, per-model breakdown | Usage: `project_id`, `user_id`, `api_key_id`, `model` (+ batch, service_tier) · Cost: `project_id`, `line_item`, `api_key_id` | **Kostenzeile = Betrag + `quantity` + `quantity_unit`** (tokens, images, characters, duration_seconds, gibibyte_hours); Token nach **Modalität × Cache** getrennt (text/audio/image, cached/uncached/cache_write) | [openai-openapi](https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml) |
| **Anthropic Console** | Gesamt-Kostenstatistik der Periode; „Daily Cost Chart" | Balken (Input/Output), **klickbar bis Stunde und Minute** | 9 Achsen: workspace, api_key, model, service_tier, context_window (`0-200k`/`200k-1M`), inference_geo, speed, account, service_account | **„Rate Limit Use + Caching – Input Tokens": Verbrauch, Cache-Rate und Limit in EINEM Chart**; Cache getrennt nach 5m/1h-Lebensdauer; „not possible to break down … by individual users" | [Console-Reporting](https://support.claude.com/en/articles/9534590-cost-and-usage-reporting-in-console) · [Usage & Cost API](https://platform.claude.com/docs/en/manage-claude/usage-cost-api) |
| **OpenRouter Activity** | **Spend · Tokens · Requests** | Zeitreihe; Zeitfilter 1 Hour / 1 Day / 1 Month / 1 Year | UI: Model, API Key, Creator · API: model, provider, api_key_id, user, user_email, app, workspace, origin, country | **`is_byok` + zwei Kostenfelder** (`total_cost` / `upstream_inference_cost`); **`cache_discount`** in USD; `cache_hit_rate`; „a model priced at a large multiple of the **blended rate**" als Anomaliesignal; CSV **und PDF** | [Usage Accounting](https://openrouter.ai/docs/use-cases/usage-accounting) · [Get a Generation](https://openrouter.ai/docs/api-reference/get-a-generation) |
| **Helicone** | Session: **Total Cost · Total Requests · Avg Latency**; Cache: „cache hits, cost and time saved" | nicht belegt | Custom Properties als **Tabellenspalten**: Session, User-Tier, **Feature**, **Environment**, Modell, Provider | **`cost` UND `provider_total_cost`** im Schema; sagt „we **estimate** the cost"; Alarme u. a. auf **Prompt Cache Read / Write** | [HQL](https://docs.helicone.ai/features/hql.md) · [How we calculate cost](https://docs.helicone.ai/references/how-we-calculate-cost.md) |
| **Langfuse** | „cost by model, cost over time, **top users and use cases by cost**" | Line / Bar / Time Series / Pie | user, model, time, trace name, tags, environment, release/version; High-Cardinality-Felder **nur zum Filtern** | **„ingested values take priority over inferred ones"** — zwei Kostenherkünfte mit Vorrangregel; Token-Töpfe müssen **überschneidungsfrei** sein (sonst Doppelzählung) | [Model usage and cost](https://langfuse.com/docs/model-usage-and-cost) |
| **LangSmith** | Sechs Abschnitte: Traces · LLM Calls · **Cost & Tokens** · Tools · Run Types · Feedback Scores | je Abschnitt Zeitreihen, Tools/Run Types als **Top 5** | global „run tag or metadata"; zusätzlich Run Name, Run Type, Tag, Project, `metadata.<pfad>`, Feedback Label | **„Total and per-trace token counts and costs"** — Kosten **pro Vorgang**, nicht nur pro Tag; editierbare Model Price Map | [Dashboards](https://docs.langchain.com/langsmith/dashboards) |
| **Portkey** | **Total Requests · Total Cost · Average Latency · Success Rate · Average Tokens · Last Seen** | nicht belegt; Tabs Overview/Users/Errors/**Cache**/Feedback/**Summary** | Summary-Dropdown: AI Service, Model, **Metadata-Schlüssel** | **Status-Spalte pro Log-Zeile mit benannten Cache-Zuständen**: Cache Disabled / Miss / **Hit** / **Semantic Hit** / Refreshed (+ Retry/Fallback/Loadbalancer); Cache-Tab zeigt Latenz- **und Kostenersparnis** | [Analytics](https://portkey.ai/docs/product/observability/analytics) · [Logs](https://portkey.ai/docs/product/observability/logs) |
| **Braintrust** | nicht belegt | „aggregate metrics … request counts, latency, token usage, costs, scores … over time" | „Group related traces by **metadata or tags**"; Filter über Menü oder **SQL/BTQL** | „Save useful combinations as **custom table views**"; Spaltenlisten nicht dokumentiert | [Logs](https://www.braintrust.dev/docs/guides/logs) |
| **Traceloop / OpenLLMetry** | — | — | — | **Kein eigenes Kosten-Dashboard belegbar** — Instrumentierung, keine Darstellung | [Introduction](https://www.traceloop.com/docs/openllmetry/introduction) |
| **AWS Cost Explorer** | „Month-to-date costs" · „Forecasted month end costs" (je mit Vormonatsvergleich) · „{{Month}} trends" | Bar / Stacked / Line; Default daily unblended; **Top 5 + „Other"** | 16 Dimensionen + Cost Category; 1024 Filter | **80 %-Prognoseintervall als zwei Linien** beidseits; **„doesn't provide a forecast"** ohne genug Daten; aktueller Tag zählt als Forecast; „Cost Comparison" zweier Monate | [ce-forecast](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-forecast.html) |
| **AWS Anomaly Detection** | keine — Listenfelder: Cost impact · Impact % · Expected/Actual spend · Severity · Assessment | **kein Chart**; Link „View in Cost Explorer" | Root cause: Service, Account, Region, Usage type | Impact % zeigt **„N/A"** bei expected = 0; **Severity misst Ausschlag gegen bisherige Streuung, nicht Absoluthöhe**; Erkennung ≠ Meldung | [getting-started-ad](https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html) |
| **AWS Budgets** | „Current vs. budgeted" · „Forecasted vs. budgeted" | „Budget history" (12 M.) | Service, Account, Region, Usage Type, Tag, Cost Category | **Absolute value / % × Actual / Forecasted**; **~5 Wochen** Historie nötig; Actual alarmiert 1×, Forecasted mehrfach | [budgets-view](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-view.html) |
| **GCP Billing Reports** | „Actual cost-to-date" · „Total forecasted cost" — **beide mit %-Trendindikator** | gestapelte Balken; **auto: ≤62 Tage → täglich, sonst monatlich** | Subaccount, Project, Product, Service, SKU, Application, Location; Cost Table max. **3** Custom-Dimensionen | **Prognose „indicated in the chart in light gray"** — Farbentzug, kein Band; **Cost Breakdown als Wasserfall** (Brutto → Credits → Netto); Budget-Ziel als **„red, dashed, horizontal line"** | [reports](https://cloud.google.com/billing/docs/how-to/reports) |
| **Azure Cost Management** | **Total** (mit %) · Average · Budget · **Forecast** (Preview) · Insight „No anomalies detected" | Area / Line / Column stacked / grouped / Table; **Accumulated**-Granularität; **Top 9 + „Others" + „Untagged" immer zuletzt** | 22 Dimensionen, aber **nur EINE Group-by-Achse** (Ersatz: Pivot charts) | **„solid color = actual, shaded color = forecast"**; Modell **linear regression**, ≥90 Tage empfohlen; Anomalie via **WaveNet**, 60 Tage, 36 h Verzug, Satzform „Daily run rate down X% on <Datum>"; **„All included costs are estimated until an invoice is generated"** | [quick-acm-cost-analysis](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/quick-acm-cost-analysis) |
| **Vercel** | „allotment indicator": Verbrauch im Zyklus + **projected cost je Posten** | Linie **oder** Balken; Speed Insights P75 (+P90/95/99) | **Fünf Linsen auf dieselbe Metrik: Count / Project / Region / Ratio / Average**; Ratio mit festen Paaren (cached vs uncached, successful vs errored vs timed out) | BYOK **„metered separately … a budget can't be used to cap BYOK spend"**; **Fallback auf Systemschlüssel wird dem Guthaben belastet** → ein Aufruf, zwei Zahler | [manage-and-optimize-usage](https://vercel.com/docs/pricing/manage-and-optimize-usage) · [AI Gateway BYOK](https://vercel.com/docs/ai-gateway/authentication-and-byok/byok) |
| **Railway** | **„Current Usage" / „Estimated Bill"** als Kachelpaar — **kein Delta, keine Sparkline** | **vier separate, nicht gestapelte Charts** (Small Multiples); Presets 1h/6h/1d/7d/30d; „Sum / Replicas" | Workspace → Projekt → Service; Ressource (vCPU, Memory, Disk, Network) | **„Estimated" steht auf drei Ebenen direkt neben dem Ist-Wert**; Warnstaffel **75 % / 90 % / 100 %** (dann Abschaltung); nie ein Fortschrittsbalken | [project-usage](https://docs.railway.com/projects/project-usage) · [cost-control](https://docs.railway.com/pricing/cost-control) |
| **Stripe** | drei „Key metrics"-Kacheln mit **farbigem Delta**, **ohne Sparkline** — die **Kachel ist Selektor** fürs Chart | Linie; Granularität Weekly/Daily | Presets „Last 3 months" / „Last 7 days" + Custom | **Vorperiode als zweite hellgraue gepunktete Linie** mit Legende „Current period / Previous period"; **offene vs. geschlossene Periode über FARBE**; **`pending` + `available` als zwei Zahlen**; Daten-Lag stets beziffert (`data_load_time`) | [payments/analytics](https://docs.stripe.com/payments/analytics) · [balances](https://docs.stripe.com/payments/balances) |
| **Linear Insights** | „metric blocks" (Einzelzahl) | **Bar · Scatterplot · Burn-up** — dazu **immer** eine Tabelle darunter | **Measure (y) / Slice (x) / Segment (Farbe)** — zwei Dimensionen kombinierbar | Scatterplot mit **Perzentil-Markern 25/50/75/95 %**; **bidirektionaler Drill-down** (Balken→Liste, Hover→Tabellenzeile) | [insights](https://linear.app/docs/insights) |
| **PostHog** | Visitors/Views/Sessions/Duration/Bounce, **je gegen Vorzeitraum**; „percentage change pill" | Line, **Bar (Breakdown gestapelt)**, Area, **Box Plot**, Number, Pie, Table, World Map, **Calendar Heatmap** | Breakdown **Top 25** (Länder 300) + **getrennte Label für „Other" und NULL** | **Gestrichelt nur der Schwanz** ab dem ersten unvollständigen Bucket; Vorperiode **gedimmt**, nicht gestrichelt; Tooltip alle Serien nach Wert sortiert, klickbar | [trends/charts](https://posthog.com/docs/product-analytics/trends/charts) + Quellcode |
| **Plausible** | Prozent + **Auf/Ab-Pfeil**; Klick schaltet die Hauptkurve um | eine Kurve + **helle, durchgezogene Geisterlinie** für die Vorperiode | Vergleichsmodi Previous period / Year over year / Custom + **„Match day of week"** | **Strichelung ausschließlich fürs laufende Segment**; **`isDefined` — Lücke bricht die Linie, Null wird auf 0 gezeichnet**; Tooltip nennt **„Partial of {month}"**; Balken-in-Zelle in 30 Zeilen | [compare-stats](https://plausible.io/docs/compare-stats) + Quellcode |
| **Grafana** | Stat: **Graph mode „Area"** = Sparkline im Hintergrund; **Show percent change** mit `Standard`/**`Inverted`** | Time series; Stack Off/Normal/**100 %** | **Tooltip mode Single / All / Hidden** + Values sort order | **„No value" = `-` als Werksvorgabe**; **Connect null values Never/Always/Threshold** + Disconnect values; Table cell type **„Gauge"** (Basic/Gradient/Retro LCD) und **„Sparkline"** | [stat](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/stat/) · [standard options](https://grafana.com/docs/grafana/latest/panels-visualizations/configure-standard-options/) |
| **Datadog** | Query Value mit Sparkline **„Min to Max" / „Line" / „Bars"** + Change Indicator (Relative/Absolute/**Both**) | Timeseries; Style **solid/dashed/dotted** | **„Compare Time": „Grid" (nebeneinander) oder „Overlay" (ein Graph)** | **`cell_display_mode: number \| bar \| trend`**; Farbsemantik **`Increases as better` / `Decreases as better`**; **`fill()` interpoliert GAUGE-Metriken per Default bis 300 s** — stille Lückenfüllung | [query_value](https://docs.datadoghq.com/dashboards/widgets/query_value/) · [interpolation](https://docs.datadoghq.com/dashboards/functions/interpolation/) |
| **Honeycomb** | — | **Heatmap** | jedes Feld gleichzeitig | **BubbleUp: Selection (gelb) vs. Baseline (blau)**, je Feld ein Balkendiagramm der Häufigkeitsverteilung — zeigt nicht den Ausreißer, sondern **worin er sich unterscheidet** | [identify-outliers](https://docs.honeycomb.io/investigate/analyze/identify-outliers/) |
| **Bank of England** *(Referenz)* | — | **Fan Chart** — Bänderpaare gleicher Dichte bis 90 %, **ohne Mittellinie** | — | „**without suggesting a degree of precision that would be spurious**"; und die Warnung: „the shaded area itself was **often misread as indicating upper and lower bounds**" | [Fan chart (1998)](https://www.bankofengland.co.uk/-/media/boe/files/quarterly-bulletin/1998/the-inflation-report-projections-understanding-the-fan-chart.pdf) |
| **UK Analysis Function** *(Norm)* | — | — | — | **`[e]` estimated · `[f]` forecast · `[p]` provisional · `[x]` not available · `[z]` not applicable · `[low]` „a low figure but not a real zero"**; „**A zero or '0' should only be used when a data point is a true zero.**"; Legende **über** der Tabelle | [Symbols in tables](https://analysisfunction.civilservice.gov.uk/policy-store/symbols-in-tables-definitions-and-help/) |

---

# TEIL 7 — Was daraus für Ihr Panel folgt

Ich habe den Ist-Zustand im Repo angesehen, um die Befunde anschlussfähig zu machen.

**Was Sie bereits haben** (`ai_usage_log`, Migration 150 + Rollup 229): `provider`, `model`, **`purpose`**, **`key_source` ('platform'|'simulation'|'byok'|'env')**, `estimated_cost_usd`, `simulation_id`, `user_id`, `prompt_tokens`/`completion_tokens`/`total_tokens`, `duration_ms`, `metadata->>'status'`. Die stündliche MV liefert `calls`, `tokens`, `usd`, `errors`, `avg_duration_ms`.

**Was `AdminAIUsageTab.ts` heute daraus macht:** vier `velg-metric-card` (Total Calls, Total Tokens, Est. Cost, Avg/Call) und **fünf Tabellen** (By Model, By Purpose, By Provider, Key Sources, Daily Trend). **Kein einziges Diagramm** — obwohl ECharts 6 und ein `EchartsChart`-Wrapper im Projekt liegen.

Daraus die konkreten Anschlusspunkte, jeder mit Beleg statt Meinung:

1. **`purpose` ist Ihre stärkste Achse und die seltenste im Feld.** Anthropic baut sie in Claude Code als `query_source`/`agent.name`/`skill.name` nach, LangSmith als „per-trace cost", Helicone als Custom Property „Feature". Kostet in Ihrem Fall nichts — die Spalte existiert seit Migration 150.

2. **`key_source` ist genau die BYOK-Achse**, für die es weltweit **zwei** Vorbilder gibt. Und OpenRouter/Vercel zeigen: eine Summe über `platform` und `byok` hinweg braucht eine **benannte Entscheidung** („Include BYOK spend"), keine stille Addition. Vier Werte, vier Zahler — die Kachel „Gesamtkosten" bedeutet für jeden etwas anderes.

3. **`estimated_cost_usd` heißt bereits richtig.** Der Provider (OpenRouter) liefert mit `total_cost`/`cache_discount`/`upstream_inference_cost` die *abgerechnete* Zahl nach — die Gegenüberstellung im Stripe-Muster (zwei Zahlen, zwei Namen) ist damit erreichbar, ohne neue Datenquelle.

4. **Die 20×-Median-Frage braucht die Rohzeilen, nicht die MV.** Datadog-Beleg: Perzentile aus aggregierten Stundenwerten sind nicht die Perzentile der Aufrufe. Und AWS' Severity-Regel sagt, warum ein fester Faktor schlecht altert — der Maßstab ist der Ausschlag **gegen die bisherige Streuung**, nicht gegen den Median allein.

5. **Die bekannte Lücke im Buch** (nur gelungene Aufrufe wurden gebucht, `metadata->>'status'`) ist exakt der Fall, für den `[x]` und `[low]` erfunden wurden: Eine Stunde ohne Zeile ist nicht eine Stunde mit 0 USD. ECharts' `connectNulls` steht auf `false` — das ist die richtige Vorgabe und muss so bleiben.

6. **Der offene Punkt, an dem Sie den Stand der Technik schlagen können:** Kein einziges Werkzeug in dieser Recherche weist die **Zählbasis** eines Mittelwerts aus. „Ø 0,004 USD (n = 42 von 50)" wäre nach allem, was ich gesehen habe, ungewöhnlich ehrlich — und in Ihrem Schema mit einem `count(*) FILTER` zu haben.

---

# Was ich ausdrücklich NICHT belegen konnte

- **Die UI des OpenAI-Dashboards** — `help.openai.com` und `platform.openai.com/docs` sind für WebFetch gesperrt (403). Die Achsen und Feldnamen sind über die OpenAPI-Spec hart belegt, die visuelle Beschreibung stammt aus Suchsnippets und einer Drittquelle.
- **Kacheln und Hauptdiagramm von Helicone und Braintrust** — beide Dokus beschreiben Funktionen, keine Oberfläche.
- **Chart-Typen von Portkey** — nur die Tab-Namen und Metriken sind belegt.
- **Strichart und Farbe der AWS-Prognoselinien** — die Doku sagt nur „a set of lines".
- **Das AWS-Prognosemodell** — nirgends benannt (nur Azure benennt seins).
- **GCPs UI-Datenlatenz** — keine wörtliche Angabe auffindbar.
- **Ein sichtbares „Daten unvollständig"-Banner bei AWS/GCP** — nur Azure formuliert die Vorläufigkeit klar aus.
- **ECharts `markArea`/`markLine`** — die Optionsreferenz ist eine JS-App und nicht abrufbar. Die Bausteine existieren, ich kann sie nur nicht zitieren.
- **Beeswarm/Strip-Plots in Observability-Tools** — nichts gefunden; die Heatmap scheint dort die etablierte Form zu sein.
- **Tilde `~` / `≈` als dokumentierte UI-Konvention für Schätzwerte** — in keiner einzigen Doku.
- **Eine Design-System-Regel (Carbon, Polaris, Material, Atlassian) zu leerer Zelle vs. Null** — existiert nur in der amtlichen Statistik.
- **Ein Werkzeug, das die Zählbasis eines Mittelwerts ausweist** — keines.

Der Strang „LLM-Observability" ist von einem eigenen Rechercheteam nicht zurückgekommen; ich habe ihn selbst nachgeholt und er bleibt deshalb dünner als die übrigen vier. Hauptsächlich fehlen dort belegte Kachel- und Chart-Beschreibungen von Helicone, Portkey und Braintrust — die man vermutlich nur durch Anlegen eines Kontos und Ansehen der Oberfläche bekommt.