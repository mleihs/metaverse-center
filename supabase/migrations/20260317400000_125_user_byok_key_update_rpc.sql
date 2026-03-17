-- Migration 125: RPC for user BYOK key updates (replaces service_role bypass)
--
-- Previously, updating encrypted BYOK keys required service_role because
-- user_wallets RLS only allows SELECT for the owning user. This RPC runs
-- as SECURITY DEFINER so the user JWT client can call it directly, while
-- the function validates ownership and only touches key columns.

CREATE OR REPLACE FUNCTION public.fn_update_user_byok_keys(
    p_user_id uuid,
    p_encrypted_openrouter_key text DEFAULT NULL,
    p_encrypted_replicate_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count integer;
BEGIN
    -- Caller must be the wallet owner
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Not authorized to update another user''s keys';
    END IF;

    UPDATE public.user_wallets
    SET
        encrypted_openrouter_key = COALESCE(p_encrypted_openrouter_key, encrypted_openrouter_key),
        encrypted_replicate_key  = COALESCE(p_encrypted_replicate_key, encrypted_replicate_key),
        updated_at = now()
    WHERE user_id = p_user_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found. Must be an architect first.');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Keys updated successfully.');
END;
$$;

-- Only authenticated users can call this
REVOKE ALL ON FUNCTION public.fn_update_user_byok_keys FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_update_user_byok_keys TO authenticated;
