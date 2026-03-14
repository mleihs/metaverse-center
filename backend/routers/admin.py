"""Platform admin router — settings and user management.

All endpoints require platform admin (email allowlist).
Uses admin (service_role) Supabase client for cross-table operations.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend.config import settings
from backend.dependencies import get_admin_supabase, require_platform_admin
from backend.models.cleanup import CleanupExecuteRequest, CleanupPreviewRequest
from backend.models.common import CurrentUser, PaginationMeta
from backend.models.settings import is_sensitive_key
from backend.services.admin_user_service import AdminUserService
from backend.services.cache_config import invalidate as invalidate_cache_config
from backend.services.cleanup_service import CleanupService
from backend.services.platform_api_keys import invalidate as invalidate_api_key_cache
from backend.services.platform_model_config import invalidate as invalidate_model_config
from backend.services.platform_settings_service import PlatformSettingsService
from backend.services.audit_service import AuditService
from backend.services.connection_service import ConnectionService
from backend.services.simulation_service import SimulationService
from backend.middleware.seo import _sim_meta_cache
from backend.utils.encryption import encrypt as encrypt_value
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


class ImpersonateRequest(BaseModel):
    user_id: UUID


# --- Environment ---


@router.get("/environment")
async def get_environment(
    _user: CurrentUser = Depends(require_platform_admin()),
) -> dict:
    """Return the current server environment (production/development)."""
    return {"success": True, "data": {"environment": settings.environment}}


# --- Platform Settings Endpoints ---


@router.get("/settings")
async def list_settings(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """List all platform settings."""
    data = await PlatformSettingsService.list_all(admin_supabase, mask_sensitive=True)
    return {"success": True, "data": data}


@router.put("/settings/{key}")
async def update_setting(
    key: str,
    body: UpdateSettingRequest,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Update a platform setting value."""
    value = body.value
    # Encrypt non-empty sensitive values before storing
    if is_sensitive_key(key) and isinstance(value, str) and value:
        value = encrypt_value(value)

    data = await PlatformSettingsService.update(admin_supabase, key, value, user.id)
    await AuditService.safe_log(
        admin_supabase, None, user.id, "platform_settings", key, "update",
        details={"key": key},
    )

    # Invalidate relevant caches when cache TTLs change
    if key.startswith("cache_"):
        _invalidate_caches(key)

    # Invalidate API key cache when sensitive keys change
    if is_sensitive_key(key):
        invalidate_api_key_cache()

    # Invalidate model config cache when model settings change
    if key.startswith("model_"):
        invalidate_model_config()

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
    await AuditService.safe_log(
        admin_supabase, None, _user.id, "users", user_id, "delete",
    )
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
    await AuditService.safe_log(
        admin_supabase, body.simulation_id, _user.id, "simulation_members", user_id, "create",
        details={"role": body.role},
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
    await AuditService.safe_log(
        admin_supabase, simulation_id, _user.id, "simulation_members", user_id, "update",
        details={"new_role": body.role},
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
    await AuditService.safe_log(
        admin_supabase, simulation_id, _user.id, "simulation_members", user_id, "delete",
    )
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
    await AuditService.safe_log(
        admin_supabase, None, _user.id, "user_wallets", user_id, "update",
        details={"forge_tokens": body.forge_tokens, "is_architect": body.is_architect},
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
    data = await CleanupService.preview(
        admin_supabase, body.cleanup_type, body.min_age_days, epoch_ids=body.epoch_ids,
    )
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
        epoch_ids=body.epoch_ids,
    )
    await AuditService.safe_log(
        admin_supabase, None, user.id, "cleanup", None, "execute",
        details={"cleanup_type": body.cleanup_type, "min_age_days": body.min_age_days},
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
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=per_page, offset=offset),
    }


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
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta(count=len(data), total=total, limit=per_page, offset=offset),
    }


@router.post("/simulations/{simulation_id}/restore")
async def restore_simulation(
    simulation_id: UUID,
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Restore a soft-deleted simulation."""
    data = await _sim_service.restore_simulation(admin_supabase, simulation_id)
    await AuditService.safe_log(
        admin_supabase, simulation_id, _user.id, "simulations", simulation_id, "restore",
    )
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
        await AuditService.safe_log(
            admin_supabase, simulation_id, _user.id, "simulations", simulation_id, "hard_delete",
        )
        return {"success": True, "data": {"deleted": True, "simulation": data}}
    else:
        data = await _sim_service.delete_simulation(admin_supabase, simulation_id)
        await AuditService.safe_log(
            admin_supabase, simulation_id, _user.id, "simulations", simulation_id, "delete",
        )
        return {"success": True, "data": data}


# --- Impersonation ---


@router.post("/impersonate")
async def impersonate_user(
    body: ImpersonateRequest,
    admin_user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Generate a magic link token to impersonate a user (platform admin only)."""
    user_response = admin_supabase.auth.admin.get_user_by_id(str(body.user_id))
    user = user_response.user
    if not user or not user.email:
        raise HTTPException(status_code=404, detail="User not found")

    link_response = admin_supabase.auth.admin.generate_link({
        "type": "magiclink",
        "email": user.email,
    })
    hashed_token = link_response.properties.hashed_token

    await AuditService.safe_log(
        admin_supabase, None, admin_user.id, "users", body.user_id, "impersonate",
        details={"target_email": user.email},
    )

    return {
        "success": True,
        "data": {"hashed_token": hashed_token, "email": user.email},
    }


def _invalidate_caches(key: str) -> None:
    """Clear relevant in-process caches when settings change."""
    # Invalidate the global TTL config so next access reads fresh values
    invalidate_cache_config()

    if key == "cache_map_data_ttl":
        ConnectionService._map_data_cache.clear()
    elif key == "cache_seo_metadata_ttl":
        _sim_meta_cache.clear()
