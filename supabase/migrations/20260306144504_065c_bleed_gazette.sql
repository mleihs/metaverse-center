-- 065c: Bleed Gazette — multiverse activity news feed
CREATE OR REPLACE FUNCTION get_bleed_gazette_feed(p_limit int DEFAULT 20)
RETURNS TABLE (
  entry_type text,
  source_simulation jsonb,
  target_simulation jsonb,
  echo_vector text,
  strength float,
  narrative text,
  created_at timestamptz
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  -- Completed echoes (cross-sim bleed events)
  (
    SELECT
      'echo_completed'::text AS entry_type,
      jsonb_build_object('id', ss.id, 'name', ss.name, 'slug', ss.slug, 'theme', ss.theme) AS source_simulation,
      jsonb_build_object('id', ts.id, 'name', ts.name, 'slug', ts.slug, 'theme', ts.theme) AS target_simulation,
      ee.echo_vector,
      ee.echo_strength::float AS strength,
      coalesce(te.title, se.title, 'An echo ripples across realities') AS narrative,
      ee.created_at
    FROM event_echoes ee
    JOIN events se ON se.id = ee.source_event_id
    JOIN simulations ss ON ss.id = se.simulation_id
    LEFT JOIN events te ON te.id = ee.target_event_id
    JOIN simulations ts ON ts.id = ee.target_simulation_id
    WHERE ee.status = 'completed'
      AND ss.status = 'active'
      AND ts.status = 'active'
    ORDER BY ee.created_at DESC
    LIMIT p_limit
  )
  UNION ALL
  -- Embassy status changes
  (
    SELECT
      'embassy_change'::text AS entry_type,
      jsonb_build_object('id', sa.id, 'name', sa.name, 'slug', sa.slug, 'theme', sa.theme) AS source_simulation,
      jsonb_build_object('id', sb.id, 'name', sb.name, 'slug', sb.slug, 'theme', sb.theme) AS target_simulation,
      emb.bleed_vector AS echo_vector,
      NULL::float AS strength,
      ('Embassy established: ' || sa.name || ' <-> ' || sb.name) AS narrative,
      emb.created_at
    FROM embassies emb
    JOIN simulations sa ON sa.id = emb.simulation_a_id
    JOIN simulations sb ON sb.id = emb.simulation_b_id
    WHERE emb.status = 'active'
      AND sa.status = 'active'
      AND sb.status = 'active'
    ORDER BY emb.created_at DESC
    LIMIT p_limit
  )
  UNION ALL
  -- Phase changes from battle log (public, cross-epoch)
  (
    SELECT
      'phase_change'::text AS entry_type,
      NULL::jsonb AS source_simulation,
      NULL::jsonb AS target_simulation,
      NULL::text AS echo_vector,
      NULL::float AS strength,
      bl.narrative,
      bl.created_at
    FROM battle_log bl
    JOIN game_epochs ge ON ge.id = bl.epoch_id
    WHERE bl.event_type = 'phase_change'
      AND bl.is_public = true
      AND ge.status IN ('foundation', 'competition', 'reckoning', 'completed')
    ORDER BY bl.created_at DESC
    LIMIT p_limit
  )
  ORDER BY created_at DESC
  LIMIT p_limit;
$$;
