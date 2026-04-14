"""Service layer for chat operations — storage, orchestration, and validation."""

import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from uuid import UUID

from backend.services.chat_ai_service import ChatAIService, SSEEvent
from backend.services.external_service_resolver import ExternalServiceResolver
from backend.services.i18n_utils import get_localized_field
from backend.utils.db import maybe_single_data
from backend.utils.errors import bad_request, not_found, server_error
from backend.utils.responses import extract_list
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
        result = await maybe_single_data(
            supabase.table("chat_conversations")
            .select("id")
            .eq("id", str(conversation_id))
            .eq("user_id", str(user_id))
            .maybe_single()
        )
        if not result:
            raise not_found(detail="Conversation not found")

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
        for row in extract_list(response):
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
        for row in extract_list(response):
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
        conversations = extract_list(response)
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
        # Resolve simulation locale for conversation tagging
        locale_resp = await (
            supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(simulation_id))
            .eq("setting_key", "general.content_locale")
            .limit(1)
            .execute()
        )
        locale = str(locale_resp.data[0].get("setting_value", "de")) if locale_resp.data else "de"

        # Create the conversation (agent_id set to first agent for backwards compat)
        response = await (
            supabase.table("chat_conversations")
            .insert(
                {
                    "simulation_id": str(simulation_id),
                    "user_id": str(user_id),
                    "agent_id": str(agent_ids[0]),
                    "title": title,
                    "locale": locale,
                }
            )
            .execute()
        )

        if not response.data:
            raise server_error("Failed to create conversation.")

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

        # Return all new messages (user + AI responses) — skip reactions
        # since brand-new messages cannot have reactions yet
        return await ChatService.get_messages(
            supabase,
            conversation_id,
            limit=len(agents) + 1,
            include_reactions=False,
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
    async def stream_regenerate(
        supabase: Client,
        simulation_id: UUID,
        conversation_id: UUID,
    ) -> AsyncIterator[SSEEvent]:
        """Re-trigger AI generation for the last user message in a conversation.

        Does NOT create a new user message — uses the existing history.
        Deletes the previous AI response(s) that followed the last user message
        to prevent duplicate accumulation on repeated regenerates.
        """
        # Guard: conversation must be active
        conv = await maybe_single_data(
            supabase.table("chat_conversations")
            .select("status")
            .eq("id", str(conversation_id))
            .maybe_single()
        )
        if not conv:
            yield SSEEvent(event="error", data={"error": "Conversation not found."})
            return
        if conv["status"] == "archived":
            yield SSEEvent(event="error", data={"error": "Cannot regenerate in archived conversation."})
            return

        # Find the last user message to use as the generation trigger
        last_user_msg = (
            await supabase.table("chat_messages")
            .select("id, content, created_at")
            .eq("conversation_id", str(conversation_id))
            .eq("sender_role", "user")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not last_user_msg.data:
            yield SSEEvent(event="error", data={"error": "No user message found to regenerate from."})
            return

        last_user = last_user_msg.data[0]

        # Delete assistant messages that came AFTER the last user message
        # (these are the failed/empty responses we're replacing)
        await (
            supabase.table("chat_messages")
            .delete()
            .eq("conversation_id", str(conversation_id))
            .eq("sender_role", "assistant")
            .gt("created_at", last_user["created_at"])
            .execute()
        )

        async for event in ChatService.stream_ai_response(
            supabase,
            simulation_id,
            conversation_id,
            last_user["content"],
        ):
            yield event

    @staticmethod
    async def get_messages(
        supabase: Client,
        conversation_id: UUID,
        *,
        limit: int = 50,
        before: str | None = None,
        include_reactions: bool = True,
    ) -> list[dict]:
        """Get messages for a conversation with cursor-based pagination.

        When include_reactions=True (default), batch-loads reaction summaries
        via the Postgres RPC get_message_reactions in a single extra query.
        """
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
        data = extract_list(response)

        # Flatten agent join into agent field
        for msg in data:
            agent_data = msg.pop("agents", None)
            if agent_data:
                msg["agent"] = agent_data

        # Batch-load reactions (one RPC call for all messages)
        if include_reactions and data:
            msg_ids = [UUID(msg["id"]) for msg in data]
            reactions_by_msg = await ChatService.get_reactions(supabase, msg_ids)
            for msg in data:
                msg["reactions"] = reactions_by_msg.get(msg["id"], [])

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
        if not content or not content.strip():
            raise bad_request("Message content cannot be empty.")

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
            raise server_error("Failed to send message.")

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
            raise server_error("Failed to add agent to conversation.")
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
            raise bad_request("Cannot remove last agent from conversation.")

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
            raise server_error("Failed to add event reference.")

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

    # ── Reactions (delegated to Postgres RPCs) ────────────────

    @staticmethod
    async def toggle_reaction(
        supabase: Client,
        message_id: UUID,
        emoji: str,
    ) -> str:
        """Toggle a reaction on a message. Returns 'added' or 'removed'.

        Delegates to the atomic Postgres RPC toggle_message_reaction which
        handles the insert-or-delete in a single transaction. auth.uid()
        is resolved from the user JWT passed to supabase.
        """
        result = await supabase.rpc(
            "toggle_message_reaction",
            {"p_message_id": str(message_id), "p_emoji": emoji},
        ).execute()

        if not result.data:
            raise server_error("Failed to toggle reaction.")
        # RPC returns a scalar text value
        return result.data

    @staticmethod
    async def get_reactions(
        supabase: Client,
        message_ids: list[UUID],
    ) -> dict[str, list[dict]]:
        """Get aggregated reactions for multiple messages.

        Delegates to the Postgres RPC get_message_reactions which groups
        by (message_id, emoji) and computes count + reacted_by_me.
        Returns {message_id: [ReactionSummary-dicts]}.
        """
        if not message_ids:
            return {}

        result = await supabase.rpc(
            "get_message_reactions",
            {"p_message_ids": [str(mid) for mid in message_ids]},
        ).execute()

        grouped: dict[str, list[dict]] = {}
        for row in extract_list(result):
            mid = row["message_id"]
            grouped.setdefault(mid, []).append(
                {
                    "emoji": row["emoji"],
                    "count": row["count"],
                    "reacted_by_me": row["reacted_by_me"],
                }
            )
        return grouped

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
            raise not_found(detail=f"Conversation '{conversation_id}' not found.")

        return response.data[0]

    @staticmethod
    async def rename_conversation(
        supabase: Client,
        conversation_id: UUID,
        title: str,
    ) -> dict:
        """Rename a conversation."""
        response = await (
            supabase.table("chat_conversations")
            .update({"title": title, "updated_at": datetime.now(UTC).isoformat()})
            .eq("id", str(conversation_id))
            .execute()
        )

        if not response.data:
            raise not_found(detail=f"Conversation '{conversation_id}' not found.")

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
            raise not_found(detail=f"Conversation '{conversation_id}' not found.")

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
        return extract_list(response)

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
        data = extract_list(response)
        total = response.count if response.count is not None else len(data)
        return data, total

    # ── Conversation starters ──────────────────────────────

    @staticmethod
    async def get_conversation_starters(
        supabase: Client,
        simulation_id: UUID,
        conversation_id: UUID,
        locale: str = "de",
    ) -> list[str]:
        """Build contextual conversation starters for an empty conversation.

        Uses agent profiles, recent simulation events, and agent mood to generate
        template-based starter suggestions. Returns 4 starters max.

        Template-based (not LLM) for instant response and zero cost. The API
        contract (list[str]) is future-compatible with LLM-generated starters.
        """
        # Load agents for this conversation
        agents_resp = await (
            supabase.table("chat_conversation_agents")
            .select(
                "agents(id, name, primary_profession, primary_profession_de, character, character_de, gender)",
            )
            .eq("conversation_id", str(conversation_id))
            .execute()
        )
        agents = [row["agents"] for row in (extract_list(agents_resp)) if row.get("agents")]

        # Fallback: single-agent conversation (agent_id on conversation row)
        if not agents:
            conv_data = await maybe_single_data(
                supabase.table("chat_conversations")
                .select("agent_id, agents(id, name, primary_profession, character, gender)")
                .eq("id", str(conversation_id))
                .maybe_single()
            )
            if conv_data and conv_data.get("agents"):
                agents = [conv_data["agents"]]

        if not agents:
            return _build_fallback_starters(locale)

        # Load 3 most recent events in this simulation
        events_resp = await (
            supabase.table("events")
            .select("title, event_type")
            .eq("simulation_id", str(simulation_id))
            .is_("deleted_at", "null")
            .order("occurred_at", desc=True)
            .limit(3)
            .execute()
        )
        recent_events = extract_list(events_resp)

        # Load mood for the first agent (optional context)
        mood_score: int | None = None
        if agents:
            mood_data = await maybe_single_data(
                supabase.table("agent_mood")
                .select("mood_score")
                .eq("agent_id", str(agents[0]["id"]))
                .maybe_single()
            )
            if mood_data:
                mood_score = mood_data["mood_score"]

        is_group = len(agents) > 1
        primary = agents[0]

        return _build_starters(
            agent=primary,
            recent_events=recent_events,
            mood_score=mood_score,
            is_group=is_group,
            locale=locale,
        )


# ── Starter template engine (module-level, stateless) ──────────────────

_MAX_STARTERS = 4

_TEMPLATES: dict[str, dict[str, str]] = {
    "de": {
        "profession": "Wie läuft deine Arbeit als {profession}?",
        "event": "Ich habe von \u201e{event_title}\u201c gehört. Wie siehst du das?",
        "mood_low": "Du wirkst angespannt. Was beschäftigt dich?",
        "mood_high": "Du scheinst guter Dinge zu sein. Was ist passiert?",
        "character": "Erzähl mir etwas über dich, {agent_name}.",
        "general": "Was sollte ich über die aktuelle Lage wissen?",
        "group_event": "Was denkt ihr über \u201e{event_title}\u201c?",
        "group_general": "Worüber seid ihr euch uneinig?",
    },
    "en": {
        "profession": "How is your work as a {profession} going?",
        "event": "I heard about \u2018{event_title}\u2019. What is your take?",
        "mood_low": "You seem tense. What is on your mind?",
        "mood_high": "You seem to be in good spirits. What happened?",
        "character": "Tell me something about yourself, {agent_name}.",
        "general": "What should I know about the current situation?",
        "group_event": "What do you all think about \u2018{event_title}\u2019?",
        "group_general": "What do you disagree on?",
    },
}


def _build_starters(
    *,
    agent: dict,
    recent_events: list[dict],
    mood_score: int | None,
    is_group: bool,
    locale: str,
) -> list[str]:
    """Assemble starters from templates based on available context."""
    tpl = _TEMPLATES.get(locale, _TEMPLATES["en"])
    starters: list[str] = []

    # 1. Event-based starter (most contextual)
    if recent_events:
        event_title = recent_events[0].get("title", "")
        if event_title:
            key = "group_event" if is_group else "event"
            starters.append(tpl[key].format(event_title=event_title))

    # 2. Mood-based starter
    if mood_score is not None:
        if mood_score < -30:
            starters.append(tpl["mood_low"])
        elif mood_score > 30:
            starters.append(tpl["mood_high"])

    # 3. Profession-based starter
    profession = get_localized_field(agent, "primary_profession", locale)
    if profession:
        starters.append(tpl["profession"].format(profession=profession))

    # 4. Character / group starter
    if is_group:
        starters.append(tpl["group_general"])
    else:
        agent_name = agent.get("name", "Agent")
        starters.append(tpl["character"].format(agent_name=agent_name))

    # 5. General fallback (fill remaining slots)
    if len(starters) < _MAX_STARTERS:
        starters.append(tpl["general"])

    # 6. Second event if available and still room
    if len(starters) < _MAX_STARTERS and len(recent_events) > 1:
        event_title = recent_events[1].get("title", "")
        if event_title:
            key = "group_event" if is_group else "event"
            starters.append(tpl[key].format(event_title=event_title))

    return starters[:_MAX_STARTERS]


def _build_fallback_starters(locale: str) -> list[str]:
    """Fallback starters when no agent data is available."""
    tpl = _TEMPLATES.get(locale, _TEMPLATES["en"])
    return [tpl["general"]]
