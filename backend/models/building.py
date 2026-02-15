"""Pydantic models for buildings."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BuildingCreate(BaseModel):
    """Schema for creating a new building."""

    name: str = Field(..., min_length=1, max_length=255)
    building_type: str
    description: str | None = None
    style: str | None = None
    location: dict | None = None
    city_id: UUID | None = None
    zone_id: UUID | None = None
    street_id: UUID | None = None
    address: str | None = None
    population_capacity: int = Field(default=0, ge=0)
    construction_year: int | None = None
    building_condition: str | None = None
    image_url: str | None = None
    image_prompt_text: str | None = None
    special_type: str | None = None
    special_attributes: dict | None = None
    data_source: str = "manual"


class BuildingUpdate(BaseModel):
    """Schema for updating a building."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    building_type: str | None = None
    description: str | None = None
    style: str | None = None
    location: dict | None = None
    city_id: UUID | None = None
    zone_id: UUID | None = None
    street_id: UUID | None = None
    address: str | None = None
    population_capacity: int | None = Field(default=None, ge=0)
    construction_year: int | None = None
    building_condition: str | None = None
    image_url: str | None = None
    image_prompt_text: str | None = None
    special_type: str | None = None
    special_attributes: dict | None = None


class BuildingResponse(BaseModel):
    """Full building response."""

    id: UUID
    simulation_id: UUID
    name: str
    building_type: str
    description: str | None = None
    style: str | None = None
    location: dict | None = None
    city_id: UUID | None = None
    zone_id: UUID | None = None
    street_id: UUID | None = None
    address: str | None = None
    population_capacity: int = 0
    construction_year: int | None = None
    building_condition: str | None = None
    geojson: dict | None = None
    image_url: str | None = None
    image_prompt_text: str | None = None
    special_type: str | None = None
    special_attributes: dict | None = None
    data_source: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class BuildingFilter(BaseModel):
    """Query filters for building listing."""

    building_type: str | None = None
    building_condition: str | None = None
    zone_id: UUID | None = None
    city_id: UUID | None = None
    search: str | None = None
