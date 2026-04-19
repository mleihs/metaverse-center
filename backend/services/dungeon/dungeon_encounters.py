"""Dungeon encounter selection — runtime dispatch to pack-derived content.

Content lives in `content/dungeon/archetypes/{slug}/encounters.yaml` (A1
externalization, committed 2026-04-19). The per-archetype encounter
`EncounterTemplate` lists, the `_ENCOUNTER_REGISTRIES` dispatch table, and
the `_ENCOUNTER_BY_ID` flat index that used to live here were deleted in
A1.5b — the flat index is now built inside
`dungeon_content_service._ContentCache.encounter_index` directly from pack
data.

This module now exposes only the two runtime entrypoints the dungeon
services call: `get_encounter_by_id` and `select_encounter`. Both thin
wrappers over `dungeon_content_service` getters; preserved here so
`from backend.services.dungeon.dungeon_encounters import ...` import sites
throughout the codebase keep working.
"""

from __future__ import annotations

import random

from backend.models.resonance_dungeon import EncounterTemplate


def get_encounter_by_id(encounter_id: str) -> EncounterTemplate | None:
    """Look up an encounter template by ID (any archetype)."""
    from backend.services.dungeon_content_service import get_encounter_by_id_cached

    return get_encounter_by_id_cached(encounter_id)


def select_encounter(
    room_type: str,
    depth: int,
    difficulty: int,
    archetype: str = "The Shadow",
    used_ids: list[str] | None = None,
) -> EncounterTemplate | None:
    """Select an appropriate encounter for a room.

    Filters by room_type, depth, difficulty, and archetype.
    Deduplicates against used_ids to avoid consecutive repeats.
    If all matching encounters are exhausted, resets and allows repeats.
    Returns None if no matching encounter exists.
    """
    from backend.services.dungeon_content_service import get_encounter_registry

    encounter_pool = get_encounter_registry().get(archetype, [])
    candidates = [
        e
        for e in encounter_pool
        if e.room_type == room_type and e.min_depth <= depth <= e.max_depth and difficulty >= e.min_difficulty
    ]
    if not candidates:
        return None

    # Deduplicate: prefer unused encounters
    if used_ids:
        fresh = [e for e in candidates if e.id not in used_ids]
        if fresh:
            candidates = fresh
        # If all exhausted, allow repeats (full pool reset handled by caller)

    return random.choice(candidates)
