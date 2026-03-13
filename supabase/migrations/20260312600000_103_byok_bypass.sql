-- 103: BYOK Free Access System
-- Users with both BYOK keys (OpenRouter + Replicate) can optionally bypass
-- token costs entirely. Three control levels:
--   1. byok_access_policy: who can use BYOK at all ("none", "all", "per_user")
--   2. byok_allowed (per-user): individual grant when policy is "per_user"
--   3. byok_bypass_enabled: whether BYOK users bypass token costs

-- A. Platform settings
INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES (
    'byok_bypass_enabled',
    'false'::jsonb,
    'When true, users with both BYOK keys set bypass token costs'
)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES (
    'byok_access_policy',
    '"per_user"'::jsonb,
    'Who can use BYOK keys: "none" (nobody), "all" (all architects), "per_user" (admin grants individually)'
)
ON CONFLICT (setting_key) DO NOTHING;

-- B. Per-user flags on user_wallets
ALTER TABLE public.user_wallets ADD COLUMN IF NOT EXISTS byok_bypass boolean DEFAULT false;
ALTER TABLE public.user_wallets ADD COLUMN IF NOT EXISTS byok_allowed boolean DEFAULT false;

-- C. Helper: is this user allowed to use BYOK keys at all?
CREATE OR REPLACE FUNCTION public.fn_user_byok_allowed(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_policy text;
    v_per_user boolean;
BEGIN
    SELECT setting_value #>> '{}' INTO v_policy
    FROM platform_settings WHERE setting_key = 'byok_access_policy';

    v_policy := COALESCE(v_policy, 'per_user');

    IF v_policy = 'none' THEN RETURN false; END IF;
    IF v_policy = 'all' THEN RETURN true; END IF;

    -- per_user: check individual flag
    SELECT byok_allowed INTO v_per_user
    FROM user_wallets WHERE user_id = p_user_id;

    RETURN COALESCE(v_per_user, false);
END;
$$;

-- D. Does this user have BYOK bypass (skip token costs)?
CREATE OR REPLACE FUNCTION public.fn_user_has_byok_bypass(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_wallet record;
    v_system_enabled boolean;
BEGIN
    -- Must be allowed to use BYOK first
    IF NOT fn_user_byok_allowed(p_user_id) THEN
        RETURN false;
    END IF;

    SELECT byok_bypass, encrypted_openrouter_key, encrypted_replicate_key
    INTO v_wallet FROM user_wallets WHERE user_id = p_user_id;

    IF NOT FOUND THEN RETURN false; END IF;

    -- Both keys must be present
    IF v_wallet.encrypted_openrouter_key IS NULL
       OR v_wallet.encrypted_replicate_key IS NULL THEN
        RETURN false;
    END IF;

    -- Per-user bypass override
    IF v_wallet.byok_bypass THEN
        RETURN true;
    END IF;

    -- System-wide bypass check
    SELECT (setting_value = 'true'::jsonb) INTO v_system_enabled
    FROM platform_settings WHERE setting_key = 'byok_bypass_enabled';

    RETURN COALESCE(v_system_enabled, false);
END;
$$;

-- D. Update fn_enforce_forge_quota to check BYOK bypass
CREATE OR REPLACE FUNCTION public.fn_enforce_forge_quota()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_phase = 'ignition' AND OLD.current_phase != 'ignition' THEN
        IF NOT is_platform_admin() AND NOT fn_user_has_byok_bypass(NEW.user_id) THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.user_wallets
                WHERE user_id = NEW.user_id AND forge_tokens > 0
            ) THEN
                RAISE EXCEPTION 'Insufficient forge tokens. Purchase tokens or configure BYOK keys.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- E. Update fn_materialize_shard to skip deduction for BYOK bypass users
CREATE OR REPLACE FUNCTION public.fn_materialize_shard(p_draft_id uuid)
RETURNS uuid AS $$
DECLARE
    v_draft record;
    v_sim_id uuid;
    v_city_id uuid;
    v_user_id uuid;
    v_anchor jsonb;
    v_geo jsonb;
    v_tax jsonb;
    v_agent jsonb;
    v_building jsonb;
    v_setting_key text;
    v_setting_val jsonb;
    v_zone_id uuid;
    v_zone_elem jsonb;
    v_zone_map jsonb := '{}'::jsonb;
    v_slug text;
    v_slug_base text;
    v_slug_counter int := 0;
    v_zone_ids uuid[];
    v_zone_count int;
    v_building_idx int := 0;
    v_is_admin boolean;
    v_has_bypass boolean;
BEGIN
    -- 1. Fetch draft and lock for update
    SELECT * INTO v_draft FROM public.forge_drafts WHERE id = p_draft_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Draft not found.';
    END IF;

    IF v_draft.status NOT IN ('draft', 'processing') THEN
        RAISE EXCEPTION 'Draft is already processed (status: %).', v_draft.status;
    END IF;

    v_user_id := v_draft.user_id;
    v_anchor := v_draft.philosophical_anchor->'selected';
    v_geo := v_draft.geography;
    v_tax := v_draft.taxonomies;

    -- Check admin and BYOK bypass status once
    v_is_admin := is_platform_admin();
    v_has_bypass := fn_user_has_byok_bypass(v_user_id);

    -- 2. Validate required JSONB structure
    IF v_anchor IS NULL OR v_anchor->>'title' IS NULL THEN
        RAISE EXCEPTION 'Draft is missing a selected philosophical anchor.';
    END IF;
    IF v_geo->'zones' IS NULL OR jsonb_array_length(v_geo->'zones') = 0 THEN
        RAISE EXCEPTION 'Draft is missing geography zones.';
    END IF;
    IF v_draft.agents IS NULL OR jsonb_array_length(v_draft.agents) = 0 THEN
        RAISE EXCEPTION 'Draft must contain at least one agent.';
    END IF;

    -- 3. Verify Quota (admin and BYOK bypass skip token check)
    IF NOT v_is_admin AND NOT v_has_bypass THEN
        IF NOT EXISTS (SELECT 1 FROM public.user_wallets WHERE user_id = v_user_id AND forge_tokens > 0) THEN
            RAISE EXCEPTION 'Insufficient tokens.';
        END IF;
    END IF;

    -- 4. Generate unique slug with collision handling
    v_slug_base := lower(regexp_replace(v_anchor->>'title', '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug_base := trim(BOTH '-' FROM v_slug_base);
    v_slug := v_slug_base;

    LOOP
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.simulations WHERE slug = v_slug);
        v_slug_counter := v_slug_counter + 1;
        v_slug := v_slug_base || '-' || v_slug_counter;
    END LOOP;

    -- 5. Create Simulation
    INSERT INTO public.simulations (
        name, slug, description, theme, owner_id, status, simulation_type
    ) VALUES (
        v_anchor->>'title',
        v_slug,
        v_anchor->>'description',
        'custom',
        v_user_id,
        'active',
        'template'
    ) RETURNING id INTO v_sim_id;

    -- 6. Create Owner Membership
    INSERT INTO public.simulation_members (simulation_id, user_id, member_role)
    VALUES (v_sim_id, v_user_id, 'owner');

    -- 7. Create City
    INSERT INTO public.cities (simulation_id, name, description)
    VALUES (v_sim_id, v_geo->>'city_name', 'Materialized via Simulation Forge.')
    RETURNING id INTO v_city_id;

    -- 8. Insert Taxonomies (safe singularization via regexp_replace)
    FOR v_setting_key, v_setting_val IN SELECT * FROM jsonb_each(v_tax)
    LOOP
        INSERT INTO public.simulation_taxonomies (simulation_id, taxonomy_type, value, label)
        SELECT v_sim_id, regexp_replace(v_setting_key, 's$', ''), val, jsonb_build_object('en', val)
        FROM jsonb_array_elements_text(v_setting_val) AS val;
    END LOOP;

    -- 9. Insert Zones
    FOR v_zone_elem IN SELECT * FROM jsonb_array_elements(v_geo->'zones')
    LOOP
        INSERT INTO public.zones (simulation_id, city_id, name, zone_type, description)
        VALUES (v_sim_id, v_city_id, v_zone_elem->>'name', v_zone_elem->>'zone_type', v_zone_elem->>'description')
        RETURNING id INTO v_zone_id;

        v_zone_map := v_zone_map || jsonb_build_object(v_zone_elem->>'name', v_zone_id);
    END LOOP;

    -- Collect zone IDs for round-robin building distribution
    SELECT array_agg(id ORDER BY name) INTO v_zone_ids
    FROM public.zones WHERE simulation_id = v_sim_id;
    v_zone_count := coalesce(array_length(v_zone_ids, 1), 1);

    -- 10. Insert Streets
    INSERT INTO public.city_streets (simulation_id, city_id, zone_id, name, street_type)
    SELECT v_sim_id, v_city_id, (v_zone_map->>(s->>'zone_name'))::uuid, s->>'name', s->>'street_type'
    FROM jsonb_array_elements(v_geo->'streets') AS s;

    -- 11. Insert Agents
    INSERT INTO public.agents (simulation_id, name, gender, system, primary_profession, character, background)
    SELECT v_sim_id, a->>'name', a->>'gender', a->>'system', a->>'primary_profession', a->>'character', a->>'background'
    FROM jsonb_array_elements(v_draft.agents) AS a;

    -- 12. Insert Buildings (round-robin distribution, includes building_condition)
    FOR v_building IN SELECT * FROM jsonb_array_elements(v_draft.buildings)
    LOOP
        INSERT INTO public.buildings (simulation_id, city_id, zone_id, name, building_type, description, building_condition)
        VALUES (
            v_sim_id,
            v_city_id,
            v_zone_ids[1 + (v_building_idx % v_zone_count)],
            v_building->>'name',
            v_building->>'building_type',
            v_building->>'description',
            coalesce(v_building->>'building_condition', 'operational')
        );
        v_building_idx := v_building_idx + 1;
    END LOOP;

    -- 13. Insert Settings (AI & Design)
    FOR v_setting_key, v_setting_val IN SELECT * FROM jsonb_each(v_draft.ai_settings)
    LOOP
        INSERT INTO public.simulation_settings (simulation_id, category, setting_key, setting_value)
        VALUES (v_sim_id, 'ai', v_setting_key, v_setting_val);
    END LOOP;

    -- 14. Deduct Token (admin and BYOK bypass skip deduction)
    IF NOT v_is_admin AND NOT v_has_bypass THEN
        UPDATE public.user_wallets SET forge_tokens = forge_tokens - 1 WHERE user_id = v_user_id;
    END IF;

    -- 15. Finalize Draft
    UPDATE public.forge_drafts SET status = 'completed', current_phase = 'completed' WHERE id = p_draft_id;

    RETURN v_sim_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
