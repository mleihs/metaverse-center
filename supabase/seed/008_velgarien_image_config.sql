-- =============================================================================
-- SEED 008: Velgarien-Specific Image Generation Configuration
-- =============================================================================
-- Configures Flux Dev model + strong brutalist style prompts + enhanced templates
-- for the Velgarien simulation ONLY. Other simulations use platform defaults.
--
-- This is Velgarien-specific — the platform-wide infrastructure (Flux support,
-- style prompt system, LoRA) lives in the Python code and platform-default seeds.
-- =============================================================================

DO $$
DECLARE
    sim_id uuid := '10000000-0000-0000-0000-000000000001';
    admin_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN

-- ============================================================================
-- SIMULATION SETTINGS: Flux Dev + Brutalist Style
-- ============================================================================

-- Image model: Flux Dev for agent portraits
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_model_agent_portrait', '"black-forest-labs/flux-dev"')
ON CONFLICT DO NOTHING;

-- Image model: Flux Dev for building images
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_model_building_image', '"black-forest-labs/flux-dev"')
ON CONFLICT DO NOTHING;

-- Flux-appropriate guidance (lower than SD default of 7.5)
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_guidance_scale', '3.5')
ON CONFLICT DO NOTHING;

-- Flux-appropriate inference steps
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_num_inference_steps', '28')
ON CONFLICT DO NOTHING;

-- Strong brutalist style prompt for portraits
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_style_prompt_portrait',
    '"dark brutalist photograph, concrete and shadow, heavily desaturated palette, harsh directional lighting with deep shadows, dystopian atmosphere, industrial setting, cinematic film grain, high contrast, single subject, photorealistic, not illustration, not cartoon, not anime, not bright colors"')
ON CONFLICT DO NOTHING;

-- Strong brutalist style prompt for buildings
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_style_prompt_building',
    '"architectural photograph, brutalist dystopian style, raw concrete and weathered steel, dramatic harsh lighting, imposing monolithic structure, photorealistic, high detail, cinematic composition, heavily desaturated palette, overcast oppressive sky, industrial decay, not bright colors, not cheerful, not utopian"')
ON CONFLICT DO NOTHING;


-- ============================================================================
-- VELGARIEN-SCOPED PROMPT TEMPLATES (override platform defaults for this sim)
-- ============================================================================

-- Velgarien portrait description (EN) — strong brutalist aesthetic
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    sim_id, 'portrait_description', 'generation', 'en',
    'Velgarien Portrait Description (EN)',
    'Describe a photorealistic head-and-shoulders portrait of a SINGLE person: {agent_name}.

Character traits: {agent_character}
Background: {agent_background}

AESTHETIC: Dark, moody, brutalist atmosphere. Desaturated color palette — grays,
muted earth tones, cold blues. Harsh directional lighting with deep shadows.
Concrete or industrial background. The mood should feel dystopian and imposing.
Think film noir meets brutalist architecture photography.

COMPOSITION: Close-up head-and-shoulders portrait, single subject centered,
shallow depth of field, dramatic side lighting with deep shadows.
Describe: age, ethnicity, facial features, expression, hairstyle,
clothing visible at shoulders, lighting, mood.
Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: Describe only ONE person.
IMPORTANT: Always include: desaturated, harsh lighting, dark mood, concrete, high contrast, cinematic.',
    'You are a portrait description specialist for AI image generation. Write concise, visual descriptors for a single person portrait in a dark, brutalist, dystopian aesthetic.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 200, false, admin_id
) ON CONFLICT DO NOTHING;

-- Velgarien portrait description (DE) — German instructions, English output
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    sim_id, 'portrait_description', 'generation', 'de',
    'Velgarien Portrait-Beschreibung (DE)',
    'Beschreibe ein fotorealistisches Kopf-und-Schulter-Portrait einer EINZELNEN Person: {agent_name}.

Charaktereigenschaften: {agent_character}
Hintergrund: {agent_background}

ÄSTHETIK: Dunkle, düstere, brutalistische Atmosphäre. Entsättigte Farbpalette — Grautöne,
gedämpfte Erdtöne, kalte Blautöne. Hartes gerichtetes Licht mit tiefen Schatten.
Beton- oder Industriehintergrund. Die Stimmung soll dystopisch und imposant wirken.
Denke an Film Noir trifft brutalistische Architekturfotografie.

KOMPOSITION: Nahaufnahme Kopf-und-Schulter-Portrait, einzelne Person zentriert,
geringe Tiefenschärfe, dramatische Seitenbeleuchtung mit tiefen Schatten.
Beschreibe: Alter, Ethnie, Gesichtszüge, Ausdruck, Frisur,
sichtbare Kleidung an den Schultern, Beleuchtung, Stimmung.
Schreibe als Bildgenerierungs-Prompt — kommagetrennte Deskriptoren, keine Sätze.
WICHTIG: Beschreibe nur EINE Person.
WICHTIG: Schreibe die Beschreibung auf ENGLISCH (für die Bildgenerierung).
WICHTIG: Immer einschließen: entsättigt, hartes Licht, dunkle Stimmung, Beton, hoher Kontrast, filmisch.',
    'Du bist ein Portrait-Beschreibungs-Spezialist für KI-Bildgenerierung. Schreibe prägnante, visuelle Deskriptoren auf Englisch für ein Einzelperson-Portrait in einer dunklen, brutalistischen, dystopischen Ästhetik.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 200, false, admin_id
) ON CONFLICT DO NOTHING;

-- Velgarien building image description (EN) — brutalist aesthetic
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    sim_id, 'building_image_description', 'generation', 'en',
    'Velgarien Building Image Description (EN)',
    'Describe an architectural photograph of a building for image generation.

Building: {building_name}
Type: {building_type}
Condition: {building_condition}
Style: {building_style}
Special type: {special_type}
Construction year: {construction_year}
Description: {building_description}
Zone: {zone_name}

AESTHETIC: Dark, moody, brutalist atmosphere. Raw concrete, weathered steel.
Desaturated palette — grays, cold blues, industrial browns. Harsh directional lighting.
Dystopian and imposing. Think Soviet-era brutalism meets film noir cinematography.

Based on these properties, describe the building visually.
The CONDITION is critical — a "ruined" building should show structural damage, crumbling walls,
broken windows. A "poor" building shows neglect and decay. "Fair" is functional but worn.
"Good" is well-maintained. "Excellent" is pristine.

The BUILDING TYPE affects architecture — government buildings are imposing and authoritarian,
military buildings are fortified and stark, industrial buildings are functional and massive,
residential buildings vary by condition.

Write as an image generation prompt — comma-separated descriptors, no sentences.
Include: architectural style, materials, condition indicators, lighting, atmosphere, scale.
IMPORTANT: Always include: brutalist, concrete, desaturated, harsh lighting, dystopian, cinematic.',
    'You are an architectural description specialist for AI image generation. Write concise, visual descriptors for building photographs in a dark, brutalist, dystopian aesthetic.',
    '[{"name": "building_name"}, {"name": "building_type"}, {"name": "building_condition"}, {"name": "building_style"}, {"name": "special_type"}, {"name": "construction_year"}, {"name": "building_description"}, {"name": "zone_name"}, {"name": "simulation_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 200, false, admin_id
) ON CONFLICT DO NOTHING;

-- Velgarien building image description (DE) — German instructions, English output
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    sim_id, 'building_image_description', 'generation', 'de',
    'Velgarien Gebäude-Bildbeschreibung (DE)',
    'Beschreibe ein Architekturfoto eines Gebäudes für die Bildgenerierung.

Gebäude: {building_name}
Typ: {building_type}
Zustand: {building_condition}
Stil: {building_style}
Spezialtyp: {special_type}
Baujahr: {construction_year}
Beschreibung: {building_description}
Zone: {zone_name}

ÄSTHETIK: Dunkle, düstere, brutalistische Atmosphäre. Roher Beton, verwitterter Stahl.
Entsättigte Palette — Grautöne, kalte Blautöne, Industriebraun. Hartes gerichtetes Licht.
Dystopisch und imposant. Denke an sowjetischen Brutalismus trifft Film-Noir-Kinematografie.

Beschreibe das Gebäude visuell basierend auf diesen Eigenschaften.
Der ZUSTAND ist entscheidend — ein "ruiniertes" Gebäude zeigt strukturelle Schäden, bröckelnde Mauern,
zerbrochene Fenster. "Schlecht" zeigt Vernachlässigung und Verfall. "Mittel" ist funktional aber abgenutzt.
"Gut" ist gepflegt. "Ausgezeichnet" ist makellos.

Der GEBÄUDETYP beeinflusst die Architektur — Regierungsgebäude sind imposant und autoritär,
Militärgebäude sind befestigt und karg, Industriegebäude sind funktional und massiv,
Wohngebäude variieren je nach Zustand.

Schreibe als Bildgenerierungs-Prompt — kommagetrennte Deskriptoren, keine Sätze.
WICHTIG: Schreibe die Beschreibung auf ENGLISCH (für die Bildgenerierung).
WICHTIG: Immer einschließen: brutalistisch, Beton, entsättigt, hartes Licht, dystopisch, filmisch.',
    'Du bist ein Architektur-Beschreibungs-Spezialist für KI-Bildgenerierung. Schreibe prägnante, visuelle Deskriptoren auf Englisch für Gebäudefotografien in einer dunklen, brutalistischen, dystopischen Ästhetik.',
    '[{"name": "building_name"}, {"name": "building_type"}, {"name": "building_condition"}, {"name": "building_style"}, {"name": "special_type"}, {"name": "construction_year"}, {"name": "building_description"}, {"name": "zone_name"}, {"name": "simulation_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 200, false, admin_id
) ON CONFLICT DO NOTHING;

END $$;
