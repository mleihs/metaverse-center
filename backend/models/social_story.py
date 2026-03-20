"""Pydantic models for social stories (resonance → Instagram Story pipeline)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# ── Constants ────────────────────────────────────────────────────────────────

STORY_TYPES = ("detection", "classification", "impact", "advisory", "subsiding")

STORY_STATUSES = ("pending", "composing", "ready", "publishing", "published", "failed", "skipped")

# Archetype visual language — color accents for Story templates
ARCHETYPE_COLORS: dict[str, str] = {
    "The Tower": "#FF3333",           # crimson
    "The Shadow": "#7744AA",          # violet
    "The Devouring Mother": "#33AA66",  # toxic green
    "The Deluge": "#2266CC",          # deep blue
    "The Overthrow": "#FF8800",       # amber
    "The Prometheus": "#FFCC00",      # gold
    "The Awakening": "#CC88FF",       # lavender
    "The Entropy": "#666666",         # ash
}

# Operative alignment map — which types benefit/suffer per archetype
ARCHETYPE_OPERATIVE_ALIGNMENT: dict[str, dict[str, list[str]]] = {
    "The Tower": {"aligned": ["Saboteur", "Infiltrator"], "opposed": []},
    "The Shadow": {"aligned": ["Spy", "Assassin"], "opposed": ["Propagandist"]},
    "The Devouring Mother": {"aligned": ["Spy", "Propagandist"], "opposed": ["Infiltrator"]},
    "The Deluge": {"aligned": ["Saboteur", "Infiltrator"], "opposed": ["Spy"]},
    "The Overthrow": {"aligned": ["Propagandist", "Infiltrator"], "opposed": []},
    "The Prometheus": {"aligned": ["Spy", "Infiltrator"], "opposed": ["Saboteur"]},
    "The Awakening": {"aligned": ["Propagandist", "Spy"], "opposed": ["Assassin"]},
    "The Entropy": {"aligned": ["Saboteur", "Assassin"], "opposed": ["Infiltrator"]},
}


# ── Response Models ──────────────────────────────────────────────────────────


class SocialStoryResponse(BaseModel):
    """Single social story record."""

    id: UUID
    resonance_id: UUID | None = None
    simulation_id: UUID | None = None
    story_type: str
    sequence_index: int = 0
    image_url: str | None = None
    caption: str | None = None
    narrative_closing: str | None = None
    ig_story_id: str | None = None
    ig_posted_at: datetime | None = None
    status: str
    scheduled_at: datetime
    published_at: datetime | None = None
    failure_reason: str | None = None
    retry_count: int = 0
    archetype: str | None = None
    magnitude: float | None = None
    effective_magnitude: float | None = None
    created_at: datetime
    updated_at: datetime


class SocialStorySequenceResponse(BaseModel):
    """A full Story sequence for a resonance."""

    resonance_id: UUID
    archetype: str
    magnitude: float
    stories: list[SocialStoryResponse] = Field(default_factory=list)
    total_stories: int = 0
    published_count: int = 0
    status_summary: str = ""  # e.g. "3/5 published"
