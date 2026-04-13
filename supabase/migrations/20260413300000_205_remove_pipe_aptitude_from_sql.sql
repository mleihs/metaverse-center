-- ============================================================================
-- Migration 205: Remove pipe-separated aptitude handling from fn_apply_dungeon_loot
-- ============================================================================
--
-- R1 refactor: pipe-separated aptitude resolution ("guardian|propagandist")
-- is now handled in Python (dungeon_distribution_service.py) before calling
-- the RPC. The SQL function receives a clean single aptitude string.
--
-- Rationale: "pick the lowest aptitude for maximum impact" is a game design
-- decision that belongs in Python services, not SQL RPCs (see ADR-007
-- boundary: SQL = data integrity + atomicity, Python = business logic).
--
-- Changes:
--   - Remove unnest(string_to_array()) pipe handling (15 lines)
--   - Remove v_resolved_apt variable (use v_aptitude directly)
--   - All other logic unchanged
-- ============================================================================

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
            -- Python resolves pipe-separated choices before calling this RPC,
            -- so v_aptitude is always a single clean string.
            v_aptitude := COALESCE(
                v_effect_params -> 'aptitude_choices' ->> 0,
                v_effect_params ->> 'aptitude'
            );

            IF v_aptitude IS NULL THEN
                v_skipped := v_skipped || jsonb_build_object(
                    'loot_id', v_loot_id,
                    'agent_id', v_agent_id::TEXT,
                    'reason', 'no_aptitude_choices'
                );
                CONTINUE;
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
            AND operative_type = v_aptitude;

            -- Record the effect
            INSERT INTO agent_dungeon_loot_effects (
                agent_id, simulation_id, effect_type, effect_params,
                source_run_id, source_loot_id
            ) VALUES (
                v_agent_id, p_simulation_id, 'aptitude_boost',
                jsonb_build_object('aptitude', v_aptitude, 'bonus', v_bonus_amount),
                p_run_id, v_loot_id
            );

            v_applied := v_applied || jsonb_build_object(
                'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                'effect', 'aptitude_boost', 'aptitude', v_aptitude
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

-- Permissions unchanged (service_role only)
REVOKE EXECUTE ON FUNCTION fn_apply_dungeon_loot(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_apply_dungeon_loot(UUID, UUID, JSONB) TO service_role;
