-- ═══════════════════════════════════════════════════════════════════════════
-- 366 · Eine Figur ohne Gedächtnis sieht aus wie eine mit
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── DER BEFUND, gemessen am 04.09.2026 auf Produktion ──────────────────────
--
--   Drei von vier welteigenen `chat_system_prompt`-Vorlagen kannten weder
--   `{agent_memories}` noch `{agent_mood}`:
--
--       Spengbab's Grease Pit     [en]   beide fehlen
--       State Pathography         [en]   vollständig
--       The Time Bank of Momo     [en]   beide fehlen
--       Velgarien                 [en]   beide fehlen
--
--   Im Einzelchat werden beide als VORLAGENVARIABLE übergeben. Fehlt der
--   Platzhalter, fällt der Wert lautlos weg — kein Fehler, keine Lücke im
--   Text, keine Spur. Ein Agent in Velgarien hatte 195 Erinnerungen in der
--   Datenbank, und keine einzige ist je in einen Prompt gelangt.
--
--   Das ist die stillste Fehlerart dieses Vertragswerks. `UNKNOWN` und
--   `MUSTACHE` beschreiben einen Platzhalter, der DASTEHT und nicht wirkt;
--   hier steht keiner, und die Figur spricht ohne Gedächtnis und ohne
--   Stimmung, während sie aussieht wie eine, die beides hat.
--
-- ── WAS HIER GESCHIEHT ─────────────────────────────────────────────────────
--
--   Die fehlenden Platzhalter werden ANGEHÄNGT, nicht eingewoben. Der fremde
--   Text bleibt unangetastet: die Vorlage gehört ihrer Welt, und was hier
--   repariert wird, ist eine verlorene Fähigkeit, keine Formulierung.
--
--   Der nackte Platzhalter auf eigener Zeile — genau die Gestalt, die die
--   Plattform-Vorlage seit jeher hat:
--
--       Dein Hintergrund: {agent_background}
--
--       {agent_memories}
--
--       {agent_mood}
--
--   KEIN Begleitsatz. Ein solcher müsste eine Sprache wählen, und die
--   reparierte Vorlage kennt womöglich eine andere als ihre Welt — auf Prod
--   war genau das der Fall (englische Vorlage, deutsche Welt). Der nackte
--   Platzhalter kennt keine.
--
--   ANS ENDE, nicht mittendrin: was zuletzt im Prompt steht, wiegt am
--   schwersten, und der Zustand des Agenten soll gegen den Rahmen nicht
--   verlieren. Es gäbe auch keine Stelle im fremden Text, die man
--   aufschneiden könnte, ohne ihn zu redigieren.
--
-- ── WARUM DAS HIER UND NICHT NUR IM CODE STEHT ─────────────────────────────
--
--   Der Vertrag in `prompt_contracts.py` kennt seit heute `required` und die
--   Fehlerart `MISSING`; `sanitize_template` hängt an, `PromptTemplateService`
--   weist eine handgeschriebene Vorlage ohne die beiden ab, und der Resolver
--   meldet den Befund nach Sentry. Das alles verhindert die NÄCHSTE solche
--   Vorlage. Die drei, die schon dastehen, repariert es nicht.
--
--   Ohne Bedingung auf einen bestimmten Weltnamen: die Migration wirkt auf
--   jede Zeile, der die Platzhalter fehlen, auch auf einer frischen Datenbank
--   mit ganz anderen Welten.

UPDATE prompt_templates
SET prompt_content = rtrim(prompt_content) || E'\n\n{agent_memories}',
    updated_at = now()
WHERE simulation_id IS NOT NULL
  AND template_type = 'chat_system_prompt'
  AND prompt_content NOT LIKE '%{agent_memories}%'
  AND coalesce(system_prompt, '') NOT LIKE '%{agent_memories}%';

UPDATE prompt_templates
SET prompt_content = rtrim(prompt_content) || E'\n\n{agent_mood}',
    updated_at = now()
WHERE simulation_id IS NOT NULL
  AND template_type = 'chat_system_prompt'
  AND prompt_content NOT LIKE '%{agent_mood}%'
  AND coalesce(system_prompt, '') NOT LIKE '%{agent_mood}%';

-- ── Selbstprüfung ──────────────────────────────────────────────────────────
-- Gegen die eigene WIRKUNG: nach diesem Lauf trägt JEDE welteigene
-- Chat-Vorlage beide Platzhalter. Kein Wort über eine Zeilenzahl der
-- Plattform — gibt es keine solche Vorlage, ist die Aussage trivial wahr, und
-- das wird gesagt statt verschwiegen.
DO $$
DECLARE
  v_gesamt int;
  v_ohne   int;
BEGIN
  SELECT count(*) INTO v_gesamt FROM prompt_templates
  WHERE simulation_id IS NOT NULL AND template_type = 'chat_system_prompt';

  IF v_gesamt = 0 THEN
    RAISE NOTICE '366: keine welteigene Chat-Vorlage vorhanden — nichts zu reparieren. Die Aussage ist trivial wahr, nicht geprueft.';
    RETURN;
  END IF;

  SELECT count(*) INTO v_ohne FROM prompt_templates
  WHERE simulation_id IS NOT NULL
    AND template_type = 'chat_system_prompt'
    AND (
      (prompt_content NOT LIKE '%{agent_memories}%' AND coalesce(system_prompt,'') NOT LIKE '%{agent_memories}%')
      OR
      (prompt_content NOT LIKE '%{agent_mood}%' AND coalesce(system_prompt,'') NOT LIKE '%{agent_mood}%')
    );

  IF v_ohne > 0 THEN
    RAISE EXCEPTION '366: % von % welteigenen Chat-Vorlagen fehlt weiterhin ein Pflicht-Platzhalter', v_ohne, v_gesamt;
  END IF;

  RAISE NOTICE '366: alle % welteigenen Chat-Vorlagen tragen Gedaechtnis und Stimmung.', v_gesamt;
END $$;
