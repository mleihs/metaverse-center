"""Admin CRUD router for dungeon content tables.

All endpoints require platform admin (email allowlist).
Mutations use service_role client and trigger cache reload.
Audit-logged via AuditService.safe_log().
"""

from __future__ import annotations

import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from backend.dependencies import get_admin_supabase, require_platform_admin
from backend.middleware.rate_limit import RATE_LIMIT_ADMIN_MUTATION, limiter
from backend.models.common import CurrentUser, MessageResponse, PaginatedResponse, SuccessResponse
from backend.services.audit_service import AuditService
from backend.services.dungeon_content_admin_service import DungeonContentAdminService
from backend.services.dungeon_content_service import load_all_content
from backend.utils.responses import paginated
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin/dungeon-content",
    tags=["Admin: Dungeon Content"],
)

ContentType = Literal[
    "banter",
    "enemies",
    "spawns",
    "encounters",
    "choices",
    "loot",
    "anchors",
    "entrance_texts",
    "barometer_texts",
    "abilities",
]

_service = DungeonContentAdminService()


# ── Request models ────────────────────────────────────────────────────────


class ContentUpdateRequest(BaseModel):
    """Generic content update — accepts any JSON fields."""

    data: dict = Field(..., description="Fields to update")


class ContentCreateRequest(BaseModel):
    """Generic content creation — accepts full row as JSON."""

    data: dict = Field(..., description="Full row data")


# ── Endpoints ─────────────────────────────────────────────────────────────


@router.get("/{content_type}")
async def list_content(
    content_type: ContentType,
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    archetype: Annotated[str | None, Query(description="Filter by archetype")] = None,
    search: Annotated[str | None, Query(description="Search in text fields")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=500)] = 100,
) -> PaginatedResponse:
    """List content rows with optional archetype filter and search."""
    data, total = await _service.list_content(
        admin_supabase,
        content_type,
        archetype=archetype,
        search=search,
        page=page,
        per_page=per_page,
    )
    offset = (page - 1) * per_page
    return paginated(data, total, per_page, offset)


@router.get("/{content_type}/{item_id}")
async def get_content_item(
    content_type: ContentType,
    item_id: str,
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
) -> SuccessResponse:
    """Get a single content item by ID."""
    data = await _service.get_item(admin_supabase, content_type, item_id)
    return SuccessResponse(data=data)


@router.put("/{content_type}/{item_id}")
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def update_content_item(
    request: Request,
    content_type: ContentType,
    item_id: str,
    body: ContentUpdateRequest,
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
) -> SuccessResponse:
    """Update a content item. Reloads content cache after mutation."""
    data = await _service.update_item(admin_supabase, content_type, item_id, body.data)
    await AuditService.safe_log(
        admin_supabase,
        None,
        user.id,
        "dungeon_content",
        item_id,
        "update",
        details={"content_type": content_type, "fields": list(body.data.keys())},
    )
    await load_all_content(admin_supabase)
    return SuccessResponse(data=data)


@router.post("/reload-cache")
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def reload_cache(
    request: Request,
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
) -> SuccessResponse[MessageResponse]:
    """Force reload of the dungeon content cache."""
    await load_all_content(admin_supabase)
    await AuditService.safe_log(
        admin_supabase,
        None,
        user.id,
        "dungeon_content",
        "cache",
        "reload",
    )
    return SuccessResponse(data=MessageResponse(message="Cache reloaded."))


@router.post("/{content_type}")
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def create_content_item(
    request: Request,
    content_type: ContentType,
    body: ContentCreateRequest,
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
) -> SuccessResponse:
    """Create a new content item. Reloads content cache after mutation."""
    data = await _service.create_item(admin_supabase, content_type, body.data)
    await AuditService.safe_log(
        admin_supabase,
        None,
        user.id,
        "dungeon_content",
        str(data.get("id", "?")),
        "create",
        details={"content_type": content_type},
    )
    await load_all_content(admin_supabase)
    return SuccessResponse(data=data)


@router.delete("/{content_type}/{item_id}")
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def delete_content_item(
    request: Request,
    content_type: ContentType,
    item_id: str,
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
) -> SuccessResponse:
    """Delete a content item. Reloads content cache after mutation."""
    data = await _service.delete_item(admin_supabase, content_type, item_id)
    await AuditService.safe_log(
        admin_supabase,
        None,
        user.id,
        "dungeon_content",
        item_id,
        "delete",
        details={"content_type": content_type},
    )
    await load_all_content(admin_supabase)
    return SuccessResponse(data=data)
