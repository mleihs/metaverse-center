-- Revoke dangerous public access to admin_list_users RPC.
--
-- Migration 096 granted EXECUTE to anon + authenticated so the
-- DevAccountSwitcher could call the RPC directly via the Supabase
-- client.  This is a critical security leak: any unauthenticated
-- caller can enumerate all platform users (emails, metadata, wallet
-- balances, architect status) via a single PostgREST request.
--
-- The DevAccountSwitcher is now rewired to use the backend admin API
-- endpoint (GET /api/v1/admin/users) which is protected by
-- require_platform_admin().  The RPC remains callable by service_role
-- (used by the backend admin service).

REVOKE EXECUTE ON FUNCTION public.admin_list_users(integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_users(integer, integer) FROM authenticated;
