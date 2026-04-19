"""Public DTOs for the alpha-status endpoint.

The backend reads platform_settings via service_role and projects onto a
narrow public shape. Nothing sensitive (IDs, timestamps, `updated_by_id`)
crosses the boundary.
"""

from __future__ import annotations

from pydantic import BaseModel


class FirstContactPublic(BaseModel):
    """Minimal public projection of the Bureau-Dispatch first-contact modal config."""

    enabled: bool
    version: str


class AlphaStatePublic(BaseModel):
    """Aggregate alpha-state snapshot returned by GET /api/v1/public/alpha-state."""

    first_contact: FirstContactPublic
