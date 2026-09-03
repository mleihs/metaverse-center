-- 352b — Eine Zaehlung, die „beantwortet" meint, darf Fehlschlaege nicht mitzaehlen.
--
-- Migration 352 macht aus `ai_usage_log` ein Versuchsbuch: eine Zeile je
-- Anlauf, mit dem Ausgang daneben. Summen bleiben davon unberuehrt — ein
-- gescheiterter Anlauf traegt null Token und null Kosten. ZAEHLUNGEN aber
-- nicht: `count(*)` haette ab sofort Anlaeufe gezaehlt, wo bisher Antworten
-- standen, und zwar ohne dass irgendwo ein Wort sich geaendert haette.
--
-- Genau diese stille Bedeutungsverschiebung ist die teuerste Sorte Fehler in
-- diesem Haus, deshalb steht der Filter hier statt in einer Fussnote. Gemessen
-- vor dem Schreiben: 16 `FROM ai_usage_log`-Stellen in vier Funktionen, alle
-- 16 ergaenzt.
--
-- Nachgeprueft wurde die LAUFENDE Fassung aus `pg_get_functiondef` auf Prod,
-- nicht die aelteste Migration mit demselben Namen: 152 ist von 169 abgeloest
-- und 169 von 332/336, und nur die Datenbank weiss, welche davon gilt.
--
-- Was hier NICHT gefiltert wird: `ops_ledger_service.get_firehose_page` liest
-- die Rohzeilen fuer die Firehose. Dort SOLLEN die Fehlschlaege sichtbar sein
-- — das ist die Ansicht, in der man nachsieht, warum eine Uebermittlung
-- haengenblieb.

-- ── get_ai_usage_stats (7 Stellen) ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_ai_usage_stats(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
  WHERE outcome = 'ok' AND created_at >= v_since;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost DESC), '[]'::jsonb)
  INTO v_by_provider
  FROM (
    SELECT provider, count(*)::INT AS calls,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_since GROUP BY provider
  ) t;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost DESC), '[]'::jsonb)
  INTO v_by_model
  FROM (
    SELECT model, count(*)::INT AS calls,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_since GROUP BY model
  ) t;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost DESC), '[]'::jsonb)
  INTO v_by_purpose
  FROM (
    SELECT purpose, count(*)::INT AS calls,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_since GROUP BY purpose
  ) t;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost DESC), '[]'::jsonb)
  INTO v_by_simulation
  FROM (
    SELECT coalesce(simulation_id::TEXT, 'platform') AS simulation_id,
      count(*)::INT AS calls,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_since GROUP BY simulation_id
  ) t;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.date ASC), '[]'::jsonb)
  INTO v_daily_trend
  FROM (
    SELECT (created_at AT TIME ZONE 'UTC')::DATE::TEXT AS date,
      count(*)::INT AS calls,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_since
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
    FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_since GROUP BY key_source
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
$function$;

-- ── get_budget_states (1 Stellen) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_budget_states()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
            WHERE u.outcome = 'ok' AND u.created_at >= CASE b.period
                WHEN 'hour'  THEN v_hour
                WHEN 'day'   THEN v_day
                WHEN 'month' THEN v_mon
            END
            -- Nur Geld der Plattform zählt gegen die Kappen der Plattform.
            AND u.key_source IS DISTINCT FROM 'byok'
            AND CASE b.scope
                WHEN 'global'     THEN TRUE
                WHEN 'purpose'    THEN u.purpose = b.scope_key
                WHEN 'simulation' THEN u.simulation_id::text = b.scope_key
                WHEN 'user'       THEN u.user_id::text = b.scope_key
            END
        ) s ON TRUE
    );
END;
$function$;

-- ── get_ops_ledger (7 Stellen) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_ops_ledger()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
    SELECT jsonb_build_object(
        'calls',     coalesce(count(*), 0),
        'tokens',    coalesce(sum(total_tokens), 0),
        'cost_usd',  round(coalesce(sum(estimated_cost_usd), 0)::numeric, 6)
    ) INTO v_today
    FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_today_start;

    SELECT jsonb_build_object(
        'calls',     coalesce(count(*), 0),
        'tokens',    coalesce(sum(total_tokens), 0),
        'cost_usd',  round(coalesce(sum(estimated_cost_usd), 0)::numeric, 6)
    ) INTO v_month
    FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_month_start;

    SELECT jsonb_build_object(
        'calls',     coalesce(count(*), 0),
        'tokens',    coalesce(sum(total_tokens), 0),
        'cost_usd',  round(coalesce(sum(estimated_cost_usd), 0)::numeric, 6)
    ) INTO v_last
    FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_last_hour;

    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.hour), '[]'::jsonb)
    INTO v_trend
    FROM (
        SELECT
            date_trunc('hour', created_at) AS hour,
            count(*)::INT AS calls,
            coalesce(sum(total_tokens), 0)::INT AS tokens,
            round(coalesce(sum(estimated_cost_usd), 0)::numeric, 6) AS cost_usd
        FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_trend_start
        GROUP BY date_trunc('hour', created_at)
    ) t;

    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost_usd DESC), '[]'::jsonb)
    INTO v_by_purpose
    FROM (
        SELECT
            purpose AS key,
            count(*)::INT AS calls,
            coalesce(sum(total_tokens), 0)::INT AS tokens,
            round(coalesce(sum(estimated_cost_usd), 0)::numeric, 6) AS cost_usd
        FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_today_start
        GROUP BY purpose
    ) t;

    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost_usd DESC), '[]'::jsonb)
    INTO v_by_model
    FROM (
        SELECT
            model AS key,
            count(*)::INT AS calls,
            coalesce(sum(total_tokens), 0)::INT AS tokens,
            round(coalesce(sum(estimated_cost_usd), 0)::numeric, 6) AS cost_usd
        FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_today_start
        GROUP BY model
    ) t;

    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost_usd DESC), '[]'::jsonb)
    INTO v_by_provider
    FROM (
        SELECT
            provider AS key,
            count(*)::INT AS calls,
            coalesce(sum(total_tokens), 0)::INT AS tokens,
            round(coalesce(sum(estimated_cost_usd), 0)::numeric, 6) AS cost_usd
        FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_today_start
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
$function$;

-- ── fn_byok_admin_stats (1 Stellen) ───────────────────────────
CREATE OR REPLACE FUNCTION public.fn_byok_admin_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_stale_days integer;
BEGIN
    SELECT COALESCE((setting_value #>> '{}')::integer, 90)
    INTO v_stale_days
    FROM platform_settings WHERE setting_key = 'byok_stale_days';
    v_stale_days := COALESCE(v_stale_days, 90);

    RETURN jsonb_build_object(
        'stale_after_days', v_stale_days,
        -- Wer DARF. Unter der Politik `all` dürfen alle, dann sagt die Zahl
        -- der einzeln Freigeschalteten wenig — sie steht trotzdem, weil ein
        -- Wechsel zurück auf `per_user` genau diese Menge wieder aktiviert.
        'allowed_accounts', (SELECT count(*) FROM user_wallets WHERE byok_allowed),
        -- Wer tatsächlich einen BESTÄTIGTEN Schlüssel hat. Der Abstand zur
        -- Zahl darüber ist die eigentliche Auskunft.
        'with_confirmed_key', (
            SELECT count(DISTINCT user_id) FROM user_api_keys WHERE last_verified_at IS NOT NULL
        ),
        -- Wessen Schlüssel zu lange nicht bestätigt wurde. NIE geprüfte zählen
        -- mit: „noch nie" ist nicht besser als „seit langem nicht".
        'stale_keys', (
            SELECT count(*) FROM user_api_keys
            WHERE last_verified_at IS NULL
               OR last_verified_at < now() - make_interval(days => v_stale_days)
        ),
        'user_paid_usd_30d', (
            SELECT COALESCE(round(sum(estimated_cost_usd)::numeric, 4), 0)
            FROM ai_usage_log
            WHERE outcome = 'ok' AND key_source = 'byok' AND created_at >= now() - interval '30 days'
        ),
        'open_requests', (SELECT count(*) FROM byok_requests WHERE status = 'pending')
    );
END;
$function$;

-- Selbstpruefung: die eigene WIRKUNG, nicht der Bestand der Plattform.
DO $check$
DECLARE
  v_missing TEXT;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO v_missing
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('get_ai_usage_stats','get_budget_states','get_ops_ledger','fn_byok_admin_stats')
     AND pg_get_functiondef(p.oid) NOT ILIKE '%outcome = ''ok''%';
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 352b: ohne Ausgangsfilter geblieben: %', v_missing;
  END IF;
END
$check$;
