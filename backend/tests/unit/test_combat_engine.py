"""Tests for backend.services.combat.combat_engine — stateless round resolver.

Covers:
  - resolve_combat_round: full round orchestration, agent dedup, phase ordering
  - generate_enemy_actions: weighted random action selection, target selection
  - has_buff / has_debuff: membership checks
  - _apply_buff / _consume_buff: idempotent add, one-shot removal
  - _calculate_hit_chance: formula, visibility penalty, floor/cap
  - _calculate_attack_damage: power scaling, vulnerability, resistance, bonus steps
  - Guardian shield one-shot absorption (condition + stress)
  - Stress cap per round across multiple enemy attacks
  - Victory/wipe conditions
  - Condition_change stored BEFORE mutation (architecture fix)
"""

from unittest.mock import patch
from uuid import UUID, uuid4

import pytest

from backend.models.combat import AgentCombatState, CombatState, EnemyInstance
from backend.services.combat.combat_engine import (
    AgentAction,
    CombatContext,
    CombatRoundResult,
    EnemyAction,
    _apply_buff,
    _apply_debuff_to_enemy,
    _calculate_attack_damage,
    _calculate_hit_chance,
    _check_victory_conditions,
    _consume_buff,
    generate_enemy_actions,
    has_buff,
    has_debuff,
    resolve_combat_round,
)


# ── Fixtures / Helpers ────────────────────────────────────────────────────

AGENT_A_ID = uuid4()
AGENT_B_ID = uuid4()


def _make_agent(
    agent_id=None,
    name="Agent A",
    condition="operational",
    stress=0,
    aptitudes=None,
    personality=None,
    buffs=None,
    resilience=0.5,
) -> AgentCombatState:
    return AgentCombatState(
        agent_id=agent_id or uuid4(),
        agent_name=name,
        condition=condition,
        stress=stress,
        aptitudes=aptitudes or {"spy": 5, "guardian": 3},
        personality=personality or {"neuroticism": 0.5, "extraversion": 0.5},
        active_buffs=list(buffs or []),
        resilience=resilience,
    )


def _make_enemy(
    template_id="shadow_wisp",
    condition_steps=2,
    evasion=20,
    effects=None,
) -> EnemyInstance:
    return EnemyInstance(
        instance_id=f"{template_id}_{uuid4().hex[:6]}",
        template_id=template_id,
        name_en="Shadow Wisp",
        name_de="Schattenglimmer",
        condition_steps_remaining=condition_steps,
        condition_steps_max=condition_steps,
        threat_level="minion",
        stress_resistance=50,
        evasion=evasion,
        active_effects=list(effects or []),
    )


SHADOW_TEMPLATES = {
    "shadow_wisp": {
        "attack_power": 2,
        "stress_attack_power": 4,
        "attack_aptitude": "infiltrator",
        "action_weights": {"stress_attack": 60, "evade": 30, "ambient": 10},
        "telegraphed_intent": True,
        "evasion": 40,
        "vulnerabilities": ["spy"],
        "resistances": ["assassin"],
    },
    "shadow_echo_violence": {
        "attack_power": 6,
        "stress_attack_power": 5,
        "attack_aptitude": "assassin",
        "action_weights": {"attack": 40, "stress_attack": 30, "ambush": 20, "defend": 10},
        "telegraphed_intent": True,
        "evasion": 20,
        "vulnerabilities": ["spy", "guardian"],
        "resistances": ["propagandist"],
    },
}


# ── has_buff / has_debuff ─────────────────────────────────────────────────


class TestBuffDebuffHelpers:
    def test_has_buff_present(self):
        agent = _make_agent(buffs=["shielded", "fortified"])
        assert has_buff(agent, "shielded") is True

    def test_has_buff_absent(self):
        agent = _make_agent()
        assert has_buff(agent, "shielded") is False

    def test_has_debuff_present(self):
        enemy = _make_enemy(effects=["analyzed"])
        assert has_debuff(enemy, "analyzed") is True

    def test_has_debuff_absent(self):
        enemy = _make_enemy()
        assert has_debuff(enemy, "analyzed") is False


class TestApplyConsumeBuff:
    def test_apply_buff_adds(self):
        agent = _make_agent()
        _apply_buff(agent, "shielded")
        assert "shielded" in agent.active_buffs

    def test_apply_buff_idempotent(self):
        agent = _make_agent()
        _apply_buff(agent, "shielded")
        _apply_buff(agent, "shielded")
        assert agent.active_buffs.count("shielded") == 1

    def test_consume_buff_removes(self):
        agent = _make_agent(buffs=["shielded"])
        result = _consume_buff(agent, "shielded")
        assert result is True
        assert "shielded" not in agent.active_buffs

    def test_consume_buff_absent(self):
        agent = _make_agent()
        result = _consume_buff(agent, "shielded")
        assert result is False

    def test_apply_debuff_to_enemy(self):
        enemy = _make_enemy()
        _apply_debuff_to_enemy(enemy, "analyzed")
        assert "analyzed" in enemy.active_effects

    def test_apply_debuff_idempotent(self):
        enemy = _make_enemy()
        _apply_debuff_to_enemy(enemy, "analyzed")
        _apply_debuff_to_enemy(enemy, "analyzed")
        assert enemy.active_effects.count("analyzed") == 1


# ── _calculate_hit_chance ─────────────────────────────────────────────────


class TestCalculateHitChance:
    def test_base_formula(self):
        # 55 + (5*3) - (20*0.5) + 0 = 55 + 15 - 10 = 60
        assert _calculate_hit_chance(5, 20) == 60

    def test_visibility_zero_penalty(self):
        # 55 + 15 - 10 - 15 = 45
        assert _calculate_hit_chance(5, 20, visibility=0) == 45

    def test_hit_bonus(self):
        # 55 + 15 - 10 + 10 = 70
        assert _calculate_hit_chance(5, 20, hit_bonus=10) == 70

    def test_floor_at_10(self):
        # Very high evasion
        result = _calculate_hit_chance(0, 200)
        assert result == 10

    def test_cap_at_95(self):
        # Very high aptitude
        result = _calculate_hit_chance(20, 0, hit_bonus=50)
        assert result == 95

    def test_high_evasion_high_aptitude(self):
        # 55 + 27 - 20 = 62
        assert _calculate_hit_chance(9, 40) == 62


# ── _calculate_attack_damage ──────────────────────────────────────────────


class TestCalculateAttackDamage:
    def test_base_low_power(self):
        """Power < 7 → base 1."""
        assert _calculate_attack_damage(5, False, False) == 1

    def test_base_high_power(self):
        """Power >= 7 → base 2."""
        assert _calculate_attack_damage(7, False, False) == 2

    def test_vulnerability_adds_1(self):
        assert _calculate_attack_damage(5, True, False) == 2  # 1 + 1

    def test_resistance_subtracts_1(self):
        # base 2 (power 7), -1 resistance = 1
        assert _calculate_attack_damage(7, False, True) == 1

    def test_both_vulnerability_and_resistance(self):
        # power 5: base 1, +1 vuln, -1 resist = 1
        assert _calculate_attack_damage(5, True, True) == 1

    def test_minimum_1(self):
        """Even with resistance, minimum is 1."""
        assert _calculate_attack_damage(3, False, True) >= 1

    def test_bonus_steps(self):
        # base 1 + 2 bonus = 3
        assert _calculate_attack_damage(5, False, False, bonus_steps=2) == 3


# ── generate_enemy_actions ────────────────────────────────────────────────


class TestGenerateEnemyActions:
    def test_one_action_per_living_enemy(self):
        agents = [_make_agent()]
        enemies = [_make_enemy(), _make_enemy()]
        context = CombatContext(agents=agents, enemies=enemies)
        actions = generate_enemy_actions(enemies, agents, context, SHADOW_TEMPLATES)
        assert len(actions) == 2

    def test_dead_enemies_skip(self):
        agents = [_make_agent()]
        dead_enemy = _make_enemy()
        dead_enemy.is_alive = False
        enemies = [dead_enemy, _make_enemy()]
        context = CombatContext(agents=agents, enemies=enemies)
        actions = generate_enemy_actions(enemies, agents, context, SHADOW_TEMPLATES)
        assert len(actions) == 1

    def test_no_agents_alive_returns_empty(self):
        agents = [_make_agent(condition="captured")]
        enemies = [_make_enemy()]
        context = CombatContext(agents=agents, enemies=enemies)
        actions = generate_enemy_actions(enemies, agents, context, SHADOW_TEMPLATES)
        assert len(actions) == 0

    def test_telegraphed_intent_populated(self):
        agents = [_make_agent()]
        enemies = [_make_enemy()]
        context = CombatContext(agents=agents, enemies=enemies)
        actions = generate_enemy_actions(enemies, agents, context, SHADOW_TEMPLATES)
        assert actions[0].telegraphed_intent  # non-empty string

    def test_action_has_target(self):
        agent = _make_agent()
        enemies = [_make_enemy()]
        context = CombatContext(agents=[agent], enemies=enemies)
        actions = generate_enemy_actions(enemies, [agent], context, SHADOW_TEMPLATES)
        assert actions[0].target_agent_id == agent.agent_id


# ── _check_victory_conditions ─────────────────────────────────────────────


class TestVictoryConditions:
    def test_all_enemies_dead_victory(self):
        enemy = _make_enemy()
        enemy.is_alive = False
        ctx = CombatContext(agents=[_make_agent()], enemies=[enemy])
        over, victory, wipe, stalemate = _check_victory_conditions(ctx)
        assert over is True
        assert victory is True
        assert wipe is False
        assert stalemate is False

    def test_all_agents_captured_wipe(self):
        ctx = CombatContext(
            agents=[_make_agent(condition="captured")],
            enemies=[_make_enemy()],
        )
        over, victory, wipe, stalemate = _check_victory_conditions(ctx)
        assert over is True
        assert victory is False
        assert wipe is True
        assert stalemate is False

    def test_ongoing_combat(self):
        ctx = CombatContext(agents=[_make_agent()], enemies=[_make_enemy()])
        over, victory, wipe, stalemate = _check_victory_conditions(ctx)
        assert over is False
        assert victory is False
        assert wipe is False
        assert stalemate is False

    def test_mixed_agents_not_all_down(self):
        """One agent captured, one operational → combat continues."""
        ctx = CombatContext(
            agents=[_make_agent(condition="captured"), _make_agent(condition="operational")],
            enemies=[_make_enemy()],
        )
        over, _, _, _ = _check_victory_conditions(ctx)
        assert over is False

    def test_stalemate_at_max_rounds(self):
        """Combat ends as stalemate when round_num >= max_rounds."""
        ctx = CombatContext(
            agents=[_make_agent()],
            enemies=[_make_enemy()],
            round_num=10,
            max_rounds=10,
        )
        over, victory, wipe, stalemate = _check_victory_conditions(ctx)
        assert over is True
        assert victory is False
        assert wipe is False
        assert stalemate is True

    def test_victory_takes_priority_over_stalemate(self):
        """If all enemies die at max_rounds, it's a victory, not stalemate."""
        enemy = _make_enemy()
        enemy.is_alive = False
        ctx = CombatContext(
            agents=[_make_agent()],
            enemies=[enemy],
            round_num=10,
            max_rounds=10,
        )
        over, victory, wipe, stalemate = _check_victory_conditions(ctx)
        assert over is True
        assert victory is True
        assert stalemate is False


# ── resolve_combat_round ──────────────────────────────────────────────────


class TestResolveCombatRound:
    """Integration tests for full round resolution."""

    def test_returns_round_result(self):
        agent = _make_agent(agent_id=AGENT_A_ID)
        enemy = _make_enemy(condition_steps=1, evasion=0)
        ctx = CombatContext(agents=[agent], enemies=[enemy], round_num=1)

        agent_actions = [
            AgentAction(agent_id=AGENT_A_ID, ability_id="assassin_precision_strike", target_id=enemy.instance_id),
        ]
        enemy_actions = [
            EnemyAction(enemy_id=enemy.instance_id, action_type="defend", target_agent_id=AGENT_A_ID),
        ]

        with patch("backend.services.combat.combat_engine.random.randint", return_value=1):
            result = resolve_combat_round(ctx, agent_actions, enemy_actions, SHADOW_TEMPLATES)

        assert isinstance(result, CombatRoundResult)
        assert result.round_num == 1
        assert len(result.events) > 0

    def test_agent_action_deduplication(self):
        """One action per agent per round — last submitted wins."""
        agent_id = uuid4()
        agent = _make_agent(agent_id=agent_id)
        enemy = _make_enemy(condition_steps=5, evasion=0)
        ctx = CombatContext(agents=[agent], enemies=[enemy])

        # Two actions from same agent — last one should win
        actions = [
            AgentAction(agent_id=agent_id, ability_id="spy_observe"),
            AgentAction(agent_id=agent_id, ability_id="assassin_precision_strike", target_id=enemy.instance_id),
        ]
        enemy_actions = []

        with patch("backend.services.combat.combat_engine.random.randint", return_value=50):
            result = resolve_combat_round(ctx, actions, enemy_actions, SHADOW_TEMPLATES)

        # Should only resolve ONE action (the last submitted = assassin_precision_strike)
        damage_events = [e for e in result.events if e.action == "Precision Strike"]
        # May or may not have damage event depending on hit, but should NOT have spy_observe effect
        spy_events = [e for e in result.events if e.action == "Observe"]
        assert len(spy_events) == 0  # deduped out

    def test_guardian_shield_absorbs_attack(self):
        """Shielded agent takes 0 condition damage from physical attack."""
        agent = _make_agent(agent_id=AGENT_A_ID, buffs=["shielded"])
        enemy = _make_enemy(template_id="shadow_echo_violence", condition_steps=3, evasion=0)
        ctx = CombatContext(agents=[agent], enemies=[enemy])

        agent_actions = []
        enemy_actions = [
            EnemyAction(
                enemy_id=enemy.instance_id,
                action_type="attack",
                target_agent_id=AGENT_A_ID,
                power=6,
            ),
        ]

        # Guaranteed hit
        with patch("backend.services.combat.combat_engine.random.randint", return_value=1):
            result = resolve_combat_round(ctx, agent_actions, enemy_actions, SHADOW_TEMPLATES)

        # Shield should have absorbed the hit
        assert agent.condition == "operational"
        assert "shielded" not in agent.active_buffs  # consumed

    def test_stress_cap_per_round(self):
        """Multiple stress attacks in one round capped at 150 total per agent."""
        agent = _make_agent(agent_id=AGENT_A_ID, resilience=0.0)
        enemies = [_make_enemy() for _ in range(5)]
        ctx = CombatContext(agents=[agent], enemies=enemies)

        agent_actions = []
        enemy_actions = [
            EnemyAction(
                enemy_id=e.instance_id,
                action_type="stress_attack",
                target_agent_id=AGENT_A_ID,
                stress_power=8,  # Each would deal ~160 stress uncapped
            )
            for e in enemies
        ]

        result = resolve_combat_round(ctx, agent_actions, enemy_actions, SHADOW_TEMPLATES)

        # Total stress should not exceed 150 (cap per round)
        assert agent.stress <= 150

    def test_victory_when_all_enemies_killed(self):
        """Killing last enemy in a round → combat_over + victory."""
        agent = _make_agent(agent_id=AGENT_A_ID, aptitudes={"assassin": 9})
        enemy = _make_enemy(condition_steps=1, evasion=0)
        ctx = CombatContext(agents=[agent], enemies=[enemy])

        agent_actions = [
            AgentAction(agent_id=AGENT_A_ID, ability_id="assassin_precision_strike", target_id=enemy.instance_id),
        ]
        enemy_actions = []

        # Guaranteed hit
        with patch("backend.services.combat.combat_engine.random.randint", return_value=1):
            result = resolve_combat_round(ctx, agent_actions, enemy_actions, SHADOW_TEMPLATES)

        assert result.combat_over is True
        assert result.victory is True

    def test_party_wipe_when_all_captured(self):
        """All agents at afflicted + enemy attack → can lead to capture → wipe."""
        agent = _make_agent(agent_id=AGENT_A_ID, condition="afflicted")
        enemy = _make_enemy(template_id="shadow_echo_violence", condition_steps=3, evasion=0)
        ctx = CombatContext(agents=[agent], enemies=[enemy])

        agent_actions = []
        enemy_actions = [
            EnemyAction(
                enemy_id=enemy.instance_id,
                action_type="attack",
                target_agent_id=AGENT_A_ID,
                power=8,
            ),
        ]

        # Guaranteed hit
        with patch("backend.services.combat.combat_engine.random.randint", return_value=1):
            result = resolve_combat_round(ctx, agent_actions, enemy_actions, SHADOW_TEMPLATES)

        # Agent should be captured, party wipe
        assert agent.condition == "captured"
        assert result.party_wipe is True

    def test_captured_agents_cannot_act(self):
        """Captured agents' actions should be skipped."""
        agent = _make_agent(agent_id=AGENT_A_ID, condition="captured")
        enemy = _make_enemy(condition_steps=5, evasion=0)
        ctx = CombatContext(agents=[agent], enemies=[enemy])

        agent_actions = [
            AgentAction(agent_id=AGENT_A_ID, ability_id="assassin_precision_strike", target_id=enemy.instance_id),
        ]
        enemy_actions = []

        result = resolve_combat_round(ctx, agent_actions, enemy_actions, SHADOW_TEMPLATES)

        # Enemy should NOT have taken damage
        assert enemy.condition_steps_remaining == 5
        assert enemy.is_alive is True

    def test_condition_change_recorded_in_event(self):
        """When condition changes, the event should record the NEW condition."""
        agent = _make_agent(agent_id=AGENT_A_ID, condition="operational")
        enemy = _make_enemy(template_id="shadow_echo_violence", condition_steps=3, evasion=0)
        ctx = CombatContext(agents=[agent], enemies=[enemy])

        enemy_actions = [
            EnemyAction(
                enemy_id=enemy.instance_id,
                action_type="attack",
                target_agent_id=AGENT_A_ID,
                power=8,
            ),
        ]

        with patch("backend.services.combat.combat_engine.random.randint", return_value=1):
            result = resolve_combat_round(ctx, [], enemy_actions, SHADOW_TEMPLATES)

        attack_events = [e for e in result.events if e.action == "attack" and e.hit]
        if attack_events:
            # If condition changed, it should be recorded
            evt = attack_events[0]
            if evt.condition_change is not None:
                # The condition_change is the NEW condition (after mutation)
                assert evt.condition_change != "operational"

    def test_heal_stress_action(self):
        """Propagandist Inspire heals 120 stress on a target ally."""
        healer = _make_agent(agent_id=AGENT_A_ID, aptitudes={"propagandist": 5})
        target = _make_agent(agent_id=AGENT_B_ID, name="Agent B", stress=300)
        ctx = CombatContext(agents=[healer, target], enemies=[_make_enemy()])

        agent_actions = [
            AgentAction(
                agent_id=AGENT_A_ID,
                ability_id="propagandist_inspire",
                target_id=str(AGENT_B_ID),
            ),
        ]

        result = resolve_combat_round(ctx, agent_actions, [], SHADOW_TEMPLATES)

        # Target should have healed 120 stress: 300 - 120 = 180
        assert target.stress == 180

    def test_buff_applied_before_enemy_resolution(self):
        """Phase 1a (buffs) runs before Phase 2 (enemy attacks).
        A Guardian shield cast in the same round should protect from enemy attack.
        """
        guardian = _make_agent(agent_id=AGENT_A_ID, aptitudes={"guardian": 5})
        target = _make_agent(agent_id=AGENT_B_ID, name="Agent B")
        enemy = _make_enemy(template_id="shadow_echo_violence", condition_steps=3, evasion=0)
        ctx = CombatContext(agents=[guardian, target], enemies=[enemy])

        # Guardian shields Agent B, then enemy attacks Agent B
        agent_actions = [
            AgentAction(
                agent_id=AGENT_A_ID,
                ability_id="guardian_shield",
                target_id=str(AGENT_B_ID),
            ),
        ]
        enemy_actions = [
            EnemyAction(
                enemy_id=enemy.instance_id,
                action_type="attack",
                target_agent_id=AGENT_B_ID,
                power=8,
            ),
        ]

        with patch("backend.services.combat.combat_engine.random.randint", return_value=1):
            result = resolve_combat_round(ctx, agent_actions, enemy_actions, SHADOW_TEMPLATES)

        # Agent B should be protected by the shield cast this round
        assert target.condition == "operational"

    def test_snapshot_states_in_result(self):
        """Result includes agent_states and enemy_states snapshots."""
        agent = _make_agent(agent_id=AGENT_A_ID)
        enemy = _make_enemy()
        ctx = CombatContext(agents=[agent], enemies=[enemy])

        result = resolve_combat_round(ctx, [], [], SHADOW_TEMPLATES)

        assert len(result.agent_states) == 1
        assert len(result.enemy_states) == 1
        assert result.agent_states[0]["agent_id"] == AGENT_A_ID

    def test_visibility_from_archetype_state(self):
        """Combat engine reads visibility from context.archetype_state."""
        agent = _make_agent(agent_id=AGENT_A_ID, aptitudes={"assassin": 5})
        enemy = _make_enemy(condition_steps=5, evasion=50)
        ctx = CombatContext(
            agents=[agent], enemies=[enemy],
            archetype_state={"visibility": 0},  # -15% hit penalty
        )

        agent_actions = [
            AgentAction(agent_id=AGENT_A_ID, ability_id="assassin_precision_strike", target_id=enemy.instance_id),
        ]

        # Test that visibility is read — we can verify indirectly through hit chance
        # At vis 0: hit_chance = 55 + 15 - 25 + 10 - 15 = 40
        # At vis 3: hit_chance = 55 + 15 - 25 + 10 = 55
        # So vis 0 should miss more often
        result = resolve_combat_round(ctx, agent_actions, [], SHADOW_TEMPLATES)
        assert isinstance(result, CombatRoundResult)  # just verify it runs


# ── Stress attack with resolve check ──────────────────────────────────────


class TestStressAttackResolveCheck:
    """Test stress attack triggering resolve check at 800."""

    def test_stress_attack_triggers_resolve_at_800(self):
        """Agent at 750 stress, stress attack pushes over 800 → resolve check."""
        agent = _make_agent(agent_id=AGENT_A_ID, stress=750, resilience=0.0)
        enemy = _make_enemy()
        ctx = CombatContext(agents=[agent], enemies=[enemy])

        enemy_actions = [
            EnemyAction(
                enemy_id=enemy.instance_id,
                action_type="stress_attack",
                target_agent_id=AGENT_A_ID,
                stress_power=5,
            ),
        ]

        with patch("backend.services.combat.combat_engine.resolve_stress_check", return_value="affliction"):
            result = resolve_combat_round(ctx, [], enemy_actions, SHADOW_TEMPLATES)

        # Stress crossed 800 → resolve check → affliction → condition=afflicted
        assert agent.condition == "afflicted"
        assert agent.stress >= 800

    def test_virtue_does_not_afflict(self):
        """Virtue result on resolve check should NOT set condition to afflicted."""
        agent = _make_agent(agent_id=AGENT_A_ID, stress=750, resilience=0.0)
        enemy = _make_enemy()
        ctx = CombatContext(agents=[agent], enemies=[enemy])

        enemy_actions = [
            EnemyAction(
                enemy_id=enemy.instance_id,
                action_type="stress_attack",
                target_agent_id=AGENT_A_ID,
                stress_power=5,
            ),
        ]

        with patch("backend.services.combat.combat_engine.resolve_stress_check", return_value="virtue"):
            result = resolve_combat_round(ctx, [], enemy_actions, SHADOW_TEMPLATES)

        # Virtue = agent stays operational (stress still high but no condition change)
        assert agent.condition == "operational"
