"""Pydantic models for substrate resonances."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# ── Constants ────────────────────────────────────────────────────────────────

RESONANCE_STATUSES = ("detected", "impacting", "subsiding", "archived")

RESONANCE_IMPACT_STATUSES = ("pending", "generating", "completed", "partial", "skipped", "failed")

SOURCE_CATEGORIES = (
    "economic_crisis",
    "military_conflict",
    "pandemic",
    "natural_disaster",
    "political_upheaval",
    "tech_breakthrough",
    "cultural_shift",
    "environmental_disaster",
)

RESONANCE_SIGNATURES = (
    "economic_tremor",
    "conflict_wave",
    "biological_tide",
    "elemental_surge",
    "authority_fracture",
    "innovation_spark",
    "consciousness_drift",
    "decay_bloom",
)

ARCHETYPES = (
    "The Tower",
    "The Shadow",
    "The Devouring Mother",
    "The Deluge",
    "The Overthrow",
    "The Prometheus",
    "The Awakening",
    "The Entropy",
)

# Maps source_category → (resonance_signature, archetype)
CATEGORY_ARCHETYPE_MAP: dict[str, tuple[str, str]] = {
    "economic_crisis":        ("economic_tremor",     "The Tower"),
    "military_conflict":      ("conflict_wave",       "The Shadow"),
    "pandemic":               ("biological_tide",     "The Devouring Mother"),
    "natural_disaster":       ("elemental_surge",     "The Deluge"),
    "political_upheaval":     ("authority_fracture",  "The Overthrow"),
    "tech_breakthrough":      ("innovation_spark",    "The Prometheus"),
    "cultural_shift":         ("consciousness_drift", "The Awakening"),
    "environmental_disaster": ("decay_bloom",         "The Entropy"),
}

# Reverse map: archetype → (signature, source_category)
ARCHETYPE_REVERSE_MAP: dict[str, tuple[str, str]] = {
    v[1]: (v[0], k) for k, v in CATEGORY_ARCHETYPE_MAP.items()
}

# Default event types spawned per signature (primary = weight 3)
DEFAULT_EVENT_TYPE_MAP: dict[str, list[str]] = {
    "economic_tremor":     ["trade", "crisis", "social"],
    "conflict_wave":       ["military", "intrigue", "social"],
    "biological_tide":     ["social", "crisis", "eldritch"],
    "elemental_surge":     ["crisis", "nautical", "discovery"],
    "authority_fracture":  ["intrigue", "military", "social"],
    "innovation_spark":    ["discovery", "trade", "intrigue"],
    "consciousness_drift": ["social", "religious", "discovery"],
    "decay_bloom":         ["crisis", "eldritch", "social"],
}

# Extended event type pool per signature: secondary types (weight 1)
# Used for weighted random selection to add variance
SECONDARY_EVENT_TYPE_MAP: dict[str, list[str]] = {
    "economic_tremor":     ["intrigue", "discovery"],
    "conflict_wave":       ["crisis", "eldritch"],
    "biological_tide":     ["discovery", "religious"],
    "elemental_surge":     ["social", "trade"],
    "authority_fracture":  ["crisis", "religious"],
    "innovation_spark":    ["social", "military"],
    "consciousness_drift": ["eldritch", "intrigue"],
    "decay_bloom":         ["trade", "nautical"],
}

# Archetype descriptions for AI prompts
ARCHETYPE_DESCRIPTIONS: dict[str, str] = {
    "The Tower": "Structures that seemed permanent reveal themselves as temporary. Value dissolves.",
    "The Shadow": "The part of reality that knows how to hurt rises to the surface.",
    "The Devouring Mother": "That which sustains life turns against it. The organic remembers hunger.",
    "The Deluge": "The world reminds its inhabitants that they are guests, not owners.",
    "The Overthrow": "Power changes hands. The old order doesn't die — it metamorphoses.",
    "The Prometheus": "Fire stolen from the gods. Every gift is also a weapon.",
    "The Awakening": "The collective mind turns over in its sleep. Something new is dreaming.",
    "The Entropy": "The slow unwinding accelerates. Decay is not destruction — it is transformation's dark twin.",
}


# ── Create / Update / Response Schemas ───────────────────────────────────────


class ResonanceCreate(BaseModel):
    """Schema for creating a substrate resonance."""

    source_category: str
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    bureau_dispatch: str | None = None
    real_world_source: dict | None = None
    magnitude: float = Field(default=0.5, ge=0.1, le=1.0)
    impacts_at: datetime
    # Auto-derived from source_category if not provided:
    resonance_signature: str | None = None
    archetype: str | None = None
    affected_event_types: list[str] = Field(default_factory=list)


class ResonanceUpdate(BaseModel):
    """Schema for updating a substrate resonance."""

    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    bureau_dispatch: str | None = None
    magnitude: float | None = Field(default=None, ge=0.1, le=1.0)
    status: str | None = None
    impacts_at: datetime | None = None
    subsides_at: datetime | None = None


class ResonanceResponse(BaseModel):
    """Full resonance response."""

    id: UUID
    source_category: str
    resonance_signature: str
    archetype: str
    title: str
    description: str | None = None
    bureau_dispatch: str | None = None
    real_world_source: dict | None = None
    magnitude: float
    magnitude_class: str | None = None
    affected_event_types: list[str] = Field(default_factory=list)
    status: str
    detected_at: datetime
    impacts_at: datetime
    subsides_at: datetime | None = None
    created_by_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    impact_count: int | None = None


class ResonanceImpactResponse(BaseModel):
    """Per-simulation resonance impact response."""

    id: UUID
    resonance_id: UUID
    simulation_id: UUID
    susceptibility: float
    effective_magnitude: float
    status: str
    failure_reason: str | None = None
    simulation_name: str | None = None
    simulation_slug: str | None = None
    magnitude_class: str | None = None
    spawned_event_ids: list[UUID] = Field(default_factory=list)
    narrative_context: str | None = None
    created_at: datetime


class ProcessImpactRequest(BaseModel):
    """Request to process resonance impact across simulations."""

    simulation_ids: list[UUID] | None = None
    generate_narratives: bool = True
    generate_reactions: bool = True
    locale: str = "de"
