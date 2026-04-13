-- ============================================================================
-- Migration 164: Resonance Dungeons — Atomic RPCs + available_dungeons VIEW
-- ============================================================================
--
-- Adds:
--   1. agent_dungeon_loot_effects — persistent loot effect tracking (+2 cap)
--   2. fn_apply_dungeon_loot() — CAS for aptitude cap, memory, event modifier
--   3. fn_complete_dungeon_run() — atomic: status + outcome + loot + event
--   4. fn_abandon_dungeon_run() — atomic: status + partial outcome + event
--   5. fn_wipe_dungeon_run() — atomic: status + trauma outcome + event
--   6. VIEW available_dungeons — replaces Python query
--
-- Pattern: ADR-007 (atomic Postgres RPCs with CAS), ADR-006 (SECURITY INVOKER)
-- All functions callable only by service_role via backend
-- ============================================================================


-- ── 1. Persistent Loot Effects Tracking ──────────────────────────────────────
-- Tracks all persistent dungeon loot effects per agent.
-- The aptitude_boost cap (Review #20: +2 per agent total) is enforced by
-- counting rows of that type in CAS logic within fn_apply_dungeon_loot().

CREATE TABLE IF NOT EXISTS agent_dungeon_loot_effects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    simulation_id   UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    effect_type     TEXT NOT NULL CHECK (effect_type IN (
                        'aptitude_boost', 'permanent_dungeon_bonus',
                        'next_dungeon_bonus', 'event_modifier', 'arc_modifier'
                    )),
    effect_params   JSONB NOT NULL DEFAULT '{}',
    source_run_id   UUID REFERENCES resonance_dungeon_runs(id) ON DELETE SET NULL,
    source_loot_id  TEXT NOT NULL,
    consumed        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dungeon_loot_effects_agent
    ON agent_dungeon_loot_effects(agent_id);

CREATE INDEX idx_dungeon_loot_effects_type
    ON agent_dungeon_loot_effects(agent_id, effect_type)
    WHERE effect_type = 'aptitude_boost';

CREATE INDEX idx_dungeon_loot_effects_unconsumed
    ON agent_dungeon_loot_effects(agent_id, effect_type)
    WHERE consumed = FALSE;

ALTER TABLE agent_dungeon_loot_effects ENABLE ROW LEVEL SECURITY;

-- Members can read their simulation's loot effects
CREATE POLICY dungeon_loot_effects_member_read ON agent_dungeon_loot_effects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM simulation_members sm
            WHERE sm.simulation_id = agent_dungeon_loot_effects.simulation_id
            AND sm.user_id = auth.uid()
        )
    );

-- INSERT/UPDATE restricted to service_role (backend engine only)


-- ── 2. fn_apply_dungeon_loot() ───────────────────────────────────────────────
-- Applies persistent loot effects from a dungeon run to agents.
-- CAS pattern for aptitude_boost: check count < 2 before applying.
--
-- p_loot_items: array of objects, each with:
--   { loot_id, agent_id, effect_type, effect_params }
--
-- Returns JSONB summary: { applied: [...], skipped: [...] }

CREATE OR REPLACE FUNCTION fn_apply_dungeon_loot(
    p_run_id        UUID,
    p_simulation_id UUID,
    p_loot_items    JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
    v_item          JSONB;
    v_agent_id      UUID;
    v_effect_type   TEXT;
    v_loot_id       TEXT;
    v_effect_params JSONB;
    v_applied       JSONB := '[]'::JSONB;
    v_skipped       JSONB := '[]'::JSONB;
    v_bonus_count   INT;
    v_aptitude      TEXT;
    v_resolved_apt  TEXT;  -- resolved from pipe-separated list
    v_bonus_amount  INT;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_loot_items)
    LOOP
        v_agent_id    := (v_item ->> 'agent_id')::UUID;
        v_effect_type := v_item ->> 'effect_type';
        v_loot_id     := v_item ->> 'loot_id';
        v_effect_params := COALESCE(v_item -> 'effect_params', '{}'::JSONB);

        -- ── aptitude_boost: CAS with +2 cap (Review #20) ────────────
        IF v_effect_type = 'aptitude_boost' THEN
            -- Advisory lock per agent (two-arg form: namespace + agent hash)
            PERFORM pg_advisory_xact_lock(
                hashtext('dungeon_aptitude_boost'),
                hashtext(v_agent_id::TEXT)
            );

            SELECT COUNT(*) INTO v_bonus_count
            FROM agent_dungeon_loot_effects
            WHERE agent_id = v_agent_id
            AND effect_type = 'aptitude_boost';

            IF v_bonus_count >= 2 THEN
                v_skipped := v_skipped || jsonb_build_object(
                    'loot_id', v_loot_id,
                    'agent_id', v_agent_id::TEXT,
                    'reason', 'aptitude_boost_cap_reached'
                );
                CONTINUE;
            END IF;

            -- Determine which aptitude to boost.
            -- Accepts both Python format ("aptitude": "spy") and legacy ("aptitude_choices": ["spy"])
            v_aptitude := COALESCE(
                v_effect_params -> 'aptitude_choices' ->> 0,
                v_effect_params ->> 'aptitude'
            );

            -- Validate aptitude resolved
            IF v_aptitude IS NULL THEN
                v_skipped := v_skipped || jsonb_build_object(
                    'loot_id', v_loot_id,
                    'agent_id', v_agent_id::TEXT,
                    'reason', 'no_aptitude_choices'
                );
                CONTINUE;
            END IF;

            -- Handle pipe-separated aptitude choices ("guardian|propagandist"):
            -- pick the one with the lowest current level for maximum impact.
            IF v_aptitude LIKE '%|%' THEN
                SELECT apt.operative_type INTO v_resolved_apt
                FROM unnest(string_to_array(v_aptitude, '|')) AS choice(val)
                JOIN agent_aptitudes apt ON apt.agent_id = v_agent_id AND apt.operative_type = choice.val
                ORDER BY apt.aptitude_level ASC
                LIMIT 1;
                IF v_resolved_apt IS NULL THEN
                    v_resolved_apt := split_part(v_aptitude, '|', 1);
                END IF;
            ELSE
                v_resolved_apt := v_aptitude;
            END IF;

            -- Accept both "bonus" (legacy) and "boost" (Python loot defs) field names
            v_bonus_amount := COALESCE(
                (v_effect_params ->> 'bonus')::INT,
                (v_effect_params ->> 'boost')::INT,
                1
            );

            -- Apply the aptitude boost (cap individual level at 9)
            UPDATE agent_aptitudes
            SET aptitude_level = LEAST(9, aptitude_level + v_bonus_amount)
            WHERE agent_id = v_agent_id
            AND operative_type = v_resolved_apt;

            -- Record the effect
            INSERT INTO agent_dungeon_loot_effects (
                agent_id, simulation_id, effect_type, effect_params,
                source_run_id, source_loot_id
            ) VALUES (
                v_agent_id, p_simulation_id, 'aptitude_boost',
                jsonb_build_object('aptitude', v_resolved_apt, 'bonus', v_bonus_amount),
                p_run_id, v_loot_id
            );

            v_applied := v_applied || jsonb_build_object(
                'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                'effect', 'aptitude_boost', 'aptitude', v_resolved_apt
            );

        -- ── memory: create agent_memories entry ─────────────────────
        ELSIF v_effect_type = 'memory' THEN
            INSERT INTO agent_memories (
                agent_id, simulation_id, memory_type, content, content_de,
                importance, source_type
            ) VALUES (
                v_agent_id,
                p_simulation_id,
                'reflection',
                COALESCE(v_effect_params ->> 'content_en', 'Dungeon experience'),
                COALESCE(v_effect_params ->> 'content_de', 'Dungeon-Erfahrung'),
                COALESCE((v_effect_params ->> 'importance')::INT, 5),
                'system'
            );

            -- No tracking insert: memory is persisted in agent_memories directly
            v_applied := v_applied || jsonb_build_object(
                'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                'effect', 'memory'
            );

        -- ── moodlet: insert agent_moodlets entry ────────────────────
        ELSIF v_effect_type = 'moodlet' THEN
            INSERT INTO agent_moodlets (
                agent_id, simulation_id, moodlet_type, emotion, strength,
                source_type, source_description, decay_type, initial_strength,
                expires_at, stacking_group
            ) VALUES (
                v_agent_id,
                p_simulation_id,
                v_effect_params ->> 'moodlet_type',
                v_effect_params ->> 'emotion',
                COALESCE((v_effect_params ->> 'strength')::INT, 5),
                'system',
                COALESCE(v_effect_params ->> 'description_en', 'Dungeon loot effect'),
                COALESCE(v_effect_params ->> 'decay_type', 'permanent'),
                COALESCE((v_effect_params ->> 'strength')::INT, 5),
                CASE WHEN v_effect_params ->> 'decay_type' = 'permanent'
                     THEN NULL
                     ELSE now() + INTERVAL '48 hours'
                END,
                'dungeon_loot'
            );

            -- No tracking insert: moodlet is persisted in agent_moodlets directly
            v_applied := v_applied || jsonb_build_object(
                'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                'effect', 'moodlet'
            );

        -- ── event_modifier: reduce impact_level on one event ────────
        ELSIF v_effect_type = 'event_modifier' THEN
            UPDATE events
            SET impact_level = GREATEST(1, impact_level - COALESCE(
                    (v_effect_params ->> 'impact_level_reduction')::INT, 1
                )),
                updated_at = now()
            WHERE id = (
                SELECT id FROM events
                WHERE simulation_id = p_simulation_id
                AND event_status IN ('active', 'escalating')
                AND impact_level >= 5
                AND deleted_at IS NULL
                ORDER BY impact_level DESC, occurred_at DESC
                LIMIT 1
            );

            IF FOUND THEN
                INSERT INTO agent_dungeon_loot_effects (
                    agent_id, simulation_id, effect_type, effect_params,
                    source_run_id, source_loot_id, consumed
                ) VALUES (
                    v_agent_id, p_simulation_id, v_effect_type, v_effect_params,
                    p_run_id, v_loot_id, TRUE
                );
                v_applied := v_applied || jsonb_build_object(
                    'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                    'effect', 'event_modifier'
                );
            ELSE
                -- No qualifying event found — store unconsumed for future use
                INSERT INTO agent_dungeon_loot_effects (
                    agent_id, simulation_id, effect_type, effect_params,
                    source_run_id, source_loot_id, consumed
                ) VALUES (
                    v_agent_id, p_simulation_id, v_effect_type, v_effect_params,
                    p_run_id, v_loot_id, FALSE
                );
                v_skipped := v_skipped || jsonb_build_object(
                    'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                    'reason', 'no_qualifying_event'
                );
            END IF;

        -- ── arc_modifier: reduce pressure on matching arc ───────────
        ELSIF v_effect_type = 'arc_modifier' THEN
            -- Arc pressure is expressed through high-impact escalating events.
            -- Reduce the highest-impact escalating event's level.
            UPDATE events
            SET impact_level = GREATEST(1, impact_level - 1),
                updated_at = now()
            WHERE id = (
                SELECT id FROM events
                WHERE simulation_id = p_simulation_id
                AND event_status = 'escalating'
                AND impact_level >= 7
                AND deleted_at IS NULL
                ORDER BY impact_level DESC, occurred_at DESC
                LIMIT 1
            );

            IF FOUND THEN
                INSERT INTO agent_dungeon_loot_effects (
                    agent_id, simulation_id, effect_type, effect_params,
                    source_run_id, source_loot_id, consumed
                ) VALUES (
                    v_agent_id, p_simulation_id, v_effect_type, v_effect_params,
                    p_run_id, v_loot_id, TRUE
                );
                v_applied := v_applied || jsonb_build_object(
                    'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                    'effect', 'arc_modifier'
                );
            ELSE
                -- No qualifying arc event — store unconsumed for future use
                INSERT INTO agent_dungeon_loot_effects (
                    agent_id, simulation_id, effect_type, effect_params,
                    source_run_id, source_loot_id, consumed
                ) VALUES (
                    v_agent_id, p_simulation_id, v_effect_type, v_effect_params,
                    p_run_id, v_loot_id, FALSE
                );
                v_skipped := v_skipped || jsonb_build_object(
                    'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                    'reason', 'no_qualifying_arc_event'
                );
            END IF;

        -- ── stress_heal: reduce stress in agent_mood ────────────────
        ELSIF v_effect_type = 'stress_heal' THEN
            UPDATE agent_mood
            SET stress_level = GREATEST(0, stress_level - COALESCE(
                    (v_effect_params ->> 'stress_heal')::INT, 50
                )),
                updated_at = now()
            WHERE agent_id = v_agent_id;

            v_applied := v_applied || jsonb_build_object(
                'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                'effect', 'stress_heal'
            );

        -- ── persistent bonuses: store for Python engine lookup ──────
        ELSIF v_effect_type IN ('permanent_dungeon_bonus', 'next_dungeon_bonus') THEN
            INSERT INTO agent_dungeon_loot_effects (
                agent_id, simulation_id, effect_type, effect_params,
                source_run_id, source_loot_id
            ) VALUES (
                v_agent_id, p_simulation_id, v_effect_type, v_effect_params,
                p_run_id, v_loot_id
            );

            v_applied := v_applied || jsonb_build_object(
                'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                'effect', v_effect_type
            );

        END IF;
    END LOOP;

    RETURN jsonb_build_object('applied', v_applied, 'skipped', v_skipped);
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_apply_dungeon_loot(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_apply_dungeon_loot(UUID, UUID, JSONB) TO service_role;


-- ── 3. fn_complete_dungeon_run() ─────────────────────────────────────────────
-- Atomically completes a dungeon run: status + outcome + agent effects + loot + event.
-- Single transaction ensures no partial state.

CREATE OR REPLACE FUNCTION fn_complete_dungeon_run(
    p_run_id        UUID,
    p_simulation_id UUID,
    p_outcome       JSONB,
    p_agent_outcomes JSONB,
    p_loot_items    JSONB,
    p_depth         INT,
    p_room_index    INT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
    v_loot_result JSONB;
BEGIN
    -- 1. Update run status atomically
    UPDATE resonance_dungeon_runs
    SET status       = 'completed',
        outcome      = p_outcome,
        completed_at = now(),
        updated_at   = now()
    WHERE id = p_run_id
    AND status IN ('active', 'combat', 'exploring');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Run % not found or not in active state', p_run_id;
    END IF;

    -- 2. Apply agent outcomes (mood, stress, moodlets, activities)
    PERFORM fn_apply_dungeon_outcome(p_run_id, p_simulation_id, p_agent_outcomes);

    -- 3. Apply loot effects (aptitude boosts, memories, event modifiers)
    v_loot_result := fn_apply_dungeon_loot(p_run_id, p_simulation_id, p_loot_items);

    -- 4. Log completion event
    INSERT INTO resonance_dungeon_events (
        run_id, simulation_id, depth, room_index,
        event_type, narrative_en, narrative_de, outcome
    ) VALUES (
        p_run_id, p_simulation_id, p_depth, p_room_index,
        'dungeon_completed',
        'The darkness recedes. The party emerges, changed.',
        'Die Dunkelheit weicht zurück. Die Gruppe taucht auf, verändert.',
        p_outcome
    );

    RETURN jsonb_build_object(
        'status', 'completed',
        'loot_result', v_loot_result
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_complete_dungeon_run(UUID, UUID, JSONB, JSONB, JSONB, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_complete_dungeon_run(UUID, UUID, JSONB, JSONB, JSONB, INT, INT) TO service_role;


-- ── 4. fn_abandon_dungeon_run() ──────────────────────────────────────────────
-- Atomically abandons a dungeon run: status + partial outcome + event.

CREATE OR REPLACE FUNCTION fn_abandon_dungeon_run(
    p_run_id        UUID,
    p_simulation_id UUID,
    p_outcome       JSONB,
    p_depth         INT,
    p_room_index    INT
) RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
    -- 1. Update run status
    UPDATE resonance_dungeon_runs
    SET status       = 'abandoned',
        outcome      = p_outcome,
        completed_at = now(),
        updated_at   = now()
    WHERE id = p_run_id
    AND status IN ('active', 'combat', 'exploring');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Run % not found or not in active state', p_run_id;
    END IF;

    -- 2. Log abandonment event
    INSERT INTO resonance_dungeon_events (
        run_id, simulation_id, depth, room_index,
        event_type, narrative_en, narrative_de, outcome
    ) VALUES (
        p_run_id, p_simulation_id, p_depth, p_room_index,
        'dungeon_abandoned',
        'The party retreats from the darkness.',
        'Die Gruppe zieht sich aus der Dunkelheit zurück.',
        p_outcome
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_abandon_dungeon_run(UUID, UUID, JSONB, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_abandon_dungeon_run(UUID, UUID, JSONB, INT, INT) TO service_role;


-- ── 5. fn_wipe_dungeon_run() ─────────────────────────────────────────────────
-- Atomically wipes a dungeon run: status + trauma outcome + event.
-- Applies trauma moodlets to all party agents.

CREATE OR REPLACE FUNCTION fn_wipe_dungeon_run(
    p_run_id         UUID,
    p_simulation_id  UUID,
    p_agent_outcomes JSONB,
    p_depth          INT,
    p_room_index     INT
) RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
    -- 1. Update run status
    UPDATE resonance_dungeon_runs
    SET status       = 'wiped',
        completed_at = now(),
        updated_at   = now()
    WHERE id = p_run_id
    AND status IN ('active', 'combat', 'exploring');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Run % not found or not in active state', p_run_id;
    END IF;

    -- 2. Apply trauma outcomes (high stress, affliction moodlets)
    PERFORM fn_apply_dungeon_outcome(p_run_id, p_simulation_id, p_agent_outcomes);

    -- 3. Log wipe event
    INSERT INTO resonance_dungeon_events (
        run_id, simulation_id, depth, room_index,
        event_type, narrative_en, narrative_de, outcome
    ) VALUES (
        p_run_id, p_simulation_id, p_depth, p_room_index,
        'party_wipe',
        'The darkness claims the party. All agents are lost.',
        'Die Dunkelheit beansprucht die Gruppe. Alle Agenten sind verloren.',
        '{}'::JSONB
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_wipe_dungeon_run(UUID, UUID, JSONB, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_wipe_dungeon_run(UUID, UUID, JSONB, INT, INT) TO service_role;


-- ── 6. fn_get_party_combat_state() ────────────────────────────────────────────
-- Consolidates 3 Python queries into 1 RPC: active_agents + agent_aptitudes + agent_mood.
-- Returns JSONB array of party members with all combat-relevant data.

CREATE OR REPLACE FUNCTION fn_get_party_combat_state(
    p_agent_ids     UUID[],
    p_simulation_id UUID
) RETURNS JSONB
LANGUAGE sql SECURITY INVOKER AS $$
    SELECT COALESCE(jsonb_agg(row_data), '[]'::JSONB)
    FROM (
        SELECT jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'portrait_url', a.portrait_image_url,
            'aptitudes', COALESCE(apt_agg.aptitudes, '{}'::JSONB),
            'personality', COALESCE(a.personality_profile, '{}'::JSONB),
            'mood_score', COALESCE(m.mood_score, 0),
            'stress_level', COALESCE(m.stress_level, 0),
            'resilience', COALESCE(m.resilience, 0.5)
        ) AS row_data
        FROM agents a
        LEFT JOIN agent_mood m ON m.agent_id = a.id
        LEFT JOIN LATERAL (
            SELECT jsonb_object_agg(apt.operative_type, apt.aptitude_level) AS aptitudes
            FROM agent_aptitudes apt
            WHERE apt.agent_id = a.id
        ) apt_agg ON TRUE
        WHERE a.id = ANY(p_agent_ids)
        AND a.deleted_at IS NULL
        AND a.simulation_id = p_simulation_id
    ) sub
$$;

REVOKE EXECUTE ON FUNCTION fn_get_party_combat_state(UUID[], UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_get_party_combat_state(UUID[], UUID) TO service_role;
GRANT EXECUTE ON FUNCTION fn_get_party_combat_state(UUID[], UUID) TO authenticated;


-- ── 7. VIEW available_dungeons ───────────────────────────────────────────────
-- Replaces the Python query in DungeonEngineService.get_available_dungeons().
-- Inherits RLS from underlying tables (resonance_impacts, substrate_resonances).
--
-- Difficulty/depth mapping matches DIFFICULTY_MULTIPLIERS in dungeon_archetypes.py:
--   1→depth 4, 2→depth 5, 3→depth 5, 4→depth 6, 5→depth 7

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
        AND dr.status IN ('active', 'combat', 'exploring')
    )                                                            AS available
FROM resonance_impacts ri
LEFT JOIN substrate_resonances sr ON sr.id = ri.resonance_id
WHERE ri.status IN ('completed', 'generating')
AND sr.id IS NOT NULL          -- LEFT JOIN: exclude orphaned impacts
AND sr.status IN ('detected', 'impacting')
AND sr.deleted_at IS NULL
AND ri.effective_magnitude >= 0.3;

-- VIEW permissions: readable by authenticated users (public-first architecture)
GRANT SELECT ON available_dungeons TO authenticated;

-- Composite index for VIEW subqueries on resonance_dungeon_runs
CREATE INDEX IF NOT EXISTS idx_dungeon_runs_sim_archetype
    ON resonance_dungeon_runs(simulation_id, archetype);
