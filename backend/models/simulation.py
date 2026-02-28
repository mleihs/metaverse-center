from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SimulationCreate(BaseModel):
    """Schema for creating a new simulation."""

    name: str = Field(..., min_length=1, max_length=255)
    slug: str | None = Field(default=None, max_length=100, pattern=r"^[a-z0-9-]+$")
    description: str | None = None
    theme: str = "custom"
    content_locale: str = "en"
    additional_locales: list[str] = Field(default_factory=list)


class SimulationUpdate(BaseModel):
    """Schema for updating a simulation."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    theme: str | None = None
    content_locale: str | None = None
    additional_locales: list[str] | None = None


class SimulationResponse(BaseModel):
    """Full simulation response."""

    id: UUID
    name: str
    slug: str
    description: str | None = None
    theme: str
    status: str
    content_locale: str
    additional_locales: list[str] = Field(default_factory=list)
    owner_id: UUID
    icon_url: str | None = None
    banner_url: str | None = None
    simulation_type: str = "template"
    source_template_id: UUID | None = None
    epoch_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None
    deleted_at: datetime | None = None
    agent_count: int | None = None
    building_count: int | None = None
    event_count: int | None = None
    member_count: int | None = None


class SimulationDashboardResponse(BaseModel):
    """Simulation with aggregated counts from the simulation_dashboard view."""

    simulation_id: UUID
    name: str
    slug: str
    status: str
    theme: str
    content_locale: str
    owner_id: UUID
    member_count: int = 0
    agent_count: int = 0
    building_count: int = 0
    event_count: int = 0
    created_at: datetime
    updated_at: datetime
