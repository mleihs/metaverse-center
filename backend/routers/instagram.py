"""Instagram publishing pipeline — admin API endpoints.

All endpoints require platform admin access. This is a platform-level
feature, not simulation-scoped — follows the admin router pattern.

Endpoints:
  GET  /queue          — List content queue (drafts, scheduled, published)
  GET  /queue/{id}     — Get single post details
  POST /generate       — Generate new content drafts from platform data
  POST /queue/{id}/approve  — Approve draft → scheduled
  POST /queue/{id}/reject   — Reject draft with reason
  POST /queue/{id}/publish  — Force-publish a single post (bypass scheduler)
  GET  /analytics      — Aggregated performance metrics
  GET  /rate-limit     — Current Instagram API usage
  GET  /candidates     — Preview available content candidates
"""

import logging
from uuid import UUID

import sentry_sdk
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from backend.dependencies import get_admin_supabase, require_platform_admin
from backend.middleware.rate_limit import RATE_LIMIT_ADMIN_MUTATION, RATE_LIMIT_EXTERNAL_API, limiter
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.instagram import (
    ApprovePostRequest,
    CreateInstagramPostRequest,
    GenerateContentRequest,
    InstagramAnalytics,
    InstagramPostResponse,
    InstagramQueueItem,
    InstagramRateLimit,
    RejectPostRequest,
)
from backend.services.audit_service import AuditService
from backend.services.external.instagram import InstagramService
from backend.services.instagram_content_service import InstagramContentService
from backend.services.instagram_scheduler import InstagramScheduler
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin/instagram",
    tags=["Instagram"],
)


# ── Helpers ────────────────────────────────────────────────────────────


async def _get_instagram_service(admin_supabase: Client) -> InstagramService:
    """Load Instagram credentials and return a configured service client."""
    config = await InstagramContentService.load_instagram_credentials(admin_supabase)
    if not config["access_token"] or not config["ig_user_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Instagram credentials not configured.",
        )
    return InstagramService(
        access_token=config["access_token"],
        ig_user_id=config["ig_user_id"],
    )


# ── Queue Management ────────────────────────────────────────────────────


@router.get("/queue", response_model=PaginatedResponse[InstagramQueueItem])
async def list_queue(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List Instagram content queue with simulation metadata."""
    data, total = await InstagramContentService.list_queue(
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


@router.get("/queue/{post_id}", response_model=SuccessResponse[InstagramPostResponse])
async def get_post(
    post_id: UUID,
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Get a single Instagram post by ID."""
    post = await InstagramContentService.get_post(admin_supabase, post_id)
    return {"success": True, "data": post}


# ── Content Generation ──────────────────────────────────────────────────


@router.post("/generate", response_model=SuccessResponse[list[InstagramPostResponse]])
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def generate_content(
    request: Request,
    body: GenerateContentRequest,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Generate new Instagram post drafts from available platform content.

    Uses fn_select_instagram_candidates() to find unposted content,
    generates Bureau-voice captions, composes themed images, and
    creates draft records ready for admin approval.
    """
    logger.info("Instagram admin action", extra={
        "action": "generate",
        "user_id": str(user.id),
        "count": body.count,
        "content_types": body.content_types,
    })
    posts = await InstagramContentService.generate_batch(
        admin_supabase,
        content_types=body.content_types,
        count=body.count,
        simulation_id=body.simulation_id,
        user_id=user.id,
    )
    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "instagram_posts", None, "generate",
        {"count": body.count, "content_types": body.content_types, "generated": len(posts)},
    )
    return {"success": True, "data": posts}


@router.get("/candidates", response_model=SuccessResponse[list[dict]])
async def list_candidates(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
    content_types: str | None = Query(None, description="Comma-separated: agent,building,chronicle"),
    limit: int = Query(default=10, ge=1, le=50),
) -> dict:
    """Preview available content candidates without generating drafts."""
    types = content_types.split(",") if content_types else None
    candidates = await InstagramContentService.select_candidates(
        admin_supabase,
        content_types=types,
        limit=limit,
    )
    return {"success": True, "data": candidates}


# ── Manual Post Creation ────────────────────────────────────────────────


@router.post("/queue", response_model=SuccessResponse[InstagramPostResponse])
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def create_post(
    request: Request,
    body: CreateInstagramPostRequest,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Manually create an Instagram post draft."""
    logger.info("Instagram admin action", extra={
        "action": "create_post",
        "user_id": str(user.id),
        "content_source_type": body.content_source_type,
    })
    data = {
        "simulation_id": str(body.simulation_id),
        "content_source_type": body.content_source_type,
        "content_source_id": str(body.content_source_id) if body.content_source_id else None,
        "content_source_snapshot": "{}",
        "caption": body.caption,
        "hashtags": body.hashtags,
        "alt_text": body.alt_text,
        "image_urls": body.image_urls,
        "media_type": body.media_type,
        "scheduled_at": body.scheduled_at.isoformat() if body.scheduled_at else None,
        "unlock_code": body.unlock_code,
    }
    post = await InstagramContentService.create_post(admin_supabase, data, str(user.id))
    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "instagram_posts", post.get("id"), "create",
        {"content_source_type": body.content_source_type},
    )
    return {"success": True, "data": post}


# ── Approval & Rejection ───────────────────────────────────────────────


@router.post("/queue/{post_id}/approve", response_model=SuccessResponse[InstagramPostResponse])
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def approve_post(
    request: Request,
    post_id: UUID,
    body: ApprovePostRequest | None = None,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Approve a draft post for scheduling."""
    logger.info("Instagram admin action", extra={
        "action": "approve",
        "post_id": str(post_id),
        "user_id": str(user.id),
    })
    scheduled_at = body.scheduled_at if body else None
    post = await InstagramContentService.approve_post(
        admin_supabase, post_id, scheduled_at=scheduled_at,
    )
    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "instagram_posts", post_id, "update",
        {"action": "approve"},
    )
    return {"success": True, "data": post}


@router.post("/queue/{post_id}/reject", response_model=SuccessResponse[InstagramPostResponse])
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def reject_post(
    request: Request,
    post_id: UUID,
    body: RejectPostRequest,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Reject a draft post with reason."""
    logger.info("Instagram admin action", extra={
        "action": "reject",
        "post_id": str(post_id),
        "user_id": str(user.id),
        "reason": body.reason[:100],
    })
    post = await InstagramContentService.reject_post(
        admin_supabase, post_id, reason=body.reason,
    )
    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "instagram_posts", post_id, "update",
        {"action": "reject", "reason": body.reason[:200]},
    )
    return {"success": True, "data": post}


# ── Force Publish ───────────────────────────────────────────────────────


@router.post("/queue/{post_id}/publish", response_model=SuccessResponse[InstagramPostResponse])
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def force_publish(
    request: Request,
    post_id: UUID,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Force-publish a post immediately (bypasses scheduler)."""
    logger.info("Instagram admin action", extra={
        "action": "force_publish",
        "post_id": str(post_id),
        "user_id": str(user.id),
    })

    post = await InstagramContentService.get_post(admin_supabase, post_id)

    if post["status"] not in ("draft", "scheduled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot publish post with status '{post['status']}'.",
        )

    ig = await _get_instagram_service(admin_supabase)

    try:
        await InstagramScheduler.publish_post(admin_supabase, ig, post)
    except Exception as exc:
        logger.exception("Force-publish failed", extra={
            "post_id": str(post_id),
            "user_id": str(user.id),
        })
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("instagram_phase", "force_publish")
            scope.set_context("instagram", {
                "post_id": str(post_id),
                "user_id": str(user.id),
            })
            sentry_sdk.capture_exception(exc)
        await InstagramContentService.reset_post_status(
            admin_supabase, str(post_id), f"Force-publish failed: {str(exc)[:300]}",
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Force-publish failed: {str(exc)[:200]}",
        ) from exc

    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "instagram_posts", post_id, "update",
        {"action": "force_publish"},
    )

    updated = await InstagramContentService.get_post(admin_supabase, post_id)
    return {"success": True, "data": updated}


# ── Analytics ───────────────────────────────────────────────────────────


@router.get("/analytics", response_model=SuccessResponse[InstagramAnalytics])
async def get_analytics(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
    days: int = Query(default=30, ge=1, le=365),
) -> dict:
    """Get aggregated Instagram performance analytics."""
    analytics = await InstagramContentService.get_analytics(admin_supabase, days=days)
    return {"success": True, "data": analytics}


# ── Pipeline Settings ──────────────────────────────────────────────────


@router.get("/settings", response_model=SuccessResponse[dict])
async def get_instagram_settings(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Get all Instagram pipeline configuration settings as a flat dict."""
    settings_map = await InstagramContentService.get_pipeline_settings(admin_supabase)
    return {"success": True, "data": settings_map}


# ── Rate Limit ──────────────────────────────────────────────────────────


@router.get("/rate-limit", response_model=SuccessResponse[InstagramRateLimit])
async def get_rate_limit(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Check current Instagram API rate limit usage."""
    config = await InstagramContentService.load_instagram_credentials(admin_supabase)
    if not config["access_token"] or not config["ig_user_id"]:
        return {
            "success": True,
            "data": {"quota_usage": 0, "quota_total": 100, "remaining": 100},
        }

    ig = InstagramService(
        access_token=config["access_token"],
        ig_user_id=config["ig_user_id"],
    )
    rate_data = await ig.check_rate_limit()
    return {"success": True, "data": rate_data}
