"""Autonomous event generation service.

Checks simulation state for threshold conditions that trigger autonomous
events: stress breakdowns, relationship breakthroughs/breakdowns, celebrations,
zone crisis reactions, and community responses. When triggered, generates
narrative text via LLM (Tier 3 processing) and creates proper events in the
events table.

Zone crisis probability is modulated by stability via piecewise linear
multiplier (A2 from game-systems-integration concept doc): unstable zones
attract more events (up to 1.5x cap), stable zones attract fewer (0.5x floor).
After each negative event, a catharsis mechanic (community response) has a
configurable chance to spawn a healing positive event in the same zone.

Integrates with the existing event system (events table, event_reactions,
cascade mechanics) so autonomous events participate in all standard flows:
bleed threshold checks, chronicle generation, zone stability impact.

Uses ``EchoService.evaluate_echo_candidates`` for cross-simulation bleed evaluation.
Side effects (moodlets, relationships) use PG functions from migrations 145/146.
"""

from __future__ import annotations

import json
import logging
import random
from uuid import UUID

import httpx
import sentry_sdk
import structlog
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.dependencies import get_admin_supabase
from backend.services.agent_mood_service import AgentMoodService
from backend.services.budget_enforcement_service import BudgetExceededError
from backend.services.echo_service import EchoService
from backend.services.external.openrouter import BudgetContext, OpenRouterService
from backend.services.external.output_repair import repair_json_output
from backend.services.model_resolver import ModelResolver
from backend.utils.db import maybe_single_data
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

# Base probability of a zone crisis check at stability multiplier 1.0.
# Over 6 ticks/day: ~3 crisis checks/day for a baseline-stability zone.
# Multiplied by _stability_event_multiplier(zone_stability) per zone per tick.
_BASE_CRISIS_PROBABILITY = 0.5

# Probability of spawning a positive "community response" event after a
# negative/crisis event. Catharsis mechanic — prevents death spirals.
# Design ref: RimWorld catharsis (+40 mood), Darkest Dungeon virtue (25%).
_COMMUNITY_RESPONSE_PROBABILITY = 0.20

# ── Autonomous event trigger definitions ─────────────────────────────────────

TRIGGERS: dict[str, dict] = {
    "stress_breakdown": {
        "description": "Agent stress exceeds breakdown threshold (800+)",
        "impact_level": 4,
        "event_type": "crisis",
        "significance": 8,
        "cascade_radius": "zone",
        "moodlet_for_witnesses": {
            "moodlet_type": "witnessed_breakdown",
            "emotion": "anxiety",
            "strength": -5,
            "duration_hours": 72,
            "stacking_group": "crisis_witness",
        },
    },
    "relationship_breakthrough": {
        "description": "Opinion crosses +60 threshold — strong bond forms",
        "impact_level": 2,
        "event_type": "social",
        "significance": 5,
        "creates_relationship": True,
        "relationship_type": "ally",
        "relationship_intensity": 6,
    },
    "relationship_breakdown": {
        "description": "Opinion crosses -60 threshold — hostility erupts",
        "impact_level": 4,
        "event_type": "social",
        "significance": 7,
        "modifies_relationship": True,
        "relationship_type": "rival",
    },
    "celebration": {
        "description": "3+ agents with mood > 50 in same zone",
        "impact_level": 2,
        "event_type": "social",
        "significance": 4,
        "moodlet_for_participants": {
            "moodlet_type": "celebration",
            "emotion": "joy",
            "strength": 8,
            "duration_hours": 48,
            "stacking_group": "celebration",
        },
    },
    "zone_crisis_reaction": {
        "description": "Stability-weighted crisis: probability scales with zone instability, agent safety need < 20",
        "impact_level": 5,
        "event_type": "crisis",
        "significance": 7,
    },
    "conflict_escalation": {
        "description": "Triggered by confrontation social interaction",
        "impact_level": 3,
        "event_type": "social",
        "significance": 6,
    },
    "community_response": {
        "description": "Community rallies after crisis (catharsis mechanic)",
        "impact_level": 3,
        "event_type": "positive",
        "significance": 4,
        "heartbeat_pressure": -0.1,
        "moodlet_for_participants": {
            "moodlet_type": "community_spirit",
            "emotion": "hope",
            "strength": 5,
            "duration_hours": 48,
            "stacking_group": "community_response",
        },
        "moodlet_for_witnesses": {
            "moodlet_type": "community_spirit",
            "emotion": "hope",
            "strength": 3,
            "duration_hours": 48,
            "stacking_group": "community_response",
        },
    },
}

# LLM prompt for autonomous event narrative
_EVENT_NARRATIVE_SYSTEM = (
    "You are a narrative writer for a simulation world. Generate a brief "
    "event description (2-3 sentences) for an autonomous event that occurred "
    "between AI agents. Write in present tense, third person. "
    'Return JSON: {"title": "...", "description": "...", '
    '"title_de": "...", "description_de": "..."}'
)

_EVENT_NARRATIVE_USER = """Generate a narrative for this autonomous event:

Simulation: {simulation_name}
Event type: {trigger_type} — {trigger_description}
Involved agents: {agent_names}
Zone: {zone_name}
Context: {context}

The tone should match the simulation's world. Keep it concise and dramatic."""


class AutonomousEventService:
    """Detects threshold conditions and generates autonomous events."""

    @classmethod
    async def check_and_generate(
        cls,
        supabase: Client,
        simulation_id: UUID,
        tick_context: dict,
        *,
        llm_budget: int = 5,
        openrouter_api_key: str | None = None,
    ) -> list[dict]:
        """Check all trigger conditions and generate events.

        Args:
            tick_context: Results from earlier tick phases (breakdowns,
                relationship events, social interactions, activities).
            llm_budget: Max LLM calls for narrative generation this tick.

        Returns list of created event dicts.
        """
        structlog.contextvars.bind_contextvars(
            simulation_id=str(simulation_id),
            phase="autonomous_events",
        )

        events_to_create: list[dict] = []
        llm_calls_used = 0

        # 1. Stress breakdowns (from mood service)
        breakdowns = tick_context.get("breakdowns", [])
        for agent_id in breakdowns:
            agent_data = await cls._get_agent_data(supabase, agent_id)
            if agent_data:
                events_to_create.append(
                    {
                        "trigger": "stress_breakdown",
                        "agents": [agent_data],
                        "zone_id": agent_data.get("current_zone_id"),
                        "context": f"Stress level exceeded 800. Agent: {agent_data.get('name')}",
                    }
                )

        # 2. Relationship threshold events (from opinion service)
        rel_events = tick_context.get("relationship_events", [])
        for rel_event in rel_events:
            rel_agent_id = rel_event.get("agent_id")
            rel_target_id = rel_event.get("target_agent_id")
            if not rel_agent_id or not rel_target_id:
                continue
            agent_a = await cls._get_agent_data(supabase, rel_agent_id)
            agent_b = await cls._get_agent_data(supabase, rel_target_id)
            if agent_a and agent_b:
                trigger_type = rel_event.get("type", "relationship_threshold")
                events_to_create.append(
                    {
                        "trigger": trigger_type,
                        "agents": [agent_a, agent_b],
                        "zone_id": agent_a.get("current_zone_id"),
                        "context": (
                            f"Opinion score: {rel_event.get('opinion_score', 0)}. "
                            f"Agents: {agent_a.get('name')} and {agent_b.get('name')}"
                        ),
                    }
                )

        # 3. Conflict escalations (from social interactions)
        social_interactions = tick_context.get("social_interactions", [])
        for si in social_interactions:
            if si.get("can_trigger_event"):
                si_agent_a = si.get("agent_a")
                si_agent_b = si.get("agent_b")
                if not si_agent_a or not si_agent_b:
                    continue
                agent_a = await cls._get_agent_data(supabase, si_agent_a)
                agent_b = await cls._get_agent_data(supabase, si_agent_b)
                if agent_a and agent_b:
                    events_to_create.append(
                        {
                            "trigger": "conflict_escalation",
                            "agents": [agent_a, agent_b],
                            "zone_id": agent_a.get("current_zone_id"),
                            "context": f"Interaction type: {si.get('type', 'unknown')}",
                        }
                    )

        # 4. Celebrations (check for 3+ happy agents in same zone)
        celebration_events = await cls._check_celebrations(supabase, simulation_id)
        events_to_create.extend(celebration_events)

        # 5. Zone crisis reactions
        crisis_events = await cls._check_zone_crises(supabase, simulation_id)
        events_to_create.extend(crisis_events)

        if not events_to_create:
            return []

        # Generate narratives and create events
        created: list[dict] = []
        sim_name = await cls._get_simulation_name(supabase, simulation_id)

        for event_data in events_to_create:
            if llm_calls_used >= llm_budget:
                # Budget exhausted: create event with template text
                result = await cls._create_event_template(
                    supabase,
                    simulation_id,
                    event_data,
                )
            else:
                # Generate narrative via LLM
                result = await cls._create_event_with_narrative(
                    supabase,
                    simulation_id,
                    event_data,
                    sim_name,
                    openrouter_api_key=openrouter_api_key,
                )
                llm_calls_used += 1

            if result:
                # Apply side effects (moodlets, relationships)
                await cls._apply_trigger_effects(
                    supabase,
                    simulation_id,
                    event_data,
                    result,
                )

                # Evaluate for cross-simulation bleed
                await cls._evaluate_bleed(supabase, simulation_id, result)

                created.append(result)

                # Community response: 20% chance to spawn positive event
                # after negative events (catharsis mechanic — RimWorld/Frostpunk
                # pattern, prevents death spirals per concept doc A2)
                community = await cls._maybe_spawn_community_response(
                    supabase,
                    simulation_id,
                    event_data,
                    result,
                )
                if community:
                    created.append(community)

        logger.info(
            "Autonomous events created",
            extra={
                "count": len(created),
                "llm_calls": llm_calls_used,
                "triggers": [e["trigger"] for e in events_to_create],
            },
        )
        return created

    # ── Condition Checks ─────────────────────────────────────────

    @classmethod
    async def _check_celebrations(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> list[dict]:
        """Check for zones with 3+ happy agents (mood > 50)."""
        # INNER JOIN: mood records without a parent agent are orphans;
        # name/current_zone_id required for grouping — LEFT JOIN would add unusable null rows
        result = await (
            supabase.table("agent_mood")
            .select("agent_id, agents!inner(name, current_zone_id)")
            .eq("simulation_id", str(simulation_id))
            .gte("mood_score", 50)
            .execute()
        )
        if not result.data:
            return []

        # Group by zone
        zone_agents: dict[str, list[dict]] = {}
        for row in result.data:
            agent_info = row.get("agents", {})
            zone_id = agent_info.get("current_zone_id")
            if zone_id:
                if zone_id not in zone_agents:
                    zone_agents[zone_id] = []
                zone_agents[zone_id].append(
                    {
                        "id": row["agent_id"],
                        "name": agent_info.get("name", "Unknown"),
                        "current_zone_id": zone_id,
                    }
                )

        events = []
        for zone_id, agents in zone_agents.items():
            if len(agents) >= 3:
                events.append(
                    {
                        "trigger": "celebration",
                        "agents": agents[:5],  # Cap at 5 for prompt size
                        "zone_id": zone_id,
                        "context": f"{len(agents)} happy agents in zone",
                    }
                )
        return events

    @classmethod
    async def _check_zone_crises(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> list[dict]:
        """Check all zones for crisis events, weighted by stability.

        Stability modulates event probability via piecewise linear multiplier
        (A2 from game-systems-integration concept doc):

        - Low stability (< 0.3) → up to 1.5x event probability (hard cap)
        - Baseline (0.5) → 1.0x (normal)
        - High stability (> 0.7) → down to 0.5x (floor)

        Prevents death spirals via 1.5x cap + community response mechanic.
        """
        # Fetch ALL zones — stability-weighted probability replaces hard threshold
        zones_result = await (
            supabase.table("mv_zone_stability")
            .select("zone_id, stability")
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        if not zones_result.data:
            return []

        events = []

        for zone in zones_result.data:
            zone_id = zone["zone_id"]
            stability = zone.get("stability", 0.5)
            multiplier = cls._stability_event_multiplier(stability)

            # Probability gate: multiplier scales base probability
            threshold = min(1.0, _BASE_CRISIS_PROBABILITY * multiplier)
            if random.random() > threshold:  # noqa: S311
                continue

            # Gate passed — check for agents with low safety in this zone
            agents_result = await (
                supabase.table("agents")
                .select("id, name, current_zone_id")
                .eq("simulation_id", str(simulation_id))
                .eq("current_zone_id", zone_id)
                .is_("deleted_at", "null")
                .execute()
            )
            agent_ids = [a["id"] for a in (extract_list(agents_result))]
            if not agent_ids:
                continue

            # Check safety needs
            needs_result = await (
                supabase.table("agent_needs")
                .select("agent_id, safety")
                .in_("agent_id", agent_ids)
                .lt("safety", 20)
                .execute()
            )
            if needs_result.data:
                affected = [
                    a for a in (extract_list(agents_result)) if a["id"] in [n["agent_id"] for n in needs_result.data]
                ]
                if affected:
                    events.append(
                        {
                            "trigger": "zone_crisis_reaction",
                            "agents": affected[:3],
                            "zone_id": zone_id,
                            "context": (
                                f"Zone stability {stability:.2f} "
                                f"(multiplier {multiplier:.1f}x). "
                                f"{len(affected)} agent(s) with safety need <20"
                            ),
                        }
                    )
        return events

    @staticmethod
    def _stability_event_multiplier(stability: float) -> float:
        """Piecewise linear event probability multiplier from zone stability.

        Low stability → more events (up to 1.5x hard cap).
        High stability → fewer events (down to 0.5x floor).

        Breakpoints (from game-systems-integration.md, A2):
          stability 0.0–0.1 → 1.5x  (critical: maximum event pressure)
          stability 0.3      → 1.3x  (unstable: elevated)
          stability 0.5      → 1.0x  (baseline: normal)
          stability 0.7      → 0.8x  (stable: reduced)
          stability 0.9–1.0  → 0.5x  (exemplary: minimal events)

        Design references:
        - Hard cap at 1.5x prevents exponential death spirals (Civ7 pattern)
        - Piecewise linear for player comprehension (vs exponential/sigmoid)
        - Flat zones at extremes prevent over-sensitivity at boundaries
        """
        breakpoints = [
            (0.0, 1.5),
            (0.1, 1.5),
            (0.3, 1.3),
            (0.5, 1.0),
            (0.7, 0.8),
            (0.9, 0.5),
            (1.0, 0.5),
        ]
        s = max(0.0, min(1.0, stability))

        for i in range(len(breakpoints) - 1):
            x0, y0 = breakpoints[i]
            x1, y1 = breakpoints[i + 1]
            if s <= x1:
                if x1 == x0:  # Flat segment (e.g. 0.0–0.1)
                    return y0
                t = (s - x0) / (x1 - x0)
                return y0 + t * (y1 - y0)

        return breakpoints[-1][1]

    # ── Event Creation ───────────────────────────────────────────

    @classmethod
    async def _create_event_with_narrative(
        cls,
        supabase: Client,
        simulation_id: UUID,
        event_data: dict,
        sim_name: str,
        *,
        openrouter_api_key: str | None = None,
    ) -> dict | None:
        """Create event with LLM-generated narrative."""
        trigger = event_data.get("trigger", "unknown")
        trigger_config = TRIGGERS.get(trigger, {})
        agents = event_data.get("agents", [])
        agent_names = ", ".join(a.get("name", "Unknown") for a in agents)

        # Get zone name
        zone_name = "Unknown"
        zone_id = event_data.get("zone_id")
        if zone_id:
            zone_data = await maybe_single_data(
                supabase.table("zones").select("name").eq("id", str(zone_id)).maybe_single()
            )
            if zone_data:
                zone_name = zone_data.get("name", "Unknown")

        # Generate narrative
        user_prompt = _EVENT_NARRATIVE_USER.format(
            simulation_name=sim_name,
            trigger_type=trigger,
            trigger_description=trigger_config.get("description", trigger),
            agent_names=agent_names,
            zone_name=zone_name,
            context=event_data.get("context", ""),
        )

        try:
            model_resolver = ModelResolver(supabase, simulation_id)
            resolved = await model_resolver.resolve_text_model("event_generation")
            openrouter = OpenRouterService(api_key=openrouter_api_key)

            # Bureau Ops Deferral A.2 — thread simulation context into the
            # budget pre-check. Autonomous event generation runs from the
            # scheduler (no user JWT), so admin_supabase is fetched inline.
            # user_id is intentionally None — this is a system call, not a
            # user action.
            admin_supabase = await get_admin_supabase()
            budget = BudgetContext(
                admin_supabase=admin_supabase,
                purpose="event_generation",
                simulation_id=simulation_id,
            )

            content = await openrouter.generate(
                model=resolved.model_id,
                messages=[
                    {"role": "system", "content": _EVENT_NARRATIVE_SYSTEM},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.7,
                max_tokens=512,
                budget=budget,
            )
            repaired = repair_json_output(content)
            narrative = json.loads(repaired)

        except BudgetExceededError:
            # Budget block is a deliberate, audited admin action — fall
            # back to the template narrative (same behaviour as an LLM
            # failure) instead of letting the event silently drop.
            logger.info(
                "Event narrative skipped: AI budget blocked",
                extra={"simulation_id": str(simulation_id), "trigger": trigger},
            )
            narrative = cls._template_narrative(trigger, agent_names, zone_name)

        except (httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError, ValueError):
            logger.warning("LLM narrative failed, using template", exc_info=True)
            narrative = cls._template_narrative(trigger, agent_names, zone_name)

        return await cls._insert_event(
            supabase,
            simulation_id,
            event_data,
            trigger_config,
            narrative,
        )

    @classmethod
    async def _create_event_template(
        cls,
        supabase: Client,
        simulation_id: UUID,
        event_data: dict,
    ) -> dict | None:
        """Create event with template text (no LLM, budget exhausted)."""
        trigger = event_data.get("trigger", "unknown")
        trigger_config = TRIGGERS.get(trigger, {})
        agents = event_data.get("agents", [])
        agent_names = ", ".join(a.get("name", "Unknown") for a in agents)
        narrative = cls._template_narrative(trigger, agent_names, "")

        return await cls._insert_event(
            supabase,
            simulation_id,
            event_data,
            trigger_config,
            narrative,
        )

    @classmethod
    async def _insert_event(
        cls,
        supabase: Client,
        simulation_id: UUID,
        event_data: dict,
        trigger_config: dict,
        narrative: dict,
    ) -> dict | None:
        """Insert event into events table."""
        try:
            zone_id = event_data.get("zone_id")
            record = {
                "simulation_id": str(simulation_id),
                "title": narrative.get("title", event_data.get("trigger", "unknown")),
                "title_de": narrative.get("title_de"),
                "description": narrative.get("description", ""),
                "description_de": narrative.get("description_de"),
                "event_type": trigger_config.get("event_type", "social"),
                "impact_level": trigger_config.get("impact_level", 3),
                "event_status": "active",
                "data_source": "autonomous",
                "tags": [event_data.get("trigger", "unknown"), "autonomous"],
                "metadata": {
                    "trigger": event_data.get("trigger", "unknown"),
                    "agents": [a.get("id") for a in event_data.get("agents", [])],
                    "significance": trigger_config.get("significance", 5),
                    # Zone stored in metadata — events table has no zone_id column.
                    # Zone linking happens via assign_event_zones() trigger (migration 072)
                    # which maps event_type to zones via the gravity matrix.
                    **({"zone_id": str(zone_id)} if zone_id else {}),
                },
            }

            # Support healing pressure for positive events (community response)
            hp = trigger_config.get("heartbeat_pressure")
            if hp is not None:
                record["heartbeat_pressure"] = hp

            result = await supabase.table("events").insert(record).execute()
            return result.data[0] if result.data else None

        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.exception("Failed to insert autonomous event")
            sentry_sdk.capture_exception()
            return None

    # ── Side Effects ─────────────────────────────────────────────

    @classmethod
    async def _apply_trigger_effects(
        cls,
        supabase: Client,
        simulation_id: UUID,
        event_data: dict,
        created_event: dict,
    ) -> None:
        """Apply trigger-specific side effects (moodlets, relationships)."""
        trigger = event_data.get("trigger", "unknown")
        trigger_config = TRIGGERS.get(trigger, {})
        agents = event_data.get("agents", [])

        # Witness moodlets (stress breakdown cascade — DF pattern)
        witness_moodlet = trigger_config.get("moodlet_for_witnesses")
        if witness_moodlet and event_data.get("zone_id"):
            zone_agents = await (
                supabase.table("agents")
                .select("id")
                .eq("simulation_id", str(simulation_id))
                .eq("current_zone_id", str(event_data.get("zone_id")))
                .is_("deleted_at", "null")
                .execute()
            )
            triggering_ids = {a.get("id") for a in agents}
            for witness in extract_list(zone_agents):
                if witness["id"] not in triggering_ids:
                    await AgentMoodService.add_moodlet(
                        supabase,
                        witness["id"],
                        simulation_id,
                        **witness_moodlet,
                        source_type="event",
                        source_id=created_event.get("id"),
                        source_description=f"Witnessed {trigger}",
                    )

        # Participant moodlets (celebration)
        participant_moodlet = trigger_config.get("moodlet_for_participants")
        if participant_moodlet:
            for agent in agents:
                await AgentMoodService.add_moodlet(
                    supabase,
                    agent["id"],
                    simulation_id,
                    **participant_moodlet,
                    source_type="event",
                    source_id=created_event.get("id"),
                    source_description=f"Participated in {trigger}",
                )

        # Auto-create relationship (breakthrough)
        if trigger_config.get("creates_relationship") and len(agents) >= 2:
            try:
                await (
                    supabase.table("agent_relationships")
                    .upsert(
                        {
                            "simulation_id": str(simulation_id),
                            "source_agent_id": str(agents[0]["id"]),
                            "target_agent_id": str(agents[1]["id"]),
                            "relationship_type": trigger_config.get("relationship_type", "ally"),
                            "intensity": trigger_config.get("relationship_intensity", 5),
                            "is_bidirectional": True,
                            "description": f"Formed through {trigger}",
                        },
                        on_conflict="source_agent_id,target_agent_id,relationship_type",
                    )
                    .execute()
                )
            except (PostgrestAPIError, httpx.HTTPError):
                logger.warning("Relationship creation failed", exc_info=True)

        # Modify existing relationship (breakdown)
        if trigger_config.get("modifies_relationship") and len(agents) >= 2:
            try:
                await (
                    supabase.table("agent_relationships")
                    .update(
                        {
                            "relationship_type": trigger_config.get("relationship_type", "rival"),
                            "intensity": 3,
                        }
                    )
                    .eq("source_agent_id", str(agents[0]["id"]))
                    .eq("target_agent_id", str(agents[1]["id"]))
                    .execute()
                )
            except (PostgrestAPIError, httpx.HTTPError):
                logger.warning("Relationship modification failed", exc_info=True)

    # ── Community Response (Catharsis) ────────────────────────────

    @classmethod
    async def _maybe_spawn_community_response(
        cls,
        supabase: Client,
        simulation_id: UUID,
        source_event_data: dict,
        source_event: dict,
    ) -> dict | None:
        """Spawn positive event after negative/crisis events (catharsis mechanic).

        Probability controlled by ``_COMMUNITY_RESPONSE_PROBABILITY`` (default 20%).
        Design ref: RimWorld catharsis (+40 mood, 2.5 days), Darkest Dungeon
        virtue chance (25%). Prevents death spirals by generating community
        solidarity after adverse events.

        Gate conditions (all must pass):
          1. Source event is crisis-type OR impact >= 4
          2. Random roll passes ``_COMMUNITY_RESPONSE_PROBABILITY``
          3. Source event has a zone_id

        Side effects:
          - Creates ``event_type='positive'`` event with ``heartbeat_pressure=-0.1``
          - Spreads ``community_spirit`` moodlets (participants +5, witnesses +3)
          - Stacking cap: 2 per agent (via ``STACKING_CAPS['community_response']``)
        """
        trigger = source_event_data.get("trigger")
        if not trigger:
            return None
        trigger_config = TRIGGERS.get(trigger, {})
        event_type = trigger_config.get("event_type", "social")
        impact = trigger_config.get("impact_level", 3)

        # Only trigger after crisis events or high-impact negative events
        if event_type != "crisis" and impact < 4:
            return None

        # Catharsis probability (concept doc A2)
        if random.random() > _COMMUNITY_RESPONSE_PROBABILITY:  # noqa: S311
            return None

        zone_id = source_event_data.get("zone_id")
        if not zone_id:
            return None

        # Build community response event
        agents = source_event_data.get("agents", [])[:2]
        community_data = {
            "trigger": "community_response",
            "agents": agents,
            "zone_id": zone_id,
            "context": (
                f"Community rallies after: {source_event.get('title', 'crisis')}. Solidarity emerges from adversity."
            ),
        }
        community_config = TRIGGERS["community_response"]
        narrative = cls._template_narrative(
            "community_response",
            ", ".join(a.get("name", "Unknown") for a in agents),
            "",
        )

        result = await cls._insert_event(
            supabase,
            simulation_id,
            community_data,
            community_config,
            narrative,
        )

        if result:
            # Apply zone-wide moodlets (participants + witnesses)
            await cls._apply_trigger_effects(
                supabase,
                simulation_id,
                community_data,
                result,
            )
            logger.info(
                "Community response spawned (catharsis)",
                extra={
                    "source_event_id": source_event.get("id"),
                    "zone_id": str(zone_id),
                    "simulation_id": str(simulation_id),
                },
            )

        return result

    # ── Bleed Integration ────────────────────────────────────────

    @classmethod
    async def _evaluate_bleed(
        cls,
        supabase: Client,
        simulation_id: UUID,
        created_event: dict,
    ) -> None:
        """Evaluate autonomous event for cross-simulation echo propagation.

        Only events with impact_level >= bleed threshold are considered.
        Delegates to EchoService.evaluate_echo_candidates().
        """
        impact = created_event.get("impact_level", 0)
        if impact < 5:  # Minimum plausible bleed threshold
            return

        try:
            candidates = await EchoService.evaluate_echo_candidates(
                supabase,
                created_event,
                simulation_id,
            )
            if candidates:
                logger.info(
                    "Autonomous event eligible for bleed",
                    extra={
                        "event_id": created_event.get("id"),
                        "candidates": len(candidates),
                        "impact": impact,
                    },
                )
                # Echoes will be created by the normal heartbeat
                # echo resolution pipeline in the next tick
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.warning(
                "Bleed evaluation failed for autonomous event",
                exc_info=True,
            )

    # ── Helpers ──────────────────────────────────────────────────

    @classmethod
    def _template_narrative(
        cls,
        trigger: str,
        agent_names: str,
        zone_name: str,
    ) -> dict:
        """Generate template-based narrative (no LLM fallback)."""
        n = agent_names  # Shorthand for templates
        templates = {
            "stress_breakdown": {
                "title": f"Incident: {n} – critical stress",
                "description": (f"{n} has reached a breaking point. Accumulated pressure has crossed the threshold."),
                "title_de": f"Vorfall: {n} – kritischer Stress",
                "description_de": (f"{n} hat die Belastungsgrenze überschritten. Der Druck hat sich entladen."),
            },
            "relationship_breakthrough": {
                "title": f"Alliance: {n}",
                "description": (f"A deep bond has crystallized between {n}. Shared trials have forged a connection."),
                "title_de": f"Allianz: {n}",
                "description_de": (
                    f"Zwischen {n} hat sich eine tiefe "
                    "Verbindung verdichtet. Geteilte Prüfungen "
                    "haben sie zusammengeschweißt."
                ),
            },
            "relationship_breakdown": {
                "title": f"Bruch: {n}",
                "description": (f"Relations between {n} have fractured beyond reconciliation. Open hostility."),
                "title_de": f"Bruch: {n}",
                "description_de": (f"Die Beziehung zwischen {n} ist unwiderruflich zerbrochen. Offene Feindseligkeit."),
            },
            "celebration": {
                "title": "Spontaneous gathering",
                "description": (f"{n} have gathered in spontaneous celebration. Morale surges."),
                "title_de": "Spontane Zusammenkunft",
                "description_de": (f"{n} haben sich zu einer spontanen Feier zusammengefunden. Die Moral steigt."),
            },
            "zone_crisis_reaction": {
                "title": "Zone destabilization response",
                "description": (f"{n} are reacting to deteriorating conditions in their zone. Unrest spreads."),
                "title_de": "Reaktion auf Destabilisierung",
                "description_de": (
                    f"{n} reagieren auf die sich verschlechternden Verhältnisse. Unruhe breitet sich aus."
                ),
            },
            "conflict_escalation": {
                "title": f"Escalation: {n}",
                "description": (f"A confrontation between {n} has escalated into open conflict."),
                "title_de": f"Konflikt: {agent_names}",
                "description_de": f"Eine Konfrontation zwischen {agent_names} ist eskaliert.",
            },
            "community_response": {
                "title": "Community rallies",
                "description": ("In the wake of crisis, solidarity emerges. Residents band together to restore order."),
                "title_de": "Gemeinschaft formiert sich",
                "description_de": ("Inmitten der Krise entsteht Solidarität. Bewohner schließen sich zusammen."),
            },
        }
        return templates.get(
            trigger,
            {
                "title": f"Event: {trigger}",
                "description": f"An autonomous event occurred involving {agent_names}.",
                "title_de": f"Ereignis: {trigger}",
                "description_de": f"Ein autonomes Ereignis mit {agent_names} ist eingetreten.",
            },
        )

    @classmethod
    async def _get_agent_data(cls, supabase: Client, agent_id: str) -> dict | None:
        """Fetch minimal agent data for event context."""
        try:
            return await maybe_single_data(
                supabase.table("agents")
                .select("id, name, current_zone_id, primary_profession")
                .eq("id", str(agent_id))
                .maybe_single()
            )
        except Exception:
            logger.warning("Failed to fetch agent data for %s", agent_id)
            return None

    @classmethod
    async def _get_simulation_name(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> str:
        """Fetch simulation name."""
        data = await maybe_single_data(
            supabase.table("simulations").select("name").eq("id", str(simulation_id)).maybe_single()
        )
        return data.get("name", "Unknown") if data else "Unknown"
