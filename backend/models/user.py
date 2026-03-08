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
