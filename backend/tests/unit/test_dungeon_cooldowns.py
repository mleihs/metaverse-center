"""Cooldowns are the only round resource combat has — they have to work.

`AgentCombatState.cooldowns` was read once (to fill the client field) and
written nowhere, so the whole cooldown UI could never light up and 17 abilities,
three ultimates among them, were available every round (Befund D2).

The ordering inside `advance_cooldowns` is the part worth pinning: decrement
before stamping. The other order ticks a fresh `cooldown: 1` straight back to 0
and the shortest cooldown in the game does nothing — which looks exactly like
working code.
"""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest

from backend.models.combat import AgentCombatState, CombatState
from backend.services.combat.ability_schools import get_ability_by_id
from backend.services.dungeon.dungeon_cooldowns import advance_cooldowns, is_on_cooldown


def _agent(name: str = "Alpha") -> AgentCombatState:
    return AgentCombatState(
        agent_id=uuid4(),
        agent_name=name,
        stress=0,
        condition="operational",
        aptitudes={"spy": 6, "guardian": 6, "saboteur": 6},
        personality={"openness": 0.5},
        resilience=0.5,
    )


class TestTheContentIsStillThere:
    """If the ability content lost its cooldowns, every test below is vacuous."""

    def test_abilities_declare_cooldowns(self):
        with_cd = [
            aid
            for aid in (
                "guardian_fortify",
                "saboteur_detonate",
                "spy_counter_intel",
                "propagandist_rally",
                "assassin_ambush_strike",
            )
            if (a := get_ability_by_id(aid)) and a.cooldown > 0
        ]
        assert len(with_cd) == 5, f"Fähigkeiten ohne Abklingzeit: {with_cd}"


class TestAdvanceCooldowns:
    def test_using_an_ability_stamps_its_cooldown(self):
        agent = _agent()
        ability = get_ability_by_id("saboteur_detonate")
        advance_cooldowns([agent], [(agent.agent_id, "saboteur_detonate")])
        assert agent.cooldowns["saboteur_detonate"] == ability.cooldown

    def test_a_cooldown_of_one_blocks_exactly_one_round(self):
        """The ordering test. Decrement-then-stamp, never the reverse.

        `guardian_shield` has cooldown 1. Stamping before decrementing would tick
        it to 0 in the very same call and the ability would be free.
        """
        agent = _agent()
        assert get_ability_by_id("guardian_shield").cooldown == 1

        advance_cooldowns([agent], [(agent.agent_id, "guardian_shield")])
        assert is_on_cooldown(agent, "guardian_shield") == 1, "sofort wieder frei"

        advance_cooldowns([agent], [])  # a round in which it was not used
        assert is_on_cooldown(agent, "guardian_shield") == 0

    def test_a_longer_cooldown_counts_all_the_way_down(self):
        agent = _agent()
        ability = get_ability_by_id("saboteur_detonate")
        advance_cooldowns([agent], [(agent.agent_id, "saboteur_detonate")])
        for expected in range(ability.cooldown - 1, -1, -1):
            advance_cooldowns([agent], [])
            assert is_on_cooldown(agent, "saboteur_detonate") == expected

    def test_expired_cooldowns_do_not_pile_up(self):
        """The dict must not grow one permanent entry per ability ever used."""
        agent = _agent()
        advance_cooldowns([agent], [(agent.agent_id, "guardian_shield")])
        advance_cooldowns([agent], [])
        assert agent.cooldowns == {}

    def test_an_ability_without_a_cooldown_stamps_nothing(self):
        agent = _agent()
        free = next(aid for aid in ("basic_attack", "defend") if (a := get_ability_by_id(aid)) and a.cooldown == 0)
        advance_cooldowns([agent], [(agent.agent_id, free)])
        assert agent.cooldowns == {}

    def test_cooldowns_are_per_agent(self):
        alpha, beta = _agent("Alpha"), _agent("Beta")
        advance_cooldowns([alpha, beta], [(alpha.agent_id, "guardian_fortify")])
        assert is_on_cooldown(alpha, "guardian_fortify") > 0
        assert is_on_cooldown(beta, "guardian_fortify") == 0

    def test_unknown_ability_is_ignored(self):
        agent = _agent()
        advance_cooldowns([agent], [(agent.agent_id, "does_not_exist")])
        assert agent.cooldowns == {}

    def test_reuse_restamps_the_full_cooldown(self):
        agent = _agent()
        ability = get_ability_by_id("guardian_taunt")
        advance_cooldowns([agent], [(agent.agent_id, "guardian_taunt")])
        advance_cooldowns([agent], [])  # ticks down one
        advance_cooldowns([agent], [(agent.agent_id, "guardian_taunt")])
        assert is_on_cooldown(agent, "guardian_taunt") == ability.cooldown


class TestIsOnCooldown:
    @pytest.mark.parametrize("stored,expected", [({}, 0), ({"x": 3}, 3), ({"x": -1}, 0)])
    def test_reads_remaining_rounds(self, stored, expected):
        agent = _agent()
        agent.cooldowns = stored
        assert is_on_cooldown(agent, "x") == expected


# ── Durchsetzung im Dienst ─────────────────────────────────────────────────


class TestTheServiceEnforcesThem:
    """The unit tests above prove the bookkeeping. This proves it is consulted.

    A cooldown that is tracked perfectly and never checked is the state the
    codebase was already in.
    """

    @pytest.mark.asyncio
    async def test_an_ability_on_cooldown_is_dropped_from_the_round(self):
        from backend.models.resonance_dungeon import CombatAction, CombatSubmission
        from backend.services.combat.combat_engine import CombatRoundResult
        from backend.services.dungeon_checkpoint_service import DungeonCheckpointService
        from backend.services.dungeon_combat_service import DungeonCombatService
        from backend.services.dungeon_engine_service import DungeonEngineService
        from backend.services.dungeon_instance_store import store as _store
        from backend.tests.conftest import make_async_supabase_mock
        from backend.tests.unit.test_dungeon_engine_service import _make_enemy, _make_instance

        player = uuid4()
        instance = _make_instance(
            phase="combat_planning",
            combat=CombatState(enemies=[_make_enemy()], phase="planning"),
        )
        instance.player_ids = [player]
        agent = instance.party[0]
        # The agent fired it last round.
        agent.cooldowns = {"guardian_fortify": 2}
        _store.put(instance.run_id, instance)

        submission = CombatSubmission(
            actions=[CombatAction(agent_id=agent.agent_id, ability_id="guardian_fortify", target_id="enemy_1")]
        )
        try:
            with (
                patch("backend.services.dungeon_combat_service.generate_enemy_actions", return_value=[]),
                patch("backend.services.dungeon_combat_service.get_enemy_templates_dict", return_value={}),
                patch.object(DungeonCheckpointService, "checkpoint"),
                patch.object(DungeonCheckpointService, "log_event"),
                patch.object(DungeonCombatService, "_start_combat_timer"),
                patch("backend.services.dungeon_combat_service.resolve_combat_round") as resolve,
            ):
                resolve.return_value = CombatRoundResult(
                    round_num=1,
                    events=[],
                    combat_over=False,
                    victory=False,
                    party_wipe=False,
                    stalemate=False,
                )
                await DungeonEngineService.submit_combat_actions(
                    make_async_supabase_mock(), instance.run_id, player, submission
                )

            # The round is not empty: dropping the action hands the agent to
            # auto-defend. What must NOT be in it is the blocked ability.
            submitted_actions = resolve.call_args[0][1]
            blocked = [a for a in submitted_actions if a.ability_id == "guardian_fortify"]
            assert not blocked, "Die Fähigkeit auf Abklingzeit hat die Runde erreicht — die Prüfung greift nicht"

        finally:
            _store.remove(instance.run_id)

    @pytest.mark.asyncio
    async def test_a_ready_ability_still_gets_through(self):
        """The guard must not eat the ordinary case."""
        from backend.models.resonance_dungeon import CombatAction, CombatSubmission
        from backend.services.combat.combat_engine import CombatRoundResult
        from backend.services.dungeon_checkpoint_service import DungeonCheckpointService
        from backend.services.dungeon_combat_service import DungeonCombatService
        from backend.services.dungeon_engine_service import DungeonEngineService
        from backend.services.dungeon_instance_store import store as _store
        from backend.tests.conftest import make_async_supabase_mock
        from backend.tests.unit.test_dungeon_engine_service import _make_enemy, _make_instance

        player = uuid4()
        instance = _make_instance(
            phase="combat_planning",
            combat=CombatState(enemies=[_make_enemy()], phase="planning"),
        )
        instance.player_ids = [player]
        agent = instance.party[0]
        _store.put(instance.run_id, instance)

        submission = CombatSubmission(
            actions=[CombatAction(agent_id=agent.agent_id, ability_id="guardian_fortify", target_id="enemy_1")]
        )
        try:
            with (
                patch("backend.services.dungeon_combat_service.generate_enemy_actions", return_value=[]),
                patch("backend.services.dungeon_combat_service.get_enemy_templates_dict", return_value={}),
                patch.object(DungeonCheckpointService, "checkpoint"),
                patch.object(DungeonCheckpointService, "log_event"),
                patch.object(DungeonCombatService, "_start_combat_timer"),
                patch("backend.services.dungeon_combat_service.resolve_combat_round") as resolve,
            ):
                resolve.return_value = CombatRoundResult(
                    round_num=1,
                    events=[],
                    combat_over=False,
                    victory=False,
                    party_wipe=False,
                    stalemate=False,
                )
                await DungeonEngineService.submit_combat_actions(
                    make_async_supabase_mock(), instance.run_id, player, submission
                )

            submitted_actions = resolve.call_args[0][1]
            mine = [a for a in submitted_actions if str(a.agent_id) == str(agent.agent_id)]
            assert len(mine) == 1
            assert mine[0].ability_id == "guardian_fortify"
            # ...and the round stamps the cooldown for the next one.
            assert is_on_cooldown(agent, "guardian_fortify") > 0
        finally:
            _store.remove(instance.run_id)

    @pytest.mark.asyncio
    async def test_auto_defend_does_not_spend_a_blocked_ability(self):
        """The guard the first version of this test could not falsify.

        With the default fixture the agent's only single-enemy damage ability is
        `basic_attack` (cooldown 0), so auto-defend could never pick a blocked
        one and removing the filter left every assertion green. A green test
        that cannot fail is not a test — this one gives the agent the aptitudes
        that unlock `assassin_exploit` (1), `infiltrator_backstab` (1) and
        `assassin_ambush_strike` (4), then blocks all of them.
        """
        from backend.models.resonance_dungeon import CombatAction, CombatSubmission
        from backend.services.combat.ability_schools import get_agent_all_abilities
        from backend.services.combat.combat_engine import CombatRoundResult
        from backend.services.dungeon_checkpoint_service import DungeonCheckpointService
        from backend.services.dungeon_combat_service import DungeonCombatService
        from backend.services.dungeon_engine_service import DungeonEngineService
        from backend.services.dungeon_instance_store import store as _store
        from backend.tests.conftest import make_async_supabase_mock
        from backend.tests.unit.test_dungeon_engine_service import _make_enemy, _make_instance

        player = uuid4()
        instance = _make_instance(
            phase="combat_planning",
            combat=CombatState(enemies=[_make_enemy()], phase="planning"),
        )
        instance.player_ids = [player]
        agent = instance.party[0]
        agent.aptitudes = {"assassin": 6, "infiltrator": 6, "spy": 6}

        blocked = {a.id: 3 for a in get_agent_all_abilities(agent.aptitudes, instance.archetype) if a.cooldown > 0}
        assert len(blocked) >= 3, f"Fixture greift nicht: nur {blocked}"
        agent.cooldowns = dict(blocked)
        _store.put(instance.run_id, instance)

        # No action for this agent → auto-defend has to choose. The pick is
        # `(round_num + hash(agent_id)) % len(pool)`, so ONE round proves
        # nothing: it can land on a free ability by luck and stay green with the
        # filter removed (it did). Every index gets exercised instead.
        other = instance.party[1]
        submission = CombatSubmission(
            actions=[CombatAction(agent_id=other.agent_id, ability_id="basic_attack", target_id="enemy_1")]
        )
        chosen: list[str] = []
        try:
            for round_num in range(6):
                instance.phase = "combat_planning"
                instance.combat.phase = "planning"
                instance.combat.round_num = round_num
                instance.combat.submitted_actions.clear()
                agent.cooldowns = dict(blocked)

                with (
                    patch("backend.services.dungeon_combat_service.generate_enemy_actions", return_value=[]),
                    patch("backend.services.dungeon_combat_service.get_enemy_templates_dict", return_value={}),
                    patch.object(DungeonCheckpointService, "checkpoint"),
                    patch.object(DungeonCheckpointService, "log_event"),
                    patch.object(DungeonCombatService, "_start_combat_timer"),
                    patch("backend.services.dungeon_combat_service.resolve_combat_round") as resolve,
                ):
                    resolve.return_value = CombatRoundResult(
                        round_num=round_num,
                        events=[],
                        combat_over=False,
                        victory=False,
                        party_wipe=False,
                        stalemate=False,
                    )
                    await DungeonEngineService.submit_combat_actions(
                        make_async_supabase_mock(), instance.run_id, player, submission
                    )

                chosen.extend(a.ability_id for a in resolve.call_args[0][1] if str(a.agent_id) == str(agent.agent_id))

            assert chosen, "Auto-Verteidigen hat gar nichts gewählt"
            for ability_id in chosen:
                assert ability_id not in blocked, (
                    f"Auto-Verteidigen wählte die gesperrte '{ability_id}' — "
                    f"dann verhindert die Prüfung nur, dass der SPIELER sie ausgibt, "
                    f"und der Server gibt sie für ihn aus"
                )
        finally:
            _store.remove(instance.run_id)
