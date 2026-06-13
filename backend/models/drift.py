"""Pydantic models for DRIFT travel (P0a vertical slice).

Request bodies + typed *Response wrappers for the run-lifecycle endpoints and the
shared Driftkarte read. The run responses mirror the travel_runs row shape that the
SECURITY DEFINER RPCs return via to_jsonb(run) (migration 246).
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# ── Request bodies ────────────────────────────────────────────────────────────


class TravelRunOpenRequest(BaseModel):
    """Open (or resume) a run anchored to the traveler's home simulation."""

    anchor_simulation_id: UUID


class TravelMoveRequest(BaseModel):
    """A single Drift move to an adjacent node. run_version is the optimistic lock."""

    run_version: int = Field(ge=0)
    to_node_id: UUID


class TravelRunVersionRequest(BaseModel):
    """Bare run_version CAS payload (complete / abandon)."""

    run_version: int = Field(ge=0)


# ── Responses ─────────────────────────────────────────────────────────────────


class TravelRunResponse(BaseModel):
    """A travel_runs row as returned by the run-lifecycle RPCs (to_jsonb(run))."""

    id: UUID
    user_id: UUID
    status: str
    run_version: int
    kohaerenz: int
    bandbreite: int
    dissonanz: int
    frequency: str
    position_node_id: UUID | None = None
    scale: str
    begehung_simulation_id: UUID | None = None
    begehung_zone_id: UUID | None = None
    window_remaining: int
    takt_count: int
    checkpoint: dict
    event_seq: int
    chart_version: int | None = None
    opened_at: datetime
    closed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class DriftChartNodeResponse(BaseModel):
    """A node on the shared Driftkarte (public topology, §8.1)."""

    id: UUID
    stable_key: str
    node_type: str
    simulation_id: UUID | None = None
    # The world's display name, for broadcast_rand homes (LEFT JOIN simulations.name);
    # None for interstitials/core. Drives the on-board node labels.
    simulation_name: str | None = None
    x: float
    y: float
    frequency_mask: int
    distance_band: str
    payload: dict = Field(default_factory=dict)


class DriftChartEdgeResponse(BaseModel):
    """A weighted, per-vector-permeable edge between two nodes."""

    id: UUID
    from_node: UUID
    to_node: UUID
    weight: int
    permeability: dict = Field(default_factory=dict)
    corridor: bool


class DriftChartResponse(BaseModel):
    """The active chart version's topology (nodes + edges)."""

    chart_version: int
    nodes: list[DriftChartNodeResponse]
    edges: list[DriftChartEdgeResponse]


class DriftTuningResponse(BaseModel):
    """HUD-relevant Zahlenwerk scalars (drift_tuning, §2) for client gauge scaling.

    The HUD reads these instead of hardcoding bar maxima — the single source of truth
    is the drift_tuning table, so a re-tune reshapes the gauges without a frontend
    change. bandwidth_class_bb_max is keyed by bandwidth class ("1".."4"); P0 = class 1.
    """

    window_base: int
    dz_cap: int
    bandwidth_class_bb_max: dict[str, int]


class ChartGenerationResponse(BaseModel):
    """Summary of an fn_generate_drift_chart run (admin regenerate)."""

    version: int
    worlds: int
    nodes: int
    edges: int


# ── Dock experience (arriving at a broadcast edge) ──────────────────────────────


class DockLoreResponse(BaseModel):
    """A lore chapter's voice — the world speaking (simulation_lore, §6.4 dressing)."""

    title: str | None = None
    epigraph: str | None = None


class DockAgentResponse(BaseModel):
    """A Träger of the world (agents) — the people you meet at the broadcast edge."""

    id: UUID
    name: str
    primary_profession: str | None = None
    portrait_image_url: str | None = None


class DriftDockResponse(BaseModel):
    """A world's identity surfaced on docking at its broadcast edge: name + blurb +
    a lore epigraph (its voice) + a few agents (its people). All public sim data."""

    simulation_id: UUID
    name: str
    description: str | None = None
    theme: str | None = None
    lore: list[DockLoreResponse]
    agents: list[DockAgentResponse]
