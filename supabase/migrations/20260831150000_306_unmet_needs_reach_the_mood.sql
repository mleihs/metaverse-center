-- ============================================================================
-- Migration 306 — Bedürfnisse fallen, und niemand fühlt es (N5, die Ursache)
-- ============================================================================
--
-- DER BEFUND, UND WARUM ER EINER IST UND NICHT VIER
-- -------------------------------------------------
-- Die Systemprüfung hat vier unerreichbare Auslöser autonomer Ereignisse
-- gemeldet (N5). Beim Abarbeiten von D10-5 stellte sich heraus: es ist EINER,
-- in vier Verkleidungen.
--
--   Es gibt genau EINE Quelle negativer Stimmung: `resonance_pressure`,
--   Stärke −1, gedeckelt auf eine Zeile je Agent (74 Zeilen, 74 Agenten).
--       ↓
--   Die Laune kann −1 nicht unterschreiten.
--       ↓
--   `insult` (Tor bei −20), `confrontation` (−40) und `seek_comfort` (−30)
--   werden NIE gewählt — drei von sechs sozialen Interaktionen sind toter
--   Inhalt.
--       ↓
--   Keine negativen Meinungsmodifikatoren  →  Meinung fällt nie unter 0
--       →  `relationship_threshold` (±60) tot
--       ↓
--   Keine negativen Moodlets  →  `fn_update_stress_levels` (Tor bei
--   `mood_score < -20`) erhöht nie den Stress  →  Stress steht bei 0 bei allen
--   258 Agenten  →  `stress_breakdown` (≥ 800) tot, und D6 konnte nie auslösen.
--
-- **Um unglücklich zu werden, muss ein Agent beleidigt werden; um zu
-- beleidigen, muss er unglücklich sein.** Das System kann seine eigene
-- negative Hälfte nicht anwerfen. Das ist kein Gleichgewichtsproblem, sondern
-- ein fehlender Startimpuls — und deshalb repariert es NICHT, die Schwellen zu
-- senken: solange die einzige negative Quelle ein einzelnes −1-Moodlet ist,
-- bleibt die Laune bei −1, und ein Tor bei −3 wäre genauso unerreichbar, nur
-- knapper.
--
-- DIE QUELLE, DIE ES SCHON GIBT UND DIE AN NICHTS ANGESCHLOSSEN IST
-- -----------------------------------------------------------------
-- `agent_needs` fällt von allein. `fn_decay_agent_needs` (Migr. 145) senkt
-- fünf Zahlen je Tick und tut sonst nichts — **kein Dienst und keine Funktion
-- erzeugt aus einem Bedürfnis jemals ein Moodlet.** Gemessen: null.
--
-- Und die Zahlen bewegen sich wirklich. Prod, 31.08.2026, 258 Agenten:
--
--     social       0 … 97   (Mittel 54,2)   ← einzelne Agenten sind verhungert
--     stimulation 28 … 76   (Mittel 52,7)
--     safety      22 … 100  ·  comfort 52 … 100  ·  purpose 58 … 100
--
--     27 Agenten haben ein Bedürfnis unter 20, 72 unter 40.
--
-- Die Größe, die die Welt von selbst in Bewegung bringen würde, bewegt sich
-- also längst. Sie ist nur an nichts angeschlossen.
--
-- WOHER DIE ZAHLEN KOMMEN
-- -----------------------
-- Nicht aus dem Kopf. `scripts/measure_mood_reachability.py` liest die echten
-- Bedürfnisstände und rechnet für ein Raster von Kandidatenregeln aus, welche
-- Laune daraus folgt. Auf den heutigen Daten:
--
--     unter 30 → −3, gestuft je 10   schlechteste Laune −13   0 Agenten < −20
--     unter 35 → −3, gestuft je 10   schlechteste Laune −16   0 Agenten
--     unter 40 → −2, gestuft je 10   schlechteste Laune −15   0 Agenten
--     unter 40 → −3, gestuft je 10   schlechteste Laune −22   2 Agenten  ← die einzige,
--                                                                          die ein Tor öffnet
--
-- **Jede sanftere Regel lässt alle vier Tore geschlossen** — das wäre N5 noch
-- einmal, nur mit mehr Aufwand. Die gewählte ist die schwächste, die überhaupt
-- etwas bewirkt.
--
-- Ein zusätzlicher Gesamtboden wurde geprüft und WEGGELASSEN: er ändert auf
-- den heutigen Daten nichts (dieselben 2 Agenten, dieselbe −22). Eine Grenze,
-- die nichts begrenzt, ist eine Zahl ohne Aufgabe (J6). Begrenzt wird auch so:
-- je Bedürfnis höchstens −15 (Stand 0 → 5 Stufen), und die Bevölkerung
-- begrenzt sich selbst, siehe unten.
--
-- WARUM DAS NICHT DAVONLÄUFT
-- --------------------------
-- `AgentActivityService._compute_need_bonus` gibt einer Tätigkeit bis zu
-- **+30 Nutzen**, wenn sie ein niedriges Bedürfnis deckt (`(60 - stand) / 2`).
-- Ein Agent mit `social = 0` zieht also mit voller Kraft zum Geselligsein. Das
-- System hat eine Gegenkopplung, und die gemessene Nettobewegung ist deshalb
-- eine GLEICHGEWICHTSRATE, keine Bahn im freien Fall:
--
--     social −0,45/Tick · stimulation −0,61/Tick   (fallen langsam)
--     purpose +1,21 · comfort +4,08 · safety ±0    (erholen sich)
--
-- Gemessen aus 4 572 Tätigkeiten über 7 Tage, durch
-- `ACTIVITY_NEED_FULFILLMENT` gerechnet.
--
-- WAS DIESE FUNKTION TUT
-- ----------------------
-- Ein Moodlet je unerfülltem Bedürfnis, ersetzend statt anhäufend — dieselbe
-- Bauart wie `fn_apply_resonance_moodlets` (Migr. 161): erst löschen, dann neu
-- setzen, damit der aktuelle Stand abgebildet wird und nicht die Summe aller
-- vergangenen. Ohne das Ersetzen wäre es genau das ungedeckelte Anhäufen, das
-- D10-5 gerade beseitigt hat.
--
-- Die Regeln kommen als `jsonb` HEREIN und stehen nicht hier: SQL trägt die
-- Integrität, Python die Spielregel (`NEED_MOODLETS` in
-- `agent_needs_service.py`). Dieselbe Trennung wie bei `fn_create_zone_action`
-- (Migr. 301). Die Zahlen an zwei Orten zu führen hieße, sie irgendwann an
-- einem zu ändern.
--
-- Kein dynamisches SQL: die fünf Bedürfnisspalten werden über ein `VALUES`
-- entpivotiert und gegen die Regeln verbunden — eine Anweisung, mengenbasiert,
-- statt fünf mit zusammengesetzten Spaltennamen.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_apply_need_moodlets(
  p_simulation_id uuid,
  p_rules jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  -- Ersetzen, nicht anhäufen. Die Moodlets bilden den JETZIGEN Stand ab.
  DELETE FROM agent_moodlets
  WHERE simulation_id = p_simulation_id
    AND stacking_group LIKE 'need\_%';

  WITH levels AS (
    SELECT n.agent_id, v.need, v.level
    FROM agent_needs n
    CROSS JOIN LATERAL (VALUES
      ('social',      n.social),
      ('purpose',     n.purpose),
      ('safety',      n.safety),
      ('comfort',     n.comfort),
      ('stimulation', n.stimulation)
    ) AS v(need, level)
    WHERE n.simulation_id = p_simulation_id
  ),
  rules AS (
    SELECT
      r.key                                   AS need,
      (r.value ->> 'threshold')::numeric      AS threshold,
      (r.value ->> 'strength')::integer       AS strength,
      GREATEST(1, (r.value ->> 'step')::numeric) AS step,
      r.value ->> 'emotion'                   AS emotion,
      r.value ->> 'moodlet_type'              AS moodlet_type,
      r.value ->> 'description'               AS description
    FROM jsonb_each(p_rules) AS r
  ),
  gewaehlt AS (
    SELECT
      l.agent_id,
      r.moodlet_type,
      r.emotion,
      -- Eine Stufe je angefangene `step`-Spanne unter der Schwelle. Der CHECK
      -- auf agent_moodlets.strength lässt −20 bis 20 zu; GREATEST hält uns
      -- darunter, auch wenn jemand die Regel später schärfer stellt.
      GREATEST(
        -20,
        r.strength * (1 + floor((r.threshold - l.level::numeric) / r.step))::integer
      ) AS strength,
      COALESCE(r.description, 'Unerfülltes Bedürfnis: ' || l.need) AS description,
      'need_' || l.need AS stacking_group
    FROM levels l
    JOIN rules r ON r.need = l.need
    WHERE l.level::numeric < r.threshold
  )
  INSERT INTO agent_moodlets (
    agent_id, simulation_id, moodlet_type, emotion, strength,
    source_type, source_description, decay_type, initial_strength,
    expires_at, stacking_group
  )
  SELECT
    g.agent_id,
    p_simulation_id,
    g.moodlet_type,
    g.emotion,
    g.strength,
    'system',
    g.description,
    'timed',
    g.strength,
    -- Etwas länger als ein Tick (4 h), damit zwischen zwei Ticks keine Lücke
    -- entsteht, in der die Laune grundlos hochspringt. Dieselbe Begründung
    -- wie bei fn_apply_resonance_moodlets.
    now() + INTERVAL '5 hours',
    g.stacking_group
  FROM gewaehlt g;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION fn_apply_need_moodlets(uuid, jsonb) IS
  'Ein Moodlet je unerfülltem Bedürfnis, ersetzend statt anhäufend (N5). '
  'Schließt die einzige Lücke, die verhinderte, dass ein Agent überhaupt '
  'unglücklich werden kann: agent_needs fiel von allein und war an nichts '
  'angeschlossen. Die Schwellen und Stärken kommen als jsonb aus '
  'NEED_MOODLETS (agent_needs_service.py) — SQL traegt die Integritaet, '
  'Python die Spielregel.';

REVOKE ALL ON FUNCTION fn_apply_need_moodlets(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_apply_need_moodlets(uuid, jsonb) TO service_role;

-- ── Abnahme ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_oid oid;
  v_body text;
BEGIN
  SELECT p.oid INTO v_oid
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_apply_need_moodlets';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Migration 306: fn_apply_need_moodlets wurde nicht angelegt';
  END IF;

  v_body := pg_get_functiondef(v_oid);

  IF position('DELETE FROM agent_moodlets' in v_body) = 0 THEN
    RAISE EXCEPTION 'Migration 306: das Ersetzen fehlt — die Moodlets wuerden sich anhaeufen';
  END IF;

  IF (SELECT prosecdef FROM pg_proc WHERE oid = v_oid) THEN
    RAISE EXCEPTION 'Migration 306: die Funktion braucht keine erhoehten Rechte (ADR-006)';
  END IF;

  -- Keine Schwelle und keine Staerke darf im Koerper stehen: sie kommen aus
  -- Python. Geprueft ohne Kommentare, weil der Kopf die Zahlen absichtlich
  -- nennt, um den Befund zu erklaeren (J3b).
  IF position('40' in regexp_replace(
       substring(v_body from position('AS $function$' in v_body)),
       '--[^' || chr(10) || ']*', '', 'g')) > 0 THEN
    RAISE EXCEPTION 'Migration 306: eine Balance-Zahl steht im Funktionskoerper statt in NEED_MOODLETS';
  END IF;
END;
$$;
