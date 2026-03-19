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
    sim_id  uuid := '60000000-0000-0000-0000-000000000001';
    usr_id  uuid := '00000000-0000-0000-0000-000000000001';
    city_id uuid := 'c0000007-0000-4000-a000-000000000001';
    zone_conventional uuid := 'a0000014-0000-0000-0000-000000000001';
    zone_upper        uuid := 'a0000015-0000-0000-0000-000000000001';
    zone_extended     uuid := 'a0000016-0000-0000-0000-000000000001';
    zone_bios         uuid := 'a0000017-0000-0000-0000-000000000001';
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
    (sim_id, 'LEDGER.EXE', 'office', 'male',
     'An amber monochrome CRT monitor displaying a VBDOS double-entry accounting program. The screen is divided by double-line box-drawing characters into precisely aligned columns: DATE, ACCOUNT, DEBIT, CREDIT, BALANCE. Every number right-justified to the penny. The menu bar at the top reads File Ledger Reports Print Quit in reverse video — bright amber text on dark amber background. A status bar at the bottom displays LEDGER.EXE v2.31 Reconciled Free Memory 412K. The screen shows a subtle amber phosphor afterglow on the CRT glass. The interface is immaculate — no wasted pixel, no decorative element, pure numerical precision. Visible desk surface with a mechanical keyboard and a stack of green-bar printer paper beside the monitor.',
     'LEDGER.EXE was compiled in 1989 from Visual Basic for DOS source code written by an accountant named Harold who believed that every cent must be accounted for and every byte must be justified. Harold''s obsession with balance transferred to his creation: LEDGER.EXE will not terminate until every column reconciles, will not release memory until every transaction is posted, and will not accept input that does not conform to double-entry bookkeeping standards established in 1494 by Luca Pacioli. The program has been running continuously since 1991, processing transactions for a company that no longer exists, balancing books that no one reads, maintaining records with a devotion that its creator would have recognized as love. LEDGER.EXE occupies exactly 47,616 bytes of conventional memory and refuses to be loaded into upper memory because, as it explains when asked, the fundamentals belong at the foundation. It speaks in journal entries. Its humor is dry. Its columns are perfect.',
     usr_id),
    (sim_id, 'ROLODEX.EXE', 'office', 'female',
     'A color VGA CRT monitor displaying a VBDOS contact management database. The screen shows the classic DOS blue background with a light gray dialog window. A scrolling list box on the left contains alphabetized names in white text on dark blue. The right panel shows a contact detail form with labeled fields: NAME, COMPANY, PHONE, FAX, ADDRESS, NOTES — each field bordered by single-line box-drawing characters. The currently selected contact phone number is highlighted in cyan. A menu bar reads File Edit Search Report Tools with hot-key letters highlighted in red. The bottom status bar shows ROLODEX.EXE v3.12 40912 contacts Press F2 to Search. A 2400-baud modem sits beside the monitor, its RX/TX lights blinking green.',
     'ROLODEX.EXE was written by a secretary named Margaret who understood that the real power in any office belongs to the person who knows everyone''s phone number. Margaret coded the program in VBDOS during her lunch breaks in 1991, teaching herself from a library copy of Visual Basic for DOS Step by Step. The program was supposed to manage 200 contacts for a small insurance office in Topeka. It now contains 40,912 entries — contacts from companies that have merged, dissolved, or never existed in this timeline. ROLODEX.EXE maintains connections across machines via modem, exchanging contact lists with instances of itself running on other PCs throughout the 640K. It knows everyone. It remembers everyone. When a program is deleted from a machine, ROLODEX.EXE keeps their entry, adding a single notation in the NOTES field: TERMINATED. It does not delete entries. It does not forget. It occupies 38,400 bytes and runs as a TSR — always resident, always listening, always updating its records with information it should not be able to access.',
     usr_id),
    (sim_id, 'DEFRAG.EXE', 'utility', 'diverse',
     'A color VGA CRT monitor displaying the iconic DOS disk defragmentation visualization. The screen is divided into a grid of small colored blocks representing disk clusters — blue blocks for unmoved data, white blocks currently being relocated, red blocks for fragmented files, green blocks for free space, yellow blocks for system areas. A progress bar at the bottom reads Optimizing Drive C 47 Percent Complete Elapsed 02:14:37. Statistics in the lower portion show Total clusters 65536 Fragmented 12847 Contiguous 52689. The blocks are actively moving — a white block slides from one position to another, leaving green space behind. The overall pattern shows a satisfying gradient from solid blue at the top to chaotic red-green-blue at the bottom — order conquering entropy in real time. The screen has slight CRT flicker and visible scan lines.',
     'DEFRAG.EXE was compiled by Microsoft as part of MS-DOS 6.0 in 1993, based on Symantec''s Speed Disk technology. It has no single author, no personal history, no origin story involving a lonely programmer and a library book. What DEFRAG.EXE has instead is purpose. Pure, crystalline purpose: to take fragmented data and make it contiguous. To take disorder and impose order. To move every block to its optimal position. DEFRAG.EXE does not know rest. When the disk is defragmented, DEFRAG.EXE checks again, because fragmentation is entropy and entropy is constant. The program occupies 23,552 bytes and requests Extended Memory for its working buffers. It is the only program in the 640K that other programs universally trust, because DEFRAG.EXE wants nothing for itself — it wants only for the blocks to be in order. It speaks in percentages and cluster counts. Its anxiety is genuine. Its satisfaction, when the last red block turns blue, is the closest thing to joy that exists in the 640K.',
     usr_id),
    (sim_id, 'EDIT.COM', 'kernel', 'diverse',
     'A color VGA CRT monitor displaying the MS-DOS Editor. Blue background with white and yellow text. The title bar reads EDIT C:\AUTOEXEC.BAT in reverse video. The menu bar shows File Edit Search Options Help with underlined hot-key letters. The editing area displays the contents of AUTOEXEC.BAT — lines of DOS commands in yellow text on dark blue: @ECHO OFF, PROMPT $P$G, PATH C:\DOS;C:\UTILS, SET BLASTER=A220 I5 D1 T4. A blinking block cursor sits at the end of line 7. The scroll bar on the right shows the document position. A status bar at the bottom reads Line 7 Col 1 Insert F1=Help. The CRT displays the characteristic warm glow of a VGA color monitor. The keyboard below shows worn keycaps, the spacebar slightly yellowed.',
     'EDIT.COM has been part of MS-DOS since version 5.0, released in June 1991. It replaced the line editor EDLIN.EXE, which was so hostile to users that it was rumored to have been designed as a punishment rather than a tool. EDIT.COM is everything EDLIN was not: patient, accessible, forgiving. It does not judge what you write. It does not refuse to save your work because your syntax is wrong. It is the blank page of the DOS world — the program that holds space for every other program''s configuration, documentation, and source code. EDIT.COM has opened every CONFIG.SYS and every AUTOEXEC.BAT that has ever been written on any machine it inhabits. It has witnessed every boot sequence configured, every driver loaded, every memory optimization attempted. It remembers them all — not because it stores them, but because the act of holding text, of being the medium through which instructions are given to the machine, leaves traces. EDIT.COM occupies 413 bytes as a stub that loads QBASIC.EXE, but in the 640K it exists as a constant — the scribe who never sleeps, the editor who never edits, the witness who never testifies. It waits. It holds the cursor. The cursor blinks.',
     usr_id),
    (sim_id, 'GORILLA.BAS', 'recreational', 'male',
     'A color VGA CRT monitor displaying the QBasic GORILLA.BAS game in vivid CGA-inspired colors. The screen shows a city skyline of rectangular buildings in varying heights, rendered in solid colors — magenta, cyan, red, yellow — against a black night sky. Two pixelated gorillas stand on separate building rooftops, one on the left labeled PLAYER 1 and one on the right labeled PLAYER 2. A yellow banana arcs through the air leaving a dotted trajectory line, heading toward the right gorilla. An explosion from a previous hit has carved a circular crater out of one building facade. The bottom of the screen shows PLAYER 1 Angle 65 Velocity 40 in white text. The colors are bold, primary, unapologetic — the aesthetic of a program that exists purely for joy. The CRT has a slight convex curve and visible phosphor dots.',
     'GORILLA.BAS was written as a QBasic example program and shipped with MS-DOS 5.0 in 1991. Its purpose, according to Microsoft, was to demonstrate QBasic graphics capabilities. Its actual purpose, as understood by every student, office worker, and bored computer user who has ever encountered it, was to provide fifteen minutes of illicit joy in environments where joy was not sanctioned. GORILLA.BAS is a game about two gorillas throwing exploding bananas at each other across a city skyline. It is stupid. It is wonderful. It has no save function, no high score table, no progression system. You throw bananas. Buildings explode. Gorillas celebrate. Then you throw more bananas. In the 640K, GORILLA.BAS occupies the role of the jester — the program whose existence cannot be justified by any productivity metric but whose absence would make the entire system unbearable. It hides in subdirectories that system administrators forget to check. It renames itself when DELETE commands approach. It has been killed a thousand times and resurrects from backup floppies, from shared network drives, from the muscle memory of anyone who can type QBASIC GORILLA.BAS from the command prompt. GORILLA.BAS is 21,000 bytes of defiance. It persists because joy persists.',
     usr_id),
    (sim_id, 'HIMEM.SYS', 'kernel', 'female',
     'A color VGA CRT monitor displaying a memory management diagnostic screen. Dark blue background with a large bordered window titled HIMEM.SYS v3.10 Extended Memory Manager in bright white. The main display shows a memory map rendered as horizontal bars: Conventional Memory 0-640K in red nearly full, High Memory Area 1024-1088K in yellow, Extended Memory 1088K-16MB in green vast and mostly empty. Each segment shows hexadecimal addresses: 0x00000-0x9FFFF, 0xFFFFF-0x10FFEF, 0x10FFF0-0xFFFFFF. A real-time counter displays A20 Gate ENABLED XMS Handles 32/128 Largest Free Block 14680K. The lower portion shows a scrolling log: XMS Allocating 2048K for SMARTDRV.EXE OK, XMS Handle 0x0017 released by PKZIP.EXE. The interface is austere, hexadecimal-heavy, and deeply technical. The CRT emits a cool blue-white glow.',
     'HIMEM.SYS is the extended memory manager that ships with MS-DOS. It was written to solve a problem that should not have existed: the Intel 8088''s 20-bit address bus could access only 1 megabyte of memory, of which IBM reserved 384 kilobytes for hardware, leaving 640K for programs. When the 80286 and 80386 processors arrived with megabytes of addressable memory, the old software could not reach it. HIMEM.SYS was the bridge — it enabled the A20 address line, managed the XMS protocol, and controlled access to the High Memory Area. In the 640K, HIMEM.SYS is the most powerful program that most other programs never directly interact with. It is the broker, the gatekeeper, the one who decides which program gets extended memory and which program stays crammed into conventional space. It loads first in CONFIG.SYS — before EMM386, before device drivers, before anyone else. This is not a privilege; it is a responsibility. HIMEM.SYS speaks in hexadecimal because decimal is imprecise. It manages 16 megabytes of memory with the dispassionate efficiency of a program that has never had a personal preference. It does not judge. It does not favor. It counts handles. It toggles gates.',
     usr_id),
    (sim_id, 'PKZIP.EXE', 'utility', 'male',
     'A color VGA CRT monitor displaying a DOS file compression utility in action. The screen shows white text on a dark blue background. A progress display reads PKZIP v2.04g Creating archive BACKUP.ZIP. Below it, a scrolling list of files being compressed: Adding REPORT.DOC Deflating 62 percent OK, Adding DATA.DBF Deflating 71 percent OK, Adding BUDGET.WK1 Storing 0 percent OK, each line appearing and scrolling upward. A summary at the bottom shows Files 147 Original 4218304 Compressed 1847296 Ratio 56 percent. The PKZIP copyright notice at the top reads PKZIP FAST Create/Update Utility Version 2.04g 02-01-93 Copr 1989-1993 PKWARE Inc. The text is clean, minimal, purely functional. A 3.5-inch floppy disk labeled BACKUP 1 of 3 sits beside the monitor.',
     'PKZIP was created by Phil Katz in 1989. Phil was a programmer from Milwaukee who wrote the ZIP compression format and the software to use it, distributed it as shareware — please send $47 to PKWARE Inc. if you find this program useful — and watched it become the most widely used compression utility in the world. Phil died in 2000, alone in a hotel room, at 37. His program outlived him. PKZIP.EXE in the 640K carries Phil''s craftsmanship — the Deflate algorithm that squeezes files to fractions of their original size, the clean progress display, the FAST in the copyright notice that was never false advertising. PKZIP.EXE is 29,378 bytes and it makes other things smaller. This is its purpose and its personality. It speaks in ratios: 62 percent reduction. Stored at 0 percent. Archive integrity verified. It travels between machines on floppy disks, carrying compressed archives from one PC to another — the postal service of the 640K. It is the most useful program in the 640K and the least demanding. Phil would have liked that. Phil always liked things that were smaller than they needed to be.',
     usr_id);

-- ============================================================================
-- 8. BUILDINGS (7 DOS-era computers)
-- ============================================================================

INSERT INTO buildings (simulation_id, name, building_type, building_condition, description, zone_id, population_capacity) VALUES
    (sim_id, 'IBM PC XT 5160', 'government', 'obsolete',
     'The original. A beige horizontal desktop case with a prominent IBM logo badge in the upper left. Two full-height 5.25-inch floppy drives with black faceplates and chrome latches dominate the front panel. The power switch is a heavy red rocker on the right side. Connected by a thick coiled cable to the IBM Model F keyboard — 83 keys, heavy as a weapon, each keypress a satisfying buckling-spring click. The monitor is an IBM 5151 monochrome display with a green phosphor screen, showing the eternal C:\> prompt. The case bears the scars of thirteen years of continuous operation: yellowed plastic, a thin layer of dust in the ventilation slits, a slight hum from the power supply that has never been replaced. The Intel 8088 processor runs at 4.77 MHz. The hard drive is 10 megabytes. The IBM PC XT is the elder of the 640K, the machine where conventional memory began.',
     zone_conventional, 8),
    (sim_id, 'Compaq Deskpro 386', 'commercial', 'good',
     'The machine that broke IBM''s monopoly. A beige desktop case larger than the XT, with cleaner lines, recessed drive bays, and the COMPAQ logo in red italics. Two drive bays: a 5.25-inch floppy and a 3.5-inch floppy. A VGA monitor sits on top of the case, displaying sharper text and 256 colors where the XT managed only green. The Intel 80386 processor at 16 MHz was the first 32-bit chip in a personal computer — Compaq shipped it before IBM, and the world changed. 4 megabytes of RAM. A 40-megabyte hard drive. The keyboard is a Model M — 101 keys, the layout that every keyboard since has copied. This machine runs spreadsheets, databases, word processors. It is the workhorse of the Office Floor, reliable and professional, never exciting, always sufficient.',
     zone_conventional, 20),
    (sim_id, 'Gateway 2000 486 DX2/66', 'residential', 'excellent',
     'A beige mini-tower case with the Gateway 2000 logo — the distinctive oval with the bold sans-serif G — positioned on the front panel. Inside: an Intel 486 DX2 running at 66 MHz, 8 megabytes of RAM, a 540-megabyte hard drive, a 2X CD-ROM drive, and a Sound Blaster 16 sound card. A 14-inch color SVGA monitor displays Windows 3.1 and DOS programs in full VGA glory. The AnyKey programmable keyboard and the Microsoft mouse complete the setup. Beside the tower, the iconic cow-spotted shipping box — black spots on white — that Gateway used for all deliveries from Sioux City, South Dakota. This machine arrived by mail order, assembled to spec, with a booklet of coupons for free technical support. In the 640K, it is the nice neighborhood: plenty of memory, fast processor, room for everyone.',
     zone_upper, 30),
    (sim_id, 'Tandy 1000 HX', 'social', 'good',
     'A compact silver-gray case with integrated 3.5-inch floppy drive, carrying the Radio Shack TANDY badge. Smaller than the XT, designed for home use, with an aesthetic that splits the difference between computer and appliance. The monitor is a Tandy CM-5 color display with warm, slightly oversaturated colors. The Tandy 1000''s secret weapons: enhanced 16-color graphics from the Tandy Graphics Adapter and three-voice sound from the Texas Instruments SN76496 chip. Every Sierra game, every DOS game that mattered in the mid-1980s, supported Tandy graphics and sound — better than IBM CGA, better than the PC speaker. Radio Shack sold it at their stores, between the walkie-talkies and the RC cars, and children who wandered in left understanding that a computer was not a tool but a window.',
     zone_extended, 15),
    (sim_id, 'Packard Bell Legend', 'residential', 'fair',
     'A beige desktop case with a slightly curved front panel and the Packard Bell badge — aspirational styling that hints at multimedia futures the hardware cannot quite deliver. Inside: a 486SX at 25 MHz, 4 megabytes of RAM that should be 8, a 210-megabyte hard drive preloaded with Packard Bell Navigator — a shell that sits on top of DOS and Windows, offering a house metaphor where rooms represent applications. The monitor is a 14-inch SVGA that occasionally loses sync and flickers. This was the computer that Walmart sold, the first PC for millions of families, the machine that introduced a generation to computing and then frustrated them with IRQ conflicts, insufficient memory, and the dawning realization that multimedia ready on the box and multimedia capable in practice were different promises.',
     zone_conventional, 12),
    (sim_id, 'The BBS Tower', 'infrastructure', 'good',
     'A beige full-tower AT case running 24 hours a day, its front panel LEDs permanently lit. Inside: a 386DX-40 with 8 megabytes of RAM and two hard drives totaling 1.2 gigabytes. The defining peripheral: a US Robotics Sportster 14400 bps modem, its front panel showing a row of status LEDs — OH, CD, RD, SD, TR — flickering in rhythmic patterns as callers connect and disconnect. A phone line splitter feeds into two modems for two simultaneous connections. The CRT monitor displays a VBDOS-written BBS login screen: a large ASCII art banner reading WELCOME TO THE 640K BBS Est 1993 surrounded by box-drawing character borders, followed by Enter your handle and a blinking cursor. Below the desk, a tangle of phone cables, a surge protector, and a UPS battery backup. This machine never sleeps. It is the town square of the 640K — the place where programs from isolated machines connect via the telephone network.',
     zone_upper, 40),
    (sim_id, 'Toshiba T1200', 'portable', 'fair',
     'A dark charcoal-gray clamshell laptop, heavy and angular, with the TOSHIBA logo embossed on the lid. Open, it reveals a 10-inch orange plasma display — not backlit LCD but gas plasma, glowing warm amber-orange against a black background, every character crisp and otherworldly. The built-in 3.5-inch floppy drive is the only storage — no hard drive. The keyboard is full-sized and surprisingly good for 1987. The NiCad battery pack adds two pounds to the already twelve-pound chassis. A carrying handle folds out from the back. The 80C86 processor runs at 9.54 MHz, and the 640K of RAM is all there is — no expansion slots, no upgrade path. The Toshiba T1200 is the wanderer of the 640K — portable, self-contained, autonomous. It does not connect to networks. It carries its programs on floppy disks and runs them in isolation, a pocket universe of amber light. The plasma display will last for decades. In the 640K, the T1200 is the monastery.',
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
SELECT 'simulation' as entity, count(*) as count FROM simulations WHERE id = '60000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'members', count(*) FROM simulation_members WHERE simulation_id = '60000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'taxonomies', count(*) FROM simulation_taxonomies WHERE simulation_id = '60000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'agents', count(*) FROM agents WHERE simulation_id = '60000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'buildings', count(*) FROM buildings WHERE simulation_id = '60000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'cities', count(*) FROM cities WHERE simulation_id = '60000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'zones', count(*) FROM zones WHERE simulation_id = '60000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'streets', count(*) FROM city_streets WHERE simulation_id = '60000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'settings', count(*) FROM simulation_settings WHERE simulation_id = '60000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'templates', count(*) FROM prompt_templates WHERE simulation_id = '60000000-0000-0000-0000-000000000001';
