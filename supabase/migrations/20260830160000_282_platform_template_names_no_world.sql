-- Migration 282 — die Plattformvorlage nennt keine einzelne Welt mehr
--
-- WHY
-- ---
-- `agent_generation_full` ist die PLATTFORM-Rueckfallvorlage: sie gilt fuer jede
-- Simulation, die keine eigene Zeile hat. Auf Produktion nennt sie Velgarien
-- namentlich, und zwar an drei Stellen:
--
--   1. "fuer die DYSTOPISCHE Simulation"
--   2. "Velgarien ist ein autoritaerer Staat: totale Kontrolle, Propaganda,
--       Ueberwachung, brutalistische Architektur."
--   3. "description": ... passend zur DYSTOPISCHEN Welt
--
-- Gemessen auf Produktion 2026-08-30: 41 Welten, davon 0 mit einer eigenen
-- `agent_generation_full`-Zeile. ALLE 41 haengen am Rueckfall; vier davon sind
-- Velgarien-Varianten. **37 Welten, die nicht Velgarien sind, bekommen den Satz
-- ueber Velgarien in den Prompt**, sobald ein Redakteur ueber
-- `POST /generation/agent` eine Figur anlegt.
--
-- Ein Amtsbezirk, in dem Beamte aus geloesten Akten gezogen werden, ist nicht
-- dystopisch — er ist grotesk-buerokratisch. Die Vorlage erzaehlt ihm trotzdem
-- von Propaganda und brutalistischer Architektur.
--
-- Dieselbe Fehlerklasse wie die uebrigen Befunde dieses Tages: weltspezifischer
-- Inhalt an einer plattformweiten Stelle. Nur eine Ebene hoeher — nicht ein Wert
-- in einer Welt, sondern eine Welt in einem Wert fuer alle.
--
-- WHAT
-- ----
-- 1. BEWAHREN, nicht loeschen: die vier Velgarien-Simulationen bekommen den
--    heutigen Text als EIGENE Zeile. Genau wofuer `prompt_templates.simulation_id`
--    da ist — Plattform = Boden, Welt = Stil. Der Text wird KOPIERT, nicht
--    abgeschrieben, damit diese Migration nicht an einem Wortlaut haengt, den sie
--    nicht selbst gesetzt hat.
-- 2. Die Plattformzeile bekommt eine weltneutrale Fassung, die die STRUKTUR der
--    heutigen behaelt (Verhaeltnis zu den herrschenden Kraeften je Feld) und nur
--    die drei weltspezifischen Stellen ersetzt. Der Rueckfall auf die aeltere,
--    aermere Seed-Fassung waere der billigere und der schlechtere Weg gewesen.
-- 3. Der angehaengte Stilboden aus 281 bleibt unangetastet: die UPDATEs schneiden
--    an seiner Marke und haengen ihn unveraendert wieder an. 282 haengt damit
--    nicht an 281s Wortlaut.
--
-- Beide Schritte sind bewacht (`ILIKE '%Velgarien%'`): eine Zeile, die den Text
-- nicht mehr traegt, wird nicht angefasst, und ein zweiter Lauf ist ein No-op.
--
-- GESPIEGELT IM SEED
-- ------------------
-- `supabase/seed/006_prompt_templates.sql` traegt dieselbe neutrale Fassung.
-- Ohne das waere diese Migration auf jeder frischen Datenbank wirkungslos — der
-- Seed laeuft NACH den Migrationen und seine INSERTs sind ON CONFLICT DO NOTHING
-- (siehe Migration 027 und den Kopf des Seeds). Bewacht von
-- `scripts/lint-seed-carries-migration-effects.sh`.
--
-- Die drei Epochenklone (`velgarien-e3/-e4/-e5`) legt kein Seed an — sie
-- entstehen zur Laufzeit. Der Seed kann daher nur `velgarien` selbst mit einer
-- eigenen Zeile versorgen; diese Migration versorgt alle vier auf Produktion.

BEGIN;

-- 1. Bewahren: die Velgarien-Welten behalten ihren Rahmen, als eigene Zeile.
INSERT INTO public.prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
)
SELECT s.id, p.template_type, p.prompt_category, p.locale,
       s.name || ' Agent Generation (' || upper(p.locale) || ')',
       p.prompt_content, p.system_prompt, p.variables, p.default_model,
       p.temperature, p.max_tokens, false, p.created_by_id
FROM public.prompt_templates p
CROSS JOIN public.simulations s
WHERE p.simulation_id IS NULL
  AND p.template_type = 'agent_generation_full'
  AND (p.prompt_content ILIKE '%Velgarien%' OR p.system_prompt ILIKE '%Velgarien%')
  AND s.slug IN ('velgarien', 'velgarien-e3', 'velgarien-e4', 'velgarien-e5')
ON CONFLICT DO NOTHING;

-- 2. Die Plattformzeile wird weltneutral.

-- EN: neutralisieren, den angehaengten Stilboden unangetastet lassen.
UPDATE public.prompt_templates
SET prompt_content = 'Create a detailed character for the simulation "{simulation_name}".
Name: {agent_name}
System/Faction: {agent_system}
Gender: {agent_gender}
The character is shaped by the conditions of this world: they uphold them, quietly resist them, or have been broken by them.
Generate the following fields as a JSON object:
- "character": Personality, motivations, relationship to the powers that hold this world (200-300 words)
- "background": History, origin, key experiences under these conditions (200-300 words)
- "description": Brief physical description (1 sentence, fitting this world)
The character should fit the {agent_system} faction.
Respond in {locale_name}.' || CASE
        WHEN position('

STYLE (platform requirement' in prompt_content) > 0
        THEN substring(prompt_content from position('

STYLE (platform requirement' in prompt_content))
        ELSE ''
    END,
    system_prompt = 'You write character entries for a simulation world. Be concrete: name what a person does, owns, avoids and owes, rather than interpreting what it means. Images and similes are allowed, but at most one per paragraph. Do not sum the character up in a formula, do not invent a signature quirk to make them memorable, and do not end either field on an epigram. Sentences may be long; they should just not all share one shape. Ordinary registers are allowed: a clerk may be described in the language of clerks. Always respond with valid JSON.',
    updated_at = now()
WHERE simulation_id IS NULL
  AND template_type = 'agent_generation_full'
  AND locale = 'en'
  AND (prompt_content ILIKE '%Velgarien%' OR system_prompt ILIKE '%Velgarien%');

-- DE: neutralisieren, den angehaengten Stilboden unangetastet lassen.
UPDATE public.prompt_templates
SET prompt_content = 'Erstelle einen detaillierten Charakter für die Simulation "{simulation_name}".
Name: {agent_name}
System/Fraktion: {agent_system}
Geschlecht: {agent_gender}
Die Figur ist von den Verhältnissen dieser Welt geprägt: sie trägt sie mit, stellt sich ihnen leise entgegen, oder ist an ihnen zerbrochen.
Generiere folgende Felder als JSON-Objekt:
- "character": Persönlichkeit, Motivationen, Verhältnis zu den herrschenden Kräften (200-300 Wörter)
- "background": Geschichte, Herkunft, Schlüsselerlebnisse unter diesen Verhältnissen (200-300 Wörter)
- "description": Kurze physische Beschreibung (1 Satz, passend zu dieser Welt)
Der Charakter sollte zur Fraktion {agent_system} passen.
Antworte auf {locale_name}.' || CASE
        WHEN position('

STIL (Vorgabe der Plattform' in prompt_content) > 0
        THEN substring(prompt_content from position('

STIL (Vorgabe der Plattform' in prompt_content))
        ELSE ''
    END,
    system_prompt = 'Du legst Figuren für eine Simulationswelt an. Schreibe konkret: benenne, was jemand tut, besitzt, meidet und schuldet, statt zu deuten, was das bedeutet. Bilder und Vergleiche sind erlaubt, aber höchstens eines je Absatz. Fasse die Figur nicht in einer Formel zusammen, erfinde keine Marotte, die sie merkwürdig machen soll, und schliesse keines der Felder mit einer Pointe. Sätze dürfen lang sein; sie sollen nur nicht alle dasselbe Muster haben. Gewöhnliche Register sind erlaubt: eine Beamtin darf in der Sprache der Beamten beschrieben werden. Antworte immer mit validem JSON.',
    updated_at = now()
WHERE simulation_id IS NULL
  AND template_type = 'agent_generation_full'
  AND locale = 'de'
  AND (prompt_content ILIKE '%Velgarien%' OR system_prompt ILIKE '%Velgarien%');

COMMIT;
