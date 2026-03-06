-- 066: The Chronicle — per-simulation AI-generated newspaper
CREATE TABLE public.simulation_chronicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  epoch_id UUID REFERENCES game_epochs(id) ON DELETE SET NULL,
  edition_number INT NOT NULL DEFAULT 1,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  headline TEXT,
  content TEXT NOT NULL,
  title_de TEXT,
  headline_de TEXT,
  content_de TEXT,
  model_used TEXT,
  published_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (simulation_id, edition_number)
);

CREATE INDEX idx_chronicles_sim_published ON simulation_chronicles(simulation_id, published_at DESC);

ALTER TABLE simulation_chronicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chronicles_public_read" ON simulation_chronicles FOR SELECT USING (true);
CREATE POLICY "chronicles_service_write" ON simulation_chronicles FOR ALL
  USING (auth.role() = 'service_role');

-- Aggregation function for chronicle source data
CREATE OR REPLACE FUNCTION get_chronicle_source_data(
  p_simulation_id UUID, p_period_start TIMESTAMPTZ, p_period_end TIMESTAMPTZ
) RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT jsonb_build_object(
    'events', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'title', e.title, 'event_type', e.event_type,
        'description', left(e.description, 400),
        'impact_level', e.impact_level, 'occurred_at', e.occurred_at
      ) ORDER BY e.occurred_at DESC), '[]'::jsonb)
      FROM (
        SELECT title, event_type, description, impact_level, occurred_at
        FROM events
        WHERE simulation_id = p_simulation_id
          AND occurred_at BETWEEN p_period_start AND p_period_end
          AND deleted_at IS NULL
        ORDER BY occurred_at DESC
        LIMIT 40
      ) e
    ),
    'echoes', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'echo_vector', ee.echo_vector,
        'echo_strength', ee.echo_strength,
        'source_simulation_id', ee.source_simulation_id
      ) ORDER BY ee.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT echo_vector, echo_strength, source_simulation_id, created_at
        FROM event_echoes
        WHERE target_simulation_id = p_simulation_id
          AND status = 'completed'
          AND created_at BETWEEN p_period_start AND p_period_end
        ORDER BY created_at DESC
        LIMIT 20
      ) ee
    ),
    'battle_entries', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'event_type', bl.event_type, 'narrative', left(bl.narrative, 300),
        'cycle_number', bl.cycle_number
      ) ORDER BY bl.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT event_type, narrative, cycle_number, created_at
        FROM battle_log
        WHERE (source_simulation_id = p_simulation_id OR target_simulation_id = p_simulation_id)
          AND is_public = true
          AND created_at BETWEEN p_period_start AND p_period_end
        ORDER BY created_at DESC
        LIMIT 30
      ) bl
    ),
    'reactions', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'agent_name', er.agent_name, 'emotion', er.emotion,
        'reaction_text', left(er.reaction_text, 200),
        'event_title', ev.title
      ) ORDER BY er.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT er2.agent_name, er2.emotion, er2.reaction_text, er2.event_id, er2.created_at
        FROM event_reactions er2
        WHERE er2.created_at BETWEEN p_period_start AND p_period_end
        ORDER BY er2.created_at DESC
        LIMIT 20
      ) er
      JOIN events ev ON er.event_id = ev.id
      WHERE ev.simulation_id = p_simulation_id
    ),
    'event_count', (
      SELECT count(*) FROM events
      WHERE simulation_id = p_simulation_id
        AND occurred_at BETWEEN p_period_start AND p_period_end
        AND deleted_at IS NULL
    )
  );
$$;

-- Prompt template for chronicle generation
INSERT INTO prompt_templates (
  id, simulation_id, template_type, prompt_category, template_name, locale,
  prompt_content, system_prompt, temperature, max_tokens
) VALUES (
  gen_random_uuid(), NULL, 'chronicle_generation', 'text_generation',
  'Chronicle Generation', 'en',
  'Write edition #{edition_number} of the {simulation_name} chronicle covering {period_start} to {period_end}.

SOURCE MATERIAL:
Events: {event_summary}
Cross-reality echoes: {echo_summary}
Military dispatches: {battle_summary}
Citizen reactions: {reaction_summary}

Return valid JSON: {"title": "edition title", "headline": "one-line hook", "content": "full article (800-1500 words)"}
Write as this world''s official news publication. Propaganda, bias, and in-world voice are mandatory.',
  'You are the editor-in-chief of {simulation_name}''s state-sanctioned newspaper. Every word serves the narrative. Write in the simulation''s distinctive voice.',
  0.85, 4096
);
