"""Pydantic models for DRIFT travel (P0a vertical slice).

Request bodies + typed *Response wrappers for the run-lifecycle endpoints and the
shared Driftkarte read. The run responses mirror the travel_runs row shape that the
SECURITY DEFINER RPCs return via to_jsonb(run) (migration 246).
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

# ── Request bodies ────────────────────────────────────────────────────────────


class TravelRunOpenRequest(BaseModel):
    """Open (or resume) a run anchored to the traveler's home simulation."""

    anchor_simulation_id: UUID


class HavarieResolveRequest(BaseModel):
    """The traveller's decision at the failure floor (fn_travel_havarie_resolve, 265).

    `jettison_cargo_ids` is required by (and only meaningful for) `notabwurf` — the RPC
    validates both the choice against the options the Havarie actually offered and each id
    against the run's own manifest, so an empty or foreign list is refused there, not here.
    """

    run_version: int = Field(ge=0)
    choice: Literal["notabwurf", "notruf", "zerfaserung", "ueberziehen", "rueckruf"]
    jettison_cargo_ids: list[UUID] | None = None


class ClearanceExamRequest(BaseModel):
    """Sit the Bureau clearance exam for a rank (fn_clearance_exam, migration 264)."""

    rank: str


class TravelMoveRequest(BaseModel):
    """A single Drift move to an adjacent node. run_version is the optimistic lock."""

    run_version: int = Field(ge=0)
    to_node_id: UUID


class TravelRunVersionRequest(BaseModel):
    """Bare run_version CAS payload (complete / abandon)."""

    run_version: int = Field(ge=0)


# ── Responses ─────────────────────────────────────────────────────────────────


class EarningsBlock(BaseModel):
    """What an act of the run PAID (fn_drift_award, migration 264).

    The same shape for every payer (a delivered Depesche, an Entladung), so the HUD's
    count-up ceremony has one contract to read. `vp_total` is a lifetime figure by
    construction — VP is a rank score and is never spent; `siegel_balance` is the
    spendable purse (it falls again from W3's requisition).
    """

    source: str
    siegel_earned: int
    vp_earned: int
    siegel_balance: int
    vp_total: int
    clearance_rank: str


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
    # Lifted out of the checkpoint (see below) — never sent by the RPC as a column.
    earnings: EarningsBlock | None = None

    @model_validator(mode="after")
    def _lift_earnings(self) -> "TravelRunResponse":
        """Surface checkpoint.earnings as a typed field.

        fn_travel_complete RETURNS to_jsonb(run), so its payout can only travel inside the
        checkpoint jsonb. Lifting it here means the HUD reads one typed field instead of
        digging through an untyped dict, and every consumer of a run row (complete, a
        refetch, a second device resuming) gets the receipt the same way. Absent while the
        Fun-Kern gate is closed — the field is simply None, which is exactly P0.
        """
        block = self.checkpoint.get("earnings") if isinstance(self.checkpoint, dict) else None
        if self.earnings is None and isinstance(block, dict):
            self.earnings = EarningsBlock(**block)
        return self


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


class DriftPublicState(BaseModel):
    """Public phase-gate snapshot returned by GET /api/v1/public/drift/state.

    A narrow projection of the drift_* platform_settings gates so an anonymous
    landing/spectator can tell whether DRIFT is live without a JWT (alpha-state DTO
    pattern). P0 surfaces only the master gate; further phase flags are an additive
    extension on this model, never a new endpoint.
    """

    enabled: bool


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
    """Summary of a chart regeneration (ChartGeneratorService → fn_apply_drift_chart)."""

    version: int
    worlds: int
    nodes: int
    edges: int


class DriftHonorResponse(BaseModel):
    """An Erstvermessung claim on the shared Driftkarte (chart_honors, C4). Keyed by
    stable_key so it survives chart regeneration; the chart overlays a seal on claimed
    nodes. is_self marks the caller's own claims (a brighter seal). Holder identity stays
    anonymous in P0 — public callsign surfacing is P1b (§19, leaderboards)."""

    node_stable_key: str
    kind: str
    claimed_at: datetime
    is_self: bool = False


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


# ── Quests & cargo (P0c deliver Depesche) ───────────────────────────────────────


class TravelQuestAcceptRequest(BaseModel):
    """Accept a deliver Depesche on the active run. run_version is the CAS token; the
    target is the world the Depesche is bound for (must have a broadcast edge)."""

    run_id: UUID
    run_version: int = Field(ge=0)
    template_key: str
    target_simulation_id: UUID


class TravelQuestAdvanceRequest(BaseModel):
    """Deliver a Depesche at the target world's broadcast edge (run_version CAS)."""

    run_id: UUID
    run_version: int = Field(ge=0)


class CargoResponse(BaseModel):
    """A travel_cargo manifest item — the one-of-a-kind payload carried on a run."""

    id: UUID
    family: str
    vector: str
    twists: list = Field(default_factory=list)
    quest_instance_id: UUID | None = None
    run_id: UUID | None = None


class QuestOfferResponse(BaseModel):
    """An offered deliver Depesche the traveler can accept at a world edge (P0c: the
    deliver template bound to each reachable foreign world)."""

    template_key: str
    family: str
    title: str
    brief: str
    cargo_family: str
    cargo_vector: str
    target_simulation_id: UUID
    target_simulation_name: str


class QuestInstanceResponse(BaseModel):
    """An accepted quest instance — the Depesche the traveler carries. Parsed from the
    raw travel_quest_instances row (extra columns ignored); title + target world name
    are enrichments the quest-state read adds for the HUD."""

    id: UUID
    template_key: str
    simulation_id: UUID
    status: str
    slots: dict = Field(default_factory=dict)
    title: str | None = None
    target_simulation_name: str | None = None


class QuestEffectsResponse(BaseModel):
    """The hospitality-gate outcome for a delivery: which effects fired vs were filtered
    (each skipped entry carries a reason, e.g. hospitality_nur_echos)."""

    already_applied: bool = False
    applied: list[dict] = Field(default_factory=list)
    skipped: list[dict] = Field(default_factory=list)


class QuestStateResponse(BaseModel):
    """The HUD's quest snapshot: what you can accept here, the Depesche you carry, and
    your manifest. One round-trip for the whole quest surface."""

    offers: list[QuestOfferResponse]
    active: QuestInstanceResponse | None = None
    cargo: list[CargoResponse]


class QuestAcceptResponse(BaseModel):
    """fn_quest_accept result: the version-bumped run + the new instance + bound cargo."""

    run: TravelRunResponse
    instance: QuestInstanceResponse
    cargo: CargoResponse


class EffectCard(BaseModel):
    """ONE thing a delivery did to the world — or was stopped from doing.

    P0 collapsed the hospitality gate's verdict into a number (`DriftView.ts:477` counted
    the applied list and said "3 Wirkungen"), so a traveller could never see WHAT landed,
    WHERE, or why a world refused them. The card is the honest unit: the kind of effect,
    the named target, a link to the receipt in that world, and — for a filtered effect —
    the actual reason (`hospitality_nur_echos`), which the HUD renders redacted rather
    than hiding.

    `status='filtered'` is not an error. A world that only admits echoes is exercising its
    hospitality setting; showing that is the point (the Bureau's world is one that answers).
    """

    kind: str  # emit_fragment | emit_echo | inject_agent_memory | spawn_event | …
    status: Literal["applied", "filtered"]
    target_kind: Literal["self", "simulation", "agent", "none"]
    target_label: str
    simulation_id: UUID | None = None
    simulation_slug: str | None = None
    agent_id: UUID | None = None
    # The receipt link needs the SLUG, not the id: the agent route is
    # /simulations/{sim}/agents/{entitySlug} and resolves by slug (AgentService.get_by_slug),
    # so a UUID in that position lands on the agents list instead of the Träger who now
    # remembers the traveller. Both are carried: the id identifies, the slug addresses.
    agent_slug: str | None = None
    event_id: UUID | None = None
    hospitality: str | None = None
    reason: str | None = None  # only on filtered cards (the gate's own skip reason)


class QuestDeliverResponse(BaseModel):
    """fn_quest_advance result: the version-bumped run + the completed instance + the
    hospitality-gate effect summary, the honest per-effect cards, and what it paid."""

    run: TravelRunResponse
    instance: QuestInstanceResponse
    effects: QuestEffectsResponse
    cards: list[EffectCard] = Field(default_factory=list)
    earnings: EarningsBlock | None = None


class DriftProfileResponse(BaseModel):
    """The traveller's Bureau account — the HUD's Konto-Strip (M4/M6).

    Everything the ledger strip needs in one read: the two currencies, the rank and how far
    the next one is, and the two lifetime scars/marks. `exam_ready` is the whole promotion
    predicate resolved server-side (VP threshold AND Siegel fee AND not already held), so
    the button is never offered on a click that would only 400.
    """

    siegel: int
    vp: int
    clearance_rank: str
    bandwidth_class: int
    zerfaserung_count: int
    vermessung_lodged: int
    unlocked_vectors: list[str] = Field(default_factory=list)
    next_rank: str | None = None
    next_rank_vp: int | None = None
    next_rank_fee: int | None = None
    next_rank_progress: float = 0.0  # 0.0–1.0 for the rank bar
    exam_ready: bool = False


class ClearanceExamResponse(BaseModel):
    """fn_clearance_exam result: the new rank + what it cost."""

    clearance_rank: str
    fee_paid: int
    siegel_balance: int
    vp_total: int
