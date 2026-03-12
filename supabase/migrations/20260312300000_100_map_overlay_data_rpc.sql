-- Map overlay data: zone topology, historical events, and bleed details in one round-trip.
-- Replaces three Python-side grouping methods in connection_service.

CREATE OR REPLACE FUNCTION public.get_map_overlay_data(p_simulation_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_zones   jsonb;
  v_events  jsonb;
  v_bleeds  jsonb;
BEGIN
  -- 1. Zone topology: grouped by simulation_id
  SELECT COALESCE(jsonb_object_agg(simulation_id, zones), '{}'::jsonb)
  INTO v_zones
  FROM (
    SELECT simulation_id, jsonb_agg(
      jsonb_build_object(
        'zone_id',         zone_id,
        'simulation_id',   simulation_id,
        'zone_name',       zone_name,
        'zone_type',       zone_type,
        'stability',       stability,
        'stability_label', stability_label,
        'building_count',  building_count,
        'security_level',  security_level
      ) ORDER BY stability
    ) AS zones
    FROM mv_zone_stability
    WHERE simulation_id = ANY(p_simulation_ids)
    GROUP BY simulation_id
  ) grouped;

  -- 2. Historical events: top 20 high-impact per simulation
  SELECT COALESCE(jsonb_object_agg(simulation_id, events), '{}'::jsonb)
  INTO v_events
  FROM (
    SELECT simulation_id, jsonb_agg(
      jsonb_build_object(
        'id',           id,
        'simulation_id', simulation_id,
        'title',        title,
        'event_type',   event_type,
        'impact_level', impact_level,
        'occurred_at',  occurred_at,
        'location',     location
      ) ORDER BY occurred_at DESC
    ) AS events
    FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY simulation_id ORDER BY occurred_at DESC
      ) AS rn
      FROM active_events
      WHERE simulation_id = ANY(p_simulation_ids)
        AND impact_level >= 5
    ) ranked
    WHERE rn <= 20
    GROUP BY simulation_id
  ) grouped;

  -- 3. Active bleed details: grouped by source|target key
  SELECT COALESCE(jsonb_object_agg(connection_key, vectors), '{}'::jsonb)
  INTO v_bleeds
  FROM (
    SELECT
      source_simulation_id || '|' || target_simulation_id AS connection_key,
      jsonb_agg(
        jsonb_build_object(
          'vector',   echo_vector,
          'strength', echo_strength
        ) ORDER BY created_at DESC
      ) AS vectors
    FROM event_echoes
    WHERE status = 'completed'
      AND (source_simulation_id = ANY(p_simulation_ids)
           OR target_simulation_id = ANY(p_simulation_ids))
    GROUP BY source_simulation_id, target_simulation_id
  ) grouped;

  RETURN jsonb_build_object(
    'zone_topology',        v_zones,
    'historical_events',    v_events,
    'active_bleed_details', v_bleeds
  );
END;
$function$;
