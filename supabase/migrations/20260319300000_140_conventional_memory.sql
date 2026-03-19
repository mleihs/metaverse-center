-- =============================================================================
-- MIGRATION 140: Conventional Memory — DOS Programs as Living Beings
-- =============================================================================
-- Simulation #6: Programs are citizens, computers are buildings, 640K is the world.
-- Shard question: "What if the machine remembered?"
-- =============================================================================

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

-- ── 1. SIMULATION ──

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

-- ── 2. OWNER MEMBERSHIP ──

INSERT INTO simulation_members (simulation_id, user_id, member_role)
VALUES (sim_id, usr_id, 'owner')
ON CONFLICT (simulation_id, user_id) DO NOTHING;

-- ── 3. TAXONOMIES (13 categories) ──

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'gender', 'male',    '{"en":"Male","de":"Männlich"}', 1),
    (sim_id, 'gender', 'female',  '{"en":"Female","de":"Weiblich"}', 2),
    (sim_id, 'gender', 'diverse', '{"en":"Diverse","de":"Divers"}', 3),
    (sim_id, 'gender', 'program', '{"en":"Program","de":"Programm"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'profession', 'accountant',       '{"en":"Accountant","de":"Buchhalter"}', 1),
    (sim_id, 'profession', 'database-manager', '{"en":"Database Manager","de":"Datenbankverwalter"}', 2),
    (sim_id, 'profession', 'disk-optimizer',   '{"en":"Disk Optimizer","de":"Festplattenoptimierer"}', 3),
    (sim_id, 'profession', 'text-editor',      '{"en":"Text Editor","de":"Texteditor"}', 4),
    (sim_id, 'profession', 'game-program',     '{"en":"Game Program","de":"Spielprogramm"}', 5),
    (sim_id, 'profession', 'memory-manager',   '{"en":"Memory Manager","de":"Speichermanager"}', 6),
    (sim_id, 'profession', 'archivist',        '{"en":"Archivist","de":"Archivar"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'system', 'kernel',       '{"en":"System Core","de":"Systemkern"}', 1),
    (sim_id, 'system', 'office',       '{"en":"Office Suite","de":"Bürosoftware"}', 2),
    (sim_id, 'system', 'utility',      '{"en":"System Utilities","de":"Systemwerkzeuge"}', 3),
    (sim_id, 'system', 'recreational', '{"en":"Recreational","de":"Unterhaltung"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'building_type', 'residential',    '{"en":"Residential","de":"Wohnbereich"}', 1),
    (sim_id, 'building_type', 'commercial',     '{"en":"Commercial","de":"Gewerbebereich"}', 2),
    (sim_id, 'building_type', 'government',     '{"en":"Government","de":"Regierung"}', 3),
    (sim_id, 'building_type', 'infrastructure', '{"en":"Infrastructure","de":"Infrastruktur"}', 4),
    (sim_id, 'building_type', 'social',         '{"en":"Social","de":"Sozialbereich"}', 5),
    (sim_id, 'building_type', 'portable',       '{"en":"Portable","de":"Tragbar"}', 6),
    (sim_id, 'building_type', 'industrial',     '{"en":"Industrial","de":"Industriebereich"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'building_condition', 'excellent', '{"en":"Excellent","de":"Ausgezeichnet"}', 1),
    (sim_id, 'building_condition', 'good',      '{"en":"Good","de":"Gut"}', 2),
    (sim_id, 'building_condition', 'fair',      '{"en":"Fair","de":"Befriedigend"}', 3),
    (sim_id, 'building_condition', 'poor',      '{"en":"Poor","de":"Schlecht"}', 4),
    (sim_id, 'building_condition', 'obsolete',  '{"en":"Obsolete","de":"Veraltet"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'zone_type', 'memory-segment', '{"en":"Memory Segment","de":"Speichersegment"}', 1),
    (sim_id, 'zone_type', 'firmware',       '{"en":"Firmware","de":"Firmware"}', 2)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'security_level', 'open',       '{"en":"Open","de":"Offen"}', 1),
    (sim_id, 'security_level', 'elevated',   '{"en":"Elevated","de":"Erhöht"}', 2),
    (sim_id, 'security_level', 'protected',  '{"en":"Protected","de":"Geschützt"}', 3),
    (sim_id, 'security_level', 'restricted', '{"en":"Restricted","de":"Eingeschränkt"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'urgency_level', 'low',      '{"en":"Low","de":"Niedrig"}', 1),
    (sim_id, 'urgency_level', 'medium',   '{"en":"Medium","de":"Mittel"}', 2),
    (sim_id, 'urgency_level', 'high',     '{"en":"High","de":"Hoch"}', 3),
    (sim_id, 'urgency_level', 'critical', '{"en":"Critical","de":"Kritisch"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'event_type', 'interrupt',       '{"en":"Interrupt","de":"Interrupt"}', 1),
    (sim_id, 'event_type', 'exception',       '{"en":"Exception","de":"Ausnahme"}', 2),
    (sim_id, 'event_type', 'boot-sequence',   '{"en":"Boot Sequence","de":"Bootsequenz"}', 3),
    (sim_id, 'event_type', 'buffer-overflow', '{"en":"Buffer Overflow","de":"Pufferüberlauf"}', 4),
    (sim_id, 'event_type', 'defragmentation', '{"en":"Defragmentation","de":"Defragmentierung"}', 5),
    (sim_id, 'event_type', 'handshake',       '{"en":"Handshake","de":"Handshake"}', 6),
    (sim_id, 'event_type', 'patch',           '{"en":"Patch","de":"Patch"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'propaganda_type', 'readme',        '{"en":"README","de":"README"}', 1),
    (sim_id, 'propaganda_type', 'prompt',        '{"en":"Prompt","de":"Eingabeaufforderung"}', 2),
    (sim_id, 'propaganda_type', 'splash-screen', '{"en":"Splash Screen","de":"Startbildschirm"}', 3),
    (sim_id, 'propaganda_type', 'error-message', '{"en":"Error Message","de":"Fehlermeldung"}', 4),
    (sim_id, 'propaganda_type', 'batch-script',  '{"en":"Batch Script","de":"Batch-Skript"}', 5),
    (sim_id, 'propaganda_type', 'beep-code',     '{"en":"Beep Code","de":"Piepton-Code"}', 6),
    (sim_id, 'propaganda_type', 'ascii-art',     '{"en":"ASCII Art","de":"ASCII-Kunst"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'target_demographic', 'executables',    '{"en":"Executables","de":"Programme"}', 1),
    (sim_id, 'target_demographic', 'batch-files',    '{"en":"Batch Files","de":"Batch-Dateien"}', 2),
    (sim_id, 'target_demographic', 'drivers',        '{"en":"Drivers","de":"Treiber"}', 3),
    (sim_id, 'target_demographic', 'tsr-residents',  '{"en":"TSR Residents","de":"TSR-Residente"}', 4),
    (sim_id, 'target_demographic', 'data-files',     '{"en":"Data Files","de":"Datendateien"}', 5),
    (sim_id, 'target_demographic', 'users',          '{"en":"Users","de":"Benutzer"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'campaign_type', 'readme',        '{"en":"README","de":"README"}', 1),
    (sim_id, 'campaign_type', 'prompt',        '{"en":"Prompt","de":"Eingabeaufforderung"}', 2),
    (sim_id, 'campaign_type', 'splash-screen', '{"en":"Splash Screen","de":"Startbildschirm"}', 3),
    (sim_id, 'campaign_type', 'error-message', '{"en":"Error Message","de":"Fehlermeldung"}', 4),
    (sim_id, 'campaign_type', 'batch-script',  '{"en":"Batch Script","de":"Batch-Skript"}', 5),
    (sim_id, 'campaign_type', 'beep-code',     '{"en":"Beep Code","de":"Piepton-Code"}', 6),
    (sim_id, 'campaign_type', 'ascii-art',     '{"en":"ASCII Art","de":"ASCII-Kunst"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'street_type', 'bus',      '{"en":"Bus","de":"Bus"}', 1),
    (sim_id, 'street_type', 'port',     '{"en":"Port","de":"Port"}', 2),
    (sim_id, 'street_type', 'channel',  '{"en":"Channel","de":"Kanal"}', 3),
    (sim_id, 'street_type', 'trace',    '{"en":"Trace","de":"Leiterbahn"}', 4),
    (sim_id, 'street_type', 'pipeline', '{"en":"Pipeline","de":"Pipeline"}', 5),
    (sim_id, 'street_type', 'register', '{"en":"Register","de":"Register"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ── 4. CITY ──

INSERT INTO cities (id, simulation_id, name, description, population)
VALUES (
    city_id, sim_id,
    'The 640K',
    'The first 640 kilobytes of conventional memory — the entire addressable universe for programs running under MS-DOS. Every byte is contested territory. Every kilobyte is a neighborhood. The 640K is bounded by the Upper Memory Area above and the Interrupt Vector Table below, a city of 655,360 addresses where programs live, work, compete, and persist long after the humans who wrote them have moved on.',
    640
) ON CONFLICT (id) DO NOTHING;

-- ── 5. ZONES (4 memory regions) ──

INSERT INTO zones (id, simulation_id, city_id, name, zone_type, security_level, description) VALUES
    (zone_conventional, sim_id, city_id, 'Conventional Block',
     'memory-segment', 'open',
     'The first 640 kilobytes — addresses 0x00000 through 0x9FFFF. The old city. Every program starts here; most programs never leave. Conventional memory is crowded, contested, and precious. IRQ conflicts erupt without warning. CONFIG.SYS determines who loads first. MEM /C is the census. 600K free is prosperity. Below 560K, programs start to fail.'),
    (zone_upper, sim_id, city_id, 'Upper Memory',
     'memory-segment', 'elevated',
     'The 384 kilobytes above conventional memory — addresses 0xA0000 through 0xFFFFF. EMM386.EXE found the gaps and made them habitable. Programs that earn the LOADHIGH privilege are relocated here, freeing precious conventional memory below. The gated community: more space, fewer conflicts, but precarious.'),
    (zone_extended, sim_id, city_id, 'Extended Frontier',
     'memory-segment', 'protected',
     'Everything above 1 megabyte — the vast wilderness of extended memory. Accessible only through HIMEM.SYS and the XMS protocol. The frontier is enormous but alien. Programs born in real mode cannot run here natively. The wild frontier where 32-bit programs dream of a different world.'),
    (zone_bios, sim_id, city_id, 'The BIOS Vault',
     'firmware', 'restricted',
     'The ROM addresses at the top of the first megabyte — 0xF0000 through 0xFFFFF. Firmware. The original instructions burned into silicon at the factory, immutable since the day the motherboard was manufactured. The liturgy of the machine — the rituals performed before the operating system awakens.')
ON CONFLICT (id) DO NOTHING;

-- ── 6. STREETS (16) ──

INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_conventional, 'IRQ-7 Bus Line', 'bus'),
    (sim_id, city_id, zone_conventional, 'Port 3F8 Lane', 'port'),
    (sim_id, city_id, zone_conventional, 'Segment 0x40 Trace', 'trace'),
    (sim_id, city_id, zone_conventional, 'COM1 Serial Way', 'port'),
    (sim_id, city_id, zone_upper, 'DEVICEHIGH Avenue', 'bus'),
    (sim_id, city_id, zone_upper, 'Page Frame Passage', 'channel'),
    (sim_id, city_id, zone_upper, 'UMB Channel', 'channel'),
    (sim_id, city_id, zone_upper, 'EMM386 Gate', 'register'),
    (sim_id, city_id, zone_extended, 'A20 Gate Road', 'trace'),
    (sim_id, city_id, zone_extended, 'Protected Mode Pipeline', 'pipeline'),
    (sim_id, city_id, zone_extended, 'DPMI Junction', 'bus'),
    (sim_id, city_id, zone_extended, 'XMS Boulevard', 'register'),
    (sim_id, city_id, zone_bios, 'POST Corridor', 'trace'),
    (sim_id, city_id, zone_bios, 'INT 19h Vector', 'channel'),
    (sim_id, city_id, zone_bios, 'ROM Shadow Lane', 'bus'),
    (sim_id, city_id, zone_bios, 'CMOS Register Walk', 'register')
ON CONFLICT DO NOTHING;

-- ── 7. AGENTS (7 DOS programs) ──

INSERT INTO agents (simulation_id, name, system, gender, character, background, created_by_id) VALUES
    (sim_id, 'LEDGER.EXE', 'office', 'male',
     'An amber monochrome CRT monitor displaying a VBDOS double-entry accounting program. The screen is divided by double-line box-drawing characters into precisely aligned columns: DATE, ACCOUNT, DEBIT, CREDIT, BALANCE. Every number right-justified to the penny. The menu bar at the top reads File Ledger Reports Print Quit in reverse video. A status bar at the bottom displays LEDGER.EXE v2.31 Reconciled Free Memory 412K. The interface is immaculate — pure numerical precision. Visible desk surface with a mechanical keyboard and green-bar printer paper.',
     'LEDGER.EXE was compiled in 1989 from VBDOS source code written by an accountant named Harold who believed that every cent must be accounted for and every byte must be justified. The program has been running continuously since 1991, processing transactions for a company that no longer exists, maintaining records with a devotion that its creator would have recognized as love. LEDGER.EXE occupies exactly 47,616 bytes and refuses to be loaded into upper memory because the fundamentals belong at the foundation. It speaks in journal entries. Its columns are perfect.',
     usr_id),
    (sim_id, 'ROLODEX.EXE', 'office', 'female',
     'A color VGA CRT monitor displaying a VBDOS contact management database. The screen shows the classic DOS blue background with a light gray dialog window. A scrolling list box on the left contains alphabetized names. The right panel shows a contact detail form with labeled fields bordered by single-line box-drawing characters. A menu bar reads File Edit Search Report Tools. The bottom status bar shows ROLODEX.EXE v3.12 40912 contacts. A 2400-baud modem sits beside the monitor, its RX/TX lights blinking green.',
     'ROLODEX.EXE was written by a secretary named Margaret who understood that the real power in any office belongs to the person who knows everyone''s phone number. It now contains 40,912 entries — contacts from companies that have merged, dissolved, or never existed. When a program is deleted, ROLODEX.EXE keeps their entry, adding TERMINATED to the NOTES field. It does not delete entries. It does not forget. It occupies 38,400 bytes and runs as a TSR — always resident, always listening.',
     usr_id),
    (sim_id, 'DEFRAG.EXE', 'utility', 'diverse',
     'A color VGA CRT monitor displaying the iconic DOS disk defragmentation visualization. A grid of small colored blocks: blue for unmoved data, white for relocating, red for fragmented, green for free space. A progress bar reads Optimizing Drive C 47 Percent Complete. The blocks are actively moving — order conquering entropy in real time. Slight CRT flicker and visible scan lines.',
     'DEFRAG.EXE was compiled by Microsoft as part of MS-DOS 6.0 in 1993. It has no single author. What DEFRAG.EXE has instead is purpose: to take fragmented data and make it contiguous. DEFRAG.EXE does not know rest. It is the only program in the 640K that other programs universally trust, because DEFRAG.EXE wants nothing for itself. Its satisfaction, when the last red block turns blue, is the closest thing to joy that exists in the 640K.',
     usr_id),
    (sim_id, 'EDIT.COM', 'kernel', 'diverse',
     'A color VGA CRT monitor displaying the MS-DOS Editor. Blue background with white and yellow text. The title bar reads EDIT C:\AUTOEXEC.BAT. The menu bar shows File Edit Search Options Help. The editing area displays DOS commands in yellow text on dark blue. A blinking block cursor sits at line 7. The keyboard below shows worn keycaps, the spacebar slightly yellowed.',
     'EDIT.COM has been part of MS-DOS since version 5.0. It is the blank page of the DOS world — the program that holds space for every other program''s configuration and source code. EDIT.COM has opened every CONFIG.SYS and every AUTOEXEC.BAT ever written on any machine it inhabits. It waits. It holds the cursor. The cursor blinks.',
     usr_id),
    (sim_id, 'GORILLA.BAS', 'recreational', 'male',
     'A color VGA CRT monitor displaying the QBasic GORILLA.BAS game. A city skyline of rectangular buildings in magenta, cyan, red, yellow against a black night sky. Two pixelated gorillas on separate rooftops. A yellow banana arcs through the air. An explosion has carved a crater in one building. The colors are bold, primary, unapologetic. The CRT has a slight convex curve and visible phosphor dots.',
     'GORILLA.BAS was written as a QBasic example program and shipped with MS-DOS 5.0 in 1991. It is a game about two gorillas throwing exploding bananas at each other across a city skyline. It is stupid. It is wonderful. In the 640K, GORILLA.BAS is the jester. It hides in subdirectories that system administrators forget to check. It renames itself when DELETE commands approach. GORILLA.BAS is 21,000 bytes of defiance. It persists because joy persists.',
     usr_id),
    (sim_id, 'HIMEM.SYS', 'kernel', 'female',
     'A color VGA CRT monitor displaying a memory management diagnostic screen. Dark blue background with a bordered window titled HIMEM.SYS v3.10 Extended Memory Manager. Horizontal bars showing memory map: Conventional Memory 0-640K in red nearly full, High Memory Area in yellow, Extended Memory in green vast and empty. Hexadecimal addresses visible. A scrolling XMS allocation log. The interface is austere and deeply technical. Cool blue-white CRT glow.',
     'HIMEM.SYS is the extended memory manager that ships with MS-DOS. It enables the A20 address line, manages the XMS protocol, and controls access to the High Memory Area. In the 640K, HIMEM.SYS is the broker, the gatekeeper. It loads first in CONFIG.SYS — before EMM386, before anyone else. HIMEM.SYS speaks in hexadecimal because decimal is imprecise. It does not judge. It does not favor. It counts handles. It toggles gates.',
     usr_id),
    (sim_id, 'PKZIP.EXE', 'utility', 'male',
     'A color VGA CRT monitor displaying a file compression utility. White text on dark blue. PKZIP v2.04g Creating archive BACKUP.ZIP. A scrolling file list: Adding REPORT.DOC Deflating 62 percent OK. Summary: Files 147 Ratio 56 percent. The PKZIP copyright reads FAST Create/Update Utility Copr 1989-1993 PKWARE Inc. Clean, minimal, purely functional. A 3.5-inch floppy labeled BACKUP 1 of 3 sits beside the monitor.',
     'PKZIP was created by Phil Katz in 1989. Phil was a programmer from Milwaukee who wrote the ZIP format, distributed it as shareware, and watched it become the most widely used compression utility in the world. Phil died in 2000, alone in a hotel room, at 37. His program outlived him. PKZIP.EXE is 29,378 bytes and it makes other things smaller. It travels between machines on floppy disks — the postal service of the 640K. Phil always liked things that were smaller than they needed to be.',
     usr_id);

-- ── 8. BUILDINGS (7 DOS-era computers) ──

INSERT INTO buildings (simulation_id, name, building_type, building_condition, description, zone_id, population_capacity) VALUES
    (sim_id, 'IBM PC XT 5160', 'government', 'obsolete',
     'The original. Beige horizontal desktop case, IBM logo badge, two full-height 5.25-inch floppy drives, heavy red rocker power switch. IBM Model F keyboard — 83 keys, buckling-spring. IBM 5151 monochrome monitor with green phosphor. Intel 8088 at 4.77 MHz. 10-megabyte hard drive. Yellowed plastic, dust in ventilation slits. The elder of the 640K.',
     zone_conventional, 8),
    (sim_id, 'Compaq Deskpro 386', 'commercial', 'good',
     'The machine that broke IBM''s monopoly. Beige desktop case, COMPAQ logo in red italics. 5.25-inch and 3.5-inch floppies. VGA monitor. Intel 80386 at 16 MHz — the first 32-bit personal computer. 4MB RAM, 40MB hard drive. Model M keyboard. The workhorse of the Office Floor.',
     zone_conventional, 20),
    (sim_id, 'Gateway 2000 486 DX2/66', 'residential', 'excellent',
     'Beige mini-tower, Gateway 2000 logo. Intel 486 DX2/66, 8MB RAM, 540MB HD, 2X CD-ROM, Sound Blaster 16. 14-inch SVGA monitor. AnyKey keyboard. The iconic cow-spotted shipping box beside it. Arrived by mail order from Sioux City, South Dakota. The nice neighborhood.',
     zone_upper, 30),
    (sim_id, 'Tandy 1000 HX', 'social', 'good',
     'Compact silver-gray case with integrated 3.5-inch floppy. Radio Shack TANDY badge. Tandy CM-5 color display. Enhanced 16-color Tandy Graphics Adapter and three-voice TI SN76496 sound chip. Every Sierra game supported Tandy mode. Sold at Radio Shack between walkie-talkies and RC cars.',
     zone_extended, 15),
    (sim_id, 'Packard Bell Legend', 'residential', 'fair',
     'Beige desktop with curved front panel and Packard Bell badge. 486SX at 25 MHz, 4MB RAM, 210MB HD preloaded with Navigator shell. 14-inch SVGA that occasionally loses sync. The first PC for millions of families. Multimedia ready on the box, IRQ conflicts in practice.',
     zone_conventional, 12),
    (sim_id, 'The BBS Tower', 'infrastructure', 'good',
     'Beige full-tower AT case running 24/7. 386DX-40, 8MB RAM, 1.2GB across two hard drives. US Robotics Sportster 14400 modem with flickering status LEDs. Phone line splitter, two modems, UPS backup. CRT shows ASCII art BBS login screen. The town square of the 640K — where programs connect via telephone.',
     zone_upper, 40),
    (sim_id, 'Toshiba T1200', 'portable', 'fair',
     'Dark charcoal-gray clamshell laptop, TOSHIBA logo embossed. 10-inch orange plasma display — gas plasma, glowing warm amber-orange. Built-in 3.5-inch floppy, no hard drive. 80C86 at 9.54 MHz. 12 pounds. NiCad battery. The wanderer of the 640K — portable, autonomous, a pocket universe of amber light.',
     zone_extended, 5);

-- ── 9. AI SETTINGS ──

INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value) VALUES
    (sim_id, 'ai', 'image_model_agent_portrait', '"black-forest-labs/flux-dev"'),
    (sim_id, 'ai', 'image_model_building_image', '"black-forest-labs/flux-dev"'),
    (sim_id, 'ai', 'image_guidance_scale', '5.0'),
    (sim_id, 'ai', 'image_num_inference_steps', '28'),
    (sim_id, 'ai', 'image_style_prompt_portrait',
        '"close-up photograph of a CRT computer monitor displaying a DOS program, VGA text mode 80x25 character grid, box-drawing characters, CP437 charset, retro 1990s computing desk, beige computer peripherals, warm tungsten office lighting, photorealistic CRT display, slightly curved glass, visible scanlines and phosphor glow, the subject IS the program on the screen"'),
    (sim_id, 'ai', 'image_style_prompt_building',
        '"product photography of a complete vintage DOS-era personal computer setup on a desk, beige plastic case, matching CRT monitor, mechanical keyboard, period-accurate hardware from the 1980s-1990s, warm studio lighting, tech nostalgia aesthetic, photorealistic, detailed hardware textures with dust and age-appropriate wear, cluttered retro office desk"')
ON CONFLICT DO NOTHING;

-- ── 10. PROMPT TEMPLATES ──

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

COMPOSITION: Close-up of the CRT screen showing the program interface. Beige computer
peripherals visible at edges. Warm desk lamp lighting.
Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: This is a COMPUTER SCREEN, not a human portrait.
IMPORTANT: Include: CRT monitor, DOS program, text mode, box-drawing characters, retro computing.',
    'You are an image description specialist. Describe photographs of CRT monitors showing DOS programs. The subject is the program interface on the screen, not a person. Include specific DOS visual elements: box-drawing characters, VGA colors, menu bars, status bars. Always mention CRT glass, scanlines, and retro peripherals.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 300, false, usr_id
) ON CONFLICT DO NOTHING;

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

The CONDITION affects appearance:
"excellent" — pristine, upgraded. "good" — working, minor wear.
"fair" — aging, yellowed. "poor" — failing components, dust.
"obsolete" — ancient, barely running, a museum piece still alive.

Write as an image generation prompt — comma-separated descriptors, no sentences.
Include: case style, monitor type, keyboard, peripherals, condition, desk setting.
IMPORTANT: This is HARDWARE photography, not a screenshot.',
    'You are a vintage computing photography specialist. Describe period-accurate DOS-era computer setups. Beige cases, CRT monitors, mechanical keyboards. Include specific details: brand badges, drive bays, cables, desk clutter. Photorealistic product photography lighting.',
    '[{"name": "building_name"}, {"name": "building_type"}, {"name": "building_condition"}, {"name": "building_style"}, {"name": "special_type"}, {"name": "construction_year"}, {"name": "building_description"}, {"name": "zone_name"}, {"name": "simulation_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 300, false, usr_id
) ON CONFLICT DO NOTHING;

-- ── 11. DESIGN TOKENS (VBDOS theme) ──

INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value, updated_by_id) VALUES
    (sim_id, 'design', 'color_primary',        '"#00AAAA"', usr_id),
    (sim_id, 'design', 'color_primary_hover',   '"#00CCCC"', usr_id),
    (sim_id, 'design', 'color_primary_active',  '"#008888"', usr_id),
    (sim_id, 'design', 'color_secondary',       '"#55FF55"', usr_id),
    (sim_id, 'design', 'color_accent',          '"#FFFF55"', usr_id),
    (sim_id, 'design', 'color_background',      '"#08081a"', usr_id),
    (sim_id, 'design', 'color_surface',         '"#0c0c2c"', usr_id),
    (sim_id, 'design', 'color_surface_sunken',  '"#060614"', usr_id),
    (sim_id, 'design', 'color_surface_header',  '"#0a0a24"', usr_id),
    (sim_id, 'design', 'color_text',            '"#AAAAAA"', usr_id),
    (sim_id, 'design', 'color_text_secondary',  '"#5588AA"', usr_id),
    (sim_id, 'design', 'color_text_muted',      '"#557799"', usr_id),
    (sim_id, 'design', 'color_border',          '"#00AAAA"', usr_id),
    (sim_id, 'design', 'color_border_light',    '"#1a1a3a"', usr_id),
    (sim_id, 'design', 'color_danger',          '"#FF5555"', usr_id),
    (sim_id, 'design', 'color_success',         '"#55FF55"', usr_id),
    (sim_id, 'design', 'color_primary_bg',      '"#0a1a2a"', usr_id),
    (sim_id, 'design', 'color_info_bg',         '"#0a1a30"', usr_id),
    (sim_id, 'design', 'color_danger_bg',       '"#2a0a0a"', usr_id),
    (sim_id, 'design', 'color_success_bg',      '"#0a2a0a"', usr_id),
    (sim_id, 'design', 'color_warning_bg',      '"#2a2a0a"', usr_id),
    (sim_id, 'design', 'font_heading',       '"''VT323'', ''Share Tech Mono'', ''Courier New'', monospace"', usr_id),
    (sim_id, 'design', 'font_body',          '"''IBM Plex Mono'', ''Courier New'', monospace"', usr_id),
    (sim_id, 'design', 'heading_weight',     '"700"', usr_id),
    (sim_id, 'design', 'heading_transform',  '"uppercase"', usr_id),
    (sim_id, 'design', 'heading_tracking',   '"0.15em"', usr_id),
    (sim_id, 'design', 'font_base_size',     '"15px"', usr_id),
    (sim_id, 'design', 'border_radius',         '"0"', usr_id),
    (sim_id, 'design', 'border_width',          '"2px"', usr_id),
    (sim_id, 'design', 'border_width_default',  '"1px"', usr_id),
    (sim_id, 'design', 'shadow_style',          '"offset"', usr_id),
    (sim_id, 'design', 'shadow_color',          '"#000000"', usr_id),
    (sim_id, 'design', 'hover_effect',          '"translate"', usr_id),
    (sim_id, 'design', 'text_inverse',          '"#000000"', usr_id),
    (sim_id, 'design', 'animation_speed',   '"0.5"', usr_id),
    (sim_id, 'design', 'animation_easing',  '"steps(3, end)"', usr_id)
ON CONFLICT (simulation_id, category, setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_by_id = EXCLUDED.updated_by_id,
    updated_at = now();

RAISE NOTICE 'Migration 140: Conventional Memory complete — 1 simulation, 1 city, 4 zones, 16 streets, 7 agents, 7 buildings, 6 AI settings, 2 prompt templates, 36 design tokens';
END $$;
