"""Pydantic models for simulation members."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class MemberCreate(BaseModel):
    """Schema for adding a member to a simulation."""

    user_id: UUID
    member_role: str = Field(default="viewer", pattern=r"^(viewer|editor|admin)$")


class MemberUpdate(BaseModel):
    """Schema for changing a member's role."""

    member_role: str = Field(..., pattern=r"^(viewer|editor|admin|owner)$")


class MemberResponse(BaseModel):
    """Full member response."""

    id: UUID
    simulation_id: UUID
    user_id: UUID
    member_role: str
    invited_by_id: UUID | None = None
    joined_at: datetime
    created_at: datetime
    updated_at: datetime
