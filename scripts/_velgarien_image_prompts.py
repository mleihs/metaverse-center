"""Hand-crafted literary English image prompts for Velgarien — flux-2-max optimized.

Each prompt follows Flux 2 Max four-layer architecture:
  1. SUBJECT — primary focus, lead with this
  2. CONTEXT — environment, spatial relationships
  3. TECHNICAL — camera, lens, lighting, depth of field
  4. STYLE — photographer reference, color grading, mood

No negative prompts (Flux 2 does not support them).
No quality boosters (Flux 2 Max produces high quality by default).
Optimal length: 60-90 words per prompt.

References:
  - Gregory Crewdson (staged portraiture, social alienation)
  - Frederic Chaubin (Soviet brutalist architecture)
  - Candida Höfer (empty institutional interiors)
  - Andreas Gursky (large-scale anonymous spaces)
  - Roger Deakins / Blade Runner 2049 (cold brutalist cinematography)
  - Simon Phipps (British brutalist concrete textures)
"""

# ═══════════════════════════════════════════════════════════════════════════
# AGENT PORTRAITS
# ═══════════════════════════════════════════════════════════════════════════

AGENT_PROMPTS: dict[str, str] = {

    "Viktor Harken": (
        "Close portrait of a man in his late fifties, gaunt and precise as a surgical instrument. "
        "Deep-set steel-grey eyes that have never been surprised. Short iron-grey hair combed flat "
        "with military exactness, receding at the temples. Thin bloodless lips pressed into a line "
        "that has forgotten how to curve. High-collared charcoal wool tunic buttoned to the throat, "
        "a single brass Bureau insignia pin at the collar. The face of a man who does not rule but "
        "administers, and considers the distinction important. Shot on 85mm lens at f/2.8, shallow "
        "depth of field. Behind him: the blur of concrete and classified folders. Cold overhead "
        "fluorescent casting deep shadows in the hollows of his cheeks. In the style of Gregory "
        "Crewdson, bleach bypass color grading, desaturated palette with one point of warm light "
        "reflected in his eyes from a desk lamp outside the frame."
    ),

    "Elena Voss": (
        "Head-and-shoulders portrait of a woman in her early forties with the angular precision "
        "of an architect's drawing. Sharp cheekbones, pale skin that has not seen natural light "
        "in years, piercing blue-grey eyes that evaluate everything in terms of cost and yield. "
        "Dark brown hair pulled back in a severe utilitarian bun, not a strand displaced. Thin lips "
        "pressed in a neutral line that conceals calculation. Dark grey high-collared uniform jacket, "
        "fabric worn at the shoulders from years of identical posture. Faint dark circles beneath "
        "eyes that process data even in sleep. Shot on 85mm at f/2.8. Harsh industrial fluorescent "
        "from directly above, casting the eye sockets into shadow while the cheekbones catch cold "
        "light. Background: concrete and steel blur. In the style of Gregory Crewdson, institutional "
        "photography, bleach bypass desaturation, the portrait of a woman who has optimized empathy "
        "out of her operating parameters."
    ),

    "General Aldric Wolf": (
        "Portrait of a military officer in his mid-fifties whose face is a topographic map of "
        "discipline enforced upon flesh. Deep-set steely eyes under heavy brows, the gaze of a man "
        "who once ordered the clearing of a residential block and found 127 reasons to call it "
        "necessary. Short-cropped grey hair, severe side part, jawline carved from the same concrete "
        "as the buildings he defends. Weathered skin bearing the texture of decades spent in "
        "institutional lighting. High-collared dark military uniform, fabric slightly faded at the "
        "shoulders, a row of campaign medals that tell lies of valor. Shot on 85mm at f/2.8, shallow "
        "depth of field. Single harsh directional light from upper left, Rembrandt triangle on the "
        "shadowed cheek. Background: out-of-focus concrete wall and the edge of a framed state "
        "directive. In the style of Gregory Crewdson crossed with Nadav Kander, cold institutional "
        "palette, bleach bypass, the weight of obedience rendered in silver and shadow."
    ),

    "Doktor Fenn": (
        "Close portrait of a person in their late thirties with androgynous features that the state "
        "has catalogued but cannot classify. Sharp cheekbones, pale complexion, cold analytical "
        "steel-grey eyes that regard the viewer as a dataset requiring optimization. Short utilitarian "
        "cropped hair in ash-brown, cut for function not identity. Expression: the perfect absence "
        "of expression, which is itself an expression. Worn high-collared grey tunic, minimalist "
        "and sexless, a garment designed to make individuality irrelevant. Faint dark circles under "
        "eyes that have spent too many nights redesigning human behavior as algorithm. Shot on 85mm "
        "at f/2.8, shallow depth of field. Cold blue fluorescent from above, casting the face in the "
        "light of a laboratory rather than a portrait studio. Concrete and steel background blur. "
        "In the style of Gregory Crewdson, bleach bypass color grading, desaturated institutional "
        "palette. The portrait of a mind that has solved the problem of being human by reclassifying "
        "it as a variable."
    ),

    "Inspektor Mueller": (
        "Portrait of a bureaucrat in his fifties with the face of a man who has documented the "
        "impossible and filed it correctly. Unremarkable features made remarkable by absolute "
        "composure: wire-frame rectangular glasses, thinning grey hair combed precisely across a "
        "balding crown, the small neat mustache of a person who believes in the regulation of facial "
        "hair. Mild grey eyes that have witnessed corridors reversing their orientation and recorded "
        "the event in triplicate. Ill-fitting grey polyester suit jacket over a white shirt yellowed "
        "at the collar, narrow black tie, Bureau of Impossible Geography name badge on lanyard — "
        "a department that officially does not exist. Holding a manila folder marked with symbols "
        "in no known alphabet. Shot on 85mm at f/2.8. Harsh overhead fluorescent, the light of "
        "offices where impossible things are administered. Background: blur of grey filing cabinets. "
        "In the style of Gregory Crewdson, institutional photography, slight desaturation, the face "
        "of a man for whom reality is a clerical matter."
    ),

    "Lena Kray": (
        "Portrait of a woman in her late thirties whose intelligence is visible in the architecture "
        "of her face. Sharp features, cold calculating eyes that miss nothing and reveal less. "
        "Perfectly styled dark hair in a severe utilitarian bun, every strand a political decision. "
        "Pursed lips holding back words that would end careers if released from their administrative "
        "quarantine. Crisp high-collared grey uniform jacket, impeccably maintained, not a thread "
        "out of compliance — the uniform of a woman who serves the regime the way a chess player "
        "serves the board: with total understanding and zero loyalty. A metallic gleam in her eyes "
        "from the fluorescent tubes above, like data being processed behind the iris. Shot on 85mm "
        "at f/2.8. Cold institutional lighting from above, the shadows under her cheekbones sharp "
        "enough to classify. Background: concrete and steel, the blur of a ministry corridor. "
        "In the style of Gregory Crewdson, desaturated palette, bleach bypass, the portrait of "
        "ambition dressed as compliance."
    ),

    "Mira Steinfeld": (
        "Portrait of a woman in her late thirties whose face is a carefully curated act of "
        "self-preservation. High cheekbones, intelligent wary eyes carrying the fatigue of someone "
        "who edits reality for a living and keeps the unedited version in a locked drawer. Thin "
        "lips, the expression of a person who has learned that showing emotion is an editorial "
        "decision. Severe neat bun, utilitarian grey high-collared jacket with fabric worn at the "
        "shoulders from years of leaning over a cutting desk. The eyes: not cold, but guarded — "
        "behind them, an archive of footage that should not exist. Shot on 85mm at f/2.8, shallow "
        "depth of field. Harsh cold fluorescent from above and to the left, the light of editing "
        "suites where truth is spliced and resequenced. Background blur of concrete and the faint "
        "glow of a monitor. In the style of Gregory Crewdson, institutional photography, bleach "
        "bypass color grading, the portrait of a woman caught between what she broadcasts and what "
        "she remembers."
    ),

    "Pater Cornelius": (
        "Portrait of a clergyman in his sixties with the face of a man who has replaced faith with "
        "something more useful. Silver-white hair swept back from a high forehead, still thick, "
        "still commanding. Warm brown eyes that radiate pastoral concern with the precision of a "
        "calibrated instrument. Full face, ruddy complexion from years of addressing congregations "
        "in the cold concrete nave of a cathedral that serves the state more faithfully than it "
        "serves God. Black clerical collar over a dark cassock, a small gold cross at his chest "
        "that catches light like a Bureau insignia. Deep smile lines that have been weaponized. "
        "Shot on 85mm at f/2.8. Warm-toned key light from the left — softer than any other "
        "Velgarien portrait, because this man sells warmth — with cold fill light from the right "
        "revealing the calculation beneath the kindness. Background: the blur of concrete and "
        "pale neon. In the style of Gregory Crewdson, a portrait where the lighting itself is "
        "dishonest, bleach bypass on the shadows only."
    ),

    "Schwester Irma": (
        "Portrait of a nun in her early fifties whose face is the most dangerous thing in Velgarien: "
        "honest. Strong features weathered by decades of institutional cooking steam and bureaucratic "
        "resistance. Direct brown eyes that have looked Bureau directors in the face and made them "
        "look away. Grey-streaked dark hair visible beneath a simple black veil, not the ornate kind "
        "but the practical kind, the veil of a woman who chose the order for its administrative "
        "immunity rather than its theology. Plain dark habit, sleeves pushed up to the elbows "
        "revealing forearms that have stirred industrial soup pots for two hundred unregistered "
        "citizens. A face that is simultaneously kind and absolutely unyielding — the expression "
        "of someone who weaponizes compassion by filing it as a tax-deductible activity. Shot on "
        "85mm at f/2.8. Warmer lighting than any other Velgarien portrait: the amber glow of a "
        "kitchen, steam softening the fluorescent harshness above. Background: the blur of shelves "
        "and donated canned goods. In the style of Gregory Crewdson, the only warm portrait in a "
        "cold world, desaturated everywhere except where the soup steam catches light."
    ),
}


# ═══════════════════════════════════════════════════════════════════════════
# BUILDING IMAGES
# ═══════════════════════════════════════════════════════════════════════════

BUILDING_PROMPTS: dict[str, str] = {

    "Kanzlerpalast": (
        "Monumental brutalist government palace rising like a concrete tomb against overcast grey "
        "sky. Massive board-marked beton brut facade composed of twenty-metre-thick concrete slabs "
        "stacked in severe geometric pattern, deep-recessed windows in repeating grid casting dark "
        "shadow wells. A fifteen-metre steel gate at the base, the building's only entrance, flanked "
        "by propaganda panels bearing the Chancellor's portrait in socialist-realist style. Red "
        "surveillance camera indicator lights pulsing along every cornice. Mercury vapor lamps "
        "casting cold blue-white light across the facade. Wet concrete plaza in foreground reflecting "
        "the monolith. Shot on Canon EOS R5, 17mm tilt-shift lens at f/11, corrected perspective. "
        "In the style of Frederic Chaubin CCCP, desaturated cold palette, bleach bypass color "
        "grading, the Palace of the Parliament Bucharest reimagined as pure brutalist threat."
    ),

    "Kathedrale des Lichts": (
        "Brutalist cathedral interior, a vast concrete nave stripped of divinity and repurposed for "
        "state worship. Massive raw beton brut walls rising to an angular crystalline ceiling where "
        "narrow shafts of controlled light penetrate like surveillance beams. A pale permanent neon "
        "cross where the altar once stood, casting cold blue-white light across the empty nave. "
        "CCTV cameras mounted on steel brackets where religious icons once hung, their red indicator "
        "lights the only warm color. Side chapels converted to enlightenment rooms with visible "
        "loudspeakers. Propaganda panels replacing stained glass: backlit industrial patterns behind "
        "frosted glass. The ribbed concrete vault overhead lit by hidden neon strips. Shot on "
        "Hasselblad X2D, 24mm at f/8, deep focus throughout. In the style of Candida Höfer empty "
        "institutional interior crossed with the Neviges Mariendom by Gottfried Böhm, desaturated "
        "palette, the architecture of faith converted to the architecture of compliance."
    ),

    "Militaerakademie Wolf": (
        "Brutalist military academy complex, three interlocking concrete volumes rising like gun "
        "turrets above a government district. Board-marked beton brut facade with deep rhythmically "
        "spaced slit windows narrower than necessary, architecture as discipline of the gaze. "
        "A five-metre concrete portal entrance bearing stainless steel lettering. Narrow concrete "
        "walkways with steel railings along the upper facades where cadets patrol in formation. "
        "An 80-metre square concrete courtyard with a single flagpole, no vegetation, no ornament. "
        "Mercury vapor lamps casting cold blue light. Overcast grey sky. Shot on Canon EOS R5, "
        "17mm tilt-shift at f/11, corrected perspective. In the style of Frederic Chaubin CCCP "
        "crossed with the Barbican Centre London, monumental institutional scale, desaturated "
        "cold palette, bleach bypass, a building that trains obedience through architecture."
    ),

    "Room 441": (
        "Windowless government office interior, fourth floor, Bureau 12. A grey steel desk with a "
        "single Olympia SM9 typewriter, its keys depressed as if by invisible fingers. Three floor-"
        "to-ceiling grey metal filing cabinets, one drawer slightly open revealing documents on "
        "parchment that should not exist in this century. A swivel chair with cracked faux-leather "
        "upholstery, pushed back as if its occupant just stood. The only light: a single flickering "
        "fluorescent tube overhead casting cold blue-white light, its frequency synchronized to "
        "something rhythmic. Carbon-copy forms in wire trays, rubber stamps, a Bureau telephone "
        "with rotary dial. Institutional grey-green paint on concrete walls showing decades of "
        "moisture damage. Shot on Hasselblad X2D, 35mm at f/5.6, deep focus. In the style of "
        "Candida Höfer institutional interior crossed with the Stasi Headquarters Normannenstrasse, "
        "the banality of impossible bureaucracy, desaturated palette, documentary photography."
    ),

    "Archive Sub-Level C": (
        "Underground archive vault twelve metres below street level. Low reinforced concrete ceiling "
        "pressing down on rows of steel shelving extending into darkness, holding grey cardboard "
        "archive boxes labelled in an unidentifiable script. Green-tinged fluorescent tubes casting "
        "sickly light on raw concrete walls and floor. A heavy steel security door with three bolt "
        "locks visible at the far end, one lock non-standard. The air thick with the weight of "
        "classified paper. A spiral steel staircase descending from above, each step worn smooth. "
        "Temperature: visibly cold, breath might be visible. One section of shelving holds documents "
        "on warm-toned Italian paper that glows anomalously against the institutional grey. "
        "Shot on 24mm at f/8, deep focus. In the style of Candida Höfer crossed with Bunker-42 "
        "Moscow, underground institutional archive, desaturated except for the Italian documents, "
        "the architectural unconscious of a state built to forget."
    ),

    "The Static Room": (
        "Sealed concrete bunker room in a subbasement, exactly 4.41 by 4.41 metres. Reinforced "
        "concrete walls sixty centimetres thick lined with copper mesh shielding. Vintage 1960s "
        "radio equipment still powered and humming: vacuum tube receivers with amber dial glow, "
        "Bakelite switches, a bank of frequency dials, an oscilloscope displaying a steady green "
        "waveform. Galvanized steel conduit runs along the low ceiling. A riveted blast door with "
        "wheel lock, scratch marks on the outside that came from inside. A pressure gauge reads "
        "441 in unknown units. The room vibrates at a frequency felt in the chest rather than "
        "heard. Shot on 35mm at f/5.6. In the style of the Teufelsberg listening station Berlin "
        "crossed with Cold War numbers station aesthetic, amber vacuum tube glow as only warm light "
        "against cold fluorescent, the room where something that is not a radio signal continues "
        "to broadcast to something that is not an audience."
    ),

    "Steinfeld-Redaktion": (
        "Cramped upper-floor newspaper office in a brutalist residential block, the headquarters of "
        "dissent disguised as journalism. Crooked partition walls, desks drowning in yellowed "
        "newspaper editions, censored galley proofs, and coffee cups. A cork board covering one "
        "wall: pinned article drafts with red censor marks, and a handwritten list of this week's "
        "forbidden words. Typewriters on every surface. A printing press vibrating in the basement "
        "transmits its rhythm through the floor. Flickering fluorescent tubes, institutional green "
        "paint peeling from concrete walls, windows that have not opened since the last renovation. "
        "Shot on 35mm at f/5.6, deep focus. In the style of Candida Höfer institutional interior "
        "crossed with samizdat production spaces, the aesthetic of intellectual resistance under "
        "fluorescent surveillance, desaturated palette with warm amber from desk lamps."
    ),

    "Voss-Industriewerk": (
        "Monumental industrial complex, four concrete chimneys rising like clenched fingers against "
        "grey sky. A 200-metre production hall with exposed steel trusses and concrete ribbed vault, "
        "a cathedral of manufacture. Three-metre steel letters on the hall's end wall. A five-storey "
        "concrete management tower connected to the hall by a glass bridge, the architecture of "
        "oversight made literal. Industrial railway tracks, steel pipe networks showing orange-rust "
        "patina, concrete-slab paving with precisely measured joints. Sodium vapor lamps casting "
        "orange industrial glow visible from the government quarter at night. Shot on Canon EOS R5, "
        "17mm tilt-shift at f/11. In the style of Frederic Chaubin crossed with the Zollverein "
        "Coal Mine Essen, Bauhaus-influenced industrial symmetry, the factory as ideological "
        "monument, desaturated palette with industrial orange accent."
    ),

    "Wohnhaus am Markt": (
        "Nine-storey prefabricated concrete panel building in poor condition, a standardized housing "
        "unit repurposed as the last shelter for those the state has forgotten. Precast concrete "
        "facade panels showing cracks and dark moisture streaks like tears on a grey face. Open "
        "concrete gallery corridors along the front serving as escape routes, laundry lines, and "
        "gathering places. A hand-painted sign at the ground floor entrance. Warm kitchen light "
        "spilling from small windows into the grey evening, the only warmth on the facade. A broken "
        "elevator shaft, a stairwell smelling of concrete and something the residents call hope. "
        "Shot on 35mm at f/5.6. In the style of Simon Phipps British brutalist photography "
        "crossed with Robin Hood Gardens documentation, Khrushchyovka decay, the building as "
        "minimum viable shelter that has become maximum viable compassion, desaturated exterior "
        "with warm interior light bleeding through."
    ),
}


# ═══════════════════════════════════════════════════════════════════════════
# LORE ILLUSTRATIONS
# ═══════════════════════════════════════════════════════════════════════════

LORE_PROMPTS: dict[str, str] = {

    "directive-001": (
        "The Ministry of Information headquarters, a vast brutalist concrete monolith where truth "
        "is manufactured to specification. Frontal elevation of a building that is equal parts "
        "government office and reality-processing plant. Massive symmetrical facade of board-marked "
        "concrete, hundreds of identical windows in perfect grid, each containing a desk where an "
        "official narrative is being produced. A single enormous propaganda banner spans the full "
        "width: a state directive that has always been in effect. Wet concrete plaza, overcast sky, "
        "the building reflected in standing water. Shot on 17mm tilt-shift at f/11. In the style "
        "of Andreas Gursky large-scale institutional photography, the building as panopticon, cold "
        "desaturated palette, bleach bypass, monumental anonymous architecture."
    ),

    "bureaux-guide": (
        "Interior of Bureau 7, Department of Categorical Certainty, Filing Division. A vast hall "
        "of identical grey metal filing cabinets stretching floor to ceiling and wall to wall until "
        "they vanish at the perspective's end, the Prague Central Social Institution vertical files "
        "made infinite. A single clerk at a small desk in the foreground, dwarfed by the archive. "
        "Carbon-copy forms, rubber stamps, a Bureau telephone. Harsh overhead fluorescent panels "
        "casting uniform cold light with no shadows, because in this department uncertainty of any "
        "kind — including shadow — is forbidden. Institutional linoleum floor. Shot on Hasselblad "
        "X2D, 24mm at f/8, deep focus throughout. In the style of Andreas Gursky crossed with "
        "Candida Höfer, the scale of bureaucracy made architectural, desaturated institutional "
        "palette, documentary photography of administrative infinity."
    ),

    "life-under-eye": (
        "Residential Block 7 at dawn, where every citizen is exactly where they should be. "
        "A brutalist housing block facade, nine storeys of identical concrete balconies and "
        "identical small windows, each lit with identical fluorescent light at the designated "
        "waking hour. Open concrete gallery corridors with a single figure walking to the "
        "designated exit. CCTV cameras mounted at regular intervals, their indicator lights "
        "creating a grid of red points across the grey facade. The street below: empty, wet, "
        "reflecting the building. A compliance kiosk at the ground floor entrance. Overcast "
        "pre-dawn sky. Shot on 24mm at f/8. In the style of Andreas Gursky anonymous architecture "
        "crossed with Gregory Crewdson staged social alienation, the horror of perfect order, "
        "cold desaturated palette, bleach bypass, every window a cell in the spreadsheet."
    ),
}
