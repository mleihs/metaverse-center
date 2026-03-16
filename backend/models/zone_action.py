"""Pydantic models for zone actions (fortification system)."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

ZONE_ACTION_TYPES = ("fortify", "quarantine", "deploy_resources")

ZoneActionType = Literal["fortify", "quarantine", "deploy_resources"]


class ZoneActionCreate(BaseModel):
    """Schema for creating a zone action."""

    action_type: ZoneActionType


class ZoneActionResponse(BaseModel):
    """Zone action response."""

    id: UUID
    zone_id: UUID
    simulation_id: UUID
    action_type: str
    effect_value: float
    created_by_id: UUID | None = None
    expires_at: datetime
    cooldown_until: datetime
    created_at: datetime
    deleted_at: datetime | None = None
