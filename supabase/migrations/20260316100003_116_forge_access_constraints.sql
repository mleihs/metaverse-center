--- 116: Add length constraints and user existence check to forge access system

-- Length constraints on text fields
ALTER TABLE public.forge_access_requests
  ADD CONSTRAINT check_message_length CHECK (message IS NULL OR length(message) <= 2000);
ALTER TABLE public.forge_access_requests
  ADD CONSTRAINT check_admin_notes_length CHECK (admin_notes IS NULL OR length(admin_notes) <= 2000);

-- Recreate fn_approve_forge_access with user existence check
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
        'status', 'approved'
    );
END;
$$;

-- Lock down fn_approve_forge_access
REVOKE ALL ON FUNCTION public.fn_approve_forge_access(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_approve_forge_access(uuid, text, uuid) TO service_role;

-- Recreate fn_reject_forge_access (unchanged logic, re-applied for consistency)
CREATE OR REPLACE FUNCTION public.fn_reject_forge_access(
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
BEGIN
    SELECT * INTO v_request
    FROM public.forge_access_requests
    WHERE id = p_request_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already reviewed';
    END IF;

    UPDATE public.forge_access_requests
    SET status = 'rejected',
        admin_notes = p_admin_notes,
        reviewed_by = p_reviewer_id,
        reviewed_at = now()
    WHERE id = p_request_id;

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
        'status', 'rejected'
    );
END;
$$;

-- Lock down fn_reject_forge_access
REVOKE ALL ON FUNCTION public.fn_reject_forge_access(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reject_forge_access(uuid, text, uuid) TO service_role;
