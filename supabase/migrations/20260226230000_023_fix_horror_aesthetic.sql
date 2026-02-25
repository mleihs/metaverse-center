-- =============================================================================
-- Migration 023: Fix Horror Aesthetic for Station Null
-- =============================================================================
-- Problem: Flux Dev model produces anime/clean-digital-art portraits because:
-- 1. "concept art quality" triggers Flux's digital art training bias
-- 2. Flux has NO negative prompt support — "not anime" does nothing
-- 3. guidance_scale=3.5 is too low, letting the model drift from the prompt
-- 4. System prompt doesn't enforce gritty/textured visual descriptions
--
-- Fixes:
-- a. Replace style prompt with cinematic film still / practical effects language
-- b. Remove all useless "not X" negatives (Flux ignores them)
-- c. Increase guidance_scale from 3.5 to 5.0
-- d. Rewrite system prompt to enforce gritty, weathered, rough-textured output
-- e. Same treatment for building style prompt
-- =============================================================================

DO $$
DECLARE
    station_null_id uuid := '30000000-0000-0000-0000-000000000001';
BEGIN

-- ============================================================================
-- 1. FIX PORTRAIT STYLE PROMPT
-- ============================================================================
-- OLD: "deep space horror portrait, derelict research station, harsh fluorescent
--       lighting mixed with CRT monitor glow, clinical whites stained with organic
--       growth, body horror undertones, concept art quality, dramatic lighting from
--       below, isolation horror, detailed face showing stress and sleep deprivation,
--       dark void background with distant green phosphor glow, not photorealistic,
--       not cartoon, not anime, not bright daylight"
--
-- PROBLEMS: "concept art quality" → anime/digital art, "not anime" → Flux ignores,
--           no texture/film grain cues, no gritty physical descriptors

UPDATE simulation_settings
SET setting_value = '"cinematic film still from 1979 sci-fi horror movie, Ridley Scott Alien aesthetic, practical effects makeup, 35mm film grain, harsh overhead fluorescent tubes casting sickly green-white light, deep shadows under eyes and jawline, visible skin texture with pores and imperfections, sweat-stained collar, grimy and weathered face, dark industrial corridor background with condensation on metal walls, single subject portrait, anamorphic lens flare, desaturated cold color palette, dread and exhaustion"'
WHERE simulation_id = station_null_id
  AND setting_key = 'image_style_prompt_portrait'
  AND category = 'ai';

-- ============================================================================
-- 2. FIX BUILDING STYLE PROMPT
-- ============================================================================

UPDATE simulation_settings
SET setting_value = '"cinematic still from 1979 sci-fi horror movie, Ridley Scott Alien production design, practical sets not CGI, 35mm film grain, industrial brutalist architecture, harsh fluorescent tubes with green-white flicker, deep shadows, condensation on metal surfaces, visible rust and biological staining, claustrophobic framing, wide-angle lens distortion, desaturated cold palette with sickly green undertones, no people, atmospheric fog and steam from vents"'
WHERE simulation_id = station_null_id
  AND setting_key = 'image_style_prompt_building'
  AND category = 'ai';

-- ============================================================================
-- 3. INCREASE GUIDANCE SCALE (3.5 → 5.0)
-- ============================================================================
-- Higher guidance forces Flux to follow the prompt more strictly,
-- reducing drift toward default clean/digital-art aesthetic.

UPDATE simulation_settings
SET setting_value = '5.0'::jsonb
WHERE simulation_id = station_null_id
  AND setting_key = 'image_guidance_scale'
  AND category = 'ai';

-- ============================================================================
-- 4. FIX PORTRAIT PROMPT TEMPLATE — Enforce gritty/weathered descriptions
-- ============================================================================

UPDATE prompt_templates
SET system_prompt = 'You are a portrait description specialist for a gritty 1970s-80s sci-fi horror film. Think Ridley Scott''s Alien, not anime or digital art. Every character looks EXHAUSTED, GRIMY, and WEATHERED. Describe visible skin texture (pores, wrinkles, dark circles, stubble, scars). Describe sweat stains, dirty collars, frayed patches on uniforms. Describe harsh unflattering overhead fluorescent lighting that casts deep shadows under eyes and noses. NO clean skin, NO smooth hair, NO bright eyes, NO heroic poses. These people have not slept properly in weeks. Focus on what makes each character physically UNIQUE and WORN.',
    prompt_content = 'Describe a portrait for image generation: {agent_name}.

Character: {agent_character}
Background: {agent_background}

VISUAL STYLE: Gritty 1979 sci-fi horror film still. NOT anime, NOT digital art, NOT illustration.

MANDATORY TEXTURE ELEMENTS (include at least 4):
- Visible pores, wrinkles, or skin imperfections
- Dark circles or bags under eyes
- Sweat, grime, or oil on skin
- Messy, unwashed, or matted hair
- Stained, patched, or frayed clothing
- Harsh unflattering overhead fluorescent light casting deep shadows under eyes/nose/jawline

FOCUS ON WHAT MAKES THIS CHARACTER VISUALLY UNIQUE:
- Specific physical features (body type, age, skin tone, unique hair, scars, prosthetics, accessories)
- Clothing details: what exact condition? What modifications or damage? What stains or wear patterns?
- One prop or environmental detail tied to their specific story
- Facial expression showing their specific psychological state (exhaustion type differs per character)
- One subtle horror element unique to this character''s narrative

COMPOSITION: Head-and-shoulders portrait, single subject, harsh overhead lighting.
Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: Describe only ONE character.
IMPORTANT: Make them look ROUGH and WORN, not clean or pretty.
IMPORTANT: Do NOT use words like "concept art", "illustration", "digital art", "anime", "stylized".'
WHERE simulation_id = station_null_id
  AND template_type = 'portrait_description'
  AND is_active = true;

-- ============================================================================
-- 5. FIX BUILDING PROMPT TEMPLATE — Enforce practical-sets aesthetic
-- ============================================================================

UPDATE prompt_templates
SET system_prompt = 'You are a production designer for a 1970s-80s sci-fi horror film. Think the original Alien, Outland, or Dark Star — practical sets built from real materials, not CGI. Every space looks INDUSTRIAL, CLAUSTROPHOBIC, and DETERIORATING. Describe visible rust, condensation, biological staining, exposed wiring. Describe the specific way fluorescent lights flicker or buzz in this room. NO clean surfaces, NO futuristic sleekness, NO digital renders. These are working industrial spaces that have been poorly maintained for years.',
    prompt_content = 'Describe a station section for image generation.

Building: {building_name}
Type: {building_type}
Condition: {building_condition}
Description: {building_description}
Zone: {zone_name}

VISUAL STYLE: Practical film set from 1979 sci-fi horror. NOT CGI, NOT digital render, NOT clean futurism.

MANDATORY TEXTURE ELEMENTS (include at least 4):
- Visible rust, corrosion, or metal fatigue on surfaces
- Condensation, moisture, or biological film on walls
- Exposed wiring, cables, or ductwork
- Flickering or buzzing fluorescent tubes (describe the specific light COLOR in this room)
- Steam, fog, or atmospheric haze from vents
- Grime buildup in corners, stains on floor grating

FOCUS ON WHAT MAKES THIS SPACE ARCHITECTURALLY UNIQUE:
- Room shape, ceiling height, dominant structural feature
- Unique equipment (control panels, specimen tanks, reactor, altar, bunks)
- Primary light source and its specific COLOR for this room
- The specific way deterioration manifests HERE (organic growth? rust? frost? static?)
- Camera angle that best shows the space
- Scale reference (how big relative to a person?)

CONDITION GUIDE: "critical" = failing, overgrown. "Poor" = neglect, contamination.
"Fair" = operational but strained. "Good" = maintained but unsettling. "Excellent" = pristine, wrongly so.

Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: Make it look like a PRACTICAL FILM SET, not a digital render.
IMPORTANT: Do NOT use words like "concept art", "illustration", "digital art", "render", "CGI".'
WHERE simulation_id = station_null_id
  AND template_type = 'building_image_description'
  AND is_active = true;

END $$;
