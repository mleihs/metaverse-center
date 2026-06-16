-- ============================================================
-- Migration 263: fold RP grant + flag reset + mission-timer advance INTO
-- fn_advance_epoch_cycle, making the WHOLE cycle resolution one CAS-guarded
-- transaction. Retires the racy legacy path + the use_atomic_cycle_advance flag.
-- (fix ADR-007 double-grant race in CycleResolutionService.resolve_cycle)
-- ============================================================
--
-- resolve_cycle granted RP (fn_batch_grant_rp), reset the cycle_ready/
-- has_acted_this_cycle flags, and advanced mission timers BEFORE the
-- compare-and-swap that guards the cycle increment (migration 167's
-- fn_advance_epoch_cycle only locked the increment + phase transition). So two
-- concurrent resolve_cycle calls both granted rp_per_cycle to every participant
-- (and both advanced mission timers) before either reached the CAS: the loser
-- then got a 409, but the RP was already double-credited and never rolled back.
-- The flag (use_atomic_cycle_advance, default false) merely chose between two
-- variants of the SAME pre-CAS-grant bug -- it did not fix it.
--
-- This refresh moves grant + flag-reset + mission-timer advance INSIDE the RPC,
-- AFTER the SELECT FOR UPDATE + compare-and-swap, so the entire cycle resolution
-- (grant + reset + timers + increment + phase transition) commits in one
-- transaction. A concurrent resolver that loses the CAS returns
-- 'concurrent_resolution' having mutated nothing -- no partial double-grant.
--
-- RP amount + cap + cycle_hours are read from the epoch config (real epochs
-- always carry a full EpochConfig); the COALESCE defaults mirror EpochConfig
-- (rp_per_cycle=12, rp_cap=40, cycle_hours=8 -- matching the duration_days=14 /
-- cycle_hours=8 defaults this function already used for phase logic). The
-- foundation bonus uses integer arithmetic (v_rp*3)/2, exactly matching Python's
-- int(rp_per_cycle * 1.5).
--
-- The grant + timer reuse the existing SECURITY DEFINER functions via PERFORM
-- (fn_batch_grant_rp migration 126; fn_advance_mission_timers migration 214) --
-- both owned by the same role, so the SECDEF context has EXECUTE on them.
--
-- CREATE OR REPLACE keeps the function's identity (same signature) and therefore
-- its ACL: the service_role grant + the anon/authenticated revokes from
-- migrations 257/258 are preserved. The REVOKE/GRANT below re-asserts that
-- intended state explicitly (idempotent; SECDEF hygiene per ADR-006).
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_advance_epoch_cycle(
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
    v_cycle_hours INT;
    v_rp_per_cycle INT;
    v_rp_cap INT;
    v_rp_amount INT;
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

    -- Compare-and-swap: reject if cycle already advanced. Everything below this
    -- guard (grant, flag reset, timer advance, increment, phase) runs ONLY for
    -- the winning resolver, exactly once.
    IF v_epoch.current_cycle != p_expected_cycle THEN
        RETURN jsonb_build_object('error_code', 'concurrent_resolution');
    END IF;

    v_config := COALESCE(v_epoch.config, '{}'::jsonb);
    v_new_cycle := v_epoch.current_cycle + 1;
    v_old_status := v_epoch.status;
    v_cycle_hours := COALESCE((v_config->>'cycle_hours')::INT, 8);

    -- Total cycles (defaults match EpochConfig: duration_days=14, cycle_hours=8)
    v_total_cycles := (COALESCE((v_config->>'duration_days')::INT, 14) * 24)
                      / v_cycle_hours;

    -- Phase boundary: foundation end (absolute "foundation_cycles" or legacy pct)
    IF v_config ? 'foundation_cycles' THEN
        v_foundation_end := (v_config->>'foundation_cycles')::INT;
    ELSE
        v_foundation_end := ROUND(
            v_total_cycles * COALESCE((v_config->>'foundation_pct')::INT, 10) / 100.0
        );
    END IF;

    -- Phase boundary: reckoning start (absolute "reckoning_cycles" or legacy pct)
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

    -- ── Once-per-cycle mutations (now CAS-guarded, was racy pre-CAS Python) ──
    -- RP grant: rp_per_cycle from config, +50% foundation bonus, cap-enforced.
    -- (v_rp_amount*3)/2 == Python int(rp_per_cycle * 1.5) for positive ints.
    v_rp_per_cycle := COALESCE((v_config->>'rp_per_cycle')::INT, 12);
    v_rp_cap := COALESCE((v_config->>'rp_cap')::INT, 40);
    IF v_old_status = 'foundation' THEN
        v_rp_amount := (v_rp_per_cycle * 3) / 2;
    ELSE
        v_rp_amount := v_rp_per_cycle;
    END IF;

    PERFORM fn_batch_grant_rp(p_epoch_id, v_rp_amount, v_rp_cap);

    -- Reset cycle_ready + has_acted_this_cycle for the new cycle.
    UPDATE epoch_participants
    SET cycle_ready = false,
        has_acted_this_cycle = false
    WHERE epoch_id = p_epoch_id;

    -- Advance mission timers by one cycle interval (migration 214).
    PERFORM fn_advance_mission_timers(p_epoch_id, v_cycle_hours);

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
        'reckoning_start', v_reckoning_start,
        'rp_granted', v_rp_amount
    );
END;
$$;

COMMENT ON FUNCTION public.fn_advance_epoch_cycle(UUID, INT) IS
    'Atomic cycle resolution: SELECT FOR UPDATE + compare-and-swap, then RP grant '
    '(fn_batch_grant_rp, +50% foundation bonus, cap-enforced) + cycle_ready/'
    'has_acted_this_cycle reset + mission-timer advance (fn_advance_mission_timers) '
    '+ cycle increment + phase transition -- all in one transaction. A loser of '
    'the CAS returns {error_code:concurrent_resolution} having mutated nothing. '
    'Service-role only.';

-- Re-assert the intended ACL explicitly (CREATE OR REPLACE preserves it, but be
-- explicit per the SECDEF hygiene of migrations 257/258).
REVOKE EXECUTE ON FUNCTION public.fn_advance_epoch_cycle(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_advance_epoch_cycle(UUID, INT) TO service_role;

-- Retire the feature flag: the legacy non-atomic path is deleted, so the toggle
-- is dead. Remove the platform_settings row (seeded by migration 167).
DELETE FROM public.platform_settings WHERE setting_key = 'use_atomic_cycle_advance';
