"""Public read-only endpoints — no authentication required.

Serves anonymous users via anon RLS policies.
Only GET endpoints for active simulation data.
Delegates to existing service layer where possible (keeps query logic in sync).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from backend.dependencies import get_anon_supabase
from backend.middleware.rate_limit import RATE_LIMIT_STANDARD, limiter
from backend.models.common import PaginatedResponse, PaginationMeta, SuccessResponse
from backend.services.agent_service import AgentService
from backend.services.bleed_gazette_service import BleedGazetteService
from backend.services.agent_memory_service import AgentMemoryService
from backend.services.chat_service import ChatService
from backend.services.chronicle_service import ChronicleService
from backend.services.aptitude_service import AptitudeService
from backend.services.battle_log_service import BattleLogService
from backend.services.building_service import BuildingService
from backend.services.cache_config import get_ttl
from backend.services.campaign_service import CampaignService
from backend.services.connection_service import ConnectionService
from backend.services.echo_service import EchoService
from backend.services.embassy_service import EmbassyService
from backend.services.epoch_invitation_service import EpochInvitationService
from backend.services.epoch_service import EpochService
from backend.services.event_service import EventService
from backend.services.forge_lore_service import ForgeLoreService
from backend.services.forge_orchestrator_service import ForgeOrchestratorService
from backend.services.resonance_service import ResonanceService
from backend.services.game_mechanics_service import GameMechanicsService
from backend.services.location_service import LocationService
from backend.services.relationship_service import RelationshipService
from backend.services.constants import (
    OPERATIVE_DEPLOY_CYCLES,
    OPERATIVE_MISSION_CYCLES,
    OPERATIVE_RP_COSTS,
    OPERATIVE_TARGET_TYPE,
    OPERATIVE_TYPE_COLORS,
)
from backend.services.scoring_service import ScoringService
from backend.services.settings_service import SettingsService
from backend.services.simulation_service import SimulationService
from backend.services.social_media_service import SocialMediaService
from backend.services.social_trends_service import SocialTrendsService
from backend.services.taxonomy_service import TaxonomyService
from supabase import Client

router = APIRouter(prefix="/api/v1/public", tags=["Public"])

RATE_LIMIT_PUBLIC = RATE_LIMIT_STANDARD  # 100/minute


# ── Helpers ─────────────────────────────────────────────────────────────


def _paginated(data: list[dict], total: int, limit: int, offset: int) -> dict:
    """Build a standard paginated response dict."""
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


# ── Platform Stats ───────────────────────────────────────────────────────


@router.get("/platform-stats", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_platform_stats(
    request: Request,
    anon: Client = Depends(get_anon_supabase),
) -> dict:
    """Aggregated platform statistics for landing page."""
    data = await SimulationService.get_platform_stats(anon)
    return {"success": True, "data": data}


# ── Simulations ──────────────────────────────────────────────────────────


@router.get("/simulations", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_simulations(
    request: Request,
    http_response: Response,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List all active template simulations (public). Excludes game instances."""
    max_age = get_ttl("cache_http_simulations_max_age")
    http_response.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate={max_age * 5}"
    data, total = await SimulationService.list_active_public(supabase, limit=limit, offset=offset)
    SimulationService.enrich_with_counts(supabase, data)
    return _paginated(data, total, limit, offset)


@router.get("/simulations/by-slug/{slug}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_simulation_by_slug(
    request: Request,
    slug: str,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single active simulation by its slug (public)."""
    sim = await SimulationService.get_by_slug(supabase, slug)
    if not sim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation not found.")
    data = [sim]
    SimulationService.enrich_with_counts(supabase, data)
    return {"success": True, "data": data[0]}


@router.get("/simulations/by-slug/{slug}/forge-progress", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_forge_progress(
    request: Request,
    slug: str,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Lightweight image-generation progress for the forge ceremony.

    Delegates to ``get_forge_progress(slug)`` Postgres function via
    ForgeOrchestratorService (single round-trip, all aggregation in PG).
    """
    data = await ForgeOrchestratorService.get_forge_progress(supabase, slug)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation not found.")
    return {"success": True, "data": data}


@router.get("/simulations/{simulation_id}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_simulation(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single active simulation (public)."""
    sim = await SimulationService.get_active_by_id(supabase, simulation_id)
    if not sim:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation not found.")
    data = [sim]
    SimulationService.enrich_with_counts(supabase, data)
    return {"success": True, "data": data[0]}


# ── Bleed Status ────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/bleed-status", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_bleed_status(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get aggregated bleed status for a simulation (public).

    Returns active bleeds, threshold state, and fracture warning for
    the palimpsest overlay and shattering UI features.
    """
    data = await GameMechanicsService.get_bleed_status(supabase, simulation_id)
    return {"success": True, "data": data}


# ── Agents ───────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/agents", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_agents(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    search: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List agents in a simulation (public)."""
    data, total = await AgentService.list(
        supabase, simulation_id, search=search, limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/agents/{agent_id}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_agent(
    request: Request,
    simulation_id: UUID,
    agent_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single agent (public)."""
    data = await AgentService.get(supabase, simulation_id, agent_id)
    return {"success": True, "data": data}


# ── Buildings ────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/buildings", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_buildings(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    search: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List buildings in a simulation (public)."""
    data, total = await BuildingService.list(
        supabase, simulation_id, search=search, limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/buildings/{building_id}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_building(
    request: Request,
    simulation_id: UUID,
    building_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single building (public)."""
    data = await BuildingService.get(supabase, simulation_id, building_id)
    return {"success": True, "data": data}


# ── Events ───────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/events", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_events(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    search: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List events in a simulation (public)."""
    data, total = await EventService.list(
        supabase, simulation_id, search=search, limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/events/{event_id}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_event(
    request: Request,
    simulation_id: UUID,
    event_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single event (public)."""
    data = await EventService.get(supabase, simulation_id, event_id)
    return {"success": True, "data": data}


# ── Lore ──────────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/lore", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_simulation_lore(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get lore sections for a simulation (public)."""
    data = await ForgeLoreService.list_for_simulation(supabase, simulation_id)
    return {"success": True, "data": data}


# ── Chronicles ────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/chronicles", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_chronicles_public(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List chronicle editions (public)."""
    data, total = await ChronicleService.list(supabase, simulation_id, limit=limit, offset=offset)
    return _paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/chronicles/{chronicle_id}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_chronicle_public(
    request: Request,
    simulation_id: UUID,
    chronicle_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single chronicle edition (public)."""
    data = await ChronicleService.get(supabase, simulation_id, chronicle_id)
    return {"success": True, "data": data}


# ── Agent Memories ────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/agents/{agent_id}/memories", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_agent_memories_public(
    request: Request,
    simulation_id: UUID,
    agent_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    memory_type: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List agent memories (public)."""
    data, total = await AgentMemoryService.list_memories(
        supabase, agent_id, simulation_id,
        memory_type=memory_type, limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


# ── Locations ────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/locations/cities", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_cities(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List cities (public)."""
    data, _ = await LocationService.list_cities(supabase, simulation_id, limit=500)
    return {"success": True, "data": data}


@router.get(
    "/simulations/{simulation_id}/locations/cities/{city_id}",
    response_model=SuccessResponse,
)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_city(
    request: Request,
    simulation_id: UUID,
    city_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single city (public)."""
    data = await LocationService.get_city(supabase, simulation_id, city_id)
    return {"success": True, "data": data}


@router.get("/simulations/{simulation_id}/locations/zones", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_zones(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List zones (public)."""
    data, _ = await LocationService.list_zones(supabase, simulation_id, limit=500)
    return {"success": True, "data": data}


@router.get(
    "/simulations/{simulation_id}/locations/zones/{zone_id}",
    response_model=SuccessResponse,
)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_zone(
    request: Request,
    simulation_id: UUID,
    zone_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single zone (public)."""
    data = await LocationService.get_zone(supabase, simulation_id, zone_id)
    return {"success": True, "data": data}


@router.get("/simulations/{simulation_id}/locations/streets", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_streets(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List streets (public)."""
    data, _ = await LocationService.list_streets(supabase, simulation_id, limit=500)
    return {"success": True, "data": data}


# ── Chat (read-only) ────────────────────────────────────────────────────
# Note: ChatService.list_conversations requires user_id (filters by owner).
# Public endpoint lists ALL conversations — kept as inline query.


@router.get("/simulations/{simulation_id}/chat/conversations", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_conversations(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List chat conversations (public, read-only)."""
    data = await ChatService.list_conversations_public(supabase, simulation_id)
    return {"success": True, "data": data}


@router.get(
    "/simulations/{simulation_id}/chat/conversations/{conversation_id}/messages",
    response_model=PaginatedResponse,
)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_messages(
    request: Request,
    simulation_id: UUID,
    conversation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List messages in a conversation (public, read-only)."""
    data, total = await ChatService.list_messages_public(supabase, conversation_id, limit=limit, offset=offset)
    return _paginated(data, total, limit, offset)


# ── Taxonomies ───────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/taxonomies", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_taxonomies(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    taxonomy_type: str | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List taxonomies (public)."""
    data, total = await TaxonomyService.list_taxonomies_paginated(
        supabase, simulation_id, taxonomy_type=taxonomy_type, limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


# ── Settings (design category only) ─────────────────────────────────────


@router.get("/simulations/{simulation_id}/settings", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_settings(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List design settings only (public — for theming)."""
    data = await SettingsService.list_settings(supabase, simulation_id, category="design")
    return {"success": True, "data": data}


# ── Social ───────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/social-trends", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_social_trends(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List social trends (public)."""
    data, total = await SocialTrendsService.list_trends(
        supabase, simulation_id, limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/social-media", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_social_posts(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List social media posts (public)."""
    data, total = await SocialMediaService.list_posts(
        supabase, simulation_id, limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


# ── Campaigns ────────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/campaigns", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_campaigns(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List campaigns (public)."""
    data, total = await CampaignService.list_campaigns(
        supabase, simulation_id, limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


# ── Agent Relationships ─────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/agents/{agent_id}/relationships", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_agent_relationships(
    request: Request,
    simulation_id: UUID,
    agent_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List relationships for a specific agent (public)."""
    data = await RelationshipService.list_for_agent(supabase, simulation_id, agent_id)
    return {"success": True, "data": data}


@router.get("/simulations/{simulation_id}/agents/{agent_id}/aptitudes", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_agent_aptitudes(
    request: Request,
    simulation_id: UUID,
    agent_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get aptitude scores for a specific agent (public)."""
    data = await AptitudeService.get_for_agent(supabase, simulation_id, agent_id)
    return {"success": True, "data": data}


@router.get("/simulations/{simulation_id}/aptitudes", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_simulation_aptitudes(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get all aptitude scores for all agents in a simulation (public)."""
    data = await AptitudeService.get_all_for_simulation(supabase, simulation_id)
    return {"success": True, "data": data}


@router.get("/simulations/{simulation_id}/relationships", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_simulation_relationships(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List all relationships in a simulation (public)."""
    data, total = await RelationshipService.list_for_simulation(
        supabase, simulation_id, limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


# ── Event Echoes ────────────────────────────────────────────────────────


@router.get("/simulations/{simulation_id}/echoes", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_echoes(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List incoming echoes for a simulation (public)."""
    data, total = await EchoService.list_for_simulation(
        supabase, simulation_id, direction="incoming", limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/events/{event_id}/echoes", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_event_echoes(
    request: Request,
    simulation_id: UUID,
    event_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List echoes for a specific event (public)."""
    data = await EchoService.list_for_event(supabase, event_id)
    return {"success": True, "data": data}


# ── Simulation Connections & Map Data ───────────────────────────────────


@router.get("/connections", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_connections(
    request: Request,
    http_response: Response,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List all active simulation connections (public, for map)."""
    max_age = get_ttl("cache_http_connections_max_age")
    http_response.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate={max_age * 5}"
    data = await ConnectionService.list_all(supabase, active_only=True)
    return {"success": True, "data": data}


@router.get("/map-data", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_map_data(
    request: Request,
    http_response: Response,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Aggregated endpoint for Cartographer's Map — simulations + connections + echo counts."""
    max_age = get_ttl("cache_http_map_data_max_age")
    http_response.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate={max_age * 4}"
    data = await ConnectionService.get_map_data(supabase)
    return {"success": True, "data": data}


# ── Battle Feed ────────────────────────────────────────────────────────


@router.get("/battle-feed", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_battle_feed(
    request: Request,
    http_response: Response,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=20, ge=1, le=50),
) -> dict:
    """Global public battle feed across all active epochs."""
    max_age = get_ttl("cache_http_battle_feed_max_age")
    http_response.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate={max_age * 3}"
    data = await BattleLogService.get_global_public_feed(supabase, limit=limit)
    return {"success": True, "data": data}


# ── Bleed Gazette ──────────────────────────────────────────────────────


@router.get("/bleed-gazette", response_model=SuccessResponse[list])
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_bleed_gazette(
    request: Request,
    http_response: Response,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=20, ge=1, le=50),
) -> dict:
    """Bleed Gazette — multiverse news wire (public, no auth)."""
    max_age = get_ttl("cache_http_battle_feed_max_age")
    http_response.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate={max_age * 3}"
    data = await BleedGazetteService.get_feed(supabase, limit=limit)
    return {"success": True, "data": data}


# ── Embassies ──────────────────────────────────────────────────────────

@router.get("/simulations/{simulation_id}/embassies", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_embassies(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List active embassies for a simulation (public)."""
    data, total = await EmbassyService.list_for_simulation(
        supabase, simulation_id, status_filter="active",
        limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/embassies/{embassy_id}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_embassy(
    request: Request,
    simulation_id: UUID,
    embassy_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single embassy (public)."""
    data = await EmbassyService.get(supabase, embassy_id)
    return {"success": True, "data": data}


@router.get("/simulations/{simulation_id}/buildings/{building_id}/embassy", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_building_embassy(
    request: Request,
    simulation_id: UUID,
    building_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get the embassy linked to a building (public)."""
    data = await EmbassyService.get_for_building(supabase, building_id)
    return {"success": True, "data": data}


@router.get("/embassies", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_all_embassies(
    request: Request,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List all active embassies across all simulations (public, for map)."""
    data = await EmbassyService.list_all_active(supabase)
    return {"success": True, "data": data}


# ── Game Mechanics (Health Dashboard) ─────────────────────────────────


@router.get("/simulations/{simulation_id}/health", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_simulation_health_dashboard(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Full health dashboard for a simulation (public)."""
    data = await GameMechanicsService.get_health_dashboard(supabase, simulation_id)
    return {"success": True, "data": data}


@router.get("/simulations/{simulation_id}/health/buildings", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_building_readiness(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    zone_id: UUID | None = Query(default=None),
    order_by: str = Query(default="readiness"),
    order_asc: bool = Query(default=True),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List building readiness for a simulation (public)."""
    data, total = await GameMechanicsService.list_building_readiness(
        supabase, simulation_id,
        zone_id=zone_id, order_by=order_by, order_asc=order_asc,
        limit=limit, offset=offset,
    )
    return _paginated(data, total, limit, offset)


@router.get("/simulations/{simulation_id}/health/zones", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_zone_stability(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List zone stability for a simulation (public)."""
    data = await GameMechanicsService.list_zone_stability(supabase, simulation_id)
    return {"success": True, "data": data}


@router.get("/simulations/{simulation_id}/health/embassies", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_embassy_effectiveness(
    request: Request,
    simulation_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List embassy effectiveness for a simulation (public)."""
    data = await GameMechanicsService.list_embassy_effectiveness(supabase, simulation_id)
    return {"success": True, "data": data}


@router.get("/health/all", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_all_simulations_health(
    request: Request,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Health metrics for all simulations (public, for map/dashboard)."""
    data = await GameMechanicsService.list_simulation_health(supabase)
    return {"success": True, "data": data}


# ── Epochs (Public) ─────────────────────────────────────────────────────


@router.get("/epochs", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_epochs_public(
    request: Request,
    supabase: Client = Depends(get_anon_supabase),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List all epochs (public)."""
    data, total = await EpochService.list_epochs(
        supabase, status_filter=status_filter, limit=limit, offset=offset
    )
    return _paginated(data, total, limit, offset)


@router.get("/epochs/active", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_active_epochs_public(
    request: Request,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get all active epochs — lobby + running (public)."""
    data = await EpochService.get_active_epochs(supabase)
    return {"success": True, "data": data}


@router.get("/epochs/{epoch_id}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_epoch_public(
    request: Request,
    epoch_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single epoch (public)."""
    data = await EpochService.get(supabase, epoch_id)
    return {"success": True, "data": data}


@router.get("/epochs/{epoch_id}/participants", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_epoch_participants_public(
    request: Request,
    epoch_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List epoch participants (public)."""
    data = await EpochService.list_participants(supabase, epoch_id)
    return {"success": True, "data": data}


@router.get("/epochs/{epoch_id}/teams", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_epoch_teams_public(
    request: Request,
    epoch_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List epoch teams (public)."""
    data = await EpochService.list_teams(supabase, epoch_id)
    return {"success": True, "data": data}


# ── Leaderboard (Public) ───────────────────────────────────────────────


@router.get("/epochs/{epoch_id}/leaderboard", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_leaderboard_public(
    request: Request,
    epoch_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    cycle: int | None = Query(default=None),
) -> dict:
    """Get epoch leaderboard (public spectator view)."""
    data = await ScoringService.get_leaderboard(supabase, epoch_id, cycle_number=cycle)
    return {"success": True, "data": data}


@router.get("/epochs/{epoch_id}/standings", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_standings_public(
    request: Request,
    epoch_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get final standings for a completed epoch (public)."""
    data = await ScoringService.get_final_standings(supabase, epoch_id)
    return {"success": True, "data": data}


# ── Battle Log (Public) ────────────────────────────────────────────────


@router.get("/epochs/{epoch_id}/battle-log", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_battle_log_public(
    request: Request,
    epoch_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
    event_type: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """Get public battle log entries (spectator view)."""
    data, total = await BattleLogService.get_public_feed(
        supabase, epoch_id, limit=limit, offset=offset
    )
    return _paginated(data, total, limit, offset)


# ── Substrate Resonances (Public) ──────────────────────────────────


@router.get("/resonances", response_model=PaginatedResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_resonances_public(
    request: Request,
    http_response: Response,
    supabase: Client = Depends(get_anon_supabase),
    status_filter: str | None = Query(default=None, alias="status"),
    signature: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List substrate resonances (public)."""
    max_age = get_ttl("cache_http_battle_feed_max_age")
    http_response.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate={max_age * 3}"
    data, total = await ResonanceService.list(
        supabase,
        status_filter=status_filter,
        signature=signature,
        limit=limit,
        offset=offset,
    )
    return _paginated(data, total, limit, offset)


@router.get("/resonances/{resonance_id}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_resonance_public(
    request: Request,
    resonance_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Get a single resonance (public)."""
    data = await ResonanceService.get(supabase, resonance_id)
    return {"success": True, "data": data}


@router.get("/resonances/{resonance_id}/impacts", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def list_resonance_impacts_public(
    request: Request,
    resonance_id: UUID,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """List impact records for a resonance (public)."""
    data = await ResonanceService.list_impacts(supabase, resonance_id)
    return {"success": True, "data": data}


# ── Game Metadata (Public) ───────────────────────────────────────────


@router.get("/operative-types", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def get_operative_types(request: Request) -> dict:
    """Operative type metadata: costs, colors, durations, target requirements."""
    types = []
    for op_type in OPERATIVE_RP_COSTS:
        types.append({
            "type": op_type,
            "cost_rp": OPERATIVE_RP_COSTS[op_type],
            "color": OPERATIVE_TYPE_COLORS.get(op_type, "#6b7280"),
            "deploy_cycles": OPERATIVE_DEPLOY_CYCLES.get(op_type, 1),
            "mission_cycles": OPERATIVE_MISSION_CYCLES.get(op_type, 1),
            "needs_target": OPERATIVE_TARGET_TYPE.get(op_type, "none"),
        })
    return {"success": True, "data": types}


# ── Epoch Invitations (Public) ──────────────────────────────────────


@router.get("/epoch-invitations/{token}", response_model=SuccessResponse)
@limiter.limit(RATE_LIMIT_PUBLIC)
async def validate_epoch_invitation(
    request: Request,
    token: str,
    supabase: Client = Depends(get_anon_supabase),
) -> dict:
    """Validate an epoch invitation token and return epoch info + lore."""
    data = await EpochInvitationService.validate_token(supabase, token)
    return {"success": True, "data": data}
