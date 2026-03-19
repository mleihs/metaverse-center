-- ============================================================================
-- Migration 139: Cipher ARG System
--
-- Tables: cipher_redemptions, cipher_attempts
-- RPCs:   fn_generate_cipher_code, fn_redeem_cipher_code
-- Seeds:  Platform settings for cipher configuration
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE public.cipher_redemptions (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    instagram_post_id uuid      NOT NULL REFERENCES public.instagram_posts(id) ON DELETE CASCADE,
    user_id         uuid        REFERENCES auth.users(id),
    redeemed_at     timestamptz NOT NULL DEFAULT now(),
    ip_hash         text,       -- SHA256 of IP for rate limiting (no raw IPs)
    reward_type     text        NOT NULL,
    reward_data     jsonb       NOT NULL DEFAULT '{}',
    UNIQUE(instagram_post_id, user_id)  -- one redemption per authenticated user per post
);

-- NULL user_id rows bypass the UNIQUE constraint above; enforce uniqueness
-- for anonymous redemptions by (post, ip_hash) instead.
CREATE UNIQUE INDEX idx_cipher_redemptions_anon
    ON public.cipher_redemptions (instagram_post_id, ip_hash)
    WHERE user_id IS NULL;

-- Rate-limit tracking (counts all attempts, not just successes)
CREATE TABLE public.cipher_attempts (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_hash      text        NOT NULL,
    attempted_at timestamptz NOT NULL DEFAULT now(),
    code_entered text        NOT NULL,
    success      boolean     NOT NULL DEFAULT false
);

CREATE INDEX idx_cipher_attempts_ip_time
    ON public.cipher_attempts (ip_hash, attempted_at);


-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.cipher_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cipher_attempts    ENABLE ROW LEVEL SECURITY;

-- Service role — full access
CREATE POLICY "service_role_all" ON public.cipher_redemptions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON public.cipher_attempts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read their own redemptions
CREATE POLICY "users_read_own_redemptions" ON public.cipher_redemptions
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());


-- ── fn_generate_cipher_code ─────────────────────────────────────────────────
-- Deterministic Bureau-themed code from a seed string.
-- Returns: "DISPATCH-A3F2" | "BUREAU-7X9K2F" | "CLASSIFIED-A3F2B9C8"

CREATE OR REPLACE FUNCTION public.fn_generate_cipher_code(
    p_difficulty text DEFAULT 'medium',
    p_seed       text DEFAULT ''
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_hash   text;
    v_prefix text;
    v_length int;
BEGIN
    v_hash := md5(p_seed || 'bureau-cipher-v1');

    CASE p_difficulty
        WHEN 'easy' THEN
            v_prefix := 'DISPATCH';
            v_length := 4;
        WHEN 'hard' THEN
            v_prefix := 'CLASSIFIED';
            v_length := 8;
        ELSE -- medium (default)
            v_prefix := 'BUREAU';
            v_length := 6;
    END CASE;

    RETURN v_prefix || '-' || upper(substring(v_hash FROM 1 FOR v_length));
END;
$$;


-- ── fn_redeem_cipher_code ───────────────────────────────────────────────────
-- Atomic validation: rate limit → lookup → deduplicate → redeem.
-- All logic in Postgres to prevent race conditions.

CREATE OR REPLACE FUNCTION public.fn_redeem_cipher_code(
    p_code    text,
    p_user_id uuid DEFAULT NULL,
    p_ip_hash text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_post          record;
    v_existing_id   uuid;
    v_rate_count    int;
    v_max_attempts  int;
    v_redemption_id uuid;
    v_reward_type   text;
    v_reward_data   jsonb;
    v_snapshot       jsonb;
BEGIN
    -- ── Configurable rate limit ────────────────────────────────────────
    SELECT (setting_value #>> '{}')::int INTO v_max_attempts
    FROM public.platform_settings
    WHERE setting_key = 'instagram_cipher_max_attempts_per_hour';

    v_max_attempts := COALESCE(v_max_attempts, 10);

    SELECT count(*) INTO v_rate_count
    FROM public.cipher_attempts
    WHERE ip_hash = p_ip_hash
      AND attempted_at > now() - interval '1 hour';

    IF v_rate_count >= v_max_attempts THEN
        INSERT INTO public.cipher_attempts (ip_hash, code_entered, success)
        VALUES (p_ip_hash, left(p_code, 50), false);

        RETURN jsonb_build_object(
            'success', false,
            'error_code',   'rate_limited',
            'message', 'Too many attempts. Try again later.',
            'retry_after_seconds', 3600
        );
    END IF;

    -- ── Look up published post with this code ─────────────────────────
    SELECT id, simulation_id, content_source_type, content_source_id,
           content_source_snapshot
    INTO v_post
    FROM public.instagram_posts
    WHERE upper(unlock_code) = upper(p_code)
      AND status = 'published'
    LIMIT 1;

    IF v_post IS NULL THEN
        INSERT INTO public.cipher_attempts (ip_hash, code_entered, success)
        VALUES (p_ip_hash, left(p_code, 50), false);

        RETURN jsonb_build_object(
            'success',            false,
            'error_code',              'invalid_code',
            'message',            'Invalid cipher code.',
            'attempts_remaining', greatest(v_max_attempts - v_rate_count - 1, 0)
        );
    END IF;

    -- ── Deduplication ─────────────────────────────────────────────────
    IF p_user_id IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM public.cipher_redemptions
        WHERE instagram_post_id = v_post.id
          AND user_id = p_user_id;
    ELSE
        SELECT id INTO v_existing_id
        FROM public.cipher_redemptions
        WHERE instagram_post_id = v_post.id
          AND ip_hash = p_ip_hash
          AND user_id IS NULL;
    END IF;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code',   'already_redeemed',
            'message', 'You have already redeemed this cipher.'
        );
    END IF;

    -- ── Determine reward ──────────────────────────────────────────────
    SELECT setting_value #>> '{}' INTO v_reward_type
    FROM public.platform_settings
    WHERE setting_key = 'instagram_cipher_reward_type';

    v_reward_type := COALESCE(v_reward_type, 'lore_fragment');

    -- Parse snapshot (may be text or jsonb)
    BEGIN
        v_snapshot := v_post.content_source_snapshot::jsonb;
    EXCEPTION WHEN OTHERS THEN
        v_snapshot := '{}'::jsonb;
    END;

    v_reward_data := jsonb_build_object(
        'type',          v_reward_type,
        'source_type',   v_post.content_source_type,
        'source_id',     v_post.content_source_id,
        'simulation_id', v_post.simulation_id,
        'snapshot',      v_snapshot
    );

    -- ── Insert redemption ─────────────────────────────────────────────
    INSERT INTO public.cipher_redemptions (
        instagram_post_id, user_id, ip_hash, reward_type, reward_data
    ) VALUES (
        v_post.id, p_user_id, p_ip_hash, v_reward_type, v_reward_data
    )
    RETURNING id INTO v_redemption_id;

    -- Record successful attempt
    INSERT INTO public.cipher_attempts (ip_hash, code_entered, success)
    VALUES (p_ip_hash, left(p_code, 50), true);

    RETURN jsonb_build_object(
        'success',       true,
        'redemption_id', v_redemption_id,
        'reward_type',   v_reward_type,
        'reward_data',   v_reward_data
    );
END;
$$;


-- ── Platform Settings ───────────────────────────────────────────────────────

INSERT INTO public.platform_settings (setting_key, setting_value, description) VALUES
    ('instagram_cipher_enabled',              '"false"',          'Master switch for cipher ARG system'),
    ('instagram_cipher_difficulty',           '"medium"',         'Cipher difficulty: easy, medium, hard'),
    ('instagram_cipher_hint_format',          '"footer"',         'Hint format: footer, steganographic, caption'),
    ('instagram_cipher_reward_type',          '"lore_fragment"',  'Default reward: lore_fragment, agent_dossier, bureau_commendation'),
    ('instagram_cipher_max_attempts_per_hour', '10',              'Max cipher attempts per IP per hour')
ON CONFLICT (setting_key) DO NOTHING;
