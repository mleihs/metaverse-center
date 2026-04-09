-- Migration 186: Add 'resonance_mood' to heartbeat_entries entry_type CHECK constraint.
--
-- Phase 3b (resonance → agent mood) generates entries with type 'resonance_mood'
-- but this value was missing from the original CHECK constraint, causing:
--   APIError: new row violates check constraint "heartbeat_entries_entry_type_check"
--
-- Sentry issue: METAVERSE_CENTER-27 (10 events, all tick #52, escalating priority).
-- Root cause: The resonance_mood phase was added after the CHECK constraint was defined.

ALTER TABLE heartbeat_entries DROP CONSTRAINT heartbeat_entries_entry_type_check;

ALTER TABLE heartbeat_entries ADD CONSTRAINT heartbeat_entries_entry_type_check
  CHECK (entry_type = ANY (ARRAY[
    'zone_shift', 'event_aging', 'event_escalation', 'event_resolution',
    'scar_tissue', 'resonance_pressure', 'resonance_mood',
    'cascade_spawn', 'bureau_response',
    'attunement_deepen', 'anchor_strengthen', 'convergence',
    'positive_event', 'narrative_arc', 'system_note',
    'agent_crisis', 'relationship_shift', 'social_event',
    'autonomous_event', 'ambient_weather'
  ]));
