"""Salvage (Deluge ``salvage``) — the path that used to raise on success.

``_salvage_locked`` rolled loot and then did ``instance.loot.append(item)``.
``DungeonInstance`` has no ``loot`` field, so every *successful* salvage ended
in an ``AttributeError`` → 500 (Befund D1). Nothing covered it: this module is
the test the finding asked for.

The second half pins the follow-up (Befund D3): a successful salvage keeps its
drop on the run instead of showing it and dropping it.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from backend.models.combat import AgentCombatState
from backend.models.resonance_dungeon import DungeonInstance, LootItem, RoomNode
from backend.services.combat.skill_checks import SkillCheckOutcome
from backend.services.dungeon_movement_service import DungeonMovementService

_PLAYER = uuid4()


def _agent(name: str = "Guardian", condition: str = "operational") -> AgentCombatState:
    return AgentCombatState(
        agent_id=uuid4(),
        agent_name=name,
        stress=0,
        condition=condition,
        aptitudes={"guardian": 6, "spy": 2},
        personality={"openness": 0.5, "neuroticism": 0.3},
        resilience=0.5,
    )


def _rooms() -> list[RoomNode]:
    """Five rooms; room 2 sits at depth 2, revealed and cleared — salvageable."""
    return [
        RoomNode(
            index=i,
            depth=i,
            room_type="entrance" if i == 0 else "combat",
            connections=[j for j in (i - 1, i + 1) if 0 <= j < 5],
            cleared=i <= 3,
            revealed=i <= 3,
            loot_tier=1,
        )
        for i in range(5)
    ]


def _deluge_instance(agent: AgentCombatState) -> DungeonInstance:
    return DungeonInstance(
        run_id=uuid4(),
        simulation_id=uuid4(),
        archetype="The Deluge",
        signature="deluge_conflict",
        difficulty=3,
        rooms=_rooms(),
        party=[agent],
        player_ids=[_PLAYER],
        # water_level 60 floods every room at depth >= 2
        archetype_state={"water_level": 60},
        phase="room_clear",
        depth=3,
        rooms_cleared=3,
        current_room=3,
    )


async def _salvage(instance: DungeonInstance, agent: AgentCombatState, result: str):
    outcome = SkillCheckOutcome(result=result, roll=18, check_value=12)
    with (
        patch(
            "backend.services.dungeon_movement_service.DungeonCheckpointService.get_instance",
            AsyncMock(return_value=instance),
        ),
        patch(
            "backend.services.dungeon_movement_service.DungeonCheckpointService.checkpoint",
            AsyncMock(return_value=None),
        ),
        patch(
            "backend.services.dungeon_movement_service.resolve_skill_check",
            return_value=outcome,
        ),
        patch(
            "backend.services.dungeon_movement_service.roll_loot",
            return_value=[
                LootItem(
                    id="deluge_pearl",
                    name_en="Pearl",
                    name_de="Perle",
                    tier=1,
                    effect_type="stress_heal",
                    effect_params={"stress_heal": 10},
                )
            ],
        ),
    ):
        return await DungeonMovementService.salvage(
            AsyncMock(),
            instance.run_id,
            agent.agent_id,
            room_index=2,
            user_id=_PLAYER,
        )


class TestSalvageNoLongerCrashes:
    def test_instance_has_no_loot_attribute(self):
        """The exact shape of the defect: the field the old code wrote to.

        If someone ever adds a ``loot`` field, this test fails and whoever does
        it has to decide deliberately whether ``record_loot``/``run_loot`` is
        still the one place run loot lives.
        """
        agent = _agent()
        instance = _deluge_instance(agent)
        assert not hasattr(instance, "loot")
        assert hasattr(instance, "run_loot")

    @pytest.mark.asyncio
    @pytest.mark.parametrize("result", ["success", "partial"])
    async def test_successful_salvage_returns_loot(self, result):
        agent = _agent()
        instance = _deluge_instance(agent)

        response = await _salvage(instance, agent, result)

        assert response.success is True
        assert response.loot is not None
        assert len(response.loot) == 1
        assert response.check_result == result

    @pytest.mark.asyncio
    async def test_successful_salvage_keeps_loot_on_the_run(self):
        """D3: the drop survives the call instead of being shown and dropped."""
        agent = _agent()
        instance = _deluge_instance(agent)
        assert instance.run_loot == []

        response = await _salvage(instance, agent, "success")

        assert len(instance.run_loot) == 1
        assert instance.run_loot[0]["effect_type"] == "stress_heal"
        # The response shows exactly what was kept — same occurrence, same id.
        assert response.loot[0]["id"] == instance.run_loot[0]["id"]

    @pytest.mark.asyncio
    async def test_occurrence_ids_are_unique(self):
        """Two salvages of the same content item must not collapse into one.

        ``loot_assignments`` and ``loot_suggestions`` are keyed by loot id, so a
        repeated drop needs its own identity to stay separately assignable.
        """
        agent = _agent()
        instance = _deluge_instance(agent)

        await _salvage(instance, agent, "success")
        # Second dive into another room (room 3 is also revealed + cleared).
        instance.archetype_state["_salvaged_rooms"] = []
        await _salvage(instance, agent, "success")

        assert len(instance.run_loot) == 2
        ids = {item["id"] for item in instance.run_loot}
        assert len(ids) == 2, f"occurrence ids collapsed: {ids}"
        assert all(i.startswith("deluge_pearl@") for i in ids)

    @pytest.mark.asyncio
    async def test_failed_salvage_keeps_nothing_and_raises_water(self):
        agent = _agent()
        instance = _deluge_instance(agent)

        response = await _salvage(instance, agent, "failure")

        assert response.success is False
        assert instance.run_loot == []
        assert instance.archetype_state["water_level"] == 65
