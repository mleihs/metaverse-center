-- Migration 231: Bureau Ops Deferral D — tighten ai_usage_log RLS.
--
-- The bare ``FOR ALL USING (true)`` policy from migration 150 grants
-- PUBLIC access. Any authenticated user can subscribe to Realtime
-- updates on ai_usage_log and see every prompt + model + cost across
-- the platform. The FirehosePanel relied on this to receive INSERT
-- events through the user JWT.
--
-- Fix: split the policy so only service_role has full access (backend
-- mutations), and authenticated users can SELECT only when they are
-- a platform admin. The Firehose subscription keeps working for
-- admins (which is the only role allowed into the Ops panel anyway)
-- and the cross-user data exposure is closed.
--
-- The authenticated INSERT policy from migration 151 stays untouched
-- so services using a user JWT can still append usage rows.
--
-- initPlan optimization: is_platform_admin() is SECURITY DEFINER +
-- STABLE. Wrapping the call in ``(SELECT is_platform_admin())`` forces
-- Postgres to evaluate it once per statement rather than per row.
-- Same pattern as migration 183 (113 policies tightened).

DROP POLICY IF EXISTS ai_usage_log_service_role ON ai_usage_log;

CREATE POLICY ai_usage_log_service_role_all
    ON ai_usage_log
    FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY ai_usage_log_platform_admin_select
    ON ai_usage_log
    FOR SELECT
    TO authenticated
    USING ((SELECT is_platform_admin()));

COMMENT ON POLICY ai_usage_log_platform_admin_select ON ai_usage_log IS
    'Platform admins SELECT via user JWT so the Bureau Ops Firehose can subscribe to Realtime INSERT events. Non-admin authenticated users get zero rows.';
