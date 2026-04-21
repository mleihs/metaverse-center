"""Pydantic models for the Resonance Journal.

Covers all eight journal tables plus request / query-filter shapes.
Fragment is the only consumer in P0; the others ship here as scaffolding
so P1-P4 routers can import existing models instead of redefining them.
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
