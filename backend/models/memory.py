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
    #: Ende des Gueltigkeitsfensters. NULL heisst „gilt weiter" (Migration 379).
    valid_until: datetime | None = None
    #: Die Erinnerung, die diese abgeloest hat. Gesetzt heisst: nicht mehr im
    #: Abruf — ihre Nachfolgerin beantwortet dieselbe Frage.
    superseded_by: UUID | None = None
    #: Ob das Fenster zu ist. Kommt aus `retrieve_agent_memories`, nicht aus
    #: der Tabelle: `valid_until <= now()` ist eine Frage an die UHR, und die
    #: gehoert dorthin, wo die Abfrage laeuft — nicht in eine Rechnung in
    #: Python, die je nach Zeitzone der Anwendung anders ausfaellt.
    expired: bool | None = None


class ReflectionRequest(BaseModel):
    """Request to trigger agent reflection."""

    locale: str = "en"
