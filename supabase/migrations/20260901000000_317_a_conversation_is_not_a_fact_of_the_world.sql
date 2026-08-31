-- ============================================================================
-- 317 · Ein Gespräch ist keine Tatsache der Welt
-- ============================================================================
--
-- BEFUND (gemessen am 31.08.2026 auf Prod, T9)
--
-- Vier Tabellen der Chat-Familie tragen je eine `{anon}`-Richtlinie, die alles
-- freigibt, was zu einer aktiven Welt gehört — unabhängig davon, WER das
-- Gespräch geführt hat:
--
--     chat_conversations         conversations_anon_select
--     chat_messages              messages_anon_select
--     chat_conversation_agents   chat_conv_agents_anon_select
--     chat_event_references      chat_event_refs_anon_select
--
-- Gemessen mit `SET LOCAL ROLE anon`:
--
--     chat_conversations   anon sieht  3 von  3
--     chat_messages        anon sieht 22 von 22
--
-- Es sind also nicht die Titel, es sind die TEXTE. Jede Zeile, die ein Mensch
-- je einem Agenten geschrieben hat, war öffentlich lesbar.
--
-- 🔑 UND DANEBEN STEHT AUF JEDER DER VIER TABELLEN DIE GEGENRICHTLINIE. Jede
-- trägt zusätzlich eine `{}`-SELECT-Richtlinie, die an `auth.uid()` gebunden
-- ist (`user_id = auth.uid()` bzw. derselbe Test über die Konversation). Das
-- Ergebnis: **ein angemeldeter Nutzer sah WENIGER als ein anonymer** —
-- gemessen 0 gegen 3. Zwei Richtlinien auf derselben Tabelle, die einander
-- widersprechen; die anonyme gewinnt, weil Richtlinien mit ODER verknüpft
-- werden.
--
-- Beides kann nicht stimmen. Entweder ist die Tabelle absichtlich öffentlich —
-- dann ist die eigentümergebundene Richtlinie irreführend —, oder sie ist
-- versehentlich offen. Der Nutzer hat entschieden: **nicht öffentlich.**
--
-- WAS DIESE MIGRATION TUT
--
-- Sie entfernt die vier anonymen Leserichtlinien. Was bleibt, ist auf jeder
-- Tabelle genau die Richtlinie, die schon dort steht und die die Anwendung
-- tatsächlich braucht.
--
-- WARUM DAS NICHTS BRICHT — gemessen, nicht angenommen
--
-- 1. **Kein öffentlicher Endpunkt liest Chat.** Weder `routers/public.py` noch
--    `public_service.py` nennen `chat_conversations` oder `chat_messages`.
-- 2. **Jeder Chat-Endpunkt ist doppelt verriegelt.** Alle 12 Routen in
--    `routers/chat.py` verlangen `Depends(get_current_user)` UND
--    `require_role(...)`; sie lesen über `get_effective_supabase`, laufen also
--    mit dem Nutzer-JWT (bzw. bei Plattform-Admins mit service_role). Ein
--    anonymer Weg zu diesen Daten existiert in der Anwendung überhaupt nicht.
-- 3. **Das Frontend greift nicht direkt zu.** Kein Treffer für
--    `chat_conversations`/`chat_messages` in `frontend/src`.
-- 4. Die Sicht `conversation_summaries`, die dieselben Daten an der RLS vorbei
--    zeigte, ist seit Migration 316 nicht mehr anon/authenticated-lesbar.
--
-- Die vier Richtlinien haben also keinen Verbraucher. Sie waren reine Fläche.
--
-- WAS SIE AUSDRÜCKLICH NICHT TUT
--
-- `epoch_chat_messages` bleibt unangetastet. Ihre Richtlinie
-- `epoch_chat_select_anon` gibt Kanäle mit `channel_type = 'epoch'` frei — das
-- ist Kommunikation zwischen Spielenden IM Spiel und eine eigene Frage, keine
-- Nebenwirkung dieser. Wer sie stellen will, stellt sie einzeln.
--
-- RÜCKNAHME: die vier Richtlinien stehen im Kopf jeder Sperre wörtlich als
-- `CREATE POLICY` (siehe Kommentar am Ende). Ein Zurückholen ist eine Migration
-- von vier Anweisungen.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS conversations_anon_select        ON public.chat_conversations;
DROP POLICY IF EXISTS messages_anon_select             ON public.chat_messages;
DROP POLICY IF EXISTS chat_conv_agents_anon_select     ON public.chat_conversation_agents;
DROP POLICY IF EXISTS chat_event_refs_anon_select      ON public.chat_event_references;

COMMENT ON TABLE public.chat_conversations IS
  'Gespräche zwischen einem Menschen und Agenten. Seit Migration 317 NICHT mehr '
  'anonym lesbar: ein Gespräch ist eine Handlung des Menschen, keine Tatsache der '
  'Welt. Lesbar ist es für seinen Eigentümer (chat_conversations_select, auth.uid()) '
  'und über den service_role-Client des Backends. Public-First gilt für die WELT — '
  'Agenten, Bauten, Ereignisse, Zonen bleiben unverändert öffentlich.';

-- ── Abnahme ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_offen      text;
  v_eigentuemer int;
  v_gespraeche int;
  v_nachrichten int;
BEGIN
  -- 1. Keine anonyme Leserichtlinie mehr auf den vier Tabellen.
  SELECT string_agg(c.relname || '.' || p.polname, ', ')
    INTO v_offen
    FROM pg_class c
    JOIN pg_policy p ON p.polrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
   WHERE c.relname IN ('chat_conversations', 'chat_messages',
                       'chat_conversation_agents', 'chat_event_references')
     AND 'anon' = ANY (SELECT rolname FROM pg_roles WHERE oid = ANY (p.polroles));

  IF v_offen IS NOT NULL THEN
    RAISE EXCEPTION 'Es steht noch eine anonyme Richtlinie: %', v_offen;
  END IF;

  -- 2. Gegenprobe: die eigentümergebundenen SELECT-Richtlinien MÜSSEN stehen
  --    bleiben. Ein DROP zu viel hätte die Prüfung oben ebenfalls bestanden —
  --    und der Chat wäre für seinen eigenen Nutzer leer.
  SELECT count(*)
    INTO v_eigentuemer
    FROM pg_class c
    JOIN pg_policy p ON p.polrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
   WHERE c.relname IN ('chat_conversations', 'chat_messages',
                       'chat_conversation_agents', 'chat_event_references')
     AND p.polcmd = 'r'
     AND pg_get_expr(p.polqual, p.polrelid) LIKE '%auth.uid()%';

  IF v_eigentuemer <> 4 THEN
    RAISE EXCEPTION
      'Erwartet 4 eigentümergebundene SELECT-Richtlinien, gefunden % — der Chat wäre für seinen Nutzer leer',
      v_eigentuemer;
  END IF;

  -- 3. Zweite Gegenprobe: es MUSS etwas da sein, das man verbergen kann. Auf
  --    leeren Tabellen bestünde jede Sperre.
  SELECT count(*) INTO v_gespraeche  FROM chat_conversations;
  SELECT count(*) INTO v_nachrichten FROM chat_messages;

  IF v_gespraeche = 0 OR v_nachrichten = 0 THEN
    RAISE EXCEPTION
      'Nichts zu verbergen (% Gespräche, % Nachrichten) — die Messung wäre leer bestanden',
      v_gespraeche, v_nachrichten;
  END IF;

  RAISE NOTICE
    '317 ok — vier anonyme Richtlinien entfernt, 4 eigentümergebundene stehen, % Gespräche / % Nachrichten sind jetzt privat',
    v_gespraeche, v_nachrichten;
END $$;

-- Rücknahme, falls die Entscheidung gedreht wird (wörtlich der Stand vor 317):
--
--   CREATE POLICY conversations_anon_select ON public.chat_conversations
--     FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM simulations
--       WHERE simulations.id = chat_conversations.simulation_id
--         AND simulations.status = 'active' AND simulations.deleted_at IS NULL));
--
--   CREATE POLICY messages_anon_select ON public.chat_messages
--     FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM chat_conversations c
--       JOIN simulations s ON s.id = c.simulation_id
--       WHERE c.id = chat_messages.conversation_id
--         AND s.status = 'active' AND s.deleted_at IS NULL));
--
--   CREATE POLICY chat_conv_agents_anon_select ON public.chat_conversation_agents
--     FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM chat_conversations c
--       JOIN simulations s ON s.id = c.simulation_id
--       WHERE c.id = chat_conversation_agents.conversation_id
--         AND s.status = 'active' AND s.deleted_at IS NULL));
--
--   CREATE POLICY chat_event_refs_anon_select ON public.chat_event_references
--     FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM chat_conversations c
--       JOIN simulations s ON s.id = c.simulation_id
--       WHERE c.id = chat_event_references.conversation_id
--         AND s.status = 'active' AND s.deleted_at IS NULL));

COMMIT;
