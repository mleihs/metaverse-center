#!/usr/bin/env python3
"""Measure dungeon combat instead of guessing at it.

Befund D13/D14 of the Systemprüfung asked for numbers: three of five difficulty
factors have no reader, and damage is effectively a bool. The plan itself says
"Balance messen (Sim-Skript über 100 Kämpfe)" — this is that script, and it is
the reason the numbers in `DIFFICULTY_MULTIPLIERS` and `_calculate_attack_damage`
can be chosen by measurement rather than by taste, now and whenever the content
packs change.

It drives the real engine: `resolve_combat_round`, the real ability registry,
the real enemy templates, the real spawn configs. Nothing is modelled twice —
a simulation that reimplements the thing it measures answers a question about
itself.

    .venv/bin/python scripts/simulate_dungeon_combat.py
    .venv/bin/python scripts/simulate_dungeon_combat.py --runs 500 --archetype "The Tower"
    .venv/bin/python scripts/simulate_dungeon_combat.py --json > before.json

Agents act on a fixed policy (strongest available damage ability at a living
enemy, guardians shield when someone is wounded). The policy is deliberately
dumb and deliberately CONSTANT: the point is to compare two versions of the
rules, not to find optimal play. A changing policy would move the baseline with
the change and measure nothing.
"""

from __future__ import annotations

import argparse
import json
import random
import statistics
import sys
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.models.combat import AgentCombatState  # noqa: E402
from backend.services.combat.ability_schools import get_agent_all_abilities  # noqa: E402
from backend.services.combat.combat_engine import (  # noqa: E402
    AgentAction,
    CombatContext,
    generate_enemy_actions,
    resolve_combat_round,
)
from backend.services.combat.condition_tracks import can_act  # noqa: E402
from backend.services.content_packs.loader import load_packs_for_tests  # noqa: E402
from backend.services.dungeon.dungeon_archetypes import (  # noqa: E402
    ARCHETYPE_CONFIGS,
    DIFFICULTY_MULTIPLIERS,
)
from backend.services.dungeon.dungeon_combat import spawn_enemies  # noqa: E402
from backend.services.dungeon_content_service import (  # noqa: E402
    get_enemy_registry,
    get_spawn_registry,
)

PARTY_SIZE = 4
MAX_ROUNDS = 10


@dataclass
class Outcome:
    victory: bool
    wipe: bool
    stalemate: bool
    rounds: int
    agent_severity: int  # summed condition severity of the party at the end
    stress_taken: int
    enemies_left: int


def _party() -> list[AgentCombatState]:
    """Four agents on the shared generalist baseline.

    Not randomised: two runs of the simulation must be comparable. The baseline
    is what most production agents actually have — 222 of 258 carry no assigned
    aptitudes at all.
    """
    from backend.models.aptitude import DEFAULT_APTITUDE_LEVEL, OPERATIVE_TYPES

    return [
        AgentCombatState(
            agent_id=uuid4(),
            agent_name=f"A{i}",
            stress=0,
            condition="operational",
            aptitudes=dict.fromkeys(OPERATIVE_TYPES, DEFAULT_APTITUDE_LEVEL),
            personality={},
            resilience=0.5,
        )
        for i in range(PARTY_SIZE)
    ]


def _choose_actions(agents, enemies, archetype: str) -> list[AgentAction]:
    """The fixed policy: focus fire without overkill.

    The first version of this function sent every agent at the weakest living
    enemy. Against a one-step minion that wastes three of four attacks, and the
    measurement said the party dealt one condition step per round — which
    contradicted the same run's two-round fights. The harness was wrong, not the
    engine. A player spreads once a target is dead; so does this.

    Still deliberately dumb (strongest damage ability, weakest target first) and
    deliberately CONSTANT: the point is to compare two versions of the rules.
    """
    living = sorted((e for e in enemies if e.is_alive), key=lambda e: e.condition_steps_remaining)
    if not living:
        return []

    actors = [a for a in agents if can_act(a.condition)]
    actions: list[AgentAction] = []
    target_index = 0
    committed = 0  # attacks already aimed at the current target

    for agent in actors:
        abilities = [
            a
            for a in get_agent_all_abilities(agent.aptitudes, archetype)
            if a.effect_type == "damage" and a.targets == "single_enemy"
        ]
        if not abilities:
            continue
        best = max(abilities, key=lambda a: a.effect_params.get("power", 0))

        # Move on once the current target has enough attacks aimed at it to
        # fall — one attack per remaining condition step, the same arithmetic a
        # player does by eye.
        while target_index < len(living) - 1 and committed >= living[target_index].condition_steps_remaining:
            target_index += 1
            committed = 0

        actions.append(
            AgentAction(
                agent_id=agent.agent_id,
                ability_id=best.id,
                target_id=living[target_index].instance_id,
            )
        )
        committed += 1
    return actions


def _one_fight(archetype: str, spawn_id: str, difficulty: int, depth: int) -> Outcome:
    from backend.services.combat.condition_tracks import CONDITION_SEVERITY

    agents = _party()
    enemies = spawn_enemies(spawn_id, difficulty, depth, archetype)
    if not enemies:
        return Outcome(False, False, True, 0, 0, 0, 0)

    templates = {
        tid: t.model_dump() if hasattr(t, "model_dump") else dict(t)
        for tid, t in get_enemy_registry().get(archetype, {}).items()
    }

    context = CombatContext(
        agents=agents,
        enemies=enemies,
        round_num=1,
        max_rounds=MAX_ROUNDS,
        archetype_state=dict(ARCHETYPE_CONFIGS[archetype].get("mechanic_config", {})),
    )

    result = None
    for round_num in range(1, MAX_ROUNDS + 1):
        context.round_num = round_num
        agent_actions = _choose_actions(agents, enemies, archetype)
        enemy_actions = generate_enemy_actions(enemies, agents, context, templates)
        result = resolve_combat_round(context, agent_actions, enemy_actions, templates)
        if result.combat_over:
            break

    return Outcome(
        victory=bool(result and result.victory),
        wipe=bool(result and result.party_wipe),
        stalemate=bool(result and result.stalemate),
        rounds=context.round_num,
        agent_severity=sum(CONDITION_SEVERITY[a.condition] for a in agents),
        stress_taken=sum(a.stress for a in agents),
        enemies_left=sum(1 for e in enemies if e.is_alive),
    )


def measure(archetypes: list[str], runs: int, seed: int) -> dict:
    random.seed(seed)
    report: dict = {}
    for difficulty in sorted(DIFFICULTY_MULTIPLIERS):
        depth = int(DIFFICULTY_MULTIPLIERS[difficulty]["depth"])
        outcomes: list[Outcome] = []
        for archetype in archetypes:
            spawns = list(get_spawn_registry().get(archetype, {}))
            if not spawns:
                continue
            for _ in range(runs):
                outcomes.append(_one_fight(archetype, random.choice(spawns), difficulty, depth))
        if not outcomes:
            continue
        n = len(outcomes)
        report[difficulty] = {
            "fights": n,
            "win_rate": round(sum(o.victory for o in outcomes) / n, 3),
            "wipe_rate": round(sum(o.wipe for o in outcomes) / n, 3),
            "stalemate_rate": round(sum(o.stalemate for o in outcomes) / n, 3),
            "median_rounds": statistics.median(o.rounds for o in outcomes),
            "median_party_severity": statistics.median(o.agent_severity for o in outcomes),
            "median_stress_taken": statistics.median(o.stress_taken for o in outcomes),
        }
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--runs", type=int, default=100, help="fights per archetype per difficulty")
    parser.add_argument("--archetype", action="append", help="restrict to one archetype (repeatable)")
    parser.add_argument("--seed", type=int, default=20260831, help="fixed so two runs compare")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    args = parser.parse_args(argv)

    load_packs_for_tests()
    archetypes = args.archetype or sorted(ARCHETYPE_CONFIGS)
    report = measure(archetypes, args.runs, args.seed)

    if args.json:
        print(json.dumps(report, indent=2))
        return 0

    print(
        f"Archetypen: {len(archetypes)}   Kämpfe je Stufe: {report[1]['fights'] if report else 0}   Saat: {args.seed}\n"
    )
    print(f"{'Stufe':>6} {'Sieg':>7} {'Wipe':>7} {'Patt':>7} {'Runden':>8} {'Gruppe∅':>9} {'Stress':>8}")
    print("─" * 56)
    for difficulty, row in sorted(report.items()):
        print(
            f"{difficulty:>6} {row['win_rate']:>7.0%} {row['wipe_rate']:>7.0%}"
            f" {row['stalemate_rate']:>7.0%} {row['median_rounds']:>8.0f}"
            f" {row['median_party_severity']:>9.0f} {row['median_stress_taken']:>8.0f}"
        )
    print("\nGruppe∅ = Summe der Zustandsschwere der vier Agenten (0 = unversehrt, 16 = alle gefangen)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
