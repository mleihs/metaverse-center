"""Pydantic models for game mechanics API responses."""

from __future__ import annotations

from datetime import UTC, datetime

from pydantic import BaseModel, Field


class BuildingReadinessResponse(BaseModel):
    """Building readiness metrics."""

    building_id: str
    simulation_id: str
    zone_id: str | None = None
    building_name: str
    building_type: str | None = None
    building_condition: str | None = None
    population_capacity: int = 0
    special_type: str | None = None
    assigned_agents: int = 0
    staffing_ratio: float = 0.0
    staffing_status: str = "n/a"
    qualification_match: float = 1.0
    condition_factor: float = 0.5
    criticality_weight: float = 1.0
    avg_influence: float = 0.0
    influence_factor: float = 1.0
    readiness: float = 0.0


class ZoneStabilityResponse(BaseModel):
    """Zone stability metrics."""

    zone_id: str
    simulation_id: str
    city_id: str | None = None
    zone_name: str
    zone_type: str | None = None
    security_level: str | None = None
    infrastructure_score: float = 0.0
    security_factor: float = 0.5
    event_pressure: float = 0.0
    ambient_pressure: float = 0.0
    fortification_reduction: float = 0.0
    is_quarantined: bool = False
    total_pressure: float = 0.0
    building_count: int = 0
    total_agents: int = 0
    total_capacity: int = 0
    critical_understaffed_count: int = 0
    avg_readiness: float = 0.0
    stability: float = 0.0
    stability_label: str = "critical"


class EmbassyEffectivenessResponse(BaseModel):
    """Embassy effectiveness metrics."""

    embassy_id: str
    simulation_a_id: str
    simulation_b_id: str
    building_a_id: str
    building_b_id: str
    status: str
    bleed_vector: str | None = None
    building_health: float = 0.0
    ambassador_quality: float = 0.0
    vector_alignment: float = 0.0
    effectiveness: float = 0.0
    effectiveness_label: str = "dormant"


class SimulationHealthResponse(BaseModel):
    """Top-level simulation health dashboard data."""

    simulation_id: str
    simulation_name: str
    slug: str | None = None

    # Zone stability
    avg_zone_stability: float = 0.0
    zone_count: int = 0
    critical_zone_count: int = 0
    unstable_zone_count: int = 0

    # Buildings
    building_count: int = 0
    avg_readiness: float = 0.0
    critically_understaffed_buildings: int = 0
    overcrowded_buildings: int = 0

    # Staffing
    total_agents_assigned: int = 0
    total_capacity: int = 0

    # Diplomacy
    diplomatic_reach: float = 0.0
    active_embassy_count: int = 0
    avg_embassy_effectiveness: float = 0.0

    # Bleed
    outbound_echoes: int = 0
    inbound_echoes: int = 0
    avg_outbound_strength: float = 0.0
    bleed_permeability: float = 0.0

    # Master metrics
    overall_health: float = 0.0
    health_label: str = "critical"


class SimulationHealthDashboard(BaseModel):
    """Full health dashboard combining all metrics for a simulation."""

    health: SimulationHealthResponse
    zones: list[ZoneStabilityResponse] = []
    buildings: list[BuildingReadinessResponse] = []
    embassies: list[EmbassyEffectivenessResponse] = []
    recent_high_impact_events: list[dict] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
