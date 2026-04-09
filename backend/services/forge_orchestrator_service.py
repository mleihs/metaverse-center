"""Orchestrator service for Simulation Forge worldbuilding."""

from __future__ import annotations

import asyncio
import logging
import time
from uuid import UUID

import httpx
import sentry_sdk
import structlog
from fastapi import HTTPException, status
from postgrest.exceptions import APIError as PostgrestAPIError
from pydantic_ai.exceptions import ModelHTTPError, UnexpectedModelBehavior

from backend.config import settings
from backend.models.forge import (
    ForgeAgentDraft,
    ForgeBuildingDraft,
    ForgeDraftUpdate,
    ForgeGenerationConfig,
    ForgeGeographyDraft,
    PhilosophicalAnchor,
)
from backend.services import forge_mock_service as mock
from backend.services.ai_utils import ai_error_to_http, create_forge_agent, run_ai, validate_bilingual_output
from backend.services.external.replicate import ReplicateBillingError, ReplicateError
from backend.services.forge_draft_service import ForgeDraftService
from backend.services.forge_entity_translation_service import ForgeEntityTranslationService
from backend.services.forge_image_service import ForgeImageService
from backend.services.forge_lore_service import ForgeLoreService
from backend.services.forge_theme_service import ForgeThemeService
from backend.services.research_service import ResearchService
from backend.services.seo_service import notify_search_engines
from backend.utils.errors import bad_request, server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


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
            "- Write 'character' as a vivid personality portrait (200-300 words): temperament, mannerisms, "
            "contradictions, a memorable quirk, and a brief physical impression (build, distinguishing "
            "feature, typical clothing). The physical details will feed portrait image generation.",
            "- Write 'background' as rich backstory (200-300 words): origin, formative event, "
            "current motivation, and a secret or unresolved tension.",
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
            "- Write 'description' as an atmospheric passage (150-250 words): architectural style, "
            "dominant materials (stone, iron, glass, wood), sensory details (sounds, smells, light), "
            "and what makes the place remarkable or unsettling. These feed image generation.",
            "- Vary 'building_condition' across the set: use pristine, good, fair, poor, or ruined. "
            "At least one should be 'poor' or 'ruined', and at least one 'pristine' or 'good'.",
            "- Vary building types (tavern, archive, factory, residence, market, observatory, etc.).",
            "- Building names should be evocative and world-specific.",
        ]

    # Always generate bilingually — the platform serves EN + DE.
    lines += [
        "",
        "BILINGUAL OUTPUT: For every descriptive text field, also produce a German "
        "equivalent in the corresponding _de field (e.g. description → description_de, "
        "character → character_de). The German text should read as if originally written "
        "in German — not a literal translation. Keep ALL proper nouns (names, places) "
        "identical across both languages.",
    ]

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
            "- Write 'character' as a vivid personality portrait (200-300 words): temperament, mannerisms, "
            "contradictions, a memorable quirk, and a brief physical impression (build, distinguishing "
            "feature, typical clothing). The physical details will feed portrait image generation.",
            "- Write 'background' as rich backstory (200-300 words): origin, formative event, "
            "current motivation, and a secret or unresolved tension.",
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
            "- Write 'description' as an atmospheric passage (150-250 words): architectural style, "
            "dominant materials (stone, iron, glass, wood), sensory details (sounds, smells, light), "
            "and what makes the place remarkable or unsettling. These feed image generation.",
            "- Vary 'building_condition' from already-designed structures.",
            "- Building type should differ from existing structures.",
            "- Building name should be evocative and world-specific.",
        ]

    # Bilingual block
    lines += [
        "",
        "BILINGUAL OUTPUT: For every descriptive text field, also produce a German "
        "equivalent in the corresponding _de field (e.g. description → description_de, "
        "character → character_de). The German text should read as if originally written "
        "in German — not a literal translation. Keep ALL proper nouns (names, places) "
        "identical across both languages.",
    ]

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
        """Run AI research phase (Phase 1)."""
        logger.info("Starting Astrolabe research", extra={"user_id": str(user_id), "draft_id": str(draft_id)})
        draft_data = await ForgeDraftService.get_draft(supabase, user_id, draft_id)
        seed = draft_data["seed_prompt"]

        if settings.forge_mock_mode:
            logger.debug("FORGE_MOCK_MODE: using mock research + anchors")
            context = mock.mock_research_context(seed)
            anchors = [PhilosophicalAnchor(**a) for a in mock.mock_anchors(seed)]
        else:
            or_key, _ = await ForgeDraftService.get_user_keys(supabase, user_id)

            try:
                # 1. Scrape web context
                logger.debug("Scraping thematic context for seed: %s", seed[:50])
                context = await ResearchService.search_thematic_context(seed)

                # 2. Generate 3 Philosophical Anchors
                logger.debug("Generating philosophical anchors...")
                anchors = await ResearchService.generate_anchors(seed, context, or_key)
            except ModelHTTPError as exc:
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
                research_context={"raw_data": context, "source": research_source},
                philosophical_anchor={"options": [a.model_dump() for a in anchors]},
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
        dynamic_agent = create_forge_agent(WORLD_ARCHITECT_PROMPT, api_key=or_key)

        try:
            if chunk_type == "geography":
                result = await run_ai(dynamic_agent, prompt, "chunk", output_type=ForgeGeographyDraft)
                geo_data = result.output.model_dump()
                if not geo_data.get("zones"):
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="AI model returned no zones. Please try again.",
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
                result = await run_ai(dynamic_agent, prompt, "chunk", output_type=list[ForgeAgentDraft])
                agents_list = [a.model_dump() for a in result.output]
                if not agents_list:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="AI model returned no agents. Please try again.",
                    )
                validate_bilingual_output(
                    agents_list,
                    ["character_de", "background_de", "primary_profession_de"],
                    "agent",
                )
                await ForgeDraftService.update_draft(supabase, user_id, draft_id, ForgeDraftUpdate(agents=agents_list))
                return {"agents": agents_list}

            elif chunk_type == "buildings":
                result = await run_ai(dynamic_agent, prompt, "chunk", output_type=list[ForgeBuildingDraft])
                buildings_list = [b.model_dump() for b in result.output]
                if not buildings_list:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="AI model returned no buildings. Please try again.",
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
        except ModelHTTPError as exc:
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
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI model returned invalid output after retries. Please try again.",
            ) from exc

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
            dynamic_agent = create_forge_agent(WORLD_ARCHITECT_PROMPT, api_key=or_key)

            try:
                if entity_type == "agents":
                    result = await run_ai(dynamic_agent, prompt, "entity", output_type=ForgeAgentDraft)
                else:
                    result = await run_ai(dynamic_agent, prompt, "entity", output_type=ForgeBuildingDraft)
                entity = result.output.model_dump()
            except ModelHTTPError as exc:
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
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="AI model returned invalid output after retries. Please try again.",
                ) from exc

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

        # Mark draft as processing
        await ForgeDraftService.update_draft(
            supabase,
            user_id,
            draft_id,
            ForgeDraftUpdate(status="processing"),
        )

        try:
            try:
                response = await supabase.rpc("fn_materialize_shard", {"p_draft_id": str(draft_id)}).execute()
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
            slug_resp = await (
                supabase.table("simulations").select("slug, name, description").eq("id", str(sim_id)).single().execute()
            )
            slug = slug_resp.data["slug"] if slug_resp.data else None
            sim_name = slug_resp.data.get("name", "") if slug_resp.data else ""
            sim_description = slug_resp.data.get("description", "") if slug_resp.data else ""

            # Fetch draft for theme_config and lore context
            draft_data = await ForgeDraftService.get_draft(supabase, user_id, draft_id)

            # Use admin client for service-role writes (lore + theme settings)
            write_client = admin_supabase or supabase

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
                "description": sim_description,
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
            except ModelHTTPError as exc:
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
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Theme generation failed. Please try again.",
                ) from exc

        # Store in draft
        await ForgeDraftService.update_draft(
            supabase,
            user_id,
            draft_id,
            ForgeDraftUpdate(theme_config=theme_data),
        )

        return theme_data

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
                mock_trans = mock.mock_entity_translations(mat_agents, mat_buildings, mat_zones, mat_streets, sim_desc)
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
            except (httpx.HTTPError, ModelHTTPError, UnexpectedModelBehavior, KeyError, TypeError, ValueError):
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
            except (httpx.HTTPError, ModelHTTPError, UnexpectedModelBehavior, KeyError, TypeError, ValueError):
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
            PostgrestAPIError,
            httpx.HTTPError,
            ModelHTTPError,
            UnexpectedModelBehavior,
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

                entity_translations = await ForgeEntityTranslationService.translate_entities(
                    agents=mat_agents,
                    buildings=mat_buildings,
                    zones=mat_zones,
                    streets=mat_streets,
                    simulation_description=sim_desc,
                    openrouter_key=or_key,
                )
                await ForgeEntityTranslationService.persist_translations(
                    supabase,
                    simulation_id,
                    entity_translations,
                )
        except (
            PostgrestAPIError,
            httpx.HTTPError,
            ModelHTTPError,
            UnexpectedModelBehavior,
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

    @classmethod
    async def run_batch_generation(
        cls,
        supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
        anchor_data: dict | None = None,
        draft_data: dict | None = None,
        entity_types: set[str] | None = None,
    ) -> None:
        """Background task: lore generation → image generation.

        Runs research + lore + translations first (needed for world_context),
        then sequential image generation (banner → portraits → buildings → lore).
        Optimized for 512MB RAM: processes one image at a time.

        If entity_types is provided, only regenerate those types
        (e.g. {"lore"}, {"agent", "building"}).
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
            except (httpx.HTTPError, ModelHTTPError, UnexpectedModelBehavior, KeyError, TypeError, ValueError):
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
            except (httpx.HTTPError, ModelHTTPError, UnexpectedModelBehavior, KeyError, TypeError, ValueError):
                logger.warning(
                    "Prompt template generation failed — using platform defaults",
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

        # Count total images for progress tracking
        img_total_parts: list[int] = []
        if not _types or "banner" in _types:
            img_total_parts.append(1)
        if not _types or "agent" in _types:
            agent_count_resp = (
                await supabase.table("agents")
                .select("id", count="exact")
                .eq(
                    "simulation_id",
                    str(simulation_id),
                )
                .execute()
            )
            img_total_parts.append(agent_count_resp.count or 0)
        if not _types or "building" in _types:
            bldg_count_resp = (
                await supabase.table("buildings")
                .select("id", count="exact")
                .eq(
                    "simulation_id",
                    str(simulation_id),
                )
                .execute()
            )
            img_total_parts.append(bldg_count_resp.count or 0)
        if not _types or "lore" in _types:
            lore_count_resp = (
                await supabase.table("simulation_lore")
                .select("id", count="exact")
                .eq(
                    "simulation_id",
                    str(simulation_id),
                )
                .not_.is_("image_slug", "null")
                .execute()
            )
            img_total_parts.append(lore_count_resp.count or 0)
        img_total = sum(img_total_parts)

        try:
            if not _types or "banner" in _types:
                img_counter += 1
                logger.info(
                    "Generating image",
                    extra={"entity_type": "banner", "progress": f"{img_counter}/{img_total}"},
                )
                try:
                    await image_service.generate_banner_image(
                        sim_name=sim_data.get("name", "Unknown"),
                        sim_description=sim_data.get("description", ""),
                        anchor_data=anchor_data,
                    )
                    images_succeeded += 1
                except ReplicateBillingError:
                    raise
                except (httpx.HTTPError, ReplicateError, KeyError, TypeError, ValueError, OSError):
                    images_failed += 1
                    logger.exception("Banner generation failed")
                    with sentry_sdk.push_scope() as scope:
                        scope.set_tag("forge_phase", "batch_images")
                        scope.set_tag("entity_type", "banner")
                        scope.set_context("image_generation", {"simulation_id": str(simulation_id)})
                        sentry_sdk.capture_exception()

                # ── Generate terminal boot art from the banner image ──
                try:
                    from backend.services.forge_ascii_art_service import ForgeAsciiArtService

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
                except (httpx.HTTPError, ReplicateError, KeyError, TypeError, ValueError, OSError):
                    logger.warning("Terminal boot art generation failed", exc_info=True)

            # 2. Agent portraits
            if not _types or "agent" in _types:
                agents = await (
                    supabase.table("agents")
                    .select("id, name, character, background")
                    .eq("simulation_id", str(simulation_id))
                    .execute()
                )
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
                    try:
                        await image_service.generate_agent_portrait(
                            agent_id=agent_row["id"],
                            agent_name=agent_row["name"],
                            agent_data={"character": agent_row["character"], "background": agent_row["background"]},
                        )
                        images_succeeded += 1
                    except ReplicateBillingError:
                        raise
                    except (httpx.HTTPError, ReplicateError, KeyError, TypeError, ValueError, OSError):
                        images_failed += 1
                        logger.exception(
                            "Batch image gen failed for agent",
                            extra={"entity_type": "agent", "entity_id": agent_row["id"]},
                        )
                        with sentry_sdk.push_scope() as scope:
                            scope.set_tag("forge_phase", "batch_images")
                            scope.set_tag("entity_type", "agent")
                            scope.set_context(
                                "image_generation",
                                {
                                    "simulation_id": str(simulation_id),
                                    "entity_id": str(agent_row["id"]),
                                    "entity_name": agent_row["name"],
                                },
                            )
                            sentry_sdk.capture_exception()

            # 3. Building images
            if not _types or "building" in _types:
                buildings = await (
                    supabase.table("buildings")
                    .select(
                        "id, name, description, building_type, building_condition,"
                        " style, special_type, construction_year,"
                        " population_capacity, zones(name)"
                    )
                    .eq("simulation_id", str(simulation_id))
                    .execute()
                )
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
                    try:
                        await image_service.generate_building_image(
                            building_id=building["id"],
                            building_name=building["name"],
                            building_type=building["building_type"],
                            building_data={
                                "description": building.get("description", ""),
                                "building_condition": building.get("building_condition", ""),
                                "building_style": building.get("style", ""),
                                "special_type": building.get("special_type", ""),
                                "construction_year": building.get("construction_year", ""),
                                "population_capacity": building.get("population_capacity", ""),
                                "zone_name": zone_data.get("name", ""),
                            },
                        )
                        images_succeeded += 1
                    except ReplicateBillingError:
                        raise
                    except (httpx.HTTPError, ReplicateError, KeyError, TypeError, ValueError, OSError):
                        images_failed += 1
                        logger.exception(
                            "Batch image gen failed for building",
                            extra={"entity_type": "building", "entity_id": building["id"]},
                        )
                        with sentry_sdk.push_scope() as scope:
                            scope.set_tag("forge_phase", "batch_images")
                            scope.set_tag("entity_type", "building")
                            scope.set_context(
                                "image_generation",
                                {
                                    "simulation_id": str(simulation_id),
                                    "entity_id": str(building["id"]),
                                    "entity_name": building["name"],
                                },
                            )
                            sentry_sdk.capture_exception()

            # 4. Lore images (sections with image_slug)
            if not _types or "lore" in _types:
                sim_slug = sim_data.get("slug", str(simulation_id))
                lore_sections = await (
                    supabase.table("simulation_lore")
                    .select("id, title, body, image_slug, image_caption")
                    .eq("simulation_id", str(simulation_id))
                    .not_.is_("image_slug", "null")
                    .order("sort_order")
                    .execute()
                )
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
                    try:
                        await image_service.generate_lore_image(
                            section_title=section["title"],
                            section_body=section["body"],
                            image_slug=section["image_slug"],
                            sim_slug=sim_slug,
                            section_id=section["id"],
                            image_caption=section.get("image_caption"),
                        )
                        images_succeeded += 1
                    except ReplicateBillingError:
                        raise
                    except (httpx.HTTPError, ReplicateError, KeyError, TypeError, ValueError, OSError):
                        images_failed += 1
                        logger.exception(
                            "Lore image gen failed",
                            extra={"entity_type": "lore_section", "entity_id": section["id"]},
                        )
                        with sentry_sdk.push_scope() as scope:
                            scope.set_tag("forge_phase", "batch_images")
                            scope.set_tag("entity_type", "lore")
                            scope.set_context(
                                "image_generation",
                                {
                                    "simulation_id": str(simulation_id),
                                    "entity_id": str(section["id"]),
                                    "entity_name": section["title"],
                                },
                            )
                            sentry_sdk.capture_exception()

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

        # Clear lore progress — ceremony no longer needs it
        await cls._update_lore_progress(supabase, simulation_id, None)

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
        from backend.services.forge_feature_service import ForgeFeatureService

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

Generate exactly 3 new agents. Requirements:
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
                agent = create_forge_agent(WORLD_ARCHITECT_PROMPT, api_key=openrouter_key)
                result = await run_ai(agent, prompt, "chunk", output_type=list[ForgeAgentDraft])
                generated = result.output

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
                    agent_in_db = (
                        await admin_supabase.table("agents")
                        .select("id")
                        .eq("simulation_id", str(simulation_id))
                        .eq("name", agent_draft.name)
                        .maybe_single()
                        .execute()
                    )

                    if agent_in_db.data:
                        await image_service.generate_agent_portrait(
                            agent_id=agent_in_db.data["id"],
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
                    await ForgeEntityTranslationService.translate_entities(
                        admin_supabase,
                        simulation_id,
                        agent_rows.data,
                        [],
                        [],
                        [],
                        sim.get("description", ""),
                        openrouter_key,
                    )
            except (httpx.HTTPError, ModelHTTPError, UnexpectedModelBehavior, KeyError, TypeError, ValueError):
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
            PostgrestAPIError,
            httpx.HTTPError,
            ModelHTTPError,
            UnexpectedModelBehavior,
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
        anchor_resp = (
            await supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(simulation_id))
            .eq("setting_key", "philosophical_anchor")
            .maybe_single()
            .execute()
        )

        anchor = {}
        if anchor_resp.data:
            import json

            try:
                anchor = (
                    json.loads(anchor_resp.data["setting_value"])
                    if isinstance(
                        anchor_resp.data["setting_value"],
                        str,
                    )
                    else anchor_resp.data["setting_value"]
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
