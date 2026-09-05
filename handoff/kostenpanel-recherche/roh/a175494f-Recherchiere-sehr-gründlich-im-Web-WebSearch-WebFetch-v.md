# AUFTRAG

Recherchiere sehr gründlich im Web (WebSearch + WebFetch, viele Quellen, mindestens 8-12 verschiedene URLs) die KOSTEN- und NUTZUNGS-DASHBOARDS von **Helicone** (helicone.ai).

Fokus: Doku-Seiten (docs.helicone.ai), GitHub-Repo (Helicone/helicone — z.B. Frontend-Quelltext unter web/components/templates/dashboard, um exakte Kachel-Bezeichnungen zu belegen!), Changelog, Blog. Marketing-Seiten nur als Ergänzung und ausdrücklich als solche kennzeichnen.

Beantworte KONKRET und BELEGT MIT URL für jeden Punkt:
1. Welche KPI-Kacheln stehen oben im Dashboard (GENAUE Bezeichnungen, z.B. "Total Cost", "Total Requests", "Avg Latency", "Error Rate", "Tokens", "Avg Cost per Request"). Wenn du den Quelltext im GitHub-Repo findest, zitiere die exakten Label-Strings und die Datei+URL.
2. Hauptdiagramm: Zeitreihe? Gestapelte Balken? Linie? Fläche? Welches Bucketing/Granularität (Minute/Stunde/Tag)? Wie wird die Granularität gewählt (automatisch nach Zeitraum?)
3. Aufschlüsselungsachsen: Modell, Provider, User (Helicone-User-ID / custom properties), API-Key, Environment, Session, Custom Properties/Tags, Prompt-Version. Welche gibt es konkret? Wo?
4. Tabellen und ihre SPALTEN — insbesondere die "Requests"-Tabelle (welche Spalten default, welche zuschaltbar), die Sessions-Ansicht, die Users-Ansicht (Cost per user?).
5. Interaktionen: Zeitraum-Presets (welche genau? 1h/24h/7d/1m/3m/custom?), Vergleich zur Vorperiode, Hover-Tooltip-Inhalt, Drill-down vom Chart in die Tabelle, Filter-Syntax (Helico

---

# Helicone Kosten- & Nutzungs-Dashboards — Recherchebericht

Methodik: Primärquelle war der Helicone-Quelltext auf GitHub (`Helicone/helicone`, Branch `main`), heruntergeladen per `curl` aus `web/components/templates/dashboard/*`, `web/components/templates/{users,sessions,cache,requests,alerts,properties}/*` und `docs/**/*.mdx` (das Mintlify-Doku-Repo liegt im selben Monorepo unter `/docs`). Zusätzlich WebFetch auf docs.helicone.ai. Alle Aussagen unten sind mit Datei+Pfad (GitHub-Permalink) oder Doku-URL belegt. Wo ich nur Marketing-Text ohne Beleg fand, ist das ausdrücklich vermerkt.

---

## 1. KPI-Kacheln oben im Dashboard

Im Hauptdashboard (`/dashboard`) gibt es **zwei Kachel-Ebenen**, exakt aus dem Quelltext zitiert:

**Obere Reihe – 4 `MetricsPanel`-Kacheln** (Datei: [`dashboardPage.tsx` Z. 213–269](https://github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/dashboardPage.tsx#L213-L269)):
```
label: "Avg Cost / Req"
label: "Avg Prompt Tokens / Req"
label: "Avg Completion Tokens / Req"
label: "Avg Total Tokens / Req"
```

**Darunter – Chart-Panels mit eigenem Titel + großer Zahl** (jeweils `<p className="text-sm text-muted-foreground">…</p>` gefolgt von einem `text-xl font-semibold`-Wert), Zeilen im selben File:
- `"Requests"` (Z. 467) — großer Wert = `metrics.totalRequests`
- `"Costs"` (Z. 588)
- `"Users"` (Z. 737)
- `"Latency"` (Z. 824)
- `"Time to First Token"` (Z. 919)
- `"Threats"` (Z. 1011)
- `"Quantiles"` (Z. eigene Datei, siehe Punkt 7)
- `"Prompt / min"`, `"Completion / min"`, `"Total / min"` (Z. 1158–1166)

Es gibt **kein** Kachel-Label "Error Rate" als eigene KPI-Zahl im Hauptdashboard — Fehler werden als separater Bar-Chart-Panel "Errors"/"All Errors" geführt (siehe Punkt 4). "Total Cost" als Wortlaut taucht NICHT im Haupt-Dashboard auf (dort nur "Costs"/"Avg Cost / Req"), wohl aber wortwörtlich als Spaltenkopf in der **Users**-Tabelle: `header: "Total Cost"` ([`users/initialColumns.tsx` Z. 34](https://github.com/Helicone/helicone/blob/main/web/components/templates/users/initialColumns.tsx#L34)).

Quelle: [dashboardPage.tsx](https://github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/dashboardPage.tsx)

---

## 2. Hauptdiagramm-Typ und Granularität

Gemischt, panel-abhängig, alles `recharts` über eine `ChartContainer`-Wrapper-Komponente:
- **AreaChart** (mit Gradient-Fill): Requests (Success/Error gestapelt), Latency, Time to First Token, Threats, Tokens/min, Quantiles (P75/P90/P95/P99 gestapelt)
- **BarChart**: Costs, Users

Beleg: `<AreaChart …>` / `<BarChart …>` Aufrufe direkt in [dashboardPage.tsx](https://github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/dashboardPage.tsx) (z.B. Z. 584 BarChart für Costs, Z. 733 BarChart für Users).

**Granularität — automatisch, exakt im Code definiert** (Datei [`lib/timeCalculations/time.ts`](https://github.com/Helicone/helicone/blob/main/web/lib/timeCalculations/time.ts)):
```ts
export const getTimeInterval = ({ start, end }) => {
  const diff = end.getTime() - start.getTime();
  if (diff < 1000 * 60 * 60 * 6) return "min";      // < 6 Stunden → Minute
  else if (diff < 1000 * 60 * 60 * 24 * 3) return "hour"; // < 3 Tage → Stunde
  else return "day";                                 // sonst → Tag
};
```
`timeIncrement = getTimeInterval(timeFilter)` wird in `useDashboardPage.tsx`/`dashboardPage.tsx` direkt aus dem gewählten Zeitfenster abgeleitet — reine Client-seitige Automatik, kein manueller Schalter für die Bucket-Größe.

---

## 3. Aufschlüsselungsachsen (Breakdown-Achsen)

Direkt aus der Filter-AST-Doku ([`docs.helicone.ai/rest/request/post-v1requestquery`](https://docs.helicone.ai/rest/request/post-v1requestquery)) und dem Quelltext der Dashboard-Panels belegt. Tabelle `request_response_rmt` (die zentrale ClickHouse-Tabelle) kennt u.a. diese filterbaren Felder:
```
model, provider, user_id, organization_id, cache_enabled, cached, cache_reference_id,
prompt_id, prompt_version, properties, search_properties, scores, country_code,
target_url, request_referrer, is_passthrough_billing, threat, latency, cost, ...
```
Konkrete Dashboard-Panels, die diese Achsen als Balkenlisten anzeigen:
- **Modelle** — `ModelsPanel` ("Top Models by Requests") und `ModelsByCostPanel` ("Top Models by Cost") — [modelsPanel.tsx](https://github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/panels/modelsPanel.tsx), [modelsByCostPanel.tsx](https://github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/panels/modelsByCostPanel.tsx)
- **Provider** — `TopProvidersPanel` ("Top Providers") — [topProvidersPanel.tsx](https://github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/panels/topProvidersPanel.tsx)
- **Land** — `CountryPanel` ("Top Countries") — [countryPanel.tsx](https://github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/panels/countryPanel.tsx)
- **Scores** — `ScoresPanel` / `scores-bool`-Variante (`dashboardPage.tsx` Z. 805/812)
- **User (Helicone-User-Id)** — eigene **Users**-Seite mit Cost-per-User (Punkt 4); im Requests-Chart nur als Zeitreihe "Users" (aktive User pro Bucket), NICHT als Balkenliste im Hauptdashboard
- **API-Key** — Dropdown-Filter "API Key: All / <key_name>" in [`dashboard/filters.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/filters.tsx)
- **Custom Properties / Tags** — eigene Achse; erscheinen laut Doku als zusätzliche Spalten/Filter im Request-Table: *"Custom Properties appear as headers in the `Request` table"* ([`docs/features/advanced-usage/custom-properties.mdx` Z. 11](https://github.com/Helicone/helicone/blob/main/docs/features/advanced-usage/custom-properties.mdx#L11)); im Code werden sie dynamisch als Tabellenspalten mit `meta.category: "Custom Property"` angehängt ([`RequestsPage.tsx` Z. 401–424](https://github.com/Helicone/helicone/blob/main/web/components/templates/requests/RequestsPage.tsx#L401-L424)). Eigene Analyse-Unterseite pro Property/Tag mit 4 Panels (Punkt 4).
- **Session** — eigene Session-Achse via `session_id`/`session_name`/`tag` in der Tabelle `sessions_request_response_rmt`
- **Prompt-Version** — als Filterfeld `prompt_version` vorhanden (siehe Feldliste oben), aber ich fand **keine** eigene UI-Kachel/Balkenliste "By Prompt Version" im Dashboard-Quelltext — nur die Filter-API bestätigt das Feld. → **teils nicht belegt** für eine dedizierte UI-Ansicht.
- **Environment** — KEINE First-Class-Spalte in `request_response_rmt` (nicht in der Feldliste); Environment wird laut Doku nur als **Custom Property** (`Helicone-Property-Environment`) realisiert, nicht als eigene Achse.

---

## 4. Tabellen und Spalten

### Requests-Tabelle
Alle Spalten sind laut Quelltext **standardmäßig aktiv** — `activeColumns` wird mit `getInitialColumns().map(...)` initialisiert (State-Key `requests-table-activeColumns` in `localStorage`), Custom-Property-Spalten werden dynamisch angehängt ([`RequestsPage.tsx` Z. 397–424](https://github.com/Helicone/helicone/blob/main/web/components/templates/requests/RequestsPage.tsx#L397-L424)). Exakte Spalten-Header aus [`requests/initialColumns.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/requests/initialColumns.tsx):

```
Created At, Status, Provider, Request, Response, Model, Total Tokens,
Prompt Tokens, Completion Tokens, Reasoning Tokens, Latency, TFFT, User,
Cost, Feedback, Prompt ID, Country, Prompt Cache Read Tokens,
Prompt Cache Write Tokens, Cache Enabled
```
Nutzer können Spalten per Drag/Toggle-UI aus- und einblenden (persistiert in `localStorage`); Custom-Property-Spalten werden zusätzlich mit Kategorie `"Custom Property"` markiert.

### Users-Tabelle
Exakte Header aus [`users/initialColumns.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/users/initialColumns.tsx):
```
User ID, Total Cost, Active For (Tage), First Active, Last Active,
Requests, Avg Reqs / Day, Avg Tokens / Req, Completion Tokens,
Prompt Tokens, Rate Limited Count
```
→ **"Cost per user" ist explizit vorhanden** (`header: "Total Cost"`, sortierbar per `cost`).

### Sessions-Ansicht
Spalten aus [`sessions/initialColumns.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/sessions/initialColumns.tsx):
```
session_name, session_id, created_at, latest_request_created_at,
total_cost, prompt_tokens, completion_tokens, total_tokens,
total_requests, avg_latency, user_ids
```
Zusätzlich eine Detail-Metrik-Ansicht ([`sessions/SessionMetrics.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/sessions/SessionMetrics.tsx)) mit drei Histogramm-Charts: **"Requests count distribution"**, **"Cost distribution"**, **"Duration distribution"**, wählbar mit Perzentil (p50/p75/p95/p99/p99.9) und Interquartil-Option.

### Custom-Properties-Detailansicht
[`properties/PropertyAnalyticsCharts.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/properties/PropertyAnalyticsCharts.tsx) zeigt pro Property/Tag exakt 4 Panels (Zeilen 286/383/393/493): **"Cost Over Time"**, **"Top Costs"**, **"Requests Over Time"**, **"Top Requests"**.

---

## 5. Interaktionen

**Zeitraum-Presets** — exakt aus [`themedTimeFilterShadCN.tsx` Z. 64–96](https://github.com/Helicone/helicone/blob/main/web/components/shared/themed/themedTimeFilterShadCN.tsx#L64-L96):
```
1h, 3h, 12h, 1d, 3d, 7d, 30d, 90d, 1y   + freier Kalender-Range-Picker + "custom" relative Eingabe (N Stunden/Tage/Wochen)
```
(Die separate `ThemedTimeFilter`-Komponente kennt zusätzlich `TimeInterval = "3m" | "1m" | "7d" | "24h" | "1h" | "all" | "custom"` in [`time.ts`](https://github.com/Helicone/helicone/blob/main/web/lib/timeCalculations/time.ts), aber im Dashboard selbst ist `timeFilterOptions={[]}` gesetzt — dort zählt nur der ShadCN-Picker mit den Presets oben.)

**Besonderheit:** Zeiträume >31 Tage sind hinter `ProFeatureWrapper featureName="time_filter"` gesperrt — kostenloser Tarif kann laut Code nur bis 31 Tage zurückblicken, es öffnet sich stattdessen ein Upgrade-Dialog (`setIsDialogOpen(true)` bei `daysDifference > 31 && !hasAccess`). Beleg: [`themedTimeFilterShadCN.tsx` Z. 108–120](https://github.com/Helicone/helicone/blob/main/web/components/shared/themed/themedTimeFilterShadCN.tsx#L108-L120).

**Vergleich zur Vorperiode:** Im gesamten Dashboard-Code (`dashboardPage.tsx`, `useDashboardPage.tsx`) findet sich **keinerlei** Logik für einen "vs. vorherige Periode"-Vergleich (kein `previous`, `delta`, `%change` o.ä.) — **nicht vorhanden / nicht belegt**.

**Hover-Tooltip-Inhalt:** [`DashboardChartTooltipContent.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/DashboardChartTooltipContent.tsx) zeigt: Zeitstempel-Label oben, darunter pro Serie ein Farbpunkt + Serienname + `toLocaleString()`-formatierter Wert.

**Drill-down vom Chart in die Tabelle:** Im Quelltext fand ich **keinen** Navigations-Aufruf (`router.push`, `href=".../requests"`) von einem Dashboard-Panel zur Requests-Seite. Was es gibt: ein "Expand"-Button (`ArrowsPointingOutIcon`) auf jeder Balkenliste, der ein **In-Page-Modal** mit der vollständigen Liste öffnet (`useExpandableBarList` in [`barListPanel.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/panels/barListPanel.tsx)) — kein Sprung zur Requests-Tabelle. → **Kein bestätigter Klick-Durchgriff, nur Modal-Erweiterung.** Der globale Filter-Zustand (`useFilterStore` aus `@/filterAST/store/filterStore`, [Z. 36–91](https://github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/dashboardPage.tsx#L36-L91)) wird jedoch app-weit geteilt, d.h. ein im Dashboard gesetzter Filter bleibt beim Wechsel auf die Requests-Seite im selben Store erhalten (aus Codestruktur ersichtlich, nicht live getestet).

**Filter-Syntax:** Filter sind ein AST aus `FilterLeaf`/`FilterBranch` (`{left, operator: "and"|"or", right}`), Operatoren nach Typ: Text `equals/not-equals/like/ilike/contains/not-contains`, Zahlen `equals/not-equals/gte/lte/lt/gt`, Timestamps `equals/gte/lte/lt/gt`, Booleans `equals`. Quelle: [`docs.helicone.ai/rest/request/post-v1requestquery`](https://docs.helicone.ai/rest/request/post-v1requestquery).

**Export:** Bestätigt als **Excel (.xlsx)**, nicht CSV — [`DashboardExportButton.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/DashboardExportButton.tsx): Dateiname `helicone-dashboard-<start>-to-<end>.xlsx`, Dialog-Text: *"All dashboard data as an Excel file with separate tabs for metrics, costs, requests, and more."*

---

## 6. Cache-Kacheln

Ja, es gibt eine **eigene Cache-Seite** (`web/components/templates/cache/cachePage.tsx`). Drei Haupt-KPI-Kacheln, exakt aus dem Code ([`cachePage.tsx` Z. 222–241](https://github.com/Helicone/helicone/blob/main/web/components/templates/cache/cachePage.tsx#L222-L241)):
```
label: "Total Cache Hits"   → "<n> hits"
label: "Cost Savings"       → "$<n>"
label: "Time Saved"         → formatiert (ms/s/min/h/d/mo/y)
```
Zusätzlich weiter unten im selben File (Z. 355–382): eine **"Cache Hit Rate"**-Anzeige in Prozent (grün eingefärbt wenn >10%) sowie eine Latenz-Reduktions-Kennzahl (`-<Zeit>` = `avgLatency − avgLatencyCached`), und eine **"Top Requests"**-Liste der meistgecachten Requests (Z. 421).

Doku bestätigt Screenshot: *"Dashboard view of cache hits, cost and time saved"*, Bild `/images/example-cache.png`, Alt-Text: *"Helicone Dashboard showing the number of cache hits, cost, and time saved."* — [`docs/features/advanced-usage/caching.mdx` Z. 275–278](https://github.com/Helicone/helicone/blob/main/docs/features/advanced-usage/caching.mdx#L275-L278).

Cache-Status pro einzelnem Request wird über Response-Header `Helicone-Cache: HIT|MISS` gemeldet; in der Requests-Tabelle selbst gibt es eine Spalte `"Cache Enabled"` (Yes/No) sowie einen `"cached"`-Status-Badge-Zustand (`StatusBadge statusType="cached"`).

---

## 7. Ausreißer/Anomalien und Alerts

**P95/P99-Latenz:** Eigenes **"Quantiles"**-Panel im Dashboard ([`quantilesGraph.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/quantilesGraph.tsx)) mit umschaltbarer Metrik (Latency / Prompt tokens / Completion tokens / Total tokens) und gestapeltem AreaChart über **P75, P90, P95, P99** — Kopfzeile zeigt `Max: <n> s` bzw. `Max: <n> tokens`.

**Teuerste Requests / Sortierung nach Kosten:** Die Requests-API unterstützt `sort: "cost"` (asc/desc) — Beleg: Sort-Optionen-Liste aus der Query-Doku (`cost` ist eines der sortierbaren Felder). In der Users-Tabelle ist `sortKey: "cost"` explizit als Spaltensortierung hinterlegt.

**Alerts** — eigene Seite `Settings → Alerts`. Exakte Metrik-Labels aus [`alertForm.tsx` Z. 359–370](https://github.com/Helicone/helicone/blob/main/web/components/templates/alerts/alertForm.tsx#L359-L370):
```
"response.status" → "Error Rate"
"cost"            → "Cost"
"latency"         → "Latency"
"total_tokens"    → "Total Tokens"
"prompt_tokens"   → "Prompt Tokens"
"completion_tokens" → "Completion Tokens"
"prompt_cache_read_tokens"  → "Prompt Cache Read Tokens"
"prompt_cache_write_tokens" → "Prompt Cache Write Tokens"
"count"           → "Count"
```
Perzentil-Aggregation wählbar: **50th, 75th, 90th, 95th, 99th, 99.9th** ([Z. 478–483](https://github.com/Helicone/helicone/blob/main/web/components/templates/alerts/alertForm.tsx#L478-L483)). Zeitfenster aus [`alerts/constant.ts`](https://github.com/Helicone/helicone/blob/main/web/components/templates/alerts/constant.ts): 5/10/15/30 Minuten, 1 Stunde, 1 Tag, 1 Woche, 1 Monat. Benachrichtigung per E-Mail oder Slack (Doku: [`docs/features/alerts.mdx`](https://github.com/Helicone/helicone/blob/main/docs/features/alerts.mdx), mehrere Screenshots dort referenziert, u.a. `/images/alerts/AL-email-example.webp`).

---

## 8. Geschätzte vs. abgerechnete Kosten

**Ja, explizit als Schätzung dokumentiert.** Doku-Seite [`docs/references/how-we-calculate-cost.mdx`](https://github.com/Helicone/helicone/blob/main/docs/references/how-we-calculate-cost.mdx) (docs.helicone.ai/references/how-we-calculate-cost):

> *"We capture this data, and we **estimate the cost** based on the model returned in the response body, using OpenAI's pricing tables."*

> *"In the case of Anthropic requests, there is no supported method for calculating tokens in Typescript. So, we have to manually calculate the tokens using a Python server."*

Ausdrücklicher Ungenauigkeits-Hinweis (wörtlich zitiert, da Wortlaut selbst die Aussage IST und keine Konversation/Person betrifft — reine Produktdoku):
> *"Please note that these methods are based on our current understanding and may be subject to changes in the future as APIs and token counting methodologies evolve."*

Technisch: das Cost-Package ([`packages/cost/README.md`](https://github.com/Helicone/helicone/blob/main/packages/cost/README.md)) unterscheidet zwei Genauigkeitsstufen:
- **AI Gateway** (Model Registry v2): "complete visibility into model usage" — präzisere Berechnung, da Helicone selbst der Proxy/Gateway ist.
- **Direkte Provider-Integration** (klassischer Async-Logger): "best-effort cost estimates based on model detection and token counts" mit einem offenen Cost-Repository für 300+ Modelle.

Zusätzliches offenes Tool zur Preisrecherche wird verlinkt: *"LLM API Pricing Calculator"* unter helicone.ai/llm-cost (Marketing-Tool, hier nur als Verweis aus der Doku zitiert).

---

## 9. BYOK / "wessen Schlüssel zahlt"

Im **AI Gateway Provider-Prioritäts-System** ([`docs/references/provider-integration.mdx` Z. 152–162](https://github.com/Helicone/helicone/blob/main/docs/references/provider-integration.mdx#L152-L162)) ist die Rangfolge explizit kommentiert:
```ts
// Priority 1: BYOK (Bring Your Own Key) - Reserved for user's own API keys
// Priority 2: Helicone-hosted inference
helicone: 2,
// Priority 3: Premium direct providers
anthropic: 3, openai: 3,
```
Das Cost-Package unterscheidet weiter **PTB (Pass-Through Billing)** vs. **BYOK**: *"BYOK always takes precedence over PTB when available"* und Nutzer können PTB-Fallback pro Provider deaktivieren. Ein Provider-Eintrag trägt außerdem ein Flag `byok_enabled: true` (Test-Mock in [`provider-integration.mdx`](https://github.com/Helicone/helicone/blob/main/docs/references/provider-integration.mdx)).

**Sichtbarkeit im Dashboard:** Die Requests-API/Filter-Tabelle `request_response_rmt` besitzt ein Feld `is_passthrough_billing` (bestätigt über die Filter-Feldliste der Query-Doku) — d.h. **filterbar** in der API. Ich fand jedoch **keinen** UI-Beleg für ein sichtbares Badge/eine Spalte "BYOK" oder "PTB" in der Requests-Tabelle oder im Dashboard: Die `"Provider"`-Spalte/-Pille zeigt nur den Provider-Namen (`openai`, `anthropic`, …), keine Schlüssel-Herkunft ([`requests/providerPill.tsx`](https://github.com/Helicone/helicone/blob/main/web/components/templates/requests/providerPill.tsx)). → **Nicht belegt**, dass das Dashboard UI-seitig anzeigt, "wessen Schlüssel" gezahlt hat — nur die API/Datenbank kennt das Feld.

---

## Zusammenfassungstabelle

| Produkt | Kopfkacheln | Hauptdiagramm | Aufschlüsselungsachsen | Besonderheit | Quelle-URL |
|---|---|---|---|---|---|
| Helicone Dashboard | "Avg Cost / Req", "Avg Prompt/Completion/Total Tokens / Req" (4 Kacheln) + Panel-Titel "Requests"/"Costs"/"Users"/"Latency"/"Time to First Token"/"Threats" | AreaChart (Requests/Latency/TTFT/Threats/Tokens-per-min/Quantiles) + BarChart (Costs, Users); Bucketing automatisch: <6h→Minute, <3d→Stunde, sonst Tag | Modelle (Requests/Cost getrennt), Provider, Land, Scores, API-Key, User, Custom Properties, Session | Zeiträume >31 Tage hinter Pro-Feature-Gate; Export nur als .xlsx, kein Perioden-Vergleich im Code | github.com/Helicone/helicone/blob/main/web/components/templates/dashboard/dashboardPage.tsx |
| Helicone Cache-Seite | "Total Cache Hits", "Cost Savings", "Time Saved" + separates "Cache Hit Rate"-%-Feld | AreaChart Cache-Hits über Zeit | Top-gecachte Requests | Nutzt Cloudflare-Edge-KV; Cache-Key hasht Seed+URL+Body+Headers+Bucket-Index | github.com/Helicone/helicone/blob/main/web/components/templates/cache/cachePage.tsx |
| Helicone Cost-Berechnung | (kein Kachel-Feature, Berechnungslogik) | — | Modell-basierte Preistabellen (OpenAI-Preise; Anthropic via eigenem Python-Tokenizer) | Explizit als Schätzung deklariert, kein Genauigkeits-Garantie | github.com/Helicone/helicone/blob/main/docs/references/how-we-calculate-cost.mdx |