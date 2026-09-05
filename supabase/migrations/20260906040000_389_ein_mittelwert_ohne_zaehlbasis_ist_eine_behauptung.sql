-- 389 — Ein Mittelwert, der 204 Zeilen mitzaehlt, die nichts beitragen.
--
-- ── DER BEFUND, GEGEN PRODUKTION GEMESSEN (05.09.2026) ──────────────────────
--
-- `get_ai_usage_stats` bildet den Mittelwert so:
--
--     SELECT count(*), … , coalesce(sum(estimated_cost_usd), 0)
--       INTO v_total_calls, … , v_total_cost
--       FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_since;
--
--     'avg_cost_per_call', round(v_total_cost / v_total_calls, 6)
--
-- Der Teiler ist JEDER beantwortete Aufruf. Gemessen an Prod:
--
--     ok gesamt                              1 644
--       davon mit Betrag                     1 440
--       davon ohne Betrag                      204   12,4 %
--
--     Ø heute    11.888971 / 1644  =  $0.007232   ← was der Admin anzeigt
--     Ø richtig  11.888971 / 1440  =  $0.008256
--     Abweichung                        14,2 %
--
-- Je Zweck ist es weit schlimmer, weil sich die betragslosen Zeilen dort
-- sammeln, wo keine Tokenzahlen zurueckkommen:
--
--     translation    318 Zeilen, 201 ohne Betrag    63 %
--     anchors          2 Zeilen,   2 ohne Betrag   100 %
--     chat           479 Zeilen,   1 ohne Betrag     0 %
--
-- ⚠ **Und die SUMME stimmt dabei die ganze Zeit.** Genau deshalb ist der
-- Fehler seit Migration 152 unbemerkt geblieben: es gibt keine Zahl daneben,
-- die widerspricht.
--
-- ── WARUM DIE ZEILEN KEINEN BETRAG TRAGEN ───────────────────────────────────
--
-- Nicht, weil eine Preisliste fehlt — fuer Unbekanntes gibt es
-- `_UNKNOWN_COST_PER_1M`. Sondern weil `_estimate_cost` aus null Tokens null
-- rechnet: der Anbieter hat keine Tokenzahlen gemeldet. Gegengeprobt auf Prod:
--
--     Betrag = 0 UND Token = 0      204     ← nicht erfasst
--     Betrag = 0 UND Token > 0        0     ← es gibt KEINE echte Null
--     Betrag > 0 UND Token = 0      316     ← Bilder, je Aufruf bepreist
--
-- `estimated_cost_usd = 0` ist damit heute ein verlaesslicher Marker fuer
-- „nicht erfasst" — und zwar nur, weil die zweite Zeile null ist. Faengt ein
-- Aufrufweg an, einen ECHTEN Nullbetrag mit Tokens zu buchen (ein Treffer aus
-- dem Cache), faellt diese Gleichsetzung, und dann braucht die Tabelle eine
-- eigene Spalte dafuer. Der Zustand steht als „noch nicht eingetreten" in
-- handoff/kostenpanel/BILANZ.md, nicht als geloest.
--
-- ── WAS SICH AENDERT ────────────────────────────────────────────────────────
--
-- 1. `avg_cost_per_call` teilt durch die Zeilen, die einen Betrag tragen.
--    Der angezeigte Wert steigt sichtbar um 14,2 % — das ist der Zweck.
-- 2. `avg_cost_basis` / `avg_cost_of` kommen dazu: die Zahl traegt ihre Basis.
--    Ein Mittelwert ohne Zaehlbasis ist eine Behauptung, und diese hier war
--    ueber ein Jahr lang die falsche.
-- 3. `unrecorded_calls` kommt dazu — die 204 sind kein Randfall, sondern jede
--    achte Zeile.
-- 4. `by_outcome` kommt dazu: die fuenf Ausgaenge als eigene Achse. Sie ist
--    die EINZIGE Aggregation hier ohne `outcome = 'ok'`-Filter — sie ist die
--    Achse selbst.
-- 5. Alle vier Aufschluesselungen tragen `billed` und `unrecorded` mit. Ohne
--    das ist der Mittelwert JEDER Aufschluesselung auf dieselbe Weise falsch,
--    und bei `translation` um 63 %.
--
-- ── WAS SICH NICHT AENDERT ──────────────────────────────────────────────────
--
-- Keine Summe. `total_cost_usd`, `total_tokens` und jedes `cost`/`tokens` in
-- den Aufschluesselungen bleiben Ziffer fuer Ziffer, wie sie waren — die
-- Summen waren nie falsch. Es aendert sich genau eine Zahl, und sie aendert
-- sich, weil sie falsch war.
--
-- Der `outcome = 'ok'`-Filter aus Migration 353 bleibt ueberall stehen, wo er
-- steht. Er ist der Grund, warum eine Zaehlung hier „beantwortet" meint.
--
-- ── DIE SELBSTPRUEFUNG ──────────────────────────────────────────────────────
--
-- Sie prueft die WIRKUNG dieser Migration, nicht den Inhalt der Plattform:
-- dass die Funktion existiert und dass ihre Antwort die neuen Schluessel
-- fuehrt. Beides gilt auf einer leeren Datenbank genauso wie auf Prod — eine
-- Behauptung ueber 1 644 Zeilen waere hier eine Migration, die auf einer
-- frischen Datenbank nie laufen kann.

CREATE OR REPLACE FUNCTION public.get_ai_usage_stats(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_since TIMESTAMPTZ := now() - (p_days || ' days')::INTERVAL;
  v_total_calls BIGINT;
  -- Die Zeilen, die zum Betrag tatsaechlich beitragen. Der Teiler des
  -- Mittelwerts, und die Zaehlbasis, die mitgeliefert wird.
  v_billed_calls BIGINT;
  v_total_tokens BIGINT;
  v_total_cost NUMERIC;
  v_by_provider JSONB;
  v_by_model JSONB;
  v_by_purpose JSONB;
  v_by_simulation JSONB;
  v_by_outcome JSONB;
  v_daily_trend JSONB;
  v_key_sources JSONB;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE estimated_cost_usd > 0),
    coalesce(sum(total_tokens), 0),
    coalesce(sum(estimated_cost_usd), 0)
  INTO v_total_calls, v_billed_calls, v_total_tokens, v_total_cost
  FROM ai_usage_log
  WHERE outcome = 'ok' AND created_at >= v_since;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost DESC), '[]'::jsonb)
  INTO v_by_provider
  FROM (
    SELECT provider, count(*)::INT AS calls,
      count(*) FILTER (WHERE estimated_cost_usd > 0)::INT AS billed,
      count(*) FILTER (WHERE estimated_cost_usd = 0)::INT AS unrecorded,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_since GROUP BY provider
  ) t;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost DESC), '[]'::jsonb)
  INTO v_by_model
  FROM (
    SELECT model, count(*)::INT AS calls,
      count(*) FILTER (WHERE estimated_cost_usd > 0)::INT AS billed,
      count(*) FILTER (WHERE estimated_cost_usd = 0)::INT AS unrecorded,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_since GROUP BY model
  ) t;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost DESC), '[]'::jsonb)
  INTO v_by_purpose
  FROM (
    SELECT purpose, count(*)::INT AS calls,
      count(*) FILTER (WHERE estimated_cost_usd > 0)::INT AS billed,
      count(*) FILTER (WHERE estimated_cost_usd = 0)::INT AS unrecorded,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_since GROUP BY purpose
  ) t;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.cost DESC), '[]'::jsonb)
  INTO v_by_simulation
  FROM (
    SELECT simulation_id, count(*)::INT AS calls,
      count(*) FILTER (WHERE estimated_cost_usd > 0)::INT AS billed,
      count(*) FILTER (WHERE estimated_cost_usd = 0)::INT AS unrecorded,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_since GROUP BY simulation_id
  ) t;

  -- Die einzige Aggregation OHNE den ok-Filter: hier IST der Ausgang die
  -- Achse. Ein `WHERE outcome = 'ok'` haette sie auf eine Kategorie verkuerzt
  -- und dabei ausgesehen, als gaebe es nur eine.
  SELECT coalesce(jsonb_object_agg(t.outcome, jsonb_build_object(
    'calls', t.calls, 'tokens', t.tokens, 'cost', t.cost
  )), '{}'::jsonb)
  INTO v_by_outcome
  FROM (
    SELECT outcome, count(*)::INT AS calls,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE created_at >= v_since GROUP BY outcome
  ) t;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.day), '[]'::jsonb)
  INTO v_daily_trend
  FROM (
    SELECT date_trunc('day', created_at)::DATE AS day,
      count(*)::INT AS calls,
      count(*) FILTER (WHERE estimated_cost_usd > 0)::INT AS billed,
      sum(total_tokens)::INT AS tokens,
      round(sum(estimated_cost_usd)::NUMERIC, 6) AS cost
    FROM ai_usage_log WHERE outcome = 'ok' AND created_at >= v_since
    GROUP BY 1
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
    -- Der Teiler sind die Zeilen MIT Betrag. Die 204 ohne tragen nichts zur
    -- Summe bei und duerfen den Mittelwert deshalb auch nicht verduennen.
    'avg_cost_per_call', CASE
      WHEN v_billed_calls > 0 THEN round(v_total_cost / v_billed_calls, 6)
      ELSE 0
    END,
    -- Die Zaehlbasis steht neben der Zahl, nicht in einer Fussnote.
    'avg_cost_basis', v_billed_calls,
    'avg_cost_of', v_total_calls,
    'unrecorded_calls', v_total_calls - v_billed_calls,
    'by_provider', v_by_provider,
    'by_model', v_by_model,
    'by_purpose', v_by_purpose,
    'by_simulation', v_by_simulation,
    'by_outcome', v_by_outcome,
    'daily_trend', v_daily_trend,
    'key_sources', v_key_sources
  );
END;
$function$;

-- ── Selbstpruefung: die WIRKUNG dieser Migration, nicht der Inhalt der DB ───
DO $$
DECLARE
  v_probe JSONB;
  v_fehlend TEXT[] := '{}';
  v_schluessel TEXT;
BEGIN
  IF to_regprocedure('public.get_ai_usage_stats(integer)') IS NULL THEN
    RAISE EXCEPTION 'get_ai_usage_stats(integer) existiert nach dieser Migration nicht';
  END IF;

  -- Ein echter Aufruf, kein Vergleich mit dem Quelltext: eine Funktion, die
  -- sich nicht ausfuehren laesst, ist nicht repariert. Auf einer leeren
  -- Datenbank liefert sie Nullen — und genau die Schluessel, um die es geht.
  v_probe := public.get_ai_usage_stats(1);

  FOREACH v_schluessel IN ARRAY ARRAY[
    'avg_cost_per_call', 'avg_cost_basis', 'avg_cost_of',
    'unrecorded_calls', 'by_outcome',
    -- Die alten Schluessel stehen mit in der Liste: eine Reparatur, die einen
    -- Verbraucher stumm um ein Feld bringt, ist keine.
    'period_days', 'total_calls', 'total_tokens', 'total_cost_usd',
    'by_provider', 'by_model', 'by_purpose', 'by_simulation',
    'daily_trend', 'key_sources'
  ] LOOP
    IF NOT (v_probe ? v_schluessel) THEN
      v_fehlend := v_fehlend || v_schluessel;
    END IF;
  END LOOP;

  IF array_length(v_fehlend, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'get_ai_usage_stats liefert % nicht', array_to_string(v_fehlend, ', ');
  END IF;

  -- Die Division darf auf einer leeren Datenbank nicht werfen. Ohne diese
  -- Zeile faende der Fehler erst auf einer frischen Instanz statt, und dort
  -- als 500 im Admin.
  IF (v_probe->>'avg_cost_per_call')::NUMERIC IS NULL THEN
    RAISE EXCEPTION 'avg_cost_per_call ist NULL statt 0 bei leerem Zeitfenster';
  END IF;

  RAISE NOTICE 'get_ai_usage_stats: 15 Schluessel vorhanden, Aufruf auf leerem Fenster traegt.';
END $$;
