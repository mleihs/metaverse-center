"""Pydantic models for the Resonance Journal.

Covers all eight journal tables plus request / query-filter shapes.
Fragment (P0), Constellation + ResonancePair + CrystallizeResult (P2-
P3), Attunement (P3) are live; Palimpsest + ResonanceProfile ship
here as scaffolding for P4.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# ── Fragment ────────────────────────────────────────────────────────────


class FragmentResponse(BaseModel):
    """A journal fragment — atomic entry from any source system."""

    id: UUID
    user_id: UUID
    simulation_id: UUID | None = None
    fragment_type: str  # imprint | signature | echo | impression | mark | tremor
    source_type: str  # dungeon | epoch | simulation | bond | achievement | bleed
    source_id: UUID | None = None
    content_de: str
    content_en: str
    thematic_tags: list[str] = Field(default_factory=list)
    rarity: str  # common | uncommon | rare | singular
    created_at: datetime


# ── Constellation (scaffolding for P2) ───────────────────────────────────


class ConstellationFragmentPlacement(BaseModel):
    """A fragment placed onto a constellation canvas with coordinates."""

    fragment_id: UUID
    position_x: int = 0
    position_y: int = 0
    placed_at: datetime | None = None


class ResonancePair(BaseModel):
    """A detected pair-level resonance between two fragments.

    Emitted by the backend detector for every pair that matches a rule,
    not just the aggregate winner. The frontend uses the full list to
    draw connection lines live during drafting (Principle 1 —
    proximity encodes resonance before lines make it explicit). P3
    addition; absent from P2 responses.

    Order of ``fragment_a_id``/``fragment_b_id`` is deterministic by
    placed_at ascending — the caller does NOT need to canonicalise
    pairs to avoid duplicate rendering. Each unordered pair appears
    exactly once in the list.
    """

    fragment_a_id: UUID
    fragment_b_id: UUID
    resonance_type: str  # archetype | emotional | temporal | contradiction
    evidence_tags: list[str] = Field(default_factory=list)


class ConstellationResponse(BaseModel):
    """A player-composed constellation."""

    id: UUID
    user_id: UUID
    name_de: str | None = None
    name_en: str | None = None
    status: str  # drafting | crystallized | archived
    insight_de: str | None = None
    insight_en: str | None = None
    resonance_type: str | None = None  # archetype | emotional | temporal | contradiction
    attunement_id: UUID | None = None
    created_at: datetime
    crystallized_at: datetime | None = None
    archived_at: datetime | None = None
    updated_at: datetime
    fragments: list[ConstellationFragmentPlacement] = Field(default_factory=list)
    pair_matches: list[ResonancePair] = Field(default_factory=list)


# ── Attunement (catalog + unlock) ────────────────────────────────────────


class AttunementResponse(BaseModel):
    """A journal attunement entry (catalog shape)."""

    id: UUID
    slug: str
    name_de: str
    name_en: str
    description_de: str
    description_en: str
    system_hook: str  # dungeon_option | epoch_option | simulation_option
    effect: dict
    required_resonance: dict = Field(default_factory=dict)
    required_resonance_type: str | None = None
    enabled: bool = True


class UserAttunementResponse(BaseModel):
    """A user's unlock record for an attunement."""

    attunement_id: UUID
    attunement_slug: str
    constellation_id: UUID | None = None
    unlocked_at: datetime


class AttunementCatalogEntry(BaseModel):
    """Catalog attunement enriched with the caller's unlock status.

    One-shot view model for ``GET /journal/attunements`` so the client
    can render the locked/unlocked panel without a second round trip.
    Writes flow through service_role; the client never mutates this
    shape directly.
    """

    id: UUID
    slug: str
    name_de: str
    name_en: str
    description_de: str
    description_en: str
    system_hook: str  # dungeon_option | epoch_option | simulation_option
    effect: dict
    required_resonance_type: str | None = None
    enabled: bool = True
    unlocked: bool = False
    unlocked_at: datetime | None = None
    constellation_id: UUID | None = None


class CrystallizeResult(BaseModel):
    """Return shape for POST /constellations/{id}/crystallize.

    Separates the persistent constellation record from the transient
    unlock event so the frontend can trigger a one-shot ceremony when
    a new attunement lands, while other endpoints that return a
    constellation don't have to carry a nullable ``newly_unlocked``
    field that's always null. ``newly_unlocked_attunement`` is the
    catalog shape at unlock time — the constellation's own
    ``attunement_id`` FK is the authoritative pointer; this field only
    signals "this is the moment".
    """

    constellation: ConstellationResponse
    newly_unlocked_attunement: AttunementResponse | None = None


# ── Palimpsest (P4) ──────────────────────────────────────────────────────


class PalimpsestResponse(BaseModel):
    """A deep literary reflection generated every 30 fragments (AD-4)."""

    id: UUID
    user_id: UUID
    content_de: str
    content_en: str
    fragment_count_at_generation: int
    resonance_snapshot: dict = Field(default_factory=dict)
    created_at: datetime


# ── Resonance Profile (hidden 8D fingerprint, admin-only) ────────────────


class ResonanceProfileResponse(BaseModel):
    """Hidden 8-dimensional player fingerprint. Admin-only visibility."""

    user_id: UUID
    umbra: float = 0.0
    struktur: float = 0.0
    nexus: float = 0.0
    aufloesung: float = 0.0
    prometheus_dim: float = 0.0
    flut: float = 0.0
    erwachen: float = 0.0
    umsturz: float = 0.0
    fragment_count: int = 0
    updated_at: datetime
