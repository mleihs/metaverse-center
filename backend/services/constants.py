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

# Platform defaults -- used when simulation has no model configured
PLATFORM_DEFAULT_MODELS: dict[str, str] = {
    "agent_description": "anthropic/claude-sonnet-4-6",
    "agent_reactions": "anthropic/claude-sonnet-4-6",
    "building_description": "anthropic/claude-sonnet-4-6",
    "event_generation": "anthropic/claude-sonnet-4-6",
    "chat_response": "anthropic/claude-sonnet-4-6",
    "news_transformation": "anthropic/claude-sonnet-4-6",
    "social_trends": "anthropic/claude-sonnet-4-6",
    "bot_chat": "anthropic/claude-sonnet-4-6",
    "default": "anthropic/claude-sonnet-4-6",
    "fallback": "deepseek/deepseek-r1-0528:free",
}

# ── Event constants (from models/event.py) ───────────────────────────────

EVENT_STATUSES = ("active", "escalating", "resolving", "resolved", "archived")
