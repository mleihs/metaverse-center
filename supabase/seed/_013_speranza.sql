-- =============================================================================
-- SEED 013: Speranza — Arc Raiders Post-Apocalyptic Simulation
-- =============================================================================
-- The oldest contrada in Toledo, a vast underground city built into sinkholes
-- in post-apocalyptic Italy (year 2180). ARC machines harvest the surface;
-- Raiders venture Topside to scavenge. Based on Arc Raiders by Embark Studios.
-- Hope as resistance. 1970s NASA-punk aesthetic.
--
-- Creates: simulation, membership, taxonomies, city, 4 zones, 16 streets,
--          6 agents, 7 buildings, AI settings (Flux Dev), prompt templates.
--
-- Depends on: seed 001 (test user must exist)
-- =============================================================================

BEGIN;

DO $$
DECLARE
    sim_id  uuid := '40000000-0000-0000-0000-000000000001';
    usr_id  uuid := '00000000-0000-0000-0000-000000000001';
    city_id uuid := 'c0000005-0000-4000-a000-000000000001';
    zone_hub        uuid := 'a000000c-0000-0000-0000-000000000001';
    zone_workshops  uuid := 'a000000d-0000-0000-0000-000000000001';
    zone_quarters   uuid := 'a000000e-0000-0000-0000-000000000001';
    zone_topside    uuid := 'a000000f-0000-0000-0000-000000000001';
BEGIN

-- ============================================================================
-- 1. SIMULATION
-- ============================================================================

INSERT INTO simulations (id, name, slug, description, theme, status, content_locale, owner_id)
VALUES (
    sim_id,
    'Speranza',
    'speranza',
    'The oldest contrada in Toledo, an underground city built into limestone sinkholes beneath post-apocalyptic Italy. Year 2180. ARC machines harvest the surface. Raiders go Topside to scavenge what the machines haven''t taken. The Tube network connects the contrade. Speranza means hope, and they mean it.',
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
    (sim_id, 'gender', 'male',    '{"en":"Male","de":"Männlich"}', 1),
    (sim_id, 'gender', 'female',  '{"en":"Female","de":"Weiblich"}', 2),
    (sim_id, 'gender', 'diverse', '{"en":"Diverse","de":"Divers"}', 3)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Profession ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'profession', 'raider',             '{"en":"Raider","de":"Raiderin"}', 1),
    (sim_id, 'profession', 'mechanic',           '{"en":"Mechanic","de":"Mechaniker"}', 2),
    (sim_id, 'profession', 'slingshot-operator',  '{"en":"Slingshot Operator","de":"Slingshot-Operatorin"}', 3),
    (sim_id, 'profession', 'trader',             '{"en":"Trader","de":"Händlerin"}', 4),
    (sim_id, 'profession', 'medic',              '{"en":"Medic","de":"Sanitäter"}', 5),
    (sim_id, 'profession', 'recruit',            '{"en":"Recruit","de":"Rekrut"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- System (Organisations) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'system', 'raid-squads',       '{"en":"Raid Squads","de":"Raidtrupps"}', 1),
    (sim_id, 'system', 'guild-of-gears',    '{"en":"Guild of Gears","de":"Gilde der Zahnräder"}', 2),
    (sim_id, 'system', 'tube-network',      '{"en":"Tube Network","de":"Röhrennetz"}', 3),
    (sim_id, 'system', 'contrada-council',  '{"en":"Contrada Council","de":"Contrada-Rat"}', 4),
    (sim_id, 'system', 'topside-watch',     '{"en":"Topside Watch","de":"Oberwelt-Wache"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Building Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'building_type', 'residential',     '{"en":"Residential","de":"Wohnbereich"}', 1),
    (sim_id, 'building_type', 'commercial',      '{"en":"Commercial","de":"Gewerbebereich"}', 2),
    (sim_id, 'building_type', 'industrial',      '{"en":"Industrial","de":"Industriebereich"}', 3),
    (sim_id, 'building_type', 'military',        '{"en":"Military","de":"Militärbereich"}', 4),
    (sim_id, 'building_type', 'infrastructure',  '{"en":"Infrastructure","de":"Infrastruktur"}', 5),
    (sim_id, 'building_type', 'medical',         '{"en":"Medical","de":"Medizinbereich"}', 6),
    (sim_id, 'building_type', 'social',          '{"en":"Social","de":"Sozialbereich"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Building Condition ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'building_condition', 'excellent',  '{"en":"Excellent","de":"Ausgezeichnet"}', 1),
    (sim_id, 'building_condition', 'good',       '{"en":"Good","de":"Gut"}', 2),
    (sim_id, 'building_condition', 'fair',       '{"en":"Fair","de":"Befriedigend"}', 3),
    (sim_id, 'building_condition', 'poor',       '{"en":"Poor","de":"Schlecht"}', 4),
    (sim_id, 'building_condition', 'makeshift',  '{"en":"Makeshift","de":"Behelfsmäßig"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Zone Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'zone_type', 'hub',             '{"en":"Hub","de":"Zentrum"}', 1),
    (sim_id, 'zone_type', 'workshop',        '{"en":"Workshop","de":"Werkstatt"}', 2),
    (sim_id, 'zone_type', 'quarters',        '{"en":"Quarters","de":"Quartiere"}', 3),
    (sim_id, 'zone_type', 'topside-access',  '{"en":"Topside Access","de":"Oberwelt-Zugang"}', 4)
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

-- ---- Event Type (Arc Raiders themed) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'event_type', 'arc-sighting',        '{"en":"ARC Sighting","de":"ARC-Sichtung"}', 1),
    (sim_id, 'event_type', 'raid',                '{"en":"Raid","de":"Raid"}', 2),
    (sim_id, 'event_type', 'trade-event',         '{"en":"Trade Event","de":"Handelsereignis"}', 3),
    (sim_id, 'event_type', 'tube-disruption',     '{"en":"Tube Disruption","de":"Röhrenstörung"}', 4),
    (sim_id, 'event_type', 'contrada-assembly',   '{"en":"Contrada Assembly","de":"Contrada-Versammlung"}', 5),
    (sim_id, 'event_type', 'surface-breach',      '{"en":"Surface Breach","de":"Oberflächendurchbruch"}', 6),
    (sim_id, 'event_type', 'salvage',             '{"en":"Salvage","de":"Bergung"}', 7),
    (sim_id, 'event_type', 'festival',            '{"en":"Festival","de":"Fest"}', 8)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Propaganda Type (contrada communications) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'propaganda_type', 'contrada-bulletin',   '{"en":"Contrada Bulletin","de":"Contrada-Bulletin"}', 1),
    (sim_id, 'propaganda_type', 'raid-briefing',       '{"en":"Raid Briefing","de":"Raid-Briefing"}', 2),
    (sim_id, 'propaganda_type', 'trader-notice',       '{"en":"Trader Notice","de":"Händlerhinweis"}', 3),
    (sim_id, 'propaganda_type', 'warning-broadcast',   '{"en":"Warning Broadcast","de":"Warnmeldung"}', 4),
    (sim_id, 'propaganda_type', 'community-post',      '{"en":"Community Post","de":"Gemeinschaftsbeitrag"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Target Demographic ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'target_demographic', 'raiders',        '{"en":"Raiders","de":"Raider"}', 1),
    (sim_id, 'target_demographic', 'mechanics',      '{"en":"Mechanics","de":"Mechaniker"}', 2),
    (sim_id, 'target_demographic', 'traders',        '{"en":"Traders","de":"Händler"}', 3),
    (sim_id, 'target_demographic', 'all-contrada',   '{"en":"All Contrada","de":"Gesamte Contrada"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Campaign Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'campaign_type', 'contrada-bulletin',   '{"en":"Contrada Bulletin","de":"Contrada-Bulletin"}', 1),
    (sim_id, 'campaign_type', 'raid-briefing',       '{"en":"Raid Briefing","de":"Raid-Briefing"}', 2),
    (sim_id, 'campaign_type', 'trader-notice',       '{"en":"Trader Notice","de":"Händlerhinweis"}', 3),
    (sim_id, 'campaign_type', 'warning-broadcast',   '{"en":"Warning Broadcast","de":"Warnmeldung"}', 4),
    (sim_id, 'campaign_type', 'community-post',      '{"en":"Community Post","de":"Gemeinschaftsbeitrag"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Street Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'street_type', 'tunnel',    '{"en":"Tunnel","de":"Tunnel"}', 1),
    (sim_id, 'street_type', 'bridge',    '{"en":"Bridge","de":"Brücke"}', 2),
    (sim_id, 'street_type', 'stairway',  '{"en":"Stairway","de":"Treppe"}', 3),
    (sim_id, 'street_type', 'gallery',   '{"en":"Gallery","de":"Galerie"}', 4),
    (sim_id, 'street_type', 'alley',     '{"en":"Alley","de":"Gasse"}', 5),
    (sim_id, 'street_type', 'ramp',      '{"en":"Ramp","de":"Rampe"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ============================================================================
-- 4. CITY (Toledo — the underground city)
-- ============================================================================

INSERT INTO cities (id, simulation_id, name, description, population)
VALUES (
    city_id, sim_id,
    'Toledo',
    'A vast underground city built into collapsed limestone sinkholes beneath the ruins of the old Italian city. Connected by the Tube network — cargo pods fired between contrade by electromagnetic slingshots. Toledo''s seventeen contrade house roughly 12,000 souls. On the surface, ARC machines harvest what remains. Below, humanity endures.',
    12000
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. ZONES (4 districts of Speranza contrada)
-- ============================================================================

INSERT INTO zones (id, simulation_id, city_id, name, zone_type, security_level, description) VALUES
    (zone_hub, sim_id, city_id, 'The Hub',
     'hub', 'medium',
     'The central sinkhole amphitheater — a collapsed plaza three stories deep, ringed by pre-collapse buildings that now lean at angles against the limestone walls like tired drunks propping each other up. Strings of amber bulbs criss-cross overhead in a web that the old-timers call the Constellation. The Slingshot terminal dominates the north face: a forty-metre electromagnetic rail that fires cargo pods to other contrade through tunnels bored in the rock. Celeste''s Trading Post sprawls across the amphitheater floor. The air smells of engine grease, cured meat, and the chalky dust that sifts down from the sinkhole walls. Never quiet. Never dark. Speranza''s beating heart.'),
    (zone_workshops, sim_id, city_id, 'The Workshops',
     'workshop', 'high',
     'The old metro tunnels and Ottoman-era cisterns repurposed as Speranza''s industrial heart. The Guild of Gears maintains the Gear Forge here — a salvage refinery where captured ARC components are stripped, studied, and hammered into tools that keep the contrada alive. Sparks shower from cutting torches. Pneumatic hammers echo off vaulted ceilings. Every surface is coated in a film of metal dust and machine oil. The air shimmers with heat from the forge furnaces. Mechanics speak their own shorthand — a dialect of Italian, English, and machine-part serial numbers. Security is tight: ARC salvage is the contrada''s most valuable resource, and the Guild guards its secrets.'),
    (zone_quarters, sim_id, city_id, 'The Quarters',
     'quarters', 'low',
     'Residential blocks carved into the sinkhole walls and the basements of collapsed buildings. Habitation Block Primo is the oldest — four stories of converted parking garage, each level subdivided into family units with salvaged partition walls. The Canteen occupies a former bank vault at ground level, its reinforced ceiling now supporting a courtyard garden where tomatoes and herbs grow under UV lamps. Children play in corridors decorated with murals painted by residents. Laundry lines cross between buildings. The air here is warmer, stiller, scented with cooking and soap. Safety feels almost real.'),
    (zone_topside, sim_id, city_id, 'Topside Access',
     'topside-access', 'restricted',
     'The fortified surface exits — three blast doors sealed with salvaged hydraulics, each opening into a different approach to the ruins above. The Watchtower rises through a reinforced shaft to a concealed observation post among the rubble, where Topside Watch monitors ARC patrol patterns using pre-collapse radar equipment held together with wire and prayer. Raid squads stage here before missions, checking gear, reviewing routes, saying things they don''t call goodbyes. The walls are lined with lockers containing surface gear: respirators, anti-static cloaks, signal jammers. Everything smells of ozone and old fear.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. STREETS (16 passages — 4 per zone)
-- ============================================================================

-- The Hub
INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_hub, 'Slingshot Gallery', 'gallery'),
    (sim_id, city_id, zone_hub, 'Market Ramp', 'ramp'),
    (sim_id, city_id, zone_hub, 'Constellation Alley', 'alley'),
    (sim_id, city_id, zone_hub, 'Signal Bridge', 'bridge')
ON CONFLICT DO NOTHING;

-- The Workshops
INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_workshops, 'Forge Tunnel', 'tunnel'),
    (sim_id, city_id, zone_workshops, 'Cistern Gallery', 'gallery'),
    (sim_id, city_id, zone_workshops, 'Metro Ramp', 'ramp'),
    (sim_id, city_id, zone_workshops, 'Parts Alley', 'alley')
ON CONFLICT DO NOTHING;

-- The Quarters
INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_quarters, 'Primo Stairway', 'stairway'),
    (sim_id, city_id, zone_quarters, 'Garden Tunnel', 'tunnel'),
    (sim_id, city_id, zone_quarters, 'Laundry Bridge', 'bridge'),
    (sim_id, city_id, zone_quarters, 'Mural Alley', 'alley')
ON CONFLICT DO NOTHING;

-- Topside Access
INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_topside, 'Blast Door Tunnel', 'tunnel'),
    (sim_id, city_id, zone_topside, 'Watchtower Stairway', 'stairway'),
    (sim_id, city_id, zone_topside, 'Staging Ramp', 'ramp'),
    (sim_id, city_id, zone_topside, 'Locker Gallery', 'gallery')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. AGENTS (6 residents of Speranza)
-- ============================================================================

INSERT INTO agents (simulation_id, name, system, gender, character, background, created_by_id) VALUES
    (sim_id, 'Capitana Rosa Ferretti', 'raid-squads', 'female',
     'A wiry woman in her mid-fifties with sun-damaged skin, deep crow''s feet, and a gap-toothed grin that appears at exactly the wrong moments. Close-cropped grey hair under a dented hardhat she refuses to replace. Wears a patched jumpsuit covered in pockets, each containing something she''ll need before you know she needs it. Moves with the coiled economy of someone who has spent decades sprinting across open ground under machine surveillance. Her hands are scarred from wire, blade, and one memorable encounter with a Tick''s cutting arm that she tells three different ways depending on how much grappa she''s had.',
     'Rosa Ferretti has led more raids Topside than anyone alive in Speranza. She lost count somewhere around two hundred. She lost her left ring finger on raid forty-seven, her fear on raid twelve, and her first husband on raid ninety-one — Paolo walked into a Surveyor''s scanning field and she watched the drones descend from a culvert thirty metres away. She doesn''t talk about Paolo. She talks about everything else, loudly, with profanity that could strip paint. Her squad — the Cinghiali, the Wild Boars — is the most decorated in the contrada and also the most fined for discipline violations. Rosa treats ARC machines the way a farmer treats weather: dangerous, predictable if you pay attention, and not worth hating. She has trained more raiders than she can remember. Some of them are still alive. She considers this her greatest achievement.',
     usr_id),
    (sim_id, 'Enzo Moretti', 'guild-of-gears', 'male',
     'A heavyset man in his forties with thick forearms, a permanent squint from years of close work under bad light, and fingers so calloused they can test circuit integrity by touch. Shaved head, safety goggles pushed up on his forehead, Guild of Gears coveralls stained with every fluid a machine can leak. Talks to the machines he works on — not as affectation but as diagnostic method. Claims he can hear a misaligned bearing from three rooms away, and the annoying thing is he''s usually right. Has a workshop bench covered in half-disassembled ARC components, each tagged with handwritten notes in a shorthand only he can read.',
     'Enzo came to Speranza as a child refugee from Contrada Brenner when the northern Tube line collapsed. He doesn''t remember much of Brenner — just the sound of rock falling and someone carrying him through dust. The Guild of Gears took him as an apprentice at fourteen. By twenty he was reverse-engineering Tick locomotion systems. By thirty he had built the Frankengun — a handheld EMP device cobbled from ARC capacitors that can disable a Snitch at forty metres. The Guild treats him like a natural resource: valuable, irreplaceable, and slightly dangerous. Enzo doesn''t care about politics, contrada rivalries, or the philosophical question of whether ARC machines are sentient. He cares about how things work. He cares about making broken things work again. He talks to machines because they make more sense to him than people do, and because sometimes, in the quiet of the workshop at 3am, he swears they talk back.',
     usr_id),
    (sim_id, 'Lina Russo', 'tube-network', 'female',
     'A lean woman in her early thirties with dark hair pulled back tight, cable-burn scars wrapping both forearms like pale bracelets, and eyes that track movement the way a musician tracks rhythm. Wears the grey jumpsuit of a Slingshot operator with the sleeves rolled to the elbow. Fingers perpetually drumming on surfaces. Listens more than she speaks, and when she speaks, it''s usually to say something that makes the mechanics nervous. Navigation tattoo on her left wrist — a simplified Tube map that she updates herself with a needle and ink when routes change.',
     'The Tube network is Toledo''s circulatory system: electromagnetic slingshots that fire cargo pods through tunnels connecting the seventeen contrade. Lina Russo operates Speranza''s primary Slingshot — a forty-metre electromagnetic rail that accelerates pods to 200 km/h through tunnels bored in limestone. She navigates by sound, feeling, and a sense that other operators call uncanny and she calls paying attention. Every tunnel has a voice: the pitch of the electromagnetic hum, the rhythm of joints in the rail, the echo pattern that tells you if the tunnel ahead is clear or collapsed. Lina learned from her mother, who learned from the engineers who built the first Slingshot from salvaged maglev components. The cable-burn scars on her arms are from a brake failure during her certification run — the pod came in hot, the arrestor cable snapped, and she grabbed the secondary line bare-handed rather than let the pod crash into the terminus wall. She held. The pod stopped. She earned her certification and her scars in the same thirty seconds.',
     usr_id),
    (sim_id, 'Celeste Amara', 'contrada-council', 'female',
     'A striking woman in her late thirties with warm brown skin, sharp cheekbones, and dark eyes that miss nothing — especially not what you''re hiding in your coat. Dresses better than anyone in Speranza has a right to, in tailored salvage that she somehow makes look intentional. Always carries a leather satchel of pre-collapse origin, contents unknown. Her smile is genuine and her handshake is a contract. Speaks four languages fluently and can negotiate in three more. The Trading Post is her kingdom, and she runs it with the benevolent authority of someone who knows exactly what everything is worth.',
     'Celeste arrived in Speranza twelve years ago on a Tube pod from Contrada Amalfi with nothing but the satchel and a talent for making people agree to things they hadn''t planned on. Nobody knows what she did before. There are rumours — some say she was a courier for the northern contrade, others that she ran a black market in Napoli, and a persistent whisper that she once traded information to an ARC Surveyor''s behavioral subroutine, though nobody can explain what that would even mean. What is known: within three years she had built the Trading Post from a single blanket on the amphitheater floor to the largest market in Toledo. She controls the flow of goods between contrade with a network of contacts, favours, and IOUs that constitutes Speranza''s real economy. The Contrada Council gave her a seat because they couldn''t afford not to. Celeste considers herself a public servant. She also considers a twelve percent commission on inter-contrada trades to be a modest fee for the service.',
     usr_id),
    (sim_id, 'Dottor Marco Ferrara', 'contrada-council', 'male',
     'A thin man in his late forties with prematurely grey hair, round spectacles held together with wire, and the permanently exhausted expression of someone who has been working a double shift for fifteen years. Lab coat over a patched sweater, stethoscope around his neck, and a medical bag that goes everywhere he does. Hands that are steady when they need to be and shake when they don''t. Dark humour deployed as local anaesthetic. Pessimistic about everything except his patients, whom he treats with a fierce, quiet tenderness that embarrasses him when anyone notices.',
     'Marco Ferrara is Speranza''s only doctor for a population of seven hundred. He trained under Dottoressa Vela, who trained under a surgeon from Contrada Roma, who trained from pre-collapse medical textbooks and improvisation. The chain of knowledge is thin and getting thinner. Marco''s pharmacy is a shelf of salvaged medications, herbal tinctures, and things he''s synthesised from chemical supplies that the raiders bring back from Topside. He can set a bone, remove a bullet fragment, treat radiation exposure, and deliver a baby — sometimes in the same afternoon. His success rate is higher than it has any right to be. He attributes this to stubbornness rather than skill. The Contrada Council gave him a seat because someone has to argue against every raid proposal on medical grounds, and Marco has never met a plan he couldn''t find a fatal flaw in. He is usually right. The raids happen anyway. He patches up what comes back and writes the names of what doesn''t in a notebook he keeps in his inside pocket.',
     usr_id),
    (sim_id, 'Tomas Vidal', 'raid-squads', 'male',
     'A young man of twenty-two with an open face, dark curly hair, broad shoulders, and the restless energy of someone who hasn''t yet learned that stillness is a survival skill. Wears his raid gear like a costume he''s still growing into — everything slightly too clean, too well-maintained, the straps adjusted to textbook specification rather than personal comfort. Eager eyes that haven''t seen enough. A grin that appears when it shouldn''t and vanishes when it should stay. Carries a salvaged multi-tool that he fidgets with constantly. The other raiders call him Cucciolo — puppy — and he hasn''t yet earned the right to object.',
     'Tomas came to Speranza two years ago from Contrada Brenner when the northern Tube line was restored. He volunteered for raid training within his first week, which the veterans found either admirable or suicidal depending on their temperament. Capitana Ferretti took him into the Cinghiali because she saw something in his eagerness that reminded her of raiders who lived long enough to get good — not the ones who burned bright and died fast, but the ones who channelled their energy into attention. She might be right. Tomas is still alive, which puts him ahead of three other recruits who started training the same month. He has completed eleven raids. On the seventh, he froze when a Tick rose from debris twenty metres ahead. Rosa pulled him into a culvert and waited forty minutes in silence while the machine scanned the area. She didn''t reprimand him. She said: "Now you know what fear feels like. Next time it''ll be faster." She was right. On raid nine, he spotted a Snitch pattern that Rosa had missed. He''s learning. He sends letters to his mother in Brenner via the Tube. He doesn''t tell her about the raids.',
     usr_id);

-- ============================================================================
-- 8. BUILDINGS (7 structures in Speranza)
-- ============================================================================

INSERT INTO buildings (simulation_id, name, building_type, building_condition, description, zone_id, population_capacity) VALUES
    (sim_id, 'The Slingshot Hub', 'infrastructure', 'good',
     'A forty-metre electromagnetic rail built into the north face of the central sinkhole, angled into a tunnel bored through solid limestone. The Slingshot fires cargo pods at 200 km/h to other contrade through the Tube network — tunnels carved deep through the rock beneath Toledo. The terminal itself is a cathedral of engineering: massive capacitor banks salvaged from a pre-collapse power plant, cooling systems improvised from industrial air conditioning units, and a control cabin perched on scaffolding where the operator sits surrounded by analogue gauges and hand-drawn trajectory charts. The departure platform buzzes with activity — loaders wrestling crates onto pods, mechanics checking rail alignment, and the ever-present hum of capacitors charging. When a pod launches, the sound is somewhere between thunder and a giant clearing its throat, reverberating through the limestone cavern. The arrival platform is gentler, with electromagnetic braking that (usually) slows incoming pods to a survivable speed. The entire structure clings to the sinkhole wall like a barnacle on a cliff face, connected to the amphitheater floor by a switchback ramp of welded steel and salvaged guardrails. Lina Russo knows every sound this machine makes, and she swears it knows hers.',
     zone_hub, 300),
    (sim_id, 'Celeste''s Trading Post', 'commercial', 'fair',
     'The largest market in Toledo sprawls across the amphitheater floor of Speranza''s central sinkhole, sixty metres below the sealed surface. What began as a single blanket is now a maze of stalls, counters, and display cases constructed from salvaged materials — car doors as tables, traffic signs as awnings, a bank of old refrigerators repurposed as secure storage. Celeste''s personal office occupies a former ticket booth wedged into a natural alcove in the limestone wall, its glass panels papered with hand-drawn maps, trade agreements, and IOUs in a dozen hands. The market trades in everything: Topside salvage, inter-contrada goods, handmade tools, preserved food, information, and favours. Currency is officially the Chip — stamped copper tokens — but Celeste''s real ledger runs on reputation and reciprocity. The air smells of spices, machine oil, and possibility. String lights cast amber patterns across the faces of hagglers, browsers, and the occasional pickpocket whom Celeste tolerates as long as they stick to tourists. The sinkhole walls rise on all sides like a natural colosseum, riddled with doorways, ladders, and rope bridges connecting the levels above.',
     zone_hub, 200),
    (sim_id, 'The Gear Forge', 'industrial', 'fair',
     'The Guild of Gears'' primary workshop, built into a vaulted Ottoman-era cistern deep in the rock beneath the Workshops zone. The space is enormous — a barrel-vaulted ceiling held up by ancient stone columns, now strung with chains, pulleys, and pneumatic lines. The forge furnaces line one wall, fed by gas reclaimed from deep-bore wells that tap pockets far below even Speranza. Workbenches fill the main floor, each one a mechanic''s personal fiefdom piled with tools, half-finished projects, and components in various states of disassembly. The ARC salvage section is behind a cage door: captured machine parts laid out for study like specimens in a museum. Enzo''s bench is in the corner, distinguished by a hand-lettered sign reading "DO NOT TOUCH — THIS MEANS YOU, MARCO" and a half-disassembled Tick locomotion unit that he has been reverse-engineering for six months. The air is thick with the smell of hot metal, flux, and machine oil. Sparks fall like amber rain. The cistern''s acoustics turn every hammer blow into a bell toll that echoes through connecting tunnels. Ventilation shafts carved into the limestone carry the forge heat upward through a labyrinth of natural fissures — the engineers call it breathing rock.',
     zone_workshops, 50),
    (sim_id, 'The Canteen', 'social', 'good',
     'Speranza''s communal dining hall, built into the reinforced vault of a pre-collapse bank that collapsed into the sinkhole during the subsidence. The original vault door still works and is closed during emergencies. Inside, long tables made from salvaged doors seat a hundred and fifty, with a kitchen occupying the former safe deposit room. The menu is whatever the hydroponics cavern and Topside raids provide: tomato-based everything, herb bread baked in a converted industrial oven, and on good days, actual meat from the livestock pens in Contrada Sole. The hydroponic garden occupies a connected limestone chamber behind the kitchen — racks of tomatoes, basil, oregano, and chilies thriving under banks of UV lamps that give the cavern an eerie violet glow, tended by a rotating roster of volunteers who call it the Purple Room. Meals are communal. You eat what there is. You sit where there''s space. The Canteen is where Speranza argues, celebrates, mourns, and plans. The acoustics are terrible and the coffee is worse, but the tomato soup is the best thing you''ll eat underground. Condensation drips from the vault ceiling into collection troughs — nothing is wasted this far down.',
     zone_quarters, 150),
    (sim_id, 'The Watchtower', 'military', 'good',
     'A reinforced observation post buried deep in the Topside Access zone, connected to the surface only by a narrow sealed shaft packed with cables and periscope optics. The post itself is a cramped hexagonal chamber carved from limestone, lined with salvaged radar equipment, radio sets, and a bank of screens showing camera feeds from Topside — tiny hardened lenses disguised as debris on the surface, each one wired down through the rock. The radar array is pre-collapse military hardware, its antenna concealed in a collapsed chimney above, maintained by the Guild of Gears with the reverence usually reserved for religious relics. Two watchers work twelve-hour shifts, logging ARC patrol patterns, weather conditions, and the movement of machines — all from screens, never from sight. The data feeds directly to the Capitana for raid planning. The periscope offers a narrow, distorted glimpse of the surface: a blasted landscape of collapsed buildings, overgrown ruins, and the distant shapes of ARC machines moving with terrible purpose. Most Speranzans never see the sky. The watchers see a grey circle of it through ground glass and wish they didn''t. The chamber smells of warm electronics and the damp limestone that sweats in every room this deep.',
     zone_topside, 20),
    (sim_id, 'The Infirmary', 'medical', 'poor',
     'Dottor Ferrara''s domain: a natural limestone chamber reinforced with salvaged steel beams, serving as hospital, pharmacy, surgery, and his reluctant living quarters. The room was chosen for its unusually flat floor and high ceiling — rare luxuries underground. The equipment is a museum of improvisation — a dental chair repurposed as an operating table, a car battery powering a defibrillator, surgical instruments sterilised in a pressure cooker. The pharmacy shelf holds salvaged medications alongside herbal preparations and compounds that Marco synthesises from chemical supplies brought back from Topside. A curtained alcove carved deeper into the rock serves as a recovery ward with four beds. The walls are lined with anatomical charts drawn by Marco himself, pinned directly to the limestone and annotated with handwritten corrections and updates. The lighting is harsh and insufficient — UV-filtered bulbs on salvaged fixtures, because Marco insists on seeing what he''s cutting. The air smells of antiseptic, dried herbs, and the mineral tang of wet stone. Despite everything — the cramped space, the inadequate supplies, the impossible patient load — the Infirmary is scrupulously clean. Marco''s one indulgence: a battered radio that plays pre-collapse music during surgeries, because silence and the drip of water make his hands shake.',
     zone_quarters, 40),
    (sim_id, 'Habitation Block Primo', 'residential', 'fair',
     'The oldest residential structure in Speranza: four levels carved into the eastern wall of the main sinkhole, connected by steep staircases cut from the rock and a rattling cargo lift improvised from a construction crane motor. Each level is a gallery hollowed from the limestone, subdivided into family units with salvaged partition walls — plywood, sheet metal, old doors, whatever holds. Each level has a communal bathroom, a water reclamation unit fed by condensation collectors, and a shared laundry area where the gossip is better than anything on the radio. The partitions are personalised — some painted, some hung with fabric, some decorated with children''s drawings or photographs from before the machines came. Level One houses families with children. Level Two is singles and couples. Level Three is reserved for raiders and their dependents (the rock between levels is not thick enough to prevent nightmares from travelling). Level Four, the highest gallery, has been enclosed with salvaged glass panels across its open face and serves as a communal greenhouse and recreation space — the only place in the Quarters where you can look out across the sinkhole and see the string lights of the Constellation stretching above. The walls seep moisture in winter and shed dust in summer. It is ugly, damp, and crowded. It is home.',
     zone_quarters, 80);

-- ============================================================================
-- 9. AI SETTINGS (Flux Dev + post-apocalyptic style)
-- ============================================================================

-- Image model: Flux Dev for agent portraits
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_model_agent_portrait', '"black-forest-labs/flux-dev"')
ON CONFLICT DO NOTHING;

-- Image model: Flux Dev for building images
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_model_building_image', '"black-forest-labs/flux-dev"')
ON CONFLICT DO NOTHING;

-- Guidance scale
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_guidance_scale', '5.0')
ON CONFLICT DO NOTHING;

-- Inference steps
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_num_inference_steps', '28')
ON CONFLICT DO NOTHING;

-- Post-apocalyptic style prompt for portraits
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_style_prompt_portrait',
    '"retro-futuristic post-apocalyptic portrait, underground sinkhole city, warm amber string light illumination, 1970s NASA-punk aesthetic, worn utilitarian clothing and improvised gear, cinematic film reference Cuaron and Villeneuve, concept art quality, detailed face with character and lived experience, limestone walls and salvaged infrastructure background, not photorealistic, not cartoon, not anime, not bright daylight, not clean"')
ON CONFLICT DO NOTHING;

-- Post-apocalyptic style prompt for buildings
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_style_prompt_building',
    '"entirely subterranean sinkhole architecture, carved into limestone cavern walls, no sky visible, no surface structures, rope bridges and string lights spanning cavern voids, warm amber lighting from salvaged bulbs, retro-futuristic industrial, 1970s NASA-punk aesthetic, cinematic Blade Runner meets Mad Max Fury Road, lived-in surfaces covered in repairs and improvisation, salvaged materials repurposed with ingenuity, dripping condensation and mineral deposits on stone, concept art quality, not photorealistic, not bright, not clean, not modern minimalist, not outdoors, not surface level"')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. PROMPT TEMPLATES (simulation-scoped overrides)
-- ============================================================================

-- Portrait description (EN) — post-apocalyptic aesthetic
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    sim_id, 'portrait_description', 'generation', 'en',
    'Speranza Portrait Description (EN)',
    'Describe a portrait of an underground city resident for image generation: {agent_name}.

Character traits: {agent_character}
Background: {agent_background}

AESTHETIC: Retro-futuristic post-apocalyptic in the style of Children of Men, Blade Runner 2049, and Mad Max Fury Road.
Underground sinkhole city setting. Warm amber string lights. Limestone walls.
1970s NASA-punk: worn utilitarian clothing, improvised gear, analogue technology.
The character shows the marks of underground survival — sun damage from surface raids,
calluses, scars, clothes repaired many times.
Concept art quality, NOT photorealistic.

COMPOSITION: Head-and-shoulders portrait, single subject, warm amber lighting
from string lights and forge glow. Underground sinkhole or tunnel background with
limestone walls and salvaged infrastructure.
Describe: facial expression reflecting personality, clothing and gear condition,
lighting quality (warm amber + industrial), mood, any distinguishing marks or tools.
Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: Describe only ONE character.
IMPORTANT: Always include: retro-futuristic, post-apocalyptic, underground sinkhole, amber lighting, NASA-punk, concept art style.',
    'You are a portrait description specialist for AI image generation. Write concise, visual descriptors for a single character portrait in a retro-futuristic post-apocalyptic aesthetic. Underground sinkhole city, warm amber lighting, 1970s NASA-punk.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 300, false, usr_id
) ON CONFLICT DO NOTHING;

-- Building image description (EN) — sinkhole architecture
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    sim_id, 'building_image_description', 'generation', 'en',
    'Speranza Building Image Description (EN)',
    'Describe an entirely subterranean structure for image generation. This building exists UNDERGROUND — inside a limestone sinkhole cavern. There is NO sky, NO surface, NO outdoor space.

Building: {building_name}
Type: {building_type}
Condition: {building_condition}
Style: {building_style}
Special type: {special_type}
Construction year: {construction_year}
Description: {building_description}
Zone: {zone_name}

CRITICAL CONSTRAINT: The structure is ENTIRELY UNDERGROUND. Carved into limestone cavern walls, built into natural chambers, or constructed from salvage inside a collapsed sinkhole. No windows to the outside. No sky. No sunlight. All light is artificial — amber string lights, UV grow-lamps, forge glow, salvaged fluorescent tubes.

AESTHETIC: Underground sinkhole architecture in the style of Mad Max, Blade Runner, and Children of Men.
Cavern walls of raw limestone. Rope bridges spanning voids. String lights in amber webs.
Warm amber lighting from salvaged bulbs. Retro-futuristic industrial — 1970s NASA-punk.
Every surface tells a story of repair, improvisation, and adaptation.
Condensation on stone. Mineral deposits. Dripping water collected in troughs.
Concept art quality, NOT photorealistic.

Based on these properties, describe the structure visually.
The CONDITION is critical — "makeshift" shows improvised construction from pure salvage.
"Poor" shows heavy wear, patch repairs, and strained infrastructure.
"Fair" is functional but shows its age — repaired walls, replaced components, patina.
"Good" is well-maintained for underground standards. "Excellent" is a point of pride.

The BUILDING TYPE affects architecture — infrastructure has massive engineering carved into rock,
commercial areas are colourful market chaos in cavern floors, industrial has forges in ancient cisterns,
military has reinforced chambers with sealed blast doors, medical is improvised but clean cave rooms,
social spaces are warm communal caverns, residential is personalised galleries carved into sinkhole walls.

Write as an image generation prompt — comma-separated descriptors, no sentences.
Include: architectural style, materials, condition, lighting quality, atmosphere, scale.
IMPORTANT: Always include: underground cavern, limestone walls, warm amber lighting, retro-futuristic, post-apocalyptic, concept art style, NO sky, NO sunlight.',
    'You are an architectural description specialist for AI image generation. Write concise, visual descriptors for entirely subterranean structures carved into limestone sinkhole caverns. Retro-futuristic post-apocalyptic aesthetic. Warm amber lighting, limestone walls, salvaged materials. CRITICAL: All structures are underground — no sky, no sunlight, no outdoor spaces.',
    '[{"name": "building_name"}, {"name": "building_type"}, {"name": "building_condition"}, {"name": "building_style"}, {"name": "special_type"}, {"name": "construction_year"}, {"name": "building_description"}, {"name": "zone_name"}, {"name": "simulation_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 300, false, usr_id
) ON CONFLICT DO NOTHING;


RAISE NOTICE 'Speranza seed complete: 1 simulation, 1 city, 4 zones, 16 streets, 6 agents, 7 buildings, 6 AI settings, 2 prompt templates';
END $$;

COMMIT;

-- =============================================================================
-- Verification
-- =============================================================================
SELECT 'simulation' as entity, count(*) as count FROM simulations WHERE id = '40000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'members', count(*) FROM simulation_members WHERE simulation_id = '40000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'taxonomies', count(*) FROM simulation_taxonomies WHERE simulation_id = '40000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'agents', count(*) FROM agents WHERE simulation_id = '40000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'buildings', count(*) FROM buildings WHERE simulation_id = '40000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'cities', count(*) FROM cities WHERE simulation_id = '40000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'zones', count(*) FROM zones WHERE simulation_id = '40000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'streets', count(*) FROM city_streets WHERE simulation_id = '40000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'settings', count(*) FROM simulation_settings WHERE simulation_id = '40000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'templates', count(*) FROM prompt_templates WHERE simulation_id = '40000000-0000-0000-0000-000000000001';
