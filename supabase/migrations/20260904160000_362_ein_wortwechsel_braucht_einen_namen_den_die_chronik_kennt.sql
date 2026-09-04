-- ═══════════════════════════════════════════════════════════════════════════
-- 362 · Ein Wortwechsel braucht einen Namen, den die Chronik kennt
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Phase 9.8 (`ContinuationService.generate_for_simulation`) schreibt
-- Chronikzeilen vom Typ `agent_continuation`. Der CHECK auf
-- `heartbeat_entries.entry_type` kennt ihn nicht — jede solche Zeile würde
-- abgewiesen.
--
-- ⚠ DIESELBE LÜCKE ZUM DRITTEN MAL: `bond_whisper` (Migration 285),
-- `memory_reflection` (346), und jetzt hier. Der Code gibt einen neuen Typ
-- aus, die Deklaration und der CHECK lernen ihn nicht.
--
-- Beim ersten Mal fiel es auf, als jemand die Chronik las. Beim zweiten und
-- beim dritten hat `test_every_emitted_entry_type_is_declared` es beim ersten
-- Lauf gefangen. Das Tor, das aus dem ersten Vorfall entstanden ist, hält —
-- und dass es dreimal ausgelöst hat, ist kein Argument gegen das Tor, sondern
-- die Messung, wie oft dieser Fehler ohne es durchgegangen wäre.
--
-- Die Kosten ohne CHECK sind nicht kosmetisch: eine abgewiesene Zeile lässt
-- den GANZEN Stapel scheitern, der Tick friert ein und die Welt steht.
--
-- Der CHECK muss der Deklaration in `heartbeat_entry_builder.py` EXAKT
-- entsprechen; `test_heartbeat_entry_types.py` bindet beide aneinander.

BEGIN;

ALTER TABLE heartbeat_entries DROP CONSTRAINT IF EXISTS heartbeat_entries_entry_type_check;

ALTER TABLE heartbeat_entries ADD CONSTRAINT heartbeat_entries_entry_type_check
  CHECK (entry_type = ANY (ARRAY[
    'zone_shift', 'event_aging', 'event_escalation', 'event_resolution',
    'scar_tissue', 'resonance_pressure', 'resonance_mood', 'cascade_spawn',
    'bureau_response', 'attunement_deepen', 'anchor_strengthen', 'convergence',
    'positive_event', 'narrative_arc', 'system_note', 'agent_crisis',
    'relationship_shift', 'social_event', 'autonomous_event', 'ambient_weather',
    'bond_whisper',
    'memory_reflection',
    'agent_continuation'
  ]::TEXT[]));

COMMIT;

-- ── Selbstprüfung ──────────────────────────────────────────────────────────
-- Gegen die eigene Wirkung, und mit einer PROBE: nimmt der CHECK den neuen
-- Namen an, und weist er einen erfundenen weiterhin ab. Zu zählen, dass die
-- Beschränkung dasteht, wäre ein Haken ohne Deckung.
--
-- ⚠ `heartbeat_entries` verlangt `heartbeat_id` (NOT NULL, Fremdschlüssel)
-- und `narrative_en`. Die erste Fassung dieser Probe setzte eine Spalte
-- `title` ein, die es nicht gibt — sie wäre auf einer frischen Datenbank mit
-- 42703 gescheitert, also an einem Fehler in der PRÜFUNG statt an einem in
-- der Sache. Gefunden hat es der Trockenlauf gegen Produktion.
--
-- Die Probe läuft deshalb gegen einen ECHTEN Herzschlag, falls es einen gibt,
-- und wird sonst per RAISE NOTICE ÜBERSPRUNGEN. Nicht verschwiegen: eine
-- Prüfung, die nichts zu prüfen fand, ist keine bestandene.
DO $$
DECLARE
  v_hb  uuid;
  v_sim uuid;
BEGIN
  SELECT id, simulation_id INTO v_hb, v_sim FROM simulation_heartbeats ORDER BY created_at DESC LIMIT 1;
  IF v_hb IS NULL THEN
    RAISE NOTICE '362: kein Herzschlag vorhanden — CHECK-Probe UEBERSPRUNGEN, nicht bestanden. Der neue Wert steht in der Beschraenkung, ist aber nicht ausprobiert.';
    RETURN;
  END IF;

  BEGIN
    INSERT INTO heartbeat_entries (heartbeat_id, simulation_id, tick_number, entry_type, narrative_en)
    VALUES (v_hb, v_sim, 0, 'agent_continuation', 'Probe 362');
    DELETE FROM heartbeat_entries WHERE heartbeat_id = v_hb AND narrative_en = 'Probe 362';
    RAISE NOTICE '362: agent_continuation wird angenommen.';
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION '362: der CHECK weist agent_continuation weiterhin ab';
  END;

  BEGIN
    INSERT INTO heartbeat_entries (heartbeat_id, simulation_id, tick_number, entry_type, narrative_en)
    VALUES (v_hb, v_sim, 0, 'erfunden', 'Probe 362b');
    DELETE FROM heartbeat_entries WHERE heartbeat_id = v_hb AND narrative_en = 'Probe 362b';
    RAISE EXCEPTION '362: der CHECK hat einen erfundenen Typ durchgelassen';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '362: ein erfundener Typ wird weiterhin abgewiesen.';
  END;
END $$;
