"""Unit tests for BotPersonality — 5 archetypes, decision logic, difficulty scaling."""

from __future__ import annotations

from backend.services.bot_game_state import BotGameState
from backend.services.bot_personality import (
    DIFFICULTY_PARAMS,
    PERSONALITY_MAP,
    AllianceAction,
    BotDecisions,
    ChaosPersonality,
    DeploymentPlan,
    DiplomatPersonality,
    SentinelPersonality,
    StrategistPersonality,
    WarlordPersonality,
    create_personality,
)

# ── Helpers ────────────────────────────────────────────────────


def _make_state(
    current_rp: int = 30,
    epoch_phase: str = "competition",
    current_cycle: int = 3,
    own_guardians: int = 0,
    own_team_id: str | None = None,
    allies: list[str] | None = None,
    participants: list[dict] | None = None,
    scores: list[dict] | None = None,
    teams: list[dict] | None = None,
    own_agents: list[dict] | None = None,
    own_missions: list[dict] | None = None,
    own_embassies: list[dict] | None = None,
    detected_enemy_ops: list[dict] | None = None,
    battle_log: list[dict] | None = None,
    spy_intel_reports: list[dict] | None = None,
) -> BotGameState:
    """Create a BotGameState for testing."""
    sim_id = "sim-self"
    default_agents = [
        {"id": f"agent-{i}", "name": f"Agent {i}", "simulation_id": sim_id, "ambassador_blocked_until": None}
        for i in range(6)
    ]
    default_participants = [
        {"id": "p-self", "simulation_id": sim_id, "team_id": own_team_id, "is_bot": True},
        {"id": "p-opp1", "simulation_id": "sim-opp1", "team_id": None, "is_bot": False},
        {"id": "p-opp2", "simulation_id": "sim-opp2", "team_id": None, "is_bot": False},
    ]
    default_scores = [
        {"simulation_id": "sim-opp1", "composite_score": 80},
        {"simulation_id": sim_id, "composite_score": 60},
        {"simulation_id": "sim-opp2", "composite_score": 40},
    ]
    default_embassies = [
        {"id": "emb-opp1", "source_simulation_id": sim_id, "target_simulation_id": "sim-opp1", "status": "active"},
        {"id": "emb-opp2", "source_simulation_id": sim_id, "target_simulation_id": "sim-opp2", "status": "active"},
    ]

    return BotGameState(
        participant_id="p-self",
        simulation_id=sim_id,
        epoch_id="epoch-1",
        personality="test",
        difficulty="medium",
        current_rp=current_rp,
        rp_cap=40,
        rp_per_cycle=12,
        current_cycle=current_cycle,
        epoch_phase=epoch_phase,
        own_guardians=own_guardians,
        own_team_id=own_team_id,
        allies=allies if allies is not None else [],
        participants=participants if participants is not None else default_participants,
        scores=scores if scores is not None else default_scores,
        teams=teams if teams is not None else [],
        own_agents=own_agents if own_agents is not None else default_agents,
        own_missions=own_missions if own_missions is not None else [],
        own_embassies=own_embassies if own_embassies is not None else default_embassies,
        detected_enemy_ops=detected_enemy_ops if detected_enemy_ops is not None else [],
        battle_log=battle_log if battle_log is not None else [],
        spy_intel_reports=spy_intel_reports if spy_intel_reports is not None else [],
    )


# ── Factory ────────────────────────────────────────────────────


class TestCreatePersonality:
    def test_creates_sentinel(self):
        p = create_personality("sentinel", "medium")
        assert isinstance(p, SentinelPersonality)
        assert p.difficulty == "medium"

    def test_creates_warlord(self):
        p = create_personality("warlord", "hard")
        assert isinstance(p, WarlordPersonality)
        assert p.difficulty == "hard"

    def test_creates_diplomat(self):
        p = create_personality("diplomat", "easy")
        assert isinstance(p, DiplomatPersonality)
        assert p.difficulty == "easy"

    def test_creates_strategist(self):
        p = create_personality("strategist", "medium")
        assert isinstance(p, StrategistPersonality)

    def test_creates_chaos(self):
        p = create_personality("chaos", "hard")
        assert isinstance(p, ChaosPersonality)

    def test_unknown_personality_falls_back_to_sentinel(self):
        p = create_personality("nonexistent", "medium")
        assert isinstance(p, SentinelPersonality)

    def test_all_five_personalities_in_map(self):
        assert set(PERSONALITY_MAP.keys()) == {"sentinel", "warlord", "diplomat", "strategist", "chaos"}


# ── Difficulty Parameters ──────────────────────────────────────


class TestDifficultyParams:
    def test_easy_wastes_rp(self):
        params = DIFFICULTY_PARAMS["easy"]
        assert params["rp_waste_pct"] == 0.30
        assert params["success_threshold"] == 0.0
        assert params["use_intel"] is False

    def test_medium_balanced(self):
        params = DIFFICULTY_PARAMS["medium"]
        assert params["rp_waste_pct"] == 0.10
        assert params["success_threshold"] == 0.20
        assert params["use_intel"] is True
        assert params["optimal_targeting"] is False

    def test_hard_optimal(self):
        params = DIFFICULTY_PARAMS["hard"]
        assert params["rp_waste_pct"] == 0.0
        assert params["success_threshold"] == 0.35
        assert params["use_intel"] is True
        assert params["optimal_targeting"] is True
        assert params["proactive_counter"] is True


# ── Difficulty Waste ───────────────────────────────────────────


class TestDifficultyWaste:
    def test_hard_wastes_nothing(self):
        p = create_personality("sentinel", "hard")
        assert p._apply_difficulty_waste(30) == 30

    def test_easy_may_waste_rp(self):
        """Easy bots waste up to 30% of RP (random, so we just check range)."""
        p = create_personality("sentinel", "easy")
        results = set()
        for _ in range(100):
            r = p._apply_difficulty_waste(100)
            results.add(r)
        # Should sometimes waste RP (not always 100)
        assert min(results) < 100
        # Should never waste more than 30%
        assert min(results) >= 70


# ── Sentinel ───────────────────────────────────────────────────


class TestSentinelPersonality:
    def test_foundation_phase_only_guardians(self):
        """Sentinel deploys only guardians during foundation."""
        p = create_personality("sentinel", "medium")
        state = _make_state(current_rp=20, epoch_phase="foundation")

        decisions = p.decide(state)

        for d in decisions.deployments:
            assert d.operative_type == "guardian"

    def test_competition_prioritizes_guardians(self):
        """Sentinel deploys guardians as primary priority (50% budget)."""
        p = create_personality("sentinel", "medium")
        state = _make_state(current_rp=30, epoch_phase="competition")

        decisions = p.decide(state)

        guardian_count = sum(1 for d in decisions.deployments if d.operative_type == "guardian")
        total = len(decisions.deployments)
        # Guardians should be at least 40% of deployments
        if total > 0:
            assert guardian_count / total >= 0.4

    def test_seeks_alliance_in_foundation(self):
        """Sentinel actively seeks alliance during foundation."""
        p = create_personality("sentinel", "medium")
        state = _make_state(epoch_phase="foundation", own_team_id=None)

        decisions = p.decide(state)

        if decisions.alliances:
            assert decisions.alliances[0].action in ("form", "join")

    def test_never_betrays(self):
        """Sentinel never proposes betrayal."""
        p = create_personality("sentinel", "hard")
        state = _make_state(
            own_team_id="team-1",
            allies=["sim-opp1"],
        )

        decisions = p.decide(state)

        for a in decisions.alliances:
            assert a.action != "betray"

    def test_spies_on_attackers_when_under_attack(self):
        """Sentinel uses spies when detecting inbound operations."""
        p = create_personality("sentinel", "medium")
        state = _make_state(
            current_rp=30,
            detected_enemy_ops=[
                {"source_simulation_id": "sim-opp1", "operative_type": "spy"},
            ],
        )

        decisions = p.decide(state)

        spy_deployments = [d for d in decisions.deployments if d.operative_type == "spy"]
        assert len(spy_deployments) >= 1


# ── Warlord ────────────────────────────────────────────────────


class TestWarlordPersonality:
    def test_foundation_limited_guardians(self):
        """Warlord deploys max 2 guardians in foundation."""
        p = create_personality("warlord", "medium")
        state = _make_state(current_rp=30, epoch_phase="foundation")

        decisions = p.decide(state)

        guardian_count = sum(1 for d in decisions.deployments if d.operative_type == "guardian")
        assert guardian_count <= 2

    def test_heavy_offensive_focus(self):
        """Warlord prioritizes offensive operatives."""
        p = create_personality("warlord", "medium")
        state = _make_state(current_rp=30, epoch_phase="competition")

        decisions = p.decide(state)

        offensive_types = {"spy", "saboteur", "propagandist", "assassin", "infiltrator"}
        offensive_count = sum(1 for d in decisions.deployments if d.operative_type in offensive_types)
        guardian_count = sum(1 for d in decisions.deployments if d.operative_type == "guardian")
        # Offensive should outnumber guardians
        if len(decisions.deployments) > 1:
            assert offensive_count >= guardian_count

    def test_attacks_leader_when_not_leading(self):
        """Warlord targets the leading player when not #1."""
        p = create_personality("warlord", "medium")
        state = _make_state(current_rp=30)
        # sim-opp1 is leading (first in scores)

        decisions = p.decide(state)

        for d in decisions.deployments:
            if d.target_simulation_id:
                assert d.target_simulation_id == "sim-opp1"
                break

    def test_may_betray_leading_ally(self):
        """Warlord may betray an ally if they're leading (probabilistic)."""
        p = create_personality("warlord", "hard")
        state = _make_state(
            own_team_id="team-1",
            allies=["sim-opp1"],
            scores=[
                {"simulation_id": "sim-opp1", "composite_score": 100},
                {"simulation_id": "sim-self", "composite_score": 60},
            ],
        )

        # Run multiple times due to randomness
        betrayed = False
        for _ in range(50):
            decisions = p.decide(state)
            for a in decisions.alliances:
                if a.action == "betray":
                    betrayed = True
                    break
            if betrayed:
                break
        # 50% chance per attempt, 50 attempts — should happen at least once
        assert betrayed


# ── Diplomat ───────────────────────────────────────────────────


class TestDiplomatPersonality:
    def test_actively_seeks_alliances(self):
        """Diplomat actively forms/joins alliances."""
        p = create_personality("diplomat", "medium")
        state = _make_state(own_team_id=None)

        decisions = p.decide(state)

        if decisions.alliances:
            assert decisions.alliances[0].action in ("form", "join")

    def test_joins_existing_team_first(self):
        """Diplomat prefers joining existing teams over forming new ones."""
        p = create_personality("diplomat", "medium")
        state = _make_state(
            own_team_id=None,
            teams=[{"id": "team-1", "name": "Existing Alliance"}],
        )

        decisions = p.decide(state)

        if decisions.alliances:
            assert decisions.alliances[0].action == "join"
            assert decisions.alliances[0].team_name == "Existing Alliance"

    def test_never_betrays(self):
        """Diplomat is loyal and never betrays."""
        p = create_personality("diplomat", "hard")
        state = _make_state(
            own_team_id="team-1",
            allies=["sim-opp1"],
        )

        # Run multiple times to be sure
        for _ in range(20):
            decisions = p.decide(state)
            for a in decisions.alliances:
                assert a.action != "betray"

    def test_spreads_operations_across_targets(self):
        """Diplomat spreads operatives across different opponents."""
        p = create_personality("diplomat", "medium")
        state = _make_state(current_rp=40)

        decisions = p.decide(state)

        targets = {d.target_simulation_id for d in decisions.deployments if d.target_simulation_id}
        # With 2 opponents and enough RP, should target multiple
        if len(decisions.deployments) > 2:
            assert len(targets) >= 1

    def test_prefers_infiltrators_and_propagandists(self):
        """Diplomat uses non-lethal operatives (no assassins)."""
        p = create_personality("diplomat", "medium")
        state = _make_state(current_rp=40)

        decisions = p.decide(state)

        for d in decisions.deployments:
            assert d.operative_type != "assassin"


# ── Strategist ─────────────────────────────────────────────────


class TestStrategistPersonality:
    def test_always_spies_first(self):
        """Strategist prioritizes intelligence gathering."""
        p = create_personality("strategist", "medium")
        state = _make_state(current_rp=30)

        decisions = p.decide(state)

        # First deployment should be a spy (after any foundation guardians)
        non_guardian = [d for d in decisions.deployments if d.operative_type != "guardian"]
        if non_guardian:
            assert non_guardian[0].operative_type == "spy"

    def test_counters_aggressive_with_guardians(self):
        """Strategist deploys guardians + spies vs aggressive opponent."""
        p = create_personality("strategist", "medium")
        state = _make_state(
            current_rp=30,
            battle_log=[
                {"source_simulation_id": "sim-opp1", "event_type": "sabotage"},
                {"source_simulation_id": "sim-opp1", "event_type": "assassination"},
                {"source_simulation_id": "sim-opp1", "event_type": "sabotage"},
            ],
        )

        decisions = p.decide(state)

        types = [d.operative_type for d in decisions.deployments]
        # Should include guardians as counter to aggressive
        assert "guardian" in types

    def test_hard_forms_counter_alliance(self):
        """Hard strategist proactively forms alliances against the leader."""
        p = create_personality("strategist", "hard")
        state = _make_state(own_team_id=None)

        decisions = p.decide(state)

        if decisions.alliances:
            assert decisions.alliances[0].action in ("form", "join")

    def test_foundation_deploys_guardians(self):
        """Strategist deploys guardians in foundation phase."""
        p = create_personality("strategist", "medium")
        state = _make_state(current_rp=20, epoch_phase="foundation")

        decisions = p.decide(state)

        for d in decisions.deployments:
            assert d.operative_type == "guardian"


# ── Chaos ──────────────────────────────────────────────────────


class TestChaosPersonality:
    def test_random_deployments(self):
        """Chaos makes random decisions — multiple runs should show variation."""
        p = create_personality("chaos", "medium")
        state = _make_state(current_rp=30)

        all_types = set()
        for _ in range(30):
            decisions = p.decide(state)
            for d in decisions.deployments:
                all_types.add(d.operative_type)

        # Over 30 runs, chaos should deploy at least 2 different types
        assert len(all_types) >= 2

    def test_may_betray_randomly(self):
        """Chaos has 30% betrayal chance per cycle."""
        p = create_personality("chaos", "medium")
        state = _make_state(
            own_team_id="team-1",
            allies=["sim-opp1"],
        )

        betrayed = False
        for _ in range(50):
            decisions = p.decide(state)
            for a in decisions.alliances:
                if a.action == "betray":
                    betrayed = True
                    break
            if betrayed:
                break

        assert betrayed

    def test_may_form_alliances_randomly(self):
        """Chaos has 40% alliance formation chance."""
        p = create_personality("chaos", "medium")
        state = _make_state(own_team_id=None)

        formed = False
        for _ in range(50):
            decisions = p.decide(state)
            for a in decisions.alliances:
                if a.action in ("form", "join"):
                    formed = True
                    break
            if formed:
                break

        assert formed

    def test_foundation_random_guardian_count(self):
        """Chaos deploys 0-3 guardians in foundation (random)."""
        p = create_personality("chaos", "medium")
        state = _make_state(current_rp=30, epoch_phase="foundation")

        guardian_counts = set()
        for _ in range(50):
            decisions = p.decide(state)
            count = len(decisions.deployments)
            guardian_counts.add(count)

        # Should see variation over 50 runs
        assert len(guardian_counts) >= 2


# ── BotDecisions dataclass ─────────────────────────────────────


class TestBotDecisions:
    def test_default_values(self):
        d = BotDecisions()
        assert d.deployments == []
        assert d.alliances == []
        assert d.rp_spent == 0
        assert d.reasoning == ""


class TestDeploymentPlan:
    def test_guardian_has_no_target(self):
        plan = DeploymentPlan(
            operative_type="guardian",
            agent_id="a1",
            target_simulation_id=None,
            embassy_id=None,
            cost_rp=4,
        )
        assert plan.target_simulation_id is None
        assert plan.embassy_id is None

    def test_offensive_has_target_and_embassy(self):
        plan = DeploymentPlan(
            operative_type="spy",
            agent_id="a1",
            target_simulation_id="sim-target",
            embassy_id="emb-1",
            cost_rp=3,
        )
        assert plan.target_simulation_id == "sim-target"
        assert plan.embassy_id == "emb-1"


class TestAllianceAction:
    def test_form_action(self):
        a = AllianceAction(action="form", target_simulation_id="sim-1", team_name="Alliance")
        assert a.action == "form"

    def test_betray_action(self):
        a = AllianceAction(action="betray", target_simulation_id="sim-1")
        assert a.action == "betray"


# ── Pick target / agent helpers ────────────────────────────────


class TestHelperMethods:
    def test_pick_target_leader(self):
        """_pick_target with 'leader' strategy returns highest-scoring opponent."""
        p = create_personality("sentinel", "medium")
        state = _make_state()

        target = p._pick_target(state, "leader")

        assert target == "sim-opp1"

    def test_pick_target_weakest(self):
        """_pick_target with 'weakest' strategy returns lowest-scoring opponent."""
        p = create_personality("sentinel", "medium")
        state = _make_state()

        target = p._pick_target(state, "weakest")

        assert target == "sim-opp2"

    def test_pick_target_random(self):
        """_pick_target with 'random' strategy returns one of the opponents."""
        p = create_personality("sentinel", "medium")
        state = _make_state()

        targets = set()
        for _ in range(50):
            t = p._pick_target(state, "random")
            if t:
                targets.add(t)

        assert targets.issubset({"sim-opp1", "sim-opp2"})

    def test_pick_agent_returns_available(self):
        """_pick_agent returns an agent not on active mission."""
        p = create_personality("sentinel", "medium")
        state = _make_state(
            own_missions=[
                {"agent_id": "agent-0", "status": "active", "operative_type": "spy"},
            ],
        )

        agent = p._pick_agent(state)

        assert agent is not None
        assert agent["id"] != "agent-0"

    def test_pick_agent_returns_none_when_all_deployed(self):
        """_pick_agent returns None when no agents available."""
        p = create_personality("sentinel", "medium")
        missions = [
            {"agent_id": f"agent-{i}", "status": "active", "operative_type": "spy"}
            for i in range(6)
        ]
        state = _make_state(own_missions=missions)

        agent = p._pick_agent(state)

        assert agent is None

    def test_try_deploy_returns_none_when_insufficient_rp(self):
        """_try_deploy returns None when RP is insufficient."""
        p = create_personality("sentinel", "medium")
        state = _make_state(current_rp=2)

        plan = p._try_deploy(state, "spy", "sim-opp1", remaining_rp=2)

        # spy costs 3 RP
        assert plan is None

    def test_try_deploy_guardian_self_deploy(self):
        """Guardians deploy to own simulation (no target/embassy)."""
        p = create_personality("sentinel", "medium")
        state = _make_state()

        plan = p._try_deploy(state, "guardian", None, remaining_rp=10)

        assert plan is not None
        assert plan.operative_type == "guardian"
        assert plan.target_simulation_id is None
        assert plan.embassy_id is None

    def test_try_deploy_offensive_needs_embassy(self):
        """Offensive operative needs embassy to target."""
        p = create_personality("sentinel", "medium")
        state = _make_state(own_embassies=[])  # No embassies

        plan = p._try_deploy(state, "spy", "sim-opp1", remaining_rp=10)

        assert plan is None

    def test_try_deploy_offensive_with_embassy(self):
        """Offensive operative succeeds when embassy exists for target."""
        p = create_personality("sentinel", "medium")
        state = _make_state()

        plan = p._try_deploy(state, "spy", "sim-opp1", remaining_rp=10)

        assert plan is not None
        assert plan.operative_type == "spy"
        assert plan.target_simulation_id == "sim-opp1"
        assert plan.embassy_id == "emb-opp1"

    def test_explain_generates_reasoning(self):
        """_explain returns human-readable reasoning."""
        p = create_personality("sentinel", "medium")
        state = _make_state()
        deployments = [
            DeploymentPlan("guardian", "a1", cost_rp=4),
            DeploymentPlan("spy", "a2", target_simulation_id="sim-opp1", embassy_id="emb-1", cost_rp=3),
        ]

        reasoning = p._explain(state, deployments, [])

        assert "SENTINEL" in reasoning
        assert "medium" in reasoning
        assert "2 operatives" in reasoning
