"""Style reference image endpoints for img2img art direction."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from backend.dependencies import get_current_user, get_effective_supabase, require_role
from backend.models.common import CurrentUser, DeleteResponse, SuccessResponse
from backend.models.style_reference import StyleReferenceInfo, StyleReferenceUploadResponse
from backend.services.audit_service import AuditService
from backend.services.style_reference_service import (
    ALLOWED_CONTENT_TYPES,
    MAX_FILE_SIZE,
    StyleReferenceService,
)
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/style-references",
    tags=["style-references"],
)


@router.post("/upload")
async def upload_reference(
    simulation_id: UUID,
    entity_type: Annotated[str, Form()],
    scope: Annotated[str, Form()],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    entity_id: Annotated[UUID | None, Form()] = None,
    strength: Annotated[float, Form()] = 0.75,
    file: Annotated[UploadFile | None, File()] = None,
    image_url: Annotated[str | None, Form()] = None,
) -> SuccessResponse[StyleReferenceUploadResponse]:
    """Upload a style reference image (file or URL).

    Accepts either a direct file upload or a URL to fetch.
    The image is validated, converted to AVIF, and stored.
    """
    if not file and not image_url:
        raise HTTPException(
            status_code=400,
            detail="Either 'file' or 'image_url' must be provided",
        )

    try:
        if file:
            # Direct file upload
            content_type = file.content_type or ""
            if content_type not in ALLOWED_CONTENT_TYPES:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Unsupported file type: {content_type}."
                        f" Allowed: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}"
                    ),
                )
            image_data = await file.read()
            if len(image_data) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"File too large (max {MAX_FILE_SIZE // (1024 * 1024)} MB)",
                )
        else:
            # Fetch from URL
            image_data, content_type = await StyleReferenceService.fetch_from_url(image_url)

        url = await StyleReferenceService.upload_reference(
            supabase=supabase,
            simulation_id=simulation_id,
            entity_type=entity_type,
            scope=scope,
            image_data=image_data,
            content_type=content_type,
            entity_id=entity_id,
            strength=strength,
        )

        await AuditService.safe_log(
            supabase, simulation_id, user.id, "style_references", None, "upload",
            details={"entity_type": entity_type, "scope": scope, "entity_id": str(entity_id) if entity_id else None},
        )

        return SuccessResponse(
            data=StyleReferenceUploadResponse(
                url=url,
                scope=scope,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id else None,
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/{entity_type}")
async def list_references(
    simulation_id: UUID,
    entity_type: str,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[StyleReferenceInfo]]:
    """List all configured style references for an entity type."""
    if entity_type not in ("portrait", "building"):
        raise HTTPException(
            status_code=400,
            detail="entity_type must be 'portrait' or 'building'",
        )

    refs = await StyleReferenceService.list_references(
        supabase, simulation_id, entity_type,
    )
    return SuccessResponse(data=refs)


@router.delete("/{entity_type}")
async def delete_reference(
    simulation_id: UUID,
    entity_type: str,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    scope: str = "global",
    entity_id: UUID | None = None,
) -> SuccessResponse[DeleteResponse]:
    """Remove a style reference image."""
    if entity_type not in ("portrait", "building"):
        raise HTTPException(
            status_code=400,
            detail="entity_type must be 'portrait' or 'building'",
        )

    try:
        await StyleReferenceService.delete_reference(
            supabase=supabase,
            simulation_id=simulation_id,
            entity_type=entity_type,
            scope=scope,
            entity_id=entity_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    await AuditService.safe_log(
        supabase, simulation_id, user.id, "style_references", None, "delete",
        details={"entity_type": entity_type, "scope": scope, "entity_id": str(entity_id) if entity_id else None},
    )
    return SuccessResponse(data=DeleteResponse())
