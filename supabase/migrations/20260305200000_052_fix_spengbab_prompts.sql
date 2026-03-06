-- 052: Fix Spengbab Image Generation Prompts
-- Adds missing portrait and building image description templates.

DO $$
DECLARE
    sim_id uuid := '60000000-0000-0000-0000-000000000001';
BEGIN

-- 1. Portrait Description Template (Force LLM to describe things in Spengbab terms)
IF NOT EXISTS (SELECT 1 FROM public.prompt_templates WHERE simulation_id = sim_id AND template_type = 'portrait_description') THEN
    INSERT INTO public.prompt_templates (simulation_id, template_type, prompt_category, locale, template_name, prompt_content) VALUES
        (sim_id, 'portrait_description', 'generation', 'en', 'Spengbab Portrait Description', 
        'Describe the visual appearance of {{agent_name}} in the style of Spengbab fan art. 
        Focus on: hyper-realistic bloodshot eyes, bulging veins, distended and porous yellow flesh, melting anatomy, 
        jagged MS Paint lines, and an unsettling, toothy smile. 
        The background should be a low-resolution underwater void with visible pixel grid.
        Use vocabulary of internet creepypasta and cursed memes. Avoid any mention of beauty or photorealism.');
END IF;

-- 2. Building Image Description Template
IF NOT EXISTS (SELECT 1 FROM public.prompt_templates WHERE simulation_id = sim_id AND template_type = 'building_image_description') THEN
    INSERT INTO public.prompt_templates (simulation_id, template_type, prompt_category, locale, template_name, prompt_content) VALUES
        (sim_id, 'building_image_description', 'generation', 'en', 'Spengbab Building Image Description', 
        'Describe the building {{building_name}} (a {{building_type}}) in a deep-fried capitalist hellscape. 
        Focus on: rotting wood weeping grease, jagged MS Paint vectors, neon colors that bleed into each other, 
        jpeg compression artifacts, and spatial anomalies. 
        Mention that the building looks poorly drawn with no anti-aliasing.
        The perspective should be intentionally wrong. 
        Use the aesthetic of 2006-era internet imageboards. Avoid "atmospheric" or "cinematic" lighting.');
END IF;

-- 3. Update style prompts to be even more aggressive
UPDATE public.simulation_settings 
SET setting_value = '"Spengbab fan art, authentic MS Paint drawing, no anti-aliasing, jagged pixelated lines, toxic neon yellow and magenta, deep-fried jpeg artifacts, 2006 internet creepypasta aesthetic, bloodshot eyes, unsettling uncanny valley, low quality, amateur art"'
WHERE simulation_id = sim_id AND setting_key = 'ai.image_style_prompt_portrait';

UPDATE public.simulation_settings 
SET setting_value = '"Cursed MS Paint architecture, no anti-aliasing, jagged lines, deep-fried image, jpeg artifacts, toxic neon palette, poorly rendered perspective, 2006 internet meme style, rotting underwater aesthetic, low resolution grid background"'
WHERE simulation_id = sim_id AND setting_key = 'ai.image_style_prompt_building';

END $$;
