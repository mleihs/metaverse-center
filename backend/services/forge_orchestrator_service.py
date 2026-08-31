"""Orchestrator service for Simulation Forge worldbuilding."""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from uuid import UUID

import httpx
import sentry_sdk
import structlog
from fastapi import HTTPException
from postgrest.exceptions import APIError as PostgrestAPIError
from pydantic_ai.exceptions import ModelAPIError, UnexpectedModelBehavior

from backend.config import settings
from backend.dependencies import get_admin_supabase
from backend.models.aptitude import OPERATIVE_TYPES
from backend.models.forge import (
    BUILDING_CONDITION_CORE,
    ForgeAgentDraft,
    ForgeBuildingDraft,
    ForgeDraftUpdate,
    ForgeGenerationConfig,
    ForgeGeographyDraft,
    PhilosophicalAnchor,
    counted_list,
)
from backend.services import forge_mock_service as mock
from backend.services.ai_utils import (
    MODEL_CALL_ERRORS,
    ai_error_to_http,
    create_forge_agent,
    report_delivery_count,
    run_ai,
    validate_bilingual_output,
)
from backend.services.aptitude_derivation import derive_aptitude_set
from backend.services.external.openrouter import OpenRouterError
from backend.services.external.replicate import ReplicateBillingError, ReplicateError
from backend.services.forge_ascii_art_service import ForgeAsciiArtService
from backend.services.forge_draft_service import ForgeDraftService
from backend.services.forge_entity_translation_service import ForgeEntityTranslationService
from backend.services.forge_feature_service import ForgeFeatureService
from backend.services.forge_image_service import ForgeImageService
from backend.services.forge_lore_service import ForgeLoreService
from backend.services.forge_map_service import ForgeMapService
from backend.services.forge_taxonomies import derive_taxonomies, normalize_entity_terms
from backend.services.forge_theme_service import ForgeThemeService
from backend.services.personality_extraction_service import PersonalityExtractionService
from backend.services.research_service import ResearchService
from backend.services.seo_service import notify_search_engines
from backend.utils.db import maybe_single_data
from backend.utils.errors import bad_gateway, bad_request, server_error
from backend.utils.responses import extract_list
from backend.utils.supabase_admin_cache import get_admin_supabase_client
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

#: How often one draft may re-read the Astrolabe. Each read is an AI call, and
#: the anchors are the cheapest thing in the Forge to be dissatisfied with —
#: three attempts get past an unlucky set without turning the phase into a slot
#: machine. Enforced server-side because a client-side counter resets on reload.
MAX_ANCHOR_SCANS = 3

# How many agents one purchased recruitment delivers. Stated once: it is
# interpolated into the recruitment prompt AND handed to the output type, so the
# number the user is promised cannot drift from the number that is validated.
_RECRUIT_COUNT = 3


WORLD_ARCHITECT_PROMPT = (
    "You are a Senior World Architect at the Bureau of Impossible Geography. "
    "Your task is to generate cohesive, high-quality entities for a simulation Shard "
    "based on its Philosophical Anchor and Seed. "
    "Maintain tonal consistency and literary depth. No generic fantasy/sci-fi. "
    "Field-length discipline: 'name', 'system', 'primary_profession', 'gender', and 'building_type' "
    "are SHORT identifiers (1-5 words each). Only 'character', 'background', and 'description' are "
    "long-form prose."
)

_SHORT_FIELD_LIMITS: dict[str, int] = {
    "system": 80,
    "name": 100,
    "gender": 30,
    "primary_profession": 100,
    "primary_profession_de": 100,
    "building_type": 100,
    "building_type_de": 100,
}


def _sanitize_short_fields(entity: dict, entity_type: str) -> None:
    """Truncate fields that should be short identifiers."""
    for field_name, limit in _SHORT_FIELD_LIMITS.items():
        value = entity.get(field_name, "")
        if len(value) > limit:
            truncated = value[:limit].rsplit(" ", 1)[0]
            logger.warning(
                "Truncated overlong field",
                extra={
                    "field": field_name,
                    "original_len": len(value),
                    "truncated_to": len(truncated),
                    "entity_type": entity_type,
                    "entity_name": entity.get("name", "?"),
                },
            )
            entity[field_name] = truncated


# ── Shared prompt blocks ─────────────────────────────────────────────────────
#
# `_build_chunk_prompt` and `_build_entity_prompt` are two paths to the same
# output — a batch of entities, or one entity at a time — and they had the prose
# requirements and the bilingual instruction written out twice. That is how a
# single-site edit silently reached only half the Forge: the copies looked
# identical, so a change to one read as a change to both. One definition now.

_AGENT_PROSE_REQUIREMENTS: tuple[str, ...] = (
    "- Write 'character' (200-300 words): temperament, how they work, what they avoid, how they "
    "treat the people above and below them, and a brief physical impression (build, distinguishing "
    "feature, typical clothing). The physical details will feed portrait image generation.",
    "- Write 'background' (200-300 words): origin, formative event, current motivation.",
)

_BUILDING_PROSE_REQUIREMENTS: tuple[str, ...] = (
    "- Write 'description' (150-250 words): architectural style, dominant materials (stone, iron, "
    "glass, wood), sensory details (sounds, smells, light), what the place is used for and what "
    "state it is in. These feed image generation.",
)

# The style floor. Last in the prompt, because position decides.
#
# Both builders used to ORDER, item by item, every formula that makes an
# LLM character read like every other LLM character: "vivid", "rich",
# "contradictions", "a memorable quirk", "a secret or unresolved tension". A
# production world returned exactly that — "Ihr groesster Widerspruch: …",
# "Ihre private Ketzerei: …", a stray lock of hair she never tucks back — and
# the reader called it "poetry by sixteen-year-olds". Every one of those was a
# line item in this file, not an invention of the model.
#
# Measured (deepseek-chat-v3-0324, T=0.8, 3 runs x 2 fields): the same floor
# placed only in the SYSTEM prompt left 0 of 6 closing sentences clean; placed
# at the END of the user prompt it left 4-5 of 6 clean. Negative style rules
# lose to a strong prior unless they come last — so this block goes last, and
# only the bilingual instruction, which is mechanical rather than stylistic,
# follows it.
_STYLE_FLOOR: tuple[str, ...] = (
    "",
    "STYLE (platform requirement, overrides anything above):",
    "- At most one simile or image per paragraph.",
    '- No formula that sums the subject up ("Their greatest contradiction:", "Their private heresy:").',
    "- No signature quirk invented to make the subject memorable.",
    "- The LAST sentence of each field is a fact, not an epigram and not a comparison.",
    "- Sentences may be long; they should just not all share one shape.",
    "- Ordinary registers are allowed: a clerk may be described in the language of clerks.",
)

_BILINGUAL_BLOCK: tuple[str, ...] = (
    "",
    "BILINGUAL OUTPUT: For every descriptive text field, also produce a German "
    "equivalent in the corresponding _de field (e.g. description → description_de, "
    "character → character_de). The German text should read as if originally written "
    "in German — not a literal translation. Keep ALL proper nouns (names, places) "
    "identical across both languages.",
)


def _build_chunk_prompt(
    chunk_type: str,
    anchor: dict,
    seed: str,
    gen_config: ForgeGenerationConfig,
    geography: dict | None = None,
) -> str:
    """Build a rich, chunk-type-specific prompt for entity generation."""
    # Common context block
    lines = [
        f"Seed Prompt: {seed}",
        f"Simulation Theme: {anchor.get('title', '')}",
        f"Core Question: {anchor.get('core_question', '')}",
        f"Description: {anchor.get('description', '')}",
    ]

    if chunk_type == "geography":
        lines += [
            "",
            f"Generate exactly {gen_config.zone_count} zones/districts and "
            f"exactly {gen_config.street_count} named streets for a unique city.",
            "",
            "Requirements:",
            "- Invent a distinctive city name that reflects the theme.",
            "- Each zone needs a 1-2 sentence description and 2-4 evocative characteristic tags.",
            "- Each street should belong to a zone and have a name that evokes atmosphere.",
            "- Vary zone types (residential, industrial, cultural, commercial, government, etc.).",
            "- Streets should have different types (alley, boulevard, lane, avenue, stairway, etc.).",
            "- The geography should feel interconnected — zones and streets should hint at relationships.",
        ]

    elif chunk_type == "agents":
        lines += [
            "",
            f"Generate exactly {gen_config.agent_count} unique agents who inhabit this world.",
        ]
        # Add geographic context if available
        if geography:
            city = geography.get("city_name", "the city")
            zone_names = [z.get("name", "") for z in geography.get("zones", [])]
            lines += [
                "",
                f"City: {city}",
                f"Districts: {', '.join(zone_names)}" if zone_names else "",
            ]
        lines += [
            "",
            "Requirements:",
            *_AGENT_PROSE_REQUIREMENTS,
            "- Vary genders across the set (mix of male, female, non-binary).",
            "- Each agent should belong to a different faction/system tied to the world's geography.",
            "- Professions should be unique and thematically resonant — avoid generic titles.",
        ]

    elif chunk_type == "buildings":
        lines += [
            "",
            f"Generate exactly {gen_config.building_count} unique buildings.",
        ]
        if geography:
            city = geography.get("city_name", "the city")
            zone_names = [z.get("name", "") for z in geography.get("zones", [])]
            lines += [
                "",
                f"City: {city}",
                f"Districts: {', '.join(zone_names)}" if zone_names else "",
            ]
        lines += [
            "",
            "Requirements:",
            *_BUILDING_PROSE_REQUIREMENTS,
            # Das Vokabular kommt aus BUILDING_CONDITION_CORE, nicht aus einem
            # zweiten Literal: hier stand `pristine`, im Schema des Modells stand
            # `excellent`, und beide gingen in DIESELBE Anfrage. Daher die sechs
            # `pristine`-Bauten, die keine Welt beschriften konnte.
            f"- Vary 'building_condition' across the set: use "
            f"{', '.join(BUILDING_CONDITION_CORE[:-1])}, or {BUILDING_CONDITION_CORE[-1]}. "
            f"At least one should be '{BUILDING_CONDITION_CORE[-2]}' or "
            f"'{BUILDING_CONDITION_CORE[-1]}', and at least one "
            f"'{BUILDING_CONDITION_CORE[0]}' or '{BUILDING_CONDITION_CORE[1]}'.",
            "- Vary building types (tavern, archive, factory, residence, market, observatory, etc.).",
            "- Building names should be evocative and world-specific.",
        ]

    # Always generate bilingually — the platform serves EN + DE.
    lines += [*_STYLE_FLOOR, *_BILINGUAL_BLOCK]

    return "\n".join(lines)


def _build_entity_prompt(
    entity_type: str,
    anchor: dict,
    seed: str,
    entity_index: int,
    entity_total: int,
    existing_entities: list[dict],
    geography: dict | None = None,
) -> str:
    """Build a prompt that generates exactly 1 entity, aware of siblings."""
    lines = [
        f"Seed Prompt: {seed}",
        f"Simulation Theme: {anchor.get('title', '')}",
        f"Core Question: {anchor.get('core_question', '')}",
        f"Description: {anchor.get('description', '')}",
    ]

    # Geography context
    if geography:
        city = geography.get("city_name", "the city")
        zone_names = [z.get("name", "") for z in geography.get("zones", [])]
        lines += ["", f"City: {city}"]
        if zone_names:
            lines.append(f"Districts: {', '.join(zone_names)}")

    # Existing siblings — prevent duplication
    if existing_entities:
        if entity_type == "agents":
            lines += [
                "",
                "Already recruited operatives (DO NOT duplicate names, professions, or personality archetypes):",
            ]
            for e in existing_entities:
                lines.append(f'- "{e.get("name")}" — {e.get("primary_profession", "?")} ({e.get("gender", "?")})')
        else:
            lines += [
                "",
                "Already designed structures (DO NOT duplicate names or building types):",
            ]
            for e in existing_entities:
                lines.append(f'- "{e.get("name")}" — {e.get("building_type", "?")}')

    # Entity-type-specific requirements
    if entity_type == "agents":
        lines += [
            "",
            f"Generate exactly 1 NEW agent distinct from those above. "
            f"This is operative {entity_index + 1} of {entity_total}.",
            "",
            "Requirements:",
            *_AGENT_PROSE_REQUIREMENTS,
            "- Vary gender from already-recruited operatives where possible.",
            "- 'system' is the agent's faction or organization — a SHORT name (1-5 words, max 80 chars). "
            "Examples: 'Gildenrat', 'Kanalgrund Widerstand', 'Observatorium'. "
            "Do NOT put descriptions, parenthetical explanations, or full sentences in this field.",
            "- Profession should be unique and thematically resonant — avoid generic titles.",
        ]
    else:
        lines += [
            "",
            f"Generate exactly 1 NEW building distinct from those above. "
            f"This is structure {entity_index + 1} of {entity_total}.",
            "",
            "Requirements:",
            *_BUILDING_PROSE_REQUIREMENTS,
            "- Vary 'building_condition' from already-designed structures.",
            "- Building type should differ from existing structures.",
            "- Building name should be evocative and world-specific.",
        ]

    # Bilingual block
    lines += [*_STYLE_FLOOR, *_BILINGUAL_BLOCK]

    return "\n".join(lines)


class ForgeOrchestratorService:
    """Orchestrates multi-step simulation generation."""

    # Map PostgreSQL RAISE EXCEPTION messages to semantic HTTP status codes.
    # Keys are substrings matched case-insensitively against the error message.
    _RPC_ERROR_MAP: list[tuple[str, int, str]] = [
        ("insufficient tokens", 402, "Insufficient Forge Tokens. Acquire more before igniting."),
        ("already processed", 409, "This draft has already been materialized."),
        ("in progress", 409, "Materialization is already in progress."),
        (
            "missing a selected philosophical anchor",
            400,
            "Draft is missing a philosophical anchor. Return to the Astrolabe.",
        ),
        (
            "missing geography",
            400,
            "Draft is missing geography data. Return to the Drafting Table.",
        ),
        (
            "must contain at least one agent",
            400,
            "Draft must contain at least one agent. Return to the Drafting Table.",
        ),
    ]

    @staticmethod
    def _classify_rpc_error(error_message: str) -> tuple[int, str]:
        """Parse a PostgreSQL RPC exception into an HTTP status code and user-facing message."""
        lower = error_message.lower()
        for pattern, code, detail in ForgeOrchestratorService._RPC_ERROR_MAP:
            if pattern in lower:
                return code, detail
        # Unrecognized RPC error — keep 500 but log for future classification
        logger.warning("Unclassified RPC error: %s", error_message[:200])
        return 500, "Shard materialization failed. Please contact support if the issue persists."

    @staticmethod
    async def _create_image_service(
        supabase: Client,
        simulation_id: UUID,
        sim_data: dict,
        anchor_data: dict | None = None,
        replicate_api_key: str | None = None,
        openrouter_api_key: str | None = None,
    ) -> ForgeImageService:
        """Build a ``ForgeImageService`` with world context from the simulation."""
        world_context = await ForgeOrchestratorService._build_world_context(
            supabase,
            simulation_id,
            sim_data,
            anchor_data,
        )
        return ForgeImageService(
            supabase,
            simulation_id,
            replicate_api_key=replicate_api_key,
            openrouter_api_key=openrouter_api_key,
            world_context=world_context,
        )

    @staticmethod
    async def get_forge_progress(supabase: Client, slug: str) -> dict | None:
        """Image-generation progress for the forge ceremony.

        Delegates to ``get_forge_progress(slug)`` Postgres function
        (migration 098) which counts completed images and returns
        per-entity image URLs in a single round-trip.

        Returns *None* when the slug does not match a simulation.
        """
        resp = await supabase.rpc("get_forge_progress", {"p_slug": slug}).execute()
        return resp.data

    @staticmethod
    async def run_astrolabe_research(
        supabase: Client,
        user_id: UUID,
        draft_id: UUID,
    ) -> dict:
        """Run AI research phase (Phase 1).

        Re-runnable up to :data:`MAX_ANCHOR_SCANS` times **per seed** so a
        worldbuilder can reject a set of anchors and ask for another. The count
        is kept on the draft and enforced here rather than in the client: the
        limit exists because each scan is an AI call, and a client-side counter
        resets on every page reload.

        The budget belongs to the seed, not to the draft. Rewriting the seed
        asks a different question, and the three readings that answered the old
        one say nothing about the new one — so an edited seed starts over. The
        seed that spent the budget is stored next to the count; anything else
        would make "change the seed and try again" advice the code does not
        honour.
        """
        logger.info("Starting Astrolabe research", extra={"user_id": str(user_id), "draft_id": str(draft_id)})
        draft_data = await ForgeDraftService.get_draft(supabase, user_id, draft_id)
        seed = draft_data["seed_prompt"]

        previous_anchor = draft_data.get("philosophical_anchor") or {}
        seed_changed = previous_anchor.get("seed") != seed
        scans_used = 0 if seed_changed else int(previous_anchor.get("scans", 0))
        if scans_used >= MAX_ANCHOR_SCANS:
            raise bad_request(
                f"The Astrolabe has already been read {MAX_ANCHOR_SCANS} times for this seed. "
                "Rewrite the seed to ask it something else."
            )

        if settings.forge_mock_mode:
            logger.debug("FORGE_MOCK_MODE: using mock research + anchors")
            context = mock.mock_research_context(seed)
            research_sources: list[dict[str, str]] = []
            anchors = [PhilosophicalAnchor(**a) for a in mock.mock_anchors(seed)]
        else:
            or_key, _ = await ForgeDraftService.get_user_keys(supabase, user_id)

            try:
                # 1. Scrape web context
                logger.debug("Scraping thematic context for seed: %s", seed[:50])
                research = await ResearchService.search_thematic_context(seed)
                context = research.context

                # 2. Generate 3 Philosophical Anchors
                logger.debug("Generating philosophical anchors...")
                anchors = await ResearchService.generate_anchors(seed, context, or_key)
                research_sources = research.sources
            except ModelAPIError as exc:
                raise ai_error_to_http(exc) from exc

        # 3. Update draft — track research source for frontend transparency
        research_source = "tavily" if settings.tavily_api_key else "emulator"
        logger.info(
            "Astrolabe research completed",
            extra={"draft_id": str(draft_id), "research_source": research_source, "anchor_count": len(anchors)},
        )
        await ForgeDraftService.update_draft(
            supabase,
            user_id,
            draft_id,
            ForgeDraftUpdate(
                # `sources` are the rows Tavily actually returned — title and
                # URL, deduplicated, no model in between. The card's footer
                # claims "research grounded in web sources"; until now nothing
                # behind that claim could be opened, and the citations the model
                # wrote from memory could not be reconciled with anything. See
                # finding 17. Empty on the emulator path, which `source` says.
                research_context={
                    "raw_data": context,
                    "source": research_source,
                    "sources": research_sources,
                },
                # `selected` is deliberately not carried over: a re-scan
                # replaces the three anchors, so a selection pointing at one of
                # the old ones would name something that no longer exists.
                philosophical_anchor={
                    "options": [a.model_dump() for a in anchors],
                    "scans": scans_used + 1,
                    # The seed this budget belongs to; a different one starts over.
                    "seed": seed,
                },
                status="draft",
            ),
        )

        return {"anchors": anchors}

    @staticmethod
    async def generate_blueprint_chunk(
        supabase: Client,
        user_id: UUID,
        draft_id: UUID,
        chunk_type: str,
    ) -> dict:
        """Generate a portion of the lore (Phase 2)."""
        logger.info(
            "Generating blueprint chunk",
            extra={"chunk_type": chunk_type, "user_id": str(user_id), "draft_id": str(draft_id)},
        )
        draft_data = await ForgeDraftService.get_draft(supabase, user_id, draft_id)
        anchor = draft_data.get("philosophical_anchor", {}).get("selected")
        if not anchor:
            raise bad_request("Must select a philosophical anchor first.")

        # Parse generation config with validated defaults
        raw_config = draft_data.get("generation_config") or {}
        gen_config = ForgeGenerationConfig(**raw_config)
        seed = draft_data.get("seed_prompt", "")

        if settings.forge_mock_mode:
            logger.debug("FORGE_MOCK_MODE: using mock data", extra={"chunk_type": chunk_type})
            if chunk_type == "geography":
                geo_data = mock.mock_geography(seed, gen_config.zone_count, gen_config.street_count)
                await ForgeDraftService.update_draft(supabase, user_id, draft_id, ForgeDraftUpdate(geography=geo_data))
                return geo_data
            elif chunk_type == "agents":
                agents_list = mock.mock_agents(seed, gen_config.agent_count)
                await ForgeDraftService.update_draft(supabase, user_id, draft_id, ForgeDraftUpdate(agents=agents_list))
                return {"agents": agents_list}
            elif chunk_type == "buildings":
                buildings_list = mock.mock_buildings(seed, gen_config.building_count)
                await ForgeDraftService.update_draft(
                    supabase, user_id, draft_id, ForgeDraftUpdate(buildings=buildings_list)
                )
                return {"buildings": buildings_list}
            else:
                raise bad_request(f"Invalid chunk type: {chunk_type}")

        or_key, _ = await ForgeDraftService.get_user_keys(supabase, user_id)

        # Build geography context for agent/building chunks
        geography = draft_data.get("geography") or None

        prompt = _build_chunk_prompt(chunk_type, anchor, seed, gen_config, geography)

        logger.debug("Instantiating dynamic Pydantic AI agent for chunk generation")
        dynamic_agent = create_forge_agent(WORLD_ARCHITECT_PROMPT, api_key=or_key, purpose="chunk")

        # Bureau Ops Deferral A.2 — user_id is in scope (draft-owned); no
        # `simulation_id` yet because the sim isn't materialized. Enforce
        # global + purpose + user budgets; per-sim kicks in post-materialization.
        admin_supabase = await get_admin_supabase()

        try:
            if chunk_type == "geography":
                result = await run_ai(
                    dynamic_agent,
                    prompt,
                    "chunk",
                    output_type=ForgeGeographyDraft,
                    admin_supabase=admin_supabase,
                    user_id=user_id,
                )
                geo_data = result.output.model_dump()
                if not geo_data.get("zones"):
                    raise bad_gateway("AI model returned no zones. Please try again.")
                # `zones` and `streets` sit INSIDE ForgeGeographyDraft, so their
                # counts cannot be carried by a per-call output type the way the
                # agent and building lists are. They are still compared against
                # what was ordered, so a short city is named rather than silent.
                report_delivery_count(
                    "zone", gen_config.zone_count, len(geo_data.get("zones", [])), draft_id=str(draft_id)
                )
                report_delivery_count(
                    "street", gen_config.street_count, len(geo_data.get("streets", [])), draft_id=str(draft_id)
                )
                validate_bilingual_output(
                    geo_data.get("zones", []),
                    ["zone_type_de", "description_de"],
                    "zone",
                )
                validate_bilingual_output(
                    geo_data.get("streets", []),
                    ["street_type_de"],
                    "street",
                )
                await ForgeDraftService.update_draft(supabase, user_id, draft_id, ForgeDraftUpdate(geography=geo_data))
                return geo_data

            elif chunk_type == "agents":
                result = await run_ai(
                    dynamic_agent,
                    prompt,
                    "chunk",
                    # The configured count is now the CEILING in the schema the
                    # model sees, not only a sentence in the prompt. The floor
                    # stays at one: the wizard can top a short roster up one
                    # entity at a time, so a short delivery is worth keeping and
                    # is reported rather than raised. The `if not agents_list`
                    # guard this replaces lived in the service; it belongs in the
                    # type. See finding 10.
                    output_type=counted_list(ForgeAgentDraft, gen_config.agent_count, minimum=1),
                    admin_supabase=admin_supabase,
                    user_id=user_id,
                )
                agents_list = [a.model_dump() for a in result.output]
                report_delivery_count("agent", gen_config.agent_count, len(agents_list), draft_id=str(draft_id))
                validate_bilingual_output(
                    agents_list,
                    ["character_de", "background_de", "primary_profession_de"],
                    "agent",
                )
                await ForgeDraftService.update_draft(supabase, user_id, draft_id, ForgeDraftUpdate(agents=agents_list))
                return {"agents": agents_list}

            elif chunk_type == "buildings":
                result = await run_ai(
                    dynamic_agent,
                    prompt,
                    "chunk",
                    output_type=counted_list(ForgeBuildingDraft, gen_config.building_count, minimum=1),
                    admin_supabase=admin_supabase,
                    user_id=user_id,
                )
                buildings_list = [b.model_dump() for b in result.output]
                report_delivery_count(
                    "building", gen_config.building_count, len(buildings_list), draft_id=str(draft_id)
                )
                validate_bilingual_output(
                    buildings_list,
                    ["description_de", "building_type_de", "building_condition_de"],
                    "building",
                )
                await ForgeDraftService.update_draft(
                    supabase, user_id, draft_id, ForgeDraftUpdate(buildings=buildings_list)
                )
                return {"buildings": buildings_list}

            else:
                raise bad_request(f"Invalid chunk type: {chunk_type}")
        except ModelAPIError as exc:
            raise ai_error_to_http(exc) from exc
        except UnexpectedModelBehavior as exc:
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("forge_phase", "blueprint_chunk")
                scope.set_context("forge", {"chunk_type": chunk_type, "draft_id": str(draft_id)})
                sentry_sdk.capture_exception(exc)
            logger.error(
                "LLM output validation failed after retries",
                extra={"chunk_type": chunk_type, "draft_id": str(draft_id)},
                exc_info=exc,
            )
            raise bad_gateway("AI model returned invalid output after retries. Please try again.") from exc

    @staticmethod
    async def generate_single_entity(
        supabase: Client,
        user_id: UUID,
        draft_id: UUID,
        entity_type: str,
        entity_index: int,
        entity_total: int,
    ) -> dict:
        """Generate a single agent or building and append to draft."""

        draft_data = await ForgeDraftService.get_draft(supabase, user_id, draft_id)
        anchor = draft_data.get("philosophical_anchor", {}).get("selected")
        if not anchor:
            raise bad_request("Must select a philosophical anchor first.")
        seed = draft_data.get("seed_prompt", "")
        geography = draft_data.get("geography") or None
        existing_entities = draft_data.get(entity_type, [])

        if settings.forge_mock_mode:
            await asyncio.sleep(1.5)
            if entity_type == "agents":
                entity = mock.mock_single_agent(seed, entity_index, entity_total)
            else:
                entity = mock.mock_single_building(seed, entity_index, entity_total)
        else:
            or_key, _ = await ForgeDraftService.get_user_keys(supabase, user_id)

            prompt = _build_entity_prompt(
                entity_type,
                anchor,
                seed,
                entity_index,
                entity_total,
                existing_entities,
                geography,
            )
            dynamic_agent = create_forge_agent(WORLD_ARCHITECT_PROMPT, api_key=or_key, purpose="entity")

            # Bureau Ops Deferral A.2 — user_id in scope; pre-materialization
            # so no simulation_id. Enforce global + purpose + user budgets.
            admin_supabase = await get_admin_supabase()

            try:
                if entity_type == "agents":
                    result = await run_ai(
                        dynamic_agent,
                        prompt,
                        "entity",
                        output_type=ForgeAgentDraft,
                        admin_supabase=admin_supabase,
                        user_id=user_id,
                    )
                else:
                    result = await run_ai(
                        dynamic_agent,
                        prompt,
                        "entity",
                        output_type=ForgeBuildingDraft,
                        admin_supabase=admin_supabase,
                        user_id=user_id,
                    )
                entity = result.output.model_dump()
            except ModelAPIError as exc:
                raise ai_error_to_http(exc) from exc
            except UnexpectedModelBehavior as exc:
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("forge_phase", "entity_generation")
                    scope.set_context(
                        "forge",
                        {
                            "entity_type": entity_type,
                            "draft_id": str(draft_id),
                            "entity_index": entity_index,
                        },
                    )
                    sentry_sdk.capture_exception(exc)
                logger.error(
                    "LLM entity output validation failed",
                    extra={"entity_type": entity_type, "draft_id": str(draft_id), "index": entity_index},
                    exc_info=exc,
                )
                raise bad_gateway("AI model returned invalid output after retries. Please try again.") from exc

            # Validate bilingual output
            de_fields = (
                ["character_de", "background_de", "primary_profession_de"]
                if entity_type == "agents"
                else ["description_de", "building_type_de", "building_condition_de"]
            )
            validate_bilingual_output([entity], de_fields, entity_type.rstrip("s"))

            # Truncate any overlong short fields
            _sanitize_short_fields(entity, entity_type)

        # Duplicate name check
        existing_names = {e.get("name", "").lower() for e in existing_entities}
        if entity.get("name", "").lower() in existing_names:
            entity["name"] = f"{entity['name']} ({entity_index + 1})"

        # Persist to draft
        await ForgeDraftService.append_entity(
            supabase,
            user_id,
            draft_id,
            entity_type,
            entity,
        )
        return entity

    @staticmethod
    async def _seed_agent_aptitudes(supabase: Client, simulation_id: str) -> None:
        """Give every agent of a freshly materialized world its six aptitudes.

        Derived from the agent's own disposition — see
        `backend/services/aptitude_derivation.py` for where the signal comes
        from and why the budget is spent the way it is.

        MEASURED CAVEAT, and the reason this logs rather than staying quiet: on
        production all 258 `agents.personality_profile` values are `{}`, because
        `PersonalityExtractionService` has no caller anywhere in the backend.
        With an empty disposition the derivation returns an even generalist —
        correct, but indistinguishable from the state it was meant to replace.
        The count below is what makes that visible instead of silent; a world
        whose agents all come out generalist is a world whose personalities were
        never extracted, not a world whose agents happen to be balanced.
        """
        agents_resp = await (
            supabase.table("agents")
            .select("id, personality_profile")
            .eq("simulation_id", str(simulation_id))
            .is_("deleted_at", "null")
            .execute()
        )
        agents = agents_resp.data or []
        if not agents:
            return

        rows: list[dict] = []
        generalists = 0
        for agent in agents:
            personality = agent.get("personality_profile") or {}
            if not personality:
                generalists += 1
            aptitudes = derive_aptitude_set(personality)
            rows.extend(
                {
                    "agent_id": agent["id"],
                    "simulation_id": str(simulation_id),
                    "operative_type": operative,
                    "aptitude_level": getattr(aptitudes, operative),
                }
                for operative in OPERATIVE_TYPES
            )

        await supabase.table("agent_aptitudes").upsert(rows, on_conflict="agent_id,operative_type").execute()
        logger.info(
            "Seeded agent aptitudes",
            extra={
                "simulation_id": str(simulation_id),
                "agents": len(agents),
                "rows": len(rows),
                "without_personality": generalists,
            },
        )

    @staticmethod
    async def materialize_shard(
        supabase: Client,
        user_id: UUID,
        draft_id: UUID,
        admin_supabase: Client | None = None,
    ) -> dict:
        """Finalize the draft and create production records (Phase 4).

        Calls Postgres ``fn_materialize_shard`` RPC (migration 056, updated 058).
        """
        logger.info("Materializing shard", extra={"user_id": str(user_id), "draft_id": str(draft_id)})

        # ── The world's own vocabularies, derived from what it generated ──
        #
        # `fn_materialize_shard` step 8 has always inserted one `simulation_taxonomies`
        # row per value in `forge_drafts.taxonomies`. Nothing ever wrote that column:
        # measured on production 2026-08-30, all 26 drafts carry `{}`, so the RPC
        # looped zero times and every Forge world was created with no vocabulary at
        # all — which is why 115 of 314 buildings hold a condition their own
        # simulation does not define, and why `fair` came back in nine different
        # German words. Deriving here rather than at chunk time is deliberate: a
        # roster can still be edited, topped up or regenerated in the Table, and this
        # is the last moment at which the draft is final. See finding 30.
        draft = await ForgeDraftService.get_draft(supabase, user_id, draft_id)
        taxonomies = derive_taxonomies(draft)
        if taxonomies:
            normalized = normalize_entity_terms(draft, taxonomies)
            geography = dict(draft.get("geography") or {})
            if "zones" in normalized:
                geography["zones"] = normalized["zones"]
            await ForgeDraftService.update_draft(
                supabase,
                user_id,
                draft_id,
                ForgeDraftUpdate(
                    taxonomies=taxonomies,
                    agents=normalized.get("agents"),
                    buildings=normalized.get("buildings"),
                    geography=geography if "zones" in normalized else None,
                ),
            )
            logger.info(
                "Derived world vocabularies from draft entities",
                extra={
                    "draft_id": str(draft_id),
                    "taxonomies": {key: len(values) for key, values in taxonomies.items()},
                },
            )

        # Mark draft as processing
        await ForgeDraftService.update_draft(
            supabase,
            user_id,
            draft_id,
            ForgeDraftUpdate(status="processing"),
        )

        try:
            try:
                # SECDEF privileged write: service_role only (ADR-006 / migration 258).
                admin = await get_admin_supabase_client()
                response = await admin.rpc("fn_materialize_shard", {"p_draft_id": str(draft_id)}).execute()
            except (PostgrestAPIError, httpx.HTTPError) as rpc_err:
                # Parse PostgreSQL RAISE EXCEPTION into semantic HTTP codes
                err_msg = str(rpc_err)
                status_code, detail = ForgeOrchestratorService._classify_rpc_error(err_msg)
                await ForgeDraftService.update_draft(
                    supabase,
                    user_id,
                    draft_id,
                    ForgeDraftUpdate(status="failed", error_log=err_msg[:500]),
                )
                raise HTTPException(status_code=status_code, detail=detail) from rpc_err

            if not response.data:
                await ForgeDraftService.update_draft(
                    supabase,
                    user_id,
                    draft_id,
                    ForgeDraftUpdate(status="failed", error_log="Materialization returned no data."),
                )
                raise server_error("Materialization failed in database.")

            sim_id = response.data

            # Resolve slug + name for frontend navigation and ceremony
            # `name_de` rides along with `name`: the ceremony renders under the
            # viewer's locale, and until migration 287 there was nothing German
            # to render — the column was empty on all 41 worlds. Selecting it
            # here is what lets the ignition screen say the world's German name
            # instead of its English one. See finding 16.
            slug_resp = await (
                supabase.table("simulations")
                .select("slug, name, name_de, description, description_de")
                .eq("id", str(sim_id))
                .single()
                .execute()
            )
            row = slug_resp.data or {}
            slug = row.get("slug")
            sim_name = row.get("name", "") or ""
            sim_name_de = row.get("name_de", "") or ""
            sim_description = row.get("description", "") or ""
            sim_description_de = row.get("description_de", "") or ""

            # Fetch draft for theme_config and lore context
            draft_data = await ForgeDraftService.get_draft(supabase, user_id, draft_id)

            # Use admin client for service-role writes (lore + theme settings)
            write_client = admin_supabase or supabase

            # Personality first, aptitudes second — the aptitudes are DERIVED
            # from the personality, and until now the Forge produced neither.
            # `PersonalityExtractionService` had no caller anywhere in the
            # backend, so all 258 production agents carry `{}` and, through
            # `_derive_autonomy_params`, one identical set of autonomy values
            # (Befund N1). One model call per agent, gated by the existing
            # `personality_extraction` budget and falling back to a neutral
            # profile when there is no key — the world is never lost over it.
            try:
                await PersonalityExtractionService.initialize_simulation_agents(write_client, sim_id)
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("forge_phase", "materialize")
                    scope.set_tag("step", "agent_personality")
                    scope.set_context("forge", {"simulation_id": str(sim_id)})
                    sentry_sdk.capture_exception()
                logger.exception("Personality extraction failed", extra={"simulation_id": str(sim_id)})

            # Aptitudes for the world's new agents (Befund D15). The Forge never
            # wrote `agent_aptitudes`, so every agent it made stood flat on the
            # generalist baseline of 6 — and since the highest `min_aptitude` in
            # the ability content is 5, an agent with no assignment unlocked
            # every ability. Party composition was not a decision in 30 of 36
            # worlds. Best-effort: a materialized world must not be lost because
            # the aptitudes failed.
            try:
                await ForgeOrchestratorService._seed_agent_aptitudes(write_client, sim_id)
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("forge_phase", "materialize")
                    scope.set_tag("step", "agent_aptitudes")
                    scope.set_context("forge", {"simulation_id": str(sim_id)})
                    sentry_sdk.capture_exception()
                logger.exception("Aptitude seeding failed", extra={"simulation_id": str(sim_id)})

            # Apply theme settings (generated in Darkroom phase)
            theme_config = draft_data.get("theme_config") or {}
            if theme_config:
                try:
                    await ForgeThemeService.apply_theme_settings(write_client, sim_id, theme_config)
                except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                    with sentry_sdk.push_scope() as scope:
                        scope.set_tag("forge_phase", "materialize")
                        scope.set_context("forge", {"simulation_id": str(sim_id)})
                        sentry_sdk.capture_exception()
                    logger.exception("Theme application failed", extra={"simulation_id": str(sim_id)})

            # Notify search engines (fire-and-forget, best-effort)
            if slug:
                asyncio.create_task(notify_search_engines(slug))

            # Pass draft_data through for background lore generation
            anchor = draft_data.get("philosophical_anchor", {}).get("selected", {})
            seed = draft_data.get("seed_prompt", "")

            return {
                "simulation_id": sim_id,
                "slug": slug,
                "name": sim_name,
                "name_de": sim_name_de,
                "description": sim_description,
                "description_de": sim_description_de,
                "anchor": anchor,
                "seed_prompt": seed,
                "draft_data": draft_data,
            }
        except HTTPException:
            raise
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as e:
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("forge_phase", "materialize")
                scope.set_context("forge", {"draft_id": str(draft_id)})
                sentry_sdk.capture_exception(e)
            logger.exception("Shard materialization failed", extra={"draft_id": str(draft_id)})
            await ForgeDraftService.update_draft(
                supabase,
                user_id,
                draft_id,
                ForgeDraftUpdate(status="failed", error_log=str(e)[:500]),
            )
            raise server_error("Shard materialization failed. Please contact support if the issue persists.") from e

    @classmethod
    async def generate_theme_for_draft(
        cls,
        supabase: Client,
        user_id: UUID,
        draft_id: UUID,
    ) -> dict:
        """Generate an AI theme for a draft (called from Darkroom phase)."""
        logger.info("Generating theme", extra={"draft_id": str(draft_id)})
        draft_data = await ForgeDraftService.get_draft(supabase, user_id, draft_id)
        seed = draft_data.get("seed_prompt", "")

        if settings.forge_mock_mode:
            logger.debug("FORGE_MOCK_MODE: using mock theme")
            theme_data = mock.mock_theme(seed)
        else:
            anchor = draft_data.get("philosophical_anchor", {}).get("selected", {})
            geography = draft_data.get("geography", {})
            agents = draft_data.get("agents", [])
            buildings = draft_data.get("buildings", [])
            or_key, _ = await ForgeDraftService.get_user_keys(supabase, user_id)

            try:
                theme_data = await ForgeThemeService.generate_theme(
                    seed=seed,
                    anchor=anchor,
                    geography=geography,
                    agents=agents,
                    buildings=buildings,
                    openrouter_key=or_key,
                )
            except ModelAPIError as exc:
                raise ai_error_to_http(exc) from exc
            except (
                PostgrestAPIError,
                httpx.HTTPError,
                UnexpectedModelBehavior,
                KeyError,
                TypeError,
                ValueError,
            ) as exc:
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("forge_phase", "theme_generation")
                    scope.set_context("forge", {"draft_id": str(draft_id)})
                    sentry_sdk.capture_exception(exc)
                logger.exception(
                    "Theme generation failed",
                    extra={"draft_id": str(draft_id)},
                )
                raise bad_gateway("Theme generation failed. Please try again.") from exc

        # Store in draft
        await ForgeDraftService.update_draft(
            supabase,
            user_id,
            draft_id,
            ForgeDraftUpdate(theme_config=theme_data),
        )

        return theme_data

    # ── One image, with the retry the user asked for ─────────────────
    #
    # The four image loops below (banner, agent, building, lore) carried four
    # byte-similar try/except blocks that counted a failure, wrote it to Sentry,
    # and moved on. Measured on production: one building lost its image to
    # `OpenRouterError: Empty content in response` — the TEXT model writing the
    # image description returned nothing — and stayed image-less for good while
    # the task logged success and the ceremony sat at 15/16 forever, because
    # `get_forge_progress` computes `done` as `completed >= total` and 15 is not
    # 16. Explicit instruction from the project owner: "there must be hardening
    # that asks again. This MUST run through." (finding 8)
    #
    # WHAT IS RETRIED, AND WHAT IS NOT. A retry re-runs the whole chain:
    # description (text model) -> Replicate (paid) -> upload -> DB write. So the
    # split is not "transient vs. permanent" but "can a second attempt cost a
    # second image":
    #
    #   retried      OpenRouterError, ModelAPIError, UnexpectedModelBehavior --
    #                the description step, which runs BEFORE any Replicate call,
    #                and is the failure that was actually measured.
    #                ReplicateError -- the generation call itself failed, and a
    #                failed generation is not billed as a delivered one.
    #                httpx.HTTPError -- a network fault, usually the reference-
    #                image download, which is also before the paid call.
    #
    #   not retried  KeyError, TypeError, ValueError -- programmer errors; a
    #                second attempt fails identically and costs a second image.
    #                OSError -- encoding/upload, i.e. AFTER the paid call.
    #                ReplicateBillingError -- re-raised, aborts everything;
    #                retrying with no credit only burns money.
    _IMAGE_RETRY_BACKOFFS = (3, 8)  # seconds; the batch already runs ~15 min
    _IMAGE_RETRYABLE = (OpenRouterError, ModelAPIError, UnexpectedModelBehavior, ReplicateError, httpx.HTTPError)
    _IMAGE_FATAL = (KeyError, TypeError, ValueError, OSError)

    @classmethod
    async def _generate_one_image(
        cls,
        generate: Callable[[], Awaitable[object]],
        *,
        entity_type: str,
        entity_name: str,
        entity_id: str | None,
        simulation_id: UUID,
        failures: list[dict[str, str]],
    ) -> bool:
        """Run one image generation, retrying what is safe to retry.

        Returns True on success. On final failure the entity is appended to
        ``failures`` so the caller can put it in front of the user instead of
        only in Sentry. ``ReplicateBillingError`` is re-raised untouched.
        """
        attempts = len(cls._IMAGE_RETRY_BACKOFFS) + 1
        for attempt, backoff in enumerate((0, *cls._IMAGE_RETRY_BACKOFFS), start=1):
            if backoff:
                await asyncio.sleep(backoff)
            try:
                await generate()
                if attempt > 1:
                    logger.info(
                        "Image generation recovered on retry",
                        extra={"entity_type": entity_type, "entity_name": entity_name, "attempt": attempt},
                    )
                return True
            except ReplicateBillingError:
                raise
            except cls._IMAGE_RETRYABLE as exc:
                last = exc
                logger.warning(
                    "Image generation failed (attempt %d/%d), retrying",
                    attempt,
                    attempts,
                    extra={"entity_type": entity_type, "entity_name": entity_name, "entity_id": entity_id},
                )
                sentry_sdk.add_breadcrumb(
                    category="forge",
                    message=f"image retry {attempt}/{attempts} for {entity_type} {entity_name}",
                    level="warning",
                )
            except cls._IMAGE_FATAL as exc:
                last = exc
                break  # a second attempt fails identically and costs a second image

        failures.append(
            {
                "entity_type": entity_type,
                "entity_name": entity_name,
                "entity_id": entity_id or "",
                "error": f"{type(last).__name__}: {last}"[:200],
            }
        )
        logger.exception(
            "Image generation failed after %d attempt(s)",
            attempts,
            extra={"entity_type": entity_type, "entity_name": entity_name, "entity_id": entity_id},
            exc_info=last,
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("forge_phase", "batch_images")
            scope.set_tag("entity_type", entity_type)
            scope.set_context(
                "image_generation",
                {
                    "simulation_id": str(simulation_id),
                    "entity_id": entity_id,
                    "entity_name": entity_name,
                    "attempts": attempts,
                },
            )
            sentry_sdk.capture_exception(last)
        return False

    @staticmethod
    async def _update_lore_progress(
        supabase: Client,
        simulation_id: UUID,
        progress: dict | None,
    ) -> None:
        """Write lore-generation progress to simulations.lore_progress."""
        await (
            supabase.table("simulations")
            .update(
                {"lore_progress": progress},
            )
            .eq("id", str(simulation_id))
            .execute()
        )

    @classmethod
    async def _generate_lore_and_translations(
        cls,
        supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
        or_key: str | None,
        draft_data: dict,
    ) -> None:
        """Generate lore, lore translations, and entity translations.

        Runs in the background task to avoid Cloudflare timeout (~100s).
        """
        anchor = draft_data.get("philosophical_anchor", {}).get("selected", {})
        geography = draft_data.get("geography", {})
        agents = draft_data.get("agents", [])
        buildings = draft_data.get("buildings", [])
        seed = draft_data.get("seed_prompt", "")

        if settings.forge_mock_mode:
            logger.debug("FORGE_MOCK_MODE: using mock lore + translations")
            try:
                lore_sections = mock.mock_lore_sections(seed)
                translations = mock.mock_lore_translations(lore_sections)
                await ForgeLoreService.persist_lore(
                    supabase,
                    simulation_id,
                    lore_sections,
                    translations,
                )
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError):
                logger.exception("Mock lore persist failed", extra={"simulation_id": str(simulation_id)})

            try:
                mat_agents_resp = await (
                    supabase.table("agents")
                    .select("name, character, background, primary_profession")
                    .eq("simulation_id", str(simulation_id))
                    .execute()
                )
                mat_agents = extract_list(mat_agents_resp)
                mat_buildings_resp = await (
                    supabase.table("buildings")
                    .select("name, description, building_type, building_condition")
                    .eq("simulation_id", str(simulation_id))
                    .execute()
                )
                mat_buildings = extract_list(mat_buildings_resp)
                mat_zones_resp = await (
                    supabase.table("zones")
                    .select("name, description, zone_type")
                    .eq("simulation_id", str(simulation_id))
                    .execute()
                )
                mat_zones = extract_list(mat_zones_resp)
                mat_streets_resp = await (
                    supabase.table("city_streets")
                    .select("name, street_type")
                    .eq("simulation_id", str(simulation_id))
                    .execute()
                )
                mat_streets = extract_list(mat_streets_resp)
                sim_desc = geography.get("description", "") or seed
                mock_sim_row = await maybe_single_data(
                    supabase.table("simulations").select("name").eq("id", str(simulation_id)).maybe_single()
                )
                mock_trans = mock.mock_entity_translations(
                    mat_agents,
                    mat_buildings,
                    mat_zones,
                    mat_streets,
                    (mock_sim_row or {}).get("name", "") or "",
                    sim_desc,
                )
                await ForgeEntityTranslationService.persist_translations(supabase, simulation_id, mock_trans)
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError):
                logger.exception("Mock entity translation failed", extra={"simulation_id": str(simulation_id)})
            return

        # Extract Astrolabe research from draft
        astrolabe_ctx = ""
        raw_research = draft_data.get("research_context") or {}
        if isinstance(raw_research, dict):
            astrolabe_ctx = raw_research.get("raw_data", "")

        # Deep research: dedicated LLM call (cheap model) for
        # literary/philosophical/architectural grounding.
        raw_config = draft_data.get("generation_config") or {}
        gen_config = ForgeGenerationConfig(**raw_config)

        research_context = astrolabe_ctx
        logger.info(
            "Generation config",
            extra={"deep_research": gen_config.deep_research, "simulation_id": str(simulation_id)},
        )
        if gen_config.deep_research:
            logger.info("Step: deep research")
            await cls._update_lore_progress(supabase, simulation_id, {"phase": "research"})
            try:
                research_context = await ResearchService.research_for_lore(
                    seed=seed,
                    anchor=anchor,
                    astrolabe_context=astrolabe_ctx,
                    openrouter_key=or_key,
                )
            except (*MODEL_CALL_ERRORS, httpx.HTTPError, KeyError, TypeError, ValueError):
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("forge_phase", "deep_research")
                    scope.set_context("forge", {"simulation_id": str(simulation_id), "seed": seed[:80]})
                    sentry_sdk.capture_exception()
                logger.exception(
                    "Deep research failed — using Astrolabe context only",
                    extra={"simulation_id": str(simulation_id)},
                )

        logger.info("Step: lore generation")
        await cls._update_lore_progress(supabase, simulation_id, {"phase": "generating"})
        try:
            lore_sections = await ForgeLoreService.generate_lore(
                seed=seed,
                anchor=anchor,
                geography=geography,
                agents=agents,
                buildings=buildings,
                openrouter_key=or_key,
                research_context=research_context,
            )
            logger.info("Step: lore translation")
            section_count = len(lore_sections)

            async def on_section_start(index: int, title: str) -> None:
                await cls._update_lore_progress(
                    supabase,
                    simulation_id,
                    {
                        "phase": "translating",
                        "current": index,
                        "total": section_count,
                        "section_title": title,
                    },
                )

            await cls._update_lore_progress(
                supabase,
                simulation_id,
                {
                    "phase": "translating",
                    "current": 0,
                    "total": section_count,
                    "section_title": "",
                },
            )
            translations = None
            try:
                translations = await ForgeLoreService.translate_lore(
                    lore_sections,
                    openrouter_key=or_key,
                    on_section_start=on_section_start,
                )
            except (*MODEL_CALL_ERRORS, httpx.HTTPError, KeyError, TypeError, ValueError):
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("forge_phase", "lore_translation")
                    scope.set_context("forge", {"simulation_id": str(simulation_id)})
                    sentry_sdk.capture_exception()
                logger.exception("Lore translation failed", extra={"simulation_id": str(simulation_id)})

            await ForgeLoreService.persist_lore(
                supabase,
                simulation_id,
                lore_sections,
                translations,
            )
        except (
            *MODEL_CALL_ERRORS,
            PostgrestAPIError,
            httpx.HTTPError,
            OpenRouterError,
            KeyError,
            TypeError,
            ValueError,
        ):
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("forge_phase", "lore_generation")
                scope.set_context("forge", {"simulation_id": str(simulation_id), "seed": seed[:80]})
                sentry_sdk.capture_exception()
            logger.exception("Lore generation failed", extra={"simulation_id": str(simulation_id)})

        # Translate entity fields (skip if bilingual generation already populated _de)
        logger.info("Step: entity translation")
        await cls._update_lore_progress(supabase, simulation_id, {"phase": "entities"})
        try:
            mat_agents_resp = await (
                supabase.table("agents")
                .select("name, character, background, primary_profession, character_de")
                .eq("simulation_id", str(simulation_id))
                .execute()
            )
            mat_agents = extract_list(mat_agents_resp)

            agents_have_de = all(a.get("character_de") for a in mat_agents)
            if agents_have_de:
                logger.info(
                    "Bilingual draft — skipping entity translation",
                    extra={"simulation_id": str(simulation_id)},
                )
            else:
                mat_buildings_resp = await (
                    supabase.table("buildings")
                    .select("name, description, building_type, building_condition")
                    .eq("simulation_id", str(simulation_id))
                    .execute()
                )
                mat_buildings = extract_list(mat_buildings_resp)
                mat_zones_resp = await (
                    supabase.table("zones")
                    .select("name, description, zone_type")
                    .eq("simulation_id", str(simulation_id))
                    .execute()
                )
                mat_zones = extract_list(mat_zones_resp)
                mat_streets_resp = await (
                    supabase.table("city_streets")
                    .select("name, street_type")
                    .eq("simulation_id", str(simulation_id))
                    .execute()
                )
                mat_streets = extract_list(mat_streets_resp)
                sim_desc = geography.get("description", "") or seed

                # Den Titel aus der ZEILE lesen, nicht aus dem Entwurf: die
                # Materialisierung hängt bei Namenskollisionen ein „ (2)" an,
                # und übersetzt werden soll der Name, der nachher dasteht.
                sim_row = await maybe_single_data(
                    supabase.table("simulations").select("name").eq("id", str(simulation_id)).maybe_single()
                )
                sim_name = (sim_row or {}).get("name", "") or ""

                entity_translations = await ForgeEntityTranslationService.translate_entities(
                    agents=mat_agents,
                    buildings=mat_buildings,
                    zones=mat_zones,
                    streets=mat_streets,
                    simulation_name=sim_name,
                    simulation_description=sim_desc,
                    openrouter_key=or_key,
                )
                await ForgeEntityTranslationService.persist_translations(
                    supabase,
                    simulation_id,
                    entity_translations,
                )
        except (
            *MODEL_CALL_ERRORS,
            PostgrestAPIError,
            httpx.HTTPError,
            KeyError,
            TypeError,
            ValueError,
        ):
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("forge_phase", "entity_translation")
                scope.set_context("forge", {"simulation_id": str(simulation_id)})
                sentry_sdk.capture_exception()
            logger.exception("Entity translation failed", extra={"simulation_id": str(simulation_id)})

        # Signal transition to image generation phase
        await cls._update_lore_progress(supabase, simulation_id, {"phase": "images"})

    @staticmethod
    async def count_missing_images(supabase: Client, simulation_id: UUID) -> int:
        """How many images the world is still missing.

        The same four columns ``get_forge_progress`` counts and ``only_missing``
        filters on, so the number the ceremony shows, the number this reports and
        the set the repair run regenerates cannot drift apart.
        """
        agents = await (
            supabase.table("agents")
            .select("id", count="exact")
            .eq("simulation_id", str(simulation_id))
            .is_("portrait_image_url", "null")
            .execute()
        )
        buildings = await (
            supabase.table("buildings")
            .select("id", count="exact")
            .eq("simulation_id", str(simulation_id))
            .is_("image_url", "null")
            .execute()
        )
        lore = await (
            supabase.table("simulation_lore")
            .select("id", count="exact")
            .eq("simulation_id", str(simulation_id))
            .not_.is_("image_slug", "null")
            .is_("image_generated_at", "null")
            .execute()
        )
        sim = await maybe_single_data(
            supabase.table("simulations").select("banner_url").eq("id", str(simulation_id)).maybe_single()
        )
        banner_missing = 0 if (sim or {}).get("banner_url") else 1
        return banner_missing + (agents.count or 0) + (buildings.count or 0) + (lore.count or 0)

    @classmethod
    async def run_batch_generation(
        cls,
        supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
        anchor_data: dict | None = None,
        draft_data: dict | None = None,
        entity_types: set[str] | None = None,
        only_missing: bool = False,
    ) -> None:
        """Background task: lore generation → image generation.

        Runs research + lore + translations first (needed for world_context),
        then sequential image generation (banner → portraits → buildings → lore).
        Optimized for 512MB RAM: processes one image at a time.

        If entity_types is provided, only regenerate those types
        (e.g. {"lore"}, {"agent", "building"}).

        With ``only_missing`` the run skips every entity that already has an
        image. That is what the repair action needs: after a partial run the user
        is missing one image out of sixteen, and re-generating the other fifteen
        would cost fifteen images to fix one. It is also why the filter belongs
        here rather than in the caller — the same column that decides it,
        ``portrait_image_url`` / ``image_url`` / ``banner_url`` /
        ``image_generated_at``, is the one ``get_forge_progress`` already counts.
        """
        batch_id = f"batch-{simulation_id!s:.8}"
        structlog.contextvars.bind_contextvars(
            simulation_id=str(simulation_id),
            batch_id=batch_id,
        )
        logger.info("Batch generation starting", extra={"batch_id": batch_id})
        t_batch = time.monotonic()

        try:
            or_key, rep_key = await ForgeDraftService.get_user_keys(supabase, user_id)
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError, OSError):
            logger.exception("Failed to fetch BYOK keys — using platform keys")
            or_key, rep_key = None, None

        # ── Phase A: Lore + translations (must complete before images) ──
        # Skip when called for image-only regeneration (no draft_data available).
        phase_a_s = 0.0
        if draft_data:
            logger.info("Phase A: lore + translations")
            t_a = time.monotonic()
            await cls._generate_lore_and_translations(
                supabase,
                simulation_id,
                user_id,
                or_key,
                draft_data,
            )
            phase_a_s = time.monotonic() - t_a
            logger.info("Phase A complete", extra={"elapsed_s": round(phase_a_s, 1)})
        else:
            logger.info("Phase A skipped (image-only regeneration)")

        # ── Phase A.5: Refine image style prompts using lore context ──
        if draft_data:
            try:
                await ForgeThemeService.refine_style_prompts(
                    supabase,
                    simulation_id,
                    or_key,
                )
            except (*MODEL_CALL_ERRORS, httpx.HTTPError, KeyError, TypeError, ValueError):
                logger.warning(
                    "Style prompt refinement failed — using original prompts",
                    exc_info=True,
                )

        # ── Phase A.6: Generate world-specific prompt templates ──
        if draft_data:
            try:
                await ForgeThemeService.generate_simulation_templates(
                    supabase,
                    simulation_id,
                    or_key,
                )
            except (*MODEL_CALL_ERRORS, httpx.HTTPError, KeyError, TypeError, ValueError):
                logger.warning(
                    "Prompt template generation failed — using platform defaults",
                    exc_info=True,
                )

        # ── Phase A.7: World map generation ──
        # Builds zone polygons + street network + building positions via shapely
        # (Python) and persists atomically via fn_apply_map_geometry (SQL).
        # Failure does NOT fail ignition — the simulation comes online without a
        # map; admins recover via POST /api/v1/admin/simulations/{id}/map/regenerate.
        # See docs/plans/per-simulation-world-map-plan.md.
        if draft_data:
            draft_id_raw = draft_data.get("id")
            map_draft_id: UUID | None = None
            if draft_id_raw:
                try:
                    map_draft_id = UUID(str(draft_id_raw))
                except (ValueError, TypeError):
                    map_draft_id = None

            # Pre-call: mark draft as generating (Python-side single-row write).
            # Wrapped because the draft may already be advanced past this state in
            # rare retry/regen flows; we don't want a stale UPDATE to abort ignition.
            if map_draft_id is not None:
                try:
                    await (
                        supabase.table("forge_drafts")
                        .update({"map_status": "generating"})
                        .eq("id", str(map_draft_id))
                        .execute()
                    )
                except (PostgrestAPIError, httpx.HTTPError) as exc:
                    logger.warning(
                        "Failed to mark forge_drafts.map_status='generating' (continuing)",
                        extra={"draft_id": str(map_draft_id), "error": str(exc)},
                    )

            try:
                map_result = await ForgeMapService.generate_map(
                    simulation_id,
                    forge_draft_id=map_draft_id,
                )
                logger.info(
                    "World map generated",
                    extra={
                        "simulation_id": str(simulation_id),
                        "preset": map_result.preset_used,
                        "geometry_version": map_result.geometry_version,
                        "zones": map_result.zones_updated,
                        "streets": map_result.streets_inserted,
                        "buildings": map_result.buildings_updated,
                        "lives_at": map_result.lives_at_inserted,
                        "duration_s": map_result.duration_seconds,
                    },
                )
            except Exception as exc:  # noqa: BLE001 — map errors must not fail ignition
                # Mark draft as failed (Python-side; the SQL function never ran,
                # so its 'succeeded' transition did not occur).
                if map_draft_id is not None:
                    try:
                        await (
                            supabase.table("forge_drafts")
                            .update({"map_status": "failed"})
                            .eq("id", str(map_draft_id))
                            .execute()
                        )
                    except (PostgrestAPIError, httpx.HTTPError):
                        logger.exception(
                            "Failed to mark forge_drafts.map_status='failed' after map error",
                            extra={"draft_id": str(map_draft_id)},
                        )

                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("simulation_id", str(simulation_id))
                    scope.set_tag("phase", "A.7_world_map")
                    if map_draft_id:
                        scope.set_tag("forge_draft_id", str(map_draft_id))
                    sentry_sdk.capture_exception(exc)

                logger.warning(
                    "World map generation failed — simulation will come online without a map "
                    "(admin can regenerate via /api/v1/admin/simulations/{id}/map/regenerate)",
                    extra={"simulation_id": str(simulation_id), "error": str(exc)},
                    exc_info=True,
                )

        # ── Phase B: Image generation ──
        logger.info("Phase B: image generation")
        t_b = time.monotonic()

        sim_resp = await (
            supabase.table("simulations")
            .select("name, description, slug")
            .eq("id", str(simulation_id))
            .single()
            .execute()
        )
        sim_data = sim_resp.data or {}

        image_service = await cls._create_image_service(
            supabase,
            simulation_id,
            sim_data,
            anchor_data,
            replicate_api_key=rep_key,
            openrouter_api_key=or_key,
        )

        _types = entity_types  # None = all types
        images_succeeded = 0
        images_failed = 0
        img_counter = 0
        # What went wrong, per entity, so the ceremony can name it. Until now the
        # only record of a failed image was a Sentry event: the user saw a bar
        # stuck at 15/16 with no explanation and nothing to press. See finding 8.
        image_failures: list[dict[str, str]] = []

        # Count total images for progress tracking
        # `only_missing` narrows every query below by the same column the
        # progress function counts, so what the ceremony calls missing and what
        # this run regenerates are one definition, not two.
        img_total_parts: list[int] = []
        skip_banner = only_missing and bool(sim_data.get("banner_url"))
        if (not _types or "banner" in _types) and not skip_banner:
            img_total_parts.append(1)
        if not _types or "agent" in _types:
            agent_count_query = (
                supabase.table("agents")
                .select("id", count="exact")
                .eq(
                    "simulation_id",
                    str(simulation_id),
                )
            )
            if only_missing:
                agent_count_query = agent_count_query.is_("portrait_image_url", "null")
            agent_count_resp = await agent_count_query.execute()
            img_total_parts.append(agent_count_resp.count or 0)
        if not _types or "building" in _types:
            bldg_count_query = (
                supabase.table("buildings")
                .select("id", count="exact")
                .eq(
                    "simulation_id",
                    str(simulation_id),
                )
            )
            if only_missing:
                bldg_count_query = bldg_count_query.is_("image_url", "null")
            bldg_count_resp = await bldg_count_query.execute()
            img_total_parts.append(bldg_count_resp.count or 0)
        if not _types or "lore" in _types:
            lore_count_query = (
                supabase.table("simulation_lore")
                .select("id", count="exact")
                .eq(
                    "simulation_id",
                    str(simulation_id),
                )
                .not_.is_("image_slug", "null")
            )
            if only_missing:
                lore_count_query = lore_count_query.is_("image_generated_at", "null")
            lore_count_resp = await lore_count_query.execute()
            img_total_parts.append(lore_count_resp.count or 0)
        img_total = sum(img_total_parts)

        try:
            if (not _types or "banner" in _types) and not skip_banner:
                img_counter += 1
                logger.info(
                    "Generating image",
                    extra={"entity_type": "banner", "progress": f"{img_counter}/{img_total}"},
                )
                if await cls._generate_one_image(
                    lambda: image_service.generate_banner_image(
                        sim_name=sim_data.get("name", "Unknown"),
                        sim_description=sim_data.get("description", ""),
                        anchor_data=anchor_data,
                    ),
                    entity_type="banner",
                    entity_name=sim_data.get("name", "Unknown"),
                    entity_id=None,
                    simulation_id=simulation_id,
                    failures=image_failures,
                ):
                    images_succeeded += 1
                else:
                    images_failed += 1

                # ── Generate terminal boot art from the banner image ──
                try:
                    # Find the banner URL from storage
                    banner_resp = await supabase.storage.from_(
                        "simulation.banners",
                    ).list(str(simulation_id))
                    banner_url = None
                    if banner_resp:
                        # Pick the most recent banner file
                        files = sorted(banner_resp, key=lambda f: f.get("created_at", ""), reverse=True)
                        if files:
                            banner_url = (
                                f"{supabase.supabase_url}/storage/v1/object/public/"
                                f"simulation.banners/{simulation_id}/{files[0]['name']}"
                            )

                    sim_name = sim_data.get("name", "Unknown")
                    boot_art = await ForgeAsciiArtService.generate_boot_art(
                        simulation_name=sim_name,
                        banner_url=banner_url,
                    )
                    await (
                        supabase.table("simulation_settings")
                        .upsert(
                            [
                                {
                                    "simulation_id": str(simulation_id),
                                    "setting_key": "terminal_boot_art",
                                    "setting_value": boot_art,
                                    "category": "design",
                                }
                            ],
                            on_conflict="simulation_id,category,setting_key",
                        )
                        .execute()
                    )
                    logger.info(
                        "Terminal boot art generated (%d chars, banner=%s)",
                        len(boot_art),
                        "yes" if banner_url else "figlet-only",
                    )
                except (
                    httpx.HTTPError,
                    ReplicateError,
                    OpenRouterError,
                    ImportError,
                    KeyError,
                    TypeError,
                    ValueError,
                    OSError,
                ):
                    logger.warning("Terminal boot art generation failed", exc_info=True)

            # 2. Agent portraits
            if not _types or "agent" in _types:
                agents_query = (
                    supabase.table("agents")
                    .select("id, name, character, background")
                    .eq("simulation_id", str(simulation_id))
                )
                if only_missing:
                    agents_query = agents_query.is_("portrait_image_url", "null")
                agents = await agents_query.execute()
                for agent_row in extract_list(agents):
                    img_counter += 1
                    logger.info(
                        "Generating image",
                        extra={
                            "entity_type": "agent",
                            "progress": f"{img_counter}/{img_total}",
                            "entity_name": agent_row["name"],
                        },
                    )
                    if await cls._generate_one_image(
                        # `row=agent_row` binds the current row: a bare closure
                        # over the loop variable would generate the last agent
                        # every time the retry fires.
                        lambda row=agent_row: image_service.generate_agent_portrait(
                            agent_id=row["id"],
                            agent_name=row["name"],
                            agent_data={"character": row["character"], "background": row["background"]},
                        ),
                        entity_type="agent",
                        entity_name=agent_row["name"],
                        entity_id=str(agent_row["id"]),
                        simulation_id=simulation_id,
                        failures=image_failures,
                    ):
                        images_succeeded += 1
                    else:
                        images_failed += 1

            # 3. Building images
            if not _types or "building" in _types:
                buildings_query = (
                    supabase.table("buildings")
                    .select(
                        "id, name, description, building_type, building_condition,"
                        " style, special_type, construction_year,"
                        " population_capacity, zones(name)"
                    )
                    .eq("simulation_id", str(simulation_id))
                )
                if only_missing:
                    buildings_query = buildings_query.is_("image_url", "null")
                buildings = await buildings_query.execute()
                for building in extract_list(buildings):
                    img_counter += 1
                    logger.info(
                        "Generating image",
                        extra={
                            "entity_type": "building",
                            "progress": f"{img_counter}/{img_total}",
                            "entity_name": building["name"],
                        },
                    )
                    zone_data = building.get("zones") or {}
                    if await cls._generate_one_image(
                        lambda row=building, zone=zone_data: image_service.generate_building_image(
                            building_id=row["id"],
                            building_name=row["name"],
                            building_type=row["building_type"],
                            building_data={
                                "description": row.get("description", ""),
                                "building_condition": row.get("building_condition", ""),
                                "building_style": row.get("style", ""),
                                "special_type": row.get("special_type", ""),
                                "construction_year": row.get("construction_year", ""),
                                "population_capacity": row.get("population_capacity", ""),
                                "zone_name": zone.get("name", ""),
                            },
                        ),
                        entity_type="building",
                        entity_name=building["name"],
                        entity_id=str(building["id"]),
                        simulation_id=simulation_id,
                        failures=image_failures,
                    ):
                        images_succeeded += 1
                    else:
                        images_failed += 1

            # 4. Lore images (sections with image_slug)
            if not _types or "lore" in _types:
                sim_slug = sim_data.get("slug", str(simulation_id))
                lore_query = (
                    supabase.table("simulation_lore")
                    .select("id, title, body, image_slug, image_caption")
                    .eq("simulation_id", str(simulation_id))
                    .not_.is_("image_slug", "null")
                    .order("sort_order")
                )
                if only_missing:
                    lore_query = lore_query.is_("image_generated_at", "null")
                lore_sections = await lore_query.execute()
                for section in extract_list(lore_sections):
                    img_counter += 1
                    logger.info(
                        "Generating image",
                        extra={
                            "entity_type": "lore",
                            "progress": f"{img_counter}/{img_total}",
                            "entity_name": section["title"],
                        },
                    )
                    if await cls._generate_one_image(
                        lambda row=section: image_service.generate_lore_image(
                            section_title=row["title"],
                            section_body=row["body"],
                            image_slug=row["image_slug"],
                            sim_slug=sim_slug,
                            section_id=row["id"],
                            image_caption=row.get("image_caption"),
                        ),
                        entity_type="lore",
                        entity_name=section["title"],
                        entity_id=str(section["id"]),
                        simulation_id=simulation_id,
                        failures=image_failures,
                    ):
                        images_succeeded += 1
                    else:
                        images_failed += 1

        except ReplicateBillingError:
            logger.error(
                "Replicate billing error — aborting all image generation. "
                "Check credits at replicate.com/account/billing."
            )
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("forge_phase", "batch_images")
                scope.set_context(
                    "forge",
                    {
                        "simulation_id": str(simulation_id),
                        "images_succeeded": images_succeeded,
                        "images_failed": images_failed,
                    },
                )
                sentry_sdk.capture_exception()

        phase_b_s = time.monotonic() - t_b
        total_elapsed_s = time.monotonic() - t_batch

        # Report image failures to Sentry so we know immediately
        if images_failed > 0:
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("forge_phase", "batch_images")
                scope.set_context(
                    "forge",
                    {
                        "simulation_id": str(simulation_id),
                        "images_succeeded": images_succeeded,
                        "images_failed": images_failed,
                        "img_total": img_total,
                    },
                )
                sentry_sdk.capture_message(
                    f"Batch image gen: {images_failed}/{img_total} failed ({images_succeeded} succeeded)",
                    level="error" if images_succeeded == 0 else "warning",
                )

        # Hand the outcome to the ceremony. Clearing `lore_progress` was right
        # only when everything succeeded: `get_forge_progress` computes `done` as
        # `completed >= total`, so after a partial run the bar sits at 15/16
        # forever with nothing said and nothing to press. When images are missing
        # the field now carries WHICH ones, so the surface can name them and
        # offer the repair run. See finding 8.
        await cls._update_lore_progress(
            supabase,
            simulation_id,
            {
                "phase": "images_incomplete",
                "failed": images_failed,
                "total": img_total,
                "entities": image_failures[:20],
            }
            if image_failures
            else None,
        )

        logger.info(
            "Batch generation DONE",
            extra={
                "total_elapsed_s": round(total_elapsed_s, 1),
                "phase_a_s": round(phase_a_s, 1),
                "phase_b_s": round(phase_b_s, 1),
                "images_succeeded": images_succeeded,
                "images_failed": images_failed,
            },
        )

    @staticmethod
    async def recruit_agents(
        admin_supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
        purchase_id: str,
        focus: str | None = None,
        zone_id: UUID | None = None,
        openrouter_key: str | None = None,
        replicate_key: str | None = None,
    ) -> None:
        """Generate 3 new agents for an existing simulation (background task).

        Uses the existing ``generate_blueprint_chunk("agents")`` pattern but
        with additional context from the live simulation data and a recruitment
        prompt that requires arrival narratives and relationships.
        """
        structlog.contextvars.bind_contextvars(simulation_id=str(simulation_id))
        try:
            # 1. Fetch simulation data
            sim_resp = (
                await admin_supabase.table("simulations")
                .select("name, description")
                .eq("id", str(simulation_id))
                .single()
                .execute()
            )
            sim = sim_resp.data

            agents_resp = (
                await admin_supabase.table("agents")
                .select("name, primary_profession, character")
                .eq("simulation_id", str(simulation_id))
                .execute()
            )
            existing_agents = extract_list(agents_resp)

            zones_resp = (
                await admin_supabase.table("zones")
                .select("id, name, zone_type, description")
                .eq("simulation_id", str(simulation_id))
                .execute()
            )
            zones = extract_list(zones_resp)

            # 2. Build recruitment prompt
            agent_list = "\n".join(
                f"  - {a['name']} ({a['primary_profession']}): {a.get('character', '')[:100]}..."
                for a in existing_agents[:10]
            )
            zone_context = "\n".join(
                f"  - {z['name']} ({z['zone_type']}): {z.get('description', '')[:80]}" for z in zones
            )

            prompt = f"""You are a Bureau Recruitment Officer processing new arrivals for {sim["name"]}.

WORLD DESCRIPTION: {sim.get("description", "")}

EXISTING AGENTS ({len(existing_agents)} total):
{agent_list}

ZONES:
{zone_context}

{"RECRUITMENT FOCUS: " + focus if focus else ""}
{"TARGET ZONE: " + next((z["name"] for z in zones if z["id"] == str(zone_id)), "any") if zone_id else ""}

Generate exactly {_RECRUIT_COUNT} new agents. Requirements:
- Each agent MUST have an ARRIVAL NARRATIVE woven into their background (how/why they arrived)
- Each agent MUST have 1-2 relationships with EXISTING agents (mention by name)
- Varied genders, professions, and temperaments
- Characters that create interesting tensions or complement the existing roster
- 200-300 words for character, 200-300 words for background
"""

            if settings.forge_mock_mode:
                logger.debug("FORGE_MOCK_MODE: using mock recruits")
                generated = [
                    ForgeAgentDraft(**r)
                    for r in mock.mock_recruits(
                        sim["name"],
                        [a["name"] for a in existing_agents],
                        focus,
                    )
                ]
            else:
                agent = create_forge_agent(WORLD_ARCHITECT_PROMPT, api_key=openrouter_key, purpose="chunk")
                # Bureau Ops Deferral A.2 — full 4-axis enforcement.
                # admin_supabase, simulation_id, and user_id are all on this
                # method's signature (background task from a feature purchase).
                result = await run_ai(
                    agent,
                    prompt,
                    "chunk",
                    output_type=counted_list(ForgeAgentDraft, _RECRUIT_COUNT, minimum=1),
                    admin_supabase=admin_supabase,
                    simulation_id=simulation_id,
                    user_id=user_id,
                )
                generated = result.output
                report_delivery_count(
                    "recruit",
                    _RECRUIT_COUNT,
                    len(generated),
                    simulation_id=str(simulation_id),
                    purchase_id=purchase_id,
                )

            # 3. Insert agents into the simulation (batch insert — single round-trip)
            agent_rows = [
                {
                    "simulation_id": str(simulation_id),
                    "name": agent_draft.name,
                    "gender": agent_draft.gender,
                    "system": agent_draft.system,
                    "primary_profession": agent_draft.primary_profession,
                    "character": agent_draft.character,
                    "background": agent_draft.background,
                }
                for agent_draft in generated
            ]
            await admin_supabase.table("agents").insert(agent_rows).execute()

            # 4. Generate portraits
            try:
                sim_data = {"name": sim["name"], "description": sim.get("description", "")}
                image_service = await ForgeOrchestratorService._create_image_service(
                    admin_supabase,
                    simulation_id,
                    sim_data,
                    replicate_api_key=replicate_key,
                    openrouter_api_key=openrouter_key,
                )

                for agent_draft in generated:
                    agent_in_db = await maybe_single_data(
                        admin_supabase.table("agents")
                        .select("id")
                        .eq("simulation_id", str(simulation_id))
                        .eq("name", agent_draft.name)
                        .maybe_single()
                    )

                    if agent_in_db:
                        await image_service.generate_agent_portrait(
                            agent_id=agent_in_db["id"],
                            agent_name=agent_draft.name,
                            agent_data={
                                "character": agent_draft.character,
                                "background": agent_draft.background,
                            },
                        )
            except (httpx.HTTPError, ReplicateError, KeyError, TypeError, ValueError, OSError):
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("forge_phase", "recruit_portraits")
                    scope.set_context("forge", {"simulation_id": str(simulation_id), "agent_count": len(generated)})
                    sentry_sdk.capture_exception()
                logger.exception("Portrait generation failed for recruits")

            # 5. Translate
            try:
                agent_rows = (
                    await admin_supabase.table("agents")
                    .select("id, name, primary_profession, character, background")
                    .eq("simulation_id", str(simulation_id))
                    .in_("name", [a.name for a in generated])
                    .execute()
                )

                if agent_rows.data:
                    translations = await ForgeEntityTranslationService.translate_entities(
                        agents=agent_rows.data,
                        buildings=[],
                        zones=[],
                        streets=[],
                        simulation_description=sim.get("description", ""),
                        openrouter_key=openrouter_key,
                    )
                    await ForgeEntityTranslationService.persist_translations(
                        admin_supabase,
                        simulation_id,
                        translations,
                    )
            except (*MODEL_CALL_ERRORS, httpx.HTTPError, KeyError, TypeError, ValueError):
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("forge_phase", "recruit_translation")
                    scope.set_context("forge", {"simulation_id": str(simulation_id), "agent_count": len(generated)})
                    sentry_sdk.capture_exception()
                logger.exception("Translation failed for recruits")

            # 6. Complete feature purchase
            await ForgeFeatureService.complete_feature(
                admin_supabase,
                purchase_id,
                result={
                    "agents": [a.name for a in generated],
                    "count": len(generated),
                },
            )
            logger.info(
                "Recruitment completed",
                extra={"agents": len(generated)},
            )

        except (
            *MODEL_CALL_ERRORS,
            PostgrestAPIError,
            httpx.HTTPError,
            KeyError,
            TypeError,
            ValueError,
        ) as exc:
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("forge_phase", "recruitment")
                scope.set_context("forge", {"simulation_id": str(simulation_id), "purchase_id": purchase_id})
                sentry_sdk.capture_exception(exc)
            logger.exception("Recruitment failed")
            await ForgeFeatureService.fail_feature(
                admin_supabase,
                purchase_id,
                str(exc),
            )

    @staticmethod
    async def regenerate_single_image(
        admin_supabase: Client,
        simulation_id: UUID,
        entity_type: str,
        entity_id: UUID,
        prompt_override: str | None = None,
        user_id: UUID | None = None,
    ) -> None:
        """Regenerate a single entity image (Darkroom feature)."""
        structlog.contextvars.bind_contextvars(
            simulation_id=str(simulation_id),
            entity_type=entity_type,
            entity_id=str(entity_id),
        )
        try:
            # Fetch entity data for image description
            table_map = {"agent": "agents", "building": "buildings", "lore": "simulation_lore"}
            table = table_map.get(entity_type)
            if not table:
                logger.error("Invalid entity_type for regen: %s", entity_type)
                return

            select = "*, zones(name)" if entity_type == "building" else "*"
            entity_resp = await admin_supabase.table(table).select(select).eq("id", str(entity_id)).single().execute()
            entity = entity_resp.data

            # Fetch simulation data + BYOK keys
            sim_resp = (
                await admin_supabase.table("simulations")
                .select("name, description, slug")
                .eq("id", str(simulation_id))
                .single()
                .execute()
            )
            sim_data = sim_resp.data or {}

            or_key = None
            rep_key = None
            if user_id:
                or_key, rep_key = await ForgeDraftService.get_user_keys(
                    admin_supabase,
                    user_id,
                )

            image_service = await ForgeOrchestratorService._create_image_service(
                admin_supabase,
                simulation_id,
                sim_data,
                replicate_api_key=rep_key,
                openrouter_api_key=or_key,
            )

            if entity_type == "agent":
                await image_service.generate_agent_portrait(
                    agent_id=entity_id,
                    agent_name=entity["name"],
                    agent_data={
                        "character": entity.get("character", ""),
                        "background": entity.get("background", ""),
                    },
                    description_override=prompt_override,
                )
            elif entity_type == "building":
                zone_data = entity.get("zones") or {}
                await image_service.generate_building_image(
                    building_id=entity_id,
                    building_name=entity["name"],
                    building_type=entity.get("building_type", ""),
                    building_data={
                        "description": entity.get("description", ""),
                        "building_condition": entity.get("building_condition", ""),
                        "building_style": entity.get("style", ""),
                        "special_type": entity.get("special_type", ""),
                        "construction_year": entity.get("construction_year", ""),
                        "population_capacity": entity.get("population_capacity", ""),
                        "zone_name": zone_data.get("name", ""),
                    },
                    description_override=prompt_override,
                )
            elif entity_type == "lore":
                sim_slug = sim_data.get("slug", str(simulation_id))
                await image_service.generate_lore_image(
                    section_title=entity.get("title", ""),
                    section_body=entity.get("body", ""),
                    image_slug=entity.get("image_slug", str(entity_id)),
                    sim_slug=sim_slug,
                    section_id=str(entity_id),
                    image_caption=entity.get("image_caption"),
                )

            logger.info("Darkroom regen completed")
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError, OSError):
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("forge_phase", "darkroom_regen")
                scope.set_context(
                    "forge",
                    {
                        "simulation_id": str(simulation_id),
                        "entity_type": entity_type,
                        "entity_id": str(entity_id),
                    },
                )
                sentry_sdk.capture_exception()
            logger.exception("Darkroom regen failed")

    @staticmethod
    async def reconstruct_draft_data(
        supabase: Client,
        simulation_id: UUID,
    ) -> dict:
        """Reconstruct the draft_data dict from materialized tables.

        Used by the admin retrigger endpoint to re-run lore + translations
        for a simulation that has already been materialized.
        """
        sim_resp = (
            await supabase.table("simulations")
            .select("name, description")
            .eq("id", str(simulation_id))
            .single()
            .execute()
        )
        sim = sim_resp.data

        agents_resp = (
            await supabase.table("agents")
            .select("name, gender, system, primary_profession, character, background")
            .eq("simulation_id", str(simulation_id))
            .execute()
        )

        buildings_resp = (
            await supabase.table("buildings")
            .select("name, building_type, building_condition, description, style")
            .eq("simulation_id", str(simulation_id))
            .execute()
        )

        zones_resp = (
            await supabase.table("zones")
            .select("name, zone_type, description")
            .eq("simulation_id", str(simulation_id))
            .execute()
        )

        streets_resp = (
            await supabase.table("city_streets")
            .select("name, street_type")
            .eq("simulation_id", str(simulation_id))
            .execute()
        )

        # Reconstruct geography block
        geography = {
            "city_name": sim.get("name", "Unknown"),
            "description": sim.get("description", ""),
            "zones": extract_list(zones_resp),
            "streets": extract_list(streets_resp),
        }

        # Try to fetch the original anchor from simulation_settings
        anchor_data = await maybe_single_data(
            supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(simulation_id))
            .eq("setting_key", "philosophical_anchor")
            .maybe_single()
        )

        anchor = {}
        if anchor_data:
            import json

            try:
                anchor = (
                    json.loads(anchor_data["setting_value"])
                    if isinstance(
                        anchor_data["setting_value"],
                        str,
                    )
                    else anchor_data["setting_value"]
                )
            except (json.JSONDecodeError, TypeError):
                pass

        return {
            "seed_prompt": sim.get("description", ""),
            "philosophical_anchor": {"selected": anchor},
            "geography": geography,
            "agents": extract_list(agents_resp),
            "buildings": extract_list(buildings_resp),
            "generation_config": {"deep_research": True},
        }

    @staticmethod
    async def delete_simulation_lore(supabase: Client, simulation_id: UUID) -> None:
        """Delete all lore entries for a simulation.

        Used before re-generating lore to avoid duplicates.
        """
        await (
            supabase.table("simulation_lore")
            .delete()
            .eq(
                "simulation_id",
                str(simulation_id),
            )
            .execute()
        )

    @staticmethod
    async def _build_world_context(
        supabase: Client,
        simulation_id: UUID,
        sim_data: dict,
        anchor_data: dict | None,
    ) -> str:
        """Build a world context brief from persisted lore + anchor.

        This brief feeds into ALL image description generators so that
        portraits, buildings, banners, and lore images share a coherent
        visual identity derived from the lore research.
        """
        anchor = anchor_data or {}
        sim_name = sim_data.get("name", "Unknown")

        # Fetch the first 2 lore sections (gateway + second section)
        lore_resp = await (
            supabase.table("simulation_lore")
            .select("title, body")
            .eq("simulation_id", str(simulation_id))
            .order("sort_order")
            .limit(2)
            .execute()
        )
        lore_sections = extract_list(lore_resp)

        # Compose the world brief
        parts = [f"WORLD: {sim_name}"]

        if anchor.get("title"):
            parts.append(
                f"PHILOSOPHICAL ANCHOR: {anchor['title']}\n"
                f"  Core Question: {anchor.get('core_question', '')}\n"
                f"  Literary Influence: {anchor.get('literary_influence', '')}"
            )

        if sim_data.get("description"):
            parts.append(f"DESCRIPTION: {sim_data['description']}")

        for section in lore_sections:
            body = section.get("body", "")
            # First ~600 chars of each section — enough for visual identity
            parts.append(f"LORE — {section.get('title', '')}:\n{body[:600]}")

        context = "\n\n".join(parts)
        logger.debug(
            "World context built",
            extra={"simulation_id": str(simulation_id), "context_length": len(context)},
        )
        return context
