"""Orchestrator service for Simulation Forge worldbuilding."""

from __future__ import annotations

import logging
from uuid import UUID

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
from backend.services import forge_mock_service as mock
from backend.services.ai_utils import get_openrouter_model
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

            # 1. Scrape web context
            logger.debug("Scraping thematic context for seed: %s", seed[:50])
            context = await ResearchService.search_thematic_context(seed)

            # 2. Generate 3 Philosophical Anchors
            logger.debug("Generating philosophical anchors...")
            anchors = await ResearchService.generate_anchors(seed, context, or_key)

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
            get_openrouter_model(or_key),
            system_prompt=WORLD_ARCHITECT_PROMPT,
        )

        if chunk_type == "geography":
            result = await dynamic_agent.run(prompt, output_type=ForgeGeographyDraft)
            await ForgeDraftService.update_draft(
                supabase, user_id, draft_id, ForgeDraftUpdate(geography=result.output.model_dump())
            )
            return result.output.model_dump()

        elif chunk_type == "agents":
            result = await dynamic_agent.run(
                prompt,
                output_type=list[ForgeAgentDraft],
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
            )
            buildings_list = [b.model_dump() for b in result.output]
            await ForgeDraftService.update_draft(
                supabase, user_id, draft_id, ForgeDraftUpdate(buildings=buildings_list)
            )
            return {"buildings": buildings_list}

        else:
            raise HTTPException(status_code=400, detail=f"Invalid chunk type: {chunk_type}")

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

            # Resolve slug for frontend navigation
            slug_resp = (
                supabase.table("simulations")
                .select("slug")
                .eq("id", str(sim_id))
                .single()
                .execute()
            )
            slug = slug_resp.data["slug"] if slug_resp.data else None

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

            # Generate and persist lore + translations
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
                        write_client, sim_id, lore_sections, translations,
                    )
                except Exception:
                    logger.exception("Mock lore persist failed", extra={"simulation_id": str(sim_id)})

                # Mock entity translations
                try:
                    mat_agents = (
                        write_client.table("agents")
                        .select("name, character, background, primary_profession")
                        .eq("simulation_id", str(sim_id))
                        .execute()
                    ).data or []
                    mat_buildings = (
                        write_client.table("buildings")
                        .select("name, description, building_type, building_condition")
                        .eq("simulation_id", str(sim_id))
                        .execute()
                    ).data or []
                    mat_zones = (
                        write_client.table("zones")
                        .select("name, description, zone_type")
                        .eq("simulation_id", str(sim_id))
                        .execute()
                    ).data or []
                    mat_streets = (
                        write_client.table("city_streets")
                        .select("name, street_type")
                        .eq("simulation_id", str(sim_id))
                        .execute()
                    ).data or []

                    sim_desc = geography.get("description", "") or seed
                    mock_trans = mock.mock_entity_translations(
                        mat_agents, mat_buildings, mat_zones, mat_streets, sim_desc,
                    )
                    await ForgeEntityTranslationService.persist_translations(
                        write_client, sim_id, mock_trans,
                    )
                except Exception:
                    logger.exception("Mock entity translation failed", extra={"simulation_id": str(sim_id)})
            else:
                or_key, _ = await ForgeOrchestratorService._get_user_keys(supabase, user_id)

                # Extract Astrolabe research from draft
                astrolabe_ctx = ""
                raw_research = draft_data.get("research_context") or {}
                if isinstance(raw_research, dict):
                    astrolabe_ctx = raw_research.get("raw_data", "")

                # Deep research: dedicated LLM call (cheap model) to
                # produce literary/philosophical/architectural grounding.
                # User-togglable via generation_config.deep_research.
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
                            extra={"simulation_id": str(sim_id)},
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
                    # Translate lore to German
                    translations = None
                    try:
                        translations = await ForgeLoreService.translate_lore(
                            lore_sections, openrouter_key=or_key,
                        )
                    except Exception:
                        logger.exception("Lore translation failed", extra={"simulation_id": str(sim_id)})

                    await ForgeLoreService.persist_lore(
                        write_client, sim_id, lore_sections, translations,
                    )
                except Exception:
                    logger.exception("Lore generation failed", extra={"simulation_id": str(sim_id)})

                # Translate entity fields (agents, buildings, zones, streets, sim description)
                try:
                    mat_agents = (
                        write_client.table("agents")
                        .select("name, character, background, primary_profession")
                        .eq("simulation_id", str(sim_id))
                        .execute()
                    ).data or []
                    mat_buildings = (
                        write_client.table("buildings")
                        .select("name, description, building_type, building_condition")
                        .eq("simulation_id", str(sim_id))
                        .execute()
                    ).data or []
                    mat_zones = (
                        write_client.table("zones")
                        .select("name, description, zone_type")
                        .eq("simulation_id", str(sim_id))
                        .execute()
                    ).data or []
                    mat_streets = (
                        write_client.table("city_streets")
                        .select("name, street_type")
                        .eq("simulation_id", str(sim_id))
                        .execute()
                    ).data or []

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
                        write_client, sim_id, entity_translations,
                    )
                except Exception:
                    logger.exception("Entity translation failed", extra={"simulation_id": str(sim_id)})

            return {
                "simulation_id": sim_id,
                "slug": slug,
                "anchor": anchor,
                "seed_prompt": seed,
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
    async def run_batch_generation(
        cls,
        supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
        anchor_data: dict | None = None,
    ) -> None:
        """Background task for sequential image generation.

        Optimized for 512MB RAM: processes one image at a time.
        Order: banner → agent portraits → building images → lore images.
        """
        logger.info("Starting batch image generation", extra={"simulation_id": str(simulation_id)})

        try:
            or_key, rep_key = await ForgeOrchestratorService._get_user_keys(supabase, user_id)
        except Exception:
            logger.exception("Failed to fetch BYOK keys — using platform keys", extra={"simulation_id": str(simulation_id)})
            or_key, rep_key = None, None

        # 1. Build world context from persisted lore + anchor
        #    This is the research output that informs ALL image generation.
        sim_resp = (
            supabase.table("simulations")
            .select("name, description, slug")
            .eq("id", str(simulation_id))
            .single()
            .execute()
        )
        sim_data = sim_resp.data or {}

        world_context = cls._build_world_context(
            supabase, simulation_id, sim_data, anchor_data,
        )

        image_service = ImageService(
            supabase,
            simulation_id,
            replicate_api_key=rep_key,
            openrouter_api_key=or_key,
            world_context=world_context,
        )

        try:
            await image_service.generate_banner_image(
                sim_name=sim_data.get("name", "Unknown"),
                sim_description=sim_data.get("description", ""),
                anchor_data=anchor_data,
            )
        except Exception:
            logger.exception("Banner generation failed", extra={"simulation_id": str(simulation_id)})

        # 2. Agent portraits
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
        buildings = (
            supabase.table("buildings")
            .select("id, name, description, building_type, building_condition, building_style, special_type, construction_year, population_capacity, zones(name)")
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
                        "building_style": building.get("building_style", ""),
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
        sim_slug = sim_data.get("slug", str(simulation_id))
        lore_sections = (
            supabase.table("simulation_lore")
            .select("id, title, body, image_slug")
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
                )
            except Exception:
                logger.exception(
                    "Lore image gen failed",
                    extra={"entity_type": "lore_section", "entity_id": section["id"]},
                )

        logger.info("Batch generation completed", extra={"simulation_id": str(simulation_id)})

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
