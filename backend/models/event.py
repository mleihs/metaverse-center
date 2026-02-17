"""Pydantic models for events."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


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
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class EventFilter(BaseModel):
    """Query filters for event listing."""

    event_type: str | None = None
    impact_level: int | None = None
    tag: str | None = None
    search: str | None = None


class GenerateEventReactionsRequest(BaseModel):
    """Request to generate agent reactions to an event."""

    agent_ids: list[str] | None = None
    max_agents: int = Field(default=10, ge=1, le=50)
