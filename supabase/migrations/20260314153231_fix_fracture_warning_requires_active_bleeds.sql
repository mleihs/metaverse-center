-- Fix: fracture_warning should only be true when there are ACTIVE incoming bleeds.
-- Previously it fired on high bleed_permeability alone (a structural metric from
-- zone stability), causing the "BLEED THRESHOLD EXCEEDED" ticker to show on
-- simulations that have poor health but no actual cross-sim bleeds.

CREATE OR REPLACE FUNCTION public.get_bleed_status(p_simulation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_overall        float;
  v_permeability   float;
  v_threshold      text;
  v_fracture       boolean;
  v_bleeds         jsonb;
  v_entropy        int;
BEGIN
  SELECT overall_health, bleed_permeability
  INTO v_overall, v_permeability
  FROM mv_simulation_health
  WHERE simulation_id = p_simulation_id;

  v_overall      := COALESCE(v_overall, 0.5);
  v_permeability := COALESCE(v_permeability, 0.0);

  IF v_overall < 0.25 THEN
    v_threshold := 'critical';
  ELSIF v_overall > 0.85 THEN
    v_threshold := 'ascendant';
  ELSE
    v_threshold := 'normal';
  END IF;

  -- fracture_warning requires BOTH high permeability AND active incoming bleeds
  v_fracture := false;

  WITH strongest_per_source AS (
    SELECT DISTINCT ON (source_simulation_id)
      source_simulation_id,
      echo_vector,
      echo_strength
    FROM event_echoes
    WHERE target_simulation_id = p_simulation_id
      AND status = 'completed'
    ORDER BY source_simulation_id, echo_strength DESC
  ),
  source_enriched AS (
    SELECT
      sps.source_simulation_id,
      s.name AS source_simulation_name,
      sps.echo_vector,
      sps.echo_strength,
      COALESCE(
        (SELECT ss.setting_value #>> '{}' FROM simulation_settings ss
         WHERE ss.simulation_id = sps.source_simulation_id
           AND ss.category = 'design' AND ss.setting_key = 'color_primary'
         LIMIT 1),
        '#5bbcd6'
      ) AS theme_primary,
      COALESCE(
        (SELECT ss.setting_value #>> '{}' FROM simulation_settings ss
         WHERE ss.simulation_id = sps.source_simulation_id
           AND ss.category = 'design' AND ss.setting_key = 'font_heading'
         LIMIT 1),
        'Spectral'
      ) AS theme_font,
      COALESCE(
        (SELECT CASE
           WHEN sl.epigraph IS NOT NULL AND sl.epigraph != '' THEN sl.epigraph
           WHEN length(sl.body) > 120 THEN left(sl.body, 120) || '...'
           ELSE COALESCE(sl.body, '')
         END
         FROM simulation_lore sl
         WHERE sl.simulation_id = sps.source_simulation_id
         ORDER BY random() LIMIT 1),
        ''
      ) AS lore_fragment
    FROM strongest_per_source sps
    LEFT JOIN simulations s ON s.id = sps.source_simulation_id
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'source_simulation_id', source_simulation_id,
      'source_simulation_name', COALESCE(source_simulation_name, 'Unknown'),
      'echo_vector', echo_vector,
      'echo_strength', echo_strength,
      'affected_zone_ids', '[]'::jsonb,
      'foreign_theme', jsonb_build_object('primary', theme_primary, 'font_heading', theme_font),
      'lore_fragment', lore_fragment
    )
  ), '[]'::jsonb)
  INTO v_bleeds
  FROM source_enriched;

  v_fracture := v_permeability > 0.6 AND v_bleeds != '[]'::jsonb;

  v_entropy := NULL;
  IF v_threshold = 'critical' THEN
    SELECT 10 - count(*)
    INTO v_entropy
    FROM threshold_actions
    WHERE simulation_id = p_simulation_id;
    v_entropy := GREATEST(v_entropy, 0);
  END IF;

  RETURN jsonb_build_object(
    'active_bleeds',            v_bleeds,
    'bleed_permeability',       v_permeability,
    'fracture_warning',         v_fracture,
    'threshold_state',          v_threshold,
    'overall_health',           v_overall,
    'entropy_cycles_remaining', v_entropy
  );
END;
$function$;
