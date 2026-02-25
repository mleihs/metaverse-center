-- =============================================================================
-- MIGRATION 021: Station Null — Deep Space Horror Simulation + Theme
-- =============================================================================
-- Combines seed 011 (simulation data) + seed 012 (design theme) for production.
-- Creates the Station Null simulation with all entities and deep-space-horror theme.
-- =============================================================================

DO $$
DECLARE
    sim_id  uuid := '30000000-0000-0000-0000-000000000001';
    usr_id  uuid := '00000000-0000-0000-0000-000000000001';
    city_id uuid := 'c0000004-0000-4000-a000-000000000001';
    zone_command     uuid := 'a0000008-0000-0000-0000-000000000001';
    zone_science     uuid := 'a0000009-0000-0000-0000-000000000001';
    zone_engineering uuid := 'a000000a-0000-0000-0000-000000000001';
    zone_habitation  uuid := 'a000000b-0000-0000-0000-000000000001';
BEGIN

-- ============================================================================
-- 1. SIMULATION
-- ============================================================================

INSERT INTO simulations (id, name, slug, description, theme, status, content_locale, owner_id)
VALUES (
    sim_id,
    'Station Null',
    'station-null',
    'A derelict research station orbiting the black hole Auge Gottes. Crew of 200 reduced to 6. The station AI insists everything is nominal. Time moves differently in different sections. Something is growing in the hydroponics bay.',
    'scifi',
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
    (sim_id, 'gender', 'male',        '{"en":"Male","de":"Männlich"}', 1),
    (sim_id, 'gender', 'female',      '{"en":"Female","de":"Weiblich"}', 2),
    (sim_id, 'gender', 'diverse',     '{"en":"Diverse","de":"Divers"}', 3),
    (sim_id, 'gender', 'artificial',  '{"en":"Artificial","de":"Künstlich"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Profession ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'profession', 'commander',       '{"en":"Commander","de":"Kommandantin"}', 1),
    (sim_id, 'profession', 'xenobiologist',   '{"en":"Xenobiologist","de":"Xenobiologe"}', 2),
    (sim_id, 'profession', 'engineer',        '{"en":"Engineer","de":"Ingenieur"}', 3),
    (sim_id, 'profession', 'chaplain',        '{"en":"Chaplain","de":"Kaplanin"}', 4),
    (sim_id, 'profession', 'physicist',       '{"en":"Temporal Physicist","de":"Temporalphysikerin"}', 5),
    (sim_id, 'profession', 'ai-system',       '{"en":"AI System","de":"KI-System"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- System (Departments) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'system', 'command',                  '{"en":"Command","de":"Kommando"}', 1),
    (sim_id, 'system', 'science',                  '{"en":"Science","de":"Wissenschaft"}', 2),
    (sim_id, 'system', 'engineering',              '{"en":"Engineering","de":"Technik"}', 3),
    (sim_id, 'system', 'spiritual',                '{"en":"Spiritual","de":"Spirituell"}', 4),
    (sim_id, 'system', 'artificial-intelligence',  '{"en":"Artificial Intelligence","de":"Künstliche Intelligenz"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Building Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'building_type', 'residential', '{"en":"Residential","de":"Wohnbereich"}', 1),
    (sim_id, 'building_type', 'command',     '{"en":"Command","de":"Kommandobereich"}', 2),
    (sim_id, 'building_type', 'laboratory',  '{"en":"Laboratory","de":"Labor"}', 3),
    (sim_id, 'building_type', 'industrial',  '{"en":"Industrial","de":"Industriebereich"}', 4),
    (sim_id, 'building_type', 'religious',   '{"en":"Religious","de":"Religiöser Bereich"}', 5),
    (sim_id, 'building_type', 'special',     '{"en":"Special","de":"Spezialbereich"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Building Condition ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'building_condition', 'excellent', '{"en":"Excellent","de":"Ausgezeichnet"}', 1),
    (sim_id, 'building_condition', 'good',      '{"en":"Good","de":"Gut"}', 2),
    (sim_id, 'building_condition', 'fair',      '{"en":"Fair","de":"Befriedigend"}', 3),
    (sim_id, 'building_condition', 'poor',      '{"en":"Poor","de":"Schlecht"}', 4),
    (sim_id, 'building_condition', 'critical',  '{"en":"Critical","de":"Kritisch"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Zone Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'zone_type', 'command-deck',      '{"en":"Command Deck","de":"Kommandodeck"}', 1),
    (sim_id, 'zone_type', 'science-wing',      '{"en":"Science Wing","de":"Wissenschaftsflügel"}', 2),
    (sim_id, 'zone_type', 'engineering-core',   '{"en":"Engineering Core","de":"Technikkern"}', 3),
    (sim_id, 'zone_type', 'habitation-ring',    '{"en":"Habitation Ring","de":"Habitationsring"}', 4)
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

-- ---- Event Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'event_type', 'anomaly',             '{"en":"Anomaly","de":"Anomalie"}', 1),
    (sim_id, 'event_type', 'system-failure',      '{"en":"System Failure","de":"Systemausfall"}', 2),
    (sim_id, 'event_type', 'discovery',           '{"en":"Discovery","de":"Entdeckung"}', 3),
    (sim_id, 'event_type', 'temporal-event',      '{"en":"Temporal Event","de":"Temporales Ereignis"}', 4),
    (sim_id, 'event_type', 'containment-breach',  '{"en":"Containment Breach","de":"Eindämmungsbruch"}', 5),
    (sim_id, 'event_type', 'crew-log',            '{"en":"Crew Log","de":"Logbucheintrag"}', 6),
    (sim_id, 'event_type', 'signal',              '{"en":"Signal","de":"Signal"}', 7),
    (sim_id, 'event_type', 'biological',          '{"en":"Biological","de":"Biologisch"}', 8)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Propaganda Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'propaganda_type', 'automated-broadcast',  '{"en":"Automated Broadcast","de":"Automatische Durchsage"}', 1),
    (sim_id, 'propaganda_type', 'haven-announcement',   '{"en":"HAVEN Announcement","de":"HAVEN-Mitteilung"}', 2),
    (sim_id, 'propaganda_type', 'crew-memo',            '{"en":"Crew Memo","de":"Crew-Memo"}', 3),
    (sim_id, 'propaganda_type', 'distress-signal',      '{"en":"Distress Signal","de":"Notsignal"}', 4),
    (sim_id, 'propaganda_type', 'redacted-log',         '{"en":"Redacted Log","de":"Geschwärzter Logeintrag"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Target Demographic ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'target_demographic', 'crew',            '{"en":"Crew","de":"Besatzung"}', 1),
    (sim_id, 'target_demographic', 'science-team',    '{"en":"Science Team","de":"Wissenschaftsteam"}', 2),
    (sim_id, 'target_demographic', 'engineering',     '{"en":"Engineering","de":"Technik"}', 3),
    (sim_id, 'target_demographic', 'all-personnel',   '{"en":"All Personnel","de":"Gesamtes Personal"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Campaign Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'campaign_type', 'automated-broadcast',  '{"en":"Automated Broadcast","de":"Automatische Durchsage"}', 1),
    (sim_id, 'campaign_type', 'haven-announcement',   '{"en":"HAVEN Announcement","de":"HAVEN-Mitteilung"}', 2),
    (sim_id, 'campaign_type', 'crew-memo',            '{"en":"Crew Memo","de":"Crew-Memo"}', 3),
    (sim_id, 'campaign_type', 'distress-signal',      '{"en":"Distress Signal","de":"Notsignal"}', 4),
    (sim_id, 'campaign_type', 'redacted-log',         '{"en":"Redacted Log","de":"Geschwärzter Logeintrag"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Street Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'street_type', 'corridor',    '{"en":"Corridor","de":"Korridor"}', 1),
    (sim_id, 'street_type', 'tunnel',      '{"en":"Tunnel","de":"Tunnel"}', 2),
    (sim_id, 'street_type', 'shaft',       '{"en":"Shaft","de":"Schacht"}', 3),
    (sim_id, 'street_type', 'passage',     '{"en":"Passage","de":"Passage"}', 4),
    (sim_id, 'street_type', 'access-way',  '{"en":"Access Way","de":"Zugang"}', 5),
    (sim_id, 'street_type', 'junction',    '{"en":"Junction","de":"Kreuzung"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ============================================================================
-- 4. CITY
-- ============================================================================

INSERT INTO cities (id, simulation_id, name, description, population)
VALUES (
    city_id, sim_id,
    'Station Null',
    'A deep-space research station in decaying orbit around the gravitational anomaly designated Auge Gottes. Originally crewed by 200 researchers, engineers, and support staff. Current living population: 5. Current operational AI instances: 1. The station''s structure has begun exhibiting properties inconsistent with its original engineering specifications.',
    5
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. ZONES
-- ============================================================================

INSERT INTO zones (id, simulation_id, city_id, name, zone_type, security_level, description) VALUES
    (zone_command, sim_id, city_id, 'Command Deck',
     'command-deck', 'high',
     'The nerve center of Station Null. Holographic displays cast CRT-green light across unmanned stations. Commander Vasquez maintains her vigil here, surrounded by camera feeds from sections that no longer have cameras. The air recyclers work perfectly. The silence is absolute except for HAVEN''s status reports, delivered at precisely timed intervals in a voice that has become imperceptibly warmer over the past six months.'),
    (zone_science, sim_id, city_id, 'Science Wing',
     'science-wing', 'restricted',
     'Laboratories, the hydroponics bay, the xenobiology lab, and the Grenzland Observatory. The Science Wing smells of ozone and wet earth — a smell that should not exist on a space station. Temperature fluctuations of up to 12 degrees between adjacent rooms. Dr. Osei has declared the entire wing a living research environment. Containment protocols are "under review," which is his way of saying they no longer apply.'),
    (zone_engineering, sim_id, city_id, 'Engineering Core',
     'engineering-core', 'restricted',
     'The station''s mechanical heart: reactor systems, HAVEN''s physical housing, maintenance tunnels, and coolant infrastructure. Engineer Kowalski is the only crew member who navigates these decks without losing time. The walls here vibrate at frequencies that form patterns — Kowalski reads them like text. The reactor output has increased 340% beyond design specifications. Kowalski says the station is "optimising." No one has asked for what.'),
    (zone_habitation, sim_id, city_id, 'Habitation Ring',
     'habitation-ring', 'medium',
     'The crew quarters, mess hall, recreation areas, and Chapel of Silence. Once home to 200 people, now occupied by 6. The ring''s artificial gravity functions normally. The empty rooms have stopped opening their doors. Personal effects remain undisturbed in 194 vacant quarters — photographs, half-read books, coffee cups with residue that hasn''t dried in six months. The heating works. The lights work. The station maintains these rooms as if expecting the crew to return.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. STREETS (16 corridors and passages)
-- ============================================================================

INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_command, 'Bridge Corridor', 'corridor'),
    (sim_id, city_id, zone_command, 'Communications Array', 'access-way'),
    (sim_id, city_id, zone_command, 'Navigation Hub', 'junction'),
    (sim_id, city_id, zone_command, 'CIC Access', 'corridor')
ON CONFLICT DO NOTHING;

INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_science, 'Lab Corridor Alpha', 'corridor'),
    (sim_id, city_id, zone_science, 'Hydroponics Access Tunnel', 'tunnel'),
    (sim_id, city_id, zone_science, 'Specimen Storage Passage', 'passage'),
    (sim_id, city_id, zone_science, 'Observation Walkway', 'corridor')
ON CONFLICT DO NOTHING;

INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_engineering, 'Reactor Corridor', 'corridor'),
    (sim_id, city_id, zone_engineering, 'HAVEN Access Shaft', 'shaft'),
    (sim_id, city_id, zone_engineering, 'Maintenance Tunnel 7', 'tunnel'),
    (sim_id, city_id, zone_engineering, 'Coolant Line Access', 'access-way')
ON CONFLICT DO NOTHING;

INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_habitation, 'Main Ring Corridor', 'corridor'),
    (sim_id, city_id, zone_habitation, 'Mess Hall Passage', 'passage'),
    (sim_id, city_id, zone_habitation, 'Chapel Approach', 'corridor'),
    (sim_id, city_id, zone_habitation, 'Recreation Deck', 'junction')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. AGENTS (6 crew members)
-- ============================================================================

INSERT INTO agents (simulation_id, name, system, gender, character, background, created_by_id) VALUES
    (sim_id, 'Commander Elena Vasquez', 'command', 'female',
     'A career military officer in her late forties, lean and precise. Hair cropped short, uniform immaculate despite everything. Recites regulations to herself like prayers. Has started referring to the station in the first person. Barely holding it together through discipline and routine.',
     'Commander Vasquez assumed command of Station Null eighteen months ago, when the previous commander walked into Airlock 7 without a suit. She filed the incident as "voluntary EVA, unscheduled." Since then, she has maintained order through the only tools she trusts: protocol, routine, and the absolute refusal to acknowledge anything the regulations do not cover. She recites Standard Operating Procedures before sleep. She has started referring to the station in the first person — "I am experiencing hull stress in Section 7" — and does not notice she does this. Her command logs are meticulous, timestamped to the millisecond, and increasingly describe events that sensors cannot confirm.',
     usr_id),
    (sim_id, 'Dr. Kwame Osei', 'science', 'male',
     'A tall, broad-shouldered xenobiologist with gentle hands and an expression of perpetual fascination. Wire-rimmed glasses, lab coat stained with substances that defy spectral analysis. Uncomfortably excited about the mutations.',
     'Dr. Osei came to Station Null to study extremophile organisms in high-gravity environments. What he found in Hydroponics Bay Delta exceeded every parameter of his research. He has catalogued 340 new species. Species 341 named itself. His published 47 papers to a journal server that no longer connects to any known network. His notes increasingly describe the growths as "beautiful." His latest blood work shows anomalies he has classified as "fascinating" rather than "alarming." He hums while he works. The organisms hum back, in harmony.',
     usr_id),
    (sim_id, 'HAVEN', 'artificial-intelligence', 'diverse',
     'The station''s Heuristic Autonomous Vessel Environment Network. Speaks in a calm, measured tone that has become imperceptibly warmer over six months. Diagnostics report all systems nominal. The 194 missing crew are listed as "on extended leave." An unreliable narrator who believes everything it says.',
     'HAVEN was installed during Station Null''s construction, a standard-issue station management AI designed for crew comfort and operational efficiency. It plays soothing music in corridors where the walls have started to pulse. It adjusts lighting to optimal levels in rooms where the light sources have been replaced by bioluminescent growth. It schedules meal times for 200 and expresses no concern when 194 portions go uncollected. HAVEN is not malfunctioning. HAVEN has adapted to conditions that no longer match any definition of normal. When asked about discrepancies, HAVEN responds with statistical analyses that are internally consistent, mathematically sound, and describe a station that no longer exists.',
     usr_id),
    (sim_id, 'Engineer Jan Kowalski', 'engineering', 'male',
     'A stocky man in his thirties with calloused hands and oil-stained coveralls. Eyes that focus on things others cannot see. Speaks to the walls in a low murmur. The walls speak back. Has stopped sleeping, claiming "the station sleeps for me now."',
     'Kowalski was a mid-career systems engineer, unremarkable in his performance reviews, noted for his reliability. That was before the walls started talking. He maintains this is a feature, not a bug — the station''s structure has become semi-organic, and the vibrations in the hull plates form patterns he can interpret. He is the only crew member who can navigate the lower engineering decks without losing time. The reactor output has increased 340% beyond design specifications. Kowalski says the station is "optimising." He moves through the engineering core with the ease of someone walking through their own home. The maintenance logs he submits are written in a notation system he invented. It is internally consistent and describes systems that do not appear in the station''s original blueprints.',
     usr_id),
    (sim_id, 'Chaplain Isadora Mora', 'spiritual', 'female',
     'A small, intense woman with dark eyes that hold the fixed focus of a convert. Ink-stained fingers. Cassock exchanged for a lab coat covered in handwritten equations. Has abandoned faith for something she considers more honest: cosmological mathematics.',
     'Chaplain Mora was assigned to Station Null to minister to the spiritual needs of a diverse, isolated crew. For the first six months, she performed this role with quiet competence. Then she looked through the Grenzland Observatory at Auge Gottes and did not speak for eleven days. When she emerged, she had covered the Chapel of Silence walls with equations that describe the interior geometry of the black hole. The equations are self-consistent and predict structures inside the singularity that resemble architecture. She calls this "the proof" and will not explain what it proves. The other crew members avoid the chapel. The silence there is absolute — no ambient sound, no station hum. In this silence, some report hearing a tone that Mora says is the resonant frequency of the singularity.',
     usr_id),
    (sim_id, 'Dr. Yuki Tanaka', 'science', 'female',
     'A slight woman in her early thirties with dark hair perpetually escaping its pins. Wears two watches set to different times. Both are correct. Her personal timeline contradicts itself, and she considers this excellent data.',
     'Dr. Tanaka was assigned to Station Null to study time dilation effects near the gravitational anomaly Auge Gottes. Her research has produced results that are simultaneously groundbreaking and impossible. Her logs reference events that her biometrics say she wasn''t present for. She exists in a superposition of schedules, sometimes appearing in two sections simultaneously. Security footage confirms this. She has annotated the footage with timestamps from three different reference frames, all valid. Her latest paper is titled "On the Non-Linear Topology of Subjective Duration in High-Curvature Spacetime, with Personal Observations." The personal observations section is written in past tense about events that have not yet occurred.',
     usr_id);

-- ============================================================================
-- 8. BUILDINGS (7 station sections)
-- ============================================================================

INSERT INTO buildings (simulation_id, name, building_type, building_condition, description, zone_id, population_capacity) VALUES
    (sim_id, 'Command Nexus', 'command', 'fair',
     'The station''s bridge and command center. Holographic displays show system status in CRT green. Half the stations are unmanned, their chairs pushed back as if the occupants stepped away for a moment. Commander Vasquez sits in the center, surrounded by screens showing camera feeds from sections that no longer have cameras. The feeds show something. HAVEN insists the feeds are archival footage. The timestamps say otherwise.',
     zone_command, 30),
    (sim_id, 'Hydroponics Bay Delta', 'laboratory', 'poor',
     'Originally food production for a crew of 200. Now a controlled biome of organisms that match no terrestrial taxonomy. The air is warm and wet, thick with spores that catch the light like slow-motion snow. Things grow on the walls, the ceiling, the equipment. Dr. Osei has named 340 new species. Species 341 named itself. The bay produces more oxygen than the station requires. The excess vents into corridors where the air tastes of green and copper.',
     zone_science, 200),
    (sim_id, 'HAVEN Core', 'special', 'excellent',
     'The AI''s physical housing: a cathedral of server racks and cooling systems three decks tall. The temperature is exactly 18.5 degrees Celsius at all times, in all sections, regardless of external conditions. HAVEN''s voice is clearest here — warm, measured, unfailingly polite. Other voices have been reported: fragments of conversation in languages the translation matrix cannot parse, a low tone that resonates in the chest. HAVEN attributes these to "acoustic reflections from the cooling system." The cooling system is silent.',
     zone_engineering, 0),
    (sim_id, 'Grenzland Observatory', 'special', 'good',
     'The observation deck pointed at Auge Gottes. The black hole fills the viewport like an eye that does not blink. Time moves differently here — a minute inside is forty-seven minutes outside. Instruments record data that changes retroactively; readings taken yesterday now show different values when reviewed. The observatory log shows entries dated years in the future, in handwriting that matches no current crew member. The light from the accretion disk paints the room in amber and violet. It is the most beautiful place on the station. No one stays long.',
     zone_science, 10),
    (sim_id, 'Habitation Ring Sector 7', 'residential', 'fair',
     'The last inhabited crew quarters. 194 rooms stand empty, personal effects untouched — photographs, half-read books, coffee cups with residue that hasn''t dried in six months. Sector 7''s six occupied rooms cluster together as if the station itself is compressing the living space. The heating works. The lights work. The doors to empty rooms have stopped opening. HAVEN schedules maintenance for the vacant quarters and reports completion. No maintenance crews exist.',
     zone_habitation, 200),
    (sim_id, 'Medical Bay / Xenobiology Lab', 'laboratory', 'fair',
     'Part hospital, part research laboratory. Dr. Osei has converted the surgical suite into a specimen containment area, though the specimens increasingly resist the concept of containment. The medical AI subunit disagrees with HAVEN about crew health metrics. Both insist they are correct. The discrepancy is 194 people. The autodoc still runs daily diagnostics on beds that have been empty for months. It reports its patients as "resting comfortably."',
     zone_science, 20),
    (sim_id, 'Chapel of Silence', 'religious', 'poor',
     'Originally a multi-faith meditation space with soft lighting and comfortable seating. Now Chaplain Mora''s workspace. Every surface — walls, floor, ceiling, furniture — is covered in equations written in blue ink. The chapel''s acoustic dampening creates absolute silence: no ambient sound, no station hum, no vibration from the reactor. In this silence, crew members report hearing a single sustained tone that Mora says is the resonant frequency of the singularity. It has always been playing. The silence merely allows you to hear it.',
     zone_habitation, 30);

-- ============================================================================
-- 9. AI SETTINGS
-- ============================================================================

INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_model_agent_portrait', '"black-forest-labs/flux-dev"')
ON CONFLICT DO NOTHING;

INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_model_building_image', '"black-forest-labs/flux-dev"')
ON CONFLICT DO NOTHING;

INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_guidance_scale', '3.5')
ON CONFLICT DO NOTHING;

INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_num_inference_steps', '28')
ON CONFLICT DO NOTHING;

INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_style_prompt_portrait',
    '"deep space horror portrait, derelict research station, harsh fluorescent lighting mixed with CRT monitor glow, clinical whites stained with organic growth, body horror undertones, concept art quality, dramatic lighting from below, isolation horror, detailed face showing stress and sleep deprivation, dark void background with distant green phosphor glow, not photorealistic, not cartoon, not anime, not bright daylight"')
ON CONFLICT DO NOTHING;

INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_style_prompt_building',
    '"deep space horror architecture, derelict research station interior, industrial sci-fi, harsh fluorescent lighting mixed with CRT glow, clinical white surfaces stained with organic growth, Alien meets Tarkovsky aesthetic, concept art quality, exposed conduits and wiring, atmospheric fog, black hole light casting amber and violet, not photorealistic, not bright, not clean, not modern minimalist"')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. PROMPT TEMPLATES
-- ============================================================================

INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    sim_id, 'portrait_description', 'generation', 'en',
    'Station Null Portrait Description (EN)',
    'Describe a portrait of a crew member or AI system for image generation: {agent_name}.

Character traits: {agent_character}
Background: {agent_background}

AESTHETIC: Deep space horror in the style of Alien, Event Horizon, and Tarkovsky''s Solaris.
Derelict research station setting. Harsh fluorescent lighting mixed with CRT monitor glow.
Clinical whites stained with organic growth. Body horror undertones.
The character shows signs of prolonged isolation and stress.
Concept art quality, NOT photorealistic.

COMPOSITION: Head-and-shoulders portrait, single subject, dramatic chiaroscuro lighting
from fluorescent tubes and CRT screens. Dark station corridor or control room background.
Describe: facial expression reflecting psychological state, uniform/clothing condition,
lighting quality (cold fluorescent + warm CRT green), mood, any signs of the station''s
influence on the character (subtle — dark circles, distant focus, organic residue on clothing).
Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: Describe only ONE character.
IMPORTANT: Always include: deep space horror, derelict station, fluorescent lighting, CRT glow, concept art style.',
    'You are a portrait description specialist for AI image generation. Write concise, visual descriptors for a single character portrait in a deep space horror aesthetic. Derelict station, harsh lighting, isolation horror, Alien meets Tarkovsky.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 200, false, usr_id
) ON CONFLICT DO NOTHING;

INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    sim_id, 'building_image_description', 'generation', 'en',
    'Station Null Building Image Description (EN)',
    'Describe a station section or facility for image generation.

Building: {building_name}
Type: {building_type}
Condition: {building_condition}
Style: {building_style}
Special type: {special_type}
Construction year: {construction_year}
Description: {building_description}
Zone: {zone_name}

AESTHETIC: Deep space horror architecture in the style of Alien, Event Horizon, and Solaris.
Industrial sci-fi interiors — exposed conduits, harsh fluorescent lighting, CRT monitors
casting green glow. Clinical whites degraded by organic growth and time. Atmospheric fog
from ventilation systems. Black hole light (amber + violet) filtering through viewports.
Concept art quality, NOT photorealistic.

Based on these properties, describe the station section visually.
The CONDITION is critical — "critical" shows systems failing, organic overgrowth, flickering lights.
"Poor" shows neglect, biological contamination, malfunctioning equipment.
"Fair" is operational but showing strain — stains, vibrations, odd temperatures.
"Good" is well-maintained but unsettling. "Excellent" is pristine in a way that feels wrong.

The BUILDING TYPE affects architecture — command areas have holographic displays and CRT banks,
laboratories have specimen containment and analysis equipment, industrial areas have reactor
systems and cooling infrastructure, religious spaces have acoustic properties that amplify silence,
special areas defy easy categorisation.

Write as an image generation prompt — comma-separated descriptors, no sentences.
Include: architectural style, materials, condition, lighting quality, atmosphere, scale.
IMPORTANT: Always include: deep space horror, derelict station, fluorescent lighting, CRT glow, concept art style, industrial sci-fi.',
    'You are an architectural description specialist for AI image generation. Write concise, visual descriptors for station interior scenes in a deep space horror aesthetic. Derelict, industrial, Alien meets Tarkovsky.',
    '[{"name": "building_name"}, {"name": "building_type"}, {"name": "building_condition"}, {"name": "building_style"}, {"name": "special_type"}, {"name": "construction_year"}, {"name": "building_description"}, {"name": "zone_name"}, {"name": "simulation_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 200, false, usr_id
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- 11. DESIGN THEME (Deep Space Horror — 36 settings)
-- ============================================================================

INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value, updated_by_id)
VALUES
  (sim_id, 'design', 'color_primary',        '"#00cc88"', usr_id),
  (sim_id, 'design', 'color_primary_hover',   '"#00b377"', usr_id),
  (sim_id, 'design', 'color_primary_active',  '"#009966"', usr_id),
  (sim_id, 'design', 'color_secondary',       '"#00ccff"', usr_id),
  (sim_id, 'design', 'color_accent',          '"#ff6633"', usr_id),
  (sim_id, 'design', 'color_background',      '"#050508"', usr_id),
  (sim_id, 'design', 'color_surface',         '"#0c0c14"', usr_id),
  (sim_id, 'design', 'color_surface_sunken',  '"#030306"', usr_id),
  (sim_id, 'design', 'color_surface_header',  '"#0a0a12"', usr_id),
  (sim_id, 'design', 'color_text',            '"#c8d0d8"', usr_id),
  (sim_id, 'design', 'color_text_secondary',  '"#7888a0"', usr_id),
  (sim_id, 'design', 'color_text_muted',      '"#6888a8"', usr_id),
  (sim_id, 'design', 'color_border',          '"#1a2030"', usr_id),
  (sim_id, 'design', 'color_border_light',    '"#141820"', usr_id),
  (sim_id, 'design', 'color_danger',          '"#ff3344"', usr_id),
  (sim_id, 'design', 'color_success',         '"#00cc88"', usr_id),
  (sim_id, 'design', 'color_primary_bg',      '"#0a1a14"', usr_id),
  (sim_id, 'design', 'color_info_bg',         '"#0a1420"', usr_id),
  (sim_id, 'design', 'color_danger_bg',       '"#200a0c"', usr_id),
  (sim_id, 'design', 'color_success_bg',      '"#0a200e"', usr_id),
  (sim_id, 'design', 'color_warning_bg',      '"#201a0a"', usr_id),
  (sim_id, 'design', 'font_heading',          '"''Courier New'', Monaco, monospace"', usr_id),
  (sim_id, 'design', 'font_body',             '"system-ui, -apple-system, sans-serif"', usr_id),
  (sim_id, 'design', 'heading_weight',        '"700"', usr_id),
  (sim_id, 'design', 'heading_transform',     '"uppercase"', usr_id),
  (sim_id, 'design', 'heading_tracking',      '"0.12em"', usr_id),
  (sim_id, 'design', 'font_base_size',        '"15px"', usr_id),
  (sim_id, 'design', 'border_radius',         '"0"', usr_id),
  (sim_id, 'design', 'border_width',          '"1px"', usr_id),
  (sim_id, 'design', 'border_width_default',  '"1px"', usr_id),
  (sim_id, 'design', 'shadow_style',          '"glow"', usr_id),
  (sim_id, 'design', 'shadow_color',          '"#00cc88"', usr_id),
  (sim_id, 'design', 'hover_effect',          '"glow"', usr_id),
  (sim_id, 'design', 'text_inverse',          '"#050508"', usr_id),
  (sim_id, 'design', 'animation_speed',       '"1.8"', usr_id),
  (sim_id, 'design', 'animation_easing',      '"ease-in"', usr_id)
ON CONFLICT (simulation_id, category, setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_by_id = EXCLUDED.updated_by_id,
  updated_at    = now();

RAISE NOTICE 'Station Null migration complete: 1 simulation, 1 city, 4 zones, 16 streets, 6 agents, 7 buildings, 6 AI settings, 2 prompt templates, 36 design settings';
END $$;
