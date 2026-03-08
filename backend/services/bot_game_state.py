"""Fog-of-war compliant game state builder for bot participants.

Queries ONLY data that a human player would see through the UI.
No privileged access — uses the same data visibility rules as the frontend.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from backend.services.constants import SECURITY_LEVEL_MAP
from supabase import Client

logger = logging.getLogger(__name__)

# Archetype → (aligned operative types, opposed operative types)
ARCHETYPE_OPERATIVE_AFFINITIES: dict[str, tuple[list[str], list[str]]] = {
    "The Shadow":           (["spy", "assassin"],        ["propagandist"]),
    "The Tower":            (["saboteur", "infiltrator"], []),
    "The Devouring Mother": (["spy", "propagandist"],    ["infiltrator"]),
    "The Deluge":           (["saboteur", "infiltrator"], ["spy"]),
    "The Overthrow":        (["propagandist", "infiltrator"], []),
    "The Prometheus":       (["spy", "infiltrator"],      ["saboteur"]),
    "The Awakening":        (["propagandist", "spy"],     ["assassin"]),
    "The Entropy":          (["saboteur", "assassin"],    ["infiltrator"]),
}


def _derive_resonance_affinities(
    active_resonances: list[dict],
) -> tuple[list[str], list[str]]:
    """Derive aligned/opposed operative types from active resonance archetypes."""
    aligned: set[str] = set()
    opposed: set[str] = set()
    for res in active_resonances:
        archetype = res.get("archetype", "")
        affinities = ARCHETYPE_OPERATIVE_AFFINITIES.get(archetype)
        if affinities:
            aligned.update(affinities[0])
            opposed.update(affinities[1])
    # Remove any type that appears in both (net zero)
    overlap = aligned & opposed
    return sorted(aligned - overlap), sorted(opposed - overlap)


@dataclass
class BotGameState:
    """A fog-of-war compliant view of the game state for a bot participant."""

    # Identity
    participant_id: str
    simulation_id: str
    epoch_id: str
    personality: str
    difficulty: str

    # Economy
    current_rp: int = 0
    rp_cap: int = 40
    rp_per_cycle: int = 12

    # Epoch context
    current_cycle: int = 1
    epoch_phase: str = "foundation"

    # Own data (full visibility)
    own_missions: list[dict] = field(default_factory=list)
    own_guardians: int = 0
    own_zones: list[dict] = field(default_factory=list)
    own_agents: list[dict] = field(default_factory=list)
    own_embassies: list[dict] = field(default_factory=list)

    # Detected intel (fog of war — only what detection mechanics reveal)
    detected_enemy_ops: list[dict] = field(default_factory=list)
    spy_intel_reports: list[dict] = field(default_factory=list)

    # Public data (all players see this)
    battle_log: list[dict] = field(default_factory=list)
    scores: list[dict] = field(default_factory=list)
    teams: list[dict] = field(default_factory=list)
    participants: list[dict] = field(default_factory=list)

    # World state (resonance awareness)
    own_zone_stability: list[dict] = field(default_factory=list)
    own_avg_pressure: float = 0.0
    active_resonances: list[dict] = field(default_factory=list)
    resonance_aligned_types: list[str] = field(default_factory=list)
    resonance_opposed_types: list[str] = field(default_factory=list)

    # Derived
    own_team_id: str | None = None
    allies: list[str] = field(default_factory=list)

    @classmethod
    async def build(
        cls,
        supabase: Client,
        epoch_id: str,
        participant: dict,
        cycle_number: int,
        config: dict,
    ) -> BotGameState:
        """Build game state using same data access a human player has."""
        sim_id = participant["simulation_id"]
        bot_player = participant.get("bot_player") or {}

        state = cls(
            participant_id=participant["id"],
            simulation_id=sim_id,
            epoch_id=epoch_id,
            personality=bot_player.get("personality", "sentinel"),
            difficulty=bot_player.get("difficulty", "medium"),
            current_rp=participant.get("current_rp", 0),
            rp_cap=config.get("rp_cap", 40),
            rp_per_cycle=config.get("rp_per_cycle", 12),
            current_cycle=cycle_number,
            epoch_phase=config.get("_epoch_status", "competition"),
            own_team_id=participant.get("team_id"),
        )

        # Parallel-safe sequential queries (supabase-py is sync under the hood)
        await state._load_own_data(supabase, epoch_id, sim_id)
        await state._load_detected_intel(supabase, epoch_id, sim_id)
        await state._load_public_data(supabase, epoch_id)
        await state._load_world_state(supabase, sim_id)
        state._derive_allies()

        return state

    async def _load_own_data(self, supabase: Client, epoch_id: str, sim_id: str) -> None:
        """Load data the bot has full visibility over (own simulation)."""
        # Own missions (all statuses)
        missions_resp = (
            supabase.table("operative_missions")
            .select("*")
            .eq("epoch_id", epoch_id)
            .eq("source_simulation_id", sim_id)
            .execute()
        )
        self.own_missions = missions_resp.data or []
        self.own_guardians = sum(
            1 for m in self.own_missions
            if m["operative_type"] == "guardian" and m["status"] == "active"
        )

        # Own zones (security levels)
        zones_resp = (
            supabase.table("zones")
            .select("id, name, security_level")
            .eq("simulation_id", sim_id)
            .execute()
        )
        self.own_zones = zones_resp.data or []

        # Own agents (available for deployment) with aptitudes
        agents_resp = (
            supabase.table("agents")
            .select("id, name, simulation_id, ambassador_blocked_until")
            .eq("simulation_id", sim_id)
            .is_("deleted_at", "null")
            .execute()
        )
        self.own_agents = agents_resp.data or []

        # Load aptitudes for own agents (keyed by agent_id)
        if self.own_agents:
            aptitudes_resp = (
                supabase.table("agent_aptitudes")
                .select("agent_id, operative_type, aptitude_level")
                .eq("simulation_id", sim_id)
                .execute()
            )
            apt_map: dict[str, dict[str, int]] = {}
            for row in aptitudes_resp.data or []:
                aid = row["agent_id"]
                if aid not in apt_map:
                    apt_map[aid] = {}
                apt_map[aid][row["operative_type"]] = row["aptitude_level"]
            # Attach aptitudes dict to each agent
            for agent in self.own_agents:
                agent["aptitudes"] = apt_map.get(agent["id"], {})

        # Own embassies (for offensive operations)
        # Embassies use simulation_a_id/simulation_b_id (bidirectional)
        embassies_resp = (
            supabase.table("embassies")
            .select(
                "id, simulation_a_id, simulation_b_id, status,"
                " infiltration_penalty, infiltration_penalty_expires_at"
            )
            .eq("status", "active")
            .or_(f"simulation_a_id.eq.{sim_id},simulation_b_id.eq.{sim_id}")
            .execute()
        )
        self.own_embassies = embassies_resp.data or []

    async def _load_detected_intel(self, supabase: Client, epoch_id: str, sim_id: str) -> None:
        """Load intel from detection mechanics (detected inbound ops + spy reports)."""
        # Detected enemy operations targeting us
        detected_resp = (
            supabase.table("operative_missions")
            .select("*")
            .eq("epoch_id", epoch_id)
            .eq("target_simulation_id", sim_id)
            .in_("status", ["detected", "captured"])
            .execute()
        )
        self.detected_enemy_ops = detected_resp.data or []

        # Spy intel from our successful spy missions (stored in battle_log)
        intel_resp = (
            supabase.table("battle_log")
            .select("*")
            .eq("epoch_id", epoch_id)
            .eq("source_simulation_id", sim_id)
            .eq("event_type", "intel_report")
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        self.spy_intel_reports = intel_resp.data or []

    async def _load_public_data(self, supabase: Client, epoch_id: str) -> None:
        """Load publicly visible data (all players see this)."""
        # Public battle log
        blog_resp = (
            supabase.table("battle_log")
            .select("*")
            .eq("epoch_id", epoch_id)
            .eq("is_public", True)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        self.battle_log = blog_resp.data or []

        # Current scores/standings
        scores_resp = (
            supabase.table("epoch_scores")
            .select("*")
            .eq("epoch_id", epoch_id)
            .order("composite_score", desc=True)
            .execute()
        )
        self.scores = scores_resp.data or []

        # Teams/alliances
        teams_resp = (
            supabase.table("epoch_teams")
            .select("*")
            .eq("epoch_id", epoch_id)
            .is_("dissolved_at", "null")
            .execute()
        )
        self.teams = teams_resp.data or []

        # Participants (sim names, not strategies)
        parts_resp = (
            supabase.table("epoch_participants")
            .select("id, simulation_id, team_id, is_bot, simulations(name, slug)")
            .eq("epoch_id", epoch_id)
            .execute()
        )
        self.participants = parts_resp.data or []

    def _derive_allies(self) -> None:
        """Compute allied simulation IDs from team membership."""
        if not self.own_team_id:
            self.allies = []
            return
        self.allies = [
            p["simulation_id"] for p in self.participants
            if p.get("team_id") == self.own_team_id
            and p["simulation_id"] != self.simulation_id
        ]

    async def _load_world_state(self, supabase: Client, sim_id: str) -> None:
        """Load zone stability and active resonances (publicly visible data)."""
        # Zone stability for own simulation
        try:
            stability_resp = (
                supabase.table("mv_zone_stability")
                .select("zone_id, zone_name, stability, total_pressure")
                .eq("simulation_id", sim_id)
                .execute()
            )
            self.own_zone_stability = stability_resp.data or []
            if self.own_zone_stability:
                self.own_avg_pressure = sum(
                    float(z.get("total_pressure", 0)) for z in self.own_zone_stability
                ) / len(self.own_zone_stability)
        except Exception:
            logger.debug("Zone stability load failed", exc_info=True)

        # Active resonances (public — all players can see these)
        try:
            resonance_resp = (
                supabase.table("active_resonances")
                .select("id, archetype, resonance_signature, magnitude, status")
                .in_("status", ["detected", "impacting"])
                .order("magnitude", desc=True)
                .limit(5)
                .execute()
            )
            self.active_resonances = resonance_resp.data or []
            self.resonance_aligned_types, self.resonance_opposed_types = (
                _derive_resonance_affinities(self.active_resonances)
            )
        except Exception:
            logger.debug("Active resonances load failed", exc_info=True)

    # ── Query helpers for personality logic ──────────────────

    def get_available_agents(self) -> list[dict]:
        """Get agents not currently on active missions."""
        deployed_agent_ids = {
            m["agent_id"] for m in self.own_missions
            if m["status"] in ("deploying", "active", "returning")
        }
        return [a for a in self.own_agents if a["id"] not in deployed_agent_ids]

    def get_embassy_for_target(self, target_sim_id: str) -> dict | None:
        """Get active embassy connecting to a target simulation."""
        for e in self.own_embassies:
            # Embassies are bidirectional: check both sides
            if e["simulation_a_id"] == target_sim_id or e["simulation_b_id"] == target_sim_id:
                return e
        return None

    def get_opponent_sim_ids(self) -> list[str]:
        """Get non-allied opponent simulation IDs."""
        return [
            p["simulation_id"] for p in self.participants
            if p["simulation_id"] != self.simulation_id
            and p["simulation_id"] not in self.allies
        ]

    def get_my_score_rank(self) -> int:
        """Get current rank (1-indexed). Returns participant count if no scores."""
        for i, s in enumerate(self.scores, 1):
            if s.get("simulation_id") == self.simulation_id:
                return i
        return len(self.participants)

    def get_leader_sim_id(self) -> str | None:
        """Get simulation_id of the current score leader (not self)."""
        for s in self.scores:
            if s.get("simulation_id") != self.simulation_id:
                return s["simulation_id"]
        return None

    def get_weakest_opponent(self) -> str | None:
        """Get simulation_id of the lowest-scoring opponent."""
        opponents = self.get_opponent_sim_ids()
        if not opponents:
            return None
        # Scores are sorted desc, so iterate in reverse
        for s in reversed(self.scores):
            if s.get("simulation_id") in opponents:
                return s["simulation_id"]
        # Fallback: random opponent
        return opponents[0] if opponents else None

    def get_target_zone_security(self, target_sim_id: str) -> float:
        """Get average zone security for target sim from spy intel."""
        for report in self.spy_intel_reports:
            meta = report.get("metadata", {})
            if report.get("target_simulation_id") == target_sim_id and "zone_security" in meta:
                levels = meta["zone_security"]
                if levels:
                    return sum(SECURITY_LEVEL_MAP.get(lv, 5.0) for lv in levels) / len(levels)
        return 5.0  # Default moderate if no intel

    def get_target_guardian_count(self, target_sim_id: str) -> int:
        """Get guardian count for target sim from spy intel."""
        for report in self.spy_intel_reports:
            meta = report.get("metadata", {})
            if report.get("target_simulation_id") == target_sim_id and "guardian_count" in meta:
                return meta["guardian_count"]
        return 0  # Unknown = assume unguarded

    def is_under_attack(self) -> bool:
        """Check if we have detected inbound enemy operations."""
        return len(self.detected_enemy_ops) > 0

    def get_dominant_strategy(self) -> str:
        """Analyze public battle log to detect dominant opponent strategy."""
        type_counts: dict[str, int] = {}
        for entry in self.battle_log:
            if entry.get("source_simulation_id") == self.simulation_id:
                continue
            etype = entry.get("event_type", "")
            if etype in ("sabotage", "propaganda", "assassination", "infiltration"):
                type_counts[etype] = type_counts.get(etype, 0) + 1
            elif etype == "alliance_formed":
                type_counts["diplomatic"] = type_counts.get("diplomatic", 0) + 1

        if not type_counts:
            return "unknown"

        dominant = max(type_counts, key=type_counts.get)  # type: ignore[arg-type]
        if dominant in ("sabotage", "assassination"):
            return "aggressive"
        if dominant in ("propaganda", "infiltration"):
            return "subversive"
        if dominant == "diplomatic":
            return "diplomatic"
        return "mixed"

    # ── Resonance-aware helpers ──────────────────────────────

    def get_most_volatile_opponent(self) -> str | None:
        """Opponent sim with highest pressure from spy intel.

        Uses spy intel reports to find which opponent has the most
        pressured zones (best target for resonance-aware operations).
        """
        opponents = self.get_opponent_sim_ids()
        if not opponents:
            return None

        # Check spy intel for zone security data (lower = more vulnerable)
        best_target: str | None = None
        lowest_security = 10.0

        for report in self.spy_intel_reports:
            meta = report.get("metadata", {})
            target_id = report.get("target_simulation_id")
            if target_id not in opponents:
                continue
            if "zone_security" in meta:
                levels = meta["zone_security"]
                if levels:
                    avg = sum(SECURITY_LEVEL_MAP.get(lv, 5.0) for lv in levels) / len(levels)
                    if avg < lowest_security:
                        lowest_security = avg
                        best_target = target_id

        return best_target

    def is_under_resonance_pressure(self) -> bool:
        """True if own average zone pressure exceeds 0.3."""
        return self.own_avg_pressure > 0.3

    def get_resonance_preferred_operative(self, candidates: list[str]) -> str | None:
        """From candidates, pick one in resonance_aligned_types if available."""
        for op_type in self.resonance_aligned_types:
            if op_type in candidates:
                return op_type
        return None
