"""Pydantic models for Bluesky publishing pipeline."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# --- Response Models ---


class BlueskyPostResponse(BaseModel):
    """Bluesky post response for API endpoints."""

    id: UUID
    instagram_post_id: UUID | None = None
    simulation_id: UUID | None = None
    content_source_type: str
    content_source_id: UUID | None = None
    caption: str
    facets: list[dict] | None = None
    alt_text: str | None = None
    image_urls: list[str] = Field(default_factory=list)
    status: str = "pending"
    scheduled_at: datetime | None = None
    published_at: datetime | None = None
    failure_reason: str | None = None
    retry_count: int = 0
    bsky_uri: str | None = None
    bsky_cid: str | None = None
    likes_count: int = 0
    reposts_count: int = 0
    replies_count: int = 0
    quotes_count: int = 0
    metrics_updated_at: datetime | None = None
    unlock_code: str | None = None
    created_at: datetime
    updated_at: datetime


class BlueskyQueueItem(BlueskyPostResponse):
    """Bluesky queue item with simulation and Instagram metadata (from v_bluesky_queue)."""

    simulation_name: str | None = None
    simulation_slug: str | None = None
    simulation_theme: str | None = None
    instagram_permalink: str | None = None
    instagram_status: str | None = None


class BlueskyAnalytics(BaseModel):
    """Aggregated Bluesky performance analytics."""

    period_days: int = 30
    total_posts: int = 0
    total_pending: int = 0
    total_failed: int = 0
    total_skipped: int = 0
    avg_likes: float | None = None
    total_reposts: int | None = None
    total_replies: int | None = None
    total_quotes: int | None = None
    engagement_by_type: list[dict] = Field(default_factory=list)


class BlueskyStatusResponse(BaseModel):
    """Bluesky connection status."""

    configured: bool
    authenticated: bool
    handle: str | None = None
    pds_url: str = "https://bsky.social"
