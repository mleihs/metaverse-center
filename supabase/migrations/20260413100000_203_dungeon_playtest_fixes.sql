-- Migration 203: Dungeon playtest fixes (2026-04-13)
--
-- P1-03: Add missing event types to resonance_dungeon_events CHECK constraint.
--   threshold_choice — logged by _handle_threshold_choice() in dungeon_movement_service.py
--   combat_stalemate — logged by _handle_combat_stalemate() in dungeon_combat_service.py
--   Without these, event inserts silently fail on CHECK violation.
--
-- P1-04: Add missing context JSONB column to achievement_progress.
--   fn_increment_progress_unique() (migration 194, hardened in 197) references
--   achievement_progress.context for deduplication tracking (seen IDs).
--   Column was never created — migration 190 defines the table without it.
--
-- P2-04: Add min_depth column to dungeon_banter table.
--   Enables depth-based filtering for boss-only banter entries.
--   The Pretender banter (ob_21, ob_28) must only fire in boss rooms (depth 6).

-- ═══════════════════════════════════════════════════════════════════════════
-- P1-03: Expand event_type CHECK constraint
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE resonance_dungeon_events DROP CONSTRAINT IF EXISTS resonance_dungeon_events_event_type_check;
ALTER TABLE resonance_dungeon_events ADD CONSTRAINT resonance_dungeon_events_event_type_check
    CHECK (event_type IN (
        'room_entered', 'combat_started', 'combat_resolved',
        'skill_check', 'encounter_choice', 'loot_found',
        'agent_stressed', 'agent_afflicted', 'agent_virtue',
        'agent_wounded', 'party_wipe', 'boss_defeated',
        'dungeon_completed', 'dungeon_abandoned',
        'banter', 'discovery',
        'threshold_choice', 'combat_stalemate'
    ));

-- ═══════════════════════════════════════════════════════════════════════════
-- P1-04: Add context column to achievement_progress
-- ═══════════════════════════════════════════════════════════════════════════
-- fn_increment_progress_unique() stores seen item IDs in context->'seen'.
-- Without this column, the function fails with "column does not exist".

ALTER TABLE achievement_progress ADD COLUMN IF NOT EXISTS context JSONB NOT NULL DEFAULT '{}';

-- ═══════════════════════════════════════════════════════════════════════════
-- P2-04: Add min_depth to dungeon_banter + update boss-only entries
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE dungeon_banter ADD COLUMN IF NOT EXISTS min_depth INT NOT NULL DEFAULT 0;

-- Restrict The Pretender banter to boss rooms (depth 6)
UPDATE dungeon_banter SET min_depth = 6 WHERE id IN ('ob_21', 'ob_28');
