-- Atomic cycle advancement with phase transition — replaces the two-step
-- UPDATE pattern in cycle_resolution_service.py that is vulnerable to race
-- conditions between concurrent cycle resolutions.
--
-- Background: resolve_cycle() increments current_cycle with an optimistic lock,
-- then computes and applies phase transitions in a SEPARATE UPDATE without
-- locking on status.  A concurrent resolver can read stale status between
-- the two statements, producing lost phase transitions.
--
-- This RPC uses SELECT FOR UPDATE to serialize access, then performs cycle
-- increment + phase transition in a single UPDATE.
--
-- Pattern follows existing RPCs: fn_transition_mission_status,
-- fn_degrade_building, fn_grant_rp_single (migration 148).
--
-- ADR-006 compliance: SECURITY DEFINER, no GRANT to anon/authenticated.
-- ADR-007 compliance: atomic multi-column update for concurrent-access data.


-- ============================================================
-- fn_advance_epoch_cycle
-- Atomic cycle advancement with phase boundary detection.
-- Returns JSONB with new cycle, old/new status, phase metadata.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_advance_epoch_cycle(
    p_epoch_id UUID,
    p_expected_cycle INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_epoch RECORD;
    v_config JSONB;
    v_new_cycle INT;
    v_total_cycles INT;
    v_foundation_end INT;
    v_reckoning_start INT;
    v_new_status TEXT;
    v_old_status TEXT;
BEGIN
    -- Atomic: SELECT FOR UPDATE serializes concurrent resolvers
    SELECT id, current_cycle, status, config
    INTO v_epoch
    FROM game_epochs
    WHERE id = p_epoch_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error_code', 'epoch_not_found');
    END IF;

    -- Compare-and-swap: reject if cycle already advanced
    IF v_epoch.current_cycle != p_expected_cycle THEN
        RETURN jsonb_build_object('error_code', 'concurrent_resolution');
    END IF;

    v_config := COALESCE(v_epoch.config, '{}'::jsonb);
    v_new_cycle := v_epoch.current_cycle + 1;
    v_old_status := v_epoch.status;

    -- Total cycles (defaults match EpochConfig: duration_days=14, cycle_hours=8)
    v_total_cycles := (COALESCE((v_config->>'duration_days')::INT, 14) * 24)
                      / COALESCE((v_config->>'cycle_hours')::INT, 8);

    -- Phase boundary: foundation end
    -- Supports absolute "foundation_cycles" (current) and legacy "foundation_pct"
    IF v_config ? 'foundation_cycles' THEN
        v_foundation_end := (v_config->>'foundation_cycles')::INT;
    ELSE
        v_foundation_end := ROUND(
            v_total_cycles * COALESCE((v_config->>'foundation_pct')::INT, 10) / 100.0
        );
    END IF;

    -- Phase boundary: reckoning start
    -- Supports absolute "reckoning_cycles" (current) and legacy "reckoning_pct"
    IF v_config ? 'reckoning_cycles' THEN
        v_reckoning_start := v_total_cycles - (v_config->>'reckoning_cycles')::INT;
    ELSE
        v_reckoning_start := v_total_cycles - ROUND(
            v_total_cycles * COALESCE((v_config->>'reckoning_pct')::INT, 15) / 100.0
        );
    END IF;

    -- Phase transition logic (mirrors Python cycle_resolution_service.py)
    v_new_status := v_old_status;
    IF v_old_status = 'foundation' AND v_new_cycle > v_foundation_end THEN
        v_new_status := 'competition';
    ELSIF v_old_status = 'competition' AND v_new_cycle > v_reckoning_start THEN
        v_new_status := 'reckoning';
    ELSIF v_old_status = 'reckoning' AND v_new_cycle >= v_total_cycles THEN
        v_new_status := 'completed';
    END IF;

    -- Atomic update: cycle + status in ONE statement
    UPDATE game_epochs
    SET current_cycle = v_new_cycle,
        status = v_new_status
    WHERE id = p_epoch_id;

    RETURN jsonb_build_object(
        'new_cycle', v_new_cycle,
        'old_status', v_old_status,
        'new_status', v_new_status,
        'phase_changed', v_old_status != v_new_status,
        'total_cycles', v_total_cycles,
        'foundation_end', v_foundation_end,
        'reckoning_start', v_reckoning_start
    );
END;
$$;

COMMENT ON FUNCTION fn_advance_epoch_cycle IS
    'Atomic cycle advancement with phase transition detection. SELECT FOR UPDATE '
    'serializes concurrent resolvers. Supports both absolute (foundation_cycles) '
    'and legacy percentage (foundation_pct) config formats. Returns JSONB with '
    'new_cycle, old/new status, phase_changed flag, and boundary metadata.';


-- ============================================================
-- Feature flag for gradual RPC activation
-- ============================================================
INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES (
    'use_atomic_cycle_advance',
    '"false"',
    'When true, cycle resolution uses fn_advance_epoch_cycle RPC for atomic cycle+phase advancement instead of two separate UPDATEs. Toggle for safe rollback.'
)
ON CONFLICT (setting_key) DO NOTHING;


-- ============================================================
-- Grants: callable by service_role only (default).
-- No additional GRANT needed — service_role owns these via
-- SECURITY DEFINER context.
-- Do NOT grant to anon or authenticated (ADR-006 compliance).
-- ============================================================
