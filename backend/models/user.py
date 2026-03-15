from uuid import UUID

from pydantic import BaseModel


class UserProfile(BaseModel):
    """Basic user profile."""

    id: UUID
    email: str


class MembershipInfo(BaseModel):
    """Simulation membership details for a user."""

    simulation_id: UUID
    simulation_name: str
    simulation_slug: str = ""
    member_role: str


class UserWithMemberships(BaseModel):
    """User profile with all simulation memberships."""

    id: UUID
    email: str
    memberships: list[MembershipInfo] = []
    onboarding_completed: bool = True
    academy_epochs_played: int = 0
    is_platform_admin: bool = False


class ActiveEpochParticipation(BaseModel):
    """Active epoch participation summary for the dashboard."""

    epoch_id: UUID
    epoch_name: str
    epoch_status: str
    epoch_type: str = "competitive"
    current_cycle: int
    total_cycles: int
    current_rp: int
    rp_cap: int
    simulation_name: str
    rank: int = 0
    participant_count: int = 0


class DashboardData(BaseModel):
    """Aggregated dashboard data for the authenticated user."""

    memberships: list[MembershipInfo] = []
    active_epoch_participations: list[ActiveEpochParticipation] = []
    academy_epochs_played: int = 0
    active_resonance_count: int = 0
