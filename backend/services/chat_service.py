"""Service layer for chat operations (no AI — direct storage only)."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from supabase import Client


class ChatService:
    """Service for chat conversations and messages."""

    @staticmethod
    async def list_conversations(
        supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
    ) -> list[dict]:
        """List all conversations for the current user in a simulation."""
        response = (
            supabase.table("chat_conversations")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("user_id", str(user_id))
            .order("last_message_at", desc=True)
            .execute()
        )
        conversations = response.data or []

        # Enrich each conversation with agents from junction table
        for conv in conversations:
            conv["agents"] = await ChatService._load_conversation_agents(
                supabase, conv["id"],
            )
            # Load event references
            conv["event_references"] = await ChatService._load_event_references(
                supabase, conv["id"],
            )

        return conversations

    @staticmethod
    async def _load_conversation_agents(
        supabase: Client,
        conversation_id: str,
    ) -> list[dict]:
        """Load agents for a conversation via junction table."""
        response = (
            supabase.table("chat_conversation_agents")
            .select("agent_id, agents(id, name, portrait_image_url)")
            .eq("conversation_id", conversation_id)
            .order("added_at")
            .execute()
        )
        agents = []
        for row in response.data or []:
            agent_data = row.get("agents")
            if agent_data:
                agents.append(agent_data)
        return agents

    @staticmethod
    async def _load_event_references(
        supabase: Client,
        conversation_id: str,
    ) -> list[dict]:
        """Load event references for a conversation."""
        response = (
            supabase.table("chat_event_references")
            .select("id, event_id, referenced_at, events(title, event_type, description, occurred_at, impact_level)")
            .eq("conversation_id", conversation_id)
            .order("referenced_at")
            .execute()
        )
        refs = []
        for row in response.data or []:
            event_data = row.get("events", {}) or {}
            refs.append({
                "id": row["id"],
                "event_id": row["event_id"],
                "event_title": event_data.get("title", ""),
                "event_type": event_data.get("event_type"),
                "event_description": event_data.get("description"),
                "occurred_at": event_data.get("occurred_at"),
                "impact_level": event_data.get("impact_level"),
                "referenced_at": row["referenced_at"],
            })
        return refs

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
        response = (
            supabase.table("chat_conversations")
            .insert({
                "simulation_id": str(simulation_id),
                "user_id": str(user_id),
                "agent_id": str(agent_ids[0]),
                "title": title,
            })
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
        supabase.table("chat_conversation_agents").insert(junction_rows).execute()

        # Load agents for response
        conversation["agents"] = await ChatService._load_conversation_agents(
            supabase, conversation["id"],
        )
        conversation["event_references"] = []

        return conversation

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

        response = query.execute()
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

        response = (
            supabase.table("chat_messages")
            .insert(insert_data)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send message.",
            )

        # Also update last_message_at on the conversation
        supabase.table("chat_conversations").update({
            "last_message_at": datetime.now(UTC).isoformat(),
        }).eq("id", str(conversation_id)).execute()

        return response.data[0]

    @staticmethod
    async def add_agent(
        supabase: Client,
        conversation_id: UUID,
        agent_id: UUID,
    ) -> dict:
        """Add an agent to a conversation."""
        response = (
            supabase.table("chat_conversation_agents")
            .insert({
                "conversation_id": str(conversation_id),
                "agent_id": str(agent_id),
            })
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
        count_resp = (
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

        supabase.table("chat_conversation_agents").delete().eq(
            "conversation_id", str(conversation_id),
        ).eq("agent_id", str(agent_id)).execute()

    @staticmethod
    async def add_event_reference(
        supabase: Client,
        conversation_id: UUID,
        event_id: UUID,
        user_id: UUID,
    ) -> dict:
        """Add an event reference to a conversation."""
        response = (
            supabase.table("chat_event_references")
            .insert({
                "conversation_id": str(conversation_id),
                "event_id": str(event_id),
                "referenced_by": str(user_id),
            })
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add event reference.",
            )

        # Load the event details for the response
        ref = response.data[0]
        event_resp = (
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
        supabase.table("chat_event_references").delete().eq(
            "conversation_id", str(conversation_id),
        ).eq("event_id", str(event_id)).execute()

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
        response = (
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
        fetch = (
            supabase.table("chat_conversations")
            .select("*")
            .eq("id", str(conversation_id))
            .execute()
        )

        if not fetch.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation '{conversation_id}' not found.",
            )

        conversation = fetch.data[0]

        # Delete (messages cascade automatically)
        supabase.table("chat_conversations").delete().eq(
            "id", str(conversation_id),
        ).execute()

        return conversation
