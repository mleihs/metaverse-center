-- Migration 135: Instagram Integration
-- Bureau of Impossible Geography — Instagram publishing pipeline
--
-- Tables: instagram_posts
-- Views: v_instagram_queue
-- RPCs: fn_select_instagram_candidates, fn_instagram_analytics
-- RLS: platform-admin only

-- ============================================================================
-- TABLE: instagram_posts
-- ============================================================================

CREATE TABLE public.instagram_posts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id uuid REFERENCES public.simulations(id) ON DELETE SET NULL,

    -- Content source tracking
    content_source_type text NOT NULL,       -- agent, building, chronicle, battle_report, heartbeat, resonance
    content_source_id uuid,
    content_source_snapshot jsonb NOT NULL,   -- Frozen entity data at post time (archive)

    -- Instagram API fields
    ig_media_id text,                        -- From Graph API response
    ig_permalink text,                       -- Permanent link to published post
    ig_container_id text,                    -- For crash recovery between create/publish

    -- Content
    caption text NOT NULL,
    hashtags text[] DEFAULT '{}',
    alt_text text,
    image_urls text[] NOT NULL,              -- Supabase staging URLs (JPEG)
    media_type text NOT NULL DEFAULT 'IMAGE', -- IMAGE, CAROUSEL, STORIES, REELS

    -- Scheduling & state
    status text NOT NULL DEFAULT 'draft',    -- draft, scheduled, publishing, published, failed, rejected
    scheduled_at timestamptz,
    published_at timestamptz,
    failure_reason text,
    retry_count integer DEFAULT 0,

    -- Engagement metrics (populated via Insights API)
    likes_count integer DEFAULT 0,
    comments_count integer DEFAULT 0,
    reach integer DEFAULT 0,
    impressions integer DEFAULT 0,
    saves integer DEFAULT 0,
    shares integer DEFAULT 0,
    engagement_rate numeric(5,4) DEFAULT 0,
    metrics_updated_at timestamptz,

    -- ARG
    unlock_code text,                        -- Cipher solution for ARG posts

    -- Compliance
    ai_disclosure_included boolean DEFAULT true,
    ai_model_used text,

    -- Standard fields
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_by_id uuid REFERENCES auth.users(id)
);

COMMENT ON TABLE public.instagram_posts IS 'Bureau Instagram publishing pipeline — content staging, scheduling, and analytics';
COMMENT ON COLUMN public.instagram_posts.content_source_snapshot IS 'Frozen entity data at post time — serves as content archive';
COMMENT ON COLUMN public.instagram_posts.ig_container_id IS 'Meta container ID for crash recovery between create/publish steps';
COMMENT ON COLUMN public.instagram_posts.unlock_code IS 'Cipher solution for ARG posts — decoded on /bureau/dispatch';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_ig_posts_simulation ON public.instagram_posts(simulation_id);
CREATE INDEX idx_ig_posts_status ON public.instagram_posts(status);
CREATE INDEX idx_ig_posts_scheduled ON public.instagram_posts(scheduled_at)
    WHERE status = 'scheduled';
CREATE INDEX idx_ig_posts_published ON public.instagram_posts(published_at DESC)
    WHERE status = 'published';
CREATE INDEX idx_ig_posts_source ON public.instagram_posts(content_source_type, content_source_id);

-- Helper: extract UTC date from timestamptz (IMMUTABLE for index use)
CREATE OR REPLACE FUNCTION public.utc_date(ts timestamptz)
RETURNS date LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT CAST(ts AT TIME ZONE 'UTC' AS date) $$;

-- Dedup constraint: same entity can't be posted twice on the same day
CREATE UNIQUE INDEX idx_ig_posts_dedup
    ON public.instagram_posts (content_source_type, content_source_id, utc_date(COALESCE(scheduled_at, created_at)))
    WHERE status NOT IN ('rejected', 'failed');

-- ============================================================================
-- TRIGGER: auto-update updated_at (uses existing set_updated_at function)
-- ============================================================================

CREATE TRIGGER set_ig_posts_updated_at
    BEFORE UPDATE ON public.instagram_posts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- RLS: Only platform admins can read/write
-- Service role bypasses RLS for scheduler operations
-- ============================================================================

ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY ig_posts_admin_all ON public.instagram_posts
    FOR ALL USING (is_platform_admin());

-- ============================================================================
-- VIEW: Admin queue management
-- ============================================================================

CREATE VIEW public.v_instagram_queue AS
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
    s.theme AS simulation_theme
FROM public.instagram_posts ip
LEFT JOIN public.simulations s ON s.id = ip.simulation_id
ORDER BY COALESCE(ip.scheduled_at, ip.created_at) DESC;

COMMENT ON VIEW public.v_instagram_queue IS 'Admin view: Instagram content queue with simulation metadata';

-- ============================================================================
-- RPC: Select next content candidates for Instagram posting
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_select_instagram_candidates(
    p_content_types text[] DEFAULT ARRAY['agent', 'building', 'chronicle'],
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
                b.condition,
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

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_select_instagram_candidates IS 'Select unposted content candidates for Instagram publishing pipeline';

-- ============================================================================
-- RPC: Instagram analytics aggregate
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
    v_result jsonb;
    v_cutoff timestamptz := now() - (p_days || ' days')::interval;
BEGIN
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
        'total_comments', SUM(comments_count) FILTER (WHERE status = 'published'),
        'top_content_type', (
            SELECT content_source_type
            FROM instagram_posts
            WHERE status = 'published' AND created_at >= v_cutoff
            GROUP BY content_source_type
            ORDER BY AVG(engagement_rate) DESC
            LIMIT 1
        ),
        'engagement_by_simulation', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'simulation_id', ip.simulation_id,
                'simulation_name', s.name,
                'post_count', COUNT(*),
                'avg_engagement_rate', ROUND(AVG(ip.engagement_rate), 4),
                'total_reach', SUM(ip.reach)
            )), '[]'::jsonb)
            FROM instagram_posts ip
            LEFT JOIN simulations s ON s.id = ip.simulation_id
            WHERE ip.status = 'published' AND ip.created_at >= v_cutoff
            GROUP BY ip.simulation_id, s.name
        ),
        'engagement_by_type', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'content_type', content_source_type,
                'post_count', COUNT(*),
                'avg_engagement_rate', ROUND(AVG(engagement_rate), 4),
                'total_reach', SUM(reach)
            )), '[]'::jsonb)
            FROM instagram_posts
            WHERE status = 'published' AND created_at >= v_cutoff
            GROUP BY content_source_type
        )
    )
    INTO v_result
    FROM instagram_posts
    WHERE created_at >= v_cutoff;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_instagram_analytics IS 'Aggregate Instagram performance analytics over a configurable period';

-- ============================================================================
-- SEED: Platform settings for Instagram
-- ============================================================================

INSERT INTO public.platform_settings (setting_key, setting_value, category, description)
VALUES
    ('instagram_enabled', 'false', 'integration', 'Master switch for Instagram publishing pipeline'),
    ('instagram_posting_enabled', 'false', 'integration', 'Enable actual posting to Instagram (vs dry-run)'),
    ('instagram_ig_user_id', '', 'integration', 'Instagram Business Account ID from Graph API'),
    ('instagram_access_token', '', 'integration', 'Encrypted perpetual page access token for Instagram'),
    ('instagram_posts_per_day', '3', 'integration', 'Maximum feed posts per day'),
    ('instagram_posting_hours', '[9, 13, 18]', 'integration', 'UTC hours when posts are scheduled'),
    ('instagram_approval_required', 'true', 'integration', 'Require admin approval before posting'),
    ('instagram_caption_model', '', 'integration', 'Override model for caption generation (empty = default)'),
    ('instagram_scheduler_interval_seconds', '300', 'integration', 'Scheduler check interval in seconds'),
    ('instagram_content_mix', '{"agent": 3, "building": 2, "chronicle": 2}', 'integration', 'Weighted content type distribution')
ON CONFLICT (setting_key) DO NOTHING;
