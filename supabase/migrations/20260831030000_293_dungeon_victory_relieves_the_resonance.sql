-- Migration 293: Ein besiegter Archetyp lindert die Resonanz, die ihn geöffnet hat.
--
-- Befund D9 der Systemprüfung: der Dungeon gibt viel an die Welt zurück —
-- Stimmung, Stress, ein Moodlet, eine Aktivitätszeile, Aptitude-Punkte, eine
-- Erinnerung, ein Journal-Fragment, bis zu zwölf Erfolge — aber NICHTS an die
-- Resonanz, die ihn überhaupt geöffnet hat. `resonance_dungeon_runs.resonance_id`
-- ist auf Prod bei 15 von 15 Läufen NULL, und kein Dienst berührt
-- `substrate_resonances` oder `resonance_impacts`.
--
-- Folge im Spiel: der besiegte Archetyp steht sofort wieder bereit, und der
-- Sieg hat auf den Zustand der Welt keinerlei Wirkung. Die Spezifikation §5.4
-- sieht eine Druckminderung von 0,15 × Schwierigkeit vor.
--
-- Gemindert wird `resonance_impacts.effective_magnitude` — der WELT-EIGENE
-- Wert. `substrate_resonances.magnitude` bleibt unberührt: die Resonanz ist ein
-- plattformweites Ereignis, und der Sieg einer Welt darf sie nicht für alle
-- anderen entschärfen.
--
-- Atomar als Funktion statt Lesen-Rechnen-Schreiben in Python (ADR-007): zwei
-- gleichzeitig abgeschlossene Läufe derselben Welt würden sich sonst gegenseitig
-- überschreiben, und der zweite Sieg wäre wirkungslos.

BEGIN;

CREATE OR REPLACE FUNCTION fn_relieve_resonance_after_dungeon(
    p_resonance_id   UUID,
    p_simulation_id  UUID,
    p_difficulty     INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
AS $fn$
DECLARE
    v_factor  NUMERIC;
    v_before  NUMERIC;
    v_after   NUMERIC;
BEGIN
    -- Spezifikation §5.4: 0,15 je Schwierigkeitsstufe. Stufe 5 nimmt also 75 %,
    -- Stufe 1 nimmt 15 %. Untergrenze 0,05, damit eine Resonanz nie ganz auf
    -- null fällt und die Welt einen Rest behält.
    v_factor := GREATEST(0.0, 1.0 - (0.15 * GREATEST(1, LEAST(5, p_difficulty))));

    SELECT effective_magnitude INTO v_before
    FROM resonance_impacts
    WHERE resonance_id = p_resonance_id
      AND simulation_id = p_simulation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('relieved', false, 'reason', 'no_impact_row');
    END IF;

    UPDATE resonance_impacts
    SET effective_magnitude = GREATEST(0.05, COALESCE(effective_magnitude, 0) * v_factor),
        updated_at = now()
    WHERE resonance_id = p_resonance_id
      AND simulation_id = p_simulation_id
    RETURNING effective_magnitude INTO v_after;

    RETURN jsonb_build_object(
        'relieved', true,
        'factor', v_factor,
        'before', v_before,
        'after', v_after
    );
END;
$fn$;

-- Privilegierte RPC: nur über den Service-Role-Client des Backends (CLAUDE.md,
-- ADR-006). Der Router prüft die Berechtigung, bevor er hierher kommt.
REVOKE EXECUTE ON FUNCTION fn_relieve_resonance_after_dungeon(UUID, UUID, INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_relieve_resonance_after_dungeon(UUID, UUID, INTEGER) TO service_role;

COMMIT;
