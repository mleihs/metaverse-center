"""Pydantic models for Substrate Scanner API."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ScanCandidateResponse(BaseModel):
    """Response model for a scan candidate."""

    id: UUID
    source_category: str
    title: str
    description: str | None = None
    bureau_dispatch: str | None = None
    article_url: str | None = None
    article_platform: str | None = None
    article_raw_data: dict | None = None
    magnitude: float
    classification_reason: str | None = None
    source_adapter: str
    is_structured: bool
    status: str
    resonance_id: UUID | None = None
    created_at: datetime
    reviewed_at: datetime | None = None
    reviewed_by_id: UUID | None = None


class ApproveCandidateRequest(BaseModel):
    """Request to approve a candidate and create a resonance."""

    delay_hours: int = Field(default=4, ge=1, le=72)


class UpdateCandidateRequest(BaseModel):
    """Request to edit a candidate before approving."""

    title: str | None = Field(default=None, min_length=1, max_length=500)
    magnitude: float | None = Field(default=None, ge=0.1, le=1.0)
    source_category: str | None = None
    bureau_dispatch: str | None = None
    archetype_override: str | None = None
    signature_override: str | None = None


class TriggerScanRequest(BaseModel):
    """Request to manually trigger a scan cycle."""

    adapter_names: list[str] | None = None


class AdapterStatusResponse(BaseModel):
    """Status info for a single source adapter."""

    name: str
    display_name: str
    categories: list[str]
    is_structured: bool
    requires_api_key: bool
    api_key_setting: str | None = None
    default_interval: int
    enabled: bool = False
    available: bool = False


class ScanMetricsResponse(BaseModel):
    """Scanner dashboard metrics."""

    scanned_today: int = 0
    classified_today: int = 0
    resonances_today: int = 0
    pending_candidates: int = 0
    last_scan: str | None = None


class DashboardResponse(BaseModel):
    """Full scanner dashboard data."""

    config: dict
    adapters: list[dict]
    metrics: ScanMetricsResponse
