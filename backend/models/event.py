"""Pydantic models for events."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

EVENT_STATUSES = ("active", "escalating", "resolving", "resolved", "archived")
CHAIN_TYPES = ("escalation", "follow_up", "resolution", "cascade", "resonance")


class EventCreate(BaseModel):
    """Schema for creating a new event."""

    title: str = Field(..., min_length=1, max_length=500)
    event_type: str | None = None
    description: str | None = None
    occurred_at: datetime | None = None
    data_source: str = "manual"
    metadata: dict | None = None
    source_platform: str | None = None
    propaganda_type: str | None = None
    target_demographic: str | None = None
    urgency_level: str | None = None
    campaign_id: UUID | None = None
    impact_level: int = Field(default=1, ge=1, le=10)
    location: str | None = None
    tags: list[str] = Field(default_factory=list)
    external_refs: dict | None = None
    event_status: str = "active"


class EventUpdate(BaseModel):
    """Schema for updating an event."""

    title: str | None = Field(default=None, min_length=1, max_length=500)
    event_type: str | None = None
    description: str | None = None
    occurred_at: datetime | None = None
    metadata: dict | None = None
    propaganda_type: str | None = None
    target_demographic: str | None = None
    urgency_level: str | None = None
    campaign_id: UUID | None = None
    impact_level: int | None = Field(default=None, ge=1, le=10)
    location: str | None = None
    tags: list[str] | None = None
    external_refs: dict | None = None
    event_status: str | None = None


class EventResponse(BaseModel):
    """Full event response."""

    id: UUID
    simulation_id: UUID
    title: str
    event_type: str | None = None
    description: str | None = None
    occurred_at: datetime | None = None
    data_source: str | None = None
    metadata: dict | None = None
    source_platform: str | None = None
    propaganda_type: str | None = None
    target_demographic: str | None = None
    urgency_level: str | None = None
    campaign_id: UUID | None = None
    original_trend_data: dict | None = None
    impact_level: int = 1
    location: str | None = None
    tags: list[str] = Field(default_factory=list)
    external_refs: dict | None = None
    event_status: str = "active"
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class EventChainCreate(BaseModel):
    """Schema for linking two events in a chain."""

    parent_event_id: UUID
    child_event_id: UUID
    chain_type: str = Field(..., pattern=r"^(escalation|follow_up|resolution|cascade|resonance)$")


class EventChainResponse(BaseModel):
    """Event chain link response."""

    id: UUID
    simulation_id: UUID
    parent_event_id: UUID
    child_event_id: UUID
    chain_type: str
    created_at: datetime


class ReactionResponse(BaseModel):
    """Event reaction with optional embedded agent/event summary."""

    id: UUID
    simulation_id: UUID
    event_id: UUID
    agent_id: UUID
    reaction_text: str
    reaction_text_de: str | None = None
    emotion: str | None = None
    confidence_score: float | None = None
    created_at: datetime
    agents: dict | None = None
    events: dict | None = None


class EventZoneLinkResponse(BaseModel):
    """Event-zone link with flattened zone metadata."""

    id: UUID
    event_id: UUID
    zone_id: UUID
    link_type: str | None = None
    affinity_weight: float | None = None
    zone_name: str | None = None
    zone_type: str | None = None
    created_at: datetime | None = None


class GenerateEventReactionsRequest(BaseModel):
    """Request to generate agent reactions to an event."""

    agent_ids: list[str] | None = None
    max_agents: int = Field(default=10, ge=1, le=50)
