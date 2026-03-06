#!/usr/bin/env python3
"""
Image generation script for Spengbab's Whore House.
Produces authentic Spengbab-style fan art using Flux Dev.
"""

import argparse
import asyncio
import json
import logging
import os
import subprocess
import time
from uuid import UUID

import httpx

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

SIM_ID = "60000000-0000-0000-0000-000000000001"
API_BASE = os.getenv("VITE_BACKEND_URL", "http://localhost:8000")
SUPABASE_URL = "http://127.0.0.1:54321"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
ADMIN_EMAIL = "admin@velgarien.dev"
ADMIN_PASSWORD = "velgarien-dev-2026"

async def get_auth_token():
    """Login to Supabase to get a valid user JWT."""
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    logger.info(f"Authenticating {ADMIN_EMAIL}...")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("access_token")
            else:
                logger.error(f"Auth failed: {resp.status_code} - {resp.text}")
                return None
    except Exception as e:
        logger.error(f"Auth error: {e}")
        return None

def get_db_entities(entity_type):
    """Fetch entity data directly from local DB via docker psql."""
    table = "agents" if entity_type == "portrait" else "buildings"
    cmd = [
        "docker", "exec", "supabase_db_velgarien-rebuild", "psql", "-U", "postgres", "-d", "postgres", "-t", "-c",
        f"SELECT json_agg(t) FROM (SELECT * FROM {table} WHERE simulation_id = '{SIM_ID}') t"
    ]
    try:
        result = subprocess.check_output(cmd).decode('utf-8').strip()
        result = result.replace(' +', '').replace('\n', '')
        if not result:
            return []
        return json.loads(result)
    except Exception as e:
        logger.error(f"Failed to fetch {entity_type} from DB: {e}")
        return []

async def generate_image(token, entity_id, entity_name, entity_type, extra_data):
    """Call the backend image generation endpoint."""
    url = f"{API_BASE}/api/v1/simulations/{SIM_ID}/generate/image"
    payload = {
        "entity_id": str(entity_id),
        "entity_type": entity_type,
        "entity_name": entity_name,
        "extra": extra_data
    }
    
    headers = {
        "Authorization": f"Bearer {token}"
    }

    logger.info(f"Generating {entity_type} '{entity_name}' for {entity_id}...")
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                logger.info(f"Successfully generated {entity_type} '{entity_name}'")
                return True
            else:
                logger.error(f"Failed to generate {entity_type}: {resp.status_code} - {resp.text}")
                return False
    except Exception as e:
        logger.error(f"Error calling generation API: {e}")
        return False

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--portraits-only", action="store_true")
    parser.add_argument("--buildings-only", action="store_true")
    args = parser.parse_args()

    token = await get_auth_token()
    if not token:
        logger.error("No token obtained. Exiting.")
        return

    if not args.buildings_only:
        agents = get_db_entities("portrait")
        for agent in agents:
            extra = {
                "character": agent.get("character"),
                "background": agent.get("background")
            }
            await generate_image(token, agent["id"], agent["name"], "agent", extra)
            await asyncio.sleep(2)

    if not args.portraits_only:
        buildings = get_db_entities("building")
        for b in buildings:
            extra = {
                "description": b.get("description"),
                "building_type": b.get("building_type"),
                "building_condition": b.get("building_condition")
            }
            await generate_image(token, b["id"], b["name"], "building", extra)
            await asyncio.sleep(2)

if __name__ == "__main__":
    asyncio.run(main())
