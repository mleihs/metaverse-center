"""Social stories admin API -- resonance to Instagram Story pipeline.

All endpoints require platform admin access. Manages story sequences
generated from substrate resonance impacts.

Endpoints:
  GET  /stories                       -- List stories (with filters)
  GET  /stories/{id}                  -- Get single story
  GET  /stories/sequence/{id}         -- Get full sequence for a resonance
  POST /stories/{id}/skip             -- Skip a pending/ready story
  POST /stories/{id}/unskip           -- Re-enable a skipped story
  POST /stories/{id}/compose          -- Force-compose story image
  POST /stories/{id}/publish          -- Force-publish a single story
  POST /stories/{id}/regenerate       -- Delete from IG, recompose, republish
  GET  /stories/settings              -- Get resonance stories config
"""

import logging
from uuid import UUID

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


# ── Helpers ────────────────────────────────────────────────────────────


async def _get_ig_service(admin_supabase: Client) -> InstagramService:
    """Load Instagram credentials and return a configured service instance."""
    config = await InstagramContentService.load_instagram_credentials(admin_supabase)
    if not config["access_token"] or not config["ig_user_id"]:
        raise HTTPException(status_code=400, detail="Instagram credentials not configured.")
    return InstagramService(
        access_token=config["access_token"],
        ig_user_id=config["ig_user_id"],
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
    data, total = await SocialStoryService.list_stories(
        admin_supabase,
        status_filter=status_filter,
        resonance_id=resonance_id,
        limit=limit,
        offset=offset,
    )
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
    stories = await SocialStoryService.get_sequence(admin_supabase, resonance_id)
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
    story = await SocialStoryService.get_by_id(admin_supabase, story_id)
    if not story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Story not found.",
        )
    return {"success": True, "data": story}


# ── Actions ────────────────────────────────────────────────────────────


@router.post("/{story_id}/skip", response_model=SuccessResponse[SocialStoryResponse])
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def skip_story(
    request: Request,
    story_id: UUID,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Skip a pending or ready story -- prevents it from being published."""
    story = await SocialStoryService.get_by_id(admin_supabase, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found.")

    current = story["status"]
    if current not in ("pending", "composing", "ready"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot skip story with status '{current}'.",
        )

    updated = await SocialStoryService.update_status(admin_supabase, story_id, "skipped")
    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "social_stories", story_id, "update",
        {"action": "skip"},
    )
    return {"success": True, "data": updated}


@router.post("/{story_id}/unskip", response_model=SuccessResponse[SocialStoryResponse])
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def unskip_story(
    request: Request,
    story_id: UUID,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Re-enable a skipped story -- sets it back to pending."""
    story = await SocialStoryService.get_by_id(admin_supabase, story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found.")

    if story["status"] != "skipped":
        raise HTTPException(status_code=400, detail="Only skipped stories can be unskipped.")

    updated = await SocialStoryService.update_status(admin_supabase, story_id, "pending")
    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "social_stories", story_id, "update",
        {"action": "unskip"},
    )
    return {"success": True, "data": updated}


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

    story = await SocialStoryService.get_by_id(admin_supabase, story_id)
    return {"success": True, "data": story}


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

    ig = await _get_ig_service(admin_supabase)
    updated = await SocialStoryService.publish_story(admin_supabase, story_id, ig)

    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "social_stories", story_id, "update",
        {"action": "force_publish"},
    )
    return {"success": True, "data": updated}


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

    Full pipeline: delete from IG, clear image, recompose, publish.
    Works on any status -- if the story has an ig_story_id, deletes it first.
    """
    logger.info("Admin regenerate story", extra={
        "story_id": str(story_id),
        "user_id": str(user.id),
    })

    # Capture old IG ID for audit before regeneration clears it
    old_story = await SocialStoryService.get_by_id(admin_supabase, story_id)
    old_ig_story_id = old_story.get("ig_story_id") if old_story else None

    ig = await _get_ig_service(admin_supabase)
    updated = await SocialStoryService.regenerate_story(admin_supabase, story_id, ig)

    await AuditService.safe_log(
        admin_supabase, None, user.id,
        "social_stories", story_id, "update",
        {"action": "regenerate", "old_ig_story_id": old_ig_story_id},
    )
    return {"success": True, "data": updated}


# ── Config ─────────────────────────────────────────────────────────────


@router.get("/settings", response_model=SuccessResponse[dict])
async def get_story_settings(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Get all resonance story pipeline settings."""
    settings_map = await SocialStoryService.get_pipeline_settings(admin_supabase)
    return {"success": True, "data": settings_map}
