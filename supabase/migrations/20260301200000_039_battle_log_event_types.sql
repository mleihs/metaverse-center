-- Migration 039: Expand battle_log event_type CHECK constraint
--
-- The original CHECK constraint (migration 032) is missing event types that
-- operative_service.py and battle_log_service.py write:
--   - intel_report (spy intel reveals)
--   - phase_change (epoch phase transitions)
--   - rp_allocated (cycle RP grants)
--   - alliance_formed (team creation)
--   - betrayal (intra-alliance attacks)
--
-- Without this fix, inserts with these types silently fail (caught by
-- try/except in battle_log_service.py).

ALTER TABLE public.battle_log DROP CONSTRAINT battle_log_event_type_check;

ALTER TABLE public.battle_log ADD CONSTRAINT battle_log_event_type_check
    CHECK (event_type IN (
        'operative_deployed', 'mission_success', 'mission_failed',
        'detected', 'captured', 'sabotage', 'propaganda', 'assassination',
        'infiltration', 'alliance_formed', 'alliance_dissolved', 'betrayal',
        'phase_change', 'epoch_start', 'epoch_end', 'rp_allocated',
        'building_damaged', 'agent_wounded', 'counter_intel',
        'intel_report'
    ));
