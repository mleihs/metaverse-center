-- 108: Composite wallet summary RPC
-- Consolidates 3 separate queries (wallet table + 2 RPCs + platform_settings)
-- into a single DB round-trip for get_wallet.

CREATE OR REPLACE FUNCTION public.fn_get_wallet_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_wallet record;
    v_system_enabled boolean;
    v_access_policy text;
    v_effective_bypass boolean;
    v_byok_allowed boolean;
    v_default_status jsonb;
BEGIN
    v_default_status := jsonb_build_object(
        'has_openrouter_key', false,
        'has_replicate_key', false,
        'byok_allowed', false,
        'byok_bypass', false,
        'system_bypass_enabled', false,
        'effective_bypass', false,
        'access_policy', 'per_user'
    );

    -- Fetch wallet (project booleans for key presence, never expose encrypted values)
    SELECT forge_tokens, is_architect, account_tier,
           encrypted_openrouter_key IS NOT NULL AS has_openrouter_key,
           encrypted_replicate_key IS NOT NULL AS has_replicate_key,
           COALESCE(byok_bypass, false) AS byok_bypass,
           COALESCE(byok_allowed, false) AS byok_allowed_flag
    INTO v_wallet
    FROM user_wallets WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'forge_tokens', 0,
            'is_architect', false,
            'account_tier', 'observer',
            'byok_status', v_default_status
        );
    END IF;

    -- Reuse existing policy RPCs (single source of truth)
    v_byok_allowed := fn_user_byok_allowed(p_user_id);
    v_effective_bypass := fn_user_has_byok_bypass(p_user_id);

    -- Platform settings
    SELECT COALESCE((setting_value = 'true'::jsonb), false)
    INTO v_system_enabled
    FROM platform_settings WHERE setting_key = 'byok_bypass_enabled';
    v_system_enabled := COALESCE(v_system_enabled, false);

    SELECT COALESCE(setting_value #>> '{}', 'per_user')
    INTO v_access_policy
    FROM platform_settings WHERE setting_key = 'byok_access_policy';
    v_access_policy := COALESCE(v_access_policy, 'per_user');

    RETURN jsonb_build_object(
        'forge_tokens', v_wallet.forge_tokens,
        'is_architect', v_wallet.is_architect,
        'account_tier', v_wallet.account_tier,
        'byok_status', jsonb_build_object(
            'has_openrouter_key', v_wallet.has_openrouter_key,
            'has_replicate_key', v_wallet.has_replicate_key,
            'byok_allowed', v_byok_allowed,
            'byok_bypass', v_wallet.byok_bypass,
            'system_bypass_enabled', v_system_enabled,
            'effective_bypass', v_effective_bypass,
            'access_policy', v_access_policy
        )
    );
END;
$$;
