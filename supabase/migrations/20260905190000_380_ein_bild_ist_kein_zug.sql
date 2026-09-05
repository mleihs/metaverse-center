-- Migration 380: das Szenenbild im Gespraech
--
-- Ein Bild steht im Faden, weil ein Mensch es dort sehen will — aber es hat
-- niemand gesagt. Deshalb eine eigene Rolle: `scene_image`.
--
-- WARUM NICHT `system`. Diese Rolle gibt es schon, sie traegt die Szenennotiz
-- und geht als `[Scene]:` in den Prompt. Ein Bild dort hineinzulegen hiesse,
-- seine Beschreibung als Erzaehlerstimme in die Fiktion zu geben: die naechste
-- Figur schriebe daran weiter. `chat_ai_service._load_history` schliesst
-- `scene_image` deshalb ausdruecklich aus, `ChatService.get_messages` nicht —
-- angezeigt wird es, gelesen nicht.
--
-- Die Vorlage `chat_scene_image` ist der Zweischritt aus der
-- Schmiede-Recherche: Prosa hinein, Bildbeschreibung heraus. Der Rohtext als
-- Bildprompt waere die schwaechste Betriebsart — Dialog im Prompt fuehrt dazu,
-- dass das Modell die Dialogzeile ins Bild schreibt.
--
-- Der Vertrag dieser Vorlage (welche Platzhalter sie fuehren darf) steht in
-- `backend/services/prompt_contracts.py` und wird von
-- `test_prompt_contracts.py` per AST an die Aufrufstelle gebunden. Ein
-- Platzhalter, den die Aufrufstelle nicht liefert, ist dort ein roter Test und
-- hier eine CHECK-Verletzung (Migration 280 verbietet `{{name}}`).

BEGIN;

-- `simulation_id IS NULL` plus `is_system_default` ist die Plattformvorlage:
-- jede Welt erbt sie, jede darf sie ueberschreiben. Genau die Form, die
-- `building_image_description` schon hat.
INSERT INTO prompt_templates (
  simulation_id, template_type, prompt_category, template_name,
  prompt_content, variables, max_tokens, is_system_default, is_active
)
VALUES (
  NULL,
  'chat_scene_image',
  'generation',
  'Szenenbild aus dem Gespräch',
  'You turn a passage of roleplay prose into ONE image description.

WORLD: {simulation_name}
{world_context}

WHO ACTS IN THIS MOMENT: {participants}

CAMERA: {vantage_instruction}

THE PASSAGE:
{scene_text}

Write a single English image description of the ONE moment this passage
describes. The turns you are given may describe the same instant from
different vantage points — treat them as one scene seen several times, not as
several scenes.

Name the subjects, their posture and their relation to each other and to the
space. Give light, material and distance. Do not quote or paraphrase anything
that is said aloud, and do not describe what anyone thinks, knows or feels
except where it shows in the body.

Answer with the description only. No preamble, no list, no quotation marks.',
  '["scene_text", "participants", "vantage_instruction", "world_context", "simulation_name"]'::jsonb,
  -- 300 wie bei den anderen Bildbeschreibungen: eine Szene, kein Aufsatz. Ein
  -- groesseres Budget kaufte hier nichts, es verduennte nur den Prompt.
  300,
  true,
  true
)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  v_vorlage int;
  v_platzhalter text[];
BEGIN
  SELECT count(*) INTO v_vorlage FROM prompt_templates
   WHERE template_type = 'chat_scene_image' AND is_active;
  IF v_vorlage < 1 THEN
    RAISE EXCEPTION 'Migration 380: Vorlage chat_scene_image fehlt';
  END IF;

  -- Jeder Platzhalter im Text muss in `variables` erklaert sein. Das ist die
  -- WIRKUNG dieser Migration und nicht der Inhalt der Plattform: sie schreibt
  -- beides selbst, also darf sie beides gegeneinander pruefen.
  SELECT array_agg(DISTINCT m[1]) INTO v_platzhalter
    FROM prompt_templates t,
         LATERAL regexp_matches(t.prompt_content, '\{([a-z_]+)\}', 'g') AS m
   WHERE t.template_type = 'chat_scene_image'
     AND NOT (t.variables ? m[1]);
  IF v_platzhalter IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 380: nicht erklaerte Platzhalter: %', v_platzhalter;
  END IF;
END $$;

COMMIT;
