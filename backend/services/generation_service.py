"""Generation service for all AI text generation types."""

from __future__ import annotations

import json
import logging
from uuid import UUID

from backend.services.external.openrouter import (
    ModelUnavailableError,
    OpenRouterService,
    RateLimitError,
)
from backend.services.model_resolver import ModelResolver, ResolvedModel
from backend.services.prompt_service import LOCALE_NAMES, PromptResolver
from supabase import Client

logger = logging.getLogger(__name__)


class GenerationService:
    """Orchestrates AI text generation using PromptResolver + ModelResolver + OpenRouter."""

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

    async def generate_agent_full(
        self,
        agent_name: str,
        agent_system: str,
        agent_gender: str,
        locale: str = "de",
    ) -> dict:
        """Generate a full agent description (character + background)."""
        return await self._generate(
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

    async def generate_agent_partial(
        self,
        agent_data: dict,
        locale: str = "de",
    ) -> dict:
        """Generate missing fields for a partially filled agent."""
        return await self._generate(
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

    async def generate_building(
        self,
        building_type: str,
        building_name: str | None = None,
        locale: str = "de",
    ) -> dict:
        """Generate a building description."""
        template_type = (
            "building_generation_named" if building_name
            else "building_generation"
        )
        variables: dict[str, str] = {
            "building_type": building_type,
            "simulation_name": await self._get_simulation_name(),
            "locale_name": LOCALE_NAMES.get(locale, locale),
        }
        if building_name:
            variables["building_name"] = building_name

        return await self._generate(
            template_type=template_type,
            model_purpose="building_description",
            variables=variables,
            locale=locale,
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

    async def generate_event(
        self,
        event_type: str,
        locale: str = "de",
    ) -> dict:
        """Generate an event description."""
        return await self._generate(
            template_type="event_generation",
            model_purpose="event_generation",
            variables={
                "event_type": event_type,
                "simulation_name": await self._get_simulation_name(),
                "locale_name": LOCALE_NAMES.get(locale, locale),
            },
            locale=locale,
        )

    async def generate_agent_reaction(
        self,
        agent_data: dict,
        event_data: dict,
        locale: str = "de",
    ) -> str:
        """Generate an agent's reaction to an event."""
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
        )
        return result.get("content", "")

    async def generate_news_transformation(
        self,
        news_title: str,
        news_content: str,
        locale: str = "de",
    ) -> dict:
        """Transform a real news article into the simulation narrative."""
        return await self._generate(
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

    # --- Internal helpers ---

    async def _generate(
        self,
        template_type: str,
        model_purpose: str,
        variables: dict[str, str],
        locale: str,
    ) -> dict:
        """Core generation pipeline: resolve prompt + model, call LLM with fallback."""
        # 1. Resolve prompt template
        prompt = await self._prompt_resolver.resolve(template_type, locale)

        # 2. Fill template with variables
        filled_prompt = self._prompt_resolver.fill_template(prompt, variables)

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
        )

        return {
            "content": content,
            "model_used": model.model_id,
            "template_source": prompt.source,
            "locale": locale,
        }

    async def _call_with_fallback(
        self,
        model: ResolvedModel,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        """Call LLM with automatic fallback on rate limit or model unavailability."""
        try:
            return await self._openrouter.generate_with_system(
                model=model.model_id,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=model.temperature,
                max_tokens=model.max_tokens,
            )
        except RateLimitError:
            logger.warning(
                "Rate limited on %s, falling back", model.model_id,
            )
            fallback = await self._model_resolver.resolve_text_model("fallback")
            return await self._openrouter.generate_with_system(
                model=fallback.model_id,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=fallback.temperature,
                max_tokens=fallback.max_tokens,
            )
        except ModelUnavailableError:
            logger.warning(
                "Model %s unavailable, using platform default",
                model.model_id,
            )
            from backend.services.model_resolver import PLATFORM_DEFAULT_MODELS

            default_model = PLATFORM_DEFAULT_MODELS["default"]
            return await self._openrouter.generate_with_system(
                model=default_model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )

    async def _get_simulation_name(self) -> str:
        """Get the simulation name from the database."""
        response = (
            self._supabase.table("simulations")
            .select("name")
            .eq("id", str(self._simulation_id))
            .maybe_single()
            .execute()
        )
        if response.data:
            return response.data.get("name", "Unknown Simulation")
        return "Unknown Simulation"
