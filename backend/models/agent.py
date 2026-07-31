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
    is_ambassador: bool = False
    character_de: str | None = None
    background_de: str | None = None
    primary_profession_de: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    # Live columns added when the public read surface was typed. search_vector
    # (internal tsvector) is deliberately absent — typing strips it.
    slug: str | None = None
    personality_profile: dict | None = None
    autonomy_active: bool | None = None
    current_building_id: UUID | None = None
    current_zone_id: UUID | None = None
    ambassador_blocked_until: datetime | None = None
    style_reference_url: str | None = None
