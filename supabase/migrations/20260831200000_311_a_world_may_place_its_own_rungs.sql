-- ============================================================================
-- Migration 311 — Eine Welt darf ihre eigenen Sprossen setzen
-- ============================================================================
--
-- BEFUND (T3, gemessen auf Prod am 31.08.2026 nach 308 und 309)
-- -------------------------------------------------------------
-- Migration 303 hat die Zustandsleiter der Bauten an eine Stelle gelegt und
-- dabei einen Punkt offengelassen: Bauten auf einem weltspezifischen Wert
-- stehen NEBEN der Leiter und verfallen deshalb gar nicht. Seit 303 sagt
-- `fn_degrade_building` das immerhin (`reason = 'condition_off_ladder'`).
--
-- Nachgemessen sind es **23 Bauten auf zwölf verschiedenen Werten**:
--
--     pristine     6   (5 Welten)      thriving      2      restricted   1
--     illuminated  2   restored     2   anomalous     4      compromised  1
--     obsolete     1   functional   1   preserved     1      operational  1
--     sealed       1
--
-- An ihnen laufen Sabotage und Krisenereignisse wirkungslos vorbei. Das ist
-- die Bauart aus [[a-door-that-only-opens-for-those-inside]]: eine Mechanik,
-- deren Eintrittsbedingung ein Teil des Bestands nie erfüllt.
--
-- WARUM NICHT ZWÖLF EINZELENTSCHEIDUNGEN
-- --------------------------------------
-- Naheliegend wäre, jeden der zwölf Werte einer Sprosse zuzuordnen. Das wären
-- zwölf Aussagen über die Fiktion von zwölf Welten — ob `sealed` schlimmer ist
-- als `compromised`, ob `illuminated` über `excellent` steht. Eine Migration
-- darf das nicht erraten, und wer es einträgt, sollte die Welt kennen.
--
-- Diese Migration baut deshalb den MECHANISMUS und benutzt ihn für den einen
-- Wert, dessen Lage unstrittig ist.
--
-- WAS SIE TUT
-- -----------
-- 1. **`pristine` kommt auf die gemeinsame Kernleiter, über `excellent`.**
--    Sechs Bauten in fünf Welten tragen ihn; sein Deutsch ist gemessen
--    (`makellos`, 5 von 6) und seine Lage im Englischen unstrittig. Er ist
--    kein weltspezifisches Wort, sondern eine Sprosse, die im Kern gefehlt hat.
--
-- 2. **Die Sprossen bekommen Abstand** (5 · 10 · 20 · 30 · 40 · 50 statt
--    1..5), damit eine Welt eigene Werte DAZWISCHEN setzen kann. Der Schritt
--    rechnet deshalb nicht mehr `rung ± 1`, sondern nimmt die nächste Sprosse
--    der REIHE nach — die robustere Formulierung, die Abstand überhaupt erst
--    erlaubt.
--
-- 3. **`fn_building_condition_ladder(simulation_id)`** — die Leiter EINER
--    Welt: die Kernsprossen, die sie führt, plus jeden eigenen Wert, den sie
--    über `simulation_taxonomies.metadata->>'rung'` selbst gesetzt hat. Damit
--    ist `restored` in Cité des Dames eine Zeile Daten, keine Zeile Code.
--
-- 4. **`fn_building_condition_step(simulation_id, wert, richtung)`** — ein
--    Schritt, der das Vokabular der Welt NICHT VERLÄSST.
--
--    🔑 Das ist die Umkehrung dessen, was 308 getan hat, und sie ist nötig:
--    308 hat die DATEN unter dem Verfall abgeschlossen (jede erreichbare
--    Sprosse steht im Vokabular). `pristine` macht die Leiter aber auch nach
--    OBEN länger — und eine Reparatur von `excellent` würde in 26 Welten, die
--    `pristine` nicht führen, einen unbenennbaren Wert schreiben. Ein
--    Datenabschluss nach oben wäre die falsche Antwort (er erfände 26 Welten
--    ein Wort); der richtige Ort ist die OPERATION.
--
-- 5. `fn_degrade_building` und `fn_apply_dungeon_loot` benutzen sie. Damit
--    kann keiner der beiden Schreiber einen Bau mehr in einen Zustand
--    bringen, den seine Welt nicht benennen kann — in KEINE Richtung.
--
-- 6. `fn_degrade_building` sagt jetzt die Wahrheit über das Ende: bisher hiess
--    `already_at_bottom` wörtlich „steht auf `ruined`". Eine Welt, deren
--    unterste Sprosse `obsolete` heisst, bekam dort `condition_off_ladder` —
--    dieselbe Sorte Falschaussage, die 303 an anderer Stelle beseitigt hat.
--    Jetzt ist es die unterste Sprosse DIESER Welt.
--
-- WAS SIE NICHT TUT
-- -----------------
-- Sie setzt keinen der elf übrigen weltspezifischen Werte. Der Abnahmeblock
-- ZÄHLT sie stattdessen auf, damit die Liste sichtbar bleibt statt zu
-- verschwinden. Wer eine Welt kennt, trägt ihre Sprosse mit einer Zeile nach:
--
--     UPDATE simulation_taxonomies
--        SET metadata = jsonb_set(coalesce(metadata,'{}'), '{rung}', '25')
--      WHERE simulation_id = … AND taxonomy_type = 'building_condition'
--        AND value = 'restored';       -- zwischen good (20) und fair (30)
-- ============================================================================


-- ── 1. Die Kernleiter, mit `pristine` und mit Abstand ───────────────────────

CREATE OR REPLACE FUNCTION fn_building_condition_ladder()
RETURNS TABLE (value TEXT, rung INTEGER)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  VALUES ('pristine', 5), ('excellent', 10), ('good', 20),
         ('fair', 30), ('poor', 40), ('ruined', 50);
$$;

COMMENT ON FUNCTION fn_building_condition_ladder() IS
  'Die gemeinsame Kernleiter der Bauzustände, beste Sprosse zuerst. Die '
  'Nummern haben seit Migration 311 Abstand, damit eine Welt eigene Werte '
  'DAZWISCHEN setzen kann (simulation_taxonomies.metadata->>''rung''); die '
  'Schrittfunktion rechnet deshalb nicht mit ±1, sondern nimmt die nächste '
  'Sprosse der Reihe nach. Einzige Aufzählung der Kernleiter im Schema.';

REVOKE ALL     ON FUNCTION fn_building_condition_ladder() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_building_condition_ladder() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION fn_building_condition_ladder() TO service_role;


-- ── 2. Die Beschriftung kennt sie ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_building_condition_label(p_value TEXT)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_value
    WHEN 'pristine'  THEN '{"en":"Pristine","de":"Makellos"}'::jsonb
    WHEN 'excellent' THEN '{"en":"Excellent","de":"Ausgezeichnet"}'::jsonb
    WHEN 'good'      THEN '{"en":"Good","de":"Gut"}'::jsonb
    WHEN 'fair'      THEN '{"en":"Fair","de":"Befriedigend"}'::jsonb
    WHEN 'poor'      THEN '{"en":"Poor","de":"Schlecht"}'::jsonb
    WHEN 'ruined'    THEN '{"en":"Ruined","de":"Ruine"}'::jsonb
    ELSE jsonb_build_object('en', p_value)
  END;
$$;

COMMENT ON FUNCTION fn_building_condition_label(TEXT) IS
  'Die Beschriftung einer Kernsprosse, wie sie auf Prod bereits steht. `Makellos` '
  'für `pristine` ist gemessen (5 von 6 Bauten, vier Welten), nicht erfunden. '
  'Wird nur beim NACHTRAGEN einer fehlenden Sprosse benutzt; eine vorhandene '
  'Beschriftung überschreibt sie nie.';

REVOKE ALL     ON FUNCTION fn_building_condition_label(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_building_condition_label(TEXT) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION fn_building_condition_label(TEXT) TO service_role;


-- ── 3. Der Schritt nimmt die NÄCHSTE Sprosse, nicht rung ± 1 ────────────────

CREATE OR REPLACE FUNCTION fn_building_condition_step(
  p_condition TEXT,
  p_direction INTEGER   -- +1 = ein Schritt abwärts (Verfall), -1 = aufwärts
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH hier AS (
    SELECT l.rung FROM fn_building_condition_ladder() l WHERE l.value = p_condition
  )
  SELECT COALESCE(
    CASE WHEN p_direction > 0
      THEN (SELECT l.value FROM fn_building_condition_ladder() l, hier
             WHERE l.rung > hier.rung ORDER BY l.rung ASC  LIMIT 1)
      ELSE (SELECT l.value FROM fn_building_condition_ladder() l, hier
             WHERE l.rung < hier.rung ORDER BY l.rung DESC LIMIT 1)
    END,
    p_condition          -- Ende der Leiter, oder Wert nicht auf ihr
  );
$$;

COMMENT ON FUNCTION fn_building_condition_step(TEXT, INTEGER) IS
  'Ein Schritt auf der GEMEINSAMEN Kernleiter. Für einen Schreiber, der einen '
  'Bau bewegt, ist fn_building_condition_step(simulation_id, wert, richtung) '
  'die richtige Fassung: nur sie hält das Vokabular der jeweiligen Welt ein.';

REVOKE EXECUTE ON FUNCTION fn_building_condition_step(TEXT, INTEGER) FROM anon;
GRANT  EXECUTE ON FUNCTION fn_building_condition_step(TEXT, INTEGER) TO authenticated, service_role;


-- ── 4. Die Leiter EINER Welt ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_building_condition_ladder(p_simulation_id UUID)
RETURNS TABLE (value TEXT, rung INTEGER)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  -- Die Kernsprossen, die diese Welt selbst führt …
  SELECT t.value, l.rung
    FROM simulation_taxonomies t
    JOIN fn_building_condition_ladder() l ON l.value = t.value
   WHERE t.simulation_id = p_simulation_id
     AND t.taxonomy_type = 'building_condition'
     AND coalesce(t.is_active, TRUE)
  UNION
  -- … plus jeden eigenen Wert, den sie selbst auf eine Sprosse gesetzt hat.
  SELECT t.value, (t.metadata ->> 'rung')::int
    FROM simulation_taxonomies t
   WHERE t.simulation_id = p_simulation_id
     AND t.taxonomy_type = 'building_condition'
     AND coalesce(t.is_active, TRUE)
     AND t.metadata ? 'rung'
     AND (t.metadata ->> 'rung') ~ '^-?\d+$';
$$;

COMMENT ON FUNCTION fn_building_condition_ladder(UUID) IS
  'Die Zustandsleiter EINER Welt: die Kernsprossen, die sie führt, plus jeden '
  'eigenen Wert, den sie über metadata->>''rung'' selbst gesetzt hat. Eine '
  'Welt, die `restored` zwischen good (20) und fair (30) einordnen will, '
  'schreibt dort 25 hinein — eine Zeile Daten statt einer Zeile Code.';

REVOKE ALL     ON FUNCTION fn_building_condition_ladder(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_building_condition_ladder(UUID) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION fn_building_condition_ladder(UUID) TO service_role;


-- ── 5. Und der Schritt, der ihr Vokabular nicht verlässt ────────────────────

CREATE OR REPLACE FUNCTION fn_building_condition_step(
  p_simulation_id UUID,
  p_condition TEXT,
  p_direction INTEGER
)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH leiter AS (SELECT * FROM fn_building_condition_ladder(p_simulation_id)),
       hier   AS (SELECT l.rung FROM leiter l WHERE l.value = p_condition)
  SELECT COALESCE(
    CASE WHEN p_direction > 0
      THEN (SELECT l.value FROM leiter l, hier
             WHERE l.rung > hier.rung ORDER BY l.rung ASC  LIMIT 1)
      ELSE (SELECT l.value FROM leiter l, hier
             WHERE l.rung < hier.rung ORDER BY l.rung DESC LIMIT 1)
    END,
    p_condition
  );
$$;

COMMENT ON FUNCTION fn_building_condition_step(UUID, TEXT, INTEGER) IS
  'Ein Schritt auf der Leiter EINER Welt. Gibt den Wert unverändert zurück, '
  'wenn die Welt keine nächste Sprosse führt — damit kann kein Schreiber einen '
  'Bau in einen Zustand bringen, den seine Welt nicht benennen kann, in keine '
  'Richtung. Migration 308 hat das für den Verfall in den DATEN geschlossen; '
  'seit `pristine` reicht die Leiter auch nach oben, und dort wäre ein '
  'Datenabschluss falsch (er erfände 26 Welten ein Wort). Der richtige Ort ist '
  'die Operation.';

REVOKE ALL     ON FUNCTION fn_building_condition_step(UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_building_condition_step(UUID, TEXT, INTEGER) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION fn_building_condition_step(UUID, TEXT, INTEGER) TO service_role;


-- ── 6. Der Verfall benutzt die Leiter seiner Welt ───────────────────────────

CREATE OR REPLACE FUNCTION fn_degrade_building(
    p_building_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sim   UUID;
    v_old   TEXT;
    v_new   TEXT;
    v_unten TEXT;
BEGIN
    SELECT simulation_id, building_condition INTO v_sim, v_old
      FROM buildings
     WHERE id = p_building_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('changed', false, 'reason', 'building_not_found');
    END IF;

    v_new := fn_building_condition_step(v_sim, v_old, 1);

    IF v_new = v_old THEN
        -- Zwei sehr verschiedene Fälle. Die Unterscheidung ist der Punkt —
        -- und seit Migration 311 ist sie auch RICHTIG: `already_at_bottom`
        -- hiess bis dahin woertlich „steht auf ruined", also bekam eine Welt,
        -- deren unterste Sprosse `obsolete` heisst, faelschlich
        -- `condition_off_ladder`. Jetzt ist es die unterste Sprosse DIESER
        -- Welt.
        SELECT l.value INTO v_unten
          FROM fn_building_condition_ladder(v_sim) l
         ORDER BY l.rung DESC
         LIMIT 1;

        RETURN jsonb_build_object(
            'changed', false,
            'old_condition', v_old,
            'new_condition', v_old,
            'reason', CASE WHEN v_old = v_unten
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

    -- `building_condition_de` zieht der Auslöser aus Migration 309 nach.
    RETURN jsonb_build_object(
        'changed', true,
        'old_condition', v_old,
        'new_condition', v_new
    );
END;
$$;

COMMENT ON FUNCTION fn_degrade_building(UUID) IS
  'Atomarer Verfall eines Baus um eine Sprosse (ADR-007, compare-and-swap). '
  'Die Leiter ist seit Migration 311 die der jeweiligen WELT, nicht die '
  'gemeinsame — ein Bau kann damit nicht in einen Zustand fallen, den seine '
  'Welt nicht benennen kann. reason unterscheidet already_at_bottom (unterste '
  'Sprosse DIESER Welt) von condition_off_ladder (Wert steht auf keiner).';

REVOKE ALL ON FUNCTION fn_degrade_building(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_degrade_building(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_degrade_building(UUID) TO service_role;


-- ── 7. Und die Beute-Reparatur ebenfalls ────────────────────────────────────
-- Körper aus pg_get_functiondef auf Prod gezogen. Geändert sind zwei Stellen:
-- die Wahl des beschädigten Baus (sie trug eine DRITTE, fest verdrahtete Kopie
-- der Leiter) und der Schritt selbst.

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

            -- Der am staerksten beschaedigte Bau der Welt. Bis Migration 311
            -- stand hier eine EIGENE, fest verdrahtete Rangliste
            -- ('ruined','poor','fair','good') — die dritte Kopie der Leiter,
            -- und sie kannte weder `pristine` noch einen einzigen
            -- weltspezifischen Wert. Ein Bau auf `sealed` oder `illuminated`
            -- war fuer die Reparatur unsichtbar, genau wie fuer den Verfall.
            -- Jetzt entscheidet die Leiter DIESER Welt, und zwar dieselbe, die
            -- auch der Schritt benutzt.
            SELECT b.id, b.building_condition INTO v_building_id, v_old_cond
            FROM buildings b
            JOIN fn_building_condition_ladder(p_simulation_id) l
              ON l.value = b.building_condition
            WHERE b.simulation_id = p_simulation_id
              AND b.deleted_at IS NULL
              -- nur, was ueberhaupt reparierbar ist: es muss eine Sprosse
              -- darueber geben
              AND fn_building_condition_step(p_simulation_id, b.building_condition, -1)
                  <> b.building_condition
            ORDER BY l.rung DESC, b.id
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
                    v_new_cond := fn_building_condition_step(p_simulation_id, v_new_cond, -1);
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
$function$
;

REVOKE ALL ON FUNCTION fn_apply_dungeon_loot(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_apply_dungeon_loot(uuid, uuid, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_apply_dungeon_loot(uuid, uuid, jsonb) TO service_role;


-- ── Abnahme ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_anzahl INT;
  v_text   TEXT;
  v_sim    UUID;
  v_ohne   UUID;
BEGIN
  -- (a) Die Kernleiter: sechs Sprossen, `pristine` zuoberst, mit Abstand.
  SELECT count(*) INTO v_anzahl FROM fn_building_condition_ladder();
  IF v_anzahl <> 6 THEN
    RAISE EXCEPTION 'Migration 311: die Kernleiter hat % Sprossen statt 6', v_anzahl;
  END IF;
  IF (SELECT l.value FROM fn_building_condition_ladder() l ORDER BY l.rung LIMIT 1) <> 'pristine' THEN
    RAISE EXCEPTION 'Migration 311: pristine steht nicht zuoberst';
  END IF;
  IF EXISTS (
    SELECT 1 FROM fn_building_condition_ladder() a, fn_building_condition_ladder() b
     WHERE a.value <> b.value AND abs(a.rung - b.rung) < 5
  ) THEN
    RAISE EXCEPTION 'Migration 311: die Sprossen haben keinen Abstand — dann kann keine Welt dazwischen setzen';
  END IF;

  -- (b) Der gemeinsame Schritt, jetzt mit pristine.
  IF fn_building_condition_step('pristine', 1) <> 'excellent' THEN
    RAISE EXCEPTION 'Migration 311: pristine verfaellt nicht zu excellent, sondern zu %',
      fn_building_condition_step('pristine', 1);
  END IF;
  IF fn_building_condition_step('excellent', -1) <> 'pristine' THEN
    RAISE EXCEPTION 'Migration 311: excellent repariert nicht zu pristine';
  END IF;
  IF fn_building_condition_step('pristine', -1) <> 'pristine' THEN
    RAISE EXCEPTION 'Migration 311: der Kopf der Leiter ist nicht stabil';
  END IF;
  -- Die Zusicherungen aus 303 und 308 muessen weiter gelten.
  IF fn_building_condition_step('good', 1) <> 'fair'
     OR fn_building_condition_step('fair', 1) <> 'poor'
     OR fn_building_condition_step('poor', -1) <> 'fair'
     OR fn_building_condition_step('ruined', 1) <> 'ruined' THEN
    RAISE EXCEPTION 'Migration 311: die Kernleiter verhaelt sich nicht mehr wie in 303/308 zugesichert';
  END IF;

  -- (c) DER PUNKT: der weltbewusste Schritt verlaesst das Vokabular NICHT.
  --
  -- ⚠ Zwei Probelaeufe haben die Voraussetzung dieser Probe berichtigt, und
  -- beide Male war nicht der Code falsch, sondern meine Annahme ueber die
  -- Daten:
  --   1. The Moebius Academy fuehrt `pristine`, aber KEIN `excellent`.
  --   2. Und dann: KEINE der fuenf `pristine`-Welten fuehrt `excellent`.
  --      Migration 309 hat ihr Vokabular aus ihren EIGENEN Bauten abgeleitet,
  --      und keine dieser Welten hat je einen `excellent`-Bau gehabt.
  -- Die Probe fragt deshalb nicht nach einer festen Sprosse, sondern nach der,
  -- die diese Welt TATSAECHLICH unter `pristine` fuehrt.
  SELECT t.simulation_id INTO v_sim
    FROM simulation_taxonomies t
   WHERE t.taxonomy_type = 'building_condition' AND t.value = 'pristine'
   ORDER BY t.simulation_id
   LIMIT 1;
  IF v_sim IS NULL THEN
    RAISE EXCEPTION 'Migration 311: keine Welt fuehrt pristine — die Probe kann nicht laufen';
  END IF;

  -- Die Sprosse unmittelbar unter `pristine` in DIESER Welt.
  SELECT l.value INTO v_text
    FROM fn_building_condition_ladder(v_sim) l
   WHERE l.rung > (SELECT k.rung FROM fn_building_condition_ladder(v_sim) k WHERE k.value = 'pristine')
   ORDER BY l.rung ASC
   LIMIT 1;
  IF v_text IS NULL THEN
    RAISE EXCEPTION 'Migration 311: die pristine-Welt hat keine Sprosse darunter';
  END IF;

  IF fn_building_condition_step(v_sim, 'pristine', 1) <> v_text THEN
    RAISE EXCEPTION 'Migration 311: pristine verfaellt in seiner eigenen Welt nicht zu %, sondern zu %',
      v_text, fn_building_condition_step(v_sim, 'pristine', 1);
  END IF;
  IF fn_building_condition_step(v_sim, v_text, -1) <> 'pristine' THEN
    RAISE EXCEPTION 'Migration 311: eine Welt MIT pristine kommt von % nicht hinauf', v_text;
  END IF;
  IF fn_building_condition_step(v_sim, 'pristine', -1) <> 'pristine' THEN
    RAISE EXCEPTION 'Migration 311: der Kopf der Weltleiter ist nicht stabil';
  END IF;

  -- Und die Gegenprobe, auf die es ankommt: eine Welt OHNE pristine darf durch
  -- eine Reparatur keinen bekommen. Ohne diese Zusicherung waere `pristine` auf
  -- der Kernleiter eine Verschlechterung — 26 Welten koennten einen Wert
  -- geschrieben bekommen, den sie nicht benennen.
  SELECT t.simulation_id INTO v_ohne
    FROM simulation_taxonomies t
   WHERE t.taxonomy_type = 'building_condition' AND t.value = 'excellent'
     AND NOT EXISTS (SELECT 1 FROM simulation_taxonomies u
                      WHERE u.simulation_id = t.simulation_id
                        AND u.taxonomy_type = 'building_condition' AND u.value = 'pristine')
   LIMIT 1;
  IF v_ohne IS NULL THEN
    RAISE EXCEPTION 'Migration 311: keine Welt ohne pristine — die Gegenprobe kann nicht laufen';
  END IF;
  IF fn_building_condition_step(v_ohne, 'excellent', -1) <> 'excellent' THEN
    RAISE EXCEPTION
      'Migration 311: eine Welt OHNE pristine bekaeme durch Reparatur einen Wert, den sie nicht benennen kann';
  END IF;

  -- (d) Und in KEINER Richtung darf ein Schreiber das Vokabular verlassen.
  --     Geprueft ueber alle Welten und alle Werte, die ihre Bauten tragen.
  SELECT count(*), string_agg(DISTINCT x.slug || ':' || x.wert || '→' || x.ziel, ', ')
    INTO v_anzahl, v_text
  FROM (
    SELECT s.slug, b.building_condition AS wert, r.ziel
    FROM buildings b
    JOIN simulations s ON s.id = b.simulation_id AND s.deleted_at IS NULL
    CROSS JOIN LATERAL (
      SELECT unnest(ARRAY[
        fn_building_condition_step(b.simulation_id, b.building_condition, 1),
        fn_building_condition_step(b.simulation_id, b.building_condition, -1)
      ]) AS ziel
    ) r
    WHERE b.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM simulation_taxonomies t
                       WHERE t.simulation_id = b.simulation_id
                         AND t.taxonomy_type = 'building_condition'
                         AND t.value = r.ziel)
  ) x;
  IF COALESCE(v_anzahl, 0) > 0 THEN
    RAISE EXCEPTION 'Migration 311: % Schritt(e) fuehren aus dem Vokabular ihrer Welt heraus — %',
      v_anzahl, left(v_text, 400);
  END IF;

  -- (e) Rechte, gemessen statt angenommen. Zwei Widerrufe je NEUER Funktion.
  IF has_function_privilege('anon', 'fn_building_condition_ladder(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'fn_building_condition_ladder(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 311: fn_building_condition_ladder(uuid) ist oeffentlich aufrufbar';
  END IF;
  IF has_function_privilege('anon', 'fn_building_condition_step(uuid,text,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'fn_building_condition_step(uuid,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 311: fn_building_condition_step(uuid,…) ist oeffentlich aufrufbar';
  END IF;
  IF has_function_privilege('anon', 'fn_degrade_building(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'fn_apply_dungeon_loot(uuid,uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 311: ein Schreiber ist anon-aufrufbar (SECURITY DEFINER!)';
  END IF;
  IF NOT has_function_privilege('service_role', 'fn_degrade_building(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'fn_apply_dungeon_loot(uuid,uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 311: service_role darf einen Schreiber nicht mehr ausfuehren';
  END IF;

  -- (f) Was OFFEN bleibt, wird GENANNT statt verschwiegen. Diese Werte stehen
  --     auf keiner Sprosse; die Bauten darauf verfallen weiterhin nicht. Wer
  --     die Welt kennt, traegt metadata->>'rung' nach.
  SELECT count(*), string_agg(x.slug || ': ' || x.wert || ' ×' || x.n, ', ' ORDER BY x.slug, x.wert)
    INTO v_anzahl, v_text
  FROM (
    SELECT s.slug, b.building_condition AS wert, count(*) AS n
    FROM buildings b
    JOIN simulations s ON s.id = b.simulation_id AND s.deleted_at IS NULL
    WHERE b.deleted_at IS NULL
      AND fn_building_condition_step(b.simulation_id, b.building_condition, 1) = b.building_condition
      AND fn_building_condition_step(b.simulation_id, b.building_condition, -1) = b.building_condition
    GROUP BY s.slug, b.building_condition
  ) x;
  RAISE NOTICE 'Migration 311: % Welt/Wert-Paare stehen weiterhin neben jeder Sprosse — %',
    COALESCE(v_anzahl, 0), COALESCE(left(v_text, 600), '(keine)');
END;
$$;
