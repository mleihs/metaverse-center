"""Agent activity selection and execution service.

Implements the Utility AI + Boltzmann selection pattern (The Sims) for
autonomous agent decision-making. Each heartbeat tick, agents select and
execute activities based on their needs, mood, personality, and environment.

Three-tier processing:
- Tier 1 (every tick, 0 LLM): Activity selection via Utility AI
- Tier 2 (selective): LLM narrative for social interactions
- Tier 3 (rare): Full LLM for autonomous events (handled by AutonomousEventService)

Research basis: The Sims Utility AI (GDC), RimWorld job priority, Boltzmann
selection temperature, Stanford Generative Agents daily planning.
"""

from __future__ import annotations

import logging
import math
import random
from itertools import combinations
from uuid import UUID

import sentry_sdk
import structlog

from backend.services.agent_mood_service import AgentMoodService
from backend.services.agent_needs_service import AgentNeedsService
from backend.services.agent_opinion_service import AgentOpinionService
from supabase import Client

logger = logging.getLogger(__name__)

# ── Activity definitions ─────────────────────────────────────────────────────

# Base attractiveness scores for each activity
ACTIVITY_BASE_SCORES: dict[str, float] = {
    "work": 25.0,
    "socialize": 20.0,
    "rest": 15.0,
    "explore": 12.0,
    "maintain": 10.0,
    "reflect": 8.0,
    "avoid": 5.0,
    "confront": 3.0,
    "celebrate": 5.0,
    "mourn": 5.0,
    "seek_comfort": 10.0,
    "collaborate": 18.0,
    "create": 12.0,
    "investigate": 10.0,
}

# Which Big Five dimension boosts which activity
TRAIT_ACTIVITY_BONUSES: dict[str, dict[str, float]] = {
    "work": {"conscientiousness": 8.0},
    "socialize": {"extraversion": 10.0, "agreeableness": 5.0},
    "rest": {"neuroticism": 5.0},
    "explore": {"openness": 10.0},
    "maintain": {"conscientiousness": 5.0},
    "reflect": {"openness": 5.0, "neuroticism": 3.0},
    "avoid": {"neuroticism": 8.0},
    "confront": {"extraversion": 3.0, "neuroticism": 5.0},
    "celebrate": {"extraversion": 8.0, "agreeableness": 3.0},
    "mourn": {"neuroticism": 5.0, "agreeableness": 3.0},
    "seek_comfort": {"neuroticism": 5.0, "agreeableness": 5.0},
    "collaborate": {"agreeableness": 8.0, "conscientiousness": 3.0},
    "create": {"openness": 8.0},
    "investigate": {"openness": 5.0, "conscientiousness": 5.0},
}

# Need thresholds: which need level triggers which activity bonus
NEED_ACTIVITY_MAP: dict[str, list[str]] = {
    "social": ["socialize", "seek_comfort", "collaborate", "celebrate"],
    "purpose": ["work", "maintain", "collaborate", "create"],
    "safety": ["rest", "avoid"],
    "comfort": ["rest", "maintain"],
    "stimulation": ["explore", "investigate", "create", "celebrate"],
}

# Activities requiring specific conditions
ACTIVITY_REQUIREMENTS: dict[str, dict] = {
    "work": {"needs_building": True},
    "maintain": {"needs_building": True},
    "collaborate": {"needs_colocated_agent": True, "needs_building": True},
    "socialize": {"needs_colocated_agent": True},
    "seek_comfort": {"needs_colocated_agent_positive": True},
    "confront": {"needs_colocated_agent_negative": True},
    "celebrate": {"needs_positive_mood": True, "needs_colocated_agent": True},
    "mourn": {"needs_negative_mood": True},
    "avoid": {"needs_colocated_agent_negative": True},
}

# ── Social interaction definitions ───────────────────────────────────────────

SOCIAL_INTERACTIONS: dict[str, dict] = {
    "deep_conversation": {
        "weight": 30,
        "mood_range": (-20, 100),
        "opinion_range": (-10, 100),
        "opinion_effect": 8,
        "mood_effect": 5,
        "need_type": "social",
        "need_amount": 15,
        "generates_memory": True,
        "significance": 3,
        "opinion_preset": "good_conversation",
    },
    "casual_chat": {
        "weight": 50,
        "mood_range": (-50, 100),
        "opinion_range": (-30, 100),
        "opinion_effect": 3,
        "mood_effect": 2,
        "need_type": "social",
        "need_amount": 8,
        "generates_memory": False,
        "significance": 1,
        "opinion_preset": None,
    },
    "insult": {
        "weight": 5,
        "mood_range": (-100, -20),
        "opinion_range": (-100, -20),
        "opinion_effect": -12,
        "mood_effect": -3,
        "aggressor_mood_effect": 2,
        "need_type": None,
        "need_amount": 0,
        "generates_memory": True,
        "significance": 5,
        "opinion_preset": "insult",
        "can_trigger_event": "argument_escalation",
    },
    "seek_comfort_interaction": {
        "weight": 15,
        "mood_range": (-100, -30),
        "opinion_range": (20, 100),
        "opinion_effect": 5,
        "mood_effect": 10,
        "need_type": "social",
        "need_amount": 20,
        "generates_memory": True,
        "significance": 4,
        "opinion_preset": "helped_in_need",
    },
    "collaboration": {
        "weight": 20,
        "mood_range": (-10, 100),
        "opinion_range": (0, 100),
        "opinion_effect": 5,
        "mood_effect": 3,
        "need_type": "purpose",
        "need_amount": 10,
        "generates_memory": False,
        "significance": 2,
        "opinion_preset": "shared_experience",
    },
    "confrontation": {
        "weight": 3,
        "mood_range": (-100, -40),
        "opinion_range": (-100, -50),
        "opinion_effect": -20,
        "mood_effect": -10,
        "need_type": None,
        "need_amount": 0,
        "generates_memory": True,
        "significance": 7,
        "opinion_preset": "argument",
        "can_trigger_event": "conflict_event",
    },
}

# Base probability of interaction per tick for co-located agents
BASE_INTERACTION_PROBABILITY = 0.15


class AgentActivityService:
    """Selects and executes autonomous agent activities each heartbeat tick."""

    # ── Activity Selection (Tier 1: 0 LLM cost) ─────────────────

    @classmethod
    async def select_and_execute(
        cls,
        supabase: Client,
        simulation_id: UUID,
        tick_id: UUID | None = None,
    ) -> list[dict]:
        """Select and execute activities for all agents in a simulation.

        Returns list of activity records (for logging and briefing).
        """
        structlog.contextvars.bind_contextvars(
            simulation_id=str(simulation_id),
            phase="activity_selection",
        )

        # Load all agent data in batch
        agents = await cls._load_agent_context(supabase, simulation_id)
        if not agents:
            return []

        # Load zone/building context
        zone_agents = cls._group_by_zone(agents)

        activities: list[dict] = []

        for agent in agents:
            try:
                activity = cls._select_activity(agent, zone_agents)
                executed = await cls._execute_activity(
                    supabase, simulation_id, agent, activity, tick_id,
                )
                activities.append(executed)
            except Exception:
                logger.exception(
                    "Activity selection failed for agent",
                    extra={"agent_id": agent["id"]},
                )
                sentry_sdk.capture_exception()

        logger.info(
            "Activities selected",
            extra={
                "agent_count": len(agents),
                "activities": len(activities),
            },
        )
        return activities

    @classmethod
    def _select_activity(cls, agent: dict, zone_agents: dict) -> str:
        """Select an activity for one agent using Utility AI + Boltzmann."""
        needs = agent.get("needs", {})
        mood = agent.get("mood", {})
        profile = agent.get("personality_profile", {})
        zone_id = agent.get("current_zone_id")
        building_id = agent.get("current_building_id")

        # Get co-located agents
        colocated = zone_agents.get(zone_id, []) if zone_id else []
        colocated_ids = [a["id"] for a in colocated if a["id"] != agent["id"]]
        opinions = agent.get("opinions", {})

        has_positive_neighbor = any(
            opinions.get(aid, {}).get("opinion_score", 0) > 20
            for aid in colocated_ids
        )
        has_negative_neighbor = any(
            opinions.get(aid, {}).get("opinion_score", 0) < -20
            for aid in colocated_ids
        )

        # Compute utility for each activity
        utilities: dict[str, float] = {}

        for activity, base_score in ACTIVITY_BASE_SCORES.items():
            # Check requirements
            reqs = ACTIVITY_REQUIREMENTS.get(activity, {})
            if reqs.get("needs_building") and not building_id:
                continue
            if reqs.get("needs_colocated_agent") and not colocated_ids:
                continue
            if reqs.get("needs_colocated_agent_positive") and not has_positive_neighbor:
                continue
            if reqs.get("needs_colocated_agent_negative") and not has_negative_neighbor:
                continue
            if reqs.get("needs_positive_mood") and mood.get("mood_score", 0) < 30:
                continue
            if reqs.get("needs_negative_mood") and mood.get("mood_score", 0) > -20:
                continue

            utility = base_score

            # Need bonus: activities addressing lowest need get a boost
            need_bonus = cls._compute_need_bonus(activity, needs)
            utility += need_bonus

            # Personality trait modifier
            trait_mod = cls._compute_trait_modifier(activity, profile)
            utility += trait_mod

            # Mood modifier
            mood_score = mood.get("mood_score", 0)
            mood_mod = cls._compute_mood_modifier(activity, mood_score)
            utility += mood_mod

            utilities[activity] = max(0.1, utility)

        if not utilities:
            return "rest"  # Fallback

        # Boltzmann selection
        stress = mood.get("stress_level", 0)
        return cls._boltzmann_select(utilities, stress)

    @classmethod
    def _compute_need_bonus(cls, activity: str, needs: dict) -> float:
        """Compute bonus from needs that this activity fulfills."""
        bonus = 0.0
        for need_type, activities in NEED_ACTIVITY_MAP.items():
            if activity in activities:
                need_val = needs.get(need_type, 60)
                # Lower need = higher bonus (inverse, max 30)
                bonus += max(0, (60 - need_val) / 2)
        return bonus

    @classmethod
    def _compute_trait_modifier(cls, activity: str, profile: dict) -> float:
        """Compute personality-based modifier for an activity."""
        bonuses = TRAIT_ACTIVITY_BONUSES.get(activity, {})
        mod = 0.0
        for trait, max_bonus in bonuses.items():
            trait_val = profile.get(trait, 0.5)
            mod += (trait_val - 0.5) * max_bonus * 2  # -max..+max
        return mod

    @classmethod
    def _compute_mood_modifier(cls, activity: str, mood_score: int) -> float:
        """Compute mood-based modifier."""
        if mood_score < -30:
            # Bad mood: boost rest, avoid, mourn; penalize work, socialize
            if activity in ("rest", "avoid", "mourn", "confront"):
                return 10.0
            if activity in ("work", "socialize", "celebrate", "create"):
                return -10.0
        elif mood_score > 30:
            # Good mood: boost socialize, celebrate, create
            if activity in ("socialize", "celebrate", "create", "explore"):
                return 8.0
            if activity in ("avoid", "mourn", "confront"):
                return -8.0
        return 0.0

    @classmethod
    def _boltzmann_select(cls, utilities: dict[str, float], stress: int) -> str:
        """Boltzmann (softmax) selection with stress-modulated temperature.

        Low stress → low temperature → rational choices (best utility wins).
        High stress → high temperature → erratic choices (more random).

        Temperature is scaled relative to the utility range so that
        even large utility differences produce meaningful variety at
        high stress levels.
        """
        stress_factor = max(0.3, min(3.0, 0.5 + (stress / 300)))
        # Scale temperature to utility magnitude so probabilities spread properly
        util_range = max(utilities.values()) - min(utilities.values()) or 1.0
        temperature = util_range * 0.15 * stress_factor

        # Compute softmax probabilities
        max_util = max(utilities.values())
        exp_scores = {
            a: math.exp((u - max_util) / temperature)
            for a, u in utilities.items()
        }
        total = sum(exp_scores.values())
        if total == 0:
            return random.choice(list(utilities.keys()))  # noqa: S311

        activities = list(exp_scores.keys())
        weights = [exp_scores[a] / total for a in activities]

        return random.choices(activities, weights=weights, k=1)[0]  # noqa: S311

    # ── Activity Execution ───────────────────────────────────────

    @classmethod
    async def _execute_activity(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent: dict,
        activity_type: str,
        tick_id: UUID | None,
    ) -> dict:
        """Execute a selected activity: fulfill needs, log to DB."""
        agent_id = agent["id"]

        # Fulfill needs from activity
        fulfilled = await AgentNeedsService.fulfill_from_activity(
            supabase, agent_id, activity_type,
        )

        # Determine significance
        significance = 1
        if activity_type in ("confront", "celebrate", "mourn"):
            significance = 5
        elif activity_type in ("socialize", "seek_comfort", "create"):
            significance = 3

        # Build activity record
        record = {
            "agent_id": str(agent_id),
            "simulation_id": str(simulation_id),
            "activity_type": activity_type,
            "location_zone_id": agent.get("current_zone_id"),
            "location_building_id": agent.get("current_building_id"),
            "significance": significance,
            "effects": {"needs_fulfilled": fulfilled},
            "heartbeat_tick_id": str(tick_id) if tick_id else None,
        }

        # Insert activity log
        supabase.table("agent_activities").insert(record).execute()

        return record

    # ── Social Interaction Generation ────────────────────────────

    @classmethod
    async def generate_social_interactions(
        cls,
        supabase: Client,
        simulation_id: UUID,
        interaction_rate: float = 1.0,
        tick_id: UUID | None = None,
    ) -> list[dict]:
        """Generate social interactions between co-located agents.

        Returns list of interaction records.
        """
        structlog.contextvars.bind_contextvars(
            simulation_id=str(simulation_id),
            phase="social_interactions",
        )

        agents = await cls._load_agent_context(supabase, simulation_id)
        zone_agents = cls._group_by_zone(agents)
        interactions: list[dict] = []

        for _zone_id, zone_agent_list in zone_agents.items():
            if len(zone_agent_list) < 2:
                continue

            for agent_a, agent_b in combinations(zone_agent_list, 2):
                # Check interaction probability
                prob = cls._interaction_probability(
                    agent_a, agent_b, interaction_rate,
                )
                if random.random() > prob:  # noqa: S311
                    continue

                # Select interaction type
                interaction = cls._select_interaction(agent_a, agent_b)
                if not interaction:
                    continue

                # Execute interaction effects
                result = await cls._execute_interaction(
                    supabase, simulation_id, agent_a, agent_b,
                    interaction, tick_id,
                )
                if result:
                    interactions.append(result)

        logger.info(
            "Social interactions generated",
            extra={"count": len(interactions)},
        )
        return interactions

    @classmethod
    def _interaction_probability(
        cls, agent_a: dict, agent_b: dict, rate: float,
    ) -> float:
        """Compute probability of two co-located agents interacting."""
        base = BASE_INTERACTION_PROBABILITY * rate

        # Sociability average
        mood_a = agent_a.get("mood", {})
        mood_b = agent_b.get("mood", {})
        soc_avg = (
            mood_a.get("sociability", 0.5) + mood_b.get("sociability", 0.5)
        ) / 2
        soc_mod = soc_avg * 0.2

        # Existing relationship boosts interaction
        opinions_a = agent_a.get("opinions", {})
        opinion_of_b = opinions_a.get(agent_b["id"], {}).get("opinion_score", 0)
        rel_mod = 0.1 if abs(opinion_of_b) > 30 else 0

        # Low social need drives seeking
        needs_a = agent_a.get("needs", {})
        needs_b = agent_b.get("needs", {})
        low_social = min(needs_a.get("social", 60), needs_b.get("social", 60))
        need_mod = max(0, (60 - low_social) / 200)

        return min(0.5, base + soc_mod + rel_mod + need_mod)

    @classmethod
    def _select_interaction(cls, agent_a: dict, agent_b: dict) -> dict | None:
        """Select interaction type based on mood and opinions."""
        mood_a = agent_a.get("mood", {}).get("mood_score", 0)
        opinions_a = agent_a.get("opinions", {})
        opinion_of_b = opinions_a.get(agent_b["id"], {}).get("opinion_score", 0)

        # Filter to valid interactions
        valid: list[tuple[str, dict, float]] = []
        for name, config in SOCIAL_INTERACTIONS.items():
            mood_min, mood_max = config["mood_range"]
            op_min, op_max = config["opinion_range"]

            if mood_min <= mood_a <= mood_max and op_min <= opinion_of_b <= op_max:
                valid.append((name, config, config["weight"]))

        if not valid:
            return None

        # Weighted random selection
        names, configs, weights = zip(*valid, strict=True)
        idx = random.choices(range(len(configs)), weights=weights, k=1)[0]  # noqa: S311
        return {**configs[idx], "name": names[idx]}

    @classmethod
    async def _execute_interaction(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_a: dict,
        agent_b: dict,
        interaction: dict,
        tick_id: UUID | None,
    ) -> dict | None:
        """Execute a social interaction: apply opinion/mood/need effects."""
        try:
            name = interaction["name"]

            # Apply opinion modifier (A's opinion of B)
            preset = interaction.get("opinion_preset")
            if preset:
                await AgentOpinionService.add_modifier(
                    supabase, agent_a["id"], agent_b["id"],
                    simulation_id, preset,
                )

            # Apply mood effect to target (B)
            mood_effect = interaction.get("mood_effect", 0)
            if mood_effect != 0:
                emotion = "joy" if mood_effect > 0 else "distress"
                await AgentMoodService.add_moodlet(
                    supabase, agent_b["id"], simulation_id,
                    moodlet_type=f"social_{name}",
                    emotion=emotion,
                    strength=mood_effect,
                    source_type="social",
                    source_id=agent_a["id"],
                    source_description=f"{name} with {agent_a.get('name', 'agent')}",
                    decay_type="timed",
                    duration_hours=48,
                    stacking_group="social_positive" if mood_effect > 0 else "social_negative",
                )

            # Apply aggressor mood effect (if any)
            aggressor_effect = interaction.get("aggressor_mood_effect", 0)
            if aggressor_effect != 0:
                await AgentMoodService.add_moodlet(
                    supabase, agent_a["id"], simulation_id,
                    moodlet_type=f"social_{name}_self",
                    emotion="satisfaction" if aggressor_effect > 0 else "guilt",
                    strength=aggressor_effect,
                    source_type="social",
                    source_id=agent_b["id"],
                    decay_type="timed",
                    duration_hours=24,
                )

            # Fulfill social need
            need_type = interaction.get("need_type")
            need_amount = interaction.get("need_amount", 0)
            if need_type and need_amount > 0:
                await AgentNeedsService.fulfill_need(
                    supabase, agent_a["id"], need_type, need_amount,
                )
                await AgentNeedsService.fulfill_need(
                    supabase, agent_b["id"], need_type, need_amount * 0.7,
                )

            # Log activity for both agents
            significance = interaction.get("significance", 1)
            for agent in [agent_a, agent_b]:
                other = agent_b if agent == agent_a else agent_a
                supabase.table("agent_activities").insert({
                    "agent_id": str(agent["id"]),
                    "simulation_id": str(simulation_id),
                    "activity_type": "socialize",
                    "activity_subtype": name,
                    "location_zone_id": agent.get("current_zone_id"),
                    "target_agent_id": str(other["id"]),
                    "significance": significance,
                    "effects": {
                        "interaction": name,
                        "opinion_effect": interaction.get("opinion_effect", 0),
                        "mood_effect": mood_effect,
                    },
                    "heartbeat_tick_id": str(tick_id) if tick_id else None,
                }).execute()

            return {
                "type": name,
                "agent_a": agent_a["id"],
                "agent_b": agent_b["id"],
                "significance": significance,
                "can_trigger_event": interaction.get("can_trigger_event"),
            }

        except Exception:
            logger.exception(
                "Social interaction failed",
                extra={
                    "agent_a": str(agent_a["id"]),
                    "agent_b": str(agent_b["id"]),
                },
            )
            sentry_sdk.capture_exception()
            return None

    # ── Data Loading ─────────────────────────────────────────────

    @classmethod
    async def _load_agent_context(
        cls, supabase: Client, simulation_id: UUID,
    ) -> list[dict]:
        """Load all agents with their autonomy data (needs, mood, opinions)."""
        # Fetch agents (only those with autonomy enabled)
        agents_result = (
            supabase.table("agents")
            .select(
                "id, name, current_zone_id, current_building_id, personality_profile"
            )
            .eq("simulation_id", str(simulation_id))
            .is_("deleted_at", "null")
            .eq("autonomy_active", True)
            .execute()
        )
        agents = agents_result.data or []
        if not agents:
            return []

        # Batch fetch needs
        needs_result = (
            supabase.table("agent_needs")
            .select("agent_id, social, purpose, safety, comfort, stimulation")
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        needs_map = {n["agent_id"]: n for n in (needs_result.data or [])}

        # Batch fetch moods
        mood_result = (
            supabase.table("agent_mood")
            .select("agent_id, mood_score, stress_level, sociability, volatility, resilience")
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        mood_map = {m["agent_id"]: m for m in (mood_result.data or [])}

        # Batch fetch opinions (all pairs)
        opinion_result = (
            supabase.table("agent_opinions")
            .select("agent_id, target_agent_id, opinion_score")
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        # Build nested map: {agent_id: {target_id: {opinion_score: X}}}
        opinion_map: dict[str, dict] = {}
        for op in opinion_result.data or []:
            aid = op["agent_id"]
            if aid not in opinion_map:
                opinion_map[aid] = {}
            opinion_map[aid][op["target_agent_id"]] = {
                "opinion_score": op["opinion_score"],
            }

        # Enrich agents
        for agent in agents:
            aid = agent["id"]
            agent["needs"] = needs_map.get(aid, {})
            agent["mood"] = mood_map.get(aid, {})
            agent["opinions"] = opinion_map.get(aid, {})

        return agents

    @classmethod
    def _group_by_zone(cls, agents: list[dict]) -> dict[str, list[dict]]:
        """Group agents by their current zone."""
        zone_map: dict[str, list[dict]] = {}
        for agent in agents:
            zone_id = agent.get("current_zone_id")
            if zone_id:
                if zone_id not in zone_map:
                    zone_map[zone_id] = []
                zone_map[zone_id].append(agent)
        return zone_map
