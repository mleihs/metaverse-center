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

import logging
import random
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from backend.services.combat.condition_tracks import can_act
from backend.services.combat.stress_system import apply_stress
from backend.services.dungeon.dungeon_archetypes import ARCHETYPE_CONFIGS
from backend.services.dungeon.dungeon_loot import roll_debris

logger = logging.getLogger(__name__)

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

    def on_enemy_hit(self, instance: DungeonInstance) -> None:
        """Optional hook: called when an enemy lands a hit on an agent.

        Default: no-op. Override for contagion-style mechanics
        (e.g. Entropy contagious decay per enemy hit).
        """
        return None

    def apply_threshold_memory_toll(self, instance: DungeonInstance) -> None:
        """Apply the Memory Toll — silently remove a positive archetype modifier.

        Called when the player chooses the Memory Toll at the Threshold room.
        The player is told "something was taken" but NOT what.

        Default: apply +40 stress to all agents (generic cost when archetype
        has no specific modifier to remove). Override in subclasses to remove
        archetype-specific benefits (visibility, stability, insight, etc.).
        """
        for agent in instance.party:
            if can_act(agent.condition):
                agent.stress, _ = apply_stress(agent.stress, 40)

    def get_boss_deployment_choices(self, instance: DungeonInstance) -> list[dict] | None:
        """Generate dynamic pre-combat deployment choices for boss room.

        Called when entering a boss room. If non-empty, the engine shows an
        encounter phase with these choices before starting combat.
        Default: ``None`` (no pre-combat deployment — normal boss combat).

        Returns a list of dicts compatible with ``_format_encounter_choices``
        or ``None`` to skip deployment entirely.
        """
        return None

    def modify_enemy_templates(
        self, instance: DungeonInstance, templates: dict[str, dict],
    ) -> dict[str, dict]:
        """Modify enemy template dicts before combat resolution.

        Called after ``get_enemy_templates_dict()`` which returns fresh
        ``model_dump()`` copies — safe to mutate in place.
        Default: no-op (return unchanged).
        """
        return templates

    def on_room_reentry(self, instance: DungeonInstance, room_index: int) -> bool:
        """Optional hook: called when the party enters an already-cleared room.

        Return ``True`` to morph the room (re-roll encounter, un-clear).
        Default: ``False`` (cleared rooms stay cleared).
        """
        return False


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

    def apply_threshold_memory_toll(self, instance: DungeonInstance) -> None:
        """Memory Toll: reduce max visibility by 1."""
        state = instance.archetype_state
        state["max_visibility"] = max(1, state.get("max_visibility", 3) - 1)
        if state.get("visibility", 0) > state["max_visibility"]:
            state["visibility"] = state["max_visibility"]


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

    def apply_threshold_memory_toll(self, instance: DungeonInstance) -> None:
        """Memory Toll: reduce max stability by 15."""
        state = instance.archetype_state
        state["max_stability"] = max(10, state.get("max_stability", 100) - 15)
        if state.get("stability", 0) > state["max_stability"]:
            state["stability"] = state["max_stability"]

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


# ── Entropy Strategy ──────────────────────────────────────────────────────

class EntropyStrategy(ArchetypeStrategy):
    """The Entropy: Decay accumulation mechanic (0→100, room-entry + contagion).

    Inverts Shadow/Tower drain-down pattern: decay counts UP. The threat
    is not losing a resource — it is gaining dissolution. Contact with
    decaying entities accelerates party decay (contagious mechanic).
    """

    def init_state(self) -> dict:
        return {
            "decay": self.mechanic_config["start_decay"],
            "max_decay": self.mechanic_config["max_decay"],
        }

    def apply_drain(self, instance: DungeonInstance) -> str | None:
        """Accumulate decay on room entry (opposite direction to Shadow/Tower)."""
        self._apply_room_entry_gain(instance)
        decay = instance.archetype_state.get("decay", 0)
        if decay >= self.mechanic_config["dissolution_threshold"]:
            return "dissolution"
        if decay >= self.mechanic_config["critical_threshold"]:
            return "decay_critical"
        if decay >= self.mechanic_config["degraded_threshold"]:
            return "decay_degraded"
        return None

    def apply_restore(self, instance: DungeonInstance, event: str) -> None:
        reduce_key = {
            "combat_victory": "reduce_on_combat_win",
            "rest": "reduce_on_rest",
            "treasure": "reduce_on_treasure",
        }.get(event)
        if reduce_key and self.mechanic_config.get(reduce_key):
            instance.archetype_state["decay"] = max(
                0,
                instance.archetype_state.get("decay", 0)
                - self.mechanic_config[reduce_key],
            )

    def apply_encounter_effects(self, instance: DungeonInstance, effects: dict) -> None:
        decay_delta = effects.get("decay", 0)
        if decay_delta:
            instance.archetype_state["decay"] = max(
                0,
                min(
                    self.mechanic_config["max_decay"],
                    instance.archetype_state.get("decay", 0) + decay_delta,
                ),
            )

    def apply_threshold_memory_toll(self, instance: DungeonInstance) -> None:
        """Memory Toll: increase decay by 15."""
        state = instance.archetype_state
        state["decay"] = min(
            state.get("max_decay", 100),
            state.get("decay", 0) + 15,
        )

    def get_ambient_stress_multiplier(self, instance: DungeonInstance) -> float:
        decay = instance.archetype_state.get("decay", 0)
        if decay >= self.mechanic_config["dissolution_threshold"]:
            return self.mechanic_config.get("dissolution_stress_multiplier", 2.0)
        if decay >= 85:
            return self.mechanic_config.get("stress_multiplier_85", 1.50)
        if decay >= self.mechanic_config["critical_threshold"]:
            return self.mechanic_config.get("stress_multiplier_70", 1.25)
        return 1.0

    def on_combat_round(self, instance: DungeonInstance) -> None:
        instance.archetype_state["decay"] = min(
            self.mechanic_config["max_decay"],
            instance.archetype_state.get("decay", 0)
            + self.mechanic_config["gain_per_combat_round"],
        )

    def on_failed_check(self, instance: DungeonInstance) -> None:
        instance.archetype_state["decay"] = min(
            self.mechanic_config["max_decay"],
            instance.archetype_state.get("decay", 0)
            + self.mechanic_config["gain_on_failed_check"],
        )

    def on_enemy_hit(self, instance: DungeonInstance) -> None:
        """Contagious decay: each enemy hit on an agent accelerates party decay."""
        instance.archetype_state["decay"] = min(
            self.mechanic_config["max_decay"],
            instance.archetype_state.get("decay", 0)
            + self.mechanic_config["gain_per_enemy_hit"],
        )

    def _apply_room_entry_gain(self, instance: DungeonInstance) -> None:
        """Decay gain per room entry: +4/+7/+10 by depth tier."""
        depth = instance.depth
        if depth <= 2:
            gain = self.mechanic_config["gain_depth_1_2"]
        elif depth <= 4:
            gain = self.mechanic_config["gain_depth_3_4"]
        else:
            gain = self.mechanic_config["gain_depth_5_plus"]
        instance.archetype_state["decay"] = min(
            self.mechanic_config["max_decay"],
            instance.archetype_state.get("decay", 0) + gain,
        )


# ── Devouring Mother Strategy ────────────────────────────────────────────

class DevouringMotherStrategy(ArchetypeStrategy):
    """The Devouring Mother: Parasitic attachment (0→100) + passive healing.

    Inverts every other archetype: the threat IS the benefit. Attachment
    rises as the party ACCEPTS HELP. The dungeon heals stress, reduces
    ambient pressure, improves rest — and each gift deepens the bond.
    At 100 attachment the party is incorporated (wipe equivalent).

    Unique hooks:
        _apply_passive_heal — free stress heal on room entry (the trap)
        on_enemy_hit        — contagious attachment per enemy hit
    """

    def init_state(self) -> dict:
        return {
            "attachment": self.mechanic_config["start_attachment"],
            "max_attachment": self.mechanic_config["max_attachment"],
        }

    def apply_drain(self, instance: DungeonInstance) -> str | None:
        """Accumulate attachment + apply passive heal on room entry."""
        self._apply_room_entry_gain(instance)
        self._apply_passive_heal(instance)
        attachment = instance.archetype_state.get("attachment", 0)
        if attachment >= self.mechanic_config["incorporation_threshold"]:
            return "incorporation"
        if attachment >= self.mechanic_config["critical_threshold"]:
            return "attachment_critical"
        if attachment >= self.mechanic_config["dependent_threshold"]:
            return "attachment_dependent"
        return None

    def apply_restore(self, instance: DungeonInstance, event: str) -> None:
        """INVERTED: 'restore' events INCREASE attachment.

        Combat victories and rest heal the party but deepen the bond.
        Only Guardian Sever reduces attachment.
        """
        if event == "combat_victory":
            instance.archetype_state["attachment"] = min(
                self.mechanic_config["max_attachment"],
                instance.archetype_state.get("attachment", 0)
                + self.mechanic_config["gain_on_combat_win"],
            )
        elif event == "rest":
            instance.archetype_state["attachment"] = min(
                self.mechanic_config["max_attachment"],
                instance.archetype_state.get("attachment", 0)
                + self.mechanic_config["rest_attachment_gain"],
            )

    def apply_encounter_effects(self, instance: DungeonInstance, effects: dict) -> None:
        attachment_delta = effects.get("attachment", 0)
        if attachment_delta:
            instance.archetype_state["attachment"] = max(
                0,
                min(
                    self.mechanic_config["max_attachment"],
                    instance.archetype_state.get("attachment", 0) + attachment_delta,
                ),
            )

    def get_ambient_stress_multiplier(self, instance: DungeonInstance) -> float:
        """INVERTED: high attachment REDUCES stress (the Mother soothes)."""
        attachment = instance.archetype_state.get("attachment", 0)
        if attachment >= 100:
            return self.mechanic_config.get("incorporation_stress_multiplier", 0.0)
        if attachment >= 90:
            return self.mechanic_config.get("stress_multiplier_90", 0.65)
        if attachment >= 75:
            return self.mechanic_config.get("stress_multiplier_75", 0.80)
        return 1.0

    def on_combat_round(self, instance: DungeonInstance) -> None:
        instance.archetype_state["attachment"] = min(
            self.mechanic_config["max_attachment"],
            instance.archetype_state.get("attachment", 0)
            + self.mechanic_config["gain_per_combat_round"],
        )

    def on_failed_check(self, instance: DungeonInstance) -> None:
        instance.archetype_state["attachment"] = min(
            self.mechanic_config["max_attachment"],
            instance.archetype_state.get("attachment", 0)
            + self.mechanic_config["gain_on_failed_check"],
        )

    def on_enemy_hit(self, instance: DungeonInstance) -> None:
        """Contagious attachment: enemy contact deepens the parasitic bond."""
        instance.archetype_state["attachment"] = min(
            self.mechanic_config["max_attachment"],
            instance.archetype_state.get("attachment", 0)
            + self.mechanic_config.get("gain_per_enemy_hit", 3),
        )

    def _apply_room_entry_gain(self, instance: DungeonInstance) -> None:
        """Attachment gain per room entry: +3/+5/+8 by depth tier."""
        depth = instance.depth
        if depth <= 2:
            gain = self.mechanic_config["gain_depth_1_2"]
        elif depth <= 4:
            gain = self.mechanic_config["gain_depth_3_4"]
        else:
            gain = self.mechanic_config["gain_depth_5_plus"]
        instance.archetype_state["attachment"] = min(
            self.mechanic_config["max_attachment"],
            instance.archetype_state.get("attachment", 0) + gain,
        )

    def _apply_passive_heal(self, instance: DungeonInstance) -> None:
        """The Mother provides: free stress heal on room entry.

        This is the core trap — the party receives genuine healing
        as a side effect of attachment accumulation. The heal amount
        increases at depth 5+ (the deeper, the more generous).
        """
        if instance.depth >= 5:
            heal = self.mechanic_config["heal_stress_per_room_deep"]
        else:
            heal = self.mechanic_config["heal_stress_per_room"]
        for agent in instance.party:
            if can_act(agent.condition):
                agent.stress = max(0, agent.stress - heal)


# ── Prometheus Strategy ───────────────────────────────────────────────────

class PrometheusStrategy(ArchetypeStrategy):
    """The Prometheus: Crafting insight mechanic (0→100, pharmakon accumulation).

    Insight is BOTH resource and threat — the pharmakon principle made
    mechanical. High insight enables powerful crafting (encounter-based
    combination system) but amplifies ambient stress. The party WANTS
    high insight for crafting power and FEARS it for survival.

    Unique to Prometheus:
        - archetype_state carries ``components`` (list) and ``crafted_items`` (list)
          alongside the primary ``insight`` gauge
        - ``apply_encounter_effects()`` handles custom keys: ``insight``,
          ``add_component``, ``remove_components``, ``add_crafted_item``
        - Enemy hits and combat rounds DRAIN insight (disruption),
          inverting Entropy's contagion-accumulation pattern
    """

    def init_state(self) -> dict:
        return {
            "insight": self.mechanic_config["start_insight"],
            "max_insight": self.mechanic_config["max_insight"],
            "components": [],
            "crafted_items": [],
            "total_crafted": 0,
            "failed_crafts": 0,
        }

    def apply_drain(self, instance: DungeonInstance) -> str | None:
        """Accumulate insight on room entry — the workshop reveals itself.

        Insight rises with depth (Bachelard's fire spreads). Returns
        banter trigger at threshold crossings for procedural narration.
        """
        prev_insight = instance.archetype_state.get("insight", 0)
        self._apply_room_entry_gain(instance)
        insight = instance.archetype_state.get("insight", 0)

        # Trigger only on CROSSING a threshold, not every room at that level
        if insight >= self.mechanic_config["breakthrough_threshold"]:
            if prev_insight < self.mechanic_config["breakthrough_threshold"]:
                return "insight_breakthrough"
            return None
        if insight >= self.mechanic_config["feverish_threshold"]:
            if prev_insight < self.mechanic_config["feverish_threshold"]:
                return "insight_feverish"
            return None
        if insight >= self.mechanic_config["inspired_threshold"]:
            if prev_insight < self.mechanic_config["inspired_threshold"]:
                return "insight_inspired"
            return None
        if insight < self.mechanic_config["cold_forge_threshold"]:
            return "insight_cold"
        return None

    def apply_restore(self, instance: DungeonInstance, event: str) -> None:
        """Insight changes on restore events.

        combat_victory / treasure / scout → gain insight (studying, discovering)
        rest → REDUCE insight (the fire cools — Jünger's elegiac register)
        """
        if event == "rest":
            # Rest deliberately reduces insight: the forge cools, the party
            # breathes. This creates meaningful rest-room decisions — rest
            # heals stress but costs crafting potential.
            instance.archetype_state["insight"] = max(
                0,
                instance.archetype_state.get("insight", 0)
                - self.mechanic_config["reduce_on_rest"],
            )
            return

        gain_key = {
            "combat_victory": "gain_on_combat_win",
            "treasure": "gain_on_treasure",
        }.get(event)
        if gain_key and self.mechanic_config.get(gain_key):
            instance.archetype_state["insight"] = min(
                self.mechanic_config["max_insight"],
                instance.archetype_state.get("insight", 0)
                + self.mechanic_config[gain_key],
            )

    def apply_encounter_effects(self, instance: DungeonInstance, effects: dict) -> None:
        """Apply encounter choice effects including Prometheus-specific keys.

        Standard key:
            ``insight`` (int) — direct delta to insight gauge

        Crafting keys (set by workshop encounter choices):
            ``add_component`` (dict)      — component to add to inventory
            ``remove_components`` (list)   — component IDs consumed by crafting
            ``add_crafted_item`` (dict)    — crafted item to add to inventory
            ``craft_failed`` (bool)        — increment failed_crafts counter
        """
        state = instance.archetype_state
        max_insight = self.mechanic_config["max_insight"]

        # ── Insight delta ──
        insight_delta = effects.get("insight", 0)
        if insight_delta:
            state["insight"] = max(
                0, min(max_insight, state.get("insight", 0) + insight_delta),
            )

        # ── Component acquisition ──
        component = effects.get("add_component")
        if component and isinstance(component, dict):
            components = state.get("components", [])
            max_comp = self.mechanic_config.get("max_components", 8)
            if len(components) < max_comp:
                components.append(component)
                state["components"] = components

        # ── Component consumption (crafting) ──
        remove_ids = effects.get("remove_components")
        if remove_ids and isinstance(remove_ids, list):
            components = state.get("components", [])
            state["components"] = [
                c for c in components if c.get("id") not in remove_ids
            ]

        # ── Crafted item creation ──
        crafted_item = effects.get("add_crafted_item")
        if crafted_item and isinstance(crafted_item, dict):
            crafted = state.get("crafted_items", [])
            max_crafted = self.mechanic_config.get("max_crafted_items", 6)
            if len(crafted) < max_crafted:
                crafted.append(crafted_item)
                state["crafted_items"] = crafted
            state["total_crafted"] = state.get("total_crafted", 0) + 1
            # Creative momentum: successful craft boosts insight
            state["insight"] = min(
                max_insight,
                state.get("insight", 0)
                + self.mechanic_config.get("gain_on_craft_success", 8),
            )

        # ── Failed craft tracking ──
        if effects.get("craft_failed"):
            state["failed_crafts"] = state.get("failed_crafts", 0) + 1
            # Lem: "the residue is interesting" — failed crafts still teach
            state["insight"] = min(
                max_insight,
                state.get("insight", 0)
                + self.mechanic_config.get("gain_on_craft_fail", 4),
            )

    def apply_threshold_memory_toll(self, instance: DungeonInstance) -> None:
        """Memory Toll: remove one random component from inventory."""
        components = instance.archetype_state.get("components")
        if components:
            components.pop(random.randrange(len(components)))

    def get_ambient_stress_multiplier(self, instance: DungeonInstance) -> float:
        """The pharmakon: high insight amplifies stress (the fire burns).

        Thresholds mirror Entropy's scaling but represent a fundamentally
        different tension — the party CHOSE to push insight high for
        crafting power, knowing the stress cost.
        """
        insight = instance.archetype_state.get("insight", 0)
        if insight >= self.mechanic_config["breakthrough_threshold"]:
            return self.mechanic_config.get("breakthrough_stress_multiplier", 2.0)
        if insight >= 90:
            return self.mechanic_config.get("stress_multiplier_90", 1.50)
        if insight >= self.mechanic_config["feverish_threshold"]:
            return self.mechanic_config.get("stress_multiplier_75", 1.25)
        return 1.0

    def on_combat_round(self, instance: DungeonInstance) -> None:
        """Combat disrupts creative focus — insight drains per round.

        Inverts Entropy's per-round accumulation. In Prometheus, combat
        is COSTLY because it disrupts the forge-trance (Bachelard).
        """
        instance.archetype_state["insight"] = max(
            0,
            instance.archetype_state.get("insight", 0)
            - self.mechanic_config["drain_per_combat_round"],
        )

    def on_failed_check(self, instance: DungeonInstance) -> None:
        """Confusion breaks the creative flow — insight drains on failed checks."""
        instance.archetype_state["insight"] = max(
            0,
            instance.archetype_state.get("insight", 0)
            - self.mechanic_config["drain_on_failed_check"],
        )

    def on_enemy_hit(self, instance: DungeonInstance) -> None:
        """Physical disruption scatters creative focus — insight drains per hit.

        Inverts Entropy's contagion-accumulation: enemy contact DISRUPTS
        rather than spreading. Guardian protection becomes critical for
        maintaining crafting momentum.
        """
        instance.archetype_state["insight"] = max(
            0,
            instance.archetype_state.get("insight", 0)
            - self.mechanic_config["drain_per_enemy_hit"],
        )

    def get_boss_deployment_choices(self, instance: DungeonInstance) -> list[dict] | None:
        """Generate pre-combat deployment choices from crafted items inventory.

        Each crafted item with a ``boss_effect`` becomes a deployment choice.
        Items are NOT consumed — they can be re-deployed with diminishing
        returns (spec §3.6: "using the same crafted item twice has
        diminishing returns").

        Returns ``None`` if no crafted items available (skip deployment,
        proceed directly to combat).
        """
        crafted_items = instance.archetype_state.get("crafted_items", [])
        if not crafted_items:
            return None

        boss_debuffs: list[dict] = instance.archetype_state.get("_boss_debuffs", [])
        choices: list[dict] = []

        for item in crafted_items:
            if not item.get("boss_effect"):
                continue
            item_id = item["id"]
            deploy_count = sum(1 for d in boss_debuffs if d["item_id"] == item_id)
            # Diminishing returns label
            suffix_en = ""
            suffix_de = ""
            if deploy_count > 0:
                effectiveness = int(100 * (0.5 ** deploy_count))
                suffix_en = f" [{effectiveness}% effectiveness]"
                suffix_de = f" [{effectiveness}% Wirksamkeit]"

            choices.append({
                "id": f"deploy_{item_id}",
                "label_en": f"Deploy: {item['name_en']}{suffix_en}",
                "label_de": f"Einsetzen: {item['name_de']}{suffix_de}",
                "requires_aptitude": None,
                "check_aptitude": None,
                "check_difficulty": 0,
            })

        if not choices:
            return None

        choices.append({
            "id": "begin_combat",
            "label_en": "Enough preparation. Engage The Prototype.",
            "label_de": "Genug Vorbereitung. Den Prototypen angreifen.",
            "requires_aptitude": None,
            "check_aptitude": None,
            "check_difficulty": 0,
        })
        return choices

    def modify_enemy_templates(
        self, instance: DungeonInstance, templates: dict[str, dict],
    ) -> dict[str, dict]:
        """Apply boss debuffs from pre-combat crafted item deployment.

        Effective values are pre-computed at deploy time with diminishing
        returns: ``base_value * 0.5^(n-1)`` where *n* is the deploy count
        for that item.
        """
        boss_debuffs: list[dict] = instance.archetype_state.get("_boss_debuffs", [])
        if not boss_debuffs:
            return templates

        boss_key = "prometheus_the_prototype"
        if boss_key not in templates:
            return templates

        boss = templates[boss_key]
        for debuff in boss_debuffs:
            eff_val = debuff["effective_value"]
            match debuff["effect_type"]:
                case "add_vulnerability":
                    school = debuff.get("school")
                    if school:
                        vulns: list[str] = boss.get("vulnerabilities", [])
                        if school not in vulns:
                            vulns.append(school)
                        boss["vulnerabilities"] = vulns
                case "reduce_evasion":
                    boss["evasion"] = max(0, boss.get("evasion", 0) - int(eff_val))
                case "reduce_attack_power":
                    boss["attack_power"] = max(1, boss.get("attack_power", 3) - int(eff_val))
                case "reduce_stress_attack":
                    boss["stress_attack_power"] = max(
                        1, boss.get("stress_attack_power", 3) - int(eff_val),
                    )
        return templates

    def _apply_room_entry_gain(self, instance: DungeonInstance) -> None:
        """Insight gain per room entry: +4/+7/+10 by depth tier.

        The workshop reveals itself progressively (Schulz: matter sends
        'dull shivers' through itself, attempting forms on its own).
        """
        depth = instance.depth
        if depth <= 2:
            gain = self.mechanic_config["gain_depth_1_2"]
        elif depth <= 4:
            gain = self.mechanic_config["gain_depth_3_4"]
        else:
            gain = self.mechanic_config["gain_depth_5_plus"]
        instance.archetype_state["insight"] = min(
            self.mechanic_config["max_insight"],
            instance.archetype_state.get("insight", 0) + gain,
        )


# ── Deluge Strategy ───────────────────────────────────────────────────────


class DelugeStrategy(ArchetypeStrategy):
    """The Deluge: Rising water mechanic (0→100, tidal pulse, inverted dungeon).

    Water rises on room entry (depth-scaled), surges in combat, partially
    recedes every 3rd room (tidal rhythm). Unlike monotonic archetypes,
    the Deluge oscillates — creating strategic exploration windows.
    At water_level 100: submersion (wipe).

    Unique hooks:
        on_combat_round  — water rises during combat (urgency)
        on_failed_check  — breach: failed checks accelerate flooding
        on_enemy_hit     — structural disruption per hit
        get_boss_deployment_choices — barrier construction before The Current
    """

    def init_state(self) -> dict:
        return {
            "water_level": self.mechanic_config["start_water_level"],
            "max_water_level": self.mechanic_config["max_water_level"],
            "rooms_entered": 0,
            "recession_cycle": 0,
        }

    def apply_drain(self, instance: DungeonInstance) -> str | None:
        """Water rises on room entry. Tidal recession every Nth room.

        CRITICAL: recession check happens BEFORE surge (design doc §11.4).
        Returns banter trigger on threshold crossing or tidal event.
        """
        state = instance.archetype_state
        state["rooms_entered"] = state.get("rooms_entered", 0) + 1

        # ── Tidal recession (every Nth room) ──
        interval = self.mechanic_config["recession_interval"]
        recession_triggered = False
        if state["rooms_entered"] % interval == 0:
            cycle = state.get("recession_cycle", 0)
            decay = self.mechanic_config["recession_decay_per_cycle"]
            recession = max(0, self.mechanic_config["recession_amount"] - (cycle * decay))
            if recession > 0:
                state["water_level"] = max(0, state.get("water_level", 0) - recession)
                recession_triggered = True
            state["recession_cycle"] = cycle + 1

        # ── Room entry surge (depth-scaled) ──
        self._apply_room_entry_surge(instance)

        # ── The Current Carries (debris every 2nd room) ──
        rooms = state.get("rooms_entered", 0)
        if rooms > 0 and rooms % 2 == 0:
            debris = roll_debris()
            state["_last_debris"] = debris.model_dump(mode="json")

        # ── Threshold check ──
        water = state.get("water_level", 0)
        if water >= self.mechanic_config["submerged_threshold"]:
            return "submerged"

        # Tidal recession banter takes priority over threshold banter
        if recession_triggered:
            return "tidal_recession"

        if water >= self.mechanic_config["chest_threshold"]:
            return "flood_imminent"
        if water >= self.mechanic_config["waist_threshold"]:
            return "waist_threshold"
        if water >= self.mechanic_config["ankle_threshold"]:
            return "ankle_threshold"
        return None

    def apply_restore(self, instance: DungeonInstance, event: str) -> None:
        """Reduce water on rest, seal breach, or other events."""
        reduce_key = {
            "combat_victory": "reduce_on_combat_win",
            "rest": "reduce_on_rest",
            "treasure": "reduce_on_treasure",
            "seal": "reduce_on_seal_action",
        }.get(event)
        if reduce_key and self.mechanic_config.get(reduce_key):
            instance.archetype_state["water_level"] = max(
                0,
                instance.archetype_state.get("water_level", 0)
                - self.mechanic_config[reduce_key],
            )

    def apply_encounter_effects(self, instance: DungeonInstance, effects: dict) -> None:
        """Apply water_level delta from encounter choices."""
        water_delta = effects.get("water_level", 0)
        if water_delta:
            instance.archetype_state["water_level"] = max(
                0,
                min(
                    self.mechanic_config["max_water_level"],
                    instance.archetype_state.get("water_level", 0) + water_delta,
                ),
            )

    def apply_threshold_memory_toll(self, instance: DungeonInstance) -> None:
        """Memory Toll: increase water level by 15."""
        state = instance.archetype_state
        state["water_level"] = min(
            state.get("max_water_level", 100),
            state.get("water_level", 0) + 15,
        )

    def get_ambient_stress_multiplier(self, instance: DungeonInstance) -> float:
        """Stress scales with water depth: 1.15x at waist, 1.40x at chest, 2.0x submerged."""
        water = instance.archetype_state.get("water_level", 0)
        if water >= self.mechanic_config["submerged_threshold"]:
            return self.mechanic_config.get("submerged_stress_multiplier", 2.0)
        if water >= self.mechanic_config["chest_threshold"]:
            return self.mechanic_config.get("stress_multiplier_75", 1.40)
        if water >= self.mechanic_config["waist_threshold"]:
            return self.mechanic_config.get("stress_multiplier_50", 1.15)
        return 1.0

    def on_combat_round(self, instance: DungeonInstance) -> None:
        """Water rises each combat round — delay means drowning."""
        instance.archetype_state["water_level"] = min(
            self.mechanic_config["max_water_level"],
            instance.archetype_state.get("water_level", 0)
            + self.mechanic_config["surge_per_combat_round"],
        )

    def on_failed_check(self, instance: DungeonInstance) -> None:
        """Breach: failed skill checks accelerate flooding."""
        instance.archetype_state["water_level"] = min(
            self.mechanic_config["max_water_level"],
            instance.archetype_state.get("water_level", 0)
            + self.mechanic_config["surge_on_failed_check"],
        )

    def on_enemy_hit(self, instance: DungeonInstance) -> None:
        """Physical disruption of seals — each hit raises water."""
        instance.archetype_state["water_level"] = min(
            self.mechanic_config["max_water_level"],
            instance.archetype_state.get("water_level", 0)
            + self.mechanic_config["surge_per_enemy_hit"],
        )

    def get_boss_deployment_choices(self, instance: DungeonInstance) -> list[dict] | None:
        """3 strategic deployment choices before The Current boss fight.

        Unlike Prometheus (inventory-based), Deluge offers fixed barrier
        construction options with aptitude checks (design doc §2.7).
        """
        return [
            {
                "id": "construct_barrier",
                "label_en": "Construct a barrier against the current (Saboteur)",
                "label_de": "Eine Barriere gegen die Strömung errichten (Saboteur)",
                "requires_aptitude": None,
                "check_aptitude": "saboteur",
                "check_difficulty": 0,
                "effects_success": {"buff": "barricade", "duration": 3},
                "effects_partial": {"buff": "fragile_barricade", "duration": 2},
                "effects_fail": {"water_level": 15},
            },
            {
                "id": "read_the_current",
                "label_en": "Study the current's pattern (Spy)",
                "label_de": "Das Muster der Strömung studieren (Spion)",
                "requires_aptitude": None,
                "check_aptitude": "spy",
                "check_difficulty": 0,
                "effects_success": {"reveal_intent": 2},
                "effects_partial": {"reveal_intent": 1},
                "effects_fail": {"stress": 10},
            },
            {
                "id": "brace_for_impact",
                "label_en": "Brace the party for what comes (Guardian)",
                "label_de": "Die Gruppe auf das Kommende vorbereiten (Wächter)",
                "requires_aptitude": None,
                "check_aptitude": "guardian",
                "check_difficulty": 0,
                "effects_success": {"condition_bonus": 1, "targets": "all"},
                "effects_partial": {"condition_bonus": 1, "targets": 2},
                "effects_fail": {"stress": 20},
            },
            {
                "id": "begin_combat",
                "label_en": "Enough preparation. Face The Current.",
                "label_de": "Genug Vorbereitung. Der Strömung entgegentreten.",
                "requires_aptitude": None,
                "check_aptitude": None,
                "check_difficulty": 0,
            },
        ]

    def _apply_room_entry_surge(self, instance: DungeonInstance) -> None:
        """Depth-scaled water surge on room entry."""
        depth = instance.depth
        if depth <= 2:
            surge = self.mechanic_config["surge_depth_1_2"]
        elif depth <= 4:
            surge = self.mechanic_config["surge_depth_3_4"]
        else:
            surge = self.mechanic_config["surge_depth_5_plus"]
        instance.archetype_state["water_level"] = min(
            self.mechanic_config["max_water_level"],
            instance.archetype_state.get("water_level", 0) + surge,
        )


# ── The Awakening ─────────────────────────────────────────────────────────


class AwakeningStrategy(ArchetypeStrategy):
    """The Awakening: Awareness gauge (0→100, lucid vertigo, consciousness drift).

    Awareness rises on room entry (depth-scaled), in combat, on failed checks,
    and on enemy hits. High awareness grants perception but destabilizes
    identity — the Orpheus mechanic. At awareness 100: ego dissolution (wipe).

    Unique hooks:
        on_combat_round  — awareness rises in combat (consciousness expands)
        on_failed_check  — failed introspection accelerates awakening
        on_enemy_hit     — consciousness intrusion per hit
        get_boss_deployment_choices — introspection before The Repressed
    """

    def init_state(self) -> dict:
        return {
            "awareness": self.mechanic_config["start_awareness"],
            "max_awareness": self.mechanic_config["max_awareness"],
            "rooms_entered": 0,
        }

    def apply_drain(self, instance: DungeonInstance) -> str | None:
        """Awareness rises on room entry. Depth-scaled like all gauges.

        Returns banter trigger on threshold crossing.
        Awareness is Orpheus's backward glance: the more you know,
        the more the memories distort.
        """
        state = instance.archetype_state
        state["rooms_entered"] = state.get("rooms_entered", 0) + 1

        # ── Room entry awareness gain (depth-scaled) ──
        self._apply_room_entry_gain(instance)

        # ── Threshold check ──
        awareness = state.get("awareness", 0)
        if awareness >= self.mechanic_config["awakened_threshold"]:
            return "awakened"
        if awareness >= self.mechanic_config["dissolution_threshold"]:
            return "dissolution"
        if awareness >= self.mechanic_config["lucid_threshold"]:
            return "lucid"
        if awareness >= self.mechanic_config["liminal_threshold"]:
            return "liminal"
        if awareness >= self.mechanic_config["stirring_threshold"]:
            return "stirring"
        return None

    def apply_restore(self, instance: DungeonInstance, event: str) -> None:
        """Reduce awareness on rest, grounding, or other events."""
        reduce_key = {
            "combat_victory": "reduce_on_combat_win",
            "rest": "reduce_on_rest",
            "treasure": "reduce_on_treasure",
            "ground": "reduce_on_ground_action",
        }.get(event)
        if reduce_key and self.mechanic_config.get(reduce_key):
            instance.archetype_state["awareness"] = max(
                0,
                instance.archetype_state.get("awareness", 0)
                - self.mechanic_config[reduce_key],
            )

    def apply_encounter_effects(self, instance: DungeonInstance, effects: dict) -> None:
        """Apply awareness delta from encounter choices."""
        awareness_delta = effects.get("awareness", 0)
        if awareness_delta:
            instance.archetype_state["awareness"] = max(
                0,
                min(
                    self.mechanic_config["max_awareness"],
                    instance.archetype_state.get("awareness", 0) + awareness_delta,
                ),
            )

    def get_ambient_stress_multiplier(self, instance: DungeonInstance) -> float:
        """Stress scales with awareness: Funes's curse — too much consciousness hurts."""
        awareness = instance.archetype_state.get("awareness", 0)
        if awareness >= self.mechanic_config["awakened_threshold"]:
            return self.mechanic_config.get("awakened_stress_multiplier", 2.0)
        if awareness >= self.mechanic_config["dissolution_threshold"]:
            return self.mechanic_config.get("stress_multiplier_90", 1.75)
        if awareness >= self.mechanic_config["lucid_threshold"]:
            return self.mechanic_config.get("stress_multiplier_70", 1.35)
        if awareness >= self.mechanic_config["liminal_threshold"]:
            return self.mechanic_config.get("stress_multiplier_50", 1.15)
        return 1.0

    def on_combat_round(self, instance: DungeonInstance) -> None:
        """Awareness rises each combat round — consciousness expands under duress."""
        instance.archetype_state["awareness"] = min(
            self.mechanic_config["max_awareness"],
            instance.archetype_state.get("awareness", 0)
            + self.mechanic_config["gain_per_combat_round"],
        )

    def on_failed_check(self, instance: DungeonInstance) -> None:
        """Failed introspection accelerates awakening — Plato's painful expansion."""
        instance.archetype_state["awareness"] = min(
            self.mechanic_config["max_awareness"],
            instance.archetype_state.get("awareness", 0)
            + self.mechanic_config["gain_on_failed_check"],
        )

    def on_enemy_hit(self, instance: DungeonInstance) -> None:
        """Consciousness intrusion — each hit from a memory-entity raises awareness."""
        instance.archetype_state["awareness"] = min(
            self.mechanic_config["max_awareness"],
            instance.archetype_state.get("awareness", 0)
            + self.mechanic_config["gain_per_enemy_hit"],
        )

    def get_boss_deployment_choices(self, instance: DungeonInstance) -> list[dict] | None:
        """3 introspection choices before The Repressed boss fight.

        Check-based pattern (like Deluge). The party prepares to confront
        a memory so painful it was buried — Jung's encounter with the Self.
        """
        return [
            {
                "id": "confront_memory",
                "label_en": "Confront the memory directly (Guardian)",
                "label_de": "Der Erinnerung direkt entgegentreten (Wächter)",
                "requires_aptitude": None,
                "check_aptitude": "guardian",
                "check_difficulty": 0,
                "effects_success": {"condition_bonus": 1, "targets": "all"},
                "effects_partial": {"condition_bonus": 1, "targets": 2},
                "effects_fail": {"awareness": 15},
            },
            {
                "id": "analyze_repression",
                "label_en": "Analyze the structure of the repression (Spy)",
                "label_de": "Die Struktur der Verdrängung analysieren (Spion)",
                "requires_aptitude": None,
                "check_aptitude": "spy",
                "check_difficulty": 0,
                "effects_success": {"reveal_intent": 2},
                "effects_partial": {"reveal_intent": 1},
                "effects_fail": {"stress": 10},
            },
            {
                "id": "redirect_consciousness",
                "label_en": "Redirect collective awareness toward the source (Propagandist)",
                "label_de": "Das kollektive Bewusstsein zur Quelle lenken (Propagandist)",
                "requires_aptitude": None,
                "check_aptitude": "propagandist",
                "check_difficulty": 0,
                "effects_success": {"buff": "lucid_focus", "duration": 3},
                "effects_partial": {"buff": "fragile_focus", "duration": 2},
                "effects_fail": {"stress": 20},
            },
            {
                "id": "begin_combat",
                "label_en": "Enough preparation. Face The Repressed.",
                "label_de": "Genug Vorbereitung. Dem Verdrängten entgegentreten.",
                "requires_aptitude": None,
                "check_aptitude": None,
                "check_difficulty": 0,
            },
        ]

    def on_room_reentry(self, instance: DungeonInstance, room_index: int) -> bool:
        """Déjà-vu: cleared rooms morph at awareness ≥ deja_vu threshold.

        The room has changed because the party has changed. The memory is
        not replayed — it is reconstructed (Proust). Only encounter/combat
        rooms morph. Boss, rest, exit, entrance never morph.
        Each room can morph at most once per run.
        """
        awareness = instance.archetype_state.get("awareness", 0)
        deja_vu_threshold = self.mechanic_config.get("liminal_threshold", 50)
        if awareness < deja_vu_threshold:
            return False

        room = instance.rooms[room_index]
        if room.room_type not in ("combat", "encounter", "treasure"):
            return False

        # Each room morphs at most once — track in archetype_state
        morphed = instance.archetype_state.setdefault("_morphed_rooms", [])
        if room_index in morphed:
            return False

        morphed.append(room_index)
        return True

    def _apply_room_entry_gain(self, instance: DungeonInstance) -> None:
        """Depth-scaled awareness gain on room entry."""
        depth = instance.depth
        if depth <= 2:
            gain = self.mechanic_config["gain_depth_1_2"]
        elif depth <= 4:
            gain = self.mechanic_config["gain_depth_3_4"]
        else:
            gain = self.mechanic_config["gain_depth_5_plus"]
        instance.archetype_state["awareness"] = min(
            self.mechanic_config["max_awareness"],
            instance.archetype_state.get("awareness", 0) + gain,
        )


# ── The Overthrow ─────────────────────────────────────────────────────────


class OverthrowStrategy(ArchetypeStrategy):
    """The Overthrow: Faction navigation (0→100, political vertigo, authority fracture).

    Authority fracture rises on room entry (depth-scaled), in combat, on failed
    checks, and on enemy hits. High fracture accelerates political instability —
    factions betray, alliances shift, and the Pretender's grip weakens.
    At fracture 100: total collapse (power vacuum, wipe equivalent).

    Unique mechanics:
        - archetype_state carries ``faction_standings`` (dict of faction_id → int)
          alongside the primary ``fracture`` gauge
        - ``apply_encounter_effects()`` handles ``fracture`` deltas and
          ``faction_standing`` modifications from encounter choices
        - Combat rounds and enemy hits accelerate fracture (violence destabilizes)
        - Rally ability (Propagandist) reduces fracture — parallels Deluge's seal
        - Boss deployment: check-based (Debate/Expose/Withdraw + Begin Combat)
    """

    def init_state(self) -> dict:
        return {
            "fracture": self.mechanic_config["start_fracture"],
            "max_fracture": self.mechanic_config["max_fracture"],
            "faction_standings": {},
            "rooms_entered": 0,
        }

    def apply_drain(self, instance: DungeonInstance) -> str | None:
        """Accumulate authority fracture on room entry. Depth-scaled.

        Returns banter trigger on threshold crossing. Fracture counts UP —
        the emotional gradient: Court Order → Whispers → Schism → Revolution
        → New Regime → Total Fracture.
        """
        state = instance.archetype_state
        state["rooms_entered"] = state.get("rooms_entered", 0) + 1

        self._apply_room_entry_gain(instance)

        fracture = state.get("fracture", 0)
        if fracture >= self.mechanic_config["total_fracture_threshold"]:
            return "total_fracture"
        if fracture >= self.mechanic_config["new_regime_threshold"]:
            return "new_regime"
        if fracture >= self.mechanic_config["revolution_threshold"]:
            return "revolution"
        if fracture >= self.mechanic_config["schism_threshold"]:
            return "schism"
        if fracture >= self.mechanic_config["whispers_threshold"]:
            return "whispers"
        return None

    def apply_restore(self, instance: DungeonInstance, event: str) -> None:
        """Reduce fracture on rest, rally, or other events.

        Combat victory does NOT reduce fracture — violence does not
        restore order (Arendt: the end of rebellion is liberation,
        not freedom). Only the Propagandist's rally stabilizes.
        """
        reduce_key = {
            "combat_victory": "reduce_on_combat_win",
            "rest": "reduce_on_rest",
            "treasure": "reduce_on_treasure",
            "rally": "reduce_on_rally_action",
        }.get(event)
        if reduce_key and self.mechanic_config.get(reduce_key):
            instance.archetype_state["fracture"] = max(
                0,
                instance.archetype_state.get("fracture", 0)
                - self.mechanic_config[reduce_key],
            )

    def apply_encounter_effects(self, instance: DungeonInstance, effects: dict) -> None:
        """Apply encounter choice effects including Overthrow-specific keys.

        Standard key:
            ``fracture`` (int) — direct delta to authority fracture gauge

        Faction keys (set by social encounter choices):
            ``faction_standing`` (dict) — {faction_id: delta} to modify standings
            ``betrayal`` (bool)         — triggers betrayal stress (Canetti's sting)
        """
        state = instance.archetype_state
        max_fracture = self.mechanic_config["max_fracture"]

        # ── Fracture delta ──
        fracture_delta = effects.get("fracture", 0)
        if fracture_delta:
            state["fracture"] = max(
                0, min(max_fracture, state.get("fracture", 0) + fracture_delta),
            )

        # ── Faction standing modification ──
        standing_deltas = effects.get("faction_standing")
        if standing_deltas and isinstance(standing_deltas, dict):
            standings = state.get("faction_standings", {})
            max_standing = self.mechanic_config.get("max_faction_standing", 100)
            for faction_id, delta in standing_deltas.items():
                current = standings.get(faction_id, self.mechanic_config.get("start_faction_standing", 50))
                standings[faction_id] = max(0, min(max_standing, current + delta))
            state["faction_standings"] = standings

        # ── Betrayal: Canetti's sting of command ──
        if effects.get("betrayal"):
            cost = self.mechanic_config.get("betrayal_stress_cost", 20)
            for agent in instance.party:
                if can_act(agent.condition):
                    agent.stress, _ = apply_stress(agent.stress, cost)

    def apply_threshold_memory_toll(self, instance: DungeonInstance) -> None:
        """Memory Toll: increase fracture by 15."""
        state = instance.archetype_state
        state["fracture"] = min(
            state.get("max_fracture", 100),
            state.get("fracture", 0) + 15,
        )

    def get_ambient_stress_multiplier(self, instance: DungeonInstance) -> float:
        """Ascending paranoia: stress scales with political instability.

        Schism = mild tension. Revolution = significant. New Regime = severe.
        Total fracture = power vacuum (double stress, Robespierre's paradox).
        """
        fracture = instance.archetype_state.get("fracture", 0)
        if fracture >= self.mechanic_config["total_fracture_threshold"]:
            return self.mechanic_config.get("total_fracture_stress_multiplier", 2.0)
        if fracture >= self.mechanic_config["new_regime_threshold"]:
            return self.mechanic_config.get("stress_multiplier_80", 1.50)
        if fracture >= self.mechanic_config["revolution_threshold"]:
            return self.mechanic_config.get("stress_multiplier_60", 1.25)
        if fracture >= self.mechanic_config["schism_threshold"]:
            return self.mechanic_config.get("stress_multiplier_40", 1.10)
        return 1.0

    def on_combat_round(self, instance: DungeonInstance) -> None:
        """Violence fractures authority — each combat round widens the cracks."""
        instance.archetype_state["fracture"] = min(
            self.mechanic_config["max_fracture"],
            instance.archetype_state.get("fracture", 0)
            + self.mechanic_config["gain_per_combat_round"],
        )

    def on_failed_check(self, instance: DungeonInstance) -> None:
        """Failed diplomacy accelerates the crisis — Koestler's logical collapse."""
        instance.archetype_state["fracture"] = min(
            self.mechanic_config["max_fracture"],
            instance.archetype_state.get("fracture", 0)
            + self.mechanic_config["gain_on_failed_check"],
        )

    def on_enemy_hit(self, instance: DungeonInstance) -> None:
        """Each blow widens the cracks — structural violence as political accelerant."""
        instance.archetype_state["fracture"] = min(
            self.mechanic_config["max_fracture"],
            instance.archetype_state.get("fracture", 0)
            + self.mechanic_config["gain_per_enemy_hit"],
        )

    def get_boss_deployment_choices(self, instance: DungeonInstance) -> list[dict] | None:
        """3 strategic approaches before The Pretender boss fight.

        Check-based pattern (like Deluge/Awakening). Three paths mirror
        the literary DNA: Shakespeare (rhetoric), Brecht (exposure),
        La Boétie (withdrawal of consent).
        """
        return [
            {
                "id": "debate_pretender",
                "label_en": "Challenge the Pretender's rhetoric (Propagandist)",
                "label_de": "Die Rhetorik des Prätendenten anfechten (Propagandist)",
                "requires_aptitude": None,
                "check_aptitude": "propagandist",
                "check_difficulty": 0,
                "effects_success": {"buff": "rhetorical_advantage", "duration": 3},
                "effects_partial": {"buff": "fragile_argument", "duration": 2},
                "effects_fail": {"fracture": 15},
            },
            {
                "id": "expose_pretender",
                "label_en": "Expose the Pretender's true nature (Spy)",
                "label_de": "Die wahre Natur des Prätendenten entlarven (Spion)",
                "requires_aptitude": None,
                "check_aptitude": "spy",
                "check_difficulty": 0,
                "effects_success": {"reveal_intent": 2},
                "effects_partial": {"reveal_intent": 1},
                "effects_fail": {"stress": 10},
            },
            {
                "id": "withdraw_support",
                "label_en": "Rally the factions to withdraw support (Guardian)",
                "label_de": "Die Fraktionen zum Entzug der Unterstützung sammeln (Wächter)",
                "requires_aptitude": None,
                "check_aptitude": "guardian",
                "check_difficulty": 0,
                "effects_success": {"condition_bonus": 1, "targets": "all"},
                "effects_partial": {"condition_bonus": 1, "targets": 2},
                "effects_fail": {"stress": 20},
            },
            {
                "id": "begin_combat",
                "label_en": "Enough words. Overthrow The Pretender.",
                "label_de": "Genug Worte. Den Prätendenten stürzen.",
                "requires_aptitude": None,
                "check_aptitude": None,
                "check_difficulty": 0,
            },
        ]

    def _apply_room_entry_gain(self, instance: DungeonInstance) -> None:
        """Depth-scaled fracture gain on room entry.

        Authority cracks with each step deeper into Der Spiegelpalast.
        The mirror palace reflects distorted images of who you serve and why.
        """
        depth = instance.depth
        if depth <= 2:
            gain = self.mechanic_config["gain_depth_1_2"]
        elif depth <= 4:
            gain = self.mechanic_config["gain_depth_3_4"]
        else:
            gain = self.mechanic_config["gain_depth_5_plus"]
        instance.archetype_state["fracture"] = min(
            self.mechanic_config["max_fracture"],
            instance.archetype_state.get("fracture", 0) + gain,
        )


# ── Strategy Registry ──────────────────────────────────────────────────────
# Singleton instances, keyed by archetype name. Lookup is O(1).

_ARCHETYPE_STRATEGIES: dict[str, ArchetypeStrategy] = {
    "The Shadow": ShadowStrategy(ARCHETYPE_CONFIGS["The Shadow"]),
    "The Tower": TowerStrategy(ARCHETYPE_CONFIGS["The Tower"]),
    "The Entropy": EntropyStrategy(ARCHETYPE_CONFIGS["The Entropy"]),
    "The Devouring Mother": DevouringMotherStrategy(ARCHETYPE_CONFIGS["The Devouring Mother"]),
    "The Prometheus": PrometheusStrategy(ARCHETYPE_CONFIGS["The Prometheus"]),
    "The Deluge": DelugeStrategy(ARCHETYPE_CONFIGS["The Deluge"]),
    "The Awakening": AwakeningStrategy(ARCHETYPE_CONFIGS["The Awakening"]),
    "The Overthrow": OverthrowStrategy(ARCHETYPE_CONFIGS["The Overthrow"]),
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
