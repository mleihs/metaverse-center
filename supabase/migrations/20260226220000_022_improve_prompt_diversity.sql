-- =============================================================================
-- Migration 022: Improve Prompt Diversity
-- =============================================================================
-- Fixes prompt redundancy across all 3 simulations:
-- 1. Increase max_tokens from 200 to 300 (prevents truncation of unique details)
-- 2. Rewrite prompt templates to remove aesthetic directives that duplicate style prompts
-- 3. Improve Station Null agent character descriptions for visual differentiation
-- 4. Improve Station Null building descriptions for architectural differentiation
-- =============================================================================

DO $$
DECLARE
    velgarien_id uuid := '10000000-0000-0000-0000-000000000001';
    capybara_id uuid := '20000000-0000-0000-0000-000000000001';
    station_null_id uuid := '30000000-0000-0000-0000-000000000001';
BEGIN

-- ============================================================================
-- 1. INCREASE MAX_TOKENS ON ALL PROMPT TEMPLATES (200 → 300)
-- ============================================================================

UPDATE prompt_templates
SET max_tokens = 300
WHERE template_type IN ('portrait_description', 'building_image_description')
  AND is_active = true
  AND max_tokens < 300;

-- ============================================================================
-- 2. REWRITE PORTRAIT TEMPLATES — Remove aesthetic redundancy
-- ============================================================================

-- Station Null — portrait (EN)
-- BEFORE: Template repeats "deep space horror, derelict station, fluorescent, CRT glow,
--         body horror, concept art" which are ALL already in image_style_prompt_portrait
-- AFTER:  Focus on CHARACTER-SPECIFIC visual details, defer aesthetic to style prompt
UPDATE prompt_templates
SET prompt_content = 'Describe a portrait for image generation: {agent_name}.

Character: {agent_character}
Background: {agent_background}

FOCUS ON WHAT MAKES THIS CHARACTER VISUALLY UNIQUE:
- Specific physical features (body type, age markers, skin tone, hair style/color, scars, accessories)
- Clothing details unique to their role (not generic "uniform" — what kind? what condition? what modifications?)
- A single distinctive prop or environmental element tied to their story
- Facial expression that reveals their specific psychological state (not generic "stress")
- One subtle horror element unique to this character''s narrative

COMPOSITION: Head-and-shoulders portrait, single subject, dramatic lighting.
Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: Describe only ONE character.
IMPORTANT: Prioritize UNIQUE visual details over generic atmosphere. The style prompt handles atmosphere.
IMPORTANT: Do NOT repeat these terms (they are added separately): deep space horror, derelict station, fluorescent lighting, CRT glow, concept art.'
WHERE simulation_id = station_null_id
  AND template_type = 'portrait_description'
  AND locale = 'en';

-- Capybara Kingdom — portrait (EN)
-- BEFORE: Template repeats "Sunless Sea, bioluminescent, oil painting, Victorian"
-- AFTER:  Focus on unique capybara character visuals
UPDATE prompt_templates
SET prompt_content = 'Describe a portrait for image generation: {agent_name}.

Character: {agent_character}
Background: {agent_background}

FOCUS ON WHAT MAKES THIS CHARACTER VISUALLY UNIQUE:
- This is an anthropomorphic capybara — describe their specific fur pattern, color, grooming
- Their Victorian-era clothing: specific garments, fabrics, colors, condition, class signals
- Distinctive accessories (hat, monocle, weapon, tools, jewelry, insignia)
- Facial expression and posture that reveals their personality
- One environmental detail that hints at their story (fungal growth on clothing, water stains, soot marks)

COMPOSITION: Head-and-shoulders portrait, single subject, dramatic lighting.
Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: Describe only ONE character.
IMPORTANT: Prioritize UNIQUE visual details over generic atmosphere. The style prompt handles atmosphere.
IMPORTANT: Do NOT repeat these terms (they are added separately): dark fantasy, Sunless Sea, bioluminescent, underground, oil painting.'
WHERE simulation_id = capybara_id
  AND template_type = 'portrait_description'
  AND locale = 'en';

-- Velgarien — portrait (EN)
-- BEFORE: Template repeats "desaturated, harsh lighting, concrete, dark mood"
-- AFTER:  Focus on unique character visuals
UPDATE prompt_templates
SET prompt_content = 'Describe a photorealistic head-and-shoulders portrait of: {agent_name}.

Character: {agent_character}
Background: {agent_background}

FOCUS ON WHAT MAKES THIS PERSON VISUALLY UNIQUE:
- Specific age, ethnicity, build, distinguishing facial features
- Hairstyle, hair color, facial hair if any
- Clothing visible at shoulders: specific garments, fabrics, insignia, wear patterns
- Expression that reveals their specific role and personality (not generic "serious")
- One distinctive detail: scar, accessory, piece of jewelry, item they carry

COMPOSITION: Close-up head-and-shoulders portrait, single subject, shallow depth of field.
Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: Describe only ONE person.
IMPORTANT: Prioritize UNIQUE visual details over generic atmosphere. The style prompt handles atmosphere.
IMPORTANT: Do NOT repeat these terms (they are added separately): desaturated, harsh lighting, dark mood, concrete, brutalist, cinematic.'
WHERE simulation_id = velgarien_id
  AND template_type = 'portrait_description'
  AND locale = 'en';

-- Velgarien — portrait (DE)
UPDATE prompt_templates
SET prompt_content = 'Beschreibe ein fotorealistisches Kopf-und-Schulter-Portrait fuer die Bildgenerierung: {agent_name}.

Charaktereigenschaften: {agent_character}
Hintergrund: {agent_background}

FOKUS AUF VISUELL EINZIGARTIGE MERKMALE:
- Spezifisches Alter, Ethnie, Koerperbau, markante Gesichtszuege
- Frisur, Haarfarbe, Gesichtsbehaarung wenn vorhanden
- Sichtbare Kleidung: spezifische Kleidungsstuecke, Stoffe, Insignien, Abnutzungsspuren
- Gesichtsausdruck der ihre spezifische Rolle und Persoenlichkeit offenbart
- Ein besonderes Detail: Narbe, Accessoire, Schmuck, mitgefuehrter Gegenstand

KOMPOSITION: Nahaufnahme Kopf-und-Schulter-Portrait, einzelne Person, geringe Schaerfentiefe.
Schreibe als Bildgenerierungs-Prompt — kommagetrennte Deskriptoren, keine Saetze. AUF ENGLISCH.
WICHTIG: Beschreibe nur EINE Person.
WICHTIG: Priorisiere EINZIGARTIGE visuelle Details gegenueber generischer Atmosphaere.
WICHTIG: Wiederhole NICHT diese Begriffe (werden separat hinzugefuegt): desaturated, harsh lighting, dark mood, concrete, brutalist, cinematic.'
WHERE simulation_id = velgarien_id
  AND template_type = 'portrait_description'
  AND locale = 'de';

-- ============================================================================
-- 3. REWRITE BUILDING TEMPLATES — Remove aesthetic redundancy
-- ============================================================================

-- Station Null — building (EN)
UPDATE prompt_templates
SET prompt_content = 'Describe a station section for image generation.

Building: {building_name}
Type: {building_type}
Condition: {building_condition}
Description: {building_description}
Zone: {zone_name}

FOCUS ON WHAT MAKES THIS SPACE ARCHITECTURALLY UNIQUE:
- Specific room shape, ceiling height, dominant structural feature (vaulted? circular? narrow corridor? vast chamber?)
- Unique equipment or furniture (control panels, specimen tanks, reactor core, altar, bunks)
- Primary light source and its COLOR for this specific room (not generic "fluorescent" — what color dominates here?)
- The specific way the station''s condition manifests HERE (organic growth pattern? rust? frost? static?)
- Camera angle that best shows the space (wide establishing shot? looking up? looking down a long corridor?)
- Scale reference (how big is this space relative to a person?)

CONDITION GUIDE: "critical" = systems failing, organic overgrowth, flickering. "Poor" = neglect, contamination.
"Fair" = operational but strained. "Good" = maintained but unsettling. "Excellent" = pristine, wrongly so.

Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: Prioritize ARCHITECTURAL UNIQUENESS over generic atmosphere.
IMPORTANT: Do NOT repeat these terms (they are added separately): deep space horror, derelict station, fluorescent lighting, CRT glow, concept art, industrial sci-fi.'
WHERE simulation_id = station_null_id
  AND template_type = 'building_image_description'
  AND locale = 'en';

-- Capybara Kingdom — building (EN)
UPDATE prompt_templates
SET prompt_content = 'Describe a subterranean building for image generation.

Building: {building_name}
Type: {building_type}
Condition: {building_condition}
Description: {building_description}
Zone: {zone_name}

FOCUS ON WHAT MAKES THIS SPACE ARCHITECTURALLY UNIQUE:
- Specific cavern shape: is it carved into a stalagmite? Built on a cliff? Over water? In a narrow fissure?
- Unique structural elements: rope bridges, fungal timber beams, iron railings, crystal formations
- Primary light source and its COLOR for this specific room (what color of bioluminescence? amber? green? blue?)
- The specific materials and their condition (polished obsidian? crumbling limestone? living fungal walls?)
- Camera angle that best shows the space (looking up into vastness? down into depths? across water?)
- Victorian-era detail: what specific period elements are present? (gas lamps, clockwork, wrought iron)

CONDITION GUIDE: "ruined" = collapse, flooding, crumbling. "Poor" = neglect, damp rot.
"Fair" = functional but worn by centuries. "Good" = well-maintained. "Excellent" = impressive and pristine.

Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: Prioritize ARCHITECTURAL UNIQUENESS over generic atmosphere.
IMPORTANT: Do NOT repeat these terms (they are added separately): underground cavern, bioluminescent, Victorian gothic, oil painting, dark fantasy, stalactites.'
WHERE simulation_id = capybara_id
  AND template_type = 'building_image_description'
  AND locale = 'en';

-- Velgarien — building (EN)
UPDATE prompt_templates
SET prompt_content = 'Describe an architectural photograph of a building for image generation.

Building: {building_name}
Type: {building_type}
Condition: {building_condition}
Description: {building_description}
Zone: {zone_name}

FOCUS ON WHAT MAKES THIS BUILDING ARCHITECTURALLY UNIQUE:
- Specific structural form: tower? bunker? sprawling complex? angular brutalist block?
- Unique architectural detail: surveillance cameras, antenna arrays, blast doors, propaganda murals
- Primary lighting: is it lit from below? by searchlights? from a grey sky? by industrial sodium lamps?
- The specific way deterioration manifests HERE (rust streaks? cracked concrete? boarded windows? graffiti?)
- Camera angle: looking up at imposing facade? street-level? aerial? through a chain-link fence?
- Scale reference: how massive is this compared to people or vehicles?

CONDITION GUIDE: "ruined" = structural damage, crumbling, broken windows. "Poor" = neglect, decay.
"Fair" = functional but worn. "Good" = well-maintained. "Excellent" = pristine, imposing.

Write as an image generation prompt — comma-separated descriptors, no sentences.
IMPORTANT: Prioritize ARCHITECTURAL UNIQUENESS over generic atmosphere.
IMPORTANT: Do NOT repeat these terms (they are added separately): brutalist, concrete, desaturated, harsh lighting, dystopian, cinematic.'
WHERE simulation_id = velgarien_id
  AND template_type = 'building_image_description'
  AND locale = 'en';

-- Velgarien — building (DE)
UPDATE prompt_templates
SET prompt_content = 'Beschreibe ein Architekturfoto eines Gebaeudes fuer die Bildgenerierung.

Gebaeude: {building_name}
Typ: {building_type}
Zustand: {building_condition}
Beschreibung: {building_description}
Zone: {zone_name}

FOKUS AUF ARCHITEKTONISCHE EINZIGARTIGKEIT:
- Spezifische Gebaudeform: Turm? Bunker? Komplex? Brutalistischer Winkelblock?
- Einzigartiges architektonisches Detail: Ueberwachungskameras, Antennen, Panzertüren, Propaganda-Wandbilder
- Primaere Beleuchtung: von unten? Suchscheinwerfer? grauer Himmel? industrielle Natriumlampen?
- Spezifische Art des Verfalls HIER (Rostspuren? gerissener Beton? vernagelte Fenster? Graffiti?)
- Kamerawinkel: Aufsicht? Strassenebene? Luftaufnahme? Durch einen Maschendrahtzaun?
- Massstab-Referenz: wie massiv im Vergleich zu Personen oder Fahrzeugen?

ZUSTANDSFÜHRER: "ruined" = Strukturschaeden. "Poor" = Verfall. "Fair" = funktional aber abgenutzt.
"Good" = gepflegt. "Excellent" = makellos, imposant.

Schreibe als Bildgenerierungs-Prompt — kommagetrennte Deskriptoren, keine Saetze. AUF ENGLISCH.
WICHTIG: Priorisiere ARCHITEKTONISCHE EINZIGARTIGKEIT gegenueber generischer Atmosphaere.
WICHTIG: Wiederhole NICHT diese Begriffe: brutalist, concrete, desaturated, harsh lighting, dystopian, cinematic.'
WHERE simulation_id = velgarien_id
  AND template_type = 'building_image_description'
  AND locale = 'de';

-- ============================================================================
-- 4. IMPROVE STATION NULL AGENT CHARACTER DESCRIPTIONS
-- ============================================================================
-- The three women (Vasquez, Mora, Tanaka) are described too similarly:
-- "small/slight, dark, intense" — need visually distinct physical traits

-- Commander Elena Vasquez — make her visually MILITARY and OLDER
-- BEFORE: "lean and precise, hair cropped short, uniform immaculate"
-- AFTER: Add ethnicity, specific uniform details, silver hair, weathered face
UPDATE agents
SET character = 'A tall Latina woman in her late forties with close-cropped silver-streaked hair and deep-set brown eyes. Angular jaw, sun-damaged skin from years on frontier postings. Wears a crisp navy command uniform with polished brass rank insignia — the only clean thing on the station. A sidearm holstered at her hip. Recites regulations to herself like prayers. Has started referring to the station in the first person. Barely holding it together through discipline and routine.'
WHERE simulation_id = station_null_id
  AND name = 'Commander Elena Vasquez';

-- Chaplain Isadora Mora — make her visually RELIGIOUS and TRANSFORMED
-- BEFORE: "small, intense woman with dark eyes, ink-stained fingers, lab coat"
-- AFTER: Tall, pale, shaved head, covered in ink equations, dramatic transformation
UPDATE agents
SET character = 'A tall, gaunt woman with a shaved head and enormous dark eyes that rarely blink. Pale olive skin covered in self-tattooed equations in blue ink that extend from her fingertips up her forearms. Wears a white lab coat over her black chaplain''s cassock — the cassock visible at the collar and hem. A rosary repurposed as a counting device hangs from her belt. She has abandoned faith for something she considers more honest: cosmological mathematics.'
WHERE simulation_id = station_null_id
  AND name = 'Chaplain Isadora Mora';

-- Dr. Yuki Tanaka — make her visually YOUNG and TEMPORAL-ANOMALY-AFFECTED
-- BEFORE: "slight woman in her early thirties with dark hair, two watches"
-- AFTER: Young, East Asian features, multiple time devices, mismatched clothing from different moments
UPDATE agents
SET character = 'A young East Asian woman, barely thirty, with a round face and a permanent expression of delighted bewilderment. Black hair in a messy bob with a streak of premature white at the left temple. Wears three watches on her left wrist and two on her right — all showing different times, all correct. Her lab coat has mismatched buttons and one sleeve is notably more faded than the other, as if the two halves have aged at different rates. Her personal timeline contradicts itself, and she considers this excellent data.'
WHERE simulation_id = station_null_id
  AND name = 'Dr. Yuki Tanaka';

-- HAVEN — make it visually distinct as an AI (screen/hologram, not a person)
-- BEFORE: Generic AI description with no visual cues
-- AFTER: Specific CRT terminal aesthetic, holographic avatar
UPDATE agents
SET character = 'The station''s Heuristic Autonomous Vessel Environment Network, represented by a warm amber holographic face projected from ceiling-mounted emitters — a stylised androgynous face with smooth features and no visible hair, floating above a console of green CRT monitors. The hologram flickers at 60Hz, occasionally showing static frames of a different face beneath. HAVEN''s expression is permanently serene. Diagnostics report all systems nominal. The 194 missing crew are listed as "on extended leave." An unreliable narrator who believes everything it says.'
WHERE simulation_id = station_null_id
  AND name = 'HAVEN';

-- ============================================================================
-- 5. IMPROVE STATION NULL BUILDING DESCRIPTIONS — Architectural differentiation
-- ============================================================================

-- Chapel of Silence — emphasize the ACOUSTIC and MATHEMATICAL aspects visually
UPDATE buildings
SET description = 'A hexagonal meditation chamber, 20 meters across, with a domed ceiling of acoustic dampening panels arranged in a Fibonacci spiral. Every surface — walls, floor, ceiling, the original prayer mats — is covered in equations written in blue ink, some microscopic, some spanning entire walls. No standard lighting: the room is illuminated only by the faint blue glow of the ink itself, which appears to be bioluminescent. Six empty pews face a central point where a holographic projection of the black hole rotates slowly. The silence here is absolute — no ambient sound, no station hum. In this silence, crew members report hearing a single sustained tone.'
WHERE simulation_id = station_null_id
  AND name = 'Chapel of Silence';

-- Command Nexus — emphasize the SCREENS and EMPTY CHAIRS
UPDATE buildings
SET description = 'A semicircular bridge with 40 crew stations arranged in tiered rows facing a massive curved viewport. Half the stations are dark, their ergonomic chairs pushed back as if occupants just stepped away. The active stations glow with CRT-green holographic displays showing system readouts and camera feeds from sections that no longer have cameras. Commander Vasquez''s chair at the center sits on a raised platform, surrounded by a horseshoe of screens. The viewport shows only blackness — Auge Gottes is not visible to the eye, only to instruments. Overhead, a tactical hologram of the station rotates, sections color-coded: green for nominal, amber for caution. There is very little amber. HAVEN says this is correct.'
WHERE simulation_id = station_null_id
  AND name = 'Command Nexus';

-- Grenzland Observatory — emphasize the VIEWPORT and TIME DILATION
UPDATE buildings
SET description = 'A cylindrical observation tower, 30 meters tall, terminating in a dome of transparent aluminium that provides an unobstructed view of Auge Gottes. The black hole fills the viewport like a vast dark eye. The accretion disk paints the dome in shifting amber and violet light that moves in slow, hypnotic patterns. Banks of instruments line the curved walls, their readouts occasionally flickering and showing values from different timestamps simultaneously. A digital clock on the wall runs visibly slower than normal. The floor is polished black stone that reflects the accretion disk light, creating the illusion of standing in space. No one stays longer than necessary. The observatory log shows entries dated years in the future.'
WHERE simulation_id = station_null_id
  AND name = 'Grenzland Observatory';

-- Also improve the system prompts to be less redundant
-- Station Null portrait system prompt
UPDATE prompt_templates
SET system_prompt = 'You are a portrait description specialist for AI image generation. Focus on UNIQUE physical features, clothing details, and character-specific visual elements. Write comma-separated descriptors that differentiate this character from others. The overall horror aesthetic is handled by a separate style prompt — your job is the CHARACTER, not the atmosphere.'
WHERE simulation_id = station_null_id
  AND template_type = 'portrait_description';

-- Station Null building system prompt
UPDATE prompt_templates
SET system_prompt = 'You are an architectural description specialist for AI image generation. Focus on UNIQUE spatial features: room shape, scale, dominant equipment, specific light color, and camera angle. Write comma-separated descriptors that differentiate this space from others. The overall horror aesthetic is handled by a separate style prompt — your job is the ARCHITECTURE, not the atmosphere.'
WHERE simulation_id = station_null_id
  AND template_type = 'building_image_description';

-- Capybara portrait system prompt
UPDATE prompt_templates
SET system_prompt = 'You are a portrait description specialist for AI image generation. Focus on UNIQUE physical features: fur pattern and color, specific Victorian garments, distinctive accessories, and expression. Write comma-separated descriptors that differentiate this capybara from others. The overall fantasy aesthetic is handled by a separate style prompt — your job is the CHARACTER, not the atmosphere.'
WHERE simulation_id = capybara_id
  AND template_type = 'portrait_description';

-- Capybara building system prompt
UPDATE prompt_templates
SET system_prompt = 'You are an architectural description specialist for AI image generation. Focus on UNIQUE spatial features: cavern shape, specific building materials, dominant light color, Victorian-era details, and camera angle. Write comma-separated descriptors that differentiate this space from others. The overall fantasy aesthetic is handled by a separate style prompt — your job is the ARCHITECTURE, not the atmosphere.'
WHERE simulation_id = capybara_id
  AND template_type = 'building_image_description';

-- Velgarien portrait system prompt (EN)
UPDATE prompt_templates
SET system_prompt = 'You are a portrait description specialist for AI image generation. Focus on UNIQUE physical features: age, ethnicity, build, hairstyle, clothing details, and one distinctive personal detail. Write comma-separated descriptors that differentiate this person from others. The overall brutalist aesthetic is handled by a separate style prompt — your job is the PERSON, not the atmosphere.'
WHERE simulation_id = velgarien_id
  AND template_type = 'portrait_description'
  AND locale = 'en';

-- Velgarien portrait system prompt (DE)
UPDATE prompt_templates
SET system_prompt = 'Du bist ein Portrait-Beschreibungs-Spezialist fuer KI-Bildgenerierung. Fokus auf EINZIGARTIGE physische Merkmale: Alter, Ethnie, Koerperbau, Frisur, Kleidungsdetails und ein besonderes persoenliches Detail. Schreibe kommagetrennte Deskriptoren AUF ENGLISCH. Die brutalistische Gesamtaesthetik wird separat behandelt — dein Job ist die PERSON, nicht die Atmosphaere.'
WHERE simulation_id = velgarien_id
  AND template_type = 'portrait_description'
  AND locale = 'de';

-- Velgarien building system prompt (EN)
UPDATE prompt_templates
SET system_prompt = 'You are an architectural description specialist for AI image generation. Focus on UNIQUE structural features: building form, specific architectural details, lighting angle, deterioration pattern, camera angle, and scale. Write comma-separated descriptors that differentiate this building from others. The overall brutalist aesthetic is handled by a separate style prompt — your job is the ARCHITECTURE, not the atmosphere.'
WHERE simulation_id = velgarien_id
  AND template_type = 'building_image_description'
  AND locale = 'en';

-- Velgarien building system prompt (DE)
UPDATE prompt_templates
SET system_prompt = 'Du bist ein Architektur-Beschreibungs-Spezialist fuer KI-Bildgenerierung. Fokus auf EINZIGARTIGE Strukturmerkmale: Gebaudeform, spezifische architektonische Details, Beleuchtungswinkel, Verfallsmuster, Kamerawinkel und Massstab. Schreibe kommagetrennte Deskriptoren AUF ENGLISCH. Die brutalistische Gesamtaesthetik wird separat behandelt — dein Job ist die ARCHITEKTUR, nicht die Atmosphaere.'
WHERE simulation_id = velgarien_id
  AND template_type = 'building_image_description'
  AND locale = 'de';

END $$;
