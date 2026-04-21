---
title: "Bureau Ops — AI Spend & Signal Control Center Implementation Plan"
version: "1.0"
date: "2026-04-21"
type: plan
status: ready-to-implement
lang: en
---

# Bureau Ops — Implementation Plan

> **Status:** READY TO IMPLEMENT. No code written yet (concept-level `circuit_breaker_service.py` drafted during planning, then reverted — will be rebuilt as P0.2 under the plan).
>
> **Scope:** Full `/bureau/dispatch/ops` admin panel for AI cost observability + Sentry signal control + automatic circuit-breaking. 5 phases, 37 tasks, ~10-14 session hours sequential.
>
> **Current incident trigger:** OpenRouter key-limit-exceeded (403) cascade from 2026-04-18 produced 3836 Sentry events in 3 days, hitting the 5000/month limit. P0 phase stops this within hours of deploy.

---

## 1. Context

Last three days surfaced three coupled failures: OpenRouter credits burned through retry-cascades, Sentry's 5000-event monthly quota reached from one single error class duplicated across three fingerprints, and no admin visibility into either signal. The ongoing alpha phase amplifies risk — cost spikes in dev stay invisible until the monthly invoice lands, and Sentry rate-limiting blinds us to non-AI bugs. This plan builds the missing control surface.

**Existing infrastructure we can reuse:**
- `ai_usage_log` table with cost + token + purpose + simulation attribution (migration 150)
- `AIUsageService.log()` fire-and-forget logging + `get_ai_usage_stats()` RPC (migration 152)
- `platform_settings` key-value store with admin UI editing pattern (migration 040)
- `AdminAIUsageTab`, `AdminHealthTab`, `AdminHeartbeatTab` as stylistic baselines
- `VelgMetricCard`, `VelgEchartsChart`, `VelgToggle`, `VelgBaseModal`, `VelgToast`, `VelgRedacted`
- Sentry SDK with logger-integration + breadcrumb support already wired
- Supabase Realtime for `INSERT` subscriptions

**What's new in this plan:**
- 4 DB tables (`ai_circuit_state`, `ai_budget`, `ops_audit_log`, `sentry_rules`)
- 1 materialized view + pg_cron refresh
- 4 backend services (`CircuitBreakerService`, `OpsLedgerService`, `BudgetEnforcementService`, `OpsForecastService`)
- 1 router (`/admin/ops/*` with 10 endpoints)
- 1 sentry `before_send` hook with rule cache
- 1 admin tab with 8 panels
- 6 new frontend primitives
- 1 full ARG-polish pass

---

## 2. Scope

### In-scope (this plan)
- Automatic circuit breaker for OpenRouter calls (auto + manual trip)
- Hard and soft budget caps per purpose / simulation / user
- Live firehose of AI calls (WebSocket)
- Heatmap with bubble-up drill-down
- Cost forecast with what-if sliders
- Sentry rule CRUD (ignore, fingerprint, downgrade) backed by DB
- Incident audit log with replay
- CUT ALL AI emergency kill switch

### Out-of-scope (explicit non-goals)
- Per-user billing / invoicing (future)
- Multi-region / multi-worker circuit state coordination via Redis (future — current in-process state is sufficient for single-instance Railway deploy)
- Cost prediction via ML (linear regression + seasonal is enough for 18-day horizon)
- Integration with OpenRouter's native rate-limit headers (their API does not expose remaining-credits yet — we infer from 403s)
- Retention policies / archival of `ai_usage_log` (current growth rate manageable for 12+ months)

---

## 3. Locked Architecture Decisions

These are settled before implementation starts. Deviating requires an amendment to this plan.

### AD-1: Circuit state is in-process, not Redis-backed
**Decision:** `CircuitBreakerService` holds state in Python dict + Lock. No Redis dependency.

**Rationale:** Single Railway worker in current deployment. The hot path is retry-cascade *inside a single request*, which a worker-local breaker already prevents. Cross-worker coordination would add infra for marginal benefit. If we scale horizontally later, add a Redis sync layer — design leaves room for it (`_Counter` is serializable).

### AD-2: Sentry rules are DB-driven from P2 onward; P0 uses hardcoded rules
**Decision:** P0 ships with 3 hardcoded rules in `_ops_before_send`. P2 replaces with `sentry_rules` table + 30s in-memory cache + `NOTIFY`-triggered invalidation.

**Rationale:** P0 must ship within 1-2 days to stop the bleeding. Admin UI for rule editing can come later; the 3 hardcoded rules cover 95% of current noise.

### AD-3: Budget enforcement is pre-call (blocking), not async-billed
**Decision:** `BudgetEnforcementService.pre_check()` runs synchronously before every OpenRouter call. Over-budget → raises `BudgetExceededError`, fail-fast.

**Rationale:** Reactive billing (charge-then-check) leaks credits. Pre-check adds one rolled-up Postgres query per call (~3ms with index). Cost of one extra query << cost of one retry cascade. Rolled-up sums served from materialized view (P2.6), refresh every 1min.

### AD-4: Firehose via Supabase Realtime, no custom WebSocket
**Decision:** Frontend subscribes to `ai_usage_log:INSERT` via `@supabase/supabase-js`. No new WebSocket infrastructure.

**Rationale:** Existing Realtime channel, RLS-enforced (platform-admin can subscribe globally). SSE fallback only if we hit Realtime scale limits (unlikely at current volume).

### AD-5: Kill-switches have mandatory auto-revert
**Decision:** Every manual kill-switch action requires a revert-at timestamp (default 60min, admin-settable up to 24h). No "permanent kill" from UI — if permanent is needed, edit the `platform_settings` flag directly.

**Rationale:** Kill switches that stay killed until someone remembers to revert them are the root of many outages. Auto-revert with reminder-toast 5min before expiry ensures operators consciously decide to re-kill rather than drift into off-by-default.

### AD-6: Forecast is client-side linear + seasonal, NL-driver text via cheap model
**Decision:** Projection math runs in browser JS from ledger snapshot (last 30d per-call averages). NL driver-text generation calls OpenRouter Haiku (cheap, ~$0.002/call) once per panel-open, cached 5min.

**Rationale:** Slider-dragging needs <100ms response — impossible with backend roundtrip. NL text is static once computed; paying $0.002 to explain a $4000 forecast is good ROI.

### AD-7: All panels inside one AdminOpsTab, not scattered across existing tabs
**Decision:** Single new tab "BUREAU OPS" added to `AdminPanel` navigation under "Systems" section. Existing AIUsage/Health/Heartbeat tabs remain as inspection views.

**Rationale:** Context-switching between 3 tabs during an incident adds latency. Ops gets its own cockpit. Existing tabs provide detail drill-downs.

### AD-8: Redacted-by-default for PII-adjacent fields
**Decision:** `user_id`, `simulation_id`, prompt bodies, API key excerpts, messages all rendered inside `<velg-redacted>` with hover-reveal. Default state is black-bar.

**Rationale:** ARG-consistent *and* DSGVO-prudent. Operators doing quick dashboard scans don't accidentally memorize user PII.

---

## 4. Data Model

### 4.1 Migration 228: core ops tables

Next available number: **228** (last committed: 227 orphan_sweeper_scheduler_settings).

```sql
-- supabase/migrations/20260421200000_228_bureau_ops.sql

-- ai_circuit_state: persisted circuit breaker state (admin-triggered kills only)
CREATE TABLE ai_circuit_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,                              -- 'purpose' | 'model' | 'provider' | 'global'
  scope_key text NOT NULL,                          -- e.g. 'heartbeat', 'deepseek/deepseek-chat'
  state text NOT NULL CHECK (state IN ('closed','killed')),
  triggered_by_id uuid REFERENCES auth.users(id),
  reason text NOT NULL,
  revert_at timestamptz NOT NULL,                   -- mandatory auto-revert (AD-5)
  created_at timestamptz DEFAULT now(),
  UNIQUE (scope, scope_key)
);
CREATE INDEX ON ai_circuit_state (revert_at);       -- for scheduled revert sweep

-- Runtime (closed/half_open/open) state lives in-process (AD-1).
-- This table holds only admin-killed overrides, persisted for durability.

-- ai_budget: cost caps per scope × period
CREATE TABLE ai_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,                              -- 'global' | 'purpose' | 'simulation' | 'user'
  scope_key text NOT NULL,                          -- matches scope
  period text NOT NULL CHECK (period IN ('hour','day','month')),
  max_usd numeric(10,4) NOT NULL,
  max_calls integer,                                -- optional count cap
  soft_warn_pct integer DEFAULT 75 CHECK (soft_warn_pct BETWEEN 10 AND 100),
  hard_block_pct integer DEFAULT 100 CHECK (hard_block_pct BETWEEN 50 AND 200),
  enabled boolean DEFAULT true,
  updated_by_id uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (scope, scope_key, period)
);

-- ops_audit_log: every kill, revert, budget change, rule change
CREATE TABLE ops_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,                             -- 'kill.trip', 'kill.revert', 'budget.upsert', 'sentry.rule.create', etc.
  target_scope text,
  target_key text,
  reason text NOT NULL CHECK (length(trim(reason)) >= 3),
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON ops_audit_log (created_at DESC);
CREATE INDEX ON ops_audit_log (actor_id, created_at DESC);
CREATE INDEX ON ops_audit_log (action, created_at DESC);

-- sentry_rules: DB-backed ignore/fingerprint/downgrade rules (used from P2)
CREATE TABLE sentry_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('ignore','fingerprint','downgrade')),
  match_exception_type text,                        -- exact match or NULL for any
  match_message_regex text,                         -- Python regex, NULL for any
  match_logger text,                                -- logger-name prefix match
  fingerprint_template text,                        -- e.g. 'openrouter.{exc_type}.{model}'
  downgrade_to text CHECK (downgrade_to IN ('warning','info') OR downgrade_to IS NULL),
  enabled boolean DEFAULT true,
  note text NOT NULL,                               -- why this rule exists (mandatory!)
  silenced_count_24h integer DEFAULT 0,             -- rolling counter for UI
  updated_by_id uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Seed P0 default budgets so the service has something to enforce against
INSERT INTO ai_budget (scope, scope_key, period, max_usd, soft_warn_pct, hard_block_pct, enabled)
VALUES
  ('global', 'global', 'day', 50.00, 75, 100, true),
  ('global', 'global', 'month', 1000.00, 75, 100, true),
  ('purpose', 'forge', 'day', 20.00, 75, 100, true),
  ('purpose', 'heartbeat', 'day', 15.00, 75, 100, true),
  ('purpose', 'chat_memory', 'day', 10.00, 75, 100, true)
ON CONFLICT (scope, scope_key, period) DO NOTHING;

-- RLS: service_role only. Admin-panel writes go through /admin/ops/* endpoints.
ALTER TABLE ai_circuit_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentry_rules ENABLE ROW LEVEL SECURITY;

-- Trigger-enforced: audit-log INSERT on every kill/budget/rule mutation
-- (implemented via backend service, not DB trigger, to capture actor cleanly)
```

### 4.2 Migration 229: rollup materialized view

```sql
-- supabase/migrations/20260421300000_229_ai_usage_rollup.sql

CREATE MATERIALIZED VIEW ai_usage_rollup_hour AS
SELECT
  date_trunc('hour', created_at) AS hour,
  purpose,
  model,
  provider,
  simulation_id,
  count(*) AS calls,
  sum(total_tokens) AS tokens,
  sum(estimated_cost_usd) AS usd,
  count(*) FILTER (WHERE (metadata->>'status') = 'error') AS errors,
  avg(duration_ms)::integer AS avg_duration_ms
FROM ai_usage_log
WHERE created_at > now() - interval '30 days'
GROUP BY 1,2,3,4,5;

CREATE UNIQUE INDEX ON ai_usage_rollup_hour (hour, purpose, model, provider, simulation_id);
CREATE INDEX ON ai_usage_rollup_hour (hour DESC);
CREATE INDEX ON ai_usage_rollup_hour (purpose, hour DESC);

-- pg_cron extension enablement is manual (Supabase superuser required); the
-- migration only creates the refresh function.
CREATE OR REPLACE FUNCTION refresh_ai_usage_rollup_hour() RETURNS void AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY ai_usage_rollup_hour;
$$ LANGUAGE sql SECURITY DEFINER;

-- Manual step (post-deploy): SELECT cron.schedule('refresh-ai-rollup', '* * * * *', 'SELECT refresh_ai_usage_rollup_hour()');
-- This is documented in migration-strategy.md.
```

### 4.3 Invariants

1. **Every `ops_audit_log` INSERT has a non-empty `reason`** (DB CHECK enforced).
2. **`ai_circuit_state.revert_at` is always in the future on INSERT** (enforced by backend, asserted in tests).
3. **`ai_budget.hard_block_pct >= ai_budget.soft_warn_pct`** — enforced as CHECK? No, flexibility left for experiments. Validated at service layer.
4. **`sentry_rules.note` is mandatory** (DB NOT NULL). Rules without documentation rot.
5. **Materialized view refresh is idempotent** (`CONCURRENTLY`) — no race with queries.

---

## 5. Backend Architecture

### 5.1 New services

| Service | File | Responsibility |
|---|---|---|
| `CircuitBreakerService` | `backend/services/circuit_breaker_service.py` | In-process auto circuit breaker (AD-1). Thread-safe singleton. |
| `OpsLedgerService` | `backend/services/ops_ledger_service.py` | Read-facade for all panel data. 30s server cache. |
| `BudgetEnforcementService` | `backend/services/budget_enforcement_service.py` | Pre-call budget check against rollup view. |
| `OpsForecastService` | `backend/services/ops_forecast_service.py` | Linear + seasonal projection + NL driver text. |
| `SentryRuleCache` | `backend/services/sentry_rule_cache.py` | 30s TTL cache over `sentry_rules`. `NOTIFY`-invalidated. |

### 5.2 `CircuitBreakerService` — state machine

Already drafted during planning (reverted). Re-implementation under P0.2 follows:

```
State machine:
    closed    (success)    → closed
    closed    (failure × N in window) → open (backoff = 5min × 2^consecutive_opens)
    open      (timer elapsed)  → half_open
    half_open (success)    → closed (reset consecutive_opens)
    half_open (failure)    → open (backoff ×2)

Defaults: threshold=5, window=60s, base_open=5min, max_open=1h

Public API:
  check(scope, scope_key)               → raises CircuitOpenError
  record_failure(scope, scope_key, ...) → may transition to open
  record_success(scope, scope_key)      → may transition to closed
  get_state(scope, scope_key)           → dict for UI
  snapshot()                            → list of all known states
  reset(scope, scope_key)               → admin hook
```

Scopes used:
- `('provider', 'openrouter')` — all OpenRouter calls
- `('model', '{model_id}')` — per-model (e.g. `deepseek/deepseek-chat`)
- `('purpose', '{purpose}')` — per-purpose (e.g. `heartbeat`, `forge`)

On failure: record against all three scopes. On check: validate all three; fail-fast on the first open.

### 5.3 `OpenRouterService` integration

`backend/services/external/openrouter.py:generate()` sequence:

```python
async def generate(self, model, messages, ...):
    # 1. Pre-call: circuit breaker check
    circuit_breaker.check('provider', 'openrouter')
    circuit_breaker.check('model', model)
    # purpose not known here — checked at calling layer

    # 2. Budget pre-check (skipped if no calling context — add later)
    # ... existing code ...

    try:
        response = await client.post(...)
        if response.status_code in (402, 403, 429, 503):
            # Trip circuit on credit/quota/rate errors
            circuit_breaker.record_failure('provider', 'openrouter',
                                            exception_type=f'HTTP_{response.status_code}')
            circuit_breaker.record_failure('model', model,
                                            exception_type=f'HTTP_{response.status_code}')
            raise _map_status(response.status_code, model, response.text)
        # ...
        circuit_breaker.record_success('provider', 'openrouter')
        circuit_breaker.record_success('model', model)
        return content
    except (httpx.TimeoutException, httpx.ConnectError):
        circuit_breaker.record_failure('provider', 'openrouter', exception_type='network')
        raise
```

Similar integration in `stream_completion()` and `generate_image()`.

### 5.4 `ai_utils.py` changes (P0.4, P0.5)

Two surgical changes:

```python
# Line 161-164: downgrade rate/credit errors to warning
except ModelHTTPError as exc:
    if exc.status_code != 429:
        elapsed = time.monotonic() - t0
        level = logger.warning if exc.status_code in (402, 403) else logger.error
        level("AI call failed", extra={"purpose": purpose, "elapsed_s": round(elapsed, 1),
                                       "status_code": exc.status_code}, exc_info=True)
        raise

# Line 277: default retries 3 → 1 (run_ai has its own retry layer)
def create_forge_agent(system_prompt, api_key=None, purpose="forge", retries: int = 1):
```

### 5.5 New router

```
backend/routers/admin/ops.py

GET   /admin/ops/ledger                  OpsLedgerService.get_ledger_snapshot
GET   /admin/ops/firehose?limit=50       OpsLedgerService.get_firehose (initial page, then Realtime)
GET   /admin/ops/circuit                 OpsLedgerService.get_circuit_matrix (auto + manual state combined)
GET   /admin/ops/heatmap?days=7          OpsLedgerService.get_heatmap (from rollup view)
GET   /admin/ops/forecast                OpsForecastService.project + driver_text
GET   /admin/ops/sentry-budget           OpsLedgerService.get_sentry_budget (Sentry API)
GET   /admin/ops/audit?days=7            audit-log paginated
POST  /admin/ops/kill                    body: {scope, scope_key, reason, revert_after_minutes}
POST  /admin/ops/revert                  body: {scope, scope_key, reason}
PUT   /admin/ops/budget/{id}             body: {max_usd, soft_warn_pct, hard_block_pct, enabled}
POST  /admin/ops/budget                  create new budget
DELETE /admin/ops/budget/{id}            delete
POST  /admin/ops/sentry/rules            create rule
PUT   /admin/ops/sentry/rules/{id}       update rule
DELETE /admin/ops/sentry/rules/{id}      delete rule
POST  /admin/ops/circuit/reset           body: {scope, scope_key, reason} — admin force-reset
```

All endpoints: `require_platform_admin`, typed `SuccessResponse[T]`, Pydantic models from `backend/models/bureau_ops.py`. Register under existing `/admin` prefix — matches existing `admin.py` pattern.

### 5.6 Sentry `before_send` hook

```python
# backend/app.py (P0 version, hardcoded rules)

def _ops_before_send(event, hint):
    exc_info = hint.get("exc_info")
    if not exc_info:
        return event
    exc_type, exc, _ = exc_info

    msg = str(exc)

    # Rule 1: drop "Key limit exceeded" bursts entirely
    if "Key limit exceeded" in msg or "insufficient_quota" in msg:
        return None

    # Rule 2: fingerprint RateLimitError by (type, model)
    if exc_type and exc_type.__name__ in ("RateLimitError", "ModelUnavailableError"):
        tags = {t["key"]: t["value"] for t in event.get("tags", []) if isinstance(t, dict)}
        model = tags.get("model", "unknown")
        event["fingerprint"] = ["openrouter", exc_type.__name__, model]

    # Rule 3: downgrade pydantic-ai ModelHTTPError 402/403/503 to warning
    if exc_type and exc_type.__name__ == "ModelHTTPError":
        status = getattr(exc, "status_code", None)
        if status in (402, 403, 503):
            event["level"] = "warning"

    return event
```

P2 replaces with DB-driven version using `SentryRuleCache`.

---

## 6. Frontend Architecture

### 6.1 Component tree

```
frontend/src/components/admin/
  AdminOpsTab.ts                         root, loads OpsLedgerService snapshot, grid layout
  ops/
    LedgerPanel.ts                       panel ①
    BurnRatePanel.ts                     panel ②
    CircuitMatrixPanel.ts                panel ③
    QuarantinePanel.ts                   panel ④
    SentryRulesPanel.ts                  panel ⑤
    FirehosePanel.ts                     panel ⑥
    HeatmapPanel.ts                      panel ⑦
    ForecastPanel.ts                     panel ⑧
    DispatchTicker.ts                    footer bar
    IncidentDossierDrawer.ts             (opened from Quarantine panel)

frontend/src/components/shared/
  VelgKineticCounter.ts                  rolling digits for Ledger
  VelgKillSwitch.ts                      3D button with confirm + glass cover variant
  VelgDotMatrixCell.ts                   3×3 state indicator
  VelgHeatmapGrid.ts                     24×7 with drag-select
  VelgFirehoseStream.ts                  auto-scrolling table with Realtime
  VelgForecastSlider.ts                  range + live-delta label
```

### 6.2 New API service

```typescript
// frontend/src/services/api/BureauOpsApiService.ts

export class BureauOpsApiService extends BaseApiService {
  async getLedger(): Promise<ApiResponse<LedgerSnapshot>>
  async getFirehose(limit = 50): Promise<ApiResponse<FirehoseEntry[]>>
  async getCircuit(): Promise<ApiResponse<CircuitState[]>>
  async getHeatmap(days = 7): Promise<ApiResponse<HeatmapCell[]>>
  async getForecast(): Promise<ApiResponse<ForecastProjection>>
  async getSentryBudget(): Promise<ApiResponse<SentryBudget>>
  async getAuditLog(days = 7, limit = 50): Promise<ApiResponse<OpsAuditEntry[]>>

  async tripKill(body: { scope: string; scopeKey: string; reason: string; revertAfterMinutes: number })
  async revertKill(body: { scope: string; scopeKey: string; reason: string })
  async resetCircuit(body: { scope: string; scopeKey: string; reason: string })
  async upsertBudget(body: BudgetCap)
  async deleteBudget(id: string)
  async createSentryRule(body: SentryRule)
  async updateSentryRule(id: string, body: Partial<SentryRule>)
  async deleteSentryRule(id: string)
}

export const bureauOpsApi = new BureauOpsApiService();
```

### 6.3 Refresh cadence per panel

| Panel | Data source | Refresh |
|---|---|---|
| Ledger | `/admin/ops/ledger` | 30s polling + on-focus |
| Burn Rate | same as Ledger | derived, no separate call |
| Circuit Matrix | `/admin/ops/circuit` | 10s polling |
| Quarantine | same as Circuit | derived |
| Firehose | Supabase Realtime `ai_usage_log:INSERT` | push |
| Heatmap | `/admin/ops/heatmap` | 5min (materialized view refresh: 1min) |
| Forecast | `/admin/ops/forecast` | on-panel-open + after slider changes |
| Sentry Rules | `/admin/ops/sentry/rules` | on-mount + after mutations |
| Audit Log | `/admin/ops/audit` | on-drawer-open |

---

## 7. Sentry Integration Semantics

### 7.1 Rule types

**Ignore rule:** matching events are dropped entirely (`return None` in `before_send`). Use for: spammy ops signals (credit exhausted, rate limit bursts after circuit opens).

**Fingerprint rule:** matching events get a custom Sentry-fingerprint, collapsing duplicates into one issue group. Use for: same error class across many models/purposes that would otherwise create dozens of issues.

**Downgrade rule:** matching events get their `level` set to `warning` or `info`. Sentry still records them but they don't count toward error quota and don't page. Use for: known-noisy loggers that occasionally have real errors.

### 7.2 Rule ordering

Applied in order: `ignore` → `fingerprint` → `downgrade`. First match in each class wins. If an event is ignored by any rule, downstream rules are not evaluated.

### 7.3 Cache invalidation

`SentryRuleCache` holds rules in memory with 30s TTL. On `INSERT` / `UPDATE` / `DELETE` of `sentry_rules`, the backend calls `NOTIFY sentry_rules_changed` via Postgres. A listener task invalidates the cache immediately. If the listener is unreachable, the 30s TTL provides a bounded staleness window.

### 7.4 Silenced-count metric

Each rule tracks `silenced_count_24h` — incremented every time a rule matches. Exposed in the UI as "this rule prevented 417 events in the last 24h" — makes it visible whether the rule is pulling weight or is dead weight. Reset daily via pg_cron.

---

## 8. Phased Breakdown

### Phase 0 — Emergency Brake (P0)

**Goal:** Stop the current Sentry/Credit burn within 1-2 days.

**Tasks:**

| # | Task | Files | LOC |
|---|---|---|---|
| P0.1 | Sentry `before_send` with 3 hardcoded rules | `backend/app.py` (+20) | 20 |
| P0.2 | `CircuitBreakerService` (in-memory) | `backend/services/circuit_breaker_service.py` (new) | ~200 |
| P0.3 | OpenRouter pre-call integration | `backend/services/external/openrouter.py` (+30) | 30 |
| P0.4 | `ai_utils.py` log downgrade for 402/403 | `backend/services/ai_utils.py` (-2/+3) | 3 |
| P0.5 | `create_forge_agent(retries=1)` default | `backend/services/ai_utils.py` (-1/+1) | 1 |
| P0.6 | Unit tests | `backend/tests/test_circuit_breaker_service.py` (new, 6 cases), `backend/tests/test_sentry_before_send.py` (new, 3 cases) | ~200 |

**Exit criteria:**
- All 6 tasks merged
- Backend tests pass
- Deploy to prod
- Sentry event rate drops ≥80% within 2h of deploy (measured via Sentry stats endpoint)
- Next OpenRouter outage causes ≤5 failed requests total (not 1200+)

**Success metric:** Monthly Sentry event rate projected to stay <2000/month even during provider outages.

### Phase 1 — Minimal Ops Panel (P1)

**Goal:** Live observability + manual control without code-push.

**Tasks:** P1.1–P1.14 (14 tasks, ~5 days)

**Files new:**
- `supabase/migrations/20260421200000_228_bureau_ops.sql`
- `backend/models/bureau_ops.py`
- `backend/services/ops_ledger_service.py`
- `backend/services/budget_enforcement_service.py`
- `backend/routers/admin/ops.py`
- `frontend/src/services/api/BureauOpsApiService.ts`
- `frontend/src/components/admin/AdminOpsTab.ts`
- `frontend/src/components/admin/ops/{LedgerPanel,BurnRatePanel,QuarantinePanel,FirehosePanel}.ts`
- `frontend/src/components/shared/{VelgKineticCounter,VelgKillSwitch,VelgFirehoseStream}.ts`

**Files modified:**
- `frontend/src/components/admin/AdminPanel.ts` (register new tab)
- `backend/app.py` (include new router)
- `frontend/src/services/api/index.ts` (export bureauOpsApi)

**Exit criteria:**
- Panels ①②④⑥ render with live data
- Kill-switch trip/revert works end-to-end
- Firehose scrolls in real-time via Realtime
- All 5 frontend lint gates + typecheck + backend tests green

### Phase 2 — Signal Control + Heatmap (P2)

**Goal:** Non-developer admins can edit Sentry rules without deploys. Anomaly drill-down via BubbleUp.

**Tasks:** P2.1–P2.8 (8 tasks, ~4 days)

**Files new:**
- `backend/services/sentry_rule_cache.py`
- `supabase/migrations/20260421300000_229_ai_usage_rollup.sql`
- `frontend/src/components/admin/ops/{CircuitMatrixPanel,SentryRulesPanel,HeatmapPanel}.ts`
- `frontend/src/components/admin/ops/IncidentDossierDrawer.ts`
- `frontend/src/components/shared/{VelgDotMatrixCell,VelgHeatmapGrid}.ts`

**Files modified:**
- `backend/app.py` (_ops_before_send now reads from SentryRuleCache)

**Exit criteria:**
- Admin can add/edit/delete Sentry rules from UI; changes take effect within 30s
- Heatmap drag-select shows BubbleUp attribution
- Circuit matrix reflects auto + manual state
- Incident dossier shows ops_audit_log with filters

### Phase 3 — Forecasting (P3)

**Goal:** What-if planning before deploying new features.

**Tasks:** P3.1–P3.4 (4 tasks, ~3 days)

**Files new:**
- `backend/services/ops_forecast_service.py`
- `frontend/src/components/admin/ops/{ForecastPanel,DispatchTicker}.ts`
- `frontend/src/components/shared/VelgForecastSlider.ts`

**Exit criteria:**
- Forecast Oracle projects end-of-month cost with ±1σ confidence
- 5 what-if sliders update projection in <100ms client-side
- Haiku-generated NL driver text appears on panel-open, cached 5min
- Dispatch Ticker shows last 20 ops events with auto-scroll + pause-on-hover

### Phase 4 — Polish + ARG (P4)

**Goal:** Bureau-Dispatch aesthetic consistency + delight moments.

**Tasks:** P4.1–P4.5 (5 tasks, ~2 days)

**Files modified:** all ops/* files (styling pass)

**Files new:**
- `docs/guides/bureau-ops.md`

**Exit criteria:**
- Scanline overlay, corner brackets, redacted-reveal everywhere
- CUT ALL AI triggers CRT-tube-off animation (reduced-motion: instant)
- Full CLAUDE.md rule compliance verified
- End-to-end WebMCP playtest of all 8 panels

---

## 9. Dependency Graph

```
P0.2 (CircuitBreakerService) ────┐
                                 ├──> P0.3 (OpenRouter integration)
                                 │
P0.1 (Sentry before_send) ──────┼──> DEPLOY P0
                                 │
P0.4 (ai_utils downgrade) ───────┤
P0.5 (retries=1)         ────────┤
                                 │
P0.6 (tests) ────────────────────┘

P1.1 (migration 228) ──> P1.2 (Pydantic models) ──> P1.3 (OpsLedgerService) ───┐
                                                ├──> P1.4 (BudgetEnforcement)  │
                                                └──> P1.5 (ops router) ────────┤
                                                                                │
P1.6 (AdminOpsTab shell) ──> P1.7 (VelgKineticCounter) ──> P1.8 (LedgerPanel) ─┤
                         ├──> P1.10 (VelgKillSwitch) ───> P1.11 (Quarantine) ──┤
                         └──> P1.12 (VelgFirehoseStream) ─> P1.13 (Firehose) ──┤
                                                                                │
                                                P1.9 (BurnRate, reuses ledger) ─┤
                                                                                │
                                                            P1.14 (lint/tests)<─┘

P2.1 (Sentry rules from DB) <── depends on P1.5 schema
P2.2 (VelgDotMatrixCell) ──> P2.3 (CircuitMatrixPanel)
P2.4 (SentryRulesPanel) <── depends on P2.1
P2.5 (VelgHeatmapGrid) ──┐
P2.6 (materialized view) ├──> P2.7 (HeatmapPanel)
P2.8 (IncidentDossier) ──── parallelizable

P3.1 (forecast algo) ──> P3.2 (slider primitive) ──> P3.3 (ForecastPanel)
P3.4 (DispatchTicker) ──── parallelizable

P4.* all parallelizable (pure styling/docs)
```

**Critical path:** P0 → P1.1 → P1.2 → (P1.3, P1.4, P1.5) → P1.6 → (panels) → deploy. All of P2/P3/P4 block-free after P1 ships.

---

## 10. Test Strategy

### Unit tests (fast, mocked)
- `test_circuit_breaker_service.py` — 6 scenarios: open on threshold, half-open transition, re-open on half-open failure, reset clears state, exponential backoff cap, success in closed state doesn't count as probe
- `test_sentry_before_send.py` — 3 scenarios: ignore rule drops event, fingerprint rule sets correct fingerprint, downgrade rule sets level
- `test_budget_enforcement_service.py` — 5 scenarios: under-budget allows, soft-warn triggers breadcrumb, hard-block raises, period boundary transition, missing budget row = allow (fail-open)
- `test_ops_forecast_service.py` — 3 scenarios: linear projection with known data, seasonal adjustment applies, driver attribution identifies top purpose

### Integration tests (real Supabase)
- `test_ops_router.py` — all 10+ endpoints: kill/revert round-trip, budget CRUD, rule CRUD, audit log append, circuit matrix shape
- `test_ops_realtime.py` — Supabase Realtime subscription receives INSERT event

### Frontend tests (vitest)
- `VelgKillSwitch.test.ts` — confirm flow, reason-required validation, auto-revert timer
- `VelgKineticCounter.test.ts` — digit rolling, reduced-motion fallback
- `VelgFirehoseStream.test.ts` — 50-row window, oldest fade-out

### Manual (WebMCP playtest)
- Full end-to-end flow through all 8 panels
- Incident simulation: deliberately trip circuit, observe dashboard behavior
- Load test: 1000 firehose events in 60s, verify UI doesn't lag

---

## 11. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Supabase Realtime `INSERT` subscription needs RLS policy; default blocks admin global subscribe | Medium | Firehose blank | Add explicit `SELECT` policy for `service_role` (admin client uses service_role JWT) |
| `pg_cron` not enabled on Supabase hosted; requires manual superuser grant | High | Materialized view stale | Document manual step in `migration-strategy.md`; fallback: backend task refreshes every 1min |
| Circuit breaker state lost on worker restart → retry cascade still possible immediately after deploy | Low | Short-lived regression | Acceptable — state rebuilds within 60s window after restart; restart frequency is low |
| `SentryRuleCache` `NOTIFY` listener task dies silently | Medium | Rules stale for up to 30s | TTL provides bounded staleness; health-check endpoint surfaces listener status |
| Forecast NL text via Haiku adds its own OpenRouter call → recursive dependency on the system we're monitoring | Low | Minor | Cache 5min, budget-exempt this purpose, circuit-break if Haiku returns 402 |
| Materialized view refresh takes longer than 1min at high volume | Low | Refresh queue, dashboard stale | `CONCURRENTLY` prevents lock; fallback to live query if refresh_at is >5min old |
| CUT ALL AI mid-flight breaks active Forge ignites | Medium | User frustration | Kill-switch only blocks NEW calls; in-flight requests complete their current attempt (no retry) |
| Admin accidentally adds ignore-rule that silences real bugs | High | Blind to new issues | Rule mandatory `note` field + `silenced_count_24h` visible + weekly audit review prompt |
| Budget pre-check adds latency on hot path | Medium | Chat-memory response slower by 3-5ms | Acceptable; served from materialized view index; <10ms p99 |
| Circuit-breaker scope proliferation (many unique model names) → memory growth | Low | Slow memory leak | LRU eviction on `_counters` dict at 1000 entries; rare since models are enum-like |

---

## 12. Rollback Strategy

### P0 rollback
If P0 deploy causes regressions:
- Revert commit (Git)
- Redeploy prior version (Railway push)
- Sentry `before_send` removed reverts to default behavior (all events pass through)
- Circuit breaker removal reverts to no circuit breaker (retry cascades return)

### P1+ rollback
Per-phase rollback via migration-down:
- Migration 228 rollback: `DROP TABLE ai_circuit_state, ai_budget, ops_audit_log, sentry_rules CASCADE`
- Migration 229 rollback: `DROP MATERIALIZED VIEW ai_usage_rollup_hour CASCADE`
- Frontend: remove AdminOpsTab from AdminPanel, delete `components/admin/ops/` folder

### Partial rollback
If a single panel regresses but others work: comment out its import + render in AdminOpsTab, ship fix forward.

---

## 13. Pre-Implementation Decisions

Open questions that must be answered before we start P1+. For P0 none are blocking.

### D-1: Sentry rule precedence ordering within a kind
When two `ignore` rules could both match an event, which wins? **Proposed:** created_at ASC (older rules win, since they were added deliberately first). Alternative: enabled-first, then created_at.

**Default if no answer:** created_at ASC.

### D-2: Default budget caps
`ai_budget` seed values ($50/day, $1000/month global, $20 forge, $15 heartbeat, $10 chat-memory) — are these correct for current scale?

**Default if no answer:** use the values above (conservative). Admin can adjust in UI.

### D-3: Sentry API polling frequency for budget display
Sentry's `/api/0/organizations/.../stats_v2/` endpoint is rate-limited (40 req/s org-wide). We want to show "events used this month" live. How fresh?

**Proposed:** 5min cache. Any tighter risks hitting Sentry's own rate limit.

### D-4: Firehose redaction extent
Do prompt bodies (in `metadata` of `ai_usage_log`) get rendered at all, even under hover-reveal?

**Proposed:** Never render prompt bodies in Firehose. Show only purpose + model + tokens + cost. Full prompt only in a separate audit detail drawer that logs the "who viewed what" for GDPR.

### D-5: CUT ALL AI semantics
Does it block in-flight requests or only new ones?

**Proposed:** Only new (AD-5 restatement). In-flight requests run to completion with their current attempt but no retries. Already covered in AD-5 but worth explicit confirmation.

### D-6: Mobile breakpoints for Ops panel
Ops panel is desktop-first. Do we need mobile layout?

**Proposed:** Responsive-collapse to single-column under 768px. No touch-specific controls (admin is desktop work). Media query only.

---

## 14. Success Metrics

### P0 metrics (1 week post-deploy)
- Sentry events/day drops from current ~1200 to <100 average
- OpenRouter 403-to-cascade ratio drops from ~300× (current) to ~5× (circuit-breaker-capped)
- Zero false-positive circuit trips (incidents where service was healthy but circuit opened)

### P1 metrics (2 weeks post-deploy)
- Median time-to-detect AI-cost anomaly drops from "next day invoice" to <30min
- Every kill-switch event has audit-log entry with non-empty reason
- Firehose latency from call → UI <2s p95

### P2 metrics
- Sentry rules reduce event volume by ≥50% on incidents (measured pre/post-rule)
- BubbleUp drill-down identifies anomaly root cause in <5 clicks

### P3 metrics
- Forecast accuracy: MAPE <15% on 7-day horizon
- Slider-delta updates <100ms p99

### P4 metrics
- CLAUDE.md lint passes green on all new code
- Zero `as unknown as T`, zero raw hex, zero em-dashes in `msg()`
- All animations respect `prefers-reduced-motion`

---

## 15. Documentation Deliverables

- `docs/plans/bureau-ops-implementation-plan.md` — this file (plan, living doc until P4)
- `docs/guides/bureau-ops.md` — user-facing guide (P4.4, post-implementation)
- `CLAUDE.md` — new subsection "Bureau Ops (admin only)" with key rules
- `memory/bureau-ops-implementation.md` — post-implementation memory for future sessions
- Regenerate `docs/INDEX.md` + `docs/llms.txt`

---

## 16. Starting Signal

Once this plan is approved:

1. Answer D-1 through D-6 (defaults are fine)
2. Start with P0 (sequential: P0.2 → P0.1 → P0.3 → P0.4 → P0.5 → P0.6)
3. Commit + deploy P0 before starting P1
4. After P0 deploy, monitor Sentry rate for 24h before continuing
5. Then P1 sequentially per dependency graph
6. P2, P3, P4 as independent work streams after P1 ships

**No code before approval. This plan is the contract.**
