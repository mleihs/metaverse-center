-- ============================================================================
-- Migration 269: search_path-Pins für die vier SECDEF-Funktionen aus 260–263
-- ============================================================================
-- Deep-Audit 2026-07-12, P3: Die Funktionen der Migrationen 260–263 wurden
-- ohne `SET search_path = public` angelegt — als einzige SECDEF-Funktionen
-- der jüngeren Generationen (264–268 pinnen durchgehend). Eine SECURITY-
-- DEFINER-Funktion ohne gepinnten search_path löst unqualifizierte Namen
-- über den search_path des AUFRUFERS auf: wer ein gleichnamiges Objekt in
-- einem früher durchsuchten Schema platzieren kann, führt es mit den Rechten
-- des Funktions-Owners aus (klassische SECDEF-Privilege-Escalation, vgl.
-- CVE-2018-1058-Klasse). Die Grants der vier Funktionen sind korrekt
-- (service_role-only, ADR-006) — es fehlt ausschließlich der Pin.
--
-- ALTER FUNCTION … SET search_path wirkt als proconfig-Eintrag und ist
-- idempotent; Funktionskörper und Grants bleiben unangetastet.
-- ============================================================================

ALTER FUNCTION public.fn_deploy_operative_atomic(
    UUID, UUID, UUID, TEXT, INT, UUID, UUID, UUID, TEXT, UUID,
    FLOAT, TIMESTAMPTZ, TEXT, INT, TEXT
) SET search_path = public;

ALTER FUNCTION public.fn_recall_operative(
    UUID, UUID, UUID, INT, INT
) SET search_path = public;

ALTER FUNCTION public.fn_record_dossier_evolution(
    UUID, TEXT, TEXT, TEXT, TEXT, JSONB
) SET search_path = public;

ALTER FUNCTION public.fn_advance_epoch_cycle(
    UUID, INT
) SET search_path = public;
