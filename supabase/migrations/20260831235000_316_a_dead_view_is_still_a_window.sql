-- ============================================================================
-- 316 · Eine tote Sicht ist trotzdem ein Fenster
-- ============================================================================
--
-- BEFUND (gemessen am 31.08.2026 auf Prod, im Anschluss an Migration 313)
--
-- `conversation_summaries` ist eine Sicht über `chat_conversations` JOIN
-- `agents`. Sie hat **keinen einzigen Verwender**: weder `backend/`, noch
-- `frontend/src/`, noch eine RPC. Der einzige Treffer im Repo ist die Liste
-- öffentlicher Sichten in `test_admin_views_not_public.py`.
--
-- Sie läuft ohne `security_invoker` als ihr Eigentümer (`postgres`) und trägt
-- SELECT für `anon` und `authenticated`. Die RLS von `chat_conversations`
-- greift damit nicht. Gemessen, für ein und dieselben drei Zeilen:
--
--     Weg                                          anon   authenticated
--     chat_conversations  (Basistabelle, RLS)         3         0
--     conversation_summaries (Sicht)                  3         3
--
-- Die Null ist die Aussage. `chat_conversations_select` lautet
-- `user_id = (SELECT auth.uid())` — ein angemeldeter Nutzer darf NUR seine
-- eigenen Gespräche sehen. Über die Sicht sieht er ALLE, mit `user_id`,
-- `title`, `message_count` und `last_message_at`.
--
-- Die Drei bei `anon` ist dagegen kein Befund dieser Migration: die Richtlinie
-- `conversations_anon_select` öffnet Gespräche aktiver Welten ausdrücklich für
-- anonyme Leser (Public-First). Ob Gesprächstitel und `user_id` öffentlich
-- gehören, ist eine Produktentscheidung — sie steht als eigener Punkt im TODO
-- und wird hier NICHT vorweggenommen. Diese Migration schliesst nur, was
-- niemand entschieden hat: dass die Sicht mehr hergibt als die Richtlinie.
--
-- 🔑 ZUM ZWEITEN MAL DERSELBE HALBE SATZ. Migration 294 hat elf Sichten
-- geprüft, drei geschlossen und acht mit der Begründung stehen lassen: „their
-- base tables grant `anon` the same access by policy." Der Satz trägt für
-- `anon`. Für `authenticated` trägt er hier nicht, so wie er in 313 für die
-- Elternwelt nicht trug. Eine Begründung, die für die halbe Bedingung stimmt,
-- sieht aus wie eine, die stimmt.
--
-- WAS DIESE MIGRATION TUT
--
-- Wortgleich das, was 294 für ihre drei getan hat: den Grant entziehen UND
-- `security_invoker` setzen. Das erste ist die Wirkung, das zweite die Tiefe
-- für den Tag, an dem jemand den Grant zurückgibt — dann greift wenigstens die
-- RLS.
--
-- WARUM NICHT LÖSCHEN. Naheliegend bei null Verwendern, aber `DROP VIEW` ist
-- eine Entscheidung über den Bestand, und die Sicht steht seit
-- `20260215000011_views.sql` (aufgefrischt in 111). Entzug ist rücknehmbar,
-- Löschen nicht. Wenn sie in einem Jahr weiterhin niemand liest, ist das ein
-- eigener, dann sehr leichter Schritt.
--
-- WARUM `service_role` UNANGETASTET BLEIBT: das Backend läge sonst trocken,
-- falls die Sicht doch einmal gebraucht wird — und 294 hat es genauso gehalten
-- (ihr Test prüft ausdrücklich, dass `service_role` nichts verliert).
-- ============================================================================

BEGIN;

REVOKE SELECT ON public.conversation_summaries FROM anon, authenticated;

ALTER VIEW public.conversation_summaries SET (security_invoker = on);

COMMENT ON VIEW public.conversation_summaries IS
  'Gesprächsübersicht (chat_conversations JOIN agents). Seit Migration 316 NICHT '
  'mehr für anon/authenticated lesbar und mit security_invoker: über die Sicht sah '
  'ein angemeldeter Nutzer alle fremden Gespräche samt user_id, obwohl '
  'chat_conversations_select ihm nur die eigenen erlaubt. Null Verwender im Code — '
  'wer sie wieder braucht, gibt den Grant bewusst zurück und trifft dann auf die RLS.';

-- ── Abnahme ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_anon      boolean;
  v_auth      boolean;
  v_service   boolean;
  v_invoker   boolean;
BEGIN
  SELECT has_table_privilege('anon',          'public.conversation_summaries', 'SELECT'),
         has_table_privilege('authenticated', 'public.conversation_summaries', 'SELECT'),
         has_table_privilege('service_role',  'public.conversation_summaries', 'SELECT')
    INTO v_anon, v_auth, v_service;

  SELECT EXISTS (
    SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'conversation_summaries'
       AND c.reloptions @> ARRAY['security_invoker=on']
  ) INTO v_invoker;

  IF v_anon OR v_auth THEN
    RAISE EXCEPTION 'Der Grant steht noch: anon=%, authenticated=%', v_anon, v_auth;
  END IF;

  IF NOT v_service THEN
    RAISE EXCEPTION 'service_role hat SELECT verloren — das Backend läge trocken';
  END IF;

  IF NOT v_invoker THEN
    RAISE EXCEPTION 'security_invoker steht nicht — die Tiefe fehlt';
  END IF;

  -- Gegenprobe: die Sicht muss weiterhin AUFLÖSBAR sein. Ein `ALTER VIEW`, das
  -- die Sicht zerschösse, bestünde die Rechteprüfung oben ebenfalls.
  PERFORM 1 FROM public.conversation_summaries LIMIT 1;

  RAISE NOTICE '316 ok — anon/authenticated entzogen, service_role behalten, security_invoker gesetzt';
END $$;

COMMIT;
