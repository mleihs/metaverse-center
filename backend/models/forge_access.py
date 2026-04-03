"""Models for forge access (clearance) request system."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

ForgeTier = Literal["architect", "director"]
ForgeStatus = Literal["pending", "approved", "rejected"]


class ForgeAccessRequestCreate(BaseModel):
    """Request body for creating a clearance upgrade request."""

    message: str | None = Field(None, max_length=500)


class ForgeAccessRequestResponse(BaseModel):
    """Response for a single forge access request."""

    id: UUID
    user_id: UUID
    requested_tier: ForgeTier
    status: ForgeStatus
    message: str | None = None
    admin_notes: str | None = None
    reviewed_by: UUID | None = None
    created_at: datetime
    reviewed_at: datetime | None = None


class ForgeAccessRequestWithEmail(BaseModel):
    """Pending request with user email (admin view)."""

    id: UUID
    user_id: UUID
    user_email: str
    requested_tier: ForgeTier
    status: ForgeStatus
    message: str | None = None
    admin_notes: str | None = None
    reviewed_by: UUID | None = None
    created_at: datetime
    reviewed_at: datetime | None = None


class ForgeAccessReviewRequest(BaseModel):
    """Request body for admin review action."""

    action: str = Field(..., pattern=r"^(approve|reject)$")
    admin_notes: str | None = Field(None, max_length=500)


class ForgeAccessReviewResponse(BaseModel):
    """Result of an admin review action (RPC output)."""

    request_id: str
    action: str
    user_email: str | None = None
    locale: str | None = None
