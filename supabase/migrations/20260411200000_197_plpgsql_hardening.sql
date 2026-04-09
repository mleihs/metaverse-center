-- ============================================================================
-- Migration 197: PL/pgSQL Security & Concurrency Hardening
-- ============================================================================
--
-- K2: fn_add_moodlet_capped — advisory lock to prevent stacking cap violation
--     under concurrent load. The existing COUNT check (migration 162) has a
--     TOCTOU race: two concurrent calls both read count=4, both insert,
--     exceeding the cap of 5. Advisory lock serializes per-agent access.
--
-- H1: SET search_path = public on 8 SECURITY DEFINER functions.
--     Without this, search_path injection is possible. All functions are
--     recreated with identical logic, only the search_path clause is added.
--
-- Functions modified:
--   1. fn_add_moodlet_capped         (K2 + already had SET search_path)
--   2. fn_compute_cycle_scores       (H1)
--   3. fn_auto_draft_participants    (H1)
--   4. get_message_reactions         (H1)
--   5. toggle_message_reaction       (H1)
--   6. fn_get_ward_strength          (H1)
--   7. fn_award_achievement          (H1)
--   8. fn_increment_progress         (H1)
--   9. fn_increment_progress_unique  (H1)
-- ============================================================================


-- ============================================================================
-- 1. K2 FIX: fn_add_moodlet_capped — advisory lock for stacking cap
-- ============================================================================
-- Original: migration 162. Only change: pg_advisory_xact_lock before COUNT.
-- Lock is per-agent, in-memory, released at transaction end. Zero I/O overhead.

CREATE OR REPLACE FUNCTION fn_add_moodlet_capped(
  p_agent_id UUID,
  p_simulation_id UUID,
  p_moodlet_type TEXT,
  p_emotion TEXT,
  p_strength INTEGER,
  p_source_type TEXT,
  p_source_id UUID DEFAULT NULL,
  p_source_description TEXT DEFAULT NULL,
  p_decay_type TEXT DEFAULT 'timed',
  p_initial_strength INTEGER DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_stacking_group TEXT DEFAULT NULL,
  p_stacking_cap INTEGER DEFAULT 5
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
  v_clamped_strength INTEGER;
BEGIN
  v_clamped_strength := GREATEST(-20, LEAST(20, p_strength));

  IF p_stacking_group IS NOT NULL THEN
    -- K2 FIX: Advisory lock per agent serializes concurrent cap checks.
    -- hashtext returns INT4, stable across sessions. Lock auto-releases
    -- at transaction end (xact variant, not session).
    PERFORM pg_advisory_xact_lock(hashtext('moodlet_cap_' || p_agent_id::text));

    SELECT COUNT(*)::INTEGER INTO v_current_count
    FROM agent_moodlets
    WHERE agent_id = p_agent_id
      AND stacking_group = p_stacking_group;

    IF v_current_count >= p_stacking_cap THEN
      RETURN FALSE;
    END IF;
  END IF;

  INSERT INTO agent_moodlets (
    agent_id, simulation_id, moodlet_type, emotion, strength,
    source_type, source_id, source_description,
    decay_type, initial_strength, expires_at, stacking_group
  ) VALUES (
    p_agent_id, p_simulation_id, p_moodlet_type, p_emotion, v_clamped_strength,
    p_source_type, p_source_id, p_source_description,
    p_decay_type, COALESCE(p_initial_strength, p_strength), p_expires_at, p_stacking_group
  );

  IF v_clamped_strength < 0 THEN
    PERFORM fn_add_agent_stress(p_agent_id, ABS(v_clamped_strength) * 1.5);
  END IF;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION fn_add_moodlet_capped IS
  'Atomic moodlet insertion with stacking cap enforcement. '
  'Uses pg_advisory_xact_lock per agent to prevent concurrent cap violations. '
  'Returns TRUE if inserted, FALSE if stacking cap reached.';

GRANT EXECUTE ON FUNCTION fn_add_moodlet_capped TO service_role;


-- ============================================================================
-- 2. H1: fn_compute_cycle_scores — add SET search_path
-- ============================================================================
-- Original: migration 187. Only change: SET search_path = public.

CREATE OR REPLACE FUNCTION fn_compute_cycle_scores(
    p_epoch_id   UUID,
    p_cycle_number INT,
    p_score_weights JSONB DEFAULT '{"stability":25,"influence":20,"sovereignty":20,"diplomatic":15,"military":20}'
)
RETURNS SETOF epoch_scores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    w_stability  NUMERIC := COALESCE((p_score_weights->>'stability')::NUMERIC, 25);
    w_influence  NUMERIC := COALESCE((p_score_weights->>'influence')::NUMERIC, 20);
    w_sovereignty NUMERIC := COALESCE((p_score_weights->>'sovereignty')::NUMERIC, 20);
    w_diplomatic NUMERIC := COALESCE((p_score_weights->>'diplomatic')::NUMERIC, 15);
    w_military   NUMERIC := COALESCE((p_score_weights->>'military')::NUMERIC, 20);
BEGIN
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_building_readiness;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_zone_stability;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_embassy_effectiveness;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_simulation_health;
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW mv_building_readiness;
        REFRESH MATERIALIZED VIEW mv_zone_stability;
        REFRESH MATERIALIZED VIEW mv_embassy_effectiveness;
        REFRESH MATERIALIZED VIEW mv_simulation_health;
    END;

    RETURN QUERY
    WITH participants AS (
        SELECT ep.simulation_id
        FROM epoch_participants ep
        WHERE ep.epoch_id = p_epoch_id
    ),
    zone_stab AS (
        SELECT p.simulation_id,
               COALESCE(AVG(zs.stability) * 100, 50.0) AS base_stability
        FROM participants p
        LEFT JOIN mv_zone_stability zs ON zs.simulation_id = p.simulation_id
        GROUP BY p.simulation_id
    ),
    propaganda AS (
        SELECT p.simulation_id,
               COUNT(e.id) AS propaganda_count
        FROM participants p
        LEFT JOIN events e ON e.simulation_id = p.simulation_id
                          AND e.data_source = 'propagandist'
        GROUP BY p.simulation_id
    ),
    inbound_missions AS (
        SELECT p.simulation_id,
               COUNT(*) FILTER (WHERE om.target_simulation_id = p.simulation_id
                   AND om.status = 'success' AND om.operative_type = 'saboteur') AS inbound_saboteur,
               COUNT(*) FILTER (WHERE om.target_simulation_id = p.simulation_id
                   AND om.status = 'success' AND om.operative_type = 'assassin') AS inbound_assassin,
               COALESCE(SUM(CASE
                   WHEN om.target_simulation_id = p.simulation_id AND om.status = 'success' THEN
                       CASE om.operative_type
                           WHEN 'spy' THEN 2 WHEN 'propagandist' THEN 6
                           WHEN 'infiltrator' THEN 8 WHEN 'saboteur' THEN 8
                           WHEN 'assassin' THEN 12 ELSE 5
                       END
                   ELSE 0
               END), 0) AS sovereignty_penalty,
               COUNT(*) FILTER (WHERE om.target_simulation_id = p.simulation_id
                   AND om.status IN ('detected', 'captured')) AS detected_count
        FROM participants p
        LEFT JOIN operative_missions om ON om.epoch_id = p_epoch_id
            AND om.target_simulation_id = p.simulation_id
            AND om.status IN ('success', 'detected', 'captured')
        GROUP BY p.simulation_id
    ),
    outbound_missions AS (
        SELECT p.simulation_id,
               COUNT(*) FILTER (WHERE om.status = 'success' AND om.operative_type = 'propagandist') AS propagandist_wins,
               COUNT(*) FILTER (WHERE om.status = 'success' AND om.operative_type = 'spy') AS spy_wins,
               COUNT(*) FILTER (WHERE om.status = 'success' AND om.operative_type = 'infiltrator') AS infiltrator_wins,
               COALESCE(SUM(CASE
                   WHEN om.status = 'success' THEN
                       CASE om.operative_type
                           WHEN 'spy' THEN 3 WHEN 'saboteur' THEN 5
                           WHEN 'propagandist' THEN 4 WHEN 'assassin' THEN 8
                           WHEN 'infiltrator' THEN 6 ELSE 2
                       END
                       + LEAST(4, COALESCE(tg.guardian_count, 0) * 2)
                   WHEN om.status IN ('detected', 'captured') THEN -3
                   ELSE 0
               END), 0) AS military_raw
        FROM participants p
        LEFT JOIN operative_missions om ON om.epoch_id = p_epoch_id
            AND om.source_simulation_id = p.simulation_id
            AND om.status IN ('success', 'failed', 'detected', 'captured')
        LEFT JOIN LATERAL (
            SELECT COUNT(*) AS guardian_count
            FROM operative_missions gm
            WHERE gm.epoch_id = p_epoch_id
              AND gm.source_simulation_id = om.target_simulation_id
              AND gm.operative_type = 'guardian'
              AND gm.status = 'active'
        ) tg ON om.status = 'success'
        GROUP BY p.simulation_id
    ),
    echo_strength AS (
        SELECT p.simulation_id,
               COALESCE(SUM(ee.echo_strength), 0) AS echo_sum
        FROM participants p
        LEFT JOIN event_echoes ee ON ee.source_simulation_id = p.simulation_id
                                 AND ee.status = 'completed'
        GROUP BY p.simulation_id
    ),
    embassy_data AS (
        SELECT p.simulation_id,
               COALESCE(SUM(me.effectiveness), 0) AS total_effectiveness,
               COUNT(emb.id) AS embassy_count
        FROM participants p
        LEFT JOIN mv_embassy_effectiveness me
            ON (me.simulation_a_id = p.simulation_id OR me.simulation_b_id = p.simulation_id)
        LEFT JOIN embassies emb
            ON emb.status = 'active'
            AND (emb.simulation_a_id = p.simulation_id OR emb.simulation_b_id = p.simulation_id)
        GROUP BY p.simulation_id
    ),
    team_data AS (
        SELECT ep.simulation_id,
               ep.team_id,
               COALESCE(ep.betrayal_penalty, 0) AS betrayal_penalty,
               CASE WHEN ep.team_id IS NOT NULL THEN
                   (SELECT COUNT(*) - 1 FROM epoch_participants ep2
                    WHERE ep2.team_id = ep.team_id AND ep2.epoch_id = p_epoch_id)
               ELSE 0 END AS ally_count,
               (SELECT COUNT(*) FROM operative_missions om
                WHERE om.epoch_id = p_epoch_id
                  AND om.source_simulation_id = ep.simulation_id
                  AND om.operative_type = 'spy'
                  AND om.status = 'success') AS spy_bonus
        FROM epoch_participants ep
        WHERE ep.epoch_id = p_epoch_id
    ),
    guardian_counts AS (
        SELECT p.simulation_id,
               COUNT(*) FILTER (WHERE om.operative_type = 'guardian'
                   AND om.status = 'active') AS guardian_count
        FROM participants p
        LEFT JOIN operative_missions om ON om.epoch_id = p_epoch_id
            AND om.source_simulation_id = p.simulation_id
        GROUP BY p.simulation_id
    ),
    raw_scores AS (
        SELECT p.simulation_id,
               GREATEST(0, zs.base_stability
                   - COALESCE(pr.propaganda_count, 0) * 3
                   - COALESCE(ib.inbound_saboteur, 0) * 6
                   - COALESCE(ib.inbound_assassin, 0) * 5
               ) AS stability,
               COALESCE(ob.propagandist_wins, 0) * 5
                   + COALESCE(ob.spy_wins, 0) * 2
                   + COALESCE(ob.infiltrator_wins, 0) * 3
                   + COALESCE(es.echo_sum, 0)
               AS influence,
               GREATEST(0, LEAST(100,
                   100.0
                   - COALESCE(ib.sovereignty_penalty, 0)
                   + COALESCE(ib.detected_count, 0) * 3
                   + COALESCE(gc.guardian_count, 0) * 4
               )) AS sovereignty,
               (CASE WHEN COALESCE(ed.total_effectiveness, 0) = 0
                     THEN COALESCE(ed.embassy_count, 0) * 0.5
                     ELSE ed.total_effectiveness
                END * 10 + COALESCE(td.spy_bonus, 0))
               * (1.0 + 0.15 * COALESCE(td.ally_count, 0))
               * (1.0 - COALESCE(td.betrayal_penalty, 0))
               AS diplomatic,
               GREATEST(0, COALESCE(ob.military_raw, 0)) AS military
        FROM participants p
        LEFT JOIN zone_stab zs ON zs.simulation_id = p.simulation_id
        LEFT JOIN propaganda pr ON pr.simulation_id = p.simulation_id
        LEFT JOIN inbound_missions ib ON ib.simulation_id = p.simulation_id
        LEFT JOIN outbound_missions ob ON ob.simulation_id = p.simulation_id
        LEFT JOIN echo_strength es ON es.simulation_id = p.simulation_id
        LEFT JOIN embassy_data ed ON ed.simulation_id = p.simulation_id
        LEFT JOIN team_data td ON td.simulation_id = p.simulation_id
        LEFT JOIN guardian_counts gc ON gc.simulation_id = p.simulation_id
    ),
    maxes AS (
        SELECT
            GREATEST(MAX(stability), 1) AS max_stability,
            GREATEST(MAX(influence), 1) AS max_influence,
            GREATEST(MAX(sovereignty), 1) AS max_sovereignty,
            GREATEST(MAX(diplomatic), 1) AS max_diplomatic,
            GREATEST(MAX(military), 1) AS max_military
        FROM raw_scores
    ),
    normalized AS (
        SELECT rs.simulation_id,
               rs.stability, rs.influence, rs.sovereignty, rs.diplomatic, rs.military,
               (rs.stability / m.max_stability) * 100 AS norm_stability,
               (rs.influence / m.max_influence) * 100 AS norm_influence,
               (rs.sovereignty / m.max_sovereignty) * 100 AS norm_sovereignty,
               (rs.diplomatic / m.max_diplomatic) * 100 AS norm_diplomatic,
               (rs.military / m.max_military) * 100 AS norm_military
        FROM raw_scores rs
        CROSS JOIN maxes m
    ),
    composited AS (
        SELECT n.simulation_id,
               n.stability, n.influence, n.sovereignty, n.diplomatic, n.military,
               ROUND((
                   n.norm_stability * w_stability / 100
                   + n.norm_influence * w_influence / 100
                   + n.norm_sovereignty * w_sovereignty / 100
                   + n.norm_diplomatic * w_diplomatic / 100
                   + n.norm_military * w_military / 100
               )::NUMERIC, 2) AS composite
        FROM normalized n
    )

    INSERT INTO epoch_scores (epoch_id, simulation_id, cycle_number,
        stability_score, influence_score, sovereignty_score,
        diplomatic_score, military_score, composite_score)
    SELECT p_epoch_id, c.simulation_id, p_cycle_number,
           c.stability, c.influence, c.sovereignty,
           c.diplomatic, c.military, c.composite
    FROM composited c
    ON CONFLICT (epoch_id, simulation_id, cycle_number)
    DO UPDATE SET
        stability_score  = EXCLUDED.stability_score,
        influence_score  = EXCLUDED.influence_score,
        sovereignty_score = EXCLUDED.sovereignty_score,
        diplomatic_score = EXCLUDED.diplomatic_score,
        military_score   = EXCLUDED.military_score,
        composite_score  = EXCLUDED.composite_score,
        computed_at      = NOW()
    RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_compute_cycle_scores(UUID, INT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_compute_cycle_scores(UUID, INT, JSONB) TO service_role;


-- ============================================================================
-- 3. H1: fn_auto_draft_participants — add SET search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_auto_draft_participants(
    p_epoch_id   UUID,
    p_max_agents INT DEFAULT 6
)
RETURNS SETOF epoch_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH undrafted AS (
        SELECT ep.id, ep.simulation_id
        FROM epoch_participants ep
        WHERE ep.epoch_id = p_epoch_id
          AND ep.drafted_agent_ids IS NULL
    ),
    ranked AS (
        SELECT a.id AS agent_id, a.simulation_id,
               ROW_NUMBER() OVER (
                   PARTITION BY a.simulation_id ORDER BY a.created_at
               ) AS rn
        FROM agents a
        JOIN undrafted u ON a.simulation_id = u.simulation_id
        WHERE a.deleted_at IS NULL
    ),
    draft_sets AS (
        SELECT r.simulation_id,
               ARRAY_AGG(r.agent_id ORDER BY r.rn) AS ids
        FROM ranked r
        WHERE r.rn <= p_max_agents
        GROUP BY r.simulation_id
    )
    UPDATE epoch_participants ep
    SET drafted_agent_ids   = ds.ids,
        draft_completed_at  = NOW()
    FROM draft_sets ds
    JOIN undrafted u ON u.simulation_id = ds.simulation_id
    WHERE ep.id = u.id
      AND ep.drafted_agent_ids IS NULL
    RETURNING ep.*;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_auto_draft_participants(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_auto_draft_participants(UUID, INT) TO service_role;


-- ============================================================================
-- 4. H1: get_message_reactions — add SET search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION get_message_reactions(p_message_ids UUID[])
RETURNS TABLE (
    message_id UUID,
    emoji TEXT,
    count BIGINT,
    reacted_by_me BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.message_id,
        r.emoji,
        COUNT(*)::BIGINT AS count,
        BOOL_OR(r.user_id = auth.uid()) AS reacted_by_me
    FROM chat_message_reactions r
    WHERE r.message_id = ANY(p_message_ids)
    GROUP BY r.message_id, r.emoji
    ORDER BY r.message_id, MIN(r.created_at);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_message_reactions(UUID[]) TO authenticated;


-- ============================================================================
-- 5. H1: toggle_message_reaction — add SET search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION toggle_message_reaction(
    p_message_id UUID,
    p_emoji TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_deleted BOOLEAN;
BEGIN
    DELETE FROM chat_message_reactions
    WHERE message_id = p_message_id
      AND user_id = auth.uid()
      AND emoji = p_emoji;

    IF FOUND THEN
        RETURN 'removed';
    END IF;

    INSERT INTO chat_message_reactions (message_id, user_id, emoji)
    VALUES (p_message_id, auth.uid(), p_emoji);

    RETURN 'added';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION toggle_message_reaction(UUID, TEXT) TO authenticated;


-- ============================================================================
-- 6. H1: fn_get_ward_strength — add SET search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_get_ward_strength(
    p_target_simulation_id UUID,
    p_echo_vector TEXT
) RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_strength NUMERIC := 0.0;
BEGIN
    SELECT COALESCE(MAX(e.ward_strength), 0.0) INTO v_strength
    FROM embassies e
    WHERE e.status = 'active'
      AND e.ward_vector = p_echo_vector
      AND (e.simulation_a_id = p_target_simulation_id
           OR e.simulation_b_id = p_target_simulation_id);

    RETURN v_strength;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_get_ward_strength(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_ward_strength(UUID, TEXT) TO service_role;


-- ============================================================================
-- 7. H1: fn_award_achievement — add SET search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_award_achievement(
    p_user_id UUID,
    p_achievement_id TEXT,
    p_context JSONB DEFAULT '{}'
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row_count INTEGER := 0;
BEGIN
    INSERT INTO user_achievements (user_id, achievement_id, context)
    VALUES (p_user_id, p_achievement_id, p_context)
    ON CONFLICT (user_id, achievement_id) DO NOTHING;

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    RETURN v_row_count > 0;
END;
$$;

-- Maintain grant state from migration 195 (revoked from authenticated)
REVOKE EXECUTE ON FUNCTION fn_award_achievement(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_award_achievement(UUID, TEXT, JSONB) TO service_role;


-- ============================================================================
-- 8. H1: fn_increment_progress — add SET search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_increment_progress(
    p_user_id UUID,
    p_achievement_id TEXT,
    p_target INT,
    p_context JSONB DEFAULT '{}'
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    INSERT INTO achievement_progress (user_id, achievement_id, current_count, target_count, updated_at)
    VALUES (p_user_id, p_achievement_id, 1, p_target, now())
    ON CONFLICT (user_id, achievement_id)
    DO UPDATE SET current_count = achievement_progress.current_count + 1,
                  updated_at = now()
    RETURNING current_count INTO v_count;

    IF v_count >= p_target THEN
        PERFORM fn_award_achievement(p_user_id, p_achievement_id, p_context);
    END IF;

    RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_increment_progress(UUID, TEXT, INT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_increment_progress(UUID, TEXT, INT, JSONB) TO service_role;


-- ============================================================================
-- 9. H1: fn_increment_progress_unique — add SET search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_increment_progress_unique(
    p_user_id UUID,
    p_achievement_id TEXT,
    p_target INT,
    p_item_id TEXT,
    p_context JSONB DEFAULT '{}'
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_seen JSONB;
    v_new_count INT;
BEGIN
    IF p_item_id IS NULL THEN RETURN 0; END IF;

    INSERT INTO achievement_progress (user_id, achievement_id, current_count, target_count)
    VALUES (p_user_id, p_achievement_id, 0, p_target)
    ON CONFLICT (user_id, achievement_id) DO NOTHING;

    SELECT COALESCE(context->'seen', '[]'::jsonb) INTO v_seen
    FROM achievement_progress
    WHERE user_id = p_user_id AND achievement_id = p_achievement_id;

    IF v_seen @> to_jsonb(p_item_id) THEN
        SELECT current_count INTO v_new_count
        FROM achievement_progress
        WHERE user_id = p_user_id AND achievement_id = p_achievement_id;
        RETURN v_new_count;
    END IF;

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

    IF v_new_count >= p_target THEN
        PERFORM fn_award_achievement(p_user_id, p_achievement_id, p_context);
    END IF;

    RETURN v_new_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_increment_progress_unique(UUID, TEXT, INT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_increment_progress_unique(UUID, TEXT, INT, TEXT, JSONB) TO service_role;
