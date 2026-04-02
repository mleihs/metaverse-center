---
title: "Resonance Dungeons -- Visual Art Direction Research"
version: "1.0"
date: "2026-04-02"
type: research
status: complete
lang: en
tags: [dungeon, archetype, visual-art, ai-image-generation, art-direction, prompt-engineering]
research_method: "Art-historical analysis, AI model capability comparison, prompt engineering research"
---

# Resonance Dungeons -- Visual Art Direction Research

## Research Purpose

Art-historically informed visual language mapping for all 7 dungeon archetypes. Each archetype possesses unique literary DNA (documented in per-archetype literary research files). This document translates that literary DNA into **specific visual languages** -- art movements, reference painters, AI model recommendations, prompt techniques, and failure modes. The goal: NO archetype should look like "generic dark fantasy." Each must be visually distinguishable at a glance, rooted in real art history, and achievable with current AI image generation models.

### AI Model Landscape (April 2026)

| Model | Elo Rating | Primary Strength | Weakness |
|-------|-----------|-----------------|----------|
| FLUX.2 Max | ~1265 | Style fidelity, compositional control, painterly range | No negative prompts; premium cost |
| FLUX.2 Pro | ~1265 | Production-grade balance of quality/cost | Slight painterly drift in photorealism |
| GPT Image 1.5 | ~1264 | Emotional expression, stylistic transformation, organic scenes | Photorealism bias; less compositional control |
| Gemini 3 Pro Image | ~1252 | Reasoning-based generation, text rendering, technical accuracy | Not exceptional for purely aesthetic generation |
| Seedream 4.5 | ~1147 | Text rendering, multi-image consistency, style transformation | Treats style as surface treatment; less expressive |

**Key principle:** No single model is best for all archetypes. The visual language of each archetype demands different strengths.

---

## 1. THE SHADOW

**Literary DNA:** Lovecraft, VanderMeer, Poe
**Resonance signature:** `cosmic_dread`
**Core mood:** Cosmic horror, environmental dread, absence as presence, ontological darkness

### Art-Historical Mapping

**Primary movement:** Symbolism (1880s-1910s) + Tonalism (1870s-1900s)

The Shadow's literary DNA is about SUGGESTED horror -- what the instruments fail to read, what the eye cannot resolve. This is not the explicit grotesquery of Goya's Black Paintings or Giger's biomechanics. The correct visual precedent is **Tonalism**: the American painting movement (George Inness, James McNeill Whistler) where landscapes dissolve into atmospheric murk, where the subject is less important than the mood enveloping it.

**Primary reference painters:**

1. **Zdzislaw Beksinski** (1929-2005) -- The master of suggested cosmic horror. Beksinski's "Fantastic Period" paintings show environments that feel photographed from nightmares: architecture that should not exist, figures that are almost recognizable, skies that contain the wrong things. Critically, Beksinski refused to title his works or explain symbolism: "Meaning is meaningless to me." This refusal to resolve is the Shadow's visual core. His work appeared on Barnes & Noble editions of Lovecraft's *At the Mountains of Madness*.

2. **Caspar David Friedrich** (1774-1840) -- Specifically *The Monk by the Sea* (1810) and *Abbey in the Oakwood* (1810). Friedrich's Ruckenfigur technique places a small human figure facing away from the viewer, gazing into overwhelming landscape. The figure functions as a scale indicator for the sublime. In the Shadow archetype, the vastness is not mountains but VOID.

3. **James McNeill Whistler** (1834-1903) -- His *Nocturnes* series (1866-1880s), especially *Nocturne in Black and Gold: The Falling Rocket* (1875). Whistler reduced landscape to near-abstraction through atmosphere alone. John Ruskin attacked these paintings for "flinging a pot of paint in the public's face" -- the outrage was precisely because the paintings showed almost nothing, yet demanded contemplation of that nothing.

4. **John Martin** (1789-1854) -- *Pandemonium* (1841) and *The Great Day of His Wrath* (1851-53). Martin used architectural scale to dwarf humanity: vast hellscapes where tiny figures emphasize the colossal indifference of the environment. His compositions feature extreme depth recession into darkness.

**Secondary references:** Arnold Bocklin (*Isle of the Dead*), Victor Hugo's ink wash drawings, Gustave Dore's illustrations for Dante's *Inferno* (the cavernous empty spaces between figures).

### AI Model Recommendation

**Primary: FLUX.2 Max**

FLUX.2 Max excels at maintaining atmospheric consistency across iterations and handles style references without treating them as surface-level filters. For the Shadow, compositional CONTROL is paramount -- the image must show mostly darkness with carefully placed details. GPT Image 1.5's photorealism bias would over-reveal; the Shadow needs mystery. FLUX.2 Max's strongest prompt following ensures the darkness stays vast and the details stay minimal.

**Fallback: FLUX.2 Pro** (for batch generation at lower cost; same architecture, slightly less consistent at holding extreme atmosphere).

### Visual Specifications

| Parameter | Specification |
|-----------|--------------|
| **Aspect ratio** | 16:9 horizontal (emphasizes vastness; the horizon extends beyond comprehension) |
| **Abstraction level** | Semi-abstract to abstract. Representational elements (corridors, instruments, figures) should dissolve at edges into undifferentiated darkness |
| **Color temperature** | Cold. Desaturated blue-blacks, deep indigo, occasional sickly green-grey. NO warm tones except as a single, distant, failing light source |
| **Palette** | Prussian blue, lamp black, Payne's grey, viridian (sparingly). Accent: a single point of amber or pale yellow (the one light that is about to fail) |
| **Style** | Painterly trending toward atmospheric abstraction. Think Whistler's Nocturnes, not photographic. Oil-paint texture visible |
| **Lighting** | Crepuscular. Light sources are failing, distant, or wrong. Bioluminescence as the only illumination in deep areas |

### Prompt Architecture

**Lead with atmosphere, not subject:**
```
Vast underground chamber dissolving into absolute darkness, Tonalist painting style,
Payne's grey and Prussian blue palette, a single amber instrument light failing in
the far distance, the ceiling is not visible, walls recede into formless murk,
Whistler Nocturne atmosphere, oil painting texture, no visible figures, the emptiness
IS the subject, 16:9 cinematic composition
```

**Key prompt terms:** "dissolving into darkness," "formless murk," "failing light," "Tonalist atmosphere," "Prussian blue and lamp black," "the emptiness is the subject," "Beksinski dreamlike architecture," "no sharp edges"

**Critical technique:** Describe what is NOT there. "The ceiling is not visible" forces the model to leave the upper portion dark. "No sharp edges" prevents the model from resolving forms that should remain ambiguous.

### What Does NOT Work

- **Explicit monsters or creatures.** The Shadow's horror is environmental, not figural. AI models default to generating creatures when given horror prompts. Fight this aggressively.
- **High contrast.** Models tend to add dramatic spotlight effects. The Shadow needs LOW contrast: everything is dark, with subtle variation within the darkness.
- **Red or warm-toned lighting.** Reads as "hell" or "lava," which is The Prometheus's territory. The Shadow is COLD void.
- **Fog/mist as a lazy atmosphere.** AI defaults to volumetric fog when asked for atmosphere. The Shadow's atmosphere should feel like vacuum, not moisture.
- **Centered composition.** The subject (if any) should be small, off-center, dwarfed. AI defaults to centered subjects; explicitly request off-center or rule-of-thirds placement.
- **Photographic rendering.** Makes the darkness look like an underexposed photo rather than ontological void.

---

## 2. THE TOWER

**Literary DNA:** Kafka, Ballard, Borges, Danielewski, Piranesi
**Resonance signature:** `systemic_collapse`
**Core mood:** Architectural existentialism, bureaucratic dread, impossible geometry, the building as character

### Art-Historical Mapping

**Primary movement:** Carceri tradition (Piranesi, 1745-1761) + Brutalist photography + Expressionist architecture

The Tower's literary DNA is about SYSTEMS -- buildings, bureaucracies, geometries that operate without caring about their inhabitants. This is not gothic horror architecture (pointed arches, cobwebs). It is INSTITUTIONAL architecture made alien: Kafka's labyrinthine courts, Ballard's high-rise, Danielewski's House of Leaves where internal dimensions exceed external ones.

**Primary reference painters/artists:**

1. **Giovanni Battista Piranesi** (1720-1778) -- The *Carceri d'Invenzione* (Imaginary Prisons) are the archetype's founding images. Sixteen etchings of "enormous subterranean vaults with stairs and mighty machines." In the second edition, Piranesi deliberately introduced impossible geometries: staircases that connect to nothing, perspectives with false vanishing points, exaggerated foreshortening that makes the viewer dizzy. The figures are tiny, the architecture infinite. The prisons are not for specific prisoners -- they are prisons as CONCEPT.

2. **Hugh Ferriss** (1889-1962) -- The "architectural delineator" who drew *The Metropolis of Tomorrow* (1929) in conte crayon. Ferriss presented buildings at night, shrouded in fog, lit by spotlights: "The shadows cast by and on the building became almost as important as the revealed surfaces." His drawings influenced Gotham City and BioShock's Rapture. Ferriss makes architecture feel INEVITABLE -- not designed but revealed, as if the darkness peeled back to show what was always there.

3. **M.C. Escher** (1898-1972) -- Specifically *Relativity* (1953) and *Ascending and Descending* (1960). Escher's impossible geometries are PRECISE: they work locally (each staircase makes sense) but fail globally (the total system is impossible). This precision-in-impossibility is the Tower's visual signature. Where Piranesi's prisons are emotionally overwhelming, Escher's are intellectually devastating.

4. **Lebbeus Woods** (1940-2012) -- Visionary architect who drew radical, unbuildable structures: parasitic architecture, war-damaged buildings regenerating with technological organs. His drawings feel like architectural fever dreams -- precise linework depicting impossible structural interventions.

**Secondary references:** Constant Nieuwenhuys's *New Babylon* project, Daniel Libeskind's early drawings, the concrete brutalism of Erno Goldfinger and Denys Lasdun (photographed by Simon Phipps and Rory Gardiner).

### AI Model Recommendation

**Primary: FLUX.2 Max**

Architectural precision demands the strongest prompt-following available. FLUX.2 Max "excels in rendering complex textures and intricate architectural details" with compositional control that holds geometry stable. For the Tower, the impossible geometry must feel PRECISE, not chaotic -- the AI must maintain structural logic locally while the total composition fails logically. FLUX.2 Max's architecture training data is strong, and its ability to handle painterly references alongside structural precision makes it ideal.

**Alternative: Gemini 3 Pro Image** -- Its reasoning-based approach handles spatial logic well, which can paradoxically help generate CONTROLLED impossibility (the model understands what geometry SHOULD look like, so violations read as intentional).

### Visual Specifications

| Parameter | Specification |
|-----------|--------------|
| **Aspect ratio** | 9:16 vertical (emphasizes impossible height; corridors that extend upward beyond the frame) OR 2:3 portrait |
| **Abstraction level** | Representational with geometric distortion. The architecture should be recognizable as architecture but WRONG -- angles that do not quite resolve, perspectives that shift mid-image |
| **Color temperature** | Cool-to-neutral. Concrete grey, institutional green, fluorescent white. Desaturated but not colorless |
| **Palette** | Raw concrete grey, institutional green-grey, pale fluorescent white, oxidized copper, graphite black. NO warm earth tones |
| **Style** | Mixed: etching/engraving quality (Piranesi linework) blended with architectural rendering. Conte crayon texture (Ferriss). Sharp lines, deep shadows |
| **Lighting** | Harsh, institutional, unforgiving. Fluorescent overhead OR dramatic sidelighting that creates extreme depth through shadow. Multiple conflicting light sources that make the geometry feel MORE impossible |

### Prompt Architecture

```
Impossible interior architecture in the style of Piranesi's Carceri d'Invenzione,
massive concrete stairways ascending in conflicting directions, brutalist construction
with raw aggregate surfaces, institutional fluorescent lighting casting multiple
contradictory shadows, Hugh Ferriss conte crayon rendering style, extreme vertical
perspective looking upward into infinite recession, tiny human figure at bottom for
scale, 9:16 portrait format, graphite and pale green palette, etching texture,
geometric precision that fails at the global level
```

**Key prompt terms:** "Piranesi Carceri," "impossible staircase," "brutalist concrete," "institutional fluorescent," "extreme vertical perspective," "infinite recession," "conte crayon rendering," "Hugh Ferriss shadow style," "conflicting vanishing points"

### What Does NOT Work

- **Gothic architecture.** Pointed arches, flying buttresses, gargoyles -- this reads as fantasy castle, not bureaucratic nightmare. The Tower is MODERN institutional, not medieval.
- **Ruins.** The Tower is not decayed (that is The Entropy). The Tower is FUNCTIONING but inhuman. The bureaucracy works perfectly; it just does not work for YOU.
- **Photographic realism.** Makes impossible geometry look like a rendering error rather than existential dread. The etching/drawing quality preserves the intentionality.
- **Warm lighting.** Candlelight, torches, fire -- these humanize the space. The Tower must feel LIT BY THE SYSTEM: fluorescent, cold, impersonal.
- **Symmetry.** AI defaults to symmetrical architectural compositions. The Tower needs asymmetric compositions where the viewer feels lost, not centered.
- **Decoration or ornament.** The Tower is bare. Raw concrete. Exposed pipes. Function without beauty. Any decorative element softens the bureaucratic horror.

---

## 3. THE DEVOURING MOTHER

**Literary DNA:** Butler, Jackson, Lispector, Han Kang, Carrington
**Resonance signature:** `biological_tide`
**Core mood:** Parasitic tenderness, biological horror through WARMTH, comfort as trap

### Art-Historical Mapping

**Primary movement:** Bio-Art (1990s-present) + Surrealist feminine tradition (Carrington, Varo) + Art Nouveau biological illustration

The Devouring Mother's critical distinction: the horror is in the GENTLENESS. Not Giger's cold biomechanics, not Cronenberg's surgical sterility. This archetype requires the visual language of WARMTH that has become pathological -- a womb that will not release, growth that suffocates, tenderness that consumes. The visual precedent is not horror art but rather BIOLOGICAL BEAUTY pushed past comfort.

**Primary reference painters/artists:**

1. **Patricia Piccinini** (born 1965) -- The definitive bio-art reference. Piccinini's hyper-realistic silicone sculptures depict human-animal hybrids that are simultaneously grotesque and heartbreakingly tender. *The Young Family* (2002-03) shows a human-sow nursing hybrid offspring. The horror is not in the deformity but in the unmistakable CARE the figures show. Piccinini uses "realistic textures, expressive body posture, warm colour palettes, and intimate compositions." This is the Devouring Mother's visual signature: warmth that is wrong.

2. **Ernst Haeckel** (1834-1919) -- *Kunstformen der Natur* (Art Forms in Nature, 1899-1904). One hundred lithographic plates of radiolaria, jellyfish, sea anemones, orchids -- biological forms rendered with scientific precision but composed with Art Nouveau decorative elegance. Haeckel makes biology look like architecture, like decoration, like ART. In the Devouring Mother, this beauty is the trap: the environment is gorgeous because it is ALIVE and it wants you to stay.

3. **Leonora Carrington** (1917-2011) -- Carrington's surrealist paintings explore biological transformation through a feminine lens: "She understood the alchemical potential of the body." Her egg symbolism, her "inner bestiary" of hybrid creatures, her vision of fertility as both creative and destructive force. Carrington paints metamorphosis as INTIMATE rather than traumatic -- the body changes, but the change feels like it was always coming.

4. **Remedios Varo** (1908-1963) -- Varo's meticulous, manuscript-illumination style paintings depict figures navigating architectural spaces filled with biological and alchemical processes. Her technique -- "short, precise applications of paint, creating a finely cross-hatched texture that lent her works an otherworldly luminosity" -- gives biological horror the quality of a sacred text. The Devouring Mother's environment should feel CONSECRATED, not clinical.

**Secondary references:** Hannah Hoch's botanical photomontages, Georgia O'Keeffe's flower paintings (biological intimacy at overwhelming scale), Hilma af Klint's biomorphic abstractions (organic forms as spiritual diagrams).

### AI Model Recommendation

**Primary: GPT Image 1.5**

GPT Image 1.5 "approaches style as fundamental transformation, prioritizing expression and interpretation." For the Devouring Mother, emotional expression matters more than structural precision. The horror is FELT, not deduced. GPT Image 1.5 excels at "organic and natural scenes with naturalistic color grading and emotional color palettes" -- exactly the warm, living, uncomfortably intimate aesthetic this archetype demands. Its tendency toward naturalistic rendering actually helps: the biological elements should look REAL enough to be viscerally uncomfortable.

**Alternative: Seedream 4.5** -- For scenes requiring multi-image consistency (the environment's biological evolution across rooms). Seedream's "style consistency across multiple related images" could maintain the organic palette as the environment grows more engulfing.

### Visual Specifications

| Parameter | Specification |
|-----------|--------------|
| **Aspect ratio** | 4:3 or 1:1 square (intimate, enclosed framing that makes the viewer feel held/trapped; no escape through wide margins) |
| **Abstraction level** | Semi-representational. Biological forms should be recognizable (tendrils, membranes, vascular networks) but composed into patterns that read as decorative -- Art Nouveau composition with organic horror content |
| **Color temperature** | WARM. This is critical. Ambers, flesh tones, rose pinks, deep magentas. The warmth itself is the horror |
| **Palette** | Rose pink, amber, deep magenta, cream, coral, warm terracotta, arterial red (sparingly). Bioluminescent cyan as accent (the one cool note in a warm trap). NO cold greys, NO black |
| **Style** | Painterly with biological-illustration precision. Think Haeckel's lithographic plates meets Carrington's surrealist intimacy. Visible brushwork but precise anatomical forms |
| **Lighting** | Warm, diffuse, womb-like. Bioluminescence from within the organic matter itself. NO harsh shadows (that implies threat; the Mother does not threaten, she embraces) |

### Prompt Architecture

```
Intimate biological interior space in the style of Ernst Haeckel's Kunstformen der
Natur, warm amber and rose pink bioluminescent lighting emanating from living walls,
Art Nouveau organic patterns that are actually vascular networks, Leonora Carrington
surrealist biological tenderness, everything is growing and warm and alive and too
close, membrane-thin translucent walls showing pulsing light behind them, no harsh
shadows, the space feels like being inside a living organism that cares for you,
1:1 square format, warm palette only
```

**Key prompt terms:** "bioluminescent warmth," "organic Art Nouveau patterns," "Haeckel biological illustration," "living walls," "vascular patterns," "warm amber and rose," "Carrington surrealist biology," "intimate not threatening," "womb-like space," "the growth is beautiful"

### What Does NOT Work

- **H.R. Giger's aesthetic.** Giger is COLD biomechanics: dark, metallic, sexually threatening. The Devouring Mother is WARM biomechanics: organic, maternal, suffocatingly tender. This is the single most important visual distinction.
- **Dark color palettes.** Darkness implies threat. The Devouring Mother threatens through EXCESS OF LIGHT AND WARMTH. Keep the palette warm and bright.
- **Clinical/surgical imagery.** Operating rooms, scalpels, sterile environments -- these are Cronenbergian body horror. The Mother's horror is that there is no scalpel; you are already inside her.
- **Teeth, claws, or aggressive biology.** The Devouring Mother does not bite. She HOLDS. Tendrils, not talons. Membranes, not teeth. Roots, not claws.
- **Symmetrical composition.** The organic growth should feel ORGANIC: asymmetric, sprawling, reaching. AI tends to create symmetrical biological patterns; fight this.
- **Alien/sci-fi biology.** This should look terrestrial -- like coral, like mushrooms, like the inside of a fig. Familiar biology made intimate, not alien biology made threatening.

---

## 4. THE ENTROPY

**Literary DNA:** Pynchon, Beckett, Lem, Bernhard
**Resonance signature:** `equalization`
**Core mood:** Dissolution, sameness as horror, thermodynamic death, things winding down

### Art-Historical Mapping

**Primary movement:** Post-War Material Art (Kiefer, Tapies) + Wabi-sabi aesthetic tradition + Late Tarkovsky cinematography

The Entropy's critical distinction: decay is NOT destruction. It is EQUALIZATION. Everything is becoming the same temperature, the same color, the same level of existence. The visual precedent is not apocalypse but rather the moment AFTER apocalypse when the rubble has settled and the dust covers everything equally. The beauty is in the fading, not the explosion.

**Primary reference painters/artists:**

1. **Anselm Kiefer** (born 1945) -- The supreme painter of beautiful decay. Kiefer incorporates lead, ash, straw, clay, and shellac into his paintings, materials that are "bound to mutate." His works continue to decay after completion, embracing "loss of control" as part of the artwork. Lead is central: Kiefer described it as "the only material heavy enough to carry the weight of human history." The Entropy dungeon's visual language should feel like a Kiefer painting: layered, heavy, decomposing, and somehow magnificent in its decomposition.

2. **Andrei Tarkovsky** (1932-1986) -- Specifically the Zone sequences in *Stalker* (1979) and the Italian decay sequences in *Nostalghia* (1983). Tarkovsky's color philosophy: "colour needed to be expressive rather than descriptive." In *Stalker*, the world outside the Zone is rendered in high-contrast sepia (urban decay), while the Zone itself bursts into muted, lush color -- "green grass, brown earth, embers of fire." The Zone's decay is BEAUTIFUL: rusting machinery, crumbling buildings, water seeping through everything. This is the Entropy: not ugly decay, but decay as the world returning to a more authentic state.

3. **Gerhard Richter** (born 1932) -- Specifically his blurred photo-paintings and overpainted photographs. Richter's signature technique: dragging a squeegee across wet paint, "obliterating, concealing and distorting what lies beneath." He stated: "I blur things to make everything equally important and unimportant." This is ENTROPY AS VISUAL TECHNIQUE -- the dissolution of hierarchy, of distinction, of meaning. The Entropy dungeon should feel like a Richter photo-painting: recognizable architecture that is being BLURRED into undifferentiated surface.

4. **Francis Bacon** (1909-1992) -- Specifically the later portraits where figures dissolve on the canvas: "features slide off like wax under heat." Bacon's dissolution is not abstract -- it is ORGANIC. You can SEE the human form losing its coherence. For the Entropy dungeon, any figures (enemies, NPCs) should feel Baconian: almost-human forms in the process of losing their defining features.

**Secondary references:** Antoni Tapies's material paintings (sand, marble dust, latex), Andrew Wyeth's *Christina's World* (the melancholy of vast, fading landscape), Vilhelm Hammershoi's empty rooms (stillness as visual entropy).

### AI Model Recommendation

**Primary: FLUX.2 Max**

The Entropy requires the most sophisticated visual control of all archetypes. The challenge: generating images that are PARTIALLY dissolved but not chaotic. FLUX.2 Max's "strongest prompt following and faithful representation of various styles" is necessary for maintaining the precise DEGREE of dissolution -- too little and it looks like a normal dungeon, too much and it becomes abstract noise. The model must hold the image at the exact point where form is losing coherence but has not yet lost it entirely.

**Alternative: GPT Image 1.5** -- For scenes requiring emotional resonance in the decay (the beauty IN the fading). GPT Image 1.5's "emotional expression and stylistic coherence" can capture the melancholy that distinguishes Entropy from mere damage.

### Visual Specifications

| Parameter | Specification |
|-----------|--------------|
| **Aspect ratio** | 16:9 horizontal OR 3:2 (the fading landscape extends sideways; the horizon is indistinct) |
| **Abstraction level** | The KEY aesthetic: representational forms in the PROCESS of becoming abstract. Corridors that are recognizable at the left edge of the frame but dissolve into undifferentiated surface at the right. This gradient from form to formlessness IS the Entropy |
| **Color temperature** | Neutral trending warm. The color of dust. The color of everything becoming the same color |
| **Palette** | Ochre, raw umber, ash grey, faded terracotta, oxidized iron, the brown of old paper. Everything DESATURATED but not grey -- warm desaturation, as if the colors are fading in sunlight. Lead grey (Kiefer) as the base |
| **Style** | Mixed media / material art. The image should look like it was painted with actual earth, ash, and rusted metal. Richter's blurred photo-painting quality for architecture, Kiefer's layered material surfaces for texture |
| **Lighting** | Flat, diffuse, sourceless. NO dramatic lighting (that implies energy; entropy has no energy). The light comes from everywhere and nowhere. Overcast sky quality. Even illumination that makes everything the same brightness |

### Prompt Architecture

```
Corridor in a state of advanced entropy, Anselm Kiefer material painting style with
lead and ash textures, the walls are recognizable as walls on the left but dissolve
into undifferentiated surface on the right, Gerhard Richter squeegee blur effect on
architecture, Tarkovsky Stalker Zone color palette of muted greens and ochres, flat
sourceless lighting with no shadows, everything is the same temperature of warm grey,
dust covers every surface equally, the beauty of thermodynamic equalization, 16:9
wide format, the horizon is indistinct
```

**Key prompt terms:** "Kiefer ash and lead texture," "Richter squeegee blur," "Tarkovsky Stalker Zone palette," "thermodynamic equalization," "flat sourceless lighting," "dust covers everything equally," "fading into sameness," "warm desaturation," "the corridor was here yesterday -- today it is mostly here"

### What Does NOT Work

- **Destruction or violence.** Broken walls, explosions, rubble. The Entropy is not destroyed -- it is DISSOLVING. The distinction is crucial: a broken wall implies force; a wall losing coherence implies time.
- **High contrast or dramatic lighting.** Contrast implies energy. Entropy is the ABSENCE of energy gradients. Keep everything flat.
- **Strong colors.** Even warm ones. Colors should be FADED versions of themselves. The red door is now the pinkish-brown door. The green carpet is now the brownish-grey carpet.
- **Darkness.** The Shadow is dark; the Entropy is uniformly dim. There is light, but it illuminates nothing interesting because everything is becoming the same.
- **Digital aesthetic.** Glitch art, pixel decay -- these feel technological. The Entropy is PHYSICAL, material. Dust, not data.
- **Ruins as picturesque.** Romantic ruins with ivy and crumbling stone are beautiful in a way that celebrates decay. The Entropy should make decay feel INDIFFERENT. Not beautiful-sad, but beautiful-blank.

---

## 5. THE PROMETHEUS

**Literary DNA:** Shelley, Schulz, Lem, Suskind, Bachelard
**Resonance signature:** `innovation_spark`
**Core mood:** Creation vertigo, innovation fever, the forge as psychological state, matter as co-creator

### Art-Historical Mapping

**Primary movement:** Dutch Golden Age candlelight tradition + Scientific Sublime (Wright of Derby) + Alchemical illustration

The Prometheus is about LIGHT: the stolen fire, the forge glow, the moment of illumination. But this is not clean, white, modern light. It is GOLDEN interior light -- the light of a workshop at midnight, of molten metal, of the single candle that illuminates the philosopher's revelation. The visual precedent is Rembrandt's chiaroscuro and Wright of Derby's candlelit scientific experiments.

**Primary reference painters/artists:**

1. **Rembrandt van Rijn** (1606-1669) -- Specifically *Philosopher in Meditation* (1632) and the self-portraits. Rembrandt's chiaroscuro radiates golden light from within profound darkness, creating "psychological and spiritual dimensions" through light alone. His palette of warm golds, deep browns, and rich shadows IS the Prometheus dungeon's color space. The workshop scenes should feel like Rembrandt interiors: a pool of warm light surrounded by productive darkness.

2. **Joseph Wright of Derby** (1734-1797) -- *An Experiment on a Bird in the Air Pump* (1768) is the Prometheus archetype's signature image. A natural philosopher conducting a scientific experiment by candlelight, the room lit by a single hidden candle. The painting "departed from convention by depicting a scientific subject in the reverential manner formerly reserved for scenes of historical or religious significance." The scientific SUBLIME: the experiment as sacred act. For the Prometheus dungeon, crafting is not utilitarian -- it is RITUAL.

3. **Remedios Varo** (1908-1963) -- (Recontextualized from Devouring Mother: here as CRAFTSMAN, not as organic environment.) Varo's figures navigate spaces "filled with alchemical instruments, mechanical devices, and celestial symbols." Her illuminated-manuscript technique gives scientific instruments the quality of sacred objects. For the Prometheus, Varo's aesthetic captures the dungeon's crafting interface: precision instruments in mystical light.

4. **Pieter Claesz** (1597-1660) -- Vanitas still life paintings. The single candle, the skull, the extinguished flame. The Prometheus dungeon's AFTERMATH is a vanitas: creation's ecstasy is over, and what remains is the artifact and the cost. Claesz's monochromatic brown-gold palette grounds the Prometheus in material reality.

**Secondary references:** Caravaggio's tenebrism (extreme light-dark contrast), Jan Steen's workshop scenes, W.H. Auden's poem "The Shield of Achilles" as textual equivalent of the forge's truth-telling.

### AI Model Recommendation

**Primary: FLUX.2 Max**

Chiaroscuro is the most demanding lighting setup for AI image generation. The model must render BOTH the illuminated zone (warm, golden, detailed) AND the surrounding darkness (deep, rich, NOT just black). FLUX.2 Max's architectural detail rendering extends to object-level detail (instruments, components, forge equipment) and its style fidelity holds the warm golden palette consistently. The prompt must be specific about light direction and quality: "golden light from a single source below the subject, Rembrandt triangle lighting."

**Alternative: GPT Image 1.5** -- For scenes emphasizing the EMOTIONAL state of creation (the ecstasy, the horror of completion). GPT Image 1.5's "emotional expression" and understanding of "Annie Leibovitz portraiture" lighting translates well to intimate, psychologically charged workshop scenes.

### Visual Specifications

| Parameter | Specification |
|-----------|--------------|
| **Aspect ratio** | 4:3 or 3:2 landscape (slightly wider than tall; the workshop is an intimate interior, not a vast space) |
| **Abstraction level** | Representational with heightened atmosphere. The instruments, components, and forge should be clearly visible and detailed. The DARKNESS around them should be rich and deep but not abstract |
| **Color temperature** | WARM. The warmest of all archetypes. Molten gold, deep amber, rich brown-black. The only cool notes are the metal of instruments (blue-grey steel) providing contrast |
| **Palette** | Raw sienna, burnt umber, gold, amber, deep brown-black, warm ivory (for illuminated skin/surfaces). Accent: blue-grey steel or copper green for metal instruments |
| **Style** | Old Masters oil painting. Visible impasto in the light areas, smooth transparent glazes in the shadows. This should look like it was painted by a Dutch Golden Age master |
| **Lighting** | Single-source candlelight or forge-glow. Rembrandt chiaroscuro. The light has DIRECTION and WARMTH. It illuminates a small area intensely while the rest of the scene falls into rich darkness. NOT the same darkness as the Shadow (which is void); this is PRODUCTIVE darkness, the darkness of a workshop at night |

### Prompt Architecture

```
Alchemist's workshop interior, Rembrandt chiaroscuro golden candlelight from below
illuminating brass instruments and glass vessels on a workbench, Joseph Wright of
Derby scientific sublime atmosphere, single warm light source casting deep amber
shadows, rich oil painting impasto texture, burnt umber and gold palette, the forge
glows in the background with molten orange light, alchemical instruments arranged
with Remedios Varo precision, Dutch Golden Age still life composition, 4:3 landscape,
the darkness around the workbench is rich and warm not cold
```

**Key prompt terms:** "Rembrandt chiaroscuro," "Wright of Derby candlelight," "golden forge glow," "alchemical instruments," "Dutch Golden Age," "single warm light source," "rich oil painting texture," "burnt umber and gold palette," "scientific sublime," "the darkness is warm"

### What Does NOT Work

- **Modern/clean workshop.** Steel tables, LED lighting, organized tools. The Prometheus workshop is ANCIENT and ORGANIC: stained wood, patinated brass, wax drips.
- **Blue or cool lighting.** Destroys the forge atmosphere. The Prometheus is fire-lit; even moonlight through a window should be warmed by the forge.
- **Multiple light sources.** The power of chiaroscuro comes from a SINGLE source. Multiple lights flatten the drama.
- **Fantasy/magic effects.** Glowing runes, magical particles, sparkles. The Prometheus is about CRAFT, not magic. The horror comes from method, not mysticism (per Shelley's Frankenstein).
- **Empty spaces.** Every surface should have tools, components, materials. The workshop is DENSE with the evidence of making.
- **Photographic style.** This must be painterly -- oil painting texture, visible brushwork. Photography cannot capture the Rembrandt glow.

---

## 6. THE DELUGE

**Literary DNA:** Ballard, Bachelard, Woolf, McCarthy, Tarkovsky
**Resonance signature:** `elemental_surge`
**Core mood:** Elemental urgency combined with subaquatic awe, water as regression, tidal rhythm

### Art-Historical Mapping

**Primary movement:** Romantic Sublime marine painting + Subaquatic photography + Tarkovsky's water cinematography

The Deluge's critical distinction: water is BEAUTIFUL even as it kills. This is not tsunami disaster imagery. It is the drowned world of Ballard, hauntingly gorgeous, where "the further south they moved, the more the biological clock within them reverted to a more primitive time." The visual precedent is the Romantic Sublime: Turner's dissolving seascapes, Friedrich's frozen sea, Aivazovsky's luminous waves.

**Primary reference painters/artists:**

1. **J.M.W. Turner** (1775-1851) -- Turner "didn't paint water and skies; he painted the FEELING of water and skies." His late seascapes dissolve form entirely: "sand merges with sea which merges with sky." His wet-on-wet technique created "fluid, atmospheric effects mirroring the natural world's unpredictability." The Deluge dungeon's above-water scenes should have Turner's quality of DISSOLUTION THROUGH ELEMENT: you cannot tell where the water ends and the air begins.

2. **Ivan Aivazovsky** (1817-1900) -- The master of luminous water. Aivazovsky achieved "transparency of water by applying thin layers of luminous jade green pigments to the rising waves that appear to absorb the moonlight." His glazing technique -- "beginning with a dark underlayer and gradually building up lighter tones, creating an internal glow" -- makes water look lit from within. The Deluge's submerged scenes should have this INTERNAL LUMINOSITY: the water does not merely reflect light, it CONTAINS it.

3. **Caspar David Friedrich** (1774-1840) -- Recontextualized from The Shadow. Here, specifically *The Sea of Ice* (1823-24): "a shipwreck in the Arctic... spikes of ice thrust upward like the Earth's bones exposed." Friedrich's painting is the Deluge's AFTERMATH image: what the water leaves behind when it freezes, crushes, recedes. The ship (the party's progress) is tiny against the elemental force. This is the "Arctic Sublime."

4. **Tarkovsky** (1932-1986) -- Recontextualized from The Entropy. Here, specifically the WATER scenes: the famous tracking shot over submerged objects in *Stalker* (coins, icons, a gun, a page from a book, all visible through shallow clear water) and the rain-through-roof scenes in *Nostalghia*. Tarkovsky's water is ARCHAEOLOGICAL: it reveals what lies beneath. The Deluge dungeon's submerged rooms should feel like Tarkovsky's underwater tracking shots: clear water over meaningful objects.

**Secondary references:** Katsushika Hokusai's *The Great Wave off Kanagawa* (water as dynamic form), Claude Monet's *Water Lilies* (subaquatic serenity), Hiroshi Sugimoto's *Seascapes* photographs (the horizon as the only constant).

### AI Model Recommendation

**Primary: FLUX.2 Pro**

The Deluge requires the broadest range of any archetype: above-water turbulence (Turner dissolution), subaquatic clarity (Tarkovsky tracking shots), and liminal water-surface scenes (the meniscus between worlds). FLUX.2 Pro's production-grade balance handles all three without the premium of Max, and its atmospheric capability is strong. The key challenge is rendering TRANSPARENT water with visible objects beneath -- this is a photographic skill that AI handles better than painterly rendering.

**Dual approach:** Use FLUX.2 Pro for the more photographic subaquatic scenes (transparent water over submerged architecture) and FLUX.2 Max for the painterly above-water scenes (Turner-style atmospheric dissolution).

### Visual Specifications

| Parameter | Specification |
|-----------|--------------|
| **Aspect ratio** | 16:9 horizontal for above-water (vast horizons, Turner seascapes) OR 9:16 vertical for rising-water scenes (the water is coming UP; the vertical format makes the viewer feel it rising toward them) |
| **Abstraction level** | Gradient from representational (submerged architecture clearly visible through water) to near-abstract (above-water storms dissolving into Turner-like atmospheric washes). The abstraction INCREASES as the water rises |
| **Color temperature** | Cool-to-neutral above water (Turner's greys, storm greens); WARM below water (Aivazovsky's jade-green luminosity, amber light through murk). The subaquatic world is paradoxically warmer than the surface |
| **Palette** | Above-water: storm grey, sea green, white foam, slate blue. Below-water: jade green, amber, deep teal, the warm brown of submerged wood. Accent: the sickly yellow-green of bioluminescence in deep water |
| **Style** | Above-water: painterly, wet-on-wet, Turner dissolution. Below-water: photographic clarity with cinematic color grading (Tarkovsky). The CONTRAST between painterly surface and clear depths is the Deluge's visual signature |
| **Lighting** | Above-water: diffuse storm light, no direct sun, everything filtered through cloud and spray. Below-water: shafts of light descending through water, caustic patterns on submerged surfaces, internal luminosity of the water itself |

### Prompt Architecture

**Above-water (Turner mode):**
```
Massive wave engulfing submerged architecture, JMW Turner late seascape style,
wet-on-wet oil painting technique, water and sky merging into atmospheric dissolution,
storm grey and sea green palette, the horizon is invisible, white foam dissolving
into mist, Romantic Sublime marine painting, the beauty of the catastrophe,
16:9 cinematic widescreen
```

**Below-water (Tarkovsky mode):**
```
Submerged corridor seen through crystal-clear water, Tarkovsky Stalker tracking shot
aesthetic, objects visible on the flooded floor -- a compass, scattered documents,
a broken instrument -- jade green and amber subaquatic light, caustic light patterns
playing across submerged concrete walls, Aivazovsky luminous water technique,
photographic clarity with cinematic color grading, the water is clear and the
drowned world is hauntingly beautiful, 16:9 format
```

**Key prompt terms:** "Turner dissolution," "Aivazovsky luminous water," "Tarkovsky subaquatic tracking shot," "jade green and amber," "water and sky merging," "caustic light patterns," "the drowned world is beautiful," "Romantic Sublime," "storm grey palette"

### What Does NOT Work

- **Disaster/catastrophe imagery.** Screaming people, crashing waves, debris flying. The Deluge is not a disaster movie. The water is calm, beautiful, INEVITABLE.
- **Murky/dark water.** The Deluge's horror is in the CLARITY. You can see perfectly -- you can see the drowned world in perfect detail. Dark water obscures; the Deluge reveals.
- **Tropical blue.** Caribbean-postcard turquoise. The Deluge's water is northern, cold, deep: jade green, grey-green, teal. Not paradise.
- **Fish or marine life.** The water in the Deluge is not an OCEAN -- it is FLOOD water in interior spaces. No coral, no fish, no seaweed. The water is elemental, not ecological.
- **Frozen/static water.** (That's The Shadow's territory for ice, or Entropy for stillness.) The Deluge's water MOVES. Even in calm scenes, there should be subtle flow, current, rising level.
- **Photographic above-water scenes.** The surface should be painterly/atmospheric. Photographic rendering of storm water looks like a weather photograph, not sublime art.

---

## 7. THE AWAKENING

**Literary DNA:** Jung, Proust, Murakami, Dick, Stapledon
**Resonance signature:** `consciousness_drift`
**Core mood:** Consciousness emerging, memory as architecture, lucid vertigo, collective unconscious surfacing

### Art-Historical Mapping

**Primary movement:** Pittura Metafisica (de Chirico, 1910-1920) + Symbolist dreamscapes (Redon) + Surrealist landscape (Sage, Tanguy)

The Awakening's critical distinction: NOT psychedelic. The visual language is not kaleidoscopic fractals or DMT-trip geometry. It is the moment between sleep and waking -- hypnagogic imagery, where familiar things appear in unfamiliar combinations and you cannot tell whether you are recognizing or imagining. De Chirico called this quality "the enigma": "the effect is less a nightmare than the moment upon waking when the dream's meaning slips away."

**Primary reference painters/artists:**

1. **Giorgio de Chirico** (1888-1978) -- The father of pittura metafisica. De Chirico painted "dreamlike works featuring sharp contrasts of light and shadow with a vaguely threatening, mysterious quality." His Italian piazzas are empty, the shadows fall at impossible angles, classical statues stand where people should be. Seeing *The Song of Love* (1914), Magritte said it was "one of the most moving moments of my life: my eyes saw thought for the first time." The Awakening dungeon should feel like walking through a de Chirico painting: recognizable architecture rendered UNCANNY through wrong light and empty space.

2. **Rene Magritte** (1898-1967) -- Specifically *The Empire of Light* (1953-54): a street scene showing daytime sky above a nighttime street. The painting's power comes from the SPECIFIC impossibility: each half is perfectly normal, but their combination is impossible. This is the Awakening's visual logic: familiar elements in impossible combination. Also *The Human Condition* (1933): a painting on an easel that perfectly continues the landscape behind it, making representation and reality indistinguishable.

3. **Odilon Redon** (1840-1916) -- Two distinct phases relevant to the Awakening. His early *noirs*: charcoal and lithograph works in pure black that are "some of his most famous works, typifying Symbolism in their mysterious subjects and bizarre, dreamlike inventions." These are the Awakening at LOW Awareness -- monochrome, suggestive, barely visible. His later pastels: "flowers appear as if they breathe, shimmer, or float in space" with "mysticism and dream-logic." These are the Awakening at HIGH Awareness -- color floods in, but the forms have become impossible.

4. **Kay Sage** (1898-1963) -- "The most abstract and geometrical vocabulary in the Surrealist movement." Sage painted "imaginary psychic landscapes" with "muted tones of gray, green, and blue" influenced by early Renaissance frescoes. Her architectural forms "could represent buildings either under construction or ruined and decaying" -- the ambiguity is the point. Like de Chirico, Sage creates "metaphysical space" through "uncanny juxtapositions." For the Awakening, Sage provides the landscape BETWEEN memories: vast, muted, geometrically suggestive but unresolvable.

5. **Yves Tanguy** (1900-1955) -- "Mysterious mindscapes, oneiric subaqueous realms filled with amorphous objects that teetered on the biological." Tanguy's biomorphic forms cast shadows on flat planes, giving "impossible nature a paradoxical sense of reality." His "muted color palette dominated by blues, grays, and browns" evokes "an alien, sometimes underwater atmosphere." For the Awakening at mid-Awareness levels: the dungeon's memories have begun to take physical form, but the forms are not yet identifiable.

**Secondary references:** Hilma af Klint (consciousness as geometric abstraction -- spirals, circles, intersecting lines representing "spiritual forces or natural processes"), Max Ernst's *Europe After the Rain* (landscape as post-catastrophic dream), Paul Delvaux's nocturnal architectural scenes (sleepwalking figures in classical settings).

### AI Model Recommendation

**Primary: GPT Image 1.5**

The Awakening requires the most EMOTIONALLY nuanced generation of all archetypes. The image must feel like a MEMORY -- not sharp, not blurred, but possessing that specific quality where you cannot tell if you are remembering or imagining. GPT Image 1.5's focus on "emotional expression and stylistic coherence" and its ability to capture "artistic interpretation" over photographic accuracy makes it ideal. The model understands MOOD in a way that the more technically precise FLUX models do not.

**Alternative: FLUX.2 Max** -- For scenes requiring precise architectural uncanniness (de Chirico's piazzas, Sage's geometric landscapes). When the Awakening needs SPECIFIC impossibility (a door that opens onto the room you are already in), FLUX.2 Max's compositional control can hold the paradox.

### Visual Specifications

| Parameter | Specification |
|-----------|--------------|
| **Aspect ratio** | 3:2 landscape or 4:3 (the dreamer's aspect ratio -- not dramatically wide, not intimate. The framing of a photograph you find and cannot remember taking) |
| **Abstraction level** | Representational trending toward metaphysical. The architecture and objects are recognizable but WRONG in ways that take a moment to identify. A staircase that leads somewhere you have been before. A door that is the wrong size. The sky visible inside a room |
| **Color temperature** | Neither warm nor cool -- the specific temperature of EARLY MORNING light. Dawn: that liminal quality between the blue of night and the gold of day. Cool lavender, warm peach, grey-blue |
| **Palette** | LOW Awareness: Redon's noirs -- charcoal black, ivory, lamp black. MID Awareness: de Chirico's piazza palette -- ochre, terracotta, deep blue-green shadows, warm stone. HIGH Awareness: Redon's pastels -- saturated but soft pinks, blues, yellows that feel iridescent. The palette EVOLVES with the Awareness gauge |
| **Style** | Painterly with metaphysical precision. De Chirico's sharp shadows and clean architectural forms, but with Redon's atmospheric softness at the edges. Oil painting meets pastel. NOT photographic and NOT fully abstract |
| **Lighting** | The Empire of Light paradox: daylight sky AND nighttime street simultaneously. Multiple impossible light sources that do not cast shadows where they should. Dawn light that illuminates from below. The lighting should feel WRONG in a way that takes a moment to notice |

### Prompt Architecture

**Low Awareness (Redon Noirs mode):**
```
Barely visible architectural forms emerging from deep charcoal darkness, Odilon Redon
noirs lithograph style, monochrome black and ivory, a corridor that might be a
memory or might be the present, suggestive shapes at the threshold of recognition,
Symbolist dreamscape, the dream before it resolves into image, 3:2 format
```

**Mid Awareness (de Chirico mode):**
```
Empty metaphysical piazza in the style of Giorgio de Chirico, sharp elongated shadows
falling at impossible angles, classical architecture rendered in warm ochre and
terracotta with deep blue-green shadows, a doorway that opens onto a sky visible
inside the room, Magritte Empire of Light paradox lighting -- daylight sky above
a nighttime scene, the architecture is familiar but the perspective is wrong,
Kay Sage muted surrealist landscape in the distance, 3:2 format
```

**High Awareness (Redon Pastels mode):**
```
The collective unconscious made visible, Odilon Redon pastel dreamscape style,
saturated but soft iridescent colors -- rose pink, cerulean, pale gold -- flowers
and organic forms that are also architectural diagrams, Hilma af Klint spiritual
geometry overlaid on landscape, consciousness expanding beyond the frame,
everything is familiar and nothing is recognizable, 3:2 format
```

**Key prompt terms:** "de Chirico metaphysical," "Magritte impossible juxtaposition," "Redon noirs/pastels" (depending on Awareness), "Kay Sage psychic landscape," "Tanguy biomorphic forms," "hypnagogic," "the moment between sleep and waking," "familiar but wrong," "impossible light direction," "memory as architecture"

### What Does NOT Work

- **Psychedelic imagery.** Fractal patterns, rainbow colors, kaleidoscopic geometry, tie-dye effects. The Awakening is NOT a drug trip. It is the quiet vertigo of emerging consciousness.
- **Brain/neural imagery.** Neurons, synapses, brain scans. The Awakening's consciousness is not BIOLOGICAL -- it is metaphysical. The dungeon IS the mind, not a picture of a brain.
- **Eyes or watching imagery.** Surveillance, all-seeing eyes, Illuminati symbolism. The Awakening's consciousness is not watching -- it is WAKING UP. The eyes are opening, not observing.
- **Outer space / cosmic imagery.** Stars, galaxies, nebulae. This makes consciousness look like scale rather than quality. The Awakening is INTIMATE cosmic, not astronomical.
- **High-contrast dramatic lighting.** The Awakening's light is subtle, wrong, liminal. Dramatic spotlight effects belong to The Prometheus. Here, light should be ambient, sourceless, and paradoxical.
- **Photographic rendering.** The dream quality requires painterly softness. Photographic rendering makes impossibility look like a rendering error rather than a state of consciousness.
- **Symmetry.** De Chirico's piazzas are asymmetric, with shadows falling from sources outside the frame. AI defaults to symmetrical composition; fight this.

---

## Cross-Archetype Visual Differentiation Matrix

| Archetype | Color Temp | Palette Family | Style | Lighting | Composition | Aspect |
|-----------|-----------|---------------|-------|----------|-------------|--------|
| Shadow | Cold | Blue-black | Atmospheric abstract | Failing, crepuscular | Off-center, vast | 16:9 |
| Tower | Cool-neutral | Concrete grey | Etching/rendering | Institutional, harsh | Vertical, vertiginous | 9:16 |
| Devouring Mother | Warm | Rose-amber | Bio-illustration | Diffuse bioluminescent | Intimate, enclosed | 1:1 |
| Entropy | Neutral-warm | Ochre-ash | Material/mixed media | Flat, sourceless | Dissolving horizon | 16:9 |
| Prometheus | Warm | Gold-umber | Old Masters oil | Single-source chiaroscuro | Focused interior | 4:3 |
| Deluge | Cool-above/warm-below | Jade-grey/amber | Turner painterly / photo | Storm-diffuse / subaquatic shafts | Vast horizon / rising | 16:9 or 9:16 |
| Awakening | Liminal | Evolving palette | Metaphysical painterly | Paradoxical, impossible | Familiar-but-wrong | 3:2 |

### Model Assignment Summary

| Archetype | Primary Model | Reasoning |
|-----------|--------------|-----------|
| Shadow | FLUX.2 Max | Atmospheric control, style fidelity in extreme darkness |
| Tower | FLUX.2 Max | Architectural precision, holds impossible geometry |
| Devouring Mother | GPT Image 1.5 | Emotional expression, organic warmth, intimate naturalism |
| Entropy | FLUX.2 Max | Precise dissolution control, material texture rendering |
| Prometheus | FLUX.2 Max | Chiaroscuro lighting, Old Masters style fidelity |
| Deluge | FLUX.2 Pro + Max | Pro for subaquatic clarity, Max for painterly storms |
| Awakening | GPT Image 1.5 | Emotional mood, metaphysical atmosphere, dream quality |

### Universal AI Generation Principles

1. **No negative prompts in FLUX.2.** Describe what you WANT, not what you do not want. "Sharp focus throughout" instead of "no blur."

2. **Word order matters.** FLUX.2 pays more attention to what comes first. Lead with the mood/atmosphere, then subject, then style, then technical details.

3. **Medium-length prompts (30-80 words)** perform best. Over-specification causes the model to compromise between competing instructions.

4. **Specify HEX colors for precision** when the palette is critical. "#1a1a2e" communicates a specific darkness better than "very dark blue."

5. **Generate at correct aspect ratio.** Never crop after generation. The model composes differently for each ratio.

6. **Name specific paintings, not just artists.** "Rembrandt Philosopher in Meditation lighting" is more precise than "Rembrandt style."

7. **AI defaults to centered subjects.** Always specify composition explicitly: "off-center," "rule of thirds," "subject at bottom fifth of frame."

8. **AI defaults to high contrast.** All archetypes except Prometheus need explicit LOW-contrast instructions. "Flat lighting," "sourceless illumination," "no dramatic shadows."

---

## Sources

### Art History
- [Cosmic Horror in Art](https://medium.com/@maria.zrou/cosmic-horror-in-art-b83fe997d09)
- [The Cursed Paintings of Beksinski](https://culture.pl/en/article/the-cursed-paintings-of-zdzislaw-beksinski)
- [Beksinski at Mnemos -- John Coulthart](https://www.johncoulthart.com/feuilleton/2021/01/21/beksinski-at-mnemos/)
- [Carceri d'invenzione -- Wikipedia](https://en.wikipedia.org/wiki/Carceri_d%27invenzione)
- [Imaginary Prisons -- GWU Brady Gallery](https://bradygallery.gwu.edu/imaginary-prisons)
- [Piranesi's Imaginary Prisons](https://www.newdealsameshit.com/p/piranesis-imaginary-prisonscarceri)
- [Patricia Piccinini -- Beautiful and Unsettling](https://pursuit.unimelb.edu.au/articles/beautiful-and-unsettling-the-world-of-artist-patricia-piccinini)
- [Patricia Piccinini -- Wikipedia](https://en.wikipedia.org/wiki/Patricia_Piccinini)
- [Haeckel Kunstformen der Natur -- Biodiversity Heritage Library](https://www.biodiversitylibrary.org/item/104650)
- [Anselm Kiefer -- TheArtStory](https://www.theartstory.org/artist/kiefer-anselm/)
- [Anselm Kiefer -- Royal Academy Guide](https://www.royalacademy.org.uk/article/anselm-kiefer-a-beginners-guide)
- [Salt, Ash, and Lead -- Kiefer's Materials](https://thepostcalvin.com/salt-ash-and-lead-an-artist-and-his-materials/)
- [Tarkovsky Stalker Cinematography](https://scenesfromanimaginaryfilm.wordpress.com/2016/03/20/the-desolation-of-desire-the-cinematography-of-stalker/)
- [Stalker Color Analysis -- filmcolors.org](https://filmcolors.org/galleries/stalker-1979/)
- [Gerhard Richter Techniques -- MyArtBroker](https://www.myartbroker.com/artist-gerhard-richter/articles/gerhard-richter-techniques)
- [Francis Bacon in 10 Paintings](https://www.dailyartmagazine.com/francis-bacon-in-10-paintings/)
- [Rembrandt Philosopher in Meditation -- Wikipedia](https://en.wikipedia.org/wiki/Philosopher_in_Meditation)
- [Rembrandt Chiaroscuro -- Old Masters Academy](https://oldmasters.academy/old-masters-academy-art-lessons/rembrandts-visual-effects-chiaroscuro)
- [Wright of Derby Air Pump -- National Gallery](https://www.nationalgallery.org.uk/paintings/joseph-wright-of-derby-an-experiment-on-a-bird-in-the-air-pump)
- [Wright of Derby -- Science and the Sublime](https://www.huntington.org/exhibition/science-and-sublime-masterpiece-joseph-wright-derby)
- [JMW Turner Seascapes -- 1st Art Gallery](https://www.1st-art-gallery.com/article/the-atmospheric-seascapes-of-jmw-turner/)
- [Turner and the Sea: Pure Paint and Pure Sensation](https://gerryco23.wordpress.com/2014/03/19/turner-and-the-sea-pure-paint-and-pure-sensation/)
- [Ivan Aivazovsky -- Wikipedia](https://en.wikipedia.org/wiki/Ivan_Aivazovsky)
- [Aivazovsky's Storms and Waves](https://www.1st-art-gallery.com/article/aivazovsky-storms-nature-fury/)
- [The Sea of Ice -- CDF Analysis](https://sva.edu/features/spikes-seas-and-the-sublime-an-in-depth-analysis-of-caspar-david-friedrich-s-the-sea-of-ice-1823-24)
- [De Chirico -- Contemporary Lynx](https://contemporarylynx.co.uk/de-chirico-metaphysical-painting-influencing-surrealists-and-admiration-for-classicism)
- [De Chirico -- TheArtStory Metaphysical Painting](https://www.theartstory.org/movement/metaphysical-painting/)
- [Odilon Redon -- TheArtStory](https://www.theartstory.org/artist/redon-odilon/)
- [Odilon Redon -- Radiant Poetics of Pastel Dreams](https://www.1st-art-gallery.com/article/odilon-redon-and-the-pastel-poetics-of-visionary-dreams/)
- [Kay Sage -- TheArtStory](https://www.theartstory.org/artist/sage-kay/)
- [Kay Sage -- Whitney Museum](https://whitney.org/artists/1146)
- [Yves Tanguy -- TheArtStory](https://www.theartstory.org/artist/tanguy-yves/)
- [Leonora Carrington -- Artsy](https://www.artsy.net/article/artsy-editorial-leonora-carrington-brought-wild-feminist-intensity-surrealist-painting)
- [Remedios Varo: Science Fictions -- Art Institute of Chicago](https://www.artic.edu/exhibitions/9935/remedios-varo-science-fictions)
- [Remedios Varo -- The Alchemist of Surrealism](https://www.squintmagazine.com/post/remedios-varo-the-alchemist-of-surrealism)
- [Hilma af Klint -- Wikipedia](https://en.wikipedia.org/wiki/Hilma_af_Klint)
- [Hilma af Klint and Symbolism](https://birgitzipser.com/hilma-af-klint/)
- [Hugh Ferriss -- Drawing Matter](https://drawingmatter.org/hugh-ferriss/)
- [Hugh Ferriss Retrofuturism -- Public Domain Review](https://publicdomainreview.org/essay/modern-babylon-ziggurat-skyscrapers-and-hugh-ferriss-retrofuturism/)
- [John Martin Great Day of Wrath -- Smarthistory](https://smarthistory.org/martin-the-great-day-of-his-wrath/)
- [Wanderer above the Sea of Fog -- Wikipedia](https://en.wikipedia.org/wiki/Wanderer_above_the_Sea_of_Fog)

### AI Model Comparisons
- [FLUX Models Comparison 2026 -- Melies](https://melies.co/compare/flux-models)
- [FLUX.2 Max vs Pro -- Melies](https://melies.co/compare/flux-2-max-vs-flux-2-pro)
- [FLUX.2 Max Review -- getimg.ai](https://getimg.ai/blog/flux-2-max-review-flex-pro-comparison)
- [FLUX.2 Prompting Guide -- Black Forest Labs](https://docs.bfl.ml/guides/prompting_guide_flux2)
- [FLUX.2 Max Prompt Guide -- fal.ai](https://fal.ai/learn/devs/flux-2-max-prompt-guide)
- [Best AI Image Models 2026 -- TeamDay.ai](https://www.teamday.ai/blog/best-ai-image-models-2026)
- [GPT-5 Image Generation Analysis -- CreateVision](https://createvision.ai/guides/gpt5-image-generation-analysis)
- [GPT-5 for Artists -- Creative Bloq](https://www.creativebloq.com/ai/gpt-5-is-out-and-heres-what-it-means-for-artists)
- [Seedream 4.5 Complete Guide -- WaveSpeedAI](https://wavespeed.ai/blog/posts/seedream-4-5-complete-guide-2026/)
- [Seedream 4.5 vs GPT Image 1.5 -- Blog Picasso IA](https://blog.picassoia.com/seedream-4-5-vs-gpt-image-1-5-for-art)
- [Gemini 3 Pro Image -- MindStudio](https://www.mindstudio.ai/blog/what-is-gemini-3-pro-image)
- [FLUX 2 vs Seedream 4.5 -- WaveSpeedAI](https://wavespeed.ai/blog/posts/flux-2-vs-seedream-comparison-2026/)
- [Nano Banana Pro vs Flux 2 Max vs GPT 1.5 -- Medium](https://medium.com/@cognidownunder/nano-banana-pro-vs-flux-2-max-vs-gpt-1-5-106c8f5de7b4)
- [AI Image Aspect Ratios Guide -- zsky.ai](https://zsky.ai/blog/ai-aspect-ratio-guide)
- [AI Lighting Prompts -- zsky.ai](https://zsky.ai/blog/ai-lighting-prompts)
- [Rembrandt AI Images Guide -- CreateVision](https://createvision.ai/guides/rembrandt-ai-images)
- [10 AI Image Generation Mistakes -- GodOfPrompt](https://www.godofprompt.ai/blog/10-ai-image-generation-mistakes-99percent-of-people-make-and-how-to-fix-them)
