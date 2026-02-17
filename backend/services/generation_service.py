"""Generation service for all AI text generation types."""

from __future__ import annotations

import json
import logging
import re
from uuid import UUID

from backend.services.external.openrouter import (
    ModelUnavailableError,
    OpenRouterService,
    RateLimitError,
)
from backend.services.external.output_repair import repair_json_output
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
            r"^\*\*(?:Titel|Title):\*\*\s*[^\n]*\n?", "", narrative,
        ).strip()
        narrative = re.sub(
            r"^\*\*(?:Artikel|Article):\*\*\s*\n?", "", narrative,
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

        logger.info("Attempting LLM repair for malformed JSON output")
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
            .limit(1)
            .execute()
        )
        if response and response.data:
            return response.data[0].get("name", "Unknown Simulation")
        return "Unknown Simulation"
