-- ═══════════════════════════════════════════════════════════════════════════
-- 369 · Eine Quote, die immer hundert ist, misst nichts
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Korrektur an der View aus Migration 368, gefunden beim ersten echten Lauf
-- gegen 219 Züge — also von der Messung selbst, nicht von einem Test.
--
-- ── DER FEHLER ─────────────────────────────────────────────────────────────
--
--   368 rechnet die Quote NUR über entschiedene Fälle:
--
--       zero / (zero + internal + external)
--
--   Die Begründung dafür war richtig: unklare Fälle mitzuzählen ließe ein
--   blindes Verfahren gut aussehen. Aber die erste Fassung der Heuristik gab
--   NIE `internal` zurück — sie kannte nur `zero` und `unclear`. Der Nenner
--   bestand damit allein aus den Zählerfällen, und die View meldete:
--
--       gemessen 219 · allwissend 18 · im_horizont 0 · unklar 201
--       allwissend_prozent: 100.0
--
--   Achtzehn von zweihundertneunzehn, gemeldet als hundert Prozent. Eine
--   Kennzahl, die keinen anderen Wert annehmen KANN, ist keine Kennzahl.
--
-- ── DIE ZWEI HÄLFTEN DER KORREKTUR ─────────────────────────────────────────
--
--   1. Die Heuristik gibt jetzt auch `internal` zurück (im Dienst, nicht
--      hier): erste Person, oder ausser dem Sprecher handelt niemand. Damit
--      bedeutet `unclear` endlich, was es sagt.
--
--   2. Die View meldet ZWEI Quoten, weil zwei verschiedene Fragen gestellt
--      werden und eine Zahl nicht beide beantwortet:
--
--      `unter_entschiedenen_prozent`  Wie oft irrt das Verfahren, WENN es
--                                     urteilt. Die Zahl zum EICHEN zweier
--                                     Verfahren gegeneinander.
--      `von_allen_prozent`            Wie viele Züge dieses Fadens sind
--                                     nachweislich allwissend. Die Zahl für
--                                     die Frage „wie schlimm ist es".
--
--   Nur die zweite hätte den Fehler oben sofort gezeigt: 18/219 = 8,2 %.
--
-- ── WARUM DAS HIER STEHT UND NICHT IN 368 ──────────────────────────────────
--
--   368 ist auf Produktion angewendet. Eine angewandte Migration wird nicht
--   nachträglich umgeschrieben — der Ledger sagt sonst etwas anderes als die
--   Datenbank. Die Korrektur bekommt ihre eigene Nummer, und die Geschichte
--   bleibt lesbar: erst die Zahl gebaut, dann beim ersten Lauf gemerkt, dass
--   sie nichts sagen kann.

-- DROP und CREATE, nicht CREATE OR REPLACE: Postgres weigert sich mit 42P16,
-- eine Spalte einer View umzubenennen („cannot change name of view column").
-- Und `allwissend_prozent` MUSS weg, nicht danebenstehen — ein Name, der
-- offenlässt, welche der beiden Fragen er beantwortet, ist genau der Fehler,
-- den diese Migration behebt.
DROP VIEW IF EXISTS public.conversation_focalization;

CREATE VIEW public.conversation_focalization AS
SELECT c.id                                    AS conversation_id,
       c.simulation_id,
       f.method,
       count(*)                                AS gemessen,
       count(*) FILTER (WHERE f.verdict = 'zero')     AS allwissend,
       count(*) FILTER (WHERE f.verdict = 'internal') AS im_horizont,
       count(*) FILTER (WHERE f.verdict = 'unclear')  AS unklar,

       -- Frage 1: wie oft urteilt das Verfahren auf „allwissend", WENN es
       -- urteilt? Zum Vergleich zweier Verfahren an denselben Nachrichten.
       round(
         100.0 * count(*) FILTER (WHERE f.verdict = 'zero')
         / nullif(count(*) FILTER (WHERE f.verdict IN ('zero', 'internal', 'external')), 0),
         1
       )                                       AS unter_entschiedenen_prozent,

       -- Frage 2: wie viele Züge dieses Fadens sind NACHWEISLICH allwissend?
       -- Das ist die Zahl für „wie schlimm ist es" — und die einzige, die
       -- den Fehler in 368 sofort gezeigt hätte.
       round(100.0 * count(*) FILTER (WHERE f.verdict = 'zero') / count(*), 1)
                                               AS von_allen_prozent,

       max(f.measured_at)                      AS zuletzt
FROM chat_message_focalization f
JOIN chat_messages m ON m.id = f.message_id
JOIN chat_conversations c ON c.id = m.conversation_id
GROUP BY c.id, c.simulation_id, f.method;

COMMENT ON VIEW public.conversation_focalization IS
  'Allwissenheitsquote je Faden und Verfahren, in ZWEI Lesarten: unter_entschiedenen_prozent zum Eichen zweier Verfahren gegeneinander, von_allen_prozent fuer die Frage "wie schlimm ist es". Eine Zahl beantwortet nicht beide Fragen — siehe Migration 369.';

REVOKE ALL ON public.conversation_focalization FROM anon;
GRANT SELECT ON public.conversation_focalization TO authenticated;

-- ── Selbstprüfung ──────────────────────────────────────────────────────────
-- Gegen die eigene Wirkung: hat die View jetzt beide Spalten, und hält anon
-- weiterhin kein Recht.
DO $$
DECLARE
  v_spalten int;
  v_anon    int;
BEGIN
  SELECT count(*) INTO v_spalten FROM information_schema.columns
  WHERE table_name = 'conversation_focalization'
    AND column_name IN ('unter_entschiedenen_prozent', 'von_allen_prozent');
  IF v_spalten <> 2 THEN
    RAISE EXCEPTION '369: % von 2 Quotenspalten vorhanden', v_spalten;
  END IF;

  SELECT count(*) INTO v_anon FROM information_schema.role_table_grants
  WHERE table_name = 'conversation_focalization' AND grantee = 'anon';
  IF v_anon > 0 THEN
    RAISE EXCEPTION '369: anon haelt % Recht(e) auf die Auswertung', v_anon;
  END IF;

  RAISE NOTICE '369: beide Quoten, anon ohne Recht.';
END $$;
