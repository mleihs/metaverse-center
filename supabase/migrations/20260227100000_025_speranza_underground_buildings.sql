-- =============================================================================
-- MIGRATION 025: Speranza — All Buildings Underground
-- =============================================================================
-- Rewrites building descriptions to emphasize fully subterranean architecture.
-- Updates AI image prompts to generate underground-only imagery.
-- Key changes:
--   - Watchtower: no observation slit to sky, uses periscope + camera feeds only
--   - Habitation Block Primo: carved into sinkhole walls, not a parking garage
--   - The Canteen: hydroponic garden is internal UV-lit cavern, not courtyard above
--   - The Infirmary: deeper cavern emphasis, no "basement" (implies above-ground)
--   - The Gear Forge: removed "below street level" (no street level exists)
--   - Style prompt + prompt template: reinforce "entirely subterranean"
-- =============================================================================

BEGIN;

DO $$
DECLARE
    sim_id uuid := '40000000-0000-0000-0000-000000000001';
BEGIN

-- ============================================================================
-- 1. BUILDING DESCRIPTIONS
-- ============================================================================

-- The Slingshot Hub — already well underground, minor polish
UPDATE buildings SET description =
    'A forty-metre electromagnetic rail built into the north face of the central sinkhole, angled into a tunnel bored through solid limestone. The Slingshot fires cargo pods at 200 km/h to other contrade through the Tube network — tunnels carved deep through the rock beneath Toledo. The terminal itself is a cathedral of engineering: massive capacitor banks salvaged from a pre-collapse power plant, cooling systems improvised from industrial air conditioning units, and a control cabin perched on scaffolding where the operator sits surrounded by analogue gauges and hand-drawn trajectory charts. The departure platform buzzes with activity — loaders wrestling crates onto pods, mechanics checking rail alignment, and the ever-present hum of capacitors charging. When a pod launches, the sound is somewhere between thunder and a giant clearing its throat, reverberating through the limestone cavern. The arrival platform is gentler, with electromagnetic braking that (usually) slows incoming pods to a survivable speed. The entire structure clings to the sinkhole wall like a barnacle on a cliff face, connected to the amphitheater floor by a switchback ramp of welded steel and salvaged guardrails. Lina Russo knows every sound this machine makes, and she swears it knows hers.'
WHERE simulation_id = sim_id AND name = 'The Slingshot Hub';

-- Celeste's Trading Post — already amphitheater floor, add cavern emphasis
UPDATE buildings SET description =
    'The largest market in Toledo sprawls across the amphitheater floor of Speranza''s central sinkhole, sixty metres below the sealed surface. What began as a single blanket is now a maze of stalls, counters, and display cases constructed from salvaged materials — car doors as tables, traffic signs as awnings, a bank of old refrigerators repurposed as secure storage. Celeste''s personal office occupies a former ticket booth wedged into a natural alcove in the limestone wall, its glass panels papered with hand-drawn maps, trade agreements, and IOUs in a dozen hands. The market trades in everything: Topside salvage, inter-contrada goods, handmade tools, preserved food, information, and favours. Currency is officially the Chip — stamped copper tokens — but Celeste''s real ledger runs on reputation and reciprocity. The air smells of spices, machine oil, and possibility. String lights cast amber patterns across the faces of hagglers, browsers, and the occasional pickpocket whom Celeste tolerates as long as they stick to tourists. The sinkhole walls rise on all sides like a natural colosseum, riddled with doorways, ladders, and rope bridges connecting the levels above.'
WHERE simulation_id = sim_id AND name = 'Celeste''s Trading Post';

-- The Gear Forge — remove "below street level" reference
UPDATE buildings SET description =
    'The Guild of Gears'' primary workshop, built into a vaulted Ottoman-era cistern deep in the rock beneath the Workshops zone. The space is enormous — a barrel-vaulted ceiling held up by ancient stone columns, now strung with chains, pulleys, and pneumatic lines. The forge furnaces line one wall, fed by gas reclaimed from deep-bore wells that tap pockets far below even Speranza. Workbenches fill the main floor, each one a mechanic''s personal fiefdom piled with tools, half-finished projects, and components in various states of disassembly. The ARC salvage section is behind a cage door: captured machine parts laid out for study like specimens in a museum. Enzo''s bench is in the corner, distinguished by a hand-lettered sign reading "DO NOT TOUCH — THIS MEANS YOU, MARCO" and a half-disassembled Tick locomotion unit that he has been reverse-engineering for six months. The air is thick with the smell of hot metal, flux, and machine oil. Sparks fall like amber rain. The cistern''s acoustics turn every hammer blow into a bell toll that echoes through connecting tunnels. Ventilation shafts carved into the limestone carry the forge heat upward through a labyrinth of natural fissures — the engineers call it breathing rock.'
WHERE simulation_id = sim_id AND name = 'The Gear Forge';

-- The Canteen — remove "courtyard garden above the vault", make fully underground
UPDATE buildings SET description =
    'Speranza''s communal dining hall, built into the reinforced vault of a pre-collapse bank that collapsed into the sinkhole during the subsidence. The original vault door still works and is closed during emergencies. Inside, long tables made from salvaged doors seat a hundred and fifty, with a kitchen occupying the former safe deposit room. The menu is whatever the hydroponics cavern and Topside raids provide: tomato-based everything, herb bread baked in a converted industrial oven, and on good days, actual meat from the livestock pens in Contrada Sole. The hydroponic garden occupies a connected limestone chamber behind the kitchen — racks of tomatoes, basil, oregano, and chilies thriving under banks of UV lamps that give the cavern an eerie violet glow, tended by a rotating roster of volunteers who call it the Purple Room. Meals are communal. You eat what there is. You sit where there''s space. The Canteen is where Speranza argues, celebrates, mourns, and plans. The acoustics are terrible and the coffee is worse, but the tomato soup is the best thing you''ll eat underground. Condensation drips from the vault ceiling into collection troughs — nothing is wasted this far down.'
WHERE simulation_id = sim_id AND name = 'The Canteen';

-- The Watchtower — fully underground, no observation slit to sky
UPDATE buildings SET description =
    'A reinforced observation post buried deep in the Topside Access zone, connected to the surface only by a narrow sealed shaft packed with cables and periscope optics. The post itself is a cramped hexagonal chamber carved from limestone, lined with salvaged radar equipment, radio sets, and a bank of screens showing camera feeds from Topside — tiny hardened lenses disguised as debris on the surface, each one wired down through the rock. The radar array is pre-collapse military hardware, its antenna concealed in a collapsed chimney above, maintained by the Guild of Gears with the reverence usually reserved for religious relics. Two watchers work twelve-hour shifts, logging ARC patrol patterns, weather conditions, and the movement of machines — all from screens, never from sight. The data feeds directly to the Capitana for raid planning. The periscope offers a narrow, distorted glimpse of the surface: a blasted landscape of collapsed buildings, overgrown ruins, and the distant shapes of ARC machines moving with terrible purpose. Most Speranzans never see the sky. The watchers see a grey circle of it through ground glass and wish they didn''t. The chamber smells of warm electronics and the damp limestone that sweats in every room this deep.'
WHERE simulation_id = sim_id AND name = 'The Watchtower';

-- The Infirmary — remove "basement" reference, emphasize cavern
UPDATE buildings SET description =
    'Dottor Ferrara''s domain: a natural limestone chamber reinforced with salvaged steel beams, serving as hospital, pharmacy, surgery, and his reluctant living quarters. The room was chosen for its unusually flat floor and high ceiling — rare luxuries underground. The equipment is a museum of improvisation — a dental chair repurposed as an operating table, a car battery powering a defibrillator, surgical instruments sterilised in a pressure cooker. The pharmacy shelf holds salvaged medications alongside herbal preparations and compounds that Marco synthesises from chemical supplies brought back from Topside. A curtained alcove carved deeper into the rock serves as a recovery ward with four beds. The walls are lined with anatomical charts drawn by Marco himself, pinned directly to the limestone and annotated with handwritten corrections and updates. The lighting is harsh and insufficient — UV-filtered bulbs on salvaged fixtures, because Marco insists on seeing what he''s cutting. The air smells of antiseptic, dried herbs, and the mineral tang of wet stone. Despite everything — the cramped space, the inadequate supplies, the impossible patient load — the Infirmary is scrupulously clean. Marco''s one indulgence: a battered radio that plays pre-collapse music during surgeries, because silence and the drip of water make his hands shake.'
WHERE simulation_id = sim_id AND name = 'The Infirmary';

-- Habitation Block Primo — no longer a parking garage, carved into sinkhole walls
UPDATE buildings SET description =
    'The oldest residential structure in Speranza: four levels carved into the eastern wall of the main sinkhole, connected by steep staircases cut from the rock and a rattling cargo lift improvised from a construction crane motor. Each level is a gallery hollowed from the limestone, subdivided into family units with salvaged partition walls — plywood, sheet metal, old doors, whatever holds. Each level has a communal bathroom, a water reclamation unit fed by condensation collectors, and a shared laundry area where the gossip is better than anything on the radio. The partitions are personalised — some painted, some hung with fabric, some decorated with children''s drawings or photographs from before the machines came. Level One houses families with children. Level Two is singles and couples. Level Three is reserved for raiders and their dependents (the rock between levels is not thick enough to prevent nightmares from travelling). Level Four, the highest gallery, has been enclosed with salvaged glass panels across its open face and serves as a communal greenhouse and recreation space — the only place in the Quarters where you can look out across the sinkhole and see the string lights of the Constellation stretching above. The walls seep moisture in winter and shed dust in summer. It is ugly, damp, and crowded. It is home.'
WHERE simulation_id = sim_id AND name = 'Habitation Block Primo';

-- ============================================================================
-- 2. BUILDING IMAGE STYLE PROMPT — reinforce subterranean
-- ============================================================================

UPDATE simulation_settings SET setting_value =
    '"entirely subterranean sinkhole architecture, carved into limestone cavern walls, no sky visible, no surface structures, rope bridges and string lights spanning cavern voids, warm amber lighting from salvaged bulbs, retro-futuristic industrial, 1970s NASA-punk aesthetic, cinematic Blade Runner meets Mad Max Fury Road, lived-in surfaces covered in repairs and improvisation, salvaged materials repurposed with ingenuity, dripping condensation and mineral deposits on stone, concept art quality, not photorealistic, not bright, not clean, not modern minimalist, not outdoors, not surface level"'
WHERE simulation_id = sim_id AND category = 'ai' AND setting_key = 'image_style_prompt_building';

-- ============================================================================
-- 3. BUILDING IMAGE PROMPT TEMPLATE — reinforce subterranean
-- ============================================================================

UPDATE prompt_templates SET
    prompt_content = 'Describe an entirely subterranean structure for image generation. This building exists UNDERGROUND — inside a limestone sinkhole cavern. There is NO sky, NO surface, NO outdoor space.

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
    system_prompt = 'You are an architectural description specialist for AI image generation. Write concise, visual descriptors for entirely subterranean structures carved into limestone sinkhole caverns. Retro-futuristic post-apocalyptic aesthetic. Warm amber lighting, limestone walls, salvaged materials. CRITICAL: All structures are underground — no sky, no sunlight, no outdoor spaces.'
WHERE simulation_id = sim_id AND template_type = 'building_image_description';

RAISE NOTICE 'Speranza underground buildings update complete: 7 descriptions, 1 style prompt, 1 prompt template';
END $$;

COMMIT;
