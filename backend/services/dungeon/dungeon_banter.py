"""Dungeon banter — runtime selection of archetype-specific between-encounter lines.

Content lives in `content/dungeon/archetypes/{slug}/banter.yaml` (A1
externalization, committed 2026-04-19). The eight per-archetype
`*_BANTER` constants and the `_BANTER_REGISTRIES` dispatch table that used
to live here were deleted in A1.5b — runtime reads from the pack-derived
cache via `dungeon_content_service.get_banter_registry()`.

This module now owns only runtime logic:
  - Archetype-state → banter-tier mapping helpers (`_*_tier` per archetype).
  - The config-driven dispatch that picks the right tier function per
    archetype (`_ARCHETYPE_TIER_CONFIG`).
  - `select_banter`, the public entrypoint that the dungeon services call.
"""

from __future__ import annotations

import random
from collections.abc import Callable


def _entropy_decay_tier(archetype_state: dict) -> int:
    """Map Entropy decay counter to banter degradation tier (0-3)."""
    decay = archetype_state.get("decay", 0)
    if decay >= 85:
        return 3
    if decay >= 70:
        return 2
    if decay >= 40:
        return 1
    return 0


def _mother_attachment_tier(archetype_state: dict) -> int:
    """Map Devouring Mother attachment to banter warmth tier (0-2)."""
    attachment = archetype_state.get("attachment", 0)
    if attachment >= 75:
        return 2
    if attachment >= 45:
        return 1
    return 0


def _prometheus_insight_tier(archetype_state: dict) -> int:
    """Map Prometheus insight to banter intensity tier (0-3).

    0 = cold forge (insight < 20)
    1 = warming (20-44)
    2 = inspired (45-74)
    3 = feverish/breakthrough (75+)
    """
    insight = archetype_state.get("insight", 0)
    if insight >= 75:
        return 3
    if insight >= 45:
        return 2
    if insight >= 20:
        return 1
    return 0


def _awakening_awareness_tier(archetype_state: dict) -> int:
    """Map Awakening awareness to banter intensity tier (0-3).

    0 = unconscious (awareness 0-24)
    1 = stirring (25-49)
    2 = liminal (50-69)
    3 = lucid/dissolution (70+)
    """
    awareness = archetype_state.get("awareness", 0)
    if awareness >= 70:
        return 3
    if awareness >= 50:
        return 2
    if awareness >= 25:
        return 1
    return 0


def _overthrow_fracture_tier(archetype_state: dict) -> int:
    """Map Overthrow authority_fracture to banter paranoia tier (0-3).

    0 = Court Order (fracture 0-19) — Machiavelli clinical
    1 = Whispers/Schism (20-59) — Dostoevsky/Brecht
    2 = Revolution (60-79) — Koestler/Camus
    3 = New Regime/Collapse (80+) — Arendt/Kundera/Orwell
    """
    fracture = archetype_state.get("fracture", 0)
    if fracture >= 80:
        return 3
    if fracture >= 60:
        return 2
    if fracture >= 20:
        return 1
    return 0


def _deluge_water_tier(archetype_state: dict) -> int:
    """Map Deluge water_level to banter intensity tier (0-3).

    0 = dry (water_level 0-24)
    1 = shallow (25-49)
    2 = rising (50-74)
    3 = critical (75+)
    """
    water = archetype_state.get("water_level", 0)
    if water >= 75:
        return 3
    if water >= 50:
        return 2
    if water >= 25:
        return 1
    return 0


# Config-driven tier filtering: archetype → (tier_function, banter_field_name).
# Replaces 6 identical elif blocks with one generic filter.
# Shadow and Tower have no tier-based banter and are absent.
_ARCHETYPE_TIER_CONFIG: dict[str, tuple[Callable[[dict], int], str]] = {
    "The Entropy": (_entropy_decay_tier, "archetype_tier"),
    "The Devouring Mother": (_mother_attachment_tier, "archetype_tier"),
    "The Prometheus": (_prometheus_insight_tier, "archetype_tier"),
    "The Deluge": (_deluge_water_tier, "archetype_tier"),
    "The Awakening": (_awakening_awareness_tier, "archetype_tier"),
    "The Overthrow": (_overthrow_fracture_tier, "archetype_tier"),
}


def select_banter(
    trigger: str,
    agents: list[dict],
    used_ids: list[str],
    archetype: str = "The Shadow",
    archetype_state: dict | None = None,
    depth: int = 0,
) -> dict | None:
    """Select a banter template for the current trigger.

    Filters by trigger type, depth gate, personality match, and ensures no repeats.
    For The Entropy, filters by decay_tier (banter degrades).
    For The Devouring Mother, filters by attachment_tier (banter warms).
    For The Prometheus, filters by insight_tier (banter intensifies).

    Args:
        trigger: Event trigger (room_entered, combat_won, etc.)
        agents: List of agent dicts with personality traits.
        used_ids: List of already-used banter IDs this run.
        archetype: Dungeon archetype for registry lookup.
        archetype_state: Archetype-specific state for tier filtering.
        depth: Current dungeon depth (0-based). Banter with min_depth > depth is excluded.
    """
    from backend.services.dungeon_content_service import get_banter_registry

    banter_pool = get_banter_registry().get(archetype, [])
    candidates = [
        b for b in banter_pool
        if b["trigger"] == trigger
        and b["id"] not in used_ids
        and depth >= b.get("min_depth", 0)
    ]
    if not candidates:
        return None

    # Archetype-specific tier filtering — prefer highest available tier.
    # Config-driven: each archetype maps to (tier_function, banter_field_name).
    # Shadow and Tower have no tier-based banter and are absent from this map.
    tier_config = _ARCHETYPE_TIER_CONFIG.get(archetype)
    if tier_config and archetype_state:
        tier_fn, tier_field = tier_config
        tier = tier_fn(archetype_state)
        tier_candidates = [b for b in candidates if b.get(tier_field, 0) <= tier]
        if tier_candidates:
            max_tier = max(b.get(tier_field, 0) for b in tier_candidates)
            candidates = [b for b in tier_candidates if b.get(tier_field, 0) == max_tier]

    if not candidates:
        return None

    return random.choice(candidates)
