-- =============================================================================
-- SEED 009: The Capybara Kingdom — Sunless Sea / Failbetter Style Simulation
-- =============================================================================
-- A subterranean kingdom of anthropomorphic capybaras beneath the Unterzee.
-- Dark Victorian-gothic aesthetic, bioluminescent fungi, eldritch mystery.
--
-- Creates: simulation, membership, taxonomies, city, zones, 5 agents,
--          5 buildings, AI settings (Flux Dev), prompt templates.
--
-- Depends on: seed 001 (test user must exist)
-- =============================================================================

BEGIN;

DO $$
DECLARE
    sim_id  uuid := '20000000-0000-0000-0000-000000000001';
    usr_id  uuid := '00000000-0000-0000-0000-000000000001';
    city_id uuid := 'c0000003-0000-4000-a000-000000000001';
    zone_caverns   uuid := 'a0000004-0000-0000-0000-000000000001';
    zone_warrens   uuid := 'a0000005-0000-0000-0000-000000000001';
    zone_docks     uuid := 'a0000006-0000-0000-0000-000000000001';
    zone_deepreach uuid := 'a0000007-0000-0000-0000-000000000001';
BEGIN

-- ============================================================================
-- 1. SIMULATION
-- ============================================================================

INSERT INTO simulations (id, name, slug, description, theme, status, content_locale, owner_id)
VALUES (
    sim_id,
    'The Capybara Kingdom',
    'capybara-kingdom',
    'A subterranean kingdom of capybaras beneath the Unterzee. Ancient waterways, bioluminescent fungi, Victorian-era intrigue, and eldritch secrets. Something stirs in the deep.',
    'fantasy',
    'active',
    'en',
    usr_id
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 2. OWNER MEMBERSHIP
-- ============================================================================

INSERT INTO simulation_members (simulation_id, user_id, member_role)
VALUES (sim_id, usr_id, 'owner')
ON CONFLICT (simulation_id, user_id) DO NOTHING;

-- ============================================================================
-- 3. TAXONOMIES
-- ============================================================================

-- ---- Gender ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'gender', 'male',    '{"en":"Male","de":"Männlich"}', 1),
    (sim_id, 'gender', 'female',  '{"en":"Female","de":"Weiblich"}', 2),
    (sim_id, 'gender', 'diverse', '{"en":"Diverse","de":"Divers"}', 3)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Profession ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'profession', 'navigator',     '{"en":"Navigator","de":"Navigator"}', 1),
    (sim_id, 'profession', 'merchant',      '{"en":"Merchant","de":"Händler"}', 2),
    (sim_id, 'profession', 'archivist',     '{"en":"Archivist","de":"Archivar"}', 3),
    (sim_id, 'profession', 'priestess',     '{"en":"Priestess","de":"Priesterin"}', 4),
    (sim_id, 'profession', 'innkeeper',     '{"en":"Innkeeper","de":"Gastwirt"}', 5),
    (sim_id, 'profession', 'officer',       '{"en":"Naval Officer","de":"Marineoffizier"}', 6),
    (sim_id, 'profession', 'spy',           '{"en":"Spy","de":"Spion"}', 7),
    (sim_id, 'profession', 'scholar',       '{"en":"Scholar","de":"Gelehrter"}', 8),
    (sim_id, 'profession', 'smuggler',      '{"en":"Smuggler","de":"Schmuggler"}', 9),
    (sim_id, 'profession', 'dockworker',    '{"en":"Dockworker","de":"Hafenarbeiter"}', 10)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- System (Factions) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'system', 'politics', '{"en":"Politics","de":"Politik"}', 1),
    (sim_id, 'system', 'military', '{"en":"Military","de":"Militär"}', 2),
    (sim_id, 'system', 'clergy',   '{"en":"Clergy","de":"Klerus"}', 3),
    (sim_id, 'system', 'science',  '{"en":"Science","de":"Wissenschaft"}', 4),
    (sim_id, 'system', 'civilian', '{"en":"Civilian","de":"Zivilbevölkerung"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Building Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'building_type', 'residential', '{"en":"Residential","de":"Wohngebäude"}', 1),
    (sim_id, 'building_type', 'commercial',  '{"en":"Commercial","de":"Gewerbegebäude"}', 2),
    (sim_id, 'building_type', 'industrial',  '{"en":"Industrial","de":"Industriegebäude"}', 3),
    (sim_id, 'building_type', 'government',  '{"en":"Government","de":"Regierungsgebäude"}', 4),
    (sim_id, 'building_type', 'military',    '{"en":"Military","de":"Militärgebäude"}', 5),
    (sim_id, 'building_type', 'religious',   '{"en":"Religious","de":"Religiöses Gebäude"}', 6),
    (sim_id, 'building_type', 'special',     '{"en":"Special","de":"Spezialgebäude"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Building Condition ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'building_condition', 'excellent', '{"en":"Excellent","de":"Ausgezeichnet"}', 1),
    (sim_id, 'building_condition', 'good',      '{"en":"Good","de":"Gut"}', 2),
    (sim_id, 'building_condition', 'fair',      '{"en":"Fair","de":"Befriedigend"}', 3),
    (sim_id, 'building_condition', 'poor',      '{"en":"Poor","de":"Schlecht"}', 4),
    (sim_id, 'building_condition', 'ruined',    '{"en":"Ruined","de":"Ruine"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Zone Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'zone_type', 'residential', '{"en":"Residential","de":"Wohngebiet"}', 1),
    (sim_id, 'zone_type', 'commercial',  '{"en":"Commercial","de":"Gewerbegebiet"}', 2),
    (sim_id, 'zone_type', 'industrial',  '{"en":"Industrial","de":"Industriegebiet"}', 3),
    (sim_id, 'zone_type', 'military',    '{"en":"Military","de":"Militärgebiet"}', 4),
    (sim_id, 'zone_type', 'religious',   '{"en":"Religious","de":"Religiöses Gebiet"}', 5),
    (sim_id, 'zone_type', 'government',  '{"en":"Government","de":"Regierungsgebiet"}', 6),
    (sim_id, 'zone_type', 'slums',       '{"en":"Slums","de":"Slums"}', 7),
    (sim_id, 'zone_type', 'ruins',       '{"en":"Ruins","de":"Ruinen"}', 8)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Security Level ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'security_level', 'low',        '{"en":"Low","de":"Niedrig"}', 1),
    (sim_id, 'security_level', 'medium',     '{"en":"Medium","de":"Mittel"}', 2),
    (sim_id, 'security_level', 'high',       '{"en":"High","de":"Hoch"}', 3),
    (sim_id, 'security_level', 'restricted', '{"en":"Restricted","de":"Eingeschränkt"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Urgency Level ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'urgency_level', 'low',      '{"en":"Low","de":"Niedrig"}', 1),
    (sim_id, 'urgency_level', 'medium',   '{"en":"Medium","de":"Mittel"}', 2),
    (sim_id, 'urgency_level', 'high',     '{"en":"High","de":"Hoch"}', 3),
    (sim_id, 'urgency_level', 'critical', '{"en":"Critical","de":"Kritisch"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Event Type (fantasy / Sunless Sea themed) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'event_type', 'exploration',  '{"en":"Exploration","de":"Erforschung"}', 1),
    (sim_id, 'event_type', 'trade',        '{"en":"Trade","de":"Handel"}', 2),
    (sim_id, 'event_type', 'intrigue',     '{"en":"Intrigue","de":"Intrige"}', 3),
    (sim_id, 'event_type', 'eldritch',     '{"en":"Eldritch","de":"Unheimlich"}', 4),
    (sim_id, 'event_type', 'religious',    '{"en":"Religious","de":"Religiös"}', 5),
    (sim_id, 'event_type', 'military',     '{"en":"Military","de":"Militärisch"}', 6),
    (sim_id, 'event_type', 'social',       '{"en":"Social","de":"Sozial"}', 7),
    (sim_id, 'event_type', 'crisis',       '{"en":"Crisis","de":"Krise"}', 8),
    (sim_id, 'event_type', 'discovery',    '{"en":"Discovery","de":"Entdeckung"}', 9),
    (sim_id, 'event_type', 'nautical',     '{"en":"Nautical","de":"Nautisch"}', 10)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Propaganda Type (re-themed as Influence) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'propaganda_type', 'rumour',       '{"en":"Rumour","de":"Gerücht"}', 1),
    (sim_id, 'propaganda_type', 'decree',       '{"en":"Decree","de":"Erlass"}', 2),
    (sim_id, 'propaganda_type', 'sermon',       '{"en":"Sermon","de":"Predigt"}', 3),
    (sim_id, 'propaganda_type', 'broadsheet',   '{"en":"Broadsheet","de":"Flugblatt"}', 4),
    (sim_id, 'propaganda_type', 'whisper',      '{"en":"Whisper Campaign","de":"Flüsterkampagne"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Target Demographic ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'target_demographic', 'dockworkers',      '{"en":"Dockworkers","de":"Hafenarbeiter"}', 1),
    (sim_id, 'target_demographic', 'merchants',         '{"en":"Merchants","de":"Händler"}', 2),
    (sim_id, 'target_demographic', 'clergy',            '{"en":"Clergy","de":"Klerus"}', 3),
    (sim_id, 'target_demographic', 'general_populace',  '{"en":"General Populace","de":"Allgemeine Bevölkerung"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Campaign Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'campaign_type', 'rumour',       '{"en":"Rumour","de":"Gerücht"}', 1),
    (sim_id, 'campaign_type', 'decree',       '{"en":"Decree","de":"Erlass"}', 2),
    (sim_id, 'campaign_type', 'sermon',       '{"en":"Sermon","de":"Predigt"}', 3),
    (sim_id, 'campaign_type', 'broadsheet',   '{"en":"Broadsheet","de":"Flugblatt"}', 4),
    (sim_id, 'campaign_type', 'whisper',      '{"en":"Whisper Campaign","de":"Flüsterkampagne"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ============================================================================
-- 4. CITY
-- ============================================================================

INSERT INTO cities (id, simulation_id, name, description, population)
VALUES (
    city_id, sim_id,
    'Rootwater',
    'The capital of the Capybara Kingdom, built where the Great Root pierces the cavern ceiling and the Unterzee tributary widens into a navigable harbour. A sprawling subterranean city of fungal spires, rope bridges, and gaslit tunnels.',
    45000
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. ZONES
-- ============================================================================

INSERT INTO zones (id, simulation_id, city_id, name, zone_type, security_level, description) VALUES
    (zone_caverns, sim_id, city_id, 'The Upper Caverns',
     'government', 'high',
     'The political and administrative heart of Rootwater. Carved into massive stalagmites, these chambers house the Admiralty, the Council Burrow, and the residences of the kingdom''s elite. Gaslit and well-patrolled.'),
    (zone_warrens, sim_id, city_id, 'The Fungal Warrens',
     'religious', 'medium',
     'A network of damp tunnels where bioluminescent fungi grow in profusion. Home to the Great Sporocarp and the religious quarter. The air is thick with spores and the sound of chanting. Pilgrims crowd the narrow passages.'),
    (zone_docks, sim_id, city_id, 'The Undertide Docks',
     'commercial', 'low',
     'Where the underground river meets the Unterzee tributary. A chaotic waterfront of moored vessels, rope bridges, market stalls, and taverns. Everything is perpetually damp. The smell of fish, fungus, and adventure.'),
    (zone_deepreach, sim_id, city_id, 'Deepreach',
     'ruins', 'restricted',
     'The oldest part of the kingdom, partially flooded and largely forbidden. The Drowned Library sits here, along with structures that predate capybara civilization. Strange lights flicker in the water. Most residents avoid it after dark.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. AGENTS (5 capybara characters)
-- ============================================================================

INSERT INTO agents (simulation_id, name, system, gender, character, background, created_by_id) VALUES
    (sim_id, 'Commodore Whiskers', 'military', 'male',
     'A grizzled naval commander with a magnificent mustache and one clouded eye. Pragmatic, ruthless when cornered, quietly superstitious.',
     'Commodore Whiskers has sailed the Unterzee for forty years. His flagship, the HMS Hydrochoerus, has charted waters that drove lesser captains mad. He speaks rarely of what he found in the Phosphorescent Abyss, but he never sleeps without a lantern lit.',
     usr_id),
    (sim_id, 'Lady Caplin of Mudhollow', 'politics', 'female',
     'A shrewd aristocrat with immaculate fur and a taste for dangerous alliances. Every smile conceals a calculation.',
     'Lady Caplin controls the Mudhollow Trading Company, the kingdom''s most powerful mercantile house. Her network of informants spans every burrow and waterway. Three rivals have vanished this year — all coincidence, naturally.',
     usr_id),
    (sim_id, 'The Archivist', 'science', 'diverse',
     'An ancient, near-blind capybara who speaks in riddles and remembers things that haven''t happened yet. Obsessed with cataloguing the unknowable.',
     'The Archivist has tended the Drowned Library since before the current dynasty. The texts they guard are written in languages that predate capybara civilization. Some pages rearrange themselves when unobserved. The Archivist claims not to notice.',
     usr_id),
    (sim_id, 'Sister Ember', 'clergy', 'female',
     'A fiercely devout priestess of the Luminous Fungi, whose sermons can move a congregation to tears — or to violence. Compassionate but unyielding.',
     'Sister Ember tends the Great Sporocarp, the kingdom''s holiest site. She believes the bioluminescent fungi are the thoughts of a sleeping god. Her order provides light and medicine to the deep warrens, but demands absolute devotion in return.',
     usr_id),
    (sim_id, 'Barnaby Gnaw', 'civilian', 'male',
     'A cheerful, rotund innkeeper who knows every secret in the kingdom. Disarming warmth conceals a sharp and dangerous mind.',
     'Barnaby runs The Soggy Paw, the most popular tavern in Rootwater. Every faction sends agents to drink there. Barnaby serves them all with equal warmth, memorises everything, and sells nothing — unless the price reshapes the kingdom.',
     usr_id);

-- ============================================================================
-- 7. BUILDINGS (5 locations)
-- ============================================================================

INSERT INTO buildings (simulation_id, name, building_type, building_condition, description, zone_id, population_capacity) VALUES
    (sim_id, 'The Drowned Library', 'special', 'fair',
     'A vast archive built into a flooded cavern. Bookshelves rise from dark water on stone pillars, connected by narrow bridges and rope pulleys. Bioluminescent algae provides a sickly green reading light. Waterlogged texts are preserved by methods no living capybara fully understands. The deeper shelves are forbidden — not locked, merely forbidden. No one has ever needed to explain why.',
     zone_deepreach, 50),
    (sim_id, 'The Great Sporocarp', 'religious', 'excellent',
     'The kingdom''s cathedral — a colossal fungal growth that fills an entire cavern, pulsing with soft amber light. Pilgrims travel days through dangerous tunnels to kneel beneath its cap. The air is thick with spores that induce visions. The priestesses say these are messages. The physicians say it is toxicosis. Both may be correct.',
     zone_warrens, 500),
    (sim_id, 'Rootwater Market', 'commercial', 'good',
     'A bustling subterranean marketplace built along an underground river. Stalls hang from stalactites and cling to cavern walls, connected by swaying rope bridges. Phosphorescent lanterns cast everything in amber and green. Merchants sell fungal delicacies, Unterzee salvage, dubious maps, and secrets wrapped in waxed paper. The air smells of damp fur and exotic spice.',
     zone_docks, 2000),
    (sim_id, 'The Admiralty Grotto', 'government', 'good',
     'Carved into a massive stalagmite, the Admiralty is where the kingdom''s naval and political power converge. War rooms, cartography chambers, and a throne room that no one sits in anymore. The walls are covered in charts of waterways that shift with the tides. A perpetual drip echoes through every corridor, counting something.',
     zone_caverns, 150),
    (sim_id, 'The Soggy Paw Tavern', 'commercial', 'poor',
     'A beloved, ramshackle establishment wedged between two massive tree roots that have broken through the cavern ceiling. The floor is permanently damp. The ale is surprisingly good. Every surface is carved with the initials of patrons — some of whom vanished into the Unterzee decades ago. A battered piano plays itself on Tuesdays. No one questions this.',
     zone_docks, 80);

-- ============================================================================
-- 8. AI SETTINGS (Flux Dev + Sunless Sea style)
-- ============================================================================

-- Image model: Flux Dev for agent portraits
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_model_agent_portrait', '"black-forest-labs/flux-dev"')
ON CONFLICT DO NOTHING;

-- Image model: Flux Dev for building images
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_model_building_image', '"black-forest-labs/flux-dev"')
ON CONFLICT DO NOTHING;

-- Flux-appropriate guidance scale
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_guidance_scale', '3.5')
ON CONFLICT DO NOTHING;

-- Flux-appropriate inference steps
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_num_inference_steps', '28')
ON CONFLICT DO NOTHING;

-- Sunless Sea style prompt for portraits
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_style_prompt_portrait',
    '"dark fantasy portrait, Sunless Sea aesthetic, Victorian gothic underground, bioluminescent lighting in deep green and amber, anthropomorphic capybara in elaborate period clothing, oil painting style, concept art quality, dramatic chiaroscuro lighting, eldritch atmosphere, rich detail, dark cavern background, not photorealistic, not cartoon, not anime, not bright daylight"')
ON CONFLICT DO NOTHING;

-- Sunless Sea style prompt for buildings
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_style_prompt_building',
    '"dark fantasy architecture, Sunless Sea aesthetic, vast underground cavern, bioluminescent fungi and phosphorescent water, Victorian gothic structures, oil painting style, concept art quality, dramatic lighting from below, stalactites and stalagmites, deep greens and amber tones, eldritch atmosphere, rich architectural detail, subterranean, not photorealistic, not bright daylight, not modern"')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 9. PROMPT TEMPLATES (simulation-scoped overrides)
-- ============================================================================

-- Portrait description (EN) — Sunless Sea / capybara aesthetic
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    sim_id, 'portrait_description', 'generation', 'en',
    'Capybara Kingdom Portrait Description (EN)',
    'Describe a portrait of an anthropomorphic capybara character for image generation: {agent_name}.

Character traits: {agent_character}
Background: {agent_background}

AESTHETIC: Dark fantasy in the style of Sunless Sea / Failbetter Games. Victorian gothic,
subterranean setting. Bioluminescent lighting — deep greens, amber, phosphorescent glow.
The character is an anthropomorphic capybara wearing elaborate period clothing appropriate
to their role and station. Oil painting / concept art quality, NOT photorealistic.

COMPOSITION: Head-and-shoulders portrait, single subject, dramatic chiaroscuro lighting
from bioluminescent sources. Dark cavern or underground interior background.
Describe: fur texture and color, facial expression, clothing details, lighting, mood,
any distinctive accessories or marks.
Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: Describe only ONE character.
IMPORTANT: Always include: anthropomorphic capybara, Victorian clothing, bioluminescent lighting, underground, oil painting style.',
    'You are a portrait description specialist for AI image generation. Write concise, visual descriptors for a single anthropomorphic capybara portrait in a dark fantasy, Sunless Sea aesthetic. Victorian gothic, bioluminescent underground setting.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 200, false, usr_id
) ON CONFLICT DO NOTHING;

-- Building image description (EN) — Sunless Sea / underground architecture
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    sim_id, 'building_image_description', 'generation', 'en',
    'Capybara Kingdom Building Image Description (EN)',
    'Describe an architectural scene of a subterranean building for image generation.

Building: {building_name}
Type: {building_type}
Condition: {building_condition}
Style: {building_style}
Special type: {special_type}
Construction year: {construction_year}
Description: {building_description}
Zone: {zone_name}

AESTHETIC: Dark fantasy architecture in the style of Sunless Sea / Failbetter Games.
Vast underground caverns, bioluminescent fungi and phosphorescent water providing light.
Victorian gothic structures adapted for subterranean life. Stalactites, stalagmites,
underground rivers. Oil painting / concept art quality, NOT photorealistic.

Based on these properties, describe the building visually.
The CONDITION is critical — "ruined" shows structural collapse, flooded sections, crumbling stone.
"Poor" shows neglect, damp rot, flickering lights. "Fair" is functional but worn by centuries underground.
"Good" is well-maintained. "Excellent" is pristine and impressive.

The BUILDING TYPE affects architecture — government buildings are carved into massive stalagmites,
religious buildings incorporate living fungal growths, commercial buildings cling to cavern walls
over waterways, special buildings sit in the deepest and most ancient caverns.

Write as an image generation prompt — comma-separated descriptors, no sentences.
Include: architectural style, materials (stone, fungal wood, iron), condition, bioluminescent lighting, atmosphere, scale.
IMPORTANT: Always include: underground cavern, bioluminescent, Victorian gothic, oil painting style, dark fantasy, stalactites.',
    'You are an architectural description specialist for AI image generation. Write concise, visual descriptors for building scenes in a dark fantasy, Sunless Sea aesthetic. Subterranean, bioluminescent, Victorian gothic.',
    '[{"name": "building_name"}, {"name": "building_type"}, {"name": "building_condition"}, {"name": "building_style"}, {"name": "special_type"}, {"name": "construction_year"}, {"name": "building_description"}, {"name": "zone_name"}, {"name": "simulation_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 200, false, usr_id
) ON CONFLICT DO NOTHING;


RAISE NOTICE 'Capybara Kingdom seed complete: 1 simulation, 1 city, 4 zones, 5 agents, 5 buildings, 6 AI settings, 2 prompt templates';
END $$;

COMMIT;

-- =============================================================================
-- Verification
-- =============================================================================
SELECT 'simulation' as entity, count(*) as count FROM simulations WHERE id = '20000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'members', count(*) FROM simulation_members WHERE simulation_id = '20000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'taxonomies', count(*) FROM simulation_taxonomies WHERE simulation_id = '20000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'agents', count(*) FROM agents WHERE simulation_id = '20000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'buildings', count(*) FROM buildings WHERE simulation_id = '20000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'cities', count(*) FROM cities WHERE simulation_id = '20000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'zones', count(*) FROM zones WHERE simulation_id = '20000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'settings', count(*) FROM simulation_settings WHERE simulation_id = '20000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'templates', count(*) FROM prompt_templates WHERE simulation_id = '20000000-0000-0000-0000-000000000001';
