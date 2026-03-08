-- =============================================================================
-- Migration 082: Seed resonance_transformation prompt templates (EN + DE)
-- =============================================================================
-- These templates were missing, causing the LLM to receive only a bare
-- "Generate content for resonance_transformation" fallback prompt, which
-- produced essay-style output instead of in-world narrative events.
-- =============================================================================

DO $$
DECLARE
    admin_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN

-- resonance_transformation (EN)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'resonance_transformation', 'social', 'en', 'Resonance Transformation (EN)',
    'Transform this substrate resonance into an in-world event for "{simulation_name}".

Resonance: {resonance_title}
{resonance_description}

Archetype: {archetype_name} — {archetype_description}
Event type: {event_type}
Magnitude: {magnitude}/10

Write the event AS IF it is happening inside the simulation world.
The archetype is metaphorical context, NOT the event itself.
Do NOT write an essay or explanation — write a narrative event report.

Generate a JSON object:
- "title": Compelling event headline (max 120 chars)
- "description": Vivid narrative description (150-300 words) grounded in the simulation world
- "impact_level": 1-10

Respond in {locale_name}.',
    'You are a world-building narrator. You report events as in-world occurrences, never as meta-commentary or essays.',
    '[{"name": "simulation_name"}, {"name": "resonance_title"}, {"name": "resonance_description"}, {"name": "archetype_name"}, {"name": "archetype_description"}, {"name": "event_type"}, {"name": "magnitude"}, {"name": "locale_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.8, 600, true, admin_id
) ON CONFLICT DO NOTHING;

-- resonance_transformation (DE)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'resonance_transformation', 'social', 'de', 'Resonanz-Transformation (DE)',
    'Transformiere diese Substrat-Resonanz in ein Weltereignis für "{simulation_name}".

Resonanz: {resonance_title}
{resonance_description}

Archetyp: {archetype_name} — {archetype_description}
Ereignistyp: {event_type}
Magnitude: {magnitude}/10

Schreibe das Ereignis SO, ALS OB es in der Simulationswelt passiert.
Der Archetyp ist metaphorischer Kontext, NICHT das Ereignis selbst.
Schreibe KEINEN Aufsatz oder keine Erklärung — schreibe einen narrativen Ereignisbericht.

Generiere ein JSON-Objekt:
- "title": Packende Ereignis-Schlagzeile (max 120 Zeichen)
- "description": Lebendige narrative Beschreibung (150-300 Wörter), verankert in der Simulationswelt
- "impact_level": 1-10

Antworte auf {locale_name}.',
    'Du bist ein Weltenbau-Erzähler. Du berichtest über Ereignisse als Geschehnisse in der Welt, niemals als Meta-Kommentar oder Aufsätze.',
    '[{"name": "simulation_name"}, {"name": "resonance_title"}, {"name": "resonance_description"}, {"name": "archetype_name"}, {"name": "archetype_description"}, {"name": "event_type"}, {"name": "magnitude"}, {"name": "locale_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.8, 600, true, admin_id
) ON CONFLICT DO NOTHING;

END $$;
