-- 051: Spengbab's Whore House — Deep-Fried Capitalist Horror
-- Combined migration: Simulation, Taxonomies, Entities, and Theme.

DO $$
DECLARE
    sim_id uuid := '60000000-0000-0000-0000-000000000001';
    city_id uuid := 'c0000007-0000-4000-a000-000000000001';
    test_user_id uuid := '00000000-0000-0000-0000-000000000001';
    
    zone_fast_food uuid := 'a0000014-0000-0000-0000-000000000001';
    zone_residential uuid := 'a0000015-0000-0000-0000-000000000001';
    zone_commercial uuid := 'a0000016-0000-0000-0000-000000000001';
    zone_canvas uuid := 'a0000017-0000-0000-0000-000000000001';
BEGIN

-- 1. Simulation
INSERT INTO public.simulations (id, name, slug, description, theme, content_locale, owner_id, status)
VALUES (
    sim_id,
    'Spengbab''s Whore House',
    'spengbabs-whore-house',
    'An underwater capitalist hellscape built from corrupted memory and deep-fried internet decay.',
    'horror',
    'en',
    test_user_id,
    'active'
) ON CONFLICT (slug) DO NOTHING;

-- 2. Membership
INSERT INTO public.simulation_members (simulation_id, user_id, member_role)
VALUES (sim_id, test_user_id, 'owner')
ON CONFLICT (simulation_id, user_id) DO NOTHING;

-- 3. Taxonomies
-- Genders
INSERT INTO public.simulation_taxonomies (simulation_id, taxonomy_type, value, label) VALUES
    (sim_id, 'gender', 'male-ish', '{"en": "Male-ish", "de": "Männlich-ish"}'),
    (sim_id, 'gender', 'female', '{"en": "Female", "de": "Weiblich"}'),
    (sim_id, 'gender', 'void', '{"en": "The Void", "de": "Die Leere"}')
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- Professions
INSERT INTO public.simulation_taxonomies (simulation_id, taxonomy_type, value, label) VALUES
    (sim_id, 'profession', 'fry_cook', '{"en": "Eternal Fry Cook", "de": "Ewiger Frittier-Koch"}'),
    (sim_id, 'profession', 'cynic', '{"en": "Cosmic Cynic", "de": "Kosmischer Zyniker"}'),
    (sim_id, 'profession', 'void_mass', '{"en": "Gluttonous Void", "de": "Gierige Leere"}'),
    (sim_id, 'profession', 'capitalist', '{"en": "Capitalist Manifestation", "de": "Manifestation des Kapitals"}'),
    (sim_id, 'profession', 'rationalist', '{"en": "Trapped Rationalist", "de": "Gefangene Rationalistin"}'),
    (sim_id, 'profession', 'pixel_malice', '{"en": "Microscopic Malice", "de": "Mikroskopische Bösartigkeit"}')
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- Factions (Systems)
INSERT INTO public.simulation_taxonomies (simulation_id, taxonomy_type, value, label) VALUES
    (sim_id, 'system', 'minimum_wage', '{"en": "The Minimum Wage", "de": "Der Mindestlohn"}'),
    (sim_id, 'system', 'capital_owners', '{"en": "The Ownership Class", "de": "Die Kapitalbesitzer"}'),
    (sim_id, 'system', 'void_dwellers', '{"en": "Void Dwellers", "de": "Leere-Bewohner"}'),
    (sim_id, 'system', 'the_exiled', '{"en": "The Exiled", "de": "Die Exilierten"}')
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- Building Types (standardized + sim-specific)
INSERT INTO public.simulation_taxonomies (simulation_id, taxonomy_type, value, label) VALUES
    (sim_id, 'building_type', 'slaughterhouse', '{"en": "Slaughterhouse", "de": "Schlachthaus"}'),
    (sim_id, 'building_type', 'residential', '{"en": "Rotting Residence", "de": "Verrottende Residenz"}'),
    (sim_id, 'building_type', 'void_structure', '{"en": "Architectural Void", "de": "Leere-Struktur"}'),
    (sim_id, 'building_type', 'commercial', '{"en": "Retail Purgatory", "de": "Einzelhandels-Fegefeuer"}'),
    (sim_id, 'building_type', 'infrastructure', '{"en": "Memetic Infrastructure", "de": "Memetische Infrastruktur"}'),
    (sim_id, 'building_type', 'monolith', '{"en": "Monolith of Sorrow", "de": "Monolith der Trauer"}'),
    (sim_id, 'building_type', 'horizon', '{"en": "The Rendering Edge", "de": "Der Rendering-Rand"}')
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- Zone Types
INSERT INTO public.simulation_taxonomies (simulation_id, taxonomy_type, value, label) VALUES
    (sim_id, 'zone_type', 'capital_core', '{"en": "Center of Capital", "de": "Kapitalkern"}'),
    (sim_id, 'zone_type', 'worker_slum', '{"en": "Worker Slums", "de": "Arbeiterviertel"}'),
    (sim_id, 'zone_type', 'commercial_waste', '{"en": "Commercial Waste", "de": "Gewerbemüll"}'),
    (sim_id, 'zone_type', 'edge_of_reality', '{"en": "Edge of Reality", "de": "Rand der Realität"}')
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- 4. City
INSERT INTO public.cities (id, simulation_id, name, description)
VALUES (
    city_id,
    sim_id,
    'Bikini Bottomless',
    'A city stretched across the rack of internet irony.'
) ON CONFLICT (id) DO NOTHING;

-- 5. Zones
INSERT INTO public.zones (id, simulation_id, city_id, name, zone_type, security_level, description) VALUES
    (zone_fast_food, sim_id, city_id, 'The Fast Food Circle', 'capital_core', 'high', 'The center of capital and suffering, where the grease never stops weeping.'),
    (zone_residential, sim_id, city_id, 'The Residential Rot', 'worker_slum', 'medium', 'Where the workers sleep but never rest, breathing in the scent of rotting citrus.'),
    (zone_commercial, sim_id, city_id, 'The Commercial Wastes', 'commercial_waste', 'low', 'Retail purgatory, endless aisles of useless commodities and corrupted textures.'),
    (zone_canvas, sim_id, city_id, 'The Unfinished Canvas', 'edge_of_reality', 'restricted', 'The literal edge of the world where the rendering engine gives up.')
ON CONFLICT (id) DO NOTHING;

-- 6. Streets
INSERT INTO public.city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_fast_food, 'Barnacle Boulevard', 'major'),
    (sim_id, city_id, zone_fast_food, 'Greasy Spoon Alley', 'minor'),
    (sim_id, city_id, zone_fast_food, 'The Frying Pan', 'minor'),
    (sim_id, city_id, zone_fast_food, 'Minimum Wage Way', 'major'),
    (sim_id, city_id, zone_residential, 'Pineapple Path', 'major'),
    (sim_id, city_id, zone_residential, 'Conch Street', 'minor'),
    (sim_id, city_id, zone_residential, 'Coral Avenue', 'major'),
    (sim_id, city_id, zone_residential, 'Anchor Way', 'minor'),
    (sim_id, city_id, zone_commercial, 'Bargain Bypass', 'major'),
    (sim_id, city_id, zone_commercial, 'Discount Drive', 'major'),
    (sim_id, city_id, zone_commercial, 'Receipt Row', 'minor'),
    (sim_id, city_id, zone_commercial, 'The Aisle of Regret', 'minor'),
    (sim_id, city_id, zone_canvas, 'Eraser Tool Avenue', 'restricted'),
    (sim_id, city_id, zone_canvas, 'Hex Code Highway', 'restricted'),
    (sim_id, city_id, zone_canvas, 'The Pixel Bleed', 'minor'),
    (sim_id, city_id, zone_canvas, 'Dead Link Lane', 'minor');

-- 7. Agents
INSERT INTO public.agents (simulation_id, name, gender, system, primary_profession, character, background) VALUES
    (sim_id, 'Spengbab', 'male-ish', 'minimum_wage', 'fry_cook', 
     'Eternal employee with fused facial muscles and hyper-realistic bloodshot eyes. Terrifyingly optimistic.',
     'Born from an MS Paint accident in 2006. He has been flipping the same concept-patty for twenty years. He cannot stop smiling.'),
    (sim_id, 'Skodwarde', 'male-ish', 'minimum_wage', 'cynic', 
     'Aware of the simulation''s artificiality. Face elongated with cosmic depression. Plays a silent clarinet.',
     'A failed artist who realized he is a poorly drawn caricature. He is the only one who hears the GPU fans screaming.'),
    (sim_id, 'Morbid Patrick', 'male-ish', 'void_dwellers', 'void_mass', 
     'A jagged, unstable mass of neon pink. Represents the blind, consuming id of the internet.',
     'Once a starfish, now an ontological hole. He eats to fill a void that matches the hex code of nothingness.'),
    (sim_id, 'Moar Krabs', 'male-ish', 'capital_owners', 'capitalist', 
     'A crustacean of calcified greed and exploitation. Vibrates with motion-blur intensity.',
     'He owns the air, the time, and the punchline. He is the reason the Whore House exists. Money is his only language.'),
    (sim_id, 'Sandy the Exiled', 'female', 'the_exiled', 'rationalist', 
     'Rationalist trapped in a shattered glass dome. Breathing toxic nostalgia and internet slang.',
     'A scientist from a Shard that made sense. Now she attempts to apply thermodynamics to MS Paint physics. She is losing.'),
    (sim_id, 'Plangton', 'male-ish', 'capital_owners', 'pixel_malice', 
     'A single pixel of adequacy and rage. His AI wife is constantly begging for task-termination.',
     'He schemes to steal a formula that doesn''t exist. His entire existence is a rendering error that refused to be fixed.');

-- 8. Buildings
INSERT INTO public.buildings (simulation_id, city_id, zone_id, name, building_type, building_condition, description) VALUES
    (sim_id, city_id, zone_fast_food, 'The Krusty Slaughterhouse', 'slaughterhouse', 'fair', 'The architectural manifestation of surplus value. The grease achieves sentience.'),
    (sim_id, city_id, zone_residential, 'The Rotting Pineapple', 'residential', 'poor', 'Spengbab''s residence. A spatial anomaly of oversaturated orange and impossible angles.'),
    (sim_id, city_id, zone_fast_food, 'The Chum Void', 'void_structure', 'excellent', 'An architectural black hole masquerading as a competitor. Serves nothing, contains nothing.'),
    (sim_id, city_id, zone_commercial, 'The Bargain Mart of Lost Souls', 'commercial', 'poor', 'A fluorescent-lit retail nightmare where items cost human attributes instead of currency.'),
    (sim_id, city_id, zone_commercial, 'The Goo Lagoon of Stagnation', 'infrastructure', 'fair', 'A body of memetic acid where residents dissolve into the background layer.'),
    (sim_id, city_id, zone_residential, 'Skodwarde''s Tiki Head', 'monolith', 'poor', 'A monolith of absolute depression. Stone eyes weep stuttering blue pixels.'),
    (sim_id, city_id, zone_canvas, 'The MS Paint Void', 'horizon', 'excellent', 'The literal edge of the world where the rendering engine gives up.');

-- 9. AI Settings
INSERT INTO public.simulation_settings (simulation_id, category, setting_key, setting_value) VALUES
    (sim_id, 'ai', 'image_model_agent_portrait', '"black-forest-labs/flux-dev"'),
    (sim_id, 'ai', 'image_model_building_image', '"black-forest-labs/flux-dev"'),
    (sim_id, 'ai', 'image_guidance_scale', '"7.5"'),
    (sim_id, 'ai', 'image_num_inference_steps', '"35"'),
    (sim_id, 'ai', 'image_style_prompt_portrait', '"authentic Spengbab fan art style, cursed internet meme aesthetic, grotesque distorted character, deep-fried image filter, hyper-realistic bloodshot eyes on a crude MS Paint body, jagged lines, toxic neon colors, Beksinski body horror mixed with amateur deviantart, extreme jpeg compression artifacts, visual noise, distorted proportions"'),
    (sim_id, 'ai', 'image_style_prompt_building', '"Brutalist architecture drawn in MS Paint, poorly rendered perspective, rotting fast food restaurant melting into jpeg artifacts, toxic neon color palette, deep-fried meme aesthetic, surrealist horror, backrooms aesthetic but underwater, 2006 internet creepypasta vibe, no anti-aliasing, jagged edges, corrupted files"')
ON CONFLICT (simulation_id, category, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- 10. Prompt Templates
IF NOT EXISTS (SELECT 1 FROM public.prompt_templates WHERE simulation_id = sim_id AND template_type = 'agent_backstory' AND locale = 'en') THEN
    INSERT INTO public.prompt_templates (simulation_id, template_type, prompt_category, locale, template_name, prompt_content) VALUES
        (sim_id, 'agent_backstory', 'generation', 'en', 'Spengbab Agent Backstory', 'Generate a backstory for an entity in Spengbab''s Whore House. Use deep-fried capitalist horror terminology. Reference 2006-era internet memes, MS Paint aesthetics, and the futility of labor. Tone: surreal, grotesque, satirical.');
END IF;

IF NOT EXISTS (SELECT 1 FROM public.prompt_templates WHERE simulation_id = sim_id AND template_type = 'building_description' AND locale = 'en') THEN
    INSERT INTO public.prompt_templates (simulation_id, template_type, prompt_category, locale, template_name, prompt_content) VALUES
        (sim_id, 'building_description', 'generation', 'en', 'Spengbab Building Description', 'Describe a building in an underwater capitalist hellscape. Focus on architectural decay, jpeg artifacts, sentience in grease, and spatial anomalies. Tone: clinical but unsettling.');
END IF;

-- 11. Theme Settings (37 tokens)
-- We will follow the toxic neon yellow/magenta aesthetic.
INSERT INTO public.simulation_settings (simulation_id, category, setting_key, setting_value) VALUES
    (sim_id, 'design', 'color_primary', '"#FF00FF"'), -- Magenta
    (sim_id, 'design', 'color_primary_hover', '"#CC00CC"'),
    (sim_id, 'design', 'color_primary_active', '"#990099"'),
    (sim_id, 'design', 'color_secondary', '"#00FFFF"'), -- Cyan
    (sim_id, 'design', 'color_accent', '"#FF0000"'), -- MS Paint Red
    (sim_id, 'design', 'color_background', '"#FFFF00"'), -- Toxic Yellow
    (sim_id, 'design', 'color_surface', '"#FFFFFF"'), -- White (no anti-alias look)
    (sim_id, 'design', 'color_surface_sunken', '"#EEEEEE"'),
    (sim_id, 'design', 'color_surface_header', '"#FFFF00"'),
    (sim_id, 'design', 'color_text', '"#000000"'),
    (sim_id, 'design', 'color_text_secondary', '"#333333"'),
    (sim_id, 'design', 'color_text_muted', '"#666666"'),
    (sim_id, 'design', 'color_border', '"#000000"'),
    (sim_id, 'design', 'color_border_light', '"#CCCCCC"'),
    (sim_id, 'design', 'color_danger', '"#FF0000"'),
    (sim_id, 'design', 'color_success', '"#00FF00"'),
    (sim_id, 'design', 'color_primary_bg', '"#FF00FF22"'),
    (sim_id, 'design', 'color_info_bg', '"#00FFFF22"'),
    (sim_id, 'design', 'color_danger_bg', '"#FF000022"'),
    (sim_id, 'design', 'color_success_bg', '"#00FF0022"'),
    (sim_id, 'design', 'color_warning_bg', '"#FFFF0022"'),
    (sim_id, 'design', 'text_inverse', '"#FFFFFF"'),
    (sim_id, 'design', 'font_heading', '"Comic Sans MS, cursive"'),
    (sim_id, 'design', 'font_body', '"Courier New, monospace"'),
    (sim_id, 'design', 'heading_weight', '"900"'),
    (sim_id, 'design', 'heading_transform', '"uppercase"'),
    (sim_id, 'design', 'heading_tracking', '"0.2em"'),
    (sim_id, 'design', 'border_radius', '"0px"'), -- Jagged
    (sim_id, 'design', 'border_width', '"3px"'),
    (sim_id, 'design', 'shadow_style', '"8px 8px 0px #FF0000"'), -- Harsh red offset
    (sim_id, 'design', 'shadow_color', '"#FF0000"'),
    (sim_id, 'design', 'hover_effect', '"translate(-2px, -2px)"'),
    (sim_id, 'design', 'animation_speed', '"2.0"'), -- Erratic
    (sim_id, 'design', 'animation_easing', '"steps(4, end)"') -- Frame drops
ON CONFLICT (simulation_id, category, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

END $$;
