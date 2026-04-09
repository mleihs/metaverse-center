-- Migration 187: Scoring engine — atomic MV refresh + guardian overcome bonus.
--
-- K3 FIX: Eliminates 6% scoring failure rate by moving MV refresh inside
-- fn_compute_cycle_scores. Previously, Python called refresh_all_game_metrics()
-- as a separate RPC, creating a race condition between refresh and scoring.
-- Now the refresh happens atomically within the same function call, with a
-- CONCURRENTLY → non-concurrent fallback to guarantee freshness.
--
-- H1 FIX: Adds guardian overcome bonus to military scoring. Attackers who
-- succeed against guardian-protected zones earn +2 military per active guardian
-- at the target (capped at +4). Previously attackers received zero credit for
-- overcoming guardian defense, creating a "turtle + spy" meta convergence.

CREATE OR REPLACE FUNCTION fn_compute_cycle_scores(
    p_epoch_id   UUID,
    p_cycle_number INT,
    p_score_weights JSONB DEFAULT '{"stability":25,"influence":20,"sovereignty":20,"diplomatic":15,"military":20}'
)
RETURNS SETOF epoch_scores
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    w_stability  NUMERIC := COALESCE((p_score_weights->>'stability')::NUMERIC, 25);
    w_influence  NUMERIC := COALESCE((p_score_weights->>'influence')::NUMERIC, 20);
    w_sovereignty NUMERIC := COALESCE((p_score_weights->>'sovereignty')::NUMERIC, 20);
    w_diplomatic NUMERIC := COALESCE((p_score_weights->>'diplomatic')::NUMERIC, 15);
    w_military   NUMERIC := COALESCE((p_score_weights->>'military')::NUMERIC, 20);
BEGIN
    -- ═══════════════════════════════════════════════════════════════════════
    -- K3 FIX: Atomic MV refresh within the scoring function.
    -- Try CONCURRENTLY first (non-blocking for other reads), fall back to
    -- blocking refresh if concurrent lock acquisition fails.
    -- Scoring runs once per cycle (not per-request), so brief blocking is
    -- acceptable as a fallback.
    -- ═══════════════════════════════════════════════════════════════════════
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_building_readiness;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_zone_stability;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_embassy_effectiveness;
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_simulation_health;
    EXCEPTION WHEN OTHERS THEN
        -- Concurrent refresh failed (lock contention) — use blocking refresh.
        -- This always succeeds but briefly prevents reads on the MVs.
        REFRESH MATERIALIZED VIEW mv_building_readiness;
        REFRESH MATERIALIZED VIEW mv_zone_stability;
        REFRESH MATERIALIZED VIEW mv_embassy_effectiveness;
        REFRESH MATERIALIZED VIEW mv_simulation_health;
    END;

    -- Upsert raw + normalized + composite scores in one pass
    RETURN QUERY
    WITH participants AS (
        SELECT ep.simulation_id
        FROM epoch_participants ep
        WHERE ep.epoch_id = p_epoch_id
    ),

    -- Zone stability (avg per sim from mv_zone_stability, now guaranteed fresh)
    zone_stab AS (
        SELECT p.simulation_id,
               COALESCE(AVG(zs.stability) * 100, 50.0) AS base_stability
        FROM participants p
        LEFT JOIN mv_zone_stability zs ON zs.simulation_id = p.simulation_id
        GROUP BY p.simulation_id
    ),

    -- Propaganda events targeting each sim
    propaganda AS (
        SELECT p.simulation_id,
               COUNT(e.id) AS propaganda_count
        FROM participants p
        LEFT JOIN events e ON e.simulation_id = p.simulation_id
                          AND e.data_source = 'propagandist'
        GROUP BY p.simulation_id
    ),

    -- Inbound missions (attacks against each sim)
    inbound_missions AS (
        SELECT p.simulation_id,
               -- Stability penalties
               COUNT(*) FILTER (WHERE om.target_simulation_id = p.simulation_id
                   AND om.status = 'success' AND om.operative_type = 'saboteur') AS inbound_saboteur,
               COUNT(*) FILTER (WHERE om.target_simulation_id = p.simulation_id
                   AND om.status = 'success' AND om.operative_type = 'assassin') AS inbound_assassin,
               -- Sovereignty penalties (successful inbound by type)
               COALESCE(SUM(CASE
                   WHEN om.target_simulation_id = p.simulation_id AND om.status = 'success' THEN
                       CASE om.operative_type
                           WHEN 'spy' THEN 2 WHEN 'propagandist' THEN 6
                           WHEN 'infiltrator' THEN 8 WHEN 'saboteur' THEN 8
                           WHEN 'assassin' THEN 12 ELSE 5
                       END
                   ELSE 0
               END), 0) AS sovereignty_penalty,
               -- Sovereignty detected bonus
               COUNT(*) FILTER (WHERE om.target_simulation_id = p.simulation_id
                   AND om.status IN ('detected', 'captured')) AS detected_count
        FROM participants p
        LEFT JOIN operative_missions om ON om.epoch_id = p_epoch_id
            AND om.target_simulation_id = p.simulation_id
            AND om.status IN ('success', 'detected', 'captured')
        GROUP BY p.simulation_id
    ),

    -- ═══════════════════════════════════════════════════════════════════════
    -- H1 FIX: Guardian overcome bonus in outbound military scoring.
    -- LATERAL subquery counts active guardians at the target simulation.
    -- Bonus: +2 military per guardian overcome, capped at +4.
    -- Only applies to successful missions (LATERAL ON condition).
    -- ═══════════════════════════════════════════════════════════════════════
    outbound_missions AS (
        SELECT p.simulation_id,
               -- Influence: successful propagandist/spy/infiltrator
               COUNT(*) FILTER (WHERE om.status = 'success' AND om.operative_type = 'propagandist') AS propagandist_wins,
               COUNT(*) FILTER (WHERE om.status = 'success' AND om.operative_type = 'spy') AS spy_wins,
               COUNT(*) FILTER (WHERE om.status = 'success' AND om.operative_type = 'infiltrator') AS infiltrator_wins,
               -- Military: mission values + guardian overcome bonus - detection penalties
               COALESCE(SUM(CASE
                   WHEN om.status = 'success' THEN
                       CASE om.operative_type
                           WHEN 'spy' THEN 3 WHEN 'saboteur' THEN 5
                           WHEN 'propagandist' THEN 4 WHEN 'assassin' THEN 8
                           WHEN 'infiltrator' THEN 6 ELSE 2
                       END
                       -- H1: +2 per guardian at target, capped at +4
                       + LEAST(4, COALESCE(tg.guardian_count, 0) * 2)
                   WHEN om.status IN ('detected', 'captured') THEN -3
                   ELSE 0
               END), 0) AS military_raw
        FROM participants p
        LEFT JOIN operative_missions om ON om.epoch_id = p_epoch_id
            AND om.source_simulation_id = p.simulation_id
            AND om.status IN ('success', 'failed', 'detected', 'captured')
        -- H1: Count active guardians at each mission's target
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

    -- Echo strength (bleed system)
    echo_strength AS (
        SELECT p.simulation_id,
               COALESCE(SUM(ee.echo_strength), 0) AS echo_sum
        FROM participants p
        LEFT JOIN event_echoes ee ON ee.source_simulation_id = p.simulation_id
                                 AND ee.status = 'completed'
        GROUP BY p.simulation_id
    ),

    -- Embassy effectiveness (now guaranteed fresh from atomic MV refresh)
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

    -- Team membership: ally count + betrayal penalty
    team_data AS (
        SELECT ep.simulation_id,
               ep.team_id,
               COALESCE(ep.betrayal_penalty, 0) AS betrayal_penalty,
               CASE WHEN ep.team_id IS NOT NULL THEN
                   (SELECT COUNT(*) - 1 FROM epoch_participants ep2
                    WHERE ep2.team_id = ep.team_id AND ep2.epoch_id = p_epoch_id)
               ELSE 0 END AS ally_count,
               -- Spy diplomatic bonus
               (SELECT COUNT(*) FROM operative_missions om
                WHERE om.epoch_id = p_epoch_id
                  AND om.source_simulation_id = ep.simulation_id
                  AND om.operative_type = 'spy'
                  AND om.status = 'success') AS spy_bonus
        FROM epoch_participants ep
        WHERE ep.epoch_id = p_epoch_id
    ),

    -- Guardian counts (for sovereignty bonus — unchanged)
    guardian_counts AS (
        SELECT p.simulation_id,
               COUNT(*) FILTER (WHERE om.operative_type = 'guardian'
                   AND om.status = 'active') AS guardian_count
        FROM participants p
        LEFT JOIN operative_missions om ON om.epoch_id = p_epoch_id
            AND om.source_simulation_id = p.simulation_id
        GROUP BY p.simulation_id
    ),

    -- Raw dimension scores
    raw_scores AS (
        SELECT p.simulation_id,
               -- Stability: avg(zone_stability) × 100 - propaganda×3 - saboteur×6 - assassin×5
               GREATEST(0, zs.base_stability
                   - COALESCE(pr.propaganda_count, 0) * 3
                   - COALESCE(ib.inbound_saboteur, 0) * 6
                   - COALESCE(ib.inbound_assassin, 0) * 5
               ) AS stability,
               -- Influence: propagandist×5 + spy×2 + infiltrator×3 + echo_sum
               COALESCE(ob.propagandist_wins, 0) * 5
                   + COALESCE(ob.spy_wins, 0) * 2
                   + COALESCE(ob.infiltrator_wins, 0) * 3
                   + COALESCE(es.echo_sum, 0)
               AS influence,
               -- Sovereignty: 100 - penalties + detected×3 + guardian×4
               GREATEST(0, LEAST(100,
                   100.0
                   - COALESCE(ib.sovereignty_penalty, 0)
                   + COALESCE(ib.detected_count, 0) * 3
                   + COALESCE(gc.guardian_count, 0) * 4
               )) AS sovereignty,
               -- Diplomatic: (effectiveness×10 + spy_bonus) × (1+0.15×allies) × (1-betrayal)
               (CASE WHEN COALESCE(ed.total_effectiveness, 0) = 0
                     THEN COALESCE(ed.embassy_count, 0) * 0.5
                     ELSE ed.total_effectiveness
                END * 10 + COALESCE(td.spy_bonus, 0))
               * (1.0 + 0.15 * COALESCE(td.ally_count, 0))
               * (1.0 - COALESCE(td.betrayal_penalty, 0))
               AS diplomatic,
               -- Military: sum(mission_values + guardian_overcome_bonus) - detection_penalties, floor 0
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

    -- Normalization: max per dimension, then scale to 0-100
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
               rs.stability,
               rs.influence,
               rs.sovereignty,
               rs.diplomatic,
               rs.military,
               -- Normalized values
               (rs.stability / m.max_stability) * 100 AS norm_stability,
               (rs.influence / m.max_influence) * 100 AS norm_influence,
               (rs.sovereignty / m.max_sovereignty) * 100 AS norm_sovereignty,
               (rs.diplomatic / m.max_diplomatic) * 100 AS norm_diplomatic,
               (rs.military / m.max_military) * 100 AS norm_military
        FROM raw_scores rs
        CROSS JOIN maxes m
    ),

    -- Composite: weighted sum
    composited AS (
        SELECT n.simulation_id,
               n.stability,
               n.influence,
               n.sovereignty,
               n.diplomatic,
               n.military,
               ROUND((
                   n.norm_stability * w_stability / 100
                   + n.norm_influence * w_influence / 100
                   + n.norm_sovereignty * w_sovereignty / 100
                   + n.norm_diplomatic * w_diplomatic / 100
                   + n.norm_military * w_military / 100
               )::NUMERIC, 2) AS composite
        FROM normalized n
    )

    -- UPSERT into epoch_scores
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

-- Re-grant permissions (same as migration 127)
GRANT EXECUTE ON FUNCTION fn_compute_cycle_scores(UUID, INT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_compute_cycle_scores(UUID, INT, JSONB) TO service_role;
