-- ============================================================================
-- Migration 196: Drop dead PL/pgSQL objects
-- ============================================================================
-- Audit: Full codebase cross-reference (backend .rpc() calls, SQL function
-- bodies, RLS policies, trigger definitions, view dependencies, frontend).
--
-- D1: active_simulations VIEW
--     Created migration 011, refreshed in 110/123/129.
--     Zero backend queries (.from_), zero SQL references (no view/function/
--     policy depends on it). Only CREATE OR REPLACE refreshes exist.
--
-- D2: fn_count_moodlet_stacking(UUID, TEXT)
--     Created migration 145. Superseded by fn_add_moodlet_capped (migration
--     162) which does atomic check-and-insert inline. Zero .rpc() calls.
--
-- D3-D5: refresh_building_readiness/zone_stability/embassy_effectiveness
--     Created migration 031 as granular MV refresh wrappers. Never called
--     from backend. refresh_all_game_metrics() does NOT call these -- it
--     directly executes REFRESH MATERIALIZED VIEW commands.
-- ============================================================================

-- D1: View never queried from application code
DROP VIEW IF EXISTS active_simulations;

-- D2: Superseded by fn_add_moodlet_capped (migration 162)
DROP FUNCTION IF EXISTS fn_count_moodlet_stacking(UUID, TEXT);

-- D3-D5: Redundant wrappers (refresh_all_game_metrics is the only caller)
DROP FUNCTION IF EXISTS refresh_building_readiness();
DROP FUNCTION IF EXISTS refresh_zone_stability();
DROP FUNCTION IF EXISTS refresh_embassy_effectiveness();
