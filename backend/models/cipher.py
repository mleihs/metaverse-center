"""Pydantic models for the Cipher ARG system."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field  # noqa: I001

# --- Request Models ---


class CipherRedeemRequest(BaseModel):
    """Public cipher redemption request."""

    code: str = Field(..., min_length=1, max_length=50)


class CipherSetRequest(BaseModel):
    """Admin: set/override cipher code for a post."""

    unlock_code: str = Field(..., min_length=1, max_length=50)
    difficulty: str = Field(default="medium", pattern=r"^(easy|medium|hard)$")


# --- Response Models ---


class CipherRedemptionResponse(BaseModel):
    """Result of a cipher redemption attempt."""

    success: bool
    error_code: str | None = None
    message: str | None = None
    redemption_id: UUID | None = None
    reward_type: str | None = None
    reward_data: dict | None = None
    attempts_remaining: int | None = None
    retry_after_seconds: int | None = None


class CipherRedemptionRecord(BaseModel):
    """A single cipher redemption record (admin view)."""

    id: UUID
    instagram_post_id: UUID
    user_id: UUID | None = None
    redeemed_at: datetime
    ip_hash: str | None = None
    reward_type: str
    reward_data: dict = Field(default_factory=dict)


class CipherStatsResponse(BaseModel):
    """Aggregated cipher statistics for admin panel."""

    total_redemptions: int = 0
    unique_users: int = 0
    total_attempts: int = 0
    success_rate: float = 0.0
    recent_redemptions: list[CipherRedemptionRecord] = Field(default_factory=list)
