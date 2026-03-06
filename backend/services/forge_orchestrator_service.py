"""Orchestrator service for Simulation Forge worldbuilding."""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import HTTPException, status
from pydantic_ai import Agent

from backend.models.forge import (
    ForgeAgentDraft,
    ForgeBuildingDraft,
    ForgeDraftUpdate,
    ForgeGenerationConfig,
    ForgeGeographyDraft,
)
from backend.config import settings
from backend.services.ai_utils import get_openrouter_model
from backend.services import forge_mock_service as mock
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


class ForgeOrchestratorService:
    """Orchestrates multi-step simulation generation."""

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
        logger.info("Starting Astrolabe research for user %s, draft %s", user_id, draft_id)
        draft_data = await ForgeDraftService.get_draft(supabase, user_id, draft_id)
        seed = draft_data["seed_prompt"]

        if settings.forge_mock_mode:
            logger.info("FORGE_MOCK_MODE: using mock research + anchors")
            context = mock.mock_research_context(seed)
            from backend.models.forge import PhilosophicalAnchor
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
        logger.info("Generating blueprint chunk '%s' for user %s, draft %s", chunk_type, user_id, draft_id)
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
            logger.info("FORGE_MOCK_MODE: using mock %s data", chunk_type)
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

        prompt = (
            f"Simulation Theme: {anchor.get('title')}\n"
            f"Core Question: {anchor.get('core_question')}\n"
            f"Description: {anchor.get('description')}\n\n"
            f"Task: Generate the {chunk_type} for this world."
        )

        or_key, _ = await ForgeOrchestratorService._get_user_keys(supabase, user_id)

        logger.debug("Instantiating dynamic Pydantic AI agent for chunk generation")
        dynamic_agent = Agent(
            get_openrouter_model(or_key),
            system_prompt=WORLD_ARCHITECT_PROMPT,
        )

        if chunk_type == "geography":
            geo_prompt = (
                f"{prompt}\n"
                f"Generate exactly {gen_config.zone_count} zones/districts and "
                f"exactly {gen_config.street_count} named streets."
            )
            result = await dynamic_agent.run(geo_prompt, output_type=ForgeGeographyDraft)
            await ForgeDraftService.update_draft(
                supabase, user_id, draft_id, ForgeDraftUpdate(geography=result.output.model_dump())
            )
            return result.output.model_dump()

        elif chunk_type == "agents":
            result = await dynamic_agent.run(
                prompt + f" Generate exactly {gen_config.agent_count} unique agents.",
                output_type=list[ForgeAgentDraft],
            )
            agents_list = [a.model_dump() for a in result.output]
            await ForgeDraftService.update_draft(
                supabase, user_id, draft_id, ForgeDraftUpdate(agents=agents_list)
            )
            return {"agents": agents_list}

        elif chunk_type == "buildings":
            result = await dynamic_agent.run(
                prompt + f" Generate exactly {gen_config.building_count} unique buildings.",
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
        """Finalize the draft and create production records (Phase 4)."""
        logger.info("Materializing shard for user %s, draft %s", user_id, draft_id)

        # Mark draft as processing
        await ForgeDraftService.update_draft(
            supabase, user_id, draft_id,
            ForgeDraftUpdate(status="processing"),
        )

        try:
            response = supabase.rpc("fn_materialize_shard", {"p_draft_id": str(draft_id)}).execute()
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
                except Exception as e:
                    logger.error("Theme application failed for %s: %s", sim_id, e)

            # Generate and persist lore + translations
            anchor = draft_data.get("philosophical_anchor", {}).get("selected", {})
            geography = draft_data.get("geography", {})
            agents = draft_data.get("agents", [])
            buildings = draft_data.get("buildings", [])
            seed = draft_data.get("seed_prompt", "")

            if settings.forge_mock_mode:
                logger.info("FORGE_MOCK_MODE: using mock lore + translations")
                try:
                    lore_sections = mock.mock_lore_sections(seed)
                    translations = mock.mock_lore_translations(lore_sections)
                    await ForgeLoreService.persist_lore(
                        write_client, sim_id, lore_sections, translations,
                    )
                except Exception as e:
                    logger.error("Mock lore persist failed for %s: %s", sim_id, e)

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
                except Exception as e:
                    logger.error("Mock entity translation failed for %s: %s", sim_id, e)
            else:
                or_key, _ = await ForgeOrchestratorService._get_user_keys(supabase, user_id)

                try:
                    lore_sections = await ForgeLoreService.generate_lore(
                        seed=seed,
                        anchor=anchor,
                        geography=geography,
                        agents=agents,
                        buildings=buildings,
                        openrouter_key=or_key,
                    )
                    # Translate lore to German
                    translations = None
                    try:
                        translations = await ForgeLoreService.translate_lore(
                            lore_sections, openrouter_key=or_key,
                        )
                    except Exception as e:
                        logger.error("Lore translation failed for %s: %s", sim_id, e)

                    await ForgeLoreService.persist_lore(
                        write_client, sim_id, lore_sections, translations,
                    )
                except Exception as e:
                    logger.error("Lore generation failed for %s: %s", sim_id, e)

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
                except Exception as e:
                    logger.error("Entity translation failed for %s: %s", sim_id, e)

            return {
                "simulation_id": sim_id,
                "slug": slug,
                "anchor": anchor,
                "seed_prompt": seed,
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error("SQL Materialization error: %s", e)
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
        logger.info("Generating theme for draft %s", draft_id)
        draft_data = await ForgeDraftService.get_draft(supabase, user_id, draft_id)
        seed = draft_data.get("seed_prompt", "")

        if settings.forge_mock_mode:
            logger.info("FORGE_MOCK_MODE: using mock theme")
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
        logger.info("Starting batch image generation for simulation %s", simulation_id)

        or_key, rep_key = await ForgeOrchestratorService._get_user_keys(supabase, user_id)

        image_service = ImageService(
            supabase,
            simulation_id,
            replicate_api_key=rep_key,
            openrouter_api_key=or_key,
        )

        # 1. Banner image (most visible on dashboard)
        sim_resp = (
            supabase.table("simulations")
            .select("name, description, slug")
            .eq("id", str(simulation_id))
            .single()
            .execute()
        )
        sim_data = sim_resp.data or {}

        try:
            await image_service.generate_banner_image(
                sim_name=sim_data.get("name", "Unknown"),
                sim_description=sim_data.get("description", ""),
                anchor_data=anchor_data,
            )
        except Exception as e:
            logger.error("Banner generation failed for simulation %s: %s", simulation_id, e)

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
            except Exception as e:
                logger.error("Batch gen failed for agent %s: %s", agent["id"], e)

        # 3. Building images
        buildings = (
            supabase.table("buildings")
            .select("id, name, description, building_type")
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        for building in buildings.data or []:
            try:
                await image_service.generate_building_image(
                    building_id=building["id"],
                    building_name=building["name"],
                    building_type=building["building_type"],
                    building_data={"description": building["description"]},
                )
            except Exception as e:
                logger.error("Batch gen failed for building %s: %s", building["id"], e)

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
            except Exception as e:
                logger.error("Lore image gen failed for section %s: %s", section["id"], e)

        logger.info("Batch generation completed for simulation %s", simulation_id)
