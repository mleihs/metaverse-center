"""Platform admin router — settings and user management.

All endpoints require platform admin (email allowlist).
Uses admin (service_role) Supabase client for cross-table operations.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from backend.dependencies import get_admin_supabase, require_platform_admin
from backend.models.cleanup import CleanupExecuteRequest, CleanupPreviewRequest
from backend.models.common import CurrentUser
from backend.services.admin_user_service import AdminUserService
from backend.services.cache_config import invalidate as invalidate_cache_config
from backend.services.cleanup_service import CleanupService
from backend.services.platform_settings_service import PlatformSettingsService
from backend.services.simulation_service import SimulationService
from supabase import Client

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["Admin"],
)


# --- Request Models ---


class UpdateSettingRequest(BaseModel):
    value: str | int | float = Field(..., description="New setting value")


class AddMembershipRequest(BaseModel):
    simulation_id: UUID
    role: str = Field(..., pattern=r"^(owner|admin|editor|viewer)$")


class ChangeMembershipRoleRequest(BaseModel):
    role: str = Field(..., pattern=r"^(owner|admin|editor|viewer)$")


class UpdateUserWalletRequest(BaseModel):
    forge_tokens: int | None = Field(None, ge=0)
    is_architect: bool | None = None


# --- Platform Settings Endpoints ---


@router.get("/settings")
async def list_settings(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """List all platform settings."""
    data = await PlatformSettingsService.list_all(admin_supabase)
    return {"success": True, "data": data}


@router.put("/settings/{key}")
async def update_setting(
    key: str,
    body: UpdateSettingRequest,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Update a platform setting value."""
    data = await PlatformSettingsService.update(admin_supabase, key, body.value, user.id)

    # Invalidate relevant caches when cache TTLs change
    if key.startswith("cache_"):
        _invalidate_caches(key)

    return {"success": True, "data": data}


# --- User Management Endpoints ---


@router.get("/users")
async def list_users(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """List all platform users."""
    data = await AdminUserService.list_users(admin_supabase, page=page, per_page=per_page)
    return {"success": True, "data": data}


@router.get("/users/{user_id}")
async def get_user(
    user_id: UUID,
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Get user detail with all simulation memberships."""
    data = await AdminUserService.get_user_with_memberships(admin_supabase, user_id)
    return {"success": True, "data": data}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID,
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Delete a user from the platform."""
    await AdminUserService.delete_user(admin_supabase, user_id)
    return {"success": True, "data": {"deleted": True}}


@router.post("/users/{user_id}/memberships")
async def add_membership(
    user_id: UUID,
    body: AddMembershipRequest,
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Add a user to a simulation with a role."""
    data = await AdminUserService.add_membership(
        admin_supabase, user_id, body.simulation_id, body.role,
    )
    return {"success": True, "data": data}


@router.put("/users/{user_id}/memberships/{simulation_id}")
async def change_membership_role(
    user_id: UUID,
    simulation_id: UUID,
    body: ChangeMembershipRoleRequest,
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Change a user's role in a simulation."""
    data = await AdminUserService.change_membership_role(
        admin_supabase, user_id, simulation_id, body.role,
    )
    return {"success": True, "data": data}


@router.delete("/users/{user_id}/memberships/{simulation_id}")
async def remove_membership(
    user_id: UUID,
    simulation_id: UUID,
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Remove a user from a simulation."""
    data = await AdminUserService.remove_membership(admin_supabase, user_id, simulation_id)
    return {"success": True, "data": data}


@router.put("/users/{user_id}/wallet")
async def update_user_wallet(
    user_id: UUID,
    body: UpdateUserWalletRequest,
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Update a user's forge wallet settings."""
    data = await AdminUserService.update_user_wallet(
        admin_supabase, user_id, body.forge_tokens, body.is_architect,
    )
    return {"success": True, "data": data}


# --- Data Cleanup Endpoints ---


@router.get("/cleanup/stats")
async def get_cleanup_stats(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Get record counts per cleanup category."""
    data = await CleanupService.get_stats(admin_supabase)
    return {"success": True, "data": data.model_dump(mode="json")}


@router.post("/cleanup/preview")
async def preview_cleanup(
    body: CleanupPreviewRequest,
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Preview what would be deleted without actually deleting."""
    data = await CleanupService.preview(admin_supabase, body.cleanup_type, body.min_age_days)
    return {"success": True, "data": data.model_dump(mode="json")}


@router.post("/cleanup/execute")
async def execute_cleanup(
    body: CleanupExecuteRequest,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Execute data cleanup. Requires prior preview for safety."""
    data = await CleanupService.execute(
        admin_supabase, body.cleanup_type, body.min_age_days, user.id,
    )
    return {"success": True, "data": data.model_dump(mode="json")}


# --- Simulation Management Endpoints ---

_sim_service = SimulationService()


@router.get("/simulations")
async def list_simulations(
    include_deleted: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """List all simulations (admin). Optionally include soft-deleted."""
    offset = (page - 1) * per_page
    data, total = await _sim_service.list_all_simulations(
        admin_supabase, include_deleted=include_deleted, limit=per_page, offset=offset,
    )
    return {"success": True, "data": data, "meta": {"total": total, "page": page, "per_page": per_page}}


@router.get("/simulations/deleted")
async def list_deleted_simulations(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """List only soft-deleted simulations (trash view)."""
    offset = (page - 1) * per_page
    data, total = await _sim_service.list_deleted_simulations(
        admin_supabase, limit=per_page, offset=offset,
    )
    return {"success": True, "data": data, "meta": {"total": total, "page": page, "per_page": per_page}}


@router.post("/simulations/{simulation_id}/restore")
async def restore_simulation(
    simulation_id: UUID,
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Restore a soft-deleted simulation."""
    data = await _sim_service.restore_simulation(admin_supabase, simulation_id)
    return {"success": True, "data": data}


@router.delete("/simulations/{simulation_id}")
async def admin_delete_simulation(
    simulation_id: UUID,
    hard: bool = Query(default=False, description="Permanently delete instead of soft-delete"),
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Admin delete a simulation. Use hard=true for permanent deletion."""
    if hard:
        data = await _sim_service.hard_delete_simulation(admin_supabase, simulation_id)
        return {"success": True, "data": {"deleted": True, "simulation": data}}
    else:
        data = await _sim_service.delete_simulation(admin_supabase, simulation_id)
        return {"success": True, "data": data}


def _invalidate_caches(key: str) -> None:
    """Clear relevant in-process caches when settings change."""
    # Invalidate the global TTL config so next access reads fresh values
    invalidate_cache_config()

    if key == "cache_map_data_ttl":
        from backend.services.echo_service import ConnectionService
        ConnectionService._map_data_cache.clear()
    elif key == "cache_seo_metadata_ttl":
        from backend.middleware.seo import _sim_meta_cache
        _sim_meta_cache.clear()
