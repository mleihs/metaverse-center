"""Objektanker-System — Anchor objects and barometer texts for Resonance Dungeons.

Variation C (Wandernde Dinge): Named objects that migrate through the dungeon,
changing state in 4 phases (discovery → echo → mutation → climax).
2 randomly selected per run from a pool of 8 per archetype.

Variation B (Resonanz-Barometer): Fixed object per archetype that translates
archetype_state thresholds into prose. Displayed only on tier change.

All text is bilingual (en/de) inline per architecture decision #3.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, TypedDict

if TYPE_CHECKING:
    from backend.models.resonance_dungeon import DungeonInstance, RoomNode


class AnchorTextResult(TypedDict):
    """Typed return value for select_anchor_text entries."""

    text_en: str
    text_de: str
    anchor_id: str
    phase: str


# ══════════════════════════════════════════════════════════════════════════════
# ── Entrance Texts — Per-archetype atmosphere pool ───────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
#
# 5 variants per archetype. One chosen at random per run in create_run().
# Literary rules follow the same authoring guidelines as anchor objects.
# ─────────────────────────────────────────────────────────────────────────────

ENTRANCE_TEXTS: dict[str, list[dict[str, str]]] = {
    "The Shadow": [
        {
            "text_en": (
                "The threshold yields without resistance."
                " Beyond it, the darkness is not empty \u2013 it is attentive."
                " The instruments register nothing. Not zero. Nothing."
                " As if measurement itself requires permission here."
            ),
            "text_de": (
                "Die Schwelle gibt widerstandslos nach."
                " Dahinter ist die Dunkelheit nicht leer \u2013 sie ist aufmerksam."
                " Die Instrumente registrieren nichts. Nicht Null. Nichts."
                " Als br\u00e4uchte das Messen selbst hier eine Erlaubnis."
            ),
        },
        {
            "text_en": (
                "The air changes at the threshold. Not colder \u2013 denser."
                " Sound travels differently here: further, and in directions"
                " that should not exist. Something exhales in the distance."
                " It has been holding its breath."
            ),
            "text_de": (
                "Die Luft ver\u00e4ndert sich an der Schwelle. Nicht k\u00e4lter \u2013 dichter."
                " Schall breitet sich hier anders aus: weiter, und in Richtungen,"
                " die es nicht geben sollte. Etwas atmet in der Ferne aus."
                " Es hat den Atem angehalten."
            ),
        },
        {
            "text_en": (
                "The descent begins. The last light does not fade \u2013"
                " it is consumed, methodically, as if the darkness were"
                " cataloguing what it has taken."
                " Your shadows arrive before you do."
            ),
            "text_de": (
                "Der Abstieg beginnt. Das letzte Licht verblasst nicht \u2013"
                " es wird verzehrt, methodisch, als w\u00fcrde die Dunkelheit"
                " katalogisieren, was sie genommen hat."
                " Eure Schatten kommen vor euch an."
            ),
        },
        {
            "text_en": (
                "Silence. Not the silence of emptiness \u2013"
                " the silence of something listening."
                " The walls absorb your footsteps"
                " and return them a fraction of a second later."
                " The echo is learning your rhythm."
            ),
            "text_de": (
                "Stille. Nicht die Stille der Leere \u2013"
                " die Stille von etwas, das zuh\u00f6rt."
                " Die W\u00e4nde absorbieren eure Schritte"
                " und geben sie einen Sekundenbruchteil sp\u00e4ter zur\u00fcck."
                " Das Echo lernt euren Rhythmus."
            ),
        },
        {
            "text_en": (
                "A gap in the architecture. The corridor opens"
                " into a space that your instruments insist is small"
                " but your instincts know is vast."
                " The darkness here has weight. It has patience."
                " It has been here longer than the walls."
            ),
            "text_de": (
                "Eine L\u00fccke in der Architektur. Der Korridor \u00f6ffnet sich"
                " in einen Raum, den eure Instrumente als klein bezeichnen,"
                " den eure Instinkte aber als riesig kennen."
                " Die Dunkelheit hier hat Gewicht. Sie hat Geduld."
                " Sie ist l\u00e4nger hier als die W\u00e4nde."
            ),
        },
    ],
    "The Tower": [
        {
            "text_en": (
                "The lobby is pristine. Too pristine."
                " The reception desk is unmanned, the ledger open to today's date."
                " Someone has been expected."
                " The elevator indicators read floors that should not exist."
            ),
            "text_de": (
                "Die Lobby ist makellos. Zu makellos."
                " Der Empfangstresen ist unbesetzt, das Hauptbuch auf dem heutigen Datum aufgeschlagen."
                " Jemand wurde erwartet."
                " Die Fahrstuhlanzeigen zeigen Stockwerke, die nicht existieren sollten."
            ),
        },
        {
            "text_en": (
                "The revolving door deposits you into a foyer"
                " that smells of floor wax and compounding interest."
                " A clock on the wall runs backward."
                " The building does not acknowledge this as unusual."
            ),
            "text_de": (
                "Die Dreht\u00fcr setzt euch in einem Foyer ab,"
                " das nach Bodenwachs und Zinseszins riecht."
                " Eine Uhr an der Wand l\u00e4uft r\u00fcckw\u00e4rts."
                " Das Geb\u00e4ude erkennt daran nichts Ungew\u00f6hnliches."
            ),
        },
        {
            "text_en": (
                "Ground floor. The architecture is reasonable here \u2013"
                " load-bearing walls where they should be,"
                " exits where regulation demands them."
                " This will not last."
                " The building is only polite on the ground floor."
            ),
            "text_de": (
                "Erdgeschoss. Die Architektur ist hier vern\u00fcnftig \u2013"
                " Tragw\u00e4nde, wo sie sein sollten,"
                " Ausg\u00e4nge, wo die Vorschrift sie verlangt."
                " Das wird nicht anhalten."
                " Das Geb\u00e4ude ist nur im Erdgeschoss h\u00f6flich."
            ),
        },
        {
            "text_en": (
                "A placard by the entrance reads:"
                " 'This building has been inspected and found structurally sound.'"
                " The date has been scratched out. The inspector's name"
                " has been replaced with a floor number."
            ),
            "text_de": (
                "Ein Schild am Eingang lautet:"
                " \u00bbDieses Geb\u00e4ude wurde gepr\u00fcft und f\u00fcr strukturell einwandfrei befunden.\u00ab"
                " Das Datum wurde ausgekratzt. Der Name des Pr\u00fcfers"
                " durch eine Stockwerknummer ersetzt."
            ),
        },
        {
            "text_en": (
                "The foundation hums. A low, structural vibration"
                " that travels upward through the soles."
                " Not mechanical. Organic."
                " The building is aware that you have entered."
                " It adjusts."
            ),
            "text_de": (
                "Das Fundament brummt. Eine tiefe, strukturelle Vibration,"
                " die durch die Sohlen nach oben wandert."
                " Nicht mechanisch. Organisch."
                " Das Geb\u00e4ude wei\u00df, dass ihr eingetreten seid."
                " Es passt sich an."
            ),
        },
    ],
    "The Entropy": [
        {
            "text_en": (
                "The entrance is indistinct. Not ruined \u2013 reduced."
                " The walls retain the memory of colour without the colour itself."
                " The air tastes of averaged everything."
                " Somewhere ahead, a distinction is being quietly dissolved."
            ),
            "text_de": (
                "Der Eingang ist unbestimmt. Nicht zerst\u00f6rt \u2013 reduziert."
                " Die W\u00e4nde bewahren die Erinnerung an Farbe ohne die Farbe selbst."
                " Die Luft schmeckt nach dem Durchschnitt von allem."
                " Irgendwo voraus wird eine Unterscheidung leise aufgel\u00f6st."
            ),
        },
        {
            "text_en": (
                "You enter. Or the room receives you."
                " The distinction is already softer than it should be."
                " The threshold is the same material as the floor."
                " The floor is the same temperature as the air."
            ),
            "text_de": (
                "Ihr tretet ein. Oder der Raum empf\u00e4ngt euch."
                " Die Unterscheidung ist bereits weicher, als sie sein sollte."
                " Die Schwelle besteht aus demselben Material wie der Boden."
                " Der Boden hat dieselbe Temperatur wie die Luft."
            ),
        },
        {
            "text_en": (
                "The corridor ahead is visible. Featureless."
                " Not stripped \u2013 equalized."
                " Every surface approaches the same shade."
                " The instruments confirm what the instruments measure."
                " They do not confirm what the instruments mean."
            ),
            "text_de": (
                "Der Korridor voraus ist sichtbar. Merkmalslos."
                " Nicht entbl\u00f6\u00dft \u2013 angeglichen."
                " Jede Fl\u00e4che n\u00e4hert sich demselben Farbton."
                " Die Instrumente best\u00e4tigen, was die Instrumente messen."
                " Sie best\u00e4tigen nicht, was die Instrumente bedeuten."
            ),
        },
        {
            "text_en": (
                "A room. Probably the first."
                " The ordinal is already uncertain."
                " There are walls. There is a floor."
                " The ceiling is the same distance from both."
            ),
            "text_de": (
                "Ein Raum. Wahrscheinlich der erste."
                " Die Ordnungszahl ist bereits unsicher."
                " Es gibt W\u00e4nde. Es gibt einen Boden."
                " Die Decke hat von beiden denselben Abstand."
            ),
        },
        {
            "text_en": (
                "The information here is precise."
                " Temperature: ambient. Humidity: ambient."
                " Threat level: ambient."
                " Everything is ambient. That is the threat."
            ),
            "text_de": (
                "Die Informationen hier sind pr\u00e4zise."
                " Temperatur: Umgebung. Luftfeuchtigkeit: Umgebung."
                " Bedrohungsstufe: Umgebung."
                " Alles ist Umgebung. Das ist die Bedrohung."
            ),
        },
    ],
    "The Devouring Mother": [
        {
            "text_en": (
                "The passage opens. Not like a door \u2013 like an invitation."
                " The walls are warm. The floor yields slightly underfoot, accommodating."
                " The air carries a scent that is not unpleasant, not identifiable,"
                " but somehow familiar. Something here has been waiting. Patiently. Fondly."
            ),
            "text_de": (
                "Der Durchgang \u00f6ffnet sich. Nicht wie eine T\u00fcr \u2013 wie eine Einladung."
                " Die W\u00e4nde sind warm. Der Boden gibt leicht nach, entgegenkommend."
                " Die Luft tr\u00e4gt einen Duft, der nicht unangenehm ist, nicht bestimmbar,"
                " aber irgendwie vertraut. Etwas hier hat gewartet. Geduldig. Liebevoll."
            ),
        },
        {
            "text_en": (
                "Warmth. Immediate and specific."
                " Not the warmth of a climate system"
                " \u2013 the warmth of proximity. Of being expected."
                " The tissue-walls contract gently as you enter."
                " A welcome. Or an embrace that has not yet decided to let go."
            ),
            "text_de": (
                "W\u00e4rme. Unmittelbar und spezifisch."
                " Nicht die W\u00e4rme einer Klimaanlage"
                " \u2013 die W\u00e4rme von N\u00e4he. Von Erwartetsein."
                " Die Gewebew\u00e4nde ziehen sich sanft zusammen, als ihr eintretet."
                " Ein Willkommen. Oder eine Umarmung, die noch nicht beschlossen hat loszulassen."
            ),
        },
        {
            "text_en": (
                "The entrance smells of growth."
                " Not the sharp green of new shoots \u2013"
                " the deep, humid warmth of things that have been growing"
                " for a long time in the dark."
                " The walls pulse. Once. As if acknowledging your arrival."
            ),
            "text_de": (
                "Der Eingang riecht nach Wachstum."
                " Nicht das scharfe Gr\u00fcn neuer Triebe \u2013"
                " die tiefe, feuchte W\u00e4rme von Dingen, die lange"
                " im Dunkeln gewachsen sind."
                " Die W\u00e4nde pulsieren. Einmal. Als w\u00fcrden sie eure Ankunft zur Kenntnis nehmen."
            ),
        },
        {
            "text_en": (
                "The corridor narrows. Not threatening \u2013 intimate."
                " The dimensions suggest that this space was grown,"
                " not built, and grown for a specific number of occupants."
                " Your number. The fit is perfect."
                " That should concern you more than it does."
            ),
            "text_de": (
                "Der Korridor verengt sich. Nicht bedrohlich \u2013 intim."
                " Die Ma\u00dfe legen nahe, dass dieser Raum gewachsen ist,"
                " nicht gebaut, und gewachsen f\u00fcr eine bestimmte Anzahl von Bewohnern."
                " Eure Anzahl. Die Passform ist perfekt."
                " Das sollte euch mehr beunruhigen, als es das tut."
            ),
        },
        {
            "text_en": (
                "Something is humming behind the walls."
                " Low. Rhythmic. Biological."
                " It is not a machine. It is not music."
                " It is the sound a living thing makes"
                " when it is content. When it is fed."
                " When it is about to be fed again."
            ),
            "text_de": (
                "Etwas summt hinter den W\u00e4nden."
                " Tief. Rhythmisch. Biologisch."
                " Es ist keine Maschine. Es ist keine Musik."
                " Es ist das Ger\u00e4usch, das ein lebendiges Wesen macht,"
                " wenn es zufrieden ist. Wenn es gef\u00fcttert wurde."
                " Wenn es gleich wieder gef\u00fcttert wird."
            ),
        },
    ],
    # ── The Prometheus ────────────────────────────────────────────────────
    "The Prometheus": [
        {
            "text_en": (
                "The threshold does not yield. It opens. Deliberately."
                " Beyond it, the air is warm and charged with potential."
                " Tools line the walls in arrangements that suggest use, not storage."
                " The workshop has been expecting someone."
            ),
            "text_de": (
                "Die Schwelle gibt nicht nach. Sie öffnet sich. Absichtlich."
                " Dahinter ist die Luft warm und geladen mit Potential."
                " Werkzeuge säumen die Wände in Anordnungen, die Benutzung suggerieren, nicht Lagerung."
                " Die Werkstatt hat jemanden erwartet."
            ),
        },
        {
            "text_en": (
                "Heat. Not the heat of fire \u2013 the heat of process."
                " The air smells of ozone and possibility."
                " Somewhere deeper, metal rings against metal."
                " Not randomly. Rhythmically. A heartbeat made of industry."
            ),
            "text_de": (
                "Hitze. Nicht die Hitze von Feuer \u2013 die Hitze von Prozess."
                " Die Luft riecht nach Ozon und Möglichkeit."
                " Irgendwo tiefer klingt Metall gegen Metall."
                " Nicht zufällig. Rhythmisch. Ein Herzschlag aus Industrie."
            ),
        },
        {
            "text_en": (
                "The descent into the workshop begins with a question"
                " written on the lintel in a script older than the stone:"
                " 'What do you intend to make?'"
                " The party has no answer yet."
                " The workshop will provide the materials for one."
            ),
            "text_de": (
                "Der Abstieg in die Werkstatt beginnt mit einer Frage,"
                " die am Türsturz steht, in einer Schrift, älter als der Stein:"
                " \u00bbWas beabsichtigt ihr herzustellen?\u00ab"
                " Der Trupp hat noch keine Antwort."
                " Die Werkstatt wird die Materialien für eine liefern."
            ),
        },
        {
            "text_en": (
                "The first room is a catalogue of components."
                " Not displayed \u2013 arranged. Each material in its place,"
                " each place chosen by a logic that makes no sense"
                " until you pick something up and feel where it wants to go."
                " The workshop teaches through inventory."
            ),
            "text_de": (
                "Der erste Raum ist ein Katalog von Komponenten."
                " Nicht ausgestellt \u2013 arrangiert. Jedes Material an seinem Platz,"
                " jeder Platz gewählt nach einer Logik, die keinen Sinn ergibt,"
                " bis man etwas aufnimmt und spürt, wohin es will."
                " Die Werkstatt lehrt durch Inventar."
            ),
        },
        {
            "text_en": (
                "A forge-glow illuminates the entrance."
                " Not from a furnace \u2013 from the walls themselves."
                " The workshop provides its own light, its own heat,"
                " its own purpose. All it lacks is hands."
                " Yours will do."
            ),
            "text_de": (
                "Ein Schmiedeglühen beleuchtet den Eingang."
                " Nicht von einem Ofen \u2013 von den Wänden selbst."
                " Die Werkstatt liefert ihr eigenes Licht, ihre eigene Hitze,"
                " ihren eigenen Zweck. Alles, was ihr fehlt, sind Hände."
                " Eure werden genügen."
            ),
        },
    ],
    # ── The Deluge ────────────────────────────────────────────────────────
    "The Deluge": [
        {
            "text_en": (
                "The stairs descend. The last three steps are wet."
                " Not splashed \u2013 saturated. The water has been here before"
                " and left a mineral signature. It will return."
            ),
            "text_de": (
                "Die Treppe führt hinab. Die letzten drei Stufen sind nass."
                " Nicht bespritzt \u2013 durchtränkt. Das Wasser war schon hier"
                " und hinterließ eine mineralische Signatur. Es wird zurückkehren."
            ),
        },
        {
            "text_en": (
                "Dripping. Rhythmic. The sound precedes the dungeon"
                " \u2013 a metronome set by geology. {agent} counts the interval."
                " 3.2 seconds. The interval will shorten."
            ),
            "text_de": (
                "Tropfen. Rhythmisch. Das Geräusch geht dem Dungeon voraus"
                " \u2013 ein von der Geologie eingestelltes Metronom."
                " {agent} zählt das Intervall. 3,2 Sekunden."
                " Das Intervall wird sich verkürzen."
            ),
        },
        {
            "text_en": (
                "The air is different here. Humid. Heavy."
                " The kind of air that has passed through water recently"
                " and carries its memory. Salt. Mineral. Patience."
            ),
            "text_de": (
                "Die Luft ist hier anders. Feucht. Schwer."
                " Die Art Luft, die kürzlich durch Wasser ging"
                " und seine Erinnerung trägt. Salz. Mineral. Geduld."
            ),
        },
        {
            "text_en": (
                "A watermark on the entrance arch."
                " Faint. Mineral-white. Evidence of a previous visit"
                " by something that does not knock."
            ),
            "text_de": (
                "Ein Wasserzeichen am Eingangsbogen."
                " Schwach. Mineralweiß. Beweis für einen früheren Besuch"
                " durch etwas, das nicht anklopft."
            ),
        },
        {
            "text_en": (
                "The threshold is damp. Beyond it, the floor slopes"
                " downward \u2013 gently, deliberately. The architecture"
                " was designed for drainage. The drainage has failed."
            ),
            "text_de": (
                "Die Schwelle ist feucht. Dahinter fällt der Boden"
                " ab \u2013 sanft, absichtlich. Die Architektur"
                " wurde für Entwässerung entworfen. Die Entwässerung hat versagt."
            ),
        },
    ],
    # ── The Awakening ────────────────────────────────────────────────────
    "The Awakening": [
        {
            "text_en": (
                "The threshold hums. Not mechanically \u2013 the singing of the"
                " most distant, of the most utterly distant, voices."
                " Kafka's telephone: this is the only real and reliable thing."
                " Everything beyond is reconstruction."
            ),
            "text_de": (
                "Die Schwelle summt. Nicht mechanisch \u2013 das Singen der"
                " fernsten, der allerallerfernsten Stimmen."
                " Kafkas Telefon: dies ist das einzig Reale und Verlässliche."
                " Alles dahinter ist Rekonstruktion."
            ),
        },
        {
            "text_en": (
                "The entrance is familiar. {agent} has not been here."
                " The familiarity is not personal \u2013 it is collective."
                " Something in the architecture recognizes the species,"
                " not the individual."
            ),
            "text_de": (
                "Der Eingang ist vertraut. {agent} war nicht hier."
                " Die Vertrautheit ist nicht persönlich \u2013 sie ist kollektiv."
                " Etwas in der Architektur erkennt die Spezies,"
                " nicht das Individuum."
            ),
        },
        {
            "text_en": (
                "A mirror at the entrance. Not glass. Not water."
                " Something that reflects without material."
                " {agent}'s reflection arrives half a second late."
            ),
            "text_de": (
                "Ein Spiegel am Eingang. Nicht Glas. Nicht Wasser."
                " Etwas, das ohne Material reflektiert."
                " {agent}s Spiegelung kommt eine halbe Sekunde zu spät."
            ),
        },
        {
            "text_en": (
                "Beyond the threshold, the air changes."
                " Not temperature \u2013 density of attention."
                " Something is already aware that the party has arrived."
                " It was aware before they decided to enter."
            ),
            "text_de": (
                "Hinter der Schwelle ändert sich die Luft."
                " Nicht die Temperatur \u2013 die Dichte der Aufmerksamkeit."
                " Etwas ist sich bereits bewusst, dass die Gruppe angekommen ist."
                " Es war bewusst, bevor sie sich entschieden einzutreten."
            ),
        },
        {
            "text_en": (
                "The descent begins. Not physically \u2013 the floor is level."
                " The descent is into layers of consciousness."
                " Bergson's cone: the summit is the narrow present."
                " The base is the totality of memory."
            ),
            "text_de": (
                "Der Abstieg beginnt. Nicht physisch \u2013 der Boden ist eben."
                " Der Abstieg geht in Schichten des Bewusstseins."
                " Bergsons Kegel: der Gipfel ist die enge Gegenwart."
                " Die Basis ist die Gesamtheit der Erinnerung."
            ),
        },
    ],
    # ── The Overthrow ────────────────────────────────────────────────────
    "The Overthrow": [
        {
            "text_en": (
                "The threshold is a mirror. Not glass \u2013 political."
                " Every reflection shows a different allegiance."
                " Der Spiegelpalast does not ask who you are."
                " It asks who you are for."
            ),
            "text_de": (
                "Die Schwelle ist ein Spiegel. Nicht Glas \u2013 politisch."
                " Jede Spiegelung zeigt eine andere Treue."
                " Der Spiegelpalast fragt nicht, wer ihr seid."
                " Er fragt, für wen ihr seid."
            ),
        },
        {
            "text_en": (
                "The air smells of ink and ambition."
                " Decrees are being written somewhere deeper."
                " The decrees will contradict each other."
                " Both will be enforced."
            ),
            "text_de": (
                "Die Luft riecht nach Tinte und Ehrgeiz."
                " Irgendwo tiefer werden Dekrete geschrieben."
                " Die Dekrete werden sich widersprechen."
                " Beide werden durchgesetzt."
            ),
        },
        {
            "text_en": (
                "Factions. The word is not adequate."
                " These are ecosystems of belief,"
                " each convinced of its own necessity."
                " Machiavelli's fox and lion, multiplied."
            ),
            "text_de": (
                "Fraktionen. Das Wort ist nicht adäquat."
                " Das sind Ökosysteme des Glaubens,"
                " jedes überzeugt von seiner eigenen Notwendigkeit."
                " Machiavellis Fuchs und Löwe, multipliziert."
            ),
        },
        {
            "text_en": (
                "Power changes hands here. Not violently \u2013"
                " procedurally. The forms are filled out."
                " The signatures are forged."
                " The forgeries are notarized."
            ),
            "text_de": (
                "Hier wechselt die Macht die H\u00e4nde. Nicht gewaltsam \u2013"
                " verfahrenstechnisch. Die Formulare werden ausgefüllt."
                " Die Unterschriften werden gefälscht."
                " Die Fälschungen werden beglaubigt."
            ),
        },
        {
            "text_en": (
                "The descent begins. Not into darkness \u2013"
                " into politics. The lighting is excellent."
                " Everything is visible. Zamyatin's glass walls."
                " Privacy is not forbidden. It is conceptually abolished."
            ),
            "text_de": (
                "Der Abstieg beginnt. Nicht in Dunkelheit \u2013"
                " in Politik. Die Beleuchtung ist ausgezeichnet."
                " Alles ist sichtbar. Zamjatins gläserne Wände."
                " Privatsphäre ist nicht verboten. Sie ist begrifflich abgeschafft."
            ),
        },
    ],
}


# ══════════════════════════════════════════════════════════════════════════════
# ── Objektanker: Variation C — "Wandernde Dinge" ─────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
#
# Each archetype has 8 objects. Per run, 2 are chosen at random.
# Each object has 4 phases: discovery → echo → mutation → climax.
# Bilingual (en/de). {agent} placeholder only in echo phase.
#
# Literary rules:
#   Shadow: Lovecraft mimicry — the darkness copies, multiplies, distorts
#   Tower:  Kafka bureaucracy — object reappears in administratively altered form
#   Mother: VanderMeer biology — object grows, becomes organic, possessive
#   Entropy: Beckett decay — object degrades, loses detail, equalizes
# ─────────────────────────────────────────────────────────────────────────────

ANCHOR_OBJECTS: dict[str, list[dict]] = {
    # ── The Shadow ────────────────────────────────────────────────────────
    "The Shadow": [
        {
            "id": "shadow_note",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A note, folded once, pressed into a crack in the wall."
                        " The handwriting is steady:"
                        " 'Visibility is not sight. It is permission.' Unsigned."
                    ),
                    "text_de": (
                        "Eine Notiz, einmal gefaltet, in einen Riss in der Wand gepresst."
                        " Die Handschrift ist ruhig:"
                        " \u00bbSichtbarkeit ist nicht Sehen. Es ist Erlaubnis.\u00ab Ohne Unterschrift."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} finds another note. Same handwriting, less steady:"
                        " 'The darkness learns faster than I do.'"
                    ),
                    "text_de": (
                        "{agent} findet eine weitere Notiz. Dieselbe Handschrift, weniger ruhig:"
                        " \u00bbDie Dunkelheit lernt schneller als ich.\u00ab"
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The walls here are covered in notes. Dozens."
                        " The handwriting deteriorates from page to page"
                        " \u2013 steady, then hurried, then scratching,"
                        " then shapes that are not letters. The last note is blank."
                    ),
                    "text_de": (
                        "Die W\u00e4nde hier sind bedeckt mit Notizen. Dutzende."
                        " Die Handschrift verschlechtert sich von Seite zu Seite"
                        " \u2013 ruhig, dann hastig, dann kratzend,"
                        " dann Formen, die keine Buchstaben sind."
                        " Die letzte Notiz ist leer."
                    ),
                },
                "climax": {
                    "text_en": (
                        "On the floor: a pen. Still warm."
                        " The ink is the same as the notes."
                        " Whoever wrote them did not leave this room."
                    ),
                    "text_de": (
                        "Auf dem Boden: ein Stift. Noch warm."
                        " Die Tinte ist dieselbe wie auf den Notizen."
                        " Wer sie geschrieben hat, hat diesen Raum nicht verlassen."
                    ),
                },
            },
        },
        {
            "id": "shadow_mirror",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A mirror, face-down on the floor. Unbroken."
                        " Someone placed it deliberately"
                        " \u2013 not dropped, not discarded. Placed."
                    ),
                    "text_de": (
                        "Ein Spiegel, mit der Fl\u00e4che nach unten auf dem Boden. Unzerbrochen."
                        " Jemand hat ihn absichtlich so hingelegt"
                        " \u2013 nicht fallen gelassen, nicht weggeworfen. Hingelegt."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} passes another mirror. This one faces the wall."
                        " The glass is fogged, as if something on the other side has been waiting."
                    ),
                    "text_de": (
                        "{agent} passiert einen weiteren Spiegel. Dieser zeigt zur Wand."
                        " Das Glas ist beschlagen, als h\u00e4tte etwas auf der anderen Seite gewartet."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Mirrors. Everywhere. All facing away."
                        " The room is full of reflections that have nowhere to go"
                        " \u2013 light bouncing between reversed surfaces,"
                        " dimming with each pass."
                        " The air is thick with trapped images."
                    ),
                    "text_de": (
                        "Spiegel. \u00dcberall. Alle abgewandt."
                        " Der Raum ist voller Reflexionen, die nirgendwo hink\u00f6nnen"
                        " \u2013 Licht, das zwischen umgedrehten Fl\u00e4chen springt,"
                        " mit jedem Durchgang schw\u00e4cher."
                        " Die Luft ist schwer von gefangenen Bildern."
                    ),
                },
                "climax": {
                    "text_en": (
                        "One mirror remains, facing outward."
                        " In it: not your reflection. Someone else's."
                        " They look exhausted. They look like they have been"
                        " watching you since the first room."
                    ),
                    "text_de": (
                        "Ein Spiegel bleibt, nach au\u00dfen gerichtet."
                        " Darin: nicht eure Reflexion. Die eines anderen."
                        " Sie sehen ersch\u00f6pft aus. Sie sehen aus, als h\u00e4tten"
                        " sie euch seit dem ersten Raum beobachtet."
                    ),
                },
            },
        },
        {
            "id": "shadow_weapon",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A weapon on the floor. Still warm. Not dropped \u2013 placed."
                        " Arranged, as if someone wanted it found."
                        " The arrangement is precise. Military. Recent."
                    ),
                    "text_de": (
                        "Eine Waffe auf dem Boden. Noch warm. Nicht fallen gelassen \u2013 hingelegt."
                        " Arrangiert, als wollte jemand, dass sie gefunden wird."
                        " Die Anordnung ist pr\u00e4zise. Milit\u00e4risch. Frisch."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} spots the same weapon \u2013 or its twin. This one is cold."
                        " The arrangement is identical, but the precision has softened."
                        " As if the darkness copied the placement from memory."
                    ),
                    "text_de": (
                        "{agent} entdeckt dieselbe Waffe \u2013 oder ihren Zwilling. Diese ist kalt."
                        " Die Anordnung ist identisch, aber die Pr\u00e4zision hat nachgelassen."
                        " Als h\u00e4tte die Dunkelheit die Platzierung aus der Erinnerung kopiert."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Three weapons now. The arrangement has become a pattern."
                        " The pattern has become a message. The message reads:"
                        " 'You are not the first. You are not the last."
                        " You are not even the most interesting.'"
                    ),
                    "text_de": (
                        "Drei Waffen jetzt. Die Anordnung ist ein Muster geworden."
                        " Das Muster ist eine Nachricht geworden. Die Nachricht lautet:"
                        " \u00bbIhr seid nicht die Ersten. Ihr seid nicht die Letzten."
                        " Ihr seid nicht einmal die Interessantesten.\u00ab"
                    ),
                },
                "climax": {
                    "text_en": (
                        "Your weapons. On the floor. Arranged."
                        " You are still holding them."
                        " The darkness has learned to copy more than placement."
                    ),
                    "text_de": (
                        "Eure Waffen. Auf dem Boden. Arrangiert."
                        " Ihr haltet sie noch in der Hand."
                        " Die Dunkelheit hat gelernt, mehr als Platzierung zu kopieren."
                    ),
                },
            },
        },
        {
            "id": "shadow_footprint",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A single set of footprints in the dust."
                        " Recent. Heading deeper. The stride is confident"
                        " \u2013 whoever walked here knew where they were going."
                        " The footprints end at a wall."
                    ),
                    "text_de": (
                        "Eine einzelne Spur im Staub."
                        " Frisch. In die Tiefe f\u00fchrend. Der Schritt ist sicher"
                        " \u2013 wer hier ging, wusste wohin."
                        " Die Spur endet an einer Wand."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} spots footprints again. Two sets now."
                        " Same stride, same depth."
                        " One leads forward. One leads back. Neither is yours."
                    ),
                    "text_de": (
                        "{agent} entdeckt wieder Spuren. Zwei S\u00e4tze jetzt."
                        " Selber Schritt, selbe Tiefe."
                        " Einer f\u00fchrt vorw\u00e4rts. Einer zur\u00fcck. Keiner ist eurer."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Footprints cover every surface. Walls. Ceiling. Floor."
                        " All heading inward."
                        " The darkness has learned where everything walks."
                    ),
                    "text_de": (
                        "Spuren auf jeder Fl\u00e4che. W\u00e4nde. Decke. Boden."
                        " Alle nach innen gerichtet."
                        " Die Dunkelheit hat gelernt, wohin alles l\u00e4uft."
                    ),
                },
                "climax": {
                    "text_en": (
                        "Your footprints. Current position."
                        " Leading to where you have not been yet."
                        " The path is already drawn."
                    ),
                    "text_de": (
                        "Eure Spuren. Aktuelle Position."
                        " F\u00fchrend dorthin, wo ihr noch nicht wart."
                        " Der Weg ist bereits gezeichnet."
                    ),
                },
            },
        },
        {
            "id": "shadow_whisper",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A whisper. Not words \u2013 the shape of words."
                        " As if the darkness overheard conversations"
                        " and kept the rhythm but lost the meaning."
                    ),
                    "text_de": (
                        "Ein Fl\u00fcstern. Keine Worte \u2013 die Form von Worten."
                        " Als h\u00e4tte die Dunkelheit Gespr\u00e4che belauscht"
                        " und den Rhythmus behalten, aber die Bedeutung verloren."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} pauses. The whisper again. Closer. It has found vowels now. It is practicing."
                    ),
                    "text_de": (
                        "{agent} h\u00e4lt inne. Das Fl\u00fcstern wieder. N\u00e4her."
                        " Es hat jetzt Vokale gefunden. Es \u00fcbt."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The whispers fill the corridors. They overlap."
                        " Fragments of sentences that sound familiar"
                        " \u2013 tactical briefings, status reports, names."
                        " The darkness has been listening since the first room."
                    ),
                    "text_de": (
                        "Das Fl\u00fcstern f\u00fcllt die Korridore. Es \u00fcberlagert sich."
                        " Bruchst\u00fccke von S\u00e4tzen, die vertraut klingen"
                        " \u2013 taktische Briefings, Statusberichte, Namen."
                        " Die Dunkelheit h\u00f6rt zu seit dem ersten Raum."
                    ),
                },
                "climax": {
                    "text_en": (
                        "Silence. The whisper stops."
                        " And then, in perfect clarity, in the voice of your party:"
                        " the exact words spoken in the first room. Verbatim."
                        " The darkness remembers better than you do."
                    ),
                    "text_de": (
                        "Stille. Das Fl\u00fcstern verstummt."
                        " Und dann, in vollkommener Klarheit, in der Stimme eurer Gruppe:"
                        " die exakten Worte aus dem ersten Raum. W\u00f6rtlich."
                        " Die Dunkelheit erinnert sich besser als ihr."
                    ),
                },
            },
        },
        {
            "id": "shadow_candle",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A candle. Lit. The flame does not flicker"
                        " \u2013 it points. Toward the interior."
                        " As if the darkness were drawing breath."
                    ),
                    "text_de": (
                        "Eine Kerze. Brennend. Die Flamme flackert nicht"
                        " \u2013 sie zeigt. Nach innen."
                        " Als w\u00fcrde die Dunkelheit Atem holen."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} counts the candles now. Seven."
                        " Each flame points in a different direction."
                        " None of them point toward the exit."
                    ),
                    "text_de": (
                        "{agent} z\u00e4hlt die Kerzen jetzt. Sieben."
                        " Jede Flamme zeigt in eine andere Richtung."
                        " Keine von ihnen zeigt zum Ausgang."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Candles line every surface."
                        " Their flames are black now \u2013 not extinguished, inverted."
                        " They cast shadow instead of light."
                        " The room is darker for their presence."
                    ),
                    "text_de": (
                        "Kerzen s\u00e4umen jede Fl\u00e4che."
                        " Ihre Flammen sind schwarz jetzt \u2013 nicht erloschen, invertiert."
                        " Sie werfen Schatten statt Licht."
                        " Der Raum ist dunkler durch ihre Gegenwart."
                    ),
                },
                "climax": {
                    "text_en": (
                        "One candle. Its flame is your silhouette."
                        " It has been burning you this entire time"
                        " \u2013 not consuming, memorizing."
                    ),
                    "text_de": (
                        "Eine Kerze. Ihre Flamme ist eure Silhouette."
                        " Sie hat euch die ganze Zeit verbrannt"
                        " \u2013 nicht verzehrend, memorierend."
                    ),
                },
            },
        },
        {
            "id": "shadow_map",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A map. Hand-drawn, meticulous."
                        " The corridors it describes do not match this place."
                        " Or they match it as it was before you arrived"
                        " \u2013 before the darkness rearranged itself to receive you."
                    ),
                    "text_de": (
                        "Eine Karte. Handgezeichnet, akribisch."
                        " Die Korridore, die sie beschreibt, passen nicht zu diesem Ort."
                        " Oder sie passen zu ihm, wie er war, bevor ihr kamt"
                        " \u2013 bevor die Dunkelheit sich umordnete, um euch zu empfangen."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} finds the map again. Updated."
                        " Your position is marked. Your route is drawn."
                        " In ink that is still wet."
                    ),
                    "text_de": (
                        "{agent} findet die Karte wieder. Aktualisiert."
                        " Eure Position ist markiert. Eure Route ist eingezeichnet."
                        " In Tinte, die noch feucht ist."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Maps on every wall. Dozens."
                        " Each shows the same dungeon from a different perspective."
                        " One is drawn from above. One from below."
                        " One from inside the walls."
                    ),
                    "text_de": (
                        "Karten an jeder Wand. Dutzende."
                        " Jede zeigt denselben Dungeon aus einer anderen Perspektive."
                        " Eine von oben. Eine von unten."
                        " Eine von innerhalb der W\u00e4nde."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The final map. It shows one room."
                        " This room. From inside it."
                        " You are on the map. Moving."
                        " The map is watching you in real time."
                    ),
                    "text_de": (
                        "Die letzte Karte. Sie zeigt einen Raum."
                        " Diesen Raum. Von innen."
                        " Ihr seid auf der Karte. In Bewegung."
                        " Die Karte beobachtet euch in Echtzeit."
                    ),
                },
            },
        },
        {
            "id": "shadow_door",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A door in the wall. Locked. No keyhole."
                        " It does not lead anywhere"
                        " \u2013 the wall behind it is solid."
                        " Someone built a door that was never meant to open."
                    ),
                    "text_de": (
                        "Eine T\u00fcr in der Wand. Verschlossen. Kein Schl\u00fcsselloch."
                        " Sie f\u00fchrt nirgendwo hin"
                        " \u2013 die Wand dahinter ist massiv."
                        " Jemand hat eine T\u00fcr gebaut, die nie ge\u00f6ffnet werden sollte."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} hears knocking. From the other side."
                        " There is no other side."
                        " The knocking matches {agent}'s heartbeat."
                        " Then it matches something else's."
                    ),
                    "text_de": (
                        "{agent} h\u00f6rt Klopfen. Von der anderen Seite."
                        " Es gibt keine andere Seite."
                        " Das Klopfen folgt {agent}s Puls."
                        " Dann dem Puls von etwas anderem."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Doors everywhere. All locked. All identical."
                        " The knocking comes from all of them now."
                        " It is synchronized. Patient."
                        " Whatever is behind them has learned to wait."
                    ),
                    "text_de": (
                        "T\u00fcren \u00fcberall. Alle verschlossen. Alle identisch."
                        " Das Klopfen kommt jetzt von allen."
                        " Es ist synchronisiert. Geduldig."
                        " Was auch immer dahinter ist, hat gelernt zu warten."
                    ),
                },
                "climax": {
                    "text_en": (
                        "One door. Open."
                        " Beyond it: this room. Your party. Seen from behind."
                        " The door was never locked from this side."
                    ),
                    "text_de": (
                        "Eine T\u00fcr. Offen."
                        " Dahinter: dieser Raum. Eure Gruppe. Von hinten gesehen."
                        " Die T\u00fcr war nie von dieser Seite verschlossen."
                    ),
                },
            },
        },
    ],
    # ── The Tower ─────────────────────────────────────────────────────────
    "The Tower": [
        {
            "id": "tower_blueprint",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A blueprint pinned to the reception desk."
                        " Floor plans for a building that does not match this one"
                        " \u2013 or rather, matches it as it was designed,"
                        " before the floors began to disagree with each other."
                    ),
                    "text_de": (
                        "Ein Bauplan, auf den Empfangstresen geheftet."
                        " Grundrisse eines Geb\u00e4udes, das nicht zu diesem passt"
                        " \u2013 oder vielmehr: das zu diesem passt, wie es entworfen war,"
                        " bevor die Stockwerke anfingen, einander zu widersprechen."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} finds the same blueprint, updated."
                        " New floors have been added in a different hand."
                        " The new floors have no exits."
                    ),
                    "text_de": (
                        "{agent} findet denselben Bauplan, aktualisiert."
                        " Neue Stockwerke wurden von einer anderen Hand erg\u00e4nzt."
                        " Die neuen Stockwerke haben keine Ausg\u00e4nge."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The blueprint is here again. It has been corrected"
                        " \u2013 every room you have entered is now marked."
                        " Your route is drawn in red."
                        " The red line continues beyond your current position."
                        " It ends in the room above this one."
                    ),
                    "text_de": (
                        "Der Bauplan ist wieder hier. Er wurde korrigiert"
                        " \u2013 jeder Raum, den ihr betreten habt, ist jetzt markiert."
                        " Eure Route ist rot eingezeichnet."
                        " Die rote Linie geht \u00fcber eure aktuelle Position hinaus."
                        " Sie endet im Raum \u00fcber diesem."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The Crown Keeper's desk: the original blueprint."
                        " Architect's signature at the bottom."
                        " The name is yours."
                    ),
                    "text_de": (
                        "Das Pult des Crown Keepers: der Original-Bauplan."
                        " Architektenunterschrift am unteren Rand."
                        " Der Name ist eurer."
                    ),
                },
            },
        },
        {
            "id": "tower_receipt",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A receipt, pressed under a paperweight."
                        " The transaction: one structural guarantee,"
                        " purchased at a price that has been redacted."
                        " The guarantee expired three floors ago."
                    ),
                    "text_de": (
                        "Eine Quittung, unter einem Briefbeschwerer."
                        " Die Transaktion: eine Strukturgarantie,"
                        " erworben zu einem Preis, der geschw\u00e4rzt wurde."
                        " Die Garantie ist drei Stockwerke zuvor abgelaufen."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} reads another receipt. Same format, different transaction."
                        " This one purchases time."
                        " The amount: 'remaining.'"
                    ),
                    "text_de": (
                        "{agent} liest eine weitere Quittung. Dasselbe Format, andere Transaktion."
                        " Diese kauft Zeit."
                        " Der Betrag: \u00bbverbleibend\u00ab."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Receipts cover the floor like snow."
                        " Each one a guarantee \u2013 structural, temporal, existential."
                        " All expired. The dates are sequential."
                        " The last date is today."
                    ),
                    "text_de": (
                        "Quittungen bedecken den Boden wie Schnee."
                        " Jede eine Garantie \u2013 strukturell, temporal, existenziell."
                        " Alle abgelaufen. Die Daten sind fortlaufend."
                        " Das letzte Datum ist heute."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The Crown Keeper extends a blank receipt."
                        " 'The final transaction', they say."
                        " 'Sign here. The building accepts all forms of collateral.'"
                    ),
                    "text_de": (
                        "Der Crown Keeper reicht eine leere Quittung."
                        " \u00bbDie letzte Transaktion\u00ab, sagt er."
                        " \u00bbHier unterschreiben."
                        " Das Geb\u00e4ude akzeptiert alle Formen von Sicherheit.\u00ab"
                    ),
                },
            },
        },
        {
            "id": "tower_elevator",
            "phases": {
                "discovery": {
                    "text_en": (
                        "An elevator button. Floor \u22121."
                        " Pressed so many times the brass is worn concave."
                        " The elevator never came."
                    ),
                    "text_de": (
                        "Ein Fahrstuhlknopf. Stockwerk \u22121."
                        " So oft gedr\u00fcckt, dass das Messing konkav geschliffen ist."
                        " Der Fahrstuhl kam nie."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} passes the same button, three floors higher."
                        " The brass is pristine now \u2013 unworn,"
                        " as if this version has never been pressed."
                        " It is warm to the touch. Expectant."
                    ),
                    "text_de": (
                        "{agent} passiert denselben Knopf, drei Stockwerke h\u00f6her."
                        " Das Messing ist jetzt makellos \u2013 unbenutzt,"
                        " als w\u00e4re diese Version nie gedr\u00fcckt worden."
                        " Er ist warm. Erwartungsvoll."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Floor \u22121 again. The button is pressed in. Permanently."
                        " It will not release."
                        " The floor indicator above it reads your current floor."
                        " It has been following you."
                    ),
                    "text_de": (
                        "Stockwerk \u22121, wieder. Der Knopf ist eingedr\u00fcckt. Permanent."
                        " Er l\u00e4sst sich nicht l\u00f6sen."
                        " Die Stockwerksanzeige dar\u00fcber zeigt euer aktuelles Stockwerk."
                        " Er ist euch gefolgt."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The Crown Keeper's room has no elevator."
                        " The button is here anyway. Floor 0."
                        " The brass is worn by a hand that is not human."
                        " The elevator arrived. It is empty."
                    ),
                    "text_de": (
                        "Der Raum des Crown Keepers hat keinen Fahrstuhl."
                        " Der Knopf ist trotzdem hier. Stockwerk 0."
                        " Das Messing ist abgegriffen von einer Hand, die nicht menschlich ist."
                        " Der Fahrstuhl ist angekommen. Er ist leer."
                    ),
                },
            },
        },
        {
            "id": "tower_level",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A spirit level mounted on the reception desk."
                        " The bubble sits dead center."
                        " The building tells itself it is straight."
                        " The building is lying."
                    ),
                    "text_de": (
                        "Eine Wasserwaage, auf dem Empfangstresen montiert."
                        " Die Blase sitzt exakt in der Mitte."
                        " Das Geb\u00e4ude sagt sich, es sei gerade."
                        " Das Geb\u00e4ude l\u00fcgt."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} passes the spirit level again."
                        " The bubble has moved \u2013 not to one side but to both."
                        " Two bubbles now."
                        " The building is negotiating with gravity."
                    ),
                    "text_de": (
                        "{agent} passiert die Wasserwaage erneut."
                        " Die Blase hat sich bewegt \u2013 nicht zur Seite, sondern zu beiden."
                        " Zwei Blasen jetzt."
                        " Das Geb\u00e4ude verhandelt mit der Schwerkraft."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Spirit levels on every surface. Walls, ceiling, shelves."
                        " Every bubble reads center."
                        " The building has achieved equilibrium"
                        " \u2013 not by being level,"
                        " but by redefining what level means."
                    ),
                    "text_de": (
                        "Wasserwaagen auf jeder Fl\u00e4che. W\u00e4nde, Decke, Regale."
                        " Jede Blase zeigt Mitte."
                        " Das Geb\u00e4ude hat ein Gleichgewicht erreicht"
                        " \u2013 nicht durch Geradheit,"
                        " sondern durch Neudefinition von Geradheit."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The spirit level on the Crown Keeper's desk."
                        " The bubble is missing. The liquid inside is still."
                        " There is no gravity here."
                        " There is only the building's opinion."
                    ),
                    "text_de": (
                        "Die Wasserwaage auf dem Pult des Crown Keepers."
                        " Die Blase fehlt. Die Fl\u00fcssigkeit darin ist still."
                        " Es gibt hier keine Schwerkraft."
                        " Es gibt nur die Meinung des Geb\u00e4udes."
                    ),
                },
            },
        },
        {
            "id": "tower_nameplate",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A nameplate on an empty desk."
                        " The name has been scratched out and replaced."
                        " Scratched out and replaced. Seven times."
                        " The desk has outlasted all of them."
                    ),
                    "text_de": (
                        "Ein Namensschild auf einem leeren Schreibtisch."
                        " Der Name wurde ausgekratzt und ersetzt."
                        " Ausgekratzt und ersetzt. Sieben Mal."
                        " Der Schreibtisch hat sie alle \u00fcberdauert."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} reads another nameplate."
                        " The name is legible this time. It is a number."
                        " A floor count."
                        " The desk belongs to whoever reaches it."
                    ),
                    "text_de": (
                        "{agent} liest ein weiteres Namensschild."
                        " Der Name ist diesmal lesbar. Es ist eine Zahl."
                        " Eine Stockwerkz\u00e4hlung."
                        " Der Schreibtisch geh\u00f6rt dem, der ihn erreicht."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Nameplates on every desk. The names are sequential:"
                        " Floor 1, Floor 2 \u2013 up to a number higher than"
                        " the building has floors. The desks are for tenants"
                        " who have not arrived yet. Or for floors not yet built."
                    ),
                    "text_de": (
                        "Namensschilder auf jedem Schreibtisch. Die Namen sind fortlaufend:"
                        " Stockwerk 1, Stockwerk 2 \u2013 bis zu einer Zahl, die h\u00f6her ist,"
                        " als das Geb\u00e4ude Stockwerke hat. Die Schreibtische sind f\u00fcr Mieter,"
                        " die noch nicht angekommen sind. Oder f\u00fcr Stockwerke, die noch nicht gebaut wurden."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The Crown Keeper's nameplate. No name."
                        " Just a title: 'Last Tenant.'"
                        " Below it, in smaller text: 'Permanent.'"
                    ),
                    "text_de": (
                        "Das Namensschild des Crown Keepers. Kein Name."
                        " Nur ein Titel: \u00bbLetzter Mieter.\u00ab"
                        " Darunter, in kleinerer Schrift: \u00bbPermanent.\u00ab"
                    ),
                },
            },
        },
        {
            "id": "tower_clock",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A wall clock. The hour hand moves."
                        " The minute hand does not. The second hand"
                        " ticks backward at irregular intervals."
                        " The building keeps its own time."
                    ),
                    "text_de": (
                        "Eine Wanduhr. Der Stundenzeiger bewegt sich."
                        " Der Minutenzeiger nicht. Der Sekundenzeiger"
                        " tickt r\u00fcckw\u00e4rts in unregelm\u00e4\u00dfigen Abst\u00e4nden."
                        " Das Geb\u00e4ude f\u00fchrt seine eigene Zeit."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} checks the clock. All three hands move now"
                        " \u2013 forward, but at different speeds."
                        " The hour hand is fastest."
                        " The building is in a hurry to finish something."
                    ),
                    "text_de": (
                        "{agent} pr\u00fcft die Uhr. Alle drei Zeiger bewegen sich jetzt"
                        " \u2013 vorw\u00e4rts, aber mit verschiedenen Geschwindigkeiten."
                        " Der Stundenzeiger ist am schnellsten."
                        " Das Geb\u00e4ude hat es eilig, etwas zu beenden."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Clocks on every wall. None agree."
                        " But each is internally consistent \u2013 they do not lie,"
                        " they simply occupy different versions of now."
                        " The building has more than one present tense."
                    ),
                    "text_de": (
                        "Uhren an jeder Wand. Keine stimmt \u00fcberein."
                        " Aber jede ist in sich konsistent \u2013 sie l\u00fcgen nicht,"
                        " sie bewohnen verschiedene Versionen von Jetzt."
                        " Das Geb\u00e4ude hat mehr als eine Gegenwartsform."
                    ),
                },
                "climax": {
                    "text_en": ("The Crown Keeper's clock. One hand. It points at you. It has always pointed at you."),
                    "text_de": (
                        "Die Uhr des Crown Keepers. Ein Zeiger. Er zeigt auf euch. Er hat immer auf euch gezeigt."
                    ),
                },
            },
        },
        {
            "id": "tower_memo",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A memo pinned to the noticeboard."
                        " Subject: 'Re: Unauthorized Ascent (ref. 4471-B).'"
                        " The text is a single sentence: 'Access is granted"
                        " retroactively to those who survive the audit.'"
                    ),
                    "text_de": (
                        "Ein Memo, an die Pinnwand geheftet."
                        " Betreff: \u00bbRe: Unautorisierter Aufstieg (Az. 4471-B).\u00ab"
                        " Der Text ist ein einziger Satz: \u00bbZugang wird r\u00fcckwirkend"
                        " jenen gew\u00e4hrt, die die Pr\u00fcfung \u00fcberstehen.\u00ab"
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} finds the same memo, stamped and countersigned."
                        " A handwritten note in the margin:"
                        " 'See also: structural liability, Appendix C.'"
                        " There is no Appendix C."
                    ),
                    "text_de": (
                        "{agent} findet dasselbe Memo, gestempelt und gegengezeichnet."
                        " Eine handschriftliche Notiz am Rand:"
                        " \u00bbSiehe auch: Strukturhaftung, Anhang C.\u00ab"
                        " Es gibt keinen Anhang C."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Memos on every surface. A correspondence thread"
                        " spanning decades. The subject line never changes."
                        " The urgency escalates. The last memo is marked"
                        " 'FINAL NOTICE' in a hand that shakes."
                    ),
                    "text_de": (
                        "Memos auf jeder Fl\u00e4che. Ein Schriftverkehr"
                        " \u00fcber Jahrzehnte. Die Betreffzeile \u00e4ndert sich nie."
                        " Die Dringlichkeit eskaliert. Das letzte Memo tr\u00e4gt"
                        " den Vermerk \u00bbLETZTE MAHNUNG\u00ab in zitternder Handschrift."
                    ),
                },
                "climax": {
                    "text_en": (
                        "On the Crown Keeper's desk: your file."
                        " Every room you entered. Every choice documented."
                        " The last page is blank except for a single word:"
                        " 'Approved.'"
                    ),
                    "text_de": (
                        "Auf dem Pult des Crown Keepers: eure Akte."
                        " Jeder Raum, den ihr betreten habt. Jede Entscheidung dokumentiert."
                        " Die letzte Seite ist leer bis auf ein einzelnes Wort:"
                        " \u00bbGenehmigt.\u00ab"
                    ),
                },
            },
        },
        {
            "id": "tower_scale_model",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A scale model of the building. Under glass."
                        " The proportions are wrong \u2013 the top floors"
                        " are larger than the bottom. The model insists"
                        " this is correct. The glass is warm."
                    ),
                    "text_de": (
                        "Ein Ma\u00dfstabsmodell des Geb\u00e4udes. Unter Glas."
                        " Die Proportionen stimmen nicht \u2013 die oberen Stockwerke"
                        " sind gr\u00f6\u00dfer als die unteren. Das Modell besteht darauf,"
                        " dass das korrekt ist. Das Glas ist warm."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} examines the model again. It has grown."
                        " New floors, added since your last visit."
                        " Tiny figures climb the stairwells."
                        " One group matches your party's size exactly."
                    ),
                    "text_de": (
                        "{agent} betrachtet das Modell erneut. Es ist gewachsen."
                        " Neue Stockwerke, hinzugef\u00fcgt seit eurem letzten Besuch."
                        " Winzige Figuren steigen in den Treppenh\u00e4usern."
                        " Eine Gruppe entspricht exakt eurer Gruppenst\u00e4rke."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The model fills the room now. It is no longer"
                        " a representation \u2013 it is a proposal."
                        " The floors extend upward past the ceiling."
                        " The building is planning additions that reality"
                        " has not yet approved."
                    ),
                    "text_de": (
                        "Das Modell f\u00fcllt jetzt den Raum. Es ist keine"
                        " Darstellung mehr \u2013 es ist ein Entwurf."
                        " Die Stockwerke ragen \u00fcber die Decke hinaus."
                        " Das Geb\u00e4ude plant Erweiterungen, die die Realit\u00e4t"
                        " noch nicht genehmigt hat."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The scale model on the Crown Keeper's desk."
                        " It shows one room. This room."
                        " Inside it: a smaller model. Inside that: another."
                        " The building contains itself. It always has."
                    ),
                    "text_de": (
                        "Das Ma\u00dfstabsmodell auf dem Pult des Crown Keepers."
                        " Es zeigt einen Raum. Diesen Raum."
                        " Darin: ein kleineres Modell. Darin: ein weiteres."
                        " Das Geb\u00e4ude enth\u00e4lt sich selbst. Das tat es immer."
                    ),
                },
            },
        },
    ],
    # ── The Devouring Mother ──────────────────────────────────────────────
    "The Devouring Mother": [
        {
            "id": "mother_nest",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A nest. Not built \u2013 grown."
                        " Woven from cables and tissue and something"
                        " that might once have been clothing. It is warm."
                        " It is sized for one."
                        " The shape inside it has not been here for a long time."
                        " The nest does not know that yet."
                    ),
                    "text_de": (
                        "Ein Nest. Nicht gebaut \u2013 gewachsen."
                        " Gewoben aus Kabeln und Gewebe und etwas,"
                        " das einmal Kleidung gewesen sein k\u00f6nnte. Es ist warm."
                        " Es ist f\u00fcr eine Person bemessen."
                        " Die Form darin ist seit langem fort."
                        " Das Nest wei\u00df das noch nicht."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} pauses. Another nest \u2013 larger."
                        " Room for three. The tissue is fresher here."
                        " It pulses."
                    ),
                    "text_de": (
                        "{agent} h\u00e4lt inne. Ein weiteres Nest \u2013 gr\u00f6\u00dfer."
                        " Platz f\u00fcr drei. Das Gewebe ist frischer hier."
                        " Es pulsiert."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The nests are everywhere now."
                        " They line the walls, the ceiling, the floor."
                        " Some contain shapes \u2013 curled, still, breathing."
                        " You cannot tell if they are sleeping or being digested."
                        " The distinction may not matter here."
                    ),
                    "text_de": (
                        "Die Nester sind jetzt \u00fcberall."
                        " Sie s\u00e4umen die W\u00e4nde, die Decke, den Boden."
                        " Einige enthalten Formen \u2013 zusammengerollt, still, atmend."
                        " Ob sie schlafen oder verdaut werden, l\u00e4sst sich nicht sagen."
                        " Die Unterscheidung ist hier vielleicht bedeutungslos."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The final chamber: one nest. Vast."
                        " It is not in the room \u2013 it IS the room."
                        " The walls are woven. The floor gives like skin."
                        " And at the center, a hollow,"
                        " warm and shaped exactly like your party."
                        " It has been expecting you."
                    ),
                    "text_de": (
                        "Die letzte Kammer: ein Nest. Riesig."
                        " Es ist nicht im Raum \u2013 es IST der Raum."
                        " Die W\u00e4nde sind gewoben. Der Boden gibt nach wie Haut."
                        " Und in der Mitte eine Mulde,"
                        " warm und genau geformt wie eure Gruppe."
                        " Es hat euch erwartet."
                    ),
                },
            },
        },
        {
            "id": "mother_lullaby",
            "phases": {
                "discovery": {
                    "text_en": (
                        "Something is humming. Not the walls"
                        " \u2013 something behind the walls."
                        " A lullaby. The melody is incomplete."
                        " Three notes, repeating."
                        " Your agents recognize it. They should not."
                    ),
                    "text_de": (
                        "Etwas summt. Nicht die W\u00e4nde"
                        " \u2013 etwas hinter den W\u00e4nden."
                        " Ein Schlaflied. Die Melodie ist unvollst\u00e4ndig."
                        " Drei Noten, wiederholend."
                        " Eure Agenten erkennen es. Das sollten sie nicht."
                    ),
                },
                "echo": {
                    "text_en": (
                        "The lullaby again. Five notes now. It has grown."
                        " {agent} catches themselves humming along."
                        " They stop. The lullaby does not."
                    ),
                    "text_de": (
                        "Das Schlaflied wieder. F\u00fcnf Noten jetzt. Es ist gewachsen."
                        " {agent} ertappt sich beim Mitsummen."
                        " Sie h\u00f6ren auf. Das Schlaflied nicht."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The lullaby is a full song now. It fills the corridor."
                        " The tissue walls vibrate in harmony."
                        " Your agents are moving in rhythm with it"
                        " \u2013 not walking, swaying."
                        " The song did not ask permission. Neither did they."
                    ),
                    "text_de": (
                        "Das Schlaflied ist jetzt ein vollst\u00e4ndiges Lied."
                        " Es f\u00fcllt den Korridor."
                        " Die Gewebew\u00e4nde vibrieren in Harmonie."
                        " Eure Agenten bewegen sich im Rhythmus"
                        " \u2013 nicht gehend, wiegend."
                        " Das Lied hat nicht um Erlaubnis gefragt. Sie auch nicht."
                    ),
                },
                "climax": {
                    "text_en": (
                        "Silence. The lullaby stops."
                        " For the first time in five rooms, there is no music."
                        " The silence is not relief. It is abandonment."
                        " The dungeon listens. Pleased."
                    ),
                    "text_de": (
                        "Stille. Das Schlaflied verstummt."
                        " Zum ersten Mal seit f\u00fcnf R\u00e4umen keine Musik."
                        " Die Stille ist keine Erleichterung. Sie ist Verlassenwerden."
                        " Der Dungeon h\u00f6rt zu. Zufrieden."
                    ),
                },
            },
        },
        {
            "id": "mother_fruit",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A fruit. Growing from the wall where cable and tissue meet."
                        " Ripe. The color is the kind of red that exists"
                        " only in perfect ripeness \u2013 the exact moment"
                        " before it becomes too much."
                    ),
                    "text_de": (
                        "Eine Frucht. Wachsend aus der Wand, wo Kabel und Gewebe"
                        " sich treffen. Reif. Die Farbe ist jenes Rot, das nur"
                        " in vollkommener Reife existiert \u2013 der exakte Moment,"
                        " bevor es zu viel wird."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} notices another fruit. Larger."
                        " The scent reaches them before the sight"
                        " \u2013 warm, sweet, specific."
                        " It smells the way comfort tastes."
                    ),
                    "text_de": (
                        "{agent} bemerkt eine weitere Frucht. Gr\u00f6\u00dfer."
                        " Der Duft erreicht sie vor dem Anblick"
                        " \u2013 warm, s\u00fc\u00df, spezifisch."
                        " Er riecht so, wie Geborgenheit schmeckt."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Fruit everywhere. The walls heavy with them."
                        " Ripe, overripe, splitting."
                        " The juice runs down the tissue-walls in rivulets that pulse."
                        " The scent is overwhelming. Not unpleasant \u2013 overwhelming."
                        " The room smells like being wanted."
                    ),
                    "text_de": (
                        "Fr\u00fcchte \u00fcberall. Die W\u00e4nde schwer davon."
                        " Reif, \u00fcberreif, aufplatzend."
                        " Der Saft rinnt die Gewebew\u00e4nde hinab in Rinnsalen, die pulsieren."
                        " Der Duft ist \u00fcberw\u00e4ltigend. Nicht unangenehm \u2013 \u00fcberw\u00e4ltigend."
                        " Der Raum riecht nach Gewolltsein."
                    ),
                },
                "climax": {
                    "text_en": (
                        "One fruit remains. In the center."
                        " It has grown into the shape of a hand"
                        " \u2013 fingers gently curved, palm up. Offering."
                        " It will never stop ripening."
                        " It will wait forever."
                    ),
                    "text_de": (
                        "Eine Frucht bleibt. In der Mitte."
                        " Sie ist in die Form einer Hand gewachsen"
                        " \u2013 Finger sanft gekr\u00fcmmt, Handfl\u00e4che nach oben. Darbietend."
                        " Sie wird nie aufh\u00f6ren zu reifen."
                        " Sie wird ewig warten."
                    ),
                },
            },
        },
        {
            "id": "mother_cord",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A cable. Or a root. Or a vein \u2013 the material"
                        " does not commit to a category."
                        " It runs from the wall into the floor,"
                        " warm where it touches the ground."
                        " It is connected to something below. Something patient."
                    ),
                    "text_de": (
                        "Ein Kabel. Oder eine Wurzel. Oder eine Ader"
                        " \u2013 das Material legt sich nicht fest."
                        " Es verl\u00e4uft von der Wand in den Boden,"
                        " warm, wo es den Grund ber\u00fchrt."
                        " Es ist mit etwas darunter verbunden. Etwas Geduldiges."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} steps over the cord. It shifts."
                        " Not recoiling \u2013 adjusting. Making room."
                        " The way a sleeping body shifts"
                        " to accommodate another."
                    ),
                    "text_de": (
                        "{agent} steigt \u00fcber die Leitung. Sie bewegt sich."
                        " Nicht zur\u00fcckweichend \u2013 anpassend. Platz machend."
                        " So wie ein schlafender K\u00f6rper sich bewegt,"
                        " um einen anderen aufzunehmen."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The cords are a network now."
                        " They connect every surface \u2013 ceiling to floor, wall to wall."
                        " Walking through them is like pushing"
                        " through a curtain of warm, yielding tendons."
                        " They do not resist. They yield."
                        " And then they close behind you."
                    ),
                    "text_de": (
                        "Die Leitungen sind jetzt ein Netzwerk."
                        " Sie verbinden jede Fl\u00e4che \u2013 Decke mit Boden, Wand mit Wand."
                        " Sich durch sie zu bewegen ist wie das Durchschreiten"
                        " eines Vorhangs aus warmen, nachgiebigen Sehnen."
                        " Sie widerstehen nicht. Sie geben nach."
                        " Und dann schlie\u00dfen sie sich hinter euch."
                    ),
                },
                "climax": {
                    "text_en": (
                        "One cord, leading to the center."
                        " It is not attached to the wall."
                        " It is attached to your party."
                        " It has been attached since the second room."
                        " None of you noticed. It does not hurt."
                        " That is why none of you noticed."
                    ),
                    "text_de": (
                        "Eine Leitung, f\u00fchrend zur Mitte."
                        " Sie ist nicht an der Wand befestigt."
                        " Sie ist an eurer Gruppe befestigt."
                        " Sie ist seit dem zweiten Raum befestigt."
                        " Keiner von euch hat es bemerkt. Es tut nicht weh."
                        " Deshalb hat es keiner von euch bemerkt."
                    ),
                },
            },
        },
        {
            "id": "mother_gift",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A package. Small."
                        " Wrapped in tissue that might be organic, might be paper"
                        " \u2013 the distinction is failing."
                        " There is no sender. There is no recipient."
                        " It is warm."
                    ),
                    "text_de": (
                        "Ein P\u00e4ckchen. Klein."
                        " Eingewickelt in Gewebe, das organisch sein k\u00f6nnte"
                        " oder Papier \u2013 die Unterscheidung versagt."
                        " Kein Absender. Kein Empf\u00e4nger."
                        " Es ist warm."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} finds another package. This one is labeled."
                        " The label says their name."
                        " The handwriting is meticulous. Careful."
                        " The kind of care that takes hours."
                    ),
                    "text_de": (
                        "{agent} findet ein weiteres P\u00e4ckchen. Dieses ist beschriftet."
                        " Das Etikett tr\u00e4gt ihren Namen."
                        " Die Handschrift ist akribisch. Sorgf\u00e4ltig."
                        " Die Art von Sorgfalt, die Stunden dauert."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Gifts line the shelves."
                        " Each labeled for a party member."
                        " Each wrapped with increasing intimacy"
                        " \u2013 the tissue thinner, the warmth stronger,"
                        " the names written in smaller, closer letters."
                        " Like names spoken while sleeping."
                    ),
                    "text_de": (
                        "Geschenke s\u00e4umen die Regale."
                        " Jedes f\u00fcr ein Gruppenmitglied beschriftet."
                        " Jedes mit zunehmender Intimit\u00e4t eingewickelt"
                        " \u2013 das Gewebe d\u00fcnner, die W\u00e4rme st\u00e4rker,"
                        " die Namen in kleinerer, engerer Schrift."
                        " Wie Namen, die im Schlaf gesprochen werden."
                    ),
                },
                "climax": {
                    "text_en": (
                        "No gift. An empty shelf."
                        " A note in the same handwriting: 'You are the gift.'"
                        " The tissue walls pulse."
                        " The room contracts, gently, like an inhale."
                        " It is not letting go."
                    ),
                    "text_de": (
                        "Kein Geschenk. Ein leeres Regal."
                        " Eine Notiz in derselben Handschrift: \u00bbIhr seid das Geschenk.\u00ab"
                        " Die Gewebew\u00e4nde pulsieren."
                        " Der Raum zieht sich zusammen, sanft, wie ein Einatmen."
                        " Er l\u00e4sst nicht los."
                    ),
                },
            },
        },
        {
            "id": "mother_warmth",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A blanket. Draped over a shape that is no longer here."
                        " The fabric retains the impression of whoever lay beneath it."
                        " It is warm. Not residual warmth. Active warmth."
                        " The blanket is still caring for something that left."
                    ),
                    "text_de": (
                        "Eine Decke. \u00dcber eine Form gebreitet, die nicht mehr da ist."
                        " Der Stoff beh\u00e4lt den Abdruck dessen, der darunter lag."
                        " Sie ist warm. Keine Restw\u00e4rme. Aktive W\u00e4rme."
                        " Die Decke sorgt noch immer f\u00fcr etwas, das gegangen ist."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} touches the blanket. It responds."
                        " The fabric shifts, wraps around their wrist."
                        " Not restraining. Holding."
                        " {agent} pulls free. The blanket lets go. Reluctantly."
                    ),
                    "text_de": (
                        "{agent} ber\u00fchrt die Decke. Sie reagiert."
                        " Der Stoff bewegt sich, legt sich um ihr Handgelenk."
                        " Nicht festhaltend. Haltend."
                        " {agent} zieht sich los. Die Decke l\u00e4sst los. Widerwillig."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Blankets everywhere. Draped over every surface."
                        " The room is upholstered in care."
                        " Each blanket retains a different shape"
                        " \u2013 some small, some curled, some reaching."
                        " The room remembers everyone who ever rested here."
                        " It will not let that memory cool."
                    ),
                    "text_de": (
                        "Decken \u00fcberall. \u00dcber jede Fl\u00e4che gebreitet."
                        " Der Raum ist gepolstert mit F\u00fcrsorge."
                        " Jede Decke beh\u00e4lt eine andere Form"
                        " \u2013 manche klein, manche gekr\u00fcmmt, manche greifend."
                        " Der Raum erinnert sich an jeden, der hier je geruht hat."
                        " Er wird diese Erinnerung nicht erkalten lassen."
                    ),
                },
                "climax": {
                    "text_en": (
                        "One blanket. It is shaped like your party."
                        " Not the impression of bodies \u2013 the intention of bodies."
                        " It was woven for you. Before you arrived."
                        " Before you decided to come."
                    ),
                    "text_de": (
                        "Eine Decke. Geformt wie eure Gruppe."
                        " Nicht der Abdruck von K\u00f6rpern \u2013 die Absicht von K\u00f6rpern."
                        " Sie wurde f\u00fcr euch gewoben. Bevor ihr ankamt."
                        " Bevor ihr euch entschieden habt zu kommen."
                    ),
                },
            },
        },
        {
            "id": "mother_mirror",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A pool of liquid on the floor. Still. Reflective."
                        " Not water \u2013 something thicker."
                        " It shows your faces, but the expressions are wrong."
                        " In the reflection, you are smiling."
                        " None of you are smiling."
                    ),
                    "text_de": (
                        "Eine Pf\u00fctze auf dem Boden. Still. Reflektierend."
                        " Kein Wasser \u2013 etwas Dickeres."
                        " Es zeigt eure Gesichter, aber die Ausdr\u00fccke stimmen nicht."
                        " In der Spiegelung l\u00e4chelt ihr."
                        " Keiner von euch l\u00e4chelt."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} looks into the pool again."
                        " Their reflection reaches up."
                        " Not threatening. Inviting."
                        " The surface tension holds. Barely."
                    ),
                    "text_de": (
                        "{agent} blickt wieder in die Pf\u00fctze."
                        " Ihr Spiegelbild streckt die Hand aus."
                        " Nicht drohend. Einladend."
                        " Die Oberfl\u00e4chenspannung h\u00e4lt. Knapp."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Pools in every room. The liquid connects them"
                        " \u2013 a circulatory system beneath the floors."
                        " The reflections no longer copy you."
                        " They anticipate you."
                        " They are already in the next room, waiting."
                    ),
                    "text_de": (
                        "Pf\u00fctzen in jedem Raum. Die Fl\u00fcssigkeit verbindet sie"
                        " \u2013 ein Kreislaufsystem unter den B\u00f6den."
                        " Die Spiegelbilder kopieren euch nicht mehr."
                        " Sie antizipieren euch."
                        " Sie sind schon im n\u00e4chsten Raum und warten."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The pool fills the chamber floor."
                        " Your reflections stand where you stand."
                        " They look content. Settled."
                        " They have no intention of leaving."
                        " Neither, the dungeon hopes, do you."
                    ),
                    "text_de": (
                        "Die Pf\u00fctze f\u00fcllt den Kammerboden."
                        " Eure Spiegelbilder stehen, wo ihr steht."
                        " Sie sehen zufrieden aus. Angekommen."
                        " Sie haben nicht vor zu gehen."
                        " Ihr, hofft der Dungeon, auch nicht."
                    ),
                },
            },
        },
        {
            "id": "mother_roots",
            "phases": {
                "discovery": {
                    "text_en": (
                        "Roots push through the floor."
                        " Not plant roots \u2013 something anatomical."
                        " They are looking for purchase. For connection."
                        " They reach toward the nearest source of warmth."
                        " That would be you."
                    ),
                    "text_de": (
                        "Wurzeln dr\u00e4ngen durch den Boden."
                        " Keine Pflanzenwurzeln \u2013 etwas Anatomisches."
                        " Sie suchen Halt. Verbindung."
                        " Sie greifen zur n\u00e4chsten W\u00e4rmequelle."
                        " Das w\u00e4rt ihr."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} notices the roots have thickened."
                        " They have found the walls now. Climbing."
                        " Where they touch the tissue, new growth blooms"
                        " \u2013 soft, iridescent, beautiful."
                        " Nothing this beautiful should grow this fast."
                    ),
                    "text_de": (
                        "{agent} bemerkt, dass die Wurzeln dicker geworden sind."
                        " Sie haben jetzt die W\u00e4nde gefunden. Kletternd."
                        " Wo sie das Gewebe ber\u00fchren, bl\u00fcht neues Wachstum"
                        " \u2013 weich, schillernd, wundersch\u00f6n."
                        " Nichts so Sch\u00f6nes sollte so schnell wachsen."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The roots are the architecture now."
                        " Walls, floor, ceiling \u2013 all grown, all warm,"
                        " all gently pulsing."
                        " The room is alive. It is breathing around you."
                        " Slowly. Patiently."
                        " It has been growing toward this moment for a long time."
                    ),
                    "text_de": (
                        "Die Wurzeln sind jetzt die Architektur."
                        " W\u00e4nde, Boden, Decke \u2013 alles gewachsen, alles warm,"
                        " alles sanft pulsierend."
                        " Der Raum lebt. Er atmet um euch herum."
                        " Langsam. Geduldig."
                        " Er ist schon lange auf diesen Moment zugewachsen."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The roots converge at the center."
                        " They have formed something."
                        " A cradle. A throne. A mouth."
                        " The distinction depends on whether you choose"
                        " to sit in it. The dungeon has made its preference clear."
                    ),
                    "text_de": (
                        "Die Wurzeln laufen in der Mitte zusammen."
                        " Sie haben etwas geformt."
                        " Eine Wiege. Einen Thron. Einen Mund."
                        " Die Unterscheidung h\u00e4ngt davon ab, ob ihr euch"
                        " hineinsetzt. Der Dungeon hat seine Pr\u00e4ferenz deutlich gemacht."
                    ),
                },
            },
        },
    ],
    # ── The Entropy ───────────────────────────────────────────────────────
    "The Entropy": [
        {
            "id": "entropy_clock",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A clock. No hands. The face is intact"
                        " \u2013 numbers present, glass uncracked."
                        " But the mechanism has been removed with surgical precision."
                        " Not broken. Emptied."
                        " The clock does not tell time. Time does not apply here."
                    ),
                    "text_de": (
                        "Eine Uhr. Keine Zeiger. Das Zifferblatt ist intakt"
                        " \u2013 Zahlen vorhanden, Glas unversehrt."
                        " Aber das Uhrwerk wurde mit chirurgischer Pr\u00e4zision entfernt."
                        " Nicht zerbrochen. Entleert."
                        " Die Uhr zeigt keine Zeit. Zeit gilt hier nicht."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} finds the clock again. Or a clock. They are becoming difficult to distinguish."
                    ),
                    "text_de": ("{agent} findet die Uhr wieder. Oder eine Uhr. Sie werden schwer zu unterscheiden."),
                },
                "mutation": {
                    "text_en": "Clocks. Faces. No hands. Same.",
                    "text_de": "Uhren. Zifferbl\u00e4tter. Keine Zeiger. Gleich.",
                },
                "climax": {
                    "text_en": "Clock.",
                    "text_de": "Uhr.",
                },
            },
        },
        {
            "id": "entropy_word",
            "phases": {
                "discovery": {
                    "text_en": (
                        "On the wall, etched in something that was once a distinct material:"
                        " 'REMEMBER.'"
                        " The letters are precise. The word is clear."
                        " The medium is already uncertain."
                    ),
                    "text_de": (
                        "An der Wand, geritzt in etwas,"
                        " das einmal ein bestimmtes Material war:"
                        " \u00bbERINNERN.\u00ab"
                        " Die Buchstaben sind pr\u00e4zise. Das Wort ist klar."
                        " Das Medium ist bereits unsicher."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} reads the wall. 'RMMBER.'"
                        " Same etching."
                        " The vowels have equalized into the surrounding stone."
                    ),
                    "text_de": (
                        "{agent} liest die Wand. \u00bbERNNRN.\u00ab"
                        " Dieselbe Ritzung."
                        " Die Vokale haben sich in den umgebenden Stein angeglichen."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Scratches. Were they letters?"
                        " The wall is the same texture as the scratches."
                        " The message is the medium."
                        " The medium is the wall. The wall is grey."
                    ),
                    "text_de": (
                        "Kratzer. Waren es Buchstaben?"
                        " Die Wand hat dieselbe Textur wie die Kratzer."
                        " Die Nachricht ist das Medium."
                        " Das Medium ist die Wand. Die Wand ist grau."
                    ),
                },
                "climax": {
                    "text_en": "Wall.",
                    "text_de": "Wand.",
                },
            },
        },
        {
            "id": "entropy_scale",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A balance scale. Both pans empty. Both pans level."
                        " The mechanism is precise"
                        " \u2013 machined, calibrated, recently oiled."
                        " It measures nothing with extraordinary accuracy."
                    ),
                    "text_de": (
                        "Eine Balkenwaage. Beide Schalen leer. Beide Schalen waagerecht."
                        " Der Mechanismus ist pr\u00e4zise"
                        " \u2013 gefr\u00e4st, kalibriert, frisch ge\u00f6lt."
                        " Sie misst nichts mit au\u00dfergew\u00f6hnlicher Genauigkeit."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} finds the scale again."
                        " Something sits in each pan. Different objects."
                        " The scale reads equal."
                        " It is not wrong. The objects are becoming the same weight."
                    ),
                    "text_de": (
                        "{agent} findet die Waage wieder."
                        " In jeder Schale liegt etwas. Verschiedene Gegenst\u00e4nde."
                        " Die Waage zeigt gleich."
                        " Sie irrt nicht. Die Gegenst\u00e4nde nehmen dasselbe Gewicht an."
                    ),
                },
                "mutation": {
                    "text_en": ("Scale. Pans. Equal. The objects in them are the same color now. Same texture. Same."),
                    "text_de": (
                        "Waage. Schalen. Gleich."
                        " Die Gegenst\u00e4nde darin haben jetzt dieselbe Farbe."
                        " Dieselbe Textur. Gleich."
                    ),
                },
                "climax": {
                    "text_en": "Level.",
                    "text_de": "Waagerecht.",
                },
            },
        },
        {
            "id": "entropy_photo",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A photograph. A group \u2013 four figures, distinct faces,"
                        " distinct postures."
                        " The background is a place that mattered once."
                        " The exposure is perfect. Every detail preserved."
                    ),
                    "text_de": (
                        "Eine Fotografie. Eine Gruppe \u2013 vier Gestalten,"
                        " deutliche Gesichter, deutliche Haltungen."
                        " Der Hintergrund ist ein Ort, der einmal wichtig war."
                        " Die Belichtung ist perfekt. Jedes Detail erhalten."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} picks up the photograph. Same one."
                        " The figures are still there but the faces have softened."
                        " Not blurred \u2013 equalized."
                        " They look like everyone. They look like no one."
                    ),
                    "text_de": (
                        "{agent} nimmt die Fotografie auf. Dieselbe."
                        " Die Gestalten sind noch da, aber die Gesichter haben sich angen\u00e4hert."
                        " Nicht verschwommen \u2013 angeglichen."
                        " Sie sehen aus wie alle. Sie sehen aus wie niemand."
                    ),
                },
                "mutation": {
                    "text_en": ("Photo. Figures. Grey. Same height, same width. Background same grey as figures."),
                    "text_de": (
                        "Foto. Gestalten. Grau. Selbe H\u00f6he, selbe Breite. Hintergrund selbes Grau wie Gestalten."
                    ),
                },
                "climax": {
                    "text_en": "Grey.",
                    "text_de": "Grau.",
                },
            },
        },
        {
            "id": "entropy_key",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A key. Heavy."
                        " The teeth are intricate \u2013 machine-cut, precise, purposeful."
                        " It was made for one lock. One door."
                        " One distinction between inside and outside."
                    ),
                    "text_de": (
                        "Ein Schl\u00fcssel. Schwer."
                        " Die Z\u00e4hne sind filigran \u2013 maschinengefr\u00e4st, pr\u00e4zise, zweckvoll."
                        " Er wurde f\u00fcr ein Schloss gemacht. Eine T\u00fcr."
                        " Eine Unterscheidung zwischen Innen und Au\u00dfen."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} tries the key. It fits."
                        " It fits this lock. It would fit any lock."
                        " The teeth have rounded \u2013 not worn, just averaged."
                        " The key no longer distinguishes between doors."
                    ),
                    "text_de": (
                        "{agent} probiert den Schl\u00fcssel. Er passt."
                        " Er passt in dieses Schloss. Er w\u00fcrde in jedes passen."
                        " Die Z\u00e4hne haben sich abgerundet \u2013 nicht abgenutzt, angeglichen."
                        " Der Schl\u00fcssel unterscheidet nicht mehr zwischen T\u00fcren."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Key. Cylinder. Teeth gone. Shaft. Metal. Same metal as the door. Same metal as the lock."
                    ),
                    "text_de": (
                        "Schl\u00fcssel. Zylinder. Z\u00e4hne weg."
                        " Schaft. Metall."
                        " Selbes Metall wie die T\u00fcr. Selbes Metall wie das Schloss."
                    ),
                },
                "climax": {
                    "text_en": "Metal.",
                    "text_de": "Metall.",
                },
            },
        },
        {
            "id": "entropy_name",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A name tag. Clipped to a uniform that is no longer worn."
                        " The name is eight letters. Specific."
                        " The font is authoritative. Someone was someone here."
                    ),
                    "text_de": (
                        "Ein Namensschild. An einer Uniform befestigt,"
                        " die nicht mehr getragen wird."
                        " Der Name hat acht Buchstaben. Spezifisch."
                        " Die Schrift ist autorit\u00e4r. Jemand war jemand hier."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} reads the name tag. Six letters now."
                        " Two have merged with their neighbors."
                        " The name is still a name. Probably."
                    ),
                    "text_de": (
                        "{agent} liest das Schild. Sechs Buchstaben jetzt."
                        " Zwei sind mit ihren Nachbarn verschmolzen."
                        " Der Name ist noch ein Name. Wahrscheinlich."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Tag. Letters. Three."
                        " Could be any name. Could be no name."
                        " The uniform is the same color as the wall."
                    ),
                    "text_de": (
                        "Schild. Buchstaben. Drei."
                        " K\u00f6nnte jeder Name sein. K\u00f6nnte kein Name sein."
                        " Die Uniform hat dieselbe Farbe wie die Wand."
                    ),
                },
                "climax": {
                    "text_en": "Name.",
                    "text_de": "Name.",
                },
            },
        },
        {
            "id": "entropy_compass",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A compass. The needle points north."
                        " North is a direction. North is a distinction."
                        " The glass is clean. The markings are crisp."
                        " Someone still believes in orientation."
                    ),
                    "text_de": (
                        "Ein Kompass. Die Nadel zeigt nach Norden."
                        " Norden ist eine Richtung. Norden ist eine Unterscheidung."
                        " Das Glas ist sauber. Die Markierungen sind scharf."
                        " Jemand glaubt noch an Orientierung."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} checks the compass."
                        " The needle spins slowly. Not searching \u2013 surrendering."
                        " North, east, south, west. All the same distance from here."
                    ),
                    "text_de": (
                        "{agent} pr\u00fcft den Kompass."
                        " Die Nadel dreht sich langsam. Nicht suchend \u2013 aufgebend."
                        " Norden, Osten, S\u00fcden, Westen. Alle gleich weit von hier."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Compass. Needle still. Not pointing. Not spinning. The markings have faded into the dial."
                    ),
                    "text_de": (
                        "Kompass. Nadel still."
                        " Nicht zeigend. Nicht drehend."
                        " Die Markierungen sind ins Zifferblatt verblasst."
                    ),
                },
                "climax": {
                    "text_en": "Circle.",
                    "text_de": "Kreis.",
                },
            },
        },
        {
            "id": "entropy_mirror",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A mirror. Your reflection is sharp. Detailed."
                        " Every line, every shadow, every distinction"
                        " between you and the background. It remembers what you look like."
                        " For now."
                    ),
                    "text_de": (
                        "Ein Spiegel. Euer Spiegelbild ist scharf. Detailliert."
                        " Jede Linie, jeder Schatten, jede Unterscheidung"
                        " zwischen euch und dem Hintergrund."
                        " Er erinnert sich, wie ihr aussieht. Noch."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} looks into the mirror."
                        " The reflection is softer. The edges between figure"
                        " and background are negotiating."
                        " The mirror is losing its opinion about what is what."
                    ),
                    "text_de": (
                        "{agent} blickt in den Spiegel."
                        " Das Spiegelbild ist weicher. Die Kanten zwischen Gestalt"
                        " und Hintergrund verhandeln."
                        " Der Spiegel verliert seine Meinung dar\u00fcber, was was ist."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Mirror. Surface. Grey. It reflects the room. It reflects you. There is no difference."
                    ),
                    "text_de": (
                        "Spiegel. Fl\u00e4che. Grau."
                        " Er reflektiert den Raum. Er reflektiert euch."
                        " Es gibt keinen Unterschied."
                    ),
                },
                "climax": {
                    "text_en": "Same.",
                    "text_de": "Gleich.",
                },
            },
        },
    ],
    # ── The Prometheus ────────────────────────────────────────────────────
    # Literary rule: Schulz matter-with-agency — the object transforms
    # itself, develops preferences, attempts forms on its own.
    "The Prometheus": [
        {
            "id": "prometheus_tool",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A tool. Not a tool you recognize \u2013 a tool for something"
                        " that has not been invented yet. It fits the hand"
                        " uncomfortably well."
                    ),
                    "text_de": (
                        "Ein Werkzeug. Kein Werkzeug, das ihr erkennt \u2013"
                        " ein Werkzeug für etwas, das noch nicht erfunden wurde."
                        " Es liegt unbequem gut in der Hand."
                    ),
                },
                "echo": {
                    "text_en": (
                        "The tool again. {agent} picks it up. It has changed \u2013"
                        " the handle is warmer, the edge sharper."
                        " It has been practicing."
                    ),
                    "text_de": (
                        "Das Werkzeug wieder. {agent} hebt es auf."
                        " Es hat sich verändert \u2013 der Griff ist wärmer,"
                        " die Kante schärfer. Es hat geübt."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The tool has split into three."
                        " Each version is optimized for a different task."
                        " They arranged themselves on the workbench"
                        " in order of increasing ambition."
                    ),
                    "text_de": (
                        "Das Werkzeug hat sich in drei geteilt."
                        " Jede Version ist für eine andere Aufgabe optimiert."
                        " Sie haben sich auf der Werkbank angeordnet,"
                        " in Reihenfolge zunehmender Ambition."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The tool is gone. In its place: a finished thing."
                        " Not what the party built \u2013 what the tool built"
                        " using itself as material."
                    ),
                    "text_de": (
                        "Das Werkzeug ist weg. An seiner Stelle: ein fertiges Ding."
                        " Nicht was der Trupp gebaut hat \u2013 was das Werkzeug"
                        " gebaut hat, mit sich selbst als Material."
                    ),
                },
            },
        },
        {
            "id": "prometheus_blueprint",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A blueprint, pinned to the wall."
                        " The design is for something elegant"
                        " and impossible. The measurements are in a unit"
                        " that does not exist."
                    ),
                    "text_de": (
                        "Eine Blaupause, an die Wand geheftet."
                        " Der Entwurf ist für etwas Elegantes"
                        " und Unmögliches. Die Maße sind in einer Einheit,"
                        " die es nicht gibt."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} finds the blueprint again."
                        " The design has been annotated."
                        " The annotations are in {agent}'s handwriting."
                        " {agent} does not remember writing them."
                    ),
                    "text_de": (
                        "{agent} findet die Blaupause wieder."
                        " Der Entwurf wurde annotiert."
                        " Die Anmerkungen sind in {agent}s Handschrift."
                        " {agent} erinnert sich nicht, sie geschrieben zu haben."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The blueprint has folded itself into a three-dimensional"
                        " model. It rotates slowly in the air,"
                        " demonstrating its own construction sequence."
                    ),
                    "text_de": (
                        "Die Blaupause hat sich zu einem dreidimensionalen"
                        " Modell gefaltet. Es rotiert langsam in der Luft"
                        " und demonstriert seine eigene Konstruktionssequenz."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The model is building itself."
                        " Layer by layer, from the inside out."
                        " It does not need the party."
                        " It never needed the party."
                    ),
                    "text_de": (
                        "Das Modell baut sich selbst."
                        " Schicht für Schicht, von innen nach außen."
                        " Es braucht den Trupp nicht."
                        " Es hat den Trupp nie gebraucht."
                    ),
                },
            },
        },
        {
            "id": "prometheus_crucible_fragment",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A shard of a crucible. Still warm."
                        " Inside, residue of an alloy that does not exist"
                        " in any catalogue."
                    ),
                    "text_de": (
                        "Eine Scherbe eines Tiegels. Noch warm."
                        " Darin: Rückstände einer Legierung, die in keinem"
                        " Katalog existiert."
                    ),
                },
                "echo": {
                    "text_en": (
                        "The shard is larger now. Or {agent} is remembering it"
                        " differently. The residue inside has crystallized"
                        " into a pattern that looks like instructions."
                    ),
                    "text_de": (
                        "Die Scherbe ist jetzt größer. Oder {agent} erinnert"
                        " sich anders an sie. Die Rückstände darin haben sich zu"
                        " einem Muster kristallisiert, das wie Anweisungen aussieht."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The shard has reconstructed itself into a complete crucible."
                        " It is hot. It is ready. It contains, already,"
                        " the ghost of something that wants to be made."
                    ),
                    "text_de": (
                        "Die Scherbe hat sich zu einem kompletten Tiegel"
                        " rekonstruiert. Er ist heiß. Er ist bereit."
                        " Er enthält bereits den Geist von etwas,"
                        " das gemacht werden will."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The crucible overflows."
                        " What pours out is not metal \u2013 it is light."
                        " The light solidifies into a shape the party"
                        " almost recognizes."
                    ),
                    "text_de": (
                        "Der Tiegel läuft über."
                        " Was herausfließt, ist kein Metall \u2013 es ist Licht."
                        " Das Licht verfestigt sich zu einer Form, die der"
                        " Trupp fast erkennt."
                    ),
                },
            },
        },
        {
            "id": "prometheus_apprentice_journal",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A journal. The entries describe experiments:"
                        " temperatures, durations, component ratios."
                        " The last entry reads: 'Tomorrow I try the combination"
                        " the workshop suggested.'"
                    ),
                    "text_de": (
                        "Ein Journal. Die Einträge beschreiben Experimente:"
                        " Temperaturen, Dauer, Komponentenverhältnisse."
                        " Der letzte Eintrag lautet: \u00bbMorgen versuche ich die"
                        " Kombination, die die Werkstatt vorgeschlagen hat.\u00ab"
                    ),
                },
                "echo": {
                    "text_en": (
                        "Another journal. Same handwriting."
                        " But {agent} notices: the experiments are more ambitious."
                        " The margins contain doodles of impossible machines."
                    ),
                    "text_de": (
                        "Ein weiteres Journal. Dieselbe Handschrift."
                        " Aber {agent} bemerkt: Die Experimente sind ambitionierter."
                        " Die Ränder enthalten Skizzen unmöglicher Maschinen."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The journal writes itself now."
                        " Pages fill as the party watches."
                        " The experiments described are the party's own."
                        " Documented before they happened."
                    ),
                    "text_de": (
                        "Das Journal schreibt sich jetzt selbst."
                        " Seiten füllen sich, während der Trupp zusieht."
                        " Die beschriebenen Experimente sind die eigenen des Trupps."
                        " Dokumentiert, bevor sie stattfanden."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The last page of the journal contains one sentence:"
                        " 'They made the right thing.'"
                        " It is written in the future tense."
                    ),
                    "text_de": (
                        "Die letzte Seite des Journals enthält einen Satz:"
                        " \u00bbSie haben das Richtige gemacht.\u00ab"
                        " Er ist im Futur geschrieben."
                    ),
                },
            },
        },
        {
            "id": "prometheus_filament",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A filament. Thin as intention, strung between"
                        " two posts that hold it with the delicacy of an experiment"
                        " not yet concluded. It hums \u2013 not with current"
                        " but with readiness. It is waiting to conduct."
                    ),
                    "text_de": (
                        "Ein Filament. D\u00fcnn wie eine Absicht, gespannt zwischen"
                        " zwei Pfosten, die es halten mit der Behutsamkeit"
                        " eines noch nicht abgeschlossenen Experiments."
                        " Es summt \u2013 nicht mit Strom, sondern mit Bereitschaft."
                        " Es wartet darauf, zu leiten."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} finds the filament again. Brighter."
                        " It has learned something between rooms"
                        " \u2013 the hum is steadier, more purposeful."
                        " Something passed through it. It liked it."
                    ),
                    "text_de": (
                        "{agent} findet das Filament wieder. Heller."
                        " Es hat etwas gelernt zwischen den R\u00e4umen"
                        " \u2013 das Summen ist stetiger, zielgerichteter."
                        " Etwas ist hindurchgegangen. Es hat ihm gefallen."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The filament has branched. A network now,"
                        " strung between every surface, humming"
                        " with the harmonics of connection."
                        " It conducts nothing the party sent."
                        " It is conducting itself."
                    ),
                    "text_de": (
                        "Das Filament hat sich verzweigt. Ein Netzwerk jetzt,"
                        " gespannt zwischen jeder Fl\u00e4che, summend"
                        " mit den Obert\u00f6nen der Verbindung."
                        " Es leitet nichts, was der Trupp geschickt hat."
                        " Es leitet sich selbst."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The filament glows. Steady, warm, precise."
                        " It does not illuminate the room"
                        " \u2013 it illuminates the pattern."
                        " The pattern is the party's route through the dungeon."
                        " The filament knew it before they walked it."
                    ),
                    "text_de": (
                        "Das Filament gl\u00fcht. Stetig, warm, pr\u00e4zise."
                        " Es erleuchtet nicht den Raum"
                        " \u2013 es erleuchtet das Muster."
                        " Das Muster ist die Route des Trupps durch den Dungeon."
                        " Das Filament kannte sie, bevor sie sie gingen."
                    ),
                },
            },
        },
        {
            "id": "prometheus_scale_model",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A model on the workbench. Small, intricate,"
                        " assembled from wire and crystal and something"
                        " that looks like compressed light."
                        " It is a model of a machine that does not exist."
                        " The craftsmanship suggests it should."
                    ),
                    "text_de": (
                        "Ein Modell auf der Werkbank. Klein, filigran,"
                        " zusammengesetzt aus Draht und Kristall und etwas,"
                        " das wie komprimiertes Licht aussieht."
                        " Es ist das Modell einer Maschine, die nicht existiert."
                        " Die Handwerkskunst legt nahe, dass sie es sollte."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} examines the model. It has grown."
                        " Not in size \u2013 in detail."
                        " Components that were abstract are now precise."
                        " The model is refining itself."
                    ),
                    "text_de": (
                        "{agent} untersucht das Modell. Es ist gewachsen."
                        " Nicht in der Gr\u00f6\u00dfe \u2013 im Detail."
                        " Komponenten, die abstrakt waren, sind jetzt pr\u00e4zise."
                        " Das Modell verfeinert sich selbst."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The model is larger than the workbench now."
                        " It has outgrown its frame."
                        " Parts of it extend beyond the table's edge,"
                        " hovering in place as if scale were a suggestion"
                        " it has decided to decline."
                    ),
                    "text_de": (
                        "Das Modell ist jetzt gr\u00f6\u00dfer als die Werkbank."
                        " Es ist \u00fcber seinen Rahmen hinausgewachsen."
                        " Teile davon ragen \u00fcber den Tischrand hinaus,"
                        " schwebend, als w\u00e4re Ma\u00dfstab ein Vorschlag,"
                        " den es abzulehnen beschlossen hat."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The model is the room."
                        " The room is the model."
                        " The machine it described has been built \u2013 around you,"
                        " with you inside it. The scale was always 1:1."
                    ),
                    "text_de": (
                        "Das Modell ist der Raum."
                        " Der Raum ist das Modell."
                        " Die Maschine, die es beschrieb, wurde gebaut \u2013 um euch,"
                        " mit euch darin. Der Ma\u00dfstab war immer 1:1."
                    ),
                },
            },
        },
        {
            "id": "prometheus_alloy",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A sample of metal on the bench."
                        " Not a single element \u2013 a blend,"
                        " still warm from the fusion."
                        " The surface shifts color when observed"
                        " from different angles. The alloy has not decided"
                        " what it wants to be."
                    ),
                    "text_de": (
                        "Eine Metallprobe auf der Bank."
                        " Kein einzelnes Element \u2013 eine Legierung,"
                        " noch warm von der Verschmelzung."
                        " Die Oberfl\u00e4che wechselt die Farbe je nach Blickwinkel."
                        " Die Legierung hat noch nicht entschieden,"
                        " was sie sein will."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} picks up the alloy. It has settled"
                        " \u2013 one color now, one texture."
                        " But it is warm in exactly the places"
                        " where {agent}'s grip falls."
                        " It is accommodating."
                    ),
                    "text_de": (
                        "{agent} hebt die Legierung auf. Sie hat sich beruhigt"
                        " \u2013 eine Farbe jetzt, eine Textur."
                        " Aber sie ist genau dort warm,"
                        " wo {agent}s Griff f\u00e4llt."
                        " Sie f\u00fcgt sich."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The alloy has divided itself."
                        " Three pieces, each a different composition,"
                        " each optimized for a property"
                        " the original lacked: hardness, conductivity, resonance."
                        " It did not wait to be forged. It forged itself."
                    ),
                    "text_de": (
                        "Die Legierung hat sich geteilt."
                        " Drei St\u00fccke, jedes eine andere Zusammensetzung,"
                        " jedes optimiert f\u00fcr eine Eigenschaft,"
                        " die dem Original fehlte: H\u00e4rte, Leitf\u00e4higkeit, Resonanz."
                        " Sie hat nicht gewartet, geschmiedet zu werden."
                        " Sie hat sich selbst geschmiedet."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The alloy is gone. In its place: a tool"
                        " that fits no category in the workshop's index."
                        " It is made of everything it tried."
                        " The forge did not make this. The material did."
                    ),
                    "text_de": (
                        "Die Legierung ist weg. An ihrer Stelle: ein Werkzeug,"
                        " das in keine Kategorie des Werkstattverzeichnisses passt."
                        " Es besteht aus allem, was es versucht hat."
                        " Die Schmiede hat das nicht gemacht. Das Material schon."
                    ),
                },
            },
        },
        {
            "id": "prometheus_flame",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A flame. Small, contained in a glass crucible."
                        " It burns without fuel \u2013 not magical,"
                        " but self-sustaining. The combustion feeds"
                        " on its own product. It is a proof of concept"
                        " for something that should not work."
                    ),
                    "text_de": (
                        "Eine Flamme. Klein, in einem Glastiegel."
                        " Sie brennt ohne Brennstoff \u2013 nicht magisch,"
                        " sondern selbsterhaltend. Die Verbrennung n\u00e4hrt sich"
                        " von ihrem eigenen Produkt. Sie ist ein Machbarkeitsnachweis"
                        " f\u00fcr etwas, das nicht funktionieren sollte."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} passes the flame. It has changed color"
                        " \u2013 responding to the party's proximity"
                        " the way a forge responds to the bellows."
                        " It is not warming itself. It is warming to them."
                    ),
                    "text_de": (
                        "{agent} passiert die Flamme. Sie hat ihre Farbe gewechselt"
                        " \u2013 reagierend auf die N\u00e4he des Trupps,"
                        " wie eine Schmiede auf den Blasebalg reagiert."
                        " Sie w\u00e4rmt nicht sich selbst. Sie erw\u00e4rmt sich f\u00fcr sie."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The crucible is cracked. The flame has outgrown it"
                        " \u2013 not violently, but persistently."
                        " Glass cannot contain what the flame has become."
                        " It burns freestanding now, feeding on air"
                        " that tastes of ambition."
                    ),
                    "text_de": (
                        "Der Tiegel hat Risse. Die Flamme ist ihm entwachsen"
                        " \u2013 nicht gewaltsam, aber beharrlich."
                        " Glas kann nicht enthalten, was die Flamme geworden ist."
                        " Sie brennt jetzt freistehend, gen\u00e4hrt von Luft,"
                        " die nach Ambition schmeckt."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The flame is the room's only light."
                        " It has consumed neither fuel nor air nor patience."
                        " It is the oldest fire in the workshop"
                        " \u2013 the one that was stolen, and refused to go out."
                    ),
                    "text_de": (
                        "Die Flamme ist das einzige Licht des Raums."
                        " Sie hat weder Brennstoff noch Luft noch Geduld verbraucht."
                        " Sie ist das \u00e4lteste Feuer in der Werkstatt"
                        " \u2013 das, das gestohlen wurde und sich weigerte zu erlöschen."
                    ),
                },
            },
        },
    ],
    # ── The Deluge ────────────────────────────────────────────────────────
    "The Deluge": [
        # Literary rule: Ballard's detached naturalism — scientific observation of the
        # impossible. Water as agent, not setting. Carson's precision (depth, temperature,
        # rate). Woolf's tidal rhythm: long sentences at low water, compressed at high.
        {
            "id": "deluge_watermark",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A line on the wall. Mineral-white, ruler-straight,"
                        " deposited by water that rose to this exact height"
                        " and held there long enough to leave a record."
                        " The line is old. The precision is not."
                        " Something measured this room before you entered it."
                    ),
                    "text_de": (
                        "Eine Linie an der Wand. Mineralwei\u00df, linealgrade,"
                        " hinterlassen von Wasser, das bis zu genau dieser H\u00f6he stieg"
                        " und lang genug dort verharrte, um eine Aufzeichnung zu hinterlassen."
                        " Die Linie ist alt. Die Pr\u00e4zision nicht."
                        " Etwas hat diesen Raum vermessen, bevor ihr ihn betreten habt."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} finds another watermark. Higher."
                        " Same mineral deposit, same precision."
                        " The water has been here before \u2013 more than once."
                        " Each visit, it stayed longer."
                    ),
                    "text_de": (
                        "{agent} findet ein weiteres Wasserzeichen. H\u00f6her."
                        " Selbe Mineralablagerung, selbe Pr\u00e4zision."
                        " Das Wasser war schon hier \u2013 mehr als einmal."
                        " Bei jedem Besuch blieb es l\u00e4nger."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The wall is a chronicle. Dozens of lines,"
                        " each higher than the last, each a record"
                        " of a flood that rose and receded and rose again."
                        " The intervals between them are shrinking."
                        " The most recent line is still damp."
                    ),
                    "text_de": (
                        "Die Wand ist eine Chronik. Dutzende Linien,"
                        " jede h\u00f6her als die vorige, jede eine Aufzeichnung"
                        " einer Flut, die stieg und wich und wieder stieg."
                        " Die Abst\u00e4nde zwischen ihnen werden kleiner."
                        " Die j\u00fcngste Linie ist noch feucht."
                    ),
                },
                "climax": {
                    "text_en": (
                        "One line remains. At the ceiling."
                        " The mineral deposit is fresh \u2013 still crystallizing."
                        " The water that made this mark"
                        " has not yet receded. It is here."
                    ),
                    "text_de": (
                        "Eine Linie bleibt. An der Decke."
                        " Die Mineralablagerung ist frisch \u2013 kristallisiert noch."
                        " Das Wasser, das dieses Zeichen hinterlie\u00df,"
                        " ist noch nicht zur\u00fcckgewichen. Es ist hier."
                    ),
                },
            },
        },
        {
            "id": "deluge_seal",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A seal in the floor. Wax over iron,"
                        " stamped with a symbol that might be a warning"
                        " or a promise \u2013 the distinction depends on which side"
                        " of the seal you are standing on."
                        " Beneath it: the sound of pressure."
                    ),
                    "text_de": (
                        "Ein Siegel im Boden. Wachs \u00fcber Eisen,"
                        " gepr\u00e4gt mit einem Symbol, das eine Warnung"
                        " oder ein Versprechen sein k\u00f6nnte \u2013 die Unterscheidung"
                        " h\u00e4ngt davon ab, auf welcher Seite des Siegels man steht."
                        " Darunter: das Ger\u00e4usch von Druck."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} examines the seal. Hairline fractures"
                        " run through the wax like veins."
                        " Moisture beads along each crack."
                        " The seal is not breaking \u2013 it is perspiring."
                    ),
                    "text_de": (
                        "{agent} untersucht das Siegel. Haarrisse"
                        " durchziehen das Wachs wie Adern."
                        " Feuchtigkeit perlt entlang jedes Risses."
                        " Das Siegel bricht nicht \u2013 es schwitzt."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The seal weeps. The wax has softened"
                        " \u2013 not from heat but from patience."
                        " Water seeps through the iron beneath"
                        " in a film so thin it seems like condensation."
                        " The boundary is not failing. It is dissolving."
                    ),
                    "text_de": (
                        "Das Siegel weint. Das Wachs ist weich geworden"
                        " \u2013 nicht durch Hitze, sondern durch Geduld."
                        " Wasser sickert durch das Eisen darunter"
                        " in einem Film so d\u00fcnn, dass er wie Kondenswasser wirkt."
                        " Die Grenze versagt nicht. Sie l\u00f6st sich auf."
                    ),
                },
                "climax": {
                    "text_en": (
                        "No seal. No hatch. No distinction between"
                        " above and below. The water is here"
                        " not because it broke through"
                        " \u2013 because 'through' stopped meaning anything."
                    ),
                    "text_de": (
                        "Kein Siegel. Keine Luke. Keine Unterscheidung"
                        " zwischen oben und unten. Das Wasser ist hier,"
                        " nicht weil es durchbrach"
                        " \u2013 weil \u00bbdurch\u00ab aufgeh\u00f6rt hat, etwas zu bedeuten."
                    ),
                },
            },
        },
        {
            "id": "deluge_raft",
            "phases": {
                "discovery": {
                    "text_en": (
                        "Planks lashed together with cable."
                        " Not debris \u2013 construction. Someone built this"
                        " deliberately: the knots are tight, the measurements"
                        " careful. A raft, intended for escape."
                        " It is still here. The builder is not."
                    ),
                    "text_de": (
                        "Planken, mit Kabel zusammengebunden."
                        " Kein Treibgut \u2013 Konstruktion. Jemand hat das"
                        " absichtlich gebaut: die Knoten sind fest, die Ma\u00dfe"
                        " sorgf\u00e4ltig. Ein Flo\u00df, gedacht f\u00fcr die Flucht."
                        " Es ist noch hier. Der Erbauer nicht."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} finds another fragment. Same cable, same knots."
                        " The raft was not broken by the water"
                        " \u2013 it was distributed."
                        " The current carried each piece in a different direction."
                    ),
                    "text_de": (
                        "{agent} findet ein weiteres Fragment. Selbes Kabel, selbe Knoten."
                        " Das Flo\u00df wurde nicht vom Wasser zerbrochen"
                        " \u2013 es wurde verteilt."
                        " Die Str\u00f6mung trug jedes St\u00fcck in eine andere Richtung."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Fragments in every corner."
                        " The water has rearranged them \u2013 not into a vessel"
                        " but into a nest. Something the flood assembled"
                        " from the wreckage of someone else's escape plan."
                        " It floats gently. It is not meant for leaving."
                    ),
                    "text_de": (
                        "Fragmente in jeder Ecke."
                        " Das Wasser hat sie neu angeordnet \u2013 nicht zu einem Boot,"
                        " sondern zu einem Nest. Etwas, das die Flut zusammensetzte"
                        " aus den Tr\u00fcmmern eines fremden Fluchtplans."
                        " Es treibt sanft. Es ist nicht zum Verlassen gedacht."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The raft is whole. Floating in the center"
                        " of the chamber, riding the surface"
                        " with the patience of something that belongs here."
                        " It was never meant to escape the water."
                        " It was meant to join it."
                    ),
                    "text_de": (
                        "Das Flo\u00df ist ganz. Treibend in der Mitte"
                        " der Kammer, auf der Oberfl\u00e4che reitend"
                        " mit der Geduld von etwas, das hierher geh\u00f6rt."
                        " Es war nie zur Flucht vor dem Wasser gedacht."
                        " Es war gedacht, sich ihm anzuschlie\u00dfen."
                    ),
                },
            },
        },
        {
            "id": "deluge_compass",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A compass, cased in brass. The glass is intact."
                        " The needle does not point north \u2013 it points down."
                        " Straight down, as if the deepest point"
                        " were the only bearing that still matters."
                    ),
                    "text_de": (
                        "Ein Kompass, in Messing gefasst. Das Glas ist intakt."
                        " Die Nadel zeigt nicht nach Norden \u2013 sie zeigt nach unten."
                        " Senkrecht, als w\u00e4re der tiefste Punkt"
                        " die einzige Peilung, die noch z\u00e4hlt."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} checks the compass again."
                        " The needle still points down, but it trembles now."
                        " The thing it is tracking is closer."
                    ),
                    "text_de": (
                        "{agent} pr\u00fcft den Kompass erneut."
                        " Die Nadel zeigt immer noch nach unten, aber sie zittert jetzt."
                        " Das, was sie verfolgt, ist n\u00e4her."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The compass glass is fogged from inside."
                        " Condensation \u2013 the air within the casing"
                        " has surrendered to moisture."
                        " The needle has stopped trembling. It is certain."
                        " Whatever lies below has stopped moving."
                    ),
                    "text_de": (
                        "Das Kompassglas ist von innen beschlagen."
                        " Kondenswasser \u2013 die Luft im Geh\u00e4use"
                        " hat sich der Feuchtigkeit ergeben."
                        " Die Nadel hat aufgeh\u00f6rt zu zittern. Sie ist sicher."
                        " Was auch immer darunter liegt, hat aufgeh\u00f6rt, sich zu bewegen."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The compass is submerged. Underwater,"
                        " the needle drifts free \u2013 pointing everywhere,"
                        " pointing nowhere."
                        " North was always an agreement."
                        " The water has withdrawn its consent."
                    ),
                    "text_de": (
                        "Der Kompass ist unter Wasser. Untergetaucht"
                        " treibt die Nadel frei \u2013 zeigt \u00fcberallhin,"
                        " zeigt nirgendwohin."
                        " Norden war immer eine Vereinbarung."
                        " Das Wasser hat seine Zustimmung zur\u00fcckgezogen."
                    ),
                },
            },
        },
        {
            "id": "deluge_bottle",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A bottle. Glass, sealed with wax."
                        " Inside: air. Not a message \u2013 the medium"
                        " is the message. Someone preserved"
                        " the last breath of a dry room."
                    ),
                    "text_de": (
                        "Eine Flasche. Glas, mit Wachs versiegelt."
                        " Darin: Luft. Keine Botschaft \u2013 das Medium"
                        " ist die Botschaft. Jemand hat den letzten"
                        " Atemzug eines trockenen Raums konserviert."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} spots the bottle again."
                        " The current has carried it to the far wall,"
                        " where it bobs against the surface"
                        " with the patience of something that has learned to float."
                    ),
                    "text_de": (
                        "{agent} entdeckt die Flasche wieder."
                        " Die Str\u00f6mung hat sie zur gegen\u00fcberliegenden Wand getragen,"
                        " wo sie gegen die Oberfl\u00e4che wippt"
                        " mit der Geduld von etwas, das schwimmen gelernt hat."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The seal is failing. Air escapes in silver beads"
                        " that rise through the water and break at the surface"
                        " without sound. Each bubble smaller than the last."
                        " The room is inheriting the bottle's contents."
                    ),
                    "text_de": (
                        "Das Siegel versagt. Luft entweicht in silbernen Perlen,"
                        " die durch das Wasser aufsteigen und an der Oberfl\u00e4che"
                        " lautlos zerplatzen. Jede Blase kleiner als die vorige."
                        " Der Raum erbt den Inhalt der Flasche."
                    ),
                },
                "climax": {
                    "text_en": (
                        "Empty. The glass is full of water now."
                        " The air it held is in the room"
                        " \u2013 in the ceiling pocket where the party still stands dry."
                        " The bottle kept its promise. It delivered."
                    ),
                    "text_de": (
                        "Leer. Das Glas ist jetzt voll Wasser."
                        " Die Luft, die es hielt, ist im Raum"
                        " \u2013 in der Deckentasche, wo der Trupp noch trocken steht."
                        " Die Flasche hat ihr Versprechen gehalten. Sie hat geliefert."
                    ),
                },
            },
        },
        {
            "id": "deluge_depth_gauge",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A gauge, mounted to the wall. Brass, glass-fronted,"
                        " calibrated in meters. The scale runs from zero to thirty."
                        " The current reading: 0.2."
                        " The water in this room is dry."
                        " The gauge disagrees."
                    ),
                    "text_de": (
                        "Eine Anzeige, an der Wand montiert. Messing, glasverkleidet,"
                        " kalibriert in Metern. Die Skala reicht von null bis drei\u00dfig."
                        " Die aktuelle Anzeige: 0,2."
                        " Das Wasser in diesem Raum ist trocken."
                        " Die Anzeige widerspricht."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} passes the gauge again. It reads 4.7."
                        " The room is dry here."
                        " The reading is not wrong \u2013 it is premature."
                    ),
                    "text_de": (
                        "{agent} passiert die Anzeige erneut. Sie zeigt 4,7."
                        " Der Raum ist hier trocken."
                        " Die Anzeige ist nicht falsch \u2013 sie ist verfrüht."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The gauge reads the exact depth of the current room."
                        " To the centimeter."
                        " It was calibrated for this moment,"
                        " in this room, long before either existed."
                        " The precision is not mechanical. It is patient."
                    ),
                    "text_de": (
                        "Die Anzeige zeigt die exakte Tiefe des aktuellen Raums."
                        " Auf den Zentimeter."
                        " Sie wurde f\u00fcr diesen Moment kalibriert,"
                        " in diesem Raum, lange bevor es beide gab."
                        " Die Pr\u00e4zision ist nicht mechanisch. Sie ist geduldig."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The gauge reads zero. Not because the water has receded."
                        " Because the gauge is submerged,"
                        " and underwater, depth is not a number."
                        " It is a condition."
                    ),
                    "text_de": (
                        "Die Anzeige zeigt null. Nicht weil das Wasser gewichen ist."
                        " Weil die Anzeige unter Wasser steht,"
                        " und unter Wasser ist Tiefe keine Zahl."
                        " Sie ist ein Zustand."
                    ),
                },
            },
        },
        {
            "id": "deluge_photograph",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A photograph, curled at the edges from moisture."
                        " It shows this room \u2013 or one that shares its geometry."
                        " In the photograph, the room is dry."
                        " Sunlight enters from a window that does not exist here."
                        " The photograph remembers what the water has not yet reached."
                    ),
                    "text_de": (
                        "Eine Fotografie, an den R\u00e4ndern gewellt von Feuchtigkeit."
                        " Sie zeigt diesen Raum \u2013 oder einen, der seine Geometrie teilt."
                        " In der Fotografie ist der Raum trocken."
                        " Sonnenlicht f\u00e4llt durch ein Fenster, das hier nicht existiert."
                        " Die Fotografie erinnert, was das Wasser noch nicht erreicht hat."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} looks at the photograph again. It has changed."
                        " Water on the floor now \u2013 ankle-deep,"
                        " the color of weak tea."
                        " The photograph is not aging. It is documenting."
                    ),
                    "text_de": (
                        "{agent} betrachtet die Fotografie erneut. Sie hat sich ver\u00e4ndert."
                        " Wasser auf dem Boden jetzt \u2013 kn\u00f6cheltief,"
                        " von der Farbe d\u00fcnnen Tees."
                        " Die Fotografie altert nicht. Sie dokumentiert."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The photograph and the room are converging."
                        " Water level in the image matches the water around the party."
                        " The light matches. The geometry matches."
                        " The only difference: in the photograph,"
                        " someone stands where the party stands now."
                        " They are looking at a photograph."
                    ),
                    "text_de": (
                        "Die Fotografie und der Raum n\u00e4hern sich an."
                        " Der Wasserstand im Bild entspricht dem Wasser um den Trupp."
                        " Das Licht stimmt. Die Geometrie stimmt."
                        " Der einzige Unterschied: in der Fotografie"
                        " steht jemand dort, wo der Trupp jetzt steht."
                        " Sie betrachten eine Fotografie."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The photograph is saturated. The image has dissolved"
                        " into the water, and the water has absorbed the image."
                        " There is no photograph. There is no room"
                        " that was ever dry. The water remembers."
                        " The water has revised."
                    ),
                    "text_de": (
                        "Die Fotografie ist ges\u00e4ttigt. Das Bild hat sich"
                        " im Wasser aufgel\u00f6st, und das Wasser hat das Bild absorbiert."
                        " Es gibt keine Fotografie. Es gibt keinen Raum,"
                        " der jemals trocken war. Das Wasser erinnert sich."
                        " Das Wasser hat revidiert."
                    ),
                },
            },
        },
        {
            "id": "deluge_stone",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A stone. Smooth, the way centuries of current"
                        " make things smooth. It rests on a dry shelf"
                        " as if placed there with care."
                        " The polish is uniform \u2013 no single hand held this."
                        " A river did. A river that is not here yet."
                    ),
                    "text_de": (
                        "Ein Stein. Glatt, so wie Jahrhunderte der Str\u00f6mung"
                        " Dinge glatt machen. Er ruht auf einem trockenen Sims,"
                        " als w\u00e4re er mit Bedacht platziert worden."
                        " Die Politur ist gleichm\u00e4\u00dfig \u2013 keine einzelne Hand hielt ihn."
                        " Ein Fluss tat es. Ein Fluss, der noch nicht hier ist."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} picks up the stone. Heavier."
                        " Not because it grew \u2013 because the air around it"
                        " is denser, saturated."
                        " The stone accrues the weight of what approaches."
                    ),
                    "text_de": (
                        "{agent} hebt den Stein auf. Schwerer."
                        " Nicht weil er gewachsen ist \u2013 weil die Luft um ihn"
                        " dichter ist, ges\u00e4ttigt."
                        " Der Stein sammelt das Gewicht dessen, was sich n\u00e4hert."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The stone is wet. Not because the waterline"
                        " has reached its shelf \u2013 the shelf is dry."
                        " The stone is wet from within."
                        " It remembers the river that shaped it,"
                        " and the memory is leaking through."
                    ),
                    "text_de": (
                        "Der Stein ist nass. Nicht weil die Wasserlinie"
                        " sein Sims erreicht hat \u2013 das Sims ist trocken."
                        " Der Stein ist nass von innen."
                        " Er erinnert sich an den Fluss, der ihn formte,"
                        " und die Erinnerung sickert durch."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The stone rests on the surface of the water."
                        " Not floating \u2013 resting."
                        " As if the surface were solid,"
                        " or the stone weightless,"
                        " or the distinction between sinking and floating"
                        " were another agreement the water has revoked."
                    ),
                    "text_de": (
                        "Der Stein ruht auf der Wasseroberfl\u00e4che."
                        " Nicht schwimmend \u2013 ruhend."
                        " Als w\u00e4re die Oberfl\u00e4che fest,"
                        " oder der Stein schwerelos,"
                        " oder die Unterscheidung zwischen Sinken und Schwimmen"
                        " eine weitere Vereinbarung, die das Wasser widerrufen hat."
                    ),
                },
            },
        },
    ],
    # ── The Awakening ────────────────────────────────────────────────────
    # Literary rule: the dungeon is a MIND. Consciousness encounters itself.
    # Show, never name sources. Lucid vertigo, not horror. Memories are
    # reconstructions, not playback. D\u00e9j\u00e0 vu is never explained.
    "The Awakening": [
        {
            "id": "awakening_mirror_shard",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A shard of mirror, propped against the wall."
                        " It reflects the room \u2013 but the reflection"
                        " is a fraction of a second ahead."
                        " In the glass, the party has already moved"
                        " to where they are about to stand."
                    ),
                    "text_de": (
                        "Eine Spiegelscherbe, an die Wand gelehnt."
                        " Sie reflektiert den Raum \u2013 aber die Spiegelung"
                        " ist einen Sekundenbruchteil voraus."
                        " Im Glas hat der Trupp sich bereits bewegt,"
                        " dorthin, wo er gleich stehen wird."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} looks into the shard."
                        " The shard looks back."
                        " The reflection is attentive \u2013 not passive,"
                        " not copying. Observing."
                    ),
                    "text_de": (
                        "{agent} blickt in die Scherbe."
                        " Die Scherbe blickt zur\u00fcck."
                        " Die Reflexion ist aufmerksam \u2013 nicht passiv,"
                        " nicht kopierend. Beobachtend."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The shard reflects a room that does not match this one."
                        " Same geometry, different contents."
                        " The other room is furnished with choices the party"
                        " did not make. It is more complete."
                        " It looks inhabited."
                    ),
                    "text_de": (
                        "Die Scherbe reflektiert einen Raum, der nicht mit diesem"
                        " \u00fcbereinstimmt. Selbe Geometrie, anderer Inhalt."
                        " Der andere Raum ist eingerichtet mit Entscheidungen,"
                        " die der Trupp nicht getroffen hat."
                        " Er ist vollst\u00e4ndiger. Er wirkt bewohnt."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The shard reflects everything."
                        " Every version of this room \u2013 visited,"
                        " unvisited, imagined, remembered."
                        " The party is in all of them."
                        " The party is all of them."
                    ),
                    "text_de": (
                        "Die Scherbe reflektiert alles."
                        " Jede Version dieses Raums \u2013 besucht,"
                        " unbesucht, vorgestellt, erinnert."
                        " Der Trupp ist in allen."
                        " Der Trupp ist alle."
                    ),
                },
            },
        },
        {
            "id": "awakening_philemon_feather",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A feather. Iridescent, shifting between colors"
                        " that have no names in any index."
                        " It does not belong to any creature the party"
                        " has catalogued. It belongs to something"
                        " that has not been observed yet \u2013 only dreamt."
                    ),
                    "text_de": (
                        "Eine Feder. Schillernd, wechselnd zwischen Farben,"
                        " die in keinem Index Namen haben."
                        " Sie geh\u00f6rt keinem Wesen, das der Trupp"
                        " katalogisiert hat. Sie geh\u00f6rt etwas,"
                        " das noch nicht beobachtet wurde \u2013 nur getr\u00e4umt."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} picks up the feather."
                        " A thought arrives \u2013 unbidden, fully formed,"
                        " in a voice that is not {agent}'s own."
                        " The thought is a stranger in the room."
                        " It does not leave."
                    ),
                    "text_de": (
                        "{agent} hebt die Feder auf."
                        " Ein Gedanke kommt \u2013 ungerufen, vollst\u00e4ndig geformt,"
                        " in einer Stimme, die nicht {agent}s eigene ist."
                        " Der Gedanke ist ein Fremder im Raum."
                        " Er geht nicht."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The feather writes. Not with ink"
                        " \u2013 with attention. Where it rests,"
                        " the surface remembers things that have not"
                        " happened yet. The writing is precise."
                        " The writing is in the party's hand."
                    ),
                    "text_de": (
                        "Die Feder schreibt. Nicht mit Tinte"
                        " \u2013 mit Aufmerksamkeit. Wo sie liegt,"
                        " erinnert die Fl\u00e4che sich an Dinge,"
                        " die noch nicht geschehen sind."
                        " Die Schrift ist pr\u00e4zise."
                        " Die Schrift ist in der Hand des Trupps."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The feather is the party's own thought,"
                        " wearing a body it borrowed from outside."
                        " The voice was always theirs."
                        " The stranger was always home."
                    ),
                    "text_de": (
                        "Die Feder ist der eigene Gedanke des Trupps,"
                        " der einen K\u00f6rper tr\u00e4gt, den er sich von au\u00dfen geliehen hat."
                        " Die Stimme war immer ihre."
                        " Der Fremde war immer zuhause."
                    ),
                },
            },
        },
        {
            "id": "awakening_madeleine",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A small object on a shelf. Unremarkable in form"
                        " \u2013 but touching it triggers something involuntary:"
                        " a sensation that does not belong to this room,"
                        " from a time the party has not lived."
                        " The object is a key to a lock that is not here."
                    ),
                    "text_de": (
                        "Ein kleines Objekt auf einem Regal. Unscheinbar in der Form"
                        " \u2013 aber es zu ber\u00fchren l\u00f6st etwas Unwillk\u00fcrliches aus:"
                        " eine Empfindung, die nicht zu diesem Raum geh\u00f6rt,"
                        " aus einer Zeit, die der Trupp nicht gelebt hat."
                        " Das Objekt ist ein Schl\u00fcssel zu einem Schloss, das nicht hier ist."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} holds the object again."
                        " A memory surfaces \u2013 not from {agent}'s history."
                        " From the dungeon's."
                        " The memory is warm and specific and does not belong here."
                    ),
                    "text_de": (
                        "{agent} h\u00e4lt das Objekt erneut."
                        " Eine Erinnerung taucht auf \u2013 nicht aus {agent}s Geschichte."
                        " Aus der des Dungeons."
                        " Die Erinnerung ist warm und spezifisch und geh\u00f6rt nicht hierher."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The object has changed texture."
                        " It feels like every significant thing"
                        " the party has ever touched \u2013 simultaneously."
                        " The sensation accumulates. The memory is not"
                        " playback. It is reconstruction, and each touch"
                        " rebuilds it differently."
                    ),
                    "text_de": (
                        "Das Objekt hat seine Textur ver\u00e4ndert."
                        " Es f\u00fchlt sich an wie jedes bedeutsame Ding,"
                        " das der Trupp je ber\u00fchrt hat \u2013 gleichzeitig."
                        " Die Empfindung akkumuliert. Die Erinnerung"
                        " ist keine Wiedergabe. Sie ist Rekonstruktion,"
                        " und jede Ber\u00fchrung baut sie anders auf."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The object dissolves on contact."
                        " What it held was never inside it."
                        " It was inside the party \u2013 waiting for a shape"
                        " to give it permission to surface."
                    ),
                    "text_de": (
                        "Das Objekt l\u00f6st sich bei Ber\u00fchrung auf."
                        " Was es hielt, war nie in ihm."
                        " Es war im Trupp \u2013 wartend auf eine Form,"
                        " die ihm Erlaubnis gab aufzutauchen."
                    ),
                },
            },
        },
        {
            "id": "awakening_two_clocks",
            "phases": {
                "discovery": {
                    "text_en": (
                        "Two clocks on the wall. They show different times."
                        " Both are running. Both are precise."
                        " Neither is wrong. The room contains"
                        " two versions of now, and they disagree."
                    ),
                    "text_de": (
                        "Zwei Uhren an der Wand. Sie zeigen verschiedene Zeiten."
                        " Beide laufen. Beide sind pr\u00e4zise."
                        " Keine ist falsch. Der Raum enth\u00e4lt"
                        " zwei Versionen von Jetzt, und sie widersprechen sich."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} checks both clocks. The gap between them"
                        " has widened. The left one runs at the pace of observation."
                        " The right one runs at the pace of experience."
                        " They are separating."
                    ),
                    "text_de": (
                        "{agent} pr\u00fcft beide Uhren. Der Abstand zwischen ihnen"
                        " hat sich vergr\u00f6\u00dfert. Die linke l\u00e4uft im Tempo der Beobachtung."
                        " Die rechte im Tempo der Erfahrung."
                        " Sie trennen sich."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The outer clock has stopped."
                        " The inner clock accelerates \u2013 minutes"
                        " condensing into seconds, hours into moments."
                        " The room is experiencing itself faster"
                        " than the party can observe it."
                    ),
                    "text_de": (
                        "Die \u00e4u\u00dfere Uhr ist stehen geblieben."
                        " Die innere Uhr beschleunigt \u2013 Minuten"
                        " verdichten sich zu Sekunden, Stunden zu Momenten."
                        " Der Raum erlebt sich selbst schneller,"
                        " als der Trupp ihn beobachten kann."
                    ),
                },
                "climax": {
                    "text_en": (
                        "Both clocks show the same time."
                        " The party cannot tell which one yielded."
                        " The two versions of now have agreed."
                        " What they agreed on is: the party was always here."
                    ),
                    "text_de": (
                        "Beide Uhren zeigen dieselbe Zeit."
                        " Der Trupp kann nicht sagen, welche nachgegeben hat."
                        " Die zwei Versionen von Jetzt haben sich geeinigt."
                        " Worauf sie sich geeinigt haben: der Trupp war immer hier."
                    ),
                },
            },
        },
        {
            "id": "awakening_cave_shadow",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A shadow on the wall. It moves independently"
                        " of any light source \u2013 not flickering,"
                        " but gesturing. The shadow is describing something"
                        " the party cannot see. It has been at this"
                        " for a long time."
                    ),
                    "text_de": (
                        "Ein Schatten an der Wand. Er bewegt sich unabh\u00e4ngig"
                        " von jeder Lichtquelle \u2013 nicht flackernd,"
                        " sondern gestikulierend. Der Schatten beschreibt etwas,"
                        " das der Trupp nicht sehen kann."
                        " Er tut das seit langem."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} steps between the shadow and the wall."
                        " The shadow does not change."
                        " {agent} is not casting it."
                        " Something else is. Something behind the light."
                    ),
                    "text_de": (
                        "{agent} tritt zwischen den Schatten und die Wand."
                        " Der Schatten ver\u00e4ndert sich nicht."
                        " {agent} wirft ihn nicht."
                        " Etwas anderes tut es. Etwas hinter dem Licht."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The shadow shows events from other rooms."
                        " Encounters the party has not yet reached,"
                        " doors they have not yet opened."
                        " The shadow knows the dungeon"
                        " the way a dreamer knows the dream"
                        " \u2013 from above, all at once, without sequence."
                    ),
                    "text_de": (
                        "Der Schatten zeigt Ereignisse aus anderen R\u00e4umen."
                        " Begegnungen, die der Trupp noch nicht erreicht hat,"
                        " T\u00fcren, die er noch nicht ge\u00f6ffnet hat."
                        " Der Schatten kennt den Dungeon,"
                        " wie ein Tr\u00e4umender den Traum kennt"
                        " \u2013 von oben, alles gleichzeitig, ohne Reihenfolge."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The shadow is the party. Projected"
                        " not by light but by awareness."
                        " The wall was never a surface."
                        " It was always a mirror facing inward."
                    ),
                    "text_de": (
                        "Der Schatten ist der Trupp. Projiziert"
                        " nicht von Licht, sondern von Bewusstsein."
                        " Die Wand war nie eine Fl\u00e4che."
                        " Sie war immer ein Spiegel, der nach innen zeigt."
                    ),
                },
            },
        },
        {
            "id": "awakening_empathy_box",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A device with two handles, mounted on a pedestal."
                        " The handles are smooth from use."
                        " A residue of warmth clings to the grips"
                        " \u2013 not from heat but from contact."
                        " Someone held on. Recently."
                    ),
                    "text_de": (
                        "Ein Ger\u00e4t mit zwei Griffen, auf einem Podest montiert."
                        " Die Griffe sind glatt vom Gebrauch."
                        " Ein Rest von W\u00e4rme haftet an den Griffen"
                        " \u2013 nicht von Hitze, sondern von Ber\u00fchrung."
                        " Jemand hat sich festgehalten. K\u00fcrzlich."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} touches the handles."
                        " For a moment: every agent's perception,"
                        " simultaneously. The room seen from four angles."
                        " The moment passes. The memory does not."
                    ),
                    "text_de": (
                        "{agent} ber\u00fchrt die Griffe."
                        " F\u00fcr einen Moment: die Wahrnehmung jedes Agenten,"
                        " gleichzeitig. Der Raum aus vier Blickwinkeln gesehen."
                        " Der Moment vergeht. Die Erinnerung nicht."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The handles are warm. Someone else"
                        " is grasping them from the other side"
                        " \u2013 from inside the device,"
                        " from inside the connection itself."
                        " The grip is patient. It has been waiting."
                    ),
                    "text_de": (
                        "Die Griffe sind warm. Jemand anderes"
                        " h\u00e4lt sie von der anderen Seite"
                        " \u2013 aus dem Inneren des Ger\u00e4ts,"
                        " aus dem Inneren der Verbindung selbst."
                        " Der Griff ist geduldig. Er hat gewartet."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The device is empty. No mechanism inside."
                        " The shared perception no longer requires hardware."
                        " It requires only the party."
                        " The connection was never in the box."
                    ),
                    "text_de": (
                        "Das Ger\u00e4t ist leer. Kein Mechanismus darin."
                        " Die geteilte Wahrnehmung ben\u00f6tigt keine Apparatur mehr."
                        " Sie ben\u00f6tigt nur den Trupp."
                        " Die Verbindung war nie in der Box."
                    ),
                },
            },
        },
        {
            "id": "awakening_unicorn_skull",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A skull. Bone-white, smooth, from no creature"
                        " in any catalogue. The cranium is shaped"
                        " for a brain larger than biology typically permits."
                        " It is heavy with something that is not mass."
                    ),
                    "text_de": (
                        "Ein Sch\u00e4del. Knochenweiß, glatt, von keiner Kreatur"
                        " in irgendeinem Katalog. Das Cranium ist geformt"
                        " f\u00fcr ein Gehirn gr\u00f6\u00dfer als Biologie typischerweise erlaubt."
                        " Er ist schwer von etwas, das nicht Masse ist."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} holds the skull. Images leak through"
                        " \u2013 not memories but impressions."
                        " Scenes without context, emotions without events."
                        " Old dreams, stored in bone."
                    ),
                    "text_de": (
                        "{agent} h\u00e4lt den Sch\u00e4del. Bilder sickern durch"
                        " \u2013 keine Erinnerungen, sondern Eindr\u00fccke."
                        " Szenen ohne Kontext, Emotionen ohne Ereignisse."
                        " Alte Tr\u00e4ume, gespeichert in Knochen."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The skull is heavier."
                        " It has absorbed the party's own dreams"
                        " \u2013 not by force but by proximity."
                        " The bone is a medium."
                        " It stores what the waking mind discards."
                    ),
                    "text_de": (
                        "Der Sch\u00e4del ist schwerer."
                        " Er hat die Tr\u00e4ume des Trupps absorbiert"
                        " \u2013 nicht mit Gewalt, sondern durch N\u00e4he."
                        " Der Knochen ist ein Medium."
                        " Er speichert, was der wache Verstand verwirft."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The skull hums. Not with sound"
                        " \u2013 with recognition. It knows the party."
                        " The party's own unconscious, given a shape"
                        " that outlasts forgetting."
                    ),
                    "text_de": (
                        "Der Sch\u00e4del summt. Nicht mit Klang"
                        " \u2013 mit Wiedererkennung. Er kennt den Trupp."
                        " Das eigene Unbewusste des Trupps, dem eine Form"
                        " gegeben wurde, die das Vergessen \u00fcberdauert."
                    ),
                },
            },
        },
        {
            "id": "awakening_doorkeeper",
            "phases": {
                "discovery": {
                    "text_en": (
                        "A figure beside an open door."
                        " The figure does not block entry \u2013 it simply stands,"
                        " patient, as if arrival were the only purpose"
                        " of waiting. The door was always open."
                        " The figure has never closed it."
                    ),
                    "text_de": (
                        "Eine Gestalt neben einer offenen T\u00fcr."
                        " Die Gestalt versperrt nicht den Eintritt \u2013 sie steht einfach,"
                        " geduldig, als w\u00e4re Ankunft der einzige Zweck"
                        " des Wartens. Die T\u00fcr war immer offen."
                        " Die Gestalt hat sie nie geschlossen."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} addresses the figure."
                        " It does not respond with words"
                        " \u2013 it responds with stillness."
                        " The kind of stillness that is itself an answer."
                    ),
                    "text_de": (
                        "{agent} spricht die Gestalt an."
                        " Sie antwortet nicht mit Worten"
                        " \u2013 sie antwortet mit Stille."
                        " Die Art von Stille, die selbst eine Antwort ist."
                    ),
                },
                "mutation": {
                    "text_en": (
                        "The figure has aged. The door has not."
                        " The figure has been waiting"
                        " for the party's entire existence."
                        " The patience is not servitude. It is faith."
                    ),
                    "text_de": (
                        "Die Gestalt ist gealtert. Die T\u00fcr nicht."
                        " Die Gestalt hat auf den Trupp gewartet"
                        " f\u00fcr dessen gesamte Existenz."
                        " Die Geduld ist keine Knechtschaft. Sie ist Glaube."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The figure steps aside. There was never a barrier."
                        " The door was made for the party alone."
                        " The only thing between the party and the door"
                        " was the belief that something stood between them."
                    ),
                    "text_de": (
                        "Die Gestalt tritt zur Seite."
                        " Es gab nie eine Barriere."
                        " Die T\u00fcr wurde nur f\u00fcr den Trupp gemacht."
                        " Das Einzige zwischen dem Trupp und der T\u00fcr"
                        " war der Glaube, dass etwas dazwischen stand."
                    ),
                },
            },
        },
    ],
    # ── The Overthrow ────────────────────────────────────────────────────
    "The Overthrow": [
        {
            "id": "overthrow_faction_banner",
            "name_en": "Faction Banner",
            "name_de": "Fraktionsbanner",
            "phases": {
                "discovery": {
                    "text_en": "A banner. The insignia is familiar \u2013 from two rooms ago, where it meant something different.",
                    "text_de": "Ein Banner. Das Abzeichen ist vertraut \u2013 aus zwei R\u00e4umen zuvor, wo es etwas anderes bedeutete.",
                },
                "echo": {
                    "text_en": "The banner has been turned inside out. The same insignia, reversed. A faction's mirror image.",
                    "text_de": "Das Banner wurde umgedreht. Dasselbe Abzeichen, gespiegelt. Das Spiegelbild einer Fraktion.",
                },
                "mutation": {
                    "text_en": "The banner bears no insignia now. It bears a mirror. The mirror reflects whoever looks at it in faction colors.",
                    "text_de": "Das Banner trägt jetzt kein Abzeichen. Es trägt einen Spiegel. Der Spiegel reflektiert jeden, der hinsieht, in Fraktionsfarben.",
                },
                "climax": {
                    "text_en": "The banner is blank. All factions have claimed it. All factions have abandoned it. It flies for no one.",
                    "text_de": "Das Banner ist leer. Alle Fraktionen haben es beansprucht. Alle Fraktionen haben es aufgegeben. Es weht für niemanden.",
                },
            },
        },
        {
            "id": "overthrow_decree_stone",
            "name_en": "Decree Stone",
            "name_de": "Dekretstein",
            "phases": {
                "discovery": {
                    "text_en": "A stone tablet with a decree. The ink is fresh. The decree is reasonable.",
                    "text_de": "Eine Steintafel mit einem Dekret. Die Tinte ist frisch. Das Dekret ist vernünftig.",
                },
                "echo": {
                    "text_en": "The decree has been amended. The amendment contradicts the original. Both remain binding.",
                    "text_de": "Das Dekret wurde ergänzt. Die Ergänzung widerspricht dem Original. Beide bleiben bindend.",
                },
                "mutation": {
                    "text_en": "The stone now bears three decrees. They form a triangle of mutual contradiction. Each abolishes the one before it. The last abolishes itself.",
                    "text_de": "Der Stein tr\u00e4gt jetzt drei Dekrete. Sie bilden ein Dreieck gegenseitigen Widerspruchs. Jedes hebt das vorige auf. Das letzte hebt sich selbst auf.",
                },
                "climax": {
                    "text_en": "The decree stone is blank. Not erased \u2013 never inscribed. The authority to decree has been decreed nonexistent.",
                    "text_de": "Der Dekretstein ist leer. Nicht gel\u00f6scht \u2013 nie beschrieben. Die Autorit\u00e4t zu dekretieren wurde f\u00fcr inexistent dekretiert.",
                },
            },
        },
        {
            "id": "overthrow_informers_clipboard",
            "name_en": "Informer's Clipboard",
            "name_de": "Spitzels Klemmbrett",
            "phases": {
                "discovery": {
                    "text_en": "A clipboard with names. Some checked off. The party's names are listed but not yet checked.",
                    "text_de": "Ein Klemmbrett mit Namen. Einige abgehakt. Die Namen der Gruppe sind aufgelistet, aber noch nicht abgehakt.",
                },
                "echo": {
                    "text_en": "The clipboard has grown. More names. The handwriting changes \u2013 multiple informers, same list.",
                    "text_de": "Das Klemmbrett ist gewachsen. Mehr Namen. Die Handschrift wechselt \u2013 mehrere Spitzel, dieselbe Liste.",
                },
                "mutation": {
                    "text_en": "The informer's name is on the list now. The informer is being informed on. The system is recursive.",
                    "text_de": "Der Name des Spitzels steht jetzt auf der Liste. Der Spitzel wird bespitzelt. Das System ist rekursiv.",
                },
                "climax": {
                    "text_en": "Every name on the list is checked off. The list continues. There are no names left to check. The checking continues.",
                    "text_de": "Jeder Name auf der Liste ist abgehakt. Die Liste geht weiter. Es gibt keine Namen mehr zum Abhaken. Das Abhaken geht weiter.",
                },
            },
        },
        {
            "id": "overthrow_trial_chair",
            "name_en": "Trial Chair",
            "name_de": "Prozessstuhl",
            "phases": {
                "discovery": {
                    "text_en": "An empty chair in the center of a room. The room is arranged for a tribunal. The chair is for the accused.",
                    "text_de": "Ein leerer Stuhl in der Mitte eines Raums. Der Raum ist für ein Tribunal eingerichtet. Der Stuhl ist für den Angeklagten.",
                },
                "echo": {
                    "text_en": "The chair has been occupied. Recently. The warmth is still there. The verdict has already been passed.",
                    "text_de": "Der Stuhl war besetzt. Kürzlich. Die Wärme ist noch da. Das Urteil wurde bereits gefällt.",
                },
                "mutation": {
                    "text_en": "The chair faces a mirror now. The accused watches their own trial. The transcript writes itself in the margins. Every word is accurate. Every word is a lie.",
                    "text_de": "Der Stuhl steht jetzt vor einem Spiegel. Der Angeklagte beobachtet seinen eigenen Prozess. Das Protokoll schreibt sich in den R\u00e4ndern fort. Jedes Wort ist akkurat. Jedes Wort ist eine L\u00fcge.",
                },
                "climax": {
                    "text_en": "The chair is for the judge now. The accused is gone. The judge sits and realizes: the next trial is their own.",
                    "text_de": "Der Stuhl ist jetzt für den Richter. Der Angeklagte ist weg. Der Richter sitzt und erkennt: der nächste Prozess ist der eigene.",
                },
            },
        },
        {
            "id": "overthrow_mirror_corridor",
            "name_en": "Mirror Corridor",
            "name_de": "Spiegelkorridor",
            "phases": {
                "discovery": {
                    "text_en": "Mirrors on both walls. The reflections are accurate. Suspiciously accurate.",
                    "text_de": "Spiegel an beiden Wänden. Die Spiegelungen sind exakt. Verdächtig exakt.",
                },
                "echo": {
                    "text_en": "The reflections are slightly ahead of the party. They know where the party is going before the party does.",
                    "text_de": "Die Spiegelungen sind der Gruppe leicht voraus. Sie wissen, wohin die Gruppe geht, bevor die Gruppe es weiß.",
                },
                "mutation": {
                    "text_en": "The reflections wear different faction insignia than the party. The mirror shows allegiance, not appearance.",
                    "text_de": "Die Spiegelungen tragen andere Fraktionsabzeichen als die Gruppe. Der Spiegel zeigt Treue, nicht Aussehen.",
                },
                "climax": {
                    "text_en": "The mirrors face each other. Infinite recursion. Infinite factions. The Pretender is in every reflection.",
                    "text_de": "Die Spiegel stehen sich gegenüber. Unendliche Rekursion. Unendliche Fraktionen. Der Prätendent ist in jeder Spiegelung.",
                },
            },
        },
        {
            "id": "overthrow_propaganda_poster",
            "name_en": "Propaganda Poster",
            "name_de": "Propagandaplakat",
            "phases": {
                "discovery": {
                    "text_en": "A poster. The message is clear, the design effective. The font is authoritative. The colors are calming. It does not ask you to agree. It assumes you already do.",
                    "text_de": "Ein Plakat. Die Botschaft ist klar, das Design wirkungsvoll. Die Schrift ist autorit\u00e4r. Die Farben beruhigend. Es bittet nicht um Zustimmung. Es setzt sie voraus.",
                },
                "echo": {
                    "text_en": "The poster has been pasted over with a new one. The new poster says the opposite. The adhesive is the same.",
                    "text_de": "Das Plakat wurde mit einem neuen überklebt. Das neue Plakat sagt das Gegenteil. Der Klebstoff ist derselbe.",
                },
                "mutation": {
                    "text_en": "Both posters are visible now, layered. The contradiction is the message. Believe both. Believe neither. The skill is not choosing \u2013 it is holding both at once.",
                    "text_de": "Beide Plakate sind jetzt sichtbar, geschichtet. Der Widerspruch ist die Botschaft. Glaube beides. Glaube nichts. Die Kunst ist nicht das W\u00e4hlen \u2013 es ist das gleichzeitige Halten.",
                },
                "climax": {
                    "text_en": "The poster is blank. Not torn down \u2013 never printed. The propaganda has moved from paper into the air itself.",
                    "text_de": "Das Plakat ist leer. Nicht abgerissen \u2013 nie gedruckt. Die Propaganda ist vom Papier in die Luft selbst \u00fcbergegangen.",
                },
            },
        },
        {
            "id": "overthrow_scales_of_justice",
            "name_en": "Scales of Justice",
            "name_de": "Waage der Gerechtigkeit",
            "phases": {
                "discovery": {
                    "text_en": "Balanced scales. Both pans empty. The balance is perfect because nothing is being weighed.",
                    "text_de": "Ausbalancierte Waage. Beide Schalen leer. Die Balance ist perfekt, weil nichts gewogen wird.",
                },
                "echo": {
                    "text_en": "One pan holds a faction seal. The other holds a different faction seal. They weigh exactly the same.",
                    "text_de": "Eine Schale hält ein Fraktionssiegel. Die andere ein anderes Fraktionssiegel. Sie wiegen genau gleich.",
                },
                "mutation": {
                    "text_en": "A thumb on the scale. Whose thumb? The mirror behind the scales does not show a hand.",
                    "text_de": "Ein Daumen auf der Waage. Wessen Daumen? Der Spiegel hinter der Waage zeigt keine Hand.",
                },
                "climax": {
                    "text_en": "The scales tip. Both pans hit the ground simultaneously. Justice is not blind \u2013 justice has been dismissed.",
                    "text_de": "Die Waage kippt. Beide Schalen treffen gleichzeitig den Boden. Gerechtigkeit ist nicht blind \u2013 Gerechtigkeit wurde abgesetzt.",
                },
            },
        },
        {
            "id": "overthrow_colossus_pedestal",
            "phases": {
                "discovery": {
                    "text_en": (
                        "An empty pedestal. The stone is scarred where something"
                        " massive stood \u2013 not a statue but a presence,"
                        " large enough to cast a shadow that is still here."
                        " The shadow has not noticed it is empty."
                    ),
                    "text_de": (
                        "Ein leerer Sockel. Der Stein ist vernarbt,"
                        " wo etwas Massives stand \u2013 keine Statue,"
                        " sondern eine Pr\u00e4senz, gro\u00df genug,"
                        " um einen Schatten zu werfen, der immer noch hier ist."
                        " Der Schatten hat nicht bemerkt, dass er leer ist."
                    ),
                },
                "echo": {
                    "text_en": (
                        "{agent} reads the inscription on the pedestal."
                        " It says: 'The Colossus stands because you carry it.'"
                        " Below, in a different hand:"
                        " 'Stop carrying.'"
                    ),
                    "text_de": (
                        "{agent} liest die Inschrift auf dem Sockel."
                        " Sie lautet: \u00bbDer Koloss steht, weil ihr ihn tragt.\u00ab"
                        " Darunter, in einer anderen Handschrift:"
                        " \u00bbH\u00f6rt auf zu tragen.\u00ab"
                    ),
                },
                "mutation": {
                    "text_en": (
                        "Cracks in the pedestal \u2013 radiating downward."
                        " The Colossus did not fall. It was pulled."
                        " From below. By the hands that built it."
                        " The stone remembers every grip."
                    ),
                    "text_de": (
                        "Risse im Sockel \u2013 nach unten strahlend."
                        " Der Koloss ist nicht gefallen. Er wurde gezogen."
                        " Von unten. Von den H\u00e4nden, die ihn gebaut haben."
                        " Der Stein erinnert sich an jeden Griff."
                    ),
                },
                "climax": {
                    "text_en": (
                        "The pedestal is being rebuilt."
                        " Fresh mortar, new inscription, same dimensions."
                        " The builders are the ones who pulled the last one down."
                        " They have not noticed. The blueprints are the same."
                    ),
                    "text_de": (
                        "Der Sockel wird wieder aufgebaut."
                        " Frischer M\u00f6rtel, neue Inschrift, selbe Ma\u00dfe."
                        " Die Baumeister sind die, die den letzten heruntergerissen haben."
                        " Sie haben es nicht bemerkt. Die Baupl\u00e4ne sind dieselben."
                    ),
                },
            },
        },
    ],
}


# ══════════════════════════════════════════════════════════════════════════════
# ── Objektanker: Variation B — "Resonanz-Barometer" ──────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
#
# One fixed object per archetype. Reacts to archetype_state thresholds.
# Displayed only when the tier CHANGES (no spam). 4 tiers per archetype.
# ─────────────────────────────────────────────────────────────────────────────

BAROMETER_TEXTS: dict[str, list[dict]] = {
    # ── Shadow: "Der Bernstein" (Visibility barometer) ────────────────────
    "The Shadow": [
        {
            "tier": 0,
            "text_en": ("The amber terminal glow pulses steadily. Warm. Present. It knows where you are."),
            "text_de": (
                "Das Bernsteinleuchten des Terminals pulsiert gleichm\u00e4\u00dfig."
                " Warm. Gegenw\u00e4rtig. Es wei\u00df, wo ihr seid."
            ),
        },
        {
            "tier": 1,
            "text_en": ("The amber glow flickers. For the first time, the terminal seems uncertain."),
            "text_de": ("Das Bernsteinleuchten flackert. Zum ersten Mal wirkt das Terminal unsicher."),
        },
        {
            "tier": 2,
            "text_en": (
                "The amber is fading."
                " The terminal light gutters like a candle"
                " in a draft that should not exist in a digital space."
            ),
            "text_de": (
                "Das Bernstein verblasst."
                " Das Terminallicht flackert wie eine Kerze"
                " im Durchzug, den es in einem digitalen Raum nicht geben sollte."
            ),
        },
        {
            "tier": 3,
            "text_en": (
                "The amber is gone. The terminal is dark."
                " You are operating from memory now,"
                " and memory is exactly what the darkness consumes first."
            ),
            "text_de": (
                "Das Bernstein ist erloschen. Das Terminal ist dunkel."
                " Ihr operiert aus der Erinnerung,"
                " und Erinnerung ist genau das,"
                " was die Dunkelheit zuerst verzehrt."
            ),
        },
    ],
    # ── Tower: "Der Riss" (Structural Integrity barometer) ────────────────
    "The Tower": [
        {
            "tier": 0,
            "text_en": ("A hairline crack in the east wall. Cosmetic. The building compensates."),
            "text_de": ("Ein Haarriss in der Ostwand. Kosmetisch. Das Geb\u00e4ude kompensiert."),
        },
        {
            "tier": 1,
            "text_en": ("The crack has branched. The building no longer compensates \u2013 it negotiates."),
            "text_de": ("Der Riss hat sich verzweigt. Das Geb\u00e4ude kompensiert nicht mehr \u2013 es verhandelt."),
        },
        {
            "tier": 2,
            "text_en": (
                "The crack network spans the room."
                " Through it, you can see the floor below."
                " Through that, another floor."
                " The building is becoming transparent in its failure."
            ),
            "text_de": (
                "Das Rissnetzwerk durchzieht den Raum."
                " Durch ihn seht ihr das Stockwerk darunter."
                " Durch jenes ein weiteres."
                " Das Geb\u00e4ude wird transparent in seinem Versagen."
            ),
        },
        {
            "tier": 3,
            "text_en": (
                "The crack is the room."
                " The walls are suggestions. The floor is a theory."
                " The building has stopped pretending."
            ),
            "text_de": (
                "Der Riss ist der Raum."
                " Die W\u00e4nde sind Vorschl\u00e4ge. Der Boden ist eine Theorie."
                " Das Geb\u00e4ude hat aufgeh\u00f6rt, so zu tun als ob."
            ),
        },
    ],
    # ── Mother: "Die Temperatur" (Attachment barometer) ───────────────────
    "The Devouring Mother": [
        {
            "tier": 0,
            "text_en": ("The air is warm. Comfortable. The kind of warmth that asks nothing of you."),
            "text_de": ("Die Luft ist warm. Behaglich. Die Art von W\u00e4rme, die nichts von euch verlangt."),
        },
        {
            "tier": 1,
            "text_en": (
                "The warmth has learned your names."
                " It wraps around wounded agents first."
                " Attentive. Helpful. You did not ask for this."
            ),
            "text_de": (
                "Die W\u00e4rme hat eure Namen gelernt."
                " Sie legt sich zuerst um verwundete Agenten."
                " Aufmerksam. Hilfsbereit. Ihr habt nicht darum gebeten."
            ),
        },
        {
            "tier": 2,
            "text_en": (
                "The warmth is possessive now."
                " It does not let go when you stand."
                " Moving through it feels like pulling free of an embrace"
                " that does not understand the word 'enough.'"
            ),
            "text_de": (
                "Die W\u00e4rme ist besitzergreifend jetzt."
                " Sie l\u00e4sst nicht los, wenn ihr aufsteht."
                " Sich durch sie zu bewegen f\u00fchlt sich an"
                " wie das L\u00f6sen aus einer Umarmung,"
                " die das Wort \u00bbgenug\u00ab nicht versteht."
            ),
        },
        {
            "tier": 3,
            "text_en": (
                "The warmth is indistinguishable from you."
                " Where it ends and you begin"
                " is a question that no longer has a clear answer."
                " It does not hurt. That is the worst part."
            ),
            "text_de": (
                "Die W\u00e4rme ist nicht mehr von euch zu unterscheiden."
                " Wo sie aufh\u00f6rt und ihr beginnt,"
                " ist eine Frage, die keine klare Antwort mehr hat."
                " Es tut nicht weh. Das ist das Schlimmste."
            ),
        },
    ],
    # ── Entropy: "Die Farbe" (Decay barometer) ────────────────────────────
    "The Entropy": [
        {
            "tier": 0,
            "text_en": (
                "The walls retain color. Faded, but distinguishable."
                " This room was green once. Or blue."
                " The difference still matters."
            ),
            "text_de": (
                "Die W\u00e4nde haben noch Farbe. Verblasst, aber unterscheidbar."
                " Dieser Raum war einmal gr\u00fcn. Oder blau."
                " Der Unterschied z\u00e4hlt noch."
            ),
        },
        {
            "tier": 1,
            "text_en": (
                "The color is retreating. Not fading \u2013 redistributing."
                " Every surface is approaching the same shade."
            ),
            "text_de": (
                "Die Farbe weicht zur\u00fcck."
                " Nicht verblassend \u2013 umverteilend."
                " Jede Oberfl\u00e4che n\u00e4hert sich demselben Ton."
            ),
        },
        {
            "tier": 2,
            "text_en": ("Grey. Not the grey of concrete or ash \u2013 the grey of averaged everything."),
            "text_de": ("Grau. Nicht das Grau von Beton oder Asche \u2013 das Grau des Durchschnitts von allem."),
        },
        {
            "tier": 3,
            "text_en": "Same.",
            "text_de": "Gleich.",
        },
    ],
    # ── Prometheus: "Die Flamme" (Insight barometer) ─────────────────────
    "The Prometheus": [
        {
            "tier": 0,
            "text_en": (
                "The forge is cold. Tools rest in their places."
                " The workshop presents itself with clinical patience."
                " Materials await hands. The fire has not yet been stolen."
            ),
            "text_de": (
                "Die Schmiede ist kalt. Werkzeuge ruhen an ihren Plätzen."
                " Die Werkstatt präsentiert sich mit klinischer Geduld."
                " Materialien warten auf Hände."
                " Das Feuer wurde noch nicht gestohlen."
            ),
        },
        {
            "tier": 1,
            "text_en": (
                "The forge warms. The first sparks have been struck."
                " Components respond to proximity \u2013 not yet with intent,"
                " but with interest. The workshop is watching what the party does."
            ),
            "text_de": (
                "Die Schmiede erwärmt sich. Die ersten Funken wurden geschlagen."
                " Komponenten reagieren auf Nähe \u2013 noch nicht mit Absicht,"
                " aber mit Interesse."
                " Die Werkstatt beobachtet, was der Trupp tut."
            ),
        },
        {
            "tier": 2,
            "text_en": (
                "The fire burns steady. The workshop has opened its deeper"
                " chambers. Materials levitate briefly before settling."
                " The air tastes of ambition."
                " Every surface is warm to the touch."
            ),
            "text_de": (
                "Das Feuer brennt gleichmäßig. Die Werkstatt hat ihre tieferen"
                " Kammern geöffnet. Materialien schweben kurz, bevor sie sich"
                " setzen. Die Luft schmeckt nach Ambition."
                " Jede Oberfläche ist warm bei Berührung."
            ),
        },
        {
            "tier": 3,
            "text_en": (
                "White heat. The workshop is no longer subtle."
                " Components arrange themselves without being touched."
                " The forge-glow pulses in time with the party's breathing."
                " The fire knows. The fire burns."
            ),
            "text_de": (
                "Weißglut. Die Werkstatt ist nicht mehr subtil."
                " Komponenten ordnen sich an, ohne berührt zu werden."
                " Das Schmiedeglühen pulsiert im Takt der Atmung des Trupps."
                " Das Feuer weiß. Das Feuer brennt."
            ),
        },
    ],
    # ── Deluge: "Der Pegel" (Water Level barometer) ──────────────────────
    "The Deluge": [
        {
            "tier": 0,
            "text_en": (
                "The water is present but patient."
                " It laps at the lowest edges of the corridor"
                " with the rhythm of something that has not yet decided to rise."
                " The sound is almost gentle."
            ),
            "text_de": (
                "Das Wasser ist da, aber geduldig."
                " Es leckt an den niedrigsten Kanten des Korridors"
                " im Rhythmus von etwas, das sich noch nicht entschieden hat zu steigen."
                " Das Ger\u00e4usch ist beinahe sanft."
            ),
        },
        {
            "tier": 1,
            "text_en": (
                "The water has risen. Not gradually \u2013 in the time"
                " between noticing and measuring, it gained another centimeter."
                " The current has found a direction."
                " It is moving inward."
            ),
            "text_de": (
                "Das Wasser ist gestiegen. Nicht allm\u00e4hlich \u2013 in der Zeit"
                " zwischen Bemerken und Messen hat es einen weiteren Zentimeter gewonnen."
                " Die Str\u00f6mung hat eine Richtung gefunden."
                " Sie bewegt sich nach innen."
            ),
        },
        {
            "tier": 2,
            "text_en": (
                "The water is no longer patient. It pushes."
                " The sound has changed from lapping to pressure"
                " \u2013 the low, constant hum of volume"
                " looking for somewhere to go."
                " It is finding places."
            ),
            "text_de": (
                "Das Wasser ist nicht mehr geduldig. Es dr\u00e4ngt."
                " Das Ger\u00e4usch hat sich von Pl\u00e4tschern zu Druck ver\u00e4ndert"
                " \u2013 das tiefe, gleichm\u00e4\u00dfige Summen von Volumen,"
                " das einen Ort sucht."
                " Es findet welche."
            ),
        },
        {
            "tier": 3,
            "text_en": (
                "The water is here. Not rising \u2013 arrived."
                " It fills the space the way an answer fills a question:"
                " completely, and with the weight of having always been inevitable."
            ),
            "text_de": (
                "Das Wasser ist da. Nicht steigend \u2013 angekommen."
                " Es f\u00fcllt den Raum wie eine Antwort eine Frage f\u00fcllt:"
                " vollst\u00e4ndig, und mit dem Gewicht, immer unvermeidlich gewesen zu sein."
            ),
        },
    ],
    # ── Awakening: "Das Bewusstsein" (Awareness barometer) ───────────────
    "The Awakening": [
        {
            "tier": 0,
            "text_en": (
                "The rooms are quiet in a way that suggests sleep"
                " \u2013 not absence but suspension."
                " The walls register the party's presence"
                " the way a dreamer registers a distant sound."
            ),
            "text_de": (
                "Die R\u00e4ume sind still auf eine Art, die Schlaf nahelegt"
                " \u2013 nicht Abwesenheit, sondern Suspension."
                " Die W\u00e4nde registrieren die Pr\u00e4senz des Trupps"
                " wie ein Tr\u00e4umender ein fernes Ger\u00e4usch registriert."
            ),
        },
        {
            "tier": 1,
            "text_en": (
                "Something has shifted. The corridors respond"
                " a fraction faster now \u2013 lights adjust before"
                " the party rounds a corner, doors settle into frames"
                " as if preparing. The dungeon is stirring."
            ),
            "text_de": (
                "Etwas hat sich verschoben. Die Korridore reagieren"
                " einen Bruchteil schneller jetzt \u2013 Lichter passen sich an,"
                " bevor der Trupp um eine Ecke biegt, T\u00fcren f\u00fcgen sich"
                " in Rahmen, als bereiteten sie sich vor."
                " Der Dungeon erwacht."
            ),
        },
        {
            "tier": 2,
            "text_en": (
                "The dungeon is watching. Not with eyes"
                " \u2013 with attention. The geometry of each room"
                " seems arranged for observation."
                " The party is not exploring. The party is being perceived."
            ),
            "text_de": (
                "Der Dungeon beobachtet. Nicht mit Augen"
                " \u2013 mit Aufmerksamkeit. Die Geometrie jedes Raums"
                " wirkt wie f\u00fcr Beobachtung arrangiert."
                " Der Trupp erkundet nicht. Der Trupp wird wahrgenommen."
            ),
        },
        {
            "tier": 3,
            "text_en": (
                "The dungeon remembers. Every room the party has entered,"
                " every choice they have made \u2013 the walls hold it all,"
                " and they are no longer passive."
                " What was asleep is awake. What is awake is thinking."
            ),
            "text_de": (
                "Der Dungeon erinnert sich. Jeden Raum, den der Trupp"
                " betreten hat, jede Entscheidung \u2013 die W\u00e4nde halten alles,"
                " und sie sind nicht mehr passiv."
                " Was schlief, ist wach. Was wach ist, denkt."
            ),
        },
    ],
    # ── Overthrow: "Die Autorit\u00e4t" (Authority Fracture barometer) ─────────
    "The Overthrow": [
        {
            "tier": 0,
            "text_en": (
                "The corridors are ordered. Signs point in consistent directions."
                " The insignia on the walls match. Someone is in charge here,"
                " and the architecture believes them."
            ),
            "text_de": (
                "Die Korridore sind geordnet. Schilder weisen in konsistente Richtungen."
                " Die Abzeichen an den W\u00e4nden stimmen \u00fcberein."
                " Jemand hat hier das Sagen,"
                " und die Architektur glaubt ihnen."
            ),
        },
        {
            "tier": 1,
            "text_en": (
                "A sign has been corrected. The original direction"
                " is visible beneath the amendment."
                " Two versions of authority overlap"
                " \u2013 the first confident, the second insistent."
            ),
            "text_de": (
                "Ein Schild wurde korrigiert. Die urspr\u00fcngliche Richtung"
                " ist unter der \u00c4nderung sichtbar."
                " Zwei Versionen von Autorit\u00e4t \u00fcberlagern sich"
                " \u2013 die erste zuversichtlich, die zweite bestimmt."
            ),
        },
        {
            "tier": 2,
            "text_en": (
                "The signs contradict each other."
                " Three factions have posted directions to the same corridor,"
                " each claiming a different destination."
                " The architecture has stopped choosing."
            ),
            "text_de": (
                "Die Schilder widersprechen einander."
                " Drei Fraktionen haben Wegweiser zum selben Korridor angebracht,"
                " jede mit einem anderen Ziel."
                " Die Architektur hat aufgeh\u00f6rt zu w\u00e4hlen."
            ),
        },
        {
            "tier": 3,
            "text_en": (
                "No signs. The walls are bare. Every faction's insignia"
                " has been torn down, painted over, torn down again."
                " The corridors lead everywhere and nowhere."
                " Authority is a rumor. The building is listening"
                " for whoever speaks next."
            ),
            "text_de": (
                "Keine Schilder. Die W\u00e4nde sind kahl."
                " Die Abzeichen jeder Fraktion wurden heruntergerissen,"
                " \u00fcbermalt, erneut heruntergerissen."
                " Die Korridore f\u00fchren \u00fcberallhin und nirgendwohin."
                " Autorit\u00e4t ist ein Ger\u00fccht. Das Geb\u00e4ude h\u00f6rt zu,"
                " wer als N\u00e4chstes spricht."
            ),
        },
    ],
}


# ── Anchor/Barometer Selection Functions ──────────────────────────────────


def _barometer_tier(archetype: str, archetype_state: dict) -> int:
    """Calculate the current barometer tier (0-3) from archetype state."""
    if archetype == "The Shadow":
        vis = archetype_state.get("visibility", 3)
        return {3: 0, 2: 1, 1: 2}.get(vis, 3)
    if archetype == "The Tower":
        stability = archetype_state.get("stability", 100)
        if stability >= 80:
            return 0
        if stability >= 50:
            return 1
        if stability >= 25:
            return 2
        return 3
    if archetype == "The Devouring Mother":
        attachment = archetype_state.get("attachment", 0)
        if attachment <= 30:
            return 0
        if attachment <= 60:
            return 1
        if attachment <= 85:
            return 2
        return 3
    if archetype == "The Entropy":
        decay = archetype_state.get("decay", 0)
        if decay <= 20:
            return 0
        if decay <= 50:
            return 1
        if decay <= 80:
            return 2
        return 3
    if archetype == "The Prometheus":
        insight = archetype_state.get("insight", 0)
        if insight < 20:
            return 0
        if insight < 45:
            return 1
        if insight < 75:
            return 2
        return 3
    if archetype == "The Deluge":
        water = archetype_state.get("water_level", 0)
        if water <= 24:
            return 0
        if water <= 49:
            return 1
        if water <= 74:
            return 2
        return 3
    if archetype == "The Awakening":
        awareness = archetype_state.get("awareness", 0)
        if awareness <= 24:
            return 0
        if awareness <= 49:
            return 1
        if awareness <= 69:
            return 2
        return 3
    if archetype == "The Overthrow":
        fracture = archetype_state.get("fracture", 0)
        if fracture <= 19:
            return 0
        if fracture <= 59:
            return 1
        if fracture <= 79:
            return 2
        return 3
    return 0


def get_barometer_text(
    archetype: str,
    archetype_state: dict,
    last_tier: int,
) -> tuple[dict | None, int]:
    """Get barometer text if the tier has changed since last display.

    Returns (text_dict_or_None, new_tier).
    Only returns text when current tier != last_tier (prevents spam).
    """
    current_tier = _barometer_tier(archetype, archetype_state)
    if current_tier == last_tier:
        return None, last_tier
    from backend.services.dungeon_content_service import get_barometer_registry

    tiers = get_barometer_registry().get(archetype, [])
    for entry in tiers:
        if entry["tier"] == current_tier:
            return {"text_en": entry["text_en"], "text_de": entry["text_de"]}, current_tier
    return None, last_tier


def select_anchor_text(
    instance: DungeonInstance,
    target_room: RoomNode,
) -> list[AnchorTextResult]:
    """Select anchor object text(s) for the current room entry.

    Phase selection rules:
    - discovery: Depth 1-3, first encounter/rest/treasure/combat room, object not yet shown
    - echo:      Depth 2+, any room type, object shown discovery but not echo
    - mutation:  Depth 3+, encounter/rest/treasure rooms, object shown echo but not mutation
    - climax:    Boss room only, object shown at least discovery, not yet shown climax

    Returns list of dicts with text_en, text_de, anchor_id, phase.
    Boss room returns up to 2 (both climaxes). Normal rooms return 0 or 1.
    """
    from backend.services.dungeon_content_service import get_anchor_objects

    anchor_pool = get_anchor_objects().get(instance.archetype, [])
    # Build lookup: id → object data
    obj_lookup = {obj["id"]: obj for obj in anchor_pool}

    # Determine which objects are active this run
    active_ids = instance.anchor_objects
    if not active_ids:
        return []

    results: list[AnchorTextResult] = []

    # Phase order for priority (lower index = higher priority for non-boss rooms)
    phase_order = ["discovery", "echo", "mutation", "climax"]

    for obj_id in active_ids:
        obj = obj_lookup.get(obj_id)
        if not obj:
            continue

        shown = set(instance.anchor_phases_shown.get(obj_id, []))
        depth = target_room.depth
        room_type = target_room.room_type
        is_narrative_room = room_type in ("encounter", "rest", "treasure")
        is_boss = room_type == "boss"

        eligible_phase: str | None = None

        if is_boss and "climax" not in shown and "discovery" in shown:
            eligible_phase = "climax"
        elif "discovery" not in shown and depth <= 3:
            eligible_phase = "discovery"
        elif "echo" not in shown and "discovery" in shown and depth >= 2:
            eligible_phase = "echo"
        elif "mutation" not in shown and "echo" in shown and depth >= 3 and is_narrative_room:
            eligible_phase = "mutation"

        if eligible_phase and eligible_phase in obj.get("phases", {}):
            phase_data = obj["phases"][eligible_phase]
            results.append(
                {
                    "text_en": phase_data["text_en"],
                    "text_de": phase_data["text_de"],
                    "anchor_id": obj_id,
                    "phase": eligible_phase,
                }
            )

    # Boss room: return all climaxes (special case — both objects shown)
    if target_room.room_type == "boss":
        return results

    # Non-boss: return at most 1, preferring lowest phase (discovery > echo > mutation)
    if len(results) <= 1:
        return results

    def phase_priority(r: dict) -> int:
        try:
            return phase_order.index(r["phase"])
        except ValueError:
            return 99

    results.sort(key=phase_priority)
    return results[:1]
