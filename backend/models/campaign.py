"""Pydantic models for campaigns and campaign metrics."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CampaignCreate(BaseModel):
    """Schema for creating a new campaign."""

    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    campaign_type: str | None = None
    target_demographic: str | None = None
    urgency_level: str | None = None
    source_trend_id: UUID | None = None


class CampaignUpdate(BaseModel):
    """Schema for updating a campaign."""

    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    campaign_type: str | None = None
    target_demographic: str | None = None
    urgency_level: str | None = None
    is_integrated_as_event: bool | None = None
    event_id: UUID | None = None


class CampaignResponse(BaseModel):
    """Full campaign response."""

    id: UUID
    simulation_id: UUID
    title: str
    description: str | None = None
    campaign_type: str | None = None
    target_demographic: str | None = None
    urgency_level: str | None = None
    source_trend_id: UUID | None = None
    is_integrated_as_event: bool = False
    event_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class CampaignMetricResponse(BaseModel):
    """Campaign metric response."""

    id: UUID
    simulation_id: UUID
    campaign_id: UUID
    metric_name: str
    metric_value: float
    metric_metadata: dict | None = None
    measured_at: datetime
