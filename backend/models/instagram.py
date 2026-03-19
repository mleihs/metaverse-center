"""Pydantic models for Instagram publishing pipeline."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field  # noqa: I001

# --- Response Models ---


class InstagramPostResponse(BaseModel):
    """Instagram post response for API endpoints."""

    id: UUID
    simulation_id: UUID | None = None
    content_source_type: str
    content_source_id: UUID | None = None
    caption: str
    hashtags: list[str] = Field(default_factory=list)
    alt_text: str | None = None
    image_urls: list[str] = Field(default_factory=list)
    media_type: str = "IMAGE"
    status: str = "draft"
    scheduled_at: datetime | None = None
    published_at: datetime | None = None
    failure_reason: str | None = None
    retry_count: int = 0
    ig_permalink: str | None = None
    ig_media_id: str | None = None
    likes_count: int = 0
    comments_count: int = 0
    reach: int = 0
    impressions: int = 0
    saves: int = 0
    shares: int = 0
    engagement_rate: float = 0.0
    metrics_updated_at: datetime | None = None
    unlock_code: str | None = None
    ai_disclosure_included: bool = True
    ai_model_used: str | None = None
    created_at: datetime
    updated_at: datetime
    created_by_id: UUID | None = None


class InstagramQueueItem(BaseModel):
    """Instagram queue item with simulation metadata (from v_instagram_queue)."""

    id: UUID
    simulation_id: UUID | None = None
    content_source_type: str
    content_source_id: UUID | None = None
    caption: str
    hashtags: list[str] = Field(default_factory=list)
    alt_text: str | None = None
    image_urls: list[str] = Field(default_factory=list)
    media_type: str = "IMAGE"
    status: str = "draft"
    scheduled_at: datetime | None = None
    published_at: datetime | None = None
    failure_reason: str | None = None
    retry_count: int = 0
    ig_permalink: str | None = None
    likes_count: int = 0
    comments_count: int = 0
    reach: int = 0
    saves: int = 0
    shares: int = 0
    engagement_rate: float = 0.0
    metrics_updated_at: datetime | None = None
    unlock_code: str | None = None
    ai_disclosure_included: bool = True
    ai_model_used: str | None = None
    created_at: datetime
    updated_at: datetime
    created_by_id: UUID | None = None
    simulation_name: str | None = None
    simulation_slug: str | None = None
    simulation_theme: str | None = None


class InstagramAnalytics(BaseModel):
    """Aggregated Instagram performance analytics."""

    period_days: int = 30
    total_posts: int = 0
    total_drafts: int = 0
    total_scheduled: int = 0
    total_failed: int = 0
    avg_engagement_rate: float | None = None
    total_reach: int | None = None
    total_likes: int | None = None
    total_saves: int | None = None
    total_shares: int | None = None
    total_comments: int | None = None
    top_content_type: str | None = None
    engagement_by_simulation: list[dict] = Field(default_factory=list)
    engagement_by_type: list[dict] = Field(default_factory=list)


class InstagramRateLimit(BaseModel):
    """Instagram API rate limit status."""

    quota_usage: int = 0
    quota_total: int = 100
    remaining: int = 100


# --- Request Models ---


class CreateInstagramPostRequest(BaseModel):
    """Manual post creation request."""

    simulation_id: UUID
    content_source_type: str = Field(
        ...,
        pattern=r"^(agent|building|chronicle|lore|battle_report|heartbeat|resonance)$",
    )
    content_source_id: UUID | None = None
    caption: str = Field(..., max_length=2200)
    hashtags: list[str] = Field(default_factory=list, max_length=5)
    alt_text: str | None = Field(None, max_length=100)
    image_urls: list[str] = Field(..., min_length=1, max_length=10)
    media_type: str = Field(
        default="IMAGE",
        pattern=r"^(IMAGE|CAROUSEL|STORIES|REELS)$",
    )
    scheduled_at: datetime | None = None
    unlock_code: str | None = None


class ApprovePostRequest(BaseModel):
    """Approve a draft post for scheduling."""

    scheduled_at: datetime | None = None


class RejectPostRequest(BaseModel):
    """Reject a draft post with reason."""

    reason: str = Field(..., min_length=1, max_length=500)


class GenerateContentRequest(BaseModel):
    """Request to auto-generate Instagram content from platform data."""

    content_types: list[str] = Field(
        default=["agent", "building", "chronicle", "lore"],
    )
    simulation_id: UUID | None = None
    count: int = Field(default=1, ge=1, le=10)
