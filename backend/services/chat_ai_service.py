"""Chat AI service with conversation memory and group chat support."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any
from uuid import UUID

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.config import settings
from backend.services.agent_memory_service import AgentMemoryService
from backend.services.ai_usage_service import AIUsageService
from backend.services.external.openrouter import OpenRouterService
from backend.services.model_resolver import ModelResolver, ResolvedModel
from backend.services.prompt_service import LOCALE_NAMES, PromptResolver
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

MAX_MEMORY_MESSAGES = 50


class ChatAIService:
    """Generates AI responses for chat conversations.

    Uses conversation history as memory and agent profile as context.
    Supports both 1:1 and group conversations.
    """

    def __init__(
        self,
        supabase: Client,
        simulation_id: UUID,
        openrouter_api_key: str | None = None,
    ):
        self._supabase = supabase
        self._simulation_id = simulation_id
        self._prompt_resolver = PromptResolver(supabase, simulation_id)
        self._model_resolver = ModelResolver(supabase, simulation_id)
        self._openrouter = OpenRouterService(api_key=openrouter_api_key)

    # ── Core generation helper ──────────────────────────────

    async def _generate_single_response(
        self,
        *,
        conversation_id: UUID,
        agent: dict,
        simulation: dict,
        locale: str,
        prompt_template: str,
        model: ResolvedModel,
        history_messages: list[dict[str, str]],
        extra_variables: dict[str, str] | None = None,
        extra_context: str = "",
        extra_metadata: dict[str, Any] | None = None,
    ) -> tuple[str, dict]:
        """Core generation logic for a single agent response.

        Handles: system prompt assembly (template + variables + mood + language),
        OpenRouter call, AI usage logging, message persistence.

        Args:
            conversation_id: Target conversation.
            agent: Agent profile dict (must include 'id', 'name', etc.).
            simulation: Simulation dict (name, description).
            locale: Content locale code (e.g. 'de', 'en').
            prompt_template: Pre-resolved prompt template string.
            model: Pre-resolved model configuration.
            history_messages: Pre-built message list [{"role": ..., "content": ...}]
                              (excluding system prompt — that is built here).
            extra_variables: Additional template variables (e.g. agent_memories).
            extra_context: Text appended after the system prompt
                           (e.g. event context, group instruction).
            extra_metadata: Additional fields merged into saved message metadata.

        Returns:
            Tuple of (response_text, saved_message_dict).
        """
        # Mock mode: short-circuit before any AI call
        if settings.forge_mock_mode:
            agent_name = agent.get("name", "Agent")
            mock_text = f"[MOCK] {agent_name} responds to the conversation."
            logger.info("MOCK_MODE: returning mock chat response for %s", agent_name)
            save_resp = await self._supabase.table("chat_messages").insert({
                "conversation_id": str(conversation_id),
                "content": mock_text,
                "sender_role": "assistant",
                "agent_id": str(agent["id"]),
                "metadata": {"model": "mock", "source": "mock"},
            }).execute()
            saved = save_resp.data[0] if save_resp.data else {}
            return mock_text, saved

        # Build system prompt
        variables = self._build_agent_variables(agent, simulation, locale)
        if extra_variables:
            variables.update(extra_variables)

        mood_context = await self._build_mood_context(UUID(agent["id"]))
        if mood_context:
            variables["agent_mood"] = mood_context

        system_prompt = self._prompt_resolver.fill_template(prompt_template, variables)
        system_prompt += PromptResolver.build_language_instruction(locale)

        if extra_context:
            system_prompt += f"\n\n{extra_context}"

        # Assemble final messages
        messages = [{"role": "system", "content": system_prompt}, *history_messages]

        # Generate via OpenRouter
        t0 = time.monotonic()
        response_text = await self._openrouter.generate(
            model=model.model_id,
            messages=messages,
            temperature=model.temperature,
            max_tokens=model.max_tokens,
        )
        generation_ms = int((time.monotonic() - t0) * 1000)

        # Extract usage from last call
        usage = self._openrouter.last_usage or {}
        token_count = usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0)

        # Log AI usage
        await AIUsageService.log(
            self._supabase, simulation_id=self._simulation_id,
            provider="openrouter", model=model.model_id,
            purpose="chat", usage=usage,
        )

        # Save with agent attribution + AI metadata
        metadata: dict[str, Any] = {
            "model": model.model_id,
            "source": model.source,
            "model_used": model.model_id,
            "token_count": token_count,
            "generation_ms": generation_ms,
        }
        if extra_metadata:
            metadata.update(extra_metadata)

        save_resp = await self._supabase.table("chat_messages").insert({
            "conversation_id": str(conversation_id),
            "content": response_text,
            "sender_role": "assistant",
            "agent_id": str(agent["id"]),
            "metadata": metadata,
        }).execute()

        saved = save_resp.data[0] if save_resp.data else {}
        return response_text, saved

    # ── Public generation methods ───────────────────────────

    async def generate_response(
        self,
        conversation_id: UUID,
        user_message: str,
    ) -> str:
        """Generate an AI response for a single-agent conversation.

        Returns the generated response text.
        """
        conversation = await self._load_conversation(conversation_id)
        agent = await self._load_agent(conversation["agent_id"])
        simulation = await self._load_simulation()
        locale = await self._get_locale()

        # Retrieve agent memories relevant to the user message
        memories = await AgentMemoryService.retrieve(
            self._supabase, UUID(agent["id"]), self._simulation_id,
            query_text=user_message, top_k=8,
        )
        memory_text = AgentMemoryService.format_for_prompt(memories)

        prompt_template = await self._prompt_resolver.resolve("chat_system_prompt", locale)
        model = await self._model_resolver.resolve_text_model("chat_response")

        # Build history messages
        history = await self._load_history(conversation_id)
        history_messages: list[dict[str, str]] = []
        for msg in history:
            role = "assistant" if msg["sender_role"] == "assistant" else "user"
            history_messages.append({"role": role, "content": msg["content"]})
        history_messages.append({"role": "user", "content": user_message})

        response_text, _ = await self._generate_single_response(
            conversation_id=conversation_id,
            agent=agent,
            simulation=simulation,
            locale=locale,
            prompt_template=prompt_template,
            model=model,
            history_messages=history_messages,
            extra_variables={"agent_memories": memory_text},
        )

        # Fire-and-forget: extract memorable observations from this exchange
        async def _safe_extract() -> None:
            try:
                await AgentMemoryService.extract_from_chat(
                    self._supabase, self._simulation_id, UUID(agent["id"]),
                    user_message, response_text,
                )
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                logger.exception("Background memory extraction failed for agent %s", agent["id"])

        asyncio.create_task(_safe_extract())

        return response_text

    async def generate_group_response(
        self,
        conversation_id: UUID,
        user_message: str,
    ) -> list[dict]:
        """Generate AI responses for all agents in a group conversation.

        Each agent responds sequentially, seeing previous agents' responses.
        Returns list of saved message dicts.
        """
        # Load shared context
        agents = await self._load_conversation_agents(conversation_id)
        event_refs = await self._load_event_references(conversation_id)
        simulation = await self._load_simulation()
        locale = await self._get_locale()
        prompt_template = await self._prompt_resolver.resolve("chat_system_prompt", locale)
        model = await self._model_resolver.resolve_text_model("chat_response")

        # Build event context block
        event_ids = [ref.get("event_id") for ref in event_refs if ref.get("event_id")]
        agent_ids = [str(a["id"]) for a in agents]
        reactions = await self._load_event_reactions(event_ids, agent_ids)
        event_context = await self._build_event_context(event_refs, reactions, locale)

        agent_names = [a.get("name", "Agent") for a in agents]
        saved_messages: list[dict] = []

        for idx, agent in enumerate(agents):
            # Build extra context (event context + group instruction)
            extra_parts: list[str] = []
            if event_context:
                extra_parts.append(event_context)

            if len(agents) > 1:
                group_instr = await self._prompt_resolver.resolve("chat_group_instruction", locale)
                other_names = [n for i, n in enumerate(agent_names) if i != idx]
                group_text = self._prompt_resolver.fill_template(group_instr, {
                    "other_agent_names": ", ".join(other_names),
                })
                extra_parts.append(group_text)

            # Build history messages with agent-name prefixing for group context
            history = await self._load_history(conversation_id)
            history_messages: list[dict[str, str]] = []
            for msg in history:
                role = "assistant" if msg["sender_role"] == "assistant" else "user"
                content = msg["content"]
                if role == "assistant" and msg.get("agent_id") and len(agents) > 1:
                    msg_agent_name = self._find_agent_name(agents, msg["agent_id"])
                    if msg_agent_name:
                        content = f"[{msg_agent_name}]: {content}"
                history_messages.append({"role": role, "content": content})
            history_messages.append({"role": "user", "content": user_message})

            # Append responses from agents earlier in this turn
            for prev_msg in saved_messages:
                prev_agent_name = self._find_agent_name(agents, prev_msg.get("agent_id"))
                prefix = f"[{prev_agent_name}]: " if prev_agent_name else ""
                history_messages.append({"role": "assistant", "content": f"{prefix}{prev_msg['content']}"})

            _, saved = await self._generate_single_response(
                conversation_id=conversation_id,
                agent=agent,
                simulation=simulation,
                locale=locale,
                prompt_template=prompt_template,
                model=model,
                history_messages=history_messages,
                extra_context="\n\n".join(extra_parts),
                extra_metadata={"group_turn_index": idx},
            )

            if saved:
                saved_messages.append(saved)

        return saved_messages

    @staticmethod
    def _build_agent_variables(agent: dict, simulation: dict, locale: str) -> dict[str, str]:
        """Build the full set of agent template variables."""
        return {
            "agent_name": agent.get("name", "Agent"),
            "agent_character": agent.get("character", ""),
            "agent_background": agent.get("background", ""),
            "agent_system": agent.get("system", ""),
            "agent_gender": agent.get("gender", ""),
            "agent_profession": agent.get("primary_profession", ""),
            "simulation_name": simulation.get("name", ""),
            "locale_name": LOCALE_NAMES.get(locale, locale),
        }

    async def _build_mood_context(self, agent_id: UUID) -> str:
        """Build mood context string for system prompt injection.

        Returns empty string if no autonomy data exists for this agent.
        """
        mood_result = await (
            self._supabase.table("agent_mood")
            .select("mood_score, dominant_emotion, stress_level")
            .eq("agent_id", str(agent_id))
            .maybe_single()
            .execute()
        )
        if not mood_result.data:
            return ""

        mood = mood_result.data
        score = mood["mood_score"]
        emotion = mood["dominant_emotion"]
        stress = mood["stress_level"]

        # Mood descriptor
        if score > 50:
            mood_desc = "very positive, upbeat"
        elif score > 20:
            mood_desc = "content, at ease"
        elif score > -20:
            mood_desc = "neutral, composed"
        elif score > -50:
            mood_desc = "troubled, tense"
        else:
            mood_desc = "deeply distressed, volatile"

        # Stress descriptor
        if stress > 800:
            stress_desc = "on the verge of a breakdown"
        elif stress > 500:
            stress_desc = "highly stressed"
        elif stress > 200:
            stress_desc = "moderately stressed"
        else:
            stress_desc = "relatively calm"

        # Fetch active moodlets for detail
        moodlets_result = await (
            self._supabase.table("agent_moodlets")
            .select("moodlet_type, emotion, strength")
            .eq("agent_id", str(agent_id))
            .order("strength")
            .limit(5)
            .execute()
        )
        moodlet_lines = []
        for ml in moodlets_result.data or []:
            sign = "+" if ml["strength"] > 0 else ""
            moodlet_lines.append(
                f"  - {ml['moodlet_type']}: {ml['emotion']} ({sign}{ml['strength']})"
            )

        context = (
            f"\nCurrent emotional state: {mood_desc} (mood {score}/100). "
            f"Dominant emotion: {emotion}. {stress_desc} (stress {stress}/1000)."
        )
        if moodlet_lines:
            context += "\nActive influences:\n" + "\n".join(moodlet_lines)
        context += (
            "\nLet this emotional state subtly influence your tone and responses. "
            "Do not explicitly mention mood scores or stress numbers."
        )
        return context

    @staticmethod
    def _find_agent_name(agents: list[dict], agent_id: str | None) -> str | None:
        """Find agent name by ID in the agents list."""
        if not agent_id:
            return None
        for a in agents:
            if str(a["id"]) == str(agent_id):
                return a.get("name")
        return None

    async def _build_event_context(
        self,
        event_refs: list[dict],
        reactions: list[dict],
        locale: str,
    ) -> str:
        """Build event context block for system prompt using templates."""
        if not event_refs:
            return ""

        # Resolve templates
        context_template = await self._prompt_resolver.resolve("chat_event_context", locale)
        item_template = await self._prompt_resolver.resolve("chat_event_item", locale)
        reaction_template = await self._prompt_resolver.resolve("chat_event_reaction", locale)

        # Build per-event blocks
        event_blocks: list[str] = []
        for ref in event_refs:
            event_data = ref.get("events", {}) or {}
            event_id = ref.get("event_id", "")

            item_text = self._prompt_resolver.fill_template(item_template, {
                "event_title": event_data.get("title", "?"),
                "event_type": event_data.get("event_type", "?"),
                "impact_level": str(event_data.get("impact_level", "?")),
                "occurred_at": event_data.get("occurred_at", ""),
                "event_description": event_data.get("description", ""),
            })
            event_blocks.append(item_text)

            # Append reactions for this event
            event_reactions = [r for r in reactions if str(r.get("event_id", "")) == str(event_id)]
            for reaction in event_reactions:
                reaction_text = self._prompt_resolver.fill_template(reaction_template, {
                    "agent_name": reaction.get("agent_name", "?"),
                    "event_title": event_data.get("title", "?"),
                    "reaction_text": reaction.get("reaction_text", ""),
                    "emotion": reaction.get("emotion", ""),
                })
                event_blocks.append(reaction_text)

        # Assemble into context wrapper
        event_list = "\n\n".join(event_blocks)
        return self._prompt_resolver.fill_template(context_template, {
            "event_list": event_list,
        })

    async def _load_event_reactions(
        self,
        event_ids: list[str],
        agent_ids: list[str],
    ) -> list[dict]:
        """Load reactions from event_reactions for the referenced events and agents."""
        if not event_ids or not agent_ids:
            return []
        response = await (
            self._supabase.table("event_reactions")
            .select("agent_name, reaction_text, emotion, event_id, agent_id")
            .in_("event_id", event_ids)
            .in_("agent_id", agent_ids)
            .execute()
        )
        return response.data or []

    async def _load_conversation(self, conversation_id: UUID) -> dict:
        """Load conversation details."""
        response = await (
            self._supabase.table("chat_conversations")
            .select("*")
            .eq("id", str(conversation_id))
            .limit(1)
            .execute()
        )
        if not response or not response.data:
            msg = f"Conversation {conversation_id} not found"
            raise ValueError(msg)
        return response.data[0]

    async def _load_agent(self, agent_id: str) -> dict:
        """Load agent profile."""
        response = await (
            self._supabase.table("agents")
            .select("id, name, character, background, system, gender, primary_profession")
            .eq("id", agent_id)
            .limit(1)
            .execute()
        )
        return response.data[0] if response and response.data else {}

    async def _load_conversation_agents(self, conversation_id: UUID) -> list[dict]:
        """Load all agents for a conversation via junction table with full profiles."""
        response = await (
            self._supabase.table("chat_conversation_agents")
            .select(
                "agent_id, agents(id, name, character, background, system, gender,"
                " primary_profession, portrait_image_url)",
            )
            .eq("conversation_id", str(conversation_id))
            .order("added_at")
            .execute()
        )
        agents = []
        for row in response.data or []:
            agent_data = row.get("agents")
            if agent_data:
                agents.append(agent_data)
        return agents

    async def _load_event_references(self, conversation_id: UUID) -> list[dict]:
        """Load event references for a conversation."""
        response = await (
            self._supabase.table("chat_event_references")
            .select("id, event_id, events(title, event_type, description, occurred_at, impact_level)")
            .eq("conversation_id", str(conversation_id))
            .order("referenced_at")
            .execute()
        )
        return response.data or []

    async def _load_simulation(self) -> dict:
        """Load simulation details."""
        response = await (
            self._supabase.table("simulations")
            .select("name, description")
            .eq("id", str(self._simulation_id))
            .limit(1)
            .execute()
        )
        return response.data[0] if response and response.data else {}

    async def _load_history(self, conversation_id: UUID) -> list[dict]:
        """Load the last N messages from conversation history."""
        response = await (
            self._supabase.table("chat_messages")
            .select("content, sender_role, agent_id, created_at")
            .eq("conversation_id", str(conversation_id))
            .order("created_at", desc=False)
            .limit(MAX_MEMORY_MESSAGES)
            .execute()
        )
        return response.data or []

    async def _get_locale(self) -> str:
        """Get the simulation's content locale."""
        response = await (
            self._supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(self._simulation_id))
            .eq("setting_key", "general.content_locale")
            .limit(1)
            .execute()
        )
        if response and response.data:
            return str(response.data[0].get("setting_value", "de"))
        return "de"
