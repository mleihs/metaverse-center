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
-- Gegen die eigene Wirkung: nimmt der CHECK den neuen Namen an, und weist er
-- einen erfundenen weiterhin ab. Beides in einer Transaktion, die
-- zurückgerollt wird — die Probe darf keine Zeile hinterlassen.
--
-- Anders als bei `chat_conversations` (Migration 357) liegt hier kein
-- Fremdschlüssel im Weg, der vor dem CHECK zuschlüge: `heartbeat_entries`
-- lässt sich mit erfundenen IDs probeweise befüllen. Die Probe ist deshalb
-- die stärkere Prüfung und wird auch benutzt.
DO $$
DECLARE
  v_neu_ok boolean := false;
BEGIN
  BEGIN
    INSERT INTO heartbeat_entries (simulation_id, tick_number, entry_type, title)
    VALUES ('00000000-0000-0000-0000-000000000000', 0, 'agent_continuation', 'Probe 362');
    v_neu_ok := true;
    RAISE EXCEPTION 'ROLLBACK_PROBE';
  EXCEPTION
    WHEN check_violation THEN
      RAISE EXCEPTION '362: der CHECK weist agent_continuation weiterhin ab';
    WHEN foreign_key_violation THEN
      RAISE NOTICE '362: Probe UEBERSPRUNGEN (Fremdschluessel greift zuerst) — nicht bestanden.';
    WHEN OTHERS THEN
      IF SQLERRM <> 'ROLLBACK_PROBE' THEN
        RAISE;
      END IF;
  END;

  IF v_neu_ok THEN
    RAISE NOTICE '362: agent_continuation wird angenommen.';
  END IF;
END $$;
