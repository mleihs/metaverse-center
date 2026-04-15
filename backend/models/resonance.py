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

# Secondary event types per signature (weight 1 in weighted selection).
# Primary types come from Postgres fn_get_resonance_event_types() (migration 076)
# and are configurable per simulation via resonance_event_type_map setting.
# These secondary types add variance — lower probability but thematic fit.
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

# Archetype descriptions — used on Detection story cards (italic, 2-3 lines)
# and as AI prompt context. Each description mirrors its archetype's literary grammar.
ARCHETYPE_DESCRIPTIONS: dict[str, str] = {
    "The Tower": (
        "The foundation was a consensus. The consensus has left the building."
    ),
    "The Shadow": (
        "Something that was practicing stillness decides to stop practicing."
    ),
    "The Devouring Mother": (
        "The warmth is perfect. One stops questioning perfect warmth. This is the mechanism."
    ),
    "The Deluge": (
        "The water table has a longer memory than the city charter. "
        "It is waiting for the lease to expire."
    ),
    "The Overthrow": (
        "The throne is occupied. It was occupied yesterday. "
        "These are not the same sentence."
    ),
    "The Prometheus": (
        "The instrument reads perfectly. What it measures has not been named. "
        "This is either progress or evidence."
    ),
    "The Awakening": (
        "A thought arrives without being sent for. "
        "It has the weight of memory and the texture of premonition."
    ),
    "The Entropy": (
        "The room still contains distinctions. Walls, floor, ceiling. "
        "The categories are losing interest."
    ),
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
