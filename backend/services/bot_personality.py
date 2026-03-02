"""Bot personality archetypes — deterministic decision engine.

5 personalities with difficulty scaling. No LLM — fast, predictable, auditable.
Each personality implements allocate_rp(), select_targets(), manage_alliances().
"""

from __future__ import annotations

import logging
import secrets
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from backend.services.bot_game_state import BotGameState
from backend.services.epoch_service import OPERATIVE_RP_COSTS

logger = logging.getLogger(__name__)

_rng = secrets.SystemRandom()

# Difficulty scaling parameters
DIFFICULTY_PARAMS: dict[str, dict] = {
    "easy": {
        "rp_waste_pct": 0.30,
        "success_threshold": 0.0,   # Deploy at any %
        "use_intel": False,
        "optimal_targeting": False,
        "proactive_counter": False,
    },
    "medium": {
        "rp_waste_pct": 0.10,
        "success_threshold": 0.20,
        "use_intel": True,
        "optimal_targeting": False,
        "proactive_counter": False,
    },
    "hard": {
        "rp_waste_pct": 0.0,
        "success_threshold": 0.35,
        "use_intel": True,
        "optimal_targeting": True,
        "proactive_counter": True,
    },
}


@dataclass
class DeploymentPlan:
    """A single operative deployment decision."""

    operative_type: str
    agent_id: str
    target_simulation_id: str | None = None
    embassy_id: str | None = None
    cost_rp: int = 0


@dataclass
class AllianceAction:
    """An alliance management decision."""

    action: str  # "form", "join", "betray", "leave"
    target_simulation_id: str | None = None
    team_name: str | None = None


@dataclass
class BotDecisions:
    """Complete set of decisions for a bot's cycle turn."""

    deployments: list[DeploymentPlan] = field(default_factory=list)
    alliances: list[AllianceAction] = field(default_factory=list)
    rp_spent: int = 0
    reasoning: str = ""


class BotPersonality(ABC):
    """Abstract base class for bot decision-making personalities."""

    name: str = "base"

    def __init__(self, difficulty: str, config: dict | None = None):
        self.difficulty = difficulty
        self.config = config or {}
        self.params = DIFFICULTY_PARAMS.get(difficulty, DIFFICULTY_PARAMS["medium"])

    def decide(self, state: BotGameState) -> BotDecisions:
        """Full decision pipeline: allocate → target → alliance."""
        available_rp = state.current_rp
        available_rp = self._apply_difficulty_waste(available_rp)

        deployments = self._plan_deployments(state, available_rp)
        alliances = self.manage_alliances(state)

        total_spent = sum(d.cost_rp for d in deployments)
        return BotDecisions(
            deployments=deployments,
            alliances=alliances,
            rp_spent=total_spent,
            reasoning=self._explain(state, deployments, alliances),
        )

    @abstractmethod
    def _plan_deployments(self, state: BotGameState, available_rp: int) -> list[DeploymentPlan]:
        """Plan operative deployments within RP budget."""

    @abstractmethod
    def manage_alliances(self, state: BotGameState) -> list[AllianceAction]:
        """Decide alliance actions (form/join/betray/leave)."""

    def _apply_difficulty_waste(self, rp: int) -> int:
        """Easy bots randomly waste a portion of their RP."""
        waste_pct = self.params["rp_waste_pct"]
        if waste_pct > 0:
            wasted = int(rp * waste_pct * _rng.random())
            return rp - wasted
        return rp

    def _pick_target(self, state: BotGameState, strategy: str = "leader") -> str | None:
        """Select a target simulation based on strategy."""
        if strategy == "leader":
            return state.get_leader_sim_id()
        if strategy == "weakest":
            return state.get_weakest_opponent()
        if strategy == "random":
            opponents = state.get_opponent_sim_ids()
            return _rng.choice(opponents) if opponents else None
        return state.get_leader_sim_id()

    def _pick_agent(self, state: BotGameState) -> dict | None:
        """Pick an available agent for deployment."""
        available = state.get_available_agents()
        return _rng.choice(available) if available else None

    def _try_deploy(
        self,
        state: BotGameState,
        operative_type: str,
        target_sim_id: str | None,
        remaining_rp: int,
    ) -> DeploymentPlan | None:
        """Try to create a deployment plan, returning None if impossible."""
        cost = OPERATIVE_RP_COSTS.get(operative_type, 5)
        if cost > remaining_rp:
            return None

        agent = self._pick_agent(state)
        if not agent:
            return None

        # Guardians are self-deploy (no target/embassy)
        if operative_type == "guardian":
            return DeploymentPlan(
                operative_type="guardian",
                agent_id=agent["id"],
                target_simulation_id=None,
                embassy_id=None,
                cost_rp=cost,
            )

        # Offensive ops need an embassy to the target
        if not target_sim_id:
            return None
        embassy = state.get_embassy_for_target(target_sim_id)
        if not embassy:
            return None

        return DeploymentPlan(
            operative_type=operative_type,
            agent_id=agent["id"],
            target_simulation_id=target_sim_id,
            embassy_id=embassy["id"],
            cost_rp=cost,
        )

    def _explain(
        self, state: BotGameState, deployments: list[DeploymentPlan], alliances: list[AllianceAction]
    ) -> str:
        """Generate human-readable reasoning for the decision log."""
        parts = [f"[{self.name.upper()}@{self.difficulty}] Cycle {state.current_cycle}:"]
        if deployments:
            types = [d.operative_type for d in deployments]
            parts.append(f"Deploying {len(deployments)} operatives: {', '.join(types)}.")
        else:
            parts.append("No deployments this cycle.")
        if alliances:
            actions = [a.action for a in alliances]
            parts.append(f"Alliance actions: {', '.join(actions)}.")
        parts.append(f"RP: {state.current_rp} available.")
        return " ".join(parts)


# ══════════════════════════════════════════════════════════════
# Sentinel — Defensive specialist
# ══════════════════════════════════════════════════════════════


class SentinelPersonality(BotPersonality):
    """Defensive specialist. Deploys guardians first, spies second.

    Only goes offensive when leading or under sustained attack.
    Seeks alliances early and remains loyal.
    """

    name = "sentinel"

    def _plan_deployments(self, state: BotGameState, available_rp: int) -> list[DeploymentPlan]:
        plans: list[DeploymentPlan] = []
        rp = available_rp

        # Foundation phase: only guardians
        if state.epoch_phase == "foundation":
            while rp >= OPERATIVE_RP_COSTS["guardian"]:
                plan = self._try_deploy(state, "guardian", None, rp)
                if not plan:
                    break
                plans.append(plan)
                rp -= plan.cost_rp
            return plans

        # Priority 1: Guardians (50% of budget)
        guardian_budget = int(available_rp * 0.50)
        while rp > (available_rp - guardian_budget) and rp >= OPERATIVE_RP_COSTS["guardian"]:
            plan = self._try_deploy(state, "guardian", None, rp)
            if not plan:
                break
            plans.append(plan)
            rp -= plan.cost_rp

        # Priority 2: Spy on threats (25% of budget)
        if state.is_under_attack() and self.params["use_intel"]:
            # Spy on whoever is attacking us
            attackers = {m.get("source_simulation_id") for m in state.detected_enemy_ops}
            for attacker_id in attackers:
                if rp < OPERATIVE_RP_COSTS["spy"]:
                    break
                plan = self._try_deploy(state, "spy", attacker_id, rp)
                if plan:
                    plans.append(plan)
                    rp -= plan.cost_rp

        # Priority 3: Situational offense (only if leading and have RP left)
        rank = state.get_my_score_rank()
        if rank == 1 and rp >= OPERATIVE_RP_COSTS["saboteur"]:
            target = self._pick_target(state, "leader")  # Attack #2
            if target:
                plan = self._try_deploy(state, "saboteur", target, rp)
                if plan:
                    plans.append(plan)
                    rp -= plan.cost_rp

        return plans

    def manage_alliances(self, state: BotGameState) -> list[AllianceAction]:
        actions: list[AllianceAction] = []

        # Seek alliance early (foundation phase, no team yet)
        if state.epoch_phase == "foundation" and not state.own_team_id:
            # Join existing team if available
            for team in state.teams:
                actions.append(AllianceAction(action="join", target_simulation_id=None, team_name=team["name"]))
                break
            # Or propose one
            if not actions:
                opponents = state.get_opponent_sim_ids()
                if opponents:
                    actions.append(AllianceAction(
                        action="form",
                        target_simulation_id=opponents[0],
                        team_name=f"Sentinel Pact C{state.current_cycle}",
                    ))

        # Never betray unless betrayed first
        return actions


# ══════════════════════════════════════════════════════════════
# Warlord — Aggressive attacker
# ══════════════════════════════════════════════════════════════


class WarlordPersonality(BotPersonality):
    """Aggressive attacker. Focuses fire on the leader (or weakest if tied).

    Heavy offensive spending (assassins, saboteurs). Minimal defense.
    Reluctant to ally, betrays allies who become threats.
    """

    name = "warlord"

    def _plan_deployments(self, state: BotGameState, available_rp: int) -> list[DeploymentPlan]:
        plans: list[DeploymentPlan] = []
        rp = available_rp

        # Foundation: deploy guardians (limited)
        if state.epoch_phase == "foundation":
            while rp >= OPERATIVE_RP_COSTS["guardian"] and len(plans) < 2:
                plan = self._try_deploy(state, "guardian", None, rp)
                if not plan:
                    break
                plans.append(plan)
                rp -= plan.cost_rp
            return plans

        # Minimal guardians (20% budget, max 1)
        if state.own_guardians == 0 and rp >= OPERATIVE_RP_COSTS["guardian"]:
            plan = self._try_deploy(state, "guardian", None, rp)
            if plan:
                plans.append(plan)
                rp -= plan.cost_rp

        # Primary target: leader (or weakest if we're leading)
        rank = state.get_my_score_rank()
        if rank == 1:
            target = self._pick_target(state, "weakest")
        else:
            target = self._pick_target(state, "leader")

        if not target:
            return plans

        # 20% spy for intel
        if rp >= OPERATIVE_RP_COSTS["spy"]:
            plan = self._try_deploy(state, "spy", target, rp)
            if plan:
                plans.append(plan)
                rp -= plan.cost_rp

        # Offensive priority: assassin > saboteur > propagandist
        offensive_queue = ["assassin", "saboteur", "propagandist", "saboteur"]
        for op_type in offensive_queue:
            if rp < OPERATIVE_RP_COSTS.get(op_type, 5):
                continue
            plan = self._try_deploy(state, op_type, target, rp)
            if plan:
                plans.append(plan)
                rp -= plan.cost_rp

        return plans

    def manage_alliances(self, state: BotGameState) -> list[AllianceAction]:
        actions: list[AllianceAction] = []

        # Reluctant to ally — only if losing badly
        rank = state.get_my_score_rank()
        total = len(state.participants)

        if rank > total * 0.6 and not state.own_team_id:
            # Losing badly — consider temporary alliance
            opponents = state.get_opponent_sim_ids()
            if opponents and _rng.random() < 0.3:
                actions.append(AllianceAction(
                    action="form",
                    target_simulation_id=opponents[0],
                    team_name=f"War Pact C{state.current_cycle}",
                ))

        # Betray ally if they become a threat (leading)
        if state.own_team_id and state.allies:
            for ally_id in state.allies:
                ally_rank = None
                for i, s in enumerate(state.scores, 1):
                    if s.get("simulation_id") == ally_id:
                        ally_rank = i
                        break
                if ally_rank and ally_rank <= 1 and _rng.random() < 0.5:
                    actions.append(AllianceAction(action="betray", target_simulation_id=ally_id))
                    break

        return actions


# ══════════════════════════════════════════════════════════════
# Diplomat — Alliance builder
# ══════════════════════════════════════════════════════════════


class DiplomatPersonality(BotPersonality):
    """Alliance builder. Spreads operatives across targets, maintains alliances.

    Uses diplomatic bonus (+15%/ally) and embassy infiltrators.
    Avoids expensive assassins. Prefers propaganda + infiltration.
    """

    name = "diplomat"

    def _plan_deployments(self, state: BotGameState, available_rp: int) -> list[DeploymentPlan]:
        plans: list[DeploymentPlan] = []
        rp = available_rp

        # Foundation: guardians
        if state.epoch_phase == "foundation":
            while rp >= OPERATIVE_RP_COSTS["guardian"] and len(plans) < 2:
                plan = self._try_deploy(state, "guardian", None, rp)
                if not plan:
                    break
                plans.append(plan)
                rp -= plan.cost_rp
            return plans

        # Moderate guardians (20%)
        if state.own_guardians < 2 and rp >= OPERATIVE_RP_COSTS["guardian"]:
            plan = self._try_deploy(state, "guardian", None, rp)
            if plan:
                plans.append(plan)
                rp -= plan.cost_rp

        # Spread operations across non-allied targets
        opponents = state.get_opponent_sim_ids()
        if not opponents:
            return plans

        # Spy on each opponent (intel gathering)
        for opp_id in opponents:
            if rp < OPERATIVE_RP_COSTS["spy"]:
                break
            plan = self._try_deploy(state, "spy", opp_id, rp)
            if plan:
                plans.append(plan)
                rp -= plan.cost_rp

        # Infiltrators and propagandists spread across targets
        op_types = ["infiltrator", "propagandist", "propagandist"]
        for i, op_type in enumerate(op_types):
            if rp < OPERATIVE_RP_COSTS.get(op_type, 5):
                continue
            target = opponents[i % len(opponents)]
            plan = self._try_deploy(state, op_type, target, rp)
            if plan:
                plans.append(plan)
                rp -= plan.cost_rp

        return plans

    def manage_alliances(self, state: BotGameState) -> list[AllianceAction]:
        actions: list[AllianceAction] = []

        # Actively seek alliances
        if not state.own_team_id:
            # Join existing team
            for team in state.teams:
                actions.append(AllianceAction(action="join", team_name=team["name"]))
                return actions

            # Form alliance with another non-allied participant
            opponents = state.get_opponent_sim_ids()
            non_teamed = [
                p["simulation_id"] for p in state.participants
                if p["simulation_id"] != state.simulation_id
                and not p.get("team_id")
            ]
            target = non_teamed[0] if non_teamed else (opponents[0] if opponents else None)
            if target:
                actions.append(AllianceAction(
                    action="form",
                    target_simulation_id=target,
                    team_name=f"Diplomatic Union C{state.current_cycle}",
                ))

        # Never betray (diplomat is loyal)
        return actions


# ══════════════════════════════════════════════════════════════
# Strategist — Adaptive counter-strategist
# ══════════════════════════════════════════════════════════════


class StrategistPersonality(BotPersonality):
    """Adaptive counter-strategist. Detects dominant strategy and counters it.

    Heavy spy investment. Strategic alliances with weak players against leader.
    Best overall win rate at Hard difficulty.
    """

    name = "strategist"

    def _plan_deployments(self, state: BotGameState, available_rp: int) -> list[DeploymentPlan]:
        plans: list[DeploymentPlan] = []
        rp = available_rp

        # Foundation: guardians
        if state.epoch_phase == "foundation":
            while rp >= OPERATIVE_RP_COSTS["guardian"] and len(plans) < 2:
                plan = self._try_deploy(state, "guardian", None, rp)
                if not plan:
                    break
                plans.append(plan)
                rp -= plan.cost_rp
            return plans

        # Detect dominant strategy and counter
        dominant = state.get_dominant_strategy() if self.params["use_intel"] else "unknown"

        # Always: spy first (intel is king for strategist)
        opponents = state.get_opponent_sim_ids()
        leader = state.get_leader_sim_id()
        spy_target = leader or (opponents[0] if opponents else None)

        if spy_target and rp >= OPERATIVE_RP_COSTS["spy"]:
            plan = self._try_deploy(state, "spy", spy_target, rp)
            if plan:
                plans.append(plan)
                rp -= plan.cost_rp

        # Counter-strategy deployment
        if dominant == "aggressive":
            # Vs aggressive: guardians + spies (detect + defend)
            counter_ops = ["guardian", "guardian", "spy"]
        elif dominant == "diplomatic":
            # Vs diplomatic: assassins (break alliances by blocking ambassadors)
            counter_ops = ["assassin", "infiltrator"]
        elif dominant == "subversive":
            # Vs subversive: guardians + counter-intel (implied by spies)
            counter_ops = ["guardian", "saboteur"]
        else:
            # Unknown/mixed: balanced approach
            counter_ops = ["guardian", "saboteur", "propagandist"]

        target = leader or (opponents[0] if opponents else None)
        for op_type in counter_ops:
            if rp < OPERATIVE_RP_COSTS.get(op_type, 5):
                continue
            deploy_target = None if op_type == "guardian" else target
            plan = self._try_deploy(state, op_type, deploy_target, rp)
            if plan:
                plans.append(plan)
                rp -= plan.cost_rp

        return plans

    def manage_alliances(self, state: BotGameState) -> list[AllianceAction]:
        actions: list[AllianceAction] = []

        # Strategic alliance: ally with weak players against the leader
        if not state.own_team_id and self.params.get("proactive_counter"):
            rank = state.get_my_score_rank()
            if rank > 1:
                # Find another non-leading, non-teamed player
                non_leaders = [
                    p["simulation_id"] for p in state.participants
                    if p["simulation_id"] != state.simulation_id
                    and not p.get("team_id")
                ]
                if non_leaders:
                    # Prefer the weakest (also wants to counter the leader)
                    target = non_leaders[-1] if len(non_leaders) > 1 else non_leaders[0]
                    actions.append(AllianceAction(
                        action="form",
                        target_simulation_id=target,
                        team_name=f"Counter-Alliance C{state.current_cycle}",
                    ))
        elif not state.own_team_id:
            # Medium difficulty: join existing team
            for team in state.teams:
                actions.append(AllianceAction(action="join", team_name=team["name"]))
                break

        return actions


# ══════════════════════════════════════════════════════════════
# Chaos — Unpredictable wildcard
# ══════════════════════════════════════════════════════════════


class ChaosPersonality(BotPersonality):
    """Unpredictable wildcard. Random weighted decisions each cycle.

    Forms and breaks alliances randomly. Hard for Strategist to counter.
    """

    name = "chaos"

    def _plan_deployments(self, state: BotGameState, available_rp: int) -> list[DeploymentPlan]:
        plans: list[DeploymentPlan] = []
        rp = available_rp

        # Foundation: random number of guardians (0-3)
        if state.epoch_phase == "foundation":
            num_guardians = _rng.randint(0, 3)
            for _ in range(num_guardians):
                if rp < OPERATIVE_RP_COSTS["guardian"]:
                    break
                plan = self._try_deploy(state, "guardian", None, rp)
                if plan:
                    plans.append(plan)
                    rp -= plan.cost_rp
            return plans

        # Random target each cycle
        opponents = state.get_opponent_sim_ids()
        all_targets = opponents + (state.allies if _rng.random() < 0.15 else [])
        target = _rng.choice(all_targets) if all_targets else None

        # Random operative types (weighted)
        op_pool = (
            ["guardian"] * 2 +
            ["spy"] * 2 +
            ["saboteur"] * 3 +
            ["propagandist"] * 3 +
            ["assassin"] * 1 +
            ["infiltrator"] * 2
        )
        _rng.shuffle(op_pool)

        # Deploy random number (1-4) of operatives
        max_deploys = _rng.randint(1, 4)
        for op_type in op_pool[:max_deploys]:
            if rp < OPERATIVE_RP_COSTS.get(op_type, 5):
                continue
            deploy_target = None if op_type == "guardian" else target
            plan = self._try_deploy(state, op_type, deploy_target, rp)
            if plan:
                plans.append(plan)
                rp -= plan.cost_rp

        return plans

    def manage_alliances(self, state: BotGameState) -> list[AllianceAction]:
        actions: list[AllianceAction] = []

        # 30% chance to betray each cycle
        if state.own_team_id and _rng.random() < 0.30:
            if state.allies:
                actions.append(AllianceAction(
                    action="betray",
                    target_simulation_id=_rng.choice(state.allies),
                ))
            return actions

        # 40% chance to form/join alliance if not in one
        if not state.own_team_id and _rng.random() < 0.40:
            if state.teams:
                actions.append(AllianceAction(action="join", team_name=state.teams[0]["name"]))
            else:
                opponents = state.get_opponent_sim_ids()
                if opponents:
                    actions.append(AllianceAction(
                        action="form",
                        target_simulation_id=_rng.choice(opponents),
                        team_name=f"Chaos Pact C{state.current_cycle}",
                    ))

        return actions


# ══════════════════════════════════════════════════════════════
# Factory
# ══════════════════════════════════════════════════════════════


PERSONALITY_MAP: dict[str, type[BotPersonality]] = {
    "sentinel": SentinelPersonality,
    "warlord": WarlordPersonality,
    "diplomat": DiplomatPersonality,
    "strategist": StrategistPersonality,
    "chaos": ChaosPersonality,
}


def create_personality(personality: str, difficulty: str, config: dict | None = None) -> BotPersonality:
    """Factory function to create a personality instance."""
    cls = PERSONALITY_MAP.get(personality)
    if not cls:
        logger.warning("Unknown personality '%s', falling back to sentinel", personality)
        cls = SentinelPersonality
    return cls(difficulty=difficulty, config=config)
