"""Pydantic models for locations (cities, zones, streets)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# --- City ---

class CityCreate(BaseModel):
    """Schema for creating a city."""

    name: str = Field(..., min_length=1, max_length=255)
    layout_type: str | None = None
    description: str | None = None
    population: int = Field(default=0, ge=0)
    map_center_lat: float | None = None
    map_center_lng: float | None = None
    map_default_zoom: int = 12


class CityUpdate(BaseModel):
    """Schema for updating a city."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    layout_type: str | None = None
    description: str | None = None
    population: int | None = Field(default=None, ge=0)
    map_center_lat: float | None = None
    map_center_lng: float | None = None
    map_default_zoom: int | None = None


class CityResponse(BaseModel):
    """Full city response."""

    id: UUID
    simulation_id: UUID
    name: str
    layout_type: str | None = None
    description: str | None = None
    population: int = 0
    map_center_lat: float | None = None
    map_center_lng: float | None = None
    map_default_zoom: int = 12
    created_at: datetime
    updated_at: datetime


# --- Zone ---

class ZoneCreate(BaseModel):
    """Schema for creating a zone."""

    city_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    zone_type: str = "residential"
    population_estimate: int = Field(default=0, ge=0)
    security_level: str = "medium"
    data_source: str | None = None


class ZoneUpdate(BaseModel):
    """Schema for updating a zone."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    zone_type: str | None = None
    population_estimate: int | None = Field(default=None, ge=0)
    security_level: str | None = None


class ZoneResponse(BaseModel):
    """Full zone response."""

    id: UUID
    simulation_id: UUID
    city_id: UUID
    name: str
    description: str | None = None
    zone_type: str
    population_estimate: int = 0
    security_level: str
    data_source: str | None = None
    created_at: datetime
    updated_at: datetime


# --- Street ---

class StreetCreate(BaseModel):
    """Schema for creating a street."""

    city_id: UUID
    zone_id: UUID | None = None
    name: str | None = Field(default=None, max_length=255)
    street_type: str | None = None
    length_km: float | None = None
    geojson: dict | None = None


class StreetUpdate(BaseModel):
    """Schema for updating a street."""

    zone_id: UUID | None = None
    name: str | None = Field(default=None, max_length=255)
    street_type: str | None = None
    length_km: float | None = None
    geojson: dict | None = None


class StreetResponse(BaseModel):
    """Full street response."""

    id: UUID
    simulation_id: UUID
    city_id: UUID
    zone_id: UUID | None = None
    name: str | None = None
    street_type: str | None = None
    length_km: float | None = None
    geojson: dict | None = None
    created_at: datetime
    updated_at: datetime
