"""Generate all 16 embassy images: 12 embassy buildings + 4 ambassador agents.

Uses pre-written prompts from embassy_prompts.py passed as description_override,
skipping the LLM description step and going straight to Flux Dev → AVIF → storage.

Embassy buildings span all 4 simulations, so each image request targets the correct
simulation's /generate/image endpoint to pick up the right style prompt.

Requires: backend running on localhost:8000, valid Replicate API key in .env,
          local Supabase running with migration 028 applied.

Usage:
    python scripts/generate_embassy_images.py               # All 16 images
    python scripts/generate_embassy_images.py --portraits-only   # 4 ambassadors only
    python scripts/generate_embassy_images.py --buildings-only   # 12 buildings only
"""

import json
import os
import subprocess
import sys
import time

import requests

BASE_URL = "http://localhost:8000"
SUPABASE_URL = "http://127.0.0.1:54321"

# Login credentials (test user from seed 001)
EMAIL = os.environ.get("PLATFORM_ADMIN_EMAIL", "matthias@leihs.at")
PASSWORD = os.environ.get("PLATFORM_ADMIN_PASSWORD", "met123")

# Pre-written prompts
sys.path.insert(0, ".")
from backend.services.embassy_prompts import (  # noqa: E402
    AMBASSADOR_PORTRAIT_PROMPTS,
    EMBASSY_BUILDING_PROMPTS,
)


def get_jwt_token() -> str:
    """Authenticate via Supabase Auth and return access token."""
    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        json={"email": EMAIL, "password": PASSWORD},
        headers={
            "apikey": get_anon_key(),
            "Content-Type": "application/json",
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def get_anon_key() -> str:
    """Read the Supabase anon key."""
    return (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9."
        "CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    )


def psql_json(query: str) -> list:
    """Run a psql query and return JSON results."""
    wrapped = f"SELECT json_agg(t) FROM ({query}) t;"
    result = subprocess.run(
        [
            "docker", "exec", "supabase_db_velgarien-rebuild",
            "psql", "-U", "postgres", "-t", "-A", "-c", wrapped,
        ],
        capture_output=True,
        text=True,
    )
    raw = result.stdout.strip()
    if not raw:
        return []
    return json.loads(raw) or []


def get_embassy_buildings() -> list[tuple[str, str, str, str]]:
    """Query DB for embassy buildings: (id, name, simulation_id, building_type)."""
    rows = psql_json(
        "SELECT b.id, b.name, b.simulation_id::text, b.building_type "
        "FROM buildings b "
        "WHERE b.special_type = 'embassy' AND b.deleted_at IS NULL "
        "ORDER BY b.simulation_id, b.name"
    )
    return [
        (row["id"], row["name"], row["simulation_id"], row["building_type"])
        for row in rows
    ]


def get_ambassador_agents() -> list[tuple[str, str, str, dict]]:
    """Query DB for ambassador agents: (id, name, simulation_id, data)."""
    ambassador_names = list(AMBASSADOR_PORTRAIT_PROMPTS.keys())
    name_list = ", ".join(f"'{n}'" for n in ambassador_names)
    rows = psql_json(
        f"SELECT a.id, a.name, a.simulation_id::text, "
        f"a.character, a.background "
        f"FROM agents a "
        f"WHERE a.name IN ({name_list}) AND a.deleted_at IS NULL "
        f"ORDER BY a.simulation_id, a.name"
    )
    return [
        (
            row["id"],
            row["name"],
            row["simulation_id"],
            {
                "character": row.get("character") or "",
                "background": row.get("background") or "",
            },
        )
        for row in rows
    ]


def generate_image(
    token: str,
    simulation_id: str,
    entity_type: str,
    entity_id: str,
    entity_name: str,
    extra: dict | None = None,
) -> str:
    """Call the /generate/image endpoint and return the image URL."""
    url = f"{BASE_URL}/api/v1/simulations/{simulation_id}/generate/image"
    payload = {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_name": entity_name,
    }
    if extra:
        payload["extra"] = extra

    resp = requests.post(
        url,
        json=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("data", {}).get("image_url", "NO URL")


def main():
    portraits_only = "--portraits-only" in sys.argv
    buildings_only = "--buildings-only" in sys.argv

    print("=== Embassy Image Generation ===\n")

    # Query DB for entities
    print("Querying DB for embassy buildings and ambassador agents...")
    buildings = get_embassy_buildings()
    agents = get_ambassador_agents()
    print(f"  Found {len(buildings)} embassy buildings, {len(agents)} ambassadors\n")

    if not buildings_only and not agents:
        print("WARNING: No ambassador agents found. Is migration 028 applied?")
    if not portraits_only and not buildings:
        print("WARNING: No embassy buildings found. Is migration 028 applied?")

    # Check pre-written prompt coverage
    building_names = {b[1] for b in buildings}
    agent_names = {a[1] for a in agents}
    missing_buildings = building_names - set(EMBASSY_BUILDING_PROMPTS.keys())
    missing_agents = agent_names - set(AMBASSADOR_PORTRAIT_PROMPTS.keys())
    if missing_buildings:
        print(f"WARNING: No pre-written prompts for buildings: {missing_buildings}")
    if missing_agents:
        print(f"WARNING: No pre-written prompts for agents: {missing_agents}")

    # Authenticate
    print("Authenticating...")
    token = get_jwt_token()
    print(f"  Got JWT token: {token[:20]}...\n")

    # Building images
    if not portraits_only:
        print(f"--- Embassy Building Images ({len(buildings)}) ---")
        for building_id, name, sim_id, building_type in buildings:
            prompt = EMBASSY_BUILDING_PROMPTS.get(name)
            if not prompt:
                print(f"  SKIP {name} — no pre-written prompt")
                continue

            print(f"  Generating image for {name} (sim {sim_id[:8]}...)...")
            try:
                url = generate_image(
                    token,
                    sim_id,
                    "building",
                    building_id,
                    name,
                    extra={
                        "building_type": building_type,
                        "description_override": prompt,
                    },
                )
                print(f"    -> {url}")
            except Exception as e:
                print(f"    !! ERROR: {e}")
            time.sleep(2)

    # Ambassador portraits
    if not buildings_only:
        print(f"\n--- Ambassador Portraits ({len(agents)}) ---")
        for agent_id, name, sim_id, agent_data in agents:
            prompt = AMBASSADOR_PORTRAIT_PROMPTS.get(name)
            if not prompt:
                print(f"  SKIP {name} — no pre-written prompt")
                continue

            print(f"  Generating portrait for {name} (sim {sim_id[:8]}...)...")
            try:
                url = generate_image(
                    token,
                    sim_id,
                    "agent",
                    agent_id,
                    name,
                    extra={
                        **agent_data,
                        "description_override": prompt,
                    },
                )
                print(f"    -> {url}")
            except Exception as e:
                print(f"    !! ERROR: {e}")
            time.sleep(2)

    print("\n=== Done ===")


if __name__ == "__main__":
    main()
