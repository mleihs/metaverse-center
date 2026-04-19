-- Migration 226: Content-draft status transition trigger (A1.7 Phase 2/4 step 4)
--
-- Defense-in-depth for the content_drafts state machine. Migrations 224+225
-- shipped the table + point-in-time invariants (CHECK on status↔timestamp).
-- This migration adds the missing piece: a TRANSITION check that rejects
-- forbidden status edges, including any path that would resurrect terminal
-- states (merged, abandoned).
--
-- Why a trigger and not a CHECK constraint:
--   Postgres CHECK constraints cannot reference OLD vs NEW — they only see
--   the row's final state. Verifying that a transition is allowed (e.g. that
--   no UPDATE moves a 'merged' row to anything else) requires comparing OLD
--   to NEW, which only triggers can do.
--
-- The Python service layer (publish.py + webhooks.py + content_drafts_service.py)
-- already routes every transition through gate-on-null idempotent helpers, so
-- this trigger only catches:
--   - direct service_role writes (e.g. ad-hoc SQL during incident response)
--   - future code paths that bypass the service layer
--   - admin-portal mistakes
-- It is NOT the primary enforcement layer; it is the safety net.
--
-- Allowed transitions (from → to):
--   draft     → conflict | published | abandoned
--   conflict  → draft | abandoned
--   published → merged | draft | abandoned
--                       ^^^^^ revert path (decision A from Phase-2 handover):
--                             pull_request.closed without merge sends the
--                             draft back so the admin can re-publish.
--   merged    → (none — terminal)
--   abandoned → (none — terminal)
--
-- Same-status updates (e.g. UPDATE working_content where status stays 'draft')
-- never fire this trigger because of `WHEN (OLD.status IS DISTINCT FROM
-- NEW.status)`.
--
-- References:
--   - memory/a1-7-phase-2-handover-2026-04-19.md §"Open decisions" + §40
--     (state-machine trigger as the deferred work after webhook handler
--     locked in the published→draft revert edge).
--   - backend/services/content_drafts_service.py — bulk methods that
--     route through the allowed edges.
--   - backend/routers/webhooks.py — handler that emits the published→merged
--     and published→draft transitions.
--   - backend/routers/admin_drafts.py — DELETE endpoint that emits the
--     {draft,conflict}→abandoned transitions.

BEGIN;

CREATE OR REPLACE FUNCTION content_drafts_enforce_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Allow the transition if (OLD.status, NEW.status) is in the matrix.
    IF OLD.status = 'draft' AND NEW.status IN ('conflict', 'published', 'abandoned') THEN
        RETURN NEW;
    ELSIF OLD.status = 'conflict' AND NEW.status IN ('draft', 'abandoned') THEN
        RETURN NEW;
    ELSIF OLD.status = 'published' AND NEW.status IN ('merged', 'draft', 'abandoned') THEN
        RETURN NEW;
    END IF;

    -- Anything else (terminal-state escape, illegal jump, unknown enum value)
    -- is a hard error. ERRCODE 'check_violation' (23514) so PostgREST surfaces
    -- a structured error code that the service layer can recognize.
    RAISE EXCEPTION 'Invalid content_drafts status transition: % -> %',
        OLD.status, NEW.status
        USING ERRCODE = 'check_violation';
END;
$$;

-- The trigger fires only on actual status changes (WHEN clause). Plain
-- working_content updates (status stays 'draft') are never gated by this
-- trigger, so the optimistic-version path in update_working() pays no cost.
CREATE TRIGGER content_drafts_enforce_status_transition
    BEFORE UPDATE OF status ON content_drafts
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION content_drafts_enforce_status_transition();

COMMIT;
