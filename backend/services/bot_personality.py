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
from backend.services.constants import OPERATIVE_RP_COSTS, SECURITY_TIER_ORDER

logger = logging.getLogger(__name__)

_rng = secrets.SystemRandom()

# Difficulty scaling parameters
DIFFICULTY_PARAMS: dict[str, dict] = {
    "easy": {
        "rp_waste_pct": 0.30,
        "success_threshold": 0.0,  # Deploy at any %
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
class FortificationPlan:
    """A zone fortification decision (foundation phase only)."""

    zone_id: str
    cost_rp: int = 2


@dataclass
class ProposalVote:
    """A vote on an alliance proposal."""

    proposal_id: str
    vote: str  # "accept" or "reject"


@dataclass
class BotDecisions:
    """Complete set of decisions for a bot's cycle turn."""

    deployments: list[DeploymentPlan] = field(default_factory=list)
    fortifications: list[FortificationPlan] = field(default_factory=list)
    alliances: list[AllianceAction] = field(default_factory=list)
    proposal_votes: list[ProposalVote] = field(default_factory=list)
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
        """Full decision pipeline: allocate → fortify → deploy → alliance → vote."""
        available_rp = state.current_rp
        available_rp = self._apply_difficulty_waste(available_rp)

        # Fortifications first (foundation only), then deployments with remaining RP
        fortifications = self._plan_fortifications(state, available_rp)
        fort_cost = sum(f.cost_rp for f in fortifications)
        remaining_rp = available_rp - fort_cost

        deployments = self._plan_deployments(state, remaining_rp)
        alliances = self.manage_alliances(state)
        proposal_votes = self.vote_on_proposals(state)

        total_spent = sum(d.cost_rp for d in deployments) + fort_cost
        return BotDecisions(
            deployments=deployments,
            fortifications=fortifications,
            alliances=alliances,
            proposal_votes=proposal_votes,
            rp_spent=total_spent,
            reasoning=self._explain(state, deployments, alliances, fortifications),
        )

    @abstractmethod
    def _plan_deployments(self, state: BotGameState, available_rp: int) -> list[DeploymentPlan]:
        """Plan operative deployments within RP budget."""

    def _plan_fortifications(self, state: BotGameState, available_rp: int) -> list[FortificationPlan]:
        """Plan zone fortifications (foundation phase only). Default: none."""
        return []

    @abstractmethod
    def manage_alliances(self, state: BotGameState) -> list[AllianceAction]:
        """Decide alliance actions (form/join/betray/leave)."""

    def vote_on_proposals(self, state: BotGameState) -> list[ProposalVote]:
        """Vote on pending alliance proposals targeting this bot's team.

        Default: accept all. Override per personality for custom strategy.
        """
        if not state.own_team_id:
            return []
        votes: list[ProposalVote] = []
        for proposal in state.pending_proposals:
            if proposal.get("team_id") == state.own_team_id:
                votes.append(
                    ProposalVote(
                        proposal_id=proposal["id"],
                        vote="accept",
                    )
                )
        return votes

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

    def _pick_agent(
        self,
        state: BotGameState,
        operative_type: str | None = None,
        exclude_ids: set[str] | None = None,
    ) -> dict | None:
        """Pick an available agent for deployment.

        At medium/hard difficulty with an operative_type, picks the agent
        with the highest aptitude for that type. At easy, picks randomly.
        exclude_ids: agent IDs already planned this cycle (not yet in DB).
        """
        available = state.get_available_agents()
        if exclude_ids:
            available = [a for a in available if a["id"] not in exclude_ids]
        if not available:
            return None
        if operative_type and self.params["use_intel"]:
            # Sort by aptitude for this operative type (desc), pick best
            def apt_score(agent: dict) -> int:
                return agent.get("aptitudes", {}).get(operative_type, 6)

            available.sort(key=apt_score, reverse=True)
            return available[0]
        return _rng.choice(available)

    def _try_deploy(
        self,
        state: BotGameState,
        operative_type: str,
        target_sim_id: str | None,
        remaining_rp: int,
        planned: list[DeploymentPlan] | None = None,
    ) -> DeploymentPlan | None:
        """Try to create a deployment plan, returning None if impossible.

        planned: already-planned deployments this cycle (for agent/guardian dedup).
        """
        cost = OPERATIVE_RP_COSTS.get(operative_type, 5)
        if cost > remaining_rp:
            return None

        planned = planned or []
        exclude_ids = {p.agent_id for p in planned}

        agent = self._pick_agent(state, operative_type, exclude_ids)
        if not agent:
            return None

        # Guardians are self-deploy (no target/embassy)
        # Cap at half the total agents to reserve agents for offense
        if operative_type == "guardian":
            max_guardians = max(1, len(state.own_agents) // 2)
            planned_guardians = sum(1 for p in planned if p.operative_type == "guardian")
            if (state.own_guardians + planned_guardians) >= max_guardians:
                return None
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
        self,
        state: BotGameState,
        deployments: list[DeploymentPlan],
        alliances: list[AllianceAction],
        fortifications: list[FortificationPlan] | None = None,
    ) -> str:
        """Generate human-readable reasoning for the decision log."""
        parts = [f"[{self.name.upper()}@{self.difficulty}] Cycle {state.current_cycle}:"]
        if fortifications:
            parts.append(f"Fortifying {len(fortifications)} zone(s).")
        if deployments:
            types = [d.operative_type for d in deployments]
            parts.append(f"Deploying {len(deployments)} operatives: {', '.join(types)}.")
        else:
            parts.append("No deployments this cycle.")
        if alliances:
            actions = [a.action for a in alliances]
            parts.append(f"Alliance actions: {', '.join(actions)}.")
        # Resonance awareness context
        if state.active_resonances:
            archetypes = [r.get("archetype", "?") for r in state.active_resonances]
            parts.append(f"Resonance active: {', '.join(archetypes)}.")
        if state.is_under_resonance_pressure():
            parts.append("The substrate trembles — reinforcing defenses.")
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

    def _plan_fortifications(self, state: BotGameState, available_rp: int) -> list[FortificationPlan]:
        """Sentinel fortifies all 4 zones (8 RP)."""
        if state.epoch_phase != "foundation":
            return []
        plans: list[FortificationPlan] = []
        rp = available_rp
        for zone in state.own_zones:
            if rp < 2:
                break
            plans.append(FortificationPlan(zone_id=zone["id"]))
            rp -= 2
        return plans

    def _plan_deployments(self, state: BotGameState, available_rp: int) -> list[DeploymentPlan]:
        plans: list[DeploymentPlan] = []
        rp = available_rp

        # Foundation phase: guardians + spies
        if state.epoch_phase == "foundation":
            while rp >= OPERATIVE_RP_COSTS["guardian"]:
                plan = self._try_deploy(state, "guardian", None, rp, plans)
                if not plan:
                    break
                plans.append(plan)
                rp -= plan.cost_rp
            return plans

        # Priority 1: Guardians (50% of budget, 60% under resonance pressure)
        guardian_pct = 0.60 if state.is_under_resonance_pressure() else 0.50
        guardian_budget = int(available_rp * guardian_pct)
        while rp > (available_rp - guardian_budget) and rp >= OPERATIVE_RP_COSTS["guardian"]:
            plan = self._try_deploy(state, "guardian", None, rp, plans)
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
                plan = self._try_deploy(state, "spy", attacker_id, rp, plans)
                if plan:
                    plans.append(plan)
                    rp -= plan.cost_rp

        # Priority 3: Situational offense (only if leading and have RP left)
        rank = state.get_my_score_rank()
        if rank == 1 and rp >= OPERATIVE_RP_COSTS["saboteur"]:
            target = self._pick_target(state, "leader")  # Attack #2
            if target:
                plan = self._try_deploy(state, "saboteur", target, rp, plans)
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
                    actions.append(
                        AllianceAction(
                            action="form",
                            target_simulation_id=opponents[0],
                            team_name=f"Sentinel Pact C{state.current_cycle}",
                        )
                    )

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
                plan = self._try_deploy(state, "guardian", None, rp, plans)
                if not plan:
                    break
                plans.append(plan)
                rp -= plan.cost_rp
            return plans

        # Minimal guardians (20% budget, max 1)
        if state.own_guardians == 0 and rp >= OPERATIVE_RP_COSTS["guardian"]:
            plan = self._try_deploy(state, "guardian", None, rp, plans)
            if plan:
                plans.append(plan)
                rp -= plan.cost_rp

        # Primary target: leader (or weakest if we're leading)
        # Resonance awareness: prefer most volatile opponent
        volatile = state.get_most_volatile_opponent() if self.params["use_intel"] else None
        rank = state.get_my_score_rank()
        if volatile:
            target = volatile
        elif rank == 1:
            target = self._pick_target(state, "weakest")
        else:
            target = self._pick_target(state, "leader")

        if not target:
            return plans

        # 20% spy for intel
        if rp >= OPERATIVE_RP_COSTS["spy"]:
            plan = self._try_deploy(state, "spy", target, rp, plans)
            if plan:
                plans.append(plan)
                rp -= plan.cost_rp

        # Offensive priority: assassin > saboteur > propagandist
        offensive_queue = ["assassin", "saboteur", "propagandist", "saboteur"]

        # Resonance awareness: shift budget toward aligned types
        if state.active_resonances and self.params["use_intel"]:
            aligned_offensive = [t for t in state.resonance_aligned_types if t != "guardian"]
            if aligned_offensive:
                # Prepend aligned types to the queue
                offensive_queue = aligned_offensive + offensive_queue

        for op_type in offensive_queue:
            if rp < OPERATIVE_RP_COSTS.get(op_type, 5):
                continue
            plan = self._try_deploy(state, op_type, target, rp, plans)
            if plan:
                plans.append(plan)
                rp -= plan.cost_rp

        return plans

    def vote_on_proposals(self, state: BotGameState) -> list[ProposalVote]:
        """Warlord: reject top-2 ranked sims (threats). Accept weak (50% chance)."""
        if not state.own_team_id:
            return []
        votes: list[ProposalVote] = []
        # Get top-2 ranked sim IDs
        top_sims = {s["simulation_id"] for s in state.scores[:2]}
        for proposal in state.pending_proposals:
            if proposal.get("team_id") != state.own_team_id:
                continue
            proposer = proposal.get("proposer_simulation_id")
            if proposer in top_sims:
                votes.append(ProposalVote(proposal_id=proposal["id"], vote="reject"))
            elif _rng.random() < 0.5:
                votes.append(ProposalVote(proposal_id=proposal["id"], vote="accept"))
            else:
                votes.append(ProposalVote(proposal_id=proposal["id"], vote="reject"))
        return votes

    def manage_alliances(self, state: BotGameState) -> list[AllianceAction]:
        actions: list[AllianceAction] = []

        # Warlord leaves alliance if tension >= 50 (doesn't tolerate friction)
        if state.own_team_id and state.own_team_tension >= 50:
            actions.append(AllianceAction(action="leave"))
            return actions

        # Reluctant to ally — only if losing badly
        rank = state.get_my_score_rank()
        total = len(state.participants)

        if rank > total * 0.6 and not state.own_team_id:
            # Losing badly — consider temporary alliance
            opponents = state.get_opponent_sim_ids()
            if opponents and _rng.random() < 0.3:
                actions.append(
                    AllianceAction(
                        action="form",
                        target_simulation_id=opponents[0],
                        team_name=f"War Pact C{state.current_cycle}",
                    )
                )

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

    def _plan_fortifications(self, state: BotGameState, available_rp: int) -> list[FortificationPlan]:
        """Diplomat fortifies zones that have embassies (diplomatic assets)."""
        if state.epoch_phase != "foundation":
            return []
        plans: list[FortificationPlan] = []
        rp = available_rp
        # Pick up to 2 zones (diplomat is moderate on defense)
        for zone in state.own_zones[:2]:
            if rp < 2:
                break
            plans.append(FortificationPlan(zone_id=zone["id"]))
            rp -= 2
        return plans

    def _plan_deployments(self, state: BotGameState, available_rp: int) -> list[DeploymentPlan]:
        plans: list[DeploymentPlan] = []
        rp = available_rp

        # Foundation: guardians
        if state.epoch_phase == "foundation":
            while rp >= OPERATIVE_RP_COSTS["guardian"] and len(plans) < 2:
                plan = self._try_deploy(state, "guardian", None, rp, plans)
                if not plan:
                    break
                plans.append(plan)
                rp -= plan.cost_rp
            return plans

        # Moderate guardians (20%)
        if state.own_guardians < 2 and rp >= OPERATIVE_RP_COSTS["guardian"]:
            plan = self._try_deploy(state, "guardian", None, rp, plans)
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
            plan = self._try_deploy(state, "spy", opp_id, rp, plans)
            if plan:
                plans.append(plan)
                rp -= plan.cost_rp

        # Infiltrators and propagandists spread across targets
        op_types = ["infiltrator", "propagandist", "propagandist"]
        for i, op_type in enumerate(op_types):
            if rp < OPERATIVE_RP_COSTS.get(op_type, 5):
                continue
            target = opponents[i % len(opponents)]
            plan = self._try_deploy(state, op_type, target, rp, plans)
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
                p["simulation_id"]
                for p in state.participants
                if p["simulation_id"] != state.simulation_id and not p.get("team_id")
            ]
            target = non_teamed[0] if non_teamed else (opponents[0] if opponents else None)
            if target:
                actions.append(
                    AllianceAction(
                        action="form",
                        target_simulation_id=target,
                        team_name=f"Diplomatic Union C{state.current_cycle}",
                    )
                )

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

    def _plan_fortifications(self, state: BotGameState, available_rp: int) -> list[FortificationPlan]:
        """Strategist fortifies 1-2 weakest (lowest security) zones."""
        if state.epoch_phase != "foundation":
            return []
        plans: list[FortificationPlan] = []
        rp = available_rp
        # Sort zones by security level (weakest first)
        sorted_zones = sorted(
            state.own_zones,
            key=lambda z: SECURITY_TIER_ORDER.index(z.get("security_level", "moderate"))
            if z.get("security_level", "moderate") in SECURITY_TIER_ORDER
            else 3,
        )
        max_forts = _rng.randint(1, 2)
        for zone in sorted_zones[:max_forts]:
            if rp < 2:
                break
            plans.append(FortificationPlan(zone_id=zone["id"]))
            rp -= 2
        return plans

    def _plan_deployments(self, state: BotGameState, available_rp: int) -> list[DeploymentPlan]:
        plans: list[DeploymentPlan] = []
        rp = available_rp

        # Foundation: guardians + spies
        if state.epoch_phase == "foundation":
            while rp >= OPERATIVE_RP_COSTS["guardian"] and len(plans) < 2:
                plan = self._try_deploy(state, "guardian", None, rp, plans)
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

        # Resonance awareness: prefer most volatile opponent when available
        volatile_target = state.get_most_volatile_opponent() if self.params["use_intel"] else None
        if volatile_target:
            spy_target = volatile_target

        if spy_target and rp >= OPERATIVE_RP_COSTS["spy"]:
            plan = self._try_deploy(state, "spy", spy_target, rp, plans)
            if plan:
                plans.append(plan)
                rp -= plan.cost_rp

        # Counter-strategy deployment
        if dominant == "aggressive":
            counter_ops = ["guardian", "guardian", "spy"]
        elif dominant == "diplomatic":
            counter_ops = ["assassin", "infiltrator"]
        elif dominant == "subversive":
            counter_ops = ["guardian", "saboteur"]
        else:
            counter_ops = ["guardian", "saboteur", "propagandist"]

        # Resonance awareness: substitute aligned operative types when available
        if state.active_resonances and self.params["use_intel"]:
            counter_ops = self._apply_resonance_preference(state, counter_ops)

        target = volatile_target or leader or (opponents[0] if opponents else None)
        for op_type in counter_ops:
            if rp < OPERATIVE_RP_COSTS.get(op_type, 5):
                continue
            deploy_target = None if op_type == "guardian" else target
            plan = self._try_deploy(state, op_type, deploy_target, rp, plans)
            if plan:
                plans.append(plan)
                rp -= plan.cost_rp

        return plans

    @staticmethod
    def _apply_resonance_preference(state: BotGameState, ops: list[str]) -> list[str]:
        """Substitute non-guardian ops with resonance-aligned types where possible."""
        result: list[str] = []
        for op in ops:
            if op == "guardian":
                result.append(op)
            elif preferred := state.get_resonance_preferred_operative([op] + state.resonance_aligned_types):
                result.append(preferred)
            else:
                result.append(op)
        return result

    def vote_on_proposals(self, state: BotGameState) -> list[ProposalVote]:
        """Strategist: accept weak players (anti-leader coalition). Reject the leader."""
        if not state.own_team_id:
            return []
        votes: list[ProposalVote] = []
        leader = state.get_leader_sim_id()
        for proposal in state.pending_proposals:
            if proposal.get("team_id") != state.own_team_id:
                continue
            proposer = proposal.get("proposer_simulation_id")
            if proposer == leader:
                votes.append(ProposalVote(proposal_id=proposal["id"], vote="reject"))
            else:
                votes.append(ProposalVote(proposal_id=proposal["id"], vote="accept"))
        return votes

    def manage_alliances(self, state: BotGameState) -> list[AllianceAction]:
        actions: list[AllianceAction] = []

        # Strategic alliance: ally with weak players against the leader
        if not state.own_team_id and self.params.get("proactive_counter"):
            rank = state.get_my_score_rank()
            if rank > 1:
                non_leaders = [
                    p["simulation_id"]
                    for p in state.participants
                    if p["simulation_id"] != state.simulation_id and not p.get("team_id")
                ]
                if non_leaders:
                    target = non_leaders[-1] if len(non_leaders) > 1 else non_leaders[0]
                    actions.append(
                        AllianceAction(
                            action="form",
                            target_simulation_id=target,
                            team_name=f"Counter-Alliance C{state.current_cycle}",
                        )
                    )
        elif not state.own_team_id:
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

    def _plan_fortifications(self, state: BotGameState, available_rp: int) -> list[FortificationPlan]:
        """Chaos randomly fortifies 0-2 zones."""
        if state.epoch_phase != "foundation":
            return []
        plans: list[FortificationPlan] = []
        rp = available_rp
        num_forts = _rng.randint(0, 2)
        zones = list(state.own_zones)
        _rng.shuffle(zones)
        for zone in zones[:num_forts]:
            if rp < 2:
                break
            plans.append(FortificationPlan(zone_id=zone["id"]))
            rp -= 2
        return plans

    def _plan_deployments(self, state: BotGameState, available_rp: int) -> list[DeploymentPlan]:
        plans: list[DeploymentPlan] = []
        rp = available_rp

        # Foundation: random number of guardians (0-3)
        if state.epoch_phase == "foundation":
            num_guardians = _rng.randint(0, 3)
            for _ in range(num_guardians):
                if rp < OPERATIVE_RP_COSTS["guardian"]:
                    break
                plan = self._try_deploy(state, "guardian", None, rp, plans)
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
            ["guardian"] * 2
            + ["spy"] * 2
            + ["saboteur"] * 3
            + ["propagandist"] * 3
            + ["assassin"] * 1
            + ["infiltrator"] * 2
        )
        _rng.shuffle(op_pool)

        # Deploy random number (1-4) of operatives
        max_deploys = _rng.randint(1, 4)
        for op_type in op_pool[:max_deploys]:
            if rp < OPERATIVE_RP_COSTS.get(op_type, 5):
                continue
            deploy_target = None if op_type == "guardian" else target
            plan = self._try_deploy(state, op_type, deploy_target, rp, plans)
            if plan:
                plans.append(plan)
                rp -= plan.cost_rp

        return plans

    def vote_on_proposals(self, state: BotGameState) -> list[ProposalVote]:
        """Chaos: 60% accept, 40% reject (random)."""
        if not state.own_team_id:
            return []
        votes: list[ProposalVote] = []
        for proposal in state.pending_proposals:
            if proposal.get("team_id") != state.own_team_id:
                continue
            vote = "accept" if _rng.random() < 0.60 else "reject"
            votes.append(ProposalVote(proposal_id=proposal["id"], vote=vote))
        return votes

    def manage_alliances(self, state: BotGameState) -> list[AllianceAction]:
        actions: list[AllianceAction] = []

        # 30% chance to betray each cycle
        if state.own_team_id and _rng.random() < 0.30:
            if state.allies:
                actions.append(
                    AllianceAction(
                        action="betray",
                        target_simulation_id=_rng.choice(state.allies),
                    )
                )
            return actions

        # 40% chance to form/join alliance if not in one
        if not state.own_team_id and _rng.random() < 0.40:
            if state.teams:
                actions.append(AllianceAction(action="join", team_name=state.teams[0]["name"]))
            else:
                opponents = state.get_opponent_sim_ids()
                if opponents:
                    actions.append(
                        AllianceAction(
                            action="form",
                            target_simulation_id=_rng.choice(opponents),
                            team_name=f"Chaos Pact C{state.current_cycle}",
                        )
                    )

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


# ── Personality-preferred operative types for auto-draft ──

_PERSONALITY_PRIORITIES: dict[str, list[str]] = {
    "sentinel": ["guardian", "spy", "saboteur"],
    "warlord": ["assassin", "saboteur", "guardian"],
    "diplomat": ["propagandist", "infiltrator", "spy"],
    "strategist": ["spy", "infiltrator", "assassin"],
    "chaos": ["saboteur", "propagandist", "assassin"],
}


def auto_draft(
    personality: str,
    agents: list[dict],
    max_agents: int,
) -> list[str]:
    """Select agents from a template roster based on personality archetype.

    Scores each agent by sum of aptitudes for the personality's preferred operative
    types (weighted: priority 1 = 3x, priority 2 = 2x, priority 3 = 1x).
    Returns up to max_agents agent IDs sorted by affinity score descending.
    """
    priorities = _PERSONALITY_PRIORITIES.get(personality, ["spy", "guardian", "saboteur"])

    def affinity_score(agent: dict) -> float:
        aptitudes = agent.get("aptitudes", {})
        score = 0.0
        for i, op_type in enumerate(priorities):
            weight = 3 - i  # 3, 2, 1
            score += aptitudes.get(op_type, 6) * weight
        return score

    ranked = sorted(agents, key=affinity_score, reverse=True)
    return [a["id"] for a in ranked[:max_agents]]
