-- ═══════════════════════════════════════════════════════════════════════════
-- 386 · Zwei Spalten, die der Takt seit dem 2. September braucht
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── DER BEFUND ─────────────────────────────────────────────────────────────
--
--   `_tick_simulation` schreibt am Ende `**tick_stats` in
--   `simulation_heartbeats`. Zwei der Schluessel haben dort keine Spalte:
--
--       memory_reflections    seit Migration 343 (02.09.) im Code
--       agent_continuations   seit Migration 362 (04.09.) im Code
--
--   PostgREST antwortet darauf mit PGRST204 („Could not find the
--   'agent_continuations' column"), die Anweisung scheitert, und mit ihr der
--   ganze Abschluss des Takts.
--
-- ── WARUM ES NIEMAND GESEHEN HAT ───────────────────────────────────────────
--
--   Weil der Herzschlag seit dem 02.09. 13:32 UTC abgeschaltet war — also
--   BEVOR der fehlerhafte Code ausgerollt wurde. Gemessen am 05.09., nachdem
--   er wieder eingeschaltet wurde:
--
--       status = completed   12 082   17.03.2026 .. 02.09.2026
--       status = failed          16   05.09.2026  ← ALLE seit dem Einschalten
--
--   Sechzehn von sechzehn. Der letzte gelungene Takt ist der vom Tag der
--   Abschaltung.
--
--   ⚠ Was dabei NICHT verlorengeht: die Phasen selbst laufen. Ereignisse,
--   Stimmungen, Autonomie, Fluestern, Verdichtung — alles wird geschrieben,
--   bevor die Anweisung scheitert. Verloren gehen `status`, `summary`, die
--   beiden Depeschen und alle Zaehler des Takts. Die Welt tickt, nur ihr
--   Bericht darueber ist leer und als gescheitert markiert.
--
--   Das ist die dritte Gestalt derselben Fehlerfamilie an einem Tag: eine
--   Aenderung, die fuer sich richtig ist, und eine zweite Haelfte, die
--   fehlt — der tote Parameter (`participants`), der Eintragstyp ohne CHECK
--   (Migration 384), und jetzt zwei Zaehler ohne Spalte.
--
-- ── DAS TOR DAGEGEN ────────────────────────────────────────────────────────
--
--   `backend/tests/unit/test_heartbeat_tick_stats_columns.py` bindet die
--   Schluessel aus `tick_stats[...]` an die Spalten, die Migrationen anlegen —
--   dieselbe Bauart wie `test_heartbeat_entry_types.py` fuer die
--   Eintragstypen und `test_ai_purposes_migration.py` fuer die Budgets. Ein
--   Zaehler ohne Spalte ist ab jetzt ein roter Test und kein stiller Ausfall.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE simulation_heartbeats
  ADD COLUMN IF NOT EXISTS memory_reflections  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_continuations INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN simulation_heartbeats.memory_reflections IS
  'Wie viele Verdichtungen dieser Takt angelegt hat (Phase 9.7, Migration 343). Die Spalte fehlte vom 02.09. bis 05.09.2026 und liess jeden Takt am Abschluss scheitern.';
COMMENT ON COLUMN simulation_heartbeats.agent_continuations IS
  'Wie viele Wortwechsel ohne Zuhoerer dieser Takt geschrieben hat (Phase 9.8, Migration 362). Siehe Migration 386.';

-- ── Selbstpruefung ─────────────────────────────────────────────────────────
--
-- Mit einer Wirkprobe, die ihre Bedingung HERSTELLT: eine Zeile schreiben,
-- die GENAU die fehlenden Spalten benutzt, und wieder entfernen. Ein Blick in
-- `information_schema` saehe die Spalte, nicht ihre Benutzbarkeit — und
-- PGRST204 kam aus dem Schema-Zwischenspeicher, nicht aus dem Katalog.
DO $$
DECLARE
  v_spalten int;
  v_sim     uuid;
  v_id      uuid;
BEGIN
  SELECT count(*) INTO v_spalten FROM information_schema.columns
  WHERE table_name = 'simulation_heartbeats'
    AND column_name IN ('memory_reflections', 'agent_continuations');
  IF v_spalten <> 2 THEN
    RAISE EXCEPTION '386: % der zwei Spalten sind da', v_spalten;
  END IF;

  SELECT s.id INTO v_sim FROM simulations s LIMIT 1;
  IF v_sim IS NULL THEN
    RAISE NOTICE '386: keine Welt vorhanden, Wirkprobe UEBERSPRUNGEN (Spalten sind geprueft).';
  ELSE
    INSERT INTO simulation_heartbeats
      (simulation_id, tick_number, status, memory_reflections, agent_continuations)
    VALUES (v_sim, 0, 'completed', 3, 2)
    RETURNING id INTO v_id;
    DELETE FROM simulation_heartbeats WHERE id = v_id;
    RAISE NOTICE '386: Wirkprobe bestanden - ein Takt mit beiden Zaehlern wird angenommen.';
  END IF;
END $$;

-- PostgREST haelt einen eigenen Schema-Zwischenspeicher. Ohne dieses Signal
-- meldet es die neue Spalte weiter als unbekannt, bis es von selbst neu liest
-- — und genau diese Meldung (PGRST204) war der Fehler.
NOTIFY pgrst, 'reload schema';
