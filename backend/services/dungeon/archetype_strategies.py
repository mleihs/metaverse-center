"""Archetype Strategy Pattern for Resonance Dungeons.

Each archetype implements a strategy that defines its unique mechanic:
- How state is initialized (visibility, stability, etc.)
- How resources drain on room entry
- How resources restore on events (combat victory, rest, treasure, scout)
- How encounter choice effects modify archetype state
- Optional hooks for combat-round drain, failed-check drain, ambient stress

The engine service calls strategy methods via `get_archetype_strategy(name)`
without knowing which archetype is active. Adding a new archetype requires
only a new Strategy subclass + registry entry — zero engine changes.

Strategies are stateless singletons. All mutable state lives in
`instance.archetype_state`.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from backend.services.dungeon.dungeon_archetypes import ARCHETYPE_CONFIGS

if TYPE_CHECKING:
    from backend.models.resonance_dungeon import DungeonInstance


class ArchetypeStrategy(ABC):
    """Base strategy defining the archetype mechanic interface.

    Core methods (abstract — every archetype MUST implement):
        init_state       — initial archetype_state dict for new runs
        apply_drain      — resource drain on room entry, returns banter trigger
        apply_restore    — resource restore on victory/rest/treasure/scout
        apply_encounter_effects — archetype delta from encounter choice effects

    Optional hooks (default no-ops — override only if needed):
        get_ambient_stress_multiplier — modify ambient stress (default: 1.0)
        on_combat_round               — per-round archetype effects
        on_failed_check               — archetype penalty on failed skill check
    """

    def __init__(self, config: dict) -> None:
        self.config = config
        self.mechanic_config: dict = config.get("mechanic_config", {})

    @abstractmethod
    def init_state(self) -> dict:
        """Return initial archetype_state dict for a new dungeon run."""

    @abstractmethod
    def apply_drain(self, instance: DungeonInstance) -> str | None:
        """Apply archetype resource drain on room entry.

        Returns a banter trigger override (e.g. 'visibility_zero',
        'stability_collapse', 'stability_critical') or None.
        """

    @abstractmethod
    def apply_restore(self, instance: DungeonInstance, event: str) -> None:
        """Apply archetype resource restore.

        Events: 'combat_victory', 'rest', 'treasure', 'scout'.
        """

    @abstractmethod
    def apply_encounter_effects(self, instance: DungeonInstance, effects: dict) -> None:
        """Apply archetype state changes from encounter choice effects dict."""

    def get_ambient_stress_multiplier(self, instance: DungeonInstance) -> float:
        """Optional: return ambient stress multiplier. Default: 1.0 (no change)."""
        return 1.0

    def on_combat_round(self, instance: DungeonInstance) -> None:
        """Optional hook: called after each combat round resolution.

        Default: no-op. Override in subclasses that have per-round mechanics
        (e.g. Tower stability drain per combat round).
        """
        return None

    def on_failed_check(self, instance: DungeonInstance) -> None:
        """Optional hook: called when a skill check fails in an encounter.

        Default: no-op. Override in subclasses that penalize failed checks
        (e.g. Tower stability drain on failed skill check).
        """
        return None


# ── Shadow Strategy ────────────────────────────────────────────────────────

class ShadowStrategy(ArchetypeStrategy):
    """The Shadow: Visibility mechanic (3 VP, drain every 2 rooms)."""

    def init_state(self) -> dict:
        return {
            "visibility": self.mechanic_config["start_visibility"],
            "max_visibility": self.mechanic_config["max_visibility"],
            "rooms_since_vp_loss": 0,
        }

    def apply_drain(self, instance: DungeonInstance) -> str | None:
        state = instance.archetype_state
        rooms_since = state.get("rooms_since_vp_loss", 0) + 1
        cost_per_rooms = self.mechanic_config.get("cost_per_rooms", 2)
        if rooms_since >= cost_per_rooms:
            state["visibility"] = max(0, state.get("visibility", 3) - 1)
            state["rooms_since_vp_loss"] = 0
        else:
            state["rooms_since_vp_loss"] = rooms_since
        if state.get("visibility", 3) == 0:
            return "visibility_zero"
        return None

    def apply_restore(self, instance: DungeonInstance, event: str) -> None:
        restore_key = {
            "combat_victory": "restore_on_combat_win",
            "rest": "restore_on_rest",
            "treasure": "restore_on_treasure",
            "scout": "restore_on_spy_observe",
        }.get(event)
        if restore_key and self.mechanic_config.get(restore_key):
            instance.archetype_state["visibility"] = min(
                self.mechanic_config["max_visibility"],
                instance.archetype_state.get("visibility", 0) + self.mechanic_config[restore_key],
            )

    def apply_encounter_effects(self, instance: DungeonInstance, effects: dict) -> None:
        vp_delta = effects.get("visibility", 0)
        if vp_delta:
            instance.archetype_state["visibility"] = max(
                0,
                min(
                    self.mechanic_config["max_visibility"],
                    instance.archetype_state.get("visibility", 0) + vp_delta,
                ),
            )


# ── Tower Strategy ─────────────────────────────────────────────────────────

class TowerStrategy(ArchetypeStrategy):
    """The Tower: Stability countdown mechanic (100→0, depth-based drain)."""

    def init_state(self) -> dict:
        return {
            "stability": self.mechanic_config["start_stability"],
            "max_stability": self.mechanic_config["max_stability"],
        }

    def apply_drain(self, instance: DungeonInstance) -> str | None:
        self._apply_room_entry_drain(instance)
        stability = instance.archetype_state.get("stability", 100)
        if stability <= 0:
            return "stability_collapse"
        if stability <= self.mechanic_config.get("critical_threshold", 20):
            return "stability_critical"
        return None

    def apply_restore(self, instance: DungeonInstance, event: str) -> None:
        restore_key = {
            "combat_victory": "restore_on_combat_win",
            "rest": "restore_on_guardian_rest",
            "treasure": "restore_on_treasure",
        }.get(event)
        if restore_key and self.mechanic_config.get(restore_key):
            instance.archetype_state["stability"] = min(
                self.mechanic_config["max_stability"],
                instance.archetype_state.get("stability", 0) + self.mechanic_config[restore_key],
            )

    def apply_encounter_effects(self, instance: DungeonInstance, effects: dict) -> None:
        stab_delta = effects.get("stability", 0)
        if stab_delta:
            instance.archetype_state["stability"] = max(
                0,
                min(
                    self.mechanic_config["max_stability"],
                    instance.archetype_state.get("stability", 0) + stab_delta,
                ),
            )

    def get_ambient_stress_multiplier(self, instance: DungeonInstance) -> float:
        if instance.archetype_state.get("stability", 100) <= 0:
            return self.mechanic_config.get("collapse_stress_multiplier", 2.0)
        return 1.0

    def on_combat_round(self, instance: DungeonInstance) -> None:
        instance.archetype_state["stability"] = max(
            0,
            instance.archetype_state.get("stability", 100)
            - self.mechanic_config["drain_per_combat_round"],
        )

    def on_failed_check(self, instance: DungeonInstance) -> None:
        instance.archetype_state["stability"] = max(
            0,
            instance.archetype_state.get("stability", 100)
            - self.mechanic_config["drain_on_failed_check"],
        )

    def _apply_room_entry_drain(self, instance: DungeonInstance) -> None:
        """Stability drain per room entry: -5/-10/-15 by depth tier."""
        depth = instance.depth
        if depth <= 2:
            drain = self.mechanic_config["drain_depth_1_2"]
        elif depth <= 4:
            drain = self.mechanic_config["drain_depth_3_4"]
        else:
            drain = self.mechanic_config["drain_depth_5_plus"]
        instance.archetype_state["stability"] = max(
            0, instance.archetype_state.get("stability", 100) - drain,
        )


# ── Strategy Registry ──────────────────────────────────────────────────────
# Singleton instances, keyed by archetype name. Lookup is O(1).

_ARCHETYPE_STRATEGIES: dict[str, ArchetypeStrategy] = {
    "The Shadow": ShadowStrategy(ARCHETYPE_CONFIGS["The Shadow"]),
    "The Tower": TowerStrategy(ARCHETYPE_CONFIGS["The Tower"]),
}


def get_archetype_strategy(archetype: str) -> ArchetypeStrategy:
    """Look up the strategy for an archetype name.

    Raises ValueError if the archetype has no registered strategy
    (i.e. it's stubbed but not yet implemented).
    """
    strategy = _ARCHETYPE_STRATEGIES.get(archetype)
    if not strategy:
        raise ValueError(f"No strategy registered for archetype: {archetype!r}")
    return strategy
