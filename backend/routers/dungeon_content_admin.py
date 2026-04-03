"""Admin CRUD router for dungeon content tables.

All endpoints require platform admin (email allowlist).
Mutations use service_role client and trigger cache reload.
Audit-logged via AuditService.safe_log().
"""

from __future__ import annotations

import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from backend.dependencies import get_admin_supabase, require_platform_admin
from backend.middleware.rate_limit import RATE_LIMIT_ADMIN_MUTATION, limiter
from backend.models.common import CurrentUser, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.services.audit_service import AuditService
from backend.services.dungeon_content_service import load_all_content
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin/dungeon-content",
    tags=["Admin: Dungeon Content"],
)

# ── Content type → table name mapping ─────────────────────────────────────

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

_TABLE_MAP: dict[str, str] = {
    "banter": "dungeon_banter",
    "enemies": "dungeon_enemy_templates",
    "spawns": "dungeon_spawn_configs",
    "encounters": "dungeon_encounter_templates",
    "choices": "dungeon_encounter_choices",
    "loot": "dungeon_loot_items",
    "anchors": "dungeon_anchor_objects",
    "entrance_texts": "dungeon_entrance_texts",
    "barometer_texts": "dungeon_barometer_texts",
    "abilities": "combat_abilities",
}

# Primary key column(s) per content type
_PK_MAP: dict[str, str | tuple[str, str]] = {
    "banter": "id",
    "enemies": "id",
    "spawns": "id",
    "encounters": "id",
    "choices": ("encounter_id", "id"),
    "loot": "id",
    "anchors": ("archetype", "id"),
    "entrance_texts": "id",
    "barometer_texts": "id",
    "abilities": "id",
}


def _get_table(content_type: str) -> str:
    """Resolve content type to table name, raising 404 on unknown types."""
    table = _TABLE_MAP.get(content_type)
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown content type: {content_type}",
        )
    return table


# ── Request models ────────────────────────────────────────────────────────


class ContentUpdateRequest(BaseModel):
    """Generic content update — accepts any JSON fields.

    The admin UI sends only the fields that changed.
    Extra fields are silently dropped by the DB (column mismatch → ignored).
    """

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
    table = _get_table(content_type)

    query = admin_supabase.table(table).select("*", count="exact")

    if archetype:
        query = query.eq("archetype", archetype)

    if search:
        # Search across bilingual text columns
        # PostgREST or.filter: matches if any text column contains the search term
        search_filter = _build_search_filter(content_type, search)
        if search_filter:
            query = query.or_(search_filter)

    # Pagination
    offset = (page - 1) * per_page
    query = query.range(offset, offset + per_page - 1)

    # Default ordering
    query = query.order("sort_order", desc=False)

    response = await query.execute()
    rows = response.data or []
    total = response.count or len(rows)
    offset = (page - 1) * per_page

    return {
        "success": True,
        "data": rows,
        "meta": PaginationMeta(
            count=len(rows),
            total=total,
            limit=per_page,
            offset=offset,
        ).model_dump(),
    }


@router.get("/{content_type}/{item_id}")
async def get_content_item(
    content_type: ContentType,
    item_id: str,
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
) -> SuccessResponse:
    """Get a single content item by ID."""
    table = _get_table(content_type)
    pk = _PK_MAP.get(content_type, "id")

    if isinstance(pk, tuple):
        # Composite PK: item_id format is "encounter_id::choice_id"
        parts = item_id.split("::", 1)
        if len(parts) != 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Composite ID required (format: 'parent_id::id'), got: {item_id}",
            )
        response = await (
            admin_supabase.table(table)
            .select("*")
            .eq(pk[0], parts[0])
            .eq(pk[1], parts[1])
            .maybe_single()
            .execute()
        )
    else:
        response = await (
            admin_supabase.table(table)
            .select("*")
            .eq(pk, item_id)
            .maybe_single()
            .execute()
        )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{content_type} item not found: {item_id}",
        )

    return {"success": True, "data": response.data}


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
    table = _get_table(content_type)
    pk = _PK_MAP.get(content_type, "id")

    # Strip system columns that shouldn't be updated directly
    update_data = {k: v for k, v in body.data.items() if k not in ("created_at", "updated_at")}

    if isinstance(pk, tuple):
        parts = item_id.split("::", 1)
        if len(parts) != 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Composite ID required (format: 'parent_id::id'), got: {item_id}",
            )
        response = await (
            admin_supabase.table(table)
            .update(update_data)
            .eq(pk[0], parts[0])
            .eq(pk[1], parts[1])
            .execute()
        )
    else:
        response = await (
            admin_supabase.table(table)
            .update(update_data)
            .eq(pk, item_id)
            .execute()
        )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{content_type} item not found: {item_id}",
        )

    await AuditService.safe_log(
        admin_supabase, None, user.id, "dungeon_content", item_id, "update",
        details={"content_type": content_type, "fields": list(update_data.keys())},
    )

    # Reload cache atomically (no invalidate() — avoids downtime window)
    await load_all_content(admin_supabase)

    return {"success": True, "data": response.data[0] if response.data else None}


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
    table = _get_table(content_type)

    # Strip system columns
    create_data = {k: v for k, v in body.data.items() if k not in ("created_at", "updated_at")}

    response = await (
        admin_supabase.table(table)
        .insert(create_data)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create content item",
        )

    item_id = response.data[0].get("id", "unknown")
    await AuditService.safe_log(
        admin_supabase, None, user.id, "dungeon_content", str(item_id), "create",
        details={"content_type": content_type},
    )

    await load_all_content(admin_supabase)

    return {"success": True, "data": response.data[0]}


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
    table = _get_table(content_type)
    pk = _PK_MAP.get(content_type, "id")

    if isinstance(pk, tuple):
        parts = item_id.split("::", 1)
        if len(parts) != 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Composite ID required (format: 'parent_id::id'), got: {item_id}",
            )
        response = await (
            admin_supabase.table(table)
            .delete()
            .eq(pk[0], parts[0])
            .eq(pk[1], parts[1])
            .execute()
        )
    else:
        response = await (
            admin_supabase.table(table)
            .delete()
            .eq(pk, item_id)
            .execute()
        )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{content_type} item not found: {item_id}",
        )

    await AuditService.safe_log(
        admin_supabase, None, user.id, "dungeon_content", item_id, "delete",
        details={"content_type": content_type},
    )

    await load_all_content(admin_supabase)

    return {"success": True, "data": {"deleted": True, "id": item_id}}


@router.post("/reload-cache")
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def reload_cache(
    request: Request,
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
) -> SuccessResponse:
    """Force reload of the dungeon content cache."""
    await load_all_content(admin_supabase)

    await AuditService.safe_log(
        admin_supabase, None, user.id, "dungeon_content", "cache", "reload",
        details={},
    )

    return {"success": True, "data": {"reloaded": True}}


# ── Search filter builder ─────────────────────────────────────────────────


def _build_search_filter(content_type: str, search: str) -> str:
    """Build PostgREST or.filter string for text search across bilingual columns."""
    escaped = search.replace("%", "").replace("_", "")
    pattern = f"%{escaped}%"

    # Map content type to searchable text columns
    text_columns: dict[str, list[str]] = {
        "banter": ["id", "text_en", "text_de"],
        "enemies": ["id", "name_en", "name_de", "description_en", "description_de"],
        "spawns": ["id"],
        "encounters": ["id", "description_en", "description_de"],
        "choices": ["id", "label_en", "label_de", "success_narrative_en", "success_narrative_de"],
        "loot": ["id", "name_en", "name_de", "description_en", "description_de"],
        "anchors": ["id"],
        "entrance_texts": ["text_en", "text_de"],
        "barometer_texts": ["text_en", "text_de"],
        "abilities": ["id", "name_en", "name_de", "description_en", "description_de"],
    }

    columns = text_columns.get(content_type, ["id"])
    filters = [f"{col}.ilike.{pattern}" for col in columns]
    return ",".join(filters)
