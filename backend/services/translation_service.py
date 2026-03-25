"""Dual-backend translation service (Claude via OpenRouter / DeepL)."""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

import httpx
from pydantic_ai import Agent

from backend.config import settings
from backend.models.translation import TranslationContext, TranslationResult
from backend.services.ai_utils import get_openrouter_model, run_ai
from backend.services.platform_model_config import get_platform_model
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# ── Translatable field mappings per table ────────────────────────────

TRANSLATABLE_FIELDS: dict[str, dict[str, str]] = {
    "agents": {
        "character": "character_de",
        "background": "background_de",
        "primary_profession": "primary_profession_de",
    },
    "buildings": {
        "description": "description_de",
        "building_type": "building_type_de",
        "building_condition": "building_condition_de",
    },
    "zones": {
        "description": "description_de",
        "zone_type": "zone_type_de",
    },
    "city_streets": {
        "street_type": "street_type_de",
    },
    "simulations": {
        "description": "description_de",
    },
    "simulation_lore": {
        "title": "title_de",
        "epigraph": "epigraph_de",
        "body": "body_de",
        "image_caption": "image_caption_de",
    },
    "simulation_chronicles": {
        "title": "title_de",
        "headline": "headline_de",
        "content": "content_de",
    },
    "agent_memories": {
        "content": "content_de",
    },
    "agent_activities": {
        "narrative_text": "narrative_text_de",
    },
}

TRANSLATOR_SYSTEM_PROMPT = (
    "You are a professional literary translator for a narrative simulation platform. "
    "Translate from {source_lang} to {target_lang}.\n\n"
    "RULES:\n"
    "- Keep ALL proper nouns UNTRANSLATED: character names, place names, building names, "
    "zone names, street names. These are fictional and must stay in their original form.\n"
    "- Use formal {target_lang} prose appropriate for narrative/literary context.\n"
    "- The translation should read as if originally written in {target_lang}.\n"
    "- Preserve paragraph structure and formatting.\n"
    "- For short fields (types, conditions), translate concisely.\n"
    "{context_block}"
)


def _build_context_block(context: TranslationContext | None) -> str:
    """Build context information for the translator prompt."""
    if not context:
        return ""
    parts = [f"\nCONTEXT:\n- Simulation: {context.simulation_name} ({context.simulation_theme})"]
    parts.append(f"- Entity type: {context.entity_type}")
    if context.entity_name:
        parts.append(f"- Entity name: {context.entity_name}")
    if context.additional_context:
        parts.append(f"- Notes: {context.additional_context}")
    return "\n".join(parts)


class TranslationService:
    """Translate text fields using either Claude (OpenRouter) or DeepL."""

    @staticmethod
    async def translate_text(
        text: str,
        source_lang: str = "en",
        target_lang: str = "de",
        context: TranslationContext | None = None,
        openrouter_key: str | None = None,
    ) -> str:
        """Translate a single text string."""
        if settings.forge_mock_mode:
            logger.info("MOCK_MODE: returning untranslated text")
            return text

        if settings.translation_backend == "deepl":
            return await TranslationService._translate_deepl(
                text, source_lang, target_lang, context
            )
        return await TranslationService._translate_claude(
            text, source_lang, target_lang, context, openrouter_key
        )

    @staticmethod
    async def translate_fields(
        fields: dict[str, str],
        source_lang: str = "en",
        target_lang: str = "de",
        context: TranslationContext | None = None,
        openrouter_key: str | None = None,
    ) -> dict[str, str]:
        """Translate multiple named fields in a single call.

        Returns a dict mapping field names to translated text.
        """
        if not fields:
            return {}

        if settings.forge_mock_mode:
            logger.info("MOCK_MODE: returning untranslated fields")
            return dict(fields)

        if settings.translation_backend == "deepl":
            return await TranslationService._translate_fields_deepl(
                fields, source_lang, target_lang, context
            )
        return await TranslationService._translate_fields_claude(
            fields, source_lang, target_lang, context, openrouter_key
        )

    # ── Claude (OpenRouter) backend ──────────────────────────────────

    @staticmethod
    async def _translate_claude(
        text: str,
        source_lang: str,
        target_lang: str,
        context: TranslationContext | None,
        openrouter_key: str | None = None,
    ) -> str:
        """Single-text translation via Claude."""
        system = TRANSLATOR_SYSTEM_PROMPT.format(
            source_lang=source_lang,
            target_lang=target_lang,
            context_block=_build_context_block(context),
        )
        agent = Agent(
            get_openrouter_model(openrouter_key, model_id=get_platform_model("forge")),
            system_prompt=system,
        )
        result = await run_ai(
            agent, f"Translate the following text:\n\n{text}", "translation", output_type=str,
        )
        return result.output

    @staticmethod
    async def _translate_fields_claude(
        fields: dict[str, str],
        source_lang: str,
        target_lang: str,
        context: TranslationContext | None,
        openrouter_key: str | None = None,
    ) -> dict[str, str]:
        """Batch field translation via Claude with structured output."""
        system = TRANSLATOR_SYSTEM_PROMPT.format(
            source_lang=source_lang,
            target_lang=target_lang,
            context_block=_build_context_block(context),
        )

        prompt_parts = [
            "Translate each of the following named fields."
            " Return a JSON object mapping field names to translated text.\n"
        ]
        for name, value in fields.items():
            prompt_parts.append(f"--- {name} ---\n{value}\n")

        agent = Agent(
            get_openrouter_model(openrouter_key, model_id=get_platform_model("forge")),
            system_prompt=system,
        )
        result = await run_ai(
            agent, "\n".join(prompt_parts), "translation", output_type=TranslationResult,
        )
        return result.output.translations

    # ── DeepL backend ────────────────────────────────────────────────

    @staticmethod
    async def _translate_deepl(
        text: str,
        source_lang: str,
        target_lang: str,
        context: TranslationContext | None,
    ) -> str:
        """Single-text translation via DeepL API."""
        import deepl

        translator = deepl.Translator(settings.deepl_api_key)
        deepl_context = _build_deepl_context(context)
        result = translator.translate_text(
            text,
            source_lang=source_lang.upper(),
            target_lang=_deepl_target(target_lang),
            context=deepl_context,
        )
        return result.text

    @staticmethod
    async def _translate_fields_deepl(
        fields: dict[str, str],
        source_lang: str,
        target_lang: str,
        context: TranslationContext | None,
    ) -> dict[str, str]:
        """Batch field translation via DeepL (one call with multiple texts)."""
        import deepl

        translator = deepl.Translator(settings.deepl_api_key)
        deepl_context = _build_deepl_context(context)
        names = list(fields.keys())
        texts = list(fields.values())

        results = translator.translate_text(
            texts,
            source_lang=source_lang.upper(),
            target_lang=_deepl_target(target_lang),
            context=deepl_context,
        )
        return {name: r.text for name, r in zip(names, results, strict=False)}


def _deepl_target(lang: str) -> str:
    """Map generic language codes to DeepL target codes."""
    mapping = {"de": "DE", "en": "EN-US", "fr": "FR", "es": "ES"}
    return mapping.get(lang, lang.upper())


def _build_deepl_context(context: TranslationContext | None) -> str:
    """Build DeepL context string from TranslationContext."""
    if not context:
        return ""
    parts = [f"Simulation: {context.simulation_name} ({context.simulation_theme})."]
    parts.append(f"Entity type: {context.entity_type}.")
    if context.entity_name:
        parts.append(f"Entity: {context.entity_name}.")
    if context.additional_context:
        parts.append(context.additional_context)
    return " ".join(parts)


# ── Auto-translation helpers ─────────────────────────────────────────


def null_de_fields_for_update(table: str, update_data: dict) -> dict:
    """Return dict of _de fields to null when their EN source was changed.

    Call this BEFORE persisting the update so stale translations are cleared.
    """
    field_map = TRANSLATABLE_FIELDS.get(table, {})
    nulls: dict[str, None] = {}
    for en_field, de_field in field_map.items():
        if en_field in update_data:
            nulls[de_field] = None
    return nulls


async def _run_auto_translate(
    supabase: Client,
    table: str,
    entity_id: str,
    entity_data: dict,
    context: TranslationContext,
) -> None:
    """Translate fields and write _de columns back. Meant to run as background task."""
    field_map = TRANSLATABLE_FIELDS.get(table, {})
    if not field_map:
        return

    # Collect non-empty EN fields that need translation
    to_translate: dict[str, str] = {}
    for en_field, _de_field in field_map.items():
        value = entity_data.get(en_field)
        if value and isinstance(value, str) and value.strip():
            to_translate[en_field] = value

    if not to_translate:
        return

    try:
        translated = await TranslationService.translate_fields(
            to_translate, context=context
        )
    except (httpx.HTTPError, KeyError, TypeError, ValueError):
        logger.exception("Auto-translation failed", extra={"entity_type": table, "entity_id": entity_id})
        return

    # Map back to _de column names
    update_data: dict[str, str] = {}
    for en_field, translated_text in translated.items():
        de_field = field_map.get(en_field)
        if de_field and translated_text:
            update_data[de_field] = translated_text

    if not update_data:
        return

    try:
        await supabase.table(table).update(update_data).eq("id", entity_id).execute()
        logger.info(
            "Auto-translated fields",
            extra={"entity_type": table, "entity_id": entity_id, "entity_count": len(update_data)},
        )
    except (httpx.HTTPError, KeyError, TypeError, ValueError):
        logger.exception("Failed to persist auto-translation", extra={"entity_type": table, "entity_id": entity_id})


def schedule_auto_translation(
    supabase: Client,
    table: str,
    entity_id: UUID | str,
    entity_data: dict,
    simulation_name: str,
    simulation_theme: str,
    entity_type: str | None = None,
) -> None:
    """Fire-and-forget background translation for an entity.

    Safe to call from sync or async context — creates a background task.
    """
    context = TranslationContext(
        simulation_name=simulation_name,
        simulation_theme=simulation_theme,
        entity_type=entity_type or table,
        entity_name=entity_data.get("name"),
    )
    asyncio.create_task(
        _run_auto_translate(supabase, table, str(entity_id), entity_data, context),
    )
