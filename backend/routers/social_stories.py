"""Social stories admin API — resonance → Instagram Story pipeline.

All endpoints require platform admin access. Manages story sequences
generated from substrate resonance impacts.

Endpoints:
  GET  /stories          — List stories (with filters)
  GET  /stories/{id}     — Get single story
  GET  /stories/sequence/{resonance_id} — Get full sequence for a resonance
  POST /stories/{id}/skip       — Skip a pending/ready story
  POST /stories/{id}/unskip     — Re-enable a skipped story
  POST /stories/{id}/compose    — Force-compose story image
  POST /stories/{id}/publish    — Force-publish a single story
  POST /stories/{id}/regenerate — Delete from IG, recompose, republish
  GET  /stories/settings        — Get resonance stories config
"""

import logging
from uuid import UUID

import sentry_sdk
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from backend.dependencies import get_admin_supabase, require_platform_admin
from backend.middleware.rate_limit import RATE_LIMIT_ADMIN_MUTATION, RATE_LIMIT_EXTERNAL_API, limiter
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.social_story import SocialStoryResponse, SocialStorySequenceResponse
from backend.services.audit_service import AuditService
from backend.services.external.instagram import InstagramService
from backend.services.instagram_content_service import InstagramContentService
from backend.services.social_story_service import SocialStoryService
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin/instagram/stories",
    tags=["Social Stories"],
)


# ── List / Get ─────────────────────────────────────────────────────────


@router.get("", response_model=PaginatedResponse[SocialStoryResponse])
async def list_stories(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
    status_filter: str | None = Query(None, alias="status"),
    resonance_id: UUID | None = Query(None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """List social stories with optional filters."""
    query = (
        admin_supabase.table("social_stories")
        .select("*", count="exact")
    )
    if status_filter:
        query = query.eq("status", status_filter)
    if resonance_id:
        query = query.eq("resonance_id", str(resonance_id))
    query = query.order("scheduled_at", desc=True).range(offset, offset + limit - 1)
    response = query.execute()
    data = response.data or []
    total = response.count if response.count is not None else len(data)
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=limit, offset=offset),
    }


@router.get("/sequence/{resonance_id}", response_model=SuccessResponse[SocialStorySequenceResponse])
async def get_sequence(
    resonance_id: UUID,
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Get the full story sequence for a resonance."""
    response = (
        admin_supabase.table("social_stories")
        .select("*")
        .eq("resonance_id", str(resonance_id))
        .order("sequence_index")
        .execute()
    )
    stories = response.data or []
    if not stories:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No stories found for this resonance.",
        )

    published = sum(1 for s in stories if s["status"] == "published")
    total = len(stories)
    return {
        "success": True,
        "data": {
            "resonance_id": str(resonance_id),
            "archetype": stories[0].get("archetype", ""),
            "magnitude": float(stories[0].get("magnitude") or 0),
            "stories": stories,
            "total_stories": total,
            "published_count": published,
            "status_summary": f"{published}/{total} published",
        },
    }


@router.get("/{story_id}", response_model=SuccessResponse[SocialStoryResponse])
async def get_story(
    story_id: UUID,
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Get a single social story by ID."""
    response = (
        admin_supabase.table("social_stories")
        .select("*")
        .eq("id", str(story_id))
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Story not found.",
        )
    return {"success": True, "data": response.data[0]}


# ── Actions ────────────────────────────────────────────────────────────


@router.post("/{story_id}/skip", response_model=SuccessResponse[SocialStoryResponse])
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def skip_story(
    request: Request,
    story_id: UUID,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Skip a pending or ready story — prevents it from being published."""
    response = (
        admin_supabase.table("social_stories")
        .select("status")
        .eq("id", str(story_id))
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Story not found.")

    current = response.data[0]["status"]
    if current not in ("pending", "composing", "ready"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot skip story with status '{current}'.",
        )

    updated = (
        admin_supabase.table("social_stories")
        .update({"status": "skipped"})
        .eq("id", str(story_id))
        .execute()
    )
    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "social_stories", story_id, "update",
        {"action": "skip"},
    )
    return {"success": True, "data": updated.data[0]}


@router.post("/{story_id}/unskip", response_model=SuccessResponse[SocialStoryResponse])
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def unskip_story(
    request: Request,
    story_id: UUID,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Re-enable a skipped story — sets it back to pending."""
    response = (
        admin_supabase.table("social_stories")
        .select("status")
        .eq("id", str(story_id))
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Story not found.")

    if response.data[0]["status"] != "skipped":
        raise HTTPException(status_code=400, detail="Only skipped stories can be unskipped.")

    updated = (
        admin_supabase.table("social_stories")
        .update({"status": "pending"})
        .eq("id", str(story_id))
        .execute()
    )
    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "social_stories", story_id, "update",
        {"action": "unskip"},
    )
    return {"success": True, "data": updated.data[0]}


@router.post("/{story_id}/compose", response_model=SuccessResponse[SocialStoryResponse])
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def force_compose(
    request: Request,
    story_id: UUID,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Force-compose a story image (bypasses scheduler)."""
    logger.info("Admin force-compose story", extra={
        "story_id": str(story_id),
        "user_id": str(user.id),
    })

    url = await SocialStoryService.compose_story_image(admin_supabase, story_id)
    if not url:
        raise HTTPException(status_code=500, detail="Image composition failed.")

    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "social_stories", story_id, "update",
        {"action": "force_compose"},
    )

    response = (
        admin_supabase.table("social_stories")
        .select("*")
        .eq("id", str(story_id))
        .limit(1)
        .execute()
    )
    return {"success": True, "data": response.data[0]}


@router.post("/{story_id}/publish", response_model=SuccessResponse[SocialStoryResponse])
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def force_publish(
    request: Request,
    story_id: UUID,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Force-publish a single story immediately (bypasses scheduler + throttle)."""
    logger.info("Admin force-publish story", extra={
        "story_id": str(story_id),
        "user_id": str(user.id),
    })

    # Get the story
    resp = (
        admin_supabase.table("social_stories")
        .select("*")
        .eq("id", str(story_id))
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Story not found.")
    story = resp.data[0]

    if story["status"] not in ("pending", "ready"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot publish story with status '{story['status']}'.",
        )

    # Compose image if not yet ready
    if not story.get("image_url"):
        url = await SocialStoryService.compose_story_image(admin_supabase, story_id)
        if not url:
            raise HTTPException(status_code=500, detail="Image composition failed.")
        story["image_url"] = url

    # Get Instagram credentials
    config = await InstagramContentService.load_instagram_credentials(admin_supabase)
    if not config["access_token"] or not config["ig_user_id"]:
        raise HTTPException(status_code=400, detail="Instagram credentials not configured.")

    ig = InstagramService(
        access_token=config["access_token"],
        ig_user_id=config["ig_user_id"],
    )

    try:
        from datetime import UTC, datetime

        admin_supabase.table("social_stories").update(
            {"status": "publishing"},
        ).eq("id", str(story_id)).execute()

        result = await ig.publish_story(story["image_url"])
        media_id = result.get("id", "")

        admin_supabase.table("social_stories").update({
            "status": "published",
            "published_at": datetime.now(UTC).isoformat(),
            "ig_story_id": media_id,
            "ig_posted_at": datetime.now(UTC).isoformat(),
        }).eq("id", str(story_id)).execute()

    except Exception as exc:
        logger.exception("Force-publish story failed", extra={
            "story_id": str(story_id),
            "user_id": str(user.id),
        })
        admin_supabase.table("social_stories").update({
            "status": "failed",
            "failure_reason": f"Force-publish failed: {exc!s}"[:500],
        }).eq("id", str(story_id)).execute()
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("instagram_phase", "force_publish_story")
            scope.set_context("story", {"story_id": str(story_id)})
            sentry_sdk.capture_exception(exc)
        raise HTTPException(
            status_code=502,
            detail=f"Force-publish failed: {exc!s}"[:200],
        ) from exc

    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "social_stories", story_id, "update",
        {"action": "force_publish"},
    )

    updated = (
        admin_supabase.table("social_stories")
        .select("*")
        .eq("id", str(story_id))
        .limit(1)
        .execute()
    )
    return {"success": True, "data": updated.data[0]}


# ── Regenerate ─────────────────────────────────────────────────────


@router.post("/{story_id}/regenerate", response_model=SuccessResponse[SocialStoryResponse])
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def regenerate_story(
    request: Request,
    story_id: UUID,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Delete published story from Instagram, recompose image, and republish.

    Full pipeline: delete from IG → clear image → recompose → publish.
    Works on any status — if the story has an ig_story_id, deletes it first.
    """
    logger.info("Admin regenerate story", extra={
        "story_id": str(story_id),
        "user_id": str(user.id),
    })

    # Get the story
    resp = (
        admin_supabase.table("social_stories")
        .select("*")
        .eq("id", str(story_id))
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Story not found.")
    story = resp.data[0]

    # Get Instagram credentials
    config = await InstagramContentService.load_instagram_credentials(admin_supabase)
    if not config["access_token"] or not config["ig_user_id"]:
        raise HTTPException(status_code=400, detail="Instagram credentials not configured.")

    ig = InstagramService(
        access_token=config["access_token"],
        ig_user_id=config["ig_user_id"],
    )

    # Step 1: Delete from Instagram if published
    ig_story_id = story.get("ig_story_id")
    if ig_story_id:
        try:
            await ig.delete_media(ig_story_id)
            logger.info("Deleted story from Instagram", extra={
                "story_id": str(story_id),
                "ig_story_id": ig_story_id,
            })
        except Exception as exc:
            # Story may have already expired (24h) — log but continue
            logger.warning("Could not delete story from Instagram (may have expired)", extra={
                "story_id": str(story_id),
                "ig_story_id": ig_story_id,
                "error": str(exc)[:200],
            })

    # Step 2: Reset status and clear old image reference
    admin_supabase.table("social_stories").update({
        "status": "pending",
        "image_url": None,
        "ig_story_id": None,
        "ig_posted_at": None,
        "published_at": None,
        "failure_reason": None,
    }).eq("id", str(story_id)).execute()

    # Step 3: Recompose image with current template code
    url = await SocialStoryService.compose_story_image(admin_supabase, story_id)
    if not url:
        raise HTTPException(status_code=500, detail="Image recomposition failed.")

    # Step 4: Publish to Instagram
    try:
        from datetime import UTC, datetime

        admin_supabase.table("social_stories").update(
            {"status": "publishing"},
        ).eq("id", str(story_id)).execute()

        result = await ig.publish_story(url)
        media_id = result.get("id", "")

        admin_supabase.table("social_stories").update({
            "status": "published",
            "published_at": datetime.now(UTC).isoformat(),
            "ig_story_id": media_id,
            "ig_posted_at": datetime.now(UTC).isoformat(),
        }).eq("id", str(story_id)).execute()

    except Exception as exc:
        logger.exception("Regenerate publish failed", extra={
            "story_id": str(story_id),
        })
        admin_supabase.table("social_stories").update({
            "status": "failed",
            "failure_reason": f"Regenerate publish failed: {exc!s}"[:500],
        }).eq("id", str(story_id)).execute()
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("instagram_phase", "regenerate_publish")
            scope.set_context("story", {"story_id": str(story_id)})
            sentry_sdk.capture_exception(exc)
        raise HTTPException(
            status_code=502,
            detail=f"Recomposition succeeded but publish failed: {exc!s}"[:200],
        ) from exc

    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "social_stories", story_id, "update",
        {"action": "regenerate", "old_ig_story_id": ig_story_id},
    )

    updated = (
        admin_supabase.table("social_stories")
        .select("*")
        .eq("id", str(story_id))
        .limit(1)
        .execute()
    )
    return {"success": True, "data": updated.data[0]}


# ── Config ─────────────────────────────────────────────────────────────


@router.get("/settings", response_model=SuccessResponse[dict])
async def get_story_settings(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Get all resonance story pipeline settings."""
    rows = (
        admin_supabase.table("platform_settings")
        .select("setting_key, setting_value")
        .like("setting_key", "resonance_stories_%")
        .execute()
    ).data or []
    settings_map = {row["setting_key"]: row["setting_value"] for row in rows}
    return {"success": True, "data": settings_map}
