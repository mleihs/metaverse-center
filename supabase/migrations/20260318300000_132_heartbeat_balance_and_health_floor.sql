-- Migration 132: Heartbeat balance fixes, health floor, and new configurable settings
--
-- Bug fixes:
--   - Add health_baseline_floor to mv_simulation_health so fresh sims don't start critical
--   - Add climax_start_tick column to narrative_arcs for correct climax duration tracking
--
-- New configurable settings (all admin-editable via platform_settings):
--   - heartbeat_scar_growth_rate: scar tissue growth multiplier (was hardcoded 0.05)
--   - heartbeat_scar_susceptibility_multiplier: scar tissue amplifies pressure
--   - heartbeat_attunement_passive_growth_rate: attunement grows during peace
--   - heartbeat_bureau_adapt_scar_reduction: adapt response reduces scar tissue
--   - heartbeat_zone_stability_event_pressure_weight: event pressure weight in stability
--   - heartbeat_health_baseline_floor: minimum health floor for new simulations
--   - heartbeat_resonance_warning_ticks: ticks of warning before resonance impact


-- ============================================================================
-- 1. New platform_settings
-- ============================================================================

INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES
  ('heartbeat_scar_growth_rate', '0.05',
   'Scar tissue growth rate per tick (pressure × this value). Was hardcoded.'),
  ('heartbeat_scar_susceptibility_multiplier', '0.50',
   'How much accumulated scar tissue amplifies resonance pressure (0 = disabled).'),
  ('heartbeat_attunement_passive_growth_rate', '0.01',
   'Attunement depth growth per tick during peacetime (no matching events). Full rate requires active events.'),
  ('heartbeat_bureau_adapt_scar_reduction', '0.20',
   'Fraction of scar tissue reduced when an adapt bureau response resolves (0.20 = 20% reduction).'),
  ('heartbeat_zone_stability_event_pressure_weight', '0.40',
   'Weight of event_pressure in zone stability formula (was 0.25 in MV, now configurable via Python override).'),
  ('heartbeat_health_baseline_floor', '0.10',
   'Minimum health floor added to overall_health so fresh sims never start critical.'),
  ('heartbeat_resonance_warning_ticks', '2',
   'Number of warning ticks before a resonance impacts (telegraph incoming resonances).'),
  ('heartbeat_building_crisis_degradation', '0.10',
   'Amount building_condition degrades per crisis/sabotage event affecting the zone (0.10 = 10%).')
ON CONFLICT (setting_key) DO NOTHING;

-- Reduce default tick interval from 8h to 4h for better engagement
UPDATE platform_settings
SET setting_value = '14400', description = 'Default tick interval in seconds (4h = 6 ticks/day)'
WHERE setting_key = 'heartbeat_interval_seconds' AND setting_value = '28800';


-- ============================================================================
-- 2. Add climax_start_tick to narrative_arcs (fixes climax duration tracking)
-- ============================================================================

ALTER TABLE narrative_arcs
  ADD COLUMN IF NOT EXISTS climax_start_tick integer;

COMMENT ON COLUMN narrative_arcs.climax_start_tick IS
  'Tick number when arc entered climax status. Used to calculate time-in-climax correctly.';


-- ============================================================================
-- 3. Recreate mv_simulation_health with baseline floor
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_health CASCADE;

CREATE MATERIALIZED VIEW mv_simulation_health AS
WITH sim_zones AS (
  SELECT zs.simulation_id, AVG(zs.stability) AS avg_zone_stability, COUNT(*) AS zone_count,
    COUNT(*) FILTER (WHERE zs.stability_label = 'critical') AS critical_zone_count,
    COUNT(*) FILTER (WHERE zs.stability_label = 'unstable') AS unstable_zone_count,
    MIN(zs.stability) AS min_zone_stability, MAX(zs.stability) AS max_zone_stability,
    SUM(zs.building_count) AS total_buildings, SUM(zs.total_agents) AS total_agents,
    SUM(zs.total_capacity) AS total_capacity
  FROM mv_zone_stability zs GROUP BY zs.simulation_id
),
sim_buildings AS (
  SELECT br.simulation_id, COUNT(*) AS building_count, AVG(br.readiness) AS avg_readiness,
    COUNT(*) FILTER (WHERE br.staffing_status = 'critically_understaffed') AS critically_understaffed,
    COUNT(*) FILTER (WHERE br.staffing_status = 'overcrowded') AS overcrowded
  FROM mv_building_readiness br GROUP BY br.simulation_id
),
sim_diplomacy AS (
  SELECT sim_id, SUM(eff) AS diplomatic_reach, COUNT(*) AS active_embassy_count, AVG(eff) AS avg_embassy_effectiveness
  FROM (
    SELECT ee.simulation_a_id AS sim_id, ee.effectiveness AS eff FROM mv_embassy_effectiveness ee WHERE ee.status = 'active'
    UNION ALL
    SELECT ee.simulation_b_id AS sim_id, ee.effectiveness AS eff FROM mv_embassy_effectiveness ee WHERE ee.status = 'active'
  ) embassy_per_sim GROUP BY sim_id
),
sim_bleed AS (
  SELECT s.id AS simulation_id,
    COUNT(DISTINCT eo.id) AS outbound_echoes, COUNT(DISTINCT ei.id) AS inbound_echoes,
    COALESCE(AVG(eo.echo_strength), 0) AS avg_outbound_strength
  FROM simulations s
  LEFT JOIN event_echoes eo ON eo.source_simulation_id = s.id AND eo.created_at >= (now() - interval '30 days')
  LEFT JOIN event_echoes ei ON ei.target_simulation_id = s.id AND ei.created_at >= (now() - interval '30 days')
  WHERE s.deleted_at IS NULL GROUP BY s.id
),
-- Load the configurable health floor from platform_settings
health_config AS (
  SELECT COALESCE(
    (SELECT LEAST(0.30, GREATEST(0.0, (setting_value::text)::numeric))
     FROM platform_settings WHERE setting_key = 'heartbeat_health_baseline_floor'),
    0.10
  ) AS baseline_floor
)
SELECT
  s.id AS simulation_id, s.name AS simulation_name, s.slug,
  COALESCE(sz.avg_zone_stability, 0.0) AS avg_zone_stability,
  COALESCE(sz.zone_count, 0) AS zone_count,
  COALESCE(sz.critical_zone_count, 0) AS critical_zone_count,
  COALESCE(sz.unstable_zone_count, 0) AS unstable_zone_count,
  COALESCE(sb.building_count, 0) AS building_count,
  COALESCE(sb.avg_readiness, 0.0) AS avg_readiness,
  COALESCE(sb.critically_understaffed, 0) AS critically_understaffed_buildings,
  COALESCE(sb.overcrowded, 0) AS overcrowded_buildings,
  COALESCE(sz.total_agents, 0) AS total_agents_assigned,
  COALESCE(sz.total_capacity, 0) AS total_capacity,
  COALESCE(sd.diplomatic_reach, 0.0) AS diplomatic_reach,
  COALESCE(sd.active_embassy_count, 0) AS active_embassy_count,
  COALESCE(sd.avg_embassy_effectiveness, 0.0) AS avg_embassy_effectiveness,
  COALESCE(sbl.outbound_echoes, 0) AS outbound_echoes,
  COALESCE(sbl.inbound_echoes, 0) AS inbound_echoes,
  COALESCE(sbl.avg_outbound_strength, 0.0) AS avg_outbound_strength,
  LEAST(1.0, GREATEST(0.0,
    (1.0 - COALESCE(sz.avg_zone_stability, 0.5) * 0.3) * (0.5 + LEAST(0.5, COALESCE(sd.diplomatic_reach, 0.0) / 5.0))
  )) AS bleed_permeability,
  -- Health formula: zone stability (60%) + building readiness (20%) + diplomacy (20%) + baseline floor
  -- Floor prevents fresh sims from starting critical; capped at 1.0
  LEAST(1.0, GREATEST(0.0,
    hc.baseline_floor
    + (COALESCE(sz.avg_zone_stability, 0.0) * 0.6)
    + (COALESCE(sb.avg_readiness, 0.0) * 0.2)
    + (LEAST(1.0, COALESCE(sd.diplomatic_reach, 0.0) / 3.0) * 0.2)
  )) AS overall_health,
  CASE
    WHEN LEAST(1.0, GREATEST(0.0,
      hc.baseline_floor
      + (COALESCE(sz.avg_zone_stability, 0.0) * 0.6)
      + (COALESCE(sb.avg_readiness, 0.0) * 0.2)
      + (LEAST(1.0, COALESCE(sd.diplomatic_reach, 0.0) / 3.0) * 0.2)
    )) < 0.3 THEN 'critical'
    WHEN LEAST(1.0, GREATEST(0.0,
      hc.baseline_floor
      + (COALESCE(sz.avg_zone_stability, 0.0) * 0.6)
      + (COALESCE(sb.avg_readiness, 0.0) * 0.2)
      + (LEAST(1.0, COALESCE(sd.diplomatic_reach, 0.0) / 3.0) * 0.2)
    )) < 0.5 THEN 'struggling'
    WHEN LEAST(1.0, GREATEST(0.0,
      hc.baseline_floor
      + (COALESCE(sz.avg_zone_stability, 0.0) * 0.6)
      + (COALESCE(sb.avg_readiness, 0.0) * 0.2)
      + (LEAST(1.0, COALESCE(sd.diplomatic_reach, 0.0) / 3.0) * 0.2)
    )) < 0.7 THEN 'functional'
    WHEN LEAST(1.0, GREATEST(0.0,
      hc.baseline_floor
      + (COALESCE(sz.avg_zone_stability, 0.0) * 0.6)
      + (COALESCE(sb.avg_readiness, 0.0) * 0.2)
      + (LEAST(1.0, COALESCE(sd.diplomatic_reach, 0.0) / 3.0) * 0.2)
    )) < 0.9 THEN 'thriving'
    ELSE 'exemplary'
  END AS health_label
FROM simulations s
CROSS JOIN health_config hc
LEFT JOIN sim_zones sz ON sz.simulation_id = s.id
LEFT JOIN sim_buildings sb ON sb.simulation_id = s.id
LEFT JOIN sim_diplomacy sd ON sd.sim_id = s.id
LEFT JOIN sim_bleed sbl ON sbl.simulation_id = s.id
WHERE s.deleted_at IS NULL AND s.status IN ('active', 'configuring');

CREATE UNIQUE INDEX idx_mv_sim_health_pk ON mv_simulation_health (simulation_id);
CREATE INDEX idx_mv_sim_health_slug ON mv_simulation_health (slug);

-- Restore grants
GRANT SELECT ON mv_simulation_health TO authenticated, anon;


-- ============================================================================
-- 4. Composite indexes for heartbeat query performance (Tier 5, #25)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_heartbeat_entries_sim_tick
  ON heartbeat_entries (simulation_id, tick_number DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bureau_responses_sim_status_tick
  ON bureau_responses (simulation_id, status, submitted_before_tick);

CREATE INDEX IF NOT EXISTS idx_narrative_arcs_sim_status_type
  ON narrative_arcs (simulation_id, status, arc_type);


-- Refresh the MV after recreation
SELECT refresh_all_game_metrics();
