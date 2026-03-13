-- Migration 102: Token admin tools — grant RPC, economy stats view, sentinel bundle
-- Adds admin capabilities for managing the token economy (bundles, grants, analytics).

-- ─── A. Relax price_cents constraint to allow sentinel bundle (price=0) ──

ALTER TABLE public.token_bundles DROP CONSTRAINT token_bundles_price_cents_check;
ALTER TABLE public.token_bundles ADD CONSTRAINT token_bundles_price_cents_check CHECK (price_cents >= 0);

INSERT INTO public.token_bundles (slug, display_name, tokens, price_cents, savings_pct, sort_order, is_active)
VALUES ('admin-grant', 'Admin Grant', 1, 0, 0, 99, false)
ON CONFLICT (slug) DO NOTHING;

-- ─── B. fn_admin_grant_tokens RPC ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_admin_grant_tokens(
    p_user_id uuid,
    p_tokens integer,
    p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_bundle_id uuid;
    v_balance_before integer;
    v_balance_after integer;
    v_purchase_id uuid;
BEGIN
    IF p_tokens <= 0 OR p_tokens > 1000 THEN
        RAISE EXCEPTION 'Token grant must be between 1 and 1000';
    END IF;

    -- Get sentinel bundle ID
    SELECT id INTO v_bundle_id FROM public.token_bundles WHERE slug = 'admin-grant';

    -- Lock wallet row
    SELECT forge_tokens INTO v_balance_before
    FROM public.user_wallets WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.user_wallets (user_id, forge_tokens, is_architect)
        VALUES (p_user_id, 0, true) ON CONFLICT (user_id) DO NOTHING;
        v_balance_before := 0;
    END IF;

    v_balance_after := v_balance_before + p_tokens;

    UPDATE public.user_wallets
    SET forge_tokens = v_balance_after, updated_at = now()
    WHERE user_id = p_user_id;

    INSERT INTO public.token_purchases
        (user_id, bundle_id, tokens_granted, price_cents, payment_method, payment_reference,
         balance_before, balance_after)
    VALUES
        (p_user_id, v_bundle_id, p_tokens, 0, 'admin_grant', p_reason,
         v_balance_before, v_balance_after)
    RETURNING id INTO v_purchase_id;

    RETURN jsonb_build_object(
        'purchase_id', v_purchase_id,
        'tokens_granted', p_tokens,
        'balance_before', v_balance_before,
        'balance_after', v_balance_after,
        'reason', p_reason
    );
END;
$$;

COMMENT ON FUNCTION public.fn_admin_grant_tokens IS
    'Admin token grant: validates amount (1-1000), credits tokens, records auditable ledger entry with payment_method=admin_grant.';

-- ─── C. token_economy_stats view ─────────────────────────────────────

CREATE OR REPLACE VIEW public.token_economy_stats AS
SELECT
    (SELECT count(*) FROM token_purchases)::int AS total_purchases,
    (SELECT count(*) FROM token_purchases WHERE payment_method = 'mock')::int AS mock_purchases,
    (SELECT count(*) FROM token_purchases WHERE payment_method = 'admin_grant')::int AS admin_grants,
    (SELECT coalesce(sum(price_cents), 0) FROM token_purchases WHERE payment_method = 'mock')::bigint AS total_revenue_cents,
    (SELECT coalesce(sum(tokens_granted), 0) FROM token_purchases)::bigint AS total_tokens_granted,
    (SELECT coalesce(sum(forge_tokens), 0) FROM user_wallets)::bigint AS tokens_in_circulation,
    (SELECT count(DISTINCT user_id) FROM token_purchases)::int AS unique_buyers,
    (SELECT count(*) FROM token_bundles WHERE is_active = true)::int AS active_bundles;
