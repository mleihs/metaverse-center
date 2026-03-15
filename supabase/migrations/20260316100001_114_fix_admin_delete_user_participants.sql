-- Migration 114: Fix admin_delete_user — 3 production bugs
--
-- Bug 1: epoch_participants CHECK constraint (is_bot = true OR user_id IS NOT NULL)
--         blocks SET NULL for human participants → use DELETE instead
-- Bug 2: prevent_last_owner_removal trigger on simulation_members blocks cascade
--         when deleted user is sole owner → transfer ownership membership to admin
-- Bug 3: simulations.owner_id transferred but no simulation_members row for admin
--         → Bug 2 fix resolves this as side effect

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
    -- 1. Look up platform admin
    SELECT u.id INTO v_admin_id
    FROM auth.users u
    WHERE u.email IN (
        SELECT jsonb_array_elements_text(ps.setting_value)
        FROM platform_settings ps
        WHERE ps.setting_key = 'platform_admin_emails'
    )
    LIMIT 1;

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'No platform admin found — check platform_settings.platform_admin_emails';
    END IF;

    -- 2. Transfer simulation ownership to admin
    UPDATE simulations SET owner_id = v_admin_id WHERE owner_id = p_user_id;

    -- 3. Transfer sole-owner memberships to admin (prevent_last_owner_removal trigger)
    INSERT INTO simulation_members (user_id, simulation_id, member_role)
    SELECT v_admin_id, sm.simulation_id, 'owner'
    FROM simulation_members sm
    WHERE sm.user_id = p_user_id
      AND sm.member_role = 'owner'
      AND NOT EXISTS (
        SELECT 1 FROM simulation_members sm2
        WHERE sm2.simulation_id = sm.simulation_id
          AND sm2.member_role = 'owner'
          AND sm2.user_id != p_user_id
      )
    ON CONFLICT (user_id, simulation_id) DO UPDATE SET member_role = 'owner';

    -- 4. SET NULL on audit/reference columns (entities survive, author link cleared)
    UPDATE agents SET created_by_id = NULL WHERE created_by_id = p_user_id;
    UPDATE audit_log SET user_id = NULL WHERE user_id = p_user_id;
    UPDATE bot_players SET created_by_id = NULL WHERE created_by_id = p_user_id;
    UPDATE chat_event_references SET referenced_by = NULL WHERE referenced_by = p_user_id;
    UPDATE embassies SET created_by_id = NULL WHERE created_by_id = p_user_id;
    UPDATE epoch_chat_messages SET sender_id = NULL WHERE sender_id = p_user_id;
    UPDATE epoch_invitations SET invited_by_id = NULL WHERE invited_by_id = p_user_id;
    UPDATE epoch_invitations SET accepted_by_id = NULL WHERE accepted_by_id = p_user_id;
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

    -- 5. DELETE records that are meaningless without the user
    DELETE FROM epoch_participants WHERE user_id = p_user_id;  -- CHECK constraint blocks SET NULL
    DELETE FROM chat_conversations WHERE user_id = p_user_id;
    DELETE FROM feature_purchases WHERE user_id = p_user_id;

    -- 6. Delete the auth.users row (remaining ON DELETE CASCADE FKs handle:
    -- identities, sessions, mfa_factors, one_time_tokens, oauth_authorizations,
    -- oauth_consents, forge_drafts, forge_access_requests, notification_preferences,
    -- simulation_members, token_purchases, user_profiles, user_wallets)
    DELETE FROM auth.users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO service_role;
