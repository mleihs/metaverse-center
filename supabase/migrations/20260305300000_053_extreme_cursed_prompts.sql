-- 053: Extreme Cursed Prompts for Spengbab
-- Replaces "high quality" triggers with "shitty art" triggers to achieve the authentic MS Paint look.

DO $$
DECLARE
    sim_id uuid := '60000000-0000-0000-0000-000000000001';
BEGIN

-- 1. Aggressively "bad" Portrait Description Template
UPDATE public.prompt_templates 
SET prompt_content = 'Describe {{agent_name}} as a SHITTY 2D MS Paint drawing. 
    NO SHADING, NO GRADIENTS, NO DEPTH. 
    Flat, toxic neon colors that leak outside the lines. 
    Focus on: ONE large bulging bloodshot eye and one small pupil, a distorted "broken" body posture, 
    jagged jagged black outlines with visible pixel stairs (aliasing), 
    and a wide, disturbing, toothy grimace drawn by an amateur. 
    The background is just a flat white or neon yellow void. 
    It must look like authentic 2006 Spengbab fan art from an old imageboard. 
    ABSOLUTELY NO ATMOSPHERIC LIGHTING.'
WHERE simulation_id = sim_id AND template_type = 'portrait_description';

-- 2. Aggressively "bad" Building Description Template
UPDATE public.prompt_templates 
SET prompt_content = 'Describe the building {{building_name}} (a {{building_type}}) as a crude, amateur 2D MS Paint house. 
    The perspective is totally wrong and flat. 
    Lines are shaky and don''t always connect. 
    Use bucket-fill colors that are way too bright (neon magenta, neon yellow). 
    Add heavy "deep-fried" jpeg artifacts and compression noise. 
    It should look like a corrupted file from an old forum. 
    NO REALISM, NO 3D EFFECTS, NO CONCEPT ART STYLE. 
    It is a shitty internet drawing, not an illustration.'
WHERE simulation_id = sim_id AND template_type = 'building_image_description';

-- 3. Extreme "Anti-Quality" Style Prompts
UPDATE public.simulation_settings 
SET setting_value = '"shitty 2D MS Paint drawing, authentic Spengbab fan art, no shading, flat colors, jagged pixelated black outlines, no anti-aliasing, deep-fried jpeg artifacts, 2006 internet meme, cursed image, amateur art, very low quality, MS Paint bucket fill, toothy grin, bloodshot eyes"'
WHERE simulation_id = sim_id AND setting_key = 'ai.image_style_prompt_portrait';

UPDATE public.simulation_settings 
SET setting_value = '"shitty 2D MS Paint house drawing, amateur digital art, no perspective, flat neon colors, jagged lines, deep-fried, heavy jpeg noise, 2006 internet board aesthetic, low quality, corrupted image, MS Paint lines"'
WHERE simulation_id = sim_id AND setting_key = 'ai.image_style_prompt_building';

-- 4. Try a more volatile guidance scale to allow for more "mistakes"
UPDATE public.simulation_settings 
SET setting_value = '"12.0"'
WHERE simulation_id = sim_id AND setting_key = 'ai.image_guidance_scale';

END $$;
