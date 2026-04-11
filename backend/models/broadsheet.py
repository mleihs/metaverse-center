"""Pydantic models for the Simulation Broadsheet feature."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, model_validator


class BroadsheetGenerateRequest(BaseModel):
    """Request to compile a new broadsheet edition."""

    period_start: datetime
    period_end: datetime

    @model_validator(mode="after")
    def validate_period(self) -> BroadsheetGenerateRequest:
        if self.period_start >= self.period_end:
            msg = "period_start must be before period_end."
            raise ValueError(msg)
        return self


class BroadsheetArticle(BaseModel):
    """A single article within a broadsheet edition."""

    source_type: str  # event | resonance | activity | gazette
    source_id: str | None = None
    priority: int = 0
    layout_hint: str = "column"  # hero | column | sidebar | ticker

    headline: str
    headline_de: str | None = None
    content: str = ""
    content_de: str | None = None

    image_url: str | None = None
    agent_name: str | None = None
    impact_level: int | None = None
    tags: list[str] | None = None


class BroadsheetResponse(BaseModel):
    """Full broadsheet edition response."""

    id: UUID
    simulation_id: UUID
    edition_number: int
    period_start: datetime
    period_end: datetime
    title: str
    title_de: str | None = None
    subtitle: str | None = None
    subtitle_de: str | None = None
    articles: list[dict[str, Any]]
    health_snapshot: dict[str, Any] | None = None
    mood_snapshot: dict[str, Any] | None = None
    statistics: dict[str, Any] | None = None
    gazette_wire: list[dict[str, Any]] | None = None
    editorial_voice: str = "neutral"
    model_used: str | None = None
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
