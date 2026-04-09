"""Composable ambient weather narrative templates.

4-layer composition system: Opener + Core Weather + Consequence + Agent Reaction.
Each layer is a pool of (EN, DE) tuples, selected via SHA-256 seeded randomness
with Tetris 7-bag anti-repetition. Templates use {zone}, {temperature}, {visibility},
{wind_speed}, {precipitation}, {humidity} interpolation from live weather data.

All templates are validated at import time (_validate_templates). Any invalid
placeholder triggers an immediate ValueError, preventing deployment of broken templates.

Research basis: NWS Graphical Forecast Editor (rule/template NLG), Caves of Qud
(FDG'17 replacement grammar), Emily Short (multi-tag salience), Tetris 7-bag.
"""

from __future__ import annotations

# Type alias for bilingual template tuples
T = tuple[str, str]  # (english, deutsch)

# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 1: ATMOSPHERE OPENERS
# Selected by TimeOfDay. Sets the scene before the weather description.
# ═══════════════════════════════════════════════════════════════════════════════

OPENERS: dict[str, dict[str, list[T]]] = {
    # ── spy-thriller (Velgarien) ──────────────────────────────────────────────
    "spy-thriller": {
        "dawn": [
            ("As dawn breaks over {zone},", "Als die Daemmerung ueber {zone} anbricht,"),
            ("The first grey light reaches {zone}.", "Das erste graue Licht erreicht {zone}."),
            (
                "Morning mist clings to {zone} as the city stirs.",
                "Morgennebel haengt ueber {zone}, waehrend die Stadt erwacht.",
            ),
            ("Before the first shift change in {zone},", "Vor dem ersten Schichtwechsel in {zone},"),
            (
                "The surveillance cameras in {zone} catch the first light.",
                "Die Ueberwachungskameras in {zone} fangen das erste Licht ein.",
            ),
        ],
        "day": [
            ("Under the midday sky of {zone},", "Unter dem Mittagshimmel von {zone},"),
            ("The afternoon settles over {zone}.", "Der Nachmittag legt sich ueber {zone}."),
            ("In the bright hours over {zone},", "In den hellen Stunden ueber {zone},"),
            ("As the day wears on in {zone},", "Waehrend der Tag in {zone} voranschreitet,"),
            ("The Bureau's watchtowers survey {zone}.", "Die Wachtuerme des Bureaus ueberblicken {zone}."),
        ],
        "dusk": [
            ("As twilight descends on {zone},", "Waehrend die Daemmerung ueber {zone} hereinbricht,"),
            ("The last light fades from {zone}.", "Das letzte Licht schwindet aus {zone}."),
            ("Shadows lengthen across {zone}.", "Schatten strecken sich ueber {zone}."),
            ("The streetlamps flicker on in {zone}.", "Die Strassenlaternen flackern in {zone} auf."),
            ("Dusk settles like a veil over {zone}.", "Die Daemmerung legt sich wie ein Schleier ueber {zone}."),
        ],
        "night": [
            ("In the dead of night, {zone} falls silent.", "In tiefer Nacht verstummt {zone}."),
            ("{zone} lies under a dark sky.", "{zone} liegt unter dunklem Himmel."),
            (
                "The night watch begins its rounds through {zone}.",
                "Die Nachtwache beginnt ihren Rundgang durch {zone}.",
            ),
            ("Past midnight in {zone},", "Nach Mitternacht in {zone},"),
            (
                "The only movement in {zone} belongs to those who prefer darkness.",
                "Die einzige Bewegung in {zone} gehoert denen, die die Dunkelheit vorziehen.",
            ),
        ],
    },
    # ── scifi (Station Null) ──────────────────────────────────────────────────
    "scifi": {
        "dawn": [
            (
                "As the station's lighting cycles to day-mode in {zone},",
                "Als die Stationsbeleuchtung in {zone} auf Tagmodus schaltet,",
            ),
            ("The artificial sunrise illuminates {zone}.", "Der kuenstliche Sonnenaufgang erhellt {zone}."),
            ("Morning protocols initialize across {zone}.", "Morgenprotokolle starten in {zone}."),
            (
                "The circadian emitters in {zone} shift to warm spectrum.",
                "Die zirkadianen Strahler in {zone} wechseln ins Warmspektrum.",
            ),
            ("Shift rotation begins in {zone}.", "Die Schichtrotation beginnt in {zone}."),
        ],
        "day": [
            ("Under full illumination in {zone},", "Bei voller Beleuchtung in {zone},"),
            ("Standard operations continue in {zone}.", "Der Normalbetrieb setzt sich in {zone} fort."),
            (
                "The environmental systems in {zone} report nominal conditions.",
                "Die Umweltsysteme in {zone} melden Normalbetrieb.",
            ),
            ("Midshift in {zone}.", "Halbschicht in {zone}."),
            ("The air recyclers in {zone} hum steadily.", "Die Luftrecycler in {zone} summen gleichmaessig."),
        ],
        "dusk": [
            ("As {zone} transitions to night cycle,", "Waehrend {zone} in den Nachtzyklus uebergeht,"),
            ("The lighting in {zone} dims to rest-spectrum.", "Die Beleuchtung in {zone} dimmt auf Ruhespektrum."),
            ("Evening protocols engage in {zone}.", "Abendprotokolle greifen in {zone}."),
            ("The last duty shift rotates out of {zone}.", "Die letzte Dienstschicht rotiert aus {zone} heraus."),
            (
                "Cooling systems in {zone} reduce output as crew activity drops.",
                "Kuehlsysteme in {zone} reduzieren die Leistung bei sinkender Crew-Aktivitaet.",
            ),
        ],
        "night": [
            ("In the station's simulated night, {zone} quiets.", "In der simulierten Stationsnacht wird {zone} still."),
            (
                "Emergency lighting casts long shadows across {zone}.",
                "Notbeleuchtung wirft lange Schatten ueber {zone}.",
            ),
            ("Only essential systems remain active in {zone}.", "Nur essentielle Systeme bleiben in {zone} aktiv."),
            (
                "The skeleton crew monitors {zone} through bleary eyes.",
                "Die Minimalbesatzung ueberwacht {zone} mit mueden Augen.",
            ),
            (
                "Silence blankets {zone}, broken only by the hiss of life support.",
                "Stille legt sich ueber {zone}, nur unterbrochen vom Zischen der Lebenserhaltung.",
            ),
        ],
    },
    # ── biopunk (The Gaslit Reach) ────────────────────────────────────────────
    "biopunk": {
        "dawn": [
            (
                "As bioluminescent tides retreat from {zone},",
                "Waehrend die biolumineszenten Gezeiten sich aus {zone} zurueckziehen,",
            ),
            (
                "The first light filters through the canopy above {zone}.",
                "Das erste Licht sickert durch das Blattdach ueber {zone}.",
            ),
            ("Dawn phosphorescence ripples through {zone}.", "Daemmerungs-Phosphoreszenz zieht Wellen durch {zone}."),
            ("The morning spore cycle begins in {zone}.", "Der morgendliche Sporenzyklus beginnt in {zone}."),
            (
                "Fungal lanterns dim as true light reaches {zone}.",
                "Pilzlaternen verblassen, als echtes Licht {zone} erreicht.",
            ),
        ],
        "day": [
            ("Under the diffused light of {zone},", "Im gedaempften Licht von {zone},"),
            ("The coral structures of {zone} pulse gently.", "Die Korallenstrukturen von {zone} pulsieren sanft."),
            ("Midday currents shift through {zone}.", "Mittagsstroemungen verschieben sich durch {zone}."),
            ("The living architecture of {zone} breathes.", "Die lebende Architektur von {zone} atmet."),
            (
                "Symbiotic organisms in {zone} reach peak activity.",
                "Symbiotische Organismen in {zone} erreichen ihre Spitzenaktivitaet.",
            ),
        ],
        "dusk": [
            (
                "As the light fades, {zone}'s bioluminescence awakens.",
                "Waehrend das Licht schwindet, erwacht die Biolumineszenz von {zone}.",
            ),
            ("Twilight triggers the glowing season in {zone}.", "Die Daemmerung loest die Leuchtzeit in {zone} aus."),
            ("The evening tides bring new scents to {zone}.", "Die Abendgezeiten bringen neue Duefte nach {zone}."),
            (
                "Spore clouds drift lazily through {zone} as day ends.",
                "Sporenwolken treiben traege durch {zone}, waehrend der Tag endet.",
            ),
            (
                "The organisms of {zone} shift from photosynthesis to chemosynthesis.",
                "Die Organismen von {zone} wechseln von Photosynthese zu Chemosynthese.",
            ),
        ],
        "night": [
            (
                "In the deep night, {zone} glows with inner light.",
                "In tiefer Nacht gluehen die inneren Lichter von {zone}.",
            ),
            ("{zone} pulses softly in the darkness.", "{zone} pulsiert sanft in der Dunkelheit."),
            (
                "Nocturnal predators stir in the outer reaches of {zone}.",
                "Nachtjaeger regen sich in den Aussenbezirken von {zone}.",
            ),
            ("The mycelial networks beneath {zone} come alive.", "Die Myzelnetze unter {zone} erwachen zum Leben."),
            (
                "Only the glow of phosphorescent fungi illuminates {zone}.",
                "Nur das Leuchten phosphoreszierender Pilze erhellt {zone}.",
            ),
        ],
    },
    # ── post-apocalyptic (Speranza) ───────────────────────────────────────────
    "post-apocalyptic": {
        "dawn": [
            ("As the sun clears the rubble line of {zone},", "Als die Sonne die Truemmerlinie von {zone} uebersteigt,"),
            ("Morning light reveals the scars of {zone}.", "Morgenlicht enthuellt die Narben von {zone}."),
            ("The salvage crews stir in {zone}.", "Die Bergungstrupps regen sich in {zone}."),
            (
                "Another dawn, another day of survival in {zone}.",
                "Eine weitere Morgendaemmerung, ein weiterer Tag des Ueberlebens in {zone}.",
            ),
            (
                "The watchers on the walls of {zone} report the horizon clear.",
                "Die Waechter auf den Mauern von {zone} melden freien Horizont.",
            ),
        ],
        "day": [
            ("Under the harsh sun of {zone},", "Unter der harten Sonne von {zone},"),
            ("Midday heat shimmers above {zone}.", "Mittagshitze flirrt ueber {zone}."),
            ("The day wears on in {zone}, relentless.", "Der Tag schleppt sich in {zone} dahin, unbarmherzig."),
            ("Dust hangs in the still air of {zone}.", "Staub haengt in der stillen Luft von {zone}."),
            ("The cisterns in {zone} glint in the light.", "Die Zisternen in {zone} glitzern im Licht."),
        ],
        "dusk": [
            (
                "As the sun drops behind {zone}'s crumbling skyline,",
                "Waehrend die Sonne hinter der broeckelnden Skyline von {zone} versinkt,",
            ),
            (
                "The cooling air of {zone} brings brief relief.",
                "Die abkuehlende Luft von {zone} bringt kurze Erleichterung.",
            ),
            ("Evening patrols set out from {zone}.", "Abendpatrouillen brechen aus {zone} auf."),
            (
                "The last traders retreat into {zone} before dark.",
                "Die letzten Haendler ziehen sich vor Einbruch der Dunkelheit nach {zone} zurueck.",
            ),
            ("Shadows swallow the ruins around {zone}.", "Schatten verschlucken die Ruinen rund um {zone}."),
        ],
        "night": [
            (
                "Darkness falls over {zone} like a held breath.",
                "Dunkelheit faellt ueber {zone} wie ein angehaltener Atem.",
            ),
            (
                "The night fires of {zone} flicker against the dark.",
                "Die Nachtfeuer von {zone} flackern gegen die Dunkelheit.",
            ),
            ("In the quiet hours, {zone} hunkers down.", "In den stillen Stunden duckt sich {zone}."),
            ("Only the sentries stay awake in {zone}.", "Nur die Wachtposten bleiben in {zone} wach."),
            (
                "Stars wheel overhead. {zone} endures another night.",
                "Sterne kreisen. {zone} uebersteht eine weitere Nacht.",
            ),
        ],
    },
    # ── medieval (Cité des Dames) ─────────────────────────────────────────────
    "medieval": {
        "dawn": [
            ("As the bells of {zone} ring for lauds,", "Als die Glocken von {zone} zur Laudes laeuten,"),
            ("The first light touches the walls of {zone}.", "Das erste Licht beruehrt die Mauern von {zone}."),
            ("Morning prayers echo through {zone}.", "Morgengebete hallen durch {zone}."),
            ("The gates of {zone} open with the dawn.", "Die Tore von {zone} oeffnen sich mit der Morgendaemmerung."),
            ("Dew glistens on the cobblestones of {zone}.", "Tau glaenzt auf dem Kopfsteinpflaster von {zone}."),
        ],
        "day": [
            (
                "Under the high sun, {zone} bustles with purpose.",
                "Unter der Mittagssonne herrscht geschaeftiges Treiben in {zone}.",
            ),
            ("The market square of {zone} fills with voices.", "Der Marktplatz von {zone} fuellt sich mit Stimmen."),
            (
                "Midday in {zone} brings the smell of bread and ink.",
                "Mittag in {zone} bringt den Duft von Brot und Tinte.",
            ),
            (
                "The scholars of {zone} bend over their manuscripts.",
                "Die Gelehrten von {zone} beugen sich ueber ihre Manuskripte.",
            ),
            (
                "Industry and intellect mark the hours in {zone}.",
                "Fleiss und Verstand bestimmen die Stunden in {zone}.",
            ),
        ],
        "dusk": [
            ("As vespers sound across {zone},", "Als die Vesper ueber {zone} erklingt,"),
            ("The last light gilds the towers of {zone}.", "Das letzte Licht vergoldet die Tuerme von {zone}."),
            (
                "The workshops of {zone} close their shutters.",
                "Die Werkstaetten von {zone} schliessen ihre Fensterlaeden.",
            ),
            ("Evening fires are lit in {zone}.", "Abendfeuer werden in {zone} entzuendet."),
            (
                "The day's debates in {zone} yield to quieter reflection.",
                "Die Debatten des Tages in {zone} weichen stillerer Besinnung.",
            ),
        ],
        "night": [
            ("Night falls gently over {zone}.", "Die Nacht senkt sich sanft ueber {zone}."),
            (
                "The walls of {zone} stand sentinel in the dark.",
                "Die Mauern von {zone} stehen wachend in der Dunkelheit.",
            ),
            (
                "Candlelight flickers behind the windows of {zone}.",
                "Kerzenlicht flackert hinter den Fenstern von {zone}.",
            ),
            ("The night watch circles {zone}'s perimeter.", "Die Nachtwache umrundet {zone}."),
            (
                "In the scriptorium of {zone}, a single candle still burns.",
                "Im Skriptorium von {zone} brennt noch eine einzelne Kerze.",
            ),
        ],
    },
}

# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 2: CORE WEATHER DESCRIPTIONS
# Selected by AmbientCategory. The central weather event description.
# Uses {temperature}, {visibility}, {wind_speed}, {precipitation}, {zone}.
# ═══════════════════════════════════════════════════════════════════════════════

CORE_WEATHER: dict[str, dict[str, list[T]]] = {
    # ── spy-thriller ──────────────────────────────────────────────────────────
    "spy-thriller": {
        "clear": [
            ("clear skies expose every movement", "klarer Himmel entbloesst jede Bewegung"),
            (
                "not a cloud in sight — perfect conditions for aerial surveillance",
                "keine Wolke in Sicht — perfekte Bedingungen fuer Luftueberwachung",
            ),
            (
                "the sky is an unbroken blue, offering no cover",
                "der Himmel ist ein lueckenloses Blau und bietet keine Deckung",
            ),
            (
                "at {temperature}°C under open skies, the city lies exposed",
                "bei {temperature}°C unter offenem Himmel liegt die Stadt entbloesst",
            ),
            (
                "sunlight picks out every detail in the streets below",
                "Sonnenlicht hebt jedes Detail in den Strassen hervor",
            ),
        ],
        "overcast": [
            ("a grey ceiling of clouds presses down on the rooftops", "eine graue Wolkendecke drueckt auf die Daecher"),
            (
                "overcast skies blur the line between buildings and sky",
                "bewolkter Himmel verwischt die Grenze zwischen Gebaeuden und Himmel",
            ),
            (
                "the cloud cover at {temperature}°C gives the city a leaden quality",
                "die Wolkendecke bei {temperature}°C verleiht der Stadt eine bleierne Qualitaet",
            ),
            (
                "grey light flattens everything into a surveillance photograph",
                "graues Licht macht alles flach wie ein Ueberwachungsfoto",
            ),
            (
                "the overcast sky turns every window into a dark mirror",
                "der bewoelkte Himmel verwandelt jedes Fenster in einen dunklen Spiegel",
            ),
        ],
        "fog": [
            (
                "thick fog blankets the streets, reducing visibility to arm's length",
                "dichter Nebel huellt die Strassen ein, die Sicht reicht kaum einen Arm weit",
            ),
            (
                "a grey haze drifts between buildings, swallowing sound",
                "ein grauer Dunst treibt zwischen den Gebaeuden und verschluckt jeden Laut",
            ),
            (
                "fog rolls in from the river, turning lampposts into ghosts",
                "Nebel rollt vom Fluss herein und verwandelt Laternen in Geister",
            ),
            (
                "visibility drops to {visibility}m — the city dissolves into shapes",
                "die Sicht sinkt auf {visibility}m — die Stadt loest sich in Umrisse auf",
            ),
            ("a wall of fog erases the skyline", "eine Nebelwand loescht die Silhouette aus"),
        ],
        "fog_dense": [
            (
                "fog so thick that voices seem to come from everywhere and nowhere",
                "Nebel so dicht, dass Stimmen von ueberall und nirgendwo zu kommen scheinen",
            ),
            (
                "visibility below {visibility}m — agents navigate by memory alone",
                "Sicht unter {visibility}m — Agenten navigieren nur noch aus dem Gedaechtnis",
            ),
            (
                "the fog is a living thing, pressing against windows and doors",
                "der Nebel ist ein Lebewesen, das gegen Fenster und Tueren drueckt",
            ),
            (
                "in this fog, even the Bureau's cameras are blind",
                "in diesem Nebel sind selbst die Kameras des Bureaus blind",
            ),
            ("the world shrinks to an arm's length of grey", "die Welt schrumpft auf eine Armlaenge Grau"),
        ],
        "rain_light": [
            ("a fine drizzle mists the streets", "feiner Nieselregen benetzt die Strassen"),
            ("light rain beads on coat collars and hat brims", "leichter Regen perlt an Mantelkragen und Hutkreppen"),
            (
                "a persistent drizzle softens the edges of the city",
                "ein anhaltendes Nieseln weicht die Konturen der Stadt auf",
            ),
            (
                "{precipitation}mm of fine rain dampens spirits and streets alike",
                "{precipitation}mm feiner Regen daempft Stimmung und Strassen gleichermassen",
            ),
            (
                "the drizzle is barely visible but soaks through everything",
                "der Nieselregen ist kaum sichtbar, durchdringt aber alles",
            ),
        ],
        "rain": [
            (
                "steady rain drums on rooftops, pooling in gutters and doorways",
                "stetiger Regen trommelt auf Daecher, sammelt sich in Rinnen und Eingaengen",
            ),
            (
                "{precipitation}mm of rain — the streets run like canals",
                "{precipitation}mm Regen — die Strassen fliessen wie Kanaele",
            ),
            (
                "rain streaks the windows of government buildings, distorting reflections",
                "Regen zeichnet Schlieren auf die Fenster der Regierungsgebaeude",
            ),
            (
                "the rain is relentless, turning every alley into an echo chamber",
                "der Regen ist unerbittlich und verwandelt jede Gasse in eine Echokammer",
            ),
            (
                "puddles mirror the grey sky, doubling the sense of enclosure",
                "Pfuetzen spiegeln den grauen Himmel und verdoppeln das Gefuehl der Enge",
            ),
        ],
        "rain_freezing": [
            (
                "freezing rain coats everything in a treacherous glaze",
                "Eisregen ueberzieht alles mit einer tueckischen Glasur",
            ),
            (
                "at {temperature}°C, rain turns to ice on contact",
                "bei {temperature}°C verwandelt sich Regen beim Aufprall in Eis",
            ),
            (
                "black ice forms on every surface — the city becomes a trap",
                "Glatteis bildet sich auf jeder Flaeche — die Stadt wird zur Falle",
            ),
            (
                "freezing rain drums against metal, a sound like static",
                "Eisregen trommelt gegen Metall, ein Klang wie Rauschen",
            ),
            (
                "the rain freezes mid-air, falling as needles of ice",
                "der Regen gefriert in der Luft und faellt als Eisnadeln",
            ),
        ],
        "storm": [
            (
                "sheets of rain sweep across the streets at {wind_speed}km/h",
                "Regenwaende fegen mit {wind_speed}km/h ueber die Strassen",
            ),
            (
                "the storm hammers the city, bending streetlights and flooding drains",
                "der Sturm haemmert auf die Stadt, biegt Laternen und flutet Abfluesse",
            ),
            (
                "driving rain obliterates visibility and drowns out conversation",
                "peitschender Regen loescht die Sicht und uebertont jedes Gespraech",
            ),
            (
                "{precipitation}mm in a single hour — the drainage systems overflow",
                "{precipitation}mm in einer einzigen Stunde — die Abwassersysteme laufen ueber",
            ),
            (
                "the storm turns familiar streets into hostile territory",
                "der Sturm verwandelt vertraute Strassen in feindliches Gebiet",
            ),
        ],
        "snow": [
            ("snow falls silently, muffling the city in white", "Schnee faellt lautlos und huellt die Stadt in Weiss"),
            (
                "at {temperature}°C, the first snowflakes appear",
                "bei {temperature}°C erscheinen die ersten Schneeflocken",
            ),
            (
                "a blanket of fresh snow covers every surveillance footprint",
                "eine Decke frischen Schnees bedeckt jeden Ueberwachungsabdruck",
            ),
            (
                "snow accumulates on windowsills and rooftops, softening every edge",
                "Schnee sammelt sich auf Fensterbraenken und Daechern und weicht jede Kante auf",
            ),
            (
                "the snowfall transforms the city into a hushed, white labyrinth",
                "der Schneefall verwandelt die Stadt in ein stilles, weisses Labyrinth",
            ),
        ],
        "storm_snow": [
            (
                "a blizzard rages at {wind_speed}km/h, whiting out the city",
                "ein Schneesturm tobt mit {wind_speed}km/h und huellt die Stadt in Weiss",
            ),
            ("driving snow reduces visibility to near zero", "treibender Schnee reduziert die Sicht auf nahezu null"),
            (
                "the snowstorm buries roads and freezes communications",
                "der Schneesturm begraebt Strassen und friert Kommunikation ein",
            ),
            (
                "at {temperature}°C with {wind_speed}km/h winds, exposure is lethal",
                "bei {temperature}°C und {wind_speed}km/h Wind ist Exposition toedlich",
            ),
            (
                "the blizzard erases all landmarks — navigation becomes impossible",
                "der Schneesturm loescht alle Orientierungspunkte — Navigation wird unmoeglich",
            ),
        ],
        "thunderstorm": [
            ("thunder cracks over the rooftops, shaking windows", "Donner bricht ueber den Daechern, Fenster zittern"),
            ("lightning illuminates the city in staccato flashes", "Blitze erhellen die Stadt in Stakkato-Blitzen"),
            (
                "the thunderstorm knocks out power in several blocks",
                "das Gewitter legt den Strom in mehreren Bloecken lahm",
            ),
            (
                "at {temperature}°C, the air crackles with static before each strike",
                "bei {temperature}°C knistert die Luft vor Statik vor jedem Einschlag",
            ),
            (
                "rain and thunder transform the city into a war zone",
                "Regen und Donner verwandeln die Stadt in ein Kriegsgebiet",
            ),
        ],
        "thunderstorm_severe": [
            (
                "a violent thunderstorm with hail batters every surface",
                "ein heftiges Gewitter mit Hagel prasselt auf jede Flaeche",
            ),
            (
                "hailstones the size of coins crack against windows and cars",
                "Hagelkoerner so gross wie Muenzen prasseln gegen Fenster und Autos",
            ),
            (
                "the storm's fury is almost personal — lightning strikes within metres",
                "die Wut des Sturms ist fast persoenlich — Blitze schlagen im Meterbereich ein",
            ),
            (
                "at {wind_speed}km/h with hail, the city takes shelter underground",
                "bei {wind_speed}km/h mit Hagel sucht die Stadt Schutz im Untergrund",
            ),
            (
                "the severity of the storm shuts down all surface operations",
                "die Schwere des Sturms legt alle Oberflaechenoperationen lahm",
            ),
        ],
        "heat": [
            (
                "at {temperature}°C, the asphalt shimmers with heat mirages",
                "bei {temperature}°C flirrt der Asphalt vor Hitze",
            ),
            (
                "the heat is oppressive — even the shadows offer no relief",
                "die Hitze ist drueckend — selbst die Schatten bieten keine Erleichterung",
            ),
            (
                "{temperature}°C drives everyone into air-conditioned bunkers",
                "{temperature}°C treibt alle in klimatisierte Bunker",
            ),
            (
                "the city bakes under {temperature}°C, tempers as short as fuses",
                "die Stadt bratet unter {temperature}°C, die Nerven so kurz wie Zuendschnuere",
            ),
            (
                "heat radiates from every stone surface, distorting the air",
                "Hitze strahlt von jeder Steinflaeche ab und verzerrt die Luft",
            ),
        ],
        "cold": [
            (
                "bitter cold grips the city at {temperature}°C",
                "beissende Kaelte umklammert die Stadt bei {temperature}°C",
            ),
            ("at {temperature}°C, breath crystallizes instantly", "bei {temperature}°C kristallisiert der Atem sofort"),
            ("the cold cuts through every layer of clothing", "die Kaelte schneidet durch jede Kleidungsschicht"),
            (
                "{temperature}°C — exposed pipes burst and puddles freeze solid",
                "{temperature}°C — freiliegende Rohre platzen und Pfuetzen gefrieren durch",
            ),
            (
                "the cold is absolute, turning metal handles into brands",
                "die Kaelte ist absolut und verwandelt Metallgriffe in Brandeisen",
            ),
        ],
        "wind": [
            (
                "wind howls through the streets at {wind_speed}km/h",
                "Wind heult mit {wind_speed}km/h durch die Strassen",
            ),
            (
                "{wind_speed}km/h gusts rattle shutters and scatter papers",
                "{wind_speed}km/h Boeen lassen Fensterlaeden klappern und wirbeln Papiere auf",
            ),
            (
                "the wind carries voices from blocks away — and drowns out those nearby",
                "der Wind traegt Stimmen von Bloecken weit weg — und uebertont die nahen",
            ),
            (
                "at {wind_speed}km/h, loose objects become projectiles",
                "bei {wind_speed}km/h werden lose Gegenstaende zu Geschossen",
            ),
            (
                "a cold wind channels through the narrow streets like a river",
                "ein kalter Wind stroemt durch die engen Strassen wie ein Fluss",
            ),
        ],
        "full_moon": [
            (
                "a full moon hangs over the rooftops, bright as a searchlight",
                "ein Vollmond haengt ueber den Daechern, hell wie ein Suchscheinwerfer",
            ),
            (
                "the full moon bathes the city in silver — too bright for covert operations",
                "der Vollmond badet die Stadt in Silber — zu hell fuer verdeckte Operationen",
            ),
            (
                "moonlight casts hard shadows, creating a second city of light and dark",
                "Mondlicht wirft harte Schatten und schafft eine zweite Stadt aus Licht und Dunkel",
            ),
            (
                "under the full moon, every rooftop silhouette is visible for kilometres",
                "unter dem Vollmond ist jede Dachsilhouette kilometerweit sichtbar",
            ),
            (
                "the full moon turns night into a pale imitation of day",
                "der Vollmond verwandelt die Nacht in eine blasse Nachahmung des Tages",
            ),
        ],
        "new_moon": [
            (
                "no moon — the darkness is total beyond the reach of streetlights",
                "kein Mond — die Dunkelheit ist jenseits der Strassenlaternen absolut",
            ),
            (
                "the moonless night wraps the city in operational darkness",
                "die mondlose Nacht huellt die Stadt in operationelle Dunkelheit",
            ),
            (
                "without moonlight, the city's edges blur into the void",
                "ohne Mondlicht verschwimmen die Raender der Stadt im Nichts",
            ),
            (
                "a new moon night — ideal conditions for those who work in shadows",
                "eine Neumondnacht — ideale Bedingungen fuer jene, die im Schatten arbeiten",
            ),
            (
                "the absence of moonlight makes every alley a black corridor",
                "das Fehlen von Mondlicht macht jede Gasse zu einem schwarzen Korridor",
            ),
        ],
    },
    # ── scifi (Station Null) ──────────────────────────────────────────────────
    "scifi": {
        "clear": [
            (
                "external sensors report clear conditions — hull temperature stable at {temperature}°C",
                "Aussensensoren melden klare Bedingungen — Huellentemperatur stabil bei {temperature}°C",
            ),
            (
                "atmospheric readings nominal — no anomalies detected",
                "Atmosphaerische Messwerte nominal — keine Anomalien erkannt",
            ),
            (
                "the observation ports show an undisturbed expanse",
                "die Beobachtungsluken zeigen eine ungestoerte Weite",
            ),
            ("all environmental parameters within tolerance", "alle Umgebungsparameter innerhalb der Toleranz"),
            (
                "the station's exterior cameras capture pristine conditions",
                "die Aussenkameras der Station erfassen makellose Bedingungen",
            ),
        ],
        "overcast": [
            (
                "dense cloud formations register on external sensors",
                "dichte Wolkenformationen registrieren sich auf Aussensensoren",
            ),
            (
                "atmospheric opacity increases — reduced solar panel efficiency",
                "atmosphaerische Truebung nimmt zu — reduzierte Solarpanel-Effizienz",
            ),
            ("cloud layer detected at observation altitude", "Wolkenschicht auf Beobachtungshoehe erkannt"),
            (
                "diffused radiation readings indicate heavy cloud cover",
                "diffuse Strahlungswerte deuten auf dichte Bewolekung hin",
            ),
            (
                "the exterior view shows nothing but grey — all instruments compensate",
                "die Aussensicht zeigt nur Grau — alle Instrumente kompensieren",
            ),
        ],
        "fog": [
            (
                "condensation forms on external hull sensors — readings compromised",
                "Kondensation bildet sich an Aussensensoren — Messwerte beeintraechtigt",
            ),
            (
                "atmospheric fog interferes with lidar and optical systems",
                "atmosphaerischer Nebel stoert Lidar- und optische Systeme",
            ),
            (
                "humidity at {humidity}% — internal condensation protocols activated",
                "Luftfeuchtigkeit bei {humidity}% — interne Kondensationsprotokolle aktiviert",
            ),
            (
                "external visibility drops to {visibility}m — docking operations suspended",
                "Aussensicht sinkt auf {visibility}m — Andockoperationen ausgesetzt",
            ),
            (
                "moisture accumulation on sensor arrays requires manual clearing",
                "Feuchtigkeitsansammlung an Sensorarrays erfordert manuelle Reinigung",
            ),
        ],
        "fog_dense": [
            (
                "sensor arrays report near-zero visibility — emergency protocols standby",
                "Sensorarrays melden nahezu null Sicht — Notfallprotokolle in Bereitschaft",
            ),
            (
                "dense atmospheric interference — all external operations halted",
                "dichte atmosphaerische Stoerung — alle Aussenoperationen gestoppt",
            ),
            (
                "the station is blind — {visibility}m visibility across all spectra",
                "die Station ist blind — {visibility}m Sicht ueber alle Spektren",
            ),
            (
                "corrosive condensation detected on hull — maintenance alert issued",
                "korrosive Kondensation am Rumpf erkannt — Wartungsalarm ausgeloest",
            ),
            ("environmental hazard level elevated — EVA prohibited", "Umweltgefahrenstufe erhoeht — EVA verboten"),
        ],
        "rain_light": [
            (
                "trace precipitation detected on hull — {precipitation}mm registered",
                "Spurenniederschlag am Rumpf erkannt — {precipitation}mm registriert",
            ),
            ("light moisture contact on external surfaces", "leichter Feuchtigkeitskontakt auf Aussenflaechen"),
            (
                "atmospheric drizzle — hull integrity unaffected",
                "atmosphaerisches Nieseln — Rumpfintegritaet nicht beeintraechtigt",
            ),
            (
                "minor precipitation event logged at {precipitation}mm",
                "geringfuegiges Niederschlagsereignis bei {precipitation}mm protokolliert",
            ),
            (
                "moisture sensors register intermittent contact",
                "Feuchtigkeitssensoren registrieren intermittierenden Kontakt",
            ),
        ],
        "rain": [
            (
                "sustained precipitation at {precipitation}mm — drainage systems active",
                "anhaltender Niederschlag bei {precipitation}mm — Abflusssysteme aktiv",
            ),
            (
                "rain impact on hull generates a low-frequency hum through the corridors",
                "Regenaufprall auf den Rumpf erzeugt ein tieffrequentes Brummen durch die Korridore",
            ),
            (
                "environmental moisture levels rising — dehumidifiers at 80% capacity",
                "Umgebungsfeuchtigkeit steigt — Entfeuchter bei 80% Kapazitaet",
            ),
            ("external camera lenses require constant clearing", "Aussenkameralinsen erfordern staendige Reinigung"),
            (
                "the sound of rain on the hull is oddly soothing to the crew",
                "das Geraeusch von Regen auf dem Rumpf beruhigt die Crew auf seltsame Weise",
            ),
        ],
        "rain_freezing": [
            (
                "ice formation on external surfaces at {temperature}°C — critical",
                "Eisbildung an Aussenflaechen bei {temperature}°C — kritisch",
            ),
            (
                "freezing precipitation — antenna arrays at risk of damage",
                "gefrierender Niederschlag — Antenenarrays von Beschaedigung bedroht",
            ),
            ("hull de-icing systems engaged at maximum output", "Rumpf-Enteisungssysteme auf maximaler Leistung"),
            (
                "ice accretion rate exceeds design parameters at {temperature}°C",
                "Eisanlagerungsrate ueberschreitet Designparameter bei {temperature}°C",
            ),
            (
                "sensor calibration compromised by ice — manual verification required",
                "Sensorkalibrierung durch Eis beeintraechtigt — manuelle Verifizierung erforderlich",
            ),
        ],
        "storm": [
            (
                "atmospheric disturbance — external pressure fluctuations logged",
                "atmosphaerische Stoerung — externe Druckschwankungen protokolliert",
            ),
            (
                "storm-force conditions at {wind_speed}km/h — structural stress monitors active",
                "Sturmbedingungen bei {wind_speed}km/h — Strukturspannungsmonitore aktiv",
            ),
            (
                "the station shudders under sustained atmospheric assault",
                "die Station zittert unter anhaltendem atmosphaerischem Ansturm",
            ),
            (
                "{precipitation}mm precipitation combined with {wind_speed}km/h winds — red alert threshold approaching",
                "{precipitation}mm Niederschlag kombiniert mit {wind_speed}km/h Wind — Rotalarmschwelle naht",
            ),
            (
                "vibration dampeners compensate for external turbulence",
                "Vibrationsdaempfer kompensieren aeussere Turbulenzen",
            ),
        ],
        "snow": [
            (
                "crystalline precipitation at {temperature}°C — thermal management adjusting",
                "kristalliner Niederschlag bei {temperature}°C — Thermalmanagement passt an",
            ),
            (
                "snow accumulation on solar panels reduces power generation by 12%",
                "Schneeanlagerung auf Solarpanelen reduziert Stromerzeugung um 12%",
            ),
            (
                "the station's exterior transforms into a white landscape",
                "das Aeussere der Station verwandelt sich in eine weisse Landschaft",
            ),
            (
                "sub-zero crystallization detected across all external surfaces",
                "Kristallisation unter null auf allen Aussenflaechen erkannt",
            ),
            (
                "snow dampens all external acoustic monitoring",
                "Schnee daempft saemtliche aeussere akustische Ueberwachung",
            ),
        ],
        "storm_snow": [
            (
                "blizzard conditions — {wind_speed}km/h with heavy snowfall",
                "Blizzard-Bedingungen — {wind_speed}km/h mit starkem Schneefall",
            ),
            (
                "white-out conditions — all external navigation impossible",
                "Whiteout-Bedingungen — jegliche aeussere Navigation unmoeglich",
            ),
            (
                "snow accumulation rate critical — automated clearing systems at capacity",
                "Schneeanlagerungsrate kritisch — automatische Raeumungssysteme an Kapazitaetsgrenze",
            ),
            (
                "structural integrity warnings from forward sections at {wind_speed}km/h",
                "Strukturelle Integritaetswarnungen aus Vorwartssektionen bei {wind_speed}km/h",
            ),
            (
                "communications antenna buried under ice — switching to backup array",
                "Kommunikationsantenne unter Eis begraben — Umschaltung auf Backup-Array",
            ),
        ],
        "thunderstorm": [
            (
                "electromagnetic disturbance — lightning detected within 500m",
                "elektromagnetische Stoerung — Blitz innerhalb 500m erkannt",
            ),
            (
                "power systems surge as lightning strikes nearby — capacitors absorb excess",
                "Stromsysteme ueberlasten bei nahegelegenem Blitzeinschlag — Kondensatoren absorbieren Ueberschuss",
            ),
            (
                "atmospheric electrical discharge disrupts shortwave communications",
                "atmosphaerische elektrische Entladung stoert Kurzwellenkommunikation",
            ),
            (
                "thunder reverberates through the hull like a depth charge",
                "Donner hallt durch den Rumpf wie eine Wasserbombe",
            ),
            (
                "lightning strike on antenna mast — systems rerouting through backup",
                "Blitzeinschlag am Antennenmast — Systeme leiten auf Backup um",
            ),
        ],
        "thunderstorm_severe": [
            (
                "severe electromagnetic storm — all non-essential systems powered down",
                "schwerer elektromagnetischer Sturm — alle nicht-essentiellen Systeme heruntergefahren",
            ),
            (
                "hail impact on hull exceeds design tolerance — damage report incoming",
                "Hagelaufprall auf Rumpf ueberschreitet Designtoleranz — Schadensbericht eingehend",
            ),
            (
                "multiple lightning strikes per minute — Faraday cage integrity holding",
                "mehrere Blitzeinschlaege pro Minute — Faradaykaefig-Integritaet haelt",
            ),
            (
                "the worst atmospheric event in station history — all hands to stations",
                "das schlimmste atmosphaerische Ereignis in der Stationsgeschichte — alle Mann auf Station",
            ),
            (
                "power grid instability — rolling blackouts across non-critical sections",
                "Stromnetz-Instabilitaet — rollende Blackouts in nicht-kritischen Sektionen",
            ),
        ],
        "heat": [
            (
                "external temperature {temperature}°C — cooling systems at maximum",
                "Aussentemperatur {temperature}°C — Kuehlsysteme auf Maximum",
            ),
            (
                "thermal load exceeds nominal — crew advised to reduce physical activity",
                "Thermische Last ueberschreitet Nominalwert — Crew wird zu reduzierter koerperlicher Aktivitaet geraten",
            ),
            (
                "heat exchanger efficiency drops as ambient temperature reaches {temperature}°C",
                "Waermetauschereffizienz sinkt bei Umgebungstemperatur von {temperature}°C",
            ),
            (
                "the station's thermal mass absorbs heat — interior temperature rising slowly",
                "die thermische Masse der Station absorbiert Waerme — Innentemperatur steigt langsam",
            ),
            (
                "UV radiation at elevated levels — external exposure limited to 30 minutes",
                "UV-Strahlung auf erhoehtem Niveau — externe Exposition auf 30 Minuten begrenzt",
            ),
        ],
        "cold": [
            (
                "hull temperature drops to {temperature}°C — thermal stress monitors active",
                "Huellentemperatur sinkt auf {temperature}°C — Thermalstressmonitore aktiv",
            ),
            (
                "extreme cold at {temperature}°C — auxiliary heating engaged",
                "extreme Kaelte bei {temperature}°C — Zusatzheizung aktiviert",
            ),
            (
                "condensation freezing on interior surfaces near hull junctions",
                "Kondensation gefriert an Innenflaechen nahe Rumpfverbindungen",
            ),
            (
                "life support systems increase heating output to compensate for {temperature}°C exterior",
                "Lebenserhaltungssysteme erhoehen Heizleistung zum Ausgleich von {temperature}°C aussen",
            ),
            (
                "crew reports visible breath in peripheral corridors — insulation check ordered",
                "Crew meldet sichtbaren Atem in peripheren Korridoren — Isolationspruefung angeordnet",
            ),
        ],
        "wind": [
            (
                "wind loads at {wind_speed}km/h cause measurable structural flex",
                "Windlasten bei {wind_speed}km/h verursachen messbare strukturelle Durchbiegung",
            ),
            (
                "{wind_speed}km/h winds generate harmonic vibrations in external antenna arrays",
                "{wind_speed}km/h Winde erzeugen harmonische Vibrationen in externen Antennenarrays",
            ),
            (
                "aerodynamic buffeting at {wind_speed}km/h — crew notices subtle deck movement",
                "aerodynamisches Schlagen bei {wind_speed}km/h — Crew bemerkt subtile Deckbewegung",
            ),
            (
                "wind shear across the station creates differential pressure zones",
                "Windscherung ueber der Station erzeugt differentielle Druckzonen",
            ),
            (
                "sustained wind at {wind_speed}km/h — EVA operations suspended",
                "anhaltender Wind bei {wind_speed}km/h — EVA-Operationen ausgesetzt",
            ),
        ],
        "full_moon": [
            (
                "full moon — external illumination allows visual hull inspection",
                "Vollmond — externe Beleuchtung ermoeglicht visuelle Rumpfinspektion",
            ),
            (
                "lunar maximum — tidal forces measurable in fluid systems",
                "Lunarmaximum — Gezeitenkraefte in Fluidsystemen messbar",
            ),
            (
                "the full moon reflects off the station's hull, creating a halo effect",
                "der Vollmond reflektiert am Stationsrumpf und erzeugt einen Halo-Effekt",
            ),
            (
                "crew sleep patterns disrupted during full moon cycle — melatonin supplements distributed",
                "Crew-Schlafmuster waehrend Vollmondzyklus gestoert — Melatonin-Ergaenzungen verteilt",
            ),
            (
                "full moon illumination intensity exceeds standard night-lighting",
                "Vollmond-Beleuchtungsintensitaet uebersteigt Standard-Nachtbeleuchtung",
            ),
        ],
        "new_moon": [
            (
                "new moon — external darkness absolute, star field fully visible",
                "Neumond — aeussere Dunkelheit absolut, Sternenfeld voll sichtbar",
            ),
            (
                "no lunar illumination — exterior cameras switch to infrared",
                "keine Mondbeleuchtung — Aussenkameras wechseln auf Infrarot",
            ),
            (
                "the new moon leaves the station wrapped in cosmic darkness",
                "der Neumond laesst die Station in kosmische Dunkelheit gehuellt",
            ),
            (
                "without moonlight, the observation deck offers an unobstructed star field",
                "ohne Mondlicht bietet das Observierungsdeck ein ungehindertes Sternenfeld",
            ),
            (
                "crew reports improved sleep quality during new moon — circadian benefit",
                "Crew meldet verbesserte Schlafqualitaet bei Neumond — zirkadianer Vorteil",
            ),
        ],
    },
    # ── biopunk (The Gaslit Reach) ────────────────────────────────────────────
    "biopunk": {
        "clear": [
            (
                "the waters are still — bioluminescent plankton drift in lazy spirals",
                "die Gewaesser sind still — biolumineszentes Plankton treibt in traegen Spiralen",
            ),
            (
                "calm conditions allow the coral structures to expand their fronds",
                "ruhige Bedingungen erlauben den Korallenstrukturen, ihre Wedel auszubreiten",
            ),
            (
                "at {temperature}°C, the symbiotic algae reach peak photosynthetic output",
                "bei {temperature}°C erreichen die symbiotischen Algen ihre maximale Photosyntheseleistung",
            ),
            (
                "clear conditions reveal the full depth of the living architecture",
                "klare Bedingungen enthuellen die volle Tiefe der lebenden Architektur",
            ),
            (
                "the air is sweet with oxygen from the upper canopy",
                "die Luft ist suess vom Sauerstoff des oberen Blattdachs",
            ),
        ],
        "overcast": [
            (
                "diffused light triggers a shift in the canopy's bioluminescent spectrum",
                "gedaempftes Licht loest eine Verschiebung im biolumineszenten Spektrum des Blattdachs aus",
            ),
            (
                "the overcast sky suppresses upper-level photosynthesis — deeper organisms compensate",
                "der bewoelkte Himmel unterdrueckt obere Photosynthese — tiefere Organismen kompensieren",
            ),
            (
                "grey light gives the living walls a bruised, purple hue",
                "graues Licht gibt den lebenden Waenden einen blauschwarzen Farbton",
            ),
            (
                "cloud cover reduces UV — the protective slime layer on buildings thins",
                "Wolkendecke reduziert UV — die Schutzschleimschicht an Gebaeuden wird duenner",
            ),
            (
                "without direct sun, the fungal colonies grow bolder",
                "ohne direkte Sonne werden die Pilzkolonien kuehner",
            ),
        ],
        "fog": [
            (
                "spore-laden fog drifts through the passages, thick as breath",
                "sporenhaltiger Nebel treibt durch die Gaenge, dick wie Atem",
            ),
            (
                "the fog carries the scent of decay and new growth",
                "der Nebel traegt den Duft von Verfall und neuem Wachstum",
            ),
            (
                "visibility drops to {visibility}m — the bioluminescent markers pulse brighter",
                "Sicht sinkt auf {visibility}m — die biolumineszenten Markierungen pulsieren heller",
            ),
            (
                "mist condenses on every living surface, feeding the moss",
                "Nebel kondensiert auf jeder lebenden Flaeche und naehrt das Moos",
            ),
            (
                "the fog is alive with microscopic organisms — every breath is an ecosystem",
                "der Nebel ist lebendig mit mikroskopischen Organismen — jeder Atemzug ist ein Oekosystem",
            ),
        ],
        "fog_dense": [
            (
                "the fog is so dense that bioluminescence becomes the only navigation aid",
                "der Nebel ist so dicht, dass Biolumineszenz die einzige Navigationshilfe wird",
            ),
            (
                "visibility below {visibility}m — the mycelial network relays spatial data instead",
                "Sicht unter {visibility}m — das Myzelnetzwerk uebermittelt stattdessen Raumdaten",
            ),
            (
                "the dense fog triggers emergency sporulation in the wall organisms",
                "der dichte Nebel loest Notsporulation in den Wandorganismen aus",
            ),
            (
                "breathing becomes laboured in the thick, organism-laden air",
                "das Atmen wird muehsam in der dichten, organismenbeladenen Luft",
            ),
            (
                "the fog wraps everything in a living, breathing blanket",
                "der Nebel huellt alles in eine lebende, atmende Decke",
            ),
        ],
        "rain_light": [
            (
                "a fine rain feeds the canopy, triggering cascading drips below",
                "feiner Regen naehrt das Blattdach und loest kaskadierende Tropfen darunter aus",
            ),
            (
                "light rain activates the scent glands of the wall flowers",
                "leichter Regen aktiviert die Duftdruesen der Wandblumen",
            ),
            (
                "{precipitation}mm of gentle rain — the coral structures drink deeply",
                "{precipitation}mm sanfter Regen — die Korallenstrukturen trinken tief",
            ),
            (
                "drizzle runs along the living walls in luminous rivulets",
                "Nieselregen rinnt entlang der lebenden Waende in leuchtenden Rinnsalen",
            ),
            (
                "the light rain is warm — {temperature}°C — and smells of petrichor and spores",
                "der leichte Regen ist warm — {temperature}°C — und riecht nach Petrichor und Sporen",
            ),
        ],
        "rain": [
            (
                "steady rain overwhelms the canopy's drainage — waterfalls form at every junction",
                "stetiger Regen ueberlastet die Drainage des Blattdachs — Wasserfaelle bilden sich an jeder Kreuzung",
            ),
            (
                "{precipitation}mm of rain — the fungal gutters overflow with bioluminescent runoff",
                "{precipitation}mm Regen — die Pilzrinnen laufen ueber mit biolumineszentem Ablauf",
            ),
            (
                "the rain pounds the outer membranes, sending vibrations through the structure",
                "der Regen haemmert auf die Aussenmembranen und sendet Vibrationen durch die Struktur",
            ),
            (
                "torrential rain flushes parasites from the coral — a natural cleansing",
                "stroemender Regen spuelt Parasiten aus der Koralle — eine natuerliche Reinigung",
            ),
            (
                "rain drums on the living architecture, each surface responding differently",
                "Regen trommelt auf die lebende Architektur, jede Flaeche reagiert anders",
            ),
        ],
        "rain_freezing": [
            (
                "freezing rain at {temperature}°C threatens the living structures — anti-freeze secretions activate",
                "Eisregen bei {temperature}°C bedroht die lebenden Strukturen — Frostschutzsekrete aktivieren sich",
            ),
            (
                "ice crystals form on the coral fronds — a rare and dangerous beauty",
                "Eiskristalle bilden sich auf den Korallenwedeln — eine seltene und gefaehrliche Schoenheit",
            ),
            (
                "the organisms slow to near-dormancy as temperature drops below freezing",
                "die Organismen verlangsamen sich bis zur Beinahe-Dormanz bei Temperaturen unter dem Gefrierpunkt",
            ),
            (
                "cryogenic stress triggers emergency bioluminescence across the colony",
                "kryogener Stress loest Notfall-Biolumineszenz in der gesamten Kolonie aus",
            ),
            (
                "ice encases the outer tentacles of the wall organisms — they retract slowly",
                "Eis umschliesst die aeusseren Tentakel der Wandorganismen — sie ziehen sich langsam zurueck",
            ),
        ],
        "storm": [
            (
                "the storm batters the outer membrane at {wind_speed}km/h — repair organisms deploy",
                "der Sturm peitscht auf die Aussenmembran bei {wind_speed}km/h — Reparaturorganismen setzen sich ein",
            ),
            (
                "{precipitation}mm of driving rain tests the living architecture's resilience",
                "{precipitation}mm peitschender Regen testet die Widerstandsfaehigkeit der lebenden Architektur",
            ),
            (
                "storm currents redistribute nutrients — the colony enters rapid-growth mode",
                "Sturmstroemungen verteilen Naehrstoffe um — die Kolonie tritt in den Schnellwachstumsmodus",
            ),
            (
                "the outer bioluminescence flares in distress patterns during the storm",
                "die aeussere Biolumineszenz flammt in Notmustern waehrend des Sturms auf",
            ),
            (
                "waves crash against the foundations — the structure flexes and holds",
                "Wellen krachen gegen die Fundamente — die Struktur biegt sich und haelt",
            ),
        ],
        "snow": [
            (
                "snow settles on the canopy — an alien white layer on living green",
                "Schnee legt sich auf das Blattdach — eine fremde weisse Schicht auf lebendigem Gruen",
            ),
            (
                "at {temperature}°C, the organisms slow their metabolism — conservation mode",
                "bei {temperature}°C verlangsamen die Organismen ihren Stoffwechsel — Konservierungsmodus",
            ),
            (
                "snowflakes dissolve on contact with the warm living walls",
                "Schneeflocken loesen sich bei Kontakt mit den warmen lebenden Waenden auf",
            ),
            (
                "the first snow triggers a colour change in the canopy — green shifts to deep blue",
                "der erste Schnee loest einen Farbwechsel im Blattdach aus — Gruen wechselt zu tiefem Blau",
            ),
            (
                "snow accumulates on dead branches — living ones shed it with gentle shudders",
                "Schnee sammelt sich auf toten Aesten — lebende schuetteln ihn mit sanftem Zittern ab",
            ),
        ],
        "storm_snow": [
            (
                "a blizzard rages outside — the living walls contract to conserve heat",
                "ein Schneesturm tobt draussen — die lebenden Waende ziehen sich zusammen, um Waerme zu bewahren",
            ),
            (
                "snow at {wind_speed}km/h — the outer organisms go dormant within minutes",
                "Schnee bei {wind_speed}km/h — die aeusseren Organismen werden innerhalb von Minuten dormant",
            ),
            (
                "the colony seals its outer pores against the blizzard — a siege response",
                "die Kolonie versiegelt ihre aeusseren Poren gegen den Schneesturm — eine Belagerungsreaktion",
            ),
            (
                "driving snow blocks the light entirely — emergency chemosynthesis activated",
                "treibender Schnee blockiert das Licht vollstaendig — Notfall-Chemosynthese aktiviert",
            ),
            (
                "the blizzard tests the colony's survival instincts — all resources redirected inward",
                "der Schneesturm testet die Ueberlebensinstinkte der Kolonie — alle Ressourcen nach innen umgeleitet",
            ),
        ],
        "thunderstorm": [
            (
                "lightning strikes the tallest coral spire — bioluminescent shockwave ripples outward",
                "Blitz trifft die hoechste Korallenspitze — biolumineszente Schockwelle breitet sich aus",
            ),
            (
                "thunder vibrates through the living architecture — organisms respond with synchronized pulses",
                "Donner vibriert durch die lebende Architektur — Organismen antworten mit synchronisierten Pulsen",
            ),
            (
                "the electrical discharge supercharges the mycelial network — data transmission spikes",
                "die elektrische Entladung ueberlaet das Myzelnetzwerk — Datenübertragung schnellt hoch",
            ),
            (
                "rain and lightning create a spectacular display of competing luminescence",
                "Regen und Blitze erzeugen ein spektakulaeres Schauspiel konkurrierender Lumineszenz",
            ),
            (
                "the storm energizes the colony — growth rates increase 300% for hours afterward",
                "der Sturm energetisiert die Kolonie — Wachstumsraten steigen fuer Stunden danach um 300%",
            ),
        ],
        "thunderstorm_severe": [
            (
                "the violent storm tears sections of the outer canopy — regeneration will take days",
                "der heftige Sturm reisst Sektionen des aeusseren Blattdachs ab — Regeneration wird Tage dauern",
            ),
            (
                "hail shreds the delicate frond-tips — the colony bleeds luminescent fluid",
                "Hagel zerfetzt die empfindlichen Wedelspitzen — die Kolonie blutet lumineszente Fluessigkeit",
            ),
            (
                "multiple lightning strikes overwhelm the colony's bioelectric grid — cascading failures",
                "mehrfache Blitzeinschlaege ueberlasten das bioelektrische Netz der Kolonie — kaskadierende Ausfaelle",
            ),
            (
                "the worst storm in living memory — elder organisms emit distress pheromones",
                "der schlimmste Sturm in lebender Erinnerung — aeltere Organismen senden Notpheromone aus",
            ),
            (
                "structural damage to the outer shell — the colony prioritizes core preservation",
                "strukturelle Schaeden an der Aussenschale — die Kolonie priorisiert Kernerhaltung",
            ),
        ],
        "heat": [
            (
                "at {temperature}°C, the upper organisms enter heat-stress — pigments shift to reflective white",
                "bei {temperature}°C treten die oberen Organismen in Hitzestress — Pigmente wechseln zu reflektierendem Weiss",
            ),
            (
                "the heat causes rapid evaporation — the living walls weep moisture",
                "die Hitze verursacht rapide Verdunstung — die lebenden Waende schwitzen Feuchtigkeit",
            ),
            (
                "{temperature}°C pushes the coral's thermal tolerance — bleaching begins at the edges",
                "{temperature}°C uebersteigt die Waermetoleranz der Koralle — Bleichen beginnt an den Raendern",
            ),
            (
                "heat-loving parasites emerge from dormancy — the colony's immune response activates",
                "waermeliebende Parasiten erwachen aus der Dormanz — die Immunantwort der Kolonie aktiviert sich",
            ),
            (
                "the air shimmers with heat and spores — breathing becomes thick",
                "die Luft flimmert vor Hitze und Sporen — das Atmen wird schwer",
            ),
        ],
        "cold": [
            (
                "at {temperature}°C, the living walls contract — insulating air pockets form",
                "bei {temperature}°C ziehen sich die lebenden Waende zusammen — isolierende Lufttaschen bilden sich",
            ),
            (
                "cold shock triggers anti-freeze protein production throughout the colony",
                "Kaelteschock loest Frostschutzprotein-Produktion in der gesamten Kolonie aus",
            ),
            (
                "the organisms slow to near-stillness — even bioluminescence dims",
                "die Organismen verlangsamen sich bis zur Beinahe-Stille — selbst die Biolumineszenz verblasst",
            ),
            (
                "{temperature}°C — the outer membrane hardens to a protective shell",
                "{temperature}°C — die Aussenmembran haertet zu einer Schutzschale",
            ),
            (
                "bitter cold drives all mobile organisms deep into the warm interior",
                "beissende Kaelte treibt alle mobilen Organismen tief ins warme Innere",
            ),
        ],
        "wind": [
            (
                "{wind_speed}km/h winds sway the canopy — the colony adjusts its root grip",
                "{wind_speed}km/h Winde wiegen das Blattdach — die Kolonie passt ihren Wurzelgriff an",
            ),
            (
                "strong winds carry spores far beyond the colony's usual range",
                "starke Winde tragen Sporen weit ueber den ueblichen Bereich der Kolonie hinaus",
            ),
            (
                "the wind strips pollen and loose material from the outer structures",
                "der Wind reisst Pollen und loses Material von den Aussenstrukturen",
            ),
            (
                "at {wind_speed}km/h, the flexible architecture sways like kelp in a current",
                "bei {wind_speed}km/h wiegt sich die flexible Architektur wie Seetang in einer Stroemung",
            ),
            (
                "wind-borne nutrients enrich the colony — upper organisms unfurl to catch them",
                "windgetragene Naehrstoffe bereichern die Kolonie — obere Organismen entfalten sich, um sie aufzufangen",
            ),
        ],
        "full_moon": [
            (
                "the full moon triggers a mass spawning event — the water glows with gametes",
                "der Vollmond loest ein Massenlaichevent aus — das Wasser leuchtet von Gameten",
            ),
            (
                "lunar tides pull at the colony's foundations — the living walls flex",
                "Mondgezeiten zerren an den Fundamenten der Kolonie — die lebenden Waende biegen sich",
            ),
            (
                "under the full moon, the bioluminescence reaches its most intense spectrum",
                "unter dem Vollmond erreicht die Biolumineszenz ihr intensivstes Spektrum",
            ),
            (
                "the colony's reproductive cycle synchronizes with the lunar maximum",
                "der Reproduktionszyklus der Kolonie synchronisiert sich mit dem Lunarmaximum",
            ),
            (
                "nocturnal predators are most active under the full moon — the colony's defences heighten",
                "naechtliche Raeuber sind bei Vollmond am aktivsten — die Abwehr der Kolonie verstaerkt sich",
            ),
        ],
        "new_moon": [
            (
                "without moonlight, the bioluminescence is the only light source — the colony glows",
                "ohne Mondlicht ist die Biolumineszenz die einzige Lichtquelle — die Kolonie gluehen",
            ),
            (
                "the new moon brings the darkest tides — deep-dwelling creatures venture upward",
                "der Neumond bringt die dunkelsten Gezeiten — Tiefseewesen wagen sich nach oben",
            ),
            (
                "in total darkness, the colony's internal communication network blazes with data",
                "in voelliger Dunkelheit brennt das interne Kommunikationsnetzwerk der Kolonie vor Daten",
            ),
            (
                "the absence of moonlight calms the surface organisms — the colony enters a meditative state",
                "das Fehlen von Mondlicht beruhigt die Oberflaechenorganismen — die Kolonie tritt in einen meditativen Zustand",
            ),
            (
                "new moon darkness reveals the colony's own light — a constellation of living stars",
                "Neumond-Dunkelheit enthuellt das eigene Licht der Kolonie — eine Konstellation lebender Sterne",
            ),
        ],
    },
    # ── post-apocalyptic (Speranza) ───────────────────────────────────────────
    "post-apocalyptic": {
        "clear": [
            (
                "the sun beats down with {temperature}°C — no shade survives in the open",
                "die Sonne brennt mit {temperature}°C — kein Schatten ueberlebt im Freien",
            ),
            (
                "clear skies mean exposed water sources evaporate faster",
                "klarer Himmel bedeutet, dass offene Wasserquellen schneller verdunsten",
            ),
            ("under blue sky, the ruins cast sharp shadows", "unter blauem Himmel werfen die Ruinen scharfe Schatten"),
            (
                "the clarity reveals how far the wasteland extends in every direction",
                "die Klarheit zeigt, wie weit das Oedland sich in jede Richtung erstreckt",
            ),
            (
                "clear weather is a mixed blessing — good for salvage, bad for hiding",
                "klares Wetter ist ein zweischneidiges Schwert — gut fuer Bergung, schlecht zum Verstecken",
            ),
        ],
        "overcast": [
            (
                "a grey sky presses down like a lid — {temperature}°C and no wind",
                "ein grauer Himmel drueckt wie ein Deckel — {temperature}°C und kein Wind",
            ),
            (
                "the overcast conditions make the ruins look even more desolate",
                "die bewoelkten Bedingungen lassen die Ruinen noch trister aussehen",
            ),
            (
                "cloud cover traps the heat — the air is thick and stale",
                "Wolkendecke faengt die Hitze ein — die Luft ist dick und schal",
            ),
            (
                "grey light turns the salvage fields into a monochrome photograph",
                "graues Licht verwandelt die Bergungsfelder in ein monochromes Foto",
            ),
            (
                "under the overcast sky, sounds travel strangely far",
                "unter dem bewoelkten Himmel tragen Geraeusche seltsam weit",
            ),
        ],
        "fog": [
            (
                "fog drifts through the ruins, obscuring salvage routes",
                "Nebel treibt durch die Ruinen und verschleiert Bergungsrouten",
            ),
            (
                "the fog carries the smell of rust and old concrete",
                "der Nebel traegt den Geruch von Rost und altem Beton",
            ),
            (
                "at {visibility}m visibility, patrol routes are shortened",
                "bei {visibility}m Sicht werden Patrouillenrouten verkuerzt",
            ),
            (
                "fog turns familiar landmarks into threatening shapes",
                "Nebel verwandelt vertraute Orientierungspunkte in bedrohliche Formen",
            ),
            (
                "the mist softens the edges of the ruins — almost beautiful",
                "der Dunst weicht die Kanten der Ruinen auf — fast schoen",
            ),
        ],
        "fog_dense": [
            (
                "the fog is impenetrable — {visibility}m visibility at best",
                "der Nebel ist undurchdringlich — bestenfalls {visibility}m Sicht",
            ),
            (
                "in this fog, raider parties could approach undetected",
                "in diesem Nebel koennten Raeubergruppen unbemerkt naeher kommen",
            ),
            (
                "the dense fog traps exhaust fumes — the air becomes toxic",
                "der dichte Nebel faengt Abgase ein — die Luft wird giftig",
            ),
            (
                "every sound is amplified and distorted in the thick fog",
                "jedes Geraeusch wird im dichten Nebel verstaerkt und verzerrt",
            ),
            (
                "the fog is so thick that the sentries can barely see the wall beneath them",
                "der Nebel ist so dicht, dass die Wachen kaum die Mauer unter sich sehen koennen",
            ),
        ],
        "rain_light": [
            (
                "a fine rain — the cistern collectors are deployed",
                "feiner Regen — die Zisternensammler werden eingesetzt",
            ),
            ("light rain at {temperature}°C settles the dust", "leichter Regen bei {temperature}°C legt den Staub"),
            (
                "{precipitation}mm of drizzle — every drop counts for the reservoirs",
                "{precipitation}mm Nieselregen — jeder Tropfen zaehlt fuer die Reservoirs",
            ),
            (
                "the drizzle brings a rare freshness to the stale air",
                "der Nieselregen bringt eine seltene Frische in die abgestandene Luft",
            ),
            (
                "light rain makes the rubble slippery — salvage teams proceed with caution",
                "leichter Regen macht den Schutt rutschig — Bergungsteams gehen vorsichtig vor",
            ),
        ],
        "rain": [
            (
                "rain at {precipitation}mm — the community celebrates every drop",
                "Regen bei {precipitation}mm — die Gemeinschaft feiert jeden Tropfen",
            ),
            (
                "steady rain fills the cisterns — water rationing suspended for today",
                "stetiger Regen fuellt die Zisternen — Wasserrationierung fuer heute ausgesetzt",
            ),
            (
                "the rain turns dust to mud and rubble paths to streams",
                "der Regen verwandelt Staub in Schlamm und Schuttrouten in Baeche",
            ),
            (
                "{precipitation}mm of rain — enough to wash the salt from the crops",
                "{precipitation}mm Regen — genug, um das Salz von den Ernten zu waschen",
            ),
            (
                "rain drums on corrugated roofs, a sound that means life",
                "Regen trommelt auf Wellblechdaecher, ein Klang, der Leben bedeutet",
            ),
        ],
        "rain_freezing": [
            (
                "freezing rain at {temperature}°C — the crops are in danger",
                "Eisregen bei {temperature}°C — die Ernten sind in Gefahr",
            ),
            (
                "ice coats every surface — the walkways become death traps",
                "Eis ueberzieht jede Flaeche — die Gehwege werden zu Todesfallen",
            ),
            (
                "freezing rain destroys the makeshift greenhouses",
                "Eisregen zerstoert die provisorischen Gewaechshaeuser",
            ),
            (
                "at {temperature}°C with freezing rain, survival becomes the only priority",
                "bei {temperature}°C mit Eisregen wird Ueberleben zur einzigen Prioritaet",
            ),
            (
                "the ice makes every exposed pipe useless — insulation is critical",
                "das Eis macht jedes freiliegende Rohr unbrauchbar — Isolierung ist kritisch",
            ),
        ],
        "storm": [
            (
                "the storm tears at shelters — repair crews stand by",
                "der Sturm reisst an Unterkuenften — Reparaturtrupps stehen bereit",
            ),
            (
                "{wind_speed}km/h winds with {precipitation}mm rain — the compound hunkers down",
                "{wind_speed}km/h Wind mit {precipitation}mm Regen — die Anlage duckt sich",
            ),
            (
                "the storm rips loose sheet metal from rooftops — lethal projectiles",
                "der Sturm reisst loses Blech von Daechern — toedliche Geschosse",
            ),
            (
                "driving rain floods the lower quarters — evacuation routes activated",
                "peitschender Regen flutet die unteren Quartiere — Evakuierungsrouten aktiviert",
            ),
            (
                "the storm is violent but brief — it leaves behind a changed landscape",
                "der Sturm ist heftig aber kurz — er hinterlaesst eine veraenderte Landschaft",
            ),
        ],
        "snow": [
            (
                "snow falls on the ruins — a strange, silent beauty",
                "Schnee faellt auf die Ruinen — eine seltsame, stille Schoenheit",
            ),
            (
                "at {temperature}°C, the first snow covers the scars of the wasteland",
                "bei {temperature}°C bedeckt der erste Schnee die Narben des Oedlands",
            ),
            (
                "snow insulates the shelters — interior temperatures rise slightly",
                "Schnee isoliert die Unterkuenfte — Innentemperaturen steigen leicht",
            ),
            (
                "the children have never seen this much snow — wonder mingles with worry",
                "die Kinder haben noch nie so viel Schnee gesehen — Staunen mischt sich mit Sorge",
            ),
            (
                "snow transforms the compound into something almost pre-war",
                "Schnee verwandelt die Anlage in etwas fast Vorkriegsaehnliches",
            ),
        ],
        "storm_snow": [
            (
                "a blizzard at {wind_speed}km/h — all outdoor activities cancelled",
                "ein Schneesturm bei {wind_speed}km/h — alle Aussenaktivitaeten abgesagt",
            ),
            (
                "the snowstorm buries supply routes — rationing begins immediately",
                "der Schneesturm begraebt Versorgungsrouten — Rationierung beginnt sofort",
            ),
            (
                "white-out conditions — the sentries cannot see the perimeter",
                "Whiteout-Bedingungen — die Wachen koennen den Perimeter nicht sehen",
            ),
            (
                "at {temperature}°C with {wind_speed}km/h wind, frostbite sets in within minutes",
                "bei {temperature}°C mit {wind_speed}km/h Wind setzt Erfrierung innerhalb von Minuten ein",
            ),
            (
                "the blizzard isolates the community — they are on their own",
                "der Schneesturm isoliert die Gemeinschaft — sie sind auf sich allein gestellt",
            ),
        ],
        "thunderstorm": [
            (
                "thunder echoes off the ruins — the old buildings groan in response",
                "Donner hallt von den Ruinen wider — die alten Gebaeude aechzen als Antwort",
            ),
            (
                "lightning strikes a collapsed tower — sparks fly across the rubble",
                "Blitz trifft einen kollabierten Turm — Funken fliegen ueber den Schutt",
            ),
            (
                "the thunderstorm shorts out the solar arrays — backup power activated",
                "das Gewitter schliesst die Solaranlagen kurz — Notstrom aktiviert",
            ),
            (
                "rain and thunder — the community takes shelter in the deepest bunkers",
                "Regen und Donner — die Gemeinschaft sucht Schutz in den tiefsten Bunkern",
            ),
            (
                "lightning illuminates the wasteland in stark, terrible beauty",
                "Blitze beleuchten das Oedland in harter, schrecklicher Schoenheit",
            ),
        ],
        "thunderstorm_severe": [
            (
                "the violent storm destroys weeks of construction in minutes",
                "der heftige Sturm zerstoert Wochen an Aufbauarbeit in Minuten",
            ),
            (
                "hail and wind at {wind_speed}km/h — casualties reported from flying debris",
                "Hagel und Wind bei {wind_speed}km/h — Verletzte durch umherfliegende Truemmer gemeldet",
            ),
            (
                "the worst storm since the founding — emergency protocols for all sectors",
                "der schlimmste Sturm seit der Gruendung — Notfallprotokolle fuer alle Sektoren",
            ),
            (
                "multiple lightning strikes ignite small fires — firefighting crews deployed",
                "mehrfache Blitzeinschlaege entzuenden kleine Braende — Loeschtrupps eingesetzt",
            ),
            (
                "the community endures — they have survived worse than weather",
                "die Gemeinschaft haelt durch — sie haben Schlimmeres als Wetter ueberlebt",
            ),
        ],
        "heat": [
            ("{temperature}°C — the cisterns evaporate visibly", "{temperature}°C — die Zisternen verdunsten sichtbar"),
            (
                "the heat is a physical weight on the shoulders of every worker",
                "die Hitze ist ein physisches Gewicht auf den Schultern jedes Arbeiters",
            ),
            (
                "at {temperature}°C, outdoor work is limited to dawn and dusk",
                "bei {temperature}°C ist Arbeit im Freien auf Morgen- und Abenddaemmerung beschraenkt",
            ),
            (
                "heat mirages make the horizon dance — false hope of water",
                "Hitzeflimmern laesst den Horizont tanzen — falsche Hoffnung auf Wasser",
            ),
            (
                "the heat cracks the earth and shortens tempers",
                "die Hitze laesst die Erde bersten und die Nerven kuerzer werden",
            ),
        ],
        "cold": [
            (
                "{temperature}°C — the fuel reserves are burning faster than planned",
                "{temperature}°C — die Treibstoffreserven verbrennen schneller als geplant",
            ),
            (
                "bitter cold at {temperature}°C drives everyone around the communal fires",
                "beissende Kaelte bei {temperature}°C treibt alle um die Gemeinschaftsfeuer",
            ),
            (
                "the cold kills the last of the autumn harvest — winter will be lean",
                "die Kaelte toetet den Rest der Herbsternte — der Winter wird mager",
            ),
            (
                "at {temperature}°C, water pipes freeze — the plumbers work through the night",
                "bei {temperature}°C frieren Wasserrohre ein — die Klempner arbeiten durch die Nacht",
            ),
            (
                "cold seeps through every wall — even the bunkers feel it",
                "Kaelte sickert durch jede Wand — selbst die Bunker spueren sie",
            ),
        ],
        "wind": [
            (
                "{wind_speed}km/h winds whip sand and dust through every crack",
                "{wind_speed}km/h Winde peitschen Sand und Staub durch jede Ritze",
            ),
            (
                "the wind carries the smell of the sea — salt and something chemical",
                "der Wind traegt den Geruch des Meeres — Salz und etwas Chemisches",
            ),
            (
                "at {wind_speed}km/h, the makeshift shelters strain against their anchors",
                "bei {wind_speed}km/h zerren die provisorischen Unterkuenfte an ihren Verankerungen",
            ),
            (
                "the hot wind from the south — the sirocco — parches everything it touches",
                "der heisse Wind aus dem Sueden — der Scirocco — doerrt alles aus, was er beruehrt",
            ),
            (
                "wind-blown debris rattles against the compound walls like thrown stones",
                "windgetriebene Truemmer rasseln gegen die Anlagenmauern wie geworfene Steine",
            ),
        ],
        "full_moon": [
            (
                "the full moon lights the wasteland like a floodlight — raiders will be visible",
                "der Vollmond beleuchtet das Oedland wie ein Flutlicht — Raeuber werden sichtbar sein",
            ),
            (
                "under the full moon, the ruins take on a haunting, silver beauty",
                "unter dem Vollmond nehmen die Ruinen eine gespenstische, silberne Schoenheit an",
            ),
            (
                "the full moon pulls at the tides — the salt marshes flood earlier than expected",
                "der Vollmond zieht an den Gezeiten — die Salzmarschen fluten frueher als erwartet",
            ),
            (
                "moonlight makes the night watch easier — but makes everyone a target",
                "Mondlicht macht die Nachtwache einfacher — aber macht jeden zur Zielscheibe",
            ),
            (
                "the old ones say the full moon makes people restless — tonight they seem right",
                "die Alten sagen, der Vollmond macht die Menschen ruhelos — heute Nacht scheinen sie recht zu haben",
            ),
        ],
        "new_moon": [
            (
                "no moon — the darkness is total beyond the campfires",
                "kein Mond — die Dunkelheit ist jenseits der Lagerfeuer absolut",
            ),
            (
                "the moonless night makes the sentries nervous — every sound magnified",
                "die mondlose Nacht macht die Wachen nervoes — jedes Geraeusch verstaerkt",
            ),
            (
                "in the new moon's darkness, the stars blaze with forgotten brilliance",
                "in der Dunkelheit des Neumondes brennen die Sterne mit vergessener Brillanz",
            ),
            (
                "without moonlight, the community retreats early — darkness saves fuel",
                "ohne Mondlicht zieht sich die Gemeinschaft frueh zurueck — Dunkelheit spart Treibstoff",
            ),
            (
                "a moonless night — ideal for those who scavenge in secret",
                "eine mondlose Nacht — ideal fuer jene, die heimlich Bergung betreiben",
            ),
        ],
    },
    # ── medieval (Cité des Dames) ─────────────────────────────────────────────
    "medieval": {
        "clear": [
            (
                "blue skies arch over the walls — a fine day for letters and learning",
                "blauer Himmel woelbt sich ueber die Mauern — ein feiner Tag fuer Schrift und Gelehrsamkeit",
            ),
            (
                "at {temperature}°C under clear skies, the gardens flourish",
                "bei {temperature}°C unter klarem Himmel gedeihen die Gaerten",
            ),
            (
                "the sun illuminates the manuscripts through tall windows",
                "die Sonne beleuchtet die Manuskripte durch hohe Fenster",
            ),
            (
                "clear weather draws scholars to the courtyards for open-air debate",
                "klares Wetter lockt Gelehrte in die Innenhoefen fuer Debatten unter freiem Himmel",
            ),
            (
                "the clarity of the sky mirrors the clarity of thought within the walls",
                "die Klarheit des Himmels spiegelt die Klarheit der Gedanken innerhalb der Mauern",
            ),
        ],
        "overcast": [
            (
                "grey clouds settle over the city like a scholar's hood",
                "graue Wolken legen sich ueber die Stadt wie eine Gelehrtenkapuze",
            ),
            (
                "the overcast sky drives scholars to their candles earlier",
                "der bewoelkte Himmel treibt Gelehrte frueher zu ihren Kerzen",
            ),
            (
                "a grey day at {temperature}°C — the walls seem to close in slightly",
                "ein grauer Tag bei {temperature}°C — die Mauern scheinen sich leicht zu schliessen",
            ),
            (
                "cloud cover softens the light — the illuminators prefer these conditions",
                "Wolkendecke daempft das Licht — die Buchmalerer bevorzugen diese Bedingungen",
            ),
            (
                "the overcast sky lends a contemplative mood to the quarter",
                "der bewoelkte Himmel verleiht dem Viertel eine besinnliche Stimmung",
            ),
        ],
        "fog": [
            (
                "fog wraps the towers in mystery — the bells ring muffled",
                "Nebel huellt die Tuerme in Mysterium — die Glocken laeuten gedaempft",
            ),
            (
                "the mist clings to the walls like whispered secrets",
                "der Nebel klammert sich an die Mauern wie gefluersterte Geheimnisse",
            ),
            (
                "visibility drops to {visibility}m — the market stalls emerge from fog like islands",
                "die Sicht sinkt auf {visibility}m — die Marktstaende tauchen aus dem Nebel auf wie Inseln",
            ),
            (
                "fog drifts through the cloisters, lending an otherworldly quality",
                "Nebel treibt durch die Kreuzgaenge und verleiht ihnen etwas Jenseitiges",
            ),
            (
                "the fog makes the city feel ancient — as if time itself has slowed",
                "der Nebel laesst die Stadt uralt erscheinen — als haette die Zeit selbst sich verlangsamt",
            ),
        ],
        "fog_dense": [
            (
                "the fog is so dense that even the cathedral spire vanishes",
                "der Nebel ist so dicht, dass selbst die Kathedralenspitze verschwindet",
            ),
            (
                "at {visibility}m visibility, the gate guards rely on sound alone",
                "bei {visibility}m Sicht verlassen sich die Torwaechter allein auf Gehoer",
            ),
            (
                "the thick fog traps cooking smoke — the air tastes of ash and herbs",
                "der dichte Nebel faengt Kochrauch ein — die Luft schmeckt nach Asche und Kraeutern",
            ),
            (
                "movement through the city becomes an act of faith — every step uncertain",
                "Bewegung durch die Stadt wird ein Akt des Glaubens — jeder Schritt unsicher",
            ),
            (
                "in this fog, the city could be anywhere — or nowhere at all",
                "in diesem Nebel koennte die Stadt ueberall sein — oder nirgendwo",
            ),
        ],
        "rain_light": [
            (
                "a gentle rain blesses the gardens and fills the fountains",
                "ein sanfter Regen segnet die Gaerten und fuellt die Brunnen",
            ),
            (
                "light rain at {temperature}°C darkens the cobblestones to slate",
                "leichter Regen bei {temperature}°C faerbt das Kopfsteinpflaster schiefergrau",
            ),
            (
                "{precipitation}mm of fine rain — the herbs in the cloister garden drink",
                "{precipitation}mm feiner Regen — die Kraeuter im Klostergarten trinken",
            ),
            (
                "drizzle beads on parchment left out to dry — the scribes rush to collect it",
                "Nieselregen perlt auf Pergament, das zum Trocknen ausliegt — die Schreiber eilen zum Einsammeln",
            ),
            (
                "the rain is gentle, like a mother's hand on the city's brow",
                "der Regen ist sanft, wie die Hand einer Mutter auf der Stirn der Stadt",
            ),
        ],
        "rain": [
            (
                "steady rain drums on tile roofs and fills the cisterns beneath",
                "stetiger Regen trommelt auf Ziegeldaecher und fuellt die Zisternen darunter",
            ),
            (
                "{precipitation}mm of rain turns the unpaved lanes to mud — scholars carry their hems",
                "{precipitation}mm Regen verwandelt die ungepflasterten Wege in Schlamm — Gelehrte raffen ihre Saeueme",
            ),
            (
                "rain drives the outdoor debates indoors — the halls echo with argument",
                "Regen treibt die Debatten im Freien nach drinnen — die Hallen hallen wider von Disputen",
            ),
            (
                "the rain feeds the vineyards beyond the walls — tomorrow's wine",
                "der Regen naehrt die Weinberge jenseits der Mauern — den Wein von morgen",
            ),
            (
                "rain streams down the stained glass, fracturing the light into rainbows",
                "Regen stroemt am Buntglas herunter und bricht das Licht in Regenbogen",
            ),
        ],
        "rain_freezing": [
            (
                "freezing rain at {temperature}°C coats the battlements in treacherous ice",
                "Eisregen bei {temperature}°C ueberzieht die Zinnen mit tueckischem Eis",
            ),
            (
                "ice glazes every stone surface — the city becomes a crystalline trap",
                "Eis glasiert jede Steinflaeche — die Stadt wird zu einer kristallinen Falle",
            ),
            (
                "the rain freezes on contact — even the gargoyles wear icy beards",
                "der Regen gefriert bei Beruehrung — selbst die Wasserspeier tragen eisige Baerte",
            ),
            (
                "at {temperature}°C, the ice makes the walls unclimbable — both defence and prison",
                "bei {temperature}°C macht das Eis die Mauern unkletterbar — Verteidigung und Gefaengnis zugleich",
            ),
            (
                "freezing rain silences the bells — ice fills the clappers",
                "Eisregen laesst die Glocken verstummen — Eis fuellt die Kloeppel",
            ),
        ],
        "storm": [
            (
                "the storm shakes the shutters and bends the garden trees",
                "der Sturm ruettelt an den Laeden und biegt die Gartenbaeume",
            ),
            (
                "{wind_speed}km/h winds with {precipitation}mm rain — the market empties",
                "{wind_speed}km/h Wind mit {precipitation}mm Regen — der Markt leert sich",
            ),
            (
                "the storm tests the ancient walls — they hold, as they always have",
                "der Sturm prueft die alten Mauern — sie halten, wie sie es immer getan haben",
            ),
            (
                "rain floods the lower courts — scholars rescue manuscripts from cellars",
                "Regen flutet die unteren Hoefe — Gelehrte retten Manuskripte aus Kellern",
            ),
            (
                "the fury of the storm matches the passion of the latest theological debate",
                "die Wut des Sturms entspricht der Leidenschaft der juengsten theologischen Debatte",
            ),
        ],
        "snow": [
            (
                "snow settles on the rooftops and turrets, softening every edge",
                "Schnee legt sich auf Daecher und Tuermchen und weicht jede Kante auf",
            ),
            (
                "at {temperature}°C, the city is transformed into a white jewel",
                "bei {temperature}°C verwandelt sich die Stadt in ein weisses Juwel",
            ),
            (
                "snow muffles every sound — the scriptorium has never been so quiet",
                "Schnee daempft jedes Geraeusch — das Skriptorium war noch nie so still",
            ),
            (
                "the first snow of the season brings scholars to the windows, pens forgotten",
                "der erste Schnee der Saison bringt Gelehrte an die Fenster, Federn vergessen",
            ),
            (
                "snow transforms the city into the illuminated margins of a manuscript",
                "Schnee verwandelt die Stadt in die illuminierten Raender eines Manuskripts",
            ),
        ],
        "storm_snow": [
            (
                "a blizzard howls around the walls — the fires burn high in every hall",
                "ein Schneesturm heult um die Mauern — die Feuer brennen hoch in jeder Halle",
            ),
            (
                "at {wind_speed}km/h with heavy snow, the gates are sealed",
                "bei {wind_speed}km/h mit starkem Schneefall werden die Tore versiegelt",
            ),
            (
                "the blizzard buries the lower doors — diggers work through the night",
                "der Schneesturm begraebt die unteren Tueren — Graeber arbeiten durch die Nacht",
            ),
            (
                "snow and wind isolate the city — messengers cannot depart",
                "Schnee und Wind isolieren die Stadt — Boten koennen nicht aufbrechen",
            ),
            (
                "the storm rages, but inside the walls, the work of the mind continues",
                "der Sturm tobt, aber innerhalb der Mauern geht die Arbeit des Geistes weiter",
            ),
        ],
        "thunderstorm": [
            (
                "thunder rolls over the walls — the night candles flicker in unison",
                "Donner rollt ueber die Mauern — die Nachtkerzen flackern im Gleichklang",
            ),
            (
                "lightning splits the sky — for an instant, every tower is a silhouette",
                "Blitze spalten den Himmel — fuer einen Augenblick ist jeder Turm eine Silhouette",
            ),
            (
                "the storm rattles the windows of the scriptorium — ink jars wobble",
                "der Sturm laesst die Fenster des Skriptoriums klirren — Tintenglaeser wackeln",
            ),
            (
                "rain and thunder drive even the bravest scholars from the courtyards",
                "Regen und Donner treiben selbst die mutigsten Gelehrten aus den Innenhoefen",
            ),
            (
                "thunder vibrates through the stone — the cathedral seems to breathe",
                "Donner vibriert durch den Stein — die Kathedrale scheint zu atmen",
            ),
        ],
        "thunderstorm_severe": [
            (
                "the violent storm tears tiles from rooftops and floods cellars",
                "der heftige Sturm reisst Ziegel von Daechern und flutet Keller",
            ),
            (
                "hail cracks against the stained glass — the artisans wince",
                "Hagel prasselt gegen das Buntglas — die Handwerker zucken zusammen",
            ),
            (
                "the worst storm in memory — prayers are offered in every chapel",
                "der schlimmste Sturm in Erinnerung — in jeder Kapelle werden Gebete gesprochen",
            ),
            (
                "lightning strikes the bell tower — the great bell rings unbidden",
                "Blitz trifft den Glockenturm — die grosse Glocke laeutet ungebeten",
            ),
            (
                "the storm is so violent that some whisper of divine displeasure",
                "der Sturm ist so heftig, dass manche von goettlichem Missfallen fluesstern",
            ),
        ],
        "heat": [
            (
                "at {temperature}°C, the stone walls radiate stored heat even after sunset",
                "bei {temperature}°C strahlen die Steinmauern gespeicherte Waerme noch nach Sonnenuntergang ab",
            ),
            (
                "the heat drives scholars to the coolest cellars — the wine is well-guarded",
                "die Hitze treibt Gelehrte in die kuehlsten Keller — der Wein ist gut bewacht",
            ),
            (
                "{temperature}°C — the herb gardens wilt, the fountains shrink",
                "{temperature}°C — die Kraeutergaerten welken, die Brunnen schrumpfen",
            ),
            (
                "heat shimmers above the cobblestones — the city feels like a kiln",
                "Hitzeflimmern ueber dem Kopfsteinpflaster — die Stadt fuehlt sich an wie ein Brennofen",
            ),
            (
                "the heat makes the ink dry too quickly — the scribes work in frustration",
                "die Hitze laesst die Tinte zu schnell trocknen — die Schreiber arbeiten frustriert",
            ),
        ],
        "cold": [
            (
                "at {temperature}°C, the ink freezes in the wells — writing is impossible",
                "bei {temperature}°C gefriert die Tinte in den Naepfen — Schreiben ist unmoeglich",
            ),
            (
                "bitter cold grips the city — the fires consume wood faster than it can be gathered",
                "beissende Kaelte umklammert die Stadt — die Feuer verbrauchen Holz schneller als es gesammelt werden kann",
            ),
            (
                "the cold drives scholars to huddle together — body heat and debate sustain them",
                "die Kaelte treibt Gelehrte zum Zusammenruecken — Koerperwaerme und Debatten erhalten sie",
            ),
            (
                "{temperature}°C — the well freezes solid, water must be melted from snow",
                "{temperature}°C — der Brunnen gefriert fest, Wasser muss aus Schnee geschmolzen werden",
            ),
            (
                "cold seeps through every wall — only the forge and the kitchen are warm",
                "Kaelte sickert durch jede Wand — nur die Schmiede und die Kueche sind warm",
            ),
        ],
        "wind": [
            (
                "the Tramontane blows at {wind_speed}km/h — a familiar tormentor",
                "die Tramontane blaest mit {wind_speed}km/h — ein vertrauter Peiniger",
            ),
            (
                "{wind_speed}km/h winds whip through the streets, snatching at cloaks and manuscripts",
                "{wind_speed}km/h Winde peitschen durch die Strassen und greifen nach Umhaengen und Manuskripten",
            ),
            (
                "the wind howls through the battlements like a choir of ghosts",
                "der Wind heult durch die Zinnen wie ein Chor aus Geistern",
            ),
            (
                "at {wind_speed}km/h, the market awnings tear — vendors scramble",
                "bei {wind_speed}km/h reissen die Marktvordaecher — Haendler hasten",
            ),
            (
                "the cold wind from the north carries the smell of pine and distant snow",
                "der kalte Wind aus dem Norden traegt den Duft von Kiefern und fernem Schnee",
            ),
        ],
        "full_moon": [
            (
                "the full moon bathes the city in silver light — the night scholars read by it",
                "der Vollmond badet die Stadt in Silberlicht — die Nachtgelehrten lesen bei ihm",
            ),
            (
                "under the full moon, the gargoyles cast long, expressive shadows",
                "unter dem Vollmond werfen die Wasserspeier lange, ausdrucksvolle Schatten",
            ),
            (
                "the full moon turns the cathedral rose window into a disk of light",
                "der Vollmond verwandelt das Rosenfenster der Kathedrale in eine Lichtscheibe",
            ),
            (
                "moonlight floods the courtyards — the city is luminous and dreamlike",
                "Mondlicht flutet die Innenhoefen — die Stadt ist leuchtend und traumhaft",
            ),
            (
                "the full moon — some say it sharpens the mind, others say it scatters it",
                "der Vollmond — manche sagen, er schaerft den Verstand, andere sagen, er zerstreut ihn",
            ),
        ],
        "new_moon": [
            (
                "no moon — the city retreats behind closed doors and candlelight",
                "kein Mond — die Stadt zieht sich hinter geschlossene Tueren und Kerzenlicht zurueck",
            ),
            (
                "the moonless night makes the walls feel higher and the world smaller",
                "die mondlose Nacht laesst die Mauern hoeher und die Welt kleiner wirken",
            ),
            (
                "without moonlight, the only glow comes from the scriptorium's windows",
                "ohne Mondlicht kommt der einzige Schein von den Fenstern des Skriptoriums",
            ),
            (
                "a dark night — the astronomers turn their instruments to the deepest stars",
                "eine dunkle Nacht — die Astronomen richten ihre Instrumente auf die tiefsten Sterne",
            ),
            (
                "the new moon brings a hush — even the dogs sleep quietly",
                "der Neumond bringt eine Stille — selbst die Hunde schlafen ruhig",
            ),
        ],
    },
}

# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 3: THEME-SPECIFIC CONSEQUENCES
# What the weather means for the world. Selected by AmbientCategory + theme.
# ═══════════════════════════════════════════════════════════════════════════════

CONSEQUENCES: dict[str, dict[str, list[T]]] = {
    # ── spy-thriller ──────────────────────────────────────────────────────────
    "spy-thriller": {
        "clear": [
            ("Surveillance teams report optimal visibility.", "Ueberwachungsteams melden optimale Sicht."),
            (
                "The Bureau's aerial reconnaissance operates at full capacity.",
                "Die Luftaufklaerung des Bureaus arbeitet mit voller Kapazitaet.",
            ),
            (
                "No cover for clandestine operations — dead drops postponed.",
                "Keine Deckung fuer verdeckte Operationen — tote Briefkaesten verschoben.",
            ),
            ("Every rooftop vantage point is in use.", "Jeder Dachaussichtspunkt ist in Nutzung."),
            ("Field agents report feeling exposed.", "Feldagenten berichten von einem Gefuehl der Entbloessung."),
        ],
        "overcast": [
            (
                "The grey sky makes identification at distance unreliable.",
                "Der graue Himmel macht Identifikation auf Distanz unzuverlaessig.",
            ),
            (
                "Mood in the government quarter reflects the sky.",
                "Die Stimmung im Regierungsviertel spiegelt den Himmel.",
            ),
            ("Routine patrols continue without incident.", "Routinepatrouillen verlaufen ohne Vorkommnisse."),
            ("The overcast conditions favour neither side.", "Die bewoelkten Bedingungen bevorzugen keine Seite."),
            ("Operations proceed at standard tempo.", "Operationen verlaufen im Standardtempo."),
        ],
        "fog": [
            (
                "Surveillance teams report compromised sightlines.",
                "Ueberwachungsteams melden eingeschraenkte Sichtlinien.",
            ),
            (
                "Dead drops go unchecked — too risky to approach.",
                "Tote Briefkaesten bleiben unberuehrt — zu riskant, sich zu naehern.",
            ),
            ("The Bureau extends curfew by two hours.", "Das Bureau verlaengert die Ausgangssperre um zwei Stunden."),
            (
                "Field agents exploit the cover for clandestine meetings.",
                "Feldagenten nutzen die Deckung fuer geheime Treffen.",
            ),
            (
                "Radio frequencies carry strange echoes in this weather.",
                "Funkfrequenzen tragen seltsame Echos bei diesem Wetter.",
            ),
            (
                "Informant networks report increased covert activity.",
                "Informantennetzwerke melden erhoehte verdeckte Aktivitaet.",
            ),
            (
                "The fog provides the perfect cover for defections.",
                "Der Nebel bietet die perfekte Deckung fuer Ueberlaeufer.",
            ),
        ],
        "fog_dense": [
            (
                "All surveillance operations suspended until conditions improve.",
                "Alle Ueberwachungsoperationen ausgesetzt bis zur Besserung der Bedingungen.",
            ),
            (
                "The Bureau issues an all-hands alert — visibility is zero.",
                "Das Bureau gibt Vollalarm — Sicht ist null.",
            ),
            ("Emergency communication protocols activated.", "Notfallkommunikationsprotokolle aktiviert."),
            ("Agents navigate by memory and touch alone.", "Agenten navigieren nur noch aus Gedaechtnis und Tastsinn."),
            (
                "Border checkpoints effectively blind — anyone could pass.",
                "Grenzcheckpoints praktisch blind — jeder koennte passieren.",
            ),
        ],
        "rain_light": [
            (
                "The drizzle provides useful noise cover for conversations.",
                "Der Nieselregen bietet nuetzliche Laermabdeckung fuer Gespraeche.",
            ),
            (
                "Foot traffic thins — surveillance targets are easier to isolate.",
                "Fussgaengerverkehr nimmt ab — Ueberwachungsziele sind leichter zu isolieren.",
            ),
            ("Umbrellas make facial identification harder.", "Regenschirme erschweren die Gesichtserkennung."),
            (
                "Routine operations continue with minor adjustments.",
                "Routineoperationen laufen mit geringen Anpassungen weiter.",
            ),
            (
                "The rain dampens spirits but not alertness.",
                "Der Regen daempft die Stimmung, aber nicht die Wachsamkeit.",
            ),
        ],
        "rain": [
            (
                "Street-level operations suspended — too few civilians for cover.",
                "Strassenoperationen ausgesetzt — zu wenige Zivilisten fuer Deckung.",
            ),
            ("The rain washes evidence from crime scenes.", "Der Regen waescht Beweise von Tatorten."),
            (
                "Informant meetings cancelled — too conspicuous in empty streets.",
                "Informantentreffen abgesagt — zu auffaellig in leeren Strassen.",
            ),
            (
                "The Bureau's outdoor listening posts are flooded.",
                "Die Aussenabhoerposten des Bureaus sind ueberflutet.",
            ),
            (
                "Rain creates white noise — electronic surveillance compromised.",
                "Regen erzeugt weisses Rauschen — elektronische Ueberwachung beeintraechtigt.",
            ),
        ],
        "rain_freezing": [
            (
                "Vehicle pursuit impossible — every road is a skating rink.",
                "Fahrzeugverfolgung unmoeglich — jede Strasse ist eine Eisbahn.",
            ),
            ("The ice grounds all rooftop observation teams.", "Das Eis legt alle Dachbeobachtungsteams lahm."),
            ("Emergency medical teams on standby for falls.", "Notarztteams in Bereitschaft fuer Sturzverletzte."),
            (
                "Infrastructure damage from ice accumulation reported.",
                "Infrastrukturschaeden durch Eisanlagerung gemeldet.",
            ),
            ("Communications cables sag under ice weight.", "Kommunikationskabel haengen unter Eisgewicht durch."),
        ],
        "storm": [
            ("All non-essential operations cancelled.", "Alle nicht-essentiellen Operationen abgesagt."),
            (
                "The storm provides cover for high-risk extractions.",
                "Der Sturm bietet Deckung fuer Hochrisiko-Extraktionen.",
            ),
            ("Power outages reported in several sectors.", "Stromausfaelle in mehreren Sektoren gemeldet."),
            (
                "The Bureau's emergency generators activate automatically.",
                "Die Notgeneratoren des Bureaus aktivieren sich automatisch.",
            ),
            (
                "Street cameras offline — the city is temporarily unwatched.",
                "Strassenkameras offline — die Stadt ist voruebergehend unbeobachtet.",
            ),
        ],
        "snow": [
            (
                "Fresh snow reveals every footprint — tracking becomes trivial.",
                "Frischer Schnee zeigt jeden Fussabdruck — Verfolgung wird trivial.",
            ),
            (
                "Agents change boots frequently to avoid pattern matching.",
                "Agenten wechseln haeufig Stiefel, um Mustererkennung zu vermeiden.",
            ),
            (
                "The white landscape makes dark clothing conspicuous.",
                "Die weisse Landschaft macht dunkle Kleidung auffaellig.",
            ),
            (
                "Snow muffles sound — conversational distance shrinks to whispers.",
                "Schnee daempft Geraeusche — Gespraechsdistanz schrumpft auf Fluestern.",
            ),
            (
                "The beauty of the snowfall belies the danger beneath.",
                "Die Schoenheit des Schneefalls tauescht ueber die Gefahr darunter hinweg.",
            ),
        ],
        "storm_snow": [
            (
                "The blizzard shuts down the entire surveillance apparatus.",
                "Der Schneesturm legt den gesamten Ueberwachungsapparat lahm.",
            ),
            (
                "Emergency shelters opened — population tracking impossible.",
                "Notunterkuenfte geoeffnet — Bevoelkerungsverfolgung unmoeglich.",
            ),
            ("The Bureau declares a weather emergency.", "Das Bureau erklaert einen Wetternotstand."),
            (
                "All agents recalled — exposure risk too high.",
                "Alle Agenten zurueckgerufen — Expositionsrisiko zu hoch.",
            ),
            ("Communications reduced to hardline only.", "Kommunikation auf Festnetz reduziert."),
        ],
        "thunderstorm": [
            (
                "Power fluctuations disrupt electronic surveillance.",
                "Stromschwankungen stoeren elektronische Ueberwachung.",
            ),
            ("Lightning strikes damage rooftop antenna arrays.", "Blitzeinschlaege beschaedigen Dach-Antennenarrays."),
            (
                "The chaos of the storm provides cover for emergency operations.",
                "Das Chaos des Sturms bietet Deckung fuer Notoperationen.",
            ),
            (
                "Thunder masks gunshots — the Bureau increases patrols.",
                "Donner maskiert Schuesse — das Bureau verstaerkt Patrouillen.",
            ),
            ("Emergency protocols activated across all sectors.", "Notfallprotokolle in allen Sektoren aktiviert."),
        ],
        "thunderstorm_severe": [
            ("The Bureau activates full emergency protocols.", "Das Bureau aktiviert volle Notfallprotokolle."),
            (
                "All non-military personnel ordered to shelter.",
                "Alles nicht-militaerisches Personal in Schutzraeume beordert.",
            ),
            ("Infrastructure damage assessment teams deployed.", "Infrastruktur-Schadensbewertungsteams eingesetzt."),
            (
                "The storm erases weeks of carefully placed surveillance.",
                "Der Sturm loescht Wochen sorgfaeltig platzierter Ueberwachung.",
            ),
            ("Civil defence sirens blend with the thunder.", "Zivilschutzsirenen vermischen sich mit dem Donner."),
        ],
        "heat": [
            ("Heat-related illness reports increase.", "Berichte ueber hitzebedingte Erkrankungen nehmen zu."),
            (
                "The Bureau shortens outdoor shifts to prevent collapse.",
                "Das Bureau verkuerzt Aussenschichten, um Zusammenbrueche zu verhindern.",
            ),
            ("Tempers flare — incident reports spike.", "Nerven liegen blank — Vorfallsberichte steigen sprunghaft."),
            ("The heat makes everyone irritable and careless.", "Die Hitze macht alle reizbar und unvorsichtig."),
            (
                "Water distribution points become surveillance opportunities.",
                "Wasserverteilungsstellen werden zu Ueberwachungsmoeglichkeiten.",
            ),
        ],
        "cold": [
            (
                "Agents huddle in doorways, breath crystallizing.",
                "Agenten draengen sich in Eingaengen, ihr Atem kristallisiert.",
            ),
            (
                "The cold drives informants to heated meeting points — predictable.",
                "Die Kaelte treibt Informanten zu beheizten Treffpunkten — vorhersehbar.",
            ),
            (
                "Heating costs strain the Bureau's operational budget.",
                "Heizkosten belasten das Operationsbudget des Bureaus.",
            ),
            ("Frostbite reports from field agents increase.", "Erfrierungsberichte von Feldagenten nehmen zu."),
            (
                "The cold makes everyone move faster — less time for observation.",
                "Die Kaelte laesst alle schneller gehen — weniger Zeit fuer Beobachtung.",
            ),
        ],
        "wind": [
            ("Directional microphones rendered useless.", "Richtmikrofone unbrauchbar gemacht."),
            (
                "The wind carries fragments of conversation to unexpected ears.",
                "Der Wind traegt Gespraechsfragmente zu unerwarteten Ohren.",
            ),
            ("Loose documents become a security risk.", "Lose Dokumente werden zu einem Sicherheitsrisiko."),
            (
                "Outdoor meetings impossible — wind drowns all speech.",
                "Aussenstehende Treffen unmoeglich — Wind uebertont jede Rede.",
            ),
            (
                "The wind tests every lock and latch in the district.",
                "Der Wind prueft jedes Schloss und jeden Riegel im Viertel.",
            ),
        ],
        "full_moon": [
            (
                "The night shift reports unusual civilian activity.",
                "Die Nachtschicht meldet ungewoehnliche zivile Aktivitaet.",
            ),
            (
                "Moonlit nights favour observation but hinder infiltration.",
                "Mondbeleuchtete Naechte beguenstigen Beobachtung, behindern aber Infiltration.",
            ),
            (
                "The Bureau notes a statistical correlation with security incidents.",
                "Das Bureau vermerkt eine statistische Korrelation mit Sicherheitsvorfaellen.",
            ),
            (
                "Enhanced perimeter patrols ordered for the lunar maximum.",
                "Verstaerkte Perimeterpatrouillen fuer das Lunarmaximum angeordnet.",
            ),
            (
                "The old agents say full moons bring confessions and betrayals.",
                "Die alten Agenten sagen, Vollmonde bringen Gestaendnisse und Verrat.",
            ),
        ],
        "new_moon": [
            (
                "Optimal conditions for covert movement — the Bureau is on alert.",
                "Optimale Bedingungen fuer verdeckte Bewegung — das Bureau ist alarmiert.",
            ),
            (
                "The darkness provides cover for extraction operations.",
                "Die Dunkelheit bietet Deckung fuer Extraktionsoperationen.",
            ),
            ("Night vision equipment deployed to all posts.", "Nachtsichtgeraete an allen Posten eingesetzt."),
            (
                "The moonless night favours those who know the routes.",
                "Die mondlose Nacht beguenstigt jene, die die Routen kennen.",
            ),
            ("A quiet night — almost suspiciously so.", "Eine ruhige Nacht — fast verdaechtig ruhig."),
        ],
    },
    # ── scifi ─────────────────────────────────────────────────────────────────
    "scifi": {
        "clear": [
            (
                "Sensor calibration window — all external instruments recalibrated.",
                "Sensorkalibrierungsfenster — alle externen Instrumente rekalibriert.",
            ),
            (
                "Research teams request extended observation time.",
                "Forschungsteams beantragen verlaengerte Beobachtungszeit.",
            ),
            ("Solar panel output at maximum efficiency.", "Solarpanel-Leistung bei maximaler Effizienz."),
            (
                "Hull inspection teams deployed during optimal conditions.",
                "Rumpfinspektionsteams bei optimalen Bedingungen eingesetzt.",
            ),
            (
                "HAVEN logs conditions as 'baseline nominal' — a rare entry.",
                "HAVEN protokolliert Bedingungen als 'Basis nominal' — ein seltener Eintrag.",
            ),
        ],
        "overcast": [
            (
                "Solar generation drops 23% — compensating with reserve.",
                "Solarerzeugung sinkt um 23% — Ausgleich durch Reserve.",
            ),
            (
                "Crew mood dips slightly — seasonal affective countermeasures activated.",
                "Crew-Stimmung sinkt leicht — saisonale Gegenmassnahmen aktiviert.",
            ),
            (
                "Grey conditions logged — no operational impact.",
                "Graue Bedingungen protokolliert — kein operationeller Einfluss.",
            ),
            ("The perpetual grey tests crew morale.", "Das dauerhafte Grau testet die Crew-Moral."),
            (
                "Atmospheric analysis detects nothing unusual.",
                "Atmosphaerische Analyse erkennt nichts Ungewoehnliches.",
            ),
        ],
        "fog": [
            (
                "External optical sensors switched to radar/sonar backup.",
                "Externe optische Sensoren auf Radar/Sonar-Backup umgeschaltet.",
            ),
            (
                "Docking operations postponed until visibility improves.",
                "Andockoperationen verschoben bis zur Sichtverbesserung.",
            ),
            ("Maintenance drones recalled to bays.", "Wartungsdrohnen in die Hangars zurueckgerufen."),
            (
                "The fog triggers an old protocol — crew speculates about its origin.",
                "Der Nebel loest ein altes Protokoll aus — die Crew spekuliert ueber seinen Ursprung.",
            ),
            (
                "Navigation relies entirely on inertial guidance.",
                "Navigation verlaesst sich vollstaendig auf Traegheitsnavigation.",
            ),
        ],
        "fog_dense": [
            ("Station command elevates alert status to yellow.", "Stationskommando erhoeht Alarmstufe auf Gelb."),
            ("All EVA operations cancelled indefinitely.", "Alle EVA-Operationen auf unbestimmte Zeit abgesagt."),
            (
                "The crew reports an eerie silence — even hull noises are absorbed.",
                "Die Crew meldet eine unheimliche Stille — selbst Rumpfgeraeusche werden absorbiert.",
            ),
            ("Emergency beacon activated as precaution.", "Notfallbake als Vorsichtsmassnahme aktiviert."),
            (
                "Dr. Tanaka requests samples of the atmospheric anomaly.",
                "Dr. Tanaka beantragt Proben der atmosphaerischen Anomalie.",
            ),
        ],
        "rain_light": [
            (
                "Minor moisture event — standard protocols sufficient.",
                "Geringfuegiges Feuchtigkeitsereignis — Standardprotokolle ausreichend.",
            ),
            (
                "External sensor cleaning scheduled during precipitation.",
                "Externe Sensorreinigung waehrend Niederschlag eingeplant.",
            ),
            (
                "The sound of rain on the hull has a calming effect on crew.",
                "Das Geraeusch von Regen auf dem Rumpf hat eine beruhigende Wirkung auf die Crew.",
            ),
            ("Humidity readings within operational parameters.", "Feuchtigkeitswerte innerhalb der Betriebsparameter."),
            (
                "Atmospheric sampling during light precipitation yields useful data.",
                "Atmosphaerische Probenahme bei leichtem Niederschlag liefert nuetzliche Daten.",
            ),
        ],
        "rain": [
            (
                "Environmental systems compensate for increased external humidity.",
                "Umweltsysteme kompensieren erhoehte aeussere Luftfeuchtigkeit.",
            ),
            (
                "The rhythmic drumming on the hull becomes the station's heartbeat.",
                "Das rhythmische Trommeln auf dem Rumpf wird zum Herzschlag der Station.",
            ),
            (
                "Drainage protocols activated — no flooding risk.",
                "Abflussprotokolle aktiviert — kein Ueberflutungsrisiko.",
            ),
            (
                "External maintenance postponed until conditions improve.",
                "Externe Wartung bis zur Besserung der Bedingungen verschoben.",
            ),
            (
                "Crew gathers at observation ports to watch the rain.",
                "Crew versammelt sich an Beobachtungsluken, um den Regen zu beobachten.",
            ),
        ],
        "rain_freezing": [
            (
                "Hull stress sensors trigger automated monitoring.",
                "Rumpf-Stresssensoren loesen automatische Ueberwachung aus.",
            ),
            (
                "De-icing systems consume 340% normal power.",
                "Enteisungssysteme verbrauchen 340% der normalen Leistung.",
            ),
            (
                "Critical systems rerouted from ice-affected sections.",
                "Kritische Systeme von eisbetroffenen Sektionen umgeleitet.",
            ),
            (
                "Engineering crew on high alert — ice damage is structural.",
                "Technik-Crew in Alarmbereitschaft — Eisschaeden sind strukturell.",
            ),
            ("HAVEN recommends retreat to inner sections.", "HAVEN empfiehlt Rueckzug in innere Sektionen."),
        ],
        "storm": [
            (
                "Structural dampeners at 78% capacity — station holds steady.",
                "Strukturdaempfer bei 78% Kapazitaet — Station haelt stabil.",
            ),
            ("All loose equipment secured per storm protocol.", "Alle losen Geraete gemaess Sturmprotokoll gesichert."),
            (
                "Communications intermittent — relay through backup antenna.",
                "Kommunikation intermittierend — Umleitung ueber Backup-Antenne.",
            ),
            (
                "The storm provides an opportunity to test hull resilience.",
                "Der Sturm bietet eine Gelegenheit, die Rumpfresistenz zu testen.",
            ),
            (
                "Crew morale drops during extended atmospheric assault.",
                "Crew-Moral sinkt waehrend anhaltendem atmosphaerischem Ansturm.",
            ),
        ],
        "snow": [
            ("Solar panel de-icing cycle initiated.", "Solarpanel-Enteisungszyklus gestartet."),
            (
                "The observation deck reports a stunning snowscape.",
                "Das Observierungsdeck meldet eine atemberaubende Schneelandschaft.",
            ),
            (
                "Crew requests permission for 'snowfall observation break'.",
                "Crew beantragt Erlaubnis fuer 'Schneefall-Beobachtungspause'.",
            ),
            (
                "External temperatures stable — no structural concern.",
                "Aussentemperaturen stabil — kein strukturelles Bedenken.",
            ),
            (
                "The snow deadens all external acoustic data — eerie silence.",
                "Der Schnee daempft alle externen akustischen Daten — unheimliche Stille.",
            ),
        ],
        "storm_snow": [
            (
                "Full station lockdown — all external access sealed.",
                "Volle Stationssperre — jeder externe Zugang versiegelt.",
            ),
            (
                "Power reserves activated — solar generation at 4%.",
                "Energiereserven aktiviert — Solarerzeugung bei 4%.",
            ),
            (
                "Structural integrity warnings from exposed sections.",
                "Strukturelle Integritaetswarnungen von exponierten Sektionen.",
            ),
            ("The blizzard isolates the station completely.", "Der Schneesturm isoliert die Station vollstaendig."),
            ("Commander Vasquez orders conservation mode.", "Commander Vasquez ordnet Konservierungsmodus an."),
        ],
        "thunderstorm": [
            (
                "Faraday protections hold — internal systems unaffected.",
                "Faraday-Schutz haelt — interne Systeme nicht betroffen.",
            ),
            (
                "Lightning data collected for atmospheric research.",
                "Blitzdaten fuer atmosphaerische Forschung gesammelt.",
            ),
            (
                "Power grid fluctuations — non-essential systems cycle.",
                "Stromnetz-Schwankungen — nicht-essentielle Systeme schalten zyklisch.",
            ),
            (
                "The electromagnetic energy excites the quantum sensors.",
                "Die elektromagnetische Energie erregt die Quantensensoren.",
            ),
            (
                "Engineering reports nominal — all systems within tolerance.",
                "Technik meldet nominal — alle Systeme innerhalb der Toleranz.",
            ),
        ],
        "thunderstorm_severe": [
            ("Station command declares condition red.", "Stationskommando erklaert Zustand Rot."),
            ("All non-essential crew to secure positions.", "Alle nicht-essentielle Crew auf sichere Positionen."),
            (
                "Hull breach risk elevated — damage control teams standby.",
                "Rumpfbruchrisiko erhoeht — Schadensbegrenzungsteams in Bereitschaft.",
            ),
            (
                "Communications lost — station on internal protocols only.",
                "Kommunikation verloren — Station nur auf internen Protokollen.",
            ),
            (
                "The crew endures — as they have endured everything.",
                "Die Crew haelt durch — wie sie alles durchgehalten hat.",
            ),
        ],
        "heat": [
            ("Cooling system redistribution in progress.", "Kuehlsystem-Umverteilung im Gange."),
            ("Heat-sensitive experiments paused.", "Waermeempfindliche Experimente pausiert."),
            ("Crew advised to increase fluid intake.", "Crew wird zu erhoehter Fluessigkeitsaufnahme geraten."),
            (
                "Thermal gradients create convection currents in corridors.",
                "Thermische Gradienten erzeugen Konvektionsstroemungen in Korridoren.",
            ),
            (
                "Energy consumption for cooling exceeds heating baseline.",
                "Energieverbrauch fuer Kuehlung uebersteigt Heizungsbaseline.",
            ),
        ],
        "cold": [
            (
                "Heating systems compensate — interior temperature maintained.",
                "Heizsysteme kompensieren — Innentemperatur gehalten.",
            ),
            (
                "Peripheral corridors lose 2°C — crew avoids them.",
                "Periphere Korridore verlieren 2°C — Crew meidet sie.",
            ),
            ("Hot beverage dispensers report record usage.", "Heissgetraenkeautomaten melden Rekordnutzung."),
            (
                "The cold reminds the crew how fragile their environment is.",
                "Die Kaelte erinnert die Crew daran, wie fragil ihre Umgebung ist.",
            ),
            (
                "Engineering monitors hull contraction at critical joints.",
                "Technik ueberwacht Rumpfkontraktion an kritischen Verbindungen.",
            ),
        ],
        "wind": [
            ("Antenna array realignment in progress.", "Antennenarray-Neuausrichtung im Gange."),
            (
                "The wind generates a low-frequency hum through the hull.",
                "Der Wind erzeugt ein tieffrequentes Summen durch den Rumpf.",
            ),
            (
                "Crew reports motion sickness in exposed sections.",
                "Crew meldet Bewegungskrankheit in exponierten Sektionen.",
            ),
            (
                "Structural monitors log elevated vibration levels.",
                "Strukturmonitore protokollieren erhoehte Vibrationswerte.",
            ),
            (
                "Wind load analysis completed — within design parameters.",
                "Windlastanalyse abgeschlossen — innerhalb der Designparameter.",
            ),
        ],
        "full_moon": [
            ("Lunar illumination enables visual hull survey.", "Mondbeleuchtung ermoeglicht visuelle Rumpfuebersicht."),
            (
                "Tidal effects measurable in fluid storage tanks.",
                "Gezeiteneffekte in Fluessigkeitsspeichertanks messbar.",
            ),
            ("Crew sleep data shows increased restlessness.", "Crew-Schlafdaten zeigen erhoehte Unruhe."),
            (
                "The full moon triggers reflection among the crew.",
                "Der Vollmond loest Nachdenklichkeit unter der Crew aus.",
            ),
            (
                "Gravitational microvariations logged for research.",
                "Gravitationelle Mikrovariationen fuer Forschung protokolliert.",
            ),
        ],
        "new_moon": [
            ("Star observation window — telescopes deployed.", "Sternbeobachtungsfenster — Teleskope eingesetzt."),
            (
                "Darkness protocols activated — all exterior lights dimmed.",
                "Dunkelheitsprotokolle aktiviert — alle Aussenlichter gedimmt.",
            ),
            (
                "The absence of moonlight calms the crew — sleep quality improves.",
                "Das Fehlen von Mondlicht beruhigt die Crew — Schlafqualitaet verbessert sich.",
            ),
            (
                "Navigation fully on instruments — baseline conditions.",
                "Navigation vollstaendig auf Instrumenten — Basisbedingungen.",
            ),
            (
                "The dark sky reveals Earth's aurora in vivid detail.",
                "Der dunkle Himmel enthuellt das Polarlicht in lebhaften Details.",
            ),
        ],
    },
    # ── biopunk ───────────────────────────────────────────────────────────────
    "biopunk": {
        "clear": [
            ("The colony reaches peak photosynthetic output.", "Die Kolonie erreicht maximale Photosynthese-Leistung."),
            (
                "Upper-level organisms unfurl their fullest fronds.",
                "Organismen der oberen Ebene entfalten ihre groessten Wedel.",
            ),
            (
                "Clear conditions trigger a burst of reproductive activity.",
                "Klare Bedingungen loesen einen Schub reproduktiver Aktivitaet aus.",
            ),
            (
                "The living architecture seems to sigh with contentment.",
                "Die lebende Architektur scheint vor Zufriedenheit zu seufzen.",
            ),
            (
                "Nutrient flow through the mycelial network reaches maximum.",
                "Naehrstofffluss durch das Myzelnetzwerk erreicht Maximum.",
            ),
        ],
        "overcast": [
            (
                "The colony shifts to secondary metabolic pathways.",
                "Die Kolonie wechselt auf sekundaere Stoffwechselwege.",
            ),
            (
                "Bioluminescence increases to compensate for reduced light.",
                "Biolumineszenz nimmt zu, um reduziertes Licht zu kompensieren.",
            ),
            (
                "The organisms slow slightly but remain healthy.",
                "Die Organismen verlangsamen sich leicht, bleiben aber gesund.",
            ),
            ("Fungal growth accelerates in the reduced UV.", "Pilzwachstum beschleunigt sich bei reduziertem UV."),
            (
                "The colony enters a contemplative metabolism.",
                "Die Kolonie tritt in einen kontemplativen Stoffwechsel ein.",
            ),
        ],
        "fog": [
            (
                "The fog feeds the colony's moisture-dependent outer layer.",
                "Der Nebel naehrt die feuchtigkeitsabhaengige Aussenschicht der Kolonie.",
            ),
            ("Spore dispersal is enhanced by the thick air.", "Sporenverteilung wird durch die dicke Luft verstaerkt."),
            (
                "The mycelial network increases chemical communication.",
                "Das Myzelnetzwerk verstaerkt chemische Kommunikation.",
            ),
            (
                "Navigation markers pulse brighter in response.",
                "Navigationsmarkierungen pulsieren als Reaktion heller.",
            ),
            (
                "The colony absorbs moisture directly from the air.",
                "Die Kolonie absorbiert Feuchtigkeit direkt aus der Luft.",
            ),
        ],
        "fog_dense": [
            (
                "Emergency bioluminescent beacons activate colony-wide.",
                "Notfall-Biolumineszenz-Baken aktivieren sich kolonieweit.",
            ),
            (
                "The colony's immune response heightens — pathogen risk in dense fog.",
                "Die Immunantwort der Kolonie steigt — Pathogenrisiko im dichten Nebel.",
            ),
            ("All external expeditions recalled.", "Alle externen Expeditionen zurueckgerufen."),
            (
                "The fog is so thick the colony treats it as a liquid event.",
                "Der Nebel ist so dicht, dass die Kolonie ihn als Fluessigkeitsereignis behandelt.",
            ),
            ("Respiratory distress increases among surface dwellers.", "Atemnot nimmt unter Oberflaechenbewohnern zu."),
        ],
        "rain_light": [
            ("The rain triggers flowering in the wall organisms.", "Der Regen loest Bluete in den Wandorganismen aus."),
            ("Moisture collection systems fill steadily.", "Feuchtigkeitssammlungssysteme fuellen sich stetig."),
            (
                "The living walls absorb the rain like a sponge.",
                "Die lebenden Waende saugen den Regen auf wie ein Schwamm.",
            ),
            ("Growth hormones circulate through the colony.", "Wachstumshormone zirkulieren durch die Kolonie."),
            ("The air smells of new growth and wet earth.", "Die Luft riecht nach neuem Wachstum und feuchter Erde."),
        ],
        "rain": [
            (
                "The colony enters accelerated growth phase.",
                "Die Kolonie tritt in die beschleunigte Wachstumsphase ein.",
            ),
            (
                "Excess water is stored in the colony's bladder organs.",
                "Ueberschuessiges Wasser wird in den Blasenorganen der Kolonie gespeichert.",
            ),
            (
                "The drumming of rain stimulates the colony's neural network.",
                "Das Trommeln des Regens stimuliert das Neuronennetzwerk der Kolonie.",
            ),
            (
                "Fungi bloom in response to the sustained moisture.",
                "Pilze bluehen als Reaktion auf die anhaltende Feuchtigkeit.",
            ),
            ("The living architecture flexes and drinks.", "Die lebende Architektur biegt sich und trinkt."),
        ],
        "rain_freezing": [
            (
                "Anti-freeze proteins surge through the colony's circulatory system.",
                "Frostschutzproteine ueberfluten das Kreislaufsystem der Kolonie.",
            ),
            (
                "The outer membrane hardens to protect against ice damage.",
                "Die Aussenmembran haertet, um vor Eisschaeden zu schuetzen.",
            ),
            (
                "Vulnerable organisms retreat to the warm interior.",
                "Verletzliche Organismen ziehen sich ins warme Innere zurueck.",
            ),
            (
                "The colony's metabolism slows to conservation mode.",
                "Der Stoffwechsel der Kolonie verlangsamt sich in den Konservierungsmodus.",
            ),
            (
                "Ice crystals on the fronds create a dangerous beauty.",
                "Eiskristalle auf den Wedeln erzeugen eine gefaehrliche Schoenheit.",
            ),
        ],
        "storm": [
            (
                "The colony's stress-response pheromones flood the passages.",
                "Die Stresspheromone der Kolonie fluten die Gaenge.",
            ),
            (
                "Repair organisms deploy to storm-damaged sections.",
                "Reparaturorganismen setzen sich in sturmgeschaedigten Sektionen ein.",
            ),
            (
                "The storm strengthens the colony — what doesn't break it, feeds it.",
                "Der Sturm staerkt die Kolonie — was sie nicht bricht, naehrt sie.",
            ),
            (
                "Nutrient redistribution prioritizes core structures.",
                "Naehrstoffumverteilung priorisiert Kernstrukturen.",
            ),
            (
                "The outer canopy takes damage but will regenerate.",
                "Das aeussere Blattdach nimmt Schaden, wird sich aber regenerieren.",
            ),
        ],
        "snow": [
            (
                "The colony's metabolism shifts to cold-adapted mode.",
                "Der Stoffwechsel der Kolonie wechselt in den kaelteangepassten Modus.",
            ),
            (
                "Snow insulates the outer shell — interior temperatures stabilize.",
                "Schnee isoliert die Aussenschale — Innentemperaturen stabilisieren sich.",
            ),
            (
                "The white blanket triggers a colour shift in the canopy.",
                "Die weisse Decke loest einen Farbwechsel im Blattdach aus.",
            ),
            (
                "Dormant winter organisms begin their brief cycle.",
                "Schlafende Winterorganismen beginnen ihren kurzen Zyklus.",
            ),
            (
                "The colony has seen snow before — adaptation is swift.",
                "Die Kolonie hat schon Schnee gesehen — Anpassung ist schnell.",
            ),
        ],
        "storm_snow": [
            (
                "Full siege response — the colony seals all external pores.",
                "Volle Belagerungsreaktion — die Kolonie versiegelt alle aeusseren Poren.",
            ),
            (
                "Emergency heating from metabolic activity of core organisms.",
                "Notfallheizung aus metabolischer Aktivitaet der Kernorganismen.",
            ),
            (
                "The blizzard is the most severe test of the colony's resilience.",
                "Der Schneesturm ist der haerteste Test der Widerstandsfaehigkeit der Kolonie.",
            ),
            (
                "Communication shifts entirely to chemical signalling.",
                "Kommunikation wechselt vollstaendig auf chemische Signalgebung.",
            ),
            (
                "The colony endures — as it has endured for millennia.",
                "Die Kolonie haelt durch — wie sie es seit Jahrtausenden getan hat.",
            ),
        ],
        "thunderstorm": [
            (
                "Bioelectric surges energize the neural network.",
                "Bioelektrische Schuebe energetisieren das Neuronennetzwerk.",
            ),
            (
                "The colony absorbs lightning energy — growth accelerates.",
                "Die Kolonie absorbiert Blitzenergie — Wachstum beschleunigt sich.",
            ),
            (
                "Thunder triggers synchronized bioluminescent pulses.",
                "Donner loest synchronisierte biolumineszente Pulse aus.",
            ),
            (
                "The electrical storm stimulates deep-root expansion.",
                "Der Elektrosturm stimuliert Tiefenwurzel-Expansion.",
            ),
            (
                "The colony seems almost excited by the electromagnetic energy.",
                "Die Kolonie scheint fast aufgeregt durch die elektromagnetische Energie.",
            ),
        ],
        "thunderstorm_severe": [
            (
                "Structural damage to the outer canopy — healing prioritized.",
                "Strukturschaeden am aeusseren Blattdach — Heilung priorisiert.",
            ),
            (
                "The colony bleeds luminescent fluid from torn membranes.",
                "Die Kolonie blutet lumineszente Fluessigkeit aus gerissenen Membranen.",
            ),
            ("Emergency distress pheromones detected colony-wide.", "Notfall-Notpheromone kolonieweit erkannt."),
            (
                "The worst storm the colony has weathered — but it adapts.",
                "Der schlimmste Sturm, den die Kolonie ueberstanden hat — aber sie passt sich an.",
            ),
            (
                "Core preservation mode — all peripheral organisms sacrificed.",
                "Kernerhaltungsmodus — alle peripheren Organismen geopfert.",
            ),
        ],
        "heat": [
            (
                "Upper organisms retract to avoid thermal damage.",
                "Obere Organismen ziehen sich zurueck, um thermische Schaeden zu vermeiden.",
            ),
            (
                "The colony increases water circulation to cool its core.",
                "Die Kolonie erhoet die Wasserzirkulation, um ihren Kern zu kuehlen.",
            ),
            (
                "Heat stress triggers early sporulation — survival instinct.",
                "Hitzestress loest fruehe Sporulation aus — Ueberlebensinstinkt.",
            ),
            ("Bleaching begins at the uppermost fronds.", "Bleichen beginnt an den obersten Wedeln."),
            (
                "The colony sweats — releasing moisture to cool itself.",
                "Die Kolonie schwitzt — gibt Feuchtigkeit ab, um sich zu kuehlen.",
            ),
        ],
        "cold": [
            (
                "The colony contracts — insulating air pockets form.",
                "Die Kolonie zieht sich zusammen — isolierende Lufttaschen bilden sich.",
            ),
            (
                "Metabolism drops to 30% — the colony enters torpor.",
                "Stoffwechsel sinkt auf 30% — die Kolonie tritt in Erstarrung.",
            ),
            ("Only the deepest organisms remain fully active.", "Nur die tiefsten Organismen bleiben voll aktiv."),
            (
                "The outer membrane crystallizes into a protective shell.",
                "Die Aussenmembran kristallisiert zu einer Schutzschale.",
            ),
            ("Chemical warmth radiates from the colony's core.", "Chemische Waerme strahlt aus dem Kern der Kolonie."),
        ],
        "wind": [
            (
                "The canopy sways — shedding weak branches naturally.",
                "Das Blattdach wiegt sich — schwache Aeste werden natuerlich abgeworfen.",
            ),
            ("Wind carries spores to new colonization sites.", "Wind traegt Sporen zu neuen Besiedlungsstandorten."),
            (
                "The colony's flexible architecture absorbs wind energy.",
                "Die flexible Architektur der Kolonie absorbiert Windenergie.",
            ),
            (
                "Wind-borne nutrients enrich the outer layers.",
                "Windgetragene Naehrstoffe bereichern die aeusseren Schichten.",
            ),
            (
                "The swaying motion triggers a calming response in inhabitants.",
                "Die Schwingbewegung loest eine beruhigende Reaktion bei den Bewohnern aus.",
            ),
        ],
        "full_moon": [
            (
                "Lunar tides trigger mass spawning — the colony reproduces.",
                "Mondgezeiten loesen Massenlaichen aus — die Kolonie reproduziert sich.",
            ),
            ("Bioluminescence reaches its brightest cycle.", "Biolumineszenz erreicht ihren hellsten Zyklus."),
            (
                "The colony's reproductive organs unfurl under moonlight.",
                "Die Reproduktionsorgane der Kolonie entfalten sich im Mondlicht.",
            ),
            (
                "Nocturnal predators are at peak activity — the colony's defences activate.",
                "Naechtliche Raeuber sind auf Spitzenaktivitaet — die Abwehr der Kolonie aktiviert sich.",
            ),
            (
                "The full moon synchronizes the colony's circadian rhythm.",
                "Der Vollmond synchronisiert den zirkadianen Rhythmus der Kolonie.",
            ),
        ],
        "new_moon": [
            (
                "The colony's own light becomes the dominant illumination.",
                "Das eigene Licht der Kolonie wird zur dominanten Beleuchtung.",
            ),
            (
                "Deep-dwelling creatures emerge — the colony monitors with caution.",
                "Tiefseewesen tauchen auf — die Kolonie beobachtet mit Vorsicht.",
            ),
            (
                "Internal bioluminescence creates a meditative atmosphere.",
                "Interne Biolumineszenz erzeugt eine meditative Atmosphaere.",
            ),
            (
                "The new moon triggers introspective chemical cycles.",
                "Der Neumond loest introspektive chemische Zyklen aus.",
            ),
            (
                "Without moonlight, the colony's self-generated glow is spectacular.",
                "Ohne Mondlicht ist das selbsterzeugte Leuchten der Kolonie spektakulaer.",
            ),
        ],
    },
    # ── post-apocalyptic ──────────────────────────────────────────────────────
    "post-apocalyptic": {
        "clear": [
            ("Salvage teams deployed to the outer zones.", "Bergungstrupps in die Aussenzonen entsandt."),
            (
                "Solar collectors reach full output — batteries charge.",
                "Solarkollektoren erreichen volle Leistung — Batterien laden.",
            ),
            (
                "Clear weather makes the wasteland feel almost hopeful.",
                "Klares Wetter laesst das Oedland fast hoffnungsvoll erscheinen.",
            ),
            (
                "The lookouts can see for kilometres — no raiders in sight.",
                "Die Ausguck koennen kilometerweit sehen — keine Raeuber in Sicht.",
            ),
            (
                "Water evaporation accelerates — conservation measures enforced.",
                "Wasserverdunstung beschleunigt sich — Konservierungsmassnahmen durchgesetzt.",
            ),
        ],
        "overcast": [
            (
                "The grey sky matches the community's mood.",
                "Der graue Himmel entspricht der Stimmung der Gemeinschaft.",
            ),
            (
                "Reduced solar output — non-essential systems rationed.",
                "Reduzierte Solarleistung — nicht-essentielle Systeme rationiert.",
            ),
            (
                "The overcast sky provides relief from the relentless sun.",
                "Der bewoelkte Himmel bietet Erleichterung von der erbarmungslosen Sonne.",
            ),
            ("Salvage operations continue under grey skies.", "Bergungsoperationen gehen unter grauem Himmel weiter."),
            (
                "The children ask if it will rain — hope is fragile.",
                "Die Kinder fragen, ob es regnen wird — Hoffnung ist zerbrechlich.",
            ),
        ],
        "fog": [
            (
                "Patrols shortened — too dangerous in reduced visibility.",
                "Patrouillen verkuerzt — zu gefaehrlich bei eingeschraenkter Sicht.",
            ),
            (
                "The fog carries strange sounds from the wasteland.",
                "Der Nebel traegt seltsame Geraeusche aus dem Oedland.",
            ),
            (
                "Sentries on high alert — fog is a raider's friend.",
                "Wachen in Alarmbereitschaft — Nebel ist ein Freund der Raeuber.",
            ),
            (
                "The community pulls inward — waiting for the fog to lift.",
                "Die Gemeinschaft zieht sich nach innen zurueck — wartet, dass der Nebel sich hebt.",
            ),
            (
                "Fog complicates water collection — drip traps work overtime.",
                "Nebel erschwert Wassersammlung — Tropffallen arbeiten auf Hochtouren.",
            ),
        ],
        "fog_dense": [
            (
                "The compound is sealed — no movement in or out.",
                "Die Anlage ist versiegelt — keine Bewegung hinein oder heraus.",
            ),
            ("Acoustic sentries replace visual watches.", "Akustische Wachen ersetzen visuelle Beobachtung."),
            (
                "The dense fog triggers old fears — the before-times had fog like this.",
                "Der dichte Nebel loest alte Aengste aus — die Zeit davor hatte Nebel wie diesen.",
            ),
            (
                "Radio silence ordered — sound carries too far in this fog.",
                "Funkstille angeordnet — Geraeusche tragen zu weit in diesem Nebel.",
            ),
            ("Everyone waits. There is nothing else to do.", "Alle warten. Es gibt nichts anderes zu tun."),
        ],
        "rain_light": [
            ("Rain collectors deployed — every drop matters.", "Regensammler aufgestellt — jeder Tropfen zaehlt."),
            ("The drizzle settles the dust — a small mercy.", "Der Nieselregen legt den Staub — eine kleine Gnade."),
            ("Children catch raindrops on their tongues.", "Kinder fangen Regentropfen auf ihren Zungen."),
            (
                "The crops perk up — even this little moisture helps.",
                "Die Ernten richten sich auf — selbst diese geringe Feuchtigkeit hilft.",
            ),
            ("Morale improves with every raindrop.", "Die Moral verbessert sich mit jedem Regentropfen."),
        ],
        "rain": [
            ("Celebration in the compound — the cisterns fill!", "Feier in der Anlage — die Zisternen fuellen sich!"),
            (
                "Water rationing suspended — a rare day of abundance.",
                "Wasserrationierung ausgesetzt — ein seltener Tag des Ueberflusses.",
            ),
            (
                "The rain means survival — the community gives thanks.",
                "Der Regen bedeutet Ueberleben — die Gemeinschaft gibt Dank.",
            ),
            ("Mud becomes a problem, but nobody complains.", "Schlamm wird zum Problem, aber niemand beschwert sich."),
            (
                "The crops drink — next harvest may actually succeed.",
                "Die Ernten trinken — die naechste Ernte koennte tatsaechlich gelingen.",
            ),
        ],
        "rain_freezing": [
            (
                "Crop covers deployed — the harvest is at risk.",
                "Ernteabdeckungen aufgestellt — die Ernte ist gefaehrdet.",
            ),
            (
                "Injuries from falls on icy surfaces increase.",
                "Verletzungen durch Stuerze auf eisigen Flaechen nehmen zu.",
            ),
            (
                "The water pipes must be insulated or they'll burst.",
                "Die Wasserrohre muessen isoliert werden oder sie platzen.",
            ),
            (
                "Freezing rain is worse than no rain — it destroys more than it gives.",
                "Eisregen ist schlimmer als kein Regen — er zerstoert mehr als er gibt.",
            ),
            (
                "The medic treats frostbite and broken bones simultaneously.",
                "Der Sanitaeter behandelt Erfrierungen und Knochenbrueche gleichzeitig.",
            ),
        ],
        "storm": [
            (
                "Emergency shelters opened — above-ground structures at risk.",
                "Notunterkuenfte geoeffnet — oberirdische Strukturen gefaehrdet.",
            ),
            (
                "Repair crews on standby — the storm will leave damage.",
                "Reparaturtrupps in Bereitschaft — der Sturm wird Schaeden hinterlassen.",
            ),
            (
                "The storm tests the community's resilience — again.",
                "Der Sturm testet die Widerstandsfaehigkeit der Gemeinschaft — wieder.",
            ),
            (
                "Loose sheet metal becomes lethal — everyone stays low.",
                "Loses Blech wird toedlich — alle bleiben niedrig.",
            ),
            (
                "The storm is fierce but the community has endured worse.",
                "Der Sturm ist heftig, aber die Gemeinschaft hat Schlimmeres ueberstanden.",
            ),
        ],
        "snow": [
            ("The children make snow angels in the ruins.", "Die Kinder machen Schneeengel in den Ruinen."),
            (
                "Snow insulates the shelters — a rare comfort.",
                "Schnee isoliert die Unterkuenfte — ein seltener Komfort.",
            ),
            (
                "Meltwater will fill the cisterns in spring — hope banks.",
                "Schmelzwasser wird die Zisternen im Fruehling fuellen — Hoffnung angespart.",
            ),
            (
                "The beauty of snow on ruins catches even hardened hearts.",
                "Die Schoenheit von Schnee auf Ruinen beruehrt selbst abgehaertete Herzen.",
            ),
            (
                "Snow covers the worst scars — a temporary mercy.",
                "Schnee bedeckt die schlimmsten Narben — eine voruebergehende Gnade.",
            ),
        ],
        "storm_snow": [
            ("Full lockdown — no one leaves the compound.", "Volle Sperre — niemand verlaesst die Anlage."),
            (
                "Fuel reserves depleting faster than planned.",
                "Treibstoffreserven erschoepfen sich schneller als geplant.",
            ),
            (
                "The blizzard is the most dangerous enemy right now.",
                "Der Schneesturm ist im Moment der gefaehrlichste Feind.",
            ),
            (
                "Food rationing begins — the storm may last days.",
                "Nahrungsmittelrationierung beginnt — der Sturm kann Tage dauern.",
            ),
            (
                "The community huddles together — warmth comes from bodies and will.",
                "Die Gemeinschaft draengt sich zusammen — Waerme kommt von Koerpern und Willen.",
            ),
        ],
        "thunderstorm": [
            (
                "Lightning ignites a fire in the salvage yard — crews respond.",
                "Blitz entzuendet ein Feuer im Bergungshof — Trupps reagieren.",
            ),
            (
                "The solar array shorts out — backup battery holds.",
                "Die Solaranlage schliesst kurz — Backup-Batterie haelt.",
            ),
            (
                "The children are frightened — the elders tell stories to calm them.",
                "Die Kinder haben Angst — die Aelteren erzaehlen Geschichten, um sie zu beruhigen.",
            ),
            ("Thunder echoes off the ruins like artillery fire.", "Donner hallt von den Ruinen wie Artilleriefeuer."),
            (
                "The storm passes — damage assessment begins at first light.",
                "Der Sturm zieht vorbei — Schadensbewertung beginnt bei erstem Licht.",
            ),
        ],
        "thunderstorm_severe": [
            (
                "Multiple fires reported — all hands to firefighting.",
                "Mehrere Braende gemeldet — alle Haende zum Feuerloesch.",
            ),
            (
                "The most severe storm since the founding — prayer and action.",
                "Der schwerste Sturm seit der Gruendung — Gebet und Aktion.",
            ),
            (
                "Casualties from flying debris — the medic is overwhelmed.",
                "Verletzte durch umherfliegende Truemmer — der Sanitaeter ist ueberlastet.",
            ),
            (
                "When it ends, the community will rebuild. They always do.",
                "Wenn es endet, wird die Gemeinschaft wieder aufbauen. Das tun sie immer.",
            ),
            (
                "The storm reminds everyone why they chose to build underground.",
                "Der Sturm erinnert alle daran, warum sie unter der Erde gebaut haben.",
            ),
        ],
        "heat": [
            (
                "Water rationing strictened — survival arithmetic.",
                "Wasserrationierung verschaerft — Ueberlebensarithmetik.",
            ),
            (
                "Outdoor work limited to dawn and dusk shifts.",
                "Arbeit im Freien auf Morgen- und Abenddaemmerungsschichten beschraenkt.",
            ),
            (
                "The heat wilts the crops — irrigation increased.",
                "Die Hitze laesst die Ernten welken — Bewaesserung erhoeht.",
            ),
            (
                "Tempers run hot — disputes settled before they escalate.",
                "Gemüter erhitzen sich — Streitigkeiten werden geschlichtet, bevor sie eskalieren.",
            ),
            ("The community seeks shade and patience.", "Die Gemeinschaft sucht Schatten und Geduld."),
        ],
        "cold": [
            (
                "Fuel conservation becomes the community's main concern.",
                "Treibstoffkonservierung wird zur Hauptsorge der Gemeinschaft.",
            ),
            ("The cold claims the last of the autumn stores.", "Die Kaelte beansprucht die letzten Herbstvorraete."),
            (
                "Communal sleeping arrangements — body heat is a resource.",
                "Gemeinschaftliche Schlafanordnungen — Koerperwaerme ist eine Ressource.",
            ),
            (
                "The plumber is the most valuable person in the compound.",
                "Der Klempner ist die wertvollste Person in der Anlage.",
            ),
            (
                "Cold steels the community's resolve — they will not break.",
                "Kaelte staehlt den Willen der Gemeinschaft — sie werden nicht brechen.",
            ),
        ],
        "wind": [
            (
                "The wind strips topsoil from the gardens — cover crops deployed.",
                "Der Wind traegt Mutterboden von den Gaerten ab — Deckfruechte eingesetzt.",
            ),
            ("Sand infiltrates every seal and gasket.", "Sand dringt in jede Dichtung ein."),
            (
                "The wind tests every repair, every patch, every weld.",
                "Der Wind prueft jede Reparatur, jedes Flickwerk, jede Schweissnaht.",
            ),
            ("Eye protection required for all outdoor work.", "Augenschutz fuer alle Aussenarbeiten erforderlich."),
            (
                "The wind is a constant companion — hated but respected.",
                "Der Wind ist ein staendiger Begleiter — gehasst aber respektiert.",
            ),
        ],
        "full_moon": [
            ("Full moon watch — doubled sentries on the walls.", "Vollmondwache — verdoppelte Wachen auf den Mauern."),
            (
                "The moonlight reveals movement on the horizon — scouts dispatched.",
                "Das Mondlicht enthuellt Bewegung am Horizont — Spaeer entsandt.",
            ),
            (
                "The old stories say full moons bring raiders — the gates are barred.",
                "Die alten Geschichten sagen, Vollmonde bringen Raeuber — die Tore sind verriegelt.",
            ),
            (
                "The full moon reminds everyone of what the world looked like before.",
                "Der Vollmond erinnert alle daran, wie die Welt vorher aussah.",
            ),
            (
                "Moonlight makes the ruins beautiful — a cruel joke.",
                "Mondlicht macht die Ruinen schoen — ein grausamer Scherz.",
            ),
        ],
        "new_moon": [
            (
                "Darkness means fuel savings — no exterior lighting tonight.",
                "Dunkelheit bedeutet Treibstoffersparnis — keine Aussenbeleuchtung heute Nacht.",
            ),
            (
                "The sentries strain their ears — darkness sharpens hearing.",
                "Die Wachen spitzen ihre Ohren — Dunkelheit schaerft das Gehoer.",
            ),
            (
                "A moonless night is a thief's night — extra patrols.",
                "Eine mondlose Nacht ist eine Diebesnacht — extra Patrouillen.",
            ),
            (
                "The stars are brilliant tonight — the astronomer shares the telescope.",
                "Die Sterne sind brillant heute Nacht — der Astronom teilt das Teleskop.",
            ),
            (
                "In the darkness, the community's fires burn brighter.",
                "In der Dunkelheit brennen die Feuer der Gemeinschaft heller.",
            ),
        ],
    },
    # ── medieval ──────────────────────────────────────────────────────────────
    "medieval": {
        "clear": [
            (
                "The scholars take their debates to the sun-warmed courtyards.",
                "Die Gelehrten tragen ihre Debatten in die sonnenwaermen Innenhoefen.",
            ),
            ("Market day proceeds with good cheer.", "Markttag verlaeuft mit guter Laune."),
            (
                "The scribes work by natural light — ink flows freely.",
                "Die Schreiber arbeiten bei natuerlichem Licht — Tinte fliesst frei.",
            ),
            ("Clear weather brings visitors to the gates.", "Klares Wetter bringt Besucher an die Tore."),
            ("The gardens produce abundantly under the sun.", "Die Gaerten produzieren reichlich unter der Sonne."),
        ],
        "overcast": [
            (
                "The illuminators prefer this diffused light for their work.",
                "Die Buchmalerer bevorzugen dieses gedaempfte Licht fuer ihre Arbeit.",
            ),
            (
                "A contemplative mood settles over the quarter.",
                "Eine besinnliche Stimmung legt sich ueber das Viertel.",
            ),
            (
                "The grey sky drives the theologians to deeper reflection.",
                "Der graue Himmel treibt die Theologen zu tieferer Reflexion.",
            ),
            (
                "Indoor lectures are better attended on grey days.",
                "Vorlesungen drinnen sind an grauen Tagen besser besucht.",
            ),
            (
                "The herbalists check their drying racks — humidity rises.",
                "Die Kraeuterkundler pruefen ihre Trockengestelle — Feuchtigkeit steigt.",
            ),
        ],
        "fog": [
            (
                "The bells ring their hours, muffled but reliable.",
                "Die Glocken laeuten ihre Stunden, gedaempft aber zuverlaessig.",
            ),
            (
                "The gate guards challenge every shape that emerges from the mist.",
                "Die Torwaechter fordern jede Gestalt heraus, die aus dem Nebel auftaucht.",
            ),
            (
                "The fog gives the cloisters an otherworldly beauty.",
                "Der Nebel verleiht den Kreuzgaengen eine jenseitige Schoenheit.",
            ),
            (
                "Manuscript delivery from other cities is delayed.",
                "Manuskriptlieferung aus anderen Staedten ist verzoegert.",
            ),
            (
                "The apothecaries report increased demand for warming tonics.",
                "Die Apotheker melden erhoehte Nachfrage nach waermenden Tonika.",
            ),
        ],
        "fog_dense": [
            (
                "The city gates remain closed — no one enters or leaves.",
                "Die Stadttore bleiben geschlossen — niemand betritt oder verlaesst die Stadt.",
            ),
            (
                "Torches burn at midday — the fog defeats the sun.",
                "Fackeln brennen am Mittag — der Nebel besiegt die Sonne.",
            ),
            (
                "The fog triggers superstitious murmurs among the less educated.",
                "Der Nebel loest aberglaeubisches Murmeln unter den weniger Gebildeten aus.",
            ),
            (
                "Even the bravest scholar hesitates to cross an unseen courtyard.",
                "Selbst der mutigste Gelehrte zoegert, einen unsichtbaren Innenhof zu ueberqueren.",
            ),
            (
                "The fog wraps the city in a cocoon of enforced contemplation.",
                "Der Nebel huellt die Stadt in einen Kokon erzwungener Besinnung.",
            ),
        ],
        "rain_light": [
            ("The herb gardens drink gratefully.", "Die Kraeutergaerten trinken dankbar."),
            (
                "Scholars rush to cover manuscripts left on windowsills.",
                "Gelehrte eilen, um Manuskripte auf Fensterbraenken abzudecken.",
            ),
            (
                "The gentle rain is a blessing on the newly planted beds.",
                "Der sanfte Regen ist ein Segen fuer die frisch bepflanzten Beete.",
            ),
            (
                "The scriptorium shutters are half-drawn against the drizzle.",
                "Die Fensterlaeden des Skriptoriums sind halb gegen den Nieselregen gezogen.",
            ),
            (
                "Rain brings the smell of earth and growing things.",
                "Regen bringt den Duft von Erde und wachsenden Dingen.",
            ),
        ],
        "rain": [
            (
                "The lower courts flood — scholars carry their hems.",
                "Die unteren Hoefe fluten — Gelehrte raffen ihre Saeueme.",
            ),
            ("Indoor debate replaces outdoor discourse.", "Debatte drinnen ersetzt Diskurs draussen."),
            ("The rain feeds the vineyards beyond the walls.", "Der Regen naehrt die Weinberge jenseits der Mauern."),
            (
                "Laundry hangs in the halls instead of the courtyards.",
                "Waesche haengt in den Hallen statt in den Innenhoefen.",
            ),
            (
                "The rain is God's irrigation — the gardeners give thanks.",
                "Der Regen ist Gottes Bewaesserung — die Gaertner danken.",
            ),
        ],
        "rain_freezing": [
            (
                "The cobblestones become treacherous — sand is spread.",
                "Das Kopfsteinpflaster wird tueckisch — Sand wird gestreut.",
            ),
            (
                "The water carriers slip and spill — rationing begins.",
                "Die Wassertraeger rutschen und verschuetten — Rationierung beginnt.",
            ),
            (
                "Ice glazes the battlements — the walls become unclimbable.",
                "Eis glasiert die Zinnen — die Mauern werden unkletterbar.",
            ),
            (
                "The herbalists prepare poultices for bruises and fractures.",
                "Die Kraeuterkundler bereiten Umschlaege fuer Prellungen und Brueche vor.",
            ),
            (
                "Freezing rain is a siege weapon that arrives unbidden.",
                "Eisregen ist eine Belagerungswaffe, die ungebeten kommt.",
            ),
        ],
        "storm": [
            (
                "The wind tests the shutters — the carpenter is busy.",
                "Der Wind prueft die Laeden — der Zimmermann ist beschaeftigt.",
            ),
            (
                "Manuscripts are moved to inner chambers for protection.",
                "Manuskripte werden in innere Kammern zum Schutz gebracht.",
            ),
            (
                "The storm delays the post from the southern cities.",
                "Der Sturm verzoegert die Post aus den suedlichen Staedten.",
            ),
            (
                "Market stalls are disassembled — merchants seek shelter.",
                "Marktstaende werden abgebaut — Haendler suchen Schutz.",
            ),
            ("The walls hold — as they were built to do.", "Die Mauern halten — wie sie gebaut wurden."),
        ],
        "snow": [
            ("The children of the quarter play in the snow.", "Die Kinder des Viertels spielen im Schnee."),
            (
                "Snow insulates the rooms — the fires burn lower.",
                "Schnee isoliert die Raeume — die Feuer brennen niedriger.",
            ),
            ("The white blanket makes the city look new.", "Die weisse Decke laesst die Stadt neu aussehen."),
            ("Ink freezes — the scribes work by the fire.", "Tinte gefriert — die Schreiber arbeiten am Feuer."),
            (
                "The silence of snowfall brings unexpected peace.",
                "Die Stille des Schneefalls bringt unerwarteten Frieden.",
            ),
        ],
        "storm_snow": [
            ("The gates are sealed — the city is an island.", "Die Tore sind versiegelt — die Stadt ist eine Insel."),
            ("Wood supplies dwindle — the cold is the enemy.", "Holzvorraete schwinden — die Kaelte ist der Feind."),
            (
                "The blizzard forces communal living — warmth is shared.",
                "Der Schneesturm erzwingt gemeinschaftliches Leben — Waerme wird geteilt.",
            ),
            (
                "Messengers cannot depart — the city is isolated.",
                "Boten koennen nicht aufbrechen — die Stadt ist isoliert.",
            ),
            (
                "Inside the walls, the work of the mind continues undaunted.",
                "Innerhalb der Mauern geht die Arbeit des Geistes unerschrocken weiter.",
            ),
        ],
        "thunderstorm": [
            (
                "Lightning illuminates the stained glass in impossible colours.",
                "Blitze beleuchten das Buntglas in unmoeglichen Farben.",
            ),
            (
                "The storm interrupts the evening service — prayers become shouts.",
                "Der Sturm unterbricht den Abendgottesdienst — Gebete werden zu Rufen.",
            ),
            (
                "The bellringer waits for the storm to pass before tolling vespers.",
                "Der Gloeckner wartet, bis der Sturm vorbeizieht, bevor er die Vesper laeutet.",
            ),
            (
                "Thunder rattles the inkwells — several manuscripts are spotted.",
                "Donner laesst die Tintenglaeser klirren — mehrere Manuskripte werden bekleckst.",
            ),
            (
                "The storm is fierce but the faith of the city is fiercer.",
                "Der Sturm ist heftig, aber der Glaube der Stadt ist heftiger.",
            ),
        ],
        "thunderstorm_severe": [
            (
                "The great bell rings unbidden — lightning has struck the tower.",
                "Die grosse Glocke laeutet ungebeten — Blitz hat den Turm getroffen.",
            ),
            (
                "Roof tiles shatter in the hail — the artisans despair.",
                "Dachziegel zerbrechen im Hagel — die Handwerker verzweifeln.",
            ),
            (
                "The worst storm in living memory — prayers in every chapel.",
                "Der schlimmste Sturm in lebender Erinnerung — Gebete in jeder Kapelle.",
            ),
            (
                "The storm damages the rose window — a generation's work at risk.",
                "Der Sturm beschaedigt das Rosenfenster — die Arbeit einer Generation in Gefahr.",
            ),
            (
                "Some whisper of divine test — others simply rebuild.",
                "Manche fluesstern von goettlicher Pruefung — andere bauen einfach wieder auf.",
            ),
        ],
        "heat": [
            ("The scholars retreat to the cool cellars.", "Die Gelehrten ziehen sich in die kuehlen Keller zurueck."),
            (
                "Heat wilts the gardens — the gardeners work before dawn.",
                "Hitze laesst die Gaerten welken — die Gaertner arbeiten vor Morgengrauen.",
            ),
            ("The well level drops — water is precious.", "Der Brunnenspiegel sinkt — Wasser ist kostbar."),
            (
                "Ink dries too fast — the scribes work in frustration.",
                "Tinte trocknet zu schnell — die Schreiber arbeiten frustriert.",
            ),
            (
                "The heat makes the stone walls radiate warmth even at night.",
                "Die Hitze laesst die Steinmauern auch nachts Waerme abstrahlen.",
            ),
        ],
        "cold": [
            (
                "The fires consume more wood than the foresters can supply.",
                "Die Feuer verbrauchen mehr Holz, als die Foerster liefern koennen.",
            ),
            (
                "The well freezes — snow must be melted for water.",
                "Der Brunnen gefriert — Schnee muss fuer Wasser geschmolzen werden.",
            ),
            (
                "Scholars huddle together for warmth — philosophy and body heat.",
                "Gelehrte draengen sich fuer Waerme zusammen — Philosophie und Koerperwaerme.",
            ),
            ("The cold drives everyone to the forge and kitchen.", "Die Kaelte treibt alle zur Schmiede und Kueche."),
            (
                "Ink freezes in the wells — writing is impossible.",
                "Tinte gefriert in den Naepfen — Schreiben ist unmoeglich.",
            ),
        ],
        "wind": [
            (
                "The Tramontane rattles shutters and scatters market awnings.",
                "Die Tramontane klappern an Laeden und zerstreut Marktvordaecher.",
            ),
            (
                "The wind carries the sound of bells from distant churches.",
                "Der Wind traegt den Klang von Glocken ferner Kirchen.",
            ),
            (
                "Scholars chase manuscript pages through the cloisters.",
                "Gelehrte jagen Manuskriptseiten durch die Kreuzgaenge.",
            ),
            (
                "The wind is so strong that the market is cancelled.",
                "Der Wind ist so stark, dass der Markt abgesagt wird.",
            ),
            (
                "The cold wind from the mountains brings the scent of pine.",
                "Der kalte Wind von den Bergen bringt den Duft von Kiefern.",
            ),
        ],
        "full_moon": [
            (
                "The night scholars read by moonlight — saving candles.",
                "Die Nachtgelehrten lesen bei Mondlicht — sparen Kerzen.",
            ),
            (
                "The full moon illuminates the rose window from outside.",
                "Der Vollmond beleuchtet das Rosenfenster von aussen.",
            ),
            (
                "The astronomers record their observations by moonlight.",
                "Die Astronomen verzeichnen ihre Beobachtungen im Mondlicht.",
            ),
            (
                "Some say the full moon sharpens wit — tonight the debates are fierce.",
                "Manche sagen, der Vollmond schaerft den Verstand — heute Nacht sind die Debatten heftig.",
            ),
            (
                "Moonlight bathes the courtyards in silver — a gift for the sleepless.",
                "Mondlicht badet die Innenhoefen in Silber — ein Geschenk fuer die Schlaflosen.",
            ),
        ],
        "new_moon": [
            (
                "The scriptorium windows glow like amber — the only light.",
                "Die Fenster des Skriptoriums gluehen wie Bernstein — das einzige Licht.",
            ),
            (
                "The astronomers point their instruments at the deepest stars.",
                "Die Astronomen richten ihre Instrumente auf die tiefsten Sterne.",
            ),
            (
                "Candle consumption doubles on moonless nights.",
                "Kerzenverbrauch verdoppelt sich in mondlosen Naechten.",
            ),
            (
                "The new moon brings early sleep — and vivid dreams.",
                "Der Neumond bringt fruehen Schlaf — und lebhafte Traeume.",
            ),
            (
                "Without moonlight, the city turns inward — and finds itself.",
                "Ohne Mondlicht wendet sich die Stadt nach innen — und findet sich selbst.",
            ),
        ],
    },
}

# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 4: AGENT REACTIONS (mood-dependent, theme-independent)
# Selected by average zone mood. Optional suffix.
# ═══════════════════════════════════════════════════════════════════════════════

AGENT_REACTIONS: dict[str, list[T]] = {
    "positive": [  # zone avg mood > 20
        ("Despite the conditions, spirits remain high.", "Trotz der Bedingungen bleibt die Stimmung gut."),
        ("The agents adapt with quiet professionalism.", "Die Agenten passen sich mit ruhiger Professionalitaet an."),
        (
            "Morale holds steady — the community draws strength from within.",
            "Die Moral haelt — die Gemeinschaft schoepft Kraft aus sich selbst.",
        ),
        (
            "A sense of shared purpose outweighs the discomfort.",
            "Ein Gefuehl gemeinsamer Bestimmung ueberwiegt das Unbehagen.",
        ),
        (
            "The conditions are harsh, but the people are harder.",
            "Die Bedingungen sind hart, aber die Menschen sind haerter.",
        ),
    ],
    "negative": [  # zone avg mood < -20
        ("The weather only deepens the malaise.", "Das Wetter vertieft nur die Missstimmung."),
        (
            "Tempers fray as conditions worsen.",
            "Die Nerven liegen blank, waehrend sich die Bedingungen verschlechtern.",
        ),
        (
            "The mood darkens further — complaints increase.",
            "Die Stimmung verduestert sich weiter — Beschwerden nehmen zu.",
        ),
        (
            "Patience wears thin. The conditions are the last straw.",
            "Die Geduld wird duenn. Die Bedingungen sind der letzte Tropfen.",
        ),
        ("Unease spreads through the ranks like fog.", "Unbehagen breitet sich durch die Reihen wie Nebel."),
    ],
    "neutral": [  # -20 to 20
        ("", ""),  # No reaction — keep it terse sometimes
        ("", ""),
        (
            "The inhabitants carry on, neither complaining nor celebrating.",
            "Die Bewohner machen weiter, weder klagend noch feiernd.",
        ),
        ("Life continues at its usual pace.", "Das Leben geht in seinem ueblichen Tempo weiter."),
        (
            "The conditions are noted but unremarkable.",
            "Die Bedingungen werden zur Kenntnis genommen, aber sind unauffaellig.",
        ),
    ],
}

# ═══════════════════════════════════════════════════════════════════════════════
# COMPOSITE CONSEQUENCES (when 2+ categories active simultaneously)
# ═══════════════════════════════════════════════════════════════════════════════

COMPOSITE_CONSEQUENCES: dict[tuple[str, str], list[T]] = {
    ("fog", "cold"): [
        (
            "The cold fog cuts through every layer. Even hardened operatives retreat indoors.",
            "Der kalte Nebel schneidet durch jede Schicht. Selbst abgehaertete Agenten ziehen sich zurueck.",
        ),
        (
            "Ice crystals form in the fog — breathing becomes painful.",
            "Eiskristalle bilden sich im Nebel — Atmen wird schmerzhaft.",
        ),
        (
            "The combination of fog and cold creates a deadly stillness.",
            "Die Kombination aus Nebel und Kaelte erzeugt eine toedliche Stille.",
        ),
        (
            "Visibility is nil and the cold is biting — the worst of both worlds.",
            "Sicht ist null und die Kaelte beisst — das Schlimmste aus beiden Welten.",
        ),
        (
            "The cold fog clings to skin and seeps into bones.",
            "Der kalte Nebel klammert sich an die Haut und sickert in die Knochen.",
        ),
    ],
    ("rain", "wind"): [
        (
            "Driving rain and {wind_speed}km/h winds make outdoor operations impossible.",
            "Peitschender Regen und {wind_speed}km/h Wind machen Aussenoperationen unmoeglich.",
        ),
        ("The wind turns rain into horizontal needles.", "Der Wind verwandelt Regen in horizontale Nadeln."),
        ("Rain and wind combine into a wall of water.", "Regen und Wind verbinden sich zu einer Wasserwand."),
        (
            "At {wind_speed}km/h with {precipitation}mm rain, nothing stays dry.",
            "Bei {wind_speed}km/h mit {precipitation}mm Regen bleibt nichts trocken.",
        ),
        (
            "The wind-driven rain penetrates every crack and seal.",
            "Der windgetriebene Regen dringt in jede Ritze und Dichtung.",
        ),
    ],
    ("thunderstorm", "night"): [
        (
            "Lightning illuminates the city in staccato flashes. Between strikes, absolute darkness.",
            "Blitze erhellen die Stadt in Stakkato-Blitzen. Zwischen den Einschlaegen absolute Dunkelheit.",
        ),
        (
            "The night storm is a spectacle of primal force — fear and awe in equal measure.",
            "Der Nachtsturm ist ein Schauspiel urtümlicher Kraft — Furcht und Ehrfurcht zu gleichen Teilen.",
        ),
        (
            "Thunder and darkness amplify each other — the night feels alive.",
            "Donner und Dunkelheit verstaerken sich gegenseitig — die Nacht fuehlt sich lebendig an.",
        ),
        (
            "Each lightning flash freezes the world for a heartbeat — then blackness returns.",
            "Jeder Blitz friert die Welt fuer einen Herzschlag ein — dann kehrt Schwarz zurueck.",
        ),
        (
            "The storm owns the night. Everyone else is just enduring it.",
            "Der Sturm besitzt die Nacht. Alle anderen ertragen sie nur.",
        ),
    ],
    ("snow", "wind"): [
        (
            "Whiteout conditions — {wind_speed}km/h winds drive snow horizontally.",
            "Whiteout-Bedingungen — {wind_speed}km/h Wind treiben Schnee horizontal.",
        ),
        (
            "The blowing snow erases all landmarks — direction becomes meaningless.",
            "Der treibende Schnee loescht alle Orientierungspunkte — Richtung wird bedeutungslos.",
        ),
        (
            "Snow and wind create drifts that bury pathways within hours.",
            "Schnee und Wind erzeugen Verwehungen, die Wege innerhalb von Stunden begraben.",
        ),
        (
            "The wind chill at {temperature}°C with {wind_speed}km/h is deadly.",
            "Die Windkaelte bei {temperature}°C mit {wind_speed}km/h ist toedlich.",
        ),
        (
            "Visibility zero, temperature lethal — no one moves.",
            "Sicht null, Temperatur toedlich — niemand bewegt sich.",
        ),
    ],
    ("heat", "wind"): [
        (
            "Hot wind at {wind_speed}km/h — the sirocco desiccates everything.",
            "Heisser Wind bei {wind_speed}km/h — der Scirocco doerrt alles aus.",
        ),
        (
            "The wind brings no relief — only more heat from the interior.",
            "Der Wind bringt keine Erleichterung — nur mehr Hitze aus dem Landesinneren.",
        ),
        (
            "At {temperature}°C with {wind_speed}km/h hot wind, dehydration is rapid.",
            "Bei {temperature}°C mit {wind_speed}km/h heissem Wind ist Dehydration rapide.",
        ),
        (
            "The hot wind carries dust and despair in equal measure.",
            "Der heisse Wind traegt Staub und Verzweiflung zu gleichen Teilen.",
        ),
        ("Sand and heat make every breath a struggle.", "Sand und Hitze machen jeden Atemzug zum Kampf."),
    ],
    ("fog", "full_moon"): [
        (
            "The full moon turns the fog into a luminous silver blanket.",
            "Der Vollmond verwandelt den Nebel in eine leuchtende Silberdecke.",
        ),
        (
            "Moonlit fog — the most disorienting condition possible.",
            "Mondbeleuchteter Nebel — die desorientiereendste Bedingung ueberhaupt.",
        ),
        (
            "The combination creates an eerie, dreamlike atmosphere.",
            "Die Kombination erzeugt eine unheimliche, traumhafte Atmosphaere.",
        ),
        (
            "Light without source, direction without reference — fog under the full moon.",
            "Licht ohne Quelle, Richtung ohne Bezug — Nebel unter dem Vollmond.",
        ),
        (
            "The fog glows from within — the full moon turns mist into magic.",
            "Der Nebel leuchtet von innen — der Vollmond verwandelt Dunst in Magie.",
        ),
    ],
    ("rain", "cold"): [
        (
            "Cold rain at {temperature}°C soaks through every defence.",
            "Kalter Regen bei {temperature}°C durchdringt jede Abwehr.",
        ),
        (
            "The combination of rain and cold is more dangerous than either alone.",
            "Die Kombination aus Regen und Kaelte ist gefaehrlicher als jedes fuer sich.",
        ),
        (
            "Hypothermia risk increases with every minute of exposure.",
            "Unterkuehlungsrisiko steigt mit jeder Minute der Exposition.",
        ),
        (
            "The cold rain runs down necks and into boots — misery incarnate.",
            "Der kalte Regen laeuft in Nacken und Stiefel — Elend in Person.",
        ),
        (
            "At {temperature}°C with steady rain, the body's reserves deplete fast.",
            "Bei {temperature}°C mit stetigem Regen erschoepfen sich die Koerperreserven schnell.",
        ),
    ],
    ("clear", "cold"): [
        (
            "Crystal-clear skies but {temperature}°C — beautiful and brutal.",
            "Kristallklarer Himmel aber {temperature}°C — schoen und brutal.",
        ),
        (
            "The clarity of the air makes the cold feel even sharper.",
            "Die Klarheit der Luft laesst die Kaelte noch schaerfer wirken.",
        ),
        (
            "Under blue skies and bitter cold, the world is a frozen jewel.",
            "Unter blauem Himmel und beissender Kaelte ist die Welt ein gefrorenes Juwel.",
        ),
        (
            "The sun shines but gives no warmth — a winter's deception.",
            "Die Sonne scheint, gibt aber keine Waerme — ein Winterbetrug.",
        ),
        (
            "Cold clarity — everything is visible, nothing is comfortable.",
            "Kalte Klarheit — alles ist sichtbar, nichts ist behaglich.",
        ),
    ],
    ("clear", "heat"): [
        (
            "Unrelenting sun at {temperature}°C — no cloud to offer mercy.",
            "Unerbittliche Sonne bei {temperature}°C — keine Wolke, die Gnade bietet.",
        ),
        (
            "The clear sky is an oven lid — {temperature}°C and climbing.",
            "Der klare Himmel ist ein Ofendeckel — {temperature}°C und steigend.",
        ),
        (
            "Blue sky and scorching heat — the cruelest combination.",
            "Blauer Himmel und sengene Hitze — die grausamste Kombination.",
        ),
        (
            "Not a single cloud between the sun and the suffering below.",
            "Nicht eine einzige Wolke zwischen der Sonne und dem Leiden darunter.",
        ),
        (
            "The sun dominates — shade is the only currency that matters.",
            "Die Sonne dominiert — Schatten ist die einzige Waehrung, die zaehlt.",
        ),
    ],
    ("overcast", "cold"): [
        (
            "Grey skies and {temperature}°C — a combination that erodes will.",
            "Grauer Himmel und {temperature}°C — eine Kombination, die den Willen erodiert.",
        ),
        (
            "The cold is worse under grey skies — no sun to offer even token warmth.",
            "Die Kaelte ist unter grauem Himmel schlimmer — keine Sonne bietet auch nur symbolische Waerme.",
        ),
        (
            "The leaden sky presses down while the cold presses in.",
            "Der bleierne Himmel drueckt von oben, waehrend die Kaelte von den Seiten drueckt.",
        ),
        (
            "Grey and cold — the most demoralizing weather pattern.",
            "Grau und kalt — das demoralisierendste Wettermuster.",
        ),
        (
            "The overcast cold saps energy and optimism alike.",
            "Die bewoelkte Kaelte saugt Energie und Optimismus gleichermassen ab.",
        ),
    ],
}


# ═══════════════════════════════════════════════════════════════════════════════
# TEMPLATE VALIDATION (runs at import time — catches typos before production)
# ═══════════════════════════════════════════════════════════════════════════════

VALID_PLACEHOLDERS = frozenset({"zone", "temperature", "visibility", "wind_speed", "precipitation", "humidity"})


def _validate_templates() -> None:
    """Verify all templates use only valid placeholders.

    Runs once at module import. A typo like {temperatur} instead of {temperature}
    raises ValueError immediately, preventing deployment of broken templates.
    """
    import re

    errors: list[str] = []

    def _check_pool(pool: list[tuple[str, str]], context: str) -> None:
        for i, (en, de) in enumerate(pool):
            for text, lang in [(en, "en"), (de, "de")]:
                placeholders = set(re.findall(r"\{(\w+)\}", text))
                invalid = placeholders - VALID_PLACEHOLDERS
                if invalid:
                    errors.append(f"{context}[{i}] ({lang}): invalid placeholder(s): {invalid}")

    # Validate OPENERS
    for theme, time_slots in OPENERS.items():
        for slot, pool in time_slots.items():
            _check_pool(pool, f"OPENERS/{theme}/{slot}")

    # Validate CORE_WEATHER
    for theme, categories in CORE_WEATHER.items():
        for cat, pool in categories.items():
            _check_pool(pool, f"CORE_WEATHER/{theme}/{cat}")

    # Validate CONSEQUENCES
    for theme, categories in CONSEQUENCES.items():
        for cat, pool in categories.items():
            _check_pool(pool, f"CONSEQUENCES/{theme}/{cat}")

    # Validate AGENT_REACTIONS
    for mood_band, pool in AGENT_REACTIONS.items():
        _check_pool(pool, f"AGENT_REACTIONS/{mood_band}")

    # Validate COMPOSITE_CONSEQUENCES
    for key, pool in COMPOSITE_CONSEQUENCES.items():
        _check_pool(pool, f"COMPOSITE_CONSEQUENCES/{key}")

    if errors:
        raise ValueError(f"Template validation failed ({len(errors)} error(s)):\n" + "\n".join(errors))


_validate_templates()
