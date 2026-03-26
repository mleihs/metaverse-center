-- ============================================================================
-- Migration 160: Bootstrap building_agent_relations from agents.current_building_id
-- ============================================================================
--
-- BLOCKER FIX: Migration 157 assigned agents to buildings via
-- agents.current_building_id but never populated building_agent_relations.
-- The MV mv_building_readiness reads from building_agent_relations to compute
-- staffing ratios, qualification matches, and influence factors. Without records
-- in that table, ALL readiness values are 0% — cascading to mv_zone_stability
-- and mv_simulation_health showing 0% across all simulations.
--
-- This migration:
--   1. Creates fn_bootstrap_building_relations(UUID) — reusable RPC for
--      populating building_agent_relations from agents.current_building_id.
--      Callable per-simulation (for new sim bootstrap) or NULL (all sims).
--   2. Executes the function for all simulations (bulk backfill).
--   3. Refreshes all 4 materialized views in dependency order.
--
-- Semantic distinction preserved:
--   agents.current_building_id = transient location ("where is the agent now?")
--   building_agent_relations   = persistent assignment ("where does the agent work?")
--
-- The bootstrap sets them equal (agent starts where they work). Over time
-- the activity system may move current_building_id while the work assignment
-- remains stable. The MV correctly reads the assignment table, not the
-- transient location column.
--
-- Design: PostgreSQL-first (ADR-007). Idempotent via ON CONFLICT DO NOTHING
-- on UNIQUE(building_id, agent_id, relation_type).
-- ============================================================================


-- ============================================================================
-- 1. REUSABLE FUNCTION: fn_bootstrap_building_relations
-- ============================================================================
-- Creates 'works' relations from agents.current_building_id for agents that
-- have a building assignment but no corresponding relation record.
--
-- Parameters:
--   p_simulation_id  UUID or NULL
--     - UUID: bootstrap only agents in that simulation
--     - NULL: bootstrap ALL simulations (used by this migration)
--
-- Returns: number of new records inserted.
--
-- SECURITY INVOKER (ADR-006): backend calls with service_role for admin ops,
-- or user JWT for member-scoped calls. Never grant to anon/authenticated directly.

CREATE OR REPLACE FUNCTION fn_bootstrap_building_relations(
  p_simulation_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER;
BEGIN
  WITH to_insert AS (
    SELECT
      a.simulation_id,
      a.current_building_id AS building_id,
      a.id AS agent_id,
      'works'::text AS relation_type
    FROM agents a
    JOIN buildings b ON b.id = a.current_building_id AND b.deleted_at IS NULL
    WHERE a.deleted_at IS NULL
      AND a.current_building_id IS NOT NULL
      AND (p_simulation_id IS NULL OR a.simulation_id = p_simulation_id)
  )
  INSERT INTO building_agent_relations (simulation_id, building_id, agent_id, relation_type)
  SELECT simulation_id, building_id, agent_id, relation_type
  FROM to_insert
  ON CONFLICT (building_id, agent_id, relation_type) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION fn_bootstrap_building_relations IS
  'Populate building_agent_relations with "works" records from agents.current_building_id. '
  'Idempotent (ON CONFLICT DO NOTHING). Pass NULL to bootstrap all simulations, '
  'or a specific simulation_id for new simulation setup. '
  'Created by migration 160 to fix the gap left by migration 157.';


-- ============================================================================
-- 2. EXECUTE: Backfill all simulations
-- ============================================================================
-- This is the one-time bulk bootstrap. New simulations will call the function
-- via the Python bootstrap service (personality_extraction_service.py).

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT fn_bootstrap_building_relations(NULL) INTO v_count;
  RAISE NOTICE 'Migration 160: Inserted % building_agent_relations records', v_count;
END;
$$;


-- ============================================================================
-- 3. REFRESH all materialized views (dependency order)
-- ============================================================================
-- mv_building_readiness now has actual agent data → readiness > 0%
-- Cascading: zone_stability and simulation_health will reflect real values.

SELECT refresh_all_game_metrics();
