"""Social media integration endpoints."""

import logging
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.middleware.rate_limit import RATE_LIMIT_AI_GENERATION, RATE_LIMIT_EXTERNAL_API, limiter
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.social import SocialMediaPostResponse, SocialSyncResponse
from backend.models.social_media import (
    AnalyzeSentimentRequest,
    GenerateReactionsRequest,
    TransformPostRequest,
)
from backend.services.agent_service import AgentService
from backend.services.external.facebook import FacebookService
from backend.services.external_service_resolver import ExternalServiceResolver
from backend.services.generation_service import GenerationService
from backend.services.social_media_service import SocialMediaService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/social-media",
    tags=["social-media"],
)


@router.get("/posts")
async def list_posts(
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
    platform: str | None = None,
    transformed: bool | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[SocialMediaPostResponse]:
    """List social media posts."""
    data, total = await SocialMediaService.list_posts(
        supabase,
        simulation_id,
        platform=platform,
        transformed=transformed,
        limit=limit,
        offset=offset,
    )
    return PaginatedResponse(
        data=data,
        meta=PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    )


@router.post("/sync")
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def sync_posts(
    request: Request,
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[SocialSyncResponse]:
    """Sync posts from configured Facebook page."""
    resolver = ExternalServiceResolver(supabase, simulation_id)
    fb_config = await resolver.get_facebook_config()

    if not fb_config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Facebook integration not configured for this simulation.",
        )

    fb = FacebookService(fb_config.access_token, fb_config.api_version)
    raw_posts = await fb.get_page_feed(fb_config.page_id)

    stored = await SocialMediaService.store_posts(supabase, simulation_id, raw_posts)

    # Optionally fetch comments for each post
    comments_count = 0
    for post in raw_posts:
        if post.get("platform_id"):
            raw_comments = await fb.get_post_comments(post["platform_id"])
            if raw_comments:
                for c in raw_comments:
                    # Find stored post to link comment
                    stored_post = next(
                        (s for s in stored if s.get("platform_id") == post["platform_id"]),
                        None,
                    )
                    if stored_post:
                        await SocialMediaService.store_comment(
                            supabase, simulation_id, stored_post["id"], c
                        )
                        comments_count += 1

    return SuccessResponse(data=SocialSyncResponse(
        posts_synced=len(stored),
        comments_synced=comments_count,
    ))


@router.post("/posts/{post_id}/transform")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def transform_post(
    request: Request,
    simulation_id: UUID,
    post_id: UUID,
    body: TransformPostRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[SocialMediaPostResponse]:
    """Transform a social media post using AI."""
    post = await SocialMediaService.get_post(supabase, simulation_id, post_id)

    resolver = ExternalServiceResolver(supabase, simulation_id)
    ai_config = await resolver.get_ai_provider_config()

    gen = GenerationService(supabase, simulation_id, ai_config.openrouter_api_key)
    result = await gen.generate_social_media_transform(
        original_text=post.get("message", ""),
        transformation_type=body.transformation_type,
    )

    updated = await SocialMediaService.update_post(
        supabase,
        simulation_id,
        post_id,
        {
            "transformed_content": result.get("transformed_text", ""),
            "transformation_type": body.transformation_type,
            "transformed_at": datetime.now(UTC).isoformat(),
        },
    )

    return SuccessResponse(data=updated)


@router.post("/posts/{post_id}/analyze-sentiment")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def analyze_sentiment(
    request: Request,
    simulation_id: UUID,
    post_id: UUID,
    body: AnalyzeSentimentRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[SocialMediaPostResponse]:
    """Analyze sentiment of a social media post using AI."""
    post = await SocialMediaService.get_post(supabase, simulation_id, post_id)

    resolver = ExternalServiceResolver(supabase, simulation_id)
    ai_config = await resolver.get_ai_provider_config()

    gen = GenerationService(supabase, simulation_id, ai_config.openrouter_api_key)

    # Use the social_media_sentiment template
    text = post.get("message", "")
    transformed = post.get("transformed_content")

    sentiment_data = await gen.generate_social_trends_campaign(
        trend_name=text[:100],
        trend_platform=post.get("platform", "unknown"),
        trend_sentiment="neutral",
    )

    # Store sentiment on original or transformed
    update_data: dict = {}
    if transformed:
        update_data["transformed_sentiment"] = sentiment_data
    else:
        update_data["original_sentiment"] = sentiment_data

    updated = await SocialMediaService.update_post(
        supabase, simulation_id, post_id, update_data
    )
    return SuccessResponse(data=updated)


@router.post("/posts/{post_id}/generate-reactions")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def generate_reactions(
    request: Request,
    simulation_id: UUID,
    post_id: UUID,
    body: GenerateReactionsRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[list[dict]]:
    """Generate agent reactions to a social media post."""
    post = await SocialMediaService.get_post(supabase, simulation_id, post_id)

    # Get agents to react via service
    agents = await AgentService.list_for_reaction(
        supabase,
        simulation_id,
        agent_ids=body.agent_ids,
        limit=body.max_agents,
        select="id, name, system",
    )

    if not agents:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No agents found for reaction generation.",
        )

    resolver = ExternalServiceResolver(supabase, simulation_id)
    ai_config = await resolver.get_ai_provider_config()

    gen = GenerationService(supabase, simulation_id, ai_config.openrouter_api_key)

    reactions = []
    content = post.get("transformed_content") or post.get("message", "")

    for agent in agents:
        try:
            result = await gen.generate_agent_reaction(
                agent_name=agent["name"],
                agent_system=agent.get("system", ""),
                event_title=content[:100],
                event_description=content,
            )

            reaction = await SocialMediaService.store_agent_reaction(
                supabase,
                simulation_id,
                {
                    "post_id": str(post_id),
                    "agent_id": agent["id"],
                    "reaction_type": "ai_generated",
                    "reaction_content": result.get("reaction", ""),
                    "reaction_intensity": result.get("intensity", 5),
                },
            )
            reactions.append(reaction)
        except Exception:
            logger.warning(
                "Agent reaction generation failed",
                extra={"agent_id": agent["id"]},
                exc_info=True,
            )

    return SuccessResponse(data=reactions)


@router.get("/posts/{post_id}/comments")
async def get_comments(
    simulation_id: UUID,
    post_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_supabase)],
) -> SuccessResponse[list[dict]]:
    """Get all comments for a social media post."""
    comments = await SocialMediaService.get_comments(supabase, simulation_id, post_id)
    return SuccessResponse(data=comments)
