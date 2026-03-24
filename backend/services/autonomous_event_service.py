"""Autonomous event generation service.

Checks simulation state for threshold conditions that trigger autonomous
events: stress breakdowns, relationship breakthroughs/breakdowns, celebrations,
zone crisis reactions. When triggered, generates narrative text via LLM
(Tier 3 processing) and creates proper events in the events table.

Integrates with the existing event system (events table, event_reactions,
cascade mechanics) so autonomous events participate in all standard flows:
bleed threshold checks, chronicle generation, zone stability impact.

Uses ``EchoService.evaluate_echo_candidates`` for cross-simulation bleed evaluation.
Side effects (moodlets, relationships) use PG functions from migrations 145/146.
"""

from __future__ import annotations

import json
import logging
from uuid import UUID

import httpx
import sentry_sdk
import structlog
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.agent_mood_service import AgentMoodService
from backend.services.echo_service import EchoService
from backend.services.external.openrouter import OpenRouterService
from backend.services.external.output_repair import repair_json_output
from backend.services.model_resolver import ModelResolver
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

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
        "description": "Zone stability < 0.3 and agent safety need < 20",
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
}

# LLM prompt for autonomous event narrative
_EVENT_NARRATIVE_SYSTEM = (
    "You are a narrative writer for a simulation world. Generate a brief "
    "event description (2-3 sentences) for an autonomous event that occurred "
    "between AI agents. Write in present tense, third person. "
    "Return JSON: {\"title\": \"...\", \"description\": \"...\", "
    "\"title_de\": \"...\", \"description_de\": \"...\"}"
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
                events_to_create.append({
                    "trigger": "stress_breakdown",
                    "agents": [agent_data],
                    "zone_id": agent_data.get("current_zone_id"),
                    "context": f"Stress level exceeded 800. Agent: {agent_data.get('name')}",
                })

        # 2. Relationship threshold events (from opinion service)
        rel_events = tick_context.get("relationship_events", [])
        for rel_event in rel_events:
            agent_a = await cls._get_agent_data(supabase, rel_event["agent_id"])
            agent_b = await cls._get_agent_data(supabase, rel_event["target_agent_id"])
            if agent_a and agent_b:
                trigger_type = rel_event["type"]
                events_to_create.append({
                    "trigger": trigger_type,
                    "agents": [agent_a, agent_b],
                    "zone_id": agent_a.get("current_zone_id"),
                    "context": (
                        f"Opinion score: {rel_event.get('opinion_score', 0)}. "
                        f"Agents: {agent_a.get('name')} and {agent_b.get('name')}"
                    ),
                })

        # 3. Conflict escalations (from social interactions)
        social_interactions = tick_context.get("social_interactions", [])
        for si in social_interactions:
            if si.get("can_trigger_event"):
                agent_a = await cls._get_agent_data(supabase, si["agent_a"])
                agent_b = await cls._get_agent_data(supabase, si["agent_b"])
                if agent_a and agent_b:
                    events_to_create.append({
                        "trigger": "conflict_escalation",
                        "agents": [agent_a, agent_b],
                        "zone_id": agent_a.get("current_zone_id"),
                        "context": f"Interaction type: {si['type']}",
                    })

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
                    supabase, simulation_id, event_data,
                )
            else:
                # Generate narrative via LLM
                result = await cls._create_event_with_narrative(
                    supabase, simulation_id, event_data, sim_name,
                    openrouter_api_key=openrouter_api_key,
                )
                llm_calls_used += 1

            if result:
                # Apply side effects (moodlets, relationships)
                await cls._apply_trigger_effects(
                    supabase, simulation_id, event_data, result,
                )

                # Evaluate for cross-simulation bleed
                await cls._evaluate_bleed(supabase, simulation_id, result)

                created.append(result)

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
        cls, supabase: Client, simulation_id: UUID,
    ) -> list[dict]:
        """Check for zones with 3+ happy agents (mood > 50)."""
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
                zone_agents[zone_id].append({
                    "id": row["agent_id"],
                    "name": agent_info.get("name", "Unknown"),
                    "current_zone_id": zone_id,
                })

        events = []
        for zone_id, agents in zone_agents.items():
            if len(agents) >= 3:
                events.append({
                    "trigger": "celebration",
                    "agents": agents[:5],  # Cap at 5 for prompt size
                    "zone_id": zone_id,
                    "context": f"{len(agents)} happy agents in zone",
                })
        return events

    @classmethod
    async def _check_zone_crises(
        cls, supabase: Client, simulation_id: UUID,
    ) -> list[dict]:
        """Check for agents in critical zones with low safety need."""
        # Get zones with low stability
        zones_result = await (
            supabase.table("mv_zone_stability")
            .select("zone_id, stability")
            .eq("simulation_id", str(simulation_id))
            .lt("stability", 0.3)
            .execute()
        )
        if not zones_result.data:
            return []

        crisis_zone_ids = [z["zone_id"] for z in zones_result.data]

        # Get agents in crisis zones with low safety
        events = []
        for zone_id in crisis_zone_ids:
            agents_result = await (
                supabase.table("agents")
                .select("id, name, current_zone_id")
                .eq("simulation_id", str(simulation_id))
                .eq("current_zone_id", zone_id)
                .is_("deleted_at", "null")
                .execute()
            )
            agent_ids = [a["id"] for a in (agents_result.data or [])]
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
                    a for a in (agents_result.data or [])
                    if a["id"] in [n["agent_id"] for n in needs_result.data]
                ]
                if affected:
                    events.append({
                        "trigger": "zone_crisis_reaction",
                        "agents": affected[:3],
                        "zone_id": zone_id,
                        "context": (
                            f"Zone stability critical (<0.3). "
                            f"{len(affected)} agent(s) with safety need <20"
                        ),
                    })
        return events

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
        trigger = event_data["trigger"]
        trigger_config = TRIGGERS.get(trigger, {})
        agents = event_data.get("agents", [])
        agent_names = ", ".join(a.get("name", "Unknown") for a in agents)

        # Get zone name
        zone_name = "Unknown"
        zone_id = event_data.get("zone_id")
        if zone_id:
            zone_result = await (
                supabase.table("zones")
                .select("name")
                .eq("id", str(zone_id))
                .maybe_single()
                .execute()
            )
            if zone_result.data:
                zone_name = zone_result.data.get("name", "Unknown")

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

            content = await openrouter.generate(
                model=resolved.model_id,
                messages=[
                    {"role": "system", "content": _EVENT_NARRATIVE_SYSTEM},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.7,
                max_tokens=512,
            )
            repaired = repair_json_output(content)
            narrative = json.loads(repaired)

        except (httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError, ValueError):
            logger.warning("LLM narrative failed, using template", exc_info=True)
            narrative = cls._template_narrative(trigger, agent_names, zone_name)

        return await cls._insert_event(
            supabase, simulation_id, event_data, trigger_config, narrative,
        )

    @classmethod
    async def _create_event_template(
        cls,
        supabase: Client,
        simulation_id: UUID,
        event_data: dict,
    ) -> dict | None:
        """Create event with template text (no LLM, budget exhausted)."""
        trigger = event_data["trigger"]
        trigger_config = TRIGGERS.get(trigger, {})
        agents = event_data.get("agents", [])
        agent_names = ", ".join(a.get("name", "Unknown") for a in agents)
        narrative = cls._template_narrative(trigger, agent_names, "")

        return await cls._insert_event(
            supabase, simulation_id, event_data, trigger_config, narrative,
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
            record = {
                "simulation_id": str(simulation_id),
                "title": narrative.get("title", event_data["trigger"]),
                "title_de": narrative.get("title_de"),
                "description": narrative.get("description", ""),
                "description_de": narrative.get("description_de"),
                "event_type": trigger_config.get("event_type", "social"),
                "impact_level": trigger_config.get("impact_level", 3),
                "status": "active",
                "data_source": "autonomous",
                "tags": [event_data["trigger"], "autonomous"],
                "metadata": {
                    "trigger": event_data["trigger"],
                    "agents": [a.get("id") for a in event_data.get("agents", [])],
                    "significance": trigger_config.get("significance", 5),
                },
            }

            zone_id = event_data.get("zone_id")
            if zone_id:
                record["zone_id"] = str(zone_id)

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
        trigger = event_data["trigger"]
        trigger_config = TRIGGERS.get(trigger, {})
        agents = event_data.get("agents", [])

        # Witness moodlets (stress breakdown cascade — DF pattern)
        witness_moodlet = trigger_config.get("moodlet_for_witnesses")
        if witness_moodlet and event_data.get("zone_id"):
            zone_agents = await (
                supabase.table("agents")
                .select("id")
                .eq("simulation_id", str(simulation_id))
                .eq("current_zone_id", str(event_data["zone_id"]))
                .is_("deleted_at", "null")
                .execute()
            )
            triggering_ids = {a.get("id") for a in agents}
            for witness in zone_agents.data or []:
                if witness["id"] not in triggering_ids:
                    await AgentMoodService.add_moodlet(
                        supabase, witness["id"], simulation_id,
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
                    supabase, agent["id"], simulation_id,
                    **participant_moodlet,
                    source_type="event",
                    source_id=created_event.get("id"),
                    source_description=f"Participated in {trigger}",
                )

        # Auto-create relationship (breakthrough)
        if trigger_config.get("creates_relationship") and len(agents) >= 2:
            try:
                await supabase.table("agent_relationships").upsert(
                    {
                        "simulation_id": str(simulation_id),
                        "source_agent_id": str(agents[0]["id"]),
                        "target_agent_id": str(agents[1]["id"]),
                        "relationship_type": trigger_config.get(
                            "relationship_type", "ally"
                        ),
                        "intensity": trigger_config.get(
                            "relationship_intensity", 5
                        ),
                        "is_bidirectional": True,
                        "description": f"Formed through {trigger}",
                    },
                    on_conflict="source_agent_id,target_agent_id,relationship_type",
                ).execute()
            except (PostgrestAPIError, httpx.HTTPError):
                logger.warning("Relationship creation failed", exc_info=True)

        # Modify existing relationship (breakdown)
        if trigger_config.get("modifies_relationship") and len(agents) >= 2:
            try:
                await supabase.table("agent_relationships").update({
                    "relationship_type": trigger_config.get(
                        "relationship_type", "rival"
                    ),
                    "intensity": 3,
                }).eq(
                    "source_agent_id", str(agents[0]["id"])
                ).eq(
                    "target_agent_id", str(agents[1]["id"])
                ).execute()
            except (PostgrestAPIError, httpx.HTTPError):
                logger.warning("Relationship modification failed", exc_info=True)

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
                supabase, created_event, simulation_id,
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
        cls, trigger: str, agent_names: str, zone_name: str,
    ) -> dict:
        """Generate template-based narrative (no LLM fallback)."""
        n = agent_names  # Shorthand for templates
        templates = {
            "stress_breakdown": {
                "title": f"Incident: {n} – critical stress",
                "description": (
                    f"{n} has reached a breaking point. "
                    "Accumulated pressure has crossed the threshold."
                ),
                "title_de": f"Vorfall: {n} – kritischer Stress",
                "description_de": (
                    f"{n} hat die Belastungsgrenze überschritten. "
                    "Der Druck hat sich entladen."
                ),
            },
            "relationship_breakthrough": {
                "title": f"Alliance: {n}",
                "description": (
                    f"A deep bond has crystallized between {n}. "
                    "Shared trials have forged a connection."
                ),
                "title_de": f"Allianz: {n}",
                "description_de": (
                    f"Zwischen {n} hat sich eine tiefe "
                    "Verbindung verdichtet. Geteilte Prüfungen "
                    "haben sie zusammengeschweißt."
                ),
            },
            "relationship_breakdown": {
                "title": f"Bruch: {n}",
                "description": (
                    f"Relations between {n} have fractured "
                    "beyond reconciliation. Open hostility."
                ),
                "title_de": f"Bruch: {n}",
                "description_de": (
                    f"Die Beziehung zwischen {n} ist "
                    "unwiderruflich zerbrochen. Offene Feindseligkeit."
                ),
            },
            "celebration": {
                "title": "Spontaneous gathering",
                "description": (
                    f"{n} have gathered in spontaneous celebration. "
                    "Morale surges."
                ),
                "title_de": "Spontane Zusammenkunft",
                "description_de": (
                    f"{n} haben sich zu einer spontanen Feier "
                    "zusammengefunden. Die Moral steigt."
                ),
            },
            "zone_crisis_reaction": {
                "title": "Zone destabilization response",
                "description": (
                    f"{n} are reacting to deteriorating conditions "
                    "in their zone. Unrest spreads."
                ),
                "title_de": "Reaktion auf Destabilisierung",
                "description_de": (
                    f"{n} reagieren auf die sich verschlechternden "
                    "Verhältnisse. Unruhe breitet sich aus."
                ),
            },
            "conflict_escalation": {
                "title": f"Escalation: {n}",
                "description": (
                    f"A confrontation between {n} has escalated "
                    "into open conflict."
                ),
                "title_de": f"Konflikt: {agent_names}",
                "description_de": f"Eine Konfrontation zwischen {agent_names} ist eskaliert.",
            },
        }
        return templates.get(trigger, {
            "title": f"Event: {trigger}",
            "description": f"An autonomous event occurred involving {agent_names}.",
            "title_de": f"Ereignis: {trigger}",
            "description_de": f"Ein autonomes Ereignis mit {agent_names} ist eingetreten.",
        })

    @classmethod
    async def _get_agent_data(cls, supabase: Client, agent_id: str) -> dict | None:
        """Fetch minimal agent data for event context."""
        result = await (
            supabase.table("agents")
            .select("id, name, current_zone_id, primary_profession")
            .eq("id", str(agent_id))
            .maybe_single()
            .execute()
        )
        return result.data

    @classmethod
    async def _get_simulation_name(
        cls, supabase: Client, simulation_id: UUID,
    ) -> str:
        """Fetch simulation name."""
        result = await (
            supabase.table("simulations")
            .select("name")
            .eq("id", str(simulation_id))
            .maybe_single()
            .execute()
        )
        return result.data.get("name", "Unknown") if result.data else "Unknown"
