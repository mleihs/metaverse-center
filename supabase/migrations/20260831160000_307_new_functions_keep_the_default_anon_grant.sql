-- ============================================================================
-- Migration 307 — `REVOKE … FROM PUBLIC` nimmt anon das Recht nicht weg
-- ============================================================================
--
-- BEFUND, an der eigenen Arbeit desselben Tages
-- ---------------------------------------------
-- Die Migrationen 301, 303 und 306 schließen alle drei mit demselben Paar:
--
--     REVOKE ALL ON FUNCTION … FROM PUBLIC;
--     GRANT EXECUTE ON FUNCTION … TO service_role;   (bzw. authenticated)
--
-- Danach gemessen, statt geglaubt:
--
--     fn_apply_need_moodlets       anon: JA    authenticated: JA
--     fn_building_condition_step   anon: JA    authenticated: JA
--     fn_create_zone_action        anon: JA    authenticated: JA
--     fn_apply_dungeon_loot        anon: nein  authenticated: nein
--     fn_degrade_building          anon: nein  authenticated: nein
--
-- Der Unterschied liegt nicht an den Migrationen — die sind gleich gebaut. Er
-- liegt daran, dass die letzten beiden Funktionen **schon existierten** und mit
-- `CREATE OR REPLACE` nur ihren Körper getauscht haben; eine Ersetzung behält
-- die vorhandene Rechteliste. Die ersten drei wurden NEU angelegt, und dabei
-- greifen die Supabase-Standardrechte aus `pg_default_acl`, die `anon` und
-- `authenticated` EXECUTE **direkt** zuteilen — nicht über PUBLIC.
--
-- 🔑 **`REVOKE … FROM PUBLIC` entfernt keine direkte Zuteilung.** Es nimmt der
-- Gruppe PUBLIC etwas weg, das anon gar nicht von dort hat. Der Widerruf muss
-- die Rollen NAMENTLICH nennen. Genau das steht in CLAUDE.md („`ALTER DEFAULT
-- PRIVILEGES … REVOKE EXECUTE … FROM PUBLIC` schließt das auf Supabase NICHT")
-- — ich habe es gelesen und beim Schreiben trotzdem das Muster genommen, das
-- danach aussieht, als täte es das.
--
-- WIE SCHLIMM ES IST
-- ------------------
-- Nicht ausnutzbar, und das ist gemessen, nicht gehofft. Alle drei Funktionen
-- sind SECURITY INVOKER: ein anonymer Aufruf läuft als `anon`, und die RLS
-- gilt. Auf `agent_moodlets` stehen zwei Richtlinien —
-- `moodlets_public_read` (SELECT, USING true) und `moodlets_service_write`
-- (ALL, USING `auth.role() = 'service_role'`). Ein anonymes DELETE trifft null
-- Zeilen, ein anonymes INSERT wird abgewiesen. `zone_actions` verlangt für
-- INSERT ebenfalls `auth.role() = 'authenticated'`.
--
-- Es ist also die zweite Verteidigungslinie, die hält. Genau deshalb gehört die
-- erste trotzdem geschlossen: „die RLS fängt es" ist eine Begründung dafür,
-- warum heute nichts passiert, keine dafür, warum das Recht dasteht.
--
-- (Beim Messen der Richtlinien absichtlich ohne Filter auf `polcmd` gefragt:
-- `moodlets_service_write` ist eine ALL-Richtlinie und trägt `*`. Eine Abfrage
-- nach `polcmd = 'r'` hätte sie nicht gesehen — J3c, dieselbe Falle, die im
-- Prüfbericht schon zweimal steht.)
--
-- WAS HIER NICHT ANGEFASST WIRD
-- -----------------------------
-- `fn_compute_agent_influence` ist ebenfalls für anon ausführbar, war es aber
-- schon vor Migration 304 — sie liest ausschließlich und liefert eine Zahl
-- über öffentlich sichtbare Daten. Das ist Public-First und bleibt.
-- ============================================================================

-- Der Widerruf nennt die Rollen namentlich. FROM PUBLIC bliebe wirkungslos.
REVOKE EXECUTE ON FUNCTION fn_apply_need_moodlets(uuid, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_building_condition_step(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION fn_create_zone_action(uuid, uuid, text, uuid, numeric, integer, integer) FROM anon;

-- ── Abnahme ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_offen text[];
BEGIN
  -- Der Zeitgeber-Aufruf darf NUR service_role gehören.
  IF has_function_privilege('anon', 'fn_apply_need_moodlets(uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'fn_apply_need_moodlets(uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 307: fn_apply_need_moodlets ist weiterhin fuer anon oder authenticated ausfuehrbar';
  END IF;
  IF NOT has_function_privilege('service_role', 'fn_apply_need_moodlets(uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 307: service_role darf fn_apply_need_moodlets nicht mehr ausfuehren';
  END IF;

  -- Die beiden anderen behalten authenticated (die Zonenmassnahme braucht es,
  -- die Leiter ist eine reine Funktion) und verlieren nur anon.
  SELECT array_agg(x.n) INTO v_offen FROM (
    SELECT 'fn_building_condition_step' AS n
     WHERE has_function_privilege('anon', 'fn_building_condition_step(text,integer)', 'EXECUTE')
    UNION ALL
    SELECT 'fn_create_zone_action'
     WHERE has_function_privilege('anon', 'fn_create_zone_action(uuid,uuid,text,uuid,numeric,integer,integer)', 'EXECUTE')
  ) x;
  IF v_offen IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 307: anon darf weiterhin ausfuehren: %', v_offen;
  END IF;

  IF NOT has_function_privilege('authenticated', 'fn_create_zone_action(uuid,uuid,text,uuid,numeric,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 307: authenticated braucht fn_create_zone_action — der Router ruft sie unter dem Nutzer-JWT';
  END IF;
END;
$$;
