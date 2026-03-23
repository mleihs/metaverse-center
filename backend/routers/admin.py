"""Platform admin router — settings and user management.

All endpoints require platform admin (email allowlist).
Uses admin (service_role) Supabase client for cross-table operations.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from backend.config import settings
from backend.dependencies import get_admin_supabase, require_platform_admin
from backend.middleware.rate_limit import RATE_LIMIT_ADMIN_MUTATION, limiter
from backend.middleware.seo import _sim_meta_cache
from backend.models.cleanup import CleanupExecuteRequest, CleanupPreviewRequest
from backend.models.common import CurrentUser, PaginationMeta
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

    # Invalidate research domain cache when domain settings change
    if key.startswith("research_domains_"):
        invalidate_research_domains()

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
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def delete_user(
    request: Request,
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
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def update_user_wallet(
    request: Request,
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


# --- Health Effects Control ---


@router.get("/health-effects")
async def get_health_effects(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Return global + per-simulation health effects state for admin tab."""
    # 1. Global setting
    try:
        row = await PlatformSettingsService.get(
            admin_supabase, "critical_health_effects_enabled",
        )
        global_enabled = str(row.get("setting_value", "true")).strip('"') != "false"
    except HTTPException:
        global_enabled = True

    # 2. All active simulations
    sims_data, _total = await _sim_service.list_all_simulations(
        admin_supabase, include_deleted=False, limit=200, offset=0,
    )

    sim_ids = [str(s["id"]) for s in sims_data]

    # 3. Health data from materialized view (via service)
    health_rows = await GameMechanicsService.list_simulation_health(admin_supabase)
    health_map: dict[str, dict] = {h["simulation_id"]: h for h in health_rows}

    # 4. Per-sim health effects settings (via service)
    effects_rows = await SettingsService.batch_get_by_key(
        admin_supabase, sim_ids, "game", "critical_health_effects_enabled",
    )
    effects_map: dict[str, str] = {}
    for s in effects_rows:
        raw = s.get("setting_value", "true")
        effects_map[s["simulation_id"]] = str(raw).strip('"')

    # 5. Build response
    simulations = []
    for sim in sims_data:
        sid = str(sim["id"])
        health = health_map.get(sid, {})
        oh = health.get("overall_health", 0.5)
        if oh < 0.25:
            ts = "critical"
        elif oh > 0.85:
            ts = "ascendant"
        else:
            ts = "normal"

        sim_enabled = effects_map.get(sid, "true") != "false"
        simulations.append({
            "id": sid,
            "name": sim.get("name", ""),
            "slug": sim.get("slug", ""),
            "overall_health": round(oh, 4),
            "threshold_state": ts,
            "effects_enabled": sim_enabled,
        })

    return {
        "success": True,
        "data": {
            "global_enabled": global_enabled,
            "simulations": simulations,
        },
    }


@router.put("/health-effects/simulations/{simulation_id}")
async def update_simulation_health_effects(
    simulation_id: UUID,
    body: HealthEffectsToggle,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
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


# --- Impersonation ---


@router.post("/impersonate")
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def impersonate_user(
    request: Request,
    body: ImpersonateRequest,
    admin_user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
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


@router.get("/ai-usage/stats")
async def get_ai_usage_stats(
    days: int = Query(default=30, ge=1, le=365),
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Get aggregated AI usage stats for the platform.

    Queries ``ai_usage_log`` (migration 150) for the specified period.
    Returns breakdowns by provider, model, purpose, simulation, and daily trend.
    """
    from datetime import UTC, datetime, timedelta

    since = (datetime.now(UTC) - timedelta(days=days)).isoformat()

    # Fetch raw logs for the period (limit 10k for safety)
    resp = await (
        admin_supabase.table("ai_usage_log")
        .select(
            "provider, model, purpose, simulation_id, prompt_tokens,"
            " completion_tokens, total_tokens, duration_ms,"
            " estimated_cost_usd, key_source, created_at"
        )
        .gte("created_at", since)
        .order("created_at", desc=True)
        .limit(10000)
        .execute()
    )
    rows = resp.data or []

    # Aggregate in Python (small dataset, no need for PG function yet)
    total_calls = len(rows)
    total_tokens = sum(r.get("total_tokens", 0) for r in rows)
    total_cost = sum(float(r.get("estimated_cost_usd", 0)) for r in rows)

    by_provider: dict[str, dict] = {}
    by_model: dict[str, dict] = {}
    by_purpose: dict[str, dict] = {}
    by_simulation: dict[str, dict] = {}
    by_day: dict[str, dict] = {}
    key_sources: dict[str, dict] = {}

    for r in rows:
        provider = r.get("provider", "unknown")
        model = r.get("model", "unknown")
        purpose = r.get("purpose", "unknown")
        sim_id = r.get("simulation_id") or "platform"
        cost = float(r.get("estimated_cost_usd", 0))
        tokens = r.get("total_tokens", 0)
        ks = r.get("key_source", "env")
        day = (r.get("created_at") or "")[:10]

        for key, bucket in [
            (provider, by_provider), (model, by_model),
            (purpose, by_purpose), (sim_id, by_simulation),
            (day, by_day), (ks, key_sources),
        ]:
            if key not in bucket:
                bucket[key] = {"calls": 0, "tokens": 0, "cost": 0.0}
            bucket[key]["calls"] += 1
            bucket[key]["tokens"] += tokens
            bucket[key]["cost"] += cost

    def _to_list(d: dict, key_name: str = "name") -> list[dict]:
        return sorted(
            [{key_name: k, **v} for k, v in d.items()],
            key=lambda x: x["cost"], reverse=True,
        )

    return {
        "success": True,
        "data": {
            "period_days": days,
            "total_calls": total_calls,
            "total_tokens": total_tokens,
            "total_cost_usd": round(total_cost, 4),
            "avg_cost_per_call": round(total_cost / total_calls, 6) if total_calls else 0,
            "by_provider": _to_list(by_provider, "provider"),
            "by_model": _to_list(by_model, "model"),
            "by_purpose": _to_list(by_purpose, "purpose"),
            "by_simulation": _to_list(by_simulation, "simulation_id"),
            "daily_trend": sorted(
                [{"date": k, **v} for k, v in by_day.items()],
                key=lambda x: x["date"],
            ),
            "key_sources": key_sources,
        },
    }
