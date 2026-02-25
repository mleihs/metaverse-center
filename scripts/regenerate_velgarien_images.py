"""Regenerate old Velgarien images: delete old files from buckets, then generate new ones.

Targets only agents/buildings that already had images BEFORE the previous batch run.
Agents: Doktor Fenn, Elena Voss, General Aldric Wolf, Lena Kray, Mira Steinfeld
Buildings: Kanzlerpalast, Kathedrale des Lichts

Requires: backend running on localhost:8000, valid Replicate API key in .env.
"""

import time

import requests

BASE_URL = "http://localhost:8000"
SIM_ID = "10000000-0000-0000-0000-000000000001"
SUPABASE_URL = "http://127.0.0.1:54321"

EMAIL = "admin@velgarien.dev"
PASSWORD = "velgarien-dev-2026"

ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

# Old image file paths to delete (extracted from current portrait_image_url / image_url)
# Format: (bucket, object_path)
OLD_AGENT_FILES = [
    ("agent.portraits", f"{SIM_ID}/9507783f-94d0-42f3-ba8e-b839fbfec6e7/66cbb229-e16e-4ba0-90f4-a6c4e21f30a9.webp"),
    ("agent.portraits", f"{SIM_ID}/9e2d5c8e-ab2d-49a0-b7ce-ed5026374a61/b95cc2db-3a90-4018-b7dd-e9185ebd3c21.webp"),
    ("agent.portraits", f"{SIM_ID}/eac25949-d707-4d70-bdaa-253f206b2833/1dcc4f6e-9b7f-47ed-9d74-796b2a709b31.webp"),
    ("agent.portraits", f"{SIM_ID}/3f929519-12b3-4aa6-8017-91b50a27dc77/cbd575c2-c811-4b23-8c59-c2d7f8c21c80.webp"),
    ("agent.portraits", f"{SIM_ID}/9caeeb9d-ed18-4bd3-ab59-025b0de7b766/b79e8ee2-6a79-4ee4-99e5-269f4d9adb8d.webp"),
]

OLD_BUILDING_FILES = [
    ("building.images", f"{SIM_ID}/6c8947a3-1fdb-4e38-910b-c223d6ad0006/bdef67ca-76ef-4f62-8363-7a1f5c0dd328.webp"),
    ("building.images", f"{SIM_ID}/c966ea5d-02c7-44bb-93fb-f32bffd3bab6/7671b5ec-2093-4960-b917-167d4dd24b61.webp"),
]


def get_jwt_token() -> str:
    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        json={"email": EMAIL, "password": PASSWORD},
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def delete_storage_object(bucket: str, path: str) -> bool:
    """Delete a file from Supabase Storage using the service_role key."""
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    resp = requests.delete(
        url,
        headers={
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "apikey": SERVICE_ROLE_KEY,
        },
        timeout=10,
    )
    if resp.status_code in (200, 204):
        return True
    if resp.status_code == 404:
        print(f"    (not found, skipping)")
        return True
    print(f"    !! Delete failed: {resp.status_code} {resp.text}")
    return False


def generate_image(token: str, entity_type: str, entity_id: str, entity_name: str, extra: dict | None = None) -> str:
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
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("data", {}).get("image_url", "NO URL")


def main():
    print("=== Velgarien Image Regeneration (replace old) ===\n")

    # Authenticate
    print("Authenticating...")
    token = get_jwt_token()
    print(f"  Got JWT token: {token[:20]}...\n")

    # Step 1: Delete old agent portraits from storage
    print("--- Deleting old agent portraits (5) ---")
    for bucket, path in OLD_AGENT_FILES:
        print(f"  Deleting {path}...")
        delete_storage_object(bucket, path)

    # Step 2: Delete old building images from storage
    print("\n--- Deleting old building images (2) ---")
    for bucket, path in OLD_BUILDING_FILES:
        print(f"  Deleting {path}...")
        delete_storage_object(bucket, path)

    # Step 3: Regenerate agent portraits
    agents = [
        ("9507783f-94d0-42f3-ba8e-b839fbfec6e7", "Doktor Fenn"),
        ("9e2d5c8e-ab2d-49a0-b7ce-ed5026374a61", "Elena Voss"),
        ("eac25949-d707-4d70-bdaa-253f206b2833", "General Aldric Wolf"),
        ("3f929519-12b3-4aa6-8017-91b50a27dc77", "Lena Kray"),
        ("9caeeb9d-ed18-4bd3-ab59-025b0de7b766", "Mira Steinfeld"),
    ]

    print("\n--- Generating new agent portraits (5) ---")
    for agent_id, name in agents:
        print(f"  Generating portrait for {name}...")
        try:
            url = generate_image(token, "agent", agent_id, name)
            print(f"    -> {url}")
        except Exception as e:
            print(f"    !! ERROR: {e}")
        time.sleep(2)

    # Step 4: Regenerate building images
    buildings = [
        ("6c8947a3-1fdb-4e38-910b-c223d6ad0006", "Kanzlerpalast", {
            "building_type": "government",
            "building_condition": "excellent",
            "description": "Der Kanzlerpalast erhebt sich wie ein monolithisches Grabmal aus grauem Sichtbeton ueber die restliche Stadt.",
            "zone_name": "Regierungsviertel",
        }),
        ("c966ea5d-02c7-44bb-93fb-f32bffd3bab6", "Kathedrale des Lichts", {
            "building_type": "cultural",
            "building_condition": "good",
            "description": "Die Kathedrale des Lichts erhebt sich als monumentaler Betonklotz ueber dem grauen Stadtviertel.",
            "zone_name": "Altstadt",
        }),
    ]

    print("\n--- Generating new building images (2) ---")
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
