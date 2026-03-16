--- 118: Grant starter tokens on clearance approval
--- New Architects receive 3 forge tokens so they can immediately create
--- their first simulation without waiting for a manual admin grant.

CREATE OR REPLACE FUNCTION public.fn_approve_forge_access(
    p_request_id uuid,
    p_admin_notes text DEFAULT NULL,
    p_reviewer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request record;
    v_user_email text;
    v_email_locale text;
    v_starter_tokens constant integer := 3;
    v_bundle_id uuid;
    v_balance_before integer;
    v_balance_after integer;
BEGIN
    -- Lock and validate the request
    SELECT * INTO v_request
    FROM public.forge_access_requests
    WHERE id = p_request_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already reviewed';
    END IF;

    -- Verify the user still exists before granting access
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_request.user_id) THEN
        RAISE EXCEPTION 'User has been deleted';
    END IF;

    -- Update request status
    UPDATE public.forge_access_requests
    SET status = 'approved',
        admin_notes = p_admin_notes,
        reviewed_by = p_reviewer_id,
        reviewed_at = now()
    WHERE id = p_request_id;

    -- Upsert wallet with new tier (trigger syncs is_architect)
    INSERT INTO public.user_wallets (user_id, account_tier)
    VALUES (v_request.user_id, v_request.requested_tier)
    ON CONFLICT (user_id)
    DO UPDATE SET account_tier = EXCLUDED.account_tier,
                  updated_at = now();

    -- ── Grant starter tokens (atomic, same pattern as fn_admin_grant_tokens) ──

    -- Get sentinel bundle ID
    SELECT id INTO v_bundle_id FROM public.token_bundles WHERE slug = 'admin-grant';

    -- Lock wallet row, read current balance
    SELECT forge_tokens INTO v_balance_before
    FROM public.user_wallets
    WHERE user_id = v_request.user_id
    FOR UPDATE;

    v_balance_after := v_balance_before + v_starter_tokens;

    UPDATE public.user_wallets
    SET forge_tokens = v_balance_after,
        updated_at = now()
    WHERE user_id = v_request.user_id;

    -- Auditable ledger entry
    INSERT INTO public.token_purchases
        (user_id, bundle_id, tokens_granted, price_cents,
         payment_method, payment_reference, balance_before, balance_after)
    VALUES
        (v_request.user_id, v_bundle_id, v_starter_tokens, 0,
         'admin_grant', 'clearance_welcome', v_balance_before, v_balance_after);

    -- Fetch user email + locale for notification
    SELECT u.email, np.email_locale
    INTO v_user_email, v_email_locale
    FROM auth.users u
    LEFT JOIN public.notification_preferences np ON np.user_id = u.id
    WHERE u.id = v_request.user_id;

    RETURN jsonb_build_object(
        'request_id', p_request_id,
        'user_id', v_request.user_id,
        'user_email', v_user_email,
        'email_locale', v_email_locale,
        'requested_tier', v_request.requested_tier,
        'status', 'approved',
        'tokens_granted', v_starter_tokens,
        'balance_after', v_balance_after
    );
END;
$$;

-- Lock down fn_approve_forge_access (same grants as migration 116)
REVOKE ALL ON FUNCTION public.fn_approve_forge_access(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_approve_forge_access(uuid, text, uuid) TO service_role;
