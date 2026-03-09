"""Pydantic models for admin data cleanup operations."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

CleanupType = Literal[
    "completed_epochs",
    "cancelled_epochs",
    "stale_lobbies",
    "archived_instances",
    "audit_log",
    "bot_decision_log",
]


class CleanupPreviewRequest(BaseModel):
    cleanup_type: CleanupType
    min_age_days: int = Field(..., ge=0, le=3650, description="Minimum age in days")
    epoch_ids: list[str] | None = Field(
        None, description="Specific epoch IDs to target (bypasses age filter)",
    )


class CleanupExecuteRequest(BaseModel):
    cleanup_type: CleanupType
    min_age_days: int = Field(..., ge=0, le=3650, description="Minimum age in days")
    epoch_ids: list[str] | None = Field(
        None, description="Specific epoch IDs to target (bypasses age filter)",
    )


class CleanupCategoryStats(BaseModel):
    count: int
    oldest_at: datetime | None = None


class CleanupStats(BaseModel):
    completed_epochs: CleanupCategoryStats
    cancelled_epochs: CleanupCategoryStats
    stale_lobbies: CleanupCategoryStats
    archived_instances: CleanupCategoryStats
    audit_log_entries: CleanupCategoryStats
    bot_decision_entries: CleanupCategoryStats


class CleanupPreviewItem(BaseModel):
    id: str
    name: str
    updated_at: datetime | None = None


class CleanupPreviewResult(BaseModel):
    cleanup_type: CleanupType
    min_age_days: int
    primary_count: int
    cascade_counts: dict[str, int] = Field(default_factory=dict)
    items: list[CleanupPreviewItem] = Field(default_factory=list)


class CleanupExecuteResult(BaseModel):
    cleanup_type: CleanupType
    min_age_days: int
    deleted_count: int
    cascade_counts: dict[str, int] = Field(default_factory=dict)
