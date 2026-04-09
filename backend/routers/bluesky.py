"""Bluesky publishing pipeline — admin API endpoints.

All endpoints require platform admin access. Content generation is
Instagram's responsibility — Bluesky rides along via the Postgres
cross-posting trigger.

Endpoints:
  GET  /queue          — List Bluesky queue (filterable by status)
  GET  /queue/{id}     — Single post detail
  POST /queue/{id}/skip    — Skip post (don't publish to Bluesky)
  POST /queue/{id}/unskip  — Re-enable skipped post
  POST /queue/{id}/publish — Force-publish single post
  GET  /analytics      — Bluesky-specific analytics
  GET  /settings       — Pipeline configuration
  GET  /status         — Validate credentials + connection status
"""

import logging
from typing import Annotated
from uuid import UUID

import sentry_sdk
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from backend.dependencies import get_admin_supabase, require_platform_admin
from backend.middleware.rate_limit import RATE_LIMIT_ADMIN_MUTATION, RATE_LIMIT_EXTERNAL_API, limiter
from backend.models.bluesky import BlueskyAnalytics, BlueskyPostResponse, BlueskyQueueItem, BlueskyStatusResponse
from backend.models.common import CurrentUser, PaginatedResponse, SuccessResponse
from backend.models.social import PipelineSettingValue
from backend.services.audit_service import AuditService
from backend.services.bluesky_content_service import BlueskyContentService
from backend.services.bluesky_scheduler import BlueskyScheduler
from backend.services.external.bluesky import BlueskyService
from backend.utils.responses import paginated
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin/bluesky",
    tags=["Bluesky"],
)


# ── Helpers ────────────────────────────────────────────────────────────


async def _get_bluesky_service(admin_supabase: Client) -> BlueskyService:
    """Load Bluesky credentials and return a configured service client."""
    config = await BlueskyContentService.load_bluesky_credentials(admin_supabase)
    if not config["handle"] or not config["app_password"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bluesky credentials not configured.",
        )
    return BlueskyService(
        handle=config["handle"],
        app_password=config["app_password"],
        pds_url=config["pds_url"],
    )


# ── Queue Management ────────────────────────────────────────────────────


@router.get("/queue")
async def list_queue(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[BlueskyQueueItem]:
    """List Bluesky content queue with simulation metadata."""
    data, total = await BlueskyContentService.list_queue(
        admin_supabase,
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )
    return paginated(data, total, limit, offset)


@router.get("/queue/{post_id}")
async def get_post(
    post_id: UUID,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[BlueskyPostResponse]:
    """Get a single Bluesky post by ID."""
    post = await BlueskyContentService.get_post(admin_supabase, post_id)
    return SuccessResponse(data=post)


# ── Skip / Unskip ─────────────────────────────────────────────────────


@router.post("/queue/{post_id}/skip")
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def skip_post(
    request: Request,
    post_id: UUID,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[BlueskyPostResponse]:
    """Skip a post — don't publish to Bluesky."""
    logger.info(
        "Bluesky admin action",
        extra={
            "action": "skip",
            "post_id": str(post_id),
            "user_id": str(user.id),
        },
    )
    post = await BlueskyContentService.skip_post(admin_supabase, post_id)
    await AuditService.safe_log(
        admin_supabase,
        None,
        user.id,
        "bluesky_posts",
        post_id,
        "update",
        {"action": "skip"},
    )
    return SuccessResponse(data=post)


@router.post("/queue/{post_id}/unskip")
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def unskip_post(
    request: Request,
    post_id: UUID,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[BlueskyPostResponse]:
    """Re-enable a skipped post."""
    logger.info(
        "Bluesky admin action",
        extra={
            "action": "unskip",
            "post_id": str(post_id),
            "user_id": str(user.id),
        },
    )
    post = await BlueskyContentService.unskip_post(admin_supabase, post_id)
    await AuditService.safe_log(
        admin_supabase,
        None,
        user.id,
        "bluesky_posts",
        post_id,
        "update",
        {"action": "unskip"},
    )
    return SuccessResponse(data=post)


# ── Force Publish ──────────────────────────────────────────────────────


@router.post("/queue/{post_id}/publish")
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def force_publish(
    request: Request,
    post_id: UUID,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[BlueskyPostResponse]:
    """Force-publish a post immediately (bypasses scheduler)."""
    logger.info(
        "Bluesky admin action",
        extra={
            "action": "force_publish",
            "post_id": str(post_id),
            "user_id": str(user.id),
        },
    )

    post = await BlueskyContentService.get_post(admin_supabase, post_id)

    if post["status"] not in ("pending", "failed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot publish post with status '{post['status']}'.",
        )

    bsky = await _get_bluesky_service(admin_supabase)

    try:
        await BlueskyScheduler.publish_post(admin_supabase, bsky, post)
    except Exception as exc:
        logger.exception(
            "Bluesky force-publish failed",
            extra={
                "post_id": str(post_id),
                "user_id": str(user.id),
            },
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("bluesky_phase", "force_publish")
            scope.set_context(
                "bluesky",
                {
                    "post_id": str(post_id),
                    "user_id": str(user.id),
                },
            )
            sentry_sdk.capture_exception(exc)
        await BlueskyContentService.reset_post_status(
            admin_supabase,
            str(post_id),
            f"Force-publish failed: {str(exc)[:300]}",
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Force-publish failed: {str(exc)[:200]}",
        ) from exc

    await AuditService.safe_log(
        admin_supabase,
        None,
        user.id,
        "bluesky_posts",
        post_id,
        "update",
        {"action": "force_publish"},
    )

    updated = await BlueskyContentService.get_post(admin_supabase, post_id)
    return SuccessResponse(data=updated)


# ── Analytics ──────────────────────────────────────────────────────────


@router.get("/analytics")
async def get_analytics(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> SuccessResponse[BlueskyAnalytics]:
    """Get aggregated Bluesky performance analytics."""
    analytics = await BlueskyContentService.get_analytics(admin_supabase, days=days)
    return SuccessResponse(data=analytics)


# ── Pipeline Settings ─────────────────────────────────────────────────


@router.get("/settings")
async def get_bluesky_settings(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[dict[str, PipelineSettingValue]]:
    """Get all Bluesky pipeline configuration settings."""
    settings_map = await BlueskyContentService.get_pipeline_settings(admin_supabase)
    return SuccessResponse(data=settings_map)


# ── Connection Status ─────────────────────────────────────────────────


@router.get("/status")
async def get_connection_status(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[BlueskyStatusResponse]:
    """Validate Bluesky credentials and return connection status."""
    config = await BlueskyContentService.load_bluesky_credentials(admin_supabase)

    if not config["handle"] or not config["app_password"]:
        return SuccessResponse(
            data=BlueskyStatusResponse(
                configured=False,
                authenticated=False,
                handle=config["handle"] or None,
                pds_url=config["pds_url"],
            )
        )

    bsky = BlueskyService(
        handle=config["handle"],
        app_password=config["app_password"],
        pds_url=config["pds_url"],
    )
    authenticated = await bsky.validate_credentials()

    return SuccessResponse(
        data=BlueskyStatusResponse(
            configured=True,
            authenticated=authenticated,
            handle=config["handle"],
            pds_url=config["pds_url"],
        )
    )
