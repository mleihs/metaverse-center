"""Pydantic models for agents."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    """Schema for creating a new agent."""

    name: str = Field(..., min_length=1, max_length=255)
    system: str | None = None
    character: str | None = None
    background: str | None = None
    gender: str | None = None
    primary_profession: str | None = None
    portrait_image_url: str | None = None
    portrait_description: str | None = None
    data_source: str = "manual"


class AgentUpdate(BaseModel):
    """Schema for updating an agent."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    system: str | None = None
    character: str | None = None
    background: str | None = None
    gender: str | None = None
    primary_profession: str | None = None
    portrait_image_url: str | None = None
    portrait_description: str | None = None


class AgentResponse(BaseModel):
    """Full agent response."""

    id: UUID
    simulation_id: UUID
    name: str
    system: str | None = None
    character: str | None = None
    background: str | None = None
    gender: str | None = None
    primary_profession: str | None = None
    portrait_image_url: str | None = None
    portrait_description: str | None = None
    data_source: str | None = None
    created_by_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class AgentFilter(BaseModel):
    """Query filters for agent listing."""

    system: str | None = None
    gender: str | None = None
    primary_profession: str | None = None
    search: str | None = None
