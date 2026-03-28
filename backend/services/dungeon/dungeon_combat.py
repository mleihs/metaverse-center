"""Shadow enemy templates and dungeon-specific combat logic.

Contains the 5 Shadow enemies for Phase 0 MVP and combat spawn/ambush logic.
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
            "Eine flackernde Prasenz am Rand der Wahrnehmung. "
            "Sie greift nicht den Koerper an \u2014 sie zersetzt Gewissheit."
        ),
        ambient_text_en=[
            "The wisp drifts closer, then retreats. Testing.",
            "You feel it before you see it \u2014 a chill that starts behind the eyes.",
        ],
        ambient_text_de=[
            "Der Glimmer treibt naher, dann zurueck. Testend.",
            "Ihr spuert es, bevor ihr es seht \u2014 eine Kalte, die hinter den Augen beginnt.",
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
            "Es fluestert. Nicht Luegen, genau genommen \u2014 plausible Aengste. "
            "Dinge, die eure Agenten bereits voneinander vermuten."
        ),
        ambient_text_en=[
            "The shade whispers something to {agent}. Their expression changes.",
            "You can't tell if it's speaking or if the voice is in your head.",
        ],
        ambient_text_de=[
            "Der Schatten fluestert {agent} etwas zu. Ihr Ausdruck andert sich.",
            "Ihr koennt nicht sagen, ob er spricht oder ob die Stimme in eurem Kopf ist.",
        ],
    ),
    "shadow_remnant": EnemyTemplate(
        id="shadow_remnant",
        name_en="The Remnant",
        name_de="Der Ueberrest",
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
            "Geformt aus dem staerksten ungeloesten Konflikt der Simulation. "
            "Er erinnert sich an das, was eure Agenten zu vergessen versucht haben."
        ),
        ambient_text_en=[
            "The Remnant studies you. It has been waiting for someone to come this deep.",
            "Wisps orbit the Remnant like satellites. They pulse in unison.",
        ],
        ambient_text_de=[
            "Der Ueberrest beobachtet euch. Er hat darauf gewartet, dass jemand so tief kommt.",
            "Glimmer umkreisen den Ueberrest wie Satelliten. Sie pulsieren im Gleichklang.",
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


def spawn_enemies(
    encounter_id: str,
    difficulty: int,
    depth: int,
) -> list[EnemyInstance]:
    """Spawn enemy instances for a combat encounter.

    Applies difficulty scaling to enemy stats.

    Args:
        encounter_id: Combat encounter spawn config ID.
        difficulty: 1-5 difficulty level.
        depth: Current dungeon depth.

    Returns:
        List of EnemyInstance ready for combat.
    """
    from backend.services.dungeon.dungeon_archetypes import DIFFICULTY_MULTIPLIERS

    config = SHADOW_SPAWN_CONFIGS.get(encounter_id, [])
    if not config:
        logger.warning("No spawn config for encounter %s", encounter_id)
        return []

    diff_mult = DIFFICULTY_MULTIPLIERS.get(difficulty, DIFFICULTY_MULTIPLIERS[1])
    instances: list[EnemyInstance] = []

    for entry in config:
        template = SHADOW_ENEMIES.get(entry["template_id"])
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
    visibility: int,
    encounter: dict | None = None,
) -> bool:
    """Check if an ambush occurs based on visibility and encounter config.

    Review #7: VP 0 ambush chance reduced to 40% (was 60%).
    """
    from backend.services.dungeon.dungeon_archetypes import ARCHETYPE_CONFIGS

    shadow_config = ARCHETYPE_CONFIGS["The Shadow"]["mechanic_config"]

    if encounter and encounter.get("is_ambush"):
        return True  # Forced ambush encounters always trigger

    if visibility == 0:
        return random.random() < shadow_config["blind_ambush_chance"]

    if visibility == 1:
        return random.random() < 0.15  # dim: 15% ambush

    return False


def get_enemy_templates_dict() -> dict[str, dict]:
    """Get all Shadow enemy templates as plain dicts for combat engine."""
    return {eid: template.model_dump() for eid, template in SHADOW_ENEMIES.items()}
