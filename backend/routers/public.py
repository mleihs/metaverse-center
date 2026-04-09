"""Public read-only endpoints — no authentication required.

Serves anonymous users via anon RLS policies.
Only GET endpoints for active simulation data.
Delegates to existing service layer where possible (keeps query logic in sync).
"""

import logging
from typing import Annotated
from uuid import UUID

import sentry_sdk
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from backend.dependencies import get_admin_supabase, get_anon_supabase, resolve_simulation_id
from backend.middleware.rate_limit import RATE_LIMIT_STANDARD, limiter
from backend.models.common import PaginatedResponse, SuccessResponse
from backend.models.gazette import GazetteEntry
from backend.services.agent_memory_service import AgentMemoryService
from backend.services.agent_service import AgentService
from backend.services.aptitude_service import AptitudeService
from backend.services.battle_log_service import BattleLogService
from backend.services.bleed_gazette_service import BleedGazetteService
from backend.services.building_service import BuildingService
from backend.services.cache_config import get_ttl
from backend.services.campaign_service import CampaignService
from backend.services.chat_service import ChatService
from backend.services.chronicle_service import ChronicleService
from backend.services.connection_service import ConnectionService
from backend.services.constants import (
    OPERATIVE_DEPLOY_CYCLES,
    OPERATIVE_MISSION_CYCLES,
    OPERATIVE_RP_COSTS,
    OPERATIVE_TARGET_TYPE,
    OPERATIVE_TYPE_COLORS,
)
from backend.services.dungeon_query_service import DungeonQueryService
from backend.services.echo_service import EchoService
from backend.services.embassy_service import EmbassyService
from backend.services.epoch_invitation_service import EpochInvitationService
from backend.services.epoch_service import EpochService
from backend.services.event_service import EventService
from backend.services.forge_lore_service import ForgeLoreService
from backend.services.forge_orchestrator_service import ForgeOrchestratorService
from backend.services.game_mechanics_service import GameMechanicsService
from backend.services.location_service import LocationService
from backend.services.platform_settings_service import PlatformSettingsService
from backend.services.relationship_service import RelationshipService
from backend.services.resonance_service import ResonanceService
from backend.services.scoring_service import ScoringService
from backend.services.settings_service import SettingsService
from backend.services.simulation_service import SimulationService
from backend.services.social_media_service import SocialMediaService
from backend.services.social_trends_service import SocialTrendsService
from backend.services.taxonomy_service import TaxonomyService
from backend.utils.responses import paginated
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Type alias: simulation path param that accepts UUID or slug, resolves to UUID.
SimId = Annotated[UUID, Depends(resolve_simulation_id)]

router = APIRouter(prefix="/api/v1/public", tags=["Public"])

RATE_LIMIT_PUBLIC = RATE_LIMIT_STANDARD  # 100/minute


# ── Helpers ─────────────────────────────────────────────────────────────


# ── Platform Stats ───────────────────────────────────────────────────────


@router.get("/platform-stats")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_platform_stats(request: Request, anon: Annotated[Client, Depends(get_anon_supabase)]) -> SuccessResponse:
    """Aggregated platform statistics for landing page."""
    try:
        data = await SimulationService.get_platform_stats(anon)
    except Exception:  # noqa: BLE001 — landing page must never show error; degrade to zeros
        logger.warning("Platform stats unavailable", exc_info=True)
        sentry_sdk.capture_exception()
        data = {"simulation_count": 0, "active_epoch_count": 0, "resonance_count": 0}
    return SuccessResponse(data=data)


# ── Simulations ──────────────────────────────────────────────────────────


@router.get("/simulations")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_simulations(
    request: Request,
    http_response: Response,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List all active template simulations (public). Excludes game instances."""
    max_age = get_ttl("cache_http_simulations_max_age")
    http_response.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate={max_age * 5}"
    try:
        data, total = await SimulationService.list_active_public(supabase, limit=limit, offset=offset)
        await SimulationService.enrich_with_counts(supabase, data)
    except Exception:  # noqa: BLE001 — public browsing must never produce errors; degrade to empty
        logger.warning("Public simulation list unavailable", exc_info=True)
        sentry_sdk.capture_exception()
        data, total = [], 0
    return paginated(data, total, limit, offset)


@router.get("/simulations/by-slug/{slug}/forge-progress")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_forge_progress(
    request: Request, slug: str, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Lightweight image-generation progress for the forge ceremony.

    Delegates to ``get_forge_progress(slug)`` Postgres function via
    ForgeOrchestratorService (single round-trip, all aggregation in PG).
    """
    data = await ForgeOrchestratorService.get_forge_progress(supabase, slug)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation not found.")
    return SuccessResponse(data=data)


@router.get("/simulations/{simulation_id}")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_simulation(
    request: Request, simulation_id: SimId, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get a single active simulation (public)."""
    sim = await SimulationService.get_active_by_id(supabase, simulation_id)
    if not sim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation not found.")
    data = [sim]
    await SimulationService.enrich_with_counts(supabase, data)
    return SuccessResponse(data=data[0])


# ── Bleed Status ────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/bleed-status")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_bleed_status(
    request: Request, simulation_id: SimId, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get aggregated bleed status for a simulation (public).

    Returns active bleeds, threshold state, and fracture warning for
    the palimpsest overlay and shattering UI features.
    """
    data = await GameMechanicsService.get_bleed_status(supabase, simulation_id)
    return SuccessResponse(data=data)


# ── Agents ───────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/agents")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_agents(
    request: Request,
    simulation_id: SimId,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    search: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List agents in a simulation (public)."""
    data, total = await AgentService.list(supabase, simulation_id, search=search, limit=limit, offset=offset)
    return paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/agents/by-slug/{slug}")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_agent_by_slug(
    request: Request, simulation_id: SimId, slug: str, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get a single agent by slug (public)."""
    data = await AgentService.get_by_slug(supabase, simulation_id, slug)
    return SuccessResponse(data=data)


@router.get("/simulations/{simulation_id}/agents/{agent_id}")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_agent(
    request: Request, simulation_id: SimId, agent_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get a single agent (public)."""
    data = await AgentService.get(supabase, simulation_id, agent_id)
    return SuccessResponse(data=data)


# ── Buildings ────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/buildings")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_buildings(
    request: Request,
    simulation_id: SimId,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    search: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List buildings in a simulation (public)."""
    data, total = await BuildingService.list(supabase, simulation_id, search=search, limit=limit, offset=offset)
    return paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/buildings/by-slug/{slug}")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_building_by_slug(
    request: Request, simulation_id: SimId, slug: str, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get a single building by slug (public)."""
    data = await BuildingService.get_by_slug(supabase, simulation_id, slug)
    return SuccessResponse(data=data)


@router.get("/simulations/{simulation_id}/buildings/{building_id}")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_building(
    request: Request, simulation_id: SimId, building_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get a single building (public)."""
    data = await BuildingService.get(supabase, simulation_id, building_id)
    return SuccessResponse(data=data)


# ── Events ───────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/events")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_events(
    request: Request,
    simulation_id: SimId,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    search: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List events in a simulation (public)."""
    data, total = await EventService.list(supabase, simulation_id, search=search, limit=limit, offset=offset)
    return paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/events/{event_id}")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_event(
    request: Request, simulation_id: SimId, event_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get a single event (public)."""
    data = await EventService.get(supabase, simulation_id, event_id)
    return SuccessResponse(data=data)


# ── Anchor ────────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/anchor")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_anchor(
    request: Request, simulation_id: SimId, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get philosophical anchor data (public)."""
    rows = await SettingsService.list_settings(supabase, simulation_id, category="anchor")
    data = {row["setting_key"]: row["setting_value"] for row in rows}
    return SuccessResponse(data=data)


# ── Lore ──────────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/lore/by-slug/{slug}")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_lore_by_slug(
    request: Request, simulation_id: SimId, slug: str, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get a single lore section by slug (public)."""
    data = await ForgeLoreService.get_by_slug(supabase, simulation_id, slug)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lore section not found.")
    return SuccessResponse(data=data)


@router.get("/simulations/{simulation_id}/lore")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_simulation_lore(
    request: Request, simulation_id: SimId, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get lore sections for a simulation (public)."""
    data = await ForgeLoreService.list_for_simulation(supabase, simulation_id)
    return SuccessResponse(data=data)


# ── Chronicles ────────────────────────────────────────────────────────────


@router.get("/chronicles")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_chronicles_global(
    request: Request,
    http_response: Response,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """Recent chronicles across all active simulations (public feed)."""
    max_age = get_ttl("cache_http_battle_feed_max_age")
    http_response.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate={max_age * 3}"
    data, total = await ChronicleService.list_all_recent(supabase, limit=limit, offset=offset)
    return paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/chronicles")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_chronicles_public(
    request: Request,
    simulation_id: SimId,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List chronicle editions (public)."""
    data, total = await ChronicleService.list(supabase, simulation_id, limit=limit, offset=offset)
    return paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/chronicles/{chronicle_id}")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_chronicle_public(
    request: Request, simulation_id: SimId, chronicle_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get a single chronicle edition (public)."""
    data = await ChronicleService.get(supabase, simulation_id, chronicle_id)
    return SuccessResponse(data=data)


# ── Agent Memories ────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/agents/{agent_id}/memories")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_agent_memories_public(
    request: Request,
    simulation_id: SimId,
    agent_id: UUID,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    memory_type: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List agent memories (public)."""
    data, total = await AgentMemoryService.list_memories(
        supabase, agent_id, simulation_id, memory_type=memory_type, limit=limit, offset=offset
    )
    return paginated(data, total, limit, offset)


# ── Locations ────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/locations/cities")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_cities(
    request: Request, simulation_id: SimId, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """List cities (public)."""
    data, _ = await LocationService.list_cities(supabase, simulation_id, limit=500)
    return SuccessResponse(data=data)


@router.get("/simulations/{simulation_id}/locations/cities/{city_id}")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_city(
    request: Request, simulation_id: SimId, city_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get a single city (public)."""
    data = await LocationService.get_city(supabase, simulation_id, city_id)
    return SuccessResponse(data=data)


@router.get("/simulations/{simulation_id}/locations/zones")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_zones(
    request: Request, simulation_id: SimId, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """List zones (public)."""
    data, _ = await LocationService.list_zones(supabase, simulation_id, limit=500)
    return SuccessResponse(data=data)


@router.get("/simulations/{simulation_id}/locations/zones/{zone_id}")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_zone(
    request: Request, simulation_id: SimId, zone_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get a single zone (public)."""
    data = await LocationService.get_zone(supabase, simulation_id, zone_id)
    return SuccessResponse(data=data)


@router.get("/simulations/{simulation_id}/locations/streets")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_streets(
    request: Request, simulation_id: SimId, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """List streets (public)."""
    data, _ = await LocationService.list_streets(supabase, simulation_id, limit=500)
    return SuccessResponse(data=data)


# ── Chat (read-only) ────────────────────────────────────────────────────
# Note: ChatService.list_conversations requires user_id (filters by owner).
# Public endpoint lists ALL conversations — kept as inline query.


@router.get("/simulations/{simulation_id}/chat/conversations")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_conversations(
    request: Request, simulation_id: SimId, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """List chat conversations (public, read-only)."""
    data = await ChatService.list_conversations_public(supabase, simulation_id)
    return SuccessResponse(data=data)


@router.get("/simulations/{simulation_id}/chat/conversations/{conversation_id}/messages")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_messages(
    request: Request,
    simulation_id: SimId,
    conversation_id: UUID,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List messages in a conversation (public, read-only)."""
    data, total = await ChatService.list_messages_public(supabase, conversation_id, limit=limit, offset=offset)
    return paginated(data, total, limit, offset)


# ── Taxonomies ───────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/taxonomies")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_taxonomies(
    request: Request,
    simulation_id: SimId,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    taxonomy_type: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 500,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List taxonomies (public)."""
    data, total = await TaxonomyService.list_taxonomiespaginated(
        supabase, simulation_id, taxonomy_type=taxonomy_type, limit=limit, offset=offset
    )
    return paginated(data, total, limit, offset)


# ── Settings (design category only) ─────────────────────────────────────


@router.get("/simulations/{simulation_id}/settings")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_settings(
    request: Request, simulation_id: SimId, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """List design settings only (public — for theming)."""
    data = await SettingsService.list_settings(supabase, simulation_id, category="design")
    return SuccessResponse(data=data)


# ── Social ───────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/social-trends")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_social_trends(
    request: Request,
    simulation_id: SimId,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List social trends (public)."""
    data, total = await SocialTrendsService.list_trends(supabase, simulation_id, limit=limit, offset=offset)
    return paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/social-media")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_social_posts(
    request: Request,
    simulation_id: SimId,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List social media posts (public)."""
    data, total = await SocialMediaService.list_posts(supabase, simulation_id, limit=limit, offset=offset)
    return paginated(data, total, limit, offset)


# ── Campaigns ────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/campaigns")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_campaigns(
    request: Request,
    simulation_id: SimId,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List campaigns (public)."""
    data, total = await CampaignService.list_campaigns(supabase, simulation_id, limit=limit, offset=offset)
    return paginated(data, total, limit, offset)


# ── Agent Relationships ─────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/agents/{agent_id}/relationships")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_agent_relationships(
    request: Request, simulation_id: SimId, agent_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """List relationships for a specific agent (public)."""
    data = await RelationshipService.list_for_agent(supabase, simulation_id, agent_id)
    return SuccessResponse(data=data)


@router.get("/simulations/{simulation_id}/agents/{agent_id}/aptitudes")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_agent_aptitudes(
    request: Request, simulation_id: SimId, agent_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get aptitude scores for a specific agent (public)."""
    data = await AptitudeService.get_for_agent(supabase, simulation_id, agent_id)
    return SuccessResponse(data=data)


@router.get("/simulations/{simulation_id}/aptitudes")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_simulation_aptitudes(
    request: Request, simulation_id: SimId, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get all aptitude scores for all agents in a simulation (public)."""
    data = await AptitudeService.get_all_for_simulation(supabase, simulation_id)
    return SuccessResponse(data=data)


@router.get("/simulations/{simulation_id}/relationships")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_simulation_relationships(
    request: Request,
    simulation_id: SimId,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List all relationships in a simulation (public)."""
    data, total = await RelationshipService.list_for_simulation(supabase, simulation_id, limit=limit, offset=offset)
    return paginated(data, total, limit, offset)


# ── Event Echoes ────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/echoes")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_echoes(
    request: Request,
    simulation_id: SimId,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List incoming echoes for a simulation (public)."""
    data, total = await EchoService.list_for_simulation(
        supabase, simulation_id, direction="incoming", limit=limit, offset=offset
    )
    return paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/events/{event_id}/echoes")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_event_echoes(
    request: Request, simulation_id: SimId, event_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """List echoes for a specific event (public)."""
    data = await EchoService.list_for_event(supabase, event_id)
    return SuccessResponse(data=data)


# ── Simulation Connections & Map Data ───────────────────────────────────


@router.get("/connections")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_connections(
    request: Request, http_response: Response, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """List all active simulation connections (public, for map)."""
    max_age = get_ttl("cache_http_connections_max_age")
    http_response.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate={max_age * 5}"
    data = await ConnectionService.list_all(supabase, active_only=True)
    return SuccessResponse(data=data)


@router.get("/map-data")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_map_data(
    request: Request, http_response: Response, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Aggregated endpoint for Cartographer's Map — simulations + connections + echo counts."""
    max_age = get_ttl("cache_http_map_data_max_age")
    http_response.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate={max_age * 4}"
    data = await ConnectionService.get_map_data(supabase)
    return SuccessResponse(data=data)


# ── Battle Feed ────────────────────────────────────────────────────────


@router.get("/battle-feed")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_battle_feed(
    request: Request,
    http_response: Response,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> SuccessResponse:
    """Global public battle feed across all active epochs."""
    max_age = get_ttl("cache_http_battle_feed_max_age")
    http_response.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate={max_age * 3}"
    data = await BattleLogService.get_global_public_feed(supabase, limit=limit)
    return SuccessResponse(data=data)


# ── Bleed Gazette ──────────────────────────────────────────────────────


@router.get("/bleed-gazette")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_bleed_gazette(
    request: Request,
    http_response: Response,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> SuccessResponse[list[GazetteEntry]]:
    """Bleed Gazette — multiverse news wire (public, no auth)."""
    max_age = get_ttl("cache_http_battle_feed_max_age")
    http_response.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate={max_age * 3}"
    data = await BleedGazetteService.get_feed(supabase, limit=limit)
    return SuccessResponse(data=data)


# ── Embassies ──────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/embassies")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_embassies(
    request: Request,
    simulation_id: SimId,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List active embassies for a simulation (public)."""
    data, total = await EmbassyService.list_for_simulation(
        supabase, simulation_id, status_filter="active", limit=limit, offset=offset
    )
    return paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/embassies/{embassy_id}")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_embassy(
    request: Request, simulation_id: SimId, embassy_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get a single embassy (public)."""
    data = await EmbassyService.get(supabase, embassy_id)
    return SuccessResponse(data=data)


@router.get("/simulations/{simulation_id}/buildings/{building_id}/embassy")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_building_embassy(
    request: Request, simulation_id: SimId, building_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get the embassy linked to a building (public)."""
    data = await EmbassyService.get_for_building(supabase, building_id)
    return SuccessResponse(data=data)


@router.get("/embassies")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_all_embassies(
    request: Request, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """List all active embassies across all simulations (public, for map)."""
    data = await EmbassyService.list_all_active(supabase)
    return SuccessResponse(data=data)


# ── Game Mechanics (Health Dashboard) ─────────────────────────────────


@router.get("/simulations/{simulation_id}/health")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_simulation_health_dashboard(
    request: Request, simulation_id: SimId, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Full health dashboard for a simulation (public)."""
    data = await GameMechanicsService.get_health_dashboard(supabase, simulation_id)
    return SuccessResponse(data=data)


@router.get("/simulations/{simulation_id}/health/buildings")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_building_readiness(
    request: Request,
    simulation_id: SimId,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    zone_id: Annotated[UUID | None, Query()] = None,
    order_by: Annotated[str, Query()] = "readiness",
    order_asc: Annotated[bool, Query()] = True,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List building readiness for a simulation (public)."""
    data, total = await GameMechanicsService.list_building_readiness(
        supabase, simulation_id, zone_id=zone_id, order_by=order_by, order_asc=order_asc, limit=limit, offset=offset
    )
    return paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/health/zones")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_zone_stability(
    request: Request, simulation_id: SimId, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """List zone stability for a simulation (public)."""
    data = await GameMechanicsService.list_zone_stability(supabase, simulation_id)
    return SuccessResponse(data=data)


@router.get("/simulations/{simulation_id}/health/embassies")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_embassy_effectiveness(
    request: Request, simulation_id: SimId, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """List embassy effectiveness for a simulation (public)."""
    data = await GameMechanicsService.list_embassy_effectiveness(supabase, simulation_id)
    return SuccessResponse(data=data)


@router.get("/health/all")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_all_simulations_health(
    request: Request, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Health metrics for all simulations (public, for map/dashboard)."""
    data = await GameMechanicsService.list_simulation_health(supabase)
    return SuccessResponse(data=data)


# ── Epochs (Public) ─────────────────────────────────────────────────────


@router.get("/epochs")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_epochs_public(
    request: Request,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List all epochs (public)."""
    data, total = await EpochService.list_epochs(supabase, status_filter=status_filter, limit=limit, offset=offset)
    return paginated(data, total, limit, offset)


@router.get("/epochs/active")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_active_epochs_public(
    request: Request, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get all active epochs — lobby + running (public)."""
    data = await EpochService.get_active_epochs(supabase)
    return SuccessResponse(data=data)


@router.get("/epochs/{epoch_id}")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_epoch_public(
    request: Request, epoch_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get a single epoch (public)."""
    data = await EpochService.get(supabase, epoch_id)
    return SuccessResponse(data=data)


@router.get("/epochs/{epoch_id}/participants")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_epoch_participants_public(
    request: Request, epoch_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """List epoch participants (public)."""
    data = await EpochService.list_participants(supabase, epoch_id)
    return SuccessResponse(data=data)


@router.get("/epochs/{epoch_id}/teams")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_epoch_teams_public(
    request: Request, epoch_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """List epoch teams (public)."""
    data = await EpochService.list_teams(supabase, epoch_id)
    return SuccessResponse(data=data)


# ── Leaderboard (Public) ───────────────────────────────────────────────


@router.get("/epochs/{epoch_id}/leaderboard")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_leaderboard_public(
    request: Request,
    epoch_id: UUID,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    cycle: Annotated[int | None, Query()] = None,
) -> SuccessResponse:
    """Get epoch leaderboard (public spectator view)."""
    data = await ScoringService.get_leaderboard(supabase, epoch_id, cycle_number=cycle)
    return SuccessResponse(data=data)


@router.get("/epochs/{epoch_id}/standings")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_standings_public(
    request: Request, epoch_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get final standings for a completed epoch (public)."""
    data = await ScoringService.get_final_standings(supabase, epoch_id)
    return SuccessResponse(data=data)


# ── Battle Log (Public) ────────────────────────────────────────────────


@router.get("/epochs/{epoch_id}/battle-log")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_battle_log_public(
    request: Request,
    epoch_id: UUID,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    event_type: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """Get public battle log entries (spectator view)."""
    data, total = await BattleLogService.get_public_feed(supabase, epoch_id, limit=limit, offset=offset)
    return paginated(data, total, limit, offset)


# ── Substrate Resonances (Public) ──────────────────────────────────


@router.get("/resonances")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_resonances_public(
    request: Request,
    http_response: Response,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    signature: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """List substrate resonances (public)."""
    max_age = get_ttl("cache_http_battle_feed_max_age")
    http_response.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate={max_age * 3}"
    data, total = await ResonanceService.list(
        supabase, status_filter=status_filter, signature=signature, limit=limit, offset=offset
    )
    return paginated(data, total, limit, offset)


@router.get("/resonances/{resonance_id}")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_resonance_public(
    request: Request, resonance_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Get a single resonance (public)."""
    data = await ResonanceService.get(supabase, resonance_id)
    return SuccessResponse(data=data)


@router.get("/resonances/{resonance_id}/impacts")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_resonance_impacts_public(
    request: Request, resonance_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """List impact records for a resonance (public)."""
    data = await ResonanceService.list_impacts(supabase, resonance_id)
    return SuccessResponse(data=data)


# ── Game Metadata (Public) ───────────────────────────────────────────


@router.get("/operative-types")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_operative_types(request: Request) -> SuccessResponse:
    """Operative type metadata: costs, colors, durations, target requirements."""
    types = []
    for op_type in OPERATIVE_RP_COSTS:
        types.append(
            {
                "type": op_type,
                "cost_rp": OPERATIVE_RP_COSTS[op_type],
                "color": OPERATIVE_TYPE_COLORS.get(op_type, "#6b7280"),
                "deploy_cycles": OPERATIVE_DEPLOY_CYCLES.get(op_type, 1),
                "mission_cycles": OPERATIVE_MISSION_CYCLES.get(op_type, 1),
                "needs_target": OPERATIVE_TARGET_TYPE.get(op_type, "none"),
            }
        )
    return SuccessResponse(data=types)


# ── Epoch Invitations (Public) ──────────────────────────────────────


@router.get("/epoch-invitations/{token}")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def validate_epoch_invitation(
    request: Request, token: str, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Validate an epoch invitation token and return epoch info + lore."""
    data = await EpochInvitationService.validate_token(supabase, token)
    return SuccessResponse(data=data)


# ── Resonance Dungeons (Public) ───────────────────────────────────────


@router.get("/simulations/{simulation_id}/dungeons/history")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def public_dungeon_history(
    request: Request,
    simulation_id: SimId,
    supabase: Annotated[Client, Depends(get_anon_supabase)],
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse:
    """Public: list completed dungeon runs for a simulation."""
    data, meta = await DungeonQueryService.list_history_public(supabase, simulation_id, limit=limit, offset=offset)
    return PaginatedResponse(data=data, meta=meta)


@router.get("/dungeons/runs/{run_id}")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def public_dungeon_run(
    request: Request, run_id: UUID, supabase: Annotated[Client, Depends(get_anon_supabase)]
) -> SuccessResponse:
    """Public: get a completed dungeon run detail."""
    data = await DungeonQueryService.get_run_public(supabase, run_id)
    return SuccessResponse(data=data)


@router.get("/dungeons/clearance-config")
@limiter.limit(RATE_LIMIT_PUBLIC)
async def public_dungeon_clearance_config(
    request: Request, admin_supabase: Annotated[Client, Depends(get_admin_supabase)]
) -> SuccessResponse:
    """Public: get global dungeon clearance configuration.

    Returns the admin-configured clearance mode and threshold so the
    terminal can decide whether to enforce tier-gating on dungeon commands.
    Uses admin client because platform_settings has no anon RLS policy.
    Only exposes clearance settings — never override archetypes.
    """
    config = await PlatformSettingsService.get_dungeon_clearance_config(admin_supabase)
    return SuccessResponse(data=dict(config))
