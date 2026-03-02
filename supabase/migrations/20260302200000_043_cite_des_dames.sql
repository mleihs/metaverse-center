-- =============================================================================
-- Migration 043: Cité des Dames — Feminist Literary Utopia (Simulation 5)
-- =============================================================================
-- Combined migration: simulation data + theme + embassy buildings + connections.
-- The platform's first light-themed simulation.
-- Built on Christine de Pizan's *The Book of the City of Ladies* (1405).
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
    -- Other simulation IDs for connections
    sim_velgarien   uuid := '10000000-0000-0000-0000-000000000001';
    sim_capybara    uuid := '20000000-0000-0000-0000-000000000001';
    sim_stationnull uuid := '30000000-0000-0000-0000-000000000001';
    sim_speranza    uuid := '40000000-0000-0000-0000-000000000001';
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

INSERT INTO simulation_members (simulation_id, user_id, member_role)
VALUES (sim_id, usr_id, 'owner')
ON CONFLICT (simulation_id, user_id) DO NOTHING;

-- ============================================================================
-- 2. TAXONOMIES (13 categories)
-- ============================================================================

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'gender', 'female',  '{"en":"Female","de":"Weiblich"}', 1),
    (sim_id, 'gender', 'male',    '{"en":"Male","de":"Männlich"}', 2),
    (sim_id, 'gender', 'diverse', '{"en":"Diverse","de":"Divers"}', 3)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'profession', 'architect',    '{"en":"Architect","de":"Architektin"}', 1),
    (sim_id, 'profession', 'philosopher',  '{"en":"Philosopher","de":"Philosophin"}', 2),
    (sim_id, 'profession', 'visionary',    '{"en":"Visionary","de":"Visionärin"}', 3),
    (sim_id, 'profession', 'scholar',      '{"en":"Scholar","de":"Gelehrte"}', 4),
    (sim_id, 'profession', 'calculator',   '{"en":"Calculator","de":"Rechnerin"}', 5),
    (sim_id, 'profession', 'orator',       '{"en":"Orator","de":"Rednerin"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'system', 'ordre-de-raison',     '{"en":"Ordre de Raison","de":"Orden der Vernunft"}', 1),
    (sim_id, 'system', 'salon-des-lettres',    '{"en":"Salon des Lettres","de":"Salon der Literatur"}', 2),
    (sim_id, 'system', 'ordre-de-rectitude',   '{"en":"Ordre de Rectitude","de":"Orden der Rechtschaffenheit"}', 3),
    (sim_id, 'system', 'ordre-de-justice',     '{"en":"Ordre de Justice","de":"Orden der Gerechtigkeit"}', 4),
    (sim_id, 'system', 'observatoire',         '{"en":"Observatoire","de":"Observatorium"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'building_type', 'residential',     '{"en":"Residential","de":"Wohnbereich"}', 1),
    (sim_id, 'building_type', 'commercial',      '{"en":"Commercial","de":"Gewerbebereich"}', 2),
    (sim_id, 'building_type', 'industrial',      '{"en":"Industrial","de":"Industriebereich"}', 3),
    (sim_id, 'building_type', 'military',        '{"en":"Military","de":"Militärbereich"}', 4),
    (sim_id, 'building_type', 'infrastructure',  '{"en":"Infrastructure","de":"Infrastruktur"}', 5),
    (sim_id, 'building_type', 'medical',         '{"en":"Medical","de":"Medizinbereich"}', 6),
    (sim_id, 'building_type', 'social',          '{"en":"Social","de":"Sozialbereich"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'building_condition', 'excellent',    '{"en":"Excellent","de":"Ausgezeichnet"}', 1),
    (sim_id, 'building_condition', 'good',         '{"en":"Good","de":"Gut"}', 2),
    (sim_id, 'building_condition', 'fair',         '{"en":"Fair","de":"Befriedigend"}', 3),
    (sim_id, 'building_condition', 'restored',     '{"en":"Restored","de":"Restauriert"}', 4),
    (sim_id, 'building_condition', 'illuminated',  '{"en":"Illuminated","de":"Illuminiert"}', 5)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'zone_type', 'quarter',   '{"en":"Quarter","de":"Viertel"}', 1),
    (sim_id, 'zone_type', 'field',     '{"en":"Field","de":"Feld"}', 2),
    (sim_id, 'zone_type', 'terrace',   '{"en":"Terrace","de":"Terrasse"}', 3),
    (sim_id, 'zone_type', 'cloister',  '{"en":"Cloister","de":"Kreuzgang"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'security_level', 'open',    '{"en":"Open","de":"Offen"}', 1),
    (sim_id, 'security_level', 'guarded', '{"en":"Guarded","de":"Bewacht"}', 2),
    (sim_id, 'security_level', 'warded',  '{"en":"Warded","de":"Geschützt"}', 3),
    (sim_id, 'security_level', 'sealed',  '{"en":"Sealed","de":"Versiegelt"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'urgency_level', 'low',      '{"en":"Low","de":"Niedrig"}', 1),
    (sim_id, 'urgency_level', 'medium',   '{"en":"Medium","de":"Mittel"}', 2),
    (sim_id, 'urgency_level', 'high',     '{"en":"High","de":"Hoch"}', 3),
    (sim_id, 'urgency_level', 'critical', '{"en":"Critical","de":"Kritisch"}', 4)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'event_type', 'lecture',       '{"en":"Lecture","de":"Vorlesung"}', 1),
    (sim_id, 'event_type', 'salon',         '{"en":"Salon","de":"Salon"}', 2),
    (sim_id, 'event_type', 'disputation',   '{"en":"Disputation","de":"Disputation"}', 3),
    (sim_id, 'event_type', 'declaration',   '{"en":"Declaration","de":"Deklaration"}', 4),
    (sim_id, 'event_type', 'illumination',  '{"en":"Illumination","de":"Illumination"}', 5),
    (sim_id, 'event_type', 'concert',       '{"en":"Concert","de":"Konzert"}', 6),
    (sim_id, 'event_type', 'procession',    '{"en":"Procession","de":"Prozession"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'propaganda_type', 'pamphlet',       '{"en":"Pamphlet","de":"Pamphlet"}', 1),
    (sim_id, 'propaganda_type', 'broadsheet',     '{"en":"Broadsheet","de":"Flugblatt"}', 2),
    (sim_id, 'propaganda_type', 'oration',        '{"en":"Oration","de":"Rede"}', 3),
    (sim_id, 'propaganda_type', 'petition',       '{"en":"Petition","de":"Petition"}', 4),
    (sim_id, 'propaganda_type', 'illumination',   '{"en":"Illumination","de":"Illumination"}', 5),
    (sim_id, 'propaganda_type', 'verse',          '{"en":"Verse","de":"Vers"}', 6),
    (sim_id, 'propaganda_type', 'epistle',        '{"en":"Epistle","de":"Epistel"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'target_demographic', 'scholars',       '{"en":"Scholars","de":"Gelehrte"}', 1),
    (sim_id, 'target_demographic', 'artisans',       '{"en":"Artisans","de":"Handwerkerinnen"}', 2),
    (sim_id, 'target_demographic', 'citizens',       '{"en":"Citizens","de":"Bürgerinnen"}', 3),
    (sim_id, 'target_demographic', 'visitors',       '{"en":"Visitors","de":"Besucherinnen"}', 4),
    (sim_id, 'target_demographic', 'the-undecided',  '{"en":"The Undecided","de":"Die Unentschlossenen"}', 5),
    (sim_id, 'target_demographic', 'the-silenced',   '{"en":"The Silenced","de":"Die Verstummten"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'campaign_type', 'pamphlet',       '{"en":"Pamphlet","de":"Pamphlet"}', 1),
    (sim_id, 'campaign_type', 'broadsheet',     '{"en":"Broadsheet","de":"Flugblatt"}', 2),
    (sim_id, 'campaign_type', 'oration',        '{"en":"Oration","de":"Rede"}', 3),
    (sim_id, 'campaign_type', 'petition',       '{"en":"Petition","de":"Petition"}', 4),
    (sim_id, 'campaign_type', 'illumination',   '{"en":"Illumination","de":"Illumination"}', 5),
    (sim_id, 'campaign_type', 'verse',          '{"en":"Verse","de":"Vers"}', 6),
    (sim_id, 'campaign_type', 'epistle',        '{"en":"Epistle","de":"Epistel"}', 7)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order) VALUES
    (sim_id, 'street_type', 'promenade', '{"en":"Promenade","de":"Promenade"}', 1),
    (sim_id, 'street_type', 'arcade',    '{"en":"Arcade","de":"Arkade"}', 2),
    (sim_id, 'street_type', 'lane',      '{"en":"Lane","de":"Gasse"}', 3),
    (sim_id, 'street_type', 'gallery',   '{"en":"Gallery","de":"Galerie"}', 4),
    (sim_id, 'street_type', 'passage',   '{"en":"Passage","de":"Passage"}', 5),
    (sim_id, 'street_type', 'bridge',    '{"en":"Bridge","de":"Brücke"}', 6)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- ============================================================================
-- 3. CITY + ZONES + STREETS
-- ============================================================================

INSERT INTO cities (id, simulation_id, name, description, population)
VALUES (
    city_id, sim_id,
    'Cité des Dames',
    'A city that has always existed, in the sense that it was always possible. Built from honey-coloured Georgian stone with Queen Anne red brick, Pre-Raphaelite stained glass, art nouveau ironwork, and climbing roses. Multiple historical eras coexist in layered simultaneity.',
    6000
) ON CONFLICT (id) DO NOTHING;

INSERT INTO zones (id, simulation_id, city_id, name, zone_type, security_level, description) VALUES
    (zone_reason, sim_id, city_id, 'Quarter of Reason',
     'quarter', 'open',
     'Lady Reason built the foundations. Intellectual and scientific spaces: the Salon of Reason, the College of Letters, the Observatory of the Blazing World. Sunlight through medieval stained glass. The air smells of old paper, candlewax, and precision instruments.'),
    (zone_rectitude, sim_id, city_id, 'Quarter of Rectitude',
     'quarter', 'guarded',
     'Lady Rectitude built the streets. The civic heart — governance by declaration. The Hall of Declarations dominates, with the Declaration of Sentiments carved into limestone. Georgian symmetry softened by Pre-Raphaelite detail.'),
    (zone_justice, sim_id, city_id, 'Quarter of Justice',
     'quarter', 'warded',
     'Lady Justice added the roofs and gates. The spiritual and artistic heart. The Scriptorium occupies the central cloister. The Gate of Justice stands at the edge. Time layers in this quarter: medieval arches support Regency railings.'),
    (zone_field, sim_id, city_id, 'The Field of Letters',
     'field', 'open',
     'The fertile plain where the city grows. Public gardens, a book market, communal kitchens, the Garden of Remembered Names. Cottages covered in climbing plants, built for companionship. The air smells of lavender, ink, and fresh bread.')
ON CONFLICT (id) DO NOTHING;

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
-- 4. AGENTS (6 historical women, fictionalized)
-- ============================================================================

INSERT INTO agents (simulation_id, name, system, gender, character, background, created_by_id) VALUES
    (sim_id, 'Christine de Pizan', 'ordre-de-raison', 'female',
     'A woman in her early forties with steady dark eyes and the careful posture of someone who has spent decades at a writing desk. Olive-skinned, fine-boned, with ink stains on her right hand. Wears a deep green medieval gown with gold embroidery at the collar. Dark hair covered by a white coif and a simple gold circlet. Carries a quill behind her ear when she forgets it is there.',
     'Born in Venice in 1364, raised at the court of Charles V of France. Widowed at twenty-five, became the first professional female author in Europe. Her masterwork, Le Livre de la Cité des Dames (1405), is an allegorical city built from the stories of remarkable women throughout history.',
     usr_id),
    (sim_id, 'Mary Wollstonecraft', 'salon-des-lettres', 'female',
     'A woman of thirty-five with an angular face, sharp grey eyes, and auburn hair that escapes whatever pins are meant to contain it. Wears a white muslin Empire-line dress. Carries herself with the wired energy of someone who has been writing for sixteen hours and still has arguments left. Her hands gesture when she speaks.',
     'Born in Spitalfields, London, in 1759. Published A Vindication of the Rights of Woman in 1792 — arguing that women''s apparent intellectual inferiority was the result of deliberately denied education. Died of puerperal fever eleven days after giving birth to the daughter who would write Frankenstein.',
     usr_id),
    (sim_id, 'Hildegard von Bingen', 'ordre-de-justice', 'female',
     'A tall woman of sixty with clear blue eyes, an erect carriage, and the composed expression of someone who has been arguing with God since childhood. Wears the black habit of a Benedictine abbess with a white wimple. Her hands are strong — healer''s hands, gardener''s hands. A silver ring engraved with a serpent biting its tail marks her as abbess of Rupertsberg.',
     'Born in 1098 in the Rhineland. Began experiencing divine visions — the Living Light — in childhood. Composed over seventy liturgical songs, wrote medical texts (Physica), invented her own alphabet (Lingua Ignota), and founded the monastery at Rupertsberg against the wishes of the monks who did not want to lose their famous visionary.',
     usr_id),
    (sim_id, 'Sor Juana Inés de la Cruz', 'salon-des-lettres', 'female',
     'A woman in her late thirties with dark eyes that hold a scholar''s analytical intensity and a poet''s warmth in equal measure. Wears the black and white habit of the Jeronymite order with a silver medallion at her throat. The slight forward lean of someone accustomed to reading by candlelight, ink-stained fingers, quick glance that catalogues a room''s books before its people.',
     'Born in New Spain in 1648. Learned to read at three, mastered Latin in twenty lessons. Entered the convent of San Jerónimo because it offered what marriage could not: a room, a library, and time to think. Maintained a library of four thousand volumes. Forced to surrender all her books under ecclesiastical pressure in 1694. Died tending to plague-stricken nuns in 1695.',
     usr_id),
    (sim_id, 'Ada Lovelace', 'observatoire', 'female',
     'A young woman of twenty-seven with dark curly hair, large expressive eyes, and the kinetic restlessness of a mind that processes faster than its environment can supply. Wears a white satin evening dress with mathematical instruments in her sash — a pocket calculator of her own design, a folding ruler, pencils. Speaks quickly and makes diagrams on any available surface.',
     'Born Augusta Ada Byron in 1815, daughter of Lord Byron and Annabella Milbanke. Her mother steered her toward mathematics to avoid Byron''s romantic temperament. Met Charles Babbage at seventeen. Wrote Note G for the Analytical Engine — the first computer algorithm — and speculated the machine might compose music. Died of cancer at thirty-six, the same age as her father.',
     usr_id),
    (sim_id, 'Sojourner Truth', 'ordre-de-rectitude', 'female',
     'A tall woman in her mid-fifties with strong, weathered features and deep-set eyes that have seen both slavery and freedom. Wears a light shawl over a dark dress, a white bonnet. Carries herself with the dignity of someone who has chosen her own name. Her voice fills whatever space it enters — not loudly, but completely.',
     'Born Isabella Baumfree into slavery around 1797 in New York. Escaped in 1826 with her infant daughter. Changed her name to Sojourner Truth in 1843. Her address at the 1851 Akron Convention demolished the argument that women were too delicate for equal rights. Met Abraham Lincoln in 1864. Spent her entire free life in service of other people''s freedom.',
     usr_id);

-- ============================================================================
-- 5. BUILDINGS (7 structures + 3 embassy buildings)
-- ============================================================================

INSERT INTO buildings (simulation_id, name, building_type, building_condition, description, zone_id, population_capacity) VALUES
    (sim_id, 'The Salon of Reason', 'social', 'excellent',
     'A great drawing room of Georgian proportions with high ceilings, walls lined with books, and three fireplaces. Lady Reason''s Mirror hangs above the central fireplace. Elizabeth Montagu''s Bluestocking legacy: rank gives no precedence in conversation.',
     zone_reason, 60),
    (sim_id, 'The College of Letters', 'infrastructure', 'excellent',
     'Newnham College Cambridge in amber stone with oriel windows and Pre-Raphaelite stained glass depicting scholars, not saints. Lecture halls, library, observatory dome. Founded on Wollstonecraft''s principle: the deficiency is in the education, not the student.',
     zone_reason, 200),
    (sim_id, 'The Hall of Declarations', 'military', 'good',
     'A semicircular chamber with rising tiers of oak seats. The Declaration of Sentiments (1848) carved into the wall. Not a parliament but a testing ground — declarations are read aloud and subjected to questioning. Sojourner Truth presides.',
     zone_rectitude, 80),
    (sim_id, 'The Scriptorium', 'commercial', 'illuminated',
     'Hildegard''s Rupertsberg monastery crossed with Christine''s writing desk. Vaulted ceiling painted with constellations in gold leaf on ultramarine. Illuminated manuscripts produced by hand — the act of writing slowly is the act of thinking completely.',
     zone_justice, 40),
    (sim_id, 'The Observatory of the Blazing World', 'industrial', 'excellent',
     'Margaret Cavendish''s Blazing World made real. Telescopes, astrolabes, Babbage''s Analytical Engine completed. Ada Lovelace''s domain. The dome ceiling reveals constellations from a different mathematics.',
     zone_reason, 30),
    (sim_id, 'The Garden of Remembered Names', 'residential', 'restored',
     'A residential quarter around a walled garden in the style of the Ladies of Llangollen. Cottages in honey stone with climbing roses. Every plant named for a woman erased from history. Mary Delany''s botanical art as design principle.',
     zone_field, 100),
    (sim_id, 'The Gate of Justice', 'military', 'excellent',
     'Lady Justice''s gate from Christine''s allegory. A stone arch flanked by caryatids depicting women in the act of speech. Inscription: "Nulle n''entre ici qui ne puisse nommer une femme oubliée." The gate keeps no one out.',
     zone_justice, 20);

-- Embassy buildings (3)
INSERT INTO buildings (simulation_id, name, building_type, building_condition, description, zone_id, population_capacity, special_type, special_attributes, data_source) VALUES
    (sim_id, 'The Footnote Room', 'social', 'illuminated',
     'A small chamber beneath the College of Letters where footnotes from books in other Shards manifest as physical objects — marginalia carved in stone, annotations that glow faintly in languages the reader does not speak but somehow understands. The Bureau classifies it as a "textual embassy." The scholars who work here call it a conversation between worlds conducted in the margins.',
     zone_reason, 5, 'embassy', '{}', 'curated'),
    (sim_id, 'The Unnamed Archive', 'infrastructure', 'restored',
     'A repository in the Quarter of Rectitude that collects documents from other Shards — bureaucratic forms, propaganda leaflets, military orders — and files them under the names of the women who were erased from those documents. A cross-dimensional corrections department, operating with the patience of archivists and the precision of accountants.',
     zone_rectitude, 5, 'embassy', '{}', 'curated'),
    (sim_id, 'The Listening Wall', 'military', 'good',
     'A section of the city wall in the Quarter of Justice where the stone is thin enough that sounds from adjacent Shards leak through. Hildegard tends it. She says the wall does not separate; it translates. Visitors press their hands to the warm stone and hear, faintly, music that has not yet been composed in their world.',
     zone_justice, 3, 'embassy', '{}', 'curated');

-- ============================================================================
-- 6. AI SETTINGS
-- ============================================================================

INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value) VALUES
    (sim_id, 'ai', 'image_model_agent_portrait', '"black-forest-labs/flux-dev"'),
    (sim_id, 'ai', 'image_model_building_image', '"black-forest-labs/flux-dev"'),
    (sim_id, 'ai', 'image_guidance_scale', '5.0'),
    (sim_id, 'ai', 'image_num_inference_steps', '28'),
    (sim_id, 'ai', 'image_style_prompt_portrait',
        '"illuminated manuscript portrait, layered historical eras medieval to Regency, warm candlelight and gold leaf, Pre-Raphaelite color richness, vellum texture, salon or library setting, detailed face with intelligence, jewel-tone garments, painterly cinematic, not photorealistic, not digital art, not cartoon, not anime, not modern"'),
    (sim_id, 'ai', 'image_style_prompt_building',
        '"illuminated manuscript architecture, Georgian honey stone with Queen Anne red brick, Pre-Raphaelite stained glass, warm candlelight, gold leaf borders, literary salon proportions, art nouveau ironwork, climbing roses, cinematic painterly, not photorealistic, not modern, not brutalist, not industrial, not digital art"')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. PROMPT TEMPLATES
-- ============================================================================

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
Warm candlelight and gold leaf illumination. Rich jewel tones. Library or salon setting.
The character is intelligent, composed, powerful — not decorative.
Concept art quality in the style of historical painting, NOT photorealistic.

COMPOSITION: Head-and-shoulders portrait, single subject, warm candlelight.
Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: Describe only ONE character.
IMPORTANT: Always include: illuminated manuscript style, Pre-Raphaelite richness, warm candlelight, gold leaf, painterly, historical.',
    'You are a portrait description specialist for AI image generation. Write concise, visual descriptors for a single character portrait in an illuminated manuscript and Pre-Raphaelite aesthetic.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 300, false, usr_id
) ON CONFLICT DO NOTHING;

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
Description: {building_description}
Zone: {zone_name}

AESTHETIC: Illuminated manuscript architecture meets Georgian elegance meets Pre-Raphaelite detail.
Honey-coloured stone, stained glass, climbing roses, warm candlelight, gold leaf borders.
This is a utopian city — beautiful, intellectual, dignified. Light-themed: vellum cream, ultramarine, gold.
NOT dark. NOT industrial. NOT brutalist.

Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: Always include: illuminated manuscript style, Georgian stone, stained glass, candlelight, gold leaf, climbing roses, painterly, NOT dark.',
    'You are an architectural description specialist for a light-themed feminist utopian city. Illuminated manuscript and Pre-Raphaelite aesthetic. Honey stone, stained glass, climbing roses, candlelight, gold leaf.',
    '[{"name": "building_name"}, {"name": "building_type"}, {"name": "building_condition"}, {"name": "building_style"}, {"name": "special_type"}, {"name": "construction_year"}, {"name": "building_description"}, {"name": "zone_name"}, {"name": "simulation_name"}]',
    'deepseek/deepseek-chat-v3-0324', 0.6, 300, false, usr_id
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- 8. DESIGN THEME (Illuminated Literary)
-- ============================================================================

INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value, updated_by_id)
VALUES
  (sim_id, 'design', 'color_primary',        '"#1E3A8A"', usr_id),
  (sim_id, 'design', 'color_primary_hover',   '"#1A3278"', usr_id),
  (sim_id, 'design', 'color_primary_active',  '"#152A66"', usr_id),
  (sim_id, 'design', 'color_secondary',       '"#7B2D8E"', usr_id),
  (sim_id, 'design', 'color_accent',          '"#B8860B"', usr_id),
  (sim_id, 'design', 'color_background',      '"#F5E6CC"', usr_id),
  (sim_id, 'design', 'color_surface',         '"#FAF3E6"', usr_id),
  (sim_id, 'design', 'color_surface_sunken',  '"#EDE0C8"', usr_id),
  (sim_id, 'design', 'color_surface_header',  '"#F7EDD8"', usr_id),
  (sim_id, 'design', 'color_text',            '"#1C1008"', usr_id),
  (sim_id, 'design', 'color_text_secondary',  '"#3A2A18"', usr_id),
  (sim_id, 'design', 'color_text_muted',      '"#7A6B55"', usr_id),
  (sim_id, 'design', 'color_border',          '"#8B7D6B"', usr_id),
  (sim_id, 'design', 'color_border_light',    '"#C9BBAA"', usr_id),
  (sim_id, 'design', 'color_danger',          '"#9B111E"', usr_id),
  (sim_id, 'design', 'color_success',         '"#2D6B3A"', usr_id),
  (sim_id, 'design', 'color_primary_bg',      '"#EEF1F8"', usr_id),
  (sim_id, 'design', 'color_info_bg',         '"#F0ECF5"', usr_id),
  (sim_id, 'design', 'color_danger_bg',       '"#FDF0EE"', usr_id),
  (sim_id, 'design', 'color_success_bg',      '"#EFF8F0"', usr_id),
  (sim_id, 'design', 'color_warning_bg',      '"#FFF5E6"', usr_id),
  (sim_id, 'design', 'font_heading',          '"''Libre Baskerville'', Baskerville, Georgia, serif"', usr_id),
  (sim_id, 'design', 'font_body',             '"system-ui, -apple-system, sans-serif"', usr_id),
  (sim_id, 'design', 'font_mono',             '"SF Mono, Monaco, Inconsolata, ''Roboto Mono'', monospace"', usr_id),
  (sim_id, 'design', 'heading_weight',        '"700"', usr_id),
  (sim_id, 'design', 'heading_transform',     '"none"', usr_id),
  (sim_id, 'design', 'heading_tracking',      '"0.02em"', usr_id),
  (sim_id, 'design', 'font_base_size',        '"16px"', usr_id),
  (sim_id, 'design', 'border_radius',         '"3px"', usr_id),
  (sim_id, 'design', 'border_width',          '"1px"', usr_id),
  (sim_id, 'design', 'border_width_default',  '"1px"', usr_id),
  (sim_id, 'design', 'shadow_style',          '"blur"', usr_id),
  (sim_id, 'design', 'shadow_color',          '"#8B7D6B88"', usr_id),
  (sim_id, 'design', 'hover_effect',          '"glow"', usr_id),
  (sim_id, 'design', 'text_inverse',          '"#FFFFFF"', usr_id),
  (sim_id, 'design', 'animation_speed',       '"1.1"', usr_id),
  (sim_id, 'design', 'animation_easing',      '"ease-in-out"', usr_id)
ON CONFLICT (simulation_id, category, setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_by_id = EXCLUDED.updated_by_id,
  updated_at    = now();

-- ============================================================================
-- 9. SIMULATION CONNECTIONS (4 new edges: Cité ↔ each existing sim)
-- ============================================================================

INSERT INTO simulation_connections (simulation_a_id, simulation_b_id, connection_type, bleed_vectors, strength, description, is_active)
VALUES
  (sim_velgarien, sim_id, 'bleed', ARRAY['language','memory'], 0.7,
   'Velgarien bureaucrats find treatises on citizens'' rights appearing in filing cabinets. The Bureau classifies as Literate Contamination. Form 77-4/C has been amended twelve times.',
   true),
  (sim_capybara, sim_id, 'bleed', ARRAY['dream','language'], 0.6,
   'Capybara Kingdom archivists catalogue volumes of poetry that reduce them to tears in languages they have never learned. The ink smells of candlewax and lapis lazuli.',
   true),
  (sim_stationnull, sim_id, 'bleed', ARRAY['resonance','language'], 0.5,
   'Station Null''s HAVEN system detects anomalous data patterns that resolve into mathematical proofs of unknown origin. The proofs are correct. Correctness has no origin.',
   true),
  (sim_speranza, sim_id, 'bleed', ARRAY['language','commerce'], 0.6,
   'Speranza raiders find illuminated manuscripts in Topside salvage — books in perfect condition amid rubble, as though the ruins were protecting them. The children illustrate them in their murals.',
   true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. EMBASSY RECORDS (4 embassies: Cité ↔ each existing sim)
-- ============================================================================

-- Velgarien ↔ Cité des Dames: Archive Sub-Level C / The Footnote Room
INSERT INTO embassies (
    building_a_id, simulation_a_id, building_b_id, simulation_b_id,
    status, connection_type, description, established_by, bleed_vector,
    event_propagation, embassy_metadata
)
SELECT
    LEAST(ba.id, bb.id), CASE WHEN ba.id < bb.id THEN ba.simulation_id ELSE bb.simulation_id END,
    GREATEST(ba.id, bb.id), CASE WHEN ba.id < bb.id THEN bb.simulation_id ELSE ba.simulation_id END,
    'active', 'embassy',
    'What if every censored thought left a footnote?',
    'The Cartographer — identified ache-point in Central Archive marginal annotations',
    'language', true,
    jsonb_build_object(
        'ambassador_a', jsonb_build_object('name', 'Inspektor Mueller', 'role', 'Bureau of Impossible Geography', 'quirk', 'Has begun reading footnotes before the text they annotate'),
        'ambassador_b', jsonb_build_object('name', 'Christine de Pizan', 'role', 'Architect of the Cité', 'quirk', 'Finds bureaucratic forms appearing in her manuscript margins'),
        'protocol', 'THRESHOLD',
        'ache_point', 'Central Archive / College of Letters junction'
    )
FROM buildings ba, buildings bb
WHERE ba.name = 'Archive Sub-Level C' AND ba.simulation_id = sim_velgarien
  AND bb.name = 'The Footnote Room' AND bb.simulation_id = sim_id
ON CONFLICT DO NOTHING;

-- Capybara Kingdom ↔ Cité des Dames: The Drowned Antenna / The Listening Wall
INSERT INTO embassies (
    building_a_id, simulation_a_id, building_b_id, simulation_b_id,
    status, connection_type, description, established_by, bleed_vector,
    event_propagation, embassy_metadata
)
SELECT
    LEAST(ba.id, bb.id), CASE WHEN ba.id < bb.id THEN ba.simulation_id ELSE bb.simulation_id END,
    GREATEST(ba.id, bb.id), CASE WHEN ba.id < bb.id THEN bb.simulation_id ELSE ba.simulation_id END,
    'active', 'embassy',
    'What if the darkness could read?',
    'The Cartographer — identified ache-point where Unterzee acoustics carry hymns',
    'dream', true,
    jsonb_build_object(
        'ambassador_a', jsonb_build_object('name', 'Archivist Mossback', 'role', 'Deepreach Embassy Liaison', 'quirk', 'Has begun illuminating her catalogue entries in gold leaf'),
        'ambassador_b', jsonb_build_object('name', 'Hildegard von Bingen', 'role', 'Keeper of the Scriptorium', 'quirk', 'Hears bioluminescent harmonics in her visions'),
        'protocol', 'THRESHOLD',
        'ache_point', 'Unterzee / Quarter of Justice resonance'
    )
FROM buildings ba, buildings bb
WHERE ba.name = 'The Drowned Antenna' AND ba.simulation_id = sim_capybara
  AND bb.name = 'The Listening Wall' AND bb.simulation_id = sim_id
ON CONFLICT DO NOTHING;

-- Station Null ↔ Cité des Dames: Relay Chamber 7 / The Unnamed Archive
INSERT INTO embassies (
    building_a_id, simulation_a_id, building_b_id, simulation_b_id,
    status, connection_type, description, established_by, bleed_vector,
    event_propagation, embassy_metadata
)
SELECT
    LEAST(ba.id, bb.id), CASE WHEN ba.id < bb.id THEN ba.simulation_id ELSE bb.simulation_id END,
    GREATEST(ba.id, bb.id), CASE WHEN ba.id < bb.id THEN bb.simulation_id ELSE ba.simulation_id END,
    'active', 'embassy',
    'What if the data remembered the people it erased?',
    'The Cartographer — identified ache-point where HAVEN diagnostics produce poetry',
    'resonance', true,
    jsonb_build_object(
        'ambassador_a', jsonb_build_object('name', 'Navigator Braun', 'role', 'Anomaly Cartography Officer', 'quirk', 'Has begun filing anomaly reports in iambic pentameter'),
        'ambassador_b', jsonb_build_object('name', 'Sor Juana Inés de la Cruz', 'role', 'Tutor of the College', 'quirk', 'Receives diagnostic readouts she interprets as theological arguments'),
        'protocol', 'THRESHOLD',
        'ache_point', 'Command Deck / Quarter of Rectitude data bridge'
    )
FROM buildings ba, buildings bb
WHERE ba.name = 'Relay Chamber 7' AND ba.simulation_id = sim_stationnull
  AND bb.name = 'The Unnamed Archive' AND bb.simulation_id = sim_id
ON CONFLICT DO NOTHING;

-- Speranza ↔ Cité des Dames: The Paper Room / The Footnote Room
INSERT INTO embassies (
    building_a_id, simulation_a_id, building_b_id, simulation_b_id,
    status, connection_type, description, established_by, bleed_vector,
    event_propagation, embassy_metadata
)
SELECT
    LEAST(ba.id, bb.id), CASE WHEN ba.id < bb.id THEN ba.simulation_id ELSE bb.simulation_id END,
    GREATEST(ba.id, bb.id), CASE WHEN ba.id < bb.id THEN bb.simulation_id ELSE ba.simulation_id END,
    'active', 'embassy',
    'What if hope could be written down and survive the fire?',
    'The Cartographer — identified ache-point in salvage manuscript anomalies',
    'language', true,
    jsonb_build_object(
        'ambassador_a', jsonb_build_object('name', 'Padre Ignazio', 'role', 'Keeper of Impossible Doors', 'quirk', 'Has begun preserving salvaged manuscripts in gold leaf'),
        'ambassador_b', jsonb_build_object('name', 'Ada Lovelace', 'role', 'Director of the Observatory', 'quirk', 'Calculates the structural integrity of hope as an engineering problem'),
        'protocol', 'THRESHOLD',
        'ache_point', 'Bastione Vecchio / Observatory convergence'
    )
FROM buildings ba, buildings bb
WHERE ba.name = 'The Paper Room' AND ba.simulation_id = sim_speranza
  AND bb.name = 'The Footnote Room' AND bb.simulation_id = sim_id
ON CONFLICT DO NOTHING;


RAISE NOTICE 'Migration 043 complete: Cité des Dames — 1 simulation, 1 city, 4 zones, 16 streets, 6 agents, 10 buildings (7 + 3 embassy), 6 AI settings, 37 design settings, 2 prompt templates, 4 connections, 4 embassies';
END $$;

COMMIT;
