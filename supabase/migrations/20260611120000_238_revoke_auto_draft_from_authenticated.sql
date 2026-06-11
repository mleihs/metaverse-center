-- Migration 238: Revoke fn_auto_draft_participants from authenticated (ADR-006)
--
-- Audit finding S1 (2026-06-11): fn_auto_draft_participants is SECURITY DEFINER
-- with NO internal ownership check, yet was executable by any authenticated
-- user (granted in migration 128, grant re-affirmed by the CREATE OR REPLACE
-- + GRANT in migration 197). A logged-in user could call the RPC directly via
-- the Supabase client with an arbitrary epoch_id and an attacker-chosen
-- p_max_agents (e.g. 1 instead of the configured 6) and pre-empt the draft
-- for every undrafted participant of a foreign epoch — irreversibly, because
-- the function only touches rows WHERE drafted_agent_ids IS NULL.
--
-- Note: backend/tests/integration/test_auth_boundaries.py documents an
-- "epoch creator check" for this function, but no migration ever implemented
-- one — the intent existed only in the (skipped) test docstring.
--
-- The only legitimate callers are backend lifecycle paths
-- (EpochLifecycleService.start_epoch via routers/epochs.py, and
-- academy_service auto-start) and both already pass the service_role client,
-- so revoking authenticated breaks nothing.
--
-- Sister fix: migration 213 (M10) applied this exact revoke to
-- fn_compute_cycle_scores but missed this function.
--
-- Documented ADR-006 exceptions (intentionally KEPT for authenticated):
--   - toggle_message_reaction / get_message_reactions (180/197): SECURITY
--     DEFINER but internally scoped to auth.uid() — a user can only ever
--     toggle/read their own reaction rows.
--   - fn_get_ward_strength (191): STABLE read-only aggregate over publicly
--     readable simulation data (public-first architecture).
--   - fn_update_user_byok_keys (125/218): guarded by
--     "auth.uid() IS DISTINCT FROM p_user_id" check.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'fn_auto_draft_participants'
    ) THEN
        REVOKE EXECUTE ON FUNCTION public.fn_auto_draft_participants(UUID, INT) FROM authenticated;
    END IF;
END
$$;
