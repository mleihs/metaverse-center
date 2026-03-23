"""Morning briefing service — narrative summaries of autonomous agent activity.

Generates priority-classified briefings (critical/important/routine) from
agent activities since the player's last login. Supports AI narrative mode
(LLM-generated prose summary) and data mode (structured metrics only).

Inspired by Football Manager's priority inbox, CK3's notification system,
idle game offline progress summaries.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

import sentry_sdk
import structlog

from backend.models.agent_autonomy import (
    MorningBriefingData,
    SimulationMoodSummary,
)
from backend.services.external.openrouter import OpenRouterService
from backend.services.external.output_repair import repair_json_output
from backend.services.model_resolver import ModelResolver
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# ── Priority thresholds ──────────────────────────────────────────────────────

CRITICAL_MIN_SIGNIFICANCE = 8
IMPORTANT_MIN_SIGNIFICANCE = 5
MAX_CRITICAL = 3
MAX_IMPORTANT = 5
MAX_ROUTINE = 3

# ── Briefing narrative prompt ────────────────────────────────────────────────

_BRIEFING_SYSTEM = (
    "You are a Bureau of Impossible Geography field analyst writing a "
    "classified daily briefing for a Cartographer. Write in the Bureau's "
    "voice: formal, slightly ominous, institutional. Use present tense. "
    "Return JSON: {\"narrative_en\": \"...\", \"narrative_de\": \"...\"}"
)

_BRIEFING_USER = """Write a daily briefing for simulation "{simulation_name}".

Since the Cartographer's last observation ({hours_ago}h ago), the following occurred:

CRITICAL EVENTS:
{critical_summary}

IMPORTANT EVENTS:
{important_summary}

ROUTINE SUMMARY:
{routine_summary}

MOOD STATE:
- Average mood: {avg_mood}/100
- Agents in crisis (stress>800): {crisis_count}
- Happy agents (mood>30): {happy_count}
- Unhappy agents (mood<-30): {unhappy_count}

Write 3-5 sentences summarizing the situation. Highlight critical items.
Include the Bureau classification header and a recommendation."""


class MorningBriefingService:
    """Generates narrative morning briefings from autonomous activity data."""

    @classmethod
    async def generate(
        cls,
        supabase: Client,
        simulation_id: UUID,
        since: datetime | None = None,
        *,
        mode: str = "narrative",
        openrouter_api_key: str | None = None,
    ) -> MorningBriefingData:
        """Generate a morning briefing for a simulation.

        Args:
            since: Activities since this timestamp. Defaults to 24h ago.
            mode: "narrative" (AI prose) or "data" (metrics only).
        """
        structlog.contextvars.bind_contextvars(
            simulation_id=str(simulation_id),
            phase="morning_briefing",
        )

        if since is None:
            since = datetime.now(UTC) - timedelta(hours=24)

        # Fetch activities since last login
        activities = await cls._fetch_activities(
            supabase, simulation_id, since,
        )

        # Classify by priority
        critical = [
            a for a in activities
            if a.get("significance", 0) >= CRITICAL_MIN_SIGNIFICANCE
        ][:MAX_CRITICAL]
        important = [
            a for a in activities
            if IMPORTANT_MIN_SIGNIFICANCE
            <= a.get("significance", 0)
            < CRITICAL_MIN_SIGNIFICANCE
        ][:MAX_IMPORTANT]
        routine = [
            a for a in activities
            if a.get("significance", 0) < IMPORTANT_MIN_SIGNIFICANCE
        ]

        # Compute mood summary
        mood_summary = await cls._compute_mood_summary(
            supabase, simulation_id,
        )

        # Fetch significant opinion changes
        opinion_changes = await cls._fetch_opinion_changes(
            supabase, simulation_id, since,
        )

        # Aggregate routine into summary text
        routine_summary, routine_summary_de = cls._aggregate_routine(routine)

        # Generate narrative (if mode=narrative and there's content)
        narrative_en = None
        narrative_de = None

        if mode == "narrative" and (critical or important):
            narrative_en, narrative_de = await cls._generate_narrative(
                supabase, simulation_id, since,
                critical, important, routine_summary,
                mood_summary,
                openrouter_api_key=openrouter_api_key,
            )

        briefing = MorningBriefingData(
            simulation_id=simulation_id,
            since=since,
            critical_activities=critical,
            important_activities=important,
            routine_summary=routine_summary,
            routine_summary_de=routine_summary_de,
            mood_summary=mood_summary,
            opinion_changes=opinion_changes,
            narrative_text=narrative_en,
            narrative_text_de=narrative_de,
        )

        logger.info(
            "Briefing generated",
            extra={
                "critical": len(critical),
                "important": len(important),
                "routine": len(routine),
                "mode": mode,
                "has_narrative": narrative_en is not None,
            },
        )
        return briefing

    # ── Data Fetching ────────────────────────────────────────────

    @classmethod
    async def _fetch_activities(
        cls, supabase: Client, simulation_id: UUID, since: datetime,
    ) -> list[dict]:
        """Fetch all activities since timestamp, ordered by significance."""
        result = await (
            supabase.table("agent_activities")
            .select(
                "*, agents!agent_activities_agent_id_fkey(name, portrait_image_url)"
            )
            .eq("simulation_id", str(simulation_id))
            .gte("created_at", since.isoformat())
            .order("significance", desc=True)
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )

        # Flatten joined data
        activities = []
        for row in result.data or []:
            agent_info = row.pop("agents", {}) or {}
            row["agent_name"] = agent_info.get("name")
            row["agent_portrait"] = agent_info.get("portrait_image_url")
            activities.append(row)
        return activities

    @classmethod
    async def _compute_mood_summary(
        cls, supabase: Client, simulation_id: UUID,
    ) -> SimulationMoodSummary:
        """Compute aggregate mood state."""
        result = await (
            supabase.table("agent_mood")
            .select("mood_score, stress_level, dominant_emotion")
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        moods = result.data or []

        if not moods:
            return SimulationMoodSummary(
                simulation_id=simulation_id,
                agent_count=0,
                avg_mood_score=0,
                avg_stress_level=0,
                agents_in_crisis=0,
                agents_happy=0,
                agents_unhappy=0,
            )

        emotion_counts: dict[str, int] = {}
        for m in moods:
            e = m.get("dominant_emotion", "neutral")
            emotion_counts[e] = emotion_counts.get(e, 0) + 1

        return SimulationMoodSummary(
            simulation_id=simulation_id,
            agent_count=len(moods),
            avg_mood_score=sum(m["mood_score"] for m in moods) / len(moods),
            avg_stress_level=(
                sum(m["stress_level"] for m in moods) / len(moods)
            ),
            agents_in_crisis=sum(
                1 for m in moods if m["stress_level"] >= 800
            ),
            agents_happy=sum(1 for m in moods if m["mood_score"] > 30),
            agents_unhappy=sum(1 for m in moods if m["mood_score"] < -30),
            dominant_emotions=emotion_counts,
        )

    @classmethod
    async def _fetch_opinion_changes(
        cls, supabase: Client, simulation_id: UUID, since: datetime,
    ) -> list[dict]:
        """Fetch significant opinion modifier additions since timestamp."""
        result = await (
            supabase.table("agent_opinion_modifiers")
            .select(
                "agent_id, target_agent_id, modifier_type, opinion_change, "
                "created_at"
            )
            .eq("simulation_id", str(simulation_id))
            .gte("created_at", since.isoformat())
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        return result.data or []

    # ── Routine Aggregation ──────────────────────────────────────

    @classmethod
    def _aggregate_routine(
        cls, routine_activities: list[dict],
    ) -> tuple[str, str]:
        """Aggregate routine activities into a summary sentence."""
        if not routine_activities:
            return (
                "No significant routine activity recorded.",
                "Keine nennenswerte Routineaktivität verzeichnet.",
            )

        # Count by type
        type_counts: dict[str, int] = {}
        for a in routine_activities:
            t = a.get("activity_type", "unknown")
            type_counts[t] = type_counts.get(t, 0) + 1

        # Unique agents involved
        agent_names = {
            a.get("agent_name", "Unknown")
            for a in routine_activities
            if a.get("agent_name")
        }

        parts_en = []
        parts_de = []
        for activity_type, count in sorted(
            type_counts.items(), key=lambda x: -x[1],
        ):
            parts_en.append(f"{count}x {activity_type}")
            parts_de.append(f"{count}x {activity_type}")

        summary_en = (
            f"{len(agent_names)} agent(s) performed routine activities: "
            f"{', '.join(parts_en[:5])}."
        )
        summary_de = (
            f"{len(agent_names)} Agent(en) führten Routineaktivitäten durch: "
            f"{', '.join(parts_de[:5])}."
        )
        return summary_en, summary_de

    # ── Narrative Generation ─────────────────────────────────────

    @classmethod
    async def _generate_narrative(
        cls,
        supabase: Client,
        simulation_id: UUID,
        since: datetime,
        critical: list[dict],
        important: list[dict],
        routine_summary: str,
        mood_summary: SimulationMoodSummary,
        *,
        openrouter_api_key: str | None = None,
    ) -> tuple[str | None, str | None]:
        """Generate AI narrative summary of the briefing."""
        sim_name = await cls._get_simulation_name(supabase, simulation_id)
        hours_ago = int(
            (datetime.now(UTC) - since).total_seconds() / 3600
        )

        critical_text = "\n".join(
            f"- [{a.get('activity_type')}] {a.get('agent_name', '?')}: "
            f"significance {a.get('significance', 0)}"
            for a in critical
        ) or "None"

        important_text = "\n".join(
            f"- [{a.get('activity_type')}] {a.get('agent_name', '?')}: "
            f"significance {a.get('significance', 0)}"
            for a in important
        ) or "None"

        user_prompt = _BRIEFING_USER.format(
            simulation_name=sim_name,
            hours_ago=hours_ago,
            critical_summary=critical_text,
            important_summary=important_text,
            routine_summary=routine_summary,
            avg_mood=round(mood_summary.avg_mood_score),
            crisis_count=mood_summary.agents_in_crisis,
            happy_count=mood_summary.agents_happy,
            unhappy_count=mood_summary.agents_unhappy,
        )

        try:
            model_resolver = ModelResolver(supabase, simulation_id)
            resolved = await model_resolver.resolve("event_generation")
            openrouter = OpenRouterService(api_key=openrouter_api_key)

            response = await openrouter.chat(
                model=resolved.model_id,
                messages=[
                    {"role": "system", "content": _BRIEFING_SYSTEM},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.6,
                max_tokens=800,
                response_format={"type": "json_object"},
            )

            content = response.get("content", "")
            repaired = repair_json_output(content)
            data = json.loads(repaired)
            return data.get("narrative_en"), data.get("narrative_de")

        except Exception:
            logger.warning("Briefing narrative generation failed", exc_info=True)
            sentry_sdk.capture_exception()
            return None, None

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
        return (
            result.data.get("name", "Unknown") if result.data else "Unknown"
        )
