-- ═══════════════════════════════════════════════════════════════════════════
-- 365 · Die Fälligkeit gehört in die Datenbank
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `ContinuationService._due_conversations` (Migration 361, heute) hat zwei
-- Dinge in Python getan, die hierher gehören:
--
--   1. DEN ZEIT-RIEGEL. Er lud JEDE Unterhaltung mit `continues_without_user`
--      und verglich dann in Python `now() - last_message_at` gegen
--      `continue_interval_hours`. Beide Werte stehen in DERSELBEN ZEILE. Eine
--      Bedingung, die zwei Spalten einer Zeile vergleicht, in der Anwendung
--      auszurechnen, heisst jede Zeile zu holen, um die meisten wegzuwerfen.
--
--   2. DIE BESETZUNGSPRÜFUNG. „Mindestens zwei Agenten" lief als eigene
--      Abfrage JE ZEILE — ein klassisches N+1. Bei zwanzig eingeschalteten
--      Fäden waren das einundzwanzig Abfragen für höchstens zwei Ergebnisse.
--
-- Beides ist ein Verstoss gegen ADR-007, und beides ist von heute. Der
-- Anlass, es zu bemerken, war die Frage des Nutzers, ob im Chat wirklich
-- alles in Postgres liegt, was dorthin gehört.
--
-- ── WARUM KEIN SECURITY DEFINER ────────────────────────────────────────────
--
--   Die Funktion liest `chat_conversations`, worauf RLS liegt. Sie wird
--   ausschliesslich vom Herzschlag über den service_role-Client gerufen, und
--   der umgeht RLS ohnehin — SECURITY INVOKER genügt also.
--
--   Das ist nicht Bequemlichkeit, sondern die engere Wahl: ein SECURITY
--   DEFINER liefe als Eigentümer, und PostgREST böte ihn unter
--   `/rest/v1/rpc/…` jedem an, dem EXECUTE zusteht. Die Rechte werden
--   deshalb ausdrücklich entzogen und nur `service_role` gegeben — auf
--   Supabase reicht ein REVOKE FROM PUBLIC nicht, weil `pg_default_acl`
--   `anon` und `authenticated` direkt bedenkt.
--
-- ── WAS BEWUSST IN PYTHON BLEIBT ───────────────────────────────────────────
--
--   Das Zusammenstellen des Prompts, das Kappen des Verlaufs nach
--   Token-Schätzung, das Auswerten der Modellantwort. Dafür gibt es kein
--   SQL-Gegenstück — dieselbe Grenze wie bei `ForgeMapService` und shapely.

CREATE OR REPLACE FUNCTION public.fn_due_continuations(
    p_simulation_id uuid,
    p_limit         int DEFAULT 2
)
RETURNS TABLE (
    id                      uuid,
    user_id                 uuid,
    locale                  text,
    continue_notify         text,
    continue_interval_hours smallint,
    last_message_at         timestamptz,
    agent_count             bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT c.id,
           c.user_id,
           c.locale,
           c.continue_notify,
           c.continue_interval_hours,
           c.last_message_at,
           count(ca.agent_id) AS agent_count
    FROM chat_conversations c
    JOIN chat_conversation_agents ca ON ca.conversation_id = c.id
    WHERE c.simulation_id = p_simulation_id
      AND c.continues_without_user
      AND NOT c.locked
      AND c.status = 'active'
      -- Ein Faden ohne eine einzige Nachricht hat nichts, woran ein
      -- Wortwechsel anknuepfen koennte.
      AND c.last_message_at IS NOT NULL
      -- Der Zeit-Riegel. Beide Werte stehen in derselben Zeile.
      AND c.last_message_at < now() - make_interval(hours => c.continue_interval_hours)
    GROUP BY c.id
    -- Ein einzelner Agent redet nicht mit sich selbst.
    HAVING count(ca.agent_id) >= 2
    -- Der am laengsten stille Faden zuerst: sonst bekaeme derselbe Faden bei
    -- knappem Budget jeden Takt den Zuschlag und die uebrigen nie.
    ORDER BY c.last_message_at
    LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.fn_due_continuations(uuid, int) IS
  'Welche Faeden dieser Welt ohne den Menschen weiterreden duerfen UND deren Mindestabstand abgelaufen ist. Zeit-Riegel und Besetzungspruefung in EINER Abfrage statt in Python (ADR-007). Nur fuer service_role.';

REVOKE ALL ON FUNCTION public.fn_due_continuations(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_due_continuations(uuid, int) TO service_role;

-- ── Selbstprüfung ──────────────────────────────────────────────────────────
-- Gegen die eigene Wirkung: existiert die Funktion, ist sie NICHT SECURITY
-- DEFINER, und halten anon/authenticated wirklich kein EXECUTE. Der letzte
-- Punkt ist der, der auf Supabase gern durchrutscht.
DO $$
DECLARE
  v_secdef boolean;
  v_offen  int;
BEGIN
  SELECT p.prosecdef INTO v_secdef FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_due_continuations';

  IF v_secdef IS NULL THEN
    RAISE EXCEPTION '365: fn_due_continuations wurde nicht angelegt';
  END IF;
  IF v_secdef THEN
    RAISE EXCEPTION '365: fn_due_continuations ist SECURITY DEFINER — PostgREST boete sie dann jedem an, dem EXECUTE zusteht';
  END IF;

  SELECT count(*) INTO v_offen
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL (VALUES ('anon'), ('authenticated')) AS r(rolle)
  WHERE n.nspname = 'public' AND p.proname = 'fn_due_continuations'
    AND has_function_privilege(r.rolle, p.oid, 'EXECUTE');
  IF v_offen > 0 THEN
    RAISE EXCEPTION '365: % Rolle(n) ausser service_role halten EXECUTE', v_offen;
  END IF;

  IF NOT has_function_privilege('service_role',
        (SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname='fn_due_continuations'), 'EXECUTE') THEN
    RAISE EXCEPTION '365: service_role haelt kein EXECUTE — der Herzschlag koennte sie nicht rufen';
  END IF;

  RAISE NOTICE '365: fn_due_continuations angelegt, SECURITY INVOKER, nur service_role.';
END $$;
