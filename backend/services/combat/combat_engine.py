"""Combat engine — stateless round resolver for phase-based combat.

This module resolves a single combat round given the current state and
submitted actions. It does NOT manage state — the caller (DungeonEngineService
or future War Room Ops) owns the state machine.

Flow per round:
  ASSESSMENT (auto) → PLANNING (30s) → RESOLUTION (simultaneous) → OUTCOME

Resolution is simultaneous: all agent actions and enemy actions resolve
at the same time. Order within simultaneous resolution:
1. Apply buffs/debuffs (guardian shields, saboteur traps, etc.)
2. Resolve attacks (agents and enemies simultaneously)
3. Apply stress damage
4. Check condition transitions
5. Check resolve checks (stress >= 800)
6. Check victory/wipe conditions
"""

from __future__ import annotations

import logging
import random
from dataclasses import dataclass, field, replace
from uuid import UUID

import sentry_sdk

from backend.models.combat import AgentCombatState, EnemyInstance
from backend.services.combat.ability_schools import Ability, get_ability_by_id
from backend.services.combat.condition_tracks import apply_condition_damage, can_act
from backend.services.combat.stress_system import (
    STRESS_CAP_PER_ROUND,
    apply_stress,
    calculate_stress_damage,
    resolve_stress_check,
)

logger = logging.getLogger(__name__)


# ── Data Structures ─────────────────────────────────────────────────────────


@dataclass
class CombatContext:
    """Mutable context for a combat round resolution."""

    agents: list[AgentCombatState]
    enemies: list[EnemyInstance]
    round_num: int = 1
    max_rounds: int = 10
    archetype_state: dict = field(default_factory=dict)
    is_ambush: bool = False  # enemies get free first action
    trap_deployed: bool = False  # party-level trap: first enemy to act triggers it


@dataclass
class AgentAction:
    """Parsed agent action for resolution."""

    agent_id: UUID
    ability_id: str
    target_id: str | None = None


@dataclass
class EnemyAction:
    """Generated enemy action for resolution."""

    enemy_id: str
    action_type: str  # "attack", "stress_attack", "defend", "special"
    target_agent_id: UUID | None = None
    power: int = 0
    stress_power: int = 0
    special_params: dict = field(default_factory=dict)
    telegraphed_intent: str = ""


@dataclass
class CombatEvent:
    """Single event within a combat round (for narrative generation)."""

    actor: str  # agent name or enemy name
    action: str  # ability/action name (EN, used for event type detection)
    target: str  # target name (EN)
    hit: bool = True
    damage_steps: int = 0
    stress_delta: int = 0
    condition_change: str | None = None
    resolve_result: str | None = None  # "virtue" or "affliction"
    narrative_en: str = ""
    narrative_de: str = ""


@dataclass
class CombatRoundResult:
    """Result of resolving one combat round."""

    round_num: int
    events: list[CombatEvent] = field(default_factory=list)
    agent_states: list[dict] = field(default_factory=list)  # updated agent snapshots
    enemy_states: list[dict] = field(default_factory=list)  # updated enemy snapshots
    combat_over: bool = False
    victory: bool = False
    party_wipe: bool = False
    stalemate: bool = False
    narrative_summary_en: str = ""
    narrative_summary_de: str = ""


# ── Buff/Debuff Resolution ─────────────────────────────────────────────────


def has_buff(agent: AgentCombatState, buff_id: str) -> bool:
    """Check if an agent has a specific active buff."""
    return buff_id in agent.active_buffs


def has_debuff(enemy: EnemyInstance, debuff_id: str) -> bool:
    """Check if an enemy has a specific active debuff/effect."""
    return debuff_id in enemy.active_effects


def _apply_buff(target: AgentCombatState, buff_id: str) -> None:
    """Apply a buff to the target agent (idempotent)."""
    if buff_id not in target.active_buffs:
        target.active_buffs.append(buff_id)


def _consume_buff(target: AgentCombatState, buff_id: str) -> bool:
    """Remove a buff from the target agent. Returns True if buff was present."""
    try:
        target.active_buffs.remove(buff_id)
        return True
    except ValueError:
        return False


def _apply_debuff_to_enemy(enemy: EnemyInstance, debuff_id: str) -> None:
    """Apply a debuff/effect to an enemy."""
    if debuff_id not in enemy.active_effects:
        enemy.active_effects.append(debuff_id)


# ── Hit/Damage Calculations ─────────────────────────────────────────────────


def _calculate_hit_chance(
    attacker_aptitude: int,
    defender_evasion: int,
    *,
    hit_bonus: int = 0,
    visibility: int = 3,
) -> int:
    """Calculate hit chance percentage.

    Formula: 55 + (aptitude * 3) - (evasion * 0.5) + hit_bonus
    Shadow: visibility 0 gives -15% penalty.
    Floor 10%, cap 95%.
    """
    chance = 55 + (attacker_aptitude * 3) - int(defender_evasion * 0.5) + hit_bonus
    if visibility == 0:
        chance -= 15
    return max(10, min(95, chance))


def _calculate_attack_damage(
    attacker_power: int,
    is_vulnerable: bool,
    is_resistant: bool,
    *,
    bonus_steps: int = 0,
) -> int:
    """Calculate condition step damage.

    Base 1, +1 if power >= 7, +1 vulnerability, -1 resistance, +bonus.
    Review #10: Capped at 2 (applied in condition_tracks.apply_condition_damage).
    """
    base = 1
    if attacker_power >= 7:
        base = 2
    if is_vulnerable:
        base += 1
    if is_resistant:
        base = max(1, base - 1)
    base += bonus_steps
    return max(1, base)


# ── Enemy AI ────────────────────────────────────────────────────────────────


def generate_enemy_actions(
    enemies: list[EnemyInstance],
    agents: list[AgentCombatState],
    context: CombatContext,
    enemy_templates: dict[str, dict],
) -> list[EnemyAction]:
    """Generate actions for all living enemies using weighted random from templates.

    Args:
        enemies: Current enemy instances.
        agents: Current agent states (for target selection).
        context: Combat context (round, archetype state).
        enemy_templates: Dict of template_id -> template data with action_weights.

    Returns:
        List of EnemyAction, one per living enemy.
    """
    actions: list[EnemyAction] = []
    alive_agents = [a for a in agents if can_act(a.condition)]

    if not alive_agents:
        return actions

    for enemy in enemies:
        if not enemy.is_alive:
            continue

        template = enemy_templates.get(enemy.template_id, {})
        weights = template.get("action_weights", {"attack": 50, "stress_attack": 30, "defend": 20})

        # Weighted random action selection
        action_types = list(weights.keys())
        action_wts = list(weights.values())
        chosen = random.choices(action_types, weights=action_wts, k=1)[0]

        # Target selection: taunt overrides random selection
        taunters = [a for a in alive_agents if has_buff(a, "taunting")]
        if taunters:
            target = taunters[0]  # Taunt forces all enemies to target the taunter
        else:
            # Skip untargetable (evasive) agents for targeted attacks
            targetable = [a for a in alive_agents if not has_buff(a, "evasive")]
            target = random.choice(targetable) if targetable else random.choice(alive_agents)

        action = EnemyAction(
            enemy_id=enemy.instance_id,
            action_type=chosen,
            target_agent_id=target.agent_id,
            power=template.get("attack_power", 3),
            stress_power=template.get("stress_attack_power", 3),
        )

        # Generate telegraphed intent (Into the Breach style)
        if template.get("telegraphed_intent", True):
            intent_map = {
                "attack": f"will attack {target.agent_name}",
                "stress_attack": f"preparing stress attack on {target.agent_name}",
                "defend": "bracing for impact",
                "evade": "preparing to evade",
                "grapple": f"reaching for {target.agent_name}",
                "summon_wisps": "gathering shadow energy",
                "aoe_fear": "radiating dread",
                "disinformation": "whispering lies",
                "hide": "fading into shadow",
                "ambient": "watching silently",
            }
            action.telegraphed_intent = intent_map.get(chosen, f"preparing {chosen}")

        actions.append(action)

    return actions


# ── Phase Resolution Functions ──────────────────────────────────────────────


def _resolve_agent_actions(
    agent_actions: list[AgentAction],
    context: CombatContext,
    enemy_templates: dict[str, dict],
    visibility: int,
    agent_map: dict[str, AgentCombatState],
    enemy_map: dict[str, EnemyInstance],
) -> list[CombatEvent]:
    """Phase 1: Resolve all agent actions (buffs, attacks, heals, debuffs).

    Buffs are applied first so they take effect for the same round's
    enemy resolution phase.
    """
    events: list[CombatEvent] = []

    # Sub-phase 1a: Apply buff/debuff/utility effects
    for action in agent_actions:
        agent = agent_map.get(str(action.agent_id))
        if not agent or not can_act(agent.condition):
            continue

        ability = get_ability_by_id(action.ability_id)
        if not ability or ability.effect_type not in ("buff", "debuff", "utility"):
            continue

        buff_id = ability.effect_params.get("buff")
        debuff_id = ability.effect_params.get("debuff")

        if buff_id:
            if ability.targets == "self":
                _apply_buff(agent, buff_id)
            elif ability.targets == "single_ally" and action.target_id:
                target_agent = agent_map.get(action.target_id)
                if target_agent:
                    _apply_buff(target_agent, buff_id)

        # Utility: visibility restore (Observe — Shadow only)
        narrative_suffix_en = ""
        narrative_suffix_de = ""
        vis_restore = ability.effect_params.get("visibility_restore", 0)
        if vis_restore and "visibility" in context.archetype_state:
            current_vis = context.archetype_state.get("visibility", 3)
            max_vis = context.archetype_state.get("max_visibility", 3)
            new_vis = min(max_vis, current_vis + vis_restore)
            context.archetype_state["visibility"] = new_vis
            narrative_suffix_en = f" +{vis_restore} Visibility."
            narrative_suffix_de = f" +{vis_restore} Sichtbarkeit."

        # Utility: stability restore (Reinforce — Tower only)
        # Blocked during Structural Failure (stability 0): nothing left to reinforce.
        stab_restore = ability.effect_params.get("stability_restore", 0)
        if stab_restore and context.archetype_state.get("max_stability") is not None:
            current_stab = context.archetype_state.get("stability", 100)
            if current_stab <= 0:
                narrative_suffix_en = " Structural failure. Nothing left to reinforce."
                narrative_suffix_de = " Strukturversagen. Nichts mehr zu verstärken."
            else:
                max_stab = context.archetype_state.get("max_stability", 100)
                new_stab = min(max_stab, current_stab + stab_restore)
                context.archetype_state["stability"] = new_stab
                narrative_suffix_en = f" +{stab_restore} Stability ({current_stab} \u2192 {new_stab})."
                narrative_suffix_de = f" +{stab_restore} Stabilität ({current_stab} \u2192 {new_stab})."

        # Utility: trap deployment (Deploy Trap — self-targeting, party-level)
        if ability.effect_params.get("trap"):
            context.trap_deployed = True
            narrative_suffix_en = " Trap set."
            narrative_suffix_de = " Falle gelegt."

        if debuff_id and action.target_id:
            target_enemy = enemy_map.get(action.target_id)
            if target_enemy:
                _apply_debuff_to_enemy(target_enemy, debuff_id)

        # Resolve target name for display (not raw ID)
        if ability.targets == "self":
            target_name = agent.agent_name
        elif ability.targets in ("single_ally", "all_allies") and action.target_id:
            ally = agent_map.get(action.target_id)
            target_name = ally.agent_name if ally else action.target_id
        elif action.target_id:
            enemy = enemy_map.get(action.target_id)
            target_name = enemy.name_en if enemy else action.target_id
        else:
            target_name = "self"

        events.append(
            CombatEvent(
                actor=agent.agent_name,
                action=ability.name_en,
                target=target_name,
                narrative_en=f"{agent.agent_name} uses {ability.name_en}.{narrative_suffix_en}",
                narrative_de=f"{agent.agent_name} setzt {ability.name_de} ein.{narrative_suffix_de}",
            )
        )

    # Sub-phase 1b: Resolve damage/heal/stress actions
    for action in agent_actions:
        agent = agent_map.get(str(action.agent_id))
        if not agent or not can_act(agent.condition):
            continue

        ability = get_ability_by_id(action.ability_id)
        if not ability or ability.effect_type in ("buff", "debuff", "utility"):
            continue  # already handled in 1a

        if ability.effect_type == "damage":
            if ability.effect_params.get("aoe") or ability.targets == "all_enemies":
                # AoE: resolve damage against every alive enemy
                for enemy in enemy_map.values():
                    if enemy.is_alive:
                        aoe_action = AgentAction(
                            agent_id=action.agent_id, ability_id=action.ability_id, target_id=enemy.instance_id
                        )
                        events.extend(
                            _resolve_agent_damage(
                                agent, ability, aoe_action, enemy_map, enemy_templates,
                                visibility, context.round_num, context.archetype_state,
                            )
                        )
            else:
                events.extend(
                    _resolve_agent_damage(
                        agent, ability, action, enemy_map, enemy_templates,
                        visibility, context.round_num, context.archetype_state,
                    )
                )
        elif ability.effect_type == "heal_stress":
            events.extend(_resolve_agent_heal(agent, ability, action, context, agent_map))
        elif ability.effect_type == "stress_damage":
            events.extend(_resolve_agent_stress_damage(agent, ability, action, enemy_map))

    return events


def _resolve_agent_damage(
    agent: AgentCombatState,
    ability: Ability,
    action: AgentAction,
    enemy_map: dict[str, EnemyInstance],
    enemy_templates: dict[str, dict],
    visibility: int,
    round_num: int = 1,
    archetype_state: dict | None = None,
) -> list[CombatEvent]:
    """Resolve a single agent damage action against an enemy."""
    target_enemy = enemy_map.get(action.target_id or "")
    if not target_enemy or not target_enemy.is_alive:
        return []

    # Ambush Strike: only usable in round 1 or at visibility 0.
    # Outside these conditions the ability degrades to a weaker strike
    # (base power without the ambush bonus).
    if ability.effect_params.get("requires_first_round_or_dark"):
        if round_num > 1 and visibility > 0:
            # Not round 1 and not in darkness — degrade to half power
            degraded_power = max(3, ability.effect_params.get("power", 5) // 2)
            ability = replace(ability, effect_params={**ability.effect_params, "power": degraded_power})

    template = enemy_templates.get(target_enemy.template_id, {})
    school = ability.school
    is_vulnerable = school in template.get("vulnerabilities", [])
    is_resistant = school in template.get("resistances", [])

    aptitude = agent.aptitudes.get(school, 3)
    hit_bonus = ability.effect_params.get("hit_bonus", 0)

    # Lucid Dreaming bonus (Awakening): awareness ≥ 70 → +10% effective aptitude
    if archetype_state and archetype_state.get("awareness", 0) >= 70:
        aptitude = int(aptitude * 1.10)

    # Disrupted enemies have reduced evasion
    effective_evasion = target_enemy.evasion
    if has_debuff(target_enemy, "disrupted"):
        effective_evasion = max(0, effective_evasion - 15)

    hit_chance = _calculate_hit_chance(aptitude, effective_evasion, hit_bonus=hit_bonus, visibility=visibility)
    hit = random.randint(1, 100) <= hit_chance

    damage_steps = 0
    if hit:
        power = ability.effect_params.get("power", aptitude)
        bonus = ability.effect_params.get("bonus_vs_debuffed", 0) if target_enemy.active_effects else 0
        damage_steps = _calculate_attack_damage(power, is_vulnerable, is_resistant, bonus_steps=bonus)
        target_enemy.condition_steps_remaining -= damage_steps
        if target_enemy.condition_steps_remaining <= 0:
            target_enemy.is_alive = False

    # Build narrative
    if hit:
        killed = not target_enemy.is_alive
        narrative_en = f"{agent.agent_name} strikes {target_enemy.name_en} with {ability.name_en}. {damage_steps} step{'s' if damage_steps != 1 else ''} of damage."
        if killed:
            narrative_en += f" {target_enemy.name_en} is defeated!"
        narrative_de = f"{agent.agent_name} trifft {target_enemy.name_de} mit {ability.name_de}. {damage_steps} Stufe{'n' if damage_steps != 1 else ''} Schaden."
        if killed:
            narrative_de += f" {target_enemy.name_de} ist besiegt!"
    else:
        narrative_en = f"{agent.agent_name}'s {ability.name_en} misses {target_enemy.name_en}."
        narrative_de = f"{agent.agent_name}s {ability.name_de} verfehlt {target_enemy.name_de}."

    return [
        CombatEvent(
            actor=agent.agent_name,
            action=ability.name_en,
            target=target_enemy.name_en,
            hit=hit,
            damage_steps=damage_steps if hit else 0,
            narrative_en=narrative_en,
            narrative_de=narrative_de,
        )
    ]


def _resolve_agent_heal(
    agent: AgentCombatState,
    ability: Ability,
    action: AgentAction,
    context: CombatContext,
    agent_map: dict[str, AgentCombatState],
) -> list[CombatEvent]:
    """Resolve a stress heal action."""
    heal_amount = ability.effect_params.get("stress_heal", 60)

    if ability.targets == "all_allies":
        for ally in context.agents:
            if can_act(ally.condition):
                ally.stress, _ = apply_stress(ally.stress, -heal_amount, cap_per_round=False)
        return [
            CombatEvent(
                actor=agent.agent_name,
                action=ability.name_en,
                target="party",
                stress_delta=-heal_amount,
                narrative_en=f"{agent.agent_name} rallies the party with {ability.name_en}. {heal_amount} stress recovered for all.",
                narrative_de=f"{agent.agent_name} sammelt die Gruppe mit {ability.name_de}. {heal_amount} Stress fur alle geheilt.",
            )
        ]

    if action.target_id:
        target_agent = agent_map.get(action.target_id)
        if target_agent and can_act(target_agent.condition):
            target_agent.stress, _ = apply_stress(target_agent.stress, -heal_amount, cap_per_round=False)
            return [
                CombatEvent(
                    actor=agent.agent_name,
                    action=ability.name_en,
                    target=target_agent.agent_name,
                    stress_delta=-heal_amount,
                    narrative_en=f"{agent.agent_name} inspires {target_agent.agent_name}. {heal_amount} stress recovered.",
                    narrative_de=f"{agent.agent_name} inspiriert {target_agent.agent_name}. {heal_amount} Stress geheilt.",
                )
            ]

    return []


def _resolve_agent_stress_damage(
    agent: AgentCombatState,
    ability: Ability,
    action: AgentAction,
    enemy_map: dict[str, EnemyInstance],
) -> list[CombatEvent]:
    """Resolve a stress damage action against an enemy.

    Enemies don't have a stress system, so stress_damage abilities
    apply a debuff (e.g. 'demoralized') that reduces attack_power,
    and deal 1 condition step as psychological warfare damage.
    """
    target_enemy = enemy_map.get(action.target_id or "")
    if not target_enemy or not target_enemy.is_alive:
        return []

    # Apply debuff if specified (e.g. "demoralized" from Demoralize)
    debuff_id = ability.effect_params.get("debuff")
    if debuff_id:
        _apply_debuff_to_enemy(target_enemy, debuff_id)

    # Stress attacks deal 1 condition step to enemy (psychological warfare)
    target_enemy.condition_steps_remaining -= 1
    killed = target_enemy.condition_steps_remaining <= 0
    if killed:
        target_enemy.is_alive = False

    narrative_en = f"{agent.agent_name} demoralizes {target_enemy.name_en} with {ability.name_en}. 1 step of damage."
    narrative_de = f"{agent.agent_name} demoralisiert {target_enemy.name_de} mit {ability.name_de}. 1 Stufe Schaden."
    if killed:
        narrative_en += f" {target_enemy.name_en} is defeated!"
        narrative_de += f" {target_enemy.name_de} ist besiegt!"

    return [
        CombatEvent(
            actor=agent.agent_name,
            action=ability.name_en,
            target=target_enemy.name_en,
            damage_steps=1,
            narrative_en=narrative_en,
            narrative_de=narrative_de,
        )
    ]


def _resolve_enemy_actions(
    enemy_actions: list[EnemyAction],
    context: CombatContext,
    enemy_templates: dict[str, dict],
    visibility: int,
    agent_map: dict[str, AgentCombatState],
    enemy_map: dict[str, EnemyInstance],
    round_stress: dict[str, int],
) -> list[CombatEvent]:
    """Phase 2: Resolve all enemy actions (attacks, stress attacks, defense)."""
    events: list[CombatEvent] = []

    for action in enemy_actions:
        enemy = enemy_map.get(action.enemy_id)
        if not enemy or not enemy.is_alive:
            continue

        target_agent = agent_map.get(str(action.target_agent_id)) if action.target_agent_id else None
        if not target_agent or not can_act(target_agent.condition):
            continue

        # Trap trigger: party-level flag, first enemy to act springs it
        if context.trap_deployed:
            context.trap_deployed = False  # Consumed — one-shot per Deploy Trap
            enemy.condition_steps_remaining -= 1
            killed_by_trap = enemy.condition_steps_remaining <= 0
            if killed_by_trap:
                enemy.is_alive = False
            events.append(
                CombatEvent(
                    actor="Trap",
                    action="detonate",
                    target=enemy.name_en,
                    hit=True,
                    damage_steps=1,
                    narrative_en=f"A trap springs on {enemy.name_en}! 1 step of damage.{' Defeated!' if killed_by_trap else ''}",
                    narrative_de=f"Eine Falle schnappt bei {enemy.name_de} zu! 1 Stufe Schaden.{' Besiegt!' if killed_by_trap else ''}",
                )
            )
            if killed_by_trap:
                continue

        if action.action_type == "attack":
            events.extend(_resolve_enemy_attack(enemy, action, target_agent, enemy_templates, visibility))
        elif action.action_type == "stress_attack":
            events.extend(_resolve_enemy_stress_attack(enemy, action, target_agent, round_stress))
        elif action.action_type == "defend":
            events.append(
                CombatEvent(
                    actor=enemy.name_en,
                    action="defend",
                    target="self",
                    narrative_en=f"{enemy.name_en} braces for impact.",
                    narrative_de=f"{enemy.name_de} bereitet sich auf einen Treffer vor.",
                )
            )

    return events


def _resolve_enemy_attack(
    enemy: EnemyInstance,
    action: EnemyAction,
    target_agent: AgentCombatState,
    enemy_templates: dict[str, dict],
    visibility: int,
) -> list[CombatEvent]:
    """Resolve a single enemy physical attack."""
    # Evasive agents get bonus evasion; taunting agents get bonus evasion too
    target_evasion = 0
    if has_buff(target_agent, "evasive"):
        target_evasion += 30
    if has_buff(target_agent, "taunting"):
        target_evasion += 20
    hit_chance = _calculate_hit_chance(action.power, target_evasion, visibility=visibility)
    hit = random.randint(1, 100) <= hit_chance

    if not hit:
        return [
            CombatEvent(
                actor=enemy.name_en,
                action="attack",
                target=target_agent.agent_name,
                hit=False,
                narrative_en=f"{enemy.name_en}'s attack misses {target_agent.agent_name}.",
                narrative_de=f"{enemy.name_de}s Angriff verfehlt {target_agent.agent_name}.",
            )
        ]

    # Check for guardian shield via buff pipeline — one-shot: consume on use
    if has_buff(target_agent, "shielded"):
        _consume_buff(target_agent, "shielded")
        return [
            CombatEvent(
                actor=enemy.name_en,
                action="attack",
                target=target_agent.agent_name,
                hit=True,
                damage_steps=0,
                narrative_en=f"Guardian's shield absorbs the blow aimed at {target_agent.agent_name}.",
                narrative_de=f"Der Schild des Waechters absorbiert den Schlag auf {target_agent.agent_name}.",
            )
        ]

    template = enemy_templates.get(enemy.template_id, {})
    aptitude = template.get("attack_aptitude", "assassin")
    is_vulnerable = aptitude in [s for s, v in target_agent.aptitudes.items() if v <= 2]

    # Demoralized enemies have reduced attack power
    effective_power = action.power
    if has_debuff(enemy, "demoralized"):
        effective_power = max(1, effective_power - 1)

    damage_steps = _calculate_attack_damage(effective_power, is_vulnerable, False)

    # Fortified agents reduce incoming damage
    if has_buff(target_agent, "fortified"):
        damage_steps = max(0, damage_steps - 1)
        if damage_steps == 0:
            return [
                CombatEvent(
                    actor=enemy.name_en,
                    action="attack",
                    target=target_agent.agent_name,
                    hit=True,
                    damage_steps=0,
                    narrative_en=f"{target_agent.agent_name}'s fortification absorbs {enemy.name_en}'s attack.",
                    narrative_de=f"{target_agent.agent_name}s Befestigung absorbiert {enemy.name_de}s Angriff.",
                )
            ]

    old_condition = target_agent.condition
    new_condition, side_effects = apply_condition_damage(target_agent.condition, damage_steps)
    target_agent.condition = new_condition

    if side_effects.get("stress_delta"):
        target_agent.stress, _ = apply_stress(
            target_agent.stress,
            side_effects["stress_delta"],
        )

    condition_changed = new_condition != old_condition
    narrative_en = f"{enemy.name_en} attacks {target_agent.agent_name}. {damage_steps} step{'s' if damage_steps != 1 else ''} of damage."
    if condition_changed:
        narrative_en += f" Condition: {new_condition}."
    narrative_de = f"{enemy.name_de} greift {target_agent.agent_name} an. {damage_steps} Stufe{'n' if damage_steps != 1 else ''} Schaden."
    if condition_changed:
        narrative_de += f" Zustand: {new_condition}."

    return [
        CombatEvent(
            actor=enemy.name_en,
            action="attack",
            target=target_agent.agent_name,
            hit=True,
            damage_steps=damage_steps,
            condition_change=new_condition if condition_changed else None,
            narrative_en=narrative_en,
            narrative_de=narrative_de,
        )
    ]


def _resolve_enemy_stress_attack(
    enemy: EnemyInstance,
    action: EnemyAction,
    target_agent: AgentCombatState,
    round_stress: dict[str, int],
) -> list[CombatEvent]:
    """Resolve a single enemy stress attack."""
    shielded = has_buff(target_agent, "shielded")
    stress_dmg = calculate_stress_damage(
        action.stress_power,
        target_agent.resilience,
        target_agent.personality.get("neuroticism", 0.5),
        has_guardian_shield=shielded,
    )
    # Consume shield on stress attack too (one-shot protection: condition + stress)
    if shielded and "shielded" in target_agent.active_buffs:
        _consume_buff(target_agent, "shielded")

    agent_key = str(target_agent.agent_id)
    current_round_stress = round_stress.get(agent_key, 0)
    capped_stress = min(stress_dmg, STRESS_CAP_PER_ROUND - current_round_stress)

    if capped_stress <= 0:
        return []

    target_agent.stress, triggers_resolve = apply_stress(
        target_agent.stress,
        capped_stress,
    )
    round_stress[agent_key] = current_round_stress + capped_stress

    resolve_result = None
    if triggers_resolve:
        resolve_result = resolve_stress_check()
        if resolve_result == "affliction":
            target_agent.condition = "afflicted"
            # Apply affliction side effects: stress floor at 800
            target_agent.stress = max(target_agent.stress, 800)

    narrative_en = f"{enemy.name_en} pressures {target_agent.agent_name}. +{capped_stress} stress."
    narrative_de = f"{enemy.name_de} setzt {target_agent.agent_name} unter Druck. +{capped_stress} Stress."
    if resolve_result == "affliction":
        narrative_en += f" {target_agent.agent_name} succumbs to affliction!"
        narrative_de += f" {target_agent.agent_name} erliegt einer Affliction!"
    elif resolve_result == "virtue":
        narrative_en += f" {target_agent.agent_name} finds inner strength!"
        narrative_de += f" {target_agent.agent_name} findet innere Starke!"

    return [
        CombatEvent(
            actor=enemy.name_en,
            action="stress attack",
            target=target_agent.agent_name,
            stress_delta=capped_stress,
            resolve_result=resolve_result,
            narrative_en=narrative_en,
            narrative_de=narrative_de,
        )
    ]


def _check_victory_conditions(context: CombatContext) -> tuple[bool, bool, bool, bool]:
    """Phase 3: Check if combat is over.

    Returns:
        Tuple of (combat_over, victory, party_wipe, stalemate).
        Victory/wipe take priority over stalemate: if the last round
        kills all enemies, that's a victory even at max_rounds.
    """
    all_enemies_dead = all(not e.is_alive for e in context.enemies)
    all_agents_down = all(not can_act(a.condition) for a in context.agents)

    if all_enemies_dead:
        return True, True, False, False
    if all_agents_down:
        return True, False, True, False
    if context.round_num >= context.max_rounds:
        return True, False, False, True
    return False, False, False, False


# ── Round Resolution (orchestrator) ────────────────────────────────────────


def resolve_combat_round(
    context: CombatContext,
    agent_actions: list[AgentAction],
    enemy_actions: list[EnemyAction],
    enemy_templates: dict[str, dict],
) -> CombatRoundResult:
    """Resolve one combat round simultaneously.

    Delegates to phase functions:
      Phase 1: _resolve_agent_actions (buffs first, then damage/heal)
      Phase 2: _resolve_enemy_actions (attacks, stress, defense)
      Phase 3: _check_victory_conditions

    Args:
        context: Current combat state.
        agent_actions: Submitted agent actions.
        enemy_actions: Generated enemy actions.
        enemy_templates: Template data for damage calculations.

    Returns:
        CombatRoundResult with all events and updated states.
    """
    result = CombatRoundResult(round_num=context.round_num)
    visibility = context.archetype_state.get("visibility", 3)

    # Enforce one action per agent per round — keep last submitted
    seen_agents: set[str] = set()
    deduped_actions: list[AgentAction] = []
    for action in reversed(agent_actions):
        key = str(action.agent_id)
        if key not in seen_agents:
            seen_agents.add(key)
            deduped_actions.append(action)
    agent_actions = list(reversed(deduped_actions))

    agent_map = {str(a.agent_id): a for a in context.agents}
    enemy_map = {e.instance_id: e for e in context.enemies}
    round_stress: dict[str, int] = {}

    try:
        # Phase 1: Agent actions (buffs → damage → heals)
        result.events.extend(
            _resolve_agent_actions(agent_actions, context, enemy_templates, visibility, agent_map, enemy_map)
        )

        # Phase 2: Enemy actions
        result.events.extend(
            _resolve_enemy_actions(
                enemy_actions, context, enemy_templates, visibility, agent_map, enemy_map, round_stress
            )
        )

        # Phase 2.5: Clear round-scoped buffs (all buffs are 1-round in Phase 0)
        for agent in context.agents:
            agent.active_buffs.clear()
        # Keep enemy debuffs for multi-round effects (analyzed, disrupted, demoralized)
        # but remove consumed ones (trapped is already removed on trigger)

        # Phase 3: Victory/wipe/stalemate check
        combat_over, victory, party_wipe, stalemate = _check_victory_conditions(context)
        result.combat_over = combat_over
        result.victory = victory
        result.party_wipe = party_wipe
        result.stalemate = stalemate

        # Snapshot updated states
        result.agent_states = [a.model_dump() for a in context.agents]
        result.enemy_states = [
            {
                "instance_id": e.instance_id,
                "is_alive": e.is_alive,
                "condition_steps_remaining": e.condition_steps_remaining,
            }
            for e in context.enemies
        ]

        # Build round narrative summary from event narratives
        narratives_en = [e.narrative_en for e in result.events if e.narrative_en]
        if narratives_en:
            result.narrative_summary_en = "\n".join(narratives_en)
        narratives_de = [e.narrative_de for e in result.events if e.narrative_de]
        if narratives_de:
            result.narrative_summary_de = "\n".join(narratives_de)

    except Exception:
        logger.exception("Combat resolution error in round %d", context.round_num)
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("service", "combat_engine")
            scope.set_tag("round", str(context.round_num))
            sentry_sdk.capture_exception()
        raise

    return result
