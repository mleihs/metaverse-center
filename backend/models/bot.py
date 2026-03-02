"""Pydantic models for bot players and bot-epoch integration."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

BotPersonality = Literal["sentinel", "warlord", "diplomat", "strategist", "chaos"]
BotDifficulty = Literal["easy", "medium", "hard"]


# ── Bot Player CRUD ──────────────────────────────────────────


class BotPlayerCreate(BaseModel):
    """Schema for creating a bot player preset."""

    name: str = Field(..., min_length=1, max_length=50, description="Bot display name (callsign)")
    personality: BotPersonality = Field(..., description="Bot personality archetype")
    difficulty: BotDifficulty = Field("medium", description="Difficulty level")
    config: dict = Field(default_factory=dict, description="Per-personality tuning overrides")


class BotPlayerUpdate(BaseModel):
    """Schema for updating a bot player preset."""

    name: str | None = Field(None, min_length=1, max_length=50)
    personality: BotPersonality | None = None
    difficulty: BotDifficulty | None = None
    config: dict | None = None


class BotPlayerResponse(BaseModel):
    """Bot player preset response."""

    id: UUID
    name: str
    personality: str
    difficulty: str
    config: dict
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime


# ── Bot-Epoch Integration ────────────────────────────────────


class AddBotToEpoch(BaseModel):
    """Schema for adding a bot to an epoch lobby."""

    bot_player_id: UUID = Field(..., description="Bot preset to deploy")
    simulation_id: UUID = Field(..., description="Simulation the bot will control")
