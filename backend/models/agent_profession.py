"""Pydantic models for agent professions."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AgentProfessionCreate(BaseModel):
    """Schema for adding a profession to an agent."""

    profession: str = Field(..., min_length=1, max_length=100)
    qualification_level: int = Field(default=1, ge=1, le=5)
    specialization: str | None = None
    is_primary: bool = False
    certified_at: datetime | None = None
    certified_by: str | None = None


class AgentProfessionUpdate(BaseModel):
    """Schema for updating an agent profession."""

    qualification_level: int | None = Field(default=None, ge=1, le=5)
    specialization: str | None = None
    is_primary: bool | None = None
    certified_at: datetime | None = None
    certified_by: str | None = None


class AgentProfessionResponse(BaseModel):
    """Full agent profession response."""

    id: UUID
    simulation_id: UUID
    agent_id: UUID
    profession: str
    qualification_level: int = 1
    specialization: str | None = None
    is_primary: bool = False
    certified_at: datetime | None = None
    certified_by: str | None = None
    created_at: datetime
    updated_at: datetime
