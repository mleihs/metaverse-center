"""Pydantic models for simulation taxonomies."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TaxonomyCreate(BaseModel):
    """Schema for creating a taxonomy value."""

    taxonomy_type: str = Field(..., min_length=1, max_length=50)
    value: str = Field(..., min_length=1, max_length=100)
    label: dict = Field(default_factory=dict)
    description: dict | None = None
    sort_order: int = 0
    is_default: bool = False
    metadata: dict | None = None


class TaxonomyUpdate(BaseModel):
    """Schema for updating a taxonomy value."""

    label: dict | None = None
    description: dict | None = None
    sort_order: int | None = None
    is_default: bool | None = None
    is_active: bool | None = None
    metadata: dict | None = None


class TaxonomyResponse(BaseModel):
    """Full taxonomy value response."""

    id: UUID
    simulation_id: UUID
    taxonomy_type: str
    value: str
    label: dict = Field(default_factory=dict)
    description: dict | None = None
    sort_order: int = 0
    is_default: bool = False
    is_active: bool = True
    metadata: dict | None = None
    created_at: datetime
    updated_at: datetime
