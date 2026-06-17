-- ============================================================
-- Migration 259: atomic event -> narrative-arc attachment
-- (fix ADR-007 lost-update race in event_service._post_event_mutation)
-- ============================================================
--
-- _post_event_mutation attached newly-created events to matching narrative arcs
-- via a Python read-append-write on narrative_arcs.source_event_ids (UUID[]):
-- it read the arc's source_event_ids snapshot once, appended one id in Python,
-- and wrote the WHOLE array back. Two near-simultaneous event mutations (4
-- user-facing endpoints + the resonance pipeline all call _post_event_mutation)
-- both read the same snapshot, each appended only its own event id, and the
-- second full-array UPDATE clobbered the first -> the first event was silently
-- dropped from the arc. Classic lost-update with no compare-and-swap.
--
-- fn_arc_attach_event performs the dedup-append in ONE statement, so concurrent
-- callers serialize on the row and neither attachment is lost; the
-- `NOT (... = ANY(...))` guard makes the dedup race-free too (the old Python
-- `not in existing_ids` check raced against the snapshot).
--
-- SECURITY INVOKER (default): this is a heartbeat/system operation invoked via
-- the service-role admin client. Migration 129's "Service role full access
-- arcs" policy already grants service_role the write; authenticated/anon have
-- only GRANT SELECT on narrative_arcs, so the previous user-client UPDATE
-- silently failed under RLS for every non-admin event mutation -- routing the
-- call through the admin client (event_service) also un-breaks that.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_arc_attach_event(
    p_arc_id UUID,
    p_event_id UUID
) RETURNS BOOLEAN
LANGUAGE sql AS $$
    UPDATE narrative_arcs
       SET source_event_ids = array_append(source_event_ids, p_event_id)
     WHERE id = p_arc_id
       AND NOT (p_event_id = ANY(source_event_ids))
    RETURNING true;
$$;

COMMENT ON FUNCTION fn_arc_attach_event(uuid, uuid) IS
    'Atomic dedup-append of an event id onto narrative_arcs.source_event_ids '
    '(UUID[]). Replaces the racy Python read-append-write in '
    'event_service._post_event_mutation. Service-role only (system heartbeat op).';

-- Keep the RPC surface minimal: service-role only, never anon/authenticated.
-- (On Supabase, pg_default_acl can grant EXECUTE directly to anon/authenticated
-- for new functions, so revoke explicitly per the SECDEF hygiene of 257/258.)
REVOKE EXECUTE ON FUNCTION fn_arc_attach_event(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_arc_attach_event(uuid, uuid) TO service_role;
