"""Pydantic models for the Bleed Gazette — multiverse news wire."""

from datetime import datetime

from pydantic import BaseModel


class GazetteEntry(BaseModel):
    """A single Bleed Gazette dispatch."""

    entry_type: str
    source_simulation: dict | None = None
    target_simulation: dict | None = None
    echo_vector: str | None = None
    strength: float | None = None
    narrative: str
    dispatch: str | None = None
    created_at: datetime
