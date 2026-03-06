"""Pydantic models for The Chronicle feature."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ChronicleGenerateRequest(BaseModel):
    """Request to generate a new chronicle edition."""

    period_start: datetime
    period_end: datetime
    epoch_id: UUID | None = None
    locale: str = "en"


class ChronicleResponse(BaseModel):
    """Full chronicle edition response."""

    id: UUID
    simulation_id: UUID
    epoch_id: UUID | None = None
    edition_number: int
    period_start: datetime
    period_end: datetime
    title: str
    headline: str | None = None
    content: str
    title_de: str | None = None
    headline_de: str | None = None
    content_de: str | None = None
    model_used: str | None = None
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
