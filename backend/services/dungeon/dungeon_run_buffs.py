"""Run-scoped loot buffs — the half of `dungeon_buff` that Python owns.

Thirty of the 105 loot items carry ``effect_type: dungeon_buff``. Until the
Systemprüfung of 2026-08-30 every single one of them was inert: the distribution
service skipped them with a bare ``continue`` ("runtime-only effects"), and the
only code that ever read a ``dungeon_buff`` was the Deluge *debris* path, which
draws from a Python pool and never sees a loot drop at all.

So the effect type was declared, authored thirty times, excluded from the
distribution UI as "auto-apply" — and applied nowhere. This module is the
runtime half that was missing.

Which parameter shape does what is declared once, in
``backend/services/dungeon_loot_contracts.py``; this module applies the wired
ones and deliberately leaves the open ones alone. A shape that is neither wired
nor listed there fails CI in ``scripts/validate_content_packs.py``.
"""

from __future__ import annotations

import logging

from backend.models.resonance_dungeon import DungeonInstance
from backend.services.dungeon_loot_contracts import WIRED_BUFF_KEYS

logger = logging.getLogger(__name__)

#: Skill-check bonuses accumulated over the run, per aptitude. The key predates
#: this module — the Deluge debris path has written it since the archetype
#: shipped, and both skill-check sites already read it, so loot joins an existing
#: mechanism instead of inventing a parallel one.
CHECK_BONUS_KEY = "_debris_check_bonuses"

#: Fraction of ambient stress absorbed while the buff lasts (0.0 – 0.9).
STRESS_RESIST_KEY = "_run_stress_resist"

#: Rooms the stress resistance still covers. Counted down on room entry.
STRESS_RESIST_ROOMS_KEY = "_run_stress_resist_rooms"

#: Additional fraction of the rest heal, e.g. 0.25 → 125 %.
REST_BONUS_KEY = "_run_rest_bonus"

#: Nothing may absorb ambient stress entirely — a dungeon that costs nothing is
#: not a dungeon.
MAX_STRESS_RESIST = 0.9


def apply_run_buff(instance: DungeonInstance, effect_params: dict) -> list[str]:
    """Fold one ``dungeon_buff`` drop into the run's accumulators.

    Returns the names of the shapes that took hold, so the caller can say what
    happened instead of guessing. An unwired shape returns nothing and is
    logged — it is a listed design gap, not a silent loss.
    """
    state = instance.archetype_state
    applied: list[str] = []

    bonus = effect_params.get("check_bonus")
    aptitude = effect_params.get("aptitude")
    if bonus and aptitude:
        bonuses = state.setdefault(CHECK_BONUS_KEY, {})
        bonuses[aptitude] = bonuses.get(aptitude, 0) + int(bonus)
        applied.append("check_bonus")

    resist = effect_params.get("stress_resist")
    if resist:
        # Buffs stack by taking the stronger one and the longer duration, not by
        # adding: two 10 % charms should not make the run free.
        state[STRESS_RESIST_KEY] = min(
            MAX_STRESS_RESIST,
            max(float(state.get(STRESS_RESIST_KEY, 0.0)), float(resist)),
        )
        rooms = int(effect_params.get("duration_rooms", 0) or 0)
        state[STRESS_RESIST_ROOMS_KEY] = max(int(state.get(STRESS_RESIST_ROOMS_KEY, 0)), rooms)
        applied.append("stress_resist")

    rest_bonus = effect_params.get("rest_bonus")
    if rest_bonus:
        state[REST_BONUS_KEY] = float(state.get(REST_BONUS_KEY, 0.0)) + float(rest_bonus)
        applied.append("rest_bonus")

    if not applied:
        open_shapes = sorted(set(effect_params) - WIRED_BUFF_KEYS)
        logger.info(
            "dungeon_buff carries no wired shape",
            extra={
                "run_id": str(instance.run_id),
                "shapes": open_shapes,
                "archetype": instance.archetype,
            },
        )
    return applied


def record_and_apply(instance: DungeonInstance, items: list) -> list[dict]:
    """Keep a drop on the run and let a ``dungeon_buff`` take hold at once.

    Buffs are run-scoped, so they act where they are found rather than waiting
    for the distribution screen — which skips them by design (they carry no
    per-agent choice).
    """
    recorded = instance.record_loot(items)
    for item in recorded:
        if item.get("effect_type") == "dungeon_buff":
            apply_run_buff(instance, item.get("effect_params") or {})
    return recorded


def consume_stress_resist(instance: DungeonInstance) -> float:
    """Ambient-stress multiplier for the room being entered, and tick it down.

    Returns 1.0 when nothing is active, so the caller can multiply
    unconditionally.
    """
    state = instance.archetype_state
    rooms_left = int(state.get(STRESS_RESIST_ROOMS_KEY, 0))
    if rooms_left <= 0:
        return 1.0

    resist = float(state.get(STRESS_RESIST_KEY, 0.0))
    state[STRESS_RESIST_ROOMS_KEY] = rooms_left - 1
    if rooms_left - 1 <= 0:
        state.pop(STRESS_RESIST_KEY, None)
        state.pop(STRESS_RESIST_ROOMS_KEY, None)
    return max(0.0, 1.0 - min(resist, MAX_STRESS_RESIST))


def rest_heal_multiplier(instance: DungeonInstance) -> float:
    """How much more a rest heals because of loot found on this run."""
    return 1.0 + float(instance.archetype_state.get(REST_BONUS_KEY, 0.0))
