-- ═══════════════════════════════════════════════════════════════════════════
-- 376 · Ein Messwert, der niemanden erreicht
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Seit Migration 368 wird die Fokalisierung auf JEDEM Agentenzug gemessen. Der
-- Wert liegt seither in `chat_message_focalization` und wird von niemandem
-- gelesen ausser einer Auswertung, die ein Mensch aufruft. Die Figur selbst
-- erfaehrt nie, dass ihre letzten Zuege aus ihrem Blickwinkel herausgetreten
-- sind.
--
-- ── WAS DIESE MIGRATION TUT ────────────────────────────────────────────────
--
--   1. Eine View `agent_recent_focalization`: je Faden, Figur und Verfahren
--      die Bilanz der letzten fuenf gemessenen Zuege.
--   2. Ein Platzhalter `{focalization_note}` in der Gruppen-Anweisung, den
--      `ChatAIService._focalization_note` fuellt — leer, wenn nichts zu sagen
--      ist.
--
-- ── WARUM EINE VIEW UND KEINE SCHLEIFE IN PYTHON ───────────────────────────
--
--   „Wie oft war diese Figur zuletzt allwissend" ist eine Aggregatfrage, und
--   sie hat schon eine Heimat: `conversation_focalization` beantwortet
--   dieselbe Frage fuer den ganzen Faden (368/369, ADR-007). Eine zweite
--   Rechnung in Python waere eine zweite Wahrheit — und sie waere teurer:
--   die Bilanz JE SPRECHER aus Python zu holen hiesse eine Rundreise je
--   Agent, und `backend/tests/unit/test_chat_round_trips.py` sagt zu, dass je
--   Agent GENAU EINE anfaellt (der Erinnerungsabruf). Diese View wird EINMAL
--   im Vorlauf gelesen, fuer alle Sprecher zugleich.
--
--   Das Fenster von FUENF Zuegen steht hier und nur hier. Eine Zahl, die in
--   SQL und in Python steht, driftet.
--
-- ── WARUM DAS VORHER SCHAEDLICH GEWESEN WAERE ──────────────────────────────
--
--   Bis zum 05.09.2026 las der Detektor die woertliche Rede mit und bestrafte
--   eine Figur dafuer, ihr Gegenueber beim Namen anzusprechen. Haette man
--   diesen Wert damals zurueckgespielt, haette man dem Modell beigebracht, im
--   Gruppengespraech keine Namen mehr zu benutzen — also genau das Verhalten
--   abtrainiert, das ein Gruppengespraech ausmacht.
--
--   Der Schnitt kennt seit heute alle neun Anfuehrungszeichen-Kombinationen,
--   beide Guillemet-Richtungen, Rede ueber einen Zeilenumbruch und das Zitat
--   im Zitat. Erst damit ist das Zurueckspielen gefahrlos.
--
-- ── WARUM NICHT SPERREN UND NICHT NEU ERZEUGEN ─────────────────────────────
--
--   Eine Antwort zu verwerfen und neu zu erzeugen kostet etwa 15 % mehr
--   Modellaufrufe und macht aus einem Messgeraet ein Tor: beim ersten
--   Fehlurteil ein Ausfall statt einer falschen Zahl (368). Die Figur bekommt
--   deshalb einen Satz, keine Sperre.
--
--   Und den nur, wenn wirklich etwas dasteht. Ein Satz, der immer dasteht,
--   wird Tapete — dieselbe Regel wie bei `{addressed_note}` (372).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Die Bilanz der letzten fuenf Zuege, je Figur ────────────────────────
--
-- `security_invoker`: die View soll mit den Rechten des Fragenden lesen, nicht
-- mit denen ihres Eigentuemers. Sonst umginge sie die Richtlinie auf
-- `chat_message_focalization`, die den Befund an den Besitzer des Fadens
-- bindet (368).
CREATE OR REPLACE VIEW public.agent_recent_focalization
WITH (security_invoker = true) AS
WITH nummeriert AS (
  SELECT m.conversation_id,
         m.agent_id,
         f.method,
         f.verdict,
         -- Nach REIHENFOLGE schneiden, nicht nach Zeitstempel. Ein Filter
         -- gegen die Datenbankuhr hat am 05.09.2026 einmal alles weggeschnitten,
         -- weil die Uhr auf dem Vortag stand.
         row_number() OVER (
           PARTITION BY m.conversation_id, m.agent_id, f.method
           ORDER BY m.created_at DESC, m.id DESC
         ) AS rang
  FROM chat_message_focalization f
  JOIN chat_messages m ON m.id = f.message_id
  WHERE m.agent_id IS NOT NULL
)
SELECT conversation_id,
       agent_id,
       method,
       count(*)                                     AS gemessen,
       count(*) FILTER (WHERE verdict = 'zero')     AS allwissend,
       count(*) FILTER (WHERE verdict = 'internal') AS im_horizont,
       count(*) FILTER (WHERE verdict = 'unclear')  AS unklar
FROM nummeriert
WHERE rang <= 5
GROUP BY conversation_id, agent_id, method;

COMMENT ON VIEW public.agent_recent_focalization IS
  'Die Bilanz der letzten fuenf gemessenen Zuege JE FIGUR und Verfahren. Gelesen im Vorlauf eines Gruppenzugs, einmal fuer alle Sprecher — je Agent darf genau eine Rundreise anfallen. Das Fenster steht hier und nur hier; eine Zahl, die auch in Python stuende, driftet. Siehe Migration 376.';

REVOKE ALL ON public.agent_recent_focalization FROM anon;
GRANT SELECT ON public.agent_recent_focalization TO authenticated;

-- ── 2. Der Platzhalter in der Gruppen-Anweisung ────────────────────────────
--
-- Er steht ZULETZT, unmittelbar vor der Schlusszeile. Das Letzte vor der
-- Antwort gewinnt (367/371/372) — und dieser Satz ist der seltenste von allen:
-- er erscheint nur, wenn die Messung wirklich etwas gefunden hat. Was selten
-- dasteht, gehoert an die staerkste Stelle.
--
-- `{addressed_note}` bleibt damit trotzdem innerhalb der letzten 120 Zeichen,
-- die 372 prueft, und `{agent_name}` innerhalb der letzten 60 aus 371.
UPDATE prompt_templates
SET prompt_content = replace(
      prompt_content,
      'Antworte jetzt als {agent_name}.',
      '{focalization_note}

Antworte jetzt als {agent_name}.'),
    variables = '["agent_name", "other_agent_names", "addressed_note", "focalization_note"]'::jsonb,
    updated_at = NOW()
WHERE simulation_id IS NULL
  AND template_type = 'chat_group_instruction'
  AND locale = 'de'
  AND prompt_content NOT LIKE '%{focalization_note}%';

UPDATE prompt_templates
SET prompt_content = replace(
      prompt_content,
      'Answer now as {agent_name}.',
      '{focalization_note}

Answer now as {agent_name}.'),
    variables = '["agent_name", "other_agent_names", "addressed_note", "focalization_note"]'::jsonb,
    updated_at = NOW()
WHERE simulation_id IS NULL
  AND template_type = 'chat_group_instruction'
  AND locale = 'en'
  AND prompt_content NOT LIKE '%{focalization_note}%';

-- ── Selbstpruefung ─────────────────────────────────────────────────────────
--
-- Gegen die eigene WIRKUNG, nicht gegen den Inhalt der Plattform. Alles
-- unten besteht auch auf einer leeren Datenbank — bis auf die Vorlagen, und
-- fuer die gilt: sie sind Teil des Schemas (Migration 371 legt sie an), also
-- ist ihr Fehlen ein Fehler und kein leerer Bestand.
DO $$
DECLARE
  v_view     int;
  v_anon     int;
  v_invoker  boolean;
  v_platform int;
  v_hat      int;
  v_stellung int;
  v_371      int;
  v_372      int;
  v_vars     int;
BEGIN
  SELECT count(*) INTO v_view FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'agent_recent_focalization';
  IF v_view <> 7 THEN
    RAISE EXCEPTION '376: die View hat % Spalten statt 7', v_view;
  END IF;

  SELECT 'security_invoker=true' = ANY(c.reloptions) INTO v_invoker
  FROM pg_class c WHERE c.oid = 'public.agent_recent_focalization'::regclass;
  IF NOT COALESCE(v_invoker, false) THEN
    RAISE EXCEPTION '376: die View liest mit den Rechten ihres Eigentuemers — sie umginge die Richtlinie aus 368';
  END IF;

  SELECT count(*) INTO v_anon FROM information_schema.role_table_grants
  WHERE table_name = 'agent_recent_focalization' AND grantee = 'anon';
  IF v_anon > 0 THEN
    RAISE EXCEPTION '376: anon haelt % Recht(e) auf die Bilanz', v_anon;
  END IF;

  SELECT count(*) INTO v_platform FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction';
  IF v_platform = 0 THEN
    RAISE EXCEPTION '376: keine Plattform-Vorlage fuer chat_group_instruction — 371 muss vorher gelaufen sein';
  END IF;

  SELECT count(*) INTO v_hat FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND prompt_content LIKE '%{focalization_note}%';
  IF v_hat <> v_platform THEN
    RAISE EXCEPTION '376: nur % von % Vorlagen tragen den Platzhalter', v_hat, v_platform;
  END IF;

  -- Er steht NACH der Lage-Ansage und VOR der Schlusszeile.
  SELECT count(*) INTO v_stellung FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND strpos(prompt_content, '{addressed_note}') > 0
    AND strpos(prompt_content, '{addressed_note}') < strpos(prompt_content, '{focalization_note}')
    AND right(btrim(prompt_content), 80) LIKE '%{focalization_note}%';
  IF v_stellung <> v_platform THEN
    RAISE EXCEPTION '376: in % von % Vorlagen steht der Platzhalter nicht zwischen Lage-Ansage und Schlusszeile', v_platform - v_stellung, v_platform;
  END IF;

  -- Die Zusagen aus 371 und 372 stehen noch. Eine Reparatur, die eine
  -- fruehere zuruecknimmt, ist keine — und diese hier schiebt genau an der
  -- Stelle etwas ein, an der beide ihre Zusage messen.
  SELECT count(*) INTO v_371 FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND strpos(prompt_content, '{agent_name}') < strpos(prompt_content, '{other_agent_names}')
    AND right(btrim(prompt_content), 60) LIKE '%{agent_name}%';
  IF v_371 <> v_platform THEN
    RAISE EXCEPTION '376: % Vorlage(n) haben den Namensanker aus 371 verloren', v_platform - v_371;
  END IF;

  SELECT count(*) INTO v_372 FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND right(btrim(prompt_content), 120) LIKE '%{addressed_note}%';
  IF v_372 <> v_platform THEN
    RAISE EXCEPTION '376: % Vorlage(n) haben die Lage-Ansage aus 372 aus den letzten 120 Zeichen verloren', v_platform - v_372;
  END IF;

  -- Der Platzhalter steht im Text UND in der Variablenliste. Stuende er nur
  -- im Text, waere die Vorlage still inkonsistent — der Vertragspruefer liest
  -- die Liste.
  SELECT count(*) INTO v_vars FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND variables @> '["focalization_note"]'::jsonb
    AND variables @> '["addressed_note"]'::jsonb
    AND variables @> '["agent_name"]'::jsonb
    AND variables @> '["other_agent_names"]'::jsonb;
  IF v_vars <> v_platform THEN
    RAISE EXCEPTION '376: % von % Vorlagen fuehren focalization_note nicht in variables', v_platform - v_vars, v_platform;
  END IF;

  RAISE NOTICE '376: Bilanz-View (7 Spalten, invoker, anon ohne Recht) und % Vorlage(n) mit dem Platzhalter; 371 und 372 stehen.', v_platform;
END $$;
