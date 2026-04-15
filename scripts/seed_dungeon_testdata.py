#!/usr/bin/env python3
"""Seed Resonance Dungeons test data and optionally start a run for E2E testing.

Creates substrate_resonance + resonance_impact rows so the dungeon lobby shows
available archetypes. Can also auto-start a run via the backend API, giving you
an active dungeon with party panel + map immediately.

Usage:
  # Activate venv first
  source backend/.venv/bin/activate

  # Seed 'The Shadow' for conventional-memory (7 agents, best for testing)
  python scripts/seed_dungeon_testdata.py

  # Seed AND auto-start a dungeon run (opens browser-ready state)
  python scripts/seed_dungeon_testdata.py --start-run

  # Seed for a different simulation
  python scripts/seed_dungeon_testdata.py -s velgarien

  # Seed multiple archetypes
  python scripts/seed_dungeon_testdata.py -a "The Shadow,The Tower,The Entropy"

  # Just verify current state (no mutations)
  python scripts/seed_dungeon_testdata.py --verify

  # Clean up all test-seeded data
  python scripts/seed_dungeon_testdata.py --cleanup

  # List agents for party selection
  python scripts/seed_dungeon_testdata.py --list-agents

Requires: backend/.venv activated, .env in project root (CWD = project root).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, UTC

# Ensure project root is on path for backend imports
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

# ── Constants (derived from canonical model) ─────────────────────────────────

from backend.models.resonance import (  # noqa: E402
    ARCHETYPES,
    ARCHETYPE_DESCRIPTIONS,
    CATEGORY_ARCHETYPE_MAP,
)

VALID_ARCHETYPES = list(ARCHETYPES)

# Invert CATEGORY_ARCHETYPE_MAP: archetype → (source_category, signature)
_ARCHETYPE_INVERSE = {
    archetype: (source, sig)
    for source, (sig, archetype) in CATEGORY_ARCHETYPE_MAP.items()
}
ARCHETYPE_SOURCES: dict[str, str] = {a: _ARCHETYPE_INVERSE[a][0] for a in ARCHETYPES}
ARCHETYPE_SIGNATURES: dict[str, str] = {a: _ARCHETYPE_INVERSE[a][1] for a in ARCHETYPES}

# Deterministic test UUIDs (a0/a1 prefix for easy identification + cleanup)
_RES_PREFIX = "a0000000-0000-0000-0000-00000000"
_IMP_PREFIX = "a1000000-0000-0000-0000-00000000"

# Diversified aptitude profiles for party balance.
# Cycling through these gives: DPS, Tank, Support, Flex.
AGENT_APTITUDE_PROFILES = [
    {"assassin": 6, "spy": 4},         # DPS: Precision Strike, Exploit + Observe, Analyze
    {"guardian": 6, "infiltrator": 3},  # Tank: Shield, Taunt, Fortify + Evade
    {"propagandist": 5, "spy": 3},     # Support: Inspire, Demoralize + Observe
    {"saboteur": 5, "assassin": 4},    # Flex: Trap, Disrupt + Precision Strike
]

DEFAULT_SIM = "conventional-memory"
BACKEND_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:5173"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ok(msg: str) -> None:
    print(f"  \033[32m[OK]\033[0m {msg}")


def _err(msg: str) -> None:
    print(f"  \033[31m[!!]\033[0m {msg}")


def _info(msg: str) -> None:
    print(f"  \033[33m[..]\033[0m {msg}")


def _heading(msg: str) -> None:
    print(f"\n\033[1m{msg}\033[0m")


def check_backend() -> bool:
    """Verify the backend is running and healthy."""
    try:
        req = urllib.request.urlopen(f"{BACKEND_URL}/api/v1/health", timeout=3)
        return req.status == 200
    except Exception:
        return False


def get_supabase():
    """Create Supabase admin client from .env."""
    try:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
    except ImportError:
        pass  # .env might be sourced already

    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        _err("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
        sys.exit(1)

    from supabase import create_client
    return create_client(url, key)


def get_auth_token(supabase) -> str | None:
    """Sign in as the dev user and return an access token for API calls."""
    email = os.environ.get("DEV_USER_EMAIL", "matthias@leihs.at")
    password = os.environ.get("DEV_USER_PASSWORD", "met123")

    try:
        resp = supabase.auth.sign_in_with_password({"email": email, "password": password})
        return resp.session.access_token if resp.session else None
    except Exception as e:
        _err(f"Auth failed: {e}")
        return None


def api_call(method: str, path: str, token: str, body: dict | None = None) -> dict | None:
    """Make an authenticated API call to the backend."""
    url = f"{BACKEND_URL}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else ""
        _err(f"API {method} {path}: {e.code} — {error_body[:200]}")
        return None
    except Exception as e:
        _err(f"API {method} {path}: {e}")
        return None


# ── Core Operations ───────────────────────────────────────────────────────────

def resolve_simulation(supabase, slug: str) -> str | None:
    """Resolve simulation slug to UUID."""
    resp = supabase.table("simulations").select("id").eq("slug", slug).execute()
    return resp.data[0]["id"] if resp.data else None


def get_agents(supabase, simulation_id: str, limit: int = 10) -> list[dict]:
    """Get agents for a simulation."""
    resp = (
        supabase.table("agents")
        .select("id, name")
        .eq("simulation_id", simulation_id)
        .limit(limit)
        .execute()
    )
    return resp.data or []


def seed_archetype(supabase, archetype: str, index: int) -> str:
    """Upsert a substrate_resonance. Returns resonance UUID."""
    res_id = f"{_RES_PREFIX}{index:04d}"
    now = datetime.now(UTC)

    data = {
        "id": res_id,
        "source_category": ARCHETYPE_SOURCES[archetype],
        "resonance_signature": ARCHETYPE_SIGNATURES[archetype],
        "archetype": archetype,
        "title": f"{archetype} Convergence",
        "description": ARCHETYPE_DESCRIPTIONS[archetype],
        "magnitude": 0.75,
        "affected_event_types": ["combat", "encounter", "exploration"],
        "status": "impacting",
        "detected_at": (now - timedelta(days=3)).isoformat(),
        "impacts_at": (now - timedelta(days=1)).isoformat(),
    }

    resp = supabase.table("substrate_resonances").upsert(data).execute()
    if resp.data:
        _ok(f"substrate_resonance: {archetype} ({res_id})")
    else:
        _err(f"Failed to upsert resonance for {archetype}")
    return res_id


def seed_impact(supabase, resonance_id: str, simulation_id: str, index: int) -> None:
    """Upsert a resonance_impact linking archetype to simulation."""
    imp_id = f"{_IMP_PREFIX}{index:04d}"

    data = {
        "id": imp_id,
        "resonance_id": resonance_id,
        "simulation_id": simulation_id,
        "susceptibility": 1.0,
        "effective_magnitude": 0.65,
        "status": "completed",
    }

    resp = supabase.table("resonance_impacts").upsert(data).execute()
    if resp.data:
        _ok("resonance_impact: linked to simulation")
    else:
        _err("Failed to upsert impact")


def seed_aptitudes(supabase, simulation_id: str, agents: list[dict]) -> None:
    """Seed diversified aptitudes for party agents. Idempotent via upsert."""
    _heading(f"Seeding aptitudes for {len(agents)} agents...")

    for i, agent in enumerate(agents):
        profile = AGENT_APTITUDE_PROFILES[i % len(AGENT_APTITUDE_PROFILES)]
        agent_id = agent["id"]
        agent_name = agent["name"]

        for operative_type, level in profile.items():
            data = {
                "agent_id": agent_id,
                "simulation_id": simulation_id,
                "operative_type": operative_type,
                "aptitude_level": level,
            }
            resp = (
                supabase.table("agent_aptitudes")
                .upsert(data, on_conflict="agent_id,operative_type")
                .execute()
            )
            if resp.data:
                _ok(f"  {agent_name}: {operative_type} = {level}")
            else:
                _err(f"  Failed to upsert {operative_type} for {agent_name}")

    # Verify
    resp = (
        supabase.table("agent_aptitudes")
        .select("agent_id, operative_type, aptitude_level")
        .eq("simulation_id", simulation_id)
        .execute()
    )
    count = len(resp.data) if resp.data else 0
    _ok(f"Total aptitudes in DB for simulation: {count}")


def verify(supabase, simulation_id: str, slug: str) -> list[dict]:
    """Check available_dungeons view and print results."""
    resp = (
        supabase.table("available_dungeons")
        .select("*")
        .eq("simulation_id", simulation_id)
        .execute()
    )
    available = resp.data or []
    if available:
        _ok(f"{len(available)} archetype(s) available for {slug}:")
        for d in available:
            print(f"       {d['archetype']} — mag {d['effective_magnitude']}, "
                  f"diff {d['suggested_difficulty']}, depth {d['suggested_depth']}, "
                  f"{'AVAILABLE' if d.get('available') else 'RUN ACTIVE'}")
    else:
        _info(f"No archetypes available for {slug}")
    return available


def start_run(
    supabase, simulation_id: str, slug: str,
    archetype: str, difficulty: int = 2,
) -> str | None:
    """Start a dungeon run via the backend API. Returns run_id or None."""
    _heading("Starting dungeon run via API...")

    # Get auth token
    token = get_auth_token(supabase)
    if not token:
        _err("Cannot start run without auth token")
        return None

    # Pick party agents (first 3-4)
    agents = get_agents(supabase, simulation_id, limit=4)
    if len(agents) < 2:
        _err(f"Need at least 2 agents, found {len(agents)}")
        return None

    party_ids = [a["id"] for a in agents[:4]]
    party_names = [a["name"] for a in agents[:4]]
    _info(f"Party: {', '.join(party_names)}")

    body = {
        "archetype": archetype,
        "party_agent_ids": party_ids,
        "difficulty": difficulty,
    }

    result = api_call(
        "POST",
        f"/api/v1/dungeons/runs?simulation_id={simulation_id}",
        token,
        body,
    )

    if not result:
        return None

    run_data = result.get("data", result)
    run_id = run_data.get("run_id") or run_data.get("id")

    if run_id:
        _ok(f"Dungeon run started: {run_id}")
        _ok(f"Archetype: {archetype}, Difficulty: {difficulty}")

        # Fetch initial state to confirm
        state = api_call("GET", f"/api/v1/dungeons/runs/{run_id}/state", token)
        if state and state.get("data"):
            s = state["data"]
            _ok(f"Phase: {s.get('phase')}, Rooms: {len(s.get('rooms', []))}, "
                f"Party: {len(s.get('party', []))}")
        return run_id
    else:
        _err(f"Unexpected response: {json.dumps(run_data)[:200]}")
        return None


def cleanup(supabase) -> None:
    """Remove all test-seeded data (identified by a0/a1 UUID prefix)."""
    _heading("Cleaning up test data...")

    # Delete dungeon events for test runs
    runs_resp = supabase.table("resonance_dungeon_runs").select("id").like("id", "a%").execute()
    if runs_resp.data:
        for r in runs_resp.data:
            supabase.table("resonance_dungeon_events").delete().eq("run_id", r["id"]).execute()

    # Delete runs linked to test resonances
    r3 = supabase.table("resonance_dungeon_runs").delete().like("id", "a%").execute()
    c3 = len(r3.data) if r3.data else 0

    # Delete impacts (FK first)
    r1 = supabase.table("resonance_impacts").delete().like("id", f"{_IMP_PREFIX}%").execute()
    c1 = len(r1.data) if r1.data else 0

    # Delete resonances
    r2 = supabase.table("substrate_resonances").delete().like("id", f"{_RES_PREFIX}%").execute()
    c2 = len(r2.data) if r2.data else 0

    _ok(f"Removed: {c2} resonances, {c1} impacts, {c3} runs")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed Resonance Dungeons test data for E2E testing",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n"
               "  %(prog)s                          # Seed The Shadow for conventional-memory\n"
               "  %(prog)s --start-run               # Seed + auto-start a dungeon run\n"
               "  %(prog)s -s velgarien -a 'The Tower,The Shadow'\n"
               "  %(prog)s --verify                  # Check current state\n"
               "  %(prog)s --cleanup                 # Remove test data\n",
    )
    parser.add_argument("-s", "--simulation", default=DEFAULT_SIM,
                        help=f"Simulation slug (default: {DEFAULT_SIM})")
    parser.add_argument("-a", "--archetypes", default="The Shadow",
                        help='Comma-separated archetypes (default: "The Shadow")')
    parser.add_argument("-d", "--difficulty", type=int, default=2,
                        help="Difficulty for --start-run (1-5, default: 2)")
    parser.add_argument("--start-run", action="store_true",
                        help="Also start a dungeon run via API after seeding")
    parser.add_argument("--verify", action="store_true",
                        help="Just check current state, no mutations")
    parser.add_argument("--cleanup", action="store_true",
                        help="Remove all test-seeded data")
    parser.add_argument("--list-agents", action="store_true",
                        help="List agents for the simulation")
    args = parser.parse_args()

    # Connect
    supabase = get_supabase()

    # Cleanup mode
    if args.cleanup:
        cleanup(supabase)
        return

    # Resolve simulation
    sim_id = resolve_simulation(supabase, args.simulation)
    if not sim_id:
        _err(f"Simulation '{args.simulation}' not found")
        sys.exit(1)

    _heading(f"Simulation: {args.simulation} ({sim_id})")

    # List agents mode
    if args.list_agents:
        agents = get_agents(supabase, sim_id)
        for a in agents:
            print(f"  {a['id']}  {a['name']}")
        return

    # Verify mode
    if args.verify:
        _heading("Verifying dungeon data...")
        verify(supabase, sim_id, args.simulation)
        agents = get_agents(supabase, sim_id)
        _info(f"{len(agents)} agents in simulation")
        return

    # Check backend if we need it
    if args.start_run:
        if not check_backend():
            _err(f"Backend not running at {BACKEND_URL}. Start it first.")
            sys.exit(1)

    # Parse + validate archetypes
    archetypes = [a.strip() for a in args.archetypes.split(",")]
    for arch in archetypes:
        if arch not in VALID_ARCHETYPES:
            _err(f"Invalid archetype '{arch}'")
            _info(f"Valid: {', '.join(VALID_ARCHETYPES)}")
            sys.exit(1)

    # Seed
    _heading(f"Seeding {len(archetypes)} archetype(s)...")
    for i, arch in enumerate(archetypes, start=1):
        res_id = seed_archetype(supabase, arch, i)
        seed_impact(supabase, res_id, sim_id, i)

    # Seed aptitudes for party agents
    agents = get_agents(supabase, sim_id, limit=6)
    if agents:
        seed_aptitudes(supabase, sim_id, agents[:4])

    # Verify
    _heading("Verification")
    available = verify(supabase, sim_id, args.simulation)

    _info(f"{len(agents)} agents for party: {', '.join(a['name'] for a in agents)}")

    # Auto-start run
    if args.start_run and available:
        first_archetype = archetypes[0]
        run_id = start_run(supabase, sim_id, args.simulation, first_archetype, args.difficulty)
        if run_id:
            print("\n\033[1;32mDungeon active!\033[0m")
            print(f"  Open: {FRONTEND_URL}/simulations/{args.simulation}/dungeon")
            print(f"  Run ID: {run_id}")
    elif not args.start_run:
        print("\n\033[1mReady!\033[0m Navigate to:")
        print(f"  {FRONTEND_URL}/simulations/{args.simulation}/dungeon")
        print("  Type 'dungeon' in the terminal to start a run.")
        print("  Or re-run with --start-run to auto-start.")


if __name__ == "__main__":
    main()
