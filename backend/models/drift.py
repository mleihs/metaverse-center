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


class SignalResolveRequest(BaseModel):
    """The traveller's answer to a pending Störung/Begegnung (M1, migration 267).

    `option_key` is validated against the TEMPLATE server-side, not against the copy in
    the checkpoint — the panel's copy is display, never law.
    """

    run_version: int = Field(ge=0)
    option_key: str = Field(min_length=1, max_length=64)


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


class SignalProse(BaseModel):
    """The scene text of a drawn signal, with {sim} already resolved to a real world."""

    title_de: str
    title_en: str
    body_de: str
    body_en: str


class SignalCheckSpec(BaseModel):
    """A vector check on an option. The DIFFICULTY is shown to nobody.

    The panel says "riskant" and names the vector; it never numbers the odds (concept R4 —
    the traveller learns the shape of a risk by living it, not by reading it off a tooltip).
    The presence of this block is what the HUD needs: a check EXISTS, and it tests THIS vector.

    `difficulty` is therefore parsed (the template has it) and then DROPPED (`exclude=True`).
    It used to be declared here and shipped — the docstring above said the number was shown to
    nobody while the response carried it in plain sight, and the raw `checkpoint` blob next to
    it carried the deltas of every branch as well. W2.6/B closed both: the checkpoint is
    input-only now, and the number stops here.
    """

    vector: str
    difficulty: int = Field(0, exclude=True)


class SignalCost(BaseModel):
    """What an option costs up front — paid whatever the roll says.

    The HUD promises this on the chip, and a promise that only holds on success is a lie.
    """

    kh: int | None = None
    bb: int | None = None
    takt: int | None = None


class SignalDeltas(BaseModel):
    """The closed outcome vocabulary (migration 266's schema), as the HUD renders it."""

    kh: int | None = None
    bb: int | None = None
    dz: int | None = None
    takt: int | None = None
    siegel: int | None = None
    siegel_balance: int | None = None
    cargo_grant: dict | None = None
    rumor_reveal: dict | None = None
    marker_add: str | None = None


class SignalOptionSpec(BaseModel):
    """One answer the traveller may give. Only PAYABLE options ever reach the panel."""

    key: str
    label_de: str
    label_en: str
    cost: SignalCost | None = None
    check: SignalCheckSpec | None = None


class PendingSignal(BaseModel):
    """The scene the run is standing in and cannot walk away from (M1).

    While this is set, fn_travel_move raises SIGNAL_PENDING — a Störung is a decision,
    not a notification.
    """

    template_key: str
    signal_class: str
    takt: int | None = None
    prose: SignalProse | None = None
    options: list[SignalOptionSpec] = Field(default_factory=list)


class SignalOutcome(BaseModel):
    """The branch that actually happened, in prose plus what it wrote."""

    text_de: str | None = None
    text_en: str | None = None
    deltas: SignalDeltas | None = None


class ResolvedSignal(BaseModel):
    """What the answer did — the result state of the panel."""

    template_key: str
    signal_class: str
    option_key: str
    success: bool
    outcome: SignalOutcome | None = None
    applied: SignalDeltas | None = None


class SondierungReveal(BaseModel):
    """The reveal of ONE dig (checkpoint.last_sondierung, migration 268).

    `stack` is the whole marker stack at that node AFTER this dig — the traveller counts it
    themselves. Nobody is ever shown a percentage (R4: the odds are never numbered, the
    evidence always is).
    """

    node_id: UUID
    dig: int
    marker: str
    stack: list[str] = Field(default_factory=list)
    yield_: int = Field(0, alias="yield")
    bust: bool = False
    forfeited: int = 0

    model_config = {"populate_by_name": True}


class BankReceipt(BaseModel):
    """The Funkboje's receipt (checkpoint.last_bank): what went in, what came ashore."""

    loose: int
    safe: int
    rate: float
    haul_safe: int


class HavarieBlock(BaseModel):
    """The wreck the run is standing in (checkpoint.havarie, migration 265).

    `options` is what the SERVER offered — the client never invents one, and an option that is
    not on this list is refused (INVALID_CHOICE). `catalogue` carries the tuning numbers so the
    panel can STATE what each choice costs instead of hardcoding it.
    """

    cause: str
    options: list[str] = Field(default_factory=list)
    cargo_aboard: int = 0
    haul_at_risk: int = 0
    catalogue: dict = Field(default_factory=dict)
    expires_at: datetime | None = None


class ClosingReceipt(BaseModel):
    """How the run ENDED, and what it was worth (checkpoint.closing, W2.6).

    Five endings write this one block through `drift_closing_payload()` — entladung, rueckruf,
    zerfaserung, rueckzug, kollaps — so the Bureau debriefing has a single contract to read.
    Before the consolidation each closing path hand-built its own flat set of checkpoint keys
    for the same facts, which is how four copies of a contract drift apart.

    `haul_transmitted` is the Fun-Kern-only field: with the gate shut the receipt carries no
    Fun-Kern fact (it reads 0). The reserve is still PAID in that case — money brought ashore
    under an open gate is not rollback residue — and `earnings` says so.
    """

    reason: str  # entladung | rueckruf | zerfaserung | rueckzug | kollaps
    cause: str | None = None  # kohaerenz | window — why it ended, when it ended badly
    detail: str | None = None  # choice | ttl_expired | gate_closed
    haul_banked: int = 0
    haul_lost: int = 0
    haul_transmitted: int = 0
    haul_before: int | None = None  # the loose haul BEFORE a recall multiplier
    haul_mult: float | None = None
    surveys_delivered: int = 0
    honors_won: int = 0
    honor_keys: list[str] = Field(default_factory=list)
    scattered: dict | None = None


class TravelLogEntryResponse(BaseModel):
    """One line of the traveller's logbook (travel_log_entries, migration 267).

    Outlives its run: knowledge is the only thing a courier carries home that a Havarie
    cannot scatter (R12). `payload` stays open — each kind writes its own shape, and the
    logbook is a record, not an API contract the HUD may depend on field by field.
    """

    id: UUID
    run_id: UUID | None = None
    takt: int
    kind: str
    node_id: UUID | None = None
    payload: dict = Field(default_factory=dict)
    created_at: datetime


class TravelRunResponse(BaseModel):
    """A travel_runs row as the run-lifecycle RPCs return it (to_jsonb(run)).

    THE RAW CHECKPOINT IS NOT PART OF THIS RESPONSE (W2.6/B). It is accepted as INPUT — the
    RPCs can only speak through it — and every block the HUD may see is lifted out of it into
    a typed field below. It is then dropped (`exclude=True`).

    It used to go out 1:1, right next to the typed fields that carefully lift only what is
    allowed, which made the typing worthless for confidentiality: the raw blob carries
    `check.difficulty` and the `deltas` of EVERY branch of a pending scene (the draw stores
    jsonb_agg over the complete template options). The concept is explicit — "die Odds werden
    nie beziffert" (R4) — and via DevTools they were.
    """

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
    event_seq: int
    chart_version: int | None = None
    opened_at: datetime
    closed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    # ── The run's live state: COLUMNS since W2.6/D ────────────────────────────
    # These were untyped keys in the checkpoint jsonb, which is where the marker stack could
    # silently empty on a move and the same money could be booked three times. `haul` is the
    # DERIVED loose haul (haul_survey + Σ sondierung yields + Σ cargo haul_value); no writer
    # sets it, a trigger recomputes it from its sources on every write.
    haul: int = 0
    haul_safe: int = 0
    overstay: bool = False
    markers: dict[str, list[str]] = Field(default_factory=dict)
    sondierung: dict[str, dict] = Field(default_factory=dict)

    # ── The scene payloads: lifted out of the checkpoint ──────────────────────
    earnings: EarningsBlock | None = None
    pending_signal: PendingSignal | None = None
    last_signal: ResolvedSignal | None = None
    last_sondierung: SondierungReveal | None = None
    last_bank: BankReceipt | None = None
    havarie: HavarieBlock | None = None
    closing: ClosingReceipt | None = None

    # Input only. Never serialised — see the class docstring.
    checkpoint: dict = Field(default_factory=dict, exclude=True)

    @model_validator(mode="after")
    def _lift_checkpoint_blocks(self) -> "TravelRunResponse":
        """Surface the checkpoint's scene payloads as typed fields.

        Every run RPC RETURNS to_jsonb(run), so anything they want to tell the HUD can only
        travel inside the checkpoint jsonb. Lifting the blocks here means the HUD reads typed
        fields instead of digging through an untyped dict, and every consumer of a run row (the
        mutation's own response, a refetch, a second device resuming) gets the same story the
        same way.

        `earnings`        — what the last act PAID (264). The count-up ceremony's contract.
        `pending_signal`  — the scene the run is WAITING on (267): while this is set the run
                            cannot move, dig or bank.
        `last_signal`     — what the answer did (the result state of the panel).
        `last_sondierung` — the reveal of the last dig (268).
        `last_bank`       — the Funkboje's receipt (268).
        `havarie`         — the wreck, with the options the SERVER offered (265).
        `closing`         — how the run ended and what it was worth (W2.6).

        Every one of them is absent while the Fun-Kern gate is closed (`closing` excepted — a
        P0 run still ends), and the fields are then simply None, which is exactly P0.

        A key the model does not know does not break the mutation — it breaks every subsequent
        GET on the run, quietly. `test_drift_run_contract.py` drives every mutation through
        this model for exactly that reason.
        """
        if not isinstance(self.checkpoint, dict):
            return self
        cp = self.checkpoint

        def _block(key: str) -> dict | None:
            value = cp.get(key)
            return value if isinstance(value, dict) else None

        if self.earnings is None and (block := _block("earnings")):
            self.earnings = EarningsBlock(**block)
        if self.pending_signal is None and (block := _block("pending_signal")):
            self.pending_signal = PendingSignal(**block)
        if self.last_signal is None and (block := _block("last_signal")):
            self.last_signal = ResolvedSignal(**block)
        if self.last_sondierung is None and (block := _block("last_sondierung")):
            self.last_sondierung = SondierungReveal(**block)
        if self.last_bank is None and (block := _block("last_bank")):
            self.last_bank = BankReceipt(**block)
        if self.havarie is None and (block := _block("havarie")):
            self.havarie = HavarieBlock(**block)
        if self.closing is None and (block := _block("closing")):
            self.closing = ClosingReceipt(**block)
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
    # Welle 2 (M2): the HUD must be able to STATE what one more dig is worth and what the
    # Funkboje pays — the yield table is the server's, never a client constant, or a
    # re-tune would quietly turn the panel into a liar.
    sondierung_yields: list[int] = Field(default_factory=list)
    funkboje_rate: float = 0.7
    funkboje_node_types: list[str] = Field(default_factory=list)


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
    # The traveller's HOME world. The server derives "at home" from this row
    # (traveler_profiles.anchor_simulation_id) on every run RPC — so the HUD has to read it
    # from here too. Deriving it from the ROUTE instead (which sim's page you happen to be
    # on) makes the client and the server disagree the moment a traveller opens DRIFT from
    # a world that is not their anchor: the Funkboje would be offered at the real home
    # (where the server refuses it) and hidden at a foreign dock (where it would work).
    anchor_simulation_id: UUID
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
