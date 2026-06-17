-- ============================================================
-- Migration 260: refresh fn_deploy_operative_atomic + wire it up
-- (fix ADR-007 RP-loss race in OperativeMissionService.deploy)
-- ============================================================
--
-- fn_deploy_operative_atomic (migration 214) was built to replace the separate
-- RP-spend + mission-insert sequence in OperativeMissionService.deploy, but was
-- NEVER called (grep confirms zero callers). So deploy still spent RP early
-- (EpochService.spend_rp) and inserted the mission later in two statements with
-- reads (resonance eligibility, success-probability) in between: any failure
-- between them debited RP with no mission created and no refund (ADR-007).
--
-- The RPC was also STALE. It predates the resonance_op column (migration 216),
-- never set deployed_cycle (added migration 090), and hardcoded
-- status='deploying' -- but the service sets status='active' for 0-deploy-cycle
-- operatives (spy/guardian) and writes resonance_op + deployed_cycle. Wiring it
-- up as-is would have silently dropped those three values. This migration
-- refreshes the RPC to insert all three; the service is then rewired (separate
-- commit) to do all reads/computation first and call this RPC once -- spend +
-- insert in one transaction, so any failure rolls back the whole thing.
--
-- Adding parameters changes the function identity, so the old 12-arg signature
-- is dropped (it has zero callers) and the new 15-arg signature is explicitly
-- locked to service_role -- the authenticated/anon revokes in migrations 257/258
-- only covered the old signature, and a fresh CREATE would otherwise inherit a
-- PUBLIC EXECUTE grant (SECDEF exposure, the exact class 257/258 closed).
-- ============================================================

DROP FUNCTION IF EXISTS public.fn_deploy_operative_atomic(
    uuid, uuid, uuid, text, integer, uuid, uuid, uuid, text, uuid, double precision, timestamp with time zone
);

CREATE FUNCTION public.fn_deploy_operative_atomic(
    p_epoch_id             UUID,
    p_simulation_id        UUID,
    p_agent_id             UUID,
    p_operative_type       TEXT,
    p_cost_rp              INT,
    p_target_simulation_id UUID DEFAULT NULL,
    p_target_zone_id       UUID DEFAULT NULL,
    p_target_entity_id     UUID DEFAULT NULL,
    p_target_entity_type   TEXT DEFAULT NULL,
    p_embassy_id           UUID DEFAULT NULL,
    p_success_probability  FLOAT DEFAULT NULL,
    p_resolves_at          TIMESTAMPTZ DEFAULT NULL,
    p_status               TEXT DEFAULT 'deploying',
    p_deployed_cycle       INT DEFAULT NULL,
    p_resonance_op         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_participant_id UUID;
    v_new_rp INT;
    v_mission_id UUID;
BEGIN
    -- Atomic RP deduction (the WHERE guard validates sufficient balance)
    UPDATE public.epoch_participants
    SET current_rp = current_rp - p_cost_rp
    WHERE epoch_id = p_epoch_id
      AND simulation_id = p_simulation_id
      AND current_rp >= p_cost_rp
    RETURNING id, current_rp INTO v_participant_id, v_new_rp;

    IF v_participant_id IS NULL THEN
        RETURN jsonb_build_object('error', 'insufficient_rp');
    END IF;

    -- Insert mission in the SAME transaction (status/deployed_cycle/resonance_op
    -- now included). If this raises (e.g. a unique-mission constraint), the RP
    -- deduction above rolls back with it -- no orphaned debit.
    INSERT INTO public.operative_missions (
        epoch_id, agent_id, operative_type, source_simulation_id,
        target_simulation_id, target_zone_id, target_entity_id,
        target_entity_type, embassy_id, cost_rp, success_probability,
        status, deployed_at, resolves_at, deployed_cycle, resonance_op
    ) VALUES (
        p_epoch_id, p_agent_id, p_operative_type, p_simulation_id,
        p_target_simulation_id, p_target_zone_id, p_target_entity_id,
        p_target_entity_type, p_embassy_id, p_cost_rp, p_success_probability,
        COALESCE(p_status, 'deploying'), NOW(), p_resolves_at, p_deployed_cycle, p_resonance_op
    )
    RETURNING id INTO v_mission_id;

    RETURN jsonb_build_object(
        'mission_id', v_mission_id,
        'new_rp', v_new_rp,
        'participant_id', v_participant_id
    );
END;
$$;

COMMENT ON FUNCTION public.fn_deploy_operative_atomic(UUID, UUID, UUID, TEXT, INT, UUID, UUID, UUID, TEXT, UUID, FLOAT, TIMESTAMPTZ, TEXT, INT, TEXT) IS
    'Atomic operative deployment: validates RP, deducts, inserts mission '
    '(status/deployed_cycle/resonance_op included) in one transaction. Returns '
    '{mission_id,new_rp,participant_id} or {"error":"insufficient_rp"}. '
    'Service-role only (called via the admin client from operative_mission_service.deploy).';

-- Lock the new signature to service_role (never anon/authenticated). On Supabase
-- pg_default_acl can direct-grant EXECUTE to anon/authenticated for new
-- functions, so revoke explicitly per the SECDEF hygiene of 257/258.
REVOKE EXECUTE ON FUNCTION public.fn_deploy_operative_atomic(UUID, UUID, UUID, TEXT, INT, UUID, UUID, UUID, TEXT, UUID, FLOAT, TIMESTAMPTZ, TEXT, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_deploy_operative_atomic(UUID, UUID, UUID, TEXT, INT, UUID, UUID, UUID, TEXT, UUID, FLOAT, TIMESTAMPTZ, TEXT, INT, TEXT) TO service_role;
