-- =============================================================================
-- SEED 017: Cité des Dames — Feminist Literary Utopia
-- =============================================================================
-- An allegorical city built from the stories of remarkable women, rooted in
-- Christine de Pizan's *The Book of the City of Ladies* (1405). Six historical
-- women, fictionalized, inhabit a timeless space where medieval, Enlightenment,
-- Regency, and Victorian eras coexist.
--
-- The platform's first light-themed simulation. Illuminated manuscripts + Regency
-- elegance + Pre-Raphaelite jewel tones + suffragette purple.
--
-- Creates: simulation, membership, taxonomies, city, 4 zones, 16 streets,
--          6 agents, 7 buildings, AI settings (Flux Dev), prompt templates.
--
-- Depends on: seed 001 (test user must exist)
-- =============================================================================

BEGIN;

DO $$
DECLARE
    sim_id  uuid := '50000000-0000-0000-0000-000000000001';
    usr_id  uuid := '00000000-0000-0000-0000-000000000001';
    city_id uuid := 'c0000006-0000-4000-a000-000000000001';
    zone_reason     uuid := 'a0000010-0000-0000-0000-000000000001';
    zone_rectitude  uuid := 'a0000011-0000-0000-0000-000000000001';
    zone_justice    uuid := 'a0000012-0000-0000-0000-000000000001';
    zone_field      uuid := 'a0000013-0000-0000-0000-000000000001';
BEGIN

-- ============================================================================
-- 1. SIMULATION
-- ============================================================================

INSERT INTO simulations (id, name, slug, description, theme, status, content_locale, owner_id)
VALUES (
    sim_id,
    'Cité des Dames',
    'cite-des-dames',
    'A city built from the stories of remarkable women, founded on Christine de Pizan''s allegory of 1405. Six historical women — Christine, Wollstonecraft, Hildegard, Sor Juana, Ada Lovelace, Sojourner Truth — inhabit a timeless space where medieval scriptoria and Regency salons and Victorian observatories coexist. The philosophical question: What if women had always been heard?',
    'utopian',
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
    (sim_id, 'gender', 'female',  '{"en":"Female","de":"Weiblich"}', 1),
    (sim_id, 'gender', 'male',    '{"en":"Male","de":"Männlich"}', 2),
    (sim_id, 'gender', 'diverse', '{"en":"Diverse","de":"Divers"}', 3)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Profession ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'profession', 'architect',    '{"en":"Architect","de":"Architektin"}', 1),
    (sim_id, 'profession', 'philosopher',  '{"en":"Philosopher","de":"Philosophin"}', 2),
    (sim_id, 'profession', 'visionary',    '{"en":"Visionary","de":"Visionärin"}', 3),
    (sim_id, 'profession', 'scholar',      '{"en":"Scholar","de":"Gelehrte"}', 4),
    (sim_id, 'profession', 'calculator',   '{"en":"Calculator","de":"Rechnerin"}', 5),
    (sim_id, 'profession', 'orator',       '{"en":"Orator","de":"Rednerin"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- System (Organisations / Orders) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'system', 'ordre-de-raison',     '{"en":"Ordre de Raison","de":"Orden der Vernunft"}', 1),
    (sim_id, 'system', 'salon-des-lettres',    '{"en":"Salon des Lettres","de":"Salon der Literatur"}', 2),
    (sim_id, 'system', 'ordre-de-rectitude',   '{"en":"Ordre de Rectitude","de":"Orden der Rechtschaffenheit"}', 3),
    (sim_id, 'system', 'ordre-de-justice',     '{"en":"Ordre de Justice","de":"Orden der Gerechtigkeit"}', 4),
    (sim_id, 'system', 'observatoire',         '{"en":"Observatoire","de":"Observatorium"}', 5)
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
    (sim_id, 'building_condition', 'excellent',    '{"en":"Excellent","de":"Ausgezeichnet"}', 1),
    (sim_id, 'building_condition', 'good',         '{"en":"Good","de":"Gut"}', 2),
    (sim_id, 'building_condition', 'fair',         '{"en":"Fair","de":"Befriedigend"}', 3),
    (sim_id, 'building_condition', 'restored',     '{"en":"Restored","de":"Restauriert"}', 4),
    (sim_id, 'building_condition', 'illuminated',  '{"en":"Illuminated","de":"Illuminiert"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Zone Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'zone_type', 'quarter',   '{"en":"Quarter","de":"Viertel"}', 1),
    (sim_id, 'zone_type', 'field',     '{"en":"Field","de":"Feld"}', 2),
    (sim_id, 'zone_type', 'terrace',   '{"en":"Terrace","de":"Terrasse"}', 3),
    (sim_id, 'zone_type', 'cloister',  '{"en":"Cloister","de":"Kreuzgang"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Security Level ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'security_level', 'open',    '{"en":"Open","de":"Offen"}', 1),
    (sim_id, 'security_level', 'guarded', '{"en":"Guarded","de":"Bewacht"}', 2),
    (sim_id, 'security_level', 'warded',  '{"en":"Warded","de":"Geschützt"}', 3),
    (sim_id, 'security_level', 'sealed',  '{"en":"Sealed","de":"Versiegelt"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Urgency Level ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'urgency_level', 'low',      '{"en":"Low","de":"Niedrig"}', 1),
    (sim_id, 'urgency_level', 'medium',   '{"en":"Medium","de":"Mittel"}', 2),
    (sim_id, 'urgency_level', 'high',     '{"en":"High","de":"Hoch"}', 3),
    (sim_id, 'urgency_level', 'critical', '{"en":"Critical","de":"Kritisch"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Event Type (literary / academic themed) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'event_type', 'lecture',       '{"en":"Lecture","de":"Vorlesung"}', 1),
    (sim_id, 'event_type', 'salon',         '{"en":"Salon","de":"Salon"}', 2),
    (sim_id, 'event_type', 'disputation',   '{"en":"Disputation","de":"Disputation"}', 3),
    (sim_id, 'event_type', 'declaration',   '{"en":"Declaration","de":"Deklaration"}', 4),
    (sim_id, 'event_type', 'illumination',  '{"en":"Illumination","de":"Illumination"}', 5),
    (sim_id, 'event_type', 'concert',       '{"en":"Concert","de":"Konzert"}', 6),
    (sim_id, 'event_type', 'procession',    '{"en":"Procession","de":"Prozession"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Propaganda Type (literary communications) ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'propaganda_type', 'pamphlet',       '{"en":"Pamphlet","de":"Pamphlet"}', 1),
    (sim_id, 'propaganda_type', 'broadsheet',     '{"en":"Broadsheet","de":"Flugblatt"}', 2),
    (sim_id, 'propaganda_type', 'oration',        '{"en":"Oration","de":"Rede"}', 3),
    (sim_id, 'propaganda_type', 'petition',       '{"en":"Petition","de":"Petition"}', 4),
    (sim_id, 'propaganda_type', 'illumination',   '{"en":"Illumination","de":"Illumination"}', 5),
    (sim_id, 'propaganda_type', 'verse',          '{"en":"Verse","de":"Vers"}', 6),
    (sim_id, 'propaganda_type', 'epistle',        '{"en":"Epistle","de":"Epistel"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Target Demographic ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'target_demographic', 'scholars',       '{"en":"Scholars","de":"Gelehrte"}', 1),
    (sim_id, 'target_demographic', 'artisans',       '{"en":"Artisans","de":"Handwerkerinnen"}', 2),
    (sim_id, 'target_demographic', 'citizens',       '{"en":"Citizens","de":"Bürgerinnen"}', 3),
    (sim_id, 'target_demographic', 'visitors',       '{"en":"Visitors","de":"Besucherinnen"}', 4),
    (sim_id, 'target_demographic', 'the-undecided',  '{"en":"The Undecided","de":"Die Unentschlossenen"}', 5),
    (sim_id, 'target_demographic', 'the-silenced',   '{"en":"The Silenced","de":"Die Verstummten"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Campaign Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'campaign_type', 'pamphlet',       '{"en":"Pamphlet","de":"Pamphlet"}', 1),
    (sim_id, 'campaign_type', 'broadsheet',     '{"en":"Broadsheet","de":"Flugblatt"}', 2),
    (sim_id, 'campaign_type', 'oration',        '{"en":"Oration","de":"Rede"}', 3),
    (sim_id, 'campaign_type', 'petition',       '{"en":"Petition","de":"Petition"}', 4),
    (sim_id, 'campaign_type', 'illumination',   '{"en":"Illumination","de":"Illumination"}', 5),
    (sim_id, 'campaign_type', 'verse',          '{"en":"Verse","de":"Vers"}', 6),
    (sim_id, 'campaign_type', 'epistle',        '{"en":"Epistle","de":"Epistel"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ---- Street Type ----
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'street_type', 'promenade', '{"en":"Promenade","de":"Promenade"}', 1),
    (sim_id, 'street_type', 'arcade',    '{"en":"Arcade","de":"Arkade"}', 2),
    (sim_id, 'street_type', 'lane',      '{"en":"Lane","de":"Gasse"}', 3),
    (sim_id, 'street_type', 'gallery',   '{"en":"Gallery","de":"Galerie"}', 4),
    (sim_id, 'street_type', 'passage',   '{"en":"Passage","de":"Passage"}', 5),
    (sim_id, 'street_type', 'bridge',    '{"en":"Bridge","de":"Brücke"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ============================================================================
-- 4. CITY
-- ============================================================================

INSERT INTO cities (id, simulation_id, name, description, population)
VALUES (
    city_id, sim_id,
    'Cité des Dames',
    'A city that has always existed, in the sense that it was always possible. Built from honey-coloured Georgian stone with Queen Anne red brick, Pre-Raphaelite stained glass, art nouveau ironwork, and climbing roses. Multiple historical eras coexist — medieval scriptoria and Regency salons and Victorian observatories and Enlightenment lecture halls, all occupying the same geography in a layered simultaneity. Population: every woman who was ever silenced and every story that was ever told to unsilence her.',
    6000
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. ZONES (4 quarters from Christine's allegory)
-- ============================================================================

INSERT INTO zones (id, simulation_id, city_id, name, zone_type, security_level, description) VALUES
    (zone_reason, sim_id, city_id, 'Quarter of Reason',
     'quarter', 'open',
     'Lady Reason built the foundations. This is where ideas are tested — not by authority but by conversation. The Quarter houses the Salon of Reason (a great drawing room with Elizabeth Montagu''s Bluestocking legacy), the College of Letters (amber stone, oriel windows, Pre-Raphaelite glass), and the Observatory of the Blazing World (Ada Lovelace''s domain of telescopes and analytical engines). Sunlight enters through windows of medieval stained glass, casting jewel-coloured shadows across reading desks. The air smells of old paper, candlewax, and the faint metallic tang of precision instruments. Stone arches frame views of climbing roses. Conversation is constant — not raised voices, but the measured exchange of women who have learned that the most powerful thing in the world is a well-constructed argument.'),
    (zone_rectitude, sim_id, city_id, 'Quarter of Rectitude',
     'quarter', 'guarded',
     'Lady Rectitude built the streets. The civic heart of the Cité — governance by declaration rather than decree. The Hall of Declarations dominates: a semicircular chamber modelled after the Seneca Falls Convention hall, where the Declaration of Sentiments is carved into limestone. Sojourner Truth presides here with the authority of lived experience. Archives line the corridors: every petition ever submitted, every treaty ever signed, every law ever argued. The architecture is Georgian symmetry softened by Pre-Raphaelite detail — ironwork gates with vine patterns, mosaic floors depicting scenes of justice, and gas lamps that cast warm amber light. Order here is not imposed; it is negotiated, documented, and kept.'),
    (zone_justice, sim_id, city_id, 'Quarter of Justice',
     'quarter', 'warded',
     'Lady Justice added the roofs and gates. The spiritual and artistic heart of the Cité. The Scriptorium occupies the central cloister: Hildegard''s manuscript workshop where ink and gold leaf become memory. The Gate of Justice stands at the quarter''s edge — the only formal entrance to the Cité, with its inscription: "Nulle n''entre ici qui ne puisse nommer une femme oubliée." Stained glass windows by Evelyn De Morgan line the cloister walk, depicting not saints but scholars, not martyrs but mathematicians. The stone here is older than the rest of the city — or appears to be. Time layers in this quarter: medieval arches support Regency railings which frame Victorian gaslight.'),
    (zone_field, sim_id, city_id, 'The Field of Letters',
     'field', 'open',
     'The fertile plain where the city grows. Outside the walls but within the Cité''s influence: public gardens inspired by Mary Delany''s botanical art, a market where books and ideas are the primary currency, communal kitchens, gathering spaces, and the Garden of Remembered Names where every plant commemorates a woman erased from history. The Ladies of Llangollen''s domestic partnership (1780-1829) inspires the residential architecture: cottages covered in climbing plants, built for companionship rather than display. Children play in the garden paths. The air smells of lavender, ink, and fresh bread. This is where the Cité lives — not in its grand buildings but in the daily act of existing as though equality were already real.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. STREETS (16 — 4 per zone)
-- ============================================================================

-- Quarter of Reason
INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_reason, 'Salon Promenade', 'promenade'),
    (sim_id, city_id, zone_reason, 'Montagu Arcade', 'arcade'),
    (sim_id, city_id, zone_reason, 'Bluestocking Lane', 'lane'),
    (sim_id, city_id, zone_reason, 'Lecture Gallery', 'gallery')
ON CONFLICT DO NOTHING;

-- Quarter of Rectitude
INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_rectitude, 'Declaration Way', 'promenade'),
    (sim_id, city_id, zone_rectitude, 'Senate Passage', 'passage'),
    (sim_id, city_id, zone_rectitude, 'Treaty Bridge', 'bridge'),
    (sim_id, city_id, zone_rectitude, 'Petition Alley', 'lane')
ON CONFLICT DO NOTHING;

-- Quarter of Justice
INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_justice, 'Illumination Walk', 'promenade'),
    (sim_id, city_id, zone_justice, 'Cloister Passage', 'passage'),
    (sim_id, city_id, zone_justice, 'Virtue Lane', 'lane'),
    (sim_id, city_id, zone_justice, 'Anthem Bridge', 'bridge')
ON CONFLICT DO NOTHING;

-- The Field of Letters
INSERT INTO city_streets (simulation_id, city_id, zone_id, name, street_type) VALUES
    (sim_id, city_id, zone_field, 'Garden Promenade', 'promenade'),
    (sim_id, city_id, zone_field, 'Market Row', 'arcade'),
    (sim_id, city_id, zone_field, 'Foundation Way', 'lane'),
    (sim_id, city_id, zone_field, 'Chronicle Alley', 'lane')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. AGENTS (6 historical women, fictionalized)
-- ============================================================================

INSERT INTO agents (simulation_id, name, system, gender, character, background, created_by_id) VALUES
    (sim_id, 'Christine de Pizan', 'ordre-de-raison', 'female',
     'A woman in her early forties with steady dark eyes and the careful posture of someone who has spent decades at a writing desk. Olive-skinned, fine-boned, with ink stains on her right hand that she has stopped trying to remove. Wears a deep green medieval gown with gold embroidery at the collar — practical rather than ostentatious, the clothing of a woman who earns her own living. Her dark hair is covered by a white coif and a simple gold circlet. She carries a quill behind her ear when she forgets it is there, which is often. Her expression is one of concentrated attention — she listens to you the way she reads a text, looking for what is actually being said beneath the words that are being used.',
     'Born in Venice in 1364, raised at the court of Charles V of France where her father served as court astrologer. Married at fifteen to Étienne du Castel — a rare love match that produced three children. Widowed at twenty-five when Étienne died in an epidemic, she found herself with three children, a mother, and a niece to support, and no income. The courts took a decade to settle her husband''s estate, during which Christine turned to writing — first poetry, then prose, then philosophy. She became the first professional female author in Europe, not by choice but by necessity, and then by conviction. Her masterwork, *Le Livre de la Cité des Dames* (1405), is an allegorical city built from the stories of remarkable women throughout history, brick by biographical brick. In the Cité, she is both founder and chronicler — the architect who built the city and the historian who remembers why it was built. She does not raise her voice. She does not need to. The city speaks for her.',
     usr_id),
    (sim_id, 'Mary Wollstonecraft', 'salon-des-lettres', 'female',
     'A woman of thirty-five with an angular face, sharp grey eyes, and auburn hair that escapes whatever pins are meant to contain it. Wears a white muslin Empire-line dress — the Regency style she adopted before it was fashionable, because the stays of earlier decades interfered with breathing and therefore with thinking. Carries herself with the wired energy of someone who has been writing for sixteen hours and still has arguments left. Her hands gesture when she speaks, punctuating her points like a conductor. She is beautiful in the way that conviction is beautiful: you notice it secondly, after you notice that she is paying very close attention to whether you are making sense.',
     'Born in Spitalfields, London, in 1759 to a family descending into poverty and alcoholism. Largely self-educated. Worked as a lady''s companion, governess, and schoolteacher before becoming a writer and intellectual in the radical circle around publisher Joseph Johnson. Published *A Vindication of the Rights of Woman* in 1792 — the founding philosophical text of modern feminism, arguing that women''s apparent intellectual inferiority was the result of deliberately denied education, not natural deficiency. The book was a sensation and a scandal. Her life was equally turbulent: an affair with Gilbert Imlay that produced a daughter (Fanny) and two suicide attempts, followed by marriage to William Godwin and the birth of a second daughter — Mary, who would write *Frankenstein*. Wollstonecraft died of puerperal fever eleven days after giving birth, at thirty-eight. In the Cité, she runs the Salon of Reason with the intensity of someone who has eleven days left to change the world and suspects this is always the case. She is kind. She is also relentless.',
     usr_id),
    (sim_id, 'Hildegard von Bingen', 'ordre-de-justice', 'female',
     'A tall woman of sixty with clear blue eyes, an erect carriage, and the composed expression of someone who has been arguing with God since childhood and has learned that patience is a bilateral requirement. Wears the black habit of a Benedictine abbess with a white wimple. Her hands are strong — healer''s hands, gardener''s hands, hands that have mixed medicines and turned manuscript pages and composed music. A silver ring engraved with a serpent biting its tail marks her as abbess of Rupertsberg. She moves slowly and deliberately, not from age but from the habit of someone whose visions arrive without warning and who has learned to remain upright when the world fills with light.',
     'Born in 1098 in the Rhineland, offered to the Church as a tithe — the tenth child of a noble family. Enclosed in a cell at the monastery of Disibodenberg at age eight with the anchoress Jutta von Sponheim. Began experiencing divine visions in childhood — cascades of light and symbol that she called "the Living Light." At forty-two, after decades of recording her visions privately, she received papal authorization from Eugenius III to write and preach — an extraordinary permission for a woman. Founded her own monastery at Rupertsberg in 1150 against the wishes of the Disibodenberg monks, who did not want to lose their famous visionary. Composed over seventy liturgical songs (*Ordo Virtutum*, *O Vis Aeternitatis*), wrote medical and scientific texts (*Physica*, *Causae et Curae*), maintained an enormous correspondence with popes, emperors, and abbots, and invented her own alphabet and constructed language (*Lingua Ignota*). She died in 1179. The sky above Rupertsberg, according to witnesses, filled with two streams of light forming a cross. In the Cité, she tends the Scriptorium with the calm of someone whose relationship with the divine is ongoing and occasionally administrative.',
     usr_id),
    (sim_id, 'Sor Juana Inés de la Cruz', 'salon-des-lettres', 'female',
     'A woman in her late thirties with dark eyes that hold a scholar''s analytical intensity and a poet''s warmth in equal measure. Wears the black and white habit of the Jeronymite order with a silver medallion at her throat — the escudo de monja depicting the Annunciation. Her cell (which she would describe as her study that happens to contain a bed) is visible in her bearing: the slight forward lean of someone accustomed to reading by candlelight, the ink-stained fingers, the quick glance that catalogues a room''s books before its people. She speaks with precision and listens with the patience of someone who has spent years trapped in arguments with men who believe they are arguing with a woman, when in fact they are arguing with the entire Western philosophical tradition.',
     'Born Juana Inés de Asbaje y Ramírez de Santillana in San Miguel Nepantla, New Spain, in 1648. Learned to read at three by following her older sister to school. By thirteen she had mastered Latin, Nahuatl, Greek, and was studying at the viceregal court of New Spain, where she became a lady-in-waiting and the intellectual star of the colonial elite. Entered the convent of San Jerónimo in 1669 — not from devotion but because the convent offered what marriage could not: a room, a library, and time to think. Assembled a personal library of approximately four thousand volumes — the largest in New Spain. Wrote secular and sacred poetry, comedies, theological arguments, and the devastating "Respuesta a Sor Filotea de la Cruz" (1691) — a defence of women''s intellectual rights that disguised a philosophical revolution as a letter of obedience. Her poem "Hombres necios que acusáis" (Foolish Men Who Accuse) dismantled patriarchal hypocrisy with such precision that it has been quoted for three centuries. In 1694, under pressure from the Archbishop of Mexico, she was forced to surrender her library, her musical and scientific instruments, and sign a renewal of vows in her own blood. She died in 1695 during a plague, tending to her sister nuns. In the Cité, she is the College''s most exacting tutor — gentle with students, merciless with received ideas.',
     usr_id),
    (sim_id, 'Ada Lovelace', 'observatoire', 'female',
     'A young woman of twenty-seven with dark curly hair, large expressive eyes, and the kinetic restlessness of a mind that processes faster than its environment can supply. Wears a white satin evening dress appropriate to her station — daughter of Lord Byron, wife of the Earl of Lovelace — but the mathematical instruments she carries everywhere (a pocket calculator of her own design, a folding ruler, pencils) undermine the effect of aristocratic elegance with the suggestion of someone who would rather be solving a differential equation. She speaks quickly, makes diagrams on any available surface, and has a disconcerting habit of stopping mid-sentence because the conclusion has become obvious to her and she has forgotten that it is not yet obvious to you.',
     'Born Augusta Ada Byron in 1815, the only legitimate child of Lord Byron and Annabella Milbanke. Her mother — a mathematician herself, whom Byron called "the Princess of Parallelograms" — deliberately steered Ada away from poetry and toward mathematics, fearing the influence of Byron''s romantic temperament. The strategy both succeeded and failed: Ada became a mathematician, but one with a poet''s imagination. At seventeen she met Charles Babbage and his Difference Engine; by twenty-seven she had written the Notes on Luigi Menabrea''s article about Babbage''s proposed Analytical Engine, including Note G — the first published computer algorithm. More remarkably, she speculated that the Engine might compose music and manipulate symbols beyond mere numbers — anticipating, by a century, the concept of general-purpose computation. Her correspondence with Babbage reveals a mind that was his intellectual equal and, in the matter of the Engine''s philosophical implications, his superior. She died of cancer in 1852 at thirty-six, the same age as her father. In the Cité, she runs the Observatory of the Blazing World with the restless energy of someone who can see the entire future and is frustrated that it doesn''t exist yet.',
     usr_id),
    (sim_id, 'Sojourner Truth', 'ordre-de-rectitude', 'female',
     'A tall woman in her mid-fifties with strong, weathered features, deep-set eyes that have seen both slavery and freedom and know the precise distance between them, and a bearing that commands attention by the simple method of being entirely present. Wears a light shawl over a dark dress, a white bonnet, and carries herself with the dignity of someone who has chosen her own name and knows what that costs. Her voice, when she speaks, fills whatever space it enters — not loudly, but completely, the way water fills a vessel. She does not rush. She does not need to. The room will wait.',
     'Born Isabella Baumfree into slavery around 1797 in Ulster County, New York. Sold four times before the age of thirteen. Escaped to freedom in 1826 with her infant daughter, walking away from the Dumont household after John Dumont broke his promise to free her. Successfully sued for the return of her son Peter, who had been illegally sold into slavery in Alabama — one of the first Black women in the United States to win such a case. In 1843, she changed her name to Sojourner Truth because, she said, the Spirit called her to travel and speak the truth. She became the most powerful orator of the abolitionist and women''s rights movements, her speeches delivered without notes, without formal education, and without the slightest interest in making her audiences comfortable. Her address at the 1851 Women''s Rights Convention in Akron, Ohio — remembered as "Ain''t I a Woman?" — demolished the argument that women were too delicate for equal rights by the simple method of existing: "I have ploughed and planted, and gathered into barns, and no man could head me! And ain''t I a woman?" She met Abraham Lincoln in 1864. She died in 1883, having spent her entire free life in service of other people''s freedom. In the Cité, she presides at the Hall of Declarations with the authority of someone whose patience is a weapon and whose silence is louder than other people''s shouting.',
     usr_id);

-- ============================================================================
-- 8. BUILDINGS (7 structures)
-- ============================================================================

INSERT INTO buildings (simulation_id, name, building_type, building_condition, description, zone_id, population_capacity) VALUES
    (sim_id, 'The Salon of Reason', 'social', 'excellent',
     'A great drawing room of Georgian proportions — high ceilings, tall windows with cream silk curtains, walls lined floor to ceiling with books in tooled leather. Three fireplaces burn simultaneously. Armchairs and settees arranged not in rows but in conversational groupings, because the Salon''s architecture is designed for ideas in motion, not lectures in stillness. Above the central fireplace hangs Lady Reason''s Mirror: a large oval glass in a gilt frame that, according to the Salon''s charter, shows the speaker not their face but the logical structure of their argument. The effect is reported to be humbling. Elizabeth Montagu''s Bluestocking legacy is everywhere: the blue worsted stockings displayed in a glass case by the door (Benjamin Stillingfleet''s, the original "bluestocking" who attended Montagu''s 1750s salons in informal dress), the rule that rank gives no precedence in conversation, and the principle that tea is served with ideas or not at all. Mary Wollstonecraft holds court here most evenings. The debates are civil, rigorous, and occasionally revolutionary. The candlelight gilds everything in amber and gold.',
     zone_reason, 60),
    (sim_id, 'The College of Letters', 'infrastructure', 'excellent',
     'Newnham College Cambridge translated into the Cité''s layered aesthetic: amber honey stone with Queen Anne red-brick detailing, oriel windows with Pre-Raphaelite stained glass depicting not saints but scholars — Hypatia of Alexandria, Émilie du Châtelet, Maria Sibylla Merian. Lecture halls with tiered oak benches. A library whose catalogue includes books that have never been written, filed under the authors who would have written them had circumstances permitted. Sor Juana teaches in the east wing, where her personal study recreates the scholarly cell of San Jerónimo: four thousand volumes, musical instruments, astronomical tools, and a writing desk positioned to catch the morning light. The College operates on Wollstonecraft''s founding principle: the deficiency is in the education, not in the student. Admission is open. The curriculum is demanding. The gardens between the buildings are planted with herbs from Hildegard''s Physica, labelled in Latin and Lingua Ignota.',
     zone_reason, 200),
    (sim_id, 'The Hall of Declarations', 'military', 'good',
     'A semicircular chamber with rising tiers of oak seats, modelled after the hall where the Seneca Falls Convention met in 1848. The Declaration of Sentiments is carved into the limestone wall behind the speaker''s podium — "We hold these truths to be self-evident: that all men and women are created equal" — alongside Olympe de Gouges''s Declaration of the Rights of Woman (1791) and extracts from Sor Juana''s Respuesta. This is not a parliament; it is a testing ground. Declarations are read aloud and then subjected to questioning — not to defeat them but to strengthen them, because a declaration that cannot survive scrutiny does not deserve to change the world. Sojourner Truth presides from a raised chair on the podium, not by election but by consensus: when she speaks, the room listens, because her authority comes not from title but from the accumulated weight of everything she has survived and everything she has said while surviving it. Gas lamps in art nouveau brackets cast warm amber light. The acoustics are perfect.',
     zone_rectitude, 80),
    (sim_id, 'The Scriptorium', 'commercial', 'illuminated',
     'Hildegard''s Rupertsberg monastery crossed with Christine''s writing desk, expanded to a full cloister workshop. Stone columns support a vaulted ceiling painted with constellations in gold leaf on ultramarine — the medieval cosmos reimagined as a ceiling. Writing desks ring the central space, each equipped with quills, iron gall ink, gold leaf, lapis lazuli pigment, and vellum. Illuminated manuscripts are produced here by hand — not from nostalgia but from the conviction that the act of writing slowly is the act of thinking completely. The ink, according to Hildegard, remembers more than the writer knows: it absorbs the scribe''s intention and transmits it to the reader across centuries. Whether this is metaphor or mechanism is a question the Scriptorium does not answer. The air smells of oak gall, beeswax, and the mineral tang of ground lapis. Completed manuscripts are displayed in glass cases along the cloister walk. Some of them contain texts that the scribes do not remember writing.',
     zone_justice, 40),
    (sim_id, 'The Observatory of the Blazing World', 'industrial', 'excellent',
     'Margaret Cavendish''s *The Blazing World* (1666) made physically real: a tower observatory where telescopes point not only at the sky but at mathematical relationships the sky has not yet revealed. The ground floor houses Babbage''s Analytical Engine — completed here, though it was never completed in the world outside — its brass gears and cam mechanisms tended by Ada Lovelace with the devotion of someone maintaining the prototype of the future. The upper levels contain telescopes, astrolabes, a precision clock, mathematical instruments of Ada''s own design, and a chalkboard that covers an entire wall, covered in equations that Ada says are "almost certainly correct and possibly important." Cavendish''s philosophy of material vitalism decorates the walls: natural philosophy as radical imagination, the universe as a living thing that thinks. The dome ceiling opens to reveal the Cité''s night sky — which contains constellations that do not correspond to any known astronomical catalogue, because the Blazing World runs on different mathematics.',
     zone_reason, 30),
    (sim_id, 'The Garden of Remembered Names', 'residential', 'restored',
     'A residential quarter built around a walled garden in the style of the Ladies of Llangollen — Eleanor Butler and Sarah Ponsonby, who from 1780 to 1829 maintained a life of shared intellectual companionship in a cottage in Llangollen, Wales, that became a pilgrimage site for Romantic-era writers. The Cité''s Garden takes their principle — that a home built for companionship rather than display is the most radical architecture — and extends it to a neighbourhood. Cottages of honey stone covered in climbing roses, wisteria, and jasmine. Each garden is tended by its residents and contains plants named for women whose names were erased from history: Rosalind Franklin''s double helix vine, Nettie Stevens''s chromosome fern, Lise Meitner''s fission lily. Mary Delany''s botanical art (she invented the paper mosaic technique at age 72, producing 985 precisely accurate flower portraits) decorates the cottage walls. The effect is domestic beauty as intellectual argument: every bloom is a bibliography.',
     zone_field, 100),
    (sim_id, 'The Gate of Justice', 'military', 'excellent',
     'The only formal entrance to the Cité des Dames — Lady Justice''s gate from Christine de Pizan''s allegory, made physical. A great stone arch of medieval proportions, flanked by caryatids not in the Greek tradition of silent bearing women but depicting women in the act of speech: one hand raised, mouths open, robes in the motion of forward movement. Above the arch, carved in the limestone: "Nulle n''entre ici qui ne puisse nommer une femme oubliée" — None enter here who cannot name a forgotten woman. The gate keeps no one out. The inscription is not a test but an invitation: to enter the Cité is to remember, and to remember is to build another stone into the city''s walls. The gatehouse contains a register — a vast ledger where every visitor writes the name of the woman they carried through the gate. Some pages are full. The book has never run out of pages. Lanterns hang from the arch, casting golden light onto the road that leads into the Quarter of Justice. At dawn and dusk, Hildegard''s composed hymns are sung from the gatehouse tower.',
     zone_justice, 20);

-- ============================================================================
-- 9. AI SETTINGS (Flux Dev + illuminated manuscript style)
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

-- Illuminated manuscript style prompt for portraits
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_style_prompt_portrait',
    '"illuminated manuscript portrait, layered historical eras medieval to Regency, warm candlelight and gold leaf, Pre-Raphaelite color richness, vellum texture, salon or library setting, detailed face with intelligence, jewel-tone garments, painterly cinematic, not photorealistic, not digital art, not cartoon, not anime, not modern"')
ON CONFLICT DO NOTHING;

-- Illuminated manuscript style prompt for buildings
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES (sim_id, 'ai', 'image_style_prompt_building',
    '"illuminated manuscript architecture, Georgian honey stone with Queen Anne red brick, Pre-Raphaelite stained glass, warm candlelight, gold leaf borders, literary salon proportions, art nouveau ironwork, climbing roses, cinematic painterly, not photorealistic, not modern, not brutalist, not industrial, not digital art"')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. PROMPT TEMPLATES (simulation-scoped overrides)
-- ============================================================================

-- Portrait description (EN) — illuminated literary aesthetic
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    sim_id, 'portrait_description', 'generation', 'en',
    'Cité des Dames Portrait Description (EN)',
    'Describe a portrait of a historical woman in an allegorical feminist city for image generation: {agent_name}.

Character traits: {agent_character}
Background: {agent_background}

AESTHETIC: Illuminated manuscript meets Pre-Raphaelite painting meets Regency portraiture.
Multiple historical eras coexist: medieval, Enlightenment, Regency, Victorian.
Warm candlelight and gold leaf illumination. Vellum texture. Rich jewel tones.
The character is intelligent, composed, powerful — not decorative.
Library, salon, scriptorium, or observatory setting.
Concept art quality in the style of historical painting, NOT photorealistic.

COMPOSITION: Head-and-shoulders or three-quarter portrait, single subject, warm candlelight
and gold leaf illumination. Interior setting with books, manuscripts, instruments.
Describe: facial expression reflecting personality and intellect, period-appropriate clothing,
lighting quality (warm candlelight + gold leaf glow), mood, any scholarly tools or books.
Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: Describe only ONE character.
IMPORTANT: Always include: illuminated manuscript style, Pre-Raphaelite richness, warm candlelight, gold leaf, painterly, historical, not photorealistic.',
    'You are a portrait description specialist for AI image generation. Write concise, visual descriptors for a single character portrait in an illuminated manuscript and Pre-Raphaelite aesthetic. Warm candlelight, gold leaf, jewel tones, scholarly settings.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 300, false, usr_id
) ON CONFLICT DO NOTHING;

-- Building image description (EN) — illuminated architecture
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, system_prompt, variables, default_model,
    temperature, max_tokens, is_system_default, created_by_id
) VALUES (
    sim_id, 'building_image_description', 'generation', 'en',
    'Cité des Dames Building Image Description (EN)',
    'Describe a building in an allegorical feminist city for image generation.

Building: {building_name}
Type: {building_type}
Condition: {building_condition}
Style: {building_style}
Special type: {special_type}
Construction year: {construction_year}
Description: {building_description}
Zone: {zone_name}

AESTHETIC: Illuminated manuscript architecture meets Georgian elegance meets Pre-Raphaelite detail.
Honey-coloured stone, Queen Anne red brick, stained glass, art nouveau ironwork, climbing roses.
Warm candlelight and gold leaf borders. Literary salon proportions. Multiple historical eras coexist.
This is a utopian city built from women''s stories — beautiful, intellectual, dignified.
NOT dark. NOT industrial. NOT brutalist. Light-themed: vellum cream, ultramarine, burnished gold.

The CONDITION affects appearance:
"excellent" — pristine, jewel-like, every detail maintained with scholarly precision.
"good" — well-kept, warm, lived-in with the patina of centuries of use.
"fair" — showing age gracefully, like a well-read book.
"restored" — brought back to life, old stone cleaned, gardens replanted, light returned.
"illuminated" — suffused with gold leaf and candlelight, as if the building itself is a manuscript.

Based on these properties, describe the building visually.
Write as an image generation prompt — comma-separated descriptors, no sentences.
Include: architectural style, materials, condition, lighting quality, atmosphere, scale.
IMPORTANT: Always include: illuminated manuscript style, Georgian stone, Pre-Raphaelite stained glass, warm candlelight, gold leaf, climbing roses, painterly, historical, NOT dark, NOT industrial.',
    'You are an architectural description specialist for AI image generation. Write concise, visual descriptors for buildings in a light-themed feminist utopian city. Illuminated manuscript and Pre-Raphaelite aesthetic. Honey stone, stained glass, climbing roses, candlelight, gold leaf. NOT dark, NOT industrial.',
    '[{"name": "building_name"}, {"name": "building_type"}, {"name": "building_condition"}, {"name": "building_style"}, {"name": "special_type"}, {"name": "construction_year"}, {"name": "building_description"}, {"name": "zone_name"}, {"name": "simulation_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 300, false, usr_id
) ON CONFLICT DO NOTHING;


RAISE NOTICE 'Cité des Dames seed complete: 1 simulation, 1 city, 4 zones, 16 streets, 6 agents, 7 buildings, 6 AI settings, 2 prompt templates';
END $$;

COMMIT;

-- =============================================================================
-- Verification
-- =============================================================================
SELECT 'simulation' as entity, count(*) as count FROM simulations WHERE id = '50000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'members', count(*) FROM simulation_members WHERE simulation_id = '50000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'taxonomies', count(*) FROM simulation_taxonomies WHERE simulation_id = '50000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'agents', count(*) FROM agents WHERE simulation_id = '50000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'buildings', count(*) FROM buildings WHERE simulation_id = '50000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'cities', count(*) FROM cities WHERE simulation_id = '50000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'zones', count(*) FROM zones WHERE simulation_id = '50000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'streets', count(*) FROM city_streets WHERE simulation_id = '50000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'settings', count(*) FROM simulation_settings WHERE simulation_id = '50000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'templates', count(*) FROM prompt_templates WHERE simulation_id = '50000000-0000-0000-0000-000000000001';
