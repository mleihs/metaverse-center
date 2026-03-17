"""Cross-reality contamination vocabulary and pre-written prompts for embassy images.

Embassy buildings and ambassador agents have a unique visual signature: they show
subtle contamination from a partner simulation bleeding through their native
aesthetic. This module encodes the visual intelligence needed to generate those
images — both as pre-written prompts for demo data and as vocabulary for dynamic
template-driven generation.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 1. CONTAMINATION_VOCABULARY
# ---------------------------------------------------------------------------
# When simulation X bleeds INTO another world, these elements appear.
# Keyed by simulation slug → category → list of descriptors.

CONTAMINATION_VOCABULARY: dict[str, dict[str, str]] = {
    "velgarien": {
        "materials": (
            "raw poured concrete, rusted rebar exposed through cracked surfaces, "
            "stamped galvanized steel, carbon-copy paperwork, typewriter ribbon "
            "ink stains, institutional linoleum flooring"
        ),
        "lighting": (
            "harsh overhead fluorescent tubes with cold white flicker, flat "
            "institutional lighting with no warmth, light that creates "
            "bureaucratic precision — no shadows allowed to be ambiguous"
        ),
        "textures": (
            "brutalist board-marked concrete (wood grain pressed into cement), "
            "rubber stamp impressions on surfaces, filing cabinet drawer tracks "
            "worn smooth, carbon-paper smudges on stone"
        ),
        "objects": (
            "filing cabinets (grey, dented, slightly wrong proportions), rubber "
            "stamps with illegible text, pneumatic tube capsules, Bakelite "
            "telephones, wall-mounted intercom grilles, propaganda poster fragments"
        ),
        "atmosphere": (
            "institutional dampness, the smell of mimeograph fluid (rendered as "
            "blue-purple chemical haze), overcast light quality even underground/"
            "in space, oppressive geometric precision intruding on organic forms"
        ),
        "color": (
            "desaturated greys bleeding into warm palettes, cold institutional "
            "blue-grey overwriting ambient color, concrete dust coating surfaces"
        ),
    },
    "the-gaslit-reach": {
        "materials": (
            "bioluminescent fungal growth, phosphorescent water stains, Victorian "
            "brass fittings corroded by damp, carved limestone with fossil "
            "impressions, wax-sealed parchment, ink that glows faintly"
        ),
        "lighting": (
            "bioluminescent glow in deep green and amber, light emanating from "
            "below surfaces, phosphorescent water reflection on ceilings, light "
            "that pulses with a slow organic rhythm"
        ),
        "textures": (
            "damp stone with moss colonization, spore-dusted surfaces, copper "
            "patina (verdigris), wet Victorian leather bindings, slick dampness "
            "on unexpected surfaces as though something recently passed"
        ),
        "objects": (
            "luminous mushrooms growing from cracks in wrong materials, brass "
            "navigation instruments (sextants, compasses with too many cardinal "
            "points), Victorian specimen jars with unclassifiable contents, "
            "ink-stained quill pens, scratches of too-long fingers in dust"
        ),
        "atmosphere": (
            "warm humid fog that smells of copper and earth, the sense of vast "
            "depth beneath floors, dripping sounds from impossible sources, "
            "cave-breath — warm exhalations from below"
        ),
        "color": (
            "deep emerald green encroaching on sterile environments, amber warmth "
            "interrupting cold palettes, bioluminescent cyan-green glow bleeding "
            "through walls"
        ),
    },
    "station-null": {
        "materials": (
            "aerospace-grade aluminum panels with hex-bolt rivets, black rubber "
            "cable conduit, acrylic observation port glass (scratched, clouded), "
            "military-spec polymer, recycled air duct mesh"
        ),
        "lighting": (
            "green-tinted CRT monitor glow, red emergency klaxon wash, sickly "
            "fluorescent flicker in the wrong color temperature for the world, "
            "light that feels recycled — stale photons"
        ),
        "textures": (
            "condensation on cold metal surfaces, biological film on aerospace "
            "alloys, static discharge marks (branching lightning patterns), frost "
            "crystals forming in impossible warmth"
        ),
        "objects": (
            "parabolic antenna fragments, circuit boards with organic growth "
            "between traces, medical monitoring readouts (heart rate, O2 levels) "
            "appearing on wrong surfaces, umbilical cable connectors, EVA suit "
            "gaskets, airlock pressure gauges"
        ),
        "atmosphere": (
            "recycled air quality — sterile yet somehow wrong, the hum of life "
            "support systems expressed as vibration in walls, cosmic radiation "
            "rendered as faint static visual noise, the vacuum pressing inward"
        ),
        "color": (
            "sickly green-white fluorescent wash, CRT phosphor green, emergency "
            "red underlighting bleeding into warm palettes"
        ),
    },
    "speranza": {
        "materials": (
            "sun-bleached limestone, rope fiber (hemp, jute) replacing cables or "
            "wires, salvaged pre-Fracture glass with patina, terracotta fragments, "
            "Italian ceramic tile chips, warm clay"
        ),
        "lighting": (
            "warm amber from string lights and salvaged bulbs, golden "
            "Mediterranean sunlight quality (even underground/in space), firelight "
            "warmth, light filtered through fabric canopies"
        ),
        "textures": (
            "wind erosion on stone, rope-wrapped structural supports, "
            "hand-painted signage on scavenged metal, olive wood grain, soil and "
            "root systems growing through constructed surfaces"
        ),
        "objects": (
            "hand-drawn maps on leather, radio antennae improvised from salvaged "
            "metal, olive branches growing from impossible locations, terracotta "
            "planters with Mediterranean herbs, string-light garlands, Italian "
            "wine bottles repurposed as vessels"
        ),
        "atmosphere": (
            "warm dry air carrying the scent of rosemary and dust, the quality "
            "of hope — rendered as golden light bleeding through cracks, the "
            "sound of distant radio static carrying human voices, survivors' "
            "ingenuity visible in every repair"
        ),
        "color": (
            "warm amber-gold bleeding into cold environments, terracotta warmth "
            "replacing sterile surfaces, Mediterranean blue sky tones appearing "
            "where no sky should be"
        ),
    },
}


# ---------------------------------------------------------------------------
# 2. VECTOR_VISUAL_LANGUAGE
# ---------------------------------------------------------------------------
# How contamination manifests visually, keyed by bleed vector name.

VECTOR_VISUAL_LANGUAGE: dict[str, str] = {
    "memory": (
        "Temporal palimpsest — layered images where one reality shows through "
        "another like an overexposed photograph or a pentimento painting. "
        "Surfaces that display two states simultaneously. Double-exposed quality: "
        "ghost images of the partner world bleeding through solid surfaces. "
        "Objects that look like they remember being something else. Faded, "
        "sepia-toned contamination at the edges of the frame. Key visual: "
        "material surfaces showing grain/texture from both worlds simultaneously."
    ),
    "resonance": (
        "Frequency interference — standing wave patterns, moire effects, and "
        "harmonic visual distortion. Two signals occupying the same space. Moire "
        "patterns where two different grid systems overlap at wrong angles. "
        "Vibration blur on surfaces, as though the building exists at two "
        "different frequencies simultaneously. Radio wave visualization — "
        "concentric wave patterns etched or stained onto surfaces. Key visual: "
        "parallel lines from both worlds creating interference patterns."
    ),
    "language": (
        "Translation artifacts — text that transforms mid-word between "
        "languages, signage that means something different when viewed from "
        "different angles, writing that writes itself. Bilingual text that "
        "transitions mid-sentence. Documents where the paper is wrong for the "
        "text. Typography anomalies — letter forms that hybridize. Key visual: "
        "the physical medium contradicting the message."
    ),
    "dream": (
        "Biological logic applied to mechanical systems and vice versa — "
        "organic growth following circuit board traces, technology that operates "
        "on ecological principles, the uncanny fusion of evolved and engineered. "
        "Bioluminescent organisms growing along circuit pathways. Metal structures "
        "developing organic branching patterns. Technology that appears to be "
        "alive. Key visual: the moment where you cannot tell if something grew "
        "or was manufactured."
    ),
    "commerce": (
        "Exchange residue — the physical evidence of trade that should not have "
        "happened. Goods, materials, and craftsmanship from one world appearing "
        "in the other's market logic. Impossible merchandise: goods displayed "
        "with the wrong world's aesthetics. Currency confusion — coins valid in "
        "both worlds. Key visual: the market stall where every item is both "
        "perfectly normal and deeply wrong."
    ),
    "desire": (
        "Hope made physical — golden light in vacuum, warmth where there should "
        "be none, the visible evidence that wanting something badly enough bends "
        "the rules of the universe. Golden warm light emanating from no source "
        "in a cold environment. Plants growing in vacuum or underground. Radio "
        "signals made visible as threads of light. Key visual: a warm, living "
        "thing in a place where it should not survive."
    ),
}


# ---------------------------------------------------------------------------
# 3. VECTOR_PERSON_EFFECTS
# ---------------------------------------------------------------------------
# How bleed vectors manifest physically on people (ambassadors).

VECTOR_PERSON_EFFECTS: dict[str, str] = {
    "memory": (
        "Eyes that focus on things that are not there, as though watching a "
        "second scene superimposed on reality. Clothing with faded stains from "
        "substances that do not exist in this world."
    ),
    "resonance": (
        "A faint vibration visible in the hands or jaw, like standing near "
        "heavy machinery. Hair that carries static. Equipment that hums at the "
        "wrong frequency when they touch it."
    ),
    "language": (
        "Lips that move slightly when reading, as though translating internally. "
        "Ink stains on fingers from writing in a script they do not consciously "
        "know."
    ),
    "dream": (
        "Eyelids heavy with visions, pupils dilated as though adjusting between "
        "two light sources. Organic material growing in their clothing seams as "
        "though their body has become an environment."
    ),
    "commerce": (
        "Hands that unconsciously sort and arrange objects. Pockets visibly "
        "heavy with inventory from elsewhere. The look of a merchant who has "
        "priced things in a currency they cannot name."
    ),
    "desire": (
        "A warmth about the person that does not match their environment — "
        "flushed skin in cold, or a glow that seems internal. Eyes that are "
        "looking at something beautiful that is not visible."
    ),
}


# ---------------------------------------------------------------------------
# 4. PRE-WRITTEN BUILDING PROMPTS
# ---------------------------------------------------------------------------
# Hand-crafted Flux Dev prompts for the 12 demo embassy buildings.
# Keyed by building name (must match buildings.name in migration 028).

EMBASSY_BUILDING_PROMPTS: dict[str, str] = {
    "Room 441": (
        "windowless government office interior, fourth floor institutional space, "
        "brutalist concrete walls with inexplicable moisture patterns, rows of "
        "grey steel filing cabinets with documents visible in open drawers, harsh "
        "overhead fluorescent tube lighting casting flat institutional white, "
        "linoleum floor tiles showing decades of foot traffic, typewriter on grey "
        "metal desk, carbon copy forms stacked in wire trays, one filing cabinet "
        "drawer containing waterlogged documents on parchment that glows faintly "
        "amber and green, moisture stains on concrete ceiling that form the "
        "impression of stalactites, the cabinet handles showing verdigris patina "
        "incongruous with steel, a single small luminous mushroom growing from a "
        "crack where wall meets floor — the only organic element in a rigidly "
        "geometric space, ghost image of carved limestone visible in concrete "
        "grain like a photographic double exposure"
    ),
    "The Threshold": (
        "underground limestone cavern transitioning into impossible corridor, "
        "natural cave opening carved with Victorian archway frame, beyond the "
        "arch the walls become flat poured concrete — a material unknown in this "
        "world, fluorescent tube lighting visible down the corridor casting cold "
        "flat white against warm bioluminescent green, filing cabinets embedded "
        "in limestone as though fossilized there, documents in an archaic "
        "script scattered on both stone floor and linoleum, bioluminescent fungi "
        "growing along the corridor ceiling but arranged in the precise "
        "rectangular grid of an institutional ceiling tile pattern, brass oil "
        "lamp on a concrete shelf, moisture dripping from stalactites onto carbon "
        "copy paper, the concrete walls showing wood-grain formwork impressions "
        "that look like fossilized tree bark to cavern inhabitants, Victorian "
        "brass fittings bolted to brutalist concrete door frame, deep emerald "
        "bioluminescence fading to cold fluorescent white"
    ),
    "The Static Room": (
        "sealed Cold War bunker room, reinforced concrete walls three feet thick, "
        "obsolete radio equipment from 1960s still powered and humming, banks of "
        "vacuum tube receivers with amber dial glow, massive Bakelite switches "
        "and galvanized steel conduit, heavy riveted blast door with wheel lock "
        "visible at frame edge, institutional grey paint peeling to reveal "
        "concrete underneath, stacks of classified transmission logs in wire "
        "baskets, moire interference pattern visible where concrete formwork grid "
        "meets an overlay of hex-bolt riveted aerospace aluminum panels on one "
        "wall — materials that should not be in a 1962 bunker, condensation "
        "forming on that metal wall despite the room being dry, pressure gauge "
        "mounted near the door reading in units not used on Earth, the radio "
        "dials all tuned to the same impossible frequency, faint vibration blur "
        "on equipment edges as though the room exists at two frequencies "
        "simultaneously"
    ),
    "Relay Chamber 7": (
        "cramped station communications bay, aerospace aluminum wall panels with "
        "exposed hex-bolt rivets, banks of signal processing receivers with green "
        "phosphor oscilloscope displays, black rubber cable conduit running along "
        "ceiling, harsh overhead fluorescent tubes casting sickly green-white "
        "light, industrial metal grating floor with condensation pooling below, "
        "one wall section replaced with poured concrete — raw brutalist "
        "board-marked surface incongruous with station architecture, a filing "
        "cabinet of grey steel wedged between equipment racks looking "
        "institutional rather than aerospace, moire patterns visible where "
        "station hull rivets align with concrete formwork lines creating visual "
        "interference beats, radio equipment receiving transmissions on "
        "frequencies that predate the station by two centuries, warmth anomaly — "
        "condensation on walls suggesting atmosphere from elsewhere, typewriter "
        "ribbon ink stains on equipment manifests, the room reads the same "
        "impossible number on both station and terrestrial gauges"
    ),
    "Archive Sub-Level C": (
        "deep underground archive vault, reinforced steel shelving extending "
        "into darkness, emergency red lighting mixed with cold fluorescent tubes, "
        "temperature-controlled government document storage, concrete floor with "
        "painted zone markings, classified document boxes stacked methodically on "
        "shelves, heavy steel security door with combination lock visible at "
        "frame edge, one section of shelving holding documents on paper that "
        "analysis cannot classify — warm cream Italian stock rather than standard "
        "government grey, the text visible on exposed pages transitioning from "
        "German typescript to handwritten Italian mid-sentence, shelf labels in "
        "regulation Fraktur typeface but the metal label plates are sun-bleached "
        "terracotta instead of steel, a faint scent of rosemary rendered as "
        "golden ambient warmth in one corner that defies the cold fluorescent "
        "lighting, a hand-drawn map pinned to a filing box showing a city that "
        "appears on no Velgarien geography, bilingual annotations where Fraktur "
        "serifs merge with Italian humanist letterforms"
    ),
    "The Paper Room": (
        "underground limestone fortress chamber with arched ceiling, rough-hewn "
        "stone walls with mineral deposit streaks, warm amber lighting from "
        "salvaged string light bulbs strung along rope supports, crude wooden "
        "table with hand-forged iron legs, stacked documents in impossibly "
        "perfect condition — industrial precision paper manufactured with methods "
        "Speranza cannot replicate, German text in regulation typescript "
        "describing this city by name with accurate maps, the paper stock cold "
        "institutional grey against warm limestone surroundings, one wall where "
        "limestone transitions to what looks like poured concrete that someone "
        "has tried to cover with hanging fabric, a rubber stamp impression on "
        "the stone floor — administrative markings in a language from an absent "
        "bureaucracy, a typewriter key imprint visible in clay as though the "
        "stone itself was once a carbon copy, hand-painted Italian signage next "
        "to stamped German regulation placards, the paper approximately negative "
        "forty years old according to dating"
    ),
    "The Drowned Antenna": (
        "alien structure rising from Unterzee floor, parabolic antenna array "
        "constructed from materials unknown in this world encrusted with "
        "bioluminescent coral and anemone growth, aerospace aluminum framework "
        "visible beneath layers of living organism, the dish surface covered in "
        "phosphorescent sea life that pulses with rhythmic light matching a "
        "mechanical heartbeat, cable conduit from the structure's core following "
        "organic branching patterns identical to mycelium networks, the antenna "
        "hum vibrating the water in standing wave patterns visible as concentric "
        "rings of luminescence, small CRT-green indicator lights visible beneath "
        "coral growth still functioning after unknown years submerged, circuit "
        "board traces visible through translucent organism growth — the "
        "technology and the biology sharing the same pathway architecture, brass "
        "Victorian diving bell observation port mounted incongruously on the "
        "structure's access hatch, deep emerald and amber bioluminescence "
        "competing with sickly green station phosphor glow"
    ),
    "Bio-Lab Omega": (
        "sealed station laboratory interior, sterile white wall panels now "
        "stained with bioluminescent residue in amber and deep green, "
        "containment unit glass foggy with internal condensation, industrial "
        "metal examination table surrounded by specimen racks, harsh fluorescent "
        "overhead lighting competing with organic green-amber glow emanating "
        "from biological film on walls, microscope station with slides containing "
        "organisms that defy classification, the floor grating partially flooded "
        "with luminous liquid smelling of copper and earth — liquid from "
        "somewhere that is not the station's water supply, the bioluminescent "
        "organisms organized in patterns following the room's electrical conduit "
        "layout as though the biology is wiring itself into the station's "
        "circuits, mushroom cap forms growing from wall joints with the precise "
        "hexagonal geometry of station hull panels, condensation on every surface "
        "carrying faint phosphorescent shimmer, laboratory equipment that appears "
        "to be growing rather than corroding, Victorian brass specimen jar on a "
        "modern steel shelf — wrong era, wrong world"
    ),
    "The Warm Market": (
        "underground cavern market section with anomalous temperature zone, "
        "stone vendor slabs arranged in traditional bazaar pattern beneath "
        "stalactite ceiling, warm amber light replacing the usual bioluminescent "
        "green-blue in this section only, bioluminescent mushroom varieties "
        "displayed alongside sun-dried goods that should not exist underground — "
        "herbs still warm from sunlight that ended centuries ago, terracotta pots "
        "incongruous with Victorian brass market fixtures, one vendor stall "
        "constructed from sun-bleached limestone rather than dark cave stone, "
        "hand-painted Italian price signs next to Victorian copperplate merchant "
        "notices, salvaged string lights strung between stalactites mimicking the "
        "arrangement of an above-ground market, woven fabric awnings in "
        "Mediterranean patterns stretched between stone columns, impossible "
        "merchandise — maps of underground passages in a geography matching no "
        "known Reach territory, a merchant with too-long fingers in a warm leather apron "
        "stitched with rope rather than thread, warm air currents rising from "
        "the stall carrying scent of rosemary and clay"
    ),
    "The Deep Stall": (
        "rough market stall in underground settlement marketplace, limestone "
        "cavern walls with salvaged rope bridge railing visible above, warm "
        "amber string light illumination on crude wooden display tables, the "
        "stall sells impossible merchandise — mushrooms that glow with "
        "bioluminescent green-amber light, fabric woven from spun light that "
        "shimmers with phosphorescence, maps drawn on damp parchment showing "
        "underground passages that match no known geography, the merchant is "
        "always the same figure — someone too tall, with fingers too long, smiling "
        "behind the counter with Victorian-era brass scales and specimen jars "
        "for measuring goods, Victorian brass fittings on the stall framework "
        "incongruous with Speranza's salvaged-industrial aesthetic, a single "
        "terracotta pot holding a glowing fungal colony in place of the usual "
        "herb garden, damp cave-smell mixing with warm Mediterranean air, copper "
        "patina on the merchant's coin collection, bioluminescent residue "
        "staining the stall's wooden surfaces where the impossible goods have "
        "rested, the prices written in a currency no one remembers establishing "
        "but everyone accepts"
    ),
    "The Garden": (
        "unauthorized cultivation space in station lower decks, Mediterranean "
        "plants growing impossibly in vacuum-adjacent compartment, olive tree "
        "and rosemary bushes in soil identified as Tuscan clay — warm terracotta "
        "earth in aerospace metal planting troughs, warm golden light emanating "
        "from no identifiable source in a station lit only by fluorescent tubes, "
        "the golden amber glow competing with sickly green station fluorescence "
        "creating zones of impossible warmth, tomato vines climbing cable conduit "
        "with tendrils wrapping hex-bolt rivets, condensation on surrounding "
        "metal walls but the garden area is dry and warm, industrial metal "
        "grating floor partially buried under earth that should not be here, "
        "string light bulbs — the warm amber salvaged type from Speranza — wired "
        "into the station's electrical system, a hand-drawn map of a settlement "
        "on Earth pinned to a cable junction box, the air smells of hope which "
        "registers on station sensors as an unclassified warm atmospheric "
        "compound, radio static faintly audible carrying human voices speaking "
        "Italian, the plants are thriving in conditions that should kill them"
    ),
    "The Star Tower": (
        "salvaged radio tower on fortress peak, highest point in underground "
        "sinkhole city with limestone cavern ceiling visible far above, "
        "jury-rigged parabolic antenna assembled from pre-Fracture salvaged "
        "metal and aerospace aluminum panels that no one in Speranza "
        "manufactured, warm amber string lights illuminating the observation "
        "platform alongside a faint green-white glow from the receiver equipment "
        "that matches no Speranza light source, radio receiver banks built from "
        "salvaged components showing hex-bolt rivets and aerospace polymer "
        "housings, the antenna pointed upward through a natural chimney in the "
        "limestone toward stars 340 light-years away, printout tape from the "
        "receiver showing coordinates repeated alongside atmospheric readings "
        "matching a failing life support system, cold condensation forming on "
        "the aerospace metal despite the warm ambient air, a pressure gauge "
        "reading in units Speranza does not use mounted on the receiver housing, "
        "rope bridge access platform with hand-forged iron railings, the "
        "receiver hums at a frequency that makes the limestone resonate, a "
        "single indicator light glowing CRT phosphor green among warm amber"
    ),
}


# ---------------------------------------------------------------------------
# 5. PRE-WRITTEN AMBASSADOR PORTRAIT PROMPTS
# ---------------------------------------------------------------------------
# Hand-crafted Flux Dev prompts for the 4 ambassador agents.
# Keyed by agent name (must match agents.name in migration 028).

AMBASSADOR_PORTRAIT_PROMPTS: dict[str, str] = {
    "Inspektor Mueller": (
        "middle-aged Germanic man, late 50s, precise haircut going grey at "
        "temples, thin wire-frame spectacles, deep-set analytical eyes that "
        "focus on two distances simultaneously — watching something layered over "
        "reality, clean-shaven jaw with deep lines of decades of frowning at "
        "impossible paperwork, regulation grey suit jacket showing wear at "
        "elbows, collar pressed but with faint verdigris stain at the neck as "
        "though copper dust has settled into the fabric, ink stains on right "
        "hand fingers in two different colors — standard black and a faint "
        "bioluminescent amber that should not exist, breast pocket holding both "
        "a regulation pen and a brass compass with too many cardinal directions, "
        "exhaustion of a man who has catalogued every impossibility and filed "
        "each one correctly, harsh overhead fluorescent lighting, institutional "
        "concrete background"
    ),
    "Archivist Quill": (
        "ancient androgynous figure of indeterminate age, near-blind milky eyes "
        "behind small round Victorian spectacles, fingers conspicuously too long "
        "for their hands — seven-jointed and ink-stained in two scripts, one "
        "Victorian copperplate and one regulation German typescript written "
        "simultaneously, elaborate Victorian archivist robes in deep burgundy "
        "with brass button closures, one lapel bearing an incongruous rubber "
        "stamp impression — a Velgarien administrative seal pressed into the "
        "fabric, carrying a specimen jar containing a faintly luminous liquid "
        "that reflects green off their spectacles, warm bioluminescent "
        "amber-green lighting from below, damp stone archival chamber background "
        "with filing cabinet shadows, expression of patient methodical exhaustion "
        "— three months without sleep and still cross-referencing, subtle "
        "wrongness in proportions that the viewer cannot quite identify"
    ),
    "Navigator Braun": (
        "woman in early 30s, sharp features drawn tight with contained unease, "
        "dark hair pulled back severely but with loose strands carrying visible "
        "static charge, intense dark eyes with slightly dilated pupils as though "
        "adjusting between two light sources — one fluorescent and one warm "
        "amber, visible dark circles and sweat sheen, olive-drab station "
        "jumpsuit with mission patches, the jumpsuit collar bearing embroidered "
        "Mediterranean herb stems — rosemary pattern she does not remember "
        "adding, utility belt holding navigation tools alongside a hand-drawn "
        "map on leather that depicts a settlement she has never visited with "
        "perfect accuracy, soil residue under fingernails from tending "
        "impossible plants, faint golden warmth to her skin incongruous with "
        "station pallor, a small terracotta bead on a cord around her neck, "
        "harsh overhead fluorescent lighting with green-white cast, industrial "
        "corridor background with condensation on metal walls, expression of "
        "quiet wonder suppressed by scientific discipline"
    ),
    "Padre Ignazio": (
        "elderly Italian man, mid 70s, deeply weathered sun-darkened face with "
        "kind creased eyes, short white hair and close-cropped white beard, "
        "former priest's bearing — upright posture with gentle forward lean of "
        "a listener, worn utilitarian clothing in warm earth tones — canvas "
        "jacket with rope-fiber patches, one jacket pocket visibly heavy and "
        "square-shaped as though carrying government-standard filing cards from "
        "a bureaucracy that does not exist here, hands showing ink stains in "
        "regulation German typescript blue alongside normal dirt and calluses, "
        "reading glasses on a cord around his neck with one lens faintly tinted "
        "CRT phosphor green from unknown origin, warm amber string light "
        "illumination, limestone wall background with mineral deposits, a small "
        "radio receiver tucked into his belt emitting faint green indicator glow "
        "among warm amber environment, expression of a man who found German "
        "documents describing his city's future and decided this was a parish "
        "in need of a custodian"
    ),
}
