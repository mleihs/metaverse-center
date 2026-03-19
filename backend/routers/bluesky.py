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
from uuid import UUID

import sentry_sdk
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from backend.dependencies import get_admin_supabase, require_platform_admin
from backend.middleware.rate_limit import RATE_LIMIT_ADMIN_MUTATION, RATE_LIMIT_EXTERNAL_API, limiter
from backend.models.bluesky import BlueskyAnalytics, BlueskyPostResponse, BlueskyQueueItem
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.services.audit_service import AuditService
from backend.services.bluesky_content_service import BlueskyContentService
from backend.services.bluesky_scheduler import BlueskyScheduler
from backend.services.external.bluesky import BlueskyService
from supabase import Client

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


@router.get("/queue", response_model=PaginatedResponse[BlueskyQueueItem])
async def list_queue(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List Bluesky content queue with simulation metadata."""
    data, total = await BlueskyContentService.list_queue(
        admin_supabase,
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/queue/{post_id}", response_model=SuccessResponse[BlueskyPostResponse])
async def get_post(
    post_id: UUID,
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Get a single Bluesky post by ID."""
    post = await BlueskyContentService.get_post(admin_supabase, post_id)
    return {"success": True, "data": post}


# ── Skip / Unskip ─────────────────────────────────────────────────────


@router.post("/queue/{post_id}/skip", response_model=SuccessResponse[BlueskyPostResponse])
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def skip_post(
    request: Request,
    post_id: UUID,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Skip a post — don't publish to Bluesky."""
    logger.info("Bluesky admin action", extra={
        "action": "skip",
        "post_id": str(post_id),
        "user_id": str(user.id),
    })
    post = await BlueskyContentService.skip_post(admin_supabase, post_id)
    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "bluesky_posts", post_id, "update",
        {"action": "skip"},
    )
    return {"success": True, "data": post}


@router.post("/queue/{post_id}/unskip", response_model=SuccessResponse[BlueskyPostResponse])
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def unskip_post(
    request: Request,
    post_id: UUID,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Re-enable a skipped post."""
    logger.info("Bluesky admin action", extra={
        "action": "unskip",
        "post_id": str(post_id),
        "user_id": str(user.id),
    })
    post = await BlueskyContentService.unskip_post(admin_supabase, post_id)
    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "bluesky_posts", post_id, "update",
        {"action": "unskip"},
    )
    return {"success": True, "data": post}


# ── Force Publish ──────────────────────────────────────────────────────


@router.post("/queue/{post_id}/publish", response_model=SuccessResponse[BlueskyPostResponse])
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def force_publish(
    request: Request,
    post_id: UUID,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Force-publish a post immediately (bypasses scheduler)."""
    logger.info("Bluesky admin action", extra={
        "action": "force_publish",
        "post_id": str(post_id),
        "user_id": str(user.id),
    })

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
        logger.exception("Bluesky force-publish failed", extra={
            "post_id": str(post_id),
            "user_id": str(user.id),
        })
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("bluesky_phase", "force_publish")
            scope.set_context("bluesky", {
                "post_id": str(post_id),
                "user_id": str(user.id),
            })
            sentry_sdk.capture_exception(exc)
        await BlueskyContentService.reset_post_status(
            admin_supabase, str(post_id), f"Force-publish failed: {str(exc)[:300]}",
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Force-publish failed: {str(exc)[:200]}",
        ) from exc

    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "bluesky_posts", post_id, "update",
        {"action": "force_publish"},
    )

    updated = await BlueskyContentService.get_post(admin_supabase, post_id)
    return {"success": True, "data": updated}


# ── Analytics ──────────────────────────────────────────────────────────


@router.get("/analytics", response_model=SuccessResponse[BlueskyAnalytics])
async def get_analytics(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
    days: int = Query(default=30, ge=1, le=365),
) -> dict:
    """Get aggregated Bluesky performance analytics."""
    analytics = await BlueskyContentService.get_analytics(admin_supabase, days=days)
    return {"success": True, "data": analytics}


# ── Pipeline Settings ─────────────────────────────────────────────────


@router.get("/settings", response_model=SuccessResponse[dict])
async def get_bluesky_settings(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Get all Bluesky pipeline configuration settings."""
    settings_map = await BlueskyContentService.get_pipeline_settings(admin_supabase)
    return {"success": True, "data": settings_map}


# ── Connection Status ─────────────────────────────────────────────────


@router.get("/status", response_model=SuccessResponse[dict])
async def get_connection_status(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Validate Bluesky credentials and return connection status."""
    config = await BlueskyContentService.load_bluesky_credentials(admin_supabase)

    if not config["handle"] or not config["app_password"]:
        return {
            "success": True,
            "data": {
                "configured": False,
                "authenticated": False,
                "handle": config["handle"] or None,
                "pds_url": config["pds_url"],
            },
        }

    bsky = BlueskyService(
        handle=config["handle"],
        app_password=config["app_password"],
        pds_url=config["pds_url"],
    )
    authenticated = await bsky.validate_credentials()

    return {
        "success": True,
        "data": {
            "configured": True,
            "authenticated": authenticated,
            "handle": config["handle"],
            "pds_url": config["pds_url"],
        },
    }
