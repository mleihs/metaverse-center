"""Ability schools — runtime dataclasses + accessors for the combat system.

Content lives in `content/dungeon/abilities/{school}.yaml` (A1 externalization,
committed 2026-04-19). The 7 per-school `*_ABILITIES` lists and the
`ALL_ABILITIES` registry that used to live here were deleted together with
the other dungeon Python dicts in A1.5b. Runtime callers read via
`dungeon_content_service.get_ability_registry()`, which returns the
pack-derived dataclass instances.

This module now only declares the runtime contract (`Ability`,
`AbilityResult`) and the thin accessor functions that combat callers
depend on.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Literal

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Ability:
    """Definition of a combat ability."""

    id: str
    name_en: str
    name_de: str
    school: str
    description_en: str
    description_de: str
    min_aptitude: int = 3
    cooldown: int = 0  # rounds between uses (0 = every round)
    effect_type: str = "damage"  # damage, stress_damage, heal_stress, buff, debuff, utility
    effect_params: dict = field(default_factory=dict)
    is_ultimate: bool = False
    targets: Literal["single_enemy", "all_enemies", "single_ally", "all_allies", "self"] = "single_enemy"


@dataclass
class AbilityResult:
    """Result of resolving an ability."""

    ability_id: str
    success: bool = True
    hit: bool = True
    damage_steps: int = 0
    stress_damage: int = 0
    stress_heal: int = 0
    applied_buffs: list[str] = field(default_factory=list)
    applied_debuffs: list[str] = field(default_factory=list)
    narrative_en: str = ""
    narrative_de: str = ""
    special_effects: dict = field(default_factory=dict)


def get_available_abilities(
    school: str,
    aptitude_level: int,
    archetype: str | None = None,
) -> list[Ability]:
    """Get abilities available to an agent based on school, aptitude, and archetype.

    Args:
        school: Ability school name (spy, guardian, universal, etc.)
        aptitude_level: Agent's aptitude score in this school (0-9).
        archetype: Current dungeon archetype (e.g. "The Shadow", "The Tower").
            If provided, abilities with ``archetype_required`` that don't match
            are excluded.

    Returns:
        List of abilities the agent qualifies for.
    """
    from backend.services.dungeon_content_service import get_ability_registry

    school_abilities = get_ability_registry().get(school, [])
    return [
        a
        for a in school_abilities
        if aptitude_level >= a.min_aptitude
        and (not a.effect_params.get("archetype_required") or a.effect_params["archetype_required"] == archetype)
    ]


def get_ability_by_id(ability_id: str) -> Ability | None:
    """Look up an ability by its ID across all schools."""
    from backend.services.dungeon_content_service import get_ability_registry

    for abilities in get_ability_registry().values():
        for ability in abilities:
            if ability.id == ability_id:
                return ability
    return None


def get_agent_all_abilities(
    aptitudes: dict[str, int],
    archetype: str | None = None,
) -> list[Ability]:
    """Get all available abilities for an agent across all their aptitude schools.

    Always includes universal abilities (Basic Attack) so every agent can deal
    damage regardless of their aptitude profile.

    Args:
        aptitudes: Dict of school -> aptitude level, e.g. {"spy": 8, "guardian": 3}.
        archetype: Current dungeon archetype for filtering archetype-gated abilities.

    Returns:
        Combined list of all unlocked abilities. Always non-empty due to universal
        abilities being included unconditionally.
    """
    result: list[Ability] = []
    for school, level in aptitudes.items():
        if level > 0:
            result.extend(get_available_abilities(school, level, archetype))
    # Universal abilities are always available (Basic Attack guarantees damage)
    result.extend(get_available_abilities("universal", 0, archetype))
    return result
