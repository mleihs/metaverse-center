"""Skill check system — 3-tier resolution for non-combat challenges.

Spec Section 4.2: Disco Elysium + PbtA Hybrid

Check Value = Base (55%) + (Relevant Aptitude × 3%) + Personality Modifier + Context Modifier

Thresholds:
  ≤ 30%: FAIL — negative consequence, narrative complication, stress +50-100
  31-70%: PARTIAL — succeed with cost (stress, resource loss, time)
  ≥ 71%: SUCCESS — clean success, possible bonus discovery

Personality Modifiers (context-dependent, from Big Five traits):
  Courage check:   Low Neuroticism +10%  / High Neuroticism -10%
  Social check:    High Extraversion +10% / Low Extraversion -5%
  Precision check: High Conscientiousness +10% / Low Conscientiousness -5%
  Creative check:  High Openness +10% / Low Openness -10%
  Moral check:     High Agreeableness +10% (compassionate) / Low Agreeableness +10% (ruthless)

Context Modifiers:
  Shadow Visibility 0: -15%
  Wounded condition: -30% (from condition_tracks TRANSITION_SIDE_EFFECTS)
  Encounter-specific difficulty adjustment

Shared module: used by DungeonEngineService (encounter choices) and future
War Room Ops (operative missions).
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Literal

SkillCheckResult = Literal["success", "partial", "fail"]

# ── Thresholds ────────────────────────────────────────────────────────────────

FAIL_CEILING = 30
PARTIAL_CEILING = 70

BASE_CHECK_VALUE = 55
APTITUDE_MULTIPLIER = 3

# Floor/cap for final check value
CHECK_VALUE_FLOOR = 5
CHECK_VALUE_CAP = 95

# ── Personality Modifier Tables ───────────────────────────────────────────────

CHECK_TYPE_PERSONALITY_MODIFIERS: dict[str, dict[str, tuple[float, int, int]]] = {
    # check_type -> trait_name -> (threshold, bonus_if_above, penalty_if_below)
    "courage": {"neuroticism": (0.5, -10, 10)},  # LOW neuro = brave
    "social": {"extraversion": (0.5, 10, -5)},
    "precision": {"conscientiousness": (0.5, 10, -5)},
    "creative": {"openness": (0.5, 10, -10)},
    "compassionate": {"agreeableness": (0.5, 10, 0)},
    "ruthless": {"agreeableness": (0.5, -10, 10)},  # LOW agree = ruthless
}

# Map aptitudes to typical check types for auto-detection
APTITUDE_CHECK_TYPE_MAP: dict[str, str] = {
    "spy": "precision",
    "guardian": "courage",
    "assassin": "precision",
    "propagandist": "social",
    "infiltrator": "precision",
    "saboteur": "creative",
}


@dataclass
class SkillCheckContext:
    """Context for a skill check resolution.

    Attributes:
        aptitude: The aptitude school being checked (e.g. "spy", "guardian").
        aptitude_level: Agent's aptitude score (0-9).
        difficulty_modifier: Encounter-specific difficulty adjustment (can be negative).
        personality: Agent's Big Five personality traits (0-1 each).
        condition: Agent's current condition (affects wounded penalty).
        check_type: Type of check for personality modifier selection.
            If None, auto-detected from aptitude.
        visibility: Shadow archetype visibility (0-3). 0 = -15% penalty.
    """

    aptitude: str
    aptitude_level: int
    difficulty_modifier: int = 0
    personality: dict[str, float] = field(default_factory=dict)
    condition: str = "operational"
    check_type: str | None = None
    visibility: int = 3
    archetype_state: dict = field(default_factory=dict)


@dataclass
class SkillCheckOutcome:
    """Result of a skill check.

    Contains all information needed for logging, narrative, and effect
    application. The breakdown dict is suitable for terminal display.
    """

    result: SkillCheckResult
    roll: int
    check_value: int
    breakdown: dict = field(default_factory=dict)

    @property
    def succeeded(self) -> bool:
        return self.result == "success"

    @property
    def failed(self) -> bool:
        return self.result == "fail"


def resolve_skill_check(ctx: SkillCheckContext) -> SkillCheckOutcome:
    """Resolve a 3-tier skill check.

    Args:
        ctx: Skill check context with aptitude, personality, condition, etc.

    Returns:
        SkillCheckOutcome with result tier, roll, check value, and breakdown.
    """
    breakdown: dict[str, int | str] = {}

    # Base + Aptitude
    base = BASE_CHECK_VALUE
    aptitude_bonus = ctx.aptitude_level * APTITUDE_MULTIPLIER
    breakdown["base"] = base
    breakdown["aptitude"] = ctx.aptitude
    breakdown["aptitude_level"] = ctx.aptitude_level
    breakdown["aptitude_bonus"] = aptitude_bonus

    check_value = base + aptitude_bonus

    # Lucid Dreaming bonus (Awakening): awareness ≥ 70 → +10% aptitude bonus
    if ctx.archetype_state.get("awareness", 0) >= 70:
        lucid_bonus = max(1, int(aptitude_bonus * 0.10))
        check_value += lucid_bonus
        breakdown["lucid_bonus"] = lucid_bonus

    # Personality modifier
    check_type = ctx.check_type or APTITUDE_CHECK_TYPE_MAP.get(ctx.aptitude, "precision")
    personality_mod = _calculate_personality_modifier(check_type, ctx.personality)
    if personality_mod != 0:
        breakdown["personality_modifier"] = personality_mod
        breakdown["check_type"] = check_type
    check_value += personality_mod

    # Difficulty modifier (from encounter template)
    if ctx.difficulty_modifier != 0:
        breakdown["difficulty_modifier"] = ctx.difficulty_modifier
    check_value += ctx.difficulty_modifier

    # Context: Shadow visibility
    if ctx.visibility == 0:
        visibility_penalty = -15
        breakdown["visibility_penalty"] = visibility_penalty
        check_value += visibility_penalty

    # Context: Wounded condition
    if ctx.condition == "wounded":
        condition_penalty = -30
        breakdown["condition_penalty"] = condition_penalty
        check_value += condition_penalty

    # Clamp
    check_value = max(CHECK_VALUE_FLOOR, min(CHECK_VALUE_CAP, check_value))
    breakdown["final_check_value"] = check_value

    # Roll 1d100, apply check value as modifier
    # The check_value shifts the effective roll: higher aptitude → better outcomes.
    # At base (55%): standard 30/40/30 distribution.
    # At 80%: effective += 25, so SUCCESS becomes ~85% likely.
    # At 30%: effective -= 25, so FAIL becomes ~55% likely.
    raw_roll = random.randint(1, 100)  # noqa: S311 — game randomness, not crypto
    adjustment = check_value - BASE_CHECK_VALUE
    effective_roll = max(1, min(100, raw_roll + adjustment))
    breakdown["raw_roll"] = raw_roll
    breakdown["adjustment"] = adjustment

    # Determine result tier from effective roll
    if effective_roll <= FAIL_CEILING:
        result: SkillCheckResult = "fail"
    elif effective_roll <= PARTIAL_CEILING:
        result = "partial"
    else:
        result = "success"

    return SkillCheckOutcome(
        result=result,
        roll=raw_roll,
        check_value=check_value,
        breakdown=breakdown,
    )


def _calculate_personality_modifier(check_type: str, personality: dict[str, float]) -> int:
    """Calculate personality modifier for a given check type.

    Args:
        check_type: Type of check (courage, social, precision, creative, etc.).
        personality: Big Five traits dict, e.g. {"neuroticism": 0.7, "extraversion": 0.4}.

    Returns:
        Personality modifier in percentage points.
    """
    modifiers = CHECK_TYPE_PERSONALITY_MODIFIERS.get(check_type, {})
    total = 0

    for trait_name, (threshold, bonus_above, penalty_below) in modifiers.items():
        trait_value = personality.get(trait_name, 0.5)
        if trait_value >= threshold:
            total += bonus_above
        else:
            total += penalty_below

    return total


def format_check_for_terminal(
    agent_name: str,
    action_description: str,
    outcome: SkillCheckOutcome,
) -> tuple[str, str]:
    """Format a skill check result for terminal display (en/de).

    Returns:
        Tuple of (english_text, german_text) for terminal rendering.
    """
    b = outcome.breakdown
    aptitude = b.get("aptitude", "unknown").upper()
    level = b.get("aptitude_level", 0)
    base = b.get("base", 55)
    apt_bonus = b.get("aptitude_bonus", 0)

    lines_en = [
        f"Agent {agent_name} {action_description}.",
        "",
        f"[{aptitude} CHECK — Aptitude {level}: Base {base}% + ({level}×3%) = {base + apt_bonus}%",
    ]
    lines_de = [
        f"Agent {agent_name} {action_description}.",
        "",
        f"[{aptitude}-PRÜFUNG — Eignung {level}: Basis {base}% + ({level}×3%) = {base + apt_bonus}%",
    ]

    if "personality_modifier" in b:
        lines_en.append(f"  Personality: {b.get('check_type', '')} → {b['personality_modifier']:+d}%")
        lines_de.append(f"  Persönlichkeit: {b.get('check_type', '')} → {b['personality_modifier']:+d}%")

    if "visibility_penalty" in b:
        lines_en.append(f"  Context: Visibility 0 → {b['visibility_penalty']}%")
        lines_de.append(f"  Kontext: Sicht 0 → {b['visibility_penalty']}%")

    if "condition_penalty" in b:
        lines_en.append(f"  Condition: Wounded → {b['condition_penalty']}%")
        lines_de.append(f"  Zustand: Verwundet → {b['condition_penalty']}%")

    if "difficulty_modifier" in b and b["difficulty_modifier"] != 0:
        lines_en.append(f"  Difficulty: {b['difficulty_modifier']:+d}%")
        lines_de.append(f"  Schwierigkeit: {b['difficulty_modifier']:+d}%")

    final = b.get("final_check_value", 0)
    lines_en.append(f"  Final: {final}%]")
    lines_de.append(f"  Endergebnis: {final}%]")

    result_label_en = {"success": "SUCCESS", "partial": "PARTIAL SUCCESS", "fail": "FAIL"}
    result_label_de = {"success": "ERFOLG", "partial": "TEILERFOLG", "fail": "FEHLSCHLAG"}

    adjustment = b.get("adjustment", 0)
    if adjustment != 0:
        adj_str = f" ({outcome.roll}{adjustment:+d}={outcome.roll + adjustment})"
    else:
        adj_str = ""

    lines_en.append(f"\nRolling... {outcome.roll}{adj_str} — {result_label_en[outcome.result]}")
    lines_de.append(f"\nWürfeln... {outcome.roll}{adj_str} — {result_label_de[outcome.result]}")

    return "\n".join(lines_en), "\n".join(lines_de)
