-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 194: Achievement triggers — social badges + undefeated epoch
--                + fn_increment_progress_unique for deduplicated counters
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Implements:
--   1. fn_increment_progress_unique() — deduplicated progress counter RPC
--   2. embassy_builder  — 3 active embassies, credits BOTH sides
--   3. echo_sender      — 5 completed echoes (trigger on event_echoes.status)
--   4. undefeated       — epoch win with 0 detected missions
--
-- Ward master: NOT a DB trigger. Fires from Python echo_service when a ward
-- actually reduces an incoming echo (ward_reduction > 0). Uses
-- fn_increment_progress_unique via DungeonAchievementService pattern.
--
-- Pattern: matches existing achievement triggers from migration 190.
-- All trigger functions are SECURITY DEFINER.
-- Idempotent: CREATE OR REPLACE + ON CONFLICT.

-- ═══════════════════════════════════════════════════════════════════════════
-- 0. DEDUPLICATED PROGRESS COUNTER — for unique item tracking
-- ═══════════════════════════════════════════════════════════════════════════
-- Like fn_increment_progress but only counts each item_id once.
-- Stores seen IDs in achievement_progress.context->>'seen' as a JSONB array.
-- Used for banter_connoisseur (50 unique banter) and objektanker_finder (16 unique objects).

CREATE OR REPLACE FUNCTION fn_increment_progress_unique(
    p_user_id UUID,
    p_achievement_id TEXT,
    p_target INT,
    p_item_id TEXT,
    p_context JSONB DEFAULT '{}'
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_seen JSONB;
    v_new_count INT;
BEGIN
    -- Ensure progress row exists
    INSERT INTO achievement_progress (user_id, achievement_id, current_count, target_count)
    VALUES (p_user_id, p_achievement_id, 0, p_target)
    ON CONFLICT (user_id, achievement_id) DO NOTHING;

    -- Get current seen set
    SELECT COALESCE(context->'seen', '[]'::jsonb) INTO v_seen
    FROM achievement_progress
    WHERE user_id = p_user_id AND achievement_id = p_achievement_id;

    -- Check if item already seen
    IF v_seen @> to_jsonb(p_item_id) THEN
        -- Already counted, return current count unchanged
        SELECT current_count INTO v_new_count
        FROM achievement_progress
        WHERE user_id = p_user_id AND achievement_id = p_achievement_id;
        RETURN v_new_count;
    END IF;

    -- Append item and increment
    UPDATE achievement_progress
    SET current_count = current_count + 1,
        context = jsonb_set(
            COALESCE(context, '{}'::jsonb),
            '{seen}',
            COALESCE(context->'seen', '[]'::jsonb) || to_jsonb(p_item_id)
        ),
        updated_at = now()
    WHERE user_id = p_user_id AND achievement_id = p_achievement_id
    RETURNING current_count INTO v_new_count;

    -- Auto-award if threshold reached
    IF v_new_count >= p_target THEN
        PERFORM fn_award_achievement(p_user_id, p_achievement_id, p_context);
    END IF;

    RETURN v_new_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_increment_progress_unique(UUID, TEXT, INT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_increment_progress_unique(UUID, TEXT, INT, TEXT, JSONB) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. EMBASSY BUILDER — 3 active embassies (credits BOTH sides)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trg_ach_embassy_builder() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_a UUID;
    v_user_b UUID;
    v_active_count_a INT;
    v_active_count_b INT;
BEGIN
    IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
        -- Resolve both simulation owners
        SELECT s.created_by_id INTO v_user_a
        FROM simulations s WHERE s.id = NEW.simulation_a_id;

        SELECT s.created_by_id INTO v_user_b
        FROM simulations s WHERE s.id = NEW.simulation_b_id;

        -- Credit side A
        IF v_user_a IS NOT NULL THEN
            SELECT COUNT(*) INTO v_active_count_a
            FROM embassies
            WHERE (simulation_a_id IN (SELECT id FROM simulations WHERE created_by_id = v_user_a)
                OR simulation_b_id IN (SELECT id FROM simulations WHERE created_by_id = v_user_a))
              AND status = 'active';

            IF v_active_count_a >= 3 THEN
                PERFORM fn_award_achievement(v_user_a, 'embassy_builder',
                    jsonb_build_object('embassy_id', NEW.id::text));
            END IF;
        END IF;

        -- Credit side B (skip if same user as A)
        IF v_user_b IS NOT NULL AND (v_user_a IS NULL OR v_user_b != v_user_a) THEN
            SELECT COUNT(*) INTO v_active_count_b
            FROM embassies
            WHERE (simulation_a_id IN (SELECT id FROM simulations WHERE created_by_id = v_user_b)
                OR simulation_b_id IN (SELECT id FROM simulations WHERE created_by_id = v_user_b))
              AND status = 'active';

            IF v_active_count_b >= 3 THEN
                PERFORM fn_award_achievement(v_user_b, 'embassy_builder',
                    jsonb_build_object('embassy_id', NEW.id::text));
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_achievement_embassy_builder
    AFTER UPDATE OF status ON embassies
    FOR EACH ROW EXECUTE FUNCTION trg_ach_embassy_builder();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ECHO SENDER — 5 completed echo transmissions
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trg_ach_echo_sender() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Resolve user via simulation owner (consistent with forgemaster pattern)
        SELECT s.created_by_id INTO v_user_id
        FROM simulations s
        WHERE s.id = NEW.source_simulation_id;

        IF v_user_id IS NULL THEN RETURN NEW; END IF;

        PERFORM fn_increment_progress(v_user_id, 'echo_sender', 5,
            jsonb_build_object('echo_id', NEW.id::text));
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_achievement_echo_sender
    AFTER UPDATE OF status ON event_echoes
    FOR EACH ROW EXECUTE FUNCTION trg_ach_echo_sender();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. EXTEND EPOCH SCORE TRIGGER — add undefeated badge
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trg_ach_epoch_score() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_epoch_status TEXT;
    v_max_composite NUMERIC;
    v_is_winner BOOLEAN;
    v_detected_count INT;
BEGIN
    SELECT ge.status INTO v_epoch_status
    FROM game_epochs ge WHERE ge.id = NEW.epoch_id;

    IF v_epoch_status != 'completed' THEN RETURN NEW; END IF;

    SELECT MAX(composite_score) INTO v_max_composite
    FROM epoch_scores
    WHERE epoch_id = NEW.epoch_id AND cycle_number = NEW.cycle_number;

    v_is_winner := (NEW.composite_score >= v_max_composite AND NEW.composite_score > 0);

    IF NOT v_is_winner THEN RETURN NEW; END IF;

    SELECT ep.user_id INTO v_user_id
    FROM epoch_participants ep
    WHERE ep.epoch_id = NEW.epoch_id
      AND ep.simulation_id = NEW.simulation_id
      AND ep.is_bot = FALSE
    LIMIT 1;

    IF v_user_id IS NULL THEN RETURN NEW; END IF;

    -- Existing: master_strategist progress
    PERFORM fn_increment_progress(v_user_id, 'master_strategist', 3,
        jsonb_build_object('epoch_id', NEW.epoch_id::text));

    -- New: undefeated — win with 0 detected missions across the epoch
    SELECT COUNT(*) INTO v_detected_count
    FROM operative_missions om
    WHERE om.epoch_id = NEW.epoch_id
      AND om.source_simulation_id = NEW.simulation_id
      AND om.status = 'detected';

    IF v_detected_count = 0 THEN
        PERFORM fn_award_achievement(v_user_id, 'undefeated',
            jsonb_build_object('epoch_id', NEW.epoch_id::text));
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger already attached from migration 190, no re-CREATE needed.
