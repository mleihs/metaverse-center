"""Integration tests for DungeonEngineService — the core async orchestrator.

Covers all public classmethods and key private methods:
  - create_run: party validation, RPC, graph generation, archetype_state
  - move_to_room: adjacency, room reveal, ambient stress, room types
  - submit_combat_actions: planning phase, action storage, auto-resolve
  - handle_encounter_choice: skill check delegation, effect application
  - scout: spy validation, VP restore, room reveal
  - rest: rest site validation, stress heal, condition recovery, ambush
  - retreat: status update, partial loot via RPC
  - get_available_dungeons: VIEW query
  - recover_from_checkpoint: DB restore, graph + mutable state
  - get_client_state / _build_client_state: fog-of-war filtering
  - _apply_shadow_visibility: VP cost per 2 rooms
  - _enter_combat_room / _enter_interactive_room (encounter/rest/treasure)
  - EnemyInstance.condition_display: percentage-based step→display property
  - _build_loot_items_for_rpc: loot serialization

Mock strategy:
  - Pre-populate module-level _active_instances for most tests
  - Patch _checkpoint / _log_event to no-op (except checkpoint-specific tests)
  - Use conftest.make_async_supabase_mock for Supabase chains
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from backend.models.combat import AgentCombatState, CombatState, EnemyInstance
from backend.models.resonance_dungeon import (
    CombatAction,
    CombatSubmission,
    DungeonAction,
    DungeonInstance,
    DungeonRunCreate,
    LootItem,
    RoomNode,
)
from backend.services.dungeon_engine_service import (
    COMBAT_PLANNING_TIMEOUT_MS,
    INSTANCE_TTL_SECONDS,
    MAX_CONCURRENT_PER_SIM,
    DungeonEngineService,
    _active_instances,
    _combat_timers,
)
from backend.tests.conftest import make_async_supabase_mock, make_chain_mock

# ── Helpers ───────────────────────────────────────────────────────────────


def _make_agent(
    name: str = "Agent",
    stress: int = 0,
    condition: str = "operational",
    aptitudes: dict | None = None,
    personality: dict | None = None,
) -> AgentCombatState:
    return AgentCombatState(
        agent_id=uuid4(),
        agent_name=name,
        stress=stress,
        condition=condition,
        aptitudes=aptitudes or {"spy": 5, "guardian": 3},
        personality=personality or {"openness": 0.7, "neuroticism": 0.3},
        resilience=0.5,
    )


def _make_rooms(count: int = 8) -> list[RoomNode]:
    """Build a simple linear dungeon: entrance → combat → encounter → rest → treasure → combat → elite → boss."""
    room_types = ["entrance", "combat", "encounter", "rest", "treasure", "combat", "elite", "boss"]
    rooms = []
    for i in range(count):
        rtype = room_types[i] if i < len(room_types) else "combat"
        conns = []
        if i > 0:
            conns.append(i - 1)
        if i < count - 1:
            conns.append(i + 1)
        rooms.append(
            RoomNode(
                index=i,
                depth=i,
                room_type=rtype,
                connections=conns,
                cleared=i == 0,
                revealed=i <= 1,
                loot_tier=min(i, 3),
            )
        )
    return rooms


def _make_instance(
    run_id: UUID | None = None,
    phase: str = "exploring",
    current_room: int = 0,
    archetype: str = "The Shadow",
    **overrides,
) -> DungeonInstance:
    rid = run_id or uuid4()
    party = overrides.pop("party", [_make_agent("Alpha"), _make_agent("Beta")])
    rooms = overrides.pop("rooms", _make_rooms())
    defaults = {
        "run_id": rid,
        "simulation_id": uuid4(),
        "archetype": archetype,
        "signature": "shadow_conflict",
        "difficulty": 3,
        "rooms": rooms,
        "party": party,
        "player_ids": [uuid4()],
        "archetype_state": {"visibility": 3, "max_visibility": 3, "rooms_since_vp_loss": 0},
        "phase": phase,
        "depth": current_room,
        "rooms_cleared": 1,
        "turn": 0,
        "current_room": current_room,
    }
    defaults.update(overrides)
    return DungeonInstance(**defaults)


def _register_instance(instance: DungeonInstance) -> None:
    """Put instance into module-level dict."""
    _active_instances[str(instance.run_id)] = instance


def _cleanup_instance(run_id: UUID) -> None:
    _active_instances.pop(str(run_id), None)


def _make_mock_supabase():
    return make_async_supabase_mock()


def _make_enemy(instance_id: str = "enemy_1", steps: int = 4, max_steps: int | None = None) -> EnemyInstance:
    return EnemyInstance(
        instance_id=instance_id,
        template_id="shadow_whisper",
        name_en="Shadow Whisper",
        name_de="Schattenfluesterer",
        condition_steps_remaining=steps,
        condition_steps_max=max_steps if max_steps is not None else steps,
        threat_level="standard",
        stress_resistance=10,
        evasion=5,
    )


# ── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _clean_instances():
    """Ensure module-level state is clean before/after every test."""
    _active_instances.clear()
    _combat_timers.clear()
    yield
    _active_instances.clear()
    _combat_timers.clear()


@pytest.fixture()
def noop_checkpoint():
    """Patch _checkpoint and _log_event to async no-ops."""
    with (
        patch.object(DungeonEngineService, "_checkpoint", new_callable=AsyncMock) as cp,
        patch.object(DungeonEngineService, "_log_event", new_callable=AsyncMock) as le,
    ):
        yield cp, le


@pytest.fixture()
def noop_timer():
    """Patch _start_combat_timer to async no-op."""
    with patch.object(DungeonEngineService, "_start_combat_timer", new_callable=AsyncMock) as t:
        yield t


# ── Constants ────────────────────────────────────────────────────────────


class TestConstants:
    def test_max_concurrent_per_sim(self):
        assert MAX_CONCURRENT_PER_SIM == 1

    def test_instance_ttl(self):
        assert INSTANCE_TTL_SECONDS == 1800

    def test_combat_planning_timeout(self):
        assert COMBAT_PLANNING_TIMEOUT_MS == 30_000


# ── _get_instance ────────────────────────────────────────────────────────


class TestGetInstance:
    @pytest.mark.asyncio
    async def test_found(self):
        instance = _make_instance()
        _register_instance(instance)
        result = await DungeonEngineService._get_instance(instance.run_id)
        assert result is instance

    @pytest.mark.asyncio
    async def test_not_found_raises_404(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await DungeonEngineService._get_instance(uuid4())
        assert exc_info.value.status_code == 404


# ── EnemyInstance.condition_display ──────────────────────────────────────


class TestEnemyConditionDisplay:
    """Percentage-based condition display: ratio = remaining / max.

    Property lives on EnemyInstance (tell-don't-ask), not on the service.
    """

    @pytest.mark.parametrize(
        ("remaining", "max_steps", "expected"),
        [
            # Full health → healthy (ratio 1.0)
            (6, 6, "healthy"),
            (1, 1, "healthy"),
            (3, 3, "healthy"),
            # >60% → healthy
            (4, 6, "healthy"),
            (5, 6, "healthy"),
            # 31-60% → damaged
            (3, 6, "damaged"),
            (2, 6, "damaged"),
            (2, 5, "damaged"),
            # 1-30% → critical
            (1, 6, "critical"),
            (1, 4, "critical"),
            # 0 → defeated
            (0, 6, "defeated"),
            (0, 1, "defeated"),
        ],
    )
    def test_display_mapping(self, remaining, max_steps, expected):
        enemy = _make_enemy(steps=remaining, max_steps=max_steps)
        assert enemy.condition_display == expected


# ── _apply_shadow_visibility ─────────────────────────────────────────────


class TestApplyShadowVisibility:
    """VP cost per 2 rooms entered (Review #7)."""

    def test_first_room_no_loss(self):
        instance = _make_instance()
        instance.archetype_state = {"visibility": 3, "rooms_since_vp_loss": 0}
        DungeonEngineService._apply_shadow_visibility(instance)
        assert instance.archetype_state["visibility"] == 3
        assert instance.archetype_state["rooms_since_vp_loss"] == 1

    def test_second_room_loses_1_vp(self):
        instance = _make_instance()
        instance.archetype_state = {"visibility": 3, "rooms_since_vp_loss": 1}
        DungeonEngineService._apply_shadow_visibility(instance)
        assert instance.archetype_state["visibility"] == 2
        assert instance.archetype_state["rooms_since_vp_loss"] == 0

    def test_four_rooms_loses_2_vp(self):
        instance = _make_instance()
        instance.archetype_state = {"visibility": 3, "rooms_since_vp_loss": 0}
        for _ in range(4):
            DungeonEngineService._apply_shadow_visibility(instance)
        assert instance.archetype_state["visibility"] == 1

    def test_cannot_go_below_zero(self):
        instance = _make_instance()
        instance.archetype_state = {"visibility": 0, "rooms_since_vp_loss": 1}
        DungeonEngineService._apply_shadow_visibility(instance)
        assert instance.archetype_state["visibility"] == 0

    def test_six_rooms_from_max_reaches_zero(self):
        instance = _make_instance()
        instance.archetype_state = {"visibility": 3, "rooms_since_vp_loss": 0}
        for _ in range(6):
            DungeonEngineService._apply_shadow_visibility(instance)
        assert instance.archetype_state["visibility"] == 0


# ── _build_client_state ──────────────────────────────────────────────────


class TestBuildClientState:
    """Fog-of-war filtering: unrevealed rooms show as '?', enemy stats hidden."""

    def test_unrevealed_rooms_show_question_mark(self):
        rooms = _make_rooms()
        rooms[0].revealed = True
        rooms[1].revealed = True
        rooms[2].revealed = False
        instance = _make_instance(rooms=rooms)
        _register_instance(instance)

        state = DungeonEngineService._build_client_state(instance)
        assert state.rooms[0].room_type == "entrance"
        assert state.rooms[1].room_type == "combat"
        assert state.rooms[2].room_type == "?"

    def test_unrevealed_rooms_have_empty_connections(self):
        rooms = _make_rooms()
        rooms[3].revealed = False
        instance = _make_instance(rooms=rooms)

        state = DungeonEngineService._build_client_state(instance)
        assert state.rooms[3].connections == []

    def test_current_room_marker(self):
        instance = _make_instance(current_room=2)
        state = DungeonEngineService._build_client_state(instance)
        assert state.rooms[2].current is True
        assert state.rooms[0].current is False

    def test_party_abilities_populated(self):
        agent = _make_agent(aptitudes={"spy": 5, "guardian": 3})
        instance = _make_instance(party=[agent])
        state = DungeonEngineService._build_client_state(instance)

        assert len(state.party) == 1
        # spy 5 + guardian 3 should have abilities
        assert len(state.party[0].available_abilities) > 0

    def test_stress_threshold_mapping(self):
        agent_normal = _make_agent(stress=100)
        agent_tense = _make_agent(stress=300)
        agent_critical = _make_agent(stress=600)
        instance = _make_instance(party=[agent_normal, agent_tense, agent_critical])

        state = DungeonEngineService._build_client_state(instance)
        assert state.party[0].stress_threshold == "normal"
        assert state.party[1].stress_threshold == "tense"
        assert state.party[2].stress_threshold == "critical"

    def test_combat_state_filters_enemy_hp(self):
        enemy = _make_enemy(steps=5)
        combat = CombatState(enemies=[enemy], round_num=2, max_rounds=10, phase="planning")
        instance = _make_instance(phase="combat_planning", combat=combat)

        state = DungeonEngineService._build_client_state(instance)
        assert state.combat is not None
        assert len(state.combat.enemies) == 1
        # steps=5 → "healthy" (not the exact number)
        assert state.combat.enemies[0].condition_display == "healthy"
        # No condition_steps_remaining exposed
        assert not hasattr(state.combat.enemies[0], "condition_steps_remaining")

    def test_no_combat_state_when_exploring(self):
        instance = _make_instance(phase="exploring", combat=None)
        state = DungeonEngineService._build_client_state(instance)
        assert state.combat is None

    def test_archetype_state_passed_through(self):
        instance = _make_instance()
        instance.archetype_state = {"visibility": 2, "max_visibility": 3, "rooms_since_vp_loss": 1}
        state = DungeonEngineService._build_client_state(instance)
        assert state.archetype_state["visibility"] == 2


# ── get_client_state ─────────────────────────────────────────────────────


class TestGetClientState:
    @pytest.mark.asyncio
    async def test_returns_state_for_active_instance(self):
        instance = _make_instance()
        _register_instance(instance)
        state = await DungeonEngineService.get_client_state(instance.run_id)
        assert state.run_id == instance.run_id

    @pytest.mark.asyncio
    async def test_raises_404_for_unknown_run(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await DungeonEngineService.get_client_state(uuid4())
        assert exc_info.value.status_code == 404


# ── create_run ───────────────────────────────────────────────────────────


class TestCreateRun:
    @pytest.mark.asyncio
    async def test_invalid_archetype_raises_400(self, noop_checkpoint):
        mock_sb = _make_mock_supabase()
        body = DungeonRunCreate(archetype="The Shadow", party_agent_ids=[uuid4(), uuid4()], difficulty=1)
        # Patch ARCHETYPE_CONFIGS to empty
        with patch("backend.services.dungeon_engine_service.ARCHETYPE_CONFIGS", {}):
            from fastapi import HTTPException

            with pytest.raises(HTTPException) as exc_info:
                await DungeonEngineService.create_run(mock_sb, mock_sb, uuid4(), uuid4(), body)
            assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_party_mismatch_raises_400(self, noop_checkpoint):
        """RPC returns fewer agents than requested → 400."""
        mock_sb = _make_mock_supabase()
        # RPC returns only 1 agent but we requested 2
        rpc_chain = make_chain_mock(execute_data=[
            {"id": str(uuid4()), "name": "Agent A", "aptitudes": {"spy": 5}, "personality": {}, "stress_level": 0, "mood_score": 0, "resilience": 0.5},
        ])
        mock_sb.rpc.return_value = rpc_chain

        body = DungeonRunCreate(archetype="The Shadow", party_agent_ids=[uuid4(), uuid4()], difficulty=1)
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await DungeonEngineService.create_run(mock_sb, mock_sb, uuid4(), uuid4(), body)
        assert exc_info.value.status_code == 400
        assert "not found" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_successful_creation(self, noop_checkpoint, noop_timer):
        """Full happy path: RPC → graph → DB insert → in-memory → checkpoint."""
        admin_sb = MagicMock()
        user_sb = MagicMock()

        agent1_id = uuid4()
        agent2_id = uuid4()
        run_id = uuid4()
        sim_id = uuid4()
        user_id = uuid4()

        # Mock RPC for party data
        rpc_chain = make_chain_mock(execute_data=[
            {
                "id": str(agent1_id),
                "name": "Agent Alpha",
                "portrait_url": None,
                "aptitudes": {"spy": 5, "guardian": 3},
                "personality": {"openness": 0.7},
                "stress_level": 50,
                "mood_score": 10,
                "resilience": 0.6,
            },
            {
                "id": str(agent2_id),
                "name": "Agent Beta",
                "portrait_url": None,
                "aptitudes": {"propagandist": 4},
                "personality": {"neuroticism": 0.8},
                "stress_level": 0,
                "mood_score": -5,
                "resilience": 0.4,
            },
        ])
        admin_sb.rpc.return_value = rpc_chain

        # Mock table insert for run creation
        now = datetime.now(UTC).isoformat()
        insert_chain = make_chain_mock(execute_data=[{
            "id": str(run_id),
            "simulation_id": str(sim_id),
            "archetype": "The Shadow",
            "resonance_signature": "shadow_conflict",
            "party_agent_ids": [str(agent1_id), str(agent2_id)],
            "party_player_ids": [str(user_id)],
            "difficulty": 3,
            "depth_target": 5,
            "current_depth": 0,
            "rooms_cleared": 0,
            "rooms_total": 8,
            "status": "exploring",
            "outcome": None,
            "completed_at": None,
            "created_at": now,
        }])
        admin_sb.table.return_value = insert_chain

        body = DungeonRunCreate(
            archetype="The Shadow",
            party_agent_ids=[agent1_id, agent2_id],
            difficulty=3,
        )

        result = await DungeonEngineService.create_run(admin_sb, user_sb, sim_id, user_id, body)

        # Verify result structure
        assert "run" in result
        assert "state" in result
        assert result["run"]["archetype"] == "The Shadow"

        # Verify instance registered in memory
        assert str(run_id) in _active_instances
        instance = _active_instances[str(run_id)]
        assert instance.archetype == "The Shadow"
        assert instance.difficulty == 3
        assert len(instance.party) == 2
        assert instance.party[0].agent_name == "Agent Alpha"
        assert instance.party[0].stress == 50

    @pytest.mark.asyncio
    async def test_shadow_archetype_state_initialized(self, noop_checkpoint, noop_timer):
        """Shadow archetype starts with visibility mechanic state."""
        admin_sb = MagicMock()
        user_sb = MagicMock()
        agent1_id = uuid4()
        agent2_id = uuid4()
        run_id = uuid4()
        sim_id = uuid4()

        rpc_chain = make_chain_mock(execute_data=[
            {"id": str(agent1_id), "name": "A", "aptitudes": {}, "personality": {}, "stress_level": 0, "mood_score": 0, "resilience": 0.5},
            {"id": str(agent2_id), "name": "B", "aptitudes": {}, "personality": {}, "stress_level": 0, "mood_score": 0, "resilience": 0.5},
        ])
        admin_sb.rpc.return_value = rpc_chain

        now = datetime.now(UTC).isoformat()
        insert_chain = make_chain_mock(execute_data=[{
            "id": str(run_id), "simulation_id": str(sim_id), "archetype": "The Shadow",
            "resonance_signature": "shadow_conflict", "party_agent_ids": [str(agent1_id), str(agent2_id)],
            "party_player_ids": [], "difficulty": 1, "depth_target": 4, "current_depth": 0,
            "rooms_cleared": 0, "rooms_total": 6, "status": "exploring", "outcome": None,
            "completed_at": None, "created_at": now,
        }])
        admin_sb.table.return_value = insert_chain

        body = DungeonRunCreate(archetype="The Shadow", party_agent_ids=[agent1_id, agent2_id], difficulty=1)
        await DungeonEngineService.create_run(admin_sb, user_sb, sim_id, uuid4(), body)

        instance = _active_instances[str(run_id)]
        assert "visibility" in instance.archetype_state
        assert instance.archetype_state["visibility"] == 3
        assert instance.archetype_state["max_visibility"] == 3
        assert instance.archetype_state["rooms_since_vp_loss"] == 0


# ── move_to_room ─────────────────────────────────────────────────────────


class TestMoveToRoom:
    @pytest.mark.asyncio
    async def test_wrong_phase_raises_400(self, noop_checkpoint):
        instance = _make_instance(phase="combat_planning")
        _register_instance(instance)
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await DungeonEngineService.move_to_room(_make_mock_supabase(), instance.run_id, 1)
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_non_adjacent_room_raises_400(self, noop_checkpoint):
        instance = _make_instance(current_room=0)
        _register_instance(instance)
        from fastapi import HTTPException

        # Room 0 only connects to room 1
        with pytest.raises(HTTPException) as exc_info:
            await DungeonEngineService.move_to_room(_make_mock_supabase(), instance.run_id, 5)
        assert exc_info.value.status_code == 400
        assert "not adjacent" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_invalid_room_index_raises_400(self, noop_checkpoint):
        instance = _make_instance(current_room=0)
        # Hack: add 99 to connections so adjacency passes, but 99 >= len(rooms)
        instance.rooms[0].connections.append(99)
        _register_instance(instance)
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await DungeonEngineService.move_to_room(_make_mock_supabase(), instance.run_id, 99)
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_successful_move_updates_state(self, noop_checkpoint, noop_timer):
        instance = _make_instance(current_room=0)
        _register_instance(instance)

        with (
            patch("backend.services.dungeon_engine_service.select_encounter", return_value=None),
            patch("backend.services.dungeon_engine_service.select_banter", return_value=None),
            patch("backend.services.dungeon_engine_service.check_ambush", return_value=False),
            patch("backend.services.dungeon_engine_service.spawn_enemies", return_value=[]),
        ):
            result = await DungeonEngineService.move_to_room(_make_mock_supabase(), instance.run_id, 1)

        assert instance.current_room == 1
        assert instance.turn == 1
        assert instance.rooms[1].revealed is True
        assert "state" in result

    @pytest.mark.asyncio
    async def test_move_reveals_connected_rooms(self, noop_checkpoint, noop_timer):
        instance = _make_instance(current_room=0)
        # Room 1 connects to 0 and 2 — both should be revealed
        instance.rooms[2].revealed = False
        _register_instance(instance)

        with (
            patch("backend.services.dungeon_engine_service.select_encounter", return_value=None),
            patch("backend.services.dungeon_engine_service.select_banter", return_value=None),
            patch("backend.services.dungeon_engine_service.check_ambush", return_value=False),
            patch("backend.services.dungeon_engine_service.spawn_enemies", return_value=[]),
        ):
            await DungeonEngineService.move_to_room(_make_mock_supabase(), instance.run_id, 1)

        assert instance.rooms[2].revealed is True

    @pytest.mark.asyncio
    async def test_move_applies_ambient_stress(self, noop_checkpoint, noop_timer):
        agent = _make_agent(stress=0)
        instance = _make_instance(current_room=0, party=[agent])
        _register_instance(instance)

        with (
            patch("backend.services.dungeon_engine_service.select_encounter", return_value=None),
            patch("backend.services.dungeon_engine_service.select_banter", return_value=None),
            patch("backend.services.dungeon_engine_service.check_ambush", return_value=False),
            patch("backend.services.dungeon_engine_service.spawn_enemies", return_value=[]),
        ):
            await DungeonEngineService.move_to_room(_make_mock_supabase(), instance.run_id, 1)

        # ambient stress = 8 + 3*depth + 5*difficulty (depth=1, diff=3 → 8+3+15=26)
        assert agent.stress == 26

    @pytest.mark.asyncio
    async def test_move_captures_banter(self, noop_checkpoint, noop_timer):
        instance = _make_instance(current_room=0)
        _register_instance(instance)

        banter = {"id": "banter_test_01", "text_en": "Watch your step!", "text_de": "Pass auf!"}
        with (
            patch("backend.services.dungeon_engine_service.select_encounter", return_value=None),
            patch("backend.services.dungeon_engine_service.select_banter", return_value=banter),
            patch("backend.services.dungeon_engine_service.check_ambush", return_value=False),
            patch("backend.services.dungeon_engine_service.spawn_enemies", return_value=[]),
        ):
            result = await DungeonEngineService.move_to_room(_make_mock_supabase(), instance.run_id, 1)

        assert "banter_test_01" in instance.used_banter_ids
        assert result["banter"]["text_en"] == "Watch your step!"

    @pytest.mark.asyncio
    async def test_move_tracks_depth_increase(self, noop_checkpoint, noop_timer):
        instance = _make_instance(current_room=0)
        instance.depth = 0
        _register_instance(instance)

        with (
            patch("backend.services.dungeon_engine_service.select_encounter", return_value=None),
            patch("backend.services.dungeon_engine_service.select_banter", return_value=None),
            patch("backend.services.dungeon_engine_service.check_ambush", return_value=False),
            patch("backend.services.dungeon_engine_service.spawn_enemies", return_value=[]),
        ):
            await DungeonEngineService.move_to_room(_make_mock_supabase(), instance.run_id, 1)

        assert instance.depth == 1

    @pytest.mark.asyncio
    async def test_move_to_exit_room(self, noop_checkpoint, noop_timer):
        rooms = _make_rooms()
        rooms[1].room_type = "exit"
        instance = _make_instance(current_room=0, rooms=rooms)
        _register_instance(instance)

        with (
            patch("backend.services.dungeon_engine_service.select_banter", return_value=None),
        ):
            result = await DungeonEngineService.move_to_room(_make_mock_supabase(), instance.run_id, 1)

        assert instance.phase == "exit"
        assert result.get("exit_available") is True

    @pytest.mark.asyncio
    async def test_move_from_room_clear_phase(self, noop_checkpoint, noop_timer):
        """room_clear is also a valid phase to move from."""
        instance = _make_instance(current_room=0, phase="room_clear")
        _register_instance(instance)

        with (
            patch("backend.services.dungeon_engine_service.select_encounter", return_value=None),
            patch("backend.services.dungeon_engine_service.select_banter", return_value=None),
            patch("backend.services.dungeon_engine_service.check_ambush", return_value=False),
            patch("backend.services.dungeon_engine_service.spawn_enemies", return_value=[]),
        ):
            result = await DungeonEngineService.move_to_room(_make_mock_supabase(), instance.run_id, 1)

        assert instance.current_room == 1
        assert "state" in result

    @pytest.mark.asyncio
    async def test_captured_agents_skip_ambient_stress(self, noop_checkpoint, noop_timer):
        active_agent = _make_agent("Active", stress=0, condition="operational")
        captured_agent = _make_agent("Captured", stress=100, condition="captured")
        instance = _make_instance(current_room=0, party=[active_agent, captured_agent])
        _register_instance(instance)

        with (
            patch("backend.services.dungeon_engine_service.select_encounter", return_value=None),
            patch("backend.services.dungeon_engine_service.select_banter", return_value=None),
            patch("backend.services.dungeon_engine_service.check_ambush", return_value=False),
            patch("backend.services.dungeon_engine_service.spawn_enemies", return_value=[]),
        ):
            await DungeonEngineService.move_to_room(_make_mock_supabase(), instance.run_id, 1)

        assert active_agent.stress > 0
        assert captured_agent.stress == 100  # unchanged


# ── _enter_interactive_room (unified encounter/rest/treasure) ────────────


class TestEnterInteractiveRoom:
    """Tests for the unified _enter_interactive_room method (encounter, rest, treasure)."""

    def test_encounter_with_template(self):
        from backend.models.resonance_dungeon import EncounterChoice, EncounterTemplate

        enc = EncounterTemplate(
            id="enc_test",
            archetype="The Shadow",
            room_type="encounter",
            description_en="A mystery",
            description_de="Ein Raetsel",
            choices=[
                EncounterChoice(id="c1", label_en="Investigate", label_de="Untersuchen"),
            ],
        )
        instance = _make_instance()
        room = instance.rooms[2]  # encounter room

        with patch("backend.services.dungeon_engine_service.select_encounter", return_value=enc):
            result = DungeonEngineService._enter_interactive_room(instance, room)

        assert result["encounter"] is True
        assert result["encounter_id"] == "enc_test"
        assert instance.phase == "encounter"
        assert room.encounter_template_id == "enc_test"
        assert len(result["choices"]) == 1

    def test_encounter_without_template_clears_room(self):
        instance = _make_instance()
        room = instance.rooms[2]

        with patch("backend.services.dungeon_engine_service.select_encounter", return_value=None):
            result = DungeonEngineService._enter_interactive_room(instance, room)

        assert result["encounter"] is False
        assert instance.phase == "room_clear"
        assert room.cleared is True

    def test_rest_sets_rest_phase(self):
        instance = _make_instance()
        room = instance.rooms[3]  # rest room

        with patch("backend.services.dungeon_engine_service.select_encounter", return_value=None):
            result = DungeonEngineService._enter_interactive_room(instance, room)

        assert result["rest"] is True
        assert instance.phase == "rest"

    def test_treasure_auto_loot_without_encounter(self):
        instance = _make_instance()
        room = instance.rooms[4]  # treasure room
        initial_cleared = instance.rooms_cleared

        loot_items = [
            LootItem(id="loot_1", name_en="Minor Gem", name_de="Kleiner Edelstein", tier=1, effect_type="stress_heal"),
        ]
        with (
            patch("backend.services.dungeon_engine_service.select_encounter", return_value=None),
            patch("backend.services.dungeon_engine_service.roll_loot", return_value=loot_items),
        ):
            result = DungeonEngineService._enter_interactive_room(instance, room)

        assert result["treasure"] is True
        assert result["auto_loot"] is True
        assert len(result["loot"]) == 1
        assert room.cleared is True
        assert instance.rooms_cleared == initial_cleared + 1
        assert instance.phase == "room_clear"

    def test_shadow_vp_restore_on_treasure(self):
        instance = _make_instance()
        instance.archetype_state = {"visibility": 1, "max_visibility": 3, "rooms_since_vp_loss": 0}
        room = instance.rooms[4]

        with (
            patch("backend.services.dungeon_engine_service.select_encounter", return_value=None),
            patch("backend.services.dungeon_engine_service.roll_loot", return_value=[]),
        ):
            DungeonEngineService._enter_interactive_room(instance, room)

        # Shadow treasure restores VP (restore_on_treasure from ARCHETYPE_CONFIGS)
        assert instance.archetype_state["visibility"] > 1


# ── submit_combat_actions ────────────────────────────────────────────────


class TestSubmitCombatActions:
    @pytest.mark.asyncio
    async def test_wrong_phase_raises_400(self, noop_checkpoint):
        instance = _make_instance(phase="exploring")
        _register_instance(instance)
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            sub = CombatSubmission(actions=[CombatAction(agent_id=uuid4(), ability_id="spy_observe")])
            await DungeonEngineService.submit_combat_actions(
                _make_mock_supabase(), instance.run_id, uuid4(), sub
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_stores_actions_and_waits(self, noop_checkpoint):
        player1 = uuid4()
        player2 = uuid4()
        combat = CombatState(enemies=[_make_enemy()], phase="planning")
        instance = _make_instance(phase="combat_planning", combat=combat)
        instance.player_ids = [player1, player2]
        _register_instance(instance)

        sub = CombatSubmission(actions=[CombatAction(agent_id=uuid4(), ability_id="spy_observe")])
        result = await DungeonEngineService.submit_combat_actions(
            _make_mock_supabase(), instance.run_id, player1, sub
        )

        assert result["accepted"] is True
        assert result["waiting_for_players"] is True
        assert str(player1) in instance.combat.submitted_actions

    @pytest.mark.asyncio
    async def test_auto_resolve_when_all_submitted(self, noop_checkpoint, noop_timer):
        """When all players have submitted, combat resolves immediately.

        This exercises the full _resolve_combat path including the UUID
        handling fix (model_dump() preserves UUID objects, not strings).
        """
        player1 = uuid4()
        enemy = _make_enemy()
        combat = CombatState(enemies=[enemy], phase="planning")
        instance = _make_instance(phase="combat_planning", combat=combat)
        instance.player_ids = [player1]
        _register_instance(instance)

        agent_id = instance.party[0].agent_id
        sub = CombatSubmission(actions=[CombatAction(agent_id=agent_id, ability_id="spy_observe", target_id="enemy_1")])

        with (
            patch("backend.services.dungeon_engine_service.generate_enemy_actions", return_value=[]),
            patch("backend.services.dungeon_engine_service.get_enemy_templates_dict", return_value={}),
            patch("backend.services.dungeon_engine_service.resolve_combat_round") as mock_resolve,
        ):
            mock_result = MagicMock()
            mock_result.round_num = 1
            mock_result.events = []
            mock_result.combat_over = False
            mock_result.victory = False
            mock_result.party_wipe = False
            mock_resolve.return_value = mock_result

            result = await DungeonEngineService.submit_combat_actions(
                _make_mock_supabase(), instance.run_id, player1, sub
            )

        # Should have resolved (not waiting) — verifies UUID fix works
        assert "round_result" in result
        mock_resolve.assert_called_once()


# ── handle_encounter_choice ──────────────────────────────────────────────


class TestHandleEncounterChoice:
    @pytest.mark.asyncio
    async def test_wrong_phase_raises_400(self, noop_checkpoint):
        instance = _make_instance(phase="exploring")
        _register_instance(instance)
        from fastapi import HTTPException

        action = DungeonAction(action_type="encounter_choice", choice_id="c1")
        with pytest.raises(HTTPException) as exc_info:
            await DungeonEngineService.handle_encounter_choice(
                _make_mock_supabase(), instance.run_id, action
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_no_encounter_raises_400(self, noop_checkpoint):
        instance = _make_instance(phase="encounter")
        instance.rooms[instance.current_room].encounter_template_id = None
        _register_instance(instance)
        from fastapi import HTTPException

        action = DungeonAction(action_type="encounter_choice", choice_id="c1")
        with (
            patch("backend.services.dungeon_engine_service.get_encounter_by_id", return_value=None),
            pytest.raises(HTTPException) as exc_info,
        ):
            await DungeonEngineService.handle_encounter_choice(
                _make_mock_supabase(), instance.run_id, action
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_unknown_choice_raises_400(self, noop_checkpoint):
        from backend.models.resonance_dungeon import EncounterChoice, EncounterTemplate

        enc = EncounterTemplate(
            id="enc_test", archetype="The Shadow", room_type="encounter",
            choices=[EncounterChoice(id="c1", label_en="Go", label_de="Geh")],
        )
        instance = _make_instance(phase="encounter")
        instance.rooms[instance.current_room].encounter_template_id = "enc_test"
        _register_instance(instance)
        from fastapi import HTTPException

        action = DungeonAction(action_type="encounter_choice", choice_id="c_nonexistent")
        with (
            patch("backend.services.dungeon_engine_service.get_encounter_by_id", return_value=enc),
            pytest.raises(HTTPException) as exc_info,
        ):
            await DungeonEngineService.handle_encounter_choice(
                _make_mock_supabase(), instance.run_id, action
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_successful_choice_clears_room(self, noop_checkpoint):
        from backend.models.resonance_dungeon import EncounterChoice, EncounterTemplate

        choice = EncounterChoice(
            id="c1",
            label_en="Investigate",
            label_de="Untersuchen",
            success_effects={"stress": -10},
            success_narrative_en="You found something.",
            success_narrative_de="Ihr habt etwas gefunden.",
        )
        enc = EncounterTemplate(
            id="enc_test", archetype="The Shadow", room_type="encounter",
            choices=[choice],
        )
        instance = _make_instance(phase="encounter", current_room=2)
        instance.rooms[2].encounter_template_id = "enc_test"
        initial_cleared = instance.rooms_cleared
        _register_instance(instance)

        action = DungeonAction(action_type="encounter_choice", choice_id="c1")
        with patch("backend.services.dungeon_engine_service.get_encounter_by_id", return_value=enc):
            result = await DungeonEngineService.handle_encounter_choice(
                _make_mock_supabase(), instance.run_id, action
            )

        assert result["result"] == "success"
        assert instance.phase == "room_clear"
        assert instance.rooms[2].cleared is True
        assert instance.rooms_cleared == initial_cleared + 1

    @pytest.mark.asyncio
    async def test_skill_check_with_agent(self, noop_checkpoint):
        from backend.models.resonance_dungeon import EncounterChoice, EncounterTemplate

        choice = EncounterChoice(
            id="c1",
            label_en="Hack",
            label_de="Hacken",
            check_aptitude="spy",
            check_difficulty=5,
            success_effects={"stress_heal": 50},
            fail_effects={"stress": 30},
            success_narrative_en="Hacked!",
            success_narrative_de="Gehackt!",
            fail_narrative_en="Failed.",
            fail_narrative_de="Fehlgeschlagen.",
        )
        enc = EncounterTemplate(
            id="enc_test", archetype="The Shadow", room_type="encounter",
            choices=[choice],
        )
        agent = _make_agent(aptitudes={"spy": 8})
        instance = _make_instance(phase="encounter", current_room=2, party=[agent])
        instance.rooms[2].encounter_template_id = "enc_test"
        _register_instance(instance)

        action = DungeonAction(action_type="encounter_choice", choice_id="c1", agent_id=agent.agent_id)

        mock_outcome = MagicMock()
        mock_outcome.result = "success"
        mock_outcome.check_value = 75
        mock_outcome.roll = 50
        mock_outcome.breakdown = {"base": 75}

        with (
            patch("backend.services.dungeon_engine_service.get_encounter_by_id", return_value=enc),
            patch("backend.services.dungeon_engine_service.resolve_skill_check", return_value=mock_outcome),
        ):
            result = await DungeonEngineService.handle_encounter_choice(
                _make_mock_supabase(), instance.run_id, action
            )

        assert result["result"] == "success"
        assert result["check"] is not None
        assert result["check"]["aptitude"] == "spy"


# ── scout ────────────────────────────────────────────────────────────────


class TestScout:
    @pytest.mark.asyncio
    async def test_agent_not_in_party_raises_400(self, noop_checkpoint):
        instance = _make_instance()
        _register_instance(instance)
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await DungeonEngineService.scout(_make_mock_supabase(), instance.run_id, uuid4())
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_captured_agent_cannot_scout(self, noop_checkpoint):
        agent = _make_agent(condition="captured", aptitudes={"spy": 5})
        instance = _make_instance(party=[agent])
        _register_instance(instance)
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await DungeonEngineService.scout(_make_mock_supabase(), instance.run_id, agent.agent_id)
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_low_spy_cannot_scout(self, noop_checkpoint):
        agent = _make_agent(aptitudes={"spy": 2})
        instance = _make_instance(party=[agent])
        _register_instance(instance)
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await DungeonEngineService.scout(_make_mock_supabase(), instance.run_id, agent.agent_id)
        assert exc_info.value.status_code == 400
        assert "Spy 3+" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_successful_scout_reveals_rooms(self, noop_checkpoint):
        agent = _make_agent(aptitudes={"spy": 5})
        rooms = _make_rooms()
        # Hide rooms beyond direct connections
        for i in range(2, len(rooms)):
            rooms[i].revealed = False
        instance = _make_instance(current_room=0, party=[agent], rooms=rooms)
        _register_instance(instance)

        result = await DungeonEngineService.scout(_make_mock_supabase(), instance.run_id, agent.agent_id)

        assert result["revealed_rooms"] > 0
        assert "state" in result

    @pytest.mark.asyncio
    async def test_shadow_vp_restore_on_scout(self, noop_checkpoint):
        agent = _make_agent(aptitudes={"spy": 5})
        instance = _make_instance(party=[agent])
        instance.archetype_state = {"visibility": 1, "max_visibility": 3, "rooms_since_vp_loss": 0}
        _register_instance(instance)

        result = await DungeonEngineService.scout(_make_mock_supabase(), instance.run_id, agent.agent_id)

        assert instance.archetype_state["visibility"] > 1
        assert result["visibility"] == instance.archetype_state["visibility"]


# ── rest ─────────────────────────────────────────────────────────────────


class TestRest:
    @pytest.mark.asyncio
    async def test_wrong_phase_raises_400(self, noop_checkpoint):
        instance = _make_instance(phase="exploring")
        _register_instance(instance)
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await DungeonEngineService.rest(_make_mock_supabase(), instance.run_id, [uuid4()])
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_non_rest_room_raises_400(self, noop_checkpoint):
        instance = _make_instance(phase="rest", current_room=1)
        # Room 1 is combat, not rest
        _register_instance(instance)
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await DungeonEngineService.rest(_make_mock_supabase(), instance.run_id, [uuid4()])
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_successful_rest_heals_stress(self, noop_checkpoint):
        agent = _make_agent(stress=400)
        instance = _make_instance(phase="rest", current_room=3, party=[agent])
        # Room 3 = rest
        _register_instance(instance)

        with patch("backend.services.dungeon_engine_service.check_ambush", return_value=False):
            result = await DungeonEngineService.rest(
                _make_mock_supabase(), instance.run_id, [agent.agent_id]
            )

        assert result["healed"] is True
        assert result["ambushed"] is False
        assert agent.stress == 200  # 400 - REST_STRESS_HEAL(200) = 200

    @pytest.mark.asyncio
    async def test_rest_recovers_wounded_to_stressed(self, noop_checkpoint):
        agent = _make_agent(stress=300, condition="wounded")
        instance = _make_instance(phase="rest", current_room=3, party=[agent])
        _register_instance(instance)

        with patch("backend.services.dungeon_engine_service.check_ambush", return_value=False):
            await DungeonEngineService.rest(
                _make_mock_supabase(), instance.run_id, [agent.agent_id]
            )

        assert agent.condition == "stressed"
        assert agent.stress == 100

    @pytest.mark.asyncio
    async def test_rest_ambush(self, noop_checkpoint, noop_timer):
        agent = _make_agent(stress=400)
        instance = _make_instance(phase="rest", current_room=3, party=[agent])
        _register_instance(instance)

        enemies = [_make_enemy()]
        with (
            patch("backend.services.dungeon_engine_service.check_ambush", return_value=True),
            patch("backend.services.dungeon_engine_service.spawn_enemies", return_value=enemies),
        ):
            result = await DungeonEngineService.rest(
                _make_mock_supabase(), instance.run_id, [agent.agent_id]
            )

        assert result["ambushed"] is True
        assert instance.phase == "combat_planning"
        assert instance.combat is not None
        assert instance.combat.is_ambush is True

    @pytest.mark.asyncio
    async def test_rest_clears_room(self, noop_checkpoint):
        agent = _make_agent(stress=100)
        instance = _make_instance(phase="rest", current_room=3, party=[agent])
        initial_cleared = instance.rooms_cleared
        _register_instance(instance)

        with patch("backend.services.dungeon_engine_service.check_ambush", return_value=False):
            await DungeonEngineService.rest(
                _make_mock_supabase(), instance.run_id, [agent.agent_id]
            )

        assert instance.rooms[3].cleared is True
        assert instance.rooms_cleared == initial_cleared + 1
        assert instance.phase == "room_clear"


# ── retreat ──────────────────────────────────────────────────────────────


class TestRetreat:
    @pytest.mark.asyncio
    async def test_retreat_updates_phase(self, noop_checkpoint):
        instance = _make_instance(phase="exploring")
        _register_instance(instance)

        mock_sb = _make_mock_supabase()
        result = await DungeonEngineService.retreat(mock_sb, instance.run_id)

        assert result["retreated"] is True
        assert instance.phase == "retreated"

    @pytest.mark.asyncio
    async def test_retreat_partial_loot_if_rooms_cleared(self, noop_checkpoint):
        instance = _make_instance(phase="exploring")
        instance.rooms_cleared = 3
        _register_instance(instance)

        loot = [LootItem(id="l1", name_en="Shard", name_de="Scherbe", tier=1, effect_type="stress_heal")]
        mock_sb = _make_mock_supabase()
        with patch("backend.services.dungeon_engine_service.roll_loot", return_value=loot):
            result = await DungeonEngineService.retreat(mock_sb, instance.run_id)

        assert result["retreated"] is True
        assert len(result["loot"]) == 1

    @pytest.mark.asyncio
    async def test_retreat_no_loot_if_no_rooms_cleared(self, noop_checkpoint):
        instance = _make_instance(phase="exploring")
        instance.rooms_cleared = 0
        _register_instance(instance)

        mock_sb = _make_mock_supabase()
        result = await DungeonEngineService.retreat(mock_sb, instance.run_id)

        assert result["retreated"] is True
        assert len(result["loot"]) == 0

    @pytest.mark.asyncio
    async def test_retreat_removes_from_active_instances(self, noop_checkpoint):
        instance = _make_instance(phase="exploring")
        _register_instance(instance)

        mock_sb = _make_mock_supabase()
        await DungeonEngineService.retreat(mock_sb, instance.run_id)

        assert str(instance.run_id) not in _active_instances

    @pytest.mark.asyncio
    async def test_retreat_calls_rpc(self, noop_checkpoint):
        instance = _make_instance(phase="exploring")
        instance.rooms_cleared = 2
        _register_instance(instance)

        mock_sb = _make_mock_supabase()
        with patch("backend.services.dungeon_engine_service.roll_loot", return_value=[]):
            await DungeonEngineService.retreat(mock_sb, instance.run_id)

        mock_sb.rpc.assert_called_once()
        rpc_name, rpc_args = mock_sb.rpc.call_args[0]
        assert rpc_name == "fn_abandon_dungeon_run"
        assert rpc_args["p_run_id"] == str(instance.run_id)
        assert rpc_args["p_simulation_id"] == str(instance.simulation_id)
        assert rpc_args["p_outcome"]["rooms_cleared"] == 2
        assert rpc_args["p_depth"] == instance.depth
        assert rpc_args["p_room_index"] == instance.current_room


# ── get_available_dungeons ───────────────────────────────────────────────


class TestGetAvailableDungeons:
    @pytest.mark.asyncio
    async def test_returns_available_dungeons(self):
        mock_sb = MagicMock()
        chain = make_chain_mock(execute_data=[
            {
                "archetype": "The Shadow",
                "signature": "shadow_conflict",
                "resonance_id": str(uuid4()),
                "magnitude": 0.7,
                "susceptibility": 0.6,
                "effective_magnitude": 0.5,
                "suggested_difficulty": 3,
                "suggested_depth": 5,
                "last_run_at": None,
                "available": True,
            },
        ])
        mock_sb.table.return_value = chain

        result = await DungeonEngineService.get_available_dungeons(mock_sb, uuid4())

        assert len(result) == 1
        assert result[0].archetype == "The Shadow"
        assert result[0].magnitude == 0.7
        mock_sb.table.assert_called_with("available_dungeons")

    @pytest.mark.asyncio
    async def test_returns_empty_for_no_matches(self):
        mock_sb = MagicMock()
        chain = make_chain_mock(execute_data=[])
        mock_sb.table.return_value = chain

        result = await DungeonEngineService.get_available_dungeons(mock_sb, uuid4())
        assert result == []


# ── recover_from_checkpoint ──────────────────────────────────────────────


class TestRecoverFromCheckpoint:
    @pytest.mark.asyncio
    async def test_no_run_returns_none(self):
        mock_sb = MagicMock()
        chain = make_chain_mock(execute_data=None)
        mock_sb.table.return_value = chain

        result = await DungeonEngineService.recover_from_checkpoint(mock_sb, uuid4())
        assert result is None

    @pytest.mark.asyncio
    async def test_no_checkpoint_state_returns_none(self):
        mock_sb = MagicMock()
        chain = make_chain_mock(execute_data={
            "id": str(uuid4()),
            "simulation_id": str(uuid4()),
            "archetype": "The Shadow",
            "resonance_signature": "shadow_conflict",
            "difficulty": 3,
            "config": {"rooms": [{"index": 0, "depth": 0, "room_type": "entrance", "connections": [1]}]},
            "checkpoint_state": None,
            "party_player_ids": [],
        })
        mock_sb.table.return_value = chain

        result = await DungeonEngineService.recover_from_checkpoint(mock_sb, uuid4())
        assert result is None

    @pytest.mark.asyncio
    async def test_successful_recovery(self):
        run_id = uuid4()
        sim_id = uuid4()
        rooms_data = [r.model_dump() for r in _make_rooms(3)]
        checkpoint = {
            "current_room": 1,
            "party": [_make_agent("Recovered").model_dump()],
            "combat": None,
            "archetype_state": {"visibility": 2},
            "phase": "exploring",
            "depth": 1,
            "rooms_cleared": 1,
            "turn": 5,
            "room_cleared_flags": [0],
            "room_revealed_flags": [0, 1],
            "used_banter_ids": ["b1"],
        }

        mock_sb = MagicMock()
        chain = make_chain_mock(execute_data={
            "id": str(run_id),
            "simulation_id": str(sim_id),
            "archetype": "The Shadow",
            "resonance_signature": "shadow_conflict",
            "difficulty": 3,
            "config": {"rooms": rooms_data},
            "checkpoint_state": checkpoint,
            "party_player_ids": [],
        })
        mock_sb.table.return_value = chain

        result = await DungeonEngineService.recover_from_checkpoint(mock_sb, run_id)

        assert result is not None
        assert result.run_id == run_id
        assert result.current_room == 1
        assert result.phase == "exploring"
        assert len(result.party) == 1
        assert result.party[0].agent_name == "Recovered"
        assert result.archetype_state["visibility"] == 2
        assert result.used_banter_ids == ["b1"]
        # Verify it's registered
        assert str(run_id) in _active_instances


# ── _build_loot_items_for_rpc ────────────────────────────────────────────


class TestBuildLootItemsForRpc:
    def test_stress_heal_goes_to_all_operational(self):
        a1 = _make_agent("A1")
        a2 = _make_agent("A2")
        a3 = _make_agent("A3", condition="captured")
        instance = _make_instance(party=[a1, a2, a3])

        loot = [LootItem(id="heal_1", name_en="Calm", name_de="Ruhe", tier=1, effect_type="stress_heal", effect_params={"amount": 50})]
        items = DungeonEngineService._build_loot_items_for_rpc(instance, loot)

        # stress_heal → one entry per operational agent (a1, a2), not a3 (captured)
        assert len(items) == 2
        agent_ids = {item["agent_id"] for item in items}
        assert str(a1.agent_id) in agent_ids
        assert str(a2.agent_id) in agent_ids
        assert str(a3.agent_id) not in agent_ids

    def test_non_stress_heal_goes_to_first_operational(self):
        a1 = _make_agent("A1")
        a2 = _make_agent("A2")
        instance = _make_instance(party=[a1, a2])

        loot = [LootItem(id="mem_1", name_en="Memory", name_de="Erinnerung", tier=2, effect_type="memory")]
        items = DungeonEngineService._build_loot_items_for_rpc(instance, loot)

        assert len(items) == 1
        assert items[0]["agent_id"] == str(a1.agent_id)

    def test_dungeon_buff_skipped(self):
        instance = _make_instance()
        loot = [LootItem(id="buff_1", name_en="Buff", name_de="Buff", tier=1, effect_type="dungeon_buff")]
        items = DungeonEngineService._build_loot_items_for_rpc(instance, loot)
        assert len(items) == 0

    def test_all_captured_falls_back_to_first(self):
        a1 = _make_agent("A1", condition="captured")
        a2 = _make_agent("A2", condition="captured")
        instance = _make_instance(party=[a1, a2])

        loot = [LootItem(id="heal_1", name_en="Heal", name_de="Heilung", tier=1, effect_type="stress_heal")]
        items = DungeonEngineService._build_loot_items_for_rpc(instance, loot)

        # Falls back to first agent
        assert len(items) == 1
        assert items[0]["agent_id"] == str(a1.agent_id)

    def test_mixed_loot_types(self):
        a1 = _make_agent("A1")
        a2 = _make_agent("A2")
        instance = _make_instance(party=[a1, a2])

        loot = [
            LootItem(id="heal_1", name_en="Calm", name_de="Ruhe", tier=1, effect_type="stress_heal"),
            LootItem(id="mem_1", name_en="Mem", name_de="Mem", tier=2, effect_type="memory"),
            LootItem(id="buff_1", name_en="Buff", name_de="Buff", tier=1, effect_type="dungeon_buff"),
            LootItem(id="apt_1", name_en="Boost", name_de="Boost", tier=2, effect_type="aptitude_boost"),
        ]
        items = DungeonEngineService._build_loot_items_for_rpc(instance, loot)

        # stress_heal → 2 agents, memory → 1, dungeon_buff → skipped, aptitude_boost → 1
        assert len(items) == 4
        effect_types = [i["effect_type"] for i in items]
        assert effect_types.count("stress_heal") == 2
        assert effect_types.count("memory") == 1
        assert effect_types.count("aptitude_boost") == 1
        assert "dungeon_buff" not in effect_types


# ── _checkpoint ──────────────────────────────────────────────────────────


class TestCheckpoint:
    @pytest.mark.asyncio
    async def test_checkpoint_updates_db(self):
        instance = _make_instance(phase="exploring")
        mock_sb = MagicMock()
        chain = make_chain_mock()
        mock_sb.table.return_value = chain

        await DungeonEngineService._checkpoint(mock_sb, instance)

        mock_sb.table.assert_called_with("resonance_dungeon_runs")
        chain.update.assert_called_once()
        update_data = chain.update.call_args[0][0]
        assert update_data["status"] == "exploring"
        assert "checkpoint_state" in update_data

    @pytest.mark.asyncio
    async def test_checkpoint_status_mapping(self):
        test_cases = [
            ("exploring", "exploring"),
            ("room_clear", "exploring"),
            ("encounter", "active"),
            ("combat_planning", "combat"),
            ("combat_resolving", "combat"),
            ("completed", "completed"),
            ("retreated", "abandoned"),
            ("wiped", "wiped"),
        ]
        for phase, expected_status in test_cases:
            instance = _make_instance(phase=phase)
            mock_sb = MagicMock()
            chain = make_chain_mock()
            mock_sb.table.return_value = chain

            await DungeonEngineService._checkpoint(mock_sb, instance)

            update_data = chain.update.call_args[0][0]
            assert update_data["status"] == expected_status, f"Phase {phase} → expected {expected_status}"


# ── _handle_combat_victory ───────────────────────────────────────────────


class TestHandleCombatVictory:
    @pytest.mark.asyncio
    async def test_victory_clears_room_and_rolls_loot(self, noop_checkpoint):
        enemy = _make_enemy()
        combat = CombatState(enemies=[enemy])
        instance = _make_instance(phase="combat_resolving", current_room=1, combat=combat)
        initial_cleared = instance.rooms_cleared
        _register_instance(instance)

        loot = [LootItem(id="l1", name_en="Gem", name_de="Edelstein", tier=1, effect_type="stress_heal")]
        with patch("backend.services.dungeon_engine_service.roll_loot", return_value=loot):
            result = await DungeonEngineService._handle_combat_victory(
                _make_mock_supabase(), instance
            )

        assert result["victory"] is True
        assert len(result["loot"]) == 1
        assert instance.rooms[1].cleared is True
        assert instance.rooms_cleared == initial_cleared + 1
        assert instance.combat is None

    @pytest.mark.asyncio
    async def test_boss_victory_completes_run(self, noop_checkpoint):
        rooms = _make_rooms()
        rooms[1].room_type = "boss"
        enemy = _make_enemy()
        combat = CombatState(enemies=[enemy])
        instance = _make_instance(phase="combat_resolving", current_room=1, combat=combat, rooms=rooms)
        _register_instance(instance)

        loot = [LootItem(id="l1", name_en="Legend", name_de="Legende", tier=3, effect_type="memory")]
        mock_sb = _make_mock_supabase()
        with patch("backend.services.dungeon_engine_service.roll_loot", return_value=loot):
            result = await DungeonEngineService._handle_combat_victory(mock_sb, instance)

        assert result["victory"] is True
        assert instance.phase == "completed"
        # complete_run RPC should have been called
        mock_sb.rpc.assert_called_once()

    @pytest.mark.asyncio
    async def test_shadow_vp_restored_on_combat_win(self, noop_checkpoint):
        enemy = _make_enemy()
        combat = CombatState(enemies=[enemy])
        instance = _make_instance(phase="combat_resolving", current_room=1, combat=combat)
        instance.archetype_state = {"visibility": 1, "max_visibility": 3, "rooms_since_vp_loss": 0}
        _register_instance(instance)

        with patch("backend.services.dungeon_engine_service.roll_loot", return_value=[]):
            await DungeonEngineService._handle_combat_victory(_make_mock_supabase(), instance)

        # Shadow restores VP on combat win
        assert instance.archetype_state["visibility"] > 1


# ── _handle_party_wipe ───────────────────────────────────────────────────


class TestHandlePartyWipe:
    @pytest.mark.asyncio
    async def test_wipe_sets_phase(self, noop_checkpoint):
        instance = _make_instance(phase="combat_resolving")
        _register_instance(instance)

        result = await DungeonEngineService._handle_party_wipe(_make_mock_supabase(), instance)

        assert result["wipe"] is True
        assert instance.phase == "wiped"
        assert instance.combat is None

    @pytest.mark.asyncio
    async def test_wipe_calls_rpc(self, noop_checkpoint):
        instance = _make_instance(phase="combat_resolving")
        _register_instance(instance)

        mock_sb = _make_mock_supabase()
        await DungeonEngineService._handle_party_wipe(mock_sb, instance)

        mock_sb.rpc.assert_called_once_with("fn_wipe_dungeon_run", {
            "p_run_id": str(instance.run_id),
            "p_simulation_id": str(instance.simulation_id),
            "p_agent_outcomes": pytest.approx(instance.party, abs=0) if False else mock_sb.rpc.call_args[0][1]["p_agent_outcomes"],
            "p_depth": instance.depth,
            "p_room_index": instance.current_room,
        })

    @pytest.mark.asyncio
    async def test_wipe_removes_from_active(self, noop_checkpoint):
        instance = _make_instance(phase="combat_resolving")
        _register_instance(instance)

        await DungeonEngineService._handle_party_wipe(_make_mock_supabase(), instance)

        assert str(instance.run_id) not in _active_instances

    @pytest.mark.asyncio
    async def test_wipe_trauma_outcomes(self, noop_checkpoint):
        a1 = _make_agent("Alpha")
        a2 = _make_agent("Beta")
        instance = _make_instance(phase="combat_resolving", party=[a1, a2])
        _register_instance(instance)

        mock_sb = _make_mock_supabase()
        await DungeonEngineService._handle_party_wipe(mock_sb, instance)

        rpc_args = mock_sb.rpc.call_args[0][1]
        outcomes = rpc_args["p_agent_outcomes"]
        assert len(outcomes) == 2
        assert outcomes[0]["mood_delta"] == -20
        assert outcomes[0]["stress_delta"] == 200
        assert outcomes[0]["moodlets"][0]["moodlet_type"] == "dungeon_trauma"
