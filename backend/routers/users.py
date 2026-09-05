import logging
from typing import Annotated

from fastapi import APIRouter, Depends

from backend.dependencies import get_admin_supabase, get_current_user, get_effective_supabase, is_platform_admin
from backend.models.auth import ImagePreferencesResponse, ImagePreferencesUpdate
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.notification import NotificationPreferencesResponse, NotificationPreferencesUpdate
from backend.models.user import DashboardData, MembershipInfo, UserWithMemberships
from backend.services.audit_service import AuditService
from backend.services.member_service import MemberService
from backend.services.user_dashboard_service import UserDashboardService
from backend.services.user_profile_service import UserProfileService
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/me/dashboard")
async def get_dashboard(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[DashboardData]:
    """Get aggregated dashboard data for the authenticated user."""
    data = await UserDashboardService.get_dashboard(supabase, admin, user.id)
    return SuccessResponse(data=data)


@router.get("/me")
async def get_me(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    admin: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[UserWithMemberships]:
    """Get the current user's profile with simulation memberships."""
    rows = await MemberService.get_user_memberships(supabase, user.id)

    memberships = []
    for row in rows:
        sim_data = row.get("simulations") or {}
        memberships.append(
            MembershipInfo(
                simulation_id=row["simulation_id"],
                simulation_name=sim_data.get("name", ""),
                simulation_slug=sim_data.get("slug", ""),
                member_role=row["member_role"],
                joined_at=row.get("joined_at"),
            )
        )

    profile = await UserProfileService.get_profile_extras(admin, user.id)

    user_data = UserWithMemberships(
        id=user.id,
        email=user.email,
        memberships=memberships,
        onboarding_completed=profile.get("onboarding_completed", True),
        academy_epochs_played=profile.get("academy_epochs_played", 0),
        is_platform_admin=await is_platform_admin(user, admin),
    )

    return SuccessResponse(data=user_data)


@router.get("/me/notification-preferences")
async def get_notification_preferences(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[NotificationPreferencesResponse]:
    """Get the current user's notification preferences.

    Returns defaults if no preferences have been saved yet.
    """
    prefs = await UserProfileService.get_notification_preferences(supabase, user.id)
    return SuccessResponse(data=prefs)


@router.post("/me/notification-preferences")
async def update_notification_preferences(
    body: NotificationPreferencesUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[NotificationPreferencesResponse]:
    """Update the current user's notification preferences (upsert)."""
    result = await UserProfileService.upsert_notification_preferences(
        supabase,
        user.id,
        body.model_dump(),
    )
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "notification_preferences",
        user.id,
        "update",
    )
    return SuccessResponse(data=result)


@router.patch("/me/onboarding")
async def complete_onboarding(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse:
    """Mark the current user's onboarding as completed."""
    await UserProfileService.complete_onboarding(supabase, user.id)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "user_profiles",
        user.id,
        "complete_onboarding",
    )
    return SuccessResponse(data={"onboarding_completed": True})


@router.get("/me/image-preferences")
async def get_image_preferences(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ImagePreferencesResponse]:
    """Was der Nutzer ueber die fuer ihn erzeugten Bilder entschieden hat."""
    stand = await UserProfileService.get_image_preferences(supabase, user.id)
    return SuccessResponse(data=ImagePreferencesResponse(**stand))


@router.patch("/me/image-preferences")
async def update_image_preferences(
    body: ImagePreferencesUpdate,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ImagePreferencesResponse]:
    """Inhaltsstufe und Blick des Nutzers setzen.

    DIE EINZIGE STELLE, AN DER DER WUNSCH GESCHRIEBEN WIRD — mit Absicht.

    `image_content_policy` haelt fest, dass der Server den Nutzerwunsch aus
    der Datenbank liest und nicht aus dem Bildaufruf: sonst koennte ein Klient
    die Stufe im selben Aufruf anheben, in dem er das Bild bestellt. Die
    Einstellungsflaeche ist deshalb der vorgesehene Schreibweg, und ein Test
    (`TestDerKlientKannNichtsAnheben`) bindet die andere Haelfte.
    """
    stand = await UserProfileService.update_image_preferences(
        supabase,
        user.id,
        image_content_preference=body.image_content_preference,
        scene_image_vantage=body.scene_image_vantage,
        vantage_folgt_der_welt=body.vantage_folgt_der_welt,
    )
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "user_profiles",
        user.id,
        "update_image_preferences",
        details={"fields": sorted(body.model_dump(exclude_none=True))},
    )
    return SuccessResponse(data=ImagePreferencesResponse(**stand))
