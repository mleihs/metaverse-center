"""Pydantic models for the Agent Autonomy system (The Living World).

Covers mood, moodlets, opinions, opinion modifiers, needs, activities,
and personality profiles. Used by AgentAutonomyService and related services.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# ── Personality Profile ──────────────────────────────────────────────────────


class PersonalityProfile(BaseModel):
    """Big Five personality extracted from agent backstory via LLM."""

    openness: float = Field(0.5, ge=0, le=1)
    conscientiousness: float = Field(0.5, ge=0, le=1)
    extraversion: float = Field(0.5, ge=0, le=1)
    agreeableness: float = Field(0.5, ge=0, le=1)
    neuroticism: float = Field(0.5, ge=0, le=1)
    dominant_traits: list[str] = Field(default_factory=list)
    values: list[str] = Field(default_factory=list)
    fears: list[str] = Field(default_factory=list)
    social_style: str = "reserved"


# ── Needs ────────────────────────────────────────────────────────────────────


class AgentNeedsResponse(BaseModel):
    """Current need levels for an agent."""

    id: UUID
    agent_id: UUID
    simulation_id: UUID
    social: float
    purpose: float
    safety: float
    comfort: float
    stimulation: float
    social_decay: float
    purpose_decay: float
    safety_decay: float
    comfort_decay: float
    stimulation_decay: float
    updated_at: datetime


class NeedFulfillment(BaseModel):
    """Amount to fulfill a specific need."""

    need_type: str = Field(..., pattern=r"^(social|purpose|safety|comfort|stimulation)$")
    amount: float = Field(..., gt=0, le=100)


# ── Mood ─────────────────────────────────────────────────────────────────────


class AgentMoodResponse(BaseModel):
    """Current emotional state for an agent."""

    id: UUID
    agent_id: UUID
    simulation_id: UUID
    mood_score: int
    dominant_emotion: str
    stress_level: int
    resilience: float
    volatility: float
    sociability: float
    last_tick_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class MoodSummary(BaseModel):
    """Lightweight mood summary for lists and cards."""

    mood_score: int
    dominant_emotion: str
    stress_level: int


# ── Moodlets ─────────────────────────────────────────────────────────────────


class MoodletResponse(BaseModel):
    """A single active moodlet."""

    id: UUID
    agent_id: UUID
    moodlet_type: str
    emotion: str
    strength: int
    source_type: str
    source_id: UUID | None = None
    source_description: str | None = None
    decay_type: str
    initial_strength: int
    expires_at: datetime | None = None
    stacking_group: str | None = None
    created_at: datetime


class MoodletCreate(BaseModel):
    """Create a new moodlet on an agent."""

    moodlet_type: str
    emotion: str
    strength: int = Field(..., ge=-20, le=20)
    source_type: str = Field(
        ..., pattern=r"^(event|relationship|zone|building|social|memory|system)$"
    )
    source_id: UUID | None = None
    source_description: str | None = None
    decay_type: str = Field("timed", pattern=r"^(permanent|timed|decaying)$")
    duration_hours: float | None = None
    stacking_group: str | None = None


# ── Opinions ─────────────────────────────────────────────────────────────────


class AgentOpinionResponse(BaseModel):
    """Opinion of one agent about another."""

    id: UUID
    agent_id: UUID
    target_agent_id: UUID
    simulation_id: UUID
    opinion_score: int
    base_compatibility: float
    last_interaction_at: datetime | None = None
    interaction_count: int
    created_at: datetime
    updated_at: datetime
    # Enriched fields (joined from agents table)
    target_agent_name: str | None = None
    target_agent_portrait: str | None = None


class OpinionModifierResponse(BaseModel):
    """A single active opinion modifier."""

    id: UUID
    agent_id: UUID
    target_agent_id: UUID
    modifier_type: str
    opinion_change: int
    decay_type: str
    initial_value: int
    expires_at: datetime | None = None
    stacking_group: str | None = None
    source_event_id: UUID | None = None
    description: str | None = None
    created_at: datetime


class OpinionModifierCreate(BaseModel):
    """Create a new opinion modifier."""

    modifier_type: str
    opinion_change: int = Field(..., ge=-30, le=30)
    decay_type: str = Field("decaying", pattern=r"^(permanent|timed|decaying)$")
    duration_hours: float | None = None
    stacking_group: str | None = None
    source_event_id: UUID | None = None
    description: str | None = None


# ── Activities ───────────────────────────────────────────────────────────────

VALID_ACTIVITY_TYPES = {
    "work",
    "socialize",
    "rest",
    "explore",
    "maintain",
    "reflect",
    "avoid",
    "confront",
    "celebrate",
    "mourn",
    "seek_comfort",
    "collaborate",
    "create",
    "investigate",
}


class AgentActivityResponse(BaseModel):
    """A logged autonomous activity."""

    id: UUID
    agent_id: UUID
    simulation_id: UUID
    activity_type: str
    activity_subtype: str | None = None
    location_zone_id: UUID | None = None
    location_building_id: UUID | None = None
    target_agent_id: UUID | None = None
    related_event_id: UUID | None = None
    narrative_text: str | None = None
    narrative_text_de: str | None = None
    significance: int
    effects: dict = Field(default_factory=dict)
    heartbeat_tick_id: UUID | None = None
    created_at: datetime
    # Enriched fields
    agent_name: str | None = None
    agent_portrait: str | None = None
    target_agent_name: str | None = None
    zone_name: str | None = None
    building_name: str | None = None


class ActivityCreate(BaseModel):
    """Create an activity log entry."""

    activity_type: str
    activity_subtype: str | None = None
    location_zone_id: UUID | None = None
    location_building_id: UUID | None = None
    target_agent_id: UUID | None = None
    related_event_id: UUID | None = None
    narrative_text: str | None = None
    narrative_text_de: str | None = None
    significance: int = Field(1, ge=1, le=10)
    effects: dict = Field(default_factory=dict)
    heartbeat_tick_id: UUID | None = None


# ── Autonomy Dashboard / Briefing ────────────────────────────────────────────


class SimulationMoodSummary(BaseModel):
    """Aggregate mood state of a simulation's agents."""

    simulation_id: UUID
    agent_count: int
    avg_mood_score: float
    avg_stress_level: float
    agents_in_crisis: int  # stress > 800
    agents_happy: int  # mood > 30
    agents_unhappy: int  # mood < -30
    dominant_emotions: dict[str, int] = Field(default_factory=dict)


class MorningBriefingData(BaseModel):
    """Data for the enhanced morning briefing modal."""

    simulation_id: UUID
    since: datetime
    critical_activities: list[AgentActivityResponse] = Field(default_factory=list)
    important_activities: list[AgentActivityResponse] = Field(default_factory=list)
    routine_summary: str | None = None
    routine_summary_de: str | None = None
    mood_summary: SimulationMoodSummary | None = None
    opinion_changes: list[dict] = Field(default_factory=list)
    relationship_events: list[dict] = Field(default_factory=list)
    narrative_text: str | None = None
    narrative_text_de: str | None = None


# ── Autonomy Configuration ───────────────────────────────────────────────────


class AutonomyConfig(BaseModel):
    """Per-simulation autonomy settings (stored in simulation_settings)."""

    enabled: bool = False
    needs_decay_rate: float = Field(1.0, ge=0.1, le=3.0)
    social_interaction_rate: float = Field(1.0, ge=0.1, le=3.0)
    event_threshold: float = Field(0.5, ge=0.1, le=1.0)
    llm_budget_per_tick: int = Field(5, ge=1, le=20)
    stress_cascade_enabled: bool = True
    relationship_auto_create: bool = True
    briefing_mode: str = Field("narrative", pattern=r"^(narrative|data)$")
