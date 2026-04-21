-- Migration 229: Bureau Ops — ai_usage_rollup_hour materialized view (P2.2)
--
-- Hourly rollup of ai_usage_log (30-day rolling window) powering
-- HeatmapPanel + the sub-second path for budget pre-check (AD-3).
-- Replaces a live scan of ai_usage_log (growing ~40k rows/week) with an
-- indexed read against at-most ~72k rollup rows (30 days × 24h × ~100
-- unique (purpose, model, provider, simulation_id) combinations; typical
-- 7-day HeatmapPanel window queries ~8k).
--
-- Refresh strategy:
--   pg_cron is NOT enabled on the Supabase hosted instance (verified
--   2026-04-21: only pg_stat_statements 1.11 in pg_extension). Scheduling is
--   therefore handled by a backend scheduler (BaseSchedulerMixin pattern)
--   that calls refresh_ai_usage_rollup_hour() once per minute. The function
--   exists independently of the scheduler so pg_cron can take over later
--   without a code change — just
--     SELECT cron.schedule('refresh-ai-rollup', '* * * * *',
--                          'SELECT refresh_ai_usage_rollup_hour()');
--   once the extension is granted by a superuser.
--
-- CONCURRENTLY refresh requirements:
--   - MV must be populated (CREATE MATERIALIZED VIEW ... AS ... defaults to
--     WITH DATA — we rely on that).
--   - A UNIQUE INDEX must cover every output row. GROUP BY guarantees
--     (hour, purpose, model, provider, simulation_id) is unique per row,
--     even when simulation_id is NULL (GROUP BY treats NULL as a single
--     group), so the 5-column unique index is sufficient.
--
-- Security:
--   refresh_ai_usage_rollup_hour() is SECURITY DEFINER so callers do not
--   need ai_usage_log SELECT or MV ownership. EXECUTE is revoked from
--   PUBLIC/anon/authenticated and granted only to service_role — matches
--   the CLAUDE.md rule on SECURITY DEFINER functions (migration 147 set
--   the precedent after the admin_list_users incident).

-- ── Materialized view ─────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW ai_usage_rollup_hour AS
SELECT
    date_trunc('hour', created_at)                                    AS hour,
    purpose,
    model,
    provider,
    simulation_id,
    count(*)::BIGINT                                                  AS calls,
    coalesce(sum(total_tokens), 0)::BIGINT                            AS tokens,
    round(coalesce(sum(estimated_cost_usd), 0)::NUMERIC, 6)           AS usd,
    count(*) FILTER (WHERE (metadata->>'status') = 'error')::BIGINT   AS errors,
    round(coalesce(avg(duration_ms), 0)::NUMERIC, 0)::INT             AS avg_duration_ms
FROM ai_usage_log
WHERE created_at > now() - interval '30 days'
GROUP BY 1, 2, 3, 4, 5;

-- CONCURRENTLY-refresh requirement: exactly-one-row-per-key unique index.
-- simulation_id is nullable; Postgres UNIQUE indexes treat each NULL as
-- distinct by default, but GROUP BY already collapses NULLs into a single
-- group per (hour, purpose, model, provider), so each (hour, purpose,
-- model, provider, NULL) tuple appears at most once.
CREATE UNIQUE INDEX ai_usage_rollup_hour_pk
    ON ai_usage_rollup_hour (hour, purpose, model, provider, simulation_id);

-- Range scan by hour (HeatmapPanel's window slider, burn-rate polls).
CREATE INDEX idx_ai_usage_rollup_hour_time
    ON ai_usage_rollup_hour (hour DESC);

-- Per-purpose drill-down (BubbleUp attribution, budget pre-check).
CREATE INDEX idx_ai_usage_rollup_hour_purpose
    ON ai_usage_rollup_hour (purpose, hour DESC);

COMMENT ON MATERIALIZED VIEW ai_usage_rollup_hour IS
    'Hourly rollup of ai_usage_log over a 30-day rolling window. Refreshed CONCURRENTLY every 60 seconds by the backend rollup scheduler (or pg_cron when the extension is granted).';

-- ── Refresh function ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_ai_usage_rollup_hour()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY ai_usage_rollup_hour;
$$;

COMMENT ON FUNCTION refresh_ai_usage_rollup_hour IS
    'Refreshes the ai_usage_rollup_hour materialized view concurrently. SECURITY DEFINER so low-privilege callers (service_role) can refresh without ownership of the MV.';

-- EXECUTE grant hardening (see CLAUDE.md: never grant SECURITY DEFINER
-- functions to anon or authenticated). Service_role keeps default EXECUTE
-- because it is not in the REVOKE list below.
REVOKE EXECUTE ON FUNCTION refresh_ai_usage_rollup_hour FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION refresh_ai_usage_rollup_hour FROM anon;
REVOKE EXECUTE ON FUNCTION refresh_ai_usage_rollup_hour FROM authenticated;
