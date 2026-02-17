"""Pydantic models for chat conversations and messages."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AgentBrief(BaseModel):
    """Lightweight agent info for message attribution."""

    id: UUID
    name: str
    portrait_image_url: str | None = None


class ConversationCreate(BaseModel):
    """Schema for creating a new chat conversation."""

    agent_ids: list[UUID] = Field(..., min_length=1)
    title: str | None = None


class AddAgentRequest(BaseModel):
    """Schema for adding an agent to a conversation."""

    agent_id: UUID


class EventReferenceCreate(BaseModel):
    """Schema for referencing an event in a conversation."""

    event_id: UUID


class MessageCreate(BaseModel):
    """Schema for sending a chat message."""

    content: str = Field(..., min_length=1, max_length=10000)
    sender_role: str = "user"
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
