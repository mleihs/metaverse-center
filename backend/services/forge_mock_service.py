"""Deterministic mock data for Forge wizard testing.

When FORGE_MOCK_MODE=true, all AI calls (OpenRouter, Tavily, Replicate) are
replaced by these instant, credit-free fixtures. Data is seed-aware for
reproducibility.
"""

from __future__ import annotations

import hashlib
import logging

logger = logging.getLogger(__name__)


def _seed_int(seed: str) -> int:
    return int(hashlib.sha256(seed.encode()).hexdigest(), 16)


# ── Phase 1: Astrolabe (research + anchors) ──────────────────────────


def mock_research_context(seed: str) -> str:
    return (
        f"[MOCK RESEARCH] Seed: '{seed}'.\n"
        "Philosophical lens: Borges' Library of Babel as information entropy.\n"
        "Sociological lens: Zygmunt Bauman's liquid modernity — identity as "
        "perpetual negotiation in a world without solid institutions.\n"
        "Aesthetic lens: Piranesi's Carceri — impossible architecture as "
        "psychological landscape."
    )


def mock_anchors(seed: str) -> list[dict]:
    h = _seed_int(seed)
    variants = [
        {
            "title": "The Cartography of Absence",
            "literary_influence": "Italo Calvino, Invisible Cities",
            "core_question": "Can a place exist if no one remembers it?",
            "bleed_signature_suggestion": "Fading ink on wet parchment",
            "description": (
                "A world built around the tension between mapping and forgetting. "
                "Every district is named after something that no longer exists there. "
                "The bureaucracy maintains detailed records of absences."
            ),
        },
        {
            "title": "The Parliament of Echoes",
            "literary_influence": "Ursula K. Le Guin, The Dispossessed",
            "core_question": "What happens when every voice is heard simultaneously?",
            "bleed_signature_suggestion": "Overlapping radio frequencies",
            "description": (
                "A society where decisions are made by acoustic consensus — literally, "
                "the loudest resonance wins. Architecture is designed for its acoustic "
                "properties. Silence is the most radical form of dissent."
            ),
        },
        {
            "title": "The Metabolic City",
            "literary_influence": "China Miéville, Perdido Street Station",
            "core_question": "What does a city eat, and what does it excrete?",
            "bleed_signature_suggestion": "Rust blooming on living metal",
            "description": (
                "A city-organism that digests its inhabitants' experiences and "
                "excretes transformed architecture. Buildings grow from emotional "
                "residue. Infrastructure is literally alive and hungry."
            ),
        },
    ]
    # Rotate based on seed for variety
    offset = h % 3
    return variants[offset:] + variants[:offset]


# ── Phase 2: Drafting (geography, agents, buildings) ─────────────────


def mock_geography(seed: str, zone_count: int = 5, street_count: int = 5) -> dict:
    h = _seed_int(seed)
    city_names = ["Meridian Null", "Achterberg", "Port Lacuna", "Voidhaven", "Caul"]
    city = city_names[h % len(city_names)]

    zone_pool = [
        {"name": "The Inkwell", "zone_type": "cultural", "description": "Where stories are distilled into liquid form and sold by the dram."},
        {"name": "Thornwalk", "zone_type": "residential", "description": "A labyrinth of terraced houses growing thorned hedges as load-bearing walls."},
        {"name": "The Furnace Quarter", "zone_type": "industrial", "description": "Perpetual smoke. The factories here produce things no one ordered."},
        {"name": "Echoplex", "zone_type": "entertainment", "description": "An amphitheatre district where yesterday's conversations replay at dusk."},
        {"name": "The Stillwater", "zone_type": "government", "description": "Administrative buildings arranged around a canal that flows in no direction."},
        {"name": "Ashgrove", "zone_type": "military", "description": "A fortified garden where trees grow ammunition instead of fruit."},
        {"name": "The Hollows", "zone_type": "slum", "description": "Underground caverns repurposed as housing. The rent is paid in secrets."},
        {"name": "Mirrorside", "zone_type": "commercial", "description": "Every shopfront reflects a slightly different version of the customer."},
    ]
    street_pool = [
        {"name": "Threadneedle Passage", "street_type": "alley"},
        {"name": "Rue du Souvenir", "street_type": "boulevard"},
        {"name": "Forgetting Lane", "street_type": "lane"},
        {"name": "The Long Exhale", "street_type": "avenue"},
        {"name": "Clinker Row", "street_type": "road"},
        {"name": "Drift Street", "street_type": "street"},
        {"name": "Parliament Way", "street_type": "avenue"},
        {"name": "The Spiral Descent", "street_type": "stairway"},
    ]

    zones = zone_pool[:zone_count]
    for i, z in enumerate(zones):
        z["zone_type"] = z.get("zone_type", "mixed")

    streets = []
    for i in range(street_count):
        s = {**street_pool[i % len(street_pool)]}
        s["zone_name"] = zones[i % len(zones)]["name"]
        streets.append(s)

    return {
        "city_name": city,
        "description": f"The city of {city} exists at the intersection of memory and bureaucracy.",
        "zones": zones,
        "streets": streets,
    }


def mock_agents(seed: str, count: int = 6) -> list[dict]:
    pool = [
        {
            "name": "Vesper Caine",
            "gender": "female",
            "system": "The Cartographers",
            "primary_profession": "Archivist",
            "character": "Meticulous, sardonic, and quietly furious. Vesper catalogues what others forget, which means she remembers everything — a condition she considers a disability.",
            "background": "Former census-taker who discovered that three districts had been removed from official records. Her investigation cost her a promotion and a husband. She considers this a fair trade.",
        },
        {
            "name": "Harlan Moss",
            "gender": "male",
            "system": "The Foundry",
            "primary_profession": "Forgewright",
            "character": "Laconic and burn-scarred. Speaks mostly to metal. Believes that everything worth saying has already been hammered into shape by someone with better tools.",
            "background": "Third-generation furnace operator who discovered that the factory's output is consumed by something beneath the building. He feeds it anyway. What else would he do?",
        },
        {
            "name": "Sable Drest",
            "gender": "non-binary",
            "system": "The Echoplex",
            "primary_profession": "Resonance Broker",
            "character": "Silver-tongued and ethically flexible. Sable trades in echoes — recorded conversations, ambient emotions, the acoustic fingerprints of rooms where important things happened.",
            "background": "Grew up in the Hollows, where sound carries strangely. Learned early that a whisper in the right corridor is worth more than a shout in the square.",
        },
        {
            "name": "Orin Keelhaul",
            "gender": "male",
            "system": "The Stillwater",
            "primary_profession": "Tide Clerk",
            "character": "Pedantic, anxious, secretly romantic. Orin measures the canal's non-directional flow with instruments of his own devising. His reports are beautiful and incomprehensible.",
            "background": "Applied to the Bureau of Hydrology seven times before being accepted. His thesis — 'On the Emotional Viscosity of Municipal Water' — remains the department's most borrowed text.",
        },
        {
            "name": "Elara Vex",
            "gender": "female",
            "system": "The Inkwell",
            "primary_profession": "Story Distiller",
            "character": "Warm, pragmatic, and slightly dangerous. Elara converts narratives into consumable liquid form. She insists the process is purely chemical. Her customers report hallucinations anyway.",
            "background": "Trained as a chemist, retrained as a bartender, finally found her calling at the intersection. Her shop, 'The Final Draft', is both a pun and a threat.",
        },
        {
            "name": "Wick Solander",
            "gender": "male",
            "system": "Ashgrove",
            "primary_profession": "Orchardist-Militant",
            "character": "Gentle with plants, lethal with everything else. Wick tends the ammunition trees with the reverence of a monk and the precision of an engineer.",
            "background": "Deserted from the city guard after being ordered to prune the ancient oak in Ashgrove. The oak, he insists, spoke to him. The court-martial transcript is classified.",
        },
        {
            "name": "Quill Fenwick",
            "gender": "non-binary",
            "system": "The Hollows",
            "primary_profession": "Debt Cartographer",
            "character": "Cheerful, relentless, and morally ambiguous. Maps the intricate web of secrets-as-currency that sustains the underground economy.",
            "background": "Born on the surface, moved underground voluntarily. Claims to prefer 'honest darkness to dishonest light.' Has never been seen paying for anything.",
        },
        {
            "name": "Maren Ash",
            "gender": "female",
            "system": "Mirrorside",
            "primary_profession": "Reflection Inspector",
            "character": "Calm, observant, and deeply unsettling. Maren ensures that shopfront reflections maintain their mandated deviation from reality — no more, no less.",
            "background": "Discovered her aptitude during a childhood incident involving a funhouse mirror. What she saw made her cry. What she did about it made the papers.",
        },
    ]
    return pool[:count]


def mock_buildings(seed: str, count: int = 7) -> list[dict]:
    pool = [
        {"name": "The Final Draft", "building_type": "tavern", "description": "A narrative distillery where stories are served in liquid form. The house special causes vivid memories of events that never happened.", "building_condition": "good"},
        {"name": "The Resonance Vault", "building_type": "archive", "description": "A soundproofed library that stores not books but acoustic recordings. Visitors wear tuning forks instead of library cards.", "building_condition": "good"},
        {"name": "Furnace Seven", "building_type": "factory", "description": "The oldest continuously operating furnace in the city. What it produces has never been identified. The output is consumed by something in the sub-basement.", "building_condition": "fair"},
        {"name": "The Absent Embassy", "building_type": "government", "description": "Embassy of a nation that no longer exists. Staff continue to process visas. The visas are accepted everywhere.", "building_condition": "good"},
        {"name": "Thorn Manor", "building_type": "residence", "description": "A townhouse in Thornwalk where the load-bearing hedges have developed opinions about the residents.", "building_condition": "fair"},
        {"name": "The Plumb House", "building_type": "observatory", "description": "Municipal hydrological station where the canal's non-directional flow is measured with increasingly desperate instruments.", "building_condition": "poor"},
        {"name": "Cartographer's Rest", "building_type": "inn", "description": "An inn that occupies a different location each morning. Regulars navigate by the smell of breakfast.", "building_condition": "good"},
        {"name": "The Hollow Market", "building_type": "market", "description": "An underground bazaar where prices are quoted in secrets of equivalent weight.", "building_condition": "fair"},
        {"name": "The Silent Theatre", "building_type": "entertainment", "description": "A performance venue where shows are experienced through vibration alone. The audience is always blindfolded.", "building_condition": "good"},
    ]
    return pool[:count]


# ── Phase 3: Darkroom (theme) ────────────────────────────────────────


def mock_theme(seed: str) -> dict:
    h = _seed_int(seed)
    themes = [
        {
            "color_primary": "#c9a84c",
            "color_primary_hover": "#d4b85e",
            "color_primary_active": "#b8973b",
            "color_secondary": "#6b8f71",
            "color_accent": "#c76f3b",
            "color_background": "#0e0f11",
            "color_surface": "#161820",
            "color_surface_sunken": "#0b0c0e",
            "color_surface_header": "#12141a",
            "color_text": "#e8e0d2",
            "color_text_secondary": "#a09888",
            "color_text_muted": "#605848",
            "color_border": "#2a2520",
            "color_border_light": "#1e1b18",
            "color_danger": "#c44040",
            "color_success": "#4a8c5a",
            "color_primary_bg": "#1a1610",
            "color_info_bg": "#101a1c",
            "color_danger_bg": "#1c1010",
            "color_success_bg": "#101c12",
            "color_warning_bg": "#1c1a10",
            "font_heading": "'Playfair Display', serif",
            "font_body": "'Source Serif 4', serif",
            "font_mono": "'JetBrains Mono', monospace",
            "font_base_size": "16px",
            "heading_weight": "800",
            "heading_transform": "uppercase",
            "heading_tracking": "0.08em",
            "border_radius": "0",
            "border_width": "3px",
            "border_width_default": "2px",
            "shadow_style": "offset",
            "shadow_color": "#000000",
            "hover_effect": "translate",
            "text_inverse": "#0e0f11",
            "animation_speed": "1.0",
            "animation_easing": "cubic-bezier(0.22, 1, 0.36, 1)",
            "card_frame_texture": "filigree",
            "card_frame_nameplate": "cartouche",
            "card_frame_corners": "floral",
            "card_frame_foil": "patina",
            "image_style_prompt_portrait": "daguerreotype portrait, formal studio lighting, sepia warmth, antiquarian grain",
            "image_style_prompt_building": "architectural photography, overcast, desaturated amber tones, mist",
            "image_style_prompt_banner": "romantic landscape painting, oil on canvas, atmospheric perspective, golden light",
            "image_style_prompt_lore": "etching illustration, cross-hatched, parchment texture, archival quality",
        },
        {
            "color_primary": "#00d4aa",
            "color_primary_hover": "#00e8bc",
            "color_primary_active": "#00b892",
            "color_secondary": "#ff6b6b",
            "color_accent": "#ffd93d",
            "color_background": "#080a0c",
            "color_surface": "#101418",
            "color_surface_sunken": "#060809",
            "color_surface_header": "#0c1014",
            "color_text": "#d0e8e0",
            "color_text_secondary": "#7898a0",
            "color_text_muted": "#3a5058",
            "color_border": "#1a2830",
            "color_border_light": "#121c22",
            "color_danger": "#e04848",
            "color_success": "#38c070",
            "color_primary_bg": "#081a16",
            "color_info_bg": "#081018",
            "color_danger_bg": "#180808",
            "color_success_bg": "#081810",
            "color_warning_bg": "#181808",
            "font_heading": "'Orbitron', sans-serif",
            "font_body": "'Inter', sans-serif",
            "font_mono": "'Fira Code', monospace",
            "font_base_size": "16px",
            "heading_weight": "700",
            "heading_transform": "uppercase",
            "heading_tracking": "0.12em",
            "border_radius": "0",
            "border_width": "2px",
            "border_width_default": "1px",
            "shadow_style": "glow",
            "shadow_color": "#00d4aa",
            "hover_effect": "glow",
            "text_inverse": "#080a0c",
            "animation_speed": "0.8",
            "animation_easing": "cubic-bezier(0.16, 1, 0.3, 1)",
            "card_frame_texture": "circuits",
            "card_frame_nameplate": "terminal",
            "card_frame_corners": "crosshairs",
            "card_frame_foil": "phosphor",
            "image_style_prompt_portrait": "cyberpunk neon portrait, holographic overlay, chromatic aberration, moody lighting",
            "image_style_prompt_building": "brutalist architecture, neon signage, rain-slicked concrete, night photography",
            "image_style_prompt_banner": "aerial drone photo, neon city grid, fog layer, cinematic color grade",
            "image_style_prompt_lore": "concept art, moody environmental, desaturated cyan palette, digital painting",
        },
    ]
    return themes[h % len(themes)]


# ── Phase 4: Ignition (lore, translations) ───────────────────────────


def mock_lore_sections(seed: str) -> list[dict]:
    return [
        {
            "chapter": "The Founding",
            "arcanum": "I",
            "title": "How the City Acquired Its Name",
            "epigraph": "Names are the first casualties of history.",
            "body": (
                "No one remembers who named the city. The Bureau of Nomenclature maintains "
                "seventeen competing origin stories, each documented with equal rigor and "
                "equal implausibility. The current favorite involves a clerical error, a "
                "misfiled cartographic survey, and a particularly persistent pigeon.\n\n"
                "What is known: the name appeared simultaneously on three separate maps drawn "
                "by cartographers who had never met. Each spelled it differently. The Bureau "
                "chose the spelling that offended the fewest people, which is to say, all of them."
            ),
            "image_slug": "city_gates",
            "image_caption": "The city gates, which predate the city by several centuries",
        },
        {
            "chapter": "The Founding",
            "arcanum": "I",
            "title": "The First Census",
            "epigraph": "",
            "body": (
                "The first census was conducted by Provisional Administrator Kael, who counted "
                "every resident by hand. The final tally: 4,327 people, 891 buildings, and one "
                "entity that defied classification. Kael's note in the margin reads simply: "
                "'It counted back.'\n\n"
                "The census established several precedents that persist today: the practice of "
                "counting buildings as residents (they pay taxes, after all), the exemption of "
                "the canal from census duties, and the tradition of losing exactly one page from "
                "every official document."
            ),
            "image_slug": None,
            "image_caption": None,
        },
        {
            "chapter": "The Districts",
            "arcanum": "II",
            "title": "On the Nature of Zones",
            "epigraph": "A district is a state of mind with municipal boundaries.",
            "body": (
                "The city's districts were not planned. They accreted, like geological strata, "
                "each layer deposited by a different era's anxieties. The Inkwell formed around "
                "a spilled narrative — quite literally; a cart of liquid stories overturned in "
                "the main square, and the resulting puddle attracted storytellers the way lamp-"
                "light attracts moths.\n\n"
                "Thornwalk grew when a single ornamental hedge, planted by a homesick immigrant, "
                "began to spread. The hedges proved to be load-bearing. By the time anyone "
                "thought to trim them, they were supporting three floors of housing and a "
                "considerable amount of local identity."
            ),
            "image_slug": "districts_overview",
            "image_caption": "The city from above — each district bleeds into the next",
        },
        {
            "chapter": "The Districts",
            "arcanum": "II",
            "title": "The Economy of Secrets",
            "epigraph": "",
            "body": (
                "In the Hollows, the underground district, the conventional economy never took "
                "hold. Money is considered gauche — a surface affectation, like sunlight or "
                "optimism. Instead, commerce runs on secrets.\n\n"
                "A secret's value is determined by its weight — not metaphorically, but literally. "
                "The Bureau of Underground Commerce maintains a set of brass scales that can "
                "weigh a whispered confidence to three decimal places. The mechanism is a "
                "closely guarded trade secret, which creates an interesting recursive problem "
                "for the Bureau's own accounting department."
            ),
            "image_slug": None,
            "image_caption": None,
        },
        {
            "chapter": "The Present Day",
            "arcanum": "III",
            "title": "Tensions Beneath the Surface",
            "epigraph": "Every city is at war with itself. The honest ones admit it.",
            "body": (
                "The current administration faces a crisis that, characteristically, no one "
                "can quite define. The canal has begun flowing in a direction — something it "
                "has never done before, and which violates several municipal bylaws. The "
                "Furnace Quarter's output has changed color. The echoes in the Echoplex are "
                "arriving before the conversations that cause them.\n\n"
                "Vesper Caine, the city's most persistent archivist, has filed a report "
                "suggesting that these phenomena are connected. The Bureau has filed her report "
                "in the usual manner: acknowledging receipt, denying the conclusions, and "
                "classifying the document at a level that makes it illegal for even Vesper "
                "herself to read it."
            ),
            "image_slug": "canal_anomaly",
            "image_caption": "The canal, now stubbornly flowing east — or possibly west",
        },
    ]


def mock_lore_translations(sections: list[dict]) -> list[dict]:
    return [
        {
            "title": "Wie die Stadt zu ihrem Namen kam",
            "epigraph": "Namen sind die ersten Opfer der Geschichte.",
            "body": (
                "Niemand erinnert sich, wer die Stadt benannt hat. Das Amt für Nomenklatur "
                "unterhält siebzehn konkurrierende Entstehungsgeschichten, jede mit gleicher "
                "Sorgfalt und gleicher Unwahrscheinlichkeit dokumentiert. Die derzeit beliebteste "
                "beinhaltet einen Schreibfehler, eine falsch abgelegte kartographische Vermessung "
                "und eine besonders hartnäckige Taube.\n\n"
                "Was bekannt ist: Der Name erschien gleichzeitig auf drei verschiedenen Karten, "
                "gezeichnet von Kartographen, die sich nie begegnet waren. Jeder buchstabierte "
                "ihn anders. Das Amt wählte die Schreibweise, die die wenigsten Menschen "
                "beleidigte — das heißt, alle."
            ),
            "image_caption": "Die Stadttore, die die Stadt um mehrere Jahrhunderte vorausgehen",
        },
        {
            "title": "Die erste Volkszählung",
            "epigraph": "",
            "body": (
                "Die erste Volkszählung wurde von Provisorischer Verwalterin Kael durchgeführt, "
                "die jeden Bewohner von Hand zählte. Das Endergebnis: 4.327 Personen, 891 "
                "Gebäude und eine Entität, die sich jeder Klassifizierung entzog. Kaels Notiz "
                "am Rand lautet schlicht: 'Es hat zurückgezählt.'\n\n"
                "Die Volkszählung begründete mehrere Präzedenzfälle, die bis heute bestehen: "
                "die Praxis, Gebäude als Bewohner zu zählen (sie zahlen schließlich Steuern), "
                "die Befreiung des Kanals von der Zählungspflicht und die Tradition, aus jedem "
                "offiziellen Dokument genau eine Seite zu verlieren."
            ),
            "image_caption": None,
        },
        {
            "title": "Über das Wesen der Viertel",
            "epigraph": "Ein Viertel ist ein Geisteszustand mit kommunalen Grenzen.",
            "body": (
                "Die Stadtviertel wurden nicht geplant. Sie akkumulierten sich wie geologische "
                "Schichten, jede Lage abgelagert durch die Ängste einer anderen Epoche. Das "
                "Tintenfass formte sich um eine verschüttete Erzählung — ganz wörtlich; ein "
                "Karren mit flüssigen Geschichten kippte auf dem Hauptplatz um, und die "
                "resultierende Pfütze zog Geschichtenerzähler an wie Lampenlicht die Motten.\n\n"
                "Thornwalk entstand, als eine einzelne Zierhecke, gepflanzt von einem "
                "heimwehkranken Einwanderer, zu wuchern begann. Die Hecken erwiesen sich als "
                "tragend. Als jemand daran dachte, sie zu stutzen, trugen sie bereits drei "
                "Stockwerke Wohnraum und ein beträchtliches Maß an lokaler Identität."
            ),
            "image_caption": "Die Stadt von oben — jedes Viertel blutet in das nächste über",
        },
        {
            "title": "Die Ökonomie der Geheimnisse",
            "epigraph": "",
            "body": (
                "Im Untergrund-Viertel, den Hollows, hat sich die konventionelle Wirtschaft "
                "nie durchgesetzt. Geld gilt als geschmacklos — eine Oberflächenaffektation, "
                "wie Sonnenlicht oder Optimismus. Stattdessen läuft der Handel über Geheimnisse.\n\n"
                "Der Wert eines Geheimnisses wird durch sein Gewicht bestimmt — nicht "
                "metaphorisch, sondern buchstäblich. Das Amt für Unterirdischen Handel unterhält "
                "einen Satz Messingwaagen, die ein geflüstertes Vertrauen auf drei Dezimalstellen "
                "genau wiegen können. Der Mechanismus ist ein streng gehütetes Betriebsgeheimnis, "
                "was ein interessantes rekursives Problem für die eigene Buchhaltung des Amtes "
                "schafft."
            ),
            "image_caption": None,
        },
        {
            "title": "Spannungen unter der Oberfläche",
            "epigraph": "Jede Stadt befindet sich im Krieg mit sich selbst. Die ehrlichen geben es zu.",
            "body": (
                "Die aktuelle Verwaltung steht vor einer Krise, die charakteristischerweise "
                "niemand genau definieren kann. Der Kanal hat begonnen, in eine Richtung zu "
                "fließen — etwas, das er noch nie zuvor getan hat und das gegen mehrere "
                "städtische Verordnungen verstößt. Die Produktion des Furnace Quarter hat ihre "
                "Farbe verändert. Die Echos im Echoplex treffen ein, bevor die Gespräche "
                "stattfinden, die sie verursachen.\n\n"
                "Vesper Caine, die beharrlichste Archivarin der Stadt, hat einen Bericht "
                "eingereicht, der nahelegt, dass diese Phänomene zusammenhängen. Das Amt hat "
                "ihren Bericht in der üblichen Weise abgelegt: Eingang bestätigt, Schluss-"
                "folgerungen bestritten und das Dokument auf einer Stufe klassifiziert, die "
                "es sogar Vesper selbst illegal macht, es zu lesen."
            ),
            "image_caption": "Der Kanal, der nun stur nach Osten fließt — oder möglicherweise nach Westen",
        },
    ]


def mock_entity_translations(agents: list, buildings: list, zones: list, streets: list, sim_desc: str) -> dict:
    """Return minimal DE translations for all entity types."""
    return {
        "agents": [
            {
                "name": a.get("name", "?"),
                "character_de": f"[DE Mock] {a.get('character', '')[:80]}...",
                "background_de": f"[DE Mock] {a.get('background', '')[:80]}...",
                "primary_profession_de": a.get("primary_profession", ""),
            }
            for a in agents
        ],
        "buildings": [
            {
                "name": b.get("name", "?"),
                "description_de": f"[DE Mock] {b.get('description', '')[:80]}...",
                "building_type_de": b.get("building_type", ""),
                "building_condition_de": b.get("building_condition", ""),
            }
            for b in buildings
        ],
        "zones": [
            {
                "name": z.get("name", "?"),
                "description_de": f"[DE Mock] {z.get('description', '')[:80]}...",
                "zone_type_de": z.get("zone_type", ""),
            }
            for z in zones
        ],
        "streets": [
            {"name": s.get("name", "?"), "street_type_de": s.get("street_type", "")}
            for s in streets
        ],
        "simulation": {"description_de": f"[DE Mock] {sim_desc[:100]}..."},
    }
