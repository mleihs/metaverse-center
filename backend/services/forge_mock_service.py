"""Deterministic mock data for Forge wizard testing.

When FORGE_MOCK_MODE=true, all AI calls (OpenRouter, Tavily, Replicate) are
replaced by these instant, credit-free fixtures. Data is seed-aware for
reproducibility.

Every mock function that returns structured entity data validates its output
through the corresponding Pydantic model before returning. This guarantees
mock data cannot drift out of sync with model constraints.
"""

from __future__ import annotations

import hashlib
import logging

from pydantic import BaseModel

logger = logging.getLogger(__name__)


def _validate_mock_list(items: list[dict], model_cls: type[BaseModel]) -> list[dict]:
    """Validate each dict through *model_cls* and return model_dump() output.

    Raises ``ValidationError`` immediately if any item violates the schema,
    making mock-data / model-constraint drift impossible to miss.
    """
    return [model_cls(**item).model_dump() for item in items]


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
            "title_de": "Die Kartographie der Abwesenheit",
            "literary_influence": "Italo Calvino, Invisible Cities",
            "literary_influence_de": "Italo Calvino, Die unsichtbaren St\u00e4dte",
            "core_question": "Can a place exist if no one remembers it?",
            "core_question_de": "Kann ein Ort existieren, wenn sich niemand an ihn erinnert?",
            "bleed_signature_suggestion": "Fading ink on wet parchment",
            "description": (
                "A world built around the tension between mapping and forgetting. "
                "Every district is named after something that no longer exists there. "
                "The bureaucracy maintains detailed records of absences."
            ),
            "description_de": (
                "Eine Welt, erbaut auf der Spannung zwischen Kartieren und Vergessen. "
                "Jeder Bezirk ist nach etwas benannt, das dort nicht mehr existiert. "
                "Die B\u00fcrokratie f\u00fchrt akribische Aufzeichnungen \u00fcber Abwesenheiten."
            ),
        },
        {
            "title": "The Parliament of Echoes",
            "title_de": "Das Parlament der Echos",
            "literary_influence": "Ursula K. Le Guin, The Dispossessed",
            "literary_influence_de": "Ursula K. Le Guin, Die Enteigneten",
            "core_question": "What happens when every voice is heard simultaneously?",
            "core_question_de": "Was geschieht, wenn jede Stimme gleichzeitig geh\u00f6rt wird?",
            "bleed_signature_suggestion": "Overlapping radio frequencies",
            "description": (
                "A society where decisions are made by acoustic consensus — literally, "
                "the loudest resonance wins. Architecture is designed for its acoustic "
                "properties. Silence is the most radical form of dissent."
            ),
            "description_de": (
                "Eine Gesellschaft, in der Entscheidungen durch akustischen Konsens "
                "getroffen werden \u2014 buchst\u00e4blich gewinnt die lauteste Resonanz. "
                "Architektur wird nach akustischen Eigenschaften entworfen. "
                "Stille ist die radikalste Form des Widerspruchs."
            ),
        },
        {
            "title": "The Metabolic City",
            "title_de": "Die Metabolische Stadt",
            "literary_influence": "China Mi\u00e9ville, Perdido Street Station",
            "literary_influence_de": "China Mi\u00e9ville, Die Falte",
            "core_question": "What does a city eat, and what does it excrete?",
            "core_question_de": "Was isst eine Stadt, und was scheidet sie aus?",
            "bleed_signature_suggestion": "Rust blooming on living metal",
            "description": (
                "A city-organism that digests its inhabitants' experiences and "
                "excretes transformed architecture. Buildings grow from emotional "
                "residue. Infrastructure is literally alive and hungry."
            ),
            "description_de": (
                "Ein Stadt-Organismus, der die Erfahrungen seiner Bewohner verdaut "
                "und verwandelte Architektur ausscheidet. Geb\u00e4ude wachsen aus "
                "emotionalen R\u00fcckst\u00e4nden. Die Infrastruktur ist buchst\u00e4blich "
                "lebendig und hungrig."
            ),
        },
    ]
    # Rotate based on seed for variety
    from backend.models.forge import PhilosophicalAnchor

    offset = h % 3
    rotated = variants[offset:] + variants[:offset]
    return _validate_mock_list(rotated, PhilosophicalAnchor)


# ── Phase 2: Drafting (geography, agents, buildings) ─────────────────


def mock_geography(seed: str, zone_count: int = 5, street_count: int = 5) -> dict:
    h = _seed_int(seed)
    city_names = ["Meridian Null", "Achterberg", "Port Lacuna", "Voidhaven", "Caul"]
    city = city_names[h % len(city_names)]

    zone_pool = [
        {
            "name": "The Inkwell",
            "zone_type": "cultural",
            "zone_type_de": "kulturell",
            "description": ("Where stories are distilled into liquid form and sold by the dram."),
            "description_de": ("Hier werden Geschichten zu flüssiger Form destilliert und schluckweise verkauft."),
            "characteristics": [
                "liquid narratives",
                "alchemical fumes",
                "ink-stained cobblestones",
            ],
        },
        {
            "name": "Thornwalk",
            "zone_type": "residential",
            "zone_type_de": "Wohngebiet",
            "description": ("A labyrinth of terraced houses growing thorned hedges as load-bearing walls."),
            "description_de": ("Ein Labyrinth aus Reihenhäusern, deren tragende Wände aus Dornenhecken bestehen."),
            "characteristics": [
                "living architecture",
                "rustling walls",
                "pollen haze",
            ],
        },
        {
            "name": "The Furnace Quarter",
            "zone_type": "industrial",
            "zone_type_de": "Industriegebiet",
            "description": ("Perpetual smoke. The factories here produce things no one ordered."),
            "description_de": ("Ewiger Rauch. Die Fabriken hier produzieren Dinge, die niemand bestellt hat."),
            "characteristics": [
                "perpetual smoke",
                "unexplained output",
                "molten glow",
            ],
        },
        {
            "name": "Echoplex",
            "zone_type": "entertainment",
            "zone_type_de": "Unterhaltung",
            "description": ("An amphitheatre district where yesterday's conversations replay at dusk."),
            "description_de": ("Ein Amphitheaterviertel, in dem die Gespräche von gestern bei Dämmerung wiederhallen."),
            "characteristics": [
                "temporal echoes",
                "acoustic anomalies",
                "twilight performances",
            ],
        },
        {
            "name": "The Stillwater",
            "zone_type": "government",
            "zone_type_de": "Regierungsviertel",
            "description": ("Administrative buildings arranged around a canal that flows in no direction."),
            "description_de": ("Verwaltungsgebäude, angeordnet um einen Kanal, der in keine Richtung fließt."),
            "characteristics": [
                "bureaucratic calm",
                "directionless canal",
                "paper rustling",
            ],
        },
        {
            "name": "Ashgrove",
            "zone_type": "military",
            "zone_type_de": "Militärgebiet",
            "description": ("A fortified garden where trees grow ammunition instead of fruit."),
            "description_de": ("Ein befestigter Garten, in dem Bäume Munition statt Früchte tragen."),
            "characteristics": [
                "militant horticulture",
                "brass-leaf canopy",
                "cordite perfume",
            ],
        },
        {
            "name": "The Hollows",
            "zone_type": "slum",
            "zone_type_de": "Elendsviertel",
            "description": ("Underground caverns repurposed as housing. The rent is paid in secrets."),
            "description_de": (
                "Unterirdische Höhlen, umfunktioniert zu Wohnraum. Die Miete wird in Geheimnissen bezahlt."
            ),
            "characteristics": [
                "subterranean",
                "whisper economy",
                "bioluminescent moss",
            ],
        },
        {
            "name": "Mirrorside",
            "zone_type": "commercial",
            "zone_type_de": "Gewerbegebiet",
            "description": ("Every shopfront reflects a slightly different version of the customer."),
            "description_de": ("Jede Schaufensterfront spiegelt eine leicht veränderte Version des Kunden wider."),
            "characteristics": [
                "distorted reflections",
                "identity commerce",
                "silver-glass facades",
            ],
        },
    ]
    street_pool = [
        {
            "name": "Threadneedle Passage",
            "street_type": "alley",
            "street_type_de": "Gasse",
            "description": ("A narrow gap between buildings where seamstresses once threaded needles by moonlight."),
        },
        {
            "name": "Rue du Souvenir",
            "street_type": "boulevard",
            "street_type_de": "Boulevard",
            "description": ("Lined with trees that shed memories instead of leaves each autumn."),
        },
        {
            "name": "Forgetting Lane",
            "street_type": "lane",
            "street_type_de": "Weg",
            "description": ("Visitors report mild amnesia upon reaching the far end."),
        },
        {
            "name": "The Long Exhale",
            "street_type": "avenue",
            "street_type_de": "Allee",
            "description": ("A gently sloping avenue where the wind always sighs downhill."),
        },
        {
            "name": "Clinker Row",
            "street_type": "road",
            "street_type_de": "Straße",
            "description": ("Paved with fused furnace slag that still radiates warmth underfoot."),
        },
        {
            "name": "Drift Street",
            "street_type": "street",
            "street_type_de": "Straße",
            "description": ("Its position shifts by a few meters each decade, confounding cartographers."),
        },
        {
            "name": "Parliament Way",
            "street_type": "avenue",
            "street_type_de": "Allee",
            "description": ("The widest avenue in the city, designed so that shouted debates carry from end to end."),
        },
        {
            "name": "The Spiral Descent",
            "street_type": "stairway",
            "street_type_de": "Treppe",
            "description": ("A corkscrew stairway carved into bedrock, connecting the surface to the Hollows."),
        },
    ]

    zones = zone_pool[:zone_count]
    for z in zones:
        z["zone_type"] = z.get("zone_type", "mixed")

    streets = []
    for i in range(street_count):
        s = {**street_pool[i % len(street_pool)]}
        s["zone_name"] = zones[i % len(zones)]["name"]
        streets.append(s)

    from backend.models.forge import ForgeGeographyDraft

    geo = {
        "city_name": city,
        "description": f"The city of {city} exists at the intersection of memory and bureaucracy.",
        "zones": zones,
        "streets": streets,
    }
    return ForgeGeographyDraft(**geo).model_dump()


def mock_agents(seed: str, count: int = 6) -> list[dict]:
    pool = [
        {
            "name": "Vesper Caine",
            "gender": "female",
            "system": "The Cartographers",
            "primary_profession": "Archivist",
            "primary_profession_de": "Archivarin",
            "character": (
                "Meticulous, sardonic, and quietly furious."
                " Vesper catalogues what others forget, which"
                " means she remembers everything \u2014 a condition"
                " she considers a disability."
            ),
            "character_de": (
                "Akribisch, sarkastisch und leise w\u00fctend."
                " Vesper katalogisiert, was andere vergessen,"
                " was bedeutet, dass sie sich an alles"
                " erinnert \u2014 ein Zustand, den sie als"
                " Behinderung betrachtet."
            ),
            "background": (
                "Former census-taker who discovered that three"
                " districts had been removed from official"
                " records. Her investigation cost her a"
                " promotion and a husband. She considers"
                " this a fair trade."
            ),
            "background_de": (
                "Ehemalige Volksz\u00e4hlerin, die entdeckte, dass"
                " drei Bezirke aus den offiziellen Akten"
                " entfernt worden waren. Ihre Ermittlungen"
                " kosteten sie eine Bef\u00f6rderung und einen"
                " Ehemann. Sie h\u00e4lt das f\u00fcr einen fairen"
                " Tausch."
            ),
        },
        {
            "name": "Harlan Moss",
            "gender": "male",
            "system": "The Foundry",
            "primary_profession": "Forgewright",
            "primary_profession_de": "Schmiedemeister",
            "character": (
                "Laconic and burn-scarred. Speaks mostly to"
                " metal. Believes that everything worth saying"
                " has already been hammered into shape by"
                " someone with better tools."
            ),
            "character_de": (
                "Wortkarg und brandvernarbt. Spricht"
                " haupts\u00e4chlich mit Metall. Glaubt, dass alles"
                " Sagenswerte bereits von jemandem mit"
                " besserem Werkzeug in Form geh\u00e4mmert wurde."
            ),
            "background": (
                "Third-generation furnace operator who"
                " discovered that the factory's output is"
                " consumed by something beneath the building."
                " He feeds it anyway. What else would he do?"
            ),
            "background_de": (
                "Hochofenbediener in dritter Generation, der"
                " entdeckte, dass die Produktion der Fabrik"
                " von etwas unter dem Geb\u00e4ude verschlungen"
                " wird. Er f\u00fcttert es trotzdem. Was sollte er"
                " auch sonst tun?"
            ),
        },
        {
            "name": "Sable Drest",
            "gender": "non-binary",
            "system": "The Echoplex",
            "primary_profession": "Resonance Broker",
            "primary_profession_de": "Resonanzmakler",
            "character": (
                "Silver-tongued and ethically flexible."
                " Sable trades in echoes \u2014 recorded"
                " conversations, ambient emotions, the"
                " acoustic fingerprints of rooms where"
                " important things happened."
            ),
            "character_de": (
                "Redegewandt und ethisch flexibel. Sable"
                " handelt mit Echos \u2014 aufgezeichneten"
                " Gespr\u00e4chen, Umgebungsemotionen, den"
                " akustischen Fingerabdr\u00fccken von R\u00e4umen,"
                " in denen Wichtiges geschah."
            ),
            "background": (
                "Grew up in the Hollows, where sound carries"
                " strangely. Learned early that a whisper in"
                " the right corridor is worth more than a"
                " shout in the square."
            ),
            "background_de": (
                "Aufgewachsen in den Hollows, wo Schall sich"
                " seltsam fortpflanzt. Lernte fr\u00fch, dass ein"
                " Fl\u00fcstern im richtigen Korridor mehr wert"
                " ist als ein Schrei auf dem Platz."
            ),
        },
        {
            "name": "Orin Keelhaul",
            "gender": "male",
            "system": "The Stillwater",
            "primary_profession": "Tide Clerk",
            "primary_profession_de": "Gezeitenschreiber",
            "character": (
                "Pedantic, anxious, secretly romantic. Orin"
                " measures the canal's non-directional flow"
                " with instruments of his own devising. His"
                " reports are beautiful and incomprehensible."
            ),
            "character_de": (
                "Pedantisch, \u00e4ngstlich, insgeheim romantisch."
                " Orin misst den richtungslosen Fluss des"
                " Kanals mit selbst erfundenen Instrumenten."
                " Seine Berichte sind sch\u00f6n und"
                " unverst\u00e4ndlich."
            ),
            "background": (
                "Applied to the Bureau of Hydrology seven"
                " times before being accepted. His thesis"
                " \u2014 'On the Emotional Viscosity of Municipal"
                " Water' \u2014 remains the department's most"
                " borrowed text."
            ),
            "background_de": (
                "Bewarb sich sieben Mal beim B\u00fcro f\u00fcr"
                " Hydrologie, bevor er angenommen wurde."
                " Seine Abhandlung \u2014 \u201e\u00dcber die emotionale"
                " Viskosit\u00e4t st\u00e4dtischen Wassers\u201c \u2014 bleibt"
                " der meistentliehene Text der Abteilung."
            ),
        },
        {
            "name": "Elara Vex",
            "gender": "female",
            "system": "The Inkwell",
            "primary_profession": "Story Distiller",
            "primary_profession_de": "Geschichtendestillateurin",
            "character": (
                "Warm, pragmatic, and slightly dangerous."
                " Elara converts narratives into consumable"
                " liquid form. She insists the process is"
                " purely chemical. Her customers report"
                " hallucinations anyway."
            ),
            "character_de": (
                "Warmherzig, pragmatisch und leicht"
                " gef\u00e4hrlich. Elara wandelt Erz\u00e4hlungen in"
                " trinkbare Fl\u00fcssigkeit um. Sie besteht"
                " darauf, der Vorgang sei rein chemisch."
                " Ihre Kunden berichten trotzdem von"
                " Halluzinationen."
            ),
            "background": (
                "Trained as a chemist, retrained as a"
                " bartender, finally found her calling at"
                " the intersection. Her shop, 'The Final"
                " Draft', is both a pun and a threat."
            ),
            "background_de": (
                "Ausgebildete Chemikerin, umgeschult zur"
                " Barkeeperin, fand schlie\u00dflich ihre Berufung"
                " an der Schnittstelle. Ihr Laden, \u201eThe Final"
                " Draft\u201c, ist Wortspiel und Drohung zugleich."
            ),
        },
        {
            "name": "Wick Solander",
            "gender": "male",
            "system": "Ashgrove",
            "primary_profession": "Orchardist-Militant",
            "primary_profession_de": "Obstbauer-Soldat",
            "character": (
                "Gentle with plants, lethal with everything"
                " else. Wick tends the ammunition trees with"
                " the reverence of a monk and the precision"
                " of an engineer."
            ),
            "character_de": (
                "Sanft zu Pflanzen, t\u00f6dlich f\u00fcr alles andere."
                " Wick pflegt die Munitionsb\u00e4ume mit der"
                " Ehrfurcht eines M\u00f6nchs und der Pr\u00e4zision"
                " eines Ingenieurs."
            ),
            "background": (
                "Deserted from the city guard after being"
                " ordered to prune the ancient oak in"
                " Ashgrove. The oak, he insists, spoke to"
                " him. The court-martial transcript is"
                " classified."
            ),
            "background_de": (
                "Desertierte von der Stadtwache, nachdem ihm"
                " befohlen wurde, die uralte Eiche in"
                " Ashgrove zu beschneiden. Die Eiche,"
                " behauptet er, habe zu ihm gesprochen. Das"
                " Kriegsgerichtsprotokoll ist geheim."
            ),
        },
        {
            "name": "Quill Fenwick",
            "gender": "non-binary",
            "system": "The Hollows",
            "primary_profession": "Debt Cartographer",
            "primary_profession_de": "Schuldenkartograph",
            "character": (
                "Cheerful, relentless, and morally ambiguous."
                " Maps the intricate web of secrets-as-currency"
                " that sustains the underground economy."
            ),
            "character_de": (
                "Fr\u00f6hlich, unerbittlich und moralisch"
                " zweideutig. Kartiert das verschlungene Netz"
                " der Geheimnisse-als-W\u00e4hrung, das die"
                " Untergrundwirtschaft am Leben h\u00e4lt."
            ),
            "background": (
                "Born on the surface, moved underground"
                " voluntarily. Claims to prefer 'honest"
                " darkness to dishonest light.' Has never"
                " been seen paying for anything."
            ),
            "background_de": (
                "An der Oberfl\u00e4che geboren, freiwillig in den"
                " Untergrund gezogen. Behauptet, \u201eehrliche"
                " Dunkelheit unehrlichem Licht\u201c vorzuziehen."
                " Wurde nie beim Bezahlen gesehen."
            ),
        },
        {
            "name": "Maren Ash",
            "gender": "female",
            "system": "Mirrorside",
            "primary_profession": "Reflection Inspector",
            "primary_profession_de": "Spiegelungsinspektorin",
            "character": (
                "Calm, observant, and deeply unsettling."
                " Maren ensures that shopfront reflections"
                " maintain their mandated deviation from"
                " reality \u2014 no more, no less."
            ),
            "character_de": (
                "Ruhig, aufmerksam und zutiefst beunruhigend."
                " Maren stellt sicher, dass"
                " Schaufensterreflexionen ihre vorgeschriebene"
                " Abweichung von der Realit\u00e4t einhalten \u2014"
                " nicht mehr und nicht weniger."
            ),
            "background": (
                "Discovered her aptitude during a childhood"
                " incident involving a funhouse mirror. What"
                " she saw made her cry. What she did about"
                " it made the papers."
            ),
            "background_de": (
                "Entdeckte ihre Begabung bei einem"
                " Kindheitserlebnis mit einem Zerrspiegel."
                " Was sie sah, brachte sie zum Weinen. Was"
                " sie dagegen tat, schaffte es in die"
                " Zeitung."
            ),
        },
    ]
    from backend.models.forge import ForgeAgentDraft

    return _validate_mock_list(pool[:count], ForgeAgentDraft)


def mock_buildings(seed: str, count: int = 7) -> list[dict]:
    pool = [
        {
            "name": "The Final Draft",
            "building_type": "tavern",
            "building_type_de": "Taverne",
            "description": (
                "A narrative distillery where stories are"
                " served in liquid form. The house special"
                " causes vivid memories of events that"
                " never happened."
            ),
            "description_de": (
                "Eine Erz\u00e4hldestillerie, in der Geschichten"
                " in fl\u00fcssiger Form serviert werden. Die"
                " Hausspezialit\u00e4t verursacht lebhafte"
                " Erinnerungen an Ereignisse, die nie"
                " stattfanden."
            ),
            "building_condition": "good",
            "building_condition_de": "gut",
        },
        {
            "name": "The Resonance Vault",
            "building_type": "archive",
            "building_type_de": "Archiv",
            "description": (
                "A soundproofed library that stores not books"
                " but acoustic recordings. Visitors wear"
                " tuning forks instead of library cards."
            ),
            "description_de": (
                "Eine schallisolierte Bibliothek, die keine"
                " B\u00fccher, sondern akustische Aufnahmen"
                " aufbewahrt. Besucher tragen Stimmgabeln"
                " statt Bibliotheksausweisen."
            ),
            "building_condition": "good",
            "building_condition_de": "gut",
        },
        {
            "name": "Furnace Seven",
            "building_type": "factory",
            "building_type_de": "Fabrik",
            "description": (
                "The oldest continuously operating furnace"
                " in the city. What it produces has never"
                " been identified. The output is consumed"
                " by something in the sub-basement."
            ),
            "description_de": (
                "Der \u00e4lteste durchgehend betriebene Hochofen"
                " der Stadt. Was er produziert, wurde nie"
                " identifiziert. Die Erzeugnisse werden von"
                " etwas im Untergeschoss verschlungen."
            ),
            "building_condition": "fair",
            "building_condition_de": "m\u00e4\u00dfig",
        },
        {
            "name": "The Absent Embassy",
            "building_type": "government",
            "building_type_de": "Regierungsgeb\u00e4ude",
            "description": (
                "Embassy of a nation that no longer exists."
                " Staff continue to process visas. The visas"
                " are accepted everywhere."
            ),
            "description_de": (
                "Botschaft einer Nation, die nicht mehr"
                " existiert. Das Personal bearbeitet weiterhin"
                " Visa. Die Visa werden \u00fcberall akzeptiert."
            ),
            "building_condition": "good",
            "building_condition_de": "gut",
        },
        {
            "name": "Thorn Manor",
            "building_type": "residence",
            "building_type_de": "Wohnhaus",
            "description": (
                "A townhouse in Thornwalk where the load-bearing hedges have developed opinions about the residents."
            ),
            "description_de": (
                "Ein Stadthaus in Thornwalk, dessen tragende Hecken Meinungen \u00fcber die Bewohner entwickelt haben."
            ),
            "building_condition": "fair",
            "building_condition_de": "m\u00e4\u00dfig",
        },
        {
            "name": "The Plumb House",
            "building_type": "observatory",
            "building_type_de": "Observatorium",
            "description": (
                "Municipal hydrological station where the"
                " canal's non-directional flow is measured"
                " with increasingly desperate instruments."
            ),
            "description_de": (
                "St\u00e4dtische Hydrologiestation, in der der"
                " richtungslose Fluss des Kanals mit zunehmend"
                " verzweifelten Instrumenten gemessen wird."
            ),
            "building_condition": "poor",
            "building_condition_de": "schlecht",
        },
        {
            "name": "Cartographer's Rest",
            "building_type": "inn",
            "building_type_de": "Gasthof",
            "description": (
                "An inn that occupies a different location each morning. Regulars navigate by the smell of breakfast."
            ),
            "description_de": (
                "Ein Gasthof, der jeden Morgen einen anderen"
                " Standort einnimmt. Stammg\u00e4ste orientieren"
                " sich am Fr\u00fchst\u00fccksduft."
            ),
            "building_condition": "good",
            "building_condition_de": "gut",
        },
        {
            "name": "The Hollow Market",
            "building_type": "market",
            "building_type_de": "Markt",
            "description": ("An underground bazaar where prices are quoted in secrets of equivalent weight."),
            "description_de": (
                "Ein unterirdischer Basar, auf dem Preise in Geheimnissen gleichen Gewichts angegeben werden."
            ),
            "building_condition": "fair",
            "building_condition_de": "m\u00e4\u00dfig",
        },
        {
            "name": "The Silent Theatre",
            "building_type": "entertainment",
            "building_type_de": "Unterhaltung",
            "description": (
                "A performance venue where shows are"
                " experienced through vibration alone."
                " The audience is always blindfolded."
            ),
            "description_de": (
                "Eine Auff\u00fchrungsst\u00e4tte, in der Vorstellungen"
                " ausschlie\u00dflich durch Vibration erlebt"
                " werden. Das Publikum tr\u00e4gt stets"
                " Augenbinden."
            ),
            "building_condition": "good",
            "building_condition_de": "gut",
        },
    ]
    from backend.models.forge import ForgeBuildingDraft

    return _validate_mock_list(pool[:count], ForgeBuildingDraft)


def mock_single_agent(seed: str, index: int, count: int = 6) -> dict:
    """Return a single mock agent at the given index."""
    all_agents = mock_agents(seed, count)
    return all_agents[index % len(all_agents)]


def mock_single_building(seed: str, index: int, count: int = 7) -> dict:
    """Return a single mock building at the given index."""
    all_buildings = mock_buildings(seed, count)
    return all_buildings[index % len(all_buildings)]


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
            "image_style_prompt_portrait": (
                "daguerreotype portrait, formal studio lighting, sepia warmth, antiquarian grain"
            ),
            "image_style_prompt_building": ("architectural photography, overcast, desaturated amber tones, mist"),
            "image_style_prompt_banner": (
                "romantic landscape painting, oil on canvas, atmospheric perspective, golden light"
            ),
            "image_style_prompt_lore": ("etching illustration, cross-hatched, parchment texture, archival quality"),
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
            "image_style_prompt_portrait": (
                "cyberpunk neon portrait, holographic overlay, chromatic aberration, moody lighting"
            ),
            "image_style_prompt_building": (
                "brutalist architecture, neon signage, rain-slicked concrete, night photography"
            ),
            "image_style_prompt_banner": ("aerial drone photo, neon city grid, fog layer, cinematic color grade"),
            "image_style_prompt_lore": ("concept art, moody environmental, desaturated cyan palette, digital painting"),
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


def mock_recruits(
    sim_name: str = "the simulation",
    existing_agent_names: list[str] | None = None,
    focus: str | None = None,
) -> list[dict]:
    """Rich mock recruits for FORGE_MOCK_MODE recruitment testing.

    Returns 3 fully-realised agents with arrival narratives and references
    to existing agent names when provided.  Quality matches ``mock_agents()``.
    """
    names = existing_agent_names or []
    mentions = {
        0: names[0] if len(names) > 0 else "the resident archivist",
        1: names[1] if len(names) > 1 else "a local forgewright",
        2: names[2] if len(names) > 2 else "the chief resonance broker",
    }

    pool = [
        {
            "name": "Isolde Greymantle",
            "gender": "female",
            "system": "The Cartographers",
            "primary_profession": "Threshold Surveyor",
            "primary_profession_de": "Schwellenvermesserin",
            "character": (
                "Watchful, deliberate, and unsettlingly precise. Isolde speaks in "
                "measurements — distances, angles, the exact number of paces between "
                "one lamppost and the next. Her colleagues find this endearing for "
                "approximately forty minutes, after which it becomes unbearable. She "
                "has a habit of pausing mid-sentence to recalibrate some internal "
                "compass, her grey eyes unfocusing briefly as though consulting a map "
                "no one else can see. She wears a heavy coat regardless of weather, "
                "its pockets bristling with graduated rulers and folded charts. Her "
                "hands are stained with cartographic ink that she has stopped trying "
                "to wash off. She considers doubt a professional virtue and certainty "
                "a form of intellectual laziness. She trusts her instruments more than "
                "her instincts, which, given what her instincts have led her to in "
                "the past, is probably wise."
            ),
            "character_de": (
                "Wachsam, bedächtig und beunruhigend präzise. Isolde spricht in "
                "Maßeinheiten — Entfernungen, Winkel, die exakte Anzahl von Schritten "
                "zwischen einem Laternenpfahl und dem nächsten. Ihre Kollegen finden "
                "das etwa vierzig Minuten lang charmant, danach wird es unerträglich. "
                "Sie hat die Angewohnheit, mitten im Satz innezuhalten, um einen "
                "inneren Kompass neu zu kalibrieren, wobei ihre grauen Augen kurz "
                "den Fokus verlieren, als konsultiere sie eine Karte, die niemand "
                "sonst sehen kann. Sie trägt ungeachtet des Wetters einen schweren "
                "Mantel, dessen Taschen vor Maßstäben und gefalteten Karten strotzen."
            ),
            "background": (
                f"Arrived at the eastern gate of {sim_name} carrying a surveyor's "
                "transit and a leather satchel of maps that, upon inspection, turned "
                "out to chart territories that do not exist on any official record. "
                "She presented these to the gate clerk with the calm insistence of "
                "someone who has been right before and was punished for it. Her "
                "previous posting — a cartographic bureau in a city she refuses to "
                "name — ended when she discovered that certain districts were being "
                "systematically removed from census data. She filed a report. The "
                "report was filed in return, into a locked cabinet. She left shortly "
                "after. "
                f"{mentions[0].title() if not mentions[0][0].isupper() else mentions[0]}"
                " was the first person to take her "
                "maps seriously, or at least to pretend convincingly enough that "
                "Isolde could not tell the difference. She has been assigned to "
                "survey the boundary zones, which is either a recognition of her "
                "talents or a way to keep her out of the central archives."
            ),
            "background_de": (
                f"Kam am Osttor von {sim_name} an, mit einem Vermessungsgerät und "
                "einer Ledertasche voller Karten, die bei näherer Betrachtung Gebiete "
                "verzeichneten, die in keinem offiziellen Register existieren. Sie "
                "legte diese dem Torschreiber mit der ruhigen Bestimmtheit vor, die "
                "jemand ausstrahlt, der schon einmal Recht hatte und dafür bestraft "
                "wurde. Ihre vorherige Stelle — ein kartographisches Büro in einer "
                "Stadt, deren Namen sie sich weigert zu nennen — endete, als sie "
                "entdeckte, dass bestimmte Bezirke systematisch aus den Zensusdaten "
                "entfernt wurden. Sie reichte einen Bericht ein. Der Bericht wurde "
                "seinerseits eingereicht, in einen verschlossenen Schrank."
            ),
        },
        {
            "name": "Calder Vetch",
            "gender": "male",
            "system": "The Foundry",
            "primary_profession": "Residue Analyst",
            "primary_profession_de": "Rückstandsanalytiker",
            "character": (
                "Quiet in the way that large, careful men sometimes are — not shy but "
                "selective, as though words are a finite resource and he has decided "
                "to ration them. Calder's hands are enormous, scarred with chemical "
                "burns arranged in patterns that suggest either extreme carelessness "
                "or extreme precision. He smells permanently of sulphur and old books. "
                "His laugh, when it surfaces, is startlingly loud and always surprises "
                "him as much as anyone else. He keeps a small notebook in which he "
                "records the colour and consistency of industrial residues with the "
                "tenderness other men reserve for love poetry. He distrusts theory "
                "and respects material evidence. He has been known to lick suspicious "
                "substances to identify them, a practice his superiors have forbidden "
                "exactly as many times as he has ignored them."
            ),
            "character_de": (
                "Still auf die Art, die großen, bedächtigen Männern eigen ist — nicht "
                "schüchtern, sondern selektiv, als wären Worte eine endliche Ressource, "
                "die er zu rationieren beschlossen hat. Calders Hände sind riesig, "
                "vernarbt von Verätzungen in Mustern, die entweder auf extreme "
                "Nachlässigkeit oder extreme Präzision schließen lassen. Er riecht "
                "permanent nach Schwefel und alten Büchern. Sein Lachen, wenn es "
                "auftaucht, ist erschreckend laut und überrascht ihn stets ebenso "
                "wie alle anderen."
            ),
            "background": (
                f"Calder walked into {sim_name} through the service tunnels beneath "
                "the freight depot, which is either a sign of resourcefulness or a "
                "sign that no one told him where the front door was. He carried a "
                "crate of glass sample jars, each labelled in a shorthand alphabet "
                "of his own invention. His previous employer — a refinery in the "
                "industrial hinterlands — collapsed when its primary furnace began "
                "producing material that no one could identify and everyone was afraid "
                "to touch. Calder was the only analyst willing to examine it. His "
                "findings were inconclusive but fascinating, filling three notebooks "
                "that he still consults. "
                f"{mentions[1].title() if not mentions[1][0].isupper() else mentions[1]}"
                " recognised his expertise immediately "
                "and assigned him to the Foundry's output analysis division, where "
                "his willingness to handle inexplicable substances is considered a "
                "virtue rather than a liability. He has not yet been told what the "
                "Foundry actually produces. He suspects no one knows."
            ),
            "background_de": (
                f"Calder betrat {sim_name} durch die Versorgungstunnel unter dem "
                "Frachtdepot, was entweder ein Zeichen von Einfallsreichtum ist oder "
                "ein Zeichen dafür, dass ihm niemand gesagt hat, wo die Vordertür "
                "ist. Er trug eine Kiste mit Glasproben, jede beschriftet in einem "
                "Kurzschrift-Alphabet seiner eigenen Erfindung. Sein vorheriger "
                "Arbeitgeber — eine Raffinerie im industriellen Hinterland — brach "
                "zusammen, als sein Hauptofen begann, Material zu produzieren, das "
                "niemand identifizieren konnte und das anzufassen sich alle fürchteten."
            ),
        },
        {
            "name": "Senna Aldine",
            "gender": "non-binary",
            "system": "The Hollows",
            "primary_profession": "Whisper Auditor",
            "primary_profession_de": "Flüsterprüfer\u00b7in",
            "character": (
                "Precise, amused, and morally unreadable. Senna has the unsettling "
                "habit of finishing other people's sentences — not with the wrong "
                "words, but with the words the speaker was trying to avoid. They "
                "dress in muted layers that seem to absorb light, making them "
                "difficult to track in peripheral vision. Their voice is soft and "
                "carries oddly well in enclosed spaces, a trait they exploit with "
                "obvious relish. They have a scar across the bridge of their nose "
                "that they claim was caused by a filing cabinet. The story changes "
                "each time they tell it. They keep meticulous records of debts, "
                "favours, and secrets in a cipher that has resisted three separate "
                "attempts at decryption. They consider transparency overrated and "
                "trust a negotiable concept."
            ),
            "character_de": (
                "Präzise, amüsiert und moralisch unlesbar. Senna hat die "
                "beunruhigende Angewohnheit, die Sätze anderer zu beenden — nicht "
                "mit den falschen Worten, sondern mit jenen, die der Sprecher zu "
                "vermeiden versuchte. Sie kleiden sich in gedämpfte Schichten, die "
                "Licht zu absorbieren scheinen, was sie im peripheren Blickfeld "
                "schwer verfolgbar macht. Ihre Stimme ist leise und trägt seltsam "
                "gut in geschlossenen Räumen, eine Eigenschaft, die sie mit "
                "offensichtlichem Vergnügen ausnutzen."
            ),
            "background": (
                f"No one is entirely certain when Senna arrived in {sim_name}. The "
                "gate records show no entry; the housing registry shows them as a "
                "tenant of three months' standing. When asked, they smile and suggest "
                "that perhaps the records are correct and everyone else's memory is "
                "wrong. They claim to have served as an auditor in a subterranean "
                "market two cities east, where the economy ran on whispered confidences "
                "weighed on brass scales. The market collapsed — not financially but "
                "literally, into a sinkhole — and Senna emerged from the rubble with "
                "their ledger intact and their composure undisturbed. "
                f"{mentions[2].title() if not mentions[2][0].isupper() else mentions[2]}"
                " has expressed both admiration and unease"
                " at Senna's "
                "ability to appraise the value of information by ear alone. They have "
                "been assigned to audit the Hollows' debt networks, a task that "
                "everyone agrees needs doing and no one else was willing to attempt."
            ),
            "background_de": (
                f"Niemand ist sich ganz sicher, wann Senna in {sim_name} angekommen "
                "ist. Die Torprotokolle zeigen keinen Eintritt; das Wohnungsregister "
                "führt sie als Mieter\u00b7in seit drei Monaten. Auf Nachfrage lächeln "
                "sie und schlagen vor, dass vielleicht die Akten korrekt sind und "
                "die Erinnerung aller anderen falsch. Sie behaupten, als Prüfer\u00b7in "
                "in einem unterirdischen Markt zwei Städte östlich gedient zu haben, "
                "wo die Wirtschaft auf geflüsterten Vertraulichkeiten lief, gewogen "
                "auf Messingwaagen."
            ),
        },
    ]
    from backend.models.forge import ForgeAgentDraft

    return _validate_mock_list(pool[:3], ForgeAgentDraft)


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
        "streets": [{"name": s.get("name", "?"), "street_type_de": s.get("street_type", "")} for s in streets],
        "simulation": {"description_de": f"[DE Mock] {sim_desc[:100]}..."},
    }
