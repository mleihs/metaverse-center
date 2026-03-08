-- 083: Add lore image settings for Spengbab's Whore House
-- Lore images were falling back to generic SD 1.5 + generic style prompt.
-- This adds the cursed aesthetic style prompt and Flux Dev model override
-- to match existing portrait/building generation quality.

INSERT INTO public.simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES
  (
    '60000000-0000-0000-0000-000000000001',
    'ai',
    'image_style_prompt_lore',
    '"cursed MS Paint illustration, deep-fried jpeg artifacts, scratchy hairy line art, heavy cross-hatching, sickly neon-yellow and raw-meat pink palette, low-fidelity, 2006 internet creepypasta aesthetic, biomechanical surrealism, melting grotesque scenery, no anti-aliasing, jagged edges, nihilistic atmosphere, underground comix style"'::jsonb
  ),
  (
    '60000000-0000-0000-0000-000000000001',
    'ai',
    'image_model_lore_image',
    '"black-forest-labs/flux-dev"'::jsonb
  );
