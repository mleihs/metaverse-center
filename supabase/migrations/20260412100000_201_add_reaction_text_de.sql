-- Migration 201: Add bilingual support for event reactions
--
-- Follows the field/field_de pattern used by agents (character/character_de)
-- and lore sections. Base field = English, _de = German.
--
-- Existing reactions for German simulations have German text in reaction_text
-- (the English column). This migration copies it to reaction_text_de so the
-- t() locale helper can pick the correct language. The base reaction_text is
-- kept as-is for English fallback until proper translations are generated.

ALTER TABLE public.event_reactions
  ADD COLUMN IF NOT EXISTS reaction_text_de text;

-- Copy existing German reaction text to the _de column for German simulations.
-- This preserves the German content while the base field serves as English fallback.
UPDATE public.event_reactions er
SET reaction_text_de = er.reaction_text
FROM public.simulations s
WHERE er.simulation_id = s.id
  AND s.content_locale = 'de'
  AND er.reaction_text IS NOT NULL
  AND er.reaction_text_de IS NULL;

COMMENT ON COLUMN public.event_reactions.reaction_text IS 'Reaction text in English (base locale)';
COMMENT ON COLUMN public.event_reactions.reaction_text_de IS 'Reaction text in German (de locale)';
