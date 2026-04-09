-- Migration 195: Revoke fn_award_achievement from authenticated role
--
-- Security fix: migration 190 granted EXECUTE on fn_award_achievement to
-- authenticated, allowing any logged-in user to award any badge to any user
-- via direct RPC call. All legitimate callers are SECURITY DEFINER triggers
-- (which run as the function owner) or the backend via service_role.
-- No frontend or backend code calls this RPC as authenticated.

REVOKE EXECUTE ON FUNCTION fn_award_achievement(UUID, TEXT, JSONB) FROM authenticated;
