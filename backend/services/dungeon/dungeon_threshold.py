"""Threshold room content — archetype-specific texts for the liminal toll room.

The Threshold is a structural element (not random content), so texts live here
as Python constants rather than in the DB encounter template system.

Pattern: dungeon_banter.py (archetype-keyed text registries).
"""

from __future__ import annotations

# ── Threshold Choice Definitions ────────────────────────────────────────────
# These are formatted into the encounter choice structure by the movement
# service. They use the same shape as EncounterChoice for frontend compatibility
# but are NOT EncounterTemplate instances (no DB backing, no random selection).

THRESHOLD_CHOICES: list[dict] = [
    {
        "id": "threshold_blood",
        "label_en": "Blood Toll",
        "label_de": "Blutzoll",
        "description_en": "A wound, freely given. One operative takes one condition step. Known cost.",
        "description_de": "Eine Wunde, freiwillig gegeben. Ein Operativer erleidet eine Zustandsstufe. Bekannter Preis.",
    },
    {
        "id": "threshold_memory",
        "label_en": "Memory Toll",
        "label_de": "Erinnerungszoll",
        "description_en": "Something forgotten. You will not know what was taken. Unknown cost.",
        "description_de": "Etwas Vergessenes. Du wirst nicht wissen, was genommen wurde. Unbekannter Preis.",
    },
    {
        "id": "threshold_defiance",
        "label_en": "Defiance",
        "label_de": "Trotz",
        "description_en": "Pass without tribute. The passage remembers. Deferred cost.",
        "description_de": "Passiere ohne Tribut. Der Durchgang erinnert sich. Aufgeschobener Preis.",
    },
]


# ── Archetype-Specific Entry Texts ──────────────────────────────────────────
# Sparse, literary prose. Short lines. The silence IS the mechanic.

THRESHOLD_ENTRY_TEXT: dict[str, dict[str, str]] = {
    "The Shadow": {
        "en": (
            "The corridor ends. Not in a wall. Not in a door. "
            "In a stillness. The air is different here \u2013 thicker. "
            "The echo of your footsteps returns a fraction of a second late. "
            "The darkness does not block your path. It asks."
        ),
        "de": (
            "Der Korridor endet. Nicht in einer Wand. Nicht in einer T\u00fcr. "
            "In einer Stille. Die Luft ist hier anders \u2013 dichter. "
            "Das Echo eurer Schritte kehrt einen Sekundenbruchteil zu sp\u00e4t zur\u00fcck. "
            "Die Dunkelheit versperrt euch nicht den Weg. Sie fragt."
        ),
    },
    "The Tower": {
        "en": (
            "The staircase narrows to a single step. Above: the final floor. "
            "The structure hums with a frequency you feel in your teeth. "
            "A door that is not a door. A price that is not a price. "
            "The Tower does not beg. It informs."
        ),
        "de": (
            "Die Treppe verengt sich auf eine einzige Stufe. Dar\u00fcber: das letzte Stockwerk. "
            "Das Geb\u00e4ude brummt in einer Frequenz, die ihr in den Z\u00e4hnen sp\u00fcrt. "
            "Eine T\u00fcr, die keine T\u00fcr ist. Ein Preis, der kein Preis ist. "
            "Der Turm bittet nicht. Er informiert."
        ),
    },
    "The Entropy": {
        "en": (
            "The walls here have stopped decaying. Not because they are intact "
            "\u2013 because there is nothing left to decay. A perfect gradient "
            "from something to nothing. The threshold between form and dissolution. "
            "It asks, gently, what you are willing to release."
        ),
        "de": (
            "Die W\u00e4nde hier haben aufgeh\u00f6rt zu verfallen. Nicht weil sie intakt sind "
            "\u2013 weil es nichts mehr gibt, das verfallen k\u00f6nnte. Ein perfekter Gradient "
            "von Etwas zu Nichts. Die Schwelle zwischen Form und Aufl\u00f6sung. "
            "Sie fragt, sanft, was ihr bereit seid loszulassen."
        ),
    },
    "The Devouring Mother": {
        "en": (
            "The passage is warm. Not the warmth of fire \u2013 the warmth of breath. "
            "Of something alive, close, waiting. The walls pulse with a rhythm "
            "you recognise but cannot name. She does not block the way. "
            "She asks you to stay. Just a moment longer."
        ),
        "de": (
            "Der Durchgang ist warm. Nicht die W\u00e4rme des Feuers \u2013 die W\u00e4rme des Atems. "
            "Von etwas Lebendigem, Nahem, Wartendem. Die W\u00e4nde pulsieren in einem Rhythmus, "
            "den ihr erkennt, aber nicht benennen k\u00f6nnt. Sie versperrt nicht den Weg. "
            "Sie bittet euch zu bleiben. Nur einen Moment l\u00e4nger."
        ),
    },
    "The Prometheus": {
        "en": (
            "The forge is cold. The hammers are still. At the threshold "
            "of the final chamber, the fire asks for fuel. Not wood, not coal. "
            "Something you carry that burns. The question is not whether "
            "you will pay \u2013 but what you are willing to burn."
        ),
        "de": (
            "Die Schmiede ist kalt. Die H\u00e4mmer ruhen. An der Schwelle "
            "der letzten Kammer fordert das Feuer Brennstoff. Kein Holz, keine Kohle. "
            "Etwas, das ihr tragt und das brennt. Die Frage ist nicht, ob "
            "ihr zahlt \u2013 sondern was ihr bereit seid zu verbrennen."
        ),
    },
    "The Deluge": {
        "en": (
            "The water is still. Not calm \u2013 still. The kind of stillness "
            "that precedes depth. The surface reflects nothing. Below it, "
            "the passage continues. The current does not pull. "
            "It waits. It has always been patient."
        ),
        "de": (
            "Das Wasser ist still. Nicht ruhig \u2013 still. Die Art von Stille, "
            "die der Tiefe vorausgeht. Die Oberfl\u00e4che spiegelt nichts. Darunter "
            "setzt sich der Durchgang fort. Die Str\u00f6mung zieht nicht. "
            "Sie wartet. Sie war schon immer geduldig."
        ),
    },
    "The Overthrow": {
        "en": (
            "The corridor opens into a court. Not a room \u2013 a tribunal. "
            "Empty seats. A raised platform. The architecture of judgement "
            "without judges. The proclamation has been written. "
            "All that remains is the signature."
        ),
        "de": (
            "Der Korridor \u00f6ffnet sich zu einem Hof. Kein Raum \u2013 ein Tribunal. "
            "Leere Sitze. Eine erh\u00f6hte Plattform. Die Architektur des Urteils "
            "ohne Richter. Die Proklamation ist geschrieben. "
            "Es fehlt nur die Unterschrift."
        ),
    },
    "The Awakening": {
        "en": (
            "The mirror stands where the passage should be. Not reflecting \u2013 showing. "
            "Something that looks like you but moves a fraction of a second before you do. "
            "The reflection is not copying. It is remembering. "
            "It asks, quietly, what you are willing to forget."
        ),
        "de": (
            "Der Spiegel steht dort, wo der Durchgang sein sollte. Nicht spiegelnd \u2013 zeigend. "
            "Etwas, das euch \u00e4hnelt, sich aber einen Sekundenbruchteil fr\u00fcher bewegt als ihr. "
            "Die Spiegelung kopiert nicht. Sie erinnert sich. "
            "Sie fragt, leise, was ihr bereit seid zu vergessen."
        ),
    },
}


# ── Resolution Narratives ───────────────────────────────────────────────────

THRESHOLD_RESOLUTION_TEXT: dict[str, dict[str, dict[str, str]]] = {
    "threshold_blood": {
        "en": {
            "narrative": "The passage accepts. The wound is given. The way opens.",
            "system": "{agent_name}: {old_condition} \u2192 {new_condition}",
        },
        "de": {
            "narrative": "Der Durchgang akzeptiert. Die Wunde wird gegeben. Der Weg \u00f6ffnet sich.",
            "system": "{agent_name}: {old_condition} \u2192 {new_condition}",
        },
    },
    "threshold_memory": {
        "en": {
            "narrative": "Something is lighter. Something is gone. You cannot name it.",
        },
        "de": {
            "narrative": "Etwas ist leichter. Etwas ist fort. Ihr k\u00f6nnt es nicht benennen.",
        },
    },
    "threshold_defiance": {
        "en": {
            "narrative": "You walk through. Nothing stops you. Somewhere ahead, something adjusts.",
        },
        "de": {
            "narrative": "Ihr geht hindurch. Nichts h\u00e4lt euch auf. Irgendwo voraus passt sich etwas an.",
        },
    },
}
