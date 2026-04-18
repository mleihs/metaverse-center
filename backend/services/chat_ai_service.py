"""Chat AI service with conversation memory and group chat support."""

from __future__ import annotations

import asyncio
import logging
import re
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from backend.config import settings
from backend.services.agent_memory_service import AgentMemoryService
from backend.services.ai_usage_service import AIUsageService
from backend.services.external.openrouter import OpenRouterService
from backend.services.i18n_utils import (
    EMOTION_LABELS,
    MOOD_CONTEXT_TEMPLATES,
    MOOD_DESCRIPTORS,
    MOODLET_TYPE_LABELS,
    STRESS_DESCRIPTORS,
    get_localized_field,
    localize_label,
)
from backend.services.model_resolver import ModelResolver, ResolvedModel
from backend.services.prompt_service import LOCALE_NAMES, PromptResolver
from backend.utils.db import maybe_single_data
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# ── Model-aware history limits ────────────────────────────
# Instead of a static message count, compute the limit from the model's
# context window.  No tokenizer dependency — uses a 4-chars-per-token
# heuristic which is conservative for English prose.

_CONTEXT_WINDOWS: dict[str, int] = {
    "claude": 200_000,
    "gemini": 1_000_000,
    "gpt-4o": 128_000,
    "gpt-4": 128_000,
    "llama": 128_000,
    "mistral": 128_000,
    "deepseek": 128_000,
}
_DEFAULT_CONTEXT_WINDOW = 128_000
_TOKENS_PER_MESSAGE_ESTIMATE = 250
_CONTEXT_RESERVE = 5_000  # system prompt + response headroom
_HISTORY_BUDGET_RATIO = 0.6  # use 60% of context for history
_MAX_MESSAGES_HARD = 200  # prevent huge DB queries
_MIN_MESSAGES = 20


def _max_history_messages(model_id: str) -> int:
    """Compute the maximum number of history messages for a given model."""
    context_tokens = _DEFAULT_CONTEXT_WINDOW
    model_lower = model_id.lower()
    for prefix, tokens in _CONTEXT_WINDOWS.items():
        if prefix in model_lower:
            context_tokens = tokens
            break

    budget = int(context_tokens * _HISTORY_BUDGET_RATIO) - _CONTEXT_RESERVE
    estimated = budget // _TOKENS_PER_MESSAGE_ESTIMATE
    return max(_MIN_MESSAGES, min(estimated, _MAX_MESSAGES_HARD))


@dataclass
class SSEEvent:
    """A Server-Sent Event for chat streaming.

    Event types:
        user_confirmed — user message saved, with reconciliation data
        agent_start    — agent begins generating (index, total for group chat)
        token          — incremental content token
        agent_done     — agent finished, includes full saved message
        done           — entire streaming response complete
        error          — generation failed
    """

    event: str
    data: dict


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

    # ── Shared prompt assembly ───────────────────────────────

    async def _build_generation_context(
        self,
        *,
        agent: dict,
        simulation: dict,
        locale: str,
        prompt_template: str,
        history_messages: list[dict[str, str]],
        extra_variables: dict[str, str] | None = None,
        extra_context: str = "",
    ) -> list[dict[str, str]]:
        """Build the full message list (system prompt + history) for OpenRouter.

        Shared by both streaming and non-streaming generation paths. Handles:
        template variable injection, mood context, language instruction, and
        extra context assembly.

        Returns:
            Complete messages list ready for OpenRouter: [system, *history].
        """
        variables = self._build_agent_variables(agent, simulation, locale)
        if extra_variables:
            variables.update(extra_variables)

        mood_context = await self._build_mood_context(UUID(agent["id"]), locale)
        if mood_context:
            variables["agent_mood"] = mood_context

        system_prompt = self._prompt_resolver.fill_template(prompt_template, variables)
        system_prompt += PromptResolver.build_language_instruction(locale)

        if extra_context:
            system_prompt += f"\n\n{extra_context}"

        return [{"role": "system", "content": system_prompt}, *history_messages]

    # ── Core generation helper (non-streaming) ─────────────

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

        Handles: system prompt assembly, OpenRouter call, AI usage logging,
        message persistence.

        Returns:
            Tuple of (response_text, saved_message_dict).
        """
        # Mock mode: short-circuit before any AI call
        if settings.forge_mock_mode:
            return await self._mock_response(conversation_id, agent)

        messages = await self._build_generation_context(
            agent=agent,
            simulation=simulation,
            locale=locale,
            prompt_template=prompt_template,
            history_messages=history_messages,
            extra_variables=extra_variables,
            extra_context=extra_context,
        )

        # Generate via OpenRouter
        t0 = time.monotonic()
        response_text = await self._openrouter.generate(
            model=model.model_id,
            messages=messages,
            temperature=model.temperature,
            max_tokens=model.max_tokens,
        )
        generation_ms = int((time.monotonic() - t0) * 1000)

        return await self._persist_ai_response(
            conversation_id=conversation_id,
            agent=agent,
            model=model,
            response_text=response_text,
            generation_ms=generation_ms,
            locale=locale,
            extra_metadata=extra_metadata,
        )

    # ── Core streaming helper ──────────────────────────────

    async def stream_single_response(
        self,
        *,
        conversation_id: UUID,
        agent: dict,
        simulation: dict,
        locale: str,
        prompt_template: str,
        model: ResolvedModel,
        history_messages: list[dict[str, str]],
        agent_index: int = 0,
        agent_total: int = 1,
        extra_variables: dict[str, str] | None = None,
        extra_context: str = "",
        extra_metadata: dict[str, Any] | None = None,
    ) -> AsyncIterator[SSEEvent]:
        """Stream a single agent's response token-by-token.

        Yields SSEEvent objects: agent_start, token*, agent_done.
        """
        agent_id = str(agent["id"])
        agent_name = agent.get("name", "Agent")

        # Mock mode: yield mock text as a single token + done
        if settings.forge_mock_mode:
            yield SSEEvent(
                event="agent_start",
                data={
                    "agent_id": agent_id,
                    "agent_name": agent_name,
                    "index": agent_index,
                    "total": agent_total,
                },
            )
            mock_text, saved = await self._mock_response(conversation_id, agent)
            yield SSEEvent(
                event="token",
                data={
                    "agent_id": agent_id,
                    "content": mock_text,
                },
            )
            yield SSEEvent(
                event="agent_done",
                data={
                    "agent_id": agent_id,
                    "message": saved,
                },
            )
            return

        messages = await self._build_generation_context(
            agent=agent,
            simulation=simulation,
            locale=locale,
            prompt_template=prompt_template,
            history_messages=history_messages,
            extra_variables=extra_variables,
            extra_context=extra_context,
        )

        yield SSEEvent(
            event="agent_start",
            data={
                "agent_id": agent_id,
                "agent_name": agent_name,
                "index": agent_index,
                "total": agent_total,
            },
        )

        # Stream tokens from OpenRouter — retry up to MAX_STREAM_RETRIES times
        # on empty responses (CoT-only, sanitization-stripped, or zero tokens).
        max_retries = 3
        full_text = ""
        generation_ms = 0

        for attempt in range(1, max_retries + 1):
            t0 = time.monotonic()
            full_text = ""
            stream_error = False

            async for chunk in self._openrouter.stream_completion(
                model=model.model_id,
                messages=messages,
                temperature=model.temperature,
                max_tokens=model.max_tokens,
            ):
                if chunk.error:
                    stream_error = True
                    logger.warning(
                        "Stream error on attempt %d/%d for %s: %s",
                        attempt,
                        max_retries,
                        agent_name,
                        chunk.error,
                    )
                    break

                if chunk.content:
                    full_text += chunk.content
                    yield SSEEvent(
                        event="token",
                        data={
                            "agent_id": agent_id,
                            "content": chunk.content,
                        },
                    )

            generation_ms = int((time.monotonic() - t0) * 1000)

            # Check if we got meaningful content after sanitization
            if not stream_error and self._sanitize_response(full_text):
                break  # Success — proceed to persist

            if attempt < max_retries:
                logger.warning(
                    "Attempt %d/%d produced empty/error response for %s — retrying",
                    attempt,
                    max_retries,
                    agent_name,
                )
                continue

            # All retries exhausted
            logger.error(
                "All %d attempts exhausted for %s in conversation %s",
                max_retries,
                agent_name,
                conversation_id,
            )
            yield SSEEvent(
                event="error",
                data={
                    "agent_id": agent_id,
                    "error": f"{agent_name} could not formulate a response after {max_retries} attempts.",
                    "error_type": "empty_response",
                    "retries_exhausted": max_retries,
                },
            )
            return

        # Persist completed response + log usage
        _, saved = await self._persist_ai_response(
            conversation_id=conversation_id,
            agent=agent,
            model=model,
            response_text=full_text,
            generation_ms=generation_ms,
            locale=locale,
            extra_metadata=extra_metadata,
        )

        if not saved:
            logger.error(
                "Persist returned empty for %s in conversation %s after successful stream",
                agent_name,
                conversation_id,
            )
            yield SSEEvent(
                event="error",
                data={
                    "agent_id": agent_id,
                    "error": f"{agent_name} could not formulate a response.",
                    "error_type": "sanitization_empty",
                },
            )
            return

        yield SSEEvent(
            event="agent_done",
            data={
                "agent_id": agent_id,
                "message": saved,
            },
        )

    # ── Shared persistence ─────────────────────────────────

    async def _mock_response(
        self,
        conversation_id: UUID,
        agent: dict,
    ) -> tuple[str, dict]:
        """Generate and persist a mock response (for forge_mock_mode)."""
        agent_name = agent.get("name", "Agent")
        mock_text = f"[MOCK] {agent_name} responds to the conversation."
        logger.info("MOCK_MODE: returning mock chat response for %s", agent_name)
        save_resp = (
            await self._supabase.table("chat_messages")
            .insert(
                {
                    "conversation_id": str(conversation_id),
                    "content": mock_text,
                    "sender_role": "assistant",
                    "agent_id": str(agent["id"]),
                    "metadata": {"model": "mock", "source": "mock"},
                }
            )
            .execute()
        )
        saved = save_resp.data[0] if save_resp.data else {}
        return mock_text, saved

    @staticmethod
    def _sanitize_response(text: str) -> str:
        """Strip leaked agent tags, CoT blocks, and meta-commentary from AI output.

        Locale-agnostic: patterns match structural markers (brackets, parens,
        XML tags) rather than language-specific keywords.
        """
        # Strip <think>...</think> blocks (CoT reasoning leak)
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
        # Strip [AgentName]: prefixes at start of response
        text = re.sub(r"^\[[\w\s.äöüÄÖÜß]+\]:\s*", "", text)
        # Strip parenthetical meta-reasoning blocks at start of response.
        # Requires 40+ chars inside parens to avoid false positives on short
        # legitimate parentheticals like "(Note: see above)". Meta-reasoning
        # leaks are always verbose multi-clause blocks.
        text = re.sub(
            r"^\([A-ZÀ-ÖØ-Þ][\w\s,;:'\-]{40,}?\.{0,3}\)\s*",
            "",
            text,
            flags=re.DOTALL,
        )
        return text.strip()

    async def _persist_ai_response(
        self,
        *,
        conversation_id: UUID,
        agent: dict,
        model: ResolvedModel,
        response_text: str,
        generation_ms: int,
        locale: str = "de",
        extra_metadata: dict[str, Any] | None = None,
    ) -> tuple[str, dict]:
        """Save AI response to DB + log usage. Shared by streaming and non-streaming."""
        response_text = self._sanitize_response(response_text)
        if not response_text:
            logger.warning(
                "Empty response after sanitization for agent %s in conversation %s — skipping persist",
                agent.get("name", agent["id"]),
                conversation_id,
            )
            return "", {}
        usage = self._openrouter.last_usage or {}
        token_count = usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0)

        await AIUsageService.log(
            self._supabase,
            simulation_id=self._simulation_id,
            provider="openrouter",
            model=model.model_id,
            purpose="chat",
            usage=usage,
        )

        metadata: dict[str, Any] = {
            "model": model.model_id,
            "source": model.source,
            "model_used": model.model_id,
            "token_count": token_count,
            "generation_ms": generation_ms,
            "locale": locale,
        }
        if extra_metadata:
            metadata.update(extra_metadata)

        save_resp = (
            await self._supabase.table("chat_messages")
            .insert(
                {
                    "conversation_id": str(conversation_id),
                    "content": response_text,
                    "sender_role": "assistant",
                    "agent_id": str(agent["id"]),
                    "metadata": metadata,
                }
            )
            .execute()
        )

        saved = save_resp.data[0] if save_resp.data else {}
        return response_text, saved

    # ── Shared setup helpers ─────────────────────────────────

    @staticmethod
    def _build_history_messages(
        history: list[dict],
        user_message: str,
    ) -> list[dict[str, str]]:
        """Convert raw chat_messages rows to OpenRouter message format."""
        messages: list[dict[str, str]] = []
        for msg in history:
            role = "assistant" if msg["sender_role"] == "assistant" else "user"
            messages.append({"role": role, "content": msg["content"]})
        messages.append({"role": "user", "content": user_message})
        return messages

    async def _prepare_single_context(
        self,
        conversation_id: UUID,
        user_message: str,
    ) -> dict[str, Any]:
        """Shared setup for single-agent generate/stream. Returns all context needed."""
        conversation = await self._load_conversation(conversation_id)
        agent_id = conversation.get("agent_id")
        if not agent_id:
            msg = f"Conversation {conversation_id} has no agent_id — use group methods for multi-agent conversations"
            raise ValueError(msg)
        agent = await self._load_agent(agent_id)
        simulation = await self._load_simulation()
        locale = await self._get_locale()

        memories = await AgentMemoryService.retrieve(
            self._supabase,
            UUID(agent["id"]),
            self._simulation_id,
            query_text=user_message,
            top_k=8,
        )
        memory_text = AgentMemoryService.format_for_prompt(memories)

        # L4: Inject relationship context into agent prompts
        relationship_context = await self._build_relationship_context(agent["id"], locale)

        prompt_template = await self._prompt_resolver.resolve("chat_system_prompt", locale)
        model = await self._model_resolver.resolve_text_model("chat_response")

        history = await self._load_history(conversation_id, model.model_id)
        history_messages = self._build_history_messages(history, user_message)

        return {
            "agent": agent,
            "simulation": simulation,
            "locale": locale,
            "prompt_template": prompt_template,
            "model": model,
            "history_messages": history_messages,
            "memory_text": memory_text,
            "relationship_context": relationship_context,
        }

    async def _build_relationship_context(self, agent_id: str, locale: str) -> str:
        """Build relationship context string for injection into agent prompts.

        Queries the agent's relationships and formats them as natural-language
        context that the AI can reference when generating responses.
        Returns empty string if no relationships exist (no prompt pollution).
        """
        try:
            resp = await (
                self._supabase.table("agent_relationships")
                .select(
                    "relationship_type, intensity, is_bidirectional, description,"
                    " source_agent:agents!source_agent_id(name),"
                    " target_agent:agents!target_agent_id(name)"
                )
                .or_(f"source_agent_id.eq.{agent_id},target_agent_id.eq.{agent_id}")
                .eq("simulation_id", str(self._simulation_id))
                .order("intensity", desc=True)
                .limit(6)
                .execute()
            )
        except Exception:
            logger.debug("Relationship context query failed for agent %s", agent_id, exc_info=True)
            return ""

        if not resp.data:
            return ""

        lines = []
        for rel in resp.data:
            source_name = (rel.get("source_agent") or {}).get("name", "?")
            target_name = (rel.get("target_agent") or {}).get("name", "?")
            # Show the "other" agent from this agent's perspective
            other = target_name if source_name != target_name else source_name
            rel_type = rel.get("relationship_type", "associated with").replace("_", " ")
            intensity = rel.get("intensity", 5)
            desc = rel.get("description", "")
            direction = " (mutual)" if rel.get("is_bidirectional") else ""
            line = f"- {rel_type} of {other} (intensity {intensity}/10{direction})"
            if desc:
                line += f": {desc}"
            lines.append(line)

        if not lines:
            return ""

        header = "Relationships:" if locale == "en" else "Beziehungen:"
        return f"{header}\n" + "\n".join(lines)

    def _fire_and_forget_memory_extraction(
        self,
        agent_id: str,
        user_message: str,
        response_text: str,
    ) -> None:
        """Background memory extraction — catches all exceptions with timeout."""
        if not response_text:
            return

        async def _safe_extract() -> None:
            try:
                await asyncio.wait_for(
                    AgentMemoryService.extract_from_chat(
                        self._supabase,
                        self._simulation_id,
                        UUID(agent_id),
                        user_message,
                        response_text,
                    ),
                    timeout=30.0,
                )
            except TimeoutError:
                logger.warning("Memory extraction timeout for agent %s", agent_id)
            except Exception:
                logger.exception("Memory extraction failed for agent %s", agent_id)

        asyncio.create_task(_safe_extract())

    # ── Public generation methods ───────────────────────────

    async def generate_response(
        self,
        conversation_id: UUID,
        user_message: str,
    ) -> str:
        """Generate an AI response for a single-agent conversation."""
        ctx = await self._prepare_single_context(conversation_id, user_message)

        response_text, saved = await self._generate_single_response(
            conversation_id=conversation_id,
            agent=ctx["agent"],
            simulation=ctx["simulation"],
            locale=ctx["locale"],
            prompt_template=ctx["prompt_template"],
            model=ctx["model"],
            history_messages=ctx["history_messages"],
            extra_variables={"agent_memories": ctx["memory_text"]},
            extra_context=ctx.get("relationship_context", ""),
        )

        if not saved:
            logger.warning(
                "Non-streaming generate_response produced empty response for agent %s",
                ctx["agent"].get("name", ctx["agent"]["id"]),
            )
            return ""

        self._fire_and_forget_memory_extraction(
            ctx["agent"]["id"],
            user_message,
            response_text,
        )
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
            extra_parts, history_messages = await self._build_group_turn_context(
                conversation_id=conversation_id,
                agents=agents,
                agent_names=agent_names,
                idx=idx,
                event_context=event_context,
                locale=locale,
                user_message=user_message,
                saved_messages=saved_messages,
                model_id=model.model_id,
            )

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

    # ── Public streaming methods ───────────────────────────

    async def stream_response(
        self,
        conversation_id: UUID,
        user_message: str,
    ) -> AsyncIterator[SSEEvent]:
        """Stream an AI response for a single-agent conversation."""
        ctx = await self._prepare_single_context(conversation_id, user_message)

        response_text = ""
        async for sse_event in self.stream_single_response(
            conversation_id=conversation_id,
            agent=ctx["agent"],
            simulation=ctx["simulation"],
            locale=ctx["locale"],
            prompt_template=ctx["prompt_template"],
            model=ctx["model"],
            history_messages=ctx["history_messages"],
            extra_variables={"agent_memories": ctx["memory_text"]},
            extra_context=ctx.get("relationship_context", ""),
        ):
            yield sse_event
            if sse_event.event == "agent_done":
                response_text = sse_event.data.get("message", {}).get("content", "")

        self._fire_and_forget_memory_extraction(
            ctx["agent"]["id"],
            user_message,
            response_text,
        )

    async def stream_group_response(
        self,
        conversation_id: UUID,
        user_message: str,
    ) -> AsyncIterator[SSEEvent]:
        """Stream AI responses for all agents in a group conversation.

        Each agent responds sequentially — the next agent sees the previous
        agent's completed response in history. Yields interleaved SSEEvents.
        """
        agents = await self._load_conversation_agents(conversation_id)
        event_refs = await self._load_event_references(conversation_id)
        simulation = await self._load_simulation()
        locale = await self._get_locale()
        prompt_template = await self._prompt_resolver.resolve("chat_system_prompt", locale)
        model = await self._model_resolver.resolve_text_model("chat_response")

        event_ids = [ref.get("event_id") for ref in event_refs if ref.get("event_id")]
        agent_ids = [str(a["id"]) for a in agents]
        reactions = await self._load_event_reactions(event_ids, agent_ids)
        event_context = await self._build_event_context(event_refs, reactions, locale)

        agent_names = [a.get("name", "Agent") for a in agents]
        saved_messages: list[dict] = []

        for idx, agent in enumerate(agents):
            extra_parts, history_messages = await self._build_group_turn_context(
                conversation_id=conversation_id,
                agents=agents,
                agent_names=agent_names,
                idx=idx,
                event_context=event_context,
                locale=locale,
                user_message=user_message,
                saved_messages=saved_messages,
                model_id=model.model_id,
            )

            async for sse_event in self.stream_single_response(
                conversation_id=conversation_id,
                agent=agent,
                simulation=simulation,
                locale=locale,
                prompt_template=prompt_template,
                model=model,
                history_messages=history_messages,
                agent_index=idx,
                agent_total=len(agents),
                extra_context="\n\n".join(extra_parts),
                extra_metadata={"group_turn_index": idx},
            ):
                yield sse_event
                if sse_event.event == "agent_done":
                    msg_data = sse_event.data.get("message", {})
                    if msg_data:
                        saved_messages.append(msg_data)

    # ── Group chat context helper ──────────────────────────

    async def _build_group_turn_context(
        self,
        *,
        conversation_id: UUID,
        agents: list[dict],
        agent_names: list[str],
        idx: int,
        event_context: str,
        locale: str,
        user_message: str,
        saved_messages: list[dict],
        model_id: str = "",
    ) -> tuple[list[str], list[dict[str, str]]]:
        """Build extra_parts and history_messages for a single agent's turn
        in a group conversation. Shared by streaming and non-streaming paths.
        """
        extra_parts: list[str] = []
        if event_context:
            extra_parts.append(event_context)

        if len(agents) > 1:
            group_instr = await self._prompt_resolver.resolve("chat_group_instruction", locale)
            other_names = [n for i, n in enumerate(agent_names) if i != idx]
            group_text = self._prompt_resolver.fill_template(
                group_instr,
                {
                    "other_agent_names": ", ".join(other_names),
                },
            )
            extra_parts.append(group_text)

        history = await self._load_history(conversation_id, model_id)
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

        for prev_msg in saved_messages:
            prev_agent_name = self._find_agent_name(agents, prev_msg.get("agent_id"))
            prefix = f"[{prev_agent_name}]: " if prev_agent_name else ""
            history_messages.append({"role": "assistant", "content": f"{prefix}{prev_msg['content']}"})

        return extra_parts, history_messages

    @staticmethod
    def _build_agent_variables(agent: dict, simulation: dict, locale: str) -> dict[str, str]:
        """Build the full set of agent template variables."""
        return {
            "agent_name": agent.get("name", "Agent"),
            "agent_character": get_localized_field(agent, "character", locale),
            "agent_background": get_localized_field(agent, "background", locale),
            "agent_system": agent.get("system", ""),
            "agent_gender": agent.get("gender", ""),
            "agent_profession": get_localized_field(agent, "primary_profession", locale),
            "simulation_name": simulation.get("name", ""),
            "locale_name": LOCALE_NAMES.get(locale, locale),
        }

    async def _build_mood_context(self, agent_id: UUID, locale: str = "en") -> str:
        """Build mood context string for system prompt injection.

        Returns empty string if no autonomy data exists for this agent.
        Mood and stress descriptors are localized via i18n_utils.
        """
        mood = await maybe_single_data(
            self._supabase.table("agent_mood")
            .select("mood_score, dominant_emotion, stress_level")
            .eq("agent_id", str(agent_id))
            .maybe_single()
        )
        if not mood:
            return ""
        score = mood["mood_score"]
        emotion = mood["dominant_emotion"]
        stress = mood["stress_level"]

        # Mood descriptor (localized)
        descs = MOOD_DESCRIPTORS.get(locale, MOOD_DESCRIPTORS["en"])
        if score > 50:
            mood_desc = descs["very_positive"]
        elif score > 20:
            mood_desc = descs["content"]
        elif score > -20:
            mood_desc = descs["neutral"]
        elif score > -50:
            mood_desc = descs["troubled"]
        else:
            mood_desc = descs["distressed"]

        # Stress descriptor (localized)
        stress_descs = STRESS_DESCRIPTORS.get(locale, STRESS_DESCRIPTORS["en"])
        if stress > 800:
            stress_desc = stress_descs["breakdown"]
        elif stress > 500:
            stress_desc = stress_descs["high"]
        elif stress > 200:
            stress_desc = stress_descs["moderate"]
        else:
            stress_desc = stress_descs["calm"]

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
        for ml in extract_list(moodlets_result):
            sign = "+" if ml["strength"] > 0 else ""
            ml_type = localize_label(ml["moodlet_type"], MOODLET_TYPE_LABELS, locale)
            ml_emotion = localize_label(ml["emotion"], EMOTION_LABELS, locale)
            moodlet_lines.append(f"  - {ml_type}: {ml_emotion} ({sign}{ml['strength']})")

        # Localize dominant emotion
        emotion_localized = localize_label(emotion, EMOTION_LABELS, locale)

        # Assemble context with localized templates
        templates = MOOD_CONTEXT_TEMPLATES.get(locale, MOOD_CONTEXT_TEMPLATES["en"])
        context = templates["state"].format(
            mood_desc=mood_desc,
            score=score,
            emotion=emotion_localized,
            stress_desc=stress_desc,
            stress=stress,
        )
        if moodlet_lines:
            context += templates["influences"].format(moodlet_lines="\n".join(moodlet_lines))
        context += templates["instruction"]
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

            item_text = self._prompt_resolver.fill_template(
                item_template,
                {
                    "event_title": event_data.get("title", "?"),
                    "event_type": event_data.get("event_type", "?"),
                    "impact_level": str(event_data.get("impact_level", "?")),
                    "occurred_at": event_data.get("occurred_at", ""),
                    "event_description": event_data.get("description", ""),
                },
            )
            event_blocks.append(item_text)

            # Append reactions for this event
            event_reactions = [r for r in reactions if str(r.get("event_id", "")) == str(event_id)]
            for reaction in event_reactions:
                reaction_text = self._prompt_resolver.fill_template(
                    reaction_template,
                    {
                        "agent_name": reaction.get("agent_name", "?"),
                        "event_title": event_data.get("title", "?"),
                        "reaction_text": reaction.get("reaction_text", ""),
                        "emotion": reaction.get("emotion", ""),
                    },
                )
                event_blocks.append(reaction_text)

        # Assemble into context wrapper
        event_list = "\n\n".join(event_blocks)
        return self._prompt_resolver.fill_template(
            context_template,
            {
                "event_list": event_list,
            },
        )

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
        return extract_list(response)

    async def _load_conversation(self, conversation_id: UUID) -> dict:
        """Load conversation details. Only `agent_id` is consumed by callers."""
        response = await (
            self._supabase.table("chat_conversations")
            .select("id, agent_id")
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
            .select(
                "id, name, character, character_de, background, background_de, "
                "system, gender, primary_profession, primary_profession_de"
            )
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
                "agent_id, agents(id, name, character, character_de, background, background_de,"
                " system, gender, primary_profession, primary_profession_de, portrait_image_url)",
            )
            .eq("conversation_id", str(conversation_id))
            .order("added_at")
            .execute()
        )
        agents = []
        for row in extract_list(response):
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
        return extract_list(response)

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

    async def _load_history(self, conversation_id: UUID, model_id: str = "") -> list[dict]:
        """Load recent messages from conversation history.

        The number of messages is computed from the model's context window
        so that larger-context models benefit from longer memory.
        """
        response = await (
            self._supabase.table("chat_messages")
            .select("content, sender_role, agent_id, created_at")
            .eq("conversation_id", str(conversation_id))
            .order("created_at", desc=False)
            .limit(_max_history_messages(model_id))
            .execute()
        )
        return extract_list(response)

    async def _get_locale(self) -> str:
        """Get the simulation's content locale (cached per instance)."""
        if hasattr(self, "_cached_locale"):
            return self._cached_locale
        response = await (
            self._supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(self._simulation_id))
            .eq("setting_key", "general.content_locale")
            .limit(1)
            .execute()
        )
        locale = "de"
        if response and response.data:
            locale = str(response.data[0].get("setting_value", "de"))
        self._cached_locale = locale
        return locale
