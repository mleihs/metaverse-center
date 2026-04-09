"""Platform admin router — settings and user management.

All endpoints require platform admin (email allowlist).
Uses admin (service_role) Supabase client for cross-table operations.
"""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from backend.config import settings
from backend.dependencies import get_admin_supabase, require_platform_admin
from backend.middleware.rate_limit import RATE_LIMIT_ADMIN_MUTATION, limiter
from backend.middleware.seo import _sim_meta_cache
from backend.models.admin import (
    AdminMembershipResponse,
    AdminSimulationListItem,
    AdminUserDetailResponse,
    AdminUserListResponse,
    AdminWalletResponse,
    AIUsageStatsResponse,
    DungeonGlobalConfigResponse,
    DungeonOverrideListEntry,
    DungeonOverrideResponse,
    EnvironmentResponse,
    HealthEffectsDashboard,
    HealthEffectsToggleResponse,
    ImpersonateResponse,
    PlatformSettingResponse,
    ShowcaseImageResponse,
)
from backend.models.cleanup import (
    CleanupExecuteRequest,
    CleanupExecuteResult,
    CleanupPreviewRequest,
    CleanupPreviewResult,
    CleanupStats,
)
from backend.models.common import CurrentUser, DeleteResponse, PaginatedResponse, SuccessResponse
from backend.models.settings import is_sensitive_key
from backend.models.simulation import SimulationResponse
from backend.services.admin_user_service import AdminUserService
from backend.services.ai_usage_service import AIUsageService
from backend.services.audit_service import AuditService
from backend.services.cache_config import invalidate as invalidate_cache_config
from backend.services.cleanup_service import CleanupService
from backend.services.connection_service import ConnectionService
from backend.services.dungeon.showcase_image_service import ARCHETYPE_VISUALS, generate_and_upload_showcase
from backend.services.game_mechanics_service import GameMechanicsService
from backend.services.platform_api_keys import invalidate as invalidate_api_key_cache
from backend.services.platform_model_config import invalidate as invalidate_model_config
from backend.services.platform_research_domains import invalidate as invalidate_research_domains
from backend.services.platform_settings_service import PlatformSettingsService
from backend.services.settings_service import SettingsService
from backend.services.simulation_service import SimulationService
from backend.utils.encryption import encrypt as encrypt_value
from backend.utils.responses import paginated
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

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


class HealthEffectsToggle(BaseModel):
    enabled: bool


class DungeonOverrideUpdate(BaseModel):
    """Configure which dungeons are admin-unlocked for a simulation.

    mode:
      - "supplement": Admin archetypes added alongside resonance-based ones
      - "override": Only admin archetypes available, resonance logic bypassed
      - "off": No admin overrides (resonance logic only)
    archetypes: List of archetype names to unlock (e.g. ["The Shadow", "The Tower"])
    """

    mode: str = Field(default="off", pattern="^(off|supplement|override)$")
    archetypes: list[str] = Field(default_factory=list)


class DungeonGlobalConfigUpdate(BaseModel):
    """Global dungeon configuration — cascading defaults for all simulations.

    override_mode: Global archetype override (same semantics as per-sim).
    override_archetypes: Global archetype list.
    clearance_mode: Terminal clearance requirement for dungeon commands.
      - "off": All dungeon commands bypass clearance tier check.
      - "standard": Tier 2 after 10 commands (default).
      - "custom": Tier 2 after custom threshold commands.
    clearance_threshold: Command count threshold (used when clearance_mode=custom).
    """

    override_mode: str = Field(default="off", pattern="^(off|supplement|override)$")
    override_archetypes: list[str] = Field(default_factory=list)
    clearance_mode: str = Field(default="standard", pattern="^(off|standard|custom)$")
    clearance_threshold: int = Field(default=10, ge=0, le=100)


class ImpersonateRequest(BaseModel):
    user_id: UUID


# --- Environment ---


@router.get("/environment")
async def get_environment(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
) -> SuccessResponse[EnvironmentResponse]:
    """Return the current server environment (production/development)."""
    return SuccessResponse(data={"environment": settings.environment})


# --- Platform Settings Endpoints ---


@router.get("/settings")
async def list_settings(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[list[PlatformSettingResponse]]:
    """List all platform settings."""
    data = await PlatformSettingsService.list_all(admin_supabase, mask_sensitive=True)
    return SuccessResponse(data=data)


@router.put("/settings/{key}")
async def update_setting(
    key: str,
    body: UpdateSettingRequest,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[PlatformSettingResponse]:
    """Update a platform setting value."""
    value = body.value
    # Encrypt non-empty sensitive values before storing
    if is_sensitive_key(key) and isinstance(value, str) and value:
        value = encrypt_value(value)

    data = await PlatformSettingsService.update(admin_supabase, key, value, user.id)
    await AuditService.safe_log(
        admin_supabase,
        None,
        user.id,
        "platform_settings",
        key,
        "update",
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

    # Invalidate research domain cache when domain settings change
    if key.startswith("research_domains_"):
        invalidate_research_domains()

    return SuccessResponse(data=data)


# --- User Management Endpoints ---


@router.get("/users")
async def list_users(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 50,
) -> SuccessResponse[AdminUserListResponse]:
    """List all platform users."""
    data = await AdminUserService.list_users(admin_supabase, page=page, per_page=per_page)
    return SuccessResponse(data=data)


@router.get("/users/{user_id}")
async def get_user(
    user_id: UUID,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[AdminUserDetailResponse]:
    """Get user detail with all simulation memberships."""
    data = await AdminUserService.get_user_with_memberships(admin_supabase, user_id)
    return SuccessResponse(data=data)


@router.delete("/users/{user_id}")
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def delete_user(
    request: Request,
    user_id: UUID,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[DeleteResponse]:
    """Delete a user from the platform."""
    await AdminUserService.delete_user(admin_supabase, user_id)
    await AuditService.safe_log(
        admin_supabase,
        None,
        _user.id,
        "users",
        user_id,
        "delete",
    )
    return SuccessResponse(data=DeleteResponse())


@router.post("/users/{user_id}/memberships")
async def add_membership(
    user_id: UUID,
    body: AddMembershipRequest,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[AdminMembershipResponse]:
    """Add a user to a simulation with a role."""
    data = await AdminUserService.add_membership(
        admin_supabase,
        user_id,
        body.simulation_id,
        body.role,
    )
    await AuditService.safe_log(
        admin_supabase,
        body.simulation_id,
        _user.id,
        "simulation_members",
        user_id,
        "create",
        details={"role": body.role},
    )
    return SuccessResponse(data=data)


@router.put("/users/{user_id}/memberships/{simulation_id}")
async def change_membership_role(
    user_id: UUID,
    simulation_id: UUID,
    body: ChangeMembershipRoleRequest,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[AdminMembershipResponse]:
    """Change a user's role in a simulation."""
    data = await AdminUserService.change_membership_role(
        admin_supabase,
        user_id,
        simulation_id,
        body.role,
    )
    await AuditService.safe_log(
        admin_supabase,
        simulation_id,
        _user.id,
        "simulation_members",
        user_id,
        "update",
        details={"new_role": body.role},
    )
    return SuccessResponse(data=data)


@router.delete("/users/{user_id}/memberships/{simulation_id}")
async def remove_membership(
    user_id: UUID,
    simulation_id: UUID,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[AdminMembershipResponse]:
    """Remove a user from a simulation."""
    data = await AdminUserService.remove_membership(admin_supabase, user_id, simulation_id)
    await AuditService.safe_log(
        admin_supabase,
        simulation_id,
        _user.id,
        "simulation_members",
        user_id,
        "delete",
    )
    return SuccessResponse(data=data)


@router.put("/users/{user_id}/wallet")
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def update_user_wallet(
    request: Request,
    user_id: UUID,
    body: UpdateUserWalletRequest,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[AdminWalletResponse]:
    """Update a user's forge wallet settings."""
    data = await AdminUserService.update_user_wallet(
        admin_supabase,
        user_id,
        body.forge_tokens,
        body.is_architect,
    )
    await AuditService.safe_log(
        admin_supabase,
        None,
        _user.id,
        "user_wallets",
        user_id,
        "update",
        details={"forge_tokens": body.forge_tokens, "is_architect": body.is_architect},
    )
    return SuccessResponse(data=data)


# --- Data Cleanup Endpoints ---


@router.get("/cleanup/stats")
async def get_cleanup_stats(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[CleanupStats]:
    """Get record counts per cleanup category."""
    data = await CleanupService.get_stats(admin_supabase)
    return SuccessResponse(data=data)


@router.post("/cleanup/preview")
async def preview_cleanup(
    body: CleanupPreviewRequest,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[CleanupPreviewResult]:
    """Preview what would be deleted without actually deleting."""
    data = await CleanupService.preview(
        admin_supabase,
        body.cleanup_type,
        body.min_age_days,
        epoch_ids=body.epoch_ids,
    )
    return SuccessResponse(data=data)


@router.post("/cleanup/execute")
async def execute_cleanup(
    body: CleanupExecuteRequest,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[CleanupExecuteResult]:
    """Execute data cleanup. Requires prior preview for safety."""
    data = await CleanupService.execute(
        admin_supabase,
        body.cleanup_type,
        body.min_age_days,
        user.id,
        epoch_ids=body.epoch_ids,
    )
    await AuditService.safe_log(
        admin_supabase,
        None,
        user.id,
        "cleanup",
        None,
        "execute",
        details={"cleanup_type": body.cleanup_type, "min_age_days": body.min_age_days},
    )
    return SuccessResponse(data=data)


# --- Simulation Management Endpoints ---

_sim_service = SimulationService()


@router.get("/simulations")
async def list_simulations(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    include_deleted: Annotated[bool, Query()] = False,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 50,
) -> PaginatedResponse[AdminSimulationListItem]:
    """List all simulations (admin). Optionally include soft-deleted."""
    offset = (page - 1) * per_page
    data, total = await _sim_service.list_all_simulations(
        admin_supabase,
        include_deleted=include_deleted,
        limit=per_page,
        offset=offset,
    )
    return paginated(data, total, per_page, offset)


@router.get("/simulations/deleted")
async def list_deleted_simulations(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 50,
) -> PaginatedResponse[AdminSimulationListItem]:
    """List only soft-deleted simulations (trash view)."""
    offset = (page - 1) * per_page
    data, total = await _sim_service.list_deleted_simulations(
        admin_supabase,
        limit=per_page,
        offset=offset,
    )
    return paginated(data, total, per_page, offset)


@router.post("/simulations/{simulation_id}/restore")
async def restore_simulation(
    simulation_id: UUID,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[SimulationResponse]:
    """Restore a soft-deleted simulation."""
    data = await _sim_service.restore_simulation(admin_supabase, simulation_id)
    await AuditService.safe_log(
        admin_supabase,
        simulation_id,
        _user.id,
        "simulations",
        simulation_id,
        "restore",
    )
    return SuccessResponse(data=data)


@router.delete("/simulations/{simulation_id}")
async def admin_delete_simulation(
    simulation_id: UUID,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    hard: Annotated[bool, Query(description="Permanently delete instead of soft-delete")] = False,
) -> SuccessResponse[dict]:
    """Admin delete a simulation. Use hard=true for permanent deletion."""
    if hard:
        data = await _sim_service.hard_delete_simulation(admin_supabase, simulation_id)
        await AuditService.safe_log(
            admin_supabase,
            simulation_id,
            _user.id,
            "simulations",
            simulation_id,
            "hard_delete",
        )
        return SuccessResponse(data={"deleted": True, "simulation": data})
    else:
        data = await _sim_service.delete_simulation(admin_supabase, simulation_id)
        await AuditService.safe_log(
            admin_supabase,
            simulation_id,
            _user.id,
            "simulations",
            simulation_id,
            "delete",
        )
        return SuccessResponse(data=data)


# --- Health Effects Control ---


@router.get("/health-effects")
async def get_health_effects(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[HealthEffectsDashboard]:
    """Return global + per-simulation health effects state for admin tab."""
    data = await GameMechanicsService.get_health_effects_dashboard(admin_supabase)
    return SuccessResponse(data=data)


@router.put("/health-effects/simulations/{simulation_id}")
async def update_simulation_health_effects(
    simulation_id: UUID,
    body: HealthEffectsToggle,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[HealthEffectsToggleResponse]:
    """Toggle critical health effects for a specific simulation."""
    await SettingsService.upsert_setting(
        admin_supabase,
        simulation_id,
        user.id,
        {
            "category": "game",
            "setting_key": "critical_health_effects_enabled",
            "setting_value": str(body.enabled).lower(),
        },
    )
    await AuditService.safe_log(
        admin_supabase,
        simulation_id,
        user.id,
        "simulation_settings",
        "critical_health_effects_enabled",
        "update",
        details={"enabled": body.enabled},
    )
    return SuccessResponse(data={"enabled": body.enabled})


# --- Dungeon Global Config ---


@router.get("/dungeon-config/global")
async def get_dungeon_global_config(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[DungeonGlobalConfigResponse]:
    """Return global dungeon configuration (override mode + clearance)."""
    config = await PlatformSettingsService.get_dungeon_global_config(admin_supabase)
    return SuccessResponse(data=config)


@router.put("/dungeon-config/global")
async def update_dungeon_global_config(
    body: DungeonGlobalConfigUpdate,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[DungeonGlobalConfigResponse]:
    """Update global dungeon configuration (override mode + clearance)."""
    config = await PlatformSettingsService.update_dungeon_global_config(
        admin_supabase,
        user.id,
        override_mode=body.override_mode,
        override_archetypes=body.override_archetypes,
        clearance_mode=body.clearance_mode,
        clearance_threshold=body.clearance_threshold,
    )
    await AuditService.safe_log(
        admin_supabase,
        None,
        user.id,
        "platform_settings",
        "dungeon_global_config",
        "update",
        details=dict(config),
    )
    return SuccessResponse(data=config)


# --- Dungeon Per-Simulation Override ---


@router.get("/dungeon-override")
async def list_dungeon_overrides(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[list[DungeonOverrideListEntry]]:
    """List all template simulations with their dungeon override configs (bulk).

    Excludes game_instance (epoch) and archived simulations — dungeon
    overrides are only meaningful for template (base) simulations.
    """
    data = await SettingsService.list_dungeon_overrides(admin_supabase)
    return SuccessResponse(data=data)


@router.get("/dungeon-override/simulations/{simulation_id}")
async def get_dungeon_override(
    simulation_id: UUID,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[DungeonOverrideResponse]:
    """Get dungeon override config for a simulation."""
    data = await SettingsService.get_dungeon_override(admin_supabase, simulation_id)
    return SuccessResponse(data=data)


@router.put("/dungeon-override/simulations/{simulation_id}")
async def update_dungeon_override(
    simulation_id: UUID,
    body: DungeonOverrideUpdate,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[DungeonOverrideResponse]:
    """Configure dungeon override for a simulation.

    mode=off: resonance logic only (default).
    mode=supplement: admin archetypes added alongside resonance results.
    mode=override: only admin archetypes, resonance bypassed.
    """
    config = {"mode": body.mode, "archetypes": body.archetypes}
    await SettingsService.upsert_setting(
        admin_supabase,
        simulation_id,
        user.id,
        {
            "category": "game",
            "setting_key": "dungeon_override",
            "setting_value": config,
        },
    )
    await AuditService.safe_log(
        admin_supabase,
        simulation_id,
        user.id,
        "simulation_settings",
        "dungeon_override",
        "update",
        details=config,
    )
    return SuccessResponse(data=config)


# --- Impersonation ---


@router.post("/impersonate")
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def impersonate_user(
    request: Request,
    body: ImpersonateRequest,
    admin_user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[ImpersonateResponse]:
    """Generate a magic link token to impersonate a user (platform admin only)."""
    user_response = await admin_supabase.auth.admin.get_user_by_id(str(body.user_id))
    user = user_response.user
    if not user or not user.email:
        raise HTTPException(status_code=404, detail="User not found")

    link_response = await admin_supabase.auth.admin.generate_link(
        {
            "type": "magiclink",
            "email": user.email,
        }
    )
    hashed_token = link_response.properties.hashed_token

    await AuditService.safe_log(
        admin_supabase,
        None,
        admin_user.id,
        "users",
        body.user_id,
        "impersonate",
        details={"target_email": user.email},
    )

    return SuccessResponse(data={"hashed_token": hashed_token, "email": user.email})


def _invalidate_caches(key: str) -> None:
    """Clear relevant in-process caches when settings change."""
    # Invalidate the global TTL config so next access reads fresh values
    invalidate_cache_config()

    if key == "cache_map_data_ttl":
        ConnectionService.invalidate_map_cache()
    elif key == "cache_seo_metadata_ttl":
        _sim_meta_cache.clear()


# ── AI Usage Analytics ─────────────────────────────────────────────────


@router.get("/ai-usage/stats")
async def get_ai_usage_stats(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> SuccessResponse[AIUsageStatsResponse]:
    """Get aggregated AI usage stats for the platform."""
    data = await AIUsageService.get_platform_stats(admin_supabase, days=days)
    return SuccessResponse(data=data)


# --- Dungeon Showcase Image Generation ---


class ShowcaseImageRequest(BaseModel):
    """Request to generate a showcase background image for a dungeon archetype."""

    archetype_id: str = Field(
        ...,
        description="Archetype key: shadow, tower, mother, entropy, prometheus, deluge, awakening, overthrow",
    )


@router.post("/dungeon-showcase/generate-image")
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def generate_showcase_image_endpoint(
    request: Request,
    body: ShowcaseImageRequest,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[ShowcaseImageResponse]:
    """Generate a showcase background image for a dungeon archetype.

    Uses archetype-specific AI models and art-historically informed prompts.
    Uploads the result to Supabase Storage as AVIF (full + thumbnail).
    Returns the public thumbnail URL.
    """
    if body.archetype_id not in ARCHETYPE_VISUALS:
        valid = ", ".join(sorted(ARCHETYPE_VISUALS))
        raise HTTPException(status_code=400, detail=f"Unknown archetype. Valid: {valid}")

    data = await generate_and_upload_showcase(admin_supabase, body.archetype_id)
    return SuccessResponse(data=data)
