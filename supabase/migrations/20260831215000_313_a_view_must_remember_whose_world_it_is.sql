-- ============================================================================
-- 313 · Eine Sicht muss wissen, zu welcher Welt sie gehört
-- ============================================================================
--
-- BEFUND (gemessen am 31.08.2026 auf Prod)
--
-- Fünf Welten sind gelöscht (`simulations.deleted_at IS NOT NULL`). Ihre Kinder
-- sind es nicht: das Löschen einer Welt setzt `deleted_at` auf der Welt und
-- lässt Agenten, Bauten, Zonen unangetastet.
--
--     gelöschte Welten                                   5
--     Agenten darin mit deleted_at IS NULL              30
--     Bauten  darin mit deleted_at IS NULL              34
--     Zonen   darin                                     25
--     Ereignisse darin                                   0
--
-- Das allein wäre ein Zählfehler. Es ist aber ein LESEFENSTER.
--
-- `active_agents`, `active_buildings` und `active_events` sind Sichten ohne
-- `security_invoker`, im Besitz von `postgres`, mit SELECT für `anon` und
-- `authenticated`. Sie laufen also als ihr Eigentümer, und die RLS der
-- Basistabelle greift nicht. Genau darauf sind sie gebaut: sie sind der
-- öffentliche Lesepfad (Public-First; `drift_service.py` nennt es an zwei
-- Stellen ausdrücklich so).
--
-- Nur trägt die Richtlinie der Basistabelle eine Bedingung, die die Sicht nicht
-- kennt. `agents_anon_select` lautet:
--
--     deleted_at IS NULL AND EXISTS (SELECT 1 FROM simulations
--       WHERE id = agents.simulation_id
--         AND status = 'active' AND deleted_at IS NULL)
--
-- Die Sicht prüft davon nur die erste Hälfte — das `deleted_at` des KINDES.
-- Über die Elternwelt sagt sie nichts. Ergebnis: 30 Agenten und 34 Bauten
-- gelöschter Welten sind anonym lesbar, obwohl die Richtlinie derselben Tabelle
-- sie verweigert.
--
-- Migration 294 hat diese acht öffentlichen Sichten geprüft und mit der
-- Begründung stehen lassen, „ihre Basistabellen gewähren `anon` dasselbe per
-- Richtlinie". Für das `deleted_at` des Kindes stimmt das. Für die Elternwelt
-- nicht — und das war der ungemessene Teil des Satzes.
--
-- WAS DIESE MIGRATION TUT
--
-- Sie gibt den drei Sichten die fehlende Hälfte: die Elternwelt darf nicht
-- gelöscht sein.
--
-- WAS SIE AUSDRÜCKLICH NICHT TUT
--
-- 1. Sie filtert NICHT `status = 'active'`, obwohl die anon-Richtlinie es tut.
--    `active_agents` ist auch der MITGLIEDER-Lesepfad (`AgentService.view_name`
--    über `BaseService._read_table`). Ein Status ist kein Betrieb, und eine
--    archivierte Welt gehört weiterhin ihren Verwaltern: `status` in die Sicht
--    zu nehmen hiesse, einem Admin die Agenten seiner eigenen archivierten Welt
--    zu verbergen. Heute fiele das nicht auf — es gibt keine archivierte Welt
--    ohne `deleted_at`, die fünf sind beides. Genau deshalb ist es der Moment,
--    die beiden Aussagen NICHT zu verschmelzen.
--
-- 2. Sie löscht nichts. Eine Kaskade auf die Kinder wäre unumkehrbar, und
--    `SimulationService.restore_simulation` existiert und setzt `deleted_at`
--    zurück. Mit dieser Migration kommt eine zurückgeholte Welt mit ihren
--    Agenten und Bauten zurück — ohne sie wäre die Rückholung unvollständig
--    oder die Kaskade hätte sie längst vernichtet.
--
-- 3. Sie legt keine `active_zones` an. `zones` hat keine Sicht und damit kein
--    RLS-umgehendes Lesefenster; `zones_anon_select` joint `simulations`
--    korrekt. Eine Sicht anzulegen, die niemand liest, wäre eine Zeile, die die
--    nächste Sitzung erklären muss.
--
-- METHODE
--
-- `SELECT *` ist Hausstil (Migr. 145/110/137) und hier belegbar folgenlos: die
-- drei Sichten führen heute exakt die Spalten ihrer Tabelle (26/26, 30/30,
-- 27/27 — gemessen). `CREATE OR REPLACE VIEW` behält Eigentümer und Rechte.
--
-- PRÜFUNG siehe Abnahmeblock am Ende.
-- ============================================================================

BEGIN;

-- ── 1. Agenten ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW active_agents AS
  SELECT * FROM agents a
  WHERE a.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM simulations s
      WHERE s.id = a.simulation_id
        AND s.deleted_at IS NULL
    );

COMMENT ON VIEW active_agents IS
  'Öffentlicher Lesepfad für Agenten (Public-First, ohne security_invoker). '
  'Filtert das deleted_at des Agenten UND das seiner Welt — die anon-Richtlinie '
  'agents_anon_select tut beides, die Sicht tat bis Migration 313 nur das erste. '
  'Bewusst OHNE status-Filter: eine archivierte Welt gehört weiterhin ihren '
  'Verwaltern (diese Sicht ist auch AgentService.view_name).';

-- ── 2. Bauten ───────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW active_buildings AS
  SELECT * FROM buildings b
  WHERE b.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM simulations s
      WHERE s.id = b.simulation_id
        AND s.deleted_at IS NULL
    );

COMMENT ON VIEW active_buildings IS
  'Öffentlicher Lesepfad für Bauten. Siehe active_agents — dieselbe fehlende '
  'Hälfte, dieselbe Reparatur (Migration 313).';

-- ── 3. Ereignisse ───────────────────────────────────────────────────────────
-- Heute null Ereignisse in gelöschten Welten. Die Sicht bekommt die Bedingung
-- trotzdem: sie fehlt aus demselben Grund, und eine Welt, die MIT Ereignissen
-- gelöscht wird, ist eine Frage der Zeit, nicht der Wahrscheinlichkeit.
CREATE OR REPLACE VIEW active_events AS
  SELECT * FROM events e
  WHERE e.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM simulations s
      WHERE s.id = e.simulation_id
        AND s.deleted_at IS NULL
    );

COMMENT ON VIEW active_events IS
  'Öffentlicher Lesepfad für Ereignisse. Siehe active_agents — dieselbe '
  'fehlende Hälfte, dieselbe Reparatur (Migration 313). Beim Anwenden null '
  'betroffene Zeilen; die Bedingung steht für die Welt, die später gelöscht wird.';

-- ── Abnahme ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_geloescht     integer;
  v_agenten       integer;
  v_bauten        integer;
  v_ereignisse    integer;
  v_agenten_rest  integer;
  v_bauten_rest   integer;
BEGIN
  SELECT count(*) INTO v_geloescht FROM simulations WHERE deleted_at IS NOT NULL;

  -- Was die Sichten NOCH zeigen, das zu einer gelöschten Welt gehört: muss 0 sein.
  SELECT count(*) INTO v_agenten
    FROM active_agents v
    JOIN simulations s ON s.id = v.simulation_id
   WHERE s.deleted_at IS NOT NULL;

  SELECT count(*) INTO v_bauten
    FROM active_buildings v
    JOIN simulations s ON s.id = v.simulation_id
   WHERE s.deleted_at IS NOT NULL;

  SELECT count(*) INTO v_ereignisse
    FROM active_events v
    JOIN simulations s ON s.id = v.simulation_id
   WHERE s.deleted_at IS NOT NULL;

  IF v_agenten <> 0 OR v_bauten <> 0 OR v_ereignisse <> 0 THEN
    RAISE EXCEPTION
      'Sichten zeigen weiterhin Kinder gelöschter Welten: % Agenten, % Bauten, % Ereignisse',
      v_agenten, v_bauten, v_ereignisse;
  END IF;

  -- Gegenprobe: die Sichten dürfen nicht LEER geworden sein. Ein Filter, der
  -- alles wegnimmt, bestünde die Prüfung oben ebenfalls.
  SELECT count(*) INTO v_agenten_rest FROM active_agents;
  SELECT count(*) INTO v_bauten_rest  FROM active_buildings;

  IF v_agenten_rest = 0 OR v_bauten_rest = 0 THEN
    RAISE EXCEPTION
      'Gegenprobe fehlgeschlagen — die Sichten sind leer: % Agenten, % Bauten',
      v_agenten_rest, v_bauten_rest;
  END IF;

  -- Die Rechte müssen den Ersatz überlebt haben: ohne sie bricht der
  -- öffentliche Lesepfad, und zwar still (403 statt 500).
  IF NOT has_table_privilege('anon', 'public.active_agents', 'SELECT')
     OR NOT has_table_privilege('anon', 'public.active_buildings', 'SELECT')
     OR NOT has_table_privilege('anon', 'public.active_events', 'SELECT') THEN
    RAISE EXCEPTION 'CREATE OR REPLACE hat den anon-Grant verloren';
  END IF;

  RAISE NOTICE
    '313 ok — % gelöschte Welten, ihre Kinder sind aus den drei Sichten verschwunden; Rest: % Agenten, % Bauten',
    v_geloescht, v_agenten_rest, v_bauten_rest;
END $$;

COMMIT;
