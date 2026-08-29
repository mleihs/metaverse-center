-- ============================================================
-- Migration 275: close the four epoch write policies migration 213 left open,
-- and give the team join/leave path the atomic RPC it always needed.
-- ============================================================
--
-- Migration 213 ("Epoch Security Hardening") fixed exactly one instance of a
-- pattern that migration 032 had seeded five times: it narrowed
-- `epoch_scores` UPDATE from `USING (true) TO authenticated` down to
-- service_role. The four siblings were left untouched and are still live:
--
--   1. epoch_participants UPDATE  -- USING (true), no WITH CHECK.
--      Any authenticated user could PATCH ANY participant row through
--      PostgREST: current_rp (the game currency), cycle_ready, team_id,
--      drafted_agent_ids, final_scores, betrayal_penalty. This is strictly
--      worse than the epoch_scores hole 213 closed -- scores are derived,
--      RP is spendable.
--   2. epoch_teams INSERT/UPDATE -- (true): rename or dissolve a stranger's
--      alliance, or forge teams into someone else's epoch.
--   3. epoch_scores INSERT       -- WITH CHECK (true): 213 closed UPDATE but
--      not INSERT, so a crafted row for a future cycle still poisons the
--      leaderboard (UNIQUE(epoch_id, simulation_id, cycle_number)).
--   4. battle_log INSERT         -- WITH CHECK (true): forge narrative events.
--
-- There is no blanket `REVOKE ... ON ALL TABLES` anywhere in this repo, so
-- Supabase's default table grants to `authenticated` apply and RLS is the only
-- gate. These were reachable with the public anon key plus any logged-in JWT.
--
-- Approach (defence in depth, two independent layers):
--   Layer 1 -- RLS: writes that represent SERVER decisions (scores, battle log,
--     team lifecycle, RP, penalties, AFK bookkeeping) become service_role-only.
--     The backend already reaches them through SECURITY DEFINER RPCs or the
--     admin client, so this is behaviourally neutral (see the Python changes
--     that ship with this migration).
--     Note on mechanics: service_role carries BYPASSRLS, so the `TO service_role`
--     policies below do not grant it anything it lacked. What actually closes
--     the hole is DROPPING the `authenticated` policy; the service_role policy
--     is documentation of intent, and matches the shape migration 213 used.
--   Layer 2 -- column grants: even on their OWN participant row a player may
--     only write `cycle_ready`. Column-level GRANTs are checked before RLS, so
--     a crafted PATCH touching current_rp is rejected regardless of policy.
--     `cycle_ready` is the single genuinely player-owned flag (toggle_ready);
--     `team_id` is deliberately NOT granted -- writing it directly would bypass
--     the max_team_size check in fn_join_team_checked.
--
-- ADR-006: no SECURITY DEFINER function below is granted to anon/authenticated.
-- ADR-007: fn_create_team_atomic replaces a Python insert-then-update that
--     could strand an alliance with no members if the second call failed.

-- ═══════════════════════════════════════════════════════════════════
-- 1. fn_create_team_atomic — team insert + creator auto-join, one txn
-- ═══════════════════════════════════════════════════════════════════
-- Replaces epoch_participation_service.create_team()'s two-statement path
-- (INSERT epoch_teams, then UPDATE epoch_participants.team_id). A failure
-- between them left a team with zero members that still counted against
-- alliance listings. Phase validation stays in Python -- SQL owns integrity
-- and atomicity, Python owns game rules.

CREATE OR REPLACE FUNCTION public.fn_create_team_atomic(
    p_epoch_id      UUID,
    p_simulation_id UUID,
    p_name          TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_participant_id UUID;
    v_team           epoch_teams%ROWTYPE;
BEGIN
    -- Check first, write second. The whole function is one transaction, and
    -- FOR UPDATE holds the row, so this cannot race -- and it lets the failure
    -- come back as an `error_code` field rather than an exception, matching
    -- fn_advance_epoch_cycle. Callers should never have to string-match on
    -- exception text to tell one failure from another.
    SELECT id INTO v_participant_id
    FROM public.epoch_participants
    WHERE epoch_id = p_epoch_id
      AND simulation_id = p_simulation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error_code', 'participant_not_found');
    END IF;

    INSERT INTO public.epoch_teams (epoch_id, name, created_by_simulation_id)
    VALUES (p_epoch_id, p_name, p_simulation_id)
    RETURNING * INTO v_team;

    UPDATE public.epoch_participants
    SET team_id = v_team.id
    WHERE id = v_participant_id;

    RETURN to_jsonb(v_team);
END;
$$;

COMMENT ON FUNCTION public.fn_create_team_atomic(UUID, UUID, TEXT) IS
    'Atomic alliance creation: INSERT epoch_teams + auto-join the creating '
    'participant in one transaction. Returns the team row, or '
    '{"error_code":"participant_not_found"} when the creator is not enrolled '
    '(nothing is written in that case). Service-role only (ADR-006).';

REVOKE EXECUTE ON FUNCTION public.fn_create_team_atomic(UUID, UUID, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_team_atomic(UUID, UUID, TEXT)
    TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 2. fn_leave_team — clear own team_id, report the team left
-- ═══════════════════════════════════════════════════════════════════
-- epoch_participants.team_id is no longer writable by `authenticated` (see
-- section 4), so leaving needs a privileged path. The router validates
-- participation before calling.

CREATE OR REPLACE FUNCTION public.fn_leave_team(
    p_epoch_id      UUID,
    p_simulation_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_old_team UUID;
BEGIN
    -- One statement: UPDATE ... RETURNING gives us the previous value and the
    -- row lock together. A preceding SELECT FOR UPDATE would add a round trip
    -- for nothing.
    UPDATE public.epoch_participants AS p
    SET team_id = NULL
    FROM (
        SELECT id, team_id
        FROM public.epoch_participants
        WHERE epoch_id = p_epoch_id AND simulation_id = p_simulation_id
    ) AS prev
    WHERE p.id = prev.id
    RETURNING prev.team_id INTO v_old_team;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
        'simulation_id', p_simulation_id,
        'previous_team_id', v_old_team
    );
END;
$$;

COMMENT ON FUNCTION public.fn_leave_team(UUID, UUID) IS
    'Clears a participant''s team_id and reports the team they left. Returns '
    'NULL when the participant does not exist. Service-role only (ADR-006).';

REVOKE EXECUTE ON FUNCTION public.fn_leave_team(UUID, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_leave_team(UUID, UUID) TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- 3. epoch_teams — INSERT + UPDATE become service_role only
-- ═══════════════════════════════════════════════════════════════════
-- Creation goes through fn_create_team_atomic; dissolution goes through
-- AllianceService (tension / betrayal / epoch end), all on the admin client.

DROP POLICY IF EXISTS epoch_teams_insert ON public.epoch_teams;
CREATE POLICY epoch_teams_insert ON public.epoch_teams
    FOR INSERT TO service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS epoch_teams_update ON public.epoch_teams;
CREATE POLICY epoch_teams_update ON public.epoch_teams
    FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- 4. epoch_participants — own row only, and only cycle_ready
-- ═══════════════════════════════════════════════════════════════════
-- Layer 1: RLS narrows UPDATE from every row to the caller's own. WITH CHECK
-- mirrors USING so a row cannot be re-assigned to another user.

DROP POLICY IF EXISTS epoch_participants_update ON public.epoch_participants;

CREATE POLICY epoch_participants_update ON public.epoch_participants
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- service_role keeps unrestricted UPDATE: RP grants, AFK bookkeeping, betrayal
-- penalties, draft persistence and bot management all run privileged.
DROP POLICY IF EXISTS epoch_participants_update_service ON public.epoch_participants;
CREATE POLICY epoch_participants_update_service ON public.epoch_participants
    FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);

-- Layer 2: column grants. Postgres checks column privileges BEFORE RLS, so
-- this holds even for the caller's own row. cycle_ready is the only column a
-- player legitimately writes directly (EpochChatService.toggle_ready).
REVOKE UPDATE ON public.epoch_participants FROM authenticated;
GRANT UPDATE (cycle_ready) ON public.epoch_participants TO authenticated;

-- INSERT/DELETE were already narrowed to `user_id = auth.uid()` in migration
-- 049 and stay as they are; bot enrolment runs on the admin client.

-- ═══════════════════════════════════════════════════════════════════
-- 5. epoch_scores — INSERT joins UPDATE behind service_role
-- ═══════════════════════════════════════════════════════════════════
-- All rows are written by fn_compute_cycle_scores (SECURITY DEFINER, runs as
-- owner and therefore bypasses RLS entirely). Nothing legitimate inserts here
-- as `authenticated`.

DROP POLICY IF EXISTS epoch_scores_insert ON public.epoch_scores;
CREATE POLICY epoch_scores_insert ON public.epoch_scores
    FOR INSERT TO service_role
    WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- 6. battle_log — INSERT becomes service_role only
-- ═══════════════════════════════════════════════════════════════════
-- BattleLogService now resolves the service-role client internally for every
-- write (its single insert path), so no caller passes a user client any more.
-- SELECT policies (fog of war, migration 211) are deliberately untouched.

DROP POLICY IF EXISTS battle_log_insert ON public.battle_log;
CREATE POLICY battle_log_insert ON public.battle_log
    FOR INSERT TO service_role
    WITH CHECK (true);
