-- ═══════════════════════════════════════════════════════════════════════════
-- 384 · Ein Eintragstyp, den der Zwang nicht kennt
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Migration 383 hat den Widerspruchs-Erkenner gebracht. Er schreibt eine
-- Chronikzeile vom Typ `memory_supersede` — und der CHECK auf
-- `heartbeat_entries.entry_type` kennt sie nicht.
--
-- ── WARUM DAS NICHT NUR EINE ZEILE IST ─────────────────────────────────────
--
--   Ein Wert, den der Zwang ablehnt, laesst den GANZEN Stapel scheitern:
--   `heartbeat_entries` wird als Bündel geschrieben. Der Takt friert, und
--   die Welt steht. Genau dieselbe Stelle hat Migration 346 fuer
--   `memory_reflection` geschlossen, und `test_heartbeat_entry_types.py`
--   bindet Deklaration und Zwang seither aneinander — es hat diesen Fall
--   gefangen, bevor er auf Produktion kam.
--
--   Der CHECK muss der Deklaration in `heartbeat_entry_builder.py` EXAKT
--   entsprechen. Deshalb wird die ganze Liste neu geschrieben und nicht
--   erweitert: eine Liste, die an zwei Orten waechst, waechst irgendwann
--   ungleich.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE heartbeat_entries DROP CONSTRAINT IF EXISTS heartbeat_entries_entry_type_check;

ALTER TABLE heartbeat_entries ADD CONSTRAINT heartbeat_entries_entry_type_check
  CHECK (entry_type = ANY (ARRAY[
    'zone_shift', 'event_aging', 'event_escalation', 'event_resolution',
    'scar_tissue', 'resonance_pressure', 'resonance_mood', 'cascade_spawn',
    'bureau_response', 'attunement_deepen', 'anchor_strengthen', 'convergence',
    'positive_event', 'narrative_arc', 'system_note', 'agent_crisis',
    'relationship_shift', 'social_event', 'autonomous_event', 'ambient_weather',
    'bond_whisper', 'memory_reflection', 'memory_supersede', 'agent_continuation'
  ]::TEXT[]));

-- ── Selbstpruefung ─────────────────────────────────────────────────────────
--
-- Mit einer Wirkprobe, die ihre Bedingung HERSTELLT: eine Zeile des neuen
-- Typs einfuegen, messen dass sie angenommen wird, wieder entfernen. Ein
-- reiner Blick in `pg_constraint` saehe den Text des Zwangs, nicht seine
-- Wirkung.
DO $$
DECLARE
  v_zwang int;
  v_sim   uuid;
  v_hb    uuid;
  v_id    uuid;
BEGIN
  SELECT count(*) INTO v_zwang FROM pg_constraint
  WHERE conname = 'heartbeat_entries_entry_type_check'
    AND pg_get_constraintdef(oid) LIKE '%memory_supersede%';
  IF v_zwang <> 1 THEN
    RAISE EXCEPTION '384: der Zwang kennt memory_supersede nicht';
  END IF;

  SELECT count(*) INTO v_zwang FROM pg_constraint
  WHERE conname = 'heartbeat_entries_entry_type_check'
    AND pg_get_constraintdef(oid) LIKE '%memory_reflection%';
  IF v_zwang <> 1 THEN
    RAISE EXCEPTION '384: memory_reflection aus Migration 346 ist verlorengegangen';
  END IF;

  SELECT s.id INTO v_sim FROM simulations s LIMIT 1;
  SELECT h.id INTO v_hb FROM simulation_heartbeats h WHERE h.simulation_id = v_sim LIMIT 1;
  IF v_sim IS NULL OR v_hb IS NULL THEN
    RAISE NOTICE '384: keine Welt oder kein Takt vorhanden, Wirkprobe UEBERSPRUNGEN (Zwang ist geprueft).';
  ELSE
    INSERT INTO heartbeat_entries
      (heartbeat_id, simulation_id, tick_number, entry_type, narrative_en, narrative_de, severity)
    VALUES (v_hb, v_sim, 0, 'memory_supersede', '384 probe', '384 Probe', 'info')
    RETURNING id INTO v_id;
    DELETE FROM heartbeat_entries WHERE id = v_id;
    RAISE NOTICE '384: Wirkprobe bestanden - eine Zeile vom Typ memory_supersede wird angenommen.';
  END IF;
END $$;
