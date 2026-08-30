"""Ability cooldowns — the round resource combat was missing.

`AgentCombatState.cooldowns` has existed since the combat model was written. It
was read exactly once — `dungeon_checkpoint_service` builds `cooldown_remaining`
from it for the client — and written nowhere. So the complete cooldown UI in
`DungeonCombatBar.ts` (dimmed icon, remaining-rounds badge, aria label, the
`cooldown_remaining > 0` click guard) could never light up, and all 17 abilities
that declare a cooldown in `content/dungeon/**/abilities.yaml`, three ultimates
among them, were available every single round (Befund D2).

That left combat with no round resource at all: the optimal play was to fire the
strongest ability every round, every fight, forever.

## What a cooldown of N means here

`cooldown: N` blocks the ability for the next N rounds.

  Round 1  agent uses X (cooldown 2)   → after resolution: X = 2
  Round 2  X shows 2, blocked          → after resolution: X = 1
  Round 3  X shows 1, blocked          → after resolution: X = 0
  Round 4  X available again

The order inside `advance_cooldowns` matters and is the reason it is one
function rather than two calls at the call site: decrement FIRST (that ticks
down what earlier rounds set), then stamp what this round used. Doing it the
other way round would immediately tick a fresh `cooldown: 1` back to 0 and the
shortest cooldown in the game would do nothing.
"""

from __future__ import annotations

from collections.abc import Iterable

from backend.models.combat import AgentCombatState
from backend.services.combat.ability_schools import get_ability_by_id


def is_on_cooldown(agent: AgentCombatState, ability_id: str) -> int:
    """Rounds still to wait before ``ability_id`` may be used again (0 = ready)."""
    return max(0, agent.cooldowns.get(ability_id, 0))


def advance_cooldowns(
    party: Iterable[AgentCombatState],
    used: Iterable[tuple[str, str]],
) -> None:
    """Tick every cooldown down one round, then stamp the abilities just used.

    ``used`` is (agent_id, ability_id) pairs — the actions that actually made it
    into the round after validation, not what the client submitted.
    """
    used_by_agent: dict[str, set[str]] = {}
    for agent_id, ability_id in used:
        used_by_agent.setdefault(str(agent_id), set()).add(ability_id)

    for agent in party:
        # Tick down, dropping anything that reached zero so the dict does not
        # grow a permanent entry per ability ever used.
        agent.cooldowns = {
            ability_id: remaining - 1
            for ability_id, remaining in agent.cooldowns.items()
            if remaining - 1 > 0
        }

        for ability_id in used_by_agent.get(str(agent.agent_id), ()):
            ability = get_ability_by_id(ability_id)
            if ability and ability.cooldown > 0:
                agent.cooldowns[ability_id] = ability.cooldown
