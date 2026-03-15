-- Fix admin_delete_user: ownership transfer + FK cleanup
--
-- Problem: the RPC only did DELETE FROM auth.users, which fails because
-- 20+ tables have FK references without ON DELETE CASCADE/SET NULL.
--
-- Additional: CREATE OR REPLACE fails with "cannot change return type"
-- because the existing function returns boolean but pg_proc disagrees.
-- Fix: DROP + CREATE instead of CREATE OR REPLACE.
--
-- Business rule: simulations owned by the deleted user transfer to the
-- platform admin account. All other user data is removed or nullified.

-- Step 1: Allow NULL on audit/reference columns that were NOT NULL
-- (idempotent — DROP NOT NULL on an already-nullable column is a no-op)
ALTER TABLE bot_players ALTER COLUMN created_by_id DROP NOT NULL;
ALTER TABLE chat_event_references ALTER COLUMN referenced_by DROP NOT NULL;
ALTER TABLE epoch_chat_messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE epoch_invitations ALTER COLUMN invited_by_id DROP NOT NULL;
ALTER TABLE game_epochs ALTER COLUMN created_by_id DROP NOT NULL;
ALTER TABLE simulation_invitations ALTER COLUMN invited_by_id DROP NOT NULL;
ALTER TABLE simulations ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE threshold_actions ALTER COLUMN executed_by DROP NOT NULL;

-- Step 2: Drop + recreate admin_delete_user
-- Using DROP + CREATE to sidestep the "cannot change return type" error.
DROP FUNCTION IF EXISTS public.admin_delete_user(uuid);

CREATE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id uuid;
BEGIN
    -- 1. Look up platform admin user ID
    SELECT u.id INTO v_admin_id
    FROM auth.users u
    WHERE u.email IN (
        SELECT jsonb_array_elements_text(ps.setting_value)
        FROM platform_settings ps
        WHERE ps.setting_key = 'platform_admin_emails'
    )
    LIMIT 1;

    -- 2. Transfer simulation ownership to admin
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'No platform admin found — check platform_settings.platform_admin_emails';
    END IF;
    UPDATE simulations SET owner_id = v_admin_id WHERE owner_id = p_user_id;

    -- 3. SET NULL on audit/reference columns (entities survive, author link cleared)
    UPDATE agents SET created_by_id = NULL WHERE created_by_id = p_user_id;
    UPDATE audit_log SET user_id = NULL WHERE user_id = p_user_id;
    UPDATE bot_players SET created_by_id = NULL WHERE created_by_id = p_user_id;
    UPDATE chat_event_references SET referenced_by = NULL WHERE referenced_by = p_user_id;
    UPDATE embassies SET created_by_id = NULL WHERE created_by_id = p_user_id;
    UPDATE epoch_chat_messages SET sender_id = NULL WHERE sender_id = p_user_id;
    UPDATE epoch_invitations SET invited_by_id = NULL WHERE invited_by_id = p_user_id;
    UPDATE epoch_invitations SET accepted_by_id = NULL WHERE accepted_by_id = p_user_id;
    UPDATE epoch_participants SET user_id = NULL WHERE user_id = p_user_id;
    UPDATE game_epochs SET created_by_id = NULL WHERE created_by_id = p_user_id;
    UPDATE news_scan_candidates SET reviewed_by_id = NULL WHERE reviewed_by_id = p_user_id;
    UPDATE platform_settings SET updated_by_id = NULL WHERE updated_by_id = p_user_id;
    UPDATE prompt_templates SET created_by_id = NULL WHERE created_by_id = p_user_id;
    UPDATE simulation_invitations SET invited_by_id = NULL WHERE invited_by_id = p_user_id;
    UPDATE simulation_members SET invited_by_id = NULL WHERE invited_by_id = p_user_id;
    UPDATE simulation_settings SET updated_by_id = NULL WHERE updated_by_id = p_user_id;
    UPDATE substrate_resonances SET created_by_id = NULL WHERE created_by_id = p_user_id;
    UPDATE threshold_actions SET executed_by = NULL WHERE executed_by = p_user_id;
    UPDATE zone_actions SET created_by_id = NULL WHERE created_by_id = p_user_id;

    -- 4. Delete user-owned records (meaningless without the user)
    DELETE FROM chat_conversations WHERE user_id = p_user_id;
    DELETE FROM feature_purchases WHERE user_id = p_user_id;

    -- 5. Delete the user (remaining ON DELETE CASCADE FKs handle:
    -- identities, sessions, mfa_factors, forge_drafts, forge_access_requests,
    -- notification_preferences, simulation_members, token_purchases,
    -- user_profiles, user_wallets)
    DELETE FROM auth.users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
END;
$$;

-- Step 3: Re-grant permissions
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO service_role;
