-- 186: Simulation Broadsheets — theme-adaptive aggregated newspaper editions
--
-- Each simulation gets its own broadsheet: a "finishable" edition (max 7 articles)
-- that aggregates events, agent activities, resonance impacts, and gazette echoes
-- from a given time period. Health snapshots freeze the simulation's state at
-- generation time, enabling the Frostpunk "moral mirror" editorial voice.

-- ── Table ──────────────────────────────────────────────────────────────────

CREATE TABLE simulation_broadsheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  edition_number INT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Masthead
  title TEXT NOT NULL,
  title_de TEXT,
  subtitle TEXT,
  subtitle_de TEXT,

  -- Aggregated content (JSONB for flexible article structure)
  -- Each article: {source_type, source_id, headline, headline_de, content,
  --   content_de, image_url, layout_hint, priority, agent_name, impact_level, tags}
  articles JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Snapshot data (frozen at generation time)
  health_snapshot JSONB,     -- {overall_health, health_label, avg_stability, ...}
  mood_snapshot JSONB,       -- {avg_mood, avg_stress, crisis_count, happy_count, unhappy_count}
  statistics JSONB,          -- {event_count, activity_count, resonance_count}
  gazette_wire JSONB,        -- [{entry_type, narrative, source_simulation, target_simulation, created_at}]

  -- Metadata
  editorial_voice TEXT NOT NULL DEFAULT 'neutral',  -- neutral|concerned|alarmed|optimistic
  model_used TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT broadsheet_edition_unique UNIQUE (simulation_id, edition_number),
  CONSTRAINT broadsheet_voice_check CHECK (editorial_voice IN ('neutral', 'concerned', 'alarmed', 'optimistic'))
);

-- Indexes
CREATE INDEX idx_broadsheets_sim_created ON simulation_broadsheets (simulation_id, created_at DESC);
CREATE INDEX idx_broadsheets_sim_edition ON simulation_broadsheets (simulation_id, edition_number DESC);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE simulation_broadsheets ENABLE ROW LEVEL SECURITY;

-- Public read for active simulations (initPlan-optimised with SELECT subquery)
CREATE POLICY broadsheet_public_read ON simulation_broadsheets
  FOR SELECT USING (
    (SELECT s.status FROM simulations s WHERE s.id = simulation_id) = 'active'
  );

-- Editor+ write (initPlan-optimised with SELECT subquery)
CREATE POLICY broadsheet_editor_write ON simulation_broadsheets
  FOR ALL USING (
    (SELECT user_has_simulation_role(simulation_id, 'editor'))
  )
  WITH CHECK (
    (SELECT user_has_simulation_role(simulation_id, 'editor'))
  );

-- ── Aggregation RPC ────────────────────────────────────────────────────────
-- Fetches all source data for a broadsheet edition from a single call.
-- SECURITY DEFINER: called from backend service with role validation.

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
        SELECT id, title, event_type, description, occurred_at,
               impact_level, tags, event_status, data_source
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

-- Restrict RPC to authenticated (backend calls with role validation)
REVOKE ALL ON FUNCTION get_broadsheet_source_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION get_broadsheet_source_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
