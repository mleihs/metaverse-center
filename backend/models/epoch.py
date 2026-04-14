"""Pydantic models for epochs, operatives, scoring, and battle log."""

from datetime import datetime
from enum import Enum
from types import MappingProxyType
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from backend.services.constants import OPERATIVE_TARGET_TYPE

# ── Scoring Dimensions (canonical list) ──────────────────────────

SCORING_DIMENSIONS: list[str] = [
    "stability",
    "influence",
    "sovereignty",
    "diplomatic",
    "military",
]

# ── Epoch Configuration ──────────────────────────────────────────


class EpochScoreWeights(BaseModel):
    """Score dimension weights (must sum to 100)."""

    stability: int = Field(25, ge=0, le=100)
    influence: int = Field(20, ge=0, le=100)
    sovereignty: int = Field(20, ge=0, le=100)
    diplomatic: int = Field(15, ge=0, le=100)
    military: int = Field(20, ge=0, le=100)

    @model_validator(mode="after")
    def validate_sum(self) -> "EpochScoreWeights":
        total = self.stability + self.influence + self.sovereignty + self.diplomatic + self.military
        if total != 100:
            msg = f"Score weights must sum to 100, got {total}."
            raise ValueError(msg)
        return self


class EpochConfig(BaseModel):
    """Epoch configuration stored as JSONB in game_epochs.config."""

    duration_days: int = Field(14, ge=1, le=60)
    cycle_hours: int = Field(8, ge=2, le=24)
    rp_per_cycle: int = Field(12, ge=5, le=25)
    rp_cap: int = Field(40, ge=15, le=75)
    foundation_cycles: int = Field(4, ge=1, le=12)
    reckoning_cycles: int = Field(8, ge=2, le=16)
    max_team_size: int = Field(3, ge=2, le=8)
    max_agents_per_player: int = Field(6, ge=4, le=8)
    allow_betrayal: bool = True
    score_weights: EpochScoreWeights = Field(default_factory=EpochScoreWeights)
    referee_mode: bool = False

    # ── Auto-Resolve ──────────────────────────────────────────
    # Default "manual" preserves IST-Verhalten for existing epochs.
    # Epoch creation UI sets "activity_gated" as the recommended value.
    auto_resolve_mode: Literal[
        "manual",
        "hard_deadline",  # not yet implemented
        "deadline_or_ready",  # not yet implemented
        "activity_gated",
        "fixed_schedule",  # not yet implemented
    ] = "manual"
    cycle_deadline_minutes: int = Field(480, ge=15, le=2880)
    min_cycle_duration_minutes: int = Field(15, ge=5, le=120)
    require_action_for_ready: bool = False

    # ── AFK Handling ──────────────────────────────────────────
    afk_penalty_enabled: bool = False
    afk_rp_penalty: int = Field(2, ge=0, le=10)
    afk_escalation_threshold: int = Field(3, ge=2, le=10)
    afk_ai_personality: Literal["sentinel", "warlord", "diplomat", "strategist", "chaos"] = "sentinel"
    afk_ai_difficulty: Literal["easy", "medium", "hard"] = "easy"
    afk_rp_multiplier: float = Field(2.5, ge=1.0, le=5.0)

    # ── Mission Balance ──────────────────────────────────────
    # base_success_probability: starting probability before modifiers
    base_success_probability: float = Field(0.55, ge=0.1, le=0.9)
    # detection_on_failure: when a mission FAILS, probability the operative is detected
    detection_on_failure: float = Field(0.45, ge=0.1, le=0.9)
    # Probability percentage-point modifiers per factor
    aptitude_modifier_pp: float = Field(0.03, ge=0.01, le=0.1)
    guardian_defense_cap_pp: float = Field(0.15, ge=0.05, le=0.3)
    guardian_per_unit_pp: float = Field(0.06, ge=0.02, le=0.15)
    embassy_bonus_pp: float = Field(0.15, ge=0.05, le=0.3)
    # infiltrator_embassy_penalty: fraction of embassy effectiveness blocked (0.65 = 65% blocked)
    infiltrator_embassy_penalty: float = Field(0.65, ge=0.3, le=0.9)
    probability_floor: float = Field(0.05, ge=0.01, le=0.2)
    probability_ceiling: float = Field(0.95, ge=0.8, le=0.99)

    # ── Alliance ─────────────────────────────────────────────
    # proposal_expiry_cycles: how many cycles AHEAD a proposal expires (from creation cycle)
    proposal_expiry_cycles: int = Field(2, ge=1, le=5)

    @model_validator(mode="after")
    def validate_deadline_vs_min(self) -> "EpochConfig":
        if self.cycle_deadline_minutes < self.min_cycle_duration_minutes:
            msg = "cycle_deadline_minutes must be >= min_cycle_duration_minutes"
            raise ValueError(msg)
        return self


# Canonical default config — import this instead of re-instantiating EpochConfig().model_dump().
# MappingProxyType prevents accidental mutation of the shared default dict.
_DEFAULT_EPOCH_CONFIG_MUTABLE: dict = EpochConfig().model_dump()
DEFAULT_EPOCH_CONFIG: MappingProxyType = MappingProxyType(_DEFAULT_EPOCH_CONFIG_MUTABLE)

# ── Epoch CRUD ───────────────────────────────────────────────────


class AcademyConfig(BaseModel):
    """Configuration for academy (solo training) epochs."""

    difficulty: Literal["easy", "medium", "hard"] = "easy"
    bot_count: int = Field(default=3, ge=2, le=4)
    scenario: str | None = None


class EpochCreate(BaseModel):
    """Schema for creating a new epoch."""

    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    config: EpochConfig = Field(default_factory=EpochConfig)
    epoch_type: Literal["competitive", "academy"] = "competitive"
    academy_config: AcademyConfig | None = None


class EpochUpdate(BaseModel):
    """Schema for updating an epoch (lobby phase only)."""

    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    config: EpochConfig | None = None


EpochStatus = Literal["lobby", "foundation", "competition", "reckoning", "completed", "cancelled"]


class EpochResponse(BaseModel):
    """Full epoch response."""

    id: UUID
    name: str
    description: str | None = None
    created_by_id: UUID
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    current_cycle: int
    status: str
    config: dict
    epoch_type: str = "competitive"
    cycle_started_at: datetime | None = None
    cycle_deadline_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    participant_count: int | None = None
    team_count: int | None = None


# ── Epoch Participants ───────────────────────────────────────────


class ParticipantJoin(BaseModel):
    """Schema for joining an epoch with a simulation."""

    simulation_id: UUID


class ParticipantResponse(BaseModel):
    """Epoch participant response."""

    id: UUID
    epoch_id: UUID
    simulation_id: UUID
    user_id: UUID | None = None
    team_id: UUID | None = None
    joined_at: datetime
    current_rp: int
    last_rp_grant_at: datetime | None = None
    final_scores: dict | None = None
    drafted_agent_ids: list[UUID] | None = None
    draft_completed_at: datetime | None = None
    cycle_ready: bool = False
    is_bot: bool = False
    bot_player_id: UUID | None = None
    has_acted_this_cycle: bool = False
    consecutive_afk_cycles: int = 0
    total_afk_cycles: int = 0
    afk_replaced_by_ai: bool = False
    simulations: dict | None = None
    bot_players: dict | None = None


# ── Teams / Alliances ────────────────────────────────────────────


class TeamCreate(BaseModel):
    """Schema for forming a new alliance."""

    name: str = Field(..., min_length=1, max_length=100)


class TeamResponse(BaseModel):
    """Team/alliance response."""

    id: UUID
    epoch_id: UUID
    name: str
    created_by_simulation_id: UUID
    created_at: datetime
    dissolved_at: datetime | None = None
    dissolved_reason: str | None = None
    tension: int = 0
    members: list[dict] | None = None


# ── Alliance Proposals ───────────────────────────────────────


class AllianceProposalCreate(BaseModel):
    """Schema for creating an alliance join proposal."""

    team_id: UUID


class AllianceInviteCreate(BaseModel):
    """Schema for inviting a player to your team."""

    target_simulation_id: UUID


class AllianceVoteCreate(BaseModel):
    """Schema for voting on an alliance proposal."""

    vote: Literal["accept", "reject"]


class AllianceProposalResponse(BaseModel):
    """Alliance proposal response."""

    id: UUID
    epoch_id: UUID
    team_id: UUID
    proposer_simulation_id: UUID
    proposed_at: datetime
    expires_at_cycle: int
    status: str
    resolved_at: datetime | None = None
    votes: list[dict] | None = None
    proposer_name: str | None = None


class AllianceVoteResponse(BaseModel):
    """Alliance vote response."""

    id: UUID
    proposal_id: UUID
    voter_simulation_id: UUID
    vote: str
    voted_at: datetime


# ── Operative Missions ───────────────────────────────────────────


OperativeType = Literal["spy", "saboteur", "propagandist", "assassin", "guardian", "infiltrator"]


class ResonanceOpType(str, Enum):
    """Resonance Operation types for substrate exploitation during epochs."""

    SURGE_RIDING = "surge_riding"      # Aligned operative bonus (+0.08), risk: double pressure on own zones
    SUBSTRATE_TAP = "substrate_tap"    # Steal 1 RP from target's resonance events. Costs 2 RP.


class OperativeDeploy(BaseModel):
    """Schema for deploying an operative."""

    agent_id: UUID
    operative_type: OperativeType
    target_simulation_id: UUID | None = None  # None for guardians (self-deploy)
    embassy_id: UUID | None = None  # Required except for guardians
    target_entity_id: UUID | None = None
    target_entity_type: Literal["building", "agent", "embassy", "zone"] | None = None
    target_zone_id: UUID | None = None
    resonance_op: ResonanceOpType | None = None  # Optional resonance operation

    @model_validator(mode="after")
    def _validate_target_entity(self) -> "OperativeDeploy":
        has_id = self.target_entity_id is not None
        has_type = self.target_entity_type is not None
        if has_id != has_type:
            raise ValueError("target_entity_id and target_entity_type must both be set or both be omitted")
        if has_type:
            expected = OPERATIVE_TARGET_TYPE.get(self.operative_type, "none")
            if expected == "none":
                raise ValueError(f"{self.operative_type} operatives do not accept target entities")
            if self.target_entity_type != expected:
                raise ValueError(
                    f"{self.operative_type} requires target_entity_type='{expected}', got '{self.target_entity_type}'"
                )
        return self


class MissionResponse(BaseModel):
    """Operative mission response."""

    id: UUID
    epoch_id: UUID
    agent_id: UUID
    operative_type: str
    source_simulation_id: UUID
    target_simulation_id: UUID | None = None
    embassy_id: UUID | None = None
    target_entity_id: UUID | None = None
    target_entity_type: str | None = None
    target_zone_id: UUID | None = None
    status: str
    cost_rp: int
    success_probability: float | None = None
    deployed_at: datetime
    resolves_at: datetime
    resolved_at: datetime | None = None
    mission_result: dict | None = None
    created_at: datetime
    agent: dict | None = None


# ── Scores ───────────────────────────────────────────────────────


class ScoreResponse(BaseModel):
    """Per-cycle score snapshot."""

    id: UUID
    epoch_id: UUID
    simulation_id: UUID
    cycle_number: int
    stability_score: float
    influence_score: float
    sovereignty_score: float
    diplomatic_score: float
    military_score: float
    composite_score: float
    computed_at: datetime
    simulation: dict | None = None


class LeaderboardEntry(BaseModel):
    """Leaderboard entry with normalized scores."""

    rank: int
    simulation_id: UUID
    simulation_name: str
    simulation_slug: str | None = None
    team_name: str | None = None
    stability: float
    influence: float
    sovereignty: float
    diplomatic: float
    military: float
    composite: float
    ally_count: int = 0
    ally_bonus_pct: float = 0.0
    betrayal_penalty: float = 0.0


# ── Battle Log ───────────────────────────────────────────────────


BattleLogEventType = Literal[
    "operative_deployed",
    "mission_success",
    "mission_failed",
    "detected",
    "captured",
    "sabotage",
    "propaganda",
    "assassination",
    "infiltration",
    "alliance_formed",
    "alliance_dissolved",
    "betrayal",
    "phase_change",
    "epoch_start",
    "epoch_end",
    "rp_allocated",
    "building_damaged",
    "agent_wounded",
    "counter_intel",
    "zone_fortified",
    "alliance_proposal",
    "alliance_proposal_accepted",
    "alliance_proposal_rejected",
    "alliance_tension_increase",
    "alliance_dissolved_tension",
    "alliance_upkeep",
    "cycle_auto_resolved",
    "player_afk",
    "player_afk_penalty",
    "player_afk_ai_takeover",
    "player_returned",
    "player_passed",
]


class BattleSummaryResponse(BaseModel):
    """Cycle-aggregated battle statistics for War Room."""

    cycle_number: int
    missions_deployed: int = 0
    successes: int = 0
    failures: int = 0
    detections: int = 0
    events_by_type: dict[str, int] = {}
    narrative_highlights: list[dict] = []


class SitrepResponse(BaseModel):
    """AI-generated tactical situation report."""

    cycle_number: int
    sitrep: str
    summary: dict
    model_used: str


class BattleLogEntry(BaseModel):
    """Battle log entry response."""

    id: UUID
    epoch_id: UUID
    cycle_number: int
    event_type: str
    source_simulation_id: UUID | None = None
    target_simulation_id: UUID | None = None
    mission_id: UUID | None = None
    narrative: str
    is_public: bool
    metadata: dict
    created_at: datetime


# ── Typed Responses for Previously Untyped Endpoints ────────────


class PassCycleResponse(BaseModel):
    """Response for pass-cycle / toggle-ready endpoints."""

    simulation_id: UUID
    cycle_ready: bool = False
    auto_resolved: bool = False


class TeamActionResponse(BaseModel):
    """Response for join-team / leave-team actions."""

    simulation_id: UUID
    team_id: UUID | None = None
    action: str


class FortifyZoneResponse(BaseModel):
    """Response for fortify-zone operative action."""

    zone_id: UUID
    security_bonus: int
    expires_at_cycle: int
    cost_rp: int


class ResultsSummaryResponse(BaseModel):
    """Comprehensive epoch results (standings, history, awards)."""

    standings: list[dict]
    score_history: list[dict]
    mvp_awards: list[dict]
    participant_stats: list[dict]
