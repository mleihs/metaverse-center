"""Pydantic models for Agent Memory & Reflection feature."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class MemoryResponse(BaseModel):
    """Agent memory response."""

    id: UUID
    agent_id: UUID
    simulation_id: UUID
    memory_type: str
    content: str
    content_de: str | None = None
    importance: int
    source_type: str
    source_id: UUID | None = None
    created_at: datetime
    last_accessed_at: datetime | None = None
    retrieval_score: float | None = None


class ReflectionRequest(BaseModel):
    """Request to trigger agent reflection."""

    locale: str = "en"
