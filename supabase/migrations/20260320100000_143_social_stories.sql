-- Migration 143: Social Stories — Resonance → Instagram Story Pipeline
--
-- Creates the social_stories table for tracking Story sequences generated
-- from substrate resonances. Each resonance impact produces a 3-5 Story
-- sequence posted over 1-2 hours via the Bureau's emergency broadcast channel.

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE public.social_stories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    resonance_id uuid REFERENCES public.substrate_resonances(id) ON DELETE SET NULL,
    simulation_id uuid REFERENCES public.simulations(id) ON DELETE SET NULL,

    -- Story metadata
    story_type text NOT NULL,           -- detection, classification, impact, advisory, subsiding
    sequence_index integer NOT NULL DEFAULT 0,

    -- Content
    image_url text,                     -- composed 1080×1920 story image in storage
    caption text,                       -- alt text / accessibility description
    narrative_closing text,             -- AI-generated poetic closing line

    -- Platform tracking
    ig_story_id text,                   -- Instagram media ID after publish
    ig_posted_at timestamptz,

    -- Scheduling
    status text NOT NULL DEFAULT 'pending',  -- pending, composing, ready, publishing, published, failed, skipped
    scheduled_at timestamptz NOT NULL,
    published_at timestamptz,
    failure_reason text,
    retry_count integer NOT NULL DEFAULT 0,

    -- Resonance context (denormalized for fast rendering)
    archetype text,
    magnitude numeric(4,2),
    effective_magnitude numeric(4,2),

    -- Standard
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.social_stories IS 'Instagram Story sequences generated from substrate resonance impacts.';

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_social_stories_resonance ON public.social_stories(resonance_id);
CREATE INDEX idx_social_stories_status ON public.social_stories(status);
CREATE INDEX idx_social_stories_scheduled ON public.social_stories(scheduled_at)
    WHERE status IN ('pending', 'composing', 'ready');
CREATE INDEX idx_social_stories_published ON public.social_stories(published_at DESC)
    WHERE status = 'published';

-- ── Updated-at trigger ───────────────────────────────────────────────────────

CREATE TRIGGER trg_social_stories_updated_at
    BEFORE UPDATE ON public.social_stories
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.social_stories ENABLE ROW LEVEL SECURITY;

-- Platform admins only (service_role bypasses for scheduler)
CREATE POLICY social_stories_admin_all ON public.social_stories
    FOR ALL USING (is_platform_admin());

-- ── Platform Settings ────────────────────────────────────────────────────────

INSERT INTO public.platform_settings (id, setting_key, setting_value, description) VALUES
    (gen_random_uuid(), 'resonance_stories_enabled',                '"false"',  'Master switch for resonance → Instagram Story pipeline'),
    (gen_random_uuid(), 'resonance_stories_auto_magnitude',         '0.5',      'Min magnitude for automatic Story creation (below = admin review)'),
    (gen_random_uuid(), 'resonance_stories_max_sequences_per_day',  '1',        'Max full Story sequences per day'),
    (gen_random_uuid(), 'resonance_stories_cooldown_hours',         '6',        'Min hours between last Story of one sequence and first of next'),
    (gen_random_uuid(), 'resonance_stories_archetype_dedup_hours',  '48',       'Same archetype cooldown — second resonance gets simplified update'),
    (gen_random_uuid(), 'resonance_stories_catastrophic_threshold', '0.8',      'Magnitude that bypasses daily budget and cooldown'),
    (gen_random_uuid(), 'resonance_stories_advisory_in_epochs_only', '"true"',  'Only post operative advisory Stories during active epochs'),
    (gen_random_uuid(), 'resonance_stories_impact_threshold',       '0.4',      'Min effective_magnitude for a simulation to get its own impact Story'),
    (gen_random_uuid(), 'resonance_stories_feed_post_reserve',      '10',       'Min feed post slots to reserve from shared Instagram API budget')
ON CONFLICT (setting_key) DO NOTHING;

-- ── Prompt Template ────────────────────────────────────────────────────────

INSERT INTO public.prompt_templates (
    template_type,
    prompt_category,
    locale,
    template_name,
    prompt_content,
    system_prompt,
    variables,
    temperature,
    max_tokens,
    is_system_default
) VALUES (
    'story_closing_line',
    'generation',
    'en',
    'Resonance Story Closing Line',
    E'You are a Bureau filing clerk witnessing a {archetype_name} resonance affecting {simulation_name}.\n\nArchetype meaning: {archetype_description}\n\nSimulation context: {simulation_description}\n\nWrite ONE sentence (max 15 words) that captures the emotional resonance of this event in the context of the simulation world.\n\nTone: compressed, poetic, unsettling. No exclamation marks. No questions. Just a single declarative image.\n\nRespond with ONLY the sentence, no quotes, no explanation.',
    'You are a poetic voice observing reality fracture. You write in fragments — compressed, haunting, precise. Every word earns its place.',
    '[{"name": "archetype_name"}, {"name": "archetype_description"}, {"name": "simulation_name"}, {"name": "simulation_description"}]',
    0.9,
    60,
    true
) ON CONFLICT DO NOTHING;
