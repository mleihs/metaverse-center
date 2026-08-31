-- Migration 296: Die abgeleiteten Autonomieparameter konnten nie ankommen.
--
-- Befund N1 der Systemprüfung, und er reicht tiefer als gemeldet.
--
-- Gemessen auf Prod: alle 258 `agents.personality_profile` sind `{}`, weil
-- `PersonalityExtractionService` keinen Aufrufer hat. Die Folge ist aber nicht
-- nur „Big Five fehlt":
--
--     select count(distinct resilience), count(distinct volatility),
--            count(distinct sociability) from agent_mood;
--     → 1, 1, 1     (258 Zeilen, je EIN einziger Wert: 0.5 / 0.5 / 0.5)
--
-- **Jeder Agent jeder Welt ist verhaltensgleich.** `initialize_agent_autonomy`
-- leitet aus dem Profil Resilienz, Volatilität, Geselligkeit und vier
-- Bedürfnis-Zerfallsraten ab (`_derive_autonomy_params`) und übergibt sie an
-- `fn_initialize_agent_autonomy`. Läuft dieser Pfad nie, greifen die
-- DEFAULT-Werte der Funktionssignatur — und genau die stehen auf Prod.
--
-- ZUM ZWEITEN PROBLEM, das erst beim Nachmessen sichtbar wurde:
-- `fn_initialize_agent_autonomy` trägt zweimal `ON CONFLICT (agent_id) DO
-- NOTHING`. Migration 286 (Befund A3) ruft sie beim Materialisieren in SQL, um
-- Agenten ohne Innenleben zu verhindern — richtig und nötig. Sie legt die
-- Zeilen damit aber MIT DEN VORGABEN an, und ein späterer Aufruf mit echten,
-- aus der Persönlichkeit abgeleiteten Werten tut danach nichts. Die Reparatur
-- hat die Tür für die abgeleiteten Werte zugezogen.
--
-- Deshalb wird hier NICHT `fn_initialize_agent_autonomy` geändert: sie soll
-- weiterhin nur anlegen, und ihr `DO NOTHING` ist für diesen Zweck richtig.
-- Stattdessen trennt diese Migration „die Zeile existiert" von „die Zeile ist
-- eingestellt". Die zweite Hälfte darf jederzeit nachgezogen werden, auch
-- Monate später, wenn eine Persönlichkeit endlich bekannt ist.
--
-- Angefasst werden AUSSCHLIESSLICH Konfigurationsspalten. `mood_score`,
-- `stress_level` und die fünf aktuellen Bedürfnisstände bleiben unberührt —
-- sie sind Zustand einer laufenden Welt, keine Einstellung.

BEGIN;

CREATE OR REPLACE FUNCTION fn_apply_agent_autonomy_params(
    p_agent_id           UUID,
    p_simulation_id      UUID,
    p_resilience         REAL,
    p_volatility         REAL,
    p_sociability        REAL,
    p_social_decay       REAL,
    p_purpose_decay      REAL,
    p_safety_decay       REAL,
    p_comfort_decay      REAL,
    p_stimulation_decay  REAL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_mood_updated  INT := 0;
    v_needs_updated INT := 0;
BEGIN
    -- Nur Einstellungen. mood_score und stress_level stehen bewusst NICHT hier.
    UPDATE agent_mood
    SET resilience  = p_resilience,
        volatility  = p_volatility,
        sociability = p_sociability,
        updated_at  = now()
    WHERE agent_id = p_agent_id
      AND simulation_id = p_simulation_id;
    GET DIAGNOSTICS v_mood_updated = ROW_COUNT;

    -- Nur die Zerfallsraten. Die aktuellen Bedürfnisstände bleiben stehen.
    UPDATE agent_needs
    SET social_decay      = p_social_decay,
        purpose_decay     = p_purpose_decay,
        safety_decay      = p_safety_decay,
        comfort_decay     = p_comfort_decay,
        stimulation_decay = p_stimulation_decay,
        updated_at        = now()
    WHERE agent_id = p_agent_id
      AND simulation_id = p_simulation_id;
    GET DIAGNOSTICS v_needs_updated = ROW_COUNT;

    RETURN jsonb_build_object(
        'mood_updated', v_mood_updated,
        'needs_updated', v_needs_updated
    );
END;
$fn$;

-- Privilegierte RPC: nur über den service_role-Client des Backends (ADR-006,
-- CLAUDE.md). Die Aufrufstelle prüft die Berechtigung, bevor sie hierher kommt.
REVOKE EXECUTE ON FUNCTION fn_apply_agent_autonomy_params(
    UUID, UUID, REAL, REAL, REAL, REAL, REAL, REAL, REAL, REAL
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_apply_agent_autonomy_params(
    UUID, UUID, REAL, REAL, REAL, REAL, REAL, REAL, REAL, REAL
) TO service_role;

COMMIT;
