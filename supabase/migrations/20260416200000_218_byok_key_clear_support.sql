-- Migration 218: Add key clearing support to BYOK RPC
--
-- The existing fn_update_user_byok_keys uses COALESCE which makes it
-- impossible to set a key column back to NULL (i.e. delete a key).
-- This adds boolean clear flags: when true, the corresponding column
-- is explicitly set to NULL regardless of the encrypted key parameter.

CREATE OR REPLACE FUNCTION public.fn_update_user_byok_keys(
    p_user_id uuid,
    p_encrypted_openrouter_key text DEFAULT NULL,
    p_encrypted_replicate_key text DEFAULT NULL,
    p_clear_openrouter boolean DEFAULT false,
    p_clear_replicate boolean DEFAULT false
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
        encrypted_openrouter_key = CASE
            WHEN p_clear_openrouter THEN NULL
            ELSE COALESCE(p_encrypted_openrouter_key, encrypted_openrouter_key)
        END,
        encrypted_replicate_key = CASE
            WHEN p_clear_replicate THEN NULL
            ELSE COALESCE(p_encrypted_replicate_key, encrypted_replicate_key)
        END,
        updated_at = now()
    WHERE user_id = p_user_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found. Must be an architect first.');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Keys updated successfully.');
END;
$$;

-- Permissions unchanged from migration 125
REVOKE ALL ON FUNCTION public.fn_update_user_byok_keys FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_update_user_byok_keys TO authenticated;
