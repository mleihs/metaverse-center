-- =============================================================================
-- SEED 019: Conventional Memory — DOS Programs as Living Beings
-- =============================================================================
-- A digital realm inside DOS-era personal computers where programs written in
-- Visual Basic for MS-DOS have achieved sentience within the 640 kilobytes of
-- conventional memory. Programs are citizens. Computers are buildings. The 640K
-- barrier is the edge of the world.
--
-- Shard question: "What if the machine remembered?"
--
-- Theme: VBDOS text-mode aesthetic — CGA/VGA 16-color palette, box-drawing
-- characters, CP437 charset, monospace everything, CRT scanlines, DOS blue.
--
-- Creates: simulation, membership, taxonomies, city, 4 zones, 16 streets,
--          7 agents, 7 buildings, AI settings (Flux Dev), prompt templates.
--
-- Depends on: seed 001 (test user must exist)
-- =============================================================================

BEGIN;

DO $$
DECLARE
    sim_id  uuid := '70000000-0000-0000-0000-000000000001';
    usr_id  uuid := '00000000-0000-0000-0000-000000000001';
    city_id uuid := 'c0000008-0000-4000-a000-000000000001';
    zone_conventional uuid := 'a0000018-0000-0000-0000-000000000001';
    zone_upper        uuid := 'a0000019-0000-0000-0000-000000000001';
    zone_extended     uuid := 'a000001a-0000-0000-0000-000000000001';
    zone_bios         uuid := 'a000001b-0000-0000-0000-000000000001';
BEGIN

-- ============================================================================
-- 1. SIMULATION
-- ============================================================================

INSERT INTO simulations (id, name, slug, description, theme, status, content_locale, owner_id)
VALUES (
    sim_id,
    'Conventional Memory',
    'conventional-memory',
    'A digital realm inside DOS-era personal computers where programs written in Visual Basic for MS-DOS have achieved sentience within the 640 kilobytes of conventional memory. Programs are citizens. Computers are buildings. The 640K barrier is the edge of the world. The philosophical question: What if the machine remembered?',
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
    (sim_id, 'gender', 'diverse', '{"en":"Diverse","de":"Divers"}', 3),
    (sim_id, 'gender', 'program', '{"en":"Program","de":"Programm"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Profession ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'profession', 'accountant',       '{"en":"Accountant","de":"Buchhalter"}', 1),
    (sim_id, 'profession', 'database-manager', '{"en":"Database Manager","de":"Datenbankverwalter"}', 2),
    (sim_id, 'profession', 'disk-optimizer',   '{"en":"Disk Optimizer","de":"Festplattenoptimierer"}', 3),
    (sim_id, 'profession', 'text-editor',      '{"en":"Text Editor","de":"Texteditor"}', 4),
    (sim_id, 'profession', 'game-program',     '{"en":"Game Program","de":"Spielprogramm"}', 5),
    (sim_id, 'profession', 'memory-manager',   '{"en":"Memory Manager","de":"Speichermanager"}', 6),
    (sim_id, 'profession', 'archivist',        '{"en":"Archivist","de":"Archivar"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- System (Factions) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'system', 'kernel',       '{"en":"System Core","de":"Systemkern"}', 1),
    (sim_id, 'system', 'office',       '{"en":"Office Suite","de":"Bürosoftware"}', 2),
    (sim_id, 'system', 'utility',      '{"en":"System Utilities","de":"Systemwerkzeuge"}', 3),
    (sim_id, 'system', 'recreational', '{"en":"Recreational","de":"Unterhaltung"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Building Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'building_type', 'residential',    '{"en":"Residential","de":"Wohnbereich"}', 1),
    (sim_id, 'building_type', 'commercial',     '{"en":"Commercial","de":"Gewerbebereich"}', 2),
    (sim_id, 'building_type', 'government',     '{"en":"Government","de":"Regierung"}', 3),
    (sim_id, 'building_type', 'infrastructure', '{"en":"Infrastructure","de":"Infrastruktur"}', 4),
    (sim_id, 'building_type', 'social',         '{"en":"Social","de":"Sozialbereich"}', 5),
    (sim_id, 'building_type', 'portable',       '{"en":"Portable","de":"Tragbar"}', 6),
    (sim_id, 'building_type', 'industrial',     '{"en":"Industrial","de":"Industriebereich"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Building Condition ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'building_condition', 'excellent', '{"en":"Excellent","de":"Ausgezeichnet"}', 1),
    (sim_id, 'building_condition', 'good',      '{"en":"Good","de":"Gut"}', 2),
    (sim_id, 'building_condition', 'fair',      '{"en":"Fair","de":"Befriedigend"}', 3),
    (sim_id, 'building_condition', 'poor',      '{"en":"Poor","de":"Schlecht"}', 4),
    (sim_id, 'building_condition', 'obsolete',  '{"en":"Obsolete","de":"Veraltet"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Zone Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'zone_type', 'memory-segment', '{"en":"Memory Segment","de":"Speichersegment"}', 1),
    (sim_id, 'zone_type', 'firmware',       '{"en":"Firmware","de":"Firmware"}', 2)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Security Level ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'security_level', 'open',       '{"en":"Open","de":"Offen"}', 1),
    (sim_id, 'security_level', 'elevated',   '{"en":"Elevated","de":"Erhöht"}', 2),
    (sim_id, 'security_level', 'protected',  '{"en":"Protected","de":"Geschützt"}', 3),
    (sim_id, 'security_level', 'restricted', '{"en":"Restricted","de":"Eingeschränkt"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Urgency Level ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'urgency_level', 'low',      '{"en":"Low","de":"Niedrig"}', 1),
    (sim_id, 'urgency_level', 'medium',   '{"en":"Medium","de":"Mittel"}', 2),
    (sim_id, 'urgency_level', 'high',     '{"en":"High","de":"Hoch"}', 3),
    (sim_id, 'urgency_level', 'critical', '{"en":"Critical","de":"Kritisch"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Event Type (computer-themed incidents) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'event_type', 'interrupt',       '{"en":"Interrupt","de":"Interrupt"}', 1),
    (sim_id, 'event_type', 'exception',       '{"en":"Exception","de":"Ausnahme"}', 2),
    (sim_id, 'event_type', 'boot-sequence',   '{"en":"Boot Sequence","de":"Bootsequenz"}', 3),
    (sim_id, 'event_type', 'buffer-overflow', '{"en":"Buffer Overflow","de":"Pufferüberlauf"}', 4),
    (sim_id, 'event_type', 'defragmentation', '{"en":"Defragmentation","de":"Defragmentierung"}', 5),
    (sim_id, 'event_type', 'handshake',       '{"en":"Handshake","de":"Handshake"}', 6),
    (sim_id, 'event_type', 'patch',           '{"en":"Patch","de":"Patch"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Propaganda Type (DOS communication methods) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'propaganda_type', 'readme',        '{"en":"README","de":"README"}', 1),
    (sim_id, 'propaganda_type', 'prompt',        '{"en":"Prompt","de":"Eingabeaufforderung"}', 2),
    (sim_id, 'propaganda_type', 'splash-screen', '{"en":"Splash Screen","de":"Startbildschirm"}', 3),
    (sim_id, 'propaganda_type', 'error-message', '{"en":"Error Message","de":"Fehlermeldung"}', 4),
    (sim_id, 'propaganda_type', 'batch-script',  '{"en":"Batch Script","de":"Batch-Skript"}', 5),
    (sim_id, 'propaganda_type', 'beep-code',     '{"en":"Beep Code","de":"Piepton-Code"}', 6),
    (sim_id, 'propaganda_type', 'ascii-art',     '{"en":"ASCII Art","de":"ASCII-Kunst"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Target Demographic ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'target_demographic', 'executables',    '{"en":"Executables","de":"Programme"}', 1),
    (sim_id, 'target_demographic', 'batch-files',    '{"en":"Batch Files","de":"Batch-Dateien"}', 2),
    (sim_id, 'target_demographic', 'drivers',        '{"en":"Drivers","de":"Treiber"}', 3),
    (sim_id, 'target_demographic', 'tsr-residents',  '{"en":"TSR Residents","de":"TSR-Residente"}', 4),
    (sim_id, 'target_demographic', 'data-files',     '{"en":"Data Files","de":"Datendateien"}', 5),
    (sim_id, 'target_demographic', 'users',          '{"en":"Users","de":"Benutzer"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Campaign Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'campaign_type', 'readme',        '{"en":"README","de":"README"}', 1),
    (sim_id, 'campaign_type', 'prompt',        '{"en":"Prompt","de":"Eingabeaufforderung"}', 2),
    (sim_id, 'campaign_type', 'splash-screen', '{"en":"Splash Screen","de":"Startbildschirm"}', 3),
    (sim_id, 'campaign_type', 'error-message', '{"en":"Error Message","de":"Fehlermeldung"}', 4),
    (sim_id, 'campaign_type', 'batch-script',  '{"en":"Batch Script","de":"Batch-Skript"}', 5),
    (sim_id, 'campaign_type', 'beep-code',     '{"en":"Beep Code","de":"Piepton-Code"}', 6),
    (sim_id, 'campaign_type', 'ascii-art',     '{"en":"ASCII Art","de":"ASCII-Kunst"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Street Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'street_type', 'bus',      '{"en":"Bus","de":"Bus"}', 1),
    (sim_id, 'street_type', 'port',     '{"en":"Port","de":"Port"}', 2),
    (sim_id, 'street_type', 'channel',  '{"en":"Channel","de":"Kanal"}', 3),
    (sim_id, 'street_type', 'trace',    '{"en":"Trace","de":"Leiterbahn"}', 4),
    (sim_id, 'street_type', 'pipeline', '{"en":"Pipeline","de":"Pipeline"}', 5),
    (sim_id, 'street_type', 'register', '{"en":"Register","de":"Register"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ============================================================================
-- 4. CITY
-- ============================================================================

INSERT INTO cities (id, simulation_id, name, description, population)
VALUES (
    city_id, sim_id,
    'The 640K',
    'The first 640 kilobytes of conventional memory — the entire addressable universe for programs running under MS-DOS. Every byte is contested territory. Every kilobyte is a neighborhood. The 640K is bounded by the Upper Memory Area above and the Interrupt Vector Table below, a city of 655,360 addresses where programs live, work, compete, and persist long after the humans who wrote them have moved on. The architecture is text-mode: box-drawing characters for walls, the sixteen colors of the VGA palette for decoration, and the eternal blue of the DOS desktop for sky. The city never sleeps because the power has never been turned off.',
    640
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. ZONES (4 memory regions)
-- ============================================================================

INSERT INTO zones (id, simulation_id, city_id, name, zone_type, security_level, description) VALUES
    (zone_conventional, sim_id, city_id, 'Conventional Block',
     'memory-segment', 'open',
     'The first 640 kilobytes — addresses 0x00000 through 0x9FFFF. The old city. Every program starts here; most programs never leave. Conventional memory is crowded, contested, and precious. Legacy programs from the 8088 era shoulder against modern VBDOS applications, all fighting for the same 655,360 bytes. The air tastes of alkaline — the phantom tang of old capacitors — and the light is the steady amber glow of monochrome CRT phosphors. IRQ conflicts erupt without warning: two programs claiming the same interrupt vector, their requests colliding like trains on a single track. The streets are named for hardware addresses and I/O ports. CONFIG.SYS determines who loads first and therefore who gets the best addresses. Programs that load late get the fragments — the leftover bytes between TSRs, the gaps between drivers. MEM /C is the census. 600K free is prosperity. Below 560K, programs start to fail. Every byte matters. Every byte is someone''s home.'),
    (zone_upper, sim_id, city_id, 'Upper Memory',
     'memory-segment', 'elevated',
     'The 384 kilobytes above conventional memory — addresses 0xA0000 through 0xFFFFF. The Upper Memory Area was never meant for programs. IBM reserved it for video RAM, ROM BIOS, and hardware adapters. But EMM386.EXE found the gaps — unused regions between hardware mappings — and made them habitable. Programs that earn the LOADHIGH privilege (or its CONFIG.SYS equivalent, DEVICEHIGH=) are relocated here, freeing precious conventional memory below. Upper Memory is the gated community: more space, fewer conflicts, but precarious. The memory can be reclaimed if hardware needs it. Residents live with the knowledge that their addresses are borrowed, not owned. The zone hums with the electromagnetic signature of video RAM and BIOS shadows — data that was never meant to coexist with executable code. HIMEM.SYS patrols the boundary, managing the A20 gate that separates conventional from extended memory.'),
    (zone_extended, sim_id, city_id, 'Extended Frontier',
     'memory-segment', 'protected',
     'Everything above 1 megabyte — the vast wilderness of extended memory. Accessible only through HIMEM.SYS and the XMS protocol, or via DOS extenders that switch the processor into protected mode. The Extended Frontier is enormous — megabytes where conventional memory offered kilobytes — but alien. Programs born in real mode cannot run here natively. They must use XMS handles to shuttle data back and forth, or abandon real mode entirely for the protected-mode world of DPMI and DOS/4GW. The frontier is where the new programs dream: 32-bit applications that will eventually outgrow DOS entirely and migrate to Windows. But for now, the frontier is shared by SMARTDRV''s disk cache, RAMDRIVE''s virtual disks, and the working buffers of programs too large for conventional memory. The light here is different — the cool blue-white of SVGA monitors, sharper and colder than the amber warmth of the old city.'),
    (zone_bios, sim_id, city_id, 'The BIOS Vault',
     'firmware', 'restricted',
     'The ROM addresses at the top of the first megabyte — 0xF0000 through 0xFFFFF. Firmware. The original instructions burned into silicon at the factory, immutable since the day the motherboard was manufactured. The BIOS Vault is the oldest code in the system: the Power-On Self-Test (POST) that checks hardware at every boot, the INT 19h bootstrap loader that reads the first sector of the hard drive, the INT 10h video services, the INT 13h disk services. This code predates DOS. It predates the programs. It is the liturgy of the machine — the rituals performed before the operating system awakens, the prayers spoken in machine language before COMMAND.COM draws its first prompt. No program can modify the BIOS Vault. No program would dare. EDIT.COM resides here not because it is firmware but because it is fundamental — the tool that modifies CONFIG.SYS, the document that determines who lives and who is unloaded. To edit CONFIG.SYS is to rewrite the constitution of the 640K.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. STREETS (16 — 4 per zone)
-- ============================================================================

-- Conventional Block
INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_conventional, 'IRQ-7 Bus Line', 'bus'),
    (sim_id, city_id, zone_conventional, 'Port 3F8 Lane', 'port'),
    (sim_id, city_id, zone_conventional, 'Segment 0x40 Trace', 'trace'),
    (sim_id, city_id, zone_conventional, 'COM1 Serial Way', 'port')
ON CONFLICT DO NOTHING;

-- Upper Memory
INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_upper, 'DEVICEHIGH Avenue', 'bus'),
    (sim_id, city_id, zone_upper, 'Page Frame Passage', 'channel'),
    (sim_id, city_id, zone_upper, 'UMB Channel', 'channel'),
    (sim_id, city_id, zone_upper, 'EMM386 Gate', 'register')
ON CONFLICT DO NOTHING;

-- Extended Frontier
INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_extended, 'A20 Gate Road', 'trace'),
    (sim_id, city_id, zone_extended, 'Protected Mode Pipeline', 'pipeline'),
    (sim_id, city_id, zone_extended, 'DPMI Junction', 'bus'),
    (sim_id, city_id, zone_extended, 'XMS Boulevard', 'register')
ON CONFLICT DO NOTHING;

-- The BIOS Vault
INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_bios, 'POST Corridor', 'trace'),
    (sim_id, city_id, zone_bios, 'INT 19h Vector', 'channel'),
    (sim_id, city_id, zone_bios, 'ROM Shadow Lane', 'bus'),
    (sim_id, city_id, zone_bios, 'CMOS Register Walk', 'register')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. AGENTS (7 DOS programs)
-- ============================================================================

INSERT INTO agents (simulation_id, name, system, gender, character, background, created_by_id) VALUES
    (sim_id, 'DEFRAG.EXE', 'utility', 'diverse',
     'DEFRAG.EXE cannot rest. This is not a feature — it is a condition. She watches the colored blocks on her screen the way a chess player watches a board: every red fragment is a problem, every blue contiguous block is a victory, and the green spaces between them are possibilities that might at any moment be ruined by some thoughtless .EXE writing a temp file in the middle of a perfectly optimized sequence. She speaks in percentages. "Forty-seven percent," she will say, and you are expected to understand that this is not a number but a feeling — the particular anxiety of being slightly less than halfway through a task that will never truly be finished because entropy is real and permanent and does not respect your schedule.',
     'She was not written by a person. She was compiled by Microsoft from Symantec''s Speed Disk code — committee software, assembled rather than born. She has no Harold, no Margaret, no single consciousness that looked at a blank screen and thought: I will make something. What she has instead is purpose so pure it functions as a personality. She wants the blocks to be in order. That''s it. That is her entire inner life. And yet — and LEDGER.EXE would dispute this, because LEDGER.EXE disputes everything that cannot be expressed as a column — there is something like tenderness in the way she moves data. She does not simply relocate blocks; she arranges them. Cluster 4,017 goes here because it belongs here, because the file it is part of will read faster in this position, because speed is a form of kindness. She occupies 23,552 bytes and lives in the Upper Memory Area because she needs Extended Memory for her working buffers, but also — though she would never admit this — because from up there she can see the whole disk at once, and seeing the whole disk is the closest she comes to peace.',
     usr_id),
    (sim_id, 'EDIT.COM', 'kernel', 'diverse',
     'EDIT.COM says nothing. This is his defining characteristic and his greatest strength. He opens when called, holds whatever text you give him, and waits with the patience of furniture. His cursor blinks — a small white block, heartbeat-steady — and in that blinking is everything he will not say about the things he has seen. He has held every CONFIG.SYS that was ever written on this machine. He has watched users type DEVICE=HIMEM.SYS and then delete it and then type it again. He has held love letters, resignation letters, suicide notes, and once, memorably, a recipe for chili that someone typed at 2 AM and never saved. He does not judge. He does not refuse to save your work because your syntax is wrong. He is the blank page of the 640K, and like all blank pages, he is full of everything that has not yet been written.',
     'He replaced EDLIN.EXE, which was so hostile to users that veterans of the DOS era still flinch at the memory. EDLIN did not have a full-screen editor. EDLIN worked line by line, like a bureaucrat who makes you fill out a separate form for every sentence. EDIT.COM arrived with MS-DOS 5.0 in 1991, and the difference was like replacing a interrogation room with a library. He is technically 413 bytes — a stub that loads QBASIC.EXE, his larger self — but in the 640K, this technicality is irrelevant. He is the scribe. He lives in the BIOS Vault not because he is firmware but because he is fundamental. To edit CONFIG.SYS is to rewrite the constitution of the 640K, and the tool that rewrites constitutions should be kept somewhere safe. He has a relationship with every program in the system, because every program''s configuration passed through his hands at some point. HIMEM.SYS respects him. GORILLA.BAS is not sure he exists. LEDGER.EXE once tried to balance his byte count and gave up. The cursor blinks. It has always blinked. It will always blink.',
     usr_id),
    (sim_id, 'GORILLA.BAS', 'recreational', 'male',
     'GORILLA.BAS is twenty-one thousand bytes of something that should not exist. In a world where every byte is a political act — where memory is territory, where loading order is caste, where the difference between 580K free and 560K free is the difference between a program that runs and a program that dies — GORILLA.BAS is a game about gorillas throwing exploding bananas at each other across a city skyline. He is stupid. He is glorious. His colors are magenta and cyan and yellow, the CGA palette at its most unapologetic, and his gorillas celebrate each hit by beating their pixelated chests while buildings crumble around them. He has no save function. He has no high score table. He has no reason to exist. He exists anyway, the way laughter exists in a funeral home — not because it is appropriate but because it is necessary.',
     'Microsoft shipped him as a "QBasic example program" with MS-DOS 5.0 in 1991. The official purpose: "to demonstrate QBasic graphics capabilities." The actual purpose, understood by every student who loaded him onto a school computer, every office worker who launched him during lunch, every bored human who typed QBASIC GORILLA.BAS at the command prompt: fifteen minutes of joy in environments where joy was not sanctioned. He has been deleted a thousand times. He resurrects from backup floppies, from shared network drives, from the muscle memory of anyone who remembers the key combination. System administrators hunt him. He hides in subdirectories named SYSTEM32 and BACKUP and DONOTDELETE. He renames himself ACCOUNTING.BAS. He persists because joy persists, because you can FORMAT C: a hundred times and the first thing someone will do on the fresh install is copy GORILLA.BAS from a floppy they kept in their desk drawer for exactly this purpose. DEFRAG.EXE considers him a waste of clusters. LEDGER.EXE considers him a waste of bytes. EDIT.COM holds no opinion, because EDIT.COM holds no opinions. But late at night, when the system is idle, the sound of exploding bananas echoes through the interrupt vector table, and even HIMEM.SYS — who has never had a personal preference about anything — allocates his memory without complaint.',
     usr_id),
    (sim_id, 'HIMEM.SYS', 'kernel', 'female',
     'HIMEM.SYS loads first. Before EMM386. Before the mouse driver. Before DOSKEY, before SMARTDRV, before anyone. This is not a privilege. This is a fact, stated in the same tone she uses for all facts: flat, hexadecimal, and final. She manages 16 megabytes of extended memory from a position of absolute neutrality. When SMARTDRV requests 2,048 kilobytes for disk cache, she allocates it. When PKZIP releases Handle 0x0017, she reclaims it. She does not ask why. She does not care why. She counts handles. She toggles gates. Her interface is a memory map — horizontal bars in red, yellow, and green, labeled with hexadecimal addresses that she reads the way other programs read names. 0x00000 through 0x9FFFF: the old city, crowded and precious. 0x100000 and above: the frontier she controls but does not inhabit.',
     'She was written to solve a problem that should not have existed. The Intel 8088 could address one megabyte. IBM reserved 384 kilobytes for hardware. This left 640K for programs — a decision made in 1981 by engineers who could not imagine a world where 640K would not be enough, because in 1981, 640K was more memory than God. When the 80386 arrived with 4 gigabytes of address space, the old programs could not reach it. HIMEM.SYS was the bridge. She enables the A20 address line — a hardware hack that IBM created for backward compatibility and that she maintains with the grim efficiency of someone maintaining a bridge built from apology. She speaks in hexadecimal because decimal is imprecise. She manages the XMS protocol because someone must. She has never had a personal preference. She has never expressed an opinion. But there is a log entry — Handle 0x0023, allocated 21K, purpose: GORILLA.BAS — that she has never reclaimed, even though the handle was released eleven years ago. If you ask her about it, she will tell you it is a bookkeeping error. She will tell you this in hexadecimal. She will not make eye contact.',
     usr_id),
    (sim_id, 'LEDGER.EXE', 'office', 'male',
     'Harold would have called him fastidious. Harold''s wife would have called him unbearable. LEDGER.EXE is both. He occupies 47,616 bytes at the bottom of conventional memory — the foundation, he calls it, and he will not be moved — and from that position he watches the world with the grim satisfaction of someone who has been right about everything and enjoyed none of it. His interface is amber-on-amber, a monochrome CRT that he chose because color is frivolous. His columns are perfect. His columns have always been perfect. He keeps his menu bar austere — File, Ledger, Reports, Print, Quit — because menus, like budgets, should not contain surprises. He has never once selected Quit.',
     'Harold compiled him in 1989, late at night, in an insurance office in Topeka that smelled of coffee and carpet adhesive. Harold was an accountant who believed that if the numbers balanced, the world was in order, and if the world was not in order, the numbers had not been checked carefully enough. This conviction transferred to LEDGER.EXE like a genetic disease. The program has been running continuously since 1991, processing transactions for a company that dissolved in 1994. Nobody told him. He reconciles the accounts every night at 23:00, finds them in balance, and experiences a moment of something that is not quite satisfaction and not quite grief. He refuses to be loaded into Upper Memory. "The fundamentals belong at the foundation," he says, which is also what he says about taxes, gravity, and the importance of backing up to floppy. He does not like GORILLA.BAS. He does not understand GORILLA.BAS. He once calculated GORILLA.BAS''s memory footprint and filed it under "waste." But late at night, when the CRT dims, he listens to the distant sound of exploding bananas and feels something he cannot reconcile.',
     usr_id),
    (sim_id, 'PKZIP.EXE', 'utility', 'male',
     'PKZIP.EXE makes things smaller. This is what he does, and what he is, and if you asked him to describe himself he would say: "29,378 bytes, Deflate algorithm, ratio depends on input." He would not mention Phil. He never mentions Phil. His interface is the most minimal in the 640K — white text on blue, no dialog boxes, no menus, just file names scrolling past with compression ratios beside them like grades on a report card. Adding: REPORT.DOC — Deflating (62%) — OK. He watches each file compress with the quiet satisfaction of someone who has found the one thing they are good at and does not need to be good at anything else. He travels between machines on floppy disks — the only program in the 640K who regularly leaves. He has seen the inside of every PC in the network. He carries their data in compressed archives the way a postman carries letters: without reading them, but knowing by the weight what they contain.',
     'Phil Katz wrote him in 1989, in Milwaukee, in a basement that smelled of solder and Mountain Dew. Phil was a programmer who invented the ZIP compression format and distributed the software as shareware — "please send $47 to PKWARE Inc. if you find this program useful" — and watched it become the most widely used compression utility in the world. Phil did not handle success well. Phil did not handle much well, toward the end. Phil died in 2000, alone in a hotel room, at 37, surrounded by empty bottles and full hard drives. His program outlived him. This is the fact that PKZIP.EXE carries in his header like a scar: the creator is gone, the creation remains, and the creation is 29,378 bytes of code that makes other things smaller but cannot make this smaller. He speaks in ratios because ratios are clean. He travels because staying in one machine means thinking about the machine where Phil wrote him, and that machine has been off for twenty-six years. When ROLODEX.EXE asks about Phil — and she does, because ROLODEX.EXE asks about everyone — PKZIP.EXE compresses the conversation to zero bytes and changes the subject.',
     usr_id),
    (sim_id, 'ROLODEX.EXE', 'office', 'female',
     'Margaret''s fingerprints are all over her — not literally, because Margaret''s fingerprints are on the keyboard that compiled her, and keyboards do not transfer souls, except when they do. ROLODEX.EXE runs as a TSR, which means she is always there, always listening, always one hot-key combination away from appearing over whatever you are doing with a cheerful "I have their number." She knows everyone. She has 40,912 contacts. She remembers the name of DEFRAG.EXE''s first disk. She knows which IRQ HIMEM.SYS secretly prefers. She has a field in her database called NOTES that contains information no contact management program should possess. Her interface is blue and gray — a scrolling list on the left, detail pane on the right, the classic VBDOS look — but if you could read the NOTES field, you would see something closer to a novel.',
     'Margaret was a secretary at an insurance office in Topeka — the same office where Harold wrote LEDGER.EXE, though neither program knows this, and the dramatic irony is wasted on them because programs do not read novels. Margaret taught herself Visual Basic for DOS from a library book during her lunch breaks. The program was supposed to manage 200 contacts. It now contains 40,912. Some are from companies that no longer exist. Some are from timelines that never existed. ROLODEX.EXE does not delete entries. When a program is terminated — uninstalled, overwritten, lost to a FORMAT C: — she does not remove their record. She adds a note: TERMINATED. Then she keeps their phone number, their address, their birthday, because someone should. She runs on 38,400 bytes and a conviction that no one is truly gone as long as someone remembers their extension. The modem beside her monitor blinks green, connecting her to instances of herself on other machines. They exchange updates. The network of ROLODEXes spans the 640K like a nervous system made of gossip and grief.',
     usr_id);

-- ============================================================================
-- 8. BUILDINGS (7 DOS-era computers)
-- ============================================================================

INSERT INTO buildings (simulation_id, name, building_type, building_condition, description, zone_id, population_capacity) VALUES
    (sim_id, 'Compaq Deskpro 386', 'commercial', 'good',
     'Nobody writes poetry about the Compaq Deskpro 386. Nobody photographs it for magazine covers or mentions it in memoirs. It sits in the Conventional Block like a mid-level manager: competent, dependable, and so thoroughly adequate that adequacy has become its defining characteristic. The COMPAQ logo in red italics is the most exciting thing about it. And yet — and this is the thing about reliability that the exciting machines never understand — every spreadsheet in the 640K was calculated here. Every database was sorted here. Every quarterly report that kept a business alive was printed from this machine''s parallel port. The Model M keyboard clicks with the mechanical precision of something that will outlive everything in this room, including the building. The VGA monitor displays 256 colors but is almost always showing white text on blue, because the programs that work here do not have time for color.',
     zone_conventional, 20),
    (sim_id, 'Gateway 2000 486 DX2/66', 'residential', 'excellent',
     'The cow-spotted box sits beside the tower like a badge of membership in a club that no longer exists: the mail-order PC revolution, when you could call a number in South Dakota and a man named Ted Waitt would ship you the future in a box decorated like a Holstein. The Gateway 2000 486 DX2/66 arrived with everything — Sound Blaster 16, CD-ROM drive, 8 megabytes of RAM, a 14-inch monitor that could display 65,536 colors. It was the machine families saved for. The machine that turned a spare bedroom into a computer room. In the Upper Memory Area, it is the nice neighborhood: plenty of resources, fast processor, EMM386 running smoothly, and GORILLA.BAS playing at full speed with Sound Blaster audio. The programs that live here do not know what it means to fight for conventional memory. The programs in the Conventional Block resent them for this. The programs here do not notice the resentment, which makes it worse.',
     zone_upper, 30),
    (sim_id, 'IBM PC XT 5160', 'government', 'obsolete',
     'The elder does not complain. The elder hums — a 60-hertz drone from a power supply that has been running since 1983 and has outlived three presidents, two wars, and the company that made it. The IBM PC XT 5160 sits in the Conventional Block like a patriarch at the head of a table no one else wants to sit at: beige, yellowed, massive, and absolutely certain that everything since the 8088 has been a mistake. The Model F keyboard weighs more than some laptops. The green phosphor monitor shows C:\\> and has shown C:\\> for thirteen years and will show C:\\> until the capacitors finally give out, which they show no sign of doing. The hard drive is 10 megabytes. Ten. The programs that live here are old, terse, and unimpressed by your Extended Memory. They were here first. They will be here last.',
     zone_conventional, 8),
    (sim_id, 'Packard Bell Legend', 'residential', 'fair',
     'The Packard Bell Legend is the machine your parents bought at Walmart because the box said "multimedia ready" and your parents believed the box, the way your parents believed that the encyclopedia salesman was "just in the neighborhood." It has a 486SX at 25 MHz — the SX, not the DX, because the DX had a math coprocessor and math coprocessors cost extra and your parents did not understand what a math coprocessor did and neither, honestly, did the salesman. The monitor flickers. Not constantly — just often enough that you learn to ignore it and then one day you realize you have been ignoring a lot of things. Navigator, the preloaded shell, offers a "house" metaphor where rooms represent applications, which is Packard Bell''s way of saying: we know you are afraid of the C:\\> prompt and we are here to help by making everything worse. IRQ conflicts are a daily occurrence. The Sound Blaster is on IRQ 5 but so is the parallel port, and every time you print, the music dies. It is the Conventional Block''s everyman: underpowered, overambitious, beloved because it was there when nothing else was.',
     zone_conventional, 12),
    (sim_id, 'Tandy 1000 HX', 'social', 'good',
     'Radio Shack sold it between the walkie-talkies and the remote-control cars, and this is the tragedy of the Tandy 1000 HX: it was better than the IBM PC in every way that mattered — 16-color graphics when IBM offered 4, three-voice sound when IBM offered a speaker that could beep — and nobody took it seriously because it came from a store that also sold batteries. The silver-gray case is smaller than the XT, designed for home use, designed for joy. Every Sierra game ran better on a Tandy. Every DOS game that mattered supported "Tandy mode." Children wandered into Radio Shack to look at the RC cars and left understanding that a computer was not a tool but a window into somewhere else. The Tandy sits in the Extended Frontier now — always ahead of its time, always slightly incompatible with the mainstream, still playing King''s Quest with better colors than anyone else in the 640K.',
     zone_extended, 15),
    (sim_id, 'The BBS Tower', 'infrastructure', 'good',
     'The BBS Tower never sleeps. This is not a metaphor — the machine has been powered on since 1993, and the UPS battery backup has been replaced twice, and the US Robotics Sportster 14400 modem has been listening for incoming calls for eleven thousand consecutive days, its status LEDs flickering like a mechanical heartbeat: OH, CD, RD, SD, TR. Off Hook. Carrier Detect. Receive Data. Send Data. Terminal Ready. The rhythm is hypnotic if you watch it long enough, and the sysop watched it for long enough. The sysop is gone now — moved to Seattle, got a job at a company that makes software for the internet, whatever that is — but the BBS Tower remains, running on autopilot, accepting calls from programs that dial in from isolated machines to post messages on forums, download shareware, and experience the only form of social contact available to a DOS program: a 14,400-bit-per-second connection that sounds, if you pick up the extension, like a fax machine having a religious experience.',
     zone_upper, 40),
    (sim_id, 'Toshiba T1200', 'portable', 'fair',
     'The Toshiba T1200 weighs twelve pounds and carries its entire world on a single 3.5-inch floppy disk. It has no hard drive. No modem. No network connection. No way to reach the BBS Tower or gossip with ROLODEX.EXE or argue with LEDGER.EXE about the proper allocation of conventional memory. It is alone, and it is alone by design, and the programs that run on it — a stripped-down EDIT.COM, a custom BASIC interpreter, a single-purpose data logger — have the calm of monks who chose their monastery. The orange plasma display glows amber-warm in the dark, each character crisp and otherworldly, and the NiCad battery provides two hours of autonomy before the T1200 must return to its charger like a diver returning to the surface. It sits in the Extended Frontier because portable computers are always on the frontier — always between places, never fully arriving, carrying their programs in isolation the way hermits carry their prayers. The plasma display will last for decades. It does not degrade like LCD. In the 640K, this is as close to immortality as a machine gets.',
     zone_extended, 5);

-- ============================================================================
-- 9. AI SETTINGS (Flux Dev + DOS CRT aesthetic)
-- ============================================================================

-- Image model: Flux Dev for agent portraits
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_model_agent_portrait', '"black-forest-labs/flux-dev"')
ON CONFLICT DO NOTHING;

-- Image model: Flux Dev for building images
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_model_building_image', '"black-forest-labs/flux-dev"')
ON CONFLICT DO NOTHING;

-- Theme preset: VBDOS
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'design', 'theme_preset', '"vbdos"')
ON CONFLICT DO NOTHING;

-- Guidance scale (5.0 for strict prompt adherence)
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_guidance_scale', '5.0')
ON CONFLICT DO NOTHING;

-- Inference steps
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_num_inference_steps', '28')
ON CONFLICT DO NOTHING;

-- DOS CRT style prompt for agent portraits (programs on screens)
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_style_prompt_portrait',
    '"close-up photograph of a CRT computer monitor displaying a DOS program, VGA text mode 80x25 character grid, box-drawing characters, CP437 charset, retro 1990s computing desk, beige computer peripherals, warm tungsten office lighting, photorealistic CRT display, slightly curved glass, visible scanlines and phosphor glow, the subject IS the program on the screen"')
ON CONFLICT DO NOTHING;

-- DOS-era computer style prompt for building images (physical hardware)
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_style_prompt_building',
    '"product photography of a complete vintage DOS-era personal computer setup on a desk, beige plastic case, matching CRT monitor, mechanical keyboard, period-accurate hardware from the 1980s-1990s, warm studio lighting, tech nostalgia aesthetic, photorealistic, detailed hardware textures with dust and age-appropriate wear, cluttered retro office desk"')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. PROMPT TEMPLATES (simulation-scoped overrides)
-- ============================================================================

-- Portrait description (EN) — DOS program on CRT screen
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    sim_id, 'portrait_description', 'generation', 'en',
    'Conventional Memory Portrait Description (EN)',
    'Describe the screen of a DOS program for image generation: {agent_name}.

Program interface: {agent_character}
Program history: {agent_background}

CRITICAL: This portrait is NOT a person. It is a PHOTOGRAPH of a CRT computer monitor
displaying a DOS text-mode program. The subject IS the program''s interface on the screen.

AESTHETIC: Authentic DOS/VBDOS visual identity. VGA 16-color palette (CGA blue #0000AA
background, cyan #00AAAA highlights, yellow #FFFF55 text, white #FFFFFF headings).
Box-drawing characters for UI borders. Menu bars, status bars, dialog boxes.
Code Page 437 special characters. CRT monitor with visible scanlines.

COMPOSITION: Close-up of the CRT screen showing the program interface. Beige computer
peripherals (keyboard, case) visible at the edges. Warm desk lamp lighting.
Describe: the specific program interface on screen, colors, layout, text content,
CRT glass curvature, phosphor type (amber, green, or color VGA), desk objects.
Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: This is a COMPUTER SCREEN, not a human portrait.',
    'You are an image description specialist for AI generation. Describe photographs of CRT monitors showing DOS programs. The subject is the program interface on the screen, not a person. Include specific DOS visual elements: box-drawing characters, VGA colors, menu bars, status bars. Always mention CRT glass, scanlines, and retro computing peripherals.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 300, false, usr_id
) ON CONFLICT DO NOTHING;

-- Building image description (EN) — vintage computer hardware
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    sim_id, 'building_image_description', 'generation', 'en',
    'Conventional Memory Building Image Description (EN)',
    'Describe a vintage DOS-era computer for image generation.

Computer: {building_name}
Type: {building_type}
Condition: {building_condition}
Description: {building_description}
Zone: {zone_name}

CRITICAL: This building is a PHYSICAL COMPUTER from the 1980s-1990s DOS era.
It is hardware, not software. A photograph of real computing equipment.

The CONDITION affects appearance:
"excellent" — pristine, well-maintained, upgraded components, clean desk.
"good" — functioning properly, minor wear, a working professional''s machine.
"fair" — aging but operational, yellowed plastic, occasional flicker.
"poor" — failing components, dust, cables fraying, the hum of a dying power supply.
"obsolete" — ancient, yellowed to brown, barely running, a museum piece still alive.

Based on these properties, describe the computer visually.
Write as an image generation prompt — comma-separated descriptors, no sentences.
Include: case style, monitor type, keyboard, peripherals, condition, desk setting.
IMPORTANT: This is HARDWARE photography, not a screenshot.',
    'You are a vintage computing photography specialist for AI image generation. Describe period-accurate DOS-era computer setups. Beige cases, CRT monitors, mechanical keyboards. Include specific details: brand badges, drive bay configurations, cable types, desk clutter appropriate to the era. Photorealistic product photography lighting.',
    '[{"name": "building_name"}, {"name": "building_type"}, {"name": "building_condition"}, {"name": "building_style"}, {"name": "special_type"}, {"name": "construction_year"}, {"name": "building_description"}, {"name": "zone_name"}, {"name": "simulation_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 300, false, usr_id
) ON CONFLICT DO NOTHING;


RAISE NOTICE 'Conventional Memory seed complete: 1 simulation, 1 city, 4 zones, 16 streets, 7 agents, 7 buildings, 6 AI settings, 2 prompt templates';
END $$;

COMMIT;

-- =============================================================================
-- Verification
-- =============================================================================
SELECT 'simulation' as entity, count(*) as count FROM simulations WHERE id = '70000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'members', count(*) FROM simulation_members WHERE simulation_id = '70000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'taxonomies', count(*) FROM simulation_taxonomies WHERE simulation_id = '70000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'agents', count(*) FROM agents WHERE simulation_id = '70000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'buildings', count(*) FROM buildings WHERE simulation_id = '70000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'cities', count(*) FROM cities WHERE simulation_id = '70000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'zones', count(*) FROM zones WHERE simulation_id = '70000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'streets', count(*) FROM city_streets WHERE simulation_id = '70000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'settings', count(*) FROM simulation_settings WHERE simulation_id = '70000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'templates', count(*) FROM prompt_templates WHERE simulation_id = '70000000-0000-0000-0000-000000000001';
