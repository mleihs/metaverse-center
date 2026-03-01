-- Migration 040: Platform settings table for runtime-configurable cache TTLs
-- and other platform-level admin settings.

-- Table: platform_settings (key-value store, no simulation scope)
CREATE TABLE public.platform_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key text NOT NULL UNIQUE,
    setting_value jsonb NOT NULL,
    description text,
    updated_by_id uuid REFERENCES auth.users(id),
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- RLS: service_role only (admin client). No anon/authenticated access.
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE TRIGGER set_platform_settings_updated_at
    BEFORE UPDATE ON public.platform_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Seed default cache TTL values
INSERT INTO public.platform_settings (setting_key, setting_value, description) VALUES
    ('cache_map_data_ttl', '15', 'In-process TTL (seconds) for Cartographer''s Map data aggregation'),
    ('cache_seo_metadata_ttl', '300', 'TTL (seconds) for SEO simulation metadata lookups'),
    ('cache_http_simulations_max_age', '60', 'HTTP Cache-Control max-age for /public/simulations'),
    ('cache_http_map_data_max_age', '15', 'HTTP Cache-Control max-age for /public/map-data'),
    ('cache_http_battle_feed_max_age', '10', 'HTTP Cache-Control max-age for /public/battle-feed'),
    ('cache_http_connections_max_age', '60', 'HTTP Cache-Control max-age for /public/connections');

-- ============================================================
-- Admin RPC functions for auth.users access
-- GoTrue admin API requires ES256 tokens; these SECURITY DEFINER
-- functions let service_role clients query auth.users via PostgREST RPC.
-- ============================================================

-- List auth users with pagination
CREATE OR REPLACE FUNCTION public.admin_list_users(
    p_page integer DEFAULT 1,
    p_per_page integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
            id::text,
            email,
            raw_user_meta_data,
            created_at,
            last_sign_in_at,
            email_confirmed_at
        FROM auth.users
        ORDER BY created_at DESC
        LIMIT p_per_page OFFSET v_offset
    ) u;

    RETURN jsonb_build_object('users', v_users, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_users(integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_list_users(integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(integer, integer) TO service_role;

-- Get a single user by ID
CREATE OR REPLACE FUNCTION public.admin_get_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user jsonb;
BEGIN
    SELECT row_to_json(u)::jsonb INTO v_user
    FROM (
        SELECT
            id::text,
            email,
            raw_user_meta_data,
            created_at,
            last_sign_in_at,
            email_confirmed_at
        FROM auth.users
        WHERE id = p_user_id
    ) u;

    IF v_user IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    RETURN v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_user(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_get_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user(uuid) TO service_role;

-- Delete a user
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM auth.users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO service_role;
