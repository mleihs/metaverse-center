"""Social media integration endpoints."""

import logging
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

import httpx
import sentry_sdk
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.dependencies import get_current_user, get_effective_supabase, require_role
from backend.middleware.rate_limit import RATE_LIMIT_AI_GENERATION, RATE_LIMIT_EXTERNAL_API, limiter
from backend.models.common import CurrentUser, PaginatedResponse, SuccessResponse
from backend.models.social import SocialMediaPostResponse, SocialSyncResponse
from backend.models.social_media import (
    AnalyzeSentimentRequest,
    GenerateReactionsRequest,
    TransformPostRequest,
)
from backend.services.agent_service import AgentService
from backend.services.ai_utils import MODEL_CALL_ERRORS
from backend.services.audit_service import AuditService
from backend.services.external.facebook import FacebookService
from backend.services.external_service_resolver import ExternalServiceResolver
from backend.services.generation_service import GenerationService
from backend.services.social_media_service import SocialMediaService
from backend.utils.errors import bad_request
from backend.utils.responses import paginated
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
    supabase: Annotated[Client, Depends(get_effective_supabase)],
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
    return paginated(data, total, limit, offset)


@router.post("/sync")
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def sync_posts(
    request: Request,
    simulation_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
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
                        await SocialMediaService.store_comment(supabase, simulation_id, stored_post["id"], c)
                        comments_count += 1

    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "social_media_posts",
        None,
        "sync",
        {"posts_synced": len(stored), "comments_synced": comments_count},
    )

    return SuccessResponse(
        data=SocialSyncResponse(
            posts_synced=len(stored),
            comments_synced=comments_count,
        )
    )


@router.post("/posts/{post_id}/transform")
@limiter.limit(RATE_LIMIT_AI_GENERATION)
async def transform_post(
    request: Request,
    simulation_id: UUID,
    post_id: UUID,
    body: TransformPostRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[SocialMediaPostResponse]:
    """Transform a social media post using AI."""
    post = await SocialMediaService.get_post(supabase, simulation_id, post_id)

    resolver = ExternalServiceResolver(supabase, simulation_id)
    ai_config = await resolver.get_ai_provider_config()

    gen = GenerationService(supabase, simulation_id, ai_config.openrouter_api_key)
    try:
        draft = await gen.generate_social_media_transform(
            post_content=post.get("message", ""),
            transform_type=body.transformation_type,
        )
    except ValueError as exc:
        # No template for this transformation. Before, the resolver fell through
        # to a generic prompt and the result was stored as world content.
        raise bad_request(str(exc)) from exc

    updated = await SocialMediaService.update_post(
        supabase,
        simulation_id,
        post_id,
        {
            "transformed_content": draft.transformed_content,
            "transformation_type": draft.transform_type,
            "transformed_at": datetime.now(UTC).isoformat(),
        },
    )

    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "social_media_posts",
        post_id,
        "transform",
        {"transformation_type": body.transformation_type},
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
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[SocialMediaPostResponse]:
    """Analyze sentiment of a social media post using AI."""
    post = await SocialMediaService.get_post(supabase, simulation_id, post_id)

    resolver = ExternalServiceResolver(supabase, simulation_id)
    ai_config = await resolver.get_ai_provider_config()

    gen = GenerationService(supabase, simulation_id, ai_config.openrouter_api_key)

    # The sentiment of what the reader actually sees: the transformed text when
    # there is one, the original otherwise. Until now this endpoint analysed
    # neither — it called the trends-campaign method with parameter names that
    # method does not have, and raised TypeError on the first call. See finding 24.
    transformed = post.get("transformed_content")
    text = transformed or post.get("message", "")

    analysis = await gen.generate_social_media_sentiment(post_content=text)
    sentiment_data = analysis.model_dump(exclude={"model_used"})

    update_data: dict = {}
    if transformed:
        update_data["transformed_sentiment"] = sentiment_data
    else:
        update_data["original_sentiment"] = sentiment_data

    updated = await SocialMediaService.update_post(supabase, simulation_id, post_id, update_data)
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "social_media_posts",
        post_id,
        "analyze_sentiment",
        {"target": "transformed" if transformed else "original"},
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
    supabase: Annotated[Client, Depends(get_effective_supabase)],
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
            # `generate_agent_reaction` takes the agent and the event as dicts and
            # returns PROSE, not a structured reaction. It used to be called with
            # four keywords it does not have, and its return read as a dict — two
            # errors that a bare `except Exception` turned into a 200 with an
            # empty list. Production has zero rows in this table. See finding 24.
            reaction_text = await gen.generate_agent_reaction(
                agent_data=agent,
                event_data={"title": content[:100], "description": content},
            )
            reaction = await SocialMediaService.store_agent_reaction(
                supabase,
                simulation_id,
                {
                    "post_id": str(post_id),
                    "agent_id": agent["id"],
                    "reaction_type": "ai_generated",
                    # No intensity is generated, and the column is nullable. A
                    # constant 5 would have been a number nobody measured.
                    "reaction_content": reaction_text,
                },
            )
            reactions.append(reaction)
        except (*MODEL_CALL_ERRORS, PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            # Deliberately not `except Exception`: that is what hid the two bugs
            # above for the life of the endpoint. One agent's failure must not
            # stop the others, but it must be observed.
            captured = f"{type(exc).__name__}: {exc}"
            logger.warning(
                "Agent reaction generation failed",
                extra={"agent_id": agent["id"], "error": captured},
                exc_info=True,
            )
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("simulation_id", str(simulation_id))
                scope.set_context("social_media", {"agent_id": agent["id"], "post_id": str(post_id)})
                sentry_sdk.capture_exception(exc)

    await AuditService.safe_log(
        supabase,
        simulation_id,
        user.id,
        "social_media_posts",
        post_id,
        "generate_reactions",
        {"reactions_generated": len(reactions), "agents_attempted": len(agents)},
    )
    return SuccessResponse(data=reactions)


@router.get("/posts/{post_id}/comments")
async def get_comments(
    simulation_id: UUID,
    post_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[dict]]:
    """Get all comments for a social media post."""
    comments = await SocialMediaService.get_comments(supabase, simulation_id, post_id)
    return SuccessResponse(data=comments)
