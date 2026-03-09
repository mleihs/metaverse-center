-- View: map_simulations
-- Consolidates the 3-query + Python-filter pattern from connection_service._fetch_map_simulations
-- into a single Postgres view. Joins simulations → game_epochs (epoch_status) →
-- simulation_dashboard (counts) and excludes game instances whose epoch has ended.
--
-- Used by: GET /api/v1/public/map-data (ConnectionService.get_map_data)

CREATE OR REPLACE VIEW public.map_simulations AS
SELECT
  s.id,
  s.name,
  s.slug,
  s.theme,
  s.description,
  s.banner_url,
  s.status,
  s.simulation_type,
  s.source_template_id,
  s.epoch_id,
  ge.status AS epoch_status,
  COALESCE(sd.agent_count, 0)    AS agent_count,
  COALESCE(sd.building_count, 0) AS building_count,
  COALESCE(sd.event_count, 0)    AS event_count
FROM simulations s
LEFT JOIN game_epochs ge ON ge.id = s.epoch_id
LEFT JOIN simulation_dashboard sd ON sd.simulation_id = s.id
WHERE s.status = 'active'
  AND s.simulation_type != 'archived'
  AND s.deleted_at IS NULL
  -- Exclude game instances from completed/cancelled epochs
  AND NOT (
    s.simulation_type = 'game_instance'
    AND ge.status IN ('completed', 'cancelled')
  )
ORDER BY s.created_at ASC;

-- Public read access (map is public-first)
GRANT SELECT ON public.map_simulations TO authenticated, anon;

COMMENT ON VIEW public.map_simulations IS
  'Pre-filtered simulations for the Cartographer''s Map. Joins epoch status + dashboard counts. '
  'Excludes archived sims and game instances from completed/cancelled epochs.';
