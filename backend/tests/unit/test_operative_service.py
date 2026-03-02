"""Unit tests for OperativeService — deployment, success probability, effects."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from backend.models.epoch import OperativeDeploy
from backend.services.operative_service import (
    DEPLOY_CYCLES,
    DETECTION_PENALTY,
    MISSION_SCORE_VALUES,
    OPERATIVE_RP_COSTS,
    SECURITY_LEVEL_MAP,
    OperativeService,
    _downgrade_security,
)

# ── Helpers ────────────────────────────────────────────────────

EPOCH_ID = uuid4()
SIM_ID = uuid4()
TARGET_SIM_ID = uuid4()
AGENT_ID = uuid4()
EMBASSY_ID = uuid4()
ZONE_ID = uuid4()
TARGET_ENTITY_ID = uuid4()


def _make_deploy_body(
    operative_type: str = "spy",
    target_simulation_id: UUID | None = None,
    embassy_id: UUID | None = None,
    agent_id: UUID | None = None,
    target_entity_id: UUID | None = None,
    target_entity_type: str | None = None,
    target_zone_id: UUID | None = None,
) -> OperativeDeploy:
    return OperativeDeploy(
        agent_id=agent_id or AGENT_ID,
        operative_type=operative_type,
        target_simulation_id=target_simulation_id,
        embassy_id=embassy_id,
        target_entity_id=target_entity_id,
        target_entity_type=target_entity_type,
        target_zone_id=target_zone_id,
    )


def _mock_supabase_for_deploy(
    epoch_data: dict | None = None,
    agent_data: dict | None = None,
    existing_missions: list | None = None,
    participant_rp: int = 20,
    embassy_data: dict | None = None,
    source_team_id: str | None = None,
    target_team_id: str | None = None,
    professions_data: list | None = None,
    zone_data: dict | None = None,
    guardian_count: int = 0,
    embassy_eff_data: dict | None = None,
    insert_data: dict | None = None,
) -> MagicMock:
    """Create a mock Supabase client for deploy() with table routing."""
    sb = MagicMock()

    # Default epoch
    if epoch_data is None:
        epoch_data = {
            "id": str(EPOCH_ID),
            "status": "competition",
            "config": {"cycle_hours": 8, "rp_per_cycle": 12, "rp_cap": 40},
            "current_cycle": 3,
        }

    # Default agent
    if agent_data is None:
        agent_data = {"id": str(AGENT_ID), "simulation_id": str(SIM_ID), "name": "Agent X"}

    # Default insert result
    if insert_data is None:
        insert_data = {
            "id": str(uuid4()),
            "epoch_id": str(EPOCH_ID),
            "agent_id": str(AGENT_ID),
            "operative_type": "spy",
            "source_simulation_id": str(SIM_ID),
            "status": "active",
        }

    # Build chains per table
    def make_chain(**kwargs):
        c = MagicMock()
        c.select.return_value = c
        c.eq.return_value = c
        c.in_.return_value = c
        c.single.return_value = c
        c.maybe_single.return_value = c
        c.limit.return_value = c
        c.order.return_value = c
        c.insert.return_value = c
        c.update.return_value = c
        c.delete.return_value = c
        c.range.return_value = c
        for k, v in kwargs.items():
            setattr(c, k, v)
        return c

    # game_epochs
    epoch_chain = make_chain()
    epoch_chain.execute.return_value = MagicMock(data=epoch_data)

    # embassies
    embassy_chain = make_chain()
    if embassy_data is None:
        embassy_data = {"id": str(EMBASSY_ID), "status": "active"}
    embassy_chain.execute.return_value = MagicMock(data=embassy_data)

    # epoch_participants — for team check + spend_rp
    participant_chain = make_chain()
    # Track calls to route between different queries
    participant_responses = []
    # source team
    participant_responses.append(
        MagicMock(data={"team_id": source_team_id} if source_team_id else {"team_id": None})
    )
    # target team
    participant_responses.append(
        MagicMock(data={"team_id": target_team_id} if target_team_id else {"team_id": None})
    )
    # spend_rp select
    participant_responses.append(
        MagicMock(data={"id": str(uuid4()), "current_rp": participant_rp})
    )
    # spend_rp update
    participant_responses.append(
        MagicMock(data=[{"id": str(uuid4()), "current_rp": participant_rp - 3}])
    )
    participant_chain.execute.side_effect = participant_responses

    # agents
    agents_chain = make_chain()
    agents_chain.execute.return_value = MagicMock(data=agent_data)

    # operative_missions — existing check + insert
    missions_chain = make_chain()
    missions_execute_responses = [
        MagicMock(data=existing_missions or []),  # existing check
        MagicMock(data=[insert_data]),  # insert
    ]
    missions_chain.execute.side_effect = missions_execute_responses

    # agent_professions
    prof_chain = make_chain()
    prof_chain.execute.return_value = MagicMock(data=professions_data or [])

    # zones
    zone_chain = make_chain()
    zone_chain.execute.return_value = MagicMock(
        data=zone_data or {"security_level": "moderate"}
    )

    # guardian count query
    guardian_chain = make_chain()
    guardian_chain.execute.return_value = MagicMock(
        data=[{"id": str(uuid4())} for _ in range(guardian_count)]
    )

    call_counts: dict[str, int] = {}

    def table_side_effect(name):
        call_counts[name] = call_counts.get(name, 0) + 1
        if name == "game_epochs":
            return epoch_chain
        if name == "embassies":
            return embassy_chain
        if name == "epoch_participants":
            return participant_chain
        if name == "agents":
            return agents_chain
        if name == "operative_missions":
            return missions_chain
        if name == "agent_professions":
            return prof_chain
        if name == "zones":
            return zone_chain
        return make_chain()

    sb.table.side_effect = table_side_effect
    return sb


# ── _downgrade_security ───────────────────────────────────────


class TestDowngradeSecurity:
    def test_high_to_guarded(self):
        assert _downgrade_security("high") == "guarded"

    def test_guarded_to_moderate(self):
        assert _downgrade_security("guarded") == "moderate"

    def test_lawless_stays_lawless(self):
        assert _downgrade_security("lawless") == "lawless"

    def test_fortress_to_maximum(self):
        assert _downgrade_security("fortress") == "maximum"

    def test_unknown_level_returns_same(self):
        assert _downgrade_security("nonexistent") == "nonexistent"


# ── Constants ─────────────────────────────────────────────────


class TestConstants:
    def test_all_operative_types_have_rp_costs(self):
        expected_types = {"spy", "saboteur", "propagandist", "assassin", "guardian", "infiltrator"}
        assert set(OPERATIVE_RP_COSTS.keys()) == expected_types

    def test_all_operative_types_have_deploy_cycles(self):
        expected_types = {"spy", "saboteur", "propagandist", "assassin", "guardian", "infiltrator"}
        assert set(DEPLOY_CYCLES.keys()) == expected_types

    def test_spy_and_guardian_deploy_immediately(self):
        assert DEPLOY_CYCLES["spy"] == 0
        assert DEPLOY_CYCLES["guardian"] == 0

    def test_assassin_and_infiltrator_take_2_cycles(self):
        assert DEPLOY_CYCLES["assassin"] == 2
        assert DEPLOY_CYCLES["infiltrator"] == 2

    def test_guardian_rp_cost_is_4(self):
        assert OPERATIVE_RP_COSTS["guardian"] == 4

    def test_assassin_rp_cost_is_7(self):
        assert OPERATIVE_RP_COSTS["assassin"] == 7

    def test_detection_penalty_is_3(self):
        assert DETECTION_PENALTY == 3

    def test_mission_score_values_exist_for_non_guardian(self):
        # Guardians don't have score values (defensive only)
        assert "guardian" not in MISSION_SCORE_VALUES
        assert "spy" in MISSION_SCORE_VALUES
        assert "assassin" in MISSION_SCORE_VALUES


# ── Deploy validation ─────────────────────────────────────────


class TestDeployValidation:
    @pytest.mark.asyncio
    async def test_rejects_deploy_in_lobby_phase(self):
        sb = MagicMock()
        epoch_chain = MagicMock()
        epoch_chain.select.return_value = epoch_chain
        epoch_chain.eq.return_value = epoch_chain
        epoch_chain.single.return_value = epoch_chain
        epoch_chain.execute.return_value = MagicMock(
            data={"id": str(EPOCH_ID), "status": "lobby", "config": {}}
        )
        sb.table.return_value = epoch_chain

        body = _make_deploy_body("spy", TARGET_SIM_ID, EMBASSY_ID)
        with pytest.raises(HTTPException) as exc:
            await OperativeService.deploy(sb, EPOCH_ID, SIM_ID, body)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_rejects_deploy_in_completed_phase(self):
        sb = MagicMock()
        epoch_chain = MagicMock()
        epoch_chain.select.return_value = epoch_chain
        epoch_chain.eq.return_value = epoch_chain
        epoch_chain.single.return_value = epoch_chain
        epoch_chain.execute.return_value = MagicMock(
            data={"id": str(EPOCH_ID), "status": "completed", "config": {}}
        )
        sb.table.return_value = epoch_chain

        body = _make_deploy_body("spy", TARGET_SIM_ID, EMBASSY_ID)
        with pytest.raises(HTTPException) as exc:
            await OperativeService.deploy(sb, EPOCH_ID, SIM_ID, body)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_rejects_non_guardian_in_foundation_phase(self):
        sb = MagicMock()
        epoch_chain = MagicMock()
        epoch_chain.select.return_value = epoch_chain
        epoch_chain.eq.return_value = epoch_chain
        epoch_chain.single.return_value = epoch_chain
        epoch_chain.execute.return_value = MagicMock(
            data={"id": str(EPOCH_ID), "status": "foundation", "config": {}}
        )
        sb.table.return_value = epoch_chain

        body = _make_deploy_body("spy", TARGET_SIM_ID, EMBASSY_ID)
        with pytest.raises(HTTPException) as exc:
            await OperativeService.deploy(sb, EPOCH_ID, SIM_ID, body)
        assert exc.value.status_code == 400
        assert "guardian" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_guardian_cannot_have_target_simulation(self):
        sb = MagicMock()
        epoch_chain = MagicMock()
        epoch_chain.select.return_value = epoch_chain
        epoch_chain.eq.return_value = epoch_chain
        epoch_chain.single.return_value = epoch_chain
        epoch_chain.execute.return_value = MagicMock(
            data={"id": str(EPOCH_ID), "status": "competition", "config": {}}
        )
        sb.table.return_value = epoch_chain

        body = _make_deploy_body("guardian", target_simulation_id=TARGET_SIM_ID)
        with pytest.raises(HTTPException) as exc:
            await OperativeService.deploy(sb, EPOCH_ID, SIM_ID, body)
        assert exc.value.status_code == 400
        assert "own simulation" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_offensive_operative_requires_target_simulation(self):
        sb = MagicMock()
        epoch_chain = MagicMock()
        epoch_chain.select.return_value = epoch_chain
        epoch_chain.eq.return_value = epoch_chain
        epoch_chain.single.return_value = epoch_chain
        epoch_chain.execute.return_value = MagicMock(
            data={"id": str(EPOCH_ID), "status": "competition", "config": {}}
        )
        sb.table.return_value = epoch_chain

        body = _make_deploy_body("spy", target_simulation_id=None)
        with pytest.raises(HTTPException) as exc:
            await OperativeService.deploy(sb, EPOCH_ID, SIM_ID, body)
        assert exc.value.status_code == 400
        assert "target simulation" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_offensive_operative_requires_embassy(self):
        sb = MagicMock()
        epoch_chain = MagicMock()
        epoch_chain.select.return_value = epoch_chain
        epoch_chain.eq.return_value = epoch_chain
        epoch_chain.single.return_value = epoch_chain
        epoch_chain.execute.return_value = MagicMock(
            data={"id": str(EPOCH_ID), "status": "competition", "config": {}}
        )
        sb.table.return_value = epoch_chain

        body = _make_deploy_body("spy", target_simulation_id=TARGET_SIM_ID, embassy_id=None)
        with pytest.raises(HTTPException) as exc:
            await OperativeService.deploy(sb, EPOCH_ID, SIM_ID, body)
        assert exc.value.status_code == 400
        assert "embassy" in exc.value.detail.lower()


# ── Deploy duplicate prevention ───────────────────────────────


class TestDeployDuplicatePrevention:
    @pytest.mark.asyncio
    async def test_rejects_agent_already_deployed(self):
        sb = _mock_supabase_for_deploy(
            existing_missions=[{"id": str(uuid4()), "status": "active"}]
        )
        body = _make_deploy_body("spy", TARGET_SIM_ID, EMBASSY_ID)
        with pytest.raises(HTTPException) as exc:
            await OperativeService.deploy(sb, EPOCH_ID, SIM_ID, body)
        assert exc.value.status_code == 409
        assert "already" in exc.value.detail.lower()


# ── Success Probability ───────────────────────────────────────


class TestSuccessProbability:
    @pytest.mark.asyncio
    async def test_base_probability_with_no_modifiers(self):
        """Base prob with no qualification, moderate zone, no guardians, default embassy."""
        sb = MagicMock()
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.in_.return_value = chain
        chain.single.return_value = chain
        chain.execute.return_value = MagicMock(data=[])

        sb.table.return_value = chain

        body = _make_deploy_body("spy", TARGET_SIM_ID, EMBASSY_ID)
        prob = await OperativeService._calculate_success_probability(
            sb, body, SIM_ID
        )
        # base=0.55, qualification=0, zone_security=5.0 default, guardian=0, embassy=0.5
        # 0.55 + 0 - 5.0*0.05 - 0 + 0.5*0.15 = 0.55 - 0.25 + 0.075 = 0.375
        assert 0.05 <= prob <= 0.95

    @pytest.mark.asyncio
    async def test_probability_clamped_to_minimum(self):
        """Extremely hostile conditions should still give at least 5% chance."""
        sb = MagicMock()
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.in_.return_value = chain
        chain.single.return_value = chain
        # No professions
        chain.execute.return_value = MagicMock(data=[])

        sb.table.side_effect = lambda name: chain

        body = _make_deploy_body(
            "spy", TARGET_SIM_ID, EMBASSY_ID, target_zone_id=ZONE_ID,
        )
        prob = await OperativeService._calculate_success_probability(
            sb, body, SIM_ID
        )
        assert prob >= 0.05

    @pytest.mark.asyncio
    async def test_probability_clamped_to_maximum(self):
        """Even with all bonuses, should not exceed 95%."""
        sb = MagicMock()

        prof_chain = MagicMock()
        prof_chain.select.return_value = prof_chain
        prof_chain.eq.return_value = prof_chain
        prof_chain.execute.return_value = MagicMock(
            data=[{"qualification_level": 10}]
        )

        zone_chain = MagicMock()
        zone_chain.select.return_value = zone_chain
        zone_chain.eq.return_value = zone_chain
        zone_chain.single.return_value = zone_chain
        zone_chain.execute.return_value = MagicMock(
            data={"security_level": "lawless"}
        )

        guardian_chain = MagicMock()
        guardian_chain.select.return_value = guardian_chain
        guardian_chain.eq.return_value = guardian_chain
        guardian_chain.in_.return_value = guardian_chain
        guardian_chain.execute.return_value = MagicMock(data=[])

        embassy_chain = MagicMock()
        embassy_chain.select.return_value = embassy_chain
        embassy_chain.eq.return_value = embassy_chain
        embassy_chain.single.return_value = embassy_chain
        embassy_chain.execute.return_value = MagicMock(
            data={"id": str(EMBASSY_ID), "infiltration_penalty": 0, "infiltration_penalty_expires_at": None}
        )

        def table_router(name):
            if name == "agent_professions":
                return prof_chain
            if name == "zones":
                return zone_chain
            if name == "operative_missions":
                return guardian_chain
            if name == "embassies":
                return embassy_chain
            return MagicMock()

        sb.table.side_effect = table_router

        body = _make_deploy_body(
            "spy", TARGET_SIM_ID, EMBASSY_ID, target_zone_id=ZONE_ID,
        )
        prob = await OperativeService._calculate_success_probability(
            sb, body, SIM_ID
        )
        assert prob <= 0.95

    @pytest.mark.asyncio
    async def test_guardian_penalty_capped_at_015(self):
        """Guardian penalty should be min(0.15, count * 0.06)."""
        sb = MagicMock()

        prof_chain = MagicMock()
        prof_chain.select.return_value = prof_chain
        prof_chain.eq.return_value = prof_chain
        prof_chain.execute.return_value = MagicMock(data=[])

        # 5 guardians -> 5 * 0.06 = 0.30, but capped at 0.15
        guardian_chain = MagicMock()
        guardian_chain.select.return_value = guardian_chain
        guardian_chain.eq.return_value = guardian_chain
        guardian_chain.in_.return_value = guardian_chain
        guardian_chain.execute.return_value = MagicMock(
            data=[{"id": str(uuid4())} for _ in range(5)]
        )

        embassy_chain = MagicMock()
        embassy_chain.select.return_value = embassy_chain
        embassy_chain.eq.return_value = embassy_chain
        embassy_chain.single.return_value = embassy_chain
        embassy_chain.execute.return_value = MagicMock(
            data={"id": str(EMBASSY_ID), "infiltration_penalty": 0, "infiltration_penalty_expires_at": None}
        )

        def table_router(name):
            if name == "agent_professions":
                return prof_chain
            if name == "operative_missions":
                return guardian_chain
            if name == "embassies":
                return embassy_chain
            return MagicMock()

        sb.table.side_effect = table_router

        body = _make_deploy_body("spy", TARGET_SIM_ID, EMBASSY_ID)
        prob = await OperativeService._calculate_success_probability(
            sb, body, SIM_ID
        )
        # base=0.55 + 0 - 5.0*0.05 - 0.15 + 0.6*0.15 = 0.55 - 0.25 - 0.15 + 0.09 = 0.24
        assert 0.20 <= prob <= 0.30

    @pytest.mark.asyncio
    async def test_high_qualification_boosts_probability(self):
        """Agent with high qualification should increase success probability."""
        sb = MagicMock()

        prof_chain = MagicMock()
        prof_chain.select.return_value = prof_chain
        prof_chain.eq.return_value = prof_chain
        prof_chain.execute.return_value = MagicMock(
            data=[{"qualification_level": 8}]
        )

        guardian_chain = MagicMock()
        guardian_chain.select.return_value = guardian_chain
        guardian_chain.eq.return_value = guardian_chain
        guardian_chain.in_.return_value = guardian_chain
        guardian_chain.execute.return_value = MagicMock(data=[])

        embassy_chain = MagicMock()
        embassy_chain.select.return_value = embassy_chain
        embassy_chain.eq.return_value = embassy_chain
        embassy_chain.single.return_value = embassy_chain
        embassy_chain.execute.return_value = MagicMock(
            data={"id": str(EMBASSY_ID), "infiltration_penalty": 0, "infiltration_penalty_expires_at": None}
        )

        def table_router(name):
            if name == "agent_professions":
                return prof_chain
            if name == "operative_missions":
                return guardian_chain
            if name == "embassies":
                return embassy_chain
            return MagicMock()

        sb.table.side_effect = table_router

        body = _make_deploy_body("spy", TARGET_SIM_ID, EMBASSY_ID)
        prob = await OperativeService._calculate_success_probability(
            sb, body, SIM_ID
        )
        # base=0.55 + 8*0.05 - 5.0*0.05 - 0 + 0.6*0.15 = 0.55 + 0.4 - 0.25 + 0.09 = 0.79
        assert 0.75 <= prob <= 0.85


# ── Spy Effect ─────────────────────────────────────────────────


class TestSpyEffect:
    @pytest.mark.asyncio
    async def test_spy_gathers_intel_on_target(self):
        sb = MagicMock()

        zones_chain = MagicMock()
        zones_chain.select.return_value = zones_chain
        zones_chain.eq.return_value = zones_chain
        zones_chain.execute.return_value = MagicMock(
            data=[
                {"security_level": "high"},
                {"security_level": "moderate"},
            ]
        )

        guardian_chain = MagicMock()
        guardian_chain.select.return_value = guardian_chain
        guardian_chain.eq.return_value = guardian_chain
        guardian_chain.execute.return_value = MagicMock(data=[], count=2)

        epoch_chain = MagicMock()
        epoch_chain.select.return_value = epoch_chain
        epoch_chain.eq.return_value = epoch_chain
        epoch_chain.single.return_value = epoch_chain
        epoch_chain.execute.return_value = MagicMock(
            data={"current_cycle": 3}
        )

        blog_chain = MagicMock()
        blog_chain.insert.return_value = blog_chain
        blog_chain.execute.return_value = MagicMock(data=[{"id": "bl1"}])

        def table_router(name):
            if name == "zones":
                return zones_chain
            if name == "operative_missions":
                return guardian_chain
            if name == "game_epochs":
                return epoch_chain
            if name == "battle_log":
                return blog_chain
            return MagicMock()

        sb.table.side_effect = table_router

        mission = {
            "id": str(uuid4()),
            "epoch_id": str(EPOCH_ID),
            "operative_type": "spy",
            "source_simulation_id": str(SIM_ID),
            "target_simulation_id": str(TARGET_SIM_ID),
        }

        result = await OperativeService._apply_spy_effect(sb, mission)

        assert result["outcome"] == "success"
        assert result["intel_gathered"] is True
        assert "zone_security" in result["intel"]
        assert len(result["intel"]["zone_security"]) == 2


# ── Saboteur Effect ────────────────────────────────────────────


class TestSaboteurEffect:
    @pytest.mark.asyncio
    async def test_saboteur_degrades_building_condition(self):
        sb = MagicMock()

        building_chain = MagicMock()
        building_chain.select.return_value = building_chain
        building_chain.eq.return_value = building_chain
        building_chain.single.return_value = building_chain
        building_chain.execute.return_value = MagicMock(
            data={"id": str(TARGET_ENTITY_ID), "building_condition": "good"}
        )
        building_chain.update.return_value = building_chain

        zones_chain = MagicMock()
        zones_chain.select.return_value = zones_chain
        zones_chain.eq.return_value = zones_chain
        zones_chain.execute.return_value = MagicMock(data=[])

        def table_router(name):
            if name == "buildings":
                return building_chain
            if name == "zones":
                return zones_chain
            return MagicMock()

        sb.table.side_effect = table_router

        mission = {
            "id": str(uuid4()),
            "epoch_id": str(EPOCH_ID),
            "operative_type": "saboteur",
            "source_simulation_id": str(SIM_ID),
            "target_simulation_id": str(TARGET_SIM_ID),
            "target_entity_id": str(TARGET_ENTITY_ID),
        }

        result = await OperativeService._apply_saboteur_effect(sb, mission)

        assert result["outcome"] == "success"
        assert "damage_dealt" in result
        assert result["damage_dealt"]["old_condition"] == "good"
        assert result["damage_dealt"]["new_condition"] == "moderate"

    @pytest.mark.asyncio
    async def test_saboteur_downgrades_zone_security(self):
        sb = MagicMock()

        building_chain = MagicMock()
        building_chain.select.return_value = building_chain
        building_chain.eq.return_value = building_chain
        building_chain.single.return_value = building_chain
        building_chain.execute.return_value = MagicMock(data=None)

        zones_chain = MagicMock()
        zones_chain.select.return_value = zones_chain
        zones_chain.eq.return_value = zones_chain
        zones_chain.update.return_value = zones_chain
        zones_chain.execute.return_value = MagicMock(
            data=[{"id": "z1", "security_level": "high"}]
        )

        def table_router(name):
            if name == "buildings":
                return building_chain
            if name == "zones":
                return zones_chain
            return MagicMock()

        sb.table.side_effect = table_router

        mission = {
            "id": str(uuid4()),
            "epoch_id": str(EPOCH_ID),
            "operative_type": "saboteur",
            "source_simulation_id": str(SIM_ID),
            "target_simulation_id": str(TARGET_SIM_ID),
            "target_entity_id": None,
        }

        result = await OperativeService._apply_saboteur_effect(sb, mission)

        assert result["outcome"] == "success"
        assert "zone_downgraded" in result
        assert result["zone_downgraded"]["old_level"] == "high"
        assert result["zone_downgraded"]["new_level"] == "guarded"


# ── Propagandist Effect ────────────────────────────────────────


class TestPropagandistEffect:
    @pytest.mark.asyncio
    async def test_propagandist_creates_event_in_target_sim(self):
        admin_mock = MagicMock()
        events_chain = MagicMock()
        events_chain.insert.return_value = events_chain
        events_chain.execute.return_value = MagicMock(data=[{"id": "e1"}])
        admin_mock.table.return_value = events_chain

        with patch(
            "backend.dependencies.get_admin_supabase",
            new_callable=AsyncMock,
            return_value=admin_mock,
        ):
            mission = {
                "id": str(uuid4()),
                "epoch_id": str(EPOCH_ID),
                "operative_type": "propagandist",
                "source_simulation_id": str(SIM_ID),
                "target_simulation_id": str(TARGET_SIM_ID),
            }

            result = await OperativeService._apply_propagandist_effect(MagicMock(), mission)

        assert result["outcome"] == "success"
        assert result["event_created"] is True

        # Verify event was inserted into target sim
        insert_call = events_chain.insert.call_args[0][0]
        assert insert_call["simulation_id"] == str(TARGET_SIM_ID)
        assert insert_call["data_source"] == "propagandist"


# ── Assassin Effect ────────────────────────────────────────────


class TestAssassinEffect:
    @pytest.mark.asyncio
    async def test_assassin_weakens_relationships(self):
        sb = MagicMock()

        rel_chain = MagicMock()
        rel_chain.select.return_value = rel_chain
        rel_chain.or_.return_value = rel_chain
        rel_chain.eq.return_value = rel_chain
        rel_chain.update.return_value = rel_chain
        rel_chain.execute.return_value = MagicMock(
            data=[
                {"id": "r1", "intensity": 5},
                {"id": "r2", "intensity": 3},
            ]
        )

        epoch_chain = MagicMock()
        epoch_chain.select.return_value = epoch_chain
        epoch_chain.eq.return_value = epoch_chain
        epoch_chain.single.return_value = epoch_chain
        epoch_chain.execute.return_value = MagicMock(
            data={"config": {"cycle_hours": 8}}
        )

        agents_chain = MagicMock()
        agents_chain.update.return_value = agents_chain
        agents_chain.eq.return_value = agents_chain
        agents_chain.execute.return_value = MagicMock(data=[])

        def table_router(name):
            if name == "agent_relationships":
                return rel_chain
            if name == "game_epochs":
                return epoch_chain
            if name == "agents":
                return agents_chain
            return MagicMock()

        sb.table.side_effect = table_router

        mission = {
            "id": str(uuid4()),
            "epoch_id": str(EPOCH_ID),
            "operative_type": "assassin",
            "source_simulation_id": str(SIM_ID),
            "target_simulation_id": str(TARGET_SIM_ID),
            "target_entity_id": str(TARGET_ENTITY_ID),
        }

        result = await OperativeService._apply_assassin_effect(sb, mission)

        assert result["outcome"] == "success"
        assert result["relationships_weakened"] == 2
        assert "ambassador_blocked_until" in result

    @pytest.mark.asyncio
    async def test_assassin_without_target_returns_generic_success(self):
        sb = MagicMock()
        mission = {
            "id": str(uuid4()),
            "epoch_id": str(EPOCH_ID),
            "operative_type": "assassin",
            "source_simulation_id": str(SIM_ID),
            "target_entity_id": None,
        }

        result = await OperativeService._apply_assassin_effect(sb, mission)

        assert result["outcome"] == "success"
        assert result["narrative"] == "Mission completed."


# ── Infiltrator Effect ─────────────────────────────────────────


class TestInfiltratorEffect:
    @pytest.mark.asyncio
    async def test_infiltrator_reduces_embassy_effectiveness(self):
        sb = MagicMock()

        epoch_chain = MagicMock()
        epoch_chain.select.return_value = epoch_chain
        epoch_chain.eq.return_value = epoch_chain
        epoch_chain.single.return_value = epoch_chain
        epoch_chain.execute.return_value = MagicMock(
            data={"config": {"cycle_hours": 8}}
        )

        embassy_chain = MagicMock()
        embassy_chain.update.return_value = embassy_chain
        embassy_chain.eq.return_value = embassy_chain
        embassy_chain.execute.return_value = MagicMock(data=[])

        def table_router(name):
            if name == "game_epochs":
                return epoch_chain
            if name == "embassies":
                return embassy_chain
            return MagicMock()

        sb.table.side_effect = table_router

        mission = {
            "id": str(uuid4()),
            "epoch_id": str(EPOCH_ID),
            "operative_type": "infiltrator",
            "source_simulation_id": str(SIM_ID),
            "target_simulation_id": str(TARGET_SIM_ID),
            "target_entity_id": str(EMBASSY_ID),
        }

        result = await OperativeService._apply_infiltrator_effect(sb, mission)

        assert result["outcome"] == "success"
        assert result["effectiveness_reduced"] is True
        assert result["target_embassy_id"] == str(EMBASSY_ID)

        # Verify embassy was updated with 65% penalty
        update_call = embassy_chain.update.call_args[0][0]
        assert update_call["infiltration_penalty"] == 0.65

    @pytest.mark.asyncio
    async def test_infiltrator_without_target_returns_generic_success(self):
        sb = MagicMock()
        mission = {
            "id": str(uuid4()),
            "epoch_id": str(EPOCH_ID),
            "operative_type": "infiltrator",
            "source_simulation_id": str(SIM_ID),
            "target_entity_id": None,
        }

        result = await OperativeService._apply_infiltrator_effect(sb, mission)

        assert result["outcome"] == "success"


# ── Recall ─────────────────────────────────────────────────────


class TestRecall:
    @pytest.mark.asyncio
    async def test_recall_active_mission(self):
        sb = MagicMock()
        mission_data = {
            "id": str(uuid4()),
            "source_simulation_id": str(SIM_ID),
            "status": "active",
            "operative_type": "spy",
        }
        # First call: get_mission (single) returns dict
        # Second call: update returns list
        get_chain = MagicMock()
        get_chain.select.return_value = get_chain
        get_chain.eq.return_value = get_chain
        get_chain.single.return_value = get_chain
        get_chain.execute.return_value = MagicMock(data=mission_data)

        update_chain = MagicMock()
        update_chain.update.return_value = update_chain
        update_chain.eq.return_value = update_chain
        update_chain.execute.return_value = MagicMock(data=[{**mission_data, "status": "returning"}])

        call_count = {"n": 0}

        def table_router(name):
            call_count["n"] += 1
            if call_count["n"] == 1:
                return get_chain
            return update_chain

        sb.table.side_effect = table_router

        result = await OperativeService.recall(
            sb, UUID(mission_data["id"]), SIM_ID,
        )
        assert result is not None
        assert result["status"] == "returning"

    @pytest.mark.asyncio
    async def test_recall_rejects_wrong_simulation(self):
        sb = MagicMock()
        other_sim = uuid4()
        mission_data = {
            "id": str(uuid4()),
            "source_simulation_id": str(other_sim),
            "status": "active",
        }
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.single.return_value = chain
        chain.execute.return_value = MagicMock(data=mission_data)
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await OperativeService.recall(
                sb, UUID(mission_data["id"]), SIM_ID,
            )
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_recall_rejects_completed_mission(self):
        sb = MagicMock()
        mission_data = {
            "id": str(uuid4()),
            "source_simulation_id": str(SIM_ID),
            "status": "success",
        }
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.single.return_value = chain
        chain.execute.return_value = MagicMock(data=mission_data)
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await OperativeService.recall(
                sb, UUID(mission_data["id"]), SIM_ID,
            )
        assert exc.value.status_code == 400


# ── Security Level Map ────────────────────────────────────────


class TestSecurityLevelMap:
    def test_fortress_is_highest(self):
        assert SECURITY_LEVEL_MAP["fortress"] == 10.0

    def test_lawless_is_lowest(self):
        assert SECURITY_LEVEL_MAP["lawless"] == 2.0

    def test_moderate_and_medium_are_equal(self):
        assert SECURITY_LEVEL_MAP["moderate"] == SECURITY_LEVEL_MAP["medium"]
