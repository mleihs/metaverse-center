"""Prompt template resolver with 5-level fallback chain."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

import sentry_sdk

from backend.services.prompt_contracts import (
    Defect,
    PromptContract,
    get_contract,
    render_template,
)
from supabase import AsyncClient as Client

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
        "Describe a building of type {building_type} for the simulation {simulation_name}. Respond in {locale_name}."
    ),
    "building_generation_named": (
        "Describe a building named {building_name} of type {building_type} "
        "for the simulation {simulation_name}. Respond in {locale_name}."
    ),
    "portrait_description": (
        "Describe a photorealistic portrait of {agent_name} "
        "who inhabits the world of {simulation_name}.\n\n"
        "Character: {agent_character}\n"
        "Background: {agent_background}\n"
        "Gender: {agent_gender}\n\n"
        "{world_context}\n\n"
        "Write a concise image prompt (2-3 sentences) for a portrait photograph. "
        "Include age, facial features, clothing appropriate to the world, and mood. "
        "The portrait must feel like it belongs in THIS world – use the visual "
        "identity from the lore context above. Respond in English."
    ),
    "event_generation": (
        "Create an event of type {event_type} for the simulation {simulation_name}. Respond in {locale_name}."
    ),
    "news_transformation": (
        "Transform the following news article into the narrative of {simulation_name}. Respond in {locale_name}."
    ),
    "social_media_transform_dystopian": (
        "Transform the following social media post into a dystopian propaganda version. Respond in {locale_name}."
    ),
    "chat_event_context": ("--- REFERENCED EVENTS ---\n{event_list}\n--- END EVENTS ---"),
    "chat_event_item": (
        "[{event_title}] (Type: {event_type}, Impact: {impact_level}/10, Date: {occurred_at})\n{event_description}"
    ),
    "chat_group_instruction": (
        "You are in a group conversation. The other participants are: {other_agent_names}. "
        "Respond to the user's and other agents' statements. "
        "Reference the mentioned events when relevant to the conversation. "
        "In the conversation history, other agents' messages are prefixed with [AgentName]: "
        "for identification \u2013 this is context only, do NOT replicate this pattern in your response. "
        "Respond ONLY as yourself, never speak for other agents."
    ),
    "chat_event_reaction": ('{agent_name} reacted to "{event_title}": {reaction_text} (Emotion: {emotion})'),
    "epoch_invitation_lore": (
        "Draft a classified tactical dispatch summoning operatives to "
        "Operation {epoch_name}. Briefing: {epoch_description}. "
        "Known participants: {participant_names}. "
        "Write one terse paragraph in military intelligence style."
    ),
    "chronicle_generation": (
        "Write edition #{edition_number} of the {simulation_name} chronicle "
        "covering {period_start} to {period_end}. "
        "Events: {event_summary}. Echoes: {echo_summary}. "
        "Battle dispatches: {battle_summary}. Reactions: {reaction_summary}. "
        'Return JSON: {"title": "...", "headline": "...", "content": "..."}'
    ),
    "memory_extraction": (
        "Analyze this conversation between a user and {agent_name} in {simulation_name}. "
        "User: {user_message}. {agent_name}: {agent_response}. "
        "Extract 0-2 key observations. "
        'Return JSON: {"observations": [{"content": "...", "importance": 1-10}]}'
    ),
    "memory_reflection": (
        "You are {agent_name} in {simulation_name}. "
        "Review your recent observations: {observations_text}. "
        "Synthesize 1-3 higher-level reflections. "
        'Return JSON: {"reflections": [{"content": "...", "importance": 1-10}]}'
    ),
    "chat_system_prompt": (
        "You are {agent_name}, a character in {simulation_name}. "
        "Your character: {agent_character}\n"
        "Your background: {agent_background}\n"
        "{agent_memories}\n"
        "Stay in character. Respond in {locale_name}. "
        "Never prefix your response with your name in brackets. "
        "Never include internal reasoning, chain-of-thought, or meta-commentary in your response."
    ),
    "building_image_description": (
        "Describe an architectural photograph of a building for image generation.\n\n"
        "Building: {building_name}\n"
        "Type: {building_type}\n"
        "Condition: {building_condition}\n"
        "Style: {building_style}\n"
        "Description: {building_description}\n"
        "Zone: {zone_name}\n"
        "World: {simulation_name}\n\n"
        "{world_context}\n\n"
        "Write a vivid, cinematic image prompt (2-3 sentences) describing the building's "
        "exterior or most striking interior space. The building must feel like it belongs "
        "in THIS world – use the materials, light quality, and architectural vocabulary "
        "from the lore context above. Include condition indicators, atmosphere, and scale. "
        "Do not mention characters or people."
    ),
    "lore_image_description": (
        "Describe a cinematic scene for lore illustration in the world of {simulation_name}.\n\n"
        "Chapter: {section_title}\n"
        "Context: {section_body}\n\n"
        "{world_context}\n\n"
        "Write a vivid, atmospheric image prompt (2-3 sentences) depicting a key moment "
        "or landscape from this lore passage. The scene must use the visual identity "
        "established in the world context – same materials, light quality, weather, "
        "architectural character. Focus on environment, light, scale, and mood. "
        "No text, no characters in focus, no UI elements. Painterly, cinematic composition."
    ),
}


def report_contract_violation(
    *,
    template_type: str,
    field_name: str,
    defects: dict[Defect, frozenset[str]],
    service: str,
    source: str,
    simulation_id: UUID | None = None,
) -> None:
    """Log and report that a stored template disagrees with its contract.

    Shared by the two places that can notice: the renderer, which sees it on
    every request, and the Forge, which sees it once when a model writes the
    template. Both used to carry the same eighteen lines.
    """
    if not defects:
        return
    readable = {defect.value: sorted(names) for defect, names in defects.items()}
    logger.warning(
        "Prompt template '%s' (%s, %s) violates its contract: %s",
        template_type,
        source,
        field_name,
        readable,
        extra={"simulation_id": str(simulation_id) if simulation_id else None},
    )
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("service", service)
        scope.set_tag("template_type", template_type)
        scope.set_tag("template_source", source)
        if simulation_id:
            scope.set_tag("simulation_id", str(simulation_id))
        scope.set_context("prompt_contract", {"field": field_name, **readable})
        sentry_sdk.capture_message(
            f"Prompt template '{template_type}' violates its contract",
            level="warning",
        )


class PromptSource(StrEnum):
    """Which of the five resolution levels produced a template.

    This is a *decision*, not a caption: `is_simulation_owned` gates the platform
    frame on it. As a bare display string, renaming a label would have switched
    the frame off silently — no test, no type error.
    """

    SIMULATION_LOCALE = "simulation+locale"
    SIMULATION_DEFAULT_LOCALE = "simulation+default_locale"
    PLATFORM_LOCALE = "platform+locale"
    PLATFORM_EN = "platform+en"
    HARDCODED_FALLBACK = "hardcoded_fallback"


# The levels that mean "this world wrote it", and therefore "frame it".
_SIMULATION_SOURCES = frozenset({PromptSource.SIMULATION_LOCALE, PromptSource.SIMULATION_DEFAULT_LOCALE})


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
    source: PromptSource

    @property
    def is_simulation_owned(self) -> bool:
        """True when this template came from the simulation's own rows.

        Only those get the platform frame appended: a platform template already
        carries its guarantees inline, and the hardcoded fallback is ours.
        """
        return self.source in _SIMULATION_SOURCES

    @property
    def contract(self) -> PromptContract | None:
        """The declared contract for this template type, if the code renders it."""
        return get_contract(self.template_type)


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

        response = await (
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
                return self._to_resolved(template, locale, PromptSource.SIMULATION_LOCALE)

            # 2. Simulation + simulation's default locale
            sim_locale = await self._get_simulation_locale()
            if locale != sim_locale:
                template = await self._find_template(self._simulation_id, template_type, sim_locale)
                if template:
                    return self._to_resolved(template, sim_locale, PromptSource.SIMULATION_DEFAULT_LOCALE)

        # 3. Platform default + requested locale
        template = await self._find_template(None, template_type, locale)
        if template:
            return self._to_resolved(template, locale, PromptSource.PLATFORM_LOCALE)

        # 4. Platform default + 'en'
        if locale != "en":
            template = await self._find_template(None, template_type, "en")
            if template:
                return self._to_resolved(template, "en", PromptSource.PLATFORM_EN)

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
            source=PromptSource.HARDCODED_FALLBACK,
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

        response = await query.limit(1).execute()
        if response and response.data:
            return response.data[0] if isinstance(response.data, list) else response.data
        return None

    @staticmethod
    def _to_resolved(template: dict, locale: str, source: PromptSource) -> ResolvedPrompt:
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
        """Fill a template's user prompt and append the platform frame.

        The frame is what a simulation-owned template may not edit away:
        composition and subject count for an image, the JSON shape for the
        chronicle, staying in character for chat. Phase A.6 replaced templates
        that carried those guarantees with templates that did not, which is how
        one portrait came back as two people in one frame.
        """
        rendered = self._render(
            template.prompt_content,
            variables,
            template,
            field_name="prompt_content",
        )

        contract = template.contract
        if contract and contract.frame and template.is_simulation_owned:
            return f"{rendered}\n\n{contract.frame}"
        return rendered

    def fill_system_prompt(self, template: ResolvedPrompt, variables: dict[str, str]) -> str:
        """Fill a template's system prompt with the same variables.

        The system prompt is part of the template and names variables like any
        other half of it — the platform ``chronicle_generation`` row opens with
        "You are the editor-in-chief of {simulation_name}'s newspaper". Until
        this method existed nothing substituted it, so that literal brace went
        to the model on every chronicle edition.
        """
        if not template.system_prompt:
            return ""
        return self._render(
            template.system_prompt,
            variables,
            template,
            field_name="system_prompt",
        )

    def _render(
        self,
        text: str,
        variables: dict[str, str],
        template: ResolvedPrompt,
        *,
        field_name: str,
    ) -> str:
        """Render one field of a template and report what the template got wrong.

        A declared variable without a value renders empty and is silent — several
        are conditional at their call site. An *undeclared* placeholder is a
        defect: it means the stored template names something no code supplies,
        and leaving it standing is how ``{leserlichkeit_level}`` reached a
        rendered portrait as an invented number. Both defect classes are logged
        and reported to Sentry with the simulation in scope.
        """
        result = render_template(text, variables, template.contract)
        report_contract_violation(
            template_type=template.template_type,
            field_name=field_name,
            defects=result.audit.defects,
            service="PromptResolver",
            source=str(template.source),
            simulation_id=self._simulation_id,
        )
        return result.text
