-- 057: Update Admin User RPCs to include Forge Wallet data
-- Extends existing administrative visibility into architect status and tokens.

CREATE OR REPLACE FUNCTION public.admin_list_users(p_page integer DEFAULT 1, p_per_page integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_offset integer;
    v_total integer;
    v_users jsonb;
BEGIN
    v_offset := (p_page - 1) * p_per_page;

    SELECT count(*) INTO v_total FROM auth.users;

    SELECT coalesce(jsonb_agg(row_to_json(u)::jsonb ORDER BY u.created_at DESC), '[]'::jsonb)
    INTO v_users
    FROM (
        SELECT
            au.id::text,
            au.email,
            au.raw_user_meta_data,
            au.created_at,
            au.last_sign_in_at,
            au.email_confirmed_at,
            uw.forge_tokens,
            uw.is_architect
        FROM auth.users au
        LEFT JOIN public.user_wallets uw ON au.id = uw.user_id
        ORDER BY au.created_at DESC
        LIMIT p_per_page OFFSET v_offset
    ) u;

    RETURN jsonb_build_object('users', v_users, 'total', v_total);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_user(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user jsonb;
BEGIN
    SELECT row_to_json(u)::jsonb INTO v_user
    FROM (
        SELECT
            au.id::text,
            au.email,
            au.raw_user_meta_data,
            au.created_at,
            au.last_sign_in_at,
            au.email_confirmed_at,
            uw.forge_tokens,
            uw.is_architect
        FROM auth.users au
        LEFT JOIN public.user_wallets uw ON au.id = uw.user_id
        WHERE au.id = p_user_id
    ) u;

    IF v_user IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN v_user;
END;
$function$;
