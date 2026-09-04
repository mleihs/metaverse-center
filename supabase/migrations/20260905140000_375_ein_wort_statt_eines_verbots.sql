-- ═══════════════════════════════════════════════════════════════════════════
-- 375 · Ein Wort statt eines Verbots
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 374 hat versucht, das Problem mit einer ANWEISUNG zu loesen: „[User] ist
-- eine Marke und kein Name … schreibe die Marke niemals in deinen Text."
--
-- ── GEMESSEN, unmittelbar danach, auf Produktion ───────────────────────────
--
--       3 von 3 Zuegen schrieben die Marke weiter.
--
--   Die Anweisung war wirkungslos. Das deckt sich mit CHARM
--   (arXiv:2609.01352, 2 748 gepruefte Faelle): zwischen dem ERKENNEN einer
--   Grenze und ihrem EINHALTEN liegen bei GPT-4o 72,4 Punkte.
--
--   Und es ist hier sogar nachvollziehbar: der Figur fehlte kein Verbot,
--   sondern ein WORT. Der Mensch traegt nirgends einen Namen — weder
--   `user_profiles` noch `simulation_members` fuehren einen. Braucht sie
--   mitten im Satz eine Bezeichnung fuer ihn, ist die Marke die einzige, die
--   dasteht. Ein Verbot nimmt ihr das letzte Wort, das sie hatte, und gibt
--   ihr keines.
--
-- ── WAS STATTDESSEN GESCHIEHT ──────────────────────────────────────────────
--
--   Die Marke selbst wird zur Bezeichnung, und zwar in der DRITTEN Person:
--   `[dein Gegenüber]` statt `[User]` (`_USER_SPEAKER_BY_LOCALE`).
--
--   Der Grund fuer die dritte Person ist grammatisch: eine Bezeichnung in der
--   dritten Person passt zu einem Verb in der dritten Person, und genau so
--   erzaehlen die Figuren den Menschen ohnehin. Ein Anredewort verlangte die
--   zweite Verbform und stuende dann falsch, sobald es aufgegriffen wird.
--
--   Dazu faellt im Ausgabetext die KLAMMER (`_strip_speaker_labels`), nicht
--   die Bezeichnung. Deterministisch, kein Modellaufruf, kein Verlass auf
--   Einhaltung.
--
--   Das Verbot aus 374 wird zurueckgenommen. Es war wirkungslos und stuende
--   der neuen Loesung im Weg: die Bezeichnung SOLL benutzt werden duerfen.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE prompt_templates
SET prompt_content = replace(
      prompt_content,
      'Eine weitere Stimme ist mit [User] markiert – das ist der Mensch, mit dem du sprichst. '
      || '[User] ist eine Marke und kein Name: sprich ihn direkt an, mit „du", „dir", „dich", '
      || 'und schreibe die Marke selbst niemals in deinen Text.',
      'Eine weitere Stimme ist mit [dein Gegenüber] markiert – das ist der Mensch, mit dem du '
      || 'sprichst. Sprich ihn an wie eine anwesende Person: mit „du". Brauchst du im Erzähltext '
      || 'eine Bezeichnung für ihn, schreibe „dein Gegenüber" ohne Klammern.'),
    updated_at = NOW()
WHERE simulation_id IS NULL
  AND template_type = 'chat_group_instruction'
  AND locale = 'de';

UPDATE prompt_templates
SET prompt_content = replace(
      prompt_content,
      'One further voice is marked [User] – that is the human you are speaking with. '
      || '[User] is a marker, not a name: address them directly as "you", '
      || 'and never write the marker itself into your text.',
      'One further voice is marked [your counterpart] – that is the human you are speaking with. '
      || 'Address them as a person who is present: as "you". If you need a designation for them '
      || 'in narration, write "your counterpart" without brackets.'),
    updated_at = NOW()
WHERE simulation_id IS NULL
  AND template_type = 'chat_group_instruction'
  AND locale = 'en';

DO $$
DECLARE
  v_platform int;
  v_neu      int;
  v_alt      int;
  v_371      int;
  v_372      int;
BEGIN
  SELECT count(*) INTO v_platform FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction';
  IF v_platform = 0 THEN
    RAISE EXCEPTION '375: keine Plattform-Vorlage — die Migration haette nichts getan';
  END IF;

  SELECT count(*) INTO v_neu FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND (prompt_content LIKE '%[dein Gegenüber]%' OR prompt_content LIKE '%[your counterpart]%');
  IF v_neu <> v_platform THEN
    RAISE EXCEPTION '375: nur % von % Vorlagen tragen die neue Bezeichnung', v_neu, v_platform;
  END IF;

  -- Das wirkungslose Verbot aus 374 ist weg. Bliebe es stehen, verboete die
  -- Vorlage genau das Wort, das die Figur jetzt benutzen SOLL.
  SELECT count(*) INTO v_alt FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND (prompt_content LIKE '%niemals in deinen Text%'
      OR prompt_content LIKE '%never write the marker%');
  IF v_alt > 0 THEN
    RAISE EXCEPTION '375: % Vorlage(n) tragen weiterhin das wirkungslose Verbot aus 374', v_alt;
  END IF;

  SELECT count(*) INTO v_371 FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND strpos(prompt_content, '{agent_name}') < strpos(prompt_content, '{other_agent_names}')
    AND right(btrim(prompt_content), 60) LIKE '%{agent_name}%';
  IF v_371 <> v_platform THEN
    RAISE EXCEPTION '375: % Vorlage(n) haben den Namensanker aus 371 verloren', v_platform - v_371;
  END IF;

  SELECT count(*) INTO v_372 FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND right(btrim(prompt_content), 120) LIKE '%{addressed_note}%';
  IF v_372 <> v_platform THEN
    RAISE EXCEPTION '375: % Vorlage(n) haben den Lage-Platzhalter aus 372 verloren', v_platform - v_372;
  END IF;

  RAISE NOTICE '375: % Vorlage(n) geben der Figur ein Wort statt eines Verbots.', v_platform;
END $$;
