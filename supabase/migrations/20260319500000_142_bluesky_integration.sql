-- Migration 142: Bluesky Integration
-- Bureau of Impossible Geography — Bluesky publishing pipeline
--
-- Tables: bluesky_posts
-- Views: v_bluesky_queue (new), v_instagram_queue (updated with bsky_status)
-- RPCs: fn_bluesky_analytics
-- Triggers: fn_crosspost_to_bluesky (auto cross-post from Instagram)
-- RLS: platform-admin only

-- ============================================================================
-- TABLE: bluesky_posts
-- ============================================================================

CREATE TABLE public.bluesky_posts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    instagram_post_id uuid REFERENCES public.instagram_posts(id) ON DELETE SET NULL,
    simulation_id uuid REFERENCES public.simulations(id) ON DELETE SET NULL,

    content_source_type text NOT NULL,
    content_source_id uuid,

    -- Bluesky API fields
    bsky_uri text,                -- at://did:plc:.../app.bsky.feed.post/...
    bsky_cid text,                -- Content hash from createRecord response

    -- Adapted content (300-grapheme limit)
    caption text NOT NULL,
    facets jsonb,                 -- AT Protocol rich text facets (byte offsets)
    alt_text text,
    image_urls text[] NOT NULL,   -- Same staging URLs as Instagram (JPEG < 1MB)

    -- Scheduling & state
    status text NOT NULL DEFAULT 'pending',  -- pending, publishing, published, failed, skipped
    scheduled_at timestamptz,
    published_at timestamptz,
    failure_reason text,
    retry_count integer DEFAULT 0,

    -- Engagement metrics (Bluesky-native)
    likes_count integer DEFAULT 0,
    reposts_count integer DEFAULT 0,
    replies_count integer DEFAULT 0,
    quotes_count integer DEFAULT 0,
    metrics_updated_at timestamptz,

    -- ARG (shared cipher code from Instagram source post)
    unlock_code text,

    -- Standard fields
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.bluesky_posts IS 'Bluesky publishing queue — cross-posted from Instagram pipeline';

-- Indexes (same pattern as instagram_posts)
CREATE INDEX idx_bsky_posts_ig_source ON public.bluesky_posts(instagram_post_id);
CREATE INDEX idx_bsky_posts_status ON public.bluesky_posts(status);
CREATE INDEX idx_bsky_posts_scheduled ON public.bluesky_posts(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_bsky_posts_published ON public.bluesky_posts(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_bsky_posts_source ON public.bluesky_posts(content_source_type, content_source_id);

-- Dedup: same entity, same day
CREATE UNIQUE INDEX idx_bsky_posts_dedup
    ON public.bluesky_posts (content_source_type, content_source_id, utc_date(COALESCE(scheduled_at, created_at)))
    WHERE status NOT IN ('skipped', 'failed');

-- Updated_at trigger (reuse existing function)
CREATE TRIGGER set_bsky_posts_updated_at
    BEFORE UPDATE ON public.bluesky_posts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: platform admin only
ALTER TABLE public.bluesky_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY bsky_posts_admin_all ON public.bluesky_posts FOR ALL USING (is_platform_admin());

-- ============================================================================
-- VIEW: Bluesky admin queue with simulation & Instagram metadata
-- ============================================================================

CREATE VIEW public.v_bluesky_queue AS
SELECT
    bp.id,
    bp.instagram_post_id,
    bp.simulation_id,
    bp.content_source_type,
    bp.content_source_id,
    bp.bsky_uri,
    bp.bsky_cid,
    bp.caption,
    bp.facets,
    bp.alt_text,
    bp.image_urls,
    bp.status,
    bp.scheduled_at,
    bp.published_at,
    bp.failure_reason,
    bp.retry_count,
    bp.likes_count,
    bp.reposts_count,
    bp.replies_count,
    bp.quotes_count,
    bp.metrics_updated_at,
    bp.unlock_code,
    bp.created_at,
    bp.updated_at,
    s.name AS simulation_name,
    s.slug AS simulation_slug,
    s.theme AS simulation_theme,
    ip.ig_permalink AS instagram_permalink,
    ip.status AS instagram_status
FROM public.bluesky_posts bp
LEFT JOIN public.simulations s ON s.id = bp.simulation_id
LEFT JOIN public.instagram_posts ip ON ip.id = bp.instagram_post_id
ORDER BY COALESCE(bp.scheduled_at, bp.created_at) DESC;

COMMENT ON VIEW public.v_bluesky_queue IS 'Admin view: Bluesky content queue with simulation and Instagram metadata';

-- ============================================================================
-- VIEW: Update v_instagram_queue to include Bluesky cross-post status
-- ============================================================================

CREATE OR REPLACE VIEW public.v_instagram_queue AS
SELECT
    ip.id,
    ip.simulation_id,
    ip.content_source_type,
    ip.content_source_id,
    ip.caption,
    ip.hashtags,
    ip.alt_text,
    ip.image_urls,
    ip.media_type,
    ip.status,
    ip.scheduled_at,
    ip.published_at,
    ip.failure_reason,
    ip.retry_count,
    ip.ig_permalink,
    ip.likes_count,
    ip.comments_count,
    ip.reach,
    ip.saves,
    ip.shares,
    ip.engagement_rate,
    ip.metrics_updated_at,
    ip.unlock_code,
    ip.ai_disclosure_included,
    ip.ai_model_used,
    ip.created_at,
    ip.updated_at,
    ip.created_by_id,
    s.name AS simulation_name,
    s.slug AS simulation_slug,
    s.theme AS simulation_theme,
    -- Bluesky cross-post status (NULL = not cross-posted)
    (SELECT bp.status FROM bluesky_posts bp WHERE bp.instagram_post_id = ip.id
     ORDER BY bp.created_at DESC LIMIT 1) AS bsky_status
FROM public.instagram_posts ip
LEFT JOIN public.simulations s ON s.id = ip.simulation_id
ORDER BY COALESCE(ip.scheduled_at, ip.created_at) DESC;

-- ============================================================================
-- TRIGGER: Auto-create Bluesky post when Instagram post status → 'scheduled'
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_crosspost_to_bluesky()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_enabled boolean;
    v_auto_crosspost boolean;
    v_adapted_caption text;
BEGIN
    -- Only fire on status change to 'scheduled'
    IF NEW.status <> 'scheduled' OR OLD.status = 'scheduled' THEN
        RETURN NEW;
    END IF;

    -- Check platform settings
    SELECT
        COALESCE((SELECT (setting_value::jsonb)::boolean FROM platform_settings WHERE setting_key = 'bluesky_enabled'), false),
        COALESCE((SELECT (setting_value::jsonb)::boolean FROM platform_settings WHERE setting_key = 'bluesky_auto_crosspost'), true)
    INTO v_enabled, v_auto_crosspost;

    IF NOT v_enabled OR NOT v_auto_crosspost THEN
        RETURN NEW;
    END IF;

    -- Skip if already cross-posted
    IF EXISTS (SELECT 1 FROM bluesky_posts WHERE instagram_post_id = NEW.id) THEN
        RETURN NEW;
    END IF;

    -- Truncate caption to ~280 graphemes (leave room for link)
    -- Full adaptation happens in Python service; this is a safe placeholder
    v_adapted_caption := left(NEW.caption, 280);

    INSERT INTO public.bluesky_posts (
        instagram_post_id, simulation_id, content_source_type, content_source_id,
        caption, alt_text, image_urls, status, scheduled_at, unlock_code
    ) VALUES (
        NEW.id, NEW.simulation_id, NEW.content_source_type, NEW.content_source_id,
        v_adapted_caption, NEW.alt_text, COALESCE(NEW.image_urls, '{}'::text[]), 'pending', NEW.scheduled_at, NEW.unlock_code
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_instagram_crosspost_bluesky
    AFTER UPDATE ON public.instagram_posts
    FOR EACH ROW EXECUTE FUNCTION public.fn_crosspost_to_bluesky();

-- ============================================================================
-- RPC: Bluesky analytics aggregation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_bluesky_analytics(p_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'period_days', p_days,
        'total_posts', COUNT(*) FILTER (WHERE status = 'published'),
        'total_pending', COUNT(*) FILTER (WHERE status = 'pending'),
        'total_failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'total_skipped', COUNT(*) FILTER (WHERE status = 'skipped'),
        'avg_likes', ROUND(AVG(likes_count) FILTER (WHERE status = 'published'), 1),
        'total_reposts', SUM(reposts_count) FILTER (WHERE status = 'published'),
        'total_replies', SUM(replies_count) FILTER (WHERE status = 'published'),
        'total_quotes', SUM(quotes_count) FILTER (WHERE status = 'published'),
        'engagement_by_type', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'content_type', content_source_type,
                'post_count', cnt,
                'avg_likes', avg_l
            ))
            FROM (
                SELECT content_source_type, COUNT(*) AS cnt, ROUND(AVG(likes_count), 1) AS avg_l
                FROM bluesky_posts
                WHERE status = 'published'
                  AND published_at >= now() - make_interval(days => p_days)
                GROUP BY content_source_type
            ) sub
        ), '[]'::jsonb)
    ) INTO v_result
    FROM bluesky_posts
    WHERE created_at >= now() - make_interval(days => p_days);

    RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ============================================================================
-- Platform settings: Bluesky configuration
-- ============================================================================

INSERT INTO public.platform_settings (setting_key, setting_value, description) VALUES
    ('bluesky_enabled', '"false"', 'Master switch for Bluesky publishing pipeline'),
    ('bluesky_posting_enabled', '"false"', 'Enable actual posting (vs dry-run mode)'),
    ('bluesky_handle', '""', 'Bluesky handle (e.g. bureau.bsky.social)'),
    ('bluesky_app_password', '""', 'Encrypted app password for Bluesky authentication'),
    ('bluesky_pds_url', '"https://bsky.social"', 'Personal Data Server URL'),
    ('bluesky_auto_crosspost', '"true"', 'Auto-create Bluesky posts when Instagram posts are approved'),
    ('bluesky_scheduler_interval_seconds', '300', 'Background scheduler check interval')
ON CONFLICT (setting_key) DO NOTHING;
