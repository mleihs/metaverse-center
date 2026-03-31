"""Pydantic models for epochs, operatives, scoring, and battle log."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from backend.services.constants import OPERATIVE_TARGET_TYPE

# ── Scoring Dimensions (canonical list) ──────────────────────────

SCORING_DIMENSIONS: list[str] = [
    "stability", "influence", "sovereignty", "diplomatic", "military",
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


EpochStatus = Literal[
    "lobby", "foundation", "competition", "reckoning", "completed", "cancelled"
]


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


OperativeType = Literal[
    "spy", "saboteur", "propagandist", "assassin", "guardian", "infiltrator"
]


class OperativeDeploy(BaseModel):
    """Schema for deploying an operative."""

    agent_id: UUID
    operative_type: OperativeType
    target_simulation_id: UUID | None = None  # None for guardians (self-deploy)
    embassy_id: UUID | None = None  # Required except for guardians
    target_entity_id: UUID | None = None
    target_entity_type: Literal["building", "agent", "embassy", "zone"] | None = None
    target_zone_id: UUID | None = None

    @model_validator(mode="after")
    def _validate_target_entity(self) -> "OperativeDeploy":
        has_id = self.target_entity_id is not None
        has_type = self.target_entity_type is not None
        if has_id != has_type:
            raise ValueError(
                "target_entity_id and target_entity_type must both be set or both be omitted"
            )
        if has_type:
            expected = OPERATIVE_TARGET_TYPE.get(self.operative_type, "none")
            if expected == "none":
                raise ValueError(
                    f"{self.operative_type} operatives do not accept target entities"
                )
            if self.target_entity_type != expected:
                raise ValueError(
                    f"{self.operative_type} requires target_entity_type='{expected}', "
                    f"got '{self.target_entity_type}'"
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
    "operative_deployed", "mission_success", "mission_failed",
    "detected", "captured", "sabotage", "propaganda", "assassination",
    "infiltration", "alliance_formed", "alliance_dissolved", "betrayal",
    "phase_change", "epoch_start", "epoch_end", "rp_allocated",
    "building_damaged", "agent_wounded", "counter_intel", "zone_fortified",
    "alliance_proposal", "alliance_proposal_accepted",
    "alliance_proposal_rejected", "alliance_tension_increase",
    "alliance_dissolved_tension", "alliance_upkeep",
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
