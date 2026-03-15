from fastapi import APIRouter, Depends

from backend.dependencies import PLATFORM_ADMIN_EMAILS, get_admin_supabase, get_current_user, get_supabase
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.notification import NotificationPreferencesResponse, NotificationPreferencesUpdate
from backend.models.user import DashboardData, MembershipInfo, UserWithMemberships
from backend.services.member_service import MemberService
from backend.services.user_dashboard_service import UserDashboardService
from backend.services.user_profile_service import UserProfileService
from supabase import Client

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/me/dashboard", response_model=SuccessResponse[DashboardData])
async def get_dashboard(
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Get aggregated dashboard data for the authenticated user."""
    data = await UserDashboardService.get_dashboard(supabase, admin, user.id)
    return {"success": True, "data": data}


@router.get("/me", response_model=SuccessResponse[UserWithMemberships])
async def get_me(
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
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
            )
        )

    profile = await UserProfileService.get_profile_extras(admin, user.id)

    user_data = UserWithMemberships(
        id=user.id,
        email=user.email,
        memberships=memberships,
        onboarding_completed=profile.get("onboarding_completed", True),
        academy_epochs_played=profile.get("academy_epochs_played", 0),
        is_platform_admin=user.email in PLATFORM_ADMIN_EMAILS,
    )

    return {"success": True, "data": user_data}


@router.get(
    "/me/notification-preferences",
    response_model=SuccessResponse[NotificationPreferencesResponse],
)
async def get_notification_preferences(
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Get the current user's notification preferences.

    Returns defaults if no preferences have been saved yet.
    """
    prefs = await UserProfileService.get_notification_preferences(supabase, user.id)
    return {"success": True, "data": prefs}


@router.post(
    "/me/notification-preferences",
    response_model=SuccessResponse[NotificationPreferencesResponse],
)
async def update_notification_preferences(
    body: NotificationPreferencesUpdate,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """Update the current user's notification preferences (upsert)."""
    result = await UserProfileService.upsert_notification_preferences(
        supabase,
        user.id,
        body.model_dump(),
    )
    return {"success": True, "data": result}


@router.patch("/me/onboarding", response_model=SuccessResponse)
async def complete_onboarding(
    user: CurrentUser = Depends(get_current_user),
    admin: Client = Depends(get_admin_supabase),
) -> dict:
    """Mark the current user's onboarding as completed."""
    await UserProfileService.complete_onboarding(admin, user.id)
    return {"success": True, "data": {"onboarding_completed": True}}
