"""Pydantic models for agent relationships."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class RelationshipCreate(BaseModel):
    """Schema for creating an agent relationship."""

    target_agent_id: UUID
    relationship_type: str
    is_bidirectional: bool = True
    intensity: int = Field(5, ge=1, le=10)
    description: str | None = None


class RelationshipUpdate(BaseModel):
    """Schema for updating an agent relationship."""

    relationship_type: str | None = None
    is_bidirectional: bool | None = None
    intensity: int | None = Field(None, ge=1, le=10)
    description: str | None = None


class RelationshipResponse(BaseModel):
    """Full agent relationship response."""

    id: UUID
    simulation_id: UUID
    source_agent_id: UUID
    target_agent_id: UUID
    relationship_type: str
    is_bidirectional: bool
    intensity: int
    description: str | None = None
    metadata: dict | None = None
    created_at: datetime
    updated_at: datetime
    source_agent: dict | None = None
    target_agent: dict | None = None
