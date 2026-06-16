-- ============================================================
-- Migration 261: fn_recall_operative — atomic CAS-flip + conditional refund
-- (fix ADR-007 double-refund race in OperativeMissionService.recall)
-- ============================================================
--
-- recall() granted the 50% RP refund (EpochService.grant_rp) BEFORE flipping the
-- mission status, and the status UPDATE filtered only on id — no compare-and-swap.
-- Two concurrent recall() calls (double-click / retry) both read status='active',
-- both pass the in-('deploying','active') guard, and both grant the refund: the
-- player is refunded twice. grant_rp is itself atomic, but the eligibility
-- decision was ungated, so issuing it twice defeats the atomicity.
--
-- This RPC makes the flip the compare-and-swap gate and the refund conditional on
-- the winning transition, in one transaction:
--   * UPDATE ... WHERE status IN ('deploying','active') flips at most one of N
--     concurrent recalls (the row lock serialises them; the loser sees the row
--     already 'returning' and NOT FOUND → {error:'already_recalled'}).
--   * The refund (fn_grant_rp_single, cap-aware) runs only after a successful
--     flip, in the SAME transaction — so it cannot be issued twice and cannot be
--     lost between a successful flip and a separate grant statement.
--
-- This mirrors fn_deploy_operative_atomic (migration 260), completing the
-- deploy/recall pair as atomic service_role-only RPCs.
--
-- SECDEF hygiene (ADR-006 / migrations 257+258): a fresh CREATE inherits a PUBLIC
-- EXECUTE grant and on Supabase pg_default_acl can direct-grant anon/authenticated,
-- so the function is explicitly revoked from PUBLIC/anon/authenticated and granted
-- only to service_role (the service calls it via the admin client).
-- ============================================================

CREATE FUNCTION public.fn_recall_operative(
    p_mission_id           UUID,
    p_source_simulation_id UUID,
    p_epoch_id             UUID,
    p_refund_rp            INT,
    p_rp_cap               INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mission public.operative_missions;
BEGIN
    -- Compare-and-swap: only the first concurrent recall transitions the row.
    UPDATE public.operative_missions
       SET status = 'returning',
           resolved_at = NOW()
     WHERE id = p_mission_id
       AND status IN ('deploying', 'active')
    RETURNING * INTO v_mission;

    IF NOT FOUND THEN
        -- A concurrent recall already flipped it (or it resolved) — no refund.
        RETURN jsonb_build_object('error', 'already_recalled');
    END IF;

    -- Refund only on the winning transition, in the same transaction so it is
    -- issued exactly once. fn_grant_rp_single enforces the rp_cap via LEAST().
    IF p_refund_rp > 0 THEN
        PERFORM fn_grant_rp_single(p_epoch_id, p_source_simulation_id, p_refund_rp, p_rp_cap);
    END IF;

    RETURN jsonb_build_object(
        'mission', to_jsonb(v_mission),
        'refunded', GREATEST(p_refund_rp, 0)
    );
END;
$$;

COMMENT ON FUNCTION public.fn_recall_operative(UUID, UUID, UUID, INT, INT) IS
    'Atomic operative recall: CAS-flips deploying/active -> returning and refunds '
    '(cap-aware, conditional on the winning transition) in one transaction. Returns '
    '{mission,refunded} or {"error":"already_recalled"} when a concurrent recall won. '
    'Service-role only (called via the admin client from operative_mission_service.recall).';

-- Lock to service_role (never anon/authenticated). On Supabase pg_default_acl can
-- direct-grant EXECUTE to anon/authenticated for new functions, so revoke
-- explicitly per the SECDEF hygiene of migrations 257/258.
REVOKE EXECUTE ON FUNCTION public.fn_recall_operative(UUID, UUID, UUID, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_recall_operative(UUID, UUID, UUID, INT, INT) TO service_role;
