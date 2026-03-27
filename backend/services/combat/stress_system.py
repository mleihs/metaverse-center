"""Stress economy — pure functions for stress calculation and resolve checks.

Design changes from spec (Review #11):
- Ambient stress per room HALVED: (8 + 3*depth + 5*difficulty) instead of (15 + 5*depth + 10*difficulty)
- Virtue rate increased to 40% (was 25%) — makes Resolve Checks tense, not death sentences
- Maximum stress gain per round capped at 150 — prevents spike kills from Paranoia Shade
- Propagandist "Inspire" heals 120 stress (was 75) — meaningful recovery option
- Rest sites heal 200 stress (was 100) — makes finding rest rooms impactful
"""

from __future__ import annotations

import random
from typing import Literal

# ── Constants ────────────────────────────────────────────────────────────────

STRESS_MAX = 1000
STRESS_RESOLVE_THRESHOLD = 800
STRESS_CAP_PER_ROUND = 150
VIRTUE_RATE = 0.40  # 40% chance of Virtue on Resolve Check (Review #11)

REST_STRESS_HEAL = 200
INSPIRE_STRESS_HEAL = 120

# Thresholds for UI display
STRESS_THRESHOLD_TENSE = 200
STRESS_THRESHOLD_CRITICAL = 500


def calculate_stress_damage(
    attacker_stress_power: int,
    defender_resilience: float,
    defender_neuroticism: float,
    *,
    has_guardian_shield: bool = False,
) -> int:
    """Calculate stress points inflicted by a stress attack.

    Args:
        attacker_stress_power: 1-10, from enemy template or ability.
        defender_resilience: 0-1, from agent personality (personality-derived).
        defender_neuroticism: 0-1, from Big Five trait.
        has_guardian_shield: Whether Guardian is shielding this agent.

    Returns:
        Stress points to inflict (minimum 10, capped at STRESS_CAP_PER_ROUND).
    """
    base = attacker_stress_power * 20  # 20-200 range
    resilience_reduction = base * defender_resilience * 0.4  # up to 40% reduction
    neuroticism_amplify = base * defender_neuroticism * 0.3  # up to 30% increase

    result = base - resilience_reduction + neuroticism_amplify
    if has_guardian_shield:
        result *= 0.5  # Guardian absorbs 50% stress

    return min(STRESS_CAP_PER_ROUND, max(10, int(result)))


def calculate_ambient_stress(depth: int, difficulty: int) -> int:
    """Calculate passive stress gained per room entered.

    Review #11: Halved from original formula to prevent death spirals.
    Original: 15 + 5*depth + 10*difficulty (50-70 per room at diff 3)
    New: 8 + 3*depth + 5*difficulty (26-38 per room at diff 3)
    """
    return 8 + (3 * depth) + (5 * difficulty)


def apply_stress(
    current_stress: int,
    delta: int,
    *,
    cap_per_round: bool = True,
) -> tuple[int, bool]:
    """Apply stress delta and check if Resolve Check is triggered.

    Args:
        current_stress: Agent's current stress level.
        delta: Stress change (positive = gain, negative = heal).
        cap_per_round: Whether to enforce per-round cap (True in combat).

    Returns:
        Tuple of (new_stress, triggers_resolve_check).
    """
    if cap_per_round and delta > 0:
        delta = min(delta, STRESS_CAP_PER_ROUND)

    new_stress = max(0, min(STRESS_MAX, current_stress + delta))

    triggers_resolve = new_stress >= STRESS_RESOLVE_THRESHOLD and current_stress < STRESS_RESOLVE_THRESHOLD

    return new_stress, triggers_resolve


def resolve_stress_check() -> Literal["virtue", "affliction"]:
    """Resolve a stress check when agent crosses 800 stress.

    Review #11: 40% Virtue rate (was 25%).
    Virtue = agent overcomes the stress, gains a beneficial trait.
    Affliction = agent succumbs, gains a negative trait and is severely weakened.
    """
    return "virtue" if random.random() < VIRTUE_RATE else "affliction"


def stress_threshold(stress: int) -> Literal["normal", "tense", "critical"]:
    """Get display threshold for UI escalation."""
    if stress >= STRESS_THRESHOLD_CRITICAL:
        return "critical"
    if stress >= STRESS_THRESHOLD_TENSE:
        return "tense"
    return "normal"
