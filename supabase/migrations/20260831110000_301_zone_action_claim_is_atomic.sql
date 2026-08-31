-- ============================================================================
-- Migration 301 — Eine Zonenmaßnahme wird beansprucht, nicht geprüft
-- ============================================================================
--
-- BEFUND (D10-1 / S18)
-- --------------------
-- `ZoneActionService.create_action` prüfte in drei getrennten Anfragen und fügte
-- danach ein:
--
--   1. SELECT — gibt es eine noch laufende Maßnahme auf dieser Zone?
--   2. SELECT — steht die jüngste Maßnahme dieser Art noch in der Abklingzeit?
--   3. INSERT
--
-- Zwischen 1 und 3 liegt ein Netzwerk-Umlauf. Zwei gleichzeitige Anfragen für
-- dieselbe Zone lesen beide „keine aktive Maßnahme" und fügen beide ein. Die
-- Tabelle hat dagegen keine Sperre, und das war bekannt: Migration 072 schreibt
-- es in den Quelltext —
--
--     -- Note: max 1 active action per zone enforced in application layer
--     -- (partial unique index with now() not possible — not IMMUTABLE)
--
-- Der Schluss war richtig (ein partieller UNIQUE-Index kann `now()` nicht
-- benutzen), die Folgerung nicht: die Alternative zum Index ist nicht die
-- Anwendungsschicht, sondern eine Transaktion mit Sperre. Genau das ist ADR-007.
--
-- WAS DIESE FUNKTION TUT
-- ----------------------
-- Sie nimmt zuerst eine Beratungssperre auf die ZONE (`pg_advisory_xact_lock`),
-- prüft dann beide Bedingungen und fügt ein — alles in einer Transaktion. Die
-- zweite gleichzeitige Anfrage wartet an der Sperre, liest danach die bereits
-- eingefügte Zeile und wird korrekt mit `active_exists` abgewiesen. Die Sperre
-- ist auf die Zone geschlüsselt, nicht auf die Tabelle: zwei Maßnahmen auf zwei
-- verschiedenen Zonen laufen weiterhin nebeneinander.
--
-- WARUM DIE SPIELZAHLEN PARAMETER SIND UND NICHT HIER STEHEN
-- ----------------------------------------------------------
-- `effect_value`, `duration_days` und `cooldown_days` stammen aus
-- `ACTION_CONFIG` in `zone_action_service.py` und werden übergeben. SQL sichert
-- die INTEGRITÄT (höchstens eine laufende Maßnahme je Zone, Abklingzeit wird
-- eingehalten), Python trägt die SPIELREGEL. Die Zahlen an zwei Orten zu führen
-- hieße, sie irgendwann an einem zu ändern.
--
-- VERHALTEN, DAS ABSICHTLICH UNVERÄNDERT BLEIBT
-- ---------------------------------------------
-- Die Abklingzeit-Prüfung sieht die jüngste Maßnahme dieser Art OHNE Rücksicht
-- auf `deleted_at` an — eine abgebrochene Maßnahme hält ihre Abklingzeit also
-- weiterhin. Das ist das heutige Verhalten; es zu ändern wäre eine
-- Balance-Entscheidung und gehört nicht in eine Migration, die eine Wettlaufsituation
-- schließt.
--
-- SECURITY INVOKER, mit Absicht: die Funktion braucht keine erhöhten Rechte.
-- Unter dem Nutzer-JWT läuft sie als `authenticated` und die RLS-Richtlinien von
-- `zone_actions` gelten unverändert; unter `service_role` gilt der übliche
-- Bypass. Damit fällt sie nicht unter die SECURITY-DEFINER-Regel aus CLAUDE.md
-- (ADR-006) und `lint-no-secdef-public-grant.sh` hat nichts zu prüfen.
--
-- Rückgabewerte: `status` ist eines von 'created' | 'active_exists' | 'cooldown'.
-- Bewusst NICHT `error`/`message` als Schlüssel — supabase-py deutet beide als
-- PostgREST-Fehler und wirft `APIError` selbst bei HTTP 200.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_create_zone_action(
  p_simulation_id  uuid,
  p_zone_id        uuid,
  p_action_type    text,
  p_user_id        uuid,
  p_effect_value   numeric,
  p_duration_days  integer,
  p_cooldown_days  integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_now            timestamptz := now();
  v_cooldown_until timestamptz;
  v_expires_at     timestamptz;
  v_row            jsonb;
BEGIN
  -- Serialisiert alle Beanspruchungen DERSELBEN Zone; andere Zonen bleiben
  -- ungehindert. Gilt bis zum Ende der Transaktion und wird nie vergessen.
  PERFORM pg_advisory_xact_lock(hashtextextended('zone_action:' || p_zone_id::text, 0));

  IF EXISTS (
    SELECT 1
    FROM zone_actions
    WHERE zone_id = p_zone_id
      AND simulation_id = p_simulation_id
      AND deleted_at IS NULL
      AND expires_at > v_now
  ) THEN
    RETURN jsonb_build_object('status', 'active_exists');
  END IF;

  SELECT cooldown_until
    INTO v_cooldown_until
  FROM zone_actions
  WHERE zone_id = p_zone_id
    AND simulation_id = p_simulation_id
    AND action_type = p_action_type
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_cooldown_until IS NOT NULL AND v_cooldown_until > v_now THEN
    RETURN jsonb_build_object(
      'status', 'cooldown',
      'cooldown_until', v_cooldown_until
    );
  END IF;

  v_expires_at := v_now + make_interval(days => p_duration_days);

  INSERT INTO zone_actions (
    zone_id, simulation_id, action_type, effect_value,
    created_by_id, expires_at, cooldown_until
  )
  VALUES (
    p_zone_id, p_simulation_id, p_action_type, p_effect_value,
    p_user_id, v_expires_at, v_expires_at + make_interval(days => p_cooldown_days)
  )
  RETURNING to_jsonb(zone_actions.*) INTO v_row;

  RETURN jsonb_build_object('status', 'created', 'action', v_row);
END;
$$;

COMMENT ON FUNCTION fn_create_zone_action(uuid, uuid, text, uuid, numeric, integer, integer) IS
  'Atomare Beanspruchung einer Zonenmaßnahme (ADR-007, D10-1): Beratungssperre je '
  'Zone, dann Prüfung auf laufende Maßnahme und Abklingzeit, dann INSERT — alles in '
  'einer Transaktion. Ersetzt das Prüfen-dann-Einfügen aus zone_action_service.py, '
  'bei dem zwei gleichzeitige Anfragen beide durchkamen. Spielzahlen sind Parameter '
  'und bleiben in ACTION_CONFIG.';

REVOKE ALL ON FUNCTION fn_create_zone_action(uuid, uuid, text, uuid, numeric, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_create_zone_action(uuid, uuid, text, uuid, numeric, integer, integer) TO authenticated, service_role;

-- ── Abnahme ────────────────────────────────────────────────────────────────
-- Eine Migration, die nichts bewirkt hat, ist sonst ein stiller Erfolg.
DO $$
DECLARE
  v_oid oid;
BEGIN
  SELECT p.oid INTO v_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_create_zone_action';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Migration 301: fn_create_zone_action wurde nicht angelegt';
  END IF;

  IF (SELECT prosecdef FROM pg_proc WHERE oid = v_oid) THEN
    RAISE EXCEPTION 'Migration 301: fn_create_zone_action darf NICHT SECURITY DEFINER sein (ADR-006)';
  END IF;

  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 301: authenticated darf fn_create_zone_action nicht ausführen';
  END IF;

  IF position('pg_advisory_xact_lock' in pg_get_functiondef(v_oid)) = 0 THEN
    RAISE EXCEPTION 'Migration 301: die Sperre fehlt im Funktionskörper — die Wettlaufsituation ist offen';
  END IF;
END;
$$;
