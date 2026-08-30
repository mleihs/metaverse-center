"""A declared skill check must actually be rolled.

`handle_encounter_choice` seeds ``result_tier = "success"`` and then rolls only
``if choice.check_aptitude and acting_agent``. Until the Systemprüfung of
2026-08-30 there was no else: leaving ``agent_id`` out of the request — or
having nobody left who could act — skipped the roll and kept the default. The
check was not failed, it was *granted* (Befund D8).

The frontend picks the best non-captured agent itself, so the hole was never
visible in normal play. It opened for any other client, and for a party in which
everyone had been captured.

`requires_aptitude` was likewise never validated server-side.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.models.combat import AgentCombatState
from backend.models.resonance_dungeon import (
    DungeonAction,
    DungeonInstance,
    EncounterChoice,
    EncounterTemplate,
    RoomNode,
)
from backend.services.combat.skill_checks import SkillCheckOutcome
from backend.services.dungeon_checkpoint_service import DungeonCheckpointService
from backend.services.dungeon_engine_service import DungeonEngineService
from backend.services.dungeon_instance_store import store as _store
from backend.tests.conftest import make_async_supabase_mock

_PLAYER = uuid4()


def _agent(name: str, condition: str = "operational", aptitudes: dict | None = None) -> AgentCombatState:
    return AgentCombatState(
        agent_id=uuid4(),
        agent_name=name,
        stress=0,
        condition=condition,
        aptitudes=aptitudes if aptitudes is not None else {"spy": 5, "guardian": 3},
        personality={"openness": 0.5, "neuroticism": 0.3},
        resilience=0.5,
    )


def _instance(party: list[AgentCombatState]) -> DungeonInstance:
    rooms = [
        RoomNode(
            index=i,
            depth=i,
            room_type="entrance" if i == 0 else "encounter",
            connections=[j for j in (i - 1, i + 1) if 0 <= j < 3],
            cleared=i == 0,
            revealed=True,
            loot_tier=1,
        )
        for i in range(3)
    ]
    inst = DungeonInstance(
        run_id=uuid4(),
        simulation_id=uuid4(),
        archetype="The Shadow",
        signature="conflict_wave",
        difficulty=3,
        rooms=rooms,
        party=party,
        player_ids=[_PLAYER],
        archetype_state={"visibility": 3, "max_visibility": 3},
        phase="encounter",
        depth=1,
        rooms_cleared=1,
        current_room=1,
    )
    inst.rooms[1].encounter_template_id = "enc_probe"
    _store.put(inst.run_id, inst)
    return inst


def _encounter(choice: EncounterChoice) -> EncounterTemplate:
    return EncounterTemplate(
        id="enc_probe",
        archetype="The Shadow",
        room_type="encounter",
        choices=[choice],
    )


async def _choose(instance: DungeonInstance, encounter: EncounterTemplate, action: DungeonAction):
    with (
        patch.object(DungeonCheckpointService, "checkpoint", new_callable=AsyncMock),
        patch.object(DungeonCheckpointService, "log_event", new_callable=AsyncMock),
        patch(
            "backend.services.dungeon_movement_service.get_encounter_by_id",
            return_value=encounter,
        ),
    ):
        return await DungeonEngineService.handle_encounter_choice(
            make_async_supabase_mock(), instance.run_id, action, user_id=_PLAYER
        )


CHECKED = EncounterChoice(
    id="c_check",
    label_en="Slip past",
    label_de="Vorbeischleichen",
    check_aptitude="spy",
    check_difficulty=0,
    success_narrative_en="Unseen.",
    success_narrative_de="Ungesehen.",
    fail_narrative_en="Seen.",
    fail_narrative_de="Gesehen.",
)


class TestOmittingTheAgentIsNoLongerAFreePass:
    @pytest.mark.asyncio
    async def test_missing_agent_id_fails_the_check(self):
        instance = _instance([_agent("Alpha")])
        try:
            result = await _choose(
                instance,
                _encounter(CHECKED),
                DungeonAction(action_type="encounter_choice", choice_id="c_check"),
            )
            assert result.check is not None, "Ohne Probe gäbe es gar kein Ergebnis"
            assert result.check["result"] == "fail", (
                "Ohne handlungsfähigen Agenten muss die Probe FEHLSCHLAGEN, "
                "nicht stumm gelingen"
            )
            assert result.check["breakdown"]["reason"] == "no_capable_agent"
        finally:
            _store.remove(instance.run_id)

    @pytest.mark.asyncio
    async def test_every_agent_captured_fails_the_check(self):
        instance = _instance([_agent("Alpha", condition="captured")])
        captured = instance.party[0]
        try:
            result = await _choose(
                instance,
                _encounter(CHECKED),
                DungeonAction(
                    action_type="encounter_choice",
                    choice_id="c_check",
                    agent_id=captured.agent_id,
                ),
            )
            assert result.check["result"] == "fail"
            assert result.check["breakdown"]["reason"] == "no_capable_agent"
        finally:
            _store.remove(instance.run_id)

    @pytest.mark.asyncio
    async def test_unknown_agent_id_is_a_client_error(self):
        instance = _instance([_agent("Alpha")])
        try:
            with pytest.raises(HTTPException) as exc:
                await _choose(
                    instance,
                    _encounter(CHECKED),
                    DungeonAction(
                        action_type="encounter_choice",
                        choice_id="c_check",
                        agent_id=uuid4(),
                    ),
                )
            assert exc.value.status_code == 400
        finally:
            _store.remove(instance.run_id)

    @pytest.mark.asyncio
    async def test_a_capable_agent_still_rolls_normally(self):
        """The guard must not swallow the ordinary path."""
        instance = _instance([_agent("Alpha")])
        alpha = instance.party[0]
        try:
            with patch(
                "backend.services.dungeon_movement_service.resolve_skill_check",
                return_value=SkillCheckOutcome(result="success", roll=3, check_value=15),
            ):
                result = await _choose(
                    instance,
                    _encounter(CHECKED),
                    DungeonAction(
                        action_type="encounter_choice",
                        choice_id="c_check",
                        agent_id=alpha.agent_id,
                    ),
                )
            assert result.check["result"] == "success"
            assert result.check["roll"] == 3
            assert "reason" not in result.check["breakdown"]
        finally:
            _store.remove(instance.run_id)

    @pytest.mark.asyncio
    async def test_choice_without_a_check_needs_no_agent(self):
        """An unchecked choice must stay usable without naming anyone."""
        instance = _instance([_agent("Alpha")])
        plain = EncounterChoice(
            id="c_plain",
            label_en="Walk on",
            label_de="Weitergehen",
            success_narrative_en="You walk on.",
            success_narrative_de="Ihr geht weiter.",
        )
        try:
            result = await _choose(
                instance,
                _encounter(plain),
                DungeonAction(action_type="encounter_choice", choice_id="c_plain"),
            )
            assert result.check is None
        finally:
            _store.remove(instance.run_id)


class TestRequiredAptitudeIsEnforced:
    @pytest.mark.asyncio
    async def test_agent_below_the_requirement_is_rejected(self):
        instance = _instance([_agent("Alpha", aptitudes={"spy": 1})])
        alpha = instance.party[0]
        gated = EncounterChoice(
            id="c_gated",
            label_en="Pick the lock",
            label_de="Schloss knacken",
            requires_aptitude={"spy": 4},
        )
        try:
            with pytest.raises(HTTPException) as exc:
                await _choose(
                    instance,
                    _encounter(gated),
                    DungeonAction(
                        action_type="encounter_choice",
                        choice_id="c_gated",
                        agent_id=alpha.agent_id,
                    ),
                )
            assert exc.value.status_code == 400
            assert "spy" in str(exc.value.detail)
        finally:
            _store.remove(instance.run_id)

    @pytest.mark.asyncio
    async def test_agent_meeting_the_requirement_passes(self):
        instance = _instance([_agent("Alpha", aptitudes={"spy": 6})])
        alpha = instance.party[0]
        gated = EncounterChoice(
            id="c_gated",
            label_en="Pick the lock",
            label_de="Schloss knacken",
            requires_aptitude={"spy": 4},
            success_narrative_en="Open.",
            success_narrative_de="Offen.",
        )
        try:
            result = await _choose(
                instance,
                _encounter(gated),
                DungeonAction(
                    action_type="encounter_choice",
                    choice_id="c_gated",
                    agent_id=alpha.agent_id,
                ),
            )
            assert result is not None
        finally:
            _store.remove(instance.run_id)
