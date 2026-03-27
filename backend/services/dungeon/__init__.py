"""Dungeon module — Resonance Dungeon-specific logic.

Contains archetype configs, graph generation, encounter templates,
enemy definitions, and loot tables. Uses the shared combat/ module
for all combat resolution.
"""

from backend.services.dungeon.dungeon_archetypes import (
    ARCHETYPE_CONFIGS,
    ARCHETYPE_ROOM_DISTRIBUTIONS,
    DIFFICULTY_MULTIPLIERS,
)
from backend.services.dungeon.dungeon_generator import generate_dungeon_graph

__all__ = [
    "ARCHETYPE_CONFIGS",
    "ARCHETYPE_ROOM_DISTRIBUTIONS",
    "DIFFICULTY_MULTIPLIERS",
    "generate_dungeon_graph",
]
