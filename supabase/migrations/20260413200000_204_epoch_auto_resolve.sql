-- ═══════════════════════════════════════════════════════════
-- Migration 204: Epoch Auto-Resolve Infrastructure
-- ═══════════════════════════════════════════════════════════
--
-- Adds cycle deadline tracking to game_epochs and AFK tracking
-- to epoch_participants. Creates two atomic RPCs for the
-- EpochCycleScheduler:
--   1. fn_check_and_resolve_deadline — CAS gate for deadline expiry
--   2. fn_set_acted_this_cycle — idempotent action tracking
--
-- ADR-006: SECURITY DEFINER, no GRANT to anon/authenticated.
-- ADR-007: atomic RPCs for concurrent-access data.


-- ════════════════════════════════════════════════════════════
-- 1. game_epochs: deadline tracking columns
-- ════════════════════════════════════════════════════════════

ALTER TABLE game_epochs
  ADD COLUMN IF NOT EXISTS cycle_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cycle_deadline_at TIMESTAMPTZ;


-- ════════════════════════════════════════════════════════════
-- 2. epoch_participants: AFK tracking columns
-- ════════════════════════════════════════════════════════════

ALTER TABLE epoch_participants
  ADD COLUMN IF NOT EXISTS has_acted_this_cycle BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consecutive_afk_cycles INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_afk_cycles INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS afk_replaced_by_ai BOOLEAN NOT NULL DEFAULT FALSE;


-- ════════════════════════════════════════════════════════════
-- 3. Partial index for scheduler sweep query
-- ════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_game_epochs_active_deadline
  ON game_epochs (cycle_deadline_at)
  WHERE status IN ('foundation', 'competition', 'reckoning')
    AND cycle_deadline_at IS NOT NULL;


-- ════════════════════════════════════════════════════════════
-- 4. fn_check_and_resolve_deadline
--    CAS: only resolves if epoch is active, cycle matches,
--    and deadline has passed. Returns JSONB with result.
--    Idempotent: concurrent callers get resolved=false.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_check_and_resolve_deadline(
  p_epoch_id UUID,
  p_expected_cycle INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_epoch RECORD;
BEGIN
  -- Atomic CAS: claim the cycle for resolution by nulling both deadline columns.
  -- This prevents the sweep from re-finding this epoch if resolve_cycle_full()
  -- succeeds (cycle advances) but setting the NEXT deadline fails.
  -- Without nulling cycle_deadline_at, the old deadline would persist and cause
  -- a double-resolve of the next cycle before players can act.
  UPDATE game_epochs
  SET cycle_started_at = NULL,
      cycle_deadline_at = NULL
  WHERE id = p_epoch_id
    AND current_cycle = p_expected_cycle
    AND status IN ('foundation', 'competition', 'reckoning')
    AND cycle_deadline_at IS NOT NULL
    AND cycle_deadline_at <= NOW()
  RETURNING * INTO v_epoch;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('resolved', FALSE, 'reason', 'not_due_or_concurrent');
  END IF;

  RETURN jsonb_build_object(
    'resolved', TRUE,
    'epoch_id', v_epoch.id,
    'cycle_number', v_epoch.current_cycle,
    'config', v_epoch.config
  );
END;
$$;

COMMENT ON FUNCTION fn_check_and_resolve_deadline IS
  'CAS gate for deadline-based auto-resolve. Atomically claims an epoch cycle '
  'for resolution by nulling both cycle_started_at and cycle_deadline_at. '
  'Nulling cycle_deadline_at is critical: if the Python resolve succeeds but '
  'setting the NEXT deadline fails, the old deadline must not persist or the '
  'sweep would double-resolve. Only succeeds if the epoch is in an active '
  'phase, the cycle number matches (optimistic lock), and the deadline has '
  'passed. Concurrent callers get resolved=false.';


-- ════════════════════════════════════════════════════════════
-- 5. fn_set_acted_this_cycle
--    Idempotent: only flips FALSE→TRUE, returns whether
--    the update actually changed the row.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_set_acted_this_cycle(
  p_epoch_id UUID,
  p_simulation_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE epoch_participants
  SET has_acted_this_cycle = TRUE
  WHERE epoch_id = p_epoch_id
    AND simulation_id = p_simulation_id
    AND has_acted_this_cycle = FALSE;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION fn_set_acted_this_cycle IS
  'Idempotent action tracking for epoch cycle activity gate. Sets '
  'has_acted_this_cycle = TRUE for a participant. The WHERE clause on '
  'has_acted_this_cycle = FALSE makes concurrent calls safe (only first wins).';


-- ════════════════════════════════════════════════════════════
-- Grants: callable by service_role only (default).
-- No additional GRANT needed — service_role owns these via
-- SECURITY DEFINER context.
-- Do NOT grant to anon or authenticated (ADR-006 compliance).
-- ════════════════════════════════════════════════════════════
