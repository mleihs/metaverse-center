"""Generate all 10 images for the Capybara Kingdom simulation.

5 agent portraits + 5 building images via the /generate/image API.
Requires: backend running on localhost:8000, valid Replicate API key in .env.
"""

import json
import os
import sys
import time

import requests

BASE_URL = "http://localhost:8000"
SIM_ID = "20000000-0000-0000-0000-000000000001"
SUPABASE_URL = "http://127.0.0.1:54321"

# Login credentials (test user from seed 001)
EMAIL = os.environ.get("PLATFORM_ADMIN_EMAIL", "matthias@leihs.at")
PASSWORD = os.environ.get("PLATFORM_ADMIN_PASSWORD", "met123")


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
    """Read the Supabase anon key from .env or use the default local dev key."""
    # Standard local Supabase anon key
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"


def generate_image(token: str, entity_type: str, entity_id: str, entity_name: str, extra: dict | None = None) -> str:
    """Call the /generate/image endpoint and return the image URL."""
    url = f"{BASE_URL}/api/v1/simulations/{SIM_ID}/generate/image"
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
    print("=== Capybara Kingdom Image Generation ===\n")

    # Authenticate
    print("Authenticating...")
    token = get_jwt_token()
    print(f"  Got JWT token: {token[:20]}...\n")

    # Agent portraits
    agents = [
        ("4c1a118e-748d-4fb8-90b0-8e468cf6e6db", "Commodore Whiskers"),
        ("baf128d9-da69-4787-a8f7-480584bf8b16", "Lady Caplin of Mudhollow"),
        ("de343ffc-e7d1-4a25-85f8-1161eaf073a0", "The Archivist"),
        ("6374fd3f-025d-45a4-ad6d-e382902b7442", "Sister Ember"),
        ("6b94a89f-69d7-4582-b109-35196eb33297", "Barnaby Gnaw"),
    ]

    print("--- Agent Portraits (5) ---")
    for agent_id, name in agents:
        print(f"  Generating portrait for {name}...")
        try:
            url = generate_image(token, "agent", agent_id, name)
            print(f"    -> {url}")
        except Exception as e:
            print(f"    !! ERROR: {e}")
        time.sleep(2)  # Respect rate limits

    # Building images
    buildings = [
        ("f74b8388-d8cb-44eb-a69e-2d37ebe432a6", "The Drowned Library", {
            "building_type": "special",
            "building_condition": "fair",
            "description": "A vast archive built into a flooded cavern. Bookshelves rise from dark water on stone pillars, connected by narrow bridges and rope pulleys. Bioluminescent algae provides a sickly green reading light.",
            "zone_name": "Deepreach",
        }),
        ("a44e7b1b-3701-41a1-8d44-47e7174615eb", "The Great Sporocarp", {
            "building_type": "religious",
            "building_condition": "excellent",
            "description": "The kingdom's cathedral — a colossal fungal growth that fills an entire cavern, pulsing with soft amber light. Pilgrims travel days through dangerous tunnels to kneel beneath its cap.",
            "zone_name": "The Fungal Warrens",
        }),
        ("0e1e1c75-ff2f-4dae-9f1f-83b107cbb03e", "Rootwater Market", {
            "building_type": "commercial",
            "building_condition": "good",
            "description": "A bustling subterranean marketplace built along an underground river. Stalls hang from stalactites and cling to cavern walls, connected by swaying rope bridges. Phosphorescent lanterns cast everything in amber and green.",
            "zone_name": "The Undertide Docks",
        }),
        ("c03957ba-535c-46d7-9368-4646ccbff540", "The Admiralty Grotto", {
            "building_type": "government",
            "building_condition": "good",
            "description": "Carved into a massive stalagmite, the Admiralty is where the kingdom's naval and political power converge. War rooms, cartography chambers, and a throne room that no one sits in anymore.",
            "zone_name": "The Upper Caverns",
        }),
        ("908b3525-7de5-494b-a418-a73ea5c0a228", "The Soggy Paw Tavern", {
            "building_type": "commercial",
            "building_condition": "poor",
            "description": "A beloved, ramshackle establishment wedged between two massive tree roots that have broken through the cavern ceiling. The floor is permanently damp. The ale is surprisingly good.",
            "zone_name": "The Undertide Docks",
        }),
    ]

    print("\n--- Building Images (5) ---")
    for building_id, name, extra in buildings:
        print(f"  Generating image for {name}...")
        try:
            url = generate_image(token, "building", building_id, name, extra)
            print(f"    -> {url}")
        except Exception as e:
            print(f"    !! ERROR: {e}")
        time.sleep(2)  # Respect rate limits

    print("\n=== Done ===")


if __name__ == "__main__":
    main()
