-- ============================================================
-- Migration 089: Epoch Gameplay Audit Fixes
-- Bugs: #3, #9, #17
-- ============================================================

-- ── Bug #3 — Prevent duplicate active academy epochs ──────
-- Race-condition-proof: partial unique index ensures at most
-- one non-terminal academy epoch per user at the DB level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_academy_per_user
ON game_epochs (created_by_id)
WHERE epoch_type = 'academy'
  AND status IN ('lobby', 'foundation', 'competition', 'reckoning');


-- ── Bug #9 — Rename inappropriate simulation ─────────────
-- (slug is immutable after creation, only rename display name)
UPDATE simulations
SET name = 'Spengbab''s Grease Pit'
WHERE name = 'Spengbab''s Whore House';


-- ── Bug #17 — Force-resolve missions on epoch completion ──
-- Add 'expired' to the operative_missions status check constraint
ALTER TABLE operative_missions DROP CONSTRAINT IF EXISTS operative_missions_status_check;
ALTER TABLE operative_missions ADD CONSTRAINT operative_missions_status_check
  CHECK (status = ANY (ARRAY['deploying','active','returning','success','failed','detected','captured','expired']));

-- Trigger: when game_epochs.status transitions to completed
-- or cancelled, expire all deploying/active missions.
CREATE OR REPLACE FUNCTION fn_resolve_missions_on_epoch_end()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'cancelled')
     AND OLD.status NOT IN ('completed', 'cancelled')
  THEN
    UPDATE operative_missions
    SET status = 'expired',
        resolved_at = NOW(),
        mission_result = jsonb_build_object(
          'outcome', 'expired',
          'narrative', 'Epoch concluded. All operatives recalled to base.'
        )
    WHERE epoch_id = NEW.id
      AND status IN ('deploying', 'active');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_epoch_end_mission_cleanup
BEFORE UPDATE ON game_epochs
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION fn_resolve_missions_on_epoch_end();
