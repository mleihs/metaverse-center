"""Chat AI service with conversation memory."""

from __future__ import annotations

import logging
from uuid import UUID

from backend.services.external.openrouter import OpenRouterService
from backend.services.model_resolver import ModelResolver
from backend.services.prompt_service import LOCALE_NAMES, PromptResolver
from supabase import Client

logger = logging.getLogger(__name__)

MAX_MEMORY_MESSAGES = 50


class ChatAIService:
    """Generates AI responses for chat conversations.

    Uses conversation history as memory and agent profile as context.
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

    async def generate_response(
        self,
        conversation_id: UUID,
        user_message: str,
    ) -> str:
        """Generate an AI response for a conversation.

        Steps:
        1. Load conversation + agent profile
        2. Resolve chat prompt template
        3. Build system prompt with agent context
        4. Load conversation history as memory
        5. Call LLM with messages
        6. Save AI response to chat_messages

        Returns the generated response text.
        """
        # 1. Load conversation details + agent
        conversation = await self._load_conversation(conversation_id)
        agent = await self._load_agent(conversation["agent_id"])
        simulation = await self._load_simulation()

        locale = await self._get_locale()

        # 2. Resolve system prompt template
        prompt = await self._prompt_resolver.resolve(
            "chat_system_prompt", locale,
        )

        # 3. Build system prompt
        variables = {
            "agent_name": agent.get("name", "Agent"),
            "agent_character": agent.get("character", ""),
            "agent_background": agent.get("background", ""),
            "simulation_name": simulation.get("name", ""),
            "locale_name": LOCALE_NAMES.get(locale, locale),
        }
        system_prompt = self._prompt_resolver.fill_template(prompt, variables)
        system_prompt += PromptResolver.build_language_instruction(locale)

        # 4. Load conversation history
        history = await self._load_history(conversation_id)

        # 5. Build messages array
        messages = [{"role": "system", "content": system_prompt}]

        for msg in history:
            role = "assistant" if msg["sender_role"] == "assistant" else "user"
            messages.append({"role": role, "content": msg["content"]})

        # Add the new user message
        messages.append({"role": "user", "content": user_message})

        # 6. Call LLM
        model = await self._model_resolver.resolve_text_model("chat_response")
        response_text = await self._openrouter.generate(
            model=model.model_id,
            messages=messages,
            temperature=model.temperature,
            max_tokens=model.max_tokens,
        )

        # 7. Save AI response
        self._supabase.table("chat_messages").insert({
            "conversation_id": str(conversation_id),
            "content": response_text,
            "sender_role": "assistant",
            "metadata": {
                "model": model.model_id,
                "source": model.source,
            },
        }).execute()

        return response_text

    async def _load_conversation(self, conversation_id: UUID) -> dict:
        """Load conversation details."""
        response = (
            self._supabase.table("chat_conversations")
            .select("*")
            .eq("id", str(conversation_id))
            .maybe_single()
            .execute()
        )
        if not response.data:
            msg = f"Conversation {conversation_id} not found"
            raise ValueError(msg)
        return response.data

    async def _load_agent(self, agent_id: str) -> dict:
        """Load agent profile."""
        response = (
            self._supabase.table("agents")
            .select("name, character, background, system, gender, primary_profession")
            .eq("id", agent_id)
            .maybe_single()
            .execute()
        )
        return response.data or {}

    async def _load_simulation(self) -> dict:
        """Load simulation details."""
        response = (
            self._supabase.table("simulations")
            .select("name, description")
            .eq("id", str(self._simulation_id))
            .maybe_single()
            .execute()
        )
        return response.data or {}

    async def _load_history(self, conversation_id: UUID) -> list[dict]:
        """Load the last N messages from conversation history."""
        response = (
            self._supabase.table("chat_messages")
            .select("content, sender_role, created_at")
            .eq("conversation_id", str(conversation_id))
            .order("created_at", desc=False)
            .limit(MAX_MEMORY_MESSAGES)
            .execute()
        )
        return response.data or []

    async def _get_locale(self) -> str:
        """Get the simulation's content locale."""
        response = (
            self._supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(self._simulation_id))
            .eq("setting_key", "general.content_locale")
            .maybe_single()
            .execute()
        )
        if response.data:
            return str(response.data.get("setting_value", "de"))
        return "de"
