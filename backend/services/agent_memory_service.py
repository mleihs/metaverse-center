"""Agent Memory & Reflection service — Stanford Generative Agents-style memory loop."""

from __future__ import annotations

import json
import logging
from uuid import UUID

from backend.config import settings
from backend.services.embedding_service import EmbeddingService
from backend.services.generation_service import GenerationService
from backend.services.translation_service import schedule_auto_translation
from supabase import Client, create_client

logger = logging.getLogger(__name__)

MOCK_OBSERVATIONS = [
    {"content": "The user seems interested in the city's history.", "importance": 6},
]

MOCK_REFLECTIONS = [
    {"content": "I notice a pattern — visitors always ask about the old quarter first.", "importance": 7},
]


def _admin_client() -> Client:
    """Create a service-role Supabase client for memory writes."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


class AgentMemoryService:
    """Manages agent memory: observe, store, retrieve, reflect."""

    # ── Record ────────────────────────────────────────────────────────

    @classmethod
    async def record_observation(
        cls,
        supabase: Client,
        agent_id: UUID,
        simulation_id: UUID,
        content: str,
        importance: int = 5,
        source_type: str = "chat",
        source_id: UUID | None = None,
        memory_type: str = "observation",
        api_key: str | None = None,
    ) -> dict:
        """Store a memory with its embedding vector."""
        embedding = await EmbeddingService.embed(content, api_key=api_key)

        record = {
            "agent_id": str(agent_id),
            "simulation_id": str(simulation_id),
            "memory_type": memory_type,
            "content": content,
            "importance": max(1, min(10, importance)),
            "source_type": source_type,
            "source_id": str(source_id) if source_id else None,
            "embedding": str(embedding),
        }
        resp = supabase.table("agent_memories").insert(record).execute()
        saved = resp.data[0]

        # Get simulation info for translation
        sim_resp = (
            supabase.table("simulations")
            .select("name, theme")
            .eq("id", str(simulation_id))
            .limit(1)
            .execute()
        )
        if sim_resp.data:
            schedule_auto_translation(
                supabase,
                "agent_memories",
                saved["id"],
                {"content": content},
                sim_resp.data[0]["name"],
                sim_resp.data[0].get("theme", "dystopian"),
                entity_type="agent_memory",
            )

        return saved

    # ── Extract from chat ────────────────────────────────────────────

    @classmethod
    async def extract_from_chat(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
        user_message: str,
        agent_response: str,
        api_key: str | None = None,
    ) -> list[dict]:
        """Extract memorable observations from a chat exchange.

        Uses an admin client for writes (fire-and-forget from chat, RLS requires service_role).
        """
        admin = _admin_client()

        if settings.forge_mock_mode:
            logger.info("MOCK_MODE: returning template observations")
            saved = []
            for obs in MOCK_OBSERVATIONS:
                record = await cls.record_observation(
                    admin, agent_id, simulation_id,
                    obs["content"], obs["importance"],
                    source_type="chat", api_key=api_key,
                )
                saved.append(record)
            return saved

        # Get simulation name (reads are fine with any client)
        sim_resp = (
            supabase.table("simulations")
            .select("name")
            .eq("id", str(simulation_id))
            .limit(1)
            .execute()
        )
        sim_name = sim_resp.data[0]["name"] if sim_resp.data else "Unknown"

        # Get agent name
        agent_resp = (
            supabase.table("agents")
            .select("name")
            .eq("id", str(agent_id))
            .limit(1)
            .execute()
        )
        agent_name = agent_resp.data[0]["name"] if agent_resp.data else "Agent"

        gen = GenerationService(admin, simulation_id, api_key or settings.openrouter_api_key)
        result = await gen._generate(
            template_type="memory_extraction",
            model_purpose="chat_response",
            variables={
                "agent_name": agent_name,
                "simulation_name": sim_name,
                "user_message": user_message[:500],
                "agent_response": agent_response[:500],
            },
            locale="en",
        )

        parsed = GenerationService._parse_json_content(result.get("content", ""))
        observations = parsed.get("observations", []) if parsed else []

        saved = []
        for obs in observations:
            if not obs.get("content"):
                continue
            record = await cls.record_observation(
                admin, agent_id, simulation_id,
                obs["content"],
                obs.get("importance", 5),
                source_type="chat",
                api_key=api_key,
            )
            saved.append(record)

        return saved

    # ── Retrieve (Stanford formula) ──────────────────────────────────

    @classmethod
    async def retrieve(
        cls,
        supabase: Client,
        agent_id: UUID,
        simulation_id: UUID,
        query_text: str | None = None,
        top_k: int = 10,
        api_key: str | None = None,
    ) -> list[dict]:
        """Retrieve memories ranked by semantic similarity + importance + recency.

        Uses Postgres ``retrieve_agent_memories`` RPC (migration 067).
        """
        embedding = None
        if query_text:
            embedding = await EmbeddingService.embed(query_text, api_key=api_key)

        params: dict = {
            "p_agent_id": str(agent_id),
            "p_top_k": top_k,
        }
        if embedding:
            params["p_query_embedding"] = str(embedding)

        response = supabase.rpc("retrieve_agent_memories", params).execute()
        memories = response.data or []

        # Update last_accessed_at for retrieved memories
        if memories:
            memory_ids = [m["id"] for m in memories]
            supabase.table("agent_memories").update(
                {"last_accessed_at": "now()"}
            ).in_("id", memory_ids).execute()

        return memories

    # ── Reflect ──────────────────────────────────────────────────────

    @classmethod
    async def reflect(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
        locale: str = "en",
        api_key: str | None = None,
    ) -> list[dict]:
        """Synthesize higher-level reflections from recent observations."""
        # Fetch recent observations
        obs_resp = (
            supabase.table("agent_memories")
            .select("content, importance, created_at")
            .eq("agent_id", str(agent_id))
            .eq("simulation_id", str(simulation_id))
            .eq("memory_type", "observation")
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        observations = obs_resp.data or []

        if len(observations) < 5:
            return []

        if settings.forge_mock_mode:
            logger.info("MOCK_MODE: returning template reflections")
            saved = []
            for ref in MOCK_REFLECTIONS:
                record = await cls.record_observation(
                    supabase, agent_id, simulation_id,
                    ref["content"], ref["importance"],
                    source_type="reflection", memory_type="reflection",
                    api_key=api_key,
                )
                saved.append(record)
            return saved

        # Get names
        sim_resp = (
            supabase.table("simulations")
            .select("name")
            .eq("id", str(simulation_id))
            .limit(1)
            .execute()
        )
        sim_name = sim_resp.data[0]["name"] if sim_resp.data else "Unknown"

        agent_resp = (
            supabase.table("agents")
            .select("name")
            .eq("id", str(agent_id))
            .limit(1)
            .execute()
        )
        agent_name = agent_resp.data[0]["name"] if agent_resp.data else "Agent"

        # Format observations text
        obs_text = "\n".join(
            f"- [{o['importance']}/10] {o['content']}" for o in observations
        )

        gen = GenerationService(supabase, simulation_id, api_key or settings.openrouter_api_key)
        result = await gen._generate(
            template_type="memory_reflection",
            model_purpose="chat_response",
            variables={
                "agent_name": agent_name,
                "simulation_name": sim_name,
                "observations_text": obs_text,
            },
            locale=locale,
        )

        parsed = GenerationService._parse_json_content(result.get("content", ""))
        reflections = parsed.get("reflections", []) if parsed else []

        saved = []
        for ref in reflections:
            if not ref.get("content"):
                continue
            record = await cls.record_observation(
                supabase, agent_id, simulation_id,
                ref["content"],
                ref.get("importance", 7),
                source_type="reflection",
                memory_type="reflection",
                api_key=api_key,
            )
            saved.append(record)

        return saved

    # ── List (paginated) ─────────────────────────────────────────────

    @classmethod
    async def list_memories(
        cls,
        supabase: Client,
        agent_id: UUID,
        simulation_id: UUID,
        memory_type: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list, int]:
        """Paginated list of agent memories for display."""
        query = (
            supabase.table("agent_memories")
            .select("id, agent_id, simulation_id, memory_type, content, content_de, "
                     "importance, source_type, source_id, created_at, last_accessed_at",
                     count="exact")
            .eq("agent_id", str(agent_id))
            .eq("simulation_id", str(simulation_id))
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if memory_type:
            query = query.eq("memory_type", memory_type)

        response = query.execute()
        data = response.data or []
        total = response.count if response.count is not None else len(data)
        return data, total

    # ── Format for prompt injection ──────────────────────────────────

    @classmethod
    def format_for_prompt(cls, memories: list[dict]) -> str:
        """Format memories as text block for system prompt injection."""
        if not memories:
            return ""

        lines = ["Your memories and reflections:"]
        for m in memories:
            mtype = m.get("memory_type", "observation")
            importance = m.get("importance", 5)
            content = m.get("content", "")
            lines.append(f"- [{importance}/10] {content} ({mtype})")
        return "\n".join(lines)
