-- 141: Instagram Lore Candidates
--
-- Adds lore branch to fn_select_instagram_candidates RPC.
-- Python DEFAULT_CONTENT_MIX already includes "lore": 1, but the Postgres
-- function never selected lore rows. This adds the missing branch.
-- Also updates platform_settings content mix to include lore.

CREATE OR REPLACE FUNCTION public.fn_select_instagram_candidates(
    p_content_types text[] DEFAULT ARRAY['agent', 'building', 'chronicle', 'lore'],
    p_limit int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb := '[]'::jsonb;
    v_agents jsonb;
    v_buildings jsonb;
    v_chronicles jsonb;
    v_lore jsonb;
BEGIN
    -- Agents: must have portrait, prefer recently created
    IF 'agent' = ANY(p_content_types) THEN
        SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
        INTO v_agents
        FROM (
            SELECT
                a.id,
                'agent' AS content_type,
                a.name,
                a.system,
                a.character,
                a.background,
                a.portrait_image_url AS image_url,
                a.simulation_id,
                s.name AS simulation_name,
                s.slug AS simulation_slug,
                s.theme AS simulation_theme,
                a.created_at
            FROM active_agents a
            JOIN simulations s ON s.id = a.simulation_id
            WHERE a.portrait_image_url IS NOT NULL
              AND a.simulation_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM instagram_posts ip
                  WHERE ip.content_source_type = 'agent'
                    AND ip.content_source_id = a.id
                    AND ip.status NOT IN ('rejected', 'failed')
              )
            ORDER BY a.created_at DESC
            LIMIT p_limit
        ) sub;
        v_result := v_result || COALESCE(v_agents, '[]'::jsonb);
    END IF;

    -- Buildings: must have image
    IF 'building' = ANY(p_content_types) THEN
        SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
        INTO v_buildings
        FROM (
            SELECT
                b.id,
                'building' AS content_type,
                b.name,
                b.building_type,
                b.description,
                b.building_condition,
                b.image_url,
                b.simulation_id,
                s.name AS simulation_name,
                s.slug AS simulation_slug,
                s.theme AS simulation_theme,
                b.created_at
            FROM active_buildings b
            JOIN simulations s ON s.id = b.simulation_id
            WHERE b.image_url IS NOT NULL
              AND b.simulation_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM instagram_posts ip
                  WHERE ip.content_source_type = 'building'
                    AND ip.content_source_id = b.id
                    AND ip.status NOT IN ('rejected', 'failed')
              )
            ORDER BY b.created_at DESC
            LIMIT p_limit
        ) sub;
        v_result := v_result || COALESCE(v_buildings, '[]'::jsonb);
    END IF;

    -- Chronicles: all have content
    IF 'chronicle' = ANY(p_content_types) THEN
        SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
        INTO v_chronicles
        FROM (
            SELECT
                c.id,
                'chronicle' AS content_type,
                c.title AS name,
                c.headline,
                c.content,
                c.edition_number,
                c.simulation_id,
                s.name AS simulation_name,
                s.slug AS simulation_slug,
                s.theme AS simulation_theme,
                c.created_at
            FROM simulation_chronicles c
            JOIN simulations s ON s.id = c.simulation_id
            WHERE c.simulation_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM instagram_posts ip
                  WHERE ip.content_source_type = 'chronicle'
                    AND ip.content_source_id = c.id
                    AND ip.status NOT IN ('rejected', 'failed')
              )
            ORDER BY c.created_at DESC
            LIMIT p_limit
        ) sub;
        v_result := v_result || COALESCE(v_chronicles, '[]'::jsonb);
    END IF;

    -- Lore: declassified archive entries with image_slug
    IF 'lore' = ANY(p_content_types) THEN
        SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
        INTO v_lore
        FROM (
            SELECT
                l.id,
                'lore' AS content_type,
                l.title AS name,
                l.chapter,
                l.epigraph,
                l.body,
                l.image_slug,
                l.simulation_id,
                s.name AS simulation_name,
                s.slug AS simulation_slug,
                s.theme AS simulation_theme,
                l.created_at
            FROM simulation_lore l
            JOIN simulations s ON s.id = l.simulation_id
            WHERE l.simulation_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM instagram_posts ip
                  WHERE ip.content_source_type = 'lore'
                    AND ip.content_source_id = l.id
                    AND ip.status NOT IN ('rejected', 'failed')
              )
            ORDER BY l.created_at DESC
            LIMIT p_limit
        ) sub;
        v_result := v_result || COALESCE(v_lore, '[]'::jsonb);
    END IF;

    RETURN v_result;
END;
$$;

-- Update content mix to include lore
UPDATE public.platform_settings
SET setting_value = '{"agent": 3, "building": 2, "chronicle": 2, "lore": 1}'::jsonb
WHERE setting_key = 'instagram_content_mix';

-- Insert if not exists (fresh installs)
INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES (
    'instagram_content_mix',
    '{"agent": 3, "building": 2, "chronicle": 2, "lore": 1}'::jsonb,
    'Proportional weights for Instagram content type selection'
)
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- FIX: fn_instagram_analytics — nested aggregate error
-- The subqueries for engagement_by_simulation and engagement_by_type used
-- GROUP BY with aggregates inside an already-aggregating outer SELECT.
-- Fix: compute each section independently, then combine.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_instagram_analytics(
    p_days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cutoff timestamptz := now() - (p_days || ' days')::interval;
    v_summary jsonb;
    v_by_sim jsonb;
    v_by_type jsonb;
    v_top_type text;
BEGIN
    -- Summary stats
    SELECT jsonb_build_object(
        'period_days', p_days,
        'total_posts', COUNT(*) FILTER (WHERE status = 'published'),
        'total_drafts', COUNT(*) FILTER (WHERE status = 'draft'),
        'total_scheduled', COUNT(*) FILTER (WHERE status = 'scheduled'),
        'total_failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'avg_engagement_rate', ROUND(AVG(engagement_rate) FILTER (WHERE status = 'published'), 4),
        'total_reach', SUM(reach) FILTER (WHERE status = 'published'),
        'total_likes', SUM(likes_count) FILTER (WHERE status = 'published'),
        'total_saves', SUM(saves) FILTER (WHERE status = 'published'),
        'total_shares', SUM(shares) FILTER (WHERE status = 'published'),
        'total_comments', SUM(comments_count) FILTER (WHERE status = 'published')
    )
    INTO v_summary
    FROM instagram_posts
    WHERE created_at >= v_cutoff;

    -- Top content type by engagement
    SELECT content_source_type INTO v_top_type
    FROM instagram_posts
    WHERE status = 'published' AND created_at >= v_cutoff
    GROUP BY content_source_type
    ORDER BY AVG(engagement_rate) DESC
    LIMIT 1;

    -- Engagement by simulation
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
    INTO v_by_sim
    FROM (
        SELECT
            ip.simulation_id,
            s.name AS simulation_name,
            COUNT(*) AS post_count,
            ROUND(AVG(ip.engagement_rate), 4) AS avg_engagement_rate,
            SUM(ip.reach) AS total_reach
        FROM instagram_posts ip
        LEFT JOIN simulations s ON s.id = ip.simulation_id
        WHERE ip.status = 'published' AND ip.created_at >= v_cutoff
        GROUP BY ip.simulation_id, s.name
    ) sub;

    -- Engagement by content type
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), '[]'::jsonb)
    INTO v_by_type
    FROM (
        SELECT
            content_source_type AS content_type,
            COUNT(*) AS post_count,
            ROUND(AVG(engagement_rate), 4) AS avg_engagement_rate,
            SUM(reach) AS total_reach
        FROM instagram_posts
        WHERE status = 'published' AND created_at >= v_cutoff
        GROUP BY content_source_type
    ) sub;

    -- Combine
    RETURN v_summary || jsonb_build_object(
        'top_content_type', v_top_type,
        'engagement_by_simulation', v_by_sim,
        'engagement_by_type', v_by_type
    );
END;
$$;
