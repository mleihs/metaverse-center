"""Condition track system — pure functions for the combat state machine.

Condition progression: Operational → Stressed → Wounded → Afflicted → Captured

Design note (Review #10): Maximum condition steps per single hit is capped at 2.
This prevents one-shot removal of agents by elite enemies, making combat about
attrition and positioning rather than coin-flip outcomes.

Design note: No in-combat healing exists by design (Review #12). Condition damage
is permanent within combat — recovery happens only at rest sites. This makes
Guardian prevention and Spy ambush-avoidance critical.
"""

from __future__ import annotations

from backend.models.combat import Condition

# ── Condition Severity Scale ────────────────────────────────────────────────

CONDITION_SEVERITY: dict[Condition, int] = {
    "operational": 0,
    "stressed": 1,
    "wounded": 2,
    "afflicted": 3,
    "captured": 4,
}

# ── Transition Table ────────────────────────────────────────────────────────
# (current_condition, damage_steps) → new_condition
# Review #10: max steps capped at 2 before lookup

CONDITION_TRANSITIONS: dict[tuple[Condition, int], Condition] = {
    ("operational", 1): "stressed",
    ("operational", 2): "wounded",
    ("stressed", 1): "wounded",
    ("stressed", 2): "afflicted",
    ("wounded", 1): "afflicted",
    ("wounded", 2): "captured",
    ("afflicted", 1): "captured",
    ("afflicted", 2): "captured",
}

# ── Side Effects per Transition ─────────────────────────────────────────────

TRANSITION_SIDE_EFFECTS: dict[Condition, dict] = {
    "stressed": {"stress_delta": 100, "check_penalty": None},
    "wounded": {"stress_delta": 200, "check_penalty": -30},
    "afflicted": {"stress_floor": 800, "trigger_resolve_check": True},
    "captured": {"removed_from_combat": True},
}


def apply_condition_damage(
    current_condition: Condition,
    raw_steps: int,
) -> tuple[Condition, dict]:
    """Apply damage steps to an agent's condition.

    Args:
        current_condition: Agent's current condition state.
        raw_steps: Raw damage steps from attack (before cap).

    Returns:
        Tuple of (new_condition, side_effects dict).
        Side effects may include: stress_delta, check_penalty, stress_floor,
        trigger_resolve_check, removed_from_combat.
    """
    if current_condition == "captured":
        return "captured", {"removed_from_combat": True}

    # Review #10: Cap at 2 steps per hit
    steps = min(raw_steps, 2)

    if steps <= 0:
        return current_condition, {}

    new_condition = CONDITION_TRANSITIONS.get(
        (current_condition, steps),
        "captured",  # fallback for any unmapped combination
    )

    side_effects = dict(TRANSITION_SIDE_EFFECTS.get(new_condition, {}))
    return new_condition, side_effects


def get_condition_severity(condition: Condition) -> int:
    """Get numeric severity (0=operational, 4=captured)."""
    return CONDITION_SEVERITY.get(condition, 0)


def can_act(condition: Condition) -> bool:
    """Whether an agent in this condition can take actions in combat."""
    return condition not in ("captured",)


def condition_display(condition: Condition) -> str:
    """Human-readable condition for client display.

    Maps exact conditions to vaguer descriptions for enemies
    (where we don't want to expose exact HP).
    """
    mapping = {
        "operational": "healthy",
        "stressed": "damaged",
        "wounded": "critical",
        "afflicted": "near-defeat",
        "captured": "defeated",
    }
    return mapping.get(condition, "unknown")
