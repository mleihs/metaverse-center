"""Taxonomy CRUD endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.taxonomy import TaxonomyCreate, TaxonomyResponse, TaxonomyUpdate
from backend.services.taxonomy_service import TaxonomyService
from supabase import Client

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/taxonomies",
    tags=["taxonomies"],
)

_service = TaxonomyService()


@router.get("", response_model=SuccessResponse[list[TaxonomyResponse]])
async def list_taxonomies(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    taxonomy_type: str | None = Query(default=None),
    include_inactive: bool = Query(default=False),
) -> dict:
    """List all taxonomy values, optionally filtered by type."""
    data = await _service.list_taxonomies(
        supabase, simulation_id, taxonomy_type=taxonomy_type, active_only=not include_inactive,
    )
    return {"success": True, "data": data}


@router.get("/by-type/{taxonomy_type}", response_model=SuccessResponse[list[TaxonomyResponse]])
async def get_by_type(
    simulation_id: UUID,
    taxonomy_type: str,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get all taxonomy values of a specific type."""
    data = await _service.list_taxonomies(supabase, simulation_id, taxonomy_type=taxonomy_type)
    return {"success": True, "data": data}


@router.post("", response_model=SuccessResponse[TaxonomyResponse], status_code=201)
async def create_taxonomy(
    simulation_id: UUID,
    body: TaxonomyCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create a new taxonomy value. Requires admin role."""
    taxonomy = await _service.create_taxonomy(supabase, simulation_id, body.model_dump(exclude_none=True))
    return {"success": True, "data": taxonomy}


@router.put("/{taxonomy_id}", response_model=SuccessResponse[TaxonomyResponse])
async def update_taxonomy(
    simulation_id: UUID,
    taxonomy_id: UUID,
    body: TaxonomyUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update a taxonomy value. Requires admin role."""
    taxonomy = await _service.update_taxonomy(
        supabase, simulation_id, taxonomy_id, body.model_dump(exclude_none=True),
    )
    return {"success": True, "data": taxonomy}


@router.delete("/{taxonomy_id}", response_model=SuccessResponse[TaxonomyResponse])
async def deactivate_taxonomy(
    simulation_id: UUID,
    taxonomy_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Soft-delete (deactivate) a taxonomy value."""
    taxonomy = await _service.deactivate_taxonomy(supabase, simulation_id, taxonomy_id)
    return {"success": True, "data": taxonomy}
