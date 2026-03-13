-- Migration 101: Token store — bundles, purchases, and atomic purchase RPC
-- Implements the mock-monetization layer for Forge tokens.

-- ─── A. Token Bundles (product catalog) ──────────────────────────────

CREATE TABLE public.token_bundles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text UNIQUE NOT NULL,
    display_name text NOT NULL,
    tokens integer NOT NULL CHECK (tokens > 0),
    price_cents integer NOT NULL CHECK (price_cents > 0),
    savings_pct smallint NOT NULL DEFAULT 0 CHECK (savings_pct BETWEEN 0 AND 100),
    sort_order smallint NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now()
);

INSERT INTO public.token_bundles (slug, display_name, tokens, price_cents, savings_pct, sort_order) VALUES
  ('field-sample',        'Field Sample',        1,   399,  0, 1),
  ('surveyors-kit',       'Surveyor''s Kit',      3,   999, 17, 2),
  ('cartographers-cache', 'Cartographer''s Cache', 7, 1999, 28, 3),
  ('architects-reserve',  'Architect''s Reserve', 15, 3499, 42, 4),
  ('founders-vault',      'Founder''s Vault',     25, 4999, 50, 5);

ALTER TABLE public.token_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active bundles"
    ON public.token_bundles FOR SELECT USING (is_active = true);

CREATE POLICY "Admins manage bundles"
    ON public.token_bundles FOR ALL USING (is_platform_admin());


-- ─── B. Token Purchases (transaction ledger) ────────────────────────

CREATE TABLE public.token_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bundle_id uuid NOT NULL REFERENCES public.token_bundles(id),
    tokens_granted integer NOT NULL CHECK (tokens_granted > 0),
    price_cents integer NOT NULL,
    payment_method text NOT NULL DEFAULT 'mock'
        CHECK (payment_method IN ('mock', 'stripe', 'admin_grant', 'subscription')),
    payment_reference text,
    balance_before integer NOT NULL,
    balance_after integer NOT NULL,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.token_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own purchases"
    ON public.token_purchases FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins read all purchases"
    ON public.token_purchases FOR SELECT USING (is_platform_admin());

CREATE INDEX idx_token_purchases_user ON public.token_purchases(user_id, created_at DESC);


-- ─── C. Atomic purchase RPC ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_purchase_tokens(
    p_bundle_slug text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_bundle record;
    v_balance_before integer;
    v_balance_after integer;
    v_purchase_id uuid;
BEGIN
    -- 1. Fetch bundle
    SELECT * INTO v_bundle FROM public.token_bundles
    WHERE slug = p_bundle_slug AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bundle not found or inactive: %', p_bundle_slug;
    END IF;

    -- 2. Get current balance (lock wallet row)
    SELECT forge_tokens INTO v_balance_before
    FROM public.user_wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.user_wallets (user_id, forge_tokens, is_architect)
        VALUES (v_user_id, 0, true)
        ON CONFLICT (user_id) DO NOTHING;
        v_balance_before := 0;
    END IF;

    -- 3. Credit tokens
    v_balance_after := v_balance_before + v_bundle.tokens;

    UPDATE public.user_wallets
    SET forge_tokens = v_balance_after,
        updated_at = now()
    WHERE user_id = v_user_id;

    -- 4. Record purchase
    INSERT INTO public.token_purchases
        (user_id, bundle_id, tokens_granted, price_cents, payment_method,
         balance_before, balance_after)
    VALUES
        (v_user_id, v_bundle.id, v_bundle.tokens, v_bundle.price_cents, 'mock',
         v_balance_before, v_balance_after)
    RETURNING id INTO v_purchase_id;

    -- 5. Return receipt
    RETURN jsonb_build_object(
        'purchase_id', v_purchase_id,
        'bundle_slug', v_bundle.slug,
        'tokens_granted', v_bundle.tokens,
        'balance_before', v_balance_before,
        'balance_after', v_balance_after,
        'price_cents', v_bundle.price_cents
    );
END;
$$;

COMMENT ON FUNCTION public.fn_purchase_tokens IS
    'Mock token purchase: validates bundle, credits tokens, records ledger entry. '
    'Replace payment_method check with Stripe webhook verification for production.';
