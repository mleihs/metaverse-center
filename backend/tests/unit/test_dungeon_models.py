"""Tests for backend.models.resonance_dungeon — Pydantic validation & serialization.

Covers:
  - DungeonRunCreate: party size 2-4, difficulty 1-5, archetype Literal
  - DungeonMoveRequest: room_index >= 0
  - CombatSubmission: actions min_length=1
  - ScoutRequest / RestRequest: required fields
  - DungeonAction: action_type Literal
  - RoomNode: default values
  - DungeonInstance: to_checkpoint / restore_from_checkpoint round-trip
  - Client state models: fog-of-war schemas
"""

from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from backend.models.combat import AgentCombatState, CombatState, EnemyInstance
from backend.models.resonance_dungeon import (
    CombatAction,
    CombatSubmission,
    DungeonAction,
    DungeonClientState,
    DungeonInstance,
    DungeonMoveRequest,
    DungeonRunCreate,
    RestRequest,
    RoomNode,
    RoomNodeClient,
    ScoutRequest,
)

# ── Helpers ───────────────────────────────────────────────────────────────


def _make_agent(name: str = "Agent", stress: int = 0, condition: str = "operational") -> AgentCombatState:
    return AgentCombatState(
        agent_id=uuid4(),
        agent_name=name,
        stress=stress,
        condition=condition,
        aptitudes={"spy": 5, "guardian": 3},
        personality={"openness": 0.7, "neuroticism": 0.3},
    )


def _make_rooms(count: int = 5) -> list[RoomNode]:
    """Generate a simple linear dungeon graph for testing."""
    types = ["entrance", "combat", "encounter", "rest", "boss"]
    rooms = []
    for i in range(count):
        room = RoomNode(
            index=i,
            depth=i,
            room_type=types[i % len(types)],
            connections=[i + 1] if i < count - 1 else [],
            cleared=i == 0,
            revealed=i <= 1,
            loot_tier=min(i, 3),
        )
        if i > 0:
            room.connections = [i - 1] + ([i + 1] if i < count - 1 else [])
        rooms.append(room)
    return rooms


def _make_instance(**overrides) -> DungeonInstance:
    party = overrides.pop("party", [_make_agent("Alpha"), _make_agent("Beta")])
    rooms = overrides.pop("rooms", _make_rooms())
    defaults = {
        "run_id": uuid4(),
        "simulation_id": uuid4(),
        "archetype": "The Shadow",
        "signature": "shadow_conflict",
        "difficulty": 3,
        "rooms": rooms,
        "party": party,
        "player_ids": [uuid4()],
        "archetype_state": {"visibility": 3, "max_visibility": 3, "rooms_since_vp_loss": 0},
        "phase": "exploring",
        "depth": 1,
        "rooms_cleared": 1,
        "turn": 3,
        "used_banter_ids": ["banter_001"],
    }
    defaults.update(overrides)
    return DungeonInstance(**defaults)


# ── DungeonRunCreate ─────────────────────────────────────────────────────


class TestDungeonRunCreate:
    """Validate party size (2-4), difficulty (1-5), archetype Literal."""

    def test_valid_min_party(self):
        body = DungeonRunCreate(
            archetype="The Shadow",
            party_agent_ids=[uuid4(), uuid4()],
            difficulty=1,
        )
        assert len(body.party_agent_ids) == 2

    def test_valid_max_party(self):
        body = DungeonRunCreate(
            archetype="The Shadow",
            party_agent_ids=[uuid4() for _ in range(4)],
            difficulty=5,
        )
        assert len(body.party_agent_ids) == 4
        assert body.difficulty == 5

    def test_party_too_small(self):
        with pytest.raises(ValidationError, match="too_short"):
            DungeonRunCreate(
                archetype="The Shadow",
                party_agent_ids=[uuid4()],
            )

    def test_party_too_large(self):
        with pytest.raises(ValidationError, match="too_long"):
            DungeonRunCreate(
                archetype="The Shadow",
                party_agent_ids=[uuid4() for _ in range(5)],
            )

    def test_party_empty(self):
        with pytest.raises(ValidationError, match="too_short"):
            DungeonRunCreate(
                archetype="The Shadow",
                party_agent_ids=[],
            )

    def test_difficulty_too_low(self):
        with pytest.raises(ValidationError, match="greater_than_equal"):
            DungeonRunCreate(
                archetype="The Shadow",
                party_agent_ids=[uuid4(), uuid4()],
                difficulty=0,
            )

    def test_difficulty_too_high(self):
        with pytest.raises(ValidationError, match="less_than_equal"):
            DungeonRunCreate(
                archetype="The Shadow",
                party_agent_ids=[uuid4(), uuid4()],
                difficulty=6,
            )

    def test_difficulty_default(self):
        body = DungeonRunCreate(
            archetype="The Shadow",
            party_agent_ids=[uuid4(), uuid4()],
        )
        assert body.difficulty == 1

    def test_invalid_archetype(self):
        with pytest.raises(ValidationError):
            DungeonRunCreate(
                archetype="The Invalid",
                party_agent_ids=[uuid4(), uuid4()],
            )

    @pytest.mark.parametrize(
        "archetype",
        [
            "The Tower",
            "The Shadow",
            "The Devouring Mother",
            "The Deluge",
            "The Overthrow",
            "The Prometheus",
            "The Awakening",
            "The Entropy",
        ],
    )
    def test_all_valid_archetypes(self, archetype):
        body = DungeonRunCreate(
            archetype=archetype,
            party_agent_ids=[uuid4(), uuid4()],
        )
        assert body.archetype == archetype


# ── DungeonMoveRequest ───────────────────────────────────────────────────


class TestDungeonMoveRequest:
    """Validate room_index >= 0."""

    def test_valid_zero(self):
        req = DungeonMoveRequest(room_index=0)
        assert req.room_index == 0

    def test_valid_positive(self):
        req = DungeonMoveRequest(room_index=42)
        assert req.room_index == 42

    def test_negative_rejected(self):
        with pytest.raises(ValidationError, match="greater_than_equal"):
            DungeonMoveRequest(room_index=-1)


# ── CombatSubmission ─────────────────────────────────────────────────────


class TestCombatSubmission:
    """Validate actions min_length=1."""

    def test_valid_single_action(self):
        sub = CombatSubmission(
            actions=[CombatAction(agent_id=uuid4(), ability_id="spy_observe")]
        )
        assert len(sub.actions) == 1

    def test_valid_multiple_actions(self):
        sub = CombatSubmission(
            actions=[
                CombatAction(agent_id=uuid4(), ability_id="spy_observe"),
                CombatAction(agent_id=uuid4(), ability_id="guardian_shield", target_id="enemy_1"),
            ]
        )
        assert len(sub.actions) == 2

    def test_empty_actions_allowed(self):
        """Empty actions = auto-defend all agents (timer expiry scenario)."""
        sub = CombatSubmission(actions=[])
        assert len(sub.actions) == 0


# ── ScoutRequest / RestRequest ───────────────────────────────────────────


class TestScoutRequest:
    def test_valid(self):
        aid = uuid4()
        req = ScoutRequest(agent_id=aid)
        assert req.agent_id == aid

    def test_missing_agent_id(self):
        with pytest.raises(ValidationError):
            ScoutRequest()


class TestRestRequest:
    def test_valid_single(self):
        req = RestRequest(agent_ids=[uuid4()])
        assert len(req.agent_ids) == 1

    def test_valid_multiple(self):
        req = RestRequest(agent_ids=[uuid4(), uuid4()])
        assert len(req.agent_ids) == 2

    def test_empty_rejected(self):
        with pytest.raises(ValidationError, match="too_short"):
            RestRequest(agent_ids=[])


# ── DungeonAction ────────────────────────────────────────────────────────


class TestDungeonAction:
    def test_valid_encounter_choice(self):
        action = DungeonAction(action_type="encounter_choice", choice_id="choice_1")
        assert action.action_type == "encounter_choice"

    def test_valid_combat_action(self):
        action = DungeonAction(
            action_type="combat_action",
            agent_id=uuid4(),
            ability_id="spy_observe",
            target_id="enemy_1",
        )
        assert action.action_type == "combat_action"

    def test_invalid_action_type(self):
        with pytest.raises(ValidationError):
            DungeonAction(action_type="invalid_type")

    @pytest.mark.parametrize(
        "action_type",
        ["encounter_choice", "combat_action", "interact", "use_ability"],
    )
    def test_all_valid_action_types(self, action_type):
        action = DungeonAction(action_type=action_type)
        assert action.action_type == action_type


# ── RoomNode Defaults ────────────────────────────────────────────────────


class TestRoomNode:
    def test_defaults(self):
        room = RoomNode(index=0, depth=0, room_type="entrance")
        assert room.connections == []
        assert room.cleared is False
        assert room.revealed is False
        assert room.encounter_template_id is None
        assert room.loot_tier == 0

    def test_explicit_values(self):
        room = RoomNode(
            index=5,
            depth=3,
            room_type="boss",
            connections=[4, 6],
            cleared=True,
            revealed=True,
            encounter_template_id="enc_boss_01",
            loot_tier=3,
        )
        assert room.index == 5
        assert room.depth == 3
        assert room.room_type == "boss"
        assert room.connections == [4, 6]
        assert room.cleared is True
        assert room.loot_tier == 3


# ── DungeonInstance Checkpoint Round-Trip ────────────────────────────────


class TestCheckpointRoundTrip:
    """to_checkpoint() → restore_from_checkpoint() must preserve all mutable state."""

    def test_basic_round_trip(self):
        instance = _make_instance()
        checkpoint = instance.to_checkpoint()

        # Create a fresh instance with same static data
        restored = _make_instance(
            run_id=instance.run_id,
            simulation_id=instance.simulation_id,
            rooms=_make_rooms(),
            party=[],
            phase="exploring",
            depth=0,
            rooms_cleared=0,
            turn=0,
            used_banter_ids=[],
            archetype_state={},
        )
        restored.restore_from_checkpoint(checkpoint)

        assert restored.current_room == instance.current_room
        assert restored.phase == instance.phase
        assert restored.depth == instance.depth
        assert restored.rooms_cleared == instance.rooms_cleared
        assert restored.turn == instance.turn
        assert restored.used_banter_ids == instance.used_banter_ids
        assert restored.archetype_state == instance.archetype_state

    def test_party_state_preserved(self):
        agent = _make_agent("Checkpoint Agent", stress=350, condition="wounded")
        instance = _make_instance(party=[agent])
        checkpoint = instance.to_checkpoint()

        restored = _make_instance(party=[], rooms=instance.rooms)
        restored.restore_from_checkpoint(checkpoint)

        assert len(restored.party) == 1
        assert restored.party[0].agent_name == "Checkpoint Agent"
        assert restored.party[0].stress == 350
        assert restored.party[0].condition == "wounded"

    def test_combat_state_preserved(self):
        enemy = EnemyInstance(
            instance_id="enemy_1",
            template_id="shadow_whisper",
            name_en="Shadow Whisper",
            name_de="Schattenfluesterer",
            condition_steps_remaining=4,
            condition_steps_max=4,
            threat_level="standard",
            stress_resistance=10,
            evasion=5,
        )
        combat = CombatState(
            round_num=3,
            max_rounds=10,
            enemies=[enemy],
            phase="planning",
            is_ambush=True,
        )
        instance = _make_instance(combat=combat)
        checkpoint = instance.to_checkpoint()

        restored = _make_instance(combat=None, rooms=instance.rooms, party=[])
        restored.restore_from_checkpoint(checkpoint)

        assert restored.combat is not None
        assert restored.combat.round_num == 3
        assert restored.combat.is_ambush is True
        assert len(restored.combat.enemies) == 1
        assert restored.combat.enemies[0].instance_id == "enemy_1"
        assert restored.combat.enemies[0].condition_steps_remaining == 4

    def test_no_combat_preserved_as_none(self):
        instance = _make_instance(combat=None)
        checkpoint = instance.to_checkpoint()

        restored = _make_instance(rooms=instance.rooms, party=[])
        restored.restore_from_checkpoint(checkpoint)

        assert restored.combat is None

    def test_room_cleared_flags_preserved(self):
        rooms = _make_rooms(5)
        rooms[0].cleared = True
        rooms[2].cleared = True
        rooms[1].cleared = False
        rooms[3].cleared = False
        rooms[4].cleared = False
        instance = _make_instance(rooms=rooms)

        checkpoint = instance.to_checkpoint()

        # Fresh rooms — all cleared=False except entrance
        fresh_rooms = _make_rooms(5)
        for r in fresh_rooms:
            r.cleared = False
            r.revealed = False
        restored = _make_instance(rooms=fresh_rooms, party=[])
        restored.restore_from_checkpoint(checkpoint)

        assert restored.rooms[0].cleared is True
        assert restored.rooms[1].cleared is False
        assert restored.rooms[2].cleared is True
        assert restored.rooms[3].cleared is False
        assert restored.rooms[4].cleared is False

    def test_room_revealed_flags_preserved(self):
        rooms = _make_rooms(5)
        rooms[0].revealed = True
        rooms[1].revealed = True
        rooms[2].revealed = True
        rooms[3].revealed = False
        rooms[4].revealed = False
        instance = _make_instance(rooms=rooms)

        checkpoint = instance.to_checkpoint()

        fresh_rooms = _make_rooms(5)
        for r in fresh_rooms:
            r.revealed = False
        restored = _make_instance(rooms=fresh_rooms, party=[])
        restored.restore_from_checkpoint(checkpoint)

        assert restored.rooms[0].revealed is True
        assert restored.rooms[1].revealed is True
        assert restored.rooms[2].revealed is True
        assert restored.rooms[3].revealed is False
        assert restored.rooms[4].revealed is False

    def test_banter_ids_preserved(self):
        instance = _make_instance(used_banter_ids=["b1", "b2", "b3"])
        checkpoint = instance.to_checkpoint()

        restored = _make_instance(rooms=instance.rooms, party=[], used_banter_ids=[])
        restored.restore_from_checkpoint(checkpoint)

        assert restored.used_banter_ids == ["b1", "b2", "b3"]

    def test_checkpoint_keys(self):
        """Verify all expected keys are present in checkpoint dict."""
        instance = _make_instance()
        checkpoint = instance.to_checkpoint()

        expected_keys = {
            "current_room",
            "party",
            "combat",
            "archetype_state",
            "phase",
            "depth",
            "rooms_cleared",
            "turn",
            "room_cleared_flags",
            "room_revealed_flags",
            "used_banter_ids",
            "phase_timer",
            "loot_assignments",
            "auto_apply_loot",
            "pending_loot",
        }
        assert set(checkpoint.keys()) == expected_keys

    def test_restore_with_missing_optional_keys(self):
        """Older checkpoints may lack new fields — defaults must be safe."""
        minimal_checkpoint = {
            "current_room": 2,
            "party": [],
            "combat": None,
            "phase": "exploring",
            "depth": 2,
            "rooms_cleared": 2,
        }
        instance = _make_instance()
        instance.restore_from_checkpoint(minimal_checkpoint)

        assert instance.current_room == 2
        assert instance.turn == 0  # defaults via .get()
        assert instance.used_banter_ids == []
        assert instance.archetype_state == {}

    def test_uuid_in_party_model_dump(self):
        """Gotcha #2: model_dump() preserves UUID objects, not strings."""
        agent = _make_agent()
        dumped = agent.model_dump()
        assert isinstance(dumped["agent_id"], UUID)


# ── Client State Models ──────────────────────────────────────────────────


class TestClientStateModels:
    """Verify fog-of-war schema shapes."""

    def test_room_node_client_unrevealed(self):
        room = RoomNodeClient(
            index=3,
            depth=2,
            room_type="?",
            connections=[],
            cleared=False,
            revealed=False,
        )
        assert room.room_type == "?"
        assert room.connections == []
        assert room.current is False

    def test_room_node_client_revealed(self):
        room = RoomNodeClient(
            index=1,
            depth=1,
            room_type="combat",
            connections=[0, 2],
            cleared=True,
            revealed=True,
            current=True,
        )
        assert room.room_type == "combat"
        assert room.current is True

    def test_dungeon_client_state_minimal(self):
        state = DungeonClientState(
            run_id=uuid4(),
            archetype="The Shadow",
            signature="shadow_conflict",
            difficulty=3,
            depth=1,
            current_room=1,
        )
        assert state.rooms == []
        assert state.party == []
        assert state.combat is None
        assert state.phase == "exploring"


# ══════════════════════════════════════════════════════════════════════════
# ── Tower Archetype State ─────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════


class TestTowerArchetypeState:
    """Tower-specific archetype_state initialization and checkpoint round-trip."""

    def test_tower_instance_valid(self):
        """Tower archetype creates a valid DungeonInstance."""
        instance = _make_instance(
            archetype="The Tower",
            signature="economic_tremor",
            archetype_state={"stability": 100, "max_stability": 100},
        )
        assert instance.archetype == "The Tower"
        assert instance.signature == "economic_tremor"

    def test_tower_archetype_state_has_stability(self):
        """Tower archetype_state has 'stability' and 'max_stability' keys."""
        instance = _make_instance(
            archetype="The Tower",
            signature="economic_tremor",
            archetype_state={"stability": 100, "max_stability": 100},
        )
        assert "stability" in instance.archetype_state
        assert "max_stability" in instance.archetype_state

    def test_tower_archetype_state_round_trip(self):
        """Tower archetype_state survives checkpoint round-trip."""
        tower_state = {"stability": 75, "max_stability": 100}
        instance = _make_instance(
            archetype="The Tower",
            signature="economic_tremor",
            archetype_state=tower_state,
        )
        checkpoint = instance.to_checkpoint()

        restored = _make_instance(
            archetype="The Tower",
            signature="economic_tremor",
            rooms=instance.rooms,
            party=[],
            archetype_state={},
        )
        restored.restore_from_checkpoint(checkpoint)

        assert restored.archetype_state == tower_state
        assert restored.archetype_state["stability"] == 75
        assert restored.archetype_state["max_stability"] == 100

    def test_tower_client_state(self):
        """Tower DungeonClientState creates valid."""
        state = DungeonClientState(
            run_id=uuid4(),
            archetype="The Tower",
            signature="economic_tremor",
            difficulty=3,
            depth=1,
            current_room=1,
        )
        assert state.archetype == "The Tower"
        assert state.signature == "economic_tremor"
