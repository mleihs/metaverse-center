"""Shared combat module — reusable by Resonance Dungeons and War Room Ops.

This module is dungeon-agnostic. All game-system-specific state (visibility,
stability, etc.) is passed in via context dicts, never imported from dungeon/.
"""

from backend.services.combat.combat_engine import (
    CombatContext,
    CombatRoundResult,
    generate_enemy_actions,
    resolve_combat_round,
)
from backend.services.combat.condition_tracks import (
    apply_condition_damage,
    can_act,
    get_condition_severity,
)
from backend.services.combat.skill_checks import (
    SkillCheckContext,
    SkillCheckOutcome,
    resolve_skill_check,
)
from backend.services.combat.stress_system import (
    calculate_ambient_stress,
    calculate_stress_damage,
    resolve_stress_check,
    stress_threshold,
)

__all__ = [
    "CombatContext",
    "CombatRoundResult",
    "SkillCheckContext",
    "SkillCheckOutcome",
    "apply_condition_damage",
    "calculate_ambient_stress",
    "calculate_stress_damage",
    "can_act",
    "generate_enemy_actions",
    "get_condition_severity",
    "resolve_combat_round",
    "resolve_skill_check",
    "resolve_stress_check",
    "stress_threshold",
]
