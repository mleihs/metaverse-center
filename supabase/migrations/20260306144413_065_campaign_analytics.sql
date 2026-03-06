-- 065: Campaign Analytics aggregation function
CREATE OR REPLACE FUNCTION get_campaign_analytics(p_simulation_id uuid, p_campaign_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT jsonb_build_object(
    'event_count', (
      SELECT count(*)
      FROM campaign_events
      WHERE campaign_id = p_campaign_id
        AND simulation_id = p_simulation_id
    ),
    'events_by_type', (
      SELECT coalesce(jsonb_object_agg(event_type, cnt), '{}'::jsonb)
      FROM (
        SELECT e.event_type, count(*) AS cnt
        FROM campaign_events ce
        JOIN events e ON e.id = ce.event_id
        WHERE ce.campaign_id = p_campaign_id
          AND ce.simulation_id = p_simulation_id
          AND e.deleted_at IS NULL
        GROUP BY e.event_type
      ) sub
    ),
    'echo_count', (
      SELECT count(*)
      FROM event_echoes ee
      JOIN campaign_events ce ON ce.event_id = ee.source_event_id
      WHERE ce.campaign_id = p_campaign_id
        AND ce.simulation_id = p_simulation_id
        AND ee.status = 'completed'
    ),
    'avg_impact', (
      SELECT round(avg(e.impact_level)::numeric, 1)
      FROM campaign_events ce
      JOIN events e ON e.id = ce.event_id
      WHERE ce.campaign_id = p_campaign_id
        AND ce.simulation_id = p_simulation_id
        AND e.deleted_at IS NULL
    ),
    'metrics_timeline', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'name', metric_name,
          'value', metric_value,
          'at', measured_at
        ) ORDER BY measured_at
      ), '[]'::jsonb)
      FROM campaign_metrics
      WHERE campaign_id = p_campaign_id
        AND simulation_id = p_simulation_id
    )
  );
$$;
