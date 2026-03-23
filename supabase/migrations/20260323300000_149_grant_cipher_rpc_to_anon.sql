-- Grant anon + authenticated access to cipher redemption RPC.
--
-- fn_redeem_cipher_code is SECURITY DEFINER and contains all validation
-- (rate limiting, deduplication, reward determination) internally.
-- Safe for public access because:
-- 1. Rate limiting is enforced inside the RPC (per-IP hash)
-- 2. Deduplication prevents double-redemption
-- 3. No sensitive data is exposed in the return value
-- 4. The endpoint already has FastAPI-level rate limiting (10/min)
--
-- Previously callable only by service_role (migration 139).
-- The public /bureau/dispatch endpoint used admin_supabase unnecessarily.

GRANT EXECUTE ON FUNCTION public.fn_redeem_cipher_code(text, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.fn_redeem_cipher_code(text, uuid, text) TO authenticated;
