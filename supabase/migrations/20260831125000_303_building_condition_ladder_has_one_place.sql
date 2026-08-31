-- ============================================================================
-- Migration 303 — Die Zustandsleiter der Bauten hieß an einer Stelle anders
-- ============================================================================
--
-- BEFUND (D10-8 / S18)
-- --------------------
-- `fn_degrade_building` kennt die Kette
--
--     good → moderate → poor → ruined
--
-- Zwei Dinge stimmen daran nicht, und beide wurden auf Prod gemessen
-- (31.08.2026).
--
-- **Erstens: die Sprosse in der Mitte gibt es nicht.** Der Zustand eines Baus
-- ist kein Aufzählungstyp, sondern ein Wert aus der Taxonomie der jeweiligen
-- WELT (`simulation_taxonomies`, Typ `building_condition`, 305 Zeilen über 25
-- Welten). Gemessen: der Wert `moderate` kommt in **null** dieser 305 Zeilen
-- vor. Jeder Verfall eines `good`-Baus schrieb also einen Wert, den die Welt
-- nicht führt — ohne Beschriftung, ohne deutsche Entsprechung, in der
-- Oberfläche ein roher englischer Bezeichner. Dieselbe Klasse wie G2, nur an
-- der Datenquelle statt an der Anzeige.
--
-- Alle 25 Welten benennen diese Sprosse gleich, und alle 25 benennen die drei
-- obersten Sprossen identisch:
--
--     sort_order 1..3:  excellent → good → fair     (25 von 25 Welten)
--     sort_order 4:     poor (19 Welten) | restored (6)
--     sort_order 5:     ruined | critical | makeshift | obsolete | illuminated
--
-- **Zweitens: die Kette erreichte einen von drei Bauten nicht.** Weil sie bei
-- `good` beginnt, war jeder Bau auf `excellent` oder `fair` gegen Verfall
-- immun — und `fair` ist mit 78 Bauten der zweithäufigste Zustand überhaupt.
-- Sabotage und Krisenereignisse liefen an ihnen wirkungslos vorbei.
--
--     Reichweite vorher (good|moderate|poor):        209 von 324
--     Reichweite nachher (excellent|good|fair|poor): 297 von 324
--     bereits am Boden (ruined):                       4
--     weltspezifische Werte, weiterhin unbeweglich:   23
--
-- WAS DIESE MIGRATION TUT
-- -----------------------
-- Sie legt die Leiter an EINE Stelle: `fn_building_condition_step(zustand,
-- richtung)`. Vorher stand sie zweimal da — einmal absteigend in
-- `fn_degrade_building`, einmal aufsteigend in `fn_apply_dungeon_loot`
-- (Migration 289). Zwei Kopien einer Reihenfolge sind zwei Gelegenheiten, sie
-- unterschiedlich zu ändern; genau deshalb trug die eine `moderate` und die
-- andere suchte danach.
--
-- Die fünf Sprossen sind die gemessene gemeinsame Kernleiter, keine erfundene:
-- excellent → good → fair → poor → ruined.
--
-- WAS SIE AUSDRÜCKLICH NICHT TUT
-- ------------------------------
-- Die 23 Bauten auf weltspezifischen Werten (`anomalous`, `sealed`,
-- `thriving`, `illuminated`, …) bleiben unbeweglich. Sie über `sort_order` in
-- die Leiter zu hängen wäre naheliegend und wäre falsch: **sechs der 25 Welten
-- haben eine Leiter, die auf Sprosse 4 und 5 wieder AUFWÄRTS geht**
-- (`excellent → good → fair → restored → illuminated`). Ein Verfall entlang
-- `sort_order` würde dort einen Bau verbessern. Das ist ein Befund an der
-- Schmiede, kein Grund, hier eine Reihenfolge zu erraten — er ist gemeldet und
-- gehört dem Nutzer.
--
-- Ein Bau auf einem unbekannten Wert verfällt deshalb weiterhin nicht, aber
-- jetzt SICHTBAR: `fn_degrade_building` meldet `reason = 'condition_off_ladder'`
-- statt wie bisher `already_at_bottom` — eine Begründung, die nicht zutraf und
-- den Befund elf Monate lang zugedeckt hat.
--
-- `fn_apply_dungeon_loot` wird aus dem PROD-Körper neu erzeugt
-- (`pg_get_functiondef`, nicht aus Migration 289 kopiert — der Ledger taugt
-- nicht als Beleg für den Bestand). Signatur und Rechte bleiben unverändert:
-- `(uuid, uuid, jsonb)`, SECURITY INVOKER, `{postgres, service_role}`.
-- ============================================================================


-- ── Die Leiter, einmal ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_building_condition_step(
  p_condition TEXT,
  p_direction INTEGER   -- +1 = ein Schritt abwärts (Verfall), -1 = aufwärts
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH ladder(value, rung) AS (
    VALUES ('excellent', 1), ('good', 2), ('fair', 3), ('poor', 4), ('ruined', 5)
  ),
  here AS (SELECT rung FROM ladder WHERE value = p_condition)
  SELECT COALESCE(
    (SELECT l.value
       FROM ladder l, here
      WHERE l.rung = here.rung + p_direction),
    p_condition          -- Ende der Leiter erreicht, oder Wert nicht auf ihr
  );
$$;

COMMENT ON FUNCTION fn_building_condition_step(TEXT, INTEGER) IS
  'Ein Schritt auf der gemeinsamen Zustandsleiter der Bauten '
  '(excellent → good → fair → poor → ruined). +1 verfällt, -1 repariert. '
  'Ein Wert, der nicht auf der Leiter steht, kommt unverändert zurück — der '
  'Aufrufer entscheidet, ob das ein Ende oder ein Fehlschlag ist. Die fünf '
  'Sprossen sind die auf Prod gemessene gemeinsame Kernleiter aller 25 Welten '
  '(simulation_taxonomies, sort_order 1..5), nicht eine erfundene Aufzählung.';

REVOKE ALL ON FUNCTION fn_building_condition_step(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_building_condition_step(TEXT, INTEGER) TO authenticated, service_role;


-- ── Der Verfall benutzt sie ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_degrade_building(
    p_building_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old TEXT;
    v_new TEXT;
BEGIN
    SELECT building_condition INTO v_old
      FROM buildings
     WHERE id = p_building_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('changed', false, 'reason', 'building_not_found');
    END IF;

    v_new := fn_building_condition_step(v_old, 1);

    IF v_new = v_old THEN
        -- Zwei sehr verschiedene Fälle, die bisher beide 'already_at_bottom'
        -- hießen. Die Unterscheidung ist der ganze Punkt: der eine ist das
        -- Ende der Leiter, der andere ein Bau, der nie auf ihr stand.
        RETURN jsonb_build_object(
            'changed', false,
            'old_condition', v_old,
            'new_condition', v_old,
            'reason', CASE WHEN v_old = 'ruined'
                           THEN 'already_at_bottom'
                           ELSE 'condition_off_ladder' END
        );
    END IF;

    UPDATE buildings
       SET building_condition = v_new,
           updated_at = now()
     WHERE id = p_building_id
       AND building_condition = v_old;  -- compare-and-swap (ADR-007)

    IF NOT FOUND THEN
        RETURN jsonb_build_object('changed', false, 'reason', 'concurrent_modification');
    END IF;

    RETURN jsonb_build_object(
        'changed', true,
        'old_condition', v_old,
        'new_condition', v_new
    );
END;
$$;

COMMENT ON FUNCTION fn_degrade_building(UUID) IS
  'Atomarer Verfall eines Baus um eine Sprosse (ADR-007, compare-and-swap). '
  'Die Leiter kommt aus fn_building_condition_step und steht nicht mehr hier. '
  'reason unterscheidet seit Migration 303 zwischen already_at_bottom (Ende '
  'der Leiter) und condition_off_ladder (weltspezifischer Zustand).';

REVOKE ALL ON FUNCTION fn_degrade_building(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_degrade_building(UUID) TO service_role;


-- ── Und die Beute-Reparatur ebenfalls ───────────────────────────────────────
-- Körper aus pg_get_functiondef auf Prod gezogen; geändert sind nur die vier
-- Stellen, an denen die Leiter ein zweites Mal stand.

CREATE OR REPLACE FUNCTION public.fn_apply_dungeon_loot(p_run_id uuid, p_simulation_id uuid, p_loot_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
        -- Umkehrung des Verfalls. Die Leiter steht seit Migration 303 an
        -- EINER Stelle (fn_building_condition_step); vorher stand sie hier ein
        -- zweites Mal, mit einer Sprosse, die keine Welt-Taxonomie kennt.
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
              AND building_condition IN ('ruined', 'poor', 'fair', 'good')
            ORDER BY CASE building_condition
                         WHEN 'ruined' THEN 0 WHEN 'poor' THEN 1
                         WHEN 'fair'   THEN 2 ELSE 3
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
                    v_new_cond := fn_building_condition_step(v_new_cond, -1);
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
$function$;


REVOKE ALL ON FUNCTION fn_apply_dungeon_loot(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_apply_dungeon_loot(uuid, uuid, jsonb) TO service_role;


-- ── Abnahme ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_step_oid oid;
BEGIN
  SELECT p.oid INTO v_step_oid
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_building_condition_step';

  IF v_step_oid IS NULL THEN
    RAISE EXCEPTION 'Migration 303: fn_building_condition_step fehlt';
  END IF;

  -- Die Leiter selbst, in beide Richtungen.
  IF fn_building_condition_step('good', 1) <> 'fair' THEN
    RAISE EXCEPTION 'Migration 303: good verfaellt nicht zu fair, sondern zu %',
      fn_building_condition_step('good', 1);
  END IF;
  IF fn_building_condition_step('excellent', 1) <> 'good' THEN
    RAISE EXCEPTION 'Migration 303: excellent verfaellt nicht zu good';
  END IF;
  IF fn_building_condition_step('poor', -1) <> 'fair' THEN
    RAISE EXCEPTION 'Migration 303: poor repariert nicht zu fair';
  END IF;
  IF fn_building_condition_step('ruined', 1) <> 'ruined' THEN
    RAISE EXCEPTION 'Migration 303: das Ende der Leiter ist nicht stabil';
  END IF;
  IF fn_building_condition_step('anomalous', 1) <> 'anomalous' THEN
    RAISE EXCEPTION 'Migration 303: ein Wert neben der Leiter wurde veraendert';
  END IF;

  -- Die Sprosse, die es nie gab, darf in keiner der drei Funktionen mehr
  -- stehen. Geprueft wird der Funktionskoerper OHNE Kommentare — die
  -- Erklaerung des Befundes nennt den Wert absichtlich (J3b).
  IF EXISTS (
    SELECT 1
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('fn_degrade_building', 'fn_apply_dungeon_loot', 'fn_building_condition_step')
      AND position('moderate' in regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')) > 0
  ) THEN
    RAISE EXCEPTION 'Migration 303: die Sprosse moderate steht noch im Code einer der drei Funktionen';
  END IF;

  -- Rechte, wie vorher gemessen.
  IF NOT has_function_privilege('service_role', 'fn_degrade_building(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 303: service_role darf fn_degrade_building nicht mehr ausfuehren';
  END IF;
  IF NOT has_function_privilege('service_role', 'fn_apply_dungeon_loot(uuid,uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 303: service_role darf fn_apply_dungeon_loot nicht mehr ausfuehren';
  END IF;
END;
$$;
