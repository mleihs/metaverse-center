"""Pydantic models for Lore CRUD operations."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class LoreSectionCreate(BaseModel):
    """Schema for creating a new lore section."""

    chapter: str = Field(min_length=1, max_length=255)
    arcanum: str = Field(min_length=1, max_length=10)
    title: str = Field(min_length=1, max_length=500)
    epigraph: str = ""
    body: str = Field(min_length=1)
    image_slug: str | None = None
    image_caption: str | None = None


class LoreSectionUpdate(BaseModel):
    """Schema for updating a lore section — all fields optional."""

    chapter: str | None = None
    arcanum: str | None = None
    title: str | None = None
    epigraph: str | None = None
    body: str | None = None
    image_slug: str | None = None
    image_caption: str | None = None


class LoreSectionReorder(BaseModel):
    """Schema for bulk reordering lore sections."""

    section_ids: list[UUID]
