# Gegner-Bildprompts — Resonance Dungeons

74 Assets gesamt; hier die **42 Gegner**. Die 32 Raum-Backdrops kommen separat.

## Arbeitsweise

1. **Zuerst pro Archetyp EIN Referenzbild** aus dem Stil-Block erzeugen (Gegner deiner Wahl aus der Gruppe).
2. Danach die restlichen Gegner desselben Archetyps **mit dem Referenzbild als Bildreferenz** erzeugen — sonst driftet der Stil über 42 Prompts auseinander.
3. Export als PNG, benannt exakt nach der `id` in der Klammer (z. B. `shadow_wisp.png`).
4. Alles in EINEN Ordner; ich baue das Ingest-Skript (Freistellen → AVIF q80 ≤1024px → Storage → YAML → Migration).

## Technischer Block — an JEDEN Prompt anhängen

```
Full body, single subject, centred, vertical 3:4 framing, complete figure inside the frame with a small margin.
Flat pure magenta background, hex #FF00FF, absolutely uniform, no gradient, no vignette.
No cast shadow on the background, no ground plane, no floor contact shadow — the subject must be cleanly separable.
Do not let any magenta light spill onto the subject; keep rim light neutral or in the palette below.
No text, no logo, no watermark, no border, no frame.
Painterly realism, muted and grimy, high contrast between lit and unlit areas. Not glossy, not cartoon, not cel-shaded, not chrome.
```


---

## The Shadow  (`shadow`) — 5 Gegner

**Stil-Block (in jeden Prompt dieser Gruppe):**

> Encroaching gloom. Cold desaturated blues and charcoal, a single sickly amber light source raking from below. Edges dissolve into grain; nothing is fully seen.


### Shadow Wisp  (`shadow_wisp`) — minion

```
A creature from The Shadow, a dungeon of the psyche. Encroaching gloom. Cold desaturated blues and charcoal, a single sickly amber light source raking from below. Edges dissolve into grain; nothing is fully seen.
Subject: Shadow Wisp. A flickering presence at the edge of perception. It doesn't attack the body – it erodes certainty.
Scale: small and slight — reads as a fragment of a thing rather than a whole creature, roughly knee-to-waist height.
```

### Shadow Tendril  (`shadow_tendril`) — minion

```
A creature from The Shadow, a dungeon of the psyche. Encroaching gloom. Cold desaturated blues and charcoal, a single sickly amber light source raking from below. Edges dissolve into grain; nothing is fully seen.
Subject: Shadow Tendril. A black appendage reaching from the walls. Patient. Methodical.
Scale: small and slight — reads as a fragment of a thing rather than a whole creature, roughly knee-to-waist height.
```

### Echo of Violence  (`shadow_echo_violence`) — standard

```
A creature from The Shadow, a dungeon of the psyche. Encroaching gloom. Cold desaturated blues and charcoal, a single sickly amber light source raking from below. Edges dissolve into grain; nothing is fully seen.
Subject: Echo of Violence. A replay of violence that once scarred this place. It moves with the precision of memory – every strike has happened before.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Paranoia Shade  (`shadow_paranoia_shade`) — standard

```
A creature from The Shadow, a dungeon of the psyche. Encroaching gloom. Cold desaturated blues and charcoal, a single sickly amber light source raking from below. Edges dissolve into grain; nothing is fully seen.
Subject: Paranoia Shade. It whispers. Not lies, exactly – plausible fears. Things your agents already suspect about each other.
Scale: human-scaled, upright, the baseline threat of this place.
```

### The Remnant  (`shadow_remnant`) — elite

```
A creature from The Shadow, a dungeon of the psyche. Encroaching gloom. Cold desaturated blues and charcoal, a single sickly amber light source raking from below. Edges dissolve into grain; nothing is fully seen.
Subject: The Remnant. Formed from the simulation's strongest unresolved conflict. It remembers what your agents have tried to forget.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

---

## The Tower  (`tower`) — 5 Gegner

**Stil-Block (in jeden Prompt dieser Gruppe):**

> Structural collapse. Fractured concrete grey and rust-orange, hard diagonal light, hairline cracks and falling dust in the air.


### Tremor Broker  (`tower_tremor_broker`) — minion

```
A creature from The Tower, a dungeon of the psyche. Structural collapse. Fractured concrete grey and rust-orange, hard diagonal light, hairline cracks and falling dust in the air.
Subject: Tremor Broker. A nervous figure wreathed in scrolling numbers. It doesn't fight – it recites. Market figures, compound rates, the precise mathematics of structures that can't hold.
Scale: small and slight — reads as a fragment of a thing rather than a whole creature, roughly knee-to-waist height.
```

### Foundation Worm  (`tower_foundation_worm`) — minion

```
A creature from The Tower, a dungeon of the psyche. Structural collapse. Fractured concrete grey and rust-orange, hard diagonal light, hairline cracks and falling dust in the air.
Subject: Foundation Worm. Patient. Eyeless. It navigates by stress fractures in the load-bearing walls, widening them with each pass. The building groans where it has been.
Scale: small and slight — reads as a fragment of a thing rather than a whole creature, roughly knee-to-waist height.
```

### The Crowned  (`tower_crown_keeper`) — standard

```
A creature from The Tower, a dungeon of the psyche. Structural collapse. Fractured concrete grey and rust-orange, hard diagonal light, hairline cracks and falling dust in the air.
Subject: The Crowned. It wears the crown of a structure that believed it would last forever. The crown is cracked. The keeper does not acknowledge this.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Debt Shade  (`tower_debt_shade`) — standard

```
A creature from The Tower, a dungeon of the psyche. Structural collapse. Fractured concrete grey and rust-orange, hard diagonal light, hairline cracks and falling dust in the air.
Subject: Debt Shade. It speaks in promises that were never kept. Each round it grows, fed by the compound interest of unresolved obligations. It lies about its intentions – not from malice, but because the ledger demands it.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Remnant of Commerce  (`tower_remnant_commerce`) — elite

```
A creature from The Tower, a dungeon of the psyche. Structural collapse. Fractured concrete grey and rust-orange, hard diagonal light, hairline cracks and falling dust in the air.
Subject: Remnant of Commerce. What remains when a trading floor collapses. It moves through the ruin with proprietary efficiency, summoning lesser brokers from the rubble. Its market crash ability strips all pretense of stability.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

---

## The Devouring Mother  (`mother`) — 5 Gegner

**Stil-Block (in jeden Prompt dieser Gruppe):**

> Parasitic warmth. Fleshy ochre and dried-blood crimson, soft enveloping light, organic folds and umbilical filaments.


### Nutrient Weaver  (`mother_nutrient_weaver`) — minion

```
A creature from The Devouring Mother, a dungeon of the psyche. Parasitic warmth. Fleshy ochre and dried-blood crimson, soft enveloping light, organic folds and umbilical filaments.
Subject: Nutrient Weaver. A lattice of translucent tissue, suspended in the air like a web spun from capillaries. It drifts toward {agent} – not threatening, but offering. Something glistens at the tips of its filaments. Nutrients, your instruments confirm. It wants to feed you.
Scale: small and slight — reads as a fragment of a thing rather than a whole creature, roughly knee-to-waist height.
```

### Tether Vine  (`mother_tether_vine`) — standard

```
A creature from The Devouring Mother, a dungeon of the psyche. Parasitic warmth. Fleshy ochre and dried-blood crimson, soft enveloping light, organic folds and umbilical filaments.
Subject: Tether Vine. A root system that has learned to walk. It moves through the floor like something swimming through still water – surfacing, reaching, submerging. The tissue is warm to the touch. Your instruments advise against touching it.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Spore Matron  (`mother_spore_matron`) — standard

```
A creature from The Devouring Mother, a dungeon of the psyche. Parasitic warmth. Fleshy ochre and dried-blood crimson, soft enveloping light, organic folds and umbilical filaments.
Subject: Spore Matron. Something between a flower and a lung. It breathes, and its breath carries spores that catch the light like dust in a cathedral. The spores smell of honey and warm soil. Your instruments read them as parasitic vectors. Your body reads them as nourishment.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Host Warden  (`mother_host_warden`) — elite

```
A creature from The Devouring Mother, a dungeon of the psyche. Parasitic warmth. Fleshy ochre and dried-blood crimson, soft enveloping light, organic folds and umbilical filaments.
Subject: Host Warden. It was a person once. The proportions remember – two arms, two legs, a head. But the tissue has grown over and through and around until the person is only a scaffold for something larger, something that moves with the patient rhythm of a heartbeat. It opens its arms. Not to attack. To welcome. The embrace is the attack.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

### The Living Altar  (`mother_living_altar`) — boss

```
A creature from The Devouring Mother, a dungeon of the psyche. Parasitic warmth. Fleshy ochre and dried-blood crimson, soft enveloping light, organic folds and umbilical filaments.
Subject: The Living Altar. What was once a Host Warden has become something larger. It has grown into the walls, the floor, the ceiling – a figure embedded in architecture, arms open, face calm, the tissue around it pulsing with the rhythm of something that has been waiting for millennia. The Living Altar does not guard the dungeon. It is the dungeon. The embrace it offers is permanent. The warmth is absolute.
Scale: monumental — fills the frame, broad-shouldered or horned, unmistakably the authority of this dungeon.
```

---

## The Entropy  (`entropy`) — 4 Gegner

**Stil-Block (in jeden Prompt dieser Gruppe):**

> Decay. Bleached bone-white and mould-green, flat diffuse light, surfaces powdering and crumbling at the silhouette edge.


### Rust Phantom  (`entropy_rust_phantom`) — minion

```
A creature from The Entropy, a dungeon of the psyche. Decay. Bleached bone-white and mould-green, flat diffuse light, surfaces powdering and crumbling at the silhouette edge.
Subject: Rust Phantom. A shape that was something once. Now it is mostly the color of rust and the sound of metal thinning. It does not approach – it persists.
Scale: small and slight — reads as a fragment of a thing rather than a whole creature, roughly knee-to-waist height.
```

### Fade Echo  (`entropy_fade_echo`) — standard

```
A creature from The Entropy, a dungeon of the psyche. Decay. Bleached bone-white and mould-green, flat diffuse light, surfaces powdering and crumbling at the silhouette edge.
Subject: Fade Echo. A sound that is almost a voice. A shape that is almost a figure. It repeats something that was once important. The repetition has worn the meaning away.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Dissolution Swarm  (`entropy_dissolution_swarm`) — standard

```
A creature from The Entropy, a dungeon of the psyche. Decay. Bleached bone-white and mould-green, flat diffuse light, surfaces powdering and crumbling at the silhouette edge.
Subject: Dissolution Swarm. A cloud of particles that were once a wall, a floor, a ceiling. Now they are nothing in particular, and they move with the purposelessness of dust in a closed room.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Entropy Warden  (`entropy_warden`) — elite

```
A creature from The Entropy, a dungeon of the psyche. Decay. Bleached bone-white and mould-green, flat diffuse light, surfaces powdering and crumbling at the silhouette edge.
Subject: Entropy Warden. It was a guardian once. The armor remembers. The purpose does not. It stands where it has always stood, performing the motions of protection over nothing. When it notices you, the motions do not change. You have simply become part of what it protects. Or what it dissolves. There is no longer a difference.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

---

## The Prometheus  (`prometheus`) — 8 Gegner

**Stil-Block (in jeden Prompt dieser Gruppe):**

> Forge heat. Ember orange and blackened iron, intense low key-light from a furnace off-frame, sparks and heat shimmer.


### Spark Wisp  (`prometheus_spark_wisp`) — minion

```
A creature from The Prometheus, a dungeon of the psyche. Forge heat. Ember orange and blackened iron, intense low key-light from a furnace off-frame, sparks and heat shimmer.
Subject: Spark Wisp. A spark that refused to go out. It orbits the party like a hypothesis testing itself.
Scale: small and slight — reads as a fragment of a thing rather than a whole creature, roughly knee-to-waist height.
```

### Alloy Sentinel  (`prometheus_alloy_sentinel`) — standard

```
A creature from The Prometheus, a dungeon of the psyche. Forge heat. Ember orange and blackened iron, intense low key-light from a furnace off-frame, sparks and heat shimmer.
Subject: Alloy Sentinel. Forged from an alloy that does not appear in any periodic table. It stands where the workshop needs it to stand. It does not question this.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Slag Golem  (`prometheus_slag_golem`) — standard

```
A creature from The Prometheus, a dungeon of the psyche. Forge heat. Ember orange and blackened iron, intense low key-light from a furnace off-frame, sparks and heat shimmer.
Subject: Slag Golem. The residue of failed experiments, accumulated and compacted until it gained mass, then purpose. It does not hate the party. It is simply in the way.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Crucible Drake  (`prometheus_crucible_drake`) — standard

```
A creature from The Prometheus, a dungeon of the psyche. Forge heat. Ember orange and blackened iron, intense low key-light from a furnace off-frame, sparks and heat shimmer.
Subject: Crucible Drake. A construct of molten flux and crystallized heat. It was a crucible once. Now it moves. The fire inside it has opinions.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Automaton Shard  (`prometheus_automaton_shard`) — standard

```
A creature from The Prometheus, a dungeon of the psyche. Forge heat. Ember orange and blackened iron, intense low key-light from a furnace off-frame, sparks and heat shimmer.
Subject: Automaton Shard. A fragment of something larger that was never completed. Or that completed itself in ways its designer did not intend. It moves with the precision of a blueprint and the malice of a splinter.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Forge Wraith  (`prometheus_forge_wraith`) — elite

```
A creature from The Prometheus, a dungeon of the psyche. Forge heat. Ember orange and blackened iron, intense low key-light from a furnace off-frame, sparks and heat shimmer.
Subject: Forge Wraith. Smoke and metal in the shape of a craftsman. It works at an invisible anvil, hammering things that are not there. When it notices the party, it does not stop working. It incorporates them.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

### Workshop Guardian  (`prometheus_workshop_guardian`) — elite

```
A creature from The Prometheus, a dungeon of the psyche. Forge heat. Ember orange and blackened iron, intense low key-light from a furnace off-frame, sparks and heat shimmer.
Subject: Workshop Guardian. It was built to protect the workshop. It has been doing this for longer than the workshop has existed. Its loyalty is not to the current configuration – it is to the IDEA of the workshop.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

### The Prototype  (`prometheus_the_prototype`) — boss

```
A creature from The Prometheus, a dungeon of the psyche. Forge heat. Ember orange and blackened iron, intense low key-light from a furnace off-frame, sparks and heat shimmer.
Subject: The Prototype. It was supposed to be the masterwork. The culmination. The thing the workshop has been building toward since the first spark was struck. It is not finished. It does not know this. It functions with the absolute confidence of an unfinished thing that believes it is complete.
Scale: monumental — fills the frame, broad-shouldered or horned, unmistakably the authority of this dungeon.
```

---

## The Deluge  (`deluge`) — 5 Gegner

**Stil-Block (in jeden Prompt dieser Gruppe):**

> Drowning. Deep teal and silt-brown, refracted caustic light from above, waterlogged surfaces and suspended particulate.


### Riptide Tendril  (`deluge_riptide_tendril`) — minion

```
A creature from The Deluge, a dungeon of the psyche. Drowning. Deep teal and silt-brown, refracted caustic light from above, waterlogged surfaces and suspended particulate.
Subject: Riptide Tendril. A current given form. It does not strike – it pulls. The direction is always down, always toward deeper water.
Scale: small and slight — reads as a fragment of a thing rather than a whole creature, roughly knee-to-waist height.
```

### Pressure Surge  (`deluge_pressure_surge`) — standard

```
A creature from The Deluge, a dungeon of the psyche. Drowning. Deep teal and silt-brown, refracted caustic light from above, waterlogged surfaces and suspended particulate.
Subject: Pressure Surge. The water's memory of what it once displaced. It arrives as a wall – not tall, not dramatic, but dense. The kind of force that moves furniture and doesn't notice.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Silt Revenant  (`deluge_silt_revenant`) — standard

```
A creature from The Deluge, a dungeon of the psyche. Drowning. Deep teal and silt-brown, refracted caustic light from above, waterlogged surfaces and suspended particulate.
Subject: Silt Revenant. It emerged from the sediment when the water reached this level. A shape made of what the flood deposited – silt, mineral, the residue of dissolved rooms. It does not speak. It broadcasts the sound of water in enclosed spaces.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Undertow Warden  (`deluge_undertow_warden`) — elite

```
A creature from The Deluge, a dungeon of the psyche. Drowning. Deep teal and silt-brown, refracted caustic light from above, waterlogged surfaces and suspended particulate.
Subject: Undertow Warden. The water's enforcer. Not an entity that lives in water – an entity that IS water, given mass and purpose. It does not guard a door. It guards a depth.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

### The Current  (`deluge_the_current`) — boss

```
A creature from The Deluge, a dungeon of the psyche. Drowning. Deep teal and silt-brown, refracted caustic light from above, waterlogged surfaces and suspended particulate.
Subject: The Current. Not an enemy. A direction. The Current is the flood's final argument: that everything flows downward, that every barrier is temporary, that what the water claims, the water keeps. It does not attack. It arrives.
Scale: monumental — fills the frame, broad-shouldered or horned, unmistakably the authority of this dungeon.
```

---

## The Awakening  (`awakening`) — 5 Gegner

**Stil-Block (in jeden Prompt dieser Gruppe):**

> Deja-vu. Washed lilac and pale gold, doubled exposure edges, a faint second outline offset from the first.


### Echo Fragment  (`awakening_echo_fragment`) — minion

```
A creature from The Awakening, a dungeon of the psyche. Deja-vu. Washed lilac and pale gold, doubled exposure edges, a faint second outline offset from the first.
Subject: Echo Fragment. A memory of a memory. It does not have content – it has the shape where content was. {agent} recognizes the absence, not the thing.
Scale: small and slight — reads as a fragment of a thing rather than a whole creature, roughly knee-to-waist height.
```

### Déjà-vu Phantom  (`awakening_deja_vu_phantom`) — standard

```
A creature from The Awakening, a dungeon of the psyche. Deja-vu. Washed lilac and pale gold, doubled exposure edges, a faint second outline offset from the first.
Subject: Déjà-vu Phantom. It is not here for the first time. It has always been in this room, waiting for the party to arrive again. Its movements are half a second ahead of expectation – as if the party remembers fighting it before the fight has begun.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Consciousness Leech  (`awakening_consciousness_leech`) — standard

```
A creature from The Awakening, a dungeon of the psyche. Deja-vu. Washed lilac and pale gold, doubled exposure edges, a faint second outline offset from the first.
Subject: Consciousness Leech. Watts was right about this one. It functions perfectly without self-awareness – a philosophical zombie made operational. It does not think. It processes. And it is faster than anything that pauses to reflect.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Repressed Sentinel  (`awakening_repressed_sentinel`) — elite

```
A creature from The Awakening, a dungeon of the psyche. Deja-vu. Washed lilac and pale gold, doubled exposure edges, a faint second outline offset from the first.
Subject: Repressed Sentinel. The sentinel guards the threshold between conscious and unconscious. Ishiguro's mist made guardian – it exists to ensure the buried stays buried. It does not hate the party. It pities their need to know.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

### The Repressed  (`awakening_the_repressed`) — boss

```
A creature from The Awakening, a dungeon of the psyche. Deja-vu. Washed lilac and pale gold, doubled exposure edges, a faint second outline offset from the first.
Subject: The Repressed. A memory so painful it was buried by consensus. Not by one agent – by all of them simultaneously. It is not a monster. It is the truth that was too heavy to carry and too important to destroy. Jung's encounter with the Self, Tarkovsky's Room: it grants your true desire, not your stated one.
Scale: monumental — fills the frame, broad-shouldered or horned, unmistakably the authority of this dungeon.
```

---

## The Overthrow  (`overthrow`) — 5 Gegner

**Stil-Block (in jeden Prompt dieser Gruppe):**

> Fracture. Mirror-silver and bruised violet, hard specular highlights, the form broken into offset shards.


### Faction Informer  (`overthrow_faction_informer`) — minion

```
A creature from The Overthrow, a dungeon of the psyche. Fracture. Mirror-silver and bruised violet, hard specular highlights, the form broken into offset shards.
Subject: Faction Informer. Havel's greengrocer made operative. The informer does not believe — the informer performs. The sign in the window says what the faction requires. Behind the counter, the informer reports who does not display theirs.
Scale: small and slight — reads as a fragment of a thing rather than a whole creature, roughly knee-to-waist height.
```

### Propaganda Agent  (`overthrow_propaganda_agent`) — standard

```
A creature from The Overthrow, a dungeon of the psyche. Fracture. Mirror-silver and bruised violet, hard specular highlights, the form broken into offset shards.
Subject: Propaganda Agent. Orwell's Squealer on two legs. The agent does not lie — the agent renders the concept of lying meaningless. Yesterday's alliance was always today's betrayal. The records have been updated. The records were always thus.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Regime Enforcer  (`overthrow_regime_enforcer`) — standard

```
A creature from The Overthrow, a dungeon of the psyche. Fracture. Mirror-silver and bruised violet, hard specular highlights, the form broken into offset shards.
Subject: Regime Enforcer. The muscle behind the rhetoric. The enforcer does not care which faction gives the order — only that the order exists. Arendt's ideal subject: one for whom the distinction between fact and fiction has ceased to matter.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Grand Inquisitor  (`overthrow_grand_inquisitor`) — elite

```
A creature from The Overthrow, a dungeon of the psyche. Fracture. Mirror-silver and bruised violet, hard specular highlights, the form broken into offset shards.
Subject: Grand Inquisitor. Dostoevsky's three powers made flesh: miracle, mystery, authority. The Inquisitor does not punish dissent — the Inquisitor explains why dissent was always agreement, misunderstood. The confession is not extracted. It is assisted.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

### The Pretender  (`overthrow_the_pretender`) — boss

```
A creature from The Overthrow, a dungeon of the psyche. Fracture. Mirror-silver and bruised violet, hard specular highlights, the form broken into offset shards.
Subject: The Pretender. Milton's Satan made sovereign. The Pretender began as a rebel — magnificent, defiant, charismatic. Power degraded the vision. Phase 1: Book I archangel, addressing armies with impossible eloquence. Phase 2: Book IV, 'squat like a toad,' truth exposed. Phase 3: Book X, permanently serpentine. The Pretender quotes everyone. Especially you.
Scale: monumental — fills the frame, broad-shouldered or horned, unmistakably the authority of this dungeon.
```

---

**Gesamt: 42 Gegner.**
