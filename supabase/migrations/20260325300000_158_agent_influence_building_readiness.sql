-- ============================================================================
-- Migration 158: Agent Influence → Building Readiness (Phase A1)
-- ============================================================================
--
-- Implements the first gameplay integration chain from the Game Systems
-- Integration concept (docs/concepts/game-systems-integration.md Part II):
--
--   Agent Influence → Building Readiness → Zone Stability → Simulation Health
--
-- Agent influence is computed from three weighted components (mirrors
-- frontend formula in AgentDetailsPanel.ts:_computeInfluence):
--
--   influence = relationship_weight × 0.4
--             + profession_weight  × 0.3
--             + ambassador_weight  × 0.3
--
-- The influence score maps to a 3-tier factor applied to building readiness:
--   WEAK    (< 0.25) → 0.85  (15% penalty — agents are dead weight)
--   AVERAGE (0.25–0.55) → 1.00  (neutral — agents pull their weight)
--   STRONG  (> 0.55) → 1.15  (15% bonus — agents actively improve the building)
--
-- Design references: CK3 council system (clear thresholds where behavior
-- changes, not smooth gradients), Victoria 3 proportional staffing.
--
-- Cascading MV recreation order (all 4 dropped by CASCADE on mv_building_readiness):
--   1. mv_building_readiness  (modified: new influence columns + formula)
--   2. mv_embassy_effectiveness  (unchanged, dependency rebuild)
--   3. mv_zone_stability  (unchanged, dependency rebuild)
--   4. mv_simulation_health  (unchanged, dependency rebuild)
--
-- Regression note: Agents currently have ~0 relationships (just bootstrapped
-- by migration 157). Most agents will start in WEAK tier (factor 0.85 = 15%
-- readiness penalty). This is INTENDED per concept doc — low-influence agents
-- are dead weight. Readiness recovers as autonomy creates relationships.
-- ============================================================================


-- ============================================================================
-- 1. REUSABLE FUNCTION: fn_compute_agent_influence
-- ============================================================================
-- STABLE: reads from tables, returns same result within a single statement.
-- SQL language: allows planner inlining for better MV refresh performance.
--
-- Formula:
--   relationship: avg intensity of top 5 relationships / 10  (0.0–1.0)
--   profession:   avg qualification_level / 10                (0.0–0.5, since max ql=5)
--   ambassador:   1.0 if active ambassador, else 0.0
--   total:        rel × 0.4 + prof × 0.3 + amb × 0.3         (0.0–0.85 theoretical max)

CREATE OR REPLACE FUNCTION fn_compute_agent_influence(
  p_agent_id UUID,
  p_simulation_id UUID
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT
    -- Relationship component: top 5 by intensity, avg / 10
    COALESCE((
      SELECT AVG(sub.intensity)::numeric / 10.0
      FROM (
        SELECT ar.intensity
        FROM agent_relationships ar
        WHERE (ar.source_agent_id = p_agent_id OR ar.target_agent_id = p_agent_id)
          AND ar.simulation_id = p_simulation_id
        ORDER BY ar.intensity DESC
        LIMIT 5
      ) sub
    ), 0.0) * 0.4

    -- Profession component: avg qualification / 10 (scoped to THIS simulation)
    + COALESCE((
      SELECT AVG(ap.qualification_level)::numeric / 10.0
      FROM agent_professions ap
      WHERE ap.agent_id = p_agent_id
        AND ap.simulation_id = p_simulation_id
    ), 0.0) * 0.3

    -- Ambassador component: 1.0 if active ambassador (not blocked), else 0.0
    + CASE WHEN EXISTS(
      SELECT 1
      FROM embassies e
      JOIN agents a ON a.id = p_agent_id
      WHERE e.status = 'active'
        AND (
          (e.simulation_a_id = p_simulation_id
           AND e.embassy_metadata->'ambassador_a'->>'name' = a.name)
          OR
          (e.simulation_b_id = p_simulation_id
           AND e.embassy_metadata->'ambassador_b'->>'name' = a.name)
        )
        AND (a.ambassador_blocked_until IS NULL OR a.ambassador_blocked_until < now())
    ) THEN 1.0 ELSE 0.0 END * 0.3
$$;

COMMENT ON FUNCTION fn_compute_agent_influence IS
  'Compute agent influence score (0.0–0.85) from relationships, professions, '
  'and ambassador status. Mirrors frontend AgentDetailsPanel._computeInfluence. '
  'Used by mv_building_readiness to modulate readiness via influence_factor. '
  'Practical max ~0.85: rel(1.0)*0.4 + prof(0.5)*0.3 + amb(1.0)*0.3.';


-- ============================================================================
-- 2. DROP mv_building_readiness CASCADE
-- ============================================================================
-- CASCADE destroys all 4 dependent materialized views:
--   mv_building_readiness → mv_embassy_effectiveness
--                         → mv_zone_stability
--                                → mv_simulation_health

DROP MATERIALIZED VIEW IF EXISTS mv_building_readiness CASCADE;


-- ============================================================================
-- 3. RECREATE mv_building_readiness (WITH influence factor)
-- ============================================================================
-- New CTEs: agent_influence, building_avg_influence
-- New columns: avg_influence, influence_factor
-- Updated readiness formula: staffing × qualification × condition × influence_factor

CREATE MATERIALIZED VIEW mv_building_readiness AS
WITH agent_counts AS (
  SELECT
    bar.building_id,
    COUNT(DISTINCT bar.agent_id) AS assigned_agents
  FROM building_agent_relations bar
  JOIN agents a ON a.id = bar.agent_id AND a.deleted_at IS NULL
  GROUP BY bar.building_id
),
profession_match AS (
  -- How well assigned agents match building's profession requirements
  SELECT
    bpr.building_id,
    COALESCE(AVG(
      CASE
        WHEN ap.qualification_level >= bpr.min_qualification_level THEN 1.0
        WHEN ap.qualification_level IS NOT NULL THEN 0.3
        ELSE 0.3
      END
    ), 0.5) AS match_score,
    COUNT(bpr.id) AS requirement_count
  FROM building_profession_requirements bpr
  LEFT JOIN building_agent_relations bar ON bar.building_id = bpr.building_id
  LEFT JOIN agents a ON a.id = bar.agent_id AND a.deleted_at IS NULL
  LEFT JOIN agent_professions ap ON ap.agent_id = a.id AND ap.profession = bpr.profession AND ap.simulation_id = a.simulation_id
  GROUP BY bpr.building_id
),
-- NEW: Per-agent influence scores via fn_compute_agent_influence.
-- Subquery deduplicates (building_id, agent_id) BEFORE calling the function,
-- avoiding redundant calls when an agent has multiple relation_types in the
-- same building (unique constraint is per relation_type).
agent_influence AS (
  SELECT
    d.building_id,
    d.agent_id,
    fn_compute_agent_influence(d.agent_id, d.simulation_id) AS influence_score
  FROM (
    SELECT DISTINCT bar.building_id, bar.agent_id, bar.simulation_id
    FROM building_agent_relations bar
    JOIN agents a ON a.id = bar.agent_id AND a.deleted_at IS NULL
    JOIN buildings b ON b.id = bar.building_id AND b.deleted_at IS NULL
  ) d
),
-- NEW: Average influence per building → 3-tier influence factor
building_avg_influence AS (
  SELECT
    ai.building_id,
    AVG(ai.influence_score) AS avg_influence,
    CASE
      WHEN AVG(ai.influence_score) < 0.25 THEN 0.85   -- WEAK: dead weight
      WHEN AVG(ai.influence_score) <= 0.55 THEN 1.00   -- AVERAGE: pulls weight
      ELSE 1.15                                          -- STRONG: actively improves
    END AS influence_factor
  FROM agent_influence ai
  GROUP BY ai.building_id
)
SELECT
  b.id AS building_id,
  b.simulation_id,
  b.zone_id,
  b.name AS building_name,
  b.building_type,
  b.building_condition,
  b.population_capacity,
  b.special_type,
  COALESCE(ac.assigned_agents, 0) AS assigned_agents,

  -- Staffing ratio (capped at 1.5)
  CASE
    WHEN COALESCE(b.population_capacity, 0) = 0 THEN
      CASE WHEN COALESCE(ac.assigned_agents, 0) > 0 THEN 1.0 ELSE 0.0 END
    ELSE LEAST(1.5,
      COALESCE(ac.assigned_agents, 0)::numeric / GREATEST(b.population_capacity, 1)
    )
  END AS staffing_ratio,

  -- Staffing status label
  CASE
    WHEN COALESCE(b.population_capacity, 0) = 0 THEN 'n/a'
    WHEN COALESCE(ac.assigned_agents, 0)::numeric / GREATEST(b.population_capacity, 1) < 0.5 THEN 'critically_understaffed'
    WHEN COALESCE(ac.assigned_agents, 0)::numeric / GREATEST(b.population_capacity, 1) < 0.8 THEN 'understaffed'
    WHEN COALESCE(ac.assigned_agents, 0)::numeric / GREATEST(b.population_capacity, 1) <= 1.2 THEN 'operational'
    ELSE 'overcrowded'
  END AS staffing_status,

  -- Qualification match (1.0 if no requirements)
  CASE
    WHEN pm.requirement_count IS NULL OR pm.requirement_count = 0 THEN 1.0
    ELSE COALESCE(pm.match_score, 0.5)
  END AS qualification_match,

  -- Condition factor — data-driven from taxonomy game_weight, with fallback
  COALESCE(
    st_cond.game_weight,
    game_weight_fallback('building_condition', b.building_condition)
  ) AS condition_factor,

  -- Criticality weight — data-driven from taxonomy game_weight, with fallback
  COALESCE(
    st_type.game_weight,
    game_weight_fallback('building_type', b.building_type)
  ) AS criticality_weight,

  -- NEW: Average agent influence for this building (0.0–1.0)
  COALESCE(bai.avg_influence, 0.0) AS avg_influence,

  -- NEW: 3-tier influence factor (0.85 / 1.0 / 1.15)
  -- Buildings with no assigned agents get factor 1.0 (neutral — staffing ratio
  -- already handles the "no agents" penalty, no need to double-penalize)
  COALESCE(bai.influence_factor, 1.0) AS influence_factor,

  -- MASTER METRIC: Building Readiness (updated with influence_factor)
  -- Formula: min(1.0, staffing × qualification × condition × influence)
  LEAST(1.0, GREATEST(0.0,
    LEAST(1.0,
      CASE
        WHEN COALESCE(b.population_capacity, 0) = 0 THEN
          CASE WHEN COALESCE(ac.assigned_agents, 0) > 0 THEN 1.0 ELSE 0.0 END
        ELSE COALESCE(ac.assigned_agents, 0)::numeric / GREATEST(b.population_capacity, 1)
      END
    )
    * CASE
        WHEN pm.requirement_count IS NULL OR pm.requirement_count = 0 THEN 1.0
        ELSE COALESCE(pm.match_score, 0.5)
      END
    * COALESCE(
        st_cond.game_weight,
        game_weight_fallback('building_condition', b.building_condition)
      )
    * COALESCE(bai.influence_factor, 1.0)
  )) AS readiness

FROM buildings b
LEFT JOIN agent_counts ac ON ac.building_id = b.id
LEFT JOIN profession_match pm ON pm.building_id = b.id
LEFT JOIN building_avg_influence bai ON bai.building_id = b.id
-- Data-driven condition factor
LEFT JOIN simulation_taxonomies st_cond ON
  st_cond.simulation_id = b.simulation_id
  AND st_cond.taxonomy_type = 'building_condition'
  AND st_cond.value = b.building_condition
-- Data-driven criticality weight
LEFT JOIN simulation_taxonomies st_type ON
  st_type.simulation_id = b.simulation_id
  AND st_type.taxonomy_type = 'building_type'
  AND st_type.value = b.building_type
WHERE b.deleted_at IS NULL;

CREATE UNIQUE INDEX idx_mv_building_readiness_pk ON mv_building_readiness (building_id);
CREATE INDEX idx_mv_building_readiness_sim ON mv_building_readiness (simulation_id);
CREATE INDEX idx_mv_building_readiness_zone ON mv_building_readiness (zone_id);


-- ============================================================================
-- 4. RECREATE mv_embassy_effectiveness (unchanged, dependency rebuild)
-- ============================================================================
-- Source: migration 031, lines 447–548 (never modified after)

CREATE MATERIALIZED VIEW mv_embassy_effectiveness AS
WITH embassy_building_health AS (
  SELECT
    e.id AS embassy_id,
    COALESCE(bra.readiness, game_weight_fallback('building_condition', ba.building_condition)) AS readiness_a,
    COALESCE(brb.readiness, game_weight_fallback('building_condition', bb.building_condition)) AS readiness_b,
    (COALESCE(bra.readiness, game_weight_fallback('building_condition', ba.building_condition))
     + COALESCE(brb.readiness, game_weight_fallback('building_condition', bb.building_condition))) / 2.0 AS avg_building_health
  FROM embassies e
  JOIN buildings ba ON ba.id = e.building_a_id
  JOIN buildings bb ON bb.id = e.building_b_id
  LEFT JOIN mv_building_readiness bra ON bra.building_id = e.building_a_id
  LEFT JOIN mv_building_readiness brb ON brb.building_id = e.building_b_id
),
embassy_ambassador_quality AS (
  SELECT
    e.id AS embassy_id,
    CASE
      WHEN e.embassy_metadata IS NULL THEN 0.3
      WHEN e.embassy_metadata->'ambassador_a' IS NULL AND e.embassy_metadata->'ambassador_b' IS NULL THEN 0.3
      ELSE LEAST(1.0,
        0.4  -- Base: has any ambassador
        + LEAST(0.2,
          (COALESCE(length(e.embassy_metadata->'ambassador_a'->>'name'), 0)
           + COALESCE(length(e.embassy_metadata->'ambassador_b'->>'name'), 0))::numeric / 50.0
        )
        + CASE WHEN e.embassy_metadata->'ambassador_a'->>'quirk' IS NOT NULL THEN 0.1 ELSE 0 END
        + CASE WHEN e.embassy_metadata->'ambassador_b'->>'quirk' IS NOT NULL THEN 0.1 ELSE 0 END
        + CASE WHEN e.embassy_metadata->'ambassador_a'->>'role' IS NOT NULL THEN 0.05 ELSE 0 END
        + CASE WHEN e.embassy_metadata->'ambassador_b'->>'role' IS NOT NULL THEN 0.05 ELSE 0 END
      )
    END AS ambassador_quality
  FROM embassies e
),
embassy_vector_alignment AS (
  SELECT
    e.id AS embassy_id,
    CASE
      WHEN sc.bleed_vectors IS NOT NULL AND e.bleed_vector = ANY(sc.bleed_vectors) THEN 1.0
      ELSE 0.0
    END AS vector_alignment
  FROM embassies e
  LEFT JOIN simulation_connections sc ON (
    (sc.simulation_a_id = e.simulation_a_id AND sc.simulation_b_id = e.simulation_b_id)
    OR (sc.simulation_a_id = e.simulation_b_id AND sc.simulation_b_id = e.simulation_a_id)
  ) AND sc.is_active = true
)
SELECT
  e.id AS embassy_id,
  e.simulation_a_id,
  e.simulation_b_id,
  e.building_a_id,
  e.building_b_id,
  e.status,
  e.bleed_vector,

  LEAST(1.0, COALESCE(ebh.avg_building_health, 0.5)) AS building_health,
  LEAST(1.0, COALESCE(eaq.ambassador_quality, 0.3)) AS ambassador_quality,
  COALESCE(eva.vector_alignment, 0.0) AS vector_alignment,

  -- MASTER METRIC: Embassy Effectiveness
  CASE
    WHEN e.status != 'active' THEN 0.0
    ELSE LEAST(1.0, GREATEST(0.0,
      (LEAST(1.0, COALESCE(ebh.avg_building_health, 0.5)) * 0.4)
      + (LEAST(1.0, COALESCE(eaq.ambassador_quality, 0.3)) * 0.4)
      + (COALESCE(eva.vector_alignment, 0.0) * 0.2)
    ))
  END AS effectiveness,

  CASE
    WHEN e.status != 'active' THEN 'dormant'
    WHEN LEAST(1.0, GREATEST(0.0,
      (LEAST(1.0, COALESCE(ebh.avg_building_health, 0.5)) * 0.4)
      + (LEAST(1.0, COALESCE(eaq.ambassador_quality, 0.3)) * 0.4)
      + (COALESCE(eva.vector_alignment, 0.0) * 0.2)
    )) < 0.3 THEN 'dormant'
    WHEN LEAST(1.0, GREATEST(0.0,
      (LEAST(1.0, COALESCE(ebh.avg_building_health, 0.5)) * 0.4)
      + (LEAST(1.0, COALESCE(eaq.ambassador_quality, 0.3)) * 0.4)
      + (COALESCE(eva.vector_alignment, 0.0) * 0.2)
    )) < 0.6 THEN 'limited'
    WHEN LEAST(1.0, GREATEST(0.0,
      (LEAST(1.0, COALESCE(ebh.avg_building_health, 0.5)) * 0.4)
      + (LEAST(1.0, COALESCE(eaq.ambassador_quality, 0.3)) * 0.4)
      + (COALESCE(eva.vector_alignment, 0.0) * 0.2)
    )) < 0.8 THEN 'operational'
    ELSE 'optimal'
  END AS effectiveness_label

FROM embassies e
LEFT JOIN embassy_building_health ebh ON ebh.embassy_id = e.id
LEFT JOIN embassy_ambassador_quality eaq ON eaq.embassy_id = e.id
LEFT JOIN embassy_vector_alignment eva ON eva.embassy_id = e.id;

CREATE UNIQUE INDEX idx_mv_embassy_eff_pk ON mv_embassy_effectiveness (embassy_id);
CREATE INDEX idx_mv_embassy_eff_sim_a ON mv_embassy_effectiveness (simulation_a_id);
CREATE INDEX idx_mv_embassy_eff_sim_b ON mv_embassy_effectiveness (simulation_b_id);


-- ============================================================================
-- 5. RECREATE mv_zone_stability (unchanged, dependency rebuild)
-- ============================================================================
-- Source: migration 072, lines 255–470 (latest version with spill, vulnerability,
-- fortification CTEs and event_zone_links)

CREATE MATERIALIZED VIEW mv_zone_stability AS
WITH pressure_config AS (
  SELECT
    simulation_id,
    COALESCE((setting_value #>> '{}')::int, 30) AS window_days
  FROM simulation_settings
  WHERE category = 'world' AND setting_key = 'event_pressure_window_days'
),
spill_config AS (
  SELECT
    simulation_id,
    COALESCE((setting_value #>> '{}')::numeric, 0.3) AS spill_factor
  FROM simulation_settings
  WHERE category = 'game_mechanics' AND setting_key = 'pressure_spill_factor'
),
vulnerability_config AS (
  SELECT
    simulation_id,
    setting_value AS vuln_matrix
  FROM simulation_settings
  WHERE category = 'game_mechanics' AND setting_key = 'zone_vulnerability_matrix'
),
zone_infrastructure AS (
  SELECT
    br.zone_id,
    br.simulation_id,
    CASE
      WHEN SUM(br.criticality_weight) = 0 THEN 0.5
      ELSE SUM(br.readiness * br.criticality_weight) / SUM(br.criticality_weight)
    END AS infrastructure_score,
    COUNT(*) AS building_count,
    SUM(br.assigned_agents) AS total_agents,
    SUM(br.population_capacity) AS total_capacity,
    COUNT(*) FILTER (WHERE br.staffing_status = 'critically_understaffed') AS critical_understaffed_count,
    AVG(br.readiness) AS avg_readiness
  FROM mv_building_readiness br
  WHERE br.zone_id IS NOT NULL
  GROUP BY br.zone_id, br.simulation_id
),
-- Zone event pressure via event_zone_links (replaces fragile building_event_relations path)
zone_event_pressure AS (
  SELECT
    z.id AS zone_id,
    z.simulation_id,
    LEAST(1.0,
      COALESCE(
        SUM(
          (
            POWER(e.impact_level::numeric / 10.0, 1.5)
            * CASE e.event_status
                WHEN 'active'     THEN 1.0
                WHEN 'escalating' THEN 1.3
                WHEN 'resolving'  THEN 0.5
                WHEN 'resolved'   THEN 0.0
                WHEN 'archived'   THEN 0.0
                ELSE 1.0
              END
            * ezl.affinity_weight
            * COALESCE((vc.vuln_matrix->z.zone_type->>e.event_type)::numeric, 1.0)
          )
          + COALESCE((e.metadata->>'reaction_modifier')::numeric, 0.0)
        ) FILTER (
          WHERE e.occurred_at >= (now() - interval '1 day' * COALESCE(pc.window_days, 30))
          AND e.deleted_at IS NULL
          AND e.event_status NOT IN ('resolved', 'archived')
        ) / 15.0,
        0.0
      )
    ) AS event_pressure
  FROM zones z
  LEFT JOIN pressure_config pc ON pc.simulation_id = z.simulation_id
  LEFT JOIN vulnerability_config vc ON vc.simulation_id = z.simulation_id
  LEFT JOIN event_zone_links ezl ON ezl.zone_id = z.id
  LEFT JOIN events e ON e.id = ezl.event_id
    AND e.simulation_id = z.simulation_id
    AND e.deleted_at IS NULL
  GROUP BY z.id, z.simulation_id, pc.window_days
),
-- Ambient pressure from events with NO zone links (Pressure Spill)
ambient_event_pressure AS (
  SELECT
    z.id AS zone_id,
    z.simulation_id,
    COALESCE(
      SUM(
        POWER(e.impact_level::numeric / 10.0, 1.5)
        * CASE e.event_status
            WHEN 'active'     THEN 1.0
            WHEN 'escalating' THEN 1.3
            WHEN 'resolving'  THEN 0.5
            WHEN 'resolved'   THEN 0.0
            WHEN 'archived'   THEN 0.0
            ELSE 1.0
          END
        * COALESCE(sc.spill_factor, 0.3)
      ) FILTER (
        WHERE e.occurred_at >= (now() - interval '1 day' * COALESCE(pc.window_days, 30))
        AND e.deleted_at IS NULL
        AND e.event_status NOT IN ('resolved', 'archived')
      ) / 15.0,
      0.0
    ) AS ambient_pressure
  FROM zones z
  CROSS JOIN events e
  LEFT JOIN event_zone_links ezl ON ezl.event_id = e.id
  LEFT JOIN pressure_config pc ON pc.simulation_id = z.simulation_id
  LEFT JOIN spill_config sc ON sc.simulation_id = z.simulation_id
  WHERE e.simulation_id = z.simulation_id
    AND ezl.id IS NULL  -- only unlinked events
  GROUP BY z.id, z.simulation_id
),
-- Zone fortification from active zone_actions
zone_fortification AS (
  SELECT
    za.zone_id,
    SUM(za.effect_value) AS pressure_reduction,
    bool_or(za.action_type = 'quarantine') AS is_quarantined
  FROM zone_actions za
  WHERE za.deleted_at IS NULL
    AND za.expires_at > now()
  GROUP BY za.zone_id
)
SELECT
  z.id AS zone_id,
  z.simulation_id,
  z.city_id,
  z.name AS zone_name,
  z.zone_type,
  z.security_level,

  COALESCE(zi.infrastructure_score, 0.0) AS infrastructure_score,
  COALESCE(
    st_sec.game_weight,
    game_weight_fallback('security_level', z.security_level)
  ) AS security_factor,
  COALESCE(zep.event_pressure, 0.0) AS event_pressure,
  COALESCE(aep.ambient_pressure, 0.0) AS ambient_pressure,
  COALESCE(zf.pressure_reduction, 0.0) AS fortification_reduction,
  COALESCE(zf.is_quarantined, false) AS is_quarantined,

  COALESCE(zi.building_count, 0) AS building_count,
  COALESCE(zi.total_agents, 0) AS total_agents,
  COALESCE(zi.total_capacity, 0) AS total_capacity,
  COALESCE(zi.critical_understaffed_count, 0) AS critical_understaffed_count,
  COALESCE(zi.avg_readiness, 0.0) AS avg_readiness,

  -- Total pressure = event + ambient - fortification (min 0)
  GREATEST(0.0,
    COALESCE(zep.event_pressure, 0.0)
    + COALESCE(aep.ambient_pressure, 0.0)
    - COALESCE(zf.pressure_reduction, 0.0)
  ) AS total_pressure,

  -- Stability formula
  LEAST(1.0, GREATEST(0.0,
    (COALESCE(zi.infrastructure_score, 0.0) * 0.5)
    + (COALESCE(st_sec.game_weight, game_weight_fallback('security_level', z.security_level)) * 0.3)
    - (GREATEST(0.0,
        COALESCE(zep.event_pressure, 0.0)
        + COALESCE(aep.ambient_pressure, 0.0)
        - COALESCE(zf.pressure_reduction, 0.0)
      ) * 0.25)
  )) AS stability,

  CASE
    WHEN LEAST(1.0, GREATEST(0.0,
      (COALESCE(zi.infrastructure_score, 0.0) * 0.5)
      + (COALESCE(st_sec.game_weight, game_weight_fallback('security_level', z.security_level)) * 0.3)
      - (GREATEST(0.0,
          COALESCE(zep.event_pressure, 0.0)
          + COALESCE(aep.ambient_pressure, 0.0)
          - COALESCE(zf.pressure_reduction, 0.0)
        ) * 0.25)
    )) < 0.3 THEN 'critical'
    WHEN LEAST(1.0, GREATEST(0.0,
      (COALESCE(zi.infrastructure_score, 0.0) * 0.5)
      + (COALESCE(st_sec.game_weight, game_weight_fallback('security_level', z.security_level)) * 0.3)
      - (GREATEST(0.0,
          COALESCE(zep.event_pressure, 0.0)
          + COALESCE(aep.ambient_pressure, 0.0)
          - COALESCE(zf.pressure_reduction, 0.0)
        ) * 0.25)
    )) < 0.5 THEN 'unstable'
    WHEN LEAST(1.0, GREATEST(0.0,
      (COALESCE(zi.infrastructure_score, 0.0) * 0.5)
      + (COALESCE(st_sec.game_weight, game_weight_fallback('security_level', z.security_level)) * 0.3)
      - (GREATEST(0.0,
          COALESCE(zep.event_pressure, 0.0)
          + COALESCE(aep.ambient_pressure, 0.0)
          - COALESCE(zf.pressure_reduction, 0.0)
        ) * 0.25)
    )) < 0.7 THEN 'functional'
    WHEN LEAST(1.0, GREATEST(0.0,
      (COALESCE(zi.infrastructure_score, 0.0) * 0.5)
      + (COALESCE(st_sec.game_weight, game_weight_fallback('security_level', z.security_level)) * 0.3)
      - (GREATEST(0.0,
          COALESCE(zep.event_pressure, 0.0)
          + COALESCE(aep.ambient_pressure, 0.0)
          - COALESCE(zf.pressure_reduction, 0.0)
        ) * 0.25)
    )) < 0.9 THEN 'stable'
    ELSE 'exemplary'
  END AS stability_label

FROM zones z
LEFT JOIN zone_infrastructure zi ON zi.zone_id = z.id
LEFT JOIN zone_event_pressure zep ON zep.zone_id = z.id
LEFT JOIN ambient_event_pressure aep ON aep.zone_id = z.id
LEFT JOIN zone_fortification zf ON zf.zone_id = z.id
LEFT JOIN simulation_taxonomies st_sec ON
  st_sec.simulation_id = z.simulation_id
  AND st_sec.taxonomy_type = 'security_level'
  AND st_sec.value = z.security_level;

CREATE UNIQUE INDEX idx_mv_zone_stability_pk ON mv_zone_stability (zone_id);
CREATE INDEX idx_mv_zone_stability_sim ON mv_zone_stability (simulation_id);


-- ============================================================================
-- 6. RECREATE mv_simulation_health (unchanged, dependency rebuild)
-- ============================================================================
-- Source: migration 132, lines 64–170 (latest version with health_config
-- baseline floor from platform_settings)

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


-- ============================================================================
-- 7. RESTORE GRANTS (lost by DROP CASCADE)
-- ============================================================================

GRANT SELECT ON mv_building_readiness TO authenticated, anon;
GRANT SELECT ON mv_embassy_effectiveness TO authenticated, anon;
GRANT SELECT ON mv_zone_stability TO authenticated, anon;
GRANT SELECT ON mv_simulation_health TO authenticated, anon;


-- ============================================================================
-- 8. REFRESH (sanity — MVs are auto-populated by CREATE, but ensure order)
-- ============================================================================
-- Note: Cannot use CONCURRENTLY here since that requires the MV to already
-- have data AND a unique index (which it does after CREATE, but the
-- CONCURRENTLY flag also requires a prior successful non-concurrent refresh
-- when the MV was created WITH NO DATA — not our case, we use default WITH DATA).
-- Using plain REFRESH as a safety net.

SELECT refresh_all_game_metrics();
