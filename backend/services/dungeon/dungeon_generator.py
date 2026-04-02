"""Dungeon graph generation — FTL/Slay the Spire hybrid DAG.

Generates a directed acyclic graph of typed rooms for dungeon exploration.
The algorithm creates layers of 1-3 rooms, connects them to ensure all are
reachable, and assigns room types based on archetype-specific distributions.

Review #18: Guaranteed rest room moved from per-room to per-layer.
Review #8: Exit rooms defined — early escape at depth >= 3, Tier 1 loot only.
"""

from __future__ import annotations

import random

from backend.models.resonance_dungeon import RoomNode, RoomType
from backend.services.dungeon.dungeon_archetypes import ARCHETYPE_ROOM_DISTRIBUTIONS


def generate_dungeon_graph(
    archetype: str,
    difficulty: int,
    depth: int,
    seed: int | None = None,
) -> list[RoomNode]:
    """Generate an FTL/Slay-the-Spire style node graph.

    Args:
        archetype: Dungeon archetype name (e.g. "The Shadow").
        difficulty: 1-5 difficulty level.
        depth: Number of content floors (boss is at depth+1 conceptually).
        seed: Optional RNG seed for reproducible generation.

    Returns:
        List of RoomNode objects forming a directed acyclic graph.
        Index 0 is always the entrance, last index is always the boss.
    """
    if seed is not None:
        random.seed(seed)

    base_weights = dict(ARCHETYPE_ROOM_DISTRIBUTIONS.get(archetype, ARCHETYPE_ROOM_DISTRIBUTIONS["The Shadow"]))
    rooms: list[RoomNode] = []
    idx = 0

    # ── Layer 0: Entrance ───────────────────────────────────────────────
    rooms.append(
        RoomNode(
            index=idx,
            depth=0,
            room_type="entrance",
            connections=[],
            revealed=True,
            cleared=True,
        )
    )
    idx += 1
    prev_layer: list[int] = [0]

    # ── Layers 1 to depth-1: Content rooms ──────────────────────────────
    mid_depth = max(1, int(depth * 0.6))  # guaranteed rest near 60% mark
    rest_placed_at_mid = False

    for d in range(1, depth):
        width = _layer_width(d, depth, difficulty)
        layer: list[int] = []

        for _ in range(width):
            room_type = _pick_room_type(d, depth, base_weights, difficulty)
            loot_tier = _assign_loot_tier(room_type, d, depth, difficulty)
            rooms.append(
                RoomNode(
                    index=idx,
                    depth=d,
                    room_type=room_type,
                    connections=[],
                    loot_tier=loot_tier,
                )
            )
            layer.append(idx)
            idx += 1

        # ── Connect layers ──────────────────────────────────────────────
        _connect_layers(rooms, prev_layer, layer)

        # ── No consecutive rest rooms ──────────────────────────────────
        # If a rest room is directly connected to another rest room in the
        # previous layer, replace it with combat to preserve pacing tension.
        prev_rest_indices = {i for i in prev_layer if rooms[i].room_type == "rest"}
        for room_idx in layer:
            room = rooms[room_idx]
            if room.room_type != "rest":
                continue
            if prev_rest_indices & set(room.connections):
                room.room_type = "combat"
                room.loot_tier = _assign_loot_tier("combat", d, depth, difficulty)

        # Review #18: Guarantee at least one rest room near mid-depth.
        # Runs AFTER the no-consecutive-rest constraint so it picks a room
        # that won't immediately be overwritten.
        if d == mid_depth and not rest_placed_at_mid:
            layer_rooms = [rooms[i] for i in layer]
            has_rest = any(r.room_type == "rest" for r in layer_rooms)
            if not has_rest:
                # Prefer a room without rest parents to avoid violating the constraint
                safe = [i for i in layer if not (prev_rest_indices & set(rooms[i].connections))]
                replace_idx = random.choice(safe) if safe else random.choice(layer)
                rooms[replace_idx].room_type = "rest"
                rooms[replace_idx].loot_tier = 0
            rest_placed_at_mid = True

        prev_layer = layer

    # ── Threshold: chokepoint before boss ─────────────────────────────
    # The Threshold is a liminal room that forces an irrevocable sacrifice
    # choice. It is the sole path from the last content layer to the boss,
    # functioning like a medieval barbican — a designed vulnerability space.
    threshold_idx = idx
    rooms.append(RoomNode(
        index=threshold_idx,
        depth=depth,
        room_type="threshold",
        connections=[],
    ))
    _connect_layers(rooms, prev_layer, [threshold_idx])
    idx += 1

    # ── Final Layer: Boss ───────────────────────────────────────────────
    boss_idx = idx
    rooms.append(RoomNode(
        index=boss_idx,
        depth=depth + 1,
        room_type="boss",
        connections=[],
        loot_tier=3,
    ))
    # Threshold → Boss: reuse _connect_layers for consistent forward-only connections
    _connect_layers(rooms, [threshold_idx], [boss_idx])

    # ── Reveal first layer (player sees immediate choices) ──────────────
    for room in rooms:
        if room.depth <= 1:
            room.revealed = True

    return rooms


def _layer_width(d: int, depth: int, difficulty: int) -> int:
    """Determine number of rooms in a layer (bell curve: narrow edges, wide middle)."""
    progress = d / depth
    if progress < 0.3:
        width = random.choice([1, 2])
    elif progress < 0.7:
        width = random.choice([2, 2, 3])
    else:
        width = random.choice([1, 2])

    # Higher difficulty can widen layers
    if difficulty >= 4 and width < 3 and random.random() < 0.3:
        width += 1

    return min(3, width)


def _pick_room_type(
    current_depth: int,
    max_depth: int,
    base_weights: dict[str, int],
    difficulty: int,
) -> RoomType:
    """Weighted random room type selection with constraints."""
    weights = dict(base_weights)

    # No elites or narrative encounters before depth 2 — encounter templates
    # have min_depth=2 and would auto-clear if placed at depth 1.
    if current_depth < 2:
        weights.pop("elite", None)
        weights.pop("encounter", None)

    # No exit rooms before depth 3 (Review #8)
    if current_depth < 3:
        weights.pop("exit", None)

    # Difficulty increases elite probability
    if "elite" in weights:
        weights["elite"] = weights["elite"] + (difficulty * 2)

    types = list(weights.keys())
    wts = list(weights.values())
    return random.choices(types, weights=wts, k=1)[0]


def _assign_loot_tier(
    room_type: str,
    depth: int,
    max_depth: int,
    difficulty: int,
) -> int:
    """Assign loot tier: 0=none, 1=minor, 2=major, 3=legendary."""
    if room_type == "boss":
        return 3
    if room_type == "treasure":
        return 2 if depth > max_depth * 0.5 else 1
    if room_type == "elite":
        return 2
    if room_type == "exit":
        return 1  # Review #8: exit rooms give Tier 1 only
    if room_type == "combat":
        return 1 if random.random() < 0.3 else 0
    return 0


def _connect_layers(
    rooms: list[RoomNode],
    prev_layer: list[int],
    current_layer: list[int],
) -> None:
    """Connect rooms between adjacent layers.

    Each room in prev_layer connects to 1-2 rooms in current_layer.
    Each room in current_layer must have at least 1 incoming connection.
    """
    connected: set[int] = set()

    for p_idx in prev_layer:
        n_connections = min(len(current_layer), random.choice([1, 1, 2]))
        targets = random.sample(current_layer, n_connections)
        for t in targets:
            if t not in rooms[p_idx].connections:
                rooms[p_idx].connections.append(t)
            connected.add(t)

    # Ensure all rooms in current layer have at least 1 incoming
    for c_idx in current_layer:
        if c_idx not in connected:
            source = random.choice(prev_layer)
            if c_idx not in rooms[source].connections:
                rooms[source].connections.append(c_idx)
