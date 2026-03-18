-- Migration 134: Security linter fixes
--
-- 1. Replace v_pending_forge_requests VIEW (joins auth.users, exposing emails)
--    with a SECURITY DEFINER RPC locked to service_role only.
-- 2. Drop unused legacy materialized views: agent_statistics, campaign_performance.

-- ============================================================
-- 1a. Drop the view that exposes auth.users emails
-- ============================================================
DROP VIEW IF EXISTS public.v_pending_forge_requests;

-- ============================================================
-- 1b. Replacement RPC — same query, locked down
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_list_pending_forge_requests()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN coalesce(
        (SELECT jsonb_agg(row_to_json(r)::jsonb)
         FROM (
            SELECT far.id,
                   far.user_id,
                   u.email AS user_email,
                   far.requested_tier,
                   far.status,
                   far.message,
                   far.admin_notes,
                   far.reviewed_by,
                   far.created_at,
                   far.reviewed_at
            FROM public.forge_access_requests far
            JOIN auth.users u ON u.id = far.user_id
            WHERE far.status = 'pending'
            ORDER BY far.created_at ASC
         ) r),
        '[]'::jsonb
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_list_pending_forge_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_list_pending_forge_requests() FROM anon;
REVOKE ALL ON FUNCTION public.fn_list_pending_forge_requests() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_list_pending_forge_requests() TO service_role;

-- ============================================================
-- 2. Drop unused legacy views
-- ============================================================
DROP VIEW IF EXISTS public.agent_statistics;
DROP VIEW IF EXISTS public.campaign_performance;
