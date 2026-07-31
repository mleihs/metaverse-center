"""Pydantic models for embassies (cross-simulation building links)."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

# -- Embassy CRUD --

class EmbassyCreate(BaseModel):
    """Schema for creating an embassy between two buildings."""

    building_a_id: UUID
    simulation_a_id: UUID
    building_b_id: UUID
    simulation_b_id: UUID
    connection_type: str = "embassy"
    description: str | None = None
    established_by: str | None = None
    bleed_vector: Literal[
        "commerce", "language", "memory", "resonance",
        "architecture", "dream", "desire",
    ] | None = None
    event_propagation: bool = True
    embassy_metadata: dict | None = None


class EmbassyUpdate(BaseModel):
    """Schema for updating an embassy."""

    description: str | None = None
    established_by: str | None = None
    bleed_vector: Literal[
        "commerce", "language", "memory", "resonance",
        "architecture", "dream", "desire",
    ] | None = None
    event_propagation: bool | None = None
    embassy_metadata: dict | None = None


class EmbassyResponse(BaseModel):
    """Full embassy response."""

    id: UUID
    building_a_id: UUID
    simulation_a_id: UUID
    building_b_id: UUID
    simulation_b_id: UUID
    status: str
    connection_type: str
    description: str | None = None
    established_by: str | None = None
    bleed_vector: str | None = None
    event_propagation: bool
    embassy_metadata: dict | None = None
    created_by_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    # Ward/infiltration game state (live columns; added when the public read
    # surface was typed)
    ward_strength: float | None = None
    ward_vector: dict | None = None
    infiltration_penalty: float | None = None
    infiltration_penalty_expires_at: datetime | None = None
    building_a: dict | None = None
    building_b: dict | None = None
    simulation_a: dict | None = None
    simulation_b: dict | None = None


# -- Embassy Event Propagation --

class EmbassyEventPropagation(BaseModel):
    """Schema for manually propagating an event through an embassy."""

    source_event_id: UUID
    source_building_id: UUID


# -- Generate Partner --

class EmbassyGeneratePair(BaseModel):
    """Schema for AI-generating a partner building for an embassy."""

    source_building_id: UUID
    target_simulation_id: UUID
    bleed_vector: Literal[
        "commerce", "language", "memory", "resonance",
        "architecture", "dream", "desire",
    ]
    name_hint: str | None = Field(None, max_length=100)
