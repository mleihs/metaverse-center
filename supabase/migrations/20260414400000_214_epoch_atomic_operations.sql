-- Migration 214: Epoch Atomic Operations
--
-- Replaces Python check-then-act patterns with atomic Postgres RPCs.
-- Each RPC executes in a single statement or transaction, eliminating
-- TOCTOU race conditions under concurrent access.
--
-- RPCs created:
--   1. fn_spend_rp_atomic          — atomic RP deduction (replaces optimistic lock)
--   2. fn_join_epoch_atomic         — atomic participant insert (ON CONFLICT)
--   3. fn_join_team_checked         — atomic team join with size enforcement
--   4. fn_create_sabotage_capped    — atomic sabotage event with cap enforcement
--   5. fn_increment_academy_counter — atomic counter increment
--   6. fn_deploy_operative_atomic   — atomic RP spend + mission insert
--   7. fn_process_afk_batch         — atomic batch AFK penalty processing
--   8. fn_replace_afk_with_bot      — atomic bot creation + participant link
--   9. fn_apply_betrayal            — atomic betrayal: clear team + penalty + log
--  10. fn_dissolve_alliance_atomic  — atomic team dissolution + member cleanup
--  11. fn_detect_enemy_batch        — atomic batch mission detection
--  12. fn_advance_mission_timers    — atomic batch timer advancement

-- ═══════════════════════════════════════════════════════════════════
-- 1. fn_spend_rp_atomic
-- ═══════════════════════════════════════════════════════════════════
-- Replaces: cycle_resolution_service.py spend_rp() optimistic lock pattern.
-- Single atomic UPDATE with WHERE current_rp >= amount.
-- Returns new balance, or NULL if insufficient RP.

CREATE OR REPLACE FUNCTION public.fn_spend_rp_atomic(
    p_epoch_id   UUID,
    p_simulation_id UUID,
    p_amount     INT
)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
AS $$
    UPDATE public.epoch_participants
    SET current_rp = current_rp - p_amount
    WHERE epoch_id = p_epoch_id
      AND simulation_id = p_simulation_id
      AND current_rp >= p_amount
    RETURNING current_rp;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. fn_join_epoch_atomic
-- ═══════════════════════════════════════════════════════════════════
-- Replaces: epoch_participation_service.py join_epoch() TOCTOU check.
-- Uses ON CONFLICT DO NOTHING on (epoch_id, simulation_id) unique index.
-- Returns participant id, or NULL if already exists.

CREATE OR REPLACE FUNCTION public.fn_join_epoch_atomic(
    p_epoch_id      UUID,
    p_simulation_id UUID,
    p_user_id       UUID,
    p_initial_rp    INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Check user not already in epoch with different sim
    IF p_user_id IS NOT NULL THEN
        PERFORM 1 FROM public.epoch_participants
        WHERE epoch_id = p_epoch_id AND user_id = p_user_id;
        IF FOUND THEN
            RETURN NULL;  -- User already in epoch
        END IF;
    END IF;

    INSERT INTO public.epoch_participants (
        epoch_id, simulation_id, user_id, current_rp, joined_at
    ) VALUES (
        p_epoch_id, p_simulation_id, p_user_id, p_initial_rp, NOW()
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_id;

    RETURN v_id;  -- NULL if simulation already in epoch
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. fn_join_team_checked
-- ═══════════════════════════════════════════════════════════════════
-- Replaces: epoch_participation_service.py join_team() count-then-join.
-- Atomically checks team size and joins in one statement.
-- Returns true if joined, false if team full.

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
        RETURN NULL;  -- team not found or dissolved (distinct from false=full)
    END IF;

    -- Lock the team's current members to prevent concurrent joins
    SELECT COUNT(*) INTO v_current_count
    FROM public.epoch_participants
    WHERE epoch_id = p_epoch_id AND team_id = p_team_id
    FOR UPDATE;

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

-- ═══════════════════════════════════════════════════════════════════
-- 4. fn_create_sabotage_capped
-- ═══════════════════════════════════════════════════════════════════
-- Replaces: operative_mission_service.py sabotage event count-then-insert.
-- Atomically enforces max active sabotage events per simulation.

CREATE OR REPLACE FUNCTION public.fn_create_sabotage_capped(
    p_simulation_id  UUID,
    p_event_data     JSONB,
    p_max_active     INT DEFAULT 3
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_count INT;
    v_id UUID;
BEGIN
    -- Lock and count active sabotage events
    SELECT COUNT(*) INTO v_current_count
    FROM public.events
    WHERE simulation_id = p_simulation_id
      AND data_source = 'sabotage'
      AND event_status = 'active'
    FOR UPDATE;

    IF v_current_count >= p_max_active THEN
        RETURN NULL;  -- Cap reached
    END IF;

    INSERT INTO public.events (
        simulation_id, event_name, event_description,
        event_status, data_source, event_type, severity
    ) VALUES (
        p_simulation_id,
        p_event_data->>'event_name',
        p_event_data->>'event_description',
        'active',
        'sabotage',
        COALESCE(p_event_data->>'event_type', 'crisis'),
        COALESCE(p_event_data->>'severity', 'high')
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 5. fn_increment_academy_counter
-- ═══════════════════════════════════════════════════════════════════
-- Replaces: epoch_lifecycle_service.py read-then-write academy counter.

CREATE OR REPLACE FUNCTION public.fn_increment_academy_counter(
    p_user_id UUID
)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
AS $$
    UPDATE public.user_profiles
    SET academy_epochs_played = COALESCE(academy_epochs_played, 0) + 1
    WHERE id = p_user_id
    RETURNING academy_epochs_played;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 6. fn_deploy_operative_atomic
-- ═══════════════════════════════════════════════════════════════════
-- Replaces: operative_mission_service.py separate RP spend + mission insert.
-- Single transaction: validates RP, deducts, inserts mission.
-- Returns mission row as JSONB, or error object.

CREATE OR REPLACE FUNCTION public.fn_deploy_operative_atomic(
    p_epoch_id          UUID,
    p_simulation_id     UUID,
    p_agent_id          UUID,
    p_operative_type    TEXT,
    p_cost_rp           INT,
    p_target_simulation_id UUID DEFAULT NULL,
    p_target_zone_id    UUID DEFAULT NULL,
    p_target_entity_id  UUID DEFAULT NULL,
    p_target_entity_type TEXT DEFAULT NULL,
    p_embassy_id        UUID DEFAULT NULL,
    p_success_probability FLOAT DEFAULT NULL,
    p_resolves_at       TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_participant_id UUID;
    v_new_rp INT;
    v_mission_id UUID;
BEGIN
    -- Atomic RP deduction (validates sufficient balance)
    UPDATE public.epoch_participants
    SET current_rp = current_rp - p_cost_rp
    WHERE epoch_id = p_epoch_id
      AND simulation_id = p_simulation_id
      AND current_rp >= p_cost_rp
    RETURNING id, current_rp INTO v_participant_id, v_new_rp;

    IF v_participant_id IS NULL THEN
        RETURN jsonb_build_object('error', 'insufficient_rp');
    END IF;

    -- Insert mission
    INSERT INTO public.operative_missions (
        epoch_id, agent_id, operative_type, source_simulation_id,
        target_simulation_id, target_zone_id, target_entity_id,
        target_entity_type, embassy_id, cost_rp, success_probability,
        status, deployed_at, resolves_at
    ) VALUES (
        p_epoch_id, p_agent_id, p_operative_type, p_simulation_id,
        p_target_simulation_id, p_target_zone_id, p_target_entity_id,
        p_target_entity_type, p_embassy_id, p_cost_rp, p_success_probability,
        'deploying', NOW(), p_resolves_at
    )
    RETURNING id INTO v_mission_id;

    RETURN jsonb_build_object(
        'mission_id', v_mission_id,
        'new_rp', v_new_rp,
        'participant_id', v_participant_id
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 7. fn_process_afk_batch
-- ═══════════════════════════════════════════════════════════════════
-- Replaces: epoch_cycle_scheduler.py N individual AFK updates.
-- Single UPDATE with CASE for graduated penalties.
-- Returns affected participants with their new state.

CREATE OR REPLACE FUNCTION public.fn_process_afk_batch(
    p_epoch_id              UUID,
    p_penalty_rp            INT,
    p_escalation_threshold  INT,
    p_rp_multiplier         FLOAT DEFAULT 2.5
)
RETURNS TABLE(
    participant_id UUID,
    simulation_id UUID,
    user_id UUID,
    new_consecutive INT,
    rp_loss INT,
    needs_ai_takeover BOOLEAN,
    new_rp INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    UPDATE public.epoch_participants ep
    SET
        consecutive_afk_cycles = ep.consecutive_afk_cycles + 1,
        total_afk_cycles = ep.total_afk_cycles + 1,
        current_rp = GREATEST(0, ep.current_rp - CASE
            WHEN (ep.consecutive_afk_cycles + 1) < 2 THEN 0
            WHEN (ep.consecutive_afk_cycles + 1) = 2 THEN p_penalty_rp
            ELSE (p_penalty_rp * POWER(p_rp_multiplier, (ep.consecutive_afk_cycles + 1) - 2))::INT
        END)
    WHERE ep.epoch_id = p_epoch_id
      AND ep.has_acted_this_cycle = false
      AND ep.cycle_ready = false
      AND ep.is_bot = false
      AND ep.afk_replaced_by_ai = false
    RETURNING
        ep.id AS participant_id,
        ep.simulation_id,
        ep.user_id,
        ep.consecutive_afk_cycles AS new_consecutive,
        CASE
            WHEN ep.consecutive_afk_cycles < 2 THEN 0
            WHEN ep.consecutive_afk_cycles = 2 THEN p_penalty_rp
            ELSE (p_penalty_rp * POWER(p_rp_multiplier, ep.consecutive_afk_cycles - 2))::INT
        END AS rp_loss,
        (ep.consecutive_afk_cycles >= p_escalation_threshold + 1) AS needs_ai_takeover,
        ep.current_rp AS new_rp;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 8. fn_replace_afk_with_bot
-- ═══════════════════════════════════════════════════════════════════
-- Replaces: epoch_cycle_scheduler.py non-atomic bot insert + participant update.
-- Single transaction: creates bot_players row, links to participant.

CREATE OR REPLACE FUNCTION public.fn_replace_afk_with_bot(
    p_participant_id UUID,
    p_bot_name       TEXT,
    p_personality    TEXT,
    p_difficulty     TEXT DEFAULT 'easy',
    p_created_by_id  UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bot_id UUID;
BEGIN
    INSERT INTO public.bot_players (name, personality, difficulty, created_by_id)
    VALUES (p_bot_name, p_personality, p_difficulty, p_created_by_id)
    RETURNING id INTO v_bot_id;

    UPDATE public.epoch_participants
    SET is_bot = true,
        bot_player_id = v_bot_id,
        afk_replaced_by_ai = true
    WHERE id = p_participant_id;

    RETURN v_bot_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 9. fn_apply_betrayal
-- ═══════════════════════════════════════════════════════════════════
-- Replaces: operative_mission_service.py 3 separate writes for betrayal.
-- Single transaction: clears team_id, applies penalty, logs to battle_log.

CREATE OR REPLACE FUNCTION public.fn_apply_betrayal(
    p_epoch_id      UUID,
    p_cycle_number  INT,
    p_betrayer_sim  UUID,
    p_victim_sim    UUID,
    p_penalty       FLOAT DEFAULT 0.25,
    p_detected      BOOLEAN DEFAULT true
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_team_id UUID;
BEGIN
    -- Get betrayer's team for dissolution check
    SELECT team_id INTO v_team_id
    FROM public.epoch_participants
    WHERE epoch_id = p_epoch_id AND simulation_id = p_betrayer_sim;

    -- Clear betrayer from team
    UPDATE public.epoch_participants
    SET team_id = NULL
    WHERE epoch_id = p_epoch_id AND simulation_id = p_betrayer_sim;

    -- Apply betrayal penalty to victim's scoring multiplier
    UPDATE public.epoch_participants
    SET final_scores = COALESCE(final_scores, '{}'::jsonb) ||
        jsonb_build_object('betrayal_penalty',
            COALESCE((final_scores->>'betrayal_penalty')::FLOAT, 0) + p_penalty
        )
    WHERE epoch_id = p_epoch_id AND simulation_id = p_victim_sim;

    -- Log betrayal event
    INSERT INTO public.battle_log (
        epoch_id, cycle_number, event_type, narrative,
        source_simulation_id, target_simulation_id, is_public
    ) VALUES (
        p_epoch_id, p_cycle_number, 'betrayal',
        'An operative turned against their own alliance.',
        p_betrayer_sim, p_victim_sim, p_detected
    );

    RETURN true;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 10. fn_dissolve_alliance_atomic
-- ═══════════════════════════════════════════════════════════════════
-- Replaces: alliance_service.py 3 cascading writes for dissolution.
-- Single transaction: marks team dissolved + clears member team_ids.

CREATE OR REPLACE FUNCTION public.fn_dissolve_alliance_atomic(
    p_epoch_id UUID,
    p_team_id  UUID,
    p_reason   TEXT DEFAULT 'tension'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_affected INT;
BEGIN
    -- Mark team dissolved
    UPDATE public.epoch_teams
    SET dissolved_at = NOW(),
        dissolved_reason = p_reason
    WHERE id = p_team_id
      AND epoch_id = p_epoch_id
      AND dissolved_at IS NULL;

    -- Clear team_id from all members
    UPDATE public.epoch_participants
    SET team_id = NULL
    WHERE epoch_id = p_epoch_id
      AND team_id = p_team_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;

    RETURN v_affected;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 11. fn_detect_enemy_batch
-- ═══════════════════════════════════════════════════════════════════
-- Replaces: operative_mission_service.py N individual mission updates in counter-intel.
-- Single UPDATE for all matching enemy operations.

CREATE OR REPLACE FUNCTION public.fn_detect_enemy_batch(
    p_epoch_id   UUID,
    p_target_sim UUID
)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH detected AS (
        UPDATE public.operative_missions
        SET status = 'detected'
        WHERE epoch_id = p_epoch_id
          AND target_simulation_id = p_target_sim
          AND status IN ('deploying', 'active')
          AND operative_type != 'guardian'
        RETURNING id
    )
    SELECT COUNT(*)::INT FROM detected;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 12. fn_advance_mission_timers
-- ═══════════════════════════════════════════════════════════════════
-- Replaces: cycle_resolution_service.py read-group-batch-update for timers.
-- Single UPDATE advancing all active mission timers by one cycle.

CREATE OR REPLACE FUNCTION public.fn_advance_mission_timers(
    p_epoch_id    UUID,
    p_cycle_hours INT
)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH advanced AS (
        UPDATE public.operative_missions
        SET resolves_at = resolves_at - (p_cycle_hours || ' hours')::INTERVAL
        WHERE epoch_id = p_epoch_id
          AND status IN ('deploying', 'active')
          AND operative_type != 'guardian'
        RETURNING id
    )
    SELECT COUNT(*)::INT FROM advanced;
$$;
