-- ═══════════════════════════════════════════════════════════════════════════
-- 285 — 'bond_whisper' in den entry_type-CHECK (P0)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WARUM
-- -----
-- `heartbeat_service.py:608` schreibt seit der Agent-Bonds-Arbeit Eintraege mit
-- `entry_type = 'bond_whisper'`. Der CHECK auf Produktion kennt den Wert nicht:
-- gemessen am 30.08.2026 per `pg_get_constraintdef` traegt
-- `heartbeat_entries_entry_type_check` **20** Werte, der Code emittiert **21**.
-- Migration 219 hat die TABELLE `bond_whispers` angelegt und den CHECK nie
-- angefasst.
--
-- Das kostet nicht eine Zeile, sondern den ganzen Zyklus. Alle Eintraege eines
-- Ticks gehen in EINEM Batch-Insert (`heartbeat_service.py:647`); eine
-- ungueltige Zeile → PostgrestAPIError → der Tick wird als `failed` markiert,
-- `last_heartbeat_tick` rueckt NICHT vor, und der naechste Versuch scheitert an
-- derselben Eingabe erneut. Eine Welt in diesem Zustand ist nicht
-- beeintraechtigt, sie steht.
--
-- Auf Produktion hat es noch nicht gezuendet: 1 aktive Bindung, heute angelegt,
-- 0 Fluesterungen, 0 Eintraege dieses Typs. Es zuendet beim ersten Tick, der
-- eine Fluesterung erzeugt.
--
-- DAS IST DER ZWEITE FALL DIESER ART
-- ----------------------------------
-- Migration 186 existiert aus genau demselben Grund: `resonance_mood` wurde dem
-- Code hinzugefuegt, nachdem der CHECK geschrieben war. Ihr eigener Kopf nennt
-- Sentry METAVERSE_CENTER-27, zehn Ereignisse, alle auf Tick #52. Danach wurde
-- nichts eingebaut, das den naechsten Fall verhindert — und der naechste Fall
-- ist dieser hier.
--
-- Deshalb behebt diese Migration nicht nur den Wert. Das Vokabular ist jetzt in
-- `backend/services/heartbeat_entry_builder.py` als `HEARTBEAT_ENTRY_TYPES`
-- deklariert — in dem einen Modul, das jeden Eintrag baut — und die Liste
-- unten ist DARAUS ERZEUGT, keine Zeile abgetippt.
-- `backend/tests/unit/test_heartbeat_entry_types.py` bindet drei Seiten
-- aneinander: jeder literale Typ, der an `make_heartbeat_entry` geht, muss
-- deklariert sein; die CHECK-Liste hier muss der Deklaration exakt gleichen.
-- Ein dritter Fall ist damit ein roter Test statt einer stehenden Welt.
--
-- Die zweite Haelfte ist Python: der Batch-Insert faellt bei einer ungueltigen
-- Zeile auf zeilenweises Einfuegen zurueck, damit ein unbekannter Typ kuenftig
-- eine Zeile kostet und nicht den Zyklus.
--
-- Wiederholbar: DROP + ADD derselben benannten Bedingung.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE heartbeat_entries DROP CONSTRAINT IF EXISTS heartbeat_entries_entry_type_check;

ALTER TABLE heartbeat_entries ADD CONSTRAINT heartbeat_entries_entry_type_check
  CHECK (entry_type = ANY (ARRAY[
    'zone_shift', 'event_aging', 'event_escalation',
    'event_resolution', 'scar_tissue', 'resonance_pressure',
    'resonance_mood', 'cascade_spawn', 'bureau_response',
    'attunement_deepen', 'anchor_strengthen', 'convergence',
    'positive_event', 'narrative_arc', 'system_note',
    'agent_crisis', 'relationship_shift', 'social_event',
    'autonomous_event', 'ambient_weather', 'bond_whisper'
  ]::text[]));
