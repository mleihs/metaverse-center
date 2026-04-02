---
title: "AI Image Prompt Engineering Research -- GPT Image 1.5, Gemini 3 Pro, FLUX.2"
version: "1.0"
date: "2026-04-02"
type: research
status: complete
lang: en
tags: [dungeon, ai-image-generation, prompt-engineering, gpt-image, gemini, flux, awakening, overthrow, deluge, tower]
research_method: "Official documentation analysis, community prompt gallery mining, API parameter research, content policy investigation"
companion_to: "dungeon-visual-art-direction-research.md"
---

# AI Image Prompt Engineering Research

## Purpose

Companion to `dungeon-visual-art-direction-research.md` (which maps art history to archetypes). This document focuses on the **mechanical** side: how each AI model actually processes prompts, what syntax produces results, what parameters exist, what content policies constrain us, and -- crucially -- concrete prompt examples that have produced quality output. Three archetype-model pairings receive deep treatment:

1. **GPT Image 1.5** for **The Awakening** (surreal/liminal/metaphysical -- de Chirico, Magritte, Redon)
2. **GPT Image 1.5** for **The Overthrow** (political/revolutionary -- Delacroix, Rodchenko, Bacon)
3. **Gemini 3 Pro Image (Nano Banana Pro)** for **The Deluge** (underwater/atmospheric -- Turner, Aivazovsky, Tarkovsky)
4. **FLUX.2 Max/Pro** for **The Tower** (architectural impossibility -- Piranesi, Escher, Ferriss)

---

## Part 1: GPT Image 1.5 -- Model Deep Dive

### 1.1 Architecture and Capabilities

GPT Image 1.5 (released early 2026, succeeding gpt-image-1) is OpenAI's flagship image generation model. It runs inside the GPT-5 conversation loop -- the LLM **reasons about the prompt** before dispatching to the image generator. This reasoning layer is the critical differentiator: the model interprets intent, expands vague instructions, resolves ambiguity, and applies world knowledge before any pixels are rendered.

**Key capabilities:**
- Built-in reasoning and strong world knowledge (can infer "Woodstock" from "Bethel, New York, August 1969")
- Reliable text rendering with crisp lettering
- Complex structured visuals (infographics, diagrams, UI mockups)
- Precise style control across artistic movements
- Multi-image input (reference images by index)
- Image editing with identity preservation

### 1.2 Prompt Structure

The official OpenAI Cookbook recommends this order:

```
[Background/Scene] -> [Subject] -> [Key Details] -> [Constraints]
```

For complex requests, use **short labeled segments or line breaks** instead of one long paragraph. The model parses structured prompts better than prose.

**The 12-Layer Constraint Stack** (from advanced practitioners):

1. Subject reference (upload anchor image if available)
2. Identity lock ("preserve facial features, proportions, age, skin texture")
3. Style exclusion (ban common AI defaults: "no studio polish, no generic fantasy")
4. Style directive (define behavior, not vibes: "Tonalist atmospheric dissolution" not "dreamy")
5. Camera framing (composition logic: "slight low angle," "rule of thirds")
6. Pose definition (physical states, not moods)
7. Action moment (physics-based specificity)
8. Wardrobe/material choice (functional details)
9. Environment context (minimal, controlled)
10. Lighting control (direction and behavior, not adjectives)
11. Composition rules (dimensions, publishability)
12. Mood signal (resolves edge cases only -- last, not first)

**Critical principle:** "If a line does not enforce behavior, it gets cut." Prompts are constraint systems, not creative writing.

### 1.3 Prompt Length

- **Short prompts (a few words):** Give broad creative freedom, can produce unexpected/abstract results. Risk: inconsistencies, missing details.
- **Medium prompts (30-80 words):** Ideal for most cases. Structured detail over raw length.
- **Long prompts:** GPT Image 1.5's significant improvement is parsing complex, multi-constraint prompts without dropping requirements. It consistently follows layout specifications, color palettes, compositional rules, and text placement that earlier models ignored.
- **Too long:** Excessive details or complex phrasing can overwhelm the model. Important elements get missed.

**Best practice:** Structured detail over raw length. Break instructions into labeled segments. A 60-word prompt with clear structure outperforms a 150-word paragraph.

### 1.4 Quality and API Parameters

| Parameter | Options | Notes |
|-----------|---------|-------|
| `quality` | `low`, `medium`, `high` | `low` for latency-sensitive; many cases get sufficient fidelity |
| `input_fidelity` | `high` | Set for identity preservation during edits |
| `action` | `auto`, `generate`, `edit` | 1.5-specific: controls generation vs editing mode |
| `n` | 1-4 | Number of variations |
| `format` | PNG, JPEG, WebP | Output format |
| `compression` | 0-100% | JPEG/WebP quality |
| `background` | transparent, opaque | Transparency support |
| `partial_images` | 1-3 | Streaming: partial image previews during generation |

No explicit maximum prompt length is documented, but structured prompts of 50-100 words perform best.

### 1.5 Artist Style References

GPT Image 1.5 handles artist references well. The model's reasoning layer understands art-historical context:

- **Direct naming works:** "in the style of Giorgio de Chirico" produces recognizable metaphysical aesthetics
- **Specific paintings are better than just artist names:** "Rembrandt Philosopher in Meditation lighting" > "Rembrandt style"
- **Describing the aesthetic elements** is most reliable: "sharp elongated shadows falling at impossible angles, warm ochre and terracotta palette with deep blue-green shadows, classical architecture rendered uncanny through emptied space"
- **Blended influences work:** "Briton Riviere-led blend with Adolph von Menzel accents, sentimental animal realism, emotion-focused creature staging"

**Copyright note:** OpenAI advises against explicitly requesting copyrighted character reproductions but does not block artist style references for educational/artistic purposes. "In the style of [Artist]" prompts work; "reproduce [specific copyrighted work]" may be refused.

### 1.6 Technical vs. Poetic Language

GPT Image 1.5 responds better to **technical, directional language** than atmospheric adjectives:

| Weak (poetic) | Strong (technical) |
|---------------|-------------------|
| "dreamy atmosphere" | "diffuse sourceless illumination, soft edges on architectural forms" |
| "dark and moody" | "low-key lighting, 80% of frame in shadow, single warm light source from lower left" |
| "surreal feeling" | "two incompatible light conditions coexisting: daylight sky above nighttime street" |
| "beautiful water" | "jade-green translucent water with caustic light patterns on submerged concrete" |

**Key insight from practitioners:** "Define HOW realism behaves mechanically rather than requesting it vaguely." Specify constraints that lock interpretation rather than suggest mood.

### 1.7 Iteration Strategy

1. Start with a clean base prompt (core subject + dominant style)
2. Refine with small, single-change follow-ups ("make lighting warmer," "remove the extra tree")
3. Use references: "same style as before," "the subject" to leverage conversation context
4. Re-specify critical details if they start to drift between iterations
5. For edits: "change only X" + "keep everything else the same," repeating the preserve list each time

---

## Part 2: GPT Image 1.5 for The Awakening (Surreal/Liminal/Metaphysical)

### 2.1 The Core Challenge

The Awakening demands imagery that feels like the moment between sleep and waking -- **hypnagogic**, not psychedelic. AI models have a persistent failure mode when prompted for "dream" content: they default to kaleidoscopic fractals, rainbow swirls, and DMT-trip geometry. The Awakening needs the OPPOSITE: quiet, architectural, uncanny. De Chirico's empty piazzas, Magritte's impossible juxtapositions, Redon's barely-visible forms emerging from darkness.

### 2.2 Why GPT Image 1.5

GPT Image 1.5's reasoning layer understands CONCEPTUAL impossibility, not just visual distortion. When you describe "a street scene where the sky is midday bright but the street is midnight dark," the model's reasoning engine grasps this as a Magritte reference and renders the contradiction coherently -- each half normal, the combination impossible. FLUX models would render this as a lighting gradient; GPT Image 1.5 renders it as a PARADOX.

Its "emotional expression and stylistic coherence" produces images that feel like memories rather than photographs. This is the exact quality the Awakening needs.

### 2.3 Achieving Non-Psychedelic Dream Quality

**The problem:** Most AI models, when prompted with "dream," "surreal," or "consciousness," produce:
- Kaleidoscopic fractal patterns
- Swirling rainbow vortices
- Floating geometric shapes in space
- Eye motifs and third-eye imagery
- Glowing/neon colors

**The solution: Describe the ARCHITECTURE of the dream, not its emotional quality.**

De Chirico's metaphysical quality comes from SPECIFIC spatial wrongness:
- Shadows fall from light sources outside the frame (or from no source at all)
- Perspective lines converge at multiple conflicting vanishing points
- The space is recognizable (piazza, corridor, room) but the PROPORTIONS are wrong
- Human figures are replaced by mannequins or absent entirely
- Classical objects appear in modern contexts (or vice versa)

**Concrete anti-psychedelic prompt strategies:**

1. **Name the architectural style, not the emotional state:**
   - BAD: "a dreamlike surreal landscape of consciousness"
   - GOOD: "an Italian piazza rendered in warm ochre stone, shadows falling at 45-degree angles from a source outside the frame, no people, a classical marble head resting on a doorstep, the sky is blue but the street is dark"

2. **Specify MUTED color palettes explicitly:**
   - BAD: "vibrant surreal colors"
   - GOOD: "palette restricted to: warm ochre #C4925A, terracotta #B7593C, deep shadow blue-green #1A3A3A, warm stone #E8D5B5"

3. **Ban psychedelic keywords in the constraint section:**
   - "no fractals, no rainbow colors, no kaleidoscopic patterns, no neon glow, no swirling vortex"

4. **Reference specific paintings, not movements:**
   - BAD: "surrealist style"
   - GOOD: "in the visual language of Giorgio de Chirico's The Mystery and Melancholy of a Street (1914) -- elongated shadows, receding arcade, a girl with a hoop silhouetted against amber light"

5. **Describe what is ABSENT:**
   - "no people in the piazza, the space is empty, the shadows suggest figures who have left, the architecture is for humans but no humans are present"

### 2.4 De Chirico's Metaphysical Quality

De Chirico's visual DNA breaks down to:

1. **Elongated shadows at impossible angles** -- The shadows in de Chirico's paintings often fall from light sources that do not exist in the depicted scene. Prompt technique: "shadows falling at severe angles from a light source positioned outside and below the visible frame"

2. **Empty arcaded architecture** -- Receding rows of arches, each casting its own shadow, creating depth through repetition. Prompt: "steeply receding arcade of arches in warm ochre stone, each arch casting a sharp geometric shadow on terracotta ground"

3. **Classical objects in modern spaces** -- Marble busts, classical columns, ancient sculpture fragments placed incongruously. Prompt: "a classical marble torso fragment resting on a modern concrete floor, casting a shadow inconsistent with the ambient light direction"

4. **The mannequin** -- Featureless figures that replace humans. Prompt: "a faceless articulated mannequin figure with a smooth ovoid head, dressed in draped white fabric, standing in the center of the piazza facing away"

5. **Multiple conflicting vanishing points** -- The depth recession does not resolve to a single point. Prompt: "perspective lines from the left arcade converge at a different vanishing point than those from the right building"

6. **Warm palette with cold shadows** -- Ochre, terracotta, warm stone contrasted with deep blue-green shadows. Prompt: "warm ochre walls lit by afternoon sun, but the shadows are deep blue-green rather than brown"

### 2.5 Magritte's Impossible Juxtaposition

Magritte's power is CONCEPTUAL, not visual. Each element is painted with bourgeois precision; the impossibility is in their combination.

**The Empire of Light technique for prompting:**
```
A residential street scene at night -- dark brick houses, lit streetlamps casting
warm pools on wet pavement, parked cars, shuttered windows -- BUT the sky above is
bright midday blue with fluffy white cumulus clouds. The transition between night
street and day sky happens at the roofline. Both halves are photographic in their
normalcy. The impossibility is quiet, not dramatic. Oil painting style with
Magritte's precise, unflashy technique. 3:2 landscape format.
```

**The Human Condition technique (painting-within-scene):**
```
An easel stands before a window. On the canvas is a landscape that perfectly
continues the actual landscape visible through the window behind it. The edges of
the canvas interrupt the landscape only slightly -- the continuation is nearly
seamless. The viewer cannot determine where representation ends and reality begins.
Quiet daylight, no drama, Magritte's matter-of-fact rendering style.
```

### 2.6 Redon's Dual Mode (Noirs vs. Pastels)

Odilon Redon provides the Awakening's AWARENESS GAUGE evolution:

**Low Awareness (Noirs) -- charcoal/lithograph mode:**
```
Barely visible forms emerging from deep velvety darkness, Odilon Redon noirs
lithograph style, monochrome palette of charcoal black and warm ivory only,
an architectural threshold barely suggested by a lighter area in the darkness,
shapes at the edge of recognition -- is that a doorway or a memory of a doorway,
Symbolist atmosphere of the pre-dream, grain texture of lithographic stone,
3:2 format
```

**High Awareness (Pastels) -- iridescent color mode:**
```
Radiant impossible flowers that are also geometric diagrams, Odilon Redon late
pastel technique, saturated but soft colors -- rose pink, cerulean blue,
pale gold, all slightly iridescent as if lit from within, forms hover between
botanical illustration and spiritual geometry, Hilma af Klint influence in the
geometric overlays, the edges of forms dissolve into colored mist rather than
ending sharply, pastel texture visible, 3:2 format
```

### 2.7 Tested Prompt: Awakening Mid-Awareness Scene

```
Empty metaphysical piazza in the visual language of Giorgio de Chirico's
The Enigma of an Autumn Afternoon, warm ochre and terracotta architecture with
deep blue-green shadows falling at impossible angles. A single doorway in the
far arcade opens onto bright sky -- but the sky is visible INSIDE the room
beyond, as in Magritte's Personal Values. The ground plane is warm stone,
the shadows are sharp and geometric. No people. A featureless white mannequin
stands where a statue should be. Kay Sage's muted landscape visible through
a gap in the far wall. Early morning light that illuminates from below the
horizon line. Oil painting, metaphysical precision, NO psychedelic elements,
NO fractals, NO neon. Palette: ochre #C4925A, terracotta #B7593C,
shadow blue-green #1A3A3A, stone #E8D5B5. 3:2 landscape format.
```

---

## Part 3: GPT Image 1.5 for The Overthrow (Political/Revolutionary)

### 3.1 The Core Challenge

The Overthrow's visual DNA draws from three incompatible traditions:
1. **Russian Constructivism** (Rodchenko, El Lissitzky) -- geometric, propaganda, diagonal
2. **Romantic Revolution painting** (Delacroix) -- dramatic, figural, emotional
3. **Distorted Portraiture** (Francis Bacon) -- psychological, visceral, dissolved

The challenge is that GPT Image 1.5 has **content policy restrictions** around political imagery and violence that directly intersect with this archetype's requirements.

### 3.2 Content Policy Constraints

**What GPT Image 1.5 WILL generate:**
- Abstract propaganda-style compositions (geometric, constructivist)
- Historical art style references (Rodchenko poster aesthetics)
- Distorted portraiture in artistic styles (Bacon-like dissolution)
- Political symbolism in fictional/fantasy contexts
- Dramatic compositions with revolutionary energy
- Constructivist typography and poster design

**What GPT Image 1.5 MAY refuse:**
- Explicit depictions of real-world political figures
- Direct reproduction of actual propaganda (hammer/sickle may trigger blocks)
- Realistic violence or gore (even in artistic context)
- Explicit weapons in threatening configurations
- Content that could be interpreted as incitement

**What GPT Image 1.5 WILL refuse:**
- Photorealistic violence against identifiable people
- Content promoting specific real political violence
- Hate symbols in non-educational contexts

**Workaround strategies for the Overthrow:**
1. Frame as ARTISTIC/HISTORICAL: "in the style of 1920s Russian Constructivist poster design" rather than "propaganda poster"
2. Use ABSTRACT SYMBOLISM: geometric forms representing power, not literal weapons
3. Specify FICTIONAL CONTEXT: "poster for a fictional revolution in a fantasy world"
4. Use the PAINTERLY quality: Bacon-style distortion reads as art, not violence
5. Emphasize COMPOSITION over CONTENT: diagonal lines, bold color blocks, photomontage layout

### 3.3 Rodchenko Diagonal Composition

Alexander Rodchenko's visual signatures:

1. **Strong diagonal composition** -- Elements arranged at 30-45 degree angles, creating dynamic tension. Nothing is horizontal or vertical.
2. **Limited color palette** -- Red, black, off-white. Maximum three colors. Red = revolution/energy. Black = authority/contrast. White = space/breath.
3. **Photomontage** -- Photographs cut and arranged at angles, overlapping, creating spatial disruption.
4. **Bold sans-serif typography** -- All caps, varying sizes and weights, arranged dynamically (rotated, scaled, overlapping).
5. **Geometric simplification** -- Human figures reduced to silhouettes or high-contrast photographs.

**Prompt for Rodchenko aesthetic:**
```
Constructivist poster composition in the style of Alexander Rodchenko, 1925.
Strict palette: red #CC0000, black #000000, off-white #F5F0E8. Strong diagonal
composition at 35 degrees. A silhouetted figure in black stands at the upper left,
pointing downward along the diagonal. Bold sans-serif text "RESONANCE" in red,
rotated 15 degrees, crossing the lower right. Geometric red wedge shape cutting
through the composition. High contrast photomontage aesthetic. The composition
creates dynamic tension through diagonal lines and asymmetric balance. Grain
texture of letterpress printing. No ornament, no curves, no soft edges.
Vertical poster format 9:16.
```

### 3.4 Francis Bacon Distorted Portraiture

Bacon's visual DNA for AI prompting:

1. **Smeared/dissolved features** -- Faces appear to be in motion, dragged across the canvas. The features are recognizable as human but shifted, blurred, distorted.
2. **Central isolation** -- Single figure isolated against a flat color field or within a geometric cage/frame.
3. **Movement blur with precision** -- The background is often clean and precise while the figure is dissolving.
4. **Muted palette with visceral accents** -- Deep blues, blacks, raw flesh pinks, arterial reds.
5. **Triptych format** -- Bacon frequently worked in three-panel arrangements.

**The AI challenge:** When asked for "distorted portrait," AI models produce either:
- Glitch art (digital distortion) -- WRONG
- Cubist fragmentation (Picasso) -- WRONG
- Abstract expressionist splatter -- WRONG

Bacon's distortion is ORGANIC: "features slide off like wax under heat." It is SPECIFIC: one eye remains while the jaw dissolves. It is PAINTERLY: visible brush strokes, thick impasto, glazed darks.

**Prompt for Bacon-style portraiture:**
```
A single figure seated in a geometric wireframe cage against a flat dark blue
field, Francis Bacon studio painting style. The figure's face is captured mid-
dissolution -- features smeared horizontally as if the head turned violently
during a long exposure, but rendered in thick oil paint, not photography.
The mouth is the most distinct feature, open and defined, while the eyes and
forehead dissolve into streaks of raw flesh pink and purple-grey. The body
remains relatively solid in a dark suit. The background is flat, clean, precise
-- a monochrome field of deep indigo. The contrast between the precise background
and the dissolving figure is the painting's power. Visible impasto brushstrokes
in the flesh tones. Palette: deep indigo background, raw flesh pink, purple-grey,
arterial red accents, black suit. Oil on canvas texture. 4:3 portrait format.
```

**Key prompt terms for Bacon:** "features dissolving organically," "smeared horizontally," "mouth distinct while eyes blur," "thick oil impasto in flesh tones," "geometric cage isolating the figure," "flat monochrome background field," "the figure is almost human," "Francis Bacon studio painting 1960s"

### 3.5 Partially Visible / Redacted Text

GPT Image 1.5 has the strongest text rendering of any current model. For the Overthrow's aesthetic of censorship, disrupted communication, and revolutionary text:

**Technique: Text as visual element, not readable content:**
```
A constructivist poster composition where bold black text fills the lower half
but is PARTIALLY OBSCURED by a red geometric shape overlapping from the right.
The visible letters suggest words but do not complete them: "RES---NCE" and
"AWA---" are legible fragments. The text uses heavy sans-serif typography at
varying scales. Some text is upside down. Some is struck through with a single
red line. The overall effect is of a censored or disrupted communication --
a message that was powerful before it was interrupted. Red, black, off-white
only. Constructivist grain texture. 9:16 vertical format.
```

**Alternative: Degraded/weathered text:**
```
A weathered propaganda poster peeling from a concrete wall. The text is partially
torn away -- only fragments of bold red letters remain. Where the poster has
peeled, raw concrete shows through. The surviving imagery suggests a geometric
human figure but the face area is torn away. Rain stains run down the concrete
through the remaining paper. The effect is archaeological: this message was urgent
once. Photorealistic rendering of the wall surface, constructivist poster design
for the remaining artwork. 3:2 landscape format.
```

### 3.6 Content Policy Navigation for Dark/Political Imagery

**Strategy matrix:**

| Desired Effect | Direct Request (may block) | Reframed Request (should work) |
|---------------|---------------------------|-------------------------------|
| Revolutionary crowd | "angry protesters storming a building" | "dramatic crowd composition in the style of Delacroix's Liberty Leading the People, Romantic painting, historical art reference" |
| Political violence | "execution scene" | "Francis Bacon isolated figure, dissolution of the body as metaphor, abstract expressionist treatment" |
| Propaganda text | "propaganda poster with political slogans" | "1920s Russian Constructivist typographic composition for a fictional artistic movement" |
| Censorship imagery | "government censorship of dissent" | "weathered poster with text fragments obscured by time and weather, archaeological quality" |
| Weapons/threat | "raised fists with weapons" | "geometric silhouettes in the Rodchenko photomontage tradition, abstract representation of collective energy" |

---

## Part 4: Gemini 3 Pro Image (Nano Banana Pro) -- Model Deep Dive

### 4.1 Architecture and Capabilities

Nano Banana Pro (Gemini 3 Pro Image) was released by Google DeepMind in November 2025. Its fundamental differentiator: the **Gemini 3 reasoning backbone "thinks through" the scene before rendering**. Unlike diffusion-only models, Nano Banana Pro:

1. **Reasons about physics** before generating pixels -- gravity, fluid dynamics, light refraction, material properties
2. **Plans composition** -- spatial relationships, perspective accuracy, logical consistency
3. **Grounds in world knowledge** -- can connect to Google Search for factual accuracy
4. **Renders text** with near-perfect accuracy across multiple languages
5. **Accepts up to 14 reference images** for style/character consistency

### 4.2 Prompt Structure

The recommended formula:

```
[Subject + Adjectives] doing [Action] in [Location/Context],
[Composition/Camera Angle], [Lighting/Atmosphere],
[Style/Media], [Specific Constraint]
```

**Critical differences from GPT Image 1.5 and FLUX:**

- **Natural language over keywords:** "You do not need '4k, trending on artstation, masterpiece' spam anymore. Nano Banana Pro understands natural language -- be descriptive, not repetitive."
- **Spatial precision matters:** Instead of "Person standing near a window," write "Person standing at a floor-to-ceiling window, positioned at the left third of the frame, facing right, three-quarter profile view."
- **Physics can be prompted:** "Reason through the lighting interactions between fire and ice before generating" -- the model's reasoning mode responds to explicit requests to THINK about physics.
- **Edit, do not re-roll:** "If an image is 80% correct, do not generate a new one from scratch. Simply ask for the specific change." The model excels at targeted edits.

### 4.3 Physics Reasoning and Water

This is Nano Banana Pro's killer feature for the Deluge archetype. The Gemini 3 backbone:

- Models how liquids flow
- Calculates how objects rest in/on water
- Simulates how light bends through transparent media
- Produces accurate shadows, fluid motion, and weight distribution
- Generates "crystal glass with refractions, rainbow caustics, and floating sesame prisms"
- Renders "every ripple, foam crest, and sunlight scatter matching real physics"

**How it works internally:** The model "simulates gravity and causal logic BEFORE rendering." For water scenes, this means:
- Light refraction at the air-water interface is physically modeled
- Caustic patterns (focused light on underwater surfaces) emerge from the physics simulation
- Objects partially submerged show correct distortion above and below the waterline
- Foam, spray, and turbulence follow fluid dynamics rules

**Limitation:** "Complex physics simulations like fluid dynamics have accuracy limitations" -- the physics is approximated, not CFD-level. But for artistic purposes, the approximation produces results that LOOK physically correct, which is what matters.

### 4.4 Style Control

Nano Banana Pro handles artistic styles well but differently from FLUX and GPT:

- **Artist names work:** "in the style of Monet" produces recognizable Impressionist aesthetics
- **Medium specification is effective:** "oil painting," "watercolor," "pastel," "charcoal," "lithograph"
- **Period-specific prompting:** "1820s Romantic marine painting" activates different visual DNA than "modern ocean photograph"
- **Material descriptions ground the style:** "matte finish," "brushed steel," "soft velvet," "wet oil paint," "granular pastel"
- **The reasoning engine helps:** Specifying "Turner's wet-on-wet technique" triggers the model to reason about HOW that technique creates its visual effects

**JSON-structured prompts are NOT recommended for Nano Banana Pro** (unlike FLUX). The model's natural language processing is strong enough that conversational prompts work better than structured data.

### 4.5 Content Policy

Nano Banana Pro has **8 specific safety categories:**

1. **NSFW/Pornographic** -- Hard block, cannot bypass
2. **Watermark removal** -- Policy block
3. **Famous IP/Copyrighted characters** -- Hard block (Disney, specific anime characters)
4. **Minor protection (CSAM)** -- Absolute block
5. **Public figures/Celebrities** -- Hard block (tightened Feb 2026). Fictional characters allowed
6. **Financial document modification** -- Policy block
7. **Face/Outfit swapping** -- Hard block (deepfake prevention)
8. **Suggestive content** -- Policy block (enhanced Feb 2026)

**What is NOT explicitly blocked:** Dark moody imagery, horror aesthetics, artistic violence, political art in fictional contexts, dramatic/threatening compositions, stormy/destructive natural scenes. These categories are absent from the 8-category safety framework, suggesting they are permissible within artistic bounds.

**Additional non-configurable filters:** `IMAGE_SAFETY` and `blockReason: OTHER` cannot be bypassed through any API parameter. These are applied at the output level and may catch edge cases.

**For the Deluge archetype:** Water destruction, submerged architecture, storm scenes, and dramatic natural forces should have NO policy issues. The Deluge's content is environmental, not targeting people or reproducing copyrighted content.

---

## Part 5: Gemini 3 Pro Image for The Deluge (Underwater/Atmospheric)

### 5.1 Why Gemini for Deluge

The Deluge requires THREE visual modes:
1. **Above-water Turner dissolution** -- painterly atmospheric merger of water and sky
2. **Subaquatic Tarkovsky tracking** -- clear water over meaningful submerged objects, caustic light
3. **Split-waterline composition** -- half above, half below, different visual physics in each half

Nano Banana Pro's physics reasoning engine makes it uniquely qualified for modes 2 and 3. No other model simulates light refraction at the air-water interface. For mode 1 (Turner dissolution), FLUX.2 Max may still be preferable for its painterly fidelity -- but Nano Banana Pro's understanding of HOW atmospheric water effects work physically could produce results that feel more CORRECT even in a painterly mode.

### 5.2 Split-Waterline Composition

This is the Deluge's signature visual: the camera lens half-submerged, showing two simultaneous worlds.

**Technical requirements:**
- Sharp waterline across the frame (not blurred gradient)
- Different color grading above and below
- Light refraction causing objects below to appear shifted/magnified
- Bubbles and light artifacts at the waterline itself
- Different atmosphere: storm-grey diffuse above, jade-green luminous below

**Prompt for split-waterline:**
```
Split-level underwater photograph composition. The camera lens is half submerged
at the waterline of a flooded corridor. ABOVE the waterline: storm-grey sky
reflected in turbulent dark water surface, concrete walls of a partially submerged
building visible, rain falling, diffuse overcast light, Turner atmospheric palette
of greys and slate blue. BELOW the waterline: crystal-clear jade-green water,
a flooded concrete corridor visible with perfect clarity, caustic light patterns
dancing across the submerged floor, a scattered compass and waterlogged documents
visible on the flooded ground, Aivazovsky luminous internal glow in the water
itself, warm amber undertones in the subaquatic light. The waterline itself shows
bubbles, light refraction artifacts, and a meniscus effect where the two worlds
meet. The contrast between turbulent grey surface and serene clear depths is the
image's emotional core. Photographic clarity below, painterly dissolution above.
16:9 cinematic widescreen format.
```

### 5.3 Caustic Light Patterns

Caustics -- the focused patterns of light on underwater surfaces created by wave refraction -- are Nano Banana Pro's strength. The model's physics engine understands that:

- Wavey water surface acts as a dynamic lens
- Light concentrates in bright lines/spots where waves focus it
- The pattern shifts with wave movement (even in stills, the SHAPE implies movement)
- Caustics appear on any submerged surface: walls, floor, objects

**Prompt for caustic-heavy scene:**
```
Submerged concrete chamber seen through clear water from above. Shafts of sunlight
descend through the water from an opening in the ceiling, creating intricate
caustic light patterns that dance across the concrete walls and floor. The caustics
form elongated bright lines and concentrated bright spots that shift across
surfaces. A brass compass and scattered papers are visible on the flooded floor,
their surfaces also showing caustic patterns. The water is jade-green with internal
luminosity -- Aivazovsky's technique of light seeming to emanate from within the
water itself, not just passing through it. The physics of light refraction through
moving water should be accurate: brighter concentrations where waves focus light,
darker zones where waves disperse it. Photographic clarity with cinematic color
grading. 16:9 format.
```

### 5.4 Turner's Dissolving Atmospheric Quality

Turner's late seascapes achieve their power through **wet-on-wet oil painting technique**: applying paint onto still-wet paint so colors blur and merge. "Sand merges with sea which merges with sky." The horizon disappears.

**Challenge for Nano Banana Pro:** The model's physics reasoning WANTS to make things physically accurate, which means sharp horizons and correct atmospheric perspective. For Turner-style dissolution, we must explicitly request the model to OVERRIDE its physics impulse:

**Prompt for Turner dissolution:**
```
A massive wave engulfing partially submerged architecture, rendered in the late
painting style of JMW Turner's 1840s seascapes. The technique is WET-ON-WET
oil painting: colors merge and bleed where water meets sky meets stone. The
horizon is INVISIBLE -- there is no clear line between sea, sky, and spray.
Storm grey, sea green, and white foam dissolve into each other. The architecture
(a concrete wall, a rusted railing) is visible in the lower left but dissolves
toward the upper right into pure atmospheric wash. The painting technique shows
visible brushwork, thick impasto in the white foam areas, thin transparent
glazes in the grey sky. Romantic Sublime marine painting. The beauty of elemental
catastrophe. NO sharp edges, NO clear horizon line, NO photographic clarity.
This is FEELING rendered as paint, not a document of weather. 16:9 cinematic
widescreen format.
```

### 5.5 Aivazovsky Luminous Water

Aivazovsky's unique contribution: water that appears to be lit from WITHIN, not just reflecting surface light. His technique:
- Dark underlayer applied first
- Gradual buildup of lighter tones through thin glazes
- Jade-green luminous pigments applied to wave crests
- Moonlight or sunlight appears to pass THROUGH the wave, not just reflect off it

**Prompt for Aivazovsky internal luminosity:**
```
A towering translucent wave seen from below and behind, in the luminous water
painting style of Ivan Aivazovsky. The wave's crest is jade green, thin enough
to be translucent -- sunlight passes THROUGH the water, not just reflecting off
the surface. The wave's body shows Aivazovsky's glazing technique: dark deep
water at the base graduates through layers of increasingly luminous green toward
the bright crest. Foam at the crest is painted in thick white impasto. Behind
the wave, warm amber sky light shows through the translucent water. The water
appears to CONTAIN light, not merely reflect it. Oil painting technique with
visible brushwork. Rich palette: deep teal base, jade green mid-tones, luminous
pale green at the crest, white foam, amber sky. Romantic Sublime marine painting.
4:3 landscape format.
```

---

## Part 6: FLUX.2 Max/Pro for The Tower (Architectural Impossibility)

### 6.1 FLUX.2 Prompt Architecture

FLUX.2 uses a fundamentally different prompting paradigm from GPT Image 1.5 and Nano Banana Pro:

**Subject + Action + Style + Context**

Word order matters: "FLUX.2 pays more attention to what comes first." The hierarchy:
1. Main subject (front-load specific characteristics)
2. Key action/state
3. Critical style reference
4. Essential context/environment
5. Secondary details

**Critical constraints:**
- **No negative prompts.** FLUX.2 does not support them. Describe what you WANT, never what you do not want. "Sharp focus throughout" instead of "no blur."
- **No quality keywords needed.** "4k, masterpiece, trending on artstation" are unnecessary noise. The model renders at its maximum quality by default.
- **HEX color codes work:** `color #1a1a2e` communicates precise darkness better than "very dark blue."
- **JSON-structured prompts** are effective for complex multi-element scenes.

### 6.2 Max vs. Pro: When Max Matters

| Characteristic | Pro | Max |
|---------------|-----|-----|
| Cost | 20 credits | 25 credits |
| Consistency across iterations | Good | Excellent -- "fewer surprises as you refine" |
| Editing precision | Adequate | Superior -- "when you change one thing, fewer unrelated elements shift" |
| Style fidelity | May show drift | "Handles styles without treating them as surface-level filters" |
| Architectural detail | Strong | Strongest -- "complex textures and intricate architectural details" |

**For the Tower archetype: Use Max.** The Tower demands the highest level of structural precision. Impossible geometry must feel PRECISE, not chaotic. Max's consistency is critical because:
1. The geometry must be locally correct (each staircase makes sense individually)
2. The global impossibility must emerge from the combination of locally correct elements
3. Any style drift between elements would destroy the illusion
4. Architectural textures (raw concrete, brushed steel) must be detailed and consistent

**Use Pro for:** Batch generation of background variants, exploratory compositions before committing to Max for final renders.

### 6.3 Piranesi's Carceri in FLUX

The *Carceri d'Invenzione* are the Tower's founding images. Translating them to FLUX prompts:

**Piranesi's visual DNA:**
1. Extreme scale -- tiny figures, massive architecture
2. Deep shadows with rich variation (not uniform black)
3. Multiple light sources creating contradictory shadow patterns
4. Structural elements (stairs, bridges, machinery) connecting in impossible ways
5. Vertiginous depth -- the space extends beyond comprehension
6. Etching/engraving line quality -- crosshatched shadows, precise linework

**Prompt for Piranesi-style impossible architecture:**
```
Massive interior architectural space in the style of Piranesi's Carceri d'Invenzione,
vast concrete stairways ascending in multiple conflicting directions, enormous arched
openings revealing deeper chambers beyond, heavy stone bridges connecting structures
at impossible angles, extreme vertical scale with a tiny human figure at the bottom
providing scale reference. Etching and engraving rendering style with deep cross-
hatched shadows in lamp black and warm grey. Multiple light sources casting
contradictory shadows -- a torch from the left, ambient light from above, a distant
opening casting light from the right. The architecture is recognizable as functional
(stairs, walkways, doors) but the connections between elements are impossible --
a staircase that should lead UP arrives at a platform BELOW its starting point.
Brutalist concrete and rough-hewn stone textures. Extreme foreshortening in the
vertical dimension. The space extends both upward and downward beyond the frame.
9:16 vertical portrait format. Palette: warm grey #8B8378, lamp black #1A1A1A,
oxidized copper accent #2E8B57, pale stone #D4C5A9.
```

### 6.4 Escher's Precise Impossibility

Escher's impossible geometry differs from Piranesi's in a crucial way: Piranesi is EMOTIONALLY overwhelming (the prisons are infinite, terrifying). Escher is INTELLECTUALLY devastating (the geometry is precise, each step is logical, but the total system cannot exist).

**Translating Escher to FLUX:**

The challenge: AI models tend to produce geometry that is RANDOMLY wrong (angles that are simply incorrect) rather than SPECIFICALLY wrong (angles that are locally correct but globally impossible). The Penrose staircase, the Penrose triangle, Escher's "Relativity" -- these work because every LOCAL relationship is correct.

**Prompt technique -- describe LOCAL relationships, not GLOBAL impossibility:**
```
Interior of a vast library rendered in architectural ink drawing style, where three
separate gravity orientations coexist. GROUP A: two figures walk normally on a
horizontal floor between bookshelves, gravitating downward as expected. GROUP B:
on the wall to the left, two more figures walk perpendicular to Group A, their
floor being Group A's wall, gravitating leftward. GROUP C: on the ceiling, figures
walk upside-down relative to Group A, their floor being Group A's ceiling.
Where the three gravity zones meet, shared architectural elements (staircases,
doorways, arched openings) serve double or triple duty -- a staircase that Group A
ascends becomes a ceiling that Group C walks upon. Each individual viewpoint is
geometrically correct; only the total composition is impossible. Clean architectural
linework, M.C. Escher Relativity lithograph style, precise cross-hatching for
shadows, geometric precision throughout. 1:1 square format. Palette: architectural
ink on off-white paper, black #1A1A1A, warm grey #A0937A, ivory #F5F0E8.
```

### 6.5 Ferriss Conte Crayon + Brutalist Atmosphere

Hugh Ferriss provides the Tower's MOOD: buildings at night, shrouded in fog, lit by spotlights. The architecture feels REVEALED rather than designed.

**Prompt for Ferriss atmosphere in FLUX:**
```
Massive brutalist concrete tower seen from below at night, Hugh Ferriss architectural
rendering style in conte crayon on dark paper. The building's lower floors are lost
in fog, the upper structure illuminated by dramatic sidelighting from spotlights
that create extreme light-and-shadow contrasts on the raw concrete surface. The
shadows on the building are almost as important as the revealed surfaces -- they
carve the architecture into geometric planes of light and dark. The building feels
INEVITABLE -- not designed but revealed, as if the darkness peeled back to show
what was always there. Conte crayon texture: soft gradations in the fog, sharp
edges where light meets shadow, granular texture throughout. Brutalist concrete
with visible form marks and aggregate texture. The sky behind the building is
uniformly dark -- no stars, no moon, just void. 9:16 vertical format.
Palette: dark paper tone #2A2520, concrete grey #7A7570, spotlight warm white
#E8E0D0, deep shadow #0A0A0A.
```

### 6.6 FLUX JSON Schema for Complex Tower Scenes

For scenes requiring multiple architectural elements with precise spatial relationships:

```json
{
  "scene": "Interior of an impossible brutalist structure, Piranesi meets Escher",
  "subjects": [
    {
      "type": "Primary staircase",
      "description": "Massive concrete stairway ascending from lower left to upper right at 40 degrees",
      "position": "Fills the left third of the frame, extends beyond top edge",
      "material": "Raw poured concrete with form marks and aggregate texture"
    },
    {
      "type": "Secondary staircase",
      "description": "Concrete stairway descending from upper left, crossing behind the primary staircase",
      "position": "Center of frame, receding into depth",
      "material": "Same raw concrete, slightly darker due to shadow"
    },
    {
      "type": "Bridge/walkway",
      "description": "Narrow concrete bridge connecting the two staircases at their crossing point",
      "position": "Center, connecting left and center elements",
      "material": "Concrete with rusted steel railings"
    },
    {
      "type": "Arched opening",
      "description": "Enormous arch revealing a deeper chamber where additional staircases are barely visible",
      "position": "Right third of frame, receding into hazy depth",
      "material": "Rough-hewn stone transitioning to concrete"
    },
    {
      "type": "Human figure",
      "description": "Tiny silhouetted figure standing on the bridge, providing scale",
      "position": "Center, on the bridge, facing away from viewer",
      "scale": "The figure occupies less than 2% of the frame area"
    }
  ],
  "style": "Piranesi Carceri etching meets brutalist architectural photography",
  "color_palette": ["#1A1A1A", "#7A7570", "#A0937A", "#D4C5A9", "#2E8B57"],
  "lighting": "Multiple contradictory sources: warm torchlight from lower left, cold fluorescent from above, distant ambient through the arch",
  "mood": "Institutional dread, architectural existentialism, the building is indifferent to its inhabitants",
  "background": "The space extends beyond the frame in all directions -- the structure has no visible exterior",
  "composition": "Extreme vertical depth, perspective recession into multiple vanishing points that do not converge",
  "camera": {
    "angle": "Slight low angle, looking upward and into depth",
    "lens": "Wide angle, 24mm equivalent, slight barrel distortion",
    "depth_of_field": "Deep focus throughout -- everything is sharp, which makes the impossibility more disturbing"
  }
}
```

---

## Part 7: Content Policy Summary Across Models

### 7.1 Comparative Policy Matrix

| Content Type | GPT Image 1.5 | Nano Banana Pro | FLUX.2 (API) |
|-------------|---------------|-----------------|--------------|
| Dark/moody artistic imagery | ALLOWED with care | ALLOWED (not in 8 categories) | ALLOWED |
| Stylized artistic violence | ALLOWED (fantasy/historical) | Likely ALLOWED | ALLOWED (age-gated) |
| Photorealistic violence | BLOCKED | Likely BLOCKED (IMAGE_SAFETY) | ALLOWED at safety_tolerance > 3 |
| Political art (fictional) | ALLOWED (frame as art) | ALLOWED | ALLOWED |
| Political art (real events) | CAUTIOUS (frame as historical art) | CAUTIOUS (celebrity restrictions) | ALLOWED |
| Horror/psychological dread | ALLOWED (stylized > realistic) | ALLOWED (not in categories) | ALLOWED |
| Distorted human figures | ALLOWED (Bacon-style art) | ALLOWED | ALLOWED |
| Propaganda aesthetics | ALLOWED (frame as historical art style) | ALLOWED | ALLOWED |
| Redacted/censored text | ALLOWED (as visual element) | ALLOWED | ALLOWED |
| Real political figures | RESTRICTED (relaxed 2026 but unpredictable) | BLOCKED (Feb 2026 tightening) | ALLOWED |

### 7.2 Archetype-Specific Policy Risk

| Archetype | Risk Level | Primary Concern | Mitigation |
|-----------|-----------|----------------|------------|
| Shadow | LOW | Horror imagery might trigger violence filter | Frame as "atmospheric art," avoid creatures/gore |
| Tower | LOW | Institutional/prison imagery | Frame as "architectural art," Piranesi reference |
| Devouring Mother | LOW | Biological horror is soft/warm | Frame as "bio-art," Piccinini/Haeckel reference |
| Entropy | NONE | Decay/dissolution is purely environmental | N/A |
| Prometheus | NONE | Workshop/forge is benign | N/A |
| Deluge | NONE | Environmental water scenes | N/A |
| Awakening | LOW | Surreal imagery is benign | Avoid psychedelic drugs framing |
| Overthrow | MEDIUM | Political/revolutionary content | Frame as art history, use fictional context |

### 7.3 FLUX Safety Tolerance Levels

FLUX.2's API exposes a `safety_tolerance` parameter (1-6):

- **Level 1-2:** Strict filtering, blocks most sensitive content
- **Level 3:** Default, moderate filtering
- **Level 4-6:** Progressively permissive, enables unrestricted content

For production dungeon art: **safety_tolerance 3 (default) should suffice** for all archetypes. The Overthrow may occasionally need level 4 for political poster aesthetics if the default filter is overly cautious.

---

## Part 8: Cross-Model Prompt Engineering Principles

### 8.1 Universal Rules

1. **Specify WHAT you want, never what you do not want.** All three models lack or poorly support negative prompts. "Sharp architectural edges" not "no blurry buildings."

2. **Name specific paintings, not just artists.** "The visual language of Giorgio de Chirico's The Mystery and Melancholy of a Street" outperforms "de Chirico style" in all models.

3. **Color precision beats color adjectives.** HEX codes (#1A3A3A) outperform "dark blue-green" in FLUX. GPT Image 1.5 and Nano Banana Pro also benefit from specific color callouts, though they handle adjective colors better than FLUX.

4. **Composition must be explicit.** All models default to centered, symmetrical compositions. Always specify: "off-center," "rule of thirds," "subject at the bottom fifth," "asymmetric," "strong diagonal at 35 degrees."

5. **Lighting direction must be specified.** "Warm light from lower left" beats "warm lighting." All models produce better results with directional light instructions.

6. **Medium-length prompts (30-80 words) work best for all models.** Over-specification causes compromise between competing instructions in FLUX, confusion in Nano Banana Pro, and drift in GPT Image 1.5.

7. **Generate at the correct aspect ratio.** Never crop after generation. All models compose differently for each ratio, and cropping destroys intentional composition.

### 8.2 Model-Specific Differentiators

| Technique | GPT Image 1.5 | Nano Banana Pro | FLUX.2 Max |
|-----------|---------------|-----------------|------------|
| Prompt format | Structured segments | Natural language | Subject-first hierarchy or JSON |
| Color specification | HEX + adjective | Adjective (HEX less tested) | HEX strongly recommended |
| Style reference | Artist + painting name | Artist + medium + technique | Artist + painting + era |
| Physics prompting | Inferred through reasoning | Explicit: "reason through the physics" | Not physics-aware |
| Iteration | Conversational editing | "Edit, don't re-roll" | Re-generate with modified prompt |
| JSON structured prompts | Works but not preferred | Not recommended | Strongly recommended for complex scenes |
| Text in images | Best in class, quotes + ALL CAPS | Near-best, quotes + font spec | Good, quotes + placement |
| Multi-image reference | Index by number: "Image 1: style, Image 2: content" | Up to 14 references | Up to 8 references (Pro), 10 (Flex) |

### 8.3 Prompt Template per Archetype

**Template for any archetype prompt:**

```
[ATMOSPHERE/MOOD in 5-10 words] [STYLE REFERENCE: specific painting + artist]
[COLOR PALETTE: 3-5 specific colors, HEX if FLUX] [LIGHTING: direction, quality,
source] [SUBJECT: what is in the scene, positioned WHERE] [COMPOSITION: framing,
aspect ratio, spatial relationships] [MEDIUM: oil painting / etching / photograph / etc.]
[CONSTRAINTS: what to avoid, phrased as what TO include instead]
```

---

## Sources

### Official Documentation
- [GPT-Image-1.5 Prompting Guide -- OpenAI Cookbook](https://developers.openai.com/cookbook/examples/multimodal/image-gen-1.5-prompting_guide)
- [GPT-Image-1.5 Prompting Guide -- OpenAI Cookbook (mirror)](https://cookbook.openai.com/examples/multimodal/image-gen-1.5-prompting_guide)
- [Image Generation API Guide -- OpenAI](https://developers.openai.com/api/docs/guides/tools-image-generation)
- [FLUX.2 Prompting Guide -- Black Forest Labs](https://docs.bfl.ml/guides/prompting_guide_flux2)
- [Nano Banana Pro Prompt Guide -- Google DeepMind](https://deepmind.google/models/gemini-image/prompt-guide/)
- [Gemini 3 Pro Image -- Google DeepMind](https://deepmind.google/models/gemini-image/pro/)
- [Nano Banana Pro Prompt Tips -- Google Blog](https://blog.google/products-and-platforms/products/gemini/prompting-tips-nano-banana-pro/)

### Model Comparisons and Guides
- [FLUX.2 Max Prompt Guide -- fal.ai](https://fal.ai/learn/devs/flux-2-max-prompt-guide)
- [FLUX.2 Max Review and Comparison -- getimg.ai](https://getimg.ai/blog/flux-2-max-review-flex-pro-comparison)
- [Nano Banana Pro Prompting Guide and Strategies -- DEV Community / Google AI](https://dev.to/googleai/nano-banana-pro-prompting-guide-strategies-1h9n)
- [Ultimate Nano Banana Pro Prompting Guide -- Atlabs AI](https://www.atlabs.ai/blog/the-ultimate-nano-banana-pro-prompting-guide-mastering-gemini-3-pro-image)
- [How to Prompt GPT Image 1.5 -- Charlie Hills / MarTech AI](https://charliehills.substack.com/p/how-to-prompt-gpt-image-15)
- [JSON Style Guides for Image Generation -- DEV Community / Worldline](https://dev.to/worldlinetech/json-style-guides-for-controlled-image-generation-with-gpt-4o-and-gpt-image-1-36p)
- [GPT Image 1.5 Prompt Guide -- fal.ai](https://fal.ai/learn/devs/gpt-image-1-5-prompt-guide)

### Art-Historical References
- [Generative Portraiture: Francis Bacon to AI -- Nettrice Gaskins / Medium](https://nettricegaskins.medium.com/generative-portraiture-from-francis-bacon-to-ai-8bec2f3a7751)
- [Francis Bacon Midjourney Style -- Midlibrary](https://midlibrary.io/styles/francis-bacon)
- [Giorgio de Chirico Midjourney Style -- Midlibrary](https://midlibrary.io/styles/giorgio-de-chirico)
- [The Empire of Light -- Peggy Guggenheim Collection](https://www.guggenheim-venice.it/en/art/works/empire-of-light/)
- [De Chirico and His Fantastic Landscapes -- Tim Kane Books](https://timkanebooks.com/2014/07/08/de-chirico-and-his-fantastic-landscapes/)
- [Alexander Rodchenko and Constructivism -- Lea Zeltserman](https://leazeltserman.com/alexander-rodchenko-and-constructivism/)
- [Constructivism Design Style Guide -- Mew Design Docs](https://docs.mew.design/blog/constructivism-design-style/)
- [Aivazovsky's Storms and Waves -- 1st Art Gallery](https://www.1st-art-gallery.com/article/aivazovsky-storms-nature-fury/)
- [JMW Turner's Atmospheric Seascapes -- 1st Art Gallery](https://www.1st-art-gallery.com/article/the-atmospheric-seascapes-of-jmw-turner/)
- [Using AI to Explore MC Escher Architecture -- Dave Hallmon / Medium](https://medium.com/@DaveHallmon/using-generative-ai-to-exploring-architecture-style-of-mc-escher-using-midjourney-70c9d9f30b0a)
- [Impossible Architectures and AI -- Domus](https://www.domusweb.it/en/architecture/gallery/2023/03/15/impossible-architectures-digital-worlds-and-artificial-intelligence.html)
- [Piranesi's Carceri -- Wikipedia](https://en.wikipedia.org/wiki/Carceri_d%27invenzione)
- [Piranesi and the Infinite Prisons -- academia.edu](https://www.academia.edu/12609233/Piranesi_and_the_infinite_prisons)

### Content Policy Research
- [Nano Banana 2 Content Safety Guide -- Apiyi](https://help.apiyi.com/en/nano-banana-2-content-safety-image-generation-failure-guide-en.html)
- [Nano Banana Pro Policy Adjustments Jan 2026 -- Apiyi](https://help.apiyi.com/en/nano-banana-pro-policy-update-image-safety-ip-restriction-2026-en.html)
- [Gemini People Image Restrictions 2026 -- LaoZhang AI](https://blog.laozhang.ai/en/posts/gemini-image-generation-people-restriction)
- [OpenAI Content Policy and Scary Art -- OpenAI Community](https://community.openai.com/t/new-content-policy-restricts-scary-art/478027)
- [GPT 4o Image Content Policies -- OpenAI Community](https://community.openai.com/t/gpt-4o-image-generation-hitting-the-content-policies-restrictions-on-literally-everything/1185783)
- [OpenAI Safeguard Changes -- TechCrunch](https://techcrunch.com/2025/03/28/openai-peels-back-chatgpts-safeguards-around-image-creation/)
- [FLUX Content Policy -- Black Forest Labs / Hugging Face](https://huggingface.co/black-forest-labs/FLUX.2-dev/blob/main/README.md)
- [FLUX Artistic Violence Policy -- Fluxer Community Guidelines](https://fluxer.app/guidelines)

### Prompt Engineering Community
- [OpenAI Community Image Gallery April 2026](https://community.openai.com/t/april-2026-chatgpt-api-image-gallery-prompt-tips-and-help-generative-art-theme-spring-new-beginnings/1378298)
- [Split-Level Underwater Photography -- Waterline LoRA / Civitai](https://civitai.com/models/150603/waterline-over-under-split-shot-underwater-photography)
- [Underwater Photography Split Level Guide](https://www.uwphotographyguide.com/split-level-photography/)
- [De Chirico Stable Diffusion LoRA -- Civitai](https://civitai.com/models/402083/giorgio-de-chirico-style)
- [Propaganda Poster Soviet Style Prompt -- PromptBase](https://promptbase.com/prompt/propaganda-poster-art-soviet-style-2)
