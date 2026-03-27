"""Shared combat models — dungeon-agnostic types for the combat system.

These types are used by both Resonance Dungeons and future War Room Ops.
Game-system-specific state (visibility, stability, etc.) is passed via
context dicts, never hardcoded here.

Extracted from resonance_dungeon.py to maintain clean module boundaries:
  backend/services/combat/ → imports from backend/models/combat.py (this file)
  backend/services/dungeon/ → imports from backend/models/resonance_dungeon.py
  backend/models/resonance_dungeon.py → re-exports from here for backwards compat
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

# ── Shared Literals ───────────────────────────────────────────────────────────

Condition = Literal[
    "operational",
    "stressed",
    "wounded",
    "afflicted",
    "captured",
]

ThreatLevel = Literal["minion", "standard", "elite", "boss"]

AbilitySchool = Literal[
    "spy",
    "guardian",
    "saboteur",
    "propagandist",
    "infiltrator",
    "assassin",
]


# ── Combat State Models ───────────────────────────────────────────────────────


class AgentCombatState(BaseModel):
    """Agent's mutable state during combat. Used by dungeons and War Room Ops."""

    agent_id: UUID
    agent_name: str
    portrait_url: str | None = None
    condition: Condition = "operational"
    stress: int = 0
    mood: int = 0
    active_buffs: list[str] = Field(default_factory=list)
    active_debuffs: list[str] = Field(default_factory=list)
    aptitudes: dict[str, int] = Field(default_factory=dict)
    personality: dict[str, float] = Field(default_factory=dict)
    resilience: float = 0.5
    cooldowns: dict[str, int] = Field(default_factory=dict)


class EnemyInstance(BaseModel):
    """Runtime enemy state during combat."""

    instance_id: str
    template_id: str
    name_en: str
    name_de: str
    condition_steps_remaining: int
    stress_resistance: int
    evasion: int
    is_alive: bool = True
    active_effects: list[str] = Field(default_factory=list)


class CombatState(BaseModel):
    """Active combat encounter state."""

    round_num: int = 1
    max_rounds: int = 10
    enemies: list[EnemyInstance] = Field(default_factory=list)
    phase: Literal["assessment", "planning", "resolving", "outcome"] = "assessment"
    submitted_actions: dict[str, list[dict]] = Field(default_factory=dict)
    telegraphed_intents: list[dict] = Field(default_factory=list)
    is_ambush: bool = False
