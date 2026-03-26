"""Pydantic models for the Simulation Heartbeat system.

Covers: heartbeat ticks, chronicle entries, narrative arcs,
bureau responses, substrate attunements, collaborative anchors.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

# -- Heartbeat Tick --

HeartbeatStatus = Literal["processing", "completed", "failed", "skipped"]


class HeartbeatTickResponse(BaseModel):
    """A single heartbeat tick summary."""

    id: UUID
    simulation_id: UUID
    tick_number: int
    status: HeartbeatStatus
    summary: dict = Field(default_factory=dict)
    dispatch_en: str | None = None
    dispatch_de: str | None = None
    events_aged: int = 0
    events_escalated: int = 0
    events_resolved: int = 0
    zone_actions_expired: int = 0
    scar_tissue_delta: float = 0.0
    resonance_pressure_delta: float = 0.0
    bureau_responses_resolved: int = 0
    cascade_events_spawned: int = 0
    convergence_detected: bool = False
    created_at: datetime


# -- Heartbeat Entry (Chronicle Feed) --

HeartbeatEntryType = Literal[
    "zone_shift", "event_aging", "event_escalation", "event_resolution",
    "scar_tissue", "resonance_pressure", "cascade_spawn", "bureau_response",
    "attunement_deepen", "anchor_strengthen", "convergence", "positive_event",
    "narrative_arc", "system_note",
    # Phase A5 autonomy entry types (CHECK constraint extended in migration 156)
    "autonomous_event", "agent_crisis", "relationship_shift", "social_event",
    # Ambient weather (migration 156)
    "ambient_weather",
]

HeartbeatSeverity = Literal["info", "warning", "critical", "positive"]


class HeartbeatEntryResponse(BaseModel):
    """A single chronicle entry within a tick."""

    id: UUID
    heartbeat_id: UUID
    simulation_id: UUID
    tick_number: int
    entry_type: HeartbeatEntryType
    narrative_en: str
    narrative_de: str | None = None
    metadata: dict = Field(default_factory=dict)
    severity: HeartbeatSeverity = "info"
    created_at: datetime


# -- Heartbeat Overview (for simulation page header) --


class HeartbeatOverview(BaseModel):
    """Current heartbeat state for a simulation — header display."""

    simulation_id: UUID
    last_tick: int
    last_heartbeat_at: datetime | None = None
    next_heartbeat_at: datetime | None = None
    status: str = "healthy"
    active_arcs: int = 0
    pending_responses: int = 0
    active_attunements: int = 0
    active_anchors: int = 0


# -- Narrative Arc --

ArcType = Literal["escalation", "cascade", "convergence", "resolution"]
ArcStatus = Literal["building", "active", "climax", "resolving", "resolved", "dormant"]


class NarrativeArcResponse(BaseModel):
    """A narrative arc in a simulation."""

    id: UUID
    simulation_id: UUID
    arc_type: ArcType
    primary_signature: str
    secondary_signature: str | None = None
    primary_archetype: str | None = None
    secondary_archetype: str | None = None
    status: ArcStatus
    pressure: float = 0.0
    peak_pressure: float = 0.0
    started_at_tick: int = 0
    last_active_tick: int = 0
    ticks_active: int = 0
    ticks_dormant: int = 0
    source_event_ids: list[UUID] = Field(default_factory=list)
    spawned_event_ids: list[UUID] = Field(default_factory=list)
    scar_tissue_deposited: float = 0.0
    created_at: datetime
    updated_at: datetime


# -- Bureau Response --

BureauResponseType = Literal["contain", "remediate", "adapt"]
BureauResponseStatus = Literal["pending", "resolving", "resolved", "expired", "failed"]


class BureauResponseCreate(BaseModel):
    """Create a bureau response to an event."""

    response_type: BureauResponseType
    assigned_agent_ids: list[UUID] = Field(min_length=1, max_length=5)


class BureauResponseResponse(BaseModel):
    """A bureau response record."""

    id: UUID
    simulation_id: UUID
    event_id: UUID
    response_type: BureauResponseType
    assigned_agent_ids: list[UUID] = Field(default_factory=list)
    agent_count: int = 0
    status: BureauResponseStatus
    submitted_before_tick: int
    resolved_at_tick: int | None = None
    effectiveness: float = 0.0
    pressure_reduction: float = 0.0
    staffing_penalty_active: bool = True
    created_by_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


# -- Substrate Attunement --


class AttunementCreate(BaseModel):
    """Set a resonance signature attunement."""

    resonance_signature: str = Field(pattern=r"^[a-z_]+$")


class AttunementResponse(BaseModel):
    """A substrate attunement record."""

    id: UUID
    simulation_id: UUID
    resonance_signature: str
    depth: float = 0.0
    ticks_exposed: int = 0
    positive_threshold: float = 0.50
    positive_event_generated: bool = False
    switching_cooldown_ticks: int = 0
    created_by_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


# -- Collaborative Anchor --

AnchorStatus = Literal["forming", "active", "reinforcing", "dissolved"]


class AnchorCreate(BaseModel):
    """Create a collaborative anchor."""

    name: str = Field(min_length=1, max_length=200)
    resonance_id: UUID
    resonance_signature: str


class AnchorResponse(BaseModel):
    """A collaborative anchor record."""

    id: UUID
    name: str
    resonance_id: UUID | None = None
    resonance_signature: str
    anchor_simulation_ids: list[UUID] = Field(default_factory=list)
    strength: float = 0.0
    status: AnchorStatus
    formed_at_tick: int = 0
    ticks_active: int = 0
    created_by_simulation_id: UUID | None = None
    created_by_user_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


# -- Cascade Rule --


class CascadeRuleResponse(BaseModel):
    """A resonance cascade rule."""

    id: UUID
    source_signature: str
    target_signature: str
    pressure_threshold: float
    transfer_rate: float
    narrative_en: str
    narrative_de: str | None = None
    cooldown_hours: int = 72
    depth_cap: int = 5
    is_active: bool = True
    last_triggered_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


# -- Admin Dashboard --


class HeartbeatSimulationStatus(BaseModel):
    """Per-simulation heartbeat status for admin dashboard."""

    simulation_id: UUID
    simulation_name: str
    slug: str
    last_tick: int
    last_heartbeat_at: datetime | None = None
    next_heartbeat_at: datetime | None = None
    status: str
    active_arcs: int = 0
    scar_tissue_level: float = 0.0
    pending_responses: int = 0


class HeartbeatDashboard(BaseModel):
    """Admin heartbeat dashboard data."""

    global_enabled: bool
    interval_seconds: int
    active_systems: list[str]
    simulations: list[HeartbeatSimulationStatus]
