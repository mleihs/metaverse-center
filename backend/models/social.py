"""Pydantic models for social trends and social media posts (read-heavy)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SocialTrendResponse(BaseModel):
    """Social trend response."""

    id: UUID
    simulation_id: UUID
    name: str
    platform: str
    raw_data: dict | None = None
    volume: int = 0
    url: str | None = None
    fetched_at: datetime
    relevance_score: float | None = None
    sentiment: str | None = None
    is_processed: bool = False
    created_at: datetime
    updated_at: datetime


class SocialMediaPostResponse(BaseModel):
    """Social media post response."""

    id: UUID
    simulation_id: UUID
    platform: str
    platform_id: str
    page_id: str | None = None
    author: str | None = None
    message: str | None = None
    source_created_at: datetime
    attachments: list = Field(default_factory=list)
    reactions: dict = Field(default_factory=dict)
    transformed_content: str | None = None
    transformation_type: str | None = None
    transformed_at: datetime | None = None
    original_sentiment: dict | None = None
    transformed_sentiment: dict | None = None
    is_published: bool = False
    linked_event_id: UUID | None = None
    imported_at: datetime
    last_synced_at: datetime
    created_at: datetime
    updated_at: datetime


class SocialSyncResponse(BaseModel):
    """Result of social media post sync operation."""

    posts_synced: int
    comments_synced: int


class PipelineSettingValue(BaseModel):
    """A single pipeline setting entry with value and description."""

    value: str
    description: str


class TrendTransformResponse(BaseModel):
    """AI transformation result for a single trend."""

    trend_id: str
    original_title: str
    transformation: dict


class TrendWorkflowResponse(BaseModel):
    """Full fetch-and-store workflow result."""

    fetched: int
    stored: int
    trends: list[SocialTrendResponse]


class ArticleTransformResponse(BaseModel):
    """AI transformation result for an ephemeral article."""

    original_title: str
    transformation: dict


class ArticleIntegrateResponse(BaseModel):
    """Result of integrating an article as an event with reactions."""

    event: dict
    reactions_count: int = 0
    reactions: list[dict] = Field(default_factory=list)


class BatchIntegrateResponse(BaseModel):
    """Result of batch article integration."""

    events: list[dict] = Field(default_factory=list)
    errors: list[dict] = Field(default_factory=list)
    reactions_generated_for: str | None = None
    reactions_count: int = 0
