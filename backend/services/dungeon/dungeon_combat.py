"""Dungeon combat dispatch — runtime helpers backed by pack-derived content.

Content lives in `content/dungeon/archetypes/{slug}/enemies.yaml` and
`spawns.yaml` (A1 externalization, committed 2026-04-19). The per-archetype
`*_ENEMIES` and `*_SPAWN_CONFIGS` constants, plus the `_ENEMY_REGISTRIES`
and `_SPAWN_REGISTRIES` dispatch tables, were deleted in A1.5b. Runtime
consumers read via `dungeon_content_service.get_enemy_registry()` and
`get_spawn_registry()`.

Remaining surface:
  - `spawn_enemies` — materialize an `EnemyInstance` list from a spawn
    config ID (difficulty-scaled condition threshold).
  - `check_ambush` — archetype-state → probability gate for ambush
    encounters.
  - `get_enemy_templates_dict` — plain-dict view for the combat engine
    (avoids import coupling to Pydantic models).
"""

from __future__ import annotations

import logging
import random
from uuid import uuid4

import sentry_sdk

from backend.models.resonance_dungeon import EnemyInstance

logger = logging.getLogger(__name__)


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
    elif archetype == "The Overthrow":
        overthrow_config = ARCHETYPE_CONFIGS["The Overthrow"]["mechanic_config"]
        fracture = archetype_state.get("fracture", 0)
        if fracture >= 80:
            return random.random() < overthrow_config["high_fracture_ambush_80"]
        if fracture >= 60:
            return random.random() < overthrow_config["high_fracture_ambush_60"]

    return False


def get_enemy_templates_dict(archetype: str = "The Shadow") -> dict[str, dict]:
    """Get enemy templates as plain dicts for combat engine."""
    from backend.services.dungeon_content_service import get_enemy_registry

    registry = get_enemy_registry().get(archetype, {})
    return {eid: template.model_dump() for eid, template in registry.items()}
