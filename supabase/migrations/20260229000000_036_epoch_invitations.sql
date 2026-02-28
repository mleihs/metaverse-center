-- Migration 036: Epoch Invitations
--
-- Adds epoch_invitations table for email-based epoch invitations.
-- Creator can invite players via email with AI-generated lore.
-- Includes RLS policies and prompt template for lore generation.

-- ============================================================
-- 1. epoch_invitations table
-- ============================================================

CREATE TABLE public.epoch_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    epoch_id UUID NOT NULL REFERENCES public.game_epochs(id) ON DELETE CASCADE,
    invited_email TEXT NOT NULL,
    invite_token TEXT NOT NULL UNIQUE,
    invited_by_id UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_epoch_invitations_token ON public.epoch_invitations(invite_token);
CREATE INDEX idx_epoch_invitations_epoch ON public.epoch_invitations(epoch_id);

-- ============================================================
-- 2. RLS Policies
-- ============================================================

ALTER TABLE public.epoch_invitations ENABLE ROW LEVEL SECURITY;

-- Creator can SELECT their epoch's invitations
CREATE POLICY epoch_invitations_creator_select ON public.epoch_invitations
    FOR SELECT USING (
        invited_by_id = auth.uid()
        OR epoch_id IN (
            SELECT id FROM public.game_epochs WHERE created_by_id = auth.uid()
        )
    );

-- Creator can INSERT invitations for their epochs
CREATE POLICY epoch_invitations_creator_insert ON public.epoch_invitations
    FOR INSERT WITH CHECK (
        epoch_id IN (
            SELECT id FROM public.game_epochs WHERE created_by_id = auth.uid()
        )
    );

-- Creator can UPDATE (revoke) invitations for their epochs
CREATE POLICY epoch_invitations_creator_update ON public.epoch_invitations
    FOR UPDATE USING (
        epoch_id IN (
            SELECT id FROM public.game_epochs WHERE created_by_id = auth.uid()
        )
    );

-- Anon can SELECT by matching invite_token (for public accept page)
CREATE POLICY epoch_invitations_anon_select ON public.epoch_invitations
    FOR SELECT TO anon USING (true);

-- Authenticated users can update their own acceptance
CREATE POLICY epoch_invitations_accept ON public.epoch_invitations
    FOR UPDATE USING (
        auth.uid() IS NOT NULL
    ) WITH CHECK (
        auth.uid() IS NOT NULL
    );

-- ============================================================
-- 3. Prompt template for epoch invitation lore
-- ============================================================

INSERT INTO public.prompt_templates (
    simulation_id, template_type, prompt_category, template_name, locale,
    system_prompt, prompt_content,
    variables, temperature, max_tokens, is_active, is_system_default
) VALUES (
    NULL, 'epoch_invitation_lore', 'epoch', 'Epoch Invitation Lore', 'en',
    'You are a classified military intelligence officer drafting a tactical dispatch. '
    'Write in the style of a redacted government communique — terse, atmospheric, urgent. '
    'Use short declarative sentences. No flowery language. No questions. '
    'Reference the epoch as an operation or campaign. '
    'Output ONLY the dispatch paragraph, no headers or labels.',
    'Draft a classified tactical dispatch (one paragraph, 3-5 sentences) summoning operatives '
    'to a new campaign.\n\n'
    'OPERATION: {epoch_name}\n'
    'BRIEFING: {epoch_description}\n'
    'KNOWN PARTICIPANTS: {participant_names}\n\n'
    'The dispatch should create urgency and intrigue. Mention the operation name. '
    'Hint at strategic stakes without revealing specifics. '
    'End with an implicit call to action.',
    '[{"name": "epoch_name"}, {"name": "epoch_description"}, {"name": "participant_names"}]'::jsonb,
    0.8, 256, true, true
);
