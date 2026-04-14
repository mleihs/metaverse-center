-- Migration 213: Epoch Security Hardening
--
-- Fixes:
-- H6: epoch_scores UPDATE policy allows any authenticated user to modify scores
-- H7: Anon can SELECT all epoch invitations (token enumeration risk)
-- M10: fn_compute_cycle_scores callable by any authenticated user
--
-- Also adds missing CHECK constraints for data integrity (boundary audit).

-- ═══════════════════════════════════════════════════════════════════
-- H6: Restrict epoch_scores UPDATE to service_role only
-- ═══════════════════════════════════════════════════════════════════
-- Previously: USING (true) WITH CHECK (true) for 'authenticated'
-- Players could directly UPDATE any score row via Supabase client.

DROP POLICY IF EXISTS epoch_scores_update ON public.epoch_scores;
CREATE POLICY epoch_scores_update ON public.epoch_scores
    FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- H7: Remove overly permissive anon SELECT on epoch_invitations
-- ═══════════════════════════════════════════════════════════════════
-- Previously: USING (true) — anon could read ALL invitations.
-- The public validate_token endpoint runs via backend (service_role),
-- so anon never needs direct table access.

DROP POLICY IF EXISTS epoch_invitations_anon_select ON public.epoch_invitations;

-- ═══════════════════════════════════════════════════════════════════
-- M10: Revoke fn_compute_cycle_scores from authenticated
-- ═══════════════════════════════════════════════════════════════════
-- Any player could trigger mid-cycle score computation.
-- Scoring must only run through the backend cycle resolution pipeline.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'fn_compute_cycle_scores'
    ) THEN
        REVOKE EXECUTE ON FUNCTION public.fn_compute_cycle_scores FROM authenticated;
    END IF;
END
$$;

-- ═══════════════════════════════════════════════════════════════════
-- Missing CHECK constraints (Postgres boundary audit)
-- ═══════════════════════════════════════════════════════════════════
-- These constraints enforce invariants currently validated only in Python.
-- Defence-in-depth: if Python bugs introduce invalid data, the DB rejects it.

ALTER TABLE public.game_epochs
    ADD CONSTRAINT chk_epoch_current_cycle_non_negative
    CHECK (current_cycle >= 0);

ALTER TABLE public.epoch_participants
    ADD CONSTRAINT chk_participant_rp_non_negative
    CHECK (current_rp >= 0);

ALTER TABLE public.epoch_participants
    ADD CONSTRAINT chk_participant_afk_consecutive_non_negative
    CHECK (consecutive_afk_cycles >= 0);

ALTER TABLE public.epoch_participants
    ADD CONSTRAINT chk_participant_afk_total_non_negative
    CHECK (total_afk_cycles >= 0);

ALTER TABLE public.operative_missions
    ADD CONSTRAINT chk_mission_cost_rp_non_negative
    CHECK (cost_rp >= 0);

-- Proposals must expire in a future cycle
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'chk_proposal_expires_positive'
          AND table_name = 'epoch_alliance_proposals'
    ) THEN
        ALTER TABLE public.epoch_alliance_proposals
            ADD CONSTRAINT chk_proposal_expires_positive
            CHECK (expires_at_cycle >= 1);
    END IF;
END
$$;

-- Fortifications must expire in a future cycle
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'chk_fortification_expires_positive'
          AND table_name = 'zone_fortifications'
    ) THEN
        ALTER TABLE public.zone_fortifications
            ADD CONSTRAINT chk_fortification_expires_positive
            CHECK (expires_at_cycle > 0);
    END IF;
END
$$;

-- ═══════════════════════════════════════════════════════════════════
-- Static quorum column for alliance proposals (M15 fix)
-- ═══════════════════════════════════════════════════════════════════
-- The trigger fn_resolve_alliance_proposal currently uses dynamic member
-- count. If a member leaves between voting, the quorum shifts.
-- Store the required votes at proposal creation for deterministic resolution.

ALTER TABLE public.epoch_alliance_proposals
    ADD COLUMN IF NOT EXISTS required_votes INT;

-- Backfill existing pending proposals with current team member count
UPDATE public.epoch_alliance_proposals ap
SET required_votes = (
    SELECT COUNT(*)
    FROM public.epoch_participants ep
    WHERE ep.epoch_id = ap.epoch_id
      AND ep.team_id = ap.team_id
)
WHERE ap.required_votes IS NULL
  AND ap.status = 'pending';

-- Update the trigger to use static quorum
CREATE OR REPLACE FUNCTION public.fn_resolve_alliance_proposal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_proposal    RECORD;
    v_accept_count INT;
    v_reject_count INT;
    v_required     INT;
BEGIN
    -- Load proposal
    SELECT * INTO v_proposal
    FROM public.epoch_alliance_proposals
    WHERE id = NEW.proposal_id;

    IF NOT FOUND OR v_proposal.status != 'pending' THEN
        RETURN NEW;
    END IF;

    -- Use static quorum if set, fall back to dynamic member count
    v_required := v_proposal.required_votes;
    IF v_required IS NULL THEN
        SELECT COUNT(*) INTO v_required
        FROM public.epoch_participants
        WHERE epoch_id = v_proposal.epoch_id
          AND team_id = v_proposal.team_id;
    END IF;

    -- Count votes
    SELECT
        COUNT(*) FILTER (WHERE vote = 'accept'),
        COUNT(*) FILTER (WHERE vote = 'reject')
    INTO v_accept_count, v_reject_count
    FROM public.epoch_alliance_votes
    WHERE proposal_id = NEW.proposal_id;

    -- Resolve: unanimous acceptance or any rejection
    IF v_accept_count >= v_required THEN
        UPDATE public.epoch_alliance_proposals
        SET status = 'accepted', resolved_at = NOW()
        WHERE id = NEW.proposal_id;

        -- Add proposer to team
        UPDATE public.epoch_participants
        SET team_id = v_proposal.team_id
        WHERE epoch_id = v_proposal.epoch_id
          AND simulation_id = v_proposal.proposer_simulation_id;

    ELSIF v_reject_count > 0 THEN
        UPDATE public.epoch_alliance_proposals
        SET status = 'rejected', resolved_at = NOW()
        WHERE id = NEW.proposal_id;
    END IF;

    RETURN NEW;
END;
$$;
