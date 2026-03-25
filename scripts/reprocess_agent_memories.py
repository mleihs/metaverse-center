"""Re-extract agent memories from original chat messages.

Fixes observations that were truncated by the old 500-char input limit
in AgentMemoryService.extract_from_chat(). The original full messages
are preserved in chat_messages — this script re-processes them with
the current 2000-char limit.

Usage:
    # From project root, with .env loaded:
    python scripts/reprocess_agent_memories.py --agent-name "Doktor Fenn" --simulation-slug velgarien

    # Dry run (shows what would be re-processed, no changes):
    python scripts/reprocess_agent_memories.py --agent-name "Doktor Fenn" --simulation-slug velgarien --dry-run
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from uuid import UUID

# Add project root to path so we can import backend modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

MEMORY_EXTRACTION_SYSTEM_PROMPT = (
    "You extract memorable observations from conversations. "
    "Focus on emotionally significant, relationship-changing, or "
    "world-revealing moments. Trivial small talk produces empty observations."
)

CHAR_LIMIT_OLD = 500
CHAR_LIMIT_NEW = 2000


async def supabase_get(path: str, params: dict | None = None) -> list[dict]:
    """GET from Supabase REST API."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/{path}",
            headers=HEADERS,
            params=params or {},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()


async def supabase_delete(path: str) -> None:
    """DELETE from Supabase REST API."""
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{SUPABASE_URL}/rest/v1/{path}",
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()


async def supabase_post(path: str, data: dict) -> dict:
    """POST to Supabase REST API."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/{path}",
            headers=HEADERS,
            json=data,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()[0] if resp.json() else {}


async def openrouter_generate(agent_name: str, sim_name: str,
                               user_msg: str, agent_resp: str) -> list[dict]:
    """Call OpenRouter to extract observations from a chat exchange."""
    prompt = (
        f"Analyze this conversation between a user and {agent_name} in {sim_name}:\n\n"
        f"User: {user_msg[:CHAR_LIMIT_NEW]}\n"
        f"{agent_name}: {agent_resp[:CHAR_LIMIT_NEW]}\n\n"
        f"Extract 0-2 key observations that {agent_name} would remember.\n"
        f'Return JSON: {{"observations": [{{"content": "...", "importance": 1-10}}]}}\n'
        f'If nothing noteworthy: {{"observations": []}}'
    )

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "anthropic/claude-sonnet-4",
                "messages": [
                    {"role": "system", "content": MEMORY_EXTRACTION_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 300,
            },
            timeout=60,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]

    # Parse JSON from response (handle markdown code blocks)
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(content)
        return parsed.get("observations", [])
    except json.JSONDecodeError:
        print(f"  WARNING: Could not parse LLM response: {content[:100]}")
        return []


async def get_embedding(text: str) -> list[float]:
    """Get embedding vector via OpenRouter."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/embeddings",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "openai/text-embedding-3-small",
                "input": text,
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["data"][0]["embedding"]


async def main() -> None:
    parser = argparse.ArgumentParser(description="Re-extract agent memories from chat history")
    parser.add_argument("--agent-name", required=True, help="Agent name (e.g. 'Doktor Fenn')")
    parser.add_argument("--simulation-slug", required=True, help="Simulation slug (e.g. 'velgarien')")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without changes")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set", file=sys.stderr)
        sys.exit(1)
    if not OPENROUTER_API_KEY and not args.dry_run:
        print("ERROR: OPENROUTER_API_KEY must be set for LLM calls", file=sys.stderr)
        sys.exit(1)

    # 1. Find simulation
    sims = await supabase_get("simulations", {
        "select": "id,name",
        "slug": f"eq.{args.simulation_slug}",
    })
    if not sims:
        print(f"ERROR: Simulation '{args.simulation_slug}' not found", file=sys.stderr)
        sys.exit(1)
    sim = sims[0]
    sim_id = sim["id"]
    sim_name = sim["name"]
    print(f"Simulation: {sim_name} ({sim_id})")

    # 2. Find agent
    agents = await supabase_get("agents", {
        "select": "id,name",
        "simulation_id": f"eq.{sim_id}",
        "name": f"eq.{args.agent_name}",
    })
    if not agents:
        print(f"ERROR: Agent '{args.agent_name}' not found in {sim_name}", file=sys.stderr)
        sys.exit(1)
    agent = agents[0]
    agent_id = agent["id"]
    print(f"Agent: {agent['name']} ({agent_id})")

    # 3. Find conversations — both direct (agent_id on conversation) and group (agent_id on messages)
    direct_convs = await supabase_get("chat_conversations", {
        "select": "id",
        "agent_id": f"eq.{agent_id}",
        "simulation_id": f"eq.{sim_id}",
    })
    # Also find conversations where this agent has messages (group chats)
    agent_messages = await supabase_get("chat_messages", {
        "select": "conversation_id",
        "agent_id": f"eq.{agent_id}",
    })
    group_conv_ids = {m["conversation_id"] for m in agent_messages}
    direct_conv_ids = {c["id"] for c in direct_convs}
    all_conv_ids = direct_conv_ids | group_conv_ids
    conversations = [{"id": cid} for cid in all_conv_ids]
    print(f"Found {len(conversations)} conversation(s) ({len(direct_conv_ids)} direct, {len(group_conv_ids - direct_conv_ids)} group)")

    if not conversations:
        print("No conversations to reprocess.")
        return

    # 4. Get all messages from these conversations, build user→agent pairs
    affected_pairs = []
    for conv in conversations:
        conv_id = conv["id"]
        messages = await supabase_get("chat_messages", {
            "select": "sender_role,content,created_at,agent_id",
            "conversation_id": f"eq.{conv_id}",
            "order": "created_at.asc",
        })

        # Build user→agent pairs: for each agent response, find the nearest preceding user message
        last_user_msg = None
        last_user_date = None
        for m in messages:
            if m["sender_role"] == "user":
                last_user_msg = m["content"]
                last_user_date = m["created_at"]
            elif (m["sender_role"] == "assistant"
                    and m.get("agent_id") == agent_id
                    and last_user_msg is not None):
                agent_resp = m["content"]
                was_truncated = len(last_user_msg) > CHAR_LIMIT_OLD or len(agent_resp) > CHAR_LIMIT_OLD
                if was_truncated:
                    affected_pairs.append({
                        "user_message": last_user_msg,
                        "agent_response": agent_resp,
                        "user_len": len(last_user_msg),
                        "agent_len": len(agent_resp),
                        "date": last_user_date,
                    })

    print(f"\nFound {len(affected_pairs)} message pair(s) where content exceeded 500 chars:")
    for p in affected_pairs:
        print(f"  {p['date'][:10]} — user: {p['user_len']} chars, agent: {p['agent_len']} chars")

    if not affected_pairs:
        print("\nNo truncated messages found. All observations should be complete.")
        return

    if args.dry_run:
        print("\n[DRY RUN] Would delete old chat observations and re-extract from full messages.")
        return

    # 5. Delete old chat-sourced observations for this agent
    old_obs = await supabase_get("agent_memories", {
        "select": "id",
        "agent_id": f"eq.{agent_id}",
        "simulation_id": f"eq.{sim_id}",
        "memory_type": "eq.observation",
        "source_type": "eq.chat",
    })
    print(f"\nDeleting {len(old_obs)} old chat observation(s)...")
    if old_obs:
        await supabase_delete(
            f"agent_memories?agent_id=eq.{agent_id}"
            f"&simulation_id=eq.{sim_id}"
            f"&memory_type=eq.observation"
            f"&source_type=eq.chat"
        )
    print("  Done.")

    # 6. Re-extract from ALL chat pairs (not just truncated ones, for consistency)
    all_pairs = []
    for conv in conversations:
        conv_id = conv["id"]
        messages = await supabase_get("chat_messages", {
            "select": "sender_role,content,created_at,agent_id",
            "conversation_id": f"eq.{conv_id}",
            "order": "created_at.asc",
        })
        last_user_msg = None
        for m in messages:
            if m["sender_role"] == "user":
                last_user_msg = m["content"]
            elif (m["sender_role"] == "assistant"
                    and m.get("agent_id") == agent_id
                    and last_user_msg is not None):
                all_pairs.append({
                    "user_message": last_user_msg,
                    "agent_response": m["content"],
                })

    print(f"\nRe-extracting observations from {len(all_pairs)} message pair(s)...")
    total_new = 0
    for idx, pair in enumerate(all_pairs, 1):
        print(f"  [{idx}/{len(all_pairs)}] Extracting...", end=" ", flush=True)
        observations = await openrouter_generate(
            agent["name"], sim_name,
            pair["user_message"], pair["agent_response"],
        )
        for obs in observations:
            content = obs.get("content", "").strip()
            if not content:
                continue
            importance = max(1, min(10, obs.get("importance", 5)))
            embedding = await get_embedding(content)
            await supabase_post("agent_memories", {
                "agent_id": agent_id,
                "simulation_id": sim_id,
                "memory_type": "observation",
                "content": content,
                "importance": importance,
                "source_type": "chat",
                "embedding": str(embedding),
            })
            total_new += 1
        print(f"{len(observations)} observation(s)")
        await asyncio.sleep(0.5)  # Rate limit courtesy

    print(f"\nDone. Created {total_new} new observation(s) from {len(all_pairs)} chat exchanges.")
    print("Existing reflections were preserved. Run 'Trigger Reflection' in the UI to update them.")


if __name__ == "__main__":
    asyncio.run(main())
