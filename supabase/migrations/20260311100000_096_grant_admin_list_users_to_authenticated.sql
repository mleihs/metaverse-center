-- Grant anon + authenticated access to admin_list_users RPC.
-- Previously restricted to service_role only (migration 040).
-- Needed for DevAccountSwitcher which calls the RPC directly via the
-- Supabase client (anon/authenticated key) to list all platform users
-- without requiring the caller to already be a platform admin.
-- Safe because the DevAccountSwitcher is gated in production (password).

GRANT EXECUTE ON FUNCTION public.admin_list_users(integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(integer, integer) TO authenticated;
