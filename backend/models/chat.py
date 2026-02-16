"""Pydantic models for chat conversations and messages."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ConversationCreate(BaseModel):
    """Schema for creating a new chat conversation."""

    agent_id: UUID
    title: str | None = None


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
    agent_id: UUID
    title: str | None = None
    status: str = "active"
    message_count: int = 0
    last_message_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class MessageResponse(BaseModel):
    """Full chat message response."""

    id: UUID
    conversation_id: UUID
    sender_role: str
    content: str
    metadata: dict | None = None
    created_at: datetime
