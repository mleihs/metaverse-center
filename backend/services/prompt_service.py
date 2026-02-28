"""Prompt template resolver with 5-level fallback chain."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from uuid import UUID

from supabase import Client

logger = logging.getLogger(__name__)

LOCALE_NAMES: dict[str, str] = {
    "de": "Deutsch",
    "en": "English",
    "fr": "Fran\u00e7ais",
    "es": "Espa\u00f1ol",
    "it": "Italiano",
    "pt": "Portugu\u00eas",
    "nl": "Nederlands",
    "pl": "Polski",
    "ru": "\u0420\u0443\u0441\u0441\u043a\u0438\u0439",
    "ja": "\u65e5\u672c\u8a9e",
    "zh": "\u4e2d\u6587",
    "ko": "\ud55c\uad6d\uc5b4",
}


# Hardcoded fallback prompts (last resort)
HARDCODED_FALLBACKS: dict[str, str] = {
    "agent_generation_full": (
        "Generate a character description for an agent named {agent_name} "
        "in a simulation called {simulation_name}. System: {agent_system}. "
        "Gender: {agent_gender}. Respond in {locale_name}."
    ),
    "agent_generation_partial": (
        "Complete the character profile for {agent_name} "
        "in {simulation_name}. Fill in missing fields. Respond in {locale_name}."
    ),
    "building_generation": (
        "Describe a building of type {building_type} "
        "for the simulation {simulation_name}. Respond in {locale_name}."
    ),
    "building_generation_named": (
        "Describe a building named {building_name} of type {building_type} "
        "for the simulation {simulation_name}. Respond in {locale_name}."
    ),
    "portrait_description": (
        "Describe a photorealistic portrait of {agent_name}. "
        "Include age, facial features, clothing, and mood. Respond in English."
    ),
    "event_generation": (
        "Create an event of type {event_type} "
        "for the simulation {simulation_name}. Respond in {locale_name}."
    ),
    "chat_system_prompt": (
        "You are {agent_name}, a character in {simulation_name}. "
        "Stay in character. Respond in {locale_name}."
    ),
    "news_transformation": (
        "Transform the following news article into the narrative "
        "of {simulation_name}. Respond in {locale_name}."
    ),
    "social_media_transform_dystopian": (
        "Transform the following social media post into a dystopian "
        "propaganda version. Respond in {locale_name}."
    ),
    "chat_event_context": (
        "--- REFERENCED EVENTS ---\n{event_list}\n--- END EVENTS ---"
    ),
    "chat_event_item": (
        "[{event_title}] (Type: {event_type}, Impact: {impact_level}/10, Date: {occurred_at})\n"
        "{event_description}"
    ),
    "chat_group_instruction": (
        "You are in a group conversation. The other participants are: {other_agent_names}. "
        "Respond to the user's and other agents' statements. "
        "Reference the mentioned events when relevant to the conversation."
    ),
    "chat_event_reaction": (
        "{agent_name} reacted to \"{event_title}\": {reaction_text} (Emotion: {emotion})"
    ),
    "epoch_invitation_lore": (
        "Draft a classified tactical dispatch summoning operatives to "
        "Operation {epoch_name}. Briefing: {epoch_description}. "
        "Known participants: {participant_names}. "
        "Write one terse paragraph in military intelligence style."
    ),
}


@dataclass
class ResolvedPrompt:
    """A resolved prompt template ready for variable substitution."""

    template_type: str
    locale: str
    prompt_content: str
    system_prompt: str | None
    variables: list[dict]
    default_model: str | None
    temperature: float
    max_tokens: int
    negative_prompt: str | None
    source: str  # Where this was resolved from


class PromptResolver:
    """Resolves prompt templates using a 5-level fallback chain.

    Resolution order:
    1. Simulation + requested locale
    2. Simulation + simulation's default locale
    3. Platform default + requested locale
    4. Platform default + 'en'
    5. Hardcoded fallback
    """

    def __init__(self, supabase: Client, simulation_id: UUID | None = None):
        self._supabase = supabase
        self._simulation_id = simulation_id
        self._sim_locale: str | None = None

    async def _get_simulation_locale(self) -> str:
        """Get the simulation's default content locale."""
        if self._sim_locale is not None:
            return self._sim_locale

        if not self._simulation_id:
            self._sim_locale = "en"
            return "en"

        response = (
            self._supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(self._simulation_id))
            .eq("setting_key", "general.content_locale")
            .limit(1)
            .execute()
        )

        if response and response.data:
            row = response.data[0] if isinstance(response.data, list) else response.data
            self._sim_locale = str(row.get("setting_value", "en"))
        else:
            self._sim_locale = "en"

        return self._sim_locale

    async def resolve(
        self,
        template_type: str,
        locale: str | None = None,
    ) -> ResolvedPrompt:
        """Resolve a prompt template using the 5-level fallback chain."""
        if locale is None:
            locale = await self._get_simulation_locale()

        # 1. Simulation + requested locale
        if self._simulation_id:
            template = await self._find_template(self._simulation_id, template_type, locale)
            if template:
                return self._to_resolved(template, locale, "simulation+locale")

            # 2. Simulation + simulation's default locale
            sim_locale = await self._get_simulation_locale()
            if locale != sim_locale:
                template = await self._find_template(self._simulation_id, template_type, sim_locale)
                if template:
                    return self._to_resolved(template, sim_locale, "simulation+default_locale")

        # 3. Platform default + requested locale
        template = await self._find_template(None, template_type, locale)
        if template:
            return self._to_resolved(template, locale, "platform+locale")

        # 4. Platform default + 'en'
        if locale != "en":
            template = await self._find_template(None, template_type, "en")
            if template:
                return self._to_resolved(template, "en", "platform+en")

        # 5. Hardcoded fallback
        logger.warning(
            "Using hardcoded fallback for '%s' (locale=%s, sim=%s)",
            template_type,
            locale,
            self._simulation_id,
        )
        fallback_content = HARDCODED_FALLBACKS.get(
            template_type,
            f"Generate content for {template_type}. Respond in {LOCALE_NAMES.get(locale, locale)}.",
        )
        return ResolvedPrompt(
            template_type=template_type,
            locale=locale,
            prompt_content=fallback_content,
            system_prompt=None,
            variables=[],
            default_model=None,
            temperature=0.7,
            max_tokens=1024,
            negative_prompt=None,
            source="hardcoded_fallback",
        )

    async def _find_template(
        self,
        simulation_id: UUID | None,
        template_type: str,
        locale: str,
    ) -> dict | None:
        """Query for a single prompt template."""
        query = (
            self._supabase.table("prompt_templates")
            .select("*")
            .eq("template_type", template_type)
            .eq("locale", locale)
            .eq("is_active", True)
        )

        if simulation_id is not None:
            query = query.eq("simulation_id", str(simulation_id))
        else:
            query = query.is_("simulation_id", "null")

        response = query.limit(1).execute()
        if response and response.data:
            return response.data[0] if isinstance(response.data, list) else response.data
        return None

    @staticmethod
    def _to_resolved(template: dict, locale: str, source: str) -> ResolvedPrompt:
        """Convert a DB row to a ResolvedPrompt."""
        return ResolvedPrompt(
            template_type=template["template_type"],
            locale=locale,
            prompt_content=template.get("prompt_content", ""),
            system_prompt=template.get("system_prompt"),
            variables=template.get("variables") or [],
            default_model=template.get("default_model"),
            temperature=float(template.get("temperature", 0.7)),
            max_tokens=int(template.get("max_tokens", 1024)),
            negative_prompt=template.get("negative_prompt"),
            source=source,
        )

    @staticmethod
    def build_language_instruction(locale: str) -> str:
        """Build a language instruction suffix for system prompts."""
        locale_name = LOCALE_NAMES.get(locale, locale)
        return f"\n\nIMPORTANT: Always respond in {locale_name}."

    def fill_template(self, template: ResolvedPrompt, variables: dict[str, str]) -> str:
        """Fill a template with variables using Python str.format_map."""
        try:
            return template.prompt_content.format_map(variables)
        except KeyError as e:
            logger.warning(
                "Missing variable %s in template '%s'",
                e,
                template.template_type,
            )
            # Use a permissive formatter that leaves missing vars as-is
            return _safe_format(template.prompt_content, variables)


def _safe_format(template: str, variables: dict[str, str]) -> str:
    """Format a string, leaving unknown variables as {name}."""
    import re

    def replace(match: re.Match) -> str:
        key = match.group(1)
        return variables.get(key, match.group(0))

    return re.sub(r"\{(\w+)\}", replace, template)
