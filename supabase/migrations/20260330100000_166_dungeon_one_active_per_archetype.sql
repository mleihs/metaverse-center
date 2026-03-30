-- Migration 166: Fix dungeon active run constraint to be per-archetype
--
-- Previously: one active run per simulation (blocked concurrent different-archetype runs)
-- Now: one active run per simulation per archetype (Shadow and Tower can run simultaneously)
--
-- Ref: BUG-06 in docs/analysis/dungeon-playtest-report-2026-03-29.md

DROP INDEX IF EXISTS idx_dungeon_runs_one_active_per_sim;

CREATE UNIQUE INDEX idx_dungeon_runs_one_active_per_sim
    ON resonance_dungeon_runs(simulation_id, archetype)
    WHERE status IN ('active', 'combat', 'exploring', 'distributing');

COMMENT ON INDEX idx_dungeon_runs_one_active_per_sim IS
    'Enforces at most one active dungeon run per simulation per archetype. '
    'Different archetypes can run concurrently within the same simulation.';
