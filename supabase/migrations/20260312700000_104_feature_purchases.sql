-- 104: Feature Purchase Ledger
-- Generic system for consumable feature purchases: Darkroom Pass, Classified
-- Dossier, Recruitment Office, Chronicle Printing Press.
-- Atomic token deduction via RPC, per-entity image regen tracking.

-- A. Feature purchase ledger
CREATE TABLE public.feature_purchases (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
    feature_type text NOT NULL,
    token_cost integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending',
    config jsonb DEFAULT '{}'::jsonb,
    result jsonb DEFAULT '{}'::jsonb,
    regen_budget_remaining integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    CONSTRAINT feature_purchases_type_check CHECK (
        feature_type IN ('darkroom_pass', 'classified_dossier', 'recruitment', 'chronicle_export')
    ),
    CONSTRAINT feature_purchases_status_check CHECK (
        status IN ('pending', 'processing', 'completed', 'failed', 'refunded')
    )
);

CREATE INDEX idx_feature_purchases_user ON feature_purchases(user_id);
CREATE INDEX idx_feature_purchases_sim ON feature_purchases(simulation_id);
CREATE INDEX idx_feature_purchases_type_status ON feature_purchases(feature_type, status);

-- RLS
ALTER TABLE public.feature_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own purchases"
    ON feature_purchases FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all feature purchases"
    ON feature_purchases FOR ALL
    USING (is_platform_admin());

-- B. Atomic feature purchase RPC
CREATE OR REPLACE FUNCTION public.fn_purchase_feature(
    p_user_id uuid,
    p_simulation_id uuid,
    p_feature_type text,
    p_token_cost integer,
    p_config jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_balance integer;
    v_purchase_id uuid;
    v_is_admin boolean;
    v_has_bypass boolean;
BEGIN
    -- Validate feature type
    IF p_feature_type NOT IN ('darkroom_pass', 'classified_dossier', 'recruitment', 'chronicle_export') THEN
        RAISE EXCEPTION 'Invalid feature type: %', p_feature_type;
    END IF;

    -- Validate simulation exists
    IF NOT EXISTS (SELECT 1 FROM simulations WHERE id = p_simulation_id) THEN
        RAISE EXCEPTION 'Simulation not found.';
    END IF;

    v_is_admin := is_platform_admin();
    v_has_bypass := fn_user_has_byok_bypass(p_user_id);

    -- Deduct tokens (admin and BYOK bypass skip)
    IF NOT v_is_admin AND NOT v_has_bypass THEN
        SELECT forge_tokens INTO v_balance
        FROM user_wallets WHERE user_id = p_user_id FOR UPDATE;

        IF v_balance IS NULL OR v_balance < p_token_cost THEN
            RAISE EXCEPTION 'Insufficient tokens. Required: %, available: %',
                p_token_cost, COALESCE(v_balance, 0);
        END IF;

        UPDATE user_wallets
        SET forge_tokens = forge_tokens - p_token_cost, updated_at = now()
        WHERE user_id = p_user_id;
    END IF;

    -- Create purchase record
    INSERT INTO feature_purchases (
        user_id, simulation_id, feature_type, token_cost, config, status,
        regen_budget_remaining
    )
    VALUES (
        p_user_id, p_simulation_id, p_feature_type,
        CASE WHEN v_is_admin OR v_has_bypass THEN 0 ELSE p_token_cost END,
        p_config, 'processing',
        CASE WHEN p_feature_type = 'darkroom_pass'
             THEN COALESCE((p_config->>'regen_budget')::integer, 10)
             ELSE 0
        END
    )
    RETURNING id INTO v_purchase_id;

    RETURN v_purchase_id;
END;
$$;

-- C. Refund feature purchase RPC (returns tokens on failure)
CREATE OR REPLACE FUNCTION public.fn_refund_feature(p_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_purchase record;
BEGIN
    SELECT * INTO v_purchase FROM feature_purchases
    WHERE id = p_purchase_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase not found.';
    END IF;

    IF v_purchase.status NOT IN ('processing', 'failed') THEN
        RAISE EXCEPTION 'Cannot refund purchase in status: %', v_purchase.status;
    END IF;

    -- Refund tokens (only if tokens were actually deducted)
    IF v_purchase.token_cost > 0 THEN
        UPDATE user_wallets
        SET forge_tokens = forge_tokens + v_purchase.token_cost, updated_at = now()
        WHERE user_id = v_purchase.user_id;
    END IF;

    UPDATE feature_purchases
    SET status = 'refunded', completed_at = now()
    WHERE id = p_purchase_id;
END;
$$;

-- D. Decrement darkroom regen budget RPC
CREATE OR REPLACE FUNCTION public.fn_darkroom_use_regen(p_purchase_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_remaining integer;
BEGIN
    UPDATE feature_purchases
    SET regen_budget_remaining = regen_budget_remaining - 1
    WHERE id = p_purchase_id
      AND feature_type = 'darkroom_pass'
      AND status = 'completed'
      AND regen_budget_remaining > 0
    RETURNING regen_budget_remaining INTO v_remaining;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active Darkroom pass with remaining regenerations.';
    END IF;

    RETURN v_remaining;
END;
$$;
