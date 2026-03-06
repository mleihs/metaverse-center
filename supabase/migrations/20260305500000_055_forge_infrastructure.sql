-- 055: Simulation Forge Infrastructure
-- Creates staging tables for worldbuilding drafts, user economic quotas, and BYOK support.

-- 0. Admin helper (SECURITY DEFINER — avoids hardcoding emails in RLS)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
          AND email = current_setting('app.platform_admin_email', true)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1. User Wallets (Platform-wide metadata + BYOK encrypted keys)
CREATE TABLE IF NOT EXISTS public.user_wallets (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    forge_tokens integer NOT NULL DEFAULT 0 CHECK (forge_tokens >= 0),
    is_architect boolean NOT NULL DEFAULT false,
    encrypted_openrouter_key text,
    encrypted_replicate_key text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS for user_wallets
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallet"
    ON public.user_wallets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all wallets"
    ON public.user_wallets FOR ALL
    USING (is_platform_admin());

-- 2. Forge Drafts (Staging table for WIP simulations)
CREATE TABLE IF NOT EXISTS public.forge_drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_phase text NOT NULL DEFAULT 'astrolabe'
        CHECK (current_phase IN ('astrolabe', 'drafting', 'darkroom', 'ignition', 'completed', 'failed')),

    -- Conceptual Seed
    seed_prompt text,
    philosophical_anchor jsonb DEFAULT '{}'::jsonb,
    research_context jsonb DEFAULT '{}'::jsonb,

    -- The Blueprint (Lore/Entities)
    taxonomies jsonb DEFAULT '{}'::jsonb,
    geography jsonb DEFAULT '{}'::jsonb,
    agents jsonb DEFAULT '[]'::jsonb,
    buildings jsonb DEFAULT '[]'::jsonb,

    -- AI Calibration
    ai_settings jsonb DEFAULT '{}'::jsonb,

    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'processing', 'completed', 'failed')),

    error_log text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS for forge_drafts
ALTER TABLE public.forge_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Architects can manage their own drafts"
    ON public.forge_drafts FOR ALL
    USING (
        auth.uid() = user_id
        OR is_platform_admin()
    );

-- 3. Quota Enforcement Trigger
CREATE OR REPLACE FUNCTION public.fn_enforce_forge_quota()
RETURNS TRIGGER AS $$
BEGIN
    -- Only check when moving to ignition status
    IF NEW.current_phase = 'ignition' AND OLD.current_phase != 'ignition' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.user_wallets
            WHERE user_id = NEW.user_id AND forge_tokens > 0
        ) THEN
            RAISE EXCEPTION 'Insufficient forge tokens to materialize this simulation.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_forge_quota
    BEFORE UPDATE ON public.forge_drafts
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_enforce_forge_quota();

-- 4. Initial Materialize Function (Skeleton — fleshed out in 056)
CREATE OR REPLACE FUNCTION public.fn_materialize_shard(p_draft_id uuid)
RETURNS uuid AS $$
DECLARE
    v_sim_id uuid;
BEGIN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. Auto-update timestamps
CREATE TRIGGER trg_user_wallets_updated_at BEFORE UPDATE ON public.user_wallets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_forge_drafts_updated_at BEFORE UPDATE ON public.forge_drafts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Backfill: Grant 3 tokens to existing admin
INSERT INTO public.user_wallets (user_id, forge_tokens, is_architect)
VALUES ('00000000-0000-0000-0000-000000000001', 3, true)
ON CONFLICT (user_id) DO UPDATE SET forge_tokens = 3, is_architect = true;
