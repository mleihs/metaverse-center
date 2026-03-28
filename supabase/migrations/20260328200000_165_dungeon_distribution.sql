-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 165: Dungeon Loot Distribution Phase
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Adds a 'distributing' phase between boss victory and run completion.
-- After defeating the boss, the player assigns agent-specific loot (aptitude_boost,
-- memory, moodlet, *_bonus) to party members before finalizing the run.
--
-- Architecture:
--   fn_begin_distribution()   — sets status='distributing', applies agent outcomes
--   fn_finalize_dungeon_run() — sets status='completed', applies player-assigned loot
--
-- Existing fn_complete_dungeon_run and fn_apply_dungeon_loot are unchanged.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1. Status CHECK constraint — add 'distributing' ─────────────────────────

ALTER TABLE resonance_dungeon_runs
    DROP CONSTRAINT IF EXISTS resonance_dungeon_runs_status_check;

ALTER TABLE resonance_dungeon_runs
    ADD CONSTRAINT resonance_dungeon_runs_status_check
    CHECK (status IN (
        'active', 'combat', 'exploring', 'distributing',
        'completed', 'abandoned', 'wiped'
    ));


-- ── 2. Update partial indexes — 'distributing' is an active state ───────────

-- Active run index (used for recovery queries)
DROP INDEX IF EXISTS idx_dungeon_runs_active;
CREATE INDEX idx_dungeon_runs_active
    ON resonance_dungeon_runs(status)
    WHERE status IN ('active', 'combat', 'exploring', 'distributing');

-- One active run per simulation (prevents concurrent runs)
DROP INDEX IF EXISTS idx_dungeon_runs_one_active_per_sim;
CREATE UNIQUE INDEX idx_dungeon_runs_one_active_per_sim
    ON resonance_dungeon_runs(simulation_id)
    WHERE status IN ('active', 'combat', 'exploring', 'distributing');


-- ── 3. Update RLS policies — members can read distributing runs ─────────────

DROP POLICY IF EXISTS dungeon_runs_member_read ON resonance_dungeon_runs;
CREATE POLICY dungeon_runs_member_read ON resonance_dungeon_runs
    FOR SELECT
    USING (
        status IN ('active', 'combat', 'exploring', 'distributing')
        AND EXISTS (
            SELECT 1 FROM simulation_members sm
            WHERE sm.simulation_id = resonance_dungeon_runs.simulation_id
            AND sm.user_id = auth.uid()
        )
    );


-- ── 4. Update available_dungeons VIEW — distributing blocks new runs ────────

CREATE OR REPLACE VIEW available_dungeons AS
SELECT
    sr.archetype,
    sr.resonance_signature                                       AS signature,
    sr.id                                                        AS resonance_id,
    ri.simulation_id,
    sr.magnitude,
    ri.susceptibility,
    ri.effective_magnitude,
    LEAST(5, GREATEST(1, ROUND(ri.effective_magnitude * 5)::INT)) AS suggested_difficulty,
    CASE LEAST(5, GREATEST(1, ROUND(ri.effective_magnitude * 5)::INT))
        WHEN 1 THEN 4
        WHEN 2 THEN 5
        WHEN 3 THEN 5
        WHEN 4 THEN 6
        WHEN 5 THEN 7
    END                                                          AS suggested_depth,
    (
        SELECT MAX(dr.created_at)
        FROM resonance_dungeon_runs dr
        WHERE dr.simulation_id = ri.simulation_id
        AND dr.archetype = sr.archetype
    )                                                            AS last_run_at,
    NOT EXISTS (
        SELECT 1 FROM resonance_dungeon_runs dr
        WHERE dr.simulation_id = ri.simulation_id
        AND dr.archetype = sr.archetype
        AND dr.status IN ('active', 'combat', 'exploring', 'distributing')
    )                                                            AS available
FROM resonance_impacts ri
LEFT JOIN substrate_resonances sr ON sr.id = ri.resonance_id
WHERE ri.status IN ('completed', 'generating')
AND sr.id IS NOT NULL
AND sr.status IN ('detected', 'impacting')
AND sr.deleted_at IS NULL
AND ri.effective_magnitude >= 0.3;


-- ── 5. fn_begin_distribution() — split: outcomes without loot ────────────────

CREATE OR REPLACE FUNCTION fn_begin_distribution(
    p_run_id        UUID,
    p_simulation_id UUID,
    p_outcome       JSONB,
    p_agent_outcomes JSONB,
    p_depth         INT,
    p_room_index    INT
) RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
    -- Set status to distributing (boss defeated, awaiting loot assignment)
    UPDATE resonance_dungeon_runs
    SET status       = 'distributing',
        outcome      = p_outcome,
        updated_at   = now()
    WHERE id = p_run_id
    AND status IN ('active', 'combat', 'exploring');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Run % not found or not in active state', p_run_id;
    END IF;

    -- Apply agent outcomes (mood, stress, moodlets, activities)
    PERFORM fn_apply_dungeon_outcome(p_run_id, p_simulation_id, p_agent_outcomes);

    -- Log boss_defeated event
    INSERT INTO resonance_dungeon_events (
        run_id, simulation_id, depth, room_index,
        event_type, narrative_en, narrative_de, outcome
    ) VALUES (
        p_run_id, p_simulation_id, p_depth, p_room_index,
        'boss_defeated',
        'The guardian falls. The spoils of darkness await distribution.',
        'Der Waechter faellt. Die Beute der Dunkelheit wartet auf Verteilung.',
        p_outcome
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_begin_distribution(UUID, UUID, JSONB, JSONB, INT, INT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_begin_distribution(UUID, UUID, JSONB, JSONB, INT, INT)
    TO service_role;


-- ── 6. fn_finalize_dungeon_run() — complete with player-assigned loot ───────

CREATE OR REPLACE FUNCTION fn_finalize_dungeon_run(
    p_run_id        UUID,
    p_simulation_id UUID,
    p_loot_items    JSONB,
    p_depth         INT,
    p_room_index    INT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
    v_loot_result JSONB;
BEGIN
    -- Transition from distributing to completed
    UPDATE resonance_dungeon_runs
    SET status       = 'completed',
        completed_at = now(),
        updated_at   = now()
    WHERE id = p_run_id
    AND status = 'distributing';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Run % not found or not in distributing state', p_run_id;
    END IF;

    -- Apply loot with player's assignments
    v_loot_result := fn_apply_dungeon_loot(p_run_id, p_simulation_id, p_loot_items);

    -- Log completion event
    INSERT INTO resonance_dungeon_events (
        run_id, simulation_id, depth, room_index,
        event_type, narrative_en, narrative_de, outcome
    ) VALUES (
        p_run_id, p_simulation_id, p_depth, p_room_index,
        'dungeon_completed',
        'The darkness recedes. The party emerges, changed.',
        'Die Dunkelheit weicht zurueck. Die Gruppe taucht auf, veraendert.',
        jsonb_build_object('loot_result', v_loot_result)
    );

    RETURN jsonb_build_object(
        'status', 'completed',
        'loot_result', v_loot_result
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_finalize_dungeon_run(UUID, UUID, JSONB, INT, INT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_finalize_dungeon_run(UUID, UUID, JSONB, INT, INT)
    TO service_role;
