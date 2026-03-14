"""Orchestrator service for Simulation Forge worldbuilding."""

from __future__ import annotations

import logging
from uuid import UUID

import structlog

from fastapi import HTTPException, status
from pydantic_ai import Agent

from backend.config import settings
from backend.models.forge import (
    ForgeAgentDraft,
    ForgeBuildingDraft,
    ForgeDraftUpdate,
    ForgeGenerationConfig,
    ForgeGeographyDraft,
    PhilosophicalAnchor,
)
import sentry_sdk
from backend.services import forge_mock_service as mock
from pydantic_ai.exceptions import ModelHTTPError

from backend.services.ai_utils import PYDANTIC_AI_MAX_TOKENS, ai_error_to_http, get_openrouter_model
from backend.services.platform_model_config import get_platform_model
from backend.services.forge_draft_service import ForgeDraftService
from backend.services.forge_entity_translation_service import ForgeEntityTranslationService
from backend.services.forge_lore_service import ForgeLoreService
from backend.services.forge_theme_service import ForgeThemeService
from backend.services.image_service import ImageService
from backend.services.research_service import ResearchService
from backend.utils.encryption import decrypt
from supabase import Client

logger = logging.getLogger(__name__)

WORLD_ARCHITECT_PROMPT = (
    "You are a Senior World Architect at the Bureau of Impossible Geography. "
    "Your task is to generate cohesive, high-quality entities for a simulation Shard "
    "based on its Philosophical Anchor and Seed. "
    "Maintain tonal consistency and literary depth. No generic fantasy/sci-fi."
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
                f"",
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
                f"",
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

    return "\n".join(lines)


class ForgeOrchestratorService:
    """Orchestrates multi-step simulation generation."""

    # Map PostgreSQL RAISE EXCEPTION messages to semantic HTTP status codes.
    # Keys are substrings matched case-insensitively against the error message.
    _RPC_ERROR_MAP: list[tuple[str, int, str]] = [
        ("insufficient tokens", 402, "Insufficient Forge Tokens. Acquire more before igniting."),
        ("already processed", 409, "This draft has already been materialized."),
        ("in progress", 409, "Materialization is already in progress."),
        ("missing a selected philosophical anchor", 400, "Draft is missing a philosophical anchor. Return to the Astrolabe."),
        ("missing geography", 400, "Draft is missing geography data. Return to the Drafting Table."),
        ("must contain at least one agent", 400, "Draft must contain at least one agent. Return to the Drafting Table."),
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
    def _create_image_service(
        supabase: Client,
        simulation_id: UUID,
        sim_data: dict,
        anchor_data: dict | None = None,
        replicate_api_key: str | None = None,
        openrouter_api_key: str | None = None,
    ) -> ImageService:
        """Build an ``ImageService`` with world context from the simulation."""
        world_context = ForgeOrchestratorService._build_world_context(
            supabase, simulation_id, sim_data, anchor_data,
        )
        return ImageService(
            supabase,
            simulation_id,
            replicate_api_key=replicate_api_key,
            openrouter_api_key=openrouter_api_key,
            world_context=world_context,
        )

    @staticmethod
    async def _get_user_keys(supabase: Client, user_id: UUID) -> tuple[str | None, str | None]:
        """Fetch and decrypt a user's BYOK API keys."""
        logger.debug("Fetching BYOK keys for user %s", user_id)
        resp = (
            supabase.table("user_wallets")
            .select("encrypted_openrouter_key, encrypted_replicate_key")
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
        data = resp.data or {}

        or_key = data.get("encrypted_openrouter_key")
        rep_key = data.get("encrypted_replicate_key")

        decrypted_or = decrypt(or_key) if or_key else None
        decrypted_rep = decrypt(rep_key) if rep_key else None

        if decrypted_or:
            logger.debug("Using personal OpenRouter key for user %s", user_id)
        if decrypted_rep:
            logger.debug("Using personal Replicate key for user %s", user_id)

        return decrypted_or, decrypted_rep

    @staticmethod
    async def get_forge_progress(supabase: Client, slug: str) -> dict | None:
        """Image-generation progress for the forge ceremony.

        Delegates to ``get_forge_progress(slug)`` Postgres function
        (migration 098) which counts completed images and returns
        per-entity image URLs in a single round-trip.

        Returns *None* when the slug does not match a simulation.
        """
        resp = supabase.rpc("get_forge_progress", {"p_slug": slug}).execute()
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
            or_key, _ = await ForgeOrchestratorService._get_user_keys(supabase, user_id)

            try:
                # 1. Scrape web context
                logger.debug("Scraping thematic context for seed: %s", seed[:50])
                context = await ResearchService.search_thematic_context(seed)

                # 2. Generate 3 Philosophical Anchors
                logger.debug("Generating philosophical anchors...")
                anchors = await ResearchService.generate_anchors(seed, context, or_key)
            except ModelHTTPError as exc:
                raise ai_error_to_http(exc) from exc

        # 3. Update draft
        logger.debug("Updating draft %s with research results", draft_id)
        await ForgeDraftService.update_draft(
            supabase,
            user_id,
            draft_id,
            ForgeDraftUpdate(
                research_context={"raw_data": context},
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Must select a philosophical anchor first.",
            )

        # Parse generation config with validated defaults
        raw_config = draft_data.get("generation_config") or {}
        gen_config = ForgeGenerationConfig(**raw_config)
        seed = draft_data.get("seed_prompt", "")

        if settings.forge_mock_mode:
            logger.debug("FORGE_MOCK_MODE: using mock data", extra={"chunk_type": chunk_type})
            if chunk_type == "geography":
                geo_data = mock.mock_geography(seed, gen_config.zone_count, gen_config.street_count)
                await ForgeDraftService.update_draft(
                    supabase, user_id, draft_id, ForgeDraftUpdate(geography=geo_data)
                )
                return geo_data
            elif chunk_type == "agents":
                agents_list = mock.mock_agents(seed, gen_config.agent_count)
                await ForgeDraftService.update_draft(
                    supabase, user_id, draft_id, ForgeDraftUpdate(agents=agents_list)
                )
                return {"agents": agents_list}
            elif chunk_type == "buildings":
                buildings_list = mock.mock_buildings(seed, gen_config.building_count)
                await ForgeDraftService.update_draft(
                    supabase, user_id, draft_id, ForgeDraftUpdate(buildings=buildings_list)
                )
                return {"buildings": buildings_list}
            else:
                raise HTTPException(status_code=400, detail=f"Invalid chunk type: {chunk_type}")

        or_key, _ = await ForgeOrchestratorService._get_user_keys(supabase, user_id)

        # Build geography context for agent/building chunks
        geography = draft_data.get("geography") or None

        prompt = _build_chunk_prompt(chunk_type, anchor, seed, gen_config, geography)

        logger.debug("Instantiating dynamic Pydantic AI agent for chunk generation")
        dynamic_agent = Agent(
            get_openrouter_model(or_key, model_id=get_platform_model("forge")),
            system_prompt=WORLD_ARCHITECT_PROMPT,
        )

        chunk_settings = {"max_tokens": PYDANTIC_AI_MAX_TOKENS["chunk"]}

        try:
            if chunk_type == "geography":
                result = await dynamic_agent.run(
                    prompt,
                    output_type=ForgeGeographyDraft,
                    model_settings=chunk_settings,
                )
                await ForgeDraftService.update_draft(
                    supabase, user_id, draft_id, ForgeDraftUpdate(geography=result.output.model_dump())
                )
                return result.output.model_dump()

            elif chunk_type == "agents":
                result = await dynamic_agent.run(
                    prompt,
                    output_type=list[ForgeAgentDraft],
                    model_settings=chunk_settings,
                )
                agents_list = [a.model_dump() for a in result.output]
                await ForgeDraftService.update_draft(
                    supabase, user_id, draft_id, ForgeDraftUpdate(agents=agents_list)
                )
                return {"agents": agents_list}

            elif chunk_type == "buildings":
                result = await dynamic_agent.run(
                    prompt,
                    output_type=list[ForgeBuildingDraft],
                    model_settings=chunk_settings,
                )
                buildings_list = [b.model_dump() for b in result.output]
                await ForgeDraftService.update_draft(
                    supabase, user_id, draft_id, ForgeDraftUpdate(buildings=buildings_list)
                )
                return {"buildings": buildings_list}

            else:
                raise HTTPException(status_code=400, detail=f"Invalid chunk type: {chunk_type}")
        except ModelHTTPError as exc:
            raise ai_error_to_http(exc) from exc

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
            supabase, user_id, draft_id,
            ForgeDraftUpdate(status="processing"),
        )

        try:
            try:
                response = supabase.rpc("fn_materialize_shard", {"p_draft_id": str(draft_id)}).execute()
            except Exception as rpc_err:
                # Parse PostgreSQL RAISE EXCEPTION into semantic HTTP codes
                err_msg = str(rpc_err)
                status_code, detail = ForgeOrchestratorService._classify_rpc_error(err_msg)
                await ForgeDraftService.update_draft(
                    supabase, user_id, draft_id,
                    ForgeDraftUpdate(status="failed", error_log=err_msg[:500]),
                )
                raise HTTPException(status_code=status_code, detail=detail) from rpc_err

            if not response.data:
                await ForgeDraftService.update_draft(
                    supabase, user_id, draft_id,
                    ForgeDraftUpdate(status="failed", error_log="Materialization returned no data."),
                )
                raise HTTPException(status_code=500, detail="Materialization failed in database.")

            sim_id = response.data

            # Resolve slug + name for frontend navigation and ceremony
            slug_resp = (
                supabase.table("simulations")
                .select("slug, name, description")
                .eq("id", str(sim_id))
                .single()
                .execute()
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
                except Exception:
                    logger.exception("Theme application failed", extra={"simulation_id": str(sim_id)})

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
        except Exception as e:
            logger.exception("Shard materialization failed", extra={"draft_id": str(draft_id)})
            await ForgeDraftService.update_draft(
                supabase, user_id, draft_id,
                ForgeDraftUpdate(status="failed", error_log=str(e)[:500]),
            )
            raise HTTPException(
                status_code=500,
                detail="Shard materialization failed. Please contact support if the issue persists.",
            ) from e

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
            or_key, _ = await ForgeOrchestratorService._get_user_keys(supabase, user_id)

            theme_data = await ForgeThemeService.generate_theme(
                seed=seed,
                anchor=anchor,
                geography=geography,
                openrouter_key=or_key,
            )

        # Store in draft
        await ForgeDraftService.update_draft(
            supabase, user_id, draft_id,
            ForgeDraftUpdate(theme_config=theme_data),
        )

        return theme_data

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
                    supabase, simulation_id, lore_sections, translations,
                )
            except Exception:
                logger.exception("Mock lore persist failed", extra={"simulation_id": str(simulation_id)})

            try:
                mat_agents = (supabase.table("agents").select("name, character, background, primary_profession").eq("simulation_id", str(simulation_id)).execute()).data or []
                mat_buildings = (supabase.table("buildings").select("name, description, building_type, building_condition").eq("simulation_id", str(simulation_id)).execute()).data or []
                mat_zones = (supabase.table("zones").select("name, description, zone_type").eq("simulation_id", str(simulation_id)).execute()).data or []
                mat_streets = (supabase.table("city_streets").select("name, street_type").eq("simulation_id", str(simulation_id)).execute()).data or []
                sim_desc = geography.get("description", "") or seed
                mock_trans = mock.mock_entity_translations(mat_agents, mat_buildings, mat_zones, mat_streets, sim_desc)
                await ForgeEntityTranslationService.persist_translations(supabase, simulation_id, mock_trans)
            except Exception:
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
        if gen_config.deep_research:
            try:
                research_context = await ResearchService.research_for_lore(
                    seed=seed,
                    anchor=anchor,
                    astrolabe_context=astrolabe_ctx,
                    openrouter_key=or_key,
                )
            except Exception:
                logger.exception(
                    "Deep research failed — using Astrolabe context only",
                    extra={"simulation_id": str(simulation_id)},
                )

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
            translations = None
            try:
                translations = await ForgeLoreService.translate_lore(
                    lore_sections, openrouter_key=or_key,
                )
            except Exception:
                logger.exception("Lore translation failed", extra={"simulation_id": str(simulation_id)})

            await ForgeLoreService.persist_lore(
                supabase, simulation_id, lore_sections, translations,
            )
        except Exception:
            logger.exception("Lore generation failed", extra={"simulation_id": str(simulation_id)})

        # Translate entity fields
        try:
            mat_agents = (supabase.table("agents").select("name, character, background, primary_profession").eq("simulation_id", str(simulation_id)).execute()).data or []
            mat_buildings = (supabase.table("buildings").select("name, description, building_type, building_condition").eq("simulation_id", str(simulation_id)).execute()).data or []
            mat_zones = (supabase.table("zones").select("name, description, zone_type").eq("simulation_id", str(simulation_id)).execute()).data or []
            mat_streets = (supabase.table("city_streets").select("name, street_type").eq("simulation_id", str(simulation_id)).execute()).data or []
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
                supabase, simulation_id, entity_translations,
            )
        except Exception:
            logger.exception("Entity translation failed", extra={"simulation_id": str(simulation_id)})

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
        structlog.contextvars.bind_contextvars(simulation_id=str(simulation_id))
        logger.info("Starting background generation")

        try:
            or_key, rep_key = await ForgeOrchestratorService._get_user_keys(supabase, user_id)
        except Exception:
            logger.exception("Failed to fetch BYOK keys — using platform keys")
            or_key, rep_key = None, None

        # ── Phase A: Lore + translations (must complete before images) ──
        await cls._generate_lore_and_translations(
            supabase, simulation_id, user_id, or_key, draft_data or {},
        )

        # ── Phase B: Image generation ──
        logger.info("Starting image generation")

        sim_resp = (
            supabase.table("simulations")
            .select("name, description, slug")
            .eq("id", str(simulation_id))
            .single()
            .execute()
        )
        sim_data = sim_resp.data or {}

        image_service = cls._create_image_service(
            supabase, simulation_id, sim_data, anchor_data,
            replicate_api_key=rep_key, openrouter_api_key=or_key,
        )

        _types = entity_types  # None = all types

        if not _types or "banner" in _types:
            try:
                await image_service.generate_banner_image(
                    sim_name=sim_data.get("name", "Unknown"),
                    sim_description=sim_data.get("description", ""),
                    anchor_data=anchor_data,
                )
            except Exception:
                logger.exception("Banner generation failed")

        # 2. Agent portraits
        if not _types or "agent" in _types:
            agents = (
                supabase.table("agents")
                .select("id, name, character, background")
                .eq("simulation_id", str(simulation_id))
                .execute()
            )
            for agent in agents.data or []:
                try:
                    await image_service.generate_agent_portrait(
                        agent_id=agent["id"],
                        agent_name=agent["name"],
                        agent_data={"character": agent["character"], "background": agent["background"]},
                    )
                except Exception:
                    logger.exception(
                        "Batch image gen failed for agent",
                        extra={"entity_type": "agent", "entity_id": agent["id"]},
                    )

        # 3. Building images
        if not _types or "building" in _types:
            buildings = (
                supabase.table("buildings")
                .select("id, name, description, building_type, building_condition, style, special_type, construction_year, population_capacity, zones(name)")
                .eq("simulation_id", str(simulation_id))
                .execute()
            )
            for building in buildings.data or []:
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
                except Exception:
                    logger.exception(
                        "Batch image gen failed for building",
                        extra={"entity_type": "building", "entity_id": building["id"]},
                    )

        # 4. Lore images (sections with image_slug)
        if not _types or "lore" in _types:
            sim_slug = sim_data.get("slug", str(simulation_id))
            lore_sections = (
                supabase.table("simulation_lore")
                .select("id, title, body, image_slug, image_caption")
                .eq("simulation_id", str(simulation_id))
                .not_.is_("image_slug", "null")
                .order("sort_order")
                .execute()
            )
            for section in lore_sections.data or []:
                try:
                    await image_service.generate_lore_image(
                        section_title=section["title"],
                        section_body=section["body"],
                        image_slug=section["image_slug"],
                        sim_slug=sim_slug,
                        section_id=section["id"],
                        image_caption=section.get("image_caption"),
                    )
                except Exception:
                    logger.exception(
                        "Lore image gen failed",
                        extra={"entity_type": "lore_section", "entity_id": section["id"]},
                    )

        logger.info("Batch generation completed")

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
            sim_resp = admin_supabase.table("simulations").select(
                "name, description"
            ).eq("id", str(simulation_id)).single().execute()
            sim = sim_resp.data

            agents_resp = admin_supabase.table("agents").select(
                "name, primary_profession, character"
            ).eq("simulation_id", str(simulation_id)).execute()
            existing_agents = agents_resp.data or []

            zones_resp = admin_supabase.table("zones").select(
                "id, name, zone_type, description"
            ).eq("simulation_id", str(simulation_id)).execute()
            zones = zones_resp.data or []

            # 2. Build recruitment prompt
            agent_list = "\n".join(
                f"  - {a['name']} ({a['primary_profession']}): {a.get('character', '')[:100]}..."
                for a in existing_agents[:10]
            )
            zone_context = "\n".join(
                f"  - {z['name']} ({z['zone_type']}): {z.get('description', '')[:80]}"
                for z in zones
            )

            prompt = f"""You are a Bureau Recruitment Officer processing new arrivals for {sim['name']}.

WORLD DESCRIPTION: {sim.get('description', '')}

EXISTING AGENTS ({len(existing_agents)} total):
{agent_list}

ZONES:
{zone_context}

{"RECRUITMENT FOCUS: " + focus if focus else ""}
{"TARGET ZONE: " + next((z['name'] for z in zones if z['id'] == str(zone_id)), 'any') if zone_id else ""}

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
                model = get_openrouter_model(openrouter_key, model_id=get_platform_model("forge"))
                agent = Agent(
                    model,
                    system_prompt=WORLD_ARCHITECT_PROMPT,
                )
                result = await agent.run(
                    prompt,
                    output_type=list[ForgeAgentDraft],
                    model_settings={"max_tokens": PYDANTIC_AI_MAX_TOKENS["chunk"]},
                )
                generated = result.output

            # 3. Insert agents into the simulation
            for agent_draft in generated:
                admin_supabase.table("agents").insert({
                    "simulation_id": str(simulation_id),
                    "name": agent_draft.name,
                    "gender": agent_draft.gender,
                    "system": agent_draft.system,
                    "primary_profession": agent_draft.primary_profession,
                    "character": agent_draft.character,
                    "background": agent_draft.background,
                }).execute()

            # 4. Generate portraits
            try:
                sim_data = {"name": sim["name"], "description": sim.get("description", "")}
                image_service = ForgeOrchestratorService._create_image_service(
                    admin_supabase, simulation_id, sim_data,
                    replicate_api_key=replicate_key, openrouter_api_key=openrouter_key,
                )

                for agent_draft in generated:
                    agent_in_db = admin_supabase.table("agents").select(
                        "id"
                    ).eq("simulation_id", str(simulation_id)).eq(
                        "name", agent_draft.name
                    ).maybe_single().execute()

                    if agent_in_db.data:
                        await image_service.generate_agent_portrait(
                            agent_id=agent_in_db.data["id"],
                            agent_name=agent_draft.name,
                            agent_data={
                                "character": agent_draft.character,
                                "background": agent_draft.background,
                            },
                        )
            except Exception:
                logger.exception("Portrait generation failed for recruits")

            # 5. Translate
            try:
                agent_rows = admin_supabase.table("agents").select(
                    "id, name, primary_profession, character, background"
                ).eq("simulation_id", str(simulation_id)).in_(
                    "name", [a.name for a in generated]
                ).execute()

                if agent_rows.data:
                    await ForgeEntityTranslationService.translate_entities(
                        admin_supabase, simulation_id,
                        agent_rows.data, [], [], [],
                        sim.get("description", ""),
                        openrouter_key,
                    )
            except Exception:
                logger.exception("Translation failed for recruits")

            # 6. Complete feature purchase
            await ForgeFeatureService.complete_feature(
                admin_supabase, purchase_id,
                result={
                    "agents": [a.name for a in generated],
                    "count": len(generated),
                },
            )
            logger.info(
                "Recruitment completed",
                extra={"agents": len(generated)},
            )

        except Exception as exc:
            sentry_sdk.capture_exception(exc)
            logger.exception("Recruitment failed")
            await ForgeFeatureService.fail_feature(
                admin_supabase, purchase_id, str(exc),
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
            entity_resp = admin_supabase.table(table).select(select).eq(
                "id", str(entity_id)
            ).single().execute()
            entity = entity_resp.data

            # Fetch simulation data + BYOK keys
            sim_resp = admin_supabase.table("simulations").select(
                "name, description, slug"
            ).eq("id", str(simulation_id)).single().execute()
            sim_data = sim_resp.data or {}

            or_key = None
            rep_key = None
            if user_id:
                or_key, rep_key = await ForgeOrchestratorService._get_user_keys(
                    admin_supabase, user_id,
                )

            image_service = ForgeOrchestratorService._create_image_service(
                admin_supabase, simulation_id, sim_data,
                replicate_api_key=rep_key, openrouter_api_key=or_key,
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
        except Exception:
            logger.exception("Darkroom regen failed")

    @staticmethod
    def _build_world_context(
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
        lore_resp = (
            supabase.table("simulation_lore")
            .select("title, body")
            .eq("simulation_id", str(simulation_id))
            .order("sort_order")
            .limit(2)
            .execute()
        )
        lore_sections = lore_resp.data or []

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
            parts.append(
                f"LORE — {section.get('title', '')}:\n{body[:600]}"
            )

        context = "\n\n".join(parts)
        logger.debug(
            "World context built",
            extra={"simulation_id": str(simulation_id), "context_length": len(context)},
        )
        return context
