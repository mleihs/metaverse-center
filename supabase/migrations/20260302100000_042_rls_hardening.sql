-- Migration 042: RLS Policy Hardening
--
-- Fixes overly permissive policies found during codebase audit v3:
-- 1. epoch_scores_update: any auth user could modify any scores
-- 2. epoch_invitations_accept: any auth user could update any invitation
-- 3. epoch_invitations_anon_select: exposed all invitation emails to anon
-- 4. bot_decision_log_anon_select: exposed bot strategies during active play

-- ============================================================
-- 1. epoch_scores — restrict UPDATE to epoch creator only
-- ============================================================

DROP POLICY IF EXISTS epoch_scores_update ON public.epoch_scores;

CREATE POLICY epoch_scores_update ON public.epoch_scores
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.game_epochs
            WHERE id = epoch_scores.epoch_id
            AND created_by_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.game_epochs
            WHERE id = epoch_scores.epoch_id
            AND created_by_id = auth.uid()
        )
    );

-- ============================================================
-- 2. epoch_invitations — restrict accept to invited email only
-- ============================================================

DROP POLICY IF EXISTS epoch_invitations_accept ON public.epoch_invitations;

CREATE POLICY epoch_invitations_accept ON public.epoch_invitations
    FOR UPDATE TO authenticated
    USING (
        invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR epoch_id IN (
            SELECT id FROM public.game_epochs WHERE created_by_id = auth.uid()
        )
    )
    WITH CHECK (
        invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR epoch_id IN (
            SELECT id FROM public.game_epochs WHERE created_by_id = auth.uid()
        )
    );

-- ============================================================
-- 3. epoch_invitations anon — restrict to pending + no PII
-- ============================================================

DROP POLICY IF EXISTS epoch_invitations_anon_select ON public.epoch_invitations;

-- Anon can only see pending invitations (for token validation).
-- The public API endpoint already scopes by token, but this policy
-- prevents bulk enumeration of all invitations.
CREATE POLICY epoch_invitations_anon_select ON public.epoch_invitations
    FOR SELECT TO anon
    USING (status = 'pending');

-- ============================================================
-- 4. bot_decision_log — restrict anon to completed epochs only
-- ============================================================

DROP POLICY IF EXISTS bot_decision_log_anon_select ON public.bot_decision_log;

CREATE POLICY bot_decision_log_anon_select ON public.bot_decision_log
    FOR SELECT TO anon
    USING (
        EXISTS (
            SELECT 1 FROM public.game_epochs
            WHERE id = bot_decision_log.epoch_id
            AND status = 'completed'
        )
    );
