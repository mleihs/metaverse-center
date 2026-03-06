"""Pydantic models for the Translation Service."""

from __future__ import annotations

from pydantic import BaseModel


class TranslationContext(BaseModel):
    """Context for translation requests to improve quality."""

    simulation_name: str
    simulation_theme: str
    entity_type: str  # "agent", "building", "zone", "street", "simulation", "lore"
    entity_name: str | None = None
    additional_context: str | None = None


class TranslationResult(BaseModel):
    """Result of translating one or more fields."""

    translations: dict[str, str]
