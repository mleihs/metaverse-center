-- 054: Official Spengbab Aesthetic Master Prompts
-- Implements the "hairy" line art, biomechanical surrealism, and underground comix style.

DO $$
DECLARE
    sim_id uuid := '60000000-0000-0000-0000-000000000001';
BEGIN

-- 1. Master Portrait Description Template
UPDATE public.prompt_templates 
SET prompt_content = 'A hyper-distorted, grotesque caricature of {{agent_name}} in a "cursed image" internet aesthetic. 
    Featured elements: erratic scratchy "hairy" line art, bloodshot bulging eyes with tiny pupils, 
    and a wide mouth showing rotting, misaligned teeth and exposed gums. 
    The body is melting and porous, dripping with visceral slime and internal organs spilling out. 
    Use a sickly neon-yellow and raw-meat pink color palette. 
    Gritty, low-fidelity MS Paint-style shading, heavy cross-hatching, surreal body horror, 
    extreme close-up, high contrast, unsettling underground comix style. 
    Nihilistic atmosphere of decay and physical distress.'
WHERE simulation_id = sim_id AND template_type = 'portrait_description';

-- 2. Master Style Prompts
UPDATE public.simulation_settings 
SET setting_value = '"underground comix style, hairy line art, scratchy erratic lines, biomechanical surrealism, MS Paint-style shading, heavy cross-hatching, cursed image, low-fidelity, grotesque caricature, bloodshot eyes, exposed gums, visceral slime, sickly colors, high contrast, nihilistic"'
WHERE simulation_id = sim_id AND setting_key = 'ai.image_style_prompt_portrait';

UPDATE public.simulation_settings 
SET setting_value = '"crude MS Paint architecture, scratchy hairy outlines, melting walls, raw-meat pink and sickly yellow palette, deep-fried jpeg artifacts, low-fidelity, unsettling atmosphere, heavy cross-hatching, 2006 internet board aesthetic, no anti-aliasing"'
WHERE simulation_id = sim_id AND setting_key = 'ai.image_style_prompt_building';

-- 3. Optimization for "Cursed" Outputs
-- Higher guidance scale (15.0) to force adherence to the "shitty" keywords
UPDATE public.simulation_settings 
SET setting_value = '"15.0"'
WHERE simulation_id = sim_id AND setting_key = 'ai.image_guidance_scale';

-- Lower inference steps (20) to prevent the model from "cleaning up" the image too much
UPDATE public.simulation_settings 
SET setting_value = '"20"'
WHERE simulation_id = sim_id AND setting_key = 'ai.image_num_inference_steps';

END $$;
