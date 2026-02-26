"""Pydantic models for event echoes and simulation connections."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

# -- Event Echoes --

class EchoCreate(BaseModel):
    """Schema for manually triggering an echo."""

    source_event_id: UUID
    target_simulation_id: UUID
    echo_vector: Literal[
        "commerce", "language", "memory", "resonance",
        "architecture", "dream", "desire",
    ]
    echo_strength: float = Field(1.0, ge=0, le=1)


class EchoResponse(BaseModel):
    """Full event echo response."""

    id: UUID
    source_event_id: UUID
    source_simulation_id: UUID
    target_simulation_id: UUID
    target_event_id: UUID | None = None
    echo_vector: str
    echo_strength: float
    echo_depth: int
    root_event_id: UUID | None = None
    status: str
    bleed_metadata: dict | None = None
    created_at: datetime
    updated_at: datetime
    source_event: dict | None = None
    target_event: dict | None = None


# -- Simulation Connections --

class ConnectionCreate(BaseModel):
    """Schema for creating a simulation connection."""

    simulation_a_id: UUID
    simulation_b_id: UUID
    connection_type: str = "bleed"
    bleed_vectors: list[str] = Field(default_factory=list)
    strength: float = Field(0.5, ge=0, le=1)
    description: str | None = None
    is_active: bool = True


class ConnectionUpdate(BaseModel):
    """Schema for updating a simulation connection."""

    connection_type: str | None = None
    bleed_vectors: list[str] | None = None
    strength: float | None = Field(None, ge=0, le=1)
    description: str | None = None
    is_active: bool | None = None


class ConnectionResponse(BaseModel):
    """Full simulation connection response."""

    id: UUID
    simulation_a_id: UUID
    simulation_b_id: UUID
    connection_type: str
    bleed_vectors: list[str]
    strength: float
    description: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    simulation_a: dict | None = None
    simulation_b: dict | None = None


class MapDataResponse(BaseModel):
    """Aggregated map data for the Cartographer's Map."""

    simulations: list[dict]
    connections: list[dict]
    echo_counts: dict  # {simulation_id: count}
