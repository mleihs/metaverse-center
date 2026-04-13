"""Pydantic models for the Resonance Dungeon system.

Three layers:
1. Constants & Literals — shared type definitions (combat types from backend.models.combat)
2. In-memory state — runtime game state (never sent to client directly)
3. API schemas — request/response models for REST endpoints
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

# Re-export shared combat types for backwards compatibility.
# The canonical definitions live in backend.models.combat (dungeon-agnostic).
from backend.models.combat import (  # noqa: F401
    AbilitySchool,
    AgentCombatState,
    CombatState,
    Condition,
    EnemyInstance,
    ThreatLevel,
)

# ── Constants ────────────────────────────────────────────────────────────────

DungeonStatus = Literal[
    "active",
    "combat",
    "exploring",
    "distributing",
    "completed",
    "abandoned",
    "wiped",
]

DungeonPhase = Literal[
    "exploring",
    "encounter",
    "threshold",
    "combat_planning",
    "combat_resolving",
    "combat_outcome",
    "rest",
    "treasure",
    "boss",
    "exit",
    "room_clear",
    "distributing",
    "completed",
    "retreated",
    "wiped",
]

DungeonEventType = Literal[
    "room_entered",
    "combat_started",
    "combat_resolved",
    "skill_check",
    "encounter_choice",
    "loot_found",
    "agent_stressed",
    "agent_afflicted",
    "agent_virtue",
    "agent_wounded",
    "party_wipe",
    "boss_defeated",
    "dungeon_completed",
    "dungeon_abandoned",
    "banter",
    "discovery",
]

RoomType = Literal[
    "combat",
    "elite",
    "encounter",
    "treasure",
    "rest",
    "boss",
    "entrance",
    "exit",
    "threshold",
]

ArchetypeName = Literal[
    "The Tower",
    "The Shadow",
    "The Devouring Mother",
    "The Deluge",
    "The Overthrow",
    "The Prometheus",
    "The Awakening",
    "The Entropy",
]

# ── Dungeon-Specific In-Memory State ──────────────────────────────────────────
# These represent runtime game state. Never sent to clients directly;
# filtered through Client State models (fog of war, hidden stats).
# AgentCombatState, EnemyInstance, CombatState are in backend.models.combat.


class RoomNode(BaseModel):
    """Single room in the dungeon DAG."""

    index: int
    depth: int
    room_type: RoomType
    connections: list[int] = Field(default_factory=list)
    cleared: bool = False
    revealed: bool = False
    scouted: bool = False  # True when room type is known (visited, scouted, or cleared)
    encounter_template_id: str | None = None
    loot_tier: int = 0  # 0=none, 1=minor, 2=major, 3=legendary


class DungeonInstance(BaseModel):
    """Full in-memory state of an active dungeon run.

    Stored in module-level _active_instances dict.
    Checkpointed to DB after every state transition (Review #1).
    """

    run_id: UUID
    simulation_id: UUID
    archetype: ArchetypeName
    signature: str
    difficulty: int

    # Graph (static after generation — stored in config, not in checkpoint)
    rooms: list[RoomNode]
    current_room: int = 0

    # Party
    party: list[AgentCombatState]
    player_ids: list[UUID] = Field(default_factory=list)

    # Active combat (None when exploring)
    combat: CombatState | None = None

    # Archetype-specific state (e.g. Shadow: {"visibility": 3, "rooms_since_vp_loss": 0})
    archetype_state: dict = Field(default_factory=dict)

    # Progress
    phase: DungeonPhase = "exploring"
    depth: int = 0
    rooms_cleared: int = 0
    turn: int = 0

    # Banter tracking (no-repeat per run)
    used_banter_ids: list[str] = Field(default_factory=list)

    # Encounter tracking (no-repeat per run; reset on pool exhaustion)
    used_encounter_ids: list[str] = Field(default_factory=list)

    # Phase timer metadata (set during combat planning for client countdown)
    phase_timer: PhaseTimer | None = None

    # Loot distribution (populated during 'distributing' phase after boss victory)
    pending_loot: list[dict] = Field(default_factory=list)
    loot_assignments: dict[str, str] = Field(default_factory=dict)  # loot_id → agent_id
    loot_extra_params: dict[str, dict] = Field(default_factory=dict)  # loot_id → extra params
    auto_apply_loot: list[dict] = Field(default_factory=list)  # pre-built auto-apply items

    # Objektanker (Variation C — "Wandernde Dinge")
    # 2 object IDs selected from ANCHOR_OBJECTS pool at run creation
    anchor_objects: list[str] = Field(default_factory=list)
    # Tracks which phases have been shown per object, e.g. {"shadow_note": ["discovery", "echo"]}
    anchor_phases_shown: dict[str, list[str]] = Field(default_factory=dict)

    # Resonanz-Barometer (Variation B — archetype state → prose)
    # Last displayed barometer tier (0-based). -1 = never shown.
    last_barometer_tier: int = -1

    def to_checkpoint(self) -> dict:
        """Serialize only mutable state for DB checkpoint (Review #17).

        Static graph is stored in config on run creation.
        Checkpoint contains: current_room, party, combat, archetype_state,
        phase, depth, rooms_cleared, turn, room cleared flags, used_banter_ids.
        """
        return {
            "current_room": self.current_room,
            "party": [a.model_dump(mode="json") for a in self.party],
            "combat": self.combat.model_dump(mode="json") if self.combat else None,
            "archetype_state": self.archetype_state,
            "phase": self.phase,
            "depth": self.depth,
            "rooms_cleared": self.rooms_cleared,
            "turn": self.turn,
            "room_cleared_flags": [r.index for r in self.rooms if r.cleared],
            "room_revealed_flags": [r.index for r in self.rooms if r.revealed],
            "room_scouted_flags": [r.index for r in self.rooms if r.scouted],
            "room_encounter_ids": {
                r.index: r.encounter_template_id
                for r in self.rooms
                if r.encounter_template_id
            },
            "used_banter_ids": self.used_banter_ids,
            "used_encounter_ids": self.used_encounter_ids,
            "phase_timer": self.phase_timer.model_dump(mode="json") if self.phase_timer else None,
            "pending_loot": self.pending_loot,
            "loot_assignments": self.loot_assignments,
            "auto_apply_loot": self.auto_apply_loot,
            "anchor_objects": self.anchor_objects,
            "anchor_phases_shown": self.anchor_phases_shown,
            "last_barometer_tier": self.last_barometer_tier,
        }

    def restore_from_checkpoint(self, checkpoint: dict) -> None:
        """Restore mutable state from DB checkpoint."""
        self.current_room = checkpoint["current_room"]
        self.party = [AgentCombatState(**a) for a in checkpoint["party"]]
        self.combat = CombatState(**checkpoint["combat"]) if checkpoint.get("combat") else None
        self.archetype_state = checkpoint.get("archetype_state", {})
        self.phase = checkpoint["phase"]
        self.depth = checkpoint["depth"]
        self.rooms_cleared = checkpoint["rooms_cleared"]
        self.turn = checkpoint.get("turn", 0)
        self.used_banter_ids = checkpoint.get("used_banter_ids", [])
        self.used_encounter_ids = checkpoint.get("used_encounter_ids", [])
        timer_data = checkpoint.get("phase_timer")
        self.phase_timer = PhaseTimer(**timer_data) if timer_data else None
        self.pending_loot = checkpoint.get("pending_loot", [])
        self.loot_assignments = checkpoint.get("loot_assignments", {})
        self.auto_apply_loot = checkpoint.get("auto_apply_loot", [])
        self.anchor_objects = checkpoint.get("anchor_objects", [])
        self.anchor_phases_shown = checkpoint.get("anchor_phases_shown", {})
        self.last_barometer_tier = checkpoint.get("last_barometer_tier", -1)
        # Restore room flags
        cleared = set(checkpoint.get("room_cleared_flags", []))
        revealed = set(checkpoint.get("room_revealed_flags", []))
        scouted = set(checkpoint.get("room_scouted_flags", []))
        encounter_ids: dict = checkpoint.get("room_encounter_ids", {})
        for room in self.rooms:
            room.cleared = room.index in cleared
            room.revealed = room.index in revealed
            room.scouted = room.index in scouted
            room.encounter_template_id = encounter_ids.get(str(room.index)) or encounter_ids.get(room.index)


# ── API Request Schemas ─────────────────────────────────────────────────────


class DungeonRunCreate(BaseModel):
    """Start a new dungeon run."""

    archetype: ArchetypeName
    party_agent_ids: list[UUID] = Field(..., min_length=2, max_length=4)
    difficulty: int = Field(1, ge=1, le=5)


class DungeonMoveRequest(BaseModel):
    """Move party to an adjacent room."""

    room_index: int = Field(..., ge=0)


class DungeonAction(BaseModel):
    """Generic action submission (encounter choice or ability use)."""

    action_type: Literal["encounter_choice", "combat_action", "interact", "use_ability"]
    agent_id: UUID | None = None
    choice_id: str | None = None
    ability_id: str | None = None
    target_id: str | None = None


class CombatAction(BaseModel):
    """Single agent's combat action for planning phase."""

    agent_id: UUID
    ability_id: str
    target_id: str | None = None


class CombatSubmission(BaseModel):
    """All combat actions for one planning phase.

    Empty actions list is valid: the backend auto-defends all agents
    (guardian_shield or spy_observe). This happens on timer expiry when
    the player hasn't selected any actions.
    """

    actions: list[CombatAction] = Field(default_factory=list)


class ScoutRequest(BaseModel):
    """Spy scout request."""

    agent_id: UUID


class SalvageRequest(BaseModel):
    """Salvage submerged loot from a cleared room (Deluge only)."""

    agent_id: UUID
    room_index: int = Field(..., ge=0)


class RestRequest(BaseModel):
    """Rest at a rest site."""

    agent_ids: list[UUID] = Field(..., min_length=1)


BIG_FIVE_DIMENSIONS = frozenset({
    "openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism",
})


class LootAssignment(BaseModel):
    """Assign one loot item to an agent during distribution phase.

    For personality_modifier items (Awakening Insight), ``dimension`` specifies
    which Big Five trait to modify. Required when assigning personality_modifier loot.
    """

    loot_id: str
    agent_id: UUID
    dimension: str | None = None


# ── API Response Schemas ────────────────────────────────────────────────────


class DungeonRunResponse(BaseModel):
    """Dungeon run record (DB row)."""

    id: UUID
    simulation_id: UUID
    resonance_id: UUID | None = None
    archetype: str
    resonance_signature: str
    party_agent_ids: list[UUID]
    party_player_ids: list[UUID] = Field(default_factory=list)
    difficulty: int
    depth_target: int
    current_depth: int
    rooms_cleared: int
    rooms_total: int
    status: str
    outcome: dict | None = None
    completed_at: datetime | None = None
    created_at: datetime


class DungeonRunDetailResponse(DungeonRunResponse):
    """Extended response with denormalized agent data."""

    party_agents: list[dict] = Field(default_factory=list)
    events_count: int = 0
    duration_seconds: int | None = None


class DungeonEventResponse(BaseModel):
    """Single dungeon event."""

    id: UUID
    run_id: UUID
    depth: int
    room_index: int
    event_type: str
    narrative_en: str | None = None
    narrative_de: str | None = None
    outcome: dict = Field(default_factory=dict)
    created_at: datetime


class AvailableDungeonResponse(BaseModel):
    """Available dungeon archetype for a simulation."""

    archetype: str
    signature: str
    resonance_id: UUID | None = None  # None when admin-overridden (no resonance)
    magnitude: float = 0.5
    susceptibility: float = 0.5
    effective_magnitude: float = 0.5
    suggested_difficulty: int = Field(default=3, ge=1, le=5)
    suggested_depth: int = Field(default=5, ge=3, le=7)
    last_run_at: datetime | None = None
    available: bool = True
    admin_override: bool = False  # True when unlocked via admin setting


class AgentLootEffectResponse(BaseModel):
    """A persistent dungeon loot effect applied to an agent."""

    id: UUID
    agent_id: UUID
    effect_type: str
    effect_params: dict = Field(default_factory=dict)
    source_run_id: UUID | None = None
    source_loot_id: str
    consumed: bool = False
    created_at: datetime
    # Denormalized from source run (joined)
    source_archetype: str | None = None
    source_difficulty: int | None = None
    source_completed_at: datetime | None = None


# ── Client State Schemas (fog-of-war filtered) ─────────────────────────────
# These are the security boundary: unrevealed rooms show as "?" type,
# hidden enemy stats are never exposed.


class RoomNodeClient(BaseModel):
    """Room as seen by the client (fog of war applied)."""

    index: int
    depth: int
    room_type: str  # "?" if not revealed
    connections: list[int]
    cleared: bool
    current: bool = False
    revealed: bool


class BuffDebuff(BaseModel):
    """Active buff or debuff on an agent."""

    id: str
    name: str
    icon: str = ""
    duration_rounds: int | None = None
    description: str = ""


class AbilityOption(BaseModel):
    """Available ability for combat planning."""

    id: str
    name_en: str
    name_de: str
    school: str
    description_en: str
    description_de: str
    check_info: str | None = None  # "Spy 8: 73% success"
    cooldown_remaining: int = 0
    is_ultimate: bool = False
    targets: str = "single_enemy"  # single_enemy, all_enemies, single_ally, all_allies, self


class AgentCombatStateClient(BaseModel):
    """Agent state as seen by the client."""

    agent_id: UUID
    agent_name: str
    portrait_url: str | None = None
    condition: str
    stress: int
    stress_threshold: str = "normal"  # "normal", "tense", "critical"
    mood: int
    active_buffs: list[BuffDebuff] = Field(default_factory=list)
    active_debuffs: list[BuffDebuff] = Field(default_factory=list)
    aptitudes: dict[str, int] = Field(default_factory=dict)
    available_abilities: list[AbilityOption] = Field(default_factory=list)
    personality_summary: str = ""


class TelegraphedAction(BaseModel):
    """Enemy's telegraphed intent (Into the Breach style)."""

    enemy_name: str
    intent: str
    target: str | None = None
    threat_level: Literal["low", "medium", "high", "critical"] = "medium"


class EnemyCombatStateClient(BaseModel):
    """Enemy state as seen by the client."""

    instance_id: str
    name_en: str
    name_de: str
    condition_display: str  # "healthy", "damaged", "critical" (not exact steps)
    threat_level: str
    is_alive: bool = True
    telegraphed_action: TelegraphedAction | None = None


class PhaseTimer(BaseModel):
    """Timer for timed phases (combat planning).

    remaining_ms: Client-facing countdown (avoids cross-clock skew).
    started_at + duration_ms: Server-side for timeout callbacks (logging only).
    """

    started_at: str  # ISO timestamp (server-side reference only)
    duration_ms: int  # Server-side total (includes buffer)
    remaining_ms: int = 0  # Client-facing countdown, eliminates clock skew
    phase: str


class CombatStateClient(BaseModel):
    """Combat state as seen by the client."""

    round_num: int
    max_rounds: int
    enemies: list[EnemyCombatStateClient] = Field(default_factory=list)
    phase: Literal["assessment", "planning", "resolving", "outcome"] = "assessment"
    timer: PhaseTimer | None = None
    telegraphed_actions: list[TelegraphedAction] = Field(default_factory=list)


class DungeonClientState(BaseModel):
    """Full state sent to client for rendering.

    This is the security boundary — unrevealed rooms and hidden
    enemy stats are filtered before this model is constructed.
    """

    run_id: UUID
    archetype: str
    signature: str
    difficulty: int
    depth: int
    current_room: int

    # Graph (only revealed rooms)
    rooms: list[RoomNodeClient] = Field(default_factory=list)

    # Party
    party: list[AgentCombatStateClient] = Field(default_factory=list)

    # Archetype-specific (e.g. Shadow: {"visibility": 2, "max_visibility": 3})
    archetype_state: dict = Field(default_factory=dict)

    # Combat (if active)
    combat: CombatStateClient | None = None

    # Phase
    phase: DungeonPhase = "exploring"
    phase_timer: PhaseTimer | None = None

    # Loot distribution (populated only during 'distributing' phase)
    pending_loot: list[dict] | None = None
    loot_assignments: dict[str, str] = Field(default_factory=dict)
    loot_suggestions: dict[str, str] = Field(default_factory=dict)

    # Encounter (populated only when phase is "encounter" or "rest")
    encounter_choices: list[dict] | None = None
    encounter_description_en: str | None = None
    encounter_description_de: str | None = None


# ── Combat Resolution Response Models ────────────────────────────────────
# API-layer models for combat round results. The internal combat engine uses
# dataclasses (CombatEvent, CombatRoundResult) which are mutable during
# resolution. These Pydantic models define the serialized API shape with
# client-friendly field names (damage not damage_steps, wipe not party_wipe).


class CombatEventResponse(BaseModel):
    """Single combat event for API response (maps from combat_engine.CombatEvent)."""

    actor: str
    action: str
    target: str
    hit: bool = True
    damage: int = 0
    stress: int = 0
    narrative_en: str = ""
    narrative_de: str = ""


class CombatRoundResultResponse(BaseModel):
    """Combat round result for API response (maps from combat_engine.CombatRoundResult)."""

    round: int
    events: list[CombatEventResponse] = Field(default_factory=list)
    narrative_en: str = ""
    narrative_de: str = ""
    victory: bool = False
    wipe: bool = False
    stalemate: bool = False


# ── Dungeon Action Response Models ──────────────────────────────────────
# Response schemas for dungeon mutation endpoints. These define the exact
# shape of the ``data`` field in ``SuccessResponse[T]`` for each endpoint,
# enabling OpenAPI schema generation and runtime response validation.


class CreateRunResponse(BaseModel):
    """Response from creating a new dungeon run."""

    run: DungeonRunResponse
    state: DungeonClientState
    entrance_text: dict | None = None


class MoveResponse(BaseModel):
    """Response from moving to a room.

    Polymorphic — fields populated depend on target room type:
    combat/elite → combat + is_ambush + encounter_description
    encounter/rest → encounter/rest + description + choices
    threshold → threshold + description + choices
    treasure → treasure + auto_loot + loot
    boss → boss_deployment + description + choices (or combat)
    exit → exit_available
    """

    # Always present
    banter: dict | None = None
    anchor_texts: list[dict] | None = None
    barometer_text: dict | None = None
    debris: dict | None = None
    deja_vu: bool = False
    state: DungeonClientState

    # Combat room entry
    combat: bool | None = None
    is_ambush: bool | None = None
    encounter_description_en: str | None = None
    encounter_description_de: str | None = None

    # Interactive room (encounter / rest / threshold / boss_deployment)
    threshold: bool | None = None
    encounter: bool | None = None
    rest: bool | None = None
    treasure: bool | None = None
    boss_deployment: bool | None = None
    description_en: str | None = None
    description_de: str | None = None
    choices: list[dict] | None = None
    encounter_id: str | None = None

    # Treasure auto-loot
    auto_loot: bool | None = None
    loot: list[dict] | None = None

    # Exit
    exit_available: bool | None = None


class EncounterChoiceResponse(BaseModel):
    """Response from encounter choice, threshold toll, or boss deployment action."""

    result: str  # "success", "partial", "fail"
    check: dict | None = None
    effects: dict = Field(default_factory=dict)
    narrative_effects_en: list[str] = Field(default_factory=list)
    narrative_effects_de: list[str] = Field(default_factory=list)
    narrative_en: str = ""
    narrative_de: str = ""
    state: DungeonClientState

    # Threshold toll (populated only for threshold choices)
    threshold_toll: str | None = None

    # Boss deployment → combat transition overlay
    combat: bool | None = None
    is_ambush: bool | None = None
    encounter_description_en: str | None = None
    encounter_description_de: str | None = None


class CombatSubmitResponse(BaseModel):
    """Response from submitting combat actions.

    Two shapes:
    1. Waiting: accepted=True, waiting_for_players=True
    2. Resolved: round_result + state + optional outcome flags
    """

    # Waiting case (no other fields populated)
    accepted: bool | None = None
    waiting_for_players: bool | None = None

    # Resolution case
    round_result: CombatRoundResultResponse | None = None
    state: DungeonClientState | None = None

    # Outcome flags (from victory/wipe/stalemate handlers)
    victory: bool | None = None
    wipe: bool | None = None
    stalemate: bool | None = None
    loot: list[dict] | None = None

    # RPC failure fallback (graceful degradation)
    rpc_failed: bool | None = None
    rpc_error_message: str | None = None


class ScoutResponse(BaseModel):
    """Response from spy scouting action."""

    revealed_rooms: int
    visibility: int | None = None
    state: DungeonClientState


class ArchetypeActionResponse(BaseModel):
    """Response from archetype-specific actions: Seal Breach, Ground, Rally.

    Each archetype uses one metric field; the others remain None.
    """

    water_level: int | None = None  # Deluge: Seal Breach
    awareness: int | None = None  # Awakening: Ground
    fracture: int | None = None  # Overthrow: Rally
    stress_cost: int
    agent_stress: int
    cooldown_until_room: int
    state: DungeonClientState


class SalvageResponse(BaseModel):
    """Response from salvaging submerged loot (Deluge)."""

    success: bool
    loot: list[dict] | None = None
    water_penalty: int | None = None
    check_result: str
    check_value: int
    state: DungeonClientState


class RestResponse(BaseModel):
    """Response from resting at a rest site."""

    healed: bool = False
    ambushed: bool = False
    state: DungeonClientState


class RetreatResponse(BaseModel):
    """Response from retreating/abandoning the dungeon."""

    retreated: bool = True
    loot: list[dict] = Field(default_factory=list)
    banter: dict | None = None
    rpc_failed: bool | None = None
    rpc_error_message: str | None = None


class LootAssignResponse(BaseModel):
    """Response from assigning a loot item to an agent."""

    assignments: dict[str, str]
    remaining: int
    all_assigned: bool
    state: DungeonClientState


class DistributeConfirmResponse(BaseModel):
    """Response from confirming loot distribution."""

    loot_result: dict = Field(default_factory=dict)
    state: DungeonClientState


# ── Encounter/Loot Data Models ──────────────────────────────────────────────


class EncounterChoice(BaseModel):
    """A choice within an encounter."""

    id: str
    label_en: str
    label_de: str
    requires_aptitude: dict[str, int] | None = None
    requires_profession: str | None = None
    check_aptitude: str | None = None
    check_difficulty: int = 0
    success_effects: dict = Field(default_factory=dict)
    partial_effects: dict = Field(default_factory=dict)
    fail_effects: dict = Field(default_factory=dict)
    success_narrative_en: str = ""
    success_narrative_de: str = ""
    partial_narrative_en: str = ""
    partial_narrative_de: str = ""
    fail_narrative_en: str = ""
    fail_narrative_de: str = ""


class EncounterTemplate(BaseModel):
    """A self-contained encounter definition (Sunless Sea storylet pattern)."""

    id: str
    archetype: str
    room_type: str
    min_depth: int = 0
    max_depth: int = 99
    min_difficulty: int = 1
    requires_aptitude: dict[str, int] | None = None
    description_en: str = ""
    description_de: str = ""
    choices: list[EncounterChoice] = Field(default_factory=list)
    combat_encounter_id: str | None = None  # references enemy spawn config
    is_ambush: bool = False
    ambush_stress: int = 0


class EnemyTemplate(BaseModel):
    """Definition of an enemy type."""

    id: str
    name_en: str
    name_de: str
    archetype: str
    condition_threshold: int
    stress_resistance: int = 0
    threat_level: ThreatLevel = "standard"
    attack_aptitude: str
    attack_power: int
    stress_attack_power: int
    telegraphed_intent: bool = True
    evasion: int = 0
    resistances: list[str] = Field(default_factory=list)
    vulnerabilities: list[str] = Field(default_factory=list)
    action_weights: dict[str, int] = Field(default_factory=dict)
    special_abilities: list[str] = Field(default_factory=list)
    description_en: str = ""
    description_de: str = ""
    ambient_text_en: list[str] = Field(default_factory=list)
    ambient_text_de: list[str] = Field(default_factory=list)


class LootItem(BaseModel):
    """A single loot drop."""

    id: str
    name_en: str
    name_de: str
    tier: int  # 1=minor, 2=major, 3=legendary
    effect_type: str  # "stress_heal", "aptitude_boost", "memory", "moodlet", etc.
    effect_params: dict = Field(default_factory=dict)
    description_en: str = ""
    description_de: str = ""
    drop_weight: int = 10
