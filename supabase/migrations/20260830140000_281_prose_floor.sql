-- Migration 281 — ein Boden unter der Prosa
--
-- WHY
-- ---
-- The platform's own prose templates ORDERED the register a reader rejected.
-- `agent_generation_full` opened with "Create rich, believable characters with
-- depth and nuance", the two building templates with "Create atmospheric
-- building descriptions", `event_generation` with "Create compelling, realistic
-- events". Ask a model for rich, atmospheric and compelling and it answers with
-- a simile in every sentence, a colon-thesis summing the subject up, an invented
-- signature quirk, and a closing epigram. Measured on the real path, that is
-- exactly what came back.
--
-- W1 gave images a composition floor and the chronicle a JSON floor. Prose got
-- none. `PromptResolver` appends `_FRAME_PROSE` only to SIMULATION-OWNED rows,
-- on the stated ground that "a platform template already carries its guarantees
-- inline" — true for image and chronicle, and simply false for prose. Rather
-- than widen the frame rule, this migration makes the statement true: the floor
-- goes INLINE into the platform rows, in the same last position the frame would
-- occupy.
--
-- WHY LAST, AND NOT IN THE SYSTEM PROMPT
-- --------------------------------------
-- Measured before writing this (deepseek-chat-v3-0324, T=0.8, 3 runs x 2 fields,
-- closing sentence of each field read individually):
--
--   floor only in the system prompt      ->  0 of 6 closing sentences clean
--   floor also at the end of the user    ->  4-5 of 6 clean
--
-- Negative style rules lose to a strong prior unless they come last. The system
-- prompt is corrected as well (it is the part that ordered the ornament), but
-- the floor that does the work sits at the end of `prompt_content`.
--
-- Measured again on the production code path afterwards, ALT vs NEU:
--   ALT closing sentences: "The frustration sustains him." /
--                          "Her collection of confiscated love letters ..."
--   NEU closing sentences: "She has not blinked in seven years." /
--                          "Gertrud has never spilled a single drop of ink in
--                           her career."
--
-- WHAT
-- ----
-- 1. Append the style floor to `prompt_content` of the five platform prose
--    templates (EN + DE), unless it is already there.
-- 2. Replace the four system prompts that ordered the ornament. The fifth type,
--    `agent_generation_partial`, was already neutral and keeps its own.
--
-- Both steps touch ONLY platform rows (`simulation_id IS NULL`,
-- `is_system_default = true`) that still carry the seeded text, so a template an
-- admin has edited by hand survives untouched. Re-running is a no-op.
--
-- The hardcoded twin of this text — `_build_entity_prompt` and
-- `_build_chunk_prompt` in forge_orchestrator_service.py, which never touch
-- prompt_templates at all — is corrected in the same commit.

BEGIN;

-- agent_generation_full (EN) — Boden anhaengen
UPDATE public.prompt_templates
SET prompt_content = prompt_content || '

STYLE (platform requirement, overrides anything above):
- At most one simile or image per paragraph.
- No formula that sums the person up ("Their greatest contradiction:", "Their private heresy:").
- No signature quirk invented to make them memorable.
- The LAST sentence of each field is a fact, not an epigram and not a comparison.
- Sentences may be long; they should just not all share one shape.
- Ordinary registers are allowed: a clerk may be described in the language of clerks.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'agent_generation_full'
  AND locale = 'en'
  AND position('

STYLE (platform requirement, overrides anything above):
- At most one simile or image per paragraph.
- No formula that sums the person up ("Their greatest contradiction:", "Their private heresy:").
- No signature quirk invented to make them memorable.
- The LAST sentence of each field is a fact, not an epigram and not a comparison.
- Sentences may be long; they should just not all share one shape.
- Ordinary registers are allowed: a clerk may be described in the language of clerks.' in prompt_content) = 0;

-- agent_generation_full (DE) — Boden anhaengen
UPDATE public.prompt_templates
SET prompt_content = prompt_content || '

STIL (Vorgabe der Plattform, geht allem oben Stehenden vor):
- Hoechstens ein Vergleich oder Bild je Absatz.
- Keine Formel, die die Person zusammenfasst ("Ihr groesster Widerspruch:", "Ihre private Ketzerei:").
- Keine erfundene Marotte, die sie merkwuerdig machen soll.
- Der LETZTE Satz jedes Feldes ist eine Tatsache, keine Pointe und kein Vergleich.
- Saetze duerfen lang sein; sie sollen nur nicht alle dasselbe Muster haben.
- Gewoehnliche Register sind erlaubt: eine Beamtin darf in der Sprache der Beamten beschrieben werden.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'agent_generation_full'
  AND locale = 'de'
  AND position('

STIL (Vorgabe der Plattform, geht allem oben Stehenden vor):
- Hoechstens ein Vergleich oder Bild je Absatz.
- Keine Formel, die die Person zusammenfasst ("Ihr groesster Widerspruch:", "Ihre private Ketzerei:").
- Keine erfundene Marotte, die sie merkwuerdig machen soll.
- Der LETZTE Satz jedes Feldes ist eine Tatsache, keine Pointe und kein Vergleich.
- Saetze duerfen lang sein; sie sollen nur nicht alle dasselbe Muster haben.
- Gewoehnliche Register sind erlaubt: eine Beamtin darf in der Sprache der Beamten beschrieben werden.' in prompt_content) = 0;

-- agent_generation_partial (EN) — Boden anhaengen
UPDATE public.prompt_templates
SET prompt_content = prompt_content || '

STYLE (platform requirement, overrides anything above):
- At most one simile or image per paragraph.
- No formula that sums the person up ("Their greatest contradiction:", "Their private heresy:").
- No signature quirk invented to make them memorable.
- The LAST sentence of each field is a fact, not an epigram and not a comparison.
- Sentences may be long; they should just not all share one shape.
- Ordinary registers are allowed: a clerk may be described in the language of clerks.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'agent_generation_partial'
  AND locale = 'en'
  AND position('

STYLE (platform requirement, overrides anything above):
- At most one simile or image per paragraph.
- No formula that sums the person up ("Their greatest contradiction:", "Their private heresy:").
- No signature quirk invented to make them memorable.
- The LAST sentence of each field is a fact, not an epigram and not a comparison.
- Sentences may be long; they should just not all share one shape.
- Ordinary registers are allowed: a clerk may be described in the language of clerks.' in prompt_content) = 0;

-- agent_generation_partial (DE) — Boden anhaengen
UPDATE public.prompt_templates
SET prompt_content = prompt_content || '

STIL (Vorgabe der Plattform, geht allem oben Stehenden vor):
- Hoechstens ein Vergleich oder Bild je Absatz.
- Keine Formel, die die Person zusammenfasst ("Ihr groesster Widerspruch:", "Ihre private Ketzerei:").
- Keine erfundene Marotte, die sie merkwuerdig machen soll.
- Der LETZTE Satz jedes Feldes ist eine Tatsache, keine Pointe und kein Vergleich.
- Saetze duerfen lang sein; sie sollen nur nicht alle dasselbe Muster haben.
- Gewoehnliche Register sind erlaubt: eine Beamtin darf in der Sprache der Beamten beschrieben werden.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'agent_generation_partial'
  AND locale = 'de'
  AND position('

STIL (Vorgabe der Plattform, geht allem oben Stehenden vor):
- Hoechstens ein Vergleich oder Bild je Absatz.
- Keine Formel, die die Person zusammenfasst ("Ihr groesster Widerspruch:", "Ihre private Ketzerei:").
- Keine erfundene Marotte, die sie merkwuerdig machen soll.
- Der LETZTE Satz jedes Feldes ist eine Tatsache, keine Pointe und kein Vergleich.
- Saetze duerfen lang sein; sie sollen nur nicht alle dasselbe Muster haben.
- Gewoehnliche Register sind erlaubt: eine Beamtin darf in der Sprache der Beamten beschrieben werden.' in prompt_content) = 0;

-- building_generation (EN) — Boden anhaengen
UPDATE public.prompt_templates
SET prompt_content = prompt_content || '

STYLE (platform requirement, overrides anything above):
- At most one simile or image per paragraph.
- No formula that sums the subject up in a single clause.
- The LAST sentence is a fact, not an epigram and not a comparison.
- Sentences may be long; they should just not all share one shape.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'building_generation'
  AND locale = 'en'
  AND position('

STYLE (platform requirement, overrides anything above):
- At most one simile or image per paragraph.
- No formula that sums the subject up in a single clause.
- The LAST sentence is a fact, not an epigram and not a comparison.
- Sentences may be long; they should just not all share one shape.' in prompt_content) = 0;

-- building_generation (DE) — Boden anhaengen
UPDATE public.prompt_templates
SET prompt_content = prompt_content || '

STIL (Vorgabe der Plattform, geht allem oben Stehenden vor):
- Hoechstens ein Vergleich oder Bild je Absatz.
- Keine Formel, die den Gegenstand in einem Nebensatz zusammenfasst.
- Der LETZTE Satz ist eine Tatsache, keine Pointe und kein Vergleich.
- Saetze duerfen lang sein; sie sollen nur nicht alle dasselbe Muster haben.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'building_generation'
  AND locale = 'de'
  AND position('

STIL (Vorgabe der Plattform, geht allem oben Stehenden vor):
- Hoechstens ein Vergleich oder Bild je Absatz.
- Keine Formel, die den Gegenstand in einem Nebensatz zusammenfasst.
- Der LETZTE Satz ist eine Tatsache, keine Pointe und kein Vergleich.
- Saetze duerfen lang sein; sie sollen nur nicht alle dasselbe Muster haben.' in prompt_content) = 0;

-- building_generation_named (EN) — Boden anhaengen
UPDATE public.prompt_templates
SET prompt_content = prompt_content || '

STYLE (platform requirement, overrides anything above):
- At most one simile or image per paragraph.
- No formula that sums the subject up in a single clause.
- The LAST sentence is a fact, not an epigram and not a comparison.
- Sentences may be long; they should just not all share one shape.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'building_generation_named'
  AND locale = 'en'
  AND position('

STYLE (platform requirement, overrides anything above):
- At most one simile or image per paragraph.
- No formula that sums the subject up in a single clause.
- The LAST sentence is a fact, not an epigram and not a comparison.
- Sentences may be long; they should just not all share one shape.' in prompt_content) = 0;

-- building_generation_named (DE) — Boden anhaengen
UPDATE public.prompt_templates
SET prompt_content = prompt_content || '

STIL (Vorgabe der Plattform, geht allem oben Stehenden vor):
- Hoechstens ein Vergleich oder Bild je Absatz.
- Keine Formel, die den Gegenstand in einem Nebensatz zusammenfasst.
- Der LETZTE Satz ist eine Tatsache, keine Pointe und kein Vergleich.
- Saetze duerfen lang sein; sie sollen nur nicht alle dasselbe Muster haben.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'building_generation_named'
  AND locale = 'de'
  AND position('

STIL (Vorgabe der Plattform, geht allem oben Stehenden vor):
- Hoechstens ein Vergleich oder Bild je Absatz.
- Keine Formel, die den Gegenstand in einem Nebensatz zusammenfasst.
- Der LETZTE Satz ist eine Tatsache, keine Pointe und kein Vergleich.
- Saetze duerfen lang sein; sie sollen nur nicht alle dasselbe Muster haben.' in prompt_content) = 0;

-- event_generation (EN) — Boden anhaengen
UPDATE public.prompt_templates
SET prompt_content = prompt_content || '

STYLE (platform requirement, overrides anything above):
- At most one simile or image per paragraph.
- No formula that sums the subject up in a single clause.
- The LAST sentence is a fact, not an epigram and not a comparison.
- Sentences may be long; they should just not all share one shape.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'event_generation'
  AND locale = 'en'
  AND position('

STYLE (platform requirement, overrides anything above):
- At most one simile or image per paragraph.
- No formula that sums the subject up in a single clause.
- The LAST sentence is a fact, not an epigram and not a comparison.
- Sentences may be long; they should just not all share one shape.' in prompt_content) = 0;

-- event_generation (DE) — Boden anhaengen
UPDATE public.prompt_templates
SET prompt_content = prompt_content || '

STIL (Vorgabe der Plattform, geht allem oben Stehenden vor):
- Hoechstens ein Vergleich oder Bild je Absatz.
- Keine Formel, die den Gegenstand in einem Nebensatz zusammenfasst.
- Der LETZTE Satz ist eine Tatsache, keine Pointe und kein Vergleich.
- Saetze duerfen lang sein; sie sollen nur nicht alle dasselbe Muster haben.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'event_generation'
  AND locale = 'de'
  AND position('

STIL (Vorgabe der Plattform, geht allem oben Stehenden vor):
- Hoechstens ein Vergleich oder Bild je Absatz.
- Keine Formel, die den Gegenstand in einem Nebensatz zusammenfasst.
- Der LETZTE Satz ist eine Tatsache, keine Pointe und kein Vergleich.
- Saetze duerfen lang sein; sie sollen nur nicht alle dasselbe Muster haben.' in prompt_content) = 0;

-- agent_generation_full (EN) — Systemprompt, der das Ornament bestellte
UPDATE public.prompt_templates
SET system_prompt = 'You write character entries for a simulation world. Be concrete: name what a person does, owns, avoids and owes, rather than interpreting what it means. Images and similes are allowed, but at most one per paragraph. Do not sum the character up in a formula, do not invent a signature quirk to make them memorable, and do not end either field on an epigram. Sentences may be long; they should just not all share one shape. Ordinary registers are allowed: a clerk may be described in the language of clerks. Always respond with valid JSON.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'agent_generation_full'
  AND locale = 'en'
  AND system_prompt = 'You are a creative worldbuilder specializing in character creation for simulation worlds. Create rich, believable characters with depth and nuance. Always respond with valid JSON.';

-- agent_generation_full (DE) — Systemprompt, der das Ornament bestellte
UPDATE public.prompt_templates
SET system_prompt = 'Du legst Figuren für eine Simulationswelt an. Schreibe konkret: benenne, was jemand tut, besitzt, meidet und schuldet, statt zu deuten, was das bedeutet. Bilder und Vergleiche sind erlaubt, aber höchstens eines je Absatz. Fasse die Figur nicht in einer Formel zusammen, erfinde keine Marotte, die sie merkwürdig machen soll, und schliesse keines der Felder mit einer Pointe. Sätze dürfen lang sein; sie sollen nur nicht alle dasselbe Muster haben. Gewöhnliche Register sind erlaubt: eine Beamtin darf in der Sprache der Beamten beschrieben werden. Antworte immer mit validem JSON.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'agent_generation_full'
  AND locale = 'de'
  AND system_prompt = 'Du bist ein kreativer Weltenbauer, spezialisiert auf Charaktererstellung für Simulationswelten. Erstelle reichhaltige, glaubwürdige Charaktere mit Tiefe und Nuancen. Antworte immer mit validem JSON.';

-- building_generation (EN) — Systemprompt, der das Ornament bestellte
UPDATE public.prompt_templates
SET system_prompt = 'You are an architectural worldbuilder. Describe a building by its material, its use and its state of repair. Plain sentences; at most one image per description; no closing line.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'building_generation'
  AND locale = 'en'
  AND system_prompt = 'You are an architectural worldbuilder. Create atmospheric building descriptions.';

-- building_generation (DE) — Systemprompt, der das Ornament bestellte
UPDATE public.prompt_templates
SET system_prompt = 'Du bist ein architektonischer Weltenbauer. Beschreibe ein Gebäude über Material, Nutzung und Zustand. Schlichte Sätze; höchstens ein Bild je Beschreibung; keine Schlusspointe.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'building_generation'
  AND locale = 'de'
  AND system_prompt = 'Du bist ein architektonischer Weltenbauer. Erstelle atmosphärische Gebäudebeschreibungen.';

-- building_generation_named (EN) — Systemprompt, der das Ornament bestellte
UPDATE public.prompt_templates
SET system_prompt = 'You are an architectural worldbuilder. Describe a building by its material, its use and its state of repair. Plain sentences; at most one image per description; no closing line.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'building_generation_named'
  AND locale = 'en'
  AND system_prompt = 'You are an architectural worldbuilder. Create atmospheric building descriptions.';

-- building_generation_named (DE) — Systemprompt, der das Ornament bestellte
UPDATE public.prompt_templates
SET system_prompt = 'Du bist ein architektonischer Weltenbauer. Beschreibe ein Gebäude über Material, Nutzung und Zustand. Schlichte Sätze; höchstens ein Bild je Beschreibung; keine Schlusspointe.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'building_generation_named'
  AND locale = 'de'
  AND system_prompt = 'Du bist ein architektonischer Weltenbauer. Erstelle atmosphärische Gebäudebeschreibungen.';

-- event_generation (EN) — Systemprompt, der das Ornament bestellte
UPDATE public.prompt_templates
SET system_prompt = 'You are a narrative events designer. Report an event the way a record does: what happened, to whom, with what consequence. Plain sentences; at most one image; no dramatic closing line.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'event_generation'
  AND locale = 'en'
  AND system_prompt = 'You are a narrative events designer. Create compelling, realistic events for simulation worlds.';

-- event_generation (DE) — Systemprompt, der das Ornament bestellte
UPDATE public.prompt_templates
SET system_prompt = 'Du bist ein narrativer Ereignis-Designer. Berichte ein Ereignis, wie ein Protokoll es tut: was geschah, wem, mit welcher Folge. Schlichte Sätze; höchstens ein Bild; keine pointierte Schlusszeile.'
WHERE simulation_id IS NULL
  AND is_system_default = true
  AND template_type = 'event_generation'
  AND locale = 'de'
  AND system_prompt = 'Du bist ein narrativer Ereignis-Designer. Erstelle fesselnde, realistische Ereignisse für Simulationswelten.';

COMMIT;
