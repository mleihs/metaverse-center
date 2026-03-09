-- Migration 092: Spengbab image generation improvements.
-- 1. Add lore_image_description prompt template (LLM-powered, matching portrait/building pipeline)
-- 2. Add banner_description prompt template
-- 3. Add banner model + style prompt settings
-- 4. Add style_reference_url columns to agents/buildings (for img2img)

-- style_reference_url columns (used by StyleReferenceService)
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS style_reference_url TEXT;
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS style_reference_url TEXT;

-- Banner model + style prompt
INSERT INTO public.simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES
  ('60000000-0000-0000-0000-000000000001', 'ai', 'image_model_banner', '"black-forest-labs/flux-dev"'),
  ('60000000-0000-0000-0000-000000000001', 'ai', 'image_style_prompt_banner', '"cursed underwater panorama in MS Paint, poorly rendered perspective, deep-fried jpeg artifacts, toxic neon color palette, sickly yellow sky bleeding into raw-meat pink ocean, scratchy hairy line art, heavy cross-hatching, biomechanical surrealism, 2006 internet creepypasta aesthetic, melting architecture, no anti-aliasing, jagged edges, corrupted file glitches, nihilistic atmosphere, underground comix style"')
ON CONFLICT (simulation_id, category, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- Lore image description prompt template
INSERT INTO public.prompt_templates (
  simulation_id, template_type, prompt_category, locale,
  template_name, prompt_content, variables, description,
  is_system_default, is_active, version
) VALUES (
  '60000000-0000-0000-0000-000000000001',
  'lore_image_description',
  'image',
  'en',
  'Spengbab Lore Image Description',
  'Describe a scene for the lore chapter "{{section_title}}" from {{simulation_name}}.

Context from the lore text:
{{section_body}}

Create a vivid, detailed image description in the style of a cursed internet artifact:
- Crude MS Paint illustration with scratchy, erratic "hairy" line art
- Heavy cross-hatching and low-fidelity shading
- Sickly neon-yellow and raw-meat pink color palette
- Deep-fried jpeg compression artifacts and visual noise
- Biomechanical surrealism mixed with 2006 internet creepypasta aesthetic
- Melting, grotesque underwater scenery with impossible geometry
- Backrooms aesthetic but submerged in corrupted digital ocean
- No anti-aliasing, jagged pixelated edges, corrupted file glitches
- Underground comix style with nihilistic atmosphere of decay
- No text, no labels, no UI elements, no watermarks

Output ONLY the image description, nothing else. Be specific about composition, foreground/background, lighting, and the central visual metaphor.',
  '["section_title", "section_body", "simulation_name"]',
  'Generates cursed MS Paint lore scene descriptions for Spengbab image generation.',
  false, true, 1
);

-- Banner description prompt template
INSERT INTO public.prompt_templates (
  simulation_id, template_type, prompt_category, locale,
  template_name, prompt_content, variables, description,
  is_system_default, is_active, version
) VALUES (
  '60000000-0000-0000-0000-000000000001',
  'banner_description',
  'image',
  'en',
  'Spengbab Banner Description',
  'Describe a wide panoramic banner scene for {{simulation_name}}: an underwater capitalist hellscape built from corrupted memory and deep-fried internet decay.

Context — zone names and descriptions:
{{zones}}

Create a vivid 16:9 panoramic image description:
- A vast corrupted underwater cityscape rendered in crude MS Paint style
- The Krusty Slaughterhouse dominates the center, oozing sentient grease
- The Rotting Pineapple tilts at impossible angles in the foreground
- Skodwarde''s Tiki Head weeps low-resolution blue pixels in the distance
- The MS Paint Void consumes the horizon where the rendering engine gives up
- Toxic neon-yellow sky bleeds into raw-meat pink ocean
- Deep-fried jpeg compression artifacts corrupt the entire scene
- Scratchy hairy line art, heavy cross-hatching, no anti-aliasing
- 2006 internet creepypasta atmosphere, biomechanical surrealism
- No text, no labels, no UI elements, no watermarks

Output ONLY the image description. Be specific about composition, depth layers, and the central feeling of digital decay.',
  '["simulation_name", "zones"]',
  'Generates cursed MS Paint panoramic banner for Spengbab.',
  false, true, 1
);
