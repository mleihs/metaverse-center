-- ============================================================================
-- Migration 210: Velgarien Image Settings — Flux 2 Max + Hand-Crafted Prompts
-- ============================================================================
--
-- Brings local and production in sync for Velgarien image generation:
--   1. Remove stale flux-dev model overrides
--   2. Set flux-2-max for all entity types
--   3. Set Flux-optimal parameters (guidance 3.5, steps 28)
--   4. Set 4 hand-crafted style prompts (Crewdson/Chaubin/Höfer/Gursky/Deakins)
--
-- These prompts are hand-written from deep research into brutalist architecture
-- (Atlas of Brutalist Architecture, Phaidon), Cold War institutional photography,
-- and dystopian cinematography. They are NOT A.5 LLM output.
--
-- See: docs/guides/simulation-image-upgrade-playbook.md
-- ============================================================================

DO $$
DECLARE
    sim_id UUID := '10000000-0000-0000-0000-000000000001';
BEGIN

-- 1. Remove stale flux-dev overrides
DELETE FROM simulation_settings
WHERE simulation_id = sim_id
AND setting_key IN (
    'image_model_agent_portrait',
    'image_model_building_image',
    'image_model_lore_image',
    'image_model_banner'
);

-- 2. Set flux-2-max for all entity types
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES
  (sim_id, 'ai', 'image_model_agent_portrait', '"black-forest-labs/flux-2-max"'),
  (sim_id, 'ai', 'image_model_building_image', '"black-forest-labs/flux-2-max"'),
  (sim_id, 'ai', 'image_model_lore_image', '"black-forest-labs/flux-2-max"'),
  (sim_id, 'ai', 'image_model_banner', '"black-forest-labs/flux-2-max"')
ON CONFLICT (simulation_id, category, setting_key)
DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- 3. Flux-optimal parameters
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES
  (sim_id, 'ai', 'image_guidance_scale', '"3.5"'),
  (sim_id, 'ai', 'image_num_inference_steps', '"28"')
ON CONFLICT (simulation_id, category, setting_key)
DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- 4. Hand-crafted Flux 2 Max style prompts
-- Photographer references: Gregory Crewdson, Frederic Chaubin CCCP,
-- Candida Höfer, Andreas Gursky, Roger Deakins (Blade Runner 2049)
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES
  (sim_id, 'ai', 'image_style_prompt_portrait',
   '"In the style of Gregory Crewdson, cold institutional lighting, 85mm lens at f/2.8 shallow depth of field. Raw concrete and brushed steel background, harsh overhead fluorescent casting cold blue-white light with deep shadows under cheekbones and eye sockets. Bleach bypass color grading, desaturated cold palette with danger-red accent on Bureau insignia pin, slight film grain, Fuji Neopan Acros 100 tonal quality. Dystopian bureaucratic authority, oppressive institutional atmosphere, the subject exists within the system not despite it."'),

  (sim_id, 'ai', 'image_style_prompt_building',
   '"Architectural photography in the style of Frederic Chaubin CCCP and Candida Höfer, shot on Canon EOS R5 with 17mm tilt-shift lens at f/11 corrected perspective. Raw beton brut concrete with visible wooden formwork imprints, exposed aggregate panels, weathered surfaces showing decades of rain streaks and calcification. Anodized aluminium window frames, deep recessed windows in repeating grid. Cold desaturated palette, overcast grey sky, bleach bypass color grading, monumental Soviet-inspired scale. Brutalist Atlas reference architecture, oppressive institutional presence, the building does not welcome you it processes you."'),

  (sim_id, 'ai', 'image_style_prompt_lore',
   '"In the style of Andreas Gursky large-scale institutional photography crossed with Candida Höfer empty interiors. Vast bureaucratic spaces with filing cabinets stretching to vanishing point, concrete corridors under flickering fluorescent tubes, compliance kiosks and queue barriers. Shot on Hasselblad X2D 24mm at f/8 deep focus throughout. Desaturated cold palette, institutional green paint peeling to reveal plaster beneath, documentary photography, oppressive atmosphere of administered reality."'),

  (sim_id, 'ai', 'image_style_prompt_banner',
   '"Cinematic matte painting of dystopian brutalist cityscape in the style of Roger Deakins Blade Runner 2049 cinematography. Massive board-marked concrete government towers against low overcast grey sky, volumetric fog between buildings, danger-red flags and Bureau insignia signage as only color accents. Mercury vapor and fluorescent light spill from narrow windows. Monumental scale dwarfing all human presence, cold blue-grey palette, bleach bypass color grading, no text, no UI elements."')

ON CONFLICT (simulation_id, category, setting_key)
DO UPDATE SET setting_value = EXCLUDED.setting_value;

END $$;
