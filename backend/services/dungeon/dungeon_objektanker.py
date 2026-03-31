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
                        "{agent} pauses. The whisper again. Closer."
                        " It has found vowels now. It is practicing."
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
                    "text_en": (
                        "The Crown Keeper's clock. One hand."
                        " It points at you."
                        " It has always pointed at you."
                    ),
                    "text_de": (
                        "Die Uhr des Crown Keepers. Ein Zeiger."
                        " Er zeigt auf euch."
                        " Er hat immer auf euch gezeigt."
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
                        "{agent} finds the clock again. Or a clock."
                        " They are becoming difficult to distinguish."
                    ),
                    "text_de": (
                        "{agent} findet die Uhr wieder. Oder eine Uhr."
                        " Sie werden schwer zu unterscheiden."
                    ),
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
                    "text_en": (
                        "Scale. Pans. Equal."
                        " The objects in them are the same color now."
                        " Same texture. Same."
                    ),
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
                    "text_en": (
                        "Photo. Figures. Grey."
                        " Same height, same width."
                        " Background same grey as figures."
                    ),
                    "text_de": (
                        "Foto. Gestalten. Grau."
                        " Selbe H\u00f6he, selbe Breite."
                        " Hintergrund selbes Grau wie Gestalten."
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
                        "Key. Cylinder. Teeth gone."
                        " Shaft. Metal."
                        " Same metal as the door. Same metal as the lock."
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
                        "Compass. Needle still."
                        " Not pointing. Not spinning."
                        " The markings have faded into the dial."
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
                        "Mirror. Surface. Grey."
                        " It reflects the room. It reflects you."
                        " There is no difference."
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
            "text_en": (
                "The amber terminal glow pulses steadily."
                " Warm. Present. It knows where you are."
            ),
            "text_de": (
                "Das Bernsteinleuchten des Terminals pulsiert gleichm\u00e4\u00dfig."
                " Warm. Gegenw\u00e4rtig. Es wei\u00df, wo ihr seid."
            ),
        },
        {
            "tier": 1,
            "text_en": (
                "The amber glow flickers."
                " For the first time, the terminal seems uncertain."
            ),
            "text_de": (
                "Das Bernsteinleuchten flackert."
                " Zum ersten Mal wirkt das Terminal unsicher."
            ),
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
            "text_en": (
                "A hairline crack in the east wall."
                " Cosmetic. The building compensates."
            ),
            "text_de": (
                "Ein Haarriss in der Ostwand."
                " Kosmetisch. Das Geb\u00e4ude kompensiert."
            ),
        },
        {
            "tier": 1,
            "text_en": (
                "The crack has branched."
                " The building no longer compensates \u2013 it negotiates."
            ),
            "text_de": (
                "Der Riss hat sich verzweigt."
                " Das Geb\u00e4ude kompensiert nicht mehr \u2013 es verhandelt."
            ),
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
            "text_en": (
                "The air is warm. Comfortable."
                " The kind of warmth that asks nothing of you."
            ),
            "text_de": (
                "Die Luft ist warm. Behaglich."
                " Die Art von W\u00e4rme, die nichts von euch verlangt."
            ),
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
            "text_en": (
                "Grey. Not the grey of concrete or ash"
                " \u2013 the grey of averaged everything."
            ),
            "text_de": (
                "Grau. Nicht das Grau von Beton oder Asche"
                " \u2013 das Grau des Durchschnitts von allem."
            ),
        },
        {
            "tier": 3,
            "text_en": "Same.",
            "text_de": "Gleich.",
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
    tiers = BAROMETER_TEXTS.get(archetype, [])
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
    anchor_pool = ANCHOR_OBJECTS.get(instance.archetype, [])
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
            results.append({
                "text_en": phase_data["text_en"],
                "text_de": phase_data["text_de"],
                "anchor_id": obj_id,
                "phase": eligible_phase,
            })

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
