"""Dungeon enemy templates and combat logic.

Contains enemy templates, spawn configurations, and combat logic for all archetypes.
Archetype data is stored in registries keyed by archetype name.
All combat resolution is delegated to the shared combat/ module.

Enemy Design Principles:
- Minions (1-2 condition steps): chaff, dispatched quickly, primarily stress threats
- Standard (2-3 steps): core enemies, interesting action variety
- Elite (4-5 steps): mini-bosses with special abilities, spawn minions
- Boss: multi-phase, unique mechanics per archetype
"""

from __future__ import annotations

import logging
import random
from uuid import uuid4

import sentry_sdk

from backend.models.resonance_dungeon import EnemyInstance, EnemyTemplate

logger = logging.getLogger(__name__)

# ── Shadow Enemy Templates ──────────────────────────────────────────────────

SHADOW_ENEMIES: dict[str, EnemyTemplate] = {
    "shadow_wisp": EnemyTemplate(
        id="shadow_wisp",
        name_en="Shadow Wisp",
        name_de="Schattenglimmer",
        archetype="The Shadow",
        condition_threshold=1,
        stress_resistance=50,
        threat_level="minion",
        attack_aptitude="infiltrator",
        attack_power=2,
        stress_attack_power=4,
        telegraphed_intent=True,
        evasion=40,
        resistances=["assassin"],
        vulnerabilities=["spy"],
        action_weights={"stress_attack": 60, "evade": 30, "ambient": 10},
        description_en=(
            "A flickering presence at the edge of perception. It doesn't attack the body \u2013 it erodes certainty."
        ),
        description_de=(
            "Eine flackernde Präsenz am Rand der Wahrnehmung. "
            "Sie greift nicht den Körper an \u2013 sie zersetzt Gewissheit."
        ),
        ambient_text_en=[
            "The wisp drifts closer, then retreats. Testing.",
            "You feel it before you see it \u2013 a chill that starts behind the eyes.",
        ],
        ambient_text_de=[
            "Der Glimmer treibt näher, dann zurück. Testend.",
            "Ihr spürt es, bevor ihr es seht \u2013 eine Kälte, die hinter den Augen beginnt.",
        ],
    ),
    "shadow_tendril": EnemyTemplate(
        id="shadow_tendril",
        name_en="Shadow Tendril",
        name_de="Schattenfaden",
        archetype="The Shadow",
        condition_threshold=2,
        stress_resistance=0,
        threat_level="minion",
        attack_aptitude="guardian",
        attack_power=4,
        stress_attack_power=1,
        telegraphed_intent=True,
        evasion=10,
        resistances=[],
        vulnerabilities=["saboteur", "assassin"],
        action_weights={"attack": 70, "grapple": 30},
        special_abilities=["grapple"],
        description_en="A black appendage reaching from the walls. Patient. Methodical.",
        description_de="Ein schwarzer Fortsatz, der aus den Wanden greift. Geduldig. Methodisch.",
        ambient_text_en=["The tendril extends, probing. It knows you're there."],
        ambient_text_de=["Der Faden streckt sich, tastet. Er weiss, dass ihr da seid."],
    ),
    "shadow_echo_violence": EnemyTemplate(
        id="shadow_echo_violence",
        name_en="Echo of Violence",
        name_de="Gewaltecho",
        archetype="The Shadow",
        condition_threshold=2,
        stress_resistance=200,
        threat_level="standard",
        attack_aptitude="assassin",
        attack_power=6,
        stress_attack_power=3,
        telegraphed_intent=True,
        evasion=20,
        resistances=["propagandist"],
        vulnerabilities=["spy", "guardian"],
        action_weights={"attack": 40, "stress_attack": 30, "ambush": 20, "defend": 10},
        description_en=(
            "A replay of violence that once scarred this place. It moves with the precision "
            "of memory \u2013 every strike has happened before."
        ),
        description_de=(
            "Eine Wiederholung von Gewalt, die diesen Ort einst gezeichnet hat. "
            "Sie bewegt sich mit der Prazision der Erinnerung \u2013 jeder Schlag ist schon geschehen."
        ),
        ambient_text_en=[
            "The echo replays a death. Not yours. Not yet.",
            "Its movements are familiar. You've seen this fighting style in your simulation's history.",
        ],
        ambient_text_de=[
            "Das Echo spielt einen Tod nach. Nicht euren. Noch nicht.",
            "Seine Bewegungen sind vertraut. Ihr habt diesen Kampfstil in der Geschichte eurer Simulation gesehen.",
        ],
    ),
    "shadow_paranoia_shade": EnemyTemplate(
        id="shadow_paranoia_shade",
        name_en="Paranoia Shade",
        name_de="Paranoiaschatten",
        archetype="The Shadow",
        condition_threshold=1,
        stress_resistance=300,
        threat_level="standard",
        attack_aptitude="propagandist",
        attack_power=2,
        stress_attack_power=6,
        telegraphed_intent=False,  # LIES about its intents
        evasion=30,
        resistances=["spy"],
        vulnerabilities=["propagandist", "guardian"],
        action_weights={"stress_attack": 50, "disinformation": 30, "hide": 20},
        special_abilities=["disinformation"],
        description_en=(
            "It whispers. Not lies, exactly \u2013 plausible fears. "
            "Things your agents already suspect about each other."
        ),
        description_de=(
            "Es flüstert. Nicht Lügen, genau genommen \u2013 plausible Ängste. "
            "Dinge, die eure Agenten bereits voneinander vermuten."
        ),
        ambient_text_en=[
            "The shade whispers something to {agent}. Their expression changes.",
            "You can't tell if it's speaking or if the voice is in your head.",
        ],
        ambient_text_de=[
            "Der Schatten flüstert {agent} etwas zu. Ihr Ausdruck ändert sich.",
            "Ihr könnt nicht sagen, ob er spricht oder ob die Stimme in eurem Kopf ist.",
        ],
    ),
    "shadow_remnant": EnemyTemplate(
        id="shadow_remnant",
        name_en="The Remnant",
        name_de="Der Überrest",
        archetype="The Shadow",
        condition_threshold=5,
        stress_resistance=400,
        threat_level="elite",
        attack_aptitude="assassin",
        attack_power=8,
        stress_attack_power=7,
        telegraphed_intent=True,
        evasion=25,
        resistances=["infiltrator", "saboteur"],
        vulnerabilities=["spy"],
        action_weights={"attack": 30, "stress_attack": 25, "summon_wisps": 20, "aoe_fear": 15, "defend": 10},
        special_abilities=["summon_wisps", "aoe_fear", "wisp_shield"],
        description_en=(
            "Formed from the simulation's strongest unresolved conflict. "
            "It remembers what your agents have tried to forget."
        ),
        description_de=(
            "Geformt aus dem stärksten ungelösten Konflikt der Simulation. "
            "Er erinnert sich an das, was eure Agenten zu vergessen versucht haben."
        ),
        ambient_text_en=[
            "The Remnant studies you. It has been waiting for someone to come this deep.",
            "Wisps orbit the Remnant like satellites. They pulse in unison.",
        ],
        ambient_text_de=[
            "Der Überrest beobachtet euch. Er hat darauf gewartet, dass jemand so tief kommt.",
            "Glimmer umkreisen den Überrest wie Satelliten. Sie pulsieren im Gleichklang.",
        ],
    ),
}

# ── Combat Spawn Configurations ─────────────────────────────────────────────
# Maps encounter template IDs to enemy spawn lists.

SHADOW_SPAWN_CONFIGS: dict[str, list[dict]] = {
    "shadow_whispers_spawn": [
        {"template_id": "shadow_wisp", "count": 2},
    ],
    "shadow_patrol_spawn": [
        {"template_id": "shadow_echo_violence", "count": 1},
        {"template_id": "shadow_tendril", "count": 1},
    ],
    "shadow_ambush_spawn": [
        {"template_id": "shadow_echo_violence", "count": 2},
    ],
    "shadow_haunting_spawn": [
        {"template_id": "shadow_paranoia_shade", "count": 1},
        {"template_id": "shadow_wisp", "count": 2},
    ],
    "shadow_remnant_spawn": [
        {"template_id": "shadow_remnant", "count": 1},
        {"template_id": "shadow_wisp", "count": 1},
    ],
    # Rest site ambush (light combat)
    "shadow_rest_ambush_spawn": [
        {"template_id": "shadow_tendril", "count": 1},
    ],
}

# ── Tower Enemy Templates ─────────────────────────────────────────────────

TOWER_ENEMIES: dict[str, EnemyTemplate] = {
    "tower_tremor_broker": EnemyTemplate(
        id="tower_tremor_broker",
        name_en="Tremor Broker",
        name_de="Bebenmakler",
        archetype="The Tower",
        condition_threshold=1,
        stress_resistance=80,
        threat_level="minion",
        attack_aptitude="propagandist",
        attack_power=1,
        stress_attack_power=5,
        telegraphed_intent=True,
        evasion=30,
        resistances=["guardian"],
        vulnerabilities=["saboteur"],
        action_weights={"stress_attack": 65, "evade": 25, "ambient": 10},
        description_en=(
            "A nervous figure wreathed in scrolling numbers. It doesn't fight "
            "\u2013 it recites. Market figures, compound rates, the precise "
            "mathematics of structures that can't hold."
        ),
        description_de=(
            "Eine nervöse Gestalt, umweht von laufenden Zahlen. Sie kämpft "
            "nicht \u2013 sie rezitiert. Marktkurse, Zinseszinsen, die präzise "
            "Mathematik von Strukturen, die nicht halten können."
        ),
        ambient_text_en=[
            "The broker whispers a number. The floor shudders.",
            "Digits cascade down the walls like rain. None of them add up.",
        ],
        ambient_text_de=[
            "Der Makler flüstert eine Zahl. Der Boden bebt.",
            "Ziffern rinnen die Wände herab wie Regen. Keine davon geht auf.",
        ],
    ),
    "tower_foundation_worm": EnemyTemplate(
        id="tower_foundation_worm",
        name_en="Foundation Worm",
        name_de="Grundwurm",
        archetype="The Tower",
        condition_threshold=2,
        stress_resistance=0,
        threat_level="minion",
        attack_aptitude="guardian",
        attack_power=4,
        stress_attack_power=1,
        telegraphed_intent=True,
        evasion=10,
        resistances=[],
        vulnerabilities=["assassin", "saboteur"],
        action_weights={"attack": 40, "burrow": 50, "ambient": 10},
        special_abilities=["burrow"],
        description_en=(
            "Patient. Eyeless. It navigates by stress fractures in the "
            "load-bearing walls, widening them with each pass. The building "
            "groans where it has been."
        ),
        description_de=(
            "Geduldig. Augenlos. Er orientiert sich an Spannungsrissen in den "
            "tragenden Wänden und weitet sie bei jedem Durchgang. Das Gebäude "
            "stöhnt, wo er gewesen ist."
        ),
        ambient_text_en=["The floor vibrates. Something is chewing through the foundation."],
        ambient_text_de=["Der Boden vibriert. Etwas frisst sich durch das Fundament."],
    ),
    "tower_crown_keeper": EnemyTemplate(
        id="tower_crown_keeper",
        name_en="The Crowned",
        name_de="Der Gekrönte",
        archetype="The Tower",
        condition_threshold=2,
        stress_resistance=250,
        threat_level="standard",
        attack_aptitude="guardian",
        attack_power=5,
        stress_attack_power=2,
        telegraphed_intent=True,
        evasion=15,
        resistances=["propagandist", "infiltrator"],
        vulnerabilities=["spy", "saboteur"],
        action_weights={"attack": 30, "stability_drain": 35, "defend": 25, "ambient": 10},
        special_abilities=["stability_drain"],
        description_en=(
            "It wears the crown of a structure that believed it would last "
            "forever. The crown is cracked. The keeper does not acknowledge this."
        ),
        description_de=(
            "Er trägt die Krone eines Bauwerks, das glaubte, ewig zu bestehen. "
            "Die Krone ist geborsten. Der Träger nimmt dies nicht zur Kenntnis."
        ),
        ambient_text_en=[
            "The Crowned raises one hand. A support beam splinters.",
            "Its crown emits a low frequency that makes your teeth ache.",
        ],
        ambient_text_de=[
            "Der Gekrönte hebt eine Hand. Ein Stützbalken splittert.",
            "Seine Krone sendet eine tiefe Frequenz, die in den Zähnen schmerzt.",
        ],
    ),
    "tower_debt_shade": EnemyTemplate(
        id="tower_debt_shade",
        name_en="Debt Shade",
        name_de="Schuldgespenst",
        archetype="The Tower",
        condition_threshold=1,
        stress_resistance=300,
        threat_level="standard",
        attack_aptitude="propagandist",
        attack_power=2,
        stress_attack_power=4,
        telegraphed_intent=False,  # LIES about its intents
        evasion=25,
        resistances=["spy"],
        vulnerabilities=["propagandist", "guardian"],
        action_weights={"stress_attack": 45, "compound": 30, "disinformation": 15, "ambient": 10},
        special_abilities=["compound", "disinformation"],
        description_en=(
            "It speaks in promises that were never kept. Each round it grows, "
            "fed by the compound interest of unresolved obligations. It lies "
            "about its intentions \u2013 not from malice, but because the "
            "ledger demands it."
        ),
        description_de=(
            "Es spricht in Versprechen, die nie gehalten wurden. Jede Runde "
            "wächst es, genährt vom Zinseszins ungelöster Verpflichtungen. "
            "Es lügt über seine Absichten \u2013 nicht aus Bosheit, sondern "
            "weil das Hauptbuch es verlangt."
        ),
        ambient_text_en=[
            "The shade presents a contract. The terms are always worsening.",
            "You can hear it counting. The numbers only go up.",
        ],
        ambient_text_de=[
            "Das Gespenst legt einen Vertrag vor. Die Konditionen verschlechtern sich stets.",
            "Ihr hört es zählen. Die Zahlen steigen nur.",
        ],
    ),
    "tower_remnant_commerce": EnemyTemplate(
        id="tower_remnant_commerce",
        name_en="Remnant of Commerce",
        name_de="Relikt des Handels",
        archetype="The Tower",
        condition_threshold=5,
        stress_resistance=400,
        threat_level="elite",
        attack_aptitude="propagandist",
        attack_power=7,
        stress_attack_power=8,
        telegraphed_intent=True,
        evasion=20,
        resistances=["infiltrator", "propagandist"],
        vulnerabilities=["saboteur"],
        action_weights={
            "attack": 20, "stress_attack": 20, "summon_brokers": 25,
            "market_crash": 20, "defend": 15,
        },
        special_abilities=["summon_brokers", "market_crash"],
        description_en=(
            "What remains when a trading floor collapses. It moves through "
            "the ruin with proprietary efficiency, summoning lesser brokers "
            "from the rubble. Its market crash ability strips all pretense "
            "of stability."
        ),
        description_de=(
            "Was bleibt, wenn ein Handelsparkett einbricht. Es bewegt sich "
            "durch die Ruine mit der Effizienz eines Insolvenzverwalters, ruft "
            "geringere Makler aus dem Schutt. Seine Marktcrash-Fähigkeit reisst "
            "jedes Stabilitätsversprechen ein."
        ),
        ambient_text_en=[
            "The Remnant adjusts invisible ledgers. Something in the building responds.",
            "Trading signals flicker across its surface. Buy. Sell. Collapse.",
        ],
        ambient_text_de=[
            "Das Relikt korrigiert unsichtbare Hauptbücher. Etwas im Gebäude antwortet.",
            "Handelssignale flackern über seine Oberflaeche. Kaufen. Verkaufen. Einsturz.",
        ],
    ),
}

# ── Tower Combat Spawn Configurations ──────────────────────────────────────

TOWER_SPAWN_CONFIGS: dict[str, list[dict]] = {
    "tower_tremor_spawn": [
        {"template_id": "tower_tremor_broker", "count": 2},
    ],
    "tower_patrol_spawn": [
        {"template_id": "tower_crown_keeper", "count": 1},
        {"template_id": "tower_foundation_worm", "count": 1},
    ],
    "tower_ambush_spawn": [
        {"template_id": "tower_debt_shade", "count": 2},
    ],
    "tower_compound_spawn": [
        {"template_id": "tower_debt_shade", "count": 1},
        {"template_id": "tower_tremor_broker", "count": 2},
    ],
    "tower_collapse_spawn": [
        {"template_id": "tower_remnant_commerce", "count": 1},
        {"template_id": "tower_tremor_broker", "count": 1},
    ],
    # Rest site ambush (light combat)
    "tower_rest_ambush_spawn": [
        {"template_id": "tower_foundation_worm", "count": 1},
    ],
}

# ── Entropy Enemy Templates ──────────────────────────────────────────────

ENTROPY_ENEMIES: dict[str, EnemyTemplate] = {
    "entropy_rust_phantom": EnemyTemplate(
        id="entropy_rust_phantom",
        name_en="Rust Phantom",
        name_de="Rostphantom",
        archetype="The Entropy",
        condition_threshold=1,
        stress_resistance=30,
        threat_level="minion",
        attack_aptitude="infiltrator",
        attack_power=2,
        stress_attack_power=4,
        telegraphed_intent=True,
        evasion=35,
        resistances=["assassin"],
        vulnerabilities=["saboteur"],
        action_weights={"stress_attack": 50, "evade": 30, "corrode": 10, "ambient": 10},
        special_abilities=["corrode"],
        description_en=(
            "A shape that was something once. Now it is mostly the color of "
            "rust and the sound of metal thinning. It does not approach \u2013 "
            "it persists."
        ),
        description_de=(
            "Eine Form, die einst etwas war. Nun ist sie hauptsächlich die Farbe "
            "von Rost und das Geräusch von dünner werdendem Metall. Sie nähert "
            "sich nicht \u2013 sie verharrt."
        ),
        ambient_text_en=[
            "The phantom flickers. Not like light \u2013 like signal quality.",
            "You can see through it. You wish you couldn't.",
        ],
        ambient_text_de=[
            "Das Phantom flackert. Nicht wie Licht \u2013 wie Signalqualität.",
            "Ihr könnt hindurchsehen. Ihr wünscht, ihr könntet es nicht.",
        ],
    ),
    "entropy_fade_echo": EnemyTemplate(
        id="entropy_fade_echo",
        name_en="Fade Echo",
        name_de="Verblassecho",
        archetype="The Entropy",
        condition_threshold=2,
        stress_resistance=150,
        threat_level="standard",
        attack_aptitude="propagandist",
        attack_power=2,
        stress_attack_power=6,
        telegraphed_intent=True,
        evasion=20,
        resistances=["spy"],
        vulnerabilities=["propagandist", "guardian"],
        action_weights={"stress_attack": 45, "diminish": 35, "ambient": 20},
        special_abilities=["diminish"],
        description_en=(
            "A sound that is almost a voice. A shape that is almost a figure. "
            "It repeats something that was once important. The repetition has "
            "worn the meaning away."
        ),
        description_de=(
            "Ein Klang, der beinahe eine Stimme ist. Eine Gestalt, die beinahe "
            "eine Figur ist. Es wiederholt etwas, das einst wichtig war. Die "
            "Wiederholung hat die Bedeutung abgetragen."
        ),
        ambient_text_en=[
            "The echo says your name. Approximately.",
            "{agent}'s shadow and the echo's shape briefly overlap. Neither notices.",
        ],
        ambient_text_de=[
            "Das Echo sagt euren Namen. Ungefähr.",
            "{agent}s Schatten und die Form des Echos überlappen sich kurz. Keiner bemerkt es.",
        ],
    ),
    "entropy_dissolution_swarm": EnemyTemplate(
        id="entropy_dissolution_swarm",
        name_en="Dissolution Swarm",
        name_de="Auflösungsschwarm",
        archetype="The Entropy",
        condition_threshold=3,
        stress_resistance=50,
        threat_level="standard",
        attack_aptitude="saboteur",
        attack_power=4,
        stress_attack_power=3,
        telegraphed_intent=True,
        evasion=15,
        resistances=["infiltrator"],
        vulnerabilities=["spy", "assassin"],
        action_weights={"attack": 40, "scatter": 30, "corrode": 20, "ambient": 10},
        special_abilities=["scatter", "corrode"],
        description_en=(
            "A cloud of particles that were once a wall, a floor, a ceiling. "
            "Now they are nothing in particular, and they move with the "
            "purposelessness of dust in a closed room."
        ),
        description_de=(
            "Eine Wolke aus Partikeln, die einst eine Wand waren, ein Boden, "
            "eine Decke. Nun sind sie nichts Bestimmtes, und sie bewegen sich "
            "mit der Ziellosigkeit von Staub in einem geschlossenen Raum."
        ),
        ambient_text_en=[
            "The swarm drifts. Not toward you. Not away. Just\u2026 redistributing.",
            "Individual particles detach and reattach. The total mass remains constant.",
        ],
        ambient_text_de=[
            "Der Schwarm treibt. Nicht auf euch zu. Nicht weg. Nur\u2026 umverteilend.",
            "Einzelne Partikel lösen sich und heften sich wieder an. Die Gesamtmasse bleibt konstant.",
        ],
    ),
    "entropy_warden": EnemyTemplate(
        id="entropy_warden",
        name_en="Entropy Warden",
        name_de="Entropiewächter",
        archetype="The Entropy",
        condition_threshold=5,
        stress_resistance=300,
        threat_level="elite",
        attack_aptitude="guardian",
        attack_power=6,
        stress_attack_power=4,
        telegraphed_intent=False,
        evasion=10,
        resistances=["propagandist", "spy"],
        vulnerabilities=["saboteur"],
        action_weights={
            "attack": 30, "stress_attack": 20, "entropy_pulse": 25,
            "summon_phantoms": 15, "ambient": 10,
        },
        special_abilities=["entropy_pulse", "summon_phantoms"],
        description_en=(
            "It was a guardian once. The armor remembers. The purpose does not. "
            "It stands where it has always stood, performing the motions of "
            "protection over nothing. When it notices you, the motions do not "
            "change. You have simply become part of what it protects. Or what "
            "it dissolves. There is no longer a difference."
        ),
        description_de=(
            "Es war einst ein Wächter. Die Rüstung erinnert sich. Der Zweck "
            "nicht. Es steht, wo es immer gestanden hat, und vollzieht die "
            "Gesten des Schutzes über das Nichts. Als es euch bemerkt, ändern "
            "sich die Gesten nicht. Ihr seid einfach Teil dessen geworden, was "
            "es beschützt. Oder was es auflöst. Es gibt keinen Unterschied mehr."
        ),
        ambient_text_en=[
            "The Warden's armor flakes. Each flake contains a memory of structural integrity.",
            "It swings. Not at you. At the concept of distinction between you and it.",
        ],
        ambient_text_de=[
            "Die Rüstung des Wächters blättert. Jede Schuppe enthält eine Erinnerung an strukturelle Integrität.",
            "Es schlägt zu. Nicht nach euch. Nach dem Konzept der Unterscheidung zwischen euch und ihm.",
        ],
    ),
}

# ── Entropy Combat Spawn Configurations ──────────────────────────────────

ENTROPY_SPAWN_CONFIGS: dict[str, list[dict]] = {
    "entropy_drift_spawn": [
        {"template_id": "entropy_rust_phantom", "count": 2},
    ],
    "entropy_erosion_patrol_spawn": [
        {"template_id": "entropy_fade_echo", "count": 1},
        {"template_id": "entropy_rust_phantom", "count": 1},
    ],
    "entropy_swarm_spawn": [
        {"template_id": "entropy_dissolution_swarm", "count": 1},
        {"template_id": "entropy_rust_phantom", "count": 1},
    ],
    "entropy_dissolution_spawn": [
        {"template_id": "entropy_dissolution_swarm", "count": 2},
    ],
    "entropy_warden_spawn": [
        {"template_id": "entropy_warden", "count": 1},
        {"template_id": "entropy_rust_phantom", "count": 1},
    ],
    # Rest site ambush (light combat)
    "entropy_rest_ambush_spawn": [
        {"template_id": "entropy_rust_phantom", "count": 1},
    ],
}

# ── Devouring Mother Enemy Templates ──────────────────────────────────────

MOTHER_ENEMIES: dict[str, EnemyTemplate] = {
    "mother_nutrient_weaver": EnemyTemplate(
        id="mother_nutrient_weaver",
        name_en="Nutrient Weaver",
        name_de="Nährgespinst",
        archetype="The Devouring Mother",
        condition_threshold=1,
        stress_resistance=30,
        threat_level="minion",
        attack_aptitude="infiltrator",
        attack_power=1,
        stress_attack_power=3,
        telegraphed_intent=True,
        evasion=30,
        resistances=["propagandist"],
        vulnerabilities=["saboteur"],
        action_weights={"stress_attack": 30, "nurture": 40, "evade": 20, "ambient": 10},
        special_abilities=["nurture"],
        description_en=(
            "A lattice of translucent tissue, suspended in the air like a web "
            "spun from capillaries. It drifts toward {agent} \u2013 not threatening, "
            "but offering. Something glistens at the tips of its filaments. "
            "Nutrients, your instruments confirm. It wants to feed you."
        ),
        description_de=(
            "Ein Geflecht aus durchscheinendem Gewebe, in der Luft schwebend "
            "wie ein Netz aus Kapillaren. Es treibt auf {agent} zu \u2013 nicht "
            "drohend, sondern anbietend. An den Spitzen seiner Filamente "
            "glänzt etwas. Nährstoffe, bestätigen eure Instrumente. Es will "
            "euch füttern."
        ),
        ambient_text_en=[
            "The weaver extends a filament toward {agent}. It carries a droplet of something warm.",
            "You could let it feed you. The thought is not yours.",
        ],
        ambient_text_de=[
            "Das Gespinst streckt ein Filament nach {agent} aus. Es trägt einen Tropfen von etwas Warmem.",
            "Ihr könntet euch füttern lassen. Der Gedanke gehört nicht euch.",
        ],
    ),
    "mother_tether_vine": EnemyTemplate(
        id="mother_tether_vine",
        name_en="Tether Vine",
        name_de="Bindungsranke",
        archetype="The Devouring Mother",
        condition_threshold=2,
        stress_resistance=0,
        threat_level="standard",
        attack_aptitude="guardian",
        attack_power=4,
        stress_attack_power=2,
        telegraphed_intent=True,
        evasion=10,
        resistances=["spy"],
        vulnerabilities=["saboteur", "assassin"],
        action_weights={"attack": 35, "grapple": 35, "root": 20, "ambient": 10},
        special_abilities=["grapple", "root"],
        description_en=(
            "A root system that has learned to walk. It moves through the floor "
            "like something swimming through still water \u2013 surfacing, reaching, "
            "submerging. The tissue is warm to the touch. Your instruments "
            "advise against touching it."
        ),
        description_de=(
            "Ein Wurzelsystem, das gelernt hat zu gehen. Es bewegt sich durch "
            "den Boden wie etwas, das durch stilles Wasser schwimmt \u2013 "
            "auftauchend, greifend, abtauchend. Das Gewebe ist warm bei "
            "Berührung. Eure Instrumente raten von Berührung ab."
        ),
        ambient_text_en=[
            "The vine extends beneath the floor. You can feel it through your boots \u2013 a heartbeat that isn't yours.",
            "{agent} steps over a root. It flinches. Not in pain \u2013 in recognition.",
        ],
        ambient_text_de=[
            "Die Ranke erstreckt sich unter dem Boden. Ihr spürt sie durch eure Stiefel \u2013 einen Herzschlag, der nicht eurer ist.",
            "{agent} steigt über eine Wurzel. Sie zuckt. Nicht vor Schmerz \u2013 vor Wiedererkennen.",
        ],
    ),
    "mother_spore_matron": EnemyTemplate(
        id="mother_spore_matron",
        name_en="Spore Matron",
        name_de="Sporenmutter",
        archetype="The Devouring Mother",
        condition_threshold=3,
        stress_resistance=200,
        threat_level="standard",
        attack_aptitude="propagandist",
        attack_power=2,
        stress_attack_power=6,
        telegraphed_intent=True,
        evasion=15,
        resistances=["infiltrator"],
        vulnerabilities=["propagandist", "guardian"],
        action_weights={"stress_attack": 30, "spore_cloud": 35, "nurture": 25, "ambient": 10},
        special_abilities=["spore_cloud", "nurture"],
        description_en=(
            "Something between a flower and a lung. It breathes, and its breath "
            "carries spores that catch the light like dust in a cathedral. The "
            "spores smell of honey and warm soil. Your instruments read them as "
            "parasitic vectors. Your body reads them as nourishment."
        ),
        description_de=(
            "Etwas zwischen einer Blume und einer Lunge. Es atmet, und sein "
            "Atem trägt Sporen, die das Licht fangen wie Staub in einer "
            "Kathedrale. Die Sporen riechen nach Honig und warmer Erde. Eure "
            "Instrumente lesen sie als parasitäre Vektoren. Euer Körper liest "
            "sie als Nahrung."
        ),
        ambient_text_en=[
            "The Matron exhales. The air sweetens. {agent} breathes deeper without deciding to.",
            "Spores settle on {agent}'s skin. They are warm. They are already taking root.",
        ],
        ambient_text_de=[
            "Die Mutter atmet aus. Die Luft wird süßer. {agent} atmet tiefer, ohne es zu beschließen.",
            "Sporen legen sich auf {agent}s Haut. Sie sind warm. Sie wurzeln bereits.",
        ],
    ),
    "mother_host_warden": EnemyTemplate(
        id="mother_host_warden",
        name_en="Host Warden",
        name_de="Wirtskörper",
        archetype="The Devouring Mother",
        condition_threshold=5,
        stress_resistance=300,
        threat_level="elite",
        attack_aptitude="guardian",
        attack_power=5,
        stress_attack_power=5,
        telegraphed_intent=False,
        evasion=10,
        resistances=["infiltrator", "spy"],
        vulnerabilities=["saboteur"],
        action_weights={
            "attack": 25, "stress_attack": 15, "embrace": 25,
            "summon_weavers": 15, "spore_cloud": 10, "ambient": 10,
        },
        special_abilities=["embrace", "summon_weavers", "spore_cloud"],
        description_en=(
            "It was a person once. The proportions remember \u2013 two arms, two "
            "legs, a head. But the tissue has grown over and through and around "
            "until the person is only a scaffold for something larger, something "
            "that moves with the patient rhythm of a heartbeat. It opens its "
            "arms. Not to attack. To welcome. The embrace is the attack."
        ),
        description_de=(
            "Es war einst ein Mensch. Die Proportionen erinnern sich \u2013 zwei "
            "Arme, zwei Beine, ein Kopf. Aber das Gewebe ist darüber und "
            "hindurch und darum gewachsen, bis der Mensch nur noch ein Gerüst "
            "ist für etwas Größeres, etwas, das sich mit dem geduldigen Rhythmus "
            "eines Herzschlags bewegt. Es öffnet die Arme. Nicht zum Angriff. "
            "Zum Willkommen. Die Umarmung ist der Angriff."
        ),
        ambient_text_en=[
            "The Warden hums. Not a melody \u2013 a frequency. Your ribcages resonate.",
            "It reaches toward {agent} with something that was once a hand. The gesture is tender. The grip would not be.",
        ],
        ambient_text_de=[
            "Der Wirtskörper summt. Keine Melodie \u2013 eine Frequenz. Eure Brustkörbe resonieren.",
            "Er greift nach {agent} mit etwas, das einst eine Hand war. Die Geste ist zärtlich. Der Griff wäre es nicht.",
        ],
    ),
    # Boss-tier: the Host Warden fused with the architecture (The Living Altar)
    "mother_living_altar": EnemyTemplate(
        id="mother_living_altar",
        name_en="The Living Altar",
        name_de="Der Lebendige Altar",
        archetype="The Devouring Mother",
        condition_threshold=7,
        stress_resistance=500,
        threat_level="boss",
        attack_aptitude="guardian",
        attack_power=6,
        stress_attack_power=7,
        telegraphed_intent=False,
        evasion=5,
        resistances=["infiltrator", "spy", "guardian"],
        vulnerabilities=["saboteur"],
        action_weights={
            "attack": 20, "stress_attack": 20, "embrace": 25,
            "summon_weavers": 10, "spore_cloud": 10, "ambient": 15,
        },
        special_abilities=["embrace", "summon_weavers", "spore_cloud"],
        description_en=(
            "What was once a Host Warden has become something larger. It has "
            "grown into the walls, the floor, the ceiling \u2013 a figure embedded "
            "in architecture, arms open, face calm, the tissue around it pulsing "
            "with the rhythm of something that has been waiting for millennia. "
            "The Living Altar does not guard the dungeon. It is the dungeon. "
            "The embrace it offers is permanent. The warmth is absolute."
        ),
        description_de=(
            "Was einst ein Wirtskörper war, ist zu etwas Größerem geworden. "
            "Er ist in die Wände gewachsen, den Boden, die Decke \u2013 eine Gestalt, "
            "eingebettet in Architektur, Arme geöffnet, Gesicht ruhig, das Gewebe "
            "um ihn herum pulsierend im Rhythmus von etwas, das Jahrtausende "
            "gewartet hat. Der Lebendige Altar bewacht den Dungeon nicht. "
            "Er ist der Dungeon. Die Umarmung, die er anbietet, ist permanent. "
            "Die Wärme ist absolut."
        ),
        ambient_text_en=[
            "The Altar pulses. The walls pulse with it. The floor yields slightly beneath your feet.",
            "It reaches for {agent}. Not quickly. It has no need for speed. Nothing leaves.",
            "The temperature rises another degree. The Altar is patient. It has always been patient.",
        ],
        ambient_text_de=[
            "Der Altar pulsiert. Die Wände pulsieren mit ihm. Der Boden gibt leicht nach unter euren Füßen.",
            "Er greift nach {agent}. Nicht schnell. Er braucht keine Eile. Nichts entkommt.",
            "Die Temperatur steigt um einen weiteren Grad. Der Altar ist geduldig. Er war immer geduldig.",
        ],
    ),
}

# ── Devouring Mother Combat Spawn Configurations ─────────────────────────

MOTHER_SPAWN_CONFIGS: dict[str, list[dict]] = {
    "mother_weaver_drift_spawn": [
        {"template_id": "mother_nutrient_weaver", "count": 2},
    ],
    "mother_vine_patrol_spawn": [
        {"template_id": "mother_tether_vine", "count": 1},
        {"template_id": "mother_nutrient_weaver", "count": 1},
    ],
    "mother_spore_spawn": [
        {"template_id": "mother_spore_matron", "count": 1},
        {"template_id": "mother_nutrient_weaver", "count": 1},
    ],
    "mother_garden_spawn": [
        {"template_id": "mother_spore_matron", "count": 1},
        {"template_id": "mother_tether_vine", "count": 1},
    ],
    "mother_host_warden_spawn": [
        {"template_id": "mother_host_warden", "count": 1},
        {"template_id": "mother_nutrient_weaver", "count": 1},
    ],
    # Boss: The Living Altar with protective entourage
    "mother_living_altar_spawn": [
        {"template_id": "mother_living_altar", "count": 1},
        {"template_id": "mother_spore_matron", "count": 1},
        {"template_id": "mother_tether_vine", "count": 1},
    ],
    # Rest site ambush (a gift arrives uninvited)
    "mother_rest_ambush_spawn": [
        {"template_id": "mother_nutrient_weaver", "count": 1},
    ],
}

# ── Prometheus Enemy Templates ────────────────────────────────────────────
# Construct-themed enemies. The workshop's creations turned sentinels.
# Literary DNA: Hephaestus (divine craftsman), Čapek (robots gaining will),
# Schulz (matter with agency), Hoffmann (uncanny automata).
# Tone: mechanical precision, NOT horror. They function. They observe.

PROMETHEUS_ENEMIES: dict[str, EnemyTemplate] = {
    "prometheus_spark_wisp": EnemyTemplate(
        id="prometheus_spark_wisp",
        name_en="Spark Wisp",
        name_de="Funkenglimmer",
        archetype="The Prometheus",
        condition_threshold=1,
        stress_resistance=20,
        threat_level="minion",
        attack_aptitude="infiltrator",
        attack_power=2,
        stress_attack_power=3,
        telegraphed_intent=True,
        evasion=45,
        resistances=["guardian"],
        vulnerabilities=["saboteur"],
        action_weights={"stress_attack": 50, "evade": 40, "ambient": 10},
        description_en=(
            "A spark that refused to go out. It orbits the party "
            "like a hypothesis testing itself."
        ),
        description_de=(
            "Ein Funke, der sich weigerte zu verlöschen. Er umkreist "
            "den Trupp wie eine Hypothese, die sich selbst überprüft."
        ),
        ambient_text_en=[
            "The wisp accelerates, decelerates. Calculating.",
            "It pulses once \u2013 a question in light.",
        ],
        ambient_text_de=[
            "Der Glimmer beschleunigt, bremst. Kalkulierend.",
            "Er pulsiert einmal \u2013 eine Frage aus Licht.",
        ],
    ),
    "prometheus_alloy_sentinel": EnemyTemplate(
        id="prometheus_alloy_sentinel",
        name_en="Alloy Sentinel",
        name_de="Legierungswächter",
        archetype="The Prometheus",
        condition_threshold=3,
        stress_resistance=100,
        threat_level="standard",
        attack_aptitude="guardian",
        attack_power=5,
        stress_attack_power=2,
        telegraphed_intent=True,
        evasion=5,
        resistances=["assassin", "infiltrator"],
        vulnerabilities=["saboteur"],
        action_weights={"attack": 55, "defend": 35, "ambient": 10},
        special_abilities=["fortify"],
        description_en=(
            "Forged from an alloy that does not appear in any periodic table. "
            "It stands where the workshop needs it to stand. "
            "It does not question this."
        ),
        description_de=(
            "Geschmiedet aus einer Legierung, die in keinem Periodensystem "
            "vorkommt. Er steht, wo die Werkstatt ihn braucht. "
            "Er hinterfragt das nicht."
        ),
        ambient_text_en=[
            "The sentinel shifts its weight. Metal grinds on metal, almost melodic.",
            "Its surface reflects the party \u2013 distorted. Better, somehow.",
        ],
        ambient_text_de=[
            "Der Wächter verlagert sein Gewicht. Metall reibt auf Metall, beinahe melodisch.",
            "Seine Oberfläche spiegelt den Trupp \u2013 verzerrt. Irgendwie besser.",
        ],
    ),
    "prometheus_slag_golem": EnemyTemplate(
        id="prometheus_slag_golem",
        name_en="Slag Golem",
        name_de="Schlackengolem",
        archetype="The Prometheus",
        condition_threshold=3,
        stress_resistance=200,
        threat_level="standard",
        attack_aptitude="guardian",
        attack_power=6,
        stress_attack_power=1,
        telegraphed_intent=True,
        evasion=0,
        resistances=["spy", "propagandist"],
        vulnerabilities=["saboteur", "assassin"],
        action_weights={"attack": 60, "grapple": 30, "ambient": 10},
        special_abilities=["grapple"],
        description_en=(
            "The residue of failed experiments, accumulated and compacted "
            "until it gained mass, then purpose. It does not hate the party. "
            "It is simply in the way."
        ),
        description_de=(
            "Der Rückstand gescheiterter Versuche, angesammelt und verdichtet, "
            "bis er Masse gewann, dann Zweck. Er hasst den Trupp nicht. "
            "Er steht einfach im Weg."
        ),
        ambient_text_en=[
            "The golem shifts. Somewhere inside, a failed alloy groans.",
            "It leaves residue on the floor. The residue is warm.",
        ],
        ambient_text_de=[
            "Der Golem verlagert sich. Irgendwo in seinem Inneren stöhnt eine gescheiterte Legierung.",
            "Er hinterlässt Rückstände am Boden. Die Rückstände sind warm.",
        ],
    ),
    "prometheus_crucible_drake": EnemyTemplate(
        id="prometheus_crucible_drake",
        name_en="Crucible Drake",
        name_de="Tiegeldrache",
        archetype="The Prometheus",
        condition_threshold=2,
        stress_resistance=50,
        threat_level="standard",
        attack_aptitude="saboteur",
        attack_power=4,
        stress_attack_power=5,
        telegraphed_intent=True,
        evasion=25,
        resistances=["guardian"],
        vulnerabilities=["spy", "infiltrator"],
        action_weights={"attack": 40, "stress_attack": 40, "ambient": 20},
        description_en=(
            "A construct of molten flux and crystallized heat. "
            "It was a crucible once. Now it moves. "
            "The fire inside it has opinions."
        ),
        description_de=(
            "Ein Konstrukt aus geschmolzenem Flussmittel und kristallisierter Hitze. "
            "Es war einmal ein Tiegel. Nun bewegt er sich. "
            "Das Feuer in ihm hat Meinungen."
        ),
        ambient_text_en=[
            "The drake exhales. Not flame \u2013 fumes. The fumes smell like ideas.",
            "Its surface ripples. A chemical reaction, or a thought.",
        ],
        ambient_text_de=[
            "Der Drache atmet aus. Keine Flamme \u2013 Dämpfe. Die Dämpfe riechen nach Ideen.",
            "Seine Oberfläche kräuselt sich. Eine chemische Reaktion, oder ein Gedanke.",
        ],
    ),
    "prometheus_automaton_shard": EnemyTemplate(
        id="prometheus_automaton_shard",
        name_en="Automaton Shard",
        name_de="Automatensplitter",
        archetype="The Prometheus",
        condition_threshold=2,
        stress_resistance=0,
        threat_level="standard",
        attack_aptitude="assassin",
        attack_power=5,
        stress_attack_power=3,
        telegraphed_intent=True,
        evasion=30,
        resistances=[],
        vulnerabilities=["guardian"],
        action_weights={"attack": 55, "evade": 25, "ambient": 20},
        description_en=(
            "A fragment of something larger that was never completed. "
            "Or that completed itself in ways its designer did not intend. "
            "It moves with the precision of a blueprint and the malice of a splinter."
        ),
        description_de=(
            "Ein Fragment von etwas Größerem, das nie fertiggestellt wurde. "
            "Oder das sich auf Arten vollendete, die sein Konstrukteur nicht beabsichtigt hatte. "
            "Es bewegt sich mit der Präzision einer Blaupause und der Bosheit eines Splitters."
        ),
        ambient_text_en=[
            "The shard rotates, catching light. For a moment it looks like a tool.",
            "It clicks. Not mechanically \u2013 like a decision being made.",
        ],
        ambient_text_de=[
            "Der Splitter dreht sich, fängt Licht. Einen Moment lang sieht er aus wie ein Werkzeug.",
            "Er klickt. Nicht mechanisch \u2013 wie eine Entscheidung, die getroffen wird.",
        ],
    ),
    "prometheus_forge_wraith": EnemyTemplate(
        id="prometheus_forge_wraith",
        name_en="Forge Wraith",
        name_de="Schmiedewraith",
        archetype="The Prometheus",
        condition_threshold=4,
        stress_resistance=120,
        threat_level="elite",
        attack_aptitude="saboteur",
        attack_power=6,
        stress_attack_power=5,
        telegraphed_intent=True,
        evasion=15,
        resistances=["infiltrator", "assassin"],
        vulnerabilities=["spy", "guardian"],
        action_weights={"attack": 40, "stress_attack": 30, "corrode": 20, "ambient": 10},
        special_abilities=["corrode", "fortify"],
        description_en=(
            "Smoke and metal in the shape of a craftsman. "
            "It works at an invisible anvil, hammering things that are not there. "
            "When it notices the party, it does not stop working. "
            "It incorporates them."
        ),
        description_de=(
            "Rauch und Metall in der Form eines Handwerkers. "
            "Er arbeitet an einem unsichtbaren Amboss, hämmert Dinge, die nicht da sind. "
            "Als er den Trupp bemerkt, hört er nicht auf zu arbeiten. "
            "Er bezieht sie ein."
        ),
        ambient_text_en=[
            "The wraith hammers. Each strike reshapes the air.",
            "It pauses. Inspects its invisible work. Nods. Continues.",
            "Something in its forge-glow looks like recognition.",
        ],
        ambient_text_de=[
            "Das Wraith hämmert. Jeder Schlag formt die Luft um.",
            "Es hält inne. Inspiziert sein unsichtbares Werk. Nickt. Fährt fort.",
            "Etwas in seinem Schmiedeglühen sieht aus wie Wiedererkennung.",
        ],
    ),
    "prometheus_workshop_guardian": EnemyTemplate(
        id="prometheus_workshop_guardian",
        name_en="Workshop Guardian",
        name_de="Werkstattwächter",
        archetype="The Prometheus",
        condition_threshold=5,
        stress_resistance=150,
        threat_level="elite",
        attack_aptitude="guardian",
        attack_power=7,
        stress_attack_power=3,
        telegraphed_intent=True,
        evasion=5,
        resistances=["assassin", "spy"],
        vulnerabilities=["saboteur"],
        action_weights={"attack": 45, "defend": 30, "grapple": 15, "ambient": 10},
        special_abilities=["grapple", "fortify"],
        description_en=(
            "It was built to protect the workshop. "
            "It has been doing this for longer than the workshop has existed. "
            "Its loyalty is not to the current configuration \u2013 "
            "it is to the IDEA of the workshop."
        ),
        description_de=(
            "Er wurde gebaut, um die Werkstatt zu schützen. "
            "Er tut dies seit länger als die Werkstatt existiert. "
            "Seine Loyalität gilt nicht der aktuellen Konfiguration \u2013 "
            "sie gilt der IDEE der Werkstatt."
        ),
        ambient_text_en=[
            "The guardian's joints click in sequence. A readiness check.",
            "It watches {agent} with something that, in a living thing, would be called interest.",
        ],
        ambient_text_de=[
            "Die Gelenke des Wächters klicken in Reihenfolge. Ein Bereitschaftscheck.",
            "Er beobachtet {agent} mit etwas, das bei einem Lebewesen Interesse hieße.",
        ],
    ),
    "prometheus_the_prototype": EnemyTemplate(
        id="prometheus_the_prototype",
        name_en="The Prototype",
        name_de="Der Prototyp",
        archetype="The Prometheus",
        condition_threshold=6,
        stress_resistance=200,
        threat_level="boss",
        attack_aptitude="saboteur",
        attack_power=7,
        stress_attack_power=6,
        telegraphed_intent=True,
        evasion=10,
        resistances=["guardian", "spy", "propagandist"],
        vulnerabilities=[],
        action_weights={"attack": 35, "stress_attack": 30, "defend": 20, "special": 15},
        special_abilities=["fortify", "corrode"],
        description_en=(
            "It was supposed to be the masterwork. The culmination. "
            "The thing the workshop has been building toward since the first "
            "spark was struck. It is not finished. It does not know this. "
            "It functions with the absolute confidence of an unfinished thing "
            "that believes it is complete."
        ),
        description_de=(
            "Es sollte das Meisterwerk werden. Die Kulmination. "
            "Das Ding, auf das die Werkstatt seit dem ersten geschlagenen "
            "Funken hingearbeitet hat. Es ist nicht fertig. Es weiß das nicht. "
            "Es funktioniert mit der absoluten Zuversicht eines unfertigen Dings, "
            "das glaubt, es sei vollständig."
        ),
        ambient_text_en=[
            "The Prototype adjusts. Not to the party \u2013 to itself. Self-calibrating.",
            "Something inside it whirs. A sound like ambition.",
            "It looks at the party's crafted items. For a moment \u2013 envy.",
            "The Prototype's surface shifts. Adapting. Learning.",
        ],
        ambient_text_de=[
            "Der Prototyp justiert sich. Nicht auf den Trupp \u2013 auf sich selbst. Selbstkalibrierend.",
            "Etwas in seinem Inneren surrt. Ein Geräusch wie Ambition.",
            "Er betrachtet die gecrafteten Gegenstände des Trupps. Einen Moment lang \u2013 Neid.",
            "Die Oberfläche des Prototypen verschiebt sich. Anpassend. Lernend.",
        ],
    ),
}


# ── Prometheus Combat Spawn Configurations ────────────────────────────────

PROMETHEUS_SPAWN_CONFIGS: dict[str, list[dict]] = {
    "prometheus_sparks_spawn": [
        {"template_id": "prometheus_spark_wisp", "count": 3},
    ],
    "prometheus_workshop_patrol_spawn": [
        {"template_id": "prometheus_alloy_sentinel", "count": 1},
        {"template_id": "prometheus_spark_wisp", "count": 1},
    ],
    "prometheus_construct_pair_spawn": [
        {"template_id": "prometheus_crucible_drake", "count": 1},
        {"template_id": "prometheus_automaton_shard", "count": 1},
    ],
    "prometheus_residue_spawn": [
        {"template_id": "prometheus_slag_golem", "count": 1},
        {"template_id": "prometheus_spark_wisp", "count": 2},
    ],
    "prometheus_forge_elite_spawn": [
        {"template_id": "prometheus_forge_wraith", "count": 1},
        {"template_id": "prometheus_spark_wisp", "count": 1},
    ],
    "prometheus_guardian_elite_spawn": [
        {"template_id": "prometheus_workshop_guardian", "count": 1},
        {"template_id": "prometheus_alloy_sentinel", "count": 1},
    ],
    "prometheus_prototype_boss_spawn": [
        {"template_id": "prometheus_the_prototype", "count": 1},
        {"template_id": "prometheus_spark_wisp", "count": 2},
    ],
    # Rest site ambush (light)
    "prometheus_rest_ambush_spawn": [
        {"template_id": "prometheus_spark_wisp", "count": 2},
    ],
}


# ── The Deluge: Enemies ───────────────────────────────────────────────────

DELUGE_ENEMIES: dict[str, EnemyTemplate] = {
    "deluge_riptide_tendril": EnemyTemplate(
        id="deluge_riptide_tendril",
        name_en="Riptide Tendril",
        name_de="Sogranke",
        archetype="The Deluge",
        condition_threshold=1,
        stress_resistance=20,
        threat_level="minion",
        attack_aptitude="assassin",
        attack_power=2,
        stress_attack_power=3,
        telegraphed_intent=True,
        evasion=40,
        resistances=["infiltrator"],
        vulnerabilities=["guardian"],
        action_weights={"attack": 40, "drag": 30, "evade": 20, "ambient": 10},
        special_abilities=["drag"],
        description_en=(
            "A current given form. It does not strike \u2013 it pulls. "
            "The direction is always down, always toward deeper water."
        ),
        description_de=(
            "Eine Strömung, die Form angenommen hat. Sie schlägt nicht zu \u2013 "
            "sie zieht. Die Richtung ist immer abwärts, immer in tieferes Wasser."
        ),
        ambient_text_en=[
            "The tendril tests the space between {agent}'s feet and the floor.",
            "Something in the current reaches. Not aggressively \u2013 patiently.",
        ],
        ambient_text_de=[
            "Die Ranke prüft den Raum zwischen {agent}s Füßen und dem Boden.",
            "Etwas in der Strömung greift. Nicht aggressiv \u2013 geduldig.",
        ],
    ),
    "deluge_pressure_surge": EnemyTemplate(
        id="deluge_pressure_surge",
        name_en="Pressure Surge",
        name_de="Druckwelle",
        archetype="The Deluge",
        condition_threshold=2,
        stress_resistance=100,
        threat_level="standard",
        attack_aptitude="guardian",
        attack_power=4,
        stress_attack_power=5,
        telegraphed_intent=True,
        evasion=10,
        resistances=["assassin"],
        vulnerabilities=["saboteur", "spy"],
        action_weights={"attack": 45, "flood_pulse": 30, "stress_attack": 15, "ambient": 10},
        special_abilities=["flood_pulse"],
        description_en=(
            "The water's memory of what it once displaced. It arrives as a wall \u2013 "
            "not tall, not dramatic, but dense. The kind of force that moves "
            "furniture and doesn't notice."
        ),
        description_de=(
            "Die Erinnerung des Wassers an das, was es einst verdrängte. Es kommt "
            "als Wand \u2013 nicht hoch, nicht dramatisch, aber dicht. Die Art Kraft, "
            "die Möbel verschiebt und es nicht bemerkt."
        ),
        ambient_text_en=[
            "The water level in the room rises 2cm. Then 2cm more. Then stops.",
            "The pressure surge gathers. {agent} feels it in the floor before seeing it.",
        ],
        ambient_text_de=[
            "Der Pegel im Raum steigt um 2cm. Dann nochmal 2cm. Dann hört es auf.",
            "{agent} spürt die Druckwelle im Boden, bevor sie sichtbar wird.",
        ],
    ),
    "deluge_silt_revenant": EnemyTemplate(
        id="deluge_silt_revenant",
        name_en="Silt Revenant",
        name_de="Schlickwiedergänger",
        archetype="The Deluge",
        condition_threshold=3,
        stress_resistance=60,
        threat_level="standard",
        attack_aptitude="propagandist",
        attack_power=3,
        stress_attack_power=6,
        telegraphed_intent=True,
        evasion=15,
        resistances=["spy"],
        vulnerabilities=["propagandist", "guardian"],
        action_weights={"stress_attack": 40, "obscure": 30, "attack": 20, "ambient": 10},
        special_abilities=["obscure"],
        description_en=(
            "It emerged from the sediment when the water reached this level. "
            "A shape made of what the flood deposited \u2013 silt, mineral, "
            "the residue of dissolved rooms. It does not speak. "
            "It broadcasts the sound of water in enclosed spaces."
        ),
        description_de=(
            "Es stieg aus dem Sediment, als das Wasser diesen Pegel erreichte. "
            "Eine Gestalt aus dem, was die Flut ablagerte \u2013 Schlick, Mineral, "
            "der Rückstand aufgelöster Räume. Es spricht nicht. "
            "Es sendet das Geräusch von Wasser in geschlossenen Räumen."
        ),
        ambient_text_en=[
            "The revenant shifts. Silt falls from it like memory from a dream.",
            "{agent} recognizes something in the revenant's shape. A doorframe. A railing.",
        ],
        ambient_text_de=[
            "Der Wiedergänger bewegt sich. Schlick fällt von ihm wie Erinnerung aus einem Traum.",
            "{agent} erkennt etwas in der Form des Wiedergängers. Einen Türrahmen. Ein Geländer.",
        ],
    ),
    "deluge_undertow_warden": EnemyTemplate(
        id="deluge_undertow_warden",
        name_en="Undertow Warden",
        name_de="Sogwächter",
        archetype="The Deluge",
        condition_threshold=4,
        stress_resistance=200,
        threat_level="elite",
        attack_aptitude="guardian",
        attack_power=5,
        stress_attack_power=6,
        telegraphed_intent=True,
        evasion=5,
        resistances=["assassin", "infiltrator"],
        vulnerabilities=["saboteur"],
        action_weights={"attack": 35, "drag": 25, "flood_pulse": 20, "stress_attack": 10, "ambient": 10},
        special_abilities=["drag", "flood_pulse"],
        description_en=(
            "The water's enforcer. Not an entity that lives in water \u2013 "
            "an entity that IS water, given mass and purpose. "
            "It does not guard a door. It guards a depth."
        ),
        description_de=(
            "Der Vollstrecker des Wassers. Keine Entität, die im Wasser lebt \u2013 "
            "eine Entität, die Wasser IST, mit Masse und Absicht versehen. "
            "Es bewacht keine Tür. Es bewacht eine Tiefe."
        ),
        ambient_text_en=[
            "The warden does not approach. The water level in the room rises to meet it.",
            "Its shape changes with the current. {agent} cannot determine where it begins.",
        ],
        ambient_text_de=[
            "Der Wächter nähert sich nicht. Der Pegel im Raum steigt, um ihm entgegenzukommen.",
            "Seine Form ändert sich mit der Strömung. {agent} kann nicht bestimmen, wo er beginnt.",
        ],
    ),
    "deluge_the_current": EnemyTemplate(
        id="deluge_the_current",
        name_en="The Current",
        name_de="Die Strömung",
        archetype="The Deluge",
        condition_threshold=6,
        stress_resistance=350,
        threat_level="boss",
        attack_aptitude="guardian",
        attack_power=6,
        stress_attack_power=8,
        telegraphed_intent=False,
        evasion=0,
        resistances=["assassin", "infiltrator", "spy"],
        vulnerabilities=["saboteur", "guardian"],
        action_weights={"attack": 30, "flood_pulse": 25, "drag": 20, "tidal_wave": 15, "ambient": 10},
        special_abilities=["flood_pulse", "drag", "tidal_wave"],
        description_en=(
            "Not an enemy. A direction. The Current is the flood's final argument: "
            "that everything flows downward, that every barrier is temporary, "
            "that what the water claims, the water keeps. "
            "It does not attack. It arrives."
        ),
        description_de=(
            "Kein Feind. Eine Richtung. Die Strömung ist das letzte Argument der Flut: "
            "dass alles abwärts fließt, dass jede Barriere vorübergehend ist, "
            "dass was das Wasser beansprucht, das Wasser behält. "
            "Sie greift nicht an. Sie kommt."
        ),
        ambient_text_en=[
            "The Current fills the room. Not like water entering \u2013 like water remembering it was always here.",
            "The walls are underwater. The ceiling is not. For now.",
        ],
        ambient_text_de=[
            "Die Strömung füllt den Raum. Nicht wie einströmendes Wasser \u2013 wie Wasser, das sich erinnert, schon immer hier gewesen zu sein.",
            "Die Wände sind unter Wasser. Die Decke nicht. Noch nicht.",
        ],
    ),
}

DELUGE_SPAWN_CONFIGS: dict[str, list[dict]] = {
    "deluge_trickle_spawn": [
        {"template_id": "deluge_riptide_tendril", "count": 2},
    ],
    "deluge_surge_patrol_spawn": [
        {"template_id": "deluge_pressure_surge", "count": 1},
        {"template_id": "deluge_riptide_tendril", "count": 1},
    ],
    "deluge_sediment_spawn": [
        {"template_id": "deluge_silt_revenant", "count": 1},
        {"template_id": "deluge_riptide_tendril", "count": 1},
    ],
    "deluge_deep_water_spawn": [
        {"template_id": "deluge_pressure_surge", "count": 1},
        {"template_id": "deluge_silt_revenant", "count": 1},
    ],
    "deluge_warden_spawn": [
        {"template_id": "deluge_undertow_warden", "count": 1},
        {"template_id": "deluge_riptide_tendril", "count": 1},
    ],
    "deluge_rest_ambush_spawn": [
        {"template_id": "deluge_riptide_tendril", "count": 1},
    ],
}


# ── Awakening Enemy Templates ─────────────────────────────────────────────

AWAKENING_ENEMIES: dict[str, EnemyTemplate] = {
    "awakening_echo_fragment": EnemyTemplate(
        id="awakening_echo_fragment",
        name_en="Echo Fragment",
        name_de="Echofragment",
        archetype="The Awakening",
        condition_threshold=1,
        stress_resistance=30,
        threat_level="minion",
        attack_aptitude="infiltrator",
        attack_power=2,
        stress_attack_power=4,
        telegraphed_intent=True,
        evasion=45,
        resistances=["assassin"],
        vulnerabilities=["spy"],
        action_weights={"stress_attack": 50, "evade": 30, "resonate": 10, "ambient": 10},
        special_abilities=["resonate"],
        description_en=(
            "A memory of a memory. It does not have content \u2013 "
            "it has the shape where content was. "
            "{agent} recognizes the absence, not the thing."
        ),
        description_de=(
            "Eine Erinnerung an eine Erinnerung. Sie hat keinen Inhalt \u2013 "
            "sie hat die Form, wo Inhalt war. "
            "{agent} erkennt die Abwesenheit, nicht das Ding."
        ),
        ambient_text_en=[
            "The fragment flickers. For a moment it wears {agent}'s posture.",
            "Something familiar in the echo. Not the memory \u2013 the act of remembering.",
        ],
        ambient_text_de=[
            "Das Fragment flackert. Einen Moment lang trägt es {agent}s Haltung.",
            "Etwas Vertrautes im Echo. Nicht die Erinnerung \u2013 der Akt des Erinnerns.",
        ],
    ),
    "awakening_deja_vu_phantom": EnemyTemplate(
        id="awakening_deja_vu_phantom",
        name_en="Déjà-vu Phantom",
        name_de="Déjà-vu-Phantom",
        archetype="The Awakening",
        condition_threshold=2,
        stress_resistance=80,
        threat_level="standard",
        attack_aptitude="propagandist",
        attack_power=3,
        stress_attack_power=6,
        telegraphed_intent=True,
        evasion=20,
        resistances=["saboteur"],
        vulnerabilities=["propagandist", "spy"],
        action_weights={"stress_attack": 40, "recognition": 30, "attack": 20, "ambient": 10},
        special_abilities=["recognition"],
        description_en=(
            "It is not here for the first time. It has always been in this room, "
            "waiting for the party to arrive again. Its movements are half a second "
            "ahead of expectation \u2013 as if the party remembers fighting it "
            "before the fight has begun."
        ),
        description_de=(
            "Es ist nicht zum ersten Mal hier. Es war immer in diesem Raum "
            "und wartete darauf, dass die Gruppe wieder ankommt. Seine Bewegungen "
            "sind eine halbe Sekunde vor der Erwartung \u2013 als erinnerte sich "
            "die Gruppe an den Kampf, bevor er begonnen hat."
        ),
        ambient_text_en=[
            "The phantom repeats a gesture {agent} has not yet made.",
            "Déjà vu. The phantom was already there. It was always already there.",
        ],
        ambient_text_de=[
            "Das Phantom wiederholt eine Geste, die {agent} noch nicht gemacht hat.",
            "Déjà vu. Das Phantom war bereits da. Es war immer bereits da.",
        ],
    ),
    "awakening_consciousness_leech": EnemyTemplate(
        id="awakening_consciousness_leech",
        name_en="Consciousness Leech",
        name_de="Bewusstseinsegel",
        archetype="The Awakening",
        condition_threshold=2,
        stress_resistance=60,
        threat_level="standard",
        attack_aptitude="spy",
        attack_power=4,
        stress_attack_power=5,
        telegraphed_intent=True,
        evasion=15,
        resistances=["propagandist"],
        vulnerabilities=["guardian", "assassin"],
        action_weights={"attack": 40, "drain_awareness": 25, "stress_attack": 25, "ambient": 10},
        special_abilities=["drain_awareness"],
        description_en=(
            "Watts was right about this one. It functions perfectly without "
            "self-awareness \u2013 a philosophical zombie made operational. "
            "It does not think. It processes. And it is faster than anything "
            "that pauses to reflect."
        ),
        description_de=(
            "Watts hatte Recht, was dieses betrifft. Es funktioniert einwandfrei "
            "ohne Selbstbewusstsein \u2013 ein philosophischer Zombie, operational. "
            "Es denkt nicht. Es verarbeitet. Und es ist schneller als alles, "
            "was innehält, um nachzudenken."
        ),
        ambient_text_en=[
            "The leech observes {agent}. Not with curiosity \u2013 with efficiency.",
            "It does not know it exists. This is its advantage.",
        ],
        ambient_text_de=[
            "Der Egel beobachtet {agent}. Nicht mit Neugier \u2013 mit Effizienz.",
            "Es weiß nicht, dass es existiert. Das ist sein Vorteil.",
        ],
    ),
    "awakening_repressed_sentinel": EnemyTemplate(
        id="awakening_repressed_sentinel",
        name_en="Repressed Sentinel",
        name_de="Verdrängungs\u00adwächter",
        archetype="The Awakening",
        condition_threshold=4,
        stress_resistance=100,
        threat_level="elite",
        attack_aptitude="guardian",
        attack_power=5,
        stress_attack_power=7,
        telegraphed_intent=True,
        evasion=10,
        resistances=["spy", "infiltrator"],
        vulnerabilities=["propagandist"],
        action_weights={"attack": 35, "suppress": 25, "stress_attack": 20, "defend": 10, "ambient": 10},
        special_abilities=["suppress"],
        description_en=(
            "The sentinel guards the threshold between conscious and unconscious. "
            "Ishiguro's mist made guardian \u2013 it exists to ensure the buried "
            "stays buried. It does not hate the party. It pities their need to know."
        ),
        description_de=(
            "Der Wächter hütet die Schwelle zwischen Bewusstem und Unbewusstem. "
            "Ishiguros Nebel, zum Wächter geworden \u2013 er existiert, um sicherzustellen, "
            "dass das Vergrabene begraben bleibt. Er hasst die Gruppe nicht. "
            "Er bedauert ihr Bedürfnis zu wissen."
        ),
        ambient_text_en=[
            "The sentinel stands between {agent} and a memory {agent} cannot name.",
            "It makes no sound. Repression is always quiet.",
        ],
        ambient_text_de=[
            "Der Wächter steht zwischen {agent} und einer Erinnerung, die {agent} nicht benennen kann.",
            "Er gibt keinen Laut. Verdrängung ist immer still.",
        ],
    ),
    "awakening_the_repressed": EnemyTemplate(
        id="awakening_the_repressed",
        name_en="The Repressed",
        name_de="Das Verdrängte",
        archetype="The Awakening",
        condition_threshold=6,
        stress_resistance=120,
        threat_level="boss",
        attack_aptitude="guardian",
        attack_power=6,
        stress_attack_power=9,
        telegraphed_intent=False,
        evasion=15,
        resistances=["assassin", "saboteur"],
        vulnerabilities=["spy", "propagandist"],
        action_weights={"attack": 30, "resurface": 25, "stress_attack": 25, "suppress": 10, "ambient": 10},
        special_abilities=["resurface", "suppress"],
        description_en=(
            "A memory so painful it was buried by consensus. Not by one agent \u2013 "
            "by all of them simultaneously. It is not a monster. "
            "It is the truth that was too heavy to carry and too important to destroy. "
            "Jung's encounter with the Self, Tarkovsky's Room: "
            "it grants your true desire, not your stated one."
        ),
        description_de=(
            "Eine Erinnerung so schmerzhaft, dass sie durch Konsens begraben wurde. "
            "Nicht von einem Agenten \u2013 von allen gleichzeitig. "
            "Es ist kein Monster. Es ist die Wahrheit, die zu schwer war, "
            "um sie zu tragen, und zu wichtig, um sie zu zerstören. "
            "Jungs Begegnung mit dem Selbst, Tarkowskis Raum: "
            "er gewährt den wahren Wunsch, nicht den ausgesprochenen."
        ),
        ambient_text_en=[
            "The Repressed does not attack. It surfaces. The damage is recognition.",
            "It has been here the entire dungeon. In every room, behind every memory.",
            "{agent} realizes: they knew. They always knew. They chose not to know.",
        ],
        ambient_text_de=[
            "Das Verdrängte greift nicht an. Es taucht auf. Der Schaden ist Wiedererkennung.",
            "Es war das gesamte Dungeon hier. In jedem Raum, hinter jeder Erinnerung.",
            "{agent} erkennt: sie wussten es. Sie wussten es immer. Sie entschieden sich, es nicht zu wissen.",
        ],
    ),
}

AWAKENING_SPAWN_CONFIGS: dict[str, list[dict]] = {
    # Basic echo encounter (depth 1-3)
    "awakening_echo_drift_spawn": [
        {"template_id": "awakening_echo_fragment", "count": 2},
    ],
    # Déjà-vu with echo support (depth 2-4)
    "awakening_deja_vu_patrol_spawn": [
        {"template_id": "awakening_deja_vu_phantom", "count": 1},
        {"template_id": "awakening_echo_fragment", "count": 1},
    ],
    # Consciousness leech encounter (depth 2-5)
    "awakening_leech_hunt_spawn": [
        {"template_id": "awakening_consciousness_leech", "count": 1},
        {"template_id": "awakening_echo_fragment", "count": 1},
    ],
    # Deep consciousness (depth 3-6)
    "awakening_deep_mind_spawn": [
        {"template_id": "awakening_consciousness_leech", "count": 1},
        {"template_id": "awakening_deja_vu_phantom", "count": 1},
    ],
    # Sentinel guarding (depth 4-7, elite)
    "awakening_sentinel_spawn": [
        {"template_id": "awakening_repressed_sentinel", "count": 1},
        {"template_id": "awakening_echo_fragment", "count": 1},
    ],
    # Rest site ambush (light)
    "awakening_rest_ambush_spawn": [
        {"template_id": "awakening_echo_fragment", "count": 1},
    ],
}


# ── Archetype Registries ──────────────────────────────────────────────────
# Data lookup by archetype name — zero conditionals. New archetypes add entries.

_ENEMY_REGISTRIES: dict[str, dict[str, EnemyTemplate]] = {
    "The Shadow": SHADOW_ENEMIES,
    "The Tower": TOWER_ENEMIES,
    "The Entropy": ENTROPY_ENEMIES,
    "The Devouring Mother": MOTHER_ENEMIES,
    "The Prometheus": PROMETHEUS_ENEMIES,
    "The Deluge": DELUGE_ENEMIES,
    "The Awakening": AWAKENING_ENEMIES,
}

_SPAWN_REGISTRIES: dict[str, dict[str, list[dict]]] = {
    "The Shadow": SHADOW_SPAWN_CONFIGS,
    "The Tower": TOWER_SPAWN_CONFIGS,
    "The Entropy": ENTROPY_SPAWN_CONFIGS,
    "The Devouring Mother": MOTHER_SPAWN_CONFIGS,
    "The Prometheus": PROMETHEUS_SPAWN_CONFIGS,
    "The Deluge": DELUGE_SPAWN_CONFIGS,
    "The Awakening": AWAKENING_SPAWN_CONFIGS,
}


def spawn_enemies(
    encounter_id: str,
    difficulty: int,
    depth: int,
    archetype: str = "The Shadow",
) -> list[EnemyInstance]:
    """Spawn enemy instances for a combat encounter.

    Applies difficulty scaling to enemy stats.

    Args:
        encounter_id: Combat encounter spawn config ID.
        difficulty: 1-5 difficulty level.
        depth: Current dungeon depth.
        archetype: Dungeon archetype for registry lookup.

    Returns:
        List of EnemyInstance ready for combat.
    """
    from backend.services.dungeon.dungeon_archetypes import DIFFICULTY_MULTIPLIERS
    from backend.services.dungeon_content_service import get_enemy_registry, get_spawn_registry

    spawn_registry = get_spawn_registry().get(archetype, {})
    config = spawn_registry.get(encounter_id, [])
    if not config:
        logger.warning("No spawn config for encounter %s (archetype: %s)", encounter_id, archetype)
        return []

    diff_mult = DIFFICULTY_MULTIPLIERS.get(difficulty, DIFFICULTY_MULTIPLIERS[1])
    enemy_registry = get_enemy_registry().get(archetype, {})
    instances: list[EnemyInstance] = []

    for entry in config:
        template = enemy_registry.get(entry["template_id"])
        if not template:
            logger.error("Unknown enemy template: %s", entry["template_id"])
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "dungeon_combat")
                scope.set_tag("encounter_id", encounter_id)
                sentry_sdk.capture_message(f"Unknown enemy template: {entry['template_id']}")
            continue

        for _i in range(entry.get("count", 1)):
            # Scale condition threshold with difficulty
            scaled_condition = max(
                1,
                int(
                    template.condition_threshold * diff_mult["enemy_condition"],
                ),
            )

            instances.append(
                EnemyInstance(
                    instance_id=f"{template.id}_{uuid4().hex[:6]}",
                    template_id=template.id,
                    name_en=template.name_en,
                    name_de=template.name_de,
                    condition_steps_remaining=scaled_condition,
                    condition_steps_max=scaled_condition,
                    threat_level=template.threat_level,
                    stress_resistance=template.stress_resistance,
                    evasion=template.evasion,
                )
            )

    return instances


def check_ambush(
    archetype_state: dict,
    archetype: str = "The Shadow",
    encounter: dict | None = None,
) -> bool:
    """Check if an ambush occurs based on archetype state and encounter config.

    Shadow: visibility-based (Review #7: VP 0 = 40%, VP 1 = 15%).
    Tower: stability-based (added in Phase E).
    """
    from backend.services.dungeon.dungeon_archetypes import ARCHETYPE_CONFIGS

    if encounter and encounter.get("is_ambush"):
        return True  # Forced ambush encounters always trigger

    if archetype == "The Shadow":
        shadow_config = ARCHETYPE_CONFIGS["The Shadow"]["mechanic_config"]
        visibility = archetype_state.get("visibility", 3)
        if visibility == 0:
            return random.random() < shadow_config["blind_ambush_chance"]
        if visibility == 1:
            return random.random() < 0.15  # dim: 15% ambush
    elif archetype == "The Tower":
        tower_config = ARCHETYPE_CONFIGS["The Tower"]["mechanic_config"]
        stability = archetype_state.get("stability", 100)
        if stability <= 0:
            return random.random() < tower_config.get("collapse_ambush_chance", 0.50)
        if stability < 15:
            return random.random() < tower_config["low_stability_ambush_15"]
        if stability < 30:
            return random.random() < tower_config["low_stability_ambush_30"]
    elif archetype == "The Devouring Mother":
        mother_config = ARCHETYPE_CONFIGS["The Devouring Mother"]["mechanic_config"]
        attachment = archetype_state.get("attachment", 0)
        if attachment >= 90:
            return random.random() < mother_config["high_attachment_ambush_90"]
        if attachment >= 75:
            return random.random() < mother_config["high_attachment_ambush_75"]
    elif archetype == "The Deluge":
        deluge_config = ARCHETYPE_CONFIGS["The Deluge"]["mechanic_config"]
        water = archetype_state.get("water_level", 0)
        if water >= 75:
            return random.random() < deluge_config["high_water_ambush_75"]
        if water >= 50:
            return random.random() < deluge_config["high_water_ambush_50"]
    elif archetype == "The Awakening":
        awakening_config = ARCHETYPE_CONFIGS["The Awakening"]["mechanic_config"]
        awareness = archetype_state.get("awareness", 0)
        if awareness >= 90:
            return random.random() < awakening_config["high_awareness_ambush_90"]
        if awareness >= 70:
            return random.random() < awakening_config["high_awareness_ambush_70"]

    return False


def get_enemy_templates_dict(archetype: str = "The Shadow") -> dict[str, dict]:
    """Get enemy templates as plain dicts for combat engine."""
    from backend.services.dungeon_content_service import get_enemy_registry

    registry = get_enemy_registry().get(archetype, {})
    return {eid: template.model_dump() for eid, template in registry.items()}
