-- Allow authenticated users to INSERT into ai_usage_log.
-- This enables services using user JWT (not admin) to log AI usage.
-- Users can only INSERT, never SELECT/UPDATE/DELETE their own logs.
-- Read access remains service_role only (admin dashboard).

CREATE POLICY ai_usage_log_authenticated_insert ON ai_usage_log
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
