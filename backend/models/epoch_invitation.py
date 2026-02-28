"""Pydantic models for epoch invitations."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class EpochInvitationCreate(BaseModel):
    """Schema for creating an epoch invitation."""

    email: str = Field(max_length=320)
    expires_in_hours: int = Field(default=168, ge=1, le=720)


class EpochInvitationResponse(BaseModel):
    """Full epoch invitation response (for creator)."""

    id: UUID
    epoch_id: UUID
    invited_email: str
    invite_token: str
    status: str
    invited_by_id: UUID
    expires_at: datetime
    accepted_at: datetime | None = None
    accepted_by_id: UUID | None = None
    created_at: datetime


class EpochInvitationPublicResponse(BaseModel):
    """Public epoch invitation info (for token validation page)."""

    epoch_name: str
    epoch_description: str | None = None
    epoch_status: str
    lore_text: str | None = None
    expires_at: datetime
    is_expired: bool = False
    is_accepted: bool = False
