-- ═══════════════════════════════════════════════════════════════════════════
-- 372 · Wer gemeint war, steht nicht im Text
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fuenfte Fassung der Gruppen-Anweisung. 371 hat die IDENTITAET verankert
-- ("du bist X"). Diese hier verankert die LAGE: wer gerade angesprochen war,
-- und wer in derselben Runde schon geantwortet hat.
--
-- ── GEMESSEN, 330 Agentenzuege eines Fadens mit drei Figuren ───────────────
--
--   Gezaehlt wurde, wie oft eine Figur ihren eigenen Namen mit einem fremden
--   zu einem Paar buendelt ("A und B", geschrieben von A) — sie zaehlt sich
--   dann selbst zu den anderen:
--
--       Figur    Position   der Mensch nannte SIE   er nannte eine ANDERE
--       erste      1,00             6 %                    5 %
--       zweite     2,00            10 %                   22 %
--       dritte     3,00            22 %                   37 %
--
--   82 von 330 Zuegen tragen den eigenen Vornamen UND eine Ich-Form: die
--   Figur ist im selben Satz "ich" und eine benannte dritte Person.
--
-- ── DIE ZWEI URSACHEN, beide in der Tabelle ────────────────────────────────
--
--   1. DIE POSITION. Wer als zweite oder dritte antwortet, hat zwei fremde
--      Ich-Erzaehlungen ueber DENSELBEN Augenblick unmittelbar vor sich.
--      6 % gegen 37 % — Faktor sechs, allein durch die Reihenfolge.
--
--   2. DIE DRITTE PERSON. Ein Mensch schreibt "waehrend ich A kuesse". Darin
--      steht kein "du". Fuer B und C enthaelt die Nachricht NICHTS, woraus
--      sie schliessen koennten, dass sie nicht gemeint sind — und genau dann
--      ist es am schlimmsten: 22 statt 10, 37 statt 22.
--
--   Der schaerfste Einzelfall aus den Daten: nachdem der Mensch richtiggestellt
--   hatte, dass eine Figur den Raum verlassen hat, antwortete DIESE FIGUR
--   SELBST mit dem Satz, sie sei nicht da.
--
-- ── WARUM GERECHNET UND NICHT GEBETEN ──────────────────────────────────────
--
--   Beides ist ohne Modell entscheidbar: die Namen stehen im Text des
--   Menschen, die Reihenfolge steht im Aufruf. `ChatAIService._addressed_note`
--   rechnet den Satz aus und fuellt ihn in `{addressed_note}`.
--
--   Das ist kein Geschmack. CHARM (arXiv:2609.01352, 2 748 gepruefte Faelle)
--   misst den Abstand zwischen ERKENNEN einer Grenze und EINHALTEN: bei
--   GPT-4o 91,3 % gegen 18,9 %, also 72,4 Punkte. Ein Modell, das die Grenze
--   kennt und sie trotzdem uebertritt, wird von einer weiteren Bitte nicht
--   gehalten. Was man ausrechnen kann, gehoert nicht in eine Bitte.
--
--   Der Platzhalter steht LEER, wenn nichts zu sagen ist. Ein Satz, der immer
--   dasteht, wird Tapete.
--
-- ── STELLUNG ──────────────────────────────────────────────────────────────
--
--   Unmittelbar vor der Schlusszeile. Das Letzte vor der Antwort gewinnt —
--   dieselbe Begruendung, aus der 367 die Anweisung ueberhaupt nach unten
--   geholt hat, und aus der 371 den Namen ans Ende zurueckholt.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE prompt_templates
SET prompt_content = replace(
      prompt_content,
      'Antworte jetzt als {agent_name}.',
      '{addressed_note}

Antworte jetzt als {agent_name}.'),
    variables = '["agent_name", "other_agent_names", "addressed_note"]'::jsonb,
    updated_at = NOW()
WHERE simulation_id IS NULL
  AND template_type = 'chat_group_instruction'
  AND locale = 'de'
  AND prompt_content NOT LIKE '%{addressed_note}%';

UPDATE prompt_templates
SET prompt_content = replace(
      prompt_content,
      'Answer now as {agent_name}.',
      '{addressed_note}

Answer now as {agent_name}.'),
    variables = '["agent_name", "other_agent_names", "addressed_note"]'::jsonb,
    updated_at = NOW()
WHERE simulation_id IS NULL
  AND template_type = 'chat_group_instruction'
  AND locale = 'en'
  AND prompt_content NOT LIKE '%{addressed_note}%';

DO $$
DECLARE
  v_platform int;
  v_hat      int;
  v_stellung int;
  v_371      int;
  v_vars     int;
BEGIN
  SELECT count(*) INTO v_platform FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction';
  IF v_platform = 0 THEN
    RAISE EXCEPTION '372: keine Plattform-Vorlage — die Migration haette nichts getan';
  END IF;

  SELECT count(*) INTO v_hat FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND prompt_content LIKE '%{addressed_note}%';
  IF v_hat <> v_platform THEN
    RAISE EXCEPTION '372: nur % von % Vorlagen tragen den Lage-Platzhalter', v_hat, v_platform;
  END IF;

  -- Er steht VOR der Schlusszeile, nicht irgendwo. Stuende er darueber im
  -- Fliesstext, waere er wieder eine Zeile unter vielen.
  SELECT count(*) INTO v_stellung FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND strpos(prompt_content, '{addressed_note}')
        > strpos(prompt_content, '{other_agent_names}')
    AND right(btrim(prompt_content), 120) LIKE '%{addressed_note}%';
  IF v_stellung <> v_platform THEN
    RAISE EXCEPTION '372: in % Vorlage(n) steht der Lage-Platzhalter nicht kurz vor dem Schluss', v_platform - v_stellung;
  END IF;

  -- 371 bleibt: Name vorn UND hinten.
  SELECT count(*) INTO v_371 FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND strpos(prompt_content, '{agent_name}') < strpos(prompt_content, '{other_agent_names}')
    AND right(btrim(prompt_content), 60) LIKE '%{agent_name}%';
  IF v_371 <> v_platform THEN
    RAISE EXCEPTION '372: % Vorlage(n) haben den Namensanker aus 371 verloren', v_platform - v_371;
  END IF;

  SELECT count(*) INTO v_vars FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND variables @> '["addressed_note"]'::jsonb
    AND variables @> '["agent_name"]'::jsonb;
  IF v_vars <> v_platform THEN
    RAISE EXCEPTION '372: % von % Vorlagen fuehren addressed_note nicht in variables', v_platform - v_vars, v_platform;
  END IF;

  RAISE NOTICE '372: % Vorlage(n) nennen jetzt auch die Lage — wer gemeint war und wer vorher dran war.', v_platform;
END $$;
