"""Chat AI service with conversation memory and group chat support."""

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

        prompt = await self._prompt_resolver.resolve("chat_system_prompt", locale)
        variables = self._build_agent_variables(agent, simulation, locale)
        system_prompt = self._prompt_resolver.fill_template(prompt, variables)
        system_prompt += PromptResolver.build_language_instruction(locale)

        history = await self._load_history(conversation_id)
        messages = [{"role": "system", "content": system_prompt}]
        for msg in history:
            role = "assistant" if msg["sender_role"] == "assistant" else "user"
            messages.append({"role": role, "content": msg["content"]})
        messages.append({"role": "user", "content": user_message})

        model = await self._model_resolver.resolve_text_model("chat_response")
        response_text = await self._openrouter.generate(
            model=model.model_id,
            messages=messages,
            temperature=model.temperature,
            max_tokens=model.max_tokens,
        )

        # Save with agent_id attribution
        self._supabase.table("chat_messages").insert({
            "conversation_id": str(conversation_id),
            "content": response_text,
            "sender_role": "assistant",
            "agent_id": conversation.get("agent_id"),
            "metadata": {
                "model": model.model_id,
                "source": model.source,
            },
        }).execute()

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
        # Load context
        agents = await self._load_conversation_agents(conversation_id)
        event_refs = await self._load_event_references(conversation_id)
        simulation = await self._load_simulation()
        locale = await self._get_locale()
        prompt_template = await self._prompt_resolver.resolve("chat_system_prompt", locale)
        model = await self._model_resolver.resolve_text_model("chat_response")

        # Load event reactions for all referenced events and conversation agents
        event_ids = [ref.get("event_id") for ref in event_refs if ref.get("event_id")]
        agent_ids = [str(a["id"]) for a in agents]
        reactions = await self._load_event_reactions(event_ids, agent_ids)

        # Build event context block (template-based)
        event_context = await self._build_event_context(event_refs, reactions, locale)

        # Build group instruction
        agent_names = [a.get("name", "Agent") for a in agents]

        saved_messages: list[dict] = []

        for idx, agent in enumerate(agents):
            # Build individual system prompt
            variables = self._build_agent_variables(agent, simulation, locale)
            system_prompt = self._prompt_resolver.fill_template(prompt_template, variables)
            system_prompt += PromptResolver.build_language_instruction(locale)

            # Add event context
            if event_context:
                system_prompt += f"\n\n{event_context}"

            # Add group instruction (if more than 1 agent)
            if len(agents) > 1:
                group_instr = await self._prompt_resolver.resolve("chat_group_instruction", locale)
                other_names = [n for i, n in enumerate(agent_names) if i != idx]
                group_text = self._prompt_resolver.fill_template(group_instr, {
                    "other_agent_names": ", ".join(other_names),
                })
                system_prompt += f"\n\n{group_text}"

            # Load full history including this turn's previous agent responses
            history = await self._load_history(conversation_id)

            messages = [{"role": "system", "content": system_prompt}]
            for msg in history:
                role = "assistant" if msg["sender_role"] == "assistant" else "user"
                # For group context, prefix agent name to assistant messages
                content = msg["content"]
                if role == "assistant" and msg.get("agent_id") and len(agents) > 1:
                    # Find agent name for this message
                    msg_agent_name = self._find_agent_name(agents, msg["agent_id"])
                    if msg_agent_name:
                        content = f"[{msg_agent_name}]: {content}"
                messages.append({"role": role, "content": content})
            messages.append({"role": "user", "content": user_message})

            # Add any responses from agents earlier in this turn
            for prev_msg in saved_messages:
                prev_agent_name = self._find_agent_name(agents, prev_msg.get("agent_id"))
                prefix = f"[{prev_agent_name}]: " if prev_agent_name else ""
                messages.append({"role": "assistant", "content": f"{prefix}{prev_msg['content']}"})

            # Generate
            response_text = await self._openrouter.generate(
                model=model.model_id,
                messages=messages,
                temperature=model.temperature,
                max_tokens=model.max_tokens,
            )

            # Save with agent attribution
            save_resp = self._supabase.table("chat_messages").insert({
                "conversation_id": str(conversation_id),
                "content": response_text,
                "sender_role": "assistant",
                "agent_id": str(agent["id"]),
                "metadata": {
                    "model": model.model_id,
                    "source": model.source,
                    "group_turn_index": idx,
                },
            }).execute()

            if save_resp.data:
                saved_messages.append(save_resp.data[0])

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
        response = (
            self._supabase.table("event_reactions")
            .select("agent_name, reaction_text, emotion, event_id, agent_id")
            .in_("event_id", event_ids)
            .in_("agent_id", agent_ids)
            .execute()
        )
        return response.data or []

    async def _load_conversation(self, conversation_id: UUID) -> dict:
        """Load conversation details."""
        response = (
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
        response = (
            self._supabase.table("agents")
            .select("id, name, character, background, system, gender, primary_profession")
            .eq("id", agent_id)
            .limit(1)
            .execute()
        )
        return response.data[0] if response and response.data else {}

    async def _load_conversation_agents(self, conversation_id: UUID) -> list[dict]:
        """Load all agents for a conversation via junction table with full profiles."""
        response = (
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
        response = (
            self._supabase.table("chat_event_references")
            .select("id, event_id, events(title, event_type, description, occurred_at, impact_level)")
            .eq("conversation_id", str(conversation_id))
            .order("referenced_at")
            .execute()
        )
        return response.data or []

    async def _load_simulation(self) -> dict:
        """Load simulation details."""
        response = (
            self._supabase.table("simulations")
            .select("name, description")
            .eq("id", str(self._simulation_id))
            .limit(1)
            .execute()
        )
        return response.data[0] if response and response.data else {}

    async def _load_history(self, conversation_id: UUID) -> list[dict]:
        """Load the last N messages from conversation history."""
        response = (
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
        response = (
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
