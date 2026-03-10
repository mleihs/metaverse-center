--- 093: Forge Access Requests + Account Tier System
--- Adds account_tier to user_wallets and forge_access_requests table
--- for the Bureau clearance level upgrade flow.

-- 1. Add account_tier to user_wallets
ALTER TABLE public.user_wallets
  ADD COLUMN IF NOT EXISTS account_tier text NOT NULL DEFAULT 'observer'
  CHECK (account_tier IN ('observer', 'architect', 'director'));

-- Backfill from existing is_architect
UPDATE public.user_wallets SET account_tier = 'architect' WHERE is_architect = true;

-- Keep is_architect in sync via trigger (backward compat)
CREATE OR REPLACE FUNCTION public.fn_sync_architect_flag()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_architect := (NEW.account_tier != 'observer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_architect_flag
  BEFORE INSERT OR UPDATE OF account_tier ON public.user_wallets
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_architect_flag();


-- 2. Forge Access Requests table
CREATE TABLE public.forge_access_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    requested_tier text NOT NULL DEFAULT 'architect'
        CHECK (requested_tier IN ('architect', 'director')),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    message text,
    admin_notes text,
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz
);

-- Only one pending request per user
CREATE UNIQUE INDEX idx_forge_access_one_pending
    ON public.forge_access_requests (user_id) WHERE status = 'pending';

-- Fast admin queries
CREATE INDEX idx_forge_access_pending
    ON public.forge_access_requests (status) WHERE status = 'pending';

-- RLS
ALTER TABLE public.forge_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own requests"
    ON public.forge_access_requests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users create own requests"
    ON public.forge_access_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all"
    ON public.forge_access_requests FOR SELECT
    USING (is_platform_admin());

CREATE POLICY "Admins update all"
    ON public.forge_access_requests FOR UPDATE
    USING (is_platform_admin());


-- 3. Postgres function: approve request + upgrade wallet in one transaction
CREATE OR REPLACE FUNCTION public.fn_approve_forge_access(
    p_request_id uuid,
    p_admin_notes text DEFAULT NULL,
    p_reviewer_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Postgres function: reject request
CREATE OR REPLACE FUNCTION public.fn_reject_forge_access(
    p_request_id uuid,
    p_admin_notes text DEFAULT NULL,
    p_reviewer_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. View for admin: pending requests with user emails
CREATE OR REPLACE VIEW public.v_pending_forge_requests AS
SELECT
    far.id,
    far.user_id,
    u.email AS user_email,
    far.requested_tier,
    far.status,
    far.message,
    far.admin_notes,
    far.reviewed_by,
    far.created_at,
    far.reviewed_at
FROM public.forge_access_requests far
JOIN auth.users u ON u.id = far.user_id
WHERE far.status = 'pending'
ORDER BY far.created_at ASC;
