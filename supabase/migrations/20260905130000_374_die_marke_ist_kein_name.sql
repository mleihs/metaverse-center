-- ═══════════════════════════════════════════════════════════════════════════
-- 374 · Die Marke ist kein Name
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Beim Durchspielen von sechs Runden auf Produktion gefunden, nicht in einem
-- Test: die Figuren schreiben die Marke des Menschen woertlich in ihre Prosa.
--
--   Die Marke erscheint dort, wo ein NAME stehen muesste: als Subjekt eines
--   Nebensatzes, nach einer Praeposition, und im Genitiv vor einem
--   Koerperteil. Also ueberall dort, wo eine Figur eine Bezeichnung braucht.
--
-- ── GEMESSEN, derselbe Faden ───────────────────────────────────────────────
--
--       11 von 24 Agentenzuegen enthalten `[User]` im Text   = 46 %
--
-- ── DIE URSACHE, und sie ist meine aus 364 ─────────────────────────────────
--
--   364 hat dem Menschen eine Marke gegeben, weil seine Zeile sonst als
--   einzige ohne Besitzer in einem Block voller beschrifteter stand. Das war
--   richtig und bleibt richtig.
--
--   Nur ist die Marke das EINZIGE, was eine Figur ueber den Menschen an
--   Bezeichnung hat. Er traegt keinen Namen im System — `user_profiles`
--   fuehrt keinen Anzeigenamen, und im Prompt heisst er nirgends anders.
--   Braucht die Figur mitten im Satz ein Wort fuer ihn, nimmt sie das
--   einzige, das dasteht.
--
--   Das ist KEIN Verstoss gegen eine Regel, sondern eine Luecke im
--   Wortschatz. Ein Verbot allein hilft dagegen wenig (CHARM misst 72,4
--   Punkte zwischen Erkennen und Einhalten); was fehlt, ist das Wort selbst.
--   Also wird es genannt: der Mensch ist das Gegenueber, und man spricht ihn
--   mit „du" an.
--
--   Die Zeile steht dort, wo die Marke erklaert wird — die Erklaerung und die
--   Anweisung, sie nicht zu schreiben, gehoeren in denselben Satz.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE prompt_templates
SET prompt_content = replace(
      prompt_content,
      'Eine weitere Stimme ist mit [User] markiert – das ist der Mensch, mit dem du sprichst.',
      'Eine weitere Stimme ist mit [User] markiert – das ist der Mensch, mit dem du sprichst. '
      || '[User] ist eine Marke und kein Name: sprich ihn direkt an, mit „du", „dir", „dich", '
      || 'und schreibe die Marke selbst niemals in deinen Text.'),
    updated_at = NOW()
WHERE simulation_id IS NULL
  AND template_type = 'chat_group_instruction'
  AND locale = 'de'
  AND prompt_content NOT LIKE '%ist eine Marke und kein Name%';

UPDATE prompt_templates
SET prompt_content = replace(
      prompt_content,
      'One further voice is marked [User] – that is the human you are speaking with.',
      'One further voice is marked [User] – that is the human you are speaking with. '
      || '[User] is a marker, not a name: address them directly as "you", '
      || 'and never write the marker itself into your text.'),
    updated_at = NOW()
WHERE simulation_id IS NULL
  AND template_type = 'chat_group_instruction'
  AND locale = 'en'
  AND prompt_content NOT LIKE '%is a marker, not a name%';

DO $$
DECLARE
  v_platform int;
  v_hat      int;
  v_371      int;
  v_372      int;
BEGIN
  SELECT count(*) INTO v_platform FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction';
  IF v_platform = 0 THEN
    RAISE EXCEPTION '374: keine Plattform-Vorlage — die Migration haette nichts getan';
  END IF;

  SELECT count(*) INTO v_hat FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND (prompt_content LIKE '%ist eine Marke und kein Name%'
      OR prompt_content LIKE '%is a marker, not a name%');
  IF v_hat <> v_platform THEN
    RAISE EXCEPTION '374: nur % von % Vorlagen sagen, dass die Marke kein Name ist', v_hat, v_platform;
  END IF;

  -- Die Anker aus 371 und 372 stehen noch. Eine Reparatur, die eine fruehere
  -- zuruecknimmt, ist keine.
  SELECT count(*) INTO v_371 FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND strpos(prompt_content, '{agent_name}') < strpos(prompt_content, '{other_agent_names}')
    AND right(btrim(prompt_content), 60) LIKE '%{agent_name}%';
  IF v_371 <> v_platform THEN
    RAISE EXCEPTION '374: % Vorlage(n) haben den Namensanker aus 371 verloren', v_platform - v_371;
  END IF;

  SELECT count(*) INTO v_372 FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND right(btrim(prompt_content), 120) LIKE '%{addressed_note}%';
  IF v_372 <> v_platform THEN
    RAISE EXCEPTION '374: % Vorlage(n) haben den Lage-Platzhalter aus 372 verloren', v_platform - v_372;
  END IF;

  RAISE NOTICE '374: % Vorlage(n) nennen das Wort, das der Figur fuer den Menschen fehlte.', v_platform;
END $$;
