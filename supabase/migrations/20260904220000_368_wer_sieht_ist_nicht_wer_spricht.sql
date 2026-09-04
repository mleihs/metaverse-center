-- ═══════════════════════════════════════════════════════════════════════════
-- 368 · Wer sieht, ist nicht wer spricht
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Ein Messgerät für den Fehler, den wir den ganzen 04.09.2026 lang von Hand
-- gesucht haben.
--
-- ── DER BEGRIFF, und er ist nicht neu ──────────────────────────────────────
--
--   Genette trennt in der Erzähltheorie zwei Fragen, die man leicht
--   verwechselt: WER SIEHT und WER SPRICHT. Die Antwort auf die erste heißt
--   Fokalisierung:
--
--     intern    Die Erzählung bleibt im Wahrnehmungshorizont EINER Figur.
--               „Ich sehe sie zögern."
--     null      Der Erzähler weiß mehr als jede Figur — Allwissenheit.
--               „Die drei Frauen verharren, jede aus einem anderen Grund."
--     extern    Der Erzähler weiß weniger: reine Beobachtung von aussen.
--
--   UNSER FEHLER IST GENAU DER SPRUNG VON INTERN AUF NULL. Eine Figur hört
--   auf, eine Person zu sein, und wird zum Autor des Abschnitts. Das ist keine
--   Marotte des Modells, sondern eine benannte, seit 1972 beschriebene
--   Erzählhaltung — und deshalb messbar.
--
--   Belegt: „Says Who? Effective Zero-Shot Annotation of Focalization"
--   (arXiv:2409.11390, CHR 2025) klassifiziert Fokalisierung zero-shot mit
--   F1 84,8 % — etwa auf dem Niveau geschulter Menschen. Angewandt wurde das
--   bisher auf Literatur, nie als Regressionstor auf Agentenausgaben.
--
-- ── WAS HIER IN DIE DATENBANK GEHÖRT UND WAS NICHT ─────────────────────────
--
--   IN die Datenbank: der BEFUND je Nachricht und jede Auswertung darüber.
--   „Wie allwissend ist dieser Faden" ist eine Aggregatfrage, und die
--   beantwortet SQL, nicht eine Schleife in Python (ADR-007). Deshalb liegt
--   die Quote in einer VIEW und nicht in einem Dienst.
--
--   NICHT in die Datenbank: die Klassifikation selbst. Sie ist Textanalyse
--   und, in der zweiten Stufe, ein Modellaufruf — dafür gibt es kein
--   SQL-Gegenstück. Dieselbe Grenze wie bei `ForgeMapService` und shapely.
--
-- ── ZWEI STUFEN, UND DIE ERSTE KOSTET NICHTS ───────────────────────────────
--
--   `heuristic`  Deterministisch, ohne Netz, auf JEDEM Zug. Sie fragt nicht
--                „ist das gute Prosa", sondern zwei sehr enge Dinge:
--                  · nennt der Text ein KOLLEKTIV aller Beteiligten
--                    („die drei Frauen")?
--                  · schreibt er einem ANDEREN ein Inneres zu
--                    („Elena spürt", „Mira weiß")?
--                Beides ist Allwissenheit im Wortsinn: eine Figur kann das
--                nicht wahrnehmen. Alle drei Züge vom 04.09. fallen darunter.
--
--   `model`      Der Referenzmaßstab. Teuer, deshalb hinter einem eigenen
--                Riegel und nur auf Stichproben — sein Zweck ist, die
--                Heuristik zu EICHEN, nicht sie zu ersetzen. Ohne ihn wüsste
--                niemand, wie oft die billige Stufe irrt.
--
--   Die Spalte `method` trennt beide, damit eine Auswertung nie Äpfel und
--   Birnen zählt und die Eichung überhaupt möglich ist: dieselbe Nachricht
--   darf je Verfahren eine Zeile haben.
--
-- ── DAS MESSGERÄT ÄNDERT NICHTS ────────────────────────────────────────────
--
--   Es blockiert keine Antwort und schreibt keinen Text um. Ein Tor, das in
--   den Anfragepfad eingreift, wäre beim ersten Fehlurteil ein Ausfall; ein
--   Tor, das misst, ist beim ersten Fehlurteil eine falsche Zahl. Der zweite
--   Fehler ist der billigere und der sichtbarere.

CREATE TABLE IF NOT EXISTS public.chat_message_focalization (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id  uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,

    -- Genettes drei Werte, plus das ehrliche vierte.
    --
    -- `unclear` ist kein Ausweichen, sondern eine Aussage: die Heuristik hat
    -- keinen Anhalt gefunden. Ohne diesen Wert müsste sie zwischen „intern"
    -- und „null" raten, und eine Messung, die rät, ist schlimmer als eine,
    -- die zugibt, nichts zu sehen.
    verdict     text NOT NULL CHECK (verdict IN ('internal', 'zero', 'external', 'unclear')),

    -- Welches Verfahren geurteilt hat. NICHT zusammenzählen.
    method      text NOT NULL CHECK (method IN ('heuristic', 'model')),

    -- WORAN es lag. Ein Urteil ohne Beleg ist eine Behauptung, und beim
    -- Nachsehen in einem halben Jahr ist der Beleg das Einzige, was zählt.
    evidence    jsonb NOT NULL DEFAULT '{}',

    -- Wer im Text als Handelnder vorkam, ausser dem Sprecher selbst.
    others_named text[] NOT NULL DEFAULT '{}',

    model       text,
    measured_at timestamptz NOT NULL DEFAULT now(),

    -- Je Nachricht und Verfahren genau ein Urteil. Ein zweiter Lauf desselben
    -- Verfahrens ueberschreibt (upsert) statt zu haeufen — sonst zaehlte jede
    -- Auswertung dieselbe Nachricht mehrfach.
    CONSTRAINT chat_message_focalization_once UNIQUE (message_id, method)
);

COMMENT ON TABLE public.chat_message_focalization IS
  'Fokalisierung je Agentenzug (Genette): intern = im Horizont EINER Figur, null = allwissend. Der Sprung von intern auf null ist der Fehler, den diese Tabelle misst. Siehe Migration 368.';

CREATE INDEX IF NOT EXISTS idx_focalization_message ON chat_message_focalization (message_id);
-- Fuer die Frage „was ist noch ungemessen": nach Verfahren und Zeit.
CREATE INDEX IF NOT EXISTS idx_focalization_method_time
  ON chat_message_focalization (method, measured_at DESC);

-- ── Die Auswertung gehört in SQL ───────────────────────────────────────────
--
-- „Wie allwissend ist dieser Faden" ist eine Aggregatfrage. Sie hier zu
-- beantworten heisst: eine Abfrage statt eines Dienstes, und dieselbe Zahl
-- fuer die Verwaltungsoberflaeche, fuer einen Test und fuer einen Menschen mit
-- psql. Ein Dienst, der sie in Python zusammenzaehlt, waere eine zweite
-- Wahrheit.
CREATE OR REPLACE VIEW public.conversation_focalization AS
SELECT c.id                                    AS conversation_id,
       c.simulation_id,
       f.method,
       count(*)                                AS gemessen,
       count(*) FILTER (WHERE f.verdict = 'zero')     AS allwissend,
       count(*) FILTER (WHERE f.verdict = 'internal') AS im_horizont,
       count(*) FILTER (WHERE f.verdict = 'unclear')  AS unklar,
       -- Die Quote NUR ueber die entschiedenen Faelle. Unklare mitzuzaehlen
       -- verduennte sie: ein Verfahren, das oft nichts erkennt, saehe damit
       -- besser aus als eines, das genau hinsieht.
       round(
         100.0 * count(*) FILTER (WHERE f.verdict = 'zero')
         / nullif(count(*) FILTER (WHERE f.verdict IN ('zero', 'internal', 'external')), 0),
         1
       )                                       AS allwissend_prozent,
       max(f.measured_at)                      AS zuletzt
FROM chat_message_focalization f
JOIN chat_messages m ON m.id = f.message_id
JOIN chat_conversations c ON c.id = m.conversation_id
GROUP BY c.id, c.simulation_id, f.method;

COMMENT ON VIEW public.conversation_focalization IS
  'Allwissenheitsquote je Faden und Verfahren. Die Quote zaehlt nur entschiedene Faelle — unklare mitzuzaehlen liesse ein blindes Verfahren gut aussehen.';

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Der Befund haengt an einer Nachricht und damit an einem Gespraech. Er ist
-- nicht der Inhalt, aber er verraet etwas ueber ihn — wer wie oft allwissend
-- schrieb, ist eine Aussage ueber den Faden. Also dieselbe Besitzerschaft.
ALTER TABLE public.chat_message_focalization ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_message_focalization_owner_read ON public.chat_message_focalization;
CREATE POLICY chat_message_focalization_owner_read
  ON public.chat_message_focalization
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_messages m
      JOIN chat_conversations c ON c.id = m.conversation_id
      WHERE m.id = chat_message_focalization.message_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

-- Supabase bedenkt jede neue Tabelle im Schema `public` ueber `pg_default_acl`
-- direkt mit Rechten fuer `anon` und `authenticated`; ein REVOKE FROM PUBLIC
-- entfernt sie NICHT. Erst alles wegnehmen, dann das eine Recht zurueckgeben,
-- das die Richtlinie darueber ohnehin einschraenkt.
REVOKE ALL ON public.chat_message_focalization FROM anon, authenticated;
GRANT SELECT ON public.chat_message_focalization TO authenticated;
REVOKE ALL ON public.conversation_focalization FROM anon;
GRANT SELECT ON public.conversation_focalization TO authenticated;

-- Der Riegel fuer die teure Stufe. Fail-closed: fehlt die Zeile, laeuft kein
-- Modellaufruf. Getrennt von allem anderen, weil eine Eichstichprobe eine
-- eigene Entscheidung ist.
INSERT INTO platform_settings (setting_key, setting_value, description) VALUES
  ('focalization_model_check_enabled', 'false'::jsonb, 'Ob die teure Stufe der Fokalisierungsmessung (Modellaufruf) laufen darf. Vorgabe AUS. Ihr Zweck ist das EICHEN der kostenlosen Heuristik an Stichproben, nicht ihr Ersatz.')
ON CONFLICT (setting_key) DO NOTHING;

-- ── Selbstprüfung ──────────────────────────────────────────────────────────
-- Gegen die eigene Wirkung: Tabelle, Eindeutigkeit je Verfahren, RLS, die
-- View mit ihren Spalten, kein Recht fuer anon. Kein Wort ueber den Inhalt
-- der Plattform — auf einer leeren Datenbank besteht alles davon genauso.
DO $$
DECLARE
  v_spalten int;
  v_unique  int;
  v_rls     boolean;
  v_view    int;
  v_anon    int;
  v_riegel  int;
BEGIN
  SELECT count(*) INTO v_spalten FROM information_schema.columns
  WHERE table_name = 'chat_message_focalization';
  IF v_spalten <> 8 THEN
    RAISE EXCEPTION '368: % Spalten statt 8', v_spalten;
  END IF;

  SELECT count(*) INTO v_unique FROM pg_constraint
  WHERE conname = 'chat_message_focalization_once';
  IF v_unique <> 1 THEN
    RAISE EXCEPTION '368: der Eindeutigkeitszwang je (Nachricht, Verfahren) fehlt — ohne ihn zaehlte jede Auswertung dieselbe Nachricht mehrfach';
  END IF;

  SELECT relrowsecurity INTO v_rls FROM pg_class
  WHERE oid = 'public.chat_message_focalization'::regclass;
  IF NOT v_rls THEN
    RAISE EXCEPTION '368: RLS ist nicht eingeschaltet';
  END IF;

  SELECT count(*) INTO v_view FROM information_schema.columns
  WHERE table_name = 'conversation_focalization';
  IF v_view <> 9 THEN
    RAISE EXCEPTION '368: die Auswertungs-View hat % Spalten statt 9', v_view;
  END IF;

  SELECT count(*) INTO v_anon FROM information_schema.role_table_grants
  WHERE table_name IN ('chat_message_focalization', 'conversation_focalization')
    AND grantee = 'anon';
  IF v_anon > 0 THEN
    RAISE EXCEPTION '368: anon haelt % Recht(e) auf die Messwerte', v_anon;
  END IF;

  SELECT count(*) INTO v_riegel FROM platform_settings
  WHERE setting_key = 'focalization_model_check_enabled';
  IF v_riegel <> 1 THEN
    RAISE EXCEPTION '368: der Riegel fuer die teure Stufe wurde nicht angelegt';
  END IF;

  RAISE NOTICE '368: Tabelle, Auswertungs-View, RLS, anon ohne Recht, Riegel auf aus.';
END $$;
