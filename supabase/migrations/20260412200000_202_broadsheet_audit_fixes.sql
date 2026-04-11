-- 202: Broadsheet audit fixes
--
-- H1: Atomic edition numbering via advisory lock RPC (race condition fix)
-- H2: Remove dead broadsheet_editor_write RLS policy
-- M1: Add bilingual fields (title_de, description_de) to broadsheet source RPC
-- M2: Document mood_summary as current-state snapshot (not time-series)


-- ============================================================================
-- H1: Atomic insert RPC with advisory lock
-- ============================================================================
-- _next_edition_number() in Python was fetch-max-plus-1 — two concurrent
-- requests could get the same number. FOR UPDATE doesn't protect the first
-- insert (no rows to lock). Advisory lock on simulation ID hash solves both.

CREATE OR REPLACE FUNCTION insert_broadsheet_edition(
  p_simulation_id UUID,
  p_data JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next_num INT;
  v_result JSONB;
BEGIN
  -- Advisory lock per simulation: prevents concurrent edition number collision.
  -- Lock is automatically released at transaction end.
  PERFORM pg_advisory_xact_lock(hashtext('broadsheet_' || p_simulation_id::text));

  SELECT COALESCE(MAX(edition_number), 0) + 1 INTO v_next_num
    FROM simulation_broadsheets
    WHERE simulation_id = p_simulation_id;

  INSERT INTO simulation_broadsheets (
    simulation_id, edition_number, period_start, period_end,
    title, articles, health_snapshot, mood_snapshot,
    statistics, gazette_wire, editorial_voice, model_used, published_at
  ) VALUES (
    p_simulation_id, v_next_num,
    (p_data->>'period_start')::timestamptz,
    (p_data->>'period_end')::timestamptz,
    p_data->>'title',
    COALESCE(p_data->'articles', '[]'::jsonb),
    p_data->'health_snapshot',
    p_data->'mood_snapshot',
    p_data->'statistics',
    p_data->'gazette_wire',
    COALESCE(p_data->>'editorial_voice', 'neutral'),
    COALESCE(p_data->>'model_used', 'aggregation_v1'),
    (p_data->>'published_at')::timestamptz
  ) RETURNING to_jsonb(simulation_broadsheets.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- Restrict to service_role (backend calls with require_role("editor") guard)
REVOKE ALL ON FUNCTION insert_broadsheet_edition(UUID, JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION insert_broadsheet_edition(UUID, JSONB) TO service_role;


-- ============================================================================
-- H2: Remove dead RLS write policy
-- ============================================================================
-- generate_broadsheet uses service_role (admin_supabase) because it calls
-- SECURITY DEFINER RPCs. This write policy was never exercised.
-- Write authorization: require_role("editor") in FastAPI router.

DROP POLICY IF EXISTS broadsheet_editor_write ON simulation_broadsheets;


-- ============================================================================
-- M1: Add bilingual fields to broadsheet source data RPC
-- ============================================================================
-- Original RPC (migration 186b) was written before migration 081 added
-- title_de/description_de to events. Events-subquery now includes _de fields.
--
-- M2: mood_summary documentation
-- agent_mood is a current-state table (UNIQUE per agent), not a time-series.
-- This returns the simulation's mood AT generation time, not mood DURING the
-- period. This is intentional — frozen as editorial context for the broadsheet.

CREATE OR REPLACE FUNCTION get_broadsheet_source_data(
  p_simulation_id UUID,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'events', (
      SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.impact_level DESC), '[]'::jsonb)
      FROM (
        SELECT id, title, title_de, event_type, description, description_de,
               occurred_at, impact_level, tags, event_status, data_source
        FROM events
        WHERE simulation_id = p_simulation_id
          AND occurred_at BETWEEN p_period_start AND p_period_end
          AND deleted_at IS NULL
        ORDER BY impact_level DESC
        LIMIT 20
      ) e
    ),
    'activities', (
      SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.significance DESC), '[]'::jsonb)
      FROM (
        SELECT aa.id, aa.activity_type, aa.narrative_text, aa.narrative_text_de,
               aa.significance, aa.effects, ag.name AS agent_name
        FROM agent_activities aa
        LEFT JOIN agents ag ON ag.id = aa.agent_id
        WHERE aa.simulation_id = p_simulation_id
          AND aa.created_at BETWEEN p_period_start AND p_period_end
          AND aa.significance >= 5
        ORDER BY aa.significance DESC
        LIMIT 15
      ) a
    ),
    'resonance_impacts', (
      SELECT COALESCE(jsonb_agg(to_jsonb(ri)), '[]'::jsonb)
      FROM (
        SELECT ri.id, ri.effective_magnitude, ri.status, ri.narrative_context,
               r.title AS resonance_title, r.source_category
        FROM resonance_impacts ri
        LEFT JOIN substrate_resonances r ON r.id = ri.resonance_id
        WHERE ri.simulation_id = p_simulation_id
          AND ri.created_at BETWEEN p_period_start AND p_period_end
        ORDER BY ri.effective_magnitude DESC
        LIMIT 5
      ) ri
    ),
    -- mood_summary: current-state snapshot (agent_mood has UNIQUE per agent,
    -- not a time-series). Returns mood AT generation time, not DURING period.
    'mood_summary', (
      SELECT jsonb_build_object(
        'avg_mood', COALESCE(AVG(am.mood_score), 50),
        'avg_stress', COALESCE(AVG(am.stress_level), 0),
        'crisis_count', COUNT(*) FILTER (WHERE am.stress_level > 800),
        'happy_count', COUNT(*) FILTER (WHERE am.mood_score > 60),
        'unhappy_count', COUNT(*) FILTER (WHERE am.mood_score < 30)
      )
      FROM agent_mood am
      LEFT JOIN agents ag ON ag.id = am.agent_id
      WHERE ag.simulation_id = p_simulation_id
    ),
    'gazette_entries', (
      SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY g.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT entry_type, source_simulation, target_simulation,
               echo_vector, strength, narrative, created_at
        FROM get_bleed_gazette_feed(50)
        WHERE source_simulation->>'id' = p_simulation_id::text
           OR target_simulation->>'id' = p_simulation_id::text
        ORDER BY created_at DESC
        LIMIT 5
      ) g
    ),
    'health', (
      SELECT to_jsonb(h)
      FROM mv_simulation_health h
      WHERE h.simulation_id = p_simulation_id
      LIMIT 1
    )
  ) INTO result;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Permissions unchanged: service_role only (already granted in migration 186b)
