-- Migration 090: Alliance Redesign — Proposals, Shared Intel, Upkeep & Tension
--
-- Three interconnected mechanics:
-- 1. Alliance Proposals — join requests require unanimous member approval
-- 2. Shared Intelligence — allies share fog-of-war intel automatically (RLS)
-- 3. Upkeep & Tension — alliances cost RP and generate internal friction
--
-- Postgres-native logic: triggers for proposal resolution, tension auto-dissolve,
-- and server-side functions for upkeep/tension/expiry computation.

-- ══════════════════════════════════════════════════════════════
-- 1A. New Table: epoch_alliance_proposals
-- ══════════════════════════════════════════════════════════════

CREATE TABLE public.epoch_alliance_proposals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    epoch_id UUID NOT NULL REFERENCES public.game_epochs(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.epoch_teams(id) ON DELETE CASCADE,
    proposer_simulation_id UUID NOT NULL REFERENCES public.simulations(id),
    proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at_cycle INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    resolved_at TIMESTAMPTZ
);

-- One pending proposal per sim per team
CREATE UNIQUE INDEX idx_alliance_proposal_unique_pending
    ON epoch_alliance_proposals(team_id, proposer_simulation_id)
    WHERE status = 'pending';

CREATE INDEX idx_alliance_proposals_epoch
    ON epoch_alliance_proposals(epoch_id) WHERE status = 'pending';

CREATE INDEX idx_alliance_proposals_team
    ON epoch_alliance_proposals(team_id);

-- ══════════════════════════════════════════════════════════════
-- 1B. New Table: epoch_alliance_votes
-- ══════════════════════════════════════════════════════════════

CREATE TABLE public.epoch_alliance_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id UUID NOT NULL REFERENCES public.epoch_alliance_proposals(id) ON DELETE CASCADE,
    voter_simulation_id UUID NOT NULL REFERENCES public.simulations(id),
    vote TEXT NOT NULL CHECK (vote IN ('accept', 'reject')),
    voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (proposal_id, voter_simulation_id)
);

CREATE INDEX idx_alliance_votes_proposal ON epoch_alliance_votes(proposal_id);

-- ══════════════════════════════════════════════════════════════
-- 1C. Trigger: Auto-Resolve Proposals on Vote
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_resolve_alliance_proposal()
RETURNS TRIGGER AS $$
DECLARE
    v_proposal RECORD;
    v_member_count INT;
    v_accept_count INT;
    v_reject_count INT;
BEGIN
    SELECT * INTO v_proposal
        FROM epoch_alliance_proposals WHERE id = NEW.proposal_id;

    -- Skip if already resolved
    IF v_proposal.status != 'pending' THEN RETURN NEW; END IF;

    -- Count current team members (these are the voters)
    SELECT COUNT(*) INTO v_member_count
        FROM epoch_participants
        WHERE epoch_id = v_proposal.epoch_id
          AND team_id = v_proposal.team_id;

    SELECT
        COUNT(*) FILTER (WHERE vote = 'accept'),
        COUNT(*) FILTER (WHERE vote = 'reject')
    INTO v_accept_count, v_reject_count
    FROM epoch_alliance_votes WHERE proposal_id = NEW.proposal_id;

    -- Any rejection → immediate rejection
    IF v_reject_count > 0 THEN
        UPDATE epoch_alliance_proposals
            SET status = 'rejected', resolved_at = now()
            WHERE id = NEW.proposal_id;
        RETURN NEW;
    END IF;

    -- Unanimous accept → join proposer to team
    IF v_accept_count >= v_member_count THEN
        UPDATE epoch_alliance_proposals
            SET status = 'accepted', resolved_at = now()
            WHERE id = NEW.proposal_id;
        UPDATE epoch_participants
            SET team_id = v_proposal.team_id
            WHERE epoch_id = v_proposal.epoch_id
              AND simulation_id = v_proposal.proposer_simulation_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_resolve_alliance_proposal
    AFTER INSERT ON epoch_alliance_votes
    FOR EACH ROW EXECUTE FUNCTION fn_resolve_alliance_proposal();

-- ══════════════════════════════════════════════════════════════
-- 1D. Modify epoch_teams: Add Tension
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.epoch_teams
    ADD COLUMN tension INT NOT NULL DEFAULT 0
        CHECK (tension >= 0 AND tension <= 100);

-- Expand dissolved_reason to include new tension reason
ALTER TABLE public.epoch_teams DROP CONSTRAINT IF EXISTS epoch_teams_dissolved_reason_check;
ALTER TABLE public.epoch_teams ADD CONSTRAINT epoch_teams_dissolved_reason_check
    CHECK (dissolved_reason IS NULL OR dissolved_reason IN (
        'voluntary', 'betrayal', 'epoch_end', 'tension'
    ));

-- ══════════════════════════════════════════════════════════════
-- 1E. Trigger: Auto-Dissolve on High Tension
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_check_alliance_tension()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tension >= 80 AND (OLD.tension IS NULL OR OLD.tension < 80)
       AND NEW.dissolved_at IS NULL THEN
        NEW.dissolved_at = now();
        NEW.dissolved_reason = 'tension';
        -- NOTE: team_id clearing is handled by AllianceService.compute_tension()
        -- in the Python layer, after logging and notification data capture.
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_alliance_tension_check
    BEFORE UPDATE ON epoch_teams
    FOR EACH ROW
    WHEN (NEW.tension IS DISTINCT FROM OLD.tension)
    EXECUTE FUNCTION fn_check_alliance_tension();

-- ══════════════════════════════════════════════════════════════
-- 1F. RLS Policies
-- ══════════════════════════════════════════════════════════════

-- epoch_alliance_proposals: public read, participant insert
ALTER TABLE public.epoch_alliance_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY proposals_select ON epoch_alliance_proposals
    FOR SELECT USING (true);

CREATE POLICY proposals_insert ON epoch_alliance_proposals
    FOR INSERT TO authenticated WITH CHECK (
        -- Proposer creating their own request
        EXISTS (
            SELECT 1 FROM epoch_participants ep
            WHERE ep.epoch_id = epoch_alliance_proposals.epoch_id
              AND ep.simulation_id = epoch_alliance_proposals.proposer_simulation_id
              AND ep.user_id = auth.uid()
        )
        -- OR team member inviting an outsider
        OR EXISTS (
            SELECT 1 FROM epoch_participants ep
            WHERE ep.epoch_id = epoch_alliance_proposals.epoch_id
              AND ep.team_id = epoch_alliance_proposals.team_id
              AND ep.user_id = auth.uid()
        )
    );

-- epoch_alliance_votes: team members + proposer read, team members insert
ALTER TABLE public.epoch_alliance_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY votes_select ON epoch_alliance_votes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM epoch_alliance_proposals p
            JOIN epoch_participants ep ON ep.epoch_id = p.epoch_id
            WHERE p.id = epoch_alliance_votes.proposal_id
              AND ep.user_id = auth.uid()
              AND (ep.simulation_id = p.proposer_simulation_id OR ep.team_id = p.team_id)
        )
    );

CREATE POLICY votes_insert ON epoch_alliance_votes
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM epoch_alliance_proposals p
            JOIN epoch_participants ep ON ep.epoch_id = p.epoch_id
            WHERE p.id = epoch_alliance_votes.proposal_id
              AND ep.simulation_id = epoch_alliance_votes.voter_simulation_id
              AND ep.user_id = auth.uid()
              AND ep.team_id = p.team_id
        )
    );

-- ══════════════════════════════════════════════════════════════
-- 1G. Update battle_log RLS for Shared Intelligence
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS battle_log_select ON battle_log;
CREATE POLICY battle_log_select ON battle_log
    FOR SELECT USING (
        is_public = true
        OR EXISTS (
            SELECT 1 FROM epoch_participants ep
            WHERE ep.epoch_id = battle_log.epoch_id
              AND ep.simulation_id = battle_log.source_simulation_id
              AND ep.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM epoch_participants ep
            WHERE ep.epoch_id = battle_log.epoch_id
              AND ep.simulation_id = battle_log.target_simulation_id
              AND ep.user_id = auth.uid()
        )
        -- Allied intel: teammate's battle log entries become visible
        OR EXISTS (
            SELECT 1 FROM epoch_participants my_ep
            JOIN epoch_participants ally_ep
                ON ally_ep.team_id = my_ep.team_id
                AND ally_ep.epoch_id = my_ep.epoch_id
                AND ally_ep.team_id IS NOT NULL
            WHERE my_ep.epoch_id = battle_log.epoch_id
              AND my_ep.user_id = auth.uid()
              AND (ally_ep.simulation_id = battle_log.source_simulation_id
                   OR ally_ep.simulation_id = battle_log.target_simulation_id)
        )
    );

-- ══════════════════════════════════════════════════════════════
-- 1H. Expand battle_log event_type CHECK for alliance events
-- ══════════════════════════════════════════════════════════════

ALTER TABLE battle_log DROP CONSTRAINT IF EXISTS battle_log_event_type_check;
ALTER TABLE battle_log ADD CONSTRAINT battle_log_event_type_check CHECK (
    event_type IN (
        'operative_deployed', 'mission_success', 'mission_failed',
        'detected', 'captured', 'sabotage', 'propaganda', 'assassination',
        'infiltration', 'alliance_formed', 'alliance_dissolved', 'betrayal',
        'phase_change', 'epoch_start', 'epoch_end', 'rp_allocated',
        'building_damaged', 'agent_wounded', 'counter_intel', 'intel_report',
        'zone_fortified',
        -- New alliance events
        'alliance_proposal', 'alliance_proposal_accepted',
        'alliance_proposal_rejected', 'alliance_tension_increase',
        'alliance_dissolved_tension', 'alliance_upkeep'
    )
);

-- ══════════════════════════════════════════════════════════════
-- 1I. Postgres-native functions for cycle pipeline
-- ══════════════════════════════════════════════════════════════

-- Expire stale proposals (called during cycle resolution)
CREATE OR REPLACE FUNCTION fn_expire_alliance_proposals(
    p_epoch_id UUID,
    p_current_cycle INT
) RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE epoch_alliance_proposals
       SET status = 'expired', resolved_at = now()
     WHERE epoch_id = p_epoch_id
       AND status = 'pending'
       AND expires_at_cycle <= p_current_cycle;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deduct alliance upkeep: each member pays 1 RP per team member
-- Returns JSONB array of {team_id, team_name, member_count, members_charged}
CREATE OR REPLACE FUNCTION fn_deduct_alliance_upkeep(
    p_epoch_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_team RECORD;
    v_member_count INT;
    v_result JSONB := '[]'::JSONB;
BEGIN
    FOR v_team IN
        SELECT id, name FROM epoch_teams
        WHERE epoch_id = p_epoch_id AND dissolved_at IS NULL
    LOOP
        SELECT COUNT(*) INTO v_member_count
        FROM epoch_participants
        WHERE epoch_id = p_epoch_id AND team_id = v_team.id;

        IF v_member_count > 0 THEN
            -- Deduct member_count RP from each member, floor at 0
            UPDATE epoch_participants
               SET current_rp = GREATEST(0, current_rp - v_member_count)
             WHERE epoch_id = p_epoch_id AND team_id = v_team.id;

            v_result := v_result || jsonb_build_object(
                'team_id', v_team.id,
                'team_name', v_team.name,
                'member_count', v_member_count,
                'cost_per_member', v_member_count
            );
        END IF;
    END LOOP;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Compute tension for all active teams in an epoch
-- Counts unique targets attacked by 2+ members this cycle → +10 each
-- Natural decay → -5, clamp 0-100
-- Returns JSONB array of {team_id, team_name, old_tension, new_tension, dissolved}
CREATE OR REPLACE FUNCTION fn_compute_alliance_tension(
    p_epoch_id UUID,
    p_cycle_number INT
) RETURNS JSONB AS $$
DECLARE
    v_team RECORD;
    v_overlap_count INT;
    v_old_tension INT;
    v_new_tension INT;
    v_dissolved BOOLEAN;
    v_result JSONB := '[]'::JSONB;
BEGIN
    FOR v_team IN
        SELECT id, name, tension FROM epoch_teams
        WHERE epoch_id = p_epoch_id AND dissolved_at IS NULL
    LOOP
        v_old_tension := v_team.tension;

        -- Count unique target_simulation_ids attacked by 2+ different
        -- source_simulation_ids from this team in this cycle
        SELECT COUNT(*) INTO v_overlap_count
        FROM (
            SELECT om.target_simulation_id
            FROM operative_missions om
            JOIN epoch_participants ep ON ep.epoch_id = om.epoch_id
                AND ep.simulation_id = om.source_simulation_id
                AND ep.team_id = v_team.id
            WHERE om.epoch_id = p_epoch_id
              AND om.operative_type != 'guardian'
              AND om.target_simulation_id IS NOT NULL
              -- Missions deployed this cycle (uses deployed_cycle from 1J)
              AND om.deployed_cycle = p_cycle_number
            GROUP BY om.target_simulation_id
            HAVING COUNT(DISTINCT om.source_simulation_id) >= 2
        ) overlapping_targets;

        -- Compute new tension: +10 per overlap, -5 decay, clamp 0-100
        v_new_tension := GREATEST(0, LEAST(100,
            v_old_tension + (v_overlap_count * 10) - 5
        ));

        -- Update tension (auto-dissolve trigger fires if >= 80)
        v_dissolved := (v_new_tension >= 80 AND v_old_tension < 80);

        UPDATE epoch_teams SET tension = v_new_tension
        WHERE id = v_team.id;

        v_result := v_result || jsonb_build_object(
            'team_id', v_team.id,
            'team_name', v_team.name,
            'old_tension', v_old_tension,
            'new_tension', v_new_tension,
            'dissolved', v_dissolved
        );
    END LOOP;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- 1J. Add deployed_cycle to operative_missions
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.operative_missions
    ADD COLUMN deployed_cycle INT;
