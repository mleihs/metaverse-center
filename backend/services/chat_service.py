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
            .select("*, agents(id, name, portrait_image_url)")
            .eq("simulation_id", str(simulation_id))
            .eq("user_id", str(user_id))
            .order("last_message_at", desc=True)
            .execute()
        )
        return response.data or []

    @staticmethod
    async def create_conversation(
        supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
        agent_id: UUID,
        title: str | None = None,
    ) -> dict:
        """Create a new conversation with an agent."""
        response = (
            supabase.table("chat_conversations")
            .insert({
                "simulation_id": str(simulation_id),
                "user_id": str(user_id),
                "agent_id": str(agent_id),
                "title": title,
            })
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create conversation.",
            )

        return response.data[0]

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
            .select("*")
            .eq("conversation_id", str(conversation_id))
            .order("created_at", desc=True)
            .limit(limit)
        )

        if before:
            query = query.lt("created_at", before)

        response = query.execute()
        # Return in chronological order
        data = response.data or []
        data.reverse()
        return data

    @staticmethod
    async def send_message(
        supabase: Client,
        conversation_id: UUID,
        content: str,
        sender_role: str = "user",
        metadata: dict | None = None,
    ) -> dict:
        """Send a message in a conversation. message_count is updated by DB trigger."""
        response = (
            supabase.table("chat_messages")
            .insert({
                "conversation_id": str(conversation_id),
                "sender_role": sender_role,
                "content": content,
                "metadata": metadata,
            })
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
