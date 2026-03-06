-- 065b: War Room — cycle-aggregated battle statistics
CREATE OR REPLACE FUNCTION get_cycle_battle_summary(
  p_epoch_id uuid,
  p_cycle_number int,
  p_simulation_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT jsonb_build_object(
    'cycle_number', p_cycle_number,
    'missions_deployed', (
      SELECT count(*) FROM battle_log
      WHERE epoch_id = p_epoch_id
        AND cycle_number = p_cycle_number
        AND event_type = 'operative_deployed'
        AND (p_simulation_id IS NULL OR source_simulation_id = p_simulation_id)
    ),
    'successes', (
      SELECT count(*) FROM battle_log
      WHERE epoch_id = p_epoch_id
        AND cycle_number = p_cycle_number
        AND event_type = 'mission_success'
        AND (p_simulation_id IS NULL OR source_simulation_id = p_simulation_id)
    ),
    'failures', (
      SELECT count(*) FROM battle_log
      WHERE epoch_id = p_epoch_id
        AND cycle_number = p_cycle_number
        AND event_type = 'mission_failed'
        AND (p_simulation_id IS NULL OR source_simulation_id = p_simulation_id)
    ),
    'detections', (
      SELECT count(*) FROM battle_log
      WHERE epoch_id = p_epoch_id
        AND cycle_number = p_cycle_number
        AND event_type IN ('detected', 'captured')
        AND (p_simulation_id IS NULL OR source_simulation_id = p_simulation_id OR target_simulation_id = p_simulation_id)
    ),
    'events_by_type', (
      SELECT coalesce(jsonb_object_agg(event_type, cnt), '{}'::jsonb)
      FROM (
        SELECT event_type, count(*) AS cnt
        FROM battle_log
        WHERE epoch_id = p_epoch_id
          AND cycle_number = p_cycle_number
          AND (p_simulation_id IS NULL OR source_simulation_id = p_simulation_id OR target_simulation_id = p_simulation_id)
        GROUP BY event_type
      ) sub
    ),
    'narrative_highlights', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'event_type', event_type,
          'narrative', narrative,
          'is_public', is_public,
          'source_simulation_id', source_simulation_id,
          'target_simulation_id', target_simulation_id,
          'created_at', created_at
        ) ORDER BY created_at
      ), '[]'::jsonb)
      FROM battle_log
      WHERE epoch_id = p_epoch_id
        AND cycle_number = p_cycle_number
        AND event_type IN ('phase_change', 'betrayal', 'alliance_formed', 'alliance_dissolved', 'building_damaged', 'agent_wounded')
        AND (p_simulation_id IS NULL OR source_simulation_id = p_simulation_id OR target_simulation_id = p_simulation_id)
    )
  );
$$;

-- Sitrep prompt template
INSERT INTO prompt_templates (simulation_id, template_type, prompt_category, locale, template_name, system_prompt, prompt_content, default_model, is_system_default, is_active)
SELECT
  NULL,
  'cycle_sitrep_generation',
  'generation',
  'en',
  'Cycle SITREP Generation',
  'You are a military intelligence analyst providing tactical situation reports (SITREPs) for a competitive multiverse conflict. Write in terse, dramatic military briefing style. Use codenames and operational language.',
  'Generate a SITREP (Situation Report) for Cycle {{cycle_number}} of the current epoch.

Battle Statistics: {{battle_stats}}

Provide a 2-3 paragraph tactical assessment covering:
1. Operational tempo and key engagements
2. Notable intelligence events (detections, betrayals, alliances)
3. Strategic outlook for next cycle

Write in the voice and atmosphere of the simulation world. Be dramatic but concise.',
  'anthropic/claude-3.5-haiku',
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_templates
  WHERE template_type = 'cycle_sitrep_generation' AND simulation_id IS NULL AND locale = 'en'
);
