"""Pydantic models for chat conversations and messages."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class AgentBrief(BaseModel):
    """Lightweight agent info for message attribution."""

    id: UUID
    name: str
    portrait_image_url: str | None = None


class ConversationCreate(BaseModel):
    """Schema for creating a new chat conversation."""

    agent_ids: list[UUID] = Field(..., min_length=1)
    title: str | None = None


class ConversationUpdate(BaseModel):
    """Schema for updating a conversation (rename)."""

    title: str = Field(..., min_length=1, max_length=200)


class AddAgentRequest(BaseModel):
    """Schema for adding an agent to a conversation."""

    agent_id: UUID


class EventReferenceCreate(BaseModel):
    """Schema for referencing an event in a conversation."""

    event_id: UUID


class MessageCreate(BaseModel):
    """Schema for sending a chat message."""

    content: str = Field(..., min_length=1, max_length=10000)
    sender_role: Literal["user", "system"] = "user"
    metadata: dict | None = None
    generate_response: bool = False


class ConversationResponse(BaseModel):
    """Full conversation response."""

    id: UUID
    simulation_id: UUID
    user_id: UUID
    agent_id: UUID | None = None
    title: str | None = None
    status: str = "active"
    message_count: int = 0
    last_message_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    agents: list[AgentBrief] = []
    event_references: list["EventReferenceResponse"] = []


class MessageResponse(BaseModel):
    """Full chat message response."""

    id: UUID
    conversation_id: UUID
    sender_role: str
    content: str
    metadata: dict | None = None
    created_at: datetime
    agent_id: UUID | None = None
    agent: AgentBrief | None = None
    # AI generation metadata (populated for assistant messages from metadata JSON)
    model_used: str | None = None
    token_count: int | None = None
    generation_ms: int | None = None
    # Reactions (populated from batch RPC in get_messages)
    reactions: list["ReactionSummary"] = []

    @model_validator(mode="before")
    @classmethod
    def _extract_ai_metadata(cls, data: Any) -> Any:
        """Extract AI metadata fields from the metadata JSON dict."""
        if isinstance(data, dict):
            meta = data.get("metadata")
            if isinstance(meta, dict):
                for field in ("model_used", "token_count", "generation_ms"):
                    if field not in data or data[field] is None:
                        data[field] = meta.get(field)
        return data


class EventReferenceResponse(BaseModel):
    """Event reference with event details."""

    id: UUID
    event_id: UUID
    event_title: str
    event_type: str | None = None
    event_description: str | None = None
    occurred_at: str | None = None
    impact_level: int | None = None
    referenced_at: datetime


class ReactionToggleRequest(BaseModel):
    """Schema for toggling a reaction on a message."""

    emoji: str = Field(..., min_length=1, max_length=8)


class ReactionSummary(BaseModel):
    """Aggregated reaction for a message — emoji + count + own-vote indicator."""

    emoji: str
    count: int
    reacted_by_me: bool = False


class ReactionToggleResponse(BaseModel):
    """Result of toggling a reaction — 'added' or 'removed'."""

    action: str
    message_id: UUID
    emoji: str
