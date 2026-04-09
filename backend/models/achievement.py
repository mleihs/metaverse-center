"""Achievement/badge system models — Pydantic v2 response types."""

from datetime import datetime

from pydantic import BaseModel, Field


class AchievementDefinitionResponse(BaseModel):
    """Public achievement catalog entry."""

    id: str
    category: str
    name_en: str
    name_de: str
    description_en: str
    description_de: str
    hint_en: str | None = None
    hint_de: str | None = None
    icon_key: str
    rarity: str
    is_secret: bool = False
    sort_order: int = 0


class UserAchievementResponse(BaseModel):
    """Earned badge for a user, with definition joined."""

    id: str
    user_id: str
    achievement_id: str
    earned_at: datetime
    context: dict = Field(default_factory=dict)
    # Joined from achievement_definitions
    definition: AchievementDefinitionResponse | None = None


class AchievementProgressResponse(BaseModel):
    """In-flight progress toward a threshold badge."""

    achievement_id: str
    current_count: int
    target_count: int
    updated_at: datetime
    # Joined from achievement_definitions
    definition: AchievementDefinitionResponse | None = None


class AchievementSummaryResponse(BaseModel):
    """Aggregated achievement stats for dashboard."""

    total_available: int = 0
    total_earned: int = 0
    by_rarity: dict = Field(default_factory=dict)
    recent: list[UserAchievementResponse] = Field(default_factory=list)
