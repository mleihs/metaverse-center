-- Migration 126: Batch RP grant RPC
--
-- Replaces Python-side grouping + multiple UPDATE queries with a single
-- SQL UPDATE using LEAST() for cap enforcement.

CREATE OR REPLACE FUNCTION public.fn_batch_grant_rp(
    p_epoch_id uuid,
    p_amount integer,
    p_rp_cap integer
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.epoch_participants
    SET
        current_rp = LEAST(current_rp + p_amount, p_rp_cap),
        last_rp_grant_at = now()
    WHERE epoch_id = p_epoch_id
    RETURNING 1
$$;
