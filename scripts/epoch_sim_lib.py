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
import traceback
from collections import defaultdict

import httpx

BASE = "http://localhost:8000"
AUTH_URL = "http://127.0.0.1:54321/auth/v1"
ANON_KEY = None
SERVICE_ROLE_KEY = None

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
    "GR": "20000000-0000-0000-0000-000000000001",
    "SN": "30000000-0000-0000-0000-000000000001",
    "SP": "40000000-0000-0000-0000-000000000001",
    "NM": "50000000-0000-0000-0000-000000000001",
}
ALL_SIM_NAMES = {
    "V": "Velgarien",
    "GR": "The Gaslit Reach",
    "SN": "Station Null",
    "SP": "Speranza",
    "NM": "Nova Meridian",
}
ADMIN_EMAIL = os.environ.get("PLATFORM_ADMIN_EMAIL", "matthias@leihs.at")
ADMIN_PASSWORD = os.environ.get("PLATFORM_ADMIN_PASSWORD", "met123")
_TEST_PASSWORD = "sim-test-pw-2026"  # noqa: S105 — test harness only, never production


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
        self.aptitudes = {}  # agent_id → {spy: int, guardian: int, ...}

    def headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    def available_agents(self):
        return [a for a in self.agents if a["id"] not in self.deployed_agents]

    def best_agent_for(self, op_type):
        """Pick available agent with highest aptitude for the given operative type."""
        avail = self.available_agents()
        if not avail:
            return None
        # Sort by aptitude for this type (descending), default 6 if no aptitude data
        return max(avail, key=lambda a: self.aptitudes.get(a["id"], {}).get(op_type, 6))


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
TEST_USERS = {}  # tag → {"email", "password", "token", "user_id"} — populated by provision_test_users()


def set_active_tags(tags):
    global _active_tags
    _active_tags = tags


# Flat stat keys: per-player int counters
_FLAT_STAT_KEYS = [
    "deployed", "success", "detected", "failed", "guardians",
    "ci_sweeps", "rp_spent", "ci_caught", "rp_remaining",
]
# Nested stat keys: per-player dicts of {op_type: count}
_NESTED_STAT_KEYS = ["deployed_by_type", "success_by_type", "detected_by_type", "failed_by_type"]


def reset_game_state():
    global STATS, SCORE_HISTORY, CYCLE_ACTIONS, _game_total_failures
    STATS = {k: {} for k in _FLAT_STAT_KEYS + _NESTED_STAT_KEYS}
    SCORE_HISTORY = {}
    CYCLE_ACTIONS = []
    _game_total_failures = 0


def log(msg):
    print(msg)
    LOG.append(msg)


def action_log(cycle, phase, player_tag, action, detail, result="",
               *, op_type=None, cost=None, prob=None, target=None, aptitude=None, caught=None):
    entry = {
        "cycle": cycle,
        "phase": phase,
        "player": player_tag,
        "action": action,
        "detail": detail,
        "result": result,
    }
    # Structured fields — only include when present (keeps JSON compact)
    if op_type is not None:
        entry["op_type"] = op_type
    if cost is not None:
        entry["cost"] = cost
    if prob is not None:
        entry["prob"] = prob
    if target is not None:
        entry["target"] = target
    if aptitude is not None:
        entry["aptitude"] = aptitude
    if caught is not None:
        entry["caught"] = caught
    CYCLE_ACTIONS.append(entry)


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
    """Kill and restart the uvicorn backend to clear leaked CLOSE_WAIT sockets.

    Known limitation (P2.2): The Supabase Python client (supabase-py) creates new
    httpx.AsyncClient instances on every set_session() / set_auth() call but never
    closes the previous ones. Each leaked client holds ~20 CLOSE_WAIT TCP sockets
    (the internal GoTrue and PostgREST connections). Over a 60-game battery, this
    accumulates ~12,000 leaked sockets, eventually exhausting the macOS ephemeral
    port pool (~16,384 ports with 30s TIME_WAIT).

    Mitigations in this script:
    - _http_client.close() after every game (our connections)
    - Proactive backend restart every 5 games (clears supabase-py leaks)
    - _wait_for_ports() with backoff before retrying after port exhaustion

    Root cause fix would require either:
    1. Patching supabase-py to reuse or close httpx clients, or
    2. Using a connection pooler (pgBouncer) between backend and Supabase
    """
    print("  🔄 Restarting backend to clear CLOSE_WAIT connections...")
    subprocess.run(["pkill", "-9", "-f", "uvicorn"], capture_output=True)
    # Also kill leaked multiprocessing workers
    subprocess.run(
        "ps aux | grep 'multiprocessing.spawn\\|multiprocessing.resource_tracker'"
        " | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null",
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
    """Re-authenticate and update token on all active Player instances.

    With per-user provisioning (P1.2), each player re-authenticates
    with their own credentials instead of sharing the admin token.
    """
    for tag, p in _current_players.items():
        if tag in TEST_USERS:
            new_tok = _login_as(TEST_USERS[tag]["email"], TEST_USERS[tag]["password"])
            TEST_USERS[tag]["token"] = new_tok
            p.token = new_tok
        else:
            new_token = auth_login()
            p.token = new_token
    # Return any player's token for callers that expect a return value
    if _current_players:
        return next(iter(_current_players.values())).token
    return auth_login()


def _api_error(status_code=0, detail="unknown error"):
    """Build structured error return from api(). Callers can distinguish
    errors from empty successful responses via the ``_error`` key."""
    return {"_error": True, "status": status_code, "detail": str(detail)}


def _parse_error_detail(resp):
    """Extract error detail from an HTTP response."""
    try:
        body = resp.json()
        detail = body.get("detail", resp.text[:200])
        if isinstance(detail, list):
            detail = "; ".join(d.get("msg", str(d)) for d in detail)
        return str(detail)
    except Exception:
        return resp.text[:200]


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
        return _api_error(0, f"game failure cap ({_GAME_FAILURE_CAP}) exceeded")
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
                log("    TOKEN EXPIRED — refreshing...")
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
                detail = _parse_error_detail(resp)
                log(f"    API ERROR {resp.status_code}: {method} {path}: {detail}")
                return _api_error(resp.status_code, detail)
            if resp.status_code >= 400:
                _consecutive_failures += 1
                _game_total_failures += 1
                if attempt < retries:
                    time.sleep(1)
                    continue
                detail = _parse_error_detail(resp)
                log(f"    API ERROR {resp.status_code}: {method} {path}: {detail}")
                return _api_error(resp.status_code, detail)
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
            return _api_error(0, f"port exhaustion on {path}")
        except Exception as e:
            _consecutive_failures += 1
            _game_total_failures += 1
            if attempt < retries:
                time.sleep(2)
                continue
            log(f"    API EXCEPTION: {method} {path}: {e}")
            return _api_error(0, str(e))
    return _api_error(0, f"all {retries + 1} retries exhausted for {method} {path}")


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


def _get_service_role_key():
    """Get Supabase service_role key for Auth Admin API (user provisioning)."""
    global SERVICE_ROLE_KEY
    if SERVICE_ROLE_KEY:
        return SERVICE_ROLE_KEY
    r = subprocess.run(
        ["supabase", "status", "--output", "json"],
        capture_output=True, text=True,
        cwd="/Users/mleihs/Dev/velgarien-rebuild",
    )
    s = json.loads(r.stdout)
    SERVICE_ROLE_KEY = s.get("SERVICE_ROLE_KEY") or s.get("service_role_key")
    if not SERVICE_ROLE_KEY:
        raise RuntimeError("Could not get SERVICE_ROLE_KEY from supabase status")
    return SERVICE_ROLE_KEY


def _create_test_user(tag):
    """Create or find a unique test user for a simulation tag.

    Uses _psql() to check for existing user, then Supabase Auth Admin API
    to create if missing. Returns the user's UUID string.
    """
    email = f"sim-{tag.lower()}@test.velgarien.local"

    # Fast path: check if user already exists
    result = _psql(f"SELECT id FROM auth.users WHERE email = '{email}';")
    try:
        user_id = result.stdout.strip().split('\n')[2].strip()
        if len(user_id) >= 32 and '-' in user_id:
            return user_id
    except (IndexError, ValueError):
        pass

    # Create via Supabase Auth Admin API
    srv_key = _get_service_role_key()
    resp = _http_client.post(
        f"{AUTH_URL}/admin/users",
        json={"email": email, "password": _TEST_PASSWORD, "email_confirm": True},
        headers={
            "apikey": srv_key,
            "Authorization": f"Bearer {srv_key}",
            "Content-Type": "application/json",
        },
    )
    if resp.status_code in (200, 201):
        return resp.json()["id"]

    raise RuntimeError(
        f"Failed to create test user {email}: {resp.status_code} {resp.text[:200]}"
    )


def _login_as(email, password):
    """Login as a specific user, return their JWT access token.

    Requires ANON_KEY to be set (call auth_login() first).
    """
    resp = _http_client.post(
        f"{AUTH_URL}/token?grant_type=password",
        json={"email": email, "password": password},
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
    )
    if resp.status_code != 200:
        raise RuntimeError(
            f"Login failed for {email}: {resp.status_code} {resp.text[:200]}"
        )
    return resp.json()["access_token"]


def provision_test_users(tags):
    """Create unique test users for each simulation tag and log them in.

    Each user gets membership in their template simulation so that
    clone_simulations_for_epoch (migration 060) copies the membership
    to the game instance automatically. This solves the epoch_participants
    user_id unique constraint — each simulated player now has their own
    Supabase auth identity.
    """
    global TEST_USERS
    log("Provisioning unique test users (one per simulation)...")

    for tag in tags:
        email = f"sim-{tag.lower()}@test.velgarien.local"
        user_id = _create_test_user(tag)

        # Ensure membership in template simulation (clone copies to instances)
        sim_id = ALL_SIMS[tag]
        _psql(f"""
            INSERT INTO simulation_members (simulation_id, user_id, member_role)
            VALUES ('{sim_id}', '{user_id}', 'member')
            ON CONFLICT DO NOTHING;
        """)

        # Login to get JWT
        token = _login_as(email, _TEST_PASSWORD)

        TEST_USERS[tag] = {
            "email": email,
            "password": _TEST_PASSWORD,
            "token": token,
            "user_id": user_id,
        }
        log(f"  {tag}: {email} (uid:{user_id[:8]}...)")

    log(f"  {len(TEST_USERS)} test users ready")


def init_stats(tag):
    for key in _FLAT_STAT_KEYS:
        STATS[key].setdefault(tag, 0)
    for key in _NESTED_STAT_KEYS:
        STATS[key].setdefault(tag, {})
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
    # Ensure all agents have aptitude data (needed for aptitude-aware deployment)
    _psql(f"""
        INSERT INTO agent_aptitudes (agent_id, simulation_id, operative_type, aptitude_level)
        SELECT a.id, a.simulation_id, t.type, 6
        FROM agents a
        CROSS JOIN (VALUES ('spy'),('guardian'),('saboteur'),('propagandist'),('infiltrator'),('assassin')) t(type)
        WHERE a.simulation_id = '{nm_id}'
        AND NOT EXISTS (
            SELECT 1 FROM agent_aptitudes aa
            WHERE aa.agent_id = a.id AND aa.operative_type = t.type
        );
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
    # Use aptitude-aware agent selection
    agent = player.best_agent_for(op_type)
    if not agent:
        action_log(_current_cycle, _current_phase, player.tag,
                   f"deploy_{op_type}", "No agents available", "SKIP",
                   op_type=op_type)
        return None
    agent_name = agent.get("name", "?")
    apt_level = player.aptitudes.get(agent["id"], {}).get(op_type, 6)
    body = {"agent_id": agent["id"], "operative_type": op_type}
    if op_type == "guardian":
        body["target_simulation_id"] = None
        detail = f"{agent_name} (apt:{apt_level}) as guardian (RP:{player.rp})"
    else:
        target = players[target_tag]
        body["target_simulation_id"] = target.instance_id
        emb = player.embassies.get(target.instance_id)
        if not emb:
            action_log(_current_cycle, _current_phase, player.tag,
                       f"deploy_{op_type}", f"No embassy to {target_tag}", "SKIP",
                       op_type=op_type, target=target_tag)
            return None
        body["embassy_id"] = emb
        if target_entity_id:
            body["target_entity_id"] = target_entity_id
            body["target_entity_type"] = target_entity_type
        detail = f"{agent_name} (apt:{apt_level}) → {target_tag} ({op_type}, RP:{player.rp})"

    resp = api("POST", f"/api/v1/epochs/{epoch_id}/operatives?simulation_id={player.instance_id}",
               player, json=body)
    mission = resp.get("data")
    if mission:
        player.deployed_agents.add(agent["id"])
        cost = mission.get("cost_rp", 0)
        prob = mission.get("success_probability", "?")
        STATS["deployed"][player.tag] += 1
        by_type = STATS["deployed_by_type"][player.tag]
        by_type[op_type] = by_type.get(op_type, 0) + 1
        STATS["rp_spent"][player.tag] += cost
        if op_type == "guardian":
            STATS["guardians"][player.tag] += 1
            player.guardians += 1
            action_log(_current_cycle, _current_phase, player.tag,
                       "deploy_guardian", detail, f"OK cost={cost}",
                       op_type=op_type, cost=cost, aptitude=apt_level)
        else:
            action_log(_current_cycle, _current_phase, player.tag,
                       f"deploy_{op_type}", detail, f"OK cost={cost} prob={prob}",
                       op_type=op_type, cost=cost, prob=prob, target=target_tag,
                       aptitude=apt_level)
        log(f"    {player.tag}: {op_type} {agent_name}→{target_tag or 'self'} cost={cost} prob={prob}")
    else:
        err = resp.get("detail", "unknown error")
        action_log(_current_cycle, _current_phase, player.tag,
                   f"deploy_{op_type}", detail, f"FAIL: {err}",
                   op_type=op_type, target=target_tag)
        log(f"    {player.tag}: {op_type} FAILED — {err}")
    return mission


def counter_intel(epoch_id, player):
    resp = api("POST", f"/api/v1/epochs/{epoch_id}/operatives/counter-intel?simulation_id={player.instance_id}", player)
    STATS["ci_sweeps"][player.tag] += 1
    STATS["rp_spent"][player.tag] += 3
    caught = resp.get("data", [])
    STATS["ci_caught"][player.tag] += len(caught)
    action_log(_current_cycle, _current_phase, player.tag,
               "counter_intel", f"Sweep (RP:{player.rp}→{player.rp-3})",
               f"caught={len(caught)}",
               caught=len(caught))
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
            by_type = STATS["success_by_type"][tag]
            by_type[op_type] = by_type.get(op_type, 0) + 1
            effect = mr.get("effect_description", "")
            action_log(cycle, "resolve", tag, f"outcome_{op_type}",
                       f"→{target_tag} prob={prob}", f"SUCCESS {effect}",
                       op_type=op_type, prob=prob, target=target_tag)
        elif outcome == "detected":
            STATS["detected"][tag] += 1
            by_type = STATS["detected_by_type"][tag]
            by_type[op_type] = by_type.get(op_type, 0) + 1
            action_log(cycle, "resolve", tag, f"outcome_{op_type}",
                       f"→{target_tag} prob={prob}", "DETECTED (-2 mil)",
                       op_type=op_type, prob=prob, target=target_tag)
        elif outcome == "failed":
            STATS["failed"][tag] += 1
            by_type = STATS["failed_by_type"][tag]
            by_type[op_type] = by_type.get(op_type, 0) + 1
            action_log(cycle, "resolve", tag, f"outcome_{op_type}",
                       f"→{target_tag} prob={prob}", "FAILED (undetected)",
                       op_type=op_type, prob=prob, target=target_tag)
        else:
            action_log(cycle, "resolve", tag, f"outcome_{op_type}",
                       f"→{target_tag} prob={prob}", f"{outcome}",
                       op_type=op_type, prob=prob, target=target_tag)

        outcomes_by_tag[tag].append(f"{op_type}→{target_tag}:{outcome}")

        if m.get("status") in ("success", "failed", "detected", "captured"):
            for p in players.values():
                p.deployed_agents.discard(m.get("agent_id"))

    for tag, outs in outcomes_by_tag.items():
        log(f"    resolve {tag}: {', '.join(outs)}")

    # Full cycle resolution: RP grant + missions (no-op, already resolved above) +
    # scoring + bot cycle + advance counter. Replaces the previous explicit
    # /scores/compute call — resolve_cycle_full handles scoring internally.
    api("POST", f"/api/v1/epochs/{epoch_id}/resolve-cycle", admin)

    # Query scores computed by resolve_cycle_full (stored under current_cycle after advance)
    score_resp = api("GET", f"/api/v1/epochs/{epoch_id}/scores/leaderboard", admin)
    for s in score_resp.get("data", []):
        sim_id = s.get("simulation_id", "")
        tag = next((t for t, p in players.items() if p.instance_id == sim_id), None)
        if tag:
            sd = {
                d: s.get(f"{d}_score", 0)
                for d in ["stability", "influence", "sovereignty", "diplomatic", "military"]
            }
            sd["composite"] = s.get("composite_score", 0)
            SCORE_HISTORY[tag].append((cycle, sd))
            action_log(cycle, "score", tag, "score",
                       f"stab={sd['stability']:.1f} inf={sd['influence']:.1f} sov={sd['sovereignty']:.1f} "
                       f"dip={sd['diplomatic']:.1f} mil={sd['military']:.1f}",
                       f"composite={sd['composite']:.2f}")
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
        # Use per-user token if provisioned (P1.2), else fall back to shared token
        player_token = TEST_USERS[tag]["token"] if tag in TEST_USERS else token
        p = Player(tag, ALL_SIMS[tag], player_token)
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
        resp = api("POST", f"/api/v1/epochs/{epoch_id}/participants", p, json={"simulation_id": p.sim_id})
        if not resp.get("data"):
            log(f"  FATAL: Player {tag} failed to join epoch: {resp.get('detail', 'no response')}")
            return None, players, admin

    if alliances:
        for team_name, members in alliances.items():
            creator = members[0]
            resp = api("POST", f"/api/v1/epochs/{epoch_id}/teams?simulation_id={players[creator].sim_id}",
                       players[creator], json={"name": team_name})
            tid = resp.get("data", {}).get("id")
            if tid:
                for joiner in members[1:]:
                    join_url = f"/api/v1/epochs/{epoch_id}/teams/{tid}/join"
                    api("POST", f"{join_url}?simulation_id={players[joiner].sim_id}",
                        players[joiner])

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
        # Load agent aptitudes (cloned from template during epoch start)
        apt_data = api("GET", f"/api/v1/public/simulations/{p.instance_id}/aptitudes").get("data", [])
        for row in apt_data:
            aid = row.get("agent_id")
            if aid not in p.aptitudes:
                p.aptitudes[aid] = {}
            p.aptitudes[aid][row.get("operative_type", "")] = row.get("aptitude_level", 6)
        p.buildings = api("GET", f"/api/v1/simulations/{p.instance_id}/buildings?limit=10", p).get("data", [])
        for e in api("GET", f"/api/v1/simulations/{p.instance_id}/embassies", p).get("data", []):
            sa, sb = e.get("simulation_a_id"), e.get("simulation_b_id")
            if sa == p.instance_id:
                p.embassies[sb] = e["id"]
            elif sb == p.instance_id:
                p.embassies[sa] = e["id"]

    # Validate all players got instance IDs — abort if any are missing
    for tag, p in players.items():
        if not p.instance_id:
            log(f"  FATAL: Player {tag} has no instance_id after setup")
            return None, players, admin

    emb_counts = {t: len(p.embassies) for t, p in players.items()}
    agent_counts = {t: len(p.agents) for t, p in players.items()}
    apt_counts = {t: len(p.aptitudes) for t, p in players.items()}
    log(f"  Setup: {name}")
    log(f"    Embassies: {emb_counts} | Agents: {agent_counts} | Aptitude profiles: {apt_counts}")
    return epoch_id, players, admin


def shorten_name(name):
    for sn in ALL_SIM_NAMES.values():
        if sn in name:
            return sn
    return name


def finish_game(epoch_id, admin, players, game_name, game_desc, tags, *, game_def=None):
    for _ in range(3):
        resp = api("POST", f"/api/v1/epochs/{epoch_id}/advance", admin)
        if resp.get("data", {}).get("status") == "completed":
            break

    resp = api("GET", f"/api/v1/epochs/{epoch_id}/scores/leaderboard", admin)
    leaderboard = resp.get("data", [])

    # Capture final RP before serializing stats (P3.2)
    for tag in tags:
        STATS["rp_remaining"][tag] = players[tag].rp

    # Deep-copy nested stat dicts to isolate result from future state resets
    serialized_stats = {}
    for k, v in STATS.items():
        serialized_stats[k] = {
            t: (dict(inner) if isinstance(inner, dict) else inner)
            for t, inner in v.items()
        }

    result = {
        "name": game_name,
        "desc": game_desc,
        "epoch_id": epoch_id,
        "leaderboard": leaderboard,
        "stats": serialized_stats,
        "scores": {t: list(h) for t, h in SCORE_HISTORY.items()},
        "actions": list(CYCLE_ACTIONS),
        "tags": tags,
    }

    # Store structured game definition for machine-parseable analysis (P3.1)
    if game_def is not None:
        result["config"] = game_def["config"]
        result["strategies"] = game_def["strategies"]
        result["ci_freq"] = game_def["ci_freq"]
        result["alliances"] = game_def.get("alliances")
        result["guardian_counts"] = game_def["guardian_counts"]
        result["phase_timing"] = {
            "foundation_cycles": game_def["foundation_cycles"],
            "comp_end": game_def["comp_end"],
            "reck_end": game_def["reck_end"],
        }

    ALL_GAME_RESULTS.append(result)

    log(f"\n  LEADERBOARD — {game_name}:")
    for e in leaderboard:
        name = shorten_name(e.get("simulation_name", "?"))
        log(f"    #{e.get('rank')} {name}: {e.get('composite', 0):.1f}")
    log("  STATS:")
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
OP_COSTS = {"spy": 3, "propagandist": 4, "saboteur": 5, "infiltrator": 5, "assassin": 7, "guardian": 4}

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
        if rp >= 7 and has_agents:
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
        if rp >= 7 and has_agents:
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
        if rp >= 7 and has_agents:
            return "assassin"
        if rp >= 5 and has_buildings:
            return "saboteur"
        if rp >= 5:
            return "infiltrator"
        if rp >= 4:
            return "propagandist"
        return "spy"
    elif strategy == "infiltrator":
        if rp >= 5:
            return "infiltrator"
        return "spy"
    elif strategy == "econ_build":
        if cycle % 3 != 0:
            return None  # Skip — save RP
        if rp >= 7 and has_agents:
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
        if rp >= 5:
            candidates.append("infiltrator")
        if rp >= 7 and has_agents:
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
    return dict(zip(dims, weights, strict=True))


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
        log("  SKIPPING game — setup failed")
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
                       game_def["desc"], tags, game_def=game_def)


# ── Analysis Generation ──

def generate_analysis(output_path, title, player_count, include_actions=False):
    """Generate markdown analysis. Set include_actions=False for 60-game runs (too large)."""
    tags = _active_tags
    lines = [
        f"# Epoch {player_count}-Player Simulation: {len(ALL_GAME_RESULTS)}-Game Analysis",
        "",
        f"> Simulated on {time.strftime('%Y-%m-%d')} (local API)",
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
    total_stats = {
        k: defaultdict(int)
        for k in ["deployed", "success", "detected", "failed", "guardians", "ci_sweeps", "rp_spent"]
    }
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
            lines.append(
                f"| {i} | {g['name'][:40]} | {w_name} | {w_score:.1f}"
                f" | {r_name} | {r_score:.1f} | {margin:.1f} |")

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
                  f"- **Close games (margin < 5):** "
                  f"{sum(1 for m in margins if m < 5)}/{len(margins)}"
                  f" ({100 * sum(1 for m in margins if m < 5) / len(margins):.0f}%)",
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
        # Prefer structured config (P3.1), fall back to desc parsing for handcrafted games
        config = g.get("config")
        if config:
            rpc = str(config.get("rp_per_cycle", "?"))
        else:
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
        strategies = g.get("strategies")
        for tag in g["tags"]:
            # Prefer structured data (P3.1), fall back to desc parsing for handcrafted games
            strat = None
            if strategies:
                strat = strategies.get(tag)
            else:
                strat_match = f"{tag}="
                desc = g["desc"]
                if strat_match in desc:
                    parts = desc.split(strat_match)
                    if len(parts) > 1:
                        strat = parts[-1].split("/")[0].split(" ")[0]
            if strat:
                strat_wins[strat][1] += 1
                if ALL_SIM_NAMES.get(tag, tag) == winner:
                    strat_wins[strat][0] += 1

    lines.append("| Strategy | Appearances | Wins | Win Rate |")
    lines.append("|----------|------------|------|----------|")
    for strat in sorted(strat_wins.keys()):
        wins, apps = strat_wins[strat]
        rate = f"{100*wins/apps:.0f}%" if apps > 0 else "N/A"
        lines.append(f"| {strat} | {apps} | {wins} | {rate} |")

    # ── P3.4: Advanced Analysis Sections ──

    # 1. Per-Operative-Type Effectiveness
    lines += ["", "## Per-Operative-Type Effectiveness", "",
              "Aggregate success rates by operative type across all games.", ""]
    type_totals = defaultdict(lambda: {"deployed": 0, "success": 0, "detected": 0, "failed": 0})
    for g in ALL_GAME_RESULTS:
        for tag in g.get("tags", []):
            for ot, count in g["stats"].get("deployed_by_type", {}).get(tag, {}).items():
                type_totals[ot]["deployed"] += count
            for ot, count in g["stats"].get("success_by_type", {}).get(tag, {}).items():
                type_totals[ot]["success"] += count
            for ot, count in g["stats"].get("detected_by_type", {}).get(tag, {}).items():
                type_totals[ot]["detected"] += count
            for ot, count in g["stats"].get("failed_by_type", {}).get(tag, {}).items():
                type_totals[ot]["failed"] += count

    if type_totals:
        lines.append("| Op Type | Deployed | Success | Detected | Failed | Success Rate | Detection Rate |")
        lines.append("|---------|----------|---------|----------|--------|-------------|---------------|")
        for ot in sorted(type_totals.keys()):
            t = type_totals[ot]
            resolved = t["success"] + t["detected"] + t["failed"]
            sr = f"{100 * t['success'] / resolved:.0f}%" if resolved > 0 else "N/A"
            dr = f"{100 * t['detected'] / resolved:.0f}%" if resolved > 0 else "N/A"
            lines.append(f"| {ot} | {t['deployed']} | {t['success']} "
                         f"| {t['detected']} | {t['failed']} | {sr} | {dr} |")
    else:
        lines.append("*No per-type data available (handcrafted games only).*")

    # 2. Counter-Intelligence Effectiveness
    lines += ["", "## Counter-Intelligence Effectiveness", "",
              "Catch rate per sweep and CI ROI.", ""]
    total_ci_sw = 0
    total_ci_ct = 0
    ci_by_strat = defaultdict(lambda: [0, 0])  # [caught, sweeps]
    for g in ALL_GAME_RESULTS:
        strategies = g.get("strategies", {})
        for tag in g.get("tags", []):
            sweeps = g["stats"].get("ci_sweeps", {}).get(tag, 0)
            caught_n = g["stats"].get("ci_caught", {}).get(tag, 0)
            total_ci_sw += sweeps
            total_ci_ct += caught_n
            strat = strategies.get(tag, "unknown")
            ci_by_strat[strat][0] += caught_n
            ci_by_strat[strat][1] += sweeps

    if total_ci_sw > 0:
        lines.append(f"- **Total sweeps:** {total_ci_sw}")
        lines.append(f"- **Total caught:** {total_ci_ct}")
        lines.append(f"- **Catch rate:** {100 * total_ci_ct / total_ci_sw:.1f}%"
                     f" ({total_ci_ct}/{total_ci_sw})")
        if total_ci_ct > 0:
            lines.append(f"- **RP cost per catch:** {3 * total_ci_sw / total_ci_ct:.1f}")
        else:
            lines.append("- **RP cost per catch:** ∞ (no catches)")
        lines.append("")
        lines.append("| Strategy | Sweeps | Caught | Catch Rate |")
        lines.append("|----------|--------|--------|------------|")
        for strat in sorted(ci_by_strat.keys()):
            caught_s, sweeps_s = ci_by_strat[strat]
            cr = f"{100 * caught_s / sweeps_s:.0f}%" if sweeps_s > 0 else "N/A"
            lines.append(f"| {strat} | {sweeps_s} | {caught_s} | {cr} |")
    else:
        lines.append("*No CI sweeps recorded.*")

    # 3. Score Trajectory Analysis
    lines += ["", "## Score Trajectory Analysis", "",
              "Tipping points, lead changes, and convergence patterns.", ""]
    tipping_points = []
    lead_changes_list = []
    for g in ALL_GAME_RESULTS:
        scores = g.get("scores", {})
        if not scores or not g["leaderboard"]:
            continue
        winner_name = shorten_name(g["leaderboard"][0].get("simulation_name", "?"))
        winner_tag = next(
            (t for t in g["tags"] if ALL_SIM_NAMES.get(t) == winner_name), None)

        all_cycles = sorted({c for hist in scores.values() for c, _ in hist})
        lead_changes = 0
        prev_leader = None
        tipping = None
        for cyc in all_cycles:
            cycle_scores = {}
            for tag_s, hist in scores.items():
                for c, sd in hist:
                    if c == cyc:
                        cycle_scores[tag_s] = sd.get("composite", 0) if isinstance(sd, dict) else 0
            if not cycle_scores:
                continue
            leader = max(cycle_scores, key=cycle_scores.get)
            if leader != prev_leader and prev_leader is not None:
                lead_changes += 1
            prev_leader = leader
            if leader == winner_tag and tipping is None:
                tipping = cyc

        if tipping is not None:
            tipping_points.append(tipping)
        lead_changes_list.append(lead_changes)

    if tipping_points:
        lines.append(f"- **Avg tipping point:** cycle {sum(tipping_points) / len(tipping_points):.1f}"
                     f" (earliest: {min(tipping_points)}, latest: {max(tipping_points)})")
    if lead_changes_list:
        lines.append(f"- **Avg lead changes per game:** "
                     f"{sum(lead_changes_list) / len(lead_changes_list):.1f}"
                     f" (max: {max(lead_changes_list)})")
        decided_early = sum(1 for lc in lead_changes_list if lc == 0)
        contested = sum(1 for lc in lead_changes_list if lc >= 3)
        lines.append(f"- **Decided early (0 lead changes):** {decided_early}/{len(lead_changes_list)}")
        lines.append(f"- **Contested (3+ lead changes):** {contested}/{len(lead_changes_list)}")

    # 4. Phase-Based Outcomes
    lines += ["", "## Phase-Based Outcomes", "",
              "Mission outcomes grouped by game phase.", ""]
    phase_outcomes = defaultdict(lambda: {"deployed": 0, "success": 0, "detected": 0, "failed": 0})
    for g in ALL_GAME_RESULTS:
        for a in g.get("actions", []):
            action = a.get("action", "")
            result_str = a.get("result", "")
            phase = a.get("phase", "?")
            if action.startswith("outcome_"):
                if "SUCCESS" in result_str:
                    phase_outcomes[phase]["success"] += 1
                elif "DETECTED" in result_str:
                    phase_outcomes[phase]["detected"] += 1
                elif "FAILED" in result_str:
                    phase_outcomes[phase]["failed"] += 1
            elif action.startswith("deploy_") and result_str.startswith("OK"):
                phase_outcomes[phase]["deployed"] += 1

    if phase_outcomes:
        lines.append("| Phase | Deployed | Success | Detected | Failed | Success Rate |")
        lines.append("|-------|----------|---------|----------|--------|-------------|")
        for phase in ["foundation", "competition", "reckoning"]:
            if phase not in phase_outcomes:
                continue
            po = phase_outcomes[phase]
            resolved = po["success"] + po["detected"] + po["failed"]
            sr = f"{100 * po['success'] / resolved:.0f}%" if resolved > 0 else "N/A"
            lines.append(f"| {phase} | {po['deployed']} | {po['success']} "
                         f"| {po['detected']} | {po['failed']} | {sr} |")
    else:
        lines.append("*No action data available.*")

    # 5. Strategy Matchup Matrix
    _strat_abbrev = {
        "balanced": "BAL", "spy_heavy": "SPY", "saboteur_heavy": "SAB",
        "assassin_rush": "ASN", "propagandist": "PRO", "ci_defensive": "CID",
        "all_out": "ALL", "infiltrator": "INF", "econ_build": "ECO",
        "random_mix": "RND",
    }
    lines += ["", "## Strategy Matchup Matrix", "",
              "Win rate when two strategies co-appear. Row = strategy, column = opponent strategy.", ""]

    strat_matchup = defaultdict(lambda: defaultdict(lambda: [0, 0]))  # [wins, meetings]
    all_strats_seen = set()
    for g in ALL_GAME_RESULTS:
        strategies = g.get("strategies")
        if not strategies:
            continue
        lb = g["leaderboard"]
        if not lb:
            continue
        winner_name = shorten_name(lb[0].get("simulation_name", "?"))
        winner_tag = next(
            (t for t in g["tags"] if ALL_SIM_NAMES.get(t) == winner_name), None)
        game_strats = [(tag, strategies[tag]) for tag in g["tags"]]
        for tag_a, strat_a in game_strats:
            all_strats_seen.add(strat_a)
            for tag_b, strat_b in game_strats:
                if tag_a == tag_b:
                    continue
                strat_matchup[strat_a][strat_b][1] += 1
                if tag_a == winner_tag:
                    strat_matchup[strat_a][strat_b][0] += 1

    if all_strats_seen:
        sorted_strats = sorted(all_strats_seen)
        abbr = [_strat_abbrev.get(s, s[:6]) for s in sorted_strats]
        header = "| vs | " + " | ".join(abbr) + " |"
        sep = "|" + "|".join(["----"] * (len(sorted_strats) + 1)) + "|"
        lines.append(header)
        lines.append(sep)
        for i_s, strat_a in enumerate(sorted_strats):
            row = f"| **{abbr[i_s]}** |"
            for j_s, strat_b in enumerate(sorted_strats):
                if i_s == j_s:
                    row += " - |"
                else:
                    wins, meets = strat_matchup[strat_a][strat_b]
                    if meets >= 2:
                        row += f" {100 * wins / meets:.0f}% |"
                    elif meets == 1:
                        row += f" {'W' if wins else 'L'} |"
                    else:
                        row += " - |"
            lines.append(row)
        lines.append("")
        lines.append("Legend: " + ", ".join(
            f"{a}={s}" for a, s in zip(abbr, sorted_strats, strict=True)))
    else:
        lines.append("*No structured strategy data available.*")

    # 6. Alliance Impact
    lines += ["", "## Alliance Impact", "",
              "Win rates for allied vs solo players (parametric games only).", ""]
    allied_wins = [0, 0]  # [wins, appearances]
    solo_wins = [0, 0]
    alliance_game_count = 0
    no_alliance_game_count = 0
    for g in ALL_GAME_RESULTS:
        if "config" not in g:
            continue  # Skip handcrafted games without structured data
        alliances = g.get("alliances")
        lb = g["leaderboard"]
        if not lb:
            continue
        winner_name = shorten_name(lb[0].get("simulation_name", "?"))
        allied_tags = set()
        if alliances:
            alliance_game_count += 1
            for members in alliances.values():
                allied_tags.update(members)
        else:
            no_alliance_game_count += 1
        for tag in g["tags"]:
            is_winner = ALL_SIM_NAMES.get(tag) == winner_name
            if tag in allied_tags:
                allied_wins[1] += 1
                if is_winner:
                    allied_wins[0] += 1
            else:
                solo_wins[1] += 1
                if is_winner:
                    solo_wins[0] += 1

    if allied_wins[1] > 0 or solo_wins[1] > 0:
        lines.append("| Status | Appearances | Wins | Win Rate |")
        lines.append("|--------|------------|------|----------|")
        if allied_wins[1] > 0:
            lines.append(f"| Allied | {allied_wins[1]} | {allied_wins[0]} "
                         f"| {100 * allied_wins[0] / allied_wins[1]:.0f}% |")
        if solo_wins[1] > 0:
            lines.append(f"| Solo | {solo_wins[1]} | {solo_wins[0]} "
                         f"| {100 * solo_wins[0] / solo_wins[1]:.0f}% |")
        lines.append("")
        lines.append(f"- **Games with alliances:** {alliance_game_count}")
        lines.append(f"- **Games without alliances:** {no_alliance_game_count}")
    else:
        lines.append("*No alliance data available.*")

    # 7. Parameter Sensitivity
    lines += ["", "## Parameter Sensitivity", "",
              "How game configuration parameters affect victory margins.", ""]
    param_margins = defaultdict(lambda: defaultdict(list))
    for g in ALL_GAME_RESULTS:
        config = g.get("config")
        if not config:
            continue
        lb = g["leaderboard"]
        margin = (lb[0].get("composite", 0) - lb[1].get("composite", 0)) if len(lb) >= 2 else None
        if margin is None:
            continue
        for param in ["rp_per_cycle", "rp_cap", "foundation_pct", "reckoning_pct",
                      "allow_betrayal", "max_team_size"]:
            val = config.get(param)
            if val is not None:
                param_margins[param][str(val)].append(margin)

    def _param_sort_key(x):
        try:
            return (0, float(x))
        except ValueError:
            return (1, x)

    if param_margins:
        for param in ["rp_per_cycle", "rp_cap", "foundation_pct", "reckoning_pct",
                      "allow_betrayal", "max_team_size"]:
            if param not in param_margins:
                continue
            lines.append(f"**{param}:**")
            lines.append("")
            lines.append("| Value | Games | Avg Margin | Min | Max |")
            lines.append("|-------|-------|------------|-----|-----|")
            for val in sorted(param_margins[param].keys(), key=_param_sort_key):
                vals = param_margins[param][val]
                avg = sum(vals) / len(vals)
                lines.append(f"| {val} | {len(vals)} | {avg:.1f} | {min(vals):.1f} | {max(vals):.1f} |")
            lines.append("")
    else:
        lines.append("*No structured config data available (handcrafted games only).*")

    # 8. Probability Calibration
    lines += ["", "## Probability Calibration", "",
              "Predicted success probability vs actual outcome rate.", ""]
    prob_buckets = defaultdict(lambda: [0, 0])  # [successes, total]
    for g in ALL_GAME_RESULTS:
        for a in g.get("actions", []):
            if not a.get("action", "").startswith("outcome_"):
                continue
            prob_val = a.get("prob")
            if prob_val is None or prob_val == "?":
                continue
            try:
                p = float(prob_val)
            except (ValueError, TypeError):
                continue
            bucket = min(int(p * 100) // 20, 4)
            label = f"{bucket * 20}-{(bucket + 1) * 20}%"
            prob_buckets[label][1] += 1
            if "SUCCESS" in a.get("result", ""):
                prob_buckets[label][0] += 1

    if prob_buckets:
        lines.append("| Predicted Range | Missions | Successes | Actual Rate | Calibration |")
        lines.append("|----------------|----------|-----------|-------------|-------------|")
        for bucket_idx in range(5):
            label = f"{bucket_idx * 20}-{(bucket_idx + 1) * 20}%"
            if label not in prob_buckets:
                continue
            suc, total = prob_buckets[label]
            actual = 100 * suc / total if total > 0 else 0
            midpoint = bucket_idx * 20 + 10
            if actual > midpoint + 10:
                cal = "over-performs"
            elif actual < midpoint - 10:
                cal = "under-performs"
            else:
                cal = "well-calibrated"
            lines.append(f"| {label} | {total} | {suc} | {actual:.0f}% | {cal} |")
    else:
        lines.append("*No probability data available in action logs.*")

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

    # P3.5: Export structured data as JSON for external analysis (pandas/jupyter)
    json_path = output_path.replace("-analysis.md", "-data.json")
    if json_path != output_path:  # Only write if the path actually changed
        with open(json_path, "w") as f:
            json.dump(ALL_GAME_RESULTS, f, indent=2, default=str)
        print(f"Data export written to: {json_path} ({len(ALL_GAME_RESULTS)} games)")


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

    provision_test_users(_active_tags)

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

    provision_test_users(all_tags)

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
        try:
            result = run_parametric_game(token, game_def)
        except Exception as e:
            log(f"  ERROR in game {i}: {e}")
            log(f"  {traceback.format_exc()}")
            result = None

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
            try:
                result = run_parametric_game(token, game_def)
            except Exception as e:
                log(f"  ERROR in game {i} (retry): {e}")
                log(f"  {traceback.format_exc()}")
                result = None
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
            log("  🔄 Proactive backend restart (every 5 games)...")
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
