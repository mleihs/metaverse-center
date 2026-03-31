-- Fix: row_to_jsonb does not exist in Postgres — use to_jsonb instead.
-- Repair migration for 152_ai_usage_stats_rpc.sql.

CREATE OR REPLACE FUNCTION get_ai_usage_stats(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_since TIMESTAMPTZ := now() - (p_days || ' days')::INTERVAL;
  v_total_calls BIGINT;
  v_total_tokens BIGINT;
  v_total_cost NUMERIC;
  v_by_provider JSONB;
  v_by_model JSONB;
  v_by_purpose JSONB;
  v_by_simulation JSONB;
  v_daily_trend JSONB;
  v_key_sources JSONB;
BEGIN
  SELECT
    count(*),
    coalesce(sum(total_tokens), 0),
    coalesce(sum(estimated_cost_usd), 0)
  INTO v_total_calls, v_total_tokens, v_total_cost
  FROM ai_usage_log
  WHERE created_at >= v_since;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost DESC), '[]'::jsonb)
  INTO v_by_provider
  FROM (
    SELECT provider, count(*)::INT AS calls,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE created_at >= v_since GROUP BY provider
  ) t;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost DESC), '[]'::jsonb)
  INTO v_by_model
  FROM (
    SELECT model, count(*)::INT AS calls,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE created_at >= v_since GROUP BY model
  ) t;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost DESC), '[]'::jsonb)
  INTO v_by_purpose
  FROM (
    SELECT purpose, count(*)::INT AS calls,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE created_at >= v_since GROUP BY purpose
  ) t;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost DESC), '[]'::jsonb)
  INTO v_by_simulation
  FROM (
    SELECT coalesce(simulation_id::TEXT, 'platform') AS simulation_id,
      count(*)::INT AS calls,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE created_at >= v_since GROUP BY simulation_id
  ) t;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.date ASC), '[]'::jsonb)
  INTO v_daily_trend
  FROM (
    SELECT (created_at AT TIME ZONE 'UTC')::DATE::TEXT AS date,
      count(*)::INT AS calls,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE created_at >= v_since
    GROUP BY (created_at AT TIME ZONE 'UTC')::DATE
  ) t;

  SELECT coalesce(jsonb_object_agg(t.key_source, jsonb_build_object(
    'calls', t.calls, 'tokens', t.tokens, 'cost', t.cost
  )), '{}'::jsonb)
  INTO v_key_sources
  FROM (
    SELECT key_source, count(*)::INT AS calls,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE created_at >= v_since GROUP BY key_source
  ) t;

  RETURN jsonb_build_object(
    'period_days', p_days,
    'total_calls', v_total_calls,
    'total_tokens', v_total_tokens,
    'total_cost_usd', round(v_total_cost, 4),
    'avg_cost_per_call', CASE
      WHEN v_total_calls > 0 THEN round(v_total_cost / v_total_calls, 6)
      ELSE 0
    END,
    'by_provider', v_by_provider,
    'by_model', v_by_model,
    'by_purpose', v_by_purpose,
    'by_simulation', v_by_simulation,
    'daily_trend', v_daily_trend,
    'key_sources', v_key_sources
  );
END;
$$;
