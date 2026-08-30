-- Migration 289: Beutewirkungen, die gewuerfelt, gezeigt und dann fallen gelassen wurden.
--
-- Befund der Systempruefung (Bericht §3.1 D4): 39 von 105 Beutestuecken haben
-- keinen Wirkpfad. Nachgemessen gegen Prod ergab das ein schaerferes Bild als
-- der Bericht — es gibt ZWEI Ueberladungen von fn_apply_dungeon_loot:
--
--   fn_apply_dungeon_loot(uuid, uuid, jsonb)                    -- 8 Zweige
--       Die einzige, die je gerufen wird: aus fn_finalize_dungeon_run und
--       fn_complete_dungeon_run, und Python ruft nur fn_finalize_dungeon_run.
--
--   fn_apply_dungeon_loot(uuid, uuid, uuid, text, text, jsonb)  -- 10 Zweige
--       SECURITY DEFINER, NULL Aufrufer — weder in Python noch in SQL
--       (Scan ueber pg_proc.prosrc aller public-Funktionen).
--
-- Die Migrationen 174 (simulation_modifier) und 177 (personality_modifier)
-- wurden geschrieben, um genau diese zwei Zweige zu bauen — in die TOTE
-- Ueberladung. Die Arbeit ist seit April da und hat den laufenden Pfad nie
-- erreicht. `docs/references/feature-catalog.md` fuehrt RD18 deshalb bis heute
-- als "IMPL" mit Beleg Migration 174.
--
-- Und die tote Fassung ist nicht nur tot, sondern gebrochen: ihr
-- personality_modifier-Zweig schreibt effect_type='personality_modifier' nach
-- agent_dungeon_loot_effects, dessen CHECK diesen Wert nicht kennt. Sie haette
-- also selbst dann nicht funktioniert, wenn jemand sie geruft haette — dieselbe
-- Bauart wie `bond_whisper` in Migration 285.
--
-- Diese Migration tut vier Dinge:
--   1. CHECK auf agent_dungeon_loot_effects um 'personality_modifier' erweitern.
--   2. Die LAUFENDE 3-arg-Fassung um simulation_modifier, personality_modifier
--      und building_repair erweitern — der Rumpf stammt aus pg_get_functiondef
--      vom Live-Stand, nicht aus einer Migrationsdatei.
--   3. Einen ELSE-Zweig einziehen. Bisher endete die Typkette am END IF: ein
--      unbekannter Typ landete in WEDER `applied` NOCH `skipped`, und die
--      Warnung in dungeon_distribution_service konnte fuer ihn nie feuern.
--   4. Die tote 6-arg-Ueberladung entfernen, damit der naechste Leser sie nicht
--      fuer die gueltige haelt.
--
-- Nicht enthalten: die 30 dungeon_buff-Stuecke. Die sind laufzeitgebunden und
-- werden in Python angewandt (derselbe Sammler, den der Deluge-Schutt benutzt).

BEGIN;

-- ── 1. CHECK: personality_modifier aufnehmen ────────────────────────────────
-- Bestandswerte stammen aus pg_get_constraintdef auf Prod, nicht aus dem Kopf.

ALTER TABLE agent_dungeon_loot_effects
    DROP CONSTRAINT IF EXISTS agent_dungeon_loot_effects_effect_type_check;

ALTER TABLE agent_dungeon_loot_effects
    ADD CONSTRAINT agent_dungeon_loot_effects_effect_type_check
    CHECK (effect_type = ANY (ARRAY[
        'aptitude_boost'::text,
        'permanent_dungeon_bonus'::text,
        'next_dungeon_bonus'::text,
        'event_modifier'::text,
        'arc_modifier'::text,
        'simulation_modifier'::text,
        'personality_modifier'::text
    ]));

-- ── 2.-3. Die laufende Fassung ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_apply_dungeon_loot(
    p_run_id        UUID,
    p_simulation_id UUID,
    p_loot_items    JSONB
) RETURNS JSONB
LANGUAGE plpgsql
AS $fn$
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
    v_dimension     TEXT;
    v_delta         NUMERIC;
    v_current_val   NUMERIC;
    v_new_val       NUMERIC;
    v_tiers         INT;
    v_building_id   UUID;
    v_old_cond      TEXT;
    v_new_cond      TEXT;
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


        -- ── simulation_modifier: welt-weite Wirkung, vom Herzschlag gelesen ──
        -- Der Zweig existierte seit Migration 174 — aber in der 6-arg-Ueberladung,
        -- die niemals gerufen wird. Hier steht er zum ersten Mal im laufenden Pfad.
        ELSIF v_effect_type = 'simulation_modifier' THEN
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

        -- ── personality_modifier: eine Big-Five-Dimension um ±delta ──────────
        -- Die einzige echte Beute-ENTSCHEIDUNG des Spiels. Python validiert die
        -- Dimension (`assign_loot`) und legt sie als `dimension` in die Parameter;
        -- feste Stuecke tragen sie als `trait` und werden dort normalisiert.
        ELSIF v_effect_type = 'personality_modifier' THEN
            v_dimension := v_effect_params ->> 'dimension';
            v_delta := COALESCE(
                (v_effect_params ->> 'delta')::NUMERIC,
                (v_effect_params ->> 'big_five_delta')::NUMERIC,
                0.1
            );

            IF v_dimension IS NULL OR v_dimension NOT IN (
                'openness', 'conscientiousness', 'extraversion',
                'agreeableness', 'neuroticism'
            ) THEN
                v_skipped := v_skipped || jsonb_build_object(
                    'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                    'effect_type', v_effect_type,
                    'reason', 'invalid_big_five_dimension',
                    'dimension', v_dimension
                );
            ELSE
                -- `personality_profile` ist eine 0..1-Skala. Inhalte, die ihr Delta
                -- als Prozentpunkte meinen (z. B. `delta: 5`), werden hier auf die
                -- Skala gebracht, statt auf 1.0 zu saettigen.
                IF abs(v_delta) > 1 THEN
                    v_delta := v_delta / 100.0;
                END IF;

                SELECT COALESCE((personality_profile ->> v_dimension)::NUMERIC, 0.5)
                INTO v_current_val
                FROM agents WHERE id = v_agent_id;

                IF v_current_val IS NULL THEN
                    v_skipped := v_skipped || jsonb_build_object(
                        'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                        'effect_type', v_effect_type, 'reason', 'agent_not_found'
                    );
                ELSE
                    v_new_val := GREATEST(0.0, LEAST(1.0, v_current_val + v_delta));

                    UPDATE agents
                    SET personality_profile = jsonb_set(
                        COALESCE(personality_profile, '{}'::JSONB),
                        ARRAY[v_dimension],
                        to_jsonb(v_new_val)
                    )
                    WHERE id = v_agent_id;

                    INSERT INTO agent_dungeon_loot_effects (
                        agent_id, simulation_id, effect_type, effect_params,
                        source_run_id, source_loot_id
                    ) VALUES (
                        v_agent_id, p_simulation_id, v_effect_type,
                        jsonb_build_object(
                            'dimension', v_dimension, 'delta', v_delta,
                            'old_value', v_current_val, 'new_value', v_new_val
                        ),
                        p_run_id, v_loot_id
                    );

                    v_applied := v_applied || jsonb_build_object(
                        'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                        'effect', v_effect_type, 'dimension', v_dimension,
                        'old_value', v_current_val, 'new_value', v_new_val
                    );
                END IF;
            END IF;

        -- ── building_repair: ein Bau steigt die Zustandsleiter hinauf ────────
        -- Umkehrung von `fn_degrade_building` (good → moderate → poor → ruined).
        -- Getroffen wird der am staerksten beschaedigte Bau der Welt: die Wahl
        -- ist damit bestimmt und nicht zufaellig, und die Beute hilft dort, wo
        -- sie gebraucht wird.
        ELSIF v_effect_type = 'building_repair' THEN
            v_tiers := GREATEST(1, COALESCE(
                (v_effect_params ->> 'condition_improvement')::INT,
                (v_effect_params ->> 'condition_tiers')::INT,
                1
            ));

            SELECT id, building_condition INTO v_building_id, v_old_cond
            FROM buildings
            WHERE simulation_id = p_simulation_id
              AND deleted_at IS NULL
              AND building_condition IN ('ruined', 'poor', 'moderate')
            ORDER BY CASE building_condition
                         WHEN 'ruined' THEN 0 WHEN 'poor' THEN 1 ELSE 2
                     END,
                     id
            LIMIT 1;

            IF v_building_id IS NULL THEN
                v_skipped := v_skipped || jsonb_build_object(
                    'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                    'effect_type', v_effect_type,
                    'reason', 'no_damaged_building'
                );
            ELSE
                v_new_cond := v_old_cond;
                FOR v_step IN 1..v_tiers LOOP
                    v_new_cond := CASE v_new_cond
                        WHEN 'ruined'   THEN 'poor'
                        WHEN 'poor'     THEN 'moderate'
                        WHEN 'moderate' THEN 'good'
                        ELSE v_new_cond
                    END;
                END LOOP;

                -- Compare-and-swap wie beim Verfall (ADR-007).
                UPDATE buildings
                SET building_condition = v_new_cond, updated_at = now()
                WHERE id = v_building_id AND building_condition = v_old_cond;

                IF FOUND THEN
                    v_applied := v_applied || jsonb_build_object(
                        'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                        'effect', v_effect_type, 'building_id', v_building_id::TEXT,
                        'old_condition', v_old_cond, 'new_condition', v_new_cond
                    );
                ELSE
                    v_skipped := v_skipped || jsonb_build_object(
                        'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                        'effect_type', v_effect_type,
                        'reason', 'concurrent_modification'
                    );
                END IF;
            END IF;

        -- ── alles Uebrige: NICHT mehr spurlos ────────────────────────────────
        -- Bis hierher endete die Kette am `END IF;`. Ein unbekannter Typ landete
        -- damit in WEDER `applied` NOCH `skipped` — und die Warnung in
        -- `dungeon_distribution_service` konnte fuer ihn nie feuern.
        ELSE
            v_skipped := v_skipped || jsonb_build_object(
                'loot_id', v_loot_id, 'agent_id', v_agent_id::TEXT,
                'effect_type', v_effect_type,
                'reason', 'unknown_effect_type'
            );

        END IF;
    END LOOP;

    RETURN jsonb_build_object('applied', v_applied, 'skipped', v_skipped);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION fn_apply_dungeon_loot(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_apply_dungeon_loot(UUID, UUID, JSONB) TO service_role;

-- ── 4. Die tote Ueberladung ─────────────────────────────────────────────────
-- Kein Aufrufer in Python (grep) und keiner in SQL (pg_proc.prosrc-Scan ueber
-- alle public-Funktionen; die beiden Aufrufer uebergeben drei Argumente).
-- Ihre beiden eigenen Zweige stehen ab jetzt oben im laufenden Pfad.

DROP FUNCTION IF EXISTS fn_apply_dungeon_loot(UUID, UUID, UUID, TEXT, TEXT, JSONB);

COMMIT;
