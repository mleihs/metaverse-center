-- =============================================================================
-- SEED 006: Platform-Default Prompt Templates
-- =============================================================================
-- 22 prompt templates × 2 locales (DE + EN) = 44 platform defaults.
-- Plus 7 mock template categories for testing/development.
--
-- simulation_id IS NULL = Platform default (used by all simulations via fallback).
-- Simulations can override any template by creating their own with the same
-- template_type + locale combination.
--
-- Source specs:
--   - 09_AI_INTEGRATION.md §Prompt-Templates
--   - 14_I18N_ARCHITECTURE.md §Layer 3: AI Prompts
-- =============================================================================

DO $$
DECLARE
    admin_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN

-- =============================================================================
-- CORE GENERATION TEMPLATES (7 types × 2 locales = 14)
-- =============================================================================

-- 1. agent_generation_full (EN)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'agent_generation_full', 'generation', 'en', 'Full Agent Generation (EN)',
    'Create a detailed character for the simulation "{simulation_name}".

Name: {agent_name}
System/Faction: {agent_system}
Gender: {agent_gender}

Generate the following fields as a JSON object:
- "character": A paragraph describing personality, traits, motivations (200-300 words)
- "background": A paragraph describing history, origin, key life events (200-300 words)
- "description": A brief one-line physical description

The character should fit the {agent_system} faction and the overall tone of {simulation_name}.
Respond in {locale_name}.',
    'You are a creative worldbuilder specializing in character creation for simulation worlds. '
    || 'Create rich, believable characters with depth and nuance. '
    || 'Always respond with valid JSON.',
    '[{"name": "simulation_name"}, {"name": "agent_name"}, {"name": "agent_system"}, {"name": "agent_gender"}, {"name": "locale_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.8, 800, true, admin_id
) ON CONFLICT DO NOTHING;

-- 1. agent_generation_full (DE)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'agent_generation_full', 'generation', 'de', 'Vollständige Agenten-Generierung (DE)',
    'Erstelle einen detaillierten Charakter für die Simulation "{simulation_name}".

Name: {agent_name}
System/Fraktion: {agent_system}
Geschlecht: {agent_gender}

Generiere folgende Felder als JSON-Objekt:
- "character": Ein Absatz über Persönlichkeit, Eigenschaften, Motivationen (200-300 Wörter)
- "background": Ein Absatz über Geschichte, Herkunft, Schlüsselerlebnisse (200-300 Wörter)
- "description": Eine kurze einzeilige physische Beschreibung

Der Charakter sollte zur Fraktion {agent_system} und zum Grundton von {simulation_name} passen.
Antworte auf {locale_name}.',
    'Du bist ein kreativer Weltenbauer, spezialisiert auf Charaktererstellung für Simulationswelten. '
    || 'Erstelle reichhaltige, glaubwürdige Charaktere mit Tiefe und Nuancen. '
    || 'Antworte immer mit validem JSON.',
    '[{"name": "simulation_name"}, {"name": "agent_name"}, {"name": "agent_system"}, {"name": "agent_gender"}, {"name": "locale_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.8, 800, true, admin_id
) ON CONFLICT DO NOTHING;

-- 2. agent_generation_partial (EN)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'agent_generation_partial', 'generation', 'en', 'Partial Agent Generation (EN)',
    'Complete the character profile for "{agent_name}" in "{simulation_name}".

Existing data:
{existing_data}

Fill in any missing fields while staying consistent with the existing data.
Return a JSON object with only the newly generated fields.
Respond in {locale_name}.',
    'You are a creative worldbuilder. Complete missing character details while maintaining consistency.',
    '[{"name": "simulation_name"}, {"name": "agent_name"}, {"name": "existing_data"}, {"name": "locale_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.7, 500, true, admin_id
) ON CONFLICT DO NOTHING;

-- 2. agent_generation_partial (DE)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'agent_generation_partial', 'generation', 'de', 'Teilweise Agenten-Generierung (DE)',
    'Vervollständige das Charakterprofil von "{agent_name}" in "{simulation_name}".

Vorhandene Daten:
{existing_data}

Fülle fehlende Felder aus und bleibe dabei konsistent mit den vorhandenen Daten.
Gib ein JSON-Objekt mit nur den neu generierten Feldern zurück.
Antworte auf {locale_name}.',
    'Du bist ein kreativer Weltenbauer. Vervollständige fehlende Charakterdetails unter Beibehaltung der Konsistenz.',
    '[{"name": "simulation_name"}, {"name": "agent_name"}, {"name": "existing_data"}, {"name": "locale_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.7, 500, true, admin_id
) ON CONFLICT DO NOTHING;

-- 3. building_generation (EN)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'building_generation', 'generation', 'en', 'Building Generation (EN)',
    'Describe a {building_type} building for the simulation "{simulation_name}".

Generate a JSON object with:
- "name": A fitting name for this building
- "description": Detailed description of the building (150-250 words)
- "building_condition": One of: excellent, good, fair, poor, ruined

Respond in {locale_name}.',
    'You are an architectural worldbuilder. Create atmospheric building descriptions.',
    '[{"name": "simulation_name"}, {"name": "building_type"}, {"name": "locale_name"}]',
    'meta-llama/llama-3.3-70b-instruct:free', 0.7, 400, true, admin_id
) ON CONFLICT DO NOTHING;

-- 3. building_generation (DE)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'building_generation', 'generation', 'de', 'Gebäude-Generierung (DE)',
    'Beschreibe ein Gebäude vom Typ {building_type} für die Simulation "{simulation_name}".

Generiere ein JSON-Objekt mit:
- "name": Ein passender Name für dieses Gebäude
- "description": Detaillierte Beschreibung des Gebäudes (150-250 Wörter)
- "building_condition": Eines von: excellent, good, fair, poor, ruined

Antworte auf {locale_name}.',
    'Du bist ein architektonischer Weltenbauer. Erstelle atmosphärische Gebäudebeschreibungen.',
    '[{"name": "simulation_name"}, {"name": "building_type"}, {"name": "locale_name"}]',
    'meta-llama/llama-3.3-70b-instruct:free', 0.7, 400, true, admin_id
) ON CONFLICT DO NOTHING;

-- 4. building_generation_named (EN)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'building_generation_named', 'generation', 'en', 'Named Building Generation (EN)',
    'Describe the building "{building_name}" (type: {building_type}) for "{simulation_name}".

Generate a JSON object with:
- "description": Detailed description (150-250 words)
- "building_condition": One of: excellent, good, fair, poor, ruined

Respond in {locale_name}.',
    'You are an architectural worldbuilder. Create atmospheric building descriptions.',
    '[{"name": "simulation_name"}, {"name": "building_name"}, {"name": "building_type"}, {"name": "locale_name"}]',
    'meta-llama/llama-3.3-70b-instruct:free', 0.7, 400, true, admin_id
) ON CONFLICT DO NOTHING;

-- 4. building_generation_named (DE)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'building_generation_named', 'generation', 'de', 'Benanntes Gebäude-Generierung (DE)',
    'Beschreibe das Gebäude "{building_name}" (Typ: {building_type}) für "{simulation_name}".

Generiere ein JSON-Objekt mit:
- "description": Detaillierte Beschreibung (150-250 Wörter)
- "building_condition": Eines von: excellent, good, fair, poor, ruined

Antworte auf {locale_name}.',
    'Du bist ein architektonischer Weltenbauer. Erstelle atmosphärische Gebäudebeschreibungen.',
    '[{"name": "simulation_name"}, {"name": "building_name"}, {"name": "building_type"}, {"name": "locale_name"}]',
    'meta-llama/llama-3.3-70b-instruct:free', 0.7, 400, true, admin_id
) ON CONFLICT DO NOTHING;

-- 5. portrait_description (EN only — SD expects English)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, negative_prompt, is_system_default, created_by_id
) VALUES (
    NULL, 'portrait_description', 'generation', 'en', 'Portrait Description (EN)',
    'Describe a photorealistic portrait of {agent_name}.

Character traits: {agent_character}
Background: {agent_background}

Describe in detail: age, ethnicity, facial features, expression, hairstyle, clothing, lighting, mood.
Write as a Stable Diffusion prompt — comma-separated descriptors, no sentences.
Example: "middle-aged man, sharp features, grey temples, stern expression, military uniform, dramatic lighting"',
    'You are a portrait description specialist for AI image generation. Write concise, visual descriptors.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 200,
    'cartoon, anime, illustration, distorted, deformed, ugly, blurry, low quality, text, watermark',
    true, admin_id
) ON CONFLICT DO NOTHING;

-- 5. portrait_description (DE — still generates English output for SD)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, negative_prompt, is_system_default, created_by_id
) VALUES (
    NULL, 'portrait_description', 'generation', 'de', 'Portrait-Beschreibung (DE)',
    'Beschreibe ein fotorealistisches Portrait von {agent_name}.

Charaktereigenschaften: {agent_character}
Hintergrund: {agent_background}

Beschreibe detailliert: Alter, Ethnie, Gesichtszüge, Ausdruck, Frisur, Kleidung, Beleuchtung, Stimmung.
Schreibe als Stable-Diffusion-Prompt — kommagetrennte Deskriptoren, keine Sätze.
WICHTIG: Schreibe die Beschreibung auf ENGLISCH (für die Bildgenerierung).',
    'Du bist ein Portrait-Beschreibungs-Spezialist für KI-Bildgenerierung. Schreibe prägnante, visuelle Deskriptoren auf Englisch.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 200,
    'cartoon, anime, illustration, distorted, deformed, ugly, blurry, low quality, text, watermark',
    true, admin_id
) ON CONFLICT DO NOTHING;

-- 6. event_generation (EN)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'event_generation', 'generation', 'en', 'Event Generation (EN)',
    'Create an event of type "{event_type}" for the simulation "{simulation_name}".

Generate a JSON object with:
- "title": Event headline (max 255 chars)
- "description": Detailed event description (200-400 words)
- "impact_level": 1-10
- "urgency_level": One of: low, medium, high, critical

Respond in {locale_name}.',
    'You are a narrative events designer. Create compelling, realistic events for simulation worlds.',
    '[{"name": "simulation_name"}, {"name": "event_type"}, {"name": "locale_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.8, 600, true, admin_id
) ON CONFLICT DO NOTHING;

-- 6. event_generation (DE)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'event_generation', 'generation', 'de', 'Ereignis-Generierung (DE)',
    'Erstelle ein Ereignis vom Typ "{event_type}" für die Simulation "{simulation_name}".

Generiere ein JSON-Objekt mit:
- "title": Ereignis-Überschrift (max 255 Zeichen)
- "description": Detaillierte Ereignisbeschreibung (200-400 Wörter)
- "impact_level": 1-10
- "urgency_level": Eines von: low, medium, high, critical

Antworte auf {locale_name}.',
    'Du bist ein narrativer Ereignis-Designer. Erstelle fesselnde, realistische Ereignisse für Simulationswelten.',
    '[{"name": "simulation_name"}, {"name": "event_type"}, {"name": "locale_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.8, 600, true, admin_id
) ON CONFLICT DO NOTHING;

-- 7. user_agent_description (EN)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'user_agent_description', 'generation', 'en', 'User Agent Description (EN)',
    'Describe the user''s agent character based on their preferences.

Name: {agent_name}
Preferred system: {agent_system}

Generate a brief character and background in 2-3 sentences each.
Respond in {locale_name}.',
    'You are a character creation assistant. Help users create their own simulation characters.',
    '[{"name": "agent_name"}, {"name": "agent_system"}, {"name": "locale_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.7, 300, true, admin_id
) ON CONFLICT DO NOTHING;

-- 7. user_agent_description (DE)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'user_agent_description', 'generation', 'de', 'Benutzer-Agenten-Beschreibung (DE)',
    'Beschreibe den Agenten-Charakter des Benutzers basierend auf seinen Präferenzen.

Name: {agent_name}
Bevorzugtes System: {agent_system}

Generiere einen kurzen Charakter und Hintergrund in je 2-3 Sätzen.
Antworte auf {locale_name}.',
    'Du bist ein Charaktererstellungs-Assistent. Hilf Benutzern, ihre eigenen Simulationscharaktere zu erstellen.',
    '[{"name": "agent_name"}, {"name": "agent_system"}, {"name": "locale_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.7, 300, true, admin_id
) ON CONFLICT DO NOTHING;


-- =============================================================================
-- CHAT TEMPLATES (2 types × 2 locales = 4)
-- =============================================================================

-- 8. chat_system_prompt (EN)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'chat_system_prompt', 'chat', 'en', 'Chat System Prompt (EN)',
    'You are {agent_name}, a character in the simulation "{simulation_name}".

Your personality: {agent_character}
Your background: {agent_background}

Stay in character at all times. Respond naturally as this character would.
Never break character or acknowledge being an AI.
Respond in {locale_name}.',
    NULL,
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}, {"name": "simulation_name"}, {"name": "locale_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.8, 500, true, admin_id
) ON CONFLICT DO NOTHING;

-- 8. chat_system_prompt (DE)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'chat_system_prompt', 'chat', 'de', 'Chat-Systemprompt (DE)',
    'Du bist {agent_name}, ein Charakter in der Simulation "{simulation_name}".

Deine Persönlichkeit: {agent_character}
Dein Hintergrund: {agent_background}

Bleibe jederzeit in der Rolle. Antworte natürlich, wie dieser Charakter es tun würde.
Brich niemals die Rolle und gib nie zu, eine KI zu sein.
Antworte auf {locale_name}.',
    NULL,
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}, {"name": "simulation_name"}, {"name": "locale_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.8, 500, true, admin_id
) ON CONFLICT DO NOTHING;

-- 9. chat_with_memory (EN)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'chat_with_memory', 'chat', 'en', 'Chat with Memory (EN)',
    'Continue the conversation as {agent_name}. Consider the conversation history.
Respond in {locale_name}.',
    'You are {agent_name} in "{simulation_name}". Character: {agent_character}. Background: {agent_background}. '
    || 'Stay in character. Use conversation context to maintain continuity.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}, {"name": "simulation_name"}, {"name": "locale_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.8, 500, true, admin_id
) ON CONFLICT DO NOTHING;

-- 9. chat_with_memory (DE)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'chat_with_memory', 'chat', 'de', 'Chat mit Gedächtnis (DE)',
    'Setze das Gespräch als {agent_name} fort. Berücksichtige den Gesprächsverlauf.
Antworte auf {locale_name}.',
    'Du bist {agent_name} in "{simulation_name}". Charakter: {agent_character}. Hintergrund: {agent_background}. '
    || 'Bleibe in der Rolle. Nutze den Gesprächskontext für Kontinuität.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}, {"name": "simulation_name"}, {"name": "locale_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.8, 500, true, admin_id
) ON CONFLICT DO NOTHING;


-- =============================================================================
-- NEWS + SOCIAL TEMPLATES (6 types × 2 locales = 12)
-- =============================================================================

-- 10. agent_reactions (EN)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'agent_reactions', 'social', 'en', 'Agent Reactions (EN)',
    'Generate {agent_name}''s reaction to the following event:

Event: {event_title}
Description: {event_description}

Agent''s personality: {agent_character}
Agent''s faction: {agent_system}

Write a brief reaction (2-4 sentences) that reflects their character and faction perspective.
Respond in {locale_name}.',
    'You are generating in-character reactions for simulation agents.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_system"}, {"name": "event_title"}, {"name": "event_description"}, {"name": "locale_name"}]',
    'meta-llama/llama-3.3-70b-instruct:free', 0.7, 200, true, admin_id
) ON CONFLICT DO NOTHING;

-- 10. agent_reactions (DE)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'agent_reactions', 'social', 'de', 'Agenten-Reaktionen (DE)',
    'Generiere die Reaktion von {agent_name} auf folgendes Ereignis:

Ereignis: {event_title}
Beschreibung: {event_description}

Persönlichkeit des Agenten: {agent_character}
Fraktion des Agenten: {agent_system}

Schreibe eine kurze Reaktion (2-4 Sätze), die den Charakter und die Fraktionsperspektive widerspiegelt.
Antworte auf {locale_name}.',
    'Du generierst rollengerechte Reaktionen für Simulationsagenten.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_system"}, {"name": "event_title"}, {"name": "event_description"}, {"name": "locale_name"}]',
    'meta-llama/llama-3.3-70b-instruct:free', 0.7, 200, true, admin_id
) ON CONFLICT DO NOTHING;

-- 11. news_transformation (EN)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'news_transformation', 'social', 'en', 'News Transformation (EN)',
    'Transform this real-world news article into the narrative of "{simulation_name}":

Title: {news_title}
Content: {news_content}

Rewrite the article as if it happened in the simulation world.
Maintain the core facts but adapt names, places, and context.
Generate a JSON object with: "title", "description", "event_type", "impact_level" (1-10).
Respond in {locale_name}.',
    'You are a narrative journalist in a simulation world.',
    '[{"name": "simulation_name"}, {"name": "news_title"}, {"name": "news_content"}, {"name": "locale_name"}]',
    'meta-llama/llama-3.2-3b-instruct:free', 0.8, 400, true, admin_id
) ON CONFLICT DO NOTHING;

-- 11. news_transformation (DE)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'news_transformation', 'social', 'de', 'Nachrichten-Transformation (DE)',
    'Transformiere diesen realen Nachrichtenartikel in die Erzählung von "{simulation_name}":

Titel: {news_title}
Inhalt: {news_content}

Schreibe den Artikel um, als ob er in der Simulationswelt stattgefunden hätte.
Behalte die Kernfakten bei, passe aber Namen, Orte und Kontext an.
Generiere ein JSON-Objekt mit: "title", "description", "event_type", "impact_level" (1-10).
Antworte auf {locale_name}.',
    'Du bist ein narrativer Journalist in einer Simulationswelt.',
    '[{"name": "simulation_name"}, {"name": "news_title"}, {"name": "news_content"}, {"name": "locale_name"}]',
    'meta-llama/llama-3.2-3b-instruct:free', 0.8, 400, true, admin_id
) ON CONFLICT DO NOTHING;

-- 12. news_agent_reaction (EN)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'news_agent_reaction', 'social', 'en', 'News Agent Reaction (EN)',
    'Generate {agent_name}''s reaction to this transformed news event:

Event: {event_title}
Description: {event_description}

Character: {agent_character}
System: {agent_system}

Write a brief in-character reaction (2-3 sentences). Respond in {locale_name}.',
    'Generate in-character agent reactions to news events.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_system"}, {"name": "event_title"}, {"name": "event_description"}, {"name": "locale_name"}]',
    'meta-llama/llama-3.3-70b-instruct:free', 0.7, 150, true, admin_id
) ON CONFLICT DO NOTHING;

-- 12. news_agent_reaction (DE)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'news_agent_reaction', 'social', 'de', 'Nachrichten-Agenten-Reaktion (DE)',
    'Generiere die Reaktion von {agent_name} auf dieses transformierte Nachrichtenereignis:

Ereignis: {event_title}
Beschreibung: {event_description}

Charakter: {agent_character}
System: {agent_system}

Schreibe eine kurze rollengerechte Reaktion (2-3 Sätze). Antworte auf {locale_name}.',
    'Generiere rollengerechte Agenten-Reaktionen auf Nachrichtenereignisse.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_system"}, {"name": "event_title"}, {"name": "event_description"}, {"name": "locale_name"}]',
    'meta-llama/llama-3.3-70b-instruct:free', 0.7, 150, true, admin_id
) ON CONFLICT DO NOTHING;

-- 13. social_trends_campaign (EN)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'social_trends_campaign', 'social', 'en', 'Social Trends Campaign (EN)',
    'Create a propaganda campaign based on this social trend in "{simulation_name}":

Trend: {trend_title}
Description: {trend_description}

Generate a JSON object with:
- "title": Campaign name
- "description": Campaign strategy (100-200 words)
- "campaign_type": One of: surveillance, control, distraction, loyalty, productivity, conformity
- "target_demographic": One of: education, workers, health-conscious, general

Respond in {locale_name}.',
    'You are a propaganda strategist in a simulation world.',
    '[{"name": "simulation_name"}, {"name": "trend_title"}, {"name": "trend_description"}, {"name": "locale_name"}]',
    'meta-llama/llama-3.3-70b-instruct:free', 0.8, 400, true, admin_id
) ON CONFLICT DO NOTHING;

-- 13. social_trends_campaign (DE)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'social_trends_campaign', 'social', 'de', 'Soziale-Trends-Kampagne (DE)',
    'Erstelle eine Propagandakampagne basierend auf diesem sozialen Trend in "{simulation_name}":

Trend: {trend_title}
Beschreibung: {trend_description}

Generiere ein JSON-Objekt mit:
- "title": Kampagnenname
- "description": Kampagnenstrategie (100-200 Wörter)
- "campaign_type": Eines von: surveillance, control, distraction, loyalty, productivity, conformity
- "target_demographic": Eines von: education, workers, health-conscious, general

Antworte auf {locale_name}.',
    'Du bist ein Propaganda-Stratege in einer Simulationswelt.',
    '[{"name": "simulation_name"}, {"name": "trend_title"}, {"name": "trend_description"}, {"name": "locale_name"}]',
    'meta-llama/llama-3.3-70b-instruct:free', 0.8, 400, true, admin_id
) ON CONFLICT DO NOTHING;

-- 14. social_media_transform_dystopian (EN)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'social_media_transform_dystopian', 'social', 'en', 'Social Media Dystopian Transform (EN)',
    'Transform this social media post into a dystopian propaganda version for "{simulation_name}":

Original post: {post_content}

Rewrite as state-controlled media would present it. Add surveillance and control undertones.
Respond in {locale_name}.',
    'You are a state media editor in a dystopian simulation.',
    '[{"name": "simulation_name"}, {"name": "post_content"}, {"name": "locale_name"}]',
    'meta-llama/llama-3.3-70b-instruct:free', 0.8, 300, true, admin_id
) ON CONFLICT DO NOTHING;

-- 14. social_media_transform_dystopian (DE)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'social_media_transform_dystopian', 'social', 'de', 'Social-Media Dystopische Transformation (DE)',
    'Transformiere diesen Social-Media-Post in eine dystopische Propagandaversion für "{simulation_name}":

Originalpost: {post_content}

Schreibe um, wie staatlich kontrollierte Medien es präsentieren würden. Füge Überwachungs- und Kontrolltöne hinzu.
Antworte auf {locale_name}.',
    'Du bist ein Redakteur staatlicher Medien in einer dystopischen Simulation.',
    '[{"name": "simulation_name"}, {"name": "post_content"}, {"name": "locale_name"}]',
    'meta-llama/llama-3.3-70b-instruct:free', 0.8, 300, true, admin_id
) ON CONFLICT DO NOTHING;

-- 15. social_media_sentiment (EN)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'social_media_sentiment', 'social', 'en', 'Social Media Sentiment Analysis (EN)',
    'Analyze the sentiment of this social media post:

Post: {post_content}

Return a JSON object with:
- "sentiment": One of: positive, negative, neutral, mixed
- "confidence": 0.0-1.0
- "summary": Brief explanation (1-2 sentences)',
    'You are a sentiment analysis expert.',
    '[{"name": "post_content"}]',
    'meta-llama/llama-3.2-3b-instruct:free', 0.3, 150, true, admin_id
) ON CONFLICT DO NOTHING;

-- 15. social_media_sentiment (DE)
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    NULL, 'social_media_sentiment', 'social', 'de', 'Social-Media Sentimentanalyse (DE)',
    'Analysiere das Sentiment dieses Social-Media-Posts:

Post: {post_content}

Gib ein JSON-Objekt zurück mit:
- "sentiment": Eines von: positive, negative, neutral, mixed
- "confidence": 0.0-1.0
- "summary": Kurze Erklärung (1-2 Sätze)',
    'Du bist ein Experte für Sentimentanalyse.',
    '[{"name": "post_content"}]',
    'meta-llama/llama-3.2-3b-instruct:free', 0.3, 150, true, admin_id
) ON CONFLICT DO NOTHING;

RAISE NOTICE 'Inserted 30 platform-default prompt templates (15 types × 2 locales)';

END;
$$;

-- =============================================================================
-- Verification
-- =============================================================================
SELECT
    locale,
    prompt_category,
    count(*) as template_count
FROM prompt_templates
WHERE simulation_id IS NULL
GROUP BY locale, prompt_category
ORDER BY locale, prompt_category;
