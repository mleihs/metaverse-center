"""Generate missing images for the Velgarien simulation.

3 agent portraits + 4 building images via the /generate/image API.
Requires: backend running on localhost:8000, valid Replicate API key in .env.
"""

import time

import requests

BASE_URL = "http://localhost:8000"
SIM_ID = "10000000-0000-0000-0000-000000000001"
SUPABASE_URL = "http://127.0.0.1:54321"

# Login credentials (test user from seed 001)
EMAIL = "admin@velgarien.dev"
PASSWORD = "velgarien-dev-2026"


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
    """Standard local Supabase anon key."""
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
    print("=== Velgarien Image Generation (missing) ===\n")

    # Authenticate
    print("Authenticating...")
    token = get_jwt_token()
    print(f"  Got JWT token: {token[:20]}...\n")

    # Agent portraits (3 missing)
    agents = [
        ("8e93a0da-da9f-4262-a500-34080541bfe3", "Pater Cornelius"),
        ("d115c826-96f0-4fcd-8865-6d9a691b301c", "Schwester Irma"),
        ("dc4cff8d-21a2-4008-9396-f9e52bf2a61e", "Viktor Harken"),
    ]

    print("--- Agent Portraits (3) ---")
    for agent_id, name in agents:
        print(f"  Generating portrait for {name}...")
        try:
            url = generate_image(token, "agent", agent_id, name)
            print(f"    -> {url}")
        except Exception as e:
            print(f"    !! ERROR: {e}")
        time.sleep(2)

    # Building images (4 missing)
    buildings = [
        ("80906ca3-3753-4921-914b-ab9dbf528495", "Militaerakademie Wolf", {
            "building_type": "government",
            "building_condition": "good",
            "description": "Ausbildungsstaette der velgarischen Streitkraefte",
            "zone_name": "Regierungsviertel",
        }),
        ("e0ccf60b-71d0-4ac2-93c3-53b62a39e829", "Steinfeld-Redaktion", {
            "building_type": "commercial",
            "building_condition": "fair",
            "description": "Bueros der unabhaengigen Zeitung",
            "zone_name": "Altstadt",
        }),
        ("90fe6137-8668-497f-a286-15cb8b73cfa4", "Voss-Industriewerk", {
            "building_type": "commercial",
            "building_condition": "good",
            "description": "Das Flaggschiff der Voss-Industriegruppe",
            "zone_name": "Industriegebiet Nord",
        }),
        ("23425980-f031-401e-9d9f-05303e92038d", "Wohnhaus am Markt", {
            "building_type": "residential",
            "building_condition": "poor",
            "description": "Von Schwester Irma gefuehrte Unterkunft fuer Obdachlose",
            "zone_name": "Altstadt",
        }),
    ]

    print("\n--- Building Images (4) ---")
    for building_id, name, extra in buildings:
        print(f"  Generating image for {name}...")
        try:
            url = generate_image(token, "building", building_id, name, extra)
            print(f"    -> {url}")
        except Exception as e:
            print(f"    !! ERROR: {e}")
        time.sleep(2)

    print("\n=== Done ===")


if __name__ == "__main__":
    main()
