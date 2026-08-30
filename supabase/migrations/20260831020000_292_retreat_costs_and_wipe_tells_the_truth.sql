-- Migration 292: Der Rückzug kostete nichts, und die Auslöschung log.
--
-- Zwei Befunde der Systemprüfung, beide in Migration 164 entstanden.
--
-- D5 — `fn_abandon_dungeon_run` rief `fn_apply_dungeon_outcome` NICHT.
-- Abschluss (`fn_complete_dungeon_run`) und Auslöschung (`fn_wipe_dungeon_run`)
-- riefen es seit jeher; nur der Rückzug nicht. Der über einen ganzen Lauf
-- angesammelte Stress lebt allein im Arbeitsspeicher des Backends und verfiel
-- beim Rückzug restlos: kein Stress, kein Moodlet, keine Aktivitätszeile.
-- Zusammen mit der verdampfenden Beute (D3, Migr. 289) war die beste Strategie
-- damit: erkunden bis es gefährlich wird, zurückziehen, neu anfangen.
--
-- D12 — Der Text der Auslöschung behauptete „Alle Agenten sind verloren".
-- Tatsächlich wendet `fn_wipe_dungeon_run` −20 Stimmung, +200 Stress und ein
-- Moodlet an; niemand ist verloren. Der Satz beschrieb ein Spiel, das es nicht
-- gibt, und machte die einzige echte Härte des Dungeons unglaubwürdig.
--
-- ZUR SIGNATURÄNDERUNG: `fn_abandon_dungeon_run` bekommt zwei Parameter dazu.
-- Ein blosses CREATE OR REPLACE mit mehr Argumenten legt in PostgreSQL eine
-- ÜBERLADUNG an statt zu ersetzen — genau die Falle, die Migration 289 bei
-- `fn_apply_dungeon_loot` aufgeräumt hat (dort standen zwei Fassungen, und die
-- gepflegte war die tote). Deshalb hier explizit DROP + CREATE. Die zwei neuen
-- Parameter haben DEFAULTs, damit ein Aufruf mit fünf Argumenten während des
-- Deploy-Fensters weiter aufgeht und sich verhält wie bisher.

BEGIN;

DROP FUNCTION IF EXISTS fn_abandon_dungeon_run(UUID, UUID, JSONB, INTEGER, INTEGER);

CREATE FUNCTION fn_abandon_dungeon_run(
    p_run_id          UUID,
    p_simulation_id   UUID,
    p_outcome         JSONB,
    p_depth           INTEGER,
    p_room_index      INTEGER,
    p_agent_outcomes  JSONB DEFAULT '[]'::JSONB,
    p_loot_items      JSONB DEFAULT '[]'::JSONB
) RETURNS VOID
LANGUAGE plpgsql
AS $fn$
DECLARE
    v_loot_result JSONB;
BEGIN
    -- 1. Update run status
    UPDATE resonance_dungeon_runs
    SET status       = 'abandoned',
        outcome      = p_outcome,
        completed_at = now(),
        updated_at   = now()
    WHERE id = p_run_id
    AND status IN ('active', 'combat', 'exploring', 'distributing');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Run % not found or not in active state', p_run_id;
    END IF;

    -- 2. Apply what the run actually cost. Until Migration 292 this function
    --    applied NOTHING: the stress a party accumulated over a whole run lived
    --    only in the backend's memory and evaporated on withdrawal, and the
    --    partial loot went into the outcome blob and nowhere else. Abschluss
    --    und Auslöschung riefen `fn_apply_dungeon_outcome` seit jeher — nur der
    --    Rückzug nicht (Befund D5).
    IF jsonb_array_length(COALESCE(p_agent_outcomes, '[]'::JSONB)) > 0 THEN
        PERFORM fn_apply_dungeon_outcome(p_run_id, p_simulation_id, p_agent_outcomes);
    END IF;

    IF jsonb_array_length(COALESCE(p_loot_items, '[]'::JSONB)) > 0 THEN
        v_loot_result := fn_apply_dungeon_loot(p_run_id, p_simulation_id, p_loot_items);
    END IF;

    -- 3. Log abandonment event
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
$fn$;

REVOKE EXECUTE ON FUNCTION fn_abandon_dungeon_run(UUID, UUID, JSONB, INTEGER, INTEGER, JSONB, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_abandon_dungeon_run(UUID, UUID, JSONB, INTEGER, INTEGER, JSONB, JSONB)
    TO service_role;

-- ── D12: die Auslöschung sagt, was sie tut ──────────────────────────────────

CREATE OR REPLACE FUNCTION fn_wipe_dungeon_run(
    p_run_id          UUID,
    p_simulation_id   UUID,
    p_agent_outcomes  JSONB,
    p_depth           INTEGER,
    p_room_index      INTEGER
) RETURNS VOID
LANGUAGE plpgsql
AS $fn$
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
        'The darkness keeps what it can hold. The party returns marked.',
        'Die Dunkelheit behält, was sie greifen kann. Die Gruppe kehrt gezeichnet zurück.',
        '{}'::JSONB
    );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION fn_wipe_dungeon_run(UUID, UUID, JSONB, INTEGER, INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_wipe_dungeon_run(UUID, UUID, JSONB, INTEGER, INTEGER) TO service_role;

COMMIT;
