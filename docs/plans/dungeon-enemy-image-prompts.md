# Gegner-Bildprompts — Resonance Dungeons

74 Assets gesamt; hier die **42 Gegner**. Die 32 Raum-Backdrops kommen separat.

## Arbeitsweise

1. **Zuerst pro Archetyp EIN Referenzbild** aus dem Stil-Block erzeugen (Gegner deiner Wahl aus der Gruppe).
2. Danach die restlichen Gegner desselben Archetyps **mit dem Referenzbild als Bildreferenz** erzeugen — sonst
   driftet der Stil über 42 Prompts auseinander. **Aber:** sobald zwei Kreaturen einander zu ähneln beginnen
   (gleiche Haltung, gleiche Requisiten), die Referenz für den nächsten Durchlauf weglassen. Die Referenz
   hält die Palette zusammen und zieht gleichzeitig die Motive aufeinander zu — beides passiert immer.
3. **Ab der vierten Kreatur einer Gruppe reicht das Weglassen der Referenz nicht mehr.** Dann muss die
   Motivzeile ausdrücklich benennen, was die Kreatur NICHT ist — und zwar mit den Merkmalen ihrer
   Geschwister. Tower kollabierte über 6→8→10 auf Kuppel/Bänder/Hand-vor-Gesicht, Prometheus über
   24→25→27 auf halb geöffnete Panzergestalt mit Zahnrad und Halbschädel. Beide Male half erst die
   namentliche Abgrenzung („no dome", „no armour, no ribcage, no skull").
3. Export als PNG, benannt exakt nach der `id` in der Klammer (z. B. `shadow_wisp.png`).
4. **Kein lesbarer Text im Bild.** Das Spiel ist zweisprachig (en/de) — eingebackene englische
   Schrift waere auch dann ein Lokalisierungsfehler, wenn sie fehlerfrei gesetzt waere.
5. Alles in EINEN Ordner; ich baue das Ingest-Skript (Freistellen → AVIF q80 ≤1024px → Storage → YAML → Migration).

## ⚠️ Lore ist nicht Bildbeschreibung

Die `description_en` in den YAMLs ist **Spielprosa in zweiter Person** („Your instruments confirm…"),
kein Bildbriefing. Bei Shadow und Tower war sie zufällig visuell; ab The Devouring Mother wird sie
literarisch und abstrakt. Die Motivzeilen unten sind deshalb daraus **abgeleitete Bildbeschreibungen** –
Bedeutung identisch, aber malbar. Die YAML bleibt unangetastet, sie ist In-Game-Text.

Drei wiederkehrende Fallen, die dabei entschärft wurden:
- **Architektur-Metaphern** („dust in a cathedral", „grown into the walls") erzeugen Gebäude statt
  Kreaturen. Zweimal passiert (Krone → Kuppel). Bauwerk immer explizit ausschließen.
- **Transluzente Motive** („cloud of particles", „translucent lattice") überleben das Freistellen nicht.
  Immer zu einer dichten, zusammenhängenden Masse verdichten.
- **Platzhalter** wie `{agent}` aus der Spiel-Engine gehören nicht in einen Bildprompt.

## Technischer Block — an JEDEN Prompt anhängen

```
Full body, single subject, centred, vertical 3:4 framing, complete figure inside the frame with a small margin. The creature itself must be clearly TALLER THAN WIDE, roughly two units tall for every one across — it is rendered into an upright portrait slot in the game, so a low or horizontal body is squashed into an unreadable smear.
Exactly ONE creature and nothing else. The creature is a SINGLE CONNECTED OBJECT — if the subject describes a doubled or twinned body, the two halves are fused into one solid mass sharing a single base, never two separate figures standing apart. Nothing floats beside it, behind it or below it — no broken-off pieces, no chips, no shards, no sparks, no embers, no dust motes, not even small ones, and no leftover shapes carried over from any reference image.
If the creature carries a weapon or tool: exactly ONE of it, held in its hand, and complete — the whole object inside the frame with clear space around it. Never a second overlapping or crossing weapon.
Flat pure magenta background, hex #FF00FF, absolutely uniform, no gradient, no vignette.
No cast shadow on the background, no ground plane, no floor contact shadow — the subject must be cleanly separable.
Do not let any magenta light spill onto the subject; keep rim light neutral or in the palette below.
No text, no logo, no watermark, no border, no frame.
This overrides the subject description: if the subject is described with numbers, ledgers, market data or writing, render those as illegible abstract marks — the impression of data, never readable characters.
Keep luminous elements dense and opaque; no large translucent veils or glowing ribbons, they do not survive being cut out.
Painterly realism, muted and grimy, high contrast between lit and unlit areas. Not glossy, not cartoon, not cel-shaded, not chrome.
Matte surfaces by default — no wet sheen, no specular highlights, no glistening; even flesh and slime are rendered dry and dust-dulled. This applies UNLESS the archetype style block above explicitly permits a sheen. In every case the outer edge of the silhouette stays dark and matte: never a bright rim of light running along the outline.
Heavily desaturated: closer to grey than to full colour, as if seen through dirty air. Never bright, never candy-coloured, never vivid.
No marks resembling writing anywhere on the creature's skin or surface — no glyphs, no script, no tally marks, no tattoos.
```


---

## The Shadow  (`shadow`) — 5 Gegner

**Stil-Block (in jeden Prompt dieser Gruppe):**

> Encroaching gloom. Cold desaturated blues and charcoal, a single sickly amber light source raking from below. Edges dissolve into grain; nothing is fully seen.


### Shadow Wisp  (`shadow_wisp`) — minion

```
A creature from The Shadow, a dungeon of the psyche. Encroaching gloom. Cold desaturated blues and charcoal, a single sickly amber light source raking from below. Edges dissolve into grain; nothing is fully seen.
Subject: Shadow Wisp. A flickering presence at the edge of perception. It doesn't attack the body – it erodes certainty.
Scale: a MINION — squat, stunted and incomplete in its proportions, closer to a fragment than to a whole creature. Never a heroic or imposing physique; it should look small even with nothing beside it for comparison.
```

### Shadow Tendril  (`shadow_tendril`) — minion

```
A creature from The Shadow, a dungeon of the psyche. Encroaching gloom. Cold desaturated blues and charcoal, a single sickly amber light source raking from below. Edges dissolve into grain; nothing is fully seen.
Subject: Shadow Tendril. A black appendage reaching from the walls. Patient. Methodical.
Scale: a MINION — squat, stunted and incomplete in its proportions, closer to a fragment than to a whole creature. Never a heroic or imposing physique; it should look small even with nothing beside it for comparison.
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
Subject: Tremor Broker. A gaunt, nervous figure of cracked concrete, wreathed in ribbons of pale light that carry the impression of columns of figures without a single legible character. It does not fight. It recites.
Scale: a MINION — squat, stunted and incomplete in its proportions, closer to a fragment than to a whole creature. Never a heroic or imposing physique; it should look small even with nothing beside it for comparison.
```

### Foundation Worm  (`tower_foundation_worm`) — minion

```
A creature from The Tower, a dungeon of the psyche. Structural collapse. Fractured concrete grey and rust-orange, hard diagonal light, hairline cracks and falling dust in the air.
Subject: Foundation Worm. Patient. Eyeless. It navigates by stress fractures in the load-bearing walls, widening them with each pass. The building groans where it has been.
Scale: a MINION — squat, stunted and incomplete in its proportions, closer to a fragment than to a whole creature. Never a heroic or imposing physique; it should look small even with nothing beside it for comparison.
```

### The Crowned  (`tower_crown_keeper`) — standard

```
A creature from The Tower, a dungeon of the psyche. Structural collapse. Fractured concrete grey and rust-orange, hard diagonal light, hairline cracks and falling dust in the air.
Subject: The Crowned. A bare, upright figure of cracked concrete with an ordinary head and a blank, impassive face, wearing a heavy crown — a ring of broken concrete points fused to the skull, split by one deep fracture. It stands squared and unbowed, arms hanging at its sides, hands open and empty: it does not acknowledge that the crown is broken. The crown is a crown, not a building — no dome, no architecture on or for the head. No paper, no ribbons, no banners, nothing wrapped around the body, nothing held in the hands.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Debt Shade  (`tower_debt_shade`) — standard

```
A creature from The Tower, a dungeon of the psyche. Structural collapse. Fractured concrete grey and rust-orange, hard diagonal light, hairline cracks and falling dust in the air.
Subject: Debt Shade. A swelling figure of promises never kept, bound in torn paper that has gone blank and illegible with age. It grows with every obligation left unresolved.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Remnant of Commerce  (`tower_remnant_commerce`) — elite

```
A creature from The Tower, a dungeon of the psyche. Structural collapse. Fractured concrete grey and rust-orange, hard diagonal light, hairline cracks and falling dust in the air.
Subject: Remnant of Commerce. What remains when a structure's authority collapses — a massive, broad-shouldered figure of shattered stone bound with bent rebar, far heavier than a person, advancing with cold efficiency, arms low and wide. Its head is a blunt featureless block of fractured concrete. No architecture for a head, no dome, no paper, no ribbons, no banners, nothing wrapped around the body. Nothing modern, no machinery, no devices.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

---

## The Devouring Mother  (`mother`) — 5 Gegner

**Stil-Block (in jeden Prompt dieser Gruppe):**

> Parasitic warmth, drained of colour. Dull greyed ochre and dried blackened blood — flesh muted almost to stone, never pink, never fresh, never appetising. Soft enveloping light, matte throughout, no sheen. Organic folds and umbilical filaments.


### Nutrient Weaver  (`mother_nutrient_weaver`) — minion

```
A creature from The Devouring Mother, a dungeon of the psyche. Parasitic warmth, drained of colour. Dull greyed ochre and dried blackened blood — flesh muted almost to stone, never pink, never fresh, never appetising. Soft enveloping light, matte throughout, no sheen. Organic folds and umbilical filaments.
Subject: Nutrient Weaver. A small drifting lattice of pale capillary tissue, fleshy and dense rather than see-through, gathered into one compact hanging mass. Dull, dry beads hang at the tips of its filaments. It reaches outward as though offering something.
Scale: a MINION — squat, stunted and incomplete in its proportions, closer to a fragment than to a whole creature. Never a heroic or imposing physique; it should look small even with nothing beside it for comparison.
```

### Tether Vine  (`mother_tether_vine`) — standard

```
A creature from The Devouring Mother, a dungeon of the psyche. Parasitic warmth, drained of colour. Dull greyed ochre and dried blackened blood — flesh muted almost to stone, never pink, never fresh, never appetising. Soft enveloping light, matte throughout, no sheen. Organic folds and umbilical filaments.
Subject: Tether Vine. A root system that has learned to walk — thick knotted vines of dry, leathery tissue gathered into one upright body, a single limb lifted and reaching forward, the rest trailing behind it like something only half surfaced.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Spore Matron  (`mother_spore_matron`) — standard

```
A creature from The Devouring Mother, a dungeon of the psyche. Parasitic warmth, drained of colour. Dull greyed ochre and dried blackened blood — flesh muted almost to stone, never pink, never fresh, never appetising. Soft enveloping light, matte throughout, no sheen. Organic folds and umbilical filaments.
Subject: Spore Matron. Something between a flower and a lung: a swollen, breathing body of pale ribbed tissue, petals of flesh opening around one dark central vent. A fine haze of spores clings close against its surface.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Host Warden  (`mother_host_warden`) — elite

```
A creature from The Devouring Mother, a dungeon of the psyche. Parasitic warmth, drained of colour. Dull greyed ochre and dried blackened blood — flesh muted almost to stone, never pink, never fresh, never appetising. Soft enveloping light, matte throughout, no sheen. Organic folds and umbilical filaments.
Subject: Host Warden. It was a person once and the proportions still remember it — two arms, two legs, and an ordinary human head with a blank, slack face. No flower, no bloom, no petals, nothing botanical where the head should be. Fibrous tissue has grown over and through the body until the person is only a scaffold for something larger. Both arms are raised and opened symmetrically, palms forward, in a wide welcoming embrace — the gesture is the whole point of the figure.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

### The Living Altar  (`mother_living_altar`) — boss

```
A creature from The Devouring Mother, a dungeon of the psyche. Parasitic warmth, drained of colour. Dull greyed ochre and dried blackened blood — flesh muted almost to stone, never pink, never fresh, never appetising. Soft enveloping light, matte throughout, no sheen. Organic folds and umbilical filaments.
Subject: The Living Altar. A vast swollen body of fused tissue and bone, far larger than a person, seated and immobile, both arms opened wide, the face calm and upturned. Slabs of broken stone are embedded IN its flesh like a shell it has absorbed. Show the creature alone and complete — no walls, no floor, no ceiling, no room, no architecture around it.
Scale: monumental — fills the frame, broad-shouldered or horned, unmistakably the authority of this dungeon.
```

---

## The Entropy  (`entropy`) — 4 Gegner

**Stil-Block (in jeden Prompt dieser Gruppe):**

> Decay. Bleached bone-white and dull mould-green, both heavily greyed and nearly colourless. Flat diffuse light, no highlights anywhere. Surfaces powdering and crumbling at the silhouette edge.


### Rust Phantom  (`entropy_rust_phantom`) — minion

```
A creature from The Entropy, a dungeon of the psyche. Decay. Bleached bone-white and dull mould-green, both heavily greyed and nearly colourless. Flat diffuse light, no highlights anywhere. Surfaces powdering and crumbling at the silhouette edge.
Subject: Rust Phantom. A hollow, half-eaten figure of corroded metal, thin as a shell, its edges eaten away into lace. It stands still rather than advancing.
Scale: a MINION — squat, stunted and incomplete in its proportions, closer to a fragment than to a whole creature. Never a heroic or imposing physique; it should look small even with nothing beside it for comparison.
```

### Fade Echo  (`entropy_fade_echo`) — standard

```
A creature from The Entropy, a dungeon of the psyche. Decay. Bleached bone-white and dull mould-green, both heavily greyed and nearly colourless. Flat diffuse light, no highlights anywhere. Surfaces powdering and crumbling at the silhouette edge.
Subject: Fade Echo. A figure worn almost featureless, like a statue left too long in the rain — the shape of a person still readable but the surface smoothed and blurred away, doubled faintly along one edge as if caught repeating itself.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Dissolution Swarm  (`entropy_dissolution_swarm`) — standard

```
A creature from The Entropy, a dungeon of the psyche. Decay. Bleached bone-white and dull mould-green, both heavily greyed and nearly colourless. Flat diffuse light, no highlights anywhere. Surfaces powdering and crumbling at the silhouette edge.
Subject: Dissolution Swarm. A dense swarm of grey grit and crumbled masonry, packed tightly into one roughly upright body, solid and opaque throughout, its outline eroding away at the edges.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Entropy Warden  (`entropy_warden`) — elite

```
A creature from The Entropy, a dungeon of the psyche. Decay. Bleached bone-white and dull mould-green, both heavily greyed and nearly colourless. Flat diffuse light, no highlights anywhere. Surfaces powdering and crumbling at the silhouette edge.
Subject: Entropy Warden. A tall guardian whose armour has corroded into lace and hangs loose on a frame that is mostly gone. A corroded closed helm is still in place on its shoulders — it has a head, not an empty collar. It stands in a formal guard posture and holds a single short polearm upright against one shoulder, the whole weapon well inside the frame.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

---

## The Prometheus  (`prometheus`) — 8 Gegner

**Stil-Block (in jeden Prompt dieser Gruppe):**

> Forge heat seen through soot. Blackened iron with a deep, smothered ember glow — dull and banked, never bright orange, never neon. Low key-light from a furnace off-frame, everything else in shadow.


### Spark Wisp  (`prometheus_spark_wisp`) — minion

```
A creature from The Prometheus, a dungeon of the psyche. Forge heat seen through soot. Blackened iron with a deep, smothered ember glow — dull and banked, never bright orange, never neon. Low key-light from a furnace off-frame, everything else in shadow.
Subject: Spark Wisp. A single small ember-creature: a knot of forge-hot glowing slag with thin trailing filaments, dense and opaque at its core, hovering.
Scale: a MINION — squat, stunted and incomplete in its proportions, closer to a fragment than to a whole creature. Never a heroic or imposing physique; it should look small even with nothing beside it for comparison.
```

### Alloy Sentinel  (`prometheus_alloy_sentinel`) — standard

```
A creature from The Prometheus, a dungeon of the psyche. Forge heat seen through soot. Blackened iron with a deep, smothered ember glow — dull and banked, never bright orange, never neon. Low key-light from a furnace off-frame, everything else in shadow.
Subject: Alloy Sentinel. A tall, narrow sentinel cast in one piece from a dull unfamiliar alloy — smooth plated limbs, a featureless helm-like head with no face and no seams. It stands squarely at rest, arms at its sides, waiting to be needed.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Slag Golem  (`prometheus_slag_golem`) — standard

```
A creature from The Prometheus, a dungeon of the psyche. Forge heat seen through soot. Blackened iron with a deep, smothered ember glow — dull and banked, never bright orange, never neon. Low key-light from a furnace off-frame, everything else in shadow.
Subject: Slag Golem. A heavy, lopsided body accreted from cooled slag and discarded castings — lumpen, pitted and fused together without design, dull black-grey throughout. It stands square and immovable, blocking the way.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Crucible Drake  (`prometheus_crucible_drake`) — standard

```
A creature from The Prometheus, a dungeon of the psyche. Forge heat seen through soot. Blackened iron with a deep, smothered ember glow — dull and banked, never bright orange, never neon. Low key-light from a furnace off-frame, everything else in shadow.
Subject: Crucible Drake. A long, low four-legged construct built from a cracked crucible: a barrel-like body of blackened fired clay bound in iron hoops, split along one side to show a deep banked glow far inside. Head low, moving forward on short heavy legs.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Automaton Shard  (`prometheus_automaton_shard`) — standard

```
A creature from The Prometheus, a dungeon of the psyche. Forge heat seen through soot. Blackened iron with a deep, smothered ember glow — dull and banked, never bright orange, never neon. Low key-light from a furnace off-frame, everything else in shadow.
Subject: Automaton Shard. A single enormous mechanical ARM, torn from a far larger machine and still working. It crawls on its own fingers like a crab, knuckles pressed to the ground, the severed shoulder end reared up behind it and ending in one clean hard break. Blackened iron plates over exposed gearwork, a single ember burning deep in the elbow joint. About the size of a large dog. This creature is an arm and nothing more.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Forge Wraith  (`prometheus_forge_wraith`) — elite

```
A creature from The Prometheus, a dungeon of the psyche. Forge heat seen through soot. Blackened iron with a deep, smothered ember glow — dull and banked, never bright orange, never neon. Low key-light from a furnace off-frame, everything else in shadow.
Subject: Forge Wraith. A lean, stooped smith cast in ONE CONTINUOUS PIECE of soot-caked hammered iron — a single smooth unbroken surface running from its plain rounded featureless head to its bare feet, like a figure poured from a single mould and never finished. Back curved low over an invisible anvil, shoulders narrow, limbs thin and wiry. One hammer raised mid-stroke, striking nothing; the other hand empty and open.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

### Workshop Guardian  (`prometheus_workshop_guardian`) — elite

```
A creature from The Prometheus, a dungeon of the psyche. Forge heat seen through soot. Blackened iron with a deep, smothered ember glow — dull and banked, never bright orange, never neon. Low key-light from a furnace off-frame, everything else in shadow.
Subject: Workshop Guardian. A broad, heavy warden of blackened iron plate, built like an upright door — thick shoulders, a narrow horizontal slit where a face would be, both hands closed around a long tool held across the body.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

### The Prototype  (`prometheus_the_prototype`) — boss

```
A creature from The Prometheus, a dungeon of the psyche. Forge heat seen through soot. Blackened iron with a deep, smothered ember glow — dull and banked, never bright orange, never neon. Low key-light from a furnace off-frame, everything else in shadow.
Subject: The Prototype. A monumental unfinished figure of blackened iron with dull ember-lit seams: one side finished and armoured, the other still bare scaffolding and open structure with whole parts simply absent. It stands at full height with total composure, unaware that it is incomplete.
Scale: monumental — fills the frame, broad-shouldered or horned, unmistakably the authority of this dungeon.
```

---

## The Deluge  (`deluge`) — 5 Gegner

**Stil-Block (in jeden Prompt dieser Gruppe):**

> Drowning. Deep greyed teal and silt-brown, heavily desaturated, dim light filtering from far above. Surfaces are genuinely WET and this archetype permits a sheen: soft broad reflections on silt, waterlogged timber and iron, the dull gleam of something just hauled out of a river. Keep every highlight soft and broad — never small hard sparkles, never a bright rim along the outer edge of the silhouette.


### Riptide Tendril  (`deluge_riptide_tendril`) — minion

```
A creature from The Deluge, a dungeon of the psyche. Drowning. Deep greyed teal and silt-brown, heavily desaturated, dim light filtering from far above. Surfaces are genuinely WET and this archetype permits a sheen: soft broad reflections on silt, waterlogged timber and iron, the dull gleam of something just hauled out of a river. Keep every highlight soft and broad — never small hard sparkles, never a bright rim along the outer edge of the silhouette.
Subject: Riptide Tendril. A long rope of packed river-silt and matted weed, thick as a thigh, coiling upward from a heavy knotted base — solid mud and fibre throughout, not water. It leans forward and downward, as if hauling something with it. Small stones and shells are set into its surface like grit in a cast.
Scale: a MINION — squat, stunted and incomplete in its proportions, closer to a fragment than to a whole creature. Never a heroic or imposing physique; it should look small even with nothing beside it for comparison.
```

### Pressure Surge  (`deluge_pressure_surge`) — standard

```
A creature from The Deluge, a dungeon of the psyche. Drowning. Deep greyed teal and silt-brown, heavily desaturated, dim light filtering from far above. Surfaces are genuinely WET and this archetype permits a sheen: soft broad reflections on silt, waterlogged timber and iron, the dull gleam of something just hauled out of a river. Keep every highlight soft and broad — never small hard sparkles, never a bright rim along the outer edge of the silhouette.
Subject: Pressure Surge. A rearing wall of compacted silt and gravel, standing tall and leaning forward over the viewer, curling at the top like a breaker caught the instant before it falls. Its front face is smooth and blunt where it has been shoving things ahead of it; its crest is heavy with gravel and splintered boards on the point of coming down. A solid slab of earth, broad and flat across the front, not a rope and not a coil.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Silt Revenant  (`deluge_silt_revenant`) — standard

```
A creature from The Deluge, a dungeon of the psyche. Drowning. Deep greyed teal and silt-brown, heavily desaturated, dim light filtering from far above. Surfaces are genuinely WET and this archetype permits a sheen: soft broad reflections on silt, waterlogged timber and iron, the dull gleam of something just hauled out of a river. Keep every highlight soft and broad — never small hard sparkles, never a bright rim along the outer edge of the silhouette.
Subject: Silt Revenant. A person-shaped body caked entirely in dried river-silt, standing upright — the human proportions still readable underneath, the surface cracked and flaking like a dried mudflat. Mineral crust and small shells have grown across its chest and shoulders. Head bowed slightly.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Undertow Warden  (`deluge_undertow_warden`) — elite

```
A creature from The Deluge, a dungeon of the psyche. Drowning. Deep greyed teal and silt-brown, heavily desaturated, dim light filtering from far above. Surfaces are genuinely WET and this archetype permits a sheen: soft broad reflections on silt, waterlogged timber and iron, the dull gleam of something just hauled out of a river. Keep every highlight soft and broad — never small hard sparkles, never a bright rim along the outer edge of the silhouette.
Subject: Undertow Warden. A tall, heavy figure built entirely of compacted silt, sunken timber and knotted weed, far larger than a person, broad through the shoulders, arms long and hanging. Waterlogged planks and iron fittings are embedded in the mass like ribs in clay. Solid throughout, not water.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

### The Current  (`deluge_the_current`) — boss

```
A creature from The Deluge, a dungeon of the psyche. Drowning. Deep greyed teal and silt-brown, heavily desaturated, dim light filtering from far above. Surfaces are genuinely WET and this archetype permits a sheen: soft broad reflections on silt, waterlogged timber and iron, the dull gleam of something just hauled out of a river. Keep every highlight soft and broad — never small hard sparkles, never a bright rim along the outer edge of the silhouette.
Subject: The Current. A monumental figure of packed silt and drowned debris, filling the frame — a vast rounded mass shouldering forward, with dozens of small drowned objects set into its surface like bones in mud: chair legs, shutters, iron hooks. No face; the front is one smooth blunt slope. Solid earth throughout, never water.
Scale: monumental — fills the frame, broad-shouldered or horned, unmistakably the authority of this dungeon.
```

---

## The Awakening  (`awakening`) — 5 Gegner

**Stil-Block (in jeden Prompt dieser Gruppe):**

> Deja-vu. Washed-out lilac and dull grey-gold, nearly monochrome, all colour bled thin. Doubled exposure edges, a faint second outline offset from the first.


### Echo Fragment  (`awakening_echo_fragment`) — minion

```
A creature from The Awakening, a dungeon of the psyche. Deja-vu. Washed-out lilac and dull grey-gold, nearly monochrome, all colour bled thin. Doubled exposure edges, a faint second outline offset from the first.
Subject: Echo Fragment. A small, squat upright shell of pale grey stone, hollowed out — its front is an empty concave hollow where a body would have been pressed in and lifted away. A second identical shell has grown out of its left side, offset by a hand's width and fused to it along the whole shoulder, so the two form ONE solid double-bodied object with a single base. Both halves opaque stone.
Scale: a MINION — squat, stunted and incomplete in its proportions, closer to a fragment than to a whole creature. Never a heroic or imposing physique; it should look small even with nothing beside it for comparison.
```

### Déjà-vu Phantom  (`awakening_deja_vu_phantom`) — standard

```
A creature from The Awakening, a dungeon of the psyche. Deja-vu. Washed-out lilac and dull grey-gold, nearly monochrome, all colour bled thin. Doubled exposure edges, a faint second outline offset from the first.
Subject: Deja-vu Phantom. One upright figure of pale grey stone caught mid-stride, with a second identical figure grown directly out of its own back — half a step behind, slightly turned, fused to it along the spine and shoulder so the two share one body and one pair of feet. Solid opaque stone throughout, taller than wide.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Consciousness Leech  (`awakening_consciousness_leech`) — standard

```
A creature from The Awakening, a dungeon of the psyche. Deja-vu. Washed-out lilac and dull grey-gold, nearly monochrome, all colour bled thin. Doubled exposure edges, a faint second outline offset from the first.
Subject: Consciousness Leech. A tall, unnaturally thin upright figure of pale grey stone, narrow as a post and stretched far past human proportion, arms hanging past its knees. Its head is a smooth eyeless cone tapering to a blunt point — no face, no mouth, no expression whatsoever. It leans forward as it advances. One clean unbroken surface throughout.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Repressed Sentinel  (`awakening_repressed_sentinel`) — elite

```
A creature from The Awakening, a dungeon of the psyche. Deja-vu. Washed-out lilac and dull grey-gold, nearly monochrome, all colour bled thin. Doubled exposure edges, a faint second outline offset from the first.
Subject: Repressed Sentinel. A tall, broad guardian of pale grey stone standing squarely with both arms crossed low over its body, blocking the way. Its head is a plain featureless block. Its whole front surface is worn smooth and blank, as if rubbed down over centuries; the back and sides are still rough and unfinished.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

### The Repressed  (`awakening_the_repressed`) — boss

```
A creature from The Awakening, a dungeon of the psyche. Deja-vu. Washed-out lilac and dull grey-gold, nearly monochrome, all colour bled thin. Doubled exposure edges, a faint second outline offset from the first.
Subject: The Repressed. A monumental figure of pale grey stone kneeling upright and filling the frame, its head lowered into both raised hands so the face is completely hidden. It is built tall and narrow rather than sprawling — knees together, elbows tucked in, the whole mass rising vertically. The stone is smooth and blank wherever the hands touch it and deeply cracked everywhere else.
Scale: monumental — fills the frame, broad-shouldered or horned, unmistakably the authority of this dungeon.
```

---

## The Overthrow  (`overthrow`) — 5 Gegner

**Stil-Block (in jeden Prompt dieser Gruppe):**

> Fracture. Dull tarnished silver and bruised grey-violet, heavily desaturated. The form broken into offset shards. Tarnished and matte throughout — no mirror shine, no specular glare, no chrome.


### Faction Informer  (`overthrow_faction_informer`) — minion

```
A creature from The Overthrow, a dungeon of the psyche. Fracture. Dull tarnished silver and bruised grey-violet, heavily desaturated. The form broken into offset shards. Tarnished and matte throughout — no mirror shine, no specular glare, no chrome.
Subject: Faction Informer. A small, hunched figure of tarnished grey metal, hands clasped tightly at its chest, shoulders drawn up around a head that is bowed and turned sharply away as if avoiding being seen. Its face is a smooth blank oval. Nothing is worn on its body and nothing is carried.
Scale: a MINION — squat, stunted and incomplete in its proportions, closer to a fragment than to a whole creature. Never a heroic or imposing physique; it should look small even with nothing beside it for comparison.
```

### Propaganda Agent  (`overthrow_propaganda_agent`) — standard

```
A creature from The Overthrow, a dungeon of the psyche. Fracture. Dull tarnished silver and bruised grey-violet, heavily desaturated. The form broken into offset shards. Tarnished and matte throughout — no mirror shine, no specular glare, no chrome.
Subject: Propaganda Agent. An upright, narrow figure of tarnished grey metal with one arm raised high in a rhetorical gesture, palm open, and the other arm swept wide. Its head is thrown back and its jaw hangs open far wider than a jaw should, a deep smooth funnel of a mouth. The body is thin and stretched.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Regime Enforcer  (`overthrow_regime_enforcer`) — standard

```
A creature from The Overthrow, a dungeon of the psyche. Fracture. Dull tarnished silver and bruised grey-violet, heavily desaturated. The form broken into offset shards. Tarnished and matte throughout — no mirror shine, no specular glare, no chrome.
Subject: Regime Enforcer. A heavy, thick-set figure of tarnished grey metal, massively built through the chest and shoulders but still standing clearly taller than it is wide, with a neckless head sunk between enormous shoulders and both fists hanging at its sides. Its face is a plain riveted plate with a single narrow horizontal slit.
Scale: human-scaled, upright, the baseline threat of this place.
```

### Grand Inquisitor  (`overthrow_grand_inquisitor`) — elite

```
A creature from The Overthrow, a dungeon of the psyche. Fracture. Dull tarnished silver and bruised grey-violet, heavily desaturated. The form broken into offset shards. Tarnished and matte throughout — no mirror shine, no specular glare, no chrome.
Subject: Grand Inquisitor. A tall, gaunt figure of tarnished grey metal in a long stiff floor-length robe of the same metal, hands folded calmly in front, head slightly inclined as if listening. Its face is a serene smooth mask with closed eyes. Elongated and still, taller than any other figure here.
Scale: taller and heavier than a person, asymmetric, visibly more dangerous at a glance.
```

### The Pretender  (`overthrow_the_pretender`) — boss

```
A creature from The Overthrow, a dungeon of the psyche. Fracture. Dull tarnished silver and bruised grey-violet, heavily desaturated. The form broken into offset shards. Tarnished and matte throughout — no mirror shine, no specular glare, no chrome.
Subject: The Pretender. A monumental figure of tarnished grey metal filling the frame: magnificent above the waist — broad shouldered, upright, a great sweep of folded metal wings held close behind it — and degraded below, where the legs have fused into one thick serpentine tail that coils upward into a tall vertical column beneath it rather than spreading out across the ground. Its face is a beautiful blank mask tilted slightly upward.
Scale: monumental — fills the frame, broad-shouldered or horned, unmistakably the authority of this dungeon.
```

---

**Gesamt: 42 Gegner.**
