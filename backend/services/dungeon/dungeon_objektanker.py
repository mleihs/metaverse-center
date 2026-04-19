"""Objektanker (anchor objects) + barometer text — runtime selection helpers.

Content lives in `content/dungeon/archetypes/{slug}/anchors.yaml`,
`entrance_texts.yaml`, and `barometer_texts.yaml` (A1 externalization,
committed 2026-04-19). The `ENTRANCE_TEXTS`, `ANCHOR_OBJECTS`, and
`BAROMETER_TEXTS` constants that used to live here were deleted in
A1.5b. Runtime reads via the content-service accessors.

Architecture decisions (preserved for future readers):

  - **Variation C — Wandernde Dinge**: named objects that migrate through
    a dungeon in four phases (discovery → echo → mutation → climax).
    Two objects are chosen at run-start from the 8-per-archetype pool
    and tracked in `DungeonInstance.anchor_objects` /
    `anchor_phases_shown`.
  - **Variation B — Resonanz-Barometer**: one fixed object per archetype
    that translates an `archetype_state` threshold into prose. Shown
    only on tier change (prevents spam).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, TypedDict

if TYPE_CHECKING:
    from backend.models.resonance_dungeon import DungeonInstance, RoomNode


class AnchorTextResult(TypedDict):
    """Typed return value for select_anchor_text entries."""

    text_en: str
    text_de: str
    anchor_id: str
    phase: str


# ── Anchor/Barometer Selection Functions ──────────────────────────────────


def _barometer_tier(archetype: str, archetype_state: dict) -> int:
    """Calculate the current barometer tier (0-3) from archetype state."""
    if archetype == "The Shadow":
        vis = archetype_state.get("visibility", 3)
        return {3: 0, 2: 1, 1: 2}.get(vis, 3)
    if archetype == "The Tower":
        stability = archetype_state.get("stability", 100)
        if stability >= 80:
            return 0
        if stability >= 50:
            return 1
        if stability >= 25:
            return 2
        return 3
    if archetype == "The Devouring Mother":
        attachment = archetype_state.get("attachment", 0)
        if attachment <= 30:
            return 0
        if attachment <= 60:
            return 1
        if attachment <= 85:
            return 2
        return 3
    if archetype == "The Entropy":
        decay = archetype_state.get("decay", 0)
        if decay <= 20:
            return 0
        if decay <= 50:
            return 1
        if decay <= 80:
            return 2
        return 3
    if archetype == "The Prometheus":
        insight = archetype_state.get("insight", 0)
        if insight < 20:
            return 0
        if insight < 45:
            return 1
        if insight < 75:
            return 2
        return 3
    if archetype == "The Deluge":
        water = archetype_state.get("water_level", 0)
        if water <= 24:
            return 0
        if water <= 49:
            return 1
        if water <= 74:
            return 2
        return 3
    if archetype == "The Awakening":
        awareness = archetype_state.get("awareness", 0)
        if awareness <= 24:
            return 0
        if awareness <= 49:
            return 1
        if awareness <= 69:
            return 2
        return 3
    if archetype == "The Overthrow":
        fracture = archetype_state.get("fracture", 0)
        if fracture <= 19:
            return 0
        if fracture <= 59:
            return 1
        if fracture <= 79:
            return 2
        return 3
    return 0


def get_barometer_text(
    archetype: str,
    archetype_state: dict,
    last_tier: int,
) -> tuple[dict | None, int]:
    """Get barometer text if the tier has changed since last display.

    Returns (text_dict_or_None, new_tier).
    Only returns text when current tier != last_tier (prevents spam).
    """
    current_tier = _barometer_tier(archetype, archetype_state)
    if current_tier == last_tier:
        return None, last_tier
    from backend.services.dungeon_content_service import get_barometer_registry

    tiers = get_barometer_registry().get(archetype, [])
    for entry in tiers:
        if entry["tier"] == current_tier:
            return {"text_en": entry["text_en"], "text_de": entry["text_de"]}, current_tier
    return None, last_tier


def select_anchor_text(
    instance: DungeonInstance,
    target_room: RoomNode,
) -> list[AnchorTextResult]:
    """Select anchor object text(s) for the current room entry.

    Phase selection rules:
    - discovery: Depth 1-3, first encounter/rest/treasure/combat room, object not yet shown
    - echo:      Depth 2+, any room type, object shown discovery but not echo
    - mutation:  Depth 3+, encounter/rest/treasure rooms, object shown echo but not mutation
    - climax:    Boss room only, object shown at least discovery, not yet shown climax

    Returns list of dicts with text_en, text_de, anchor_id, phase.
    Boss room returns up to 2 (both climaxes). Normal rooms return 0 or 1.
    """
    from backend.services.dungeon_content_service import get_anchor_objects

    anchor_pool = get_anchor_objects().get(instance.archetype, [])
    # Build lookup: id → object data
    obj_lookup = {obj["id"]: obj for obj in anchor_pool}

    # Determine which objects are active this run
    active_ids = instance.anchor_objects
    if not active_ids:
        return []

    results: list[AnchorTextResult] = []

    # Phase order for priority (lower index = higher priority for non-boss rooms)
    phase_order = ["discovery", "echo", "mutation", "climax"]

    for obj_id in active_ids:
        obj = obj_lookup.get(obj_id)
        if not obj:
            continue

        shown = set(instance.anchor_phases_shown.get(obj_id, []))
        depth = target_room.depth
        room_type = target_room.room_type
        is_narrative_room = room_type in ("encounter", "rest", "treasure")
        is_boss = room_type == "boss"

        eligible_phase: str | None = None

        if is_boss and "climax" not in shown and "discovery" in shown:
            eligible_phase = "climax"
        elif "discovery" not in shown and depth <= 3:
            eligible_phase = "discovery"
        elif "echo" not in shown and "discovery" in shown and depth >= 2:
            eligible_phase = "echo"
        elif "mutation" not in shown and "echo" in shown and depth >= 3 and is_narrative_room:
            eligible_phase = "mutation"

        if eligible_phase and eligible_phase in obj.get("phases", {}):
            phase_data = obj["phases"][eligible_phase]
            results.append(
                {
                    "text_en": phase_data["text_en"],
                    "text_de": phase_data["text_de"],
                    "anchor_id": obj_id,
                    "phase": eligible_phase,
                }
            )

    # Boss room: return all climaxes (special case — both objects shown)
    if target_room.room_type == "boss":
        return results

    # Non-boss: return at most 1, preferring lowest phase (discovery > echo > mutation)
    if len(results) <= 1:
        return results

    def phase_priority(r: dict) -> int:
        try:
            return phase_order.index(r["phase"])
        except ValueError:
            return 99

    results.sort(key=phase_priority)
    return results[:1]
