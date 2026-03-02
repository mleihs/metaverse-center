"""Social trends endpoints — fetch, transform, and integrate as events."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.middleware.rate_limit import RATE_LIMIT_AI_GENERATION, RATE_LIMIT_EXTERNAL_API, limiter
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.social import SocialTrendResponse
from backend.models.social_trend import (
    BrowseArticlesRequest,
    FetchTrendsRequest,
    IntegrateArticleRequest,
    IntegrateTrendRequest,
    TransformArticleRequest,
    TransformTrendRequest,
)
from backend.services.audit_service import AuditService
from backend.services.base_service import serialize_for_json
from backend.services.event_service import EventService
from backend.services.external.guardian import GuardianService
from backend.services.external.newsapi import NewsAPIService
from backend.services.external_service_resolver import ExternalServiceResolver
from backend.services.generation_service import GenerationService
from backend.services.social_trends_service import SocialTrendsService
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/social-trends",
    tags=["social-trends"],
)


async def _resolve_news_service(
    resolver: ExternalServiceResolver,
    source: str,
) -> GuardianService | NewsAPIService:
    """Resolve and instantiate the appropriate external news service."""
    if source == "guardian":
        config = await resolver.get_guardian_config()
        if not config:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Guardian API not configured for this simulation.",
            )
        return GuardianService(config.api_key)

    if source == "newsapi":
        config = await resolver.get_newsapi_config()
        if not config:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="NewsAPI not configured for this simulation.",
            )
        return NewsAPIService(config.api_key)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unknown source: {source}",
    )


@router.get("", response_model=PaginatedResponse[SocialTrendResponse])
async def list_trends(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    platform: str | None = None,
    sentiment: str | None = None,
    is_processed: bool | None = None,
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List social trends with optional filters."""
    data, total = await SocialTrendsService.list_trends(
        supabase,
        simulation_id,
        platform=platform,
        sentiment=sentiment,
        is_processed=is_processed,
        limit=limit,
        offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.post("/fetch", response_model=SuccessResponse[list[SocialTrendResponse]])
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def fetch_trends(
    request: Request,
    simulation_id: UUID,
    body: FetchTrendsRequest,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Fetch trends from an external news source."""
    resolver = ExternalServiceResolver(supabase, simulation_id)

    try:
        service = await _resolve_news_service(resolver, body.source)
        raw_trends = await service.search(body.query, limit=body.limit)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("External news API error for source=%s", body.source)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="External API error. Please try again.",
        ) from exc

    stored = await SocialTrendsService.store_fetched_trends(
        supabase, simulation_id, raw_trends
    )
    return {"success": True, "data": stored}


@router.post("/transform", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def transform_trend(
    request: Request,
    simulation_id: UUID,
    body: TransformTrendRequest,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Transform a trend into the simulation context using AI."""
    trend = await SocialTrendsService.get_trend(
        supabase, simulation_id, UUID(body.trend_id)
    )

    resolver = ExternalServiceResolver(supabase, simulation_id)
    ai_config = await resolver.get_ai_provider_config()

    gen = GenerationService(supabase, simulation_id, ai_config.openrouter_api_key)

    # Build content from raw_data if available
    raw = trend.get("raw_data") or {}
    news_content_parts = [
        raw.get("trail_text") or raw.get("description") or "",
        f"Source: {trend['platform']}",
    ]
    if trend.get("url"):
        news_content_parts.append(f"URL: {trend['url']}")
    if raw.get("byline") or raw.get("author"):
        news_content_parts.append(f"Author: {raw.get('byline') or raw.get('author')}")

    try:
        result = await gen.generate_news_transformation(
            news_title=trend["name"],
            news_content="\n".join(news_content_parts),
        )
    except Exception as exc:
        logger.exception("AI transformation failed for trend=%s", body.trend_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI transformation failed. Please try again.",
        ) from exc

    return {
        "success": True,
        "data": {
            "trend_id": body.trend_id,
            "original_title": trend["name"],
            "transformation": result,
        },
    }


@router.post("/integrate", response_model=SuccessResponse[dict], status_code=201)
async def integrate_trend(
    simulation_id: UUID,
    body: IntegrateTrendRequest,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Integrate a transformed trend as an event."""
    event_data = serialize_for_json({
        "title": body.title,
        "description": body.description,
        "event_type": body.event_type or "news",
        "impact_level": body.impact_level,
        "tags": [*body.tags, "imported", "news"],
        "data_source": "imported",
        "occurred_at": datetime.now(UTC).isoformat(),
    })

    try:
        event = await EventService.create(
            supabase,
            simulation_id,
            user.id,
            event_data,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to create event from trend %s", body.trend_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create event. Please try again.",
        ) from exc

    try:
        await SocialTrendsService.mark_processed(
            supabase, simulation_id, UUID(body.trend_id)
        )
    except Exception:
        logger.warning("Failed to mark trend %s as processed", body.trend_id)

    try:
        await AuditService.log_action(
            supabase,
            simulation_id=simulation_id,
            user_id=user.id,
            entity_type="events",
            entity_id=UUID(event["id"]),
            action="create",
            changes={"source": "social_trend", "trend_id": body.trend_id},
        )
    except Exception:
        logger.warning("Failed to log audit for trend integration %s", body.trend_id)

    return {"success": True, "data": event}


@router.post("/workflow", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def workflow(
    request: Request,
    simulation_id: UUID,
    body: FetchTrendsRequest,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Full workflow: Fetch trends from external source and store them."""
    resolver = ExternalServiceResolver(supabase, simulation_id)

    try:
        service = await _resolve_news_service(resolver, body.source)
        raw_trends = await service.search(body.query, limit=body.limit)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("External news API error for source=%s", body.source)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="External API error. Please try again.",
        ) from exc

    stored = await SocialTrendsService.store_fetched_trends(
        supabase, simulation_id, raw_trends
    )

    return {
        "success": True,
        "data": {
            "fetched": len(raw_trends),
            "stored": len(stored),
            "trends": stored,
        },
    }


# ---------------------------------------------------------------------------
# Browse workflow — ephemeral articles, no DB storage
# ---------------------------------------------------------------------------


@router.post("/browse", response_model=SuccessResponse[list[dict]])
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def browse_articles(
    request: Request,
    simulation_id: UUID,
    body: BrowseArticlesRequest,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Browse or search articles from external sources without DB storage."""
    resolver = ExternalServiceResolver(supabase, simulation_id)

    try:
        service = await _resolve_news_service(resolver, body.source)
        if body.query:
            kwargs = {"limit": body.limit}
            if body.source == "guardian" and body.section:
                kwargs["section"] = body.section
            articles = await service.search(body.query, **kwargs)
        else:
            kwargs = {"limit": body.limit}
            if body.source == "guardian" and body.section:
                kwargs["section"] = body.section
            articles = await service.browse(**kwargs)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("External news API error for source=%s", body.source)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="External API error. Please try again.",
        ) from exc

    return {"success": True, "data": articles}


@router.post("/transform-article", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def transform_article(
    request: Request,
    simulation_id: UUID,
    body: TransformArticleRequest,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Transform an ephemeral article (not from DB) into the simulation context using AI."""
    resolver = ExternalServiceResolver(supabase, simulation_id)
    ai_config = await resolver.get_ai_provider_config()

    gen = GenerationService(supabase, simulation_id, ai_config.openrouter_api_key)

    raw = body.article_raw_data or {}
    news_content_parts = [
        raw.get("trail_text") or raw.get("description") or "",
        f"Source: {body.article_platform}",
    ]
    if body.article_url:
        news_content_parts.append(f"URL: {body.article_url}")
    if raw.get("byline") or raw.get("author"):
        news_content_parts.append(f"Author: {raw.get('byline') or raw.get('author')}")

    try:
        result = await gen.generate_news_transformation(
            news_title=body.article_name,
            news_content="\n".join(news_content_parts),
        )
    except Exception as exc:
        logger.exception("AI transformation failed for article=%s", body.article_name)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI transformation failed. Please try again.",
        ) from exc

    return {
        "success": True,
        "data": {
            "original_title": body.article_name,
            "transformation": result,
        },
    }


@router.post("/integrate-article", response_model=SuccessResponse[dict], status_code=201)
async def integrate_article(
    simulation_id: UUID,
    body: IntegrateArticleRequest,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("editor")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Integrate an article as an event with optional agent reaction generation."""
    tags = [*body.tags, "imported", "news"]
    event_data = serialize_for_json({
        "title": body.title,
        "description": body.description,
        "event_type": body.event_type or "news",
        "impact_level": body.impact_level,
        "tags": tags,
        "data_source": "imported",
        "occurred_at": datetime.now(UTC).isoformat(),
    })
    if body.source_article:
        event_data["original_trend_data"] = body.source_article

    try:
        event = await EventService.create(supabase, simulation_id, user.id, event_data)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to create event from article")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create event. Please try again.",
        ) from exc

    try:
        await AuditService.log_action(
            supabase,
            simulation_id=simulation_id,
            user_id=user.id,
            entity_type="events",
            entity_id=UUID(event["id"]),
            action="create",
            changes={"source": "article_browse"},
        )
    except Exception:
        logger.warning("Failed to log audit for article integration")

    reactions: list[dict] = []
    if body.generate_reactions:
        try:
            resolver = ExternalServiceResolver(supabase, simulation_id)
            ai_config = await resolver.get_ai_provider_config()
            gen = GenerationService(supabase, simulation_id, ai_config.openrouter_api_key)

            reactions = await EventService.generate_reactions(
                supabase, simulation_id, event, gen,
                max_agents=body.max_reaction_agents,
            )
        except Exception:
            logger.warning("Reaction generation failed for event %s", event["id"])

    return {
        "success": True,
        "data": {
            "event": event,
            "reactions_count": len(reactions),
            "reactions": reactions,
        },
    }
