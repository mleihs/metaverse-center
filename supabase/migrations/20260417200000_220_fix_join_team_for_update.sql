-- Migration 220: Fix fn_join_team_checked — FOR UPDATE with COUNT(*) is illegal
--
-- PostgreSQL does not allow FOR UPDATE with aggregate functions.
-- The original function (migration 214) used:
--   SELECT COUNT(*) INTO v_current_count FROM ... FOR UPDATE;
-- which raises: "FOR UPDATE is not allowed with aggregate functions"
--
-- Fix: lock rows first with PERFORM ... FOR UPDATE (no aggregate),
-- then count without FOR UPDATE. The rows are already locked within
-- this transaction, so the count is safe from concurrent modification.

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
    v_current_count INT;
    v_updated       BOOLEAN := false;
BEGIN
    -- Verify team exists and is not dissolved
    PERFORM 1 FROM public.epoch_teams
    WHERE id = p_team_id AND epoch_id = p_epoch_id AND dissolved_at IS NULL;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Lock the team's current members to prevent concurrent joins.
    -- PERFORM + FOR UPDATE acquires row locks without aggregating.
    PERFORM 1 FROM public.epoch_participants
    WHERE epoch_id = p_epoch_id AND team_id = p_team_id
    FOR UPDATE;

    -- Count after locking (rows are held by this transaction)
    SELECT COUNT(*) INTO v_current_count
    FROM public.epoch_participants
    WHERE epoch_id = p_epoch_id AND team_id = p_team_id;

    IF v_current_count < p_max_size THEN
        UPDATE public.epoch_participants
        SET team_id = p_team_id
        WHERE epoch_id = p_epoch_id AND simulation_id = p_simulation_id
          AND (team_id IS NULL OR team_id != p_team_id);
        v_updated := FOUND;
    END IF;

    RETURN v_updated;
END;
$$;
