"""Service layer for chat operations — storage, orchestration, and validation."""

import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from backend.services.chat_ai_service import ChatAIService, SSEEvent
from backend.services.external_service_resolver import ExternalServiceResolver
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class ChatService:
    """Service for chat conversations and messages."""

    # ── Ownership validation ────────────────────────────────

    @staticmethod
    async def verify_ownership(
        supabase: Client,
        conversation_id: UUID,
        user_id: UUID,
    ) -> None:
        """Verify user owns this conversation. Raises 404 if not found/owned."""
        result = await (
            supabase.table("chat_conversations")
            .select("id")
            .eq("id", str(conversation_id))
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

    # ── Batch-load helpers (shared by list + single-load) ──

    @staticmethod
    async def _batch_load_agents(
        supabase: Client,
        conversation_ids: list[str],
    ) -> dict[str, list[dict]]:
        """Batch load agents for conversations. Returns {conv_id: [agent_dict]}."""
        if not conversation_ids:
            return {}
        response = await (
            supabase.table("chat_conversation_agents")
            .select("conversation_id, agent_id, agents(id, name, portrait_image_url)")
            .in_("conversation_id", conversation_ids)
            .order("added_at")
            .execute()
        )
        agents_by_conv: dict[str, list[dict]] = {}
        for row in response.data or []:
            agent_data = row.get("agents")
            if agent_data:
                agents_by_conv.setdefault(row["conversation_id"], []).append(agent_data)
        return agents_by_conv

    @staticmethod
    async def _batch_load_event_refs(
        supabase: Client,
        conversation_ids: list[str],
    ) -> dict[str, list[dict]]:
        """Batch load event references. Returns {conv_id: [ref_dict]}."""
        if not conversation_ids:
            return {}
        response = await (
            supabase.table("chat_event_references")
            .select(
                "id, conversation_id, event_id, referenced_at, "
                "events(title, event_type, description, occurred_at, impact_level)",
            )
            .in_("conversation_id", conversation_ids)
            .order("referenced_at")
            .execute()
        )
        refs_by_conv: dict[str, list[dict]] = {}
        for row in response.data or []:
            event_data = row.get("events", {}) or {}
            refs_by_conv.setdefault(row["conversation_id"], []).append(
                {
                    "id": row["id"],
                    "event_id": row["event_id"],
                    "event_title": event_data.get("title", ""),
                    "event_type": event_data.get("event_type"),
                    "event_description": event_data.get("description"),
                    "occurred_at": event_data.get("occurred_at"),
                    "impact_level": event_data.get("impact_level"),
                    "referenced_at": row["referenced_at"],
                }
            )
        return refs_by_conv

    # ── Single-load wrappers ────────────────────────────────

    @staticmethod
    async def _load_conversation_agents(
        supabase: Client,
        conversation_id: str,
    ) -> list[dict]:
        """Load agents for a single conversation via junction table."""
        agents_by_conv = await ChatService._batch_load_agents(supabase, [conversation_id])
        return agents_by_conv.get(conversation_id, [])

    @staticmethod
    async def _load_event_references(
        supabase: Client,
        conversation_id: str,
    ) -> list[dict]:
        """Load event references for a single conversation."""
        refs_by_conv = await ChatService._batch_load_event_refs(supabase, [conversation_id])
        return refs_by_conv.get(conversation_id, [])

    # ── Query methods ───────────────────────────────────────

    @staticmethod
    async def list_conversations(
        supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
    ) -> list[dict]:
        """List all conversations for the current user in a simulation."""
        response = await (
            supabase.table("chat_conversations")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("user_id", str(user_id))
            .order("last_message_at", desc=True)
            .execute()
        )
        conversations = response.data or []
        if not conversations:
            return []

        # Batch-load agents and event references (2 queries instead of N+1)
        conv_ids = [c["id"] for c in conversations]
        agents_by_conv = await ChatService._batch_load_agents(supabase, conv_ids)
        refs_by_conv = await ChatService._batch_load_event_refs(supabase, conv_ids)

        for conv in conversations:
            conv["agents"] = agents_by_conv.get(conv["id"], [])
            conv["event_references"] = refs_by_conv.get(conv["id"], [])

        return conversations

    @staticmethod
    async def create_conversation(
        supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
        agent_ids: list[UUID],
        title: str | None = None,
    ) -> dict:
        """Create a new conversation with one or more agents."""
        # Create the conversation (agent_id set to first agent for backwards compat)
        response = await (
            supabase.table("chat_conversations")
            .insert(
                {
                    "simulation_id": str(simulation_id),
                    "user_id": str(user_id),
                    "agent_id": str(agent_ids[0]),
                    "title": title,
                }
            )
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create conversation.",
            )

        conversation = response.data[0]

        # Insert all agents into junction table
        junction_rows = [
            {
                "conversation_id": conversation["id"],
                "agent_id": str(aid),
            }
            for aid in agent_ids
        ]
        await supabase.table("chat_conversation_agents").insert(junction_rows).execute()

        # Load agents for response
        conversation["agents"] = await ChatService._load_conversation_agents(
            supabase,
            conversation["id"],
        )
        conversation["event_references"] = []

        return conversation

    @staticmethod
    async def generate_ai_response(
        supabase: Client,
        simulation_id: UUID,
        conversation_id: UUID,
        user_message_content: str,
    ) -> list[dict]:
        """Orchestrate AI response generation (single or group).

        Resolves AI provider config, determines single vs. group based on
        agent count, and delegates to the appropriate ChatAIService method.

        Returns list of all new messages (user + assistant) in chronological order.
        """
        # Resolve AI configuration
        resolver = ExternalServiceResolver(supabase, simulation_id)
        ai_config = await resolver.get_ai_provider_config()
        chat_ai = ChatAIService(
            supabase,
            simulation_id,
            openrouter_api_key=ai_config.openrouter_api_key,
        )

        # Dispatch based on conversation agent count
        agents = await ChatService._load_conversation_agents(supabase, str(conversation_id))

        if len(agents) > 1:
            await chat_ai.generate_group_response(conversation_id, user_message_content)
        else:
            await chat_ai.generate_response(conversation_id, user_message_content)

        # Return all new messages (user + AI responses)
        return await ChatService.get_messages(
            supabase,
            conversation_id,
            limit=len(agents) + 1,
        )

    @staticmethod
    async def stream_ai_response(
        supabase: Client,
        simulation_id: UUID,
        conversation_id: UUID,
        user_message_content: str,
    ) -> AsyncIterator[SSEEvent]:
        """Stream AI response generation (single or group).

        Resolves AI provider config, determines single vs. group, and
        yields SSEEvent objects from the appropriate ChatAIService method.
        """
        resolver = ExternalServiceResolver(supabase, simulation_id)
        ai_config = await resolver.get_ai_provider_config()
        chat_ai = ChatAIService(
            supabase,
            simulation_id,
            openrouter_api_key=ai_config.openrouter_api_key,
        )

        agents = await ChatService._load_conversation_agents(supabase, str(conversation_id))

        if len(agents) > 1:
            async for event in chat_ai.stream_group_response(conversation_id, user_message_content):
                yield event
        else:
            async for event in chat_ai.stream_response(conversation_id, user_message_content):
                yield event

    @staticmethod
    async def get_messages(
        supabase: Client,
        conversation_id: UUID,
        *,
        limit: int = 50,
        before: str | None = None,
    ) -> list[dict]:
        """Get messages for a conversation with cursor-based pagination."""
        query = (
            supabase.table("chat_messages")
            .select("*, agents(id, name, portrait_image_url)")
            .eq("conversation_id", str(conversation_id))
            .order("created_at", desc=True)
            .limit(limit)
        )

        if before:
            query = query.lt("created_at", before)

        response = await query.execute()
        data = response.data or []

        # Flatten agent join into agent field
        for msg in data:
            agent_data = msg.pop("agents", None)
            if agent_data:
                msg["agent"] = agent_data

        # Return in chronological order
        data.reverse()
        return data

    @staticmethod
    async def send_message(
        supabase: Client,
        conversation_id: UUID,
        content: str,
        sender_role: str = "user",
        metadata: dict | None = None,
        agent_id: UUID | None = None,
    ) -> dict:
        """Send a message in a conversation. message_count is updated by DB trigger."""
        insert_data: dict = {
            "conversation_id": str(conversation_id),
            "sender_role": sender_role,
            "content": content,
            "metadata": metadata,
        }
        if agent_id:
            insert_data["agent_id"] = str(agent_id)

        response = await supabase.table("chat_messages").insert(insert_data).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send message.",
            )

        # last_message_at is updated by DB trigger update_conversation_stats()
        # (migration 009) — no manual Python update needed.

        return response.data[0]

    @staticmethod
    async def add_agent(
        supabase: Client,
        conversation_id: UUID,
        agent_id: UUID,
    ) -> dict:
        """Add an agent to a conversation."""
        response = await (
            supabase.table("chat_conversation_agents")
            .insert(
                {
                    "conversation_id": str(conversation_id),
                    "agent_id": str(agent_id),
                }
            )
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add agent to conversation.",
            )
        return response.data[0]

    @staticmethod
    async def remove_agent(
        supabase: Client,
        conversation_id: UUID,
        agent_id: UUID,
    ) -> None:
        """Remove an agent from a conversation (at least 1 must remain)."""
        # Check count
        count_resp = await (
            supabase.table("chat_conversation_agents")
            .select("id", count="exact")
            .eq("conversation_id", str(conversation_id))
            .execute()
        )
        if count_resp.count is not None and count_resp.count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove last agent from conversation.",
            )

        await (
            supabase.table("chat_conversation_agents")
            .delete()
            .eq(
                "conversation_id",
                str(conversation_id),
            )
            .eq("agent_id", str(agent_id))
            .execute()
        )

    @staticmethod
    async def add_event_reference(
        supabase: Client,
        conversation_id: UUID,
        event_id: UUID,
        user_id: UUID,
    ) -> dict:
        """Add an event reference to a conversation."""
        response = await (
            supabase.table("chat_event_references")
            .insert(
                {
                    "conversation_id": str(conversation_id),
                    "event_id": str(event_id),
                    "referenced_by": str(user_id),
                }
            )
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add event reference.",
            )

        # Load the event details for the response
        ref = response.data[0]
        event_resp = await (
            supabase.table("events")
            .select("title, event_type, description, occurred_at, impact_level")
            .eq("id", str(event_id))
            .limit(1)
            .execute()
        )
        event_data = event_resp.data[0] if event_resp.data else {}

        return {
            "id": ref["id"],
            "event_id": ref["event_id"],
            "event_title": event_data.get("title", ""),
            "event_type": event_data.get("event_type"),
            "event_description": event_data.get("description"),
            "occurred_at": event_data.get("occurred_at"),
            "impact_level": event_data.get("impact_level"),
            "referenced_at": ref["referenced_at"],
        }

    @staticmethod
    async def remove_event_reference(
        supabase: Client,
        conversation_id: UUID,
        event_id: UUID,
    ) -> None:
        """Remove an event reference from a conversation."""
        await (
            supabase.table("chat_event_references")
            .delete()
            .eq(
                "conversation_id",
                str(conversation_id),
            )
            .eq("event_id", str(event_id))
            .execute()
        )

    @staticmethod
    async def get_event_references(
        supabase: Client,
        conversation_id: UUID,
    ) -> list[dict]:
        """Get event references for a conversation."""
        return await ChatService._load_event_references(supabase, str(conversation_id))

    @staticmethod
    async def archive_conversation(
        supabase: Client,
        conversation_id: UUID,
    ) -> dict:
        """Archive a conversation."""
        response = await (
            supabase.table("chat_conversations")
            .update({"status": "archived", "updated_at": datetime.now(UTC).isoformat()})
            .eq("id", str(conversation_id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation '{conversation_id}' not found.",
            )

        return response.data[0]

    @staticmethod
    async def delete_conversation(
        supabase: Client,
        conversation_id: UUID,
    ) -> dict:
        """Permanently delete a conversation and all its messages (CASCADE)."""
        # Fetch conversation first to return it
        fetch = await supabase.table("chat_conversations").select("*").eq("id", str(conversation_id)).execute()

        if not fetch.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation '{conversation_id}' not found.",
            )

        conversation = fetch.data[0]

        # Delete (messages cascade automatically)
        await (
            supabase.table("chat_conversations")
            .delete()
            .eq(
                "id",
                str(conversation_id),
            )
            .execute()
        )

        return conversation

    # ── Public query methods ─────────────────────────────

    @staticmethod
    async def list_conversations_public(
        supabase: Client,
        simulation_id: UUID,
    ) -> list[dict]:
        """List all conversations for a simulation (public, no user filter)."""
        response = await (
            supabase.table("chat_conversations")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .order("last_message_at", desc=True)
            .execute()
        )
        return response.data or []

    @staticmethod
    async def list_messages_public(
        supabase: Client,
        conversation_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List messages in a conversation (public, paginated)."""
        response = await (
            supabase.table("chat_messages")
            .select("*", count="exact")
            .eq("conversation_id", str(conversation_id))
            .order("created_at", desc=False)
            .range(offset, offset + limit - 1)
            .execute()
        )
        data = response.data or []
        total = response.count if response.count is not None else len(data)
        return data, total
