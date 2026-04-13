-- =============================================================================
-- Migration 208: Add auto-resolve event types to battle_log
-- =============================================================================
-- The epoch auto-resolve system (migration 204) introduced pass-cycle,
-- AFK tracking, and cycle resolution events. The CHECK constraint on
-- battle_log.event_type was missing these types.
-- =============================================================================

ALTER TABLE battle_log DROP CONSTRAINT IF EXISTS battle_log_event_type_check;
ALTER TABLE battle_log ADD CONSTRAINT battle_log_event_type_check CHECK (
  event_type IN (
    'operative_deployed', 'mission_success', 'mission_failed',
    'detected', 'captured', 'sabotage', 'propaganda',
    'assassination', 'infiltration',
    'alliance_formed', 'alliance_dissolved', 'betrayal',
    'phase_change', 'epoch_start', 'epoch_end',
    'rp_allocated', 'building_damaged', 'agent_wounded',
    'counter_intel', 'intel_report', 'zone_fortified',
    'alliance_proposal', 'alliance_proposal_accepted',
    'alliance_proposal_rejected', 'alliance_tension_increase',
    'alliance_dissolved_tension', 'alliance_upkeep',
    'player_passed', 'cycle_resolved', 'cycle_auto_resolved',
    'player_afk', 'player_afk_penalty', 'player_afk_ai_takeover'
  )
);
