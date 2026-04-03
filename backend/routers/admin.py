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
from backend.models.cleanup import CleanupExecuteRequest, CleanupPreviewRequest
from backend.models.common import CurrentUser, DeleteResponse, PaginatedResponse, PaginationMeta, SuccessResponse
from backend.models.settings import is_sensitive_key
from backend.services.admin_user_service import AdminUserService
from backend.services.audit_service import AuditService
from backend.services.cache_config import invalidate as invalidate_cache_config
from backend.services.cleanup_service import CleanupService
from backend.services.connection_service import ConnectionService
from backend.services.game_mechanics_service import GameMechanicsService
from backend.services.platform_api_keys import invalidate as invalidate_api_key_cache
from backend.services.platform_model_config import invalidate as invalidate_model_config
from backend.services.platform_research_domains import invalidate as invalidate_research_domains
from backend.services.platform_settings_service import PlatformSettingsService
from backend.services.settings_service import SettingsService
from backend.services.simulation_service import SimulationService
from backend.utils.encryption import encrypt as encrypt_value
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


@router.get("/environment", response_model=SuccessResponse[dict])
async def get_environment(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
) -> dict:
    """Return the current server environment (production/development)."""
    return {"success": True, "data": {"environment": settings.environment}}


# --- Platform Settings Endpoints ---


@router.get("/settings", response_model=SuccessResponse[list])
async def list_settings(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> dict:
    """List all platform settings."""
    data = await PlatformSettingsService.list_all(admin_supabase, mask_sensitive=True)
    return {"success": True, "data": data}


@router.put("/settings/{key}", response_model=SuccessResponse[dict])
async def update_setting(
    key: str,
    body: UpdateSettingRequest,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
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

    # Invalidate research domain cache when domain settings change
    if key.startswith("research_domains_"):
        invalidate_research_domains()

    return {"success": True, "data": data}


# --- User Management Endpoints ---


@router.get("/users", response_model=SuccessResponse[dict])
async def list_users(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 50,
) -> dict:
    """List all platform users."""
    data = await AdminUserService.list_users(admin_supabase, page=page, per_page=per_page)
    return {"success": True, "data": data}


@router.get("/users/{user_id}", response_model=SuccessResponse[dict])
async def get_user(
    user_id: UUID,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> dict:
    """Get user detail with all simulation memberships."""
    data = await AdminUserService.get_user_with_memberships(admin_supabase, user_id)
    return {"success": True, "data": data}


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
        admin_supabase, None, _user.id, "users", user_id, "delete",
    )
    return SuccessResponse(data=DeleteResponse())


@router.post("/users/{user_id}/memberships", response_model=SuccessResponse[dict])
async def add_membership(
    user_id: UUID,
    body: AddMembershipRequest,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
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


@router.put("/users/{user_id}/memberships/{simulation_id}", response_model=SuccessResponse[dict])
async def change_membership_role(
    user_id: UUID,
    simulation_id: UUID,
    body: ChangeMembershipRoleRequest,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
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


@router.delete("/users/{user_id}/memberships/{simulation_id}", response_model=SuccessResponse[dict])
async def remove_membership(
    user_id: UUID,
    simulation_id: UUID,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> dict:
    """Remove a user from a simulation."""
    data = await AdminUserService.remove_membership(admin_supabase, user_id, simulation_id)
    await AuditService.safe_log(
        admin_supabase, simulation_id, _user.id, "simulation_members", user_id, "delete",
    )
    return {"success": True, "data": data}


@router.put("/users/{user_id}/wallet", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def update_user_wallet(
    request: Request,
    user_id: UUID,
    body: UpdateUserWalletRequest,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
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


@router.get("/cleanup/stats", response_model=SuccessResponse[dict])
async def get_cleanup_stats(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> dict:
    """Get record counts per cleanup category."""
    data = await CleanupService.get_stats(admin_supabase)
    return {"success": True, "data": data.model_dump(mode="json")}


@router.post("/cleanup/preview", response_model=SuccessResponse[dict])
async def preview_cleanup(
    body: CleanupPreviewRequest,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> dict:
    """Preview what would be deleted without actually deleting."""
    data = await CleanupService.preview(
        admin_supabase, body.cleanup_type, body.min_age_days, epoch_ids=body.epoch_ids,
    )
    return {"success": True, "data": data.model_dump(mode="json")}


@router.post("/cleanup/execute", response_model=SuccessResponse[dict])
async def execute_cleanup(
    body: CleanupExecuteRequest,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
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


@router.get("/simulations", response_model=PaginatedResponse[dict])
async def list_simulations(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    include_deleted: Annotated[bool, Query()] = False,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 50,
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


@router.get("/simulations/deleted", response_model=PaginatedResponse[dict])
async def list_deleted_simulations(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 50,
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


@router.post("/simulations/{simulation_id}/restore", response_model=SuccessResponse[dict])
async def restore_simulation(
    simulation_id: UUID,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> dict:
    """Restore a soft-deleted simulation."""
    data = await _sim_service.restore_simulation(admin_supabase, simulation_id)
    await AuditService.safe_log(
        admin_supabase, simulation_id, _user.id, "simulations", simulation_id, "restore",
    )
    return {"success": True, "data": data}


@router.delete("/simulations/{simulation_id}", response_model=SuccessResponse[dict])
async def admin_delete_simulation(
    simulation_id: UUID,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    hard: Annotated[bool, Query(description="Permanently delete instead of soft-delete")] = False,
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


# --- Health Effects Control ---


@router.get("/health-effects", response_model=SuccessResponse[dict])
async def get_health_effects(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> dict:
    """Return global + per-simulation health effects state for admin tab."""
    data = await GameMechanicsService.get_health_effects_dashboard(admin_supabase)
    return {"success": True, "data": data}


@router.put("/health-effects/simulations/{simulation_id}", response_model=SuccessResponse[dict])
async def update_simulation_health_effects(
    simulation_id: UUID,
    body: HealthEffectsToggle,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> dict:
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
        admin_supabase, simulation_id, user.id,
        "simulation_settings", "critical_health_effects_enabled", "update",
        details={"enabled": body.enabled},
    )
    return {"success": True, "data": {"enabled": body.enabled}}


# --- Dungeon Global Config ---


@router.get("/dungeon-config/global", response_model=SuccessResponse[dict])
async def get_dungeon_global_config(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> dict:
    """Return global dungeon configuration (override mode + clearance)."""
    config = await PlatformSettingsService.get_dungeon_global_config(admin_supabase)
    return {"success": True, "data": dict(config)}


@router.put("/dungeon-config/global", response_model=SuccessResponse[dict])
async def update_dungeon_global_config(
    body: DungeonGlobalConfigUpdate,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> dict:
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
        admin_supabase, None, user.id,
        "platform_settings", "dungeon_global_config", "update",
        details=dict(config),
    )
    return {"success": True, "data": dict(config)}


# --- Dungeon Per-Simulation Override ---


@router.get("/dungeon-override", response_model=SuccessResponse[list[dict]])
async def list_dungeon_overrides(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> dict:
    """List all template simulations with their dungeon override configs (bulk).

    Excludes game_instance (epoch) and archived simulations — dungeon
    overrides are only meaningful for template (base) simulations.
    """
    sim_resp = (
        await admin_supabase.table("simulations")
        .select("id, name, slug")
        .eq("simulation_type", "template")
        .is_("deleted_at", "null")
        .order("name")
        .execute()
    )
    simulations = sim_resp.data or []

    # Fetch all dungeon override settings in one query
    override_resp = (
        await admin_supabase.table("simulation_settings")
        .select("simulation_id, setting_value")
        .eq("category", "game")
        .eq("setting_key", "dungeon_override")
        .execute()
    )
    overrides_by_sim: dict[str, dict] = {
        row["simulation_id"]: row["setting_value"]
        for row in (override_resp.data or [])
        if isinstance(row.get("setting_value"), dict)
    }

    result = []
    for sim in simulations:
        config = overrides_by_sim.get(sim["id"], {})
        result.append({
            "id": sim["id"],
            "name": sim["name"],
            "slug": sim["slug"],
            "mode": config.get("mode", "off"),
            "archetypes": config.get("archetypes", []),
        })

    return {"success": True, "data": result}


@router.get("/dungeon-override/simulations/{simulation_id}", response_model=SuccessResponse[dict])
async def get_dungeon_override(
    simulation_id: UUID,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> dict:
    """Get dungeon override config for a simulation."""
    resp = (
        await admin_supabase.table("simulation_settings")
        .select("setting_value")
        .eq("simulation_id", str(simulation_id))
        .eq("category", "game")
        .eq("setting_key", "dungeon_override")
        .maybe_single()
        .execute()
    )
    config = resp.data.get("setting_value", {}) if resp.data else {}
    return {
        "success": True,
        "data": {
            "mode": config.get("mode", "off"),
            "archetypes": config.get("archetypes", []),
        },
    }


@router.put("/dungeon-override/simulations/{simulation_id}", response_model=SuccessResponse[dict])
async def update_dungeon_override(
    simulation_id: UUID,
    body: DungeonOverrideUpdate,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> dict:
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
        admin_supabase, simulation_id, user.id,
        "simulation_settings", "dungeon_override", "update",
        details=config,
    )
    return {"success": True, "data": config}


# --- Impersonation ---


@router.post("/impersonate", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def impersonate_user(
    request: Request,
    body: ImpersonateRequest,
    admin_user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> dict:
    """Generate a magic link token to impersonate a user (platform admin only)."""
    user_response = await admin_supabase.auth.admin.get_user_by_id(str(body.user_id))
    user = user_response.user
    if not user or not user.email:
        raise HTTPException(status_code=404, detail="User not found")

    link_response = await admin_supabase.auth.admin.generate_link({
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


# ── AI Usage Analytics ─────────────────────────────────────────────────


@router.get("/ai-usage/stats", response_model=SuccessResponse[dict])
async def get_ai_usage_stats(
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> dict:
    """Get aggregated AI usage stats for the platform."""
    from backend.services.ai_usage_service import AIUsageService

    data = await AIUsageService.get_platform_stats(admin_supabase, days=days)
    return {"success": True, "data": data}


# --- Dungeon Showcase Image Generation ---


class ShowcaseImageRequest(BaseModel):
    """Request to generate a showcase background image for a dungeon archetype."""

    archetype_id: str = Field(
        ...,
        description="Archetype key: shadow, tower, mother, entropy, prometheus, deluge, awakening, overthrow",
    )


@router.post("/dungeon-showcase/generate-image", response_model=SuccessResponse[dict])
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def generate_showcase_image_endpoint(
    request: Request,
    body: ShowcaseImageRequest,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> dict:
    """Generate a showcase background image for a dungeon archetype.

    Uses archetype-specific AI models and art-historically informed prompts.
    Uploads the result to Supabase Storage as AVIF (full + thumbnail).
    Returns the public thumbnail URL.
    """
    from backend.services.dungeon.showcase_image_service import (
        ARCHETYPE_VISUALS,
        generate_showcase_image,
    )
    from backend.services.external.openrouter import OpenRouterService
    from backend.services.image_service import AVIF_QUALITY, _convert_to_avif

    if body.archetype_id not in ARCHETYPE_VISUALS:
        valid = ", ".join(sorted(ARCHETYPE_VISUALS))
        raise HTTPException(status_code=400, detail=f"Unknown archetype. Valid: {valid}")

    visual = ARCHETYPE_VISUALS[body.archetype_id]
    openrouter = OpenRouterService()
    raw_bytes = await generate_showcase_image(openrouter, body.archetype_id)

    # Convert to AVIF (full + thumb)
    full_avif = _convert_to_avif(raw_bytes, max_dimension=None, quality=AVIF_QUALITY)
    thumb_avif = _convert_to_avif(raw_bytes, max_dimension=1920, quality=AVIF_QUALITY)

    # Upload to simulation.assets/showcase/
    base_path = f"showcase/dungeon-{body.archetype_id}.avif"
    full_path = f"showcase/dungeon-{body.archetype_id}.full.avif"

    await admin_supabase.storage.from_("simulation.assets").upload(
        full_path, full_avif, {"content-type": "image/avif", "upsert": "true"},
    )
    await admin_supabase.storage.from_("simulation.assets").upload(
        base_path, thumb_avif, {"content-type": "image/avif", "upsert": "true"},
    )

    public_url = admin_supabase.storage.from_("simulation.assets").get_public_url(base_path)

    return {
        "success": True,
        "data": {
            "archetype": body.archetype_id,
            "model": visual.model,
            "url": public_url,
            "full_path": full_path,
            "thumb_path": base_path,
            "bytes": len(raw_bytes),
            "usage": openrouter.last_usage,
        },
    }
