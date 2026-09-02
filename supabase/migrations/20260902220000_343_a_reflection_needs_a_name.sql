-- 343 — Die Verdichtung braucht einen Namen, den die Chronik kennt
--
-- Phase 9.7 (`AgentMemoryService.reflect_due_agents`) schreibt seit heute
-- Chronikzeilen vom Typ `memory_reflection`. Der CHECK auf
-- `heartbeat_entries.entry_type` kennt ihn nicht — jede solche Zeile wuerde
-- abgewiesen.
--
-- ⚠ Das ist DIESELBE Luecke wie bei `bond_whisper` (Migration 285): der Code
-- gab einen neuen Typ aus, die Deklaration und der CHECK lernten ihn nicht.
-- Damals fiel es erst auf, als jemand die Chronik las. Diesmal hat
-- `test_every_emitted_entry_type_is_declared` es beim ersten Lauf gefangen —
-- das Tor, das aus dem damaligen Vorfall entstanden ist, hat gehalten.
--
-- Der CHECK muss der Deklaration in `heartbeat_entry_builder.py` EXAKT
-- entsprechen; der Test bindet beide aneinander.

BEGIN;

ALTER TABLE heartbeat_entries DROP CONSTRAINT IF EXISTS heartbeat_entries_entry_type_check;

ALTER TABLE heartbeat_entries ADD CONSTRAINT heartbeat_entries_entry_type_check
  CHECK (entry_type = ANY (ARRAY[
    'zone_shift', 'event_aging', 'event_escalation', 'event_resolution',
    'scar_tissue', 'resonance_pressure', 'resonance_mood', 'cascade_spawn',
    'bureau_response', 'attunement_deepen', 'anchor_strengthen', 'convergence',
    'positive_event', 'narrative_arc', 'system_note', 'agent_crisis',
    'relationship_shift', 'social_event', 'autonomous_event', 'ambient_weather',
    'bond_whisper',
    'memory_reflection'
  ]::TEXT[]));

COMMIT;
