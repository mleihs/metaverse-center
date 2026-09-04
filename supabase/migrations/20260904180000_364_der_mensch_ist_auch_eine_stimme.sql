-- ═══════════════════════════════════════════════════════════════════════════
-- 364 · Der Mensch ist auch eine Stimme
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Nachtrag zu 356. Dort wurde die Vermischung der AGENTEN behoben; hier die
-- des Menschen mit ihnen. Das ist eine andere Ursache, und sie stand nach 356
-- noch offen.
--
-- ── DER BEFUND ─────────────────────────────────────────────────────────────
--
--   Ein Agent hat eine Handlung des MENSCHEN für sich übernommen: Agent A
--   schrieb sie ihm korrekt zu, Agent B nahm sie Sekunden später an sich.
--
--   Der Wortlaut steht hier nicht. Er stammt aus einem echten Gespräch, und
--   dieses Repo ist öffentlich — für den Befund reicht die Form.
--
-- ── DIE URSACHE ────────────────────────────────────────────────────────────
--
--   Sie liegt im zusammengesetzten Verlauf, nicht im Ton. So kommt er bei
--   Agent B an (schematisch, erfundener Inhalt):
--
--       user   <Zeile des Menschen>
--
--              [Marie Morgenrot]: *Du hältst einen Korb Äpfel in den Händen.*
--
--              (nächste Zeile von Agent B)
--
--   EIN Block. Maries Zeile hat einen Besitzer, die des Menschen hat KEINEN.
--   Eine unbeschriftete Zeile zwischen beschrifteten liest sich wie herrenlose
--   Erzählung — also schreibt das Modell daran weiter.
--
--   ⚠ Das Zusammenfassen aufeinanderfolgender `user`-Züge aus 356 hat es
--   VERSCHÄRFT. Es ist nötig (mehrere Anbieter lehnen zwei gleiche Rollen in
--   Folge ab), aber vorher stand der Satz des Menschen wenigstens für sich.
--   Eine Reparatur, die eine zweite Lücke öffnet, ist eine halbe.
--
-- ── DIE ZWEI HÄLFTEN DER REPARATUR ─────────────────────────────────────────
--
--   1. STRUKTUR (`chat_ai_service._as_turn`): der Mensch bekommt im
--      Gruppenverlauf dieselbe Marke wie alle anderen, `[User]`. Jeder Satz
--      im Block hat damit einen Besitzer.
--   2. ABSICHT (hier): die Anweisung muss sagen, WER das ist und was daraus
--      folgt. „Sprich nur als du selbst" allein genügt nicht — es verbietet,
--      die Zeilen der anderen AGENTEN zu schreiben, und der Mensch stand in
--      dieser Aufzählung nie drin.
--
--   Der Satz, auf den es ankommt, ist der letzte: wenn die eigene Antwort von
--   etwas abhängt, das nur der Mensch tun kann, dann HÖRT der Agent auf und
--   lässt ihn es tun. Ohne ihn füllt ein Rollenspielmodell die Lücke, weil
--   eine Szene, die stehenbleibt, sich für es wie ein Fehler anfühlt.
--
--   Der Rahmen im Vertrag (`_FRAME_GROUP`) trägt beide Sätze ebenfalls, damit
--   eine Welt sie nicht wegschreiben kann.

UPDATE prompt_templates
SET prompt_content = 'You are in a group conversation. The other participants are: {other_agent_names}. Speak only as yourself, and only in the first person. Never write, quote or continue another participant''s lines, and never answer on their behalf. Do not put any name in front of your reply: no bracketed tag, no "Name:" opener. Messages from the others reach you marked with their name; that mark identifies them and is not a format for your own text.

One of those marks is [User]. That is the person you are talking to. They are present, they act, and they speak for themselves. Never write what they say, never narrate what they do, never decide what they feel or agree to. You may describe how you perceive them. If your reply depends on something only they can do, stop and let them do it.

Respond to what the user and the others have said, and reference the mentioned events when they matter.',
    updated_at = now()
WHERE simulation_id IS NULL
  AND template_type = 'chat_group_instruction'
  AND locale = 'en';

UPDATE prompt_templates
SET prompt_content = 'Du befindest dich in einem Gruppengespraech. Die anderen Teilnehmer sind: {other_agent_names}. Sprich ausschliesslich als du selbst und in der Ich-Form. Schreibe niemals die Zeilen eines anderen, gib sie nicht wieder, fuehre sie nicht fort und antworte nicht an seiner Stelle. Stelle deinem Text keinen Namen voran: keine eckige Klammer, kein "Name:" am Anfang. Die Beitraege der anderen erreichen dich mit ihrem Namen markiert; diese Marke kennzeichnet sie und ist keine Vorlage fuer deine eigene Antwort.

Eine dieser Marken ist [User]. Das ist der Mensch, mit dem du sprichst. Er ist anwesend, er handelt, und er spricht fuer sich selbst. Schreibe niemals, was er sagt, erzaehle niemals, was er tut, und entscheide niemals, was er fuehlt oder wozu er einwilligt. Wie du ihn wahrnimmst, darfst du beschreiben. Haengt deine Antwort an etwas, das nur er tun kann, dann hoere auf und lass ihn es tun.

Reagiere auf das, was der User und die anderen gesagt haben, und beziehe dich auf die referenzierten Events, wenn sie relevant sind.',
    updated_at = now()
WHERE simulation_id IS NULL
  AND template_type = 'chat_group_instruction'
  AND locale = 'de';

-- ── Selbstprüfung ──────────────────────────────────────────────────────────
-- Gegen die eigene Wirkung: tragen die vorhandenen Plattform-Zeilen jetzt die
-- Marke des Menschen UND den Satz, der das Warten verlangt. Der Platzhalter
-- muss stehen bleiben.
DO $$
DECLARE
  v_platform int;
  v_scharf   int;
BEGIN
  SELECT count(*) INTO v_platform FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction';

  IF v_platform = 0 THEN
    RAISE NOTICE '364: keine Plattform-Vorlage vorhanden — UEBERSPRUNGEN, nicht bestanden.';
    RETURN;
  END IF;

  SELECT count(*) INTO v_scharf FROM prompt_templates
  WHERE simulation_id IS NULL
    AND template_type = 'chat_group_instruction'
    AND prompt_content LIKE '%{other_agent_names}%'
    AND prompt_content LIKE '%[User]%'
    AND (prompt_content LIKE '%let them do it%' OR prompt_content LIKE '%lass ihn es tun%')
    AND prompt_content NOT LIKE '%{{%';

  IF v_scharf <> v_platform THEN
    RAISE EXCEPTION '364: nur % von % Vorlagen nennen [User] samt Warte-Regel', v_scharf, v_platform;
  END IF;

  RAISE NOTICE '364: % Vorlage(n) kennen den Menschen als Stimme.', v_platform;
END $$;
