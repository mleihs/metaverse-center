"""Tests for backend.services.dungeon.dungeon_generator — FTL/Slay the Spire DAG.

Covers:
  - generate_dungeon_graph: structural invariants, room types, connectivity
  - Review #18: guaranteed rest room near 60% depth
  - Review #8: no exit rooms before depth 3, exit rooms get Tier 1 loot only
  - Seed reproducibility
  - Layer widths 1-3 (bell curve)
  - Boss always at last index, entrance at 0
"""

import pytest

from backend.services.dungeon.dungeon_generator import generate_dungeon_graph

# ── Helpers ───────────────────────────────────────────────────────────────


def _reachable_from_entrance(rooms):
    """BFS from entrance (index 0) to find all reachable room indices."""
    visited = set()
    queue = [0]
    while queue:
        idx = queue.pop(0)
        if idx in visited:
            continue
        visited.add(idx)
        room = rooms[idx]
        for conn in room.connections:
            if conn not in visited:
                queue.append(conn)
    return visited


# ── Structural invariants ─────────────────────────────────────────────────


class TestStructuralInvariants:
    """These invariants must hold for ANY generated graph."""

    @pytest.mark.parametrize("seed", range(10))
    def test_entrance_is_first(self, seed):
        rooms = generate_dungeon_graph("The Shadow", 3, 5, seed=seed)
        assert rooms[0].room_type == "entrance"
        assert rooms[0].depth == 0
        assert rooms[0].cleared is True  # entrance starts cleared
        assert rooms[0].revealed is True

    @pytest.mark.parametrize("seed", range(10))
    def test_boss_is_last(self, seed):
        rooms = generate_dungeon_graph("The Shadow", 3, 5, seed=seed)
        boss = rooms[-1]
        assert boss.room_type == "boss"
        assert boss.loot_tier == 3  # legendary loot

    @pytest.mark.parametrize("seed", range(10))
    def test_indices_sequential(self, seed):
        rooms = generate_dungeon_graph("The Shadow", 3, 5, seed=seed)
        for i, room in enumerate(rooms):
            assert room.index == i

    @pytest.mark.parametrize("seed", range(10))
    def test_all_rooms_reachable_from_entrance(self, seed):
        rooms = generate_dungeon_graph("The Shadow", 3, 5, seed=seed)
        reachable = _reachable_from_entrance(rooms)
        all_indices = {r.index for r in rooms}
        assert reachable == all_indices, f"Unreachable rooms: {all_indices - reachable}"

    @pytest.mark.parametrize("seed", range(10))
    def test_connections_are_forward_only(self, seed):
        """DAG property: connections only go to higher-depth rooms."""
        rooms = generate_dungeon_graph("The Shadow", 3, 5, seed=seed)
        room_map = {r.index: r for r in rooms}
        for room in rooms:
            for conn in room.connections:
                assert room_map[conn].depth > room.depth, (
                    f"Room {room.index} (depth {room.depth}) connects to "
                    f"room {conn} (depth {room_map[conn].depth})"
                )

    @pytest.mark.parametrize("seed", range(10))
    def test_boss_has_no_outgoing_connections(self, seed):
        rooms = generate_dungeon_graph("The Shadow", 3, 5, seed=seed)
        assert rooms[-1].connections == []

    @pytest.mark.parametrize("seed", range(10))
    def test_layer_widths_between_1_and_3(self, seed):
        rooms = generate_dungeon_graph("The Shadow", 3, 5, seed=seed)
        depths = {}
        for room in rooms:
            depths.setdefault(room.depth, []).append(room)
        for depth, layer_rooms in depths.items():
            if depth == 0:  # entrance always 1
                assert len(layer_rooms) == 1
            elif rooms[-1].depth == depth:  # boss always 1
                assert len(layer_rooms) == 1
            else:  # content layers: 1-3
                assert 1 <= len(layer_rooms) <= 3, f"Depth {depth}: {len(layer_rooms)} rooms"

    @pytest.mark.parametrize("seed", range(10))
    def test_first_layer_revealed(self, seed):
        """Entrance and layer 1 rooms should be revealed."""
        rooms = generate_dungeon_graph("The Shadow", 3, 5, seed=seed)
        for room in rooms:
            if room.depth <= 1:
                assert room.revealed is True, f"Room {room.index} (depth {room.depth}) not revealed"


# ── Review #18: Rest room guarantee ──────────────────────────────────────


class TestRestRoomGuarantee:
    """Review #18: At least 1 rest room near 60% of depth."""

    @pytest.mark.parametrize("seed", range(20))
    def test_rest_room_exists(self, seed):
        rooms = generate_dungeon_graph("The Shadow", 3, 5, seed=seed)
        content_rooms = [r for r in rooms if r.room_type not in ("entrance", "boss")]
        rest_rooms = [r for r in content_rooms if r.room_type == "rest"]
        assert len(rest_rooms) >= 1, f"No rest rooms found (seed={seed})"

    @pytest.mark.parametrize("seed", range(20))
    def test_rest_room_near_midpoint(self, seed):
        """At least one rest room should be near 60% depth."""
        depth = 5
        rooms = generate_dungeon_graph("The Shadow", 3, depth, seed=seed)
        mid_depth = max(1, int(depth * 0.6))  # = 3
        rest_rooms = [r for r in rooms if r.room_type == "rest"]
        # At least one rest room should be within ±1 of mid_depth
        assert any(
            abs(r.depth - mid_depth) <= 1 for r in rest_rooms
        ), f"No rest room near depth {mid_depth} (found at depths {[r.depth for r in rest_rooms]})"


# ── Review #8: Exit room constraints ─────────────────────────────────────


class TestExitRoomConstraints:
    """Review #8: Exit rooms only at depth >= 3, Tier 1 loot only."""

    @pytest.mark.parametrize("seed", range(20))
    def test_no_exit_before_depth_3(self, seed):
        rooms = generate_dungeon_graph("The Shadow", 3, 5, seed=seed)
        for room in rooms:
            if room.room_type == "exit":
                assert room.depth >= 3, f"Exit room at depth {room.depth} (must be >= 3)"

    @pytest.mark.parametrize("seed", range(20))
    def test_exit_rooms_tier_1_loot(self, seed):
        rooms = generate_dungeon_graph("The Shadow", 3, 5, seed=seed)
        for room in rooms:
            if room.room_type == "exit":
                assert room.loot_tier == 1, f"Exit room has loot tier {room.loot_tier}, expected 1"


# ── Loot tier assignments ────────────────────────────────────────────────


class TestLootTierAssignment:
    @pytest.mark.parametrize("seed", range(10))
    def test_boss_room_tier_3(self, seed):
        rooms = generate_dungeon_graph("The Shadow", 3, 5, seed=seed)
        assert rooms[-1].loot_tier == 3

    @pytest.mark.parametrize("seed", range(10))
    def test_entrance_no_loot(self, seed):
        rooms = generate_dungeon_graph("The Shadow", 3, 5, seed=seed)
        assert rooms[0].loot_tier == 0

    @pytest.mark.parametrize("seed", range(10))
    def test_elite_rooms_tier_2(self, seed):
        rooms = generate_dungeon_graph("The Shadow", 3, 5, seed=seed)
        for room in rooms:
            if room.room_type == "elite":
                assert room.loot_tier == 2

    @pytest.mark.parametrize("seed", range(10))
    def test_rest_rooms_no_loot(self, seed):
        rooms = generate_dungeon_graph("The Shadow", 3, 5, seed=seed)
        for room in rooms:
            if room.room_type == "rest":
                assert room.loot_tier == 0


# ── Seed reproducibility ─────────────────────────────────────────────────


class TestSeedReproducibility:
    def test_same_seed_same_graph(self):
        rooms_a = generate_dungeon_graph("The Shadow", 3, 5, seed=42)
        rooms_b = generate_dungeon_graph("The Shadow", 3, 5, seed=42)
        assert len(rooms_a) == len(rooms_b)
        for a, b in zip(rooms_a, rooms_b, strict=True):
            assert a.index == b.index
            assert a.depth == b.depth
            assert a.room_type == b.room_type
            assert a.connections == b.connections

    def test_different_seeds_different_graphs(self):
        rooms_a = generate_dungeon_graph("The Shadow", 3, 5, seed=42)
        rooms_b = generate_dungeon_graph("The Shadow", 3, 5, seed=99)
        # At least room types should differ (overwhelmingly likely)
        types_a = [r.room_type for r in rooms_a]
        types_b = [r.room_type for r in rooms_b]
        assert types_a != types_b or len(rooms_a) != len(rooms_b)


# ── Difficulty scaling ────────────────────────────────────────────────────


class TestDifficultyScaling:
    def test_higher_difficulty_can_widen_layers(self):
        """Difficulty 5 graphs may have more rooms than difficulty 1."""
        rooms_easy = generate_dungeon_graph("The Shadow", 1, 4, seed=42)
        rooms_hard = generate_dungeon_graph("The Shadow", 5, 7, seed=42)
        # Hard has deeper depth, so definitely more rooms
        assert len(rooms_hard) > len(rooms_easy)

    @pytest.mark.parametrize("difficulty", range(1, 6))
    def test_minimum_rooms(self, difficulty):
        """At minimum: entrance + 1 room per layer + boss."""
        depth = {1: 4, 2: 5, 3: 5, 4: 6, 5: 7}[difficulty]
        rooms = generate_dungeon_graph("The Shadow", difficulty, depth, seed=42)
        # entrance + (depth-1) content layers (min 1 each) + boss = depth + 1
        assert len(rooms) >= depth + 1


# ── Edge cases ────────────────────────────────────────────────────────────


class TestEdgeCases:
    def test_minimum_depth_2(self):
        """Depth 2 = entrance + 1 content layer + boss."""
        rooms = generate_dungeon_graph("The Shadow", 1, 2, seed=42)
        assert rooms[0].room_type == "entrance"
        assert rooms[-1].room_type == "boss"
        content = [r for r in rooms if r.room_type not in ("entrance", "boss")]
        assert len(content) >= 1

    def test_unknown_archetype_falls_back_to_shadow(self):
        """Unknown archetype should use Shadow distribution as fallback."""
        rooms = generate_dungeon_graph("Nonexistent", 3, 5, seed=42)
        assert rooms[0].room_type == "entrance"
        assert rooms[-1].room_type == "boss"
        assert len(rooms) > 2

    def test_no_seed_still_valid(self):
        """Graph without seed should still satisfy invariants."""
        rooms = generate_dungeon_graph("The Shadow", 3, 5)
        assert rooms[0].room_type == "entrance"
        assert rooms[-1].room_type == "boss"
        reachable = _reachable_from_entrance(rooms)
        assert reachable == {r.index for r in rooms}
