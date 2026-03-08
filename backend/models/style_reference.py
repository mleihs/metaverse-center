"""Pydantic models for style reference image endpoints."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class StyleReferenceUploadResponse(BaseModel):
    """Response after uploading a style reference image."""

    url: str
    scope: Literal["global", "entity"]
    entity_type: Literal["portrait", "building"]
    entity_id: UUID | None = None


class StyleReferenceInfo(BaseModel):
    """Describes a configured style reference."""

    entity_type: Literal["portrait", "building"]
    scope: Literal["global", "entity"]
    reference_image_url: str
    strength: float = Field(default=0.75, ge=0.0, le=1.0)
    entity_id: UUID | None = None
    entity_name: str | None = None
