"""
Shared infrastructure for epoch simulation scripts.
=====================================================
Player class, API helpers, deploy/resolve/score, setup/finish, logging,
parametric game generation, and analysis output.
"""

import json
import math
import os
import random
import subprocess
import sys
import time
from collections import defaultdict

import httpx

BASE = "http://localhost:8000"
AUTH_URL = "http://127.0.0.1:54321/auth/v1"
ANON_KEY = None

# Persistent HTTP client with connection pooling to avoid port exhaustion.
# Low limits because each of our connections also triggers a backend→GoTrue
# connection, effectively doubling the ephemeral port usage.
_http_client = httpx.Client(
    timeout=60,
    limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
    transport=httpx.HTTPTransport(retries=1),
)

ALL_SIMS = {
    "V": "10000000-0000-0000-0000-000000000001",
    "CK": "20000000-0000-0000-0000-000000000001",
    "SN": "30000000-0000-0000-0000-000000000001",
    "SP": "40000000-0000-0000-0000-000000000001",
    "NM": "50000000-0000-0000-0000-000000000001",
}
ALL_SIM_NAMES = {
    "V": "Velgarien",
    "CK": "Capybara Kingdom",
    "SN": "Station Null",
    "SP": "Speranza",
    "NM": "Nova Meridian",
}
ADMIN_EMAIL = "admin@velgarien.dev"
ADMIN_PASSWORD = "velgarien-dev-2026"


class Player:
    def __init__(self, tag, sim_id, token):
        self.tag = tag
        self.sim_id = sim_id
        self.name = ALL_SIM_NAMES[tag]
        self.token = token
        self.instance_id = None
        self.agents, self.embassies, self.buildings, self.zones = [], {}, [], []
        self.rp, self.guardians = 0, 0
        self.deployed_agents = set()

    def headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    def available_agents(self):
        return [a for a in self.agents if a["id"] not in self.deployed_agents]


# ── Global State (reset per game) ──

LOG = []
STATS = {}
SCORE_HISTORY = {}
ALL_GAME_RESULTS = []
CYCLE_ACTIONS = []
_current_cycle = 0
_current_phase = "foundation"
_active_tags = []
_current_players = {}  # tag→Player, for token refresh propagation
_game_start_time = 0   # Wall clock when game started (for timeout)


def set_active_tags(tags):
    global _active_tags
    _active_tags = tags


def reset_game_state():
    global STATS, SCORE_HISTORY, CYCLE_ACTIONS, _game_total_failures
    STATS = {k: {} for k in ["deployed", "success", "detected", "failed", "guardians", "ci_sweeps", "rp_spent"]}
    SCORE_HISTORY = {}
    CYCLE_ACTIONS = []
    _game_total_failures = 0


def log(msg):
    print(msg)
    LOG.append(msg)


def action_log(cycle, phase, player_tag, action, detail, result=""):
    CYCLE_ACTIONS.append({
        "cycle": cycle,
        "phase": phase,
        "player": player_tag,
        "action": action,
        "detail": detail,
        "result": result,
    })


# ── Port Exhaustion Monitor ──
#
# Each API call generates ~2 TCP connections (script→backend + backend→GoTrue).
# macOS has ~16k ephemeral ports with 30s TIME_WAIT. A 3P game with 20 cycles
# creates ~400 connections → 10 games = 4000 TIME_WAIT sockets. The backend's
# GoTrue connections are invisible to us, so we must be conservative.

_PORT_HIGH_WATER = 3000   # ~19% of 16k ports → intervene early (backend doubles our count)
_PORT_CRITICAL = 6000     # ~37% → aggressive wait
_consecutive_failures = 0  # Track cascading failures within a game

def _count_stuck_ports():
    """Count TIME_WAIT + CLOSE_WAIT sockets on macOS.

    CLOSE_WAIT = leaked connections (remote closed, local didn't).
    The Supabase Python client leaks CLOSE_WAIT on every set_session() call,
    which creates a new httpx client to GoTrue that never gets closed.
    These consume ephemeral ports just like TIME_WAIT.
    """
    try:
        r = subprocess.run(["netstat", "-an"], capture_output=True, text=True, timeout=5)
        tw = r.stdout.count("TIME_WAIT")
        cw = r.stdout.count("CLOSE_WAIT")
        return tw + cw, tw, cw
    except Exception:
        return 0, 0, 0

def _restart_backend():
    """Kill and restart the uvicorn backend to clear leaked CLOSE_WAIT sockets."""
    print("  🔄 Restarting backend to clear CLOSE_WAIT connections...")
    subprocess.run(["pkill", "-9", "-f", "uvicorn"], capture_output=True)
    # Also kill leaked multiprocessing workers
    subprocess.run(
        "ps aux | grep 'multiprocessing.spawn\\|multiprocessing.resource_tracker' | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null",
        shell=True, capture_output=True
    )
    time.sleep(3)
    # Start backend using venv's uvicorn
    venv_uvicorn = "/Users/mleihs/Dev/velgarien-rebuild/backend/.venv/bin/uvicorn"
    subprocess.Popen(
        [venv_uvicorn, "backend.app:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
        cwd="/Users/mleihs/Dev/velgarien-rebuild",
        stdout=open("/tmp/velgarien-backend.log", "w"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    # Wait for backend to come up
    for i in range(30):
        time.sleep(2)
        try:
            r = httpx.get("http://127.0.0.1:8000/api/v1/health", timeout=5)
            if r.status_code == 200:
                print(f"  ✓ Backend restarted (took {(i+1)*2}s)")
                return True
        except Exception:
            pass
    print("  ✗ Backend failed to restart!")
    return False

def _wait_for_ports(label=""):
    """Block until stuck sockets drop below high-water mark.
    If CLOSE_WAIT exceeds critical threshold, restart the backend.
    """
    total, tw, cw = _count_stuck_ports()
    if total < _PORT_HIGH_WATER:
        return
    print(f"  ⚠ PORT PRESSURE ({label}): {tw} TIME_WAIT + {cw} CLOSE_WAIT = {total} stuck")
    # CLOSE_WAIT can only be cleared by closing the process that holds them
    if cw >= _PORT_CRITICAL:
        _restart_backend()
        time.sleep(5)
        total, tw, cw = _count_stuck_ports()
        print(f"  After restart: {tw} TIME_WAIT + {cw} CLOSE_WAIT = {total}")
        return
    while total >= _PORT_HIGH_WATER:
        wait = 45 if total >= _PORT_CRITICAL else 20
        time.sleep(wait)
        total, tw, cw = _count_stuck_ports()
        print(f"    ... {tw} TIME_WAIT + {cw} CLOSE_WAIT = {total} remaining")
        # If CLOSE_WAIT is dominant, TIME_WAIT drain won't help — restart backend
        if cw >= _PORT_CRITICAL:
            _restart_backend()
            time.sleep(5)
            total, tw, cw = _count_stuck_ports()
            print(f"  After restart: {tw} TIME_WAIT + {cw} CLOSE_WAIT = {total}")
            return
    print(f"  ✓ Ports drained to {total} ({tw} TW + {cw} CW)")


# ── API & Auth ──

_api_call_count = 0
_game_total_failures = 0   # Total failures in current game (not reset by drain)
_GAME_FAILURE_CAP = 30     # Abort game after this many total failures

def _refresh_all_tokens():
    """Re-authenticate and update token on all active Player instances."""
    new_token = auth_login()
    for p in _current_players.values():
        p.token = new_token
    return new_token


def api(method, path, player=None, retries=2, **kwargs):
    global _api_call_count, _consecutive_failures, _game_total_failures
    _api_call_count += 1
    # Throttle: pause every call to avoid macOS ephemeral port exhaustion.
    # Backend doubles our connections (each request → GoTrue set_session() call),
    # and the Supabase client leaks CLOSE_WAIT sockets on every call.
    time.sleep(0.1)
    # Every 15 calls, check port pressure
    if _api_call_count % 15 == 0:
        _wait_for_ports(f"api call #{_api_call_count}")
    # If too many total failures in this game, the backend is toast — bail out
    if _game_total_failures >= _GAME_FAILURE_CAP:
        return {}
    # If we've had consecutive failures, back off hard — the backend is drowning
    if _consecutive_failures >= 3:
        print(f"  ⚠ {_consecutive_failures} consecutive failures — draining ports...")
        _wait_for_ports("consecutive failures")
        time.sleep(10)
        _consecutive_failures = 0
    headers = player.headers() if player else {"Content-Type": "application/json"}
    _token_refreshed = False
    for attempt in range(retries + 1):
        try:
            resp = _http_client.request(method, f"{BASE}{path}", headers=headers, **kwargs)
            if resp.status_code == 429:  # Rate limited
                wait = min(2 ** attempt, 10)
                log(f"    RATE LIMITED on {path}, waiting {wait}s...")
                time.sleep(wait)
                continue
            if resp.status_code == 401 and not _token_refreshed:
                # JWT expired mid-game — refresh all player tokens and retry
                log(f"    TOKEN EXPIRED — refreshing...")
                _refresh_all_tokens()
                _token_refreshed = True
                headers = player.headers() if player else {"Content-Type": "application/json"}
                time.sleep(1)
                continue
            if resp.status_code >= 500:
                _consecutive_failures += 1
                _game_total_failures += 1
                if attempt < retries:
                    time.sleep(3 + attempt * 3)  # 3s, 6s backoff
                    _wait_for_ports(f"500 on {path}")
                    continue
                log(f"    API ERROR {resp.status_code}: {method} {path}: {resp.text[:200]}")
                return {}
            if resp.status_code >= 400:
                _consecutive_failures += 1
                _game_total_failures += 1
                if attempt < retries:
                    time.sleep(1)
                    continue
                log(f"    API ERROR {resp.status_code}: {method} {path}: {resp.text[:200]}")
                return {}
            _consecutive_failures = 0  # Reset on success
            return resp.json()
        except httpx.ConnectError:
            _consecutive_failures += 1
            _game_total_failures += 1
            if attempt < retries:
                _wait_for_ports(f"ConnectError on {path}")
                time.sleep(5)
                continue
            log(f"    PORT EXHAUSTION: {method} {path}")
            return {}
        except Exception as e:
            _consecutive_failures += 1
            _game_total_failures += 1
            if attempt < retries:
                time.sleep(2)
                continue
            log(f"    API EXCEPTION: {method} {path}: {e}")
            return {}
    return {}


def auth_login():
    global ANON_KEY, _http_client
    if not ANON_KEY:
        r = subprocess.run(["supabase", "status", "--output", "json"],
                           capture_output=True, text=True, cwd="/Users/mleihs/Dev/velgarien-rebuild")
        s = json.loads(r.stdout)
        ANON_KEY = s.get("ANON_KEY") or s.get("anon_key") or s.get("API_KEY")
    for attempt in range(10):
        try:
            resp = _http_client.post(f"{AUTH_URL}/token?grant_type=password",
                              json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                              headers={"apikey": ANON_KEY, "Content-Type": "application/json"})
            if resp.status_code != 200:
                if attempt < 9:
                    time.sleep(3)
                    continue
                sys.exit(f"Auth failed: {resp.text[:200]}")
            return resp.json()["access_token"]
        except Exception as e:
            if attempt < 9:
                wait = min(10 + attempt * 5, 45)  # 10s, 15s, 20s, ... up to 45s
                print(f"  Auth attempt {attempt+1} failed: {e}, waiting {wait}s...")
                _wait_for_ports(f"auth retry {attempt+1}")
                time.sleep(wait)
                # Recycle client on persistent connection errors
                if attempt >= 3:
                    _http_client.close()
                    time.sleep(5)
                    _http_client = httpx.Client(
                        timeout=60,
                        limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
                        transport=httpx.HTTPTransport(retries=1),
                    )
                continue
            sys.exit(f"Auth failed after 10 attempts: {e}")


def init_stats(tag):
    for d in STATS.values():
        d.setdefault(tag, 0)
    SCORE_HISTORY.setdefault(tag, [])


def _psql(sql):
    """Run SQL via docker exec (same pattern as force_expire)."""
    return subprocess.run(
        ["docker", "exec", "supabase_db_velgarien-rebuild", "psql", "-U", "postgres", "-c", sql],
        capture_output=True, text=True,
    )


def ensure_nm_simulation():
    """Create Nova Meridian simulation + admin membership if missing.

    NM is a test-only 5th simulation used by the simulation suite.
    It's not in any migration — this function makes the suite self-healing.
    """
    nm_id = ALL_SIMS["NM"]
    # Create simulation if missing
    _psql(f"""
        INSERT INTO simulations (id, name, slug, description, simulation_type)
        VALUES ('{nm_id}', 'Nova Meridian', 'nova-meridian',
                'Test simulation for 5-player epoch simulations', 'template')
        ON CONFLICT (id) DO NOTHING;
    """)
    # Ensure admin owns it
    _psql(f"""
        INSERT INTO simulation_members (simulation_id, user_id, member_role)
        SELECT '{nm_id}', u.id, 'owner'
        FROM auth.users u WHERE u.email = '{ADMIN_EMAIL}'
        ON CONFLICT DO NOTHING;
    """)
    # Ensure it has at least 6 agents (needed for game instance cloning)
    result = _psql(f"SELECT count(*) FROM agents WHERE simulation_id = '{nm_id}';")
    agent_count = 0
    try:
        agent_count = int(result.stdout.strip().split('\n')[2].strip())
    except (IndexError, ValueError):
        pass
    if agent_count < 6:
        for i in range(agent_count, 6):
            _psql(f"""
                INSERT INTO agents (simulation_id, name, background)
                VALUES ('{nm_id}', 'NM Agent {i+1}', 'Test agent for Nova Meridian')
                ON CONFLICT DO NOTHING;
            """)
    # Ensure it has zones (needed for security level normalization)
    result = _psql(f"SELECT count(*) FROM zones WHERE simulation_id = '{nm_id}';")
    zone_count = 0
    try:
        zone_count = int(result.stdout.strip().split('\n')[2].strip())
    except (IndexError, ValueError):
        pass
    if zone_count < 4:
        # Need a city first
        _psql(f"""
            INSERT INTO cities (simulation_id, name)
            SELECT '{nm_id}', 'Nova Prime'
            WHERE NOT EXISTS (SELECT 1 FROM cities WHERE simulation_id = '{nm_id}');
        """)
        city_id_result = _psql(f"SELECT id FROM cities WHERE simulation_id = '{nm_id}' LIMIT 1;")
        try:
            city_id = city_id_result.stdout.strip().split('\n')[2].strip()
        except (IndexError, ValueError):
            city_id = None
        if city_id:
            zone_names = ["Sector Alpha", "Sector Beta", "Sector Gamma", "Sector Delta"]
            levels = ["high", "medium", "medium", "low"]
            for j in range(zone_count, 4):
                _psql(f"""
                    INSERT INTO zones (simulation_id, city_id, name, security_level)
                    VALUES ('{nm_id}', '{city_id}', '{zone_names[j]}', '{levels[j]}');
                """)
    print(f"  NM simulation ensured: {nm_id}")


# ── Mission Operations ──

def force_expire(epoch_id):
    subprocess.run(["docker", "exec", "supabase_db_velgarien-rebuild", "psql", "-U", "postgres", "-c",
                    f"UPDATE operative_missions SET resolves_at = NOW() - INTERVAL '1 hour' "
                    f"WHERE epoch_id = '{epoch_id}' AND status IN ('deploying', 'active') "
                    f"AND operative_type != 'guardian';"], capture_output=True, text=True)


def deploy(epoch_id, player, op_type, target_tag, players,
           target_entity_id=None, target_entity_type=None):
    global _current_cycle, _current_phase
    avail = player.available_agents()
    if not avail:
        action_log(_current_cycle, _current_phase, player.tag,
                   f"deploy_{op_type}", "No agents available", "SKIP")
        return None
    agent_name = avail[0].get("name", "?")
    body = {"agent_id": avail[0]["id"], "operative_type": op_type}
    if op_type == "guardian":
        body["target_simulation_id"] = None
        detail = f"{agent_name} as guardian (RP:{player.rp})"
    else:
        target = players[target_tag]
        body["target_simulation_id"] = target.instance_id
        emb = player.embassies.get(target.instance_id)
        if not emb:
            action_log(_current_cycle, _current_phase, player.tag,
                       f"deploy_{op_type}", f"No embassy to {target_tag}", "SKIP")
            return None
        body["embassy_id"] = emb
        if target_entity_id:
            body["target_entity_id"] = target_entity_id
            body["target_entity_type"] = target_entity_type
        detail = f"{agent_name} → {target_tag} ({op_type}, RP:{player.rp})"

    resp = api("POST", f"/api/v1/epochs/{epoch_id}/operatives?simulation_id={player.instance_id}",
               player, json=body)
    mission = resp.get("data")
    if mission:
        player.deployed_agents.add(avail[0]["id"])
        cost = mission.get("cost_rp", 0)
        prob = mission.get("success_probability", "?")
        STATS["deployed"][player.tag] += 1
        STATS["rp_spent"][player.tag] += cost
        if op_type == "guardian":
            STATS["guardians"][player.tag] += 1
            player.guardians += 1
            action_log(_current_cycle, _current_phase, player.tag,
                       "deploy_guardian", detail, f"OK cost={cost}")
        else:
            action_log(_current_cycle, _current_phase, player.tag,
                       f"deploy_{op_type}", detail, f"OK cost={cost} prob={prob}")
        log(f"    {player.tag}: {op_type} {agent_name}→{target_tag or 'self'} cost={cost} prob={prob}")
    else:
        err = resp.get("detail", "unknown error")
        action_log(_current_cycle, _current_phase, player.tag,
                   f"deploy_{op_type}", detail, f"FAIL: {err}")
        log(f"    {player.tag}: {op_type} FAILED — {err}")
    return mission


def counter_intel(epoch_id, player):
    resp = api("POST", f"/api/v1/epochs/{epoch_id}/operatives/counter-intel?simulation_id={player.instance_id}", player)
    STATS["ci_sweeps"][player.tag] += 1
    STATS["rp_spent"][player.tag] += 3
    caught = resp.get("data", [])
    action_log(_current_cycle, _current_phase, player.tag,
               "counter_intel", f"Sweep (RP:{player.rp}→{player.rp-3})",
               f"caught={len(caught)}")
    log(f"    {player.tag}: counter-intel sweep → caught {len(caught)}")
    return caught


def resolve_and_score(epoch_id, admin, cycle, players):
    global _current_cycle
    _current_cycle = cycle
    force_expire(epoch_id)
    time.sleep(0.15)

    resp = api("POST", f"/api/v1/epochs/{epoch_id}/operatives/resolve", admin)
    outcomes_by_tag = defaultdict(list)
    for m in resp.get("data", []):
        mr = m.get("mission_result") or {}
        outcome = mr.get("outcome", m.get("status", "?"))
        source = m.get("source_simulation_id", "")
        op_type = m.get("operative_type", "?")
        prob = mr.get("success_probability", m.get("success_probability", "?"))
        tag = next((t for t, p in players.items() if p.instance_id == source), None)
        if not tag:
            continue

        target_sim = m.get("target_simulation_id", "")
        target_tag = next((t for t, p in players.items() if p.instance_id == target_sim), "?")

        if outcome == "success":
            STATS["success"][tag] += 1
            effect = mr.get("effect_description", "")
            action_log(cycle, "resolve", tag, f"outcome_{op_type}",
                       f"→{target_tag} prob={prob}", f"SUCCESS {effect}")
        elif outcome == "detected":
            STATS["detected"][tag] += 1
            action_log(cycle, "resolve", tag, f"outcome_{op_type}",
                       f"→{target_tag} prob={prob}", "DETECTED (-2 mil)")
        elif outcome == "failed":
            STATS["failed"][tag] += 1
            action_log(cycle, "resolve", tag, f"outcome_{op_type}",
                       f"→{target_tag} prob={prob}", "FAILED (undetected)")
        else:
            action_log(cycle, "resolve", tag, f"outcome_{op_type}",
                       f"→{target_tag} prob={prob}", f"{outcome}")

        outcomes_by_tag[tag].append(f"{op_type}→{target_tag}:{outcome}")

        if m.get("status") in ("success", "failed", "detected", "captured"):
            for p in players.values():
                p.deployed_agents.discard(m.get("agent_id"))

    for tag, outs in outcomes_by_tag.items():
        log(f"    resolve {tag}: {', '.join(outs)}")

    resp = api("POST", f"/api/v1/epochs/{epoch_id}/scores/compute?cycle={cycle}", admin)
    for s in resp.get("data", []):
        sim_id = s.get("simulation_id", "")
        tag = next((t for t, p in players.items() if p.instance_id == sim_id), None)
        if tag:
            sd = {d: s.get(f"{d}_score", 0) for d in ["stability", "influence", "sovereignty", "diplomatic", "military"]}
            sd["composite"] = s.get("composite_score", 0)
            SCORE_HISTORY[tag].append((cycle, sd))
            action_log(cycle, "score", tag, "score",
                       f"stab={sd['stability']:.1f} inf={sd['influence']:.1f} sov={sd['sovereignty']:.1f} "
                       f"dip={sd['diplomatic']:.1f} mil={sd['military']:.1f}",
                       f"composite={sd['composite']:.2f}")

    api("POST", f"/api/v1/epochs/{epoch_id}/resolve-cycle", admin)
    parts = api("GET", f"/api/v1/epochs/{epoch_id}/participants", admin)
    part_map = {p["simulation_id"]: p for p in (parts.get("data") or [])}
    for tag, p in players.items():
        if p.instance_id in part_map:
            old_rp = p.rp
            p.rp = part_map[p.instance_id].get("current_rp", 0)
            if p.rp != old_rp:
                action_log(cycle, "rp_grant", tag, "rp_update",
                           f"RP: {old_rp}→{p.rp}", f"+{p.rp - old_rp}")


def reachable_target(player, targets, players):
    for t in targets:
        if players[t].instance_id in player.embassies:
            return t
    return None


def api_join_team(epoch_id, players, joiner_tag, leader_tag):
    """Join a player to an existing team led by another player."""
    resp = api("GET", f"/api/v1/epochs/{epoch_id}/teams", players[leader_tag])
    teams = resp.get("data", [])
    if teams:
        tid = teams[0]["id"]
        api("POST", f"/api/v1/epochs/{epoch_id}/teams/{tid}/join?simulation_id={players[joiner_tag].sim_id}",
            players[joiner_tag])


# ── Game Setup & Finish ──

def setup_game(token, name, config, tags, alliances=None):
    global _current_players, _game_start_time
    _game_start_time = time.time()
    players = {}
    for tag in tags:
        p = Player(tag, ALL_SIMS[tag], token)
        init_stats(tag)
        players[tag] = p
    _current_players = players  # Register for token refresh propagation
    admin = players[tags[0]]

    resp = api("POST", "/api/v1/epochs", admin, json={"name": name, "description": name, "config": config})
    if not resp.get("data"):
        log(f"  FATAL: Failed to create epoch '{name}': {resp}")
        return None, players, admin
    epoch_id = resp["data"]["id"]

    for tag, p in players.items():
        api("POST", f"/api/v1/epochs/{epoch_id}/participants", p, json={"simulation_id": p.sim_id})

    if alliances:
        for team_name, members in alliances.items():
            creator = members[0]
            resp = api("POST", f"/api/v1/epochs/{epoch_id}/teams?simulation_id={players[creator].sim_id}",
                       players[creator], json={"name": team_name})
            tid = resp.get("data", {}).get("id")
            if tid:
                for joiner in members[1:]:
                    api("POST", f"/api/v1/epochs/{epoch_id}/teams/{tid}/join?simulation_id={players[joiner].sim_id}", players[joiner])

    api("POST", f"/api/v1/epochs/{epoch_id}/start", admin)

    parts = api("GET", f"/api/v1/epochs/{epoch_id}/participants", admin)
    part_map = {p["simulation_id"]: p for p in (parts.get("data") or [])}
    for tag, p in players.items():
        for sim_id, part in part_map.items():
            sim_name = part.get("simulations", {}).get("name", "")
            if p.name in sim_name:
                p.instance_id = sim_id
                p.rp = part.get("current_rp", 0)
                break
        if not p.instance_id:
            log(f"  WARNING: Could not find instance for {tag}")
            continue
        p.agents = api("GET", f"/api/v1/simulations/{p.instance_id}/agents?limit=10", p).get("data", [])
        p.buildings = api("GET", f"/api/v1/simulations/{p.instance_id}/buildings?limit=10", p).get("data", [])
        for e in api("GET", f"/api/v1/simulations/{p.instance_id}/embassies", p).get("data", []):
            sa, sb = e.get("simulation_a_id"), e.get("simulation_b_id")
            if sa == p.instance_id: p.embassies[sb] = e["id"]
            elif sb == p.instance_id: p.embassies[sa] = e["id"]

    # Validate all players got instance IDs
    for tag, p in players.items():
        if not p.instance_id:
            log(f"  FATAL: Player {tag} has no instance_id after setup")

    emb_counts = {t: len(p.embassies) for t, p in players.items()}
    agent_counts = {t: len(p.agents) for t, p in players.items()}
    log(f"  Setup: {name}")
    log(f"    Embassies: {emb_counts} | Agents: {agent_counts}")
    return epoch_id, players, admin


def shorten_name(name):
    for sn in ALL_SIM_NAMES.values():
        if sn in name:
            return sn
    return name


def finish_game(epoch_id, admin, players, game_name, game_desc, tags):
    for _ in range(3):
        resp = api("POST", f"/api/v1/epochs/{epoch_id}/advance", admin)
        if resp.get("data", {}).get("status") == "completed":
            break

    resp = api("GET", f"/api/v1/epochs/{epoch_id}/scores/leaderboard", admin)
    leaderboard = resp.get("data", [])

    result = {
        "name": game_name,
        "desc": game_desc,
        "epoch_id": epoch_id,
        "leaderboard": leaderboard,
        "stats": {k: dict(v) for k, v in STATS.items()},
        "scores": {t: list(h) for t, h in SCORE_HISTORY.items()},
        "actions": list(CYCLE_ACTIONS),
        "tags": tags,
    }
    ALL_GAME_RESULTS.append(result)

    log(f"\n  LEADERBOARD — {game_name}:")
    for e in leaderboard:
        name = shorten_name(e.get("simulation_name", "?"))
        log(f"    #{e.get('rank')} {name}: {e.get('composite', 0):.1f}")
    log(f"  STATS:")
    for tag in tags:
        s = STATS["success"].get(tag, 0)
        d = STATS["detected"].get(tag, 0)
        f = STATS["failed"].get(tag, 0)
        total = s + d + f
        rate = f"{s}/{total} ({100*s/total:.0f}%)" if total else "0/0"
        log(f"    {tag}: deployed={STATS['deployed'].get(tag,0)} success={rate} "
            f"guards={STATS['guardians'].get(tag,0)} ci={STATS['ci_sweeps'].get(tag,0)}")

    return result


# ── Phase Runners ──

def run_foundation(epoch_id, players, admin, guardian_counts, cycles=3):
    global _current_phase, _current_cycle
    _current_phase = "foundation"
    log(f"\n  FOUNDATION (cycles 1-{cycles}):")
    for cycle in range(1, cycles + 1):
        _current_cycle = cycle
        for tag, count in guardian_counts.items():
            while players[tag].guardians < count and players[tag].available_agents():
                deploy(epoch_id, players[tag], "guardian", None, players)
        resolve_and_score(epoch_id, admin, cycle, players)
    api("POST", f"/api/v1/epochs/{epoch_id}/advance", admin)
    return cycles


_GAME_TIMEOUT = 1800  # 30 minutes max per game


def _check_game_abort():
    """Return True if the current game should be aborted (timeout or too many failures)."""
    if _game_start_time and (time.time() - _game_start_time) > _GAME_TIMEOUT:
        elapsed = int(time.time() - _game_start_time)
        log(f"  ⏰ GAME TIMEOUT after {elapsed}s — aborting")
        return True
    if _game_total_failures >= _GAME_FAILURE_CAP:
        log(f"  ❌ GAME FAILURE CAP ({_game_total_failures} failures) — aborting")
        return True
    return False


def run_competition(epoch_id, players, admin, start_cycle, end_cycle, strategy_fn):
    global _current_phase, _current_cycle
    _current_phase = "competition"
    for cycle in range(start_cycle, end_cycle + 1):
        if _check_game_abort():
            return
        _current_cycle = cycle
        strategy_fn(epoch_id, players, cycle)
        resolve_and_score(epoch_id, admin, cycle, players)
    api("POST", f"/api/v1/epochs/{epoch_id}/advance", admin)


def run_reckoning(epoch_id, players, admin, start_cycle, end_cycle, strategy_fn):
    global _current_phase, _current_cycle
    _current_phase = "reckoning"
    for cycle in range(start_cycle, end_cycle + 1):
        if _check_game_abort():
            return
        _current_cycle = cycle
        strategy_fn(epoch_id, players, cycle)
        resolve_and_score(epoch_id, admin, cycle, players)


# ── Parametric Game Generation ──

# Operative costs
OP_COSTS = {"spy": 3, "propagandist": 4, "saboteur": 5, "infiltrator": 6, "assassin": 8, "guardian": 0}

# Strategy archetypes for random game generation
STRATEGY_PRESETS = [
    "balanced",       # Mix of all ops
    "spy_heavy",      # Focus on spies + occasional sab
    "saboteur_heavy", # Focus on saboteurs
    "assassin_rush",  # Expensive assassin ops
    "propagandist",   # Propaganda + spy
    "ci_defensive",   # Counter-intel every cycle + light offense
    "all_out",        # Whatever the most expensive op RP allows
    "infiltrator",    # Infiltrators + spies
    "econ_build",     # Save RP, sparse high-value ops
    "random_mix",     # Random op type each cycle
]


def pick_op_for_strategy(strategy, cycle, rp, target_player):
    """Pick an operative type based on strategy preset and current state."""
    has_buildings = bool(target_player.buildings)
    has_agents = bool(target_player.agents)

    if strategy == "balanced":
        ops = ["spy", "propagandist", "saboteur"]
        if rp >= 8 and has_agents:
            ops.append("assassin")
        return ops[cycle % len(ops)]
    elif strategy == "spy_heavy":
        if cycle % 4 == 0 and rp >= 5 and has_buildings:
            return "saboteur"
        return "spy"
    elif strategy == "saboteur_heavy":
        if has_buildings and rp >= 5:
            return "saboteur"
        return "spy"
    elif strategy == "assassin_rush":
        if rp >= 8 and has_agents:
            return "assassin"
        if rp >= 5 and has_buildings:
            return "saboteur"
        return "spy"
    elif strategy == "propagandist":
        if cycle % 2 == 0 and rp >= 4:
            return "propagandist"
        return "spy"
    elif strategy == "ci_defensive":
        # CI handled separately; this is the offense part
        if cycle % 3 == 0 and rp >= 5 and has_buildings:
            return "saboteur"
        return "spy"
    elif strategy == "all_out":
        if rp >= 8 and has_agents:
            return "assassin"
        if rp >= 6:
            return "infiltrator"
        if rp >= 5 and has_buildings:
            return "saboteur"
        if rp >= 4:
            return "propagandist"
        return "spy"
    elif strategy == "infiltrator":
        if rp >= 6:
            return "infiltrator"
        return "spy"
    elif strategy == "econ_build":
        if cycle % 3 != 0:
            return None  # Skip — save RP
        if rp >= 8 and has_agents:
            return "assassin"
        if rp >= 5 and has_buildings:
            return "saboteur"
        return "spy"
    elif strategy == "random_mix":
        candidates = ["spy"]
        if rp >= 4:
            candidates.append("propagandist")
        if rp >= 5 and has_buildings:
            candidates.append("saboteur")
        if rp >= 6:
            candidates.append("infiltrator")
        if rp >= 8 and has_agents:
            candidates.append("assassin")
        return random.choice(candidates)
    return "spy"


def random_score_weights():
    """Generate random score weights summing to 100."""
    dims = ["stability", "influence", "sovereignty", "diplomatic", "military"]
    # Start with minimum 5 per dimension, distribute rest randomly
    weights = [5] * 5
    remaining = 75  # 100 - 25 minimum
    for i in range(4):
        add = random.randint(0, remaining)
        weights[i] += add
        remaining -= add
    weights[4] += remaining
    random.shuffle(weights)
    return dict(zip(dims, weights))


def generate_game_config(game_num, player_count, rng):
    """Generate a parametric game configuration."""
    rp_per_cycle = rng.choice([10, 12, 15, 18, 20, 25])
    rp_cap = rng.choice([40, 50, 60, 75])
    guardian_range = (0, min(3, 6 - player_count + 1))  # fewer guards with more players
    score_weights = random_score_weights()

    # Validate weights sum to 100
    weight_sum = sum(score_weights.values())
    assert weight_sum == 100, f"Score weights must sum to 100, got {weight_sum}: {score_weights}"

    config = {
        "rp_per_cycle": rp_per_cycle,
        "rp_cap": rp_cap,
        "cycle_hours": 2,
        "duration_days": 14,
        "foundation_pct": rng.choice([10, 15, 20]),
        "reckoning_pct": rng.choice([10, 15, 20]),
        "max_team_size": rng.choice([2, 3, 4]),
        "allow_betrayal": rng.choice([True, False]),
        "score_weights": score_weights,
    }

    return config, guardian_range


def generate_parametric_game(game_num, player_count, all_tags, rng):
    """Generate a complete parametric game definition."""
    # Pick players
    tags = list(rng.sample(all_tags, player_count))

    config, guardian_range = generate_game_config(game_num, player_count, rng)

    # Guardian counts per player (capped at 4 to preserve offensive capability)
    guardian_counts = {tag: min(rng.randint(guardian_range[0], guardian_range[1]), 4) for tag in tags}

    # Strategy per player
    strategies = {tag: rng.choice(STRATEGY_PRESETS) for tag in tags}

    # CI frequency per player (0=never, 1=every cycle, 2=every other, 3=every third)
    ci_freq = {}
    for tag in tags:
        if strategies[tag] == "ci_defensive":
            ci_freq[tag] = 1  # Every cycle
        else:
            ci_freq[tag] = rng.choice([0, 0, 0, 2, 3])  # Mostly never

    # Alliance setup (random)
    alliances = None
    if player_count >= 3 and rng.random() < 0.3:
        # 30% chance of an alliance
        alliance_members = rng.sample(tags, 2)
        alliances = {f"Alliance-{game_num}": alliance_members}

    # Foundation cycles
    foundation_cycles = rng.choice([2, 3, 3, 4])
    # Competition end cycle
    comp_end = rng.choice([14, 16, 16, 18])
    # Reckoning cycles
    reck_end = comp_end + rng.choice([3, 4, 4, 5])

    # Build description
    guard_str = "/".join([f"{t}={guardian_counts[t]}g" for t in tags])
    strat_str = "/".join([f"{t}={strategies[t]}" for t in tags])
    w = config["score_weights"]
    weight_str = f"s{w['stability']}i{w['influence']}v{w['sovereignty']}d{w['diplomatic']}m{w['military']}"
    desc = f"RP:{config['rp_per_cycle']}/{config['rp_cap']} {guard_str} {weight_str} {strat_str}"
    if alliances:
        desc += f" alliance={list(alliances.values())[0]}"

    name = f"G{game_num}: {'+'.join(tags)} {weight_str}"

    return {
        "name": name,
        "desc": desc,
        "tags": tags,
        "config": config,
        "guardian_counts": guardian_counts,
        "strategies": strategies,
        "ci_freq": ci_freq,
        "alliances": alliances,
        "foundation_cycles": foundation_cycles,
        "comp_end": comp_end,
        "reck_end": reck_end,
    }


def run_parametric_game(token, game_def):
    """Execute a single parametric game."""
    reset_game_state()
    tags = game_def["tags"]
    epoch_id, players, admin = setup_game(
        token, game_def["name"], game_def["config"], tags, game_def.get("alliances"))

    if epoch_id is None:
        log(f"  SKIPPING game — setup failed")
        return None

    # Foundation
    last = run_foundation(epoch_id, players, admin,
                          game_def["guardian_counts"], game_def["foundation_cycles"])

    strategies = game_def["strategies"]
    ci_freq = game_def["ci_freq"]

    def strategy_fn(eid, pl, cyc):
        for tag in tags:
            # Counter-intel
            freq = ci_freq.get(tag, 0)
            if freq > 0 and cyc % freq == 0 and pl[tag].rp >= 3:
                counter_intel(eid, pl[tag])

            # Pick target (round-robin among reachable enemies)
            others = [t for t in tags if t != tag]
            random.shuffle(others)
            t = reachable_target(pl[tag], others, pl)
            if not t:
                continue

            op = pick_op_for_strategy(strategies[tag], cyc, pl[tag].rp, pl[t])
            if op is None:
                continue  # econ_build skip

            cost = OP_COSTS.get(op, 3)
            if pl[tag].rp < cost:
                if pl[tag].rp >= 3:
                    op = "spy"  # Fallback to cheapest
                else:
                    continue

            target_entity_id = None
            target_entity_type = None
            if op == "saboteur" and pl[t].buildings:
                idx = cyc % len(pl[t].buildings)
                target_entity_id = pl[t].buildings[idx]["id"]
                target_entity_type = "building"
            elif op == "assassin" and pl[t].agents:
                avail_targets = [a for a in pl[t].agents if a["id"] not in pl[t].deployed_agents]
                if avail_targets:
                    target_entity_id = avail_targets[0]["id"]
                    target_entity_type = "agent"
                else:
                    op = "spy"  # No valid target, fallback

            deploy(eid, pl[tag], op, t, pl, target_entity_id, target_entity_type)

    comp_end = game_def["comp_end"]
    reck_end = game_def["reck_end"]
    run_competition(epoch_id, players, admin, last + 1, comp_end, strategy_fn)
    run_reckoning(epoch_id, players, admin, comp_end + 1, reck_end, strategy_fn)

    return finish_game(epoch_id, admin, players, game_def["name"],
                       game_def["desc"], tags)


# ── Analysis Generation ──

def generate_analysis(output_path, title, player_count, include_actions=False):
    """Generate markdown analysis. Set include_actions=False for 60-game runs (too large)."""
    tags = _active_tags
    lines = [
        f"# Epoch {player_count}-Player Simulation: {len(ALL_GAME_RESULTS)}-Game Analysis",
        "",
        f"> Simulated on 2026-02-28 (local API)",
        f"> Games played: {len(ALL_GAME_RESULTS)}",
        f"> Players per game: {player_count}",
        "",
    ]

    # Summary Table
    lines += ["## Summary Table", "",
              "| # | Game | Winner | Score | Runner-Up | Score | Margin |",
              "|---|------|--------|-------|-----------|-------|--------|"]

    win_counts = defaultdict(int)
    margins = []
    total_stats = {k: defaultdict(int) for k in ["deployed", "success", "detected", "failed", "guardians", "ci_sweeps", "rp_spent"]}
    all_composites = defaultdict(list)
    all_dim_scores = defaultdict(lambda: defaultdict(list))
    games_played = defaultdict(int)

    for i, g in enumerate(ALL_GAME_RESULTS, 1):
        lb = g["leaderboard"]
        game_tags = g.get("tags", tags)
        if len(lb) >= 2:
            w_name = shorten_name(lb[0].get("simulation_name", "?"))
            r_name = shorten_name(lb[1].get("simulation_name", "?"))
            w_score = lb[0].get("composite", 0)
            r_score = lb[1].get("composite", 0)
            margin = w_score - r_score
            margins.append(margin)
            win_counts[w_name] += 1
            lines.append(f"| {i} | {g['name'][:40]} | {w_name} | {w_score:.1f} | {r_name} | {r_score:.1f} | {margin:.1f} |")

            for e in lb:
                name = shorten_name(e.get("simulation_name", "?"))
                all_composites[name].append(e.get("composite", 0))
                for d in ["stability", "influence", "sovereignty", "diplomatic", "military"]:
                    all_dim_scores[name][d].append(e.get(d, 0))
        elif len(lb) == 1:
            w_name = shorten_name(lb[0].get("simulation_name", "?"))
            win_counts[w_name] += 1
            lines.append(f"| {i} | {g['name'][:40]} | {w_name} | {lb[0].get('composite', 0):.1f} | - | - | - |")
        else:
            lines.append(f"| {i} | {g['name'][:40]} | *(empty leaderboard)* | - | - | - | - |")

        for tag in game_tags:
            games_played[tag] += 1
            for k in total_stats:
                total_stats[k][tag] += g["stats"].get(k, {}).get(tag, 0)

    # Win Distribution
    all_names = set()
    for g in ALL_GAME_RESULTS:
        for t in g.get("tags", []):
            all_names.add(ALL_SIM_NAMES.get(t, t))

    lines += ["", "## Win Distribution", "",
              "| Simulation | Wins | Games | Win Rate |", "|-----------|------|-------|----------|"]
    tag_by_name = {v: k for k, v in ALL_SIM_NAMES.items()}
    for name in sorted(all_names):
        tag = tag_by_name.get(name, "")
        gp = games_played.get(tag, 0)
        wins = win_counts.get(name, 0)
        rate = f"{100*wins/gp:.0f}%" if gp > 0 else "N/A"
        lines.append(f"| {name} | {wins} | {gp} | {rate} |")

    # Victory Margins
    if margins:
        lines += ["", "## Victory Margins", "",
                  f"- **Mean margin:** {sum(margins)/len(margins):.1f}",
                  f"- **Median margin:** {sorted(margins)[len(margins)//2]:.1f}",
                  f"- **Min margin:** {min(margins):.1f}",
                  f"- **Max margin:** {max(margins):.1f}",
                  f"- **Close games (margin < 5):** {sum(1 for m in margins if m < 5)}/{len(margins)} ({100*sum(1 for m in margins if m < 5)/len(margins):.0f}%)",
                  ]

    # Average Score by Dimension
    lines += ["", "## Average Scores by Dimension", "",
              "| Simulation | Avg Composite | Avg Stab | Avg Inf | Avg Sov | Avg Dip | Avg Mil |",
              "|-----------|--------------|----------|---------|---------|---------|---------|"]
    for name in sorted(all_names):
        comps = all_composites.get(name, [])
        if not comps:
            continue
        avg_comp = sum(comps) / len(comps)
        dims = {}
        for d in ["stability", "influence", "sovereignty", "diplomatic", "military"]:
            vals = all_dim_scores[name][d]
            dims[d] = sum(vals) / len(vals) if vals else 0
        lines.append(f"| {name} | {avg_comp:.1f} | {dims['stability']:.0f} | {dims['influence']:.0f} "
                    f"| {dims['sovereignty']:.0f} | {dims['diplomatic']:.0f} | {dims['military']:.0f} |")

    # Aggregate Mission Stats
    lines += ["", "## Aggregate Mission Statistics", "",
              "| Simulation | Games | Deployed | Success | Detected | Failed | Success Rate | CI | RP Spent |",
              "|-----------|-------|----------|---------|----------|--------|-------------|-----|----------|"]
    for tag in sorted(total_stats["deployed"].keys()):
        dep = total_stats["deployed"][tag]
        suc = total_stats["success"][tag]
        det = total_stats["detected"][tag]
        fail = total_stats["failed"][tag]
        total = suc + det + fail
        rate = f"{100*suc/total:.0f}%" if total > 0 else "N/A"
        gp = games_played.get(tag, 0)
        lines.append(f"| {ALL_SIM_NAMES.get(tag, tag)} | {gp} | {dep} | {suc} | {det} | {fail} | {rate} "
                     f"| {total_stats['ci_sweeps'][tag]} | {total_stats['rp_spent'][tag]} |")

    # Score Dimension Analysis
    lines += ["", "## Score Dimension Analysis", "",
              "Shows whether each scoring dimension differentiates players or stays flat.", ""]

    all_dim_values = defaultdict(list)
    for g in ALL_GAME_RESULTS:
        for e in g["leaderboard"]:
            for d in ["stability", "influence", "sovereignty", "diplomatic", "military"]:
                all_dim_values[d].append(e.get(d, 0))

    lines.append("| Dimension | Mean | Std Dev | Min | Max | Always Same? |")
    lines.append("|-----------|------|---------|-----|-----|-------------|")
    for d in ["stability", "influence", "sovereignty", "diplomatic", "military"]:
        vals = all_dim_values[d]
        if vals:
            mean = sum(vals) / len(vals)
            variance = sum((v - mean) ** 2 for v in vals) / len(vals)
            std = math.sqrt(variance)
            mn, mx = min(vals), max(vals)
            flat = "YES — INERT" if std < 1.0 else ("mostly" if std < 5.0 else "no")
            lines.append(f"| {d} | {mean:.1f} | {std:.1f} | {mn:.0f} | {mx:.0f} | {flat} |")

    # Guardian Impact Analysis
    lines += ["", "## Guardian Impact Analysis", "",
              "Correlates guardian count with win rate and success rate.", ""]
    guard_wins = defaultdict(lambda: [0, 0])  # [wins, games]
    guard_success = defaultdict(lambda: [0, 0])  # [successes, total_ops]
    for g in ALL_GAME_RESULTS:
        game_tags = g.get("tags", [])
        lb = g["leaderboard"]
        if not lb:
            continue
        winner = shorten_name(lb[0].get("simulation_name", "?"))
        for tag in game_tags:
            gc = g["stats"]["guardians"].get(tag, 0)
            guard_wins[gc][1] += 1
            if ALL_SIM_NAMES.get(tag, tag) == winner:
                guard_wins[gc][0] += 1
            s = g["stats"]["success"].get(tag, 0)
            d = g["stats"]["detected"].get(tag, 0)
            f = g["stats"]["failed"].get(tag, 0)
            guard_success[gc][0] += s
            guard_success[gc][1] += s + d + f

    lines.append("| Guardians | Games | Wins | Win Rate | Ops Success Rate |")
    lines.append("|-----------|-------|------|----------|-----------------|")
    for gc in sorted(guard_wins.keys()):
        wins, games_ct = guard_wins[gc]
        rate = f"{100*wins/games_ct:.0f}%" if games_ct > 0 else "N/A"
        suc, total = guard_success[gc]
        sr = f"{100*suc/total:.0f}%" if total > 0 else "N/A"
        lines.append(f"| {gc} | {games_ct} | {wins} | {rate} | {sr} |")

    # RP Economy Analysis
    lines += ["", "## RP Economy Impact", "",
              "How RP per cycle affects game dynamics.", ""]
    rp_margins = defaultdict(list)
    rp_ops = defaultdict(lambda: [0, 0])  # [total_deployed, games]
    for g in ALL_GAME_RESULTS:
        rpc = g["desc"].split("RP:")[1].split("/")[0] if "RP:" in g["desc"] else "?"
        lb = g["leaderboard"]
        if len(lb) >= 2:
            margin = lb[0].get("composite", 0) - lb[1].get("composite", 0)
            rp_margins[rpc].append(margin)
        total_dep = sum(g["stats"]["deployed"].get(t, 0) for t in g["tags"])
        rp_ops[rpc][0] += total_dep
        rp_ops[rpc][1] += 1

    lines.append("| RP/Cycle | Games | Avg Margin | Avg Ops/Game |")
    lines.append("|----------|-------|------------|-------------|")
    for rpc in sorted(rp_margins.keys()):
        margins_list = rp_margins[rpc]
        avg_margin = sum(margins_list) / len(margins_list) if margins_list else 0
        avg_ops = rp_ops[rpc][0] / rp_ops[rpc][1] if rp_ops[rpc][1] > 0 else 0
        lines.append(f"| {rpc} | {len(margins_list)} | {avg_margin:.1f} | {avg_ops:.0f} |")

    # Strategy Analysis
    lines += ["", "## Strategy Effectiveness", "",
              "Win rate by strategy preset.", ""]
    strat_wins = defaultdict(lambda: [0, 0])  # [wins, appearances]
    for g in ALL_GAME_RESULTS:
        lb = g["leaderboard"]
        if not lb:
            continue
        winner = shorten_name(lb[0].get("simulation_name", "?"))
        desc = g["desc"]
        for tag in g["tags"]:
            # Extract strategy from desc
            strat_match = f"{tag}="
            if strat_match in desc:
                parts = desc.split(strat_match)
                if len(parts) > 1:
                    strat = parts[-1].split("/")[0].split(" ")[0]
                    strat_wins[strat][1] += 1
                    if ALL_SIM_NAMES.get(tag, tag) == winner:
                        strat_wins[strat][0] += 1

    lines.append("| Strategy | Appearances | Wins | Win Rate |")
    lines.append("|----------|------------|------|----------|")
    for strat in sorted(strat_wins.keys()):
        wins, apps = strat_wins[strat]
        rate = f"{100*wins/apps:.0f}%" if apps > 0 else "N/A"
        lines.append(f"| {strat} | {apps} | {wins} | {rate} |")

    # Per-game condensed details (no cycle-by-cycle actions for 60-game runs)
    if len(ALL_GAME_RESULTS) <= 20 or include_actions:
        lines += ["", "## Per-Game Details", ""]
        for i, g in enumerate(ALL_GAME_RESULTS, 1):
            game_tags = g.get("tags", [])
            lines.append(f"### Game {i}: {g['name']}")
            lines.append(f"**Setup:** {g['desc']}")
            lines.append("")
            lines.append("| Rank | Sim | Composite | Stab | Inf | Sov | Dip | Mil |")
            lines.append("|------|-----|-----------|------|-----|-----|-----|-----|")
            for e in g["leaderboard"]:
                name = shorten_name(e.get("simulation_name", "?"))
                lines.append(f"| #{e.get('rank','?')} | {name} | {e.get('composite',0):.1f} "
                            f"| {e.get('stability',0):.0f} | {e.get('influence',0):.0f} "
                            f"| {e.get('sovereignty',0):.0f} | {e.get('diplomatic',0):.0f} "
                            f"| {e.get('military',0):.0f} |")
            lines.append("")

            lines.append("| Player | Deployed | S | D | F | Guards | CI | RP |")
            lines.append("|--------|----------|---|---|---|--------|----|----|")
            for tag in game_tags:
                st = g["stats"]
                lines.append(f"| {tag} | {st['deployed'].get(tag,0)} "
                            f"| {st['success'].get(tag,0)} | {st['detected'].get(tag,0)} "
                            f"| {st['failed'].get(tag,0)} "
                            f"| {st['guardians'].get(tag,0)} | {st['ci_sweeps'].get(tag,0)} "
                            f"| {st['rp_spent'].get(tag,0)} |")
            lines.append("")

            if include_actions:
                lines.append("<details><summary>Cycle-by-Cycle Actions</summary>")
                lines.append("")
                actions = g.get("actions", [])
                if actions:
                    current_cycle = None
                    for a in actions:
                        if a["cycle"] != current_cycle:
                            current_cycle = a["cycle"]
                            lines.append(f"**Cycle {current_cycle} ({a['phase']})**")
                            lines.append("")
                            lines.append("| Player | Action | Detail | Result |")
                            lines.append("|--------|--------|--------|--------|")
                        lines.append(f"| {a['player']} | {a['action']} | {a['detail']} | {a['result']} |")
                    lines.append("")
                lines.append("</details>")
                lines.append("")

    md = "\n".join(lines)
    with open(output_path, "w") as f:
        f.write(md)
    print(f"\nAnalysis written to: {output_path} ({len(lines)} lines)")


def run_battery(title, player_count, games, log_path, md_path, include_actions=False):
    """Run a battery of games and generate output."""
    global LOG, ALL_GAME_RESULTS
    LOG = []
    ALL_GAME_RESULTS = []

    log("=" * 70)
    log(f"EPOCH SIMULATION BATTERY — {title}")
    log("=" * 70)
    log("\nAuthenticating...")
    token = auth_login()
    log("OK\n")

    for i, fn in enumerate(games, 1):
        log(f"\n{'='*70}")
        log(f"GAME {i}/{len(games)}")
        log(f"{'='*70}")
        try:
            if callable(fn):
                fn(token)
            else:
                # fn is a game_def dict for parametric games
                run_parametric_game(token, fn)
        except Exception as e:
            log(f"  ERROR in game {i}: {e}")
            import traceback
            log(f"  {traceback.format_exc()}")
        log("")

    with open(log_path, "w") as f:
        f.write("\n".join(LOG))

    generate_analysis(md_path, title, player_count, include_actions=include_actions)


def _checkpoint_path(md_path):
    """Derive checkpoint file path from analysis output path."""
    return md_path.replace("-analysis.md", "-checkpoint.json")


def _save_checkpoint(md_path, completed_game, results, log_lines):
    """Save progress after each game for crash recovery."""
    cp = _checkpoint_path(md_path)
    data = {
        "completed_game": completed_game,
        "results": results,
        "log_lines": log_lines,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    # Atomic write via temp file
    tmp = cp + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f)
    import os
    os.replace(tmp, cp)


def _load_checkpoint(md_path):
    """Load checkpoint if it exists, returns (completed_game, results, log_lines) or None."""
    cp = _checkpoint_path(md_path)
    try:
        with open(cp) as f:
            data = json.load(f)
        return data["completed_game"], data["results"], data["log_lines"]
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        return None


def run_parametric_battery(title, player_count, num_games, all_tags, log_path, md_path, seed=42, batch_size=15):
    """Generate and run N parametric games in batches to avoid macOS port exhaustion.

    Saves a checkpoint after every game so that a crashed run can be resumed.
    Writes incremental analysis at every batch boundary.
    """
    global LOG, ALL_GAME_RESULTS, _http_client

    set_active_tags(all_tags)

    # Try to resume from checkpoint
    checkpoint = _load_checkpoint(md_path)
    start_game = 1
    if checkpoint:
        start_game = checkpoint[0] + 1
        ALL_GAME_RESULTS = checkpoint[1]
        LOG = checkpoint[2]
        log(f"\n*** RESUMED from checkpoint — {checkpoint[0]} games already done ***")
        log(f"*** Continuing from game {start_game}/{num_games} ***\n")
    else:
        LOG = []
        ALL_GAME_RESULTS = []
        log("=" * 70)
        log(f"EPOCH SIMULATION BATTERY — {title}")
        log(f"  {num_games} games, {player_count} players each, seed={seed}, batch_size={batch_size}")
        log("=" * 70)

    # Ensure Nova Meridian exists (test-only 5th sim, not in any migration)
    if "NM" in all_tags:
        ensure_nm_simulation()

    log("\nAuthenticating...")
    token = auth_login()
    log("OK\n")

    # Regenerate RNG to the correct position (deterministic skip)
    rng = random.Random(seed)
    for i in range(1, start_game):
        generate_parametric_game(i, player_count, all_tags, rng)

    for i in range(start_game, num_games + 1):
        game_def = generate_parametric_game(i, player_count, all_tags, rng)
        log(f"\n{'='*70}")
        log(f"GAME {i}/{num_games}: {game_def['name']}")
        log(f"  {game_def['desc']}")
        log(f"{'='*70}")
        result = run_parametric_game(token, game_def)
        if result is None:
            log(f"  Game {i} failed — restarting backend and retrying...")
            _http_client.close()
            _restart_backend()
            time.sleep(5)
            _consecutive_failures = 0
            _http_client = httpx.Client(
                timeout=60,
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
                transport=httpx.HTTPTransport(retries=1),
            )
            token = auth_login()
            reset_game_state()
            result = run_parametric_game(token, game_def)
        log("")

        # Save checkpoint after every game
        _save_checkpoint(md_path, i, ALL_GAME_RESULTS, LOG)

        # Recycle HTTP client after EVERY game.
        _http_client.close()
        _consecutive_failures = 0

        # Proactively restart backend every 5 games to clear CLOSE_WAIT leaks.
        # The Supabase Python client leaks ~200 CLOSE_WAIT sockets per game
        # (set_session() creates httpx clients that never close). After ~10 games,
        # this exhausts the ephemeral port pool (~16k on macOS).
        if i % 5 == 0:
            log(f"  🔄 Proactive backend restart (every 5 games)...")
            _restart_backend()
        time.sleep(5)
        _wait_for_ports(f"after game {i}")
        time.sleep(3)
        _http_client = httpx.Client(
            timeout=60,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            transport=httpx.HTTPTransport(retries=1),
        )
        token = auth_login()

        # At batch boundaries, write incremental analysis
        if i % batch_size == 0 and i < num_games:
            log(f"\n  === BATCH BOUNDARY (game {i}/{num_games}) — writing analysis ===\n")
            generate_analysis(md_path, title, player_count, include_actions=False)
            with open(log_path, "w") as f:
                f.write("\n".join(LOG))

    with open(log_path, "w") as f:
        f.write("\n".join(LOG))

    generate_analysis(md_path, title, player_count, include_actions=False)

    # Clean up checkpoint on successful completion
    cp = _checkpoint_path(md_path)
    if os.path.exists(cp):
        os.remove(cp)
        log(f"  Checkpoint removed: {cp}")
