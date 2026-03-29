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
            "A flickering presence at the edge of perception. It doesn't attack the body \u2014 it erodes certainty."
        ),
        description_de=(
            "Eine flackernde Präsenz am Rand der Wahrnehmung. "
            "Sie greift nicht den Körper an \u2014 sie zersetzt Gewissheit."
        ),
        ambient_text_en=[
            "The wisp drifts closer, then retreats. Testing.",
            "You feel it before you see it \u2014 a chill that starts behind the eyes.",
        ],
        ambient_text_de=[
            "Der Glimmer treibt näher, dann zurück. Testend.",
            "Ihr spürt es, bevor ihr es seht \u2014 eine Kälte, die hinter den Augen beginnt.",
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
        condition_threshold=3,
        stress_resistance=200,
        threat_level="standard",
        attack_aptitude="assassin",
        attack_power=6,
        stress_attack_power=5,
        telegraphed_intent=True,
        evasion=20,
        resistances=["propagandist"],
        vulnerabilities=["spy", "guardian"],
        action_weights={"attack": 40, "stress_attack": 30, "ambush": 20, "defend": 10},
        description_en=(
            "A replay of violence that once scarred this place. It moves with the precision "
            "of memory \u2014 every strike has happened before."
        ),
        description_de=(
            "Eine Wiederholung von Gewalt, die diesen Ort einst gezeichnet hat. "
            "Sie bewegt sich mit der Prazision der Erinnerung \u2014 jeder Schlag ist schon geschehen."
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
        condition_threshold=2,
        stress_resistance=300,
        threat_level="standard",
        attack_aptitude="propagandist",
        attack_power=2,
        stress_attack_power=8,
        telegraphed_intent=False,  # LIES about its intents
        evasion=30,
        resistances=["spy"],
        vulnerabilities=["propagandist", "guardian"],
        action_weights={"stress_attack": 50, "disinformation": 30, "hide": 20},
        special_abilities=["disinformation"],
        description_en=(
            "It whispers. Not lies, exactly \u2014 plausible fears. "
            "Things your agents already suspect about each other."
        ),
        description_de=(
            "Es flüstert. Nicht Lügen, genau genommen \u2014 plausible Ängste. "
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
            "\u2014 it recites. Market figures, compound rates, the precise "
            "mathematics of structures that can't hold."
        ),
        description_de=(
            "Eine nervöse Gestalt, umweht von laufenden Zahlen. Sie kämpft "
            "nicht \u2014 sie rezitiert. Marktkurse, Zinseszinsen, die präzise "
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
        condition_threshold=3,
        stress_resistance=250,
        threat_level="standard",
        attack_aptitude="guardian",
        attack_power=5,
        stress_attack_power=4,
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
        condition_threshold=2,
        stress_resistance=300,
        threat_level="standard",
        attack_aptitude="propagandist",
        attack_power=2,
        stress_attack_power=6,
        telegraphed_intent=False,  # LIES about its intents
        evasion=25,
        resistances=["spy"],
        vulnerabilities=["propagandist", "guardian"],
        action_weights={"stress_attack": 45, "compound": 30, "disinformation": 15, "ambient": 10},
        special_abilities=["compound", "disinformation"],
        description_en=(
            "It speaks in promises that were never kept. Each round it grows, "
            "fed by the compound interest of unresolved obligations. It lies "
            "about its intentions \u2014 not from malice, but because the "
            "ledger demands it."
        ),
        description_de=(
            "Es spricht in Versprechen, die nie gehalten wurden. Jede Runde "
            "wächst es, genährt vom Zinseszins ungelöster Verpflichtungen. "
            "Es lügt über seine Absichten \u2014 nicht aus Bosheit, sondern "
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

# ── Archetype Registries ──────────────────────────────────────────────────
# Data lookup by archetype name — zero conditionals. New archetypes add entries.

_ENEMY_REGISTRIES: dict[str, dict[str, EnemyTemplate]] = {
    "The Shadow": SHADOW_ENEMIES,
    "The Tower": TOWER_ENEMIES,
}

_SPAWN_REGISTRIES: dict[str, dict[str, list[dict]]] = {
    "The Shadow": SHADOW_SPAWN_CONFIGS,
    "The Tower": TOWER_SPAWN_CONFIGS,
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

    spawn_registry = _SPAWN_REGISTRIES.get(archetype, {})
    config = spawn_registry.get(encounter_id, [])
    if not config:
        logger.warning("No spawn config for encounter %s (archetype: %s)", encounter_id, archetype)
        return []

    diff_mult = DIFFICULTY_MULTIPLIERS.get(difficulty, DIFFICULTY_MULTIPLIERS[1])
    enemy_registry = _ENEMY_REGISTRIES.get(archetype, {})
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
        if stability < 15:
            return random.random() < tower_config["low_stability_ambush_15"]
        if stability < 30:
            return random.random() < tower_config["low_stability_ambush_30"]

    return False


def get_enemy_templates_dict(archetype: str = "The Shadow") -> dict[str, dict]:
    """Get enemy templates as plain dicts for combat engine."""
    registry = _ENEMY_REGISTRIES.get(archetype, {})
    return {eid: template.model_dump() for eid, template in registry.items()}
