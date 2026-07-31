-- ============================================================
-- Migration 271: collaborative_anchors — atomic join/leave RPCs
--                + editor INSERT policy
-- (Deep-Audit 2026-07-12, P1-2)
-- ============================================================
--
-- Two defects, one stroke:
--
-- 1. RLS gap: migration 129 gave collaborative_anchors only public-read
--    + service_role policies. Its siblings in the very same migration
--    (bureau_responses, substrate_attunements) got editor write policies;
--    collaborative_anchors did not. The router endpoints
--    (POST /api/v1/anchors[/{id}/join|/leave]) are require_role("editor")
--    + get_effective_supabase, i.e. a user-JWT client for every non-admin:
--    the join/leave UPDATE matched 0 rows -> 500 "Failed to join anchor.",
--    the create INSERT failed with 42501. Only auto-elevated platform
--    admins could ever use the feature. Same class as the migration-259
--    narrative_arcs discovery.
--
-- 2. Lost-update race (ADR-007): join_anchor/leave_anchor read the
--    anchor_simulation_ids UUID[] snapshot, appended/removed one entry in
--    Python and wrote the WHOLE array back — no compare-and-swap.
--    Concurrent joins lose participants; a leave racing a join can
--    wrongly dissolve (or resurrect) an anchor.
--
-- Fix, following the fn_arc_attach_event precedent (migration 259):
-- one atomic UPDATE per operation, membership guard in the WHERE clause,
-- so concurrent callers serialize on the row and the dedup/dissolve
-- decisions are race-free. The functions classify their failure mode
-- ('not_found' / 'not_accepting' / 'already_member' / 'not_member') from
-- the post-UPDATE state so the service can keep its distinct HTTP errors.
--
-- SECURITY INVOKER (default): invoked exclusively via the backend
-- service-role client after the router's require_role("editor") gate —
-- migration 129's "Service role full access anchors" policy carries the
-- write. EXECUTE is revoked from anon/authenticated per the SECDEF/RPC
-- hygiene of migrations 257/258 (pg_default_acl would otherwise grant it).
--
-- create_anchor stays on the user-JWT client (normal CRUD, per contract):
-- it gets the editor INSERT policy migration 129 forgot, locked to the
-- caller's own identity and a single-seed participant array.
-- ============================================================

-- ── 1. Atomic join ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_anchor_join(
    p_anchor_id UUID,
    p_sim_id UUID
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    v_row collaborative_anchors%ROWTYPE;
BEGIN
    UPDATE collaborative_anchors
       SET anchor_simulation_ids = array_append(anchor_simulation_ids, p_sim_id),
           updated_at = now()
     WHERE id = p_anchor_id
       AND status IN ('forming', 'active')
       AND NOT (p_sim_id = ANY(anchor_simulation_ids))
    RETURNING * INTO v_row;

    IF FOUND THEN
        RETURN jsonb_build_object('outcome', 'joined', 'anchor', to_jsonb(v_row));
    END IF;

    SELECT * INTO v_row FROM collaborative_anchors WHERE id = p_anchor_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('outcome', 'not_found');
    ELSIF v_row.status NOT IN ('forming', 'active') THEN
        RETURN jsonb_build_object('outcome', 'not_accepting');
    ELSE
        RETURN jsonb_build_object('outcome', 'already_member');
    END IF;
END;
$$;

COMMENT ON FUNCTION fn_anchor_join(uuid, uuid) IS
    'Atomic dedup-append of a simulation onto collaborative_anchors.'
    'anchor_simulation_ids (UUID[]) with status guard. Replaces the racy '
    'Python read-append-write in AnchorService.join_anchor. Service-role '
    'only; router validates editor role first.';

-- ── 2. Atomic leave (dissolves on last participant) ─────────

CREATE OR REPLACE FUNCTION fn_anchor_leave(
    p_anchor_id UUID,
    p_sim_id UUID
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    v_row collaborative_anchors%ROWTYPE;
BEGIN
    UPDATE collaborative_anchors
       SET anchor_simulation_ids = array_remove(anchor_simulation_ids, p_sim_id),
           status = CASE
                        WHEN array_remove(anchor_simulation_ids, p_sim_id) = '{}'::uuid[]
                            THEN 'dissolved'
                        ELSE status
                    END,
           updated_at = now()
     WHERE id = p_anchor_id
       AND p_sim_id = ANY(anchor_simulation_ids)
    RETURNING * INTO v_row;

    IF FOUND THEN
        RETURN jsonb_build_object('outcome', 'left', 'anchor', to_jsonb(v_row));
    END IF;

    IF EXISTS (SELECT 1 FROM collaborative_anchors WHERE id = p_anchor_id) THEN
        RETURN jsonb_build_object('outcome', 'not_member');
    END IF;
    RETURN jsonb_build_object('outcome', 'not_found');
END;
$$;

COMMENT ON FUNCTION fn_anchor_leave(uuid, uuid) IS
    'Atomic removal of a simulation from collaborative_anchors.'
    'anchor_simulation_ids (UUID[]); dissolves the anchor in the same '
    'statement when the last participant leaves. Replaces the racy Python '
    'read-remove-write in AnchorService.leave_anchor. Service-role only; '
    'router validates editor role first.';

-- ── 3. RPC surface: service_role only ───────────────────────
-- (On Supabase, pg_default_acl grants EXECUTE directly to anon/
-- authenticated for new functions — revoke explicitly, cf. 257/258.)

REVOKE EXECUTE ON FUNCTION fn_anchor_join(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_anchor_leave(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_anchor_join(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION fn_anchor_leave(uuid, uuid) TO service_role;

-- ── 4. The editor INSERT policy migration 129 forgot ────────
-- Locked down: the caller can only create an anchor as themselves,
-- for a simulation they edit, seeded with exactly that simulation.
-- ((SELECT ...)-wrapped per the initPlan rule, migration 183.)

CREATE POLICY "Editor insert collaborative anchors"
  ON collaborative_anchors FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by_user_id = (SELECT auth.uid())
    AND (SELECT user_has_simulation_role(created_by_simulation_id, 'editor'))
    AND anchor_simulation_ids = ARRAY[created_by_simulation_id]
  );

GRANT INSERT ON collaborative_anchors TO authenticated;
