-- ═══════════════════════════════════════════════════════════════════════════
-- 371 · Wer du bist, steht nicht hinter vierhundert Nachrichten
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Vierte Fassung der Gruppen-Anweisung (nach 356, 364, 367). Diesmal ist der
-- Befund nicht, dass die Anweisung zu schwach war, sondern dass 367 den
-- Fehler MITVERURSACHT hat.
--
-- ── GEMESSEN am 05.09.2026, im gewachsenen Faden ───────────────────────────
--
--   Fokalisierung im selben Faden, vor und nach dem Ausrollen von 367:
--
--       vor Ausrollen    216 Zuege    29 allwissend   13,4 %
--       nach Ausrollen    93 Zuege    19 allwissend   20,4 %
--
--   Nicht besser, sondern schlechter. Dazu der Befund, den ein Mensch sofort
--   sah und keine Quote zeigt: alle drei Sprecher antworteten als DERSELBE.
--   Eine an die erste Sprecherin gerichtete Handlung beantworteten alle drei
--   in der ersten Person, als sei sie ihnen geschehen.
--
-- ── DIE URSACHE, und sie ist meine ─────────────────────────────────────────
--
--   367 hat die Gruppen-Anweisung vom System-Prompt (Position 0) an das Ende
--   geholt, unmittelbar vor die Antwort. Das war richtig und bleibt richtig.
--
--   Nur stand in dieser Anweisung, wortwoertlich:
--
--       „Du bist in einer Szene mit: {other_agent_names}."
--
--   Sie nennt JEDEN AUSSER DEM ANGESPROCHENEN. Wer er selbst ist, stand
--   weiterhin allein im System-Prompt — hinter inzwischen 497 Nachrichten.
--
--   Damit war das Letzte vor der Antwort: der Zug des Vorredners in der ersten
--   Person, und darunter ein Satz, der die beiden anderen beim Namen nennt.
--   Die einzige Ich-Stimme in Reichweite war die des Vorredners. Das Modell
--   hat nicht die Regel missachtet, es hat die naechstliegende Identitaet
--   genommen — und das war die falsche.
--
--   Ich habe die REGEL nach unten geholt und die IDENTITAET oben gelassen.
--   Getrennt betrachtet war jeder Schritt richtig; zusammen haben sie den
--   Anker entfernt und den Koeder danebengelegt.
--
-- ── WAS SICH AENDERT ───────────────────────────────────────────────────────
--
--   `{agent_name}` wird Pflichtvariable der Vorlage (Vertrag in
--   `prompt_contracts.py`, gefuellt in `ChatAIService`). Die Anweisung
--   beginnt UND endet mit dem eigenen Namen: der erste Satz setzt ihn, der
--   letzte holt ihn unmittelbar vor die Antwort zurueck.
--
--   Alles aus 367 bleibt woertlich stehen: Wahrnehmungshorizont statt Verbot,
--   Unterordnung der Fremdbeschreibung unter die eigene Handlung, eine
--   Handlung je Zug, keine Forderung nach einer Personalform.
--
--   Die Selbstpruefung unten prueft NUR die eigene Wirkung: dass beide
--   Plattform-Vorlagen den Platzhalter tragen, dass er vor dem ersten fremden
--   Namen steht, dass er auch am Ende steht, und dass die Zusagen aus 367
--   nicht verlorengegangen sind.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE prompt_templates
SET prompt_content = 'Du bist {agent_name}. Du schreibst als {agent_name} und fuer niemanden sonst.

Du bist in einer Szene mit: {other_agent_names}. Eine weitere Stimme ist mit [User] markiert – das ist der Mensch, mit dem du sprichst.

Du bist eine Person in dieser Szene, und dein Horizont endet, wo deine Sinne enden. Schreibe, was du tust, sagst, bemerkst und fuehlst. Den Raum und die anderen darfst du beschreiben, soweit deine eigene Handlung es braucht: was sie zu tun scheinen, wie sie auf dich wirken, was du daraus machst.

Was ein anderer denkt, entscheidet oder als NAECHSTES tut, schreibt er selbst. Was schon geschehen ist, darfst du mittelbar berichten ("sie hat nach der Akte gefragt"), aber seinen naechsten Zug machst du nie fuer ihn. Seine Zeilen erreichen dich mit seinem Namen markiert; diese Marke kennzeichnet ihn und ist keine Vorlage fuer deinen eigenen Text.

Was dem Menschen an eine andere Person geschieht, geschieht nicht dir. Spricht er einen Namen an, der nicht {agent_name} ist, dann bist du die, die es sieht – nicht die, der es widerfaehrt.

Eine Handlung je Zug. Wenn die Szene verlangt, dass sich jemand anderes bewegt, lass sie warten.

Reagiere auf das Gesagte und beziehe dich auf die referenzierten Events, wenn sie relevant sind.

Antworte jetzt als {agent_name}.',
    variables = '["agent_name", "other_agent_names"]'::jsonb,
    updated_at = NOW()
WHERE simulation_id IS NULL
  AND template_type = 'chat_group_instruction'
  AND locale = 'de';

UPDATE prompt_templates
SET prompt_content = 'You are {agent_name}. You write as {agent_name} and as no one else.

You are in a scene with: {other_agent_names}. One further voice is marked [User] – that is the human you are speaking with.

You are a person in this scene, and your horizon ends where your senses do. Write what you do, say, notice and feel. You may describe the room and the others as far as your own action needs it: what they appear to be doing, how they affect you, what you make of it.

What another thinks, decides, or does NEXT, they write themselves. What has already happened you may report at second hand ("she asked about the file"), but you never make their next move for them. Their lines reach you marked with their name; that mark identifies them and is not a template for your own text.

What the human does to another person does not happen to you. If they address a name that is not {agent_name}, you are the one who sees it – not the one it happens to.

One action per turn. If the scene requires someone else to move, let it wait.

Respond to what was said and refer to the referenced events where relevant.

Answer now as {agent_name}.',
    variables = '["agent_name", "other_agent_names"]'::jsonb,
    updated_at = NOW()
WHERE simulation_id IS NULL
  AND template_type = 'chat_group_instruction'
  AND locale = 'en';

DO $$
DECLARE
  v_platform  int;
  v_mit_namen int;
  v_anker     int;
  v_schluss   int;
  v_367       int;
  v_ichform   int;
  v_vars      int;
BEGIN
  SELECT count(*) INTO v_platform FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction';
  IF v_platform = 0 THEN
    RAISE EXCEPTION '371: keine Plattform-Vorlage fuer chat_group_instruction — die Migration haette nichts getan';
  END IF;

  -- 1. Der Platzhalter ist ueberhaupt da.
  SELECT count(*) INTO v_mit_namen FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND prompt_content LIKE '%{agent_name}%';
  IF v_mit_namen <> v_platform THEN
    RAISE EXCEPTION '371: nur % von % Vorlagen nennen den eigenen Namen', v_mit_namen, v_platform;
  END IF;

  -- 2. Er steht VOR dem ersten fremden Namen. Genau diese Reihenfolge war der
  --    Fehler: wer zuerst die anderen nennt, hat den Anker schon verloren.
  SELECT count(*) INTO v_anker FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND strpos(prompt_content, '{agent_name}') > 0
    AND strpos(prompt_content, '{agent_name}') < strpos(prompt_content, '{other_agent_names}');
  IF v_anker <> v_platform THEN
    RAISE EXCEPTION '371: in % von % Vorlagen steht der eigene Name nicht vor den fremden', v_platform - v_anker, v_platform;
  END IF;

  -- 3. Und er steht auch am ENDE. Das Letzte vor der Antwort gewinnt; das ist
  --    der ganze Grund, warum 367 die Anweisung ueberhaupt nach unten geholt hat.
  SELECT count(*) INTO v_schluss FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND right(btrim(prompt_content), 60) LIKE '%{agent_name}%';
  IF v_schluss <> v_platform THEN
    RAISE EXCEPTION '371: % von % Vorlagen holen den eigenen Namen nicht ans Ende zurueck', v_platform - v_schluss, v_platform;
  END IF;

  -- 4. Die Zusagen aus 367 stehen noch. Eine Reparatur, die eine fruehere
  --    zuruecknimmt, ist keine.
  SELECT count(*) INTO v_367 FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND prompt_content LIKE '%[User]%'
    AND (prompt_content LIKE '%horizon ends where your senses do%'
      OR prompt_content LIKE '%Horizont endet, wo deine Sinne enden%')
    AND (prompt_content LIKE '%One action per turn%'
      OR prompt_content LIKE '%Eine Handlung je Zug%')
    AND prompt_content NOT LIKE '%{{%';
  IF v_367 <> v_platform THEN
    RAISE EXCEPTION '371: % Vorlage(n) haben die Zusagen aus 367 verloren', v_platform - v_367;
  END IF;

  SELECT count(*) INTO v_ichform FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND (prompt_content LIKE '%first person%' OR prompt_content LIKE '%Ich-Form%');
  IF v_ichform > 0 THEN
    RAISE EXCEPTION '371: % Vorlage(n) verlangen die Ich-Form — das war die Fehldiagnose aus 367', v_ichform;
  END IF;

  -- 5. Die Variablenliste ist Daten, die der Vertrag liest. Stuende der
  --    Platzhalter im Text und nicht in der Liste, waere die Vorlage still
  --    inkonsistent.
  SELECT count(*) INTO v_vars FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND variables @> '["agent_name"]'::jsonb
    AND variables @> '["other_agent_names"]'::jsonb;
  IF v_vars <> v_platform THEN
    RAISE EXCEPTION '371: % von % Vorlagen fuehren agent_name nicht in variables', v_platform - v_vars, v_platform;
  END IF;

  RAISE NOTICE '371: % Vorlage(n) ankern den eigenen Namen vorn und hinten; die Zusagen aus 367 stehen.', v_platform;
END $$;
