#!/usr/bin/env python3
"""Automated Resonance Dungeon playtest runner.

Runs N dungeon playthroughs via the REST API, navigating rooms, handling
combat, rest/encounter choices, and collecting statistics.

Usage:
    # Run from project root with the backend venv:
    backend/.venv/bin/python scripts/dungeon_playtest.py --archetype shadow --runs 5
    backend/.venv/bin/python scripts/dungeon_playtest.py --archetype tower --runs 20 --difficulty 3
    backend/.venv/bin/python scripts/dungeon_playtest.py --archetype shadow --runs 10 --verbose

Requires:
    - Backend running at http://localhost:8000
    - Supabase running locally (auth + DB)
    - Dev user seeded (matthias@leihs.at / met123)
    - Dungeon test data seeded (run seed_dungeon_testdata.py first)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import warnings
from collections import Counter
from dataclasses import dataclass, field

import requests

# ── Constants ────────────────────────────────────────────────────────────────

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BACKEND_URL = "http://localhost:8000"
API_BASE = f"{BACKEND_URL}/api/v1"
SIMULATION_ID = "70000000-0000-0000-0000-000000000001"

# Supabase local auth endpoint
SUPABASE_URL = "http://127.0.0.1:54321"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9"
    ".CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
)

DEV_EMAIL = "matthias@leihs.at"
DEV_PASSWORD = "met123"

ARCHETYPE_MAP = {
    "shadow": "The Shadow",
    "tower": "The Tower",
}

# How many times to retry transient HTTP errors
MAX_RETRIES = 3
RETRY_DELAY = 1.0

# Maximum moves per run (safety valve against infinite loops)
MAX_MOVES_PER_RUN = 80

# Maximum combat rounds to attempt before giving up
MAX_COMBAT_ATTEMPTS = 25


# ── Terminal Colors ──────────────────────────────────────────────────────────

def _ok(msg: str) -> None:
    print(f"  \033[32m[OK]\033[0m {msg}")


def _err(msg: str) -> None:
    print(f"  \033[31m[!!]\033[0m {msg}")


def _info(msg: str) -> None:
    print(f"  \033[33m[..]\033[0m {msg}")


def _heading(msg: str) -> None:
    print(f"\n\033[1m{'=' * 60}\033[0m")
    print(f"\033[1m  {msg}\033[0m")
    print(f"\033[1m{'=' * 60}\033[0m")


def _subheading(msg: str) -> None:
    print(f"\n\033[1m--- {msg} ---\033[0m")


# ── Data Classes ─────────────────────────────────────────────────────────────

@dataclass
class CombatStats:
    """Statistics for a single combat encounter."""
    rounds: int = 0
    victory: bool = False
    wipe: bool = False
    stalemate: bool = False
    enemies_faced: int = 0
    is_boss: bool = False
    is_ambush: bool = False


@dataclass
class RunStats:
    """Statistics for a single dungeon run."""
    run_id: str = ""
    archetype: str = ""
    difficulty: int = 1
    outcome: str = "unknown"  # completed, wiped, abandoned, error
    rooms_cleared: int = 0
    rooms_total: int = 0
    depth_reached: int = 0
    total_moves: int = 0
    combats: list[CombatStats] = field(default_factory=list)
    loot_dropped: list[dict] = field(default_factory=list)
    stress_snapshots: list[dict] = field(default_factory=list)
    stability_snapshots: list[int] = field(default_factory=list)
    condition_changes: list[str] = field(default_factory=list)
    death_cause: str = ""
    duration_seconds: float = 0.0
    error_message: str = ""
    events: list[str] = field(default_factory=list)

    @property
    def total_combat_rounds(self) -> int:
        return sum(c.rounds for c in self.combats)

    @property
    def avg_rounds_per_combat(self) -> float:
        if not self.combats:
            return 0.0
        return self.total_combat_rounds / len(self.combats)


# ── API Client ───────────────────────────────────────────────────────────────

class DungeonAPIClient:
    """HTTP client for the dungeon REST API with retry logic."""

    def __init__(self, token: str, verbose: bool = False):
        self.token = token
        self.verbose = verbose
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        })

    def _request(
        self,
        method: str,
        path: str,
        body: dict | None = None,
        params: dict | None = None,
    ) -> dict:
        """Make an API request with retry logic."""
        url = f"{API_BASE}{path}"
        last_error = None

        for attempt in range(MAX_RETRIES):
            try:
                resp = self.session.request(
                    method,
                    url,
                    json=body,
                    params=params,
                    timeout=30,
                )

                if resp.status_code == 409:
                    # Conflict (e.g., active run exists) -- not retryable
                    error_detail = resp.json().get("detail", resp.text[:200])
                    raise APIError(f"409 Conflict: {error_detail}", status=409)

                if resp.status_code >= 500:
                    last_error = f"{resp.status_code}: {resp.text[:200]}"
                    if attempt < MAX_RETRIES - 1:
                        if self.verbose:
                            _info(f"Retry {attempt + 1}/{MAX_RETRIES} for {method} {path}: {last_error}")
                        time.sleep(RETRY_DELAY * (attempt + 1))
                        continue
                    raise APIError(f"Server error after {MAX_RETRIES} retries: {last_error}", status=resp.status_code)

                if resp.status_code >= 400:
                    error_detail = resp.json().get("detail", resp.text[:200])
                    raise APIError(f"{resp.status_code}: {error_detail}", status=resp.status_code)

                return resp.json()

            except requests.exceptions.ConnectionError as e:
                last_error = str(e)
                if attempt < MAX_RETRIES - 1:
                    if self.verbose:
                        _info(f"Connection error, retry {attempt + 1}/{MAX_RETRIES}...")
                    time.sleep(RETRY_DELAY * (attempt + 1))
                    continue
                raise APIError(f"Connection failed after {MAX_RETRIES} retries: {last_error}") from e

            except requests.exceptions.Timeout as e:
                last_error = str(e)
                if attempt < MAX_RETRIES - 1:
                    if self.verbose:
                        _info(f"Timeout, retry {attempt + 1}/{MAX_RETRIES}...")
                    time.sleep(RETRY_DELAY * (attempt + 1))
                    continue
                raise APIError(f"Timeout after {MAX_RETRIES} retries: {last_error}") from e

        raise APIError(f"Request failed: {last_error}")

    def get(self, path: str, params: dict | None = None) -> dict:
        return self._request("GET", path, params=params)

    def post(self, path: str, body: dict | None = None, params: dict | None = None) -> dict:
        return self._request("POST", path, body=body, params=params)

    # ── Dungeon Endpoints ─────────────────────────────────────────────────

    def list_available(self, simulation_id: str) -> list[dict]:
        resp = self.get("/dungeons/available", params={"simulation_id": simulation_id})
        return resp.get("data", [])

    def list_agents(self, simulation_id: str, limit: int = 10) -> list[dict]:
        resp = self.get(f"/simulations/{simulation_id}/agents", params={"limit": limit})
        return resp.get("data", [])

    def create_run(
        self,
        simulation_id: str,
        archetype: str,
        party_agent_ids: list[str],
        difficulty: int = 1,
    ) -> dict:
        body = {
            "archetype": archetype,
            "party_agent_ids": party_agent_ids,
            "difficulty": difficulty,
        }
        resp = self.post("/dungeons/runs", body=body, params={"simulation_id": simulation_id})
        return resp.get("data", {})

    def get_state(self, run_id: str) -> dict:
        resp = self.get(f"/dungeons/runs/{run_id}/state")
        return resp.get("data", {})

    def move(self, run_id: str, room_index: int) -> dict:
        resp = self.post(f"/dungeons/runs/{run_id}/move", body={"room_index": room_index})
        return resp.get("data", {})

    def submit_combat(self, run_id: str, actions: list[dict]) -> dict:
        resp = self.post(
            f"/dungeons/runs/{run_id}/combat/submit",
            body={"actions": actions},
        )
        return resp.get("data", {})

    def submit_action(self, run_id: str, action: dict) -> dict:
        resp = self.post(f"/dungeons/runs/{run_id}/action", body=action)
        return resp.get("data", {})

    def scout(self, run_id: str, agent_id: str) -> dict:
        resp = self.post(f"/dungeons/runs/{run_id}/scout", body={"agent_id": agent_id})
        return resp.get("data", {})

    def rest(self, run_id: str, agent_ids: list[str]) -> dict:
        resp = self.post(f"/dungeons/runs/{run_id}/rest", body={"agent_ids": agent_ids})
        return resp.get("data", {})

    def retreat(self, run_id: str) -> dict:
        resp = self.post(f"/dungeons/runs/{run_id}/retreat")
        return resp.get("data", {})

    def assign_loot(self, run_id: str, loot_id: str, agent_id: str) -> dict:
        resp = self.post(
            f"/dungeons/runs/{run_id}/distribute",
            body={"loot_id": loot_id, "agent_id": agent_id},
        )
        return resp.get("data", {})

    def confirm_distribution(self, run_id: str) -> dict:
        resp = self.post(f"/dungeons/runs/{run_id}/distribute/confirm")
        return resp.get("data", {})


class APIError(Exception):
    def __init__(self, message: str, status: int = 0):
        super().__init__(message)
        self.status = status


# ── Authentication ───────────────────────────────────────────────────────────

def get_auth_token() -> str:
    """Authenticate via Supabase GoTrue and return a JWT access token."""
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }
    body = {"email": DEV_EMAIL, "password": DEV_PASSWORD}

    resp = requests.post(url, json=body, headers=headers, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"Auth failed ({resp.status_code}): {resp.text[:200]}")

    data = resp.json()
    token = data.get("access_token")
    if not token:
        raise RuntimeError(f"No access_token in auth response: {json.dumps(data)[:200]}")

    return token


# ── Combat AI ────────────────────────────────────────────────────────────────

def _count_alive_enemies(combat: dict) -> int:
    """Count alive enemies in the current combat state."""
    return sum(1 for e in combat.get("enemies", []) if e.get("is_alive"))


def choose_combat_actions(state: dict, force_attack: bool = False) -> list[dict]:
    """Choose reasonable combat actions for each party member.

    Strategy (damage-first, support-second):
    - Priority 1: Damage dealers (Assassin, Infiltrator, Saboteur) use damage abilities
    - Priority 2: Guardian uses Taunt (draw fire) when available, Shield when Taunt on cooldown
    - Priority 3: Spy uses Observe round 1, then Analyze Weakness for debuff
    - Priority 4: Propagandist heals only if ally is highly stressed (>300)
    - Fallback: first available damage ability targeting first alive enemy
    - force_attack: if True, ALL agents use damage abilities (stalemate breaker)
    """
    combat = state.get("combat")
    party = state.get("party", [])
    if not combat:
        return []

    alive_enemies = [e for e in combat.get("enemies", []) if e.get("is_alive")]
    if not alive_enemies:
        return []

    # Sort enemies: prioritize critical > damaged > healthy (focus fire on weakest)
    condition_priority = {"critical": 0, "damaged": 1, "healthy": 2}
    alive_enemies.sort(key=lambda e: condition_priority.get(e.get("condition_display", "healthy"), 2))

    actions = []
    for agent in party:
        condition = agent.get("condition", "operational")
        if condition in ("captured", "afflicted"):
            continue

        agent_id = agent["agent_id"]
        aptitudes = agent.get("aptitudes", {})
        abilities = agent.get("available_abilities", [])

        if not abilities:
            continue

        # Filter to non-cooldown abilities
        available = [a for a in abilities if a.get("cooldown_remaining", 0) == 0]
        if not available:
            available = abilities  # use whatever is available even with cooldown

        # Build ability lookup by id
        ability_map = {a["id"]: a for a in available}

        chosen_ability = None
        target_id = None

        # ── STALEMATE BREAKER: force all agents to attack ────────────
        if force_attack:
            # Try any damage ability, then basic attack
            for a in available:
                targets_type = a.get("targets", "single_enemy")
                if targets_type in ("single_enemy", "all_enemies"):
                    chosen_ability = a
                    target_id = alive_enemies[0]["instance_id"]
                    break
            # If no damage ability found, use first ability (some support is better than nothing)
            if not chosen_ability and available:
                chosen_ability = available[0]
                targets_type = chosen_ability.get("targets", "single_enemy")
                if targets_type in ("single_enemy", "all_enemies"):
                    target_id = alive_enemies[0]["instance_id"]
                else:
                    target_id = agent_id
            if chosen_ability:
                actions.append({
                    "agent_id": agent_id,
                    "ability_id": chosen_ability["id"],
                    "target_id": target_id,
                })
            continue

        # ── Priority 1: Assassin DPS (highest damage) ───────────────
        if aptitudes.get("assassin", 0) >= 3:
            precision = ability_map.get("assassin_precision_strike")
            exploit = ability_map.get("assassin_exploit")
            ambush = ability_map.get("assassin_ambush_strike")

            round_num = combat.get("round_num", 1)
            if ambush and round_num == 1:
                chosen_ability = ambush
            elif exploit:
                chosen_ability = exploit
            elif precision:
                chosen_ability = precision

            if chosen_ability:
                target_id = alive_enemies[0]["instance_id"]

        # ── Priority 2: Infiltrator DPS ─────────────────────────────
        if not chosen_ability and aptitudes.get("infiltrator", 0) >= 3:
            backstab = ability_map.get("infiltrator_backstab")
            evade = ability_map.get("infiltrator_evade")

            if backstab:
                chosen_ability = backstab
                target_id = alive_enemies[0]["instance_id"]
            elif evade:
                chosen_ability = evade
                target_id = agent_id

        # ── Priority 3: Saboteur DPS (Disrupt/Detonate first) ───────
        if not chosen_ability and aptitudes.get("saboteur", 0) >= 3:
            trap = ability_map.get("saboteur_trap")
            disrupt = ability_map.get("saboteur_disrupt")
            detonate = ability_map.get("saboteur_detonate")

            if detonate and len(alive_enemies) >= 2:
                chosen_ability = detonate
                target_id = alive_enemies[0]["instance_id"]
            elif disrupt:
                chosen_ability = disrupt
                target_id = alive_enemies[0]["instance_id"]
            elif trap:
                chosen_ability = trap
                target_id = alive_enemies[0]["instance_id"]

        # ── Priority 4: Guardian — Taunt first, Shield as fallback ──
        if not chosen_ability and aptitudes.get("guardian", 0) >= 3:
            taunt = ability_map.get("guardian_taunt")
            shield = ability_map.get("guardian_shield")
            reinforce = ability_map.get("guardian_reinforce")
            fortify = ability_map.get("guardian_fortify")

            # Taunt draws enemy fire — top priority for Guardian
            if taunt:
                chosen_ability = taunt
                target_id = agent_id  # self
            elif shield:
                # Shield the most stressed non-self ally
                most_stressed_ally = max(
                    (a for a in party if a.get("condition") not in ("captured", "afflicted")
                     and a["agent_id"] != agent_id),
                    key=lambda a: a.get("stress", 0),
                    default=None,
                )
                if most_stressed_ally:
                    chosen_ability = shield
                    target_id = most_stressed_ally["agent_id"]
                else:
                    chosen_ability = shield
                    target_id = agent_id
            elif reinforce:
                chosen_ability = reinforce
                target_id = agent_id
            elif fortify:
                chosen_ability = fortify
                target_id = agent_id

        # ── Priority 5: Spy — Observe round 1, then Analyze Weakness ─
        if not chosen_ability and aptitudes.get("spy", 0) >= 3:
            observe = ability_map.get("spy_observe")
            analyze = ability_map.get("spy_analyze_weakness")
            counter = ability_map.get("spy_counter_intel")

            round_num = combat.get("round_num", 1)
            if observe and round_num <= 1:
                chosen_ability = observe
                target_id = agent_id  # self
            elif analyze:
                chosen_ability = analyze
                target_id = alive_enemies[0]["instance_id"]
            elif counter:
                chosen_ability = counter
                target_id = alive_enemies[0]["instance_id"]
            elif observe:
                chosen_ability = observe
                target_id = agent_id

        # ── Priority 6: Propagandist heals only when ally stressed ──
        if not chosen_ability and aptitudes.get("propagandist", 0) >= 3:
            most_stressed_ally = max(
                (a for a in party if a.get("condition") not in ("captured", "afflicted")),
                key=lambda a: a.get("stress", 0),
                default=None,
            )
            if most_stressed_ally and most_stressed_ally.get("stress", 0) > 300:
                rally = ability_map.get("propagandist_rally")
                inspire = ability_map.get("propagandist_inspire")
                stressed_count = sum(
                    1 for a in party
                    if a.get("stress", 0) > 300 and a.get("condition") not in ("captured", "afflicted")
                )
                if rally and stressed_count >= 2:
                    chosen_ability = rally
                    target_id = agent_id  # all_allies targets from self
                elif inspire:
                    chosen_ability = inspire
                    target_id = most_stressed_ally["agent_id"]

        # ── Fallback: first available damage ability ─────────────────
        if not chosen_ability:
            for a in available:
                targets_type = a.get("targets", "single_enemy")
                if targets_type in ("single_enemy", "all_enemies"):
                    chosen_ability = a
                    target_id = alive_enemies[0]["instance_id"]
                    break

        # ── Ultimate fallback: any ability ───────────────────────────
        if not chosen_ability and available:
            chosen_ability = available[0]
            targets_type = chosen_ability.get("targets", "single_enemy")
            if targets_type in ("single_enemy", "all_enemies"):
                target_id = alive_enemies[0]["instance_id"]
            else:
                target_id = agent_id

        if chosen_ability:
            actions.append({
                "agent_id": agent_id,
                "ability_id": chosen_ability["id"],
                "target_id": target_id,
            })

    return actions


# ── Room Navigation AI ───────────────────────────────────────────────────────

def choose_next_room(state: dict) -> int | None:
    """Choose the next room to move to, prioritizing forward progress.

    Strategy:
    - Prefer rooms at greater depth (move forward)
    - Prefer rest rooms if party is stressed
    - Prefer exit rooms if party is in critical shape
    - Avoid already-cleared rooms
    - Among equal-depth rooms, pick one at random
    """
    current_room_idx = state.get("current_room", 0)
    rooms = state.get("rooms", [])
    party = state.get("party", [])

    if not rooms:
        return None

    current_room = next((r for r in rooms if r["index"] == current_room_idx), None)
    if not current_room:
        return None

    connections = current_room.get("connections", [])
    if not connections:
        return None

    # Build candidate list
    candidates = []
    for conn_idx in connections:
        room = next((r for r in rooms if r["index"] == conn_idx), None)
        if room:
            candidates.append(room)

    if not candidates:
        return None

    # Calculate party stress level
    avg_stress = 0
    alive_count = 0
    for agent in party:
        if agent.get("condition") not in ("captured",):
            avg_stress += agent.get("stress", 0)
            alive_count += 1
    if alive_count > 0:
        avg_stress //= alive_count

    critical_agents = sum(
        1 for a in party
        if a.get("condition") not in ("captured",) and a.get("stress", 0) > 600
    )

    # Score each candidate
    scored = []
    for room in candidates:
        score = 0
        room_type = room.get("room_type", "?")
        depth = room.get("depth", 0)
        cleared = room.get("cleared", False)

        # Strongly prefer higher depth (forward progress)
        score += depth * 10

        # Penalize cleared rooms (no reason to revisit)
        if cleared:
            score -= 50

        # Room type preferences based on party state
        if room_type == "rest" and avg_stress > 400:
            score += 20  # Seek rest when stressed
        elif room_type == "rest" and critical_agents >= 2:
            score += 30

        if room_type == "treasure":
            score += 5  # Treasure is always nice

        if room_type == "exit" and (critical_agents >= 2 or avg_stress > 700):
            score += 25  # Exit when in danger

        if room_type == "boss":
            score += 15  # Boss is the goal

        # Unknown rooms are neutral
        if room_type == "?":
            score += 2

        # Prefer combat/elite for clearing (forward progress)
        if room_type in ("combat", "elite"):
            score += 3

        scored.append((room["index"], score))

    # Sort by score descending, break ties by index (deterministic)
    scored.sort(key=lambda x: (-x[1], x[0]))

    return scored[0][0] if scored else None


def choose_encounter_action(state: dict, move_result: dict) -> dict | None:
    """Choose an action for an encounter room (skill check choice).

    Returns a DungeonAction body dict or None.
    """
    choices = move_result.get("choices", [])
    if not choices:
        return None

    party = state.get("party", [])
    operational_agents = [
        a for a in party
        if a.get("condition") not in ("captured", "afflicted")
    ]
    if not operational_agents:
        return None

    # Score each choice: prefer ones our agents can pass
    best_choice = None
    best_agent = None
    best_score = -1

    for choice in choices:
        check_apt = choice.get("check_aptitude")
        check_diff = choice.get("check_difficulty", 0)

        if not check_apt:
            # No skill check required -- easy choice
            if best_score < 100:
                best_choice = choice
                best_agent = operational_agents[0]
                best_score = 100
            continue

        # Find the best agent for this check
        for agent in operational_agents:
            apt_level = agent.get("aptitudes", {}).get(check_apt, 0)
            agent_score = apt_level * 10 - check_diff
            if agent_score > best_score:
                best_score = agent_score
                best_choice = choice
                best_agent = agent

    if not best_choice:
        # Just pick the first choice with the first agent
        best_choice = choices[0]
        best_agent = operational_agents[0]

    return {
        "action_type": "encounter_choice",
        "choice_id": best_choice["id"],
        "agent_id": best_agent["agent_id"],
    }


# ── Loot Distribution AI ────────────────────────────────────────────────────

def handle_distribution(client: DungeonAPIClient, run_id: str, state: dict, verbose: bool = False) -> dict:
    """Handle the loot distribution phase by assigning all items and confirming."""
    pending_loot = state.get("pending_loot", [])
    party = state.get("party", [])

    if not pending_loot:
        # No loot to distribute, try confirming directly
        try:
            return client.confirm_distribution(run_id)
        except APIError:
            return {"confirmed": False}

    # Auto-apply types are handled server-side, we only need to assign distributable items
    auto_types = {"stress_heal", "event_modifier", "arc_modifier", "dungeon_buff"}
    distributable = [item for item in pending_loot if item.get("effect_type") not in auto_types]

    operational_agents = [
        a for a in party
        if a.get("condition") not in ("captured",)
    ]
    if not operational_agents:
        operational_agents = party[:1]

    # Assign each distributable item to an appropriate agent
    for item in distributable:
        loot_id = item.get("id")
        if not loot_id:
            continue

        # Use suggestion if available
        suggestions = state.get("loot_suggestions", {})
        suggested_agent = suggestions.get(loot_id)

        if suggested_agent:
            agent_id = suggested_agent
        else:
            # Simple round-robin assignment
            idx = distributable.index(item) % len(operational_agents)
            agent_id = operational_agents[idx]["agent_id"]

        try:
            client.assign_loot(run_id, loot_id, agent_id)
            if verbose:
                _info(f"  Assigned loot '{item.get('name_en', loot_id)}' to agent")
        except APIError as e:
            if verbose:
                _err(f"  Failed to assign loot {loot_id}: {e}")

    # Confirm distribution
    try:
        return client.confirm_distribution(run_id)
    except APIError as e:
        if verbose:
            _err(f"  Failed to confirm distribution: {e}")
        return {"confirmed": False, "error": str(e)}


# ── Single Run Execution ────────────────────────────────────────────────────

def run_single_playthrough(
    client: DungeonAPIClient,
    archetype: str,
    difficulty: int,
    run_number: int,
    verbose: bool = False,
) -> RunStats:
    """Execute a single dungeon playthrough and collect statistics."""
    stats = RunStats(archetype=archetype, difficulty=difficulty)
    start_time = time.time()

    if verbose:
        _subheading(f"Run #{run_number}: {archetype} (difficulty {difficulty})")

    # ── Step 1: Get agents for party ──────────────────────────────────────
    try:
        agents = client.list_agents(SIMULATION_ID, limit=10)
    except APIError as e:
        _err(f"Failed to fetch agents: {e}")
        stats.outcome = "error"
        stats.error_message = str(e)
        return stats

    if len(agents) < 2:
        _err(f"Need >= 2 agents, found {len(agents)}")
        stats.outcome = "error"
        stats.error_message = "Not enough agents"
        return stats

    # Pick 3 agents to match browser party size (min_party_size=2, max_party_size=3)
    party_ids = [a["id"] for a in agents[:min(3, len(agents))]]

    if verbose:
        party_names = [a.get("name", a["id"][:8]) for a in agents[:len(party_ids)]]
        _info(f"Party ({len(party_ids)}): {', '.join(party_names)}")

    # ── Step 2: Create dungeon run ────────────────────────────────────────
    try:
        create_result = client.create_run(SIMULATION_ID, archetype, party_ids, difficulty)
    except APIError as e:
        if e.status == 409:
            _err("Active run exists -- attempting retreat first")
            # Try to find and retreat the active run
            try:
                # Fetch history to find active run
                history = client.get(
                    "/dungeons/history",
                    params={"simulation_id": SIMULATION_ID, "limit": 5},
                )
                active_runs = [
                    r for r in history.get("data", [])
                    if r.get("status") in ("active", "combat", "exploring", "distributing")
                ]
                if active_runs:
                    active_id = active_runs[0]["id"]
                    client.retreat(active_id)
                    _info(f"Retreated from active run {active_id}")
                    time.sleep(0.5)
                    # Retry creation
                    create_result = client.create_run(SIMULATION_ID, archetype, party_ids, difficulty)
                else:
                    stats.outcome = "error"
                    stats.error_message = "409 but no active run found in history"
                    return stats
            except APIError as inner_e:
                stats.outcome = "error"
                stats.error_message = f"Failed to clear active run: {inner_e}"
                return stats
        else:
            stats.outcome = "error"
            stats.error_message = str(e)
            return stats

    run_data = create_result.get("run", {})
    run_id = run_data.get("id")
    if not run_id:
        _err(f"No run_id in response: {json.dumps(create_result)[:200]}")
        stats.outcome = "error"
        stats.error_message = "No run_id"
        return stats

    stats.run_id = str(run_id)
    stats.rooms_total = run_data.get("rooms_total", 0)

    if verbose:
        _ok(f"Run started: {run_id}")
        _info(f"Rooms: {stats.rooms_total}, Target depth: {run_data.get('depth_target', '?')}")

    # ── Step 3: Game loop ─────────────────────────────────────────────────
    state = create_result.get("state", {})
    move_count = 0

    while move_count < MAX_MOVES_PER_RUN:
        phase = state.get("phase", "exploring")

        # Record stress snapshot
        party_stress = {}
        for agent in state.get("party", []):
            party_stress[agent.get("agent_name", "?")] = {
                "stress": agent.get("stress", 0),
                "condition": agent.get("condition", "operational"),
            }
        stats.stress_snapshots.append(party_stress)

        # Record stability for Tower runs
        archetype_st = state.get("archetype_state", {})
        if "stability" in archetype_st:
            stats.stability_snapshots.append(archetype_st["stability"])

        # Check terminal states
        if phase in ("completed", "wiped", "retreated"):
            if phase == "completed":
                stats.outcome = "completed"
            elif phase == "wiped":
                stats.outcome = "wiped"
                stats.death_cause = "party_wipe"
            elif phase == "retreated":
                stats.outcome = "abandoned"
            break

        # ── Handle distribution phase ─────────────────────────────────
        if phase == "distributing":
            if verbose:
                _info("Loot distribution phase...")
            handle_distribution(client, run_id, state, verbose)
            # After distribution, the run should be completed
            stats.outcome = "completed"
            if verbose:
                _ok("Distribution confirmed")
            break

        # ── Handle combat phase ───────────────────────────────────────
        if phase in ("combat_planning",):
            combat_stats = CombatStats()
            combat = state.get("combat", {})
            combat_stats.enemies_faced = len([e for e in combat.get("enemies", []) if e.get("is_alive")])
            combat_stats.is_boss = any(
                r.get("room_type") == "boss" and r.get("current")
                for r in state.get("rooms", [])
            )

            combat_round = 0
            rounds_without_kills = 0
            last_enemy_count = _count_alive_enemies(combat)

            while combat_round < MAX_COMBAT_ATTEMPTS:
                phase = state.get("phase", "")
                if phase != "combat_planning":
                    break

                # Stalemate breaker: if 3+ rounds with no kills, force all-attack mode
                force_attack = rounds_without_kills >= 3
                actions = choose_combat_actions(state, force_attack=force_attack)
                if verbose:
                    action_names = [a["ability_id"] for a in actions]
                    mode = " [FORCE ATTACK]" if force_attack else ""
                    _info(f"  Combat round {combat.get('round_num', '?')}: {', '.join(action_names)}{mode}")

                try:
                    combat_result = client.submit_combat(run_id, actions)
                except APIError as e:
                    _err(f"Combat submission failed: {e}")
                    stats.outcome = "error"
                    stats.error_message = f"Combat API error: {e}"
                    break

                # Check if we're waiting for other players (shouldn't happen in single player)
                if combat_result.get("waiting_for_players"):
                    # Submit empty to trigger auto-resolve
                    time.sleep(0.5)
                    try:
                        combat_result = client.submit_combat(run_id, [])
                    except APIError:
                        pass

                round_result = combat_result.get("round_result", {})
                combat_round += 1
                combat_stats.rounds = combat_round

                # Track kills for stalemate breaker
                updated_combat = combat_result.get("state", state).get("combat", combat)
                current_enemy_count = _count_alive_enemies(updated_combat)
                if current_enemy_count < last_enemy_count:
                    rounds_without_kills = 0
                    last_enemy_count = current_enemy_count
                else:
                    rounds_without_kills += 1

                if verbose and round_result:
                    events = round_result.get("events", [])
                    for evt in events:
                        if evt.get("hit"):
                            dmg = evt.get("damage", 0)
                            stress = evt.get("stress", 0)
                            _info(f"    {evt.get('actor', '?')} -> {evt.get('target', '?')}: "
                                  f"{evt.get('action', '?')} (dmg={dmg}, stress={stress})")

                # Check combat outcome
                if round_result.get("victory") or combat_result.get("victory"):
                    combat_stats.victory = True
                    stats.events.append(f"combat_victory (rounds={combat_round})")
                    if verbose:
                        _ok(f"  Victory in {combat_round} rounds!")

                    # Collect loot from victory
                    loot = combat_result.get("loot", [])
                    if loot:
                        stats.loot_dropped.extend(loot)
                        if verbose:
                            for item in loot:
                                _info(f"  Loot: {item.get('name_en', '?')} (T{item.get('tier', '?')})")
                    break

                if round_result.get("wipe") or combat_result.get("wipe"):
                    combat_stats.wipe = True
                    stats.events.append(f"party_wipe (combat_round={combat_round})")
                    if verbose:
                        _err(f"  Party wiped in round {combat_round}!")
                    break

                if round_result.get("stalemate") or combat_result.get("stalemate"):
                    combat_stats.stalemate = True
                    stats.events.append(f"stalemate (rounds={combat_round})")
                    if verbose:
                        _info(f"  Stalemate after {combat_round} rounds")
                    break

                # Get updated state for next round
                state = combat_result.get("state", state)

            stats.combats.append(combat_stats)

            # Refresh state after combat
            try:
                state = client.get_state(run_id)
            except APIError as e:
                _err(f"Failed to get state after combat: {e}")
                stats.outcome = "error"
                stats.error_message = str(e)
                break

            phase = state.get("phase", "")

            # If the run ended in combat
            if phase in ("wiped", "completed"):
                if phase == "wiped":
                    stats.outcome = "wiped"
                    stats.death_cause = "party_wipe"
                elif phase == "completed":
                    stats.outcome = "completed"
                break

            if phase == "distributing":
                # Handle distribution
                if verbose:
                    _info("Boss defeated! Entering loot distribution...")
                handle_distribution(client, run_id, state, verbose)
                stats.outcome = "completed"
                break

            # Continue exploring
            move_count += 1
            continue

        # ── Handle rest phase ─────────────────────────────────────────
        if phase == "rest":
            alive_ids = [
                a["agent_id"] for a in state.get("party", [])
                if a.get("condition") not in ("captured",)
            ]
            if alive_ids:
                try:
                    rest_result = client.rest(run_id, alive_ids)
                    if verbose:
                        if rest_result.get("ambushed"):
                            _info("  Rest ambush!")
                            stats.events.append("rest_ambush")
                        else:
                            _ok("  Rested successfully")
                            stats.events.append("rest")

                    state = rest_result.get("state", state)
                    # If ambushed, we're now in combat -- loop will handle it
                    continue
                except APIError as e:
                    if verbose:
                        _err(f"  Rest failed: {e}")

        # ── Handle encounter phase ────────────────────────────────────
        if phase == "encounter":
            # Encounters have choices from the move result; need to re-fetch state
            # and find available choices. The choices come from the move response,
            # so we need the last move_result. For simplicity, we'll try the action
            # endpoint with a generic encounter_choice.
            # Actually, encounter choices come from the move result's data.
            # We'll handle this in the move step below.
            pass

        # ── Handle exit phase ─────────────────────────────────────────
        if phase == "exit":
            # Exit rooms let us leave with partial loot
            avg_stress = 0
            alive_count = 0
            for a in state.get("party", []):
                if a.get("condition") not in ("captured",):
                    avg_stress += a.get("stress", 0)
                    alive_count += 1
            if alive_count:
                avg_stress //= alive_count

            # Retreat if stressed, otherwise continue exploring
            if avg_stress > 500:
                try:
                    retreat_result = client.retreat(run_id)
                    stats.outcome = "abandoned"
                    stats.events.append("exit_retreat")
                    loot = retreat_result.get("loot", [])
                    if loot:
                        stats.loot_dropped.extend(loot)
                    if verbose:
                        _info(f"  Retreated via exit (stress={avg_stress})")
                    break
                except APIError as e:
                    if verbose:
                        _err(f"  Retreat failed: {e}")

        # ── Explore: choose next room ─────────────────────────────────
        if phase in ("exploring", "room_clear", "exit", "encounter"):
            next_room = choose_next_room(state)
            if next_room is None:
                if verbose:
                    _err("  No valid room to move to -- retreating")
                try:
                    client.retreat(run_id)
                    stats.outcome = "abandoned"
                    stats.events.append("no_moves_retreat")
                except APIError:
                    stats.outcome = "error"
                    stats.error_message = "Stuck: no moves and retreat failed"
                break

            try:
                move_result = client.move(run_id, next_room)
                move_count += 1
                stats.total_moves = move_count

                target_room = next(
                    (r for r in state.get("rooms", []) if r["index"] == next_room),
                    {},
                )
                room_type = target_room.get("room_type", "?")

                if verbose:
                    _info(f"  Move #{move_count} -> room {next_room} ({room_type})")

                stats.events.append(f"move:{room_type}")

                # If the move entered combat, the state will reflect it
                state = move_result.get("state", state)

                # Handle encounter choices from move result
                if move_result.get("choices") and state.get("phase") in ("encounter", "rest"):
                    encounter_action = choose_encounter_action(state, move_result)
                    if encounter_action:
                        try:
                            action_result = client.submit_action(run_id, encounter_action)
                            check = action_result.get("check", {})
                            if verbose and check:
                                _info(f"    Encounter: {check.get('aptitude', '?')} "
                                      f"check -> {check.get('result', '?')}")
                            stats.events.append(f"encounter:{action_result.get('result', 'unknown')}")
                            state = action_result.get("state", state)
                        except APIError as e:
                            if verbose:
                                _err(f"    Encounter action failed: {e}")
                    elif state.get("phase") == "rest":
                        # Rest room with encounter text but we prefer to rest
                        pass

                # If move got loot (treasure room)
                if move_result.get("loot"):
                    stats.loot_dropped.extend(move_result["loot"])
                    if verbose:
                        for item in move_result["loot"]:
                            _info(f"  Treasure: {item.get('name_en', '?')} (T{item.get('tier', '?')})")

            except APIError as e:
                if "Cannot move in phase" in str(e):
                    # Might be in combat or another phase, refresh state
                    try:
                        state = client.get_state(run_id)
                    except APIError:
                        stats.outcome = "error"
                        stats.error_message = str(e)
                        break
                    continue
                _err(f"Move failed: {e}")
                stats.outcome = "error"
                stats.error_message = str(e)
                break

            continue

        # Unknown phase -- refresh state and retry
        if verbose:
            _info(f"  Unknown phase: {phase}, refreshing state...")
        try:
            state = client.get_state(run_id)
        except APIError as e:
            stats.outcome = "error"
            stats.error_message = f"State refresh failed: {e}"
            break
        move_count += 1

    # Safety: if we exhausted max moves
    if move_count >= MAX_MOVES_PER_RUN and stats.outcome == "unknown":
        stats.outcome = "abandoned"
        stats.death_cause = "max_moves_exceeded"
        stats.events.append("max_moves_retreat")
        try:
            client.retreat(run_id)
        except APIError:
            pass

    # Record final state
    try:
        final_state = client.get_state(run_id)
        stats.rooms_cleared = sum(
            1 for r in final_state.get("rooms", []) if r.get("cleared")
        )
        stats.depth_reached = final_state.get("depth", 0)

        # Track condition changes
        for agent in final_state.get("party", []):
            condition = agent.get("condition", "operational")
            if condition != "operational":
                stats.condition_changes.append(
                    f"{agent.get('agent_name', '?')}: {condition}"
                )

        # Record final stability for Tower
        final_arch = final_state.get("archetype_state", {})
        if "stability" in final_arch:
            stats.stability_snapshots.append(final_arch["stability"])
    except APIError as e:
        # Run may already be finalized (e.g. 500 after retreat) -- not fatal
        if verbose:
            warnings.warn(f"Could not fetch final state for run {run_id}: {e}", stacklevel=1)
        stats.rooms_cleared = run_data.get("rooms_cleared", 0)

    stats.duration_seconds = time.time() - start_time

    if verbose:
        icon = {
            "completed": "\033[32m[WIN]\033[0m",
            "wiped": "\033[31m[WIPE]\033[0m",
            "abandoned": "\033[33m[RETREAT]\033[0m",
            "error": "\033[31m[ERROR]\033[0m",
        }.get(stats.outcome, "[?]")
        print(f"\n  {icon} Run #{run_number}: {stats.outcome} "
              f"({stats.rooms_cleared} rooms, {len(stats.combats)} combats, "
              f"{stats.duration_seconds:.1f}s)")

    return stats


# ── Summary Report ───────────────────────────────────────────────────────────

def print_summary(all_stats: list[RunStats], archetype: str, difficulty: int) -> None:
    """Print a comprehensive summary of all playthrough statistics."""
    _heading(f"PLAYTEST SUMMARY: {archetype} (difficulty {difficulty})")

    total = len(all_stats)
    if total == 0:
        _err("No runs completed")
        return

    # Outcomes
    outcomes = Counter(s.outcome for s in all_stats)
    wins = outcomes.get("completed", 0)
    wipes = outcomes.get("wiped", 0)
    retreats = outcomes.get("abandoned", 0)
    errors = outcomes.get("error", 0)

    _subheading("Outcomes")
    print(f"  Total runs:     {total}")
    print(f"  Wins:           {wins} ({wins/total*100:.0f}%)")
    print(f"  Wipes:          {wipes} ({wipes/total*100:.0f}%)")
    print(f"  Retreats:       {retreats} ({retreats/total*100:.0f}%)")
    if errors:
        print(f"  Errors:         {errors} ({errors/total*100:.0f}%)")

    # Rooms
    successful = [s for s in all_stats if s.outcome != "error"]
    if successful:
        avg_rooms = sum(s.rooms_cleared for s in successful) / len(successful)
        max_rooms = max(s.rooms_cleared for s in successful)
        avg_depth = sum(s.depth_reached for s in successful) / len(successful)
        max_depth = max(s.depth_reached for s in successful)

        _subheading("Exploration")
        print(f"  Avg rooms cleared:  {avg_rooms:.1f}")
        print(f"  Max rooms cleared:  {max_rooms}")
        print(f"  Avg depth reached:  {avg_depth:.1f}")
        print(f"  Max depth reached:  {max_depth}")
        print(f"  Avg moves per run:  {sum(s.total_moves for s in successful) / len(successful):.1f}")

    # Combat
    all_combats = [c for s in all_stats for c in s.combats]
    if all_combats:
        total_combats = len(all_combats)
        combat_wins = sum(1 for c in all_combats if c.victory)
        combat_wipes = sum(1 for c in all_combats if c.wipe)
        combat_stalemates = sum(1 for c in all_combats if c.stalemate)
        avg_rounds = sum(c.rounds for c in all_combats) / total_combats
        max_rounds = max(c.rounds for c in all_combats)

        _subheading("Combat")
        print(f"  Total combats:      {total_combats}")
        print(f"  Combat wins:        {combat_wins} ({combat_wins/total_combats*100:.0f}%)")
        print(f"  Combat wipes:       {combat_wipes} ({combat_wipes/total_combats*100:.0f}%)")
        print(f"  Stalemates:         {combat_stalemates} ({combat_stalemates/total_combats*100:.0f}%)")
        print(f"  Avg rounds/combat:  {avg_rounds:.1f}")
        print(f"  Max rounds:         {max_rounds}")
        print(f"  Avg enemies faced:  {sum(c.enemies_faced for c in all_combats) / total_combats:.1f}")

    # Stress analysis
    final_stresses = []
    for s in all_stats:
        if s.stress_snapshots:
            last_snap = s.stress_snapshots[-1]
            for _agent_name, data in last_snap.items():
                final_stresses.append(data.get("stress", 0))

    if final_stresses:
        avg_final_stress = sum(final_stresses) / len(final_stresses)
        max_final_stress = max(final_stresses)
        stressed_count = sum(1 for s in final_stresses if s > 500)

        _subheading("Stress")
        print(f"  Avg final stress:   {avg_final_stress:.0f}")
        print(f"  Max final stress:   {max_final_stress}")
        print(f"  Agents >500 stress: {stressed_count}/{len(final_stresses)} "
              f"({stressed_count/len(final_stresses)*100:.0f}%)")

    # Stability (Tower runs only)
    all_stability = [snap for s in all_stats for snap in s.stability_snapshots]
    if all_stability:
        final_stabilities = []
        for s in all_stats:
            if s.stability_snapshots:
                final_stabilities.append(s.stability_snapshots[-1])
        if final_stabilities:
            avg_final_stab = sum(final_stabilities) / len(final_stabilities)
            min_final_stab = min(final_stabilities)
            max_final_stab = max(final_stabilities)
            critical_count = sum(1 for s in final_stabilities if s <= 20)

            _subheading("Stability (Tower)")
            print(f"  Avg final stability:  {avg_final_stab:.0f}")
            print(f"  Min final stability:  {min_final_stab}")
            print(f"  Max final stability:  {max_final_stab}")
            print(f"  Critical (<=20):      {critical_count}/{len(final_stabilities)} "
                  f"({critical_count/len(final_stabilities)*100:.0f}%)")

    # Conditions
    all_conditions = []
    for s in all_stats:
        all_conditions.extend(s.condition_changes)
    if all_conditions:
        cond_counts = Counter(c.split(": ")[1] for c in all_conditions if ": " in c)
        _subheading("Conditions (non-operational)")
        for cond, count in cond_counts.most_common():
            print(f"  {cond}: {count}")

    # Loot
    all_loot = [item for s in all_stats for item in s.loot_dropped]
    if all_loot:
        tier_counts = Counter(item.get("tier", 0) for item in all_loot)
        type_counts = Counter(item.get("effect_type", "?") for item in all_loot)

        _subheading("Loot")
        print(f"  Total items:        {len(all_loot)}")
        for tier in sorted(tier_counts.keys()):
            tier_names = {0: "None", 1: "Minor", 2: "Major", 3: "Legendary"}
            print(f"  Tier {tier} ({tier_names.get(tier, '?')}): {tier_counts[tier]}")
        print()
        for effect_type, count in type_counts.most_common():
            print(f"  {effect_type}: {count}")

    # Death causes
    death_causes = [s.death_cause for s in all_stats if s.death_cause]
    if death_causes:
        cause_counts = Counter(death_causes)
        _subheading("Death Causes")
        for cause, count in cause_counts.most_common():
            print(f"  {cause}: {count}")

    # Errors
    error_runs = [s for s in all_stats if s.outcome == "error"]
    if error_runs:
        _subheading("Errors")
        for s in error_runs:
            print(f"  Run {s.run_id[:8] if s.run_id else '?'}: {s.error_message}")

    # Timing
    durations = [s.duration_seconds for s in all_stats if s.duration_seconds > 0]
    if durations:
        _subheading("Timing")
        print(f"  Avg run duration:   {sum(durations)/len(durations):.1f}s")
        print(f"  Total time:         {sum(durations):.1f}s")
        print(f"  Fastest run:        {min(durations):.1f}s")
        print(f"  Slowest run:        {max(durations):.1f}s")

    # Event distribution
    all_events = [e for s in all_stats for e in s.events]
    if all_events:
        event_counts = Counter(all_events)
        _subheading("Event Distribution")
        for event, count in event_counts.most_common(15):
            print(f"  {event}: {count}")

    print()


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Automated Resonance Dungeon playtest runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --archetype shadow --runs 5
  %(prog)s --archetype tower --runs 20 --difficulty 3
  %(prog)s --archetype shadow --runs 10 --verbose
""",
    )
    parser.add_argument(
        "--archetype", "-a",
        choices=["shadow", "tower"],
        default="shadow",
        help="Dungeon archetype (default: shadow)",
    )
    parser.add_argument(
        "--runs", "-n",
        type=int,
        default=5,
        help="Number of playthroughs (default: 5)",
    )
    parser.add_argument(
        "--difficulty", "-d",
        type=int,
        choices=[1, 2, 3, 4, 5],
        default=None,
        help="Difficulty level 1-5 (default: use suggested from available dungeons)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print detailed per-run output",
    )
    parser.add_argument(
        "--simulation-id",
        default=SIMULATION_ID,
        help=f"Simulation UUID (default: {SIMULATION_ID})",
    )
    args = parser.parse_args()

    archetype_name = ARCHETYPE_MAP[args.archetype]

    _heading(f"Dungeon Playtest: {archetype_name}")
    _info(f"Runs: {args.runs}, Simulation: {args.simulation_id}")

    # ── Check backend health ──────────────────────────────────────────────
    try:
        health = requests.get(f"{BACKEND_URL}/api/v1/health", timeout=5)
        if health.status_code != 200:
            _err(f"Backend unhealthy: {health.status_code}")
            sys.exit(1)
        _ok("Backend is healthy")
    except requests.exceptions.ConnectionError:
        _err("Backend not reachable at http://localhost:8000")
        _info("Start with: cd backend && uvicorn backend.app:app --reload")
        sys.exit(1)

    # ── Authenticate ──────────────────────────────────────────────────────
    try:
        token = get_auth_token()
        _ok("Authenticated as dev user")
    except RuntimeError as e:
        _err(str(e))
        sys.exit(1)

    client = DungeonAPIClient(token, verbose=args.verbose)

    # ── Check available dungeons ──────────────────────────────────────────
    try:
        available = client.list_available(args.simulation_id)
    except APIError as e:
        _err(f"Failed to check available dungeons: {e}")
        _info("Run: backend/.venv/bin/python scripts/seed_dungeon_testdata.py")
        sys.exit(1)

    matching = [d for d in available if d.get("archetype") == archetype_name]
    if not matching:
        _err(f"No available dungeon for archetype '{archetype_name}'")
        _info(f"Available archetypes: {[d['archetype'] for d in available]}")
        _info("Run: backend/.venv/bin/python scripts/seed_dungeon_testdata.py")
        sys.exit(1)

    dungeon_info = matching[0]
    difficulty = args.difficulty or dungeon_info.get("suggested_difficulty", 1)

    _ok(f"Dungeon available: {archetype_name}")
    _info(f"Magnitude: {dungeon_info.get('effective_magnitude', '?')}, "
          f"Difficulty: {difficulty}, "
          f"Suggested depth: {dungeon_info.get('suggested_depth', '?')}")

    # ── Run playthroughs ──────────────────────────────────────────────────
    all_stats: list[RunStats] = []

    for i in range(1, args.runs + 1):
        print(f"\n  --- Run {i}/{args.runs} ---")
        stats = run_single_playthrough(client, archetype_name, difficulty, i, args.verbose)
        all_stats.append(stats)

        # Brief inline status
        if not args.verbose:
            icon = {"completed": "W", "wiped": "X", "abandoned": "R", "error": "E"}.get(stats.outcome, "?")
            combats = len(stats.combats)
            rooms = stats.rooms_cleared
            duration = stats.duration_seconds
            print(f"  [{icon}] rooms={rooms} combats={combats} time={duration:.1f}s")

        # Small delay between runs to let server clean up
        if i < args.runs:
            time.sleep(0.3)

    # ── Print summary ─────────────────────────────────────────────────────
    print_summary(all_stats, archetype_name, difficulty)


if __name__ == "__main__":
    main()
