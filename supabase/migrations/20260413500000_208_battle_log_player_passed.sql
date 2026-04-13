-- =============================================================================
-- Migration 208: Add player_passed to battle_log event types
-- =============================================================================
-- The epoch auto-resolve system (migration 204) introduced pass-cycle
-- functionality. The battle_log_service logs this as 'player_passed', but
-- the CHECK constraint on battle_log.event_type didn't include it.
-- Also adds 'cycle_resolved' for cycle resolution events.
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
    'player_passed', 'cycle_resolved'
  )
);
