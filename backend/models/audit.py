"""Pydantic models for audit log (read-only)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    """Read-only audit log entry response."""

    id: UUID
    simulation_id: UUID | None = None
    user_id: UUID | None = None
    action: str
    entity_type: str | None = None
    entity_id: UUID | None = None
    details: dict = {}
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime
