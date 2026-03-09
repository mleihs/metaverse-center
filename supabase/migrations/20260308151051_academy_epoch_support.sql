-- ============================================================
-- Academy Epoch Support
-- Adds epoch_type to game_epochs and enforces single human participant
-- ============================================================

-- 1. Add epoch_type column
ALTER TABLE game_epochs
  ADD COLUMN IF NOT EXISTS epoch_type TEXT NOT NULL DEFAULT 'competitive'
  CHECK (epoch_type IN ('competitive', 'academy'));

-- 2. Enforce max 1 human participant in academy epochs
CREATE OR REPLACE FUNCTION fn_enforce_academy_participant_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT epoch_type FROM game_epochs WHERE id = NEW.epoch_id) = 'academy' THEN
    IF NOT NEW.is_bot AND (
      SELECT count(*) FROM epoch_participants
      WHERE epoch_id = NEW.epoch_id
        AND is_bot = FALSE
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) >= 1 THEN
      RAISE EXCEPTION 'Academy epochs allow only 1 human participant';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_academy_participant_limit
  BEFORE INSERT ON epoch_participants
  FOR EACH ROW
  EXECUTE FUNCTION fn_enforce_academy_participant_limit();
