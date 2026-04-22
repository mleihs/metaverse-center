-- Migration 233: Fix fn_join_team_checked — phantom-row race under concurrency
--
-- Root cause
-- ----------
-- Migration 220 acquires FOR UPDATE locks on existing members of the
-- target team:
--
--     PERFORM 1 FROM epoch_participants
--     WHERE team_id = p_team_id
--     FOR UPDATE;
--
-- PostgreSQL's row-level locks can only be taken on rows that ALREADY
-- match the predicate. When the team is empty (zero current members),
-- the SELECT returns zero rows and ZERO locks are acquired. Concurrent
-- sessions all see the same empty snapshot under READ COMMITTED:
--
--     A: count=0, 0 < max → UPDATE participant A.team_id = T (uncommitted)
--     B: count=0, 0 < max → UPDATE participant B.team_id = T (uncommitted)
--     C: count=0, 0 < max → UPDATE participant C.team_id = T (uncommitted)
--     A, B, C all commit → team has 3 members, max was 2.
--
-- This is the classic "empty predicate, no phantom protection" problem.
-- FOR UPDATE protects against concurrent modification of rows you've
-- already read; it does NOT protect against new rows appearing.
--
-- Fix
-- ---
-- Lock the epoch_teams row itself with FOR UPDATE before doing any
-- membership work. The team row always exists (we already verify it
-- with the existence check), so FOR UPDATE on it acquires a real row
-- lock that serialises every concurrent join attempt through that one
-- row.
--
--     A: acquires team-row lock, count=0, 0 < 2 → UPDATE A, commits, releases.
--     B: waits on team-row lock. A commits. B acquires, count=1, 1 < 2 → UPDATE B, commits.
--     C: waits on team-row lock. B commits. C acquires, count=2, 2 < 2 → FALSE.
--
-- This is the same pattern used by fn_deploy_operative and the other
-- atomic RPCs in migration 214 (each locks a stable parent row — the
-- agent, the team, the mission) to serialise concurrent writers.
--
-- The per-member FOR UPDATE is now redundant and removed; with the
-- team-row lock held, no other session can reach the count/UPDATE
-- block for the same team.

CREATE OR REPLACE FUNCTION public.fn_join_team_checked(
    p_epoch_id      UUID,
    p_team_id       UUID,
    p_simulation_id UUID,
    p_max_size      INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_team_exists   BOOLEAN;
    v_current_count INT;
    v_updated       BOOLEAN := false;
BEGIN
    -- Lock the team row. FOR UPDATE on an actual row serialises all
    -- concurrent join attempts through this point. Rows that don't
    -- exist or have been dissolved fall through to the NULL return.
    SELECT true INTO v_team_exists
    FROM public.epoch_teams
    WHERE id = p_team_id
      AND epoch_id = p_epoch_id
      AND dissolved_at IS NULL
    FOR UPDATE;

    IF v_team_exists IS NULL THEN
        RETURN NULL;
    END IF;

    -- With the team-row lock held, the count is authoritative — no
    -- other session can be inside this critical section for the same
    -- team at the same time.
    SELECT COUNT(*) INTO v_current_count
    FROM public.epoch_participants
    WHERE epoch_id = p_epoch_id
      AND team_id = p_team_id;

    IF v_current_count < p_max_size THEN
        UPDATE public.epoch_participants
        SET team_id = p_team_id
        WHERE epoch_id = p_epoch_id
          AND simulation_id = p_simulation_id
          AND (team_id IS NULL OR team_id != p_team_id);
        v_updated := FOUND;
    END IF;

    RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.fn_join_team_checked(UUID, UUID, UUID, INT) IS
'Atomic team join with max-size enforcement under concurrency. Locks the
 epoch_teams row (FOR UPDATE) to serialise concurrent joins, then counts
 current members and assigns the caller if capacity remains. Returns TRUE
 on successful join, FALSE if the team is full, NULL if the team does not
 exist or has been dissolved. Fix for phantom-row race: per-member
 FOR UPDATE (migration 220) could not lock an empty team — the team-row
 lock here covers that case. See migration 233.';
