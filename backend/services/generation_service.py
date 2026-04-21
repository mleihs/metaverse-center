"""Generation service for all AI text generation types."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from uuid import UUID

import httpx
import sentry_sdk

from backend.config import settings
from backend.dependencies import get_admin_supabase
from backend.models.generation import (
    ChronicleEntryDraft,
    CycleSitrepDraft,
    InstagramCaptionDraft,
    MemoryObservation,
    MemoryObservationBatch,
    MemoryReflection,
    MemoryReflectionBatch,
)
from backend.services.ai_usage_service import AIUsageService
from backend.services.constants import PLATFORM_DEFAULT_MODELS
from backend.services.embassy_prompts import (
    VECTOR_PERSON_EFFECTS,
    VECTOR_VISUAL_LANGUAGE,
)
from backend.services.external.openrouter import (
    BudgetContext,
    ModelUnavailableError,
    OpenRouterService,
    RateLimitError,
)
from backend.services.external.output_repair import repair_json_output
from backend.services.model_resolver import ModelResolver, ResolvedModel
from backend.services.prompt_service import LOCALE_NAMES, PromptResolver
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class GenerationService:
    """Orchestrates AI text generation using PromptResolver + ModelResolver + OpenRouter."""

    def __init__(
        self,
        supabase: Client,
        simulation_id: UUID,
        openrouter_api_key: str | None = None,
        world_context: str = "",
    ):
        self._supabase = supabase
        self._simulation_id = simulation_id
        self._world_context = world_context
        self._prompt_resolver = PromptResolver(supabase, simulation_id)
        self._model_resolver = ModelResolver(supabase, simulation_id)
        self._openrouter = OpenRouterService(api_key=openrouter_api_key)

    async def generate_agent_full(
        self,
        agent_name: str,
        agent_system: str,
        agent_gender: str,
        locale: str = "de",
    ) -> dict:
        """Generate a full agent description (character + background).

        Parses JSON from the LLM response to return structured fields:
        character, background, description.
        """
        result = await self._generate(
            template_type="agent_generation_full",
            model_purpose="agent_description",
            variables={
                "agent_name": agent_name,
                "agent_system": agent_system,
                "agent_gender": agent_gender,
                "simulation_name": await self._get_simulation_name(),
                "locale_name": LOCALE_NAMES.get(locale, locale),
            },
            locale=locale,
        )

        # Parse JSON from LLM response to extract structured fields
        parsed = self._parse_json_content(result.get("content", ""))
        if parsed:
            for field in ("character", "background", "description"):
                if field in parsed:
                    result[field] = parsed[field]
            # Keep content as the character text for backwards compatibility
            result["content"] = parsed.get("character", result.get("content", ""))
        return result

    async def generate_agent_partial(
        self,
        agent_data: dict,
        locale: str = "de",
    ) -> dict:
        """Generate missing fields for a partially filled agent."""
        result = await self._generate(
            template_type="agent_generation_partial",
            model_purpose="agent_description",
            variables={
                "agent_name": agent_data.get("name", "Unknown"),
                "agent_system": agent_data.get("system", ""),
                "agent_gender": agent_data.get("gender", ""),
                "existing_data": json.dumps(agent_data, ensure_ascii=False),
                "simulation_name": await self._get_simulation_name(),
                "locale_name": LOCALE_NAMES.get(locale, locale),
            },
            locale=locale,
        )

        # Parse JSON from LLM response to extract structured fields
        parsed = self._parse_json_content(result.get("content", ""))
        if parsed:
            for field in ("character", "background", "description"):
                if field in parsed:
                    result[field] = parsed[field]
            result["content"] = parsed.get("character", result.get("content", ""))
        return result

    async def generate_building(
        self,
        building_type: str,
        building_name: str | None = None,
        building_style: str | None = None,
        building_condition: str | None = None,
        locale: str = "de",
    ) -> dict:
        """Generate a building description.

        Parses JSON from the LLM response to return structured fields:
        name, description, building_condition.
        """
        template_type = "building_generation_named" if building_name else "building_generation"
        variables: dict[str, str] = {
            "building_type": building_type,
            "simulation_name": await self._get_simulation_name(),
            "locale_name": LOCALE_NAMES.get(locale, locale),
        }
        if building_name:
            variables["building_name"] = building_name
        if building_style:
            variables["building_style"] = building_style
        if building_condition:
            variables["building_condition"] = building_condition

        result = await self._generate(
            template_type=template_type,
            model_purpose="building_description",
            variables=variables,
            locale=locale,
        )

        # Parse JSON from LLM response to extract structured fields
        parsed = self._parse_json_content(result.get("content", ""))
        if parsed:
            result["content"] = parsed.get("description", result.get("content", ""))
            if "name" in parsed:
                result["name"] = parsed["name"]
            if "building_condition" in parsed:
                result["building_condition"] = parsed["building_condition"]
        return result

    async def generate_banner_description(
        self,
        sim_name: str,
        sim_description: str,
        zone_summaries: list[str] | None = None,
        anchor_data: dict | None = None,
    ) -> str:
        """Generate a banner image description for image generation.

        Uses the banner_description prompt template so each simulation
        can define its own visual style for banners. Falls back to a
        hardcoded prompt if no template exists.
        """
        anchor = anchor_data or {}
        variables: dict[str, str] = {
            "simulation_name": sim_name,
            "simulation_description": sim_description,
            "atmosphere": anchor.get("title", "mysterious"),
            "zones": ", ".join(zone_summaries) if zone_summaries else "",
            "world_context": self._world_context,
        }

        try:
            result = await self._generate(
                template_type="banner_description",
                model_purpose="agent_description",
                variables=variables,
                locale="en",
            )
            description = result.get("content", "")
            if description:
                return description
        except (httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError, ValueError):
            logger.debug("No banner_description template — using hardcoded prompt")

        # Fallback: hardcoded prompt (backwards-compatible)
        return (
            f"Cinematic wide establishing shot of {sim_name}. "
            f"{sim_description[:200]}. "
            f"Atmosphere: {anchor.get('title', 'mysterious')}. "
            f"Epic landscape, 16:9 aspect ratio, no text, no UI elements, "
            f"dramatic lighting, high detail."
        )

    async def generate_portrait_description(
        self,
        agent_name: str,
        agent_data: dict | None = None,
        locale: str = "en",
    ) -> str:
        """Generate a portrait description for image generation.

        Always returns English (SD models expect English prompts).
        """
        variables: dict[str, str] = {
            "agent_name": agent_name,
            "simulation_name": await self._get_simulation_name(),
            "locale_name": "English",
            "world_context": self._world_context,
        }
        if agent_data:
            variables["agent_character"] = agent_data.get("character", "")
            variables["agent_background"] = agent_data.get("background", "")

        result = await self._generate(
            template_type="portrait_description",
            model_purpose="agent_description",
            variables=variables,
            locale="en",
        )
        return result.get("content", "")

    async def generate_building_image_description(
        self,
        building_name: str,
        building_type: str,
        building_data: dict | None = None,
        locale: str = "en",
    ) -> str:
        """Generate a building image description for image generation.

        Always returns English (image models expect English prompts).
        Uses the building_image_description template with full game-logic context.
        """
        data = building_data or {}
        variables: dict[str, str] = {
            "building_name": building_name,
            "building_type": building_type,
            "building_condition": data.get("building_condition", ""),
            "building_style": data.get("building_style", ""),
            "building_description": data.get("description", ""),
            "special_type": data.get("special_type", ""),
            "construction_year": str(data.get("construction_year", "")),
            "population_capacity": str(data.get("population_capacity", "")),
            "zone_name": data.get("zone_name", ""),
            "simulation_name": await self._get_simulation_name(),
            "locale_name": "English",
            "world_context": self._world_context,
        }

        result = await self._generate(
            template_type="building_image_description",
            model_purpose="building_description",
            variables=variables,
            locale="en",
        )
        return result.get("content", "")

    async def generate_lore_image_description(
        self,
        section_title: str,
        section_body: str,
    ) -> str:
        """Generate a lore image description for image generation.

        Uses the lore_image_description template if available, otherwise
        falls back to a hardcoded prompt from the section content.
        Always returns English (image models expect English prompts).
        """
        variables: dict[str, str] = {
            "section_title": section_title,
            "section_body": section_body[:500],
            "simulation_name": await self._get_simulation_name(),
            "world_context": self._world_context,
        }

        try:
            result = await self._generate(
                template_type="lore_image_description",
                model_purpose="agent_description",
                variables=variables,
                locale="en",
            )
            description = result.get("content", "")
            if description:
                return description
        except (httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError, ValueError):
            logger.debug("No lore_image_description template — using fallback")

        # Fallback: compose from section content directly
        return (
            f"Atmospheric scene depicting: {section_title}. "
            f"{section_body[:300]}. "
            f"Moody atmospheric illustration, rich detail, "
            f"no text, no UI elements, no labels."
        )

    async def generate_embassy_building_image_description(
        self,
        building_name: str,
        building_data: dict,
        partner_simulation: dict,
        embassy_data: dict,
    ) -> str:
        """Generate an image description for an embassy building.

        Uses the embassy_building_image_description template with cross-reality
        contamination vocabulary. Always returns English (image models expect
        English prompts).
        """
        bleed_vector = embassy_data.get("bleed_vector", "memory")
        variables: dict[str, str] = {
            "building_name": building_name,
            "simulation_name": await self._get_simulation_name(),
            "simulation_theme": building_data.get("simulation_theme", ""),
            "building_description": building_data.get("description", ""),
            "building_style": building_data.get("style", ""),
            "building_condition": building_data.get("building_condition", ""),
            "partner_simulation_name": partner_simulation.get("name", ""),
            "partner_theme": partner_simulation.get("theme", ""),
            "bleed_vector": bleed_vector,
            "vector_description": VECTOR_VISUAL_LANGUAGE.get(bleed_vector, ""),
            "embassy_question": embassy_data.get("description", ""),
        }

        result = await self._generate(
            template_type="embassy_building_image_description",
            model_purpose="building_description",
            variables=variables,
            locale="en",
        )
        return result.get("content", "")

    async def generate_ambassador_portrait_description(
        self,
        agent_name: str,
        agent_data: dict,
        partner_simulation: dict,
        embassy_data: dict,
    ) -> str:
        """Generate a portrait description for an ambassador agent.

        Uses the ambassador_portrait_description template with vector-specific
        person effects. Always returns English (image models expect English).
        """
        bleed_vector = embassy_data.get("bleed_vector", "memory")
        variables: dict[str, str] = {
            "agent_name": agent_name,
            "simulation_name": await self._get_simulation_name(),
            "simulation_theme": agent_data.get("simulation_theme", ""),
            "agent_character": agent_data.get("character", ""),
            "agent_background": agent_data.get("background", ""),
            "partner_simulation_name": partner_simulation.get("name", ""),
            "partner_theme": partner_simulation.get("theme", ""),
            "bleed_vector": bleed_vector,
            "vector_person_effect": VECTOR_PERSON_EFFECTS.get(bleed_vector, ""),
        }

        result = await self._generate(
            template_type="ambassador_portrait_description",
            model_purpose="agent_description",
            variables=variables,
            locale="en",
        )
        return result.get("content", "")

    async def generate_event(
        self,
        event_type: str,
        locale: str = "de",
        *,
        game_context: dict | None = None,
    ) -> dict:
        """Generate an event description.

        Args:
            game_context: Optional game mechanics context (zone_stability,
                simulation_health) to bias event tone and severity.
        """
        return await self._generate(
            template_type="event_generation",
            model_purpose="event_generation",
            variables={
                "event_type": event_type,
                "simulation_name": await self._get_simulation_name(),
                "locale_name": LOCALE_NAMES.get(locale, locale),
            },
            locale=locale,
            game_context=game_context,
        )

    async def generate_agent_reaction(
        self,
        agent_data: dict,
        event_data: dict,
        locale: str = "de",
        *,
        game_context: dict | None = None,
    ) -> str:
        """Generate an agent's reaction to an event.

        Args:
            game_context: Optional game mechanics context (zone_stability,
                building_readiness, etc.) appended to the prompt for richer
                narrative generation.
        """
        result = await self._generate(
            template_type="agent_reactions",
            model_purpose="agent_reactions",
            variables={
                "agent_name": agent_data.get("name", ""),
                "agent_character": agent_data.get("character", ""),
                "agent_system": agent_data.get("system", ""),
                "event_title": event_data.get("title", ""),
                "event_description": event_data.get("description", ""),
                "simulation_name": await self._get_simulation_name(),
                "locale_name": LOCALE_NAMES.get(locale, locale),
            },
            locale=locale,
            game_context=game_context,
        )
        return result.get("content", "")

    async def generate_news_transformation(
        self,
        news_title: str,
        news_content: str,
        locale: str = "de",
    ) -> dict:
        """Transform a real news article into the simulation narrative.

        Parses JSON from the LLM response to return structured fields:
        title, description, event_type, impact_level, plus a clean narrative.
        """
        result = await self._generate(
            template_type="news_transformation",
            model_purpose="news_transformation",
            variables={
                "news_title": news_title,
                "news_content": news_content,
                "simulation_name": await self._get_simulation_name(),
                "locale_name": LOCALE_NAMES.get(locale, locale),
            },
            locale=locale,
        )

        raw_content = result.get("content", "")

        # Parse JSON from LLM response (same pattern as agent/building)
        parsed = self._parse_json_content(raw_content)
        if parsed:
            for field in ("title", "description", "event_type", "impact_level"):
                if field in parsed:
                    result[field] = parsed[field]

        # Extract clean narrative (strip markers, JSON block, separator)
        narrative = re.sub(r"```json[\s\S]*?```", "", raw_content).strip()
        narrative = re.sub(r"\n---\s*$", "", narrative, flags=re.MULTILINE).strip()
        narrative = re.sub(
            r"^\*\*(?:Titel|Title):\*\*\s*[^\n]*\n?",
            "",
            narrative,
        ).strip()
        narrative = re.sub(
            r"^\*\*(?:Artikel|Article):\*\*\s*\n?",
            "",
            narrative,
        ).strip()
        result["narrative"] = narrative

        return result

    async def generate_social_media_transform(
        self,
        post_content: str,
        transform_type: str = "dystopian",
        locale: str = "de",
    ) -> dict:
        """Transform a social media post into the simulation context."""
        return await self._generate(
            template_type=f"social_media_transform_{transform_type}",
            model_purpose="social_trends",
            variables={
                "post_content": post_content,
                "simulation_name": await self._get_simulation_name(),
                "locale_name": LOCALE_NAMES.get(locale, locale),
            },
            locale=locale,
        )

    async def generate_social_trends_campaign(
        self,
        trend_data: dict,
        locale: str = "de",
    ) -> dict:
        """Generate a campaign from social trends."""
        return await self._generate(
            template_type="social_trends_campaign",
            model_purpose="social_trends",
            variables={
                "trend_title": trend_data.get("title", ""),
                "trend_description": trend_data.get("description", ""),
                "simulation_name": await self._get_simulation_name(),
                "locale_name": LOCALE_NAMES.get(locale, locale),
            },
            locale=locale,
        )

    async def generate_agent_relationships(
        self,
        agent_data: dict,
        other_agents: list[dict],
        locale: str = "de",
    ) -> list[dict]:
        """Generate relationship suggestions for an agent.

        Returns a list of dicts, each with:
        target_agent_id, relationship_type, intensity, description, is_bidirectional
        """
        agents_summary = "\n".join(
            f"- {a['name']} (ID: {a['id']}, system: {a.get('system', 'N/A')})" for a in other_agents[:20]
        )

        result = await self._generate(
            template_type="relationship_generation",
            model_purpose="agent_description",
            variables={
                "agent_name": agent_data.get("name", ""),
                "agent_character": agent_data.get("character", ""),
                "agent_background": agent_data.get("background", ""),
                "agent_system": agent_data.get("system", ""),
                "other_agents": agents_summary,
                "simulation_name": await self._get_simulation_name(),
                "locale_name": LOCALE_NAMES.get(locale, locale),
            },
            locale=locale,
        )

        parsed = self._parse_json_content(result.get("content", ""))
        if parsed and isinstance(parsed.get("relationships"), list):
            return parsed["relationships"]
        if isinstance(parsed, list):
            return parsed
        return []

    async def generate_echo_transformation(
        self,
        source_event: dict,
        target_simulation_name: str,
        target_description: str,
        echo_vector: str,
        locale: str = "de",
        *,
        game_context: dict | None = None,
    ) -> dict:
        """Transform a source event into a target simulation's voice.

        Args:
            game_context: Optional metrics (embassy_effectiveness, simulation
                health, bleed_permeability) to shape echo narrative intensity.

        Returns dict with: title, description
        """
        result = await self._generate(
            template_type="event_echo_transformation",
            model_purpose="event_generation",
            variables={
                "source_title": source_event.get("title", ""),
                "source_description": source_event.get("description", ""),
                "source_simulation": await self._get_simulation_name(),
                "target_simulation": target_simulation_name,
                "target_description": target_description,
                "echo_vector": echo_vector,
                "locale_name": LOCALE_NAMES.get(locale, locale),
            },
            locale=locale,
            game_context=game_context,
        )

        parsed = self._parse_json_content(result.get("content", ""))
        if parsed:
            return {
                "title": parsed.get("title", source_event.get("title", "")),
                "description": parsed.get(
                    "description",
                    result.get("content", ""),
                ),
                "model_used": result.get("model_used"),
            }
        return {
            "title": source_event.get("title", ""),
            "description": result.get("content", ""),
            "model_used": result.get("model_used"),
        }

    # --- Resonance transformation ---

    async def generate_resonance_event(
        self,
        archetype_name: str,
        archetype_description: str,
        resonance_title: str,
        resonance_description: str,
        event_type: str,
        magnitude: float,
        locale: str = "de",
    ) -> dict:
        """Transform a substrate resonance into a simulation-native event.

        Returns dict with title, description, and optionally impact_level.
        """
        result = await self._generate(
            template_type="resonance_transformation",
            model_purpose="news_transformation",
            variables={
                "archetype_name": archetype_name,
                "archetype_description": archetype_description,
                "resonance_title": resonance_title,
                "resonance_description": resonance_description or "",
                "event_type": event_type,
                "magnitude": str(round(magnitude * 10)),
                "simulation_name": await self._get_simulation_name(),
                "locale_name": LOCALE_NAMES.get(locale, locale),
            },
            locale=locale,
        )

        raw_content = result.get("content", "")
        parsed = self._parse_json_content(raw_content)
        if parsed:
            return {
                "title": parsed.get("title", f"{archetype_name} — {event_type}"),
                "description": parsed.get("description", raw_content),
                "impact_level": parsed.get("impact_level"),
            }
        return {
            "title": f"{archetype_name} — {event_type}",
            "description": raw_content,
        }

    # --- Story closing lines ---

    async def generate_story_closing_line(
        self,
        archetype_name: str,
        archetype_description: str,
        simulation_name: str,
        simulation_description: str,
    ) -> str | None:
        """Generate a one-sentence poetic closing line for a resonance impact Story.

        Returns a single sentence (max ~15 words) or None on failure.
        Uses template_type ``story_closing_line`` (migration 143).
        """
        try:
            result = await self._generate(
                template_type="story_closing_line",
                model_purpose="event_generation",
                variables={
                    "archetype_name": archetype_name,
                    "archetype_description": archetype_description,
                    "simulation_name": simulation_name,
                    "simulation_description": simulation_description or "",
                },
                locale="en",
            )
            line = result.get("content", "").strip().strip('"').strip()
            # Enforce brevity — take first sentence if AI returns more
            if ". " in line:
                line = line.split(". ")[0] + "."
            return line[:120] if line else None
        except (httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
            logger.warning("Story closing line generation failed", exc_info=True)
            sentry_sdk.capture_exception(exc)
            return None

    # --- Narrative façades (memory, chronicle, sitrep, instagram) ---
    #
    # The five methods below are the public entry points for narrative
    # generation outside `GenerationService`. They own their template type /
    # model purpose / variable mapping and return typed DTOs, so callers
    # never need to know the internal `_generate(...)` contract.
    #
    # `_generate` stays private. A CI lint gate
    # (`scripts/lint-no-private-generate.sh`) rejects any `_generate(` call
    # in `backend/services/` outside this file — see W2.4 remediation.

    async def extract_memory_observations(
        self,
        *,
        agent_name: str,
        simulation_name: str,
        user_message: str,
        agent_response: str,
    ) -> MemoryObservationBatch:
        """Extract salient observations from an agent-user chat exchange.

        Runs the `memory_extraction` prompt through the `chat_response` model
        tier; the LLM returns JSON ``{"observations": [{"content", "importance"}]}``.
        Returns a typed batch — callers persist observations via
        ``AgentMemoryService.record_observation`` one at a time.
        """
        result = await self._generate(
            template_type="memory_extraction",
            model_purpose="chat_response",
            variables={
                "agent_name": agent_name,
                "simulation_name": simulation_name,
                # Match pre-refactor behavior: clip user + agent text to 2 kB
                # each so prompt stays within context window.
                "user_message": user_message[:2000],
                "agent_response": agent_response[:2000],
            },
            locale="en",
        )
        parsed = GenerationService._parse_json_content(result.get("content", ""))
        raw = parsed.get("observations", []) if parsed else []
        observations: list[MemoryObservation] = []
        for obs in raw:
            content = obs.get("content") if isinstance(obs, dict) else None
            if not content:
                continue
            importance = obs.get("importance", 5) if isinstance(obs, dict) else 5
            observations.append(MemoryObservation(content=content, importance=importance))
        return MemoryObservationBatch(
            observations=observations,
            model_used=result.get("model_used", "unknown"),
        )

    async def reflect_on_memories(
        self,
        *,
        agent_name: str,
        simulation_name: str,
        observations_text: str,
        locale: str = "en",
    ) -> MemoryReflectionBatch:
        """Synthesize higher-level reflections from recent observations.

        Expects `observations_text` to be a preformatted multi-line list
        (e.g. ``"- [8/10] ...\\n- [5/10] ..."``); building that string is the
        caller's concern, not the façade's.
        """
        result = await self._generate(
            template_type="memory_reflection",
            model_purpose="chat_response",
            variables={
                "agent_name": agent_name,
                "simulation_name": simulation_name,
                "observations_text": observations_text,
            },
            locale=locale,
        )
        parsed = GenerationService._parse_json_content(result.get("content", ""))
        raw = parsed.get("reflections", []) if parsed else []
        reflections: list[MemoryReflection] = []
        for ref in raw:
            content = ref.get("content") if isinstance(ref, dict) else None
            if not content:
                continue
            importance = ref.get("importance", 5) if isinstance(ref, dict) else 5
            reflections.append(MemoryReflection(content=content, importance=importance))
        return MemoryReflectionBatch(
            reflections=reflections,
            model_used=result.get("model_used", "unknown"),
        )

    async def generate_chronicle_entry(
        self,
        *,
        edition_number: int,
        simulation_name: str,
        period_start: str,
        period_end: str,
        event_summary: str,
        echo_summary: str,
        battle_summary: str,
        reaction_summary: str,
        locale: str = "en",
    ) -> ChronicleEntryDraft:
        """Generate a chronicle edition from pre-serialized period summaries.

        Dates are passed as ``YYYY-MM-DD`` strings (not ``datetime``) so the
        caller controls formatting. The `*_summary` inputs are expected to be
        JSON-serialized lists of records — the prompt embeds them verbatim.
        Parses the LLM's JSON response into ``{title, headline, content}``
        with a sensible fallback when parsing fails.
        """
        result = await self._generate(
            template_type="chronicle_generation",
            model_purpose="event_generation",
            variables={
                "edition_number": str(edition_number),
                "simulation_name": simulation_name,
                "period_start": period_start,
                "period_end": period_end,
                "event_summary": event_summary,
                "echo_summary": echo_summary,
                "battle_summary": battle_summary,
                "reaction_summary": reaction_summary,
            },
            locale=locale,
        )
        raw_content = result.get("content", "")
        parsed = GenerationService._parse_json_content(raw_content)
        default_title = f"Chronicle Edition #{edition_number}"
        if parsed:
            title = parsed.get("title") or default_title
            headline = parsed.get("headline")
            content = parsed.get("content") or raw_content
        else:
            title = default_title
            headline = None
            content = raw_content
        return ChronicleEntryDraft(
            title=title,
            headline=headline,
            content=content,
            model_used=result.get("model_used", "unknown"),
        )

    async def generate_cycle_sitrep(
        self,
        *,
        cycle_number: int,
        battle_stats: dict,
    ) -> CycleSitrepDraft:
        """Generate a tactical situation report for one epoch cycle.

        `battle_stats` is the shape returned by the
        ``get_cycle_battle_summary`` RPC (migration 065b); it is serialized
        to JSON and embedded in the prompt as ``battle_stats``.
        """
        result = await self._generate(
            template_type="cycle_sitrep_generation",
            model_purpose="event_generation",
            variables={
                "cycle_number": str(cycle_number),
                "battle_stats": json.dumps(battle_stats, default=str),
            },
            locale="en",
        )
        return CycleSitrepDraft(
            sitrep=result.get("content", ""),
            model_used=result.get("model_used", "unknown"),
        )

    async def generate_instagram_caption(
        self,
        *,
        content_type: str,
        simulation_name: str,
        dispatch_number: int,
        date: str,
        entity_name: str,
        entity_context: str,
        locale: str = "en",
    ) -> InstagramCaptionDraft:
        """Generate the raw body of an Instagram caption (pre-footer).

        Template id is derived as ``instagram_{content_type}_caption``;
        `content_type` must match a prompt-template row the simulation has
        (validation happens inside `_generate` → `PromptResolver`). The AI
        disclosure footer and Instagram length-limit truncation are the
        caller's concern — the façade returns the raw LLM output.
        """
        result = await self._generate(
            template_type=f"instagram_{content_type}_caption",
            model_purpose="social_trends",
            variables={
                "simulation_name": simulation_name,
                "dispatch_number": str(dispatch_number),
                "date": date,
                "entity_name": entity_name,
                "entity_context": entity_context,
            },
            locale=locale,
        )
        return InstagramCaptionDraft(
            caption=result.get("content", ""),
            model_used=result.get("model_used", "unknown"),
        )

    # --- JSON parsing ---

    async def _parse_or_repair_json(
        self,
        content: str,
        model_id: str,
        pydantic_model: type | None = None,
    ) -> dict | None:
        """Parse JSON from LLM response, with LLM repair as last resort.

        Tries _parse_json_content() first. If that fails and a pydantic_model
        is provided, asks the LLM to fix the malformed output.
        """
        parsed = self._parse_json_content(content)
        if parsed is not None:
            return parsed

        if pydantic_model is None:
            return None

        logger.warning("Attempting LLM repair for malformed JSON output")
        return await repair_json_output(
            openrouter=self._openrouter,
            model=model_id,
            malformed_output=content,
            pydantic_model=pydantic_model,
        )

    @staticmethod
    def _parse_json_content(content: str) -> dict | None:
        """Extract and parse JSON from LLM response.

        Handles:
        1. Embedded ```json ... ``` blocks within mixed narrative+JSON content
        2. Content that is entirely a fenced JSON block
        3. Raw JSON without fences
        4. Regex fallback for truncated/incomplete JSON

        Returns parsed dict or None if parsing fails.
        """
        # 1. Try extracting an embedded ```json ... ``` block from mixed content
        fence_match = re.search(r"```json\s*([\s\S]*?)```", content)
        if fence_match:
            try:
                return json.loads(fence_match.group(1).strip())
            except (json.JSONDecodeError, ValueError):
                pass

        # 2. Try stripping fences at start/end (content is entirely fenced JSON)
        cleaned = re.sub(r"^```(?:json)?\s*", "", content.strip())
        cleaned = re.sub(r"\s*```$", "", cleaned.strip())

        try:
            return json.loads(cleaned)
        except (json.JSONDecodeError, ValueError):
            pass

        # 3. Fallback: extract fields via regex from truncated JSON
        return GenerationService._extract_json_fields(cleaned)

    @staticmethod
    def _extract_json_fields(text: str) -> dict | None:
        """Extract string fields from potentially truncated JSON using regex.

        Looks for "key": "value" patterns. Handles multi-line string values
        by matching up to the next unescaped closing quote followed by a
        comma, closing brace, or end of known field.
        """
        result: dict[str, str] = {}
        # Match "key": "value" where value may span multiple lines
        # Uses a pattern that finds complete key-value pairs
        pattern = r'"(\w+)"\s*:\s*"((?:[^"\\]|\\.)*)"\s*[,}]'
        for match in re.finditer(pattern, text, re.DOTALL):
            key = match.group(1)
            value = match.group(2)
            # Unescape common JSON escapes
            value = value.replace('\\"', '"').replace("\\n", "\n").replace("\\t", "\t")
            result[key] = value

        return result if result else None

    # --- Internal helpers ---

    async def _generate(
        self,
        template_type: str,
        model_purpose: str,
        variables: dict[str, str],
        locale: str,
        *,
        game_context: dict | None = None,
    ) -> dict:
        """Core generation pipeline: resolve prompt + model, call LLM with fallback.

        Args:
            game_context: Optional dict of game mechanics metrics. When provided,
                a structured context block is appended to the user prompt so the
                LLM can incorporate simulation state into its narrative.
        """
        # Excluded from mock mode:
        # - agent/building: image pipeline (description → Replicate) needs real text
        # - news_transformation: resonance events need structured JSON for proper creation
        mock_excluded_purposes = {"agent_description", "building_description", "news_transformation"}
        if settings.forge_mock_mode and model_purpose not in mock_excluded_purposes:
            logger.info("MOCK_MODE: returning template %s content", template_type)
            return {
                "content": (
                    f"[MOCK {template_type}] Generated content for {variables.get('simulation_name', 'simulation')}."
                ),
                "model_used": "mock",
                "template_source": "mock",
                "locale": locale,
            }

        # 1. Resolve prompt template
        prompt = await self._prompt_resolver.resolve(template_type, locale)

        # 2. Fill template with variables
        filled_prompt = self._prompt_resolver.fill_template(prompt, variables)

        # 2b. Append game mechanics context if provided
        if game_context:
            filled_prompt += self._format_game_context(game_context)

        # 3. Build system prompt with language instruction
        system_prompt = prompt.system_prompt or ""
        system_prompt += PromptResolver.build_language_instruction(locale)

        # 4. Resolve model (use template's default_model as hint)
        model = await self._model_resolver.resolve_text_model(model_purpose)

        # 5. Call LLM with fallback
        content = await self._call_with_fallback(
            model=model,
            system_prompt=system_prompt,
            user_prompt=filled_prompt,
            purpose=template_type,
        )

        return {
            "content": content,
            "model_used": model.model_id,
            "template_source": prompt.source,
            "locale": locale,
        }

    _BACKOFFS = (5, 10)  # seconds to wait on rate limit before retry

    async def _call_with_fallback(
        self,
        model: ResolvedModel,
        system_prompt: str,
        user_prompt: str,
        *,
        purpose: str = "description",
    ) -> str:
        """Call LLM with 3-layer resilience: backoff-retry → fallback → default.

        Layer 1: On RateLimitError, backoff-retry on the SAME model (5s, 10s).
        Layer 2: If retries exhausted, fall back to platform fallback model.
        Layer 3: On ModelUnavailableError, fall back to platform default.
        """
        # Bureau Ops Deferral A.2 — simulation_id is on ``self``; user_id
        # is not threaded into GenerationService (instance-scoped to a
        # simulation, not a user action). Enforce global + purpose + sim
        # budgets. The budget pre_check fires on layer 1; if exceeded,
        # layers 2 and 3 are skipped (exceeded budget must NOT fall back
        # to another model — that just spends more budget).
        admin_supabase = await get_admin_supabase()
        budget = BudgetContext(
            admin_supabase=admin_supabase,
            purpose=purpose,
            simulation_id=self._simulation_id,
        )

        # ── Layer 1: backoff-retry on same model ────────────────────
        for attempt, backoff in enumerate((0, *self._BACKOFFS)):
            if backoff:
                logger.warning(
                    "Rate limited on %s, retrying in %ds (attempt %d/%d)",
                    model.model_id, backoff, attempt + 1, len(self._BACKOFFS) + 1,
                    extra={"purpose": purpose},
                )
                sentry_sdk.add_breadcrumb(
                    category="ai", level="warning",
                    message=f"429 retry #{attempt} for {purpose}, waiting {backoff}s",
                )
                await asyncio.sleep(backoff)

            try:
                result = await self._openrouter.generate_with_system(
                    model=model.model_id,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=model.temperature,
                    max_tokens=model.max_tokens,
                    budget=budget,
                )
                await AIUsageService.log(
                    self._supabase,
                    simulation_id=self._simulation_id,
                    provider="openrouter",
                    model=model.model_id,
                    purpose=purpose,
                    usage=self._openrouter.last_usage,
                )
                return result
            except RateLimitError:
                continue  # try next backoff
            except ModelUnavailableError:
                break  # skip to layer 3

        # ── Layer 2: platform fallback model ────────────────────────
        logger.warning(
            "Rate limited after %d retries, falling back to platform fallback",
            len(self._BACKOFFS) + 1,
            extra={"purpose": purpose, "original_model": model.model_id},
        )
        sentry_sdk.add_breadcrumb(
            category="ai", level="warning",
            message=f"429 fallback for {purpose}",
        )
        try:
            fallback = await self._model_resolver.resolve_text_model("fallback")
            result = await self._openrouter.generate_with_system(
                model=fallback.model_id,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=fallback.temperature,
                max_tokens=fallback.max_tokens,
                budget=budget,
            )
            await AIUsageService.log(
                self._supabase,
                simulation_id=self._simulation_id,
                provider="openrouter",
                model=fallback.model_id,
                purpose=purpose,
                usage=self._openrouter.last_usage,
            )
            return result
        except (RateLimitError, ModelUnavailableError):
            pass  # fall through to layer 3

        # ── Layer 3: platform default model (last resort) ──────────
        logger.warning(
            "Fallback also failed, using platform default",
            extra={"purpose": purpose},
        )
        default_model = PLATFORM_DEFAULT_MODELS["default"]
        result = await self._openrouter.generate_with_system(
            model=default_model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            budget=budget,
        )
        await AIUsageService.log(
            self._supabase,
            simulation_id=self._simulation_id,
            provider="openrouter",
            model=default_model,
            purpose=purpose,
            usage=self._openrouter.last_usage,
        )
        return result

    @staticmethod
    def _format_game_context(ctx: dict) -> str:
        """Format game mechanics metrics as a structured context block.

        This is appended to the user prompt so the LLM can reflect simulation
        state in its narrative output. Only non-empty values are included.
        """
        lines = ["\n\n--- SIMULATION STATE ---"]

        if "zone_stability" in ctx:
            s = ctx["zone_stability"]
            lines.append(f"Zone stability: {s:.0%} ({ctx.get('zone_stability_label', '')})")
        if "zone_security" in ctx:
            lines.append(f"Zone security level: {ctx['zone_security']}")
        if "building_readiness" in ctx:
            r = ctx["building_readiness"]
            lines.append(f"Average building readiness: {r:.0%}")
        if "critical_buildings" in ctx:
            lines.append(f"Critically understaffed buildings: {ctx['critical_buildings']}")
        if "simulation_health" in ctx:
            h = ctx["simulation_health"]
            lines.append(f"Overall simulation health: {h:.0%} ({ctx.get('health_label', '')})")
        if "embassy_effectiveness" in ctx:
            e = ctx["embassy_effectiveness"]
            lines.append(f"Embassy effectiveness: {e:.0%}")
        if "bleed_permeability" in ctx:
            p = ctx["bleed_permeability"]
            lines.append(f"Bleed permeability: {p:.0%}")
        if "diplomatic_reach" in ctx:
            lines.append(f"Diplomatic reach: {ctx['diplomatic_reach']:.2f}")
        if "event_pressure" in ctx:
            lines.append(f"Recent event pressure: {ctx['event_pressure']:.0%}")

        # Narrative guidance based on metrics
        guidance = ctx.get("narrative_guidance")
        if guidance:
            lines.append(f"\nNarrative tone: {guidance}")

        lines.append("---")
        return "\n".join(lines)

    async def _get_simulation_name(self) -> str:
        """Get the simulation name from the database."""
        response = await (
            self._supabase.table("simulations").select("name").eq("id", str(self._simulation_id)).limit(1).execute()
        )
        if response and response.data:
            return response.data[0].get("name", "Unknown Simulation")
        return "Unknown Simulation"
