"""Pydantic models for agent bonds and whispers."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# ── Request Models ─────────────────────────────────────────────────────────


class AttentionTrackRequest(BaseModel):
    """Track that a user viewed an agent's detail page."""

    agent_id: UUID


class BondFormRequest(BaseModel):
    """Accept a bond with an agent after recognition."""

    agent_id: UUID


# ── Response Models ────────────────────────────────────────────────────────


class WhisperResponse(BaseModel):
    """A single whisper from a bonded agent."""

    id: UUID
    bond_id: UUID
    whisper_type: str
    content_de: str
    content_en: str
    trigger_context: dict = Field(default_factory=dict)
    read_at: datetime | None = None
    acted_on: bool = False
    action_acknowledged: bool = False
    created_at: datetime


class BondResponse(BaseModel):
    """Core bond data for list and detail views."""

    id: UUID
    user_id: UUID
    agent_id: UUID
    simulation_id: UUID
    depth: int
    status: str
    attention_score: int
    formed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    # Enriched fields (joined from agents table)
    agent_name: str | None = None
    agent_portrait_url: str | None = None


class BondDetailResponse(BondResponse):
    """Extended bond detail including recent whispers and agent mood."""

    recent_whispers: list[WhisperResponse] = Field(default_factory=list)
    unread_count: int = 0
    agent_mood_score: int | None = None
    agent_dominant_emotion: str | None = None
    agent_stress_level: int | None = None


class RecognitionCandidate(BaseModel):
    """An agent that has crossed the attention threshold and is ready for bond offer."""

    agent_id: UUID
    agent_name: str
    agent_portrait_url: str | None = None
    attention_score: int
    simulation_id: UUID


class PublicBondResponse(BaseModel):
    """Public-facing bond data (no user_id, no whisper content)."""

    id: UUID
    agent_id: UUID
    simulation_id: UUID
    depth: int
    status: str
    formed_at: datetime | None = None
    agent_name: str | None = None
    agent_portrait_url: str | None = None
