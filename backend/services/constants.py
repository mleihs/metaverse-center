"""Shared constants extracted from service modules to break circular imports.

These constants were originally defined in their respective service/model modules.
They are re-exported from those modules for backwards compatibility, but new code
should import from here to avoid circular dependency chains.
"""

import logging

logger = logging.getLogger(__name__)

# ── Operative constants (from operative_service.py) ──────────────────────

# Security level -> numeric value for success probability
SECURITY_LEVEL_MAP: dict[str, float] = {
    "fortress": 10.0,
    "maximum": 10.0,
    "high": 8.5,
    "guarded": 7.0,
    "moderate": 5.5,
    "medium": 5.5,
    "low": 4.0,
    "lawless": 2.0,
    "contested": 3.0,
}

# Ordered list of security tiers (lowest -> highest) for upgrade/downgrade
SECURITY_TIER_ORDER: list[str] = [
    "lawless",
    "contested",
    "low",
    "moderate",
    "guarded",
    "high",
    "maximum",
    "fortress",
]

# ── Scoring constants (mirrors of SQL, for docs + test assertions) ──────
# The authoritative implementation is fn_compute_cycle_scores (migration 127,
# refreshed in 187). These Python copies exist so the numbers are greppable
# from application code and assertable in tests — they are NOT read by any
# runtime scoring path. Change the migration first, then mirror it here.

# Score value for successful missions
MISSION_SCORE_VALUES: dict[str, int] = {
    "spy": 3,
    "saboteur": 5,
    "propagandist": 4,
    "assassin": 8,
    "infiltrator": 6,
}

# Detection penalty for failed missions
DETECTION_PENALTY = 3

# Guardian overcome bonus: +2 military per guardian when attacker succeeds
# against a guardian-protected target (capped at +4).
GUARDIAN_OVERCOME_BONUS = 2
GUARDIAN_OVERCOME_CAP = 4

# ── Epoch constants (from epoch_service.py) ──────────────────────────────

# RP costs for each operative type
OPERATIVE_RP_COSTS: dict[str, int] = {
    "spy": 3,
    "saboteur": 5,
    "propagandist": 4,
    "assassin": 7,
    "guardian": 4,
    "infiltrator": 5,
}

# ── Operative type metadata (colors, durations, effects) ─────────────────

# Display colors per operative type (hex)
OPERATIVE_TYPE_COLORS: dict[str, str] = {
    "spy": "#64748b",
    "saboteur": "#ef4444",
    "propagandist": "#f59e0b",
    "assassin": "#dc2626",
    "infiltrator": "#a78bfa",
    "guardian": "#10b981",
}

# Deployment + mission durations in cycles
OPERATIVE_DEPLOY_CYCLES: dict[str, int] = {
    "spy": 0,
    "saboteur": 1,
    "propagandist": 1,
    "assassin": 2,
    "guardian": 0,
    "infiltrator": 2,
}

OPERATIVE_MISSION_CYCLES: dict[str, int] = {
    "spy": 3,
    "saboteur": 1,
    "propagandist": 2,
    "assassin": 1,
    "guardian": 0,
    "infiltrator": 3,
}

# Security level downgrade map (saboteur effect)
SECURITY_DOWNGRADE: dict[str, str] = {
    "fortress": "maximum",
    "maximum": "high",
    "high": "guarded",
    "guarded": "moderate",
    "moderate": "low",
    "medium": "low",
    "low": "contested",
    "contested": "lawless",
    "lawless": "lawless",
}

# Fortification constants
FORTIFICATION_RP_COST = 2
FORTIFICATION_DURATION_CYCLES = 5


def _downgrade_security(level: str) -> str:
    """Downgrade a security level by one tier (e.g., high -> guarded)."""
    return SECURITY_DOWNGRADE.get(level, level)


def _upgrade_security(level: str) -> str:
    """Upgrade a security level by one tier (e.g., moderate -> guarded)."""
    try:
        idx = SECURITY_TIER_ORDER.index(level)
    except ValueError:
        return level
    if idx < len(SECURITY_TIER_ORDER) - 1:
        return SECURITY_TIER_ORDER[idx + 1]
    return level


# Target entity type required per operative
OPERATIVE_TARGET_TYPE: dict[str, str] = {
    "spy": "none",
    "saboteur": "building",
    "propagandist": "zone",
    "assassin": "agent",
    "infiltrator": "embassy",
    "guardian": "none",
}

# ── Model resolver constants (from model_resolver.py) ────────────────────

# Last-resort model ids, read at exactly ONE call site:
# GenerationService layer 3, after both the resolved model and the platform
# fallback have already failed.
#
# It used to carry a per-purpose entry for each of the eight generation kinds.
# None of them was ever read: ModelResolver step 3 goes through
# `get_platform_model(purpose)`, which maps everything except forge/research/
# fallback onto `model_default`. Nine of eleven entries were decoration that
# read like configuration — so they are gone rather than merely corrected.
#
# ⚠ Both ids below must exist in OpenRouter's catalogue. Checked 2026-08-29:
# `anthropic/claude-sonnet-4-6` had a HYPHEN where the catalogue has a dot
# (`claude-sonnet-4.6`) and had therefore never resolved, and the `:free`
# variant of `deepseek-r1-0528` no longer exists. The last line of defence was
# unusable, and only reachable once everything else had already broken.
PLATFORM_DEFAULT_MODELS: dict[str, str] = {
    "default": "deepseek/deepseek-v4-flash",
    "fallback": "google/gemini-2.5-flash-lite",
}

# ── Event constants (from models/event.py) ───────────────────────────────

EVENT_STATUSES = ("active", "escalating", "resolving", "resolved", "archived")
