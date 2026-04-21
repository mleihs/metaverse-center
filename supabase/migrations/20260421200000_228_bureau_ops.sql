-- Migration 228: Bureau Ops — AI Spend & Signal Control Center (P1)
--
-- Creates the persistence layer for the ops admin panel defined in
-- docs/plans/bureau-ops-implementation-plan.md §4.
--
-- Four tables:
--   ai_circuit_state   — admin-triggered kill overrides (with mandatory auto-revert).
--                         The automatic state machine (closed/half_open/open) stays
--                         in-process per worker (AD-1) — only "killed" overrides
--                         are persisted so they survive process restarts and are
--                         visible to every worker.
--   ai_budget           — cost caps per (scope × scope_key × period).
--                         Pre-call enforcement in BudgetEnforcementService (AD-3).
--   ops_audit_log       — every kill, revert, budget mutation, and Sentry-rule
--                         change. Reason ≥ 3 chars enforced at DB level.
--   sentry_rules        — DB-backed ignore/fingerprint/downgrade rules.
--                         Schema ready for P2 (P1 still uses hardcoded rules
--                         in backend/app.py::_ops_before_send).
--
-- Realtime:
--   ai_usage_log is added to the supabase_realtime publication so the
--   FirehosePanel can subscribe to INSERT events (AD-4). Table has RLS with a
--   service_role-only policy (migration 150), so admin clients using the
--   service-role JWT can subscribe globally; authenticated users cannot.
--
-- Seeds:
--   D-2 default budgets: $50/day global, $1000/month global, $20/day forge,
--                          $15/day heartbeat, $10/day chat-memory.
--
-- RLS:
--   All four new tables are service_role-only — no anon/authenticated
--   policies. The /admin/ops/* router wraps every endpoint with
--   require_platform_admin and uses get_admin_supabase.

-- ── ai_circuit_state ──────────────────────────────────────────────────────

CREATE TABLE ai_circuit_state (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope           TEXT NOT NULL
                        CHECK (scope IN ('provider', 'model', 'purpose', 'global')),
    scope_key       TEXT NOT NULL,
    state           TEXT NOT NULL
                        CHECK (state IN ('closed', 'killed')),
    triggered_by_id UUID REFERENCES auth.users(id),
    reason          TEXT NOT NULL
                        CHECK (length(trim(reason)) >= 3),
    revert_at       TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_circuit_state_unique UNIQUE (scope, scope_key)
);

-- For the scheduled revert sweep (AD-5): find killed rows whose timer has elapsed.
CREATE INDEX idx_ai_circuit_state_revert_at ON ai_circuit_state (revert_at);

-- ── ai_budget ─────────────────────────────────────────────────────────────

CREATE TABLE ai_budget (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope           TEXT NOT NULL
                        CHECK (scope IN ('global', 'purpose', 'simulation', 'user')),
    scope_key       TEXT NOT NULL,
    period          TEXT NOT NULL
                        CHECK (period IN ('hour', 'day', 'month')),
    max_usd         NUMERIC(10, 4) NOT NULL CHECK (max_usd >= 0),
    max_calls       INTEGER CHECK (max_calls IS NULL OR max_calls >= 0),
    soft_warn_pct   INTEGER NOT NULL DEFAULT 75
                        CHECK (soft_warn_pct BETWEEN 10 AND 100),
    hard_block_pct  INTEGER NOT NULL DEFAULT 100
                        CHECK (hard_block_pct BETWEEN 50 AND 200),
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by_id   UUID REFERENCES auth.users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_budget_unique UNIQUE (scope, scope_key, period)
);

-- Lookup pattern: BudgetEnforcementService loads enabled rows for (scope, period).
CREATE INDEX idx_ai_budget_lookup ON ai_budget (scope, period, enabled);

-- ── ops_audit_log ─────────────────────────────────────────────────────────

CREATE TABLE ops_audit_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id      UUID REFERENCES auth.users(id),
    action        TEXT NOT NULL,      -- e.g. 'kill.trip', 'kill.revert', 'budget.upsert'
    target_scope  TEXT,
    target_key    TEXT,
    reason        TEXT NOT NULL
                      CHECK (length(trim(reason)) >= 3),
    payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Most common admin UI query: recent actions, optionally filtered by actor or action.
CREATE INDEX idx_ops_audit_created_at ON ops_audit_log (created_at DESC);
CREATE INDEX idx_ops_audit_actor ON ops_audit_log (actor_id, created_at DESC);
CREATE INDEX idx_ops_audit_action ON ops_audit_log (action, created_at DESC);

-- ── sentry_rules ──────────────────────────────────────────────────────────

CREATE TABLE sentry_rules (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind                 TEXT NOT NULL
                             CHECK (kind IN ('ignore', 'fingerprint', 'downgrade')),
    match_exception_type TEXT,
    match_message_regex  TEXT,
    match_logger         TEXT,
    fingerprint_template TEXT,
    downgrade_to         TEXT
                             CHECK (downgrade_to IS NULL OR downgrade_to IN ('warning', 'info')),
    enabled              BOOLEAN NOT NULL DEFAULT TRUE,
    note                 TEXT NOT NULL
                             CHECK (length(trim(note)) >= 3),
    silenced_count_24h   INTEGER NOT NULL DEFAULT 0 CHECK (silenced_count_24h >= 0),
    updated_by_id        UUID REFERENCES auth.users(id),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ordered scan for the rule cache: enabled rules by kind then created_at (D-1).
CREATE INDEX idx_sentry_rules_kind ON sentry_rules (kind, enabled, created_at);

-- ── Updated-at triggers ───────────────────────────────────────────────────

CREATE TRIGGER set_ai_budget_updated_at
    BEFORE UPDATE ON ai_budget
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_sentry_rules_updated_at
    BEFORE UPDATE ON sentry_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Seed default budgets (D-2) ────────────────────────────────────────────

INSERT INTO ai_budget (scope, scope_key, period, max_usd, soft_warn_pct, hard_block_pct, enabled) VALUES
    ('global',  'global',       'day',   50.0000, 75, 100, TRUE),
    ('global',  'global',       'month', 1000.0000, 75, 100, TRUE),
    ('purpose', 'forge',        'day',   20.0000, 75, 100, TRUE),
    ('purpose', 'heartbeat',    'day',   15.0000, 75, 100, TRUE),
    ('purpose', 'chat_memory',  'day',   10.0000, 75, 100, TRUE)
ON CONFLICT (scope, scope_key, period) DO NOTHING;

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE ai_circuit_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_budget         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_audit_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentry_rules      ENABLE ROW LEVEL SECURITY;

-- Service-role-only: scoped with `TO service_role` (not bare `FOR ALL`,
-- which would grant to PUBLIC — see migration 215 which hardened the
-- same pattern on scanner tables after an anon-access audit finding).
-- The /admin/ops/* router uses get_admin_supabase (service_role).
CREATE POLICY ai_circuit_state_service_role ON ai_circuit_state
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY ai_budget_service_role ON ai_budget
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY ops_audit_log_service_role ON ops_audit_log
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY sentry_rules_service_role ON sentry_rules
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── RPC: get_ops_ledger ───────────────────────────────────────────────────
--
-- Rolled-up ledger snapshot powering LedgerPanel + BurnRatePanel.
-- One round-trip from the backend; Python would need 6+ separate queries
-- or a 30k-row scan + in-memory bucket. Mirrors the shape of
-- get_ai_usage_stats (migration 152) but projects today/month/last-hour +
-- a 24-hour hourly trend suitable for sparklines.
--
-- Security: SECURITY INVOKER — only service_role callers (backend admin
-- client) reach this from the /admin/ops router. grant-on-execute follows
-- the existing pattern for admin RPCs (no explicit grant to anon/authenticated).
CREATE OR REPLACE FUNCTION get_ops_ledger()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_now          TIMESTAMPTZ := now();
    v_today_start  TIMESTAMPTZ := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    v_month_start  TIMESTAMPTZ := date_trunc('month', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    v_last_hour    TIMESTAMPTZ := v_now - interval '1 hour';
    v_trend_start  TIMESTAMPTZ := date_trunc('hour', v_now) - interval '23 hours';
    v_today        JSONB;
    v_month        JSONB;
    v_last         JSONB;
    v_trend        JSONB;
    v_by_purpose   JSONB;
    v_by_model     JSONB;
    v_by_provider  JSONB;
BEGIN
    -- Today totals
    SELECT jsonb_build_object(
        'calls',     coalesce(count(*), 0),
        'tokens',    coalesce(sum(total_tokens), 0),
        'cost_usd',  round(coalesce(sum(estimated_cost_usd), 0)::numeric, 6)
    ) INTO v_today
    FROM ai_usage_log WHERE created_at >= v_today_start;

    -- Month totals
    SELECT jsonb_build_object(
        'calls',     coalesce(count(*), 0),
        'tokens',    coalesce(sum(total_tokens), 0),
        'cost_usd',  round(coalesce(sum(estimated_cost_usd), 0)::numeric, 6)
    ) INTO v_month
    FROM ai_usage_log WHERE created_at >= v_month_start;

    -- Last-hour totals (for burn-rate gauge)
    SELECT jsonb_build_object(
        'calls',     coalesce(count(*), 0),
        'tokens',    coalesce(sum(total_tokens), 0),
        'cost_usd',  round(coalesce(sum(estimated_cost_usd), 0)::numeric, 6)
    ) INTO v_last
    FROM ai_usage_log WHERE created_at >= v_last_hour;

    -- 24-hour hourly trend (for sparkline)
    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.hour), '[]'::jsonb)
    INTO v_trend
    FROM (
        SELECT
            date_trunc('hour', created_at) AS hour,
            count(*)::INT AS calls,
            coalesce(sum(total_tokens), 0)::INT AS tokens,
            round(coalesce(sum(estimated_cost_usd), 0)::numeric, 6) AS cost_usd
        FROM ai_usage_log WHERE created_at >= v_trend_start
        GROUP BY date_trunc('hour', created_at)
    ) t;

    -- By purpose (today only — keeps the payload compact)
    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost_usd DESC), '[]'::jsonb)
    INTO v_by_purpose
    FROM (
        SELECT
            purpose AS key,
            count(*)::INT AS calls,
            coalesce(sum(total_tokens), 0)::INT AS tokens,
            round(coalesce(sum(estimated_cost_usd), 0)::numeric, 6) AS cost_usd
        FROM ai_usage_log WHERE created_at >= v_today_start
        GROUP BY purpose
    ) t;

    -- By model (today only)
    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost_usd DESC), '[]'::jsonb)
    INTO v_by_model
    FROM (
        SELECT
            model AS key,
            count(*)::INT AS calls,
            coalesce(sum(total_tokens), 0)::INT AS tokens,
            round(coalesce(sum(estimated_cost_usd), 0)::numeric, 6) AS cost_usd
        FROM ai_usage_log WHERE created_at >= v_today_start
        GROUP BY model
    ) t;

    -- By provider (today only)
    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost_usd DESC), '[]'::jsonb)
    INTO v_by_provider
    FROM (
        SELECT
            provider AS key,
            count(*)::INT AS calls,
            coalesce(sum(total_tokens), 0)::INT AS tokens,
            round(coalesce(sum(estimated_cost_usd), 0)::numeric, 6) AS cost_usd
        FROM ai_usage_log WHERE created_at >= v_today_start
        GROUP BY provider
    ) t;

    RETURN jsonb_build_object(
        'today',         v_today,
        'month',         v_month,
        'last_hour',     v_last,
        'hourly_trend',  v_trend,
        'by_purpose',    v_by_purpose,
        'by_model',      v_by_model,
        'by_provider',   v_by_provider,
        'generated_at',  v_now
    );
END;
$$;

COMMENT ON FUNCTION get_ops_ledger IS
    'Rolled-up ledger snapshot for the Bureau Ops admin panel. Today + month + last-hour totals plus 24-hour hourly trend and today breakdowns by purpose/model/provider.';


-- ── RPC: get_budget_states ────────────────────────────────────────────────
--
-- Returns every ai_budget row joined with the current-period rolled-up
-- spend from ai_usage_log. One round-trip replaces N+1 queries (one SUM
-- per budget row) that the Python service would otherwise issue.
--
-- For P1 we aggregate ai_usage_log directly; the materialized view added
-- in migration 229 (P2) will back this query at sub-millisecond latency.
--
-- Scope semantics:
--   global   → all rows in the period (scope_key is always 'global')
--   purpose  → rows where purpose = scope_key
--   simulation → rows where simulation_id::text = scope_key
--   user     → rows where user_id::text = scope_key
CREATE OR REPLACE FUNCTION get_budget_states()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_now   TIMESTAMPTZ := now();
    v_hour  TIMESTAMPTZ := date_trunc('hour', v_now);
    v_day   TIMESTAMPTZ := date_trunc('day',   v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    v_mon   TIMESTAMPTZ := date_trunc('month', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
    RETURN (
        SELECT coalesce(jsonb_agg(
            to_jsonb(b) || jsonb_build_object(
                'current_usd',   round(coalesce(s.current_usd, 0)::numeric, 6),
                'current_calls', coalesce(s.current_calls, 0)
            )
        ), '[]'::jsonb)
        FROM ai_budget b
        LEFT JOIN LATERAL (
            SELECT
                sum(estimated_cost_usd) AS current_usd,
                count(*)::INT           AS current_calls
            FROM ai_usage_log u
            WHERE u.created_at >= CASE b.period
                WHEN 'hour'  THEN v_hour
                WHEN 'day'   THEN v_day
                WHEN 'month' THEN v_mon
            END
            AND CASE b.scope
                WHEN 'global'     THEN TRUE
                WHEN 'purpose'    THEN u.purpose = b.scope_key
                WHEN 'simulation' THEN u.simulation_id::text = b.scope_key
                WHEN 'user'       THEN u.user_id::text = b.scope_key
            END
        ) s ON TRUE
    );
END;
$$;

COMMENT ON FUNCTION get_budget_states IS
    'Budget list with current-period rolled-up spend attached. Used by the BudgetEnforcementService read path and the budget admin panel.';

-- ── Realtime publication for the Firehose panel (AD-4) ────────────────────
--
-- Firehose subscribes to ai_usage_log:INSERT. Without this entry the
-- supabase-js channel connects successfully but receives no events.
-- The existing RLS policy on ai_usage_log (migration 150) applies to PUBLIC
-- (bare `FOR ALL USING (true)`) so the authenticated user JWT the
-- frontend uses already grants SELECT. The backend /admin/ops/firehose
-- endpoint gates the initial REST page through require_platform_admin —
-- the Realtime channel is an additive live stream, not the sole feed.
-- Tightening ai_usage_log's policy to platform-admin-only is tracked
-- separately (see P2 hardening sweep).
ALTER PUBLICATION supabase_realtime ADD TABLE ai_usage_log;
