"""Simulation settings endpoints with encryption support."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_current_user, get_supabase, require_role
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.settings import SettingCreate, SettingResponse, SettingUpdate
from backend.services.settings_service import SettingsService
from supabase import Client

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/settings",
    tags=["settings"],
)

_service = SettingsService()


@router.get("", response_model=SuccessResponse[list[SettingResponse]])
async def list_settings(
    simulation_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
    category: str | None = Query(default=None),
) -> dict:
    """List all settings, optionally filtered by category."""
    data = await _service.list_settings(supabase, simulation_id, category=category)
    return {"success": True, "data": data}


@router.get("/by-category/{category}", response_model=SuccessResponse[list[SettingResponse]])
async def get_by_category(
    simulation_id: UUID,
    category: str,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get all settings in a specific category."""
    data = await _service.list_settings(supabase, simulation_id, category=category)
    return {"success": True, "data": data}


@router.get("/{setting_id}", response_model=SuccessResponse[SettingResponse])
async def get_setting(
    simulation_id: UUID,
    setting_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("viewer")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get a single setting by ID."""
    setting = await _service.get_setting(supabase, simulation_id, setting_id)
    return {"success": True, "data": setting}


@router.post("", response_model=SuccessResponse[SettingResponse], status_code=201)
async def upsert_setting(
    simulation_id: UUID,
    body: SettingCreate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Create or update a setting. Sensitive keys are encrypted automatically."""
    setting = await _service.upsert_setting(
        supabase, simulation_id, user.id, body.model_dump(),
    )
    return {"success": True, "data": setting}


@router.put("/{setting_id}", response_model=SuccessResponse[SettingResponse])
async def update_setting(
    simulation_id: UUID,
    setting_id: UUID,
    body: SettingUpdate,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update a setting value by ID. For full upsert by key, use POST."""
    # Get existing setting to preserve category/key
    existing = await _service.get_setting(supabase, simulation_id, setting_id)
    setting = await _service.upsert_setting(
        supabase,
        simulation_id,
        user.id,
        {
            "category": existing["category"],
            "setting_key": existing["setting_key"],
            "setting_value": body.setting_value,
        },
    )
    return {"success": True, "data": setting}


@router.delete("/{setting_id}", response_model=SuccessResponse[dict])
async def delete_setting(
    simulation_id: UUID,
    setting_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    _role_check: str = Depends(require_role("admin")),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Delete a setting."""
    await _service.delete_setting(supabase, simulation_id, setting_id)
    return {"success": True, "data": {"message": "Setting deleted."}}
